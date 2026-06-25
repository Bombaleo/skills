# gap-synthesizer

Merges all per-entity `ent_*.json` files into the final deliverable:
`entity-catalog.md` (VMS-framed, per-entity lifecycle catalog with
Present/Partial/Missing capabilities) and `entities-report.json` (structured
index with per-entity and overall coverage, biggest gaps first). Worker agent
for the feature-catalog pipeline; not for standalone use.

**Tools:** Read, Glob, Grep, Write
