# Agency Rate Configuration — lead with the template mirror, then dimensions

**Change:** the step should **open as a faithful mirror of the uploaded agency template** — flat, all template columns in template order, no grouping, no filters — and treat group / filter / sort / column-focus as opt-in transforms applied from that baseline. Today it opens **already grouped by Supplier and showing only the "Inputs & bill" column group**, so it reads as a pre-sliced view rather than "your agency template, filled in."
**Basis:** the updated step (screenshot), the template `bill.pdf`, and `Agency_Rate_Config_Adapt_Spec.md` (which this refines). Mirrors `Pay_Rate_Config_Template_View_Spec.md` on the bill side.
**Status:** change spec for the upload flow's pricing config.

---

## 1. Principle

The first thing the user sees should be **recognition**: the agency template they filled, now populated — same columns, same order, one flat list across all suppliers. That confirms nothing was lost or rearranged on upload. **Dimensions are analysis tools layered on top**, not the entry state: the user groups by supplier, filters, sorts and narrows columns *after* seeing the whole recipe as-is.

The order is: **mirror the template → then slice it.** Today it slices first.

---

## 2. The gap — current default vs the template mirror

| | Current default | Template mirror (wanted) |
|---|---|---|
| Grouping | Grouped by **Supplier** | **None** — flat list |
| Columns | One group (**Inputs & bill**) — burden columns hidden | **All template columns** shown |
| Column order | Group order | **Template order** (as `bill.pdf`) |
| Row order | Within supplier groups | **Template row order** (as uploaded) |
| Filters | none active, but framed by supplier | none — neutral |
| Sort | not available | available, default = template order |

The current default is already a transformed, by-supplier cut showing only the five inputs and the bill — it skips the "here is your agency template" moment and hides the full burden build (WTR, NI, Pension £, Levy £, Direct cost, VAT).

---

## 3. The update

**1 · Open in template-mirror mode.** Default state: **Group by = None** (flat list), no quick filters active, rows in the **template's row order**, columns in the **template's column order**. The header reads e.g. "117 lines · template view" when neutral, switching to "… · grouped by supplier · filtered" once transformed.

**2 · Show all template columns by default.** Add an **"All columns"** option to the Columns control and make it the default — Supplier · Site · Job type · Weekly hours · Nominal net pay · WTR · Employer NI · Pension % · Pension £ · Levy incl · Levy £ · Sick pay · Direct cost · Markup · Bill pre-VAT · VAT · Bill incl VAT. Horizontal scroll for width (it is a spreadsheet mirror); keys pinned on the left (Supplier · Site · Job type). **"Inputs & bill"** and **"Burden build"** remain as optional **focus modes** — ways to narrow — not the entry state.

**3 · Group / filter / sort are opt-in transforms from the mirror.**
- **Group by** (Supplier · Job type · Site · Position group · Parity) — default **None**.
- **Filters** (Site / Job type / Position / Parity, and My edits / Overrides / Levy off / Pension <3% / Pay-source gap) — default **none**.
- **Sort** — *new*: click any column header to sort (asc / desc) with a clear indicator; default is template order; when grouped, sort applies within groups.

**4 · Two distinct resets — keep both, label clearly.**
- **Reset all to uploaded** *(already present)* — discards staged **edits** and restores the **uploaded values**.
- **Reset to template view** *(new)* — restores the neutral **view**: flat, all columns, unsorted, ungrouped, unfiltered. Affects layout only, not values.

**5 · Everything else stays** exactly as built: per-row editing with **scoped propagation** and **unlink-to-override**, the Editable / From pay / Derived treatment, the **NRC pay-source-gap** flag and banner, the **pension < 3%** banner, net pay read-only from Pay Rate Configuration, statutory rates read-only, the recipe read-only chip, and edit / stage until Activate.

---

## 4. Why a mirror first (not grouped)

Grouping by Supplier is the most useful *analysis* — but it presumes the user wants to read the recipe contract-by-contract before they have confirmed it matches their file. Leading with the unaltered template lets them (a) verify the upload landed correctly across all 117 lines, (b) see the full burden → bill build in one place, then (c) reach for Group by / filters / sort / focus to investigate. It also makes the step consistent with how a spreadsheet user expects their file to appear: as their file.

---

## 5. Acceptance criteria

- On entry, the table is **flat (ungrouped), unfiltered, unsorted**, showing **all template columns in template order** and rows in template order; the status line says "template view".
- The Columns control offers **All columns (default)** · Inputs & bill · Burden build.
- Changing Group by, applying a filter, sorting a column, or switching to a focus mode transforms the view; the status line reflects the active state.
- **Reset to template view** restores the flat all-columns mirror in one click; **Reset all to uploaded** restores uploaded values — the two are distinct.
- Column-header **sort** works (asc / desc; within groups when grouped).
- Per-row scoped editing, unlink-to-override, input / from-pay / derived treatment, the NRC and pension banners, recipe read-only, and edit / stage are unchanged.

---

*Companion: this matches `Pay_Rate_Config_Template_View_Spec.md`. Both steps now open as the flat filled recipe in template order and make grouping, filtering and sorting opt-in.*
