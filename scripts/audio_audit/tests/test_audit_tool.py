from __future__ import annotations

import importlib
import json
from pathlib import Path
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


if __name__ == "__main__":
    unittest.main()
