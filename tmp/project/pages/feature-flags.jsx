// =====================================================================
// Flex Work — Settings → Feature Flags
//   Tenant-level feature flags. A flag is a boolean (default off) that
//   gates a not-yet-GA capability on this tenant. State is persisted in
//   localStorage (`flexwork.featureFlags`) and broadcast on toggle via
//   a `featureflags:change` CustomEvent that consumers (e.g. DfAlignPill)
//   listen to so they can re-render in place.
//
//   Public API (window.*):
//     · getFeatureFlag(key, fallback=false) → boolean
//     · setFeatureFlag(key, value)           → void
//     · useFeatureFlag(key, fallback=false)  → boolean (React hook)
//
//   First-party flag catalog: FEATURE_FLAG_GROUPS — grouped by source
//   product ("Dayforce" today; room for others later).
// =====================================================================

const { useState: useFF, useEffect: useEFF, useCallback: useCFF, useMemo: useMFF } = React;

// ---------- Catalog ---------------------------------------------------
// Each flag: { id, label, summary, defaultOn?, tips?: [{label, body}] }
const FEATURE_FLAG_GROUPS = [
  // -------------------------------------------------------------------
  // GROUP — Engagement Type (top-level worker-engagement mode)
  //
  // The four "engagement types" are the named modes a buyer picks at
  // intake. Shift ships always-on (today's Frontline default — a
  // schedule-driven, clock-anchored agency shift). The other three are
  // additive feature flags. With every flag off, the new Engagement
  // Type picker on the requisition flow is hidden and the data tables
  // render byte-identical to the all-flags-off ship.
  //
  //   · Shift               — scheduled shift, clock in/out, agency
  //   · Assignment          — bench / contract worker on a date-range
  //                           assignment (timesheet or fixed fee)
  //   · Project             — fixed scope, supplier-led delivery, no
  //                           headcount commitment, billed against
  //                           project budget burn
  //   · Statement of Work   — MSA-anchored SOW: deliverables, milestone
  //                           acceptance, fee schedule, change orders
  //
  // The companion picker on the requisition flow lives behind these
  // flags, the Engagement Type column on the data tables uses the
  // `engtype-cols-on` body class (parallel to v77 cols), and every
  // surface continues to function with all flags off.
  // -------------------------------------------------------------------
  {
    // v0.78 \u2014 the Engagement Type axis moved out of Settings \u2192 Feature
    // Flags and into Settings \u2192 Configuration \u2192 Engagement types. The
    // group is kept here (hidden) so legacy storage migrations + the
    // axis-flag derivations below (`timesheets`, `milestones`,
    // `fixedFee`, `professionalWork`, `sow`, `contractors`, `v77Axes`)
    // continue to resolve label + default for the three IDs without a
    // separate registry. The Configuration UI calls setFeatureFlag()
    // directly so the storage layer and event plumbing stay shared.
    id: "engagementType",
    label: "Engagement Type",
    hidden: true,
    summary:
      "Top-level worker-engagement mode picked at intake. Shift (scheduled shift × clock-in/out × hourly) ships always-on — it cannot be turned off. Each of the three additional engagement types is a separate flag: Assignment (bench / contract worker on a date-range assignment), Project (supplier-led delivery against a project budget burn, no headcount commitment), and Statement of Work (MSA-anchored SOW with deliverables, milestone acceptance, and a fee schedule). Each engagement type carries its own Billing Basis (hourly · weekly · monthly · fixed · milestone) and Time Capture (clock-in/out · time tracking · N/A) options — surfaced on the Work Assignment Advanced panel and defaulted to the canonical pairing for that type. When any flag is on, the requisition flow surfaces an Engagement Type card right after Template / Import, and every data table gains an Engagement Type column + filter.",
    flags: [
      {
        id: "engAssignment",
        label: "Assignment",
        summary:
          "Adds Assignment as an Engagement Type. Use for a named worker placed on a date-range assignment — no recurring schedule, no clock punch. Billing Basis can be Hourly, Weekly, Monthly, or Fixed; Time Capture can be Clock-in/out, Time Tracking, or N/A. Defaults to Hourly + Time Tracking. Replaces today's Professional / Contractor on-bench cell as a first-class intake option.",
        defaultOn: false,
        tips: [
          {
            label: "What turns on",
            body:
              "A new Engagement Type card appears as the first card after Template / Import on the New Requisition flow with Shift / Assignment selectable (and Project / Statement of Work when their flags are on too). Every data table (Requisitions · Workforce · Timesheets · Invoices) gains an Engagement Type column and a matching filter chip. Existing rows derive their engagement type from sourcing channel (PRO- / CON- prefixes resolve to Assignment).",
          },
          {
            label: "Billing Basis × Time Capture",
            body:
              "Assignments unlock the widest billing surface: Hourly, Weekly, Monthly, or Fixed billing; Clock-in/out, Time Tracking, or N/A for time capture. The Work Assignment → Advanced panel defaults to Hourly + Time Tracking and lets the buyer change either independently. Hourly + Clock-in/out reproduces today's Shift cell on a single named worker; Fixed + N/A is a flat-rate retainer.",
          },
          {
            label: "Flag-off contract",
            body:
              "With every Engagement Type flag off, the Engagement Type card never renders on intake, the Engagement Type column is hidden on every list, and every existing surface is byte-identical to today.",
          },
        ],
      },
      {
        id: "engProject",
        label: "Project",
        summary:
          "Adds Project as an Engagement Type. A Project is a supplier-led delivery against a defined project budget — the supplier names the team, the buyer reviews progress against burn. Billing Basis can be Fixed or Milestone; Time Capture can be Time Tracking or N/A. Defaults to Fixed + Time Tracking. Sits between Assignment (one named worker) and Statement of Work (formal deliverable acceptance).",
        defaultOn: false,
        tips: [
          {
            label: "What turns on",
            body:
              "Project appears as a third option on the Engagement Type card on the New Requisition flow. Every data table picks up Project as a filter value and a per-row chip. Detail pages render a project-burn accordion (budget · committed · consumed · remaining) on rows tagged Project.",
          },
          {
            label: "When to pick Project vs SOW",
            body:
              "Project is informal — a supplier delivers against a budget with weekly burn reporting and the buyer accepts based on activity, not signed deliverables. Statement of Work is the contract-bound version: milestones, acceptance criteria, fee schedule, change orders. Use Project for small/medium engagements where the overhead of an SOW isn't justified.",
          },
          {
            label: "Flag-off contract",
            body:
              "With Project off, the picker only shows Shift (and Assignment / Statement of Work when those flags are on), and no row resolves to Project on the column.",
          },
        ],
      },
      {
        id: "engStatementOfWork",
        label: "Statement of Work",
        summary:
          "Adds Statement of Work (SOW) as an Engagement Type. An SOW is a contract with a supplier for a defined deliverable scope under an existing MSA — milestones with fees, acceptance criteria, payment triggers, change orders. Billing Basis is Milestone; Time Capture can be Time Tracking or N/A. Defaults to Milestone + N/A. The supplier names and manages the team; the buyer accepts each milestone, which fires the invoice.",
        defaultOn: false,
        tips: [
          {
            label: "What turns on",
            body:
              "Statement of Work appears as a fourth option on the Engagement Type card on the New Requisition flow. The data tables gain it as a filter value + row chip. The detail page composes the milestones / deliverables / burn-and-budget accordions whenever a row resolves to Statement of Work. Mirrors today's SOW capability — this flag is the explicit Engagement Type front door for it.",
          },
          {
            label: "Lifecycle",
            body:
              "Draft → In approval → Active → (On hold) → Completed → Closed. Supplier marks each milestone Submitted; buyer Accepts or Rejects with rework notes. Acceptance fires the invoice for that milestone (minus any retainage). Change orders ride alongside the SOW and amend the fee schedule on acceptance.",
          },
          {
            label: "Flag-off contract",
            body:
              "With Statement of Work off, the picker hides the option and no row resolves to it on the column. The underlying milestone / SOW machinery (gated by the legacy sow / milestones flags) is unaffected and continues to work as it has.",
          },
        ],
      },
    ],
  },
  {
    id: "dayforce",
    label: "Dayforce",
    hidden: true,
    summary:
      "Surfaces that show how Flex Work objects map onto Dayforce primitives — Org Setup, People, Position Management, Time & Attendance, Payroll · GL.",
    flags: [
      {
        id: "dataModelAlignment",
        label: "Data Model Alignment",
        summary:
          "Show the Dayforce alignment pill on every list-page header. The pill opens a popover with the primitive each Flex Work object maps to, the owning product, the migration strategy, and a deep link into the Flex Work Data Model doc.",
        defaultOn: false,
        excludes: ["vmsEducation"],
        tips: [
          {
            label: "What you see when on",
            body:
              "A small \u201cDayforce \u2192 OrgUnit\u201d-style pill next to every list page title (Requisitions, Workforce, Suppliers, Schedule, Timesheets, Invoices, Compliance, Organization, Settings). Click it for the full mapping detail.",
          },
          {
            label: "Coverage",
            body:
              "Requisitions \u2192 Position (Pooled) \u00b7 Workforce \u2192 Employee + workerType \u00b7 Schedule \u2192 WorkAssignment \u00b7 Timesheets \u2192 TimePair + BillingLine \u00b7 Invoices \u2192 SupplierInvoice (Flex Work-owned) \u00b7 Suppliers \u2192 Supplier (new) \u00b7 Compliance \u2192 Credentialing \u00b7 Organization \u2192 OrgUnit.",
          },
          {
            label: "Audience",
            body:
              "Internal alignment review. Hide for end-user demos. Default OFF so production tenants never see the developer surface.",
          },
        ],
      },
    ],
  },
  // -------------------------------------------------------------------
  // Worker-type axes (v0.77 spec).
  //
  // Three independent enums replace the legacy single `engagementType`
  // field — Work Type \u00b7 Billing Model \u00b7 Supplier Type. Each axis value
  // ships as its own flag, defaulting OFF. With every axis flag off the
  // tenant is the canonical Shift \u00d7 Clock In/Out \u00d7 Agency cell (today's
  // Frontline ship) and every surface renders byte-identical to today.
  //
  // The legacy flag IDs (`professionalWork`, `sow`, `contractors`,
  // `v77Axes`) are kept alive as derived booleans in the storage layer
  // below \u2014 every existing consumer (workforce pools, dashboard lane
  // switch, requisition variant registry, sow accordion, IC onboarding,
  // axis chip-row gate) reads the same key it always read and gets the
  // value derived from the new axis flags. The `eor` flag keeps its
  // legacy ID because it is *also* the Supplier Type EOR axis value;
  // one source of truth, two locations in the UI.
  // -------------------------------------------------------------------
  // v0.80 \u2014 the "Job Category" group (just one flag: `professionalJobTypes`)
  // moved out of Feature Flags into Settings \u2192 Configuration \u2192 Program
  // \u2192 Jobs. The per-org store lives in pages/jobs-config.jsx and mirrors
  // its value back into `flexwork.featureFlags.professionalJobTypes` on
  // every change so existing consumers (JobPicker, role-defaults,
  // requisition-templates, reporting filters) keep reading the same
  // key. Storage is preserved; the only difference is that this UI no
  // longer renders a row for it. To re-introduce a UI for it, restore
  // a flag entry to FEATURE_FLAG_GROUPS here.
  // -------------------------------------------------------------------
  // -------------------------------------------------------------------
  // GROUP \u2014 v0.77 BILLING MODEL axis
  //
  // Work Type was removed from the product (every requisition uses a
  // schedule). The Billing Model axis remains \u2014 it drives time capture,
  // invoice line-item shape, and approval routing.
  // -------------------------------------------------------------------
  {
    // -----------------------------------------------------------------
    // LEGACY GROUP — v0.78. The Engagement Model (Billing Basis × Time
    // Capture) is no longer a tenant-controllable feature flag; it's a
    // pair of fields on each Engagement Type, surfaced inside the Work
    // Assignment Advanced panel. The three IDs below are kept alive as
    // *derived* booleans so existing consumers (timesheets list cols,
    // SOW accordions, fee-schedule accordions) keep working unchanged.
    // -----------------------------------------------------------------
    id: "billingModel",
    label: "Engagement Model (derived)",
    hidden: true,
    summary:
      "How time is captured and how it bills. Clock-in/out is the canonical punch-anchored model that ships by default \u2014 it cannot be turned off. Each of the three additional engagement models is independent: Timesheet (period log + project allocation), Milestone (SOW deliverable acceptance), Fixed (flat-rate retainer). Engagement model gates timesheet participation, invoice line-item shape, AP approval routing, and the milestone / burn / fee-schedule accordions on the detail page.",
    flags: [
      {
        id: "timesheets",
        label: "Timesheet",
        summary:
          "Adds Timesheet as an Engagement Model alongside the always-on Clock-in/out. Timesheet billing means workers self-report a period (day / week / pay-period) and bill on the aggregate \u2014 no punch clock, no real-time fill. Pairs with Shift (scheduled shift, hours self-reported) or Assignment (bench / project on hourly billing \u2014 today's Professional or Contractor ship).",
        defaultOn: false,
        tips: [
          {
            label: "What turns on",
            body:
              "Timesheets list gains a Billing Model column (chip per row: \u201cClock\u201d or \u201cTimesheet\u201d) and admits Timesheet-billed engagements alongside today's clock-derived rows. AP approval routes Timesheet rows to the engagement manager (vs. Clock rows to the shift supervisor). Worker-app entry mode switches per assignment: Clock shows a punch button, Timesheet shows a daily-hours grid with project allocation. The Invoices list line-item table renders hours \u00d7 rate per period for Timesheet rows.",
          },
          {
            label: "Common pairings",
            body:
              "Assignment + Timesheet + Agency reproduces today's Professional ship. Assignment + Timesheet + Independent Contractor reproduces today's Contractor ship. Shift + Timesheet + Agency is an agency shift with no clock (new cell). Shift + Timesheet + Independent Contractor is a direct 1099 on a scheduled shift (new cell).",
          },
          {
            label: "Flag-off contract",
            body:
              "With Timesheet off, the Timesheets list shows only clock-derived rows (today's behavior). The Billing Model column is hidden by default in the column picker; the banner about milestone / fixed-fee engagements not appearing is hidden.",
          },
          {
            label: "Spec",
            body:
              "See unified-vms-v0.77-spec.html \u00a712 (timesheets) and \u00a713 (invoices).",
          },
        ],
      },
      {
        id: "milestones",
        label: "Milestone",
        summary:
          "Adds Milestone as an Engagement Model. Milestone billing means deliverable acceptance fires the invoice \u2014 no time tracking, no headcount. The canonical SOW pattern: ordered milestone list with due dates, acceptance criteria, payment triggers; supplier marks submitted, buyer accepts or rejects with rework notes, acceptance fires the invoice.",
        defaultOn: false,
        tips: [
          {
            label: "What turns on",
            body:
              "The requisition detail page composes milestones / deliverables / burn-and-budget accordions from the section catalog whenever the row reads billingModel=Milestone. The Invoices list line-item table renders milestone \u00d7 fee for Milestone rows. The Supplier contract surface exposes a Billing Models accordion that lists which models the contract authorises (the SOWs accordion is a sub-case of Milestone). Each Milestone engagement carries its own milestone / deliverable / change-order log. Dashboard adds milestones-due / deliverables-overdue / change-orders-in-review tiles to the Assignment lane.",
          },
          {
            label: "Common pairings",
            body:
              "Assignment + Milestone + Agency reproduces today's SOW ship. Assignment + Milestone + Independent Contractor is a solo consultant on a fixed scope (new cell). Assignment + Milestone + EOR is future cross-border milestone work.",
          },
          {
            label: "Flag-off contract",
            body:
              "With Milestone off, the milestones / deliverables / burn-and-budget accordions never compose into a detail page (no row's billingModel reads Milestone). The Billing Models accordion on supplier contracts is hidden; the SOWs accordion only renders when the legacy sow flag is on \u2014 which derives to false whenever Assignment or Milestone is off.",
          },
          {
            label: "Spec",
            body:
              "See unified-vms-v0.77-spec.html \u00a705 (matrix), \u00a706 (catalog), \u00a712 (timesheets non-participation), \u00a713 (invoices), \u00a714 (supplier contract).",
          },
        ],
      },
      {
        id: "fixedFee",
        label: "Fixed",
        summary:
          "Adds Fixed as an Engagement Model option. Fixed means a flat rate over the engagement term \u2014 no time tracking, no milestones, no deliverable acceptance. Common for retainer arrangements (a flat-rate retainer team, a fixed-bid solo consultant). Pairs with Assignment only \u2014 a shift cannot be fixed-fee per the compatibility matrix.",
        defaultOn: false,
        tips: [
          {
            label: "What turns on",
            body:
              "The requisition detail page composes a fee-schedule accordion whenever the row reads billingModel=FixedFee. The Invoices list renders flat-fee + invoice-schedule line items for Fixed Fee rows. The intake picker exposes Fixed Fee under the Billing Model picker when Assignment is also enabled. Fee-schedule policies on the Settings \u2192 Policies surface gain a Fixed Fee branch.",
          },
          {
            label: "Common pairings",
            body:
              "Assignment + Fixed Fee + Agency is a flat-rate retainer team. Assignment + Fixed Fee + Independent Contractor is a fixed-bid solo consultant. Assignment + Fixed Fee + EOR is the rare cell \u2014 the intake picker soft-warns (\u201cEOR usually bills time \u2014 fixed-fee EOR is uncommon\u201d) but does not block.",
          },
          {
            label: "Flag-off contract",
            body:
              "With Fixed Fee off, the fee-schedule accordion never composes, the intake picker filters Fixed Fee out, and the Invoices list shows no flat-fee rows.",
          },
          {
            label: "Spec",
            body:
              "See unified-vms-v0.77-spec.html \u00a703 (compatibility rule + soft warning), \u00a706 (catalog), \u00a713 (invoices).",
          },
        ],
      },
    ],
  },
  {
    // -----------------------------------------------------------------
    // v0.79 — Supplier Type has moved out of Feature Flags and into
    // Settings → Configuration → Supplier types. The flag IDs
    // (`independentContractor`, `eor`) are kept alive as ordinary
    // axis flags so every downstream consumer (legacy derivations,
    // v77-native-cols, axis-scope-bar, req variants, contractor
    // onboarding, intake pickers) keeps reading the same key it
    // always read. The group is rendered hidden on the Feature Flags
    // page; toggling happens on the per-org Supplier types card.
    // Storage + per-org defaults live in supplier-types-config.jsx.
    // -----------------------------------------------------------------
    id: "supplierType",
    label: "Supplier Type",
    hidden: true,
    summary:
      "Who is the supplier of record. Moved to Settings \u2192 Configuration \u2192 Supplier types in v0.79; each org carries its own pre-baked set. Agency ships always-on; Independent Contractor, EOR, and Float are additive and configurable per-org.",
    flags: [
      {
        id: "independentContractor",
        label: "Independent Contractor",
        summary:
          "Adds Independent Contractor as a Supplier Type alongside the always-on Agency. Independent Contractors are sourced directly by the buyer \u2014 no supplier sits between the company and the worker. Adds the IRS 20-factor + ABC test (CA AB5) classification questionnaire, six-step contractor onboarding, tax-form pack (W-9 / W-8BEN / W-8BEN-E auto-picked from country + entity), banking + documents, and 1099-NEC / 1042-S year-end tracking.",
        defaultOn: false,
        tips: [
          {
            label: "What turns on",
            body:
              "Workforce gains an Independent Contractor pool tab alongside Agency. The detail page composes identity / classification / tax-and-documents accordions whenever the row reads supplierType=IndependentContractor. The Compliance hub gains Classification + Tax Forms tabs. The Assign Worker picker filters workers whose supplierType matches the row's supplierType (an Agency req can only be filled by Agency workers; an IC req by IC workers). Six-step contractor onboarding side panel: entity type \u00b7 country / locale \u00b7 classification questionnaire \u00b7 agreement \u00b7 tax forms \u00b7 banking \u00b7 documents \u00b7 review & invite.",
          },
          {
            label: "Common pairings",
            body:
              "Assignment + Timesheet + Independent Contractor reproduces today's Contractor ship. Assignment + Milestone + Independent Contractor is a solo consultant on a fixed scope. Shift + Clock In/Out + Independent Contractor is a 1099 on a scheduled shift (new cell). Assignment + Fixed Fee + Independent Contractor is a fixed-bid solo consultant.",
          },
          {
            label: "Classification + 1099",
            body:
              "IRS 20-factor + ABC test (CA AB5) classification questionnaire surfaces a misclassification risk score on each contractor and flags engagements where tenure / direction of work / exclusivity push the worker toward employee territory. Re-classification alerts fire at configurable thresholds (default 18 months tenure, >35 hrs/week, single-client exclusivity). January 1099-NEC / 1042-S packet export per US filing entity; foreign contractors generate 1042-S where applicable.",
          },
          {
            label: "Flag-off contract",
            body:
              "With Independent Contractor off, the IC pool tab is hidden, the contractor onboarding panel is unreachable, the classification questionnaire never runs, and the worker picker shows only Agency workers \u2014 today's behavior.",
          },
          {
            label: "Spec",
            body:
              "See unified-vms-v0.77-spec.html \u00a710 (workforce), \u00a715 (compliance + credentialing), \u00a718 (assign / remove worker).",
          },
        ],
      },
      {
        id: "eor",
        label: "EOR",
        summary:
          "Adds Employer-of-Record as a Supplier Type alongside the always-on Agency. EOR is the cross-border placement model \u2014 an in-country partner is the legal employer of record while the buyer directs the work. Adds local entity setup, in-country employment templates, global tax / FX (fxLockDate, per-engagement currency), and the EOR variant body on the unified detail page. Production EOR (multi-country payroll, locale-specific employment law, statutory benefits) lands in Phase 4 per the spec roadmap; today this flag enables the data path + UI scaffold.",
        defaultOn: false,
        tips: [
          {
            label: "What turns on",
            body:
              "The detail page composes local-entity + global-tax-fx accordions whenever the row reads supplierType=EOR. The Workforce list gains an EOR pool tab. The Compliance hub gains a Local Employment tab. The Invoices list line items show per-engagement currency + the fxLockDate that locked it.",
          },
          {
            label: "Common pairings",
            body:
              "Assignment + Timesheet + EOR is the first EOR cell in production. Assignment + Milestone + EOR is cross-border milestone work. Assignment + Fixed Fee + EOR is the rare cell (soft warning at intake). Shift cells with EOR are future \u2014 cross-border deskless work needs additional payroll integrations.",
          },
          {
            label: "Why this is preview-only in v0.77",
            body:
              "EOR is the next worker type the unified architecture is meant to absorb cleanly \u2014 the prototype ships a stub manifest behind this flag so the spec's plug-in pattern is demonstrable. The EOR variant body is a placeholder hero + accordion list; production EOR fields (eorPartnerId \u00b7 billCurrency \u00b7 fxLockDate \u00b7 localGrossPay) land in Phase 4. Tied to the multi-national tier flag in production \u2014 only tenants at $50M+ temp spend with multiNational: true see EOR engagements.",
          },
          {
            label: "Flag-off contract",
            body:
              "With EOR off, the local-entity / global-tax-fx accordions never compose, the EOR pool tab is hidden, and the Local Employment compliance tab is unreachable.",
          },
          {
            label: "Data model alignment",
            body:
              "Per unified-vms-v0.77-spec.html \u00a704 \u2014 EOR introduces supplierType=EOR on Employee and a new EorEngagement sub-record parallel to ContingentEngagement, keyed by Position. Same pattern Phase 4 used for the IC ClassificationDetermination sibling \u2014 no new top-level tables.",
          },
          {
            label: "Spec",
            body:
              "See unified-vms-v0.77-spec.html \u00a702 (axes), \u00a705 (matrix), \u00a706 (catalog), \u00a715 (compliance), \u00a723 Phase 4 (EOR rollout).",
          },
        ],
      },
      {
        id: "float",
        label: "Float",
        summary:
          "Adds Float as a Supplier Type alongside the always-on Agency. Float workers are directly employed by the buyer but not tied to a single location \u2014 the canonical case is healthcare's float-pool / per-diem RNs who flex across hospitals in a system. Profile, schedule, and accrued hours are owned by Dayforce core; Flex Work syncs the worker record so a float-eligible employee can be matched against an open requisition and dispatched without re-onboarding. Ships on by default for Mercy Health System; off everywhere else.",
        defaultOn: false,
        tips: [
          {
            label: "What turns on",
            body:
              "The Supplier type picker on new requisitions gains a Float chip. Suppliers / Workforce / Timesheets / Invoices / Requisitions gain a Float value on the Supplier type filter. Workforce surfaces a Float pool tab. Distribution can target the float pool directly (no supplier tier required) so float-eligible employees see the requisition in their internal openings list. Float worker profiles are read-only inside Flex Work \u2014 edits round-trip through Dayforce core.",
          },
          {
            label: "Where the data lives",
            body:
              "Dayforce core is the system of record. Employee, schedule, accrued hours, and PTO live in core; Flex Work mirrors the subset needed to surface the worker on a requisition (name, primary location, skills, eligibility, current schedule conflicts). A Float worker is an Employee with workerType = Employee + sourcingChannel = FloatPool \u2014 the same row the manager already sees in WFM, surfaced through the VMS lens.",
          },
          {
            label: "Common pairings",
            body:
              "Healthcare: med-surg / ICU / ED per-diem RNs picking up open shifts across a hospital system. Hospitality: banquet / event-flex staff a hotel group dispatches across properties for peak coverage. Both lean on the Shift \u00d7 Clock-in/out cell with Float as the supplier; no third-party invoice fires \u2014 the worker is paid through native payroll.",
          },
          {
            label: "Flag-off contract",
            body:
              "With Float off, the Float chip is hidden from the Supplier type picker, the Float filter value disappears from every list, the Float pool tab on Workforce collapses, and the Suppliers list shows no Float rows \u2014 surfaces stay byte-identical to today's Agency-only ship.",
          },
        ],
      },
    ],
  },
  {
    // -----------------------------------------------------------------
    // LEGACY GROUP \u2014 deprecated, hidden from the page. Kept so the
    // catalog walk in _ffDefaultFor / FFFlagRow can still resolve a
    // label for legacy keys if any old surface accidentally renders one.
    // The values are derived by getFeatureFlag; toggling them via UI is
    // not possible (the group is filtered out of the rendered list).
    // -----------------------------------------------------------------
    id: "_legacy",
    label: "Legacy (derived)",
    hidden: true,
    summary:
      "Legacy single-engagement-type flags. Derived from the new axis flags above. Reads always succeed; the UI no longer surfaces toggles for these IDs because they composed three concerns (Work Type + Billing Model + Supplier Type) into one boolean.",
    flags: [
      {
        id: "professionalWork",
        label: "Professional Work",
        summary:
          "Adds Professional Work as a worker type on top of the Frontline workforce that ships by default. Professional engagements are permanent (no end date), filled through interviews and candidate selection, run on weekly / monthly / annual contracts with no schedule or hourly rate, and may or may not capture timesheets \u2014 but always generate invoices.",
        defaultOn: false,
        tips: [
          {
            label: "What changes when this is on",
            body:
              "Flex Work splits into two engagement types across every surface: Frontline (the default \u2014 shift\u2011based, schedule\u2011driven, hourly billed agency workers) and Professional (the new addition \u2014 permanent SOW engagements with interviews, contract terms, and invoice\u2011only billing). The Professional surfaces are purely additive: nothing about Frontline changes when the flag is off, and turning it on doesn\u2019t move any existing data.",
          },
          {
            label: "Requisitions",
            body:
              "Adds an Engagement type field to every requisition. Professional requisitions have no end date by default, no shift time / break, no hourly bill rate, and a Number of positions field instead of headcount. They open a candidate pipeline (Sourced \u2192 Screened \u2192 Interview \u2192 Offer \u2192 Hired) with interview scheduling and scorecards, plus a Contract terms panel where the buyer sets weekly / monthly / annual rate, term length, renewal policy, deliverables, and SOW template.",
          },
          {
            label: "Workforce",
            body:
              "Adds a Professional pool tab alongside the existing Agency / Internal / Float / Per\u2011diem / Alumni pools. Each professional worker shows contract type (weekly / monthly / annual), term start, renewal date, SOW reference, and YTD invoiced. The Frontline pools remain untouched.",
          },
          {
            label: "Schedule & timesheets",
            body:
              "Professional engagements don\u2019t appear on the Schedule \u2014 there are no shifts to staff. Timesheets become optional per engagement: the contract terms panel chooses \u201cTimesheet required\u201d (effort tracking, no impact on billing) or \u201cNo timesheet\u201d (pure deliverable\u2011based). Frontline timesheets continue to drive bill\u2011by\u2011hour invoicing unchanged.",
          },
          {
            label: "Invoices",
            body:
              "Professional invoices are always generated, on the contract cadence (weekly / monthly / annual milestone). They land in the existing Invoices list tagged with a Professional source chip, and route through the same AP approval workflow as Frontline timesheet\u2011derived invoices. Two billing models: auto\u2011generated from the contract schedule, or supplier\u2011submitted PDF + line items against the SOW.",
          },
          {
            label: "Dashboard",
            body:
              "Adds a Frontline \u2194 Professional segmented control to the Home overview. Frontline keeps the current view (upcoming assignments, calendar, shifts at risk). Professional swaps the upcoming\u2011shifts card for an open\u2011requisitions / candidate\u2011pipeline card, the calendar for an engagements\u2011by\u2011status mosaic, and the at\u2011risk tile for a renewals\u2011due tile.",
          },
          {
            label: "Data model alignment",
            body:
              "Professional requisition \u2192 Dayforce Job Requisition (Recruiting) with no shift pattern and engagementType = Professional. Professional worker \u2192 Employee + workerType = Professional + sourcingChannel = SOW. Contract terms \u2192 ContingentEngagement (extended with cadence, rate, term, renewal). Invoice \u2192 SupplierInvoice (Flex Work\u2011owned).",
          },
          {
            label: "Coverage",
            body:
              "Active across every country, every organization, and every industry the tenant is configured for. Surfaces touched: Home / Dashboard, Requisitions (list \u00b7 new \u00b7 details \u00b7 candidates), Workforce (Professional pool \u00b7 worker detail), Schedule (Frontline\u2011only banner), Timesheets (optional per engagement), Invoices (Professional tag), Settings \u2192 Worker Types.",
          },
        ],
      },
      {
        id: "sow",
        label: "SOW",
        summary:
          "Adds Statement of Work (SOW) as a scope\u2011based engagement type on top of every other worker type. An SOW is a contract with a supplier for a defined scope and set of deliverables \u2014 not a headcount. The supplier staffs and manages whatever resources they need; the buyer pays on milestone acceptance, fixed fee, or capped T&M.",
        defaultOn: false,
        tips: [
          {
            label: "What an SOW is (and isn\u2019t)",
            body:
              "An SOW is a contract for a deliverable scope under a Master Services Agreement, not a request for people. The supplier proposes a fee schedule, names the deliverables and milestones, and decides how to staff the work. The buyer reviews and accepts each milestone, which fires the invoice \u2014 nothing is billed by the hour, by the headcount, or by the shift. Layered additively on top of Frontline, Professional Work, and Contractors; turning this flag off restores the prior surfaces with zero churn.",
          },
          {
            label: "Supplier contracts",
            body:
              "Every SOW rolls up to an existing Supplier MSA. The Suppliers \u2192 Contract surface gains an SOWs tab listing every active / in\u2011approval / completed SOW for that supplier, with quick links to the fee schedule, deliverable list, milestone calendar, and change\u2011order log. Supplier rate cards from the MSA inform the SOW fee schedule but don\u2019t drive billing \u2014 billing is event\u2011based.",
          },
          {
            label: "SOW lifecycle & approvals",
            body:
              "Draft \u2192 In approval \u2192 Active \u2192 (On hold) \u2192 Completed \u2192 Closed. Approval routing uses the same workflow engine as Professional requisitions \u2014 legal review, departmental sign\u2011off, finance threshold gates. Buyers can clone a template SOW, attach a vendor\u2011submitted SOW PDF, or build line\u2011by\u2011line in product. Change orders ride alongside the SOW with their own approval path and amend the fee schedule on acceptance.",
          },
          {
            label: "Deliverables & milestones",
            body:
              "Every SOW carries an ordered milestone list \u2014 each milestone has a due date, a fee, an acceptance criterion, and a payment trigger. Deliverables are the discrete named outputs that compose each milestone (\u201cTest plan v1\u201d, \u201cDE locale \u00b7 production\u201d). Supplier marks a milestone Submitted; buyer Accepts or Rejects with rework notes. Acceptance fires an invoice for that milestone\u2019s fee (minus retainage).",
          },
          {
            label: "Payment terms & billing models",
            body:
              "Three billing models ship: Fixed\u2011fee (full SOW amount split across milestones), Milestone (each milestone has its own fee), and T&M (capped) (weekly draw against a cap with an 80% early\u2011warning). Each SOW carries its own payment terms (Net 30 / Net 45 / Net 60), retainage percentage held until closeout, and currency. Invoices land in the existing Invoices list tagged with an SOW source chip plus SOW reference and milestone reference.",
          },
          {
            label: "SOW Resources in Workforce",
            body:
              "Workforce gains an SOW Resources pool listing the supplier\u2011managed people executing under an active SOW. Roster\u2011level visibility only \u2014 no schedule, no timesheet, no rate \u2014 because billing is event\u2011based, not hours\u2011based. Each resource row shows role, allocation %, originating SOW, and the supplier. The Frontline, Professional, Internal, Float, Per\u2011diem, Contractor, and Alumni pools are untouched.",
          },
          {
            label: "Dashboard",
            body:
              "Adds SOW to the engagement\u2011type segmented control on the Home overview. The SOW lane shows: active SOWs by status, milestones due in the next 7 days, deliverables overdue, change orders in review, and a committed\u2011vs\u2011consumed spend tracker rolled up across every SOW currency. Frontline and Professional lanes stay untouched.",
          },
          {
            label: "Change orders & amendments",
            body:
              "SOWs are amendable mid\u2011flight. Change orders carry their own approval path, can adjust scope / fee / dates, and on acceptance amend the master SOW\u2019s fee schedule. A change order in review shows on the SOW status card and pauses any milestones it directly impacts.",
          },
          {
            label: "Data model alignment",
            body:
              "SOW agreement \u2192 SupplierContract subtype \u201cSOW\u201d + ContingentEngagement.engagementType = SOW. Milestone \u2192 SupplierContractMilestone (new entity) firing a BillingEvent on acceptance instead of a TimePair \u2192 BillingLine. Deliverable \u2192 SupplierContractDeliverable (new entity). SOW resource \u2192 Employee + workerType = Contingent + sourcingChannel = SOW + engagementRef = SOW id. Change order \u2192 SupplierContractAmendment (existing). Invoice \u2192 SupplierInvoice (Flex Work\u2011owned).",
          },
          {
            label: "Coverage",
            body:
              "Active across every country, every organization, and every industry the tenant is configured for. Surfaces touched: Home / Dashboard (SOW lane), Suppliers \u2192 Contract (SOWs tab), Workforce (SOW Resources pool, additive), Invoices (SOW source chip on milestone invoices), Settings \u2192 Worker Types. Frontline, Professional, and Contractor flows are untouched.",
          },
        ],
      },
      {
        id: "contractors",
        label: "Contractors",
        summary:
          "Adds independent contractors (1099 / IC) as a first-class worker type alongside agency workers. Contractors are sourced directly by the buyer \u2014 no supplier sits between the company and the worker. Covers IC compliance, classification, agreement, document, onboarding, invoice and 1099 capabilities for direct\u2011sourced contractors.",
        defaultOn: false,
        tips: [
          {
            label: "Who this is for",
            body:
              "Independent contractors with a direct relationship to the company \u2014 not workers sourced through a staffing supplier. Includes US 1099-NEC contractors, sole proprietors, single-member LLCs, S\u2011corps, and foreign contractors paid on W\u20118BEN / W\u20118BEN\u2011E. Applies across every organization and country the tenant is configured for.",
          },
          {
            label: "Classification",
            body:
              "Adds the IRS 20\u2011factor + ABC test (CA AB5) classification questionnaire to onboarding, surfaces a misclassification risk score on each contractor, and flags engagements where tenure / direction of work / exclusivity push the worker toward employee territory. Re\u2011classification alerts fire at configurable thresholds (default: 18 months tenure, >35 hrs/week, single\u2011client exclusivity).",
          },
          {
            label: "Onboarding",
            body:
              "Six\u2011step contractor onboarding side panel: entity type \u00b7 country / locale \u00b7 classification questionnaire \u00b7 agreement (MSA + SOW from template) \u00b7 tax forms (W\u20119 / W\u20118BEN / W\u20118BEN\u2011E auto\u2011picked from country & entity) \u00b7 banking (ACH / Wire / Wise / PayPal) \u00b7 documents (COI, ID, NDA, IP assignment) \u00b7 review & invite. Contractor receives the invite email and self\u2011completes any missing fields.",
          },
          {
            label: "Documents & agreements",
            body:
              "Generates Master Services Agreement, Statement of Work, NDA, and IP Assignment from per\u2011country templates. Tracks signature status (sent / viewed / signed / countersigned), version history, and effective / expiry dates. Stores COI (certificate of insurance), government ID, business license, and any custom required docs with expiry tracking.",
          },
          {
            label: "Invoices",
            body:
              "Contractors submit their own invoices (vs. agency workers, whose invoices come from the supplier). Two billing models: auto\u2011generated from approved timesheets, or contractor\u2011submitted PDF + line items. Both flow into the same Invoices list as supplier invoices, tagged with a Contractor source chip, and route through your existing AP approval workflow.",
          },
          {
            label: "1099 \u00b7 1042\u2011S \u00b7 year\u2011end",
            body:
              "YTD tracking of contractor payments by tax form. Flags missing W\u20119s, missing addresses, and contractors crossing the $600 1099\u2011NEC reporting threshold. January 1099 packet export per US filing entity; foreign contractors generate 1042\u2011S where applicable.",
          },
          {
            label: "Data model alignment",
            body:
              "Contractor worker \u2192 Dayforce Employee + workerType = Contractor + sourcingChannel = Direct (People). Classification (IRS 20\u2011factor / ABC) \u2192 Compliance.ClassificationDetermination (Compliance). MSA / SOW / NDA / IP \u2192 ContractAgreement (Flex Work\u2011owned, links to Dayforce Document for the signed file). Tax form (W\u20119 / W\u20118BEN / W\u20118BEN\u2011E) \u2192 Payroll.TaxDocument. Banking \u2192 Payroll.PaymentMethod. Contractor invoice \u2192 SupplierInvoice with payerType = Contractor (Flex Work\u2011owned). Year\u2011end 1099\u2011NEC / 1042\u2011S \u2192 Payroll.YearEndForm.",
          },
          {
            label: "Coverage",
            body:
              "Workforce list (Contractor pool tab \u00b7 contractor row chips) \u00b7 Worker detail (classification \u00b7 agreement \u00b7 tax \u00b7 documents \u00b7 1099 prep) \u00b7 New requisition (Contractor sourcing channel) \u00b7 Invoices (contractor\u2011submitted) \u00b7 Settings \u2192 Worker Types (classification policy, agreement templates, default rate types). Active across every country, every organization, every industry the tenant uses.",
          },
        ],
      },
    ],
  },
  {
    id: "program",
    label: "Program",
    summary:
      "Program-level capabilities that govern how this contingent program is run end-to-end \u2014 who funds it, how fees are calculated, how rates roll up to suppliers and the buyer.",
    flags: [
      {
        id: "salesTax",
        label: "Sales Tax",
        summary:
          "Adds a Sales Tax configuration to Settings \u2192 Configuration so an admin can model how sales tax / VAT / GST applies to supplier invoices in every country this tenant operates in. When on, every invoice carries the correct local tax line \u2014 named for the local regime (US Sales Tax, UK VAT, German USt, Canadian GST/HST, Australian GST, Japanese Consumption Tax) \u2014 with sourcing, B2B reverse charge, and per\u2011jurisdiction taxability resolved from the configured matrix.",
        defaultOn: false,
        tips: [
          {
            label: "Why sales tax is not on by default",
            body:
              "Staffing services tax treatment varies wildly by country and even by US state \u2014 most US states don\u2019t tax staffing at all, while 12 + DC do (CT, DE, HI, IA, NM, NY, OH, PA, SD, TN, WA, WV, DC), and Washington only added it on Oct 1, 2025 under ESSB 5814. Across the EU and UK, VAT applies at 19\u201320% with cross\u2011border B2B reverse charge under EU Art. 196 / UK Notice 741A. Tenants need to opt in deliberately, configure their nexus and taxable jurisdictions, and then have every invoice across every country resolve cleanly \u2014 which is why the capability ships off and only lights up when explicitly turned on.",
          },
          {
            label: "What this flag adds to the product",
            body:
              "A new Sales Tax section appears in Settings \u2192 Configuration with a per\u2011country tax matrix covering the six markets this tenant is configured for (US, CA, GB, DE, AU, JP). Each country carries its own tax regime name, default rate, sourcing rule (place\u2011of\u2011performance for the US; place\u2011of\u2011supply / buyer\u2011location for VAT countries), reverse\u2011charge behavior for cross\u2011border B2B, and engagement\u2011type coverage. The Invoices list and every Invoice detail page swap their placeholder tax line for the correct local treatment \u2014 right name, right rate, right jurisdiction, and a reverse\u2011charge banner where applicable. Frontline, Professional, Contractor, and SOW invoices all consume the same config.",
          },
          {
            label: "United States \u00b7 state\u2011by\u2011state",
            body:
              "Sales tax on staffing services is a state\u2011by\u2011state question. Out of the box the configuration ships with the 12 currently\u2011taxable states + DC pre\u2011checked at their state base rate (Connecticut 6.35%, New York 4%, Ohio 5.75%, Pennsylvania 6%, Washington 6.5%, Tennessee 7%, Iowa 6%, Hawaii 4%, New Mexico 4.875%, South Dakota 4.2%, West Virginia 6%, Delaware 0%/GR, DC 6%). Sourcing is place\u2011of\u2011performance: if the worker performs in a taxable state, the buyer is invoiced sales tax at that state\u2019s rate regardless of where the buyer or supplier sit. Reseller exemption certificates are honored on supplier\u2011to\u2011supplier resale.",
          },
          {
            label: "Canada \u00b7 GST/HST and provincial",
            body:
              "Federal GST 5% applies in every province, harmonized into HST 13% in Ontario and 15% in NS/NB/NL/PEI. Quebec layers QST 9.975% on top of GST. BC, SK, and MB run their own PST (7%, 6%, 7%) parallel to GST. The configuration resolves the right combination based on the worker\u2019s province and shows GST + PST/QST or HST on a single invoice line per Canada Revenue Agency convention.",
          },
          {
            label: "United Kingdom \u00b7 VAT",
            body:
              "Standard VAT 20% applies to staffing services across England, Scotland, Wales, and Northern Ireland under HMRC VAT Notice 741A. Cross\u2011border B2B supplies (EU \u2192 GB or GB \u2192 EU) zero\u2011rate the invoice with a reverse\u2011charge notice so the buyer self\u2011accounts for VAT in their own country. The Healthcare Staffing Concession (the Kingsbridge case carve\u2011out for medical / nursing staff) is configurable per supplier contract but not on by default.",
          },
          {
            label: "Germany \u00b7 USt and \u00a713b reverse charge",
            body:
              "Standard Umsatzsteuer 19% applies to domestic staffing services. Cross\u2011border B2B supplies fall under \u00a713b UStG \u2014 the supplier issues a net invoice marked \u201cSteuerschuldnerschaft des Leistungsempf\u00e4ngers\u201d (\u201cReverse charge \u00b7 VAT due by the recipient\u201d) and the buyer self\u2011accounts on their UStVA return. The Sales Tax card surfaces this language as a preview banner on EU intra\u2011community supplier invoices.",
          },
          {
            label: "Australia \u00b7 GST",
            body:
              "Goods and Services Tax at 10% applies to staffing services across all states and territories. Cross\u2011border imports of services to GST\u2011registered buyers can be reverse\u2011charged under Subdivision 84\u2011A of the GST Act, depending on whether the supplier is registered for Australian GST. Invoices for ABN\u2011registered buyers show GST as a separate line per the Tax Invoice rules.",
          },
          {
            label: "Japan \u00b7 Consumption Tax",
            body:
              "Standard Consumption Tax (Sh\u014dhizei) 10% applies to staffing services. Under the Qualified Invoice System (in effect since October 2023) suppliers must show their registered T\u2011number on every invoice for the buyer to claim input tax. Cross\u2011border imports to JCT\u2011registered businesses self\u2011assess under the reverse charge mechanism for electronic services and consulting.",
          },
          {
            label: "Engagement\u2011type coverage",
            body:
              "Each engagement type can independently opt in: Frontline (timesheet\u2011derived supplier invoices), Professional (weekly / monthly / annual contract invoices), SOW (milestone\u2011triggered invoices), and Contractor (1099 / IC self\u2011submitted invoices). Contractor invoices most often follow a different regime \u2014 self\u2011employed sole traders sit below VAT registration thresholds in many countries \u2014 so by default they\u2019re off; tenants who pay incorporated contractors can opt them in.",
          },
          {
            label: "Stacking with Supplier Funding",
            body:
              "When Supplier Funding is also on, tax is calculated on the gross bill amount (pre\u2011program\u2011fee) per the canonical staffing\u2011industry treatment \u2014 the program fee is a remittance adjustment between buyer and program, not a discount on the taxable supply. Both lines appear on the invoice: sales tax on top of subtotal first, then the program fee deduction underneath net\u2011to\u2011supplier.",
          },
          {
            label: "Data model alignment",
            body:
              "Tax configuration \u2192 TenantTaxConfiguration (new top\u2011level entity) keyed by country code with a per\u2011jurisdiction sub\u2011record (TenantTaxJurisdiction) carrying name \u00b7 rate \u00b7 sourcingRule \u00b7 reverseChargeEligible \u00b7 effectiveDate. Per\u2011invoice tax \u2192 SupplierInvoice.taxLine[] (new repeating sub\u2011record) on the existing Dayforce SupplierInvoice primitive, one row per jurisdiction (e.g. GST 5% + QST 9.975% for a Quebec invoice). Reverse charge \u2192 SupplierInvoice.reverseChargeApplied (boolean) + .reverseChargeJurisdiction.",
          },
          {
            label: "Coverage",
            body:
              "Active across every country, every organization, every industry, and every temp\u2011spend tier this tenant is configured for. Invoice detail page picks up the configured tax automatically; Invoices list shows a per\u2011row tax chip when the country has reverse charge applied. Settings \u2192 Configuration is the single source of truth \u2014 there is no per\u2011org or per\u2011supplier tax override in v1 (per\u2011supplier exemption certificates land in a Phase\u20112 follow\u2011up alongside the Sales Tax Certificate document type).",
          },
        ],
      },
      // NOTE: Supplier Funding moved out of Feature Flags in v0.79 — it
      // is now an always-available configuration choice under
      // Settings → Configuration → Program. Helios Power Generation
      // ships with Supplier Funded selected; every other org defaults
      // to Buyer Funded. The block below is kept commented out for
      // history (catalog walk in _ffDefaultFor still resolves the key
      // to false so any stale consumer fails closed).
      /* DEPRECATED — moved to Configuration → Program
      {
        id: "supplierFunding",
        label: "Supplier Funding",
        summary:
          "Add a Supplier Funding section to Configuration \u2192 Program so an admin can flip the program from buyer\u2011funded to supplier\u2011funded. When on, a configured program fee is deducted from every supplier invoice across every organization, country, and engagement type.",
        defaultOn: false,
        tips: [
          {
            label: "What Supplier Funding is",
            body:
              "In a supplier\u2011funded program the buyer doesn\u2019t cut a separate check for the VMS / MSP fee \u2014 each supplier funds it by accepting a small percentage deduction on every invoice. The bill\u2011to\u2011buyer amount stays as agreed; the pay\u2011to\u2011supplier amount is the bill amount minus the program fee. The opposite model is buyer\u2011funded, where the buyer pays the fee directly and the supplier receives the full invoice amount.",
          },
          {
            label: "What this flag adds to the product",
            body:
              "A new Program section appears in Settings \u2192 Configuration with a master Supplier Funding toggle, a default fee percentage, calculation method (Markup vs Discount), engagement\u2011type coverage (Frontline \u00b7 Professional \u00b7 SOW \u00b7 Contractor), per\u2011supplier override controls, effective date, and the invoice line\u2011item label. With the toggle on, every supplier invoice across every organization, country, and temp\u2011spend tier renders a Program fee line and a Net to supplier subtotal.",
          },
          {
            label: "Markup vs Discount",
            body:
              "Markup adds the fee on top of the supplier\u2019s bill rate to arrive at the buyer\u2019s bill rate \u2014 the supplier sees their original rate, the buyer sees that rate + fee%. Discount subtracts the fee from the buyer\u2019s bill rate to arrive at the supplier\u2019s pay rate \u2014 the buyer sees the rate they agreed to, the supplier nets bill rate \u00d7 (1 \u2212 fee%). Both methods are negotiated directly with each supplier in the contract; this setting picks the default applied tenant\u2011wide.",
          },
          {
            label: "Per\u2011supplier overrides",
            body:
              "The tenant\u2011wide fee is a default; individual supplier contracts can override it (e.g. a strategic supplier might be exempt, a newer supplier might carry a higher fee). Overrides live on each Supplier \u2192 Contract record; this flag only exposes the program\u2011wide default and the on/off switch. Multiple suppliers can participate in the same supplier\u2011funded program at different fee percentages \u2014 each contract carries its own fee%.",
          },
          {
            label: "Where it shows up",
            body:
              "Settings \u2192 Configuration \u2192 Program (new) \u00b7 every invoice in the Invoices list (a Program fee chip on supplier\u2011funded rows) \u00b7 every Invoice detail page (Program fee line in the totals block + Net to supplier subtotal) \u00b7 supplier contract record (override field, follow\u2011up). Frontline, Professional, SOW, and Contractor invoices are all affected when their engagement type is selected in the coverage control.",
          },
          {
            label: "Data model alignment",
            body:
              "Program funding model \u2192 ProgramConfiguration.fundingModel (new field on the existing tenant Program record). Default fee \u2192 ProgramConfiguration.programFeePct + .programFeeMethod. Per\u2011supplier override \u2192 SupplierContract.programFeeOverridePct (already exists as a fee\u2011component slot, reused). Invoice fee \u2192 SupplierInvoice.programFeeAmount (new derived field, computed at invoice generation).",
          },
          {
            label: "Coverage",
            body:
              "Active across every country, every organization, and every temp\u2011spend tier the tenant is configured for. The fee applies on top of any existing markups, premiums, and taxes already on the invoice \u2014 it does not change the bill rate itself, only what nets out to the supplier (Discount) or what the buyer is invoiced (Markup).",
          },
        ],
      },
      */
    ],
  },
  {
    id: "misc",
    label: "Misc",
    summary:
      "Cross-cutting capabilities that don't belong to a specific source product \u2014 in-product education, accessibility helpers, and other tenant-wide tweaks.",
    flags: [
      {
        id: "aiChat",
        label: "AI Chat",
        summary:
          "Adds a persistent AI chat dock to the bottom-right of every page. Users can ask any question about live program data (open requisitions, fulfillment, worker availability, invoices, temp spend, supplier scorecards) and run common actions in natural language \u2014 create a requisition, request a worker, message an agency, approve an invoice. The chat is grounded in the same prototype data the rest of the product reads, so every answer is real.",
        defaultOn: false,
        tips: [
          {
            label: "What turns on",
            body:
              "A floating AI chat launcher pinned to the bottom-right corner on every page. Click to open a slim chat panel with conversation history, quick-action suggestions, and a text input. The same dock follows the user across Dashboard, Requisitions, Workforce, Schedule, Timesheets, Invoices, Suppliers, Analytics, Compliance, Settings, and the Worker mobile app.",
          },
          {
            label: "What it can answer",
            body:
              "Any question that can be derived from the program's live data: count of open requisitions by location / job / supplier, fulfillment at-risk shifts in the next 48 hours, top-spend agencies, invoice approval queue and AP aging, temp-spend year-to-date and burn vs. budget, worker availability for a specific role, compliance alerts, supplier scorecards and rate benchmarks. The model always grounds in the data \u2014 if a row isn't in the prototype it says so rather than inventing.",
          },
          {
            label: "What it can do",
            body:
              "Quick actions surfaced as chips and runnable from natural language: \u201cCreate a requisition for 6 forklift operators at Dallas DC starting Monday\u201d \u2192 opens the New Requisition flow pre-filled. \u201cRequest 3 more workers on REQ-91204\u201d \u2192 nudges the distribution. \u201cMessage StaffWise about REQ-91215 timing\u201d \u2192 drafts an outbound message. \u201cReview invoice INV-77310\u201d \u2192 jumps to the invoice detail. \u201cWhat\u2019s our temp spend YTD?\u201d \u2192 answers with the live number.",
          },
          {
            label: "Privacy + grounding",
            body:
              "The chat only sees the data your current login already sees on the page \u2014 location scope, role scope, and feature-flag-gated surfaces all apply. Conversations live in the browser; nothing is persisted server-side in this prototype.",
          },
          {
            label: "Flag-off contract",
            body:
              "With AI Chat off, the launcher is hidden everywhere and no part of the product depends on the assistant. Turn it on per-tenant when the program is ready to pilot.",
          },
        ],
      },
      {
        id: "interviews",
        label: "Interviews",
        summary:
          "Lets requisitions require a candidate interview before any offer fires. The Distribution card gains an \"Interview required\" toggle in its edit panel, plus per-role overrides so individual job roles can require interviews while others don't. With this off, every requisition skips the interview gate and opens immediately to suppliers and pools.",
        defaultOn: false,
        tips: [
          {
            label: "What turns on",
            body:
              "The Distribution \u2192 Edit side panel adds an Interview-required section: a tenant-wide toggle plus per-role overrides (one row per job ordered on the requisition). When required, the workflow inserts an interview stage before any offer fires \u2014 candidates move from Submitted \u2192 Interview \u2192 Offer instead of Submitted \u2192 Offer.",
          },
          {
            label: "Flag-off contract",
            body:
              "Every new requisition implicitly skips the interview gate and opens to suppliers + pools the moment it's saved (today's behavior). The Distribution edit panel does not surface the Interview section.",
          },
          {
            label: "Spec",
            body:
              "Companion to unified-vms-v0.77-spec.html \u00a708 (intake) and \u00a717 (workflows). Independent of the worker-type axes.",
          },
        ],
      },
      {
        id: "vmsEducation",
        label: "VMS Education",
        summary:
          "Adds inline education throughout the product. Team members see a \u201cWhy?\u201d pin next to every page header and short hover tips on the primary nav, each explaining what the feature is, what problem it solves, why it's helpful, and how it compares in the broader VMS industry.",
        defaultOn: false,
        excludes: ["dataModelAlignment"],
        tips: [
          {
            label: "What you see when on",
            body:
              "A small teal \u201cWhy?\u201d pin appears next to every page title (Requisitions, Schedule, Timesheets, Invoices, Suppliers, Workforce, Organization, Analytics, Settings, Home). Clicking it opens a popover with a four-part explainer: why it exists, why it's helpful, and how it compares in the VMS industry. The primary nav also gets short hover tooltips on each section.",
          },
          {
            label: "Audience",
            body:
              "New team members onboarding to Flex Work, internal stakeholders demoing the product, and customers evaluating against other VMS tools. Turn it off for everyday production use \u2014 the education is meant to be opt-in.",
          },
          {
            label: "Coverage today",
            body:
              "All 10 top-level navigation sections plus Inbox, Insights and Compliance sub-views. Coverage will extend to key sub-features (recurring schedules, bulk actions, supplier distribution) in a follow-up.",
          },
        ],
      },
      {
        id: "frontlineDirect",
        label: "Frontline direct sourcing",
        summary:
          "Lets buyers bring direct\u2011sourced Frontline workers on board through Flex Work \u2014 not via an agency. Adds a Frontline variant to the Add Professional panel (Joined Up parity: invite code \u00b7 RTW / I\u20119 \u00b7 W\u20114 / P45 \u00b7 direct deposit \u00b7 orientation video \u00b7 shift\u2011ready gate) and surfaces the Frontline lifecycle program card in Settings \u2192 Configuration. With this off, every Frontline worker is owned by their agency and the lifecycle catalog stays hidden.",
        defaultOn: false,
        tips: [
          {
            label: "What turns on",
            body:
              "Settings \u2192 Configuration gains a Frontline lifecycle program card (next to SOW + IC). The Workforce row menu surfaces \"Invite Frontline worker\" on the omnibar Create dropdown. The existing Add Professional panel grows a worker\u2011type variant flag that swaps the step\u20113 task set to the Frontline catalog (invite code \u00b7 RTW \u00b7 W\u20114 \u00b7 banking \u00b7 orientation) and the step\u20112 rate model to hourly + classification. The worker\u2011mobile shell gains a pool\u2011conditional Onboarding tab so direct\u2011sourced Frontline workers see their tasks on day one.",
          },
          {
            label: "Out of scope",
            body:
              "Agency\u2011sourced Frontline workers stay on their agency's onboarding \u2014 Flex Work's job there is the compliance gate, not the workflow. SOW resources and IC contractors are also out: SOW is supplier\u2011managed, IC has its own lifecycle on contractors\u2011config.jsx + worker\u2011mobile\u2011ic.jsx.",
          },
          {
            label: "Flag\u2011off contract",
            body:
              "With the flag off, the Frontline lifecycle program card never renders, the worker\u2011mobile shell never surfaces the Onboarding tab for a Frontline worker, and the Add Professional panel never branches into Frontline mode. Every surface is byte\u2011identical to today's ship.",
          },
        ],
      },
      {
        id: "customFields",
        label: "Custom Fields",
        summary:
          "Tenant-configurable custom fields on every first-class object — Requisitions, Workers, Engagements, Timesheets, Invoices, Suppliers, SOWs, Projects, Candidates, Locations. Each field carries its own type (text, number, currency, date, pick list, cascade, cost code, person reference), visibility scope (buyer / supplier / worker / internal), required-for-state, optional sync target (Dayforce Core or SAP ERP), PII flag, and conditional visibility. With this off, the Custom Fields tab is hidden from Settings and every object renders with the standard schema only.",
        defaultOn: false,
        tips: [
          {
            label: "Why this is here",
            value: "what",
            body:
              "Every enterprise VMS has a custom-field surface — Fieldglass (\u201cCustom Field\u201d under Admin \u2192 Configuration) and Vndly (\u201cself-serve fields\u201d under Settings) both let buyers extend each module without filing support tickets. This flag turns on the equivalent Flex Work surface so admins can attach program-specific fields (outage windows, certifications, capital project codes) to any object on their tenant.",
          },
          {
            label: "What turns on",
            body:
              "Settings \u2192 Custom Fields appears in the Settings dock. The page lets an admin pick an object type (Requisition, Worker, Timesheet, etc.) and add/edit fields with type, visibility scope, required-for-state, conditional visibility, sync target, and PII flag. The per-org store is seeded with realistic examples for the active org (Helios drills into NERC CIP / outage windows / radiation clearance; Mercy \u2192 BLS expiry + HIPAA training; Fleetwind \u2192 CDL class + DOT med card). Helios Power Generation ships with the flag pre-enabled \u2014 every other org defaults off.",
          },
          {
            label: "Where the fields render",
            body:
              "On the consuming surface, custom fields appear as additional rows on the detail-page accordions matching their \u201csection\u201d (Overview, Scheduling, Compensation, Compliance, Finance, Allocation). On list pages they\u2019re available as filter chips and column-picker options. On reports, they show up as additional metrics / dimensions. On integrations, they\u2019re written to the field's configured sync target (Dayforce Core or SAP ERP) when set.",
          },
          {
            label: "Per-org defaults",
            body:
              "Helios Power Generation \u2192 on (energy tenant ships with the broadest set of custom fields seeded \u2014 outage window, NERC CIP tier, plant unit cascade, capital project code, radiation worker cleared, HAZWOPER expiry, security clearance level, OFAC sanctions screened, cyber-security tier, capital vs O&M SOW classification). Every other tenant ships off; once an admin flips it on the org's seed set (manufacturing / hospitality / retail / healthcare / logistics / agency) becomes the starting catalog.",
          },
          {
            label: "Flag-off contract",
            body:
              "With the flag off the Custom Fields tab is hidden from Settings, every detail page renders without a custom-field section, and lists ship without custom-field filter chips. The underlying storage layer ignores the per-org seeds until the flag is re-enabled \u2014 nothing leaks into the standard schema.",
          },
        ],
      },
      {
        id: "dashboardCompliance",
        label: "Compliance tab on Home",
        summary:
          "Show the Compliance tab on the Home dashboard, alongside Overview, Inbox and Insights. Off by default — most managers don't need credentialing as a primary destination, and the full credentialing surface is always reachable from the side nav.",
        defaultOn: false,
        tips: [
          {
            label: "What changes when this is on",
            body:
              "A Compliance tab appears on Home, after Insights. It renders the same credentialing view as the standalone Compliance section in the side nav, with the unresolved-alert count as a tab badge.",
          },
          {
            label: "Audience",
            body:
              "Compliance / risk admins who spend most of their day in credentialing. For everyone else, leave it off and keep Home focused on the four standard tabs.",
          },
        ],
      },
    ],
  },
];

// ---------- Storage --------------------------------------------------
const FF_STORAGE_KEY = "flexwork.featureFlags";
const FF_EVENT = "featureflags:change";

// ---------- Axis flags + legacy derivation ---------------------------
//
// The v0.77 refactor replaces the legacy single-engagement-type flags
// with six axis-value flags. The legacy IDs (`professionalWork`, `sow`,
// `contractors`, `v77Axes`) are *derived* booleans, computed live from
// the axis flags below. Every existing consumer keeps reading the same
// key it always read \u2014 no per-page edits required \u2014 and gets the
// derived value. The `eor` ID is *both* a legacy flag and the new
// Supplier Type EOR axis: same key, one source of truth.
//
// AXIS_FLAG_IDS \u2014 the new tenant-controllable bits. Default off; all
// off = today's Frontline ship (Shift \u00d7 Clock In/Out \u00d7 Agency).
//
// LEGACY_FLAG_DERIVATIONS \u2014 mapping from legacy ID to a pure function
// over the axis-flag values. The functions encode the four cells the
// product shipped through v0.7:
//   \u00b7 Frontline    = Shift      \u00d7 Clock In/Out \u00d7 Agency (always on)
//   \u00b7 Professional = Assignment \u00d7 Timesheet    \u00d7 Agency
//   \u00b7 SOW          = Assignment \u00d7 Milestone    \u00d7 Agency
//   \u00b7 Contractor   = Assignment \u00d7 Timesheet    \u00d7 IC
// `v77Axes` derives to true whenever any axis-extending flag is on,
// because by definition the multi-axis affordances become meaningful.
// -----------------------------------------------------------------
const AXIS_FLAG_IDS = [
  "engAssignment",
  "engProject",
  "engStatementOfWork",
  "independentContractor",
  "eor",
];
const LEGACY_FLAG_IDS = [
  "professionalWork", "sow", "contractors", "v77Axes",
  // v0.78 \u2014 the per-billing-model flags are now derived from the
  // engagement-type flags above. Time Tracking (Timesheet) is enabled
  // by any Engagement Type that allows it; Milestone is enabled by
  // Project / Statement of Work; Fixed is enabled by Assignment /
  // Project. Storage values for these keys are stripped on first
  // run by the v0.78 migration below.
  "timesheets", "milestones", "fixedFee",
];
const LEGACY_FLAG_DERIVATIONS = {
  // ---- Engagement-Model derivations (v0.78) ----------------------
  // Time Tracking (a.k.a. Timesheet) is available on Assignment,
  // Project, and Statement of Work. Shift is Clock-in/out only.
  timesheets:       (f) => !!(f.engAssignment || f.engProject || f.engStatementOfWork),
  // Milestone billing belongs to Project and Statement of Work.
  milestones:       (f) => !!(f.engProject || f.engStatementOfWork),
  // Fixed billing belongs to Assignment and Project.
  fixedFee:         (f) => !!(f.engAssignment || f.engProject),
  // ---- Worker-type derivations (v0.77 legacy) --------------------
  // Professional = Assignment with Time Tracking + Agency
  professionalWork: (f) => !!f.engAssignment,
  // SOW = Statement of Work
  sow:              (f) => !!f.engStatementOfWork,
  // Contractor = Assignment + IC supplier
  contractors:      (f) => !!(f.engAssignment && f.independentContractor),
  // v77Axes = any axis-extending flag is on
  v77Axes:          (f) => !!(f.engAssignment || f.engProject || f.engStatementOfWork ||
                              f.independentContractor || f.eor),
};

function _ffRead() {
  try {
    const raw = window.localStorage.getItem(FF_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return (parsed && typeof parsed === "object") ? parsed : {};
  } catch (e) { return {}; }
}
function _ffWrite(map) {
  try { window.localStorage.setItem(FF_STORAGE_KEY, JSON.stringify(map)); }
  catch (e) { /* no-op */ }
}
function _ffDefaultFor(key) {
  for (const g of FEATURE_FLAG_GROUPS) {
    const f = g.flags.find((x) => x.id === key);
    if (f) return !!f.defaultOn;
  }
  return false;
}

function _ffExcludesFor(key) {
  for (const g of FEATURE_FLAG_GROUPS) {
    const f = g.flags.find((x) => x.id === key);
    if (f) return f.excludes || [];
  }
  return [];
}

// Build the axis-flag snapshot used by every legacy derivation. Reads
// straight from storage (no recursion through getFeatureFlag) so the
// derivation is cheap + cannot loop.
function _ffAxisSnapshot(map) {
  if (!map) map = _ffRead();
  const out = {};
  for (const k of AXIS_FLAG_IDS) {
    out[k] = Object.prototype.hasOwnProperty.call(map, k)
      ? !!map[k]
      : _ffDefaultFor(k);
  }
  return out;
}

function getFeatureFlag(key, fallback) {
  // Legacy ID? Derive from the live axis-flag snapshot, ignoring any
  // stored value for that key (the migration below strips them on first
  // run; this is the safety belt in case storage was hand-edited).
  if (Object.prototype.hasOwnProperty.call(LEGACY_FLAG_DERIVATIONS, key)) {
    return LEGACY_FLAG_DERIVATIONS[key](_ffAxisSnapshot());
  }
  const map = _ffRead();
  if (Object.prototype.hasOwnProperty.call(map, key)) return !!map[key];
  return (fallback !== undefined) ? !!fallback : _ffDefaultFor(key);
}

// How many worker-type cells are enabled for this tenant? Drives the
// AxisChipRow `variantCount <= 1` gate + the engagement-scope chip-bar
// visibility. Frontline is always on; every other axis-derived cell
// adds one.
function enabledWorkerTypeCount() {
  let n = 1; // Frontline (Shift \u00d7 Clock In/Out \u00d7 Agency)
  const f = _ffAxisSnapshot();
  // Each legacy cell adds 1 when its derivation lights up.
  if (LEGACY_FLAG_DERIVATIONS.professionalWork(f)) n++;
  if (LEGACY_FLAG_DERIVATIONS.sow(f))              n++;
  if (LEGACY_FLAG_DERIVATIONS.contractors(f))      n++;
  if (f.eor)                                       n++;
  return n;
}

function setFeatureFlag(key, value) {
  // Legacy IDs are derived \u2014 reject programmatic writes so the only
  // source of truth stays the axis-flag snapshot.
  if (Object.prototype.hasOwnProperty.call(LEGACY_FLAG_DERIVATIONS, key)) {
    if (typeof console !== "undefined") {
      console.warn(
        `[feature-flags] '${key}' is a derived legacy flag in v0.78 \u2014 ` +
        `set its underlying engagement-type / supplier-type flags instead ` +
        `(engAssignment, engProject, engStatementOfWork, independentContractor, eor).`
      );
    }
    return;
  }

  const map = _ffRead();
  // Snapshot legacy derivations BEFORE the write so we can broadcast
  // change events for any legacy ID whose value flipped as a side
  // effect of an axis-flag toggle.
  const legacyBefore = {};
  if (AXIS_FLAG_IDS.includes(key)) {
    const axesBefore = _ffAxisSnapshot(map);
    for (const lk of Object.keys(LEGACY_FLAG_DERIVATIONS)) {
      legacyBefore[lk] = LEGACY_FLAG_DERIVATIONS[lk](axesBefore);
    }
  }

  const turnedOff = [];
  // Mutual exclusivity: turning a flag ON switches off any flag it
  // declares in `excludes`. Enforced here (not just in the UI toggle)
  // so dev-console calls and programmatic toggles obey the rule too.
  if (value) {
    for (const otherKey of _ffExcludesFor(key)) {
      const isOn = Object.prototype.hasOwnProperty.call(map, otherKey)
        ? !!map[otherKey]
        : _ffDefaultFor(otherKey);
      if (isOn) {
        map[otherKey] = false;
        turnedOff.push(otherKey);
      }
    }
  }
  map[key] = !!value;
  _ffWrite(map);

  // Compute which legacy derivations flipped as a side effect.
  const legacyFlipped = [];
  if (AXIS_FLAG_IDS.includes(key)) {
    const axesAfter = _ffAxisSnapshot(map);
    for (const lk of Object.keys(LEGACY_FLAG_DERIVATIONS)) {
      const after = LEGACY_FLAG_DERIVATIONS[lk](axesAfter);
      if (after !== legacyBefore[lk]) legacyFlipped.push([lk, after]);
    }
  }

  try {
    // Fire change events for any flag that was switched off as a side
    // effect first, then the primary flag \u2014 so consumers settle into
    // the correct end state. Then fire for any legacy derivation that
    // flipped so existing useFeatureFlag('professionalWork') etc.
    // re-render in place without a reload.
    for (const k of turnedOff) {
      window.dispatchEvent(new CustomEvent(FF_EVENT, { detail: { key: k, value: false } }));
    }
    window.dispatchEvent(new CustomEvent(FF_EVENT, { detail: { key, value: !!value } }));
    for (const [lk, lv] of legacyFlipped) {
      window.dispatchEvent(new CustomEvent(FF_EVENT, { detail: { key: lk, value: lv } }));
    }
  } catch (e) { /* no-op */ }
}
function useFeatureFlag(key, fallback) {
  const [v, setV] = useFF(() => getFeatureFlag(key, fallback));
  useEFF(() => {
    function onChange(e) {
      if (!e || !e.detail || e.detail.key === key) {
        setV(getFeatureFlag(key, fallback));
      }
    }
    window.addEventListener(FF_EVENT, onChange);
    return () => window.removeEventListener(FF_EVENT, onChange);
  }, [key, fallback]);
  return v;
}

// ---------- Toggle (visual) ------------------------------------------
function FFToggle({ checked, onChange, label, disabled }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      className={"ff-switch" + (checked ? " is-on" : "")}
      onClick={() => onChange(!checked)}
    >
      <span className="ff-switch-track">
        <span className="ff-switch-thumb" />
      </span>
    </button>
  );
}

// ---------- Single flag row ------------------------------------------
function FFFlagRow({ flag, value, onChange, values }) {
  // Mutually-exclusive partner that's currently ON — show a small hint
  // under the row's summary so users know flipping this will swap them.
  const exclConflict = (flag.excludes || []).find((k) => values && values[k]);
  return (
    <li className={"ff-row" + (value ? " ff-row--on" : "")}>
      <div className="ff-row-main">
        <div className="ff-row-head">
          <h4 className="ff-row-title">{flag.label}</h4>
          <span className={"ff-state" + (value ? " ff-state--on" : "")}>
            {value ? "On" : "Off"}
          </span>
        </div>
        <p className="ff-row-sub">{flag.summary}</p>
        {exclConflict && !value && (
          <p className="ff-row-conflict">
            <Icon name="Alert" size={12} />
            <span>
              Enabling this will turn off <b>{(function () {
                for (const g of FEATURE_FLAG_GROUPS) {
                  const f = g.flags.find((x) => x.id === exclConflict);
                  if (f) return f.label;
                }
                return exclConflict;
              })()}</b> &mdash; the two anchor to the same header slot.
            </span>
          </p>
        )}

        {value && flag.tips && flag.tips.length > 0 && (
          <div className="ff-tips" role="region" aria-label={`${flag.label} — what's enabled`}>
            <div className="ff-tips-mark">
              <Icon name="Information" size={14} />
              <span>{flag.id === "dataModelAlignment" ? "How the data model is aligned" : flag.id === "contractors" ? "What you get when this is on" : flag.id === "professionalWork" ? "What Professional Work adds" : flag.id === "sow" ? "What SOW adds" : flag.id === "supplierFunding" ? "How Supplier Funding works" : flag.id === "salesTax" ? "How Sales Tax works across countries" : "What changes when this is on"}</span>
            </div>
            <dl className="ff-tips-list">
              {flag.tips.map((t, i) => (
                <div key={i} className="ff-tip">
                  <dt>{t.label}</dt>
                  <dd>{t.body}</dd>
                </div>
              ))}
            </dl>
            {flag.id === "dataModelAlignment" && (
            <div className="ff-tips-links">
              <a href="Flex Work Data Model.html" target="_blank" rel="noopener noreferrer">
                Open the Flex Work Data Model
              </a>
              <a href="data-model-alignment.html" target="_blank" rel="noopener noreferrer">
                View alignment recommendations
              </a>
            </div>
            )}
          </div>
        )}
      </div>
      <div className="ff-row-aside">
        <FFToggle
          checked={value}
          onChange={onChange}
          label={`${flag.label} — toggle`}
        />
      </div>
    </li>
  );
}

// ---------- Group block ----------------------------------------------
function FFGroup({ group, values, onToggle }) {
  return (
    <section className="ff-group" aria-labelledby={`ff-group-${group.id}`}>
      <header className="ff-group-head">
        <div className="ff-group-eyebrow">Source</div>
        <h3 id={`ff-group-${group.id}`} className="ff-group-title">
          {group.label}
        </h3>
        <p className="ff-group-sub">{group.summary}</p>
      </header>
      <ul className="ff-list" role="list">
        {group.flags.map((f) => (
          <FFFlagRow
            key={f.id}
            flag={f}
            value={!!values[f.id]}
            values={values}
            onChange={(v) => onToggle(f.id, v)}
          />
        ))}
      </ul>
    </section>
  );
}

// ---------- Page -----------------------------------------------------
function FeatureFlagsPage() {
  // Compute initial values from storage + defaults so the UI always
  // reflects the live state, even before the user has touched anything.
  const allFlags = useMFF(
    () => FEATURE_FLAG_GROUPS.flatMap((g) => g.flags.map((f) => ({ ...f, groupId: g.id }))),
    []
  );
  const [values, setValues] = useFF(() => {
    const out = {};
    for (const f of allFlags) out[f.id] = getFeatureFlag(f.id);
    return out;
  });

  // Listen for external changes (e.g. dev console) so the page stays in sync.
  useEFF(() => {
    function onChange() {
      const out = {};
      for (const f of allFlags) out[f.id] = getFeatureFlag(f.id);
      setValues(out);
    }
    window.addEventListener(FF_EVENT, onChange);
    return () => window.removeEventListener(FF_EVENT, onChange);
  }, [allFlags]);

  function _labelFor(key) {
    for (const g of FEATURE_FLAG_GROUPS) {
      const f = g.flags.find((x) => x.id === key);
      if (f) return f.label;
    }
    return key;
  }
  function _flagDef(key) {
    for (const g of FEATURE_FLAG_GROUPS) {
      const f = g.flags.find((x) => x.id === key);
      if (f) return f;
    }
    return null;
  }

  const toggle = useCFF((key, val) => {
    // setFeatureFlag enforces mutual exclusivity at the storage layer
    // (turning a flag ON switches off any flag listed in its `excludes`).
    // We mirror that here so the toast can name the partner that was
    // switched off, and so the UI state updates in one render.
    const turnedOff = [];
    if (val) {
      const def = _flagDef(key);
      const excludes = (def && def.excludes) || [];
      for (const otherKey of excludes) {
        if (getFeatureFlag(otherKey)) turnedOff.push(otherKey);
      }
    }
    setFeatureFlag(key, val);
    setValues((prev) => {
      const next = { ...prev, [key]: val };
      for (const k of turnedOff) next[k] = false;
      return next;
    });
    if (window.showToast) {
      if (turnedOff.length) {
        const otherLabel = _labelFor(turnedOff[0]);
        window.showToast(
          `${_labelFor(key)} enabled \u00b7 ${otherLabel} turned off`,
          { kind: "success" }
        );
      } else {
        window.showToast(`${_labelFor(key)} ${val ? "enabled" : "disabled"}`);
      }
    }
  }, []);

  return (
    <div className="set-content">
      <header className="set-content-header">
        <h2 className="set-content-title">Feature Flags</h2>
        <p className="set-content-sub">
          Pre-release capabilities you can turn on tenant-wide. Flags default to off; toggling one
          takes effect immediately for every user in this tenant.
        </p>
      </header>

      <div className="ff-shell">
        {FEATURE_FLAG_GROUPS
          .filter((g) => !g.hidden)
          // Agency-only groups (Agency Pro) render only on agency-kind
          // tenants. On enterprise buyer orgs they were always a no-op,
          // so we hide them entirely rather than offer a dead toggle.
          .filter((g) => !g.requiresAgency || (window.isAgencyOrg && window.isAgencyOrg()))
          .map((g) => (
            <FFGroup key={g.id} group={g} values={values} onToggle={toggle} />
          ))}
      </div>
    </div>
  );
}

// One-time migration: force VMS Education off so its persisted "on"
// state from earlier sessions doesn't override the code default.
// Bump the version string here to re-run for everyone.
(function _ffMigrateVmsEduOff() {
  const MIGRATION_KEY = "flexwork.featureFlags.migrations";
  const MIGRATION_ID = "vmsEducation-default-off-2026-05";
  try {
    const raw = window.localStorage.getItem(MIGRATION_KEY);
    const done = raw ? JSON.parse(raw) : {};
    if (done && done[MIGRATION_ID]) return;
    const map = _ffRead();
    if (map.vmsEducation) {
      map.vmsEducation = false;
      _ffWrite(map);
    }
    done[MIGRATION_ID] = true;
    window.localStorage.setItem(MIGRATION_KEY, JSON.stringify(done));
  } catch (e) { /* no-op */ }
})();

// One-time migration (v0.77): the legacy single-engagement-type flags
// (`professionalWork`, `sow`, `contractors`, `v77Axes`) are no longer
// stored as their own bits \u2014 they derive from the new axis flags.
// To preserve any prior user intent, fold each previously-on legacy
// flag into the equivalent axis-flag combination, then strip the
// legacy keys from storage so no stale value sits around.
(function _ffMigrateLegacyToAxes() {
  const MIGRATION_KEY = "flexwork.featureFlags.migrations";
  const MIGRATION_ID  = "legacy-to-axes-2026-05";
  try {
    const raw = window.localStorage.getItem(MIGRATION_KEY);
    const done = raw ? JSON.parse(raw) : {};
    if (done && done[MIGRATION_ID]) return;
    const map = _ffRead();
    let touched = false;
    function setAxis(k) { if (!map[k]) { map[k] = true; touched = true; } }
    // professionalWork = Timesheet \u00d7 Agency
    if (map.professionalWork === true) {
      setAxis("timesheets");
    }
    // sow = Milestone \u00d7 Agency
    if (map.sow === true) {
      setAxis("milestones");
    }
    // contractors = Timesheet \u00d7 IC
    if (map.contractors === true) {
      setAxis("timesheets"); setAxis("independentContractor");
    }
    // v77Axes was the chip-row gate \u2014 in the new model the chip row
    // derives from any axis flag being on; nothing to convert.

    // Strip the legacy keys from storage entirely (the getter ignores
    // them anyway, but a clean storage map prevents stale reads if a
    // future surface accidentally indexes the map directly).
    for (const lk of ["professionalWork", "sow", "contractors", "v77Axes"]) {
      if (Object.prototype.hasOwnProperty.call(map, lk)) {
        delete map[lk];
        touched = true;
      }
    }
    if (touched) _ffWrite(map);
    done[MIGRATION_ID] = true;
    window.localStorage.setItem(MIGRATION_KEY, JSON.stringify(done));
  } catch (e) { /* no-op */ }
})();

// One-time migration (v0.78): the per-billing-model flags
// (`timesheets`, `milestones`, `fixedFee`) are no longer stored as
// their own bits \u2014 they derive from the new engagement-type flags
// (`engAssignment`, `engProject`, `engStatementOfWork`). Fold any
// previously-on bit into the most natural engagement-type, then strip
// the legacy keys so the storage map stays clean.
(function _ffMigrateBillingModelToEngagementType() {
  const MIGRATION_KEY = "flexwork.featureFlags.migrations";
  const MIGRATION_ID  = "billing-model-to-engagement-type-2026-05";
  try {
    const raw = window.localStorage.getItem(MIGRATION_KEY);
    const done = raw ? JSON.parse(raw) : {};
    if (done && done[MIGRATION_ID]) return;
    const map = _ffRead();
    let touched = false;
    function setEng(k) { if (!map[k]) { map[k] = true; touched = true; } }
    // timesheets (Time Tracking) most naturally belongs to Assignment
    if (map.timesheets === true) setEng("engAssignment");
    // milestones belong to Statement of Work canonically
    if (map.milestones === true) setEng("engStatementOfWork");
    // fixedFee belongs to Assignment (retainer) canonically
    if (map.fixedFee === true)   setEng("engAssignment");
    // Strip the legacy keys from storage.
    for (const lk of ["timesheets", "milestones", "fixedFee"]) {
      if (Object.prototype.hasOwnProperty.call(map, lk)) {
        delete map[lk];
        touched = true;
      }
    }
    if (touched) _ffWrite(map);
    done[MIGRATION_ID] = true;
    window.localStorage.setItem(MIGRATION_KEY, JSON.stringify(done));
  } catch (e) { /* no-op */ }
})();

Object.assign(window, {
  getFeatureFlag,
  setFeatureFlag,
  useFeatureFlag,
  FeatureFlagsPage,
  FEATURE_FLAG_GROUPS,
  // v0.77 axis-flag helpers \u2014 exposed for the engagement-scope chip-bar,
  // the AxisChipRow / AxisScopeBar primitives, and any debug tooling.
  enabledWorkerTypeCount,
  AXIS_FLAG_IDS,
  LEGACY_FLAG_DERIVATIONS,
});
