# Feature-catalog pipeline — entity-lifecycle redesign

**Date:** 2026-06-25
**Status:** Approved (design); supersedes the module/feature approach in
`2026-06-25-feature-catalog-pipeline-design.md`

## Summary

The `feature-catalog` pipeline is **redefined** from a module/feature breadth catalog into an
**entity-lifecycle gap analysis**. It walks a whole Claude Design prototype (a VMS app),
discovers the domain entities actually present, and for each entity lays out its **expected**
VMS lifecycle — domain states + transitions and the operations/features a VMS commonly needs —
then checks each expected capability against the prototype and marks it **Present / Partial /
Missing**. The deliverable tells you, per entity, what a VMS should do with that object and what
this prototype actually does.

This **supersedes** the module-centric build: `module-cataloger`, `catalog-synthesizer`, and
`group_screens.py` (+ its test) are retired. The vendored walk scripts, Stage 0 pre-flight, and
Stage 1 (full walk + source extraction) are unchanged.

## Decisions (from brainstorming)

| Question | Decision |
|---|---|
| Output intent | **Expected set + present/missing** — per entity, enumerate the lifecycle operations + commonly-required VMS features, and mark each Present / Partial / Missing against the prototype. A gap analysis. |
| Entity discovery | **Prototype-discovered only** — entities come from the walk/source; gap analysis covers missing *features* on those entities, not missing entities. |
| Lifecycle model | **Operations + domain states** — both CRUD/archive operations AND the entity's VMS status lifecycle (states + transition actions). |
| Expected-feature source | **Agent VMS domain reasoning** — no shipped taxonomy; the per-entity analyst reasons from VMS domain knowledge. Each Missing must justify why it's commonly expected. |
| Relationship to prior build | **Replace** — the pipeline becomes entity-centric; the module approach is retired. |

## Placement & layout (after redesign)

```
feature-catalog/
  README.md                                     # updated for entity-centric flow
  skills/feature-catalog/
    SKILL.md                                     # rewritten orchestrator (entity flow)
    scripts/
      walk_prototype.py                          # unchanged (vendored)
      extract_bundle.py                          # unchanged (vendored)
      # group_screens.py + test_group_screens.py REMOVED
  agents/
    entity-discoverer/
      entity-discoverer.md
      README.md
    entity-lifecycle-analyst/
      entity-lifecycle-analyst.md
      README.md
    gap-synthesizer/
      gap-synthesizer.md
      README.md
    # module-cataloger/ and catalog-synthesizer/ REMOVED
```

Independence is unchanged: no runtime dependency on `spec-pipeline`/`prototype-to-spec`.

## Inputs

- **prototype** (required): Claude Design URL or local path (standalone `.html` / project dir);
  default `./project`; stop and ask if absent.
- **app_slug** (optional): output dir name. Default `vms`. `app_name` is a display form.
- **resources_path** (optional): `./resources/`; inline terminology gather only; skipped if absent.

## Artifact contract

Intermediate work lives in `.specwork/catalog/` (gitignored). Walk/source in `/tmp/`, once.

| File | Written by | Read by |
|---|---|---|
| `/tmp/proto-walk/` (walk output) | orchestrator (Stage 1) | entity-discoverer, entity-lifecycle-analyst |
| `/tmp/proto-src/` (extracted source; may be absent) | orchestrator (Stage 1) | entity-discoverer, entity-lifecycle-analyst |
| `.specwork/context.md` (optional) | orchestrator (inline, Stage 1.5) | entity-discoverer, entity-lifecycle-analyst, gap-synthesizer |
| `.specwork/catalog/entities.json` (entity list) | entity-discoverer | orchestrator, entity-lifecycle-analyst |
| `.specwork/catalog/ent_<slug>.json` | entity-lifecycle-analyst (one per entity) | gap-synthesizer |
| `.specwork/catalog/entity-catalog.md` | gap-synthesizer | orchestrator (publish) |
| `.specwork/catalog/entities-report.json` | gap-synthesizer | orchestrator (publish) |

Final output: `catalog/<app_slug>/entity-catalog.md` + `catalog/<app_slug>/entities.json`.

(Note: the discoverer's working list is `entities.json` inside `.specwork`; the published index
is also named `entities.json` in `catalog/<app_slug>/` but is the synthesizer's
`entities-report.json` content. The orchestrator copies `entities-report.json` →
`catalog/<app_slug>/entities.json` at publish.)

## Pipeline stages

### Stage 0 — Pre-flight
Unchanged: resolve prototype source, Python 3.9+, Chrome, locate this pipeline's own scripts
(`walk_prototype.py`, `extract_bundle.py` — `group_screens.py` no longer required), `mkdir -p
.specwork/catalog`. Stop on any failure.

### Stage 1 — Walk the whole app (once)
Unchanged from the prior design: resolve HTML → `/tmp/prototype.html`; extract source →
`/tmp/proto-src`; inventory then full deep walk (`--max-screens 200 --depth 8 --per-screen 50`,
no `--nav`) → `/tmp/proto-walk`. Print the silent-stage notice. Source-only mode carries the
UNVERIFIED caveat. (A constrained walk budget under-covers screens; a richer walk improves
present/missing accuracy. Per-nav-section walking remains a possible future enhancement.)

### Stage 1.5 — Context (optional, inline)
If `resources_path` exists, write a short terminology digest to `.specwork/context.md` inline.
Skip silently otherwise. No dependency on any other pipeline.

### Stage 2 — Discover entities
Delegate **entity-discoverer**. It reads the walk outlines + source and returns
`.specwork/catalog/entities.json`: an array of
`{slug, name, role, evidence_screens:[...]}` for every domain entity actually present
(prototype-discovered only). Confirm the file is valid JSON and non-empty; if empty, stop and
report (the walk found no entities). In source-only mode it works from source alone.

### Stage 3 — Per-entity lifecycle analysis (fan-out, parallel)
For each entity in `entities.json`, delegate **entity-lifecycle-analyst** in parallel with:
`entity_name`, `entity_slug`, `role`, `evidence_screens`, `walk_dir`, `src_dir` (mention if
absent), `context_path` (mention if absent), `output_path: .specwork/catalog/ent_<slug>.json`.

Each analyst:
1. Derives the entity's **expected** VMS lifecycle from domain reasoning: domain **states** +
   **transition actions**, and **capabilities** across categories (create, read/view,
   update, delete, archive, list/search, state-transition, and entity-specific operations).
2. Gathers prototype **evidence**: reads its `evidence_screens` in `walk_dir`, greps `src_dir`
   for the entity's terms.
3. Marks each expected capability **Present** (directly evidenced), **Partial** (related
   affordance seen, operation unconfirmed), or **Missing** (expected in a VMS, no evidence) —
   every Missing names *why it is commonly expected*.
4. Writes `ent_<slug>.json` (shape below).

Wait for all; confirm each `ent_<slug>.json` exists. If any analyst produced nothing, stop and
name the entity.

### Stage 4 — Synthesis
Delegate **gap-synthesizer** with `catalog_dir`, `app_name`, `app_slug`, `prototype_source`,
`unverified`, `context_path`, `catalog_md_path: .specwork/catalog/entity-catalog.md`,
`report_json_path: .specwork/catalog/entities-report.json`. It merges all `ent_*.json`, computes
per-entity and overall coverage, writes the catalog + JSON report. Confirm both exist.

### Stage 5 — Publish
```
mkdir -p catalog/<app_slug>
cp .specwork/catalog/entity-catalog.md     catalog/<app_slug>/entity-catalog.md
cp .specwork/catalog/entities-report.json  catalog/<app_slug>/entities.json
```
Optional lint (non-blocking).

## Agents

### `entity-discoverer` (worker)
- **Does:** reads the walk outlines + source, identifies every domain entity present (grounded
  in the prototype — never invents entities), gives each a slug, name, one-line VMS role, and the
  screen files that evidence it.
- **Reads:** `walk_dir`, `src_dir` (if present), `context.md` (terminology, if present).
- **Writes:** `.specwork/catalog/entities.json`.
- **Tools:** Read, Glob, Grep, Write, Bash.

### `entity-lifecycle-analyst` (worker, fan-out one per entity)
- **Does:** for one entity, derives the expected VMS lifecycle (states + transitions) and
  capabilities from domain reasoning, checks each against prototype evidence, marks Present /
  Partial / Missing with evidence and (for Missing) a justification.
- **Reads:** assigned `evidence_screens` in `walk_dir`, `src_dir` (if present), `context.md`.
- **Writes:** `.specwork/catalog/ent_<slug>.json`.
- **Tools:** Read, Glob, Grep, Write, Bash.

### `gap-synthesizer` (worker)
- **Does:** merges all `ent_*.json` into `entity-catalog.md` (VMS-framed intro + per-entity
  sections) and `entities-report.json` (structured mirror), computing per-entity and overall
  coverage. Orders entities by coverage gap or by role grouping (entities with the most missing
  capabilities surface clearly).
- **Reads:** `.specwork/catalog/ent_*.json`, `context.md` (if present).
- **Writes:** `.specwork/catalog/entity-catalog.md`, `.specwork/catalog/entities-report.json`.
- **Tools:** Read, Glob, Grep, Write.

## Output formats

### `entity-catalog.md`
```markdown
# <App> — VMS Entity Lifecycle Catalog

<One paragraph: frames the app as a VMS, lists the entities found, and states overall coverage —
"N entities; M of K expected capabilities present (P partial, X missing)". If unverified,
begin with "**UNVERIFIED — generated without rendering.**">

## Requisition — <one-line role in the VMS>
**Lifecycle states:** draft → open → partially-filled → filled → closed
  (observed: open, filled, closed · expected-but-unseen: draft, cancelled)
**Capabilities:**
- ✅ Create requisition — present (screens: 007_requisitions)
- ✅ View list / detail — present
- ⚠️ Edit requisition — partial (view seen; edit affordance not confirmed)
- ❌ Archive requisition — missing (VMS commonly archives closed reqs for audit/reuse)
- ❌ Clone / reuse — missing (common VMS accelerator for recurring demand)
**Coverage:** 6 / 10 present (1 partial, 3 missing)

## Worker — ...
...
```
Status glyphs: `✅` present, `⚠️` partial, `❌` missing. One line per capability. English only;
no checkboxes; behavioral altitude (no file paths/endpoints/schema).

### `entities.json` (published; synthesizer's `entities-report.json`)
```json
{
  "app": "vms",
  "generated_from": "<url-or-path>",
  "overall_coverage": { "present": 0, "partial": 0, "missing": 0, "expected_total": 0 },
  "entities": [
    {
      "slug": "requisition",
      "name": "Requisition",
      "role": "A staffing order for one or more positions at a client site.",
      "states": { "observed": ["open","filled","closed"],
                  "expected": ["draft","open","partially-filled","filled","closed","cancelled"],
                  "missing": ["draft","cancelled"] },
      "transitions": [{ "from": "open", "to": "filled", "action": "fulfil positions", "status": "present" }],
      "capabilities": [
        { "name": "Create requisition", "category": "create", "status": "present",
          "evidence": ["007_requisitions.txt"], "note": "" },
        { "name": "Archive requisition", "category": "archive", "status": "missing",
          "evidence": [], "note": "VMS commonly archives closed reqs for audit/reuse." }
      ],
      "coverage": { "present": 6, "partial": 1, "missing": 3, "expected_total": 10 }
    }
  ]
}
```
`category` ∈ create | read | update | delete | archive | list_search | state_transition | other.

## Status semantics
- **Present** — directly evidenced in walk/source.
- **Partial** — related affordance seen, the operation itself not confirmed.
- **Missing** — expected for this entity in a VMS, no evidence; must carry a one-line
  justification for why it is commonly expected.

## Stop rules
- No prototype and `./project` absent → stop, ask for URL or path.
- URL fetch error / no renderable HTML and no source → stop.
- Walk produced no screens → stop.
- `entities.json` empty / invalid → stop (no entities discovered).
- A worker produced no output file → stop, name the worker/entity.

## Retirement / migration
- Delete `feature-catalog/agents/module-cataloger/`, `feature-catalog/agents/catalog-synthesizer/`,
  `feature-catalog/skills/feature-catalog/scripts/group_screens.py`, and
  `feature-catalog/skills/feature-catalog/scripts/test_group_screens.py`.
- Rewrite `SKILL.md` and `README.md` for the entity-centric flow.
- The `catalog/vms/feature-catalog.md` test artifact (module-centric) is obsolete; regenerate as
  `entity-catalog.md` if a fresh test run is desired.

## Out of scope
- Missing *entities* (we flag missing features on present entities only).
- A curated/shipped VMS taxonomy (expected sets come from agent reasoning).
- Per-feature acceptance criteria / use cases (that is `spec-pipeline`'s job).
