# story-speccer

Writes the complete per-story requirements package for one user story:
`us_<slug>/story.md` plus structured use cases under `us_<slug>/use_cases/`
with a coverage report. Reads the shared prototype walk (`/tmp/proto-walk`)
and extracted source (`/tmp/proto-src`) from prototype-speccer rather than
re-walking. Also handles revision rounds for discrepancies in `story.md` or
`uc_*.md`. Worker agent; not for standalone use.

**Tools:** Read, Glob, Grep, Write, Edit, Bash
