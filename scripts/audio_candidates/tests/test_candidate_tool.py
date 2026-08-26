from __future__ import annotations

import contextlib
import hashlib
import io
import json
from pathlib import Path
import tempfile
import unittest
from unittest import mock
import wave

import numpy as np

from scripts.audio_candidates.model import CandidateSpecError, load_candidate_spec
from scripts.audio_candidates.rights import CandidateRightsError, acquire_candidate
from scripts.audio_candidates import build_sources
from scripts.audio_candidates.preview import (
    PreviewError,
    build_raw_preview,
    verify_operations,
    verify_preview,
)
from scripts.audio_candidates.blind import (
    ReviewError,
    apply_source_review,
    build_blind_bundle,
)
from scripts.audio_candidates.mastering import (
    IntensityMetrics,
    MasteringError,
    RuntimeCandidateMeasurement,
    assign_family_levels,
    load_mastering_policy,
    measure_intensity,
)
from scripts.audio_review.rights import SourceRecord


ROOT = Path(__file__).resolve().parents[3]
SPEC_PATH = ROOT / "config/audio/hyperfocus-source-candidates-v2.json"
MASTERING_POLICY_PATH = ROOT / "config/audio/hyperfocus-runtime-mastering-v2.json"
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


class PreviewTests(unittest.TestCase):
    def _write_source(self, path: Path, *, sample_width: int = 2) -> bytes:
        sample_rate = 48000
        channels = 2
        frames = 30 * sample_rate
        with wave.open(str(path), "wb") as output:
            output.setnchannels(channels)
            output.setsampwidth(sample_width)
            output.setframerate(sample_rate)
            if sample_width == 2:
                frame = (1234).to_bytes(2, "little", signed=True) + (
                    -1234
                ).to_bytes(2, "little", signed=True)
            elif sample_width == 3:
                frame = (123456).to_bytes(3, "little", signed=True) + (
                    -123456
                ).to_bytes(3, "little", signed=True)
            else:
                frame = (12345678).to_bytes(4, "little", signed=True) + (
                    -12345678
                ).to_bytes(4, "little", signed=True)
            output.writeframes(frame * frames)
        return path.read_bytes()

    def test_preview_is_contiguous_native_pcm_without_dsp_or_level_identity(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            source = root / "source.wav"
            source_bytes = self._write_source(source, sample_width=3)
            output = root / "previews"

            record = build_raw_preview(
                "forest-c1",
                source,
                hashlib.sha256(source_bytes).hexdigest(),
                output,
            )
            verification = verify_preview(record, source)

            self.assertEqual(record.start_frame, 5 * 48000)
            self.assertEqual(record.frame_count, 20 * 48000)
            self.assertEqual(
                record.operations, ("decode-pcm", "contiguous-extract")
            )
            self.assertIsNone(record.product_level)
            self.assertEqual(record.sample_width_bytes, 3)
            self.assertEqual(verification["status"], "PASS")
            self.assertTrue(verification["sourceFrameBytesEqual"])

    def test_preview_verifier_rejects_prohibited_operations_tamper_and_symlink(self):
        for operation in (
            "eq",
            "compression",
            "crossfade",
            "mix",
            "synthetic-texture",
            "normalize",
        ):
            with self.subTest(operation=operation):
                with self.assertRaisesRegex(
                    PreviewError, "prohibited preview operation"
                ):
                    verify_operations(("decode-pcm", operation))

        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            source = root / "source.wav"
            source_bytes = self._write_source(source)
            record = build_raw_preview(
                "forest-c1",
                source,
                hashlib.sha256(source_bytes).hexdigest(),
                root / "previews",
            )
            preview = Path(record.preview_path)
            preview.write_bytes(preview.read_bytes() + b"tamper")
            with self.assertRaisesRegex(PreviewError, "preview hash mismatch"):
                verify_preview(record, source)

            link = root / "source-link.wav"
            link.symlink_to(source)
            with self.assertRaisesRegex(PreviewError, "regular source WAV"):
                build_raw_preview(
                    "forest-c2",
                    link,
                    hashlib.sha256(source_bytes).hexdigest(),
                    root / "other-previews",
                )


class BlindBundleTests(unittest.TestCase):
    def _preview_records(self, root: Path):
        records = []
        for family_index, family in enumerate(EXPECTED_FAMILIES, start=1):
            for position in (1, 2, 3):
                candidate_id = f"{family}-c{position}"
                source = root / f"{candidate_id}-source.wav"
                with wave.open(str(source), "wb") as output:
                    output.setnchannels(2)
                    output.setsampwidth(2)
                    output.setframerate(48000)
                    sample = family_index * 10 + position
                    frame = sample.to_bytes(2, "little", signed=True) * 2
                    output.writeframes(frame * 48000 * 30)
                source_bytes = source.read_bytes()
                records.append(
                    build_raw_preview(
                        candidate_id,
                        source,
                        hashlib.sha256(source_bytes).hexdigest(),
                        root / "previews",
                    )
                )
        return tuple(records)

    def test_public_bundle_contains_only_family_and_abc_names(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            records = self._preview_records(root)
            bundle = build_blind_bundle(
                records,
                root / "bundle",
                bytes.fromhex("00" * 32),
            )

            public_names = {path.name for path in bundle.public_files}
            expected_names = {
                f"{family}-{label}.wav"
                for family in EXPECTED_FAMILIES
                for label in ("A", "B", "C")
            } | {"SOURCE_REVIEW.md"}
            self.assertEqual(public_names, expected_names)
            public_text = (bundle.listen_root / "SOURCE_REVIEW.md").read_text(
                encoding="utf-8"
            )
            for forbidden in (
                "BigSoundBank",
                "current",
                "incumbent",
                "source title",
                "candidate",
                "c1",
                "c2",
                "c3",
            ):
                self.assertNotIn(forbidden.lower(), public_text.lower())
            self.assertEqual(len(bundle.mapping), 18)
            self.assertEqual(len({row["previewSha256"] for row in bundle.mapping}), 18)

    def test_ai_report_cannot_choose_candidate_or_fill_owner_fields(self):
        with self.assertRaisesRegex(ReviewError, "owner decision required"):
            apply_source_review(
                {"forest": ("A", "B", "C", "NONE")},
                {"forest": {"decision": "AI_TOP_SCORE"}},
            )


class RuntimeMasteringTests(unittest.TestCase):
    def _measurement(
        self,
        family: str,
        position: int,
        score: float,
    ) -> RuntimeCandidateMeasurement:
        candidate_id = f"{family}-c{position}"
        return RuntimeCandidateMeasurement(
            candidate_id=candidate_id,
            family=family,
            source_sha256=(f"{position:x}" * 64)[:64],
            preview_sha256=(f"{position + 6:x}" * 64)[:64],
            metrics=IntensityMetrics(
                rms_dbfs=-40.0 + score,
                motion_dbfs=-50.0 + score,
                zero_crossings_per_second=score * 10.0,
                crest_factor_db=12.0,
                intensity_score=score,
            ),
        )

    def _exact_inventory(self) -> tuple[RuntimeCandidateMeasurement, ...]:
        return tuple(
            self._measurement(family, position, float(position))
            for family in EXPECTED_FAMILIES
            for position in (1, 2, 3)
        )

    def test_signal_metrics_are_finite_stereo_48khz_and_increase_with_energy(self):
        sample_rate = 48000
        time = np.arange(sample_rate, dtype=np.float64) / sample_rate
        quiet = np.column_stack(
            (
                0.02 * np.sin(2 * np.pi * 180 * time),
                0.02 * np.sin(2 * np.pi * 220 * time),
            )
        )
        intense = np.column_stack(
            (
                0.2 * np.sin(2 * np.pi * 1800 * time),
                0.2 * np.sin(2 * np.pi * 2200 * time),
            )
        )

        quiet_metrics = measure_intensity(quiet, sample_rate)
        intense_metrics = measure_intensity(intense, sample_rate)

        self.assertAlmostEqual(quiet_metrics.rms_dbfs, -36.9897, places=3)
        self.assertAlmostEqual(intense_metrics.rms_dbfs, -16.9897, places=3)
        self.assertGreater(
            intense_metrics.intensity_score,
            quiet_metrics.intensity_score,
        )

        for samples, rate, reason in (
            (quiet[:, 0], sample_rate, "stereo"),
            (quiet, 44100, "48 kHz"),
            (np.full((10, 2), np.nan), sample_rate, "finite"),
        ):
            with self.subTest(reason=reason):
                with self.assertRaisesRegex(MasteringError, reason):
                    measure_intensity(samples, rate)

    def test_exact_all_18_assignment_ignores_input_and_blind_order(self):
        forward = self._exact_inventory()
        reverse = tuple(reversed(forward))

        first = assign_family_levels(forward)
        second = assign_family_levels(reverse)

        self.assertEqual(first, second)
        self.assertEqual(len(first), 18)
        self.assertEqual(
            [(row.family, row.level, row.candidate_id) for row in first[:3]],
            [
                ("forest", "soft", "forest-c1"),
                ("forest", "deep", "forest-c2"),
                ("forest", "intense", "forest-c3"),
            ],
        )
        self.assertEqual({row.candidate_id for row in first}, {
            f"{family}-c{position}"
            for family in EXPECTED_FAMILIES
            for position in (1, 2, 3)
        })

    def test_assignment_ties_resolve_by_candidate_id_and_incomplete_inventory_fails(self):
        rows = list(self._exact_inventory())
        rows[:3] = [
            self._measurement("forest", 3, 1.0),
            self._measurement("forest", 1, 1.0),
            self._measurement("forest", 2, 1.0),
        ]

        assignments = assign_family_levels(tuple(rows))

        self.assertEqual(
            [row.candidate_id for row in assignments[:3]],
            ["forest-c1", "forest-c2", "forest-c3"],
        )
        with self.assertRaisesRegex(MasteringError, "exact 18-candidate inventory"):
            assign_family_levels(tuple(rows[:-1]))
        with self.assertRaisesRegex(MasteringError, "exact 18-candidate inventory"):
            assign_family_levels(tuple(rows[:-1] + [rows[0]]))

    def test_mastering_policy_has_fixed_targets_and_operation_allowlist(self):
        policy = load_mastering_policy(MASTERING_POLICY_PATH)

        self.assertEqual(policy.target_rms_dbfs, {
            "soft": -30.0,
            "deep": -26.0,
            "intense": -22.0,
        })
        self.assertEqual(policy.crossfade_seconds, 5.0)
        self.assertEqual(policy.delivery_seconds, 30.0)
        self.assertEqual(policy.peak_ceiling_dbfs, -1.0)
        self.assertEqual(policy.operations, (
            "decode-pcm",
            "equal-power-loop-crossfade",
            "repeat-exactly-twice",
            "linked-gain",
            "safety-peak-scale",
            "encode-mp3",
        ))


if __name__ == "__main__":
    unittest.main()
