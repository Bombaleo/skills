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
