from __future__ import annotations

import importlib
import io
import json
from pathlib import Path
import tarfile
import tempfile
import unittest


ROOT = Path(__file__).resolve().parents[3]
POLICY_PATH = ROOT / "config/audio/hyperfocus-semantic-audit-v2.json"
MODEL_MANIFEST_PATH = ROOT / "config/audio/hyperfocus-ai-models-v2.json"
CLAP_INPUT = ROOT / "scripts/audio_audit/requirements-clap.in"
YAMNET_INPUT = ROOT / "scripts/audio_audit/requirements-yamnet.in"


def load_model_api(test_case: unittest.TestCase):
    try:
        return importlib.import_module("scripts.audio_audit.model")
    except ModuleNotFoundError as exc:
        test_case.fail(f"strict audio audit model is missing: {exc}")


def load_environment_api(test_case: unittest.TestCase):
    try:
        return importlib.import_module("scripts.audio_audit.environment")
    except ModuleNotFoundError as exc:
        test_case.fail(f"strict audio audit environment validator is missing: {exc}")


def load_acquisition_api(test_case: unittest.TestCase):
    try:
        return importlib.import_module("scripts.audio_audit.acquire_models")
    except ModuleNotFoundError as exc:
        test_case.fail(f"strict audio audit model acquisition is missing: {exc}")


def load_preprocess_api(test_case: unittest.TestCase):
    try:
        return importlib.import_module("scripts.audio_audit.preprocess")
    except ModuleNotFoundError as exc:
        test_case.fail(f"strict audio audit preprocessing is missing: {exc}")


class AuditPolicyTests(unittest.TestCase):
    def load_json(self, path: Path) -> dict:
        return json.loads(path.read_text(encoding="utf-8"))

    def write_json(self, root: Path, name: str, payload: dict) -> Path:
        path = root / name
        path.write_text(json.dumps(payload), encoding="utf-8")
        return path

    def test_canonical_policy_has_exact_literal_families_and_non_convertible_verdicts(self):
        model = load_model_api(self)

        policy = model.load_audit_policy(POLICY_PATH)

        self.assertEqual(
            tuple(policy.families),
            ("forest", "rain", "ocean", "fireplace", "river", "wind"),
        )
        self.assertEqual(policy.verdicts, ("PASS", "FAIL", "ABSTAIN", "UNVERIFIED"))
        self.assertFalse(policy.ai_may_set_human_pass)
        self.assertEqual(getattr(policy, "analysis_target_rms_dbfs", None), -24.0)

    def test_manifest_requires_exact_revision_safe_files_and_no_pickle_weights(self):
        model = load_model_api(self)

        manifest = model.load_model_manifest(MODEL_MANIFEST_PATH)
        clap = manifest.models["semantic-clap"]

        self.assertEqual(
            clap.revision,
            "365dea6ef167def6676140ed93bbc43f84dabb28",
        )
        self.assertEqual(clap.license_id, "Apache-2.0")
        self.assertIn("model.safetensors", clap.allowed_files)
        self.assertNotIn("pytorch_model.bin", clap.allowed_files)
        self.assertIn("pytorch_model.bin", clap.denied_files)

    def test_hash_pinned_manifest_matches_acquired_model_bytes(self):
        model = load_model_api(self)

        manifest = model.load_model_manifest(MODEL_MANIFEST_PATH)
        clap = manifest.models["semantic-clap"]
        yamnet = manifest.models["temporal-yamnet"]

        self.assertEqual(manifest.status, "HASH_PINNED_NOT_ADMITTED")
        self.assertEqual(
            clap.file_sha256["model.safetensors"],
            "3f648de6d030e17494be455d323b8d191233fbae0c7ce0ba745fd21a926a63a6",
        )
        self.assertEqual(
            yamnet.archive_sha256,
            "b80da2a1a56926fb0767205051a200dd7b3beaf3ea1ea126c42a53943996e5e0",
        )
        self.assertEqual(yamnet.archive_bytes, 14242921)
        self.assertEqual(
            yamnet.file_sha256["saved_model.pb"],
            "672af6e1e34fe15a42d45d70217fd39f97e10aef9b0effbf9b0bf7826fccd462",
        )

    def test_policy_rejects_extra_family_missing_abstain_and_ai_human_authority(self):
        model = load_model_api(self)
        payload = self.load_json(POLICY_PATH)
        payload["families"].append(
            {
                "id": "cafe",
                "positivePrompts": ["cafe ambience", "coffee shop", "people in a cafe"],
                "siblingNegatives": ["forest", "rain", "ocean", "fireplace", "river", "wind"],
                "hardNegatives": ["speech", "music", "dish impact"],
            }
        )
        payload["verdicts"].remove("ABSTAIN")
        payload["aiMaySetHumanPass"] = True

        with tempfile.TemporaryDirectory() as temp:
            path = self.write_json(Path(temp), "policy.json", payload)
            with self.assertRaisesRegex(
                model.AuditSpecError,
                "families must be exactly.*verdicts must be exactly.*aiMaySetHumanPass must be false",
            ):
                model.load_audit_policy(path)

    def test_model_manifest_rejects_pickle_weight_in_allowed_files(self):
        model = load_model_api(self)
        payload = self.load_json(MODEL_MANIFEST_PATH)
        payload["models"][0]["allowedFiles"].append("pytorch_model.bin")

        with tempfile.TemporaryDirectory() as temp:
            path = self.write_json(Path(temp), "models.json", payload)
            with self.assertRaisesRegex(model.AuditSpecError, "unsafe model file is allowed"):
                model.load_model_manifest(path)


class EnvironmentTests(unittest.TestCase):
    def test_environment_rejects_system_python_for_canonical_model_evidence(self):
        environment = load_environment_api(self)

        with self.assertRaisesRegex(environment.EnvironmentError, "Python 3.12 audit environment required"):
            environment.validate_environment(
                kind="clap",
                executable=Path("/usr/bin/python3"),
                observed={
                    "pythonVersion": "3.9.6",
                    "packages": {
                        "torch": "2.13.0",
                        "transformers": "5.15.1",
                        "safetensors": "0.8.0",
                    },
                },
            )

    def test_requirement_inputs_pin_every_direct_dependency(self):
        environment = load_environment_api(self)

        clap = environment.parse_direct_requirements(CLAP_INPUT)
        yamnet = environment.parse_direct_requirements(YAMNET_INPUT)

        self.assertEqual(clap["torch"], "2.13.0")
        self.assertEqual(clap["transformers"], "5.15.1")
        self.assertEqual(clap["safetensors"], "0.8.0")
        self.assertEqual(clap["huggingface-hub"], "1.28.0")
        self.assertEqual(yamnet["tensorflow"], "2.21.0")
        self.assertEqual(yamnet["tensorflow-hub"], "0.16.1")
        self.assertEqual(yamnet["tf-keras"], "2.21.0")


class ModelAcquisitionTests(unittest.TestCase):
    def test_cli_path_boundary_accepts_only_canonical_manifest_and_private_targets(self):
        acquisition = load_acquisition_api(self)
        self.assertTrue(
            hasattr(acquisition, "validate_acquisition_paths"),
            "canonical acquisition path validation is missing",
        )

        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            repo = root / "worktrees" / "task"
            manifest = repo / "config/audio/hyperfocus-ai-models-v2.json"
            manifest.parent.mkdir(parents=True)
            manifest.write_text("{}", encoding="utf-8")
            private = root / "private-evidence" / "audio-ai-audit"
            private.mkdir(parents=True)

            paths = acquisition.validate_acquisition_paths(repo, private, manifest)

            self.assertEqual(paths.cache_root, private.resolve() / "models")
            self.assertEqual(paths.receipt_path, private.resolve() / "model-acquisition-receipt.json")

    def test_cli_path_boundary_rejects_repo_write_and_arbitrary_manifest(self):
        acquisition = load_acquisition_api(self)
        self.assertTrue(
            hasattr(acquisition, "validate_acquisition_paths"),
            "canonical acquisition path validation is missing",
        )

        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            repo = root / "worktrees" / "task"
            repo.mkdir(parents=True)
            private = root / "private-evidence" / "audio-ai-audit"
            private.mkdir(parents=True)
            outside_manifest = root / "outside.json"
            outside_manifest.write_text("{}", encoding="utf-8")
            repo_private = repo / "models"
            repo_private.mkdir()
            canonical_manifest = repo / "config/audio/hyperfocus-ai-models-v2.json"
            canonical_manifest.parent.mkdir(parents=True)
            canonical_manifest.write_text("{}", encoding="utf-8")

            with self.assertRaisesRegex(acquisition.ModelAcquisitionError, "manifest path must be canonical"):
                acquisition.validate_acquisition_paths(repo, private, outside_manifest)
            with self.assertRaisesRegex(acquisition.ModelAcquisitionError, "private root cannot be inside the repository"):
                acquisition.validate_acquisition_paths(repo, repo_private, canonical_manifest)

    def test_clap_acquisition_copies_only_allowlisted_safe_files(self):
        acquisition = load_acquisition_api(self)
        model = load_model_api(self)
        spec = model.load_model_manifest(MODEL_MANIFEST_PATH).models["semantic-clap"]

        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            upstream = root / "upstream"
            upstream.mkdir()
            for name in spec.allowed_files:
                path = upstream / name
                path.write_bytes(f"safe:{name}".encode("utf-8"))

            def fetch_file(_spec, filename: str, _download_root: Path) -> Path:
                return upstream / filename

            receipt = acquisition.acquire_hf_model(spec, root / "cache", fetch_file)

            self.assertEqual(tuple(receipt.files), spec.allowed_files)
            self.assertFalse((root / "cache" / spec.id / "pytorch_model.bin").exists())
            self.assertTrue((root / "cache" / spec.id / "model.safetensors").is_file())

    def test_model_cache_rejects_tamper_and_symlink(self):
        acquisition = load_acquisition_api(self)
        model = load_model_api(self)
        spec = model.load_model_manifest(MODEL_MANIFEST_PATH).models["semantic-clap"]

        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            upstream = root / "upstream"
            upstream.mkdir()
            for name in spec.allowed_files:
                (upstream / name).write_bytes(f"safe:{name}".encode("utf-8"))

            receipt = acquisition.acquire_hf_model(
                spec,
                root / "cache",
                lambda _spec, filename, _download_root: upstream / filename,
            )
            cached = root / "cache" / spec.id / "model.safetensors"
            cached.write_bytes(b"tampered")
            with self.assertRaisesRegex(acquisition.ModelAcquisitionError, "model hash mismatch"):
                acquisition.verify_model_cache(receipt, root / "cache")

            cached.unlink()
            cached.symlink_to(upstream / "model.safetensors")
            with self.assertRaisesRegex(acquisition.ModelAcquisitionError, "model cache entry must be a regular file"):
                acquisition.verify_model_cache(receipt, root / "cache")

    def test_yamnet_archive_rejects_parent_path_and_symbolic_link(self):
        acquisition = load_acquisition_api(self)

        for name, linkname in (("../escape", ""), ("saved/link", "../target")):
            with self.subTest(name=name), tempfile.TemporaryDirectory() as temp:
                archive = Path(temp) / "model.tar.gz"
                with tarfile.open(archive, "w:gz") as stream:
                    info = tarfile.TarInfo(name)
                    if linkname:
                        info.type = tarfile.SYMTYPE
                        info.linkname = linkname
                        stream.addfile(info)
                    else:
                        body = b"unsafe"
                        info.size = len(body)
                        stream.addfile(info, io.BytesIO(body))
                with self.assertRaisesRegex(acquisition.ModelAcquisitionError, "unsafe model archive member"):
                    acquisition.extract_yamnet_archive(archive, Path(temp) / "out")


class PreprocessTests(unittest.TestCase):
    def write_stereo_fixture(self, path: Path, seconds: int = 25) -> None:
        import numpy as np
        import soundfile as sf

        sample_rate = 48000
        frames = seconds * sample_rate
        time = np.arange(frames, dtype=np.float32) / sample_rate
        left = 0.1 * np.sin(2 * np.pi * 220 * time)
        right = 0.08 * np.sin(2 * np.pi * 330 * time)
        sf.write(path, np.column_stack((left, right)), sample_rate, subtype="PCM_24")

    def test_windows_cover_start_end_and_overlap_without_changing_product_bytes(self):
        preprocess = load_preprocess_api(self)
        model = load_model_api(self)
        policy = model.load_audit_policy(POLICY_PATH)

        with tempfile.TemporaryDirectory() as temp:
            path = Path(temp) / "fixture.wav"
            self.write_stereo_fixture(path)
            original = path.read_bytes()

            view = preprocess.decode_audio_view(path)
            windows = preprocess.make_audit_windows(view, policy)

            self.assertEqual(
                [(row.start_frame, row.end_frame) for row in windows],
                [
                    (0, 480000),
                    (240000, 720000),
                    (480000, 960000),
                    (720000, 1200000),
                ],
            )
            self.assertEqual(path.read_bytes(), original)
            self.assertEqual({row.sample_rate for row in windows}, {48000})

    def test_loudness_normalized_view_is_analysis_only_and_hash_bound(self):
        preprocess = load_preprocess_api(self)
        model = load_model_api(self)
        policy = model.load_audit_policy(POLICY_PATH)

        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            path = root / "fixture.wav"
            self.write_stereo_fixture(path, seconds=12)
            output = root / "analysis"

            receipt = preprocess.write_analysis_views(path, output, policy)

            self.assertEqual(receipt.input_sha256, preprocess.file_sha256(path))
            self.assertNotEqual(receipt.normalized_sha256, receipt.input_sha256)
            self.assertTrue((output / "normalized-mono-48000.wav").is_file())
            self.assertEqual(receipt.target_rms_dbfs, -24.0)
            self.assertEqual(receipt.operations, ("decode", "downmix-mean", "resample-polyphase", "rms-normalize"))

    def test_decode_rejects_symlink_and_non_finite_samples(self):
        preprocess = load_preprocess_api(self)

        with tempfile.TemporaryDirectory() as temp:
            import numpy as np
            import soundfile as sf

            root = Path(temp)
            target = root / "target.wav"
            self.write_stereo_fixture(target, seconds=12)
            link = root / "link.wav"
            link.symlink_to(target)
            with self.assertRaisesRegex(preprocess.PreprocessError, "regular file"):
                preprocess.decode_audio_view(link)

            invalid = root / "invalid.wav"
            sf.write(invalid, np.array([[float("nan"), 0.0]], dtype=np.float32), 48000, subtype="FLOAT")
            with self.assertRaisesRegex(preprocess.PreprocessError, "non-finite"):
                preprocess.decode_audio_view(invalid)


if __name__ == "__main__":
    unittest.main()
