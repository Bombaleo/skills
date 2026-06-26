// =====================================================================
// Flex Work — SOW (Statement of Work) worker type
//   Gated by the `sow` feature flag. When ON, this module:
//     · Provides a sample SOW agreement set (SOW_AGREEMENTS_RAW) modeling
//       supplier-delivered, scope-based engagements
//     · Tracks deliverables, milestones, payment terms, retainage,
//       change orders, and acceptance criteria
//     · Drives a dashboard SOW lane (active SOWs · milestones due ·
//       deliverable burndown · committed-vs-consumed spend)
//     · Adds an SOW Resources pool to Workforce — supplier-managed
//       people executing under an active SOW (additive; the existing
//       Frontline / Agency / Internal pools remain untouched)
//     · Produces invoices on milestone submission and acceptance
//
//   Capability covers the SOW workbench, event management, fee
//   schedule, deliverable acceptance, milestone-based invoicing,
//   change orders, and MSA → SOW hierarchy.
//
//   Public API (window.*):
//     · getSOWs()                            → array
//     · getSOWById(id)                       → row | null
//     · getSOWMilestones(sowId)              → array
//     · getSOWDeliverables(sowId)            → array
//     · getSOWChangeOrders(sowId)            → array
//     · getSOWResources(sowId?)              → array
//     · getSOWInvoices()                     → array
//     · isSowResource(worker)                → boolean
//     · sowBillingLabel(model)               → "Fixed-fee" | "Milestone" | "T&M (capped)"
//     · sowStatusMeta(status)                → { fg, bg, label }
//     · sowMilestoneStatusMeta(status)       → { fg, bg, label }
//     · sowFmtMoney(amount, currency)        → string
//     · sowMetrics()                         → { active, draft, milestonesDue7d,
//                                                deliverablesOverdue, invoicesPending,
//                                                committed, consumed, remaining,
//                                                changeOrdersOpen }
//
//   Data model alignment (Dayforce primitives):
//     · SOW agreement   → SupplierContract subtype "SOW" (extends Supplier)
//                         + ContingentEngagement.engagementType = "SOW"
//     · Milestone       → SupplierContractMilestone (new entity, child of
//                         SupplierContract) — fires a BillingEvent on
//                         acceptance instead of a TimePair → BillingLine
//     · Deliverable     → SupplierContractDeliverable (new entity)
//     · SOW resource    → Employee + workerType = "Contingent" +
//                         sourcingChannel = "SOW" + engagementRef = sowId
//     · Change order    → SupplierContractAmendment (existing)
//     · Invoice         → SupplierInvoice (Flex Work–owned), unchanged
//   Maps the canonical SOW + Statement of Work primitives 1:1.
// =====================================================================

// ---------- Sample SOW agreements -------------------------------------
// Each SOW:
//   { id, name, supplier, supplierLabel, msaRef, status,
//     country, countryName, flag, startDate, endDate,
//     billingModel ("fixed" | "milestone" | "tm_capped"),
//     totalValue, currency, consumed, retainagePct, paymentTerms,
//     category, owner, costCenter, riskScore,
//     summary }
//
// Status vocab:
//   Draft       → buyer is composing the SOW
//   In approval → routed to approvers (legal / finance / department)
//   Active      → executed, work is in flight
//   On hold     → paused (typically pending change order)
//   Completed   → all milestones accepted, awaiting closeout invoice
//   Closed      → financially closed, archived
//
// supplier codes match the suppliers.jsx catalog so the chip / logo
// helpers in the rest of the app keep working.
const SOW_AGREEMENTS_RAW = [
  {
    id: "SOW-2026-018",
    name: "Core HRIS → Dayforce migration · Phase 2",
    supplier: "ap", supplierLabel: "AlphaTech Partners",
    msaRef: "MSA-AP-2024",
    status: "Active",
    country: "US", countryName: "United States", flag: "us",
    startDate: "2026-02-01", endDate: "2026-09-30",
    billingModel: "milestone",
    totalValue: 1_240_000, currency: "USD",
    consumed: 612_500,
    retainagePct: 10,
    paymentTerms: "Net 45 · 10% retainage held until closeout",
    category: "Professional services · Implementation",
    owner: "Amy Hennen", costCenter: "CC-100 · IT Platform",
    riskScore: "Medium",
    summary:
      "Lift the HCM data layer onto Dayforce primitives. Five deliverable streams (data model, payroll integration, time & attendance, scheduling, cutover) with acceptance gates between each.",
  },
  {
    id: "SOW-2026-019",
    name: "Distribution-center buildout · Phoenix",
    supplier: "wf", supplierLabel: "WorkForce Now",
    msaRef: "MSA-WF-2023",
    status: "Active",
    country: "US", countryName: "United States", flag: "us",
    startDate: "2026-03-15", endDate: "2026-08-15",
    billingModel: "fixed",
    totalValue: 485_000, currency: "USD",
    consumed: 145_500,
    retainagePct: 5,
    paymentTerms: "Net 30 · 5% retainage until punch list cleared",
    category: "Facilities · General contracting",
    owner: "Terry Donin", costCenter: "CC-340 · DC Phoenix",
    riskScore: "Low",
    summary:
      "Fit-out for 220 000 sq ft DC. Fixed-fee with a defined punch-list acceptance and weekly progress reporting.",
  },
  {
    id: "SOW-2026-020",
    name: "Frontline scheduling AI · evaluation pilot",
    supplier: "sw", supplierLabel: "StaffWise",
    msaRef: "MSA-SW-2025",
    status: "In approval",
    country: "CA", countryName: "Canada", flag: "ca",
    startDate: "2026-06-01", endDate: "2026-11-30",
    billingModel: "milestone",
    totalValue: 320_000, currency: "CAD",
    consumed: 0,
    retainagePct: 15,
    paymentTerms: "Net 30 · 15% retainage held until pilot signoff",
    category: "Professional services · AI / ML",
    owner: "Amy Hennen", costCenter: "CC-220 · Workforce Innovation",
    riskScore: "Medium",
    summary:
      "Six-month evaluation of a scheduling-assist model on three pilot sites. Acceptance criteria tied to fill-rate lift and overtime reduction.",
  },
  {
    id: "SOW-2026-014",
    name: "EU benefits portal · localization",
    supplier: "ap", supplierLabel: "AlphaTech Partners",
    msaRef: "MSA-AP-2024",
    status: "Active",
    country: "GB", countryName: "United Kingdom", flag: "gb",
    startDate: "2026-01-08", endDate: "2026-07-31",
    billingModel: "tm_capped",
    totalValue: 540_000, currency: "GBP",
    consumed: 318_000,
    retainagePct: 0,
    paymentTerms: "Net 30 · weekly T&M against capped pool",
    category: "Professional services · Localization",
    owner: "Beatriz Almeida", costCenter: "CC-410 · EMEA HR Tech",
    riskScore: "Medium",
    summary:
      "Localize the employee benefits portal for 14 EU markets. T&M against a £540k cap with weekly burn reports and a cap-breach early-warning at 80%.",
  },
  {
    id: "SOW-2025-088",
    name: "Year-end compliance reporting · APAC",
    supplier: "wf", supplierLabel: "WorkForce Now",
    msaRef: "MSA-WF-2023",
    status: "Completed",
    country: "SG", countryName: "Singapore", flag: "sg",
    startDate: "2025-10-01", endDate: "2026-03-31",
    billingModel: "fixed",
    totalValue: 168_000, currency: "USD",
    consumed: 168_000,
    retainagePct: 0,
    paymentTerms: "Net 30 · final invoice on acceptance",
    category: "Professional services · Compliance",
    owner: "Mira Wijaya", costCenter: "CC-510 · APAC HR",
    riskScore: "Low",
    summary:
      "Statutory year-end reporting for SG · MY · AU. All four milestones accepted; closeout invoice approved Apr 14.",
  },
  {
    id: "SOW-2026-022",
    name: "Talent acquisition site redesign",
    supplier: "sw", supplierLabel: "StaffWise",
    msaRef: "MSA-SW-2025",
    status: "Draft",
    country: "US", countryName: "United States", flag: "us",
    startDate: "2026-07-01", endDate: "2026-12-15",
    billingModel: "milestone",
    totalValue: 215_000, currency: "USD",
    consumed: 0,
    retainagePct: 10,
    paymentTerms: "Net 30 · 10% retainage held until launch",
    category: "Professional services · Design",
    owner: "Beatriz Almeida", costCenter: "CC-225 · Brand & TA",
    riskScore: "Low",
    summary:
      "Redesign of dayforcecareers.com including a new candidate hub and an applicant-tracking integration with Dayforce Recruiting.",
  },
  {
    id: "SOW-2026-009",
    name: "Mexico payroll integration · Phase 1",
    supplier: "ap", supplierLabel: "AlphaTech Partners",
    msaRef: "MSA-AP-2024",
    status: "On hold",
    country: "MX", countryName: "Mexico", flag: "mx",
    startDate: "2025-12-01", endDate: "2026-06-30",
    billingModel: "milestone",
    totalValue: 410_000, currency: "USD",
    consumed: 184_500,
    retainagePct: 10,
    paymentTerms: "Net 45 · 10% retainage",
    category: "Professional services · Integration",
    owner: "Tomás Vega", costCenter: "CC-720 · LATAM Payroll",
    riskScore: "High",
    summary:
      "Paused pending Change Order #2 (in-scope IMSS / SUA filing flow). Buyer-side approval expected this week.",
  },
];

// ---------- Milestones (per SOW) --------------------------------------
// Status vocab:
//   Planned    → not started
//   In progress → work underway
//   Submitted  → supplier submitted for acceptance
//   Accepted   → buyer accepted, triggers invoice
//   Paid       → invoice settled
//   Rejected   → returned to supplier with rework notes
const SOW_MILESTONES = {
  "SOW-2026-018": [
    { id: "ms-018-1", name: "Data model alignment doc",          due: "2026-03-15", value: 124_000, status: "Paid",        acceptedOn: "2026-03-18" },
    { id: "ms-018-2", name: "Org hierarchy migration",            due: "2026-04-30", value: 186_000, status: "Paid",        acceptedOn: "2026-05-04" },
    { id: "ms-018-3", name: "Position & job catalog cutover",     due: "2026-05-22", value: 186_000, status: "Submitted",   acceptedOn: null },
    { id: "ms-018-4", name: "Time & attendance integration",      due: "2026-07-10", value: 248_000, status: "In progress", acceptedOn: null },
    { id: "ms-018-5", name: "Payroll · GL integration",           due: "2026-08-22", value: 248_000, status: "Planned",     acceptedOn: null },
    { id: "ms-018-6", name: "Cutover · production go-live",       due: "2026-09-30", value: 248_000, status: "Planned",     acceptedOn: null },
  ],
  "SOW-2026-019": [
    { id: "ms-019-1", name: "Mobilization & site prep",           due: "2026-04-04", value:  72_750, status: "Paid",        acceptedOn: "2026-04-08" },
    { id: "ms-019-2", name: "Racking & dock equipment",           due: "2026-05-30", value:  72_750, status: "In progress", acceptedOn: null },
    { id: "ms-019-3", name: "WMS commissioning",                  due: "2026-07-04", value: 145_500, status: "Planned",     acceptedOn: null },
    { id: "ms-019-4", name: "Punch list & handover",              due: "2026-08-15", value: 194_000, status: "Planned",     acceptedOn: null },
  ],
  "SOW-2026-020": [
    { id: "ms-020-1", name: "Discovery & success metrics",        due: "2026-06-30", value:  48_000, status: "Planned",     acceptedOn: null },
    { id: "ms-020-2", name: "Pilot deployment · 3 sites",         due: "2026-08-15", value:  96_000, status: "Planned",     acceptedOn: null },
    { id: "ms-020-3", name: "Mid-pilot review",                   due: "2026-09-30", value:  48_000, status: "Planned",     acceptedOn: null },
    { id: "ms-020-4", name: "Final report & recommendation",      due: "2026-11-30", value: 128_000, status: "Planned",     acceptedOn: null },
  ],
  "SOW-2026-014": [
    { id: "ms-014-1", name: "Discovery · 14 locales",             due: "2026-02-12", value:   0,     status: "Paid",        acceptedOn: "2026-02-13", note: "T&M draw 1" },
    { id: "ms-014-2", name: "Translation memory build",           due: "2026-04-04", value:   0,     status: "Paid",        acceptedOn: "2026-04-07", note: "T&M draw 2" },
    { id: "ms-014-3", name: "DE · FR · ES · IT release",          due: "2026-05-22", value:   0,     status: "Submitted",   acceptedOn: null,         note: "T&M draw 3" },
    { id: "ms-014-4", name: "Nordics + Eastern EU release",       due: "2026-07-04", value:   0,     status: "In progress", acceptedOn: null },
    { id: "ms-014-5", name: "UAT & sign-off",                     due: "2026-07-31", value:   0,     status: "Planned",     acceptedOn: null },
  ],
  "SOW-2025-088": [
    { id: "ms-088-1", name: "SG IR8A filing",                     due: "2025-12-15", value:  42_000, status: "Paid",        acceptedOn: "2025-12-18" },
    { id: "ms-088-2", name: "MY EA form filing",                  due: "2026-01-31", value:  42_000, status: "Paid",        acceptedOn: "2026-02-02" },
    { id: "ms-088-3", name: "AU PAYG summary",                    due: "2026-02-28", value:  42_000, status: "Paid",        acceptedOn: "2026-03-03" },
    { id: "ms-088-4", name: "Closeout report",                    due: "2026-03-31", value:  42_000, status: "Paid",        acceptedOn: "2026-04-02" },
  ],
  "SOW-2026-022": [
    { id: "ms-022-1", name: "Brand & content strategy",           due: "2026-08-04", value:  43_000, status: "Planned",     acceptedOn: null },
    { id: "ms-022-2", name: "Design system extension",            due: "2026-09-30", value:  64_500, status: "Planned",     acceptedOn: null },
    { id: "ms-022-3", name: "Build · candidate hub",              due: "2026-11-15", value:  64_500, status: "Planned",     acceptedOn: null },
    { id: "ms-022-4", name: "ATS integration · launch",           due: "2026-12-15", value:  43_000, status: "Planned",     acceptedOn: null },
  ],
  "SOW-2026-009": [
    { id: "ms-009-1", name: "IMSS data discovery",                due: "2026-01-22", value:  82_000, status: "Paid",        acceptedOn: "2026-01-26" },
    { id: "ms-009-2", name: "Net-pay rules · build",              due: "2026-03-30", value: 102_500, status: "Paid",        acceptedOn: "2026-04-03" },
    { id: "ms-009-3", name: "SUA filing flow",                    due: "2026-05-15", value: 102_500, status: "Rejected",    acceptedOn: null, note: "Scope question · Change Order #2" },
    { id: "ms-009-4", name: "UAT & cutover",                      due: "2026-06-30", value: 123_000, status: "Planned",     acceptedOn: null },
  ],
};

// ---------- Deliverables (per SOW) ------------------------------------
// Discrete named outputs the supplier owes. Tied to milestones via
// `milestoneId` so the dashboard can flag deliverables-at-risk.
const SOW_DELIVERABLES = {
  "SOW-2026-018": [
    { id: "dl-018-1", name: "Entity → OrgUnit mapping spec",            milestoneId: "ms-018-1", status: "Accepted" },
    { id: "dl-018-2", name: "Test plan & acceptance criteria",          milestoneId: "ms-018-1", status: "Accepted" },
    { id: "dl-018-3", name: "Org tree dry-run · 4 tenants",             milestoneId: "ms-018-2", status: "Accepted" },
    { id: "dl-018-4", name: "Job catalog + Pay Grades migrated",        milestoneId: "ms-018-3", status: "In review" },
    { id: "dl-018-5", name: "Position records back-filled",             milestoneId: "ms-018-3", status: "In review" },
    { id: "dl-018-6", name: "Time pair adapter · build",                milestoneId: "ms-018-4", status: "In progress" },
    { id: "dl-018-7", name: "GL mapping table · 12 entities",           milestoneId: "ms-018-5", status: "Not started" },
  ],
  "SOW-2026-019": [
    { id: "dl-019-1", name: "Permits filed (city · state)",             milestoneId: "ms-019-1", status: "Accepted" },
    { id: "dl-019-2", name: "Floorplan v3 (signed)",                    milestoneId: "ms-019-1", status: "Accepted" },
    { id: "dl-019-3", name: "Racking install · 180k sq ft",             milestoneId: "ms-019-2", status: "In progress" },
    { id: "dl-019-4", name: "Dock door commissioning",                  milestoneId: "ms-019-2", status: "Not started" },
  ],
  "SOW-2026-014": [
    { id: "dl-014-1", name: "DE locale · production",                   milestoneId: "ms-014-3", status: "In review" },
    { id: "dl-014-2", name: "FR locale · production",                   milestoneId: "ms-014-3", status: "In review" },
    { id: "dl-014-3", name: "ES locale · production",                   milestoneId: "ms-014-3", status: "In review" },
    { id: "dl-014-4", name: "IT locale · production",                   milestoneId: "ms-014-3", status: "In review" },
    { id: "dl-014-5", name: "Nordics bundle",                           milestoneId: "ms-014-4", status: "In progress" },
  ],
  "SOW-2026-009": [
    { id: "dl-009-1", name: "IMSS export job · build",                  milestoneId: "ms-009-1", status: "Accepted" },
    { id: "dl-009-2", name: "Net-pay rule engine · v2",                 milestoneId: "ms-009-2", status: "Accepted" },
    { id: "dl-009-3", name: "SUA filing flow",                          milestoneId: "ms-009-3", status: "Rejected" },
  ],
};

// ---------- Change orders / amendments --------------------------------
const SOW_CHANGE_ORDERS = {
  "SOW-2026-018": [
    { id: "co-018-1", title: "Add benefits enrollment scope", status: "Approved", amount:  72_000, currency: "USD", date: "2026-04-08" },
  ],
  "SOW-2026-014": [
    { id: "co-014-1", title: "Add 2 Eastern EU markets",      status: "Approved", amount:  60_000, currency: "GBP", date: "2026-03-18" },
  ],
  "SOW-2026-009": [
    { id: "co-009-1", title: "Adjust net-pay parser timing",   status: "Approved", amount:  18_000, currency: "USD", date: "2026-02-19" },
    { id: "co-009-2", title: "Clarify SUA filing scope",       status: "In review", amount: 45_000, currency: "USD", date: "2026-05-09" },
  ],
};

// ---------- SOW Resources --------------------------------------------
// Supplier-managed people executing under an active SOW. These are
// distinct from agency workers — the buyer doesn't pick them; the
// supplier staffs the SOW. Roster-level visibility only (no schedule,
// no timesheet → invoicing). They show up in Workforce as a separate
// "SOW Resources" pool when the flag is on.
const SOW_RESOURCES_RAW = [
  { id: "sw-018-1", sowId: "SOW-2026-018", name: "Anjali Mehra",     role: "Solution architect",     supplier: "ap", country: "US", flag: "us", allocation: "100%", since: "2026-02-01" },
  { id: "sw-018-2", sowId: "SOW-2026-018", name: "Carlos Sterling",  role: "Integration engineer",   supplier: "ap", country: "US", flag: "us", allocation: "100%", since: "2026-02-05" },
  { id: "sw-018-3", sowId: "SOW-2026-018", name: "Priscilla Adeyemi",role: "Test lead",              supplier: "ap", country: "US", flag: "us", allocation:  "75%", since: "2026-02-12" },
  { id: "sw-018-4", sowId: "SOW-2026-018", name: "Rafael Silva",     role: "Payroll consultant",     supplier: "ap", country: "US", flag: "us", allocation:  "50%", since: "2026-04-01" },
  { id: "sw-019-1", sowId: "SOW-2026-019", name: "Hank Brennan",     role: "Site superintendent",    supplier: "wf", country: "US", flag: "us", allocation: "100%", since: "2026-03-15" },
  { id: "sw-019-2", sowId: "SOW-2026-019", name: "Lina Park",        role: "WMS integrator",         supplier: "wf", country: "US", flag: "us", allocation:  "60%", since: "2026-04-08" },
  { id: "sw-014-1", sowId: "SOW-2026-014", name: "Elise Moreau",     role: "Localization lead",      supplier: "ap", country: "FR", flag: "fr", allocation: "100%", since: "2026-01-08" },
  { id: "sw-014-2", sowId: "SOW-2026-014", name: "Stefan Kraus",     role: "i18n engineer",          supplier: "ap", country: "DE", flag: "de", allocation: "100%", since: "2026-01-08" },
  { id: "sw-014-3", sowId: "SOW-2026-014", name: "Anita Rossi",      role: "Translation manager",    supplier: "ap", country: "IT", flag: "it", allocation:  "80%", since: "2026-01-15" },
];

// ---------- Sample SOW invoices ---------------------------------------
// Mirrors the standard INVOICES shape so the existing Invoices list can
// render them when the flag is on — the only addition is the
// `engagementType: "SOW"` tag + `sowRef` + `milestoneRef`.
const SOW_INVOICES_RAW = [
  { id: "SINV-4012", date: "2026-05-15", supplier: "ap", supplierLabel: "AlphaTech Partners",
    period: "Milestone · Position & job catalog cutover", amount: 167_400, currency: "USD",
    status: "Submitted", engagementType: "SOW", sowRef: "SOW-2026-018", milestoneRef: "ms-018-3",
    note: "10% retainage held (16 600)" },
  { id: "SINV-4011", date: "2026-05-12", supplier: "ap", supplierLabel: "AlphaTech Partners",
    period: "T&M draw 3 · DE·FR·ES·IT release", amount:  88_400, currency: "GBP",
    status: "Submitted", engagementType: "SOW", sowRef: "SOW-2026-014", milestoneRef: "ms-014-3" },
  { id: "SINV-4007", date: "2026-05-04", supplier: "ap", supplierLabel: "AlphaTech Partners",
    period: "Milestone · Org hierarchy migration", amount: 167_400, currency: "USD",
    status: "Paid", engagementType: "SOW", sowRef: "SOW-2026-018", milestoneRef: "ms-018-2",
    note: "10% retainage held (18 600)" },
  { id: "SINV-4006", date: "2026-04-08", supplier: "wf", supplierLabel: "WorkForce Now",
    period: "Milestone · Mobilization & site prep", amount:  69_113, currency: "USD",
    status: "Paid", engagementType: "SOW", sowRef: "SOW-2026-019", milestoneRef: "ms-019-1",
    note: "5% retainage held (3 638)" },
  { id: "SINV-4002", date: "2026-04-02", supplier: "wf", supplierLabel: "WorkForce Now",
    period: "Milestone · Closeout report", amount:  42_000, currency: "USD",
    status: "Paid", engagementType: "SOW", sowRef: "SOW-2025-088", milestoneRef: "ms-088-4" },
];

// ---------- Temp-spend tier scaling -------------------------------------
// Mutate the hand-tuned $ values across SOW agreements / milestones /
// change orders / invoices so they read at the active program-size
// tier. SOW is a high-value SOW dataset anchored to the $10M baseline
// — at $1M it should read in the tens of thousands, at $500M+ in the
// tens of millions. The agreement / milestone *count* stays fixed
// because each row is a narratively-distinct engagement, not a row in
// a length-scaled list.
(function _scaleSOW() {
  const sc = (typeof window !== "undefined" && typeof window.TEMP_SPEND_SCALE === "number") ? window.TEMP_SPEND_SCALE : 1;
  if (sc === 1) return;
  // Round to the nearest $100 below ~$100k, $1k otherwise — keeps the
  // numbers reading like real contract values, not algorithmic noise.
  const _sm = (n) => {
    if (typeof n !== "number" || !isFinite(n) || n === 0) return n;
    const v = n * sc;
    const grain = Math.abs(v) >= 100_000 ? 1000 : 100;
    return Math.max(0, Math.round(v / grain) * grain);
  };
  SOW_AGREEMENTS_RAW.forEach((s) => {
    s.totalValue = _sm(s.totalValue);
    s.consumed   = _sm(s.consumed);
  });
  Object.values(SOW_MILESTONES).forEach((arr) => arr.forEach((m) => { m.value = _sm(m.value); }));
  Object.values(SOW_CHANGE_ORDERS).forEach((arr) => arr.forEach((co) => { co.amount = _sm(co.amount); }));
  SOW_INVOICES_RAW.forEach((inv) => { inv.amount = _sm(inv.amount); });
})();

// ---------- Helpers ----------------------------------------------------
function getSOWs()                    { return SOW_AGREEMENTS_RAW; }
function getSOWById(id)               { return SOW_AGREEMENTS_RAW.find((s) => s.id === id) || null; }
function getSOWMilestones(sowId)      { return SOW_MILESTONES[sowId] || []; }
function getSOWDeliverables(sowId)    { return SOW_DELIVERABLES[sowId] || []; }
function getSOWChangeOrders(sowId)    { return SOW_CHANGE_ORDERS[sowId] || []; }
function getSOWResources(sowId)       {
  if (!sowId) return SOW_RESOURCES_RAW;
  return SOW_RESOURCES_RAW.filter((r) => r.sowId === sowId);
}

// Adapter — projects SOW_RESOURCES_RAW into the Workforce list row
// shape (pool / supplier / jobs / status / countryName / flag etc.) so
// the existing WorkforceTable renders them without a fork.
function getSowResourceWorkers() {
  const COUNTRY_NAME = {
    US: "United States", CA: "Canada", GB: "United Kingdom", MX: "Mexico",
    SG: "Singapore", FR: "France", DE: "Germany", IT: "Italy",
    ES: "Spain", JP: "Japan", AE: "United Arab Emirates", BR: "Brazil",
  };
  return SOW_RESOURCES_RAW.map((r) => {
    const sow = SOW_AGREEMENTS_RAW.find((s) => s.id === r.sowId);
    return {
      id: r.id,
      name: r.name,
      pool: "SOW Resources",
      supplier: r.supplier,
      workerId: `sow-${r.id.slice(3)}`,
      status: "Compliant",
      jobs: [r.role],
      shifts: 0,
      country: r.country,
      countryName: COUNTRY_NAME[r.country] || r.country,
      flag: r.flag,
      // SOW-specific extras carried alongside the standard row shape.
      sowId: r.sowId,
      sowName: sow ? sow.name : null,
      sowOwner: sow ? sow.owner : null,
      allocation: r.allocation,
      since: r.since,
    };
  });
}
function getSOWInvoices()             { return SOW_INVOICES_RAW; }

// Adapter — projects SOW_INVOICES_RAW into the Invoices list row shape
// (id / req / supplier / contact / status / locations / amount /
// invDate / dueDate) so the existing InvoicesTable renders them
// without a fork. Status is mapped onto the standard INV vocab so
// status counts stay coherent.
function getSowInvoiceRows() {
  const STATUS_MAP = {
    "Submitted": "Issued",
    "Approved":  "Issued",
    "Paid":      "Paid",
  };
  return SOW_INVOICES_RAW.map((i) => {
    const ccy = i.currency || "USD";
    const symbol = ccy === "USD" ? "$" : ccy === "EUR" ? "\u20ac" : ccy === "GBP" ? "\u00a3" : ccy === "CAD" ? "CA$" : `${ccy} `;
    const amount = `${symbol}${Math.round(i.amount).toLocaleString()}`;
    // dueDate is a +30d nudge against the invoice date; the demo
    // doesn't carry true terms here. The cell renders MM.DD.YYYY.
    const dt = new Date(i.date);
    const due = new Date(dt.getTime()); due.setDate(due.getDate() + 30);
    const fmt = (d) => `${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}.${d.getFullYear()}`;
    return {
      id: i.id.replace(/^SINV-/, ""),
      req: i.sowRef,
      supplier: i.supplier,
      contact: i.supplierLabel,
      status: STATUS_MAP[i.status] || "Issued",
      locations: [i.period],
      amount,
      invDate: fmt(dt),
      dueDate: fmt(due),
      // SOW-specific extras — read by the row chip + filter, ignored
      // by the standard row rendering.
      engagementType: "SOW",
      // Canonical Engagement Type axis values per the matrix:
      //   Statement of Work → Milestone × Time Tracking × Agency
      billingBasis: "Milestone",
      timeCapture: "Time Tracking",
      supplierTypes: ["Agency"],
      sowRef: i.sowRef,
      milestoneRef: i.milestoneRef,
      note: i.note,
    };
  });
}
function isSowResource(w)             { return !!(w && w.pool === "SOW Resources"); }

function sowBillingLabel(model) {
  if (model === "fixed")     return "Fixed-fee";
  if (model === "milestone") return "Milestone";
  if (model === "tm_capped") return "T&M (capped)";
  return "—";
}

// Status palette — flat semantic tones (no AIX glow). Mirrors the
// Everest decorative palette used by Professional Work + Contractors.
const SOW_STATUS_META = {
  "Draft":       { fg: "var(--evr-content-primary-lowemp)",      bg: "var(--evr-surface-secondary-default)",          label: "Draft" },
  "In approval": { fg: "var(--evr-content-decorative-orange)",   bg: "var(--evr-surface-decorative-default-orange)",  label: "In approval" },
  "Active":      { fg: "var(--evr-content-decorative-green)",    bg: "var(--evr-surface-decorative-default-green)",   label: "Active" },
  "On hold":     { fg: "var(--evr-content-decorative-red)",      bg: "var(--evr-surface-decorative-default-red)",     label: "On hold" },
  "Completed":   { fg: "var(--evr-content-decorative-blue)",     bg: "var(--evr-surface-decorative-default-blue)",    label: "Completed" },
  "Closed":      { fg: "var(--evr-content-primary-lowemp)",      bg: "var(--evr-surface-secondary-default)",          label: "Closed" },
};
function sowStatusMeta(status) {
  return SOW_STATUS_META[status] || SOW_STATUS_META["Draft"];
}

const SOW_MILESTONE_STATUS_META = {
  "Planned":     { fg: "var(--evr-content-primary-lowemp)",      bg: "var(--evr-surface-secondary-default)",          label: "Planned" },
  "In progress": { fg: "var(--evr-content-decorative-purple)",   bg: "var(--evr-surface-decorative-default-purple)",  label: "In progress" },
  "Submitted":   { fg: "var(--evr-content-decorative-orange)",   bg: "var(--evr-surface-decorative-default-orange)",  label: "Submitted" },
  "Accepted":    { fg: "var(--evr-content-decorative-green)",    bg: "var(--evr-surface-decorative-default-green)",   label: "Accepted" },
  "Paid":        { fg: "var(--evr-content-decorative-teal)",     bg: "var(--evr-surface-decorative-default-teal)",    label: "Paid" },
  "Rejected":    { fg: "var(--evr-content-decorative-red)",      bg: "var(--evr-surface-decorative-default-red)",     label: "Rejected" },
};
function sowMilestoneStatusMeta(status) {
  return SOW_MILESTONE_STATUS_META[status] || SOW_MILESTONE_STATUS_META["Planned"];
}

function sowFmtMoney(amt, ccy) {
  if (typeof amt !== "number") return "—";
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: ccy || "USD",
      maximumFractionDigits: 0,
    }).format(amt);
  } catch (e) { return `${ccy || "USD"} ${amt}`; }
}

// Today anchor matches the rest of the demo so milestones-due / overdue
// math stays stable across the dashboard.
function _sowToday() {
  return window.flexToday ? window.flexToday() : new Date(2026, 4, 19);
}
function _sowDaysFrom(today, isoDate) {
  if (!isoDate) return null;
  const d = new Date(isoDate);
  const ms = d.getTime() - today.getTime();
  return Math.round(ms / (1000 * 60 * 60 * 24));
}

// Top-line metrics for the dashboard "SOW" tab. Computed from the raw
// arrays so any data tweak flows through immediately.
function sowMetrics() {
  const today = _sowToday();
  const sows = SOW_AGREEMENTS_RAW;

  const active = sows.filter((s) => s.status === "Active").length;
  const draft  = sows.filter((s) => s.status === "Draft" || s.status === "In approval").length;

  let milestonesDue7d = 0;
  let deliverablesOverdue = 0;
  let allMilestones = [];
  for (const s of sows) {
    const ms = SOW_MILESTONES[s.id] || [];
    for (const m of ms) {
      allMilestones.push({ ...m, sowId: s.id, sowName: s.name, currency: s.currency, supplierLabel: s.supplierLabel });
      const days = _sowDaysFrom(today, m.due);
      if (days !== null && days >= 0 && days <= 7 &&
          (m.status === "Planned" || m.status === "In progress")) {
        milestonesDue7d += 1;
      }
      if (days !== null && days < 0 &&
          (m.status === "Planned" || m.status === "In progress")) {
        deliverablesOverdue += 1;
      }
    }
  }

  const invoicesPending = SOW_INVOICES_RAW.filter(
    (i) => i.status === "Submitted" || i.status === "Approved"
  ).length;

  // Spend roll-up — convert every SOW into USD using a flat demo FX so
  // the dashboard tile reads in one currency. Real product would use
  // tenant FX rates; demo math is good enough.
  const FX = { USD: 1, CAD: 0.74, GBP: 1.26, EUR: 1.08 };
  const committed = sows.reduce((n, s) => n + s.totalValue * (FX[s.currency] || 1), 0);
  const consumed  = sows.reduce((n, s) => n + (s.consumed || 0) * (FX[s.currency] || 1), 0);

  let changeOrdersOpen = 0;
  for (const k of Object.keys(SOW_CHANGE_ORDERS)) {
    for (const co of SOW_CHANGE_ORDERS[k]) {
      if (co.status === "In review") changeOrdersOpen += 1;
    }
  }

  return {
    active, draft, milestonesDue7d, deliverablesOverdue, invoicesPending,
    committed, consumed, remaining: committed - consumed,
    changeOrdersOpen,
    allMilestones,
  };
}

Object.assign(window, {
  SOW_AGREEMENTS_RAW,
  SOW_MILESTONES,
  SOW_DELIVERABLES,
  SOW_CHANGE_ORDERS,
  SOW_RESOURCES_RAW,
  SOW_INVOICES_RAW,
  SOW_STATUS_META,
  SOW_MILESTONE_STATUS_META,
  getSOWs,
  getSOWById,
  getSOWMilestones,
  getSOWDeliverables,
  getSOWChangeOrders,
  getSOWResources,
  getSowResourceWorkers,
  getSOWInvoices,
  getSowInvoiceRows,
  isSowResource,
  sowBillingLabel,
  sowStatusMeta,
  sowMilestoneStatusMeta,
  sowFmtMoney,
  sowMetrics,
});
