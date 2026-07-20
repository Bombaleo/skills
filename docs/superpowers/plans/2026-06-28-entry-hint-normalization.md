# Entry-Hint Normalization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the source-first flow's confirmation walks actually run by deterministically normalizing the `source-mapper`'s messy `entry_hint`s into clickable nav `entry_path`s (+ a deduped `walk_targets`), tightening the agent contract, and wiring a normalize stage before the walks.

**Architecture:** A new stdlib `normalize_hints.py` (TDD) rewrites `map.json` — adding a clean `entry_path` per feature (truncated at the first dynamic segment) and a top-level `walk_targets`. The `source-mapper` contract is tightened to emit label arrays. The orchestrator runs the normalizer as Stage 2.5 and Stage 3 walks `walk_targets`.

**Tech Stack:** Python 3.9+ stdlib; Markdown skill/agent definitions.

**Design doc:** `docs/superpowers/specs/2026-06-28-entry-hint-normalization-design.md`

## Global Constraints

- **Python 3.9+, stdlib only**; tests via `python3 -m unittest`.
- **Independence:** no `spec-pipeline`/`prototype-to-spec` runtime refs; script under `feature-catalog/skills/feature-catalog/scripts/`.
- **Normalize rule:** split a hint on `→`/`>`/`,`; keep the leading run of static nav labels; **STOP** at the first segment that is a `[placeholder]` (contains `[` and `]`), a pure `(annotation)` (begins with `(`), or an **action verb** (case-insensitive exact match in: `add, edit, delete, remove, apply, continue, publish, pin, download, save, cancel, next, back, add rule, add group, compare changes`). Strip a trailing `(...)` annotation from a kept label; collapse whitespace; drop labels that become empty. Result may be empty.
- **`entry_hint` is preserved** for traceability; `entry_path` (array) is added per feature; `walk_targets` (top-level) = sorted, de-duplicated non-empty `entry_path`s (dedupe by tuple).
- **`source-mapper` `entry_hint` contract:** a JSON **array** of literal clickable nav labels (shortest real nav path); prohibit `→` strings, `(...)` annotations, `[placeholders]`, action verbs.
- **Stage 3 walks `walk_targets`**, not raw `entry_hint`. Unreachable target = unreached (features stay Partial), not a stop.

---

## File Structure

```
feature-catalog/skills/feature-catalog/scripts/
  normalize_hints.py + test_normalize_hints.py     # Task 1 — new (TDD)
feature-catalog/agents/source-mapper/source-mapper.md    # Task 2 — tighten entry_hint contract
feature-catalog/skills/feature-catalog/SKILL.md          # Task 3 — +Stage 2.5; Stage 3 uses walk_targets
```

**Contract:** `normalize_hints.py` exposes `normalize_hint(hint) -> list[str]` and `normalize_map(m: dict) -> dict`, plus CLI `normalize_hints.py <map_json>` (rewrites in place). After it runs, `map.json` has `walk_targets: list[list[str]]` and each feature has `entry_path: list[str]`.

---

## Task 1: `normalize_hints.py` — deterministic entry-hint normalizer (TDD)

**Files:**
- Create: `feature-catalog/skills/feature-catalog/scripts/normalize_hints.py`
- Test: `feature-catalog/skills/feature-catalog/scripts/test_normalize_hints.py`

**Interfaces:**
- Produces: `normalize_hint(hint)`, `normalize_map(m)`, CLI `<map_json>`. Task 3's Stage 2.5 invokes the CLI; Stage 3 reads the `walk_targets` it writes.

- [ ] **Step 1: Write the failing test**

Create `feature-catalog/skills/feature-catalog/scripts/test_normalize_hints.py`:
```python
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


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd feature-catalog/skills/feature-catalog/scripts && python3 -m unittest test_normalize_hints -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'normalize_hints'`.

- [ ] **Step 3: Write the implementation**

Create `feature-catalog/skills/feature-catalog/scripts/normalize_hints.py`:
```python
#!/usr/bin/env python3
"""Normalize source-mapper entry_hints into clickable nav paths for the walker.

The source-mapper sometimes emits entry_hint as a descriptive string ("A → B → C
(wizard ③ …) → [version] → Delete") instead of a clean array of clickable nav
labels. The walker's --nav needs the latter. This rewrites map.json: each feature
gains a clean `entry_path` (the leading run of static nav labels, truncated at the
first dynamic segment), and a top-level `walk_targets` lists the distinct non-empty
paths for the orchestrator to walk.

Usage:
    normalize_hints.py <map_json>

Stdlib only, Python >= 3.9.
"""
import argparse
import json
import re
import sys
from pathlib import Path

ACTION_VERBS = {
    "add", "edit", "delete", "remove", "apply", "continue", "publish", "pin",
    "download", "save", "cancel", "next", "back", "add rule", "add group",
    "compare changes",
}


def _raw_segments(hint):
    if isinstance(hint, list):
        return [str(s) for s in hint]
    if isinstance(hint, str):
        return [s for s in re.split(r"→|>|,", hint)]
    return []


def _is_stop(seg: str) -> bool:
    s = seg.strip()
    if not s:
        return False  # empty handled by caller (skip, not stop)
    if "[" in s and "]" in s:
        return True
    if s.startswith("("):
        return True
    if s.lower() in ACTION_VERBS:
        return True
    return False


def _clean_label(seg: str) -> str:
    # strip a trailing "(...)" annotation, surrounding brackets, collapse whitespace
    s = re.sub(r"\s*\([^)]*\)\s*$", "", seg).strip()
    s = s.strip("[]").strip()
    return re.sub(r"\s+", " ", s)


def normalize_hint(hint) -> list:
    out = []
    for seg in _raw_segments(hint):
        if _is_stop(seg):
            break
        label = _clean_label(seg)
        if label:
            out.append(label)
    return out


def normalize_map(m: dict) -> dict:
    targets = []
    seen = set()
    for e in m.get("entities", []):
        for f in e.get("features", []):
            path = normalize_hint(f.get("entry_hint"))
            f["entry_path"] = path
            key = tuple(path)
            if path and key not in seen:
                seen.add(key)
                targets.append(path)
    m["walk_targets"] = sorted(targets)
    return m


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("map_json")
    args = ap.parse_args()
    p = Path(args.map_json)
    m = normalize_map(json.loads(p.read_text()))
    p.write_text(json.dumps(m, indent=2))
    print(f"{len(m['walk_targets'])} walk targets")
    return 0


if __name__ == "__main__":
    sys.exit(main())
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd feature-catalog/skills/feature-catalog/scripts && python3 -m unittest test_normalize_hints -v`
Expected: `Ran 9 tests` — `OK`.

- [ ] **Step 5: Smoke-test the CLI on a realistic hint**

Run:
```bash
cd feature-catalog/skills/feature-catalog/scripts
tmp=$(mktemp -d)
printf '%s' '{"unmapped":false,"nav":[],"entities":[{"slug":"r","name":"R","role":"x","states":[],"transitions":[],"features":[{"name":"f","category":"create","evidence_source":[],"entry_hint":"Settings → Rate automation → Rate Engine → [version] → Add group"}]}]}' > "$tmp/map.json"
python3 normalize_hints.py "$tmp/map.json"
python3 -c "import json;d=json.load(open('$tmp/map.json'));print('entry_path:',d['entities'][0]['features'][0]['entry_path']);print('walk_targets:',d['walk_targets'])"
rm -rf "$tmp"
```
Expected: prints `1 walk targets`, then `entry_path: ['Settings', 'Rate automation', 'Rate Engine']` and `walk_targets: [['Settings', 'Rate automation', 'Rate Engine']]`.

- [ ] **Step 6: Commit**

```bash
git add feature-catalog/skills/feature-catalog/scripts/normalize_hints.py \
        feature-catalog/skills/feature-catalog/scripts/test_normalize_hints.py
git commit -m "feat(feature-catalog): add deterministic normalize_hints.py"
```

---

## Task 2: Tighten `source-mapper` entry_hint contract

**Files:**
- Modify: `feature-catalog/agents/source-mapper/source-mapper.md`

**Interfaces:** no code; the agent should emit `entry_hint` as a clean label array. (The normalizer is the safety net regardless.)

- [ ] **Step 1: Tighten the entry_hint description**

In `feature-catalog/agents/source-mapper/source-mapper.md`, find the bullet that describes the `features` entry (it contains "`entry_hint`: your best click-path"). Replace the sentence that begins "The `entry_hint` is your best click-path..." with:
```markdown
  The `entry_hint` MUST be a JSON **array of literal, clickable nav labels** giving the SHORTEST
  real nav click-path to where this feature lives, e.g. `["Settings","Rate automation","Uploads"]`.
  Do NOT emit a `→`-joined string, do NOT include `(...)` step annotations, `[placeholder]`
  segments (like `[version]`/`[agency name]`), or in-page action verbs (Add/Edit/Delete/Apply/
  Continue/Publish/…). Bad: `"Settings → Rate automation → Uploads (wizard ③ …) → [version] → Delete"`.
  Good: `["Settings","Rate automation","Uploads"]`. A downstream deterministic step normalizes
  these, but emit clean arrays so it has the best signal.
```

- [ ] **Step 2: Verify**

Run:
```bash
python3 - <<'EOF'
import pathlib
t = pathlib.Path("feature-catalog/agents/source-mapper/source-mapper.md").read_text()
assert "array of literal, clickable nav labels" in t, "array contract missing"
assert "Bad:" in t and "Good:" in t, "examples missing"
assert "do NOT include" in t or "Do NOT emit" in t, "prohibitions missing"
assert "prototype-to-spec" not in t and "spec-pipeline" not in t
print("VERIFY_OK")
EOF
```
Expected: `VERIFY_OK`.

- [ ] **Step 3: Commit**

```bash
git add feature-catalog/agents/source-mapper/source-mapper.md
git commit -m "feat(feature-catalog): require array entry_hint in source-mapper"
```

---

## Task 3: Orchestrator — add Stage 2.5 and walk `walk_targets`

**Files:**
- Modify: `feature-catalog/skills/feature-catalog/SKILL.md`

**Interfaces:**
- Consumes: `normalize_hints.py` CLI (Task 1) and the `walk_targets`/`entry_path` it writes.

- [ ] **Step 1: Insert Stage 2.5 after Stage 2**

In `feature-catalog/skills/feature-catalog/SKILL.md`, immediately AFTER the end of the `### Stage 2 — Source map` section (the line ending "...If empty/invalid, stop and report.") and BEFORE `### Stage 3 — Targeted confirmation walks`, insert:
```markdown
### Stage 2.5 — Normalize entry-hints (deterministic)
The source-mapper's `entry_hint`s may be descriptive strings (with `→`, wizard annotations,
`[placeholders]`, action verbs) rather than clickable label arrays. Normalize them before walking:
```bash
python3 "$SCRIPTS/normalize_hints.py" .specwork/catalog/map.json
```
This adds a clean `entry_path` (clickable nav labels, truncated at the first dynamic segment) to
each feature and a top-level `walk_targets` (the distinct non-empty paths). Skip this stage in
fallback (`unmapped: true`) — there are no source entry-hints. Confirm `walk_targets` exists
(it may be an empty list, in which case Stage 3 has nothing to walk and all render-status
features stay Partial).
```

- [ ] **Step 2: Change Stage 3 to walk `walk_targets`**

In the `### Stage 3 — Targeted confirmation walks` section, replace the paragraph beginning
"Collect the distinct `entry_hint` paths from `map.json`..." (through the walk code block and its
`--nav "<comma-joined entry_hint labels>"`) with:
```markdown
Use the `walk_targets` from `map.json` (the normalized, deduped clickable paths from Stage 2.5).
For each target (a list of nav labels), run a **scoped** walk that accumulates into `/tmp/proto-walk`:
```bash
python3 "$SCRIPTS/walk_prototype.py" /tmp/prototype.html --out /tmp/proto-walk --append \
  --nav "<comma-joined target labels>" --max-screens 40 --depth 4 --per-screen 30
```
```
Then update the cap bullet that says "Cap total scoped walks at the number of distinct
entry-hints..." to read "Cap total scoped walks at the number of `walk_targets`; if that exceeds
~30, walk the 30 whose paths cover the most features and **log** which targets were skipped."

- [ ] **Step 3: Point the analyst evidence-selection at entry_path**

In Stage 4's bullet describing `evidence_screens` (it currently says "match by the entity's
`entry_hint` paths / titles"), change `entry_hint` to `entry_path` so the analyst matches walk
screens using the normalized path.

- [ ] **Step 4: Verify**

Run:
```bash
python3 - <<'EOF'
import pathlib
t = pathlib.Path("feature-catalog/skills/feature-catalog/SKILL.md").read_text()
assert "### Stage 2.5 — Normalize entry-hints (deterministic)" in t, "Stage 2.5 missing"
assert "normalize_hints.py" in t, "normalizer not invoked"
# ordering: Stage 2 < Stage 2.5 < Stage 3
i2 = t.index("### Stage 2 — Source map")
i25 = t.index("### Stage 2.5 — Normalize entry-hints")
i3 = t.index("### Stage 3 — Targeted confirmation walks")
assert i2 < i25 < i3, "Stage 2.5 not positioned between Stage 2 and Stage 3"
assert "walk_targets" in t, "Stage 3 does not use walk_targets"
assert 'entry_path' in t, "analyst evidence not pointed at entry_path"
# the old raw-entry_hint walk instruction is gone
assert "Collect the distinct `entry_hint` paths from `map.json`" not in t, "old Stage 3 text remains"
for bad in ["entity-discoverer","group_screens","module-cataloger","catalog-synthesizer","prototype-to-spec/scripts"]:
    assert bad not in t, f"references {bad}"
print("VERIFY_OK")
EOF
```
Expected: `VERIFY_OK`.

- [ ] **Step 5: Commit**

```bash
git add feature-catalog/skills/feature-catalog/SKILL.md
git commit -m "feat(feature-catalog): Stage 2.5 normalize hints; Stage 3 walks walk_targets"
```

---

## Self-Review

**Spec coverage** (design → task):
- `normalize_hints.py` with `normalize_hint`/`normalize_map`/CLI, truncate-at-first-dynamic, `entry_path` + deduped `walk_targets`, preserve other fields → Task 1.
- Truncation rule (placeholder / pure-annotation / action-verb; strip trailing annotation; collapse ws; may be empty) → Task 1 implementation + tests.
- source-mapper array contract + prohibitions + good/bad examples → Task 2.
- Stage 2.5 runs the normalizer (skip in fallback); Stage 3 walks `walk_targets`; analyst uses `entry_path` → Task 3.

**Type/contract consistency:** `normalize_hint`/`normalize_map` names + the `entry_path`/`walk_targets` keys match between Task 1 impl, its test, and the Task 3 SKILL usage. CLI `<map_json>` matches the Stage 2.5 invocation. `walk_targets` is `list[list[str]]`; Stage 3 comma-joins each inner list for `--nav` (labels contain no commas in practice; matches `walk_prototype.py`'s comma-split `--nav`). Original `entry_hint` preserved (Task 1) so nothing else breaks.

**Placeholder scan:** none — full code/tests inline; every verification step has exact commands and expected output.

**Note on edit anchors (Tasks 2, 3):** target existing lines by quoted content; the Step-N assertions confirm inserts/replacements landed and are ordered.
