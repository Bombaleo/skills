// =====================================================================
// Flex Work — Custom Fields Configuration (per-org storage + seeds)
//
// v0.85 — Settings → Custom Fields. The customFields capability is
// gated by a tenant feature flag (FF id: "customFields") that defaults
// off everywhere except Helios Power Generation. The seed catalog
// below ships realistic-looking custom fields for every industry pack
// so an admin who flips the flag on for their tenant lands on a
// pre-populated surface that reflects their domain (Helios drills into
// outage windows / NERC CIP / radiation clearance; Mercy → BLS expiry
// + HIPAA training; Fleetwind → CDL class + DOT med card; etc.).
//
// Storage layout
//   · `flexwork.customFields.{orgId}` — array of field defs (this file
//     seeds it the first time the org's slot is read).
//   · `flexwork.featureFlags.customFields` — mirrored boolean. Helios
//     ships true on first load; every other org ships false. The
//     consumer (settings.jsx + app.jsx) reads the FF to decide whether
//     to surface the Custom Fields tab in the Settings dock.
//
// Public API (window.*)
//   · getCustomFields(orgId?)      → CustomField[]
//   · setCustomFields(orgId, list) → void (persists + fires event)
//   · addCustomField(field)        → CustomField (with id)
//   · updateCustomField(id, patch) → CustomField | null
//   · removeCustomField(id)        → boolean
//   · CUSTOM_FIELD_OBJECTS         → object-type catalog
//   · CUSTOM_FIELD_TYPES           → field-type catalog
//   · CUSTOM_FIELD_EVENT           → "customfields:change" event name
//
// Load order — AFTER industry.jsx + feature-flags.jsx, BEFORE
// pages/custom-fields.jsx + pages/settings.jsx (consumers).
// =====================================================================

(function () {
  const STORE_PREFIX = "flexwork.customFields.";
  const EVT          = "customfields:change";
  const FF_KEY       = "customFields";

  // -----------------------------------------------------------------
  // Object types — every place a custom field can attach. The list is
  // the universe Fieldglass calls "Module" and Vndly calls "Entity".
  // -----------------------------------------------------------------
  const CUSTOM_FIELD_OBJECTS = [
    { id: "requisition", label: "Requisition",       icon: "Notes",
      hint: "Open positions buyers submit to suppliers and pools." },
    { id: "worker",      label: "Worker",            icon: "Person",
      hint: "Every person on the contingent workforce — agency, IC, EOR, float." },
    { id: "engagement",  label: "Engagement",        icon: "ClipboardPerson",
      hint: "The contract record that connects a worker to a requisition." },
    { id: "timesheet",   label: "Timesheet",         icon: "PersonClock",
      hint: "Submitted period log — Clock-in/out punches or Timesheet entries." },
    { id: "invoice",     label: "Invoice",           icon: "Wallet",
      hint: "Supplier-submitted or system-derived A/P invoice." },
    { id: "supplier",    label: "Supplier",          icon: "Building",
      hint: "Staffing supplier, IC, or EOR partner." },
    { id: "sow",         label: "Statement of Work", icon: "EngagementSow",
      hint: "MSA-anchored SOW with deliverables + milestone fees." },
    { id: "project",     label: "Project",           icon: "EngagementProject",
      hint: "Supplier-led delivery against a project budget." },
    { id: "candidate",   label: "Candidate",         icon: "PersonSearch",
      hint: "A worker submitted against a requisition before placement." },
    { id: "location",    label: "Location",          icon: "Location",
      hint: "Org unit / site / cost-bearing location." },
  ];

  // -----------------------------------------------------------------
  // Field types — the input affordance + storage shape.
  // -----------------------------------------------------------------
  const CUSTOM_FIELD_TYPES = [
    { id: "text",        label: "Short text",          icon: "Edit" },
    { id: "longtext",    label: "Long text",           icon: "Notes" },
    { id: "number",      label: "Number",              icon: "BarChart" },
    { id: "currency",    label: "Currency",            icon: "Pay" },
    { id: "date",        label: "Date",                icon: "Calendar" },
    { id: "daterange",   label: "Date range",          icon: "Calendar" },
    { id: "boolean",     label: "Yes / No",            icon: "Check" },
    { id: "dropdown",    label: "Pick list",           icon: "ChevronDown" },
    { id: "multiselect", label: "Multi-select",        icon: "Stack" },
    { id: "cascade",     label: "Cascading pick list", icon: "OrgChartVert" },
    { id: "costcode",    label: "Cost code",           icon: "MoneyBag" },
    { id: "person",      label: "Person reference",    icon: "Person" },
    { id: "url",         label: "URL / link",          icon: "Link" },
  ];

  // -----------------------------------------------------------------
  // Visibility scopes — who sees / edits the field. Mirrors the
  // Fieldglass "Entered By" + role visibility controls.
  // -----------------------------------------------------------------
  const VISIBILITY_SCOPES = [
    { id: "internal",         label: "Buyer admin only",    desc: "Hidden from hiring managers, suppliers, workers." },
    { id: "buyer",            label: "Buyer",               desc: "Hiring managers + admins. Suppliers and workers do not see this field." },
    { id: "buyer+supplier",   label: "Buyer + Supplier",    desc: "Suppliers see the value on submitted candidates / invoices and can write where allowed." },
    { id: "buyer+worker",     label: "Buyer + Worker",      desc: "Surfaces on the worker app — the worker fills it in on profile / timesheet." },
    { id: "everyone",         label: "Buyer + Supplier + Worker", desc: "All three roles read; write-access controlled per role." },
  ];

  // -----------------------------------------------------------------
  // Per-org seed catalog. Each entry becomes the initial list when an
  // org is first read. Keep these realistic — they're what an admin
  // sees the first time they open the page.
  // -----------------------------------------------------------------
  function _heliosSeed() {
    return [
      // ---- Requisition (Helios) ------------------------------------
      { objectType: "requisition", label: "Outage window",
        key: "outageWindow", type: "daterange",
        section: "Scheduling", required: true, requiredFor: ["activate"],
        visibility: "buyer+supplier",
        help: "Planned outage start / end. Drives shift staging and gates field-tech onboarding.",
        conditional: { field: "engagementType", op: "in", value: ["Project", "Shift"] },
        usage: ["Approval routing", "Worker matching", "Reports"],
        syncTo: "dayforce", piiFlag: false, status: "active",
        updatedAt: "2026-04-18", updatedBy: "Mateo Reyes",
        applies: 318 },
      { objectType: "requisition", label: "NERC CIP tier",
        key: "nercCipTier", type: "dropdown",
        options: ["Low impact", "Medium impact", "High impact"],
        section: "Compliance", required: true,
        visibility: "buyer+supplier",
        help: "Bulk Electric System impact rating per NERC CIP-002. Routes approval to the Cyber & Physical Security team for Medium / High.",
        usage: ["Approval routing", "Worker matching"],
        syncTo: null, piiFlag: false, status: "active",
        updatedAt: "2026-03-02", updatedBy: "Aanya Sharma",
        applies: 412 },
      { objectType: "requisition", label: "Plant unit",
        key: "plantUnit", type: "cascade",
        options: [
          { label: "Generating Station A", children: ["Unit 1", "Unit 2", "Unit 3"] },
          { label: "Generating Station B", children: ["Unit 1", "Unit 2"] },
          { label: "Generating Station C", children: ["Unit 1", "Unit 2", "Unit 3", "Unit 4"] },
          { label: "Substation North",     children: ["Bay 1", "Bay 2"] },
        ],
        section: "Overview", required: true,
        visibility: "buyer+supplier",
        help: "Station → Unit. Drives access provisioning and cost-center allocation.",
        usage: ["Reports", "Cost allocation", "Integrations"],
        syncTo: "dayforce", piiFlag: false, status: "active",
        updatedAt: "2026-04-01", updatedBy: "Mateo Reyes",
        applies: 412 },
      { objectType: "requisition", label: "Capital project code",
        key: "capProjectCode", type: "text",
        validation: { pattern: "^CAP-\\d{5}$", patternHint: "CAP-#####" },
        section: "Finance", required: true,
        requiredFor: ["activate"],
        visibility: "buyer",
        help: "Treasury capital project ID. Validates the requisition rolls into a funded CIP.",
        conditional: { field: "engagementType", op: "eq", value: "Project" },
        usage: ["Reports", "Integrations"],
        syncTo: "sap-erp", piiFlag: false, status: "active",
        updatedAt: "2026-02-14", updatedBy: "Priya Anand",
        applies: 178 },
      { objectType: "requisition", label: "Confined space required",
        key: "confinedSpace", type: "boolean",
        section: "Compliance", required: false,
        visibility: "buyer+supplier",
        help: "Filters worker pool to OSHA 1910.146-compliant techs.",
        usage: ["Worker matching"],
        syncTo: null, piiFlag: false, status: "active",
        updatedAt: "2025-11-19", updatedBy: "Tom Whitfield",
        applies: 412 },

      // ---- Worker (Helios) -----------------------------------------
      { objectType: "worker", label: "Radiation worker cleared",
        key: "rwCleared", type: "boolean",
        section: "Compliance", required: false,
        visibility: "internal",
        help: "Internal-only flag set by Safety Office after Part 20 dosimetry training. Gates assignment to Reactor Yard requisitions.",
        usage: ["Worker matching", "Compliance hub"],
        syncTo: null, piiFlag: false, status: "active",
        updatedAt: "2026-01-10", updatedBy: "Safety Office",
        applies: 1240 },
      { objectType: "worker", label: "HAZWOPER 40 expiry",
        key: "hazwoper40Expiry", type: "date",
        section: "Compliance", required: false,
        visibility: "buyer+supplier",
        help: "OSHA 1910.120 24/40-hour HAZWOPER refresher. Workers within 30 days of expiry are surfaced on the Compliance hub.",
        validation: { futureOnly: false },
        usage: ["Compliance hub", "Expiry alerts", "Worker matching"],
        syncTo: "dayforce", piiFlag: false, status: "active",
        updatedAt: "2026-05-04", updatedBy: "Aanya Sharma",
        applies: 1240 },
      { objectType: "worker", label: "Security clearance level",
        key: "secClearance", type: "dropdown",
        options: ["None", "Public Trust", "Secret", "Top Secret"],
        section: "Compliance", required: false,
        visibility: "internal",
        help: "Internal HR-set clearance level. Filtered into requisition matching when the requisition's NERC CIP tier is High Impact.",
        usage: ["Worker matching"],
        syncTo: "dayforce", piiFlag: true, status: "active",
        updatedAt: "2026-02-21", updatedBy: "Security Office",
        applies: 1240 },
      { objectType: "worker", label: "Preferred shift swap partner",
        key: "preferredSwap", type: "person",
        section: "Scheduling", required: false,
        visibility: "buyer+worker",
        help: "Worker-supplied. Surfaced when scheduling proposes a swap.",
        usage: ["Schedule console"],
        syncTo: null, piiFlag: false, status: "active",
        updatedAt: "2025-09-12", updatedBy: "Mateo Reyes",
        applies: 1240 },

      // ---- Timesheet (Helios) --------------------------------------
      { objectType: "timesheet", label: "Outage ID",
        key: "outageId", type: "text",
        validation: { pattern: "^OUT-\\d{4}$", patternHint: "OUT-####" },
        section: "Allocation", required: true, requiredFor: ["submit"],
        visibility: "buyer+supplier+worker",
        help: "Tags timesheet hours to a planned-outage cost pool. Required to submit when the engagement's outage window is set.",
        usage: ["Cost allocation", "Reports"],
        syncTo: "dayforce", piiFlag: false, status: "active",
        updatedAt: "2026-03-29", updatedBy: "Priya Anand",
        applies: 880 },
      { objectType: "timesheet", label: "JHA complete",
        key: "jhaComplete", type: "boolean",
        section: "Compliance", required: true, requiredFor: ["submit"],
        visibility: "buyer+worker",
        help: "Worker certifies Job Hazard Analysis was reviewed before the shift. Blocks submit when false.",
        usage: ["Approval routing", "Compliance hub"],
        syncTo: null, piiFlag: false, status: "active",
        updatedAt: "2026-04-22", updatedBy: "Tom Whitfield",
        applies: 880 },

      // ---- SOW (Helios) --------------------------------------------
      { objectType: "sow", label: "Capital vs O&M",
        key: "capOrOM", type: "dropdown",
        options: ["Capital (CIP)", "Operations & Maintenance"],
        section: "Finance", required: true,
        visibility: "buyer",
        help: "Routes milestone invoices to the correct GL bucket. Capital → CWIP; O&M → expense.",
        usage: ["GL routing", "Reports", "Integrations"],
        syncTo: "sap-erp", piiFlag: false, status: "active",
        updatedAt: "2026-01-30", updatedBy: "Priya Anand",
        applies: 42 },
      { objectType: "sow", label: "FERC recoverable",
        key: "fercRecoverable", type: "boolean",
        section: "Finance", required: false,
        visibility: "buyer",
        help: "Marks SOW spend as recoverable under the next FERC rate case.",
        usage: ["Reports"],
        syncTo: null, piiFlag: false, status: "active",
        updatedAt: "2025-12-08", updatedBy: "Priya Anand",
        applies: 42 },

      // ---- Invoice (Helios) ----------------------------------------
      { objectType: "invoice", label: "Buyer PO line",
        key: "poLine", type: "text",
        validation: { pattern: "^PO-\\d{7}-\\d{2}$", patternHint: "PO-#######-##" },
        section: "Finance", required: true, requiredFor: ["submit"],
        visibility: "buyer+supplier",
        help: "Matches the invoice to the line on the buyer-side blanket PO. Supplier-entered.",
        usage: ["A/P matching", "Reports", "Integrations"],
        syncTo: "sap-erp", piiFlag: false, status: "active",
        updatedAt: "2026-04-02", updatedBy: "Priya Anand",
        applies: 2840 },
      { objectType: "invoice", label: "Capitalization bucket",
        key: "capBucket", type: "dropdown",
        options: ["Land", "Plant & equipment", "Software", "Intangibles", "N/A"],
        section: "Finance", required: false,
        visibility: "buyer",
        help: "Buyer-side accounting tag for CWIP-flagged invoices. Defaults from the SOW's capOrOM.",
        defaultValueFrom: "sow.capBucket",
        usage: ["GL routing", "Reports"],
        syncTo: "sap-erp", piiFlag: false, status: "active",
        updatedAt: "2026-02-18", updatedBy: "Priya Anand",
        applies: 1180 },

      // ---- Supplier (Helios) ---------------------------------------
      { objectType: "supplier", label: "OFAC / sanctions screened",
        key: "ofacScreened", type: "date",
        section: "Compliance", required: true,
        visibility: "buyer",
        help: "Most-recent OFAC + EU consolidated list screening date. Required to keep the supplier active.",
        usage: ["Compliance hub", "Expiry alerts"],
        syncTo: null, piiFlag: false, status: "active",
        updatedAt: "2026-05-11", updatedBy: "Legal Ops",
        applies: 184 },
      { objectType: "supplier", label: "Cyber-security tier",
        key: "cyberTier", type: "dropdown",
        options: ["Tier 1 (BES-touching)", "Tier 2 (Plant network)", "Tier 3 (Corporate only)"],
        section: "Compliance", required: true,
        visibility: "buyer",
        help: "Determines which NERC CIP-tagged requisitions the supplier may receive.",
        usage: ["Distribution", "Approval routing"],
        syncTo: null, piiFlag: false, status: "active",
        updatedAt: "2026-02-04", updatedBy: "Cybersecurity",
        applies: 184 },
    ];
  }

  function _atlasSeed() {
    return [
      { objectType: "worker", label: "Forklift cert class",
        key: "forkliftClass", type: "dropdown",
        options: ["Class I — electric rider", "Class II — narrow aisle", "Class IV — cushion", "Class VII — rough terrain"],
        section: "Compliance", required: false,
        visibility: "buyer+supplier",
        help: "OSHA 1910.178 class certification. Drives Heavy Equipment Operator matching.",
        usage: ["Worker matching"],
        syncTo: "dayforce", piiFlag: false, status: "active",
        updatedAt: "2025-10-08", updatedBy: "Plant Operations",
        applies: 642 },
      { objectType: "worker", label: "Safety card number",
        key: "safetyCard", type: "text",
        section: "Compliance", required: false,
        visibility: "buyer+supplier",
        help: "Issued at site orientation. Printed on the worker's badge.",
        usage: ["Reports"],
        syncTo: null, piiFlag: false, status: "active",
        updatedAt: "2025-08-22", updatedBy: "Plant Operations",
        applies: 642 },
      { objectType: "requisition", label: "Plant cost center",
        key: "plantCostCenter", type: "text",
        section: "Finance", required: true,
        visibility: "buyer",
        help: "ERP cost center. Validates against the GL master.",
        usage: ["Integrations"],
        syncTo: "sap-erp", piiFlag: false, status: "active",
        updatedAt: "2025-11-14", updatedBy: "FP&A",
        applies: 96 },
      { objectType: "requisition", label: "Shift differential code",
        key: "shiftDiffCode", type: "dropdown",
        options: ["1st shift — none", "2nd shift +$1.25", "3rd shift +$2.00", "Weekend +$1.75"],
        section: "Compensation", required: false,
        visibility: "buyer+supplier",
        help: "Hard-codes the differential applied to the supplier's bill rate.",
        usage: ["Pricing"],
        syncTo: null, piiFlag: false, status: "active",
        updatedAt: "2025-09-30", updatedBy: "FP&A",
        applies: 96 },
    ];
  }

  function _auroraSeed() {
    return [
      { objectType: "requisition", label: "Property brand",
        key: "propertyBrand", type: "dropdown",
        options: ["Aurora Premier", "Aurora Boutique", "Aurora Express"],
        section: "Overview", required: true,
        visibility: "buyer+supplier",
        help: "Sets brand-standard training requirements and uniform allowance.",
        usage: ["Worker matching", "Reports"],
        syncTo: null, piiFlag: false, status: "active",
        updatedAt: "2025-12-15", updatedBy: "Brand Ops",
        applies: 88 },
      { objectType: "requisition", label: "Service segment",
        key: "serviceSegment", type: "dropdown",
        options: ["Rooms", "Food & beverage", "Banquet & events", "Concierge"],
        section: "Overview", required: true,
        visibility: "buyer+supplier",
        help: "Bucket for spend reporting and labor mix targets.",
        usage: ["Reports"],
        syncTo: null, piiFlag: false, status: "active",
        updatedAt: "2026-01-19", updatedBy: "Brand Ops",
        applies: 88 },
      { objectType: "worker", label: "F&B service cert",
        key: "fbServiceCert", type: "date",
        section: "Compliance", required: false,
        visibility: "buyer+supplier",
        help: "TIPS / ServSafe expiry. Required for banquet-server placements.",
        usage: ["Worker matching", "Expiry alerts"],
        syncTo: "dayforce", piiFlag: false, status: "active",
        updatedAt: "2025-11-02", updatedBy: "Brand Ops",
        applies: 410 },
      { objectType: "worker", label: "Brand-standard trained",
        key: "brandStdTrained", type: "boolean",
        section: "Compliance", required: false,
        visibility: "buyer+supplier",
        help: "Has completed the Aurora property brand training module.",
        usage: ["Worker matching"],
        syncTo: null, piiFlag: false, status: "active",
        updatedAt: "2025-10-26", updatedBy: "Brand Ops",
        applies: 410 },
    ];
  }

  function _northwindSeed() {
    return [
      { objectType: "requisition", label: "Store class",
        key: "storeClass", type: "dropdown",
        options: ["Flagship", "Standard", "Express", "Outlet"],
        section: "Overview", required: true,
        visibility: "buyer+supplier",
        help: "Drives bill rate tier from the rate card.",
        usage: ["Pricing", "Reports"],
        syncTo: null, piiFlag: false, status: "active",
        updatedAt: "2026-02-05", updatedBy: "Store Ops",
        applies: 312 },
      { objectType: "requisition", label: "Holiday surge",
        key: "holidaySurge", type: "boolean",
        section: "Scheduling", required: false,
        visibility: "buyer+supplier",
        help: "Marks the requisition as holiday-coverage. Eligible for surge bill rate.",
        usage: ["Pricing"],
        syncTo: null, piiFlag: false, status: "active",
        updatedAt: "2025-10-18", updatedBy: "Store Ops",
        applies: 312 },
      { objectType: "worker", label: "POS trained",
        key: "posTrained", type: "boolean",
        section: "Compliance", required: false,
        visibility: "buyer+supplier",
        help: "Cleared on the Northwind POS module in Dayforce Learning.",
        usage: ["Worker matching"],
        syncTo: "dayforce", piiFlag: false, status: "active",
        updatedAt: "2025-09-08", updatedBy: "Learning",
        applies: 920 },
    ];
  }

  function _mercySeed() {
    return [
      { objectType: "worker", label: "BLS expiry",
        key: "blsExpiry", type: "date",
        section: "Compliance", required: true,
        visibility: "buyer+supplier",
        help: "Basic Life Support certification expiry. Tracked on the Compliance hub.",
        usage: ["Worker matching", "Compliance hub", "Expiry alerts"],
        syncTo: "dayforce", piiFlag: false, status: "active",
        updatedAt: "2026-04-30", updatedBy: "Credentialing",
        applies: 1860 },
      { objectType: "worker", label: "Vaccination status",
        key: "vaxStatus", type: "dropdown",
        options: ["Fully vaccinated", "Partially vaccinated", "Medical exemption", "Religious exemption"],
        section: "Compliance", required: true,
        visibility: "internal",
        help: "HIPAA-restricted. Surfaces only to Credentialing.",
        usage: ["Compliance hub"],
        syncTo: null, piiFlag: true, status: "active",
        updatedAt: "2026-03-12", updatedBy: "Credentialing",
        applies: 1860 },
      { objectType: "worker", label: "HIPAA training date",
        key: "hipaaDate", type: "date",
        section: "Compliance", required: true,
        visibility: "internal",
        help: "Last completion of HIPAA privacy module. Expires after 365 days.",
        usage: ["Compliance hub", "Expiry alerts"],
        syncTo: "dayforce", piiFlag: false, status: "active",
        updatedAt: "2026-04-30", updatedBy: "Credentialing",
        applies: 1860 },
      { objectType: "requisition", label: "Unit type",
        key: "unitType", type: "dropdown",
        options: ["Med-Surg", "Telemetry", "ICU", "ED", "OR", "PACU", "Float"],
        section: "Overview", required: true,
        visibility: "buyer+supplier",
        help: "Hospital unit. Drives skill-mix matching.",
        usage: ["Worker matching", "Reports"],
        syncTo: "dayforce", piiFlag: false, status: "active",
        updatedAt: "2026-01-08", updatedBy: "Nurse Staffing",
        applies: 244 },
      { objectType: "requisition", label: "Charge RN required",
        key: "chargeRN", type: "boolean",
        section: "Scheduling", required: false,
        visibility: "buyer+supplier",
        help: "Filters to nurses with charge-nurse experience.",
        usage: ["Worker matching"],
        syncTo: null, piiFlag: false, status: "active",
        updatedAt: "2025-12-02", updatedBy: "Nurse Staffing",
        applies: 244 },
    ];
  }

  function _fleetwindSeed() {
    return [
      { objectType: "worker", label: "CDL class",
        key: "cdlClass", type: "dropdown",
        options: ["None", "Class A", "Class B", "Class C"],
        section: "Compliance", required: false,
        visibility: "buyer+supplier",
        help: "USDOT commercial driver's license class.",
        usage: ["Worker matching"],
        syncTo: "dayforce", piiFlag: false, status: "active",
        updatedAt: "2026-03-05", updatedBy: "Safety",
        applies: 580 },
      { objectType: "worker", label: "DOT med card expiry",
        key: "dotMedExpiry", type: "date",
        section: "Compliance", required: false,
        visibility: "buyer+supplier",
        help: "DOT medical examiner's certificate expiry.",
        usage: ["Compliance hub", "Expiry alerts"],
        syncTo: "dayforce", piiFlag: false, status: "active",
        updatedAt: "2026-02-18", updatedBy: "Safety",
        applies: 580 },
      { objectType: "worker", label: "TWIC cleared",
        key: "twicCleared", type: "boolean",
        section: "Compliance", required: false,
        visibility: "buyer",
        help: "Transportation Worker Identification Credential. Required for port-adjacent hubs.",
        usage: ["Worker matching"],
        syncTo: null, piiFlag: false, status: "active",
        updatedAt: "2025-11-21", updatedBy: "Safety",
        applies: 580 },
      { objectType: "requisition", label: "Load type",
        key: "loadType", type: "dropdown",
        options: ["Dry van", "Reefer", "Flatbed", "Tanker", "Intermodal"],
        section: "Overview", required: false,
        visibility: "buyer+supplier",
        help: "Equipment class. Filters worker pool by endorsement.",
        usage: ["Worker matching"],
        syncTo: null, piiFlag: false, status: "active",
        updatedAt: "2026-01-12", updatedBy: "Hub Ops",
        applies: 156 },
    ];
  }

  function _staffwiseSeed() {
    return [
      { objectType: "worker", label: "Internal recruiter",
        key: "internalRecruiter", type: "person",
        section: "Overview", required: false,
        visibility: "internal",
        help: "Agency-side owner. Drives the worker into that recruiter's pipeline view.",
        usage: ["Reports"],
        syncTo: null, piiFlag: false, status: "active",
        updatedAt: "2026-02-09", updatedBy: "Recruiting Ops",
        applies: 420 },
      { objectType: "worker", label: "Onboarding cohort",
        key: "onboardingCohort", type: "text",
        section: "Overview", required: false,
        visibility: "internal",
        help: "Free-form cohort tag — e.g. \"2026 Q2 Logistics\".",
        usage: ["Reports"],
        syncTo: null, piiFlag: false, status: "active",
        updatedAt: "2026-04-04", updatedBy: "Recruiting Ops",
        applies: 420 },
      { objectType: "engagement", label: "Buyer-side PO",
        key: "buyerPO", type: "text",
        section: "Finance", required: true, requiredFor: ["activate"],
        visibility: "buyer+supplier",
        help: "PO the buyer's A/P references on the supplier invoice.",
        usage: ["A/P matching", "Reports"],
        syncTo: null, piiFlag: false, status: "active",
        updatedAt: "2026-01-22", updatedBy: "Operations",
        applies: 96 },
    ];
  }

  const SEEDS = {
    energy:        _heliosSeed,
    manufacturing: _atlasSeed,
    hospitality:   _auroraSeed,
    retail:        _northwindSeed,
    healthcare:    _mercySeed,
    logistics:     _fleetwindSeed,
    staffwise:     _staffwiseSeed,
  };

  // -----------------------------------------------------------------
  // Storage
  // -----------------------------------------------------------------
  function _orgId() {
    return (window.getCurrentIndustryId && window.getCurrentIndustryId()) || "manufacturing";
  }

  function _seedFor(orgId) {
    const fn = SEEDS[orgId] || _atlasSeed;
    const list = fn();
    // Inject deterministic IDs so the list survives reload + edits.
    return list.map((f, i) => Object.assign({ id: `cf_${orgId}_${String(i + 1).padStart(3, "0")}` }, f));
  }

  function _read(orgId) {
    try {
      const raw = window.localStorage.getItem(STORE_PREFIX + orgId);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) { /* no-op */ }
    return null;
  }

  function _write(orgId, list) {
    try { window.localStorage.setItem(STORE_PREFIX + orgId, JSON.stringify(list)); }
    catch (e) { /* no-op */ }
  }

  function _emit(detail) {
    try { window.dispatchEvent(new CustomEvent(EVT, { detail: detail || {} })); }
    catch (e) { /* no-op */ }
  }

  function getCustomFields(orgId) {
    const id = orgId || _orgId();
    const cached = _read(id);
    if (cached) return cached;
    // First read for this org → seed + persist.
    const seeded = _seedFor(id);
    _write(id, seeded);
    return seeded;
  }

  function setCustomFields(orgId, list) {
    const id = orgId || _orgId();
    _write(id, list);
    _emit({ orgId: id });
  }

  function _genId(orgId) {
    return `cf_${orgId}_${Date.now().toString(36)}`;
  }

  function addCustomField(field) {
    const id = _orgId();
    const list = getCustomFields(id).slice();
    const next = Object.assign({}, field, {
      id:       field.id || _genId(id),
      status:   field.status || "active",
      updatedAt: field.updatedAt || new Date().toISOString().slice(0, 10),
      applies:  field.applies || 0,
    });
    list.unshift(next);
    _write(id, list);
    _emit({ orgId: id, added: next.id });
    return next;
  }

  function updateCustomField(fieldId, patch) {
    const id = _orgId();
    const list = getCustomFields(id).slice();
    const ix = list.findIndex((f) => f.id === fieldId);
    if (ix === -1) return null;
    list[ix] = Object.assign({}, list[ix], patch, {
      updatedAt: new Date().toISOString().slice(0, 10),
    });
    _write(id, list);
    _emit({ orgId: id, updated: fieldId });
    return list[ix];
  }

  function removeCustomField(fieldId) {
    const id = _orgId();
    const list = getCustomFields(id).slice();
    const next = list.filter((f) => f.id !== fieldId);
    if (next.length === list.length) return false;
    _write(id, next);
    _emit({ orgId: id, removed: fieldId });
    return true;
  }

  // -----------------------------------------------------------------
  // Feature flag sync
  //
  // The customFields capability is gated by a tenant feature flag.
  // Helios Power Generation (energy) ships with the flag ON; every
  // other org defaults OFF. The setting in localStorage wins over the
  // org default once the user has explicitly toggled it (the FF
  // storage retains the user's choice).
  // -----------------------------------------------------------------
  function _ffMap() {
    try {
      const raw = window.localStorage.getItem("flexwork.featureFlags");
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      return (parsed && typeof parsed === "object") ? parsed : {};
    } catch (e) { return {}; }
  }
  function _writeFF(map) {
    try { window.localStorage.setItem("flexwork.featureFlags", JSON.stringify(map)); }
    catch (e) { /* no-op */ }
  }

  function syncFlagForCurrentOrg() {
    const id = _orgId();
    const map = _ffMap();
    // If the user has explicitly written this key (true or false), leave
    // it alone — their choice wins over the per-org default.
    const PER_ORG_KEY = "flexwork.customFields.flagAdopted";
    let adopted = {};
    try { adopted = JSON.parse(window.localStorage.getItem(PER_ORG_KEY) || "{}") || {}; }
    catch (e) { adopted = {}; }

    if (adopted[id]) return;  // Already adopted/synced for this org.

    // First time we see this org → set the flag to the per-org default.
    const def = (id === "energy");
    map[FF_KEY] = def;
    _writeFF(map);
    adopted[id] = true;
    try { window.localStorage.setItem(PER_ORG_KEY, JSON.stringify(adopted)); }
    catch (e) { /* no-op */ }

    try {
      window.dispatchEvent(new CustomEvent("featureflags:change", {
        detail: { key: FF_KEY, value: def },
      }));
    } catch (e) { /* no-op */ }
  }

  syncFlagForCurrentOrg();

  // Patch setCurrentIndustryId so org-switching re-runs the sync. The
  // login flow triggers a full reload too, so this mostly matters for
  // dev-console org swaps.
  const _origSetOrg = window.setCurrentIndustryId;
  if (typeof _origSetOrg === "function") {
    window.setCurrentIndustryId = function (id) {
      _origSetOrg(id);
      syncFlagForCurrentOrg();
    };
  }

  Object.assign(window, {
    getCustomFields,
    setCustomFields,
    addCustomField,
    updateCustomField,
    removeCustomField,
    CUSTOM_FIELD_OBJECTS,
    CUSTOM_FIELD_TYPES,
    CUSTOM_FIELD_VISIBILITY: VISIBILITY_SCOPES,
    CUSTOM_FIELD_EVENT: EVT,
    CUSTOM_FIELD_FF_KEY: FF_KEY,
  });
})();
