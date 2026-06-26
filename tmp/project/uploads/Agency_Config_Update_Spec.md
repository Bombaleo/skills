# Agency Rate Configuration (detail page) — Update Spec

**Purpose:** redline the per-supplier **Rate Configuration** page so that (a) only the genuinely agency-set variables are editable, and (b) **each is editable at the right grain** — by position group, per supplier, or not by site at all.
**Basis:** the H & G Recruitment screen reviewed against `Rate_Card.xlsm` (Charge Rate Calculations table — 117 rows, 16 suppliers, keyed supplier × site × job type), `Rate_Engine_Architecture.md`, and the change spec §3.
**Scope:** changes to **this page only**. The engine primitives and upstream Pay Rate Configuration are unchanged.
**Status:** design handoff — changes only.

---

## 1. The two rules this page must follow

**Rule A — only five things are editable** (everything else is statutory-locked or sourced from Pay Rate Configuration): **Markup · Pension % · Weekly hours · Sick pay · Levy inclusion**.

**Rule B — each is editable at the grain at which it actually varies in the data.** Verified by variance analysis of the workbook:

| Variable | Varies by **site**? | Varies by **job type**? | Uniform per **supplier**? | **Editable at** |
|---|---|---|---|---|
| **Markup** | no — 0/43 | yes — 10/16 suppliers | 6/16 | **per position group** |
| **Pension %** | no — 0/43 | yes (e.g. HGV 1.9% vs Warehouse 1.5%) | — | **per position group** |
| **Weekly hours** | no — 1/43 (one exception) | yes — 8/16 | 8/16 | **per position group** |
| **Sick pay** | no — 0/43 | **no — 0/16** | **yes — 16/16** | **per supplier** (one value) |
| **Levy inclusion** | no — 1/43 (one exception) | no — 1/16 | **15/16** | **per supplier** (one toggle) |

Two consequences:
- **No agency variable varies by site.** The page has **no site dimension** — one config applies across every site the supplier serves. (Two lone exceptions exist — Extrastaff's warehouse hours 35/37.5 and one supplier's levy — handled as an optional override in U7, not as a site axis.)
- **Three are per-position-group; two are supplier-wide.** Markup, pension % and weekly hours each get a **row per position group**. Sick pay and levy inclusion are **one value for the whole supplier**.

> **Position-group grain must keep HGV and Van separate.** H&G's markup is HGV **£0.95** vs Van **£0.60** — different — which is why the screen splits them into *Transport* (HGV) and *Driver* (Van). The workbook's coarser "Role Type" (which lumps both as *Driver*) is **too coarse** for these inputs; use the finer scheme (Transport = HGV, Driver = Van, Warehouse = Warehouse + Warehouse Parity). Warehouse and Warehouse Parity share one markup/hours value; the parity *pay* uplift is handled upstream, not as a separate agency input.

---

## 2. Redline — element by element

| Screen element | Now | Correct grain & tier | Change |
|---|---|---|---|
| Markup — Transport / Driver | per position group, editable | **Agency · per group** ✓ | keep |
| Workplace pension (1.31%) | **one supplier-wide field** | **Agency · per group** | **U1** move into the per-group table; flag <3% |
| **Weekly hours** | **absent** | **Agency · per group** | **U2 — ADD** as a per-group column |
| Sick pay accrual (0.49%) | one field + toggle | **Agency · per supplier** ✓ grain | **U3** keep one value; re-tag Agency (not statutory) |
| Apprenticeship levy (0.5%) | editable field + toggle | rate **locked**; inclusion **Agency · per supplier** | **U4** lock rate; toggle = supplier-wide Levy inclusion |
| Holiday pay accrual (12.07%) | editable field + toggle | Statutory — **locked** | **U5** read-only, remove toggle |
| Employer's NI (15% > £96/wk) | editable field + toggle | Statutory — **locked** | **U5** read-only, remove toggle, add age-relief note |
| Net pay (£12.21, flat) | flat for all | **Pay tier** — read-only | **U6** source per role × site; £12.21 = NMW floor |
| Pay cost / Charge rate | derived | Derived — read-only ✓ | keep; **U8** add VAT |
| On/off toggles | on every on-cost row | only **Levy inclusion** legitimate | **U5** remove the rest |

**Resulting structure — two editable zones, not one flat list:**
- **Zone 1 — by position group (table):** rows = position groups (Transport, Driver, …); columns = **Markup £/hr · Pension % · Weekly hours**.
- **Zone 2 — supplier-wide (two fields):** **Sick pay** (one value) · **Levy inclusion** (one toggle), each "applies to all groups".

---

## 3. The updates

### U1 · Pension % → move it to the per-position-group table (it is not supplier-wide)
- **Why:** pension % varies by position group (HGV 1.9% vs Warehouse 1.5% in the data), exactly like markup — so a single supplier-wide 1.31% is the wrong grain. On H&G specifically, Transport and Driver may carry different pension %.
- **Before → After:** the standalone "Workplace pension 1.31%" row → a **Pension %** column in the **by-position-group table**, one editable value per group.
- **Also:** keep the **<3% statutory-minimum warning** (1.31% is below the 3% employer minimum on qualifying earnings); show the **£120–£967 qualifying band** as locked pack reference; remove the on/off toggle (auto-enrolment is mandatory; eligibility is a per-worker condition, not a supplier switch).

### U2 · ADD — Weekly hours, per position group
- **Why:** weekly hours is a missing agency variable, it varies by position group (HGV 40h vs warehouse 35–37.5h), and the bill can't be computed without it — Employer NI is `((hours×(pay+WTR))−£96)×15%÷hours` and pension is `band×%÷hours`, both per-hour figures. Concretely, the NI component alone moves ~£0.05/hr between 35h and 40h, so two groups can't share a pay cost unless their hours match.
- **Before → After:** add a **Weekly hours** column to the **by-position-group table** (Transport, Driver…), seeded from the rate card. Pay cost recomputes per group once present.

### U3 · Sick pay → keep one supplier-wide value, but re-tag as Agency
- **Why:** sick pay is genuinely uniform per supplier (16/16 suppliers — e.g. H&G £0.061 across all its work, shown here as 0.49% of pay), so a **single value is the correct grain** — it does **not** go in the per-group table. But it's an **agency** input, not a statutory on-cost.
- **Before → After:** keep one editable field in **Zone 2 (supplier-wide)**; tag it **Agency**; support the unit the rate card uses (£/hr · % · none). The "off" state means *no sick-pay top-up* (a valid value), not a statutory switch.

### U4 · Apprenticeship levy → lock the rate; the toggle is supplier-wide Levy inclusion
- **Why:** the 0.5% **rate** is statutory; the agency-set part is **inclusion** (paybill > £3m), which is uniform per supplier (15/16).
- **Before → After:** **rate read-only** "0.5% of paybill (statutory)"; the toggle becomes **Levy inclusion**, a single **supplier-wide** control in Zone 2.

### U5 · Statutory on-costs → locked, no toggles
- **Why:** WTR holiday (12.07%) and Employer NI (15% + £96/wk) are pack-level statutory — the agency can neither edit nor disable them. The screen's own text says they're statutory, yet renders them as editable inputs with on/off switches.
- **Before → After:** **Holiday/WTR** and **Employer NI** become **read-only locked** rows with an Engine/statutory tier tag and **no toggle**. Add a read-only note that NI is **age-conditional** (0% for under-21s / apprentices under 25, to £50,270). The **only** remaining toggle on the page is Levy inclusion (U4).

### U6 · Net pay → read-only, per role × site, not £12.21 flat
- **Why:** £12.21 is the **NMW floor**, not the pay rate; actual pay comes per role × site from **Pay Rate Configuration** and, for Transport/HGV, is normally above the floor. A flat £12.21 for every group (and an identical pay cost) misrepresents the bill.
- **Before → After:** the description stops treating £12.21 as "the net pay"; the preview's **Net pay** column is **read-only**, sourced per role × site (Pay tier), and may differ by group.

### U7 · Site is not an editing dimension — handle the two exceptions as an override
- **Why:** none of the five vary by site (markup 0/43, hours 1/43, sick 0/43, levy 1/43). So the page must **not** add a site selector or per-site inputs — one config applies across all the supplier's sites. The two lone exceptions (Extrastaff warehouse hours 35 vs 37.5; one supplier's levy) are edge cases.
- **After:** keep the config **site-independent**; offer an optional **per-group override** affordance (not a site axis) for the rare case where one site genuinely differs, clearly marked as an exception.

### U8 · Live preview → show VAT
- **Why:** the charge rate shown (£16.62 / £16.27) is **pre-VAT** (pay cost + markup); the client-facing figure is incl VAT (× 1.20).
- **Before → After:** label the column **"Charge rate (pre-VAT)"** and add **"incl VAT (20%)"** (e.g. Transport £16.62 → £19.94). VAT stays a locked statutory line, not an input.

### U9 · Tier tags + cell treatments
- Apply the shared design system so grain and editability read at a glance:
  - **Editable** → the five agency inputs only (3 per-group columns + 2 supplier-wide fields).
  - **Locked** → all statutory (WTR, NI + threshold, levy rate, pension band, VAT).
  - **Derived / read-only** → Net pay (Pay tier), Pay cost, Charge rate.
  - **Tier chips:** `Agency` on the five inputs, `Engine` on statutory lines, `Pay` on net pay.

---

## 4. Resulting page

**Editable — Zone 1 (by position group · a row per group):**
Markup (£/hr) · Pension % · Weekly hours.

**Editable — Zone 2 (supplier-wide · one value each):**
Sick pay · Levy inclusion.

**Locked (statutory / pack — shown for reference):**
Holiday/WTR 12.07% · Employer NI 15% + £96/wk (+ age-relief note) · Levy rate 0.5% · Pension qualifying band £120–£967 · VAT 20%.

**Read-only (Pay tier — from Pay Rate Configuration):**
Net pay, per role × site (not a flat £12.21).

**Derived (read-only):**
Pay cost · Charge rate (pre-VAT and incl VAT).

**No site dimension** — the configuration applies across all of the supplier's sites; rare per-group exceptions are an override, not a site axis.

**Open items to confirm**
- The **position-group scheme** for this page: confirm Transport = HGV, Driver = Van, Warehouse = Warehouse + Warehouse Parity (finer than the workbook's "Role Type", which is too coarse for markup/pension/hours).
- H&G's **pension %** and **weekly hours** per group (to seed U1/U2 and correct the per-group pay cost).
- Whether the **pension < 3%** rate is intended, and how the warning should read.
- Terminology: this page uses *net pay / pay cost / charge rate / on-costs*; the rest of the system uses *pay rate / fully-burdened cost / bill rate / statutory burden* — worth aligning.
