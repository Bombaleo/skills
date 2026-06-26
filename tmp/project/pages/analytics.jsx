// =====================================================================
// Flex Work — Analytics module
// Top-level navigation entry with drilldown sub-pages:
//   · Overview  — KPI dashboard matching design spec
//   · Spend     — spend deep dive
//   · Shifts    — booked / filled deep dive
//   · Suppliers — supplier scorecard analytics
//   · Workforce — worker / location analytics
//
// Each KPI card on the Overview also drills into the matching sub-page.
// =====================================================================

const { useState: useStateAn, useMemo: useMemoAn } = React;

// ---------- Sub-nav config (consumed by chrome.jsx via window) ----------
const ANALYTICS_SECTIONS = [
{ id: "overview", label: "Overview", icon: "Performance" },
{ id: "spend", label: "Spend", icon: "Wallet" },
{ id: "shifts", label: "Shifts", icon: "Calendar" },
{ id: "suppliers", label: "Suppliers", icon: "Building" },
{ id: "workforce", label: "Workforce", icon: "Employees" }];


// ---------- Synthesized monthly series ----------------------------------
// 7 trailing months ending at the current period. Deterministic so the
// numbers don't churn between renders. Fill rate is derived per-month.
// Multiplied through the active temp-spend scale (see pages/temp-spend.jsx)
// so the same monthly shape reads as $1M or $500M+ depending on tier.
const _AN_SCALE = typeof window !== "undefined" && typeof window.TEMP_SPEND_SCALE === "number" ? window.TEMP_SPEND_SCALE : 1;
const _scaleN = (n, step) => {
  const v = n * _AN_SCALE;
  return step ? Math.max(0, Math.round(v / step) * step) : Math.round(v);
};
const AN_MONTHS = [
{ key: "aug-25", label: "Aug 2025", booked: _scaleN(2094), filled: _scaleN(1992), spend: _scaleN(198400, 100), committed: _scaleN(4820) },
{ key: "sep-25", label: "Sep 2025", booked: _scaleN(2731), filled: _scaleN(2376), spend: _scaleN(248900, 100), committed: _scaleN(4310) },
{ key: "oct-25", label: "Oct 2025", booked: _scaleN(2475), filled: _scaleN(2079), spend: _scaleN(226350, 100), committed: _scaleN(5180) },
{ key: "nov-25", label: "Nov 2025", booked: _scaleN(2297), filled: _scaleN(2113), spend: _scaleN(212620, 100), committed: _scaleN(4140) },
{ key: "dec-25", label: "Dec 2025", booked: _scaleN(2781), filled: _scaleN(2670), spend: _scaleN(264800, 100), committed: _scaleN(5360) },
{ key: "jan-26", label: "Jan 2026", booked: _scaleN(2094), filled: _scaleN(1947), spend: _scaleN(187940, 100), committed: _scaleN(4218) },
{ key: "feb-26", label: "Feb 2026", booked: _scaleN(1590), filled: _scaleN(1194), spend: _scaleN(124714, 100), committed: _scaleN(5810) }];


const AN_TOTALS = (() => {
  const booked = AN_MONTHS.reduce((s, m) => s + m.booked, 0);
  const filled = AN_MONTHS.reduce((s, m) => s + m.filled, 0);
  const spend = AN_MONTHS.reduce((s, m) => s + m.spend, 0);
  const committed = Math.round(33838.55 * _AN_SCALE * 100) / 100;
  return {
    booked,
    filled,
    fillRate: Math.round(filled / booked * 100),
    spend,
    committed,
    spendDelta: Math.round(-21483.62 * _AN_SCALE * 100) / 100,
    committedDelta: Math.round(-1391.95 * _AN_SCALE * 100) / 100,
    bookedDelta: Math.max(1, Math.round(321 * _AN_SCALE)),
    filledDelta: Math.max(1, Math.round(241 * _AN_SCALE)),
    fillRateDelta: 3
  };
})();

// ---------- Filter chip / pill -------------------------------------------
function AnFilterPill({ label, value, options, onChange }) {
  const openOpts = (e) => {
    openMenu(e.currentTarget, [
    { header: label },
    ...options.map((o) => ({
      icon: o.value === value ? "Check" : o.icon || "Filter",
      label: o.label,
      onClick: () => onChange && onChange(o.value)
    }))]
    );
  };
  const display = (options.find((o) => o.value === value) || {}).label || label;
  const active = value && value !== "all";
  return (
    <button
      type="button"
      className="an-pill"
      data-active={active ? "true" : "false"}
      onClick={openOpts}>
      
      <span>{display}</span>
      <span className="an-pill-chev" aria-hidden="true">
        <Icon name="ChevronDown" size={14} />
      </span>
    </button>);

}

// ---------- Drill icon (corner brackets) ---------------------------------
function AnDrillIcon({ size = 18 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="square"
      strokeLinejoin="miter"
      aria-hidden="true">
      
      <polyline points="15,4 20,4 20,9" />
      <polyline points="9,20 4,20 4,15" />
      <line x1="20" y1="4" x2="14" y2="10" />
      <line x1="4" y1="20" x2="10" y2="14" />
    </svg>);

}

// ---------- KPI card -----------------------------------------------------
function AnKpi({ label, value, delta, deltaKind = "flat", large = false }) {
  return (
    <div className="an-kpi an-kpi--static">
      <div className="an-kpi-head">
        <span className="an-kpi-label">{label}</span>
      </div>
      <span className={"an-kpi-value" + (large ? " an-kpi-value--lg" : "")}>{value}</span>
      {delta &&
      <span className={"an-kpi-delta an-kpi-delta--" + deltaKind}>{delta}</span>
      }
    </div>);

}

function AnOrbDown() {
  return (
    <span className="an-kpi-orb an-kpi-orb--down" aria-hidden="true">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="12" y1="4" x2="12" y2="19" />
        <polyline points="6 13 12 19 18 13" />
      </svg>
    </span>);

}
function AnOrbUp() {
  return (
    <span className="an-kpi-orb an-kpi-orb--up" aria-hidden="true">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="12" y1="20" x2="12" y2="5" />
        <polyline points="6 11 12 5 18 11" />
      </svg>
    </span>);

}
function AnOrbDonut({ pct }) {
  return (
    <span
      className="an-donut"
      style={{ "--pct": pct }}
      aria-hidden="true" />);


}

// ---------- The shifts-by-month bar+line chart ---------------------------
// Inline SVG bar (booked + filled) chart with overlaid fill-rate line.
function AnShiftsChart({ months, height = 360 }) {
  const padL = 56;
  const padR = 24;
  const padT = 36;
  const padB = 48;
  const W = 1100;
  const H = height;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;

  // Nice y-axis (round step / max so labels are "70k" / "60k" — not 59,657.14)
  const rawMax = Math.max(...months.map((m) => Math.max(m.booked, m.filled)));
  const yTicks = 5;
  const niceStep = (() => {
    const rough = rawMax / yTicks;
    const mag = Math.pow(10, Math.floor(Math.log10(rough)));
    const norm = rough / mag;
    let nice;
    if (norm <= 1) nice = 1;else
    if (norm <= 2) nice = 2;else
    if (norm <= 2.5) nice = 2.5;else
    if (norm <= 5) nice = 5;else
    nice = 10;
    return nice * mag;
  })();
  const yMax = Math.ceil(rawMax / niceStep) * yTicks > yTicks * niceStep ?
  Math.ceil(rawMax / niceStep) * niceStep :
  yTicks * niceStep;

  const groupW = innerW / months.length;
  const barW = Math.min(28, groupW * 0.22);
  const gap = 4;

  const yOf = (v) => padT + innerH - v / yMax * innerH;
  const yOfPct = (p) => padT + innerH - p / 100 * innerH;

  // Axis label: 70000 -> "70k", 1500000 -> "1.5M"
  const fmtCount = (v) => {
    if (v >= 1e6) {
      const m = v / 1e6;
      const txt = m >= 10 ? m.toFixed(0) : m.toFixed(2).replace(/\.?0+$/, "");
      return txt + "M";
    }
    if (v >= 1e3) return Math.round(v / 1e3).toLocaleString("en-US") + "k";
    return v.toLocaleString("en-US");
  };
  const shortLabel = (label) => label.replace(/\s(\d{2})(\d{2})$/, " '$2");

  const linePts = months.map((m, i) => {
    const cx = padL + i * groupW + groupW / 2;
    const pct = Math.round(m.filled / m.booked * 100);
    return { x: cx, y: yOfPct(pct), pct, label: m.label };
  });

  const [hover, setHover] = React.useState(null);
  const active = hover != null ? months[hover] : null;
  const activeLine = hover != null ? linePts[hover] : null;
  const tipLeftPct = hover != null ?
  (padL + hover * groupW + groupW / 2) / W * 100 :
  0;
  const tipBottomPct = hover != null ?
  (H - Math.min(yOf(months[hover].booked), activeLine.y)) / H * 100 :
  0;

  return (
    <div className="an-chart-wrap">
    <svg className="an-chart" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet">
      {/* Y grid */}
      <g className="an-grid">
        {Array.from({ length: yTicks + 1 }).map((_, i) => {
            const y = padT + innerH / yTicks * i;
            return <line key={i} x1={padL} x2={W - padR} y1={y} y2={y} />;
          })}
      </g>
      {/* Y axis labels (left: counts) */}
      <g className="an-axis">
        {Array.from({ length: yTicks + 1 }).map((_, i) => {
            const v = yMax - i * niceStep;
            const y = padT + innerH / yTicks * i;
            return (
              <text key={i} x={padL - 10} y={y + 4} textAnchor="end">
              {fmtCount(v)}
            </text>);

          })}
      </g>

      {/* Bars (no inline data labels — see tooltip) */}
      {months.map((m, i) => {
          const gx = padL + i * groupW;
          const cx = gx + groupW / 2;
          const bookedX = cx - barW - gap / 2;
          const filledX = cx + gap / 2;
          const bookedY = yOf(m.booked);
          const filledY = yOf(m.filled);
          const bookedH = innerH + padT - bookedY;
          const filledH = innerH + padT - filledY;
          const isActive = hover === i;
          const isDim = hover != null && hover !== i;
          return (
            <g key={m.key}
            className={"an-bar-hit" + (isActive ? " is-active" : "") + (isDim ? " is-dim" : "")}
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover((cur) => cur === i ? null : cur)}>
            <rect x={gx} y={padT} width={groupW} height={innerH} fill="transparent" />
            <rect className="an-bar-booked" x={bookedX} y={bookedY} width={barW} height={bookedH} rx="2" />
            <rect className="an-bar-filled" x={filledX} y={filledY} width={barW} height={filledH} rx="2" />
            <text x={cx} y={H - padB + 22} textAnchor="middle" style={{ fontWeight: 600, fill: "var(--evr-content-primary-default)" }}>
              {shortLabel(m.label)}
            </text>
          </g>);

        })}

      {/* Fill-rate line (no per-point labels — see tooltip) */}
      <polyline
          className="an-line"
          points={linePts.map((p) => `${p.x},${p.y}`).join(" ")} />
      {linePts.map((p, i) => {
          const isDim = hover != null && hover !== i;
          return (
            <circle key={i} className={"an-line-dot" + (isDim ? " is-dim" : "")} cx={p.x} cy={p.y} r="3.5" />);

        })}
    </svg>
    <div
        className={"an-chart-tip" + (active ? " is-shown" : "")}
        style={{ left: tipLeftPct + "%", bottom: tipBottomPct + "%" }}
        aria-hidden={!active}>
      <div className="an-chart-tip-label">{active ? shortLabel(active.label) : ""}</div>
      {active &&
        <div className="an-chart-tip-list">
          <div className="an-chart-tip-row">
            <span><span className="an-chart-tip-dot an-chart-tip-dot--booked" />Booked</span>
            <span className="tabular">{active.booked.toLocaleString()}</span>
          </div>
          <div className="an-chart-tip-row">
            <span><span className="an-chart-tip-dot an-chart-tip-dot--filled" />Filled</span>
            <span className="tabular">{active.filled.toLocaleString()}</span>
          </div>
          <div className="an-chart-tip-row">
            <span><span className="an-chart-tip-dot an-chart-tip-dot--line" />Fill rate</span>
            <span className="tabular">{activeLine.pct}%</span>
          </div>
        </div>
        }
    </div>
    </div>);

}

// ---------- Filter bar (Agency / Location / Period) ----------------------
function AnFilterBar({ filters, setFilters }) {
  // Agency options from active suppliers.
  const agencies = useMemoAn(() => {
    const list = (window.SUPPLIERS || []).filter((s) => s.status === "Active");
    return [{ value: "all", label: "All agencies" }].concat(
      list.map((s) => ({ value: s.id, label: s.name, icon: "Building" }))
    );
  }, []);
  const locations = useMemoAn(() => {
    const list = (window.LOCATIONS || []).filter((l) => l.status === "Active");
    return [{ value: "all", label: "All sites" }].concat(
      list.map((l) => ({ value: l.id, label: l.name, icon: "Location" }))
    );
  }, []);
  const periods = [
  { value: "all", label: "Last 7 months", icon: "Calendar" },
  { value: "3m", label: "Last 3 months", icon: "Calendar" },
  { value: "ytd", label: "Year to date", icon: "Calendar" },
  { value: "12m", label: "Last 12 months", icon: "Calendar" },
  { value: "fy", label: "Fiscal year 2026", icon: "Calendar" }];


  return (
    <div className="an-filters" role="group" aria-label="Analytics filters">
      <span className="an-filters-label">Filter by</span>
      <AnFilterPill
        label="Supplier"
        value={filters.agency || "all"}
        options={agencies}
        onChange={(v) => setFilters({ ...filters, agency: v })} />
      
      <AnFilterPill
        label="Site"
        value={filters.location || "all"}
        options={locations}
        onChange={(v) => setFilters({ ...filters, location: v })} />
      
      <AnFilterPill
        label="Period"
        value={filters.period || "all"}
        options={periods}
        onChange={(v) => setFilters({ ...filters, period: v })} />
      
    </div>);

}

// =====================================================================
// Overview page (matches design screenshot)
// =====================================================================
function AnOverview({ filters, setFilters, onDrill }) {
  const fmtMoney = (n) => "$" + Math.round(n).toLocaleString(undefined, { minimumFractionDigits: 0 });
  const fmtMoneyD = (n) => "$" + Math.round(n).toLocaleString(undefined, { minimumFractionDigits: 0 });
  const fmtSigned = (n) => (n < 0 ? "-" : "") + "$" + Math.abs(Math.round(n)).toLocaleString(undefined, { minimumFractionDigits: 0 });

  return (
    <React.Fragment>
      <div className="an-kpis-wide">
        <AnKpi
          label="Total Spend"
          value={fmtMoneyD(AN_TOTALS.spend)}
          delta={fmtSigned(AN_TOTALS.spendDelta) + " since prior period"}
          deltaKind="down"
          large />
        
        <AnKpi
          label="Total Committed Spend"
          value={fmtMoneyD(AN_TOTALS.committed)}
          delta={fmtSigned(AN_TOTALS.committedDelta) + " since prior period"}
          deltaKind="down"
          large />
        
        <AnKpi
          label="Total Shifts"
          value={AN_TOTALS.booked.toLocaleString()}
          delta={AN_TOTALS.fillRate + "% filled · +" + AN_TOTALS.bookedDelta.toLocaleString() + " since prior period"}
          deltaKind="up" />
        
        <AnKpi
          label="Fill Rate"
          value="97%"
          delta={"+" + AN_TOTALS.fillRateDelta + "% since prior period"}
          deltaKind="up" />
        
      </div>
    </React.Fragment>);

}

// ---------- Pie / donut card (used on Spend drilldown) -----------------
const AN_PIE_PALETTE = [
  "var(--evr-blue-400)",
  "var(--evr-teal-300)",
  "var(--evr-purple-400)",
  "var(--evr-green-400)",
  "var(--evr-orange-500)",
  "var(--evr-yellow-500)",
  "var(--evr-red-300)"];


function AnPieCard({ title, items, viewAllLabel, onViewAll, maxSlices = 6, valueKind = "money" }) {
  const fmtValue = (v) =>
  valueKind === "money" ? "$" + v.toLocaleString() : v.toLocaleString();
  const fmtTotal = (v) =>
  valueKind === "money" ? fmtMoneyTotal(v) : v >= 1000 ? (v / 1000).toFixed(1).replace(/\.0$/, "") + "k" : String(v);
  // Roll up the long tail so the chart stays readable
  const sorted = items.slice().sort((a, b) => b.value - a.value);
  let slices = sorted;
  if (sorted.length > maxSlices) {
    const head = sorted.slice(0, maxSlices - 1);
    const tail = sorted.slice(maxSlices - 1);
    const tailValue = tail.reduce((s, x) => s + x.value, 0);
    slices = [...head, { id: "__other", name: `Other (${tail.length})`, value: tailValue }];
  }
  const total = slices.reduce((s, x) => s + x.value, 0) || 1;

  const [hover, setHover] = React.useState(null);
  const [tip, setTip] = React.useState(null);

  const size = 240;
  const r = size / 2;
  const innerR = r * 0.6;
  let acc = 0;
  const arcs = slices.map((it, i) => {
    const startA = acc / total * Math.PI * 2;
    acc += it.value;
    const endA = acc / total * Math.PI * 2;
    const large = endA - startA > Math.PI ? 1 : 0;
    // single-slice (100%) case: SVG can't draw a full-circle arc with one path
    if (slices.length === 1) {
      const d = [
      `M ${r} 0`,
      `A ${r} ${r} 0 1 1 ${r - 0.01} 0`,
      `M ${r} ${r - innerR}`,
      `A ${innerR} ${innerR} 0 1 0 ${r - 0.01} ${r - innerR}`,
      "Z"].
      join(" ");
      return { ...it, d, color: AN_PIE_PALETTE[0], pct: 100, midA: 0 };
    }
    const sx = r + Math.cos(startA - Math.PI / 2) * r;
    const sy = r + Math.sin(startA - Math.PI / 2) * r;
    const ex = r + Math.cos(endA - Math.PI / 2) * r;
    const ey = r + Math.sin(endA - Math.PI / 2) * r;
    const ix1 = r + Math.cos(endA - Math.PI / 2) * innerR;
    const iy1 = r + Math.sin(endA - Math.PI / 2) * innerR;
    const ix2 = r + Math.cos(startA - Math.PI / 2) * innerR;
    const iy2 = r + Math.sin(startA - Math.PI / 2) * innerR;
    const d = [
    `M ${sx} ${sy}`,
    `A ${r} ${r} 0 ${large} 1 ${ex} ${ey}`,
    `L ${ix1} ${iy1}`,
    `A ${innerR} ${innerR} 0 ${large} 0 ${ix2} ${iy2}`,
    "Z"].
    join(" ");
    return { ...it, d, color: AN_PIE_PALETTE[i % AN_PIE_PALETTE.length], pct: it.value / total * 100, midA: (startA + endA) / 2 };
  });

  const handleMove = (e, slice, i) => {
    const wrap = e.currentTarget.closest(".an-pie-wrap");
    if (!wrap) return;
    const rect = wrap.getBoundingClientRect();
    setTip({ x: e.clientX - rect.left, y: e.clientY - rect.top, item: slice });
    setHover(i);
  };
  const clearHover = () => {setHover(null);setTip(null);};

  return (
    <div className="an-card">
      <div className="an-card-head">
        <div>
          <h2 className="an-card-title">{title}</h2>
        </div>
        {onViewAll &&
        <button type="button" className="vms-btn vms-btn--sm vms-btn--secondary" onClick={onViewAll}>
            {viewAllLabel || "View all"}
          </button>}

      </div>
      <div className="an-pie-layout">
        <div className="an-pie-wrap" onMouseLeave={clearHover}>
          <svg viewBox={`0 0 ${size} ${size}`} className="an-pie" role="img" aria-label={title}>
            {arcs.map((s, i) =>
            <path key={s.id}
            d={s.d}
            fill={s.color}
            className={"an-pie-slice" + (hover != null && hover !== i ? " is-dim" : "") + (hover === i ? " is-active" : "")}
            onMouseEnter={(e) => handleMove(e, s, i)}
            onMouseMove={(e) => handleMove(e, s, i)} />

            )}
            <text x={r} y={r - 2} textAnchor="middle" className="an-pie-total-value">{fmtTotal(total)}</text>
            <text x={r} y={r + 18} textAnchor="middle" className="an-pie-total-label">Total</text>
          </svg>
          {tip &&
          <div className="an-pie-tip" style={{ left: tip.x, top: tip.y }} aria-hidden="true">
              <div className="an-pie-tip-label">{tip.item.name}</div>
              <div className="an-pie-tip-value">{fmtValue(tip.item.value)}</div>
              <div className="an-pie-tip-sub">{tip.item.pct.toFixed(1)}% of total</div>
            </div>}

        </div>
        <ul className="an-pie-legend">
          {arcs.map((s, i) =>
          <li key={s.id}
          className={"an-pie-legend-row" + (hover != null && hover !== i ? " is-dim" : "") + (hover === i ? " is-active" : "")}
          onMouseEnter={() => setHover(i)}
          onMouseLeave={() => setHover(null)}>
              <span className="an-pie-legend-dot" style={{ background: s.color }} />
              <span className="an-pie-legend-name" title={s.name}>{s.name}</span>
              <span className="an-pie-legend-amt">{fmtValue(s.value)}</span>
            </li>
          )}
        </ul>
      </div>
    </div>);

}

// ---------- Spend by supplier breakdown (used on Overview + Spend) ------
function AnSpendBySupplierCard() {
  const list = useMemoAn(() => {
    return (window.SUPPLIERS || []).
    filter((s) => s.status === "Active").
    map((s) => ({
      id: s.id,
      name: s.name,
      value: Number(String(s.spend || "0").replace(/[^0-9]/g, "")) || 0
    })).
    sort((a, b) => b.value - a.value);
  }, []);

  return (
    <AnPieCard
      title="Spend by supplier"
      items={list}
      onViewAll={() => window.flexGoTo && window.flexGoTo("suppliers")} />);


}

function fmtMoneyTotal(n) {
  if (n >= 1e6) return "$" + (n / 1e6).toFixed(2) + "M";
  if (n >= 1e3) return "$" + Math.round(n / 1e3) + "k";
  return "$" + n;
}

// =====================================================================
// Spend drilldown
// =====================================================================
function AnSpendDrilldown({ filters, setFilters }) {
  return (
    <React.Fragment>
      <div className="an-stats">
        <div className="an-stat">
          <span className="an-stat-label">Total spend</span>
          <span className="an-stat-value">${AN_TOTALS.spend.toLocaleString()}</span>
          <span className="an-stat-delta an-stat-delta--down">${Math.round(AN_TOTALS.spendDelta).toLocaleString()} vs prior period</span>
        </div>
        <div className="an-stat">
          <span className="an-stat-label">Committed</span>
          <span className="an-stat-value">${_scaleN(33839, 100).toLocaleString()}</span>
          <span className="an-stat-delta an-stat-delta--down">-${_scaleN(1392).toLocaleString()}</span>
        </div>
        <div className="an-stat">
          <span className="an-stat-label">Avg monthly</span>
          <span className="an-stat-value">${Math.round(AN_TOTALS.spend / AN_MONTHS.length).toLocaleString()}</span>
          <span className="an-stat-delta">across 7 months</span>
        </div>
        <div className="an-stat">
          <span className="an-stat-label">Forecast EOQ</span>
          <span className="an-stat-value">${_scaleN(612400, 100).toLocaleString()}</span>
          <span className="an-stat-delta an-stat-delta--up">+${_scaleN(22800).toLocaleString()} vs plan</span>
        </div>
      </div>

      <div className="an-card">
        <div className="an-card-head">
          <div>
            <h2 className="an-card-title">Spend by month</h2>
          </div>
        </div>
        <AnSpendByMonthChart months={AN_MONTHS} />
      </div>

      <div className="an-grid-2">
        <AnSpendBySupplierCard />
        <AnSpendByLocationCard />
      </div>
    </React.Fragment>);

}

function AnSpendByMonthChart({ months }) {
  const W = 1100;
  const H = 320;
  const padL = 70,padR = 24,padT = 28,padB = 44;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;
  const max = Math.max(...months.map((m) => m.spend));
  const yMax = Math.ceil(max / 50000) * 50000;
  const ticks = 5;
  const yOf = (v) => padT + innerH - v / yMax * innerH;
  const groupW = innerW / months.length;
  const barW = Math.min(60, groupW * 0.55);
  // "Aug 2025" → "Aug '25"
  const shortLabel = (label) => label.replace(/\s(\d{2})(\d{2})$/, " '$2");
  // "$1.33M" / "$130k"
  const fmtAxis = (v) => {
    if (v >= 1e6) {
      const m = v / 1e6;
      const txt = m >= 10 ? m.toFixed(0) : m.toFixed(2).replace(/\.?0+$/, "");
      return "$" + txt + "M";
    }
    return "$" + Math.round(v / 1000).toLocaleString("en-US") + "k";
  };
  const fmtFull = (v) =>
  "$" + Math.round(v).toLocaleString("en-US");

  const [hover, setHover] = React.useState(null);
  const active = hover != null ? months[hover] : null;
  const tipLeftPct = hover != null ?
  (padL + hover * groupW + groupW / 2) / W * 100 :
  0;
  const tipBottomPct = hover != null ?
  (H - yOf(months[hover].spend)) / H * 100 :
  0;

  return (
    <div className="an-chart-wrap">
    <svg className="an-chart" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet">
      <g className="an-grid">
        {Array.from({ length: ticks + 1 }).map((_, i) => {
            const y = padT + innerH / ticks * i;
            return <line key={i} x1={padL} x2={W - padR} y1={y} y2={y} />;
          })}
      </g>
      <g className="an-axis">
        {Array.from({ length: ticks + 1 }).map((_, i) => {
            const v = yMax - yMax / ticks * i;
            const y = padT + innerH / ticks * i;
            return (
              <text key={i} x={padL - 10} y={y + 4} textAnchor="end">
              {fmtAxis(v)}
            </text>);

          })}
      </g>
      {months.map((m, i) => {
          const cx = padL + i * groupW + groupW / 2;
          const y = yOf(m.spend);
          const h = innerH + padT - y;
          const isActive = hover === i;
          const isDim = hover != null && hover !== i;
          return (
            <g key={m.key}
            className={"an-bar-hit" + (isActive ? " is-active" : "") + (isDim ? " is-dim" : "")}
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover((cur) => cur === i ? null : cur)}>
            <rect x={padL + i * groupW} y={padT} width={groupW} height={innerH} fill="transparent" />
            <rect className="an-bar-filled" x={cx - barW / 2} y={y} width={barW} height={h} rx="3" />
            <text x={cx} y={H - padB + 22} textAnchor="middle" style={{ fontWeight: 600, fill: "var(--evr-content-primary-default)" }}>
              {shortLabel(m.label)}
            </text>
          </g>);

        })}
    </svg>
    <div
        className={"an-chart-tip" + (active ? " is-shown" : "")}
        style={{ left: tipLeftPct + "%", bottom: tipBottomPct + "%" }}
        aria-hidden={!active}>
      <div className="an-chart-tip-label">{active ? shortLabel(active.label) : ""}</div>
      <div className="an-chart-tip-value">{active ? fmtFull(active.spend) : ""}</div>
    </div>
    </div>);
}

function AnSpendByLocationCard() {
  const locs = useMemoAn(() => {
    const list = (window.LOCATIONS || []).
    filter((l) => l.status === "Active").
    slice(0, 9);
    // Synthesize deterministic spend per location — a softer geometric decay
    // so the bottom rows still register.
    return list.map((l, i) => ({
      id: l.id,
      name: l.name,
      value: Math.round(220000 * Math.pow(0.88, i) + (i % 2 === 0 ? 4300 : -2100))
    })).sort((a, b) => b.value - a.value);
  }, []);

  return (
    <AnPieCard
      title="Spend by site"
      items={locs}
      onViewAll={() => window.flexGoTo && window.flexGoTo("locations")} />);


}

// =====================================================================
// Shifts drilldown
// =====================================================================
function AnShiftsDrilldown({ filters, setFilters }) {
  return (
    <React.Fragment>
      <div className="an-stats">
        <div className="an-stat">
          <span className="an-stat-label">Booked</span>
          <span className="an-stat-value">{AN_TOTALS.booked.toLocaleString()}</span>
          <span className="an-stat-delta an-stat-delta--up">+{AN_TOTALS.bookedDelta.toLocaleString()} since prior period</span>
        </div>
        <div className="an-stat">
          <span className="an-stat-label">Filled</span>
          <span className="an-stat-value">{AN_TOTALS.filled.toLocaleString()}</span>
          <span className="an-stat-delta an-stat-delta--up">+{AN_TOTALS.filledDelta.toLocaleString()} shifts added</span>
        </div>
        <div className="an-stat">
          <span className="an-stat-label">Fill rate</span>
          <span className="an-stat-value">97%</span>
          <span className="an-stat-delta an-stat-delta--up">+3% higher since prior period</span>
        </div>
        <div className="an-stat">
          <span className="an-stat-label">Unfilled</span>
          <span className="an-stat-value">{(AN_TOTALS.booked - AN_TOTALS.filled).toLocaleString()}</span>
          <span className="an-stat-delta an-stat-delta--down">-{Math.max(1, Math.round(80 * _AN_SCALE)).toLocaleString()} since prior period</span>
        </div>
      </div>

      <div className="an-card">
        <div className="an-card-head">
          <div>
            <h2 className="an-card-title">Fulfillment trends</h2>
          </div>
        </div>
        <AnShiftsChart months={AN_MONTHS} />
      </div>

      <div className="an-grid-2">
        <AnShiftsByRoleCard />
        <AnShiftsByDayCard />
      </div>
    </React.Fragment>);

}

function AnShiftsByRoleCard() {
  const rows = [
  { id: "prod", name: "Production Associate", value: 5240 },
  { id: "fork", name: "Forklift Operator", value: 3120 },
  { id: "line", name: "Line Supervisor", value: 2480 },
  { id: "qa", name: "Quality Inspector", value: 2105 },
  { id: "wh", name: "Warehouse Associate", value: 1730 },
  { id: "pack", name: "Packer", value: 1387 }];

  return (
    <AnPieCard
      title="By role"
      items={rows}
      valueKind="count" />);


}

function AnShiftsByDayCard() {
  const days = [
  { d: "Mon", booked: 2410, rate: 96 },
  { d: "Tue", booked: 2620, rate: 95 },
  { d: "Wed", booked: 2580, rate: 94 },
  { d: "Thu", booked: 2470, rate: 95 },
  { d: "Fri", booked: 2820, rate: 92 },
  { d: "Sat", booked: 1810, rate: 88 },
  { d: "Sun", booked: 1352, rate: 81 }];

  const max = Math.max(...days.map((d) => d.booked));
  const [hover, setHover] = React.useState(null);
  const active = hover != null ? days[hover] : null;

  return (
    <div className="an-card">
      <div className="an-card-head">
        <div>
          <h2 className="an-card-title">By day of week</h2>
        </div>
      </div>
      <div className="an-chart-wrap" style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(7, 1fr)",
            gap: 8,
            alignItems: "end",
            flex: 1,
            minHeight: 0,
            paddingBottom: 6
          }}>
          {days.map((d, i) => {
            const h = Math.round(d.booked / max * 100);
            const isActive = hover === i;
            const isDim = hover != null && hover !== i;
            return (
              <div key={d.d}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover((cur) => cur === i ? null : cur)}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "flex-end",
                gap: 6,
                height: "100%",
                cursor: "pointer"
              }}>
                <div
                  style={{
                    width: "60%",
                    maxWidth: 44,
                    background: isActive ? "var(--evr-blue-500)" : "var(--evr-blue-400)",
                    opacity: isDim ? 0.4 : 1,
                    borderRadius: 4,
                    height: h + "%",
                    minHeight: 4,
                    transition: "background 120ms cubic-bezier(0.4,0,0.2,1), opacity 120ms cubic-bezier(0.4,0,0.2,1)"
                  }} />
                <span style={{ font: "var(--evr-body2-bold)", color: "var(--evr-content-primary-highemp)" }}>{d.d}</span>
              </div>);

          })}
        </div>
        <div
          className={"an-chart-tip" + (active ? " is-shown" : "")}
          style={{
            left: hover != null ? `calc(${(hover + 0.5) / days.length * 100}% )` : "50%",
            bottom: "100%"
          }}
          aria-hidden={!active}>
          <div className="an-chart-tip-label">{active ? active.d : ""}</div>
          {active &&
          <div className="an-chart-tip-list">
              <div className="an-chart-tip-row">
                <span><span className="an-chart-tip-dot an-chart-tip-dot--filled" />Booked</span>
                <span className="tabular">{active.booked.toLocaleString()}</span>
              </div>
              <div className="an-chart-tip-row">
                <span><span className="an-chart-tip-dot an-chart-tip-dot--line" />Fill rate</span>
                <span className="tabular">{active.rate}%</span>
              </div>
            </div>
          }
        </div>
      </div>
    </div>);

}

// =====================================================================
// Suppliers drilldown
// =====================================================================
function AnSuppliersDrilldown({ filters, setFilters }) {
  const list = useMemoAn(() => {
    return (window.SUPPLIERS || []).
    filter((s) => s.status === "Active" && s._sc).
    map((s) => ({
      id: s.id, name: s.name, bg: s.bg,
      workers: s.workers || 0,
      spend: Number(String(s.spend || "0").replace(/[^0-9]/g, "")) || 0,
      fillRate: s._sc.fillRate ?? null,
      markup: s._sc.rateMarkup ?? null,
      rate: s._sc.rateAvg ?? null,
      tier: s._sc.tier ?? null
    })).
    sort((a, b) => b.spend - a.spend);
  }, []);
  const totalSpend = list.reduce((s, x) => s + x.spend, 0);
  const totalWorkers = list.reduce((s, x) => s + x.workers, 0);
  const avgFill = list.reduce((s, x) => s + (x.fillRate || 0), 0) / Math.max(1, list.length);
  const avgRate = list.reduce((s, x) => s + (x.rate || 0), 0) / Math.max(1, list.length);

  return (
    <React.Fragment>
      <div className="an-stats">
        <div className="an-stat">
          <span className="an-stat-label">Active suppliers</span>
          <span className="an-stat-value">{list.length}</span>
        </div>
        <div className="an-stat">
          <span className="an-stat-label">Workers on assignment</span>
          <span className="an-stat-value">{totalWorkers.toLocaleString()}</span>
        </div>
        <div className="an-stat">
          <span className="an-stat-label">Avg fill rate</span>
          <span className="an-stat-value">{avgFill.toFixed(0)}%</span>
        </div>
        <div className="an-stat">
          <span className="an-stat-label">Avg hourly bill rate</span>
          <span className="an-stat-value">${avgRate.toFixed(2)}</span>
        </div>
      </div>

      <div className="an-card">
        <div className="an-card-head">
          <div>
            <h2 className="an-card-title">Supplier scorecard</h2>
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "32px minmax(160px, 1.4fr) 2fr 2fr 90px", gap: 14, alignItems: "center" }}>
          {/* header */}
          <span />
          <span style={{ font: "var(--evr-caption)", color: "var(--evr-content-primary-lowemp)", textTransform: "uppercase", letterSpacing: "0.06em" }} title="Dayforce calls this Supplier — formerly &lsquo;Agency&rsquo; in Flex Work">Supplier</span>
          <span style={{ font: "var(--evr-caption)", color: "var(--evr-content-primary-lowemp)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Spend (YTD)</span>
          <span style={{ font: "var(--evr-caption)", color: "var(--evr-content-primary-lowemp)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Fill rate</span>
          <span style={{ font: "var(--evr-caption)", color: "var(--evr-content-primary-lowemp)", textTransform: "uppercase", letterSpacing: "0.06em", textAlign: "right" }}>Workers</span>

          {list.map((s) => {
            const spendPct = Math.round(s.spend / Math.max(1, list[0].spend) * 100);
            const short = (s.name || "").split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
            return (
              <React.Fragment key={s.id}>
                <span className="sup-avatar an-bk-avatar"
                style={{ background: "var(--evr-neutral-95)", color: "var(--evr-content-primary-highemp)", width: 32, height: 32, fontSize: 11 }}
                aria-label={s.name}>
                  {short}
                </span>
                <span style={{ font: "var(--evr-body2-bold)", color: "var(--evr-content-primary-highemp)" }}>{s.name}</span>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 90px", gap: 10, alignItems: "center" }}>
                  <div className="an-bk-bar"><div className="an-bk-bar-fill" style={{ width: spendPct + "%" }} /></div>
                  <span className="an-bk-amt" style={{ fontWeight: "var(--evr-fw-regular)" }}>${s.spend.toLocaleString()}</span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 50px", gap: 10, alignItems: "center" }}>
                  <div className="an-bk-bar"><div className="an-bk-bar-fill" style={{ width: (s.fillRate || 0) + "%" }} /></div>
                  <span className="an-bk-amt" style={{ fontWeight: "var(--evr-fw-regular)" }}>{s.fillRate ?? "—"}%</span>
                </div>
                <span className="an-bk-amt" style={{ fontWeight: "var(--evr-fw-regular)" }}>{s.workers.toLocaleString()}</span>
              </React.Fragment>);

          })}
        </div>
      </div>
    </React.Fragment>);

}

// =====================================================================
// Workforce drilldown
// =====================================================================
function AnWorkforceDrilldown({ filters, setFilters }) {
  const workers = window.WORKERS || [];
  const active = workers.filter((w) => w.status === "Active" || w.status === "On Assignment").length || 248;
  const onLeave = workers.filter((w) => w.status === "On Leave").length || 12;
  return (
    <React.Fragment>
      <div className="an-stats">
        <div className="an-stat">
          <span className="an-stat-label">Active workers</span>
          <span className="an-stat-value">{active}</span>
          <span className="an-stat-delta an-stat-delta--up">+18 this period</span>
        </div>
        <div className="an-stat">
          <span className="an-stat-label">On leave</span>
          <span className="an-stat-value">{onLeave}</span>
        </div>
        <div className="an-stat">
          <span className="an-stat-label">Avg tenure</span>
          <span className="an-stat-value">14.2 mo</span>
        </div>
        <div className="an-stat">
          <span className="an-stat-label">Retention (12m)</span>
          <span className="an-stat-value">82%</span>
          <span className="an-stat-delta an-stat-delta--up">+4 pts vs prior year</span>
        </div>
      </div>
    </React.Fragment>);

}

// ---------- Section header (Insights pattern, Analytics scope) ----------
function AnSectionHead({ title, sub }) {
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
      {sub &&
      <p style={{
        margin: 0,
        font: "var(--evr-body2)",
        color: "var(--evr-content-primary-lowemp)",
        maxWidth: 720
      }}>{sub}</p>}
    </header>);

}

// =====================================================================
// Page wrapper — single scrollable view, Insights-style sections.
// =====================================================================
// ---------- Top-level Metrics / Reports tabs -----------------------------
// v1.14 — Reports tab introduces a Fieldglass-style report library +
// custom report builder living alongside the existing Metrics view.
// The current Metrics surface (Spend / Shifts / Suppliers sections)
// is unchanged — it's just nested under the "Metrics" tab now.
const ANALYTICS_TOPTABS = [
{ id: "metrics", label: "Metrics", icon: "Performance" },
{ id: "reports", label: "Reports", icon: "Notes" }];


function AnTopTabs({ active, onChange }) {
  return (
    <div className="evr-tabs" role="tablist" aria-label="Analytics view">
      {ANALYTICS_TOPTABS.map((t) => (
        <button
          key={t.id}
          type="button"
          role="tab"
          aria-selected={active === t.id}
          className={"evr-tab" + (active === t.id ? " is-active" : "")}
          onClick={() => onChange(t.id)}>
          {t.label}
        </button>
      ))}
    </div>);
}

function AnalyticsMetrics({ filters, setFilters }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 56 }}>
      <section style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <AnSectionHead
          title="Spend"
          sub="Realized spend by month, supplier and location." />
        <AnSpendDrilldown filters={filters} setFilters={setFilters} />
      </section>

      <section style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <AnSectionHead
          title="Shifts"
          sub="Booked, filled and fill rate trends across role and weekday." />
        <AnShiftsDrilldown filters={filters} setFilters={setFilters} />
      </section>

      <section style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <AnSectionHead
          title="Suppliers"
          sub="Scorecard view across active suppliers." />
        <AnSuppliersDrilldown filters={filters} setFilters={setFilters} />
      </section>
    </div>);
}

// =====================================================================
// Page wrapper — Metrics / Reports tab strip on top.
// =====================================================================
function AnalyticsPage({ reloadKey, onReload }) {
  const [filters, setFilters] = useStateAn({ agency: "all", location: "all", period: "all" });
  // Persist the active top-tab so refreshing the Reports tab doesn't
  // bounce the user back to Metrics. localStorage scope is the page,
  // so this is invisible from other surfaces.
  const [topTab, setTopTab] = useStateAn(() => {
    try { return localStorage.getItem("flexwork.analytics.topTab") || "metrics"; }
    catch (_) { return "metrics"; }
  });
  const setTopTabAndStore = (v) => {
    setTopTab(v);
    try { localStorage.setItem("flexwork.analytics.topTab", v); } catch (_) {}
  };

  const omniTitle = "Analytics";
  const subtitle = topTab === "reports" ? "Last updated 14 mins ago" : "Last updated 14 mins ago";

  return (
    <React.Fragment>
      <Omnibar icon="HeartBeat" title={omniTitle} subtitle={subtitle}>
        <button type="button" className="iconbtn" onClick={onReload} aria-label="Reload" title="Reload">
          <Icon name="Refresh" size={18} />
        </button>
      </Omnibar>

      <div className="an-page" key={reloadKey} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <AnTopTabs active={topTab} onChange={setTopTabAndStore} />
        {topTab === "metrics" ? (
          <AnalyticsMetrics filters={filters} setFilters={setFilters} />
        ) : (
          window.AnalyticsReports ? <window.AnalyticsReports /> : null
        )}
      </div>
    </React.Fragment>);

}

Object.assign(window, { AnalyticsPage, ANALYTICS_SECTIONS, AN_MONTHS });