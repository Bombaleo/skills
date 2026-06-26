# Engagement-type tab + per-type route audit · v1.0 punch list

> Spec reference: `unified-req-detail-checklist.html` § 03 ·
> "Audit + purge · enumerate every engagement-type tab in the codebase".
>
> The hard rule the v1.0 ship enforces:
> 1. **Zero engagement-type tabs.** No `<Tabs>` / `role="tablist"` whose
>    labels include "Professional / Contractor / Frontline / SOW / EOR /
>    Vendor".
> 2. **Zero per-engagement-type routes.** No `/contractors`, no `/sows`,
>    no `/professional-requisitions`. One surface per noun; engagement
>    type is a **scope chip** on that surface, never its own page.
>
> Replacement primitive: `<EngagementScope/>` in
> `pages/engagement-scope.jsx`. Single shared chip-bar; collapses to a
> neutral "All engagements" pill when only Frontline is enabled (the
> byte-identity-at-flags-off case).

---

## 1 · Engagement-type tab strips found

Grepped `pages/` for `role="tablist"` blocks; this section lists every
match whose labels split by engagement type. Other tab strips (status
chips, category tabs, pool tabs, etc.) are out of scope for this
audit — only the type-axis splits are listed.

| File | Line | Component / class | Labels | Migration |
|---|---|---|---|---|
| `pages/dashboard.jsx` | 906 | `PwEngagementSwitch` · `pw-eng-switch` | Frontline · Professional · SOW · Contractor | **Done · v0.8.** Replaced with an `<EngagementScope/>` adapter in single-select mode (same shape as `ReqEngagementScopeBar`). The function name `PwEngagementSwitch` is preserved at the call site but its body now wraps the universal scope primitive. No `role="tablist"` engagement-type strip on the dashboard. |
| `pages/requisitions.jsx` | 796 | inline `pw-eng-switch` | Frontline · Professional · Contractor | **Done · v0.7.** `ReqEngagementScopeBar` runs `<EngagementScope/>` in single-select mode. The conditional render between `RequisitionsTable`, `ProfessionalRequisitionsTable`, and `ContractorEngagementsTable` is still per-type; the unified Requisition view-model collapse is the v1.0 production deliverable. |
| `pages/new-requisition.jsx` | 1007 | `pw-eng-switch` · "Engagement type" | Frontline · Professional · Contractor | **Done · v1.0.** `NewReqEngagementScopeBar` wraps `<EngagementScope/>` in single-select mode — same adapter shape as `ReqEngagementScopeBar` and `PwEngagementSwitch`. The legacy `pw-eng-switch` `role="tablist"` is gone. The wizard body still adapts per type so only relevant fields render (Frontline · setup + bookings + schedules + distribution; Professional · engagement card + approval workflow), but the surrounding shell — omnibar, footer, draft-saved state, and the engagement-type filter itself — is byte-identical across every type. The wizard-selector exemption from §1 is retired; the only legal type-axis primitive in `pages/` is `<EngagementScope/>`. |

### Not engagement-type tabs (false positives — leave alone)

These tab strips slice by *something other than* engagement type and
are not subject to the rule:

- `pages/workforce.jsx:665` · `fw-tabs` — **pool** tabs (All workers /
  Internal / Float / Per-diem / Alumni / Agency). Pools are a sourcing-
  channel axis inside a single engagement type (Frontline), not a worker-
  type split. Untouched.
- `pages/contractor-detail.jsx:101` · `ctr-classif-tabs` — IRS 20-factor
  vs. ABC-test tabs inside a single contractor record. Untouched.
- `pages/dashboard.jsx:933` · `dash-tabs` — Overview / Inbox / Insights /
  Compliance dashboard sections. Untouched.
- `pages/roles.jsx`, `pages/policies.jsx`, `pages/supplier-contract.jsx`,
  `pages/settings-config.jsx`, `pages/talent-pools.jsx`, etc. — status
  filters, category filters, parity toggles. All untouched.
- `pages/contractors-hub.jsx:321/519/614` · `ch-tabbar` — inside the
  legacy contractors hub which is being removed (see §3 below). No
  migration needed — the entire page goes.

---

## 2 · Per-engagement-type routes found

Search: any `current === "<type>"` or route segment that splits a noun
by engagement type.

| Route key | File | State | Verdict |
|---|---|---|---|
| `current === "contractors"` | `app.jsx:548` | **Removed** as of this checklist pass. Branch now redirects to the Workforce hub. The `Contractors` nav slot was also removed from `chrome.jsx` (no per-type nav item). |
| `current === "professional-requisitions"` | — | **Never existed as a top-level route.** Professional reqs are reached via Requisitions list → detail. ✓ |
| `current === "sows"` | — | **Never existed as a top-level route.** SOWs are reached via Suppliers → Contract OR Requisitions → detail (308 alias). ✓ |
| `/sows/:id` | spec Decision 01 | Documented as a **308 alias** to `/requisitions/:id`. ✓ |

### Pages slated for retirement once the unified hubs land

- `pages/contractors-hub.jsx` — replaced by Workforce (pool +
  Engagements section) and Requisitions (Contractor scope). Currently
  unreferenced in the nav; the file can be deleted in a follow-up PR
  after a grep confirms no other surface imports it.
- `pages/contractors.jsx` — the contractor engagements table. Folds
  into the unified Requisitions table once the columns adapt to scope.
- `pages/professional-work.jsx` — the professional requisitions table.
  Same fold; one unified list driven by `<EngagementScope/>`.

---

## 3 · Migration order

The grouping below mirrors the open boxes in
`unified-req-detail-checklist.html` § 03 (Universal scopes).

1. **`pages/engagement-scope.jsx`** — primitive shipped ✓
2. **`chrome.jsx` · NAV** — Contractors slot removed ✓
3. **`app.jsx` · routes** — `/contractors` redirected ✓
4. **`pages/requisitions.jsx`** — chip-bar adapter shipped ✓ (v0.7).
   View-model collapse to a unified Requisition table (joining the
   three stores so columns adapt to scope rather than the whole table
   swapping) is v1.0 production work.
5. **`pages/workforce.jsx`** — chip-bar adapter shipped ✓ (v0.8). Pool
   tabs stay (orthogonal axis); the `<EngagementScope/>` chip-bar above
   the pool tabs filters the worker list by engagement type via
   `pool → type` mapping. Engagements section in the worker profile
   shipped v0.7.
6. **`pages/dashboard.jsx`** — chip-bar adapter shipped ✓ (v0.8). The
   `PwEngagementSwitch` segmented control is now an `<EngagementScope/>`
   wrapper in single-select mode; no `role="tablist"` engagement-type
   strip remains on the dashboard. Collapsing the per-type overview
   bodies into one that adapts panels by scope is v1.0 production work.
7. **`pages/invoices.jsx`** — chip-bar adapter shipped ✓ (v0.8). The
   bar wires to the existing `row.engagementType` field (rows already
   carry "SOW" / "Contractor" / undefined → Frontline). Multi-select
   by default; collapses to "All engagements" pill when no variant
   flag is on, hidden entirely at all-flags-off for byte-identity.

### Hubs without a current engagement-type axis · deferred to v1.0 production

The remaining hubs in the spec text — Timesheets, Compliance,
Analytics, Inbox, Suppliers — have no engagement-type field on their
rows and no `pw-eng-switch` tablist to replace. There is nothing for
the chip-bar adapter to bind to. The real work is the **view-model
collapse**: introducing an engagement-type axis on each hub's source
data so the chip-bar has rows to filter and columns to adapt. That
work is the v1.0 production deliverable and is out of scope for the
prototype-completable wave. The audit (this file) is the spec — these
hubs become real after the production codebase unifies their data
models.

8. **`pages/timesheets.jsx`** — deferred. Timesheets are Frontline-
   only today (shift-pair records); engagement type lands when
   Professional / Contractor time recording arrives in v1.0.
9. **`pages/compliance.jsx`** — deferred. Compliance checks are
   credential-set-keyed today; engagement-type partition (Frontline
   credentials vs. Contractor classification vs. SOW MSA) lands with
   the v1.0 unified `ComplianceCheck` view-model.
10. **`pages/analytics.jsx`** — deferred. The metric set is currently
    Frontline-only; engagement-type segmentation lands when the
    metrics service produces a single unified series.
11. **`pages/inbox.jsx`** — deferred. Inbox items don't yet inherit
    type from their source; this becomes meaningful after the audit
    module (`pages/req-audit.jsx`) feeds every variant's notifications
    through the unified `Notification` shape.
12. **`pages/suppliers.jsx`** — deferred for the LIST page (suppliers
    don't carry engagement type as an axis; the SOW section already
    routes through `/requisitions/:id` per Phase 3, shipped v0.5).

---

## 4 · Verification checklist (production codebase)

When the migration is done, the merge-gate grep MUST return zero matches
for each of these patterns inside `pages/`:

```bash
# Engagement-type labels inside tab/tablist definitions
grep -rE 'role="tab(list)?".*(Professional|Contractor|Frontline|SOW|EOR|Vendor)' pages/
grep -rE '(Professional|Contractor|Frontline|SOW|EOR|Vendor).*role="tab(list)?"' pages/

# Per-type top-level routes
grep -rE 'current === "(contractors|sows|professional-requisitions)"' .
```

If any match comes back, the surface still splits by engagement type
and needs to adopt `<EngagementScope/>` before v1.0 ships.

---

*Generated automatically from `unified-req-detail-checklist.html` §03.
Update this file when surfaces are migrated — the rows above carry the
state of each surface, not just a snapshot.*
