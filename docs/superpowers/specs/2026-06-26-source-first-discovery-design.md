# Feature-catalog — source-first discovery + feature-list output

**Date:** 2026-06-26
**Status:** Approved (design)
**Builds on / revises:** `2026-06-25-feature-catalog-entity-lifecycle-redesign.md` and
`2026-06-25-deterministic-coverage-design.md`

## Problem

The pipeline's front half does a blind headless-Chrome BFS walk first, then derives everything
from it. End-to-end testing exposed the failure modes: on a dashboard-rooted app the walk spends
its budget on dashboard content before reaching product areas (modules/entities got one screen
each), and a long blind walk is slow and crash-prone (the Rate Automation walk died on a Chrome
`ConnectionResetError` after 37 screens). Meanwhile the **extracted source is richer than the
render** — it contains the full nav structure, entities, per-feature actions, validation rules,
and literal lifecycle state machines (e.g. an upload flow `Uploading → Ready to validate →
Validating → Errors found → Validated → Applied → Upload failed`), including states the walk may
never reach.

## Decision

Invert discovery: **read the source first to build a map of what exists, then drive the walker
surgically per feature** using nav entry-points the map provides. Also add an **implemented
feature-list output** (`features.md`) rendered deterministically and grouped by logical entity
groups.

| Question | Decision |
|---|---|
| Authority for what exists vs. status | **Source maps, walk confirms.** Source is the authority for what EXISTS; the targeted walk confirms reachability. Render-confirmed → **Present**; in-source-but-not-reached → **Partial**; VMS-expected-but-absent-from-source → **Missing**. |
| Discovery strategy | **Source map → targeted scoped walks** (Approach A). One scoped walk per feature/screen entry-hint, not one blind BFS. |
| Walker steering | The source map supplies **nav click-path labels** per entry-hint; the existing walker's `--nav`/`--only` consume them. **No new walker capability.** (A minimal `--append` accumulation mode was later added to the walker so successive scoped walks share one /tmp/proto-walk index — this is an accumulation fix, not a new steering/navigation capability.) (If a prototype ever used real URL/hash routing instead of click-nav, that's a future walker mode — out of scope here.) |
| Source not extractable | **Fallback** to the current walk-first discovery (blind walk → walk-based discovery), carrying an "unmapped — discovered by walk only" caveat. |
| Feature-list output | **Approach B**: synthesizer assigns each entity a logical group; a deterministic `feature_list.py` renders `features.md` from the report (implemented = present + partial-flagged), grouped by logical entity group. **Markdown now; PDF a future stage.** |

## Pipeline shape (revised front half)

```
Stage 0  Pre-flight (unchanged: resolve source, Python, Chrome, locate scripts)
Stage 1  Extract source  -> /tmp/proto-src   (existing extract_bundle.py)
            └─ if not a bundler export (exit 2) → FALLBACK to walk-first (see below)
Stage 2  Source map (source-mapper agent)  -> .specwork/catalog/map.json   [authority]
Stage 3  Targeted walks (walk_prototype.py --nav per entry-hint) -> /tmp/proto-walk
Stage 4  Per-entity analysis (entity-lifecycle-analyst, revised) -> ent_<slug>.json
Stage 4.5 Normalize coverage (compute_coverage.py)               [existing]
Stage 5  Synthesis (gap-synthesizer): catalog + report + per-entity logical group
Stage 5.5 Feature list (feature_list.py) -> features.md          [Approach B, deterministic]
Stage 6  Publish: entity-catalog.md, entities.json, features.md
```

## Components

### New: `source-mapper` agent (replaces walk-based `entity-discoverer`)
- **Reads:** `/tmp/proto-src` (extracted JS/HTML modules + `_template.html` + `manifest.json`),
  `context.md` (terminology, if present).
- **Produces:** `.specwork/catalog/map.json` — the authority for what exists:
  ```json
  {
    "nav": [{"label": "Agencies", "path": ["Agencies"]}, ...],
    "entities": [
      { "slug": "rate_card", "name": "Rate Card", "role": "...",
        "states": ["draft","active","superseded","archived"],
        "transitions": [{"from":"draft","to":"active","action":"apply"}],
        "features": [
          { "name": "Upload rate card", "category": "create",
            "evidence_source": ["010_463be867.js"],
            "entry_hint": ["Settings","Rate automation","Upload"] }
        ] }
    ]
  }
  ```
  Each feature carries a **source citation** and an **entry_hint** (nav click-path labels) for the
  walker. States/transitions are taken from source where literally defined.
- **Rules:** prototype-grounded (only what source contains; never invents); on terminology, defer
  to `context.md`. Skip minified vendor modules (license-header first line, very long lines).
- **Tools:** Read, Glob, Grep, Write, Bash.

### Revised: orchestrator Stage 3 — targeted walks
- Read `map.json`. Collect the distinct `entry_hint` paths (dedupe). For each, run:
  ```bash
  python3 "$SCRIPTS/walk_prototype.py" /tmp/prototype.html --out /tmp/proto-walk \
    --nav "<comma-joined entry_hint labels>" --max-screens 40 --depth 4 --per-screen 30
  ```
  Walks accumulate into `/tmp/proto-walk` (the walker appends screens; each scoped walk is
  short). Cap the number of scoped walks (e.g. ≤ the count of distinct entry-hints; log if more).
  A scoped walk whose nav path isn't clickable is recorded as a reachability failure for that
  feature (→ its features stay Partial), not a hard stop.
- **Why scoped, not blind:** each feature gets a fair, bounded walk from its own entry point;
  total render time scales with features-of-interest, not with whatever the dashboard links to.
- Rename note: this is multiple short walks rather than one long one; the "silent stage" notice
  still applies, now per batch.

### Revised: `entity-lifecycle-analyst`
- **New inputs:** `map_path` (`.specwork/catalog/map.json`) — its entity's source-derived
  features, states, and entry-hints — plus the targeted walk output and `src_dir`.
- **Revised task:** the source map is the authority for the entity's existing feature set; the
  analyst (1) marks each source feature **Present** if render-confirmed in the walk, else
  **Partial** (in source, not reached/rendered — cite why); (2) still applies VMS domain reasoning
  to add expected-but-absent features as **Missing** (absent from source), each justified. States:
  `observed` = render-confirmed, `expected` = source states ∪ domain-expected, `missing` =
  expected − present-in-source. Output shape unchanged (`ent_<slug>.json`) so Stage 4.5/5 are
  untouched.

### New: `feature_list.py` (Approach B, deterministic)
- **CLI:** `feature_list.py <report_json> <out_md>`.
- Reads `entities-report.json` (which now carries a `group` per entity from the synthesizer).
  Renders `features.md`: title + one-line intro, then **logical groups** (ordered), each with its
  entities, each listing **implemented** capabilities — `status in {present, partial}` only,
  `partial` flagged — `missing` excluded. Guarantees every present/partial capability appears.
- **Functions for tests:** `implemented_features(entity) -> list`, `group_entities(report) ->
  ordered groups`, `render_markdown(report) -> str`.
- Stdlib only, Py3.9+.

### Revised: `gap-synthesizer`
- Additionally assign each entity a `group` (logical domain group, e.g. "Sourcing & Demand",
  "Workforce & Compliance", "Financials", "Supply", "Configuration") in `entities-report.json`.
  Grouping is the synthesizer's judgment; the feature-list rendering is deterministic.

### Fallback (source not extractable)
If `extract_bundle.py` exits 2 (not a bundler export) or there is no renderable source, the
pipeline reverts to **walk-first**: blind full walk (`--max-screens 200 --depth 8 --per-screen
50`) → a walk-based entity discovery (the prior `entity-discoverer` behavior, retained as the
fallback path inside `source-mapper`: "if no source, discover from the walk instead and mark the
map `unmapped: true`"). The "Present/Partial/Missing" semantics degrade gracefully: with no source
authority, Present = rendered, Missing = domain-expected-not-rendered, and a prominent
"UNMAPPED — discovered without source" caveat is carried into the catalog.

## Artifact contract (additions/changes)

| File | Written by | Read by |
|---|---|---|
| `.specwork/catalog/map.json` | source-mapper | orchestrator (Stage 3), entity-lifecycle-analyst |
| `/tmp/proto-walk/` (now from scoped walks) | orchestrator (Stage 3) | entity-lifecycle-analyst |
| `.specwork/catalog/ent_<slug>.json` | entity-lifecycle-analyst | compute_coverage, gap-synthesizer |
| `.specwork/catalog/entities-report.json` (now with `group` per entity) | gap-synthesizer | feature_list.py, publish |
| `.specwork/catalog/features.md` | feature_list.py | publish |

Final output: `catalog/<app_slug>/{entity-catalog.md, entities.json, features.md}`.

## Testing
- `feature_list.py`: unittest — every present/partial capability rendered; missing excluded;
  partial flagged; groups ordered; an entity with no `group` falls back to a default group;
  empty report → header only.
- `source-mapper`, analyst revision, synthesizer `group`, orchestrator Stage 3 loop: structural
  assertion checks (map.json shape; analyst consumes `map_path`; SKILL has Stage 3 scoped-walk
  loop + Stage 5.5; fallback path documented). End-to-end validated by a real run afterward.
- Independence preserved throughout; no `spec-pipeline`/`prototype-to-spec` runtime references.

## Out of scope
- PDF rendering (future stage; path is headless-Chrome `Page.printToPDF` via the existing CDP).
- A new walker URL/hash-route navigation mode (only needed if a prototype abandons click-nav).
- Restoring the module→feature breadth catalog.

## Files
```
feature-catalog/agents/source-mapper/{source-mapper.md, README.md}          # new (replaces entity-discoverer)
feature-catalog/agents/entity-discoverer/                                    # retired/absorbed into source-mapper
feature-catalog/agents/entity-lifecycle-analyst/entity-lifecycle-analyst.md  # revised (map authority)
feature-catalog/agents/gap-synthesizer/gap-synthesizer.md                    # +group assignment
feature-catalog/skills/feature-catalog/scripts/feature_list.py + test        # new
feature-catalog/skills/feature-catalog/SKILL.md                              # Stages 2/3 rework, +5.5, fallback
feature-catalog/README.md                                                    # updated flow
```
