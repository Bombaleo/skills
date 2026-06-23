# spec-pipeline (agent)

Headless orchestrator for the spec pipeline. Turns a Claude Design prototype
(a design URL or a local prototype path, default `./project`) into a
validated, split requirements document and returns structured JSON. Use when
embedding the pipeline in another workflow or agent. For interactive,
human-in-the-loop use, use the `spec-pipeline` skill instead.

**Tools:** Task, Read, Glob, Grep, Write, Bash
