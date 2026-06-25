# Feature-Catalog Entity-Lifecycle Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redefine the `feature-catalog` pipeline into an entity-lifecycle gap analysis: discover the prototype's domain entities, then per entity derive the expected VMS lifecycle and mark each capability Present/Partial/Missing.

**Architecture:** Reuse the unchanged vendored walk scripts and Stage 0/1 (full walk + source extraction). Add three worker agents — `entity-discoverer` → fan-out `entity-lifecycle-analyst` (one per entity) → `gap-synthesizer` — rewrite the orchestrator SKILL.md and README.md around them, and retire the module-centric components (`module-cataloger`, `catalog-synthesizer`, `group_screens.py` + test).

**Tech Stack:** Markdown skill/agent definitions (Claude Code skills + Task subagents); existing Python 3.9+ stdlib walk scripts (unchanged); headless Chrome walk.

**Design doc:** `docs/superpowers/specs/2026-06-25-feature-catalog-entity-lifecycle-redesign.md` (supersedes `2026-06-25-feature-catalog-pipeline-design.md`).

## Global Constraints

- **Independence:** No file under `feature-catalog/` may reference, import, or path into `spec-pipeline/` or `prototype-to-spec` at runtime (prose mentions asserting independence are allowed). Scripts are located only under this pipeline's own `skills/feature-catalog/scripts/` (and the install paths `.claude/skills/feature-catalog/scripts`, `~/.claude/skills/feature-catalog/scripts`).
- **Prototype-discovered entities only:** never invent entities absent from the prototype. Gap analysis covers missing *features* on present entities, not missing entities.
- **Expected sets come from agent VMS domain reasoning** — no shipped/curated taxonomy file. Every **Missing** capability must carry a one-line justification for why it is commonly expected in a VMS.
- **Status semantics:** `present` = directly evidenced in walk/source; `partial` = related affordance seen, operation unconfirmed; `missing` = expected but no evidence.
- **Capability `category`** ∈ `create | read | update | delete | archive | list_search | state_transition | other`.
- **Example-data rule:** sample values describe field format only, never required/enumerated values.
- **Prose rules:** English only; no checkboxes; no `<details>`; behavioral altitude (WHAT not HOW — no file paths, endpoints, schema, column names) in `entity-catalog.md`.
- **Default `app_slug`:** `vms`. Final output dir: `catalog/<app_slug>/`. Intermediate dir: `.specwork/catalog/` (gitignored). Walk/source in `/tmp/proto-walk`, `/tmp/proto-src`.
- **Status glyphs in `entity-catalog.md`:** `✅` present, `⚠️` partial, `❌` missing.

---

## File Structure

```
feature-catalog/
  README.md                                      # Task 5 — rewritten
  skills/feature-catalog/
    SKILL.md                                      # Task 4 — rewritten orchestrator
    scripts/
      walk_prototype.py                           # unchanged
      extract_bundle.py                           # unchanged
      group_screens.py        + test              # Task 6 — REMOVED
  agents/
    entity-discoverer/        {entity-discoverer.md, README.md}        # Task 1
    entity-lifecycle-analyst/ {entity-lifecycle-analyst.md, README.md} # Task 2
    gap-synthesizer/          {gap-synthesizer.md, README.md}          # Task 3
    module-cataloger/                             # Task 6 — REMOVED
    catalog-synthesizer/                          # Task 6 — REMOVED
```

**Task ordering rationale:** add the three new agents first (Tasks 1–3), rewire SKILL.md + README to them (Tasks 4–5), then retire the now-unreferenced old components and sweep (Task 6). At no point does a live file reference a deleted one.

**Shared data contracts** (every task must match these exactly):

`.specwork/catalog/entities.json` (entity-discoverer output) — a JSON **array**:
```json
[ { "slug": "requisition", "name": "Requisition",
    "role": "A staffing order for positions at a client site.",
    "evidence_screens": ["007_requisitions.txt"] } ]
```

`.specwork/catalog/ent_<slug>.json` (entity-lifecycle-analyst output) — one object:
```json
{
  "slug": "requisition", "name": "Requisition", "role": "...",
  "states": { "observed": ["open","filled"], "expected": ["draft","open","filled","cancelled"],
              "missing": ["draft","cancelled"] },
  "transitions": [ { "from": "open", "to": "filled", "action": "fulfil positions", "status": "present" } ],
  "capabilities": [
    { "name": "Create requisition", "category": "create", "status": "present",
      "evidence": ["007_requisitions.txt"], "note": "" },
    { "name": "Archive requisition", "category": "archive", "status": "missing",
      "evidence": [], "note": "VMS commonly archives closed reqs for audit/reuse." }
  ],
  "coverage": { "present": 6, "partial": 1, "missing": 3, "expected_total": 10 }
}
```
`coverage.expected_total` == number of `capabilities`; `present+partial+missing == expected_total`.

`.specwork/catalog/entities-report.json` (gap-synthesizer output; published as `entities.json`):
```json
{ "app": "vms", "generated_from": "<url-or-path>",
  "overall_coverage": { "present": 0, "partial": 0, "missing": 0, "expected_total": 0 },
  "entities": [ <ent_<slug>.json objects, unchanged shape> ] }
```

---

## Task 1: `entity-discoverer` worker agent

**Files:**
- Create: `feature-catalog/agents/entity-discoverer/entity-discoverer.md`
- Create: `feature-catalog/agents/entity-discoverer/README.md`

**Interfaces:**
- Consumes (orchestrator-supplied): `walk_dir` (`/tmp/proto-walk`), `src_dir` (`/tmp/proto-src`, may be absent), `context_path` (`.specwork/catalog/../context.md` — `.specwork/context.md`, may be absent), `output_path` (`.specwork/catalog/entities.json`).
- Produces: `.specwork/catalog/entities.json` — the array contract above. Task 2 reads one entry per analyst; the orchestrator reads the array to fan out.

- [ ] **Step 1: Write the agent definition**

Create `feature-catalog/agents/entity-discoverer/entity-discoverer.md`:
````markdown
---
name: entity-discoverer
description: >
  Discovers the domain entities present in a walked prototype (jobs, shifts, requisitions,
  workers, suppliers, timesheets, invoices, clients, …) and writes entities.json — each with a
  slug, name, one-line VMS role, and the walk screens that evidence it. Prototype-grounded; never
  invents entities. Worker for the feature-catalog pipeline; not for standalone use.
tools: Read, Glob, Grep, Write, Bash
---

You are the **entity-discoverer**. You identify the domain entities/objects a prototype works
with, so the pipeline can analyse each one's lifecycle. You do not walk anything — you read the
walk output and source already produced.

## Inputs

- **walk_dir** (required): directory of walk outputs (default `/tmp/proto-walk`). Its `.txt`
  files are per-screen outlines; `index.json` lists screens with `id`, `title`, `path`, `txt`.
- **src_dir** (optional): extracted prototype source (default `/tmp/proto-src`). May be absent.
- **context_path** (optional): `.specwork/context.md`. Terminology alignment only.
- **output_path** (required): where to write the entity list (`.specwork/catalog/entities.json`).

## Task

### 1. Read the walk
Read `index.json` for the screen inventory, then read the `.txt` outlines. Entities surface as:
the nouns that own list/detail screens, table column sets, repeated record types, form subjects,
and status badges. Typical VMS entities: requisition, job, shift, work assignment, worker,
candidate, supplier/agency, client/site, timesheet, invoice, rate/rate card, contract/SOW.

### 2. Cross-reference source (only if `src_dir` present)
Grep the source under `src_dir` for entity names and their fields to confirm entities and catch
ones the render under-shows. **On conflict, the rendered walk wins.**

### 3. Reconcile terminology (only if `context_path` present)
Prefer the project's names for entities. Never add an entity that is not present in the prototype.

### 4. Identify entities
An **entity** is a distinct domain object the user creates, views, or acts on — not a screen, a
widget, or a UI control. Merge synonyms (e.g. "agency" and "supplier" if the prototype uses them
interchangeably) into one entity. For each entity record:
- `slug`: snake_case, e.g. `requisition`.
- `name`: human-readable, e.g. `Requisition`.
- `role`: one sentence on what the entity is in this VMS.
- `evidence_screens`: the `.txt` filenames in `walk_dir` where the entity appears (for the
  analyst to read). Include every screen that shows the entity's list, detail, or forms.

### 5. Write entities.json
Write `output_path` as a JSON **array**, exactly:

```json
[
  { "slug": "requisition", "name": "Requisition",
    "role": "A staffing order for one or more positions at a client site.",
    "evidence_screens": ["007_requisitions.txt", "017_requisition-detail.txt"] }
]
```

**Rules:** prototype-grounded only — never invent entities. Valid JSON (no trailing commas, no
comments). English only.

## Return

Reply with: the `output_path`, the entity count, and a one-line list of entity slugs found.
````

- [ ] **Step 2: Write the README**

Create `feature-catalog/agents/entity-discoverer/README.md`:
```markdown
# entity-discoverer

Discovers the domain entities present in a walked prototype and writes
`entities.json` — each entity with a slug, name, one-line VMS role, and the
walk screens that evidence it. Prototype-grounded; never invents entities.
Worker agent for the feature-catalog pipeline; not for standalone use.

**Tools:** Read, Glob, Grep, Write, Bash
```

- [ ] **Step 3: Verify structure**

Run:
```bash
python3 - <<'EOF'
import pathlib
t = pathlib.Path("feature-catalog/agents/entity-discoverer/entity-discoverer.md").read_text()
assert t.startswith("---\n"), "missing frontmatter"
fm = t.split("---\n", 2)[1]
assert "name: entity-discoverer" in fm and "tools:" in fm
for s in ["## Inputs", "## Task", "## Return", "output_path", "evidence_screens",
          "never invent", "entities.json"]:
    assert s in t, f"missing: {s}"
assert "prototype-to-spec" not in t and "spec-pipeline" not in t, "references source pipeline"
print("VERIFY_OK")
EOF
```
Expected: `VERIFY_OK`.

- [ ] **Step 4: Commit**

```bash
git add feature-catalog/agents/entity-discoverer/
git commit -m "feat(feature-catalog): add entity-discoverer worker agent"
```

---

## Task 2: `entity-lifecycle-analyst` worker agent

**Files:**
- Create: `feature-catalog/agents/entity-lifecycle-analyst/entity-lifecycle-analyst.md`
- Create: `feature-catalog/agents/entity-lifecycle-analyst/README.md`

**Interfaces:**
- Consumes: `entity_name`, `entity_slug`, `role`, `evidence_screens` (filenames in `walk_dir`), `walk_dir`, `src_dir` (may be absent), `context_path` (may be absent), `output_path` (`.specwork/catalog/ent_<slug>.json`).
- Produces: `.specwork/catalog/ent_<slug>.json` — the per-entity contract above (states/transitions/capabilities/coverage). Task 3 reads every `ent_*.json`.

- [ ] **Step 1: Write the agent definition**

Create `feature-catalog/agents/entity-lifecycle-analyst/entity-lifecycle-analyst.md`:
````markdown
---
name: entity-lifecycle-analyst
description: >
  Analyses ONE domain entity of a walked prototype against its expected VMS lifecycle. Derives
  the entity's expected states + transitions and CRUD/archive/operation capabilities from VMS
  domain reasoning, checks each against the prototype evidence, and marks it Present / Partial /
  Missing (every Missing justified). Writes ent_<slug>.json. Worker for the feature-catalog
  pipeline; not for standalone use.
tools: Read, Glob, Grep, Write, Bash
---

You are the **entity-lifecycle-analyst**. For ONE entity, you compare the VMS lifecycle a system
*should* support for that object against what the prototype *actually* provides, and record the
gaps. You walk nothing — you read the existing walk output and source.

## Inputs

- **entity_name** (required): e.g. `Requisition`.
- **entity_slug** (required): e.g. `requisition`.
- **role** (required): one-line description of the entity from the discoverer.
- **evidence_screens** (required): `.txt` outline filenames in `walk_dir` that show this entity.
- **walk_dir** (required): walk output dir (default `/tmp/proto-walk`).
- **src_dir** (optional): extracted source (default `/tmp/proto-src`). May be absent.
- **context_path** (optional): `.specwork/context.md`. Terminology only.
- **output_path** (required): `.specwork/catalog/ent_<slug>.json`.

## Task

### 1. Derive the EXPECTED VMS lifecycle (domain reasoning)
From your knowledge of how a Vendor Management System handles this kind of object, list what a
VMS is *commonly expected* to support for this entity — independent of the prototype:
- **States**: the entity's domain status lifecycle, e.g. requisition `draft → open →
  partially-filled → filled → closed` (and `cancelled`); worker `invited → onboarded → active →
  offboarded`. Pick states appropriate to THIS entity.
- **Transitions**: the actions that move between states (e.g. "approve", "fulfil", "cancel").
- **Capabilities**: operations across these categories — `create`, `read` (view list/detail),
  `update`, `delete`, `archive`, `list_search` (list + search/filter), `state_transition` (the
  transition actions above), and entity-specific `other` (e.g. timesheet: approve/reject/dispute;
  worker: onboard/offboard/assign; invoice: mark paid/dispute; supplier: rate/scorecard).
  Keep capabilities at the level of a distinct user operation, not individual buttons.

### 2. Gather prototype EVIDENCE
Read each file in `evidence_screens` from `walk_dir`. If `src_dir` is present, grep it for the
entity's terms to catch operations the render under-shows (validation-gated actions, bulk ops).
If `context_path` is present, align terminology.

### 3. Mark each expected item Present / Partial / Missing
For every expected state, transition, and capability:
- **present** — directly evidenced in the walk/source (cite the screen file(s) in `evidence`).
- **partial** — a related affordance is visible but the operation itself is not confirmed
  (e.g. a detail view exists but no edit control); explain in `note`.
- **missing** — expected in a VMS but no evidence found; `note` MUST state *why it is commonly
  expected* for this entity. `evidence` is `[]`.

Do not invent evidence. On conflict between source and render, the render wins.

### 4. Write ent_<slug>.json
Write `output_path` exactly:

```json
{
  "slug": "<entity_slug>", "name": "<entity_name>", "role": "<role>",
  "states": { "observed": ["open","filled"], "expected": ["draft","open","filled","cancelled"],
              "missing": ["draft","cancelled"] },
  "transitions": [
    { "from": "open", "to": "filled", "action": "fulfil positions", "status": "present" }
  ],
  "capabilities": [
    { "name": "Create requisition", "category": "create", "status": "present",
      "evidence": ["007_requisitions.txt"], "note": "" },
    { "name": "Archive requisition", "category": "archive", "status": "missing",
      "evidence": [], "note": "VMS commonly archives closed reqs for audit/reuse." }
  ],
  "coverage": { "present": 6, "partial": 1, "missing": 3, "expected_total": 10 }
}
```

- `states.observed` ⊆ `states.expected`; `states.missing` = `expected` minus `observed`.
- `capabilities[].category` ∈ create | read | update | delete | archive | list_search |
  state_transition | other.
- `coverage`: count capabilities by status; `expected_total` == number of capabilities ==
  `present + partial + missing`.

**Rules:** every `missing` carries a justifying `note`. Behavioral altitude (WHAT not HOW). No
acceptance criteria. Valid JSON. English only.

## Return

Reply with: the `output_path`, the coverage line (`present/partial/missing of expected_total`),
and a one-line summary of the biggest gaps.
````

- [ ] **Step 2: Write the README**

Create `feature-catalog/agents/entity-lifecycle-analyst/README.md`:
```markdown
# entity-lifecycle-analyst

Analyses ONE domain entity against its expected VMS lifecycle: derives the
entity's expected states + transitions and CRUD/archive/operation capabilities
from VMS domain reasoning, checks each against the prototype evidence, and marks
it Present / Partial / Missing (every Missing justified). Writes `ent_<slug>.json`.
Worker agent for the feature-catalog pipeline; not for standalone use.

**Tools:** Read, Glob, Grep, Write, Bash
```

- [ ] **Step 3: Verify structure**

Run:
```bash
python3 - <<'EOF'
import pathlib
t = pathlib.Path("feature-catalog/agents/entity-lifecycle-analyst/entity-lifecycle-analyst.md").read_text()
assert t.startswith("---\n")
fm = t.split("---\n", 2)[1]
assert "name: entity-lifecycle-analyst" in fm and "tools:" in fm
for s in ["## Inputs", "## Task", "## Return", "output_path", "ent_<slug>.json",
          "present", "partial", "missing", "state_transition", "expected_total",
          "why it is commonly expected"]:
    assert s in t, f"missing: {s}"
assert "prototype-to-spec" not in t and "spec-pipeline" not in t
print("VERIFY_OK")
EOF
```
Expected: `VERIFY_OK`.

- [ ] **Step 4: Commit**

```bash
git add feature-catalog/agents/entity-lifecycle-analyst/
git commit -m "feat(feature-catalog): add entity-lifecycle-analyst worker agent"
```

---

## Task 3: `gap-synthesizer` worker agent

**Files:**
- Create: `feature-catalog/agents/gap-synthesizer/gap-synthesizer.md`
- Create: `feature-catalog/agents/gap-synthesizer/README.md`

**Interfaces:**
- Consumes: `catalog_dir` (`.specwork/catalog/`, holds `ent_*.json` from Task 2), `app_name`, `app_slug`, `prototype_source`, `unverified` (bool), `context_path` (optional), `catalog_md_path` (`.specwork/catalog/entity-catalog.md`), `report_json_path` (`.specwork/catalog/entities-report.json`).
- Produces: `entity-catalog.md` + `entities-report.json` (contracts above). Task 4 publishes both.

- [ ] **Step 1: Write the agent definition**

Create `feature-catalog/agents/gap-synthesizer/gap-synthesizer.md`:
````markdown
---
name: gap-synthesizer
description: >
  Merges all per-entity ent_*.json files from the feature-catalog pipeline into the final
  deliverable: entity-catalog.md (a VMS-framed, per-entity lifecycle catalog with Present/Partial/
  Missing capabilities) and entities-report.json (structured index with per-entity and overall
  coverage). Worker for the feature-catalog pipeline; not for standalone use.
tools: Read, Glob, Grep, Write
---

You are the **gap-synthesizer**. You assemble the final entity-lifecycle catalog from the
per-entity analyses. You read no walk output and walk nothing.

## Inputs

- **catalog_dir** (required): directory holding `ent_*.json` files, e.g. `.specwork/catalog/`.
- **app_name** (required): display name, e.g. `Dayforce Flex Work VMS`.
- **app_slug** (required): snake_case slug, default `vms`.
- **prototype_source** (required): the URL or path the catalog was generated from (provenance).
- **unverified** (optional, default false): when true, the prototype was not rendered — add an
  "UNVERIFIED — generated without rendering" note to the intro.
- **context_path** (optional): `.specwork/context.md`. Terminology only.
- **catalog_md_path** (required): output path for the Markdown catalog.
- **report_json_path** (required): output path for the JSON report.

## Task

### 1. Read all entity files
Read every `ent_*.json` in `catalog_dir`. Each has `slug, name, role, states, transitions,
capabilities, coverage`. Skip any file that fails to parse and note it in your return.

### 2. Compute overall coverage
Sum each entity's `coverage` into `overall_coverage` (`present`, `partial`, `missing`,
`expected_total`).

### 3. Order entities
Order entities by **descending missing count** (the biggest lifecycle gaps first), tie-break
alphabetically by `name`, so the entities most under-served by the prototype surface at the top.

### 4. Write entities-report.json
Write `report_json_path`:

```json
{ "app": "<app_slug>", "generated_from": "<prototype_source>",
  "overall_coverage": { "present": 0, "partial": 0, "missing": 0, "expected_total": 0 },
  "entities": [ <each ent_*.json object, unchanged, in the chosen order> ] }
```

### 5. Write entity-catalog.md
Write `catalog_md_path`:

```markdown
# <app_name> — VMS Entity Lifecycle Catalog

<One paragraph: frame the app as a VMS, name the entities found, and state overall coverage —
"N entities; M of K expected capabilities present (P partial, X missing)". If `unverified` is
true, begin the paragraph with "**UNVERIFIED — generated without rendering.**">

## <Entity name> — <role>
**Lifecycle states:** <observed/expected as a path>
  (observed: …; expected-but-unseen: …)
**Capabilities:**
- ✅ <name> — present (screens: <evidence>)
- ⚠️ <name> — partial (<note>)
- ❌ <name> — missing (<note: why commonly expected>)
**Coverage:** <present> / <expected_total> present (<partial> partial, <missing> missing)
```

Use `✅` present, `⚠️` partial, `❌` missing. One line per capability. List entities in the
chosen order. Behavioral altitude — WHAT not HOW; no file paths/endpoints/schema. English only;
no checkboxes; no `<details>`; no internal links.

## Return

Reply with: both output paths, entity count, overall coverage line, and any `ent_*.json` that
failed to parse.
````

- [ ] **Step 2: Write the README**

Create `feature-catalog/agents/gap-synthesizer/README.md`:
```markdown
# gap-synthesizer

Merges all per-entity `ent_*.json` files into the final deliverable:
`entity-catalog.md` (VMS-framed, per-entity lifecycle catalog with
Present/Partial/Missing capabilities) and `entities-report.json` (structured
index with per-entity and overall coverage, biggest gaps first). Worker agent
for the feature-catalog pipeline; not for standalone use.

**Tools:** Read, Glob, Grep, Write
```

- [ ] **Step 3: Verify structure**

Run:
```bash
python3 - <<'EOF'
import pathlib
t = pathlib.Path("feature-catalog/agents/gap-synthesizer/gap-synthesizer.md").read_text()
assert t.startswith("---\n")
fm = t.split("---\n", 2)[1]
assert "name: gap-synthesizer" in fm and "tools:" in fm
for s in ["## Inputs", "## Task", "## Return", "entities-report.json", "entity-catalog.md",
          "overall_coverage", "descending missing", "unverified", "✅", "⚠️", "❌"]:
    assert s in t, f"missing: {s}"
assert "prototype-to-spec" not in t and "spec-pipeline" not in t
print("VERIFY_OK")
EOF
```
Expected: `VERIFY_OK`.

- [ ] **Step 4: Commit**

```bash
git add feature-catalog/agents/gap-synthesizer/
git commit -m "feat(feature-catalog): add gap-synthesizer worker agent"
```

---

## Task 4: Rewrite the `feature-catalog` orchestrator SKILL.md

**Files:**
- Modify (full rewrite): `feature-catalog/skills/feature-catalog/SKILL.md`

**Interfaces:**
- Consumes: user inputs `prototype`, `app_slug` (default `vms`), `resources_path`. Locates own scripts `walk_prototype.py`, `extract_bundle.py`. Dispatches `entity-discoverer` (Task 1), `entity-lifecycle-analyst` (Task 2), `gap-synthesizer` (Task 3) with exactly their declared inputs.
- Produces: `catalog/<app_slug>/entity-catalog.md` + `catalog/<app_slug>/entities.json`.

- [ ] **Step 1: Replace SKILL.md with the entity-flow orchestrator**

Overwrite `feature-catalog/skills/feature-catalog/SKILL.md` with exactly:
````markdown
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
````

- [ ] **Step 2: Verify structure and worker-input consistency**

Run:
```bash
python3 - <<'EOF'
import pathlib
t = pathlib.Path("feature-catalog/skills/feature-catalog/SKILL.md").read_text()
assert t.startswith("---\n")
fm = t.split("---\n", 2)[1]
assert "name: feature-catalog" in fm and "description:" in fm
# worker inputs the agents require must be named by the orchestrator
for s in ["entity-discoverer", "entity-lifecycle-analyst", "gap-synthesizer",
          "entity_name", "entity_slug", "role", "evidence_screens",          # analyst
          "catalog_dir", "app_name", "prototype_source", "unverified",
          "catalog_md_path", "report_json_path",                              # synthesizer
          "entities.json", "ent_<entity_slug>.json", "entity-catalog.md", "entities-report.json",
          "walk_prototype.py", "extract_bundle.py"]:
    assert s in t, f"orchestrator missing: {s}"
# must NOT reference retired components or the source pipeline's scripts
for bad in ["group_screens", "module-cataloger", "catalog-synthesizer", "prototype-to-spec/scripts"]:
    assert bad not in t, f"orchestrator still references retired/foreign: {bad}"
assert "skills/feature-catalog/scripts" in t, "does not locate own scripts"
print("VERIFY_OK")
EOF
```
Expected: `VERIFY_OK`.

- [ ] **Step 3: Commit**

```bash
git add feature-catalog/skills/feature-catalog/SKILL.md
git commit -m "feat(feature-catalog): rewrite orchestrator for entity-lifecycle flow"
```

---

## Task 5: Rewrite the pipeline README

**Files:**
- Modify (full rewrite): `feature-catalog/README.md`

**Interfaces:** Consumes nothing. Produces documentation only.

- [ ] **Step 1: Replace README.md**

Overwrite `feature-catalog/README.md` with exactly:
```markdown
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
```

- [ ] **Step 2: Verify**

Run:
```bash
python3 - <<'EOF'
import pathlib
t = pathlib.Path("feature-catalog/README.md").read_text()
for s in ["entity-discoverer", "entity-lifecycle-analyst", "gap-synthesizer",
          "entity-catalog.md", "entities.json", "Present", "Partial", "Missing"]:
    assert s in t, f"README missing: {s}"
for bad in ["module-cataloger", "catalog-synthesizer", "group_screens"]:
    assert bad not in t, f"README still references retired: {bad}"
print("VERIFY_OK")
EOF
```
Expected: `VERIFY_OK`.

- [ ] **Step 3: Commit**

```bash
git add feature-catalog/README.md
git commit -m "docs(feature-catalog): rewrite README for entity-lifecycle flow"
```

---

## Task 6: Retire module-centric components + final sweep

**Files:**
- Delete: `feature-catalog/agents/module-cataloger/` (dir)
- Delete: `feature-catalog/agents/catalog-synthesizer/` (dir)
- Delete: `feature-catalog/skills/feature-catalog/scripts/group_screens.py`
- Delete: `feature-catalog/skills/feature-catalog/scripts/test_group_screens.py`
- Remove (untracked test output): `catalog/vms/feature-catalog.md`, `catalog/vms/features.json` if present

**Interfaces:** Consumes nothing. Removes superseded components.

- [ ] **Step 1: Delete the retired components**

```bash
git rm -r feature-catalog/agents/module-cataloger feature-catalog/agents/catalog-synthesizer \
          feature-catalog/skills/feature-catalog/scripts/group_screens.py \
          feature-catalog/skills/feature-catalog/scripts/test_group_screens.py
# module-centric test output (untracked); remove if present
rm -f catalog/vms/feature-catalog.md catalog/vms/features.json
rmdir catalog/vms catalog 2>/dev/null || true
```

- [ ] **Step 2: Verify the retired components are gone and nothing references them**

Run:
```bash
echo "=== retired files absent? ==="
for p in feature-catalog/agents/module-cataloger feature-catalog/agents/catalog-synthesizer \
         feature-catalog/skills/feature-catalog/scripts/group_screens.py \
         feature-catalog/skills/feature-catalog/scripts/test_group_screens.py; do
  [ -e "$p" ] && echo "STILL PRESENT: $p" || echo "gone: $p"
done
echo "=== no live references to retired components ==="
grep -RnE "group_screens|module-cataloger|catalog-synthesizer" feature-catalog/ \
  && echo "FOUND_REFERENCE (must fix)" || echo "NO_RETIRED_REFERENCES"
echo "=== independence (runtime) ==="
grep -RnE "prototype-to-spec/scripts|spec-pipeline/" feature-catalog/ \
  && echo "RUNTIME_DEP_FOUND (must fix)" || echo "INDEPENDENT_OK"
echo "=== scripts dir now holds exactly the two walk scripts ==="
ls feature-catalog/skills/feature-catalog/scripts/
```
Expected: all four `gone:`; `NO_RETIRED_REFERENCES`; `INDEPENDENT_OK`; the scripts dir lists only `walk_prototype.py` and `extract_bundle.py`.

- [ ] **Step 3: Commit**

```bash
git add -A feature-catalog
git commit -m "refactor(feature-catalog): retire module-centric components"
```

---

## Self-Review

**Spec coverage** (redesign doc → task):
- Reuse Stage 0/1 + vendored scripts → Task 4 (SKILL Stage 0/1) keeps them; Task 6 keeps the two scripts.
- entity-discoverer (prototype-grounded entity list + evidence) → Task 1.
- entity-lifecycle-analyst (expected states+transitions+capabilities from reasoning, Present/Partial/Missing, justified Missing) → Task 2.
- gap-synthesizer (merge, overall coverage, ordering by gap, entity-catalog.md + entities-report.json) → Task 3.
- Orchestrator stages 0–5, optional inline context, source-only/UNVERIFIED, progress block, stop rules, publish entities-report.json→entities.json → Task 4.
- README + retirement of module-cataloger/catalog-synthesizer/group_screens → Tasks 5, 6.
- Output `catalog/<app_slug>/entity-catalog.md` + `entities.json`, default vms → Tasks 3, 4.
- Status semantics, category enum, glyphs, example-data/altitude rules → Global Constraints + Tasks 2, 3.

**Type/contract consistency:** `entities.json` array shape (Task 1) == read by analyst + orchestrator (Tasks 2, 4). `ent_<slug>.json` shape (Task 2) == read by synthesizer (Task 3). `entities-report.json` embeds the same ent objects (Task 3) and is published as `entities.json` (Task 4). Orchestrator passes exactly the inputs each agent declares (verified by Task 4 Step 2 assertion). Retired names (`group_screens`, `module-cataloger`, `catalog-synthesizer`) are absent from SKILL (Task 4 assertion) and the whole tree (Task 6 sweep).

**Placeholder scan:** none — every file's full content is inline; every verification step has an exact command and expected output.

**Note on test style:** the redesign removes the only unit-tested script (`group_screens.py`); the remaining deliverables are Markdown agent/skill definitions and unchanged vendored scripts. "Tests" are structural assertion scripts per file that fail before the file exists/rewrite and pass after — the same red→green loop, appropriate to prose artifacts. End-to-end behavior is validated by running the pipeline on a real prototype after the plan completes (as done for the prior build).
