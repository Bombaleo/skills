---
name: prototype-to-spec
description: Use when converting a client-approved Claude Code design prototype into a functional spec document - triggers include a standalone HTML export ("<Feature> (standalone).html"), a design share URL (api.anthropic.com/v1/design/...), or requests like "build a spec from this design/prototype". Supports scoping to one feature/page of the design.
---

# Prototype to Spec

Convert the final, client-approved state of a Claude Code design prototype into a
starting functional spec. Source code tells you intent; the rendered prototype tells
you what the client approved. **On conflict, the render wins.**

## Inputs

- Standalone HTML export, and/or a design share URL — at least one; ask if missing.
- Optional scope: a feature/page within the design (e.g. "Pricing configuration").
  Scope given → spec covers ONLY that part.

## Workflow

### 1. Set up

Feature name = kebab-cased page `<title>` (or design readme name). All output goes to
`./docs/<feature-name>/` in the current working directory. Ask before overwriting
existing files. Use a temp dir for intermediate artifacts.

If a design URL was given: fetch it (it bundles a readme + prototype source). Expired
or 404 → tell the user and continue with the HTML only. If there is no local HTML but
the bundle contains one, save it to `./docs/<feature-name>/`.

### 2. Extract source

```bash
python3 <skill-dir>/scripts/extract_bundle.py <prototype.html> <tmp>/src
```

Read `<tmp>/src/manifest.json`, then the source `.js` files and `_template.html`.
Skip minified vendor libraries (license-header first line, very long lines). App
modules have header comments naming screens and rules — they are the intent record.
Exit code 2 = not a bundler export; proceed render-only.

### 3. Render and walk every screen

Each screen costs ~15–25 s (full page reload per capture) — tell the user a walk takes
minutes. Map the prototype first:

```bash
python3 <skill-dir>/scripts/walk_prototype.py <prototype.html> --out <tmp>/walk --inventory
```

Read `inventory.json` + the initial screenshot. Then walk:

- **Full design:** `--out <tmp>/walk` (defaults: 40 screens, depth 3)
- **Scoped:** find the scope in the inventory/screenshot, then go STRAIGHT to a
  scoped walk — never run a broad walk first "to see what's there":
  - scope is a page you click into → `--nav "Label"` or `--nav "Parent,Child"`
  - scope is a visual group (e.g. a sidebar section) → `--nav "Parent"` +
    `--only "Item1,Item2,..."` with labels copied EXACTLY from inventory.json
  - labels containing commas → JSON array form: `--only '["Label, with comma"]'`
  - scope not findable → show the user the inventory labels and ask; never guess.

Watch the first few `[NNN]` lines the walker prints. If they are outside the scope,
kill the run and fix `--nav`/`--only` — don't let a drifted walk finish and filter
afterwards.

Read `index.json` (screens, `aliases` = click paths that landed on known screens),
every per-screen `.txt` outline, and screenshots (Read tool) where layout or an
ambiguity matters. Check `skipped.json` — "risky label" and cap entries are coverage
gaps to disclose. Nav defaults can make path labels misleading; trust each screen's
`title` (content heading) over the click path.

### 4. Cross-check

Compare source intent against walked screens. Discrepancy → the render is the
approved truth; note the difference in Open Questions. States only reachable with
data you cannot enter (file uploads, wizard steps behind validation) → describe from
source, mark "not visually verified".

### 5. Write the spec

`./docs/<feature-name>/spec.md` (full) or `./docs/<feature-name>/<scope>-spec.md`
(scoped). Copy screenshots you reference into the same folder.

```markdown
# <Feature> — Functional Spec
Source: <design URL and/or HTML filename>, prototype version <if shown in UI>, <date>

## Overview                 — what it does, for whom (from readme/source headers)
## Screens                  — one per distinct screen in index.json: purpose, key
                              elements, fields table (name|type|required|validation),
                              actions & navigation. Cite screenshot filenames.
## User Flows               — step-by-step click paths (from walk paths + source)
## Business Rules           — calculations, conditions, validation catalogue
## States                   — empty/loading/error/disabled states observed
## Glossary                 — domain terms used in the UI
## Not Covered by Prototype — scope boundary; for scoped runs list excluded areas
                              + nav path to the covered one; include skipped.json gaps
## Open Questions           — ambiguities, source-vs-render conflicts, unverified states
```

**Functional content only.** No data models, no API endpoints, no architecture — the
prototype shows UI behavior; backend design is a later step. Every screen in
index.json appears in Screens or in Not Covered with a reason. Unknowns go to Open
Questions as questions, not invented answers.

### 6. Report

Summary: screens covered, spec path, top open questions, coverage gaps.

## Fallbacks

| Failure | Do |
|---|---|
| Design URL expired/404 | Warn, continue with HTML |
| No Chrome / render broken | Spec from extracted source only; title it "UNVERIFIED — generated without rendering" |
| Not a bundler export (exit 2) | Walk only; source sections from outlines |
| `--only` label rejected | Re-copy exact label from inventory.json; labels include suffixes like "NEW" |

## Red Flags — stop and correct

- "Source is enough, skip the walk" → the render is what the client approved. Walk it.
- "I'll read the .html directly" → it's a multi-MB compiled bundle. Use the extractor.
- "I'll add a data model / endpoints to be helpful" → functional spec only.
- "Scope label not found, closest match is..." → show inventory, ask the user.
- "Screen missing from spec but it's minor" → every walked screen is listed somewhere.
