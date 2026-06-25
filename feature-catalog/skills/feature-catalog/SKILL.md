---
name: feature-catalog
description: >
  Orchestrates a self-contained pipeline that walks a whole Claude Design prototype — a design
  URL or a local prototype path (default ./project) — and produces a VMS entity-lifecycle gap
  analysis: every domain entity the prototype works with, each with its expected VMS lifecycle
  (states + create/update/delete/archive and operation capabilities) marked Present / Partial /
  Missing against the prototype. Use when the user wants to know, per object, what a VMS should do
  with it and what this prototype actually does — "analyse the entity lifecycles", "what's missing
  per object", "build an entity gap analysis from this prototype". Delegates to three workers:
  entity-discoverer, entity-lifecycle-analyst (one per entity, in parallel), and gap-synthesizer.
---

# Feature-catalog orchestrator (entity-lifecycle gap analysis)

You are the **orchestrator**. You map a prototype into a per-entity VMS lifecycle gap analysis.
You run the prototype walk yourself (inline, via this pipeline's own scripts), discover the
domain entities, fan out one analyst per entity, then a single synthesizer. Keep your context
lean — workers return short summaries and file paths.

This pipeline is **self-contained**: it uses only its own scripts under
`skills/feature-catalog/scripts/` and never reads from `spec-pipeline` or `prototype-to-spec`.

## Inputs

- **prototype** (required): a Claude Design URL (`https://api.anthropic.com/v1/design/...`) or a
  local path to a downloaded prototype project (a standalone `.html` or a directory holding one).
  If neither given, default to `./project`; if that does not exist, **stop and ask**.
- **app_slug** (optional): snake_case output dir name. Default `vms`. Derive `app_name` as a
  display version.
- **resources_path** (optional): directory for terminology context. Default `./resources/`. Used
  only to align names; never adds entities. Skipped silently if absent.

## Artifact contract

Intermediate work lives in `.specwork/catalog/` (create if absent; gitignore `.specwork/`). The
walk and source live in `/tmp/`, produced once.

| File | Written by | Read by |
|---|---|---|
| `/tmp/proto-walk/` (walk output) | orchestrator (Stage 1) | entity-discoverer, entity-lifecycle-analyst |
| `/tmp/proto-src/` (extracted source; may be absent) | orchestrator (Stage 1) | entity-discoverer, entity-lifecycle-analyst |
| `.specwork/context.md` (optional) | orchestrator (Stage 1.5) | all workers |
| `.specwork/catalog/entities.json` | entity-discoverer | orchestrator, entity-lifecycle-analyst |
| `.specwork/catalog/ent_<slug>.json` | entity-lifecycle-analyst | gap-synthesizer |
| `.specwork/catalog/entity-catalog.md` | gap-synthesizer | orchestrator (publish) |
| `.specwork/catalog/entities-report.json` | gap-synthesizer | orchestrator (publish) |

Final output: `catalog/<app_slug>/entity-catalog.md` + `catalog/<app_slug>/entities.json`.

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
`skills/feature-catalog/scripts/walk_prototype.py` and `extract_bundle.py` are present." Set
`SCRIPTS` to that directory.

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
   at least one screen; if not, stop and report. In source-only mode there is no walk — carry the
   "UNVERIFIED" caveat to the synthesizer. (Walk coverage bounds present/missing accuracy: the
   richer the walk, the fewer false "missing" verdicts.)

### Stage 1.5 — Context (optional, inline)
If `resources_path` exists and is non-empty, skim it (Read/Glob/Grep) and write a short
terminology digest to `.specwork/context.md` (entity naming the project uses). Do **not** delegate
to any spec-pipeline agent. Skip silently if absent or empty.

### Stage 2 — Discover entities
Delegate **entity-discoverer** with:
- `walk_dir`: `/tmp/proto-walk` (in source-only mode there is no walk — say so; it works from src)
- `src_dir`: `/tmp/proto-src` (mention if absent)
- `context_path`: `.specwork/context.md` (mention if absent)
- `output_path`: `.specwork/catalog/entities.json`

Read `.specwork/catalog/entities.json`. Confirm it is valid JSON and a non-empty array, each
entry having `slug`, `name`, `role`, `evidence_screens`. If empty/invalid, stop and report (no
entities discovered).

### Stage 3 — Per-entity lifecycle analysis (parallel)
Print: `⟳ S3 — <N> entity analysts running in parallel; no live output until all return`.

For each entity in `entities.json`, delegate **entity-lifecycle-analyst** (in parallel) with:
- `entity_name`, `entity_slug`, `role` (from the entity entry)
- `evidence_screens`: the entity's `evidence_screens`
- `walk_dir`: `/tmp/proto-walk` (omit in source-only mode)
- `src_dir`: `/tmp/proto-src` (mention if absent)
- `context_path`: `.specwork/context.md` (mention if absent)
- `output_path`: `.specwork/catalog/ent_<entity_slug>.json`

Wait for all. Confirm each `.specwork/catalog/ent_<slug>.json` exists. If any worker produced
nothing, stop and name the entity.

### Stage 4 — Synthesis
Delegate **gap-synthesizer** with:
- `catalog_dir`: `.specwork/catalog/`
- `app_name`, `app_slug`
- `prototype_source`: the resolved URL or path
- `unverified`: true only in source-only mode
- `context_path`: `.specwork/context.md` (mention if absent)
- `catalog_md_path`: `.specwork/catalog/entity-catalog.md`
- `report_json_path`: `.specwork/catalog/entities-report.json`

Confirm both files exist.

### Stage 5 — Publish
```bash
mkdir -p catalog/<app_slug>
cp .specwork/catalog/entity-catalog.md     catalog/<app_slug>/entity-catalog.md
cp .specwork/catalog/entities-report.json  catalog/<app_slug>/entities.json
```

## Progress reporting
After each stage, print a compact progress block:
```
━━ feature-catalog: <app_slug> ━━━━━━━━━━━━━━━━━━━━━━━━━━
  <s0>  S0   Pre-flight
  <s1>  S1   Walked — <N> screens, source <extracted|walk-only|source-only>
  <s2>  S2   Entities discovered — <M>
  <s3>  S3   Entity analysts <done>/<M> ✓
  <s4>  S4   Synthesized — coverage <present>/<expected_total>
  <s5>  S5   Published
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```
Symbols: `✓` done `⟳` in progress `○` pending `✗` failed. Stage 1 and Stage 3 are silent across
the Task boundary — set that expectation before each (notices above).

## Stop rules
- No prototype and `./project` absent → stop, ask for a URL or path.
- URL fetch error / no renderable HTML and no unpacked source → stop and report.
- Walk produced no screens → stop and report (`/tmp/proto-walk`).
- `entities.json` empty / invalid → stop and report (no entities discovered).
- A worker produced no output file → stop, name the worker/entity.

## Reporting
When done: the output dir (`catalog/<app_slug>/`), the files produced, entity count, overall
coverage (present / partial / missing of expected_total), the entities with the biggest gaps,
whether the run was UNVERIFIED (source-only), and any entities/files that failed. One short
paragraph plus those numbers.
