# Feature-catalog — deterministic coverage step

**Date:** 2026-06-25
**Status:** Approved (design)
**Builds on:** `2026-06-25-feature-catalog-entity-lifecycle-redesign.md`

## Problem

The end-to-end test of the entity-lifecycle pipeline (against the Dayforce Flex Work VMS
prototype) surfaced a data-quality bug: the `entity-lifecycle-analyst` hand-tallies its own
`coverage` block, and the LLM got the present/partial/missing split wrong in **10 of 12**
entity files. The per-capability `status` values (the substantive analysis) were correct and
the `expected_total` matched, but the present/partial/missing counts did not match the actual
capabilities array. Counts derived by an LLM over ~15–20 items per entity (and ~184 overall)
are not reliable; coverage must be computed deterministically.

## Decision

| Question | Decision |
|---|---|
| Where does coverage get computed? | **A small deterministic helper script** (`compute_coverage.py`), run as a new orchestrator stage between per-entity analysis and synthesis — mirrors the proven `group_screens.py` pattern. Not in-prose by an LLM. |
| Coverage scope | **Capabilities only.** Coverage counts capability statuses (present/partial/missing). Lifecycle states/transitions remain shown on the catalog's "Lifecycle states" line but do not roll into the coverage number (unchanged from the redesign). |
| Analyst's role | Still emits a `coverage` block (contract unchanged) but it is **not authoritative**; the analyst's job is accurate per-capability statuses. The script overwrites coverage. |

## Approach

### New script: `feature-catalog/skills/feature-catalog/scripts/compute_coverage.py`
- Stdlib only, Python 3.9+ (same constraints as the other scripts).
- CLI: `compute_coverage.py <catalog_dir>` — processes every `ent_*.json` in `catalog_dir`.
- For each file: recompute `coverage` from the `capabilities` array —
  `present` = count of capabilities with `status == "present"`, likewise `partial`, `missing`;
  `expected_total = len(capabilities)`. Write the corrected `coverage` block back into the file.
  All other fields (slug, name, role, states, transitions, capabilities) are left untouched.
- Capability statuses outside the set {present, partial, missing} are not counted toward any
  bucket but are reported on stderr as a warning (they indicate an analyst error); `expected_total`
  still equals `len(capabilities)` so an out-of-set status surfaces as `present+partial+missing <
  expected_total` — a visible signal rather than a silent miscount.
- Prints the summed overall coverage (`present/partial/missing/expected_total`) to stdout as JSON
  and a one-line human summary.
- Exposes `compute_file_coverage(entity: dict) -> dict` and
  `recompute_dir(catalog_dir: str) -> dict` (returns overall) for direct import by the test.

### Orchestrator: SKILL.md — new Stage 3.5
After Stage 3 (per-entity analysis) confirms every `ent_<slug>.json` exists, and before Stage 4
(synthesis):
```bash
python3 "$SCRIPTS/compute_coverage.py" .specwork/catalog
```
This normalizes every entity's `coverage` block in place and is the source of truth. Note in the
stage that the gap-synthesizer consumes these normalized blocks.

### `entity-lifecycle-analyst.md`
Keep the `coverage` block in the output contract (so the file is self-describing), but add one
line: "A deterministic downstream step recomputes `coverage` from your capability statuses, so
your responsibility is accurate per-capability `status` values, not the tally." This removes the
implicit pressure to hand-count and documents the real source of truth.

### `gap-synthesizer.md`
Behavior unchanged — it already sums the per-entity `coverage` blocks into `overall_coverage`.
Add one line noting those blocks are pre-normalized by the Stage 3.5 deterministic step (so it
should trust them and not re-tally).

## Rejected alternatives
- **Synthesizer recomputes in-prose:** still an LLM counting ~184 items — the same failure mode.
- **Analyst self-verifies its own count:** LLMs are unreliable at exactly this; a re-count is no
  more trustworthy than the first.

## Testing
- `compute_coverage.py`: a real `unittest` suite —
  - a mismatched `coverage` block is corrected to match the capabilities array;
  - capability `status` values and all other fields are preserved (only `coverage` changes);
  - `recompute_dir` returns the correct summed overall;
  - an out-of-set status is excluded from buckets (and `expected_total` still = capability count);
  - empty capabilities → all-zero coverage.
- Structural assertion checks on the three edited markdown files (Stage 3.5 present in SKILL;
  analyst/synthesizer notes present; no retired references; independence preserved).

## Out of scope
- Folding states/transitions into coverage (capabilities-only confirmed).
- Any change to entity discovery, the walk, or the synthesizer's ordering/markdown.

## Files
```
feature-catalog/skills/feature-catalog/scripts/compute_coverage.py        # new
feature-catalog/skills/feature-catalog/scripts/test_compute_coverage.py   # new
feature-catalog/skills/feature-catalog/SKILL.md                            # +Stage 3.5
feature-catalog/agents/entity-lifecycle-analyst/entity-lifecycle-analyst.md # +1 note
feature-catalog/agents/gap-synthesizer/gap-synthesizer.md                  # +1 note
```
