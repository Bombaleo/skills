# Feature-Catalog Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a self-contained `feature-catalog` pipeline that walks a whole Claude Design VMS prototype and produces a breadth-first, module → feature catalog (one line per feature).

**Architecture:** A sibling to `spec-pipeline` living in `feature-catalog/`. An orchestrator skill runs the prototype walk once (using its own copies of the walk scripts), groups screens by top-level nav into modules (via a new tested `group_screens.py`), fans out one `module-cataloger` worker per module in parallel, then a `catalog-synthesizer` worker assembles the final `feature-catalog.md` + `features.json`. No runtime dependency on `spec-pipeline`.

**Tech Stack:** Python 3.9+ (stdlib only) for the scripts; Markdown skill/agent definitions (Claude Code skills + Task subagents); headless Chrome via the Chrome DevTools Protocol (driven by `walk_prototype.py`).

**Design doc:** `docs/superpowers/specs/2026-06-25-feature-catalog-pipeline-design.md`

## Global Constraints

- **Python:** 3.9+ — every `.py` file must run under 3.9 and import stdlib only (no third-party packages).
- **Independence:** No file under `feature-catalog/` may reference, import, or path into `spec-pipeline/`, `prototype-to-spec`, or `~/.claude/skills/prototype-to-spec` at runtime. Scripts are located only under `feature-catalog`'s own `skills/feature-catalog/scripts/` (or its installed equivalents `.claude/skills/feature-catalog/scripts`, `~/.claude/skills/feature-catalog/scripts`).
- **Walk scripts are byte-identical copies** of the `prototype-to-spec` originals at copy time (provenance), then evolve independently.
- **Catalog scope:** breadth only — feature **name + one-sentence description**, never acceptance criteria, use cases, or deep flows. Catalog only what is in the prototype; never invent features; no gap analysis against a canonical VMS set.
- **Example-data rule:** sample values shown in the prototype (names, amounts, dates) describe field *format/structure* only — never treat them as required or enumerated values.
- **Output prose rules:** English only; no checkboxes; no `<details>`; behavioral altitude (WHAT not HOW — no file paths, endpoints, schema, column names) in `feature-catalog.md`.
- **Default `app_slug`:** `vms`. Final output dir: `catalog/<app_slug>/`.
- **Intermediate dir:** `.specwork/catalog/` (gitignored). Walk/source live in `/tmp/proto-walk` and `/tmp/proto-src`.

---

## File Structure

```
feature-catalog/
  README.md                                      # Task 6
  skills/feature-catalog/
    SKILL.md                                      # Task 5 — orchestrator
    scripts/
      walk_prototype.py                           # Task 1 — copy
      extract_bundle.py                           # Task 1 — copy
      group_screens.py                            # Task 2 — new, tested
      test_group_screens.py                       # Task 2 — unittest
  agents/
    module-cataloger/
      module-cataloger.md                         # Task 3 — worker agent
      README.md                                   # Task 3
    catalog-synthesizer/
      catalog-synthesizer.md                      # Task 4 — worker agent
      README.md                                   # Task 4
```

---

## Task 1: Copy the walk scripts into the pipeline (independence)

**Files:**
- Create: `feature-catalog/skills/feature-catalog/scripts/walk_prototype.py` (copy of `spec-pipeline/skills/prototype-to-spec/scripts/walk_prototype.py`)
- Create: `feature-catalog/skills/feature-catalog/scripts/extract_bundle.py` (copy of `spec-pipeline/skills/prototype-to-spec/scripts/extract_bundle.py`)

**Interfaces:**
- Produces: two executable scripts at the paths above. `extract_bundle.py <html> <out_dir>` (exit 0 ok / 1 bad input / 2 no bundler manifest). `walk_prototype.py <html> --out DIR [--inventory] [--nav "A,B"] [--max-screens N] [--depth N] [--per-screen N] [--timeout N]`, producing `inventory.json`, `index.json` (`{"screens":[{id,title,path,png,txt,n_clickables,truncated_expand}], "aliases":[...]}`), `skipped.json`, and per-screen `NNN_<slug>.{png,txt}`. Tasks 2 and 5 rely on the `index.json` shape.

- [ ] **Step 1: Create the scripts directory and copy both files**

```bash
mkdir -p feature-catalog/skills/feature-catalog/scripts
cp spec-pipeline/skills/prototype-to-spec/scripts/walk_prototype.py \
   feature-catalog/skills/feature-catalog/scripts/walk_prototype.py
cp spec-pipeline/skills/prototype-to-spec/scripts/extract_bundle.py \
   feature-catalog/skills/feature-catalog/scripts/extract_bundle.py
chmod +x feature-catalog/skills/feature-catalog/scripts/*.py
```

- [ ] **Step 2: Verify the copies are byte-identical and compile under Python 3.9+**

Run:
```bash
diff -q spec-pipeline/skills/prototype-to-spec/scripts/walk_prototype.py \
        feature-catalog/skills/feature-catalog/scripts/walk_prototype.py \
 && diff -q spec-pipeline/skills/prototype-to-spec/scripts/extract_bundle.py \
        feature-catalog/skills/feature-catalog/scripts/extract_bundle.py \
 && python3 -m py_compile feature-catalog/skills/feature-catalog/scripts/*.py \
 && python3 feature-catalog/skills/feature-catalog/scripts/extract_bundle.py 2>&1 | head -1 \
 && echo "VERIFY_OK"
```
Expected: no `diff` output (identical), no compile error, the `extract_bundle.py` usage/doc line prints (it errors on wrong arg count, which is fine — exit 1), then `VERIFY_OK`.

- [ ] **Step 3: Confirm no copied file references the source pipeline**

Run:
```bash
grep -RnE "prototype-to-spec|spec-pipeline" feature-catalog/skills/feature-catalog/scripts/ \
  && echo "FOUND_REFERENCE (investigate)" || echo "CLEAN"
```
Expected: `CLEAN` (the scripts never name the source pipeline). If `FOUND_REFERENCE`, the only acceptable hits are inside string literals already present in the originals — confirm and continue; otherwise stop.

- [ ] **Step 4: Commit**

```bash
git add feature-catalog/skills/feature-catalog/scripts/walk_prototype.py \
        feature-catalog/skills/feature-catalog/scripts/extract_bundle.py
git commit -m "feat(feature-catalog): vendor own copies of walk scripts"
```

---

## Task 2: `group_screens.py` — group walk screens into top-level-nav modules

This is the one piece of real logic in the pipeline: read the walk's `index.json` and bucket screens by their top-level nav label so the orchestrator can fan out one cataloger per module. Built test-first.

**Files:**
- Create: `feature-catalog/skills/feature-catalog/scripts/group_screens.py`
- Test: `feature-catalog/skills/feature-catalog/scripts/test_group_screens.py`

**Interfaces:**
- Consumes: a walk `index.json` of the shape `{"screens": [{"id": int, "title": str, "path": [str,...], "txt": "NNN_x.txt", ...}], "aliases": [...]}`.
- Produces: CLI `python3 group_screens.py <index.json> [--out groups.json]`. Writes (and prints to stdout) JSON:
  ```json
  {"modules": [
    {"slug": "vendors", "name": "Vendors",
     "screen_ids": [1,2], "screen_files": ["001_x.txt","002_y.txt"]}
  ]}
  ```
  Module assignment: a screen's module = its **first path label** (`path[0]`); a screen with an empty path (the entry/landing screen) is assigned to module name `"Overview"`. `slug` = lowercased, non-alphanumerics collapsed to `_`, trimmed (`re.sub(r"[^a-z0-9]+","_",name.lower()).strip("_")`). Modules are sorted by name; the `Overview` module (entry screen) sorts first if present. Exposes `group_screens(index: dict) -> dict` for direct import by the test.

- [ ] **Step 1: Write the failing test**

Create `feature-catalog/skills/feature-catalog/scripts/test_group_screens.py`:
```python
import unittest
from group_screens import group_screens, slugify


class TestGroupScreens(unittest.TestCase):
    def test_groups_by_first_path_label(self):
        index = {"screens": [
            {"id": 0, "title": "Dashboard", "path": [], "txt": "000_dash.txt"},
            {"id": 1, "title": "Vendor list", "path": ["Vendors"], "txt": "001_v.txt"},
            {"id": 2, "title": "Invite vendor", "path": ["Vendors", "Invite"], "txt": "002_iv.txt"},
            {"id": 3, "title": "Invoices", "path": ["Invoices"], "txt": "003_inv.txt"},
        ]}
        out = group_screens(index)
        mods = {m["name"]: m for m in out["modules"]}
        self.assertEqual(set(mods), {"Overview", "Vendors", "Invoices"})
        self.assertEqual(mods["Vendors"]["screen_ids"], [1, 2])
        self.assertEqual(mods["Vendors"]["screen_files"], ["001_v.txt", "002_iv.txt"])
        self.assertEqual(mods["Overview"]["screen_ids"], [0])

    def test_overview_sorts_first_then_alphabetical(self):
        index = {"screens": [
            {"id": 0, "title": "Home", "path": [], "txt": "000.txt"},
            {"id": 1, "title": "X", "path": ["Zeta"], "txt": "001.txt"},
            {"id": 2, "title": "Y", "path": ["Alpha"], "txt": "002.txt"},
        ]}
        names = [m["name"] for m in group_screens(index)["modules"]]
        self.assertEqual(names, ["Overview", "Alpha", "Zeta"])

    def test_slugify(self):
        self.assertEqual(slugify("Vendor Onboarding"), "vendor_onboarding")
        self.assertEqual(slugify("A/P & Invoicing!"), "a_p_invoicing")

    def test_empty_screens(self):
        self.assertEqual(group_screens({"screens": []}), {"modules": []})


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd feature-catalog/skills/feature-catalog/scripts && python3 -m unittest test_group_screens -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'group_screens'` (or ImportError for `group_screens`/`slugify`).

- [ ] **Step 3: Write the implementation**

Create `feature-catalog/skills/feature-catalog/scripts/group_screens.py`:
```python
#!/usr/bin/env python3
"""Group walk screens into top-level-nav modules for the feature-catalog pipeline.

Reads a walk index.json (produced by walk_prototype.py) and buckets every screen
by its first nav-path label, so the orchestrator can fan out one module-cataloger
per module. The entry screen (empty path) becomes the "Overview" module.

Usage:
    group_screens.py <index.json> [--out groups.json]

Stdlib only, Python >= 3.9.
"""
import argparse
import json
import re
import sys
from pathlib import Path

OVERVIEW = "Overview"


def slugify(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "_", name.lower()).strip("_")


def group_screens(index: dict) -> dict:
    buckets = {}  # name -> {"screen_ids": [...], "screen_files": [...]}
    for s in index.get("screens", []):
        path = s.get("path") or []
        name = path[0] if path else OVERVIEW
        b = buckets.setdefault(name, {"screen_ids": [], "screen_files": []})
        b["screen_ids"].append(s.get("id"))
        if s.get("txt"):
            b["screen_files"].append(s["txt"])

    def sort_key(name):
        return (0, "") if name == OVERVIEW else (1, name.lower())

    modules = [
        {"slug": slugify(name), "name": name,
         "screen_ids": buckets[name]["screen_ids"],
         "screen_files": buckets[name]["screen_files"]}
        for name in sorted(buckets, key=sort_key)
    ]
    return {"modules": modules}


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("index")
    ap.add_argument("--out", default="")
    args = ap.parse_args()
    index = json.loads(Path(args.index).read_text())
    out = group_screens(index)
    text = json.dumps(out, indent=2)
    if args.out:
        Path(args.out).write_text(text)
    print(text)
    return 0


if __name__ == "__main__":
    sys.exit(main())
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd feature-catalog/skills/feature-catalog/scripts && python3 -m unittest test_group_screens -v`
Expected: `Ran 4 tests` — `OK`.

- [ ] **Step 5: Smoke-test the CLI on a fixture**

Run:
```bash
cd feature-catalog/skills/feature-catalog/scripts
printf '%s' '{"screens":[{"id":0,"title":"Home","path":[],"txt":"000.txt"},{"id":1,"title":"V","path":["Vendors"],"txt":"001.txt"}]}' > /tmp/idx.json
python3 group_screens.py /tmp/idx.json | python3 -c "import json,sys;d=json.load(sys.stdin);print('MODULES',[m['slug'] for m in d['modules']])"
```
Expected: `MODULES ['overview', 'vendors']`

- [ ] **Step 6: Commit**

```bash
git add feature-catalog/skills/feature-catalog/scripts/group_screens.py \
        feature-catalog/skills/feature-catalog/scripts/test_group_screens.py
git commit -m "feat(feature-catalog): group walk screens into nav modules"
```

---

## Task 3: `module-cataloger` worker agent

**Files:**
- Create: `feature-catalog/agents/module-cataloger/module-cataloger.md`
- Create: `feature-catalog/agents/module-cataloger/README.md`

**Interfaces:**
- Consumes (inputs the orchestrator passes in Task 5): `module_name`, `module_slug`, `screen_files` (list of `.txt` filenames within `walk_dir`), `walk_dir` (`/tmp/proto-walk`), `src_dir` (`/tmp/proto-src`, may be absent), `context_path` (`.specwork/context.md`, may be absent), `output_path` (`.specwork/catalog/mod_<slug>.json`).
- Produces: `.specwork/catalog/mod_<slug>.json` of shape:
  ```json
  {"slug": "vendors", "name": "Vendors",
   "features": [{"name": "Invite vendor", "description": "...", "screens": ["001_v.txt"]}]}
  ```
  Task 4 (synthesizer) reads every `mod_*.json` of this shape.

- [ ] **Step 1: Write the agent definition**

Create `feature-catalog/agents/module-cataloger/module-cataloger.md`:
````markdown
---
name: module-cataloger
description: >
  Catalogs the user-facing features of ONE module of a walked prototype. Reads only the
  walk outlines for its assigned screens (plus matching source) and emits a breadth-first
  feature list — feature name + one-sentence description + originating screens — as
  mod_<slug>.json. Worker for the feature-catalog pipeline; not for standalone use.
tools: Read, Glob, Grep, Write, Bash
---

You are the **module-cataloger**. You catalog the user-facing features of **one module**
of a prototype that has already been walked. You do not walk anything yourself.

## Inputs

- **module_name** (required): the module's display name, e.g. `"Vendors"`.
- **module_slug** (required): snake_case slug, e.g. `vendors`.
- **screen_files** (required): the list of `.txt` outline filenames in `walk_dir` that belong
  to this module.
- **walk_dir** (required): directory of walk outputs (default `/tmp/proto-walk`).
- **src_dir** (optional): extracted prototype source (default `/tmp/proto-src`). May be absent.
- **context_path** (optional): `.specwork/context.md`. Terminology alignment only.
- **output_path** (required): where to write the module JSON, `.specwork/catalog/mod_<slug>.json`.

## Task

### 1. Read the assigned screens
Read each file in `screen_files` from `walk_dir`. These outlines list each screen's title,
headings, fields, buttons, and tables. Treat them as the source of truth for what the module
does.

### 2. Cross-reference source (only if `src_dir` present)
Grep the source under `src_dir` for the module's labels to catch features the render may not
surface (e.g. validation-gated actions, bulk operations behind a menu). Use it to *confirm*
features, not to invent ones. **On any conflict, the rendered walk wins.**

### 3. Reconcile terminology (only if `context_path` present)
If `.specwork/context.md` exists, prefer the project's terminology for feature and entity
names. Never add a feature that is not present in the prototype just because context mentions it.

### 4. Identify the module's features
A **feature** is a distinct thing a user can do or see in this module — a coherent capability,
not an individual button. Examples: "Invite a vendor", "Filter vendors by status", "View vendor
scorecard". Merge trivial sub-actions into the capability they belong to. Aim for breadth: list
every distinct feature once, but do not split one capability into many micro-entries.

For each feature record:
- `name`: a short imperative or noun phrase, VMS-appropriate.
- `description`: ONE sentence on what it lets the user do. No acceptance criteria, no steps.
- `screens`: the `screen_files` entries where it appears (for traceability).

### 5. Write the module JSON
Write `output_path` exactly:

```json
{
  "slug": "<module_slug>",
  "name": "<module_name>",
  "features": [
    { "name": "Invite vendor",
      "description": "Sends an onboarding invitation to a new vendor by email.",
      "screens": ["001_vendors.txt"] }
  ]
}
```

**Rules:**
- Breadth only — name + one sentence. No acceptance criteria, flows, or edge cases.
- Catalog only what the prototype shows. Never invent features.
- **Example-data rule:** sample values describe field format only, never required/enumerated values.
- English only. Valid JSON (no trailing commas, no comments).

## Return

Reply with: the `output_path`, the feature count, and a one-line summary of the module's scope.
````

- [ ] **Step 2: Write the README**

Create `feature-catalog/agents/module-cataloger/README.md`:
```markdown
# module-cataloger

Catalogs the user-facing features of **one module** of a walked prototype. Reads
only the walk outlines for its assigned screens (plus matching source when
present) and writes a breadth-first feature list — name + one-sentence
description + originating screens — to `mod_<slug>.json`. Worker agent for the
feature-catalog pipeline; not for standalone use.

**Tools:** Read, Glob, Grep, Write, Bash
```

- [ ] **Step 3: Verify structure**

Run:
```bash
python3 - <<'EOF'
import re, pathlib
p = pathlib.Path("feature-catalog/agents/module-cataloger/module-cataloger.md")
t = p.read_text()
assert t.startswith("---\n"), "missing frontmatter"
fm = t.split("---\n", 2)[1]
assert "name: module-cataloger" in fm, "wrong/missing name"
assert "tools:" in fm, "missing tools"
for s in ["## Inputs", "## Task", "## Return", "output_path", "mod_<slug>.json"]:
    assert s in t, f"missing section/keyword: {s}"
assert "prototype-to-spec" not in t and "spec-pipeline" not in t, "references source pipeline"
assert "acceptance criteria" not in t.lower() or "No acceptance criteria" in t, "altitude leak"
print("VERIFY_OK")
EOF
```
Expected: `VERIFY_OK`.

- [ ] **Step 4: Commit**

```bash
git add feature-catalog/agents/module-cataloger/
git commit -m "feat(feature-catalog): add module-cataloger worker agent"
```

---

## Task 4: `catalog-synthesizer` worker agent

**Files:**
- Create: `feature-catalog/agents/catalog-synthesizer/catalog-synthesizer.md`
- Create: `feature-catalog/agents/catalog-synthesizer/README.md`

**Interfaces:**
- Consumes: `catalog_dir` (`.specwork/catalog/`, containing `mod_*.json` written by Task 3), `app_name`, `app_slug`, `prototype_source` (the URL or path string, for provenance), `unverified` (boolean — true in source-only mode), `context_path` (optional), and output paths `catalog_md_path` (`.specwork/catalog/catalog.md`), `features_json_path` (`.specwork/catalog/features.json`).
- Produces: `.specwork/catalog/catalog.md` and `.specwork/catalog/features.json` (shape shown below). Task 5 publishes both.

- [ ] **Step 1: Write the agent definition**

Create `feature-catalog/agents/catalog-synthesizer/catalog-synthesizer.md`:
````markdown
---
name: catalog-synthesizer
description: >
  Merges all per-module mod_*.json files from the feature-catalog pipeline into the final
  deliverable: feature-catalog.md (a VMS-framed, module -> feature catalog with one line per
  feature) and features.json (structured index). Dedups cross-cutting features. Worker for the
  feature-catalog pipeline; not for standalone use.
tools: Read, Glob, Grep, Write
---

You are the **catalog-synthesizer**. You assemble the final feature catalog from the per-module
JSON files the module-catalogers produced. You read no walk output and walk nothing.

## Inputs

- **catalog_dir** (required): directory holding `mod_*.json` files, e.g. `.specwork/catalog/`.
- **app_name** (required): display name of the application, e.g. `"VMS"`.
- **app_slug** (required): snake_case slug, default `vms`.
- **prototype_source** (required): the URL or local path the catalog was generated from (provenance).
- **unverified** (optional, default false): when true, the prototype was not rendered
  (source-only mode) — add an "UNVERIFIED — generated without rendering" note to the intro.
- **context_path** (optional): `.specwork/context.md`. Terminology alignment only.
- **catalog_md_path** (required): output path for the Markdown catalog.
- **features_json_path** (required): output path for the JSON index.

## Task

### 1. Read all module files
Read every `mod_*.json` in `catalog_dir`. Each has `{slug, name, features:[{name, description,
screens}]}`. Skip any file that fails to parse and note it in your return.

### 2. Dedup cross-cutting features
A **cross-cutting** feature is one that appears (by the same or clearly equivalent name) in
**three or more** modules — e.g. global search, export, notifications. Lift each such feature
into a single "Cross-cutting capabilities" group and remove it from the individual modules.
Features appearing in one or two modules stay within their module(s). Judge equivalence on
meaning, not exact string match ("Export to CSV" ≈ "Export").

### 3. Write features.json
Write `features_json_path`:

```json
{
  "app": "<app_slug>",
  "generated_from": "<prototype_source>",
  "modules": [
    { "slug": "vendors", "name": "Vendors",
      "features": [{ "name": "Invite vendor", "description": "...", "screens": ["001_v.txt"] }] }
  ],
  "cross_cutting": [
    { "name": "Global search", "description": "...", "modules": ["Vendors", "Invoices"] }
  ]
}
```
`cross_cutting` may be an empty array. Preserve module order as given by sorted `mod_*.json`
filenames (the orchestrator named them so `mod_overview.json`-style entry sorts naturally).

### 4. Write feature-catalog.md
Write `catalog_md_path`:

```markdown
# <app_name> — Feature Catalog

<One paragraph framing the application as a Vendor Management System (VMS) and summarizing
its breadth: how many modules, the kinds of work it supports. If `unverified` is true, begin
the paragraph with "**UNVERIFIED — generated without rendering.**">

## <Module name>
- **<Feature name>** — <one-sentence description>.
- ...

## Cross-cutting capabilities
- **<Feature name>** — <one-sentence description> (appears across <Module>, <Module>).
- ...
```

Omit the "Cross-cutting capabilities" section entirely if there are none. List modules in the
same order as `features.json`.

**Rules:**
- Behavioral altitude: WHAT not HOW. No file paths, endpoints, schema, column names.
- One line per feature. No acceptance criteria, no steps, no nested bullets per feature.
- English only. No checkboxes. No `<details>`. No internal repo links.
- Frame names in VMS terminology where the prototype supports it; never invent features.

## Return

Reply with: both output paths, the module count, total feature count, the count of cross-cutting
features lifted, and any `mod_*.json` files that failed to parse.
````

- [ ] **Step 2: Write the README**

Create `feature-catalog/agents/catalog-synthesizer/README.md`:
```markdown
# catalog-synthesizer

Merges all per-module `mod_*.json` files into the final deliverable:
`feature-catalog.md` (a VMS-framed, module → feature catalog, one line per
feature) and `features.json` (structured index). Dedups cross-cutting features
into their own group. Worker agent for the feature-catalog pipeline; not for
standalone use.

**Tools:** Read, Glob, Grep, Write
```

- [ ] **Step 3: Verify structure**

Run:
```bash
python3 - <<'EOF'
import pathlib
t = pathlib.Path("feature-catalog/agents/catalog-synthesizer/catalog-synthesizer.md").read_text()
assert t.startswith("---\n"), "missing frontmatter"
fm = t.split("---\n", 2)[1]
assert "name: catalog-synthesizer" in fm and "tools:" in fm
for s in ["## Inputs", "## Task", "## Return", "features.json", "feature-catalog.md",
          "Cross-cutting", "unverified"]:
    assert s in t, f"missing: {s}"
assert "prototype-to-spec" not in t and "spec-pipeline" not in t, "references source pipeline"
print("VERIFY_OK")
EOF
```
Expected: `VERIFY_OK`.

- [ ] **Step 4: Commit**

```bash
git add feature-catalog/agents/catalog-synthesizer/
git commit -m "feat(feature-catalog): add catalog-synthesizer worker agent"
```

---

## Task 5: `feature-catalog` orchestrator skill

**Files:**
- Create: `feature-catalog/skills/feature-catalog/SKILL.md`

**Interfaces:**
- Consumes: user inputs `prototype`, `app_slug` (default `vms`), `resources_path` (default `./resources/`). Locates its own scripts (Task 1, Task 2). Dispatches `module-cataloger` (Task 3) and `catalog-synthesizer` (Task 4) via the Task tool, passing exactly the inputs their `## Inputs` sections name.
- Produces: `catalog/<app_slug>/feature-catalog.md` and `catalog/<app_slug>/features.json`.

- [ ] **Step 1: Write the orchestrator skill**

Create `feature-catalog/skills/feature-catalog/SKILL.md`:
````markdown
---
name: feature-catalog
description: >
  Orchestrates a self-contained pipeline that walks a whole Claude Design prototype — a design
  URL or a local prototype path (default ./project) — and produces a breadth-first feature
  catalog of the application framed as a VMS (Vendor Management System): every user-facing
  feature, grouped by module, one line each. Use when the user wants a full inventory of what a
  prototype implements — "catalog the features in this prototype", "list everything this VMS
  app does", "build a feature catalog from this design". Delegates to two workers:
  module-cataloger (one per module, in parallel) and catalog-synthesizer.
---

# Feature-catalog orchestrator

You are the **orchestrator**. You map a whole prototype's breadth into a feature catalog. You
run the prototype walk yourself (inline, via this pipeline's own scripts), group screens into
modules, fan out one module-cataloger per module, then a single catalog-synthesizer. Keep your
context lean — workers return short summaries and file paths.

This pipeline is **self-contained**: it uses only its own scripts under
`skills/feature-catalog/scripts/` and never reads from `spec-pipeline` or `prototype-to-spec`.

## Inputs

- **prototype** (required): a Claude Design URL (`https://api.anthropic.com/v1/design/...`) or a
  local path to a downloaded prototype project (a standalone `.html` or a directory holding one).
  If neither given, default to `./project`; if that does not exist, **stop and ask**.
- **app_slug** (optional): snake_case output dir name. Default `vms`. Derive `app_name` as a
  display version (e.g. `vms` → `VMS`).
- **resources_path** (optional): directory for terminology context. Default `./resources/`.
  Used only to align names; never adds features. Skipped silently if absent.

## Artifact contract

Intermediate work lives in `.specwork/catalog/` (create if absent; gitignore `.specwork/`). The
walk and source live in `/tmp/`, produced once.

| File | Written by | Read by |
|---|---|---|
| `/tmp/proto-walk/` (walk output) | orchestrator (Stage 1) | module-cataloger |
| `/tmp/proto-src/` (extracted source; may be absent) | orchestrator (Stage 1) | module-cataloger |
| `.specwork/context.md` (optional) | orchestrator (Stage 1.5) | module-cataloger, catalog-synthesizer |
| `.specwork/catalog/groups.json` | orchestrator (Stage 2) | orchestrator |
| `.specwork/catalog/mod_<slug>.json` | module-cataloger | catalog-synthesizer |
| `.specwork/catalog/catalog.md` | catalog-synthesizer | orchestrator (publish) |
| `.specwork/catalog/features.json` | catalog-synthesizer | orchestrator (publish) |

Final output: `catalog/<app_slug>/feature-catalog.md` + `catalog/<app_slug>/features.json`.

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

**Chrome** (needed unless the local project has no renderable HTML):
```bash
ls "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" 2>/dev/null \
  || which google-chrome 2>/dev/null || which chromium 2>/dev/null || echo "CHROME_NOT_FOUND"
```
If `CHROME_NOT_FOUND`: stop and tell the user to install Chrome or set `CHROME_PATH`.

**Locate this pipeline's scripts** (own copies only):
```bash
find .claude/skills/feature-catalog/scripts ~/.claude/skills/feature-catalog/scripts \
     feature-catalog/skills/feature-catalog/scripts \
     -name "walk_prototype.py" 2>/dev/null | head -1
```
If nothing is found, stop: "feature-catalog scripts not found — ensure
`skills/feature-catalog/scripts/walk_prototype.py`, `extract_bundle.py`, and
`group_screens.py` are present." Set `SCRIPTS` to that directory.

**Scratch dir:** `mkdir -p .specwork/catalog`

Print one confirmation line, then proceed:
> Pre-flight OK — Python ✓ Chrome ✓ scripts ✓ source=<url|local:\<path\>> ✓ Starting feature-catalog…

### Stage 1 — Walk the whole app (once)
Print first (this is the long, silent stage):
> ⟳ S1 — walking the full prototype in headless Chrome. Each screen is a full reload (~15–25 s),
> so a whole-app walk takes a while. **No live output appears until the walk finishes.**

1. Obtain the HTML at `/tmp/prototype.html`:
   - **URL mode:** WebFetch the URL; if not a success status, stop and report it. Then
     `curl -L -o /tmp/prototype.html "<url>"`.
   - **Local mode:** resolve a standalone `.html` (prefer `*standalone*.html`, else an HTML
     carrying `__bundler/manifest`, else the largest `.html`, skipping `node_modules`) and copy
     it to `/tmp/prototype.html`. If none exists but unpacked source does
     (`_template.html`/`manifest.json`/`.js`), use **source-only mode**: skip the walk, set
     `unverified=true`, and `cp -R "<path>" /tmp/proto-src`.
2. Extract source (skip in source-only mode):
   ```bash
   python3 "$SCRIPTS/extract_bundle.py" /tmp/prototype.html /tmp/proto-src
   ```
   Exit 2 → walk-only mode (no `/tmp/proto-src`); any other non-zero → stop and report.
3. Deep walk the whole app (skip in source-only mode):
   ```bash
   python3 "$SCRIPTS/walk_prototype.py" /tmp/prototype.html --out /tmp/proto-walk --inventory
   python3 "$SCRIPTS/walk_prototype.py" /tmp/prototype.html --out /tmp/proto-walk \
     --max-screens 200 --depth 8 --per-screen 50
   ```
   (No `--nav` — the whole app is in scope.) Verify `/tmp/proto-walk/index.json` exists and has
   at least one screen; if not, stop and report. In source-only mode there is no walk — carry
   the "UNVERIFIED" caveat to the synthesizer.

### Stage 1.5 — Context (optional, inline)
If `resources_path` exists and is non-empty, skim it (Read/Glob/Grep) and write a short
terminology digest to `.specwork/context.md` (entity/feature naming the project uses). Do **not**
delegate to any spec-pipeline agent. Skip silently if `resources_path` is absent or empty.

### Stage 2 — Group screens into modules
```bash
python3 "$SCRIPTS/group_screens.py" /tmp/proto-walk/index.json \
  --out .specwork/catalog/groups.json
```
Read `.specwork/catalog/groups.json`. Confirm it has a non-empty `modules` array; if empty,
stop and report (the walk produced no usable screens). In source-only mode (no walk), instead
derive a single module `{"slug":"app","name":"App","screen_files":[]}` and pass the source dir
to the cataloger.

### Stage 3 — Module fan-out (parallel)
Print: `⟳ S3 — <N> module catalogers running in parallel; no live output until all return`.

For each module in `groups.json`, delegate **module-cataloger** (in parallel) with:
- `module_name`, `module_slug` (from the module entry)
- `screen_files`: the module's `screen_files`
- `walk_dir`: `/tmp/proto-walk` (omit in source-only mode)
- `src_dir`: `/tmp/proto-src` (mention if absent)
- `context_path`: `.specwork/context.md` (mention if absent)
- `output_path`: `.specwork/catalog/mod_<module_slug>.json`

Wait for all. Confirm each `.specwork/catalog/mod_<slug>.json` exists. If any worker produced
nothing, stop and report which module.

### Stage 4 — Synthesis
Delegate **catalog-synthesizer** with:
- `catalog_dir`: `.specwork/catalog/`
- `app_name`, `app_slug`
- `prototype_source`: the resolved URL or path
- `unverified`: true only in source-only mode
- `context_path`: `.specwork/context.md` (mention if absent)
- `catalog_md_path`: `.specwork/catalog/catalog.md`
- `features_json_path`: `.specwork/catalog/features.json`

Confirm both files exist.

### Stage 5 — Publish
```bash
mkdir -p catalog/<app_slug>
cp .specwork/catalog/catalog.md   catalog/<app_slug>/feature-catalog.md
cp .specwork/catalog/features.json catalog/<app_slug>/features.json
```

## Progress reporting
After each stage, print a compact progress block:
```
━━ feature-catalog: <app_slug> ━━━━━━━━━━━━━━━━━━━━━━━━━━
  <s0>  S0   Pre-flight
  <s1>  S1   Walked — <N> screens, source <extracted|walk-only|source-only>
  <s2>  S2   Grouped — <M> modules
  <s3>  S3   Catalogers <done>/<M> ✓
  <s4>  S4   Synthesized
  <s5>  S5   Published
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```
Symbols: `✓` done `⟳` in progress `○` pending `✗` failed. Stage 1 and Stage 3 are silent across
the Task boundary — set that expectation before each (notices above).

## Stop rules
- No prototype and `./project` absent → stop, ask for a URL or path.
- URL fetch error / no renderable HTML and no unpacked source → stop and report.
- Walk produced no screens → stop and report (`/tmp/proto-walk`).
- `groups.json` has no modules → stop and report.
- A worker produced no output file → stop, name the worker/module.

## Reporting
When done: the output dir (`catalog/<app_slug>/`), the files produced, module count, total
feature count, cross-cutting count, whether the run was UNVERIFIED (source-only), and any
modules/files that failed. One short paragraph plus those numbers.
````

- [ ] **Step 2: Verify structure and input/contract consistency**

Run:
```bash
python3 - <<'EOF'
import pathlib
t = pathlib.Path("feature-catalog/skills/feature-catalog/SKILL.md").read_text()
assert t.startswith("---\n"), "missing frontmatter"
fm = t.split("---\n", 2)[1]
assert "name: feature-catalog" in fm and "description:" in fm
# every worker input the agents require must be named by the orchestrator
for s in ["module_name", "module_slug", "screen_files", "output_path",   # module-cataloger
          "catalog_dir", "app_name", "app_slug", "prototype_source", "unverified",
          "catalog_md_path", "features_json_path",                        # synthesizer
          "group_screens.py", "extract_bundle.py", "walk_prototype.py",   # own scripts
          "feature-catalog.md", "features.json"]:
    assert s in t, f"orchestrator missing: {s}"
# independence: must not point at the source pipeline's scripts
assert "prototype-to-spec/scripts" not in t, "references source pipeline scripts"
assert "skills/feature-catalog/scripts" in t, "does not locate own scripts"
print("VERIFY_OK")
EOF
```
Expected: `VERIFY_OK`.

- [ ] **Step 3: Commit**

```bash
git add feature-catalog/skills/feature-catalog/SKILL.md
git commit -m "feat(feature-catalog): add orchestrator skill"
```

---

## Task 6: Pipeline README + final independence check

**Files:**
- Create: `feature-catalog/README.md`
- Modify: `.gitignore` (ensure `.specwork/` is ignored)

**Interfaces:**
- Consumes: nothing. Produces: documentation only.

- [ ] **Step 1: Write the pipeline README**

Create `feature-catalog/README.md`:
```markdown
# feature-catalog

A self-contained pipeline that turns a **Claude Design prototype** — a design URL
or a local prototype path (default `./project`) — into a **breadth-first feature
catalog** of the whole application, framed as a VMS (Vendor Management System):
every user-facing feature, grouped by module, one line each.

Where `spec-pipeline` goes **deep on one feature**, this goes **broad across the
whole app**. It depends on nothing in `spec-pipeline` — it ships its own walk
scripts.

## Skill (`skills/`)

| Skill | Purpose |
|-------|---------|
| `feature-catalog` | Orchestrator: walk → group → catalog → synthesize → publish. |

Scripts under `skills/feature-catalog/scripts/`:
- `walk_prototype.py` — render-walk the prototype in headless Chrome (own copy).
- `extract_bundle.py` — extract source assets from a standalone export (own copy).
- `group_screens.py` — group walked screens into top-level-nav modules.

## Agents (`agents/`)

| Agent | Role |
|-------|------|
| `module-cataloger` | Catalog one module's features → `mod_<slug>.json` (parallel, one per module). |
| `catalog-synthesizer` | Merge module files → `feature-catalog.md` + `features.json`. |

## Pipeline flow

```
walk (once) → group_screens → module-cataloger (per module)
   → catalog-synthesizer → publish to catalog/<app_slug>/
```

## Output

- `catalog/<app_slug>/feature-catalog.md` — human-readable catalog (default `app_slug=vms`).
- `catalog/<app_slug>/features.json` — structured index.
```

- [ ] **Step 2: Ensure `.specwork/` is gitignored**

Run:
```bash
grep -qxF ".specwork/" .gitignore || printf ".specwork/\n" >> .gitignore
cat .gitignore
```
Expected: `.gitignore` contains a line `.specwork/`.

- [ ] **Step 3: Final independence sweep across the whole pipeline**

Run:
```bash
grep -RnE "prototype-to-spec|spec-pipeline" feature-catalog/ \
  && echo "FOUND (must be inside copied-script string literals only — review)" \
  || echo "INDEPENDENT_OK"
```
Expected: `INDEPENDENT_OK`. If any hit appears, confirm it is only an unchanged string literal inside the copied `walk_prototype.py`/`extract_bundle.py` (none expected) — otherwise fix before committing.

- [ ] **Step 4: Commit**

```bash
git add feature-catalog/README.md .gitignore
git commit -m "docs(feature-catalog): add pipeline README; gitignore .specwork"
```

---

## Self-Review

**Spec coverage** (design doc → task):
- Self-contained pipeline / own scripts → Task 1, Global Constraints, Task 6 sweep.
- `group_screens.py` (top-level nav grouping) → Task 2.
- module-cataloger (breadth, name + 1 sentence + screens) → Task 3.
- catalog-synthesizer (merge, dedup cross-cutting, intro framing, features.json) → Task 4.
- Orchestrator stages 0–5, optional inline context, source-only/UNVERIFIED handling, progress
  block, stop rules → Task 5.
- Output `catalog/<app_slug>/feature-catalog.md` + `features.json`, default `vms` → Tasks 4, 5, 6.
- README + gitignore → Task 6.
- Domain-framing-only / no gap analysis → enforced in agent prose (Tasks 3, 4) and Global Constraints.

**Type/contract consistency:** `mod_<slug>.json` shape produced by Task 3 == read by Task 4. `index.json` shape produced by Task 1 == consumed by Task 2. Orchestrator (Task 5) passes exactly the inputs named in the agents' `## Inputs` (verified by the Task 5 Step 2 assertion). `group_screens.py` CLI/`group_screens()`/`slugify()` names match between Task 2 implementation and test.

**Placeholder scan:** none — every file's full content is inline; every verification step has an exact command and expected output.

**Note on test style:** these deliverables are mostly Markdown agent/skill definitions and stdlib scripts, so "tests" are (a) a real `unittest` suite for `group_screens.py` (Task 2) and (b) structural assertion scripts for each Markdown file that fail before the file exists and pass after — the same red→green loop, appropriate to the artifact.
