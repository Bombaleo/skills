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
```

## spec-pipeline

A pipeline that turns a Claude Design prototype (a design URL or a local
prototype path) into a validated, split requirements document.

- The **`spec-pipeline` skill** drives the pipeline conversationally
  (human in the loop).
- The **`spec-pipeline` agent** runs it headlessly and returns structured
  JSON for embedding in other workflows.

Both delegate to the worker agents in `agents/`.
