# Pay Rate Configuration (upload) — render the filled-in recipe

**Change:** adapt the implemented Pay Rate Configuration step (step 3 of upload) so that, by default, it shows the **full pay recipe** the Rate Engine compiles — the same columns as the downloadable template — **populated with the uploaded values**, viewable by dimension. Today it shows a reduced base → pay-rate view that drops most recipe columns.
**Basis:** the implemented step (screenshot), the rate-engine template `pay.pdf` (Pay Rates sheet), and `Rate_Card.xlsm`.
**Status:** change spec for the upload flow's pricing config.

---

## 1. Principle

The Rate Engine compiles the pay recipe into a template with a fixed column set (`pay.pdf`). The Pay Rate Configuration step should be **that same table, filled in** with the uploaded values — and re-viewable by dimension (group / filter / column-group). The recipe (the columns) is read-only; the values are editable and staged until Activate.

Today the step shows only **Role · Job type · Parity · Base hourly · Pay rate** — the *build* (base → floor) for a single pay value. It drops most of the recipe, most importantly the **day-type net pays**.

---

## 2. The gap — today's view vs the recipe

| Recipe column (`pay.pdf`) | In the UI today? |
|---|---|
| Site | group header only |
| Tier | no |
| Job type | yes |
| Role / job title | yes |
| Parity | yes |
| Weekly hours | no |
| Hourly rate | yes — "Base hourly" |
| Hourly geo | no |
| Basic + geo | folded into the "+£" badge |
| NMW floor | implied by the "floor" badge |
| Standard net pay | yes — the single "Pay rate" |
| **Friday** | **no** |
| **Saturday** | **no** |
| **Sunday** | **no** |
| **Overtime** | **no** |

The single "Pay rate" column is **Standard only**, so it hides the day-type differentiation the recipe carries. Evidence from the workbook (Barnsley warehouse):

| Role (Pre) | Standard | Saturday / Sunday |
|---|---|---|
| Warehouse Operative AM | £12.21 | **£12.49** |
| Warehouse Operative PM | £12.32 | **£12.75** |
| Warehouse Operative Night | £12.57 | **£12.96** |

Weekend uplift exists in **49 of 79** rates — invisible in today's view. (Overtime is "n/a" across the book, so that column is present-but-empty, which is fine.)

---

## 3. The adaptation

**1 · Columns = the recipe, with column groups to manage width.** Render the recipe's columns, populated, and add a **column-group switch** (a control beside Group by):
- **Net pay by day-type** *(default)* — Standard · Friday · Saturday · Sunday · Overtime. The operative pay values — what "the pay rate" actually is per day.
- **Rate build** — Hourly rate · Hourly geo · Basic + geo · NMW floor · Standard. How each Standard rate is derived; **today's base → pay-rate view lives here**.
- Keys (Role · Job type · Parity) and Weekly hours stay pinned on the left across both groups.

**2 · Input vs derived treatment** (mirror the template): editable inputs = Hourly rate, Hourly geo, Weekly hours, and the day-type net pays entered directly; derived/locked = Basic + geo, NMW floor, and the floored Standard where a base drives it. Keep the floor badge ("+£2.36 → floor") on the derived Standard.

**3 · Base-vs-direct duality.** Some roles carry a base hourly that floors (warehouse AM/PM/Night); others (HGV, Van, Twilight) have **no base** and the net pay is entered directly. Show an editable base where present and "— · direct" where not, with the day-type cells as the editable inputs in the direct case. (`pay.pdf` shows HGV/Van/Twilight with no base.)

**4 · Dimensions = the recipe's real dimensions.** Align the key line and the group-by / filter to **Region tier · Site · Job type · Role · Parity**. Today's "keyed by Region tier · Site · Job type · Parity" line **omits Role** (the row identity) — add it, and add Role to Group by. **Day-type is a value-column axis, not a row key** — it is the column-group switch, never a filter that re-cuts rows.

**5 · Default = the filled table, grouped by Site**, recipe read-only, edits staged until Activate — exactly as today. Keep the quick filters (Floored · Data gaps · Has overtime · My edits), floor markers, data-gap counts and the Editing pay toggle. ("Has overtime" matches nothing in this book — correct, since OT is empty.)

**6 · Build transparency stays.** The base → + geo → basic + geo → NMW floor → pay chain is the "Rate build" column group and/or the per-row expander (the chevron drawer already on each row). Keep the "+£" uplift and "floor" badges.

---

## 4. Parity

Parity stays a **row dimension** on the pay side (Pre / Post matched pay) — the recipe keys on it and the matched pay genuinely differs (AM Pre base £9.85 vs AM Parity Post base £10.25). This is correct and unchanged; day-type stays a value-column axis. The recipe still labels parity rows via a "Warehouse Parity" job type in places — per the parity architecture that becomes a parity flag on the Warehouse job type; fold it when that lands, but it does not block this change.

---

## 5. Unchanged (validated)

Stepper, header, the recipe-read-only chip, the filter bar, Group by, floor markers, data-gap counts, edit / stage, the Editing pay toggle, and the per-row build expander all stay. This change is **columns + column groups + dimensions**, not a redesign.

---

## 6. Acceptance criteria

- Default view shows the recipe columns (day-type group) populated for all 79 rates, grouped by Site.
- Saturday / Sunday rates are visible and distinct from Standard for the 49 rates that carry a weekend uplift.
- Switching to "Rate build" reproduces today's base → + geo → basic + geo → floor → Standard view.
- Roles with no base render as "direct"; their day-type cells are the editable inputs.
- Group by / filter offer Region tier · Site · Job type · Role · Parity; day-type is a column-group switch, not a row filter.
- Recipe columns are read-only; value edits are staged until Activate.

---

*Parallel: the Agency Rate Configuration step (4) should follow the same principle — render the filled-in agency recipe (`bill.pdf` columns) viewable by dimension — per `Agency_Config_Audit_Spec.md`.*
