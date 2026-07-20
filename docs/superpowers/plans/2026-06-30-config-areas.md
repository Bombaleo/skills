# Config/Platform Areas as Catalog Units Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Catalog Settings/admin/platform logic that owns no domain entity by surfacing `config_areas` as first-class catalog units, analyzed capabilities-only by the reused analyst and grouped "Configuration & Platform".

**Architecture:** `source-mapper` emits a parallel `config_areas` list in `map.json`; `normalize_hints.py` normalizes their entry-hints too; the orchestrator fans the analyst over entities **and** config_areas (passing `unit_kind`); each config area is analyzed into the same `ent_<slug>.json` shape with `kind:"config_area"` and empty states; the synthesizer groups them as "Configuration & Platform". `compute_coverage.py` and `feature_list.py` are untouched (unified `entities[]` list).

**Tech Stack:** Python 3.9+ stdlib; Markdown skill/agent definitions.

**Design doc:** `docs/superpowers/specs/2026-06-30-config-areas-design.md`

## Global Constraints

- **Python 3.9+, stdlib only**; tests via `python3 -m unittest`. Independence: no `spec-pipeline`/`prototype-to-spec` refs.
- **Config area vs entity:** a config area is a Settings/admin/platform capability surface owning no domain-object lifecycle (feature flags, policies, custom fields, distribution rules, integrations, system/MSP settings, lifecycle config, notification rules). A feature already attached to an entity is NOT duplicated into a config area.
- **Config-area shape in `map.json`:** `config_areas: [{slug, name, purpose, features:[{name, category, evidence_source, entry_hint}]}]` — **no** `states`/`transitions`. `category` enum unchanged.
- **Analyst output for a config area:** the same `ent_<slug>.json` shape with `states:{observed:[],expected:[],missing:[]}`, `transitions:[]`, capabilities (present/partial/missing, capabilities-only), `coverage`, and a new `"kind":"config_area"` field. Entities get `"kind":"entity"`. Default to `entity` when `kind` absent.
- **Present/Partial/Missing for config areas:** present = in source AND render-confirmed; partial = in source, not render-confirmed; missing = expected of this config surface in a VMS, absent from source (justified).
- **Slug collisions:** config-area slugs must not collide with entity slugs; if one would, suffix it `_cfg`.
- **Grouping:** synthesizer assigns config areas `group:"Configuration & Platform"`; renders them in their own catalog section; omits the "Lifecycle states" line when `states` is empty.
- `compute_coverage.py` and `feature_list.py` MUST remain unchanged (they operate on the unified list / `group`).

---

## File Structure

```
feature-catalog/skills/feature-catalog/scripts/normalize_hints.py + test  # Task 1 — code+test
feature-catalog/agents/source-mapper/source-mapper.md                     # Task 2 — emit config_areas
feature-catalog/agents/entity-lifecycle-analyst/entity-lifecycle-analyst.md  # Task 3 — unit_kind + config mode + kind
feature-catalog/skills/feature-catalog/SKILL.md                           # Task 4 — Stage 4 fan-out over config_areas
feature-catalog/agents/gap-synthesizer/gap-synthesizer.md                 # Task 5 — kind-aware grouping + section
```

**Order:** code first (Task 1), then the discovery contract (Task 2), then analysis (Task 3), wiring (Task 4), synthesis (Task 5) — producer-before-consumer.

---

## Task 1: `normalize_hints.py` — also normalize `config_areas` entry-hints

**Files:**
- Modify: `feature-catalog/skills/feature-catalog/scripts/normalize_hints.py`
- Modify (add tests): `feature-catalog/skills/feature-catalog/scripts/test_normalize_hints.py`

**Interfaces:**
- `normalize_map(m)` now also sets `entry_path` on `config_areas[].features[]` and folds their non-empty paths into `walk_targets`. `normalize_hint` unchanged. Backward compatible (a map with no `config_areas` behaves as before).

- [ ] **Step 1: Add failing tests**

Append to `feature-catalog/skills/feature-catalog/scripts/test_normalize_hints.py` a new test class (before the `if __name__` block):
```python
class TestNormalizeMapConfigAreas(unittest.TestCase):
    def _map(self):
        return {
            "unmapped": False, "nav": [],
            "entities": [
                {"slug": "invoice", "name": "Invoice", "role": "r", "states": [], "transitions": [],
                 "features": [{"name": "f", "category": "read", "evidence_source": [],
                               "entry_hint": "Invoices"}]}],
            "config_areas": [
                {"slug": "feature_flags", "name": "Feature Flags", "purpose": "p",
                 "features": [
                     {"name": "Toggle flag", "category": "update", "evidence_source": [],
                      "entry_hint": "Settings → Feature flags"},
                     {"name": "Bad", "category": "update", "evidence_source": [],
                      "entry_hint": "[tenant] → Toggle"}]}],  # -> empty path
        }

    def test_config_area_features_get_entry_path(self):
        out = normalize_map(self._map())
        ca = out["config_areas"][0]
        self.assertEqual(ca["features"][0]["entry_path"], ["Settings", "Feature flags"])
        self.assertEqual(ca["features"][1]["entry_path"], [])  # truncated at placeholder

    def test_config_area_paths_join_walk_targets_deduped(self):
        out = normalize_map(self._map())
        # entity path + config-area path, both present, deduped & sorted
        self.assertIn(["Invoices"], out["walk_targets"])
        self.assertIn(["Settings", "Feature flags"], out["walk_targets"])
        self.assertEqual(len(out["walk_targets"]), 2)  # empty config path excluded

    def test_no_config_areas_key_still_works(self):
        m = {"entities": [{"slug": "x", "name": "X", "role": "r", "features": [
            {"name": "f", "category": "read", "evidence_source": [], "entry_hint": "Home"}]}]}
        out = normalize_map(m)
        self.assertEqual(out["entities"][0]["features"][0]["entry_path"], ["Home"])
        self.assertEqual(out["walk_targets"], [["Home"]])
```

- [ ] **Step 2: Run to verify the new tests fail**

Run: `cd feature-catalog/skills/feature-catalog/scripts && python3 -m unittest test_normalize_hints -v`
Expected: the two `TestNormalizeMapConfigAreas` config tests FAIL (config_areas features have no `entry_path`; `walk_targets` lacks the config path / has wrong length). `test_no_config_areas_key_still_works` PASSES (already supported). Existing tests still pass.

- [ ] **Step 3: Implement — process both collections in `normalize_map`**

In `feature-catalog/skills/feature-catalog/scripts/normalize_hints.py`, replace the `normalize_map` function with:
```python
def normalize_map(m: dict) -> dict:
    targets = []
    seen = set()

    def _process(units):
        for u in units:
            for f in u.get("features", []):
                path = normalize_hint(f.get("entry_hint"))
                f["entry_path"] = path
                key = tuple(path)
                if path and key not in seen:
                    seen.add(key)
                    targets.append(path)

    _process(m.get("entities", []))
    _process(m.get("config_areas", []))
    m["walk_targets"] = sorted(targets)
    return m
```

- [ ] **Step 4: Run to verify all pass**

Run: `cd feature-catalog/skills/feature-catalog/scripts && python3 -m unittest test_normalize_hints -v`
Expected: all tests OK (the prior tests plus the 3 new ones).

- [ ] **Step 5: Commit**

```bash
git add feature-catalog/skills/feature-catalog/scripts/normalize_hints.py \
        feature-catalog/skills/feature-catalog/scripts/test_normalize_hints.py
git commit -m "feat(feature-catalog): normalize config_areas entry-hints into walk_targets"
```

---

## Task 2: `source-mapper` emits `config_areas`

**Files:**
- Modify: `feature-catalog/agents/source-mapper/source-mapper.md`

**Interfaces:** `map.json` gains a top-level `config_areas` array (shape in Global Constraints). Tasks 1, 3, 4 consume it.

- [ ] **Step 1: Add a config-areas identification step**

In `feature-catalog/agents/source-mapper/source-mapper.md`, immediately AFTER the section `### 3. Identify entities and their features` (and before `### 4. Write map.json`), insert a new section:
```markdown
### 3b. Identify configuration / platform areas (entity-less logic)
Beyond domain entities, the Settings/admin surface carries substantial logic that owns no domain
object — e.g. **Feature Flags, Policies, Custom Fields, Distribution Rules, Integrations,
System/MSP settings, Lifecycle configuration, Notification rules**. Capture each such area as a
**config area** (NOT an entity): a capability surface that configures how the system behaves.
For each config area record:
- `slug` (snake_case), `name`, one-line `purpose`.
- `features`: each `{name, category, evidence_source:[files], entry_hint:[clickable nav labels]}`
  — same rules and array `entry_hint` contract as entity features. NO `states`/`transitions`.
Rules: source-grounded (never invent); do NOT duplicate a feature already attached to an entity;
if a config area's `slug` would collide with an entity `slug`, suffix it `_cfg`.
```

- [ ] **Step 2: Add `config_areas` to the map.json output shape**

In `### 4. Write map.json`, find the JSON example. After the `entities` array (before the closing brace of the example object), add a `config_areas` array so the example shows both. Concretely, change the example so it includes:
```json
  ,
  "config_areas": [
    { "slug": "feature_flags", "name": "Feature Flags",
      "purpose": "Toggle gated capabilities per program/tenant.",
      "features": [
        { "name": "Toggle a feature flag", "category": "update",
          "evidence_source": ["NNN_x.js"], "entry_hint": ["Settings","Feature flags"] }
      ] }
  ]
```
(Insert it as a sibling key of `entities` in the example. In fallback/`unmapped` mode, `config_areas` may be an empty array.)

- [ ] **Step 3: Update the Return line**

Find the `## Return` section and add config-area counts to what the agent reports: change it to also report "config-area count and slugs" alongside the entity count (append: "and the config-area count + slugs").

- [ ] **Step 4: Verify**

Run:
```bash
python3 - <<'EOF'
import pathlib
t = pathlib.Path("feature-catalog/agents/source-mapper/source-mapper.md").read_text()
assert "### 3b. Identify configuration / platform areas" in t, "config-area step missing"
assert '"config_areas"' in t or "config_areas" in t, "config_areas not in shape"
for s in ["Feature Flags", "Policies", "owns no domain", "do NOT duplicate", "_cfg"]:
    assert s in t, f"missing: {s}"
# config areas must not introduce states
assert "NO `states`/`transitions`" in t, "config areas should not have states"
assert "prototype-to-spec" not in t and "spec-pipeline" not in t
print("VERIFY_OK")
EOF
```
Expected: `VERIFY_OK`.

- [ ] **Step 5: Commit**

```bash
git add feature-catalog/agents/source-mapper/source-mapper.md
git commit -m "feat(feature-catalog): source-mapper emits config_areas"
```

---

## Task 3: `entity-lifecycle-analyst` handles a `unit_kind` (entity | config_area)

**Files:**
- Modify: `feature-catalog/agents/entity-lifecycle-analyst/entity-lifecycle-analyst.md`

**Interfaces:**
- Consumes new input `unit_kind` (`entity` | `config_area`, default `entity`). Produces `ent_<slug>.json` with a new `"kind"` field; config areas have empty `states`/`transitions`.

- [ ] **Step 1: Add the `unit_kind` input**

In `feature-catalog/agents/entity-lifecycle-analyst/entity-lifecycle-analyst.md`, in `## Inputs`, immediately AFTER the `map_path` bullet, insert:
```markdown
- **unit_kind** (optional, default `entity`): `entity` or `config_area`. When `config_area`, your
  unit is found under `map.json`'s `config_areas` (not `entities`); it is a Settings/admin/platform
  capability surface with NO lifecycle states.
```

- [ ] **Step 2: Add a config-area branch to step 1**

In `### 1. Start from the source map (authority for what exists)`, append:
```markdown

**If `unit_kind == config_area`:** locate your unit in `map.json`'s `config_areas` by `entity_slug`.
It has `features` but no `states`/`transitions`. Do capabilities-only analysis: the existing
source features are what exists; using VMS domain knowledge, add config capabilities a VMS commonly
expects for this kind of surface that are absent from source as **missing** (justified). There are
no lifecycle states to assess — set `states` to `{"observed": [], "expected": [], "missing": []}`
and `transitions` to `[]`.
```

- [ ] **Step 3: Add the `kind` field to the output**

In `### 4. Write ent_<slug>.json`, in the JSON example, add a `"kind"` field right after the
`"slug"`/`"name"`/`"role"` line. Change that first content line of the example to:
```json
  "slug": "<entity_slug>", "name": "<entity_name>", "role": "<role>", "kind": "<entity|config_area>",
```
Then add a bullet under the rules below the example:
```markdown
- `kind`: `entity` for a domain entity, `config_area` for a configuration/platform area
  (per `unit_kind`). For a config area, `states.observed/expected/missing` are all `[]` and
  `transitions` is `[]` — only `capabilities` are analyzed.
```

- [ ] **Step 4: Verify**

Run:
```bash
python3 - <<'EOF'
import pathlib
t = pathlib.Path("feature-catalog/agents/entity-lifecycle-analyst/entity-lifecycle-analyst.md").read_text()
assert "unit_kind" in t, "unit_kind input missing"
assert "config_area" in t and "config_areas" in t, "config-area handling missing"
assert '"kind"' in t, "kind field missing from output"
assert "capabilities-only" in t or "only `capabilities` are analyzed" in t
# output contract still intact
for s in ["ent_<slug>.json", "expected_total", "capabilities[].category"]:
    assert s in t, f"lost contract: {s}"
assert "prototype-to-spec" not in t and "spec-pipeline" not in t
print("VERIFY_OK")
EOF
```
Expected: `VERIFY_OK`.

- [ ] **Step 5: Commit**

```bash
git add feature-catalog/agents/entity-lifecycle-analyst/entity-lifecycle-analyst.md
git commit -m "feat(feature-catalog): analyst handles config_area units (capabilities-only, kind)"
```

---

## Task 4: Orchestrator — fan the analyst over `config_areas` too

**Files:**
- Modify: `feature-catalog/skills/feature-catalog/SKILL.md`

**Interfaces:** Stage 4 dispatches the analyst for every entity AND every config area, passing `unit_kind`.

- [ ] **Step 1: Add `unit_kind` to the entity dispatch and a config-area dispatch**

In `feature-catalog/skills/feature-catalog/SKILL.md`, in `### Stage 4 — Per-entity lifecycle analysis (parallel)`, find the bullet list of analyst inputs under "For each entity in `map.json`, delegate **entity-lifecycle-analyst** ...". Add to that input list a new bullet:
```markdown
- `unit_kind`: `entity`
```
Then, immediately AFTER that entity dispatch paragraph and its input bullets, add a parallel config-area dispatch paragraph:
```markdown
**Also, for each config area in `map.json`'s `config_areas`**, delegate **entity-lifecycle-analyst**
in the same parallel batch with the same inputs, except:
- `entity_name`, `entity_slug`, `role` come from the config-area entry (`role` = its `purpose`)
- `unit_kind`: `config_area`
- `output_path`: `.specwork/catalog/ent_<config_area_slug>.json`
- `evidence_screens`: walk `.txt` files whose `path` matches the config area's feature `entry_path`s

Config areas have no `entry_hint`/`entry_path` collisions with entities by construction (the
source-mapper suffixes a colliding config slug with `_cfg`); if two output paths still collide,
append `_cfg` to the config area's filename. Wait for ALL analyst dispatches (entities + config
areas) before continuing; confirm every expected `ent_<slug>.json` exists.
```

- [ ] **Step 2: Note config areas in the heading/intro of Stage 4**

Change the Stage 4 heading line `### Stage 4 — Per-entity lifecycle analysis (parallel)` to
`### Stage 4 — Per-unit lifecycle analysis (entities + config areas, parallel)`, and in its first
sentence mention that both entities and config areas are analyzed (config areas capabilities-only).

- [ ] **Step 3: Verify**

Run:
```bash
python3 - <<'EOF'
import pathlib
t = pathlib.Path("feature-catalog/skills/feature-catalog/SKILL.md").read_text()
assert "config_areas" in t, "Stage 4 does not fan out over config_areas"
assert "unit_kind" in t, "unit_kind not passed"
assert "config_area" in t
assert "entities + config areas" in t or "entities and config areas" in t, "heading not updated"
# stage order still intact
order = ["### Stage 2 — Source map", "### Stage 2.5", "### Stage 3", "### Stage 4", "### Stage 4.5", "### Stage 5 — Synthesis", "### Stage 5.5", "### Stage 6"]
idx=[t.index(s) for s in order]; assert idx==sorted(idx), "stage order broken"
for bad in ["entity-discoverer","group_screens","module-cataloger","catalog-synthesizer","prototype-to-spec/scripts"]:
    assert bad not in t, f"references {bad}"
print("VERIFY_OK")
EOF
```
Expected: `VERIFY_OK`.

- [ ] **Step 4: Commit**

```bash
git add feature-catalog/skills/feature-catalog/SKILL.md
git commit -m "feat(feature-catalog): Stage 4 analyzes config_areas alongside entities"
```

---

## Task 5: `gap-synthesizer` — kind-aware grouping + Configuration & Platform section

**Files:**
- Modify: `feature-catalog/agents/gap-synthesizer/gap-synthesizer.md`

**Interfaces:** reads each `ent_*.json`'s `kind`; config areas grouped "Configuration & Platform"; report carries `kind` per unit; catalog renders a config section without a states line.

- [ ] **Step 1: Make grouping kind-aware**

In `feature-catalog/agents/gap-synthesizer/gap-synthesizer.md`, in `### 1b. Assign each entity a logical group`, append:
```markdown

Each unit carries a `kind` (`entity` or `config_area`; default `entity` if absent). Assign every
unit with `kind == config_area` the group **"Configuration & Platform"** (do not scatter them into
domain groups). Carry each unit's `kind` through into `entities-report.json`.
```

- [ ] **Step 2: Render a Configuration & Platform section without a states line**

In `### 5. Write entity-catalog.md` (the markdown template section), add after the per-entity template:
```markdown

For a unit with `kind == config_area`, render it under a top-level "## Configuration & Platform"
grouping and OMIT the "**Lifecycle states:**" line (config areas have no states) — show only the
**Capabilities:** list and the **Coverage:** line.
```

- [ ] **Step 3: Add `kind` to the report shape note**

In `### 4. Write entities-report.json`, in the sentence that already says to add a `group` per entity, extend it to also carry `kind`: change it to "Add a `group` string and carry the `kind` field on each unit object (from its `ent_*.json`, default `entity`) when writing it into `entities`."

- [ ] **Step 4: Verify**

Run:
```bash
python3 - <<'EOF'
import pathlib
t = pathlib.Path("feature-catalog/agents/gap-synthesizer/gap-synthesizer.md").read_text()
assert "Configuration & Platform" in t, "config group/section missing"
assert "kind" in t, "kind not handled"
assert "OMIT" in t and "Lifecycle states" in t, "states-omission rule missing"
assert "prototype-to-spec" not in t and "spec-pipeline" not in t
print("VERIFY_OK")
EOF
```
Expected: `VERIFY_OK`.

- [ ] **Step 5: Commit**

```bash
git add feature-catalog/agents/gap-synthesizer/gap-synthesizer.md
git commit -m "feat(feature-catalog): synthesizer groups config_areas as Configuration & Platform"
```

---

## Self-Review

**Spec coverage** (design → task):
- source-mapper emits `config_areas` (shape, qualifies-as rules, no states, no-dup, `_cfg`) → Task 2.
- normalize_hints processes `config_areas` into `entry_path` + `walk_targets` → Task 1.
- orchestrator fans analyst over entities + config_areas with `unit_kind` → Task 4.
- analyst config-area mode (capabilities-only, empty states, `kind`) → Task 3.
- synthesizer kind-aware grouping + Configuration & Platform section + report `kind` → Task 5.
- compute_coverage/feature_list unchanged → asserted in Global Constraints; no task touches them.

**Type/contract consistency:** `config_areas` shape (Task 2) consumed by normalize_hints (Task 1), orchestrator (Task 4), analyst (Task 3). `ent_<slug>.json` keeps its shape + new `kind` (Task 3) read by synthesizer (Task 5); empty states/transitions are valid for `compute_coverage.py` (counts capabilities only — unchanged). `kind` default `entity` everywhere (Tasks 3, 5). `unit_kind` input name matches between Task 4 (passes it) and Task 3 (consumes it). `walk_targets` shape unchanged (Task 1 just adds more entries) — Stage 3 (JSON-array `--nav`) unaffected.

**Placeholder scan:** none — full code/tests inline; every verification step has exact commands + expected output.

**Edit-anchor note (Tasks 2–5):** target existing headings/lines by quoted content; Step-N assertions confirm inserts landed and ordering held.
