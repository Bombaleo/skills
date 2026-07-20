# entity-lifecycle-analyst

Analyses ONE domain entity against its expected VMS lifecycle: derives the
entity's expected states + transitions and CRUD/archive/operation capabilities
from VMS domain reasoning, checks each against the prototype evidence, and marks
it Present / Partial / Missing (every Missing justified). Writes `ent_<slug>.json`.
Worker agent for the feature-catalog pipeline; not for standalone use.

**Tools:** Read, Glob, Grep, Write, Bash
