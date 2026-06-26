# Rate Engine — Changes from the First Implementation

**Purpose:** the **handoff delta** — only what changes from the first implementation (the "Evri pricing configuration" design already built). It does not restate the architecture; the full model is in `Rate_Engine_Architecture.md` and needs no re-reading.
**Scope:** corrections for Evri sufficiency + accuracy (C1–C8) and one net-new addition — the Calculation view (C9) — all verified against `Rate_Card.xlsm`.
**What does NOT change:** the engine's primitives (rule types, groups, banding, packs, the compiled-schema / precedence / validation panels) are correct and stay as-is.
**Status:** FINAL — design handoff (changes only).

---

## 1. Change summary

| # | Change | Type | Where |
|---|---|---|---|
| C1 | Add **Sick pay** rule + supplier input | Add | Employer contributions / supplier-level inputs |
| C2 | Add **Weekly hours** supplier input | Add | Supplier-level inputs (feeds NI & pension) |
| C3 | Add **NMW floor** rule (age-banded) | Add | After Worker regular pay |
| C4 | Add **NIC age-relief** condition on Employer NI | Add | Condition on Employer NI rule |
| C5 | Remove **Weekend** + **Weekly overtime** premiums (Evri) | Remove | Pay premiums (day-type lives in the base) |
| C6 | Remove **Bank holiday / Night / shift** premiums (Evri) | Remove | Pay premiums (no Evri data) |
| C7 | Remove **Seasonal allowance** (Evri) | Remove | Allowances / supplier-level inputs |
| C8 | Correct the **agency-level variable set** in the compiled schema | Fix | Compiled rate-card schema |
| C9 | Add **Calculation view** (Pay / Bill tabs) | Add | New panel beside the rule stack |
| C10 | Add **template generation + browser preview** (the engine's output) | Add | New output step after configuration |

C5–C7 are removals from **Evri's configuration only** — the rules remain valid engine capabilities for other templates.

---

## 2. Changes — detail

### C1 · Add Sick pay  *(Add)*
- **Why:** sick pay is a real supplier cost in the file — DCS Recruitment and H & G Recruitment at **£0.061/hr**, KPI at **£0.11/hr** — and it is currently absent from the rule stack and the schema, so the bill rate is understated for those suppliers.
- **Where:** new rule in **Employer contributions** — `Sick pay · Adjustment · Markup · recipient Agency · value source Rate card · per supplier` with a type selector (fixed £/hr · % of pay · none). Add **Sick pay** to supplier-level inputs.
- **Before → After:** Employer contributions = {Employer NI, Pension, Levy} → **{Employer NI, Pension, Levy, Sick pay}**.

### C2 · Add Weekly hours  *(Add)*
- **Why:** Employer NI and pension are computed **per hour** (`NI = ((hours×(pay+WTR))−£96)×15% ÷ hours`), and contracted hours vary by supplier/role in the file — **35 · 37.5 · 40**. Without a weekly-hours input the burden cannot be computed. It is missing from the supplier-level inputs.
- **Where:** add **Weekly hours** to supplier-level inputs (per supplier × position group); it is the divisor/annualiser the Employer NI and Pension rules consume — not a standalone adjustment.
- **Before → After:** supplier-level inputs gain **Weekly hours**.

### C3 · Add NMW floor rule  *(Add)*
- **Why:** Evri's base rates are genuinely below NMW (Warehouse Operative AM = **£9.85 → floors to £12.21**), so the age-banded floor is essential; there is no floor rule in the stack (rule types shown are Base/Adjustment/Markup/Tax — no floor/cap).
- **Where:** insert a rule immediately after **Worker regular pay** — `NMW floor · Floor/Cap · source Statutory pack (age-banded: 21+ £12.21 · 18–20 £10.00 · 16–17 £7.55) · calc base running pay`. Locked (statutory).
- **Before → After:** Base → **NMW floor** → premiums.

### C4 · Add NIC age-relief condition  *(Add)*
- **Why:** under-21s and apprentices under 25 attract **0% Employer NI** up to £50,270; the current Employer NI rule is unconditional `15%`, over-charging young workers.
- **Where:** add a **condition** to the Employer NI rule — apply the 15% only when the worker's age-band is outside the relief; otherwise 0%.
- **Before → After:** Employer NI `Percentage · Global` → `Percentage · Global · condition: age-band relief`.

### C5 · Remove Weekend + Weekly overtime premiums (Evri)  *(Remove)*
- **Why:** the base is keyed by **Day-type**, and in the file the **weekend uplift already lives in the base day-type rates** (Saturday net > Standard net in **49 of 79** rows). Overtime is a rarely-used **day-type rate** (OT net populated in **2 of 79** rows), not a weekly-hours multiplier. Keeping the Weekend and Weekly-overtime premium *multipliers* double-counts for Evri.
- **Where:** remove both rules from Evri's **Pay premiums** group; day-type variation stays in the base (`Per Role × Site × Day-type × Parity`).
- **Before → After:** Pay premiums (4 rules) → relevant Evri premiums only (see C6 — for Evri, effectively **none**).

### C6 · Remove Bank holiday / Night / shift premiums (Evri)  *(Remove)*
- **Why:** the bank-holiday, night, 6th-shift and shift premium columns are **0 of 79 populated** — Evri uses none of them as premiums, and night is priced as a **separate role** (its own base rate), not a premium.
- **Where:** remove from Evri's config (retain as engine capabilities for templates that need them). After C5+C6, Evri's **Pay premiums** group is empty and can be removed.
- **Before → After:** Pay premiums group removed from Evri's configuration.

### C7 · Remove Seasonal allowance (Evri)  *(Remove)*
- **Why:** "seasonal allowance" appears **nowhere** in the workbook — it is not an Evri variable.
- **Where:** remove the Seasonal allowance rule and its supplier-level input from Evri's config.
- **Before → After:** Allowances = {Geo, Seasonal} → **{Geo}**; supplier-level inputs drop Seasonal allowance.

### C8 · Correct the agency-level variable set  *(Fix)* — see §3
- **Why:** the compiled schema's supplier-level inputs read **{Seasonal allowance, Pension, Markup}** — which both omits the variables that actually feed the bill rate (hours, sick, levy inclusion) and includes one that doesn't exist (seasonal allowance).
- **Where:** the **Compiled rate-card schema** panel, supplier-level inputs.

### C9 · Add Calculation view (Pay / Bill tabs)  *(Add)*
- **Why:** the first implementation shows the rule stack and the compiled schema, but no plain-language view of *how* a pay rate and a bill rate are actually calculated.
- **Where:** a new panel beside the rule stack (alongside compiled-schema / precedence / validation). Two tabs, each with the **summary above the breakdown**:
  - **Pay** — summary + formula `Pay = base (role × site) → NMW floor → day-type → parity`; tier-tagged breakdown (e.g. base £9.85 → NMW floor £12.21 → **= Pay £12.21**).
  - **Bill** — summary + formula `Bill = pay + statutory burden + agency markup + VAT`; tier-tagged breakdown reconciling to the workbook (Best Connection HGV: pay £12.21 → fully-burdened £15.61 → bill £16.56 → incl VAT £19.87).
  - Tier chips `Pay` / `Engine` / `Agency` consistent throughout.
- **Before → After:** stack + schema + precedence + validation panels → **+ Calculation view (Pay / Bill)**.

### C10 · Add template generation + browser preview  *(Add)*
- **Why:** the Rate Engine's purpose is not just to *describe* the calculation — it must **produce the artifact the user fills in**. The first implementation stops at the configured rules and never emits anything to hand to the buyer. The compiled schema should compile one step further, into a **downloadable, fillable template** the user completes and **uploads in Rate Cards** — closing the loop between the two phases.
- **Where:** a new step once the configuration is valid — **Download template** + **Preview in browser** — driven entirely by the compiled schema: dimensions → key columns; value-level inputs → fillable cells; statutory rules → a locked reference + in-sheet formulas.
- **Shape (from the compiled schema):**
  - **Key columns** from the engine's dimensions (pay side: site · tier · role · parity · day-type; agency side: supplier · site · job type).
  - **Fillable input cells** for every value whose level is a rate-card input — the day-type pay rates, and the five agency inputs.
  - **Derived/locked** columns carry the engine's formulas (WTR → NI → pension → levy → sick → direct cost → markup → VAT → bill) plus a locked **Statutory Reference** of the pack constants.
  - Input cells are visually distinct from calculated and locked cells; entries below the NMW floor are flagged.
- **For Evri — blend the two source structures into one file** (the format they already use):
  - **Pay Rates** sheet ← their **Net Pay Table** (site × role × parity × day-type; base + geo, NMW floor, Standard / Friday / Saturday / Sunday / Overtime).
  - **Agency Rate Config** sheet ← their **Charge Rate Calculations** (supplier × site × job type; the five inputs + burden + bill incl VAT, by formula).
  - Plus a locked **Statutory Reference** and an **Instructions** sheet.
- **Recompute on upload:** the platform recomputes authoritatively from the rules and never trusts the file's own formulas (the build spec's "recompute from source" principle); the in-sheet formulas are only a live preview / working aid.
- **Before → After:** configuration ends at a valid rule stack → **configuration compiles to a downloadable template + browser preview → user fills it → uploads in Rate Cards**. (Extends the architecture's output-contract section.)

---

## 3. Accurate agency-level variables feeding the bill rate

The **only** supplier-set variables that affect the bill rate are these five. Everything else in the build is the pay rate (from Pay Rate Configuration) or a statutory value (from the pack — read-only).

| Bill-rate line | Source | Agency-level variable | Level |
|---|---|---|---|
| Pay rate | Pay Rate Configuration | — (not agency-set) | — |
| + WTR holiday (12.07% / 14.04% parity) | Statutory pack | — | — |
| + Employer NI (15% > £96/wk) | Pack rate; uses **agency hours** | **Weekly hours** | per supplier × position group |
| + Pension (% of £120–£967 band) | **Agency %**; pack band | **Pension %** | per supplier × position group |
| + Apprenticeship levy (0.5%) | Pack rate; **agency inclusion** | **Levy inclusion (Y/N)** | per supplier |
| + Sick pay | **Agency** | **Sick pay** (£/hr · % of pay · none) | per supplier |
| = Fully-burdened cost | — | — | — |
| + Markup | **Agency** | **Markup (£/hr)** | per supplier × position group |
| = Bill rate (pre-VAT) | — | — | — |
| + VAT (20%) | Statutory pack | — | — |

**The five agency-level variables (Agency Rate Configuration owns these):** Markup · Pension % · Weekly hours · Sick pay · Levy inclusion.

- **Vary by supplier × position group:** Markup, Pension %, Weekly hours (verified — e.g. Challenge TRG markup £0.90 HGV vs £0.38 Warehouse; hours 40 HGV vs 35 Warehouse; Extrastaff Warehouse-Parity 37.5h).
- **Uniform per supplier (shown per group, with "apply to all"):** Sick pay, Levy inclusion (verified — DCS sick £0.061 across both warehouse groups; Extrastaff levy off across all groups).
- **Read-only / statutory (NOT agency-set):** WTR rate, Employer NI rate + £96 threshold, levy rate, pension qualifying band, VAT — all from the pack.
- **Pay-side, not in this step:** the pay rate itself (Pay Rate Configuration). There is **no** seasonal allowance for Evri.

This matches the five editable fields already specified in `AgencyRateConfig_Step_Spec.md` §5 — the fix is to bring the Rate Engine's compiled schema into line with it.

---

## 4. Resulting Evri configuration (after changes)

```
Worker regular pay   Base                              Per Role × Site × Day-type × Parity
NMW floor            Floor (age-banded, pack)          [C3]
Allowances · Geo allowance   Adjustment·Markup·Absolute   Per Site
Holiday pay · WTR holiday pay  Percentage                Global  (14.04% on Post-parity tab)
= PAY
Employer contributions
  Employer NI        Percentage  + age-relief condition  Global   [C4]
  Pension            Percentage (× qualifying band)       per supplier × group
  Apprenticeship levy Percentage + per-supplier inclusion  Global
  Sick pay           Adjustment·Markup                    per supplier   [C1]
Deductions · Tenure margin reduction  Banded             per Role
Markup               Markup                               per supplier × role-group
Taxes · VAT          Tax/Fee·Percentage                   Global
= BILL

Supplier-level inputs (compiled schema): Markup · Pension % · Weekly hours · Sick pay · Levy inclusion   [C2, C8]
(Pay premiums group removed for Evri — day-type lives in the base)                                       [C5, C6]
```

---

## 5. Cross-cutting — specs to update

1. **`Rate_Engine_Architecture.md`** — add **Floor/Cap** as a first-class rule type and the **condition** pattern in §2; correct the §5 Evri compiled-schema supplier-level inputs to the five in §3; add a §9 rule that day-type variation is modelled **either** in the base **or** as premium rules, never both (prevents C5's double-count class of error).
2. **`AgencyRateConfig_Step_Spec.md`** — already correct (its five fields match §3); no change beyond confirming Weekly hours is shown as a column and Sick/Levy carry "apply to all groups".
3. **`PayRateEngine_Step_Spec.md` (Pay Rate Configuration)** — already shows the NMW floor in the build; ensure the floor is sourced from the pack's age-banded rule (C3), not hardcoded.
4. **Compliance** — the NIC age-relief (C4), pension qualifying band, and NMW bands are pack-owned; the pack is the single source of truth.
