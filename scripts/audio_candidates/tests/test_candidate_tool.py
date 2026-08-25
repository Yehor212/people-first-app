from __future__ import annotations

import contextlib
import io
import json
from pathlib import Path
import tempfile
import unittest
from unittest import mock
import wave

from scripts.audio_candidates.model import CandidateSpecError, load_candidate_spec
from scripts.audio_candidates.rights import CandidateRightsError, acquire_candidate
from scripts.audio_candidates import build_sources
from scripts.audio_review.rights import SourceRecord


ROOT = Path(__file__).resolve().parents[3]
SPEC_PATH = ROOT / "config/audio/hyperfocus-source-candidates-v2.json"
EXPECTED_FAMILIES = ("forest", "rain", "ocean", "fireplace", "river", "wind")


class CandidateSpecTests(unittest.TestCase):
    def test_spec_has_exact_six_by_three_cc0_source_inventory(self):
        spec = load_candidate_spec(SPEC_PATH)

        self.assertEqual(tuple(spec.families), EXPECTED_FAMILIES)
        self.assertEqual(sum(len(row.candidates) for row in spec.families.values()), 18)
        self.assertTrue(all(len(row.candidates) == 3 for row in spec.families.values()))
        self.assertTrue(all(row.none_allowed for row in spec.families.values()))
        self.assertEqual(
            {candidate.license_id for row in spec.families.values() for candidate in row.candidates},
            {"CC0-1.0"},
        )

    def test_candidates_are_sources_not_product_levels(self):
        serialized = SPEC_PATH.read_text(encoding="utf-8").lower()

        self.assertNotIn('"level"', serialized)
        self.assertNotIn('"soft"', serialized)
        self.assertNotIn('"deep"', serialized)
        self.assertNotIn('"intense"', serialized)

    def test_spec_rejects_extra_fields_duplicate_numbers_and_unapproved_urls(self):
        data = json.loads(SPEC_PATH.read_text(encoding="utf-8"))
        cases = []

        extra = json.loads(json.dumps(data))
        extra["unexpected"] = True
        cases.append((extra, "root keys mismatch"))

        duplicate = json.loads(json.dumps(data))
        duplicate["families"][1]["candidates"][0]["soundNumber"] = 3085
        duplicate["families"][1]["candidates"][0]["pageUrl"] = (
            "https://bigsoundbank.com/forest-5-s3085.html"
        )
        cases.append((duplicate, "duplicate sound number"))

        host = json.loads(json.dumps(data))
        host["families"][0]["candidates"][0]["pageUrl"] = "https://example.com/forest.wav"
        cases.append((host, "unapproved page URL"))

        runtime = json.loads(json.dumps(data))
        runtime["families"][0]["candidates"][0]["pageUrl"] = "/public/sounds/forest.wav"
        cases.append((runtime, "unapproved page URL"))

        with tempfile.TemporaryDirectory() as temp:
            path = Path(temp) / "spec.json"
            for payload, reason in cases:
                with self.subTest(reason=reason):
                    path.write_text(json.dumps(payload), encoding="utf-8")
                    with self.assertRaisesRegex(CandidateSpecError, reason):
                        load_candidate_spec(path)


class CandidateRightsTests(unittest.TestCase):
    def setUp(self):
        self.candidate = load_candidate_spec(SPEC_PATH).families["forest"].candidates[0]

    def _source_record(
        self,
        root: Path,
        *,
        page_url: str | None = None,
        title: str | None = None,
        sample_rate: int = 48000,
        channels: int = 2,
        seconds: int = 30,
    ) -> SourceRecord:
        sources = root / "sources"
        sources.mkdir(parents=True, exist_ok=True)
        audio = sources / "source.wav"
        with wave.open(str(audio), "wb") as output:
            output.setnchannels(channels)
            output.setsampwidth(2)
            output.setframerate(sample_rate)
            output.writeframes(b"\x00\x00" * channels * sample_rate * seconds)
        data = audio.read_bytes()
        digest = __import__("hashlib").sha256(data).hexdigest()
        page = b"<html>source</html>"
        license_page = b"<html>CC0</html>"
        return SourceRecord(
            sound_number=self.candidate.sound_number,
            title=title or self.candidate.expected_title,
            author="Joseph SARDIN",
            acquired_at="2026-08-25T00:00:00Z",
            source_page_url=page_url or self.candidate.page_url,
            audio_url="https://bigsoundbank.com/audio/source.wav",
            license_url=self.candidate.license_url,
            license_id="CC0-1.0",
            source_page_content_type="text/html",
            license_page_content_type="text/html",
            audio_content_type="audio/wav",
            source_page_redirect_chain=(),
            license_page_redirect_chain=(),
            audio_redirect_chain=(),
            source_page_sha256=__import__("hashlib").sha256(page).hexdigest(),
            license_page_sha256=__import__("hashlib").sha256(license_page).hexdigest(),
            source_sha256=digest,
            source_bytes=len(data),
            sample_rate_declared=sample_rate,
            channels_declared=channels,
            local_path=audio,
            rights_evidence={
                "cc0": True,
                "distribution": True,
                "adaptation": True,
                "commercial": True,
            },
            source_page_snapshot=page,
            license_page_snapshot=license_page,
        )

    def test_candidate_requires_live_number_title_author_cc0_stereo_48khz_and_duration(self):
        with tempfile.TemporaryDirectory() as temp:
            cache = Path(temp)
            source = self._source_record(cache)
            with mock.patch(
                "scripts.audio_candidates.rights.acquire_source", return_value=source
            ):
                record = acquire_candidate(self.candidate, cache, object())

        self.assertEqual(record.candidate_id, self.candidate.id)
        self.assertEqual(record.sound_number, self.candidate.sound_number)
        self.assertEqual(record.license_id, "CC0-1.0")
        self.assertEqual(record.channels, 2)
        self.assertEqual(record.sample_rate, 48000)
        self.assertEqual(record.duration_frames, 30 * 48000)
        self.assertEqual(record.status, "RIGHTS_EVIDENCE_CAPTURED_TECHNICAL_PASS_LEGAL_UNVERIFIED")

    def test_candidate_rejects_page_title_mono_rate_short_or_outside_cache(self):
        with tempfile.TemporaryDirectory() as temp:
            cache = Path(temp) / "cache"
            cache.mkdir()
            cases = [
                (self._source_record(cache / "page", page_url="https://bigsoundbank.com/wrong-s3085.html"), "page URL drift"),
                (self._source_record(cache / "title", title="Not a forest"), "title drift"),
                (self._source_record(cache / "mono", channels=1), "stereo"),
                (self._source_record(cache / "rate", sample_rate=44100), "48 kHz"),
                (self._source_record(cache / "short", seconds=29), "30 seconds"),
            ]
            outside_root = Path(temp) / "outside"
            outside = self._source_record(outside_root)
            cases.append((outside, "source cache boundary"))

            for source, reason in cases:
                with self.subTest(reason=reason), mock.patch(
                    "scripts.audio_candidates.rights.acquire_source", return_value=source
                ):
                    with self.assertRaisesRegex(CandidateRightsError, reason):
                        acquire_candidate(self.candidate, cache, object())

    def test_source_builder_cli_rejects_caller_controlled_mode_or_paths(self):
        for argv in (
            ["--offline"],
            ["--cache", "/tmp/input"],
            ["--receipts", "/tmp/output"],
        ):
            with self.subTest(argv=argv):
                with contextlib.redirect_stderr(io.StringIO()):
                    with self.assertRaises(SystemExit):
                        build_sources.main(argv)


if __name__ == "__main__":
    unittest.main()
