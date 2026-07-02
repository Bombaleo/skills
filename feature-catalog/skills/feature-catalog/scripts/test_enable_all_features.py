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


if __name__ == "__main__":
    unittest.main()
