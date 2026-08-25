import contextlib
import copy
import hashlib
import http.server
import json
import math
import shutil
import socketserver
import tempfile
import threading
import unittest
import wave
from pathlib import Path

import numpy as np

from scripts.audio_review.builder import build_review_package
from scripts.audio_review.dsp import AudioError, encode_mp3, measure_audio, render_hyperfocus
from scripts.audio_review.evidence import build_human_review_matrix, write_sha256sums
from scripts.audio_review.model import SpecError, load_spec, validate_spec_dict
from scripts.audio_review.procedural import generate_ambience, generate_feedback
from scripts.audio_review.rights import HttpClient, RightsError, SourceRequest, acquire_source, validate_cc0_license_text
from scripts.audio_review.verify import VerificationError, verify_hash_inventory, verify_package

ROOT = Path(__file__).resolve().parents[3]
SPEC = ROOT / "config/audio/cc0-kimi-audio-review-spec.json"
WORKFLOW = ROOT / ".github/workflows/cc0-kimi-audio-review.yml"
FFMPEG = shutil.which("ffmpeg")
LICENSE_TEXT = "Creative Commons CC0 1.0 Universal. Share — copy and redistribute the material in any medium or format. Adapt — remix, transform, and build upon the material for any purpose, even commercially. Commercial purposes are permitted."
NUMBERS = sorted({row["source"]["soundNumber"] for row in json.loads(SPEC.read_text())["hyperfocus"]})

class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, format, *args):
        pass

@contextlib.contextmanager
def fixture_server(root: Path):
    handler = lambda *args, **kwargs: QuietHandler(*args, directory=str(root), **kwargs)
    with socketserver.TCPServer(("127.0.0.1", 0), handler) as server:
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        try:
            yield f"http://127.0.0.1:{server.server_address[1]}"
        finally:
            server.shutdown()
            thread.join(timeout=2)

def write_source_fixture(root: Path, base: str, numbers=NUMBERS):
    (root / "audio").mkdir(exist_ok=True)
    (root / "licenses.html").write_text(LICENSE_TEXT, encoding="utf-8")
    urls = []
    for number in numbers:
        audio = root / "audio" / f"sound-{number:04d}.wav"
        with wave.open(str(audio), "wb") as out:
            out.setnchannels(2)
            out.setsampwidth(2)
            out.setframerate(48000)
            frames = bytearray()
            for index in range(48000):
                left = int(2200 * math.sin(2 * math.pi * (90 + number % 300) * index / 48000))
                right = int(2200 * math.sin(2 * math.pi * (97 + number % 320) * index / 48000))
                frames.extend(left.to_bytes(2, "little", signed=True))
                frames.extend(right.to_bytes(2, "little", signed=True))
            out.writeframes(bytes(frames))
        page = f"sound-s{number:04d}.html"
        urls.append(base + "/" + page)
        (root / page).write_text(
            f"<html><head><title>Fixture {number}</title></head><body><h1>Fixture {number}</h1><p>Sound number: {number}</p><p>Author: Fixture Recorder {number}</p><p>License: CC0 1.0</p><audio src='/audio/sound-{number:04d}.wav'></audio></body></html>",
            encoding="utf-8"
        )
    locations = "".join(f"<url><loc>{url}</loc></url>" for url in urls)
    (root / "sitemap.xml").write_text(
        f"<?xml version='1.0'?><urlset xmlns='http://www.sitemaps.org/schemas/sitemap/0.9'>{locations}</urlset>",
        encoding="utf-8"
    )

class ModelContractTests(unittest.TestCase):
    def test_canonical_spec_is_exact_review_only_26_asset_inventory(self):
        spec = load_spec(SPEC)
        self.assertEqual(spec.status, "REVIEW_ONLY")
        self.assertFalse(spec.runtime_promotion_allowed)
        self.assertEqual((len(spec.hyperfocus), len(spec.ambience), len(spec.feedback), len(spec.all_assets)), (18, 3, 5, 26))
        self.assertEqual((spec.audio_contract.sample_rate, spec.audio_contract.channels, spec.audio_contract.bitrate_kbps), (48000, 2, 128))

    def test_rejects_runtime_paths_and_non_cc0_sources(self):
        data = json.loads(SPEC.read_text(encoding="utf-8"))
        data["hyperfocus"][0]["relativePath"] = "public/sounds/hyperfocus/unsafe.mp3"
        data["hyperfocus"][0]["source"]["licenseId"] = "UNKNOWN"
        with self.assertRaises(SpecError) as context:
            validate_spec_dict(data)
        self.assertIn("review package", str(context.exception))
        self.assertIn("CC0-1.0", str(context.exception))

    def test_rejects_missing_or_duplicate_roles(self):
        data = json.loads(SPEC.read_text(encoding="utf-8"))
        data["feedback"][4] = copy.deepcopy(data["feedback"][0])
        with self.assertRaises(SpecError) as context:
            validate_spec_dict(data)
        self.assertIn("exact 26-role inventory", str(context.exception))

class RightsTests(unittest.TestCase):
    def test_license_gate_requires_all_four_right_classes(self):
        evidence = validate_cc0_license_text(LICENSE_TEXT)
        self.assertTrue(all(evidence.values()))
        with self.assertRaises(RightsError):
            validate_cc0_license_text("CC0 mentioned, but no rights wording is present")

    def test_acquires_hash_bound_source_and_reuses_offline_cache(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory) / "server"
            cache = Path(directory) / "cache"
            root.mkdir()
            with fixture_server(root) as base:
                write_source_fixture(root, base, [100])
                request = SourceRequest(100, base + "/", base + "/licenses.html", "CC0-1.0")
                record = acquire_source(request, HttpClient(cache, allow_http_hosts={"127.0.0.1"}))
                self.assertEqual(record.sound_number, 100)
                self.assertEqual(record.source_sha256, hashlib.sha256(record.local_path.read_bytes()).hexdigest())
                self.assertEqual((record.sample_rate_declared, record.channels_declared), (48000, 2))
                second = acquire_source(request, HttpClient(cache, offline=True, allow_http_hosts={"127.0.0.1"}))
                self.assertEqual(second.source_sha256, record.source_sha256)

    def test_fails_closed_when_direct_audio_number_is_not_bound(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory) / "server"
            cache = Path(directory) / "cache"
            root.mkdir()
            with fixture_server(root) as base:
                write_source_fixture(root, base, [100])
                page = root / "sound-s0100.html"
                page.write_text(page.read_text().replace("sound-0100.wav", "sound-9999.wav"), encoding="utf-8")
                (root / "audio" / "sound-9999.wav").write_bytes((root / "audio" / "sound-0100.wav").read_bytes())
                with self.assertRaises(RightsError):
                    acquire_source(SourceRequest(100, base + "/", base + "/licenses.html", "CC0-1.0"), HttpClient(cache, allow_http_hosts={"127.0.0.1"}))

@unittest.skipUnless(FFMPEG, "ffmpeg required")
class AudioTests(unittest.TestCase):
    def source(self, seconds=4, sample_rate=48000):
        time = np.arange(seconds * sample_rate, dtype=np.float64) / sample_rate
        left = 0.08 * np.sin(2 * math.pi * 173 * time) + 0.03 * np.sin(2 * math.pi * 997 * time)
        right = 0.08 * np.sin(2 * math.pi * 181 * time) + 0.03 * np.sin(2 * math.pi * 991 * time)
        return np.column_stack([left, right]).astype(np.float32)

    def test_renders_loop_safe_48khz_stereo_progression(self):
        scores = []
        with tempfile.TemporaryDirectory() as directory:
            for level in ("soft", "deep", "intense"):
                pcm = render_hyperfocus(self.source(), "rain", level, 48000, seed=42, duration_seconds=3)
                output = Path(directory) / f"{level}.mp3"
                encode_mp3(pcm, output, 48000, 128, FFMPEG)
                metrics = measure_audio(output, FFMPEG)
                self.assertEqual((metrics.sample_rate, metrics.channels), (48000, 2))
                self.assertLessEqual(metrics.peak_dbfs, -1.0)
                self.assertLessEqual(metrics.dc_offset, 0.001)
                self.assertLessEqual(metrics.seam_mean_abs_diff, 0.04)
                scores.append(metrics.intensity_score)
        self.assertGreaterEqual(scores[1] - scores[0], 3.0)
        self.assertGreaterEqual(scores[2] - scores[1], 3.0)

    def test_rejects_unknown_family_or_level(self):
        with self.assertRaises(AudioError):
            render_hyperfocus(self.source(), "cafe", "soft", 48000, seed=1, duration_seconds=1)

    def test_procedural_assets_are_deterministic_smooth_and_bounded(self):
        first = generate_ambience("soft-air-veil", 2.0, 48000, 123)
        second = generate_ambience("soft-air-veil", 2.0, 48000, 123)
        self.assertTrue(np.array_equal(first, second))
        self.assertEqual(first.shape, (96000, 2))
        self.assertLess(float(np.max(np.abs(first))), 0.25)
        self.assertLess(abs(float(first.mean())), 0.001)
        notes = [{"frequency": 392.0, "start": 0.02, "length": 0.20, "level": 0.72}, {"frequency": 493.88, "start": 0.13, "length": 0.28, "level": 0.88}]
        cue = generate_feedback(0.48, 48000, notes)
        self.assertEqual(cue.shape, (23040, 2))
        self.assertLess(float(np.max(np.abs(cue))), 0.25)
        self.assertLess(float(np.max(np.abs(cue[:100]))), 0.01)
        self.assertLess(float(np.max(np.abs(cue[-100:]))), 0.01)

class EvidenceTests(unittest.TestCase):
    def test_human_review_is_hash_bound_pending_and_cross_platform(self):
        assets = [{"id": "forest:soft", "relativePath": "audio/hyperfocus/a.mp3", "sha256": "a" * 64, "kind": "hyperfocus"}, {"id": "feedback-success", "relativePath": "audio/feedback/b.mp3", "sha256": "b" * 64, "kind": "feedback"}]
        matrix = build_human_review_matrix(assets)
        self.assertEqual(matrix["status"], "PENDING_HUMAN_REVIEW")
        self.assertEqual(matrix["assets"][0]["minimumLoopMinutes"], 10)
        self.assertEqual(matrix["assets"][1]["minimumLoopMinutes"], 0)
        self.assertTrue(all(value == "UNVERIFIED" for value in matrix["platforms"].values()))
        self.assertFalse(matrix["promotionAllowed"])

    def test_verifier_checks_hash_before_file_signature(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            file = root / "audio.mp3"
            file.write_bytes(b"ID3good")
            write_sha256sums(root, [file])
            file.write_bytes(b"not-an-mp3")
            with self.assertRaises(VerificationError) as context:
                verify_hash_inventory(root)
            self.assertTrue(str(context.exception).startswith("HASH_MISMATCH:"))

@unittest.skipUnless(FFMPEG, "ffmpeg required")
class BuilderTests(unittest.TestCase):
    def test_builds_and_verifies_exact_atomic_review_package(self):
        with tempfile.TemporaryDirectory() as directory:
            server_root = Path(directory) / "server"
            server_root.mkdir()
            with fixture_server(server_root) as base:
                write_source_fixture(server_root, base)
                output = Path(directory) / "review"
                cache = Path(directory) / "cache"
                result = build_review_package(SPEC, output, cache, provider_root_override=base + "/", license_url_override=base + "/licenses.html", allow_http_hosts={"127.0.0.1"}, test_duration_cap=1.2)
                self.assertEqual((result["assetCount"], result["sourceCount"]), (26, len(NUMBERS)))
                self.assertEqual(result["status"], "TECHNICAL_PASS_HUMAN_PENDING")
                self.assertEqual(verify_package(output, SPEC)["assetCount"], 26)
                self.assertTrue((output / "SHA256SUMS").is_file())

    def test_failed_build_does_not_mutate_existing_output(self):
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / "review"
            output.mkdir()
            marker = output / "owner-marker.txt"
            marker.write_text("preserve", encoding="utf-8")
            with self.assertRaises(RightsError):
                build_review_package(SPEC, output, Path(directory) / "empty-cache", offline=True, test_duration_cap=1.2)
            self.assertEqual(marker.read_text(encoding="utf-8"), "preserve")

class WorkflowContractTests(unittest.TestCase):
    def test_workflow_is_read_only_no_secret_no_runtime_promotion(self):
        text = WORKFLOW.read_text(encoding="utf-8")
        self.assertIn("contents: read", text)
        self.assertIn("persist-credentials: false", text)
        self.assertNotIn("pull_request_target", text)
        self.assertNotIn("secrets.", text)
        self.assertNotIn("git push", text)
        self.assertNotIn("public/sounds", text)
        self.assertIn("output/cc0-kimi-audio-review", text)
        self.assertIn("python -m unittest discover", text)
        self.assertIn("python -m scripts.audio_review.build", text)
        self.assertIn("python -m scripts.audio_review.verify", text)
