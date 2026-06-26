// =====================================================================
// Flex Work — Home › Insights
// Unified spend, budget, supplier and rate analytics for admins. This
// page absorbed the former "Financials" tab (May 2026) — every concept
// in this file is sourced from the same live arrays the rest of the
// product reads from:
//   · window.bud_store() / bud_status   (budgets seed in pages/budgets.jsx)
//   · window.SPEND_WEEKLY               (trailing 8-week spend)
//   · window.SUPPLIERS                  (decorated supplier scorecards)
//   · window.INVOICES                   (invoice list for AP aging)
// All KPI tiles, cards, and table rows follow Everest's Insights
// vocabulary (vms-card / vms-kpi / vms-bd-row). The chart-primitive
// helpers (fin-burn, fin-scope-row, fin-mix donut, fin-age aging) live
// in styles-financials.css and remain token-driven.
// =====================================================================

const { useState: useStateIns, useMemo: useMemoIns, useEffect: useEffectIns } = React;

// ---------------------------------------------------------------------
// Helpers — currency + formatting (currency-aware via curSymbol)
// ---------------------------------------------------------------------
const INS_SYM = () => typeof window !== "undefined" && window.curSymbol ?
window.curSymbol() : "$";
const INS_MONEY = (n) => {
  if (n == null || !Number.isFinite(n)) return "—";
  const neg = n < 0;
  const v = Math.abs(Math.round(n));
  return `${neg ? "-" : ""}${INS_SYM()}${v.toLocaleString("en-US")}`;
};
const INS_MONEY_CENTS = (n) => {
  if (n == null || !Number.isFinite(n)) return "—";
  const neg = n < 0;
  const intPart = Math.abs(Math.trunc(n));
  // If the source is a whole number, synthesize a stable, realistic
  // (non-zero) cent fraction so the demo doesn't read as ".00" — a hash
  // of the integer keeps the same value across re-renders.
  let cents;
  const frac = Math.abs(n) - intPart;
  if (frac > 0) {
    cents = Math.round(frac * 100);
  } else {
    // Stable 1..99 hash of the integer (no .00 in the demo).
    let h = intPart >>> 0;
    h = (h ^ h >>> 16) * 2246822507 >>> 0;
    h = (h ^ h >>> 13) * 3266489909 >>> 0;
    h = (h ^ h >>> 16) >>> 0;
    cents = h % 99 + 1;
  }
  const dollars = intPart.toLocaleString("en-US");
  const cc = String(cents).padStart(2, "0");
  return `${neg ? "-" : ""}${INS_SYM()}${dollars}.${cc}`;
};
const INS_SHORT = (n) => {
  if (n == null || !Number.isFinite(n)) return "—";
  const s = INS_SYM();
  const a = Math.abs(n);
  if (a >= 1_000_000) return `${n < 0 ? "-" : ""}${s}${(a / 1_000_000).toFixed(1)}M`;
  if (a >= 1_000) return `${n < 0 ? "-" : ""}${s}${(a / 1_000).toFixed(0)}k`;
  return `${n < 0 ? "-" : ""}${s}${a}`;
};
const INS_PCT = (a, b) => b > 0 ? Math.round(a / b * 100) : 0;
const INS_NUMERIC = (s) => {
  const n = parseFloat(String(s || "").replace(/[^0-9.\-]/g, ""));
  return Number.isFinite(n) ? n : 0;
};

// FY26 demo clock — Apr 1, 2026 → Mar 31, 2027. Today = May 19, 2026.
const INS_FY_LABEL = "FY 2026";
const INS_FY_MONTHS = ["Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar"];
const INS_FY_PACE = 0.133; // ~Day 49 / 365 — % of year elapsed
const INS_FY_MONTH_IDX = 1; // 0 = Apr (closed), 1 = May (current)
const INS_TODAY = new Date(2026, 4, 19);

function _parseInvDate(str) {
  // "MM.DD.YYYY" → Date
  const m = String(str || "").match(/^(\d{2})\.(\d{2})\.(\d{4})/);
  if (!m) return null;
  return new Date(parseInt(m[3], 10), parseInt(m[1], 10) - 1, parseInt(m[2], 10));
}
function _agingBucket(dueDate) {
  if (!dueDate) return null;
  const diffDays = Math.floor((INS_TODAY - dueDate) / (1000 * 60 * 60 * 24));
  if (diffDays <= 0) return "current";
  if (diffDays <= 30) return "0-30";
  if (diffDays <= 60) return "31-60";
  if (diffDays <= 90) return "61-90";
  return "90+";
}

// ---------------------------------------------------------------------
// KPI tile (Insights vocabulary — vms-kpi)
// ---------------------------------------------------------------------
function InsightsKpi({ label, value, delta, deltaKind, foot, alert, sub }) {
  return (
    <div className={"vms-kpi vms-kpi--static" + (alert ? " vms-kpi--alert" : "")}>
      <span className="vms-kpi-label">{label}</span>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <span className="vms-kpi-value tabular">{value}</span>
      </div>
      {sub && <span className="vms-kpi-sub">{sub}</span>}
      <span className="vms-kpi-foot">
        {delta && <span className={`vms-kpi-delta vms-kpi-delta--${deltaKind}`}>{delta}</span>}
        {foot && <span>{foot}</span>}
      </span>
    </div>);

}

// ---------------------------------------------------------------------
// Aggregations
// ---------------------------------------------------------------------
function _aggregateBudgets() {
  const rows = window.bud_store && window.bud_store() || window.__budgetsStore || [];
  const summary = rows.reduce((a, r) => {
    a.total += r.amount;
    a.spent += r.spent;
    a.committed += r.committed;
    return a;
  }, { total: 0, spent: 0, committed: 0 });
  summary.remaining = summary.total - summary.spent - summary.committed;
  summary.utilPct = INS_PCT(summary.spent + summary.committed, summary.total);
  // Flex Work optimization is forecast to land ~9% under plan by EOY —
  // smarter supplier mix, lower markups, fewer rush jobs.
  summary.forecastEOY = Math.round(summary.total * 0.91);
  summary.forecastSavings = summary.total - summary.forecastEOY;
  summary.overCount = rows.filter((r) => (window.bud_status ? window.bud_status(r).key : null) === "over").length;
  summary.warnCount = rows.filter((r) => (window.bud_status ? window.bud_status(r).key : null) === "warn").length;
  summary.rows = rows;

  const monthly = new Array(12).fill(0);
  rows.forEach((r) => (r.monthly || []).forEach((v, i) => {monthly[i] += v;}));
  summary.monthlyTotal = monthly;
  summary.monthlyPlan = monthly.map(() => Math.round(summary.total / 12));
  return summary;
}

function _scopeBreakdown() {
  const rows = window.bud_store && window.bud_store() || window.__budgetsStore || [];
  const SCOPE_META = {
    "location": { label: "Site", icon: "Location", color: "var(--evr-blue-400)" },
    "department": { label: "Department", icon: "Building", color: "var(--evr-purple-400)" },
    "cost-center": { label: "Department", icon: "PersonLines", color: "var(--evr-teal-400)" },
    "program": { label: "Program", icon: "Globe", color: "var(--evr-orange-400)" }
  };
  const map = {};
  rows.forEach((r) => {
    const k = r.scope;
    if (!map[k]) map[k] = { ...SCOPE_META[k], scope: k, total: 0, spent: 0, committed: 0, count: 0 };
    map[k].total += r.amount;
    map[k].spent += r.spent;
    map[k].committed += r.committed;
    map[k].count += 1;
  });
  return Object.values(map).
  map((m) => ({ ...m, util: INS_PCT(m.spent + m.committed, m.total) })).
  sort((a, b) => b.total - a.total);
}

function _topAtRisk(limit = 5) {
  const rows = window.bud_store && window.bud_store() || window.__budgetsStore || [];
  return rows.
  map((r) => ({
    r,
    status: window.bud_status && window.bud_status(r) || { key: "ontrack", pct: 0, label: "On track" }
  })).
  filter((x) => x.status.key !== "ontrack").
  sort((a, b) => b.status.pct - a.status.pct).
  slice(0, limit);
}

function _invoiceAging() {
  const list = window.INVOICES || [];
  const buckets = {
    "current": { label: "Current", count: 0, amount: 0, tone: "ok" },
    "0-30": { label: "1–30 days", count: 0, amount: 0, tone: "info" },
    "31-60": { label: "31–60 days", count: 0, amount: 0, tone: "warn" },
    "61-90": { label: "61–90 days", count: 0, amount: 0, tone: "warn" },
    "90+": { label: "90+ days", count: 0, amount: 0, tone: "err" }
  };
  list.forEach((inv) => {
    if (inv.status === "Paid") return;
    const due = _parseInvDate(inv.dueDate || inv.invDate);
    const b = _agingBucket(due);
    if (!b || !buckets[b]) return;
    buckets[b].count += 1;
    buckets[b].amount += INS_NUMERIC(inv.amount);
  });
  const order = ["current", "0-30", "31-60", "61-90", "90+"];
  const arr = order.map((k) => ({ key: k, ...buckets[k] }));
  const totalOpen = arr.reduce((s, r) => s + r.amount, 0);
  const totalOverdue = arr.filter((r) => r.key !== "current").reduce((s, r) => s + r.amount, 0);
  return { arr, totalOpen, totalOverdue };
}

// ---------------------------------------------------------------------
// FY26 burn vs plan — cumulative actuals + committed, with forecast +
// budget cap. Sourced from the rolled-up budgets store so editing any
// budget refreshes this chart.
// ---------------------------------------------------------------------
function BurnChart({ summary }) {
  const w = 1200,h = 260,padL = 64,padR = 28,padT = 32,padB = 36;
  const innerW = w - padL - padR,innerH = h - padT - padB;
  const n = 12;
  const stepX = innerW / (n - 1);
  const actual = summary.monthlyTotal;
  const plan = summary.monthlyPlan;
  const actualCum = actual.reduce((acc, v) => (acc.push((acc[acc.length - 1] || 0) + v), acc), []);
  const planCum = plan.reduce((acc, v) => (acc.push((acc[acc.length - 1] || 0) + v), acc), []);
  const yMax = Math.max(summary.total, planCum[n - 1], actualCum[n - 1]) * 1.08;

  const yScale = (v) => padT + innerH - v / yMax * innerH;
  const xAt = (i) => padL + i * stepX;

  const todayCum = actualCum[INS_FY_MONTH_IDX] || 0;
  const monthsRemaining = Math.max(1, n - 1 - INS_FY_MONTH_IDX);
  const forecastSlope = (summary.forecastEOY - todayCum) / monthsRemaining;

  // Build a full-length forecast series (actual through today, projected after)
  const forecastCumFull = [];
  for (let i = 0; i < n; i++) {
    forecastCumFull.push(
      i <= INS_FY_MONTH_IDX ?
      actualCum[i] :
      todayCum + forecastSlope * (i - INS_FY_MONTH_IDX)
    );
  }

  const planPath = planCum.map((v, i) => `${i === 0 ? "M" : "L"}${xAt(i).toFixed(1)} ${yScale(v).toFixed(1)}`).join(" ");
  const actualPathSolid = actualCum.slice(0, INS_FY_MONTH_IDX + 1).
  map((v, i) => `${i === 0 ? "M" : "L"}${xAt(i).toFixed(1)} ${yScale(v).toFixed(1)}`).join(" ");
  const forecastPath = forecastCumFull.
  slice(INS_FY_MONTH_IDX).
  map((v, j) => `${j === 0 ? "M" : "L"}${xAt(INS_FY_MONTH_IDX + j).toFixed(1)} ${yScale(v).toFixed(1)}`).
  join(" ");

  const capY = yScale(summary.total);
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((p) => p * yMax);

  // Hover state — progressive disclosure
  const [hoverIdx, setHoverIdx] = React.useState(null);
  const handleMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const xPx = (e.clientX - rect.left) / rect.width * w;
    let i = Math.round((xPx - padL) / stepX);
    if (i < 0) i = 0;
    if (i > n - 1) i = n - 1;
    setHoverIdx(i);
  };
  const handleLeave = () => setHoverIdx(null);

  const showTip = hoverIdx !== null;
  const idx = showTip ? hoverIdx : INS_FY_MONTH_IDX;
  const isPast = idx <= INS_FY_MONTH_IDX;
  const actualV = actualCum[idx];
  const forecastV = forecastCumFull[idx];
  const planV = planCum[idx];
  const cumV = isPast ? actualV : forecastV;
  const varV = cumV - planV;

  const ttW = 210,ttH = 140;
  const tipX = xAt(idx);
  let ttLeft = tipX + 14;
  if (ttLeft + ttW > w - padR) ttLeft = tipX - 14 - ttW;
  const ttTop = padT + 6;

  return (
    <div className="vms-card">
      <div className="vms-card-head fin-burn-head">
        <div>
          <h2 className="vms-card-title">{INS_FY_LABEL} burn vs plan</h2>
          <p className="vms-card-sub">
            Cumulative actuals and committed across {summary.rows.length} budgets
          </p>
        </div>
      </div>
      <svg
        className="fin-burn"
        viewBox={`0 0 ${w} ${h}`}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label="Cumulative spend vs plan"
        onMouseMove={handleMove}
        onMouseLeave={handleLeave}>
        
        {ticks.map((v, i) =>
        <g key={i}>
            <line x1={padL} x2={w - padR} y1={yScale(v)} y2={yScale(v)} className="fin-grid" />
            <text x={padL - 8} y={yScale(v)} textAnchor="end" dominantBaseline="central" className="fin-ax">
              {INS_SHORT(v)}
            </text>
          </g>
        )}

        {/* Cap line — quiet, no inline label (Allocated lives in header now) */}
        <line x1={padL} x2={w - padR} y1={capY} y2={capY} className="fin-cap-line" />

        {/* Series — area under actual, then plan, forecast, actual on top */}
        <path
          d={`${actualPathSolid} L${xAt(INS_FY_MONTH_IDX).toFixed(1)} ${yScale(0).toFixed(1)} L${xAt(0).toFixed(1)} ${yScale(0).toFixed(1)} Z`}
          className="fin-actual-area" />
        
        <path d={planPath} className="fin-plan-line" />
        <path d={forecastPath} className="fin-forecast-line" />
        <path d={actualPathSolid} className="fin-actual-line" />

        {/* Today divider */}
        <line x1={xAt(INS_FY_MONTH_IDX)} x2={xAt(INS_FY_MONTH_IDX)} y1={padT} y2={padT + innerH} className="fin-today-line" />

        {/* Resting endpoints (hidden while hovering) */}
        {!showTip &&
        <React.Fragment>
            <circle cx={xAt(INS_FY_MONTH_IDX)} cy={yScale(todayCum)} r="5" className="fin-actual-dot" />
            <circle cx={xAt(n - 1)} cy={yScale(summary.forecastEOY)} r="4" className="fin-forecast-dot" />
          </React.Fragment>
        }

        {/* X-axis months */}
        {INS_FY_MONTHS.map((m, i) =>
        <text key={m} x={xAt(i)} y={h - padB + 18} textAnchor="middle"
        className={"fin-ax fin-ax-month" + (i === INS_FY_MONTH_IDX ? " is-current" : "") + (showTip && i === idx ? " is-hover" : "")}>
            {m}
          </text>
        )}

        {/* Hover guideline + dots + tooltip */}
        {showTip &&
        <g className="fin-burn-hover">
            <line x1={tipX} x2={tipX} y1={padT} y2={padT + innerH} className="fin-hover-line" />
            <circle cx={tipX} cy={yScale(planV)} r="3.5" className="fin-hover-dot fin-hover-dot--plan" />
            {isPast ?
          <circle cx={tipX} cy={yScale(actualV)} r="4.5" className="fin-hover-dot fin-hover-dot--actual" /> :
          <circle cx={tipX} cy={yScale(forecastV)} r="4.5" className="fin-hover-dot fin-hover-dot--forecast" />
          }
            <foreignObject x={ttLeft} y={ttTop} width={ttW} height={ttH} style={{ overflow: "visible" }}>
              <div className="fin-burn-tt">
                <div className="fin-burn-tt-head">
                  {INS_FY_MONTHS[idx]} · {isPast ? "Actual" : "Projected"}
                </div>
                <div className="fin-burn-tt-row">
                  <i className="fin-sw fin-sw--actual" />
                  <span>{isPast ? "Spent + committed" : "Forecast"}</span>
                  <b className="tabular">{INS_SHORT(cumV)}</b>
                </div>
                <div className="fin-burn-tt-row">
                  <i className="fin-sw fin-sw--plan" />
                  <span>Plan</span>
                  <b className="tabular">{INS_SHORT(planV)}</b>
                </div>
                <div className="fin-burn-tt-row fin-burn-tt-delta">
                  <span>{isPast ? "Variance" : "Projected variance"}</span>
                  <b className={`tabular ${varV <= 0 ? "fin-pos" : "fin-neg"}`}>
                    {varV <= 0 ? "−" : "+"}{INS_SHORT(Math.abs(varV))}
                  </b>
                </div>
              </div>
            </foreignObject>
          </g>
        }

        {/* Mouse capture rect — must be on top so events fire even over text */}
        <rect x={padL} y={padT} width={innerW} height={innerH} fill="transparent" />
      </svg>
      <div className="fin-legend" style={{ justifyContent: "flex-start" }}>
        <span className="fin-legend-item"><i className="fin-sw fin-sw--actual" /> Actual + committed</span>
        <span className="fin-legend-item"><i className="fin-sw fin-sw--forecast" /> Forecast</span>
        <span className="fin-legend-item"><i className="fin-sw fin-sw--plan" /> Plan</span>
        <span className="fin-legend-item"><i className="fin-sw fin-sw--cap" /> Budget cap</span>
      </div>
    </div>);

}

// ---------------------------------------------------------------------
// Utilization by scope — Location / Dept / Cost-center / Program
// ---------------------------------------------------------------------
function ScopeBreakdown({ rows }) {
  if (!rows.length) return null;
  const open = () => window.flexGoTo && window.flexGoTo({ page: "settings", sub: "budgets" });
  return (
    <div className="vms-card">
      <div className="vms-card-head">
        <div>
          <h2 className="vms-card-title">Utilization by scope</h2>
        </div>
        <button type="button" className="vms-btn vms-btn--sm vms-btn--secondary" onClick={open}>Manage

        </button>
      </div>
      <div className="fin-scope-list">
        {rows.map((r) => {
          const remaining = r.total - r.spent - r.committed;
          const state = r.util >= 100 ? "over" : r.util >= 80 ? "warn" : "ok";
          return (
            <div className="fin-scope-row" key={r.scope} onClick={open} role="button" tabIndex={0}>
              <div className="fin-scope-head">
                <span className="fin-scope-icon" style={{ color: r.color }} aria-hidden="true">
                  <Icon name={r.icon} size={14} />
                </span>
                <span className="fin-scope-name">{r.label}</span>
                <span className={`fin-scope-pct fin-scope-pct--${state} tabular`}>{r.util}%</span>
              </div>
              <div className={`fin-bar fin-bar--${state}`}>
                <div className="fin-bar-track">
                  <div className="fin-bar-fill" style={{ width: `${Math.min(r.util, 100)}%`, background: r.color }} />
                </div>
              </div>
              <div className="fin-scope-foot">
                <span>{INS_MONEY(r.spent)} spent · {INS_MONEY(r.committed)} committed</span>
                <span className={remaining < 0 ? "fin-neg" : "fin-pos"}>
                  {remaining < 0 ? `${INS_MONEY(Math.abs(remaining))} over` : `${INS_MONEY(remaining)} remaining`}
                </span>
              </div>
            </div>);

        })}
      </div>
    </div>);

}

// ---------------------------------------------------------------------
// Top budgets at risk — over / approaching the cap, ranked by util
// ---------------------------------------------------------------------
function AtRiskList({ rows }) {
  return (
    <div className="vms-card">
      <div className="vms-card-head">
        <div>
          <h2 className="vms-card-title">Budgets at risk</h2>
        </div>
        <button type="button" className="vms-btn vms-btn--sm vms-btn--secondary" onClick={() => window.flexGoTo && window.flexGoTo({ page: "settings", sub: "budgets" })}>
          View all
        </button>
      </div>
      {rows.length === 0 ?
      <div className="fin-empty">
          <Icon name="ClipboardCircleCheck" size={32} />
          <p>Every budget is on pace. Keep an eye on holiday-premium accounts heading into Q4.</p>
        </div> :

      <div className="fin-risk-list">
          {rows.map(({ r, status }) => {
          const remaining = r.amount - r.spent - r.committed;
          return (
            <div className="fin-risk-row" key={r.id}
            onClick={() => window.flexGoTo && window.flexGoTo({ page: "settings", sub: "budgets" })}
            role="button" tabIndex={0}>
                <div className="fin-risk-body">
                  <div className="fin-risk-name">{r.name}</div>
                  <div className="fin-risk-meta">{r.scopeLabel} · {r.owner}</div>
                </div>
                <div className="fin-risk-bar">
                  <div className={`fin-bar fin-bar--${status.key}`}>
                    <div className="fin-bar-track">
                      <div className="fin-bar-fill" style={{ width: `${Math.min(status.pct, 100)}%` }} />
                    </div>
                  </div>
                </div>
                <div className="fin-risk-num">
                  <div className="tabular fin-risk-pct">{status.pct}%</div>
                  <div className={"fin-risk-rem " + (remaining < 0 ? "fin-neg" : "")}>
                    {remaining < 0 ? `-${INS_SHORT(Math.abs(remaining))}` : `${INS_SHORT(remaining)} left`}
                  </div>
                </div>
              </div>);

        })}
        </div>
      }
    </div>);

}

// ---------------------------------------------------------------------
// Weekly spend trend — last 8 weeks (Insights vms-bars vocabulary)
// ---------------------------------------------------------------------
const SPEND_TREND_SUPPLIERS = { gs: "GoodShift", sw: "StaffWise", th: "Talent Hub", ph: "Pro Hire", ss: "Skill Scouts" };
// Anchor week labels to a real calendar date. Each week starts on the
// Monday of that ISO week; "W-N" is N weeks before the current week,
// "This wk" is the current week.
function _spendTrendWeekStart(idx, total) {
  const today = window.flexToday ? window.flexToday() : new Date(2026, 4, 19);
  const monday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  // back up to Monday of the current ISO week (Mon = 1, Sun = 0)
  const dow = (monday.getDay() + 6) % 7;
  monday.setDate(monday.getDate() - dow);
  // step back (total - 1 - idx) weeks from the current Monday
  const d = new Date(monday);
  d.setDate(d.getDate() - (total - 1 - idx) * 7);
  return d;
}
function _spendTrendShortDate(d) {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
function _spendTrendRange(d) {
  const end = new Date(d);
  end.setDate(end.getDate() + 6);
  const sameMonth = d.getMonth() === end.getMonth();
  const a = _spendTrendShortDate(d);
  const b = sameMonth ? String(end.getDate()) : _spendTrendShortDate(end);
  return `${a} – ${b}`;
}

function SpendTrendChart({ weeks }) {
  if (!weeks.length) return null;
  const max = Math.max(...weeks.map((w) => w.total));
  const last = weeks[weeks.length - 1].total;
  const lastPrev = weeks[weeks.length - 2]?.total;
  const lastWow = lastPrev ? (last - lastPrev) / lastPrev * 100 : null;
  const [hover, setHover] = React.useState(null);
  const activeIdx = hover != null ? hover : weeks.length - 1;
  const active = weeks[activeIdx];
  const prev = weeks[activeIdx - 1]?.total;
  const wow = prev ? (active.total - prev) / prev * 100 : null;
  // Pre-compute the calendar date for each bar so the label and the
  // tooltip stay in lockstep.
  const weekStarts = weeks.map((_, i) => _spendTrendWeekStart(i, weeks.length));
  return (
    <div className="vms-card">
      <div className="vms-card-head">
        <div>
          <h2 className="vms-card-title">Weekly spend</h2>
          <div className="fin-trend-big tabular">{INS_MONEY(last)}</div>
          <div className="fin-trend-sub">
            Spent this week
            {lastWow != null &&
            <>
                <span className="fin-trend-sub-sep" aria-hidden="true">·</span>
                <span className={"fin-trend-sub-wow " + (lastWow >= 0 ? "fin-trend-sub-wow--up" : "fin-trend-sub-wow--down")}>
                  {lastWow >= 0 ? "+" : ""}{lastWow.toFixed(1)}% vs prior week
                </span>
              </>
            }
          </div>
        </div>
      </div>
      <div className="fin-trend-chart">
        <div className="vms-bars vms-bars--tall" style={{ "--n": weeks.length }}>
          {weeks.map((w, i) => {
            const isCurrent = i === weeks.length - 1;
            const isActive = hover === i;
            const isDim = hover != null && hover !== i;
            const h = Math.max(6, Math.round(w.total / max * 100));
            return (
              <div key={w.wk}
                className={"vms-bar fin-trend-bar" + (isCurrent ? " is-current" : "") + (isActive ? " is-active" : "") + (isDim ? " is-dim" : "")}
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover((cur) => cur === i ? null : cur)}>
                <div className="vms-bar-stack">
                  <div className="vms-bar-fg" style={{ height: `${h}%` }} />
                </div>
                <span className="vms-bar-label">
                  {_spendTrendShortDate(weekStarts[i])}
                </span>
              </div>);

          })}
        </div>
        <div className={"fin-trend-tip" + (hover != null ? " is-shown" : "")}
          style={{ left: `calc(${(activeIdx + 0.5) / weeks.length * 100}% )` }}
          aria-hidden={hover == null}>
          <div className="fin-trend-tip-head">
            <span className="fin-trend-tip-wk">
              {_spendTrendRange(weekStarts[activeIdx])}
              {activeIdx === weeks.length - 1 && <span className="fin-trend-tip-sub"> · this week</span>}
            </span>
            <span className="fin-trend-tip-total tabular">{INS_MONEY(active.total)}</span>
          </div>
          {wow != null &&
          <div className={"fin-trend-tip-wow " + (wow >= 0 ? "fin-trend-tip-wow--up" : "fin-trend-tip-wow--down")}>
              {wow >= 0 ? "+" : ""}{wow.toFixed(1)}% vs prior week
            </div>
          }
          <div className="fin-trend-tip-list">
            {Object.entries(active.sup || {}).
            sort((a, b) => b[1] - a[1]).
            map(([k, v]) =>
            <div key={k} className="fin-trend-tip-row">
                  <span>{SPEND_TREND_SUPPLIERS[k] || k}</span>
                  <span className="tabular">{INS_MONEY(v)}</span>
                </div>
            )}
          </div>
        </div>
      </div>
    </div>);

}

// ---------------------------------------------------------------------
// Spend by supplier — YTD (Insights vms-bd-row vocabulary)
// ---------------------------------------------------------------------
function SupplierSpendBreakdown() {
  const list = (window.SUPPLIERS || []).
  filter((s) => s.status === "Active" && s._sc && s._sc.fillRate != null).
  map((s) => ({
    id: s.id,
    name: s.name,
    bg: s.bg,
    spend: INS_NUMERIC(s.spend),
    workers: s.workers,
    markup: s._sc.rateMarkup,
    rate: s._sc.rateAvg
  })).
  sort((a, b) => b.spend - a.spend);
  const total = list.reduce((sum, s) => sum + s.spend, 0);

  return (
    <div className="vms-card fin-supplier-card">
      <div className="vms-card-head">
        <div>
          <h2 className="vms-card-title">Spend by supplier</h2>
        </div>
        <button type="button" className="vms-btn vms-btn--sm vms-btn--secondary" onClick={() => window.flexGoTo && window.flexGoTo("suppliers")}>
          View all
        </button>
      </div>
      <div className="vms-breakdown fin-supplier-scroll">
        {list.map((s) => {
          const pct = Math.round(s.spend / total * 100);
          const short = (s.name || "").split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
          return (
            <div key={s.id} className="vms-bd-row fin-supplier-row" role="button" tabIndex={0}
            onClick={() => window.flexGoTo && window.flexGoTo({ page: "suppliers", sub: "details", id: s.id })}>
              <span className="sup-avatar fin-supplier-avatar"
                style={{ background: "var(--evr-neutral-95)", color: "var(--evr-content-primary-highemp)", width: 32, height: 32, fontSize: 11 }}
                aria-label={s.name}>
                {short}
              </span>
              <div className="vms-bd-name">{s.name}</div>
              <div className="vms-bd-bar">
                <div className="vms-meter">
                  <span className="vms-meter-num">{pct}%</span>
                  <span className="vms-meter-track">
                    <span className="vms-meter-fill" style={{ width: `${pct}%`, background: "var(--evr-neutral-60)" }} />
                  </span>
                </div>
              </div>
              <div className="vms-bd-amt tabular">{INS_MONEY(s.spend)}</div>
            </div>);

        })}
      </div>
    </div>);

}

// ---------------------------------------------------------------------
// Cost composition — where every dollar lands (donut)
// ---------------------------------------------------------------------
function CostMix({ summary }) {
  const rows = summary.rows || [];
  // Cost-center budgets give us actual OT + holiday burns; the rest is
  // backed out from total spent so the math always reconciles.
  const otBudget = rows.find((r) => r.id === "b-201");
  const holBudget = rows.find((r) => r.id === "b-202");
  const oneTime = rows.find((r) => r.id === "b-203");
  const allBurn = summary.spent + summary.committed;
  const otBurn = otBudget ? otBudget.spent + otBudget.committed : Math.round(allBurn * 0.12);
  const holBurn = holBudget ? holBudget.spent + holBudget.committed : Math.round(allBurn * 0.05);
  const otherFees = oneTime ? oneTime.spent + oneTime.committed : Math.round(allBurn * 0.03);
  const regularHrs = Math.max(0, allBurn - otBurn - holBurn - otherFees);

  const slices = [
  { key: "reg", label: "Regular hours", value: regularHrs, color: "var(--evr-blue-400)" },
  { key: "ot", label: "Overtime premium", value: otBurn, color: "var(--evr-orange-400)" },
  { key: "holiday", label: "Holiday premium", value: holBurn, color: "var(--evr-purple-400)" },
  { key: "fees", label: "Fees & one-time", value: otherFees, color: "var(--evr-teal-400)" }].
  filter((s) => s.value > 0);

  const total = slices.reduce((s, x) => s + x.value, 0) || 1;
  let start = 0;
  const stops = slices.map((s) => {
    const pct = s.value / total * 100;
    const stop = `${s.color} ${start}% ${start + pct}%`;
    start += pct;
    return stop;
  }).join(", ");

  return (
    <div className="vms-card fin-mix-card">
      <div className="vms-card-head">
        <div>
          <h2 className="vms-card-title">Cost composition</h2>
        </div>
      </div>
      <div className="fin-mix fin-mix--stacked">
        <div className="fin-mix-donut fin-mix-donut--lg" style={{ background: `conic-gradient(${stops})` }} aria-hidden="true">
          <div className="fin-mix-donut-hole">
            <span className="fin-mix-donut-label">YTD</span>
            <span className="fin-mix-donut-value tabular">{INS_SHORT(total)}</span>
          </div>
        </div>
        <ul className="fin-mix-legend fin-mix-legend--full">
          {slices.map((s) => {
            const pct = Math.round(s.value / total * 100);
            return (
              <li key={s.key}>
                <span className="fin-mix-sw" style={{ background: s.color }} aria-hidden="true" />
                <span className="fin-mix-label">{s.label}</span>
                <span className="fin-mix-pct tabular">{pct}%</span>
                <span className="fin-mix-val tabular">{INS_MONEY(s.value)}</span>
              </li>);

          })}
        </ul>
      </div>
    </div>);

}

// ---------------------------------------------------------------------
// Hourly rate benchmark — Production Associate, by supplier
// ---------------------------------------------------------------------
function RateBenchmark() {
  const list = (window.SUPPLIERS || []).
  filter((s) => s._sc && s._sc.rateAvg != null && s.status === "Active").
  map((s) => ({ id: s.id, name: s.name, bg: s.bg, rate: s._sc.rateAvg, markup: s._sc.rateMarkup })).
  sort((a, b) => a.rate - b.rate);
  const min = list[0]?.rate || 0;
  const max = list[list.length - 1]?.rate || 0;
  const avg = list.reduce((s, r) => s + r.rate, 0) / Math.max(1, list.length);
  const range = max - min || 1;

  return (
    <div className="vms-card">
      <div className="vms-card-head">
        <div>
          <h2 className="vms-card-title">Hourly rate benchmark · Production Associate</h2>
          <p className="vms-card-sub">Bill rate including supplier markup · live for April 2026</p>
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {list.map((s) => {
          const pos = (s.rate - min) / range * 100;
          const vsAvg = s.rate - avg;
          return (
            <div key={s.id} style={{ display: "grid", gridTemplateColumns: "140px 1fr 96px", gap: 14, alignItems: "center" }}>
              <span style={{ font: "var(--evr-body2-bold)", color: "var(--evr-content-primary-highemp)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.name}</span>
              <div style={{ position: "relative", height: 8, background: "var(--evr-neutral-93)", borderRadius: 999 }}>
                <span style={{ position: "absolute", left: "50%", top: -2, bottom: -2, width: 1, background: "var(--evr-border-decorative-default)" }} aria-hidden="true" />
                <span style={{
                  position: "absolute",
                  left: `${pos}%`,
                  top: "50%",
                  transform: "translate(-50%,-50%)",
                  width: 14, height: 14,
                  background: s.bg,
                  borderRadius: 999,
                  boxShadow: "0 0 0 2px var(--evr-surface-primary-default)"
                }} />
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 6, alignItems: "baseline" }}>
                <span className="tabular" style={{ font: "var(--evr-body2-bold)" }}>{INS_SYM()}{s.rate.toFixed(2)}</span>
                <span className={"vms-kpi-delta " + (vsAvg < 0 ? "vms-kpi-delta--good-down" : "vms-kpi-delta--bad-up")}>
                  {vsAvg < 0 ? "" : "+"}{vsAvg.toFixed(2)}
                </span>
              </div>
            </div>);

        })}
        <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 8, borderTop: "1px solid var(--evr-border-decorative-lowemp)", font: "var(--evr-caption)", color: "var(--evr-content-primary-lowemp)" }}>
          <span>Floor {INS_SYM()}{min.toFixed(2)}/h</span>
          <span>Average {INS_SYM()}{avg.toFixed(2)}/h</span>
          <span>Ceiling {INS_SYM()}{max.toFixed(2)}/h</span>
        </div>
      </div>
    </div>);

}

// ---------------------------------------------------------------------
// Invoice aging — AP-style aging buckets for unpaid invoices
// ---------------------------------------------------------------------
function InvoiceAging({ aging }) {
  const maxAmt = Math.max(...aging.arr.map((b) => b.amount), 1);
  return (
    <div className="vms-card">
      <div className="vms-card-head">
        <div>
          <h2 className="vms-card-title">Invoice aging</h2>
          <p className="vms-card-sub">
            {INS_MONEY(aging.totalOpen)} open
            {aging.totalOverdue > 0 && <span style={{ color: "var(--evr-red-700)" }}> · {INS_MONEY(aging.totalOverdue)} overdue</span>}
          </p>
        </div>
        <button type="button" className="vms-btn vms-btn--sm vms-btn--secondary" onClick={() => window.flexGoTo && window.flexGoTo("invoices")}>
          Open AP
        </button>
      </div>
      <div className="fin-age-grid">
        {aging.arr.map((b) => {
          const w = Math.max(8, Math.round(b.amount / maxAmt * 100));
          return (
            <div className={`fin-age-col fin-age-col--${b.tone}`} key={b.key}>
              <span className="fin-age-label">{b.label}</span>
              <span className="fin-age-amount tabular">{INS_MONEY(b.amount)}</span>
              <span className="fin-age-count">{b.count} invoice{b.count === 1 ? "" : "s"}</span>
              <div className="fin-age-bar"><span style={{ width: `${w}%` }} /></div>
            </div>);

        })}
      </div>
    </div>);

}

// ---------------------------------------------------------------------
// Realized savings — locked-in rate-card reductions
// ---------------------------------------------------------------------
function SavingsCard() {
  // Anchor to the $10M baseline; multiply through TEMP_SPEND_SCALE so
  // realized / projected savings scale with the active tier.
  const _sc = (typeof window.TEMP_SPEND_SCALE === "number") ? window.TEMP_SPEND_SCALE : 1;
  const _s = (n) => Math.max(1, Math.round((n * _sc) / 10) * 10);
  return (
    <div className="vms-card" style={{ background: "var(--evr-green-50)", borderColor: "var(--evr-green-200)" }}>
      <div className="vms-card-head">
        <div>
          <h2 className="vms-card-title" style={{ color: "var(--evr-green-700)" }}>Realized savings · April</h2>
          <p className="vms-card-sub">Locked-in rate-card reductions vs. last quarter</p>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 18 }}>
        <div>
          <span className="vms-kpi-label">Total realized</span>
          <div className="vms-scorebig"><span className="vms-scorebig-num" style={{ fontSize: 32, color: "var(--evr-green-700)" }}>{INS_MONEY(_s(18420))}</span></div>
          <span className="vms-kpi-foot">across 4 active rate cards</span>
        </div>
        <div>
          <span className="vms-kpi-label">Projected (90d)</span>
          <div className="vms-scorebig"><span className="vms-scorebig-num" style={{ fontSize: 32, color: "var(--evr-green-700)" }}>{INS_MONEY(_s(54600))}</span></div>
          <span className="vms-kpi-foot">if current mix holds</span>
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, paddingTop: 12, borderTop: "1px solid var(--evr-green-200)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", font: "var(--evr-body2)" }}>
          <span>GoodShift · Production Associate</span>
          <span className="tabular" style={{ fontWeight: "var(--evr-fw-bold)", color: "var(--evr-content-primary-highemp)" }}>{INS_MONEY(_s(8200))}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", font: "var(--evr-body2)" }}>
          <span>Pro Hire · Line Manager bundle</span>
          <span className="tabular" style={{ fontWeight: "var(--evr-fw-bold)", color: "var(--evr-content-primary-highemp)" }}>{INS_MONEY(_s(5940))}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", font: "var(--evr-body2)" }}>
          <span>Talent Hub · OT cap renegotiation</span>
          <span className="tabular" style={{ fontWeight: "var(--evr-fw-bold)", color: "var(--evr-content-primary-highemp)" }}>{INS_MONEY(_s(4280))}</span>
        </div>
      </div>
    </div>);

}

// ---------------------------------------------------------------------
// Section header — groups the page into thematic strips (Budget
// health · Spend & supplier mix · Rate intelligence). Type uses the
// Everest display font so the header is unmistakably structural.
// ---------------------------------------------------------------------
function SectionHead({ title, sub }) {
  return (
    <header style={{ display: "flex", flexDirection: "column", gap: 4, padding: "4px 0 0" }}>
      <h2 style={{
        margin: 0,
        fontFamily: "var(--evr-font-display)",
        fontWeight: "var(--evr-fw-bold)",
        font: "var(--evr-h3)",
        color: "var(--evr-content-primary-highemp)",
        letterSpacing: "-0.01em"
      }}>{title}</h2>
      <p style={{
        margin: 0,
        font: "var(--evr-body2)",
        color: "var(--evr-content-primary-lowemp)",
        maxWidth: 720
      }}>{sub}</p>
    </header>);

}

// ---------------------------------------------------------------------
// Page root
// ---------------------------------------------------------------------
function InsightsPage({ reloadKey, onReload, embedded = false }) {
  // The budgets store is mutable. Subscribe so editing on Settings ›
  // Budgets refreshes all derived charts.
  const [tick, setTick] = useStateIns(0);
  useEffectIns(() => {
    const onChange = () => setTick((t) => t + 1);
    window.addEventListener("budgets:change", onChange);
    return () => window.removeEventListener("budgets:change", onChange);
  }, []);

  const summary = useMemoIns(_aggregateBudgets, [reloadKey, tick]);
  const scopeRows = useMemoIns(_scopeBreakdown, [reloadKey, tick]);
  const atRisk = useMemoIns(() => _topAtRisk(7), [reloadKey, tick]);
  const aging = useMemoIns(_invoiceAging, [reloadKey, tick]);

  const forecastOverPlan = summary.forecastEOY - summary.total;
  const summaryUtilState = summary.utilPct >= 100 ? "over" : summary.utilPct >= 80 ? "warn" : "ontrack";
  const pacePt = summary.utilPct - Math.round(INS_FY_PACE * 100);

  return (
    <React.Fragment>
      {!embedded &&
      <Omnibar icon="BarChart" title="Insights">
          <button type="button" className="iconbtn" onClick={onReload} aria-label="Reload" title="Reload">
            <Icon name="Refresh" size={18} />
          </button>
          <button type="button" className="vms-btn vms-btn--sm vms-btn--secondary" onClick={() => showToast("Exported CSV")}>
            <Icon name="Export" size={14} />Export
          </button>
        </Omnibar>
      }

      <div className={"vms-page" + (embedded ? " vms-page--embedded" : "")} key={reloadKey} data-screen-label="Insights" style={{ gap: 56 }}>
        {/* KPI strip — six tiles covering budget posture + cost-per-hour.
              Forced to a 3-wide grid so each row reads as a coherent triad. */}
        <div className="vms-kpis" style={{ gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }}>
          <InsightsKpi
            label={`Allocated · ${INS_FY_LABEL}`}
            value={INS_MONEY_CENTS(summary.total)}
            sub={`Across ${summary.rows.length} active budgets`} />
          
          <InsightsKpi
            label="Spent and committed"
            value={INS_MONEY_CENTS(summary.spent + summary.committed)}
            sub={`${summary.utilPct}% of plan · ${pacePt >= 0 ? "+" : ""}${pacePt}pt vs pace`} />
          
          <InsightsKpi
            label="Forecast EOY"
            value={INS_MONEY_CENTS(summary.forecastEOY)}
            alert={forecastOverPlan > 0}
            sub={forecastOverPlan > 0 ?
            `${INS_MONEY(forecastOverPlan)} over plan` :
            `${INS_MONEY(Math.abs(forecastOverPlan))} under plan`} />
          
          <InsightsKpi
            label="Spend (this week)"
            value={INS_MONEY_CENTS(84_600 * (window.TEMP_SPEND_SCALE || 1))}
            sub="−2.4% vs prior week" />
          
          <InsightsKpi
            label="Avg markup"
            value="31.4%"
            sub="−0.6pt vs FY25 avg" />
          
          <InsightsKpi
            label="Fulfillment rate"
            value="94.2%"
            sub="Target 92% · 7-day rolling" />
          
        </div>

        {/* Budget health section */}
        <section style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <SectionHead
            title="Budget health"
            sub="FY 2026 burn vs plan, scope utilization, and budgets nearing cap." />
          
          <BurnChart summary={summary} />
          <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)", gap: 20 }}>
            <ScopeBreakdown rows={scopeRows} />
            <AtRiskList rows={atRisk} />
          </div>
        </section>

        {/* Spend & supplier mix section */}
        <section style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <SectionHead
            title="Spend & supplier mix"
            sub="Trailing-week spend, supplier concentration, and pay-type mix." />
          
          <SpendTrendChart weeks={window.SPEND_WEEKLY || []} />
          <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)", gap: 20, alignItems: "stretch" }}>
            <div style={{ position: "relative", minHeight: 0 }}>
              <SupplierSpendBreakdown />
            </div>
            <CostMix summary={summary} />
          </div>
        </section>
      </div>
    </React.Fragment>);

}

Object.assign(window, { InsightsPage });