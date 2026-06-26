// =====================================================================
// Flex Work — Credentialing
//
// Industry-aware credential management. Each industry pack defines:
//   · A credential catalog (what to track + cadences)
//   · A roster of in-pool workers with that pack's credentials populated
//   · Verification sources (PSV equivalent for the domain)
//   · The audit packet that the buyer cares about
//
//   healthcare    → RN/BLS/ACLS · State Board of Nursing PSV · NPDB · Joint Commission
//   hospitality   → TIPS/ServSafe/Allergen/Food handler · State ABC Board · Health Dept
//   retail        → Age 21+/Background/Drug screen/LP training · Sterling · Fair Workweek
//   manufacturing → OSHA-10/Forklift/LOTO/Respirator fit · OSHA card lookup · OSHA log
//   logistics     → CDL/DOT physical/HAZMAT/MVR · FMCSA PSP · DOT compliance
// =====================================================================

const { useState: useStateCr, useMemo: useMemoCr } = React;

const _crPaletteFor = (id) => (window.paletteFor || ((s) => ({ bg: "#A0AEC0", fg: "#1F1F23" })))(id);
const _crInitialsFor = (n) => (window.initialsFor || ((s) => (s || "").split(/\s+/).map((w) => w[0]).slice(0,2).join("").toUpperCase()))(n);

// ---------- Per-industry credentialing packs --------------------------
const CRED_PACKS = {

  // -------------------------------------------------------------------
  // HEALTHCARE — Mercy Health
  // -------------------------------------------------------------------
  healthcare: {
    omnibarTitle: "Credentialing",
    domain: {
      heroLabel: "Joint Commission survey · Thursday May 7",
      heroBody: "7 of 8 active nurses are credential-ready. 1 expired flu shot is auto-suspending bookings until renewed. PSV is current for all RN licenses; NPDB cycle is on schedule.",
      auditAction: "Joint Commission packet",
      psvAction: "Run PSV batch",
      psvToast: "PSV batch run started — 8 workers across CA Board of Registered Nursing",
      packetToast: "Joint Commission packet generated — see Downloads",
      sourceLabel: "Primary source",
      sourceName: "CA Board of Registered Nursing",
      sourceMeta: "Last verified Apr 22 2026 · automated daily",
      secondaryLabel: "NPDB",
      kpis: [
        { label: "Expired credentials", level: "err",  foot: "work assignments auto-suspended" },
        { label: "Expiring in 30 d",    level: "warn", foot: "renewal queue" },
        { label: "Missing documents",   level: "err",  foot: "cannot book" },
        { label: "In PSV review",       level: "info", foot: "state board API" },
        { label: "NPDB flags",          level: "warn", foot: "re-review pending" },
      ],
      workerLabel: "nurses",
      unitFilters: [
        { id: "icu",    label: "ICU + ED only" },
      ],
    },
    catalog: [
      { code: "license", label: "RN license",          cadence: "Per state",          required: "all" },
      { code: "bls",     label: "BLS",                 cadence: "2 yrs",              required: "all" },
      { code: "acls",    label: "ACLS",                cadence: "2 yrs",              required: "icu+ed" },
      { code: "pals",    label: "PALS",                cadence: "2 yrs",              required: "peds" },
      { code: "flu",     label: "Flu shot",            cadence: "Annual",             required: "all" },
      { code: "tb",      label: "TB test",             cadence: "Annual",             required: "all" },
      { code: "fit",     label: "N95 fit test",        cadence: "Annual",             required: "all" },
      { code: "drug",    label: "Drug screen",         cadence: "Hire + on-cause",    required: "all" },
      { code: "orient",  label: "Facility orientation",cadence: "Per facility",       required: "all" },
    ],
    workers: [
      { id: "h-pa", name: "Priya Aravind, RN",   unit: "Med-Surg", facility: "Mercy Medical Plaza", seniority: "5 yrs",  licenseNo: "CA-RN-0241893",
        creds: { license: { s: "ok", d: "Aug 14 2027", source: "PSV — CA Board verified Apr 22 2026" }, bls: { s: "ok", d: "Jun 02 2027", source: "AHA #BLS-94128" }, acls: { s: "na" }, pals: { s: "na" }, flu: { s: "ok", d: "Oct 15 2026" }, tb: { s: "ok", d: "Feb 28 2027" }, fit: { s: "warn", d: "May 11 2026", source: "18 d to expiry" }, drug: { s: "ok", d: "Aug 02 2025" }, orient: { s: "ok", d: "Floor 4 — Mar 12 2026" } },
        secondary: { status: "Clear", queried: "Mar 02 2026", next: "Mar 02 2027" } },
      { id: "h-jh", name: "Jordan Hsu, RN",      unit: "ICU",      facility: "Mercy Memorial",      seniority: "9 yrs",  licenseNo: "CA-RN-0188205",
        creds: { license: { s: "ok", d: "Jan 30 2028", source: "PSV — CA Board verified Apr 18 2026" }, bls: { s: "ok", d: "Nov 04 2027" }, acls: { s: "ok", d: "Nov 04 2027" }, pals: { s: "na" }, flu: { s: "ok", d: "Sep 24 2026" }, tb: { s: "ok", d: "Jun 14 2026" }, fit: { s: "ok", d: "Aug 30 2026" }, drug: { s: "ok", d: "Apr 08 2024" }, orient: { s: "ok", d: "ICU North — Jan 20 2026" } },
        secondary: { status: "Clear", queried: "Jan 12 2026", next: "Jan 12 2027" } },
      { id: "h-rd", name: "Rohan Desai, RN",     unit: "ED",       facility: "Mercy Memorial",      seniority: "3 yrs",  licenseNo: "CA-RN-0322114",
        creds: { license: { s: "review", d: "—", source: "PSV in queue — CA Board, est. 1 business day" }, bls: { s: "ok", d: "May 30 2026", source: "Expires in 37 d" }, acls: { s: "warn", d: "May 18 2026", source: "25 d to expiry — auto-suspend at 21 d" }, pals: { s: "na" }, flu: { s: "ok", d: "Nov 02 2026" }, tb: { s: "missing", d: "—", source: "Document never received" }, fit: { s: "ok", d: "Dec 07 2026" }, drug: { s: "ok", d: "Feb 18 2026" }, orient: { s: "ok", d: "ED — Feb 22 2026" } },
        secondary: { status: "Clear", queried: "Feb 18 2026", next: "Feb 18 2027" } },
      { id: "h-mw", name: "Maya Wallace, RN",    unit: "Peds",     facility: "Mercy Children's",    seniority: "7 yrs",  licenseNo: "CA-RN-0245687",
        creds: { license: { s: "ok", d: "Jul 11 2027" }, bls: { s: "ok", d: "Mar 22 2027" }, acls: { s: "na" }, pals: { s: "ok", d: "Apr 02 2027" }, flu: { s: "ok", d: "Oct 30 2026" }, tb: { s: "ok", d: "Sep 14 2026" }, fit: { s: "ok", d: "Jul 19 2026" }, drug: { s: "ok", d: "Mar 11 2025" }, orient: { s: "ok", d: "Peds 5 — Apr 04 2026" } },
        secondary: { status: "Clear", queried: "Mar 22 2026", next: "Mar 22 2027" } },
      { id: "h-sk", name: "Sasha Kowalski, RN",  unit: "Med-Surg", facility: "Mercy Medical Plaza", seniority: "1 yr",   licenseNo: "CA-RN-0401223",
        creds: { license: { s: "ok", d: "Sep 22 2027" }, bls: { s: "ok", d: "Sep 22 2027" }, acls: { s: "na" }, pals: { s: "na" }, flu: { s: "err", d: "Mar 03 2026", source: "Expired 51 d ago — bookings suspended" }, tb: { s: "ok", d: "Sep 22 2026" }, fit: { s: "ok", d: "Sep 22 2026" }, drug: { s: "ok", d: "Sep 22 2025" }, orient: { s: "warn", d: "Pending Floor 4 — booked Apr 28" } },
        secondary: { status: "Clear", queried: "Sep 22 2025", next: "Sep 22 2026" } },
      { id: "h-bf", name: "Ben Fielding, RN",    unit: "ICU",      facility: "Mercy Memorial",      seniority: "12 yrs", licenseNo: "CA-RN-0099471",
        creds: { license: { s: "ok", d: "Apr 19 2028" }, bls: { s: "ok", d: "Jul 30 2027" }, acls: { s: "ok", d: "Jul 30 2027" }, pals: { s: "na" }, flu: { s: "ok", d: "Oct 04 2026" }, tb: { s: "ok", d: "May 22 2026" }, fit: { s: "ok", d: "Nov 09 2026" }, drug: { s: "ok", d: "Jul 05 2024" }, orient: { s: "ok", d: "ICU North + South — Aug 11 2025" } },
        secondary: { status: "Match", queried: "Apr 19 2026", next: "Apr 19 2027", flag: "Pending review — non-clinical 2019 NPDB report; cleared at intake. Re-review on cycle." } },
      { id: "h-tg", name: "Teresa Gomez, RN",    unit: "ED",       facility: "Mercy Plaza South",   seniority: "4 yrs",  licenseNo: "CA-RN-0274089",
        creds: { license: { s: "ok", d: "Feb 11 2028" }, bls: { s: "ok", d: "Jan 06 2027" }, acls: { s: "ok", d: "Jan 06 2027" }, pals: { s: "na" }, flu: { s: "ok", d: "Oct 19 2026" }, tb: { s: "ok", d: "Aug 30 2026" }, fit: { s: "ok", d: "Oct 04 2026" }, drug: { s: "ok", d: "Jan 06 2025" }, orient: { s: "ok", d: "ED + Trauma — Mar 02 2024" } },
        secondary: { status: "Clear", queried: "Feb 11 2026", next: "Feb 11 2027" } },
      { id: "h-de", name: "Dana Ellsworth, LPN", unit: "Med-Surg", facility: "Mercy Medical Plaza", seniority: "2 yrs",  licenseNo: "CA-LPN-0117844",
        creds: { license: { s: "ok", d: "Dec 14 2026", source: "LPN — verified CA Board" }, bls: { s: "ok", d: "Oct 22 2026" }, acls: { s: "na" }, pals: { s: "na" }, flu: { s: "ok", d: "Oct 18 2026" }, tb: { s: "warn", d: "May 06 2026", source: "13 d to expiry" }, fit: { s: "ok", d: "Aug 14 2026" }, drug: { s: "ok", d: "Dec 14 2024" }, orient: { s: "ok", d: "Floor 4 — Dec 19 2024" } },
        secondary: { status: "Clear", queried: "Dec 14 2025", next: "Dec 14 2026" } },
    ],
  },

  // -------------------------------------------------------------------
  // HOSPITALITY — Aurora Hotels & Resorts
  // -------------------------------------------------------------------
  hospitality: {
    omnibarTitle: "Credentialing",
    domain: {
      heroLabel: "Saturday wedding · 240 guests · BEO #4187-A",
      heroBody: "12 of 14 banquet staff are bookable for service. 1 expired TIPS card (Charlie) is auto-suspending alcohol service tonight; 1 ServSafe expires in 14 d.",
      auditAction: "Health Dept packet",
      psvAction: "Verify alcohol perms",
      psvToast: "Cross-checking 14 active workers against State ABC Board + ServSafe registry",
      packetToast: "Health Dept packet generated — Aurora Resort Way property",
      sourceLabel: "Primary source",
      sourceName: "State Alcohol Beverage Control",
      sourceMeta: "Last verified Apr 22 2026 · TIPS + RBS registries",
      secondaryLabel: "Background check",
      kpis: [
        { label: "Expired credentials", level: "err",  foot: "blocks alcohol service" },
        { label: "Expiring in 30 d",    level: "warn", foot: "renewal nudges sent" },
        { label: "Missing documents",   level: "err",  foot: "cannot start shift" },
        { label: "Under 21 · alcohol",  level: "warn", foot: "no bar / liquor station" },
        { label: "Background pending",  level: "info", foot: "Sterling — in review" },
      ],
      workerLabel: "banquet staff",
      unitFilters: [
        { id: "bar",    label: "Bar / alcohol only" },
      ],
    },
    catalog: [
      { code: "license", label: "Right to work",      cadence: "Per visa",       required: "all" },
      { code: "tips",    label: "TIPS / RBS",         cadence: "3 yrs",          required: "alcohol" },
      { code: "servsafe",label: "ServSafe food",      cadence: "3 yrs",          required: "all" },
      { code: "fhandler",label: "Food handler",       cadence: "Annual",         required: "all" },
      { code: "allergen",label: "Allergen aware",     cadence: "2 yrs",          required: "all" },
      { code: "age21",   label: "Age 21+ verified",   cadence: "One-time",       required: "alcohol" },
      { code: "bg",      label: "Background check",   cadence: "Hire + 3 yrs",   required: "all" },
      { code: "orient",  label: "Property orientation",cadence: "Per property",  required: "all" },
    ],
    workers: [
      { id: "v-pr", name: "Priya Ramesh",     unit: "Banquet · plated",  facility: "Aurora Resort Way",   seniority: "5 yrs",  licenseNo: "CA-FHC-22841",
        creds: { license: { s: "ok", d: "—", source: "I-9 verified Aug 2023" }, tips: { s: "ok", d: "Sep 14 2027" }, servsafe: { s: "ok", d: "Jun 02 2027" }, fhandler: { s: "ok", d: "Mar 15 2027" }, allergen: { s: "ok", d: "Oct 19 2026" }, age21: { s: "ok", d: "DOB verified" }, bg: { s: "ok", d: "Aug 02 2025" }, orient: { s: "ok", d: "Resort Way — Mar 12 2026" } },
        secondary: { status: "Clear", queried: "Aug 02 2025", next: "Aug 02 2028" } },
      { id: "v-ja", name: "Jakob Aminoff",    unit: "Bartender",         facility: "Aurora Resort Way",   seniority: "7 yrs",  licenseNo: "CA-RBS-19401",
        creds: { license: { s: "ok", d: "—" }, tips: { s: "ok", d: "Nov 04 2028", source: "RBS + Sommelier L1" }, servsafe: { s: "ok", d: "Apr 18 2027" }, fhandler: { s: "ok", d: "Jan 30 2027" }, allergen: { s: "ok", d: "Apr 02 2026", source: "Expires in 11 d" }, age21: { s: "ok", d: "DOB verified" }, bg: { s: "ok", d: "Jan 12 2024" }, orient: { s: "ok", d: "Resort Way + Beach Club" } },
        secondary: { status: "Clear", queried: "Jan 12 2024", next: "Jan 12 2027" } },
      { id: "v-mh", name: "Makenna Herwitz",  unit: "Banquet · plated",  facility: "Aurora Resort Way",   seniority: "8 mo",   licenseNo: "WA-FHC-89812",
        creds: { license: { s: "ok", d: "—" }, tips: { s: "review", d: "—", source: "WA → CA reciprocity check in queue" }, servsafe: { s: "ok", d: "May 30 2027" }, fhandler: { s: "warn", d: "May 18 2026", source: "26 d to expiry — auto-suspend at 14 d" }, allergen: { s: "na" }, age21: { s: "ok", d: "DOB verified" }, bg: { s: "ok", d: "Feb 18 2026" }, orient: { s: "ok", d: "Resort Way — Feb 22 2026" } },
        secondary: { status: "Clear", queried: "Feb 18 2026", next: "Feb 18 2029" } },
      { id: "v-cc", name: "Charlie Carder",   unit: "Prep + plating",    facility: "Aurora Resort Way",   seniority: "1 yr",   licenseNo: "CA-FHC-30122",
        creds: { license: { s: "ok", d: "—" }, tips: { s: "err", d: "Mar 03 2026", source: "Expired 51 d ago — blocked from bar / liquor station" }, servsafe: { s: "ok", d: "Sep 22 2027" }, fhandler: { s: "ok", d: "Sep 22 2026" }, allergen: { s: "ok", d: "Sep 22 2026" }, age21: { s: "ok", d: "DOB verified" }, bg: { s: "ok", d: "Sep 22 2025" }, orient: { s: "warn", d: "Pending Beach Club — booked Apr 28" } },
        secondary: { status: "Clear", queried: "Sep 22 2025", next: "Sep 22 2028" } },
      { id: "v-ml", name: "Maya Lin",         unit: "Banquet · plated",  facility: "Aurora Resort Way",   seniority: "3 yrs",  licenseNo: "CA-FHC-15820",
        creds: { license: { s: "ok", d: "—" }, tips: { s: "ok", d: "May 30 2028" }, servsafe: { s: "ok", d: "Mar 22 2027" }, fhandler: { s: "ok", d: "Aug 19 2026" }, allergen: { s: "ok", d: "Oct 30 2026" }, age21: { s: "ok", d: "DOB verified" }, bg: { s: "ok", d: "Mar 11 2025" }, orient: { s: "ok", d: "Resort Way — Apr 04 2026" } },
        secondary: { status: "Clear", queried: "Mar 22 2026", next: "Mar 22 2029" } },
      { id: "v-ks", name: "Kierra Stanton",   unit: "Captain · plated",  facility: "Aurora Resort Way",   seniority: "12 yrs", licenseNo: "CA-RBS-08827",
        creds: { license: { s: "ok", d: "—" }, tips: { s: "ok", d: "Apr 19 2028" }, servsafe: { s: "ok", d: "Jul 30 2027", source: "ServSafe Manager — sup. of trainees" }, fhandler: { s: "ok", d: "May 22 2026" }, allergen: { s: "ok", d: "Oct 04 2026" }, age21: { s: "ok", d: "DOB verified" }, bg: { s: "ok", d: "Jul 05 2024" }, orient: { s: "ok", d: "All Aurora properties" } },
        secondary: { status: "Match", queried: "Jul 05 2024", next: "Jul 05 2027", flag: "2018 misdemeanor cleared at intake. Re-review on cycle." } },
      { id: "v-jg", name: "Jaxson Geidt",     unit: "Server",            facility: "Aurora Resort Way",   seniority: "5 mo",   licenseNo: "—",
        creds: { license: { s: "ok", d: "—" }, tips: { s: "na" }, servsafe: { s: "ok", d: "Jan 06 2027" }, fhandler: { s: "ok", d: "Oct 19 2026" }, allergen: { s: "ok", d: "Aug 30 2026" }, age21: { s: "missing", d: "—", source: "DOB on file is 19 — no bar shifts" }, bg: { s: "ok", d: "Jan 06 2025" }, orient: { s: "ok", d: "Resort Way — Mar 02 2026" } },
        secondary: { status: "Clear", queried: "Feb 11 2026", next: "Feb 11 2029" } },
      { id: "v-mw", name: "Marcus Webb",      unit: "Banquet · standby", facility: "Aurora Resort Way",   seniority: "2 yrs",  licenseNo: "CA-FHC-19942",
        creds: { license: { s: "ok", d: "—" }, tips: { s: "ok", d: "Oct 22 2026", source: "Expires in 6 mo" }, servsafe: { s: "ok", d: "Oct 18 2026" }, fhandler: { s: "ok", d: "Aug 14 2026" }, allergen: { s: "warn", d: "May 06 2026", source: "13 d to expiry" }, age21: { s: "ok", d: "DOB verified" }, bg: { s: "ok", d: "Dec 14 2024" }, orient: { s: "ok", d: "Resort Way — Dec 19 2024" } },
        secondary: { status: "Clear", queried: "Dec 14 2025", next: "Dec 14 2028" } },
    ],
  },

  // -------------------------------------------------------------------
  // RETAIL — Northwind
  // -------------------------------------------------------------------
  retail: {
    omnibarTitle: "Credentialing",
    domain: {
      heroLabel: "Black Friday weekend · 640 shifts · 40 stores",
      heroBody: "11 of 14 surge workers are credential-ready. 1 expired age verification is blocking liquor-aisle assignment; 1 Fair Workweek attestation expires in 14 d.",
      auditAction: "Fair Workweek packet",
      psvAction: "Re-run background checks",
      psvToast: "Background-check re-runs queued via Sterling — 14 workers",
      packetToast: "Fair Workweek compliance packet generated — NYC, SF, Seattle, Oregon, Chicago",
      sourceLabel: "Primary source",
      sourceName: "Sterling Background Check",
      sourceMeta: "Last verified Apr 22 2026 · automated on hire + every 3 yrs",
      secondaryLabel: "Predictive scheduling",
      kpis: [
        { label: "Expired credentials", level: "err",  foot: "blocks restricted aisles" },
        { label: "Expiring in 30 d",    level: "warn", foot: "renewal nudges sent" },
        { label: "Under 21 · liquor",   level: "warn", foot: "no liquor / tobacco assignment" },
        { label: "LP training overdue", level: "warn", foot: "no jewelry / electronics" },
        { label: "Fair Workweek docs",  level: "info", foot: "5 cities required" },
      ],
      workerLabel: "surge associates",
      unitFilters: [
        { id: "liquor", label: "Liquor / tobacco only" },
      ],
    },
    catalog: [
      { code: "license", label: "Right to work",      cadence: "Per visa",       required: "all" },
      { code: "age21",   label: "Age 21+ (liquor)",   cadence: "One-time",       required: "liquor" },
      { code: "age18",   label: "Age 18+ (tobacco)",  cadence: "One-time",       required: "tobacco" },
      { code: "bg",      label: "Background check",   cadence: "Hire + 3 yrs",   required: "all" },
      { code: "drug",    label: "Drug screen",        cadence: "Hire + on-cause",required: "all" },
      { code: "lp",      label: "Loss-prevention",    cadence: "Annual",         required: "all" },
      { code: "pos",     label: "POS certification",  cadence: "Per banner",     required: "all" },
      { code: "fww",     label: "Fair Workweek",      cadence: "Per state",      required: "NYC+SF+SEA+OR+CHI" },
    ],
    workers: [
      { id: "r-mw", name: "Marcus Webb",      unit: "Cashier · liquor", facility: "Northwind Flagship NYC", seniority: "3 yrs",  licenseNo: "—",
        creds: { license: { s: "ok", d: "—" }, age21: { s: "ok", d: "DOB verified" }, age18: { s: "ok", d: "DOB verified" }, bg: { s: "ok", d: "Aug 02 2025" }, drug: { s: "ok", d: "Aug 02 2025" }, lp: { s: "ok", d: "Apr 02 2027" }, pos: { s: "ok", d: "Flagship POS v6" }, fww: { s: "ok", d: "NYC — Apr 12 2026" } },
        secondary: { status: "Acknowledged", queried: "Apr 12 2026", next: "Apr 12 2027" } },
      { id: "r-aw", name: "Ada Watts",        unit: "Stock · electronics",facility: "Northwind Express SF",   seniority: "1 yr",   licenseNo: "—",
        creds: { license: { s: "ok", d: "—" }, age21: { s: "na" }, age18: { s: "ok", d: "DOB verified" }, bg: { s: "ok", d: "Feb 02 2026" }, drug: { s: "ok", d: "Feb 02 2026" }, lp: { s: "warn", d: "May 11 2026", source: "Expires in 18 d — no electronics shifts after" }, pos: { s: "ok", d: "Express POS v4" }, fww: { s: "ok", d: "SF — Apr 02 2026" } },
        secondary: { status: "Acknowledged", queried: "Apr 02 2026", next: "Apr 02 2027" } },
      { id: "r-cc", name: "Charlie Carder",   unit: "Cashier · liquor", facility: "Northwind Outlet PHX",   seniority: "8 mo",   licenseNo: "—",
        creds: { license: { s: "ok", d: "—" }, age21: { s: "err", d: "—", source: "DOB on file is 20 — no liquor aisle until Aug 17" }, age18: { s: "ok", d: "DOB verified" }, bg: { s: "ok", d: "Sep 22 2025" }, drug: { s: "ok", d: "Sep 22 2025" }, lp: { s: "ok", d: "Sep 22 2026" }, pos: { s: "ok", d: "Outlet POS v3" }, fww: { s: "na" } },
        secondary: { status: "Acknowledged", queried: "Sep 22 2025", next: "Sep 22 2026" } },
      { id: "r-mh", name: "Makenna Herwitz",  unit: "Cashier",          facility: "Northwind Flagship SEA", seniority: "2 yrs",  licenseNo: "—",
        creds: { license: { s: "ok", d: "—" }, age21: { s: "ok", d: "DOB verified" }, age18: { s: "ok", d: "DOB verified" }, bg: { s: "ok", d: "Feb 18 2026" }, drug: { s: "ok", d: "Feb 18 2026" }, lp: { s: "ok", d: "Dec 07 2026" }, pos: { s: "ok", d: "Flagship POS v6" }, fww: { s: "warn", d: "May 06 2026", source: "Seattle attestation expires in 13 d" } },
        secondary: { status: "Acknowledged", queried: "Feb 18 2026", next: "Feb 18 2027" } },
      { id: "r-jg", name: "Jaxson Geidt",     unit: "Cashier",          facility: "Northwind Express PDX",  seniority: "5 mo",   licenseNo: "—",
        creds: { license: { s: "ok", d: "—" }, age21: { s: "missing", d: "—", source: "DOB pending I-9 review" }, age18: { s: "ok", d: "DOB verified" }, bg: { s: "review", d: "—", source: "Sterling — pending county record" }, drug: { s: "ok", d: "Jan 14 2026" }, lp: { s: "ok", d: "Jan 14 2027" }, pos: { s: "ok", d: "Express POS v4" }, fww: { s: "ok", d: "OR — Apr 11 2026" } },
        secondary: { status: "Pending", queried: "Apr 11 2026", next: "—" } },
      { id: "r-ml", name: "Maya Lin",         unit: "Cashier · liquor", facility: "Northwind Flagship NYC", seniority: "4 yrs",  licenseNo: "—",
        creds: { license: { s: "ok", d: "—" }, age21: { s: "ok", d: "DOB verified" }, age18: { s: "ok", d: "DOB verified" }, bg: { s: "ok", d: "Mar 11 2024" }, drug: { s: "ok", d: "Mar 11 2024" }, lp: { s: "ok", d: "Oct 30 2026" }, pos: { s: "ok", d: "Flagship POS v6" }, fww: { s: "ok", d: "NYC — Apr 12 2026" } },
        secondary: { status: "Acknowledged", queried: "Mar 22 2026", next: "Mar 22 2027" } },
      { id: "r-pr", name: "Priya Ramesh",     unit: "Stock + jewelry",  facility: "Northwind Flagship CHI", seniority: "6 yrs",  licenseNo: "—",
        creds: { license: { s: "ok", d: "—" }, age21: { s: "ok", d: "DOB verified" }, age18: { s: "ok", d: "DOB verified" }, bg: { s: "ok", d: "Aug 02 2024" }, drug: { s: "ok", d: "Aug 02 2024" }, lp: { s: "ok", d: "Apr 02 2027" }, pos: { s: "ok", d: "Flagship POS v6" }, fww: { s: "ok", d: "Chicago — Apr 02 2026" } },
        secondary: { status: "Acknowledged", queried: "Apr 02 2026", next: "Apr 02 2027" } },
    ],
  },

  // -------------------------------------------------------------------
  // MANUFACTURING — Atlas
  // -------------------------------------------------------------------
  manufacturing: {
    omnibarTitle: "Credentialing",
    domain: {
      heroLabel: "OSHA quarterly audit · Friday May 15",
      heroBody: "12 of 14 line workers are fully cleared. 1 expired forklift cert (Marcus) is auto-suspending power-equipment shifts; 1 LOTO refresher expires in 14 d.",
      auditAction: "OSHA log packet",
      psvAction: "Verify OSHA cards",
      psvToast: "Verifying 14 worker OSHA card numbers against OSHA Outreach Trainer Portal",
      packetToast: "OSHA 300 log packet generated for Plant #02",
      sourceLabel: "Primary source",
      sourceName: "OSHA Outreach Trainer Portal",
      sourceMeta: "Card lookups verified Apr 22 2026 · daily reconciliation",
      secondaryLabel: "Background check",
      kpis: [
        { label: "Expired certs",       level: "err",  foot: "blocks power equipment" },
        { label: "Expiring in 30 d",    level: "warn", foot: "renewal scheduled" },
        { label: "Missing PPE issuance",level: "err",  foot: "cannot enter floor" },
        { label: "Fit-test overdue",    level: "warn", foot: "no respirator zones" },
        { label: "Drug screen pending", level: "info", foot: "pre-shift required" },
      ],
      workerLabel: "line workers",
      unitFilters: [
        { id: "lift",   label: "Forklift / power eq" },
      ],
    },
    catalog: [
      { code: "license", label: "Right to work",      cadence: "Per visa",       required: "all" },
      { code: "osha",    label: "OSHA-10",            cadence: "5 yrs",          required: "all" },
      { code: "osha30",  label: "OSHA-30",            cadence: "5 yrs",          required: "lead" },
      { code: "forklift",label: "Forklift cert",      cadence: "3 yrs",          required: "lift" },
      { code: "loto",    label: "Lockout / tagout",   cadence: "Annual",         required: "all" },
      { code: "fit",     label: "Respirator fit",     cadence: "Annual",         required: "all" },
      { code: "ppe",     label: "PPE issued",         cadence: "Per assignment", required: "all" },
      { code: "drug",    label: "Drug screen",        cadence: "Hire + on-cause",required: "all" },
    ],
    workers: [
      { id: "m-mw", name: "Marcus Webb",      unit: "Operator · lift",   facility: "Atlas Plant #02",         seniority: "4 yrs",  licenseNo: "OSHA-10 #B-2841",
        creds: { license: { s: "ok", d: "—" }, osha: { s: "ok", d: "Aug 14 2028" }, osha30: { s: "na" }, forklift: { s: "err", d: "Feb 18 2026", source: "Expired 64 d ago — auto-suspended from power-equipment shifts" }, loto: { s: "ok", d: "Oct 15 2026" }, fit: { s: "ok", d: "Feb 28 2027" }, ppe: { s: "ok", d: "Plant #02 — Mar 12 2026" }, drug: { s: "ok", d: "Aug 02 2025" } },
        secondary: { status: "Clear", queried: "Aug 02 2025", next: "Aug 02 2028" } },
      { id: "m-ja", name: "Jamal Carter",     unit: "Line Manager",      facility: "Atlas Plant #02",         seniority: "9 yrs",  licenseNo: "OSHA-30 #B-1102",
        creds: { license: { s: "ok", d: "—" }, osha: { s: "ok", d: "Jan 30 2029" }, osha30: { s: "ok", d: "Jan 30 2029" }, forklift: { s: "ok", d: "Nov 04 2028" }, loto: { s: "ok", d: "Sep 24 2026" }, fit: { s: "ok", d: "Jun 14 2026" }, ppe: { s: "ok", d: "All Atlas sites" }, drug: { s: "ok", d: "Apr 08 2024" } },
        secondary: { status: "Clear", queried: "Jan 12 2026", next: "Jan 12 2029" } },
      { id: "m-aw", name: "Ada Watts",        unit: "Assembler",         facility: "Atlas Plant #02",         seniority: "1 yr",   licenseNo: "—",
        creds: { license: { s: "ok", d: "—" }, osha: { s: "review", d: "—", source: "OSHA card lookup queued — est. 24 h" }, osha30: { s: "na" }, forklift: { s: "na" }, loto: { s: "ok", d: "May 30 2026", source: "Expires in 37 d" }, fit: { s: "warn", d: "May 18 2026", source: "26 d to expiry" }, ppe: { s: "missing", d: "—", source: "Steel-toe boots not yet issued" }, drug: { s: "ok", d: "Feb 18 2026" } },
        secondary: { status: "Clear", queried: "Feb 18 2026", next: "Feb 18 2029" } },
      { id: "m-pr", name: "Priya Ramesh",     unit: "Inspector",         facility: "Atlas Plant #04",         seniority: "5 yrs",  licenseNo: "OSHA-10 #B-3091",
        creds: { license: { s: "ok", d: "—" }, osha: { s: "ok", d: "Jul 11 2028" }, osha30: { s: "na" }, forklift: { s: "na" }, loto: { s: "ok", d: "Mar 22 2027" }, fit: { s: "ok", d: "Oct 30 2026" }, ppe: { s: "ok", d: "Plant #04 — Apr 04 2026" }, drug: { s: "ok", d: "Mar 11 2025" } },
        secondary: { status: "Clear", queried: "Mar 22 2026", next: "Mar 22 2029" } },
      { id: "m-cc", name: "Charlie Carder",   unit: "Operator",          facility: "Atlas Plant #02",         seniority: "1 yr",   licenseNo: "OSHA-10 #B-4012",
        creds: { license: { s: "ok", d: "—" }, osha: { s: "ok", d: "Sep 22 2028" }, osha30: { s: "na" }, forklift: { s: "ok", d: "Sep 22 2028" }, loto: { s: "err", d: "Mar 03 2026", source: "Expired 51 d ago — no LOTO zones" }, fit: { s: "ok", d: "Sep 22 2026" }, ppe: { s: "ok", d: "Plant #02 — Sep 22 2025" }, drug: { s: "ok", d: "Sep 22 2025" } },
        secondary: { status: "Clear", queried: "Sep 22 2025", next: "Sep 22 2028" } },
      { id: "m-bf", name: "Ben Fielding",     unit: "Lead operator",     facility: "Atlas Plant #02",         seniority: "12 yrs", licenseNo: "OSHA-30 #B-0991",
        creds: { license: { s: "ok", d: "—" }, osha: { s: "ok", d: "Apr 19 2029" }, osha30: { s: "ok", d: "Apr 19 2029" }, forklift: { s: "ok", d: "Jul 30 2028" }, loto: { s: "ok", d: "Oct 04 2026" }, fit: { s: "ok", d: "May 22 2026" }, ppe: { s: "ok", d: "All Atlas sites — Aug 11 2025" }, drug: { s: "ok", d: "Jul 05 2024" } },
        secondary: { status: "Clear", queried: "Jul 05 2024", next: "Jul 05 2027" } },
      { id: "m-tg", name: "Teresa Gomez",     unit: "QC inspector",      facility: "Atlas Plant #04",         seniority: "4 yrs",  licenseNo: "OSHA-10 #B-2740",
        creds: { license: { s: "ok", d: "—" }, osha: { s: "ok", d: "Feb 11 2029" }, osha30: { s: "na" }, forklift: { s: "na" }, loto: { s: "ok", d: "Jan 06 2027" }, fit: { s: "ok", d: "Aug 30 2026" }, ppe: { s: "ok", d: "Plant #04 — Mar 02 2024" }, drug: { s: "ok", d: "Jan 06 2025" } },
        secondary: { status: "Clear", queried: "Feb 11 2026", next: "Feb 11 2029" } },
      { id: "m-de", name: "Dana Ellsworth",   unit: "Picker",            facility: "Atlas Plant #02",         seniority: "2 yrs",  licenseNo: "OSHA-10 #B-1178",
        creds: { license: { s: "ok", d: "—" }, osha: { s: "ok", d: "Dec 14 2028" }, osha30: { s: "na" }, forklift: { s: "ok", d: "Oct 22 2027" }, loto: { s: "ok", d: "Oct 18 2026" }, fit: { s: "warn", d: "May 06 2026", source: "13 d to expiry" }, ppe: { s: "ok", d: "Plant #02 — Dec 19 2024" }, drug: { s: "ok", d: "Dec 14 2024" } },
        secondary: { status: "Clear", queried: "Dec 14 2025", next: "Dec 14 2028" } },
    ],
  },

  // -------------------------------------------------------------------
  // LOGISTICS — Midland
  // -------------------------------------------------------------------
  logistics: {
    omnibarTitle: "Credentialing",
    domain: {
      heroLabel: "DOT compliance review · Tuesday May 12",
      heroBody: "11 of 14 drivers are fully cleared. 1 expired DOT physical is auto-suspending route assignment; 1 HAZMAT endorsement expires in 14 d.",
      auditAction: "DOT compliance packet",
      psvAction: "Run FMCSA PSP",
      psvToast: "FMCSA Pre-employment Screening Program queries queued — 14 drivers",
      packetToast: "DOT compliance packet generated — Midland fleet",
      sourceLabel: "Primary source",
      sourceName: "FMCSA Pre-employment Screening",
      sourceMeta: "Last queried Apr 22 2026 · MVR + crash history",
      secondaryLabel: "Drug & alcohol",
      kpis: [
        { label: "Expired credentials", level: "err",  foot: "blocks route assignment" },
        { label: "Expiring in 30 d",    level: "warn", foot: "renewal scheduled" },
        { label: "DOT physical due",    level: "warn", foot: "exam window open" },
        { label: "MVR violations",      level: "info", foot: "re-review pending" },
        { label: "HAZMAT endorsements", level: "info", foot: "for tanker routes" },
      ],
      workerLabel: "drivers",
      unitFilters: [
        { id: "hazmat", label: "HAZMAT only" },
      ],
    },
    catalog: [
      { code: "license", label: "Right to work",      cadence: "Per visa",       required: "all" },
      { code: "cdl",     label: "CDL Class A",        cadence: "Per state",      required: "all" },
      { code: "dotphys", label: "DOT physical",       cadence: "2 yrs",          required: "all" },
      { code: "hazmat",  label: "HAZMAT endorsement", cadence: "5 yrs",          required: "hazmat" },
      { code: "mvr",     label: "MVR clean",          cadence: "Annual",         required: "all" },
      { code: "drug",    label: "Drug screen (DOT)",  cadence: "Random + cause", required: "all" },
      { code: "forklift",label: "Forklift cert",      cadence: "3 yrs",          required: "yard" },
      { code: "orient",  label: "Yard orientation",   cadence: "Per terminal",   required: "all" },
    ],
    workers: [
      { id: "l-mw", name: "Marcus Webb",      unit: "Driver · HAZMAT",   facility: "Midland Terminal SLC",  seniority: "5 yrs",  licenseNo: "CDL-A CO-2841",
        creds: { license: { s: "ok", d: "—" }, cdl: { s: "ok", d: "Aug 14 2027" }, dotphys: { s: "err", d: "Mar 03 2026", source: "Expired 51 d ago — auto-suspended" }, hazmat: { s: "ok", d: "Jul 11 2028" }, mvr: { s: "ok", d: "Oct 15 2026" }, drug: { s: "ok", d: "Feb 28 2026" }, forklift: { s: "ok", d: "Jul 30 2027" }, orient: { s: "ok", d: "SLC — Mar 12 2026" } },
        secondary: { status: "Clear", queried: "Aug 02 2025", next: "Aug 02 2026" } },
      { id: "l-ja", name: "Jamal Carter",     unit: "Driver · Class A",  facility: "Midland Terminal DEN",  seniority: "11 yrs", licenseNo: "CDL-A CO-1102",
        creds: { license: { s: "ok", d: "—" }, cdl: { s: "ok", d: "Jan 30 2028" }, dotphys: { s: "ok", d: "Nov 04 2027" }, hazmat: { s: "na" }, mvr: { s: "ok", d: "Sep 24 2026" }, drug: { s: "ok", d: "Jun 14 2026" }, forklift: { s: "ok", d: "Aug 30 2027" }, orient: { s: "ok", d: "DEN + SLC" } },
        secondary: { status: "Clear", queried: "Jan 12 2026", next: "Jan 12 2027" } },
      { id: "l-aw", name: "Ada Watts",        unit: "Driver · Class A",  facility: "Midland Terminal SLC",  seniority: "10 mo",  licenseNo: "CDL-A UT-7891",
        creds: { license: { s: "ok", d: "—" }, cdl: { s: "ok", d: "Aug 18 2027" }, dotphys: { s: "review", d: "—", source: "Annual physical scheduled May 6" }, hazmat: { s: "na" }, mvr: { s: "warn", d: "May 18 2026", source: "26 d to expiry — pull new" }, drug: { s: "ok", d: "Dec 07 2025" }, forklift: { s: "missing", d: "—", source: "Yard cert never issued" }, orient: { s: "ok", d: "SLC — Feb 22 2026" } },
        secondary: { status: "Clear", queried: "Feb 18 2026", next: "Feb 18 2027" } },
      { id: "l-pr", name: "Priya Ramesh",     unit: "Driver · HAZMAT",   facility: "Midland Terminal PHX",  seniority: "6 yrs",  licenseNo: "CDL-A AZ-4421",
        creds: { license: { s: "ok", d: "—" }, cdl: { s: "ok", d: "Jul 11 2027" }, dotphys: { s: "ok", d: "Mar 22 2027" }, hazmat: { s: "warn", d: "May 06 2026", source: "13 d to expiry" }, mvr: { s: "ok", d: "Oct 30 2026" }, drug: { s: "ok", d: "Mar 11 2026" }, forklift: { s: "ok", d: "Apr 04 2027" }, orient: { s: "ok", d: "PHX — Apr 04 2026" } },
        secondary: { status: "Clear", queried: "Mar 22 2026", next: "Mar 22 2027" } },
      { id: "l-cc", name: "Charlie Carder",   unit: "Driver · Class B",  facility: "Midland Terminal DEN",  seniority: "1 yr",   licenseNo: "CDL-B CO-3014",
        creds: { license: { s: "ok", d: "—" }, cdl: { s: "ok", d: "Sep 22 2027" }, dotphys: { s: "ok", d: "Sep 22 2027" }, hazmat: { s: "na" }, mvr: { s: "ok", d: "Mar 03 2027", source: "1 minor violation — within policy" }, drug: { s: "ok", d: "Sep 22 2025" }, forklift: { s: "ok", d: "Sep 22 2026" }, orient: { s: "warn", d: "Pending PHX — booked Apr 28" } },
        secondary: { status: "Clear", queried: "Sep 22 2025", next: "Sep 22 2026" } },
      { id: "l-bf", name: "Ben Fielding",     unit: "Lead driver",       facility: "Midland Terminal SLC",  seniority: "14 yrs", licenseNo: "CDL-A UT-0991",
        creds: { license: { s: "ok", d: "—" }, cdl: { s: "ok", d: "Apr 19 2028" }, dotphys: { s: "ok", d: "Jul 30 2027" }, hazmat: { s: "ok", d: "Jul 30 2030" }, mvr: { s: "ok", d: "Oct 04 2026" }, drug: { s: "ok", d: "May 22 2026" }, forklift: { s: "ok", d: "Nov 09 2027" }, orient: { s: "ok", d: "All Midland sites" } },
        secondary: { status: "Match", queried: "Apr 19 2026", next: "Apr 19 2027", flag: "2017 non-CMV violation cleared at intake. Re-review on cycle." } },
      { id: "l-tg", name: "Teresa Gomez",     unit: "Driver · Class A",  facility: "Midland Terminal PHX",  seniority: "4 yrs",  licenseNo: "CDL-A AZ-2740",
        creds: { license: { s: "ok", d: "—" }, cdl: { s: "ok", d: "Feb 11 2028" }, dotphys: { s: "ok", d: "Jan 06 2027" }, hazmat: { s: "na" }, mvr: { s: "ok", d: "Oct 19 2026" }, drug: { s: "ok", d: "Aug 30 2026" }, forklift: { s: "ok", d: "Oct 04 2026" }, orient: { s: "ok", d: "PHX + Trauma — Mar 02 2024" } },
        secondary: { status: "Clear", queried: "Feb 11 2026", next: "Feb 11 2027" } },
      { id: "l-de", name: "Dana Ellsworth",   unit: "Yard · forklift",   facility: "Midland Terminal DEN",  seniority: "2 yrs",  licenseNo: "—",
        creds: { license: { s: "ok", d: "—" }, cdl: { s: "na" }, dotphys: { s: "na" }, hazmat: { s: "na" }, mvr: { s: "na" }, drug: { s: "ok", d: "Dec 14 2024" }, forklift: { s: "ok", d: "Oct 22 2027" }, orient: { s: "ok", d: "DEN — Dec 19 2024" } },
        secondary: { status: "Clear", queried: "Dec 14 2025", next: "Dec 14 2026" } },
    ],
  },

};

// ---------- Helpers ---------------------------------------------------
function _crGetPack() {
  const id = (window.getCurrentIndustryId && window.getCurrentIndustryId()) || "manufacturing";
  const basePack = CRED_PACKS[id] || CRED_PACKS.manufacturing;
  // Apply per-(industry, country) localization so the credential matrix,
  // primary source labels, audit / PSV CTAs, and license-number prefixes
  // reflect the active country. US uses the baseline pack untouched.
  const country = (window.getCurrentCountry && window.getCurrentCountry()) || null;
  if (country && country.code !== "US" && typeof window.localizeCredPack === "function") {
    return window.localizeCredPack(basePack, id, country.code);
  }
  return basePack;
}

function crChipClass(s) {
  return ({ ok: "cr-chip--ok", warn: "cr-chip--warn", err: "cr-chip--err", missing: "cr-chip--missing", review: "cr-chip--review", na: "cr-chip--na" })[s] || "cr-chip--na";
}
function crChipText(s) {
  return ({ ok: "Valid", warn: "Expiring", err: "Expired", missing: "Missing", review: "In review", na: "n/a" })[s] || "—";
}

// ---------- KPI tile --------------------------------------------------
function CrKpi({ label, value, level, foot }) {
  return (
    <div className={"vms-kpi" + (level === "err" ? " vms-kpi--alert" : "")}>
      <span className="vms-kpi-label">{label}</span>
      <span className="vms-kpi-value tabular">{value}</span>
      <span className="vms-kpi-foot"><span>{foot}</span></span>
    </div>
  );
}

// ---------- Matrix row ------------------------------------------------
function CrMatrixRow({ worker, catalog, selected, onSelect }) {
  const palette = _crPaletteFor(worker.id);
  return (
    <div
      className="cr-row"
      aria-selected={selected}
      onClick={() => onSelect(worker.id)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onSelect(worker.id); }}
    >
      <div className="cr-row-worker">
        <span className="sup-avatar" style={{ background: palette.bg, color: palette.fg, width: 32, height: 32, fontSize: 12 }}>
          {_crInitialsFor(worker.name)}
        </span>
        <div>
          <div className="cr-row-worker-name">{worker.name}</div>
          <div className="cr-row-worker-sub">{worker.unit} · {worker.facility}</div>
        </div>
      </div>
      <div className="cr-row-cells">
        {catalog.map((cred) => {
          const c = worker.creds[cred.code] || { s: "na" };
          return (
            <div key={cred.code} className="cr-cell">
              <span className={"cr-chip " + crChipClass(c.s)}>
                <span className="cr-chip-status">{crChipText(c.s)}</span>
                {c.d && c.s !== "na" && c.d !== "—" && <span className="cr-chip-date">{c.d}</span>}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------- Side detail panel ----------------------------------------
function CrDetailPanel({ worker, pack }) {
  if (!worker) {
    return (
      <div className="cr-panel">
        <div style={{ textAlign: "center", padding: "32px 16px" }}>
          <Icon name="ShieldPerson" size={32} />
          <p style={{ font: "var(--evr-body2-bold)", marginTop: 12 }}>Select a {pack.domain.workerLabel.replace(/s$/, "")}</p>
          <p style={{ font: "var(--evr-caption)", color: "var(--evr-content-primary-lowemp)", marginTop: 4 }}>
            View their full credential timeline and verification status.
          </p>
        </div>
      </div>
    );
  }

  const events = [];
  pack.catalog.forEach((cred) => {
    const c = worker.creds[cred.code] || {};
    if (c.s === "na") return;
    const dotLevel = c.s === "err" ? "err" : c.s === "warn" ? "warn" : c.s === "missing" ? "err" : c.s === "review" ? "info" : "ok";
    events.push({
      title: cred.label,
      sub:   c.source || (c.s === "ok" ? `Valid until ${c.d}` : "Status pending"),
      date:  c.s === "ok" ? c.d : crChipText(c.s),
      level: dotLevel,
    });
  });

  const palette = _crPaletteFor(worker.id);
  return (
    <div className="cr-panel">
      <div className="cr-panel-head">
        <span className="sup-avatar" style={{ background: palette.bg, color: palette.fg, width: 44, height: 44, fontSize: 14 }}>
          {_crInitialsFor(worker.name)}
        </span>
        <div>
          <h3>{worker.name}</h3>
          <div className="cr-panel-meta">{worker.unit} · {worker.facility} · {worker.seniority}</div>
          {worker.licenseNo && worker.licenseNo !== "—" && <div className="cr-panel-meta">{worker.licenseNo}</div>}
        </div>
      </div>

      <div className="cr-panel-section">
        <div className="cr-panel-section-title">Verification sources</div>
        <div className="cr-source">
          <div className="cr-source-card">
            <div className="label">{pack.domain.sourceLabel}</div>
            <div className="val">{pack.domain.sourceName}</div>
            <div className="sub">{pack.domain.sourceMeta}</div>
          </div>
          <div className="cr-source-card">
            <div className="label">{pack.domain.secondaryLabel} · {worker.secondary.status}</div>
            <div className="val">{worker.secondary.queried}</div>
            <div className="sub">Next query {worker.secondary.next}</div>
            {worker.secondary.flag && (
              <p style={{ font: "var(--evr-caption)", color: "var(--evr-yellow-700)", marginTop: 8 }}>
                {worker.secondary.flag}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="cr-panel-section">
        <div className="cr-panel-section-title">Credential timeline</div>
        <ul className="cr-timeline">
          {events.map((e, i) => (
            <li key={i}>
              <span className={"cr-timeline-dot cr-timeline-dot--" + e.level} />
              <div className="cr-timeline-body">
                <b>{e.title}</b>
                <span>{e.sub}</span>
              </div>
              <span className="cr-timeline-date">{e.date}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="cr-panel-section" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button type="button" className="vms-btn vms-btn--primary" onClick={() => showToast("Renewal reminder sent")}>
          <Icon name="Send" size={14} />Send renewal reminder
        </button>
        <button type="button" className="vms-btn vms-btn--secondary" onClick={() => showToast(`Re-running ${pack.domain.sourceLabel.toLowerCase()} against ${pack.domain.sourceName}`)}>
          <Icon name="Refresh" size={14} />Re-verify
        </button>
        <button type="button" className="vms-btn vms-btn--secondary" onClick={() => showToast(pack.domain.psvToast)}>
          <Icon name="ShieldPerson" size={14} />{pack.domain.psvAction}
        </button>
      </div>
    </div>
  );
}

// ---------- Page ------------------------------------------------------
function CredentialingPage({ reloadKey, onReload, embedded = false }) {
  const pack = _crGetPack();
  const [selectedId, setSelectedId] = useStateCr(pack.workers[0].id);
  const [filter, setFilter] = useStateCr("all");

  // If the industry changes between renders (rare), re-anchor the selection.
  if (!pack.workers.find((w) => w.id === selectedId)) {
    setSelectedId(pack.workers[0].id);
  }

  const counts = useMemoCr(() => {
    let expired = 0, warn = 0, missing = 0, review = 0, secondaryFlag = 0;
    pack.workers.forEach((w) => {
      Object.values(w.creds).forEach((c) => {
        if (c.s === "err") expired++;
        if (c.s === "warn") warn++;
        if (c.s === "missing") missing++;
        if (c.s === "review") review++;
      });
      if (w.secondary && w.secondary.status !== "Clear" && w.secondary.status !== "Acknowledged") secondaryFlag++;
    });
    return { expired, warn, missing, review, secondaryFlag };
  }, [pack]);

  // The five KPI values are derived from real counts. The KPI labels and
  // foot copy come from the industry pack so the demo reads correctly.
  const kpiValues = [counts.expired, counts.warn, counts.missing, counts.review, counts.secondaryFlag];

  const filtered = useMemoCr(() => {
    if (filter === "all") return pack.workers;
    return pack.workers.filter((w) => {
      const states = Object.values(w.creds).map((c) => c.s);
      if (filter === "expired") return states.includes("err");
      if (filter === "expiring") return states.includes("warn");
      if (filter === "missing") return states.includes("missing") || states.includes("review");
      // Industry-specific filter — last entry in unitFilters
      const unitFilter = pack.domain.unitFilters.find((u) => u.id === filter);
      if (unitFilter) {
        const needle = filter; // "icu" / "bar" / "liquor" / "lift" / "hazmat"
        return (w.unit || "").toLowerCase().includes(needle === "icu" ? "icu" : needle === "bar" ? "bar" : needle === "liquor" ? "liquor" : needle === "lift" ? "lift" : "hazmat") ||
               (w.unit || "").toLowerCase().includes("ed") && needle === "icu";
      }
      return true;
    });
  }, [filter, pack]);

  const selected = pack.workers.find((w) => w.id === selectedId);

  return (
    <React.Fragment>
      {!embedded && (
        <Omnibar icon="ShieldPerson" title={pack.omnibarTitle}>
          <button type="button" className="iconbtn" onClick={onReload} aria-label="Reload" title="Reload">
            <Icon name="Refresh" size={18} />
          </button>
          <button type="button" className="vms-btn vms-btn--sm vms-btn--secondary" onClick={() => showToast(pack.domain.packetToast)}>
            <Icon name="FileDownload" size={14} />{pack.domain.auditAction}
          </button>
          <button type="button" className="vms-btn vms-btn--sm vms-btn--primary" onClick={() => showToast(pack.domain.psvToast)}>
            <Icon name="ShieldPerson" size={14} />{pack.domain.psvAction}
          </button>
        </Omnibar>
      )}

      <div className={"vms-page" + (embedded ? " vms-page--embedded" : "")} key={reloadKey}>
        {/* v0.77 boundary note · spec §15. Hidden at flag-off; renders
            when any Assignment-axis flag is on so users understand
            credentials are a Shift-only concern. */}
        {window.V77InfoBanner ? (
          <window.V77InfoBanner
            icon="Information"
            title="Credentials apply to shift-bookable work."
          >
            Assignment engagements (bench, SOW, retainer) don&rsquo;t require shift credentials — their compliance lives on the engagement contract.
          </window.V77InfoBanner>
        ) : null}
        {/* KPI strip — labels from pack, values derived */}
        <div className="vms-kpis">
          {pack.domain.kpis.map((k, i) => (
            <CrKpi key={i} label={k.label} value={kpiValues[i]} level={k.level} foot={k.foot} />
          ))}
        </div>

        {/* Demo callout — tells the buyer what this credentialing page is for */}
        <div className="tp-direct-sourcing">
          <div className="tp-ds-icon"><Icon name="ShieldPerson" size={20} /></div>
          <div>
            <div className="tp-ds-title">{pack.domain.heroLabel}</div>
            <div className="tp-ds-body">{pack.domain.heroBody}</div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" className="vms-btn vms-btn--secondary vms-btn--sm" onClick={() => showToast(pack.domain.packetToast)}>
              <Icon name="FileDownload" size={14} />Export packet
            </button>
          </div>
        </div>

        {/* Filter chips */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {[
            { id: "all",      label: `All ${pack.domain.workerLabel}`, count: pack.workers.length },
            { id: "expired",  label: "Has expired",                    count: pack.workers.filter((w) => Object.values(w.creds).some((c) => c.s === "err")).length },
            { id: "expiring", label: "Expiring 30 d",                  count: pack.workers.filter((w) => Object.values(w.creds).some((c) => c.s === "warn")).length },
            { id: "missing",  label: "Missing / in review",            count: pack.workers.filter((w) => Object.values(w.creds).some((c) => c.s === "missing" || c.s === "review")).length },
            ...pack.domain.unitFilters.map((u) => ({ id: u.id, label: u.label, count: 0 })),
          ].map((f) => (
            <button
              key={f.id}
              type="button"
              className="fw-tab"
              aria-pressed={filter === f.id}
              onClick={() => setFilter(f.id)}
            >
              {f.label}
              <span className="fw-tab-count">{f.count}</span>
            </button>
          ))}
        </div>

        {/* Matrix + side panel */}
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.5fr) minmax(360px, 480px)", gap: 20, alignItems: "start" }}>
          <div className="cr-matrix-wrap">
            <div className="cr-matrix-head">
              <div className="cr-head-worker">{pack.domain.workerLabel.charAt(0).toUpperCase() + pack.domain.workerLabel.slice(1)}</div>
              <div className="cr-head-cols">
                {pack.catalog.map((cred) => (
                  <div key={cred.code} className="cr-head-col" title={cred.cadence}>
                    {cred.label}
                  </div>
                ))}
              </div>
            </div>
            {filtered.map((w) => (
              <CrMatrixRow
                key={w.id}
                worker={w}
                catalog={pack.catalog}
                selected={w.id === selectedId}
                onSelect={setSelectedId}
              />
            ))}
            {filtered.length === 0 && (
              <p style={{ padding: "32px 24px", textAlign: "center", color: "var(--evr-content-primary-lowemp)" }}>
                No workers match this filter.
              </p>
            )}
          </div>

          <CrDetailPanel worker={selected} pack={pack} />
        </div>
      </div>
    </React.Fragment>
  );
}

// ---------- Cross-page helpers ---------------------------------------
// Look up an industry-credential record for an arbitrary worker. Used by
// the Workforce details page to surface industry-expected credentials on
// every worker, not just the ones hard-coded into the pack roster.
function _crHash(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

// Deterministic placeholder dates so unmatched workers still read as a
// real, varied credential file (not a wall of identical rows).
function _crSyntheticCreds(workerSeed, pack) {
  const h = _crHash(workerSeed);
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const out = {};
  pack.catalog.forEach((cred, i) => {
    const r = (h >> (i * 3)) & 0xff;
    // Distribute: ~70% ok, ~12% warn, ~5% err, ~5% missing, ~3% review, rest na
    let s = "ok";
    if (r < 8)          s = "err";
    else if (r < 16)    s = "missing";
    else if (r < 24)    s = "review";
    else if (r < 56)    s = "warn";
    else if (r < 64 && cred.required !== "all") s = "na";
    const m = months[(r + i) % 12];
    const day = ((r + i * 7) % 27) + 1;
    const yr = 2026 + ((r >> 2) % 3);
    const date = s === "na" || s === "missing" || s === "review" ? "\u2014" : `${m} ${String(day).padStart(2,"0")} ${yr}`;
    out[cred.code] = { s, d: date };
  });
  return out;
}

function _crSyntheticSecondary(workerSeed, pack) {
  const h = _crHash(workerSeed);
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const m = months[h % 12];
  const day = (h % 27) + 1;
  return {
    status: "Clear",
    queried: `${m} ${String(day).padStart(2, "0")} 2026`,
    next: `${m} ${String(day).padStart(2, "0")} 2027`,
  };
}

// Best-effort match a worker (from the Workforce roster) to a record in
// the current industry's credential pack. Returns a tuple of
//   { pack, worker, synthesized }
// `synthesized` is true when no real record matched and we built one.
function getCredentialingForWorker(worker) {
  const pack = _crGetPack();
  if (!worker) return { pack, worker: null, synthesized: false };
  const nm = (worker.name || "").toLowerCase().trim();
  const match = pack.workers.find((w) => {
    const wn = (w.name || "").toLowerCase();
    // Strip role suffixes (", RN", ", LPN")
    const wnBase = wn.split(",")[0].trim();
    return wnBase === nm || wn === nm;
  });
  if (match) return { pack, worker: match, synthesized: false };
  // Build a synthetic record matched to the pack's catalog so the
  // worker reads with industry-appropriate credentials.
  const synth = {
    id: worker.id,
    name: worker.name,
    unit: (worker.jobs && worker.jobs[0]) || "—",
    facility: worker.region || "\u2014",
    seniority: worker.shifts ? `${Math.max(1, Math.round(worker.shifts / 12))} yr` : "\u2014",
    licenseNo: "\u2014",
    creds: _crSyntheticCreds(worker.id || worker.name, pack),
    secondary: _crSyntheticSecondary(worker.id || worker.name, pack),
  };
  return { pack, worker: synth, synthesized: true };
}

Object.assign(window, {
  CredentialingPage,
  CRED_PACKS,
  getCredentialingForWorker,
  crChipClass,
  crChipText,
});
