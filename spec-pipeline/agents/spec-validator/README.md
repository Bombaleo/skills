# spec-validator

Validates draft spec files (`.specwork/`) against gathered context and writes
a structured verdict. Three modes let the orchestrator fan validation out:
per-story (`story_slug` — validates one `us_<slug>/` directory), epic
(`epic_only` — validates `main.md`, `glossary.md`, `objects.md`), or full
(neither — validates everything; standalone use).

**Tools:** Read, Glob, Grep, Write
