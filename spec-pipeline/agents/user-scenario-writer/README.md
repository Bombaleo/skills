# user-scenario-writer

Opt-in Wave B worker. Writes composite narrative user-journey files
(`sc_*.md`) for one user story — a small set of realistic journeys (typically
2–3) that together reference every use case at least once, rather than one
mechanical retelling per use case. Reads the shared walk output for sensory
detail. Surfaces requirements-level gaps in a "Gaps Noticed" section that
question-resolver collects. Runs only when the pipeline is invoked with
scenarios enabled. Not for standalone use.

**Tools:** Read, Glob, Grep, Write, Edit, Bash
