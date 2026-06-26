# Rate Model · Pay Rate Engine — Step Specification (revision)

**Step:** Upload flow → step ③ Rate model → **3.1 Pay rate engine**
**Scope:** This document changes **only** the Pay rate engine step. It does **not** modify Validate (②), Agency rate configuration (3.2), Agency rate cards (④), or Activate (⑤). Areas those changes *affect* are flagged in §10 for their owners — but their specs are not edited here.
**Supersedes:** §7.1 of *Rate_Card_Upload_Build_Spec_FINAL.md* (Pay rate engine only).
**Design system:** follows the shared conventions in that spec's §1 (stepper, severity language, tier chips, cell treatments, expandable rows, badges). Not repeated here.
**Status:** Draft for design + engineering.

---

## 1. Purpose

After upload, this step is where the user **sees, understands, and edits the client's pay rates** — for the selected client (e.g. Evri), rendered through that client's **rate recipe** (which is configured in a separate step and is read-only here). It is the shared, statutory pay foundation that every supplier's bill rate is later built on.

The step must do three things: show *all* the client's pay rates in one place, make *how each rate is calculated* legible, and let the user *edit the pay data* — at a scale of tens to thousands of rates.

---

## 2. Scope boundary

| In scope (this step) | Out of scope (owned elsewhere) |
|---|---|
| Display all uploaded pay rates for the client | Configuring the rate recipe (separate step — read-only input here) |
| Group / filter the rates | Supplier markup & cost params (3.2 Agency rate configuration) |
| Edit pay **data** (rate values) | Computing/showing final bill rates (④ Agency rate cards) |
| Show the build (how a rate is calculated) | Changing statutory rates / burden formulas (engine admin) |
| Surface data gaps | Effective date / go-live (⑤ Activate) |

The **recipe is a read-only input**: it defines the dimensions, day-types and their derivation, the floor rule, and the burden components. This view *renders* whatever the recipe specifies — it does not let the user change it.

---

## 3. Default view — one table, grouped and filtered

The first thing the user sees is **every pay rate for the client in a single table** — no mandatory site (or other) scope first.

**Layout**
```
Pay rate engine · [Evri]                                    recipe read-only 🔒
┌ search roles… ─┐  Tier:National▾  Site:all▾  Job type:all▾  Parity:all▾
Quick: [Floored] [Data gaps] [Has OT]                 Group by ▸ [ Site ▾ ]
79 rates · grouped by site · filtered: floored
┌──────────────────────────────────────────────────────────────────────┐
│ Role            Job type    Parity   Base      Pay rate            ⌄  │
│ ▾ Barnsley · 4 floored of 24                                          │
│   Warehouse Op AM   Warehouse  Pre   [9.85]    £12.21  floor       ⌄  │
│ ▾ Nuneaton · 4 floored of 6                                           │
│   Warehouse Op PM   Warehouse  Pre   [11.50]   £12.21  floor       ⌄  │
│ ▸ Rugby · 3 of 23     ▸ Warrington · 3 of 22     ▸ Wednesbury · 2/4   │
└──────────────────────────────────────────────────────────────────────┘
```

**Group by (top-right control).** Re-cuts the same rows by any rate-keying dimension, single or nested:
- **Region tier** (National / London) · **Site** · **Job type / role group** · **Parity**.
- e.g. group by job type to compare one role across sites; by tier to separate National/London.

**Filters (bar, top-left).** Slice the set to understand it:
- Dimension filters: Tier · Site · Job type · Parity.
- Derived/quick filters: **Floored only · Data gaps · Has overtime · Single- vs multi-site · Changed vs current**.

The standalone "coverage overview" is **not** a separate screen — its insights are reached here: floored rates → the `Floored` filter; cross-site inconsistency → group by role; coverage → group by site with counts.

---

## 4. Reading a rate — calculation transparency

**In-table**, the build is legible left-to-right: `Base hourly → NMW floor → Pay rate`.

- **Base-vs-direct duality.** Some roles carry a **base hourly rate** that floors up (e.g. Warehouse Operative AM £9.85 → £12.21); others have the **pay rate entered directly** with no base (Induction, HGV, Van). Show an editable base where one exists, and "set directly" where it doesn't.
- **NMW floor made explicit.** Where the base is below the floor, show it being lifted (a `floor` marker), so a floored £12.21 is distinguishable from a rate that genuinely clears the floor. The floor is age-banded per the recipe.
- **Correct day-type model.** Day-types come from the recipe — for Evri: **Standard · Friday · Saturday · Sunday · Overtime**. "Night" is a separate *role*, "bank holiday" is a *premium* — not standard day-type columns. Show **truthful blanks** ("—") where the source has no value (e.g. no OT rate); never synthesize multiplier-derived values.

**Expand a row → build drawer** (one row at a time, opened in a side panel — *not* inline expansion, so the table never reflows). The drawer shows the full level-by-level build, each line tier-tagged (`Pay` / `Engine`):

```
Base hourly rate            £9.85       Pay
+ Geo allowance · location  £0.00       Pay
= Basic + Geo               £9.85       (derived)
NMW floor £12.21            applied +£2.36   Engine · statutory
= Pay rate · standard       £12.21
Day-types  Fri 12.21 · Sat 12.21 · Sun 12.21 · OT —
Parity     Pre  (Post +£…)
── statutory burden · indicative @ 37.5h ──
+ WTR 12.07%                £…          Engine
+ Employer NI 15% > £96/wk  £…          Engine
= statutory-burdened pay    £…    (pension/levy/sick are supplier-specific → step 4)
```

The burden shown here is the **statutory-mandatory** part only (WTR + Employer NI); pension, levy and sick are supplier-specific and complete the picture in step 4 — flagged, not computed here.

---

## 5. Editing — data only

The user edits **pay data**, never the recipe or derived/statutory values.

- **Editable:** input cells defined by the recipe — base hourly rate, geo, day-type rates, premiums.
- **Read-only:** derived values (Basic + Geo, the floored result, the burden), statutory rates, and the recipe itself.
- **NMW floor enforced live:** an edit cannot set a rate below the age-band floor.
- **Bulk edit (first-class at scale):** select rows / columns / groups and apply a flat uplift (+£0.20), a % uplift (+4%), set-to-value, or a relational rule (e.g. *London = National × 1.08*). Cell-by-cell is the exception, not the norm.
- **Live recompute:** an edit updates the pay rate immediately (and downstream bill rates — see §10).
- **Edited markers · reset-to-uploaded** (per row / group / all) · a **"my edits"** filter.
- **Staged** — nothing reaches live rates until Activate (⑤). **Fully audited.**
- **Permissioned** — edits here cascade to every supplier's bill rate, so editing is a controlled action.

---

## 6. Scalability

- **Single virtualized table** (windowed rendering) — 79 rates today, thousands later, without a mandatory pre-scope.
- **Collapsible group headers** with counts; **filters** shrink the working set.
- **Build opens in a drawer**, not inline, so the table never jumps.
- **Sparse data is normal:** a role absent at a site is **neutral** (the role isn't run there), not an error. Only genuine issues (e.g. hours not set, below floor) are flagged.

---

## 7. States

| State | Behaviour |
|---|---|
| Loading | Render the client's rates; show grouping/filter controls. |
| Populated (default) | All rates, grouped + filtered, build legible. |
| Editing / recompute | Edited cells marked; pay rate (and downstream) recompute live. |
| Filtered-empty | "No rates match" with a clear-filters action. |
| Data gap | Flag rows/groups missing a required input (e.g. Van Driver hours not set). |
| Read-only user | Controls disabled; grouping/filtering/expand still available. |

---

## 8. Acceptance criteria (this step)

- [ ] Default view shows **all** the client's pay rates in one table — no mandatory scope.
- [ ] **Group by** (top-right) offers Tier / Site / Job type / Parity, single and nested; filters include the dimension set plus Floored / Data gaps / Has OT / Changed.
- [ ] In-table build is legible (base → floor → pay); base-vs-direct handled; expand opens a **tier-tagged build drawer**.
- [ ] Day-types are **Standard / Friday / Saturday / Sunday / Overtime** with truthful blanks; **no synthesized values**.
- [ ] Pay **data** is editable (input cells); **NMW floor enforced live**; derived/statutory/recipe are read-only.
- [ ] **Bulk edit** supported; edited markers + reset-to-uploaded; edits staged and audited.
- [ ] Table is **virtualized**; groups collapse; sparse absences are neutral (not errors).
- [ ] The **recipe is a read-only input** and the view renders the client's configured shape (dimensions, day-types, floor, burden).

---

## 9. Out of scope (explicit)

Recipe authoring/configuration; supplier markup & params; bill-rate computation/display; statutory-rate changes; effective dating / go-live. These belong to other steps and are unchanged by this spec.

---

## 10. Cross-cutting impacts — areas this step affects (flagged, **not specified here**)

Although the change is scoped to step 3.1, it has downstream consequences. Each below is for its owner to action in the relevant spec:

1. **Rate recipe configuration step (separate build) — dependency/contract.** This step *renders* the recipe, so the recipe step must expose, machine-readably: the rate-keying **dimensions**, the **day-type set + derivation** (entered vs multiplier), the **floor rule** (age-banded NMW for UK), and the **burden components**. Editing here is data-only; the recipe is its read-only input.

2. **Validate step (②) — boundary shift.** Pay rates are now editable in 3.1, so Validate owns **structural/mapping** fixes only, not pay-value correction. The earlier "corrections to pay go via re-upload only" stance is **dropped**. Edits made in 3.1 after Validate may require **re-validating** affected rates.

3. **Agency rate cards (④) / bill rates — cascade.** A pay-rate edit here changes the foundation of **every supplier bill rate** that uses it → those bill rates must **recompute**. The corrected day-type model (Std/Fri/Sat/Sun/OT, truthful blanks) also affects how bill-rate day-types are displayed in ④.

4. **Activate (⑤) — re-validation at commit.** Activate's compliance/floor re-validation and impact assessment must include **edited** pay rates; the published version must capture the edited pay data and a **rate decrease** caused by an edit must still be caught against NMW/parity.

5. **Audit & versioning — coverage.** Pay-rate edits and bulk operations must be **audit-logged**, and the staged version must reflect them. (Audit exists; its scope now includes 3.1 edits.)

6. **Simulator (within ④) — consistency.** The simulator resolves a pay rate using the same **base-vs-direct + NMW-floor** logic shown here; keep them aligned.

7. **Permissions — new controlled action.** Editing pay (which cascades to all suppliers) needs a defined permission; specify who can edit vs view.

8. **Final build spec — supersession.** §4 (target data model) and §7.1 (Pay rate engine) of *Rate_Card_Upload_Build_Spec_FINAL.md* are now **superseded by this document** for the Pay rate engine; update its references and re-issue when convenient. No other section of that spec changes.
