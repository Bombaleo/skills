# Source-First Discovery + Feature-List Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Re-architect the feature-catalog pipeline's front half to map the prototype from extracted source first (authority for what exists), then drive the walker surgically per feature to confirm reachability — and add a deterministic implemented-feature-list output (`features.md`).

**Architecture:** A new `source-mapper` agent reads `/tmp/proto-src` into `map.json` (nav, entities, per-feature actions/states, and a nav entry-hint per feature). The orchestrator runs one scoped `--nav` walk per entry-hint to confirm reachability. The analyst keys off the source map (present=rendered, partial=in-source-unreached, missing=expected-absent-from-source). The synthesizer assigns each entity a logical group; a tested `feature_list.py` renders implemented features grouped by group. Falls back to the current blind walk-first flow when source isn't extractable.

**Tech Stack:** Markdown skill/agent definitions; Python 3.9+ stdlib scripts; headless Chrome walk via existing `walk_prototype.py` (`--nav`/`--only`, unchanged).

**Design doc:** `docs/superpowers/specs/2026-06-26-source-first-discovery-design.md`

## Global Constraints

- **Python 3.9+, stdlib only** for scripts; tests via `python3 -m unittest`.
- **Independence:** no runtime reference to `spec-pipeline`/`prototype-to-spec`; scripts under `feature-catalog/skills/feature-catalog/scripts/` only.
- **Authority rule:** source is the authority for what EXISTS; the walk confirms reachability. `present` = render-confirmed; `partial` = in source, not reached/rendered; `missing` = VMS-expected, absent from source (analyst domain reasoning), each justified.
- **No new walker capability:** the walker is steered only by source-provided nav click-path labels via the existing `--nav`/`--only`.
- **Fallback:** if `extract_bundle.py` exits 2 (not a bundler export) / no source, revert to walk-first discovery and carry an "UNMAPPED — discovered without source" caveat.
- **Feature list:** implemented only — `status in {present, partial}`, `partial` flagged, `missing` excluded; grouped by the synthesizer-assigned logical `group`; deterministic rendering. Markdown now; PDF out of scope.
- **`ent_<slug>.json` output shape is unchanged** (slug, name, role, states{observed,expected,missing}, transitions[], capabilities[{name,category,status,evidence,note}], coverage{present,partial,missing,expected_total}) so `compute_coverage.py` and `gap-synthesizer` are untouched by the analyst revision.
- **Default `app_slug`:** `vms`. Outputs: `catalog/<app_slug>/{entity-catalog.md, entities.json, features.md}`.

---

## File Structure

```
feature-catalog/
  agents/
    source-mapper/{source-mapper.md, README.md}                    # Task 2 — new
    entity-discoverer/                                             # Task 7 — retired (absorbed by source-mapper)
    entity-lifecycle-analyst/entity-lifecycle-analyst.md           # Task 3 — revised (map authority)
    gap-synthesizer/gap-synthesizer.md                             # Task 4 — +group assignment
  skills/feature-catalog/
    SKILL.md                                                       # Task 5 — front-half rework
    scripts/
      feature_list.py + test_feature_list.py                       # Task 1 — new (TDD)
      compute_coverage.py, walk_prototype.py, extract_bundle.py    # unchanged
  README.md                                                        # Task 6 — updated flow
```

**Shared contracts:**

`.specwork/catalog/map.json` (source-mapper):
```json
{
  "unmapped": false,
  "nav": [{"label": "Agencies", "path": ["Agencies"]}],
  "entities": [
    { "slug": "rate_card", "name": "Rate Card", "role": "...",
      "states": ["draft","active","superseded","archived"],
      "transitions": [{"from":"draft","to":"active","action":"apply"}],
      "features": [
        { "name": "Upload rate card", "category": "create",
          "evidence_source": ["010_x.js"], "entry_hint": ["Settings","Rate automation","Upload"] }
      ] }
  ]
}
```

`entities-report.json` gains a `group` string per entity (Task 4). `feature_list.py` (Task 1) reads that.

**Task order rationale:** build `feature_list.py` (Task 1) and `source-mapper` (Task 2) first; revise analyst (3) and synthesizer (4); rewrite SKILL (5) to wire the new flow; update README (6); retire `entity-discoverer` (7) last so no live file references a deleted one mid-migration.

---

## Task 1: `feature_list.py` — deterministic implemented-feature renderer (TDD)

**Files:**
- Create: `feature-catalog/skills/feature-catalog/scripts/feature_list.py`
- Test: `feature-catalog/skills/feature-catalog/scripts/test_feature_list.py`

**Interfaces:**
- Produces: `implemented_features(entity) -> list[dict]`, `grouped_entities(report) -> list[tuple[str, list[dict]]]`, `render_markdown(report) -> str`, and CLI `feature_list.py <report_json> <out_md>`. Task 5 invokes the CLI; Task 4 produces the `group` field it reads.

- [ ] **Step 1: Write the failing test**

Create `feature-catalog/skills/feature-catalog/scripts/test_feature_list.py`:
```python
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd feature-catalog/skills/feature-catalog/scripts && python3 -m unittest test_feature_list -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'feature_list'`.

- [ ] **Step 3: Write the implementation**

Create `feature-catalog/skills/feature-catalog/scripts/feature_list.py`:
```python
#!/usr/bin/env python3
"""Render the implemented-features markdown for the feature-catalog pipeline.

Reads entities-report.json (each entity carries a synthesizer-assigned `group`)
and renders features.md: implemented capabilities only (status present or partial,
partial flagged; missing excluded), grouped by logical entity group. Deterministic
— every present/partial capability is rendered; nothing is invented or dropped.

Usage:
    feature_list.py <report_json> <out_md>

Stdlib only, Python >= 3.9.
"""
import argparse
import json
import sys
from pathlib import Path

DEFAULT_GROUP = "Other"
IMPLEMENTED = ("present", "partial")


def implemented_features(entity: dict) -> list:
    return [c for c in entity.get("capabilities", []) if c.get("status") in IMPLEMENTED]


def grouped_entities(report: dict):
    """Return [(group_name, [entities...])], groups sorted alphabetically with the
    default group last; entities within a group sorted by name."""
    buckets = {}
    for e in report.get("entities", []):
        g = e.get("group") or DEFAULT_GROUP
        buckets.setdefault(g, []).append(e)
    for g in buckets:
        buckets[g].sort(key=lambda e: e.get("name", e.get("slug", "")))

    def key(g):
        return (1, "") if g == DEFAULT_GROUP else (0, g.lower())

    return [(g, buckets[g]) for g in sorted(buckets, key=key)]


def render_markdown(report: dict) -> str:
    app = report.get("app", "app")
    L = [f"# {app} — Implemented Features", ""]
    src = report.get("generated_from")
    if src:
        L.append(f"Implemented capabilities found in the prototype `{src}` "
                 f"(items marked *(partial)* are present but not fully confirmed). "
                 f"Generated from the entity-lifecycle catalog.")
        L.append("")
    for group, ents in grouped_entities(report):
        # skip groups whose entities have no implemented features at all
        if not any(implemented_features(e) for e in ents):
            continue
        L.append(f"## {group}")
        L.append("")
        for e in ents:
            feats = implemented_features(e)
            if not feats:
                continue
            L.append(f"### {e.get('name', e.get('slug'))}")
            for f in feats:
                tag = " (partial)" if f.get("status") == "partial" else ""
                L.append(f"- {f['name']}{tag}")
            L.append("")
    return "\n".join(L).rstrip() + "\n"


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("report_json")
    ap.add_argument("out_md")
    args = ap.parse_args()
    report = json.loads(Path(args.report_json).read_text())
    Path(args.out_md).write_text(render_markdown(report))
    n = sum(len(implemented_features(e)) for e in report.get("entities", []))
    print(f"feature list written: {n} implemented features -> {args.out_md}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd feature-catalog/skills/feature-catalog/scripts && python3 -m unittest test_feature_list -v`
Expected: `Ran 5 tests` — `OK`.

- [ ] **Step 5: Commit**

```bash
git add feature-catalog/skills/feature-catalog/scripts/feature_list.py \
        feature-catalog/skills/feature-catalog/scripts/test_feature_list.py
git commit -m "feat(feature-catalog): add deterministic feature_list.py"
```

---

## Task 2: `source-mapper` worker agent (with no-source fallback)

**Files:**
- Create: `feature-catalog/agents/source-mapper/source-mapper.md`
- Create: `feature-catalog/agents/source-mapper/README.md`

**Interfaces:**
- Consumes: `src_dir` (`/tmp/proto-src`, may be absent), `walk_dir` (`/tmp/proto-walk` — used only in fallback), `context_path` (optional), `output_path` (`.specwork/catalog/map.json`).
- Produces: `.specwork/catalog/map.json` (contract above). Stage 3 reads `entities[].features[].entry_hint`; the analyst reads each entity's `features`/`states`/`transitions`.

- [ ] **Step 1: Write the agent definition**

Create `feature-catalog/agents/source-mapper/source-mapper.md`:
````markdown
---
name: source-mapper
description: >
  Builds the prototype's map from its extracted SOURCE (not by walking): reads the JS/HTML modules
  and produces map.json — nav structure, domain entities, per-entity features with a nav entry-hint
  each, and lifecycle states/transitions taken from source. The authority for what the app contains.
  Falls back to walk-based discovery when no source is extractable. Worker for the feature-catalog
  pipeline; not for standalone use.
tools: Read, Glob, Grep, Write, Bash
---

You are the **source-mapper**. You map what a prototype contains by reading its extracted source,
so the pipeline can then walk surgically. You are the authority for *what exists*; the walk only
confirms reachability later.

## Inputs

- **src_dir** (required normally): extracted source (default `/tmp/proto-src`) — `manifest.json`,
  `_template.html`, and `.js` modules. May be absent (→ fallback).
- **walk_dir** (optional): `/tmp/proto-walk` — used ONLY in the fallback mode below.
- **context_path** (optional): `.specwork/context.md`. Terminology only.
- **output_path** (required): `.specwork/catalog/map.json`.

## Task

### 0. Fallback check
If `src_dir` is absent or has no app source (no `manifest.json`/`.js`/`_template.html`), switch to
**fallback mode**: read `walk_dir` outlines instead and discover entities from the rendered screens
(as a walk-based discovery would), set `"unmapped": true` in the output, omit `entry_hint`s, and
note prominently that the map was built without source. Then skip to step 4.

### 1. Read the source
Read `manifest.json` for the file index, then the app modules (`.js`, `_template.html`). **Skip
minified vendor files** — first line is a license header and/or lines are thousands of chars long.
Focus on app modules: route/nav tables, component definitions, action handlers, reducers/state
enums, validation rules, and label constants.

### 2. Extract the nav structure
Find the app's navigation definition (sidebar/top menu). Record `nav` as a list of
`{label, path}` where `path` is the click-path of labels to reach that area. This gives entry
points for the walker.

### 3. Identify entities and their features
For each domain entity (requisition, worker, supplier, timesheet, invoice, rate card, etc.):
- `slug`, `name`, one-line `role`.
- `states`: lifecycle states found in source (status enums, state machines). `transitions`:
  `{from, to, action}` where source defines them.
- `features`: each a distinct user capability the source implements —
  `{name, category, evidence_source: [file names], entry_hint: [nav labels to reach it]}`.
  `category` ∈ create | read | update | delete | archive | list_search | state_transition | other.
  The `entry_hint` is your best click-path from the nav structure to where this feature lives; it
  is what the walker will use to render-confirm the feature.

Only record what the source actually contains — never invent entities or features.

### 4. Write map.json
Write `output_path` exactly:

```json
{
  "unmapped": false,
  "nav": [{"label": "Agencies", "path": ["Agencies"]}],
  "entities": [
    { "slug": "rate_card", "name": "Rate Card", "role": "Configured bill/pay pricing rules.",
      "states": ["draft","active","superseded","archived"],
      "transitions": [{"from":"draft","to":"active","action":"apply"}],
      "features": [
        { "name": "Upload rate card", "category": "create",
          "evidence_source": ["010_x.js"], "entry_hint": ["Settings","Rate automation","Upload"] }
      ] }
  ]
}
```
In fallback mode set `"unmapped": true`, base entities on the walk, and use `[]` for
`entry_hint`/`evidence_source`.

**Rules:** source-grounded only; never invent. Valid JSON. English only.

## Return

Reply with: `output_path`, mode (`source` | `unmapped-fallback`), entity count, total feature
count, and a one-line list of entity slugs.
````

- [ ] **Step 2: Write the README**

Create `feature-catalog/agents/source-mapper/README.md`:
```markdown
# source-mapper

Builds `map.json` from the prototype's extracted **source** (not by walking):
nav structure, domain entities, per-entity features each with a nav entry-hint,
and lifecycle states/transitions taken from source. The authority for what the
app contains; the walker later confirms reachability. Falls back to walk-based
discovery when no source is extractable. Worker agent for the feature-catalog
pipeline; not for standalone use.

**Tools:** Read, Glob, Grep, Write, Bash
```

- [ ] **Step 3: Verify structure**

Run:
```bash
python3 - <<'EOF'
import pathlib
t = pathlib.Path("feature-catalog/agents/source-mapper/source-mapper.md").read_text()
assert t.startswith("---\n")
fm = t.split("---\n", 2)[1]
assert "name: source-mapper" in fm and "tools:" in fm
for s in ["## Inputs", "## Task", "## Return", "map.json", "entry_hint", "unmapped",
          "Fallback", "never invent", "evidence_source"]:
    assert s in t, f"missing: {s}"
assert "prototype-to-spec" not in t and "spec-pipeline" not in t
print("VERIFY_OK")
EOF
```
Expected: `VERIFY_OK`.

- [ ] **Step 4: Commit**

```bash
git add feature-catalog/agents/source-mapper/
git commit -m "feat(feature-catalog): add source-mapper agent (source-first discovery)"
```

---

## Task 3: Revise `entity-lifecycle-analyst` to key off the source map

**Files:**
- Modify: `feature-catalog/agents/entity-lifecycle-analyst/entity-lifecycle-analyst.md`

**Interfaces:**
- Consumes (new): `map_path` (`.specwork/catalog/map.json`) — the analyst reads its own entity's `features`/`states`/`transitions` as the authority for what exists.
- Produces: unchanged `ent_<slug>.json` shape.

- [ ] **Step 1: Add `map_path` to the Inputs section**

In `feature-catalog/agents/entity-lifecycle-analyst/entity-lifecycle-analyst.md`, find the Inputs bullet for `evidence_screens` (begins "- **evidence_screens**"). Immediately BEFORE it, insert:
```markdown
- **map_path** (required): `.specwork/catalog/map.json`. Find your entity by `entity_slug`; its
  `features`, `states`, and `transitions` are the **authority for what exists** in the prototype.
```

- [ ] **Step 2: Replace the "Derive the EXPECTED lifecycle" step to make source the authority**

Find the step that begins "### 1. Derive the EXPECTED VMS lifecycle (domain reasoning)" and replace that entire numbered step's body (down to but not including "### 2.") with:
```markdown
### 1. Start from the source map (authority for what exists)
Read `map_path` and locate your entity (`entity_slug`). Its `features`, `states`, and
`transitions` are what the prototype actually contains — treat them as the existing set. Then,
using your VMS domain knowledge, determine the capabilities a VMS is **commonly expected** to
support for this entity that are NOT in the source map — those are candidate **missing** items.
The union (source features + expected-but-absent) is the entity's expected capability set.
```

- [ ] **Step 3: Replace the marking rules to use source+render**

Find the step beginning "### 3. Mark each expected item Present / Partial / Missing" and replace its three status bullets with:
```markdown
- **present** — in the source map AND render-confirmed in the walk (`evidence` cites the walk
  screen(s)).
- **partial** — in the source map but NOT reached/rendered by the walk (flag-gated, not in the
  scoped walk, or render not captured); `note` says so.
- **missing** — NOT in the source map, but commonly expected in a VMS for this entity; `note`
  MUST state why it is commonly expected. `evidence` is `[]`.
```

- [ ] **Step 4: Verify**

Run:
```bash
python3 - <<'EOF'
import pathlib
t = pathlib.Path("feature-catalog/agents/entity-lifecycle-analyst/entity-lifecycle-analyst.md").read_text()
assert "map_path" in t, "map_path input missing"
assert "authority for what exists" in t, "authority phrasing missing"
assert "in the source map AND render-confirmed" in t, "present rule not updated"
assert "in the source map but NOT reached" in t, "partial rule not updated"
assert "NOT in the source map" in t, "missing rule not updated"
# output contract still present and unchanged
for s in ["ent_<slug>.json", "expected_total", "capabilities[].category"]:
    assert s in t, f"lost contract: {s}"
assert "prototype-to-spec" not in t and "spec-pipeline" not in t
print("VERIFY_OK")
EOF
```
Expected: `VERIFY_OK`.

- [ ] **Step 5: Commit**

```bash
git add feature-catalog/agents/entity-lifecycle-analyst/entity-lifecycle-analyst.md
git commit -m "feat(feature-catalog): analyst keys off source map (present/partial/missing)"
```

---

## Task 4: `gap-synthesizer` assigns a logical group per entity

**Files:**
- Modify: `feature-catalog/agents/gap-synthesizer/gap-synthesizer.md`

**Interfaces:**
- Produces (new): a `group` string on each entity object in `entities-report.json`. `feature_list.py` (Task 1) reads it.

- [ ] **Step 1: Add a grouping task step**

In `feature-catalog/agents/gap-synthesizer/gap-synthesizer.md`, find the step "### 2. Compute overall coverage" and insert immediately BEFORE it a new step:
```markdown
### 1b. Assign each entity a logical group
Group related entities into a small set of logical domain groups using their roles — e.g.
"Sourcing & Demand", "Workforce & Compliance", "Financials", "Supply", "Configuration". Add a
`group` string to each entity object. Use 3–6 groups total; keep names short and domain-meaningful.
```

- [ ] **Step 2: Note the added `group` in the entities-report.json shape**

The report example embeds entity objects via a placeholder line:
```
  "entities": [ <each ent_*.json object, unchanged, in the chosen order> ] }
```
Replace that line with one that records the added `group` field:
```
  "entities": [ <each ent_*.json object plus an added "group" string (the logical group from
                 step 1b), in the chosen order> ] }
```
Then, in step "### 4. Write entities-report.json", append one sentence: "Add a `group` string to
each entity object (from step 1b) when writing it into `entities`."

- [ ] **Step 3: Verify**

Run:
```bash
python3 - <<'EOF'
import pathlib
t = pathlib.Path("feature-catalog/agents/gap-synthesizer/gap-synthesizer.md").read_text()
assert "### 1b. Assign each entity a logical group" in t, "grouping step missing"
assert '"group"' in t, "group field not in report shape"
assert "Sourcing & Demand" in t
assert "prototype-to-spec" not in t and "spec-pipeline" not in t
print("VERIFY_OK")
EOF
```
Expected: `VERIFY_OK`.

- [ ] **Step 4: Commit**

```bash
git add feature-catalog/agents/gap-synthesizer/gap-synthesizer.md
git commit -m "feat(feature-catalog): synthesizer assigns logical group per entity"
```

---

## Task 5: Rewrite the orchestrator SKILL.md for source-first flow

**Files:**
- Modify (full rewrite): `feature-catalog/skills/feature-catalog/SKILL.md`

**Interfaces:**
- Consumes: user inputs; own scripts (`extract_bundle.py`, `walk_prototype.py`, `compute_coverage.py`, `feature_list.py`). Dispatches `source-mapper`, `entity-lifecycle-analyst`, `gap-synthesizer` with their declared inputs.
- Produces: `catalog/<app_slug>/{entity-catalog.md, entities.json, features.md}`.

- [ ] **Step 1: Overwrite SKILL.md**

Overwrite `feature-catalog/skills/feature-catalog/SKILL.md` with exactly:
````markdown
---
name: feature-catalog
description: >
  Orchestrates a self-contained pipeline that maps a whole Claude Design prototype — a design URL
  or a local prototype path (default ./project) — from its SOURCE first, then confirms each feature
  by walking it, producing a VMS entity-lifecycle gap analysis (every entity's expected lifecycle
  marked Present / Partial / Missing) plus an implemented-features list. Use when the user wants to
  know, per object, what a VMS should do with it and what this prototype actually does — "analyse
  the entity lifecycles", "what's missing per object", "list the implemented features", "build an
  entity gap analysis from this prototype". Delegates to three workers: source-mapper,
  entity-lifecycle-analyst (one per entity, in parallel), and gap-synthesizer.
---

# Feature-catalog orchestrator (source-first, entity-lifecycle gap analysis)

You are the **orchestrator**. You map a prototype from its extracted source (the authority for
what exists), then walk each feature surgically to confirm reachability, fan out one analyst per
entity, synthesize the catalog, and render an implemented-feature list. Keep your context lean —
workers return short summaries and file paths.

This pipeline is **self-contained**: it uses only its own scripts under
`skills/feature-catalog/scripts/` and never reads from `spec-pipeline` or `prototype-to-spec`.

## Inputs

- **prototype** (required): a Claude Design URL or a local path to a downloaded prototype project
  (standalone `.html` or a directory holding one). If neither given, default to `./project`; if
  that does not exist, **stop and ask**.
- **app_slug** (optional): snake_case output dir name. Default `vms`. Derive `app_name` as a
  display version, e.g. `vms → VMS`.
- **resources_path** (optional): directory for terminology context. Default `./resources/`. Used
  only to align names; never adds entities. Skipped silently if absent.

## Artifact contract

Intermediate work lives in `.specwork/catalog/` (create if absent; gitignore `.specwork/`). The
source and walk live in `/tmp/`.

| File | Written by | Read by |
|---|---|---|
| `/tmp/proto-src/` (extracted source) | orchestrator (Stage 1) | source-mapper, entity-lifecycle-analyst |
| `.specwork/catalog/map.json` | source-mapper | orchestrator (Stage 3), entity-lifecycle-analyst |
| `/tmp/proto-walk/` (scoped-walk output) | orchestrator (Stage 3) | entity-lifecycle-analyst |
| `.specwork/context.md` (optional) | orchestrator (Stage 1.5) | all workers |
| `.specwork/catalog/ent_<slug>.json` | entity-lifecycle-analyst | compute_coverage, gap-synthesizer |
| `.specwork/catalog/entity-catalog.md` | gap-synthesizer | orchestrator (publish) |
| `.specwork/catalog/entities-report.json` (has `group` per entity) | gap-synthesizer | feature_list.py, publish |
| `.specwork/catalog/features.md` | feature_list.py | publish |

Final output: `catalog/<app_slug>/{entity-catalog.md, entities.json, features.md}`.

## Pipeline

### Stage 0 — Pre-flight
Run these yourself; if any fails, stop and list every failure in one message.

**Resolve the prototype source:**
```bash
PROTO="${PROVIDED:-./project}"
case "$PROTO" in
  http://*|https://*) echo "MODE=url" ;;
  *) if [ -e "$PROTO" ]; then echo "MODE=local PATH=$PROTO"; else echo "MODE=missing PATH=$PROTO"; fi ;;
esac
```
- `MODE=missing` → stop: "No prototype found. Provide a Claude Design URL, a path to a standalone
  .html / downloaded project directory, or place the project at `./project`."

**Python 3.9+:**
```bash
python3 -c "import sys; assert sys.version_info >= (3,9); print('Python OK', sys.version.split()[0])"
```

**Chrome** (needed for the confirmation walks unless the project has no renderable HTML):
```bash
ls "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" 2>/dev/null \
  || which google-chrome 2>/dev/null || which chromium 2>/dev/null || echo "CHROME_NOT_FOUND"
```
If `CHROME_NOT_FOUND`: stop and tell the user to install Chrome or set `CHROME_PATH`.

**Locate this pipeline's scripts:**
```bash
find .claude/skills/feature-catalog/scripts ~/.claude/skills/feature-catalog/scripts \
     feature-catalog/skills/feature-catalog/scripts \
     -name "walk_prototype.py" 2>/dev/null | head -1
```
If nothing is found, stop: "feature-catalog scripts not found — ensure
`skills/feature-catalog/scripts/{walk_prototype.py,extract_bundle.py,compute_coverage.py,feature_list.py}`
are present." Set `SCRIPTS` to that directory.

**Scratch dir:** `mkdir -p .specwork/catalog`

Print one confirmation line, then proceed:
> Pre-flight OK — Python ✓ Chrome ✓ scripts ✓ source=<url|local:\<path\>> ✓ Starting feature-catalog…

### Stage 1 — Resolve & extract source
1. Obtain the HTML at `/tmp/prototype.html`:
   - **URL mode:** WebFetch the URL; if not a success status, stop and report it. Then
     `curl -L -o /tmp/prototype.html "<url>"`.
   - **Local mode:** resolve a standalone `.html` (prefer `*standalone*.html`, else an HTML
     carrying `__bundler/manifest`, else the largest `.html`, skipping `node_modules`) and copy to
     `/tmp/prototype.html`. If none exists but unpacked source does, copy that to `/tmp/proto-src`.
2. Extract source:
   ```bash
   python3 "$SCRIPTS/extract_bundle.py" /tmp/prototype.html /tmp/proto-src
   ```
   - Exit 0 → source available (normal **source-first** path).
   - Exit 2 → **not a bundler export**: no source. Set `FALLBACK=1` (see Stage 3 fallback) — the
     pipeline will discover from a blind walk instead.
   - Any other non-zero → stop and report.

### Stage 1.5 — Context (optional, inline)
If `resources_path` exists and is non-empty, write a short terminology digest to
`.specwork/context.md` inline (Read/Glob/Grep). No dependency on any other pipeline. Skip silently
otherwise.

### Stage 2 — Source map
Delegate **source-mapper** with:
- `src_dir`: `/tmp/proto-src` (say if absent / `FALLBACK=1`)
- `walk_dir`: `/tmp/proto-walk` (used only in fallback)
- `context_path`: `.specwork/context.md` (mention if absent)
- `output_path`: `.specwork/catalog/map.json`

**If `FALLBACK=1`** (no source): first do a blind walk so the mapper has something to read —
```bash
python3 "$SCRIPTS/walk_prototype.py" /tmp/prototype.html --out /tmp/proto-walk --inventory
python3 "$SCRIPTS/walk_prototype.py" /tmp/prototype.html --out /tmp/proto-walk \
  --max-screens 200 --depth 8 --per-screen 50
```
then run source-mapper in fallback mode (it sets `"unmapped": true`). Carry an "UNMAPPED —
discovered without source" caveat into the final report.

Read `.specwork/catalog/map.json`. Confirm it is valid JSON with a non-empty `entities` array
(each entity having `slug`, `name`, `role`, `features`). If empty/invalid, stop and report.

### Stage 3 — Targeted confirmation walks
**Skip this stage entirely if `unmapped: true`** (the fallback already walked in Stage 2). Print:
> ⟳ S3 — confirming features with scoped walks (one short headless-Chrome walk per entry point).
> No live output appears until each walk returns.

Collect the distinct `entry_hint` paths from `map.json` (`entities[].features[].entry_hint`),
dedupe, and drop empties. For each distinct entry-hint, run a **scoped** walk that accumulates
into `/tmp/proto-walk`:
```bash
python3 "$SCRIPTS/walk_prototype.py" /tmp/prototype.html --out /tmp/proto-walk \
  --nav "<comma-joined entry_hint labels>" --max-screens 40 --depth 4 --per-screen 30
```
- A walk whose `--nav` path is not clickable prints an error and exits non-zero — record that
  entry-hint as **unreached** (its features stay Partial) and continue; do not stop the pipeline.
- Cap total scoped walks at the number of distinct entry-hints; if that exceeds ~30, walk the 30
  covering the most features and **log** which entry-hints were skipped.
- Confirm `/tmp/proto-walk/index.json` exists with at least one screen after the batch.

### Stage 4 — Per-entity lifecycle analysis (parallel)
Print: `⟳ S4 — <N> entity analysts running in parallel; no live output until all return`.
For each entity in `map.json`, delegate **entity-lifecycle-analyst** (in parallel) with:
- `entity_name`, `entity_slug`, `role` (from the entity entry)
- `map_path`: `.specwork/catalog/map.json`
- `evidence_screens`: the walk `.txt` files relevant to this entity (from `/tmp/proto-walk/index.json`
  — match by the entity's `entry_hint` paths / titles; pass all if unsure)
- `walk_dir`: `/tmp/proto-walk`
- `src_dir`: `/tmp/proto-src` (mention if absent)
- `context_path`: `.specwork/context.md` (mention if absent)
- `output_path`: `.specwork/catalog/ent_<entity_slug>.json`

Wait for all. Confirm each `ent_<slug>.json` exists. If any worker produced nothing, stop and name
the entity.

### Stage 4.5 — Normalize coverage (deterministic)
```bash
python3 "$SCRIPTS/compute_coverage.py" .specwork/catalog
```
Source of truth for all coverage numbers; rewrites each `ent_<slug>.json`'s `coverage` from its
capability statuses. A stderr warning about out-of-set statuses means re-delegate that analyst.

### Stage 5 — Synthesis
Delegate **gap-synthesizer** with:
- `catalog_dir`: `.specwork/catalog/`
- `app_name`, `app_slug`
- `prototype_source`: the resolved URL or path
- `unverified`: true only if `unmapped` (no source) — carry the caveat
- `context_path`: `.specwork/context.md` (mention if absent)
- `catalog_md_path`: `.specwork/catalog/entity-catalog.md`
- `report_json_path`: `.specwork/catalog/entities-report.json`

It writes the catalog + report and assigns each entity a logical `group`. Confirm both files exist.

### Stage 5.5 — Feature list (deterministic)
```bash
python3 "$SCRIPTS/feature_list.py" .specwork/catalog/entities-report.json \
  .specwork/catalog/features.md
```
Renders the implemented-feature list (present + partial, grouped by logical group). Confirm
`features.md` exists.

### Stage 6 — Publish
```bash
mkdir -p catalog/<app_slug>
cp .specwork/catalog/entity-catalog.md     catalog/<app_slug>/entity-catalog.md
cp .specwork/catalog/entities-report.json  catalog/<app_slug>/entities.json
cp .specwork/catalog/features.md           catalog/<app_slug>/features.md
```

## Progress reporting
After each stage, print a compact progress block:
```
━━ feature-catalog: <app_slug> ━━━━━━━━━━━━━━━━━━━━━━━━━━
  <s0>  S0   Pre-flight
  <s1>  S1   Source extracted (<source|no-source fallback>)
  <s2>  S2   Mapped — <N> entities, <F> features
  <s3>  S3   Confirmation walks <done>/<hints> ✓ | skipped (fallback)
  <s4>  S4   Entity analysts <done>/<N> ✓
  <s45> S4.5 Coverage normalized
  <s5>  S5   Synthesized — coverage <present>/<expected_total>
  <s55> S5.5 Feature list
  <s6>  S6   Published
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```
Symbols: `✓` done `⟳` in progress `○` pending `✗` failed. Stages 3 and 4 are silent across the
Task boundary — set that expectation before each.

## Stop rules
- No prototype and `./project` absent → stop, ask for a URL or path.
- URL fetch error → stop and report.
- `extract_bundle.py` non-zero other than exit 2 → stop and report.
- `map.json` empty / invalid → stop and report (nothing mapped).
- Confirmation walks produced no screens AND not in fallback → stop and report.
- A worker produced no output file → stop, name the worker/entity.

## Reporting
When done: the output dir, the three files produced, entity count, overall coverage
(present/partial/missing of expected_total), entities with the biggest gaps, the count of
implemented features in `features.md`, whether the run was UNMAPPED (no source), and any
unreached entry-hints / failed workers. One short paragraph plus those numbers.
````

- [ ] **Step 2: Verify structure and worker-input consistency**

Run:
```bash
python3 - <<'EOF'
import pathlib
t = pathlib.Path("feature-catalog/skills/feature-catalog/SKILL.md").read_text()
assert t.startswith("---\n")
fm = t.split("---\n", 2)[1]
assert "name: feature-catalog" in fm and "description:" in fm
for s in ["source-mapper", "entity-lifecycle-analyst", "gap-synthesizer",
          "map.json", "map_path", "entry_hint", "--nav",
          "compute_coverage.py", "feature_list.py", "extract_bundle.py", "walk_prototype.py",
          "entity-catalog.md", "entities.json", "features.md",
          "### Stage 2 — Source map", "### Stage 3 — Targeted confirmation walks",
          "### Stage 5.5 — Feature list", "FALLBACK", "unmapped"]:
    assert s in t, f"orchestrator missing: {s}"
# correct ordering of the source-first stages
order = ["### Stage 1 — Resolve", "### Stage 2 — Source map",
         "### Stage 3 — Targeted confirmation walks", "### Stage 4 — Per-entity",
         "### Stage 4.5", "### Stage 5 — Synthesis", "### Stage 5.5", "### Stage 6 — Publish"]
idx = [t.index(s) for s in order]
assert idx == sorted(idx), "stages out of order"
# no retired/foreign refs
for bad in ["entity-discoverer", "group_screens", "module-cataloger", "catalog-synthesizer",
            "prototype-to-spec/scripts"]:
    assert bad not in t, f"references retired/foreign: {bad}"
assert "skills/feature-catalog/scripts" in t
print("VERIFY_OK")
EOF
```
Expected: `VERIFY_OK`.

- [ ] **Step 3: Commit**

```bash
git add feature-catalog/skills/feature-catalog/SKILL.md
git commit -m "feat(feature-catalog): source-first orchestrator (map -> scoped walks -> analyze)"
```

---

## Task 6: Update the pipeline README

**Files:**
- Modify (full rewrite): `feature-catalog/README.md`

**Interfaces:** documentation only.

- [ ] **Step 1: Overwrite README.md**

Overwrite `feature-catalog/README.md` with exactly:
```markdown
# feature-catalog

A self-contained pipeline that turns a **Claude Design prototype** — a design URL
or a local prototype path (default `./project`) — into a **VMS entity-lifecycle
gap analysis** plus an **implemented-features list**.

It maps the app from its extracted **source first** (the authority for what
exists), then drives the walker **surgically per feature** to confirm what is
actually reachable: render-confirmed → Present, in-source-but-unreached →
Partial, VMS-expected-but-absent → Missing. If the prototype has no extractable
source, it falls back to a blind walk and flags the run UNMAPPED.

Where `spec-pipeline` goes **deep on one feature**, this analyses **every
entity's lifecycle across the whole app**. It depends on nothing in
`spec-pipeline` — it ships its own scripts.

## Skill (`skills/`)

| Skill | Purpose |
|-------|---------|
| `feature-catalog` | Orchestrator: extract source → map → scoped confirmation walks → analyse each entity → normalize coverage → synthesize → feature list → publish. |

Scripts under `skills/feature-catalog/scripts/`:
- `extract_bundle.py` — extract source assets from a standalone export.
- `walk_prototype.py` — render-walk the prototype in headless Chrome (used scoped, per feature).
- `compute_coverage.py` — deterministically recompute per-entity coverage.
- `feature_list.py` — render the implemented-features markdown, grouped by logical entity group.

## Agents (`agents/`)

| Agent | Role |
|-------|------|
| `source-mapper` | Read extracted source → `map.json` (nav, entities, per-feature entry-hints, states). Authority for what exists; falls back to walk-based discovery with no source. |
| `entity-lifecycle-analyst` | Per entity: source map = exists; walk confirms reachability → Present/Partial/Missing → `ent_<slug>.json` (parallel, one per entity). |
| `gap-synthesizer` | Merge per-entity analyses → `entity-catalog.md` + `entities.json`; assign each entity a logical group. |

## Pipeline flow

```
extract source → source-mapper (map.json) → scoped confirmation walks (per entry-hint)
   → entity-lifecycle-analyst (per entity) → compute_coverage → gap-synthesizer
   → feature_list → publish to catalog/<app_slug>/
```

## Output

- `catalog/<app_slug>/entity-catalog.md` — per-entity lifecycle catalog (Present/Partial/Missing).
- `catalog/<app_slug>/entities.json` — structured report with per-entity + overall coverage and logical groups.
- `catalog/<app_slug>/features.md` — implemented features (present + partial), grouped by logical entity group.
```

- [ ] **Step 2: Verify**

Run:
```bash
python3 - <<'EOF'
import pathlib
t = pathlib.Path("feature-catalog/README.md").read_text()
for s in ["source-mapper", "entity-lifecycle-analyst", "gap-synthesizer",
          "feature_list.py", "features.md", "map.json", "source first", "UNMAPPED"]:
    assert s in t, f"README missing: {s}"
for bad in ["module-cataloger", "catalog-synthesizer", "group_screens", "entity-discoverer"]:
    assert bad not in t, f"README still references retired: {bad}"
print("VERIFY_OK")
EOF
```
Expected: `VERIFY_OK`.

- [ ] **Step 3: Commit**

```bash
git add feature-catalog/README.md
git commit -m "docs(feature-catalog): update README for source-first flow"
```

---

## Task 7: Retire `entity-discoverer` + final sweep

**Files:**
- Delete: `feature-catalog/agents/entity-discoverer/` (dir) — its walk-based discovery is absorbed into `source-mapper`'s fallback mode.

- [ ] **Step 1: Delete the retired agent**

```bash
git rm -r feature-catalog/agents/entity-discoverer
```

- [ ] **Step 2: Verify retirement + independence + script set**

Run:
```bash
echo "=== entity-discoverer gone? ==="
[ -e feature-catalog/agents/entity-discoverer ] && echo "STILL PRESENT" || echo "gone"
echo "=== no live references to entity-discoverer ==="
grep -RnE "entity-discoverer" feature-catalog/ && echo "FOUND_REFERENCE (must fix)" || echo "NO_REFERENCES"
echo "=== independence (runtime) ==="
grep -RnE "prototype-to-spec/scripts|spec-pipeline/" feature-catalog/ && echo "RUNTIME_DEP" || echo "INDEPENDENT_OK"
echo "=== scripts present ==="
ls feature-catalog/skills/feature-catalog/scripts/*.py
echo "=== agents present ==="
ls feature-catalog/agents/
echo "=== feature_list tests still pass ==="
( cd feature-catalog/skills/feature-catalog/scripts && python3 -m unittest test_feature_list test_compute_coverage 2>&1 | tail -1 )
```
Expected: `gone`; `NO_REFERENCES`; `INDEPENDENT_OK`; scripts list `compute_coverage.py extract_bundle.py feature_list.py walk_prototype.py` (+ test files); agents list `entity-lifecycle-analyst gap-synthesizer source-mapper`; tests `OK`.

- [ ] **Step 3: Commit**

```bash
git add -A feature-catalog
git commit -m "refactor(feature-catalog): retire entity-discoverer (absorbed into source-mapper)"
```

---

## Self-Review

**Spec coverage** (design → task):
- Source-first map authority, `map.json` shape, nav entry-hints, fallback → Task 2 (source-mapper) + Task 5 (orchestrator FALLBACK + Stage 2).
- Scoped per-feature confirmation walks via `--nav` → Task 5 Stage 3.
- Analyst keys off source map; present=rendered / partial=source-unreached / missing=expected-absent → Task 3.
- Coverage normalization unchanged → reused in Task 5 Stage 4.5 (compute_coverage.py untouched).
- Synthesizer assigns logical group → Task 4.
- Deterministic feature list (Approach B), implemented-only, partial-flagged, grouped → Task 1 + Task 5 Stage 5.5.
- Publish three outputs → Task 5 Stage 6.
- README + retire entity-discoverer → Tasks 6, 7.

**Type/contract consistency:** `map.json` shape (Task 2) consumed by orchestrator Stage 3 (`entry_hint`) and analyst `map_path` (Tasks 3, 5). `ent_<slug>.json` shape unchanged → `compute_coverage.py`/`gap-synthesizer` untouched. `entities-report.json` gains `group` (Task 4) consumed by `feature_list.py` (Task 1) and rendered in Stage 5.5 (Task 5). `feature_list.py` CLI `<report_json> <out_md>` matches Stage 5.5 invocation. Orchestrator passes each worker exactly its declared inputs (verified by Task 5 Step 2). Retired `entity-discoverer` absent from SKILL/README (Tasks 5, 6 assertions) and tree (Task 7 sweep).

**Placeholder scan:** none — full code/tests inline; every verification step has an exact command and expected output.

**Note on edit-anchor tasks (3, 4):** target existing lines by quoted content (line numbers drift); the Step-N assertions confirm the inserts/replacements landed.

**Note on test style:** only `feature_list.py` carries new logic (TDD unittest). The agents/orchestrator are prose verified by structural assertions (red before the edit, green after). End-to-end behavior is validated by a real pipeline run after the plan completes.
