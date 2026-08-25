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

from scripts.audio_review import rights as rights_module
from scripts.audio_review.builder import build_review_package, write_rights_receipts
from scripts.audio_review.dsp import AudioError, encode_mp3, measure_audio, render_hyperfocus
from scripts.audio_review.evidence import build_human_review_matrix, write_sha256sums
from scripts.audio_review.model import SpecError, load_spec, validate_spec_dict
from scripts.audio_review.procedural import generate_ambience, generate_feedback
from scripts.audio_review.quarantine import QuarantineError, assert_not_quarantined, load_denylist
from scripts.audio_review.rights import HttpClient, RightsError, SourceRequest, acquire_source, validate_cc0_license_text
from scripts.audio_review.verify import VerificationError, verify_hash_inventory, verify_mp3s_not_quarantined, verify_package, verify_rights_evidence

ROOT = Path(__file__).resolve().parents[3]
SPEC = ROOT / "config/audio/cc0-kimi-audio-review-spec.json"
QUARANTINE_CONFIG = ROOT / "config/audio/quarantine-denylist.json"
WORKFLOW = ROOT / ".github/workflows/cc0-kimi-audio-review.yml"
FFMPEG = shutil.which("ffmpeg")
LICENSE_TEXT = "Creative Commons CC0 1.0 Universal. Share — copy and redistribute the material in any medium or format. Adapt — remix, transform, and build upon the material for any purpose, even commercially. Commercial purposes are permitted."
NUMBERS = sorted({row["source"]["soundNumber"] for row in json.loads(SPEC.read_text())["hyperfocus"]})
BLOCKED_HASHES = {
    "4e8c8f757848aba7337047c4d91ec9f9f5d973454ed9e86d978a1a76ac61296a",
    "49fdbd5296ac8de4b8c44b8f39643607e741109362b94b1cce25deed85967ceb",
    "affa686a1772877d8ea23c0769833e89d3c6d234ff2f4a611af85a914978565c",
    "015b77908929a3354de99e5d4c6bdb8e5db7a99e03d29cd52f2a1ef573c1b1a6",
    "84af13be0ebf0b042915a4487650b80bce4f3ed53024540dc0e48c1334752de4",
    "b47f9368dd4ff4df0403825e791ffe5b585032805d3ac6583d33f899e648f220",
    "79de9727c528e2de3b0986eea739005b3c66955adf0ab0735dd20da1dd5aa7a9",
    "b2b08f17fbf6a8ae73bdf1c66fa6fc6f8140d398039bf79cf63e4c3ae32bf5ff",
    "a0534266e5fbab15119f1fe8f2fd3bc371090346c04556dc9665549df6bc89e4",
}
QUARANTINED_HASHES = {
    "f5c8e70570f38bd86d993d3de484c85ef4e1e8c676094020360042afc5722189",
    "fa40413b5882b79825af7e74880cd7252268405b97d78655470915ab1c5358cf",
    "6fd3b57c14f83a6418fc26f6cfa4f346ee4bd7e585c14f2dc9935ac8b142bdd9",
    "b79c475c1ee1501e6dfc8949ecf8947baa2c83f76d6e89992d16c9ca7aa111c8",
    "a67528b3a9e8621c906c53f28f8e7ca9dc1629e36e57c776c161c3ce4ebf980c",
    "e2e5988ccfca12edc45332ce6209660c056936caa4a2d07863be6214d73e0e43",
    "c64fc737ff4e945ad1a198d5ed66ebfc6b1908bb57daa817d8b6e87db86174cc",
    "adc7126e82e1a9e11b19084927c679115698b7b1a29125b3bc0855ca6f5aa323",
    "e587d5b24016ee444dfd5de9213709fed1589b738d943d0b2b60f614c22c9d22",
    "8e01ff606b2e63cf23fa89406a17db038495980828b6d10d57473069f8c39cd2",
    "e4eafb4061e1db9a389b1365180f90afd425cf93c1e8cc244422e0a29061f1a2",
    "cdcbe3fb0c8c251c2131495c66e22061b18e0091cb26027326ce9d20cfc4e3c5",
    "13eb0d8d3e12041a534b9e6b9390de0d2c6dfdb5b20e46394782271b53d4621d",
    "e1a7f87669f5aaba5668cfded53c6d43a7f43eefb4823a456e51a53e507b79a0",
    "5004f7057a1bf4678e8201a9eb75ec5ac96baf40a8bea613989e19a016b3122e",
    "62f042ea5520d6024d06703497d2a6e43a327c11668020bb8e72094c217ce18c",
    "0b859de27b4ea7c5f6ea5a4aa3032ebba586d9308730751a62e171dde3dd4065",
}

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

@contextlib.contextmanager
def response_server(host: str = "127.0.0.1", body: bytes = b"target"):
    state = {"requests": 0}

    class Handler(http.server.BaseHTTPRequestHandler):
        def log_message(self, format, *args):
            pass

        def do_GET(self):
            state["requests"] += 1
            self.send_response(200)
            self.send_header("Content-Type", "text/plain")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

    with socketserver.TCPServer((host, 0), Handler) as server:
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        try:
            yield f"http://{host}:{server.server_address[1]}/target", state
        finally:
            server.shutdown()
            thread.join(timeout=2)

@contextlib.contextmanager
def redirect_server(target_url: str):
    class Handler(http.server.BaseHTTPRequestHandler):
        def log_message(self, format, *args):
            pass

        def do_GET(self):
            self.send_response(302)
            self.send_header("Location", target_url)
            self.end_headers()

    with socketserver.TCPServer(("127.0.0.1", 0), Handler) as server:
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        try:
            yield f"http://127.0.0.1:{server.server_address[1]}/redirect"
        finally:
            server.shutdown()
            thread.join(timeout=2)

@contextlib.contextmanager
def redirect_chain_server(redirects: int):
    class Handler(http.server.BaseHTTPRequestHandler):
        def log_message(self, format, *args):
            pass

        def do_GET(self):
            index = int(self.path.lstrip("/") or "0")
            if index < redirects:
                self.send_response(302)
                self.send_header("Location", f"/{index + 1}")
                self.end_headers()
                return
            self.send_response(200)
            self.send_header("Content-Length", "2")
            self.end_headers()
            self.wfile.write(b"ok")

    with socketserver.TCPServer(("127.0.0.1", 0), Handler) as server:
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        try:
            yield f"http://127.0.0.1:{server.server_address[1]}/0"
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

class QuarantineTests(unittest.TestCase):
    def test_canonical_denylist_matches_recovery_ledger_exactly(self):
        payload = json.loads(QUARANTINE_CONFIG.read_text(encoding="utf-8"))
        denylist = load_denylist(QUARANTINE_CONFIG)
        by_classification = {
            classification: {
                row["sha256"]
                for row in payload["entries"]
                if row["classification"] == classification
            }
            for classification in ("BLOCKED", "QUARANTINED")
        }
        self.assertEqual(len(denylist), 26)
        self.assertEqual(len(BLOCKED_HASHES), 9)
        self.assertEqual(len(QUARANTINED_HASHES), 17)
        self.assertEqual(by_classification["BLOCKED"], BLOCKED_HASHES)
        self.assertEqual(by_classification["QUARANTINED"], QUARANTINED_HASHES)
        self.assertEqual(denylist, frozenset(BLOCKED_HASHES | QUARANTINED_HASHES))
        ledger = ROOT / payload["sourceLedger"]["path"]
        self.assertEqual(
            hashlib.sha256(ledger.read_bytes()).hexdigest(),
            payload["sourceLedger"]["sha256"],
        )

    def test_rejects_quarantined_bytes(self):
        quarantined_bytes = b"known quarantined fixture"
        digest = hashlib.sha256(quarantined_bytes).hexdigest()
        with self.assertRaisesRegex(QuarantineError, f"QUARANTINED_HASH:source:forest:soft:{digest}"):
            assert_not_quarantined(
                quarantined_bytes,
                "source:forest:soft",
                frozenset({digest}),
            )

    def test_rejects_invalid_denylist_schema(self):
        payload = json.loads(QUARANTINE_CONFIG.read_text(encoding="utf-8"))
        cases = []

        duplicate = copy.deepcopy(payload)
        duplicate["entries"][1]["sha256"] = duplicate["entries"][0]["sha256"]
        cases.append(("duplicate", duplicate, "QUARANTINE_HASH_DUPLICATE"))

        malformed = copy.deepcopy(payload)
        malformed["entries"][0]["sha256"] = "not-a-sha256"
        cases.append(("malformed", malformed, "QUARANTINE_HASH_INVALID"))

        unknown = copy.deepcopy(payload)
        unknown["entries"][0]["classification"] = "UNKNOWN"
        cases.append(("classification", unknown, "QUARANTINE_CLASSIFICATION_INVALID"))

        wrong_counts = copy.deepcopy(payload)
        quarantined = next(
            row for row in wrong_counts["entries"] if row["classification"] == "QUARANTINED"
        )
        quarantined["classification"] = "BLOCKED"
        cases.append(("classification-counts", wrong_counts, "QUARANTINE_CLASSIFICATION_INVALID"))

        wrong_ledger = copy.deepcopy(payload)
        wrong_ledger["sourceLedger"]["path"] = "docs/audio/not-canonical.md"
        cases.append(("ledger", wrong_ledger, "QUARANTINE_LEDGER_INVALID"))

        wrong_ledger_hash = copy.deepcopy(payload)
        wrong_ledger_hash["sourceLedger"]["sha256"] = "0" * 64
        cases.append(("ledger-hash", wrong_ledger_hash, "QUARANTINE_LEDGER_INVALID"))

        with tempfile.TemporaryDirectory() as directory:
            for name, candidate, error in cases:
                with self.subTest(name=name):
                    path = Path(directory) / f"{name}.json"
                    path.write_text(json.dumps(candidate), encoding="utf-8")
                    with self.assertRaisesRegex(QuarantineError, error):
                        load_denylist(path)

    def test_acquired_source_bytes_are_checked_before_source_cache_write(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory) / "server"
            cache = Path(directory) / "cache"
            root.mkdir()
            with fixture_server(root) as base:
                write_source_fixture(root, base, [100])
                source_bytes = (root / "audio" / "sound-0100.wav").read_bytes()
                digest = hashlib.sha256(source_bytes).hexdigest()
                with self.assertRaisesRegex(QuarantineError, f"QUARANTINED_HASH:source:s0100:{digest}"):
                    acquire_source(
                        SourceRequest(100, base + "/", base + "/licenses.html", "CC0-1.0"),
                        HttpClient(cache, allow_http_hosts={"127.0.0.1"}),
                        denylist=frozenset({digest}),
                    )
            self.assertEqual(list((cache / "sources").glob("*")), [])

    def test_existing_source_cache_is_rehashed_and_quarantine_checked(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory) / "server"
            cache = Path(directory) / "cache"
            root.mkdir()
            with fixture_server(root) as base:
                write_source_fixture(root, base, [100])
                request = SourceRequest(100, base + "/", base + "/licenses.html", "CC0-1.0")
                record = acquire_source(
                    request,
                    HttpClient(cache, allow_http_hosts={"127.0.0.1"}),
                    denylist=frozenset(),
                )
                poisoned = b"ID3poisoned source cache"
                poisoned_sha256 = hashlib.sha256(poisoned).hexdigest()
                record.local_path.write_bytes(poisoned)
                with self.assertRaisesRegex(
                    QuarantineError,
                    f"QUARANTINED_HASH:source-cache:s0100:{poisoned_sha256}",
                ):
                    acquire_source(
                        request,
                        HttpClient(
                            cache,
                            offline=True,
                            allow_http_hosts={"127.0.0.1"},
                        ),
                        denylist=frozenset({poisoned_sha256}),
                    )

class RightsTests(unittest.TestCase):
    def test_accepts_comma_grouped_live_sound_number(self):
        html = "<h1>Forest #3</h1><p>Sound number: 2,715</p><p>Author: Pierre SIBANARCO</p><p>License: CC0 1.0</p>"
        title, author, _ = rights_module._extract_page(
            html,
            "https://bigsoundbank.com/forest-3-s2715.html",
            2715,
        )
        self.assertEqual(title, "Forest #3")
        self.assertEqual(author, "Pierre SIBANARCO")

    def test_rejects_nearby_or_malformed_sound_number(self):
        for body in ("Sound number: 27,150", "Sound number: 2.715", "Sound number: 12715"):
            with self.subTest(body=body), self.assertRaises(RightsError):
                rights_module._extract_page(
                    f"<h1>Wrong</h1><p>{body}</p><p>Author: Wrong</p><p>CC0 1.0</p>",
                    "https://bigsoundbank.com/forest-3-s2715.html",
                    2715,
                )

    def test_offline_cache_rejects_body_tampering(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory) / "server"
            cache = Path(directory) / "cache"
            root.mkdir()
            with fixture_server(root) as base:
                write_source_fixture(root, base, [100])
                client = HttpClient(cache, allow_http_hosts={"127.0.0.1"})
                response = client.fetch(base + "/sitemap.xml")
                body_path = next((cache / "http").glob("*.body"))
                body_path.write_bytes(response.body + b"tampered")
            with self.assertRaisesRegex(RightsError, "CACHE_INTEGRITY_MISMATCH"):
                HttpClient(cache, offline=True, allow_http_hosts={"127.0.0.1"}).fetch(
                    base + "/sitemap.xml"
                )

    def test_offline_cache_rejects_missing_hash_metadata(self):
        with tempfile.TemporaryDirectory() as directory:
            cache = Path(directory)
            http = cache / "http"
            http.mkdir()
            url = "https://bigsoundbank.com/sitemap.xml"
            key = hashlib.sha256(url.encode("utf-8")).hexdigest()
            (http / f"{key}.body").write_bytes(b"x")
            (http / f"{key}.json").write_text(
                '{"url":"https://bigsoundbank.com/sitemap.xml"}',
                encoding="utf-8",
            )
            with self.assertRaisesRegex(RightsError, "CACHE_METADATA_INVALID"):
                HttpClient(cache, offline=True).fetch(url)

    def test_offline_cache_rejects_symlinked_entries(self):
        with tempfile.TemporaryDirectory() as directory:
            cache = Path(directory)
            http = cache / "http"
            http.mkdir()
            url = "https://bigsoundbank.com/sitemap.xml"
            key = hashlib.sha256(url.encode("utf-8")).hexdigest()
            real_body = cache / "outside.body"
            real_body.write_bytes(b"x")
            (http / f"{key}.body").symlink_to(real_body)
            (http / f"{key}.json").write_text(
                json.dumps(
                    {
                        "url": url,
                        "contentType": "application/xml",
                        "sha256": hashlib.sha256(b"x").hexdigest(),
                        "bytes": 1,
                        "redirectChain": [],
                    }
                ),
                encoding="utf-8",
            )
            with self.assertRaisesRegex(RightsError, "CACHE_SYMLINK_REJECTED"):
                HttpClient(cache, offline=True).fetch(url)

    def test_rejects_unsafe_or_out_of_allowlist_urls(self):
        with tempfile.TemporaryDirectory() as directory:
            client = HttpClient(Path(directory))
            for url in (
                "https://user@bigsoundbank.com/file.mp3",
                "https://bigsoundbank.com:444/file.mp3",
                "https://bigsoundbank.com/file.mp3#fragment",
                "ftp://bigsoundbank.com/file.mp3",
            ):
                with self.subTest(url=url), self.assertRaises(RightsError):
                    client._validate_url(
                        url,
                        allowed_hosts=frozenset({"bigsoundbank.com"}),
                    )
            with self.assertRaisesRegex(RightsError, "outside the request allowlist"):
                client._validate_url(
                    "https://cdn.bigsoundbank.com/file.mp3",
                    allowed_hosts=frozenset({"bigsoundbank.com"}),
                )

    def test_redirect_to_out_of_allowlist_host_is_rejected_before_fetch(self):
        with tempfile.TemporaryDirectory() as directory:
            with response_server("localhost") as (target_url, state):
                with redirect_server(target_url) as source_url:
                    client = HttpClient(
                        Path(directory),
                        allow_http_hosts={"127.0.0.1"},
                    )
                    with self.assertRaisesRegex(RightsError, "outside the request allowlist"):
                        client.fetch(
                            source_url,
                            allowed_hosts=frozenset({"127.0.0.1"}),
                        )
            self.assertEqual(state["requests"], 0)

    def test_same_host_redirect_chain_is_hash_bound_in_offline_cache(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory) / "server"
            cache = Path(directory) / "cache"
            root.mkdir()
            with fixture_server(root) as base:
                write_source_fixture(root, base, [100])
                target_url = base + "/sitemap.xml"
                with redirect_server(target_url) as source_url:
                    client = HttpClient(cache, allow_http_hosts={"127.0.0.1"})
                    response = client.fetch(
                        source_url,
                        allowed_hosts=frozenset({"127.0.0.1"}),
                    )
                    self.assertEqual(response.redirect_chain, (target_url,))
                    cached = HttpClient(
                        cache,
                        offline=True,
                        allow_http_hosts={"127.0.0.1"},
                    ).fetch(
                        source_url,
                        allowed_hosts=frozenset({"127.0.0.1"}),
                    )
                    self.assertEqual(cached.redirect_chain, response.redirect_chain)

    def test_more_than_five_redirects_is_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            with redirect_chain_server(6) as source_url:
                client = HttpClient(
                    Path(directory),
                    allow_http_hosts={"127.0.0.1"},
                )
                with self.assertRaisesRegex(RightsError, "REDIRECT_LIMIT_EXCEEDED"):
                    client.fetch(
                        source_url,
                        allowed_hosts=frozenset({"127.0.0.1"}),
                    )

    def test_child_sitemap_outside_provider_host_is_rejected_before_fetch(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory) / "server"
            cache = Path(directory) / "cache"
            root.mkdir()
            with response_server("localhost", b"<urlset></urlset>") as (target_url, state):
                child_url = target_url.replace("/target", "/child.xml")
                with fixture_server(root) as base:
                    (root / "sitemap.xml").write_text(
                        f"<?xml version='1.0'?><sitemapindex><sitemap><loc>{child_url}</loc></sitemap></sitemapindex>",
                        encoding="utf-8",
                    )
                    client = HttpClient(cache, allow_http_hosts={"127.0.0.1"})
                    with self.assertRaisesRegex(RightsError, "SITEMAP_HOST_MISMATCH"):
                        rights_module._collect_sitemap_urls(
                            client,
                            base + "/",
                            allowed_hosts=frozenset({"127.0.0.1"}),
                        )
            self.assertEqual(state["requests"], 0)

    def test_license_gate_requires_all_four_right_classes(self):
        evidence = validate_cc0_license_text(LICENSE_TEXT)
        self.assertTrue(all(evidence.values()))
        with self.assertRaises(RightsError):
            validate_cc0_license_text("CC0 mentioned, but no rights wording is present")

    def test_license_gate_rejects_negated_commercial_or_redistribution_rights(self):
        for text in (
            "CC0 1.0. You may adapt, but commercial use is not permitted. You may distribute.",
            "CC0 1.0. Commercial use and adaptation are allowed, but redistribution is prohibited.",
        ):
            with self.subTest(text=text), self.assertRaises(RightsError):
                validate_cc0_license_text(text)

    def test_source_page_requires_named_author(self):
        html = "<h1>Forest</h1><p>Sound number: 100</p><p>CC0 1.0</p>"
        with self.assertRaisesRegex(RightsError, "AUTHOR_NOT_STATED"):
            rights_module._extract_page(
                html,
                "https://bigsoundbank.com/foret-s0100.html",
                100,
            )

    def test_acquires_hash_bound_source_and_reuses_offline_cache(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory) / "server"
            cache = Path(directory) / "cache"
            root.mkdir()
            with fixture_server(root) as base:
                write_source_fixture(root, base, [100])
                request = SourceRequest(100, base + "/", base + "/licenses.html", "CC0-1.0")
                record = acquire_source(
                    request,
                    HttpClient(cache, allow_http_hosts={"127.0.0.1"}),
                    denylist=frozenset(),
                )
                self.assertEqual(record.sound_number, 100)
                self.assertEqual(record.source_sha256, hashlib.sha256(record.local_path.read_bytes()).hexdigest())
                self.assertEqual((record.sample_rate_declared, record.channels_declared), (48000, 2))
                second = acquire_source(
                    request,
                    HttpClient(cache, offline=True, allow_http_hosts={"127.0.0.1"}),
                    denylist=frozenset(),
                )
                self.assertEqual(second.source_sha256, record.source_sha256)

    def test_source_record_preserves_hash_bound_receipt_snapshots(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory) / "server"
            cache = Path(directory) / "cache"
            root.mkdir()
            with fixture_server(root) as base:
                write_source_fixture(root, base, [100])
                record = acquire_source(
                    SourceRequest(100, base + "/", base + "/licenses.html", "CC0-1.0"),
                    HttpClient(cache, allow_http_hosts={"127.0.0.1"}),
                    denylist=frozenset(),
                )
                self.assertEqual(
                    record.source_page_snapshot,
                    (root / "sound-s0100.html").read_bytes(),
                )
                self.assertEqual(
                    record.license_page_snapshot,
                    (root / "licenses.html").read_bytes(),
                )
                self.assertTrue(record.acquired_at.endswith("Z"))
                self.assertEqual(record.source_page_redirect_chain, ())
                self.assertEqual(record.license_page_redirect_chain, ())
                self.assertEqual(record.audio_redirect_chain, ())
                serializable = record.serializable()
                self.assertNotIn("local_path", serializable)
                self.assertNotIn("source_page_snapshot", serializable)
                self.assertNotIn("license_page_snapshot", serializable)
                receipt = record.receipt_manifest()
                self.assertEqual(
                    receipt["sourcePage"],
                    {
                        "url": record.source_page_url,
                        "artifactPath": "evidence/rights/s0100/source-page.html",
                        "sha256": record.source_page_sha256,
                        "bytes": len(record.source_page_snapshot),
                        "contentType": record.source_page_content_type,
                        "redirectChain": [],
                    },
                )
                self.assertEqual(
                    receipt["licensePage"],
                    {
                        "url": record.license_url,
                        "artifactPath": "evidence/rights/s0100/license-page.html",
                        "sha256": record.license_page_sha256,
                        "bytes": len(record.license_page_snapshot),
                        "contentType": record.license_page_content_type,
                        "redirectChain": [],
                    },
                )
                self.assertFalse(receipt["audio"]["includedInReviewArtifact"])
                self.assertNotIn("artifactPath", receipt["audio"])

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
                    acquire_source(
                        SourceRequest(100, base + "/", base + "/licenses.html", "CC0-1.0"),
                        HttpClient(cache, allow_http_hosts={"127.0.0.1"}),
                        denylist=frozenset(),
                    )

    def test_fails_closed_when_audio_url_only_contains_nearby_sound_number(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory) / "server"
            cache = Path(directory) / "cache"
            root.mkdir()
            with fixture_server(root) as base:
                write_source_fixture(root, base, [100])
                page = root / "sound-s0100.html"
                page.write_text(
                    page.read_text().replace("sound-0100.wav", "sound-01000.wav"),
                    encoding="utf-8",
                )
                (root / "audio" / "sound-01000.wav").write_bytes(
                    (root / "audio" / "sound-0100.wav").read_bytes()
                )
                with self.assertRaisesRegex(RightsError, "No sound-number-bound audio URL"):
                    acquire_source(
                        SourceRequest(100, base + "/", base + "/licenses.html", "CC0-1.0"),
                        HttpClient(cache, allow_http_hosts={"127.0.0.1"}),
                        denylist=frozenset(),
                    )

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
    def test_independent_mp3_verifier_rejects_quarantined_bytes(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            relative = "audio/hyperfocus/quarantined.mp3"
            path = root / relative
            path.parent.mkdir(parents=True)
            path.write_bytes(b"ID3known quarantined package bytes")
            digest = hashlib.sha256(path.read_bytes()).hexdigest()
            with self.assertRaisesRegex(
                VerificationError,
                f"QUARANTINED_HASH:package:{relative}:{digest}",
            ):
                verify_mp3s_not_quarantined(root, {relative}, frozenset({digest}))

    def test_writes_private_hash_bound_rights_receipts_without_source_audio(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory) / "server"
            cache = Path(directory) / "cache"
            review = Path(directory) / "review"
            root.mkdir()
            with fixture_server(root) as base:
                write_source_fixture(root, base, [100])
                record = acquire_source(
                    SourceRequest(100, base + "/", base + "/licenses.html", "CC0-1.0"),
                    HttpClient(cache, allow_http_hosts={"127.0.0.1"}),
                    denylist=frozenset(),
                )
            manifests = write_rights_receipts(review, {100: record})
            source_page = review / "evidence/rights/s0100/source-page.html"
            license_page = review / "evidence/rights/s0100/license-page.html"
            receipt_path = review / "evidence/rights/s0100/receipt.json"
            self.assertEqual(source_page.read_bytes(), record.source_page_snapshot)
            self.assertEqual(license_page.read_bytes(), record.license_page_snapshot)
            self.assertEqual(json.loads(receipt_path.read_text(encoding="utf-8")), manifests[0])
            self.assertEqual(manifests[0]["sourcePage"]["sha256"], hashlib.sha256(source_page.read_bytes()).hexdigest())
            self.assertEqual(manifests[0]["licensePage"]["sha256"], hashlib.sha256(license_page.read_bytes()).hexdigest())
            self.assertEqual(list((review / "evidence/rights").rglob("*.wav")), [])
            self.assertTrue(record.local_path.is_file())
            self.assertFalse(record.local_path.is_relative_to(review))

    def test_rights_evidence_verifier_requires_receipts_and_truthful_status(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory) / "server"
            cache = Path(directory) / "cache"
            review = Path(directory) / "review"
            root.mkdir()
            review.mkdir()
            with fixture_server(root) as base:
                write_source_fixture(root, base, [100])
                record = acquire_source(
                    SourceRequest(100, base + "/", base + "/licenses.html", "CC0-1.0"),
                    HttpClient(cache, allow_http_hosts={"127.0.0.1"}),
                    denylist=frozenset(),
                )
            receipts = write_rights_receipts(review, {100: record})
            ledger = {
                "schemaVersion": 1,
                "status": "CC0_SOURCE_RIGHTS_VERIFIED_AT_BUILD_TIME",
                "canonicalLicense": "CC0-1.0",
                "sources": [record.serializable()],
                "receipts": receipts,
                "legalBoundary": "Evidence packet, not legal advice.",
            }
            ledger_path = review / "rights-ledger.json"
            ledger_path.write_text(json.dumps(ledger), encoding="utf-8")

            def inventory():
                files = [
                    path
                    for path in review.rglob("*")
                    if path.is_file() and path.name != "SHA256SUMS"
                ]
                write_sha256sums(review, files)
                return verify_hash_inventory(review)

            with self.assertRaisesRegex(VerificationError, "RIGHTS_EVIDENCE_INCOMPLETE"):
                verify_rights_evidence(review, inventory(), {100})

            ledger["status"] = "RIGHTS_EVIDENCE_CAPTURED_REVIEW_REQUIRED"
            ledger["legalBoundary"] = "Source-specific technical evidence; not legal clearance, legal advice, exclusivity, or a warranty against third-party claims."
            ledger_path.write_text(json.dumps(ledger), encoding="utf-8")
            self.assertEqual(verify_rights_evidence(review, inventory(), {100}), 1)

            source_page = review / "evidence/rights/s0100/source-page.html"
            source_page.write_bytes(record.source_page_snapshot + b"tampered")
            with self.assertRaisesRegex(
                VerificationError,
                r"HASH_MISMATCH:evidence/rights/s0100/source-page\.html",
            ):
                verify_hash_inventory(review)
            source_page.write_bytes(record.source_page_snapshot)

            receipt_path = review / "evidence/rights/s0100/receipt.json"
            receipt = json.loads(receipt_path.read_text(encoding="utf-8"))
            receipt["sourcePage"]["sha256"] = "0" * 64
            receipt_path.write_text(json.dumps(receipt), encoding="utf-8")
            with self.assertRaisesRegex(VerificationError, "RIGHTS_EVIDENCE_INCOMPLETE"):
                verify_rights_evidence(review, inventory(), {100})

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
                rights = json.loads((output / "rights-ledger.json").read_text(encoding="utf-8"))
                self.assertEqual(rights["status"], "RIGHTS_EVIDENCE_CAPTURED_REVIEW_REQUIRED")
                self.assertEqual(len(rights["receipts"]), len(NUMBERS))
                expected_denylist_attestation = {
                    "path": "config/audio/quarantine-denylist.json",
                    "sha256": hashlib.sha256(QUARANTINE_CONFIG.read_bytes()).hexdigest(),
                    "entries": 26,
                }
                provenance = json.loads((output / "provenance.json").read_text(encoding="utf-8"))
                build_environment = json.loads((output / "build-environment.json").read_text(encoding="utf-8"))
                self.assertEqual(provenance["quarantineDenylist"], expected_denylist_attestation)
                self.assertEqual(build_environment["quarantineDenylist"], expected_denylist_attestation)
                for number in NUMBERS:
                    receipt_dir = output / "evidence" / "rights" / f"s{number:04d}"
                    self.assertTrue((receipt_dir / "source-page.html").is_file())
                    self.assertTrue((receipt_dir / "license-page.html").is_file())
                    self.assertTrue((receipt_dir / "receipt.json").is_file())
                self.assertEqual(
                    [path for path in (output / "evidence" / "rights").rglob("*") if path.suffix.lower() in {".wav", ".flac", ".mp3", ".ogg"}],
                    [],
                )
                custom_denylist = Path(directory) / "candidate-denylist.json"
                custom_payload = json.loads(QUARANTINE_CONFIG.read_text(encoding="utf-8"))
                first_candidate = output / "audio/hyperfocus/hyperfocus-forest-soft.mp3"
                custom_payload["entries"][0]["sha256"] = hashlib.sha256(first_candidate.read_bytes()).hexdigest()
                custom_denylist.write_text(json.dumps(custom_payload), encoding="utf-8")
                with self.assertRaisesRegex(QuarantineError, "QUARANTINED_HASH:candidate:forest:soft"):
                    build_review_package(
                        SPEC,
                        Path(directory) / "blocked-review",
                        cache,
                        provider_root_override=base + "/",
                        license_url_override=base + "/licenses.html",
                        allow_http_hosts={"127.0.0.1"},
                        test_duration_cap=1.2,
                        denylist_path=custom_denylist,
                    )
                tampered = output / "evidence" / "rights" / f"s{NUMBERS[0]:04d}" / "source-page.html"
                tampered.write_bytes(tampered.read_bytes() + b"tampered")
                with self.assertRaisesRegex(
                    VerificationError,
                    rf"HASH_MISMATCH:evidence/rights/s{NUMBERS[0]:04d}/source-page\.html",
                ):
                    verify_package(output, SPEC)

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
