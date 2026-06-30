# Feature-catalog — configuration/platform areas as catalog units

**Date:** 2026-06-30
**Status:** Approved (design)
**Extends:** `2026-06-26-source-first-discovery-design.md` and
`2026-06-28-entry-hint-normalization-design.md`

## Problem

The pipeline is entity-centric: discovery finds domain *entities* and catalogs each entity's
lifecycle. But large Settings/admin areas carry substantial logic that is **not owned by any
domain entity** — feature flags, policies, custom fields, distribution rules, integrations,
system/MSP toggles, lifecycle configuration, etc. Today those features have no entity to hang on,
so they fall out of the catalog entirely. The e2e on the VMS app confirmed this: several Settings
sub-areas mapped to entities (job, user, budget, rate_card, location, approval_workflow), but
configuration behaviours with no entity were dropped.

## Decision

Surface **config areas** as first-class catalog units alongside entities, with the **same
Present/Partial/Missing gap analysis** — capabilities-only (no lifecycle states).

| Question | Decision |
|---|---|
| How modeled | **Config areas as catalog units** — discovery emits a parallel `config_areas` list; each gets full gap analysis like an entity, but capabilities-only. |
| Analyst | **Reuse `entity-lifecycle-analyst`** with `states`/`transitions` empty; no new agent. |
| Storage / downstream | A config area is analyzed into the **same `ent_<slug>.json` shape** with `kind:"config_area"` and empty states/transitions, and lives in the report's existing `entities[]` array tagged by `kind`. So `compute_coverage.py` and `feature_list.py` need **no change**. |
| Grouping | The synthesizer places config areas in a **"Configuration & Platform"** group/section. |

## What qualifies as a config area (vs an entity)

- **Entity**: a domain object users create/manage with a lifecycle (requisition, worker, invoice…).
- **Config area**: a Settings/admin/platform *capability surface* that configures how the system
  behaves, owning no domain-object lifecycle — e.g. Feature Flags, Policies, Custom Fields,
  Distribution Rules, Integrations, System/MSP settings, Lifecycle configuration, Notification
  rules. A feature whose subject is "how the platform/program is configured" rather than "a
  domain object's lifecycle" belongs to a config area.

A borderline area that the source-mapper already models as an entity (e.g. `job`, `user`,
`approval_workflow`) stays an entity — config areas are specifically the *leftover* Settings logic
not captured by any entity.

## Component changes

### `source-mapper`
Additionally emit a top-level `config_areas` array in `map.json`:
```json
"config_areas": [
  { "slug": "feature_flags", "name": "Feature Flags",
    "purpose": "Toggle gated capabilities per program/tenant.",
    "features": [
      { "name": "Toggle a feature flag", "category": "update",
        "evidence_source": ["NNN_x.js"], "entry_hint": ["Settings","Feature flags"] }
    ] }
]
```
No `states`/`transitions` (config areas are not lifecycle objects). `category` uses the same enum.
Source-grounded; never invent. A Settings/admin/platform behaviour not owned by a domain entity
goes here; do not duplicate a feature already attached to an entity.

### `normalize_hints.py` (code + test)
`normalize_map` currently adds `entry_path` only to `entities[].features[]`. Extend it to ALSO
process `config_areas[].features[]` the same way (set `entry_path`), and include their non-empty
paths in the top-level `walk_targets` dedup. `normalize_hint` itself is unchanged.

### Orchestrator (SKILL) — Stage 4 fan-out
Fan out the analyst over **both** `entities` and `config_areas`. For each unit pass a new
`unit_kind` input (`entity` | `config_area`). Output path is `ent_<slug>.json` for both (so
`compute_coverage` globs them). Config-area slugs must not collide with entity slugs (the
source-mapper keeps them distinct; if a collision occurs, suffix the config slug with `_cfg`).
Stage 3 already walks every `walk_targets` entry, which now includes config-area entry-paths.

### `entity-lifecycle-analyst`
Accept a `unit_kind` input. When `unit_kind == config_area`:
- Find the unit in `map.json`'s `config_areas` (not `entities`).
- Produce **capabilities-only** analysis: `states` and `transitions` are `[]`; mark each expected
  config capability Present (in source + render-confirmed) / Partial (in source, unreached) /
  Missing (expected of this kind of config surface in a VMS, absent from source — justified).
- Write the same `ent_<slug>.json` shape plus `"kind": "config_area"`. (Entities keep
  `"kind": "entity"` — add the field for both so the synthesizer can distinguish; default to
  `entity` if absent for backward compatibility.)

### `gap-synthesizer`
- Read each `ent_*.json`'s `kind` (default `entity`).
- Assign config areas the group **"Configuration & Platform"** (entities get their domain groups
  as before).
- In `entity-catalog.md`, render config areas in their own "Configuration & Platform" section;
  omit the "Lifecycle states" line when `states` is empty.
- `entities-report.json` keeps all units in the `entities[]` array, each carrying `kind` and
  `group`. `overall_coverage` sums all (entities + config areas).

### Unchanged
`compute_coverage.py` (globs `ent_*.json`, counts capabilities — kind-agnostic) and
`feature_list.py` (groups by `group`; config areas land under "Configuration & Platform")
require no changes.

## Artifact contract (additions)
- `map.json`: new top-level `config_areas` array; after normalize, its features carry `entry_path`
  and contribute to `walk_targets`.
- `ent_<slug>.json`: new `kind` field (`entity` | `config_area`); config areas have empty
  `states`/`transitions`.
- `entities-report.json`: each unit carries `kind`; config areas grouped "Configuration & Platform".

## Testing
- `normalize_hints.py`: add tests that `normalize_map` sets `entry_path` on `config_areas[]`
  features and folds their paths into `walk_targets` (and that a map with no `config_areas` still
  works — backward compatible).
- Structural assertion checks: source-mapper emits/explains `config_areas`; analyst handles
  `unit_kind`/config_area + `kind` output; synthesizer groups config areas + omits empty states.
- E2e re-validation: Settings now yields a "Configuration & Platform" section with config-area
  features (and they appear in `features.md`).

## Out of scope
- Lifecycle states for config areas (capabilities-only by decision).
- A separate config-area agent (analyst is reused).
- Changing entity discovery for areas already modeled as entities.

## Files
```
feature-catalog/agents/source-mapper/source-mapper.md                 # emit config_areas
feature-catalog/skills/feature-catalog/scripts/normalize_hints.py + test  # normalize config_areas hints
feature-catalog/skills/feature-catalog/SKILL.md                        # Stage 4 fan-out over config_areas; unit_kind
feature-catalog/agents/entity-lifecycle-analyst/entity-lifecycle-analyst.md  # unit_kind + config-area mode + kind field
feature-catalog/agents/gap-synthesizer/gap-synthesizer.md              # kind-aware grouping + section
```
