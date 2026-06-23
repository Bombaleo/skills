# prototype-speccer

Walks a Claude Design prototype (a design URL or a local prototype path,
default `./project`) and produces the epic-level requirements files:
`main.md` (epic skeleton without per-story AC), `glossary.md`, and
`stories.json` (the story list the pipeline expands). Entry-point walker for
the pipeline; also usable directly to build a spec from a design.

**Tools:** Read, Glob, Grep, Write, Edit, WebFetch, Bash
