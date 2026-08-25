from __future__ import annotations

import json
from pathlib import Path
import tempfile
import unittest

from scripts.audio_candidates.model import CandidateSpecError, load_candidate_spec


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
        duplicate["families"][1]["candidates"][0]["soundNumber"] = 1348
        duplicate["families"][1]["candidates"][0]["pageUrl"] = (
            "https://bigsoundbank.com/forest-2-s1348.html"
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


if __name__ == "__main__":
    unittest.main()
