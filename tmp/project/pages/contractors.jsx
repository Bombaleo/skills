// =====================================================================
// Flex Work — Contractors (1099 / IC) worker type
//   Gated by the `contractors` feature flag. When ON, this module:
//     · Provides a contractor roster (CONTRACTOR_WORKERS) that merges
//       into Workforce as a new "Contractor" pool
//     · Exposes a dedicated detail surface (ContractorDetailSections)
//       that renders below the standard worker accordions whenever the
//       open worker has pool === "Contractor"
//     · Drives the "Add contractor" onboarding side panel
//
//   Surfaces independent-contractor (IC) compliance: classification,
//   agreements (MSA + SOW), tax forms (W-9 / W-8BEN / W-8BEN-E),
//   banking, documents
//   (COI, ID, NDA, IP), contractor-submitted invoices, and 1099 prep.
// =====================================================================

const { useState: useStateC, useEffect: useEffectC, useMemo: useMemoC } = React;

// ---------- Sample roster ---------------------------------------------
// Each contractor: { id, name, pool: "Contractor", supplier: null,
//   country, entity, taxForm, rateType, rateAmount, currency, tenureMos,
//   weeklyHours, agreement, classification, riskScore, status, jobs,
//   shifts, workerId, ytdPaid, lastInvoice, … }
const CONTRACTOR_WORKERS_RAW = [
  {
    id: "c-an",
    name: "Anika Narang",
    pool: "Contractor", supplier: null,
    workerId: "c-19fa…7c01",
    status: "Compliant",
    jobs: ["UX Researcher"],
    shifts: 0,
    country: "US", countryName: "United States", flag: "us",
    entity: "Single-member LLC",
    legalName: "Narang Research LLC",
    taxForm: "W-9", taxClass: "1099-NEC",
    rateType: "Hourly", rateAmount: 145, currency: "USD",
    weeklyHours: 22, tenureMos: 14,
    agreement: { type: "MSA + SOW", status: "Countersigned", effective: "2025-03-01", expires: "2026-03-01" },
    classification: "Independent contractor",
    riskScore: 18, // out of 100, lower is safer
    ytdPaid: 71400, lastInvoice: { id: "CINV-2041", amount: 6380, date: "2026-05-09", status: "Approved" },
    payMethod: "ACH",
    address: "1318 Folsom St, San Francisco, CA 94103",
    email: "anika@narangresearch.com",
    phone: "+1 (415) 555-0142",
  },
  {
    id: "c-rb",
    name: "Rafael Borja",
    pool: "Contractor", supplier: null,
    workerId: "c-8e22…d0b3",
    status: "Compliant",
    jobs: ["Senior iOS Engineer"],
    shifts: 0,
    country: "BR", countryName: "Brazil", flag: "br",
    entity: "Sole proprietor", legalName: "Rafael Borja ME",
    taxForm: "W-8BEN", taxClass: "1042-S",
    rateType: "Fixed monthly", rateAmount: 9600, currency: "USD",
    weeklyHours: 38, tenureMos: 9,
    agreement: { type: "MSA + SOW", status: "Countersigned", effective: "2025-08-15", expires: "2026-08-15" },
    classification: "Independent contractor",
    riskScore: 42, // hours pushing toward employee
    ytdPaid: 48000, lastInvoice: { id: "CINV-2078", amount: 9600, date: "2026-05-01", status: "Paid" },
    payMethod: "Wise",
    address: "R. Oscar Freire 1208, São Paulo, SP",
    email: "rafael@borja.dev",
    phone: "+55 11 95555 0188",
  },
  {
    id: "c-mk",
    name: "Margot Kessler",
    pool: "Contractor", supplier: null,
    workerId: "c-44a1…b921",
    status: "Compliant",
    jobs: ["Brand Designer"],
    shifts: 0,
    country: "DE", countryName: "Germany", flag: "de",
    entity: "Freelancer (Freiberufler)",
    legalName: "Margot Kessler",
    taxForm: "W-8BEN", taxClass: "1042-S",
    rateType: "Project (Milestone)", rateAmount: 22500, currency: "EUR",
    weeklyHours: 16, tenureMos: 6,
    agreement: { type: "MSA + SOW", status: "Countersigned", effective: "2025-11-04", expires: "2026-05-04" },
    classification: "Independent contractor",
    riskScore: 12,
    ytdPaid: 14200, lastInvoice: { id: "CINV-2102", amount: 7500, date: "2026-04-28", status: "Paid" },
    payMethod: "SEPA",
    address: "Kastanienallee 41, 10435 Berlin",
    email: "margot@kessler.studio",
    phone: "+49 30 5555 0167",
  },
  {
    id: "c-th",
    name: "Theo Halberstam",
    pool: "Contractor", supplier: null,
    workerId: "c-19fa…2efe",
    status: "Compliant",
    jobs: ["HRIS Consultant"],
    shifts: 0,
    country: "US", countryName: "United States", flag: "us",
    entity: "S-Corporation", legalName: "Halberstam Advisory Inc.",
    taxForm: "W-9", taxClass: "1099-NEC",
    rateType: "Hourly", rateAmount: 215, currency: "USD",
    weeklyHours: 12, tenureMos: 28,
    agreement: { type: "MSA + SOW", status: "Renewal due", effective: "2024-01-10", expires: "2026-01-10" },
    classification: "Independent contractor",
    riskScore: 64, // tenure + renewal expired
    ytdPaid: 41200, lastInvoice: { id: "CINV-2055", amount: 4730, date: "2026-05-06", status: "Submitted" },
    payMethod: "ACH",
    address: "455 Park Ave S, New York, NY 10016",
    email: "theo@halberstam.com",
    phone: "+1 (212) 555-0119",
  },
  {
    id: "c-ke",
    name: "Kelechi Eze",
    pool: "Contractor", supplier: null,
    workerId: "c-7d11…04a2",
    status: "Onboarding",
    jobs: ["Backend Engineer"],
    shifts: 0,
    country: "NG", countryName: "Nigeria", flag: "ng",
    entity: "Individual",
    legalName: "Kelechi Eze",
    taxForm: "W-8BEN", taxClass: "1042-S",
    rateType: "Hourly", rateAmount: 65, currency: "USD",
    weeklyHours: 35, tenureMos: 0,
    agreement: { type: "MSA + SOW", status: "Awaiting signature", effective: "—", expires: "—" },
    classification: "Pending review",
    riskScore: 36,
    ytdPaid: 0, lastInvoice: null,
    payMethod: "Wise",
    address: "21B Adeola Odeku St, Victoria Island, Lagos",
    email: "kelechi@eze.dev",
    phone: "+234 802 555 0144",
  },
  {
    id: "c-sa",
    name: "Sofía Aldama",
    pool: "Contractor", supplier: null,
    workerId: "c-3b91…ff80",
    status: "Compliant",
    jobs: ["Translation Specialist"],
    shifts: 0,
    country: "MX", countryName: "Mexico", flag: "mx",
    entity: "Individual",
    legalName: "Sofía Aldama Vega",
    taxForm: "W-8BEN", taxClass: "1042-S",
    rateType: "Per-word", rateAmount: 0.18, currency: "USD",
    weeklyHours: 18, tenureMos: 11,
    agreement: { type: "MSA + SOW", status: "Countersigned", effective: "2025-06-12", expires: "2026-06-12" },
    classification: "Independent contractor",
    riskScore: 14,
    ytdPaid: 18750, lastInvoice: { id: "CINV-2099", amount: 2980, date: "2026-04-22", status: "Paid" },
    payMethod: "Wise",
    address: "Av. Álvaro Obregón 130, Roma Norte, CDMX",
    email: "sofia@aldama.mx",
    phone: "+52 55 5555 0102",
  },
  {
    id: "c-pl",
    name: "Priya Loomis",
    pool: "Contractor", supplier: null,
    workerId: "c-c200…91ab",
    status: "Compliant",
    jobs: ["Tax Consultant"],
    shifts: 0,
    country: "US", countryName: "United States", flag: "us",
    entity: "Single-member LLC",
    legalName: "Loomis Tax PLLC",
    taxForm: "W-9", taxClass: "1099-NEC",
    rateType: "Hourly", rateAmount: 275, currency: "USD",
    weeklyHours: 9, tenureMos: 19,
    agreement: { type: "MSA + SOW", status: "Countersigned", effective: "2024-10-01", expires: "2026-10-01" },
    classification: "Independent contractor",
    riskScore: 22,
    ytdPaid: 32100, lastInvoice: { id: "CINV-2061", amount: 3850, date: "2026-04-30", status: "Approved" },
    payMethod: "ACH",
    address: "1000 Main St #210, Austin, TX 78701",
    email: "priya@loomistax.com",
    phone: "+1 (512) 555-0177",
  },
  {
    id: "c-jo",
    name: "Jonas Östlund",
    pool: "Contractor", supplier: null,
    workerId: "c-aa10…7711",
    status: "Compliant",
    jobs: ["DevOps Engineer"],
    shifts: 0,
    country: "SE", countryName: "Sweden", flag: "se",
    entity: "Enskild firma",
    legalName: "Östlund Konsult",
    taxForm: "W-8BEN-E", taxClass: "1042-S",
    rateType: "Hourly", rateAmount: 110, currency: "EUR",
    weeklyHours: 30, tenureMos: 21,
    agreement: { type: "MSA + SOW", status: "Countersigned", effective: "2024-06-01", expires: "2026-06-01" },
    classification: "Independent contractor",
    riskScore: 58, // tenure + hours
    ytdPaid: 39800, lastInvoice: { id: "CINV-2090", amount: 13200, date: "2026-04-30", status: "Paid" },
    payMethod: "SEPA",
    address: "Hornsgatan 174, 117 28 Stockholm",
    email: "jonas@ostlund.io",
    phone: "+46 70 555 0166",
  },
  {
    id: "c-am",
    name: "Aakash Mehrotra",
    pool: "Contractor", supplier: null,
    workerId: "c-5e22…b09a",
    status: "Onboarding",
    jobs: ["Data Scientist"],
    shifts: 0,
    country: "IN", countryName: "India", flag: "in",
    entity: "Individual",
    legalName: "Aakash Mehrotra",
    taxForm: "W-8BEN", taxClass: "1042-S",
    rateType: "Hourly", rateAmount: 78, currency: "USD",
    weeklyHours: 25, tenureMos: 0,
    agreement: { type: "MSA + SOW", status: "Draft", effective: "—", expires: "—" },
    classification: "Pending review",
    riskScore: 28,
    ytdPaid: 0, lastInvoice: null,
    payMethod: "Wise",
    address: "12 Cunningham Rd, Bengaluru, KA 560052",
    email: "aakash@aakashm.dev",
    phone: "+91 98 5555 0133",
  },
  {
    id: "c-le",
    name: "Léa Tremblay",
    pool: "Contractor", supplier: null,
    workerId: "c-0a44…fe21",
    status: "Compliant",
    jobs: ["Content Strategist"],
    shifts: 0,
    country: "CA", countryName: "Canada", flag: "ca",
    entity: "Sole proprietor", legalName: "Léa Tremblay",
    taxForm: "W-8BEN", taxClass: "T4A",
    rateType: "Hourly", rateAmount: 95, currency: "CAD",
    weeklyHours: 12, tenureMos: 7,
    agreement: { type: "MSA + SOW", status: "Countersigned", effective: "2025-10-01", expires: "2026-10-01" },
    classification: "Independent contractor",
    riskScore: 16,
    ytdPaid: 11200, lastInvoice: { id: "CINV-2087", amount: 2740, date: "2026-05-02", status: "Paid" },
    payMethod: "EFT",
    address: "1432 Rue Saint-Denis, Montréal, QC",
    email: "lea@tremblay.studio",
    phone: "+1 (514) 555-0145",
  },
  {
    id: "c-mh",
    name: "Marcus Holt",
    pool: "Contractor", supplier: null,
    workerId: "c-2911…7e54",
    status: "Expired",
    jobs: ["Cybersecurity Auditor"],
    shifts: 0,
    country: "US", countryName: "United States", flag: "us",
    entity: "Single-member LLC",
    legalName: "Holt Security LLC",
    taxForm: "W-9", taxClass: "1099-NEC",
    rateType: "Hourly", rateAmount: 195, currency: "USD",
    weeklyHours: 6, tenureMos: 34,
    agreement: { type: "MSA + SOW", status: "Expired", effective: "2023-04-01", expires: "2026-04-01" },
    classification: "At risk",
    riskScore: 78, // long tenure + expired + multiple SOWs
    ytdPaid: 24850, lastInvoice: { id: "CINV-2030", amount: 4150, date: "2026-03-30", status: "Paid" },
    payMethod: "ACH",
    address: "200 Powell St, San Francisco, CA 94102",
    email: "marcus@holtsec.com",
    phone: "+1 (415) 555-0188",
  },
  {
    id: "c-fz",
    name: "Fatima Zerouali",
    pool: "Contractor", supplier: null,
    workerId: "c-7a01…4490",
    status: "Compliant",
    jobs: ["Localization PM"],
    shifts: 0,
    country: "FR", countryName: "France", flag: "fr",
    entity: "Auto-entrepreneur",
    legalName: "Fatima Zerouali",
    taxForm: "W-8BEN", taxClass: "1042-S",
    rateType: "Fixed monthly", rateAmount: 5400, currency: "EUR",
    weeklyHours: 22, tenureMos: 13,
    agreement: { type: "MSA + SOW", status: "Countersigned", effective: "2025-05-15", expires: "2026-05-15" },
    classification: "Independent contractor",
    riskScore: 31,
    ytdPaid: 27000, lastInvoice: { id: "CINV-2071", amount: 5400, date: "2026-05-01", status: "Approved" },
    payMethod: "SEPA",
    address: "12 Rue du Faubourg Saint-Antoine, 75011 Paris",
    email: "fatima@zerouali.fr",
    phone: "+33 6 55 55 01 22",
  },
];

// Sample agreement, document, and invoice histories. Keyed by contractor
// id so the detail sections can render real data per contractor.
const CONTRACTOR_AGREEMENTS = {
  "c-an": [
    { id: "MSA-2025-018",  type: "MSA",                 status: "Countersigned",  signed: "2025-03-01", expires: "2026-03-01", signer: "Anika Narang" },
    { id: "SOW-2026-041",  type: "SOW · Research sprint Q2", status: "Countersigned", signed: "2026-04-04", expires: "2026-07-04", signer: "Anika Narang" },
    { id: "NDA-2025-018",  type: "NDA",                 status: "Countersigned",  signed: "2025-03-01", expires: "—",        signer: "Anika Narang" },
    { id: "IPA-2025-018",  type: "IP Assignment",       status: "Countersigned",  signed: "2025-03-01", expires: "—",        signer: "Anika Narang" },
  ],
  "c-th": [
    { id: "MSA-2024-007",  type: "MSA",                 status: "Renewal due",    signed: "2024-01-10", expires: "2026-01-10", signer: "Theo Halberstam" },
    { id: "SOW-2026-022",  type: "SOW · HRIS rollout",     status: "Countersigned", signed: "2026-01-15", expires: "2026-07-15", signer: "Theo Halberstam" },
    { id: "NDA-2024-007",  type: "NDA",                 status: "Countersigned",  signed: "2024-01-10", expires: "—",        signer: "Theo Halberstam" },
  ],
  "c-mh": [
    { id: "MSA-2023-014",  type: "MSA",                 status: "Expired",        signed: "2023-04-01", expires: "2026-04-01", signer: "Marcus Holt" },
    { id: "SOW-2026-009",  type: "SOW · Security audit",      status: "Active",   signed: "2026-01-01", expires: "2026-06-30", signer: "Marcus Holt" },
  ],
  "c-ke": [
    { id: "MSA-2026-088",  type: "MSA",                 status: "Awaiting signature", signed: "—",      expires: "—",        signer: "Pending" },
    { id: "SOW-2026-101",  type: "SOW · Backend rebuild",     status: "Draft",   signed: "—",         expires: "—",        signer: "Pending" },
  ],
};

const CONTRACTOR_DOCS = {
  "c-an": [
    { name: "W-9 (2025)",                  type: "Tax",      status: "On file",  expires: "2026-12-31" },
    { name: "Government-issued ID",        type: "Identity", status: "Verified", expires: "2032-04-12" },
    { name: "Certificate of insurance",    type: "Insurance", status: "On file", expires: "2026-09-01" },
    { name: "California business license", type: "License",  status: "On file",  expires: "2026-12-31" },
  ],
  "c-th": [
    { name: "W-9 (2024)",                  type: "Tax",      status: "Stale",    expires: "2024-12-31" },
    { name: "Government-issued ID",        type: "Identity", status: "Verified", expires: "2030-08-22" },
    { name: "Certificate of insurance",    type: "Insurance", status: "Expired", expires: "2025-12-31" },
  ],
  "c-mh": [
    { name: "W-9 (2023)",                  type: "Tax",      status: "Stale",    expires: "2023-12-31" },
    { name: "Certificate of insurance",    type: "Insurance", status: "Expired", expires: "2025-04-01" },
  ],
};

const CONTRACTOR_INVOICES = {
  "c-an": [
    { id: "CINV-2041", date: "2026-05-09", period: "Apr 16 – Apr 30",  hours: 44, amount: 6380, currency: "USD", status: "Approved" },
    { id: "CINV-2019", date: "2026-04-25", period: "Apr 01 – Apr 15",  hours: 47, amount: 6815, currency: "USD", status: "Paid" },
    { id: "CINV-1996", date: "2026-04-11", period: "Mar 16 – Mar 31",  hours: 42, amount: 6090, currency: "USD", status: "Paid" },
  ],
  "c-th": [
    { id: "CINV-2055", date: "2026-05-06", period: "Apr 16 – Apr 30",  hours: 22, amount: 4730, currency: "USD", status: "Submitted" },
    { id: "CINV-2031", date: "2026-04-23", period: "Apr 01 – Apr 15",  hours: 24, amount: 5160, currency: "USD", status: "Paid" },
  ],
  "c-mh": [
    { id: "CINV-2030", date: "2026-03-30", period: "Mar 16 – Mar 31",  hours: 22, amount: 4290, currency: "USD", status: "Paid" },
  ],
};

// ---------- Lookup helpers ----------------------------------------------
function getContractorWorkers() { return CONTRACTOR_WORKERS_RAW; }
function getContractorById(id) {
  return CONTRACTOR_WORKERS_RAW.find((c) => c.id === id) || null;
}
function isContractor(w) { return w && w.pool === "Contractor"; }

// ---------- Risk-score color + label ------------------------------------
function riskMeta(score) {
  if (score >= 60) return { label: "High risk",    hue: "error",       fg: "var(--evr-content-status-error-default)",       bg: "var(--evr-surface-decorative-default-red)" };
  if (score >= 35) return { label: "Medium risk",  hue: "warning",     fg: "var(--evr-content-status-warning-default)",     bg: "var(--evr-surface-decorative-default-yellow)" };
  return { label: "Low risk", hue: "success", fg: "var(--evr-content-status-success-default)", bg: "var(--evr-surface-decorative-default-green)" };
}

// ---------- Currency format ---------------------------------------------
function fmtMoney(amt, ccy) {
  if (typeof amt !== "number") return "—";
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: ccy || "USD", maximumFractionDigits: amt >= 100 ? 0 : 2 }).format(amt);
  } catch (e) {
    return `${ccy || "USD"} ${amt}`;
  }
}

Object.assign(window, {
  CONTRACTOR_WORKERS_RAW,
  CONTRACTOR_AGREEMENTS,
  CONTRACTOR_DOCS,
  CONTRACTOR_INVOICES,
  getContractorWorkers,
  getContractorById,
  isContractor,
  contractorRiskMeta: riskMeta,
  fmtContractorMoney: fmtMoney,
});
