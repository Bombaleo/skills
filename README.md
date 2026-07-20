# skills

Personal Claude Code skills and agents, organized by feature area.

## Structure

Each top-level folder is a self-contained feature area holding its own
`skills/` and `agents/`.

```
spec-pipeline/        Turn a Claude Design prototype into a validated spec
├── skills/           Skills (invoked via the Skill tool)
│   ├── gather-context/
│   ├── prototype-to-spec/
│   ├── spec-pipeline/          interactive, human-in-the-loop orchestrator
│   ├── spec-pipeline-viewer/   visual dashboard for spec output
│   └── validate-spec/
└── agents/           Subagents (invoked via the Agent tool)
    ├── context-gatherer.md
    ├── object-modeler.md
    ├── pipeline-reviewer.md
    ├── prototype-speccer.md
    ├── question-resolver.md
    ├── spec-pipeline.md        headless orchestrator (returns structured JSON)
    ├── spec-validator.md
    ├── story-speccer.md
    └── user-scenario-writer.md

feature-catalog/      Whole-app entity-lifecycle gap analysis from a prototype
├── skills/
│   └── feature-catalog/        orchestrator + self-contained Python scripts
└── agents/
    ├── source-mapper/          extracted source → map.json (what exists)
    ├── entity-lifecycle-analyst/  per entity: Present / Partial / Missing
    └── gap-synthesizer/        merge analyses → catalog + features list
```

## spec-pipeline

A pipeline that turns a Claude Design prototype (a design URL or a local
prototype path) into a validated, split requirements document.

- The **`spec-pipeline` skill** drives the pipeline conversationally
  (human in the loop).
- The **`spec-pipeline` agent** runs it headlessly and returns structured
  JSON for embedding in other workflows.

Both delegate to the worker agents in `agents/`.

## feature-catalog

A self-contained pipeline that turns a Claude Design prototype (a design URL or
a local prototype path) into a **VMS entity-lifecycle gap analysis** plus an
**implemented-features list**. It maps the app from its extracted source first
(the authority for what exists), then walks each feature to confirm reachability
— marking every entity's expected lifecycle **Present** (render-confirmed),
**Partial** (in source but unreached), or **Missing** (VMS-expected but absent).

Where `spec-pipeline` goes deep on one feature, `feature-catalog` analyses every
entity across the whole app. It depends on nothing in `spec-pipeline` — it ships
its own scripts.

### Making the skill visible to Claude Code

Claude Code only discovers skills and agents under a scanned directory —
**project** (`.claude/` in the repo you're working in) or **personal**
(`~/.claude/`).

**In this repo it already works.** The `.claude/` directory holds committed
symlinks that register the skill and its three worker agents at the project
level:

```
.claude/skills/feature-catalog          -> ../../feature-catalog/skills/feature-catalog
.claude/agents/source-mapper.md         -> ../../feature-catalog/agents/source-mapper/source-mapper.md
.claude/agents/entity-lifecycle-analyst.md
.claude/agents/gap-synthesizer.md
```

They are relative symlinks, so they resolve for anyone who clones the repo — no
setup needed. Just start a fresh session so Claude Code rescans; then
`feature-catalog` appears in the skill list and `/feature-catalog` is invokable.
(All three agents must stay registered — the skill delegates to them and the
pipeline breaks mid-run if any is missing.)

**Optional — make it available in every project**, not just this repo, by
symlinking into your personal directory as well:

```bash
REPO="$(pwd)"
ln -s "$REPO/feature-catalog/skills/feature-catalog" ~/.claude/skills/feature-catalog
for a in source-mapper entity-lifecycle-analyst gap-synthesizer; do
  ln -s "$REPO/feature-catalog/agents/$a/$a.md" ~/.claude/agents/$a.md
done
```

### Setup

Everything runs locally; no install step beyond the prerequisites:

- **Python 3.9+** — the pipeline's scripts (`extract_bundle.py`,
  `walk_prototype.py`, `compute_coverage.py`, `feature_list.py`) run under
  `python3`.
- **Google Chrome / Chromium** — used for the headless confirmation walks. Only
  required when the prototype has renderable HTML; source-only runs skip walking.
  Set `CHROME_PATH` if Chrome is installed somewhere non-standard.
- **The skill on the Skill path** — the orchestrator locates its own scripts
  under `.claude/skills/`, `~/.claude/skills/`, or
  `feature-catalog/skills/feature-catalog/scripts/`. Running from this repo root
  works out of the box.

The pipeline's pre-flight checks all of the above and stops with a clear message
if anything is missing.

### Usage

Invoke the **`feature-catalog` skill** and give it a prototype. Natural triggers:
"analyse the entity lifecycles", "what's missing per object", "list the
implemented features", "build an entity gap analysis from this prototype".

Inputs:

- **prototype** (required) — a Claude Design URL, a standalone `.html`, or a
  downloaded project directory. Defaults to `./project` if not given.
- **app_slug** (optional) — snake_case output directory name (default `vms`).
- **resources_path** (optional) — directory of terminology context to align
  names (default `./resources/`; skipped silently if absent).

Output lands in `catalog/<app_slug>/`:

- `entity-catalog.md` — per-entity lifecycle catalog (Present / Partial / Missing).
- `entities.json` — structured report with per-entity and overall coverage plus
  logical groups.
- `features.md` — implemented features (present + partial), grouped by entity group.

See `feature-catalog/README.md` for the full pipeline flow and stage-by-stage
detail.
