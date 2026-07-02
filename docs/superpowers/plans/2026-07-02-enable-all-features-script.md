# Enable-All-Features Script Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a standalone `enable_all_features.py` that seeds every feature flag ON via a pre-boot `localStorage` `<script>` injected into a copy of the prototype's standalone HTML bundle, so a subsequent walk render-confirms flag-gated features.

**Architecture:** Four pure, unit-tested functions — decode the bundle to find the feature-flags module, parse its flag catalog, build an all-ON seed map (resolving mutual exclusions), and inject a seed `<script>` into the HTML — wired together by a thin CLI. Non-destructive: writes a new `<stem>.all-features.html`; the original is untouched. Bundle decoding reuses `grab_script` from the sibling `extract_bundle.py`.

**Tech Stack:** Python 3.9+, standard library only (`base64`, `gzip`, `json`, `html`, `re`, `argparse`, `pathlib`). Tests use `unittest`.

## Global Constraints

- Python 3.9+, **standard library only** — no third-party imports.
- All new files live in `feature-catalog/skills/feature-catalog/scripts/`.
- Do **not** modify the `spec-pipeline`/`prototype-to-spec` copies of any script — the feature-catalog pipeline is fully independent.
- Do **not** mutate the input HTML in place — always write a new output file.
- The seed sets the `flexwork.featureFlags` localStorage map plus the two boolean mirror keys `flexwork.featureFlags.customFields` and `flexwork.featureFlags.professionalJobTypes`; leave `flexwork.featureFlags.migrations` untouched.
- A flag id is real/seedable iff its object literal contains a `defaultOn:` field. Derived legacy ids (`contractors`, `sow`, `milestones`, `fixedFee`, `professionalWork`, `v77Axes`) have no `defaultOn` and must never be seeded.
- Exclusion tie-break is **source-order-first**: when processing flags in source order, a flag that is still ON forces its `excludes` targets OFF; a flag already forced OFF does not apply its own excludes.
- Run all tests from the scripts directory: `cd feature-catalog/skills/feature-catalog/scripts`.

---

### Task 1: Bundle discovery — decode + find the feature-flags module

**Files:**
- Create: `feature-catalog/skills/feature-catalog/scripts/enable_all_features.py`
- Test: `feature-catalog/skills/feature-catalog/scripts/test_enable_all_features.py`

**Interfaces:**
- Consumes: `grab_script(html: str, script_type: str) -> str | None` from `extract_bundle.py` (same directory).
- Produces:
  - `decode_bundle_sources(html: str) -> list[str]` — returns the decoded text of every JS/HTML source asset in the bundle (base64-decoded, gunzipped when `compressed`). Non-text/binary assets and undecodable entries are skipped. Returns `[]` when no `__bundler/manifest` is present.
  - `find_flag_module_in_sources(sources: list[str]) -> str | None` — returns the first source text containing both `FEATURE_FLAG_GROUPS` and `defaultOn:`, else `None`.
  - `find_flag_module(html: str) -> str | None` — composes the two above.

- [ ] **Step 1: Write the failing test**

Create `test_enable_all_features.py`:

```python
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
        self.assertIn("FEATURE_FLAG_GROUPS", found)

    def test_find_flag_module_in_sources_absent(self):
        self.assertIsNone(eaf.find_flag_module_in_sources(["a", "b"]))

    def test_find_flag_module_end_to_end(self):
        html = _make_bundle(FLAG_MODULE)
        self.assertIn("salesTax", eaf.find_flag_module(html))


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd feature-catalog/skills/feature-catalog/scripts && python3 -m unittest test_enable_all_features -v`
Expected: FAIL — `ModuleNotFoundError` / `AttributeError: module 'enable_all_features' has no attribute 'decode_bundle_sources'`.

- [ ] **Step 3: Write minimal implementation**

Create `enable_all_features.py`:

```python
#!/usr/bin/env python3
"""Enable all feature flags in a Claude Design standalone HTML export.

Injects a pre-boot <script> that seeds the app's `flexwork.featureFlags`
localStorage map to all-ON, so a subsequent walk render-confirms
flag-gated features. Non-destructive: writes a new file.

Stdlib only, Python >= 3.9.
"""
import base64
import gzip
import html as html_mod
import json
import re

from extract_bundle import grab_script


def decode_bundle_sources(html):
    """Decode every JS/HTML source asset from the bundle manifest."""
    raw_manifest = grab_script(html, "__bundler/manifest")
    if raw_manifest is None:
        return []
    try:
        manifest = json.loads(html_mod.unescape(raw_manifest))
    except (ValueError, TypeError):
        return []
    sources = []
    for entry in manifest.values():
        try:
            data = base64.b64decode(entry["data"])
            if entry.get("compressed"):
                data = gzip.decompress(data)
            text = data.decode("utf-8", errors="replace")
        except (KeyError, ValueError, OSError):
            continue
        sources.append(text)
    return sources


def find_flag_module_in_sources(sources):
    """Return the source text that defines the feature-flag catalog."""
    for text in sources:
        if "FEATURE_FLAG_GROUPS" in text and "defaultOn:" in text:
            return text
    return None


def find_flag_module(html):
    return find_flag_module_in_sources(decode_bundle_sources(html))
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd feature-catalog/skills/feature-catalog/scripts && python3 -m unittest test_enable_all_features -v`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add feature-catalog/skills/feature-catalog/scripts/enable_all_features.py \
        feature-catalog/skills/feature-catalog/scripts/test_enable_all_features.py
git commit -m "feat(feature-catalog): enable-all-features bundle discovery"
```

---

### Task 2: Parse the flag catalog

**Files:**
- Modify: `feature-catalog/skills/feature-catalog/scripts/enable_all_features.py`
- Test: `feature-catalog/skills/feature-catalog/scripts/test_enable_all_features.py`

**Interfaces:**
- Consumes: nothing from other tasks.
- Produces: `parse_flag_catalog(source_text: str) -> dict` returning
  `{"real_ids": list[str], "excludes": dict[str, list[str]]}`.
  A flag id is any `id: "<x>"` / `id: '<x>'` whose object also contains a
  `defaultOn:` field before the next `id:` marker. `excludes` for a flag are the
  ids in its `excludes: [ ... ]` array (source-order preserved, no duplicates).

**Parser rule (positional):** collect every `id:` match with its position; a flag
id "owns" every `defaultOn:` and `excludes: [...]` occurrence between its position
and the next `id:` match (or end of text). Assumes `id:` precedes `defaultOn:`
within each flag object, which the source guarantees.

- [ ] **Step 1: Write the failing test**

Append to `test_enable_all_features.py`:

```python
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd feature-catalog/skills/feature-catalog/scripts && python3 -m unittest test_enable_all_features -v`
Expected: FAIL — `AttributeError: module 'enable_all_features' has no attribute 'parse_flag_catalog'`.

- [ ] **Step 3: Write minimal implementation**

Add to `enable_all_features.py`:

```python
_ID_RE = re.compile(r"""\bid\s*:\s*["']([^"']+)["']""")
_DEFAULT_ON_RE = re.compile(r"\bdefaultOn\s*:")
_EXCLUDES_RE = re.compile(r"\bexcludes\s*:\s*\[([^\]]*)\]")
_STR_IN_ARR_RE = re.compile(r"""["']([^"']+)["']""")


def parse_flag_catalog(source_text):
    ids = [(m.group(1), m.start()) for m in _ID_RE.finditer(source_text)]
    default_positions = [m.start() for m in _DEFAULT_ON_RE.finditer(source_text)]
    exclude_spans = [(m.start(), m.group(1)) for m in _EXCLUDES_RE.finditer(source_text)]

    real_ids = []
    excludes = {}
    for i, (flag_id, start) in enumerate(ids):
        end = ids[i + 1][1] if i + 1 < len(ids) else len(source_text)
        has_default = any(start < p < end for p in default_positions)
        if not has_default:
            continue
        real_ids.append(flag_id)
        targets = []
        for pos, body in exclude_spans:
            if start < pos < end:
                for t in _STR_IN_ARR_RE.findall(body):
                    if t not in targets:
                        targets.append(t)
        if targets:
            excludes[flag_id] = targets
    return {"real_ids": real_ids, "excludes": excludes}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd feature-catalog/skills/feature-catalog/scripts && python3 -m unittest test_enable_all_features -v`
Expected: PASS (11 tests).

- [ ] **Step 5: Commit**

```bash
git add feature-catalog/skills/feature-catalog/scripts/enable_all_features.py \
        feature-catalog/skills/feature-catalog/scripts/test_enable_all_features.py
git commit -m "feat(feature-catalog): parse feature-flag catalog from module source"
```

---

### Task 3: Build the all-ON seed map

**Files:**
- Modify: `feature-catalog/skills/feature-catalog/scripts/enable_all_features.py`
- Test: `feature-catalog/skills/feature-catalog/scripts/test_enable_all_features.py`

**Interfaces:**
- Consumes: catalog dict from `parse_flag_catalog` — `{"real_ids": [...], "excludes": {...}}`.
- Produces: `build_seed(catalog: dict) -> dict` — the `flexwork.featureFlags` map:
  every real id `True`, then, iterating real ids in order, each flag that is still
  `True` forces its `excludes` targets `False`. Insertion order preserved.

- [ ] **Step 1: Write the failing test**

Append to `test_enable_all_features.py`:

```python
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd feature-catalog/skills/feature-catalog/scripts && python3 -m unittest test_enable_all_features -v`
Expected: FAIL — `AttributeError: module 'enable_all_features' has no attribute 'build_seed'`.

- [ ] **Step 3: Write minimal implementation**

Add to `enable_all_features.py`:

```python
def build_seed(catalog):
    real_ids = catalog.get("real_ids", [])
    excludes = catalog.get("excludes", {})
    seed = {fid: True for fid in real_ids}
    for fid in real_ids:
        if seed.get(fid):
            for target in excludes.get(fid, []):
                seed[target] = False
    return seed
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd feature-catalog/skills/feature-catalog/scripts && python3 -m unittest test_enable_all_features -v`
Expected: PASS (15 tests).

- [ ] **Step 5: Commit**

```bash
git add feature-catalog/skills/feature-catalog/scripts/enable_all_features.py \
        feature-catalog/skills/feature-catalog/scripts/test_enable_all_features.py
git commit -m "feat(feature-catalog): build all-ON feature-flag seed with exclusion resolution"
```

---

### Task 4: Inject the seed script into the HTML

**Files:**
- Modify: `feature-catalog/skills/feature-catalog/scripts/enable_all_features.py`
- Test: `feature-catalog/skills/feature-catalog/scripts/test_enable_all_features.py`

**Interfaces:**
- Consumes: seed map from `build_seed`.
- Produces:
  - Module constants `FF_STORAGE_KEY = "flexwork.featureFlags"` and
    `MIRROR_KEYS = ["flexwork.featureFlags.customFields", "flexwork.featureFlags.professionalJobTypes"]`.
  - `inject_seed(html: str, seed: dict) -> str` — returns HTML with a
    `<script data-enable-all-features="1">…</script>` inserted **before the first
    `<script` tag** (fallback: before `</head>`; fallback: prepended). The script
    writes the `FF_STORAGE_KEY` map (JSON) and sets each `MIRROR_KEYS` entry to
    `"true"`. Idempotent: if a marked seed script already exists, it is replaced,
    not duplicated.

- [ ] **Step 1: Write the failing test**

Append to `test_enable_all_features.py`:

```python
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd feature-catalog/skills/feature-catalog/scripts && python3 -m unittest test_enable_all_features -v`
Expected: FAIL — `AttributeError: module 'enable_all_features' has no attribute 'inject_seed'`.

- [ ] **Step 3: Write minimal implementation**

Add to `enable_all_features.py`:

```python
FF_STORAGE_KEY = "flexwork.featureFlags"
MIRROR_KEYS = [
    "flexwork.featureFlags.customFields",
    "flexwork.featureFlags.professionalJobTypes",
]

_SEED_SCRIPT_RE = re.compile(
    r'<script data-enable-all-features="1">.*?</script>', re.S
)


def _seed_script(seed):
    ff_json = json.dumps(seed)
    lines = [
        '<script data-enable-all-features="1">',
        "try{",
        f'localStorage.setItem({json.dumps(FF_STORAGE_KEY)},'
        f'{json.dumps(ff_json)});',
    ]
    for key in MIRROR_KEYS:
        lines.append(f'localStorage.setItem({json.dumps(key)},"true");')
    lines.append("}catch(e){}")
    lines.append("</script>")
    return "".join(lines)


def inject_seed(html, seed):
    script = _seed_script(seed)
    if _SEED_SCRIPT_RE.search(html):
        return _SEED_SCRIPT_RE.sub(lambda _m: script, html, count=1)
    m = re.search(r"<script\b", html, re.I)
    if m:
        return html[: m.start()] + script + html[m.start():]
    m = re.search(r"</head>", html, re.I)
    if m:
        return html[: m.start()] + script + html[m.start():]
    return script + html
```

Note: the map is stored as a JSON **string** (double-encoded) because the app reads
it with `JSON.parse(localStorage.getItem(...))`; `_seed_script` therefore embeds
`json.dumps(ff_json)` where `ff_json` is already a JSON string. The
`test_writes_ff_map_and_mirror_keys` assertion tolerates this by checking substrings.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd feature-catalog/skills/feature-catalog/scripts && python3 -m unittest test_enable_all_features -v`
Expected: PASS (19 tests).

- [ ] **Step 5: Commit**

```bash
git add feature-catalog/skills/feature-catalog/scripts/enable_all_features.py \
        feature-catalog/skills/feature-catalog/scripts/test_enable_all_features.py
git commit -m "feat(feature-catalog): inject pre-boot feature-flag seed script into HTML"
```

---

### Task 5: CLI wiring, fail-loud guard, and end-to-end test

**Files:**
- Modify: `feature-catalog/skills/feature-catalog/scripts/enable_all_features.py`
- Test: `feature-catalog/skills/feature-catalog/scripts/test_enable_all_features.py`

**Interfaces:**
- Consumes: `find_flag_module`, `parse_flag_catalog`, `build_seed`, `inject_seed`.
- Produces: `main(argv: list[str] | None = None) -> int` and a `__main__` guard.
  CLI: `enable_all_features.py <standalone.html> [--out <path>] [--print-seed]`.
  Default `--out` is `<stem>.all-features.html` beside the input. Exit `0` on
  success; non-zero with a clear stderr message when the input is missing, has no
  `__bundler/manifest`/flag module, or yields **0** flags.

- [ ] **Step 1: Write the failing test**

Append to `test_enable_all_features.py`:

```python
import os
import subprocess
import sys
import tempfile

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

    def test_zero_flags_fails_loud(self):
        html = _make_bundle("const x = 1; // no FEATURE_FLAG_GROUPS here")
        with tempfile.TemporaryDirectory() as d:
            src = os.path.join(d, "proto.html")
            with open(src, "w") as f:
                f.write(html)
            r = self._run(src)
            self.assertNotEqual(r.returncode, 0)

    def test_missing_file_fails(self):
        r = self._run("/no/such/file.html")
        self.assertNotEqual(r.returncode, 0)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd feature-catalog/skills/feature-catalog/scripts && python3 -m unittest test_enable_all_features -v`
Expected: FAIL — the CLI has no `main`, so subprocess runs error out (non-zero for the wrong reason / missing output file).

- [ ] **Step 3: Write minimal implementation**

Add to `enable_all_features.py`:

```python
import argparse
import sys
from pathlib import Path


def main(argv=None):
    parser = argparse.ArgumentParser(
        description="Seed all feature flags ON in a standalone HTML export."
    )
    parser.add_argument("html", help="path to the standalone .html export")
    parser.add_argument("--out", help="output path (default <stem>.all-features.html)")
    parser.add_argument("--print-seed", action="store_true",
                        help="print the computed seed JSON and exit (no file written)")
    args = parser.parse_args(argv)

    src = Path(args.html)
    if not src.is_file():
        print(f"error: not a file: {src}", file=sys.stderr)
        return 1

    html = src.read_text(errors="replace")
    module = find_flag_module(html)
    if module is None:
        print("error: no feature-flag module found (no __bundler/manifest, or "
              "FEATURE_FLAG_GROUPS absent). Not a supported standalone export.",
              file=sys.stderr)
        return 2

    catalog = parse_flag_catalog(module)
    seed = build_seed(catalog)
    if not seed:
        print("error: discovered 0 feature flags — parser found no seedable flags. "
              "Refusing to write a no-op file.", file=sys.stderr)
        return 3

    if args.print_seed:
        print(json.dumps(seed, indent=2))
        return 0

    out = Path(args.out) if args.out else src.with_suffix(".all-features.html")
    out.write_text(inject_seed(html, seed))
    on = sum(1 for v in seed.values() if v)
    off = [k for k, v in seed.items() if not v]
    print(f"enabled {on} feature flags -> {out}")
    if off:
        print(f"  left OFF (mutual exclusion): {', '.join(off)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
```

- [ ] **Step 4: Run tests + compile**

Run: `cd feature-catalog/skills/feature-catalog/scripts && python3 -m unittest test_enable_all_features -v && python3 -m py_compile enable_all_features.py`
Expected: PASS (23 tests) and clean compile.

- [ ] **Step 5: Commit**

```bash
git add feature-catalog/skills/feature-catalog/scripts/enable_all_features.py \
        feature-catalog/skills/feature-catalog/scripts/test_enable_all_features.py
git commit -m "feat(feature-catalog): CLI + fail-loud guard for enable-all-features"
```

---

### Task 6: Integration validation on the real prototype

**Files:**
- No production code changes (validation only). Optionally Modify:
  `feature-catalog/skills/feature-catalog/SKILL.md` (one-line optional pointer).

**Interfaces:**
- Consumes: the finished `enable_all_features.py` and the existing walker.
- Produces: evidence that flag-gated surfaces render after seeding.

- [ ] **Step 1: Run the script on the real standalone bundle**

```bash
cd feature-catalog/skills/feature-catalog/scripts
python3 enable_all_features.py "$(git rev-parse --show-toplevel)/tmp/project/Dayforce Flex Work VMS.html" \
  --out /tmp/vms.all-features.html
```
Expected: `enabled 21 feature flags -> /tmp/vms.all-features.html` (count may differ if the prototype changed), and a line noting `vmsEducation` (or `dataModelAlignment`) left OFF.

- [ ] **Step 2: Inspect the seed**

```bash
cd feature-catalog/skills/feature-catalog/scripts
python3 enable_all_features.py "$(git rev-parse --show-toplevel)/tmp/project/Dayforce Flex Work VMS.html" --print-seed
```
Expected: JSON with `contractors`/`sow` etc. **absent** (derived), axis flags `engAssignment`/`independentContractor`/`engStatementOfWork`/`eor` present and `true`, and exactly one of `dataModelAlignment`/`vmsEducation` `false`.

- [ ] **Step 3: Scope-walk a flag-gated surface on the seeded file**

```bash
cd feature-catalog/skills/feature-catalog/scripts
python3 walk_prototype.py /tmp/vms.all-features.html --out /tmp/walk-allon \
  --nav '["Settings","Feature Flags"]' --max-screens 3
python3 walk_prototype.py /tmp/vms.all-features.html --out /tmp/walk-allon --append \
  --nav '["Custom Fields"]' --max-screens 3
```
Expected: the walk completes; the Feature Flags screen's `.txt` outline shows toggles in the ON state, and the Custom Fields surface renders content (not an empty/flag-off state).

- [ ] **Step 4: Confirm a Partial→Present shift (spot check)**

Grep the walk outlines for a previously-gated surface to confirm it now renders:

```bash
grep -rl -i "custom field" /tmp/walk-allon/*.txt
```
Expected: at least one matching screen file. Record the before/after observation in the commit message.

- [ ] **Step 5: (Optional) Add a one-line pointer to SKILL.md and commit**

If desired, add under the Stage 3 walk section of `feature-catalog/skills/feature-catalog/SKILL.md` a single optional note:

```markdown
> Optional: to render flag-gated features, first run
> `scripts/enable_all_features.py <standalone.html> --out /tmp/proto.all-features.html`
> and walk that file instead of the original.
```

```bash
git add feature-catalog/skills/feature-catalog/SKILL.md
git commit -m "docs(feature-catalog): note optional enable-all-features pre-walk step"
```

If not adding the note, skip the commit — Task 6 is validation only.

---

## Notes for the implementer

- `enable_all_features.py` imports `grab_script` from `extract_bundle.py` in the same
  directory. Python puts the script's own directory on `sys.path`, so the import
  resolves when run as `python3 enable_all_features.py …` and when tests run from the
  scripts directory. Do not add package scaffolding.
- The `flexwork.featureFlags` value is stored **double-encoded** (a JSON string inside
  a `setItem` call) because the app parses it with `JSON.parse`. Keep it that way.
- Derived flags (`contractors`, `sow`, `milestones`, `fixedFee`, `professionalWork`,
  `v77Axes`) must never appear in the seed — they are computed from axis flags at read
  time and the app ignores any stored value for them. The `defaultOn:` discovery rule
  handles this automatically (derived flags have no `defaultOn`).
```
