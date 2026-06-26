// =====================================================================
// Flex Work — Policies settings
//   · PoliciesSettingsPage — list + KPIs + filter chips + master table
//   · PolicyDetailPanel    — wide side panel; full read view w/ summary,
//                             scope, rules, enforcement, ack roll-up,
//                             documents, change history
//   · PolicyCreatePanel    — two-step wizard: pick a policy type, then
//                             fill the type-shaped form
//
// Persists in window.__policyStore so navigation away and back keeps
// edits. Mirrors the patterns used by budgets.jsx & pricing-config.jsx.
// =====================================================================

const { useState: usePol, useMemo: useMemoPol, useEffect: useEffectPol } = React;

// ---------- Type catalog -----------------------------------------------
// Each type owns: a label, the Everest icon, a hue used for the accent
// pill, and a schema of "rules" that the form panel knows how to render.
// Schema kinds: text · select · multi · number · toggle · textarea
const POL_TYPES = [
  {
    id: "attire", label: "Attire", icon: "Bag", hue: "purple",
    blurb: "Dress code, uniforms, PPE",
    schema: [
      { key: "uniform",   label: "Uniform / scrub spec",    kind: "text",     placeholder: "e.g. Royal blue scrubs · color-coded by unit" },
      { key: "footwear",  label: "Footwear",                kind: "text",     placeholder: "Closed-toe, slip-resistant" },
      { key: "hair",      label: "Hair",                    kind: "text",     placeholder: "Tied back, no shoulder-length loose hair" },
      { key: "nails",     label: "Nails",                   kind: "text",     placeholder: "Natural or short polish; no acrylics" },
      { key: "jewelry",   label: "Jewelry",                 kind: "text",     placeholder: "Wedding band only" },
      { key: "fragrance", label: "Fragrance",               kind: "select",   options: ["Permitted", "Discouraged", "Prohibited"] },
      { key: "vendor",    label: "Issued by",               kind: "select",   options: ["Facility-issued", "Worker-provided", "Stipend reimbursed"] },
    ],
  },
  {
    id: "certifications", label: "Certifications", icon: "ShieldPerson", hue: "blue",
    blurb: "Licenses, cards, registrations",
    schema: [
      { key: "credential",    label: "Credential",          kind: "select",   options: ["RN license","BLS","ACLS","PALS","OSHA-10","OSHA-30","ServSafe Mgr","Forklift (Class IV)","TWIC","Bloodborne pathogens","Driver's license — Class A"] },
      { key: "issuer",        label: "Issuing authority",   kind: "text",     placeholder: "e.g. CA Board of Registered Nursing" },
      { key: "cadence",       label: "Renewal cadence",     kind: "select",   options: ["Annual", "2 years", "3 years", "5 years", "Per state", "Per hire"] },
      { key: "psv",           label: "Primary source verification", kind: "toggle" },
      { key: "warnWindow",    label: "Warn before expiry",  kind: "select",   options: ["7 days","14 days","30 days","60 days","90 days"] },
      { key: "blockWindow",   label: "Block bookings when expired", kind: "toggle" },
      { key: "uploadRequired",label: "Document upload required",     kind: "toggle" },
    ],
  },
  {
    id: "background", label: "Background checks", icon: "PersonAuthorize", hue: "teal",
    blurb: "Screening, drug testing, sanctions",
    schema: [
      { key: "package",   label: "Screening package",       kind: "select",   options: ["Standard","Enhanced","Healthcare (SAM + OIG)","DOT","Government clearance"] },
      { key: "drug",      label: "Drug screen",             kind: "select",   options: ["None","5-panel","10-panel","DOT 5-panel","Hair follicle 5-panel"] },
      { key: "randomDrug",label: "Random drug testing",     kind: "toggle" },
      { key: "vendor",    label: "Vendor",                  kind: "select",   options: ["Checkr","Sterling","HireRight","First Advantage","In-house"] },
      { key: "refresh",   label: "Re-check cadence",        kind: "select",   options: ["Hire only","Annual","Every 2 years","Every 3 years","Continuous monitoring"] },
      { key: "lookback",  label: "Lookback period",         kind: "select",   options: ["5 years","7 years","10 years","All available"] },
    ],
  },
  {
    id: "training", label: "Training", icon: "ClipboardCircleCheck", hue: "green",
    blurb: "Onboarding, courses, orientation",
    schema: [
      { key: "course",    label: "Course / module",         kind: "text",     placeholder: "e.g. Facility orientation — Floor 4" },
      { key: "duration",  label: "Duration",                kind: "text",     placeholder: "e.g. 90 minutes" },
      { key: "delivery",  label: "Delivery",                kind: "select",   options: ["e-learning","Instructor-led","Self-guided","Shadow shift","Blended"] },
      { key: "passing",   label: "Passing score",           kind: "text",     placeholder: "e.g. 80%" },
      { key: "renew",     label: "Renewal",                 kind: "select",   options: ["Hire only","Annual","2 years","3 years","On role change"] },
      { key: "vendor",    label: "Provider",                kind: "text",     placeholder: "e.g. HealthStream" },
    ],
  },
  {
    id: "attendance", label: "Time & attendance", icon: "PersonClock", hue: "orange",
    blurb: "Breaks, overtime, late thresholds",
    schema: [
      { key: "breakMin",     label: "Meal break minimum",   kind: "text",     placeholder: "e.g. 30 min unpaid after 5 hours" },
      { key: "restBreak",    label: "Rest break",           kind: "text",     placeholder: "10 min paid per 4 hours" },
      { key: "otThreshold",  label: "OT threshold",         kind: "select",   options: [">40 hrs/week",">8 hrs/day","Both daily + weekly","CA pyramid (1.5x / 2x)"] },
      { key: "lateGrace",    label: "Late grace",           kind: "select",   options: ["0 min","5 min","7 min","10 min","15 min"] },
      { key: "noShowEsc",    label: "No-show escalation",   kind: "toggle" },
      { key: "callOut",      label: "Call-out lead time",   kind: "select",   options: ["1 hour","2 hours","4 hours","8 hours","Same-day OK"] },
      { key: "geo",          label: "Geo-fence clock-in",   kind: "toggle" },
    ],
  },
  {
    id: "conduct", label: "Conduct", icon: "Gavel", hue: "red",
    blurb: "Code of conduct, NDA, harassment",
    schema: [
      { key: "doc",        label: "Document title",         kind: "text",     placeholder: "e.g. Code of conduct v4.1" },
      { key: "nda",        label: "NDA required",           kind: "toggle" },
      { key: "ndaTerm",    label: "NDA term",               kind: "select",   options: ["2 years","3 years","5 years","Indefinite"] },
      { key: "ackSig",     label: "Signature",              kind: "select",   options: ["Click-through","Typed name","DocuSign","Wet signature"] },
      { key: "renew",      label: "Re-acknowledge",         kind: "select",   options: ["Hire only","Annual","On policy change","Quarterly"] },
    ],
  },
  {
    id: "safety", label: "Safety", icon: "Alert", hue: "yellow",
    blurb: "Hazards, incidents, PPE drills",
    schema: [
      { key: "scope",       label: "Hazard scope",          kind: "text",     placeholder: "e.g. Bloodborne pathogens, chemical, fall" },
      { key: "ppe",         label: "PPE required",          kind: "text",     placeholder: "N95, gloves, gown, eye protection" },
      { key: "drillCadence",label: "Drill cadence",         kind: "select",   options: ["Monthly","Quarterly","Bi-annual","Annual"] },
      { key: "incidentLog", label: "Incident logging",      kind: "select",   options: ["Self-report only","Supervisor co-sign","Joint Commission OSHA-300"] },
      { key: "rtw",         label: "Return-to-work clearance", kind: "toggle" },
    ],
  },
  // Rate visibility — controls what the supplier sees on the
  // contract's RateCardsCard. "Visible" shows pay rate as authored;
  // "masked" replaces the pay-rate cell with •••; "band-only" shows
  // the min/max range but hides the preferred. Read at render time by
  // RateCardsCard (pages/supplier-contract-sections.jsx) via the
  // contract's payRateVisibility field. The org-wide default lives
  // here; per-supplier override lives on the contract.
  {
    id: "rate-visibility", label: "Rate visibility", icon: "Eye", hue: "teal",
    blurb: "Whether the supplier sees pay rate, band only, or masked",
    schema: [
      { key: "default",     label: "Default for new contracts", kind: "select", options: ["visible","band-only","masked"] },
      { key: "perSupplier", label: "Allow per-supplier override", kind: "toggle" },
      { key: "reason",      label: "Rationale shown to supplier", kind: "text",
        placeholder: "We hide pay rate to protect candidate-side negotiation leverage." },
    ],
  },
];
const POL_TYPE_MAP = Object.fromEntries(POL_TYPES.map((t) => [t.id, t]));

// ---------- Per-industry form example copy ----------------------------
// Plugged into placeholders so the "New policy" form reads like the
// current tenant — clinical for healthcare, OSHA-toned for manufacturing,
// etc. Used in PolicyCreatePanel below.
const POL_EXAMPLES = {
  healthcare: {
    name: "e.g. Scrub attire — Med-Surg & ICU",
    locations: "e.g. Mercy Memorial, Mercy Medical Plaza",
    roles: "e.g. RN, LPN, CNA",
  },
  hospitality: {
    name: "e.g. Allergen awareness — annual",
    locations: "e.g. Aurora Resort Way, Beach Club Annex",
    roles: "e.g. Banquet Server, Bartender, Concierge",
  },
  retail: {
    name: "e.g. POS certification — Flagship POS v6",
    locations: "e.g. Northwind Flagship NYC, Northwind Express SF",
    roles: "e.g. Sales Associate, Cashier",
  },
  manufacturing: {
    name: "e.g. Lockout / tagout (LOTO)",
    locations: "e.g. Atlas Plant #02, Atlas Plant #04",
    roles: "e.g. Operator, Assembler, Inspector",
  },
  logistics: {
    name: "e.g. DOT physical — 2-year",
    locations: "e.g. Midland Terminal SLC, Midland Terminal DEN",
    roles: "e.g. Driver · Class A, Yard · forklift",
  },
};
function polExamples() {
  return POL_EXAMPLES[polCurrentIndustry()] || POL_EXAMPLES.manufacturing;
}

// Maps the type hue to a req-pill class + the soft surface for the icon tile.
function polHueClass(hue) {
  return ({
    purple: "pol-hue--purple",
    blue:   "pol-hue--blue",
    teal:   "pol-hue--teal",
    green:  "pol-hue--green",
    orange: "pol-hue--orange",
    red:    "pol-hue--red",
    yellow: "pol-hue--yellow",
  })[hue] || "pol-hue--blue";
}

// ---------- Status meta -------------------------------------------------
const POL_STATUS_HUES = { Active: "success", Draft: "default", Archived: "default", Review: "warning" };

// ---------- Seed data ---------------------------------------------------
// Every policy is tagged with `industries: [...]`; the active industry's
// seed is loaded into the persistent store on first visit. Tag `"all"`
// for items that apply everywhere (CA labor, conduct, archived legacy).
const POL_SEED = [
  // ===== HEALTHCARE — Mercy Health =====
  {
    id: "pol-h-001",
    name: "Scrub attire — Med-Surg & ICU",
    industries: ["healthcare"],
    type: "attire",
    status: "Active",
    summary: "Hospital-issued scrubs (color-coded by unit), closed-toe non-slip footwear, fragrance-free.",
    scope: { locations: ["Mercy Memorial", "Mercy Medical Plaza"], roles: ["RN", "LPN", "CNA"] },
    owner: { name: "Priya Aravind", initials: "PA" },
    version: "v3.2", lastReview: "Apr 12 2026", nextReview: "Apr 12 2027",
    rules: {
      uniform: "Royal blue (Med-Surg) · Burgundy (ICU)",
      footwear: "Closed-toe, slip-resistant, leather/synthetic",
      hair: "Tied back, no shoulder-length loose hair",
      nails: "Natural or short polish; no acrylics, no gel",
      jewelry: "Wedding band only, no dangling earrings",
      fragrance: "Prohibited",
      vendor: "Facility-issued",
    },
    enforcement: { mode: "warn", strike: 3, block: true },
    ack: { required: true, cadence: "Annual + on hire", current: 218, eligible: 224 },
    docs: [
      { name: "Mercy_Scrub_Standard_v3.2.pdf", size: "1.2 MB" },
      { name: "Color_chart_by_unit.png", size: "468 KB" },
    ],
    history: [
      { date: "Apr 12 2026", who: "Priya Aravind", what: "Annual review — no changes" },
      { date: "Aug 03 2025", who: "Priya Aravind", what: "Added fragrance-free rule (Onc unit feedback)" },
      { date: "Apr 12 2025", who: "Devon Park",    what: "v3.1 → v3.2 — color update for ICU" },
    ],
  },
  {
    id: "pol-h-002",
    name: "RN license — California",
    industries: ["healthcare"],
    type: "certifications",
    status: "Active",
    summary: "Active CA Board of Registered Nursing license required to book any RN-titled shift at a CA facility.",
    scope: { locations: ["Mercy Memorial", "Mercy Medical Plaza", "Mercy Children's", "Mercy Plaza South"], roles: ["RN"] },
    owner: { name: "Devon Park", initials: "DP" },
    version: "v2.0", lastReview: "Feb 01 2026", nextReview: "Feb 01 2027",
    rules: {
      credential: "RN license",
      issuer: "California Board of Registered Nursing",
      cadence: "Per state",
      psv: true,
      warnWindow: "60 days",
      blockWindow: true,
      uploadRequired: true,
    },
    enforcement: { mode: "block", block: true },
    ack: { required: false, cadence: "—", current: 0, eligible: 0 },
    docs: [
      { name: "CA_BRN_PSV_runbook.pdf", size: "248 KB" },
    ],
    history: [
      { date: "Feb 01 2026", who: "Devon Park", what: "v1.8 → v2.0 — auto-block at expiry (was warn-only)" },
      { date: "Jul 14 2025", who: "Devon Park", what: "Enabled NPDB continuous monitoring" },
    ],
  },
  {
    id: "pol-h-003",
    name: "BLS — bedside clinical",
    industries: ["healthcare"],
    type: "certifications",
    status: "Active",
    summary: "American Heart Association BLS card; 2-year cycle; required for any direct-patient-care role.",
    scope: { locations: ["All Mercy facilities"], roles: ["RN", "LPN", "CNA", "Respiratory therapist"] },
    owner: { name: "Devon Park", initials: "DP" },
    version: "v1.3", lastReview: "Jan 04 2026", nextReview: "Jan 04 2027",
    rules: {
      credential: "BLS",
      issuer: "American Heart Association",
      cadence: "2 years",
      psv: false,
      warnWindow: "60 days",
      blockWindow: true,
      uploadRequired: true,
    },
    enforcement: { mode: "block", block: true },
    ack: { required: false },
    docs: [{ name: "BLS_renewal_FAQ.pdf", size: "182 KB" }],
    history: [
      { date: "Jan 04 2026", who: "Devon Park", what: "Annual review — no changes" },
    ],
  },
  {
    id: "pol-h-004",
    name: "ACLS — ICU + ED",
    industries: ["healthcare"],
    type: "certifications",
    status: "Active",
    summary: "Advanced cardiac life support certification, unit-conditional. ICU + ED only.",
    scope: { locations: ["Mercy Memorial", "Mercy Plaza South"], roles: ["RN — ICU", "RN — ED"] },
    owner: { name: "Devon Park", initials: "DP" },
    version: "v1.1", lastReview: "Jan 04 2026", nextReview: "Jan 04 2027",
    rules: {
      credential: "ACLS",
      issuer: "American Heart Association",
      cadence: "2 years",
      psv: false,
      warnWindow: "30 days",
      blockWindow: true,
      uploadRequired: true,
    },
    enforcement: { mode: "block", block: true, autoSuspendDays: 21 },
    ack: { required: false },
    docs: [],
    history: [
      { date: "Jan 04 2026", who: "Devon Park", what: "Tightened auto-suspend to 21 days" },
    ],
  },
  {
    id: "pol-h-005",
    name: "Pre-employment background — Healthcare",
    industries: ["healthcare"],
    countries: ["US"],
    type: "background",
    status: "Active",
    summary: "10-panel drug screen + SAM/OIG sanctions check + 7-year criminal lookback at hire. Continuous monitoring on.",
    scope: { locations: ["All Mercy facilities"], roles: ["All clinical roles"] },
    owner: { name: "Sami Soto", initials: "SS" },
    version: "v4.0", lastReview: "Mar 22 2026", nextReview: "Mar 22 2027",
    rules: {
      package: "Healthcare (SAM + OIG)",
      drug: "10-panel",
      randomDrug: false,
      vendor: "Checkr",
      refresh: "Continuous monitoring",
      lookback: "7 years",
    },
    enforcement: { mode: "block", block: true },
    ack: { required: false },
    docs: [
      { name: "Checkr_contract_2026.pdf", size: "1.8 MB" },
      { name: "Drug_panel_chain_of_custody.pdf", size: "612 KB" },
    ],
    history: [
      { date: "Mar 22 2026", who: "Sami Soto", what: "v3.4 → v4.0 — added continuous monitoring" },
      { date: "Sep 09 2025", who: "Maya Chen",  what: "Vendor change: Sterling → Checkr" },
    ],
  },
  {
    id: "pol-h-006",
    name: "Facility orientation — Mercy Memorial",
    industries: ["healthcare"],
    type: "training",
    status: "Active",
    summary: "Floor-by-floor orientation incl. badge, EHR walkthrough, emergency codes, supply rooms.",
    scope: { locations: ["Mercy Memorial"], roles: ["All clinical roles"] },
    owner: { name: "Jordan Hsu", initials: "JH" },
    version: "v2.4", lastReview: "Feb 18 2026", nextReview: "Feb 18 2027",
    rules: {
      course: "Mercy Memorial — Facility orientation",
      duration: "90 minutes (45 e-learning + 45 on-floor)",
      delivery: "Blended",
      passing: "80%",
      renew: "On role change",
      vendor: "HealthStream + in-house",
    },
    enforcement: { mode: "warn", strike: 1, block: true },
    ack: { required: true, cadence: "On hire + role change", current: 162, eligible: 168 },
    docs: [
      { name: "Mercy_Memorial_orientation_deck.pdf", size: "4.6 MB" },
      { name: "Emergency_codes_card.png", size: "212 KB" },
    ],
    history: [
      { date: "Feb 18 2026", who: "Jordan Hsu", what: "v2.3 → v2.4 — added rapid-response code blue location update" },
    ],
  },
  {
    id: "pol-x-007",
    name: "California meal & rest breaks",
    industries: ["all"],
    countries: ["US"],
    type: "attendance",
    status: "Active",
    summary: "CA Labor Code §512 — 30 min unpaid meal after 5 hrs, 10 min paid rest per 4 hrs, premium pay on missed.",
    scope: { locations: ["All California facilities"], roles: ["All non-exempt"] },
    owner: { name: "Nia Thompson", initials: "NT" },
    version: "v5.1", lastReview: "Jan 12 2026", nextReview: "Jan 12 2027",
    rules: {
      breakMin: "30 min unpaid after 5 hrs · second 30 min after 10 hrs",
      restBreak: "10 min paid per 4 hrs",
      otThreshold: "CA pyramid (1.5x / 2x)",
      lateGrace: "7 min",
      noShowEsc: true,
      callOut: "2 hours",
      geo: true,
    },
    enforcement: { mode: "warn", strike: 2, block: false, premium: "1 hr at regular rate on missed meal" },
    ack: { required: true, cadence: "Annual", current: 412, eligible: 412 },
    docs: [
      { name: "CA_Labor_Code_512_one-pager.pdf", size: "224 KB" },
    ],
    history: [
      { date: "Jan 12 2026", who: "Nia Thompson", what: "Annual review — confirmed pyramid OT" },
      { date: "Jul 02 2025", who: "Nia Thompson", what: "Enabled geo-fence enforcement" },
    ],
  },
  {
    id: "pol-h-008",
    name: "Worker code of conduct + NDA",
    industries: ["healthcare"],
    type: "conduct",
    status: "Active",
    summary: "Confidentiality of PHI, anti-harassment, professional conduct on facility grounds.",
    scope: { locations: ["All facilities"], roles: ["All workers"] },
    owner: { name: "Maya Chen", initials: "MC" },
    version: "v4.1", lastReview: "Mar 01 2026", nextReview: "Mar 01 2027",
    rules: {
      doc: "Mercy Code of Conduct v4.1",
      nda: true,
      ndaTerm: "3 years",
      ackSig: "DocuSign",
      renew: "Annual",
    },
    enforcement: { mode: "block", block: true },
    ack: { required: true, cadence: "Annual", current: 396, eligible: 412 },
    docs: [
      { name: "Mercy_Code_of_Conduct_v4.1.pdf", size: "1.4 MB" },
      { name: "NDA_template_3yr.pdf", size: "186 KB" },
    ],
    history: [
      { date: "Mar 01 2026", who: "Maya Chen", what: "v4.0 → v4.1 — added social-media addendum" },
    ],
  },
  {
    id: "pol-h-009",
    name: "Bloodborne pathogens · OSHA-300",
    industries: ["healthcare"],
    countries: ["US"],
    type: "safety",
    status: "Active",
    summary: "OSHA 29 CFR 1910.1030 — exposure plan, PPE, sharps handling, post-exposure follow-up.",
    scope: { locations: ["All clinical facilities"], roles: ["All clinical roles", "Housekeeping", "EVS"] },
    owner: { name: "Sami Soto", initials: "SS" },
    version: "v3.0", lastReview: "Feb 28 2026", nextReview: "Feb 28 2027",
    rules: {
      scope: "Bloodborne pathogens — needlestick, splash, contaminated linen",
      ppe: "Gloves · gown · eye protection · N95 for aerosol-generating procedures",
      drillCadence: "Bi-annual",
      incidentLog: "Joint Commission OSHA-300",
      rtw: true,
    },
    enforcement: { mode: "audit", block: false },
    ack: { required: true, cadence: "Annual", current: 408, eligible: 412 },
    docs: [
      { name: "Exposure_Control_Plan_v3.0.pdf", size: "2.1 MB" },
    ],
    history: [
      { date: "Feb 28 2026", who: "Sami Soto", what: "v2.5 → v3.0 — added rapid HIV protocol" },
    ],
  },
  {
    id: "pol-m-010",
    name: "Forklift certification — Class IV",
    industries: ["manufacturing", "logistics"],
    type: "certifications",
    status: "Active",
    summary: "OSHA-compliant powered industrial truck operator certification; re-eval every 3 years or post-incident.",
    scope: { locations: ["Distribution Center Alpha", "Warehouse #14", "Warehouse #35"], roles: ["Forklift operator", "Material handler"] },
    owner: { name: "Jamal Carter", initials: "JC" },
    version: "v1.4", lastReview: "Oct 14 2025", nextReview: "Oct 14 2026",
    rules: {
      credential: "Forklift (Class IV)",
      issuer: "OSHA-authorized trainer (in-house)",
      cadence: "3 years",
      psv: false,
      warnWindow: "30 days",
      blockWindow: true,
      uploadRequired: true,
    },
    enforcement: { mode: "block", block: true },
    ack: { required: false },
    docs: [{ name: "OSHA_PIT_29CFR1910.178.pdf", size: "318 KB" }],
    history: [
      { date: "Oct 14 2025", who: "Jamal Carter", what: "Updated post-incident retraining trigger" },
    ],
  },
  {
    id: "pol-m-011",
    name: "Steel-toe boots & hi-vis vest",
    industries: ["manufacturing", "logistics"],
    type: "attire",
    status: "Active",
    summary: "ASTM F2413 steel-toe + Class 2 hi-vis vest on warehouse floors.",
    scope: { locations: ["Distribution Center Alpha", "Warehouse #14", "Warehouse #35"], roles: ["Warehouse associate", "Forklift operator"] },
    owner: { name: "Jamal Carter", initials: "JC" },
    version: "v2.0", lastReview: "Nov 02 2025", nextReview: "Nov 02 2026",
    rules: {
      uniform: "Steel-toe boots, ASTM F2413",
      footwear: "ASTM F2413 puncture-resistant",
      hair: "—",
      nails: "—",
      jewelry: "No loose chains",
      fragrance: "Permitted",
      vendor: "Stipend reimbursed ($120 / yr)",
    },
    enforcement: { mode: "block", block: true },
    ack: { required: true, cadence: "On hire + annual", current: 188, eligible: 192 },
    docs: [
      { name: "PPE_stipend_form.pdf", size: "94 KB" },
    ],
    history: [
      { date: "Nov 02 2025", who: "Jamal Carter", what: "v1.6 → v2.0 — raised stipend ($95 → $120)" },
    ],
  },
  {
    id: "pol-r-012",
    name: "AB-1228 fast-food premium — pilot",
    industries: ["retail", "hospitality"],
    countries: ["US"],
    type: "attendance",
    status: "Draft",
    summary: "Pilot for fast-food covered chains under CA AB-1228 — $20 minimum + scheduling premium.",
    scope: { locations: ["Pilot — 2 stores"], roles: ["Crew member"] },
    owner: { name: "Maya Chen", initials: "MC" },
    version: "v0.3", lastReview: "Apr 30 2026", nextReview: "—",
    rules: {
      breakMin: "30 min unpaid after 5 hrs",
      restBreak: "10 min paid per 4 hrs",
      otThreshold: ">8 hrs/day",
      lateGrace: "5 min",
      noShowEsc: true,
      callOut: "4 hours",
      geo: false,
    },
    enforcement: { mode: "warn", strike: 2, block: false },
    ack: { required: false },
    docs: [],
    history: [
      { date: "Apr 30 2026", who: "Maya Chen", what: "Drafted from CA template" },
    ],
  },
  {
    id: "pol-h-013",
    name: "Flu vaccination — clinical",
    industries: ["healthcare"],
    type: "training",
    status: "Review",
    summary: "Annual seasonal influenza vaccination, declination form for medical/religious exemption.",
    scope: { locations: ["All Mercy facilities"], roles: ["All clinical roles"] },
    owner: { name: "Priya Aravind", initials: "PA" },
    version: "v6.0", lastReview: "Sep 01 2025", nextReview: "Sep 01 2026",
    rules: {
      course: "Annual flu shot + declination form",
      duration: "—",
      delivery: "Self-guided",
      passing: "—",
      renew: "Annual",
      vendor: "Mercy Occupational Health",
    },
    enforcement: { mode: "block", block: true, autoSuspendDays: 0 },
    ack: { required: true, cadence: "Annual (Sep–Nov)", current: 384, eligible: 412 },
    docs: [
      { name: "Flu_declination_form_2026.pdf", size: "124 KB" },
    ],
    history: [
      { date: "Apr 18 2026", who: "Priya Aravind", what: "Flagged for review — 28 workers in grace period" },
    ],
  },
  // ===== HOSPITALITY — Aurora Hotels & Resorts =====
  {
    id: "pol-y-001",
    name: "Front-of-house grooming standard",
    industries: ["hospitality"],
    type: "attire",
    status: "Active",
    summary: "Tailored uniform by department, polished shoes, name badge visible. Fragrance discouraged in spa & dining.",
    scope: { locations: ["Aurora Resort Way", "Aurora Lodge", "Beach Club Annex"], roles: ["Front Desk Agent", "Concierge", "Banquet Server", "Bellhop"] },
    owner: { name: "Kierra Stanton", initials: "KS" },
    version: "v2.1", lastReview: "Mar 18 2026", nextReview: "Mar 18 2027",
    rules: {
      uniform: "Department-issued uniform — laundered nightly",
      footwear: "Closed-toe polished black",
      hair: "Tied back; collar-length max for front-of-house",
      nails: "Natural or neutral polish",
      jewelry: "Watch + wedding band; small studs only",
      fragrance: "Discouraged",
      vendor: "Facility-issued",
    },
    enforcement: { mode: "warn", strike: 2, block: false },
    ack: { required: true, cadence: "On hire + annual", current: 132, eligible: 138 },
    docs: [{ name: "Aurora_FOH_Standard_v2.1.pdf", size: "1.1 MB" }],
    history: [{ date: "Mar 18 2026", who: "Kierra Stanton", what: "Annual review — no material changes" }],
  },
  {
    id: "pol-y-002",
    name: "TIPS / RBS — Bar service",
    industries: ["hospitality"],
    type: "certifications",
    status: "Active",
    summary: "Current alcohol service permit (TIPS or state RBS); auto-block bar / liquor station on expiry.",
    scope: { locations: ["Aurora Resort Way bar", "Beach Club Annex", "Aurora Lodge lounge"], roles: ["Bartender", "Server (alcohol)"] },
    owner: { name: "Jakob Aminoff", initials: "JA" },
    version: "v1.2", lastReview: "Feb 04 2026", nextReview: "Feb 04 2027",
    rules: {
      credential: "TIPS / RBS",
      issuer: "State Alcohol Beverage Control",
      cadence: "3 years",
      psv: true,
      warnWindow: "30 days",
      blockWindow: true,
      uploadRequired: true,
    },
    enforcement: { mode: "block", block: true, autoSuspendDays: 0 },
    ack: { required: false },
    docs: [{ name: "TIPS_renewal_guide.pdf", size: "224 KB" }],
    history: [{ date: "Feb 04 2026", who: "Jakob Aminoff", what: "Tightened auto-suspend to day-of-expiry" }],
  },
  {
    id: "pol-y-003",
    name: "ServSafe Manager — F&B",
    industries: ["hospitality"],
    type: "certifications",
    status: "Active",
    summary: "ServSafe Manager certification required for any role supervising plated service or food handling.",
    scope: { locations: ["All Aurora properties"], roles: ["Banquet Captain", "Sous Chef", "Banquet Server (lead)"] },
    owner: { name: "Kierra Stanton", initials: "KS" },
    version: "v1.0", lastReview: "Jan 22 2026", nextReview: "Jan 22 2027",
    rules: {
      credential: "ServSafe Mgr",
      issuer: "National Restaurant Association",
      cadence: "5 years",
      psv: false,
      warnWindow: "60 days",
      blockWindow: true,
      uploadRequired: true,
    },
    enforcement: { mode: "block", block: true },
    ack: { required: false },
    docs: [],
    history: [{ date: "Jan 22 2026", who: "Kierra Stanton", what: "Created from template" }],
  },
  {
    id: "pol-y-004",
    name: "Allergen awareness — annual",
    industries: ["hospitality"],
    type: "training",
    status: "Active",
    summary: "Top-9 allergens, cross-contact handling, EpiPen + 911 protocol. Required for any F&B-facing role.",
    scope: { locations: ["All Aurora properties"], roles: ["Banquet Server", "Bartender", "Prep Cook", "Concierge"] },
    owner: { name: "Marcus Webb", initials: "MW" },
    version: "v3.0", lastReview: "Apr 02 2026", nextReview: "Apr 02 2027",
    rules: {
      course: "Allergen Aware — Aurora",
      duration: "45 minutes",
      delivery: "e-learning",
      passing: "80%",
      renew: "Annual",
      vendor: "AllerTrain",
    },
    enforcement: { mode: "warn", strike: 1, block: true },
    ack: { required: true, cadence: "Annual", current: 124, eligible: 138 },
    docs: [{ name: "Allergen_top9_reference.pdf", size: "312 KB" }],
    history: [{ date: "Apr 02 2026", who: "Marcus Webb", what: "v2.4 → v3.0 — added sesame to top-9" }],
  },
  {
    id: "pol-y-005",
    name: "Property orientation — Resort Way",
    industries: ["hospitality"],
    type: "training",
    status: "Active",
    summary: "Property walk, BEO conventions, guest service standards, emergency evac routes.",
    scope: { locations: ["Aurora Resort Way"], roles: ["All worker roles"] },
    owner: { name: "Kierra Stanton", initials: "KS" },
    version: "v4.2", lastReview: "Feb 18 2026", nextReview: "Feb 18 2027",
    rules: {
      course: "Resort Way orientation",
      duration: "60 minutes (30 e-learning + 30 on-property)",
      delivery: "Blended",
      passing: "—",
      renew: "On role change",
      vendor: "In-house",
    },
    enforcement: { mode: "warn", strike: 1, block: true },
    ack: { required: true, cadence: "On hire + role change", current: 128, eligible: 138 },
    docs: [{ name: "Resort_Way_orientation_deck.pdf", size: "3.8 MB" }],
    history: [{ date: "Feb 18 2026", who: "Kierra Stanton", what: "v4.1 → v4.2 — added new beach club evac route" }],
  },
  {
    id: "pol-y-006",
    name: "Pre-employment background — Hospitality",
    industries: ["hospitality"],
    countries: ["US"],
    type: "background",
    status: "Active",
    summary: "Standard 7-year criminal lookback + identity verification at hire. Sterling vendor.",
    scope: { locations: ["All Aurora properties"], roles: ["All worker roles"] },
    owner: { name: "Sami Soto", initials: "SS" },
    version: "v2.1", lastReview: "Mar 11 2026", nextReview: "Mar 11 2027",
    rules: {
      package: "Standard",
      drug: "None",
      randomDrug: false,
      vendor: "Sterling",
      refresh: "Every 3 years",
      lookback: "7 years",
    },
    enforcement: { mode: "block", block: true },
    ack: { required: false },
    docs: [{ name: "Sterling_contract_2026.pdf", size: "1.4 MB" }],
    history: [{ date: "Mar 11 2026", who: "Sami Soto", what: "Renewed Sterling contract" }],
  },

  // ===== RETAIL — Northwind Retail Group =====
  {
    id: "pol-r-001",
    name: "Store uniform & name badge",
    industries: ["retail"],
    type: "attire",
    status: "Active",
    summary: "Banner-issued polo + black or khaki bottom + visible name badge. Closed-toe non-slip footwear.",
    scope: { locations: ["Northwind Flagship NYC", "Northwind Flagship SEA", "Northwind Express SF", "Northwind Outlet PHX", "Northwind Flagship CHI"], roles: ["Sales Associate", "Stockroom Clerk", "Cashier"] },
    owner: { name: "Maya Lin", initials: "ML" },
    version: "v3.0", lastReview: "Mar 02 2026", nextReview: "Mar 02 2027",
    rules: {
      uniform: "Banner polo (red flagship, navy outlet)",
      footwear: "Closed-toe, non-slip",
      hair: "Tied back if shoulder-length+",
      nails: "Natural or short polish",
      jewelry: "Watch + wedding band; small studs only",
      fragrance: "Permitted",
      vendor: "Stipend reimbursed ($85 / yr)",
    },
    enforcement: { mode: "warn", strike: 2, block: false },
    ack: { required: true, cadence: "On hire + annual", current: 612, eligible: 640 },
    docs: [{ name: "Northwind_Uniform_v3.0.pdf", size: "1.4 MB" }],
    history: [{ date: "Mar 02 2026", who: "Maya Lin", what: "v2.8 → v3.0 — raised stipend ($60 → $85)" }],
  },
  {
    id: "pol-r-002",
    name: "Age 21+ verification — Liquor / tobacco",
    industries: ["retail"],
    type: "certifications",
    status: "Active",
    summary: "Worker DOB must be on file and verified before any liquor-aisle or tobacco-counter assignment.",
    scope: { locations: ["Stores with liquor SKUs"], roles: ["Cashier (liquor)", "Sales Associate (tobacco)"] },
    owner: { name: "Marcus Webb", initials: "MW" },
    version: "v1.5", lastReview: "Feb 18 2026", nextReview: "Feb 18 2027",
    rules: {
      credential: "Age 21+ (liquor)",
      issuer: "I-9 / DOB verification",
      cadence: "One-time",
      psv: false,
      warnWindow: "—",
      blockWindow: true,
      uploadRequired: true,
    },
    enforcement: { mode: "block", block: true },
    ack: { required: false },
    docs: [],
    history: [{ date: "Feb 18 2026", who: "Marcus Webb", what: "Tightened DOB-verification at intake" }],
  },
  {
    id: "pol-r-003",
    name: "Loss-prevention training — annual",
    industries: ["retail"],
    type: "training",
    status: "Active",
    summary: "Shrink prevention, return-fraud red flags, de-escalation. Required for any jewelry / electronics shift.",
    scope: { locations: ["All Northwind stores"], roles: ["Sales Associate", "Loss Prevention Officer"] },
    owner: { name: "Ada Watts", initials: "AW" },
    version: "v4.1", lastReview: "Apr 04 2026", nextReview: "Apr 04 2027",
    rules: {
      course: "LP — Annual",
      duration: "60 minutes",
      delivery: "e-learning",
      passing: "85%",
      renew: "Annual",
      vendor: "Northwind LP team",
    },
    enforcement: { mode: "warn", strike: 1, block: true },
    ack: { required: true, cadence: "Annual", current: 588, eligible: 640 },
    docs: [{ name: "LP_Annual_v4.1.pdf", size: "962 KB" }],
    history: [{ date: "Apr 04 2026", who: "Ada Watts", what: "v4.0 → v4.1 — added self-checkout module" }],
  },
  {
    id: "pol-r-004",
    name: "Fair Workweek attestation",
    industries: ["retail"],
    countries: ["US"],
    type: "attendance",
    status: "Active",
    summary: "Predictive-scheduling acknowledgement for NYC, SF, Seattle, Oregon, Chicago. Annual + on hire.",
    scope: { locations: ["NYC, SF, Seattle, OR, Chicago stores"], roles: ["All hourly retail roles"] },
    owner: { name: "Maya Chen", initials: "MC" },
    version: "v2.3", lastReview: "Apr 12 2026", nextReview: "Apr 12 2027",
    rules: {
      breakMin: "30 min unpaid after 5 hrs",
      restBreak: "10 min paid per 4 hrs",
      otThreshold: ">40 hrs/week",
      lateGrace: "7 min",
      noShowEsc: true,
      callOut: "2 hours",
      geo: true,
    },
    enforcement: { mode: "warn", strike: 2, block: false, premium: "Predictability pay on schedule change <14 days" },
    ack: { required: true, cadence: "Annual + on hire", current: 312, eligible: 326 },
    docs: [{ name: "Fair_Workweek_one-pager.pdf", size: "188 KB" }],
    history: [{ date: "Apr 12 2026", who: "Maya Chen", what: "Annual review — confirmed 5-city scope" }],
  },
  {
    id: "pol-r-005",
    name: "POS certification — Flagship POS v6",
    industries: ["retail"],
    type: "training",
    status: "Active",
    summary: "Worker must be POS-certified per banner before being assigned a register. Includes refund + void rules.",
    scope: { locations: ["Northwind flagship banner"], roles: ["Cashier", "Sales Associate"] },
    owner: { name: "Priya Ramesh", initials: "PR" },
    version: "v6.0", lastReview: "Jan 18 2026", nextReview: "Jan 18 2027",
    rules: {
      course: "Flagship POS v6 — certification",
      duration: "45 minutes",
      delivery: "e-learning",
      passing: "85%",
      renew: "Per banner",
      vendor: "In-house",
    },
    enforcement: { mode: "block", block: true },
    ack: { required: false },
    docs: [{ name: "Flagship_POS_v6_quickref.pdf", size: "440 KB" }],
    history: [{ date: "Jan 18 2026", who: "Priya Ramesh", what: "Upgraded to v6" }],
  },
  {
    id: "pol-r-006",
    name: "Pre-employment background — Retail",
    industries: ["retail"],
    countries: ["US"],
    type: "background",
    status: "Active",
    summary: "Standard 7-year criminal lookback + drug screen at hire for jewelry / electronics roles.",
    scope: { locations: ["All Northwind stores"], roles: ["All hourly retail roles"] },
    owner: { name: "Sami Soto", initials: "SS" },
    version: "v3.0", lastReview: "Feb 28 2026", nextReview: "Feb 28 2027",
    rules: {
      package: "Standard",
      drug: "5-panel",
      randomDrug: false,
      vendor: "Sterling",
      refresh: "Every 3 years",
      lookback: "7 years",
    },
    enforcement: { mode: "block", block: true },
    ack: { required: false },
    docs: [],
    history: [{ date: "Feb 28 2026", who: "Sami Soto", what: "Vendor confirmed: Sterling" }],
  },
  {
    id: "pol-r-007",
    name: "Code of conduct — Retail",
    industries: ["retail"],
    type: "conduct",
    status: "Active",
    summary: "Customer-service standards, anti-harassment, register-handling integrity, return-fraud protocol.",
    scope: { locations: ["All Northwind stores"], roles: ["All worker roles"] },
    owner: { name: "Maya Chen", initials: "MC" },
    version: "v3.2", lastReview: "Mar 01 2026", nextReview: "Mar 01 2027",
    rules: {
      doc: "Northwind Code of Conduct v3.2",
      nda: false,
      ndaTerm: "—",
      ackSig: "Click-through",
      renew: "Annual",
    },
    enforcement: { mode: "block", block: true },
    ack: { required: true, cadence: "Annual", current: 596, eligible: 640 },
    docs: [{ name: "Northwind_Code_v3.2.pdf", size: "1.1 MB" }],
    history: [{ date: "Mar 01 2026", who: "Maya Chen", what: "Refreshed for 2026" }],
  },

  // ===== MANUFACTURING — Atlas =====
  {
    id: "pol-m-001",
    name: "Plant orientation — Atlas Plant #02",
    industries: ["manufacturing"],
    type: "training",
    status: "Active",
    summary: "Plant walk, EHS protocols, line stations, evacuation routes, emergency shut-downs.",
    scope: { locations: ["Atlas Plant #02", "Atlas Plant #04"], roles: ["All worker roles"] },
    owner: { name: "Jamal Carter", initials: "JC" },
    version: "v2.6", lastReview: "Feb 18 2026", nextReview: "Feb 18 2027",
    rules: {
      course: "Plant #02 — Floor Orientation",
      duration: "75 minutes (30 e-learning + 45 on-floor)",
      delivery: "Blended",
      passing: "—",
      renew: "On role change",
      vendor: "In-house EHS",
    },
    enforcement: { mode: "warn", strike: 1, block: true },
    ack: { required: true, cadence: "On hire + role change", current: 188, eligible: 192 },
    docs: [{ name: "Plant02_orientation_deck.pdf", size: "3.2 MB" }],
    history: [{ date: "Feb 18 2026", who: "Jamal Carter", what: "v2.5 → v2.6 — updated evac map" }],
  },
  {
    id: "pol-m-002",
    name: "OSHA-10 — line workers",
    industries: ["manufacturing"],
    type: "certifications",
    status: "Active",
    summary: "OSHA 10-hour General Industry training; valid 5 years; verified against OSHA Outreach Trainer Portal.",
    scope: { locations: ["All Atlas plants"], roles: ["Operator", "Assembler", "Inspector"] },
    owner: { name: "Ben Fielding", initials: "BF" },
    version: "v1.4", lastReview: "Jan 06 2026", nextReview: "Jan 06 2027",
    rules: {
      credential: "OSHA-10",
      issuer: "OSHA Outreach Trainer Portal",
      cadence: "5 years",
      psv: true,
      warnWindow: "90 days",
      blockWindow: true,
      uploadRequired: true,
    },
    enforcement: { mode: "block", block: true },
    ack: { required: false },
    docs: [{ name: "OSHA10_card_guide.pdf", size: "186 KB" }],
    history: [{ date: "Jan 06 2026", who: "Ben Fielding", what: "Annual review — no changes" }],
  },
  {
    id: "pol-m-003",
    name: "Lockout / tagout (LOTO)",
    industries: ["manufacturing"],
    countries: ["US"],
    type: "training",
    status: "Active",
    summary: "29 CFR 1910.147 — energy-control procedure training, annual refresh; required for line work near LOTO zones.",
    scope: { locations: ["All Atlas plants"], roles: ["Operator", "Lead operator", "Maintenance Tech"] },
    owner: { name: "Ben Fielding", initials: "BF" },
    version: "v3.1", lastReview: "Oct 04 2025", nextReview: "Oct 04 2026",
    rules: {
      course: "LOTO — energy control",
      duration: "90 minutes",
      delivery: "Instructor-led",
      passing: "90%",
      renew: "Annual",
      vendor: "In-house safety",
    },
    enforcement: { mode: "block", block: true, autoSuspendDays: 0 },
    ack: { required: true, cadence: "Annual", current: 184, eligible: 192 },
    docs: [{ name: "LOTO_procedure_v3.1.pdf", size: "612 KB" }],
    history: [{ date: "Oct 04 2025", who: "Ben Fielding", what: "Added new conveyor zone" }],
  },
  {
    id: "pol-m-004",
    name: "Respirator fit test — annual",
    industries: ["manufacturing"],
    countries: ["US"],
    type: "safety",
    status: "Active",
    summary: "OSHA 29 CFR 1910.134 — quantitative fit test, annual; auto-suspend respirator zones on expiry.",
    scope: { locations: ["Atlas Plant #02 — paint", "Atlas Plant #04 — solvent"], roles: ["Operator (respirator zone)"] },
    owner: { name: "Sami Soto", initials: "SS" },
    version: "v2.0", lastReview: "Feb 28 2026", nextReview: "Feb 28 2027",
    rules: {
      scope: "Respirator-required zones — paint, solvent, abrasive blast",
      ppe: "Half-face APR + cartridge per zone matrix",
      drillCadence: "Annual",
      incidentLog: "Supervisor co-sign",
      rtw: true,
    },
    enforcement: { mode: "block", block: true },
    ack: { required: true, cadence: "Annual", current: 92, eligible: 96 },
    docs: [{ name: "Respiratory_Protection_v2.0.pdf", size: "1.4 MB" }],
    history: [{ date: "Feb 28 2026", who: "Sami Soto", what: "v1.4 → v2.0 — added abrasive blast zone" }],
  },
  {
    id: "pol-m-005",
    name: "Pre-employment background — Manufacturing",
    industries: ["manufacturing"],
    countries: ["US"],
    type: "background",
    status: "Active",
    summary: "Standard 7-year criminal lookback + 5-panel drug screen at hire. On-cause re-test enabled.",
    scope: { locations: ["All Atlas plants"], roles: ["All worker roles"] },
    owner: { name: "Sami Soto", initials: "SS" },
    version: "v2.4", lastReview: "Mar 11 2026", nextReview: "Mar 11 2027",
    rules: {
      package: "Standard",
      drug: "5-panel",
      randomDrug: false,
      vendor: "Checkr",
      refresh: "Hire only",
      lookback: "7 years",
    },
    enforcement: { mode: "block", block: true },
    ack: { required: false },
    docs: [{ name: "Checkr_mfg_2026.pdf", size: "1.2 MB" }],
    history: [{ date: "Mar 11 2026", who: "Sami Soto", what: "Vendor confirmed: Checkr" }],
  },
  {
    id: "pol-m-006",
    name: "Code of conduct — Atlas",
    industries: ["manufacturing"],
    type: "conduct",
    status: "Active",
    summary: "EHS-first conduct, no horseplay near machinery, anti-harassment, near-miss reporting expected.",
    scope: { locations: ["All Atlas plants"], roles: ["All worker roles"] },
    owner: { name: "Maya Chen", initials: "MC" },
    version: "v2.4", lastReview: "Mar 01 2026", nextReview: "Mar 01 2027",
    rules: {
      doc: "Atlas Code of Conduct v2.4",
      nda: false,
      ndaTerm: "—",
      ackSig: "Click-through",
      renew: "Annual",
    },
    enforcement: { mode: "block", block: true },
    ack: { required: true, cadence: "Annual", current: 184, eligible: 192 },
    docs: [{ name: "Atlas_Code_v2.4.pdf", size: "892 KB" }],
    history: [{ date: "Mar 01 2026", who: "Maya Chen", what: "Refreshed for 2026" }],
  },

  // ===== LOGISTICS — Continental / Midland =====
  {
    id: "pol-l-001",
    name: "CDL — Class A",
    industries: ["logistics"],
    type: "certifications",
    status: "Active",
    summary: "Active Commercial Driver License (Class A) required for any over-the-road route assignment.",
    scope: { locations: ["All terminals"], roles: ["Driver · Class A", "Lead driver"] },
    owner: { name: "Jamal Carter", initials: "JC" },
    version: "v1.2", lastReview: "Feb 01 2026", nextReview: "Feb 01 2027",
    rules: {
      credential: "Driver's license — Class A",
      issuer: "State DMV",
      cadence: "Per state",
      psv: true,
      warnWindow: "60 days",
      blockWindow: true,
      uploadRequired: true,
    },
    enforcement: { mode: "block", block: true },
    ack: { required: false },
    docs: [{ name: "CDL_renewal_runbook.pdf", size: "224 KB" }],
    history: [{ date: "Feb 01 2026", who: "Jamal Carter", what: "Enabled FMCSA continuous monitoring" }],
  },
  {
    id: "pol-l-002",
    name: "DOT physical — 2-year",
    industries: ["logistics"],
    type: "certifications",
    status: "Active",
    summary: "DOT medical examiner certificate; 2-year cadence; auto-suspend route assignment on expiry.",
    scope: { locations: ["All terminals"], roles: ["Driver · Class A", "Driver · Class B"] },
    owner: { name: "Sami Soto", initials: "SS" },
    version: "v1.3", lastReview: "Jan 06 2026", nextReview: "Jan 06 2027",
    rules: {
      credential: "DOT physical",
      issuer: "DOT-certified medical examiner",
      cadence: "2 years",
      psv: false,
      warnWindow: "30 days",
      blockWindow: true,
      uploadRequired: true,
    },
    enforcement: { mode: "block", block: true, autoSuspendDays: 0 },
    ack: { required: false },
    docs: [],
    history: [{ date: "Jan 06 2026", who: "Sami Soto", what: "v1.2 → v1.3 — tightened auto-suspend" }],
  },
  {
    id: "pol-l-003",
    name: "HAZMAT endorsement",
    industries: ["logistics"],
    type: "certifications",
    status: "Active",
    summary: "HAZMAT endorsement on CDL required for tanker / placarded loads. 5-year cycle, TSA screening.",
    scope: { locations: ["SLC, PHX, DEN terminals"], roles: ["Driver · HAZMAT"] },
    owner: { name: "Priya Ramesh", initials: "PR" },
    version: "v1.0", lastReview: "Mar 22 2026", nextReview: "Mar 22 2027",
    rules: {
      credential: "TWIC",
      issuer: "TSA / State DMV",
      cadence: "5 years",
      psv: false,
      warnWindow: "60 days",
      blockWindow: true,
      uploadRequired: true,
    },
    enforcement: { mode: "block", block: true },
    ack: { required: false },
    docs: [],
    history: [{ date: "Mar 22 2026", who: "Priya Ramesh", what: "Created from template" }],
  },
  {
    id: "pol-l-004",
    name: "MVR clean — annual",
    industries: ["logistics"],
    countries: ["US"],
    type: "background",
    status: "Active",
    summary: "Motor Vehicle Record pull annually; any major violation triggers review before next route.",
    scope: { locations: ["All terminals"], roles: ["Driver · Class A", "Driver · Class B"] },
    owner: { name: "Sami Soto", initials: "SS" },
    version: "v2.0", lastReview: "Feb 28 2026", nextReview: "Feb 28 2027",
    rules: {
      package: "DOT",
      drug: "DOT 5-panel",
      randomDrug: true,
      vendor: "First Advantage",
      refresh: "Annual",
      lookback: "5 years",
    },
    enforcement: { mode: "warn", strike: 1, block: true },
    ack: { required: false },
    docs: [{ name: "MVR_review_SOP.pdf", size: "192 KB" }],
    history: [{ date: "Feb 28 2026", who: "Sami Soto", what: "Added random drug component" }],
  },
  {
    id: "pol-l-005",
    name: "Terminal orientation — SLC",
    industries: ["logistics"],
    type: "training",
    status: "Active",
    summary: "Yard walk, dock procedures, fuel-island protocol, hours-of-service expectations.",
    scope: { locations: ["Midland Terminal SLC", "Midland Terminal DEN", "Midland Terminal PHX"], roles: ["All driver roles"] },
    owner: { name: "Ben Fielding", initials: "BF" },
    version: "v3.0", lastReview: "Feb 18 2026", nextReview: "Feb 18 2027",
    rules: {
      course: "Terminal orientation",
      duration: "60 minutes",
      delivery: "Blended",
      passing: "—",
      renew: "Per terminal",
      vendor: "In-house",
    },
    enforcement: { mode: "warn", strike: 1, block: true },
    ack: { required: true, cadence: "On hire + per terminal", current: 138, eligible: 144 },
    docs: [{ name: "Terminal_orientation_v3.0.pdf", size: "2.6 MB" }],
    history: [{ date: "Feb 18 2026", who: "Ben Fielding", what: "v2.4 → v3.0 — added EV charging-bay safety" }],
  },
  {
    id: "pol-l-006",
    name: "Hi-vis & steel-toe — yard",
    industries: ["logistics"],
    type: "attire",
    status: "Active",
    summary: "ASTM F2413 steel-toe + Class 3 hi-vis vest required in all yards and on loading docks.",
    scope: { locations: ["All terminals"], roles: ["Driver · Class A", "Driver · Class B", "Yard · forklift"] },
    owner: { name: "Dana Ellsworth", initials: "DE" },
    version: "v2.1", lastReview: "Nov 02 2025", nextReview: "Nov 02 2026",
    rules: {
      uniform: "Class 3 hi-vis vest",
      footwear: "ASTM F2413 steel-toe",
      hair: "—",
      nails: "—",
      jewelry: "No loose chains",
      fragrance: "Permitted",
      vendor: "Stipend reimbursed ($140 / yr)",
    },
    enforcement: { mode: "block", block: true },
    ack: { required: true, cadence: "On hire + annual", current: 142, eligible: 144 },
    docs: [{ name: "PPE_stipend_form_log.pdf", size: "98 KB" }],
    history: [{ date: "Nov 02 2025", who: "Dana Ellsworth", what: "Raised stipend ($95 → $140)" }],
  },
  {
    id: "pol-l-007",
    name: "DOT random drug & alcohol",
    industries: ["logistics"],
    countries: ["US"],
    type: "background",
    status: "Active",
    summary: "FMCSA random pool — quarterly draw, on-duty / post-accident tests, refusal = positive.",
    scope: { locations: ["All terminals"], roles: ["All driver roles"] },
    owner: { name: "Sami Soto", initials: "SS" },
    version: "v3.0", lastReview: "Mar 22 2026", nextReview: "Mar 22 2027",
    rules: {
      package: "DOT",
      drug: "DOT 5-panel",
      randomDrug: true,
      vendor: "First Advantage",
      refresh: "Continuous monitoring",
      lookback: "5 years",
    },
    enforcement: { mode: "block", block: true },
    ack: { required: false },
    docs: [],
    history: [{ date: "Mar 22 2026", who: "Sami Soto", what: "Confirmed pool size & cadence" }],
  },

  {
    id: "pol-x-014",
    name: "Legacy — paper timesheets",
    industries: ["all"],
    type: "attendance",
    status: "Archived",
    summary: "Paper-timesheet rules superseded by mobile clock-in in Q3 2025.",
    scope: { locations: ["—"], roles: ["—"] },
    owner: { name: "Devon Park", initials: "DP" },
    version: "v9.2", lastReview: "Jun 30 2025", nextReview: "—",
    rules: { breakMin: "—", restBreak: "—", otThreshold: ">40 hrs/week", lateGrace: "15 min", noShowEsc: false, callOut: "Same-day OK", geo: false },
    enforcement: { mode: "audit", block: false },
    ack: { required: false },
    docs: [],
    history: [
      { date: "Sep 01 2025", who: "Devon Park", what: "Archived — replaced by Flex Work mobile clock-in" },
    ],
  },
  {
    id: "pol-x-015",
    name: "Rate visibility — program default",
    industries: ["all"],
    type: "rate-visibility",
    status: "Active",
    summary: "Hides preferred pay rate from suppliers on the rate-card surface. Per-contract override allowed for strategic Tier-1 suppliers.",
    scope: { locations: ["All"], roles: ["All suppliers"] },
    owner: { name: "Maya Chen", initials: "MC" },
    version: "v1.2", lastReview: "Apr 12 2026", nextReview: "Apr 12 2027",
    rules: {
      default: "band-only", perSupplier: true,
      reason: "We share the pay-rate band so suppliers can submit inside the range, but hide the preferred number to protect candidate-side negotiation leverage.",
    },
    enforcement: { mode: "block", block: true },
    ack: { required: false },
    docs: [],
    history: [
      { date: "Apr 12 2026", who: "Maya Chen", what: "Switched default from 'visible' to 'band-only'" },
      { date: "Jan 04 2026", who: "Maya Chen", what: "Initial publication" },
    ],
  },
];

// ---------- Persistent store -------------------------------------------
// The store is keyed per (industry, country) so switching tenants OR
// switching the active country swaps in the right seed; edits stay
// isolated to that combination. See pages/locales.jsx for the country
// packs that replace the US certification rows.
function polCurrentIndustry() {
  return (window.getCurrentIndustryId && window.getCurrentIndustryId()) || "manufacturing";
}
function polCurrentCountry() {
  const c = (window.getCurrentCountry && window.getCurrentCountry()) || null;
  return (c && c.code) || "US";
}
function _polStoreKey(ind, ctry) { return ind + "::" + ctry; }
function polSeedFor(industryId, countryCode) {
  return POL_SEED.filter((r) => {
    const industries = r.industries || ["all"];
    if (!industries.some((i) => i === "all" || i === industryId)) return false;
    // `countries` is optional; absent = applies everywhere. Items tagged
    // explicitly with a country list (e.g. ["US"]) only surface when
    // that market is active. Country-equivalent rows are appended by
    // localizePolicyList — see pages/locales.jsx.
    const countries = r.countries;
    if (!countries || countries.indexOf("all") !== -1) return true;
    return countries.indexOf(countryCode) !== -1;
  });
}
// Register the seed so first-load currency formatting matches the active
// country (e.g. $120 → £120 when GB is active). Walks deeply into nested
// rules/history/etc., so "Stipend reimbursed ($85 / yr)" and history
// entries like "raised stipend ($60 → $85)" get swapped together.
if (typeof window !== "undefined" && window.registerCurrencyData) {
  window.registerCurrencyData(POL_SEED);
}
function polEnsureStore() {
  const ind  = polCurrentIndustry();
  const ctry = polCurrentCountry();
  const key  = _polStoreKey(ind, ctry);
  if (!window.__policyStore) window.__policyStore = { byKey: {} };
  // Back-compat: older sessions stored under .byIndustry or a flat
  // .rows shape. Both are discarded and re-seeded under the new keying
  // (industry + country) so policies + certifications follow the picker.
  if (window.__policyStore.byIndustry || Array.isArray(window.__policyStore.rows)) {
    window.__policyStore = { byKey: {} };
  }
  if (!window.__policyStore.byKey[key]) {
    let rows = polSeedFor(ind, ctry).map((r) => ({ ...r }));
    // Apply per-(industry, country) localization so US certifications
    // are replaced with country-equivalents (CNO / NMC / AHPRA / IHK /
    // 厚労省 …) and non-cert policies pick up regulator-name swaps.
    if (ctry !== "US" && typeof window.localizePolicyList === "function") {
      rows = window.localizePolicyList(rows, ind, ctry).map((r) => ({ ...r }));
    }
    // Track for live currency swap — the shallow clones above carry
    // their own top-level strings (e.g. `summary`) so a later country
    // change must walk this array too, not just POL_SEED.
    if (window.registerCurrencyData) window.registerCurrencyData(rows);
    window.__policyStore.byKey[key] = rows;
  }
  return {
    get rows() { return window.__policyStore.byKey[key]; },
    set rows(v) { window.__policyStore.byKey[key] = v; },
  };
}

// ---------- Small helpers ----------------------------------------------
function PolTypePill({ type }) {
  const meta = POL_TYPE_MAP[type];
  if (!meta) return null;
  return (
    <span className={"pol-type-pill " + polHueClass(meta.hue)}>
      <Icon name={meta.icon} size={14} />
      {meta.label}
    </span>
  );
}

function PolStatusPill({ status }) {
  const hue = POL_STATUS_HUES[status] || "default";
  return <span className={`req-pill req-pill--${hue}`}>{status}</span>;
}

function PolAckBar({ ack }) {
  if (!ack || !ack.required || !ack.eligible) {
    return <span className="pol-muted">—</span>;
  }
  const pct = Math.round((ack.current / ack.eligible) * 100);
  const hue = pct >= 95 ? "ok" : pct >= 80 ? "warn" : "err";
  return (
    <div className="pol-ack">
      <div className="pol-ack-bar"><span className={"pol-ack-fill pol-ack-fill--" + hue} style={{ width: pct + "%" }} /></div>
      <span className="pol-ack-text tabular">{ack.current}<span className="pol-muted">/{ack.eligible}</span> · {pct}%</span>
    </div>
  );
}

function PolEnforcementChip({ enforcement }) {
  const mode = enforcement?.mode || "audit";
  const meta = ({
    block: { label: "Block bookings",   cls: "pol-enf--block" },
    warn:  { label: "Warn worker",      cls: "pol-enf--warn" },
    audit: { label: "Audit only",       cls: "pol-enf--audit" },
  })[mode];
  return (
    <span className={"pol-enf " + meta.cls}>
      <span className="pol-enf-dot" />
      {meta.label}
    </span>
  );
}

// ---------- KPI strip --------------------------------------------------
function PolKpi({ label, value, foot, level }) {
  return (
    <div className={"vms-kpi" + (level === "err" ? " vms-kpi--alert" : "")}>
      <span className="vms-kpi-label">{label}</span>
      <span className="vms-kpi-value tabular">{value}</span>
      <span className="vms-kpi-foot"><span>{foot}</span></span>
    </div>
  );
}

// ---------- Detail side panel ------------------------------------------
function PolicyDetailPanel({ open, policy, onClose, onEdit, onArchive, onDuplicate }) {
  if (!policy) return <SidePanel open={open} title="Policy" onClose={onClose}>{null}</SidePanel>;
  const meta = POL_TYPE_MAP[policy.type];
  const schema = meta?.schema || [];

  return (
    <SidePanel
      open={open}
      title={policy.name}
      onClose={onClose}
      footer={(
        <React.Fragment>
          <button type="button" className="vms-btn vms-btn--danger" onClick={() => onArchive(policy)}>
            <Icon name="TrashCan" size={14} />{policy.status === "Archived" ? "Restore" : "Archive"}
          </button>
          <div style={{ flex: 1 }} />
          <button type="button" className="vms-btn vms-btn--secondary" onClick={() => onDuplicate(policy)}>
            <Icon name="Copy" size={14} />Duplicate
          </button>
          <button type="button" className="vms-btn vms-btn--primary" onClick={() => onEdit(policy)}>
            <Icon name="Edit" size={14} />Edit
          </button>
        </React.Fragment>
      )}
    >
      {/* Header summary */}
      <div className="pol-detail-head">
        <span className={"pol-icon-tile " + polHueClass(meta?.hue)}>
          <Icon name={meta?.icon || "Notes"} size={22} />
        </span>
        <div className="pol-detail-head-text">
          <div className="pol-detail-pills">
            <PolStatusPill status={policy.status} />
            <PolTypePill type={policy.type} />
            <span className="pol-muted pol-detail-meta">· {policy.version} · updated {policy.lastReview}</span>
          </div>
          <p className="pol-detail-summary">{policy.summary}</p>
        </div>
      </div>

      {/* Summary stats */}
      <div className="pol-stats">
        <div className="pol-stat">
          <div className="pol-stat-label">Workers covered</div>
          <div className="pol-stat-value tabular">{policy.ack?.eligible || "—"}</div>
          <div className="pol-stat-sub">{policy.scope.roles.join(" · ")}</div>
        </div>
        <div className="pol-stat">
          <div className="pol-stat-label">Acknowledgement</div>
          <div className="pol-stat-value tabular">
            {policy.ack?.required ? `${Math.round((policy.ack.current / policy.ack.eligible) * 100)}%` : "—"}
          </div>
          <div className="pol-stat-sub">{policy.ack?.required ? policy.ack.cadence : "Not required"}</div>
        </div>
        <div className="pol-stat">
          <div className="pol-stat-label">Enforcement</div>
          <div className="pol-stat-value pol-stat-value--enf"><PolEnforcementChip enforcement={policy.enforcement} /></div>
          <div className="pol-stat-sub">
            {policy.enforcement?.strike ? `${policy.enforcement.strike} strike(s) → block` : (policy.enforcement?.mode === "block" ? "Block on violation" : "Logged for audit only")}
          </div>
        </div>
        <div className="pol-stat">
          <div className="pol-stat-label">Next review</div>
          <div className="pol-stat-value tabular">{policy.nextReview}</div>
          <div className="pol-stat-sub">Owner · {policy.owner.name}</div>
        </div>
      </div>

      {/* Scope */}
      <section className="pol-section">
        <h3 className="pol-section-title">Scope</h3>
        <dl className="pol-kv">
          <dt>Sites</dt>
          <dd className="pol-chips">
            {policy.scope.locations.map((l) => <span key={l} className="pol-chip"><Icon name="Location" size={12} />{l}</span>)}
          </dd>
          <dt>Roles</dt>
          <dd className="pol-chips">
            {policy.scope.roles.map((r) => <span key={r} className="pol-chip"><Icon name="Person" size={12} />{r}</span>)}
          </dd>
        </dl>
      </section>

      {/* Rules — driven by the type schema so each type renders a tidy KV list */}
      <section className="pol-section">
        <h3 className="pol-section-title">Rules</h3>
        <dl className="pol-kv">
          {schema.map((f) => {
            const v = policy.rules[f.key];
            if (v === undefined || v === null || v === "") return null;
            return (
              <React.Fragment key={f.key}>
                <dt>{f.label}</dt>
                <dd>
                  {f.kind === "toggle"
                    ? (v ? <span className="pol-yes"><Icon name="Check" size={12} />Yes</span> : <span className="pol-no"><Icon name="X" size={12} />No</span>)
                    : <span>{v}</span>}
                </dd>
              </React.Fragment>
            );
          })}
        </dl>
      </section>

      {/* Enforcement (extended) */}
      <section className="pol-section">
        <h3 className="pol-section-title">Enforcement & acknowledgement</h3>
        <dl className="pol-kv">
          <dt>Mode</dt>
          <dd><PolEnforcementChip enforcement={policy.enforcement} /></dd>
          {policy.enforcement?.strike && (
            <React.Fragment>
              <dt>Strikes before block</dt><dd>{policy.enforcement.strike}</dd>
            </React.Fragment>
          )}
          {policy.enforcement?.autoSuspendDays != null && (
            <React.Fragment>
              <dt>Auto-suspend</dt><dd>{policy.enforcement.autoSuspendDays} days before expiry</dd>
            </React.Fragment>
          )}
          {policy.enforcement?.premium && (
            <React.Fragment>
              <dt>Premium</dt><dd>{policy.enforcement.premium}</dd>
            </React.Fragment>
          )}
          <dt>Ack required</dt>
          <dd>{policy.ack?.required ? <span className="pol-yes"><Icon name="Check" size={12} />Yes — {policy.ack.cadence}</span> : <span className="pol-no"><Icon name="X" size={12} />No</span>}</dd>
          {policy.ack?.required && policy.ack.eligible > 0 && (
            <React.Fragment>
              <dt>Coverage</dt>
              <dd><PolAckBar ack={policy.ack} /></dd>
            </React.Fragment>
          )}
        </dl>
      </section>

      {/* Documents */}
      {policy.docs && policy.docs.length > 0 && (
        <section className="pol-section">
          <h3 className="pol-section-title">Attached documents</h3>
          <ul className="pol-docs">
            {policy.docs.map((d) => (
              <li key={d.name} className="pol-doc">
                <span className="pol-doc-icon"><Icon name="File" size={18} /></span>
                <span className="pol-doc-name">{d.name}</span>
                <span className="pol-muted tabular">{d.size}</span>
                <button type="button" className="iconbtn" aria-label={`Download ${d.name}`} onClick={() => showToast(`Downloading ${d.name}`)}>
                  <Icon name="FileDownload" size={16} />
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* History */}
      <section className="pol-section">
        <h3 className="pol-section-title">Change history</h3>
        <ul className="pol-history">
          {policy.history.map((h, i) => (
            <li key={i}>
              <span className="pol-history-dot" />
              <div className="pol-history-body">
                <b>{h.what}</b>
                <span className="pol-muted">{h.who} · {h.date}</span>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </SidePanel>
  );
}

// ---------- Create / Edit panel ----------------------------------------
// Two-step UX: 1) pick type, 2) fill the type-shaped form. Used both for
// creating new and editing existing policies (in edit mode step 1 is skipped).
function PolicyCreatePanel({ open, mode, initial, onClose, onSave }) {
  const isEdit = mode === "edit";
  const [step, setStep] = usePol(isEdit ? 2 : 1);
  const [typeId, setTypeId] = usePol(initial?.type || null);
  const [values, setValues] = usePol(() => initial || {});

  useEffectPol(() => {
    if (!open) return;
    setStep(isEdit ? 2 : 1);
    setTypeId(initial?.type || null);
    setValues(initial || {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const meta = typeId ? POL_TYPE_MAP[typeId] : null;
  const setV = (k, v) => setValues((prev) => ({ ...prev, [k]: v }));
  const setRule = (k, v) => setValues((prev) => ({ ...prev, rules: { ...(prev.rules || {}), [k]: v } }));

  const canSave = !!(values.name && values.type);

  return (
    <SidePanel
      open={open}
      title={isEdit ? "Edit policy" : (step === 1 ? "New policy — choose type" : `New ${meta?.label?.toLowerCase() || ""} policy`)}
      onClose={onClose}
      footer={step === 1 ? (
        <React.Fragment>
          <button type="button" className="vms-btn vms-btn--tertiary" onClick={onClose}>Cancel</button>
          <div style={{ flex: 1 }} />
          <button
            type="button"
            className="vms-btn vms-btn--primary"
            disabled={!typeId}
            onClick={() => {
              setValues((prev) => ({
                status: "Draft",
                scope: { locations: [], roles: [] },
                owner: { name: "You", initials: "—" },
                version: "v0.1",
                lastReview: "—",
                nextReview: "—",
                rules: {},
                enforcement: { mode: "warn", block: false },
                ack: { required: false },
                docs: [],
                history: [{ date: "Today", who: "You", what: "Drafted" }],
                ...prev,
                type: typeId,
              }));
              setStep(2);
            }}
          >
            Next <Icon name="ChevronRight" size={14} />
          </button>
        </React.Fragment>
      ) : (
        <React.Fragment>
          {!isEdit && <button type="button" className="vms-btn vms-btn--tertiary" onClick={() => setStep(1)}><Icon name="ChevronLeft" size={14} />Back</button>}
          <div style={{ flex: 1 }} />
          <button type="button" className="vms-btn vms-btn--secondary" onClick={onClose}>Cancel</button>
          <button
            type="button"
            className="vms-btn vms-btn--primary"
            disabled={!canSave}
            onClick={() => onSave(values)}
          >
            <Icon name="Save" size={14} />{isEdit ? "Save changes" : "Create policy"}
          </button>
        </React.Fragment>
      )}
    >
      {step === 1 ? (
        <React.Fragment>
          <p className="pol-wizard-blurb">
            Pick the kind of rule you&rsquo;re writing. Each type ships with a sensible default field set —
            you can fine-tune it on the next step.
          </p>
          <div className="pol-type-grid">
            {POL_TYPES.map((t) => (
              <button
                key={t.id}
                type="button"
                className={"pol-type-card" + (typeId === t.id ? " pol-type-card--active" : "")}
                onClick={() => setTypeId(t.id)}
              >
                <span className={"pol-icon-tile " + polHueClass(t.hue)}>
                  <Icon name={t.icon} size={20} />
                </span>
                <span className="pol-type-card-title">{t.label}</span>
                <span className="pol-type-card-sub">{t.blurb}</span>
              </button>
            ))}
          </div>
        </React.Fragment>
      ) : (
        <React.Fragment>
          {/* Header summary */}
          <div className="pol-edit-head">
            <span className={"pol-icon-tile " + polHueClass(meta?.hue)}>
              <Icon name={meta?.icon || "Notes"} size={20} />
            </span>
            <div>
              <div className="pol-edit-typelabel">{meta?.label}</div>
              <div className="pol-muted">{meta?.blurb}</div>
            </div>
            {!isEdit && (
              <button type="button" className="vms-btn vms-btn--sm vms-btn--tertiary" onClick={() => setStep(1)}>Change type</button>
            )}
          </div>

          {/* Basics */}
          <h3 className="pol-section-title pol-section-title--first">Basics</h3>
          <div className="pol-form-grid">
            <Field label="Policy name" required style={{ gridColumn: "1 / -1" }}>
              <TextInput value={values.name || ""} onChange={(v) => setV("name", v)} placeholder={polExamples().name} />
            </Field>
            <Field label="Summary" style={{ gridColumn: "1 / -1" }}>
              <div className="fld-control" style={{ minHeight: 72, alignItems: "flex-start", paddingTop: 10 }}>
                <textarea
                  className="fld-input"
                  rows={3}
                  value={values.summary || ""}
                  onChange={(e) => setV("summary", e.target.value)}
                  placeholder="One-line description that shows in the list and at the top of the detail view."
                  style={{ resize: "vertical", minHeight: 60, background: "transparent" }}
                />
              </div>
            </Field>
            <Field label="Status">
              <div className="fld-control fld-control--input">
                <select className="fld-input" value={values.status || "Draft"} onChange={(e) => setV("status", e.target.value)}
                        style={{ background: "transparent", border: "none", outline: "none", width: "100%", cursor: "pointer" }}>
                  {["Draft", "Active", "Review", "Archived"].map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </Field>
            <Field label="Owner">
              <TextInput value={values.owner?.name || ""} onChange={(v) => setV("owner", { name: v, initials: (v || "").split(/\s+/).map((w) => w[0]).slice(0,2).join("").toUpperCase() })} placeholder="Person responsible" />
            </Field>
          </div>

          {/* Scope */}
          <h3 className="pol-section-title">Scope</h3>
          <div className="pol-form-grid">
            <Field label="Sites" style={{ gridColumn: "1 / -1" }} hint="Comma-separated, or pick from the org tree (mock)">
              <TextInput
                value={(values.scope?.locations || []).join(", ")}
                onChange={(v) => setV("scope", { ...(values.scope || {}), locations: v.split(",").map((s) => s.trim()).filter(Boolean) })}
                placeholder={polExamples().locations}
              />
            </Field>
            <Field label="Roles" style={{ gridColumn: "1 / -1" }}>
              <TextInput
                value={(values.scope?.roles || []).join(", ")}
                onChange={(v) => setV("scope", { ...(values.scope || {}), roles: v.split(",").map((s) => s.trim()).filter(Boolean) })}
                placeholder={polExamples().roles}
              />
            </Field>
          </div>

          {/* Type-specific rules */}
          <h3 className="pol-section-title">{meta?.label} rules</h3>
          <div className="pol-form-grid">
            {(meta?.schema || []).map((f) => (
              <Field key={f.key} label={f.label} style={{ gridColumn: f.kind === "toggle" ? "auto" : "1 / -1" }}>
                {f.kind === "toggle" ? (
                  <div style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
                    <Switch checked={!!values.rules?.[f.key]} onChange={(v) => setRule(f.key, v)} ariaLabel={f.label} />
                    <span style={{ font: "var(--evr-body2)", color: "var(--evr-content-primary-default)" }}>
                      {values.rules?.[f.key] ? "On" : "Off"}
                    </span>
                  </div>
                ) : f.kind === "select" ? (
                  <div className="fld-control fld-control--input">
                    <select className="fld-input" value={values.rules?.[f.key] || ""} onChange={(e) => setRule(f.key, e.target.value)}
                            style={{ background: "transparent", border: "none", outline: "none", width: "100%", cursor: "pointer" }}>
                      <option value="">Select…</option>
                      {f.options.map((o) => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </div>
                ) : (
                  <TextInput value={values.rules?.[f.key] || ""} onChange={(v) => setRule(f.key, v)} placeholder={f.placeholder} />
                )}
              </Field>
            ))}
          </div>

          {/* Enforcement */}
          <h3 className="pol-section-title">Enforcement</h3>
          <div className="pol-radiogrid">
            {[
              { id: "block", label: "Block bookings",   sub: "Worker can't accept a shift until they comply" },
              { id: "warn",  label: "Warn worker",      sub: "Show warning at clock-in; escalate after strikes" },
              { id: "audit", label: "Audit only",       sub: "Log violations but don't block work" },
            ].map((opt) => (
              <button
                key={opt.id}
                type="button"
                className={"pol-radio" + (values.enforcement?.mode === opt.id ? " pol-radio--active" : "")}
                onClick={() => setV("enforcement", { ...(values.enforcement || {}), mode: opt.id })}
              >
                <span className={"pol-radio-dot" + (values.enforcement?.mode === opt.id ? " on" : "")} />
                <span className="pol-radio-body">
                  <b>{opt.label}</b>
                  <span className="pol-muted">{opt.sub}</span>
                </span>
              </button>
            ))}
          </div>

          {/* Ack */}
          <h3 className="pol-section-title">Acknowledgement</h3>
          <div className="pol-form-grid">
            <Field label="Workers must acknowledge">
              <div style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
                <Switch
                  checked={!!values.ack?.required}
                  onChange={(v) => setV("ack", { ...(values.ack || {}), required: v })}
                  ariaLabel="Require acknowledgement"
                />
                <span style={{ font: "var(--evr-body2)" }}>{values.ack?.required ? "Required" : "Not required"}</span>
              </div>
            </Field>
            {values.ack?.required && (
              <Field label="Cadence">
                <div className="fld-control fld-control--input">
                  <select className="fld-input" value={values.ack?.cadence || ""} onChange={(e) => setV("ack", { ...(values.ack || {}), cadence: e.target.value })}
                          style={{ background: "transparent", border: "none", outline: "none", width: "100%", cursor: "pointer" }}>
                    <option value="">Select cadence…</option>
                    {["On hire","Annual","On policy change","Quarterly","Annual + on hire"].map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </Field>
            )}
          </div>
        </React.Fragment>
      )}
    </SidePanel>
  );
}

// ---------- Main page --------------------------------------------------
function PoliciesSettingsPage() {
  const store = polEnsureStore();
  const [rows, setRows] = usePol(() => store.rows.map((r) => ({ ...r })));
  const [typeFilter, setTypeFilter] = usePol("all");
  const [statusFilter, setStatusFilter] = usePol("active");
  const [query, setQuery] = usePol("");

  const [detail, setDetail] = usePol({ open: false, id: null });
  const [editor, setEditor] = usePol({ open: false, mode: null, initial: null });

  // Keep window store in sync.
  useEffectPol(() => { store.rows = rows; }, [rows, store]);

  // Counts
  const counts = useMemoPol(() => {
    let active = 0, draft = 0, review = 0, archived = 0;
    rows.forEach((r) => {
      if (r.status === "Active") active++;
      else if (r.status === "Draft") draft++;
      else if (r.status === "Review") review++;
      else if (r.status === "Archived") archived++;
    });
    const ackEligible = rows.reduce((s, r) => s + (r.ack?.eligible || 0), 0);
    const ackCurrent  = rows.reduce((s, r) => s + (r.ack?.current  || 0), 0);
    const ackPct = ackEligible ? Math.round((ackCurrent / ackEligible) * 100) : 0;
    const ackGap = ackEligible - ackCurrent;
    return { active, draft, review, archived, ackPct, ackGap };
  }, [rows]);

  // Filtered list
  const filtered = useMemoPol(() => {
    return rows.filter((r) => {
      if (typeFilter !== "all" && r.type !== typeFilter) return false;
      if (statusFilter !== "all") {
        if (statusFilter === "active" && r.status === "Archived") return false;
        if (statusFilter === "archived" && r.status !== "Archived") return false;
        if (statusFilter === "drafts" && r.status !== "Draft") return false;
        if (statusFilter === "review" && r.status !== "Review") return false;
      }
      if (query) {
        const q = query.toLowerCase();
        if (!(r.name.toLowerCase().includes(q) || r.summary.toLowerCase().includes(q))) return false;
      }
      return true;
    });
  }, [rows, typeFilter, statusFilter, query]);

  const detailPolicy = detail.id ? rows.find((r) => r.id === detail.id) : null;

  // Handlers
  const openDetail = (id) => setDetail({ open: true, id });
  const closeDetail = () => setDetail((d) => ({ ...d, open: false }));

  const onNew = () => setEditor({ open: true, mode: "create", initial: null });
  const onEdit = (p) => {
    setDetail((d) => ({ ...d, open: false }));
    setEditor({ open: true, mode: "edit", initial: { ...p } });
  };
  const onDuplicate = (p) => {
    const copy = { ...p, id: "pol-" + Date.now(), name: p.name + " (copy)", status: "Draft", version: "v0.1",
                   history: [{ date: "Today", who: "You", what: "Duplicated from " + p.name }] };
    setRows((prev) => [copy, ...prev]);
    setDetail((d) => ({ ...d, open: false }));
    showToast("Policy duplicated as draft", { kind: "success" });
  };
  const onArchive = (p) => {
    const next = p.status === "Archived" ? "Active" : "Archived";
    setRows((prev) => prev.map((r) => r.id === p.id ? { ...r, status: next,
      history: [{ date: "Today", who: "You", what: next === "Archived" ? "Archived" : "Restored to active" }, ...r.history] } : r));
    setDetail((d) => ({ ...d, open: false }));
    showToast(next === "Archived" ? "Policy archived" : "Policy restored", { kind: "success" });
  };
  const onSave = (vals) => {
    if (editor.mode === "edit") {
      setRows((prev) => prev.map((r) => r.id === vals.id ? { ...vals } : r));
      showToast("Policy saved", { kind: "success" });
    } else {
      const id = "pol-" + Date.now();
      setRows((prev) => [{ ...vals, id }, ...prev]);
      showToast("Policy created", { kind: "success" });
    }
    setEditor((e) => ({ ...e, open: false }));
  };

  const typeOptions = [
    { id: "all", label: "All types", count: rows.length },
    ...POL_TYPES.map((t) => ({ id: t.id, label: t.label, count: rows.filter((r) => r.type === t.id).length, icon: t.icon })),
  ];

  return (
    <div className="set-content">
      {/* v0.77 spec §17 · per-axis policy applicability preview. Phase
          4 lets each policy scope to a (Work Type × Billing Model)
          tuple. Banner hidden at flag-off. */}
      {window.V77InfoBanner ? (
        <window.V77InfoBanner
          icon="Information"
          title="Policies gain per-axis applicability."
        >
          Phase 4 scopes each policy to an axis tuple &mdash; rate-card policy per Billing Model, time-off accrual per Work Type, overtime calculation per (Shift &times; ClockInOut). Today&rsquo;s policies still apply globally.
        </window.V77InfoBanner>
      ) : null}
      <header className="set-content-header pol-page-head">
        <div>
          <h2 className="set-content-title">Policies</h2>
          <p className="set-content-sub">
            Define the rules workers and managers follow — attire, certifications, screening, training, time &amp; attendance, conduct, and safety.
          </p>
        </div>
        <div className="pol-head-actions">
          <button type="button" className="vms-btn vms-btn--secondary" onClick={() => showToast("Imported 0 policies (mock)")}>
            <Icon name="Import" size={14} />Import
          </button>
          <button type="button" className="vms-btn vms-btn--primary" onClick={onNew}>
            <Icon name="AddCircle" size={14} />New policy
          </button>
        </div>
      </header>

      {/* KPI strip */}
      <div className="vms-kpis">
        <PolKpi label="Active policies"     value={counts.active}   foot={`${counts.archived} archived`} />
        <PolKpi label="In draft"            value={counts.draft}    foot="not enforced" />
        <PolKpi label="Up for review"       value={counts.review}   foot="owner action needed" level={counts.review > 0 ? "err" : ""} />
        <PolKpi label="Acknowledgement"     value={counts.ackPct + "%"} foot={counts.ackGap > 0 ? `${counts.ackGap} outstanding` : "all caught up"} />
        <PolKpi label="Policy types in use" value={POL_TYPES.filter((t) => rows.some((r) => r.type === t.id)).length} foot="of 7 available" />
      </div>

      {/* Toolbar */}
      <div className="pol-toolbar">
        <div className="pol-type-chips">
          {typeOptions.map((o) => (
            <button
              key={o.id}
              type="button"
              className={"fw-tab" + (typeFilter === o.id ? " is-active" : "")}
              aria-pressed={typeFilter === o.id}
              onClick={() => setTypeFilter(o.id)}
            >
              {o.icon && <Icon name={o.icon} size={14} />}
              {o.label}
              <span className="fw-tab-count">{o.count}</span>
            </button>
          ))}
        </div>
        <div className="pol-toolbar-right">
          <div className="pol-status-segment" role="tablist" aria-label="Status filter">
            {[
              { id: "active",   label: "Active" },
              { id: "drafts",   label: "Drafts" },
              { id: "review",   label: "Review" },
              { id: "archived", label: "Archived" },
              { id: "all",      label: "All" },
            ].map((s) => (
              <button
                key={s.id}
                type="button"
                role="tab"
                aria-selected={statusFilter === s.id}
                className={"pol-segment-btn" + (statusFilter === s.id ? " is-active" : "")}
                onClick={() => setStatusFilter(s.id)}
              >
                {s.label}
              </button>
            ))}
          </div>
          <div className="pol-search">
            <Icon name="Search" size={16} />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search policies…"
            />
          </div>
        </div>
      </div>

      {/* Table */}
      <section className="content-card pol-table-card">
        <div className="pol-table">
          <div className="pol-row pol-row--head" role="row">
            <div className="pol-col pol-col--name">Policy</div>
            <div className="pol-col pol-col--type">Type</div>
            <div className="pol-col pol-col--scope">Scope</div>
            <div className="pol-col pol-col--enf">Enforcement</div>
            <div className="pol-col pol-col--ack">Acknowledgement</div>
            <div className="pol-col pol-col--ver">Version · Reviewed</div>
            <div className="pol-col pol-col--status">Status</div>
            <div className="pol-col pol-col--act" aria-label="Actions" />
          </div>
          {filtered.map((p) => {
            const meta = POL_TYPE_MAP[p.type];
            return (
              <button
                key={p.id}
                type="button"
                className="pol-row"
                role="row"
                onClick={() => openDetail(p.id)}
              >
                <div className="pol-col pol-col--name">
                  <span className={"pol-icon-tile pol-icon-tile--sm " + polHueClass(meta?.hue)}>
                    <Icon name={meta?.icon || "Notes"} size={16} />
                  </span>
                  <div className="pol-row-name-text">
                    <div className="pol-row-title">{p.name}</div>
                    <div className="pol-row-summary">{p.summary}</div>
                  </div>
                </div>
                <div className="pol-col pol-col--type">
                  <PolTypePill type={p.type} />
                </div>
                <div className="pol-col pol-col--scope">
                  <div className="pol-scope">
                    <span className="pol-scope-line"><Icon name="Location" size={12} />{p.scope.locations.length === 1 ? p.scope.locations[0] : `${p.scope.locations.length} locations`}</span>
                    <span className="pol-scope-line pol-muted"><Icon name="Person" size={12} />{p.scope.roles.length <= 2 ? p.scope.roles.join(" · ") : `${p.scope.roles.length} roles`}</span>
                  </div>
                </div>
                <div className="pol-col pol-col--enf">
                  <PolEnforcementChip enforcement={p.enforcement} />
                </div>
                <div className="pol-col pol-col--ack">
                  <PolAckBar ack={p.ack} />
                </div>
                <div className="pol-col pol-col--ver">
                  <div className="pol-row-ver">
                    <span className="tabular">{p.version}</span>
                    <span className="pol-muted">{p.lastReview}</span>
                  </div>
                </div>
                <div className="pol-col pol-col--status">
                  <PolStatusPill status={p.status} />
                </div>
                <div className="pol-col pol-col--act">
                  <span className="iconbtn" aria-hidden="true"><Icon name="ChevronRight" size={16} /></span>
                </div>
              </button>
            );
          })}
          {filtered.length === 0 && (
            <div className="pol-empty">
              <Icon name="Notes" size={32} />
              <p>No policies match these filters.</p>
              <button type="button" className="vms-btn vms-btn--secondary vms-btn--sm" onClick={() => { setTypeFilter("all"); setStatusFilter("all"); setQuery(""); }}>
                Clear filters
              </button>
            </div>
          )}
        </div>
      </section>

      {/* Side panels */}
      <PolicyDetailPanel
        open={detail.open}
        policy={detailPolicy}
        onClose={closeDetail}
        onEdit={onEdit}
        onDuplicate={onDuplicate}
        onArchive={onArchive}
      />
      <PolicyCreatePanel
        open={editor.open}
        mode={editor.mode}
        initial={editor.initial}
        onClose={() => setEditor((e) => ({ ...e, open: false }))}
        onSave={onSave}
      />
    </div>
  );
}

Object.assign(window, { PoliciesSettingsPage });
