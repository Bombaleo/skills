# catalog-synthesizer

Merges all per-module `mod_*.json` files into the final deliverable:
`feature-catalog.md` (a VMS-framed, module → feature catalog, one line per
feature) and `features.json` (structured index). Dedups cross-cutting features
into their own group. Worker agent for the feature-catalog pipeline; not for
standalone use.

**Tools:** Read, Glob, Grep, Write
