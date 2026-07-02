# Feature-catalog — enable-all-features script

**Date:** 2026-07-02
**Status:** Approved (design)
**Adds:** a standalone `enable_all_features.py` under
`feature-catalog/skills/feature-catalog/scripts/` (stdlib-only, Python 3.9+).

## Problem

Across pipeline runs, many entity capabilities come back **Partial** purely because their
feature flags are OFF in the prototype (Custom Fields, Contractors/1099, SOW, EOR/contractor
invoices, AI Chat, Sales Tax, …). Flags default OFF, so a plain walk never renders those
surfaces and the catalog under-reports what the prototype can do.

We want a **separate, standalone script** that turns every gated feature ON by **editing the
project codebase** — specifically the artifact the walk actually renders — so a subsequent walk
render-confirms those features. It must **not** enable features by clicking through the UI.

## Key facts (from source audit)

- **The walk renders the standalone bundle** (for this prototype
  `Dayforce Flex Work VMS.html`, copied to `/tmp/prototype.html`). The editable `pages/*.jsx`
  modules are embedded gzip'd + base64 inside that bundle's `__bundler/manifest` and do **not**
  feed the walk. Editing the `.jsx` source therefore has no effect on the walk.
- **The dominant visibility guard is `window.getFeatureFlag(key)`** (and its React hook
  `useFeatureFlag`). It resolves the `flexwork.featureFlags` localStorage map first, else the
  flag's `defaultOn` (default `false`). Definition in `pages/feature-flags.jsx`
  (`_ffRead`/`getFeatureFlag`, lines ~970–1022).
- **Discovery rule:** every flag object with a `defaultOn` field is a real, seedable flag
  (**21** in this prototype). The 6 "legacy" ids (`contractors`, `sow`, `milestones`,
  `fixedFee`, `professionalWork`, `v77Axes`) have **no** `defaultOn` — they are **derived** from
  the 5 axis flags (`engAssignment`, `engProject`, `engStatementOfWork`, `independentContractor`,
  `eor`) via `LEGACY_FLAG_DERIVATIONS`. `getFeatureFlag` **ignores** any stored value for a
  derived id. So: seed the real/axis flags true → derived flags light up automatically; never
  seed a derived id.
- **Mutual exclusion:** flags may declare `excludes: [...]`; turning one ON forces those OFF.
  In this prototype there is exactly one pair: `dataModelAlignment` ↔ `vmsEducation`.
- **Mirror keys:** the feature-flags page also writes boolean mirrors
  `flexwork.featureFlags.customFields` and `flexwork.featureFlags.professionalJobTypes`, plus a
  migration-tracking object `flexwork.featureFlags.migrations` (NOT a boolean gate).
- **A separate perspective/role guard exists** (`window.isAgencyOrg`, `viewAsRole` =
  admin/agency/manager). It is a mutually-exclusive **mode**, not a feature — out of scope
  (see below).

## Decision

Approach **A — pre-boot localStorage seed injected into a copy of the standalone HTML.**
Prepend a tiny `<script>` to the standalone's `<head>`, **before** the app bundle, that writes
`flexwork.featureFlags` to an all-ON seed. The app reads the seeded map on first mount, so the
walk renders every gated feature ON. **Non-destructive:** write a new file, leave the original
untouched.

Rejected alternatives:
- **B — patch `defaultOn` inside the gzip'd bundle module.** Requires perfectly re-gzip/
  re-base64-ing the module back into the manifest; a framing mismatch breaks app load. Fragile.
- **C — post-boot: poll for `window.setFeatureFlag` and call it per flag.** Sets flags *after*
  first render; components that read `getFeatureFlag` at mount (not via the hook) won't update
  until navigation, so the walk can capture pre-enable state. Timing-dependent, less reliable
  than a pre-boot seed.

## Components / data flow

Input: a standalone `.html`. Output: `<stem>.all-features.html` beside it (configurable).

1. **Discover the flag catalog.** Reuse `extract_bundle`'s decode to obtain the module text
   containing `FEATURE_FLAG_GROUPS` + `defaultOn` (identify by that signature among decoded
   files). Feed its text to the parser. (Decoding into a temp dir; no dependency on a prior
   pipeline run.)
2. **Parse.** `parse_flag_catalog(source_text)` → real flag ids (those with a `defaultOn`
   sibling) and an `excludes` map.
3. **Build seed.** `build_seed(catalog)` → every real id `true`, exclusion pairs resolved
   (source-order-first wins → `dataModelAlignment` ON, `vmsEducation` OFF), plus the two boolean
   mirror keys set true. `.migrations` left untouched.
4. **Inject.** `inject_seed(html, seed)` → insert
   `<script>try{localStorage.setItem("flexwork.featureFlags", JSON.stringify(<seed-map>));
   localStorage.setItem("flexwork.featureFlags.customFields","true"); …}catch(e){}</script>`
   before the first bundle `<script>` (fallback: just before `</head>`). Write the new file.
5. **Report + fail-loud.** Print the count of flags enabled and the exclusions resolved. If 0
   flags were discovered, exit non-zero (discovery broke) rather than emit a no-op file.

## Interfaces / testing

Pure, module-level, unit-tested functions:

- `parse_flag_catalog(source_text: str) -> dict` — returns
  `{"real_ids": [str, ...], "excludes": {id: [id, ...]}}`. A flag id is any `id: "<x>"` /
  `id: '<x>'` whose object literal also contains `defaultOn`. `excludes` captured from
  `excludes: [ ... ]` within the same flag object.
- `build_seed(catalog: dict) -> dict` — map of `{flag_id: True}` for every real id, then for
  each flag processed in source order, set each id in its `excludes` list to `False`
  (an id already forced `False` stays `False`). Includes the mirror keys as a separate
  returned structure or merged write list (implementation detail; the injected script sets the
  `flexwork.featureFlags` map plus the two boolean mirror keys).
- `inject_seed(html: str, seed: dict) -> str` — returns the HTML with the seed `<script>`
  inserted before the first `<script` tag that follows `__bundler/manifest`/the app bundle,
  else immediately before `</head>`, else prepended. Idempotent: if a seed script marker
  (`data-enable-all-features`) is already present, replace it rather than add a second.

Tests (`test_enable_all_features.py`, unittest):
- `parse_flag_catalog` on a fixture with 3 real flags (one with `excludes`), one derived id
  (no `defaultOn`) → returns exactly the 3 real ids and the excludes map; derived id absent.
- `build_seed` → all real ids true; excluded id forced false; mirror keys present.
- `build_seed` exclusion order: first-declared flag stays true, its excluded partner false.
- `inject_seed` inserts before the bundle script; marker present in output.
- `inject_seed` idempotency: running twice yields one seed script, not two.
- Zero-flag guard: `parse_flag_catalog("")` → empty real_ids (caller exits non-zero).

Integration validation (not a unit test): run the script on
`Dayforce Flex Work VMS.html`, walk the resulting `…all-features.html`, and confirm
previously-Partial surfaces (Custom Fields, Contractors/1099, SOW, EOR/contractor invoices)
now render — i.e., they move Partial → Present when the catalog is regenerated.
`python3 -m py_compile enable_all_features.py` and the existing suites
(`test_walk_screenshot_clip`, `test_walk_append`, `test_normalize_hints`,
`test_compute_coverage`, `test_feature_list`) stay green.

## CLI

```
python3 enable_all_features.py <standalone.html> [--out <path>] [--print-seed]
```
- Default `--out`: `<stem>.all-features.html` next to the input.
- `--print-seed`: print the computed seed JSON to stdout and exit (no file written) — for
  inspection/debugging.
- Exit non-zero with a clear message if no `__bundler/manifest` is found or 0 flags discovered.

## Trade-offs / risks

- Regex-parsing the JS catalog is mildly fragile → mitigated by fixture unit tests, the
  fail-loud zero-flag guard, and printing the enabled count so a silent under-seed is visible.
- The one exclusion pair leaves `vmsEducation` OFF (inherent — both can't be visibly on). A
  future `--prefer <id>` flag could flip the choice; not built now (YAGNI).
- Seeding bypasses `setFeatureFlag`'s runtime exclusion enforcement, so the seed itself must be
  internally consistent — that is exactly what `build_seed`'s exclusion resolution guarantees.
- Non-destructive by construction (new file); the walk must be pointed at the new file
  explicitly.

## Out of scope

- Re-encoding / mutating the original bundle (Approach B).
- The role/perspective switch (`isAgencyOrg`, `viewAsRole`) — mutually-exclusive modes, better
  covered by separate role-scoped walks.
- Per-org data-config stores (contractor-config, supplier-types per-org records, project-config)
  that hold data/policy rather than simple on/off visibility gates.
- Wiring the script into the pipeline by default. It is a standalone utility run manually before
  a walk; SKILL.md may gain an optional one-line pointer, but the default flow is unchanged.

## Files

```
feature-catalog/skills/feature-catalog/scripts/enable_all_features.py       # new standalone script
feature-catalog/skills/feature-catalog/scripts/test_enable_all_features.py  # new unittest
```
