// =====================================================================
// Flex Work — Budgets settings
//   · BudgetsPage           — list of budgets w/ KPI summary + period
//                              tabs + filters + utilization bars
//   · BudgetSidePanel       — create / edit / view (3 modes share the
//                              same shell; "view" surfaces a 12-month
//                              spend chart + recent activity)
//
// Persists in window.__budgetsStore so navigation away & back keeps
// edits. Hooks into window.openMenu / window.showToast / window.openConfirm
// just like the rest of the Settings family does.
// =====================================================================

const { useState: useB, useMemo: useMB, useEffect: useEB, useCallback: useCB, useRef: useRB } = React;

// ---------- Helpers ---------------------------------------------------
// Read the active currency symbol at call time so a country switch
// re-renders straight into the new currency (£, €, ¥, …). Fallback to
// "$" keeps Budgets functional in isolation tests where countries.jsx
// hasn't loaded.
const BUD_SYM = () => (typeof window !== "undefined" && window.curSymbol)
  ? window.curSymbol() : "$";
const BUD_MONEY = (n) => {
  if (n == null) return "—";
  const neg = n < 0;
  const v = Math.abs(Math.round(n));
  return `${neg ? "-" : ""}${BUD_SYM()}${v.toLocaleString("en-US")}`;
};
const BUD_SHORT = (n) => {
  if (n == null) return "—";
  const s = BUD_SYM();
  if (Math.abs(n) >= 1_000_000) return `${s}${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000)     return `${s}${(n / 1_000).toFixed(0)}k`;
  return `${s}${n}`;
};
const BUD_PCT = (a, b) => b > 0 ? Math.round((a / b) * 100) : 0;
const BUD_CLAMP = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

// FY pacing — today is May 19, 2026 (system info). Pretend FY26 runs
// Apr 1 2026 → Mar 31 2027 so we're about 13% through the year. We use
// this both for the "pacing tick" on the bar AND for the implied
// utilization status.
const BUD_TODAY = new Date(2026, 4, 19);
const BUD_FY_LABEL = "FY 2026";
const BUD_FY_START = new Date(2026, 3, 1);
const BUD_FY_END   = new Date(2027, 2, 31);
const BUD_FY_PACE  = BUD_CLAMP((BUD_TODAY - BUD_FY_START) / (BUD_FY_END - BUD_FY_START), 0, 1); // ~0.133
const BUD_FY_MONTH_IDX = 1; // 0=Apr, 1=May — current month

// ---------- Scope kinds ------------------------------------------------
const BUD_SCOPES = [
  { kind: "location",    label: "Site",    icon: "Location",   sub: "Per-site cap" },
  { kind: "department",  label: "Department",  icon: "Building",   sub: "Functional unit" },
  { kind: "cost-center", label: "Labor metric", icon: "PersonLines", sub: "GL account / department" },
  { kind: "program",     label: "Program",     icon: "Globe",      sub: "Cross-org rollup" },
];

// ---------- Seed data -------------------------------------------------
// Each row gives total $, fiscal-YTD spent, committed (PO'd not invoiced),
// monthly burn array (12 entries — first BUD_FY_MONTH_IDX+1 are actuals).
// Statuses derive from spent vs pacing tick.
//
// Numeric values (amount / spent / committed / monthly array / activity
// amounts) are multiplied through the active temp-spend tier so the
// budgets list reads at $1M-org scale (rows ~$10-50k) all the way to
// $500M+ (rows in the $10M+ range) without changing the shape.
const _BUD_SC = (typeof window !== "undefined" && typeof window.TEMP_SPEND_SCALE === "number") ? window.TEMP_SPEND_SCALE : 1;
function _bs(n, step) {
  if (typeof n !== "number" || !isFinite(n)) return n;
  const v = n * _BUD_SC;
  const grain = step != null ? step : (Math.abs(v) >= 1_000_000 ? 10_000 : Math.abs(v) >= 100_000 ? 1_000 : 100);
  return Math.max(0, Math.round(v / grain) * grain);
}
function _bsArr(arr) { return arr.map((v) => _bs(v)); }

function bud_seed() {
  const months = ["Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar"];
  const mk = (id, name, scope, scopeLabel, amount, spent, committed, owner, period, history, alerts = { warn: 80, over: 100 }) => ({
    id, name, scope, scopeLabel,
    amount:    _bs(amount),
    spent:     _bs(spent),
    committed: _bs(committed),
    owner, period,
    fiscal: BUD_FY_LABEL,
    alertThresholds: alerts,
    monthly: _bsArr(history),                // array of 12 numbers (actuals + planned)
    months,
    notifyEmails: ["amy.chen@dayforce.com"],
    activity: bud_sampleActivity(name, scope),
    notes: "",
    createdAt: "Apr 02, 2026",
    createdBy: owner,
  });

  return [
    mk("b-001", "Distribution Center Alpha", "location", "Distribution Center Alpha · Atlanta, GA",
       420_000, 78_400, 12_300, "Nia Thompson", "annual",
       [54_800, 23_600, 36_000, 38_000, 40_000, 42_000, 38_000, 36_000, 36_000, 38_000, 38_000, 38_600]),
    mk("b-002", "Warehouse #35", "location", "Warehouse #35 · Dallas, TX",
       310_000, 245_000, 9_000, "Jamal Carter", "annual",
       [32_000, 32_200, 26_000, 26_000, 28_000, 28_000, 26_000, 24_000, 24_000, 26_000, 18_400, 18_400]),
    mk("b-003", "Warehouse #14", "location", "Warehouse #14 · Chicago, IL",
       280_000, 49_840, 6_200, "Nia Thompson", "annual",
       [24_400, 25_440, 22_500, 23_000, 24_000, 23_000, 22_500, 22_000, 22_500, 22_000, 24_000, 24_660]),
    mk("b-004", "Sam's Chalet portfolio", "location", "2 properties · Aspen + Vail, CO",
       180_000, 165_000, 8_000, "Priya Ramesh", "annual",
       [22_400, 18_800, 16_000, 14_000, 12_000, 11_000, 10_000, 10_000, 10_000, 16_000, 18_000, 21_800]),

    mk("b-101", "East region — Light Industrial", "department", "Light Industrial · East region",
       640_000, 510_000, 53_000, "Sami Soto", "annual",
       [86_300, 76_100, 56_000, 54_000, 54_000, 52_000, 50_000, 48_000, 48_000, 50_000, 52_000, 14_100],
       { warn: 75, over: 95 }),
    mk("b-102", "Hospitality services", "department", "Hospitality services",
       95_000, 9_800, 2_200, "Priya Ramesh", "annual",
       [4_900, 4_900, 7_000, 8_000, 9_000, 10_000, 11_000, 9_000, 8_000, 8_000, 8_000, 7_200]),

    mk("b-201", "CC-2200 · Frontline overtime", "cost-center", "GL 2200 · Frontline overtime",
       72_000, 53_000, 3_500, "Devon Park", "quarterly",
       [12_400, 6_000, 6_000, 6_000, 6_000, 6_000, 6_000, 6_000, 6_000, 6_000, 6_000, 0],
       { warn: 70, over: 90 }),
    mk("b-202", "CC-2410 · Holiday premium pay", "cost-center", "GL 2410 · Premiums",
       145_000, 115_000, 8_000, "Maya Chen", "annual",
       [16_500, 12_400, 8_000, 8_000, 8_000, 8_000, 18_000, 18_000, 28_000, 12_000, 8_000, 8_000]),
    mk("b-203", "CC-2500 · Holiday gift / referral", "cost-center", "GL 2500 · One-time",
       12_000, 9_400, 0, "Devon Park", "annual",
       [4_400, 5_000, 800, 200, 200, 200, 200, 200, 200, 200, 200, 200],
       { warn: 60, over: 80 }),

    mk("b-301", "Pilot — Auto-fill agent", "program", "Cross-org · AI pilot",
       50_000, 40_000, 11_000, "Alex Moreno", "quarterly",
       [3_800, 2_400, 6_000, 6_000, 6_000, 6_000, 4_000, 4_000, 4_000, 4_000, 2_000, 1_800]),
  ];
}

function bud_sampleActivity(name, kind) {
  // tiny mocked recent-activity list per row
  const baseDates = [
    { d: "May 18, 2026", who: "Auto-approved" },
    { d: "May 16, 2026", who: "Amy Chen" },
    { d: "May 14, 2026", who: "Nia Thompson" },
    { d: "May 12, 2026", who: "Auto-approved" },
    { d: "May 09, 2026", who: "Sami Soto" },
  ];
  const kinds = kind === "cost-center"
    ? ["Premium hours", "OT supplement", "Stat holiday"]
    : ["Requisition", "Timesheet", "Invoice", "PO commit"];
  return baseDates.map((b, i) => ({
    id: `a-${i}-${name.length}`,
    date: b.d,
    actor: b.who,
    kind: kinds[i % kinds.length],
    ref: `${kinds[i % kinds.length].toLowerCase().includes("invoice") ? "INV" :
           kinds[i % kinds.length].toLowerCase().includes("requisition") ? "REQ" :
           kinds[i % kinds.length].toLowerCase().includes("po") ? "PO" : "TS"}-${1000 + ((i + name.length) * 37) % 4000}`,
    amount: _bs([4_200, 3_180, 2_640, 1_950, 1_220][i]),
    note: i === 1 ? "approved with override" : "",
  }));
}

// ---------- Persistent store ------------------------------------------
function bud_store() {
  if (!window.__budgetsStore) window.__budgetsStore = bud_seed();
  return window.__budgetsStore;
}
function bud_setStore(next) {
  window.__budgetsStore = next;
  window.dispatchEvent(new CustomEvent("budgets:change"));
}
function bud_upsert(rec) {
  const cur = bud_store();
  const i = cur.findIndex((r) => r.id === rec.id);
  const next = i >= 0
    ? [...cur.slice(0, i), { ...cur[i], ...rec }, ...cur.slice(i + 1)]
    : [{ ...rec, id: `b-${Date.now()}` }, ...cur];
  bud_setStore(next);
}
function bud_remove(id) {
  bud_setStore(bud_store().filter((r) => r.id !== id));
}

// ---------- Status derivation -----------------------------------------
function bud_status(row) {
  const pct = BUD_PCT(row.spent + row.committed, row.amount);
  const w = row.alertThresholds?.warn ?? 80;
  const o = row.alertThresholds?.over ?? 100;
  if (pct >= o)        return { key: "over",    pct, label: pct > 100 ? "Over budget" : "At cap" };
  if (pct >= w)        return { key: "warn",    pct, label: "Approaching" };
  return { key: "ontrack", pct, label: "On track" };
}

// ---------- Tiny ring (used in summary KPI) ---------------------------
function BudRing({ pct, state }) {
  const R = 28;
  const C = 2 * Math.PI * R;
  const dash = C * BUD_CLAMP(pct, 0, 100) / 100;
  const stateCls = state === "over" ? "bud-ring--over" : state === "warn" ? "bud-ring--warn" : "";
  return (
    <div className={`bud-ring ${stateCls}`}>
      <svg viewBox="0 0 72 72">
        <circle cx="36" cy="36" r={R} fill="none" strokeWidth="8" className="bud-ring-track" />
        <circle cx="36" cy="36" r={R} fill="none" strokeWidth="8" strokeLinecap="round"
                className="bud-ring-fill"
                strokeDasharray={`${dash} ${C - dash}`} />
      </svg>
      <div className="bud-ring-label">{pct}%</div>
    </div>
  );
}

// ---------- Util bar (used in table + detail) -------------------------
function BudUtilBar({ row, showFoot = true, dense = false }) {
  const { pct, key } = bud_status(row);
  // The pacing tick — where this budget *should* be at given the
  // fiscal-year progress (annual budgets only).
  const showTick = row.period === "annual";
  const tick = showTick ? Math.round(BUD_FY_PACE * 100) : null;
  return (
    <div className="bud-util" data-state={key}>
      <div className="bud-util-track">
        <div className="bud-util-fill" style={{ width: `${Math.min(pct, 100)}%` }} />
        {showTick && (
          <div className="bud-util-cap" style={{ left: `calc(${tick}% - 1px)` }}
               title={`Pacing target ${tick}%`} />
        )}
      </div>
      {showFoot && (
        <div className="bud-util-foot">
          <span className="pct">{pct}%</span>
          <span>{BUD_MONEY(row.spent + row.committed)} of {BUD_SHORT(row.amount)}</span>
        </div>
      )}
    </div>
  );
}

// ---------- Scope pill -------------------------------------------------
function BudScopePill({ kind, children }) {
  const meta = BUD_SCOPES.find((s) => s.kind === kind) || BUD_SCOPES[0];
  return (
    <span className="bud-scope-pill" data-kind={kind}>
      <Icon name={meta.icon} size={12} />
      <span>{children || meta.label}</span>
    </span>
  );
}

// ---------- Status pill ------------------------------------------------
function BudStatusPill({ row }) {
  const s = bud_status(row);
  const cls = `bud-status bud-status--${s.key}`;
  return (
    <span className={cls}>
      <span className="bud-status-dot" />
      {s.label}
    </span>
  );
}

// =====================================================================
// LIST PAGE
// =====================================================================
function BudgetsPage() {
  const [rows, setRows] = useB(() => bud_store());
  const [query, setQuery] = useB("");
  const [period, setPeriod] = useB("all");        // all | annual | quarterly | monthly
  const [scopeFilter, setScopeFilter] = useB("all");
  const [statusFilter, setStatusFilter] = useB("all");
  const [panel, setPanel] = useB(null);            // null | { mode: 'view'|'edit'|'create', id? }
  const [sortBy, setSortBy] = useB({ key: "name", dir: "asc" });

  useEB(() => {
    const onChange = () => setRows([...bud_store()]);
    window.addEventListener("budgets:change", onChange);
    return () => window.removeEventListener("budgets:change", onChange);
  }, []);

  const filtered = useMB(() => {
    const q = query.trim().toLowerCase();
    return rows
      .filter((r) => period === "all" || r.period === period)
      .filter((r) => scopeFilter === "all" || r.scope === scopeFilter)
      .filter((r) => statusFilter === "all" || bud_status(r).key === statusFilter)
      .filter((r) => !q
        || r.name.toLowerCase().includes(q)
        || (r.scopeLabel || "").toLowerCase().includes(q)
        || (r.owner || "").toLowerCase().includes(q))
      .slice()
      .sort((a, b) => {
        let av = a[sortBy.key]; let bv = b[sortBy.key];
        if (sortBy.key === "util") { av = bud_status(a).pct; bv = bud_status(b).pct; }
        const cmp = (typeof av === "number" && typeof bv === "number")
          ? av - bv
          : String(av || "").localeCompare(String(bv || ""));
        return sortBy.dir === "asc" ? cmp : -cmp;
      });
  }, [rows, query, period, scopeFilter, statusFilter, sortBy]);

  // Summary KPIs (across whatever is filtered)
  const summary = useMB(() => {
    const total      = filtered.reduce((s, r) => s + r.amount, 0);
    const spent      = filtered.reduce((s, r) => s + r.spent, 0);
    const committed  = filtered.reduce((s, r) => s + r.committed, 0);
    const remaining  = total - spent - committed;
    const utilPct    = BUD_PCT(spent + committed, total);
    const overCount  = filtered.filter((r) => bud_status(r).key === "over").length;
    const warnCount  = filtered.filter((r) => bud_status(r).key === "warn").length;
    const ringState  = utilPct >= 100 ? "over" : utilPct >= 80 ? "warn" : "ontrack";
    return { total, spent, committed, remaining, utilPct, overCount, warnCount, ringState };
  }, [filtered]);

  const toggleSort = (key) => setSortBy((cur) =>
    cur.key === key ? { key, dir: cur.dir === "asc" ? "desc" : "asc" }
                    : { key, dir: key === "util" ? "desc" : "asc" });

  const rowMenu = (row) => (e) => {
    e.stopPropagation();
    if (!window.openMenu) return;
    window.openMenu(e.currentTarget, [
      { icon: "View", label: "View details",   onClick: () => setPanel({ mode: "view", id: row.id }) },
      { icon: "Edit", label: "Edit budget",    onClick: () => setPanel({ mode: "edit", id: row.id }) },
      { icon: "Copy", label: "Duplicate",      onClick: () => {
        bud_upsert({
          ...row,
          id: `b-${Date.now()}`,
          name: `${row.name} (copy)`,
          spent: 0, committed: 0,
          monthly: row.monthly.map(() => 0),
          activity: [],
        });
        if (window.showToast) window.showToast(`${row.name} duplicated`, { kind: "success" });
      }},
      { icon: "FileDownload", label: "Export forecast (CSV)",
        onClick: () => window.showToast && window.showToast(`Forecast for ${row.name} exported`, { kind: "success" }) },
      { divider: true },
      { icon: "TrashCan", label: "Delete", danger: true, onClick: () => {
        if (window.openConfirm) {
          window.openConfirm({
            title: `Delete ${row.name}?`,
            body: "Spend already recorded against this budget will still be visible on reports, but new commitments won't be tracked. This can't be undone.",
            confirmLabel: "Delete",
            danger: true,
            onConfirm: () => {
              bud_remove(row.id);
              if (window.showToast) window.showToast(`${row.name} deleted`, { kind: "success" });
            },
          });
        } else {
          bud_remove(row.id);
        }
      }},
    ]);
  };

  return (
    <div className="bud-shell">
      {/* --- Page header --------------------------------------------- */}
      <div className="bud-page-header">
        <div className="bud-page-titlewrap">
          <h2 className="bud-page-title">Budgets</h2>
          <p className="bud-page-sub">
            Allocate flexible-workforce spend by site, department, or program. Flex
            Work tracks utilization in real time against requisitions, timesheets, and invoices, and
            warns owners before they tip over.
          </p>
        </div>
        <div className="bud-page-header-actions">
          <button type="button" className="bud-btn bud-btn--secondary"
                  onClick={() => window.showToast && window.showToast("Roll-up exported — check your downloads", { kind: "success" })}>
            <Icon name="FileDownload" size={14} /> Export
          </button>
          <button type="button" className="bud-btn bud-btn--primary"
                  onClick={() => setPanel({ mode: "create" })}>
            <Icon name="AddCircle" size={16} /> New budget
          </button>
        </div>
      </div>

      {/* --- Fiscal-period strip ------------------------------------ */}
      <div className="bud-period-bar">
        <span className="bud-period-bar-label">Period</span>
        <div className="bud-period-tabs">
          {[
            { id: "all",        label: "All" },
            { id: "annual",     label: "Annual" },
            { id: "quarterly",  label: "Quarterly" },
            { id: "monthly",    label: "Monthly" },
          ].map((t) => (
            <button key={t.id} type="button"
                    className="bud-period-tab"
                    aria-pressed={period === t.id}
                    onClick={() => setPeriod(t.id)}>
              {t.label}
            </button>
          ))}
        </div>

        <span className="bud-period-fy-progress">
          <strong>{BUD_FY_LABEL}</strong>
          <span>· Day {Math.round(BUD_FY_PACE * 365)} of 365</span>
          <span>· {Math.round(BUD_FY_PACE * 100)}% elapsed</span>
        </span>

        <button type="button" className="bud-period-fy"
                onClick={(e) => window.openMenu && window.openMenu(e.currentTarget, [
                  { icon: "Check", label: BUD_FY_LABEL, onClick: () => {} },
                  { icon: "Calendar", label: "FY 2025", onClick: () => window.showToast && window.showToast("FY25 is read-only — closed Mar 31, 2026") },
                  { icon: "Calendar", label: "FY 2027", onClick: () => window.showToast && window.showToast("FY27 planning opens Feb 2027") },
                ])}>
          <Icon name="Calendar" size={14} />
          {BUD_FY_LABEL}
          <Icon name="ChevronDown" size={12} />
        </button>
      </div>

      {/* --- Summary KPIs ------------------------------------------- */}
      <div className="bud-summary">
        <div className="bud-kpi">
          <span className="bud-kpi-label">Total allocated</span>
          <span className="bud-kpi-value">{BUD_MONEY(summary.total)}</span>
          <span className="bud-kpi-foot">
            <span>{filtered.length} budget{filtered.length === 1 ? "" : "s"}</span>
          </span>
        </div>
        <div className="bud-kpi">
          <span className="bud-kpi-label">Spent + committed</span>
          <span className="bud-kpi-value">{BUD_MONEY(summary.spent + summary.committed)}</span>
          <span className="bud-kpi-foot">
            <span>{BUD_MONEY(summary.spent)} spent</span>
            <span>·</span>
            <span>{BUD_MONEY(summary.committed)} committed</span>
          </span>
        </div>
        <div className="bud-kpi">
          <span className="bud-kpi-label">Remaining</span>
          <span className="bud-kpi-value">{BUD_MONEY(summary.remaining)}</span>
          <span className="bud-kpi-foot">
            <span className={summary.utilPct < BUD_FY_PACE * 100 ? "pos" : "neg"}>
              {summary.utilPct < BUD_FY_PACE * 100 ? "On pace" : "Ahead of pace"}
            </span>
            <span>· pacing {Math.round(BUD_FY_PACE * 100)}%</span>
          </span>
        </div>
        <div className="bud-kpi bud-kpi--util">
          <BudRing pct={summary.utilPct} state={summary.ringState} />
          <div className="bud-kpi-textstack">
            <span className="bud-kpi-label">Overall utilization</span>
            <span className="bud-kpi-foot" style={{ marginTop: 2 }}>
              {summary.overCount > 0 && <span className="neg">{summary.overCount} over</span>}
              {summary.overCount > 0 && summary.warnCount > 0 && <span>·</span>}
              {summary.warnCount > 0 && <span style={{ color: "var(--evr-yellow-700)", fontWeight: "var(--evr-fw-demibold)" }}>{summary.warnCount} approaching</span>}
              {summary.overCount === 0 && summary.warnCount === 0 && <span className="pos">All on track</span>}
            </span>
          </div>
        </div>
      </div>

      {/* --- Toolbar / filters -------------------------------------- */}
      <div className="bud-toolbar">
        <div className="bud-toolbar-left">
          <div className="bud-search">
            <span className="bud-search-icon"><Icon name="Search" size={16} /></span>
            <input
              className="bud-search-input"
              placeholder="Search budgets, owners, scopes"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <select
            className="bud-chipfilter"
            value={scopeFilter}
            onChange={(e) => setScopeFilter(e.target.value)}
            aria-label="Filter by scope">
            <option value="all">All scopes</option>
            {BUD_SCOPES.map((s) => <option key={s.kind} value={s.kind}>{s.label}</option>)}
          </select>
          <select
            className="bud-chipfilter"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            aria-label="Filter by status">
            <option value="all">All statuses</option>
            <option value="ontrack">On track</option>
            <option value="warn">Approaching</option>
            <option value="over">Over budget</option>
          </select>
        </div>
        <div className="bud-toolbar-count">
          Showing {filtered.length} of {rows.length}
        </div>
      </div>

      {/* --- Table -------------------------------------------------- */}
      <div className="bud-card">
        <table className="bud-table">
          <thead>
            <tr>
              <th onClick={() => toggleSort("name")} style={{ cursor: "pointer" }}>Budget</th>
              <th className="bud-cell-scope">Scope</th>
              <th className="bud-cell-period">Period</th>
              <th className="num bud-cell-spend">Spend</th>
              <th className="bud-cell-util" onClick={() => toggleSort("util")} style={{ cursor: "pointer" }}>Utilization</th>
              <th className="bud-cell-status">Status</th>
              <th aria-label="Actions"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={7}>
                <div className="bud-empty">
                  <Icon name="MoneyBag" size={36} />
                  <h3 className="bud-empty-title">No budgets match</h3>
                  <p className="bud-empty-body">
                    Try clearing your filters, or create a new budget to start tracking spend.
                  </p>
                  <div style={{ marginTop: 12 }}>
                    <button type="button" className="bud-btn bud-btn--primary"
                            onClick={() => setPanel({ mode: "create" })}>
                      <Icon name="AddCircle" size={16} /> New budget
                    </button>
                  </div>
                </div>
              </td></tr>
            ) : filtered.map((row) => {
              const remaining = row.amount - row.spent - row.committed;
              return (
                <tr key={row.id}
                    onClick={() => setPanel({ mode: "view", id: row.id })}
                    tabIndex={0}
                    onKeyDown={(e) => { if (e.key === "Enter") setPanel({ mode: "view", id: row.id }); }}>
                  <td>
                    <div className="bud-row-name">
                      <span className="bud-row-name-title">{row.name}</span>
                      <span className="bud-row-name-sub">{row.owner}</span>
                    </div>
                  </td>
                  <td className="bud-cell-scope">
                    <BudScopePill kind={row.scope}>{row.scopeLabel || (BUD_SCOPES.find((s) => s.kind === row.scope) || {}).label}</BudScopePill>
                  </td>
                  <td className="bud-cell-period" title={`${row.period} · ${row.fiscal}`}>{row.period}</td>
                  <td className="num bud-cell-spend">
                    <div className={`bud-money ${remaining < 0 ? "bud-money--over" : ""}`}>
                      {BUD_MONEY(row.spent + row.committed)}
                    </div>
                    <div className="bud-money-sub">
                      of {BUD_MONEY(row.amount)} · {BUD_SHORT(Math.abs(remaining))} {remaining < 0 ? "over" : "left"}
                    </div>
                  </td>
                  <td className="bud-cell-util">
                    <BudUtilBar row={row} />
                  </td>
                  <td className="bud-cell-status"><BudStatusPill row={row} /></td>
                  <td className="bud-cell-actions">
                    <button type="button" className="bud-icon-btn"
                            aria-label={`Actions for ${row.name}`}
                            onClick={rowMenu(row)}>
                      <Icon name="MoreVert" size={18} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* --- Side panel --------------------------------------------- */}
      {panel && (
        <BudSidePanel
          mode={panel.mode}
          recordId={panel.id}
          onClose={() => setPanel(null)}
          onEdit={(id) => setPanel({ mode: "edit", id })}
        />
      )}
    </div>
  );
}

// =====================================================================
// SIDE PANEL — handles view / edit / create
// =====================================================================
function BudSidePanel({ mode, recordId, onClose, onEdit }) {
  // Esc to close
  useEB(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose && onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (mode === "view") {
    return <BudDetailPanel recordId={recordId} onClose={onClose} onEdit={onEdit} />;
  }
  return <BudEditPanel mode={mode} recordId={recordId} onClose={onClose} />;
}

// ---------- View / detail mode ----------------------------------------
function BudDetailPanel({ recordId, onClose, onEdit }) {
  const [row, setRow] = useB(() => bud_store().find((r) => r.id === recordId) || null);
  useEB(() => {
    const onChange = () => setRow(bud_store().find((r) => r.id === recordId) || null);
    window.addEventListener("budgets:change", onChange);
    return () => window.removeEventListener("budgets:change", onChange);
  }, [recordId]);

  if (!row) return null;
  const status = bud_status(row);
  const remaining = row.amount - row.spent - row.committed;
  const maxMonth = Math.max(...row.monthly, 1);

  return (
    <React.Fragment>
      <div className="bud-scrim" onClick={onClose} />
      <aside className="bud-panel" role="dialog" aria-labelledby="bud-panel-title">
        <header className="bud-panel-header">
          <BudScopePill kind={row.scope} />
          <h2 className="bud-panel-title" id="bud-panel-title">{row.name}</h2>
          <button type="button" className="bud-icon-btn" aria-label="Close" onClick={onClose}>
            <Icon name="X" size={18} />
          </button>
        </header>

        <div className="bud-panel-body">
          {/* Alert banner for warning / over */}
          {status.key === "over" && (
            <div className="bud-alert bud-alert--over">
              <Icon name="Alert" size={18} />
              <div>
                <strong>{status.label}</strong> · spend + committed has exceeded the cap.
                Owners and finance have been notified. Reduce committed work or request a budget increase.
              </div>
            </div>
          )}
          {status.key === "warn" && (
            <div className="bud-alert bud-alert--warn">
              <Icon name="Alert" size={18} />
              <div>
                <strong>{status.label} threshold ({row.alertThresholds.warn}%)</strong> — running
                ahead of pacing. Next requisition over {BUD_SHORT(10000)} will require finance approval.
              </div>
            </div>
          )}

          {/* Hero card */}
          <div className="bud-detail-hero">
            <div className="bud-detail-hero-row">
              <span className="bud-row-name-sub">{row.scopeLabel}</span>
              <BudStatusPill row={row} />
            </div>
            <div className="bud-detail-numbers">
              <div className="bud-detail-number">
                <span className="bud-detail-number-label">Allocated</span>
                <span className="bud-detail-number-value">{BUD_MONEY(row.amount)}</span>
              </div>
              <div className="bud-detail-number">
                <span className="bud-detail-number-label">Spent + cmt</span>
                <span className="bud-detail-number-value">{BUD_MONEY(row.spent + row.committed)}</span>
              </div>
              <div className="bud-detail-number">
                <span className="bud-detail-number-label">Remaining</span>
                <span className={`bud-detail-number-value ${remaining < 0 ? "bud-detail-number-value--over" : ""}`}>
                  {BUD_MONEY(remaining)}
                </span>
              </div>
            </div>
            <div className="bud-detail-utility-row">
              <BudUtilBar row={row} dense />
            </div>
          </div>

          {/* Monthly burn */}
          <section className="bud-detail-section">
            <div className="bud-spark">
              <div className="bud-spark-header">
                <h4>Monthly burn</h4>
                <span>Apr 2026 → Mar 2027</span>
              </div>
              <div className="bud-spark-track">
                {row.monthly.map((v, i) => {
                  let state = "future";
                  if (i < BUD_FY_MONTH_IDX) state = "actual";
                  else if (i === BUD_FY_MONTH_IDX) state = "today";
                  else state = "planned";
                  // mark "over" if any single month spent > 1/12 of cap × 1.5
                  if (i <= BUD_FY_MONTH_IDX && v > (row.amount / 12) * 1.5) state = "over";
                  return (
                    <div key={i}
                         className="bud-spark-bar"
                         data-state={state}
                         style={{ height: `${(v / maxMonth) * 100}%` }}
                         title={`${row.months[i]}: ${BUD_MONEY(v)}`} />
                  );
                })}
              </div>
              <div className="bud-spark-axis">
                {row.months.map((m) => <span key={m}>{m}</span>)}
              </div>
              <div className="bud-spark-legend">
                <span className="swatch swatch--actual">Actual</span>
                <span className="swatch swatch--planned">Planned</span>
                <span className="swatch swatch--over">Over month-pace</span>
              </div>
            </div>
          </section>

          {/* Recent activity */}
          <section className="bud-detail-section">
            <h4 className="bud-detail-section-h">Recent activity</h4>
            <div className="bud-activity">
              {row.activity.map((a) => (
                <div className="bud-activity-row" key={a.id}>
                  <div>
                    <div className="bud-activity-name">{a.kind} · {a.ref}</div>
                    <div className="bud-activity-meta">
                      {a.date} · {a.actor}{a.note ? ` · ${a.note}` : ""}
                    </div>
                  </div>
                  <div className="bud-activity-amount">{BUD_MONEY(a.amount)}</div>
                </div>
              ))}
            </div>
          </section>

          {/* Alert config (read-only summary) */}
          <section className="bud-detail-section">
            <h4 className="bud-detail-section-h">Alerts</h4>
            <div className="bud-activity">
              <div className="bud-activity-row">
                <div>
                  <div className="bud-activity-name">Warn at {row.alertThresholds.warn}%</div>
                  <div className="bud-activity-meta">Email owner + finance</div>
                </div>
                <div className="bud-activity-amount">{BUD_MONEY(row.amount * row.alertThresholds.warn / 100)}</div>
              </div>
              <div className="bud-activity-row">
                <div>
                  <div className="bud-activity-name">Block new commits at {row.alertThresholds.over}%</div>
                  <div className="bud-activity-meta">Approval routed to finance</div>
                </div>
                <div className="bud-activity-amount">{BUD_MONEY(row.amount * row.alertThresholds.over / 100)}</div>
              </div>
              <div className="bud-activity-row">
                <div>
                  <div className="bud-activity-name">Notify</div>
                  <div className="bud-activity-meta">{row.notifyEmails.join(", ")}</div>
                </div>
                <div className="bud-activity-amount" />
              </div>
            </div>
          </section>
        </div>

        <footer className="bud-panel-footer">
          <div className="bud-panel-footer-left">
            <button type="button" className="bud-btn bud-btn--ghost" onClick={onClose}>Close</button>
          </div>
          <div className="bud-panel-footer-right">
            <button type="button" className="bud-btn bud-btn--secondary"
                    onClick={() => window.showToast && window.showToast(`Forecast for ${row.name} exported`, { kind: "success" })}>
              <Icon name="FileDownload" size={14} /> Export
            </button>
            <button type="button" className="bud-btn bud-btn--primary"
                    onClick={() => onEdit(row.id)}>
              <Icon name="Edit" size={14} /> Edit budget
            </button>
          </div>
        </footer>
      </aside>
    </React.Fragment>
  );
}

// ---------- Edit / create mode ----------------------------------------
function BudEditPanel({ mode, recordId, onClose }) {
  const existing = mode === "edit" ? bud_store().find((r) => r.id === recordId) : null;

  // Form state
  const [name, setName]           = useB(existing?.name || "");
  const [scope, setScope]         = useB(existing?.scope || "location");
  const [scopeIds, setScopeIds]   = useB(existing?.scopeIds || []);
  const [period, setPeriod]       = useB(existing?.period || "annual");
  const [amount, setAmount]       = useB(existing?.amount ?? "");
  const [warnPct, setWarnPct]     = useB(existing?.alertThresholds?.warn ?? 80);
  const [overPct, setOverPct]     = useB(existing?.alertThresholds?.over ?? 100);
  const [notify, setNotify]       = useB((existing?.notifyEmails || ["amy.chen@dayforce.com"]).join(", "));
  const [blockOver, setBlockOver] = useB(existing ? true : true);
  const [owner, setOwner]         = useB(existing?.owner || "Amy Chen");
  const [touched, setTouched]     = useB(false);

  // Scope options — pulled from locations seed if present, else canned
  const scopeOptions = useMB(() => {
    if (scope === "location" && typeof window !== "undefined" && Array.isArray(window.LOCATIONS)) {
      return window.LOCATIONS
        .filter((l) => l.status !== "Terminated")
        .map((l) => ({ id: l.id, name: l.name, meta: l.address }));
    }
    if (scope === "department") return [
      { id: "d-li",    name: "Light Industrial",        meta: "92 workers · 6 sites" },
      { id: "d-hosp",  name: "Hospitality services",    meta: "27 workers · 2 properties" },
      { id: "d-dist",  name: "Distribution & logistics", meta: "64 workers · 4 hubs" },
      { id: "d-admin", name: "Administrative support",   meta: "8 workers · 3 offices" },
    ];
    if (scope === "cost-center") return [
      { id: "cc-2200", name: "CC-2200 · Frontline overtime",       meta: "GL Account 2200" },
      { id: "cc-2410", name: "CC-2410 · Holiday premium pay",       meta: "GL Account 2410" },
      { id: "cc-2500", name: "CC-2500 · Referral & gift",           meta: "GL Account 2500" },
      { id: "cc-2600", name: "CC-2600 · Agency placement fees",     meta: "GL Account 2600" },
      { id: "cc-3100", name: "CC-3100 · Training & certifications", meta: "GL Account 3100" },
    ];
    return [
      { id: "p-pilot", name: "Auto-fill agent pilot",     meta: "Cross-org · AI" },
      { id: "p-seas",  name: "Seasonal surge 2026",       meta: "Q3 + Q4 program" },
      { id: "p-divr",  name: "DE&I supplier diversity",   meta: "FY26 mandate" },
    ];
  }, [scope]);

  // Reset selected ids when scope changes (only if no editing pre-existing)
  useEB(() => { if (mode === "create") setScopeIds([]); }, [scope, mode]);

  const trimmed = name.trim();
  const nameErr = touched && !trimmed;
  const amountNum = Number(amount);
  const amountErr = touched && (!amount || isNaN(amountNum) || amountNum <= 0);
  const scopeErr  = touched && scopeIds.length === 0;
  const canSave   = !nameErr && !amountErr && !scopeErr && trimmed && amountNum > 0 && scopeIds.length > 0;

  const handleSave = () => {
    setTouched(true);
    if (!trimmed || !(amountNum > 0) || scopeIds.length === 0) return;

    const pickedNames = scopeOptions.filter((o) => scopeIds.includes(o.id)).map((o) => o.name);
    const scopeLabel = pickedNames.length <= 1
      ? pickedNames[0]
      : `${pickedNames.length} ${BUD_SCOPES.find((s) => s.kind === scope).label.toLowerCase()}s · ${pickedNames[0]} +${pickedNames.length - 1}`;

    const next = {
      ...(existing || {
        id: undefined,
        fiscal: BUD_FY_LABEL,
        spent: 0,
        committed: 0,
        monthly: new Array(12).fill(0),
        months: ["Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec","Jan","Feb","Mar"],
        createdAt: "May 19, 2026",
        createdBy: "Amy Chen",
        activity: [],
      }),
      name: trimmed,
      scope, scopeIds, scopeLabel,
      period,
      amount: amountNum,
      alertThresholds: { warn: warnPct, over: overPct },
      notifyEmails: notify.split(",").map((s) => s.trim()).filter(Boolean),
      blockOnOver: blockOver,
      owner,
    };
    bud_upsert(next);
    if (window.showToast) {
      window.showToast(mode === "edit" ? `${trimmed} updated` : `${trimmed} created`, { kind: "success" });
    }
    onClose();
  };

  const handleDelete = () => {
    if (!existing) return;
    const doDelete = () => { bud_remove(existing.id); onClose();
      if (window.showToast) window.showToast(`${existing.name} deleted`, { kind: "success" }); };
    if (window.openConfirm) {
      window.openConfirm({
        title: `Delete ${existing.name}?`,
        body: "This budget will no longer track spend. Historical records on requisitions and timesheets are preserved.",
        confirmLabel: "Delete", danger: true,
        onConfirm: doDelete,
      });
    } else { doDelete(); }
  };

  const toggleScopeId = (id) => setScopeIds((cur) =>
    cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]);

  return (
    <React.Fragment>
      <div className="bud-scrim" onClick={onClose} />
      <aside className="bud-panel" role="dialog" aria-labelledby="bud-panel-title">
        <header className="bud-panel-header">
          <h2 className="bud-panel-title" id="bud-panel-title">
            {mode === "edit" ? "Edit budget" : "New budget"}
          </h2>
          <button type="button" className="bud-icon-btn" aria-label="Close" onClick={onClose}>
            <Icon name="X" size={18} />
          </button>
        </header>

        <div className="bud-panel-body">
          <div className="bud-field">
            <label className="bud-field-label" htmlFor="bud-name">
              Name<span className="req">*</span>
            </label>
            <input id="bud-name" className="bud-input"
                   value={name} onChange={(e) => setName(e.target.value)}
                   onBlur={() => setTouched(true)}
                   placeholder="e.g. Warehouse #35 · FY26"
                   aria-invalid={nameErr || undefined} />
            {nameErr && <div className="bud-field-help" style={{ color: "var(--evr-content-status-error-default)" }}>Give this budget a name.</div>}
          </div>

          {/* Scope kind */}
          <div className="bud-field">
            <span className="bud-field-label">Scope<span className="req">*</span></span>
            <div className="bud-seg">
              {BUD_SCOPES.map((s) => (
                <button type="button" key={s.kind}
                        className="bud-seg-btn"
                        aria-pressed={scope === s.kind}
                        onClick={() => setScope(s.kind)}>
                  <Icon name={s.icon} size={16} />
                  <span>{s.label}</span>
                  <span className="bud-seg-btn-sub">{s.sub}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Scope picklist */}
          <div className="bud-field">
            <label className="bud-field-label">Apply to<span className="req">*</span></label>
            <div className="bud-picklist">
              {scopeOptions.map((o) => (
                <label className="bud-picklist-row" key={o.id}>
                  <input type="checkbox"
                         checked={scopeIds.includes(o.id)}
                         onChange={() => toggleScopeId(o.id)} />
                  <span className="bud-picklist-row-name">{o.name}</span>
                  <span className="bud-picklist-row-meta">{o.meta}</span>
                </label>
              ))}
            </div>
            <div className="bud-pick-summary">
              {scopeIds.length === 0
                ? scopeErr
                  ? <span style={{ color: "var(--evr-content-status-error-default)" }}>Pick at least one.</span>
                  : "Pick the entities this budget will cover."
                : `${scopeIds.length} selected`}
            </div>
          </div>

          {/* Period + amount */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div className="bud-field">
              <label className="bud-field-label" htmlFor="bud-period">Period</label>
              <select id="bud-period" className="bud-select"
                      value={period} onChange={(e) => setPeriod(e.target.value)}>
                <option value="annual">Annual ({BUD_FY_LABEL})</option>
                <option value="quarterly">Quarterly</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>
            <div className="bud-field">
              <label className="bud-field-label" htmlFor="bud-amount">
                Amount<span className="req">*</span>
              </label>
              <div className="bud-money-input">
                <input id="bud-amount" className="bud-input bud-input--currency"
                       type="number" min="0" step="100"
                       value={amount}
                       onChange={(e) => setAmount(e.target.value)}
                       onBlur={() => setTouched(true)}
                       placeholder="0"
                       aria-invalid={amountErr || undefined} />
              </div>
              {amountErr && <div className="bud-field-help" style={{ color: "var(--evr-content-status-error-default)" }}>Enter a positive amount.</div>}
            </div>
          </div>

          {/* Alert thresholds */}
          <div className="bud-field">
            <label className="bud-field-label">Alert thresholds</label>
            <div className="bud-threshold">
              <div className="bud-threshold-row">
                <span className="swatch swatch--warn">Warn</span>
                <input type="range" min="50" max="99" step="5"
                       className="bud-threshold-slider"
                       value={warnPct}
                       onChange={(e) => setWarnPct(Math.min(Number(e.target.value), overPct - 1))} />
                <span className="val">{warnPct}%</span>
              </div>
              <div className="bud-threshold-row">
                <span className="swatch swatch--over">Cap</span>
                <input type="range" min="60" max="120" step="5"
                       className="bud-threshold-slider"
                       value={overPct}
                       onChange={(e) => setOverPct(Math.max(Number(e.target.value), warnPct + 1))} />
                <span className="val">{overPct}%</span>
              </div>
            </div>
            <div className="bud-field-help">
              Owners are emailed at the <strong>warn</strong> level, and finance approval is
              required once spend reaches the <strong>cap</strong>.
            </div>
          </div>

          {/* Block over toggle */}
          <div className="bud-toggle">
            <div className="bud-toggle-text">
              <span className="bud-toggle-title">Block new commits at cap</span>
              <span className="bud-toggle-sub">
                Stop new requisitions and timesheets from posting once {overPct}% is reached
              </span>
            </div>
            <button type="button" className="bud-toggle-switch"
                    aria-pressed={blockOver}
                    onClick={() => setBlockOver((v) => !v)} />
          </div>

          {/* Owner + notify */}
          <div className="bud-field">
            <label className="bud-field-label" htmlFor="bud-owner">Owner</label>
            <select id="bud-owner" className="bud-select"
                    value={owner} onChange={(e) => setOwner(e.target.value)}>
              <option>Amy Chen</option>
              <option>Nia Thompson</option>
              <option>Jamal Carter</option>
              <option>Priya Ramesh</option>
              <option>Sami Soto</option>
              <option>Devon Park</option>
              <option>Maya Chen</option>
              <option>Alex Moreno</option>
            </select>
          </div>
          <div className="bud-field">
            <label className="bud-field-label" htmlFor="bud-notify">Notify (comma-separated emails)</label>
            <input id="bud-notify" className="bud-input"
                   value={notify} onChange={(e) => setNotify(e.target.value)}
                   placeholder="amy.chen@dayforce.com, finance@dayforce.com" />
          </div>
        </div>

        <footer className="bud-panel-footer">
          <div className="bud-panel-footer-left">
            {mode === "edit" && (
              <button type="button" className="bud-btn bud-btn--ghost"
                      style={{ color: "var(--evr-interactive-error-default)" }}
                      onClick={handleDelete}>
                <Icon name="TrashCan" size={14} /> Delete
              </button>
            )}
          </div>
          <div className="bud-panel-footer-right">
            <button type="button" className="bud-btn bud-btn--secondary" onClick={onClose}>Cancel</button>
            <button type="button" className="bud-btn bud-btn--primary"
                    onClick={handleSave} disabled={!canSave && touched}>
              <Icon name="Check" size={14} />
              {mode === "edit" ? "Save changes" : "Create budget"}
            </button>
          </div>
        </footer>
      </aside>
    </React.Fragment>
  );
}

Object.assign(window, {
  BudgetsPage,
  bud_store, bud_upsert, bud_remove, bud_status,
});
