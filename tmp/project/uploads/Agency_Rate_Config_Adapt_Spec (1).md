# Agency Rate Configuration (upload) — render the filled-in recipe

**Change:** adapt the implemented Agency Rate Configuration step (step 4 of upload) so that, by default, it shows the **full agency recipe** the Rate Engine compiles — the same columns as the downloadable template — **populated for every supplier**, **editable per row**, and re-viewable by dimension (group by supplier, job type, site…). Today it shows a per-supplier contract page that surfaces the recipe only as a small read-only footnote and edits one supplier at a time.
**Basis:** the implemented step (H & G Recruitment contract screen), the rate-engine template `bill.pdf` (Agency Rate Config sheet), and `Rate_Card.xlsm`.
**Status:** change spec for the upload flow's pricing config. Same shape as the pay-side spec.

---

## 1. Principle

The Rate Engine compiles the agency recipe into a template with a fixed column set (`bill.pdf`). The Agency Rate Configuration step should be **that same table, filled in** with the uploaded values across **all suppliers** — a flat per-line table you read, **edit in place**, and re-cut by dimension. Identical interaction to the pay step: one table, editable cells, group-by and filters. The recipe (statutory and derived columns) is read-only; the five agency variables are editable and staged until Activate.

Today the step is **per-supplier and input-centric**: one supplier at a time, the five inputs in two zones, a locked statutory block, a small per-group preview, and the recipe shown only as a 2-line "Rate-card lines · SOURCE" footnote. The filled recipe — all 117 lines, every burden → bill column, editable, by dimension — is not the default.

---

## 2. The gap — today's view vs the recipe

| Recipe column (`bill.pdf`) | In the UI today? |
|---|---|
| Supplier | the page is one supplier; named in the header |
| Site | only in the SOURCE footnote lines |
| Job type | as position-group rows + SOURCE lines |
| Weekly hours | yes — by-group input |
| Nominal net pay £ | preview + SOURCE (read-only) |
| **WTR £** | only in the SOURCE footnote |
| **Employer NI £** | only in the SOURCE footnote |
| Pension % | yes — by-group input |
| **Pension £** | only in the SOURCE footnote |
| Levy incl (Y/N) | yes — supplier-wide toggle |
| **Levy £** | only in the SOURCE footnote |
| Sick pay £ | yes — supplier-wide input |
| Direct cost £ | preview ("Pay cost") + SOURCE |
| Markup £ | yes — by-group input |
| Bill rate pre-VAT £ | preview (charge pre-VAT) + SOURCE |
| **VAT £** | preview only (implied) |
| Bill incl VAT £ | preview only |

The full burden build lives **only in the per-supplier SOURCE footnote**, and the whole step is **one supplier at a time**. There is no populated, all-suppliers, editable recipe table — the agency equivalent of the pay step's 79-rate default view.

---

## 3. The adaptation

**1 · Default view = the filled agency recipe, per line, editable.** Render the recipe's columns, populated, for **all suppliers** (every supplier × site × job type line). Derived and bill columns recompute live as inputs change — so the table *is* the preview. Manage width with a **column-group switch** (beside Group by):
- **Inputs & bill** *(default)* — Weekly hours · Nominal net pay · Pension % · Sick pay · Levy incl · Markup · Bill incl VAT. The five inputs and the resulting charge.
- **Burden build** — Nominal net pay → WTR → Employer NI → Pension £ → Levy £ → Sick → Direct cost → Markup → Bill pre-VAT → VAT → Bill incl VAT. The full charge build (today's SOURCE columns, promoted).
- Keys (Supplier · Site · Job type) stay pinned across both groups.

**2 · Input vs derived treatment** (mirror the template): editable inputs (blue) = Weekly hours, Pension %, Sick pay, Levy incl, Markup; **read-only** = Nominal net pay (linked from Pay Rate Configuration — green); derived/locked = WTR, Employer NI, Pension £, Levy £, Direct cost, Bill pre-VAT, VAT, Bill incl VAT. Locked statutory values shown as a reference so the build reads in full.

**3 · Editing is per row, but inputs are scoped — the one difference from pay.** Every input cell is editable in place. Unlike a pay rate, an agency input has a **natural scope**: markup, pension % and weekly hours are per **supplier × position group**; sick and levy are per **supplier**. Editing a cell **propagates to its scope** (e.g. changing Best Connection's Transport markup updates all its Transport lines), with the scope shown on edit ("applies to Best Connection · Transport — 2 lines"). For the rare line that genuinely differs (e.g. Extrastaff hours at Warrington, levy at NRC), a **per-line override** breaks propagation for that line and is flagged. No separate editing drawer is required.

**4 · Group-by and filters are the dimensions.** Group by is a switch with **Supplier as the default example** — and Job type, Site, Position group, or Parity as the others; grouping by Supplier gives the per-contract cut for free. Filter on all of them. Render only the rows a supplier serves; flag **NRC** lines (no Pay Rate Configuration source) as a pay-source gap rather than a blank net pay.

**5 · Build transparency stays.** The Nominal net pay → WTR → NI → pension → levy → sick → direct cost → markup → VAT → bill chain is the "Burden build" column group and/or the per-row expander; the locked statutory block is a reference.

**6 · Default = the filled per-line table, grouped by Supplier, editable, recipe read-only, edits staged until Activate.**

This default table also resolves several audit items directly: the charge is **site-aware** (the table is per site × job type, so per-site bills show natively), **all multi-site suppliers** are visible at once, **NRC** is flagged inline, and **coverage** falls out of which rows each supplier has.

---

## 4. Parity & position groups

Per the parity architecture, **parity is not a job type** — fold "Warehouse Parity" into a **parity flag** on the Warehouse rows. The five inputs are **parity-agnostic**, scoped per **position group** (Transport · Driver · Warehouse) and **shared** across Pre / Post; the Pre vs Post bill difference is **derived** (matched pay from Pay Rate Configuration + WTR 12.07% → 14.04%). So the table shows parity as a column/flag, input edits propagate within a position group across both parity states, and there are **no duplicate parity input rows**.

---

## 5. What the old contract page becomes

The per-supplier contract page collapses into this one table: the **bill columns are the preview**, the **lines are the SOURCE**, the **inputs are inline** (grouping by Supplier gives the by-contract view), and the **locked statutory block becomes a read-only reference**. The two-zone framing (by-group vs supplier-wide) is preserved as the **scope** of each input rather than as a separate layout. A focused single-supplier view can still be opened from a supplier group for isolated editing, but it is optional, not the default.

---

## 6. Acceptance criteria

- Default view shows the agency recipe columns (Inputs & bill group) populated for all 117 lines, grouped by Supplier, with editable input cells.
- Editing a scoped input (markup / pension % / hours) updates all lines in that supplier × position group; sick / levy updates all the supplier's lines; the scope is shown on edit.
- A per-line override is possible for genuinely non-uniform lines and is flagged.
- Switching to "Burden build" shows the full Nominal net pay → … → Bill incl VAT chain per line; bill columns recompute live as inputs change.
- Group by offers Supplier · Job type · Site · Position group · Parity; per-site bills are visible for multi-site suppliers without leaving the table.
- NRC lines are flagged as a pay-source gap; only the rows a supplier serves are shown.
- Parity appears as a flag, not a separate "Warehouse Parity" job type; no duplicate parity input rows.
- Recipe columns are read-only; the five agency inputs are editable; edits stage until Activate.

---

*Parallel: this mirrors `Pay_Rate_Config_Adapt_Spec.md` (the pay step edits per-row inline; this edits per-row with scoped propagation). Supplier-coverage edge cases are detailed in `Agency_Config_Audit_Spec.md`.*
