---
name: spec-pipeline-viewer
description: >
  Builds or updates a visual spec-pipeline viewer app — a Vite + React + TypeScript SPA using
  shadcn/ui that presents feature requirements (stories, use cases, scenarios, glossary, open
  questions) in a clean, reviewable dashboard. Use when the user wants to visualise spec-pipeline
  output, says "view the spec", "show me the requirements visually", or wants to review a feature
  spec in a browser.
---

# Spec Pipeline Viewer

Builds a local SPA that presents spec-pipeline output (user stories, use cases, scenarios,
glossary, open questions) in a dashboard-style viewer. Light mode, shadcn/ui, no backend.

---

## When to Use

- "View the spec output"
- "Show me the requirements visually"
- "Build a viewer for this spec"
- "Review the feature spec in a browser"
- After a spec-pipeline run, when the user wants to explore the output interactively

---

## Stack

| Layer | Choice |
|-------|--------|
| Build | Vite + React + TypeScript |
| UI components | shadcn/ui — new-york style, zinc base, CSS variables |
| Styling | Tailwind CSS v3 |
| Data | Static `src/data.ts` — no backend |
| Mode | Light only |

---

## Design Decisions (approved)

### Layout
- **Top navigation bar** — Feature name + `Stories · Glossary · Questions` tabs + `⌘K` search
- **Stories is the default landing page** — no overview page
- **Page background** — `#f8faff` (faint blue wash); all surfaces (nav, cards, sheet) are pure white

### Story List
- Full-width horizontal rows (not cards/grid)
- Each row: `US-0N` badge | title + description | coverage bar | UC / SC / Q counters | `›`
- Hover state: blue border + blue shadow
- Clicking a row opens the side sheet

### Story Detail
- **Side sheet** — slides in from the right; list stays visible and dimmed behind it
- Sheet tabs: `AC | Use Cases | Scenarios | Questions`
- AC tab uses shadcn Accordion (sections → checkmarked criteria)
- Use Cases tab: shadcn Table — columns: ID, title, actor, trigger, steps count
- Scenarios tab: shadcn Table — columns: ID, title, persona, situation summary

### Glossary
- Search input (shadcn Input) + 2-column card grid
- Term name in blue, definition in slate-500

### Questions
- Two groups: Epic-level (amber left border) + Story-level (red left border)
- Each question is a white card with colored left border

### ⌘K Command Palette
- shadcn Command component
- Searches story titles/IDs, use case titles, glossary terms
- Results grouped by category; selecting opens the relevant story sheet

---

## Color Tokens

| Role | Value |
|------|-------|
| Page background | `#f8faff` |
| Surface | `#ffffff` |
| Border default | `#e2e8f0` (slate-200) |
| Border subtle | `#f1f5f9` (slate-100) |
| Text primary | `#0f172a` (slate-900) |
| Text secondary | `#64748b` (slate-500) |
| Text muted | `#94a3b8` (slate-400) |
| Blue accent | `#2563eb` |
| Violet accent | `#7c3aed` |
| Green accent | `#16a34a` |
| Amber accent | `#d97706` |
| Red accent | `#dc2626` |

---

## shadcn Components

**Already available (install if missing):** accordion, tabs, badge, card, separator, progress,
scroll-area

**Required for this viewer:** sheet, table, input, button, command

Install with:
```bash
npx shadcn@latest add sheet table input button command
```

Badge needs custom variants — add to `src/components/ui/badge.tsx`:
```ts
success: 'border-transparent bg-emerald-500/10 text-emerald-600',
blue:    'border-transparent bg-blue-500/10 text-blue-600',
violet:  'border-transparent bg-violet-500/10 text-violet-600',
warning: 'border-transparent bg-amber-500/10 text-amber-600',
```

---

## Pipeline Output Format

The spec-pipeline writes its output to:
```
features/<feature_slug>/requirements/
  main.md                         # epic overview: background, problem, user story list, goals, scope
  glossary.md                     # domain term definitions (markdown)
  objects.md                      # domain object catalog (attributes, states, transitions)
  us_<slug>/
    story.md                      # user story + acceptance criteria
    coverage.json                 # coverage metrics
    use_cases/
      uc_001_<name>.md            # structured use case
      uc_002_<name>.md
      ...
    user_scenarios/
      sc_001_<name>.md            # narrative scenario
      sc_002_<name>.md
      ...
```

### `story.md` format
```markdown
## User Story
As an admin, I want to [action], so that [outcome].

## Acceptance Criteria
### Section Heading
- criterion item
- criterion item

### Another Section
- criterion item
```

### `coverage.json` format
```json
{
  "story": "rate_card_upload",
  "use_case_coverage_percent": 100,
  "scenario_coverage_percent": 100,
  "overall_percent": 100,
  "iterations": { "use_cases": 1, "scenarios": 1 }
}
```

### `use_cases/uc_NNN_*.md` format
```markdown
# UC-N: Title of the use case

**Actor:** Platform Admin
**Goal:** What the actor wants to achieve

## Preconditions
- condition

## Trigger
What initiates this use case

## Main Success Scenario
1. System shows...
2. User selects...
3. System responds with...

## Extensions
**2a** — condition:
  1. Step

## Postconditions
- What is true after success

## Object State Changes
| Object | Attribute | Before | After |
|--------|-----------|--------|-------|
| RateCard | status | Draft | Active |
```

### `user_scenarios/sc_NNN_*.md` format
```markdown
# Scenario: <Title>

**Related use case:** UC-N

## Persona
[Name], [role] at [company]. [Brief description of what they do.]

## Situation
[Context: date, urgency, what they need to accomplish right now.]

## Environment
[Device, network, time pressure.]

## Walkthrough
[Narrative prose: what Rachel does step by step, what she sees, what she decides.]

## Goal and Success Condition
[What success looks like for this persona.]

## Objects Touched
| Object | What changed |
|--------|-------------|
| RateCard | Read (no state change) |

## What Can Go Wrong
- Risk or edge case 1
- Risk or edge case 2
```

### `objects.md` format

```markdown
# Object Catalog

> Domain entities identified from the prototype walk. ...

---

## ObjectName

**Description:** What this object represents in the domain.

### Attributes

| Attribute | Type | Notes |
|-----------|------|-------|
| field_name | string | e.g. "Staffline Group" |
| status     | enum   | See States |

### States

| State | Meaning |
|-------|---------|
| Draft   | In preparation; not yet governing calculations |
| Active  | Live; governing charge rate calculations |

### Transitions

| From  | To     | Triggered by |
|-------|--------|-------------|
| Draft | Active | Admin publishes the draft version |
```

Not every object has States and Transitions — simpler value objects (e.g. `Position`, `RateLine`)
have only Attributes.

---

## Data Shape (`src/data.ts`)

Parse pipeline files into these TypeScript types:

```ts
export type UseCase = {
  id: string           // "UC-1"
  slug: string         // from filename: "view_rate_cards_landing"
  title: string        // from "# UC-N: Title"
  actor: string        // from "**Actor:**"
  goal: string         // from "**Goal:**"
  trigger: string      // from "## Trigger" section body
  steps: string[]      // numbered items under "## Main Success Scenario"
  extensions: string[] // items under "## Extensions"
  postconditions: string[]
}

export type Scenario = {
  id: string           // "SC-1" — derived from filename sequence number
  slug: string         // from filename: "admin_reviews_rate_cards_landing"
  title: string        // from "# Scenario: <Title>"
  relatedUcId: string  // from "**Related use case:** UC-N"
  persona: string      // full "## Persona" body text
  situation: string    // "## Situation" body text
  walkthrough: string  // "## Walkthrough" body text
  canGoWrong: string[] // bullet items from "## What Can Go Wrong"
}

export type AcSection = {
  heading: string
  items: string[]
}

export type Story = {
  id: string           // "US-01"
  slug: string         // "rate_card_upload"
  title: string        // short human-readable title (derive from slug or story.md heading)
  description: string  // "As an admin, I want to…" sentence from "## User Story"
  coverage: number     // overall_percent from coverage.json
  ucCount: number      // use_cases length
  scCount: number      // user_scenarios length
  acSections: AcSection[]
  useCases: UseCase[]
  scenarios: Scenario[]
  openQuestions: { question: string; notes?: string }[]
}

export const feature: {
  name: string
  slug: string
  description: string
  stats: {
    stories: number
    useCases: number
    scenarios: number
    coverage: number    // average overall_percent across all stories
    openQuestions: number
  }
}

export const glossary: { term: string; definition: string }[]

export const epicQuestions: { question: string; notes?: string }[]

export type DomainAttribute = {
  name: string
  type: string
  notes: string
}

export type DomainState = {
  state: string
  meaning: string
}

export type DomainTransition = {
  from: string
  to: string
  triggeredBy: string
}

export type DomainObject = {
  name: string          // "RateCard"
  description: string
  attributes: DomainAttribute[]
  states: DomainState[]           // empty [] for objects with no state machine
  transitions: DomainTransition[] // empty [] for objects with no transitions
}

export const domainObjects: DomainObject[]
```

The Objects page (optional fourth tab in the nav) shows each domain object as a white card:
- Object name as a heading
- Description in slate-500
- Attributes in a shadcn Table (name | type | notes)
- If states exist: a second Table (state | meaning)
- If transitions exist: a third Table (from → to | triggered by)

### Populating `data.ts` from pipeline output

**`story.md` → `description` + `acSections`:**
- `description` = the "As a…" sentence under `## User Story`
- `acSections` = for each `### Heading` under `## Acceptance Criteria`, collect the `- item` bullets

**`coverage.json` → `coverage`:**
- `coverage` = `overall_percent`
- `ucCount` = count of `uc_*.md` files
- `scCount` = count of `sc_*.md` files

**`uc_NNN_*.md` → `UseCase`:**
- Parse the `**Actor:**` and `**Goal:**` inline fields
- Parse numbered lists under each section heading
- `id` = "UC-N" where N is the file sequence number

**`sc_NNN_*.md` → `Scenario`:**
- Parse `# Scenario: <title>` for the title
- Parse `**Related use case:** UC-N` for `relatedUcId`
- Parse each `## Section` body as a block of text or bullet list

**`glossary.md` → `glossary[]`:**
- Each term is typically `**Term**` or `## Term` followed by a definition line

**`questions.md` → `epicQuestions[]`:**
- One question per top-level list item or section; include any `> note:` as `notes`

**`objects.md` → `domainObjects[]`:**
- Each `## ObjectName` heading starts a new object
- `**Description:**` paragraph → `description`
- `### Attributes` markdown table → `attributes[]`; columns are Attribute, Type, Notes
- `### States` table (if present) → `states[]`; columns are State, Meaning
- `### Transitions` table (if present) → `transitions[]`; columns are From, To, Triggered by
- Objects without a `### States` section → `states: [], transitions: []`

**Story `title`:** Derive from the story slug by converting snake_case to Title Case
(e.g. `rate_card_upload` → `"Rate Card Upload"`), or extract from the first heading in `story.md`.

**Story `id`:** Assign sequentially: `US-01`, `US-02`, etc., in the order you enumerate the
story dirs.

---

## File Structure

```
src/
  App.tsx              # routing between pages, sheet state
  data.ts              # all static data
  components/
    ui/                # shadcn primitives
    TopNav.tsx
    StatsStrip.tsx
    StoryRow.tsx
    StorySheet.tsx
    GlossaryPage.tsx
    QuestionsPage.tsx
    CommandPalette.tsx
```

---

## Setup Steps

1. Scaffold (if project doesn't exist):
   ```bash
   npm create vite@latest spec-pipeline-viewer -- --template react-ts
   cd spec-pipeline-viewer && npm install
   npm install -D tailwindcss postcss autoprefixer
   npx tailwindcss init -p
   npx shadcn@latest init   # choose: new-york, zinc, CSS variables, no RSC
   ```

2. Do NOT add `class="dark"` to `<html>` — light mode only.

3. Install required shadcn components:
   ```bash
   npx shadcn@latest add sheet table input button command accordion tabs badge card separator scroll-area progress
   ```

4. Apply shadcn zinc CSS variables to `src/index.css` (copy from shadcn docs).

5. Populate `src/data.ts` from the spec-pipeline output directory.

6. Implement components following the design decisions above.

7. Run `npm run dev` and verify at `http://localhost:5173`.

---

## Reference Implementation

`/Users/yaroslavlebedevich/spec-pipeline-viewer` — working implementation for the Pricing Setup
feature. Tasks 1–4 complete (scaffold, TopNav, StatsStrip); Tasks 5–10 are in progress.
Use as a reference for component patterns, Tailwind class conventions, and test setup (Vitest +
React Testing Library, jsdom environment).

The reference data (`src/data.ts`) is hand-curated for the Pricing Setup feature
(`features/pricing_setup/requirements/`) which has 5 stories:
- `us_agency_pricing_status`
- `us_rate_card_upload`
- `us_rate_card_version_history`
- `us_rate_engine_setup`
- `us_rate_simulator_preview`
