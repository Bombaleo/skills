---
name: gather-context
description: Use when a task needs grounding in a project's resource documents — a ./resources or docs directory of BRDs, specs, spreadsheets, or reference files — and a reusable written digest is wanted, either of everything or only what's relevant to a stated target. Also use when asked to "gather context", "summarize the resources", or "prepare context" from a folder of mixed text and binary files.
---

# Gather Context

Distill a resources directory into a written digest that a future session can trust blind.

## Arguments

`/gather-context [path] [target scope]` — first token that resolves to an existing directory is the resources dir (default `./resources`); the rest is the target scope. No target → digest the whole directory; target given → only what's relevant to it.

## Objective

Write a digest file: `CONTEXT.md` in the working directory, or `CONTEXT-<target-slug>.md` when a target is given. Distill — facts, rules, formulas, structure, relationships — never raw dumps.

Two hard requirements make the digest safe to reuse blind:

1. **Claims never exceed coverage.** A per-source section may only assert what its coverage status supports. *(inferred)* marks are allowed only when grounded in content actually extracted — a claim grounded in nothing but a filename does not belong in the digest at all, tagged or not.
2. **Coverage is declared per file**, including what was *not* covered (format below).

## Evidence before writing

1. **Inventory.** List the directory recursively. Classify: text (md, txt, csv, json, …) vs binary (xlsx, xlsm, docx, pdf, …).
2. **Relevance (target mode only).** Include or exclude a file only after touching its content — text: a skim; binaries: at minimum extracted structure (sheet names / headings) plus sampled content. Record the evidence for each exclusion.
   - Borderline files: make the in/out call visible in the Coverage section with one line of reasoning.
   - Nothing matches, or only weak matches: stop, show the inventory, ask.
3. **Extraction.**
   - Text: read it; large files: structural skim, then targeted reads.
   - Spreadsheets: extract sheet names, headers, formulas, and representative rows via script (openpyxl, or unzip the OOXML container and parse worksheet XML + sharedStrings when libraries are unavailable).
   - `.xlsm` macros: attempt VBA extraction (e.g. `olevba`); mark *unextractable* only after a failed attempt, recording the error. Macro behavior described in an instructions sheet is *(inferred)*, never verified.
   - Any extraction failure (corrupt, password-protected, unsupported): record *unextractable* + error. Substituting the filename for the content is the exact failure this skill exists to prevent.

## Digest format

Required sections:

- **Scope line** — resources dir, target scope (or "full"), date.
- **Per-source sections** — file path, what it is, distilled content; *(inferred)* marks where applicable per the claims rule above.
- **Coverage** — one line per file in the directory, including excluded ones:
  `path — included|excluded — read-fully|sampled|structure-only|unextractable — note`
  For `sampled`/`structure-only`/`unextractable`, the note must name what was NOT covered (e.g. "3 of 7 sheets read; VBA not extracted"), not merely flag that something wasn't.
- **Gaps & open questions** — inconsistencies found, unverified inferences, regions worth a follow-up.

## Stop boundaries

- Resources dir missing or empty → stop, ask.
- No target and more than 5 binary files (or extraction is clearly expensive) → state the count and rough cost, confirm before extracting everything.
- Target matches nothing after skimming → stop, show inventory, ask.
- Output path already exists:
  - A digest this skill produced → update it; re-derive coverage lines for every file touched this run (the new line reflects *this run's* coverage depth only); entries carried forward unverified keep their original status *and date* — never silently promoted to current.
  - Anything else → stop, ask. Never silently overwrite.

## Rationalizations to refuse

| Thought | Reality |
|---|---|
| "Filenames are descriptive enough" | Touch content before any in/out call or characterization. Descriptive names work until they don't. |
| "It's binary, I can't read it" | Extract structure + samples. If extraction truly fails after an attempt, write *unextractable* — don't substitute the filename. |
| "I read the important sheets" | Then the status is *sampled* and the note names the sheets you didn't read. |
| "It's tagged *(inferred)*, so it's fine" | Inference must rest on extracted content. A tagged filename-guess is still a filename-guess. |
| "I'll mention the caveats in my reply" | Caveats in chat die with the session. They live in the digest or they don't exist. |
| "Target is fuzzy, include everything" | That's full mode dodging the cost gate. Make borderline calls explicit instead. |
