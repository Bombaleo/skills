import json
import tempfile
import unittest
from pathlib import Path

from feature_list import implemented_features, grouped_entities, render_markdown

DEFAULT_GROUP = "Other"


def _ent(slug, group, caps):
    e = {"slug": slug, "name": slug.replace("_", " ").title(), "role": f"role of {slug}",
         "capabilities": [{"name": n, "category": "other", "status": s,
                           "evidence": [], "note": ""} for n, s in caps]}
    if group is not None:
        e["group"] = group
    return e


def _report(entities):
    return {"app": "vms", "generated_from": "x.html", "entities": entities}


class TestFeatureList(unittest.TestCase):
    def test_implemented_excludes_missing(self):
        e = _ent("invoice", "Financials",
                 [("Create invoice", "present"), ("Edit invoice", "partial"),
                  ("Archive invoice", "missing")])
        feats = implemented_features(e)
        names = [f["name"] for f in feats]
        self.assertEqual(names, ["Create invoice", "Edit invoice"])  # missing excluded, order kept
        self.assertEqual([f["status"] for f in feats], ["present", "partial"])

    def test_grouped_entities_orders_groups_and_falls_back(self):
        rep = _report([
            _ent("invoice", "Financials", [("Create invoice", "present")]),
            _ent("worker", "Workforce", [("View worker", "present")]),
            _ent("widget", None, [("Use widget", "present")]),  # no group -> default
        ])
        groups = grouped_entities(rep)
        names = [g for g, _ in groups]
        # groups sorted alphabetically, default group last
        self.assertEqual(names, ["Financials", "Workforce", DEFAULT_GROUP])
        self.assertEqual([e["slug"] for e in dict(groups)["Other"]], ["widget"])

    def test_render_markdown_lists_present_and_partial_only(self):
        rep = _report([
            _ent("invoice", "Financials",
                 [("Create invoice", "present"), ("Archive invoice", "missing"),
                  ("Edit invoice", "partial")]),
        ])
        md = render_markdown(rep)
        self.assertIn("# vms — Implemented Features", md)
        self.assertIn("## Financials", md)
        self.assertIn("### Invoice", md)
        self.assertIn("- Create invoice", md)
        self.assertIn("Edit invoice (partial)", md)   # partial flagged
        self.assertNotIn("Archive invoice", md)        # missing excluded

    def test_render_markdown_empty_report_header_only(self):
        md = render_markdown(_report([]))
        self.assertIn("# vms — Implemented Features", md)
        self.assertNotIn("## ", md)

    def test_cli_writes_file(self):
        rep = _report([_ent("invoice", "Financials", [("Create invoice", "present")])])
        with tempfile.TemporaryDirectory() as d:
            rp = Path(d, "report.json"); rp.write_text(json.dumps(rep))
            outp = Path(d, "features.md")
            import subprocess, sys, os
            here = os.path.dirname(os.path.abspath(__file__))
            r = subprocess.run([sys.executable, os.path.join(here, "feature_list.py"),
                                str(rp), str(outp)], capture_output=True, text=True)
            self.assertEqual(r.returncode, 0, r.stderr)
            self.assertIn("Create invoice", outp.read_text())


if __name__ == "__main__":
    unittest.main()
