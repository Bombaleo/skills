// =====================================================================
// Flex Work — Settings → Configuration
//   Global org configuration. Six sections, single source of truth for
//   tenant-wide defaults that downstream pages (Requisitions, Schedule,
//   Workflows, Invoices) consume.
//
//   Persists locally to window.__configStore so tweaks survive nav.
//
//   Right-rail "On this page" scroll-spy + sticky save bar when dirty.
// =====================================================================

const { useState: useCfgState, useMemo: useCfgMemo, useEffect: useCfgEffect, useRef: useCfgRef } = React;

// ---------- Defaults derived from the current industry pack ----------
function cfg_defaults() {
  const ind = (window.getIndustry && window.getIndustry()) || {
    id: "manufacturing", name: "Atlas Manufacturing Co.", tag: "Manufacturing",
    logo: "assets/org-manufacturing.svg", accent: "#3067DB",
  };
  const slug = ind.name.toLowerCase().replace(/[^a-z]+/g, "").slice(0, 18) || "org";
  return {
    org: {
      name: ind.name,
      legalName: ind.name.endsWith("Inc.") ? ind.name : ind.name + ", Inc.",
      industry: ind.tag,
      orgType: "Corporation",
      ein: "82-4715293",
      hqAddress: "120 Industrial Way, Suite 400, San Mateo, CA 94401",
      logo: ind.logo,
      logoSize: "42 KB · SVG · 40 × 40",
    },
    dayforce: {
      tenantId: "DF-NA-22517",
      environment: "Production",
      instanceUrl: `https://ttn.dayforcehcm.com/${slug}`,
      employeeSync: true,
      employeeSyncCadence: "Every 15 minutes",
      employeeLastSync: "2 min ago",
      employeeCount: 4218,
      costCenterSync: true,
      costCenterSyncCadence: "Daily · 02:00 PT",
      costCenterLastSync: "Today at 02:14",
      costCenterCount: 64,
      glSync: true,
      glSyncCadence: "Daily · 02:00 PT",
      glLastSync: "Today at 02:15",
      payrollExport: true,
      payrollExportCadence: "On approval (timesheets)",
      ssoProvider: "Okta",
      ssoStatus: "Managed in Dayforce HCM",
      scim: true,
    },
    worker: {
      displayName: ind.name,
      workerLogo: ind.logo,
      brandColor: ind.accent,
      welcome: `Welcome to ${ind.name}. Pick up your next shift below.`,
      supportEmail: `shifts.support@${slug}.com`,
      supportPhone: "+1 (415) 555-0117",
      appName: "Shifts by Dayforce",
    },
    region: {
      currency: "USD — US Dollar",
      timeZone: "America/Los_Angeles",
      dateFormat: "MMM D, YYYY",
      timeFormat: "12h",
      weekStart: "Sunday",
      fiscalYearStart: "April",
      language: "English (US)",
      measurement: "Imperial",
    },
    defaults: {
      approvalWorkflow: "Manager → Department head",
      distribution: "Tiered cascade",
      clockMethod: "Dayforce Clock",
      timeRounding: "15 min · nearest",
      dayEndCutoff: "02:00 (local)",
      autoArchive: 90,
      minLeadHours: 4,
      maxShiftHours: 12,
      requireCostCenter: true,
      autoCloseTimesheets: true,
    },
    hoursAlert: {
      enabled: true,
      thresholdHours: 40,
      period: "Per week (Sun – Sat)",
      counts: "Scheduled + worked",
      severity: "Warn scheduler",
      includeOtherEmployers: false,
      notifyScheduler: true,
      notifySupervisor: true,
      notifyWorker: false,
      overrideRole: "Scheduling manager",
    },
    links: {
      website: `https://${slug}.com`,
      helpCenter: "https://help.dayforce.com/flex-work",
      careers: `https://${slug}.com/work-with-us`,
      privacy: `https://${slug}.com/legal/privacy`,
      terms: `https://${slug}.com/legal/terms`,
      supplierOnboarding: `https://suppliers.${slug}.com`,
    },
    // Multi-country sales-tax configuration. Six markets, one matrix.
    // Each country's tax regime is modelled separately because they
    // diverge meaningfully — US is state-by-state on a narrow taxable
    // list, Canada layers GST + provincial PST/QST, EU/UK use VAT with
    // cross-border reverse charge under Art. 196 / Notice 741A,
    // Australia uses GST 10% with Subdiv 84-A reverse charge, Japan
    // uses Consumption Tax 10% under the Qualified Invoice System.
    //
    // Defaults below reflect the as-of-2026 baseline. Changes here
    // propagate to every invoice the moment Save changes is clicked.
    salesTax: {
      enabled: false,                  // master toggle, parallel to Supplier Funding
      effectiveDate: "Jul 1, 2026",
      coverage: {
        frontline: true,
        professional: true,
        sow: true,
        contractor: false,             // most IC contractors fall below VAT thresholds
      },
      stackOnFunding: "preFee",        // "preFee" | "postFee" — tax on bill amount vs net to supplier
      countries: {
        // United States — narrow list of states + DC that tax staffing
        // services per SIA, TaxConnex, and (post Oct 1 2025) Washington
        // DOR guidance. Rates are state base rate; local rates layer
        // on top in production via a tax-engine integration.
        US: {
          enabled: true,
          regime: "Sales Tax",
          label: "US Sales Tax",
          sourcing: "Place of performance",
          reverseCharge: false,
          notes: "Reseller exemption certificates honored on supplier-to-supplier resale.",
          rates: [
            { id: "CT", name: "Connecticut",       rate: 6.35, taxable: true },
            { id: "DC", name: "District of Columbia", rate: 6.00, taxable: true },
            { id: "DE", name: "Delaware",          rate: 0.00, taxable: true,  note: "Gross Receipts Tax (no sales tax)" },
            { id: "HI", name: "Hawaii",            rate: 4.00, taxable: true,  note: "General Excise Tax" },
            { id: "IA", name: "Iowa",              rate: 6.00, taxable: true },
            { id: "NM", name: "New Mexico",        rate: 4.875, taxable: true, note: "Gross Receipts Tax" },
            { id: "NY", name: "New York",          rate: 4.00, taxable: true,  note: "Local rates add 4-4.875%" },
            { id: "OH", name: "Ohio",              rate: 5.75, taxable: true,  note: "Employment / employment placement services" },
            { id: "PA", name: "Pennsylvania",      rate: 6.00, taxable: true,  note: "Help-supply services" },
            { id: "SD", name: "South Dakota",      rate: 4.20, taxable: true },
            { id: "TN", name: "Tennessee",         rate: 7.00, taxable: true },
            { id: "WA", name: "Washington",        rate: 6.50, taxable: true,  note: "ESSB 5814 \u00b7 effective Oct 1, 2025" },
            { id: "WV", name: "West Virginia",     rate: 6.00, taxable: true },
          ],
          otherStatesTaxable: false,    // the 38 + 5-no-sales-tax states default off
        },
        // Canada — federal GST 5% in every province, HST in Atlantic
        // Canada + Ontario, QST stacked in Quebec, separate PST in
        // BC/SK/MB.
        CA: {
          enabled: true,
          regime: "GST/HST",
          label: "Canadian GST/HST",
          sourcing: "Place of supply (worker's province)",
          reverseCharge: false,
          notes: "Federal GST 5% in every province; HST harmonizes federal + provincial in ON, NS, NB, NL, PE.",
          rates: [
            { id: "ON", name: "Ontario",                rate: 13.0, taxable: true, note: "HST" },
            { id: "QC", name: "Quebec",                 rate: 14.975, taxable: true, note: "GST 5% + QST 9.975%" },
            { id: "BC", name: "British Columbia",       rate: 12.0, taxable: true, note: "GST 5% + PST 7%" },
            { id: "AB", name: "Alberta",                rate: 5.0, taxable: true,  note: "GST only" },
            { id: "NS", name: "Nova Scotia",            rate: 15.0, taxable: true, note: "HST" },
            { id: "NB", name: "New Brunswick",          rate: 15.0, taxable: true, note: "HST" },
            { id: "NL", name: "Newfoundland & Labrador", rate: 15.0, taxable: true, note: "HST" },
            { id: "PE", name: "Prince Edward Island",   rate: 15.0, taxable: true, note: "HST" },
            { id: "MB", name: "Manitoba",               rate: 12.0, taxable: true, note: "GST 5% + PST 7%" },
            { id: "SK", name: "Saskatchewan",           rate: 11.0, taxable: true, note: "GST 5% + PST 6%" },
            { id: "YT", name: "Yukon",                  rate: 5.0, taxable: true,  note: "GST only" },
            { id: "NT", name: "Northwest Territories",  rate: 5.0, taxable: true,  note: "GST only" },
            { id: "NU", name: "Nunavut",                rate: 5.0, taxable: true,  note: "GST only" },
          ],
          otherStatesTaxable: true,
        },
        // United Kingdom — flat 20% VAT under HMRC Notice 741A.
        // Reverse charge for cross-border B2B (EU \u2194 GB, RoW).
        GB: {
          enabled: true,
          regime: "VAT",
          label: "UK VAT",
          sourcing: "Place of supply (buyer's country for B2B)",
          reverseCharge: true,
          reverseChargeNote: "EU \u2194 GB and rest-of-world B2B supplies zero-rate with a reverse charge notice; buyer self-accounts on their VAT return.",
          notes: "Healthcare Staffing Concession (Kingsbridge) configurable per supplier contract.",
          rates: [
            { id: "STD", name: "Standard rate",  rate: 20.0, taxable: true },
            { id: "RED", name: "Reduced rate",   rate: 5.0,  taxable: false, note: "Not applicable to staffing" },
            { id: "ZER", name: "Zero rate",      rate: 0.0,  taxable: false, note: "Reverse charge supplies" },
          ],
          defaultRateId: "STD",
        },
        // Germany — 19% USt with \u00a713b reverse charge for cross-border
        // B2B intra-EU and rest-of-world.
        DE: {
          enabled: true,
          regime: "USt",
          label: "German Umsatzsteuer",
          sourcing: "Ort der Leistung (place of supply per \u00a73a UStG)",
          reverseCharge: true,
          reverseChargeNote: "\u00a713b UStG \u00b7 Steuerschuldnerschaft des Leistungsempf\u00e4ngers \u2014 cross-border B2B supplies are net-invoiced with the recipient self-accounting.",
          notes: "Domestic German Zeitarbeit (temp staffing) is fully taxable at the standard rate.",
          rates: [
            { id: "STD", name: "Regelsteuersatz", rate: 19.0, taxable: true,  note: "Standard rate" },
            { id: "RED", name: "Erm\u00e4\u00dfigt",      rate: 7.0,  taxable: false, note: "Not applicable to staffing" },
            { id: "ZER", name: "Steuerfrei",       rate: 0.0,  taxable: false, note: "Reverse charge" },
          ],
          defaultRateId: "STD",
        },
        // Australia — 10% GST, Subdiv 84-A reverse charge for imports.
        AU: {
          enabled: true,
          regime: "GST",
          label: "Australian GST",
          sourcing: "Place of supply (per A New Tax System (GST) Act 1999)",
          reverseCharge: true,
          reverseChargeNote: "Subdivision 84-A \u2014 imported services to a GST-registered enterprise can be reverse-charged where the supplier is not registered for Australian GST.",
          notes: "Tax Invoice rules require GST shown as a separate line for ABN-registered buyers.",
          rates: [
            { id: "STD", name: "Standard rate", rate: 10.0, taxable: true },
            { id: "FREE", name: "GST-free",     rate: 0.0,  taxable: false, note: "Health, medical, education exemptions" },
          ],
          defaultRateId: "STD",
        },
        // Japan — 10% Sh\u014dhizei under the Qualified Invoice System.
        JP: {
          enabled: true,
          regime: "Consumption Tax",
          label: "Japanese Consumption Tax",
          sourcing: "Place of supply per JCT Act Article 4",
          reverseCharge: true,
          reverseChargeNote: "Cross-border imports of consulting and electronic services to JCT-registered buyers are reverse-charged.",
          notes: "Qualified Invoice System (effective Oct 2023) \u2014 supplier T-number required on every invoice for buyer input-tax claim.",
          rates: [
            { id: "STD", name: "Standard rate", rate: 10.0, taxable: true },
            { id: "RED", name: "Reduced rate",   rate: 8.0,  taxable: false, note: "Food / beverages \u2014 not applicable to staffing" },
          ],
          defaultRateId: "STD",
        },
      },
    },
    // Program-level funding model. The buyer-funded / supplier-funded
    // MSP choice: when supplierFunding is ON, every supplier invoice across every org,
    // country, and engagement type gets a Program fee deducted at the
    // configured percentage. Per-supplier overrides live on the
    // SupplierContract record.
    //
    // v0.79 — moved out of Feature Flags. Now an always-available
    // Configuration choice. Helios Power Generation ships with
    // Supplier Funded pre-selected; every other org defaults to
    // Buyer Funded.
    program: {
      // Helios (energy) → supplier-funded; every other org → buyer-funded.
      supplierFunding: (function () {
        const id = (window.getCurrentIndustryId && window.getCurrentIndustryId()) || null;
        return id === "energy";
      })(),
      feePct: 2.5,                    // 1.5 - 3.5% is the standard range
      method: "Discount",            // "Markup" (added to bill) | "Discount" (subtracted from bill)
      coverage: {
        frontline: true,
        professional: true,
        sow: true,
        contractor: false,           // contractor (IC) invoices usually exempt
      },
      effectiveDate: "Jul 1, 2026",
      invoiceLabel: "Program fee",
      allowOverrides: true,
      remittance: "Net of fee",       // "Net of fee" | "Gross then clawback"
    },
  };
}

function cfg_ensureStore() {
  if (!window.__configStore) window.__configStore = cfg_defaults();
  // Forward-compat: stores persisted before the Program section existed
  // won't have a `program` key. Patch in the default so consumers
  // (Invoices, Supplier contract) never read undefined.
  if (window.__configStore && !window.__configStore.program) {
    window.__configStore.program = cfg_defaults().program;
  }
  // Same forward-compat for the Sales Tax section.
  if (window.__configStore && !window.__configStore.salesTax) {
    window.__configStore.salesTax = cfg_defaults().salesTax;
  }
  return window.__configStore;
}

// Public read helper used by Invoices + Supplier Contract. Returns the
// resolved supplier-funding settings (defaults merged with whatever has
// been saved in __configStore). Consumers should also gate on the
// `supplierFunding` feature flag — this helper does NOT.
function getProgramFunding() {
  const store = cfg_ensureStore();
  return store.program;
}

// React hook · subscribes to `flexwork:config:change` so a consumer
// re-renders the moment the user saves a change in Settings →
// Configuration. Returns the live program-funding object.
function useProgramFunding() {
  const [v, setV] = React.useState(() => getProgramFunding());
  React.useEffect(() => {
    function onChange() { setV(getProgramFunding()); }
    window.addEventListener("flexwork:config:change", onChange);
    return () => window.removeEventListener("flexwork:config:change", onChange);
  }, []);
  return v;
}

// Public read helper for the multi-country Sales Tax configuration.
// Consumers should also gate on the `salesTax` feature flag — this
// helper does NOT.
function getSalesTaxConfig() {
  const store = cfg_ensureStore();
  return store.salesTax;
}

// Resolve the sales-tax treatment that should appear on a single
// invoice. Returns null when the flag is off, when the country is not
// configured, when the engagement type is excluded, or when the
// jurisdiction's row is marked non-taxable. Otherwise returns:
//   { regime, label, rate, jurisdiction, sourcing, reverseChargeNote? }
// Reverse charge: when an invoice is flagged as cross-border B2B
// (inv.reverseCharge === true) and the country supports it, the
// returned treatment carries rate=0 plus a reverseChargeNote so the
// invoice can render a zero-rated line with the right legal text.
function resolveSalesTaxForInvoice(inv) {
  if (!inv) return null;
  // Flag gate — consumers MAY call this without checking the flag;
  // this helper is defensive so any wiring mistake fails closed.
  const flagOn = window.getFeatureFlag && window.getFeatureFlag("salesTax");
  if (!flagOn) return null;
  const cfg = getSalesTaxConfig();
  if (!cfg || !cfg.enabled) return null;

  // Engagement-type coverage gate.
  const engagementKey =
    inv.engagementType === "SOW"          ? "sow" :
    inv.engagementType === "Contractor"   ? "contractor" :
    inv.engagementType === "Professional" ? "professional" :
                                            "frontline";
  if (!cfg.coverage || !cfg.coverage[engagementKey]) return null;

  // Country resolution — explicit inv.country wins, otherwise we use
  // the active org country.
  let countryCode = inv.country || null;
  if (!countryCode && window.getCurrentCountry) {
    const c = window.getCurrentCountry();
    countryCode = c && c.code;
  }
  if (!countryCode) return null;
  const country = cfg.countries[countryCode];
  if (!country || !country.enabled) return null;

  // Reverse-charge short-circuit — invoice is zero-rated, legal notice
  // travels in reverseChargeNote.
  if (inv.reverseCharge && country.reverseCharge) {
    return {
      regime: country.regime,
      label: country.label,
      rate: 0,
      jurisdiction: country.label + " \u00b7 reverse charge",
      sourcing: country.sourcing,
      reverseCharge: true,
      reverseChargeNote: country.reverseChargeNote || "Reverse charge \u00b7 VAT due by the recipient",
    };
  }

  // Pick the matching jurisdiction row.
  let row = null;
  if (inv.taxJurisdiction) {
    row = (country.rates || []).find((r) => r.id === inv.taxJurisdiction);
  }
  if (!row && country.defaultRateId) {
    row = (country.rates || []).find((r) => r.id === country.defaultRateId);
  }
  if (!row) {
    // US / CA — fall back to the first taxable row.
    row = (country.rates || []).find((r) => r.taxable);
  }
  if (!row || !row.taxable || row.rate <= 0) return null;

  return {
    regime: country.regime,
    label: country.label,
    rate: row.rate,
    jurisdiction: row.name,
    jurisdictionNote: row.note || null,
    sourcing: country.sourcing,
    reverseCharge: false,
  };
}

// ---------- Small primitives ----------------------------------------

function CfgField({ label, hint, children, span = 1, action }) {
  const cls = "cfg-field" + (span === 2 ? " cfg-span-2" : "");
  return (
    <div className={cls}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <label className="cfg-field-label">{label}</label>
        {action}
      </div>
      {children}
      {hint && <p className="cfg-field-hint">{hint}</p>}
    </div>
  );
}

function CfgReadOnly({ value, mono, onCopy }) {
  return (
    <div className={"cfg-readonly" + (mono ? " cfg-readonly--mono" : "")}>
      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{value}</span>
      <button
        type="button"
        className="cfg-readonly-copy"
        aria-label={`Copy ${value}`}
        onClick={() => {
          try { navigator.clipboard && navigator.clipboard.writeText(value); } catch (e) {}
          showToast("Copied to clipboard", { kind: "success" });
          onCopy && onCopy();
        }}
      >
        <Icon name="Copy" size={14} />
      </button>
    </div>
  );
}

const CFG_BRAND_PALETTE = [
  "#3067DB", // Everest blue (default)
  "#0F766E", // teal — Healthcare
  "#C2410C", // burnt orange — Hospitality
  "#15803D", // forest — Retail
  "#7C3AED", // purple — Logistics
  "#0B3B5A", // deep navy
  "#B91C1C", // crimson
];

function CfgSwatches({ value, onChange }) {
  return (
    <div className="cfg-swatches" role="radiogroup" aria-label="Brand color">
      {CFG_BRAND_PALETTE.map((c) => {
        const active = c.toLowerCase() === (value || "").toLowerCase();
        return (
          <button
            key={c}
            type="button"
            role="radio"
            aria-checked={active}
            title={c}
            className={"cfg-swatch" + (active ? " cfg-swatch--active" : "")}
            style={{ "--c": c }}
            onClick={() => onChange(c)}
          />
        );
      })}
      <button
        type="button"
        className="cfg-swatch-custom"
        title="Custom color"
        onClick={() => showToast("Custom color picker — preview only")}
      >
        <Icon name="AddCircle" size={16} />
      </button>
    </div>
  );
}

// ---------- Right-rail "On this page" scroll-spy ---------------------
function CfgRail({ items, activeId, onJump }) {
  return (
    <aside className="cfg-rail" aria-label="On this page">
      <div className="cfg-rail-title">On this page</div>
      {items.map((it) => (
        <a
          key={it.id}
          href={`#${it.id}`}
          className={"cfg-rail-link" + (activeId === it.id ? " cfg-rail-link--active" : "")}
          onClick={(e) => { e.preventDefault(); onJump(it.id); }}
        >
          <Icon name={it.icon} size={14} />
          {it.label}
        </a>
      ))}
    </aside>
  );
}

// ---------- Main page ------------------------------------------------
function ConfigurationPage({ onGoTo }) {
  const store = cfg_ensureStore();
  const [data, setData] = useCfgState(() => JSON.parse(JSON.stringify(store)));
  const originalRef = useCfgRef(JSON.parse(JSON.stringify(store)));
  const [activeId, setActiveId] = useCfgState("org");
  const stackRef = useCfgRef(null);

  // Scroll-spy: pick the section whose top is closest above the viewport top.
  useCfgEffect(() => {
    const root = stackRef.current;
    if (!root) return;
    const sections = Array.from(root.querySelectorAll("[data-cfg-section]"));
    const observer = new IntersectionObserver((entries) => {
      // Use the entry with the largest intersectionRatio
      const visible = entries.filter((e) => e.isIntersecting);
      if (visible.length) {
        visible.sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        setActiveId(visible[0].target.getAttribute("data-cfg-section"));
      }
    }, { rootMargin: "-30% 0px -55% 0px", threshold: [0, 0.5, 1] });
    sections.forEach((s) => observer.observe(s));
    return () => observer.disconnect();
  }, []);

  const dirty = useCfgMemo(() => JSON.stringify(data) !== JSON.stringify(originalRef.current), [data]);

  const set = (path, value) => {
    setData((prev) => {
      const next = JSON.parse(JSON.stringify(prev));
      const keys = path.split(".");
      let o = next;
      for (let i = 0; i < keys.length - 1; i++) o = o[keys[i]];
      o[keys[keys.length - 1]] = value;
      return next;
    });
  };

  const onSave = () => {
    window.__configStore = JSON.parse(JSON.stringify(data));
    originalRef.current = JSON.parse(JSON.stringify(data));
    setData(JSON.parse(JSON.stringify(data))); // force dirty recompute
    // Broadcast so any open consumer (Invoices list, Invoice detail,
    // Suppliers, etc.) re-reads getProgramFunding() and re-renders in
    // place — no nav round-trip needed.
    try {
      window.dispatchEvent(new CustomEvent("flexwork:config:change", {
        detail: { keys: ["program"] },
      }));
    } catch (e) { /* no-op */ }
    showToast("Configuration saved", { kind: "success" });
  };
  const onDiscard = () => {
    setData(JSON.parse(JSON.stringify(originalRef.current)));
    showToast("Changes discarded");
  };

  const jumpTo = (id) => {
    const el = stackRef.current && stackRef.current.querySelector(`[data-cfg-section="${id}"]`);
    if (el) {
      const offset = 88;
      const top = el.getBoundingClientRect().top + window.scrollY - offset;
      window.scrollTo({ top, behavior: "smooth" });
      setActiveId(id);
    }
  };

  const salesTaxOn        = window.useFeatureFlag ? window.useFeatureFlag("salesTax")        : false;
  // SOW Program card — visible whenever the org has Statement of Work
  // enabled in its engagement-type configuration. The legacy `sow` flag
  // is derived live from `engStatementOfWork`, so a single read here
  // covers both the new and legacy gates.
  const sowOn            = window.useFeatureFlag ? window.useFeatureFlag("sow")             : false;
  // IC Program card — visible whenever the contractors (1099/IC) feature
  // flag is on for this tenant. Same shape as the SOW card: lives
  // inline in Settings → Configuration, ships in pages/contractor-
  // config.jsx, exposes the templates / payments / coverage / approval /
  // integrations catalog the IC engagement type reads from.
  const contractorsOnCfg = window.useFeatureFlag ? window.useFeatureFlag("contractors")     : false;
  // Project — per-org config card sits next to Engagement types when
  // the engProject flag is on (Settings → Configuration → Project
  // settings).
  const engProjectOn      = window.useFeatureFlag ? window.useFeatureFlag("engProject")      : false;
  // Agency Pro — show a Plan card at the top of Configuration when the
  // agencyPro flag is on AND the active tenant is an agency-kind org.
  // The card itself ships in pages/agency-pro.jsx (AgencyPlanCard).
  const agencyProOn       = window.useFeatureFlag ? window.useFeatureFlag("agencyPro")       : false;
  // Automatic worker invitations — Agency Pro sub-capability. Shows an
  // invitation-strategy card right under the Plan / HCM cards when the
  // flag is on AND the tenant is an agency-kind org. The card itself
  // (pages/agency-worker-invite.jsx) guards the Pro plan, showing an
  // upgrade note on Free.
  const autoInviteOn      = window.useFeatureFlag ? window.useFeatureFlag("autoWorkerInvite") : false;
  // v0.86 — Candidate workflow tab. Gated by the `interviews` flag.
  // When on, Configuration grows a third top-level tab that picks
  // between Automatic (auto-accept) and Interview (full admin config).
  const interviewsOn      = window.useFeatureFlag ? window.useFeatureFlag("interviews")      : false;
  const isAgencyTenantCfg = !!(window.isAgencyOrg && window.isAgencyOrg());
  const showPlanCard      = agencyProOn && isAgencyTenantCfg && !!window.AgencyPlanCard;

  const railItems = [
    ...(showPlanCard      ? [{ id: "plan",    label: "Plan",            icon: "ShieldCheck" }] : []),
    { id: "org",        label: "Organization",     icon: "Building" },
    { id: "dayforce",   label: "Dayforce links",   icon: "LinkNewWindow" },
    { id: "worker",     label: "Worker brand",     icon: "Phone" },
    { id: "region",     label: "Regional",         icon: "Globe" },
    { id: "defaults",   label: "Operational",      icon: "Adjustment" },
    { id: "engagementTypes", label: "Engagement types", icon: "Briefcase" },
    ...(interviewsOn      ? [{ id: "candidateWorkflow", label: "Candidate workflow", icon: "PersonClock" }] : []),
    ...(engProjectOn ? [{ id: "projectSettings", label: "Project settings", icon: "EngagementProject" }] : []),
    { id: "supplierTypes",   label: "Supplier types",   icon: "Building" },
    ...(sowOn             ? [{ id: "sowProgram", label: "SOW program",   icon: "EngagementSow" }] : []),
    ...(contractorsOnCfg  ? [{ id: "contractorProgram", label: "IC program", icon: "PersonAuthorize" }] : []),
    { id: "program", label: "Program", icon: "Wallet" },
    { id: "jobs", label: "Jobs", icon: "Briefcase" },
    ...(salesTaxOn        ? [{ id: "salesTax", label: "Sales tax",      icon: "Globe" }]  : []),
    { id: "hoursAlert", label: "Worker hours alert", icon: "Alert" },
    { id: "links",      label: "Public links",     icon: "Link" },
  ];

  return (
    <div className="set-content">
      <header className="set-content-header" style={{ display: "flex", flexDirection: "column", gap: 12, padding: "8px 4px 0" }}>
        <h2 className="set-content-title">Configuration</h2>
        <p className="set-content-sub">
          Tune how Flex Work behaves for your organization &mdash; profile, integrations, defaults, and the
          links your workers and suppliers see. Bulk uploads moved to <b>Settings &rarr; Master data</b>.
        </p>
      </header>

      <div className="cfg-layout">
        <div className="cfg-stack" ref={stackRef}>

          {/* ============== AGENCY PLAN (gated: agencyPro flag + agency tenant) ============== */}
          {showPlanCard && (
            <div data-cfg-section="plan">
              <window.AgencyPlanCard />
            </div>
          )}

          {/* ===== AGENCY PRO · Dayforce HCM bench sync (gated: Pro plan) ===== */}
          {showPlanCard && window.isAgencyProActive && window.isAgencyProActive() && window.AgencyHcmSyncCard && (
            <div data-cfg-section="hcm-sync">
              <window.AgencyHcmSyncCard />
            </div>
          )}

          {/* ===== AGENCY PRO · Automatic worker invitations (gated: autoWorkerInvite flag + agency tenant) ===== */}
          {autoInviteOn && isAgencyTenantCfg && window.AgencyWorkerInviteCard && (
            <div data-cfg-section="worker-invite">
              <window.AgencyWorkerInviteCard />
            </div>
          )}

          {/* ============== ORGANIZATION PROFILE ============== */}
          <div data-cfg-section="org">
            <SectionCard
              variant="compact"
              icon="Building"
              title="Organization profile"
              action={(
                <span className="cfg-tag cfg-tag--neutral">
                  <Icon name="Information" size={12} />
                  Tenant ID&nbsp;<span style={{ fontFamily: "var(--evr-font-mono)" }}>{data.dayforce.tenantId}</span>
                </span>
              )}
            >
              <p className="cfg-card-blurb">
                Identity used across Flex Work, worker invitations, and supplier contracts. Editing
                requires the <strong>Org admin</strong> role.
              </p>

              <CfgField label="Logo" hint="Square SVG or PNG, 256 × 256 px or larger. Shown in nav, emails, and the worker app.">
                <div className="cfg-logoblock">
                  <span className="cfg-logo-preview">
                    <img src={data.org.logo} alt="" />
                  </span>
                  <div className="cfg-logo-text">
                    <p className="cfg-logo-name">{data.org.name}</p>
                    <p className="cfg-logo-spec">{data.org.logoSize}</p>
                  </div>
                  <div className="cfg-logo-actions">
                    <button
                      type="button"
                      className="vms-btn vms-btn--secondary"
                      onClick={() => showToast("Logo upload — preview only")}
                    >
                      <Icon name="FileUpload" size={14} />Replace
                    </button>
                    <button
                      type="button"
                      className="vms-btn vms-btn--tertiary"
                      onClick={() => showToast("Logo removed (preview)")}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </CfgField>

              <div className="cfg-grid" style={{ marginTop: 4 }}>
                <CfgField label="Organization name">
                  <TextInput value={data.org.name} onChange={(v) => set("org.name", v)} />
                </CfgField>
                <CfgField label="Legal entity">
                  <TextInput value={data.org.legalName} onChange={(v) => set("org.legalName", v)} />
                </CfgField>

                <CfgField label="Industry">
                  <Dropdown
                    options={["Manufacturing", "Hospitality", "Retail", "Healthcare", "Logistics", "Light industrial", "Public sector"]}
                    value={data.org.industry}
                    onChange={(v) => set("org.industry", v)}
                  />
                </CfgField>
                <CfgField label="Organization type">
                  <Dropdown
                    options={["Corporation", "LLC", "Non-profit", "Government", "Partnership"]}
                    value={data.org.orgType}
                    onChange={(v) => set("org.orgType", v)}
                  />
                </CfgField>

                <CfgField label="Tax ID / EIN" hint="Required for invoice generation.">
                  <TextInput value={data.org.ein} onChange={(v) => set("org.ein", v)} />
                </CfgField>
                <CfgField label="Headquarters">
                  <TextInput value={data.org.hqAddress} onChange={(v) => set("org.hqAddress", v)} />
                </CfgField>
              </div>
            </SectionCard>
          </div>

          {/* ============== DAYFORCE ECOSYSTEM ============== */}
          <div data-cfg-section="dayforce">
            <SectionCard
              variant="compact"
              icon="LinkNewWindow"
              title="Dayforce ecosystem"
              action={(
                <span className="cfg-conn">
                  <span className="cfg-conn-dot" />
                  Connected
                </span>
              )}
            >
              <p className="cfg-card-blurb">
                Flex Work is wired into your Dayforce HCM tenant. Employees, departments, and GL
                accounts flow in; approved timesheets flow out for payroll. Identity is brokered by
                Dayforce HCM SSO.
              </p>

              <div className="cfg-grid">
                <CfgField label="Tenant ID">
                  <CfgReadOnly value={data.dayforce.tenantId} mono />
                </CfgField>
                <CfgField label="Environment">
                  <Dropdown
                    options={["Production", "Sandbox", "Stage"]}
                    value={data.dayforce.environment}
                    onChange={(v) => set("dayforce.environment", v)}
                  />
                </CfgField>
                <CfgField label="Dayforce HCM instance" span={2}>
                  <CfgReadOnly value={data.dayforce.instanceUrl} mono />
                </CfgField>
              </div>

              <div style={{ marginTop: 16 }}>
                <SyncRow
                  icon="Users"
                  title="Employee directory sync"
                  sub={`${data.dayforce.employeeCount.toLocaleString()} active employees · ${data.dayforce.employeeSyncCadence}`}
                  meta="Last synced"
                  metaValue={data.dayforce.employeeLastSync}
                  enabled={data.dayforce.employeeSync}
                  onToggle={(v) => set("dayforce.employeeSync", v)}
                />
                <SyncRow
                  icon="Stack"
                  title="Departments"
                  sub={`${data.dayforce.costCenterCount} departments · ${data.dayforce.costCenterSyncCadence}`}
                  meta="Last synced"
                  metaValue={data.dayforce.costCenterLastSync}
                  enabled={data.dayforce.costCenterSync}
                  onToggle={(v) => set("dayforce.costCenterSync", v)}
                />
                <SyncRow
                  icon="Wallet"
                  title="GL accounts"
                  sub={`${data.dayforce.glSyncCadence}`}
                  meta="Last synced"
                  metaValue={data.dayforce.glLastSync}
                  enabled={data.dayforce.glSync}
                  onToggle={(v) => set("dayforce.glSync", v)}
                />
                <SyncRow
                  icon="Pay"
                  title="Payroll export"
                  sub={`Approved timesheets → Dayforce HCM · ${data.dayforce.payrollExportCadence}`}
                  meta="Mode"
                  metaValue="Real-time"
                  enabled={data.dayforce.payrollExport}
                  onToggle={(v) => set("dayforce.payrollExport", v)}
                />
                <SyncRow
                  icon="ShieldPerson"
                  title="Single sign-on"
                  sub={`${data.dayforce.ssoProvider} · ${data.dayforce.ssoStatus}`}
                  meta="SCIM"
                  metaValue={data.dayforce.scim ? "On" : "Off"}
                  enabled={data.dayforce.scim}
                  onToggle={(v) => set("dayforce.scim", v)}
                  rightAction={(
                    <button
                      type="button"
                      className="linkbtn"
                      onClick={() => showToast("Opens Dayforce HCM admin")}
                    >
                      Manage <Icon name="LinkNewWindow" size={12} />
                    </button>
                  )}
                />
              </div>
            </SectionCard>
          </div>

          {/* ============== WORKER-FACING BRAND ============== */}
          <div data-cfg-section="worker">
            <SectionCard
              variant="compact"
              icon="Phone"
              title="Worker-facing brand"
            >
              <p className="cfg-card-blurb">
                What workers see in the Shifts mobile app, on shift invitations, and in confirmation
                emails. Distinct from your internal org profile.
              </p>

              <CfgField label="App icon" hint="64 × 64 px PNG. Falls back to org logo if not set.">
                <div className="cfg-logoblock">
                  <span className="cfg-logo-preview">
                    <img src={data.worker.workerLogo} alt="" />
                  </span>
                  <div className="cfg-logo-text">
                    <p className="cfg-logo-name">{data.worker.displayName}</p>
                    <p className="cfg-logo-spec">Inherits from org logo</p>
                  </div>
                  <div className="cfg-logo-actions">
                    <button
                      type="button"
                      className="vms-btn vms-btn--secondary"
                      onClick={() => showToast("Logo upload — preview only")}
                    >
                      <Icon name="FileUpload" size={14} />Upload
                    </button>
                  </div>
                </div>
              </CfgField>

              <div className="cfg-grid">
                <CfgField label="Display name" hint="Shown as the org name in the worker app.">
                  <TextInput value={data.worker.displayName} onChange={(v) => set("worker.displayName", v)} />
                </CfgField>
                <CfgField label="Brand color" hint="Used for buttons and accents in the worker app.">
                  <CfgSwatches value={data.worker.brandColor} onChange={(v) => set("worker.brandColor", v)} />
                </CfgField>

                <CfgField label="Welcome message" span={2}>
                  <TextInput value={data.worker.welcome} onChange={(v) => set("worker.welcome", v)} />
                </CfgField>

                <CfgField label="Worker support email">
                  <TextInput value={data.worker.supportEmail} onChange={(v) => set("worker.supportEmail", v)} />
                </CfgField>
                <CfgField label="Worker support phone">
                  <TextInput value={data.worker.supportPhone} onChange={(v) => set("worker.supportPhone", v)} />
                </CfgField>
              </div>
            </SectionCard>
          </div>

          {/* ============== REGIONAL DEFAULTS ============== */}
          <div data-cfg-section="region">
            <SectionCard
              variant="compact"
              icon="Globe"
              title="Regional defaults"
            >
              <p className="cfg-card-blurb">
                Used for new requisitions, scheduling, and reports. Sites can override these
                from <button type="button" className="linkbtn" onClick={() => onGoTo && onGoTo({ page: "locations" })}>Sites</button>.
              </p>

              <div className="cfg-grid cfg-grid--three">
                <CfgField label="Default currency">
                  <Dropdown
                    options={["USD — US Dollar", "CAD — Canadian Dollar", "MXN — Mexican Peso", "EUR — Euro", "GBP — Pound Sterling"]}
                    value={data.region.currency}
                    onChange={(v) => set("region.currency", v)}
                  />
                </CfgField>
                <CfgField label="Default time zone">
                  <Dropdown
                    options={[
                      "America/Los_Angeles",
                      "America/Denver",
                      "America/Chicago",
                      "America/New_York",
                      "America/Toronto",
                      "Europe/London",
                    ]}
                    value={data.region.timeZone}
                    onChange={(v) => set("region.timeZone", v)}
                  />
                </CfgField>
                <CfgField label="Language">
                  <Dropdown
                    options={["English (US)", "English (UK)", "Français (Canada)", "Español (México)"]}
                    value={data.region.language}
                    onChange={(v) => set("region.language", v)}
                  />
                </CfgField>

                <CfgField label="Date format">
                  <Dropdown
                    options={["MMM D, YYYY", "YYYY-MM-DD", "DD/MM/YYYY", "MM/DD/YYYY"]}
                    value={data.region.dateFormat}
                    onChange={(v) => set("region.dateFormat", v)}
                  />
                </CfgField>
                <CfgField label="Time format">
                  <Dropdown
                    options={["12h", "24h"]}
                    value={data.region.timeFormat}
                    onChange={(v) => set("region.timeFormat", v)}
                  />
                </CfgField>
                <CfgField label="Measurement system">
                  <Dropdown
                    options={["Imperial", "Metric"]}
                    value={data.region.measurement}
                    onChange={(v) => set("region.measurement", v)}
                  />
                </CfgField>

                <CfgField label="Week starts on">
                  <Dropdown
                    options={["Sunday", "Monday", "Saturday"]}
                    value={data.region.weekStart}
                    onChange={(v) => set("region.weekStart", v)}
                  />
                </CfgField>
                <CfgField label="Fiscal year starts" hint="Drives the budgeting calendar.">
                  <Dropdown
                    options={["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]}
                    value={data.region.fiscalYearStart}
                    onChange={(v) => set("region.fiscalYearStart", v)}
                  />
                </CfgField>
              </div>
            </SectionCard>
          </div>

          {/* ============== OPERATIONAL DEFAULTS ============== */}
          <div data-cfg-section="defaults">
            <SectionCard
              variant="compact"
              icon="Adjustment"
              title="Operational defaults"
            >
              <p className="cfg-card-blurb">
                Tenant-wide starting points for new requisitions and timesheets. Each can be
                overridden at the location, department, or shift level.
              </p>

              {/* Linked-defaults: these point at other settings tabs */}
              <div style={{ marginBottom: 8 }}>
                <LinkRow
                  title="Default approval workflow"
                  sub={<>Applied to new requisitions without an explicit override · <strong>{data.defaults.approvalWorkflow}</strong></>}
                  onClick={() => onGoTo && onGoTo({ page: "settings", sub: "workflows" })}
                  cta="Manage workflows"
                />
                <LinkRow
                  title="Default supplier distribution"
                  sub={<>How new requisitions reach your supplier network · <strong>{data.defaults.distribution}</strong></>}
                  onClick={() => onGoTo && onGoTo({ page: "settings", sub: "supplier-distribution" })}
                  cta="Manage distribution"
                />
                <LinkRow
                  title="Default pricing"
                  sub={<>Bill rates, pay rates, and markups · <strong>Markup × 1.42 (Tier 1)</strong></>}
                  onClick={() => onGoTo && onGoTo({ page: "settings", sub: "pricing" })}
                  cta="Manage pricing"
                />
              </div>

              {/* Clock in / out method — org-wide default, overridable per location */}
              <div
                className="cfg-link-row"
                style={{ borderBottom: "1px solid var(--evr-border-decorative-lowemp)", alignItems: "flex-start" }}
              >
                <div>
                  <p className="cfg-link-title">Default clock in / out method</p>
                  <p className="cfg-link-sub">
                    How workers record start and end times. Individual locations can override
                    this in their Edit location form.
                  </p>
                </div>
                <div className="acct-segmented" role="radiogroup" aria-label="Default clock in / out method">
                  {[
                    { value: "Dayforce Clock", label: "Dayforce Clock", icon: "PersonClock" },
                    { value: "QR Code",        label: "QR Code",        icon: "QrCode" },
                    { value: "Manual",         label: "Manual",         icon: "Edit" },
                  ].map((opt) => {
                    const active = data.defaults.clockMethod === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        className={active ? "is-active" : ""}
                        onClick={() => set("defaults.clockMethod", opt.value)}
                        style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
                      >
                        <Icon name={opt.icon} size={16} />
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Simple field-style defaults */}
              <div className="cfg-grid cfg-grid--three" style={{ paddingTop: 16, borderTop: "1px solid var(--evr-border-decorative-lowemp)" }}>
                <CfgField label="Time rounding">
                  <Dropdown
                    options={["No rounding", "5 min · nearest", "10 min · nearest", "15 min · nearest", "15 min · up", "1 min · nearest"]}
                    value={data.defaults.timeRounding}
                    onChange={(v) => set("defaults.timeRounding", v)}
                  />
                </CfgField>
                <CfgField label="Day-end cutoff" hint="Splits shifts crossing midnight.">
                  <Dropdown
                    options={["00:00 (local)", "01:00 (local)", "02:00 (local)", "03:00 (local)", "04:00 (local)"]}
                    value={data.defaults.dayEndCutoff}
                    onChange={(v) => set("defaults.dayEndCutoff", v)}
                  />
                </CfgField>
                <CfgField label="Auto-archive (days)" hint="Closed requisitions older than this are archived.">
                  <Dropdown
                    options={["30", "60", "90", "180", "365"]}
                    value={String(data.defaults.autoArchive)}
                    onChange={(v) => set("defaults.autoArchive", Number(v))}
                  />
                </CfgField>

                <CfgField label="Minimum lead time (hrs)" hint="Workers can't book shifts starting in less than this.">
                  <Dropdown
                    options={["0", "1", "2", "4", "6", "8", "12", "24"]}
                    value={String(data.defaults.minLeadHours)}
                    onChange={(v) => set("defaults.minLeadHours", Number(v))}
                  />
                </CfgField>
                <CfgField label="Maximum shift (hrs)">
                  <Dropdown
                    options={["8", "10", "12", "14", "16"]}
                    value={String(data.defaults.maxShiftHours)}
                    onChange={(v) => set("defaults.maxShiftHours", Number(v))}
                  />
                </CfgField>
                <CfgField label="Department required" hint="Block requisition creation without a department.">
                  <div style={{ display: "inline-flex", alignItems: "center", gap: 12, height: 40 }}>
                    <Switch
                      checked={data.defaults.requireCostCenter}
                      onChange={(v) => set("defaults.requireCostCenter", v)}
                      ariaLabel="Department required"
                    />
                    <span style={{ font: "var(--evr-body2)", color: "var(--evr-content-primary-default)" }}>
                      {data.defaults.requireCostCenter ? "Required" : "Optional"}
                    </span>
                  </div>
                </CfgField>
              </div>
            </SectionCard>
          </div>

          {/* ============== ENGAGEMENT TYPES ============== */}
          <div data-cfg-section="engagementTypes">
            <EngagementTypesCard onGoTo={onGoTo} />
          </div>

          {/* ============== CANDIDATE WORKFLOW (gated by interviews flag) ============== */}
          {interviewsOn && (
            <div data-cfg-section="candidateWorkflow">
              <CandidateWorkflowCard />
            </div>
          )}

          {/* ============== PROJECT SETTINGS (gated by engProject) ==============
               Per-org configuration for the Project engagement type —
               number sequence, budget approval matrix, change-order policy,
               burn alerts, task catalog, closeout, supplier visibility,
               role permissions. Owned by pages/project-engagement.jsx +
               pages/project-engagement-views.jsx. With engProject off the
               component returns null and the section is invisible. */}
          {window.ProjectAdminPanel && window.PSProjects && window.PSProjects.isProjectOn() && (
            <div data-cfg-section="projectSettings">
              <window.ProjectAdminPanel />
            </div>
          )}

          {/* ============== SUPPLIER TYPES ============== */}
          <div data-cfg-section="supplierTypes">
            <SupplierTypesCard onGoTo={onGoTo} />
          </div>

          {/* ============== SOW PROGRAM (gated by engStatementOfWork) ============== */}
          {sowOn && window.SowConfigurationCard && (
            <div data-cfg-section="sowProgram">
              <window.SowConfigurationCard onGoTo={onGoTo} />
            </div>
          )}

          {/* ============== IC PROGRAM (gated by contractors flag) ============== */}
          {contractorsOnCfg && window.ContractorConfigurationCard && (
            <div data-cfg-section="contractorProgram">
              <window.ContractorConfigurationCard onGoTo={onGoTo} />
            </div>
          )}

          {/* ============== PROGRAM (funding model — always shown) ============== */}
          <div data-cfg-section="program">
            <ProgramFundingCard
              data={data.program}
              set={set}
              onGoTo={onGoTo}
              tempSpend={(window.getTempSpend && window.getTempSpend()) || null}
              industry={(window.getIndustry && window.getIndustry()) || null}
            />
          </div>

          {/* ============== JOBS CATEGORIES (per-org, replaces Professional flag) ============== */}
          <div data-cfg-section="jobs">
            <JobsCategoryCard onGoTo={onGoTo} />
          </div>

          {/* ============== SALES TAX (gated by salesTax flag) ============== */}
          {salesTaxOn && (
            <div data-cfg-section="salesTax">
              <SalesTaxCard
                data={data.salesTax}
                set={set}
                onGoTo={onGoTo}
                tempSpend={(window.getTempSpend && window.getTempSpend()) || null}
                industry={(window.getIndustry && window.getIndustry()) || null}
                programData={data.program}
              />
            </div>
          )}

          {/* ============== WORKER HOURS THRESHOLD ALERT ============== */}
          <div data-cfg-section="hoursAlert">
            <SectionCard
              variant="compact"
              icon="Alert"
              title="Worker hours threshold alert"
              action={
                data.hoursAlert.enabled ? (
                  <span className="cfg-conn">
                    <span className="cfg-conn-dot" />
                    On
                  </span>
                ) : (
                  <span className="cfg-tag cfg-tag--neutral">
                    <span
                      className="cfg-conn-dot"
                      style={{ background: "var(--evr-inactive-content)" }}
                    />
                    Off
                  </span>
                )
              }
            >
              <p className="cfg-card-blurb">
                Warn schedulers and managers when assigning a worker whose <strong>worked or scheduled hours</strong> in
                the chosen period would exceed the threshold. Surfaces inline on the assign-to-shift dialog,
                bulk-assign flows, and supplier offer review.
              </p>

              <div className="cfg-link-row" style={{ borderBottom: "1px solid var(--evr-border-decorative-lowemp)" }}>
                <div>
                  <p className="cfg-link-title">Enable threshold alert</p>
                  <p className="cfg-link-sub">
                    Turn off to skip the hours check entirely. Other policies (overtime, breaks) are unaffected.
                  </p>
                </div>
                <Switch
                  checked={data.hoursAlert.enabled}
                  onChange={(v) => set("hoursAlert.enabled", v)}
                  ariaLabel="Enable worker hours threshold alert"
                />
              </div>

              <div
                className="cfg-grid cfg-grid--three"
                style={{
                  paddingTop: 16,
                  opacity: data.hoursAlert.enabled ? 1 : 0.5,
                  pointerEvents: data.hoursAlert.enabled ? "auto" : "none",
                }}
                aria-disabled={!data.hoursAlert.enabled}
              >
                <CfgField label="Threshold" hint="Total hours within the period.">
                  <Dropdown
                    options={["24", "30", "32", "35", "37.5", "40", "44", "45", "48", "50", "55", "60"]}
                    value={String(data.hoursAlert.thresholdHours)}
                    onChange={(v) => set("hoursAlert.thresholdHours", Number(v))}
                  />
                </CfgField>
                <CfgField label="Period">
                  <Dropdown
                    options={[
                      "Per day",
                      "Per week (Sun – Sat)",
                      "Per week (Mon – Sun)",
                      "Rolling 7 days",
                      "Rolling 14 days",
                      "Pay period",
                    ]}
                    value={data.hoursAlert.period}
                    onChange={(v) => set("hoursAlert.period", v)}
                  />
                </CfgField>
                <CfgField label="Counts toward total" hint="What hours roll up to the threshold check.">
                  <Dropdown
                    options={[
                      "Worked hours only",
                      "Scheduled hours only",
                      "Scheduled + worked",
                    ]}
                    value={data.hoursAlert.counts}
                    onChange={(v) => set("hoursAlert.counts", v)}
                  />
                </CfgField>

                <CfgField label="When exceeded on assignment">
                  <Dropdown
                    options={[
                      "Warn scheduler",
                      "Warn — require acknowledgement",
                      "Require override approval",
                      "Block assignment",
                    ]}
                    value={data.hoursAlert.severity}
                    onChange={(v) => set("hoursAlert.severity", v)}
                  />
                </CfgField>
                <CfgField label="Override allowed by" hint="Only applies when severity requires override.">
                  <Dropdown
                    options={[
                      "Scheduler",
                      "Scheduling manager",
                      "Department head",
                      "Compliance officer",
                    ]}
                    value={data.hoursAlert.overrideRole}
                    onChange={(v) => set("hoursAlert.overrideRole", v)}
                  />
                </CfgField>
                <CfgField label="Include hours at other employers" hint="For agency workers with multi-employer hours feed.">
                  <div style={{ display: "inline-flex", alignItems: "center", gap: 12, height: 40 }}>
                    <Switch
                      checked={data.hoursAlert.includeOtherEmployers}
                      onChange={(v) => set("hoursAlert.includeOtherEmployers", v)}
                      ariaLabel="Include hours at other employers"
                    />
                    <span style={{ font: "var(--evr-body2)", color: "var(--evr-content-primary-default)" }}>
                      {data.hoursAlert.includeOtherEmployers ? "Included" : "Excluded"}
                    </span>
                  </div>
                </CfgField>
              </div>

              {/* Notify recipients */}
              <div
                style={{
                  marginTop: 20,
                  paddingTop: 16,
                  borderTop: "1px solid var(--evr-border-decorative-lowemp)",
                  opacity: data.hoursAlert.enabled ? 1 : 0.5,
                  pointerEvents: data.hoursAlert.enabled ? "auto" : "none",
                }}
              >
                <p className="cfg-field-label" style={{ marginBottom: 8 }}>Notify when triggered</p>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {[
                    { key: "notifyScheduler", title: "Assigning scheduler", sub: "Inline warning on the assignment dialog." },
                    { key: "notifySupervisor", title: "Worker's supervisor", sub: "Email digest the morning of the over-threshold shift." },
                    { key: "notifyWorker",    title: "The worker", sub: "In-app notification in Shifts mobile app." },
                  ].map((r) => (
                    <div key={r.key} className="cfg-link-row">
                      <div>
                        <p className="cfg-link-title">{r.title}</p>
                        <p className="cfg-link-sub">{r.sub}</p>
                      </div>
                      <Switch
                        checked={!!data.hoursAlert[r.key]}
                        onChange={(v) => set(`hoursAlert.${r.key}`, v)}
                        ariaLabel={`Notify ${r.title}`}
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Preview of how the warning surfaces at assignment time */}
              <div
                style={{
                  marginTop: 20,
                  padding: 16,
                  borderRadius: 12,
                  background: "var(--evr-surface-secondary-default)",
                  border: "1px solid var(--evr-border-decorative-lowemp)",
                }}
              >
                <div style={{ font: "var(--evr-utility2)", textTransform: "uppercase", letterSpacing: 0.5, color: "var(--evr-content-primary-lowemp)", marginBottom: 10 }}>
                  Preview · assignment dialog
                </div>
                <div
                  role="alert"
                  style={{
                    display: "grid",
                    gridTemplateColumns: "auto 1fr auto",
                    gap: 12,
                    alignItems: "start",
                    padding: 12,
                    borderRadius: 10,
                    background: "var(--evr-surface-status-warning-lowemp)",
                    border: "1px solid var(--evr-border-status-warning)",
                    color: "var(--evr-content-status-warning-highemp)",
                  }}
                >
                  <Icon name="Alert" size={20} />
                  <div style={{ color: "var(--evr-content-primary-highemp)" }}>
                    <div style={{ font: "var(--evr-body1-bold)", marginBottom: 4 }}>
                      Assigning this shift puts Priya Aravind over the {data.hoursAlert.thresholdHours} hr threshold
                    </div>
                    <div style={{ font: "var(--evr-body2)", color: "var(--evr-content-primary-default)" }}>
                      {data.hoursAlert.counts === "Worked hours only" ? "Worked" : data.hoursAlert.counts === "Scheduled hours only" ? "Scheduled" : "Scheduled + worked"}{" "}
                      <strong>{Math.max(0, data.hoursAlert.thresholdHours - 4)} hrs</strong> {data.hoursAlert.period.toLowerCase()} · this 8 hr shift would total{" "}
                      <strong>{Math.max(0, data.hoursAlert.thresholdHours - 4) + 8} hrs</strong>{" "}
                      (+{Math.max(0, data.hoursAlert.thresholdHours - 4) + 8 - data.hoursAlert.thresholdHours} over).
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    {data.hoursAlert.severity === "Block assignment" ? (
                      <span className="cfg-tag cfg-tag--neutral" style={{ background: "var(--evr-surface-status-error-lowemp)", color: "var(--evr-content-status-error-highemp)" }}>
                        <Icon name="Cancel" size={12} />Blocked
                      </span>
                    ) : data.hoursAlert.severity === "Require override approval" ? (
                      <button type="button" className="vms-btn vms-btn--secondary vms-btn--sm">
                        Request {data.hoursAlert.overrideRole.toLowerCase()} approval
                      </button>
                    ) : data.hoursAlert.severity === "Warn — require acknowledgement" ? (
                      <button type="button" className="vms-btn vms-btn--primary vms-btn--sm">
                        Acknowledge &amp; assign
                      </button>
                    ) : (
                      <button type="button" className="vms-btn vms-btn--primary vms-btn--sm">
                        Assign anyway
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </SectionCard>
          </div>

          {/* ============== PUBLIC LINKS ============== */}
          <div data-cfg-section="links">
            <SectionCard
              variant="compact"
              icon="Link"
              title="Public links"
            >
              <p className="cfg-card-blurb">
                Where Flex Work links out to. These show up in the worker app footer, in supplier
                onboarding emails, and in invoice PDFs.
              </p>
              <div className="cfg-grid">
                <CfgField label="Organization website">
                  <TextInput value={data.links.website} onChange={(v) => set("links.website", v)} />
                </CfgField>
                <CfgField label="Help center">
                  <TextInput value={data.links.helpCenter} onChange={(v) => set("links.helpCenter", v)} />
                </CfgField>
                <CfgField label="Careers / become a worker">
                  <TextInput value={data.links.careers} onChange={(v) => set("links.careers", v)} />
                </CfgField>
                <CfgField label="Supplier onboarding">
                  <TextInput value={data.links.supplierOnboarding} onChange={(v) => set("links.supplierOnboarding", v)} />
                </CfgField>
                <CfgField label="Privacy policy">
                  <TextInput value={data.links.privacy} onChange={(v) => set("links.privacy", v)} />
                </CfgField>
                <CfgField label="Terms of service">
                  <TextInput value={data.links.terms} onChange={(v) => set("links.terms", v)} />
                </CfgField>
              </div>
            </SectionCard>
          </div>

          {/* Sticky save bar */}
          {dirty && (
            <div className="cfg-savebar" role="status" aria-live="polite">
              <Icon name="Edit" size={16} />
              <span className="cfg-savebar-text">
                You have <strong>unsaved changes</strong>. These take effect across Flex Work on save.
              </span>
              <button type="button" className="vms-btn vms-btn--tertiary" onClick={onDiscard}>
                Discard
              </button>
              <button type="button" className="vms-btn vms-btn--primary" onClick={onSave}>
                <Icon name="Check" size={14} />Save changes
              </button>
            </div>
          )}
        </div>

        <CfgRail items={railItems} activeId={activeId} onJump={jumpTo} />
      </div>
    </div>
  );
}

// ---------- Sub-components used above --------------------------------

// =====================================================================
// ENGAGEMENT TYPES \u2014 per-org configuration of which engagement-type
// axes are available on this tenant.
//
// In v0.78 the engagement-type axis (Shift / Assignment / Project /
// Statement of Work) moves out of Settings \u2192 Feature Flags and into
// Settings \u2192 Configuration. Every org carries its own pre-baked set
// of enabled types \u2014 most existing tenants ship Shift-only; the
// Helios Power Generation tenant ships with the full matrix on.
//
// Storage + sync live in pages/engagement-types-config.jsx. This card
// is a thin UI over `getEngagementTypeConfig()` /
// `setEngagementTypeFlag()` + a `featureflags:change` subscription so
// it re-renders when an external surface mutates the same store.
//
// Shift is always-on and rendered as a locked row; the three additive
// types each render with a `<Switch>`. When the resulting enabled-set
// is `["Shift"]` only, downstream consumers (EngagementTypePicker on
// new-requisition, the column + filter chips on every list) hide
// themselves automatically per their existing `opts.length <= 1`
// guards \u2014 no separate plumbing needed here.
// =====================================================================
const ENGAGEMENT_TYPE_ROWS = [
  {
    key: "shift",
    flagId: null,                     // always-on, no flag
    label: "Shift",
    icon: "EngagementShift",
    summary:
      "Scheduled shift with clock in/out. One-off, multi-day, or recurring \u2014 covered by an agency worker on an hourly bill rate. Always enabled \u2014 this is the canonical Flex Work cell.",
  },
  {
    key: "assignment",
    flagId: "engAssignment",
    label: "Assignment",
    icon: "EngagementAssignment",
    summary:
      "Named worker on a date-range assignment. Period timesheet billing \u2014 no recurring schedule, no clock punch. Billing basis can be Hourly, Weekly, Monthly, or Fixed.",
  },
  {
    key: "project",
    flagId: "engProject",
    label: "Project",
    icon: "EngagementProject",
    summary:
      "Supplier-led delivery against a project budget. Weekly burn reporting, no headcount commitment. Billing basis can be Fixed or Milestone; time capture is Time Tracking or N/A.",
  },
  {
    key: "sow",
    flagId: "engStatementOfWork",
    label: "Statement of Work",
    icon: "EngagementSow",
    summary:
      "MSA-anchored SOW. Milestones with fees, acceptance criteria, change orders. Supplier marks each milestone submitted; buyer accepts to fire the invoice.",
  },
];

function EngagementTypesCard({ onGoTo }) {
  // Live read of the per-org engagement-type config. Re-resolves on
  // every `featureflags:change` event so toggling a row updates the
  // header chip + enabled-count without a remount.
  const read = React.useCallback(() => {
    if (window.getEngagementTypeConfig) return window.getEngagementTypeConfig();
    return { engAssignment: false, engProject: false, engStatementOfWork: false };
  }, []);
  const [cfg, setCfg] = React.useState(read);
  React.useEffect(() => {
    function onChange() { setCfg(read()); }
    window.addEventListener("featureflags:change", onChange);
    return () => window.removeEventListener("featureflags:change", onChange);
  }, [read]);

  const enabledCount =
    1 +
    (cfg.engAssignment ? 1 : 0) +
    (cfg.engProject ? 1 : 0) +
    (cfg.engStatementOfWork ? 1 : 0);

  const industry = (window.getIndustry && window.getIndustry()) || null;
  const orgName  = (industry && industry.name) || "this organization";

  function onToggle(flagId, val) {
    if (!flagId) return;
    if (window.setEngagementTypeFlag) {
      window.setEngagementTypeFlag(flagId, val);
    } else if (window.setFeatureFlag) {
      window.setFeatureFlag(flagId, val);
    }
    setCfg(read());
    if (window.showToast) {
      const def = ENGAGEMENT_TYPE_ROWS.find((r) => r.flagId === flagId);
      const label = def ? def.label : flagId;
      window.showToast(`${label} ${val ? "enabled" : "disabled"}`, { kind: val ? "success" : undefined });
    }
  }

  return (
    <SectionCard
      variant="compact"
      icon="Briefcase"
      title="Engagement types"
      action={(
        <span className="cfg-tag cfg-tag--neutral">
          <Icon name="Information" size={12} />
          {enabledCount} of {ENGAGEMENT_TYPE_ROWS.length} active
        </span>
      )}
    >
      <p className="cfg-card-blurb">
        Which intake modes can a requester pick on a new requisition for <strong>{orgName}</strong>.
        <strong> Shift</strong> is always on and ships with every tenant. The other three are additive \u2014
        turn one on to expose it on the Engagement type card during new-requisition intake and to
        light up the matching column and filter on every list (Requisitions, Workforce, Timesheets,
        Invoices). When only Shift is active, the Engagement type card is hidden on intake and the
        column collapses on every list \u2014 the surface stays byte-identical to today.
      </p>

      <ul className="cfg-engtypes-list" role="list">
        {ENGAGEMENT_TYPE_ROWS.map((r) => {
          const locked = r.flagId === null;
          const on     = locked ? true : !!cfg[r.flagId];
          return (
            <li
              key={r.key}
              className={"cfg-engtype-row" + (on ? " cfg-engtype-row--on" : "")}
            >
              <span className="cfg-engtype-icon" aria-hidden="true">
                <Icon name={r.icon} size={20} />
              </span>
              <div className="cfg-engtype-body">
                <div className="cfg-engtype-head">
                  <p className="cfg-engtype-title">{r.label}</p>
                  {locked ? (
                    <span className="cfg-engtype-state cfg-engtype-state--locked">
                      <Icon name="Lock" size={11} />Always on
                    </span>
                  ) : (
                    <span className={"cfg-engtype-state" + (on ? " cfg-engtype-state--on" : "")}>
                      {on ? "On" : "Off"}
                    </span>
                  )}
                </div>
                <p className="cfg-engtype-sub">{r.summary}</p>
              </div>
              <div className="cfg-engtype-aside">
                {locked ? (
                  <Switch checked disabled ariaLabel="Shift \u2014 always enabled" />
                ) : (
                  <Switch
                    checked={on}
                    onChange={(v) => onToggle(r.flagId, v)}
                    ariaLabel={`${r.label} \u2014 toggle`}
                  />
                )}
              </div>
            </li>
          );
        })}
      </ul>

      {enabledCount === 1 && (
        <p className="cfg-engtype-note">
          <Icon name="Information" size={12} />
          <span>
            With only Shift active, the Engagement type card is hidden on new requisitions and the
            Engagement type column is hidden on every list.
          </span>
        </p>
      )}
    </SectionCard>
  );
}

// =====================================================================
// SupplierTypesCard
//
// In v0.79 the supplier-type axis (Agency / Independent Contractor /
// EOR) moves out of Settings → Feature Flags and into Settings →
// Configuration. Every org carries its own pre-baked set of enabled
// types — every existing tenant ships Agency-only; the Helios Power
// Generation tenant ships with the full matrix on.
//
// Storage + sync live in pages/supplier-types-config.jsx. This card is
// a thin UI over `getSupplierTypeConfig()` / `setSupplierTypeFlag()` +
// a `featureflags:change` subscription so it re-renders when an
// external surface mutates the same store.
//
// Agency is always-on and rendered as a locked row; the two additive
// types each render with a `<Switch>`. When the resulting enabled-set
// is `["Agency"]` only, downstream consumers (workforce pool tabs,
// supplier filters, intake supplier-type picker, list columns) hide
// themselves automatically per their existing `opts.length <= 1`
// guards — no separate plumbing needed here.
// =====================================================================
const SUPPLIER_TYPE_ROWS = [
  {
    key: "agency",
    flagId: null,                     // always-on, no flag
    label: "Agency",
    icon: "Building",
    summary:
      "Staffing supplier under MSA. The canonical Flex Work model \u2014 a third-party supplier sources, employs, and bills for the worker. Always enabled.",
  },
  {
    key: "independentContractor",
    flagId: "independentContractor",
    label: "Independent Contractor",
    icon: "PersonAuthorize",
    summary:
      "Direct 1099 / IC. The buyer sources and contracts the worker; no supplier sits between. Adds the IRS 20-factor classification questionnaire, contractor onboarding, tax forms, banking, and self-submitted invoices. Surfaces an Independent Contractor pool on Workforce, IC chips on supplier lists, and a Classification + Tax tab on Compliance.",
  },
  {
    key: "eor",
    flagId: "eor",
    label: "EOR",
    icon: "Globe",
    summary:
      "Employer-of-Record for cross-border work. An in-country partner is the legal employer while the buyer directs the work. Adds local entity setup, in-country employment templates, and global tax / FX (per-engagement currency + fxLockDate). Surfaces an EOR pool on Workforce and a Local Employment tab on Compliance.",
  },
  {
    key: "float",
    flagId: "float",
    label: "Float",
    icon: "Refresh",
    summary:
      "Buyer's own internal cross-site workers \u2014 float-pool / per-diem RNs in healthcare, banquet / event-flex staff in hospitality. Directly employed by the organization but not tied to a single location, so they can pick up open requisitions across the system. Profile, schedule, and accrued hours sync from Dayforce core (system of record); Flex Work mirrors the worker so Distribution can target the float pool without going through a supplier tier. Pre-baked on for Mercy Health System.",
  },
];

function SupplierTypesCard({ onGoTo }) {
  // Live read of the per-org supplier-type config. Re-resolves on
  // every `featureflags:change` event so toggling a row updates the
  // header chip + enabled-count without a remount.
  const read = React.useCallback(() => {
    if (window.getSupplierTypeConfig) return window.getSupplierTypeConfig();
    return { independentContractor: false, eor: false, float: false };
  }, []);
  const [cfg, setCfg] = React.useState(read);
  React.useEffect(() => {
    function onChange() { setCfg(read()); }
    window.addEventListener("featureflags:change", onChange);
    return () => window.removeEventListener("featureflags:change", onChange);
  }, [read]);

  const enabledCount =
    1 +
    (cfg.independentContractor ? 1 : 0) +
    (cfg.eor ? 1 : 0) +
    (cfg.float ? 1 : 0);

  const industry = (window.getIndustry && window.getIndustry()) || null;
  const orgName  = (industry && industry.name) || "this organization";

  function onToggle(flagId, val) {
    if (!flagId) return;
    if (window.setSupplierTypeFlag) {
      window.setSupplierTypeFlag(flagId, val);
    } else if (window.setFeatureFlag) {
      window.setFeatureFlag(flagId, val);
    }
    setCfg(read());
    if (window.showToast) {
      const def = SUPPLIER_TYPE_ROWS.find((r) => r.flagId === flagId);
      const label = def ? def.label : flagId;
      window.showToast(`${label} ${val ? "enabled" : "disabled"}`, { kind: val ? "success" : undefined });
    }
  }

  return (
    <SectionCard
      variant="compact"
      icon="Building"
      title="Supplier types"
      action={(
        <span className="cfg-tag cfg-tag--neutral">
          <Icon name="Information" size={12} />
          {enabledCount} of {SUPPLIER_TYPE_ROWS.length} active
        </span>
      )}
    >
      <p className="cfg-card-blurb">
        Who can supply workers for <strong>{orgName}</strong>. <strong>Agency</strong> is always on and
        ships with every tenant. The other two are additive &mdash; turn one on to expose it on the
        Supplier type picker during new-requisition intake, light up Independent Contractor / EOR
        suppliers on the Suppliers list, surface matching workers on Workforce, and emit
        contractor-submitted / EOR invoices on Invoices. When only Agency is active, the supplier-type
        column collapses on every list and the picker hides on intake &mdash; the surface stays
        byte-identical to today.
      </p>

      <ul className="cfg-engtypes-list" role="list">
        {SUPPLIER_TYPE_ROWS.map((r) => {
          const locked = r.flagId === null;
          const on     = locked ? true : !!cfg[r.flagId];
          return (
            <li
              key={r.key}
              className={"cfg-engtype-row" + (on ? " cfg-engtype-row--on" : "")}
            >
              <span className="cfg-engtype-icon" aria-hidden="true">
                <Icon name={r.icon} size={20} />
              </span>
              <div className="cfg-engtype-body">
                <div className="cfg-engtype-head">
                  <p className="cfg-engtype-title">{r.label}</p>
                  {locked ? (
                    <span className="cfg-engtype-state cfg-engtype-state--locked">
                      <Icon name="Lock" size={11} />Always on
                    </span>
                  ) : (
                    <span className={"cfg-engtype-state" + (on ? " cfg-engtype-state--on" : "")}>
                      {on ? "On" : "Off"}
                    </span>
                  )}
                </div>
                <p className="cfg-engtype-sub">{r.summary}</p>
              </div>
              <div className="cfg-engtype-aside">
                {locked ? (
                  <Switch checked disabled ariaLabel="Agency \u2014 always enabled" />
                ) : (
                  <Switch
                    checked={on}
                    onChange={(v) => onToggle(r.flagId, v)}
                    ariaLabel={`${r.label} \u2014 toggle`}
                  />
                )}
              </div>
            </li>
          );
        })}
      </ul>

      {enabledCount === 1 && (
        <p className="cfg-engtype-note">
          <Icon name="Information" size={12} />
          <span>
            With only Agency active, the Supplier type picker is hidden on new requisitions and the
            Supplier type column collapses on Suppliers, Workforce, Timesheets, and Invoices.
          </span>
        </p>
      )}
    </SectionCard>
  );
}

function SyncRow({ icon, title, sub, meta, metaValue, enabled, onToggle, rightAction }) {
  return (
    <div className="cfg-sync-row">
      <span className="cfg-sync-icon"><Icon name={icon} size={20} /></span>
      <div className="cfg-sync-body">
        <p className="cfg-sync-title">{title}</p>
        <p className="cfg-sync-sub">{sub}</p>
      </div>
      <div className="cfg-sync-meta">
        <span>{meta}</span>
        <span className="cfg-sync-meta-time">{metaValue}</span>
      </div>
      <div style={{ display: "inline-flex", alignItems: "center", gap: 12 }}>
        {rightAction}
        <Switch checked={enabled} onChange={onToggle} ariaLabel={title} />
      </div>
    </div>
  );
}

function LinkRow({ title, sub, onClick, cta }) {
  return (
    <div className="cfg-link-row">
      <div>
        <p className="cfg-link-title">{title}</p>
        <p className="cfg-link-sub">{sub}</p>
      </div>
      <button type="button" className="cfg-link-go" onClick={onClick}>
        {cta}
        <Icon name="ChevronRight" size={14} />
      </button>
    </div>
  );
}

// =====================================================================
// JobsCategoryCard
//
// In v0.80 the "Professional" feature flag moves out of Settings →
// Feature Flags and into Settings → Configuration → Program → Jobs.
// The configuration is per-org rather than per-tenant-feature-flag:
// each org carries its own set of enabled job categories that drive
// every job picker across the product (new requisition, templates,
// role defaults, reporting filters) and the Settings → Jobs page.
//
// Default policy
//   · Every org defaults to Frontline only.
//   · Helios Power Generation (energy) ships with both Frontline and
//     Professional enabled — the only seeded tenant whose contingent
//     program spans both books of work.
//
// Storage + sync live in pages/jobs-config.jsx. This card is a thin
// UI over `getJobsCategoryConfig()` / `setJobsCategoryFlag()` + a
// `featureflags:change` and `jobs:change` subscription so it
// re-renders when an external surface mutates the same store.
//
// Invariant: at least one category must stay enabled — the store
// force-flips the sibling on if the caller would land us at both off
// so a picker never goes empty.
// =====================================================================
const JOBS_CATEGORY_ROWS = [
  {
    key: "frontline",
    label: "Frontline",
    icon: "Bag",
    summary:
      "Warehouse, production, logistics, and hospitality job titles \u2014 the shift-based, schedule-driven workforce. Always on for new tenants; ships with a 12-row default catalog that admins can extend.",
  },
  {
    key: "professional",
    label: "Professional",
    icon: "Briefcase",
    summary:
      "Software, product, design, data, finance, marketing, and operations job titles \u2014 the assignment-based, salaried-equivalent workforce. Layered on top of the Frontline catalog; tenants whose contingent program spans both books of work enable both.",
  },
];

function JobsCategoryCard({ onGoTo }) {
  const read = React.useCallback(() => {
    if (window.getJobsCategoryConfig) return window.getJobsCategoryConfig();
    return { frontline: true, professional: false };
  }, []);
  const [cfg, setCfg] = React.useState(read);
  React.useEffect(() => {
    function onChange() { setCfg(read()); }
    window.addEventListener("featureflags:change", onChange);
    window.addEventListener("jobs:change", onChange);
    return () => {
      window.removeEventListener("featureflags:change", onChange);
      window.removeEventListener("jobs:change", onChange);
    };
  }, [read]);

  const enabledCount =
    (cfg.frontline    ? 1 : 0) +
    (cfg.professional ? 1 : 0);

  const industry = (window.getIndustry && window.getIndustry()) || null;
  const orgName  = (industry && industry.name) || "this organization";

  // Pre-computed list-size badges so the user sees how many jobs each
  // category currently carries — gives a hint of what's about to light
  // up across the product when they flip a switch.
  const frontlineCount    = (window.getJobsList ? window.getJobsList(null, "frontline").length    : 0);
  const professionalCount = (window.getJobsList ? window.getJobsList(null, "professional").length : 0);

  function onToggle(key, val) {
    if (window.setJobsCategoryFlag) {
      window.setJobsCategoryFlag(key, val);
    }
    setCfg(read());
    if (window.showToast) {
      const def = JOBS_CATEGORY_ROWS.find((r) => r.key === key);
      const label = def ? def.label : key;
      window.showToast(`${label} jobs ${val ? "enabled" : "disabled"}`, { kind: val ? "success" : undefined });
    }
  }

  return (
    <SectionCard
      variant="compact"
      icon="Briefcase"
      title="Jobs"
      action={(
        <span className="cfg-tag cfg-tag--neutral">
          <Icon name="Information" size={12} />
          {enabledCount} of {JOBS_CATEGORY_ROWS.length} active
        </span>
      )}
    >
      <p className="cfg-card-blurb">
        Which books of work <strong>{orgName}</strong> orders against. Drives every job picker across the
        product (new requisition &middot; templates &middot; role defaults &middot; reporting filters) plus the live
        catalog managed in <button type="button" className="linkbtn" onClick={() => onGoTo && onGoTo({ page: "settings", sub: "jobs" })}>Settings &rarr; Jobs</button>.
        Pick one or both &mdash; at least one must stay enabled so a picker never goes empty.
      </p>

      <ul className="cfg-engtypes-list" role="list">
        {JOBS_CATEGORY_ROWS.map((r) => {
          const on    = !!cfg[r.key];
          const count = r.key === "professional" ? professionalCount : frontlineCount;
          const isLast = enabledCount === 1 && on;
          return (
            <li
              key={r.key}
              className={"cfg-engtype-row" + (on ? " cfg-engtype-row--on" : "")}
            >
              <span className="cfg-engtype-icon" aria-hidden="true">
                <Icon name={r.icon} size={20} />
              </span>
              <div className="cfg-engtype-body">
                <div className="cfg-engtype-head">
                  <p className="cfg-engtype-title">
                    {r.label}
                    {on && (
                      <span className="cfg-jobs-count" title={`${count} jobs in this catalog`}>
                        {count} job{count === 1 ? "" : "s"}
                      </span>
                    )}
                  </p>
                  <span className={"cfg-engtype-state" + (on ? " cfg-engtype-state--on" : "")}>
                    {on ? "On" : "Off"}
                  </span>
                </div>
                <p className="cfg-engtype-sub">{r.summary}</p>
              </div>
              <div className="cfg-engtype-aside">
                <Switch
                  checked={on}
                  onChange={(v) => {
                    if (!v && isLast) {
                      if (window.showToast) {
                        window.showToast("At least one category must stay enabled", { kind: "warning" });
                      }
                      return;
                    }
                    onToggle(r.key, v);
                  }}
                  ariaLabel={`${r.label} \u2014 toggle`}
                />
              </div>
            </li>
          );
        })}
      </ul>

      <p className="cfg-engtype-note">
        <Icon name="Information" size={12} />
        <span>
          Job titles themselves are synced from <strong>Dayforce Core</strong> and edited in{" "}
          <button type="button" className="linkbtn" onClick={() => onGoTo && onGoTo({ page: "settings", sub: "jobs" })}>Settings &rarr; Jobs</button>.
          {enabledCount === 2 && <> The Jobs tab shows separate <strong>Frontline</strong> and <strong>Professional</strong> tabs when both categories are on; otherwise it renders the active category as a flat list.</>}
        </span>
      </p>
    </SectionCard>
  );
}

// =====================================================================
// Program funding card — the supplier-funding configuration UI gated by
// the supplierFunding feature flag. The buyer-funded / supplier-funded
// MSP setting + program fee:
//   · Master toggle (buyer-funded ↔ supplier-funded)
//   · Default fee % (program-wide, 0–10%)
//   · Calculation method (Markup adds to bill rate, Discount nets out)
//   · Engagement-type coverage (Frontline · Professional · SOW · Contractor)
//   · Per-supplier override allowed?
//   · Remittance handling (Net of fee | Gross then clawback)
//   · Effective date + invoice line-item label
//   · Live preview of how it renders on a $1,000 invoice
//   · Coverage banner stating: applies to all orgs, all countries,
//     all temp-spend tiers when ON
// =====================================================================
function ProgramFundingCard({ data, set, onGoTo, tempSpend, industry }) {
  const pfOn = !!data.supplierFunding;
  const feeNum = Number(data.feePct) || 0;

  // Preview math on a $1,000 invoice. Markup: bill = 1000, fee added
  // on top → buyer sees 1,000 + 1,000 × fee%. Discount: bill = 1,000,
  // supplier nets 1,000 × (1 − fee%).
  const previewBill = 1000;
  const feeAmt = previewBill * (feeNum / 100);
  const buyerTotal = data.method === "Markup" ? previewBill + feeAmt : previewBill;
  const netToSup   = data.method === "Markup" ? previewBill : previewBill - feeAmt;

  const fmt$ = (n) => "$" + n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const coverageOn = Object.entries(data.coverage || {})
    .filter(([_, v]) => v)
    .map(([k]) => ({ frontline: "Frontline", professional: "Professional", sow: "SOW", contractor: "Contractor" }[k]))
    .filter(Boolean);

  const coverageRows = [
    { key: "frontline",    title: "Frontline",     sub: "Shift-based, timesheet-driven supplier invoices." },
    { key: "professional", title: "Professional",  sub: "Weekly / monthly / annual contract invoices.",   flagId: "professionalWork" },
    { key: "sow",          title: "SOW",            sub: "Milestone-triggered SOW invoices.",              flagId: "sow" },
    { key: "contractor",   title: "Contractor",     sub: "1099 / IC self-submitted invoices.",             flagId: "contractors", warn: "Most programs exempt direct contractors — they're not suppliers." },
  ];

  return (
    <SectionCard
      variant="compact"
      icon="Wallet"
      title="Program"
      action={
        pfOn ? (
          <span className="cfg-conn cfg-conn--accent">
            <span className="cfg-conn-dot" />
            Supplier&#8209;funded&nbsp;·&nbsp;{feeNum}% {data.method.toLowerCase()}
          </span>
        ) : (
          <span className="cfg-tag cfg-tag--neutral">
            <span className="cfg-conn-dot" style={{ background: "var(--evr-inactive-content)" }} />
            Buyer&#8209;funded
          </span>
        )
      }
    >
      <p className="cfg-card-blurb">
        How this contingent program is funded. In a <strong>buyer&#8209;funded</strong> program, the buyer pays the
        VMS / MSP fee directly and suppliers receive the full invoice amount. In a{" "}
        <strong>supplier&#8209;funded</strong> program, a configured fee is deducted from every supplier invoice
        before remittance — typical range is 1.5% – 3.5% of program spend, negotiated in each supplier
        agreement. This is the program&#8209;wide default; individual supplier contracts can override it.
      </p>

      {/* Funding model — Buyer Funded vs Supplier Funded ------------------- */}
      <CfgField
        label="Funding model"
        hint="Buyer-funded programs invoice the buyer for the full bill amount. Supplier-funded programs deduct a program fee from every supplier invoice before remittance."
      >
        <div className="pf-fundingmodel" role="radiogroup" aria-label="Program funding model">
          {[
            {
              value: false,
              label: "Buyer Funded",
              sub: "Buyer pays the VMS / MSP fee directly. Suppliers receive the full invoice amount.",
              icon: "Building",
            },
            {
              value: true,
              label: "Supplier Funded",
              sub: "A configured program fee is deducted from every supplier invoice before remittance.",
              icon: "Wallet",
            },
          ].map((opt) => {
            const active = pfOn === opt.value;
            return (
              <button
                key={String(opt.value)}
                type="button"
                role="radio"
                aria-checked={active}
                className={"pf-fundingmodel-opt" + (active ? " is-active" : "")}
                onClick={() => set("program.supplierFunding", opt.value)}
              >
                <span className="pf-fundingmodel-radio" aria-hidden="true" />
                <span className="pf-fundingmodel-body">
                  <span className="pf-fundingmodel-title">
                    <Icon name={opt.icon} size={14} />
                    {opt.label}
                  </span>
                  <span className="pf-fundingmodel-sub">{opt.sub}</span>
                </span>
              </button>
            );
          })}
        </div>
      </CfgField>

      {/* Supplier-funded settings — only rendered when Supplier Funded is selected. */}
      {pfOn && (
      <div style={{ paddingTop: 8 }}>
        <div className="cfg-grid cfg-grid--three">
          <CfgField label="Program fee" hint="Applied to the bill amount on every supplier invoice.">
            <div className="pf-feeinput">
              <input
                type="number"
                step="0.05"
                min="0"
                max="10"
                className="pf-feeinput-input tabular"
                value={data.feePct}
                onChange={(e) => set("program.feePct", Number(e.target.value))}
                aria-label="Program fee percentage"
              />
              <span className="pf-feeinput-suffix">%</span>
            </div>
          </CfgField>

          <CfgField label="Calculation method" hint="Standard MSP fee terminology.">
            <div className="acct-segmented" role="radiogroup" aria-label="Fee calculation method">
              {[
                { value: "Markup",   label: "Markup",   sub: "added to bill" },
                { value: "Discount", label: "Discount", sub: "net of bill"   },
              ].map((opt) => {
                const active = data.method === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    className={active ? "is-active" : ""}
                    onClick={() => set("program.method", opt.value)}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </CfgField>

          <CfgField label="Effective date" hint="Invoices generated on or after this date carry the fee.">
            <TextInput
              value={data.effectiveDate}
              onChange={(v) => set("program.effectiveDate", v)}
            />
          </CfgField>

          <CfgField label="Invoice line label">
            <TextInput
              value={data.invoiceLabel}
              onChange={(v) => set("program.invoiceLabel", v)}
            />
          </CfgField>
          <CfgField label="Remittance" hint="How the fee is taken on payment day.">
            <Dropdown
              options={["Net of fee", "Gross then clawback"]}
              value={data.remittance}
              onChange={(v) => set("program.remittance", v)}
            />
          </CfgField>
          <CfgField label="Per-supplier overrides" hint="Individual supplier contracts can set their own fee %.">
            <div style={{ display: "inline-flex", alignItems: "center", gap: 12, height: 40 }}>
              <Switch
                checked={!!data.allowOverrides}
                onChange={(v) => set("program.allowOverrides", v)}
                ariaLabel="Allow per-supplier overrides"
              />
              <span style={{ font: "var(--evr-body2)", color: "var(--evr-content-primary-default)" }}>
                {data.allowOverrides ? "Allowed" : "Locked to default"}
              </span>
            </div>
          </CfgField>
        </div>

        {/* Engagement-type coverage */}
        <div
          style={{
            marginTop: 20,
            paddingTop: 16,
            borderTop: "1px solid var(--evr-border-decorative-lowemp)",
          }}
        >
          <p className="cfg-field-label" style={{ marginBottom: 4 }}>
            Apply the program fee to
          </p>
          <p className="cfg-field-hint" style={{ marginBottom: 12 }}>
            Each engagement type can independently opt in. Frontline is on by default; SOW / Professional /
            Contractor follow their own feature flags — turning a worker type off in Feature Flags hides
            that engagement from this list.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {coverageRows.map((r) => {
              const flagOn = !r.flagId || (window.getFeatureFlag && window.getFeatureFlag(r.flagId));
              return (
                <div
                  key={r.key}
                  className="cfg-link-row"
                  style={{ opacity: flagOn ? 1 : 0.55 }}
                >
                  <div>
                    <p className="cfg-link-title">
                      {r.title}
                      {!flagOn && (
                        <span className="pf-flag-off">
                          <Icon name="Lock" size={11} /> Worker type off
                        </span>
                      )}
                    </p>
                    <p className="cfg-link-sub">
                      {r.sub}
                      {r.warn && data.coverage[r.key] && (
                        <span className="pf-coverage-warn">
                          <Icon name="Alert" size={11} /> {r.warn}
                        </span>
                      )}
                    </p>
                  </div>
                  <Switch
                    checked={!!data.coverage[r.key]}
                    onChange={(v) => { if (flagOn) set(`program.coverage.${r.key}`, v); }}
                    ariaLabel={`Apply program fee to ${r.title}`}
                  />
                </div>
              );
            })}
          </div>
        </div>

        {/* Per-supplier overrides shortcut */}
        <div style={{ marginTop: 16 }}>
          <LinkRow
            title="Per-supplier fee overrides"
            sub={<>Strategic suppliers can be exempted; newer suppliers can carry a higher fee. Managed on each Supplier &rarr; Contract record.</>}
            onClick={() => onGoTo && onGoTo({ page: "suppliers" })}
            cta="Manage suppliers"
          />
        </div>

        {/* Coverage banner */}
        <div
          style={{
            marginTop: 16,
            padding: "12px 16px",
            display: "flex",
            gap: 12,
            alignItems: "flex-start",
            borderRadius: 12,
            background: "var(--evr-surface-status-informative-lowemp)",
            border: "1px solid var(--evr-content-status-informative-lowemp)",
          }}
        >
          <span style={{ color: "var(--evr-content-status-informative-default)", marginTop: 2 }}>
            <Icon name="Information" size={16} />
          </span>
          <div>
            <div style={{ font: "var(--evr-body2-bold)", color: "var(--evr-content-primary-highemp)", marginBottom: 2 }}>
              Tenant&#8209;wide coverage when on
            </div>
            <div style={{ font: "var(--evr-body2)", color: "var(--evr-content-primary-default)" }}>
              Applies to <strong>every organization, every country, every temp&#8209;spend tier</strong> this
              tenant is configured for
              {tempSpend && (<> — currently scoped to a <strong>{tempSpend.label}</strong> program ({tempSpend.countries.toLocaleString()} {tempSpend.countries === 1 ? "country" : "countries"} · {tempSpend.suppliers} suppliers)</>)}
              {industry && (<> in the <strong>{industry.tag}</strong> industry</>)}.
              The fee is taken on top of any existing markups, premiums, and taxes already on the invoice.
            </div>
          </div>
        </div>

        {/* Live invoice preview */}
        <div
          style={{
            marginTop: 20,
            padding: 16,
            borderRadius: 12,
            background: "var(--evr-surface-secondary-default)",
            border: "1px solid var(--evr-border-decorative-lowemp)",
          }}
        >
          <div style={{ font: "var(--evr-utility2)", textTransform: "uppercase", letterSpacing: 0.5, color: "var(--evr-content-primary-lowemp)", marginBottom: 10 }}>
            Preview · how it renders on a {fmt$(previewBill)} invoice
          </div>
          <div className="pf-preview">
            <div className="pf-prev-row">
              <span>Bill amount (supplier rate × hours)</span>
              <span className="tabular">{fmt$(previewBill)}</span>
            </div>
            {data.method === "Markup" && (
              <div className="pf-prev-row pf-prev-row--fee">
                <span>{data.invoiceLabel} ({feeNum}% markup)</span>
                <span className="tabular">+ {fmt$(feeAmt)}</span>
              </div>
            )}
            <div className="pf-prev-row pf-prev-row--total">
              <span>Buyer pays</span>
              <span className="tabular">{fmt$(buyerTotal)}</span>
            </div>
            <div className="pf-prev-divider" />
            {data.method === "Discount" && (
              <div className="pf-prev-row pf-prev-row--fee">
                <span>− {data.invoiceLabel} ({feeNum}% discount)</span>
                <span className="tabular">− {fmt$(feeAmt)}</span>
              </div>
            )}
            <div className="pf-prev-row pf-prev-row--total pf-prev-row--net">
              <span>Net to supplier</span>
              <span className="tabular">{fmt$(netToSup)}</span>
            </div>
          </div>
          <p className="cfg-field-hint" style={{ marginTop: 10 }}>
            {data.method === "Markup"
              ? <>The supplier sees their original {fmt$(previewBill)} bill rate. The buyer is invoiced {fmt$(buyerTotal)} — the {feeNum}% fee is added on top so the buyer can see what the program costs.</>
              : <>The buyer is invoiced the agreed-upon {fmt$(previewBill)}. The supplier receives {fmt$(netToSup)} — the {feeNum}% fee is netted out before remittance.</>}
            {coverageOn.length > 0 && (
              <> Active on <strong>{coverageOn.join(" · ")}</strong> invoices.</>
            )}
          </p>
        </div>
      </div>
      )}
    </SectionCard>
  );
}

Object.assign(window, { ConfigurationPage, getProgramFunding, useProgramFunding, getSalesTaxConfig, resolveSalesTaxForInvoice });

// =====================================================================
// Sales Tax card — per-country tax configuration UI gated by the
// salesTax feature flag. Models how sales tax / VAT / GST applies to
// supplier invoices in the country this tenant is currently scoped to.
//
// Structure (mirrors the ProgramFundingCard pattern — same surfaces,
// same grid, no decorative accent so the two cards read as siblings):
//   · Master toggle (off = no tax lines on any invoice)
//   · Effective date + cross-cutting controls (engagement-type coverage,
//     stacking rule when Supplier Funding is also on)
//   · ONE country panel — the country the sidebar org-card is currently
//     scoped to. To configure another country, the admin switches the
//     sidebar country picker. State for every country is still persisted
//     so the switch is non-destructive.
//   · Live preview of a $1,000 invoice rendered for the active country
//   · Coverage banner — confirms tenant-wide reach
//
// Country roster matches PICKER_COUNTRIES (see pages/countries.jsx).
// =====================================================================

const SALES_TAX_COUNTRY_ORDER = ["US", "CA", "GB", "DE", "AU", "JP"];

function SalesTaxCard({ data, set, onGoTo, tempSpend, industry, programData }) {
  const stOn = !!data.enabled;
  // v0.79 — Supplier Funding moved out of feature flags. The stacking
  // behavior is now driven directly by the program-funding configuration:
  // if the program is supplier-funded, sales tax + program fee may stack.
  const supplierFundingOn = !!(programData && programData.supplierFunding);

  // Country is driven by the sidebar org-card picker. The whole page
  // re-mounts via __bumpFlexContext when the picker changes, so we just
  // read getCurrentCountry() each render — no local state needed.
  const currentCountry = (window.getCurrentCountry && window.getCurrentCountry()) || null;
  const activeCountry  = (currentCountry && data.countries[currentCountry.code])
    ? currentCountry.code
    : "US";
  const activeCfg      = data.countries[activeCountry];
  const activeName     = (window.COUNTRY_BY_CODE && window.COUNTRY_BY_CODE[activeCountry] && window.COUNTRY_BY_CODE[activeCountry].name)
    || activeCountry;

  // Roll up the "enabled countries" count for the coverage banner.
  const enabledCountries = SALES_TAX_COUNTRY_ORDER
    .filter((c) => data.countries[c] && data.countries[c].enabled);

  const coverageRows = [
    { key: "frontline",    title: "Frontline",     sub: "Shift‑based timesheet‑derived supplier invoices." },
    { key: "professional", title: "Professional",  sub: "Weekly / monthly / annual contract invoices.",                flagId: "professionalWork" },
    { key: "sow",          title: "SOW",           sub: "Milestone‑triggered SOW invoices.",                       flagId: "sow" },
    { key: "contractor",   title: "Contractor",    sub: "1099 / IC self‑submitted invoices.",                       flagId: "contractors", warn: "Many ICs sit below VAT / GST registration thresholds — confirm with each contractor." },
  ];

  // ---- Active-country preview math ($1,000 bill). Show the cross-foot
  // with tax + program fee stack if Supplier Funding is also on.
  const previewBill = 1000;
  // Pick the "headline" rate for preview — US/CA use the first taxable
  // row; UK/DE/AU/JP use defaultRateId.
  let previewRow = null;
  if (activeCfg && activeCfg.defaultRateId) {
    previewRow = (activeCfg.rates || []).find((r) => r.id === activeCfg.defaultRateId);
  }
  if (!previewRow) {
    previewRow = (activeCfg && activeCfg.rates || []).find((r) => r.taxable) || null;
  }
  const previewRate  = previewRow ? Number(previewRow.rate) : 0;
  const previewTax   = Math.round(previewBill * (previewRate / 100) * 100) / 100;
  const subtotalRows = (activeCfg && activeCfg.rates ? activeCfg.rates : []).filter((r) => r.taxable && r.rate > 0).length;

  // Program-fee stacking — preview-only; consumes the live programData.
  const pfOn = supplierFundingOn && programData && programData.supplierFunding;
  const pfFee = pfOn ? Math.round(previewBill * (Number(programData.feePct) / 100) * 100) / 100 : 0;
  const pfMethod = pfOn ? programData.method : null;

  // Tax always applies to the BILL amount in the canonical staffing
  // treatment — program fee is a remittance adjustment, not a discount
  // on the taxable supply. Tenants can override by switching stackOnFunding.
  const taxBase = (pfOn && data.stackOnFunding === "postFee" && pfMethod === "Discount")
    ? (previewBill - pfFee)
    : previewBill;
  const taxOnPreview = Math.round(taxBase * (previewRate / 100) * 100) / 100;

  // Buyer total = bill + (program markup, if any) + tax.
  const buyerTotal = previewBill
    + ((pfOn && pfMethod === "Markup") ? pfFee : 0)
    + taxOnPreview;
  // Net to supplier = bill - (program discount, if any). Tax is paid by
  // the buyer and remitted by the supplier; it doesn't change the net.
  const netToSup = previewBill - ((pfOn && pfMethod === "Discount") ? pfFee : 0);

  // ---- Compact $ formatter — matches ProgramFundingCard's local fmt$.
  const fmt$ = (n) => "$" + n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");

  // ---- Per-jurisdiction row editor. US/CA have a long list; UK/DE/AU/JP
  // are short and use the same component for consistency.
  const setRate = (code, rowId, value) => {
    set(`salesTax.countries.${code}.rates`,
      activeCfg.rates.map((r) => r.id === rowId ? { ...r, rate: Number(value) } : r));
  };
  const setTaxable = (code, rowId, value) => {
    set(`salesTax.countries.${code}.rates`,
      activeCfg.rates.map((r) => r.id === rowId ? { ...r, taxable: !!value } : r));
  };

  return (
    <SectionCard
      variant="compact"
      icon="Globe"
      title="Sales tax"
      action={
        stOn ? (
          <span className="cfg-conn">
            <span className="cfg-conn-dot" />
            On&nbsp;·&nbsp;{enabledCountries.length}/{SALES_TAX_COUNTRY_ORDER.length} countries
          </span>
        ) : (
          <span className="cfg-tag cfg-tag--neutral">
            <span className="cfg-conn-dot" style={{ background: "var(--evr-inactive-content)" }} />
            Off
          </span>
        )
      }
    >
      <p className="cfg-card-blurb">
        How sales tax appears on supplier invoices. Each country is modelled separately because the
        regimes diverge &mdash; the <strong>US</strong> is state&#8209;by&#8209;state on a narrow taxable list,
        <strong> Canada</strong> layers GST plus provincial PST / QST, the <strong>UK</strong> and{" "}
        <strong>Germany</strong> use VAT / USt with cross&#8209;border B2B reverse charge,{" "}
        <strong>Australia</strong> uses 10% GST, and <strong>Japan</strong> uses 10% Consumption Tax under
        the Qualified Invoice System. This is the tenant&#8209;wide default; per&#8209;supplier exemption
        certificates land on the Supplier &rarr; Contract record.
      </p>

      {/* Master toggle */}
      <div className="cfg-link-row" style={{ borderBottom: "1px solid var(--evr-border-decorative-lowemp)" }}>
        <div>
          <p className="cfg-link-title">Sales tax</p>
          <p className="cfg-link-sub">
            When on, every supplier invoice carries the configured local tax line. Off mirrors the
            prior behaviour where invoices show a placeholder tax computed at a flat demo rate.
          </p>
        </div>
        <Switch
          checked={stOn}
          onChange={(v) => set("salesTax.enabled", v)}
          ariaLabel="Enable sales tax"
        />
      </div>

      {/* All sub-controls disable when the master toggle is off. */}
      <div
        style={{
          opacity: stOn ? 1 : 0.5,
          pointerEvents: stOn ? "auto" : "none",
          paddingTop: 16,
        }}
        aria-disabled={!stOn}
      >
        <div className="cfg-grid cfg-grid--three">
          <CfgField
            label="Effective date"
            hint="Invoices generated on or after this date carry the configured tax."
          >
            <TextInput
              value={data.effectiveDate}
              onChange={(v) => set("salesTax.effectiveDate", v)}
            />
          </CfgField>
          <CfgField
            label="Stack with Supplier Funding"
            hint="When Supplier Funding is also on, tax applies to the bill amount (industry standard) or the net."
          >
            <Dropdown
              options={[
                "Tax the bill amount (pre-fee)",
                "Tax the net to supplier (post-fee)",
              ]}
              value={
                data.stackOnFunding === "postFee"
                  ? "Tax the net to supplier (post-fee)"
                  : "Tax the bill amount (pre-fee)"
              }
              onChange={(v) =>
                set(
                  "salesTax.stackOnFunding",
                  v === "Tax the net to supplier (post-fee)" ? "postFee" : "preFee"
                )
              }
            />
          </CfgField>
          <CfgField
            label="Active countries"
            hint="Each country is configured independently. Switch in the sidebar to edit another."
          >
            <div className="stx-active-chips">
              {SALES_TAX_COUNTRY_ORDER.map((c) => {
                const cc = data.countries[c];
                const on = cc && cc.enabled;
                const here = c === activeCountry;
                return (
                  <span
                    key={c}
                    className={
                      "stx-active-chip" +
                      (on ? " is-on" : "") +
                      (here ? " is-current" : "")
                    }
                    title={cc ? cc.label : c}
                  >
                    <span className={`fi fi-${c.toLowerCase()}`} aria-hidden="true" />
                    <span>{c}</span>
                  </span>
                );
              })}
            </div>
          </CfgField>
        </div>

        {/* Engagement-type coverage */}
        <div
          style={{
            marginTop: 20,
            paddingTop: 16,
            borderTop: "1px solid var(--evr-border-decorative-lowemp)",
          }}
        >
          <p className="cfg-field-label" style={{ marginBottom: 4 }}>
            Apply sales tax to
          </p>
          <p className="cfg-field-hint" style={{ marginBottom: 12 }}>
            Each engagement type can independently opt in. Frontline / Professional / SOW are on by
            default; Contractor is off because most ICs sit below the VAT / GST registration threshold
            in their jurisdiction.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {coverageRows.map((r) => {
              const flagOn = !r.flagId || (window.getFeatureFlag && window.getFeatureFlag(r.flagId));
              return (
                <div
                  key={r.key}
                  className="cfg-link-row"
                  style={{ opacity: flagOn ? 1 : 0.55 }}
                >
                  <div>
                    <p className="cfg-link-title">
                      {r.title}
                      {!flagOn && (
                        <span className="pf-flag-off">
                          <Icon name="Lock" size={11} /> Worker type off
                        </span>
                      )}
                    </p>
                    <p className="cfg-link-sub">
                      {r.sub}
                      {r.warn && data.coverage[r.key] && (
                        <span className="pf-coverage-warn">
                          <Icon name="Alert" size={11} /> {r.warn}
                        </span>
                      )}
                    </p>
                  </div>
                  <Switch
                    checked={!!data.coverage[r.key]}
                    onChange={(v) => { if (flagOn) set(`salesTax.coverage.${r.key}`, v); }}
                    ariaLabel={`Apply sales tax to ${r.title}`}
                  />
                </div>
              );
            })}
          </div>
        </div>

        {/* Single-country panel — bound to the sidebar country picker. */}
        {activeCfg && (
          <div
            style={{
              marginTop: 24,
              paddingTop: 16,
              borderTop: "1px solid var(--evr-border-decorative-lowemp)",
            }}
          >
            <div className="stx-country-head">
              <div className="stx-country-head-id">
                <span
                  className={`fi fi-${activeCountry.toLowerCase()} stx-country-flag`}
                  aria-hidden="true"
                />
                <div>
                  <p className="cfg-field-label" style={{ margin: 0 }}>
                    Tax for {activeName}
                  </p>
                  <p className="cfg-field-hint" style={{ marginTop: 2 }}>
                    {activeCountry} &middot; {activeCfg.regime}
                    {" — "}
                    sourcing: {activeCfg.sourcing.toLowerCase()}
                    {activeCfg.reverseCharge && <> &middot; reverse charge available for cross&#8209;border B2B</>}
                  </p>
                </div>
              </div>
              <div className="stx-country-head-toggle">
                <span className="cfg-field-hint">Country enabled</span>
                <Switch
                  checked={!!activeCfg.enabled}
                  onChange={(v) => set(`salesTax.countries.${activeCountry}.enabled`, v)}
                  ariaLabel={`Enable ${activeCfg.label}`}
                />
              </div>
            </div>

            <p className="cfg-field-hint stx-switch-hint">
              <Icon name="Information" size={12} />
              <span>
                To configure another country, switch the country in your account menu &mdash; settings
                for every market are stored, the panel just shows one at a time.
              </span>
            </p>

            {activeCfg.reverseChargeNote && (
              <div className="stx-rc-banner" role="note">
                <span className="stx-rc-banner-icon">
                  <Icon name="Information" size={14} />
                </span>
                <div>
                  <div className="stx-rc-banner-title">Reverse charge text shown on cross&#8209;border invoices</div>
                  <div className="stx-rc-banner-body">{activeCfg.reverseChargeNote}</div>
                </div>
              </div>
            )}

            {/* Per-jurisdiction rates table */}
            <div
              style={{
                marginTop: 14,
                opacity: activeCfg.enabled ? 1 : 0.5,
                pointerEvents: activeCfg.enabled ? "auto" : "none",
              }}
            >
              <div className="stx-jur-head">
                <span>
                  {activeCountry === "US"
                    ? "State"
                    : activeCountry === "CA"
                    ? "Province / territory"
                    : "Rate"}
                </span>
                <span className="stx-jur-head-rate">Rate</span>
                <span className="stx-jur-head-note">Notes</span>
                <span className="stx-jur-head-tax">Taxable</span>
              </div>
              {(activeCfg.rates || []).map((row) => (
                <div key={row.id} className={"stx-jur-row" + (row.taxable ? "" : " is-off")}>
                  <span className="stx-jur-name">
                    {activeCountry === "US" || activeCountry === "CA" ? (
                      <span className="stx-jur-state-pill">{row.id}</span>
                    ) : null}
                    <span>{row.name}</span>
                  </span>
                  <span className="stx-jur-rate">
                    <input
                      type="number"
                      step="0.05"
                      min="0"
                      max="40"
                      className="stx-jur-rate-input tabular"
                      value={row.rate}
                      onChange={(e) => setRate(activeCountry, row.id, e.target.value)}
                      aria-label={`${row.name} rate`}
                      disabled={!row.taxable}
                    />
                    <span className="stx-jur-rate-suffix">%</span>
                  </span>
                  <span className="stx-jur-note">{row.note || ""}</span>
                  <span className="stx-jur-tax">
                    <Switch
                      checked={!!row.taxable}
                      onChange={(v) => setTaxable(activeCountry, row.id, v)}
                      ariaLabel={`${row.name} taxable`}
                    />
                  </span>
                </div>
              ))}
              {activeCfg.notes && (
                <p className="cfg-field-hint stx-jur-foot">
                  <Icon name="Information" size={12} />
                  <span>{activeCfg.notes}</span>
                </p>
              )}
              {activeCountry === "US" && (
                <div className="stx-us-callout">
                  <span className="stx-us-callout-icon">
                    <Icon name="Information" size={14} />
                  </span>
                  <span>
                    All other US states default to <strong>not taxable</strong> for staffing services.
                    If you operate workers in a state outside the list above, the invoice will not
                    carry a US sales tax line for that state.
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Coverage banner — neutral informative tint, matches Program funding. */}
        <div className="stx-coverage-banner">
          <span className="stx-coverage-banner-icon">
            <Icon name="Information" size={16} />
          </span>
          <div>
            <div className="stx-coverage-banner-title">
              Tenant&#8209;wide coverage when on
            </div>
            <div className="stx-coverage-banner-body">
              Applies to <strong>every organization, every industry, every temp&#8209;spend tier</strong>{" "}
              this tenant is configured for, across <strong>{enabledCountries.length}</strong> active{" "}
              {enabledCountries.length === 1 ? "country" : "countries"}{" "}
              ({enabledCountries.join(" \u00b7 ")})
              {tempSpend && (
                <>
                  {" "}&mdash; currently scoped to a <strong>{tempSpend.label}</strong> program
                  ({tempSpend.countries.toLocaleString()}{" "}
                  {tempSpend.countries === 1 ? "country" : "countries"} &middot; {tempSpend.suppliers} suppliers)
                </>
              )}
              {industry && <> in the <strong>{industry.tag}</strong> industry</>}.
              {supplierFundingOn && pfOn && (
                <>
                  {" "}Stacks with Supplier Funding: tax applies to the{" "}
                  <strong>
                    {data.stackOnFunding === "postFee" ? "net (post-fee)" : "bill amount (pre-fee)"}
                  </strong>
                  .
                </>
              )}
            </div>
          </div>
        </div>

        {/* Live invoice preview — secondary surface, matches Program funding. */}
        <div className="stx-preview-shell">
          <div className="stx-preview-eyebrow">
            Preview &middot; {fmt$(previewBill)} {activeCfg ? activeCfg.label : ""} invoice
            {previewRow && (
              <>
                {" \u00b7 "}{previewRow.name}
                {previewRow.note && <> ({previewRow.note})</>}
              </>
            )}
          </div>
          <div className="pf-preview stx-preview">
            <div className="pf-prev-row">
              <span>Bill amount (supplier rate &times; hours)</span>
              <span className="tabular">{fmt$(previewBill)}</span>
            </div>
            {pfOn && pfMethod === "Markup" && (
              <div className="pf-prev-row pf-prev-row--fee">
                <span>+ {programData.invoiceLabel} ({Number(programData.feePct)}% markup)</span>
                <span className="tabular">+ {fmt$(pfFee)}</span>
              </div>
            )}
            {previewRow && previewRate > 0 ? (
              <div className="pf-prev-row stx-prev-row--tax">
                <span>
                  {activeCfg.label} ({previewRate}% &middot; {previewRow.name})
                  {data.stackOnFunding === "postFee" && pfOn && pfMethod === "Discount" && (
                    <span className="stx-tax-onnet">on net</span>
                  )}
                </span>
                <span className="tabular">+ {fmt$(taxOnPreview)}</span>
              </div>
            ) : (
              <div className="pf-prev-row stx-prev-row--tax-zero">
                <span>
                  {activeCfg ? activeCfg.label : "Sales tax"} (no taxable jurisdiction at this rate)
                </span>
                <span className="tabular">{fmt$(0)}</span>
              </div>
            )}
            <div className="pf-prev-row pf-prev-row--total">
              <span>Buyer pays</span>
              <span className="tabular">{fmt$(buyerTotal)}</span>
            </div>
            {pfOn && pfMethod === "Discount" && (
              <>
                <div className="pf-prev-divider" />
                <div className="pf-prev-row pf-prev-row--fee">
                  <span>&minus; {programData.invoiceLabel} ({Number(programData.feePct)}% discount)</span>
                  <span className="tabular">&minus; {fmt$(pfFee)}</span>
                </div>
                <div className="pf-prev-row pf-prev-row--total pf-prev-row--net">
                  <span>Net to supplier</span>
                  <span className="tabular">{fmt$(netToSup)}</span>
                </div>
              </>
            )}
          </div>
          <p className="cfg-field-hint" style={{ marginTop: 10 }}>
            {previewRow && previewRate > 0 ? (
              <>
                The supplier collects {fmt$(taxOnPreview)} of {activeCfg.label} from the buyer and
                remits it to the tax authority. Tax never changes the supplier{"\u2019"}s net pay
                {" \u2014 "}it is paid by the buyer and passed through.
              </>
            ) : (
              <>This jurisdiction does not tax staffing services. The invoice renders without a tax line.</>
            )}
            {activeCfg && activeCfg.reverseCharge && (
              <>
                {" "}When the invoice is flagged cross&#8209;border B2B, the rate above is replaced by a
                zero&#8209;rated line plus the reverse&#8209;charge notice in the box above.
              </>
            )}
          </p>
        </div>
      </div>
    </SectionCard>
  );
}

// =====================================================================
// Master data — bulk upload history + progressive-disclosure new-upload
// flow. Rendered as the second tab inside ConfigurationPage above.
//
// The table is a CHRONOLOGY of past file uploads (who imported what,
// when, with what result). The primary action is "Start new upload",
// which opens a side panel that progressively reveals everything you
// need to know about a chosen data type — schema, validation rules,
// template, current record count — and then accepts the file.
// =====================================================================

const { useState: useMdState, useEffect: useMdEffect, useRef: useMdRef, useMemo: useMdMemo } = React;

// ---------- Catalog of importable data types ---------------------------
const MASTER_DATA_TYPES = [
  {
    id: "locations",  name: "Sites", category: "Organization",
    icon: "Building", hue: "blue",
    desc: "Sites, facilities, and units where shifts are worked.",
    longDesc: "Each row is a location with its address, time zone, region, and which managers can post requisitions there. Used by Requisitions, Schedule, and Compliance.",
    records: 247, lastUpload: "May 18, 2026",
    source: "Core HRIS", sourceKind: "connector",
    cadence: "Nightly · 02:00 UTC",
    template: { name: "locations_v4.csv", size: "2.1 KB", format: "CSV" },
    columns: [
      { name: "external_id",   type: "string",  required: true,  hint: "Stable identifier from your HCM" },
      { name: "name",          type: "string",  required: true },
      { name: "street",        type: "string",  required: true },
      { name: "city",          type: "string",  required: true },
      { name: "state",         type: "string",  required: true,  hint: "ISO 3166-2 subdivision" },
      { name: "postal_code",   type: "string",  required: true },
      { name: "country",       type: "string",  required: true,  hint: "ISO 3166-1 alpha-2" },
      { name: "time_zone",     type: "string",  required: true,  hint: "IANA zone, e.g. America/Los_Angeles" },
      { name: "region",        type: "string",  required: false },
      { name: "manager_email", type: "email",   required: false },
      { name: "is_active",     type: "boolean", required: false, hint: "Defaults to true" },
    ],
    rules: [
      "external_id must be unique within the file",
      "country must be ISO 3166-1 alpha-2 (US, CA, MX…)",
      "time_zone must be a valid IANA zone",
      "Files larger than 25 MB are rejected — split into batches",
    ],
  },
  {
    id: "departments", name: "Departments", category: "Organization",
    icon: "OrgChartVert", hue: "teal",
    desc: "GL hierarchy for budget allocation and chargebacks.",
    longDesc: "Each row is a node in your cost-center hierarchy with the parent node, owner, and budget pool it draws from.",
    records: 1842, lastUpload: "May 17, 2026",
    source: "Oracle Financials", sourceKind: "sftp",
    cadence: "Weekly · Sun 23:00",
    template: { name: "departments_v3.csv", size: "1.8 KB", format: "CSV" },
    columns: [
      { name: "code",           type: "string", required: true, hint: "Cost-center code, e.g. 4120-INV" },
      { name: "name",           type: "string", required: true },
      { name: "parent_code",    type: "string", required: false, hint: "Leave blank for root nodes" },
      { name: "gl_account",     type: "string", required: true },
      { name: "owner_email",    type: "email",  required: true },
      { name: "budget_pool_id", type: "string", required: false },
      { name: "is_active",      type: "boolean", required: false },
    ],
    rules: [
      "parent_code must reference an existing code in the file or the live tenant",
      "gl_account must match an active row in GL accounts",
      "Cycles in the hierarchy are rejected — the importer detects loops",
    ],
  },
  {
    id: "suppliers", name: "Suppliers & agencies", category: "Organization",
    icon: "ClipboardPerson", hue: "blue",
    desc: "Staffing agency master, contacts, and contracted scope.",
    longDesc: "Each row is a staffing agency in your supplier network with primary contact, contracted scope (which locations and roles they can serve), and tier.",
    records: 62, lastUpload: "May 9, 2026",
    source: "Manual upload", sourceKind: "manual",
    cadence: "On demand",
    template: { name: "suppliers_v2.csv", size: "1.4 KB", format: "CSV" },
    columns: [
      { name: "external_id",  type: "string", required: true },
      { name: "legal_name",   type: "string", required: true },
      { name: "doing_biz_as", type: "string", required: false },
      { name: "tier",         type: "string", required: true,  hint: "T1 / T2 / T3" },
      { name: "contact_name", type: "string", required: true },
      { name: "contact_email",type: "email",  required: true },
      { name: "contact_phone",type: "string", required: false },
      { name: "msa_signed_at",type: "date",   required: false },
      { name: "is_active",    type: "boolean",required: false },
    ],
    rules: [
      "tier must be one of T1, T2, T3",
      "contact_email must be deliverable — soft-bounce check runs before save",
    ],
  },
  {
    id: "workers", name: "Workers & contractors", category: "Workforce",
    icon: "Users", hue: "purple",
    desc: "Identity, employment type, work eligibility, and reach-back pool.",
    longDesc: "Each row is a worker known to Flex Work — internal employee, agency worker, alumni, or per-diem. Drives every workforce-related decision in the platform.",
    records: 8964, lastUpload: "May 18, 2026",
    source: "Core HRIS", sourceKind: "connector",
    cadence: "Hourly delta",
    template: { name: "workers_v6.csv", size: "8.4 KB", format: "CSV" },
    columns: [
      { name: "external_id",     type: "string", required: true },
      { name: "first_name",      type: "string", required: true },
      { name: "last_name",       type: "string", required: true },
      { name: "email",           type: "email",  required: true },
      { name: "employment_type", type: "string", required: true,  hint: "internal / agency / alumni / perdiem" },
      { name: "supplier_id",     type: "string", required: false, hint: "Required when type is agency" },
      { name: "home_location",   type: "string", required: true },
      { name: "primary_role",    type: "string", required: false },
      { name: "hired_at",        type: "date",   required: false },
      { name: "is_active",       type: "boolean",required: false },
    ],
    rules: [
      "employment_type must be one of: internal, agency, alumni, perdiem",
      "When employment_type=agency, supplier_id is required",
      "email must be unique across the active worker set",
    ],
  },
  {
    id: "roles", name: "Job roles & categories", category: "Workforce",
    icon: "Briefcase", hue: "purple",
    desc: "Job codes, categories, and seniority tiers requisitions reference.",
    longDesc: "Each row is a job role that requisitions and rate cards reference. Includes seniority, category, and default skills.",
    records: 186, lastUpload: "May 11, 2026",
    source: "Manual upload", sourceKind: "manual",
    cadence: "On demand",
    template: { name: "job_roles_v2.csv", size: "1.2 KB", format: "CSV" },
    columns: [
      { name: "code",          type: "string", required: true,  hint: "Role code, e.g. RN-MED" },
      { name: "name",          type: "string", required: true },
      { name: "category",      type: "string", required: true },
      { name: "seniority",     type: "string", required: false, hint: "Junior / Mid / Senior / Lead" },
      { name: "default_skills",type: "string", required: false, hint: "Comma-separated skill codes" },
      { name: "is_active",     type: "boolean",required: false },
    ],
    rules: [
      "code must be unique within the file",
      "category must match a row in the Categories pick list",
    ],
  },
  {
    id: "skills", name: "Skills & competencies", category: "Workforce",
    icon: "Stack", hue: "teal",
    desc: "Taxonomy of skills, levels, and required-for-role mappings.",
    longDesc: "Each row is a skill with levels (Novice → Expert) and which roles require it. Imported here, validated against each worker during onboarding.",
    records: 342, lastUpload: "Apr 28, 2026",
    source: "Manual upload", sourceKind: "manual",
    cadence: "On demand",
    template: { name: "skills_v1.csv", size: "1.1 KB", format: "CSV" },
    columns: [
      { name: "code",        type: "string", required: true },
      { name: "name",        type: "string", required: true },
      { name: "category",    type: "string", required: false },
      { name: "min_level",   type: "string", required: false, hint: "Novice / Intermediate / Expert" },
      { name: "is_active",   type: "boolean",required: false },
    ],
    rules: [
      "code must be unique within the file",
      "min_level must be one of: Novice, Intermediate, Expert",
    ],
  },
  {
    id: "credentials", name: "Credentials & certifications", category: "Workforce",
    icon: "ShieldPerson", hue: "orange",
    desc: "Required licenses, expirations, and verifying issuers.",
    longDesc: "Each row is a credential type. Worker-level credential records come in via the Symplr CVO webhook and are matched to these rows by code.",
    records: 214, lastUpload: "May 18, 2026",
    source: "Symplr CVO", sourceKind: "api",
    cadence: "Real-time webhook",
    template: { name: "credentials_v3.csv", size: "1.6 KB", format: "CSV" },
    columns: [
      { name: "code",            type: "string", required: true },
      { name: "name",            type: "string", required: true },
      { name: "issuing_body",    type: "string", required: true },
      { name: "validity_months", type: "number", required: false },
      { name: "is_required",     type: "boolean",required: false, hint: "Required for any worker matched to a role that lists it" },
    ],
    rules: [
      "code must follow the Symplr CVO code format",
      "validity_months must be a positive integer if set",
    ],
  },
  {
    id: "shifts", name: "Shift templates", category: "Operations",
    icon: "Calendar", hue: "blue",
    desc: "Reusable start/end · break · differential patterns.",
    longDesc: "Each row is a shift pattern (day, evening, night, weekend, double…) with break rules and pay differentials. Schedules reference these by code.",
    records: 74, lastUpload: "May 6, 2026",
    source: "Manual upload", sourceKind: "manual",
    cadence: "On demand",
    template: { name: "shift_templates_v2.csv", size: "1.0 KB", format: "CSV" },
    columns: [
      { name: "code",          type: "string", required: true },
      { name: "name",          type: "string", required: true },
      { name: "start_time",    type: "time",   required: true,  hint: "24h HH:MM" },
      { name: "end_time",      type: "time",   required: true },
      { name: "break_minutes", type: "number", required: false },
      { name: "differential",  type: "number", required: false, hint: "Multiplier on base rate" },
    ],
    rules: [
      "start_time and end_time use 24-hour HH:MM",
      "Shifts crossing midnight are allowed — set end_time before start_time",
    ],
  },
  {
    id: "holidays", name: "Holiday & pay calendars", category: "Operations",
    icon: "Leaf", hue: "green",
    desc: "Observed holidays, premium days, and blackout windows per region.",
    longDesc: "Each row is a date with a region and premium multiplier. Used by Schedule and Pricing to compute the right bill rate for the day.",
    records: 38, lastUpload: "Jan 14, 2026",
    source: "Manual upload", sourceKind: "manual",
    cadence: "Yearly",
    template: { name: "holiday_calendars_v1.csv", size: "0.8 KB", format: "CSV" },
    columns: [
      { name: "date",          type: "date",   required: true },
      { name: "name",          type: "string", required: true },
      { name: "region",        type: "string", required: true },
      { name: "premium_mult",  type: "number", required: false,  hint: "e.g. 1.5 for time-and-a-half" },
      { name: "blackout",      type: "boolean",required: false },
    ],
    rules: [
      "date must be ISO 8601 (YYYY-MM-DD)",
      "region must match a region defined in Locations",
    ],
  },
  {
    id: "approvals", name: "Approval chains", category: "Operations",
    icon: "Bolt", hue: "yellow",
    desc: "Default approver hierarchies for requisitions, timesheets, invoices.",
    longDesc: "Each row is one step in a named approval chain. Workflows page references these by chain name.",
    records: 46, lastUpload: "Apr 30, 2026",
    source: "Manual upload", sourceKind: "manual",
    cadence: "On demand",
    template: { name: "approval_chains_v1.csv", size: "0.9 KB", format: "CSV" },
    columns: [
      { name: "chain_name",    type: "string", required: true },
      { name: "step",          type: "number", required: true },
      { name: "approver_role", type: "string", required: true,  hint: "Role code that resolves to a user" },
      { name: "max_amount",    type: "number", required: false },
      { name: "is_active",     type: "boolean",required: false },
    ],
    rules: [
      "Steps within a chain must be contiguous integers starting at 1",
      "approver_role must resolve to at least one active user",
    ],
  },
  {
    id: "rates", name: "Pay & bill rate cards", category: "Finance",
    icon: "Pay", hue: "green",
    desc: "Pay rate, bill rate, and markup by role · location · supplier.",
    longDesc: "Each row is one cell of the rate matrix. Supports time-bound rates with effective dates so quarterly adjustments don't break history.",
    records: 4128, lastUpload: "May 14, 2026",
    source: "Manual upload", sourceKind: "manual",
    cadence: "Quarterly",
    template: { name: "rate_cards_v5.xlsx", size: "4.2 KB", format: "XLSX" },
    columns: [
      { name: "role_code",     type: "string", required: true },
      { name: "location_code", type: "string", required: false, hint: "Blank = applies to all locations" },
      { name: "supplier_code", type: "string", required: false, hint: "Blank = internal & all suppliers" },
      { name: "pay_rate",      type: "number", required: true },
      { name: "bill_rate",     type: "number", required: true },
      { name: "currency",      type: "string", required: true,  hint: "ISO 4217 (USD, CAD…)" },
      { name: "effective_from",type: "date",   required: true },
      { name: "effective_to",  type: "date",   required: false },
    ],
    rules: [
      "bill_rate must be greater than or equal to pay_rate",
      "effective_from must be on or before effective_to",
      "(role_code, location_code, supplier_code, effective_from) must be unique",
    ],
  },
  {
    id: "gl", name: "GL accounts & tax codes", category: "Finance",
    icon: "MoneyBag", hue: "green",
    desc: "Posting accounts, tax codes, and jurisdiction mappings.",
    longDesc: "Each row is a posting account or tax code, used by Invoices to assemble the journal entry.",
    records: 612, lastUpload: "May 17, 2026",
    source: "Oracle Financials", sourceKind: "sftp",
    cadence: "Weekly · Sun 23:00",
    template: { name: "gl_accounts_v2.csv", size: "1.3 KB", format: "CSV" },
    columns: [
      { name: "account_code", type: "string", required: true },
      { name: "name",         type: "string", required: true },
      { name: "account_type", type: "string", required: true,  hint: "asset / liability / income / expense" },
      { name: "currency",     type: "string", required: true },
      { name: "is_active",    type: "boolean",required: false },
    ],
    rules: [
      "account_code must match the format used by your GL",
      "account_type must be one of: asset, liability, income, expense",
    ],
  },
  {
    id: "tax", name: "Tax jurisdictions", category: "Finance",
    icon: "Gavel", hue: "orange",
    desc: "State, local, and reciprocity rules for payroll calculation.",
    longDesc: "Each row is a tax jurisdiction with its rate table and reciprocity rules. Sourced from Vertex Cloud by default.",
    records: 3214, lastUpload: "May 17, 2026",
    source: "Vertex Cloud", sourceKind: "api",
    cadence: "Daily",
    template: { name: "tax_jurisdictions_v2.csv", size: "5.6 KB", format: "CSV" },
    columns: [
      { name: "code",        type: "string", required: true },
      { name: "name",        type: "string", required: true },
      { name: "country",     type: "string", required: true },
      { name: "state",       type: "string", required: false },
      { name: "rate",        type: "number", required: true },
      { name: "effective",   type: "date",   required: true },
    ],
    rules: [
      "rate is a decimal (0.075 = 7.5%)",
      "code must match the Vertex format if you also use the Vertex connector",
    ],
  },
  {
    id: "fields", name: "Custom fields & pick lists", category: "Configuration",
    icon: "Adjustment", hue: "purple",
    desc: "Tenant-defined fields, dropdown values, and field visibility rules.",
    longDesc: "Each row defines a custom field (where it appears, its type, who can see and edit it) or one value in a pick list.",
    records: 128, lastUpload: "May 2, 2026",
    source: "Manual upload", sourceKind: "manual",
    cadence: "On demand",
    template: { name: "custom_fields_v3.csv", size: "1.5 KB", format: "CSV" },
    columns: [
      { name: "entity",      type: "string", required: true,  hint: "requisition / worker / timesheet / location" },
      { name: "field_code",  type: "string", required: true },
      { name: "label",       type: "string", required: true },
      { name: "type",        type: "string", required: true,  hint: "text / number / date / picklist" },
      { name: "options",     type: "string", required: false, hint: "Pipe-separated values for picklist" },
      { name: "is_required", type: "boolean",required: false },
    ],
    rules: [
      "entity must be a known Flex Work entity",
      "When type=picklist, options is required",
    ],
  },
  {
    id: "users", name: "User accounts & roles", category: "Configuration",
    icon: "PersonPlus", hue: "blue",
    desc: "Internal users, role assignments, and SSO group bindings.",
    longDesc: "Each row is an internal user with their role assignments, default location, and SSO group binding.",
    records: 412, lastUpload: "May 18, 2026",
    source: "Azure AD SCIM", sourceKind: "api",
    cadence: "Real-time SCIM",
    template: { name: "users_v4.csv", size: "2.4 KB", format: "CSV" },
    columns: [
      { name: "email",            type: "email",  required: true },
      { name: "first_name",       type: "string", required: true },
      { name: "last_name",        type: "string", required: true },
      { name: "role_codes",       type: "string", required: true,  hint: "Pipe-separated, e.g. ADMIN|MGR" },
      { name: "default_location", type: "string", required: false },
      { name: "sso_group",        type: "string", required: false },
      { name: "is_active",        type: "boolean",required: false },
    ],
    rules: [
      "email is the natural key — existing users are matched by email",
      "Every role_code must reference an active role",
    ],
  },
];

const MASTER_DATA_CATEGORIES = ["Organization", "Workforce", "Operations", "Finance", "Configuration"];

const MD_CATEGORY_META = {
  Organization:  { icon: "Building",       hue: "blue"   },
  Workforce:     { icon: "Users",          hue: "purple" },
  Operations:    { icon: "Calendar",       hue: "teal"   },
  Finance:       { icon: "MoneyBag",       hue: "green"  },
  Configuration: { icon: "Adjustment",     hue: "orange" },
};

const MD_SOURCE_KIND_META = {
  manual:    { icon: "FileUpload", label: "Manual upload" },
  sftp:      { icon: "Globe",      label: "SFTP" },
  api:       { icon: "Bolt",       label: "API" },
  connector: { icon: "Link",       label: "Connector" },
};

const MD_TYPE_INDEX = MASTER_DATA_TYPES.reduce((acc, t) => { acc[t.id] = t; return acc; }, {});

// ---------- Upload history (mock chronology) ---------------------------
const UPLOAD_HISTORY = [
  { id: "up-1042", file: "workers_delta_may18.csv",       size: "412 KB", dataType: "workers",     by: { name: "HRIS connector", initials: "HC", hue: "purple", system: true },
    at: "May 18, 2026 · 9:00 AM", relative: "Today, 4 min ago", rows: 126,  ok: 126,  err: 0,
    status: "completed",  mode: "Upsert · delta",   source: "API · Core HRIS" },
  { id: "up-1041", file: "locations_may_2026.csv",        size: "32 KB",  dataType: "locations",   by: { name: "Maya Chen",          initials: "MC", hue: "blue" },
    at: "May 18, 2026 · 2:04 AM", relative: "Today, 7 hr ago", rows: 247, ok: 247, err: 0,
    status: "completed",  mode: "Replace",          source: "Manual upload" },
  { id: "up-1040", file: "rate_cards_q2_2026.xlsx",       size: "1.2 MB", dataType: "rates",       by: { name: "Priya Anand",        initials: "PA", hue: "orange" },
    at: "May 14, 2026 · 4:18 PM", relative: "4 days ago",     rows: 4128, ok: 3716, err: 412,
    status: "staged",     mode: "Upsert",           source: "Manual upload" },
  { id: "up-1039", file: "credentials_webhook.json",      size: "—",       dataType: "credentials", by: { name: "Symplr CVO",         initials: "SY", hue: "teal", system: true },
    at: "May 18, 2026 · 9:14 AM", relative: "Today, 18 min ago", rows: 8,   ok: 8,   err: 0,
    status: "completed",  mode: "Append · stream",  source: "API · Symplr CVO" },
  { id: "up-1038", file: "tax_jurisdictions_daily.csv",   size: "5.6 MB", dataType: "tax",         by: { name: "Vertex Cloud",       initials: "VX", hue: "orange", system: true },
    at: "May 17, 2026 · 6:00 AM", relative: "Yesterday",      rows: 3214, ok: 0,    err: 3214,
    status: "failed",     mode: "Upsert",           source: "API · Vertex Cloud",
    errorHint: "Schema mismatch — column 'effective_to' missing" },
  { id: "up-1037", file: "gl_accounts_may.csv",           size: "94 KB",  dataType: "gl",          by: { name: "Oracle Financials",  initials: "OR", hue: "green", system: true },
    at: "May 17, 2026 · 11:02 PM", relative: "Yesterday",     rows: 612,  ok: 612,  err: 0,
    status: "completed",  mode: "Replace",          source: "SFTP · Oracle Financials" },
  { id: "up-1036", file: "departments_may.csv",           size: "61 KB",  dataType: "departments", by: { name: "Oracle Financials",  initials: "OR", hue: "green", system: true },
    at: "May 17, 2026 · 11:00 PM", relative: "Yesterday",     rows: 1842, ok: 1838, err: 4,
    status: "partial",    mode: "Upsert",           source: "SFTP · Oracle Financials",
    errorHint: "4 rows reference a parent_code not yet in the tenant" },
  { id: "up-1035", file: "job_roles_may.csv",             size: "9 KB",   dataType: "roles",       by: { name: "Jordan Park",        initials: "JP", hue: "teal" },
    at: "May 11, 2026 · 9:42 AM", relative: "1 week ago",     rows: 186,  ok: 186,  err: 0,
    status: "completed",  mode: "Replace",          source: "Manual upload" },
  { id: "up-1034", file: "suppliers_q2.csv",              size: "12 KB",  dataType: "suppliers",   by: { name: "Maya Chen",          initials: "MC", hue: "blue" },
    at: "May 9, 2026 · 1:11 PM",  relative: "9 days ago",     rows: 62,   ok: 62,   err: 0,
    status: "completed",  mode: "Upsert",           source: "Manual upload" },
  { id: "up-1033", file: "shift_templates_may.csv",       size: "4 KB",   dataType: "shifts",      by: { name: "Sam Olajide",        initials: "SO", hue: "purple" },
    at: "May 6, 2026 · 10:22 AM", relative: "2 weeks ago",    rows: 74,   ok: 74,   err: 0,
    status: "completed",  mode: "Replace",          source: "Manual upload" },
  { id: "up-1032", file: "users_may.csv",                 size: "38 KB",  dataType: "users",       by: { name: "Azure AD SCIM",      initials: "AD", hue: "blue", system: true },
    at: "May 18, 2026 · 9:36 AM", relative: "Today, 1 hr ago", rows: 6,    ok: 6,    err: 0,
    status: "completed",  mode: "Upsert · stream",  source: "API · Azure AD SCIM" },
  { id: "up-1031", file: "skills_apr.csv",                size: "8 KB",   dataType: "skills",      by: { name: "Priya Anand",        initials: "PA", hue: "orange" },
    at: "Apr 28, 2026 · 3:24 PM", relative: "3 weeks ago",    rows: 342,  ok: 330,  err: 12,
    status: "partial",    mode: "Upsert",           source: "Manual upload",
    errorHint: "12 rows had an unrecognized category" },
  { id: "up-1030", file: "approval_chains_apr.csv",       size: "3 KB",   dataType: "approvals",   by: { name: "Jordan Park",        initials: "JP", hue: "teal" },
    at: "Apr 30, 2026 · 11:48 AM", relative: "3 weeks ago",   rows: 46,   ok: 46,   err: 0,
    status: "completed",  mode: "Replace",          source: "Manual upload" },
  { id: "up-1029", file: "custom_fields_may.csv",         size: "11 KB",  dataType: "fields",      by: { name: "Sam Olajide",        initials: "SO", hue: "purple" },
    at: "May 2, 2026 · 4:08 PM",  relative: "2 weeks ago",    rows: 128,  ok: 128,  err: 0,
    status: "completed",  mode: "Upsert",           source: "Manual upload" },
  { id: "up-1028", file: "holiday_2026.csv",              size: "5 KB",   dataType: "holidays",    by: { name: "Maya Chen",          initials: "MC", hue: "blue" },
    at: "Jan 14, 2026 · 8:00 AM", relative: "4 months ago",   rows: 38,   ok: 38,   err: 0,
    status: "completed",  mode: "Replace",          source: "Manual upload" },
  { id: "up-1027", file: "workers_bulk_onboarding.csv",   size: "1.8 MB", dataType: "workers",     by: { name: "Maya Chen",          initials: "MC", hue: "blue" },
    at: "May 18, 2026 · 9:42 AM", relative: "Today, 22 min ago", rows: 314, ok: 0, err: 0,
    status: "processing", mode: "Upsert",           source: "Manual upload" },
  { id: "up-1026", file: "rate_cards_pilot.xlsx",         size: "640 KB", dataType: "rates",       by: { name: "Priya Anand",        initials: "PA", hue: "orange" },
    at: "May 18, 2026 · 9:46 AM", relative: "Today, 18 min ago", rows: 612, ok: 0, err: 0,
    status: "validating", mode: "Append",           source: "Manual upload" },
];

// ---------- Status meta ------------------------------------------------
const UPLOAD_STATUS_META = {
  completed:  { label: "Completed",       icon: "Check",       tone: "success" },
  partial:    { label: "Completed with errors", icon: "Information", tone: "warning" },
  staged:     { label: "Staged",          icon: "Hourglass",   tone: "warning" },
  processing: { label: "Processing",      icon: "Refresh",     tone: "info"    },
  validating: { label: "Validating",      icon: "ClipboardCircleCheck", tone: "info" },
  queued:     { label: "Queued",          icon: "Inbox",       tone: "neutral" },
  failed:     { label: "Failed",          icon: "Alert",       tone: "error"   },
};

function UploadStatusPill({ status }) {
  const m = UPLOAD_STATUS_META[status] || UPLOAD_STATUS_META.completed;
  const spin = status === "processing" || status === "validating";
  return (
    <span className={"md-status md-status--" + m.tone}>
      <span className={spin ? "md-status-spin" : ""} style={{ display: "inline-flex" }}>
        <Icon name={m.icon} size={12} />
      </span>
      <span>{m.label}</span>
    </span>
  );
}

function MdKpi({ label, value, foot, level }) {
  return (
    <div className={"vms-kpi" + (level === "err" ? " vms-kpi--alert" : "")}>
      <div className="vms-kpi-label">{label}</div>
      <div className="vms-kpi-value tabular">{value}</div>
      {foot && <div className="vms-kpi-foot">{foot}</div>}
    </div>
  );
}

// ---------- History row ------------------------------------------------
function HistoryRow({ row, onOpen, onMore }) {
  const type = MD_TYPE_INDEX[row.dataType];
  const hasErr = row.err > 0;
  const pendingCount = row.status === "processing" || row.status === "validating";
  return (
    <div className="md-row" role="row" onClick={() => onOpen(row)}>
      <div className="md-col md-col--file">
        <span className="md-file-icon" aria-hidden="true">
          <Icon name="File" size={18} />
        </span>
        <div className="md-name-stack">
          <div className="md-name">{row.file}</div>
          <div className="md-desc tabular">{row.size} · {row.mode}</div>
        </div>
      </div>
      <div className="md-col md-col--type">
        <span className={"md-type-pill md-hue-" + (type ? type.hue : "blue")}>
          <Icon name={type ? type.icon : "Stack"} size={12} />
          <span>{type ? type.name : row.dataType}</span>
        </span>
      </div>
      <div className="md-col md-col--by">
        <span className={"md-avatar md-hue-" + row.by.hue} aria-hidden="true">
          {row.by.system ? <Icon name="Bolt" size={12} /> : row.by.initials}
        </span>
        <div className="md-name-stack">
          <div className="md-by-name">{row.by.name}</div>
          <div className="md-by-source">{row.source}</div>
        </div>
      </div>
      <div className="md-col md-col--when">
        <div className="md-when-line">{row.relative}</div>
        <div className="md-when-foot tabular">{row.at}</div>
      </div>
      <div className="md-col md-col--records">
        {pendingCount ? (
          <div className="md-records-pending">
            <span className="md-records-dot" />
            <span>Working…</span>
          </div>
        ) : (
          <React.Fragment>
            <div className="md-records tabular">{row.rows.toLocaleString()}</div>
            <div className={"md-records-foot tabular" + (hasErr ? " md-records-foot--err" : "")}>
              {hasErr
                ? <React.Fragment>{row.ok.toLocaleString()} ok · <strong>{row.err.toLocaleString()} errors</strong></React.Fragment>
                : "All rows imported"}
            </div>
          </React.Fragment>
        )}
      </div>
      <div className="md-col md-col--status">
        <UploadStatusPill status={row.status} />
        {row.errorHint && (
          <div className="md-error-hint" title={row.errorHint}>{row.errorHint}</div>
        )}
      </div>
      <div className="md-col md-col--act" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          className="iconbtn md-more"
          aria-label={`More actions for ${row.file}`}
          onClick={(e) => onMore(e, row)}
        >
          <Icon name="MoreVert" size={16} />
        </button>
      </div>
    </div>
  );
}

// =====================================================================
// CandidateWorkflowTab — picks the tenant-wide default candidate flow.
//   · "automatic" → submittals auto-advance straight to Offer (no
//     interview gate). The per-requisition Interview-required toggle
//     defaults off.
//   · "interview" → submittals pause at the Interview stage. The
//     full admin configuration surface (type catalog, scorecards,
//     templates, decline reasons, calendar integration, policies,
//     skip-approvals, SLA, version history) renders below.
//
// Persists per-org to localStorage at `flexwork.candidateWorkflow.{orgId}`.
// =====================================================================

function getCandidateWorkflow() {
  const orgId = (window.getIndustry && window.getIndustry().id) || "default";
  const key = `flexwork.candidateWorkflow.${orgId}`;
  try {
    const v = window.localStorage.getItem(key);
    return v === "interview" || v === "automatic" ? v : "automatic";
  } catch (e) { return "automatic"; }
}
function setCandidateWorkflow(next) {
  const orgId = (window.getIndustry && window.getIndustry().id) || "default";
  const key = `flexwork.candidateWorkflow.${orgId}`;
  try { window.localStorage.setItem(key, next); } catch (e) {}
  window.dispatchEvent(new CustomEvent("candidateWorkflow:change", { detail: next }));
  return next;
}
function useCandidateWorkflow() {
  const [v, setV] = React.useState(() => getCandidateWorkflow());
  React.useEffect(() => {
    const h = () => setV(getCandidateWorkflow());
    window.addEventListener("candidateWorkflow:change", h);
    return () => window.removeEventListener("candidateWorkflow:change", h);
  }, []);
  return v;
}
Object.assign(window, { getCandidateWorkflow, setCandidateWorkflow, useCandidateWorkflow });

function CandidateWorkflowCard() {
  const workflow = useCandidateWorkflow();
  const setWorkflow = (next) => setCandidateWorkflow(next);

  return (
    <SectionCard
      variant="compact"
      icon="PersonClock"
      title="Candidate workflow"
      sub={
        <React.Fragment>
          How candidates move from submitted to offer across this tenant. <b>Automatic</b> auto-accepts the priority match and fires the offer; <b>Interview</b> pauses at the interview stage and unlocks scheduling, scorecards, and a candidate portal. Per-requisition overrides are still allowed from the Distribution edit panel.
        </React.Fragment>
      }
    >
      <div role="radiogroup" aria-label="Candidate workflow" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 4 }}>
        <button
          type="button"
          role="radio"
          aria-checked={workflow === "automatic"}
          onClick={() => setWorkflow("automatic")}
          className="cwf-choice"
          data-on={workflow === "automatic"}
        >
          <span className="cwf-choice-glyph" aria-hidden="true">
            <Icon name="Bolt" size={20} />
          </span>
          <span className="cwf-choice-text">
            <span className="cwf-choice-title">Automatic</span>
            <span className="cwf-choice-sub">Auto-accept the priority match and fire the offer. No interview gate.</span>
          </span>
          <span className="cwf-choice-pip" aria-hidden="true" />
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={workflow === "interview"}
          onClick={() => setWorkflow("interview")}
          className="cwf-choice"
          data-on={workflow === "interview"}
        >
          <span className="cwf-choice-glyph" aria-hidden="true">
            <Icon name="PersonClock" size={20} />
          </span>
          <span className="cwf-choice-text">
            <span className="cwf-choice-title">Interview</span>
            <span className="cwf-choice-sub">Pause at the interview stage. Full scheduling, scorecards, and a candidate portal.</span>
          </span>
          <span className="cwf-choice-pip" aria-hidden="true" />
        </button>
      </div>

      {workflow === "automatic" ? (
        <div className="cwf-empty">
          <div className="cwf-empty-glyph"><Icon name="Bolt" size={26} /></div>
          <div className="cwf-empty-text">
            <h4>Automatic workflow is active.</h4>
            <p>
              New requisitions skip the interview gate. The first eligible candidate in the priority window is auto-accepted and the offer fires immediately. Per-requisition overrides remain available on the Distribution edit panel, but this tenant has no shared interview configuration to manage.
            </p>
            <p>
              Switch to <b>Interview</b> above to surface the type catalog, scorecard templates, notification templates, decline reasons, calendar integration, policies, skip-interview approvals, SLA thresholds, and version history.
            </p>
          </div>
        </div>
      ) : (
        <div className="cwf-admin">
          <window.InterviewAdminPage />
        </div>
      )}
    </SectionCard>
  );
}

// =====================================================================
// MasterDataTab — chronology of past uploads + Start new upload action
// =====================================================================
function MasterDataTab() {
  const [query, setQuery] = useMdState("");
  const [statusFilter, setStatusFilter] = useMdState("all");
  const [typeFilter, setTypeFilter] = useMdState("all");
  const [history, setHistory] = useMdState(UPLOAD_HISTORY);
  const [panelOpen, setPanelOpen] = useMdState(false);

  const filtered = useMdMemo(() => {
    const q = query.trim().toLowerCase();
    return history.filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (typeFilter !== "all" && r.dataType !== typeFilter) return false;
      if (!q) return true;
      const type = MD_TYPE_INDEX[r.dataType];
      return (
        r.file.toLowerCase().includes(q) ||
        r.by.name.toLowerCase().includes(q) ||
        r.source.toLowerCase().includes(q) ||
        (type && type.name.toLowerCase().includes(q))
      );
    });
  }, [history, query, statusFilter, typeFilter]);

  const counts = useMdMemo(() => {
    const c = { total: history.length, completed: 0, partial: 0, staged: 0, processing: 0, validating: 0, failed: 0, recordsThisMonth: 0, errors: 0 };
    history.forEach((r) => {
      if (c[r.status] !== undefined) c[r.status] += 1;
      c.recordsThisMonth += r.ok;
      c.errors += r.err;
    });
    return c;
  }, [history]);

  const statusTabs = [
    { id: "all",        label: "All",         count: counts.total },
    { id: "completed",  label: "Completed",   count: counts.completed },
    { id: "partial",    label: "With errors", count: counts.partial },
    { id: "staged",     label: "Staged",      count: counts.staged },
    { id: "processing", label: "In progress", count: counts.processing + counts.validating },
    { id: "failed",     label: "Failed",      count: counts.failed },
  ];

  const moreMenu = (e, row) => {
    e.stopPropagation();
    const type = MD_TYPE_INDEX[row.dataType];
    window.openMenu && window.openMenu(e.currentTarget, [
      { icon: "View",         label: "View import results", onClick: () => showToast(`Opening results for ${row.file}`) },
      { icon: "FileDownload", label: "Download original file", onClick: () => showToast(`Downloading ${row.file}`, { kind: "success" }) },
      ...(row.err > 0 ? [{ icon: "FileDownload", label: "Download error report", onClick: () => showToast(`Downloading error report for ${row.file}`, { kind: "success" }) }] : []),
      { icon: "Refresh",      label: "Re-run with same options", onClick: () => showToast(`Re-running ${row.file}`, { kind: "success" }) },
      { divider: true },
      ...(row.status === "staged" ? [
        { icon: "Check",       label: "Promote to production", onClick: () => showToast(`Promoting ${row.file} to production`, { kind: "success" }) },
        { icon: "TrashCan",    label: "Discard staged data", danger: true, onClick: () => showToast(`Discarded staged data from ${row.file}`) },
      ] : []),
      ...(type ? [{ icon: type.icon, label: `Open ${type.name}`, onClick: () => showToast(`Opening ${type.name}`) }] : []),
    ]);
  };

  const openResults = (row) => {
    showToast(`Opening results for ${row.file}`);
  };

  const startNewUpload = () => setPanelOpen(true);

  const onUploadSubmit = ({ dataType, file, mode, promote, sessionUser }) => {
    const id = "up-" + Math.floor(1043 + Math.random() * 1000);
    const rows = file.rows;
    const errRand = Math.random() < 0.18 ? Math.floor(rows * 0.04) : 0;
    const ok = rows - errRand;
    const newRow = {
      id, file: file.name, size: file.size,
      dataType: dataType.id,
      by: { name: sessionUser, initials: sessionUser.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase(), hue: "blue" },
      at: "Just now",
      relative: "Just now",
      rows, ok, err: errRand,
      status: promote === "stage" ? "staged" : (errRand > 0 ? "partial" : "processing"),
      mode: mode === "upsert" ? "Upsert" : mode === "append" ? "Append" : "Replace",
      source: "Manual upload",
    };
    setHistory((prev) => [newRow, ...prev]);
    setPanelOpen(false);
    showToast(`Queued ${file.name} for import into ${dataType.name}`, { kind: "success" });
  };

  return (
    <React.Fragment>
      {/* Header callout */}
      <div className="md-banner" role="note">
        <span className="md-banner-icon" aria-hidden="true">
          <Icon name="Stack" size={18} />
        </span>
        <div className="md-banner-body">
          <div className="md-banner-title">Bring every kind of data into Flex Work — and keep a clean audit trail</div>
          <div className="md-banner-sub">
            Below is every file that has been uploaded to Flex Work, who ran it, and what happened. Use <strong>Start new upload</strong> to bring in a new file — we'll walk you through the schema for your chosen data type before you upload.
          </div>
        </div>
        <div className="md-banner-actions">
          <button
            type="button"
            className="vms-btn vms-btn--secondary vms-btn--sm"
            onClick={() => showToast("Downloading templates bundle (15 files)…", { kind: "success" })}
          >
            <Icon name="FileDownload" size={14} />All templates
          </button>
          <button
            type="button"
            className="vms-btn vms-btn--primary"
            onClick={startNewUpload}
          >
            <Icon name="Import" size={14} />Start new upload
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="vms-kpis" style={{ marginTop: 16 }}>
        <MdKpi label="Total uploads"        value={counts.total}                          foot="last 90 days" />
        <MdKpi label="Records imported"     value={counts.recordsThisMonth.toLocaleString()} foot="all-time, ok rows" />
        <MdKpi label="In progress"          value={counts.processing + counts.validating} foot="processing or validating" />
        <MdKpi label="Staged"               value={counts.staged}                         foot="awaiting promotion" />
        <MdKpi label="Failed runs"          value={counts.failed}                         foot="last 24 h" level={counts.failed > 0 ? "err" : ""} />
      </div>

      {/* Toolbar */}
      <div className="md-toolbar" style={{ marginTop: 16 }}>
        <div className="md-status-chips fw-tabs" role="tablist">
          {statusTabs.map((s) => (
            <button
              key={s.id}
              type="button"
              role="tab"
              aria-pressed={statusFilter === s.id}
              className={"fw-tab" + (statusFilter === s.id ? " is-active" : "")}
              onClick={() => setStatusFilter(s.id)}
            >
              {s.label}
              <span className="fw-tab-count">{s.count}</span>
            </button>
          ))}
        </div>
        <div className="md-toolbar-right">
          <div className="md-type-select">
            <Icon name="Stack" size={14} />
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              aria-label="Filter by data type"
            >
              <option value="all">All data types</option>
              {MASTER_DATA_CATEGORIES.map((cat) => (
                <optgroup key={cat} label={cat}>
                  {MASTER_DATA_TYPES.filter((t) => t.category === cat).map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </optgroup>
              ))}
            </select>
            <Icon name="ChevronDown" size={14} />
          </div>
          <div className="md-search">
            <Icon name="Search" size={16} />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by file, person, or source…"
              aria-label="Search upload history"
            />
          </div>
        </div>
      </div>

      {/* History table */}
      <section className="content-card md-table-card" style={{ marginTop: 16 }}>
        <div className="md-table" role="table" aria-label="Upload history">
          <div className="md-row md-row--head" role="row">
            <div className="md-col md-col--file">File</div>
            <div className="md-col md-col--type">Data type</div>
            <div className="md-col md-col--by">Uploaded by</div>
            <div className="md-col md-col--when">When</div>
            <div className="md-col md-col--records">Records</div>
            <div className="md-col md-col--status">Result</div>
            <div className="md-col md-col--act" aria-label="Actions" />
          </div>
          {filtered.map((r) => (
            <HistoryRow key={r.id} row={r} onOpen={openResults} onMore={moreMenu} />
          ))}
          {filtered.length === 0 && (
            <div className="md-empty">
              <Icon name="Inbox" size={32} />
              <p>No uploads match these filters.</p>
              <button
                type="button"
                className="vms-btn vms-btn--secondary vms-btn--sm"
                onClick={() => { setQuery(""); setStatusFilter("all"); setTypeFilter("all"); }}
              >
                Clear filters
              </button>
            </div>
          )}
        </div>
      </section>

      {panelOpen && (
        <NewUploadPanel
          open={panelOpen}
          onClose={() => setPanelOpen(false)}
          onSubmit={onUploadSubmit}
        />
      )}
    </React.Fragment>
  );
}

// =====================================================================
// NewUploadPanel — progressive disclosure
//   Step 1: Pick a data type (grouped by category, searchable)
//   Step 2: Show everything about that data type — description, current
//           record count, source, template, schema, validation rules —
//           then accept a file and ask how to apply it.
// =====================================================================
function NewUploadPanel({ open, onClose, onSubmit }) {
  const [step, setStep] = useMdState(1);
  const [dataTypeId, setDataTypeId] = useMdState(null);
  const [query, setQuery] = useMdState("");
  const [file, setFile] = useMdState(null);
  const [mode, setMode] = useMdState("upsert");
  const [promote, setPromote] = useMdState("stage");
  const [schemaExpanded, setSchemaExpanded] = useMdState(false);
  const fileInputRef = useMdRef(null);

  useMdEffect(() => {
    if (open) {
      setStep(1);
      setDataTypeId(null);
      setQuery("");
      setFile(null);
      setMode("upsert");
      setPromote("stage");
      setSchemaExpanded(false);
    }
  }, [open]);

  const dataType = dataTypeId ? MD_TYPE_INDEX[dataTypeId] : null;

  const pickType = (id) => { setDataTypeId(id); setStep(2); };

  const browse = () => { if (fileInputRef.current) { fileInputRef.current.value = ""; fileInputRef.current.click(); } };

  const onPickFile = (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    const kb = Math.max(1, Math.round(f.size / 1024));
    const sizeLabel = kb < 1024 ? `${kb} KB` : `${(kb / 1024).toFixed(1)} MB`;
    // Mock parse — derive a row count from file size, clamp to template scale
    const guessRows = Math.max(8, Math.floor(f.size / 80));
    setFile({ name: f.name, size: sizeLabel, rows: guessRows });
  };

  const onDrop = (e) => {
    e.preventDefault();
    const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
    if (!f) return;
    const kb = Math.max(1, Math.round(f.size / 1024));
    const sizeLabel = kb < 1024 ? `${kb} KB` : `${(kb / 1024).toFixed(1)} MB`;
    const guessRows = Math.max(8, Math.floor(f.size / 80));
    setFile({ name: f.name, size: sizeLabel, rows: guessRows });
  };

  const onDragOver = (e) => { e.preventDefault(); };

  const requiredCols = dataType ? dataType.columns.filter((c) => c.required) : [];
  const optionalCols = dataType ? dataType.columns.filter((c) => !c.required) : [];

  const grouped = useMdMemo(() => {
    const q = query.trim().toLowerCase();
    return MASTER_DATA_CATEGORIES.map((cat) => ({
      cat,
      items: MASTER_DATA_TYPES.filter((t) =>
        t.category === cat &&
        (!q ||
         t.name.toLowerCase().includes(q) ||
         t.desc.toLowerCase().includes(q) ||
         t.id.toLowerCase().includes(q))
      ),
    })).filter((g) => g.items.length > 0);
  }, [query]);

  const sessionUser = "You";

  const submit = () => {
    if (!dataType || !file) return;
    onSubmit({ dataType, file, mode, promote, sessionUser });
  };

  const footer = step === 1 ? (
    <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
      <button type="button" className="vms-btn vms-btn--secondary" onClick={onClose}>Cancel</button>
    </div>
  ) : (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
      <button type="button" className="linkbtn" onClick={() => setStep(1)}>
        <Icon name="ChevronLeft" size={14} />Pick a different data type
      </button>
      <div style={{ display: "flex", gap: 8 }}>
        <button type="button" className="vms-btn vms-btn--secondary" onClick={onClose}>Cancel</button>
        <button
          type="button"
          className="vms-btn vms-btn--primary"
          disabled={!file}
          onClick={submit}
        >
          <Icon name="Import" size={14} />
          {promote === "stage" ? "Stage import" : "Run import"}
        </button>
      </div>
    </div>
  );

  return (
    <SidePanel
      open={open}
      title={step === 1 ? "Start new upload" : "New upload"}
      onClose={onClose}
      footer={footer}
    >
      {step === 1 && (
        <div className="nu-step nu-step--pick">
          <p className="nu-lede">
            What kind of data are you importing? Pick a data type and we'll show you exactly what the file needs to look like.
          </p>
          <div className="nu-search">
            <Icon name="Search" size={16} />
            <input
              type="search"
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search data types…"
              aria-label="Search data types"
            />
          </div>

          {grouped.length === 0 ? (
            <div className="md-empty">
              <Icon name="Inbox" size={28} />
              <p>No data types match "{query}".</p>
            </div>
          ) : grouped.map((g) => (
            <div key={g.cat} className="nu-group">
              <div className="nu-group-title">
                <Icon name={MD_CATEGORY_META[g.cat].icon} size={14} />
                {g.cat}
              </div>
              <div className="nu-typegrid">
                {g.items.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    className="nu-typecard"
                    onClick={() => pickType(t.id)}
                  >
                    <span className={"md-icon-tile md-hue-" + t.hue} aria-hidden="true">
                      <Icon name={t.icon} size={18} />
                    </span>
                    <div className="nu-typecard-body">
                      <div className="nu-typecard-name">{t.name}</div>
                      <div className="nu-typecard-desc">{t.desc}</div>
                      <div className="nu-typecard-meta">
                        <span className="tabular">{t.records.toLocaleString()} records</span>
                        <span className="nu-dot" />
                        <span>{t.source}</span>
                      </div>
                    </div>
                    <Icon name="ChevronRight" size={16} />
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {step === 2 && dataType && (
        <div className="nu-step nu-step--detail">
          {/* Sticky picked-type breadcrumb */}
          <div className="nu-picked">
            <span className={"md-icon-tile md-hue-" + dataType.hue} aria-hidden="true">
              <Icon name={dataType.icon} size={18} />
            </span>
            <div className="nu-picked-body">
              <div className="nu-picked-cat">{dataType.category}</div>
              <div className="nu-picked-name">{dataType.name}</div>
            </div>
            <button type="button" className="linkbtn" onClick={() => setStep(1)}>Change</button>
          </div>

          {/* About */}
          <section className="nu-section">
            <h3 className="nu-section-title">About this data type</h3>
            <p className="nu-prose">{dataType.longDesc}</p>
            <div className="nu-statgrid">
              <div className="nu-stat">
                <div className="nu-stat-label">Current records</div>
                <div className="nu-stat-value tabular">{dataType.records.toLocaleString()}</div>
              </div>
              <div className="nu-stat">
                <div className="nu-stat-label">Last upload</div>
                <div className="nu-stat-value">{dataType.lastUpload}</div>
              </div>
              <div className="nu-stat">
                <div className="nu-stat-label">Default source</div>
                <div className="nu-stat-value">
                  <Icon name={MD_SOURCE_KIND_META[dataType.sourceKind].icon} size={12} />
                  &nbsp;{dataType.source}
                </div>
              </div>
              <div className="nu-stat">
                <div className="nu-stat-label">Cadence</div>
                <div className="nu-stat-value">{dataType.cadence}</div>
              </div>
            </div>
          </section>

          {/* Template */}
          <section className="nu-section">
            <h3 className="nu-section-title">Template</h3>
            <div className="nu-template">
              <span className="nu-template-icon" aria-hidden="true">
                <Icon name={dataType.template.format === "XLSX" ? "Excel" : "PDF"} size={20} />
              </span>
              <div className="nu-template-body">
                <div className="nu-template-name">{dataType.template.name}</div>
                <div className="nu-template-meta">{dataType.template.format} · {dataType.template.size} · {dataType.columns.length} columns</div>
              </div>
              <button
                type="button"
                className="vms-btn vms-btn--secondary vms-btn--sm"
                onClick={() => showToast(`Downloading ${dataType.template.name}`, { kind: "success" })}
              >
                <Icon name="FileDownload" size={14} />Download
              </button>
            </div>
          </section>

          {/* Schema */}
          <section className="nu-section">
            <div className="nu-section-head">
              <h3 className="nu-section-title">Schema</h3>
              <button
                type="button"
                className="linkbtn"
                onClick={() => setSchemaExpanded((v) => !v)}
                aria-expanded={schemaExpanded}
              >
                {schemaExpanded ? "Hide" : "Show"} all {dataType.columns.length} columns
                <Icon name={schemaExpanded ? "ChevronUp" : "ChevronDown"} size={14} />
              </button>
            </div>
            <div className="nu-schema">
              <div className="nu-schema-group">
                <div className="nu-schema-label">
                  <span className="nu-req-dot" aria-hidden="true" />
                  Required ({requiredCols.length})
                </div>
                <div className="nu-schema-cols">
                  {requiredCols.map((c) => (
                    <div key={c.name} className="nu-col">
                      <div className="nu-col-head">
                        <span className="nu-col-name">{c.name}</span>
                        <span className="nu-col-type">{c.type}</span>
                      </div>
                      {c.hint && <div className="nu-col-hint">{c.hint}</div>}
                    </div>
                  ))}
                </div>
              </div>
              {schemaExpanded && optionalCols.length > 0 && (
                <div className="nu-schema-group">
                  <div className="nu-schema-label nu-schema-label--opt">
                    Optional ({optionalCols.length})
                  </div>
                  <div className="nu-schema-cols">
                    {optionalCols.map((c) => (
                      <div key={c.name} className="nu-col">
                        <div className="nu-col-head">
                          <span className="nu-col-name">{c.name}</span>
                          <span className="nu-col-type">{c.type}</span>
                        </div>
                        {c.hint && <div className="nu-col-hint">{c.hint}</div>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* Validation rules */}
          <section className="nu-section">
            <h3 className="nu-section-title">Validation rules</h3>
            <ul className="nu-rules">
              {dataType.rules.map((r, i) => (
                <li key={i}>
                  <Icon name="Check" size={12} />
                  <span>{r}</span>
                </li>
              ))}
            </ul>
          </section>

          {/* Upload */}
          <section className="nu-section">
            <h3 className="nu-section-title">Upload file</h3>
            {!file ? (
              <div
                className="nu-drop"
                onDrop={onDrop}
                onDragOver={onDragOver}
                role="button"
                tabIndex={0}
                onClick={browse}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") browse(); }}
              >
                <Icon name="FileUpload" size={28} />
                <div className="nu-drop-prim">Drop your {dataType.template.format} file here, or <span className="nu-drop-link">browse</span></div>
                <div className="nu-drop-sec">Max 25 MB · CSV, TSV, XLSX accepted · UTF-8 encoded</div>
              </div>
            ) : (
              <div className="nu-file">
                <span className="nu-file-icon" aria-hidden="true">
                  <Icon name="File" size={20} />
                </span>
                <div className="nu-file-body">
                  <div className="nu-file-name">{file.name}</div>
                  <div className="nu-file-meta tabular">
                    {file.size} · {file.rows.toLocaleString()} rows detected ·
                    <span className="nu-file-good"> <Icon name="Check" size={11} /> headers match template</span>
                  </div>
                </div>
                <button
                  type="button"
                  className="linkbtn"
                  onClick={() => setFile(null)}
                  aria-label="Remove file"
                >
                  Change
                </button>
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.tsv,.xlsx,.xls"
              style={{ display: "none" }}
              onChange={onPickFile}
            />
          </section>

          {/* Import options */}
          {file && (
            <section className="nu-section">
              <h3 className="nu-section-title">Import options</h3>
              <div className="nu-radio-group">
                <div className="nu-radio-label">When a row already exists</div>
                <div className="nu-radio-row">
                  {[
                    { id: "upsert",  title: "Upsert",  desc: "Match by natural key — update if exists, insert if not" },
                    { id: "append",  title: "Append",  desc: "Insert all rows; fail if any conflict" },
                    { id: "replace", title: "Replace", desc: "Replace the entire ${dataType.name.toLowerCase()} table" },
                  ].map((o) => (
                    <button
                      key={o.id}
                      type="button"
                      className={"nu-radio" + (mode === o.id ? " is-active" : "")}
                      aria-pressed={mode === o.id}
                      onClick={() => setMode(o.id)}
                    >
                      <span className="nu-radio-dot" aria-hidden="true" />
                      <span className="nu-radio-body">
                        <span className="nu-radio-title">{o.title}</span>
                        <span className="nu-radio-desc">{o.desc.replace("${dataType.name.toLowerCase()}", dataType.name.toLowerCase())}</span>
                      </span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="nu-radio-group">
                <div className="nu-radio-label">Promotion</div>
                <div className="nu-radio-row">
                  {[
                    { id: "stage",  title: "Stage first",      desc: "Validate, review, then promote to production" },
                    { id: "direct", title: "Direct to production", desc: "Skip staging — rows go live immediately" },
                  ].map((o) => (
                    <button
                      key={o.id}
                      type="button"
                      className={"nu-radio" + (promote === o.id ? " is-active" : "")}
                      aria-pressed={promote === o.id}
                      onClick={() => setPromote(o.id)}
                    >
                      <span className="nu-radio-dot" aria-hidden="true" />
                      <span className="nu-radio-body">
                        <span className="nu-radio-title">{o.title}</span>
                        <span className="nu-radio-desc">{o.desc}</span>
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </section>
          )}
        </div>
      )}
    </SidePanel>
  );
}

Object.assign(window, { MasterDataTab });
