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

**Chrome** (needed for Stage 3 confirmation walks unless the project has no renderable HTML):
```bash
ls "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" 2>/dev/null \
  || which google-chrome 2>/dev/null || which chromium 2>/dev/null || echo "CHROME_NOT_FOUND"
```
If `CHROME_NOT_FOUND`: issue a WARNING — Chrome is required only if Stage 3 confirmation walks will run. Source-only runs (no walkable HTML) will skip Stage 3 and proceed normally. If the run does need Chrome and it is missing, the hard stop happens at the start of Stage 3.

**Locate this pipeline's scripts:**
```bash
SCRIPTS=$(dirname "$(find .claude/skills/feature-catalog/scripts ~/.claude/skills/feature-catalog/scripts \
     feature-catalog/skills/feature-catalog/scripts \
     -name "walk_prototype.py" 2>/dev/null | head -1)")
echo "SCRIPTS=$SCRIPTS"
```
If nothing is found (or `$SCRIPTS` is empty or "."), stop: "feature-catalog scripts not found — ensure
`skills/feature-catalog/scripts/{walk_prototype.py,extract_bundle.py,compute_coverage.py,feature_list.py}`
are present."

**Scratch dir:** `mkdir -p .specwork/catalog`

Print one confirmation line, then proceed:
> Pre-flight OK — Python ✓ Chrome ✓ scripts ✓ source=<url|local:\<path\>> ✓ Starting feature-catalog…

### Stage 1 — Resolve & extract source
1. Obtain the HTML at `/tmp/prototype.html`:
   - **URL mode:** WebFetch the URL; if not a success status, stop and report it. Then
     `curl -L -o /tmp/prototype.html "<url>"`.
   - **Local mode:** resolve a standalone `.html` (prefer `*standalone*.html`, else an HTML
     carrying `__bundler/manifest`, else the largest `.html`, skipping `node_modules`) and copy to
     `/tmp/prototype.html`. If a renderable HTML is found, proceed to step 2 (extract).
     
     **Branch: if NO renderable HTML but unpacked source exists** (a project dir with modules/`_template.html`): copy that source to `/tmp/proto-src`, set `unverified=true` ("renders unconfirmed — no walkable HTML"), **SKIP step 2 (extract_bundle) and SKIP Stage 3 (walks)**, but **run Stage 2 source-mapper normally** (map.json stays `unmapped:false`; features cannot be render-confirmed). Carry the caveat into the final report.

   > **Optional — render flag-gated features.** Many capabilities come back Partial only because
   > their feature flags default OFF. To have the walk render everything, first produce an
   > all-flags-ON copy and use it as `/tmp/prototype.html` for the rest of the run:
   > ```bash
   > python3 "$SCRIPTS/enable_all_features.py" /tmp/prototype.html --out /tmp/prototype.all.html
   > cp /tmp/prototype.all.html /tmp/prototype.html   # walk the seeded copy
   > ```
   > It injects a pre-boot localStorage seed (feature-flags + the per-org config stores those
   > flags mirror from); the original file is untouched. Prototype-specific — currently tuned to
   > the Flex Work VMS store layout. Skip for non-Flex-Work prototypes.

2. Extract source (only if a renderable HTML was found):
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

### Stage 3 — Targeted confirmation walks
**Skip this stage entirely if `unmapped: true`** (the fallback already walked in Stage 2). 

**Chrome gate:** If `CHROME_NOT_FOUND` from Stage 0 and this run is NOT source-only (has renderable HTML), stop now: "Confirmation walks need Chrome. Install Chrome or set CHROME_PATH."

Print:
> ⟳ S3 — confirming features with scoped walks (one short headless-Chrome walk per entry point).
> No live output appears until each walk returns.

Start from an empty walk directory:
```bash
rm -rf /tmp/proto-walk
```

Use the `walk_targets` from `map.json` (the normalized, deduped clickable paths from Stage 2.5).
For each target (a list of nav labels), run a **scoped** walk that accumulates into `/tmp/proto-walk`:
```bash
python3 "$SCRIPTS/walk_prototype.py" /tmp/prototype.html --out /tmp/proto-walk --append \
  --nav '<JSON array of this target's labels, e.g. ["Settings","Rate automation","Uploads"]>' \
  --max-screens 40 --depth 4 --per-screen 30
```
(`--append` makes each scoped walk accumulate into the shared `/tmp/proto-walk` index instead of overwriting it; the first walk simply creates it. Pass each `walk_targets` entry (a list of labels) as a JSON array to `--nav` — the walker parses a JSON array, which safely carries labels containing commas; do not comma-join.)
- A walk whose `--nav` path is not clickable prints an error and exits non-zero — record that
  target as **unreached** (its features stay Partial) and continue; do not stop the pipeline.
- Cap total scoped walks at the number of `walk_targets`; if that exceeds ~30, walk the 30 whose
  paths cover the most features and **log** which targets were skipped.
- Confirm `/tmp/proto-walk/index.json` exists with at least one screen after the batch.

### Stage 4 — Per-unit lifecycle analysis (entities + config areas, parallel)
Print: `⟳ S4 — <N> analysts running in parallel; no live output until all return`. Both domain
entities and config areas are analyzed by the same worker (config areas capabilities-only).
For each entity in `map.json`, delegate **entity-lifecycle-analyst** (in parallel) with:
- `entity_name`, `entity_slug`, `role` (from the entity entry)
- `map_path`: `.specwork/catalog/map.json`
- `unit_kind`: `entity`
- `evidence_screens`: the walk `.txt` files relevant to this entity (from `/tmp/proto-walk/index.json`
  — match by the entity's `entry_path` paths / titles; pass all if unsure). In a source-only run (no walk), there are no walk files — pass an empty list; the analyst then marks render-status features Partial.
- `walk_dir`: `/tmp/proto-walk`
- `src_dir`: `/tmp/proto-src` (mention if absent)
- `context_path`: `.specwork/context.md` (mention if absent)
- `output_path`: `.specwork/catalog/ent_<entity_slug>.json`

**Also, for each config area in `map.json`'s `config_areas`**, delegate **entity-lifecycle-analyst**
in the same parallel batch with the same inputs, except:
- `entity_name`, `entity_slug`, `role` come from the config-area entry (`role` = its `purpose`)
- `unit_kind`: `config_area`
- `output_path`: `.specwork/catalog/ent_<config_area_slug>.json`
- `evidence_screens`: walk `.txt` files whose `path` matches the config area's feature `entry_path`s

Config areas have no `entry_hint`/`entry_path` collisions with entities by construction (the
source-mapper suffixes a colliding config slug with `_cfg`); if two output paths still collide,
append `_cfg` to the config area's slug — both the `entity_slug` passed to the analyst (so its
internal `slug` stays unique) and the `ent_<slug>.json` filename. Wait for ALL analyst dispatches (entities + config
areas) before continuing; confirm every expected `ent_<slug>.json` exists.

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
- `unverified`: true if the run was source-only (no walkable HTML, skipped Stage 3) OR unmapped (no source) — i.e. whenever renders did not confirm features. Keep `unmapped` as its own separate caveat in the final report for no-source fallback runs.
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
  <s25> S2.5 Hints normalized — <T> walk targets
  <s3>  S3   Confirmation walks <done>/<targets> ✓ | skipped (fallback)
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
