# feature-catalog

A self-contained pipeline that turns a **Claude Design prototype** — a design URL
or a local prototype path (default `./project`) — into a **VMS entity-lifecycle
gap analysis**. It discovers the domain entities the prototype works with and,
for each, lays out the lifecycle a Vendor Management System is commonly expected
to support (states + create/update/delete/archive and operation capabilities),
marking each capability **Present**, **Partial**, or **Missing** against the
prototype.

Where `spec-pipeline` goes **deep on one feature**, this analyses **every entity's
lifecycle across the whole app**. It depends on nothing in `spec-pipeline` — it
ships its own walk scripts.

## Skill (`skills/`)

| Skill | Purpose |
|-------|---------|
| `feature-catalog` | Orchestrator: walk → discover entities → analyse each → synthesize → publish. |

Scripts under `skills/feature-catalog/scripts/`:
- `walk_prototype.py` — render-walk the prototype in headless Chrome (own copy).
- `extract_bundle.py` — extract source assets from a standalone export (own copy).

## Agents (`agents/`)

| Agent | Role |
|-------|------|
| `entity-discoverer` | Discover the prototype's domain entities → `entities.json`. |
| `entity-lifecycle-analyst` | Per entity: expected VMS lifecycle vs prototype, Present/Partial/Missing → `ent_<slug>.json` (parallel, one per entity). |
| `gap-synthesizer` | Merge per-entity analyses → `entity-catalog.md` + `entities.json`. |

## Pipeline flow

```
walk (once) → entity-discoverer → entity-lifecycle-analyst (per entity)
   → gap-synthesizer → publish to catalog/<app_slug>/
```

## Output

- `catalog/<app_slug>/entity-catalog.md` — per-entity lifecycle catalog with
  Present/Partial/Missing capabilities and coverage (default `app_slug=vms`).
- `catalog/<app_slug>/entities.json` — structured report with per-entity and
  overall coverage.
