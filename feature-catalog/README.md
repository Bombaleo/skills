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
