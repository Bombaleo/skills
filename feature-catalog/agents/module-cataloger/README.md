# module-cataloger

Catalogs the user-facing features of **one module** of a walked prototype. Reads
only the walk outlines for its assigned screens (plus matching source when
present) and writes a breadth-first feature list — name + one-sentence
description + originating screens — to `mod_<slug>.json`. Worker agent for the
feature-catalog pipeline; not for standalone use.

**Tools:** Read, Glob, Grep, Write, Bash
