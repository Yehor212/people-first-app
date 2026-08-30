from __future__ import annotations

import importlib
import io
import json
import os
from pathlib import Path
import tarfile
import tempfile
import unittest


ROOT = Path(__file__).resolve().parents[3]
POLICY_PATH = ROOT / "config/audio/hyperfocus-semantic-audit-v2.json"
MODEL_MANIFEST_PATH = ROOT / "config/audio/hyperfocus-ai-models-v2.json"
VISIBLE_REGRESSION_PATH = ROOT / "config/audio/hyperfocus-visible-regression-v1.json"
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


def load_backend_protocol_api(test_case: unittest.TestCase):
    try:
        return importlib.import_module("scripts.audio_audit.backend_protocol")
    except ModuleNotFoundError as exc:
        test_case.fail(f"strict audio audit backend protocol is missing: {exc}")


def load_runner_common_api(test_case: unittest.TestCase):
    try:
        return importlib.import_module("scripts.audio_audit.backends.common")
    except ModuleNotFoundError as exc:
        test_case.fail(f"strict audio audit backend validation is missing: {exc}")


def load_audit_api(test_case: unittest.TestCase):
    try:
        return importlib.import_module("scripts.audio_audit.audit")
    except ModuleNotFoundError as exc:
        test_case.fail(f"strict audio audit orchestrator is missing: {exc}")


def load_verify_api(test_case: unittest.TestCase):
    try:
        return importlib.import_module("scripts.audio_audit.verify")
    except ModuleNotFoundError as exc:
        test_case.fail(f"strict audio audit verifier is missing: {exc}")


def load_regression_api(test_case: unittest.TestCase):
    try:
        return importlib.import_module("scripts.audio_audit.regression")
    except ModuleNotFoundError as exc:
        test_case.fail(f"visible semantic regression evaluator is missing: {exc}")


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


class BackendProtocolTests(unittest.TestCase):
    def test_backend_protocol_rejects_duplicate_keys_and_trailing_output(self):
        protocol = load_backend_protocol_api(self)

        for raw in (
            '{"schemaVersion":1,"status":"PASS","status":"FAIL","requestId":"r1","backend":"clap","results":{}}',
            '{"schemaVersion":1,"status":"PASS","requestId":"r1","backend":"clap","results":{}}\nnoise',
        ):
            with self.subTest(raw=raw), self.assertRaisesRegex(protocol.BackendProtocolError, "invalid backend response"):
                protocol.parse_backend_response(raw)

    def test_backend_runner_sets_offline_cpu_and_private_cache(self):
        protocol = load_backend_protocol_api(self)
        executable = Path(
            "/Users/yehor/Projects/ZenFlow/private-evidence/audio-ai-audit/envs/clap/bin/python"
        )
        if not executable.exists():
            self.skipTest("private CLAP backend environment is not present on this machine")

        command, environment = protocol.build_backend_command(
            executable,
            "scripts.audio_audit.backends.clap_runner",
        )

        self.assertEqual(command, [str(executable), "-m", "scripts.audio_audit.backends.clap_runner"])
        self.assertEqual(environment["HF_HUB_OFFLINE"], "1")
        self.assertEqual(environment["TRANSFORMERS_OFFLINE"], "1")
        self.assertEqual(environment["CUDA_VISIBLE_DEVICES"], "")
        self.assertEqual(environment["TOKENIZERS_PARALLELISM"], "false")
        self.assertEqual(environment["OMP_NUM_THREADS"], "1")

    def test_backend_protocol_accepts_one_strict_result_document(self):
        protocol = load_backend_protocol_api(self)

        response = protocol.parse_backend_response(
            '{"schemaVersion":1,"status":"PASS","requestId":"r1","backend":"clap","results":{"rows":[]}}'
        )

        self.assertEqual(response.request_id, "r1")
        self.assertEqual(response.backend, "clap")
        self.assertEqual(response.status, "PASS")


class RunnerValidationTests(unittest.TestCase):
    def test_clap_request_rejects_unknown_fields_and_wrong_backend(self):
        common = load_runner_common_api(self)
        valid = {
            "schemaVersion": 1,
            "requestId": "r1",
            "backend": "clap",
            "audioPath": "/private/audio.wav",
            "family": "forest",
            "prompts": [
                {"id": "forest-positive-1", "group": "positive", "text": "forest ambience"}
            ],
        }

        with self.assertRaisesRegex(common.RunnerInputError, "request keys mismatch"):
            common.validate_clap_request({**valid, "unexpected": True})
        with self.assertRaisesRegex(common.RunnerInputError, "backend must be clap"):
            common.validate_clap_request({**valid, "backend": "yamnet"})

    def test_audio_path_must_be_regular_and_inside_private_evidence(self):
        common = load_runner_common_api(self)

        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            private = root / "private-evidence"
            private.mkdir()
            valid = private / "audio.wav"
            valid.write_bytes(b"RIFF")
            outside = root / "outside.wav"
            outside.write_bytes(b"RIFF")
            link = private / "link.wav"
            link.symlink_to(valid)

            self.assertEqual(common.validate_private_audio_path(valid, private), valid.resolve())
            with self.assertRaisesRegex(common.RunnerInputError, "private evidence"):
                common.validate_private_audio_path(outside, private)
            with self.assertRaisesRegex(common.RunnerInputError, "regular file"):
                common.validate_private_audio_path(link, private)


class BackendIntegrationTests(unittest.TestCase):
    @unittest.skipUnless(
        os.environ.get("ZENFLOW_RUN_MODEL_INTEGRATION") == "1",
        "set ZENFLOW_RUN_MODEL_INTEGRATION=1 for pinned local model smoke",
    )
    def test_clap_runner_loads_pinned_safetensors_offline(self):
        import numpy as np
        import soundfile as sf

        protocol = load_backend_protocol_api(self)
        private_root = Path(
            "/Users/yehor/Projects/ZenFlow/private-evidence/audio-ai-audit"
        )
        smoke_root = private_root / "integration-test"
        if smoke_root.exists():
            self.fail(f"integration smoke root already exists: {smoke_root}")
        smoke_root.mkdir()
        try:
            sample_rate = 48000
            time = np.arange(sample_rate * 10, dtype=np.float32) / sample_rate
            samples = 0.05 * np.sin(2 * np.pi * 220 * time)
            audio_path = smoke_root / "protocol.wav"
            sf.write(audio_path, samples, sample_rate, subtype="PCM_24")
            try:
                response = protocol.run_backend(
                    private_root / "envs/clap/bin/python",
                    "scripts.audio_audit.backends.clap_runner",
                    {
                        "schemaVersion": 1,
                        "requestId": "integration-clap-1",
                        "backend": "clap",
                        "audioPath": str(audio_path),
                        "family": "forest",
                        "prompts": [
                            {"id": "p1", "group": "positive", "text": "forest ambience"},
                            {"id": "p2", "group": "sibling", "text": "ocean waves"},
                            {"id": "p3", "group": "hard-negative", "text": "music"},
                        ],
                    },
                    timeout_seconds=300,
                )
            except protocol.BackendProtocolError as exc:
                self.fail(f"pinned CLAP runner did not complete: {exc}")
            self.assertEqual(response.status, "PASS")
            self.assertEqual(response.backend, "clap")
            self.assertEqual(len(response.results["rows"]), 3)
        finally:
            for path in smoke_root.iterdir():
                path.unlink()
            smoke_root.rmdir()

    @unittest.skipUnless(
        os.environ.get("ZENFLOW_RUN_MODEL_INTEGRATION") == "1",
        "set ZENFLOW_RUN_MODEL_INTEGRATION=1 for pinned local model smoke",
    )
    def test_yamnet_runner_loads_pinned_saved_model_offline(self):
        import numpy as np
        import soundfile as sf

        protocol = load_backend_protocol_api(self)
        private_root = Path(
            "/Users/yehor/Projects/ZenFlow/private-evidence/audio-ai-audit"
        )
        smoke_root = private_root / "integration-test-yamnet"
        if smoke_root.exists():
            self.fail(f"integration smoke root already exists: {smoke_root}")
        smoke_root.mkdir()
        try:
            sample_rate = 48000
            time = np.arange(sample_rate * 10, dtype=np.float32) / sample_rate
            samples = 0.05 * np.sin(2 * np.pi * 220 * time)
            audio_path = smoke_root / "protocol.wav"
            sf.write(audio_path, samples, sample_rate, subtype="PCM_24")
            try:
                response = protocol.run_backend(
                    private_root / "envs/yamnet/bin/python",
                    "scripts.audio_audit.backends.yamnet_runner",
                    {
                        "schemaVersion": 1,
                        "requestId": "integration-yamnet-1",
                        "backend": "yamnet",
                        "audioPath": str(audio_path),
                    },
                    timeout_seconds=300,
                )
            except protocol.BackendProtocolError as exc:
                self.fail(f"pinned YAMNet runner did not complete: {exc}")
            self.assertEqual(response.status, "PASS")
            self.assertEqual(response.backend, "yamnet")
            self.assertEqual(len(response.results["rows"]), 521)
            self.assertGreater(response.results["scoreFrames"], 0)
        finally:
            for path in smoke_root.iterdir():
                path.unlink()
            smoke_root.rmdir()


class OrchestratorTests(unittest.TestCase):
    def test_visible_regression_cli_rejects_caller_controlled_paths(self):
        audit = load_audit_api(self)

        with self.assertRaisesRegex(audit.AuditError, "does not accept path arguments"):
            audit.main(["--package", "/tmp/input", "--output", "/tmp/output"])

    def test_prompt_rows_cover_positive_siblings_and_hard_negatives_without_duplicates(self):
        audit = load_audit_api(self)
        self.assertTrue(hasattr(audit, "build_clap_prompts"), "CLAP prompt construction is missing")
        model = load_model_api(self)
        policy = model.load_audit_policy(POLICY_PATH)

        prompts = audit.build_clap_prompts(policy, "forest")

        self.assertGreaterEqual(len(prompts), 11)
        self.assertEqual({row["group"] for row in prompts}, {"positive", "sibling", "hard-negative"})
        self.assertEqual(len({row["id"] for row in prompts}), len(prompts))

    def test_semantic_summary_reports_literal_target_margin_but_abstains_before_calibration(self):
        audit = load_audit_api(self)
        self.assertTrue(hasattr(audit, "summarize_semantic"), "semantic summary is missing")

        result = audit.summarize_semantic(
            {
                "rows": [
                    {"promptId": "p1", "group": "positive", "probability": 0.6, "logit": 3.0},
                    {"promptId": "p2", "group": "positive", "probability": 0.5, "logit": 2.0},
                    {"promptId": "s1", "group": "sibling", "probability": 0.2, "logit": 1.0},
                    {"promptId": "h1", "group": "hard-negative", "probability": 0.1, "logit": 0.5},
                ]
            }
        )

        self.assertEqual(result["status"], "ABSTAIN")
        self.assertAlmostEqual(result["targetMargin"], 0.4)
        self.assertEqual(result["reasons"], ["UNCALIBRATED_SEMANTIC_THRESHOLDS"])

    def test_any_fail_or_abstain_blocks_and_pass_never_sets_human_status(self):
        audit = load_audit_api(self)

        report = audit.combine_results(
            provenance={"status": "PASS", "reasons": []},
            semantic={"status": "PASS", "reasons": []},
            events={"status": "ABSTAIN", "reasons": ["uncalibrated event threshold"]},
            auditor_admitted=False,
        )

        self.assertEqual(report["verdict"], "ABSTAIN")
        self.assertEqual(report["status"], "TRIAL_ONLY_NOT_ADMITTED")
        self.assertNotIn("humanSemanticPass", report)
        self.assertNotIn("promotionAllowed", report)

    def test_one_critical_event_cannot_be_hidden_by_high_semantic_score(self):
        audit = load_audit_api(self)

        report = audit.combine_results(
            provenance={"status": "PASS", "reasons": []},
            semantic={"status": "PASS", "targetMargin": 0.99, "reasons": []},
            events={"status": "FAIL", "reasons": ["speech detected at 4.8 seconds"]},
            auditor_admitted=True,
        )

        self.assertEqual(report["verdict"], "FAIL")
        self.assertIn("speech detected at 4.8 seconds", report["reasons"])

    def test_legacy_v1_package_is_provenance_fail_even_for_owner_positive_asset(self):
        audit = load_audit_api(self)

        result = audit.classify_provenance(
            package_id="zenflow-cc0-kimi-audio-reconstruction-v1",
            asset={
                "id": "fireplace:deep",
                "processing": {"profile": "fireplace_deep", "seed": 2054002473},
                "source": {"sourceSha256": "9ac70d55"},
            },
        )

        self.assertEqual(result["status"], "FAIL")
        self.assertIn("LEGACY_LEVEL_SPECIFIC_OFFSET_AND_TEXTURE", result["reasons"])


class AuditVerifierTests(unittest.TestCase):
    def test_visible_regression_verifier_cli_rejects_caller_controlled_paths(self):
        verify = load_verify_api(self)

        with self.assertRaisesRegex(verify.AuditVerificationError, "does not accept path arguments"):
            verify.main(["--report", "/tmp/report"])

    def test_hash_inventory_rejects_tampered_report_before_semantic_parsing(self):
        verify = load_verify_api(self)

        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            report = root / "ai-audit-report.json"
            report.write_text(
                json.dumps(
                    {
                        "schemaVersion": 1,
                        "status": "TRIAL_ONLY_NOT_ADMITTED",
                        "verdict": "ABSTAIN",
                        "assets": [],
                    }
                ),
                encoding="utf-8",
            )
            digest = __import__("hashlib").sha256(report.read_bytes()).hexdigest()
            (root / "SHA256SUMS").write_text(f"{digest}  ai-audit-report.json\n", encoding="utf-8")
            report.write_text("{}", encoding="utf-8")

            with self.assertRaisesRegex(verify.AuditVerificationError, "hash mismatch"):
                verify.verify_audit_report(root)

    def test_verifier_rejects_ai_authored_human_or_promotion_fields(self):
        verify = load_verify_api(self)

        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            report = root / "ai-audit-report.json"
            report.write_text(
                json.dumps(
                    {
                        "schemaVersion": 1,
                        "status": "TRIAL_ONLY_NOT_ADMITTED",
                        "verdict": "ABSTAIN",
                        "assets": [],
                        "humanSemanticPass": True,
                    },
                    sort_keys=True,
                ),
                encoding="utf-8",
            )
            digest = __import__("hashlib").sha256(report.read_bytes()).hexdigest()
            (root / "SHA256SUMS").write_text(f"{digest}  ai-audit-report.json\n", encoding="utf-8")

            with self.assertRaisesRegex(verify.AuditVerificationError, "forbidden authority field"):
                verify.verify_audit_report(root)


class VisibleRegressionTests(unittest.TestCase):
    def test_visible_regression_is_bound_to_rejected_artifact_and_not_a_holdout(self):
        regression = load_regression_api(self)

        fixture = regression.load_visible_regression(VISIBLE_REGRESSION_PATH)

        self.assertEqual(
            fixture.archive_sha256,
            "48931c2f8723e246112303604dd5a070107733850c2ea9d53e23b5c8a66eeb6b",
        )
        self.assertEqual(fixture.semantic_positive_ids, ("fireplace:deep",))
        self.assertEqual(len(fixture.semantic_negative_ids), 17)
        self.assertEqual(fixture.evidence_class, "VISIBLE_REGRESSION")

    def test_diagnostic_target_win_cannot_hide_false_accepts_or_false_rejects(self):
        regression = load_regression_api(self)
        fixture = regression.VisibleRegression(
            schema_version=1,
            evidence_class="VISIBLE_REGRESSION",
            package_id="fixture",
            archive_sha256="a" * 64,
            semantic_positive_ids=("fireplace:deep",),
            semantic_negative_ids=("rain:soft", "wind:soft"),
        )
        report = {
            "status": "TRIAL_ONLY_NOT_ADMITTED",
            "verdict": "FAIL",
            "assets": [
                {"id": "fireplace:deep", "gates": {"semantic": {"targetMargin": -0.2}}},
                {"id": "rain:soft", "gates": {"semantic": {"targetMargin": 0.3}}},
                {"id": "wind:soft", "gates": {"semantic": {"targetMargin": -0.1}}},
            ],
        }

        result = regression.evaluate_visible_regression(report, fixture)

        self.assertEqual(result["status"], "FAIL_VISIBLE_REGRESSION")
        self.assertEqual(result["truePositive"], 0)
        self.assertEqual(result["falsePositive"], 1)
        self.assertEqual(result["trueNegative"], 1)
        self.assertEqual(result["falseNegative"], 1)
        self.assertEqual(result["criticalFalseAcceptIds"], ["rain:soft"])


class WorkflowTests(unittest.TestCase):
    def test_workflow_is_read_only_hash_locked_and_does_not_download_models(self):
        workflow = ROOT / ".github/workflows/hyperfocus-ai-audit.yml"
        self.assertTrue(workflow.is_file(), "Hyperfocus AI audit workflow is missing")
        text = workflow.read_text(encoding="utf-8")

        self.assertIn("permissions:\n  contents: read", text)
        self.assertIn("persist-credentials: false", text)
        self.assertIn("--require-hashes", text)
        self.assertIn("scripts/audio_audit/requirements-core.txt", text)
        self.assertIn("python -m unittest discover -s scripts/audio_audit/tests -v", text)
        self.assertNotIn("pull_request_target", text)
        self.assertNotIn("contents: write", text)
        self.assertNotIn("secrets.", text)
        self.assertNotIn("acquire_models", text)
        self.assertNotIn("clap_runner", text)
        self.assertNotIn("yamnet_runner", text)
        self.assertNotIn("git push", text)


if __name__ == "__main__":
    unittest.main()
