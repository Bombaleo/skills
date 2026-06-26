// =====================================================================
// Flex Work — Supplier Distribution
//
//   Global admin setting that controls *how requisitions are offered to
//   agency suppliers*. Two top-level strategies (per the brief):
//
//     • Tiering    — suppliers grouped in cascading tiers; the next tier
//                    is invited only after the previous tier's response
//                    window closes or fills up.
//     • Individual — each supplier has independent access rules (no
//                    cascade); useful for direct-engagement relationships.
//
//   A third mode (Broadcast) is included for completeness — it's the
//   "release to everyone at once, first-fill-wins" pattern common across
//   the VMS category.
//
//   Underneath the strategy choice we expose a comprehensive set of
//   *rules* drawn from best-in-class VMS:
//     · Submission rules    — submittal caps, lock-on-first-submit,
//                              response windows, auto-fill, rehire blocks
//     · Release schedule    — business-hours-only, days-of-week, quiet
//                              hours (prevents 3 AM SMS blasts).
//     · Performance         — fill-rate-weighted promotion, right of
//                              first refusal for top supplier, diversity
//                              targets.
//     · Exclusions          — job categories or specific suppliers a
//                              tier cannot touch.
//     · Notifications       — channel + reminder cadence.
//
//   Everything saved here is the *organization-wide default*. The same
//   form is rendered (in summary or editable form) on Entity / Sector /
//   Division / Location / Cost Center pages so admins can override at any
//   level of the org tree.
// =====================================================================

const { useState: useStateDx, useMemo: useMemoDx, useEffect: useEffectDx, useRef: useRefDx, useCallback: useCallbackDx } = React;

// ---------- Mock data ---------------------------------------------------
const DX_SUPPLIER_ORDER = ["sw", "gs", "th", "ph", "ss"];

// Supplier-type meta for the "Distribution access" picker. Each entry
// describes one of the four supplier-type targets a requisition can be
// distributed to. The ordered key list in GLOBAL_DEFAULTS.supplierTypes
// controls (a) which types appear on the create-req picker by default
// and (b) the cascade order — first type gets access first; subsequent
// types fall through when the previous one's window elapses without a
// fill. Hidden entirely on intake when the org only has Agency enabled.
const SUPPLIER_TYPE_META = {
  Agency: {
    key: "Agency",
    label: "Agency",
    icon: "Building",
    glyph: "A",
    blurb: "Staffing supplier under MSA. Sources, employs, and bills for the worker.",
    flagKey: null,        // always-on; no flag controls it
  },
  IndependentContractor: {
    key: "IndependentContractor",
    label: "Contractors",
    icon: "PersonAuthorize",
    glyph: "C",
    blurb: "Direct 1099 / IC. Buyer sources and contracts the worker; no supplier in the middle.",
    flagKey: "independentContractor",
  },
  EOR: {
    key: "EOR",
    label: "EOR",
    icon: "Globe",
    glyph: "E",
    blurb: "Employer-of-Record for cross-border work. In-country partner is the legal employer.",
    flagKey: "eor",
  },
  Float: {
    key: "Float",
    label: "Float",
    icon: "Refresh",
    glyph: "F",
    blurb: "Buyer's own internal cross-site workers (per-diem nurses, banquet flex staff).",
    flagKey: "float",
  },
};
const SUPPLIER_TYPE_ORDER = ["Agency", "IndependentContractor", "EOR", "Float"];

// Wait-time options for the cascade. "Immediate" = no delay — the type
// gets access the moment the requisition is published. Subsequent waits
// delay invitation until the listed elapsed time, giving earlier tiers
// exclusive first-look. Designed to read the same way to admins and
// buyers — short list, T-shirt-feeling labels.
const WAIT_OPTIONS = ["Immediate", "5 min", "15 min", "30 min", "1 hour", "2 hours", "4 hours", "24 hours"];

// Default cascade waits per slot — first slot is always Immediate; the
// rest grow with rank so the picker feels intuitive ("wait, then wait
// longer"). Seeded into entries that lack an explicit wait.
const DEFAULT_WAITS = ["Immediate", "30 min", "1 hour", "2 hours"];

// Resolve the supplier-types this org is allowed to use, in canonical
// order. Reads from window.getSupplierTypeConfig() (per-org store) and
// falls back to Agency-only when that hasn't loaded yet.
function getEnabledSupplierTypeKeys() {
  const cfg = (window.getSupplierTypeConfig && window.getSupplierTypeConfig()) || {};
  const out = ["Agency"];
  if (cfg.independentContractor) out.push("IndependentContractor");
  if (cfg.eor)                   out.push("EOR");
  if (cfg.float)                 out.push("Float");
  return out;
}

// Normalize an arbitrary supplierTypes input (legacy string[], rich
// obj[], or null) to canonical [{key, active, wait}]. Drops keys not
// in `allowedKeys` so a stale draft can't point at a now-disabled
// supplier type. Seeds active=true + a sensible wait when missing.
function normalizeSupplierTypes(input, allowedKeys) {
  const allowed = allowedKeys || getEnabledSupplierTypeKeys();
  const allowedSet = new Set(allowed);
  const arr = Array.isArray(input) ? input : [];
  const seen = new Set();
  const out = [];
  arr.forEach((entry, i) => {
    const key = typeof entry === "string" ? entry : (entry && entry.key);
    if (!key || !allowedSet.has(key) || seen.has(key)) return;
    seen.add(key);
    const active = typeof entry === "object" && "active" in entry ? !!entry.active : true;
    const wait = (typeof entry === "object" && entry.wait) || DEFAULT_WAITS[i] || "1 hour";
    out.push({ key, active, wait });
  });
  // If no valid entries survived, seed from allowed defaults.
  if (out.length === 0) {
    allowed.forEach((key, i) => out.push({ key, active: true, wait: DEFAULT_WAITS[i] || "1 hour" }));
  }
  // Ensure the first ACTIVE entry has wait "Immediate" so the cascade
  // always starts at t=0.
  const firstActiveIdx = out.findIndex((e) => e.active);
  if (firstActiveIdx >= 0) out[firstActiveIdx].wait = "Immediate";
  return out;
}

const GLOBAL_DEFAULTS = {
  strategy: "tiering",
  // Distribution-targets axis · ordered list of supplier types this
  // org's requisitions distribute to by default. Each entry carries:
  //   { key, active, wait }
  // · key    — supplier type id (Agency / IndependentContractor / EOR / Float)
  // · active — included in the cascade. Inactive entries stay in the
  //   list (so admins can park a type without losing its config) but
  //   don't receive requisitions.
  // · wait   — time to wait before this type gains access. "Immediate"
  //   = invited at t=0 (the first active entry is always Immediate);
  //   subsequent entries delay invitation by the listed elapsed time,
  //   giving earlier tiers exclusive first-look.
  // Admins can re-order, toggle, or change wait times here; buyers can
  // override per-requisition.
  //
  // Pre-seeded with all four canonical supplier-type keys in cascade
  // order so the Distribution access card shows a complete picture even
  // when an org has just turned a type on — the page filters to actually
  // enabled types at render time (see SupplierDistributionForm's
  // `mergedSupplierTypes`). Default cascade waits follow DEFAULT_WAITS:
  // first slot Immediate, then 30 min, 1 hour, 2 hours.
  supplierTypes: [
    { key: "Agency",                 active: true, wait: "Immediate" },
    { key: "IndependentContractor",  active: true, wait: "30 min"    },
    { key: "EOR",                    active: true, wait: "1 hour"    },
    { key: "Float",                  active: true, wait: "2 hours"   },
  ],
  tiers: [
    { id: "t1", name: "Tier 1 · Preferred", suppliers: ["sw", "gs"], window: "30 min",   escalate: true,  hold: false },
    { id: "t2", name: "Tier 2 · Approved",  suppliers: ["th", "ph"], window: "2 hours",  escalate: true,  hold: false },
    { id: "t3", name: "Tier 3 · Backup",    suppliers: ["ss"],       window: "24 hours", escalate: false, hold: true  },
  ],
  individual: [
    { supplier: "sw", access: "All requisitions", submittalCap: 3, workerCap: 10, responseWindow: "30 min",  primary: true,  enabled: true  },
    { supplier: "gs", access: "All requisitions", submittalCap: 3, workerCap: 8,  responseWindow: "30 min",  primary: false, enabled: true  },
    { supplier: "th", access: "Specialized only", submittalCap: 2, workerCap: 6,  responseWindow: "1 hour",  primary: false, enabled: true  },
    { supplier: "ph", access: "All requisitions", submittalCap: 2, workerCap: 5,  responseWindow: "2 hours", primary: false, enabled: true  },
    { supplier: "ss", access: "Backup only",      submittalCap: 1, workerCap: 3,  responseWindow: "4 hours", primary: false, enabled: false },
  ],
  submittalCap: 3,
  responseWindow: "30 min",
  // How worker demand is split across suppliers when a requisition is created.
  //   "percent"  → each supplier receives a fixed % share of total demand
  //   "count"    → an explicit worker count is set per supplier
  //   "variable" → the platform varies the share automatically (cascade /
  //                performance-weighted) based on real-time fill behaviour
  distributionMethod: "count",
  lockOnFirstSubmit: false,
  autoFill: false,
  blockRehires: true,
  rehireWindow: "90 days",
  businessHoursOnly: true,
  releaseStart: "6:00 AM",
  releaseEnd:   "8:00 PM",
  releaseDays:  ["Mon", "Tue", "Wed", "Thu", "Fri"],
  performanceWeighted: true,
  performanceThreshold: 85,
  rofrEnabled: true,
  rofrSupplier: "sw",
  rofrWindow: "15 min",
  excludedJobs: [],
  excludedSuppliers: [],
  channels: ["Email", "In-app"],
  reminderCadence: "Every 10 min",
};

// Overrides currently active at lower org levels.
const OVERRIDES = [
  { id: "loc-647",  segment: "Locations",    name: "Manufacturing Site #647",   strategy: "tiering",    summary: "Custom Tier 1 (StaffWise only) · 15-min cascade",  editedBy: "Nia Thompson", editedAt: "2 weeks ago" },
  { id: "loc-dca",  segment: "Locations",    name: "Distribution Center Alpha", strategy: "individual", summary: "Direct-engagement w/ StaffWise & GoodShift only",  editedBy: "Marcus Webb",  editedAt: "1 month ago" },
  { id: "sec-02",   segment: "Sectors",      name: "Logistics",                 strategy: "tiering",    summary: "Same as global, ROFR disabled",                    editedBy: "Priya Ramesh", editedAt: "3 days ago"  },
  { id: "div-west", segment: "Divisions",    name: "West region",               strategy: "broadcast",  summary: "First-fill-wins, 4-hour window",                   editedBy: "Sami Soto",    editedAt: "5 days ago"  },
  { id: "cc-h05",   segment: "Cost Centers", name: "Hub #05",                   strategy: "individual", summary: "TempMatch as exclusive supplier",                  editedBy: "Jamal Carter", editedAt: "Last week"   },
];

const ORG_OVERRIDE_FOR = (id) => OVERRIDES.find((o) => o.id === id) || null;

// ---------- Constants ---------------------------------------------------
const STRATEGY_META = {
  tiering: {
    label: "Tiered cascade",
    short: "Tiering",
    icon: "Stack",
    blurb: "Suppliers grouped in tiers. The next tier is only invited after the previous tier's response window closes.",
  },
  individual: {
    label: "Individual access",
    short: "Individual",
    icon: "Users",
    blurb: "Each supplier configured separately with its own response window and caps. No automatic cascade.",
  },
  broadcast: {
    label: "Broadcast",
    short: "Broadcast",
    icon: "Broadcast",
    blurb: "Every eligible supplier sees the requisition at the same moment. First qualified submittal wins.",
  },
};

const RESPONSE_WINDOWS = ["15 min", "30 min", "1 hour", "2 hours", "4 hours", "24 hours"];
const ACCESS_LEVELS    = ["All requisitions", "Specialized only", "Backup only", "Excluded"];
const REMINDER_CADENCE = ["No reminders", "Every 5 min", "Every 10 min", "Every 30 min", "Hourly"];
const REHIRE_WINDOWS   = ["30 days", "60 days", "90 days", "6 months", "1 year"];
const DAYS_OF_WEEK     = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const NOTIFY_CHANNELS  = ["Email", "SMS", "In-app", "Slack"];
const JOB_CATEGORIES   = ["Production Associate", "Line Manager", "Picker", "Warehouse Clerk", "Factory Line Assembler", "Forklift Operator", "Driver"];

// =====================================================================
// Sub-components
// =====================================================================

// ---------- Strategy picker — 3 selectable visual cards ----------------
function StrategyCard({ kind, active, onClick }) {
  const meta = STRATEGY_META[kind];
  return (
    <button
      type="button"
      className={"dx-strategy" + (active ? " dx-strategy--active" : "")}
      aria-pressed={active}
      onClick={onClick}
    >
      <span className="dx-strategy-head">
        <span className="dx-strategy-icon" aria-hidden="true">
          <Icon name={meta.icon} size={20} />
        </span>
        <span className="dx-strategy-title">{meta.label}</span>
        <span className={"dx-strategy-check" + (active ? " dx-strategy-check--on" : "")} aria-hidden="true">
          {active && <Icon name="Check" size={14} />}
        </span>
      </span>
      <span className="dx-strategy-diagram" aria-hidden="true">
        <StrategyDiagram kind={kind} />
      </span>
      <span className="dx-strategy-blurb">{meta.blurb}</span>
    </button>
  );
}

function StrategyDiagram({ kind }) {
  // Tiny CSS/SVG diagrams to make the choice instantly readable.
  if (kind === "tiering") {
    return (
      <span className="dx-diag dx-diag--tiering">
        {[1,2,3].map((i) => (
          <span key={i} className="dx-diag-tier" style={{ width: `${100 - (i-1)*18}%` }}>
            <span className="dx-diag-pill" />
            <span className="dx-diag-pill" />
            {i === 1 && <span className="dx-diag-pill" />}
          </span>
        ))}
      </span>
    );
  }
  if (kind === "individual") {
    return (
      <span className="dx-diag dx-diag--ind">
        {[0,1,2,3].map((i) => (
          <span key={i} className="dx-diag-lane">
            <span className="dx-diag-pill" />
            <span className="dx-diag-line" />
            <span className="dx-diag-dot" />
          </span>
        ))}
      </span>
    );
  }
  return (
    <span className="dx-diag dx-diag--bc">
      <span className="dx-diag-hub" />
      {[0,1,2,3,4,5].map((i) => (
        <span key={i} className="dx-diag-ray" style={{ transform: `rotate(${i * 60}deg) translateX(28px)` }} />
      ))}
    </span>
  );
}

// ---------- Inline labelled control row -------------------------------
function DxRow({ label, hint, control, last }) {
  return (
    <div className={"dx-row" + (last ? " dx-row--last" : "")}>
      <div className="dx-row-text">
        <span className="dx-row-label">{label}</span>
        {hint && <span className="dx-row-hint">{hint}</span>}
      </div>
      <div className="dx-row-control">{control}</div>
    </div>
  );
}

// ---------- Compact pill select used inline in tier rows --------------
function DxSelectInline({ value, options, onChange, width = 132, disabled = false, placeholder }) {
  // Pill-style select: visible label text + chevron, with a transparent
  // native <select> overlaid for keyboard + native picker behaviour. Falls
  // back to a placeholder when value is empty so admins see what's
  // missing instead of a blank pill.
  const display = (value === undefined || value === null || value === "") ? (placeholder || "Select…") : value;
  const isEmpty = (value === undefined || value === null || value === "");
  return (
    <span
      className={"dx-select-inline" + (disabled ? " dx-select-inline--disabled" : "") + (isEmpty ? " dx-select-inline--empty" : "")}
      style={{ width }}
    >
      <span className="dx-select-value" title={String(display)}>{display}</span>
      <Icon name="ChevronDown" size={14} />
      <select
        className="dx-select-native"
        value={value || ""}
        onChange={(e) => onChange && onChange(e.target.value)}
        disabled={disabled}
        aria-label={typeof display === "string" ? display : undefined}
      >
        {isEmpty && <option value="" disabled>{placeholder || "Select…"}</option>}
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </span>
  );
}

// ---------- Tier row — supplier chips + window + actions --------------
function TierRow({ tier, index, total, onRename, onWindow, onEscalate, onRemove, onAddSupplier, onRemoveSupplier, onMove }) {
  return (
    <div className="dx-tier">
      <div className="dx-tier-head">
        <span className="dx-tier-badge">{index + 1}</span>
        <input
          className="dx-tier-name"
          value={tier.name}
          onChange={(e) => onRename(tier.id, e.target.value)}
          aria-label={`Tier ${index + 1} name`}
        />
        <div className="dx-tier-head-actions">
          <button
            type="button"
            className="iconbtn"
            aria-label="Move tier up"
            disabled={index === 0}
            onClick={() => onMove(tier.id, -1)}
          >
            <Icon name="ChevronUp" size={16} />
          </button>
          <button
            type="button"
            className="iconbtn"
            aria-label="Move tier down"
            disabled={index === total - 1}
            onClick={() => onMove(tier.id, 1)}
          >
            <Icon name="ChevronDown" size={16} />
          </button>
          <button
            type="button"
            className="iconbtn"
            aria-label="More tier actions"
            onClick={(e) => openMenu(e.currentTarget, [
              { icon: "Edit",     label: "Rename tier",        onClick: () => showToast("Click the title to rename") },
              { icon: "Copy",     label: "Duplicate tier",     onClick: () => showToast(`${tier.name} duplicated`) },
              { divider: true },
              { icon: "TrashCan", label: "Remove tier", danger: true,
                onClick: () => openConfirm({
                  title: `Remove ${tier.name}?`,
                  body: "Suppliers in this tier will no longer be invited. Pending requisitions are not affected.",
                  primaryLabel: "Remove",
                  primaryKind: "primary",
                  onConfirm: () => { onRemove(tier.id); showToast(`${tier.name} removed`, { kind: "success" }); },
                }) },
            ])}
          >
            <Icon name="MoreVert" size={16} />
          </button>
        </div>
      </div>

      <div className="dx-tier-body">
        <div className="dx-tier-suppliers">
          {tier.suppliers.length === 0 && (
            <span className="dx-tier-empty">No suppliers in this tier yet.</span>
          )}
          {tier.suppliers.map((sid) => {
            const meta = REQ_SUPPLIERS[sid];
            return (
              <span key={sid} className="dx-supplier-chip">
                <ReqSupplierChip id={sid} size={20} />
                <span>{meta?.label || sid}</span>
                <button
                  type="button"
                  className="dx-supplier-chip-x"
                  aria-label={`Remove ${meta?.label || sid}`}
                  onClick={() => onRemoveSupplier(tier.id, sid)}
                >
                  <Icon name="X" size={10} />
                </button>
              </span>
            );
          })}
          <button
            type="button"
            className="dx-add-supplier"
            onClick={(e) => {
              const remaining = DX_SUPPLIER_ORDER.filter((s) => !tier.suppliers.includes(s));
              if (remaining.length === 0) {
                showToast("All suppliers are already in this tier");
                return;
              }
              openMenu(e.currentTarget, remaining.map((sid) => ({
                icon: "AddCircle",
                label: REQ_SUPPLIERS[sid]?.label || sid,
                onClick: () => onAddSupplier(tier.id, sid),
              })));
            }}
          >
            <Icon name="AddCircle" size={14} />
            Add supplier
          </button>
        </div>

        <div className="dx-tier-rules">
          <span className="dx-tier-rule">
            <Icon name="Hourglass" size={14} />
            <span>Window</span>
            <DxSelectInline
              value={tier.window}
              options={[...RESPONSE_WINDOWS, "—"]}
              onChange={(v) => onWindow(tier.id, v)}
              width={108}
            />
          </span>
          <span className="dx-tier-rule">
            <span>Auto-escalate</span>
            <Switch
              checked={tier.escalate}
              onChange={(v) => onEscalate(tier.id, v)}
              ariaLabel="Auto-escalate to next tier"
            />
          </span>
        </div>
      </div>

      {index < total - 1 && (
        <div className="dx-tier-arrow" aria-hidden="true">
          <Icon name="ChevronDown" size={18} />
          {tier.escalate
            ? <span className="dx-tier-arrow-label">Cascades after {tier.window}</span>
            : <span className="dx-tier-arrow-label dx-tier-arrow-label--off">Manual escalation only</span>}
        </div>
      )}
    </div>
  );
}

// ---------- Per-supplier row (Individual strategy) --------------------
function IndividualRow({ row, onChange }) {
  const meta = REQ_SUPPLIERS[row.supplier];
  return (
    <div className={"dx-ind-row" + (row.enabled ? "" : " dx-ind-row--off")}>
      <span className="dx-ind-cell dx-ind-cell--name">
        <Switch
          checked={row.enabled}
          onChange={(v) => onChange({ ...row, enabled: v })}
          ariaLabel={`Enable ${meta?.label}`}
        />
        <ReqSupplierChip id={row.supplier} size={28} />
        <span className="dx-ind-name">{meta?.label || row.supplier}</span>
        {row.primary && (
          <span className="dx-ind-primary" title="Right of first refusal">
            <Icon name="Pin" size={12} />Primary
          </span>
        )}
      </span>
      <span className="dx-ind-cell">
        <DxSelectInline
          value={row.access}
          options={ACCESS_LEVELS}
          onChange={(v) => onChange({ ...row, access: v })}
          width={148}
        />
      </span>
      <span className="dx-ind-cell">
        <DxSelectInline
          value={row.responseWindow}
          options={RESPONSE_WINDOWS}
          onChange={(v) => onChange({ ...row, responseWindow: v })}
          width={108}
        />
      </span>
      <span className="dx-ind-cell dx-ind-cell--num">
        <input
          className="dx-num"
          type="number"
          min="1"
          max="20"
          value={row.submittalCap}
          onChange={(e) => onChange({ ...row, submittalCap: +e.target.value })}
        />
      </span>
      <span className="dx-ind-cell dx-ind-cell--num">
        <input
          className="dx-num"
          type="number"
          min="0"
          max="100"
          value={row.workerCap}
          onChange={(e) => onChange({ ...row, workerCap: +e.target.value })}
        />
      </span>
      <span className="dx-ind-cell dx-ind-cell--actions">
        <button
          type="button"
          className="iconbtn"
          aria-label={`More actions for ${meta?.label}`}
          onClick={(e) => openMenu(e.currentTarget, [
            { icon: "Pin", label: row.primary ? "Remove primary" : "Make primary",
              onClick: () => onChange({ ...row, primary: !row.primary }) },
            { icon: "Edit",  label: "Edit supplier rules",
              onClick: () => showToast(`Editing detailed rules for ${meta?.label}`) },
            { divider: true },
            { icon: "Cancel", label: row.enabled ? "Disable supplier" : "Enable supplier",
              danger: row.enabled,
              onClick: () => onChange({ ...row, enabled: !row.enabled }) },
          ])}
        >
          <Icon name="MoreVert" size={16} />
        </button>
      </span>
    </div>
  );
}

// ---------- Day-of-week pill picker -----------------------------------
function DayPills({ value, onChange }) {
  return (
    <div className="dx-days">
      {DAYS_OF_WEEK.map((d) => {
        const on = value.includes(d);
        return (
          <button
            key={d}
            type="button"
            className={"dx-day" + (on ? " dx-day--on" : "")}
            aria-pressed={on}
            onClick={() => onChange(on ? value.filter((x) => x !== d) : [...value, d])}
          >
            {d}
          </button>
        );
      })}
    </div>
  );
}

// ---------- Multi-chip tags (with autocomplete-ish menu) --------------
function ChipTags({ value, onChange, options, placeholder }) {
  return (
    <div className="dx-chiptags">
      <div className="dx-chiptags-input">
        {value.length === 0 && (
          <span className="dx-chiptags-placeholder">{placeholder}</span>
        )}
        {value.map((v) => (
          <span key={v} className="tag">
            {v}
            <button
              type="button"
              className="tag-x"
              aria-label={`Remove ${v}`}
              onClick={() => onChange(value.filter((x) => x !== v))}
            >
              <Icon name="X" size={10} />
            </button>
          </span>
        ))}
        <button
          type="button"
          className="dx-chiptags-add"
          onClick={(e) => {
            const remaining = options.filter((o) => !value.includes(o));
            if (remaining.length === 0) { showToast("All options already added"); return; }
            openMenu(e.currentTarget, remaining.map((o) => ({
              icon: "AddCircle", label: o, onClick: () => onChange([...value, o]),
            })));
          }}
        >
          <Icon name="AddCircle" size={14} />Add
        </button>
      </div>
    </div>
  );
}

// ---------- Channel multi-select (chip group) -------------------------
function ChannelGroup({ value, onChange }) {
  return (
    <div className="dx-chans">
      {NOTIFY_CHANNELS.map((c) => {
        const on = value.includes(c);
        return (
          <button
            type="button"
            key={c}
            className={"dx-chan" + (on ? " dx-chan--on" : "")}
            aria-pressed={on}
            onClick={() => onChange(on ? value.filter((x) => x !== c) : [...value, c])}
          >
            <span className={"dx-chan-check" + (on ? " dx-chan-check--on" : "")} aria-hidden="true">
              {on && <Icon name="Check" size={11} />}
            </span>
            {c}
          </button>
        );
      })}
    </div>
  );
}

Object.assign(window, {
  OVERRIDES, ORG_OVERRIDE_FOR, STRATEGY_META, GLOBAL_DEFAULTS,
  SUPPLIER_TYPE_META, SUPPLIER_TYPE_ORDER, getEnabledSupplierTypeKeys,
  normalizeSupplierTypes, WAIT_OPTIONS, DEFAULT_WAITS,
});

// Seed GLOBAL_DEFAULTS.supplierTypes from the per-org supplier-type
// config so the create-req picker inherits whatever the admin has
// enabled in Settings → Configuration → Supplier types. Runs at load
// AND on every `featureflags:change` so an admin toggle re-seeds the
// default for the next create-req session without a reload.
function _seedDistroSupplierTypes() {
  // Build the canonical list: every enabled type, in canonical order,
  // preserving whatever wait/active the admin previously saved. New
  // types (e.g. admin just enabled EOR) join as active with a sensible
  // default wait. Removed types drop out.
  const enabled = getEnabledSupplierTypeKeys();
  const prevByKey = {};
  (GLOBAL_DEFAULTS.supplierTypes || []).forEach((e) => {
    const key = typeof e === "string" ? e : (e && e.key);
    if (key) prevByKey[key] = e;
  });
  const merged = enabled.map((key, i) => {
    const prev = prevByKey[key];
    if (prev && typeof prev === "object") {
      return { key, active: prev.active !== false, wait: prev.wait || DEFAULT_WAITS[i] || "1 hour" };
    }
    return { key, active: true, wait: DEFAULT_WAITS[i] || "1 hour" };
  });
  GLOBAL_DEFAULTS.supplierTypes = normalizeSupplierTypes(merged, enabled);
}
_seedDistroSupplierTypes();
window.addEventListener("featureflags:change", _seedDistroSupplierTypes);
