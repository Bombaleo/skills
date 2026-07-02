import base64
import gzip
import json
import unittest

import enable_all_features as eaf


def _make_bundle(module_js, *, compressed=True):
    """Build a minimal standalone-export HTML carrying one JS asset in a
    __bundler/manifest script, mimicking extract_bundle's expected format."""
    raw = module_js.encode("utf-8")
    data = gzip.compress(raw) if compressed else raw
    manifest = {
        "uuid-1111": {
            "mime": "text/javascript",
            "compressed": compressed,
            "data": base64.b64encode(data).decode("ascii"),
        }
    }
    return (
        "<html><head><title>proto</title>"
        '<script type="__bundler/manifest">' + json.dumps(manifest) + "</script>"
        '<script type="__bundler/template">&lt;div&gt;&lt;/div&gt;</script>'
        "</head><body></body></html>"
    )


FLAG_MODULE = """
const FEATURE_FLAG_GROUPS = [
  { id: "program", label: "Program", flags: [
    { id: "salesTax", label: "Sales Tax", defaultOn: false },
  ] },
];
"""


class TestDiscovery(unittest.TestCase):
    def test_decode_bundle_sources_gunzips(self):
        html = _make_bundle(FLAG_MODULE, compressed=True)
        sources = eaf.decode_bundle_sources(html)
        self.assertTrue(any("FEATURE_FLAG_GROUPS" in s for s in sources))

    def test_decode_bundle_sources_uncompressed(self):
        html = _make_bundle(FLAG_MODULE, compressed=False)
        sources = eaf.decode_bundle_sources(html)
        self.assertTrue(any("salesTax" in s for s in sources))

    def test_decode_bundle_sources_no_manifest(self):
        self.assertEqual(eaf.decode_bundle_sources("<html></html>"), [])

    def test_find_flag_module_in_sources(self):
        found = eaf.find_flag_module_in_sources(["nope", FLAG_MODULE, "also nope"])
        self.assertIsNotNone(found)
        self.assertIn("FEATURE_FLAG_GROUPS", found)

    def test_find_flag_module_in_sources_absent(self):
        self.assertIsNone(eaf.find_flag_module_in_sources(["a", "b"]))

    def test_find_flag_module_end_to_end(self):
        html = _make_bundle(FLAG_MODULE)
        self.assertIn("salesTax", eaf.find_flag_module(html))


CATALOG = """
const FEATURE_FLAG_GROUPS = [
  { id: "engagementType", label: "Engagement Type", hidden: true, flags: [
    { id: "engAssignment", label: "Assignment", defaultOn: false, tips: [{label:"x", body:"y"}] },
    { id: "engStatementOfWork", label: "SOW", defaultOn: false },
  ] },
  { id: "program", label: "Program", flags: [
    { id: "dataModelAlignment", label: "DMA", defaultOn: false, excludes: ["vmsEducation"] },
    { id: "vmsEducation", label: "VMS Edu", defaultOn: false, excludes: ["dataModelAlignment"] },
    { id: "salesTax", label: "Sales Tax", defaultOn: true },
  ] },
];
const LEGACY_FLAG_DERIVATIONS = {
  sow: (f) => !!f.engStatementOfWork,
  contractors: (f) => !!(f.engAssignment && f.independentContractor),
};
function FFFlagRow({ flag }) { return null; }
"""


class TestParse(unittest.TestCase):
    def test_real_ids_only(self):
        cat = eaf.parse_flag_catalog(CATALOG)
        self.assertEqual(
            cat["real_ids"],
            ["engAssignment", "engStatementOfWork",
             "dataModelAlignment", "vmsEducation", "salesTax"],
        )

    def test_group_ids_excluded(self):
        cat = eaf.parse_flag_catalog(CATALOG)
        self.assertNotIn("engagementType", cat["real_ids"])
        self.assertNotIn("program", cat["real_ids"])

    def test_derived_ids_excluded(self):
        cat = eaf.parse_flag_catalog(CATALOG)
        self.assertNotIn("sow", cat["real_ids"])
        self.assertNotIn("contractors", cat["real_ids"])

    def test_excludes_captured(self):
        cat = eaf.parse_flag_catalog(CATALOG)
        self.assertEqual(cat["excludes"]["dataModelAlignment"], ["vmsEducation"])
        self.assertEqual(cat["excludes"]["vmsEducation"], ["dataModelAlignment"])

    def test_empty_source(self):
        self.assertEqual(eaf.parse_flag_catalog(""), {"real_ids": [], "excludes": {}})


class TestBuildSeed(unittest.TestCase):
    def test_all_true_when_no_excludes(self):
        seed = eaf.build_seed({"real_ids": ["a", "b", "c"], "excludes": {}})
        self.assertEqual(seed, {"a": True, "b": True, "c": True})

    def test_exclusion_first_wins(self):
        seed = eaf.build_seed({
            "real_ids": ["a", "b", "c"],
            "excludes": {"a": ["b"], "b": ["a"]},
        })
        self.assertEqual(seed, {"a": True, "b": False, "c": True})

    def test_exclusion_respects_source_order(self):
        seed = eaf.build_seed({
            "real_ids": ["b", "a", "c"],
            "excludes": {"a": ["b"], "b": ["a"]},
        })
        self.assertEqual(seed, {"b": True, "a": False, "c": True})

    def test_empty_catalog(self):
        self.assertEqual(eaf.build_seed({"real_ids": [], "excludes": {}}), {})


if __name__ == "__main__":
    unittest.main()
