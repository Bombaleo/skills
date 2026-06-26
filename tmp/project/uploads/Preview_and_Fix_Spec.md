# Rate Card Upload — "Preview & Fix" Screen Specification

**Screen:** Settings › Rate Cards › Upload new rate card › **Step 3 of 4** ("Preview & fix")
**Position:** after *Process & confirm* (which parses, organizes, and confirms the data), before *Start date*
**Status:** Draft for design + engineering
**Context input:** A rate model workbook (the uploaded `Rate_Card.xlsm` is the canonical example of what gets uploaded)

---

## 1. Purpose

The user has uploaded a rate model. By the time they land on this screen the system has already parsed that workbook, resolved it against the three-tier rate model, recomputed every charge rate, validated the result, and diffed it against the current live version.

This screen has three jobs:

1. **Show every staged rate** and make it transparent *how* each rate was built.
2. **Surface problems and let the user fix them** before anything goes live.
3. **Compare** the staged set against the current live version, showing only what changed.

The governing promise (already in the UI copy): *nothing goes live until the user applies it in Step 3.* Every edit on this screen happens on a staged copy.

---

## 2. What the system has already done before this screen renders

This sets expectations for what data is available to the UI. The pipeline:

1. **Parse the Net Pay Table** into the base-rate reference, keyed by Region tier (National/London) × Site × Job Title × Job Type × Parity Status. This is where each row's **net pay** comes from — and it is *not* a constant (it varies by site and shift; e.g. Warehouse Operative PM is £12.32 at Barnsley/Rugby/Warrington but £12.21 at Nuneaton/Wednesbury).
2. **Read the engine constants** (NI 15% + £96 threshold, WTR 12.07% / 14.04% parity, pension band £120–£967, levy 0.5%, peak factor).
3. **Parse the agency config** per Supplier × Job Type: margin, pension %, weekly hours, sick pay, apprenticeship-levy inclusion.
4. **Recompute each charge rate using the standardized engine formulas** — deliberately *not* the workbook's per-row formulas. This is the step that normalizes the source inconsistencies (see §7) and lets us flag where the uploaded value disagrees with the recomputed value.
5. **Validate** every row → tag `OK` / `Warning` / `Error`.
6. **Diff** against the current live version → tag `New` / `Changed` / `Unchanged` / `Removed`.

The screen consumes the output of steps 4–6.

---

## 3. Layout

```
┌────────────────────────────────────────────────────────────────────┐
│  ① Upload ✓ ──── ② Preview & fix ──── ③ Start date                  │
├────────────────────────────────────────────────────────────────────┤
│  Preview the rates                                                    │
│  Review the staged rates below, or compare against an earlier version.│
│                                                                       │
│  ┌── Summary bar ─────────────────────────────────────────────────┐ │
│  │ 132 rates · 16 suppliers · 5 sites · 4 job types                │ │
│  │ ⛔ 3 errors   ⚠ 11 warnings        Source: Rate_Card.xlsm       │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                                                       │
│  [ View: ‹All rates› | Compare changes ]   [Filter ▾] [🔍 search]    │
│                                                                       │
│  ⚠ Banner: 3 rates need attention before you can continue  [Review]  │
│                                                                       │
│  ┌── Rates table (grouped, expandable) ───────────────────────────┐ │
│  │ ● Supplier ▸ Site ▸ Job Type … Net Pay  On-costs  Margin  RATE │ │
│  │   └ expanded row → rate waterfall (tier-tagged)                 │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                                                       │
├────────────────────────────────────────────────────────────────────┤
│  ← Back        132 staged · 3 to fix          Continue to start date →│
└────────────────────────────────────────────────────────────────────┘
```

---

## 4. Summary bar (always visible)

- **Rates staged:** count of computed rates (e.g. 132).
- **Coverage:** N suppliers · N sites · N job types.
- **Region tiers present:** National / London badges (the example file is all-National, but the tier must be displayed because the model supports both).
- **Issues:** `⛔ E errors · ⚠ W warnings`, each clickable to filter the table to just those rows.
- **Source:** uploaded file name + parsed timestamp.

---

## 5. View 1 — "All rates" (default)

### 5.1 Grouping and sort
- **Primary grouping:** by **Supplier** (collapsible sections), since the user is reviewing one agency's submission at a time.
- **Re-group control:** by Supplier / by Site / by Job Type.
- **Sort within group:** by Charge Rate, Job Type, or Status.

### 5.2 Summary-row columns
| Column | Content | Notes |
|---|---|---|
| Status | ● green OK / ● amber warning / ● red error | Shows issue count on the row |
| Supplier | e.g. TRC Group | Hidden when grouped by supplier |
| Site | e.g. Warrington + tier badge `National` | |
| Job Type | e.g. Warehouse Parity | |
| Hours | 35 / 37.5 / 40 | Agency hours (see §7 hours-mismatch rule) |
| Net Pay | £12.21 | Base, from reference |
| On-costs (Σ) | £3.39 | Rolled up; full breakdown in drill-down |
| Margin | £0.95 | Agency |
| **Charge Rate** | **£16.56** | Visual anchor — bold, larger weight |
| ⌄ | expand | Opens the waterfall |

Keep the summary row narrow; the full component breakdown lives in the drill-down, not inline.

### 5.3 Row drill-down — the "how it's built" waterfall *(the key interaction)*

Expanding a row reveals the rate stack, **with every line tagged by which tier owns it**. This is what makes a rate auditable and is the direct payoff of the three-tier model. Example for *TRC Group · Warrington · HGV Driver*:

| Line | Value | Tier | Parameter / source |
|---|---|---|---|
| Net Pay | £12.21 | **Reference** | Warrington · National · Standard Combined |
| + WTR | £1.47 | **Engine** | 12.07% |
| + Employer's NI | £1.69 | **Engine** | 15%, threshold £96 |
| + Pension | £0.16 | **Engine × Agency** | engine formula × agency rate 1.5% |
| + Apprenticeship Levy | £0.07 | **Engine × Agency** | 0.5%; agency: included |
| + Sick Pay | £0.00 | **Agency** | none declared |
| = Direct Cost | £15.61 | **Engine** | roll-up |
| + Margin | £1.05 | **Agency** | |
| **= Charge Rate** | **£16.66** | **Engine** | Direct + Margin |

Each line shows value, a tier chip (`Reference` / `Engine` / `Agency`), and the parameter used. Any flagged line shows its warning inline — e.g. *"Source pension formula dropped the £967 cap; shown value is recomputed with the standard formula (£0.16 vs source £0.20)."*

### 5.4 Filters and search
- **Filter by:** Status (error/warning/OK), Supplier, Site, Region tier, Job Type, Valid bid (Y/N).
- **Search:** supplier / site / role free text.
- **Quick chips:** "Errors only", "Missing margin", "Outliers", "Changed vs live".

---

## 6. View 2 — "Compare changes"

### 6.1 Default behaviour
Show **only rows that differ** from the live version: `New`, `Changed`, `Removed`. `Unchanged` rows are hidden behind a toggle. (The UI copy already promises "compare … to see only what changed.")

### 6.2 Columns
| Column | Content |
|---|---|
| Change | New / Changed / Removed chip |
| Supplier · Site · Job Type | the key |
| Old rate | live charge rate (— for New) |
| New rate | staged charge rate (— for Removed) |
| Δ £ | absolute change, signed |
| Δ % | percentage change, signed |
| What changed | attribution chips |

- Δ values are color-coded (up vs down) with directional arrows.
- **"What changed" is attributed by diffing the inputs, not just the output:** `Net pay ↑`, `Margin ↑`, `Hours`, `On-cost param`, `New mapping`. This tells the reviewer *why* a rate moved, which is far more useful than the delta alone.

### 6.3 Change summary strip
`X changed · Y new · Z removed · avg Δ +2.1% · largest mover: Winner / Barnsley HGV +£0.31`. Filter the list to: increases / decreases / new / removed / |Δ%| above a threshold.

### 6.4 Drill-down in compare mode
Same waterfall, rendered as **two columns (old vs new)** side by side, with the line(s) that moved highlighted so the source of the delta is obvious.

---

## 7. Validation rules — the "fix" surface

These are grounded in the issues actually present in the example workbook. Two severities.

### Errors — must be resolved or explicitly acknowledged before Continue
| Rule | Why |
|---|---|
| **Missing margin** | Charge rate is invalid (the workbook's own `Valid Bid` logic returns "No"). |
| **Duplicate key** | Same Supplier × Site × Job Type appears more than once. |
| **Unmatched location** | Site not present in / not mapped to the reference. |
| **Unmatched job type** | Job type doesn't map to an Award Model Role Type. |
| **Net pay missing / zero** | No base rate resolved for the row. |
| **Charge rate ≤ net pay** | On-costs or margin missing — economically nonsensical. |

### Warnings — review, but do not block
| Rule | Why (seen in the file) |
|---|---|
| **Pension formula deviates from standard** | Some source rows drop the `MIN(…, £967)` cap; one collapses to a bare `NetPay × 1.5%`. Show source value vs engine-recomputed value. |
| **Blank-vs-zero ambiguity** | Sick pay / levy left blank in some rows, `0` in others — ask the user to confirm "none" vs "needs a value". |
| **Levy inconsistent within a supplier** | Present for some of a supplier's rows, absent for others (e.g. Extrastaff). |
| **Hours mismatch** | Agency hours ≠ the nominal role hours in the reference (e.g. agency warehouse = 35 vs reference role = 37.5). |
| **Rounding drift** | Source value differs from the engine-rounded value in the pennies. |
| **Outlier** | Margin or charge rate outside the peer/historical band for the same role + site. |
| **Missing day-type rate** | Row has Standard but no Sat/Sun where peers do. |

### How fixes resolve
Crucially, the user does **not** hand-fix on-cost formulas — the engine already recomputes those from the standard formula + parameters. What the user fixes is the *inputs and mappings*:

- **Inline-editable staged fields:** Margin, Pension %, Hours, Sick Pay, Levy included (Y/N).
- **Mapping resolution:** assign an unmatched site or job type to a reference entry.
- **Live recompute:** as the user edits, the engine recomputes the charge rate and the waterfall updates immediately.
- **Bulk actions:** apply a fix across selected rows (e.g. "set levy = included for all TRC Group rows", "acknowledge all rounding warnings").
- **Audit:** edited rows get an "edited" marker; each change logs who / field / old → new.
- **Reset to uploaded:** per row and globally.

---

## 8. States

| State | Behaviour |
|---|---|
| Loading | Stepwise progress: *Parsing → Computing rates → Validating*. |
| Parse failure | File unreadable / wrong structure → explain what's wrong, link back to Upload. |
| All valid (0 issues) | Green confirmation; Continue enabled. |
| Warnings only | Continue enabled; warnings summarized and dismissible. |
| Has errors | Continue gated until errors resolved or explicitly acknowledged. |
| Empty (0 rates parsed) | Prompt to check the file structure. |

---

## 9. Acceptance criteria

- [ ] Every staged rate is listed and groupable by Supplier / Site / Job Type.
- [ ] Each rate can be expanded to a tier-tagged waterfall that reconciles exactly to the charge rate.
- [ ] Net pay is shown per-row from the reference (never assumed constant).
- [ ] Region tier (National/London) is visible on every row.
- [ ] All §7 errors and warnings are detected and surfaced both inline and in a filterable issues view.
- [ ] Editing an input recomputes the charge rate live; live data is never touched.
- [ ] Compare mode shows only changed/new/removed rows by default, with Δ£, Δ%, and input-level attribution.
- [ ] Continue is gated (hard or acknowledged — see §10) while errors exist.
- [ ] All edits are captured in an audit log.

---

## 10. Edge cases & open questions

- **London + National for the same role** → render as two separate rows distinguished by tier badge (correct, not a duplicate).
- **Same supplier, two hours for one job type across sites** (e.g. Extrastaff warehouse 35h / 37.5h) → both rows valid; do not flag as a duplicate.
- **Hard-block vs soft-block on errors** — does Continue refuse outright, or proceed after an explicit "I've reviewed N errors" acknowledgement? *(Product decision.)*
- **Editable scope** — recommend the user may edit *agency config + mappings* here, but **not** reference net pay; net-pay corrections should go back to the source file and be re-uploaded, to keep the reference authoritative. *(Confirm.)*
- **Comparison baseline** — is "an earlier version" always the current live version, or can the user pick any prior version? *(Confirm.)*
- **Peak/Bank-holiday cards** — if the upload is a peak card, show the peak factor in the summary bar and apply it as a final waterfall line.
