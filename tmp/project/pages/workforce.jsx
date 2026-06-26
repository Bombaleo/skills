// =====================================================================
// Flex Work — Workforce
//   · WorkforcePage           — searchable list with worker / supplier
//                                / jobs / shifts.
//   · WorkerDetailsPage       — hero · Details accordion (open) · Compliance
//                                · Schedule (empty) · Blocked locations
//                                (empty w/ action) · Logs (empty).
// =====================================================================

const { useState: useStateWf, useMemo: useMemoWf } = React;

// ---------- Worker avatar swatches --------------------------------------
// Worker rows don't have brand colours — give each a stable colour by
// hashing the id so the avatar reads as "the same person" across the app.
const WORKER_PALETTES = [
  { bg: "#43BEEF", fg: "#062D3D" },
  { bg: "#F9B571", fg: "#76420F" },
  { bg: "#A476EA", fg: "#311254" },
  { bg: "#87DED1", fg: "#07312B" },
  { bg: "#F4A4D8", fg: "#5A1340" },
  { bg: "#82C0E0", fg: "#0B3045" },
  { bg: "#EFC056", fg: "#6E4517" },
  { bg: "#7CC8A8", fg: "#0B3826" },
  { bg: "#9EAEFA", fg: "#1B2762" },
  { bg: "#F08A8A", fg: "#5A1414" },
];
function paletteFor(seed) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return WORKER_PALETTES[h % WORKER_PALETTES.length];
}
function initialsFor(name) {
  return name.split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
}

// ---------- Mock data ----------------------------------------------------
// Each worker belongs to a talent pool. Most are "Agency" (sourced
// through a supplier — supplier field set). Other pools cover internal
// staff and the various reach-back lanes (float, per-diem, alumni) that
// the buyer maintains directly. POOL_META below drives the UI labels.
//
// `industries` tag controls visibility: workers tagged with the active
// industry id (or omitted = always visible) appear in the list. This
// keeps clinical Float-pool nurses out of a manufacturing demo and so on.
const WORKERS_RAW_BASE = [
  // ----- Agency workers (sourced through suppliers) — universal -----
  { id: "w-ml",  name: "Maya Lin",        pool: "Agency",  supplier: "gs", status: "Compliant",   jobs: ["Production Associate", "Picker"],                         shifts: 47, workerId: "19dab1…1e1171", email: "maya.lin@goodshift.com",       phone: "+1 (212) 555-0142", dob: "Jan 14, 1996", region: "NY - Metro NYC",       securityId: "SS0101476C", externalId: "EXT-204871" },
  { id: "w-jc",  name: "Jamal Carter",    pool: "Agency",  supplier: "sw", status: "Compliant",   jobs: ["Line Manager"],                                        shifts: 38, workerId: "84acd9…b2f04a", email: "jamal.c@staffwise.io",         phone: "+1 (415) 555-0188", dob: "Mar 02, 1991", region: "CA - Bay Area",        securityId: "SS0204189A", externalId: "—" },
  { id: "w-pr",  name: "Priya Ramesh",    pool: "Agency",  supplier: "th", status: "Compliant",   jobs: ["Production Associate"],                                   shifts: 52, workerId: "62b1ce…78d3a2", email: "priya.r@talenthub.work",       phone: "+1 (646) 555-0173", dob: "Aug 21, 1994", region: "NY - Metro NYC",       securityId: "SS0308274B", externalId: "EXT-118905" },
  { id: "w-tk",  name: "Terry Donin",     pool: "Agency",  supplier: "ph", status: "Compliant",   jobs: ["Prep Cook", "Line Cook"],                              shifts: 29, workerId: "f0a8b7…d51e09", email: "terry.donin@prohire.com",      phone: "+1 (617) 555-0156", dob: "Nov 30, 1988", region: "MA - Greater Boston",  securityId: "SS0411982C", externalId: "—" },
  { id: "w-ss",  name: "Sami Soto",       pool: "Agency",  supplier: "ss", status: "Compliant",   jobs: ["Warehouse Clerk"],                                     shifts: 41, workerId: "2c7fa1…a0bc44", email: "sami.soto@skillscouts.co",     phone: "+1 (720) 555-0119", dob: "Feb 09, 1992", region: "CO - Denver Metro",    securityId: "SS0512377D", externalId: "EXT-554120" },
  { id: "w-cc",  name: "Charlie Carder",  pool: "Agency",  supplier: "gs", status: "Compliant",   jobs: ["Prep Cook"],                                           shifts: 33, workerId: "8e21cd…0f9b72", email: "charlie.c@goodshift.com",      phone: "+1 (312) 555-0102", dob: "Jun 18, 1990", region: "IL - Chicago Metro",   securityId: "SS0608854A", externalId: "EXT-309014" },
  { id: "w-mh",  name: "Makenna Herwitz", pool: "Agency",  supplier: "sw", status: "Onboarding",  jobs: ["Server", "Host"],                                      shifts: 18, workerId: "55d8a4…3e2f81", email: "makenna.h@staffwise.io",       phone: "+1 (206) 555-0167", dob: "Apr 05, 1998", region: "WA - Greater Seattle", securityId: "SS0703411E", externalId: "—" },
  { id: "w-ja",  name: "Jakob Aminoff",   pool: "Agency",  supplier: "th", status: "Compliant",   jobs: ["Bartender", "Server"],                                 shifts: 26, workerId: "a7bd1c…f54009", email: "jakob.a@talenthub.work",       phone: "+1 (404) 555-0145", dob: "Sep 14, 1989", region: "GA - Atlanta Metro",   securityId: "SS0804972B", externalId: "EXT-672144" },
  { id: "w-ks",  name: "Kierra Stanton",  pool: "Agency",  supplier: "ph", status: "Compliant",   jobs: ["Server", "Cook"],                                      shifts: 22, workerId: "1f44ce…b8d20a", email: "kierra.s@prohire.com",         phone: "+1 (212) 555-0179", dob: "Dec 22, 1995", region: "NY - Metro NYC",       securityId: "SS0905120C", externalId: "—" },
  { id: "w-jg",  name: "Jaxson Geidt",    pool: "Agency",  supplier: "gs", status: "Expired",     jobs: ["Prep Cook"],                                           shifts: 9,  workerId: "9b2a5e…71fd0c", email: "jaxson.g@goodshift.com",       phone: "+1 (415) 555-0124", dob: "Jul 11, 1993", region: "CA - Bay Area",        securityId: "SS1006837A", externalId: "EXT-810032" },
  { id: "w-mw",  name: "Marcus Webb",     pool: "Agency",  supplier: "ss", status: "Compliant",   jobs: ["Factory Line Assembler", "Operator", "Inspector"],     shifts: 44, workerId: "55adc1…2f8401", email: "marcus.w@skillscouts.co",      phone: "+1 (720) 555-0182", dob: "May 17, 1987", region: "CO - Denver Metro",    securityId: "SS1107264B", externalId: "EXT-447712" },
  { id: "w-aw",  name: "Ada Watts",       pool: "Agency",  supplier: "sw", status: "Onboarding",  jobs: ["Operator", "Assembler"],                               shifts: 4,  workerId: "—",            email: "ada.watts@staffwise.io",       phone: "+1 (415) 555-0193", dob: "Jan 01, 2001", region: "CA - Bay Area",        securityId: "SS1208549D", externalId: "—" },
  // ----- Non-agency pools (buyer-owned reach-back lanes) -----
  { id: "w-bb",  name: "Brianna Boone",   pool: "Internal", supplier: null, status: "Compliant",  jobs: ["Production Associate"],                                   shifts: 64, workerId: "11ef02…a91d7c", email: "brianna.boone@dayforce.demo", phone: "+1 (415) 555-0210", dob: "Oct 11, 1992", region: "CA - Bay Area",        securityId: "SS1309076F", externalId: "EMP-002918" },
  { id: "w-dh",  name: "Devon Halverson", pool: "Internal", supplier: null, status: "Compliant",  jobs: ["Line Manager"],                                        shifts: 71, workerId: "8a4e1d…7c0021", email: "devon.h@dayforce.demo",       phone: "+1 (415) 555-0222", dob: "Feb 28, 1985", region: "CA - Bay Area",        securityId: "SS1402341G", externalId: "EMP-004102" },
  // ----- Healthcare-only Float / per-diem nurses (Mercy) -----
  // Mercy ships with the Float supplier type enabled in Settings →
  // Configuration → Supplier types. These workers are directly
  // employed by the health system but not assigned to one location —
  // their profile, schedule, and accrued hours are owned by Dayforce
  // core; Flex Work syncs the record so they can be matched against
  // open shifts across Mercy Memorial, Mercy Medical Plaza, and
  // Mercy Oakwood.
  { id: "w-pa",  name: "Priya Aravind",     industries: ["healthcare"], pool: "Float",   supplierType: "Float", sourcingChannel: "FloatPool", supplier: null, status: "Compliant",  jobs: ["Registered Nurse", "Med-Surg"],         shifts: 28, workerId: "29c4af…1085e2", email: "priya.aravind@mercy.demo",    phone: "+1 (415) 555-0235", dob: "Apr 03, 1990", region: "CA - Bay Area",        securityId: "SS1505123H", externalId: "FLT-118007" },
  { id: "w-jh",  name: "Jordan Hsu",        industries: ["healthcare"], pool: "Float",   supplierType: "Float", sourcingChannel: "FloatPool", supplier: null, status: "Compliant",  jobs: ["Registered Nurse", "ICU"],              shifts: 36, workerId: "f1e8c2…3a5f06", email: "jordan.hsu@mercy.demo",       phone: "+1 (415) 555-0247", dob: "Jun 22, 1986", region: "CA - Bay Area",        securityId: "SS1606814I", externalId: "FLT-118034" },
  { id: "w-mc",  name: "Maya Castellanos",  industries: ["healthcare"], pool: "Float",   supplierType: "Float", sourcingChannel: "FloatPool", supplier: null, status: "Compliant",  jobs: ["Registered Nurse", "Emergency Dept."],  shifts: 44, workerId: "8b22e7…9c14f1", email: "maya.castellanos@mercy.demo", phone: "+1 (415) 555-0258", dob: "Mar 14, 1988", region: "CA - Bay Area",        securityId: "SS1709220M", externalId: "FLT-118052" },
  { id: "w-do",  name: "Daniel Okafor",     industries: ["healthcare"], pool: "Float",   supplierType: "Float", sourcingChannel: "FloatPool", supplier: null, status: "Compliant",  jobs: ["Registered Nurse", "Telemetry"],        shifts: 31, workerId: "2f55a1…b740c8", email: "daniel.okafor@mercy.demo",    phone: "+1 (415) 555-0269", dob: "Nov 02, 1991", region: "CA - Bay Area",        securityId: "SS1811445N", externalId: "FLT-118071" },
  { id: "w-rb",  name: "Rosa Bianchi",      industries: ["healthcare"], pool: "Float",   supplierType: "Float", sourcingChannel: "FloatPool", supplier: null, status: "Compliant",  jobs: ["LPN", "Med-Surg"],                      shifts: 22, workerId: "a4cc09…3e10b2", email: "rosa.bianchi@mercy.demo",     phone: "+1 (415) 555-0274", dob: "Jul 27, 1993", region: "CA - Bay Area",        securityId: "SS1912778O", externalId: "FLT-118086" },
  { id: "w-tn",  name: "Tomás Núñez",       industries: ["healthcare"], pool: "Float",   supplierType: "Float", sourcingChannel: "FloatPool", supplier: null, status: "Compliant",  jobs: ["Surgical Tech", "OR"],                  shifts: 38, workerId: "63dd80…5f29ae", email: "tomas.nunez@mercy.demo",      phone: "+1 (415) 555-0286", dob: "May 18, 1987", region: "CA - Bay Area",        securityId: "SS2013004P", externalId: "FLT-118098" },
  { id: "w-ko",  name: "Keiko Ozawa",       industries: ["healthcare"], pool: "Float",   supplierType: "Float", sourcingChannel: "FloatPool", supplier: null, status: "Onboarding", jobs: ["Registered Nurse", "Pediatric"],        shifts: 6,  workerId: "9e7140…41c803", email: "keiko.ozawa@mercy.demo",      phone: "+1 (415) 555-0291", dob: "Sep 09, 1994", region: "CA - Bay Area",        securityId: "SS2114559Q", externalId: "FLT-118114" },
  { id: "w-as",  name: "Aaron Schultz",     industries: ["healthcare"], pool: "Float",   supplierType: "Float", sourcingChannel: "FloatPool", supplier: null, status: "Compliant",  jobs: ["Respiratory Therapist"],                shifts: 27, workerId: "5b3e21…8a44e9", email: "aaron.schultz@mercy.demo",    phone: "+1 (415) 555-0303", dob: "Jan 30, 1985", region: "CA - Bay Area",        securityId: "SS2215180R", externalId: "FLT-118127" },
  // ----- Hospitality-only Float bartender / server (Aurora) -----
  { id: "w-pa-hy",  name: "Priya Aravind",   industries: ["hospitality"], pool: "Float", supplier: null, status: "Compliant", jobs: ["Banquet Captain", "Sommelier"],         shifts: 28, workerId: "29c4af…1085e2", email: "priya.aravind@aurora.demo",   phone: "+1 (415) 555-0235", dob: "Apr 03, 1990", region: "CA - Bay Area",        securityId: "SS1505123H", externalId: "FLT-118007" },
  { id: "w-jh-hy",  name: "Jordan Hsu",      industries: ["hospitality"], pool: "Float", supplier: null, status: "Compliant", jobs: ["Bartender", "Mixologist"],              shifts: 36, workerId: "f1e8c2…3a5f06", email: "jordan.hsu@aurora.demo",      phone: "+1 (415) 555-0247", dob: "Jun 22, 1986", region: "CA - Bay Area",        securityId: "SS1606814I", externalId: "FLT-118034" },
  // ----- Retail-only Float visual merchandiser / supervisor (Northwind) -----
  { id: "w-pa-rt",  name: "Priya Aravind",   industries: ["retail"], pool: "Float", supplier: null, status: "Compliant", jobs: ["Visual Merchandiser", "Sales Lead"],     shifts: 28, workerId: "29c4af…1085e2", email: "priya.aravind@northwind.demo", phone: "+1 (415) 555-0235", dob: "Apr 03, 1990", region: "CA - Bay Area",        securityId: "SS1505123H", externalId: "FLT-118007" },
  { id: "w-jh-rt",  name: "Jordan Hsu",      industries: ["retail"], pool: "Float", supplier: null, status: "Compliant", jobs: ["Store Manager", "Floor Lead"],            shifts: 36, workerId: "f1e8c2…3a5f06", email: "jordan.hsu@northwind.demo",    phone: "+1 (415) 555-0247", dob: "Jun 22, 1986", region: "CA - Bay Area",        securityId: "SS1606814I", externalId: "FLT-118034" },
  // ----- Manufacturing-only Float lead / QA (Atlas) -----
  { id: "w-pa-mf",  name: "Priya Aravind",   industries: ["manufacturing"], pool: "Float", supplier: null, status: "Compliant", jobs: ["Lead Operator", "QC Inspector"],        shifts: 28, workerId: "29c4af…1085e2", email: "priya.aravind@atlas.demo",     phone: "+1 (415) 555-0235", dob: "Apr 03, 1990", region: "CA - Bay Area",        securityId: "SS1505123H", externalId: "FLT-118007" },
  { id: "w-jh-mf",  name: "Jordan Hsu",      industries: ["manufacturing"], pool: "Float", supplier: null, status: "Compliant", jobs: ["Maintenance Tech", "Electrician"],      shifts: 36, workerId: "f1e8c2…3a5f06", email: "jordan.hsu@atlas.demo",        phone: "+1 (415) 555-0247", dob: "Jun 22, 1986", region: "CA - Bay Area",        securityId: "SS1606814I", externalId: "FLT-118034" },
  // ----- Logistics-only Float CDL driver / dispatcher (Midland) -----
  { id: "w-pa-lg",  name: "Priya Aravind",   industries: ["logistics"], pool: "Float", supplier: null, status: "Compliant", jobs: ["Dispatcher", "Driver · Class A"],       shifts: 28, workerId: "29c4af…1085e2", email: "priya.aravind@midland.demo",   phone: "+1 (415) 555-0235", dob: "Apr 03, 1990", region: "CA - Bay Area",        securityId: "SS1505123H", externalId: "FLT-118007" },
  { id: "w-jh-lg",  name: "Jordan Hsu",      industries: ["logistics"], pool: "Float", supplier: null, status: "Compliant", jobs: ["Lead Driver", "Driver · HAZMAT"],       shifts: 36, workerId: "f1e8c2…3a5f06", email: "jordan.hsu@midland.demo",      phone: "+1 (415) 555-0247", dob: "Jun 22, 1986", region: "CA - Bay Area",        securityId: "SS1606814I", externalId: "FLT-118034" },
  // ----- Per-diem / Alumni — universal -----
  { id: "w-pl",  name: "Pat Liang",       pool: "Float", supplier: null, status: "Compliant", jobs: ["Server", "Bartender"],                                 shifts: 12, workerId: "c5a09b…2d76f0", email: "pat.liang@dayforce.demo",     phone: "+1 (646) 555-0259", dob: "Aug 30, 1995", region: "NY - Metro NYC",       securityId: "SS1707208J", externalId: "PD-002231" },
  { id: "w-ek",  name: "Elena Karras",    pool: "Float", supplier: null, status: "Compliant", jobs: ["Production Associate"],                                   shifts: 16, workerId: "76db14…f80a93", email: "elena.k@dayforce.demo",       phone: "+1 (646) 555-0264", dob: "Nov 17, 1991", region: "NY - Metro NYC",       securityId: "SS1808965K", externalId: "PD-002247" },
  { id: "w-rt",  name: "Ren Tanaka",      pool: "Alumni",  supplier: null, status: "Compliant",  jobs: ["Operator", "Forklift"],                                shifts: 47, workerId: "320d8f…b1c507", email: "ren.tanaka@dayforce.demo",    phone: "+1 (720) 555-0271", dob: "Jan 09, 1989", region: "CO - Denver Metro",    securityId: "SS1909432L", externalId: "ALM-009912" },
  // ----- EOR (Employer of Record) — international workers staffed via
  // a global EOR provider. Buyer never touches local payroll; the EOR
  // bills back a fully-loaded rate that includes employer taxes,
  // statutory benefits, and the EOR fee.
  { id: "w-iv",  name: "Ines Vargas",     pool: "EOR",     supplier: "evp", supplierType: "EOR", sourcingChannel: "EOR", flag: "co", countryName: "Colombia", status: "Compliant",  jobs: ["Production Associate", "QC Inspector"],                shifts: 38, workerId: "1a09cf…4e2210", email: "ines.vargas@deel.eor",       phone: "+52 55 5555 0118", dob: "Sep 04, 1990", region: "MX - Monterrey",      securityId: "—",          externalId: "EOR-001102" },
  { id: "w-lk",  name: "Lukas Kowalski",  pool: "EOR",     supplier: "gpe", supplierType: "EOR", sourcingChannel: "EOR", flag: "pl", countryName: "Poland",   status: "Compliant",  jobs: ["Line Manager"],                                        shifts: 41, workerId: "4d80fa…c11b29", email: "lukas.k@deel.eor",           phone: "+48 22 555 0144", dob: "Feb 17, 1988", region: "PL - Warsaw",          securityId: "—",          externalId: "EOR-001148" },
  { id: "w-na",  name: "Nayara Almeida",  pool: "EOR",     supplier: "bwk", supplierType: "EOR", sourcingChannel: "EOR", flag: "br", countryName: "Brazil",   status: "Onboarding", jobs: ["Warehouse Clerk"],                                     shifts: 4,  workerId: "—",            email: "nayara.a@remote.eor",        phone: "+55 11 5555 0277", dob: "Jun 28, 1996", region: "BR - São Paulo",       securityId: "—",          externalId: "EOR-001255" },
  { id: "w-pm",  name: "Priya Menon",     pool: "EOR",     supplier: "evp", supplierType: "EOR", sourcingChannel: "EOR", flag: "in", countryName: "India",    status: "Compliant",  jobs: ["Operator", "Assembler"],                               shifts: 52, workerId: "7e2bd4…a90fe1", email: "priya.menon@remote.eor",     phone: "+91 80 5555 0392", dob: "Dec 11, 1989", region: "IN - Bengaluru",       securityId: "—",          externalId: "EOR-001318" },
  // ----- Professional engagement-type examples — only render when the
  // active org has the Professional jobs category enabled (Settings →
  // Configuration → Jobs). Each worker carries an explicit
  // engagementType of Assignment / Project / Statement of Work, plus
  // engagement-specific fields (cadence, rate, SOW reference, renewal
  // date). The pool stays Agency / Internal — they ARE workforce; only
  // the engagement shape changes. Row + detail render layers below
  // swap field content based on engagementType while keeping the same
  // cells and accordions as a frontline worker, so one mixed list
  // continues to read with one layout. -----
  { id: "w-pro-eh",  name: "Elena Halvorsen", pool: "Agency",  supplier: "sw", supplierType: "Agency", status: "Compliant",
    engagementType: "Assignment", billingBasis: "Monthly", timeCapture: "Time Tracking",
    jobs: ["Senior Product Manager"],
    shifts: 0, workerId: "p-71fa…ad21",
    email: "elena.halvorsen@staffwise.io", phone: "+1 (612) 555-0144", dob: "Aug 09, 1988",
    region: "MN - Twin Cities", securityId: "SS2104881M", externalId: "ASGN-2026-0744",
    cadence: "Monthly", rateAmount: 18500, rateCurrency: "USD",
    engagementRef: "ASGN-2026-0744", engagementName: "Interim PMO leadership",
    contractStart: "2025-09-01", contractEnd: "Permanent", renewalDate: "2026-09-01",
    hiringManager: "Amy Hennen", _professionalRow: true,
  },
  { id: "w-pro-rd",  name: "Rishi Devarajan", pool: "Agency",  supplier: "ap", supplierType: "Agency", status: "Compliant",
    engagementType: "Assignment", billingBasis: "Monthly", timeCapture: "Time Tracking",
    jobs: ["Engineering Manager", "Platform Lead"],
    shifts: 0, workerId: "p-22ab…7901",
    email: "rishi.devarajan@alphatech.dev", phone: "+1 (416) 555-0188", dob: "Mar 02, 1985",
    region: "ON - Toronto", securityId: "SS2207214N", externalId: "ASGN-2024-0612",
    cadence: "Monthly", rateAmount: 24000, rateCurrency: "CAD",
    engagementRef: "ASGN-2024-0612", engagementName: "Platform reliability program",
    contractStart: "2024-11-15", contractEnd: "Permanent", renewalDate: "2026-05-15",
    hiringManager: "Terry Donin", _professionalRow: true,
  },
  { id: "w-pro-pr",  name: "Priya Ramesh-Singh", pool: "Agency",  supplier: "th", supplierType: "Agency", status: "Compliant",
    engagementType: "Assignment", billingBasis: "Weekly", timeCapture: "Time Tracking",
    jobs: ["Senior Software Engineer"],
    shifts: 0, workerId: "p-44ce…3a02",
    email: "priya.singh@talenthub.work", phone: "+1 (646) 555-0192", dob: "Jul 12, 1991",
    region: "NY - Metro NYC", securityId: "SS2308102O", externalId: "ASGN-2026-1144",
    cadence: "Weekly", rateAmount: 6600, rateCurrency: "USD",
    engagementRef: "ASGN-2026-1144", engagementName: "Payroll modernization",
    contractStart: "2026-02-01", contractEnd: "2026-12-31", renewalDate: "2026-12-31",
    hiringManager: "Amy Hennen", _professionalRow: true,
  },
  { id: "w-pro-lc",  name: "Lucia Castelló",   pool: "Agency",  supplier: "sw", supplierType: "Agency", status: "Compliant",
    engagementType: "Assignment", billingBasis: "Hourly", timeCapture: "Time Tracking",
    jobs: ["UX Designer", "Product Designer"],
    shifts: 0, workerId: "p-44dd…9101",
    email: "lucia.castello@staffwise.io", phone: "+34 6 5555 0144", dob: "Jan 27, 1990",
    region: "ES - Madrid", securityId: "—", externalId: "ASGN-2026-1182",
    cadence: "Hourly", rateAmount: 145, rateCurrency: "USD",
    engagementRef: "ASGN-2026-1182", engagementName: "WMS UX research sprints",
    contractStart: "2026-01-05", contractEnd: "2026-09-30", renewalDate: "2026-09-30",
    hiringManager: "Beatriz Almeida", _professionalRow: true,
  },
  { id: "w-pro-mb",  name: "Marcus Bukenya",  pool: "Agency",  supplier: "ap", supplierType: "Agency", status: "Compliant",
    engagementType: "Project", billingBasis: "Milestone", timeCapture: "N/A",
    jobs: ["DevOps Engineer"],
    shifts: 0, workerId: "p-7732…1188",
    email: "marcus.bukenya@alphatech.dev", phone: "+44 20 5555 0177", dob: "Sep 18, 1987",
    region: "GB - London", securityId: "—", externalId: "PRJ-2026-018-M2",
    cadence: "Milestone", rateAmount: 48000, rateCurrency: "GBP",
    engagementRef: "PRJ-2026-018", engagementName: "DC Alpha · WMS rollout · M2",
    contractStart: "2026-04-01", contractEnd: "2026-07-31", renewalDate: "2026-07-31",
    hiringManager: "Amy Hennen", _professionalRow: true,
  },
  { id: "w-pro-mw",  name: "Mira Wijaya",       pool: "Agency",  supplier: "wf", supplierType: "Agency", status: "Compliant",
    engagementType: "Statement of Work", billingBasis: "Milestone", timeCapture: "N/A",
    jobs: ["Data Scientist"],
    shifts: 0, workerId: "p-8a11…cc02",
    email: "mira.wijaya@workforceglobal.io", phone: "+65 8555 0102", dob: "May 04, 1992",
    region: "SG - Singapore", securityId: "—", externalId: "SOW-PRO-2025-014",
    cadence: "Milestone", rateAmount: 215000, rateCurrency: "USD",
    engagementRef: "SOW-PRO-2025-014", engagementName: "Workforce analytics platform",
    contractStart: "2025-02-01", contractEnd: "2026-12-31", renewalDate: "2026-12-31",
    hiringManager: "Amy Hennen", _professionalRow: true,
  },
  { id: "w-pro-nh",  name: "Noor Hassan",       pool: "Agency",  supplier: "sw", supplierType: "Agency", status: "Compliant",
    engagementType: "Statement of Work", billingBasis: "Milestone", timeCapture: "Time Tracking",
    jobs: ["Marketing Manager"],
    shifts: 0, workerId: "p-3320…aa11",
    email: "noor.hassan@staffwise.io", phone: "+971 50 555 0122", dob: "Oct 11, 1990",
    region: "AE - Dubai", securityId: "—", externalId: "SOW-PRO-2026-009",
    cadence: "Milestone", rateAmount: 142000, rateCurrency: "USD",
    engagementRef: "SOW-PRO-2026-009", engagementName: "Brand refresh · Q2 launch",
    contractStart: "2026-02-01", contractEnd: "2026-08-31", renewalDate: "2026-08-31",
    hiringManager: "Amy Hennen", _professionalRow: true,
  },
];
// ---------- Temp-spend tier scaling -------------------------------------
// Inflate the worker roster (with synthetic names cycling through the
// base list's pools and suppliers) at high tiers and shrink at low tiers
// — preserving the IDs referenced by TIMESHEETS / activity / approvals.
// Synthetic names are picked deterministically from a small pool so the
// table still scans as real people rather than auto-generated noise.
const _SYN_FIRST = [
  "Alex","Jordan","Riley","Sam","Casey","Morgan","Quinn","Rowan","Sage","Avery",
  "Drew","Emery","Hayden","Jamie","Lane","Logan","Parker","Reese","Skylar","Taylor",
  "Devin","Elliot","Finley","Harper","Jules","Kai","Micah","Noa","Phoenix","Remy",
  "River","Robin","Shay","Tatum","Wren","Adrian","Bryce","Camden","Dakota","Eden",
];
const _SYN_LAST = [
  "Adler","Bishop","Castro","Doyle","Ellsworth","Faulkner","Greer","Hadley","Iversen","Jansen",
  "Kovac","Larsen","Mahmoud","Navarro","Okafor","Pavlov","Quintero","Rivera","Sato","Thakur",
  "Underwood","Vance","Whitcomb","Xu","Yates","Zheng","Almeida","Bjorn","Caruso","Delarosa",
];
function _synName(seed) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  const f = _SYN_FIRST[Math.abs(h) % _SYN_FIRST.length];
  h = ((h * 1103515245) + 12345) | 0;
  const l = _SYN_LAST[Math.abs(h) % _SYN_LAST.length];
  return `${f} ${l}`;
}
const WORKERS_RAW = (window.inflateList || ((b) => b.slice()))(WORKERS_RAW_BASE, {
  preserveIds: ["w-ml","w-jc","w-pr","w-tk","w-ss","w-cc","w-mh","w-ja","w-ks","w-jg","w-mw","w-aw","w-bb","w-dh"],
  minRows: 6,
  maxRows: 240,
  makeClone: (src, n) => {
    const newId = `w-${src.id.slice(2)}-c${n}`;
    const nm = _synName(`${src.id}#${n}`);
    return { id: newId, name: nm };
  },
});

// Pool labels + chip palette. Drives tabs, filter chips, and the per-row
// "Pool" cell so the same colour story carries across the page.
const POOL_META = {
  "Agency":    { label: "Agency",    bg: "var(--evr-surface-decorative-default-blue)",   fg: "var(--evr-content-decorative-blue)",   icon: "Building" },
  "Internal":  { label: "Internal",  bg: "var(--evr-surface-decorative-default-green)",  fg: "var(--evr-content-decorative-green)",  icon: "PersonAuthorize" },
  "Float":     { label: "Float",     bg: "var(--evr-surface-decorative-default-teal)",   fg: "var(--evr-content-decorative-teal)",   icon: "Refresh" },
  "Per-diem":  { label: "Per-diem",  bg: "var(--evr-surface-decorative-default-purple)", fg: "var(--evr-content-decorative-purple)", icon: "PersonClock" },
  "Alumni":    { label: "Alumni",    bg: "var(--evr-surface-decorative-default-orange)", fg: "var(--evr-content-decorative-orange)", icon: "TimeUndo" },
  // Contractor pool — direct 1099 / international contractors with an
  // MSA + SOW relationship (no supplier). Always present as a worker
  // type; the contractor records themselves are still feature-flagged.
  "Contractor": { label: "Contractor", bg: "var(--evr-surface-decorative-default-purple)", fg: "var(--evr-content-decorative-purple)", icon: "PersonAuthorize" },
  // EOR pool — workers legally employed by an Employer-of-Record
  // provider in their country, billed back to us. The buyer never sees
  // the EOR's internal payroll; they only see the worker + the EOR fee.
  "EOR":        { label: "EOR",        bg: "var(--evr-surface-decorative-default-yellow)", fg: "var(--evr-content-decorative-yellow)", icon: "Globe" },
  // Professional pool — only surfaces in the UI when the
  // `professionalWork` feature flag is on. Adds permanent SOW
  // engagements (no schedule, no hourly rate, invoice-only billing)
  // on top of the Frontline (Agency / shift-based) workforce that ships
  // by default.
  "Professional": { label: "Professional", bg: "var(--evr-surface-decorative-default-blue)", fg: "var(--evr-content-decorative-blue)", icon: "Briefcase" },
  // SOW Resources pool — only surfaces in the UI when the `sow`
  // feature flag is on. Supplier-managed people executing under an
  // active SOW. Roster-level visibility only — no schedule, no
  // timesheet, no rate, because billing is event-based, not
  // hours-based. Layered additively on top of every other pool.
  "SOW Resources": { label: "SOW Resources", bg: "var(--evr-surface-decorative-default-teal)", fg: "var(--evr-content-decorative-teal)", icon: "Notes" },
};
// Worker-type axis — tabs are supplier types (Agency / Independent
// contractor / EOR), with an "All" tab prepended so the user can see
// the full workforce roster as the default landing view.
const POOL_ORDER = ["All", "Agency", "Float", "Contractor", "EOR"];
// Tab labels — the Contractor pool surfaces as "Independent contractor"
// on the tab strip because that's the supplier-type label the rest of
// the product (Suppliers, Invoices, intake) uses.
const POOL_TAB_LABEL = { All: "All", Agency: "Agency", Float: "Float", Contractor: "Independent contractor", EOR: "EOR" };
// Filter to the active industry (workers w/o `industries` show everywhere),
// then localize job titles via the active industry's localize map.
const _wfCurrentIndustry = (window.getCurrentIndustryId && window.getCurrentIndustryId()) || "manufacturing";
const _wfFiltered = WORKERS_RAW.filter((w) => !w.industries || w.industries.includes(_wfCurrentIndustry));
// When the active tenant is a staffing agency, narrow the roster to ONLY
// workers placed by this agency (matched by supplier id). Enterprise
// tenants see the full mixed roster.
const _wfAgencySupplier = (window.getAgencySupplierId && window.getAgencySupplierId()) || null;
const _wfAgencyScoped = _wfAgencySupplier
  ? _wfFiltered.filter((w) => w.supplier === _wfAgencySupplier)
  : _wfFiltered;
// Drop the professional-engagement examples when the org hasn't turned
// the Professional jobs category on in Settings → Configuration → Jobs.
// `_professionalRow` is a stable marker on the seed rows so the gate
// stays a single localStorage read instead of a per-row job lookup.
const _wfProOn = (typeof window !== "undefined"
  && typeof window.professionalJobsEnabled === "function"
  && window.professionalJobsEnabled());
const _wfProScoped = _wfProOn
  ? _wfAgencyScoped
  : _wfAgencyScoped.filter((w) => !w._professionalRow);
const WORKERS = (window.localizeAll || ((r) => r))(_wfProScoped, ["jobs"]);

// ---------- Supplier-type roster injection -----------------------------
// When the org has Independent Contractor or EOR turned on in
// Settings → Configuration → Supplier types, merge those workers into
// the canonical WORKERS array at module load so every cross-cutting
// surface (Schedule, Timesheets, Invoices, Workforce) can find them by
// id. Each list still re-filters at render time via useFeatureFlag so
// flipping a supplier type off makes the rows vanish without a reload.
//
// • Contractor (IC) workers come from contractors.jsx
//   (window.CONTRACTOR_WORKERS_RAW). They carry their own LLC name,
//   country flag, and tax form on the worker record.
// • EOR workers already live in WORKERS_RAW_BASE above (gated below);
//   they carry an EOR provider in the `supplier` field plus a country
//   flag, so the existing supplier-chip rendering resolves the brand.
(function _wfMergeSupplierTypeWorkers() {
  if (_wfAgencySupplier) return; // staffing-agency tenants see only their own roster
  const eorOn = (window.getFeatureFlag && window.getFeatureFlag("eor"));
  const icOn  = (window.getFeatureFlag && (
    window.getFeatureFlag("contractors") ||
    window.getFeatureFlag("independentContractor")
  ));
  // Gate EOR workers — when the flag is off, scrub them from WORKERS.
  if (!eorOn) {
    for (let i = WORKERS.length - 1; i >= 0; i--) {
      if (WORKERS[i].pool === "EOR") WORKERS.splice(i, 1);
    }
  }
  // Inject contractor workers into the global list only when the IC
  // supplier type is enabled for this org. Loading them globally (vs.
  // inside WorkforcePage as before) lets every cross-cutting surface
  // — Schedule, Timesheets, Invoices — find them by id and render the
  // contextual treatment (LLC name, country flag).
  if (icOn && window.CONTRACTOR_WORKERS_RAW && Array.isArray(window.CONTRACTOR_WORKERS_RAW)) {
    const seen = new Set(WORKERS.map((w) => w.id));
    for (const c of window.CONTRACTOR_WORKERS_RAW) {
      if (!seen.has(c.id)) WORKERS.push(c);
    }
  }
})();

const WF_PAGE_SIZE = 10;

// ---------- Status pill --------------------------------------------------
const WF_STATUS_HUES = {
  "Compliant":   "success",
  "Onboarding":  "informative",
  "Offboarding": "warning",
  "Expired":     "warning",
  "Inactive":    "neutral",
  "Terminated":  "error",
};

function WorkerStatusPill({ status }) {
  const hue = WF_STATUS_HUES[status] || "default";
  return <span className={`req-pill req-pill--${hue}`}>{status}</span>;
}

// ---------- Worker avatar (initials in coloured circle) -----------------
function WorkerAvatar({ w, size = 32, neutral = false }) {
  const p = paletteFor(w.id);
  // Match Everest avatar scale: ~36% of bubble diameter.
  const fontSize = Math.max(9, Math.round(size * 0.36));
  const style = neutral
    ? {
        background: "var(--evr-neutral-95)",
        color: "var(--evr-content-primary-highemp)",
        width: size, height: size, fontSize,
      }
    : { background: p.bg, color: p.fg, width: size, height: size, fontSize };
  return (
    <span
      className="sup-avatar"
      style={style}
      aria-label={w.name}
    >
      {initialsFor(w.name)}
    </span>
  );
}

// ---------- Toolbar (search + actions) ---------------------------------
function WorkforceToolbar({ query, onQuery }) {
  return (
    <div className="inv-toolbar">
      <div className="inv-search">
        <span className="inv-search-icon" aria-hidden="true">
          <Icon name="Search" size={24} />
        </span>
        <input
          type="search"
          className="inv-search-input"
          placeholder="Search for worker, supplier, job"
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          aria-label="Search workers"
        />
      </div>
      <div className="inv-toolbar-actions">
        <ListToolbarActions kind="workers" columns={["Worker", "Supplier", "Supplier type", "Job assignments", "Engagement type", "Shifts"]} />
      </div>
    </div>
  );
}

// ---------- Pool badge --------------------------------------------------
// Small chip rendered when a worker isn't sourced from an external
// supplier (Internal / Float / Per-diem / Alumni). Uses Everest
// decorative-surface tokens so each pool has a recognisable hue.
function WfPoolBadge({ pool, size = 28 }) {
  const meta = POOL_META[pool] || POOL_META["Agency"];
  return (
    <span
      className="sup-chip"
      style={{
        width: size, height: size, fontSize: size <= 22 ? 9 : 10,
        background: meta.bg, color: meta.fg,
        letterSpacing: ".02em",
      }}
      aria-label={meta.label}
      title={meta.label}
    >
      <Icon name={meta.icon} size={Math.round(size * 0.55)} />
    </span>
  );
}

// "Source" cell — supplier identity for agency workers, em dash for
// every other pool (their pool is shown in the next column).
function WfSourceCell({ row }) {
  if (row.pool === "Agency" && row.supplier) {
    const sup = REQ_SUPPLIERS[row.supplier] || REQ_SUPPLIERS.sw;
    return (
      <React.Fragment>
        <ReqSupplierChip id={row.supplier} size={28} />
        <span className="wf-row-supname">{sup.label}</span>
      </React.Fragment>
    );
  }
  if (row.pool === "EOR" && row.supplier) {
    // EOR workers: the "supplier" is the EOR provider that issues the
    // local employment contract. Same chip + label pattern as Agency,
    // with the country flag appended so the row reads as
    // "Provider · Country".
    const sup = REQ_SUPPLIERS[row.supplier] || REQ_SUPPLIERS.sw;
    return (
      <React.Fragment>
        <ReqSupplierChip id={row.supplier} size={28} />
        <span className="wf-row-supname">
          {sup.label}
          {row.countryName ? (
            <React.Fragment>
              <span style={{ color: "var(--evr-content-primary-lowemp)" }}> · </span>
              {row.flag && <span className={`fi fi-${row.flag}`} aria-hidden="true" style={{ display: "inline-block", width: 16, height: 12, borderRadius: 2, marginRight: 4, verticalAlign: "-1px" }}></span>}
              {row.countryName}
            </React.Fragment>
          ) : null}
        </span>
      </React.Fragment>
    );
  }
  if (row.pool === "Contractor" && row.flag) {
    return (
      <React.Fragment>
        <span className={`fi fi-${row.flag}`} aria-hidden="true" style={{ width: 22, height: 16, borderRadius: 2 }}></span>
        <span className="wf-row-supname">Direct · {row.countryName}</span>
      </React.Fragment>
    );
  }
  if (row.pool === "Float") {
    // Float pool workers are buyer-employed. Their "supplier" is the
    // organization itself \u2014 the buyer is the legal employer. List
    // view stays terse: org chip + name. The Dayforce-core sync tie is
    // surfaced on the worker detail page (hero + System-of-record
    // section in the Details accordion), not on every list row.
    const ind = (window.getIndustry && window.getIndustry()) || null;
    const orgName = (ind && ind.name) || "Organization";
    const orgInitials = orgName.split(/\s+/).slice(0, 2).map((p) => p[0]).join("").toUpperCase();
    return (
      <React.Fragment>
        <span
          className="wf-df-org-chip"
          aria-hidden="true"
          title={orgName}
          style={ind && ind.accent ? { background: ind.accent } : undefined}
        >
          {orgInitials}
        </span>
        <span className="wf-row-supname">{orgName}</span>
      </React.Fragment>
    );
  }
  if (row.pool === "Professional") {
    // Professional workers can be either supplier-sourced (SOW signed
    // with an agency that places senior talent) or direct. Show the
    // supplier chip + label when one is present, otherwise the country.
    if (row.supplier) {
      const sup = REQ_SUPPLIERS[row.supplier] || REQ_SUPPLIERS.sw;
      return (
        <React.Fragment>
          <ReqSupplierChip id={row.supplier} size={28} />
          <span className="wf-row-supname">{sup.label} · SOW</span>
        </React.Fragment>
      );
    }
    if (row.flag) {
      return (
        <React.Fragment>
          <span className={`fi fi-${row.flag}`} aria-hidden="true" style={{ width: 22, height: 16, borderRadius: 2 }}></span>
          <span className="wf-row-supname">Direct · {row.countryName}</span>
        </React.Fragment>
      );
    }
  }
  if (row.pool === "SOW Resources") {
    // SOW Resources are always supplier-sourced — the supplier staffs
    // the SOW. Surface the SOW id alongside the supplier so the row
    // reads as "which supplier · which SOW".
    if (row.supplier) {
      const sup = REQ_SUPPLIERS[row.supplier] || REQ_SUPPLIERS.sw;
      return (
        <React.Fragment>
          <ReqSupplierChip id={row.supplier} size={28} />
          <span className="wf-row-supname">{sup.label} · <span className="tabular">{row.sowId || "SOW"}</span></span>
        </React.Fragment>
      );
    }
  }
  return (
    <span className="wf-row-supname" style={{ color: "var(--evr-content-primary-lowemp)" }}>—</span>
  );
}

// "Pool" cell — colored badge + pool label. Always present so the column
// reads consistently across rows.
function WfPoolCell({ row }) {
  const meta = POOL_META[row.pool] || POOL_META.Agency;
  return (
    <React.Fragment>
      <WfPoolBadge pool={row.pool} size={24} />
      <span className="wf-row-supname" style={{ color: meta.fg, fontWeight: "var(--evr-fw-demibold)" }}>
        {meta.label}
      </span>
    </React.Fragment>
  );
}

// Format a money figure for the row's compact "Shifts" cell. Falls
// back to plain "{ccy} {amt}" when Intl is missing.
function _wfFmtRate(amt, ccy) {
  if (typeof amt !== "number") return "—";
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: ccy || "USD",
      maximumFractionDigits: amt >= 100 ? 0 : 2,
    }).format(amt);
  } catch (e) { return `${ccy || "USD"} ${amt}`; }
}

// ---------- Row ---------------------------------------------------------
function WorkerRow({ row, checked, onToggle, onOpen, vc }) {
  // Combine the per-user column visibility (showCol) with the feature-flag
  // gate set by the parent (vc.colGate). Without the gate, optional columns
  // not present in the manifest (e.g. Cadence/Rate when Professional jobs
  // is off) would render with no matching grid track and wrap onto a 2nd
  // row. Non-gated ids (worker, supplier, …) fall through to showCol.
  const show = (id) => {
    if (!vc) return true;
    if (vc.colGate && id in vc.colGate && !vc.colGate[id]) return false;
    return vc.showCol(id);
  };
  const visibleJobs = row.jobs.slice(0, 2);
  const extraJobs = row.jobs.length - visibleJobs.length;
  const rowMenu = (e) => {
    e.stopPropagation();
    openMenu(e.currentTarget, [
      { icon: "View",      label: "View worker",        onClick: () => onOpen && onOpen(row.id) },
      { icon: "Calendar",  label: "View schedule",      onClick: () => onOpen && onOpen(row.id) },
      { icon: "PersonClock", label: "Open timesheets",  onClick: () => showToast(`Timesheets for ${row.name}`) },
      { divider: true },
      { icon: "Lock",      label: "Block from sites", onClick: () => showToast(`Block sites for ${row.name}`) },
      // Direct-sourced Pro + Frontline workers offboard through the
      // RemoveWorkerPanel's engagement / worker scope. Agency-sourced
      // workers (whose engagement is owned by the supplier) keep the
      // shift-only "Remove from booking" label.
      (row._professionalRow || row.engagementType)
        ? { icon: "PersonClock", label: "Offboard worker", danger: true,
            onClick: () => window.openRemoveWorker && window.openRemoveWorker(window.buildRemoveWorkerCtx({ worker: row, bookingId: row.workerId || row.id, defaultScope: "engagement" })) }
        : (row.pool && row.pool !== "Agency" && row.pool !== "EOR" && row.pool !== "Contractor")
          ? { icon: "PersonClock", label: "Offboard worker", danger: true,
              onClick: () => window.openRemoveWorker && window.openRemoveWorker(window.buildRemoveWorkerCtx({ worker: row, bookingId: row.workerId || row.id, defaultScope: "worker" })) }
          : { icon: "Cancel",    label: "Remove worker", danger: true,
              onClick: () => openConfirm({
                title: `Remove ${row.name}?`,
                body: `${row.name} will no longer be available for shifts.`,
                primaryLabel: "Remove",
                onConfirm: () => showToast(`${row.name} removed`, { kind: "success" }),
              }) },
    ]);
  };
  return (
    <div
      className="req-row wf-row req-row--clickable"
      role="row"
      tabIndex={0}
      style={vc && vc.gridStyle}
      onClick={(e) => {
        if (e.target.closest("input,a,button")) return;
        onOpen && onOpen(row.id);
      }}
      onKeyDown={(e) => { if (e.key === "Enter") onOpen && onOpen(row.id); }}
    >
      <div className="req-cell req-cell--check" role="cell">
        <input
          type="checkbox"
          checked={checked}
          onChange={onToggle}
          aria-label={`Select ${row.name}`}
        />
      </div>
      {show("worker") && (
        <div className="req-cell wf-cell--worker" role="cell">
          <WorkerAvatar w={row} size={32} neutral />
          <span className="wf-row-name">{row.name}</span>
        </div>
      )}
      {show("supplier") && (
        <div className="req-cell wf-cell--supplier" role="cell">
          <WfSourceCell row={row} />
        </div>
      )}
      {show("jobs") && (
        <div className="req-cell wf-cell--jobs" role="cell">
          {visibleJobs.map((j, i) => <span className="req-chip" key={i}>{j}</span>)}
          {extraJobs > 0 && <span className="req-chip req-chip--soft">{extraJobs} more</span>}
        </div>
      )}
      {show("engagementType") && (
        <div className="req-cell req-cell--engtype" role="cell">
          {window.EngagementType
            ? <window.EngagementType.EngagementTypeCell row={row} id={row.workerId || row.id} />
            : null}
        </div>
      )}
      {show("billingBasis") && (
        <div className="req-cell req-cell--v77em" role="cell">
          {window.V77Cols ? <span className="v77-bm">{window.V77Cols.billingBasisOf(row, row.workerId || row.id)}</span> : null}
        </div>
      )}
      {show("timeCapture") && (
        <div className="req-cell req-cell--v77tc" role="cell">
          {window.V77Cols ? <span className="v77-tc">{window.V77Cols.timeCaptureOf(row, row.workerId || row.id)}</span> : null}
        </div>
      )}
      {show("supplierTypes") && (
        <div className="req-cell req-cell--v77st" role="cell">
          {window.V77Cols ? window.V77Cols.supplierTypesOf(row, row.workerId || row.id).map((t) => (
            <span className="v77-st" key={t}>{t}</span>
          )) : null}
        </div>
      )}
      {show("shifts") && (
        <div className="req-cell wf-cell--shifts" role="cell">
          <span className="tabular">{row.shifts ? row.shifts : ""}</span>
        </div>
      )}
      {show("cadence") && (
        <div className="req-cell wf-cell--cadence" role="cell">
          <span className="tabular">{row.cadence || ""}</span>
        </div>
      )}
      {show("rate") && (
        <div className="req-cell wf-cell--rate" role="cell">
          <span className="tabular">
            {typeof row.rateAmount === "number" ? _wfFmtRate(row.rateAmount, row.rateCurrency) : ""}
          </span>
        </div>
      )}
      <div className="req-cell wf-cell--actions" role="cell">
        <button
          type="button"
          className="iconbtn"
          aria-label={`More actions for ${row.name}`}
          onClick={rowMenu}
        >
          <Icon name="MoreVert" size={18} />
        </button>
      </div>
    </div>
  );
}

// ---------- Header cell --------------------------------------------------
function WfHeaderCell({ children, className = "", align = "left", title }) {
  return (
    <div
      className={`req-cell ${className}`}
      role="columnheader"
      style={align === "right" ? { justifyContent: "flex-end" } : undefined}
    >
      <span title={title || undefined}>{children}</span>
      <span className="req-sort" aria-hidden="true" title="Sort">
        <Icon name="ArrowsUpDownSmall" size={14} />
      </span>
    </div>
  );
}

// ---------- Table --------------------------------------------------------
function WorkforceTable({ rows, total, page, totalPages, onPageChange, pageSize, onPageSizeChange, onOpenRow, f }) {
  const [selected, setSelected] = useStateWf(() => new Set());
  const allChecked = rows.length > 0 && rows.every((r) => selected.has(r.id));
  // Professional jobs gate — when the org has the Professional jobs
  // category on (Settings → Configuration → Jobs), the Workforce list
  // surfaces two extra columns alongside the existing Shifts column:
  // a cadence cell (Monthly / Weekly / Hourly / Milestone) and a rate
  // cell. Both are off-by-default in the view customizer when the
  // gate is off, and appear in the customizer Visible Columns list
  // when the gate is on so admins can opt-in / opt-out per user.
  const proOn = window.useProfessionalJobsActive
    ? window.useProfessionalJobsActive()
    : (window.professionalJobsEnabled && window.professionalJobsEnabled());
  // Toggle body.wf-pro-cols-on so the styles-workforce.css grid-track
  // rules expand to include the Cadence + Rate columns. Mirrors the
  // pattern V77Cols.useBodyClass / EngagementType.useBodyClass use for
  // their respective columns.
  React.useEffect(() => {
    const cls = "wf-pro-cols-on";
    if (proOn) document.body.classList.add(cls);
    else       document.body.classList.remove(cls);
    return () => document.body.classList.remove(cls);
  }, [proOn]);
  // v0.77 native + engagement type — filter chip options. Computed here
  // (not on the parent page) because the FilterChip refs sit inside
  // this component's render. Hidden chips below resolve to empty arrays
  // when their respective modules are off, so the toolbar stays calm.
  const v77On = window.V77Cols && window.V77Cols.isOn();
  const bbOpts = v77On ? window.V77Cols.billingBasisOpts() : [];
  const tcOpts = v77On ? window.V77Cols.timeCaptureOpts()  : [];
  const stOpts = v77On ? window.V77Cols.supplierTypeOpts() : [];
  const etOn   = window.EngagementType && window.EngagementType.isOn();
  const etOpts = etOn ? window.EngagementType.enabledTypes() : [];

  const toggle = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const toggleAll = () => {
    setSelected((prev) => {
      if (allChecked) {
        const next = new Set(prev);
        rows.forEach((r) => next.delete(r.id));
        return next;
      }
      const next = new Set(prev);
      rows.forEach((r) => next.add(r.id));
      return next;
    });
  };

  // -- Bulk actions unique to Workforce -------------------------------
  // The workforce list mixes agency workers, frontline employees, and
  // talent-pool members. Operations leads typically batch: message a
  // cohort about a shift, add high-performers to a private pool, push
  // a credential refresh, or block a problem worker. Block is the only
  // destructive action — gated behind danger styling.
  const bulkActWf = (msg, kind = "success") => {
    if (window.showToast) window.showToast(msg, { kind });
    setSelected(new Set());
  };
  const nWf = selected.size;
  const sumWf = `${nWf} ${nWf === 1 ? "worker" : "workers"}`;
  const bulkActionsWf = [
    { icon: "Send",         label: "Message",       onClick: () => bulkActWf(`Message sent to ${sumWf}`) },
    { icon: "PersonPlus",   label: "Add to pool",   onClick: () => bulkActWf(`Added ${sumWf} to talent pool`) },
    { icon: "ClipboardCircleCheck", label: "Request credentials", onClick: () => bulkActWf(`Credential refresh requested from ${sumWf}`, "info") },
    { icon: "Bag",          label: "Assign training", onClick: () => bulkActWf(`Training assigned to ${sumWf}`) },
    { icon: "FileDownload", label: "Export",        onClick: () => bulkActWf(`Exported ${sumWf} to CSV`) },
    { divider: true },
    { icon: "PersonUnauthorize", label: "Block from work assignments", onClick: () => bulkActWf(`Blocked ${sumWf} from new work assignments`, "warning"), kind: "danger" },
  ];
  const bulkOverflowWf = [
    { icon: "Pin",       label: "Pin to top",         onClick: () => bulkActWf(`Pinned ${sumWf} to the top of the list`) },
    { icon: "PersonArrow", label: "Move to supplier",  onClick: () => bulkActWf(`Move-to-supplier wizard opened for ${sumWf}`, "info") },
    { icon: "Notes",     label: "Add HR note",         onClick: () => bulkActWf(`HR note added to ${sumWf}`) },
  ];

  // ---- View customizer ------------------------------------------------
  const wfVcManifest = React.useMemo(() => {
    const columns = [
      { id: "worker",       label: "Worker",          width: "minmax(220px, 1.3fr)" },
      { id: "supplier",     label: "Supplier",        width: "minmax(180px, 1fr)" },
      { id: "jobs",         label: "Job assignments", width: "minmax(260px, 2.4fr)" },
    ];
    if (etOn && etOpts.length > 1) columns.push({ id: "engagementType", label: "Engagement type", width: "140px" });
    if (v77On) {
      columns.push({ id: "billingBasis",  label: "Billing basis",  width: "140px" });
      columns.push({ id: "timeCapture",   label: "Time capture",   width: "140px" });
      columns.push({ id: "supplierTypes", label: "Supplier types", width: "180px" });
    }
    columns.push({ id: "shifts", label: "Shifts", width: "72px" });
    if (proOn) {
      columns.push({ id: "cadence", label: "Cadence", width: "120px" });
      columns.push({ id: "rate",    label: "Rate",    width: "140px" });
    }
    const filters = [
      { id: "status",   label: "Credential status" },
      { id: "supplier", label: "Supplier" },
      { id: "job",      label: "Job" },
    ];
    if (etOn && etOpts.length > 1) filters.push({ id: "engagementType", label: "Engagement type" });
    if (bbOpts.length > 1) filters.push({ id: "billingBasis",  label: "Billing basis" });
    if (tcOpts.length > 1) filters.push({ id: "timeCapture",   label: "Time capture" });
    if (stOpts.length > 1) filters.push({ id: "supplierTypes", label: "Supplier types" });
    if (proOn) {
      filters.push({ id: "cadence", label: "Cadence" });
      filters.push({ id: "rate",    label: "Rate" });
    }
    return { columns, filters };
  }, [v77On, etOn, etOpts.length, bbOpts.length, tcOpts.length, stOpts.length, proOn]);
  const vc = useViewCustomizer("workforce", wfVcManifest);
  const wfGridStyle = vc.gridStyle
    ? { gridTemplateColumns: `44px ${vc.gridStyle.gridTemplateColumns} 52px` }
    : undefined;
  // Feature-flag gate for the optional columns. The grid track count
  // (styles-workforce.css / styles-engagement-type.css / styles-v77-native-cols.css)
  // only widens to include these columns when the matching body class is
  // on — which mirrors these same flags. showCol() alone returns true for
  // any column the user hasn't explicitly hidden, including ones that
  // aren't in the manifest at all (e.g. Cadence/Rate when Professional
  // jobs is off), so without this gate those cells render with no grid
  // track and spill onto a second row. Keys map column id → enabled.
  const wfColGate = {
    engagementType: etOn && etOpts.length > 1,
    billingBasis:   v77On,
    timeCapture:    v77On,
    supplierTypes:  v77On,
    cadence:        proOn,
    rate:           proOn,
  };
  const showColWf = (id) =>
    (wfColGate[id] === undefined ? true : wfColGate[id]) && vc.showCol(id);
  const vcRow = { ...vc, gridStyle: wfGridStyle, colGate: wfColGate };

  return (
    <React.Fragment>
    <div className="req-table-card wf-table-card" role="table" aria-label="Workforce">
      <div className="req-filters">
        <div className="req-filters-left">
          {vc.showFilter("status")   && <FilterChip label="Credential status"   active={f.filters.status.length > 0}   count={f.filters.status.length}   onClick={f.openFor("status",   "Credential status",   ["Compliant", "Onboarding", "Expired"])} title="Reads from Dayforce Credentialing — formerly &lsquo;Status&rsquo; in Flex Work" />}
          {vc.showFilter("supplier") && <FilterChip label="Supplier" active={f.filters.supplier.length > 0} count={f.filters.supplier.length} onClick={f.openFor("supplier", "Supplier", Object.values(REQ_SUPPLIERS).map((s) => s.label).sort())} />}
          {vc.showFilter("job")      && <FilterChip label="Job"      active={f.filters.job.length > 0}      count={f.filters.job.length}      onClick={f.openFor("job",      "Job",      Array.from(new Set(WORKERS.flatMap((w) => w.jobs))).sort())} />}
          {vc.showFilter("engagementType") && etOn && etOpts.length > 1 && (
            <FilterChip
              label="Engagement type"
              active={f.filters.engagementType.length > 0}
              count={f.filters.engagementType.length}
              onClick={f.openFor("engagementType", "Engagement type", etOpts)}
            />
          )}
          {vc.showFilter("billingBasis") && bbOpts.length > 1 && (
            <FilterChip
              label="Billing basis"
              active={f.filters.billingBasis.length > 0}
              count={f.filters.billingBasis.length}
              onClick={f.openFor("billingBasis", "Billing basis", bbOpts)}
            />
          )}
          {vc.showFilter("timeCapture") && tcOpts.length > 1 && (
            <FilterChip
              label="Time capture"
              active={f.filters.timeCapture.length > 0}
              count={f.filters.timeCapture.length}
              onClick={f.openFor("timeCapture", "Time capture", tcOpts)}
            />
          )}
          {vc.showFilter("supplierTypes") && stOpts.length > 1 && (
            <FilterChip
              label="Supplier types"
              active={f.filters.supplierTypes.length > 0}
              count={f.filters.supplierTypes.length}
              onClick={f.openFor("supplierTypes", "Supplier types", stOpts)}
            />
          )}
        </div>
        <div className="req-filters-right">
          {f.hasAny && (
            <React.Fragment>
              <span className="req-filters-sep" aria-hidden="true">|</span>
              <button type="button" className="req-clear" onClick={f.clearAll}>Clear all filters</button>
            </React.Fragment>
          )}
        </div>
      </div>

      <div className="req-scroll">
        <div className="req-row wf-row req-row--header" role="row" style={wfGridStyle}>
          <div className="req-cell req-cell--check" role="columnheader">
            <input
              type="checkbox"
              checked={allChecked}
              onChange={toggleAll}
              aria-label="Select all rows on this page"
            />
          </div>
          {vc.showCol("worker")        && <WfHeaderCell className="wf-cell--worker">Worker</WfHeaderCell>}
          {vc.showCol("supplier")      && <WfHeaderCell className="wf-cell--supplier">Supplier</WfHeaderCell>}
          {vc.showCol("jobs")          && <WfHeaderCell className="wf-cell--jobs">Job assignments</WfHeaderCell>}
          {showColWf("engagementType")&& <div className="req-cell req-cell--engtype" role="columnheader">Engagement type</div>}
          {showColWf("billingBasis")  && <div className="req-cell req-cell--v77em" role="columnheader">Billing basis</div>}
          {showColWf("timeCapture")   && <div className="req-cell req-cell--v77tc" role="columnheader">Time capture</div>}
          {showColWf("supplierTypes") && <div className="req-cell req-cell--v77st" role="columnheader">Supplier types</div>}
          {vc.showCol("shifts")        && <WfHeaderCell className="wf-cell--shifts">Shifts</WfHeaderCell>}
          {showColWf("cadence")       && <WfHeaderCell className="wf-cell--cadence">Cadence</WfHeaderCell>}
          {showColWf("rate")          && <WfHeaderCell className="wf-cell--rate">Rate</WfHeaderCell>}
          <div className="req-cell wf-cell--actions" role="columnheader" aria-label=""></div>
        </div>

        <div className="req-body" role="rowgroup">
          {rows.map((row) => (
            <WorkerRow
              key={row.id}
              row={row}
              checked={selected.has(row.id)}
              onToggle={() => toggle(row.id)}
              onOpen={onOpenRow}
              vc={vcRow}
            />
          ))}
        </div>
      </div>

      <Pagination
        page={page}
        totalPages={totalPages}
        total={total}
        pageSize={pageSize}
        onPageSizeChange={onPageSizeChange}
        onChange={onPageChange}
      />
    </div>

    <BulkActionBar
      count={selected.size}
      noun="worker"
      onClear={() => setSelected(new Set())}
      actions={bulkActionsWf}
      overflow={bulkOverflowWf}
    />
    {vc.panel}
    </React.Fragment>
  );
}

// ---------- List page ---------------------------------------------------
function WorkforcePage({ reloadKey, onReload, onOpenRow }) {
  const [page, setPage] = useStateWf(1);
  const [pageSize, setPageSize] = useStateWf(WF_PAGE_SIZE);
  const [query, setQuery] = useStateWf("");
  // "All" is the default tab — leads with the full workforce roster.
  // Subsequent tabs slice by supplier type (Agency / Independent
  // contractor / EOR).
  const [poolTab, setPoolTab] = useStateWf("All");
  const f = useFilters({ status: [], supplier: [], job: [], billingBasis: [], timeCapture: [], supplierTypes: [], engagementType: [] });
  // v0.77 native cols — toggle body class for grid-template extension.
  if (window.V77Cols && window.V77Cols.useBodyClass) window.V77Cols.useBodyClass();
  // Engagement Type column gate — toggles body.engtype-cols-on.
  if (window.EngagementType && window.EngagementType.useBodyClass) window.EngagementType.useBodyClass();

  // Contractor (IC) and EOR pool gates — both Contractor and EOR
  // workers are now injected into the global WORKERS list at module
  // load (see workforce.jsx module-level `_wfMergeSupplierTypeWorkers`).
  // Here we filter them back out reactively so flipping the supplier
  // type off in Settings → Configuration → Supplier types makes the
  // rows vanish in place — no reload required.
  const contractorsOn = window.useFeatureFlag ? window.useFeatureFlag("contractors") : false;
  const icAxisOn      = window.useFeatureFlag ? window.useFeatureFlag("independentContractor") : false;
  const eorOn         = window.useFeatureFlag ? window.useFeatureFlag("eor") : false;
  const floatOn       = window.useFeatureFlag ? window.useFeatureFlag("float") : false;
  // Professional pool injection — only when the `professionalWork`
  // feature flag is on. Layered on top of the Frontline workforce so
  // turning it off restores the original list with zero churn.
  const professionalOn = window.useFeatureFlag ? window.useFeatureFlag("professionalWork") : false;
  // SOW Resources pool injection — only when the `sow` feature flag
  // is on. Strictly additive: layered on top of every other pool;
  // turning the flag off restores the original list with zero churn.
  const sowOn = window.useFeatureFlag ? window.useFeatureFlag("sow") : false;
  const WORKERS_LIVE = useMemoWf(
    () => {
      let list = WORKERS;
      // Filter Contractor rows out unless the legacy `contractors`
      // derivation OR the canonical Independent Contractor axis flag is
      // on. (Helios ships both axis flags on; existing orgs default to
      // Agency-only.)
      if (!contractorsOn && !icAxisOn) {
        list = list.filter((w) => w.pool !== "Contractor");
      }
      // Filter EOR rows out unless the EOR supplier type is enabled.
      if (!eorOn) {
        list = list.filter((w) => w.pool !== "EOR");
      }
      // Professional + SOW Resources are NOT merged into Workforce —
      // they live on their own dedicated surfaces (Professional Work,
      // SOW dashboard). Workforce is scoped to supplier-sourced workers
      // plus, when the Float supplier type is enabled (Mercy ships with
      // it on), the buyer's internal float pool. Other buyer-owned
      // reach-back lanes (Internal / Per-diem / Alumni) live on their
      // own surfaces and are filtered out here.
      const allowedPools = new Set(["Agency", "Contractor", "EOR"]);
      if (floatOn) allowedPools.add("Float");
      list = list.filter((w) => allowedPools.has(w.pool));
      return list;
    },
    [contractorsOn, icAxisOn, eorOn, floatOn]
  );
  const POOL_ORDER_LIVE = useMemoWf(() => {
    // Hide the Float / Contractor / EOR tabs unless the matching
    // supplier type is enabled for this org. With every flag off, the
    // strip collapses back to "All · Agency".
    return POOL_ORDER.filter((p) => {
      if (p === "Float")      return floatOn;
      if (p === "Contractor") return contractorsOn || icAxisOn;
      if (p === "EOR")        return eorOn;
      return true;
    });
  }, [contractorsOn, icAxisOn, eorOn, floatOn]);

  // Engagement-type scope · the universal type-axis primitive. Pool tabs
  // are orthogonal (sourcing channel, see scratch/type-tab-audit.md) so
  // the chip-bar lives ABOVE them and slices the list by engagement
  // type. Multi-select by default; single-select / solo via modifier or
  // double-click. Worker rows derive engagement type from their pool —
  // Professional → professional, SOW Resources → sow, Contractor →
  // contractor, every shift-based pool (Agency / Internal / Float /
  // Per-diem / Alumni) → frontline. When only Frontline is on the bar
  // collapses to a neutral "All engagements" pill (the component's
  // byte-identity-at-flags-off case); we additionally hide the bar
  // entirely when no variant flag is on so the workforce list at
  // all-flags-off remains visually identical to the v0.6 baseline.
  const _wfPoolToType = (pool) =>
    pool === "Professional"   ? "professional" :
    pool === "SOW Resources"  ? "sow"          :
    pool === "Contractor"     ? "contractor"   :
                                "frontline";
  const useScopeWf = window.useEngagementScope;
  const [engScope, engScopeHelpers] = useScopeWf ? useScopeWf() : [null, null];
  // Reset to page 1 when the scope changes so users land on the new top.
  React.useEffect(() => {
    setPage(1);
  }, [engScope && Array.from(engScope.types).sort().join("|")]);
  const wfTypeCounts = useMemoWf(() => {
    const c = { frontline: 0, professional: 0, contractor: 0, sow: 0, __total: WORKERS_LIVE.length };
    WORKERS_LIVE.forEach((w) => { c[_wfPoolToType(w.pool)] += 1; });
    return c;
  }, [WORKERS_LIVE]);

  const WF_FILTER_MATCHERS = {
    status:   (row, vals) => vals.includes(row.status),
    supplier: (row, vals) => vals.includes(REQ_SUPPLIERS[row.supplier]?.label),
    job:      (row, vals) => (row.jobs || []).some((j) => vals.includes(j)),
    // v0.78 native — Billing basis + Time capture (single per row) +
    // Supplier types (multi per row).
    billingBasis: (row, vals) =>
      !window.V77Cols || window.V77Cols.matchBillingBasis(row, vals),
    timeCapture: (row, vals) =>
      !window.V77Cols || window.V77Cols.matchTimeCapture(row, vals),
    supplierTypes: (row, vals) =>
      !window.V77Cols || window.V77Cols.matchSupplierTypes(row, vals),
    engagementType: (row, vals) =>
      !window.EngagementType || window.EngagementType.matchType(row, vals),
  };

  // Per-pool counts for the tab strip — recomputed once so re-renders
  // are cheap. Counts always reflect the unfiltered list. The "All"
  // tab counts every worker; the supplier-type tabs count their pool.
  const poolCounts = useMemoWf(() => {
    const counts = {};
    POOL_ORDER_LIVE.forEach((p) => {
      counts[p] = p === "All" ? WORKERS_LIVE.length : WORKERS_LIVE.filter((w) => w.pool === p).length;
    });
    return counts;
  }, [WORKERS_LIVE, POOL_ORDER_LIVE]);

  const filtered = useMemoWf(() => {
    let list = WORKERS_LIVE;
    if (engScope && !engScope.isAllOn) {
      list = list.filter((w) => engScope.types.has(_wfPoolToType(w.pool)));
    }
    if (poolTab !== "All") {
      list = list.filter((w) => w.pool === poolTab);
    }
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      list = list.filter((r) =>
        r.name.toLowerCase().includes(q) ||
        (r.supplier && (REQ_SUPPLIERS[r.supplier]?.label || "").toLowerCase().includes(q)) ||
        (r.pool && r.pool.toLowerCase().includes(q)) ||
        r.jobs.some((j) => j.toLowerCase().includes(q))
      );
    }
    return applyFilters(list, f.filters, WF_FILTER_MATCHERS);
  }, [query, poolTab, f.filters, engScope && Array.from(engScope.types).sort().join("|")]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const rows = useMemoWf(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [page, pageSize, filtered]);

  const handlePageSizeChange = (n) => { setPageSize(n); setPage(1); };
  const handleQuery = (v) => { setQuery(v); setPage(1); };
  const handlePoolTab = (t) => { setPoolTab(t); setPage(1); };

  // Reset to page 1 when filter chips change so users see the new top.
  React.useEffect(() => { setPage(1); }, [f.filters]);

  // Agency bench onboarding (moved into the omnibar overflow menu).
  const _wfIsAgency = !!(window.isAgencyOrg && window.isAgencyOrg()) && window.flexViewAsRole === "agency";
  const [benchOnboard, setBenchOnboard] = useStateWf(false);
  const [, setBenchTick] = useStateWf(0);

  return (
    <React.Fragment>
      <Omnibar
        icon="Employees"
        title="Workforce"
        dayforce={{
          primitive: "Employee",
          subtitle: "+ workerType / sourcingChannel",
          product: "People",
          strategy: "Extend",
          note: "Agency workers ride on the existing Employee table with new workerType + sourcingChannel fields — no parallel person table. ContingentEngagement sub-record holds supplier-side fields.",
          anchor: "people",
        }}
      >
        <button
          type="button"
          className="iconbtn"
          onClick={onReload}
          aria-label="Reload content"
          title="Reload"
        >
          <Icon name="Refresh" size={18} />
        </button>
        {contractorsOn && (
          <button
            type="button"
            className="btn btn--md btn--primary"
            onClick={() => window.openAddContractor && window.openAddContractor()}
          >
            <Icon name="PersonPlus" size={16} />Add worker
          </button>
        )}
        <button
          type="button"
          className="iconbtn"
          aria-label="More actions"
          onClick={(e) => openMenu(e.currentTarget, [
            ...(_wfIsAgency ? [{ icon: "PersonPlus", label: "Onboard workers", onClick: () => setBenchOnboard(true) }] : []),
            ...toolbarMenuItems(),
          ])}
        >
          <Icon name="MoreVert" size={20} />
        </button>
      </Omnibar>

      <div className="content-section inv-content" key={reloadKey}>
        {/* Worker-type tabs — Everest design-system Tabs group (48h, 4px
            bottom indicator, bold-active 16px). "All" leads, followed
            by one tab per supplier type (Agency · Independent contractor
            · EOR). Professional and SOW Resources live on their own
            dedicated surfaces and are intentionally absent from
            Workforce. */}
        <StatusTabs
          variant="everest"
          ariaLabel="Filter by supplier type"
          active={poolTab}
          onChange={handlePoolTab}
          tabs={POOL_ORDER_LIVE.map((p) => ({ id: p, label: POOL_TAB_LABEL[p] || POOL_META[p]?.label || p }))}
          counts={poolCounts}
          showCounts={false}
        />
        {window.WfBenchStats && <WfBenchStats />}
        <WorkforceToolbar query={query} onQuery={handleQuery} />
        <WorkforceTable
          rows={rows}
          total={filtered.length}
          page={page}
          totalPages={totalPages}
          pageSize={pageSize}
          onPageSizeChange={handlePageSizeChange}
          onPageChange={setPage}
          onOpenRow={onOpenRow}
          f={f}
        />
      </div>
      {benchOnboard && <WfBenchOnboardModal onClose={() => setBenchOnboard(false)} onAdded={() => setBenchTick((n) => n + 1)} />}
    </React.Fragment>
  );
}

// ==========================================================================
// Worker Details
// ==========================================================================

function WfAccordionCard({ icon, title, subtitle, defaultOpen = false, action, children }) {
  // Collapsed by default everywhere — `defaultOpen` kept for API compat
  // but ignored so all accordion sections start closed. Also backs the
  // SOW, Professional, Contractor and Worker-tenure detail accordions.
  const [open, setOpen] = useStateWf(false);
  const id = React.useId();
  return (
    <section className="acc-card">
      <button
        type="button"
        className="acc-card-head wf-acc-head"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="acc-card-avatar" aria-hidden="true">
          <Icon name={icon} size={20} />
        </span>
        <span className="wf-acc-title-stack">
          <span className="acc-card-title">{title}</span>
          {subtitle && <span className="wf-acc-sub">{subtitle}</span>}
        </span>
        {action && (
          <span className="wf-acc-action" onClick={(e) => e.stopPropagation()}>{action}</span>
        )}
        <span className="acc-card-chev" data-open={open} aria-hidden="true">
          <Icon name="ChevronDown" size={20} />
        </span>
      </button>
      {open && (
        <div id={id} className="acc-card-body">
          {children}
        </div>
      )}
    </section>
  );
}

function WfComingSoon() { return null; /* legacy — every accordion now renders a real body */ }

// =====================================================================
// OnboardingTracker — lifecycle accordion shown on worker detail when
// w.status is Onboarding or Offboarding. Reads its task catalog from
// the Lifecycle program card in Settings\u2192Configuration (Pro or
// Frontline depending on the worker's pool), so a single admin edit
// updates the tracker, the worker-mobile Onboarding tab, and the
// professional-onboard panel together.
//
// Each worker's progress is derived from a stable hash on w.id so a
// given worker reads the same way across reloads. No persistence layer
// is added — this is a presentation projection over the existing
// task catalog.
// =====================================================================
function lifecycleKindFor(w) {
  // Pool === "Contractor" has its own lifecycle (Contractors parity).
  // Pool === "Agency" + Frontline shifts → owned by the agency, no
  // buyer-side tracker. Direct-sourced Frontline (Internal / Float /
  // Per-diem / Alumni) and Professional engagements get a tracker.
  if (w.pool === "Contractor") return null;
  if (w._professionalRow || w.pool === "Professional" || w.engagementType) return "pro";
  if (w.pool === "Agency" || w.pool === "EOR") return null;
  return "frontline";
}

function lifecycleProjectionFor(w, slot, catalog) {
  // Deterministic projection — derive done / in-progress / blocked
  // from a hash on (w.id, task.id) so the same worker reads the same
  // way every render. Onboarding workers show ~60% done; Offboarding
  // workers ~30% done (they just started); Compliant workers show 100%
  // (collapsed); Inactive workers show 100% on the offboarding side.
  const isCompliant = w.status === "Compliant";
  const isOnboard   = w.status === "Onboarding" && slot === "onboarding";
  const isOffboard  = w.status === "Offboarding" && slot === "offboarding";
  const isInactive  = w.status === "Inactive" || w.status === "Terminated";
  return catalog.map((t, i) => {
    let state = "pending";
    if (isCompliant || (isInactive && slot === "offboarding")) state = "done";
    else if (isOnboard) {
      const seed = (w.id + t.id).split("").reduce((a, c) => a + c.charCodeAt(0), 0);
      state = seed % 5 === 0 ? "blocked" : seed % 3 === 0 ? "progress" : i < Math.round(catalog.length * 0.6) ? "done" : "pending";
    } else if (isOffboard) {
      state = i < Math.round(catalog.length * 0.3) ? "done" : i < Math.round(catalog.length * 0.5) ? "progress" : "pending";
    }
    return { ...t, state };
  });
}

function LifecycleTrackerBody({ w }) {
  const kind = lifecycleKindFor(w);
  const slot = w.status === "Offboarding" || w.status === "Inactive" || w.status === "Terminated" ? "offboarding" : "onboarding";
  // Resolve through the worker-aware resolver so per-job template
  // overrides (Settings\u2192Jobs) take precedence over the kind default.
  const catalog = !kind ? []
    : slot === "offboarding"
      ? (window.getOffboardingTasksForWorker ? window.getOffboardingTasksForWorker(w) : (window.getOffboardingTasks ? window.getOffboardingTasks(kind) : []))
      : (window.getOnboardingTasksForWorker  ? window.getOnboardingTasksForWorker(w)  : (window.getOnboardingTasks  ? window.getOnboardingTasks(kind)  : []));
  const template = (window.resolveLifecycleTemplateForWorker ? window.resolveLifecycleTemplateForWorker(w) : null);
  const rows = lifecycleProjectionFor(w, slot, catalog);
  const done = rows.filter((r) => r.state === "done").length;
  const pct  = rows.length ? Math.round((done / rows.length) * 100) : 0;
  const titleByOwner = { worker: "Worker tasks", employer: "Employer tasks", shared: "Shared tasks" };
  const groups = ["worker", "employer", "shared"].map((g) => ({
    g,
    title: titleByOwner[g],
    rows: rows.filter((r) => r.owner === g),
  })).filter((g) => g.rows.length);

  const ActionFor = ({ r }) => {
    if (r.state === "done") return null;
    if (r.state === "blocked") return <button type="button" className="lct-action" onClick={() => showToast(`Retrying ${r.label}…`)}>Retry</button>;
    if (slot === "onboarding" && r.owner === "worker") return <button type="button" className="lct-action" onClick={() => showToast(`Reminder sent to ${w.name} for ${r.label}`, { kind: "success" })}>Remind</button>;
    return <button type="button" className="lct-action" onClick={() => showToast(`Marked ${r.label} complete`, { kind: "success" })}>Mark done</button>;
  };

  return (
    <div className="lct">
      <div className="lct-head">
        <div className="lct-head-stats">
          <span className="lct-head-num tabular">{done}<span style={{ opacity: 0.5 }}> / {rows.length}</span></span>
          <span className="lct-head-pct tabular">{pct}% complete</span>
          {template && (
            <span className="lct-head-meta" style={{ marginLeft: 8 }}>
              Template: <b style={{ color: "var(--evr-content-primary-highemp)" }}>{template.name}</b>
            </span>
          )}
        </div>
        <span className="lct-head-meta">
          {slot === "onboarding"
            ? (pct === 100 ? "Shift-ready" : `~${Math.max(1, Math.round((100 - pct) / 14))} day${(100 - pct) > 14 ? "s" : ""} until shift-ready`)
            : (pct === 100 ? "Off-boarded" : `Effective ${w.status === "Offboarding" ? "next pay period" : "in progress"}`)}
        </span>
      </div>
      <div className={"lct-progress" + (slot === "offboarding" ? " lct-progress--offb" : "")}>
        <div className="lct-progress-fill" style={{ width: pct + "%" }} />
      </div>
      {groups.map((g) => (
        <div key={g.g}>
          <div className="lct-head-meta" style={{ margin: "6px 0 6px", textTransform: "uppercase", letterSpacing: "0.04em", fontWeight: 700 }}>{g.title}</div>
          <ul className="lct-list" role="list">
            {g.rows.map((r) => (
              <li key={r.id} className={"lct-row lct-row--" + r.state}>
                <span className="lct-check" aria-hidden="true">
                  {r.state === "done"     ? <Icon name="Check" size={12} />
                  : r.state === "blocked" ? <Icon name="Alert" size={12} />
                  : r.state === "progress" ? <Icon name="PersonClock" size={12} />
                  : null}
                </span>
                <span className="lct-name">{r.label}</span>
                <span className="lct-due">Due in {r.due}d</span>
                <span className="lct-due">
                  {r.connector === null || r.connector === undefined
                    ? "Manual"
                    : { esign: "E-Sig", bgcheck: "BG check", rtw: "RTW", payroll: "Payroll", banking: "Banking", okta: "SSO", asset: "Asset" }[r.connector] || r.connector}
                </span>
                <ActionFor r={r} />
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

// Visibility helper used by WorkerDetailsPage. Returns true when the
// worker's lifecycle is buyer-owned (Pro engagement or direct-sourced
// Frontline) AND the worker is in a transitional state (Onboarding /
// Offboarding) OR the program is freshly Compliant and the manager
// wants to see the closed checklist. Returns false for agency-sourced
// Frontline workers — their onboarding belongs to the agency.
function lifecycleAccordionVisible(w) {
  if (lifecycleKindFor(w) === null) return false;
  return ["Onboarding", "Offboarding", "Compliant", "Inactive", "Terminated"].includes(w.status);
}

// ---------- Real bodies for the Worker Details accordions ----------

function WfScheduleBody({ w }) {
  // Prefer the worker's real schedule for the current demo week when
  // present, so opening a worker shows the same shifts the calendar
  // page displays. Falls back to a synthesized 5-shift week for
  // workers without a row.
  const schedRows = window.SCH_WORKER_SCHED || (typeof SCH_WORKER_SCHED !== "undefined" ? SCH_WORKER_SCHED : null);
  const reqs = window.REQUISITIONS || [];
  const myRow = schedRows && schedRows.find((r) => r.worker === w.id);
  const _schDays = window.SCH_DAYS || (typeof SCH_DAYS !== "undefined" ? SCH_DAYS : []);
  const SCH_KEY_TO_DATE = {};
  const SCH_KEY_TO_MO   = {};
  _schDays.forEach((d) => {
    SCH_KEY_TO_DATE[d.key] = String(d.date);
    SCH_KEY_TO_MO[d.key]   = new Date(d.year || 2026, d.month != null ? d.month : 3, 1)
      .toLocaleDateString("en-US", { month: "short" }).toUpperCase();
  });
  const SCH_KEY_ORDER = _schDays.map((d) => d.key);
  const _today = window.flexToday ? window.flexToday() : new Date(2026, 4, 19);
  const _todayDate = _today.getDate();
  let shifts;
  if (myRow) {
    // Expand each shift across its span so each scheduled day is its own row.
    const req = reqs.find((r) => r.id === myRow.reqId);
    const location = (req && req.location) || "Warehouse #35";
    const expanded = [];
    (myRow.shifts || []).forEach((s) => {
      const startIdx = SCH_KEY_ORDER.indexOf(s.day);
      for (let i = 0; i < (s.span || 1); i++) {
        const k = SCH_KEY_ORDER[startIdx + i];
        if (!k) break;
        // Compare each day to today: earlier = completed, today =
        // in-progress, tomorrow = confirmed, later = scheduled.
        const dateNum = parseInt(SCH_KEY_TO_DATE[k], 10);
        let status = "Scheduled", statusHue = "default";
        if (dateNum < _todayDate)        { status = "Completed";   statusHue = "success"; }
        else if (dateNum === _todayDate) { status = "In progress"; statusHue = "informative"; }
        else if (dateNum === _todayDate + 1) { status = "Confirmed"; statusHue = "success"; }
        expanded.push({ mo: SCH_KEY_TO_MO[k] || "APR", day: SCH_KEY_TO_DATE[k], role: s.role, time: s.time, location, status, statusHue });
      }
    });
    shifts = expanded.slice(0, 5);
  }
  if (!shifts || shifts.length === 0) {
    const role = w.jobs[0] || "Production Associate";
    shifts = [
      { mo: "NOV", day: "04", role, time: "6:00 AM – 3:00 PM", location: "Warehouse #35",         status: "Scheduled",     statusHue: "default" },
      { mo: "NOV", day: "05", role, time: "6:00 AM – 3:00 PM", location: "Warehouse #35",         status: "Scheduled",     statusHue: "default" },
      { mo: "NOV", day: "06", role, time: "6:00 AM – 3:00 PM", location: "Warehouse #35",         status: "In progress",   statusHue: "informative" },
      { mo: "NOV", day: "07", role, time: "7:00 AM – 4:00 PM", location: "Logistics Hub Alpha",   status: "Confirmed",     statusHue: "success" },
      { mo: "NOV", day: "10", role, time: "7:00 AM – 4:00 PM", location: "Logistics Hub Alpha",   status: "Pending",       statusHue: "warning" },
    ];
  }
  return (
    <React.Fragment>
      <DgSubhead
        title="Upcoming shifts"
        action={(
          <button
            type="button"
            className="linkbtn"
            onClick={() => showToast(`Opening full schedule for ${w.name}`)}
          >
            View full schedule
          </button>
        )}
      />
      <ScheduleStrip shifts={shifts} />
    </React.Fragment>
  );
}

function WfLogsBody({ w }) {
  // Build a worker-specific audit trail: which pool/source brought them
  // in, what credentials they hold, where they've worked, and the most
  // recent timesheet/shift events. Branches on status so an "Expired"
  // worker reads as a compliance story, not a fresh-onboard story.
  const sourceLabel = w.supplier ? (REQ_SUPPLIERS[w.supplier]?.label || "Supplier") : `${POOL_META[w.pool]?.label || "Internal"} pool admin`;
  const primaryJob = (w.jobs && w.jobs[0]) || "shift";
  const secondJob = w.jobs && w.jobs[1];
  const regionShort = (w.region || "").split(" - ").pop() || w.region;

  const items = [];

  if (w.status === "Onboarding") {
    items.push({ tone: "info",    icon: "PersonPlus",      actor: sourceLabel, action: "added to roster as", target: primaryJob, note: regionShort, time: "10 days ago" });
    items.push({ tone: "info",    icon: "File",            actor: w.name, action: "submitted I-9 + direct deposit", time: "1 week ago" });
    items.push({ tone: "warning", icon: "Alert",           actor: "Compliance bot", action: `awaiting background check for ${w.name}`, time: "5 days ago" });
    items.push({ tone: "info",    icon: "PersonAuthorize", actor: "Nia Thompson", action: `cleared ${w.name} for ${primaryJob} dispatch`, time: "2 days ago" });
    items.push({ tone: "success", icon: "Check",           actor: "System", action: `completed orientation${secondJob ? ` for ${primaryJob} + ${secondJob}` : ""}`, time: "Yesterday" });
  } else if (w.status === "Expired") {
    items.push({ tone: "success", icon: "Check",           actor: w.name, action: `completed ${w.shifts} shifts as ${primaryJob}`, time: "8 months ago" });
    items.push({ tone: "info",    icon: "PersonClock",     actor: w.name, action: "last clocked in", time: "10 weeks ago" });
    items.push({ tone: "warning", icon: "Alert",           actor: "Compliance bot", action: `${w.name}'s credentials expired — auto-paused from new shifts`, time: "6 weeks ago" });
    items.push({ tone: "info",    icon: "Edit",            actor: "Nia Thompson", action: `requested credential renewal from ${sourceLabel}`, time: "3 weeks ago" });
    items.push({ tone: "info",    icon: "TimeUndo",        actor: "System", action: `moved ${w.name} to Alumni pool until re-verification`, time: "1 week ago" });
  } else {
    items.push({ tone: "success", icon: "Check",           actor: w.name, action: "completed compliance verification", note: `Background + I-9 cleared`, time: "3 months ago" });
    items.push({ tone: "info",    icon: "PersonPlus",      actor: sourceLabel, action: `added ${w.name} as ${primaryJob}${secondJob ? ` / ${secondJob}` : ""}`, time: "3 months ago" });
    items.push({ tone: "info",    icon: "PersonClock",     actor: w.name, action: `clocked in for ${primaryJob} shift`, note: regionShort, time: "Today, 5:58 AM" });
    items.push({ tone: "success", icon: "Check",           actor: "Nia Thompson", action: `approved timesheet for ${w.name}`, target: `TS-${(w.id || "").replace(/[^a-z0-9]/gi, "").toUpperCase().padEnd(5, "0").slice(0, 5)}`, note: `${Math.max(8, Math.min(40, w.shifts))} hours this week`, time: "Yesterday" });
    items.push({ tone: "warning", icon: "Alert",           actor: w.name, action: "reported a late start", note: "15 minutes delayed", time: "3 days ago" });
    items.push({ tone: "info",    icon: "Edit",            actor: "Aiden Brooks", action: `extended ${w.name}'s assignment by 2 weeks`, time: "Last week" });
  }
  return <ActivityLog items={items} />;
}

// ---- Performance card ---------------------------------------------------
// Deterministic per-worker performance metrics: rating, on-time %,
// reliability, worked / cancelled / no-shows / late starts, total hours,
// avg shift, rebook rate, plus a 6-month trend and per-site rating.
// All values derived from w.id + w.shifts so the same worker always reads
// the same numbers across reloads (and across the demo's reused list).
function wfPerfHash(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0);
}
function wfPerfFor(w) {
  const seed = wfPerfHash(`${w.id || ""}:${w.name || ""}`);
  const r = (n) => ((seed >>> (n * 3)) & 0xff);
  const total = w.shifts || 0;

  // Bad-actor coefficient — Expired workers cancel more & rate lower.
  const isExpired = w.status === "Expired";
  const isOnboard = w.status === "Onboarding";

  const cancelled = total === 0 ? 0
    : isExpired ? Math.min(total, 3 + (r(0) % 3))
    : isOnboard ? Math.min(total, (r(0) % 2))
    : (r(0) % 3);
  const noShows = total === 0 ? 0
    : isExpired ? 1 + (r(1) % 2)
    : (r(1) % 100 < 35 ? 1 : 0);
  const lateStarts = total === 0 ? 0
    : isExpired ? 3 + (r(2) % 3)
    : (r(2) % 5);
  const worked = Math.max(0, total - cancelled - noShows);

  const onTime = worked === 0 ? 0
    : Math.round(((worked - lateStarts) / worked) * 1000) / 10;
  const reliability = total === 0 ? 0
    : Math.round((worked / total) * 1000) / 10;

  // Rating: 4.5 base, ±0.4 jitter, expired drops to ~3.6, onboarding ~4.3.
  const base = isExpired ? 3.6 : isOnboard ? 4.3 : 4.5;
  const jitter = ((r(3) % 9) - 4) / 10; // -0.4…+0.4
  const rating = Math.max(2.0, Math.min(5.0, Math.round((base + jitter) * 10) / 10));

  const avgShiftHrs = 7.5 + ((r(4) % 7) / 4); // 7.5–9.0
  const totalHours = Math.round(worked * avgShiftHrs);

  // Rebook rate: % of completed shifts that came from a returning site.
  const rebookRate = total === 0 ? 0
    : Math.max(0, Math.min(98, 55 + (r(5) % 40) - (isExpired ? 25 : 0)));

  // Last shift — days ago.
  const lastShiftDays = isExpired ? 70 + (r(6) % 30)
    : isOnboard ? 1 + (r(6) % 4)
    : (r(6) % 9);

  // 6-month trend (Nov 2025 → Apr 2026 in demo). Distribute worked + cancelled.
  const MONTHS = ["Nov", "Dec", "Jan", "Feb", "Mar", "Apr"];
  const trend = MONTHS.map((mo, i) => {
    const wk = Math.max(0, Math.round((worked / 6) + ((r(i + 7) % 5) - 2)));
    const cx = Math.max(0, Math.round((cancelled / 6) + ((r(i + 13) % 3) - 1)));
    return { mo, worked: wk, cancelled: cx };
  });

  // Top sites — 3 facilities, weighted by ratings near the worker's overall.
  const SITES = [
    "Warehouse #35", "Logistics Hub Alpha", "Bayview Distribution",
    "Eastpark Facility", "Midland Depot", "Pacific Terminal",
  ];
  const pick = (idx) => SITES[(seed + idx * 7) % SITES.length];
  const siteRating = (i) => {
    const delta = ((r(i + 19) % 11) - 5) / 10; // -0.5…+0.5
    return Math.max(2.0, Math.min(5.0, Math.round((rating + delta) * 10) / 10));
  };
  const sShifts = (i) => Math.max(1, Math.round(worked / 3) + ((r(i + 23) % 5) - 2));
  const sites = [
    { name: pick(0), shifts: sShifts(0), rating: siteRating(0) },
    { name: pick(1), shifts: sShifts(1), rating: siteRating(1) },
    { name: pick(2), shifts: sShifts(2), rating: siteRating(2) },
  ];

  return {
    rating, onTime, reliability,
    worked, cancelled, noShows, lateStarts,
    totalHours, avgShiftHrs: Math.round(avgShiftHrs * 10) / 10,
    rebookRate, lastShiftDays,
    reviews: worked, trend, sites,
  };
}

// 5-star visual built from inline SVG so we can render half-stars
// without depending on a Star icon (Everest's set ships none).
function WfStars({ value, size = 20 }) {
  const stars = [];
  for (let i = 0; i < 5; i++) {
    const fill = Math.max(0, Math.min(1, value - i));
    const pct = Math.round(fill * 100);
    stars.push(
      <span key={i} className="wf-perf-star" style={{ width: size, height: size }}>
        <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
          <defs>
            <linearGradient id={`wfstar-${i}-${pct}`} x1="0" x2="1" y1="0" y2="0">
              <stop offset={`${pct}%`} stopColor="var(--evr-yellow-500)" />
              <stop offset={`${pct}%`} stopColor="var(--evr-neutral-90)" />
            </linearGradient>
          </defs>
          <path
            d="M12 2.6l2.92 5.92 6.54.95-4.73 4.61 1.12 6.51L12 17.6l-5.85 3.07 1.12-6.51L2.54 9.47l6.54-.95L12 2.6z"
            fill={`url(#wfstar-${i}-${pct})`}
          />
        </svg>
      </span>
    );
  }
  return <span className="wf-perf-stars" aria-label={`${value} out of 5`}>{stars}</span>;
}

function WfPerfHeadline({ icon, tone, label, valueNode, sub }) {
  return (
    <div className={`wf-perf-headline wf-perf-headline--${tone}`}>
      <div className="wf-perf-headline-top">
        <span className={`wf-perf-headline-ic wf-perf-headline-ic--${tone}`} aria-hidden="true">
          <Icon name={icon} size={18} />
        </span>
        <span className="wf-perf-headline-label">{label}</span>
      </div>
      <div className="wf-perf-headline-value">{valueNode}</div>
      <div className="wf-perf-headline-sub">{sub}</div>
    </div>
  );
}

function WfPerfTile({ label, value, sub, tone = "default" }) {
  return (
    <div className={`wf-perf-tile wf-perf-tile--${tone}`}>
      <div className="wf-perf-tile-label">{label}</div>
      <div className="wf-perf-tile-value">{value}</div>
      {sub ? <div className="wf-perf-tile-sub">{sub}</div> : null}
    </div>
  );
}

function WfPerfTrend({ trend }) {
  const max = Math.max(1, ...trend.map((t) => t.worked + t.cancelled));
  return (
    <div className="wf-perf-trend">
      <div className="wf-perf-trend-head">
        <h3 className="wf-perf-section-title">Shift activity · last 6 months</h3>
        <div className="wf-perf-trend-legend">
          <span className="wf-perf-legend"><span className="wf-perf-swatch wf-perf-swatch--worked" />Worked</span>
          <span className="wf-perf-legend"><span className="wf-perf-swatch wf-perf-swatch--cancelled" />Cancelled / no-show</span>
        </div>
      </div>
      <div className="wf-perf-bars">
        {trend.map((t) => {
          const wkH = (t.worked / max) * 100;
          const cxH = (t.cancelled / max) * 100;
          return (
            <div className="wf-perf-bar-col" key={t.mo}>
              <div className="wf-perf-bar-stack" aria-label={`${t.mo}: ${t.worked} worked, ${t.cancelled} cancelled`}>
                {t.cancelled > 0 && (
                  <div className="wf-perf-bar wf-perf-bar--cancelled" style={{ height: `${cxH}%` }} />
                )}
                <div className="wf-perf-bar wf-perf-bar--worked" style={{ height: `${wkH}%` }} />
              </div>
              <div className="wf-perf-bar-label">{t.mo}</div>
              <div className="wf-perf-bar-count tabular">{t.worked + t.cancelled}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function WfPerfSites({ sites }) {
  return (
    <div className="wf-perf-sites">
      <h3 className="wf-perf-section-title">Top sites</h3>
      <div className="wf-perf-sites-list">
        {sites.map((s, i) => (
          <div className="wf-perf-site-row" key={i}>
            <span className="wf-perf-site-ic" aria-hidden="true">
              <Icon name="Location" size={16} />
            </span>
            <div className="wf-perf-site-name">{s.name}</div>
            <div className="wf-perf-site-shifts tabular">{s.shifts} shifts</div>
            <div className="wf-perf-site-rating">
              <WfStars value={s.rating} size={14} />
              <span className="wf-perf-site-rating-val tabular">{s.rating.toFixed(1)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function WorkerPerformanceBody({ w }) {
  const p = wfPerfFor(w);
  const lastShiftCopy = p.lastShiftDays === 0 ? "Today"
    : p.lastShiftDays === 1 ? "1 day ago"
    : `${p.lastShiftDays} days ago`;
  return (
    <div className="wf-perf">
      {/* ---- Headline strip ---- */}
      <div className="wf-perf-headline-row">
        <WfPerfHeadline
          icon="Performance"
          tone="rating"
          label="Rating"
          valueNode={(
            <div className="wf-perf-rating-row">
              <span className="wf-perf-rating-num tabular">{p.rating.toFixed(1)}</span>
              <span className="wf-perf-rating-denom">/ 5.0</span>
              <WfStars value={p.rating} size={18} />
            </div>
          )}
          sub={`Based on ${p.reviews} shift review${p.reviews === 1 ? "" : "s"}`}
        />
        <WfPerfHeadline
          icon="PersonClock"
          tone="success"
          label="On-time"
          valueNode={<span className="tabular">{p.onTime.toFixed(1)}%</span>}
          sub={`${Math.max(0, p.worked - p.lateStarts)} of ${p.worked} shifts started on time`}
        />
        <WfPerfHeadline
          icon="ClipboardCircleCheck"
          tone="info"
          label="Reliability"
          valueNode={<span className="tabular">{p.reliability.toFixed(1)}%</span>}
          sub={`${p.worked} of ${p.worked + p.cancelled + p.noShows} scheduled shifts completed`}
        />
      </div>

      {/* ---- KPI grid ---- */}
      <div className="wf-perf-grid">
        <WfPerfTile label="Worked shifts" value={p.worked} sub="all-time" />
        <WfPerfTile label="Cancelled" value={p.cancelled} tone={p.cancelled > 2 ? "warn" : "default"} sub={p.cancelled === 0 ? "none" : "by worker"} />
        <WfPerfTile label="No-shows" value={p.noShows} tone={p.noShows > 0 ? "err" : "default"} sub={p.noShows === 0 ? "none" : "unannounced"} />
        <WfPerfTile label="Late starts" value={p.lateStarts} tone={p.lateStarts > 2 ? "warn" : "default"} sub={p.lateStarts === 0 ? "none" : "≥ 5 min late"} />
        <WfPerfTile label="Hours worked" value={p.totalHours.toLocaleString()} sub="all-time" />
        <WfPerfTile label="Avg shift" value={`${p.avgShiftHrs.toFixed(1)} hrs`} sub="completed shifts" />
        <WfPerfTile label="Rebook rate" value={`${p.rebookRate}%`} sub="sites that re-booked" />
        <WfPerfTile label="Last shift" value={lastShiftCopy} sub={p.lastShiftDays > 30 ? "inactive" : "recent"} />
      </div>

      {/* ---- Trend + Top sites side-by-side ---- */}
      <div className="wf-perf-bottom">
        <WfPerfTrend trend={p.trend} />
        <WfPerfSites sites={p.sites} />
      </div>
    </div>
  );
}

// ---- Details body (key/value field rows) -------------------------------
function DetailsField({ label, value, placeholder = "Add" }) {
  return (
    <div className="wf-field">
      <dt className="wf-field-label">{label}</dt>
      <dd className={`wf-field-value${value ? "" : " wf-field-value--empty"}`}>
        {value || placeholder}
      </dd>
    </div>
  );
}

function WorkerDetailsBody({ w }) {
  const isFloat = w.pool === "Float";
  // Float worker records live in Dayforce core (HR system of record);
  // Flex Work syncs the subset needed to surface the worker on a
  // requisition. Derive a stable Dayforce employee ID from the Flex
  // Work external ID so the demo link reads as if the same person
  // exists in both systems.
  const coreEmployeeId = isFloat && w.externalId && w.externalId !== "\u2014"
    ? w.externalId.replace(/^FLT-/, "EMP-")
    : null;
  const coreHomeUnit = isFloat ? "Mercy Memorial \u00b7 Float Pool" : null;
  const coreLastSync = "Today, 7:42 AM";

  // Standard contact + identification groups, rendered with the shared
  // Everest dg-info layout (InfoGrid) so the worker Details accordion
  // reads identically to Supplier / Requisition / Location details.
  const standardGroups = [
    { title: "Contact information", rows: [
      { label: "Email",        value: w.email },
      { label: "Phone number", value: w.phone, tabular: true },
      { label: "Region",       value: w.region },
    ]},
    { title: "Identification", rows: [
      { label: "Date of birth", value: w.dob },
      { label: "Security ID",   value: w.securityId, tabular: true },
      { label: "External ID",   value: w.externalId === "—" ? null : w.externalId, tabular: true },
    ]},
  ];

  // Non-float workers: a single dg-info card, exactly like SupDetailsBody.
  if (!isFloat) {
    return <InfoGrid groups={standardGroups} />;
  }

  // Float workers keep the Dayforce-core "system of record" framing
  // (teal panel + sync status), but its fields now use the same dg-info
  // layout as everything else.
  return (
    <div className="wf-details">
      <div className="wf-details-section wf-details-section--df">
        <div className="wf-df-head">
          <span className="wf-df-badge" aria-hidden="true">
            <Icon name="Refresh" size={12} />
            Dayforce core
          </span>
          <h3 className="wf-details-section-title wf-df-title">System of record</h3>
          <span className="wf-df-sync" title={`Last sync: ${coreLastSync}`}>
            <span className="wf-df-sync-dot" aria-hidden="true" />
            Synced {coreLastSync}
          </span>
        </div>
        <p className="wf-df-blurb">
          {w.name.split(" ")[0]}{"\u2019"}s employee record, primary location, schedule and accrued
          hours live in Dayforce core. Flex Work mirrors the profile so the worker can pick up
          open requisitions across Mercy Health System {"\u2014"} no re-onboarding, no parallel
          roster. Edits round-trip through Dayforce; the fields below are read-only inside Flex Work.
        </p>
        <InfoGrid
          rows={[
            { label: "Dayforce employee ID", value: coreEmployeeId, tabular: true, copyable: true },
            { label: "Home org unit",        value: coreHomeUnit },
            { label: "Worker type",          value: "Employee" },
            { label: "Sourcing channel",     value: "FloatPool" },
            { label: "Last sync",            value: coreLastSync },
            { label: "Record", value: (
              <a
                href="#"
                className="linkbtn wf-df-link"
                onClick={(e) => {
                  e.preventDefault();
                  showToast(`Opening ${w.name} in Dayforce core`);
                }}
              >
                Open in Dayforce core
                <Icon name="ChevronRight" size={12} />
              </a>
            )},
          ]}
        />
      </div>
      <InfoGrid groups={standardGroups} />
    </div>
  );
}

// ---- Contract terms body (professional engagement-type workers) -------
// Lightweight accordion that surfaces the SOW / contract metadata
// captured on the worker row: cadence, rate, billing basis, SOW
// reference, contract dates, hiring manager. Reuses the same
// `wf-details` / DetailsField layout as the Details accordion so it
// reads as a sibling section and never invents its own visual.
function WfContractTermsBody({ w }) {
  // Reuse the row-cell money formatter so currency / rounding stay
  // consistent with the list view.
  const rate = (typeof _wfFmtRate === "function")
    ? _wfFmtRate(w.rateAmount, w.rateCurrency)
    : `${w.rateCurrency || "USD"} ${w.rateAmount || "—"}`;
  // Tag onto the cadence label so a Monthly engagement reads
  // "Monthly · $24,000". Falls back to the bare amount when one of
  // the two is missing.
  const rateLine = (w.cadence && rate !== "—") ? `${w.cadence} · ${rate}` : (rate !== "—" ? rate : (w.cadence || "—"));
  return (
    <div className="wf-details">
      <div className="wf-details-section">
        <h3 className="wf-details-section-title">Engagement</h3>
        <dl className="wf-fields">
          <DetailsField label="Engagement type" value={w.engagementType} />
          <DetailsField label="Reference" value={w.engagementRef} />
          <DetailsField label="Name" value={w.engagementName} />
          <DetailsField label="Hiring manager" value={w.hiringManager} />
        </dl>
      </div>
      <div className="wf-details-section">
        <h3 className="wf-details-section-title">Billing</h3>
        <dl className="wf-fields">
          <DetailsField label="Billing basis" value={w.billingBasis} />
          <DetailsField label="Cadence · rate" value={rateLine} />
        </dl>
      </div>
      <div className="wf-details-section">
        <h3 className="wf-details-section-title">Term</h3>
        <dl className="wf-fields">
          <DetailsField label="Start" value={w.contractStart} />
          <DetailsField label="End" value={w.contractEnd} />
          <DetailsField label="Renewal" value={w.renewalDate} />
        </dl>
      </div>
    </div>
  );
}

// ---- Compliance body (3 verification rows) -----------------------------
function ComplianceRow({ title, headline, sub, status = "verified" }) {
  return (
    <div className="wf-comp-row">
      <div className="wf-comp-name">{title}</div>
      <div className="wf-comp-detail">
        <span className={`wf-comp-icon wf-comp-icon--${status}`} aria-hidden="true">
          <Icon name="Check" size={20} />
        </span>
        <div className="wf-comp-text">
          <div className="wf-comp-headline">{headline}</div>
          <div className="wf-comp-sub">{sub}</div>
        </div>
      </div>
      <button
        type="button"
        className="btn btn--sm btn--secondary"
        onClick={() => showToast(`${title} — verification details (preview)`)}
      >
        View details
      </button>
    </div>
  );
}

// ---- One credential row inside the per-worker industry record --------
function WfCredentialRow({ cred, c }) {
  const status = (c && c.s) || "na";
  const statusMeta = {
    ok:      { tone: "verified", icon: "Check",             headline: "Valid" },
    warn:    { tone: "warning",  icon: "Hourglass",         headline: "Expiring soon" },
    err:     { tone: "error",    icon: "Alert",             headline: "Expired" },
    missing: { tone: "error",    icon: "PersonUnauthorize", headline: "Missing document" },
    review:  { tone: "info",     icon: "Refresh",           headline: "In verification" },
    na:      { tone: "muted",    icon: "Information",       headline: "Not required" },
  }[status];

  let sub = c && c.source;
  if (!sub) {
    if (status === "ok"   && c && c.d && c.d !== "—") sub = `Valid until ${c.d} · renews ${cred.cadence}`;
    else if (status === "warn" && c && c.d)            sub = `Expires ${c.d}`;
    else if (status === "err"  && c && c.d)            sub = `Expired ${c.d}`;
    else if (status === "na")                           sub = `Not required for this role`;
    else                                                sub = `Cadence: ${cred.cadence}`;
  }

  const actionLabel =
    status === "err" || status === "missing" ? "Request now"
    : status === "warn"                      ? "Renew"
    : status === "review"                    ? "View queue"
    :                                          "View";

  return (
    <div className="wf-comp-row">
      <div className="wf-comp-name">{cred.label}</div>
      <div className="wf-comp-detail">
        <span className={`wf-comp-icon wf-comp-icon--${statusMeta.tone}`} aria-hidden="true">
          <Icon name={statusMeta.icon} size={20} />
        </span>
        <div className="wf-comp-text">
          <div className="wf-comp-headline">{statusMeta.headline}</div>
          <div className="wf-comp-sub">{sub}</div>
        </div>
      </div>
      {status !== "na" ? (
        <button
          type="button"
          className="btn btn--sm btn--secondary"
          onClick={() => showToast(`${cred.label} — ${actionLabel.toLowerCase()}`)}
        >
          {actionLabel}
        </button>
      ) : (
        <span aria-hidden="true" />
      )}
    </div>
  );
}

function ComplianceBody({ w }) {
  // Pull industry credential pack + this worker's record (or a
  // synthesized record built from the industry catalog when the
  // worker isn't in the pack's hard-coded roster).
  const lookup = window.getCredentialingForWorker;
  const data = lookup ? lookup(w) : null;
  const pack = data && data.pack;
  const cw   = data && data.worker;

  // Last-resort fallback — never expected at runtime, but keeps the
  // accordion safe if credentialing.jsx fails to load.
  if (!pack || !cw) {
    return (
      <div className="wf-comp-card">
        <ComplianceRow title="ID Verification"    headline="ID Verified"         sub="Verified on: 03.12.2026, 11:21 AM PT" />
        <div className="wf-comp-divider" role="presentation" />
        <ComplianceRow title="Work Authorization" headline="Valid Authorization" sub="Verified on: 03.12.2026, 11:21 AM PT" />
        <div className="wf-comp-divider" role="presentation" />
        <ComplianceRow title="Background check"   headline="Passed"              sub="Passed on: 03.12.2026, 11:21 AM PT" />
      </div>
    );
  }

  // Roll-up by status so the banner can summarise.
  const counts = { ok: 0, warn: 0, err: 0, missing: 0, review: 0, na: 0 };
  pack.catalog.forEach((cred) => {
    const st = ((cw.creds[cred.code] || {}).s) || "na";
    counts[st] = (counts[st] || 0) + 1;
  });
  const totalActive = pack.catalog.length - counts.na;
  const totalReady  = counts.ok;
  const allCurrent  = counts.err + counts.missing + counts.warn + counts.review === 0;

  return (
    <div className="wf-cred">
      {/* Industry context banner */}
      <div className="wf-cred-banner">
        <div className="wf-cred-banner-main">
          <span className="wf-cred-banner-ic" aria-hidden="true">
            <Icon name="ShieldPerson" size={20} />
          </span>
          <div>
            <div className="wf-cred-banner-title">
              {pack.omnibarTitle} · {totalReady} / {totalActive} ready
            </div>
            <div className="wf-cred-banner-sub">
              {pack.catalog.length} credentials tracked for {cw.unit}
              {data.synthesized ? " · record auto-built from the industry catalog" : ""}
            </div>
          </div>
        </div>
        <div className="wf-cred-banner-chips">
          {counts.err > 0     && <span className="wf-cred-chip wf-cred-chip--err">{counts.err} expired</span>}
          {counts.missing > 0 && <span className="wf-cred-chip wf-cred-chip--err">{counts.missing} missing</span>}
          {counts.warn > 0    && <span className="wf-cred-chip wf-cred-chip--warn">{counts.warn} expiring</span>}
          {counts.review > 0  && <span className="wf-cred-chip wf-cred-chip--info">{counts.review} in review</span>}
          {allCurrent && <span className="wf-cred-chip wf-cred-chip--ok">All current</span>}
        </div>
      </div>

      {/* Verification source cards */}
      <div className="wf-cred-sources">
        <div className="wf-cred-source">
          <div className="wf-cred-source-label">{pack.domain.sourceLabel}</div>
          <div className="wf-cred-source-val">{pack.domain.sourceName}</div>
          <div className="wf-cred-source-sub">{pack.domain.sourceMeta}</div>
          {cw.licenseNo && cw.licenseNo !== "—" && (
            <div className="wf-cred-source-id">{cw.licenseNo}</div>
          )}
        </div>
        <div className="wf-cred-source">
          <div className="wf-cred-source-label">
            {pack.domain.secondaryLabel} · <span className="wf-cred-source-status">{cw.secondary.status}</span>
          </div>
          <div className="wf-cred-source-val">Queried {cw.secondary.queried}</div>
          <div className="wf-cred-source-sub">Next query {cw.secondary.next}</div>
          {cw.secondary.flag && (
            <p className="wf-cred-source-flag">{cw.secondary.flag}</p>
          )}
        </div>
      </div>

      {/* Per-credential rows — one row per catalog entry */}
      <div className="wf-comp-card" style={{ marginTop: 16 }}>
        {pack.catalog.map((cred, i) => (
          <React.Fragment key={cred.code}>
            {i > 0 && <div className="wf-comp-divider" role="presentation" />}
            <WfCredentialRow cred={cred} c={cw.creds[cred.code]} />
          </React.Fragment>
        ))}
      </div>

      {/* Footer action row */}
      <div className="wf-cred-actions">
        <button
          type="button"
          className="btn btn--sm btn--secondary"
          onClick={() => showToast(pack.domain.psvToast)}
        >
          <Icon name="ShieldPerson" size={14} />{pack.domain.psvAction}
        </button>
        <button
          type="button"
          className="btn btn--sm btn--secondary"
          onClick={() => showToast("Renewal reminder sent to worker")}
        >
          <Icon name="Send" size={14} />Send renewal reminder
        </button>
        <button
          type="button"
          className="btn btn--sm btn--secondary"
          onClick={() => showToast(pack.domain.packetToast)}
        >
          <Icon name="FileDownload" size={14} />Export credential file
        </button>
      </div>
    </div>
  );
}

// ---- Blocked locations: empty state with primary action ---------------
function BlockedLocationsBody() {
  return (
    <div className="wf-blocked-empty">
      <span className="wf-blocked-icon" aria-hidden="true">
        <Icon name="Lock" size={20} />
      </span>
      <div className="wf-blocked-text">
        <h3 className="wf-blocked-title">No blocked locations</h3>
        <p className="wf-blocked-sub">
          Add a location to prevent this worker from being matched to shifts there.
        </p>
      </div>
      <button
        type="button"
        className="btn btn--sm btn--secondary"
        onClick={() => openFilter(document.activeElement || document.body, {
          title: "Block location",
          options: LOCATIONS.map((l) => ({ value: l.id, label: l.name })),
          onApply: (ids) => showToast(`Blocked ${ids.length} location${ids.length === 1 ? "" : "s"}`, { kind: "success" }),
        })}
      >
        <Icon name="AddCircle" size={14} />Add location
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------
// Worker engagements section — lists every requisition / engagement the
// worker is on, routes through /requisitions/:id (the unified detail).
// Lives as a SECTION inside the profile, not a tab on the Workforce hub.
// Reads from each variant store the worker has touched; falls back to a
// helpful empty state when none.
// ---------------------------------------------------------------------
function WorkerEngagementsBody({ w }) {
  const rows = [];

  // Frontline / Agency requisitions — worker name appears on bookings.
  const reqs = (window.REQUISITIONS || []);
  for (const r of reqs) {
    const onIt = Array.isArray(r.bookings)
      && r.bookings.some((b) => b && (b.workerId === w.id || b.name === w.name));
    if (onIt) {
      rows.push({
        id: r.id, type: "frontline",
        title: (r.jobs && r.jobs[0]) || r.id,
        sub: `${r.location || "—"} · ${r.qty || 1} shift${r.qty === 1 ? "" : "s"}`,
        status: r.status,
        chipClass: "rdu-chip--frontline", chipLabel: "Frontline",
      });
    }
  }

  // Professional reqs
  if (window.getFeatureFlag && window.getFeatureFlag("professionalWork")) {
    const proReqs = (window.PROFESSIONAL_REQUISITIONS_RAW || window.PROFESSIONAL_REQUISITIONS || []);
    for (const r of proReqs) {
      const onIt = (r.assignee && (r.assignee === w.id || r.assignee === w.name))
        || (Array.isArray(r.candidates) && r.candidates.some((c) => c.id === w.id || c.name === w.name));
      if (onIt) {
        rows.push({
          id: r.id, type: "professional",
          title: (r.jobs && r.jobs[0]) || r.title || r.id,
          sub: `${r.location || "—"} · ${r.cadence || "cadence"}`,
          status: r.status,
          chipClass: "rdu-chip--professional", chipLabel: "Professional",
        });
      }
    }
  }

  // Contractor engagement (the contractor worker IS the engagement).
  if (window.getFeatureFlag && window.getFeatureFlag("contractors")) {
    const ctr = window.getContractorById && window.getContractorById(w.id);
    if (ctr) {
      rows.push({
        id: ctr.id, type: "contractor",
        title: ctr.role || ctr.name || ctr.id,
        sub: `${ctr.country || "—"} · ${ctr.classification || "—"}`,
        status: "Active",
        chipClass: "rdu-chip--contractor", chipLabel: "Contractor",
      });
    }
  }

  // SOW resources — supplier-assigned workers on a SOW.
  if (window.getFeatureFlag && window.getFeatureFlag("sow")) {
    const sowResources = (window.getSowResourceWorkers && window.getSowResourceWorkers()) || [];
    for (const r of sowResources) {
      if (r.workerId === w.id || r.name === w.name) {
        const sow = window.getSOWById && window.getSOWById(r.sowId);
        rows.push({
          id: r.sowId, type: "sow",
          title: (sow && sow.name) || r.sowId,
          sub: `${(sow && sow.supplier && sow.supplier.label) || "Supplier"} · ${r.role || "Resource"}`,
          status: sow && sow.status,
          chipClass: "rdu-chip--sow", chipLabel: "SOW",
        });
      }
    }
  }

  if (rows.length === 0) {
    return (
      <div className="wf-engs-empty">
        <p style={{ color: "var(--evr-content-primary-lowemp)", margin: 0, fontSize: 13.5 }}>
          No engagements on file for {w.name}. Frontline shifts, Professional reqs,
          Contractor agreements, and SOW resource assignments all land here when they happen.
        </p>
      </div>
    );
  }

  const openRow = (id) => {
    if (window.flexGoTo) window.flexGoTo({ page: "requisitions", sub: "detail", id });
  };

  return (
    <ul className="wf-engs-list">
      {rows.map((r, i) => (
        <li key={`${r.type}-${r.id}-${i}`} className="wf-engs-row">
          <button
            type="button"
            className="wf-engs-row-btn"
            onClick={() => openRow(r.id)}
            aria-label={`Open ${r.title}`}
          >
            <span className={`rdu-chip ${r.chipClass}`} style={{ flexShrink: 0 }}>
              {r.chipLabel}
            </span>
            <span className="wf-engs-row-main">
              <span className="wf-engs-row-title">{r.title}</span>
              <span className="wf-engs-row-sub">{r.sub}</span>
            </span>
            <span className="wf-engs-row-id tabular">{r.id}</span>
            {r.status ? <span className="wf-engs-row-status">{r.status}</span> : null}
            <Icon name="ChevronRight" size={16} />
          </button>
        </li>
      ))}
    </ul>
  );
}

function WorkerDetailsPage({ workerId, onBack }) {
  // Look up in the standard roster, then fall back to the contractor
  // roster when the contractors feature flag is on. This keeps the
  // existing data flow intact and only changes behaviour when the flag
  // adds contractor workers.
  const fromBase = WORKERS.find((x) => x.id === workerId);
  const fromContractors = !fromBase && window.getContractorById ? window.getContractorById(workerId) : null;
  const fromPros = !fromBase && !fromContractors && window.getProfessionalWorkerById ? window.getProfessionalWorkerById(workerId) : null;
  const w = fromBase || fromContractors || fromPros || WORKERS[0];
  const isContractor = w.pool === "Contractor";
  const isProfessional = w.pool === "Professional";
  // Professional engagement-type workers stay in the regular Workforce
  // roster (Agency / Internal pool) but carry an explicit
  // engagementType of Assignment / Project / Statement of Work. The
  // detail page picks up an extra "Contract terms" accordion for these
  // rows so SOW reference / cadence / rate / renewal date have a
  // visible home alongside the standard accordions.
  const isProEngagement = !!(w.engagementType && w.engagementType !== "Shift"
    && window.professionalJobsEnabled && window.professionalJobsEnabled());
  const sup = w.supplier ? (REQ_SUPPLIERS[w.supplier] || REQ_SUPPLIERS.sw) : null;
  const poolMeta = POOL_META[w.pool] || POOL_META.Agency;
  const statusHue = WF_STATUS_HUES[w.status] || "default";
  const editEntity = useEditEntity();
  const CDS = (isContractor && typeof window !== "undefined") ? window.ContractorDetailSections : null;
  // Professional workers swap the Frontline shift/perf/blocked-locs
  // stack for Pro-specific accordions: contract terms, interview
  // history, renewals, expenses, invoices, documents.
  const PDS = (isProfessional && typeof window !== "undefined") ? window.ProfessionalDetailSections : null;

  const openEdit = () => editEntity.open({
    ...workerEditSchema(w),
    onSave: () => showToast(`${w.name} updated`, { kind: "success" }),
  });

  return (
    <React.Fragment>
      <ReqOmnibar
        title={w.name}
        subtitle="Workforce"
        status={<span className={`req-pill req-pill--${statusHue}`}>{w.status}</span>}
        onBack={onBack}
        actions={(
          <React.Fragment>
            <button
              type="button"
              className="iconbtn"
              aria-label="Reload"
              title="Reload"
              onClick={() => showToast("Profile refreshed")}
            >
              <Icon name="Refresh" size={20} />
            </button>
            <button
              type="button"
              className="btn btn--md btn--secondary"
              onClick={openEdit}
            >
              <Icon name="Edit" size={16} />Edit
            </button>
            <button
              type="button"
              className="iconbtn"
              aria-label="More"
              onClick={(e) => openMenu(e.currentTarget, [
                { icon: "Calendar",    label: "View schedule",   onClick: () => showToast(`Opening full schedule for ${w.name}`) },
                { icon: "PersonClock", label: "Open timesheets", onClick: () => showToast(`Timesheets for ${w.name}`) },
                { icon: "Copy",        label: "Copy worker ID",  onClick: () => copyToClipboard(w.workerId, "Worker ID copied") },
                { divider: true },
                // Pro + direct-sourced Frontline workers go through the
                // scoped RemoveWorkerPanel (engagement / worker scope).
                ((w._professionalRow || w.engagementType || (w.pool && w.pool !== "Agency" && w.pool !== "EOR" && w.pool !== "Contractor")))
                  ? { icon: "PersonClock", label: "Offboard worker", danger: true,
                      onClick: () => window.openRemoveWorker && window.openRemoveWorker(window.buildRemoveWorkerCtx({
                        worker: w,
                        bookingId: w.workerId || w.id,
                        defaultScope: (w._professionalRow || w.engagementType) ? "engagement" : "worker",
                        onConfirm: () => { showToast(`${w.name} offboarding started`, { kind: "success" }); onBack && onBack(); },
                      })) }
                  : { icon: "Cancel",      label: "Remove worker",   danger: true,
                      onClick: () => openConfirm({
                        title: `Remove ${w.name}?`,
                        body: `${w.name} will no longer be available for shifts.`,
                        primaryLabel: "Remove",
                        onConfirm: () => { showToast(`${w.name} removed`, { kind: "success" }); onBack && onBack(); },
                      }) },
              ])}
            >
              <Icon name="MoreVert" size={20} />
            </button>
          </React.Fragment>
        )}
      />

      <div className="req-wf" style={{ maxWidth: 1200 }}>
        {/* v0.77 axis-chip row — shows the worker's current engagement
            axes (Work Type · Billing Model · Supplier Type). Gated by
            `enabledTypes() > 1` so flag-off DOM is byte-identical. See
            unified-vms-v0.77-spec.html §10. */}
        {window.AxisChipRow ? (
          <window.AxisChipRow
            row={{
              ...w,
              // Map worker pool → sourcingChannel so V77.inferAxes
              // resolves to the right cell without a separate worker
              // mapper. Contractor → Direct (IC), Professional → SOW
              // (Pro = Assignment×Timesheet×Agency), everyone else
              // rolls up to the Frontline default cell.
              sourcingChannel:
                isContractor ? "Direct" :
                isProfessional ? "SOW" :
                (w.sourcingChannel || "Agency"),
            }}
            requisitionId={w.workerId || w.id}
          />
        ) : null}
        {/* ---- Hero ---- */}
        <section className="sup-hero">
          <WorkerAvatar w={w} size={140} />
          <div className="sup-hero-info">
            <span className={`req-pill req-pill--${statusHue}`}>{w.status}</span>
            <h1 className="sup-hero-name">{w.name}</h1>
            <ul className="sup-hero-meta">
              <li>
                {isContractor ? (
                  <React.Fragment>
                    <span>Contractor: </span>
                    <span className={`fi fi-${w.flag}`} aria-hidden="true" style={{ width: 18, height: 14, borderRadius: 2, marginRight: 4 }}></span>
                    <span style={{ fontWeight: "var(--evr-fw-demibold)" }}>{w.countryName}</span>
                    <span style={{ marginLeft: 8, color: "var(--evr-content-primary-lowemp)" }}>· {w.entity}</span>
                    <span
                      style={{
                        marginLeft: 8,
                        background: poolMeta.bg,
                        color: poolMeta.fg,
                        padding: "2px 10px",
                        borderRadius: "var(--evr-radius-circle)",
                        font: "var(--evr-utility2)",
                      }}
                    >Contractor</span>
                  </React.Fragment>
                ) : isProfessional ? (
                  <React.Fragment>
                    <span>Professional: </span>
                    <span className={`fi fi-${w.flag}`} aria-hidden="true" style={{ width: 18, height: 14, borderRadius: 2, marginRight: 4 }}></span>
                    <span style={{ fontWeight: "var(--evr-fw-demibold)" }}>{w.countryName}</span>
                    {sup && (
                      <React.Fragment>
                        <span style={{ marginLeft: 8, color: "var(--evr-content-primary-lowemp)" }}>· via </span>
                        <ReqSupplierChip id={w.supplier} size={18} />
                        <a
                          href="#"
                          className="wf-hero-suplink"
                          onClick={(e) => { e.preventDefault(); showToast(`Opening ${sup.label}`); }}
                        >{sup.label}</a>
                      </React.Fragment>
                    )}
                    <span
                      style={{
                        marginLeft: 8,
                        background: poolMeta.bg,
                        color: poolMeta.fg,
                        padding: "2px 10px",
                        borderRadius: "var(--evr-radius-circle)",
                        font: "var(--evr-utility2)",
                      }}
                    >Professional</span>
                  </React.Fragment>
                ) : sup ? (
                  <React.Fragment>
                    <span>Supplier: </span>
                    <ReqSupplierChip id={w.supplier} size={20} />
                    <a
                      href="#"
                      className="wf-hero-suplink"
                      onClick={(e) => { e.preventDefault(); showToast(`Opening ${sup.label}`); }}
                    >{sup.label}</a>
                  </React.Fragment>
                ) : w.pool === "Float" ? (
                  (() => {
                    const ind = (window.getIndustry && window.getIndustry()) || null;
                    const orgName = (ind && ind.name) || "Organization";
                    const orgInitials = orgName.split(/\s+/).slice(0, 2).map((p) => p[0]).join("").toUpperCase();
                    return (
                      <React.Fragment>
                        <span>Supplier: </span>
                        <span
                          className="wf-df-org-chip"
                          aria-hidden="true"
                          title={orgName}
                          style={Object.assign(
                            { width: 20, height: 20, fontSize: 10 },
                            ind && ind.accent ? { background: ind.accent } : null
                          )}
                        >
                          {orgInitials}
                        </span>
                        <a
                          href="#"
                          className="wf-hero-suplink"
                          onClick={(e) => { e.preventDefault(); showToast(`Opening ${orgName}`); }}
                        >{orgName}</a>
                        <a
                          href="#"
                          className="wf-hero-suplink wf-hero-suplink--df"
                          onClick={(e) => { e.preventDefault(); showToast(`Opening ${w.name} in Dayforce core`); }}
                          title="Synced from Dayforce core"
                        >
                          <Icon name="Refresh" size={12} />
                          Dayforce core
                        </a>
                        <span
                          style={{
                            marginLeft: 8,
                            background: poolMeta.bg,
                            color: poolMeta.fg,
                            padding: "2px 10px",
                            borderRadius: "var(--evr-radius-circle)",
                            font: "var(--evr-utility2)",
                          }}
                        >Float pool</span>
                      </React.Fragment>
                    );
                  })()
                ) : (
                  <React.Fragment>
                    <span>Talent pool: </span>
                    <WfPoolBadge pool={w.pool} size={20} />
                    <span style={{ color: poolMeta.fg, fontWeight: "var(--evr-fw-demibold)" }}>{poolMeta.label}</span>
                  </React.Fragment>
                )}
              </li>
              <li>
                <span>Worker ID: <span className="tabular">{w.workerId}</span></span>
                {w.workerId !== "—" && (
                  <button
                    type="button"
                    className="sup-copy-btn"
                    aria-label="Copy worker ID"
                    onClick={() => copyToClipboard(w.workerId, "Worker ID copied")}
                  >
                    <Icon name="Copy" size={14} />
                  </button>
                )}
              </li>
            </ul>
          </div>
        </section>

        {/* ---- Details (open by default) ---- */}
        <WfAccordionCard
          icon="Information"
          title="Details"
          subtitle="Contact and identification"
          defaultOpen
        >
          <WorkerDetailsBody w={w} />
        </WfAccordionCard>

        {/* ---- Lifecycle (Pro + direct-sourced Frontline only) ----
            Shows the active onboarding or offboarding catalog with
            progress + per-task status. Reads from the Lifecycle
            program card in Settings\u2192Configuration. Hidden for
            agency-sourced Frontline (their onboarding belongs to
            the agency) and for IC contractors (their lifecycle
            lives on the contractor detail page). */}
        {lifecycleAccordionVisible(w) && (
          <WfAccordionCard
            icon="PersonPlus"
            title={w.status === "Offboarding" || w.status === "Inactive" || w.status === "Terminated" ? "Offboarding" : "Onboarding"}
            subtitle={lifecycleKindFor(w) === "pro" ? "Professional engagement \u00b7 task catalog from Settings" : "Frontline direct sourcing \u00b7 task catalog from Settings"}
            defaultOpen={w.status === "Onboarding" || w.status === "Offboarding"}
          >
            <LifecycleTrackerBody w={w} />
          </WfAccordionCard>
        )}

        {/* ---- Engagements ---- 
            Phase 4 sub-bullet from the §02 plan + spec checklist's
            "Workforce profile → Engagements section". Lists every
            ContingentEngagement this worker has — past and present —
            and routes each row to the unified detail at
            /requisitions/:id. This is a SECTION INSIDE the profile,
            not a top-level tab on the Workforce hub (which would
            split the hub by engagement type — see the universal-
            scopes rule). The list is type-blind: agency Frontline
            shifts, Professional reqs, Contractor agreements, and
            SOW resource assignments all show side by side. */}
        <WfAccordionCard
          icon="Briefcase"
          title="Engagements"
          subtitle="Every requisition or engagement this worker is on — routes through the unified detail."
          defaultOpen
        >
          <WorkerEngagementsBody w={w} />
        </WfAccordionCard>

        {isContractor && CDS && (
          <CDS w={w} />
        )}

        {isProfessional && PDS && (
          <PDS w={w} />
        )}

        {isProEngagement && !isContractor && !isProfessional && (
          <WfAccordionCard
            icon="Document"
            title="Contract terms"
            subtitle="Statement of Work, billing cadence, and renewal."
            defaultOpen
          >
            <WfContractTermsBody w={w} />
          </WfAccordionCard>
        )}

        {!isContractor && !isProfessional && (
        <React.Fragment>
        {/* ---- Tenure & worker rights + Temp-to-perm conversion ----
            Only renders for agency-sourced workers (pool === "Agency"
            or "EOR"). Returns null for Internal / Float / Pool, so
            buyer-owned workers keep the original accordion stack. */}
        {window.AgencyTenureSections && (
          <window.AgencyTenureSections w={w} />
        )}

        {/* ---- Compliance & credentialing ---- */}
        <WfAccordionCard
          icon="ShieldPerson"
          title="Compliance & credentialing"
          subtitle="Industry credentials, verification sources, and renewal status"
          defaultOpen
        >
          <ComplianceBody w={w} />
        </WfAccordionCard>

        {/* ---- Performance ---- */}
        <WfAccordionCard
          icon="Performance"
          title="Performance"
          subtitle="Rating, on-time, reliability, and shift history"
          defaultOpen
        >
          <WorkerPerformanceBody w={w} />
        </WfAccordionCard>

        {/* ---- Schedule ---- */}
        <WfAccordionCard icon="Calendar" title="Schedule">
          <WfScheduleBody w={w} />
        </WfAccordionCard>

        {/* ---- Availability (T8) — agency-maintained, drives broadcast +
             assign eligibility via AssignmentEngine.availabilityFor ---- */}
        {(window.isAgencyOrg && window.isAgencyOrg() && window.flexViewAsRole === "agency") && (
          <WfAccordionCard icon="Calendar" title="Availability" subtitle="Days this worker can take shifts — read by the assign and broadcast flows" defaultOpen>
            <WfAvailabilityBody w={w} />
          </WfAccordionCard>
        )}

        {/* ---- Blocked locations (empty state with action) ---- */}
        <WfAccordionCard
          icon="Lock"
          title="Blocked sites"
          subtitle="Workers will not appear as available for shifts at these organizations."
          action={(
            <button
              type="button"
              className="btn btn--sm btn--secondary"
              onClick={(e) => openFilter(e.currentTarget, {
                title: "Block location",
                options: LOCATIONS.map((l) => ({ value: l.id, label: l.name })),
                onApply: (ids) => showToast(`Blocked ${ids.length} location${ids.length === 1 ? "" : "s"}`, { kind: "success" }),
              })}
            >
              <Icon name="AddCircle" size={14} />Add location
            </button>
          )}
        >
          <BlockedLocationsBody />
        </WfAccordionCard>
        </React.Fragment>
        )}

        {/* Professional hero pool — show the Pro chip + supplier (if any)
            alongside Worker ID. Most of the work happens via PDS above. */}

        {/* ---- Logs ---- */}
        <WfAccordionCard icon="TimeUndo" title="Logs">
          <WfLogsBody w={w} />
        </WfAccordionCard>
      </div>
      {editEntity.panel}
    </React.Fragment>
  );
}

// =====================================================================
// AGENCY BENCH (T7) + BULK ONBOARDING (T9) — shown atop Workforce for
// the agency role. The roster is already supplier-scoped; this adds the
// supply-side read (who's available to staff from) plus a bulk add-to-
// bench flow. Reuses AssignmentEngine availability/credential guards and
// the existing worker shape. Available to every agency (not Pro-gated).
// =====================================================================
function _wfBenchAdded() { try { return JSON.parse(window.localStorage.getItem("flexwork.agencyBench.added") || "[]"); } catch (e) { return []; } }
function _wfBenchSave(list) { try { window.localStorage.setItem("flexwork.agencyBench.added", JSON.stringify(list)); } catch (e) {} }

function WfBenchOnboardModal({ onClose, onAdded }) {
  const [names, setNames] = useStateWf("");
  const [role, setRole] = useStateWf("");
  const add = () => {
    const list = names.split(/\n+/).map((s) => s.trim()).filter(Boolean);
    if (!list.length) { (window.showToast || (() => {}))("Enter at least one name", { kind: "default" }); return; }
    const sup = (window.getAgencySupplierId && window.getAgencySupplierId()) || "sw";
    const added = _wfBenchAdded();
    const made = list.map((name, i) => ({ id: "bench-" + Date.now() + "-" + i, name, jobs: role ? [role] : ["Worker"], supplier: sup, pool: "Agency", status: "Onboarding", _benchAdded: true }));
    const next = added.concat(made);
    _wfBenchSave(next);
    try { if (Array.isArray(window.WORKERS)) made.forEach((w) => window.WORKERS.push(w)); } catch (e) {}
    (window.showToast || (() => {}))(made.length + " worker" + (made.length === 1 ? "" : "s") + " added to your bench · onboarding started", { kind: "success" });
    onAdded && onAdded();
    onClose();
  };
  return (
    <div className="aw-modal-scrim" onClick={onClose}>
      <div className="aw-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Onboard workers">
        <div className="aw-modal-h">
          <h3>Onboard workers to bench</h3>
          <button className="aw-x" onClick={onClose} aria-label="Close"><Icon name="Cancel" size={18} /></button>
        </div>
        <div className="aw-modal-body">
          <p className="aw-hint">Add multiple workers to your bench at once. One name per line. Each enters onboarding and becomes assignable once cleared.</p>
          <div className="aw-field">
            <label>Workers (one per line)</label>
            <textarea className="aw-textarea" value={names} onChange={(e) => setNames(e.target.value)} placeholder={"Jordan Avery\nSam Rivera\nPriya Khanna"} />
          </div>
          <div className="aw-field">
            <label>Role / job (optional)</label>
            <input className="aw-input" value={role} onChange={(e) => setRole(e.target.value)} placeholder="e.g. Production Associate" />
          </div>
        </div>
        <div className="aw-modal-foot">
          <button className="aw-btn aw-btn--ghost" onClick={onClose}>Cancel</button>
          <button className="aw-btn" onClick={add}>Add to bench</button>
        </div>
      </div>
    </div>
  );
}

// Bench stats row (rendered below the Workforce tabs) + a self-contained
// "Onboard workers" action (placed in the Workforce omnibar). Split so
// each can live in its native slot. Agency-gated.
function _wfBenchTally() {
  const eng = window.AssignmentEngine;
  const bench = (window.WORKERS || []);
  let avail = 0, limited = 0, unavail = 0, credWatch = 0;
  bench.forEach((w) => {
    let a = { level: "ok" }, c = { level: "ok" };
    try { if (eng && eng.availabilityFor) a = eng.availabilityFor(w, {}); } catch (e) {}
    try { if (eng && eng.credentialSummary) c = eng.credentialSummary(w); } catch (e) {}
    if (a.level === "fail") unavail++; else if (a.level === "warn") limited++; else avail++;
    if (c.level !== "ok") credWatch++;
  });
  return { total: bench.length, avail, limited, unavail, credWatch };
}

function WfBenchStats() {
  const isAgency = !!(window.isAgencyOrg && window.isAgencyOrg()) && window.flexViewAsRole === "agency";
  if (!isAgency) return null;
  const t = _wfBenchTally();
  return (
    <div className="aw-bench-statbar">
      <div className="aw-score" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
        <div className="aw-score-cell"><span className="aw-score-val">{t.total}</span><span className="aw-score-lab">Workers</span></div>
        <div className="aw-score-cell"><span className="aw-score-val">{t.avail}</span><span className="aw-score-lab">Available now</span></div>
        <div className="aw-score-cell"><span className="aw-score-val">{t.limited}</span><span className="aw-score-lab">On assignment</span></div>
        <div className="aw-score-cell"><span className="aw-score-val">{t.credWatch}</span><span className="aw-score-lab">Credential watch</span></div>
      </div>
    </div>
  );
}

function WfBenchOnboardButton() {
  const isAgency = !!(window.isAgencyOrg && window.isAgencyOrg()) && window.flexViewAsRole === "agency";
  const [open, setOpen] = useStateWf(false);
  const [, bump] = useStateWf(0);
  if (!isAgency) return null;
  return (
    <React.Fragment>
      <button type="button" className="btn btn--md btn--primary" onClick={() => setOpen(true)}>
        <Icon name="PersonPlus" size={16} />Onboard workers
      </button>
      {open && <WfBenchOnboardModal onClose={() => setOpen(false)} onAdded={() => bump((n) => n + 1)} />}
    </React.Fragment>
  );
}

// Availability editor (T8) — agency maintains which days a worker can
// work; persisted per worker. The assign / broadcast flows can read
// this as the source the availability guard reflects.
function WfAvailabilityBody({ w }) {
  const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const key = "flexwork.avail." + (w.id || w.name);
  const read = () => { try { return JSON.parse(window.localStorage.getItem(key) || "null") || { Mon: 1, Tue: 1, Wed: 1, Thu: 1, Fri: 1, Sat: 0, Sun: 0 }; } catch (e) { return { Mon: 1, Tue: 1, Wed: 1, Thu: 1, Fri: 1, Sat: 0, Sun: 0 }; } };
  const [days, setDays] = useStateWf(read);
  const toggle = (d) => setDays((prev) => { const n = { ...prev, [d]: prev[d] ? 0 : 1 }; try { window.localStorage.setItem(key, JSON.stringify(n)); } catch (e) {} return n; });
  const count = DAYS.filter((d) => days[d]).length;
  return (
    <div className="wf-details">
      <p style={{ margin: "0 0 12px", fontSize: 13.5, color: "var(--evr-content-primary-default)" }}>
        Set the days <b>{w.name}</b> can take shifts. Assign and broadcast only offer shifts on available days. <b>{count}/7</b> days available.
      </p>
      <div className="aw-avail">
        {DAYS.map((d) => (
          <button type="button" key={d} className="aw-avail-day" aria-pressed={!!days[d]} onClick={() => toggle(d)}>
            <b>{d}</b>{days[d] ? "Available" : "Off"}
          </button>
        ))}
      </div>
    </div>
  );
}

Object.assign(window, { WorkforcePage, WorkerDetailsPage, WORKERS, paletteFor, initialsFor, WorkerAvatar, POOL_META, POOL_ORDER, WfPoolBadge, WfStars, wfPerfFor, WfAccordionCard, WfBenchStats, WfBenchOnboardButton });
