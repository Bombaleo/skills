# CLAUDE.md — Flex Work v2

Project-wide instructions for every Claude session working in this repo.

---

## 📒 Changelog contract (non-negotiable)

This project ships on **two independent tracks**, each with its own
single-source-of-truth changelog:

```
./Flex Work v2 Changelog.html       ← V2 — the main app (project root)
./v1/Flex Work V1 Changelog.html    ← V1 — the current / legacy track (everything under /v1)
```

Each changelog is the single source of truth for what shipped, when,
and why **on its track**. They self-update by being edited as part of
every change — there is no other mechanism. The same files are shared
across every chat, every user, every session.

**Pick the right one.** Log a change in the changelog of the track it
belongs to: V2 app work → the root `Flex Work v2 Changelog.html`;
anything under `/v1` → `v1/Flex Work V1 Changelog.html`. Never
cross-log, and never duplicate one change into both. Everything below
(when to update, how to update, voice, tags, authors) applies
identically to **both** changelogs — they share the same markup and
behaviour.

### When to update it

Update the changelog **in the same turn** that you ship any of:

- A new page, panel, modal, or major route
- A new feature flag or configuration surface
- A behavioural change a user would notice (workflow, copy, layout)
- A removal or deprecation
- A non-trivial bug fix that changed observable behaviour

Pure refactors, comment-only edits, or token-renames with no visible
effect can be skipped.

### How to update it

1. Open the changelog for the track you are shipping on (see the two
   paths above).
2. If today's `<section data-day="YYYY-MM-DD">` already exists at the
   top of `<main>`, **prepend** a new `<li class="cl-entry">` to its
   `<ul class="cl-list">` so the newest change sits first.
3. Otherwise, **prepend a new `<section data-day="YYYY-MM-DD">`**
   ahead of the most recent one, with today's date as a human-readable
   `<h2 class="cl-day-date">` and the weekday in `<div class="cl-day-weekday">`.
4. Use the existing entry markup. Note `data-author` on the `<li>`
   AND the matching `Author:` span — both must carry the same name:
   ```html
   <li class="cl-entry" data-author="Dominic Esposito">
     <span class="cl-tag cl-tag--add">Add</span>
     <div class="cl-entry-body">
       <h3 class="cl-entry-title">Verb-led title in sentence case</h3>
       <p class="cl-entry-detail">One sentence of plain context.</p>
       <div class="cl-entry-meta">
         <span>Area · vX.YZ</span>
         <span class="cl-entry-author">
           <span class="cl-avatar" data-author-avatar="Dominic Esposito">DE</span>
           Dominic Esposito
         </span>
       </div>
     </div>
   </li>
   ```
5. **Screenshots (optional, propose-and-override).** Propose the 1–3
   screenshots that best show the change as a `<div class="cl-shots">`
   inside `.cl-entry-body`, between the detail and the meta row — one
   `<figure class="cl-shot">` per image, each with an
   `<img class="cl-shot-thumb" src alt loading="lazy">` and a one-line
   `<figcaption>`. Reuse a fitting capture from `screenshots/` or take
   one; save reader-supplied uploads under `uploads/`. Every reader can
   override a proposed shot in place (hover a thumbnail → replace with
   their own image or revert), persisted per entry in the browser — so
   never block a ship on a screenshot, and omit the block entirely if
   nothing illustrates the change.
6. Tag values: `cl-tag--add` (new), `cl-tag--change` (modified),
   `cl-tag--fix` (bug), `cl-tag--remove` (deleted), `cl-tag--system`
   (repo/infra/docs).
7. **Author**: stamp every entry with the human teammate the session
   belongs to. The team is **Dominic Esposito**, **Elijah Bilokur**,
   and **Dmitry Grechko** — these are the only valid authors. Never
   write "Claude" as the author, and do not invent new names. If
   the session owner has not identified themselves, ask before
   writing the entry. If the team genuinely grows, add a chip color
   to the `AUTHORS` map at the bottom of the changelog you are
   editing (both changelogs carry the same map) so the new
   teammate's avatar gets a distinct hue.
8. For feature-sized changes, bump:
   - The `<b>Current version</b>` value in the header (next `v0.NN`).
   - The `<time datetime>` and visible text on `<b>Last updated</b>`.

### Voice & format

- Sentence case everywhere — *"Added supplier funding rules"*, not
  *"Added Supplier Funding Rules"*.
- No emoji. No exclamation marks. Plain digits for numbers.
- Title: verb-led, 6–12 words.
- Detail: one sentence. What changed and why a user would care. No
  marketing copy, no hedging.
- Area in meta: the surface or page (`Requisitions`, `Workforce`,
  `Settings → Configuration`, `Repo`).

### Do not

- Do not fork either changelog into per-feature files. Two changelogs
  exist by **track** (V1 / V2), never per feature.
- Do not create a `CHANGELOG.md` alongside the HTML — the HTML is
  canonical and is linked from each track.
- Do not silently rewrite historical entries. If an old entry is
  wrong, add a new `cl-tag--fix` entry referencing it.

---

## Other project conventions

- Visual style: **Everest** design system. Tokens live in `tokens.css`;
  never invent hex values.
- Per-file CSS pattern — every page has a matching `styles-*.css` and
  loads it from `index.html`.
- Version markers like `v0.77`, `v0.78`, … appear throughout the
  codebase as comments anchoring the spec phase a module belongs to.
  Keep this convention when introducing new feature groups.

---

## Flex Work V1 track (`v1/`)

`v1/` is the home of **Flex Work V1** — the current / legacy platform
state. It is built and shipped **independently** of the V2 app at the
project root, so the team can push into V1 and V2 separately. The two
tracks will eventually be diffed to drive the V2 requirements docs.

- **Isolation.** Nothing in `v1/` is imported by the root `index.html`
  or any `pages/*.jsx`, and nothing in `v1/` may change the V2 app.
  V1 reuses Everest by **relative, read-only reference**: `../tokens.css`
  (which `@import`s the fonts), `../assets/icons/*.svg`,
  `../assets/dayforce-flexwork-logo.svg`. Do not copy these in; do not
  edit them from a V1 session.
- **IA.** V1 uses the V1 sidebar IA (see "IA versions" below). Label
  every V1 file with a top-of-file `IA version: V1` comment.
- **Build style.** A vanilla-JS **single-page app** (no React, no Babel)
  that mirrors the v2 root's structure — `v1/index.html` is the only
  entry point and runs every state, page and role from one page. Load
  order: `core.js` (the `window.V1` namespace: helpers, nav models,
  roles, page registry) → `chrome.js` (top bar + sidebars) →
  `pages/<feature>.js` modules that register `V1.pages.<id> = { render,
  wire }` → `app.js` (state, router, wiring; boots last). Shared data
  layers (e.g. `pages/rate-engine.js`) load before their consumer pages,
  like v2's data modules. V1 CSS is scoped under `.proto-app`: the
  shared shell is `v1/styles-prototype.css`; each page gets its own
  `v1/styles-<feature>.css` loaded from `index.html`.
- **Changelog.** Every V1 change is logged in
  `v1/Flex Work V1 Changelog.html` (the V1 track's single source of
  truth) — never in the root V2 changelog. Each V1 surface carries a
  **Changelog** link to it in its top bar. Social state persists under
  `flexwork-v1-changelog-social-v1` so it never collides with V2.

### V1 surfaces

- `v1/index.html` — the V1 single-page app shell (top bar, V1 sidebar,
  client-side router). Every V1 surface lives inside it. Seeded as a
  fork of the `prototype/Rate Automation.html` staging mockup (built by
  Dom as the starting point for V1), then refactored from one file into
  the module structure above. Clickable: an **Agencies → WorkWhile**
  agency detail and a **Settings → Pricing** rate-card upload flow (see
  "what's clickable" below).

---

## Feature prototypes (`prototype/`)

The `prototype/` folder is a **generic staging area** for isolated,
single-purpose feature prototypes that have not yet been assigned to a
track — lightweight mockups used to show one feature end-to-end without
wiring it into the production React app. Once a prototype belongs to a
track it graduates into that track's folder. The first one,
Rate Automation, **seeded** the V1 track: a fork of it lives at
`v1/Rate Automation.html` (logged in the V1 changelog), while the
original stays here in `prototype/` so the team can keep iterating on
the staging copy. The isolation, IA and build rules below apply to
both `prototype/` staging mockups and `/v1` surfaces.

### Hard rule: isolation

- A prototype is **never** imported by `index.html` or any `pages/*.jsx`.
  It must not change a single byte of the main app's behaviour.
- Prototypes reuse Everest by **relative, read-only reference** only:
  `../tokens.css` (which `@import`s the fonts), `../assets/icons/*.svg`,
  and `../assets/dayforce-flexwork-logo.svg`. Do not copy these in and
  do not edit them from a prototype session.
- All prototype CSS is scoped under `.proto-app` and lives in
  `prototype/styles-prototype.css` (the shared shell). Per-feature
  styles, if any, get their own `prototype/styles-<feature>.css`.
- Build them as a **self-contained vanilla-JS single file** (no React,
  no Babel) with a small client-side view router. They are deliberately
  low-fidelity in behaviour: only one or a few surfaces are actually
  clickable; every other nav item / button is inert and answers with a
  toast like "… isn't part of this prototype".

### IA versions — V1 vs V2 (commit to memory)

Prototypes declare which navigation IA ("shell") they use. State it in a
top-of-file comment: `IA version: V1`.

- **V1** = the sidebar IA shown in the source screenshots and built in
  `v1/Rate Automation.html`:
  - Top bar: Dayforce Flex Work wordmark (left), notification bell +
    "AC" avatar (right).
  - Left sidebar: a search pill (`Search` + ⌘K), then the primary nav —
    **Dashboards · Leads · Clients · Workforce · Jobs · Agencies ·
    Timesheets · Settings**. Clients / Workforce / Jobs / Agencies carry
    an expand chevron. Active item = blue-50 fill, blue-400 text + 3px
    blue left rail.
  - **Settings** swaps the sidebar into a sub-nav: a `Back to app` row,
    then grouped sections **Policies** (Accreditations, Attire,
    Cancellation Policy, Holiday Pricing) · **Configuration** (Markets,
    Sectors, Districts, Positions, Organization, Payroll, Algorithm,
    Automation Config, **Pricing**) · **Users** (Users, Demo Users) ·
    **Other** (Enterprise Organizations, Dayforce/Ideal Flex Work App
    Options, Promo Codes, Guides, Referrals), and a `Collapse sidebar`
    footer.
  - **Pricing** is a feature-added Configuration item (carries a "New"
    pill) — it did not exist in the original V1 settings IA.
- **V2** is reserved for the production app's own chrome (the icon-rail
  `GlobalNav` in `chrome.jsx`: Home / Analytics / Requisitions / …).
  Do not mix V1 and V2 in one prototype; pick one and label it.

### Rate Automation (V1) — what's clickable

- **Agencies** → WorkWhile agency detail: contract-dates bar, agency
  hero (logo, address, GUID + copy, activation date, N/A stat trio) and
  expandable cards (Agency Details, Pricing Configuration Contract,
  Cancellation Policy, Users, Comments, Logs) + Deactivate link.
- **Settings → Pricing** → the rate-automation upload flow: download a
  pre-filled `.xlsx` rate-card template, then drag/drop or browse a real
  `.xlsx`/`.xls`/`.csv` file. Parsing uses **SheetJS** from CDN
  (`cdn.sheetjs.com`) with a CSV fallback; the parsed rows preview in a
  table and "Apply rate automation" confirms with a success banner.

### Per-prototype changelog (for unassigned staging mockups)

A prototype that is still **unassigned** (living in `prototype/`, not
yet on a track) gets its own isolated changelog, mirroring the main
changelog's structure and behaviour — author filter, reactions,
threaded comments, screenshot lightbox with per-reader override — but
tracking only that one prototype under a prototype-scoped
`localStorage` key.

- File naming: `prototype/<Prototype Name> Changelog.html`.
- It links its assets one level up (`../tokens.css`,
  `../fonts/fonts.css`) and its "Back to prototype" link points at the
  prototype's own HTML file — never `index.html`.
- `localStorage` key shape: `flexwork-proto-<slug>-social-v1` — the
  `<slug>` is unique per prototype.
- **New staging prototype?** Copy `prototype/_Prototype Changelog
  Template.html`, replace `__PROTOTYPE_NAME__`, `__PROTOTYPE_FILE__`
  and `__SLUG__`, replace the example entry, then add a Changelog link
  to that prototype's top bar. The template's head comment has the
  full steps.
- **When a prototype seeds a track** (e.g. V1), a fork of it moves into
  that track's folder and its changelog content seeds the **track**
  changelog. The staging copy can stay in `prototype/` with its own
  per-prototype changelog if the team keeps iterating on it. This is
  what happened to Rate Automation: `prototype/Rate Automation
  Changelog.html` remains the team's staging log, and its history
  seeded `v1/Flex Work V1 Changelog.html` for the V1 track. The two
  then evolve independently — never cross-log between them.

### Still applies

- Everest tokens only — never invent hex. Sentence-case copy, no emoji,
  digits for numbers (same content rules as the app).
- Staging-prototype changes are logged in that prototype's own
  changelog; V1 changes in `v1/Flex Work V1 Changelog.html`; V2 app
  changes in the root `Flex Work v2 Changelog.html`. Never cross-log.

---

## Sales assets (`Sales/`)

`Sales/` is the home of **customer-facing sales collateral** — websites,
calculators, and interactive assets the sales team puts in front of
prospects and clients. It is a **completely independent track**, built
and shipped separately from the V2 app at the project root, V1, and the
`prototype/` staging area.

Unlike `prototype/` (one shared shell, lo-fi, app-IA mockups) and `/v1`
(the legacy platform), Sales assets are **outward-facing marketing-grade
microsites**. Each is polished, persuasive, and self-contained.

### Structure — one folder per project

Every sales asset is **its own self-contained subfolder** under `Sales/`,
with its own entry HTML, its own styles, and its own changelog. Projects
never import from each other.

```
Sales/
  _Sales Project Changelog Template.html   ← reusable per-project changelog
  ROI Calculator/
    ROI Calculator.html                    ← the asset (entry point)
    styles-roi.css                         ← per-asset styles
    roi-calc.js                            ← per-asset logic
    ROI Calculator Changelog.html          ← THIS project's changelog
  <Next Sales Project>/
    …
```

### Hard rules: isolation

- A Sales asset is **never** imported by `index.html`, any `pages/*.jsx`,
  `/v1`, or `/prototype`. It must not change a single byte of any other
  track's behaviour. Nothing outside `Sales/` may import from it either.
- Sales assets reuse Everest by **relative, read-only reference** from
  two levels up: `../../tokens.css` (which `@import`s the fonts),
  `../../fonts/fonts.css`, `../../assets/icons/*.svg`, and
  `../../assets/dayforce-flexwork-logo.svg`. Do not copy these in and do
  not edit them from a Sales session.
- **Visual north star:** the public Dayforce Flex Work marketing site
  (`dayforce.com/how-we-help/dayforce/flex-work`) — generous whitespace,
  large Clarika Geometric display headings, calm neutral surfaces, blue
  primary, eyebrow-labelled sections, a persuasive hero, and a clear
  call to action. Marketing-polished, not app-chrome. Everest tokens
  only — never invent hex.
- Build style: a self-contained **vanilla-JS** asset (no React, no
  Babel). Scope per-asset CSS so two assets can never collide.

### Per-project changelog (one per Sales project)

Every Sales project gets its **own** changelog inside its own folder,
mirroring the prototype changelog's structure and behaviour (author
filter, reactions, threaded comments, screenshot lightbox with per-reader
override) but scoped to that one project under a project-scoped
`localStorage` key.

- File naming: `Sales/<Project Name>/<Project Name> Changelog.html`.
- It links Everest **two** levels up (`../../tokens.css`,
  `../../fonts/fonts.css`) and its "Back" link points at the project's
  own entry HTML — never `index.html`.
- `localStorage` key shape: `flexwork-sales-<slug>-social-v1` — the
  `<slug>` is unique per project.
- Each Sales asset carries a **Changelog** link in its top bar / footer
  pointing at its own changelog.
- **New Sales project?** Make a new subfolder, copy
  `Sales/_Sales Project Changelog Template.html` into it as
  `<Project Name> Changelog.html`, replace `__PROJECT_NAME__`,
  `__PROJECT_FILE__` and `__SLUG__`, replace the example entry, then add
  a Changelog link to the asset. The template's head comment has the
  full steps.

### Still applies

- Everest tokens only — never invent hex. Sentence-case copy, no emoji,
  digits for numbers (same content rules as the app).
- Each Sales project's changes are logged in **that project's own**
  changelog — never the root V2 changelog, never V1, never another
  Sales project's log. Never cross-log.
- Any numbers, savings percentages, or benchmarks shown in a sales asset
  must cite a real, named source inline (the ROI Calculator established
  this pattern). Mark illustrative planning assumptions as such.
