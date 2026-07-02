import base64
import gzip
import json
import os
import subprocess
import sys
import tempfile
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

    def test_derived_flag_with_defaulton_excluded(self):
        # A derived legacy flag ('sow') can ALSO carry a defaultOn catalog
        # entry (in a hidden legacy group) yet must be excluded from real_ids,
        # because getFeatureFlag computes it from axis flags and ignores any
        # stored value. It is identified as a key of LEGACY_FLAG_DERIVATIONS.
        source = """
        const FEATURE_FLAG_GROUPS = [
          { id: "axes", label: "Axes", flags: [
            { id: "engStatementOfWork", label: "SOW axis", defaultOn: false },
          ] },
          { id: "_legacy", label: "Legacy", hidden: true, flags: [
            { id: "sow", label: "SOW (derived)", defaultOn: false },
          ] },
        ];
        const LEGACY_FLAG_DERIVATIONS = {
          sow: (f) => !!f.engStatementOfWork,
        };
        """
        cat = eaf.parse_flag_catalog(source)
        self.assertIn("engStatementOfWork", cat["real_ids"])
        self.assertNotIn("sow", cat["real_ids"])

    def test_derived_flag_ids_empty_without_block(self):
        self.assertEqual(eaf.derived_flag_ids("const x = 1;"), set())


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


class TestInject(unittest.TestCase):
    HTML = (
        "<html><head><title>x</title>"
        '<script type="__bundler/manifest">{}</script>'
        "</head><body></body></html>"
    )

    def test_inserts_before_first_script(self):
        out = eaf.inject_seed(self.HTML, {"salesTax": True})
        self.assertIn('data-enable-all-features="1"', out)
        seed_pos = out.index("data-enable-all-features")
        manifest_pos = out.index("__bundler/manifest")
        self.assertLess(seed_pos, manifest_pos)

    def test_writes_ff_map_and_mirror_keys(self):
        # The FF map is stored double-encoded (a JSON string inside setItem),
        # so assert the flag id and its encoded boolean appear, not exact JSON.
        out = eaf.inject_seed(self.HTML, {"salesTax": True})
        self.assertIn("flexwork.featureFlags", out)
        self.assertIn("flexwork.featureFlags.customFields", out)
        self.assertIn("flexwork.featureFlags.professionalJobTypes", out)
        self.assertIn("salesTax", out)
        self.assertIn("true", out)

    def test_idempotent(self):
        once = eaf.inject_seed(self.HTML, {"salesTax": True})
        twice = eaf.inject_seed(once, {"salesTax": True, "eor": True})
        self.assertEqual(twice.count('data-enable-all-features="1"'), 1)
        self.assertIn("eor", twice)

    def test_fallback_no_script_tag(self):
        out = eaf.inject_seed("<html><head></head><body></body></html>", {"a": True})
        self.assertIn('data-enable-all-features="1"', out)

    def test_upstream_entries_written(self):
        upstream = eaf.build_upstream_seed(["energy"])
        out = eaf.inject_seed(self.HTML, {"salesTax": True}, upstream)
        self.assertIn("flexwork.engagementTypes.energy", out)
        self.assertIn("flexwork.supplierTypes.energy", out)
        self.assertIn("flexwork.customFields.flagAdopted", out)


INDUSTRIES_SRC = """
const INDUSTRIES = {
  dayforce: {
    label: "Dayforce",
    localize: {},
  },
  acme: {
    label: "Acme",
    localize: { greeting: "hi" },
  },
};
"""


class TestUpstream(unittest.TestCase):
    def test_discover_orgs_parses_top_level_keys(self):
        orgs = eaf.discover_orgs([INDUSTRIES_SRC])
        self.assertIn("acme", orgs)        # parsed top-level key
        self.assertIn("dayforce", orgs)
        self.assertNotIn("localize", orgs)  # nested key (4-space indent) excluded
        self.assertIn("manufacturing", orgs)  # unioned from KNOWN_ORGS

    def test_discover_orgs_fallback_without_industries(self):
        self.assertEqual(eaf.discover_orgs(["const x = 1;"]), sorted(eaf.KNOWN_ORGS))

    def test_build_upstream_seed_shapes(self):
        up = eaf.build_upstream_seed(["energy", "acme"])
        self.assertEqual(
            up["flexwork.engagementTypes.energy"],
            {"engAssignment": True, "engProject": True, "engStatementOfWork": True},
        )
        self.assertEqual(
            up["flexwork.supplierTypes.acme"],
            {"independentContractor": True, "eor": True, "float": True},
        )
        self.assertEqual(
            up["flexwork.jobsCategories.energy"],
            {"frontline": True, "professional": True},
        )
        # adoption gate is one org->bool map, not per-org keys
        self.assertEqual(
            up["flexwork.customFields.flagAdopted"],
            {"energy": True, "acme": True},
        )


SCRIPT = os.path.join(os.path.dirname(__file__), "enable_all_features.py")


class TestCLI(unittest.TestCase):
    def _run(self, *args):
        return subprocess.run(
            [sys.executable, SCRIPT, *args],
            capture_output=True, text=True,
        )

    def test_end_to_end_writes_file(self):
        html = _make_bundle(CATALOG)
        with tempfile.TemporaryDirectory() as d:
            src = os.path.join(d, "proto.html")
            out = os.path.join(d, "proto.all-features.html")
            with open(src, "w") as f:
                f.write(html)
            r = self._run(src)
            self.assertEqual(r.returncode, 0, r.stderr)
            self.assertTrue(os.path.exists(out))
            with open(out) as f:
                content = f.read()
            self.assertIn('data-enable-all-features="1"', content)
            self.assertIn("salesTax", content)

    def test_print_seed_writes_nothing(self):
        html = _make_bundle(CATALOG)
        with tempfile.TemporaryDirectory() as d:
            src = os.path.join(d, "proto.html")
            out = os.path.join(d, "proto.all-features.html")
            with open(src, "w") as f:
                f.write(html)
            r = self._run(src, "--print-seed")
            self.assertEqual(r.returncode, 0, r.stderr)
            self.assertFalse(os.path.exists(out))
            self.assertIn("salesTax", r.stdout)

    def test_no_flag_module_fails_loud(self):
        # Module missing: no FEATURE_FLAG_GROUPS, so find_flag_module returns None → exit 2
        html = _make_bundle("const x = 1; // no FEATURE_FLAG_GROUPS here")
        with tempfile.TemporaryDirectory() as d:
            src = os.path.join(d, "proto.html")
            with open(src, "w") as f:
                f.write(html)
            r = self._run(src)
            self.assertEqual(r.returncode, 2)
            self.assertTrue(r.stderr.strip())

    def test_zero_flags_fails_loud(self):
        # Module found but yields 0 seedable flags → exit 3
        html = _make_bundle("const FEATURE_FLAG_GROUPS = []; // defaultOn: never used")
        with tempfile.TemporaryDirectory() as d:
            src = os.path.join(d, "proto.html")
            with open(src, "w") as f:
                f.write(html)
            r = self._run(src)
            self.assertEqual(r.returncode, 3)
            self.assertTrue(r.stderr.strip())

    def test_missing_file_fails(self):
        r = self._run("/no/such/file.html")
        self.assertEqual(r.returncode, 1)
        self.assertTrue(r.stderr.strip())

    def test_out_override_writes_named_file(self):
        # --out flag should write to custom output path, not default
        html = _make_bundle(CATALOG)
        with tempfile.TemporaryDirectory() as d:
            src = os.path.join(d, "proto.html")
            custom_out = os.path.join(d, "custom-output.html")
            default_out = os.path.join(d, "proto.all-features.html")
            with open(src, "w") as f:
                f.write(html)
            r = self._run(src, "--out", custom_out)
            self.assertEqual(r.returncode, 0, r.stderr)
            self.assertTrue(os.path.exists(custom_out))
            self.assertFalse(os.path.exists(default_out))


if __name__ == "__main__":
    unittest.main()
