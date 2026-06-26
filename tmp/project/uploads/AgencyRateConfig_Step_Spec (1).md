# Agency Rate Configuration — Step Specification (revision)

**Step:** Rate Cards flow → step ④ **Agency Rate Configuration**
**Flow:** ① Upload → ② Validate → ③ Pay Rate Configuration → ④ Agency Rate Configuration → ⑤ Rate Cards → ⑥ Activate
**Scope:** This document changes **only** the Agency Rate Configuration step. It does **not** modify Validate (②), Pay Rate Configuration (③), Rate Cards (⑤), or Activate (⑥). Areas those changes *affect* are flagged in §10 for their owners.
**Supersedes:** §7.2 of *Rate_Card_Upload_Build_Spec_FINAL.md* and the single-supplier *Agency_Detail_Rate_Config_Spec.md* page model, for this step.
**Design system:** follows *Rate_Card_Upload_Build_Spec_FINAL.md* §1. Companion to *PayRateEngine_Step_Spec.md* — same patterns, applied to the bill side.
**Status:** Draft for design + engineering.

---

## 1. Purpose

After upload, this step is where the user **sees, understands, and edits each supplier's commercial markup and cost parameters** — turning the shared pay rate (from ③) into a **bill rate** per supplier. The pay rate and the statutory burden are inputs the user does not own here; what the user sets is the **supplier-owned** parameters (markup, pension %, weekly hours, sick pay, levy inclusion).

The same three needs apply as in the Pay Rate Configuration: show *all* supplier configs in one place, make *how each bill rate is built* legible, and let the user *edit the supplier data* — at a scale of tens to hundreds of supplier × position-group rows.

---

## 2. Scope boundary

| In scope (this step) | Out of scope (owned elsewhere) |
|---|---|
| Display all supplier × position-group configs | The rate recipe / engine structure (separate phase — read-only input) |
| Group / filter the configs | The pay rate (③ Pay Rate Configuration) |
| Edit supplier **data** (markup, pension %, hours, sick, levy) | Statutory burden **rates** (pack/engine — read-only) |
| Show the bill-rate build (how it's calculated) | Final go-live / effective dating (⑥ Activate) |
| Surface compliance & data issues | The bill-rate cards themselves (⑤ — computed downstream) |

The **statutory burden is read-only** (WTR, Employer NI, levy rate, pension band come from the jurisdiction pack). The **bill rate and margin %** are derived outputs, never inputs. To change a number, edit the supplier input that drives it.

---

## 3. Default view — one table, grouped and filtered

The first thing the user sees is **every supplier's config in a single table** — no mandatory single-supplier scope. This replaces the old "By supplier / Compare suppliers" toggle: both are now just choices of the **Group by** control.

**Layout**
```
Agency Rate Configuration
┌ search suppliers… ─┐  Position group:all▾   [Missing markup] [Pension <3%] [Outliers]
Columns: Commercial · Cost inputs · ‹All›                          Group by ▸ [ Supplier ▾ ]
ℹ Statutory burden (read-only): WTR 12.07% (14.04% parity) · Employer NI 15% >£96/wk · levy 0.5% · pension band £120–£967
43 configs · 16 suppliers · grouped by supplier · filtered: pension <3%
┌────────────────────────────────────────────────────────────────────────────┐
│ Position group   Markup £/hr   Pension %   Hours   Bill rate   Margin %    ⌄ │
│ ▾ Best Connection · 1 group                                                  │
│   HGV Driver      [0.95]       [1.31] <3%  [40]    £16.56      5.7%         ⌄ │
│ ▾ Staffline · HGV Driver needs a markup                                      │
│   HGV Driver      [  —  ] ⛔    [2.10] <3%  [40]    —           —           ⚠ │
│ ▸ Extrastaff · 3 groups · levy off    ▸ Generic · 3    ▸ +10 suppliers        │
└────────────────────────────────────────────────────────────────────────────┘
```

**Group by (top-right).** Re-cuts the same rows:
- **Supplier** (default) · **Position group** (the old "compare suppliers" — markup/pension side by side across suppliers) · nested (Supplier › Position group).

**Filters (bar).**
- Dimension: Supplier · Position group.
- Derived/quick: **Missing markup · Pension < 3% (compliance) · Outliers (markup/pension/hours outside the peer band) · Changed vs current · Levy on/off · Sick set/none**.

**Column groups** (toggle, mirrors ③): **Commercial** (markup · bill rate · margin %) · **Cost inputs** (pension % · hours · sick · levy · bill rate) · **All**. Markup is the commercial margin; the cost inputs re-run the burden — the grouping reflects that an outlier in markup is a pricing question, an outlier in the others is a cost question.

---

## 4. Reading a bill rate — calculation transparency

The **bill rate is the anchor** of each row; margin % sits beside it as a derived read-out. The burden subtotal is shown inline (e.g. "burden £3.40").

**Expand a row → bill-rate waterfall drawer** (one row at a time, side panel — not inline), each line tier-tagged (`Pay` / `Engine` / `Agency`):

```
Pay rate                     £…        Pay     (from ③)
+ WTR 12.07% / 14.04%        £…        Engine  · statutory
+ Employer NI 15% > £96/wk   £…        Engine  · statutory
+ Pension (× pension %)      £…        Agency
+ Apprenticeship levy        £…        Engine  · supplier toggle
+ Sick pay                   £…        Agency
= Fully-burdened cost        £…
+ Markup                     £…        Agency
= BILL RATE                  £16.56    (margin 5.7%)
```

This completes what ③ deferred: the Pay Rate Configuration shows pay + the statutory-mandatory burden (WTR + NI); here the **supplier-specific** burden (pension, levy, sick) and the **markup** finish the bill rate. Each waterfall line names the input that produced it, so the user can jump from a bill rate to the parameter that drives it.

---

## 5. Editing — supplier data only

- **Editable:** markup (£/hr), pension % (numeric, 0 = none), hours/wk, sick pay (value + type: fixed £/hr · % of pay · none), levy inclusion (Y/N).
- **Read-only:** statutory burden rates, the pay rate (③), and the derived bill rate / margin %.
- **Live recompute:** editing any cost input re-runs the burden and previews the new bill rate on affected rows immediately; editing markup updates bill rate and margin %.
- **Bulk & reuse (first-class at scale):** **apply markup to all groups** for a supplier; apply a value **down a column across suppliers**; **clone a supplier's whole config** as the starting point for another.
- **Validation:**
  - **Missing markup → blocker** (row invalid; gates *Continue to agency rate cards*).
  - **Pension < 3% auto-enrolment minimum → compliance warning** (raise the % to re-run the burden).
  - **Outlier** (markup/pension/hours outside the peer band) → warning.
  - **Blank-vs-zero** confirmation on sick pay and levy.
- **Edited markers · reset-to-uploaded** (per row / supplier / all) · a **"my edits"** filter.
- **Staged** — nothing live until Activate. **Fully audited. Permissioned** (commercial markup and cost inputs may have different owners).

---

## 6. Scalability

- **Single virtualized table** (43 configs today, hundreds later) — no mandatory single-supplier scope.
- **Collapsible supplier groups** with counts and at-a-glance flags (e.g. "all pension < 3%", "levy off", "needs a markup").
- **Bill-rate waterfall in a drawer**, not inline.
- **Sparse data is normal:** a supplier not offering a position group is **neutral**, not an error. Only genuine issues (missing markup, sub-3% pension, outliers) are flagged.

---

## 7. States

| State | Behaviour |
|---|---|
| Loading | Render all configs; show grouping/filter/column controls + statutory banner. |
| Populated (default) | All configs, grouped + filtered, bill rate legible. |
| Editing / recompute | Edited cells marked; burden re-runs; bill rate + margin % recompute live. |
| Filtered-empty | "No configs match" with a clear-filters action. |
| Compliance / blocker | Pension-below-3% warnings; missing-markup blocker gates Continue. |
| Read-only user | Controls disabled; grouping/filtering/expand still available. |

---

## 8. Acceptance criteria (this step)

- [ ] Default view shows **all** supplier × position-group configs in one table — no mandatory single-supplier scope.
- [ ] **Group by** (top-right) offers Supplier / Position group / nested; filters include Missing markup, Pension < 3%, Outliers, Changed, Levy, Sick.
- [ ] **Column groups** Commercial / Cost inputs / All; markup separated from cost inputs.
- [ ] **Bill rate is the anchor**; margin % derived; expand opens the **tier-tagged bill-rate waterfall drawer** completing ③'s deferred burden.
- [ ] Editable: markup, pension %, hours, sick (value + type), levy (Y/N); **statutory burden, pay rate, bill rate/margin are read-only**.
- [ ] **Missing markup blocks** Continue; **pension < 3% warns**; outliers and blank-vs-zero handled; live recompute on edit.
- [ ] Bulk (apply markup to all / down a column) + **clone config**; edited markers + reset; edits staged and audited.
- [ ] Table is **virtualized**; supplier groups collapse; sparse absences are neutral.
- [ ] Statutory rates and pay rate are read-only inputs from elsewhere.

---

## 9. Out of scope (explicit)

The rate recipe/engine structure; the pay rate; statutory-rate values; the bill-rate cards (computed in ⑤); effective dating / go-live. Unchanged by this spec.

---

## 10. Cross-cutting impacts — areas this step affects (flagged, **not specified here**)

1. **Rate Engine / recipe — dependency/contract.** The editable fields (markup, pension %, hours, sick, levy inclusion) are exactly the **supplier-level inputs** the engine declares (value level = per supplier × position group); the statutory burden is the pack's locked rules. This step *renders* those — the engine's compiled schema must expose which inputs are supplier-owned and at what level.
2. **Pay Rate Configuration (③) — shared input.** The pay rate feeding the bill build here is owned by ③; the two must use the **same** pay value, and a pay-rate edit in ③ **cascades** to every bill rate here. The waterfall here is the continuation of ③'s.
3. **Rate Cards (⑤) — cascade.** The configured supplier parameters **produce** the bill rates shown/computed in ⑤; edits here recompute those cards. The waterfall shown here is the same one ⑤ uses.
4. **Activate (⑥) — re-validation.** Go-live compliance checks must include the **pension-below-3%** and **missing-markup** states; the published version captures the supplier config, and a bill-rate movement from an edit must be reflected in the impact assessment.
5. **Validate (②) — boundary.** Supplier parameters may arrive in the upload; Validate owns structural/mapping fixes, value edits live here. Edits after Validate may require re-validation.
6. **Audit & versioning.** Markup/cost-input edits and bulk/clone operations must be audit-logged; the staged version reflects them.
7. **Permissions.** Commercial (markup) and cost inputs may have **different owners** (commercial vs operations) — define edit rights per column group.
8. **Compliance source of truth.** The 3% auto-enrolment minimum, levy threshold, and parity rules surface here but are owned by the pack (see Rate Engine).
9. **Supersession.** §7.2 of the final build spec and the *Agency_Detail_Rate_Config_Spec.md* single-supplier model are superseded by this document for this step.
