# Feature-catalog pipeline — design

**Date:** 2026-06-25
**Status:** Approved (design); pending implementation plan

## Summary

A new pipeline, sibling to the existing `spec-pipeline`, that walks a whole Claude
Design prototype and produces a **standalone, human-readable feature catalog** of the
application — framed as a VMS (Vendor Management System). Where `spec-pipeline` goes
**deep on one feature** (scoped by `target_scope`), this pipeline goes **broad across
the whole app**: every user-facing feature, grouped by module, one line each.

The pipeline is **fully self-contained**: it ships its own copies of the prototype walk
scripts (`walk_prototype.py`, `extract_bundle.py`) and depends on nothing from
`spec-pipeline`. The scripts originate as copies of the `prototype-to-spec` versions but
live inside this pipeline so it can be installed and run on its own.

## Decisions (from brainstorming)

| Question | Decision |
|---|---|
| Primary purpose | **Standalone deliverable** — a human-readable feature catalog of the whole app (breadth over depth), for stakeholders/scoping/backlog seeding. Not primarily a machine pre-step. |
| Catalog structure & granularity | **Module → feature, 1-liner each.** Features grouped under modules; each feature is a name + one-sentence description. Lightest, most scannable shape. |
| Meaning of "treat as VMS" | **Domain framing only** — use VMS terminology and group under typical VMS areas; catalog only what is actually in the prototype. No gap analysis against a canonical VMS feature set. |
| Discovery depth | **Full deep walk** of the whole app (reuse the existing deep walk; surfaces hidden/sub-screen features), accepting it is the slow stage. |
| Module boundary | **Top-level nav (auto)** — modules derived automatically from the prototype's top-level navigation. Fully prototype-driven; no preset buckets. |
| Project context | **Optional** — used only to align terminology when `./resources/` exists; never adds features absent from the prototype. |

## Placement & layout

New top-level folder mirroring `spec-pipeline/`:

```
feature-catalog/
  README.md
  skills/
    feature-catalog/
      SKILL.md                      # the orchestrator skill
      scripts/
        walk_prototype.py           # copy, owned by this pipeline
        extract_bundle.py           # copy, owned by this pipeline
  agents/
    module-cataloger/
      module-cataloger.md
      README.md
    catalog-synthesizer/
      catalog-synthesizer.md
      README.md
```

The walk scripts are **duplicated into this pipeline** so it is fully independent of
`spec-pipeline`. They are copied from `prototype-to-spec/scripts/` at build time. Pre-flight
and Stage 1 locate them under this pipeline's own `skills/feature-catalog/scripts/`
(searched at `.claude/skills/feature-catalog/scripts` and
`~/.claude/skills/feature-catalog/scripts`) — never under `prototype-to-spec`.

## Inputs

- **prototype** (required): a Claude Design URL (`https://api.anthropic.com/v1/design/...`)
  or a local path to a downloaded prototype project (standalone `.html` export or a
  directory containing one). Default `./project` when neither given; stop and ask if
  that does not exist.
- **app_slug** (optional): snake_case name for the output directory. Default `vms`.
- **resources_path** (optional): directory for project context. Default `./resources/`.
  Used only for terminology alignment; skipped silently if absent.

## Artifact contract

Intermediate work lives in `.specwork/catalog/` (create if absent; gitignored). The walk
and source live in `/tmp/`, produced once.

| File | Written by | Read by |
|---|---|---|
| `/tmp/proto-walk/` (walk output) | orchestrator (Stage 1, via walk script) | module-cataloger |
| `/tmp/proto-src/` (extracted source; may be absent) | orchestrator (Stage 1) | module-cataloger |
| `.specwork/context.md` (optional) | orchestrator (inline, Stage 1.5, if resources) | module-cataloger, catalog-synthesizer |
| `.specwork/catalog/mod_<slug>.json` | module-cataloger (one per module) | catalog-synthesizer |
| `.specwork/catalog/catalog.md` | catalog-synthesizer | orchestrator (publish) |
| `.specwork/catalog/features.json` | catalog-synthesizer | orchestrator (publish) |

Final output: `catalog/<app_slug>/feature-catalog.md` + `catalog/<app_slug>/features.json`.

## Pipeline stages

### Stage 0 — Pre-flight
Same checks as `spec-pipeline`: resolve prototype source (URL vs local vs missing),
Python 3.9+, Chrome present (URL/local-HTML mode), `curl` (URL mode), locate the walk
scripts, `mkdir -p .specwork/catalog`. Stop on any failure with all failures listed.

### Stage 1 — Walk the whole app (once)
Reuse `walk_prototype.py`:
1. Resolve the prototype HTML to `/tmp/prototype.html` (URL: WebFetch check then `curl`;
   local: resolve standalone HTML in the directory; source-only fallback if no HTML).
2. Extract source → `/tmp/proto-src` via `extract_bundle.py` (exit 2 → walk-only mode).
3. Inventory: `walk_prototype.py /tmp/prototype.html --out /tmp/proto-walk --inventory`.
4. **Full deep walk** (no `--nav` scope, deep flags `--max-screens 200 --depth 8
   --per-screen 50`) → `/tmp/proto-walk`.

Print the "silent stage" expectation notice before walking (this is the long stage).
Verify `/tmp/proto-walk/index.json` is non-empty. Source-only mode (no renderable HTML)
proceeds with the "UNVERIFIED — generated without rendering" caveat carried forward.

### Stage 1.5 — Context (optional)
If `resources_path` exists, gather a light terminology digest → `.specwork/context.md`
**inline in the orchestrator** (Read/Glob/Grep over the resources dir — no dependency on
`spec-pipeline`'s `context-gatherer`). Skip silently otherwise.

### Stage 2 — Module fan-out
Read `/tmp/proto-walk/index.json` (via `group_screens.py`); group screens by **top-level nav**
label. Dispatch one `module-cataloger` per module **in parallel**, passing the module name and
its screen ids / walk file paths, `walk_dir`, `src_dir`, and `context_path` (if present). Each
writes `.specwork/catalog/mod_<slug>.json`. Wait for all; confirm every module produced its file.

### Stage 3 — Synthesis
Dispatch `catalog-synthesizer`: read all `mod_*.json`, dedup cross-cutting features
(list once), write `catalog.md` (VMS-framed intro + module → feature, one line each) and
`features.json` (structured index). Confirm both exist.

### Stage 4 — Publish (+ optional lint)
```
mkdir -p catalog/<app_slug>
cp .specwork/catalog/catalog.md   catalog/<app_slug>/feature-catalog.md
cp .specwork/catalog/features.json catalog/<app_slug>/features.json
```
Run the spec linter if available (non-blocking).

## New agents

### `module-cataloger` (worker)
- **Does:** given one module (name + list of its screens), reads those walk outlines and
  matching source, and lists the module's distinct user-facing features. Each feature:
  `name`, one-sentence `description`, and `screens` (originating screen labels for
  traceability). Breadth only — no acceptance criteria, no deep flows.
- **Reads:** assigned screen outlines in `walk_dir`, matching modules in `src_dir`,
  `context.md` (terminology, if present).
- **Writes:** `.specwork/catalog/mod_<slug>.json`.
- **Tools:** Read, Glob, Grep, Write, Bash.

### `catalog-synthesizer` (worker)
- **Does:** merges all `mod_*.json` into the final catalog. Dedups features that recur
  across modules (e.g. search, export) into a single listing. Writes a one-paragraph
  intro framing the app as a VMS, then module → feature sections. Emits the structured
  `features.json` index.
- **Reads:** `.specwork/catalog/mod_*.json`, `context.md` (if present).
- **Writes:** `.specwork/catalog/catalog.md`, `.specwork/catalog/features.json`.
- **Tools:** Read, Glob, Grep, Write.

The walk itself is run inline by the orchestrator (Bash + existing scripts), so no third
new agent is required.

## Output formats

### `feature-catalog.md`
```markdown
# <App> — Feature Catalog

<One-paragraph intro framing the application as a VMS and summarizing breadth.>

## <Module name>
- **<Feature name>** — <one-sentence description>.
- ...

## <Module name>
- ...
```

### `features.json`
```json
{
  "app": "vms",
  "generated_from": "<url-or-path>",
  "modules": [
    {
      "slug": "vendor_onboarding",
      "name": "Vendor Onboarding",
      "features": [
        { "name": "Invite vendor", "description": "...", "screens": ["Vendors,Invite"] }
      ]
    }
  ]
}
```

## Stop rules
- No prototype and `./project` absent → stop, ask for URL or path.
- Walk produces no screens (URL fetch error / no HTML) → stop and report (source-only
  mode degrades gracefully rather than stopping when unpacked source exists).
- A `module-cataloger` produces no output file → stop, report which module.
- Synthesizer produces no `catalog.md`/`features.json` → stop, report.

## Independence & provenance
- The pipeline depends on **nothing** in `spec-pipeline` at runtime.
- `walk_prototype.py`, `extract_bundle.py`: copied into
  `feature-catalog/skills/feature-catalog/scripts/` (provenance: `prototype-to-spec`).
  They drift independently after copy.
- Pre-flight, prototype-source-resolution, and "silent stage" notice patterns: adapted
  (text reused), but re-implemented inside this pipeline's own SKILL.md.
- Optional terminology gather is done inline — no shared `context-gatherer` agent.

## Out of scope
- Per-feature acceptance criteria, use cases, scenarios (that is `spec-pipeline`'s job).
- Gap analysis against a canonical VMS feature set.
- Driving `spec-pipeline` automatically from the catalog.
```

