// =====================================================================
// Flex Work — Dashboard · SOW lane
//   Renders the SOW engagement body inside the Home overview when the
//   `sow` feature flag is on AND the engagement switch is set to SOW.
//   Mirrors the layout DNA of DashProfessional so the three lanes
//   (Frontline / Professional / SOW) feel like one product.
//
//   Components exported on window:
//     · DashSOW({reloadKey, onGoTo})
// =====================================================================

const { useMemo: useMemoSowD } = React;

// --- Stat tile ----------------------------------------------------------
function SowStatTile({ icon, label, count, tone, onClick, sub }) {
  return (
    <button type="button" className="dash-stat" onClick={onClick} title={label}>
      <span className={`dash-stat-bubble dash-stat-bubble--${tone || "blue"}`}>
        <Icon name={icon} size={24} />
        {typeof count === "number" && count > 0 && (
          <span className={`dash-stat-badge${count > 99 ? " dash-stat-badge--neutral" : ""}`}>
            {count > 99 ? "99+" : count}
          </span>
        )}
      </span>
      <span className="dash-stat-label">{label}</span>
      {sub && <span className="pw-stat-sub">{sub}</span>}
    </button>
  );
}

// --- For-you-today card --------------------------------------------------
function SowForYouToday({ metrics, onGoTo }) {
  return (
    <section className="dash-card">
      <div className="dash-card-head">
        <h2 className="dash-card-title">For you today</h2>
        <span className="pw-eyebrow">SOW</span>
      </div>
      <div className="dash-stats">
        <SowStatTile
          icon="Notes"
          label="Active SOWs"
          count={metrics.active}
          tone="blue"
          onClick={() => onGoTo && onGoTo("suppliers")}
        />
        <SowStatTile
          icon="Calendar"
          label="Milestones due · 7 d"
          count={metrics.milestonesDue7d}
          tone="purple"
          onClick={() => onGoTo && onGoTo("suppliers")}
        />
        <SowStatTile
          icon="Alert"
          label="Deliverables overdue"
          count={metrics.deliverablesOverdue}
          tone="red"
          onClick={() => onGoTo && onGoTo("suppliers")}
        />
        <SowStatTile
          icon="Pay"
          label="Invoices to approve"
          count={metrics.invoicesPending}
          tone="orange"
          onClick={() => onGoTo && onGoTo("invoices")}
        />
      </div>
    </section>
  );
}

// --- Committed-vs-consumed spend tracker --------------------------------
function SowSpendTracker({ metrics }) {
  const pct = metrics.committed
    ? Math.round((metrics.consumed / metrics.committed) * 100)
    : 0;
  const fmt = window.sowFmtMoney || ((n) => `$${Math.round(n).toLocaleString()}`);
  return (
    <section className="dash-card">
      <div className="dash-card-head">
        <h2 className="dash-card-title">Spend tracker</h2>
        <span className="pw-eyebrow">Committed vs consumed · USD equiv.</span>
      </div>
      <div className="sow-spend">
        <div className="sow-spend-row">
          <div className="sow-spend-lab">Committed</div>
          <div className="sow-spend-val tabular">{fmt(metrics.committed, "USD")}</div>
        </div>
        <div className="sow-spend-bar" aria-label={`${pct}% consumed`}>
          <span className="sow-spend-bar-fill" style={{ width: `${Math.min(100, pct)}%` }}></span>
        </div>
        <div className="sow-spend-row sow-spend-row--bot">
          <div className="sow-spend-lab">
            <span className="sow-spend-dot sow-spend-dot--consumed"></span>
            Consumed · <b className="tabular">{pct}%</b>
            <span className="tabular"> · {fmt(metrics.consumed, "USD")}</span>
          </div>
          <div className="sow-spend-lab">
            <span className="sow-spend-dot sow-spend-dot--remaining"></span>
            Remaining
            <span className="tabular"> · {fmt(metrics.remaining, "USD")}</span>
          </div>
        </div>
      </div>
    </section>
  );
}

// --- Active SOWs list --------------------------------------------------
function SowActiveList({ sows, onGoTo }) {
  const fmt = window.sowFmtMoney || ((n, c) => `${c} ${Math.round(n).toLocaleString()}`);
  const billingLabel = window.sowBillingLabel || ((m) => m);
  const statusMeta = window.sowStatusMeta || (() => ({ fg: "inherit", bg: "transparent", label: "" }));
  // Lead with In approval + Active, then On hold + Completed + Draft.
  const ORDER = { "In approval": 0, "Active": 1, "On hold": 2, "Completed": 3, "Draft": 4, "Closed": 5 };
  const top = [...sows]
    .sort((a, b) => (ORDER[a.status] ?? 9) - (ORDER[b.status] ?? 9))
    .slice(0, 5);
  return (
    <section className="dash-card">
      <div className="dash-card-head">
        <h2 className="dash-card-title">Active SOWs</h2>
        <button
          type="button"
          className="vms-btn vms-btn--sm vms-btn--secondary"
          onClick={() => onGoTo && onGoTo("suppliers")}
        >
          View all
        </button>
      </div>
      <ul className="sow-list" role="list">
        {top.map((s) => {
          const meta = statusMeta(s.status);
          const pct = s.totalValue ? Math.round((s.consumed / s.totalValue) * 100) : 0;
          return (
            <li key={s.id} className="sow-row">
              <div className="sow-row-head">
                <span className="sow-row-id tabular">{s.id}</span>
                <span
                  className="sow-row-pill"
                  style={{ color: meta.fg, background: meta.bg }}
                >
                  {meta.label}
                </span>
                <span
                  className={`fi fi-${s.flag}`}
                  aria-hidden="true"
                  style={{ width: 22, height: 16, borderRadius: 2 }}
                ></span>
              </div>
              <div className="sow-row-title">{s.name}</div>
              <div className="sow-row-meta">
                <span><Icon name="Building" size={14} /> {s.supplierLabel}</span>
                <span><Icon name="Notes" size={14} /> {s.msaRef}</span>
                <span><Icon name="PersonAuthorize" size={14} /> {s.owner}</span>
              </div>
              <div className="sow-row-terms">
                <span className="pw-chip pw-chip--cadence">{billingLabel(s.billingModel)}</span>
                <span className="pw-chip pw-chip--rate tabular">{fmt(s.totalValue, s.currency)}</span>
                {s.retainagePct > 0 && (
                  <span className="pw-chip pw-chip--sow tabular">{s.retainagePct}% retainage</span>
                )}
                <span className="pw-chip pw-chip--sow">{s.paymentTerms.split("·")[0].trim()}</span>
              </div>
              <div className="sow-row-burn" aria-label={`${pct}% of fee schedule consumed`}>
                <div className="sow-row-burn-bar">
                  <span className="sow-row-burn-fill" style={{ width: `${Math.min(100, pct)}%` }}></span>
                </div>
                <div className="sow-row-burn-legend tabular">
                  <span><b>{pct}%</b> consumed</span>
                  <span>{fmt(s.consumed, s.currency)} of {fmt(s.totalValue, s.currency)}</span>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

// --- Upcoming milestones list ------------------------------------------
function SowMilestonesUpcoming({ metrics }) {
  const today = window.flexToday ? window.flexToday() : new Date(2026, 4, 19);
  const fmt = window.sowFmtMoney || ((n, c) => `${c} ${Math.round(n).toLocaleString()}`);
  const milestoneMeta = window.sowMilestoneStatusMeta || (() => ({ fg: "inherit", bg: "transparent", label: "" }));
  // Surface anything not Paid / Accepted, sorted by due date ascending.
  const upcoming = (metrics.allMilestones || [])
    .filter((m) => m.status !== "Paid" && m.status !== "Accepted")
    .sort((a, b) => new Date(a.due).getTime() - new Date(b.due).getTime())
    .slice(0, 5);

  return (
    <section className="dash-card">
      <div className="dash-card-head">
        <h2 className="dash-card-title">Upcoming milestones</h2>
        <span className="pw-eyebrow">Next 5 · across all SOWs</span>
      </div>
      <ul className="sow-ms-list" role="list">
        {upcoming.map((m) => {
          const meta = milestoneMeta(m.status);
          const due = new Date(m.due);
          const daysOut = Math.round((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
          const dueTone = daysOut < 0 ? "red" : daysOut <= 7 ? "orange" : "blue";
          return (
            <li key={m.id} className="sow-ms-row">
              <span className={`sow-ms-date sow-ms-date--${dueTone}`} aria-hidden="true">
                <span className="sow-ms-date-mo">{due.toLocaleString("en-US", { month: "short" })}</span>
                <span className="sow-ms-date-day tabular">{due.getDate()}</span>
              </span>
              <div className="sow-ms-main">
                <div className="sow-ms-title">{m.name}</div>
                <div className="sow-ms-sub">
                  <span className="tabular">{m.sowId}</span>
                  <span>·</span>
                  <span>{m.supplierLabel}</span>
                  {m.value > 0 && (
                    <>
                      <span>·</span>
                      <span className="tabular">{fmt(m.value, m.currency)}</span>
                    </>
                  )}
                </div>
              </div>
              <div className="sow-ms-aside">
                <span
                  className="sow-row-pill"
                  style={{ color: meta.fg, background: meta.bg }}
                >
                  {meta.label}
                </span>
                <span className={`sow-ms-when sow-ms-when--${dueTone} tabular`}>
                  {daysOut < 0 ? `${Math.abs(daysOut)} d overdue` : daysOut === 0 ? "today" : `in ${daysOut} d`}
                </span>
              </div>
            </li>
          );
        })}
        {upcoming.length === 0 && (
          <li className="sow-ms-empty">No upcoming milestones across active SOWs.</li>
        )}
      </ul>
    </section>
  );
}

// --- Lane body root ----------------------------------------------------
function DashSOW({ reloadKey, onGoTo }) {
  const sows = (window.getSOWs && window.getSOWs()) || [];
  const metrics = useMemoSowD(
    () => (window.sowMetrics ? window.sowMetrics() : {
      active: 0, draft: 0, milestonesDue7d: 0, deliverablesOverdue: 0,
      invoicesPending: 0, committed: 0, consumed: 0, remaining: 0,
      changeOrdersOpen: 0, allMilestones: [],
    }),
    [reloadKey]
  );
  return (
    <div className="dash dash--tabbed" key={`sow-${reloadKey}`} data-screen-label="Dashboard · SOW">
      <div className="dash-grid">
        <div className="dash-col">
          <SowActiveList sows={sows} onGoTo={onGoTo} />
          <SowSpendTracker metrics={metrics} />
        </div>
        <div className="dash-col">
          <SowForYouToday metrics={metrics} onGoTo={onGoTo} />
          <SowMilestonesUpcoming metrics={metrics} />
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { DashSOW });
