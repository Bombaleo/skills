// =====================================================================
// Flex Work — Industry packs
//   The demo can be themed as one of 5 industries. Each pack supplies:
//     · An org display name, short tag, brand-color, and logo path.
//     · A `localize` map that rewrites the prominent location & job
//       labels in the manufacturing-flavoured base data into industry
//       language (e.g. "Warehouse #35" → "Store #35").
//
//   Industry choice is persisted to localStorage (`flexwork.industry`)
//   and read at page-load. Changing the industry triggers a full page
//   reload so module-level const arrays re-evaluate against the new
//   localize map.
//
//   The map is applied longest-key-first so longer terms ("Inventory
//   Warehouse Kappa") match before shorter ones ("Warehouse").
// =====================================================================

const INDUSTRIES = {
  // ----- Dayforce platform org -----------------------------------------
  // The top-level platform tenant. This is the home org for the Systems
  // Admin role: the only place where Settings → Organizations is
  // available, and the seat from which new customer organizations are
  // created and existing ones are managed. It is NOT an operational
  // buyer tenant — it carries no localize map (identity, base data) and
  // exists to administer the orgs beneath it.
  dayforce: {
    id:         "dayforce",
    name:       "Dayforce",
    tag:        "Platform",
    kind:       "platform",
    logo:       "assets/dayforce-logo.svg",
    accent:     "#3067DB",
    localize:   {},   // identity — platform org sees base data
  },

  manufacturing: {
    id:         "manufacturing",
    name:       "Atlas Manufacturing Co.",
    tag:        "Manufacturing",
    logo:       "assets/org-manufacturing.svg",
    accent:     "#3067DB",
    localize:   {},   // identity — base data is manufacturing-flavoured
  },

  hospitality: {
    id:         "hospitality",
    name:       "Aurora Hotels & Resorts",
    tag:        "Hospitality",
    logo:       "assets/org-hospitality.svg",
    accent:     "#C2410C",
    localize: {
      // Locations
      "Manufacturing Site":      "Hotel Property",
      "Inventory Warehouse":     "Housekeeping Hub",
      "Distribution Center":     "Conference Center",
      "Freight Terminal":        "Banquet Hall",
      "Supply Chain Nexus":      "Concierge Annex",
      "Cargo Depot":             "Bell Bay",
      "Shipping Dock":           "Service Wing",
      "Transport Hub":           "Valet Bay",
      "Logistics Hub":           "Atrium",
      "Storage Facility":        "Linen Suite",
      "Warehouse":               "Resort Wing",
      "Sam\u2019s Chalet":       "Aurora Lodge",
      // Addresses
      "Industrial Way":          "Resort Way",
      "Cargo Blvd.":             "Beachfront Blvd.",
      "Logistics Pkwy.":         "Promenade Pkwy.",
      "Trade Center":            "Hotel Plaza",
      "Storage Way":             "Lobby Lane",
      "Old Industrial Rd.":      "Bayshore Rd.",
      // Job titles
      "Production Line Associate": "Banquet Server",
      "Factory Line Assembler":  "Banquet Server",
      "Warehouse Associate":     "Housekeeping Attendant",
      "Warehouse Clerk":         "Housekeeping Attendant",
      "Material Handler":        "Bellhop",
      "Machine Operator":        "Maintenance Tech",
      "Forklift Operator":       "Valet Driver",
      "Quality Inspector":       "Guest Experience Lead",
      "Line Managers":           "Front Office Managers",
      "Line Manager":            "Front Office Manager",
      "Production Associate":       "Front Desk Agent",
      "Loader / Unloader":       "Luggage Porter",
      "Pickers":                 "Room Attendants",
      "Picker":                  "Room Attendant",
      "Packers":                 "Turn-down Attendants",
      "Sorter":                  "Concierge",
      "Operator":                "Concierge",
      "Assembler":               "Banquet Server",
      "Inspector":               "Guest Experience Lead",
      // Cost centers
      "Warehouse #32":           "Property #32",
      "Warehouse #18":           "Property #18",
      "Warehouse #07":           "Property #07",
      "Warehouse #11":           "Property #11",
      "Plant #02":               "Resort #02",
      "Plant #04":               "Resort #04",
      "Dock #03":                "Wing #03",
      "Dock #07":                "Wing #07",
      "Hub #01":                 "Lobby #01",
      "Hub #05":                 "Lobby #05",
      // Generic site series (new-requisition draft)
      "Manufacturing A":         "Hotel A",
      "Manufacturing B":         "Hotel B",
      "Manufacturing C":         "Hotel C",
      "Manufacturing D":         "Hotel D",
      "Manufacturing E":         "Hotel E",
      "Manufacturing F":         "Hotel F",
      "Distribution Center 1":   "Conference Center 1",
      "Distribution Center 2":   "Conference Center 2",
    },
  },

  retail: {
    id:         "retail",
    name:       "Northwind Retail Group",
    tag:        "Retail",
    logo:       "assets/org-retail.svg",
    accent:     "#15803D",
    localize: {
      "Manufacturing Site":      "Flagship Store",
      "Inventory Warehouse":     "Stockroom",
      "Distribution Center":     "Distribution Center",
      "Freight Terminal":        "Fulfillment Hub",
      "Supply Chain Nexus":      "Returns Center",
      "Cargo Depot":             "Click & Collect",
      "Shipping Dock":           "Loading Bay",
      "Transport Hub":           "Cross-Dock",
      "Logistics Hub":           "Fulfillment Hub",
      "Storage Facility":        "Backstock",
      "Warehouse":               "Store",
      "Sam\u2019s Chalet":       "Sam\u2019s Outpost",
      "Industrial Way":          "Main Street",
      "Cargo Blvd.":             "Commerce Blvd.",
      "Logistics Pkwy.":         "Marketplace Pkwy.",
      "Trade Center":            "Town Center",
      "Storage Way":             "Retail Row",
      "Old Industrial Rd.":      "Boulevard Rd.",
      "Production Line Associate": "Sales Associate",
      "Factory Line Assembler":  "Sales Associate",
      "Warehouse Associate":     "Stockroom Associate",
      "Warehouse Clerk":         "Stockroom Clerk",
      "Material Handler":        "Stockroom Associate",
      "Machine Operator":        "Cashier",
      "Forklift Operator":       "Receiving Lead",
      "Quality Inspector":       "Visual Merchandiser",
      "Line Managers":           "Store Managers",
      "Line Manager":            "Store Manager",
      "Production Associate":       "Sales Associate",
      "Loader / Unloader":       "Receiver",
      "Pickers":                 "Order Fulfillers",
      "Picker":                  "Order Fulfiller",
      "Packers":                 "Packers",
      "Sorter":                  "Returns Clerk",
      "Operator":                "Cashier",
      "Assembler":               "Visual Merchandiser",
      "Inspector":               "Loss Prevention Officer",
      "Warehouse #32":           "Store #32",
      "Warehouse #18":           "Store #18",
      "Warehouse #07":           "Store #07",
      "Warehouse #11":           "Store #11",
      "Plant #02":               "Store #02",
      "Plant #04":               "Store #04",
      "Dock #03":                "Bay #03",
      "Dock #07":                "Bay #07",
      "Hub #01":                 "Center #01",
      "Hub #05":                 "Center #05",
      "Manufacturing A":         "Store A",
      "Manufacturing B":         "Store B",
      "Manufacturing C":         "Store C",
      "Manufacturing D":         "Store D",
      "Manufacturing E":         "Store E",
      "Manufacturing F":         "Store F",
      "Distribution Center 1":   "Distribution Center 1",
      "Distribution Center 2":   "Distribution Center 2",
    },
  },

  healthcare: {
    id:         "healthcare",
    name:       "Mercy Health System",
    tag:        "Healthcare",
    logo:       "assets/org-healthcare.svg",
    accent:     "#0F766E",
    localize: {
      "Manufacturing Site":      "Medical Campus",
      "Inventory Warehouse":     "Surgical Suite",
      "Distribution Center":     "Outpatient Center",
      "Freight Terminal":        "Imaging Center",
      "Supply Chain Nexus":      "Specialty Care Center",
      "Cargo Depot":             "Urgent Care",
      "Shipping Dock":           "Pharmacy",
      "Transport Hub":           "Ambulatory Hub",
      "Logistics Hub":           "Rehab Center",
      "Storage Facility":        "Lab",
      "Warehouse":               "Clinic",
      "Sam\u2019s Chalet":       "Cedar Hospice",
      "Industrial Way":          "Medical Plaza",
      "Cargo Blvd.":             "Health Park Blvd.",
      "Logistics Pkwy.":         "Wellness Pkwy.",
      "Trade Center":            "Medical Plaza",
      "Storage Way":             "Care Lane",
      "Old Industrial Rd.":      "Hospital Rd.",
      "Production Line Associate": "Patient Care Tech",
      "Factory Line Assembler":  "Med-Surg Tech",
      "Warehouse Associate":     "Patient Aide",
      "Warehouse Clerk":         "Patient Aide",
      "Material Handler":        "Pharmacy Tech",
      "Machine Operator":        "Imaging Tech",
      "Forklift Operator":       "Patient Transport",
      "Quality Inspector":       "Compliance Nurse",
      "Line Managers":           "Nurse Managers",
      "Line Manager":            "Nurse Manager",
      "Production Associate":       "CNA",
      "Loader / Unloader":       "Patient Transport",
      "Pickers":                 "Pharmacy Techs",
      "Picker":                  "Pharmacy Tech",
      "Packers":                 "Sterile Processing Techs",
      "Sorter":                  "Phlebotomist",
      "Operator":                "Surgical Tech",
      "Assembler":               "Med-Surg Tech",
      "Inspector":               "Compliance Nurse",
      "Warehouse #32":           "Wing #32",
      "Warehouse #18":           "Wing #18",
      "Warehouse #07":           "Wing #07",
      "Warehouse #11":           "Wing #11",
      "Plant #02":               "Floor #02",
      "Plant #04":               "Floor #04",
      "Dock #03":                "Ward #03",
      "Dock #07":                "Ward #07",
      "Hub #01":                 "Clinic #01",
      "Hub #05":                 "Clinic #05",
      "Manufacturing A":         "Campus A",
      "Manufacturing B":         "Campus B",
      "Manufacturing C":         "Campus C",
      "Manufacturing D":         "Campus D",
      "Manufacturing E":         "Campus E",
      "Manufacturing F":         "Campus F",
      "Distribution Center 1":   "Outpatient Center 1",
      "Distribution Center 2":   "Outpatient Center 2",
    },
  },

  logistics: {
    id:         "logistics",
    name:       "Continental Logistics",
    tag:        "Logistics",
    logo:       "assets/org-logistics.svg",
    accent:     "#7C3AED",
    localize: {
      "Manufacturing Site":      "Sortation Hub",
      "Inventory Warehouse":     "Inventory Hub",
      "Storage Facility":        "Yard",
      "Sam\u2019s Chalet":       "Sam\u2019s Yard",
      "Production Line Associate": "Freight Handler",
      "Factory Line Assembler":  "Freight Handler",
      "Warehouse Associate":     "Inventory Clerk",
      "Warehouse Clerk":         "Inventory Clerk",
      "Material Handler":        "Material Handler",
      "Machine Operator":        "Conveyor Operator",
      "Forklift Operator":       "Forklift Operator",
      "Quality Inspector":       "Load Inspector",
      "Line Managers":           "Operations Leads",
      "Line Manager":            "Operations Lead",
      "Production Associate":       "Sortation Associate",
      "Loader / Unloader":       "Loader / Unloader",
      "Pickers":                 "Order Pickers",
      "Picker":                  "Order Picker",
      "Packers":                 "Packers",
      "Sorter":                  "Sorter",
      "Plant #02":               "Yard #02",
      "Plant #04":               "Yard #04",
      "Manufacturing A":         "Hub A",
      "Manufacturing B":         "Hub B",
      "Manufacturing C":         "Hub C",
      "Manufacturing D":         "Hub D",
      "Manufacturing E":         "Hub E",
      "Manufacturing F":         "Hub F",
    },
  },

  // ----- Energy Power Plant org ----------------------------------------
  // Net-new tenant added alongside the v0.78 engagement-types config
  // move. Ships with ALL engagement types pre-configured (Shift +
  // Assignment + Project + Statement of Work) so the new Configuration
  // \u2192 Engagement types section can be demonstrated in its full form.
  // Every other org defaults to Shift-only.
  energy: {
    id:         "energy",
    name:       "Helios Power Generation",
    tag:        "Energy",
    logo:       "assets/org-energy.svg",
    accent:     "#B45309",
    localize: {
      "Manufacturing Site":      "Generating Station",
      "Inventory Warehouse":     "Turbine Hall",
      "Distribution Center":     "Substation",
      "Freight Terminal":        "Switchyard",
      "Supply Chain Nexus":      "Control Room",
      "Cargo Depot":             "Fuel Depot",
      "Shipping Dock":           "Cooling Bay",
      "Transport Hub":           "Transmission Hub",
      "Logistics Hub":           "Grid Hub",
      "Storage Facility":        "Reactor Yard",
      "Warehouse":               "Power Plant",
      "Sam\u2019s Chalet":       "Helios Lodge",
      "Industrial Way":          "Powerline Way",
      "Cargo Blvd.":             "Turbine Blvd.",
      "Logistics Pkwy.":         "Grid Pkwy.",
      "Trade Center":            "Energy Plaza",
      "Storage Way":             "Reactor Way",
      "Old Industrial Rd.":      "Generating Rd.",
      "Production Line Associate": "Plant Operator",
      "Factory Line Assembler":  "Mechanical Tech",
      "Warehouse Associate":     "Plant Associate",
      "Warehouse Clerk":         "Plant Clerk",
      "Material Handler":        "Fuel Handler",
      "Machine Operator":        "Turbine Operator",
      "Forklift Operator":       "Heavy Equipment Operator",
      "Quality Inspector":       "Safety Inspector",
      "Line Managers":           "Operations Managers",
      "Line Manager":            "Operations Manager",
      "Production Associate":    "Plant Associate",
      "Loader / Unloader":       "Fuel Handler",
      "Pickers":                 "Field Technicians",
      "Picker":                  "Field Technician",
      "Packers":                 "Maintenance Crew",
      "Sorter":                  "Control Tech",
      "Operator":                "Plant Operator",
      "Assembler":               "Mechanical Tech",
      "Inspector":               "Safety Inspector",
      "Warehouse #32":           "Plant #32",
      "Warehouse #18":           "Plant #18",
      "Warehouse #07":           "Plant #07",
      "Warehouse #11":           "Plant #11",
      "Plant #02":               "Unit #02",
      "Plant #04":               "Unit #04",
      "Dock #03":                "Bay #03",
      "Dock #07":                "Bay #07",
      "Hub #01":                 "Substation #01",
      "Hub #05":                 "Substation #05",
      "Manufacturing A":         "Station A",
      "Manufacturing B":         "Station B",
      "Manufacturing C":         "Station C",
      "Manufacturing D":         "Station D",
      "Manufacturing E":         "Station E",
      "Manufacturing F":         "Station F",
      "Distribution Center 1":   "Substation 1",
      "Distribution Center 2":   "Substation 2",
    },
  },

  // ----- Agency org ----------------------------------------------------
  // Distinct kind: this is a staffing AGENCY tenant, not an enterprise
  // buyer. The role picker only offers "Agency" for this org, and other
  // orgs never offer it. `agencySupplierId` ties this agency tenant to
  // a supplier ID in the buyer's data so workers / timesheets / invoices
  // can be filtered down to "just our agency".
  staffwise: {
    id:         "staffwise",
    name:       "StaffWise",
    tag:        "Staffing agency",
    kind:       "agency",
    agencySupplierId: "sw",
    logo:       "assets/org-agency.svg",
    accent:     "#1F8A5B",
    localize: {
      "Manufacturing Site":      "Client Site",
      "Sam\u2019s Chalet":       "Sam\u2019s Yard",
    },
  },
};

const INDUSTRY_ORDER = ["dayforce", "manufacturing", "hospitality", "retail", "healthcare", "logistics", "energy", "staffwise"];

// Helper: is the active (or named) org a staffing agency tenant?
function isAgencyOrg(id) {
  const ind = id ? INDUSTRIES[id] : getIndustry();
  return !!(ind && ind.kind === "agency");
}

// Helper: is the active (or named) org the Dayforce platform tenant?
// The Systems Admin surface (Settings → Organizations) is gated on this.
function isPlatformOrg(id) {
  const ind = id ? INDUSTRIES[id] : getIndustry();
  return !!(ind && ind.kind === "platform");
}

// The supplier ID this agency org maps to in the buyer's data. Returns
// null when the active org isn't an agency. Used by list/filter logic
// across the prototype so Workforce/Timesheets/Schedule/Invoices show
// only records that belong to this agency.
function getAgencySupplierId() {
  const ind = getIndustry();
  return (ind && ind.kind === "agency" && ind.agencySupplierId) || null;
}

// ---------- Pick + persist current industry ----------------------------
function getCurrentIndustryId() {
  try {
    const stored = window.localStorage.getItem("flexwork.industry");
    if (stored && INDUSTRIES[stored]) return stored;
  } catch (e) { /* no-op */ }
  return "dayforce";
}
function setCurrentIndustryId(id) {
  try { window.localStorage.setItem("flexwork.industry", id); } catch (e) {}
}
function getIndustry() {
  return INDUSTRIES[getCurrentIndustryId()] || INDUSTRIES.manufacturing;
}

// ---------- Apply transforms ------------------------------------------
//   `localize(str)` — find/replace each industry term in a single string,
//   longest-first. Identity for the Manufacturing pack.
const _LOCALIZE_KEYS_CACHE = { id: null, keys: null };
function _localizeKeys() {
  const ind = getIndustry();
  if (_LOCALIZE_KEYS_CACHE.id === ind.id) return _LOCALIZE_KEYS_CACHE.keys;
  const keys = Object.keys(ind.localize).sort((a, b) => b.length - a.length);
  _LOCALIZE_KEYS_CACHE.id = ind.id;
  _LOCALIZE_KEYS_CACHE.keys = keys;
  return keys;
}

function localize(value) {
  if (typeof value !== "string") return value;
  const ind = getIndustry();
  const keys = _localizeKeys();
  let out = value;
  for (const k of keys) {
    if (out.indexOf(k) !== -1) out = out.split(k).join(ind.localize[k]);
  }
  // Currency swap — the demo data is preformatted as USD with a "$" prefix.
  // If the active org's country uses a different currency, swap the symbol.
  // applyCurrency() lives in pages/countries.jsx and is a no-op on USD.
  if (typeof window !== "undefined" && typeof window.applyCurrency === "function") {
    out = window.applyCurrency(out);
  }
  return out;
}

// `localizeRecord(rec, fields)` — return a copy with each named field
// localized. Strings get localize(); array-of-string fields are mapped.
//
// In addition, EVERY string field is run through applyCurrency() — that
// way money columns ("$48,320") that aren't in the explicit `fields`
// list still reflect the active org's currency without each page needing
// to opt in.
function localizeRecord(rec, fields) {
  if (!rec) return rec;
  const out = { ...rec };
  const fset = new Set(fields);
  for (const k of Object.keys(out)) {
    const v = out[k];
    if (typeof v === "string") {
      const localized = fset.has(k) ? localize(v) : v;
      out[k] = (typeof window !== "undefined" && window.applyCurrency)
        ? window.applyCurrency(localized) : localized;
    } else if (Array.isArray(v) && fset.has(k)) {
      out[k] = v.map((x) => (typeof x === "string" ? localize(x) : x));
    }
  }
  return out;
}

function localizeAll(records, fields) {
  const out = records.map((r) => localizeRecord(r, fields));
  // Track for live currency swap on country change.
  if (typeof window !== "undefined") {
    (window._currencyArrays = window._currencyArrays || []).push(out);
  }
  return out;
}

// Register an already-built data array so the live country-switch can
// rewrite its currency symbols on the fly. Useful for arrays that aren't
// piped through localizeAll (e.g. hardcoded $ spend tables). Also runs
// applyCurrency immediately so first-load matches the active country.
//
// Walks the record tree DEEPLY so nested fields ({ history: [{ what:
// "...$95 → $120..." }], rules: { vendor: "Stipend ($85 / yr)" } }) get
// the same swap as top-level fields. Cycles are guarded with a WeakSet.
function _walkAndSwap(node, swap, seen) {
  if (!node) return;
  if (typeof node !== "object") return;
  if (seen.has(node)) return;
  seen.add(node);
  if (Array.isArray(node)) {
    for (let i = 0; i < node.length; i++) {
      const v = node[i];
      if (typeof v === "string") {
        const next = swap(v);
        if (next !== v) node[i] = next;
      } else if (v && typeof v === "object") {
        _walkAndSwap(v, swap, seen);
      }
    }
    return;
  }
  for (const k of Object.keys(node)) {
    const v = node[k];
    if (typeof v === "string") {
      const next = swap(v);
      if (next !== v) node[k] = next;
    } else if (v && typeof v === "object") {
      _walkAndSwap(v, swap, seen);
    }
  }
}

function registerCurrencyData(records) {
  if (!Array.isArray(records)) return records;
  if (typeof window !== "undefined" && typeof window.applyCurrency === "function") {
    _walkAndSwap(records, window.applyCurrency, new WeakSet());
  }
  if (typeof window !== "undefined") {
    (window._currencyArrays = window._currencyArrays || []).push(records);
  }
  return records;
}

// Re-walk every registered array with a custom swap function. Used by
// applyCountryInstant in pages/countries.jsx so symbol replacement
// reaches the same nested fields registerCurrencyData walked.
function walkRegisteredCurrencyData(swap) {
  if (typeof window === "undefined") return;
  const arrays = window._currencyArrays || [];
  const seen = new WeakSet();
  for (const arr of arrays) {
    if (Array.isArray(arr)) _walkAndSwap(arr, swap, seen);
  }
}

Object.assign(window, {
  INDUSTRIES, INDUSTRY_ORDER,
  getCurrentIndustryId, setCurrentIndustryId, getIndustry, isAgencyOrg, getAgencySupplierId,
  localize, localizeRecord, localizeAll, registerCurrencyData,
  walkRegisteredCurrencyData, isPlatformOrg,
});
