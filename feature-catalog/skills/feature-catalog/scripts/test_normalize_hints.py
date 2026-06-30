import json
import tempfile
import unittest
from pathlib import Path

from normalize_hints import normalize_hint, normalize_map


class TestNormalizeHint(unittest.TestCase):
    def test_arrow_string_with_annotation_and_placeholder_and_verb(self):
        h = "Settings → Rate automation → Rate Cards (wizard ④) → [version] → Delete"
        self.assertEqual(normalize_hint(h),
                         ["Settings", "Rate automation", "Rate Cards"])

    def test_plain_arrow_string(self):
        self.assertEqual(normalize_hint("Settings → Rate automation → Uploads"),
                         ["Settings", "Rate automation", "Uploads"])

    def test_list_input_cleaned_passthrough(self):
        self.assertEqual(normalize_hint(["Settings", "Rate automation", "Uploads"]),
                         ["Settings", "Rate automation", "Uploads"])

    def test_truncate_at_action_verb(self):
        self.assertEqual(normalize_hint(["Uploads", "Apply"]), ["Uploads"])

    def test_truncate_at_placeholder(self):
        self.assertEqual(normalize_hint(["Rate Engine", "[version]", "Add group"]),
                         ["Rate Engine"])

    def test_first_segment_dynamic_gives_empty(self):
        self.assertEqual(normalize_hint("[agency name] → Rate cards"), [])

    def test_comma_separated_string(self):
        self.assertEqual(normalize_hint("Agencies, Rate cards"), ["Agencies", "Rate cards"])


class TestNormalizeMap(unittest.TestCase):
    def _map(self):
        return {"unmapped": False, "nav": [],
                "entities": [
                    {"slug": "a", "name": "A", "role": "r", "states": ["x"], "transitions": [],
                     "features": [
                         {"name": "f1", "category": "create", "evidence_source": ["s.js"],
                          "entry_hint": "Settings → Rate automation → Uploads"},
                         {"name": "f2", "category": "read", "evidence_source": [],
                          "entry_hint": ["Settings", "Rate automation", "Uploads"]},  # dup path
                         {"name": "f3", "category": "delete", "evidence_source": [],
                          "entry_hint": "[version] → Delete"}]}]}  # -> empty

    def test_adds_entry_path_and_dedup_walk_targets_and_preserves(self):
        out = normalize_map(self._map())
        feats = out["entities"][0]["features"]
        self.assertEqual(feats[0]["entry_path"], ["Settings", "Rate automation", "Uploads"])
        self.assertEqual(feats[1]["entry_path"], ["Settings", "Rate automation", "Uploads"])
        self.assertEqual(feats[2]["entry_path"], [])
        # original entry_hint preserved
        self.assertEqual(feats[0]["entry_hint"], "Settings → Rate automation → Uploads")
        # walk_targets: distinct non-empty paths
        self.assertEqual(out["walk_targets"], [["Settings", "Rate automation", "Uploads"]])
        # other fields preserved
        self.assertEqual(out["entities"][0]["states"], ["x"])
        self.assertEqual(out["unmapped"], False)

    def test_cli_rewrites_file(self):
        import subprocess, sys, os
        with tempfile.TemporaryDirectory() as d:
            mp = Path(d, "map.json"); mp.write_text(json.dumps(self._map()))
            here = os.path.dirname(os.path.abspath(__file__))
            r = subprocess.run([sys.executable, os.path.join(here, "normalize_hints.py"), str(mp)],
                               capture_output=True, text=True)
            self.assertEqual(r.returncode, 0, r.stderr)
            data = json.loads(mp.read_text())
            self.assertIn("walk_targets", data)
            self.assertEqual(data["entities"][0]["features"][0]["entry_path"],
                             ["Settings", "Rate automation", "Uploads"])


class TestNormalizeMapConfigAreas(unittest.TestCase):
    def _map(self):
        return {
            "unmapped": False, "nav": [],
            "entities": [
                {"slug": "invoice", "name": "Invoice", "role": "r", "states": [], "transitions": [],
                 "features": [{"name": "f", "category": "read", "evidence_source": [],
                               "entry_hint": "Invoices"}]}],
            "config_areas": [
                {"slug": "feature_flags", "name": "Feature Flags", "purpose": "p",
                 "features": [
                     {"name": "Toggle flag", "category": "update", "evidence_source": [],
                      "entry_hint": "Settings → Feature flags"},
                     {"name": "Bad", "category": "update", "evidence_source": [],
                      "entry_hint": "[tenant] → Toggle"}]}],  # -> empty path
        }

    def test_config_area_features_get_entry_path(self):
        out = normalize_map(self._map())
        ca = out["config_areas"][0]
        self.assertEqual(ca["features"][0]["entry_path"], ["Settings", "Feature flags"])
        self.assertEqual(ca["features"][1]["entry_path"], [])  # truncated at placeholder

    def test_config_area_paths_join_walk_targets_deduped(self):
        out = normalize_map(self._map())
        # entity path + config-area path, both present, deduped & sorted
        self.assertIn(["Invoices"], out["walk_targets"])
        self.assertIn(["Settings", "Feature flags"], out["walk_targets"])
        self.assertEqual(len(out["walk_targets"]), 2)  # empty config path excluded

    def test_no_config_areas_key_still_works(self):
        m = {"entities": [{"slug": "x", "name": "X", "role": "r", "features": [
            {"name": "f", "category": "read", "evidence_source": [], "entry_hint": "Home"}]}]}
        out = normalize_map(m)
        self.assertEqual(out["entities"][0]["features"][0]["entry_path"], ["Home"])
        self.assertEqual(out["walk_targets"], [["Home"]])


if __name__ == "__main__":
    unittest.main()
