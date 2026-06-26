# source-mapper

Builds `map.json` from the prototype's extracted **source** (not by walking):
nav structure, domain entities, per-entity features each with a nav entry-hint,
and lifecycle states/transitions taken from source. The authority for what the
app contains; the walker later confirms reachability. Falls back to walk-based
discovery when no source is extractable. Worker agent for the feature-catalog
pipeline; not for standalone use.

**Tools:** Read, Glob, Grep, Write, Bash
