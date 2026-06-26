// =====================================================================
// Flex Work — Supplier (Agency) Contract
//
// New full-page Invite & Edit-contract flow that replaces the legacy
// inline-side-panel Invite. Drawn 1:1 from the P2-Admin-Invite-Agency
// and P2-Admin-Edit-Agency-Contract Figma frames.
//
// Exposes:
//   · SupplierContractWizard       — full-page 4-step wizard
//   · SupplierContractSections     — accordion sections for the
//                                     SupplierDetailsPage (Agency
//                                     Details / District Markups /
//                                     Rate Cards / Cancellation /
//                                     Users)
//   · openMarkupEditor / openRateCardEditor / openAgencyDetailsEditor
//   · getSupplierContract(supplierId)
// =====================================================================

const { useState: useStateSct, useMemo: useMemoSct, useEffect: useEffectSct, useId: useIdSct } = React;

// ---------- Reference data --------------------------------------------

const LEGAL_ENTITIES = [
  "Oakmont Holdings",
  "Apex Hospitality LLC",
  "Northwind Group",
  "Cascade Industries",
  "Pacific Crewing Co.",
  "Sunset Labor LLC",
];

// Pricing configurations exposed by pages/pricing-config.jsx. We read
// the live store (getPcfgStore) so the contract dropdown, the bound-id
// resolver, and the engine all see the same source of truth — edits to
// a config in Settings → Pricing propagate here on next render.
function pricingConfigStore() {
  if (typeof window === "undefined") return [];
  if (window.getPcfgStore) return window.getPcfgStore();
  return window.PRICING_CONFIGS || [];
}
function pricingConfigOptions() {
  return pricingConfigStore().filter((c) => c.status !== "Archived").map((c) => c.name);
}
// Resolve a config record from the store by name (the field the
// contract stores for display) so we can recover its stable id.
function pricingConfigByName(name) {
  return pricingConfigStore().find((c) => c.name === name) || null;
}

// ---------- Platform directory of known agencies ----------------------
// These are agencies already on the Dayforce platform that are NOT yet
// invited to this org. Selecting one in Step 1 prefills the agency-level
// fields (profile, address, primary contact, operating areas) so admins
// don't re-type info Dayforce already knows. Org-specific commercial
// terms (legal entity, pricing config, markups) stay blank — they're
// negotiated per relationship.
const PLATFORM_AGENCY_DIRECTORY = [
  {
    id: "pa-bridge",
    name: "BridgeStaff",
    short: "BS",
    bg: "#B4D38C", fg: "#2C4112",
    address: "501 Boylston St., Boston, MA",
    zip: "02116",
    site: "bridgestaff.com",
    industries: ["Hospitality", "Light industrial"],
    activeOrgs: 142,
    workersOnPlatform: 3840,
    onPlatformSince: "Mar 2022",
    contactFirst: "Olivia",
    contactLast: "Reyes",
    contactEmail: "olivia.reyes@bridgestaff.com",
    contactTitle: "Director of Partnerships",
    operatingStates: ["Massachusetts", "New York", "New Jersey"],
    operatingDistricts: ["ma-bos", "ma-wor", "ny-nyc", "ny-bk", "nj-nwk"],
  },
  {
    id: "pa-northcrew",
    name: "NorthCrew",
    short: "NC",
    bg: "#9EC3F2", fg: "#0E2E5A",
    address: "1100 1st Ave. S., Seattle, WA",
    zip: "98134",
    site: "northcrew.io",
    industries: ["Warehouse", "Logistics"],
    activeOrgs: 87,
    workersOnPlatform: 2110,
    onPlatformSince: "Jul 2023",
    contactFirst: "Daniel",
    contactLast: "Park",
    contactEmail: "daniel.park@northcrew.io",
    contactTitle: "VP, Client Success",
    operatingStates: ["Washington", "California", "Colorado"],
    operatingDistricts: ["wa-sea", "wa-tac", "ca-sf", "ca-sj", "co-den"],
  },
  {
    id: "pa-vellum",
    name: "Vellum Workforce",
    short: "VW",
    bg: "#E5B5E7", fg: "#4B1B4D",
    address: "300 N. Lasalle St., Chicago, IL",
    zip: "60654",
    site: "vellumwf.com",
    industries: ["Office & professional", "Finance"],
    activeOrgs: 56,
    workersOnPlatform: 980,
    onPlatformSince: "Nov 2024",
    contactFirst: "Aisha",
    contactLast: "Hoffman",
    contactEmail: "aisha.hoffman@vellumwf.com",
    contactTitle: "Head of Enterprise Accounts",
    operatingStates: ["Illinois", "Texas", "Georgia"],
    operatingDistricts: ["il-chi", "tx-dal", "tx-hou", "ga-atl"],
  },
  {
    id: "pa-tideline",
    name: "Tideline Staffing",
    short: "TS",
    bg: "#7ED7C8", fg: "#0F3B36",
    address: "950 Brickell Ave., Miami, FL",
    zip: "33131",
    site: "tideline.work",
    industries: ["Hospitality", "Events"],
    activeOrgs: 211,
    workersOnPlatform: 5260,
    onPlatformSince: "Jan 2021",
    contactFirst: "Marcus",
    contactLast: "Delgado",
    contactEmail: "marcus.delgado@tideline.work",
    contactTitle: "Chief Commercial Officer",
    operatingStates: ["Florida", "Georgia", "Texas"],
    operatingDistricts: ["fl-mia", "fl-orl", "fl-tpa", "ga-atl", "tx-hou"],
  },
  {
    id: "pa-foundry",
    name: "Foundry Talent",
    short: "FT",
    bg: "#F4B98F", fg: "#623112",
    address: "200 W. 6th St., Austin, TX",
    zip: "78701",
    site: "foundrytalent.co",
    industries: ["Manufacturing", "Skilled trades"],
    activeOrgs: 34,
    workersOnPlatform: 745,
    onPlatformSince: "Aug 2024",
    contactFirst: "Priya",
    contactLast: "Iyer",
    contactEmail: "priya.iyer@foundrytalent.co",
    contactTitle: "Director, Strategic Accounts",
    operatingStates: ["Texas", "Colorado", "Georgia"],
    operatingDistricts: ["tx-aus", "tx-dal", "tx-sa", "co-den", "ga-atl"],
  },
  {
    id: "pa-roster",
    name: "Roster Partners",
    short: "RP",
    bg: "#C9A0F4", fg: "#2D124E",
    address: "60 E. 42nd St., New York, NY",
    zip: "10165",
    site: "rosterpartners.com",
    industries: ["Hospitality", "Front of house", "Events"],
    activeOrgs: 178,
    workersOnPlatform: 4120,
    onPlatformSince: "Feb 2022",
    contactFirst: "Hannah",
    contactLast: "Brennan",
    contactEmail: "hannah.brennan@rosterpartners.com",
    contactTitle: "VP, Enterprise",
    operatingStates: ["New York", "New Jersey", "Massachusetts"],
    operatingDistricts: ["ny-nyc", "ny-bk", "ny-qns", "ny-li", "nj-jc", "ma-bos"],
  },
];

// 35 districts spread across 8 states — used for both Step 2 Markups
// and the Supplier-details District Markups accordion.
const DISTRICTS_RAW = [
  // New York
  { id: "ny-nyc",  state: "New York",     code: "NY",  name: "Metro New York City" },
  { id: "ny-bk",   state: "New York",     code: "NY",  name: "Metro Brooklyn" },
  { id: "ny-qns",  state: "New York",     code: "NY",  name: "Metro Queens" },
  { id: "ny-li",   state: "New York",     code: "NY",  name: "Long Island" },
  { id: "ny-buf",  state: "New York",     code: "NY",  name: "Buffalo" },
  // New Jersey
  { id: "nj-jc",   state: "New Jersey",   code: "NJ",  name: "Metro Jersey City" },
  { id: "nj-nwk",  state: "New Jersey",   code: "NJ",  name: "Newark" },
  { id: "nj-prn",  state: "New Jersey",   code: "NJ",  name: "Princeton" },
  // California
  { id: "ca-sf",   state: "California",   code: "CA",  name: "Metro San Francisco" },
  { id: "ca-la",   state: "California",   code: "CA",  name: "Metro Los Angeles" },
  { id: "ca-sd",   state: "California",   code: "CA",  name: "San Diego" },
  { id: "ca-sj",   state: "California",   code: "CA",  name: "San Jose" },
  { id: "ca-sac",  state: "California",   code: "CA",  name: "Sacramento" },
  // Massachusetts
  { id: "ma-bos",  state: "Massachusetts", code: "MA", name: "Metro Boston" },
  { id: "ma-wor",  state: "Massachusetts", code: "MA", name: "Worcester" },
  // Illinois
  { id: "il-chi",  state: "Illinois",     code: "IL",  name: "Metro Chicago" },
  { id: "il-spr",  state: "Illinois",     code: "IL",  name: "Springfield" },
  // Texas
  { id: "tx-hou",  state: "Texas",        code: "TX",  name: "Metro Houston" },
  { id: "tx-dal",  state: "Texas",        code: "TX",  name: "Metro Dallas" },
  { id: "tx-aus",  state: "Texas",        code: "TX",  name: "Austin" },
  { id: "tx-sa",   state: "Texas",        code: "TX",  name: "San Antonio" },
  // Florida
  { id: "fl-mia",  state: "Florida",      code: "FL",  name: "Metro Miami" },
  { id: "fl-orl",  state: "Florida",      code: "FL",  name: "Orlando" },
  { id: "fl-tpa",  state: "Florida",      code: "FL",  name: "Tampa" },
  // Washington
  { id: "wa-sea",  state: "Washington",   code: "WA",  name: "Metro Seattle" },
  { id: "wa-tac",  state: "Washington",   code: "WA",  name: "Tacoma" },
  // Colorado
  { id: "co-den",  state: "Colorado",     code: "CO",  name: "Metro Denver" },
  // Georgia
  { id: "ga-atl",  state: "Georgia",      code: "GA",  name: "Metro Atlanta" },
];

// Pre-seed a markup percentage per district. Higher in big metros.
const DISTRICT_MARKUP_SEEDS = {
  "ny-nyc": 35, "ny-bk": 32, "ny-qns": 30, "ny-li": 28, "ny-buf": 18,
  "nj-jc": 30, "nj-nwk": 28, "nj-prn": 22,
  "ca-sf": 38, "ca-la": 35, "ca-sd": 28, "ca-sj": 34, "ca-sac": 22,
  "ma-bos": 32, "ma-wor": 20,
  "il-chi": 30, "il-spr": 18,
  "tx-hou": 26, "tx-dal": 26, "tx-aus": 25, "tx-sa": 20,
  "fl-mia": 28, "fl-orl": 22, "fl-tpa": 22,
  "wa-sea": 32, "wa-tac": 22,
  "co-den": 24,
  "ga-atl": 25,
};

// Positions used in the Rate Cards table. Localized by industry below.
const POSITIONS_RAW = [
  { id: "p-svc",  name: "Production Associate",        category: "Production",      payRate: 22 },
  { id: "p-pck",  name: "Picker",                   category: "Operations",      payRate: 19 },
  { id: "p-lm",   name: "Line Manager",             category: "Supervisory",     payRate: 34 },
  { id: "p-pc",   name: "Prep Cook",                category: "Kitchen",         payRate: 21 },
  { id: "p-lc",   name: "Line Cook",                category: "Kitchen",         payRate: 24 },
  { id: "p-srv",  name: "Server",                   category: "Front of house",  payRate: 18 },
  { id: "p-hst",  name: "Host",                     category: "Front of house",  payRate: 17 },
  { id: "p-bar",  name: "Bartender",                category: "Front of house",  payRate: 23 },
  { id: "p-bsr",  name: "Busser",                   category: "Front of house",  payRate: 16 },
  { id: "p-dsh",  name: "Dishwasher",               category: "Kitchen",         payRate: 16 },
  { id: "p-bkp",  name: "Banquet Captain",          category: "Front of house",  payRate: 26 },
  { id: "p-vlt",  name: "Valet Driver",             category: "Guest services",  payRate: 18 },
  { id: "p-cnc",  name: "Concierge",                category: "Guest services",  payRate: 20 },
  { id: "p-hskp", name: "Housekeeper",              category: "Guest services",  payRate: 17 },
  { id: "p-wrh",  name: "Warehouse Clerk",          category: "Operations",      payRate: 19 },
  { id: "p-opt",  name: "Operator",                 category: "Operations",      payRate: 22 },
  { id: "p-isp",  name: "Inspector",                category: "Quality",         payRate: 24 },
  { id: "p-asm",  name: "Assembler",                category: "Operations",      payRate: 20 },
];

// Worker classification — drives burden composition in the bill rate.
// W-2 carries employer payroll + benefits load; 1099 does not; C2C
// routes through a corp-to-corp supplier with its own markup. Matches
// the FG Worker Classification primitive and the VNDLY Worker Type
// filter. The label is the abbreviation Dayforce HCM uses on payroll.
const CLASSIFICATIONS = [
  { id: "W2",   label: "W-2",  burdenPct: 22, hint: "Employer payroll + benefits load" },
  { id: "1099", label: "1099", burdenPct:  3, hint: "Self-employed, contract worker" },
  { id: "C2C",  label: "C2C",  burdenPct: 15, hint: "Corp-to-corp routing" },
];

// Skill-premium catalog — certifications that stack on top of the base
// position rate. Read by RateCardsCard's bill-rate breakdown popover
// and by the rate-card editor when a position carries skillIds[]. The
// catalog itself is authored in pages/pricing-config.jsx under the
// new "Skill premiums" group.
const SKILL_PREMIUMS = [
  { id: "icu",      label: "ICU certification",      pct: 8  },
  { id: "fork7",    label: "Class-7 forklift",       pct: 5  },
  { id: "haz",      label: "Hazmat handler",         pct: 6  },
  { id: "bilingual", label: "Bilingual (ES / EN)",   pct: 4  },
  { id: "csm",      label: "Certified Scrum Master", pct: 7  },
  { id: "osha10",   label: "OSHA-10",                pct: 3  },
];
const POSITIONS = (typeof window !== "undefined" && window.localizeAll)
  ? window.localizeAll(POSITIONS_RAW, ["name"])
  : POSITIONS_RAW;

// Tier names match the Figma "Solid / Outstanding / Epic" frame.
const TIERS = [
  { id: "solid",       label: "Solid",       markup: 5 },
  { id: "outstanding", label: "Outstanding", markup: 10 },
  { id: "epic",        label: "Epic",        markup: 15 },
];

const POSITION_CATEGORIES = Array.from(new Set(POSITIONS.map((p) => p.category)));

// ---------- Per-supplier seeded contract -------------------------------

const CONTRACT_CACHE = {};
function getSupplierContract(supplierId) {
  if (CONTRACT_CACHE[supplierId]) return CONTRACT_CACHE[supplierId];
  const sup = (window.SUPPLIERS || []).find((s) => s.id === supplierId) || {};
  // Deterministic pseudo-random per id so different suppliers feel
  // different but the same supplier stays consistent across renders.
  const seed = (supplierId || "").split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const districtSubset = DISTRICTS_RAW.slice(0, 7 + (seed % 12)).map((d) => d.id);
  // Disable ~25% of positions to mirror Figma's mix of Enabled/Disabled.
  const positionStatus = {};
  POSITIONS.forEach((p, i) => { positionStatus[p.id] = ((seed + i) % 4) !== 0; });
  // Position-level markup is enabled only for a few positions.
  const positionMarkups = {};
  POSITIONS.forEach((p, i) => {
    if ((seed + i * 3) % 5 === 0) positionMarkups[p.id] = 8 + ((seed + i) % 7);
  });
  const tierEnabled = {};
  POSITIONS.forEach((p, i) => { tierEnabled[p.id] = ((seed + i * 2) % 3) === 0; });
  CONTRACT_CACHE[supplierId] = {
    supplierId,
    supplier: sup,
    // Top-level essentials so the wizard / edit panels can read them
    // directly (the form binds to data.name / data.address / data.zip).
    name: sup.name || "",
    address: sup.address || "",
    zip: sup.zip || (
      // Synthesize a plausible zip from the supplier address tail.
      (() => {
        const m = /(\d{5})(?:-\d{4})?$/.exec(sup.address || "");
        return m ? m[1] : "10007";
      })()
    ),
    pastDate: "04.04.2025",
    currentDate: "08.04.2025",
    legalEntity: LEGAL_ENTITIES[(seed) % LEGAL_ENTITIES.length],
    // v0.80 · A3 — bind to a real pricing configuration. Pick an active
    // config deterministically per supplier so the suppliers list shows
    // a realistic spread of configs (and bill rates) rather than every
    // contract resolving to the same default. Both the display name and
    // the stable id are stored; the engine resolves rules by id.
    ...(function bindPricingConfig() {
      const active = pricingConfigStore().filter((c) => c.status === "Active");
      const cfg = active.length ? active[seed % active.length] : null;
      return {
        pricingConfig: cfg ? cfg.name : (pricingConfigOptions()[0] || "Hospitality — Tier 1"),
        pricingConfigId: cfg ? cfg.id : null,
      };
    })(),
    // Contract-level rate-card defaults. Currency drives every row's
    // display via curSymbol() at render; payRateVisibility is the
    // policy the supplier-side RateCardsCard reads to decide whether
    // to mask the pay column. See settings-policies.jsx for the
    // org-wide default and the per-supplier override surface.
    defaultCurrency: "USD",
    // v0.79 · F5 — country tag drives engine rule scoping. The seed
    // value is the tenant's active country; per-row overrides win
    // when present (legacy rows fall back here).
    country: (typeof window !== "undefined" && window.getCurrentCountry)
      ? window.getCurrentCountry()
      : "US",
    payRateVisibility: ((seed % 3) === 0) ? "masked" : "visible",
    // v0.80 · A3 — fallback snapshot of the bound config's rules. The
    // engine now resolves rules LIVE from the store by pricingConfigId
    // (see contractPricingRules), so edits in Settings → Pricing
    // propagate to every bound contract on next render. This frozen
    // copy is only used when the store can't be reached.
    pricingConfigRules: (typeof window !== "undefined" && window.rulesFromStructure && window.PCFG_DEFAULT_STRUCTURE)
      ? window.rulesFromStructure(window.PCFG_DEFAULT_STRUCTURE)
      : [],
    operatingStates: Array.from(new Set(DISTRICTS_RAW
      .filter((d) => districtSubset.includes(d.id)).map((d) => d.state))),
    operatingDistricts: districtSubset,
    districtMarkups: Object.fromEntries(
      DISTRICTS_RAW.map((d) => [d.id, DISTRICT_MARKUP_SEEDS[d.id] ?? 20])
    ),
    contactFirst: "John",
    contactLast:  "Doe",
    contactEmail: `john.doe@${(sup.name || "agency").toLowerCase().replace(/\s+/g, "")}.com`,
    positions: POSITIONS.map((p, i) => {
      // Backwards-compatible extension: every legacy field stays where
      // it was; new fields slot in alongside. Min / preferred / max
      // form a ±18% band around the seed payRate so the existing
      // bill-rate calc still resolves cleanly when a row is read as a
      // single number.
      const base = p.payRate;
      const span = Math.max(2, Math.round(base * 0.18));
      const cls = CLASSIFICATIONS[(seed + i * 7) % CLASSIFICATIONS.length].id;
      const skillSeed = (seed + i * 5) % SKILL_PREMIUMS.length;
      // Most positions carry zero skill premiums; ~30% carry one.
      const skillIds = ((seed + i * 11) % 3 === 0) ? [SKILL_PREMIUMS[skillSeed].id] : [];
      return {
        id: p.id,
        name: p.name,
        enabled: positionStatus[p.id],
        positionMarkup: positionMarkups[p.id] || null,
        tierEnabled: tierEnabled[p.id],
        payRate: base,                                    // legacy: preferred rate
        payRateMin: Math.max(7, base - span),             // statutory floor protected by Math.max
        payRatePref: base,
        payRateMax: base + span,
        currency: "USD",                                  // resolved at render via curSymbol()
        classification: cls,
        skillIds,
        shiftDiffNight:   ((seed + i) % 4 === 0) ? 15 : null,
        shiftDiffWeekend: ((seed + i) % 5 === 0) ? 10 : null,
        // v0.79 · F3 — shift / holiday variants per row. The popover
        // expands to a four-row variant table; timesheets resolve the
        // right bill rate per line without re-running the engine at
        // invoice time. Derived at seed-time from the typed premium
        // rules so the cell still shows the regular number.
        payVariants: [
          { kind: "regular", payRate: base },
          { kind: "night",   payRate: Math.round(base * 1.15 * 100) / 100 },
          { kind: "weekend", payRate: Math.round(base * 1.10 * 100) / 100 },
          { kind: "holiday", payRate: Math.round(base * 1.50 * 100) / 100 },
        ],
        effectiveFrom: "2026-01-01",
        effectiveTo:   "2026-12-31",
        // Audit trail — last three changes per row. Real implementation
        // is a per-supplier ledger; for the prototype we seed three
        // entries so the History drawer renders out of the box.
        history: [
          { at: "2025-11-04", by: "Maya Chen",  change: `Pay rate ${base - 1} → ${base}`,     reason: "Annual review" },
          { at: "2025-07-12", by: "Alex Moreno", change: "Position-level markup enabled",      reason: "Tier-1 supplier alignment" },
          { at: "2025-04-01", by: "Import",      change: "Seeded from rate_cards_v5.xlsx",     reason: "Initial load" },
        ],
      };
    }),
    // v0.82 — Supplier funding (MSP program fee) negotiated per agency.
    // When the program is supplier-funded, the org-wide default is the
    // program standard (Settings → Configuration → Program funding, 2.5%).
    // Each agency negotiates its own rate in its master agreement — any
    // value from 0% (fully waived) up to the program standard. The seed
    // gives every agency a different-but-stable negotiated rate so the
    // suppliers list reads like a real panel of bilateral terms.
    funding: (function () {
      const ladder = [2.5, 2.0, 1.75, 1.5, 1.25, 1.0, 0.75, 0.5, 0.0, 2.25];
      const negotiatedPct = ladder[seed % ladder.length];
      const note =
        negotiatedPct >= 2.5 ? "Standard program rate — no reduction negotiated." :
        negotiatedPct === 0  ? "Program fee fully waived under this agency's master agreement." :
                               "Reduced rate negotiated off the program standard.";
      return {
        negotiatedPct,                 // 0 – program standard, set in the MSA
        method: "Inherit",             // "Inherit" program method, or override to Markup/Discount
        effectiveDate: "Jul 1, 2026",
        note,
        negotiatedBy: "Maya Chen · VP, Workforce Strategy",
        negotiatedAt: "2026-05-12",
      };
    })(),
    cancellationPolicy: {
      window24h: 100,
      window48h: 50,
      window72h: 25,
    },
    paperContract: {
      name: `MSA_${(sup.name || "Agency").replace(/[^A-Za-z0-9]+/g, "_")}_2025.pdf`,
      size: `${(1.6 + ((seed % 17) / 10)).toFixed(1)} MB`,
      version: `v${1 + (seed % 3)}.${seed % 5}`,
      effective: "Apr 04 2025",
      expires:   "Apr 03 2028",
      signedBy:  "John Doe · Director of Staffing",
      countersigned: "Maya Chen · VP, Workforce Strategy",
    },
    contractTerms: {
      // Conversion (perm hire) terms
      conversionHours: 1040,                 // hours billed before fee-free conversion
      conversionFeePct: 25,                  // % of first-year salary
      tenureLimitWeeks: 78,                  // max contiguous weeks on assignment
      // Overtime & premium pay (multipliers on bill rate)
      otDailyAfterHrs: 8,
      otWeeklyAfterHrs: 40,
      otMultiplier: 1.5,
      dtAfterHrs: 12,
      dtMultiplier: 2.0,
      holidayMultiplier: 1.5,
      holidaysObserved: 11,
      // Timesheets
      timesheetCutoff: "Mon 10:00 AM PT",
      timesheetGraceHrs: 24,
      lateTimesheetFee: 25,                  // USD per late timesheet
      autoApproveAfterDays: 3,
      // Invoicing
      invoiceCadence: "Weekly · approved hours",
      paymentTerms: "Net 30",
      disputeWindowDays: 10,
      minShiftHrs: 4,
    },
    users: [
      { id: "u1", name: "John Doe",     role: "Owner",     email: "john.doe@agency.com",     status: "Active" },
      { id: "u2", name: "Sarah Kim",    role: "Recruiter", email: "sarah.kim@agency.com",    status: "Active" },
      { id: "u3", name: "Mike Patel",   role: "Recruiter", email: "mike.patel@agency.com",   status: "Pending" },
    ],
  };
  return CONTRACT_CACHE[supplierId];
}

// =====================================================================
// v0.82 — Supplier-funding resolver
// Composes the program-wide funding config (Settings → Configuration →
// Program funding) with the per-agency negotiated rate stored on the
// SupplierContract. Single source of truth for every surface that needs
// to know what fee a given agency actually pays — the agency detail page
// and every invoice for that agency. Returns null when the program is
// NOT supplier-funded so callers fail closed.
// =====================================================================
function getSupplierFunding(supplierId) {
  const program = (typeof window !== "undefined" && window.getProgramFunding)
    ? window.getProgramFunding() : null;
  if (!program || !program.supplierFunding) return null;
  const standardPct    = Number(program.feePct) || 0;
  const allowOverrides = !!program.allowOverrides;
  const c    = getSupplierContract(supplierId);
  const fund = (c && c.funding) || {};
  let negotiatedPct = (typeof fund.negotiatedPct === "number") ? fund.negotiatedPct : null;
  // An agency rate is bounded by [0, program standard]: 0 = fully waived,
  // standard = no reduction. Never above the program default.
  if (negotiatedPct != null) negotiatedPct = Math.max(0, Math.min(standardPct, negotiatedPct));
  const effectivePct = (allowOverrides && negotiatedPct != null) ? negotiatedPct : standardPct;
  const hasOverride  = allowOverrides && negotiatedPct != null && negotiatedPct !== standardPct;
  const method = (fund.method && fund.method !== "Inherit") ? fund.method : program.method;
  return {
    supplierFunding: true,
    standardPct,
    negotiatedPct,
    effectivePct,
    hasOverride,
    allowOverrides,
    method,
    invoiceLabel:  program.invoiceLabel || "Program fee",
    effectiveDate: fund.effectiveDate || program.effectiveDate,
    coverage:      program.coverage,
    note:          fund.note,
  };
}

// Convenience: just the effective % an agency pays (null when the
// program isn't supplier-funded).
function resolveSupplierFundingPct(supplierId) {
  const f = getSupplierFunding(supplierId);
  return f ? f.effectivePct : null;
}

// Persist an edit to an agency's negotiated funding terms.
function setSupplierFunding(supplierId, next) {
  const c = getSupplierContract(supplierId);
  c.funding = { ...(c.funding || {}), ...next };
  CONTRACT_CACHE[supplierId] = c;
  return c.funding;
}

// ---------- Helpers ----------------------------------------------------

function districtsById(ids) {
  const set = new Set(ids);
  return DISTRICTS_RAW.filter((d) => set.has(d.id));
}

function fmtMarkup(n) {
  if (n == null) return "—";
  return `${n}%`;
}

// =====================================================================
// STEPPER
// =====================================================================

const STEPS = [
  { id: 1, label: "Details" },
  { id: 2, label: "Markups" },
  { id: 3, label: "Rate cards" },
  { id: 4, label: "Review" },
];

function StepperBar({ step }) {
  return (
    <div className="sc-stepper" role="navigation" aria-label="Wizard progress">
      {STEPS.map((s, i) => {
        const state = step > s.id ? "done" : step === s.id ? "active" : "todo";
        return (
          <React.Fragment key={s.id}>
            <div className={`sc-step sc-step--${state}`}>
              <span className="sc-step-dot" aria-hidden="true">
                {state === "done"
                  ? <Icon name="Check" size={12} />
                  : <span>{s.id}</span>}
              </span>
              <span className="sc-step-label">{s.label}</span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`sc-step-line sc-step-line--${step > s.id ? "done" : "todo"}`} aria-hidden="true" />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

// =====================================================================
// STEP 1 — Details form
// =====================================================================

// ---------- Directory picker (Step 1) ---------------------------------
// Searchable card-style picker that lists agencies already on the
// Dayforce platform. Selecting one fires `onPick` with the directory
// record so the parent can prefill the form.
function AgencyDirectoryPicker({ value, onPick, onClear }) {
  const [open, setOpen] = useStateSct(false);
  const [query, setQuery] = useStateSct("");
  const rootRef = React.useRef(null);
  const inputRef = React.useRef(null);

  // Filter out agencies already on this org so we don't suggest dupes.
  const existing = useMemoSct(() => {
    const list = (window.SUPPLIERS || []).map((s) => (s.name || "").toLowerCase());
    return new Set(list);
  }, []);
  const directory = useMemoSct(
    () => PLATFORM_AGENCY_DIRECTORY.filter((a) => !existing.has(a.name.toLowerCase())),
    [existing]
  );

  useEffectSct(() => {
    if (!open) return;
    const onDoc = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    const t = setTimeout(() => { try { inputRef.current && inputRef.current.focus(); } catch (e) {} }, 60);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
      clearTimeout(t);
    };
  }, [open]);

  const q = query.trim().toLowerCase();
  const results = q
    ? directory.filter((a) =>
        a.name.toLowerCase().includes(q) ||
        a.address.toLowerCase().includes(q) ||
        a.industries.some((i) => i.toLowerCase().includes(q))
      )
    : directory;

  return (
    <div className="sc-dir" ref={rootRef}>
      {value ? (
        <div className="sc-dir-selected" role="region" aria-label="Imported from Dayforce directory">
          <span className="sc-dir-avatar" style={{ background: value.bg, color: value.fg }} aria-hidden="true">
            {value.short}
          </span>
          <div className="sc-dir-selected-text">
            <div className="sc-dir-selected-title">
              {value.name}
              <span className="sc-dir-badge">
                <Icon name="Check" size={12} />
                Imported from Dayforce directory
              </span>
            </div>
            <div className="sc-dir-selected-sub">
              {value.activeOrgs} orgs use them on Dayforce · On platform since {value.onPlatformSince}
            </div>
          </div>
          <button
            type="button"
            className="btn btn--sm btn--tertiary"
            onClick={() => { setOpen(false); onClear && onClear(); }}
          >
            <Icon name="X" size={14} />Clear
          </button>
        </div>
      ) : (
        <button
          type="button"
          className={`sc-dir-trigger ${open ? "sc-dir-trigger--open" : ""}`}
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-haspopup="listbox"
        >
          <span className="sc-dir-trigger-icon" aria-hidden="true">
            <Icon name="Search" size={18} />
          </span>
          <span className="sc-dir-trigger-text">
            <span className="sc-dir-trigger-title">Find an agency on Dayforce</span>
            <span className="sc-dir-trigger-sub">
              {directory.length} agencies on the platform — pick one to prefill the profile, or enter details below manually
            </span>
          </span>
          <span className="sc-dir-trigger-chev" aria-hidden="true">
            <Icon name="ChevronDown" size={18} style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform 150ms cubic-bezier(0.4,0,0.2,1)" }} />
          </span>
        </button>
      )}

      {open && !value && (
        <div className="sc-dir-menu" role="listbox" aria-label="Agencies on Dayforce">
          <div className="sc-dir-search">
            <span className="sc-dir-search-icon" aria-hidden="true">
              <Icon name="Search" size={16} />
            </span>
            <input
              ref={inputRef}
              type="text"
              className="sc-dir-search-input"
              placeholder="Search by name, site, or industry"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search agencies"
            />
            {query && (
              <button
                type="button"
                className="sc-dir-search-clear"
                onClick={() => { setQuery(""); inputRef.current && inputRef.current.focus(); }}
                aria-label="Clear search"
              >
                <Icon name="X" size={14} />
              </button>
            )}
          </div>
          <div className="sc-dir-list">
            {results.length === 0 ? (
              <div className="sc-dir-empty">
                <div className="sc-dir-empty-title">No matches</div>
                <div className="sc-dir-empty-sub">Try a different search — or close this and enter the agency details manually.</div>
              </div>
            ) : results.map((a) => (
              <button
                key={a.id}
                type="button"
                role="option"
                className="sc-dir-row"
                onClick={() => { onPick && onPick(a); setOpen(false); setQuery(""); }}
              >
                <span className="sc-dir-row-avatar" style={{ background: a.bg, color: a.fg }} aria-hidden="true">
                  {a.short}
                </span>
                <span className="sc-dir-row-text">
                  <span className="sc-dir-row-name">{a.name}</span>
                  <span className="sc-dir-row-meta">{a.address}</span>
                  <span className="sc-dir-row-tags">
                    {a.industries.map((i) => (
                      <span className="sc-dir-tag" key={i}>{i}</span>
                    ))}
                  </span>
                </span>
                <span className="sc-dir-row-stats">
                  <span className="sc-dir-row-stat-val tabular">{a.activeOrgs}</span>
                  <span className="sc-dir-row-stat-lbl">orgs use them</span>
                </span>
              </button>
            ))}
          </div>
          <div className="sc-dir-foot">
            <Icon name="Information" size={14} />
            Picking an agency prefills profile, contact, and operating areas. Commercial terms (markups, rates) stay blank for you to set.
          </div>
        </div>
      )}
    </div>
  );
}

function Sc_DetailsStep({ data, onChange, errors, mode }) {
  const set = (k, v) => onChange({ ...data, [k]: v });
  const allStates = Array.from(new Set(DISTRICTS_RAW.map((d) => d.state))).sort();

  // Look up the picked directory record from data._directoryId (set when
  // the user picks from the platform directory).
  const pickedAgency = useMemoSct(
    () => PLATFORM_AGENCY_DIRECTORY.find((a) => a.id === data._directoryId) || null,
    [data._directoryId]
  );

  const handlePick = (a) => {
    onChange({
      ...data,
      _directoryId: a.id,
      name: a.name,
      address: a.address,
      zip: a.zip,
      operatingStates: a.operatingStates.slice(),
      operatingDistricts: a.operatingDistricts.slice(),
      contactFirst: a.contactFirst,
      contactLast: a.contactLast,
      contactEmail: a.contactEmail,
    });
  };
  const handleClear = () => {
    onChange({
      ...data,
      _directoryId: null,
      name: "",
      address: "",
      zip: "",
      operatingStates: [],
      operatingDistricts: [],
      contactFirst: "",
      contactLast: "",
      contactEmail: "",
    });
  };

  return (
    <div className="sc-card">
      <header className="sc-card-head">
        <span className="sc-card-icon" aria-hidden="true">
          <Icon name="Building" size={20} />
        </span>
        <div className="sc-card-headtext">
          <h2 className="sc-card-title">Agency profile</h2>
          <p className="sc-card-sub">Capture the agency’s legal details and contact.</p>
        </div>
      </header>

      <div className="sc-card-body">
        {mode !== "edit" && (
          <AgencyDirectoryPicker
            value={pickedAgency}
            onPick={handlePick}
            onClear={handleClear}
          />
        )}

        <h3 className="sc-group-title">Essentials</h3>
        <div className="sc-grid sc-grid--1">
          <Field label="Name" required>
            <TextInput value={data.name || ""} onChange={(v) => set("name", v)} placeholder="StaffWise" />
            {errors.name && <span className="sc-error">{errors.name}</span>}
          </Field>
        </div>
        <div className="sc-grid sc-grid--2">
          <Field label="Address" required>
            <TextInput value={data.address || ""} onChange={(v) => set("address", v)} placeholder="125 Main St., London" />
            {errors.address && <span className="sc-error">{errors.address}</span>}
          </Field>
          <Field label="Zip code" required>
            <TextInput value={data.zip || ""} onChange={(v) => set("zip", v)} placeholder="EC1A 1BB" />
            {errors.zip && <span className="sc-error">{errors.zip}</span>}
          </Field>
        </div>
        <div className="sc-grid sc-grid--1">
          <Field label="Legal entity">
            <Dropdown
              options={LEGAL_ENTITIES}
              value={data.legalEntity}
              onChange={(v) => set("legalEntity", v)}
              placeholder="Select from the list"
            />
          </Field>
          <Field label="Pricing configuration">
            <Dropdown
              options={pricingConfigOptions().length ? pricingConfigOptions() : ["Hospitality — Tier 1", "Warehouse — Standard Rate Card"]}
              value={data.pricingConfig}
              onChange={(v) => {
                // Write the display name AND resolve the stable id so the
                // engine binds to the chosen configuration's live rules.
                const cfg = pricingConfigByName(v);
                onChange({ ...data, pricingConfig: v, pricingConfigId: cfg ? cfg.id : null });
              }}
              placeholder="Select from the list"
            />
          </Field>
        </div>

        <h3 className="sc-group-title sc-group-title--spaced">Area of operations</h3>
        <Field label="Operating state(s)">
          <MultiSelect
            options={allStates}
            value={data.operatingStates || []}
            placeholder="Select one or multiple"
            onChange={(arr) => {
              // If a state is removed, drop its districts in the same update.
              const stateSet = new Set(arr);
              const validIds = DISTRICTS_RAW
                .filter((d) => stateSet.size === 0 || stateSet.has(d.state))
                .map((d) => d.id);
              const filteredDistricts = (data.operatingDistricts || []).filter((id) => validIds.includes(id));
              onChange({ ...data, operatingStates: arr, operatingDistricts: filteredDistricts });
            }}
          />
        </Field>
        <Field label="Operating district(s)">
          <MultiSelect
            options={DISTRICTS_RAW
              .filter((d) => !data.operatingStates?.length || data.operatingStates.includes(d.state))
              .map((d) => `${d.code} – ${d.name}`)}
            value={districtsById(data.operatingDistricts || []).map((d) => `${d.code} – ${d.name}`)}
            placeholder="Select one or multiple"
            onChange={(arr) => {
              // Map the chosen labels back to ids.
              const ids = arr.map((label) => {
                const match = DISTRICTS_RAW.find((d) => `${d.code} – ${d.name}` === label);
                return match ? match.id : null;
              }).filter(Boolean);
              onChange({ ...data, operatingDistricts: ids });
            }}
          />
        </Field>

        <h3 className="sc-group-title sc-group-title--spaced">Contact information</h3>
        <div className="sc-grid sc-grid--2">
          <Field label="First name" required>
            <TextInput value={data.contactFirst || ""} onChange={(v) => set("contactFirst", v)} placeholder="John" />
            {errors.contactFirst && <span className="sc-error">{errors.contactFirst}</span>}
          </Field>
          <Field label="Last name" required>
            <TextInput value={data.contactLast || ""} onChange={(v) => set("contactLast", v)} placeholder="Doe" />
            {errors.contactLast && <span className="sc-error">{errors.contactLast}</span>}
          </Field>
        </div>
        <div className="sc-grid sc-grid--1">
          <Field label="Email address" required>
            <TextInput value={data.contactEmail || ""} onChange={(v) => set("contactEmail", v)} placeholder="john.doe@staffwise.com" />
            {errors.contactEmail && <span className="sc-error">{errors.contactEmail}</span>}
          </Field>
        </div>
      </div>
    </div>
  );
}

// =====================================================================
// STEP 2 — District markups
// =====================================================================

function Sc_MarkupsStep({ data, onChange }) {
  const [query, setQuery] = useStateSct("");
  const [stateFilter, setStateFilter] = useStateSct([]);
  const [page, setPage] = useStateSct(1);
  const pageSize = 10;
  const allStates = useMemoSct(() => Array.from(new Set(DISTRICTS_RAW.map((d) => d.state))).sort(), []);

  const rows = useMemoSct(() => {
    const opSet = new Set(data.operatingDistricts || []);
    return DISTRICTS_RAW
      .filter((d) => opSet.size === 0 ? true : opSet.has(d.id))
      .filter((d) => stateFilter.length === 0 || stateFilter.includes(d.state))
      .filter((d) => {
        if (!query.trim()) return true;
        const q = query.trim().toLowerCase();
        return d.name.toLowerCase().includes(q) || d.state.toLowerCase().includes(q) || d.code.toLowerCase().includes(q);
      });
  }, [query, stateFilter, data.operatingDistricts]);

  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const pageRows = rows.slice((page - 1) * pageSize, page * pageSize);

  const setMarkup = (id, val) => {
    const num = val === "" ? null : Math.max(0, Math.min(999, Number(val) || 0));
    onChange({ ...data, districtMarkups: { ...data.districtMarkups, [id]: num } });
  };

  const openStateFilter = (e) => openMenu(e.currentTarget, allStates.map((s) => ({
    label: s,
    checked: stateFilter.includes(s),
    onClick: () => setStateFilter((prev) => prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]),
  })));

  const openBulkEdit = () => {
    const ids = pageRows.map((r) => r.id);
    openMarkupEditor({
      districts: districtsById(ids),
      defaults: data.districtMarkups,
      onSave: (next) => onChange({ ...data, districtMarkups: { ...data.districtMarkups, ...next } }),
    });
  };

  return (
    <div className="sc-card">
      <header className="sc-card-head">
        <span className="sc-card-icon" aria-hidden="true">
          <Icon name="Tag" size={20} />
        </span>
        <div className="sc-card-headtext">
          <h2 className="sc-card-title">District markups</h2>
          <p className="sc-card-sub">Set the markup percentage applied per district before position-level overrides.</p>
        </div>
        <button type="button" className="btn btn--sm btn--secondary" onClick={openBulkEdit}>
          <Icon name="Edit" size={14} />Edit selected
        </button>
      </header>

      <div className="sc-card-body">
        <div className="sc-tablebar">
          <div className="inv-search sc-search">
            <span className="inv-search-icon" aria-hidden="true">
              <Icon name="Search" size={20} />
            </span>
            <input
              type="search"
              className="inv-search-input"
              placeholder="Search districts"
              value={query}
              onChange={(e) => { setQuery(e.target.value); setPage(1); }}
              aria-label="Search districts"
            />
          </div>
          <FilterChip
            label="State"
            active={stateFilter.length > 0}
            count={stateFilter.length}
            onClick={openStateFilter}
          />
          {stateFilter.length > 0 && (
            <button type="button" className="req-clear" onClick={() => setStateFilter([])}>Clear</button>
          )}
        </div>

        <div className="sc-table" role="table" aria-label="District markups">
          <div className="sc-trow sc-trow--head" role="row">
            <div className="sc-tcell sc-tcell--district" role="columnheader">District</div>
            <div className="sc-tcell sc-tcell--state" role="columnheader">State</div>
            <div className="sc-tcell sc-tcell--num" role="columnheader">Markup</div>
          </div>
          {pageRows.length === 0 ? (
            <div className="sc-empty-row">No districts match your filters.</div>
          ) : pageRows.map((d) => (
            <div className="sc-trow" key={d.id} role="row">
              <div className="sc-tcell" role="cell">{d.name}</div>
              <div className="sc-tcell sc-tcell--low" role="cell">{d.state}</div>
              <div className="sc-tcell sc-tcell--num" role="cell">
                <input
                  type="number"
                  className="sc-num-input"
                  min="0"
                  max="999"
                  value={data.districtMarkups[d.id] ?? ""}
                  onChange={(e) => setMarkup(d.id, e.target.value)}
                  aria-label={`Markup for ${d.name}`}
                />
                <span className="sc-num-suffix">%</span>
              </div>
            </div>
          ))}
        </div>

        <ScTablePager page={page} total={rows.length} pageSize={pageSize} totalPages={totalPages} onChange={setPage} />
      </div>
    </div>
  );
}

// =====================================================================
// STEP 3 — Rate cards
// =====================================================================

function Sc_RateCardsStep({ data, onChange }) {
  const [tab, setTab] = useStateSct("All positions");
  const [parity, setParity] = useStateSct("Pre-parity");
  const [page, setPage] = useStateSct(1);
  const [selected, setSelected] = useStateSct(() => new Set());
  const pageSize = 10;

  const tabs = useMemoSct(() => ["All positions", ...POSITION_CATEGORIES], []);
  const filtered = useMemoSct(() => {
    if (tab === "All positions") return data.positions;
    const idsInCat = new Set(POSITIONS.filter((p) => p.category === tab).map((p) => p.id));
    return data.positions.filter((p) => idsInCat.has(p.id));
  }, [tab, data.positions]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageRows = filtered.slice((page - 1) * pageSize, page * pageSize);

  const allChecked = pageRows.length > 0 && pageRows.every((r) => selected.has(r.id));
  const toggle = (id) => setSelected((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const toggleAll = () => setSelected((prev) => {
    const next = new Set(prev);
    if (allChecked) pageRows.forEach((r) => next.delete(r.id));
    else pageRows.forEach((r) => next.add(r.id));
    return next;
  });

  const editPosition = (id) => {
    const pos = data.positions.find((p) => p.id === id);
    if (!pos) return;
    openRateCardEditor({
      positions: [pos],
      onSave: (patch) => {
        onChange({
          ...data,
          positions: data.positions.map((p) => p.id === id ? { ...p, ...patch[id] } : p),
        });
      },
    });
  };

  const editSelected = () => {
    const positions = data.positions.filter((p) => selected.has(p.id));
    if (positions.length === 0) {
      showToast("Select positions to edit", { kind: "default" });
      return;
    }
    openRateCardEditor({
      positions,
      onSave: (patch) => {
        onChange({
          ...data,
          positions: data.positions.map((p) => patch[p.id] ? { ...p, ...patch[p.id] } : p),
        });
        setSelected(new Set());
      },
    });
  };

  const district = data.districtMarkups || {};
  const avgDistrictMarkup = useMemoSct(() => {
    const opIds = data.operatingDistricts || [];
    if (opIds.length === 0) return 25;
    const vals = opIds.map((id) => district[id] ?? 20).filter((n) => n != null);
    if (vals.length === 0) return 25;
    return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
  }, [data.operatingDistricts, district]);

  const billRate = (p) => {
    const base = p.payRate;
    const dist = avgDistrictMarkup;
    const pos  = p.positionMarkup || 0;
    // Lowest level (position) takes precedence over district when enabled.
    const effective = pos || dist;
    return Math.round(base * (1 + effective / 100));
  };

  return (
    <div className="sc-card">
      <header className="sc-card-head">
        <span className="sc-card-icon" aria-hidden="true">
          <Icon name="Pay" size={20} />
        </span>
        <div className="sc-card-headtext">
          <h2 className="sc-card-title">Rate cards</h2>
          <p className="sc-card-sub">Set per-position markups and tier rates. Position-level markups take precedence when enabled.</p>
        </div>
        <button type="button" className="btn btn--sm btn--secondary" onClick={editSelected}>
          <Icon name="Edit" size={14} />Edit selected ({selected.size})
        </button>
      </header>

      <div className="sc-card-body">
        {/* Category tabs */}
        <div className="sc-tabs" role="tablist">
          {tabs.map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={t === tab}
              className={`sc-tab ${t === tab ? "sc-tab--active" : ""}`}
              onClick={() => { setTab(t); setPage(1); }}
            >{t}</button>
          ))}
        </div>

        {/* Parity segmented control */}
        <div className="sc-parity" role="tablist" aria-label="Parity">
          {["Pre-parity", "Post-parity"].map((p) => (
            <button
              key={p}
              type="button"
              role="tab"
              aria-selected={p === parity}
              className={`sc-parity-btn ${p === parity ? "sc-parity-btn--active" : ""}`}
              onClick={() => setParity(p)}
            >{p}</button>
          ))}
        </div>

        <div className="sc-table sc-table--rate" role="table" aria-label="Rate cards">
          <div className="sc-trow sc-trow--head sc-trow--rate" role="row">
            <div className="sc-tcell sc-tcell--check" role="columnheader">
              <input type="checkbox" checked={allChecked} onChange={toggleAll} aria-label="Select all" />
            </div>
            <div className="sc-tcell" role="columnheader">Position</div>
            <div className="sc-tcell" role="columnheader">Status</div>
            <div className="sc-tcell sc-tcell--num" role="columnheader">District markup</div>
            <div className="sc-tcell sc-tcell--num" role="columnheader">Position markup</div>
            <div className="sc-tcell sc-tcell--num" role="columnheader">Tier markup</div>
            <div className="sc-tcell sc-tcell--num" role="columnheader">Pay rate</div>
            <div className="sc-tcell sc-tcell--actions" role="columnheader" aria-label="Actions"></div>
          </div>
          {pageRows.map((p) => (
            <div className="sc-trow sc-trow--rate" key={p.id} role="row">
              <div className="sc-tcell sc-tcell--check" role="cell">
                <input
                  type="checkbox"
                  checked={selected.has(p.id)}
                  onChange={() => toggle(p.id)}
                  aria-label={`Select ${p.name}`}
                />
              </div>
              <div className="sc-tcell" role="cell">{p.name}</div>
              <div className="sc-tcell" role="cell">
                <span className={`sc-pill sc-pill--${p.enabled ? "ok" : "off"}`}>
                  <Icon name={p.enabled ? "Check" : "Cancel"} size={12} />
                  {p.enabled ? "Enabled" : "Disabled"}
                </span>
              </div>
              <div className="sc-tcell sc-tcell--num tabular" role="cell">{fmtMarkup(avgDistrictMarkup)}</div>
              <div className="sc-tcell sc-tcell--num tabular" role="cell">{fmtMarkup(p.positionMarkup)}</div>
              <div className="sc-tcell sc-tcell--num tabular" role="cell">
                {p.tierEnabled ? TIERS.map((t) => fmtMarkup(t.markup)).join(" / ") : "—"}
              </div>
              <div className="sc-tcell sc-tcell--num tabular" role="cell">{((window.curSymbol && window.curSymbol()) || "$") + billRate(p)}</div>
              <div className="sc-tcell sc-tcell--actions" role="cell">
                <button
                  type="button"
                  className="iconbtn"
                  aria-label={`Edit ${p.name}`}
                  onClick={() => editPosition(p.id)}
                >
                  <Icon name="Edit" size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>

        <ScTablePager page={page} total={filtered.length} pageSize={pageSize} totalPages={totalPages} onChange={setPage} />
      </div>
    </div>
  );
}

// =====================================================================
// STEP 4 — Review (read-only summary of all sections)
// =====================================================================

function Sc_ReviewStep({ data }) {
  const districts = districtsById(data.operatingDistricts || []);
  return (
    <React.Fragment>
      <div className="sc-card">
        <header className="sc-card-head">
          <span className="sc-card-icon" aria-hidden="true"><Icon name="Building" size={20} /></span>
          <div className="sc-card-headtext">
            <h2 className="sc-card-title">{data.name || "New agency"}</h2>
            <p className="sc-card-sub">Review before sending the invite.</p>
          </div>
        </header>
        <div className="sc-card-body sc-review-body">
          <h3 className="sc-group-title">Essentials</h3>
          <dl className="sc-review-dl">
            <dt>Name</dt><dd>{data.name || "—"}</dd>
            <dt>Address</dt><dd>{data.address || "—"}</dd>
            <dt>Zip code</dt><dd className="tabular">{data.zip || "—"}</dd>
            <dt>Legal entity</dt><dd>{data.legalEntity || "—"}</dd>
            <dt>Pricing configuration</dt><dd>{data.pricingConfig || "—"}</dd>
          </dl>

          <h3 className="sc-group-title sc-group-title--spaced">Area of operations</h3>
          <dl className="sc-review-dl">
            <dt>Operating state(s)</dt>
            <dd>{(data.operatingStates || []).length === 0 ? "—" : (data.operatingStates || []).map((s) => <span className="sc-chip sc-chip--read" key={s}>{s}</span>)}</dd>
            <dt>Operating district(s)</dt>
            <dd>
              {districts.length === 0 ? "—" : districts.map((d) => (
                <span className="sc-chip sc-chip--read" key={d.id}>{d.code} – {d.name}</span>
              ))}
            </dd>
          </dl>

          <h3 className="sc-group-title sc-group-title--spaced">Contact information</h3>
          <dl className="sc-review-dl">
            <dt>First name</dt><dd>{data.contactFirst || "—"}</dd>
            <dt>Last name</dt><dd>{data.contactLast || "—"}</dd>
            <dt>Email address</dt><dd>{data.contactEmail || "—"}</dd>
          </dl>
        </div>
      </div>

      <DistrictMarkupsCard
        data={data}
        readOnly
        title="District markups"
      />

      <RateCardsCard
        data={data}
        readOnly
        title="Rate cards"
      />
    </React.Fragment>
  );
}

// =====================================================================
// Wizard shell
// =====================================================================

function SupplierContractWizard({ mode = "invite", supplierId, onCancel, onComplete }) {
  const seed = mode === "edit" && supplierId
    ? getSupplierContract(supplierId)
    : null;

  const [data, setData] = useStateSct(() => seed ? structuredClone(seed) : ({
    name: "",
    address: "",
    zip: "",
    legalEntity: "",
    pricingConfig: "",
    operatingStates: [],
    operatingDistricts: [],
    contactFirst: "",
    contactLast: "",
    contactEmail: "",
    districtMarkups: Object.fromEntries(DISTRICTS_RAW.map((d) => [d.id, DISTRICT_MARKUP_SEEDS[d.id] ?? 20])),
    positions: POSITIONS.map((p) => ({
      id: p.id, name: p.name, enabled: true, positionMarkup: null,
      tierEnabled: false, payRate: p.payRate,
    })),
  }));
  const [step, setStep] = useStateSct(1);
  const [errors, setErrors] = useStateSct({});
  const [showConfirm, setShowConfirm] = useStateSct(false);

  const sup = mode === "edit"
    ? (window.SUPPLIERS || []).find((s) => s.id === supplierId)
    : null;

  const validateStep1 = () => {
    const e = {};
    if (!data.name?.trim()) e.name = "Required.";
    if (!data.address?.trim()) e.address = "Required.";
    if (!data.zip?.trim()) e.zip = "Required.";
    if (!data.contactFirst?.trim()) e.contactFirst = "Required.";
    if (!data.contactLast?.trim()) e.contactLast = "Required.";
    if (!data.contactEmail?.trim()) e.contactEmail = "Required.";
    else if (!/^\S+@\S+\.\S+$/.test(data.contactEmail)) e.contactEmail = "Enter a valid email.";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const next = () => {
    if (step === 1 && !validateStep1()) return;
    setStep((s) => Math.min(4, s + 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const prev = () => {
    setStep((s) => Math.max(1, s - 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const finish = () => {
    if (mode === "edit") {
      setShowConfirm(true);
    } else {
      showToast(`Invite sent to ${data.contactEmail || data.name || "agency"}`, { kind: "success" });
      onComplete && onComplete(data);
    }
  };

  const confirmUpdate = () => {
    CONTRACT_CACHE[supplierId] = { ...getSupplierContract(supplierId), ...data };
    setShowConfirm(false);
    showToast(`${sup?.name || "Agency"} contract updated`, { kind: "success" });
    onComplete && onComplete(data);
  };

  const title = mode === "edit" ? `Edit ${sup?.name || "agency"} contract` : "Invite agency";
  const subtitle = mode === "edit"
    ? "Update agency details, district markups, and rate cards."
    : "Set up the new agency contract over four steps.";

  return (
    <React.Fragment>
      <ReqOmnibar
        title={title}
        subtitle={mode === "edit" ? "Suppliers" : "Suppliers"}
        onBack={onCancel}
      />

      <div className="sc-wizard">
        <div className="sc-wizard-stepper">
          <StepperBar step={step} />
        </div>

        {/* v0.77 spec §14 · Billing Models accordion preview. Phase 4
            adds a per-contract Billing Models section (Clock × Timesheet
            × Milestone × Fixed Fee) with per-model rate schedules. */}
        {window.V77InfoBanner ? (
          <window.V77InfoBanner
            icon="Information"
            title="Billing Models accordion arrives in Phase 4."
          >
            Each contract will declare which Billing Models it authorizes (Clock In/Out, Timesheet, Milestone, Fixed Fee) with a rate schedule per model. Today&rsquo;s contract reads as Clock In/Out by default.
          </window.V77InfoBanner>
        ) : null}

        <div className="sc-wizard-body">
          {step === 1 && <Sc_DetailsStep data={data} onChange={setData} errors={errors} mode={mode} />}
          {step === 2 && <Sc_MarkupsStep data={data} onChange={setData} />}
          {step === 3 && <Sc_RateCardsStep data={data} onChange={setData} />}
          {step === 4 && <Sc_ReviewStep data={data} />}
        </div>

        <footer className="sc-wizard-footer">
          <div className="sc-wizard-footer-left">
            {step > 1 && (
              <button type="button" className="btn btn--lg btn--tertiary" onClick={prev}>
                <Icon name="ChevronLeft" size={16} />Back
              </button>
            )}
          </div>
          <div className="sc-wizard-footer-right">
            <button type="button" className="btn btn--lg btn--tertiary" onClick={onCancel}>Cancel</button>
            {step < 4 && (
              <button type="button" className="btn btn--lg btn--primary" onClick={next}>
                Continue<Icon name="ChevronRight" size={16} />
              </button>
            )}
            {step === 4 && (
              <button type="button" className="btn btn--lg btn--primary" onClick={finish}>
                {mode === "edit" ? "Update contract" : "Send invite"}
              </button>
            )}
          </div>
        </footer>
      </div>

      {showConfirm && (
        <div className="sc-modal-scrim" role="presentation" onClick={() => setShowConfirm(false)}>
          <div className="sc-modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <h2 className="sc-modal-title">Update contract?</h2>
            <p className="sc-modal-body">
              Updating this contract might notify the agency. Are you sure you want to proceed with the changes?
            </p>
            <div className="sc-modal-foot">
              <button type="button" className="btn btn--md btn--tertiary" onClick={() => setShowConfirm(false)}>Cancel</button>
              <button type="button" className="btn btn--md btn--primary" onClick={confirmUpdate}>Update contract</button>
            </div>
          </div>
        </div>
      )}
    </React.Fragment>
  );
}

// =====================================================================
// Tiny pager component shared between Step 2 / Step 3 / details cards
// =====================================================================
function ScTablePager({ page, total, pageSize, totalPages, onChange }) {
  if (total === 0) return null;
  const first = (page - 1) * pageSize + 1;
  const last = Math.min(total, page * pageSize);
  return (
    <div className="sc-pager">
      <span className="sc-pager-summary">Showing {first}-{last} of {total}</span>
      <div className="sc-pager-right">
        <label className="sc-pager-label">Rows per page</label>
        <span className="sc-pager-pill">{pageSize}</span>
        <label className="sc-pager-label">Page</label>
        <input
          type="number"
          className="sc-num-input sc-num-input--page"
          value={page}
          min="1"
          max={totalPages}
          onChange={(e) => onChange(Math.max(1, Math.min(totalPages, Number(e.target.value) || 1)))}
          aria-label="Page number"
        />
        <button
          type="button"
          className="iconbtn"
          aria-label="Previous page"
          disabled={page <= 1}
          onClick={() => onChange(Math.max(1, page - 1))}
        >
          <Icon name="ChevronLeft" size={16} />
        </button>
        <button
          type="button"
          className="iconbtn"
          aria-label="Next page"
          disabled={page >= totalPages}
          onClick={() => onChange(Math.min(totalPages, page + 1))}
        >
          <Icon name="ChevronRight" size={16} />
        </button>
      </div>
    </div>
  );
}

// ---------- Rate-card helpers (used by RateCardsCard + breakdown) ----
// Currency symbol for a position row. Falls back to the contract
// default, then to curSymbol() (active country), then to "$".
function rowCurrencySymbol(p, contract) {
  const cur = (p && p.currency) || (contract && contract.defaultCurrency) || "USD";
  if (typeof window !== "undefined" && window.curSymbol) {
    // curSymbol reads __activeCurrencySymbol — only use it when the
    // row's currency matches the active country. Otherwise show a
    // hard-coded symbol so multi-currency rows stay legible.
    if (cur === "USD") return window.curSymbol();
  }
  const map = { USD: "$", EUR: "€", GBP: "£", CAD: "C$", AUD: "A$", MXN: "Mex$" };
  return map[cur] || "$";
}

// Classification meta for a position row.
function rowClassification(p) {
  return CLASSIFICATIONS.find((c) => c.id === (p && p.classification)) || CLASSIFICATIONS[0];
}

// Skill premiums attached to a row, with their %.
function rowSkillPremiums(p) {
  const ids = (p && p.skillIds) || [];
  return SKILL_PREMIUMS.filter((s) => ids.includes(s.id));
}

// Number that pricing-config-driven layers add to a row's pay rate
// before markup applies. Burden + skill premiums stack additively;
// shift differentials are surfaced separately (a single row carries a
// "regular" bill rate; night and weekend hits show via a popover).
function rowAdditiveLoadPct(p) {
  const cls = rowClassification(p);
  const skills = rowSkillPremiums(p);
  const skillPct = skills.reduce((a, s) => a + s.pct, 0);
  return (cls.burdenPct || 0) + skillPct;
}

// =====================================================================
// v0.79 · F2 / F3 / F6 — Rate engine.
//
// runRateStages(p, contract, ctx) is the staged-reducer replacement
// for the inline `base × (1 + load) × (1 + markup)` expression.
//
// Stages (in order):
//   1. base            from row (payRatePref / payRate, or shift variant
//                      chosen by ctx.shift)
//   2. premiums        target="premium" rules (night / weekend / holiday),
//                      gated by ctx.shift / ctx.isHoliday
//   3. contributions   target="contribution" rules (NI, pension, FICA)
//   4. skills          target="skill" rules filtered by row.skillIds[]
//   5. tenure          target="tenure" band rules resolved against
//                      ctx.workerTenureDays
//   6. markup          existing position → district → average chain
//   7. taxes           target="tax" rules applied to final bill rate
//
// Each stage returns a delta (a number added to the running total) and
// a `meta` blob the popover uses to label the line. The reducer falls
// back to the legacy `rowAdditiveLoadPct` calc when no pricing-config
// rules are bound to the contract — every legacy row still resolves.
// =====================================================================
const RATE_STAGES = [
  "base",
  "premium",
  "contribution",
  "skill",
  "tenure",
  "markup",
  "tax",
];

function _isRuleActive(rule, ctx) {
  if (!rule) return false;
  const eff = rule.effective || {};
  const at = (ctx && ctx.date) ? new Date(ctx.date) : new Date();
  if (eff.from && new Date(eff.from) > at) return false;
  if (eff.to   && new Date(eff.to)   < at) return false;
  const sc = rule.scope || {};
  if (sc.countries && sc.countries.length > 0 && ctx && ctx.country && !sc.countries.includes(ctx.country)) return false;
  if (sc.currencies && sc.currencies.length > 0 && ctx && ctx.currency && !sc.currencies.includes(ctx.currency)) return false;
  return true;
}

// v0.81 · Rate-engine recommendations #5 — explicit stacking order.
// Sort a rule set by the rule's `primitive.order` (Fieldglass Rate
// Component Group stacking). Rules without an explicit order keep their
// authored sequence (stable sort, treated as order 0).
function _byStackOrder(rules) {
  return rules
    .map((r, i) => [r, i])
    .sort((a, b) => {
      const oa = (a[0].primitive && a[0].primitive.order != null) ? a[0].primitive.order : 0;
      const ob = (b[0].primitive && b[0].primitive.order != null) ? b[0].primitive.order : 0;
      return oa - ob || a[1] - b[1];
    })
    .map((x) => x[0]);
}

// v0.81 · Rate-engine recommendations #12 — resolve the threshold shape
// authored on the bound pricing configuration (ceilingBill / marginFloor).
// Read from the live store first so an admin edit propagates; falls back
// to a frozen copy on the contract.
function contractThreshold(contract) {
  if (!contract) return null;
  const store = (typeof window !== "undefined" && window.getPcfgStore) ? window.getPcfgStore() : null;
  if (store) {
    const cfg = (contract.pricingConfigId && store.find((c) => c.id === contract.pricingConfigId))
      || store.find((c) => c.name === contract.pricingConfig);
    if (cfg && cfg.threshold) return cfg.threshold;
  }
  return contract.pricingThreshold || null;
}

// Which engine stages the supplier (agency) is allowed to see. Buyer
// markup and tax layers are internal margin — hidden on the agency-side
// popover (#13). Everything else is shared.
const _INTERNAL_STAGES = { markup: true, tax: true };
function _stageVisibility(stage) {
  return _INTERNAL_STAGES[stage] ? "internal" : "shared";
}

function _resolveBand(bands, days) {
  if (!Array.isArray(bands) || bands.length === 0) return 0;
  const sorted = bands.slice().sort((a, b) => (a.lt || 0) - (b.lt || 0));
  for (const b of sorted) if ((days || 0) < (b.lt || 0)) return b.value || 0;
  return sorted[sorted.length - 1].value || 0;
}

// Picks the right base for the shift requested in ctx — falls back to
// the row's payVariants[regular].payRate if present, else payRatePref /
// payRate. ctx.shift can be "regular" / "night" / "weekend" / "holiday".
//
// v0.81 · Rate-engine recommendations #8 + #9 — rate-type + derived rate.
//   · rateType "coefficient" → base is a stored multiplier × pay.
//   · rateType "factor"      → base is factorOf × another row, resolved
//                              from ctx.positions / contract.positions.
//   · derivedFrom { baseRowId, factor } → resolve the named base row's
//                              pay and apply the factor (e.g. holiday =
//                              regular × 1.5) instead of re-authoring.
function _resolveSiblingRow(id, p, contract, ctx) {
  const pool = (ctx && ctx.positions) || (contract && contract.positions) || [];
  return pool.find((row) => row.id === id) || null;
}
function _basePayFor(p, ctx, contract) {
  const shift = (ctx && ctx.shift) || "regular";
  // Derived rate — base off a named sibling row × factor.
  if (p && p.derivedFrom && p.derivedFrom.baseRowId) {
    const baseRow = _resolveSiblingRow(p.derivedFrom.baseRowId, p, contract, ctx);
    if (baseRow) {
      const baseVal = _basePayFor(baseRow, { ...ctx, shift: "regular" }, contract);
      return baseVal * (p.derivedFrom.factor || 1);
    }
  }
  // Coefficient — stored multiplier applied to the row's own pay.
  if (p && p.rateType === "coefficient" && p.coefficient != null) {
    return ((p.payRatePref || p.payRate) || 0) * p.coefficient;
  }
  if (p && Array.isArray(p.payVariants)) {
    const variant = p.payVariants.find((v) => v.kind === shift);
    if (variant && variant.payRate != null) return variant.payRate;
  }
  return (p && (p.payRatePref || p.payRate)) || 0;
}

function _avgDistrictMarkup(contract) {
  if (!contract) return 25;
  const opIds = contract.operatingDistricts || [];
  if (opIds.length === 0) return 25;
  const vals = opIds.map((id) => contract.districtMarkups?.[id]).filter((n) => n != null);
  if (vals.length === 0) return 25;
  return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
}

// v0.80 · A3 — Resolve the rule set the engine runs for a contract.
//
// Preference order:
//   1. LIVE from the store, keyed by the contract's bound config
//      (pricingConfigId first, then pricingConfig name). This is the
//      wire: editing a config in Settings → Pricing moves the bill
//      rate on every bound contract on the next render.
//   2. The contract's frozen pricingConfigRules snapshot (offline /
//      store-unreachable fallback).
//   3. The default structure (legacy contracts with neither).
function contractPricingRules(contract) {
  if (!contract) return [];
  const flatten = (typeof window !== "undefined" && window.rulesFromStructure) ? window.rulesFromStructure : null;
  const store = (typeof window !== "undefined" && window.getPcfgStore) ? window.getPcfgStore() : null;
  if (store && flatten) {
    const cfg = (contract.pricingConfigId && store.find((c) => c.id === contract.pricingConfigId))
      || store.find((c) => c.name === contract.pricingConfig);
    if (cfg && cfg.structure) return flatten(cfg.structure);
  }
  if (contract.pricingConfigRules && contract.pricingConfigRules.length) return contract.pricingConfigRules;
  if (flatten) return flatten(contract.structure || (typeof window !== "undefined" && window.PCFG_DEFAULT_STRUCTURE) || []);
  return [];
}

// The staged reducer. Returns the final bill rate AND the breakdown the
// M1 popover renders so the engine + the UI never drift.
function runRateStages(p, contract, ctx) {
  ctx = ctx || {};
  const rules = contractPricingRules(contract);
  const filterFor = (target) => _byStackOrder(rules.filter((r) =>
    r.primitive && r.primitive.target === target && _isRuleActive(r, ctx)
  ));

  const breakdown = [];
  let amount = _basePayFor(p, ctx, contract);
  breakdown.push({ stage: "base", label: "Base pay", value: amount, delta: amount, kind: "amount", visibility: "shared" });

  // Stage 2 — premiums (multiplicative on the running base).
  const shift = (ctx && ctx.shift) || "regular";
  const isHoliday = !!(ctx && ctx.isHoliday);
  const premiums = filterFor("premium");
  let premiumPct = 0;
  premiums.forEach((r) => {
    const variant = r.primitive.variant;
    if (variant === "night"    && shift !== "night")    return;
    if (variant === "weekend"  && shift !== "weekend")  return;
    if (variant === "holiday"  && !isHoliday)            return;
    let pct = 0;
    if (r.primitive.kind === "percentage") pct = r.primitive.value || 0;
    if (r.primitive.kind === "multiplier") pct = ((r.primitive.value || 1) - 1) * 100;
    if (pct) {
      const delta = amount * pct / 100;
      amount += delta;
      premiumPct += pct;
      breakdown.push({ stage: "premium", label: r.name, value: pct, delta, kind: "percentage" });
    }
  });

  // Stage 3 — contributions (employer-side burden, additive on base).
  const contributions = filterFor("contribution");
  let contributionPct = 0;
  // Fallback to legacy classification burden when no typed rules apply.
  if (contributions.length === 0) {
    const cls = rowClassification(p);
    if (cls && cls.burdenPct) {
      contributionPct = cls.burdenPct;
      const delta = amount * contributionPct / 100;
      amount += delta;
      breakdown.push({ stage: "contribution", label: `${cls.label} burden (legacy)`, value: contributionPct, delta, kind: "percentage", legacy: true });
    }
  } else {
    contributions.forEach((r) => {
      const pct = r.primitive.value || 0;
      contributionPct += pct;
      const delta = amount * pct / 100;
      amount += delta;
      breakdown.push({ stage: "contribution", label: r.name, value: pct, delta, kind: "percentage" });
    });
  }

  // Stage 4 — skill premiums filtered by row.skillIds[].
  const skillRules = filterFor("skill");
  const skillIds = (p && p.skillIds) || [];
  let skillPct = 0;
  if (skillRules.length === 0) {
    // Legacy SKILL_PREMIUMS path.
    const legacy = rowSkillPremiums(p);
    legacy.forEach((s) => {
      skillPct += s.pct;
      const delta = (p.payRatePref || p.payRate || 0) * s.pct / 100;
      amount += delta;
      breakdown.push({ stage: "skill", label: s.label, value: s.pct, delta, kind: "percentage", legacy: true });
    });
  } else {
    skillRules.forEach((r) => {
      const sid = r.primitive.skillId;
      if (!sid || !skillIds.includes(sid)) return;
      const pct = r.primitive.value || 0;
      skillPct += pct;
      const delta = (p.payRatePref || p.payRate || 0) * pct / 100;
      amount += delta;
      breakdown.push({ stage: "skill", label: r.name, value: pct, delta, kind: "percentage" });
    });
  }

  // Stage 5 — tenure band against ctx.workerTenureDays.
  const tenureRules = filterFor("tenure");
  let tenurePct = 0;
  tenureRules.forEach((r) => {
    if (r.primitive.kind !== "band") return;
    const days = (ctx && ctx.workerTenureDays != null) ? ctx.workerTenureDays : null;
    if (days == null) return;
    const pct = _resolveBand(r.primitive.bands, days);
    if (!pct) return;
    tenurePct += pct;
    const delta = amount * pct / 100;
    amount += delta;
    breakdown.push({ stage: "tenure", label: r.name, value: pct, delta, kind: "percentage" });
  });

  // Stage 6 — markup (existing position → district → average chain).
  // v0.81 · #5 — honor the markup rule's `basis`: "pay" applies markup
  // to base pay only, "subtotal"/"running" (default) to the running
  // amount. The rule's basis comes from the bound config; position /
  // district markup percentages still win for the rate.
  const markupRule = filterFor("markup")[0];
  const markupBasis = (markupRule && markupRule.primitive && markupRule.primitive.basis) || "subtotal";
  const positionMarkup = (p && p.positionMarkup) || 0;
  const districtMarkup = (ctx && ctx.districtMarkup != null) ? ctx.districtMarkup : _avgDistrictMarkup(contract);
  const markupPct = positionMarkup || districtMarkup || 0;
  if (markupPct) {
    const markupBase = markupBasis === "pay" ? _basePayFor(p, ctx, contract) : amount;
    const delta = markupBase * markupPct / 100;
    amount += delta;
    breakdown.push({
      stage: "markup",
      label: positionMarkup ? "Position markup" : "District markup",
      value: markupPct, delta, kind: "percentage", basis: markupBasis,
    });
  }

  // Stage 7 — taxes on the final bill rate.
  const taxRules = filterFor("tax");
  let taxPct = 0;
  taxRules.forEach((r) => {
    const pct = r.primitive.value || 0;
    taxPct += pct;
    const delta = amount * pct / 100;
    amount += delta;
    breakdown.push({ stage: "tax", label: r.name, value: pct, delta, kind: "percentage" });
  });

  // Tag visibility on every line (shared vs internal margin) and build a
  // normalised components[] with a running subtotal at each step — the
  // canonical shape computeBillRate exposes to every downstream surface.
  let running = 0;
  const components = breakdown.map((b, i) => {
    running += (b.delta || 0);
    const visibility = b.visibility || _stageVisibility(b.stage);
    b.visibility = visibility;
    return {
      id: `${b.stage}-${i}`,
      stage: b.stage,
      label: b.label,
      kind: b.kind,
      pct: b.kind === "percentage" ? (b.value || 0) : null,
      amount: Math.round((b.delta || 0) * 100) / 100,
      runningSubtotal: Math.round(running * 100) / 100,
      visibility,
      basis: (b.basis || (b.stage === "tax" ? "running" : b.stage === "markup" ? "subtotal" : "pay")),
      legacy: !!b.legacy,
    };
  });

  // v0.81 · #12 — threshold evaluation against the bound config.
  const bill = Math.round(amount * 100) / 100;
  const th = contractThreshold(contract);
  let thresholds = { breached: false, by: null, ceilingBill: null, marginFloor: null };
  if (th) {
    thresholds.ceilingBill = th.ceilingBill != null ? th.ceilingBill : null;
    thresholds.marginFloor = th.marginFloor != null ? th.marginFloor : null;
    const basePay = _basePayFor(p, ctx, contract);
    const margin = bill > 0 ? Math.round(((bill - basePay) / bill) * 1000) / 10 : 0;
    if (th.ceilingBill != null && bill > th.ceilingBill) {
      thresholds.breached = true;
      thresholds.by = "ceiling";
      thresholds.overBy = Math.round((bill - th.ceilingBill) * 100) / 100;
    } else if (th.marginFloor != null && margin < th.marginFloor) {
      thresholds.breached = true;
      thresholds.by = "margin";
      thresholds.marginPct = margin;
    }
  }

  return {
    billRate: bill,
    base: _basePayFor(p, ctx, contract),
    premiumPct, contributionPct, skillPct, tenurePct,
    markupPct, taxPct,
    breakdown,
    components,
    thresholds,
  };
}

// =====================================================================
// v0.81 · Rate-engine recommendations #2 — the canonical engine.
//
// computeBillRate(row, config, ctx) → { pay, components[], bill, thresholds }
//
// One pure function, the public face of the engine. `config` may be a
// pricing-config id ("pc-001"), a config name, a full config record, or
// a contract-shaped object that already carries pricingConfigId. It
// normalises that to the contract shape runRateStages consumes, then
// returns the spec's { pay, components[], bill } shape — components[] is
// the ordered, running-subtotalled, visibility-tagged list every
// downstream surface (popover, quote card, analytics, invoice writer)
// reads instead of re-deriving the math.
// =====================================================================
function _asContract(config) {
  if (!config) return {};
  // Already a contract-ish object.
  if (config.pricingConfigId || config.pricingConfig || config.positions) return config;
  // A pricing-config record.
  if (config.id && (config.structure || config.status)) {
    return { pricingConfigId: config.id, pricingConfig: config.name };
  }
  // A bare id or name string.
  if (typeof config === "string") {
    const store = (typeof window !== "undefined" && window.getPcfgStore) ? window.getPcfgStore() : [];
    const byId = store.find((c) => c.id === config);
    if (byId) return { pricingConfigId: byId.id, pricingConfig: byId.name };
    return { pricingConfig: config };
  }
  return config;
}
function computeBillRate(row, config, ctx) {
  const contract = _asContract(config);
  const r = runRateStages(row || {}, contract, ctx || {});
  return {
    pay: r.base,
    bill: r.billRate,
    components: r.components,
    thresholds: r.thresholds,
    // Roll-up percentages kept for callers that only need the totals.
    totals: {
      premiumPct: r.premiumPct, contributionPct: r.contributionPct,
      skillPct: r.skillPct, tenurePct: r.tenurePct,
      markupPct: r.markupPct, taxPct: r.taxPct,
    },
  };
}

// Filter an engine result's components[] for a viewer role. Agencies
// (suppliers) never see internal margin layers (#13).
function componentsForRole(components, role) {
  const isAgency = role === "agency" || role === "supplier"
    || (typeof window !== "undefined" && window.flexViewAsRole === "agency");
  if (!isAgency) return components;
  return (components || []).filter((c) => c.visibility !== "internal");
}

// =====================================================================
// v0.79 · G1 — Statutory minimum-wage table.
//
// Country / state floors. The agency + buyer rate-card surfaces read
// this through getMinimumWage(country, currency) and flag any row
// within 5% of the floor (yellow) or below it (block save). Real
// implementation reads from pages/locales.jsx — for the prototype we
// keep a small table here so this module remains self-contained.
// =====================================================================
const MIN_WAGE_TABLE = [
  { country: "US", currency: "USD", value: 7.25,  authority: "Federal FLSA" },
  { country: "GB", currency: "GBP", value: 11.44, authority: "National Living Wage (23+)" },
  { country: "CA", currency: "CAD", value: 17.30, authority: "Federal minimum (CA)" },
  { country: "DE", currency: "EUR", value: 12.41, authority: "Mindestlohn" },
  { country: "AU", currency: "AUD", value: 24.10, authority: "Fair Work National Minimum" },
  { country: "MX", currency: "MXN", value: 248.93, authority: "Salario Mínimo General" },
];
function getMinimumWage(country, currency) {
  if (!country && !currency) return null;
  return MIN_WAGE_TABLE.find((r) =>
    (country && r.country === country) || (currency && r.currency === currency)
  ) || null;
}
// Returns "ok" | "warn" (within 5% of floor) | "block" (below floor).
function checkPayFloor(payRate, country, currency) {
  const row = getMinimumWage(country, currency);
  if (!row || !payRate) return { status: "ok", floor: null, authority: null };
  if (payRate < row.value)         return { status: "block", floor: row.value, authority: row.authority, currency: row.currency };
  if (payRate < row.value * 1.05)  return { status: "warn",  floor: row.value, authority: row.authority, currency: row.currency };
  return { status: "ok", floor: row.value, authority: row.authority, currency: row.currency };
}

Object.assign(window, {
  SupplierContractWizard, getSupplierContract,
  getSupplierFunding, resolveSupplierFundingPct, setSupplierFunding,
  DISTRICTS_RAW, POSITIONS, TIERS, LEGAL_ENTITIES, POSITION_CATEGORIES,
  CLASSIFICATIONS, SKILL_PREMIUMS,
  districtsById, fmtMarkup,
  rowCurrencySymbol, rowClassification, rowSkillPremiums, rowAdditiveLoadPct,
  RATE_STAGES, runRateStages, contractPricingRules,
  computeBillRate, componentsForRole, contractThreshold,
  pricingConfigByName,
  MIN_WAGE_TABLE, getMinimumWage, checkPayFloor,
});
