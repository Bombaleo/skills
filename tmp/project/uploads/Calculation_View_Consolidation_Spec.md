# Rate Engine — Consolidate the right-hand panel to the Calculation view

**Change:** in the Rate Engine config screen, replace the four right-hand tiles — **Calculation view, Compiled rate-card schema, Precedence & stacking, Config-time validation** — with a **single Calculation view** (Pay / Bill tabs) that tells you everything about how pay and bill are built, structurally.
**Basis:** the config screen as implemented (engine v0.95), reviewed against `Rate_Card.xlsm`.
**Status:** refactor for design + engineering.

---

## 1. Why

The right column grew to four tiles that overlap. The **Calculation view already shows the ordered structural build**; with the right annotations it carries everything the other tiles were showing. They are either subsets of it or belong elsewhere:

- **Compiled rate-card schema** — the "right columns" and their levels — is just the **source-level of each line** in the calculation.
- **Precedence & stacking** — rules apply in order on the running value — is just the **order of the calculation**, plus a few inline conditions.
- **Config-time validation** — "is this rule valid?" — is an **editor** concern, not a read-out; it belongs on the rules themselves, not in a separate panel.

So the calculation view becomes the one place that answers, per tab: *how is the pay rate built, and how is the bill rate built, structurally?*

---

## 2. The single Calculation view — what it must carry

One tile, two tabs. Structure only — **no values**. Each line shows its **tier** (Pay / Engine / Agency), its **calc type**, and its **source-level** (per-row input · site-level · supplier-level · statutory pack), in calculation order, with the boundary markers.

**Keyed by:** Region tier × Site × Position × Parity × Day-type.
*Day-type and parity are dimensions (variants) carried in the base rate — not additive steps.*

### Pay tab — 4 rules → = Pay rate

| Tier | Rule | Calc type | Source-level |
|---|---|---|---|
| Pay | Worker regular pay | base | per-row · keyed by all dimensions |
| Pay | Geo allowance | adjustment · absolute | site-level input |
| Engine | NMW floor | floor · banded | statutory pack (age-banded) · locked |
| Pay | WTR holiday pay | adjustment · percentage | statutory rate · accrues to worker (parity: 12.07% → 14.04%) |
| **= PAY** | **Pay rate — worker-payable boundary** | | |

### Bill tab — carries the Pay rate in, + 7 rules → = Bill rate (incl VAT)

| Tier | Rule | Calc type | Source-level |
|---|---|---|---|
| Engine | Employer NI | percentage | statutory pack · uses supplier weekly hours · 0% for under-21 / apprentice <25 |
| Agency | Pension | percentage | supplier % on the statutory band · uses weekly hours |
| Engine | Apprenticeship levy | percentage | statutory rate · supplier inclusion (Y/N) |
| Agency | Sick pay | absolute / percentage | supplier-level · £/hr · % · none |
| — | **= Fully-burdened cost** | | |
| Engine | Tenure margin reduction | banded · deduction | per-row · per role (reduces margin by tenure) |
| Agency | Markup | markup | supplier-level · £/hr · per position group |
| — | **= Bill rate (pre-VAT)** | | |
| Engine | VAT | tax / fee · percentage | statutory · 20% |
| **= BILL** | **Bill rate (incl VAT)** | | |

The tab counts match the rule stack: **Pay rate · 4**, **Bill rate · 7**.

**Footer (in the tile):**
- *Rules apply top-to-bottom on the running value; order within a group is the default tiebreaker.*
- *Value-free · versioned — changing the structure migrates every rate card on this version.*

---

## 3. What happens to the other three tiles

- **Compiled rate-card schema → absorbed.** Its key columns become the *keyed by* line; its per-row / site-level / supplier-level / statutory-pack classification becomes the **source-level tag on each line**.
- **Precedence & stacking → absorbed.** The view is already an ordered list, so stacking is the order; the conditional cases that mattered (NI age-relief, levy inclusion, parity WTR, premium date/time/day windows) sit **inline on the lines** they affect.
- **Config-time validation → moved to the editor.** Validation is flagged **inline on the rules in the left stack** (a value with no level, a day-type counted in both base and premiums) — where you'd fix it — not as a separate right-hand panel.

**Output contract unchanged:** the compiled schema still *exists* as the value-free output contract that template generation and the Pay Rate Configuration step consume. It is **derived from the same structure** the Calculation view shows — it is just no longer a separate UI tile.

---

## 4. Before → after

**Before:** right panel = Calculation view + Compiled rate-card schema + Precedence & stacking + Config-time validation.

**After:** right panel = **Calculation view only** — carrying tiers, source-levels, dimensions, order and inline conditions across the Pay and Bill tabs. Validation moves inline on the editor; the schema and precedence persist as the derived output contract.
