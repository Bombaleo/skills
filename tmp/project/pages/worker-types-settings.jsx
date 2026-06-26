// =====================================================================
// Flex Work — Settings → Worker Types
//   Admin page for configuring the worker types Flex Work supports on
//   this tenant. The Frontline (Agency) worker type ships always; the
//   others (Professional, Contractors, SOW Resources) are gated by
//   feature flags and only render when their flag is on.
//
//   The "Worker types" admin: per-type cadences, agreement templates,
//   approval thresholds, classification policy, and document defaults.
//
//   This page never *enables* a worker type — that happens via
//   Settings → Feature Flags. Here, admins configure the type once it's
//   already on.
// =====================================================================

const { useState: useStateWt, useMemo: useMemoWt } = React;

// ---------- Type definitions -----------------------------------------
const WORKER_TYPES = [
  {
    id: "frontline",
    label: "Frontline",
    flag: null, // always on
    summary:
      "Shift-based agency engagements sourced through staffing suppliers. Hourly bill rate, schedule, timesheets.",
    icon: "PersonClock",
    color: "blue",
    dataMap: "Employee + workerType = Contingent + sourcingChannel = Agency",
  },
  {
    id: "professional",
    label: "Professional",
    flag: "professionalWork",
    summary:
      "Permanent SOW engagements with no end date. Filled through an interview pipeline. Billed on a weekly / monthly / annual cadence regardless of hours.",
    icon: "Briefcase",
    color: "blue",
    dataMap: "Employee + workerType = Professional + sourcingChannel = SOW",
  },
  {
    id: "contractors",
    label: "Contractors",
    flag: "contractors",
    summary:
      "Independent contractors (1099 / IC) sourced directly by the buyer. Sign their own MSA + SOW.",
    icon: "PersonAuthorize",
    color: "purple",
    dataMap: "Employee + workerType = Contractor + sourcingChannel = Direct",
  },
  {
    id: "sow",
    label: "SOW Resources",
    flag: "sow",
    summary:
      "Supplier-managed resources executing under an active SOW. Roster-level visibility only — no schedule, no rate, no timesheet.",
    icon: "Notes",
    color: "teal",
    dataMap: "Employee + workerType = Contingent + engagementRef = SOW id",
  },
];

// ---------- Per-type default config sample ---------------------------
// Real product would persist this in tenant settings. Sample shape so
// the UI reads complete.
const DEFAULT_PRO_CONFIG = {
  cadences: { weekly: true, monthly: true, annual: true },
  defaultCadence: "monthly",
  sowTemplates: [
    { id: "tpl-perm",  label: "MSA + SOW · Permanent",         defaultFor: "monthly" },
    { id: "tpl-12mo",  label: "MSA + SOW · 12-month renewable", defaultFor: "annual" },
    { id: "tpl-ff",    label: "MSA + SOW · Fixed-fee project",   defaultFor: null     },
    { id: "tpl-tm",    label: "MSA + SOW · T&M capped",          defaultFor: "weekly" },
  ],
  approvers: [
    { id: "hm",  role: "Hiring manager",       required: true,  threshold: null },
    { id: "dh",  role: "Department head",      required: true,  threshold: null },
    { id: "fin", role: "Finance partner",      required: true,  threshold: 100000 },
    { id: "leg", role: "Legal · MSA review",   required: true,  threshold: null },
    { id: "rec", role: "Recruiting · sign-off", required: true, threshold: null },
    { id: "ceo", role: "CEO · executive",       required: false, threshold: 500000 },
  ],
  classification: {
    requireBackgroundCheck: true,
    backgroundTier: "Tier 1",
    requireRefCheck: true,
    requireConflictDisclosure: true,
  },
  documents: {
    msa:      { required: true,  signers: ["Vendor Ops"] },
    sow:      { required: true,  signers: ["Hiring manager", "Vendor Ops"] },
    nda:      { required: true,  signers: ["Worker"] },
    ip:       { required: true,  signers: ["Worker"] },
  },
  renewal: {
    autoRenewMonths: 12,
    noticeDays: 30,
    warningDays: 90,
  },
};

// =====================================================================
// Page
// =====================================================================
function WorkerTypesSettingsPage() {
  // Visible types: Frontline always; the others only when their flag
  // is on. When a type's flag is off, it still appears as a *disabled*
  // row so admins can see what's available — clicking the row prompts
  // them to enable the flag.
  const flags = {
    professional: window.useFeatureFlag ? window.useFeatureFlag("professionalWork") : false,
    contractors:  window.useFeatureFlag ? window.useFeatureFlag("contractors")      : false,
    sow:          window.useFeatureFlag ? window.useFeatureFlag("sow")              : false,
  };
  const v77On = window.useFeatureFlag ? window.useFeatureFlag("v77Axes") : false;
  const isOn = (t) => {
    if (!t.flag) return true;
    if (t.flag === "professionalWork") return flags.professional;
    if (t.flag === "contractors")      return flags.contractors;
    if (t.flag === "sow")              return flags.sow;
    return false;
  };

  const [active, setActive] = useStateWt("professional");
  const activeType = useMemoWt(() => WORKER_TYPES.find((t) => t.id === active) || WORKER_TYPES[0], [active]);
  const activeOn = isOn(activeType);

  return (
    <div className="wt-page">
      <header className="set-content-header">
        <h2 className="set-content-title">Worker Types</h2>
        <p className="set-content-sub">
          Configure the worker types this tenant uses — cadences, agreement templates, approval thresholds, classification policy, and required documents.
          Each type's availability is controlled by its feature flag.
        </p>
      </header>

      {/* v0.77 14-cell matrix · spec §17. Gated by v77Axes (which derives
          from any axis-extending flag being on) so flag-off DOM is
          byte-identical to today. The grid is informational at this
          stage — each cell shows its shipped/new/future state from
          spec §05; Phase 4 turns these into toggles. */}
      {v77On && <V77WorkerTypeMatrix />}

      <div className="wt-shell">
        {/* ---- Left rail: worker types ---- */}
        <nav className="wt-rail" aria-label="Worker types">
          <ul role="list">
            {WORKER_TYPES.map((t) => {
              const on = isOn(t);
              const isActive = t.id === active;
              return (
                <li key={t.id}>
                  <button
                    type="button"
                    className={"wt-rail-row" + (isActive ? " is-active" : "") + (on ? "" : " is-off")}
                    onClick={() => setActive(t.id)}
                    aria-current={isActive ? "page" : undefined}
                  >
                    <span className={`wt-rail-icon wt-rail-icon--${t.color}`}>
                      <Icon name={t.icon} size={16} />
                    </span>
                    <span className="wt-rail-main">
                      <span className="wt-rail-label">{t.label}</span>
                      <span className="wt-rail-status">
                        {on ? <span className="req-pill req-pill--success">Active</span> : <span className="req-pill req-pill--default">Off · flag disabled</span>}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* ---- Right pane: configuration for the active type ---- */}
        <section className="wt-pane">
          <header className="wt-pane-head">
            <div>
              <h3 className="wt-pane-title">
                <span className={`wt-rail-icon wt-rail-icon--${activeType.color}`} style={{ marginRight: 8 }}>
                  <Icon name={activeType.icon} size={18} />
                </span>
                {activeType.label}
                {activeOn
                  ? <span className="req-pill req-pill--success" style={{ marginLeft: 12 }}>Active</span>
                  : <span className="req-pill req-pill--default"  style={{ marginLeft: 12 }}>Off</span>}
              </h3>
              <p className="wt-pane-sub">{activeType.summary}</p>
              <p className="wt-pane-datamap"><b>Dayforce mapping:</b> <span className="tabular">{activeType.dataMap}</span></p>
            </div>
            {!activeOn && (
              <div className="wt-pane-flagoff" role="note">
                <Icon name="Information" size={14} />
                <span>This worker type is gated behind the <b>{activeType.flag}</b> feature flag. Enable it in <a href="#" onClick={(e) => { e.preventDefault(); if (window.flexGoTo) window.flexGoTo({ page: "settings", tab: "feature-flags" }); }}>Feature Flags</a> to start using it.</span>
              </div>
            )}
          </header>

          {/* ---- Frontline: read-only summary ---- */}
          {activeType.id === "frontline" && (
            <div className="wt-config">
              <WtSection title="Frontline behavior" subtitle="Ships always. Configured through the Pricing, Distribution, and Workflows surfaces, not here.">
                <ul className="wt-bullet">
                  <li>Hourly bill rate set by supplier contract per location and role.</li>
                  <li>Shifts scheduled through the Schedule surface; timesheets approved before invoicing.</li>
                  <li>Distribution rules in <b>Settings → Distribution</b> control which suppliers see each requisition.</li>
                  <li>Approval thresholds inherited from <b>Settings → Workflows</b>.</li>
                </ul>
              </WtSection>
            </div>
          )}

          {/* ---- Professional: full config ---- */}
          {activeType.id === "professional" && (
            <ProfessionalWorkerTypeConfig disabled={!activeOn} />
          )}

          {/* ---- Contractors: pointer ---- */}
          {activeType.id === "contractors" && (
            <div className="wt-config">
              <WtSection title="Classification policy" subtitle="Drives risk scoring on every contractor row.">
                <ul className="wt-bullet">
                  <li>IRS 20-factor + ABC test (CA AB5) on every contractor.</li>
                  <li>Misclassification re-review fires at 18-month tenure, &gt;35 hrs/week, or single-client exclusivity.</li>
                  <li>Year-end packet runs in January for every US filing entity.</li>
                </ul>
              </WtSection>
              <WtSection title="Agreement templates" subtitle="Per-country MSA + SOW + NDA + IP templates.">
                <ul className="wt-bullet">
                  <li>US, CA, GB, ES, DE, IN, BR, MX, SG, JP, AE, AU.</li>
                </ul>
              </WtSection>
            </div>
          )}

          {/* ---- SOW: pointer ---- */}
          {activeType.id === "sow" && (
            <div className="wt-config">
              <WtSection title="SOW behavior" subtitle="Configured through the SOW Templates and Workflows surfaces.">
                <ul className="wt-bullet">
                  <li>Fee schedules ride on the parent Supplier Contract.</li>
                  <li>Milestone acceptance fires the invoice — billing is event-based, not hours-based.</li>
                  <li>SOW resources appear in Workforce roster-only; no schedule, no rate, no timesheet.</li>
                </ul>
              </WtSection>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

// ---------- Reusable section card -------------------------------------
function WtSection({ title, subtitle, action, children }) {
  return (
    <section className="wt-section">
      <header className="wt-section-head">
        <div>
          <h4 className="wt-section-title">{title}</h4>
          {subtitle && <p className="wt-section-sub">{subtitle}</p>}
        </div>
        {action}
      </header>
      <div className="wt-section-body">{children}</div>
    </section>
  );
}

// ---------- Professional config sections -----------------------------
function ProfessionalWorkerTypeConfig({ disabled }) {
  const [cfg, setCfg] = useStateWt(DEFAULT_PRO_CONFIG);
  const setCadence = (id, on) => setCfg((c) => ({ ...c, cadences: { ...c.cadences, [id]: on } }));
  const setDefaultCadence = (id) => setCfg((c) => ({ ...c, defaultCadence: id }));
  const setApprover = (id, patch) => setCfg((c) => ({
    ...c,
    approvers: c.approvers.map((a) => a.id === id ? { ...a, ...patch } : a),
  }));
  const setClassif = (key, val) => setCfg((c) => ({ ...c, classification: { ...c.classification, [key]: val } }));
  const setRenewal = (key, val) => setCfg((c) => ({ ...c, renewal: { ...c.renewal, [key]: val } }));
  const setDoc = (id, patch) => setCfg((c) => ({ ...c, documents: { ...c.documents, [id]: { ...c.documents[id], ...patch } } }));

  return (
    <div className={"wt-config" + (disabled ? " is-disabled" : "")}>
      <WtSection
        title="Cadences"
        subtitle="Cadences hiring managers can choose for a Professional engagement."
      >
        <div className="wt-cadence-grid">
          {[
            { id: "weekly",  label: "Weekly",  hint: "Best for premium short-term placement (e.g. designers)" },
            { id: "monthly", label: "Monthly", hint: "Default. Best for senior individual contributors" },
            { id: "annual",  label: "Annual",  hint: "Best for executive / leadership roles" },
          ].map((c) => (
            <div key={c.id} className={"wt-cadence" + (cfg.cadences[c.id] ? " is-on" : "")}>
              <label className="wt-cadence-toggle">
                <input
                  type="checkbox"
                  checked={!!cfg.cadences[c.id]}
                  disabled={disabled}
                  onChange={() => setCadence(c.id, !cfg.cadences[c.id])}
                />
                <b>{c.label}</b>
              </label>
              <p className="wt-cadence-hint">{c.hint}</p>
              <label className="wt-cadence-default">
                <input
                  type="radio"
                  name="defaultCadence"
                  checked={cfg.defaultCadence === c.id}
                  disabled={disabled || !cfg.cadences[c.id]}
                  onChange={() => setDefaultCadence(c.id)}
                />
                <span>Default</span>
              </label>
            </div>
          ))}
        </div>
      </WtSection>

      <WtSection
        title="SOW templates"
        subtitle="Templates available when creating a Professional requisition or amendment."
        action={(
          <button type="button" className="btn btn--sm btn--secondary" disabled={disabled} onClick={() => showToast("Template editor opened (preview)")}>
            <Icon name="AddCircle" size={14} />Add template
          </button>
        )}
      >
        <div className="wt-table" role="table">
          <div className="wt-row wt-row--head" role="row">
            <span>Template</span>
            <span>Default for cadence</span>
            <span></span>
          </div>
          {cfg.sowTemplates.map((t) => (
            <div key={t.id} className="wt-row" role="row">
              <span><Icon name="File" size={14} />{t.label}</span>
              <span>{t.defaultFor ? <span className="pw-chip pw-chip--cadence">{t.defaultFor[0].toUpperCase() + t.defaultFor.slice(1)}</span> : <span className="wt-aside">—</span>}</span>
              <span style={{ textAlign: "right" }}>
                <button type="button" className="iconbtn iconbtn--sm" aria-label="More"
                  onClick={(e) => openMenu(e.currentTarget, [
                    { icon: "Edit",   label: "Edit template",     onClick: () => showToast(`${t.label} edited`) },
                    { icon: "Copy",   label: "Duplicate",         onClick: () => showToast(`${t.label} duplicated`) },
                    { icon: "Cancel", label: "Delete",  danger: true, onClick: () => showToast(`${t.label} deleted`) },
                  ])}
                ><Icon name="MoreVert" size={14} /></button>
              </span>
            </div>
          ))}
        </div>
      </WtSection>

      <WtSection
        title="Approval workflow"
        subtitle="Order of approvers and per-step thresholds. Threshold = engagement annualized value at which this step is required."
      >
        <div className="wt-table" role="table">
          <div className="wt-row wt-row--head wt-row--appr" role="row">
            <span>Step</span>
            <span>Role</span>
            <span>Required</span>
            <span>Threshold</span>
          </div>
          {cfg.approvers.map((a, i) => (
            <div key={a.id} className="wt-row wt-row--appr" role="row">
              <span className="tabular">{i + 1}</span>
              <span>{a.role}</span>
              <span>
                <label className="wt-switch">
                  <input
                    type="checkbox"
                    checked={!!a.required}
                    disabled={disabled}
                    onChange={() => setApprover(a.id, { required: !a.required })}
                  />
                  <span className="wt-switch-thumb" />
                </label>
              </span>
              <span>
                <input
                  type="number"
                  className="pro-input pro-input--narrow"
                  value={a.threshold == null ? "" : a.threshold}
                  disabled={disabled}
                  onChange={(e) => setApprover(a.id, { threshold: e.target.value === "" ? null : Number(e.target.value) })}
                  placeholder="—"
                />
                <span className="wt-aside" style={{ marginLeft: 6 }}>USD</span>
              </span>
            </div>
          ))}
        </div>
      </WtSection>

      <WtSection
        title="Classification &amp; checks"
        subtitle="Required at hire and at renewal."
      >
        <ul className="wt-toggle-list">
          <li>
            <label className="wt-switch">
              <input type="checkbox" disabled={disabled} checked={!!cfg.classification.requireBackgroundCheck} onChange={() => setClassif("requireBackgroundCheck", !cfg.classification.requireBackgroundCheck)} />
              <span className="wt-switch-thumb" />
            </label>
            <div>
              <b>Background check</b>
              <p>{cfg.classification.backgroundTier} run by tenant-of-record. Re-runs at renewal.</p>
            </div>
            <select className="pro-select pro-select--narrow" disabled={disabled || !cfg.classification.requireBackgroundCheck} value={cfg.classification.backgroundTier} onChange={(e) => setClassif("backgroundTier", e.target.value)}>
              <option>Tier 1</option>
              <option>Tier 2</option>
              <option>Tier 3</option>
            </select>
          </li>
          <li>
            <label className="wt-switch">
              <input type="checkbox" disabled={disabled} checked={!!cfg.classification.requireRefCheck} onChange={() => setClassif("requireRefCheck", !cfg.classification.requireRefCheck)} />
              <span className="wt-switch-thumb" />
            </label>
            <div>
              <b>Reference checks</b>
              <p>3 references collected at offer; 2 minimum to clear.</p>
            </div>
            <span></span>
          </li>
          <li>
            <label className="wt-switch">
              <input type="checkbox" disabled={disabled} checked={!!cfg.classification.requireConflictDisclosure} onChange={() => setClassif("requireConflictDisclosure", !cfg.classification.requireConflictDisclosure)} />
              <span className="wt-switch-thumb" />
            </label>
            <div>
              <b>Conflict of interest disclosure</b>
              <p>Signed annually at renewal.</p>
            </div>
            <span></span>
          </li>
        </ul>
      </WtSection>

      <WtSection
        title="Required documents"
        subtitle="Documents generated and counter-signed on every engagement."
      >
        <div className="wt-table" role="table">
          <div className="wt-row wt-row--head wt-row--doc" role="row">
            <span>Document</span>
            <span>Required</span>
            <span>Signers</span>
          </div>
          {Object.entries(cfg.documents).map(([id, d]) => (
            <div key={id} className="wt-row wt-row--doc" role="row">
              <span><Icon name="File" size={14} />{id.toUpperCase()}</span>
              <span>
                <label className="wt-switch">
                  <input type="checkbox" disabled={disabled} checked={!!d.required} onChange={() => setDoc(id, { required: !d.required })} />
                  <span className="wt-switch-thumb" />
                </label>
              </span>
              <span>{d.signers.join(" · ")}</span>
            </div>
          ))}
        </div>
      </WtSection>

      <WtSection
        title="Renewal policy"
        subtitle="Defaults applied to every new Professional engagement. Hiring managers can override per engagement."
      >
        <div className="wt-renewal-grid">
          <label className="pro-field">
            <span className="pro-field-label">Auto-renew length</span>
            <span className="pro-field-hint">Term in months. 12 is the industry default.</span>
            <input className="pro-input" type="number" disabled={disabled} value={cfg.renewal.autoRenewMonths} onChange={(e) => setRenewal("autoRenewMonths", Number(e.target.value || 0))} />
          </label>
          <label className="pro-field">
            <span className="pro-field-label">Notice window</span>
            <span className="pro-field-hint">Days before renewal that either party must give notice to opt out.</span>
            <input className="pro-input" type="number" disabled={disabled} value={cfg.renewal.noticeDays} onChange={(e) => setRenewal("noticeDays", Number(e.target.value || 0))} />
          </label>
          <label className="pro-field">
            <span className="pro-field-label">Hiring-manager warning</span>
            <span className="pro-field-hint">Days before renewal that the hiring manager is nudged to review.</span>
            <input className="pro-input" type="number" disabled={disabled} value={cfg.renewal.warningDays} onChange={(e) => setRenewal("warningDays", Number(e.target.value || 0))} />
          </label>
        </div>
      </WtSection>

      <footer className="wt-config-actions">
        <button type="button" className="btn btn--md btn--secondary" disabled={disabled} onClick={() => { setCfg(DEFAULT_PRO_CONFIG); showToast("Config reset to defaults"); }}>
          <Icon name="Refresh" size={14} />Reset to defaults
        </button>
        <button type="button" className="btn btn--md btn--primary" disabled={disabled} onClick={() => showToast("Worker type configuration saved", { kind: "success" })}>
          <Icon name="Save" size={14} />Save changes
        </button>
      </footer>
    </div>
  );
}

// =====================================================================
// V77WorkerTypeMatrix — the spec §17 14-cell grid overlay.
//
// Renders the §05 matrix as a status grid. Three Supplier Type columns
// × five (Work Type × Billing Model) row tuples = 15 cells; 14 are
// shippable + 1 rare (Assignment×FixedFee×EOR).
//
// At this stage the grid is informational, not interactive: each cell
// carries a status pill (shipped · new · future · rare). Phase 4 of
// the spec roadmap turns the cells into toggles that a tenant uses to
// opt cells in / out of their intake picker.
//
// Gated by `v77Axes` in the page above, so flag-off DOM is byte-
// identical to today's worker-types settings UI.
// =====================================================================

const V77_MATRIX_ROWS = [
  { workType: "Shift",      billingModel: "ClockInOut", label: "Punch-anchored frontline shift" },
  { workType: "Shift",      billingModel: "Timesheet",  label: "Scheduled shift, hours self-reported" },
  { workType: "Assignment", billingModel: "Timesheet",  label: "Bench / project on hourly billing" },
  { workType: "Assignment", billingModel: "Milestone",  label: "SOW-style deliverable acceptance" },
  { workType: "Assignment", billingModel: "FixedFee",   label: "Flat-rate retainer, no time tracking" },
];
const V77_SUPPLIER_COLS = ["Agency", "IndependentContractor", "EOR", "Float"];
const V77_LABEL = {
  Shift: "Shift", Assignment: "Assignment",
  ClockInOut: "Clock-in/out", Timesheet: "Timesheet", Milestone: "Milestone", FixedFee: "Fixed",
  Agency: "Agency", IndependentContractor: "Independent Contractor", EOR: "EOR", Float: "Float",
};

// Spec §05: which cells are shipped today, which are new (Phase 3
// targets), which are future (Phase 4 EOR), which is rare (soft-warn).
const V77_CELL_STATUS = {
  "Shift-ClockInOut-Agency": "shipped",
  "Shift-ClockInOut-IndependentContractor": "new",
  "Shift-ClockInOut-EOR": "future",
  "Shift-Timesheet-Agency": "new",
  "Shift-Timesheet-IndependentContractor": "new",
  "Shift-Timesheet-EOR": "future",
  "Assignment-Timesheet-Agency": "shipped",
  "Assignment-Timesheet-IndependentContractor": "shipped",
  "Assignment-Timesheet-EOR": "future",
  "Assignment-Milestone-Agency": "shipped",
  "Assignment-Milestone-IndependentContractor": "new",
  "Assignment-Milestone-EOR": "future",
  "Assignment-FixedFee-Agency": "new",
  "Assignment-FixedFee-IndependentContractor": "new",
  "Assignment-FixedFee-EOR": "rare",
  // Float \u2014 internal float-pool workers. The canonical case is
  // healthcare per-diem RNs picking up a shift across the system, so
  // Shift \u00d7 (ClockInOut | Timesheet) light up as shippable. Assignment
  // cells are out of scope for Float (a float worker is by definition
  // on an open shift, not a long-term assignment) \u2014 left blank so
  // the matrix renders \u201c\u2014\u201d for those intersections.
  "Shift-ClockInOut-Float": "new",
  "Shift-Timesheet-Float": "new",
};

function V77WorkerTypeMatrix() {
  const tally = useMemoWt(() => {
    const t = { shipped: 0, new: 0, future: 0, rare: 0 };
    for (const r of V77_MATRIX_ROWS) for (const c of V77_SUPPLIER_COLS) {
      const s = V77_CELL_STATUS[`${r.workType}-${r.billingModel}-${c}`];
      if (s) t[s] = (t[s] || 0) + 1;
    }
    return t;
  }, []);

  return (
    <section className="wt-v77-matrix" aria-label="Worker type matrix · v0.77">
      <header className="wt-v77-matrix-head">
        <div>
          <div className="wt-v77-matrix-eyebrow">v0.77 · spec §17</div>
          <h3 className="wt-v77-matrix-title">Worker type matrix · 14 valid cells + 1 rare</h3>
          <p className="wt-v77-matrix-sub">Five <b>Work Type × Billing Model</b> row-tuples crossed with three <b>Supplier Types</b>. Toggling a cell off (Phase 4) makes it unreachable in the intake picker, saved views, and analytics breakdowns.</p>
        </div>
        <div className="wt-v77-matrix-tally" role="list">
          <span className="wt-v77-matrix-tally-item wt-v77-matrix-tally-item--shipped" role="listitem"><b>{tally.shipped}</b> shipped</span>
          <span className="wt-v77-matrix-tally-item wt-v77-matrix-tally-item--new" role="listitem"><b>{tally.new}</b> new</span>
          <span className="wt-v77-matrix-tally-item wt-v77-matrix-tally-item--future" role="listitem"><b>{tally.future}</b> future</span>
          <span className="wt-v77-matrix-tally-item wt-v77-matrix-tally-item--rare" role="listitem"><b>{tally.rare}</b> rare</span>
        </div>
      </header>

      <div className="wt-v77-matrix-grid-wrap">
        <table className="wt-v77-matrix-grid">
          <thead>
            <tr>
              <th className="wt-v77-matrix-corner" />
              {V77_SUPPLIER_COLS.map((c) => (
                <th key={c} className="wt-v77-matrix-colhead">
                  <span className="wt-v77-axis wt-v77-axis--who">{V77_LABEL[c]}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {V77_MATRIX_ROWS.map((r) => (
              <tr key={`${r.workType}-${r.billingModel}`}>
                <th scope="row" className="wt-v77-matrix-rowhead">
                  <div className="wt-v77-matrix-rowhead-axes">
                    <span className="wt-v77-axis wt-v77-axis--what">{V77_LABEL[r.workType]}</span>
                    <span className="wt-v77-matrix-times">×</span>
                    <span className="wt-v77-axis wt-v77-axis--how">{V77_LABEL[r.billingModel]}</span>
                  </div>
                  <div className="wt-v77-matrix-rowhead-label">{r.label}</div>
                </th>
                {V77_SUPPLIER_COLS.map((c) => {
                  const key = `${r.workType}-${r.billingModel}-${c}`;
                  const status = V77_CELL_STATUS[key] || "nope";
                  return (
                    <td key={c} className={`wt-v77-matrix-cell wt-v77-matrix-cell--${status}`}>
                      <span className={`wt-v77-matrix-pill wt-v77-matrix-pill--${status}`}>
                        {status === "shipped" ? "Shipped" :
                         status === "new"     ? "New" :
                         status === "future"  ? "Future" :
                         status === "rare"    ? "Rare · soft-warn" : "—"}
                      </span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <footer className="wt-v77-matrix-foot">
        <span><b>Shipped</b> = available in production today. <b>New</b> = unlocks behind an axis flag. <b>Future</b> = Phase 4 (EOR). <b>Rare</b> = soft-warning at the intake picker; not blocked.</span>
        <a className="wt-v77-matrix-foot-link" href="unified-vms-v0.77-spec.html#matrix">Open matrix in spec ↗</a>
      </footer>
    </section>
  );
}

Object.assign(window, {
  WorkerTypesSettingsPage,
});
