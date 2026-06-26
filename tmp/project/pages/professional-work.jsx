// =====================================================================
// Flex Work — Professional Work (SOW / permanent engagement) worker type
//   Gated by the `professionalWork` feature flag. When ON, this module:
//     · Provides a professional roster (PROFESSIONAL_WORKERS) that
//       merges into Workforce as a new "Professional" pool
//     · Exposes permanent (no end date) requisitions with interview
//       pipelines and candidate scorecards
//     · Drives the dashboard Frontline ↔ Professional segmented view
//     · Produces invoices on a contract cadence (weekly / monthly /
//       annual milestone)
//
//   Capability parity is modelled on the Dayforce Recruiting →
//   Position handoff (no parallel person model) extended with
//   SOW / Professional Services primitives.
//
//   Public API (window.*):
//     · getProfessionalWorkers() → array
//     · getProfessionalWorkerById(id) → row | null
//     · getProfessionalRequisitions() → array
//     · getProfessionalCandidates(reqId) → array
//     · getProfessionalInvoices() → array
//     · isProfessional(worker) → boolean
//     · profCadenceLabel(cadence) → "Weekly" | "Monthly" | "Annual"
//     · profEngagementMetrics() → { openReqs, interviewsWeek,
//                                   activeEngagements, renewalsDue,
//                                   invoicesDue, hiresMTD }
//
//   All data is sample / demo — same shape conventions as
//   `contractors.jsx` so the two modules read consistently.
// =====================================================================

// ---------- Sample roster ---------------------------------------------
// Each professional worker:
//   { id, name, pool: "Professional", supplier, workerId, status, jobs,
//     country, countryName, flag, cadence ("weekly"|"monthly"|"annual"),
//     rateAmount, currency, termStart, termEnd, renewalDate,
//     sowRef, timesheetMode ("required"|"none"), ytdInvoiced,
//     lastInvoice, hiringManager, location }
//
// Pool === "Professional" is the marker for every cross-cutting check
// across Workforce, Requisitions, and Invoices.
const PROFESSIONAL_WORKERS_RAW = [
  {
    id: "p-eh",
    name: "Elena Halvorsen",
    pool: "Professional", supplier: "sw",
    workerId: "p-71fa…ad21",
    status: "Compliant",
    jobs: ["Senior Product Manager"],
    shifts: 0,
    country: "US", countryName: "United States", flag: "us",
    cadence: "monthly",
    rateAmount: 18500, currency: "USD",
    termStart: "2025-09-01", termEnd: "Permanent",
    renewalDate: "2026-09-01",
    sowRef: "SOW-PRO-2025-014",
    timesheetMode: "none",
    ytdInvoiced: 92500,
    lastInvoice: { id: "PINV-3041", amount: 18500, date: "2026-05-01", status: "Paid" },
    hiringManager: "Amy Hennen",
    location: "Minneapolis, MN",
    email: "elena@halvorsen.io",
    phone: "+1 (612) 555-0144",
  },
  {
    id: "p-rd",
    name: "Rishi Devarajan",
    pool: "Professional", supplier: "ap",
    workerId: "p-22ab…7901",
    status: "Compliant",
    jobs: ["Engineering Lead · Platform"],
    shifts: 0,
    country: "CA", countryName: "Canada", flag: "ca",
    cadence: "monthly",
    rateAmount: 24000, currency: "CAD",
    termStart: "2024-11-15", termEnd: "Permanent",
    renewalDate: "2026-05-15",
    sowRef: "SOW-PRO-2024-088",
    timesheetMode: "required",
    ytdInvoiced: 96000,
    lastInvoice: { id: "PINV-3033", amount: 24000, date: "2026-04-30", status: "Approved" },
    hiringManager: "Terry Donin",
    location: "Toronto, ON",
    email: "rishi@devarajan.dev",
    phone: "+1 (416) 555-0188",
  },
  {
    id: "p-mw",
    name: "Mira Wijaya",
    pool: "Professional", supplier: "wf",
    workerId: "p-8a11…cc02",
    status: "Compliant",
    jobs: ["Sales Director · APAC"],
    shifts: 0,
    country: "SG", countryName: "Singapore", flag: "sg",
    cadence: "annual",
    rateAmount: 215000, currency: "USD",
    termStart: "2025-02-01", termEnd: "Permanent",
    renewalDate: "2027-02-01",
    sowRef: "SOW-PRO-2025-002",
    timesheetMode: "none",
    ytdInvoiced: 89580,
    lastInvoice: { id: "PINV-3027", amount: 17916, date: "2026-05-01", status: "Paid" },
    hiringManager: "Amy Hennen",
    location: "Singapore",
    email: "mira@wijaya.sg",
    phone: "+65 8555 0102",
  },
  {
    id: "p-lc",
    name: "Lucia Castelló",
    pool: "Professional", supplier: "sw",
    workerId: "p-44dd…9101",
    status: "Compliant",
    jobs: ["Senior Designer · Brand"],
    shifts: 0,
    country: "ES", countryName: "Spain", flag: "es",
    cadence: "weekly",
    rateAmount: 3800, currency: "EUR",
    termStart: "2026-01-05", termEnd: "Permanent",
    renewalDate: "2027-01-05",
    sowRef: "SOW-PRO-2026-009",
    timesheetMode: "required",
    ytdInvoiced: 68400,
    lastInvoice: { id: "PINV-3055", amount: 3800, date: "2026-05-12", status: "Approved" },
    hiringManager: "Beatriz Almeida",
    location: "Madrid",
    email: "lucia@castello.es",
    phone: "+34 6 5555 0144",
  },
  {
    id: "p-ko",
    name: "Kenji Ono",
    pool: "Professional", supplier: "ap",
    workerId: "p-eeaa…0033",
    status: "Compliant",
    jobs: ["Finance Manager · Controlling"],
    shifts: 0,
    country: "JP", countryName: "Japan", flag: "jp",
    cadence: "monthly",
    rateAmount: 16800, currency: "USD",
    termStart: "2025-05-12", termEnd: "Permanent",
    renewalDate: "2026-05-12",
    sowRef: "SOW-PRO-2025-031",
    timesheetMode: "none",
    ytdInvoiced: 84000,
    lastInvoice: { id: "PINV-3018", amount: 16800, date: "2026-04-30", status: "Paid" },
    hiringManager: "Terry Donin",
    location: "Tokyo",
    email: "kenji@ono.jp",
    phone: "+81 90 5555 0166",
  },
  {
    id: "p-mb",
    name: "Marcus Bukenya",
    pool: "Professional", supplier: "wf",
    workerId: "p-7732…1188",
    status: "Onboarding",
    jobs: ["Data Engineering Manager"],
    shifts: 0,
    country: "GB", countryName: "United Kingdom", flag: "gb",
    cadence: "monthly",
    rateAmount: 19200, currency: "GBP",
    termStart: "2026-06-01", termEnd: "Permanent",
    renewalDate: "2027-06-01",
    sowRef: "SOW-PRO-2026-018",
    timesheetMode: "required",
    ytdInvoiced: 0,
    lastInvoice: null,
    hiringManager: "Amy Hennen",
    location: "London",
    email: "marcus@bukenya.uk",
    phone: "+44 20 5555 0177",
  },
  {
    id: "p-nh",
    name: "Noor Hassan",
    pool: "Professional", supplier: "sw",
    workerId: "p-3320…aa11",
    status: "Compliant",
    jobs: ["HRBP · Talent Operations"],
    shifts: 0,
    country: "AE", countryName: "United Arab Emirates", flag: "ae",
    cadence: "monthly",
    rateAmount: 14200, currency: "USD",
    termStart: "2024-08-19", termEnd: "Permanent",
    renewalDate: "2026-08-19",
    sowRef: "SOW-PRO-2024-052",
    timesheetMode: "none",
    ytdInvoiced: 71000,
    lastInvoice: { id: "PINV-3009", amount: 14200, date: "2026-04-30", status: "Paid" },
    hiringManager: "Amy Hennen",
    location: "Dubai",
    email: "noor@hassan.ae",
    phone: "+971 50 555 0122",
  },
  {
    id: "p-tv",
    name: "Tomás Vega",
    pool: "Professional", supplier: "ap",
    workerId: "p-6611…ccff",
    status: "Compliant",
    jobs: ["Cybersecurity Architect"],
    shifts: 0,
    country: "MX", countryName: "Mexico", flag: "mx",
    cadence: "weekly",
    rateAmount: 4250, currency: "USD",
    termStart: "2025-10-06", termEnd: "Permanent",
    renewalDate: "2026-10-06",
    sowRef: "SOW-PRO-2025-077",
    timesheetMode: "required",
    ytdInvoiced: 89250,
    lastInvoice: { id: "PINV-3060", amount: 4250, date: "2026-05-13", status: "Submitted" },
    hiringManager: "Terry Donin",
    location: "CDMX",
    email: "tomas@vega.mx",
    phone: "+52 55 5555 0118",
  },
];

// ---------- Open Professional requisitions ----------------------------
// Every Professional req: { id, status, jobs, qty, location, country,
//   flag, cadence, rateLow, rateHigh, currency, hiringManager, opened,
//   pipeline: {sourced, screened, interview, offer, hired}, sow,
//   timesheetMode }
//
// Status vocab mirrors Dayforce Recruiting: Open · Interviewing ·
// Offer extended · Filled. "Filled" rows surface in Workforce, not here.
const PROFESSIONAL_REQUISITIONS_RAW = [
  {
    id: "PRO-K1L2M3",
    status: "Interviewing",
    jobs: ["Senior Product Manager · Workforce"],
    qty: 1,
    location: "Minneapolis, MN", country: "US", flag: "us",
    cadence: "monthly",
    rateLow: 16500, rateHigh: 19500, currency: "USD",
    hiringManager: "Amy Hennen",
    opened: "Apr 24",
    daysOpen: 26,
    pipeline: { sourced: 38, screened: 14, interview: 5, offer: 0, hired: 0 },
    sow: "MSA + SOW template · Permanent",
    timesheetMode: "none",
  },
  {
    id: "PRO-N4O5P6",
    status: "Offer extended",
    jobs: ["Engineering Lead · Mobile"],
    qty: 1,
    location: "Toronto, ON", country: "CA", flag: "ca",
    cadence: "monthly",
    rateLow: 22000, rateHigh: 26000, currency: "CAD",
    hiringManager: "Terry Donin",
    opened: "Mar 18",
    daysOpen: 63,
    pipeline: { sourced: 52, screened: 22, interview: 8, offer: 1, hired: 0 },
    sow: "MSA + SOW template · Permanent",
    timesheetMode: "required",
  },
  {
    id: "PRO-Q7R8S9",
    status: "Open",
    jobs: ["Senior Designer · Brand"],
    qty: 1,
    location: "Madrid", country: "ES", flag: "es",
    cadence: "weekly",
    rateLow: 3400, rateHigh: 4200, currency: "EUR",
    hiringManager: "Beatriz Almeida",
    opened: "May 12",
    daysOpen: 8,
    pipeline: { sourced: 19, screened: 4, interview: 0, offer: 0, hired: 0 },
    sow: "MSA + SOW template · Permanent",
    timesheetMode: "required",
  },
  {
    id: "PRO-T1U2V3",
    status: "Interviewing",
    jobs: ["Sales Director · EMEA"],
    qty: 1,
    location: "London", country: "GB", flag: "gb",
    cadence: "annual",
    rateLow: 195000, rateHigh: 245000, currency: "USD",
    hiringManager: "Amy Hennen",
    opened: "Mar 02",
    daysOpen: 79,
    pipeline: { sourced: 67, screened: 28, interview: 11, offer: 0, hired: 0 },
    sow: "MSA + SOW template · Permanent",
    timesheetMode: "none",
  },
  {
    id: "PRO-W4X5Y6",
    status: "Open",
    jobs: ["Data Science Lead"],
    qty: 1,
    location: "Singapore", country: "SG", flag: "sg",
    cadence: "monthly",
    rateLow: 18200, rateHigh: 22500, currency: "USD",
    hiringManager: "Mira Wijaya",
    opened: "May 06",
    daysOpen: 14,
    pipeline: { sourced: 24, screened: 9, interview: 2, offer: 0, hired: 0 },
    sow: "MSA + SOW template · Permanent",
    timesheetMode: "required",
  },
  {
    id: "PRO-Z7A8B9",
    status: "Interviewing",
    jobs: ["Finance Business Partner · LATAM"],
    qty: 1,
    location: "São Paulo", country: "BR", flag: "br",
    cadence: "monthly",
    rateLow: 12500, rateHigh: 15500, currency: "USD",
    hiringManager: "Beatriz Almeida",
    opened: "Apr 02",
    daysOpen: 48,
    pipeline: { sourced: 41, screened: 17, interview: 6, offer: 0, hired: 0 },
    sow: "MSA + SOW template · Permanent",
    timesheetMode: "none",
  },
];

// ---------- Candidate pipelines (per requisition) ----------------------
// Keyed by reqId. Each candidate: { id, name, stage, score (0-5 in 0.5
//   increments), source, lastTouch, interviews: [{date, type, panel,
//   status, score, notes}] }
const PROFESSIONAL_CANDIDATES = {
  "PRO-K1L2M3": [
    { id: "ca-1", name: "Helena Voss",      stage: "Interview", score: 4.5, source: "Direct apply", lastTouch: "2 days ago",
      interviews: [
        { date: "May 12", type: "Screen",      panel: "Amy Hennen", status: "Done", score: 4.5, notes: "Strong product sense; deep contingent‑labor background." },
        { date: "May 18", type: "Panel · Tech", panel: "T. Donin, R. Devarajan", status: "Done", score: 4.0, notes: "Solid system thinking; communication clear." },
        { date: "May 22", type: "Panel · Exec", panel: "Amy Hennen, M. Bukenya", status: "Scheduled", score: null, notes: "—" },
      ],
    },
    { id: "ca-2", name: "Daniel Ortiz",     stage: "Interview", score: 4.0, source: "Referral",     lastTouch: "Today",
      interviews: [
        { date: "May 09", type: "Screen", panel: "Amy Hennen", status: "Done", score: 4.0, notes: "Good range; lighter on enterprise scale." },
        { date: "May 16", type: "Panel · Tech", panel: "T. Donin, M. Wijaya", status: "Done", score: 4.0, notes: "Confident, structured." },
        { date: "May 23", type: "Panel · Exec", panel: "Amy Hennen", status: "Scheduled", score: null, notes: "—" },
      ],
    },
    { id: "ca-3", name: "Priya Chen",       stage: "Screened",  score: 4.0, source: "Agency",       lastTouch: "Yesterday", interviews: [] },
    { id: "ca-4", name: "Owain Hughes",     stage: "Sourced",   score: 3.5, source: "LinkedIn",     lastTouch: "3 days ago", interviews: [] },
    { id: "ca-5", name: "Selene Park",      stage: "Sourced",   score: 3.5, source: "Direct apply", lastTouch: "4 days ago", interviews: [] },
  ],
  "PRO-N4O5P6": [
    { id: "cb-1", name: "Anita Roy",        stage: "Offer",     score: 4.5, source: "Referral",     lastTouch: "Today",
      interviews: [
        { date: "Apr 28", type: "Screen",      panel: "Terry Donin", status: "Done", score: 4.5, notes: "Tier‑one mobile background." },
        { date: "May 05", type: "Panel · Tech", panel: "T. Donin, R. Devarajan", status: "Done", score: 4.5, notes: "Deep iOS / Android; led teams up to 24." },
        { date: "May 12", type: "Panel · Exec", panel: "Amy Hennen", status: "Done", score: 4.5, notes: "Confident, calm, clear written work." },
      ],
    },
    { id: "cb-2", name: "Jordan Mensah",    stage: "Interview", score: 4.0, source: "Direct apply", lastTouch: "5 days ago",
      interviews: [
        { date: "May 14", type: "Panel · Tech", panel: "T. Donin, R. Devarajan", status: "Done", score: 4.0, notes: "Solid background; would be a backup." },
      ],
    },
    { id: "cb-3", name: "Sven Larsson",     stage: "Screened",  score: 3.5, source: "Agency",       lastTouch: "Yesterday", interviews: [] },
  ],
  "PRO-T1U2V3": [
    { id: "cd-1", name: "Margaux Pelletier", stage: "Interview", score: 4.5, source: "Search firm",  lastTouch: "Today",
      interviews: [
        { date: "May 06", type: "Screen", panel: "Amy Hennen", status: "Done", score: 4.5, notes: "Closed > €38M last year." },
        { date: "May 15", type: "Panel · Exec", panel: "Amy Hennen, M. Wijaya", status: "Done", score: 4.5, notes: "Highly polished." },
        { date: "May 24", type: "Panel · Board", panel: "Board interview", status: "Scheduled", score: null, notes: "—" },
      ],
    },
    { id: "cd-2", name: "James Okonkwo",     stage: "Interview", score: 4.0, source: "Search firm",  lastTouch: "Yesterday",
      interviews: [
        { date: "May 09", type: "Screen", panel: "Amy Hennen", status: "Done", score: 4.0, notes: "Strong EMEA network." },
      ],
    },
    { id: "cd-3", name: "Sofia Andreou",     stage: "Screened",  score: 4.0, source: "Direct apply", lastTouch: "4 days ago", interviews: [] },
  ],
};

// ---------- Sample professional invoices ------------------------------
// Mirrors the standard INVOICES shape so the existing list can render
// them without rework — the only addition is the `engagementType` tag.
const PROFESSIONAL_INVOICES_RAW = [
  { id: "PINV-3060", date: "2026-05-13", supplier: "ap", supplierLabel: "AlphaTech Partners",
    period: "Week of May 11",   amount: 4250,  currency: "USD", status: "Submitted",
    engagementType: "Professional", cadence: "weekly",  worker: "Tomás Vega",     sowRef: "SOW-PRO-2025-077" },
  { id: "PINV-3055", date: "2026-05-12", supplier: "sw", supplierLabel: "StaffWise Solutions",
    period: "Week of May 04",   amount: 3800,  currency: "EUR", status: "Approved",
    engagementType: "Professional", cadence: "weekly",  worker: "Lucia Castelló", sowRef: "SOW-PRO-2026-009" },
  { id: "PINV-3041", date: "2026-05-01", supplier: "sw", supplierLabel: "StaffWise Solutions",
    period: "April",            amount: 18500, currency: "USD", status: "Paid",
    engagementType: "Professional", cadence: "monthly", worker: "Elena Halvorsen", sowRef: "SOW-PRO-2025-014" },
  { id: "PINV-3033", date: "2026-04-30", supplier: "ap", supplierLabel: "AlphaTech Partners",
    period: "April",            amount: 24000, currency: "CAD", status: "Approved",
    engagementType: "Professional", cadence: "monthly", worker: "Rishi Devarajan", sowRef: "SOW-PRO-2024-088" },
  { id: "PINV-3027", date: "2026-05-01", supplier: "wf", supplierLabel: "Workforce Global",
    period: "Annual milestone", amount: 17916, currency: "USD", status: "Paid",
    engagementType: "Professional", cadence: "annual",  worker: "Mira Wijaya",    sowRef: "SOW-PRO-2025-002" },
  { id: "PINV-3018", date: "2026-04-30", supplier: "ap", supplierLabel: "AlphaTech Partners",
    period: "April",            amount: 16800, currency: "USD", status: "Paid",
    engagementType: "Professional", cadence: "monthly", worker: "Kenji Ono",       sowRef: "SOW-PRO-2025-031" },
  { id: "PINV-3009", date: "2026-04-30", supplier: "sw", supplierLabel: "StaffWise Solutions",
    period: "April",            amount: 14200, currency: "USD", status: "Paid",
    engagementType: "Professional", cadence: "monthly", worker: "Noor Hassan",     sowRef: "SOW-PRO-2024-052" },
];

// ---------- Helpers ----------------------------------------------------
function getProfessionalWorkers()       { return PROFESSIONAL_WORKERS_RAW; }
function getProfessionalWorkerById(id)  { return PROFESSIONAL_WORKERS_RAW.find((w) => w.id === id) || null; }
function getProfessionalRequisitions()  { return PROFESSIONAL_REQUISITIONS_RAW; }
function getProfessionalRequisitionById(id) {
  return PROFESSIONAL_REQUISITIONS_RAW.find((r) => r.id === id) || null;
}
function getProfessionalCandidates(reqId) { return PROFESSIONAL_CANDIDATES[reqId] || []; }
function getProfessionalInvoices()       { return PROFESSIONAL_INVOICES_RAW; }
function isProfessional(w) { return !!(w && w.pool === "Professional"); }

function profCadenceLabel(c) {
  if (c === "weekly")  return "Weekly";
  if (c === "monthly") return "Monthly";
  if (c === "annual")  return "Annual";
  return "—";
}

// Currency format — same pattern as `fmtContractorMoney` so the two
// modules render identically across surfaces.
function profFmtMoney(amt, ccy) {
  if (typeof amt !== "number") return "—";
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: ccy || "USD",
      maximumFractionDigits: amt >= 100 ? 0 : 2,
    }).format(amt);
  } catch (e) { return `${ccy || "USD"} ${amt}`; }
}

// Top-line metrics for the dashboard "Professional Work" tab. Derived
// from the raw arrays so any data tweak flows through immediately.
function profEngagementMetrics() {
  const reqs = PROFESSIONAL_REQUISITIONS_RAW;
  const workers = PROFESSIONAL_WORKERS_RAW;
  const invoices = PROFESSIONAL_INVOICES_RAW;

  const openReqs = reqs.length;
  const interviewsWeek = reqs.reduce((n, r) => n + (r.pipeline?.interview || 0), 0);
  const offersOut = reqs.reduce((n, r) => n + (r.pipeline?.offer || 0), 0);
  const activeEngagements = workers.filter((w) => w.status === "Compliant").length;

  // Renewals within the next 90 days from today.
  const today = window.flexToday ? window.flexToday() : new Date(2026, 4, 19);
  const horizon = new Date(today.getTime()); horizon.setDate(horizon.getDate() + 90);
  const renewalsDue = workers.filter((w) => {
    if (!w.renewalDate) return false;
    const d = new Date(w.renewalDate);
    return d >= today && d <= horizon;
  }).length;

  const invoicesDue = invoices.filter((i) => i.status === "Submitted" || i.status === "Approved").length;
  const hiresMTD = workers.filter((w) => {
    if (!w.termStart) return false;
    const d = new Date(w.termStart);
    return d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth();
  }).length;

  return { openReqs, interviewsWeek, offersOut, activeEngagements, renewalsDue, invoicesDue, hiresMTD };
}

// Stage palette — standard candidate-pipeline stages mapped onto
// Everest decorative tokens.
const PROF_STAGE_META = {
  Sourced:   { fg: "var(--evr-content-decorative-blue)",   bg: "var(--evr-surface-decorative-default-blue)" },
  Screened:  { fg: "var(--evr-content-decorative-teal)",   bg: "var(--evr-surface-decorative-default-teal)" },
  Interview: { fg: "var(--evr-content-decorative-purple)", bg: "var(--evr-surface-decorative-default-purple)" },
  Offer:     { fg: "var(--evr-content-decorative-orange)", bg: "var(--evr-surface-decorative-default-orange)" },
  Hired:     { fg: "var(--evr-content-decorative-green)",  bg: "var(--evr-surface-decorative-default-green)" },
};

Object.assign(window, {
  PROFESSIONAL_WORKERS_RAW,
  PROFESSIONAL_REQUISITIONS_RAW,
  PROFESSIONAL_CANDIDATES,
  PROFESSIONAL_INVOICES_RAW,
  PROF_STAGE_META,
  getProfessionalWorkers,
  getProfessionalWorkerById,
  getProfessionalRequisitions,
  getProfessionalRequisitionById,
  getProfessionalCandidates,
  getProfessionalInvoices,
  isProfessional,
  profCadenceLabel,
  profFmtMoney,
  profEngagementMetrics,
});
