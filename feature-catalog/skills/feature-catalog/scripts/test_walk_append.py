import argparse
import json
import tempfile
import unittest
from pathlib import Path

import walk_prototype


def _make_walker(out):
    # cdp/file_url unused by seed_existing; construct a bare Walker
    return walk_prototype.Walker(None, "file:///x.html", out, argparse.Namespace())


class TestAppend(unittest.TestCase):
    def test_seed_existing_loads_prior_screens(self):
        with tempfile.TemporaryDirectory() as d:
            out = Path(d)
            (out / "index.json").write_text(json.dumps({
                "screens": [{"id": 0, "title": "A", "path": [], "txt": "000_a.txt"},
                            {"id": 1, "title": "B", "path": ["X"], "txt": "001_b.txt"}],
                "aliases": [{"path": ["Y"], "same_as": 0}]}))
            w = _make_walker(out)
            n = walk_prototype.seed_existing(out, w)
            self.assertEqual(n, 2)
            self.assertEqual(len(w.screens), 2)          # next sid = len = 2 (continues, no collision)
            self.assertEqual(w.aliases, [{"path": ["Y"], "same_as": 0}])

    def test_seed_existing_no_index_is_noop(self):
        with tempfile.TemporaryDirectory() as d:
            out = Path(d)
            w = _make_walker(out)
            n = walk_prototype.seed_existing(out, w)
            self.assertEqual(n, 0)
            self.assertEqual(w.screens, [])

    def test_seed_existing_rebuilds_seen_from_sig(self):
        import argparse
        with tempfile.TemporaryDirectory() as d:
            out = Path(d)
            (out / "index.json").write_text(json.dumps({
                "screens": [{"id": 0, "title": "A", "path": [], "txt": "000_a.txt", "sig": "111:5"},
                            {"id": 1, "title": "B", "path": ["X"], "txt": "001_b.txt", "sig": "222:9"}],
                "aliases": []}))
            w = walk_prototype.Walker(None, "file:///x.html", out, argparse.Namespace())
            walk_prototype.seed_existing(out, w)
            self.assertEqual(w.seen, {"111:5": 0, "222:9": 1})

    def test_seed_existing_legacy_index_without_sig(self):
        import argparse
        with tempfile.TemporaryDirectory() as d:
            out = Path(d)
            (out / "index.json").write_text(json.dumps({
                "screens": [{"id": 0, "title": "A", "path": [], "txt": "000_a.txt"}], "aliases": []}))
            w = walk_prototype.Walker(None, "file:///x.html", out, argparse.Namespace())
            walk_prototype.seed_existing(out, w)   # must not raise
            self.assertEqual(w.seen, {})           # no sig -> empty dedup map

    def test_parse_labels_json_array_preserves_comma_labels(self):
        # JSON-array form must carry a label containing a comma intact (comma-join would split it)
        self.assertEqual(
            walk_prototype.parse_labels('["Settings","Rate cards, archived"]'),
            ["Settings", "Rate cards, archived"])
        # plain comma string still splits (documented behavior)
        self.assertEqual(walk_prototype.parse_labels("A,B"), ["A", "B"])


class TestPerWalkCap(unittest.TestCase):
    def _walker(self, max_screens, seed_count, n_screens):
        import argparse
        w = walk_prototype.Walker(None, "file:///x.html", None,
                                  argparse.Namespace(max_screens=max_screens))
        w.seed_count = seed_count
        w.screens = [{"id": i} for i in range(n_screens)]
        return w

    def test_no_seed_caps_on_total(self):
        self.assertFalse(self._walker(2, 0, 0)._at_cap())
        self.assertFalse(self._walker(2, 0, 1)._at_cap())
        self.assertTrue(self._walker(2, 0, 2)._at_cap())

    def test_seeded_screens_do_not_count_against_budget(self):
        # 40 seeded, max 2: landing capture (1 new) is under budget; 2 new hits cap
        self.assertFalse(self._walker(2, 40, 40)._at_cap())   # 0 new
        self.assertFalse(self._walker(2, 40, 41)._at_cap())   # 1 new
        self.assertTrue(self._walker(2, 40, 42)._at_cap())    # 2 new -> at cap


if __name__ == "__main__":
    unittest.main()
