from __future__ import annotations

import importlib
import json
from pathlib import Path
import tempfile
import unittest


ROOT = Path(__file__).resolve().parents[3]
POLICY_PATH = ROOT / "config/audio/hyperfocus-semantic-audit-v2.json"
MODEL_MANIFEST_PATH = ROOT / "config/audio/hyperfocus-ai-models-v2.json"


def load_model_api(test_case: unittest.TestCase):
    try:
        return importlib.import_module("scripts.audio_audit.model")
    except ModuleNotFoundError as exc:
        test_case.fail(f"strict audio audit model is missing: {exc}")


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


if __name__ == "__main__":
    unittest.main()
