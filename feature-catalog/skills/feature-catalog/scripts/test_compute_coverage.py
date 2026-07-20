import json
import tempfile
import unittest
from pathlib import Path

from compute_coverage import compute_file_coverage, recompute_dir


def _entity(slug, statuses, bogus_coverage):
    return {
        "slug": slug, "name": slug.title(), "role": "r",
        "states": {"observed": ["a"], "expected": ["a", "b"], "missing": ["b"]},
        "transitions": [{"from": "a", "to": "b", "action": "go", "status": "present"}],
        "capabilities": [
            {"name": f"cap{i}", "category": "create", "status": s,
             "evidence": [], "note": ""} for i, s in enumerate(statuses)
        ],
        "coverage": bogus_coverage,
    }


class TestComputeCoverage(unittest.TestCase):
    def test_compute_file_coverage_counts_statuses(self):
        ent = _entity("x", ["present", "present", "partial", "missing"],
                      {"present": 1, "partial": 1, "missing": 1, "expected_total": 4})
        self.assertEqual(
            compute_file_coverage(ent),
            {"present": 2, "partial": 1, "missing": 1, "expected_total": 4})

    def test_empty_capabilities_all_zero(self):
        ent = _entity("e", [], {"present": 9, "partial": 9, "missing": 9, "expected_total": 9})
        self.assertEqual(
            compute_file_coverage(ent),
            {"present": 0, "partial": 0, "missing": 0, "expected_total": 0})

    def test_out_of_set_status_excluded_but_counted_in_total(self):
        ent = _entity("o", ["present", "planned"],
                      {"present": 2, "partial": 0, "missing": 0, "expected_total": 2})
        cov = compute_file_coverage(ent)
        self.assertEqual(cov, {"present": 1, "partial": 0, "missing": 0, "expected_total": 2})
        # the out-of-set status surfaces as a shortfall
        self.assertLess(cov["present"] + cov["partial"] + cov["missing"], cov["expected_total"])

    def test_recompute_dir_rewrites_blocks_and_returns_overall(self):
        with tempfile.TemporaryDirectory() as d:
            a = _entity("a", ["present", "present", "missing"],
                        {"present": 1, "partial": 2, "missing": 0, "expected_total": 3})
            b = _entity("b", ["partial", "missing"],
                        {"present": 5, "partial": 5, "missing": 5, "expected_total": 2})
            Path(d, "ent_a.json").write_text(json.dumps(a))
            Path(d, "ent_b.json").write_text(json.dumps(b))
            overall = recompute_dir(d)
            self.assertEqual(
                overall,
                {"present": 2, "partial": 1, "missing": 2, "expected_total": 5})
            # blocks were rewritten in place
            ra = json.loads(Path(d, "ent_a.json").read_text())
            self.assertEqual(ra["coverage"],
                             {"present": 2, "partial": 0, "missing": 1, "expected_total": 3})

    def test_recompute_dir_preserves_other_fields(self):
        with tempfile.TemporaryDirectory() as d:
            a = _entity("a", ["present"], {"present": 9, "partial": 0, "missing": 0,
                                           "expected_total": 1})
            Path(d, "ent_a.json").write_text(json.dumps(a))
            recompute_dir(d)
            ra = json.loads(Path(d, "ent_a.json").read_text())
            self.assertEqual(ra["slug"], "a")
            self.assertEqual(ra["states"], a["states"])
            self.assertEqual(ra["transitions"], a["transitions"])
            self.assertEqual(ra["capabilities"], a["capabilities"])


if __name__ == "__main__":
    unittest.main()
