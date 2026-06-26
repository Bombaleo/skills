# Pay Rate Configuration — lead with the template mirror, then dimensions

**Change:** the step should **open as a faithful mirror of the uploaded template** — flat, all template columns in template order, no grouping, no filters — and treat group / filter / sort / column-focus as opt-in transforms applied from that baseline. Today it opens **already grouped by Site and showing only the "Rate build" column group**, so it reads as a pre-sliced view rather than "your template, filled in."
**Basis:** the updated step (screenshot), the template `pay.pdf`, and `Pay_Rate_Config_Adapt_Spec.md` (which this refines).
**Status:** change spec for the upload flow's pricing config.

---

## 1. Principle

The first thing the user sees should be **recognition**: the template they downloaded and filled, now populated — same columns, same order, one flat list. That builds trust that nothing was lost or rearranged on upload. **Dimensions are analysis tools layered on top**, not the entry state: the user groups, filters, sorts and narrows columns *after* they've seen the whole thing as-is.

The order is: **mirror the template → then slice it.** Today it slices first.

---

## 2. The gap — current default vs the template mirror

| | Current default | Template mirror (wanted) |
|---|---|---|
| Grouping | Grouped by **Site** | **None** — flat list |
| Columns | One group (**Rate build**) — day-type columns hidden | **All template columns** shown |
| Column order | Group order | **Template order** (as `pay.pdf`) |
| Row order | Within site groups | **Template row order** (as uploaded) |
| Filters | none, but framed analytically | none — neutral |
| Sort | not available | available, default = template order |

The current default is already a transformed, analytical cut. It skips the "here is your template" moment.

---

## 3. The update

**1 · Open in template-mirror mode.** Default state: **Group by = None** (flat list), no quick filters active, rows in the **template's row order**, columns in the **template's column order**. The header line reads e.g. "79 rates · template view" when neutral, switching to "… · grouped by site · filtered" once the user transforms it.

**2 · Show all template columns by default.** Add an **"All columns"** option to the COLUMNS control and make it the default — Site · Tier · Job type · Role · Parity · Weekly hours · Hourly rate · Hourly geo · Basic + geo · NMW floor · Standard · Friday · Saturday · Sunday · Overtime. Horizontal scroll for width (it is a spreadsheet mirror); keys pinned on the left. **"Net pay by day-type"** and **"Rate build"** remain as optional **focus modes** — ways to narrow to a subset — not the entry state.

**3 · Group / filter / sort are opt-in transforms from the mirror.**
- **Group by** (Site · Job type · Role · Parity · Tier) — default **None**.
- **Filters** (Tier / Site / Job type / Parity, and Floored / Data gaps / Has overtime / My edits) — default **none**.
- **Sort** — *new*: click any column header to sort (asc / desc), with a clear sort indicator; default is template order. When grouped, sort applies within groups.

**4 · "Reset to template view."** One control returns the table to the flat, all-columns, unsorted, ungrouped, unfiltered mirror — so the user can always get back to the as-uploaded baseline.

**5 · Everything else stays** exactly as built: the input vs derived treatment (Hourly rate / Hourly geo / Weekly hours / day-type net pays editable; Basic + geo / NMW floor / floored Standard derived), the floored / clears badges, the base-vs-direct duality ("— · direct"), the recipe read-only chip, edit / stage, and the Editing pay toggle.

---

## 4. Why a mirror first (not grouped)

Grouping by Site is a useful *analysis*, but it presumes the user wants to read the data site-by-site before they've even confirmed it matches their file. Leading with the unaltered template lets them (a) verify the upload landed correctly, (b) see the full shape — all day-type columns included — in one place, then (c) reach for Group by / filters / sort / focus to investigate. It also makes the step consistent with how a spreadsheet user expects their file to appear: as their file.

---

## 5. Acceptance criteria

- On entry, the table is **flat (ungrouped), unfiltered, unsorted**, showing **all template columns in template order** and rows in template order; the status line says "template view."
- The COLUMNS control offers **All columns (default)** · Net pay by day-type · Rate build.
- Changing Group by, applying a filter, sorting a column, or switching to a focus mode transforms the view; the status line reflects the active state.
- **Reset to template view** restores the flat all-columns mirror in one click.
- Column-header **sort** works (asc / desc; within groups when grouped).
- Input / derived treatment, floor and clears markers, base-vs-direct, recipe read-only, and edit / stage are unchanged.

---

*Companion change for the bill side: the same "mirror first, then dimensions" default should apply to `Agency_Rate_Config_Adapt_Spec.md` — open as the flat agency recipe (all columns, all suppliers, template order), with group / filter / sort opt-in.*
