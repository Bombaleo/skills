// =====================================================================
// Flex Work — Pricing Configurations
//   Owns the table, the details page (3 status variants), and the
//   edit-name modal. The Create New wizard lives in pricing-config-new.jsx.
//   Visual style is Everest; UX matches the legacy Pricing Config Figma.
// =====================================================================

const { useState: usePc, useMemo: useMemoPc, useEffect: useEffectPc, useCallback: useCbPc } = React;

// Omnibar bridge — the pricing detail page renders inside SettingsPage's
// shared omnibar, so it can't change that header directly. The detail
// view publishes its header context (config name + back / edit handlers)
// here; SettingsPage subscribes via the `pcfg:omni` event and swaps in a
// back-style header on the details view only.
function setPcfgOmni(state) {
  const next = state || { mode: "list" };
  // The detail view re-publishes this on every render (its onBack /
  // onEdit props are fresh closures each time). Only dispatch when the
  // header's *visible* shape actually changes, otherwise the subscriber
  // re-renders → new props → effect re-fires → infinite loop. Handlers
  // are still refreshed in place so onBack / onEdit stay current.
  const sig = `${next.mode}|${next.name || ""}|${next.canEdit ? 1 : 0}`;
  window.__pcfgOmni = next;
  if (window.__pcfgOmniSig === sig) return;
  window.__pcfgOmniSig = sig;
  window.dispatchEvent(new CustomEvent("pcfg:omni"));
}

// ---------- Mock data ---------------------------------------------------
// Eight default pricing groups (per Figma). Locked groups can't be
// removed.
//
// v0.79 · F1 / F4 / F5 — each rule now carries a typed `primitive`
// payload, an effective-date pair, and a `scope` (countries +
// currencies). The legacy `fields` array stays alongside for editor
// legibility; the engine reads `primitive`, `effective`, `scope`.
// Backward-compatible: rules without a primitive behave as today.
//
// Primitive shape:
//   { kind: "percentage" | "amount" | "multiplier" | "band",
//     value, threshold?, bands?, target? }
//   · target picks which engine stage consumes the rule:
//       "premium"      (stage 2, multiplicative on base)
//       "contribution" (stage 3, on loaded subtotal)
//       "skill"        (stage 4, filtered by row's skillIds[])
//       "tenure"       (stage 5, band against ctx.workerTenureDays)
//       "tax"          (stage 7, on final bill rate)
const PCFG_DEFAULT_STRUCTURE = [
  {
    id: "g1", name: "Worker regular pay", locked: true,
    rules: [{
      id: "r1-1", name: "Worker regular pay",
      fields: [
        { label: "Type",       value: "System default" },
        { label: "Positions",  value: "All positions"  },
        { label: "Calculation", value: "Hourly · per worker · gross" },
      ],
      primitive: { kind: "base", target: "base" },
      effective: { from: "2026-01-01", to: null },
      scope: { countries: [], currencies: [] },
    }],
  },
  {
    id: "g2", name: "Pay premiums", locked: false,
    rules: [
      { id: "r2-1", name: "Night shift premium", fields: [
        { label: "Type", value: "Time-based premium" },
        { label: "Positions", value: "All positions" },
        { label: "Calculation", value: "+15% · hours 22:00 – 06:00" },
      ],
        primitive: { kind: "percentage", target: "premium", variant: "night", value: 15 },
        effective: { from: "2026-01-01", to: null },
        scope: { countries: [], currencies: [] },
      },
      { id: "r2-2", name: "Weekend premium", fields: [
        { label: "Type", value: "Day-based premium" },
        { label: "Positions", value: "All positions" },
        { label: "Calculation", value: "+10% · Saturday, Sunday" },
      ],
        primitive: { kind: "percentage", target: "premium", variant: "weekend", value: 10 },
        effective: { from: "2026-01-01", to: null },
        scope: { countries: [], currencies: [] },
      },
    ],
  },
  {
    id: "g3", name: "Holiday pay", locked: false,
    rules: [{ id: "r3-1", name: "Statutory holiday pay", fields: [
      { label: "Type", value: "Holiday calendar" },
      { label: "Positions", value: "All positions" },
      { label: "Calculation", value: "1.5x base rate · public holidays" },
    ],
      primitive: { kind: "multiplier", target: "premium", variant: "holiday", value: 1.5 },
      effective: { from: "2026-01-01", to: null },
      scope: { countries: [], currencies: [] },
    }],
  },
  {
    id: "g4", name: "Employer contributions", locked: false,
    rules: [
      { id: "r4-1", name: "Employer national insurance", fields: [
        { label: "Type", value: "Percentage" },
        { label: "Positions", value: "All positions" },
        { label: "Calculation", value: "13.8% · gross pay above £9,100/yr" },
      ],
        primitive: { kind: "percentage", target: "contribution", value: 13.8, threshold: 9100 },
        effective: { from: "2026-04-06", to: null },
        scope: { countries: ["GB"], currencies: ["GBP"] },
      },
      { id: "r4-2", name: "Pension contribution", fields: [
        { label: "Type", value: "Percentage" },
        { label: "Positions", value: "All positions" },
        { label: "Calculation", value: "3% · qualifying earnings" },
      ],
        primitive: { kind: "percentage", target: "contribution", value: 3 },
        effective: { from: "2026-01-01", to: null },
        scope: { countries: ["GB"], currencies: ["GBP"] },
      },
    ],
  },
  {
    id: "g5", name: "Tenure deduction", locked: false,
    rules: [{ id: "r5-1", name: "First 90 days adjustment", fields: [
      { label: "Type", value: "Tenure band" },
      { label: "Positions", value: "All positions" },
      { label: "Calculation", value: "-5% · workers <90 days tenure" },
    ],
      primitive: {
        kind: "band", target: "tenure",
        bands: [
          { lt: 90, value: -5 },
          { lt: 180, value: 0 },
          { lt: 365, value: 0 },
          { lt: 9999, value: 0 },
        ],
      },
      effective: { from: "2026-01-01", to: null },
      scope: { countries: [], currencies: [] },
    }],
  },
  {
    id: "g6", name: "Markup", locked: true,
    rules: [{ id: "r6-1", name: "Bill rate markup", fields: [
      { label: "Type", value: "Percentage on subtotal" },
      { label: "Positions", value: "All positions" },
      { label: "Calculation", value: "22% on (regular + premiums + contributions)" },
    ],
      primitive: { kind: "percentage", target: "markup", value: 22 },
      effective: { from: "2026-01-01", to: null },
      scope: { countries: [], currencies: [] },
    }],
  },
  // Skill premiums — stacks on top of base pay before markup is
  // applied. Read by RateCardsCard's bill-rate breakdown popover and
  // by ScRateCardEditorPanel's chip group; the catalog ID is the
  // join key to positions[].skillIds[].
  {
    id: "g6b", name: "Skill premiums", locked: false,
    rules: [
      { id: "r6b-1", name: "ICU certification", fields: [
        { label: "Type", value: "Certification premium" },
        { label: "Positions", value: "Healthcare" },
        { label: "Calculation", value: "+8% · workers with active ICU cert" },
      ],
        primitive: { kind: "percentage", target: "skill", skillId: "icu", value: 8 },
        effective: { from: "2026-01-01", to: null },
        scope: { countries: [], currencies: [] },
      },
      { id: "r6b-2", name: "Class-7 forklift", fields: [
        { label: "Type", value: "License premium" },
        { label: "Positions", value: "Operations" },
        { label: "Calculation", value: "+5% · valid license on file" },
      ],
        primitive: { kind: "percentage", target: "skill", skillId: "fork7", value: 5 },
        effective: { from: "2026-01-01", to: null },
        scope: { countries: [], currencies: [] },
      },
      { id: "r6b-3", name: "Bilingual (ES / EN)", fields: [
        { label: "Type", value: "Language premium" },
        { label: "Positions", value: "Front of house · Guest services" },
        { label: "Calculation", value: "+4% · self-attested + verified by supplier" },
      ],
        primitive: { kind: "percentage", target: "skill", skillId: "bilingual", value: 4 },
        effective: { from: "2026-01-01", to: null },
        scope: { countries: [], currencies: [] },
      },
    ],
  },
  {
    id: "g7", name: "Taxes", locked: false,
    rules: [{ id: "r7-1", name: "VAT", fields: [
      { label: "Type", value: "Percentage" },
      { label: "Positions", value: "All positions" },
      { label: "Calculation", value: "20% on final bill rate" },
    ],
      primitive: { kind: "percentage", target: "tax", value: 20 },
      effective: { from: "2026-01-01", to: null },
      scope: { countries: ["GB"], currencies: ["GBP"] },
    }],
  },
];

// Flatten every rule across all groups into the typed-primitive array
// the engine consumes. Skips rules without a primitive (legacy /
// display-only) so a partially-typed config still resolves cleanly.
function rulesFromStructure(structure) {
  const out = [];
  (structure || []).forEach((g) => {
    (g.rules || []).forEach((r) => {
      if (!r.primitive) return;
      out.push({
        id: r.id,
        groupId: g.id,
        groupName: g.name,
        name: r.name,
        primitive: r.primitive,
        effective: r.effective || { from: null, to: null },
        scope: r.scope || { countries: [], currencies: [] },
      });
    });
  });
  return out;
}

// v0.80 · A3 — Per-config rule overrides.
//
// Clone the default eight-group structure and override individual rule
// primitives (and their display "Calculation" string) by rule id, so a
// named configuration can carry its own night premium, holiday
// multiplier, or markup without re-authoring the whole shape. This is
// what lets binding a contract to "Hospitality — Tier 1" vs
// "Manufacturing — Pilot Program" resolve to a different bill rate —
// the engine reads the bound config's structure at calc time.
function pcfgStructure(overrides) {
  overrides = overrides || {};
  return PCFG_DEFAULT_STRUCTURE.map((g) => ({
    ...g,
    rules: g.rules.map((r) => {
      const ov = overrides[r.id];
      if (!ov) return r;
      return {
        ...r,
        primitive: ov.primitive ? { ...r.primitive, ...ov.primitive } : r.primitive,
        fields: ov.calc
          ? r.fields.map((f) => f.label === "Calculation" ? { ...f, value: ov.calc } : f)
          : r.fields,
      };
    }),
  }));
}

const PCFG_DATA = [
  {
    id: "pc-001",
    name: "Manufacturing — Pilot Program",
    status: "Active",
    dateCreated: "03.10.2026, 11:53 AM PT",
    dateActivated: "03.12.2026, 09:41 AM PT",
    dateArchived: null,
    createdBy: "Alex Moreno",
    agencyCount: 4,
    agencies: [
      { id: "a1", name: "Acme Staffing Group", contract: "MFG-2026-001", since: "03.12.2026" },
      { id: "a2", name: "Cascade Workforce",  contract: "MFG-2026-004", since: "03.14.2026" },
      { id: "a3", name: "Northwind People",   contract: "MFG-2026-007", since: "03.18.2026" },
      { id: "a4", name: "Pacific Crewing Co.", contract: "MFG-2026-010", since: "03.21.2026" },
    ],
    structure: PCFG_DEFAULT_STRUCTURE,
  },
  {
    id: "pc-002",
    name: "Warehouse — Standard Rate Card",
    status: "Active",
    dateCreated: "02.04.2026, 10:18 AM PT",
    dateActivated: "02.06.2026, 02:22 PM PT",
    dateArchived: null,
    createdBy: "Priya Shah",
    agencyCount: 7,
    agencies: [
      { id: "a1", name: "Acme Staffing Group", contract: "WH-2026-001", since: "02.06.2026" },
      { id: "a2", name: "Sunset Labor LLC",     contract: "WH-2026-002", since: "02.08.2026" },
      { id: "a3", name: "Pacific Crewing Co.",  contract: "WH-2026-003", since: "02.09.2026" },
    ],
    structure: PCFG_DEFAULT_STRUCTURE,
  },
  {
    id: "pc-003",
    name: "Distribution — Premium Holiday Rates",
    status: "Pending",
    dateCreated: "04.02.2026, 03:08 PM PT",
    dateActivated: null,
    dateArchived: null,
    createdBy: "Maya Chen",
    agencyCount: 0,
    agencies: [],
    structure: PCFG_DEFAULT_STRUCTURE,
  },
  {
    id: "pc-004",
    name: "Retail Seasonal — Q4 2025",
    status: "Archived",
    dateCreated: "08.21.2025, 04:50 PM PT",
    dateActivated: "08.25.2025, 10:00 AM PT",
    dateArchived: "01.05.2026, 11:42 AM PT",
    createdBy: "Devon Park",
    agencyCount: 0,
    agencies: [],
    structure: PCFG_DEFAULT_STRUCTURE,
  },
  {
    id: "pc-005",
    name: "Hospitality — Tier 1",
    status: "Active",
    dateCreated: "01.15.2026, 09:00 AM PT",
    dateActivated: "01.20.2026, 11:11 AM PT",
    dateArchived: null,
    createdBy: "Alex Moreno",
    agencyCount: 2,
    agencies: [
      { id: "a1", name: "Northwind People",   contract: "HSP-2026-002", since: "01.21.2026" },
      { id: "a2", name: "Cascade Workforce",  contract: "HSP-2026-003", since: "01.22.2026" },
    ],
    structure: PCFG_DEFAULT_STRUCTURE,
  },
  {
    id: "pc-006",
    name: "Logistics — Night Shift Heavy",
    status: "Pending",
    dateCreated: "04.18.2026, 02:36 PM PT",
    dateActivated: null,
    dateArchived: null,
    createdBy: "Priya Shah",
    agencyCount: 0,
    agencies: [],
    structure: PCFG_DEFAULT_STRUCTURE,
  },
];

// v0.80 · A3 — Differentiate the named configs so binding moves the
// rate. Markup and the regular-shift premiums are the levers that show
// up in the headline bill-rate cell (employer contributions are GB-
// scoped and fall to the legacy burden on US contracts; night/weekend
// premiums only fire on those shift variants in the popover). Pending
// configs are differentiated too — they're still selectable on a
// contract. Mutating PCFG_DATA before the store initialises is safe;
// getPcfgStore() spreads this array on first read.
(function differentiatePcfgStructures() {
  const byId = Object.fromEntries(PCFG_DATA.map((c) => [c.id, c]));
  const set = (id, overrides) => { if (byId[id]) byId[id].structure = pcfgStructure(overrides); };
  // pc-001 Manufacturing — leaner pilot markup.
  set("pc-001", {
    "r6-1": { primitive: { value: 18 }, calc: "18% on (regular + premiums + contributions)" },
  });
  // pc-002 Warehouse — the default rate card (markup 22%, no override).
  // pc-003 Distribution — premium holiday rates.
  set("pc-003", {
    "r3-1": { primitive: { value: 2.0 }, calc: "2.0x base rate · public holidays" },
    "r6-1": { primitive: { value: 24 }, calc: "24% on (regular + premiums + contributions)" },
  });
  // pc-005 Hospitality Tier 1 — richer weekend differential, top markup.
  set("pc-005", {
    "r2-2": { primitive: { value: 12 }, calc: "+12% · Saturday, Sunday" },
    "r6-1": { primitive: { value: 25 }, calc: "25% on (regular + premiums + contributions)" },
  });
  // pc-006 Logistics — night-shift heavy.
  set("pc-006", {
    "r2-1": { primitive: { value: 25 }, calc: "+25% · hours 22:00 – 06:00" },
    "r6-1": { primitive: { value: 20 }, calc: "20% on (regular + premiums + contributions)" },
  });

  // v0.81 · Rate-engine recommendations #12 — program thresholds.
  // Admin-authored ceilings the engine enforces everywhere: ceilingBill
  // (absolute hourly bill cap per position) and marginFloor (minimum
  // supplier margin %). computeBillRate returns { thresholds:{breached,by} }
  // and downstream surfaces turn warning-yellow on breach.
  if (byId["pc-001"]) byId["pc-001"].threshold = { ceilingBill: 64, marginFloor: 12 };
  if (byId["pc-002"]) byId["pc-002"].threshold = { ceilingBill: 58, marginFloor: 10 };
  if (byId["pc-005"]) byId["pc-005"].threshold = { ceilingBill: 72, marginFloor: 14 };
})();

// Persistent runtime store so the list survives navigation in the demo.
function getPcfgStore() {
  if (!window.__pcfgStore) window.__pcfgStore = [...PCFG_DATA];
  return window.__pcfgStore;
}
function setPcfgStore(next) {
  window.__pcfgStore = next;
  window.dispatchEvent(new CustomEvent("pcfg:change"));
}
function upsertPcfg(rec) {
  const cur = getPcfgStore();
  const i = cur.findIndex((r) => r.id === rec.id);
  const next = i >= 0
    ? [...cur.slice(0, i), { ...cur[i], ...rec }, ...cur.slice(i + 1)]
    : [rec, ...cur];
  setPcfgStore(next);
}

// =====================================================================
// v0.79 · A1 — Impact preview.
//
// Counts how many supplier contracts / positions / active assignments
// a rule edit will touch BEFORE the save commits. Reads
// window.SUPPLIERS + window.getSupplierContract to walk the graph; the
// "active assignments" count is synthesized off the contract's
// positions array (the prototype doesn't have a live assignment feed,
// but the shape matches what the real one will plug into).
//
// Returns:
//   { contracts, positions, assignments, deltaBillRate }
// =====================================================================
function pcfgImpactPreview(configId, rule, draft) {
  const suppliers = (typeof window !== "undefined" && window.SUPPLIERS) || [];
  const getContract = (typeof window !== "undefined" && window.getSupplierContract) || (() => null);
  const cfg = getPcfgStore().find((c) => c.id === configId);
  const cfgName = cfg ? cfg.name : "";
  let contracts = 0, positions = 0, assignments = 0, deltaTotal = 0, deltaCount = 0;
  suppliers.forEach((s) => {
    const c = getContract(s.id);
    if (!c) return;
    if (cfgName && c.pricingConfig !== cfgName) return;
    contracts++;
    const enabled = (c.positions || []).filter((p) => p.enabled !== false);
    positions += enabled.length;
    // Synth: ~30% of enabled positions have at least one live worker.
    assignments += Math.round(enabled.length * 0.3);
    // Estimate the bill-rate delta by re-running the engine with the
    // draft value and the live value, on a representative row.
    if (window.runRateStages && rule && draft && draft.value != null && rule.primitive) {
      const row = enabled[0];
      if (row) {
        const ctx = { date: new Date().toISOString().slice(0, 10), country: c.country || "US" };
        const cur = window.runRateStages(row, c, ctx).billRate;
        const before = rule.primitive.value;
        // Temporarily swap the value on the contract's rule snapshot.
        const swap = (c.pricingConfigRules || []).map((r) => r.id === rule.id
          ? { ...r, primitive: { ...r.primitive, value: Number(draft.value) || 0 } }
          : r);
        const next = window.runRateStages(row, { ...c, pricingConfigRules: swap }, ctx).billRate;
        deltaTotal += (next - cur);
        deltaCount++;
        void before;
      }
    }
  });
  return {
    contracts, positions, assignments,
    deltaBillRate: deltaCount ? (deltaTotal / deltaCount) : 0,
  };
}

// =====================================================================
// v0.79 · A2 — Per-rule audit ledger.
//
// Each rule keeps a runtime ledger keyed by rule id. Real
// implementation reads from /api/pricing-config/<id>/audit; the
// prototype seeds three entries per locked rule so the History drawer
// renders out of the box.
// =====================================================================
function getRuleAudit(ruleId) {
  if (!window.__pcfgRuleAudit) window.__pcfgRuleAudit = {};
  if (!window.__pcfgRuleAudit[ruleId]) {
    // Deterministic seed off the rule id.
    let h = 0;
    for (let i = 0; i < ruleId.length; i++) h = (h * 31 + ruleId.charCodeAt(i)) | 0;
    const seed = Math.abs(h);
    window.__pcfgRuleAudit[ruleId] = [
      { at: "2026-04-06", by: "Priya Shah",   change: `Statutory uplift · ${10 + (seed % 5)}% → ${12 + (seed % 4)}%`, reason: "HMRC bulletin April 2026" },
      { at: "2026-01-15", by: "Alex Moreno",  change: "Scope narrowed to UK contracts",                                   reason: "Locale isolation" },
      { at: "2025-09-02", by: "Import",       change: "Seeded from pricing_config_v3.yaml",                               reason: "Initial load" },
    ];
  }
  return window.__pcfgRuleAudit[ruleId];
}
function pushRuleAudit(ruleId, entry) {
  const cur = getRuleAudit(ruleId);
  window.__pcfgRuleAudit[ruleId] = [{ at: new Date().toISOString().slice(0, 10), by: "You", ...entry }, ...cur].slice(0, 24);
}

// =====================================================================
// v0.79 · A3 — Pricing-config versions.
//
// Each config carries a versions[] array; "active" version is what the
// engine reads. Activate(versionId) flips the snapshot atomically and
// pushes an audit entry; nothing in the wizard or details page needs
// to know about versions to keep working — the "Save as new version"
// toggle in PcfgImpactPreview is the only entry point.
// =====================================================================
function getPcfgVersions(configId) {
  if (!window.__pcfgVersions) window.__pcfgVersions = {};
  if (!window.__pcfgVersions[configId]) {
    window.__pcfgVersions[configId] = [
      { id: "v1.1", label: "v1.1 (active)", status: "Active", at: "2026-03-12", by: "Alex Moreno",  notes: "Initial activation" },
      { id: "v1.0", label: "v1.0",          status: "Archived", at: "2026-02-04", by: "Maya Chen",   notes: "Pilot draft" },
    ];
  }
  return window.__pcfgVersions[configId];
}
function promotePcfgVersion(configId, versionId) {
  const cur = getPcfgVersions(configId);
  window.__pcfgVersions[configId] = cur.map((v) => ({
    ...v,
    status: v.id === versionId ? "Active" : (v.status === "Active" ? "Archived" : v.status),
    label:  v.id === versionId ? `${v.id} (active)` : v.id,
  }));
  window.dispatchEvent(new CustomEvent("pcfg:change"));
}

// =====================================================================
// v0.79 · A6 — Drift report.
//
// Buckets the same canonical position across every active pricing
// config and flags drift > 8% between the highest and lowest loaded
// bill rate. Read by the new "Drift" tab on the index.
// =====================================================================
function computePcfgDrift() {
  const cfgs = getPcfgStore().filter((c) => c.status === "Active");
  const suppliers = (typeof window !== "undefined" && window.SUPPLIERS) || [];
  const getContract = (typeof window !== "undefined" && window.getSupplierContract) || (() => null);
  // Bucket: position name → { configName → [billRate, …] }
  const buckets = {};
  suppliers.forEach((s) => {
    const c = getContract(s.id);
    if (!c) return;
    const cfg = cfgs.find((x) => x.name === c.pricingConfig);
    if (!cfg) return;
    (c.positions || []).slice(0, 4).forEach((row) => {
      if (!row.enabled) return;
      const r = window.runRateStages
        ? window.runRateStages(row, c, { date: new Date().toISOString().slice(0, 10), country: c.country || "US" })
        : { billRate: row.payRate };
      const key = row.name;
      (buckets[key] = buckets[key] || {});
      (buckets[key][cfg.name] = buckets[key][cfg.name] || []).push(Math.round(r.billRate));
    });
  });
  // Reduce: average per config, drift = (max − min) / min.
  const rows = Object.entries(buckets).map(([position, byCfg]) => {
    const items = Object.entries(byCfg).map(([cfgName, rates]) => ({
      cfg: cfgName,
      rate: Math.round(rates.reduce((a, b) => a + b, 0) / rates.length),
    }));
    if (items.length < 2) return null;
    const min = Math.min(...items.map((i) => i.rate));
    const max = Math.max(...items.map((i) => i.rate));
    const drift = min ? (max - min) / min : 0;
    return { position, items, min, max, drift };
  }).filter(Boolean).sort((a, b) => b.drift - a.drift);
  return rows;
}

// ---------- Status pill -------------------------------------------------
function PcfgStatusPill({ status }) {
  const hue = status === "Active"   ? "success"
            : status === "Pending"  ? "warning"
            : status === "Archived" ? "default"
            : "default";
  return <span className={`req-pill req-pill--${hue}`}>{status}</span>;
}

// ---------- Generic modal scrim (Esc + outside-click dismiss) ----------
function PcfgModalScrim({ onClose, children, sm = false }) {
  useEffectPc(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose && onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div
      className="pcfg-modal-scrim"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose && onClose(); }}
    >
      <div className={`pcfg-modal${sm ? " pcfg-modal--sm" : ""}`}>{children}</div>
    </div>
  );
}

// ---------- Edit-name modal --------------------------------------------
function PcfgEditNameModal({ initialName, onSave, onClose }) {
  const [val, setVal] = usePc(initialName || "");
  const [touched, setTouched] = usePc(false);
  const trimmed = val.trim();
  const error = touched && trimmed.length === 0 ? "Name is required" : "";
  const tooLong = trimmed.length > 175;
  const save = () => {
    setTouched(true);
    if (!trimmed || tooLong) return;
    onSave(trimmed);
    onClose();
  };
  return (
    <PcfgModalScrim onClose={onClose}>
      <button type="button" className="pcfg-modal-close" aria-label="Close" onClick={onClose}>
        <Icon name="X" size={18} />
      </button>
      <div className="pcfg-modal-body">
        <h2 className="pcfg-modal-title">Edit configuration name</h2>
        <div className="pcfg-field">
          <label htmlFor="pcfg-edit-name" className="pcfg-field-label-on">
            Name<span className="pcfg-req">*</span>
          </label>
          <input
            id="pcfg-edit-name"
            className="pcfg-input"
            value={val}
            onChange={(e) => setVal(e.target.value)}
            onBlur={() => setTouched(true)}
            aria-invalid={!!error || tooLong}
            maxLength={200}
            autoFocus
          />
          {(error || tooLong) && (
            <div className="pcfg-field-error">
              <span>{error || "Name must be 175 characters or fewer"}</span>
              <span>{trimmed.length}/175</span>
            </div>
          )}
          {!error && !tooLong && (
            <div className="pcfg-field-help" style={{ textAlign: "right" }}>
              {trimmed.length}/175
            </div>
          )}
        </div>
      </div>
      <div className="pcfg-modal-footer">
        <button type="button" className="pcfg-btn pcfg-btn--secondary" onClick={onClose}>Discard</button>
        <button type="button" className="pcfg-btn pcfg-btn--primary" onClick={save}>Save</button>
      </div>
    </PcfgModalScrim>
  );
}

// ---------- Confirm modal (cancel setup / archive) ---------------------
function PcfgConfirmModal({ title, body, confirmLabel = "Confirm", danger = false, onConfirm, onClose }) {
  return (
    <PcfgModalScrim onClose={onClose} sm>
      <div className="pcfg-modal-body pcfg-modal-body--sm">
        <h2 className="pcfg-modal-title">{title}</h2>
        <p className="pcfg-modal-text">{body}</p>
      </div>
      <div className="pcfg-modal-footer">
        <button type="button" className="pcfg-btn pcfg-btn--secondary" onClick={onClose}>Cancel</button>
        <button
          type="button"
          className={`pcfg-btn ${danger ? "pcfg-btn--danger" : "pcfg-btn--primary"}`}
          onClick={() => { onConfirm(); onClose(); }}
        >
          {confirmLabel}
        </button>
      </div>
    </PcfgModalScrim>
  );
}

// ---------- Detail accordion (canonical Everest .acc-card) -------------
// Matches SupAccordionCard / WfAccordionCard on the Suppliers and
// Workforce detail pages so every detail surface uses one accordion. The
// pricing page drives open state externally (the bodies are heavy and
// some carry their own state), so this is a controlled wrapper around the
// shared .acc-card markup. Collapsed by default at every call site.
function PcfgAccordionCard({ icon, title, open, onToggle, action, count, children }) {
  const id = React.useId();
  return (
    <section className="acc-card">
      <div
        className="acc-card-head"
        role="button"
        tabIndex={0}
        aria-expanded={open}
        aria-controls={id}
        onClick={onToggle}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onToggle(); } }}
      >
        <span className="acc-card-avatar" aria-hidden="true">
          <Icon name={icon} size={20} />
        </span>
        <h2 className="acc-card-title">{title}</h2>
        {count != null && <span className="acc-card-count">{count}</span>}
        {action && (
          <span className="acc-card-action" onClick={(e) => e.stopPropagation()}>
            {action}
          </span>
        )}
        <span className="acc-card-chev" data-open={open} aria-hidden="true">
          <Icon name="ChevronDown" size={20} />
        </span>
      </div>
      {open && (
        <div id={id} className="acc-card-body">
          {children}
        </div>
      )}
    </section>
  );
}

// ---------- Sortable header cell (Everest list-table head) -------------
// Mirrors SupHeaderCell on Suppliers: sentence-case label + a sort
// affordance, click toggles sort. The grid track widths come from the
// `.pcfg-row` rule so header + body cells line up.
function PcfgHeaderCell({ children, sortKey, sortBy, onSort, align = "left" }) {
  return (
    <div
      className={`req-cell${align === "right" ? " pcfg-cell--count" : ""}`}
      role="columnheader"
      onClick={() => onSort(sortKey)}
      style={{ cursor: "pointer" }}
    >
      <span>{children}</span>
      <span className="req-sort" aria-hidden="true" title="Sort" style={{ marginLeft: 4 }}>
        <Icon name="ArrowsUpDownSmall" size={14} />
      </span>
    </div>
  );
}

// ---------- List page --------------------------------------------------
function PricingConfigList({ onOpenRow, onNew, onReload }) {
  const [rows, setRows] = usePc(() => getPcfgStore());
  const [query, setQuery] = usePc("");
  const [sortBy, setSortBy] = usePc({ key: "dateCreated", dir: "desc" });
  // v0.79 · A6 — top-level tabs: list ↔ drift report.
  const [view, setView] = usePc("list");
  // Status filter — shared Everest filter-chip + popover machinery, so
  // the pricing list matches the filter pattern on the other tables.
  const flt = window.useFilters({ status: [] });
  // Pagination — shared Everest <Pagination>, same as the other tables.
  const [page, setPage] = usePc(1);
  const [pageSize, setPageSize] = usePc(10);

  useEffectPc(() => {
    const onChange = () => setRows([...getPcfgStore()]);
    window.addEventListener("pcfg:change", onChange);
    return () => window.removeEventListener("pcfg:change", onChange);
  }, []);

  const filtered = useMemoPc(() => {
    const q = query.trim().toLowerCase();
    const statusSel = flt.filters.status || [];
    return rows
      .filter((r) => statusSel.length === 0 || statusSel.includes(r.status))
      .filter((r) => !q || r.name.toLowerCase().includes(q) || (r.createdBy || "").toLowerCase().includes(q))
      .slice()
      .sort((a, b) => {
        const av = a[sortBy.key] || "";
        const bv = b[sortBy.key] || "";
        const cmp = String(av).localeCompare(String(bv));
        return sortBy.dir === "asc" ? cmp : -cmp;
      });
  }, [rows, query, flt.filters.status, sortBy]);

  // Paginate the filtered set. Reset to page 1 whenever the result set
  // changes shape (search, filter, or page-size change) so the user is
  // never stranded on an empty page.
  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  useEffectPc(() => { setPage(1); }, [query, flt.filters.status, pageSize]);
  const paged = useMemoPc(
    () => filtered.slice((page - 1) * pageSize, page * pageSize),
    [filtered, page, pageSize]
  );

  const toggleSort = (key) => {
    setSortBy((cur) => cur.key === key
      ? { key, dir: cur.dir === "asc" ? "desc" : "asc" }
      : { key, dir: "asc" });
  };

  const rowMenu = (row) => (e) => {
    e.stopPropagation();
    if (!window.openMenu) return;
    window.openMenu(e.currentTarget, [
      { icon: "View", label: "View configuration", onClick: () => onOpenRow(row.id) },
      ...(row.status !== "Archived"
        ? [{ icon: "Edit", label: "Edit", onClick: () => onOpenRow(row.id) }]
        : []),
      { icon: "Copy", label: "Duplicate", onClick: () => {
        const next = { ...row, id: `pc-${Date.now()}`, name: `${row.name} (copy)`, status: "Pending",
          dateCreated: new Date().toLocaleString(), dateActivated: null, dateArchived: null,
          agencyCount: 0, agencies: [] };
        upsertPcfg(next);
        if (window.showToast) window.showToast(`${row.name} duplicated`, { kind: "success" });
      }},
      { divider: true },
      row.status === "Archived"
        ? { icon: "AddCircle", label: "Reactivate", onClick: () => {
            upsertPcfg({ ...row, status: "Pending", dateArchived: null });
            if (window.showToast) window.showToast(`${row.name} moved back to Pending`, { kind: "success" });
          }}
        : { icon: "Archive" in {} ? "Archive" : "TimeUndo", label: "Archive", danger: true,
            onClick: () => {
              upsertPcfg({ ...row, status: "Archived", dateArchived: new Date().toLocaleString(), agencyCount: 0, agencies: [] });
              if (window.showToast) window.showToast(`${row.name} archived`, { kind: "success" });
            }},
    ]);
  };

  return (
    <React.Fragment>
      {/* v0.79 · A6 — List ↔ Drift tabs · Everest Tabs group (shared StatusTabs) */}
      {window.StatusTabs && (
        <window.StatusTabs
          variant="everest"
          ariaLabel="Pricing view"
          active={view}
          onChange={(id) => setView(id)}
          tabs={[
            { id: "list",  label: "Configurations" },
            { id: "drift", label: "Drift report" },
          ]}
        />
      )}

      {view === "drift" ? (
        <PcfgDriftReport />
      ) : (
      <React.Fragment>

      <div className="inv-toolbar">
        <div className="inv-search">
          <span className="inv-search-icon" aria-hidden="true">
            <Icon name="Search" size={24} />
          </span>
          <input
            type="search"
            className="inv-search-input"
            placeholder="Search configurations"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search configurations"
          />
        </div>
      </div>

      <div className="req-table-card" role="table" aria-label="Pricing configurations">
        <div className="req-filters">
          <div className="req-filters-left">
            <window.FilterChip
              label="Status"
              active={(flt.filters.status || []).length > 0}
              count={(flt.filters.status || []).length}
              onClick={flt.openFor("status", "Status", ["Active", "Pending", "Archived"])}
            />
          </div>
          <div className="req-filters-right">
            {flt.hasAny && (
              <React.Fragment>
                <span className="req-filters-sep" aria-hidden="true">|</span>
                <button type="button" className="req-clear" onClick={flt.clearAll}>Clear all filters</button>
              </React.Fragment>
            )}
          </div>
        </div>

        <div className="req-scroll">
          <div className="req-row pcfg-row req-row--header" role="row">
            <PcfgHeaderCell sortKey="name" sortBy={sortBy} onSort={toggleSort}>Configuration name</PcfgHeaderCell>
            <div className="req-cell" role="columnheader"><span>Status</span></div>
            <PcfgHeaderCell sortKey="createdBy" sortBy={sortBy} onSort={toggleSort}>Created by</PcfgHeaderCell>
            <PcfgHeaderCell sortKey="dateCreated" sortBy={sortBy} onSort={toggleSort}>Date created</PcfgHeaderCell>
            <div className="req-cell pcfg-cell--count" role="columnheader"><span>Agencies</span></div>
            <div className="req-cell pcfg-cell--actions" role="columnheader" aria-label=""></div>
          </div>

          <div className="req-body" role="rowgroup">
            {filtered.length === 0 ? (
              <div className="req-row" role="row" style={{ display: "block", padding: "8px 0" }}>
                <div className="pcfg-empty">
                  <Icon name="Pay" size={32} style={{ color: "var(--evr-content-primary-lowemp)" }} />
                  <h3 className="pcfg-empty-title">No configurations match</h3>
                  <p className="pcfg-empty-body">
                    Try clearing the search or filter, or create a new pricing configuration.
                  </p>
                </div>
              </div>
            ) : paged.map((row) => (
              <div
                key={row.id}
                className="req-row pcfg-row req-row--clickable"
                role="row"
                tabIndex={0}
                onClick={(e) => { if (e.target.closest("button")) return; onOpenRow(row.id); }}
                onKeyDown={(e) => { if (e.key === "Enter") onOpenRow(row.id); }}
              >
                <div className="req-cell pcfg-cell--name" role="cell">{row.name}</div>
                <div className="req-cell" role="cell"><PcfgStatusPill status={row.status} /></div>
                <div className="req-cell" role="cell">{row.createdBy}</div>
                <div className="req-cell" role="cell"><span className="tabular">{row.dateCreated}</span></div>
                <div className="req-cell pcfg-cell--count" role="cell"><span className="tabular">{row.agencyCount}</span></div>
                <div className="req-cell pcfg-cell--actions" role="cell">
                  <button type="button" className="iconbtn"
                          aria-label={`Actions for ${row.name}`} onClick={rowMenu(row)}>
                    <Icon name="MoreVert" size={18} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {filtered.length > 0 && (
          <window.Pagination
            page={page}
            totalPages={totalPages}
            total={total}
            pageSize={pageSize}
            onChange={setPage}
            onPageSizeChange={setPageSize}
          />
        )}
      </div>
      </React.Fragment>
      )}

      {/* v0.79 · A6 — Drift report is rendered above via early return */}
    </React.Fragment>
  );
}

// =====================================================================
// v0.79 · A6 — Drift report tab. Lists positions whose loaded bill
// rate diverges > 8% across active pricing configs.
// =====================================================================
function PcfgDriftReport() {
  const rows = useMemoPc(() => computePcfgDrift(), []);
  const driftAlert = rows.filter((r) => r.drift > 0.08);
  return (
    <div className="pcfg-card" style={{ padding: 20 }}>
      <p className="pcfg-page-sub" style={{ marginTop: 0 }}>
        Same canonical position, different pricing configs. Drift over 8% flags here for QBR conversations.
      </p>
      {rows.length === 0 ? (
        <div className="pcfg-empty">
          <Icon name="Check" size={32} style={{ color: "var(--evr-content-primary-lowemp)" }} />
          <h3 className="pcfg-empty-title">No multi-config positions</h3>
          <p className="pcfg-empty-body">Drift surfaces once two or more active configs share a canonical position.</p>
        </div>
      ) : (
        <React.Fragment>
          <div className="pcfg-drift-summary">
            <b>{driftAlert.length}</b> position{driftAlert.length === 1 ? "" : "s"} over 8% drift · <b>{rows.length}</b> tracked.
          </div>
          <div className="pcfg-drift">
            {rows.map((r) => (
              <div key={r.position} className={`pcfg-drift-row ${r.drift > 0.08 ? "is-alert" : ""}`}>
                <div className="pcfg-drift-pos">
                  <b>{r.position}</b>
                  <span className="tabular">{(r.drift * 100).toFixed(1)}% spread</span>
                </div>
                <div className="pcfg-drift-bars">
                  {r.items.map((it) => (
                    <div key={it.cfg} className="pcfg-drift-bar">
                      <span className="pcfg-drift-bar-cfg">{it.cfg}</span>
                      <span className="pcfg-drift-bar-fill" style={{
                        width: `${Math.round((it.rate - r.min) / Math.max(1, r.max - r.min) * 100)}%`,
                        background: r.drift > 0.08 ? "var(--evr-yellow-500, #eab308)" : "var(--evr-blue-400)",
                      }} />
                      <span className="pcfg-drift-bar-val tabular">${it.rate}/hr</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </React.Fragment>
      )}
    </div>
  );
}
function PcfgStructureViewer({ structure, editable, onEdit, onAddRule, onAddGroup }) {
  const [tab, setTab] = usePc("worker");
  const [openGroups, setOpenGroups] = usePc({});
  const toggleAll = (open) => {
    const next = {};
    structure.forEach((g) => { next[g.id] = open; });
    setOpenGroups(next);
  };
  const tabbed = (tab === "worker"
    ? structure.filter((g) => g.id !== "g6")   // Worker pay tab excludes Markup
    : tab === "markup"
      ? structure.filter((g) => g.id === "g6") // Markup tab
      : []);                                    // Renewal tab handled separately

  const allOpen = tabbed.every((g) => openGroups[g.id]);

  return (
    <React.Fragment>
      <div className="pcfg-tabs" role="tablist">
        <button type="button" className="pcfg-tab" role="tab"
                aria-selected={tab === "worker"}
                onClick={() => setTab("worker")}>Worker pay</button>
        <button type="button" className="pcfg-tab" role="tab"
                aria-selected={tab === "markup"}
                onClick={() => setTab("markup")}>Markup &amp; taxes</button>
        <button type="button" className="pcfg-tab" role="tab"
                aria-selected={tab === "renewal"}
                onClick={() => setTab("renewal")}>Renewal calendar</button>
      </div>

      {tab === "renewal" ? (
        <PcfgRenewalCalendar />
      ) : (
      <div className="pcfg-structure">
        {editable && (
          <div className="pcfg-builder-toolbar">
            <div className="pcfg-builder-toolbar-left">
              <button type="button" className="pcfg-btn pcfg-btn--primary" onClick={onAddRule}>
                <Icon name="AddCircle" size={16} /> Add rule
              </button>
              <button type="button" className="pcfg-btn pcfg-btn--secondary" onClick={onAddGroup}>
                <Icon name="AddCircle" size={16} /> Add group
              </button>
            </div>
            <div className="pcfg-builder-toolbar-right">
              <button type="button" className="pcfg-icon-btn" aria-label="Custom data filter">
                <Icon name="Adjustment" size={18} />
              </button>
              <button type="button" className="pcfg-icon-btn"
                      aria-label={allOpen ? "Collapse all" : "Expand all"}
                      onClick={() => toggleAll(!allOpen)}>
                <Icon name={allOpen ? "ChevronUp" : "ChevronDown"} size={18} />
              </button>
            </div>
          </div>
        )}

        {tabbed.map((g, i) => (
          <React.Fragment key={g.id}>
            <PcfgRuleGroup
              group={g}
              index={tab === "worker" ? i + 1 : 6}
              open={!!openGroups[g.id]}
              onToggle={() => setOpenGroups((s) => ({ ...s, [g.id]: !s[g.id] }))}
              editable={editable}
              onEdit={onEdit}
            />
            {i < tabbed.length - 1 && (
              <div className="pcfg-connector"><span className="pcfg-connector-dot" /></div>
            )}
          </React.Fragment>
        ))}
      </div>
      )}
    </React.Fragment>
  );
}

// =====================================================================
// Renewal calendar — surfaces every rate-card row in the program that
// expires inside the next 12 months. Reads from every supplier contract
// via getSupplierContract() and groups by effectiveTo month. The
// admin's pre-emption window is T-60 / T-30 / T-7. FG ships an email
// digest at each gate; we surface them as a single table here.
// =====================================================================
function PcfgRenewalCalendar() {
  const suppliers = (typeof window !== "undefined" && window.SUPPLIERS) || [];
  const getContract = (typeof window !== "undefined" && window.getSupplierContract) || (() => null);

  const rows = useMemoPc(() => {
    const out = [];
    suppliers.forEach((s) => {
      const c = getContract(s.id);
      if (!c || !Array.isArray(c.positions)) return;
      c.positions.forEach((p) => {
        if (!p.effectiveTo) return;
        const t = new Date(p.effectiveTo).getTime();
        if (Number.isNaN(t)) return;
        const days = Math.round((t - Date.now()) / 86400000);
        if (days > 365 || days < -30) return;
        out.push({
          supplier: s.name,
          supplierId: s.id,
          position: p.name,
          effectiveTo: p.effectiveTo,
          days,
          payRate: p.payRatePref || p.payRate,
          currency: p.currency || "USD",
        });
      });
    });
    return out.sort((a, b) => a.days - b.days);
  }, [suppliers]);

  if (rows.length === 0) {
    return (
      <div className="pcfg-renewal-empty">
        <Icon name="Calendar" size={20} />
        <p>No rate-card rows expire within the next 12 months.</p>
      </div>
    );
  }

  const buckets = useMemoPc(() => {
    const out = { overdue: [], "0-7": [], "8-30": [], "31-60": [], "61-180": [], "181-365": [] };
    rows.forEach((r) => {
      if (r.days < 0)        out.overdue.push(r);
      else if (r.days <= 7)  out["0-7"].push(r);
      else if (r.days <= 30) out["8-30"].push(r);
      else if (r.days <= 60) out["31-60"].push(r);
      else if (r.days <= 180) out["61-180"].push(r);
      else out["181-365"].push(r);
    });
    return out;
  }, [rows]);

  const bucketMeta = [
    { id: "overdue", label: "Overdue",            tone: "danger",  hint: "Past effective-to; bill rate fell back to floor" },
    { id: "0-7",     label: "Within 7 days",      tone: "danger",  hint: "T-7 — escalation gate; finance + program owner cc'd" },
    { id: "8-30",    label: "8 – 30 days",        tone: "warning", hint: "T-30 — second reminder to supplier" },
    { id: "31-60",   label: "31 – 60 days",       tone: "warning", hint: "T-60 — first reminder to program owner" },
    { id: "61-180",  label: "61 – 180 days",      tone: "info",    hint: "Watchlist; appears on the quarterly QBR" },
    { id: "181-365", label: "Later this year",    tone: "muted",   hint: "Annual roll-up" },
  ];

  return (
    <div className="pcfg-renewal">
      <p className="pcfg-renewal-lede">
        Every supplier rate-card row in the program with an effective-to date in the next 12 months.
        Buckets are the T&minus;60 / T&minus;30 / T&minus;7 notification gates — supplier and program
        owner receive an email at each.
      </p>
      <div className="pcfg-renewal-grid">
        {bucketMeta.map((b) => (
          <div key={b.id} className="pcfg-renewal-bucket" data-tone={b.tone}>
            <header className="pcfg-renewal-bucket-h">
              <span className="pcfg-renewal-bucket-label">{b.label}</span>
              <span className="pcfg-renewal-bucket-count tabular">{(buckets[b.id] || []).length}</span>
            </header>
            <p className="pcfg-renewal-bucket-hint">{b.hint}</p>
            {(buckets[b.id] || []).length === 0 ? (
              <p className="pcfg-renewal-empty-sm">No rows in this bucket.</p>
            ) : (
              <ul className="pcfg-renewal-list">
                {(buckets[b.id] || []).slice(0, 8).map((r, i) => (
                  <li key={i}>
                    <div className="pcfg-renewal-row">
                      <span className="pcfg-renewal-pos">{r.position}</span>
                      <span className="pcfg-renewal-sup">{r.supplier}</span>
                    </div>
                    <div className="pcfg-renewal-meta">
                      <time dateTime={r.effectiveTo}>{r.effectiveTo}</time>
                      <span className="tabular">{r.days < 0 ? `${Math.abs(r.days)}d ago` : `in ${r.days}d`}</span>
                    </div>
                  </li>
                ))}
                {(buckets[b.id] || []).length > 8 && (
                  <li className="pcfg-renewal-more">+{(buckets[b.id] || []).length - 8} more</li>
                )}
              </ul>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function PcfgRuleGroup({ group, index, open, onToggle, editable, onEdit }) {
  const [auditOpen, setAuditOpen] = usePc(false);
  const [impactRule, setImpactRule] = usePc(null);
  const moreMenu = (e) => {
    e.stopPropagation();
    if (!window.openMenu) return;
    window.openMenu(e.currentTarget, [
      { icon: "Edit", label: "Edit group", onClick: () => onEdit && onEdit(group.id) },
      { icon: "AddCircle", label: "Add rule", onClick: () => {} },
      { icon: "Copy", label: "Duplicate group", onClick: () => {} },
      { divider: true },
      { icon: "Cancel", label: "Remove group", danger: true, onClick: () => {} },
    ]);
  };
  return (
    <div className="pcfg-rule">
      <div
        className="pcfg-rule-header"
        data-locked={group.locked ? "true" : "false"}
        onClick={onToggle}
      >
        <span className="pcfg-rule-chev" data-open={open ? "true" : "false"}>
          <Icon name="ChevronRight" size={16} />
        </span>
        <span className="pcfg-rule-num">{index}</span>
        <h4 className="pcfg-rule-name">{group.name}</h4>
        {group.locked && (
          <span className="pcfg-rule-lock" title="Built-in group — can't be removed">
            <Icon name="Lock" size={16} />
          </span>
        )}
        {editable && !group.locked && (
          <button type="button" className="pcfg-rule-more"
                  aria-label="More actions" onClick={moreMenu}>
            <Icon name="MoreHoriz" size={18} />
          </button>
        )}
      </div>

      {open && (
        <div className="pcfg-rule-body">
          {group.rules.map((rule, ri) => (
            <div key={rule.id} style={{ marginBottom: ri < group.rules.length - 1 ? 16 : 0 }}>
              <h5 className="pcfg-rule-body-title">
                {rule.name}
                {/* v0.79 · F4 / F5 chips — effective range + locale scope */}
                {rule.effective && (rule.effective.from || rule.effective.to) && (
                  <span className="pcfg-rule-chip" title={`Effective ${rule.effective.from || "—"} to ${rule.effective.to || "open"}`}>
                    <Icon name="Calendar" size={10} />
                    {rule.effective.from ? rule.effective.from.slice(0, 7) : "any"} → {rule.effective.to ? rule.effective.to.slice(0, 7) : "open"}
                  </span>
                )}
                {rule.scope && ((rule.scope.countries || []).length > 0 || (rule.scope.currencies || []).length > 0) && (
                  <span className="pcfg-rule-chip pcfg-rule-chip--scope" title={`Scoped to ${(rule.scope.countries || []).join(", ")} ${(rule.scope.currencies || []).join(", ")}`}>
                    <Icon name="Globe" size={10} />
                    {(rule.scope.countries || []).concat(rule.scope.currencies || []).join(" · ")}
                  </span>
                )}
                {rule.primitive && rule.primitive.target && (
                  <span className="pcfg-rule-chip pcfg-rule-chip--typed" title={`Typed primitive · ${rule.primitive.kind} → stage "${rule.primitive.target}"`}>
                    <Icon name="Tag" size={10} />typed
                  </span>
                )}
                {/* v0.79 · A1 — Preview button. Opens the impact panel. */}
                {editable && rule.primitive && (
                  <button
                    type="button"
                    className="pcfg-rule-chip pcfg-rule-chip--preview"
                    onClick={() => setImpactRule(rule)}
                    title="Preview the impact of changing this rule"
                  >
                    <Icon name="Eye" size={10} />Impact
                  </button>
                )}
              </h5>
              <div className="pcfg-rule-fields">
                {rule.fields.map((f) => (
                  <div key={f.label}>
                    <span className="pcfg-field-label">{f.label}</span>
                    <div className="pcfg-field-value">{f.value}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
          {/* v0.79 · A2 — audit ledger drawer per group. Aggregates the
              per-rule ledger so admins read group-level changes in one
              place; reasons surface inline. */}
          <div className="pcfg-rule-audit">
            <button
              type="button"
              className="pcfg-rule-audit-h"
              aria-expanded={auditOpen}
              onClick={() => setAuditOpen((v) => !v)}
            >
              <Icon name="Clock" size={12} />
              <span><b>History</b> · {(group.rules || []).reduce((a, r) => a + getRuleAudit(r.id).length, 0)} entries</span>
              <Icon name={auditOpen ? "ChevronUp" : "ChevronDown"} size={14} />
            </button>
            {auditOpen && (
              <div className="pcfg-rule-audit-body">
                {(group.rules || []).flatMap((r) =>
                  getRuleAudit(r.id).slice(0, 3).map((h) => ({ ...h, rule: r.name, ruleId: r.id }))
                ).sort((a, b) => (b.at || "").localeCompare(a.at || "")).slice(0, 6).map((h, i) => (
                  <div className="pcfg-rule-audit-row" key={i}>
                    <time dateTime={h.at}>{h.at}</time>
                    <div>
                      <b>{h.rule}</b> — {h.change}
                      <div className="pcfg-rule-audit-meta">{h.by}{h.reason ? ` · ${h.reason}` : ""}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
      {/* v0.79 · A1 — impact preview modal. */}
      {impactRule && (
        <PcfgImpactModal rule={impactRule} onClose={() => setImpactRule(null)} />
      )}
    </div>
  );
}

// v0.79 · A1 — Impact preview modal.
function PcfgImpactModal({ rule, onClose, configId }) {
  const [draft, setDraft] = usePc(String(rule.primitive?.value || ""));
  const [reason, setReason] = usePc("");
  const [createNewVersion, setCreateNewVersion] = usePc(false);
  const impact = useMemoPc(() => pcfgImpactPreview(configId || (window.__pcfgActiveConfigId || null), rule, { value: Number(draft) }), [rule, draft, configId]);
  const blocked = impact.assignments > 30 && !reason;
  return (
    <PcfgModalScrim onClose={onClose}>
      <button type="button" className="pcfg-modal-close" aria-label="Close" onClick={onClose}>
        <Icon name="X" size={18} />
      </button>
      <div className="pcfg-modal-body">
        <h2 className="pcfg-modal-title">Preview rule change</h2>
        <p className="pcfg-modal-text" style={{ marginBottom: 16 }}>
          <b>{rule.name}</b> — dry-run pass over every bound contract.
        </p>
        <div className="pcfg-field">
          <label className="pcfg-field-label-on">New value</label>
          <input
            className="pcfg-input"
            type="number"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
          />
        </div>
        <div className="pcfg-impact-grid">
          <div className="pcfg-impact-stat">
            <span className="pcfg-impact-stat-h">Contracts</span>
            <b className="tabular">{impact.contracts}</b>
          </div>
          <div className="pcfg-impact-stat">
            <span className="pcfg-impact-stat-h">Positions</span>
            <b className="tabular">{impact.positions}</b>
          </div>
          <div className="pcfg-impact-stat">
            <span className="pcfg-impact-stat-h">Active assignments</span>
            <b className="tabular">{impact.assignments}</b>
          </div>
          <div className="pcfg-impact-stat">
            <span className="pcfg-impact-stat-h">Avg bill rate Δ</span>
            <b className="tabular">{impact.deltaBillRate >= 0 ? "+" : ""}${(impact.deltaBillRate || 0).toFixed(2)}/hr</b>
          </div>
        </div>
        {impact.assignments > 30 && (
          <div className="pcfg-impact-warn">
            <Icon name="Alert" size={14} />
            Reason required — affected assignments exceed your org threshold (30).
          </div>
        )}
        <div className="pcfg-field" style={{ marginTop: 12 }}>
          <label className="pcfg-field-label-on">Reason (audit)</label>
          <input
            className="pcfg-input"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="HMRC bulletin · CPI adjustment · …"
          />
        </div>
        <label className="pcfg-checkrow">
          <input type="checkbox" checked={createNewVersion} onChange={(e) => setCreateNewVersion(e.target.checked)} />
          Save as new version (A3)
        </label>
      </div>
      <div className="pcfg-modal-footer">
        <button type="button" className="pcfg-btn pcfg-btn--secondary" onClick={onClose}>Cancel</button>
        <button
          type="button"
          className="pcfg-btn pcfg-btn--primary"
          disabled={blocked}
          onClick={() => {
            pushRuleAudit(rule.id, { change: `${rule.primitive.value} → ${draft}`, reason });
            if (createNewVersion) {
              const cid = configId || window.__pcfgActiveConfigId;
              if (cid) {
                const versions = getPcfgVersions(cid);
                const next = `v${(versions.length + 1).toString().padStart(2, "0")}`;
                window.__pcfgVersions[cid] = [
                  { id: next, label: `${next} (draft)`, status: "Draft", at: new Date().toISOString().slice(0, 10), by: "You", notes: reason || "Rule change" },
                  ...versions,
                ];
              }
            }
            if (window.showToast) window.showToast("Rule change recorded", { kind: "success" });
            onClose();
          }}
        >Apply</button>
      </div>
    </PcfgModalScrim>
  );
}

// ---------- Details page (Active / Pending / Archived) -----------------
function PricingConfigDetails({ configId, onBack, onEditStructure }) {
  // v0.79 · Make the active config id available to PcfgImpactModal so
  // the dry-run pass scopes to the right pricing config.
  useEffectPc(() => {
    window.__pcfgActiveConfigId = configId;
    return () => { if (window.__pcfgActiveConfigId === configId) window.__pcfgActiveConfigId = null; };
  }, [configId]);
  const [config, setConfig] = usePc(() => getPcfgStore().find((c) => c.id === configId) || null);
  const [editingName, setEditingName] = usePc(false);
  const [archiveConfirm, setArchiveConfirm] = usePc(false);
  const [structureOpen, setStructureOpen] = usePc(false);
  const [agenciesOpen, setAgenciesOpen] = usePc(false);
  const [summaryOpen, setSummaryOpen] = usePc(false);
  const [toastOpen, setToastOpen] = usePc(true);
  // v0.79 · A3 — versions side panel toggle.
  const [versionsOpen, setVersionsOpen] = usePc(false);
  // v0.79 · A5 — bulk migrate selection on Agencies card.
  const [agencySel, setAgencySel] = usePc(() => new Set());
  const [migrateOpen, setMigrateOpen] = usePc(false);

  useEffectPc(() => {
    const onChange = () => setConfig(getPcfgStore().find((c) => c.id === configId) || null);
    window.addEventListener("pcfg:change", onChange);
    return () => window.removeEventListener("pcfg:change", onChange);
  }, [configId]);

  // Publish header context to SettingsPage's omnibar (back-style header
  // with the config name + Edit action). Cleared back to list mode when
  // the detail view unmounts.
  // Hold the parent's callbacks in refs — they're fresh closures on every
  // PricingConfigPage render, so depending on them here would re-run this
  // effect (and its cleanup) every render, toggling the omni header
  // list↔details and looping. Depend on `config` only.
  const onBackRef = React.useRef(onBack);
  const onEditRef = React.useRef(onEditStructure);
  onBackRef.current = onBack;
  onEditRef.current = onEditStructure;
  useEffectPc(() => {
    if (!config) return undefined;
    if (window.__PCFG_OMNI_DISABLED) return undefined;   // TEMP bisect
    const locked   = config.status === "Active" && config.agencyCount > 0;
    const archived = config.status === "Archived";
    setPcfgOmni({
      mode: "details",
      name: config.name,
      canEdit: !locked && !archived,
      onBack: () => onBackRef.current && onBackRef.current(),
      onEdit: () => onEditRef.current && onEditRef.current(config.id),
    });
    return () => setPcfgOmni({ mode: "list" });
  }, [config]);

  if (!config) {
    return (
      <div className="content-card" style={{ margin: "20px 0" }}>
        <p>Configuration not found.</p>
        <button type="button" className="pcfg-btn pcfg-btn--secondary" onClick={onBack}>
          Back to configurations
        </button>
      </div>
    );
  }

  const isActive   = config.status === "Active";
  const isArchived = config.status === "Archived";
  const isPending  = config.status === "Pending";
  // Active configs with agencies assigned can't be edited (matches Figma).
  const editLocked = isActive && config.agencyCount > 0;

  return (
    <React.Fragment>
      {/* Status-specific toast --------------------------------------- */}
      {isActive && editLocked && toastOpen && (
        <div className="pcfg-toast pcfg-toast--warning">
          <span className="pcfg-toast-icon"><Icon name="Alert" size={20} /></span>
          <div className="pcfg-toast-body">
            This configuration has been assigned to agency contracts and can no longer be edited.
            If you wish to make changes, please <strong>duplicate it</strong>, adjust it, and re-assign
            the new configuration to your desired agency contracts.
          </div>
          <button type="button" className="pcfg-toast-close" aria-label="Dismiss" onClick={() => setToastOpen(false)}>
            <Icon name="X" size={16} />
          </button>
        </div>
      )}
      {isPending && toastOpen && (
        <div className="pcfg-toast">
          <span className="pcfg-toast-icon"><Icon name="Alert" size={20} /></span>
          <div className="pcfg-toast-body">
            This configuration is in <strong>Pending</strong> state. It becomes Active automatically
            the first time it's assigned to an agency contract.
          </div>
          <button type="button" className="pcfg-toast-close" aria-label="Dismiss" onClick={() => setToastOpen(false)}>
            <Icon name="X" size={16} />
          </button>
        </div>
      )}
      {isArchived && toastOpen && (
        <div className="pcfg-toast">
          <span className="pcfg-toast-icon"><Icon name="Alert" size={20} /></span>
          <div className="pcfg-toast-body">
            This configuration is archived and read-only. You can <strong>duplicate</strong> it to
            use it as a starting point for a new configuration.
          </div>
          <button type="button" className="pcfg-toast-close" aria-label="Dismiss" onClick={() => setToastOpen(false)}>
            <Icon name="X" size={16} />
          </button>
        </div>
      )}

      {/* Summary header --------------------------------------------- */}
      <div className="pcfg-card">
        <div className="pcfg-summary">
          <div className="pcfg-summary-main">
            <PcfgStatusPill status={config.status} />
            <div className="pcfg-summary-name">
              <h1>{config.name}</h1>
              <button
                type="button"
                className="pcfg-edit-btn"
                aria-label="Edit configuration name"
                disabled={editLocked || isArchived}
                title={editLocked ? "Can't edit — assigned to agency contracts" : "Edit name"}
                onClick={() => setEditingName(true)}
              >
                <Icon name="Edit" size={18} />
              </button>
            </div>
          </div>

          {/* v0.79 · A3 — Versions. Opens the version panel. */}
          <button
            type="button"
            className="pcfg-btn pcfg-btn--secondary"
            style={{ height: 32, flex: "0 0 auto" }}
            onClick={() => setVersionsOpen(true)}
            title="Stage-and-promote pricing-config versions"
          >
            <Icon name="Clock" size={14} /> Versions ({getPcfgVersions(config.id).length})
          </button>
        </div>
      </div>

      {/* Details — collapsed by default, canonical Everest accordion -- */}
      <PcfgAccordionCard
        icon="Information"
        title="Details"
        open={summaryOpen}
        onToggle={() => setSummaryOpen((v) => !v)}
      >
        <window.InfoGrid rows={[
          ...(config.dateActivated ? [{ label: "Date activated", value: config.dateActivated }] : []),
          { label: "Date created", value: config.dateCreated },
          ...(config.dateArchived ? [{ label: "Date archived", value: config.dateArchived }] : []),
          { label: "Created by", value: config.createdBy },
          { label: "Configuration ID", value: config.id, tabular: true, copyable: true },
        ]} />
      </PcfgAccordionCard>

      {/* Structure ---------------------------------------------------- */}
      <PcfgAccordionCard
        icon="Pay"
        title="Structure"
        open={structureOpen}
        onToggle={() => setStructureOpen((v) => !v)}
        action={
          editLocked ? (
            <button type="button" className="pcfg-btn pcfg-btn--secondary"
                    style={{ height: 32 }} disabled
                    title="Locked — assigned to agency contracts">
              <Icon name="Lock" size={14} /> Edit
            </button>
          ) : !isArchived ? (
            <button type="button"
                    className="pcfg-btn pcfg-btn--secondary"
                    style={{ height: 32 }}
                    onClick={() => onEditStructure(config.id)}>
              <Icon name="Edit" size={14} /> Edit
            </button>
          ) : null
        }
      >
        <PcfgStructureViewer
          structure={config.structure}
          editable={false}
          onEdit={() => onEditStructure(config.id)}
          onAddRule={() => {}}
          onAddGroup={() => {}}
        />
      </PcfgAccordionCard>

      {/* Assigned Agencies ------------------------------------------- */}
      <PcfgAccordionCard
        icon="Users"
        title="Assigned agencies"
        open={agenciesOpen}
        onToggle={() => setAgenciesOpen((v) => !v)}
        count={config.agencyCount}
      >
        <React.Fragment>
            {/* v0.79 · A5 — bulk-migrate toolbar. */}
            {config.agencies.length > 0 && (
              <div className="pcfg-agencies-bar">
                <span className="pcfg-agencies-bar-count">
                  {agencySel.size > 0 ? `${agencySel.size} selected` : `${config.agencies.length} agencies`}
                </span>
                <button
                  type="button"
                  className="pcfg-btn pcfg-btn--secondary"
                  disabled={agencySel.size === 0}
                  onClick={() => setMigrateOpen(true)}
                >
                  <Icon name="Send" size={14} /> Move to…
                </button>
              </div>
            )}
            {config.agencies.length === 0 ? (
              <div className="pcfg-agencies-empty">
                <Icon name="Search" size={32} style={{ color: "var(--evr-content-primary-lowemp)" }} />
                <h3 className="pcfg-agencies-empty-title">No agencies assigned</h3>
                <p style={{ margin: 0 }}>
                  This configuration isn't assigned to any agency contracts yet.
                </p>
              </div>
            ) : (
              <div className="pcfg-agencies">
                {config.agencies.map((a) => (
                  <div className="pcfg-agencies-row" key={a.id}>
                    <input
                      type="checkbox"
                      checked={agencySel.has(a.id)}
                      onChange={() => setAgencySel((prev) => {
                        const next = new Set(prev);
                        next.has(a.id) ? next.delete(a.id) : next.add(a.id);
                        return next;
                      })}
                      aria-label={`Select ${a.name}`}
                    />
                    <Icon name="Building" size={18} style={{ color: "var(--evr-content-primary-lowemp)" }} />
                    <span className="pcfg-agencies-row-name">{a.name}</span>
                    <span className="pcfg-agencies-row-meta">Contract {a.contract}</span>
                    <span className="pcfg-agencies-row-meta">Since {a.since}</span>
                  </div>
                ))}
              </div>
            )}
        </React.Fragment>
      </PcfgAccordionCard>

      {/* Footer actions --------------------------------------------- */}
      <div className="pcfg-details-footer">
        {!isArchived && (
          <button type="button" className="pcfg-btn pcfg-btn--secondary"
                  onClick={() => setArchiveConfirm(true)}>
            Archive
          </button>
        )}
        {isArchived && (
          <button type="button" className="pcfg-btn pcfg-btn--ghost"
                  onClick={() => {
                    upsertPcfg({ ...config, status: "Pending", dateArchived: null });
                    if (window.showToast) window.showToast(`${config.name} reactivated`, { kind: "success" });
                  }}>
            <Icon name="AddCircle" size={16} /> Reactivate
          </button>
        )}
      </div>

      {/* Modals ----------------------------------------------------- */}
      {editingName && (
        <PcfgEditNameModal
          initialName={config.name}
          onSave={(name) => {
            upsertPcfg({ ...config, name });
            if (window.showToast) window.showToast("Name updated", { kind: "success" });
          }}
          onClose={() => setEditingName(false)}
        />
      )}

      {archiveConfirm && (
        <PcfgConfirmModal
          title={editLocked
            ? "Can't archive this configuration"
            : "Archive this configuration?"}
          body={editLocked
            ? "This configuration is assigned to one or more agency contracts. Re-assign those contracts to a different configuration before archiving."
            : "Archived configurations become read-only and can no longer be assigned to new agency contracts. You can duplicate them later to start a new configuration."}
          confirmLabel={editLocked ? "Got it" : "Archive"}
          danger={!editLocked}
          onConfirm={() => {
            if (editLocked) return;
            upsertPcfg({ ...config, status: "Archived", dateArchived: new Date().toLocaleString() });
            if (window.showToast) window.showToast(`${config.name} archived`, { kind: "success" });
            onBack();
          }}
          onClose={() => setArchiveConfirm(false)}
        />
      )}

      {/* v0.79 · A3 — versions modal. */}
      {versionsOpen && (
        <PcfgVersionsModal
          configId={config.id}
          onClose={() => setVersionsOpen(false)}
        />
      )}

      {/* v0.79 · A5 — bulk-migrate modal. */}
      {migrateOpen && (
        <PcfgBulkMigrateModal
          sourceConfig={config}
          selectedIds={[...agencySel]}
          onClose={() => setMigrateOpen(false)}
          onMoved={() => {
            // Drop the moved agencies off the source config and clear
            // the selection. The destination's agency count picks up
            // through the same upsertPcfg path.
            const remaining = config.agencies.filter((a) => !agencySel.has(a.id));
            upsertPcfg({ ...config, agencies: remaining, agencyCount: remaining.length });
            setAgencySel(new Set());
            setMigrateOpen(false);
          }}
        />
      )}
    </React.Fragment>
  );
}

// =====================================================================
// v0.79 · A3 — versions modal. Stage-and-promote.
// =====================================================================
function PcfgVersionsModal({ configId, onClose }) {
  const [versions, setVersions] = usePc(() => getPcfgVersions(configId));
  useEffectPc(() => {
    const onChange = () => setVersions([...getPcfgVersions(configId)]);
    window.addEventListener("pcfg:change", onChange);
    return () => window.removeEventListener("pcfg:change", onChange);
  }, [configId]);
  return (
    <PcfgModalScrim onClose={onClose}>
      <button type="button" className="pcfg-modal-close" aria-label="Close" onClick={onClose}>
        <Icon name="X" size={18} />
      </button>
      <div className="pcfg-modal-body">
        <h2 className="pcfg-modal-title">Versions</h2>
        <p className="pcfg-modal-text">Stage edits as a draft and promote when ready. Activating flips bindings atomically.</p>
        <div className="pcfg-versions">
          {versions.map((v) => (
            <div className={`pcfg-version pcfg-version--${(v.status || "").toLowerCase()}`} key={v.id}>
              <div>
                <b>{v.label}</b>
                <div className="pcfg-version-meta">{v.at} · {v.by} · {v.notes || "—"}</div>
              </div>
              <span className={`req-pill req-pill--${v.status === "Active" ? "success" : v.status === "Draft" ? "warning" : "default"}`}>{v.status}</span>
              {v.status !== "Active" && (
                <button
                  type="button"
                  className="pcfg-btn pcfg-btn--secondary"
                  onClick={() => {
                    promotePcfgVersion(configId, v.id);
                    if (window.showToast) window.showToast(`${v.id} activated`, { kind: "success" });
                  }}
                >Activate</button>
              )}
            </div>
          ))}
        </div>
      </div>
      <div className="pcfg-modal-footer">
        <button type="button" className="pcfg-btn pcfg-btn--secondary" onClick={onClose}>Close</button>
      </div>
    </PcfgModalScrim>
  );
}

// =====================================================================
// v0.79 · A5 — bulk-migrate modal. Moves N supplier contracts onto a
// different pricing config in one batched edit.
// =====================================================================
function PcfgBulkMigrateModal({ sourceConfig, selectedIds, onClose, onMoved }) {
  const dests = getPcfgStore().filter((c) => c.id !== sourceConfig.id && c.status !== "Archived");
  const [destId, setDestId] = usePc(dests[0] ? dests[0].id : "");
  return (
    <PcfgModalScrim onClose={onClose}>
      <button type="button" className="pcfg-modal-close" aria-label="Close" onClick={onClose}>
        <Icon name="X" size={18} />
      </button>
      <div className="pcfg-modal-body">
        <h2 className="pcfg-modal-title">Move {selectedIds.length} agency contract{selectedIds.length === 1 ? "" : "s"}</h2>
        <p className="pcfg-modal-text">From <b>{sourceConfig.name}</b> to:</p>
        <div className="pcfg-field">
          <select
            className="pcfg-select"
            value={destId}
            onChange={(e) => setDestId(e.target.value)}
            style={{ width: "100%", height: 38 }}
          >
            {dests.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </div>
        <div className="pcfg-impact-grid" style={{ marginTop: 16 }}>
          <div className="pcfg-impact-stat">
            <span className="pcfg-impact-stat-h">Contracts</span>
            <b className="tabular">{selectedIds.length}</b>
          </div>
          <div className="pcfg-impact-stat">
            <span className="pcfg-impact-stat-h">Source</span>
            <b>{sourceConfig.name}</b>
          </div>
          <div className="pcfg-impact-stat">
            <span className="pcfg-impact-stat-h">Destination</span>
            <b>{(dests.find((d) => d.id === destId) || {}).name || "—"}</b>
          </div>
        </div>
      </div>
      <div className="pcfg-modal-footer">
        <button type="button" className="pcfg-btn pcfg-btn--secondary" onClick={onClose}>Cancel</button>
        <button
          type="button"
          className="pcfg-btn pcfg-btn--primary"
          onClick={() => {
            const dest = getPcfgStore().find((c) => c.id === destId);
            if (!dest) return;
            const moved = sourceConfig.agencies.filter((a) => selectedIds.includes(a.id));
            const nextAgencies = [...dest.agencies, ...moved];
            upsertPcfg({ ...dest, agencies: nextAgencies, agencyCount: nextAgencies.length });
            if (window.showToast) window.showToast(`Moved ${moved.length} contract${moved.length === 1 ? "" : "s"} to ${dest.name}`, { kind: "success" });
            onMoved && onMoved();
          }}
        >Move</button>
      </div>
    </PcfgModalScrim>
  );
}

// ---------- Page wrapper (manages sub-views) ---------------------------
function PricingConfigPage() {
  // "list" | "details" | "new" | "edit"
  const [view, setView] = usePc("list");
  const [activeId, setActiveId] = usePc(null);
  const [reloadKey, setReloadKey] = usePc(0);

  // The "New configuration" CTA lives in the shared Settings omnibar
  // (rendered by SettingsPage). It can't reach this component's view
  // state directly, so it dispatches a window event we listen for here.
  useEffectPc(() => {
    const onNewConfig = () => setView("new");
    window.addEventListener("pcfg:new-config", onNewConfig);
    return () => window.removeEventListener("pcfg:new-config", onNewConfig);
  }, []);

  return (
    <div className="pcfg-shell" key={reloadKey}>
      {view === "list" && (
        <PricingConfigList
          onOpenRow={(id) => { setActiveId(id); setView("details"); }}
          onNew={() => setView("new")}
          onReload={() => setReloadKey((k) => k + 1)}
        />
      )}
      {view === "details" && (
        <PricingConfigDetails
          configId={activeId}
          onBack={() => { setActiveId(null); setView("list"); }}
          onEditStructure={(id) => { setActiveId(id); setView("edit"); }}
        />
      )}
      {(view === "new" || view === "edit") && window.PricingConfigWizard && (
        <window.PricingConfigWizard
          mode={view}
          configId={activeId}
          onClose={(savedId) => {
            if (savedId) { setActiveId(savedId); setView("details"); }
            else { setView(activeId ? "details" : "list"); }
          }}
        />
      )}
    </div>
  );
}

// =====================================================================
// v0.79 · A4 — Industry templates.
//
// Each template seeds a different `structure` for the New configuration
// wizard. The runtime engine is identical across templates; only the
// rule values + which rules are present change. Templates are pure
// functions over PCFG_DEFAULT_STRUCTURE so we never duplicate the rule
// shape.
// =====================================================================
const PCFG_INDUSTRY_TEMPLATES = [
  {
    id: "tpl-default",
    name: "Standard (default)",
    blurb: "Eight-group default. Use when no industry-specific tuning is required.",
    icon: "Briefcase",
    seed: () => PCFG_DEFAULT_STRUCTURE,
  },
  {
    id: "tpl-light-industrial",
    name: "Light industrial",
    blurb: "W-2 dominant · night + weekend premiums · FLSA OT after 40/week.",
    icon: "Truck",
    seed: () => PCFG_DEFAULT_STRUCTURE.map((g) => {
      if (g.id === "g4") return { ...g, rules: g.rules.map((r) => r.id === "r4-1"
        ? { ...r, fields: r.fields.map((f) => f.label === "Calculation" ? { ...f, value: "FICA 7.65% + FUTA 0.6% + state UI" } : f),
            primitive: { ...r.primitive, value: 11.5 }, scope: { countries: ["US"], currencies: ["USD"] } }
        : r) };
      if (g.id === "g7") return { ...g, rules: [] };
      return g;
    }),
  },
  {
    id: "tpl-healthcare",
    name: "Healthcare",
    blurb: "RN burden ≈ 32% · ICU / ED skill premiums · holiday pay 1.5×.",
    icon: "Plus",
    seed: () => PCFG_DEFAULT_STRUCTURE.map((g) => {
      if (g.id === "g4") return { ...g, rules: g.rules.map((r) => ({
        ...r, primitive: { ...r.primitive, value: 32 },
        fields: r.fields.map((f) => f.label === "Calculation" ? { ...f, value: "FICA + WC (clinical band) + benefits ≈ 32%" } : f),
      })) };
      return g;
    }),
  },
  {
    id: "tpl-prof-services",
    name: "Professional services",
    blurb: "1099 dominant · no employer burden · skill premiums on certifications.",
    icon: "Briefcase",
    seed: () => PCFG_DEFAULT_STRUCTURE.map((g) => {
      if (g.id === "g4") return { ...g, rules: [] };
      if (g.id === "g2") return { ...g, rules: [] };
      return g;
    }),
  },
  {
    id: "tpl-hospitality",
    name: "Hospitality",
    blurb: "Tipped wage minima · sub-minimum where statutory · weekend premium.",
    icon: "DrinkGlass",
    seed: () => PCFG_DEFAULT_STRUCTURE.map((g) => {
      if (g.id === "g4") return { ...g, rules: g.rules.map((r) => ({
        ...r, primitive: { ...r.primitive, value: 8.5 },
        fields: r.fields.map((f) => f.label === "Calculation" ? { ...f, value: "Tipped FICA + state UI ≈ 8.5%" } : f),
      })) };
      return g;
    }),
  },
];

Object.assign(window, {
  PricingConfigPage,
  PcfgStatusPill,
  PcfgModalScrim,
  PcfgEditNameModal,
  PcfgConfirmModal,
  PcfgStructureViewer,
  PCFG_DEFAULT_STRUCTURE,
  PCFG_INDUSTRY_TEMPLATES,
  rulesFromStructure,
  getPcfgStore, setPcfgStore, upsertPcfg,
});
