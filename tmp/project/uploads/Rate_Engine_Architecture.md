# Rate Engine — Scalable Architecture

**Purpose:** the structure-only engine by which **any organization, in any industry, in any country** defines **how a pay rate and a bill rate are calculated, and at what levels** — so that the resulting **rate card import has exactly the right columns and inputs**.
**Operationalizes:** *Rate_Engine_Spec.md*. The "New Pricing Configuration" UI is **inspiration for the organizing model only** — its *values* (multipliers, percentages, dates) are not engine settings (see §3).
**Status:** Draft for design + engineering.

---

## 1. What the Rate Engine is — and is not

The Rate Engine defines the **method and the levels** of pricing. It contains **no values**. Its output is a **schema**: the dimensions and rules that determine what a pay rate and a bill rate are made of — and therefore what the rate card the user later imports must contain.

```
RATE ENGINE (this phase)            ── structure only, ZERO values ──
   defines: dimensions + rules (calculation method) + the level of every value
        │
        ▼  emits a value-free schema
RATE CARD (import phase)            ── all values entered here ──
   the schema becomes the import's columns & inputs; the user fills them in
```

**The test of correctness:** if you can read a *price* off the engine, something is in the wrong place. "There is an overtime rule, calculated as a multiplier on the base, set at the role level" is engine. "The multiplier is 1.5" is a rate-card input.

---

## 2. The model

A configuration is an **ordered stack of groups, each an ordered stack of rules** (the organizing idea borrowed from the UI). Each rule is a typed, scoped, conditional, optionally-banded *operation* that adjusts a running value; the running value is the **pay rate** at the worker-payable boundary and the **bill rate** at the end.

```
Configuration (per organization)
├─ variant: Pre-parity | Post-parity | …      (variant axis, optional)
└─ Groups (ordered · reorderable · collapsible)
   ├─ Worker regular pay        [default first]   ── base
   ├─ Pay premiums                                ── overtime, weekend, night, bank-hol …
   ├─ Allowances · Holiday · Employer contributions · Deductions
   ├─ Markup                    [default]
   └─ Taxes                     [default last]
        running value:  base …→ = PAY (worker-payable boundary) …→ = BILL
```

Groups organize the pipeline; order is the calculation sequence. The named rules above are not special — they are **presets of a few generic rule types** (§4).

---

## 3. Foundational rule — no values, only structure and level

For **every** quantity a rule needs (a rate, a multiplier, a percentage, a threshold, an amount, a band boundary, a specific date/day/time), the engine declares **only the level at which that value will be supplied** — never the value itself.

- **Level** can be *global* (one input for the whole organization, e.g. a holiday-pay percentage), or *per-dimension* (a value that varies by role, site, supplier, day-type… → a column keyed by those dimensions).
- The value is then entered in the **rate card import**, at that level.
- Jurisdiction packs and industry templates may *ship default import values as data* to pre-fill the import — but those defaults are rate-card data, **not** part of the engine structure.

This is what guarantees the import "has the right columns": the engine has already declared every value's existence and level.

---

## 4. The rule — the atomic unit (structure only)

| Field | Meaning | Values (all structural) |
|---|---|---|
| **Rule type** | behaviour | `Base` · `Adjustment` · `Markup` · `Tax/Fee` |
| **Adjustment direction** | for `Adjustment` | `Markup` (add) · `Deduction` (subtract) |
| **Calculation type** | *how* a value is applied (not the value) | `Multiplier` · `Percentage` · `Absolute` · `Banded` · `Formula` |
| **Calculation base** | what it applies to | running value · a named base (e.g. worker's hourly rate, qualifying-earnings band) |
| **Recipient** | who it accrues to → assigns pay/bill side | `Worker` · `Statutory body` · `Agency` · `Client` |
| **Scope / level** | which dimensions key the rule's value | `All` or specific — Position, Location, Supplier, Day-type… → **drives column granularity** |
| **Conditions** | *type* of gate (the parameters are rate-card inputs) | date · time-of-day · day-of-week · numeric threshold · tenure · dimension match; `AND`/`OR` |
| **Bands** | *that* it is banded, and by which numeric axis (boundaries + per-band values are inputs) | banded by tenure / hours / volume |
| **Value level** | where each needed value is supplied | `Global` or `Per [dimensions]` — all values are rate-card inputs |
| **Visibility** | transparency | display on invoice · display in pricing breakdown |
| **Order / locked** | position; defaults locked | — |

### 4.1 The UI's rules, expressed as structure (inputs, not values)

The numbers shown in the screenshot are **rate-card inputs**, listed here only to show what each rule *asks the import to supply*.

| Rule (from UI) | Type | Calc method | Condition (type) | Level of value | Rate-card supplies |
|---|---|---|---|---|---|
| Worker regular pay | Base | — | — | per Role × Site × Day-type × Parity | the base pay rates |
| Weekly overtime | Adjustment·Markup | Multiplier | hours threshold | per Role (or global) | threshold + multiplier |
| Bank holiday premium | Adjustment·Markup | Multiplier | specific dates | global | dates + multiplier |
| Night shift premium | Adjustment·Markup | Absolute | time window | global | window + amount |
| Weekend premium | Adjustment·Markup | Multiplier | days of week | global | days + multiplier |
| Seasonal allowance | Adjustment·Markup | Absolute | (contract) | per Supplier | the allowance amount |
| WTR holiday pay | Adjustment·Markup | Percentage | — | global | the percentage |
| Employer NI | Adjustment·Markup | Percentage | threshold | global | rate + threshold |
| Pension auto-enrolment | Adjustment·Markup | Percentage | qualifying band | per Supplier | rate (+ band) |
| Apprenticeship levy | Adjustment·Markup | Percentage | — | global (+ per-supplier flag) | rate (+ include?) |
| Tenure margin reduction | Adjustment·Deduction | Banded | tenure | per Role (bands) | band boundaries + amounts |
| Markup | Markup | — | — | per Supplier × Role-group | the markup |
| VAT | Tax/Fee | Percentage | — | global | the rate |

Every rule reduces to four generic types — and every number is something the import collects, never the engine.

---

## 5. The headline output — the rate card schema (the "right columns")

The engine compiles to the import's structure:
- **Dimensions → key columns.** The dimension set becomes the rate card's keys/axes.
- **Rules × their levels → value inputs.** Per-dimension values become **columns** at the right granularity; global values become **single inputs** (header/reference fields).

**Evri, compiled:**
- **Key columns:** Region tier · Site · Position (role) · Parity · Day-type.
- **Per-row value columns:** base pay (per Role × Site × Day-type × Parity).
- **Site-level inputs:** geo allowance.
- **Supplier-level inputs:** markup, pension %, levy inclusion, seasonal allowance.
- **Global/reference inputs:** WTR %, Employer NI rate + threshold, VAT %, and the premium parameters (overtime threshold/multiplier, weekend/bank-holiday/night settings).

That is precisely the shape of the uploaded workbook — per-row rates plus org-level reference parameters — and the engine produced all of it with **no values inside it**.

---

## 6. The pay / bill boundary

The running value flows through the stack: **pay rate** = the value at the worker-payable boundary (after worker-recipient rules); **bill rate** = the final value (after employer contributions, deductions, markup, taxes). The boundary is set by rule recipient + an explicit `PAY` marker, so each org places its split where its commercials sit. Both, plus subtotals (e.g. fully-burdened cost), are exposed.

---

## 7. Universality — any organization, industry, country

| Variation | Mechanism (structure only) |
|---|---|
| **Country** | **Jurisdiction packs** — the set of statutory *rules* (minimum-wage floor, employer-tax components + thresholds, mandated holiday, pension, levies, sales tax/VAT, equal-treatment timing) as locked structure. The *rates* are import inputs (packs may pre-fill them as data). |
| **Industry** | **Templates** — a starting stack of groups/rules (staffing, consulting, rental, managed services). |
| **Org / use case** | generic rule types + configurable **dimensions**, **currency**, **unit/period** (hourly/daily/per-shift/fixed/per-unit), and any **condition/band** type. |

**Evri** = UK pack + staffing template → the columns in §5. A **US consulting** firm = US pack + consulting template: dimensions skill×seniority×region, a `Base` day-rate, one overhead `Adjustment` (percentage), a percentage `Markup`, an MSP `Fee`, US sales `Tax` — no floor, no parity, USD, daily → a completely different column set. A **flat service** = `Base → Markup → Tax`. Same engine; the import shape follows the structure.

---

## 8. Variants (parity, and beyond)

The Pre/Post-parity tabs generalize to **variant sets** along a derived dimension. A variant **inherits** the base stack and **overrides only what differs** — it never duplicates the configuration, and it never introduces values (only structural differences, e.g. a parity-only holiday percentage *input* appearing). Adding a variant axis adds tabs, not copies.

---

## 9. Scalability (complexity)

A configuration is *structure* — tens to low-hundreds of rules, not data — and must stay manageable as it grows:
- **Hierarchical collapse** of groups/rules; **drag-reorder**; **search/filter**; **summary vs detail** density.
- **Templates & presets** — add a preset group/rule (e.g. a pack's "Employer contributions") rather than authoring each.
- **Variant inheritance** (§8) — override-only.
- **Reusable libraries** — dimensions, packs, and rule presets shared across an org's configurations.
- **Config-time validation** (§11) and a **preview** that runs the structure against *sample* values (real values are in the rate card).
- **Performance:** virtualize long stacks; lazy-render collapsed groups.

---

## 10. Rule precedence & stacking *(first-class)*

Conditional rules overlap, and the engine must define the outcome — this is structural, so it belongs here, not in the rate card:
- a day that is **both bank holiday and weekend**; **overtime on a Sunday**; overlapping **time windows**.

Per group or rule, support **stacking** (apply in order on the running value), **precedence** (first/highest matched wins), and **mutual exclusion**. Order within a group is the default tiebreaker. It must be explicit and visible — it's where large configurations silently break — and it travels in the output contract.

---

## 11. Validation / guardrails (config-time, value-free)

- Both pipelines compute a single coherent **pay** and **bill**; no orphan/circular rules; the `PAY` boundary is set.
- **Every value has a declared level** → the compiled rate-card schema is complete (no rule needs a value with nowhere to enter it).
- Conditions are well-formed; **precedence/stacking** resolved; overlaps flagged.
- Bands declare a covering axis (boundaries/values are inputs, validated at import).
- Pack structure is consistent; **derived dimensions** carry rules; **unit/currency** set before bill/tax rules.
- Variant overrides reference rules that exist in the base.

---

## 12. Output contract → rate card phase

Emits a **versioned, value-free schema**: dimensions (with derivations); groups & rules (type · direction · calc method · base · recipient · scope/level · conditions · bands · visibility · order); variants + overrides; pack; unit/currency; pay/bill boundary; precedence/stacking policy; **and the compiled rate-card schema (key columns + value inputs, with levels).**

The import collects the values; the **Pay rate engine** step renders the worker-payable rules + entered data; **Agency rate configuration** exposes supplier-level inputs; **Agency rate cards** compute the full stack; **Activate** uses the pack for compliance.

---

## 13. Cross-cutting & dependencies

1. **The compiled schema is the contract** with the rate card phase — it must be **stable and versioned**; it is the "recipe" the Pay rate engine step consumes.
2. **Schema versioning & migration** — changing dimensions/rules changes the import's columns and every rate card on that version; configurations are versioned with a migration/impact path.
3. **Jurisdiction packs are shared infrastructure** feeding both the bill structure and **Activate** compliance checks.
4. **Permissions** — configuring the engine is an org/admin capability, distinct from entering rate-card values.
5. **Naming** — keep "Rate Engine" (this phase) distinct from the upload's "Pay rate engine" step.

---

## 14. Open questions

- **Condition logic** — flat `AND`/`OR` or nested boolean groups?
- **`Formula` calculation type** — expressiveness (cross-rule refs, functions) and sandboxing?
- **Variant axes beyond parity** — how many, and can they combine?
- **Recipients/sides** — fixed (Worker/Statutory/Agency/Client) or extensible?
- **Value level granularity** — any limit on how many dimensions a value can be keyed by (column explosion)?
- **Pack authoring & default values** — can users extend packs and ship default import data, or only select maintained ones?
- **Multiple configurations per org** — per business unit / contract type, or one per organization?
