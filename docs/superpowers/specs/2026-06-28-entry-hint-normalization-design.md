# Feature-catalog — entry-hint normalization

**Date:** 2026-06-28
**Status:** Approved (design)
**Fixes a gap in:** `2026-06-26-source-first-discovery-design.md`

## Problem

The first end-to-end run of the source-first flow (on the Rate Automation prototype) surfaced a
flow-breaking defect: the `source-mapper` emitted each feature's `entry_hint` as a **descriptive
string** rather than the **array of clickable nav labels** its contract specifies. All 67 hints
in the run looked like `"Settings → Rate automation → Uploads"`, many with wizard-step annotations
`(wizard ③ Preview & fix → Compare changes)`, dynamic placeholders `[version]` / `[rule]` /
`[agency name]`, and in-page action verbs (`Delete`, `Apply`, `Continue`, `Add rule`). Fed to
`walk_prototype.py --nav` (which splits on commas and clicks each visible label in turn), these
are not clickable, so **every Stage 3 confirmation walk would fail** → every feature would stay
`partial` → the confirmation step becomes a no-op and the source-first value proposition is lost.

This is the weak link of the source-first design: it assumed the LLM `source-mapper` would emit
clean, walker-consumable nav paths. It does not reliably do so.

## Decision

Fix it the way we fixed coverage and the feature list: **keep the LLM for judgment, add
deterministic mechanics for the format the walker depends on.**

| Question | Decision |
|---|---|
| Where do clean nav paths come from? | A deterministic `normalize_hints.py` post-processes `map.json` into clickable `entry_path` arrays; the `source-mapper` contract is also tightened to emit arrays, but the normalizer is the safety net regardless of LLM variance. |
| How to handle dynamic/in-page segments | **Truncate at the first dynamic segment.** Keep the leading run of static nav labels; STOP at the first `[placeholder]`, pure `(annotation)`, or action-verb step. Walk to the deepest concrete nav point; the walker's own depth explores within that screen. |
| Keep the original hint? | Yes — keep `entry_hint` for traceability; add `entry_path` (clean array) per feature and a top-level `walk_targets`. |

## Components

### New: `normalize_hints.py` (deterministic, tested)
- Stdlib only, Python 3.9+. CLI: `normalize_hints.py <map_json>` — rewrites `map.json` in place,
  prints the number of distinct walk targets.
- **`normalize_hint(hint) -> list[str]`**: accepts a string or a list.
  1. Produce raw segments: if a string, split on `→`, `>`, and `,`; if a list, use as-is.
  2. Walk segments left→right. For each:
     - Strip surrounding whitespace.
     - **STOP** (discard this and all later segments) if the segment, after trimming, is:
       a `[...]` placeholder (contains `[` and `]`); OR begins with `(` (pure annotation); OR
       is an **action verb** (case-insensitive exact match against a small set:
       `add, edit, delete, remove, apply, continue, publish, pin, download, save, cancel, next,
       back, add rule, add group, compare changes`).
     - Otherwise **keep** the segment, but first strip a trailing `(...)` annotation
       (`"Rate Cards (wizard ④)"` → `"Rate Cards"`) and surrounding brackets, and collapse
       internal whitespace. Skip a segment that becomes empty after cleaning.
  3. Return the kept-label list (possibly empty).
- **`normalize_map(m) -> dict`**: for each `entities[].features[].entry_hint`, set
  `feature["entry_path"] = normalize_hint(entry_hint)`. Compute the top-level
  `m["walk_targets"]` = the sorted, de-duplicated list of non-empty `entry_path`s
  (each a list; dedupe by their tuple form). Leave `entry_hint` and all other fields untouched.
- **`main()`**: load map_json, `normalize_map`, write back (indent=2), print
  `f"{len(walk_targets)} walk targets"`.
- Functions exposed for tests: `normalize_hint`, `normalize_map`.

### Tightened: `source-mapper` agent
- Change the `entry_hint` field spec: it MUST be a **JSON array of literal clickable nav labels**
  giving the **shortest real nav click-path** to the feature's screen. Explicitly prohibit:
  `→`-joined strings, `(...)` annotations, `[placeholder]` segments, and in-page action verbs.
  Add a good example (`["Settings","Rate automation","Uploads"]`) and a bad example
  (`"Settings → Rate automation → Uploads (wizard ③ …)"`). This reduces normalizer work but the
  normalizer still runs as the deterministic guarantee.

### Orchestrator: new Stage 2.5 + revised Stage 3
- **Stage 2.5 — Normalize hints (deterministic):** after source-mapper writes `map.json` and
  before Stage 3, run `python3 "$SCRIPTS/normalize_hints.py" .specwork/catalog/map.json`. It adds
  `entry_path` per feature and a top-level `walk_targets`.
- **Stage 3 — Targeted confirmation walks:** iterate **`walk_targets`** (not raw `entry_hint`).
  For each target run the scoped `--append` walk with `--nav "<comma-joined entry_path labels>"`.
  A target that isn't clickable is recorded as unreached (its features stay Partial), not a stop.
  (Cap and clean-start behavior unchanged.)
- **Stage 4 — analyst:** continues to read `map.json`; it may use a feature's `entry_path` to
  identify which walk screens confirm it. No output-shape change.

## Artifact contract (additions)
`map.json` after Stage 2.5 gains: `walk_targets` (top-level list of clean label-arrays) and a
`entry_path` array on each feature (alongside the original `entry_hint`).

## Testing
- `normalize_hints.py` unittest:
  - a `→`-joined string with a trailing `(annotation)` → truncated clean array
    (`"Settings → Rate automation → Rate Cards (wizard ④) → [version] → Delete"` →
    `["Settings","Rate automation","Rate Cards"]`);
  - a list input is cleaned and passed through;
  - truncation at an action verb (`["Uploads","Apply"]` → `["Uploads"]`);
  - truncation at a `[placeholder]` (`["Rate Engine","[version]","Add group"]` → `["Rate Engine"]`);
  - first segment dynamic → empty list;
  - `normalize_map` builds a de-duplicated `walk_targets` and preserves all other map fields.
- Structural assertion checks on the source-mapper tightening (array contract + prohibitions +
  examples) and the SKILL Stage 2.5/Stage 3 edits (runs normalize_hints.py; Stage 3 uses
  walk_targets). End-to-end re-validated by resuming the source-first run afterward.
- Independence preserved; no `spec-pipeline`/`prototype-to-spec` refs.

## Out of scope
- A walker URL/route navigation mode (only relevant if a prototype abandons click-nav).
- Re-running the analyst's screen↔feature matching deterministically (still LLM judgment).

## Files
```
feature-catalog/skills/feature-catalog/scripts/normalize_hints.py + test      # new (TDD)
feature-catalog/agents/source-mapper/source-mapper.md                          # tighten entry_hint contract
feature-catalog/skills/feature-catalog/SKILL.md                                # +Stage 2.5; Stage 3 uses walk_targets
```
