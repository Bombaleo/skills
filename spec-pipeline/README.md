# spec-pipeline

A pipeline that turns a **Claude Design prototype** — a design URL or a local
prototype path (default `./project`) — into a **validated, split requirements
document**.

There are two ways to run it:

- The **`spec-pipeline` skill** drives the pipeline conversationally, with a
  human in the loop.
- The **`spec-pipeline` agent** runs it headlessly and returns structured
  JSON, for embedding in other workflows.

Both delegate to the worker agents below.

## Skills (`skills/`)

| Skill | Purpose |
|-------|---------|
| `gather-context` | Distill a project's resource docs into a reusable context digest. |
| `prototype-to-spec` | Convert a single client-approved prototype into a functional spec. |
| `spec-pipeline` | Interactive, human-in-the-loop pipeline orchestrator. |
| `spec-pipeline-viewer` | Build a visual dashboard (Vite + React) for the spec output. |
| `validate-spec` | Validate a draft spec against gathered context; emit a pass/needs-revision verdict. |

## Agents (`agents/`)

Each agent lives in its own folder with a short `README.md`.

| Agent | Role |
|-------|------|
| `context-gatherer` | Collect project context into `.specwork/context.md`. |
| `prototype-speccer` | Walk the prototype → `main.md`, `glossary.md`, `stories.json`. |
| `object-modeler` | Catalog domain entities → `objects.md`. |
| `story-speccer` | Write per-story `story.md` + use cases. |
| `user-scenario-writer` | (Opt-in) Write composite narrative user journeys. |
| `question-resolver` | Resolve open questions against context. |
| `spec-validator` | Validate draft spec files; write structured verdicts. |
| `spec-pipeline` | Headless orchestrator (returns JSON). |
| `pipeline-reviewer` | Audit the pipeline's own design for gaps. |

## Pipeline flow

```
context-gatherer → prototype-speccer → object-modeler
   → story-speccer (per story) [+ user-scenario-writer]
   → question-resolver → spec-validator (fanned out per story)
```
