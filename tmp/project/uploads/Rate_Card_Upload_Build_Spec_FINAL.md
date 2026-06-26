# Rate Card Upload — Final Build & Design Specification

**Audience:** Design (Claude Design) + engineering. This is the design-handoff version — it carries both the functional build and the design instructions for every screen.
**Scope:** Everything from the moment the user **initiates an upload** to the new rate cards **going live**.
**Flow:** ① Upload → ② Validate → ③ Rate Model (3.1 Pay Rate Engine · 3.2 Agency Rate Configuration) → ④ Agency Rate Cards → ⑤ Activate (Go Live).
**Status:** Final draft. Supersedes the working build spec; the five component specs remain as detailed references.

> **How to use this spec (design).** §1 is the shared design system — apply it on every screen. §2–§4 are the rules the UI must express. §5–§9 are the five steps; each gives **Purpose · Layout · Components & behaviour · States**. Wireframes are **structural intent, not final visuals** — design owns the visual language within the §1 conventions; the labelled elements and hierarchy are the requirements.

---

## 1. Shared design system & conventions  *(apply to every screen)*

- **Stepper.** Persistent 5-step progress at top: `① Upload ✓ — ② Validate — ③ Rate Model — ④ Agency Rate Cards — ⑤ Activate`. Completed steps ticked, current highlighted.
- **Severity language (consistent everywhere):** `⛔ Blocker` (red), `❓ Confirmation` (blue/neutral), `⚠ Warning` (amber), `✓ OK / success` (green), `ℹ Info`. Row status uses a coloured dot with an issue count.
- **Bill rate is the primary visual anchor.** Wherever a bill rate appears it is the largest/boldest figure in its row or card; supporting numbers (pay rate, burden, markup, margin %) are secondary.
- **Three cell treatments — always visually distinct:**
  1. **Editable input** — clear affordance (bordered/fillable).
  2. **Derived/computed** — plain, non-interactive (e.g. Basic+Geo, burden amounts, bill rate).
  3. **Locked statutory** — non-interactive **with a `statutory · engine vX` tag**; no input affordance.
- **Tier chips on every waterfall line:** `Pay` (reference) · `Engine` · `Agency`, one consistent colour per tier, so any rate is auditable at a glance.
- **Expandable rows everywhere.** Any rate/line expands to its **tier-tagged waterfall** (`pay rate → burden lines → markup = bill rate`). One consistent expand affordance.
- **Change/delta styling.** Δ£ and Δ% are colour-coded by direction (increase vs decrease) with directional arrows; "what changed" shown as small attribution chips.
- **Version badges:** `Active` · `Pending` · `Scheduled` · `Superseded`. **Region-tier badges:** `National` · `London`.
- **Gated primary buttons.** The forward/commit button is disabled until the step's exit conditions are met, with a tooltip stating what's outstanding (e.g. "2 blockers to resolve").
- **Drill-down principle.** Summary rows stay narrow; detail lives in expansion or a side panel — never widen the table to fit everything.
- **Live recompute feedback.** Editing any input shows the recomputed result (old → new) on affected outputs immediately.
- **Standard states per surface:** loading/processing (with a labelled progress sequence where relevant), empty, error, read-only (no-permission).

---

## 2. VMS terminology  *(the rate vocabulary the UI must use)*

- **Pay rate** — what the worker is paid (the workbook's "net pay"; **£12.21 is the NMW floor**, not a constant — varies by tier/site/role/parity/day-type).
- **Statutory burden** — employer on-costs added to pay (WTR holiday, Employer NI, pension, levy, sick pay). Pay rate + burden = **fully-burdened pay rate**.
- **Markup** — the flat £/hr a supplier adds to the burdened pay rate.
- **Bill rate** — billed to the client = **pay rate + burden + markup**.
- **Margin %** — *derived metric*: markup ÷ bill rate (a read-out, never an input).
- **Supplier ≡ Agency** (UI says "Agency"); **Rate card**; **Labor category ≡ job type / position group**; **Effective date**.

**Core formula the UI expresses end-to-end:  Bill rate = Pay rate + Statutory burden + Markup.**

---

## 3. Governing build principles

1. **Staging, never live.** All work is on a staged copy; live bill rates untouched until Activate (⑤).
2. **Recompute from source — never trust the file's computed bill rates.** Recompute from **standardized** burden formulas + parameters; the workbook's per-row formulas are inconsistent (some pension rows drop the £967 cap; one is a bare `pay × 1.5%`) and are **normalized, not imported**. Surface where recomputed ≠ uploaded.
3. **One owner per number.** Pay rate → Pay Rate Engine; statutory burden **rates** → engine constants; supplier markup & parameters → Agency Rate Configuration.
4. **Nothing disappears silently.** Every uploaded row is classified or listed as **skipped, with a reason**.
5. **Everything is audited.** Mappings, confirmations, edits, effective date, cutover policy, activation.
6. **Statutory compliance is enforced, not assumed** (§8.3 / §9.4).

---

## 4. Target data model (what the upload populates)

- **Engine constants (statutory, shared):** WTR **12.07%** (**14.04% parity**); Employer NI **15%** above **£96/wk**; pension qualifying-earnings band **£120–£967/wk**; levy **0.5%**; peak factor.
- **Pay Rate Engine:** pay rate keyed by **Region tier (National/London) × Site × Labor category × Parity × Day-type** + the burden formulas → the fully-burdened pay rate.
- **Agency Rate Configuration:** per **supplier × position group** — **markup** (£/hr), **pension %**, **weekly hours**, **sick pay** (£/hr or %), **levy inclusion (Y/N)**.
- **Bill-rate chain:** `pay rate → +WTR → +Employer NI → +pension → +levy → +sick = fully-burdened pay rate → +markup = bill rate`.

---

## 5. Step ① — Upload

**Purpose.** Receive the workbook and confirm it's parseable.

**Layout.** Drop-zone / file-picker; accepted-format note; upload progress; on submit, a **readability check** ("checking the file…"). On failure, an inline error stating what's wrong with a route back to re-select.

**States.** Idle → Uploading → Readability check → {Pass → Validate · Fail → reason shown, stay on Upload}.

---

## 6. Step ② — Validate  *(is the data sound and organized?)*

**Purpose.** Show every warning, issue, and update; let the user make the **data-quality** fixes. (Supplier-parameter edits happen in ③.2.)

**Layout.**
```
┌ Stepper ──────────────────────────────────────────────────────────────┐
│  ✓ We read 132 rates from Rate_Card.xlsm                                │
│  ⛔ 2 to fix    ❓ 4 to confirm    ⚠ 11 to review                        │
│                                                                         │
│  A · How we organized your data                                         │
│     Pay-rate data · Agency-config data · constants · lookups            │
│     ▸ Column mapping        ▸ Skipped rows (each with a reason)         │
│                                                                         │
│  B · Resolve before continuing                                          │
│     ⛔ Blockers (2)                    ❓ Confirmations (4)               │
│                                                                         │
│  C · What this upload will change                                       │
│     +6 new · ~18 changed · −2 removed    ▸ per-row diff (Δ£ · Δ% · why) │
├─ Back to upload ───────────────────────── Continue to Rate Model (gated)┤
└─────────────────────────────────────────────────────────────────────────┘
```
Processing view first shows a labelled sequence: **Parse → Map → Classify → Normalize → Validate → Diff**.

**Components & behaviour.**
- **A — Organization (transparency).** Classification counts into Pay-Rate-Engine data / Agency-Config data / engine constants / lookups; **expandable** `source column → model field` mapping (editable, with auto-mapped/confidence indicator); **expandable** skipped-rows list, each with its reason.
- **B — Resolve.** **Blockers** (must fix) each show what's wrong, which rows, and an **inline resolution control**. **Confirmations** are small explicit choices with a **default pre-selected** and the impact shown.
- **C — Updates.** Dataset-level change summary; **expand to a per-row diff** (old → new, **Δ£/Δ% colour-coded with arrows**, and **"what changed" chips** — `Pay rate ↑`, `Markup ↑`, `Hours`, `New mapping`).

**States.** Processing · Parse-failure (→ Upload) · Blockers/Confirmations present (Continue gated) · Warnings-only (Continue enabled) · Clean.

---

## 7. Step ③ — Rate Model  *(the calculation, in two parts)*

### 7.1 Pay Rate Engine  *(read-only — how pay rates are calculated)*

**Purpose.** Let the user verify the shared, statutory foundation before any supplier pricing.

**Layout.**
```
[ Region tier: ‹National›  London ]              Site: [ Warrington ▾ ]
Columns: ‹Net pay by day-type›   Rate build   Premiums & shifts
┌──────────────────────────────┬────────┬───────┬───────┬───────┬───────┐
│ Role  (grouped by job type)  │ Parity │ Std   │ Fri   │ Sat   │ Sun   │
├─ Warehouse ──────────────────┼────────┼───────┼───────┼───────┼───────┤
│ Warehouse Operative AM       │ Pre    │ 12.21 │ 12.21 │ 12.49 │ 12.49 │
│ Warehouse Operative PM       │ Pre    │ 12.32 │ 12.32 │ 12.75 │ 12.75 │
├─ Warehouse Parity ───────────┼────────┼───────┼───────┼───────┼───────┤
│ Warehouse Operative AM       │ Post   │ 12.28 │ 12.28 │ 12.57 │ 12.57 │
└──────────────────────────────┴────────┴───────┴───────┴───────┴───────┘
  ▸ expand a role → cost-side waterfall: pay → +WTR → +NI → +pension → … = fully-burdened pay rate
```

**Components & behaviour.**
- **Scoped by location** — Region-tier toggle (National | London) + Site selector above the grid; optional side-by-side compare (*National vs London*, *vs previous version*).
- **Rows = roles grouped by labor category; parity is a row attribute (Pre/Post visibly paired)** so the uplift reads at a glance.
- **Switchable column groups** to control width: *Net pay by day-type* (Std/Fri/Sat/Sun/OT) · *Rate build* (Hourly rate/Geo/Basic+Geo) · *Premiums & shifts*.
- **Read-only** (corrections to pay go via re-upload; statutory rates via engine admin) — render all cells in the derived/locked treatments (§1), not as inputs.
- **Cost-side waterfall** on expand (pay → burden = fully-burdened pay rate), tier-tagged.
- **Verification cues:** NMW-floor markers (distinguish a genuinely-floored £12.21 from one that should be higher), a flag where **London ≤ National**, and **gap highlighting** (missing day-type / missing role at a site).

**States.** Loading · grid · compare · empty (no pay rates for the tier/site).

### 7.2 Agency Rate Configuration  *(editable — supplier overrides & markup)*

**Purpose.** Configure each supplier's markup and cost parameters.

**Layout — two view modes.**
*By supplier (primary — configure one supplier):* a table keyed by **position group**:
```
Supplier: [ Staffline Group ▾ ]
┌─────────────┬────────┬─────────┬────────┬────────────┬───────┐
│ Position    │ Markup │ Pension │ Hours  │ Sick pay   │ Levy  │
│ group       │ £/hr   │  %      │ /wk    │ £/hr or %  │ incl. │
├─────────────┼────────┼─────────┼────────┼────────────┼───────┤
│ Warehouse   │ 0.40   │ 1.5     │ 37.5   │ — (none)   │  Y    │
│ Transport   │ 1.05   │ 1.9     │ 40     │ £0.06      │  Y    │
└─────────────┴────────┴─────────┴────────┴────────────┴───────┘
Statutory burden (read-only): WTR 12.07% (14.04% parity) · Employer NI 15% >£96/wk · levy 0.5% · pension band £120–£967
```
*Compare suppliers (secondary — peer view):* one matrix per parameter, **rows = supplier, columns = labor category**, grouped **Commercial** (Markup) vs **Cost inputs** (Pension % · Hours · Sick · Levy), so blanks (missing markup) and outliers jump out.

**Components & behaviour.**
- **Editable cells** (markup £, pension %, hours, sick pay = value + a **fixed-£/%/none type selector**, levy Y/N toggle) in the editable treatment; **statutory burden shown read-only alongside** (§1 locked treatment).
- **Margin vs cost-inputs framing:** markup is a commercial markup; the rest are cost inputs that re-run the burden calc — reflect this grouping visually.
- **Live recompute** on edit (preview the affected supplier's bill rates).
- **Bulk & reuse:** "apply to all position groups", apply down a column across suppliers, **clone a supplier's whole config**.
- **Validation (inline):** missing markup → invalid; margin/pension/hours outside peer band → outlier warning; blank-vs-zero confirm on sick/levy.
- **Not editable here:** pay rate (③.1), statutory **rates**, derived burden amounts. To "fix" a pension figure, edit the **pension %**.

**States.** Per-supplier edit · compare matrix · recompute-in-progress · read-only (no-permission).

---

## 8. Step ④ — Agency Rate Cards  *(the output + simulation)*

### 8.1 Rate cards by supplier

**Purpose.** Show the resulting bill-rate cards.

**Layout.**
```
[ Group by: ‹Supplier› Site  Labor category ]   [Filter ▾] [🔍]   chips: Errors · Missing markup · Outliers · Changed
┌───────────────────────────────────────────────────────────────────────────┐
│ ● Staffline Group ▸                                                         │
│   Market   Labor category   Pay   Burden  Markup   BILL RATE   Margin %     │
│   Warrington  Warehouse      12.21  3.65    2.25    █ 18.11 █     12.4%   ▸ │
│     └ expand → waterfall: pay → +WTR → +NI → +pension → +levy → +sick → +markup = bill rate (tier-tagged)
└───────────────────────────────────────────────────────────────────────────┘
```
Bill rate is the row anchor (boldest). Status dot + issue count per row; flagged waterfall lines show their note inline.

### 8.2 Simulator — "what would we actually bill?"

**Purpose.** Resolve a concrete scenario from the **staged** cards to confirm real billing.

**Layout — two columns.**
```
LEFT (inputs)                         RIGHT (outputs)
┌ Pricing config ───────────┐         ┌ Hourly bill rate ───────────────────┐
│ Position · Supplier ·      │         │ Pay rate              £12.21 /hr     │
│ Legal entity · Location    │         │ + WTR (12.07%)        £1.47          │
├ Worker ───────────────────┤         │ + Employer NI         £1.69          │
│ Age · Tenure (→parity) ·   │         │ + Pension             £0.41          │
│ Hours worked this week     │         │ + Levy · + Sick                     │
├ Assumptions ──────────────┤         │ = Fully-burdened pay  £15.86         │
│ locked statutory (read-only)│        │ + Markup              £2.25          │
│ editable supplier params    │        │ = BILL RATE           █ £18.11 █     │
│ VAT · OT threshold · OT rate│        ├ This booking ───────────────────────┤
└───────────────────────────┘         │ bill × hours + VAT = total incl VAT │
Presets: highest-markup · parity ·     │ tiles: £/hr incl VAT · margin % ·   │
under-21 · each new/changed line       │        bill-vs-pay multiple         │
                                       └─────────────────────────────────────┘
```

**Components & behaviour.**
- **Inputs grouped:** Pricing config (Position · Supplier *selectable* · Legal entity · Location → resolves which pay rate); **Worker** (Age · Tenure → derived parity · hours-worked); **Assumptions** (locked statutory in the locked treatment; editable supplier params; commercial VAT/OT); **Booking** (dates/times → hrs/shift · days · total).
- **Outputs:** the tier-tagged hourly **bill-rate waterfall**; **booking total** (bill × hours + OT + VAT = total incl VAT); **summary tiles** (bill/hr incl VAT · margin % · bill-vs-pay multiple).
- **Presets** for the riskiest cases; a scenario can be **pinned**.
- **UK-law guardrails (§8.3)** surface inline as warnings/errors during simulation.

### 8.3 UK-law guardrails (full table in *Rate_Card_Simulator_Spec.md* §7)
**Age** drives three things the static workbook misses; **Tenure** drives parity:
- **NMW by age** (NLW 21+ £12.21; 18–20 £10.00; 16–17/apprentice £7.55) — warn if pay rate < the age-band floor.
- **Employer-NIC relief** for under-21s/apprentices under 25 (0% up to £50,270) — their Employer NI ≈ £0; flat 15% overstates.
- **Pension auto-enrolment** (22→SPA, >£10k; employer min **3%** of qualifying earnings) — **the file's 1.5–2.5% supplier rates are below this minimum → flag likely non-compliant**; suppress pension for non-eligible workers.
- **AWR parity at 12 weeks** → post-parity pay rate **and** parity WTR (14.04%).
- **Levy** only if supplier paybill > £3m; **SSP** is a real cost (0% understates); **VAT 20%** on the whole bill; **Working time** 48-hr average — warn if exceeded.
> Statutory figures are 2025/26; source centrally and re-verify against current HMRC/DWP tables each April. Monitor (don't hard-code) Employment Rights Bill day-1 SSP and umbrella-company regulation.

**8.4 Exit.** Review + simulate, then **Continue to Activate**. No live data written here.

---

## 9. Step ⑤ — Activate (Go Live)  *(the only step that writes live bill rates)*

**Purpose.** Publish the staged cards with an effective date and manage the cutover safely.

**Layout.**
```
┌ Effective date ────────────────────────────────────────────────────────┐
│  ( ) Immediate     (•) Scheduled  [ dd/mm/yyyy ]   ⚠ mid-pay-week warning│
├ Cutover for active work ────────────────────────────────────────────────┤
│  (•) New bookings only   ( ) Apply forward to all active   ( ) Per-contract│
│      → 24 active assignments affected by this choice                     │
├ Impact ─────────────────────────────────────────────────────────────────┤
│  Active assignments: 24 · Bill movement: +£1,920/wk · ↑18 ↓4            │
│  ⛔ 1 rate decrease breaches NMW/parity at the effective date            │
├ Re-validation ──────────────────────────────────────────────────────────┤
│  ✓ compliance re-checked on effective date · ⚠ live version changed since│
│     Validate (re-diff)  · engine v0.82 confirmed                         │
├ Approval ──────────────── (if required) Pending → Approved ─────────────┤
└ Back ───────────────────────────────────────── Activate (gated) ───────┘
```

**Components & behaviour.**
- **Effective date:** Immediate or Scheduled; **warn on a mid-pay-week date** (splits the weekly NI/pension thresholds). A future date supersedes the prior version from that date; prior version end-dated at effective − 1.
- **Cutover policy (the key change-handling control):** radio — *New bookings only* (default-safe, active bookings grandfathered) · *Apply forward to all active* · *Per-contract* — with the **count of affected active assignments** shown for the choice.
- **Impact assessment:** affected active assignments/POs; total bill-rate movement (£), # up/# down, largest movers; every **rate decrease** flagged — any breaching **NMW or AWR parity** at the effective date is a **blocker**.
- **Re-validation at commit:** re-run compliance against the figures **effective on the chosen date** (NMW/NIC/SSP/pension band change each April); **re-diff against the current live version** (warn if it moved since Validate); confirm engine version.
- **Authorization:** permission-gated; optional **Pending approval → Approved → Activated** with the approver shown the impact.
- **Apply (commit):** **atomic** — all-or-nothing, roll back on failure (staged version preserved), concurrency-safe.

**Post-activation.** Confirmation summary (what's now `Active`/`Scheduled`, effective range, headline impact); notifications to affected stakeholders; full audit record (effective range, engine version, cutover policy, approver, who); **rollback** to the previous version (window/permission); a `Scheduled` version is editable/cancellable before it goes live.

**States.** Ready · Blocked (NMW/parity breach, unresolved drift) · Pending approval · Applying (atomic) · Activated · Scheduled · Apply-failed (rolled back).

---

## 10. Consolidated validation taxonomy

| Step | Type | Checks | Effect |
|---|---|---|---|
| ② Validate | **Blocker** | Unreadable file / missing column / row missing required field / unmatched location or labor category / duplicate key / engine-constant mismatch | Must resolve |
| ② Validate | **Confirmation** | Low-confidence mapping / blank-vs-zero / inconsistent levy / engine-constant acceptance / new site or labor category | Must answer (defaulted) |
| ② Validate | **Warning** | Pension deviated from standard (recomputed) / rounding drift / hours mismatch / outlier / missing day-type | Review, non-blocking |
| ③.2 Agency Rate Config | **Value** | Missing markup / pay rate missing or zero / bill rate ≤ pay rate | Block or acknowledge |
| ④ Rate Cards (simulator) | **Compliance** | Below NMW (error) / pension < 3% (warn) / NIC relief not applied (warn) / parity not reflected (warn) / working time > 48h (warn) / levy threshold mismatch (info) | Surface at review |
| ⑤ Activate (commit) | **Cutover / drift** | Rate decrease breaching NMW/parity at the effective date (blocker) / live changed since Validate (warn) / engine constants changed since staging (re-acknowledge) / statutory figures differ on a future date (apply the date's figures) / mid-period effective date (warn) | Final gate before live |

Structural → **Validate**; value → **Agency Rate Configuration**; compliance at review → **simulator**; cutover/drift/final compliance → **Activate**.

---

## 11. State machine

| State | Transitions |
|---|---|
| File received → **Readability check** | pass → Validate · fail → Upload (reason) |
| **Validate**: Processing → {Blockers/Confirmations \| Warnings-only \| Clean} | resolve → Rate Model |
| **Rate Model**: Pay Rate Engine (review) → Agency Rate Configuration (edit) | value gate → Rate Cards |
| **Agency Rate Cards**: review → simulate | → Activate |
| **Activate**: date + cutover → Impact & re-validation → {Ready \| Blocked \| Pending approval} | resolve/approve → Apply |
| **Apply**: Applying (atomic) → {Activated \| Scheduled \| Apply-failed (rolled back)} | live / scheduled / retry |
| Any step → **Back / Cancel** | discards staged data (confirm) |

---

## 12. Audit & versioning

- Each step writes to the audit log: Validate confirmations + fixes; Agency Rate Configuration edits (field · old → new · user · time); effective date; cutover policy; approval; activation.
- **Activate creates a new version** (effective range, engine version, cutover policy, applied-by, change summary); prior version superseded from the effective date.
- Staged data discarded on cancel; Scheduled versions visible and editable/cancellable; rollback reverts to the previous version.

---

## 13. Acceptance criteria (whole flow)

- [ ] Shared design conventions (§1) are applied on every screen: stepper, severity language, bill-rate anchor, three cell treatments, tier chips, expandable waterfalls, Δ colour-coding, version/tier badges, gated buttons.
- [ ] Upload performs a readability check and routes failures back with a reason.
- [ ] Validate parses and either classifies or skips (with reason) **every** row; mapping shown and editable; blockers/confirmations gate Continue; warnings pass through; updates shown with a per-row diff.
- [ ] Bill rates are **recomputed from standardized formulas**, not imported; deviations flagged.
- [ ] Pay Rate Engine: read-only grid by tier/site/category, parity paired, switchable column groups, NMW-floor markers, cost-side waterfall.
- [ ] Agency Rate Configuration: per-position-group editable table (+ compare-supplier matrix); statutory burden read-only; live recompute; bulk/clone; value validation.
- [ ] Agency Rate Cards: bill-rate cards by supplier with tier-tagged waterfall; two-column simulator with the §8.3 guardrails firing; selectable supplier; staged data only.
- [ ] **Activate is the only step that writes live data**: requires effective date + cutover policy + impact assessment + passing re-validation; rate cuts breaching NMW/parity blocked; atomic commit with rollback; result is `Active` or `Scheduled`, audited.
- [ ] Statutory figures sourced centrally; a future-dated activation uses the figures effective on its date.

---

## 14. Open questions

- **Cutover default** — "new bookings only", or follow supplier contract terms by default?
- **Mid-period changes** — hard-block off-boundary effective dates, or warn and allow?
- **Rollback window** — anytime, or fixed window post-activation?
- **Approval workflow** — always required to publish, or only above an impact threshold?
- **Hard-block vs acknowledge** on value errors (③.2).
- **Editable scope** — confirm pay rate is import-only (corrected via re-upload), not editable in the Pay Rate Engine.
- **Comparison baseline** — always current live version, or any prior version?
- **Compliance source of truth** — hold NMW bands, SSP, NIC thresholds, QE band centrally with the effective tax-year surfaced.
- **Peak/bank-holiday cards** — apply the peak factor as a final waterfall line.
