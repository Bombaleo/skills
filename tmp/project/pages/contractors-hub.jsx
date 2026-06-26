// =====================================================================
// Flex Work — Contractors Hub (IC Compliance dashboard)
//   Gated by the `contractors` feature flag. Provides the org-wide
//   contractor surface — the IC Compliance dashboard with org-wide
//   classification, agreement, tax, and 1099 visibility.
//
//   Tabs:
//     · Overview            — KPI cards + at-a-glance queues
//     · Renewals            — agreements expiring in 60 / 30 / 7 days
//     · Classification      — at-risk reclassification queue (risk score,
//                             tenure, hours, exclusivity)
//     · Documents           — expiring contractor docs (COI, ID, W-9)
//     · Invoices            — contractor-submitted invoice queue
//     · Year-end · Tax Wizard — 1099-NEC / 1042-S / T4A batch generation
//
//   All data is derived from CONTRACTOR_WORKERS_RAW + CONTRACTOR_AGREEMENTS
//   + CONTRACTOR_DOCS + CONTRACTOR_INVOICES (live re-derive on flag flip).
//   Style: Everest tokens only — reuses the vms-kpi, req-pill, ctr-table
//   patterns already established on the per-contractor detail surfaces.
// =====================================================================

const { useState: useStateCH, useMemo: useMemoCH } = React;

// ---------- Date helpers ----------------------------------------------
function _ch_today() {
  return (typeof window.flexToday === "function") ? window.flexToday() : new Date();
}
function _ch_daysUntil(iso) {
  if (!iso || iso === "—") return Infinity;
  const today = _ch_today();
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return Infinity;
  return Math.round((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}
function _ch_fmtDateShort(iso) {
  if (!iso || iso === "—") return "—";
  try {
    return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  } catch (e) { return iso; }
}
function _ch_renewalWindow(days) {
  if (days <= 0) return { label: "Overdue", hue: "error" };
  if (days <= 7)  return { label: "≤ 7 days",  hue: "error" };
  if (days <= 30) return { label: "≤ 30 days", hue: "warning" };
  if (days <= 60) return { label: "≤ 60 days", hue: "informative" };
  return { label: `${days} days`, hue: "default" };
}

// ---------- Data derivations -------------------------------------------
// All hub queues are computed from the source contractor data so flipping
// any per-contractor field (tax form, agreement status) shows up here on
// the next render.
function _ch_contractors() {
  return (typeof window.getContractorWorkers === "function") ? window.getContractorWorkers() : [];
}
function _ch_kpis() {
  const list = _ch_contractors();
  const total = list.length;
  const onboarding = list.filter((c) => c.status === "Onboarding").length;
  const compliant = list.filter((c) => c.status === "Compliant").length;
  const expiringSoon = list.filter((c) => {
    const d = _ch_daysUntil(c.agreement && c.agreement.expires);
    return d <= 60;
  }).length;
  const atRisk = list.filter((c) => c.riskScore >= 60).length;
  const review = list.filter((c) => c.riskScore >= 35 && c.riskScore < 60).length;
  const ytdSpend = list.reduce((s, c) => s + (c.ytdPaid || 0), 0);
  // Sum invoices waiting on approval across the hub
  const pendingInv = Object.values(window.CONTRACTOR_INVOICES || {})
    .flat()
    .filter((inv) => inv.status === "Submitted" || inv.status === "Approved");
  const pendingAmt = pendingInv.reduce((s, i) => s + i.amount, 0);
  return { total, onboarding, compliant, expiringSoon, atRisk, review, ytdSpend, pendingInv: pendingInv.length, pendingAmt };
}

function _ch_renewalQueue() {
  return _ch_contractors()
    .map((c) => ({ c, days: _ch_daysUntil(c.agreement && c.agreement.expires) }))
    .filter(({ c, days }) => days <= 90 || (c.agreement && (c.agreement.status === "Renewal due" || c.agreement.status === "Expired")))
    .sort((a, b) => a.days - b.days);
}
function _ch_classificationQueue() {
  return _ch_contractors()
    .filter((c) => c.riskScore >= 35)
    .sort((a, b) => b.riskScore - a.riskScore);
}
function _ch_expiringDocs() {
  const docs = window.CONTRACTOR_DOCS || {};
  const out = [];
  for (const id of Object.keys(docs)) {
    const c = (window.getContractorById ? window.getContractorById(id) : null);
    if (!c) continue;
    for (const d of docs[id]) {
      const days = _ch_daysUntil(d.expires);
      if (days <= 90 || d.status === "Expired" || d.status === "Stale") {
        out.push({ contractor: c, doc: d, days });
      }
    }
  }
  return out.sort((a, b) => a.days - b.days);
}
function _ch_invoiceQueue() {
  const inv = window.CONTRACTOR_INVOICES || {};
  const out = [];
  for (const id of Object.keys(inv)) {
    const c = (window.getContractorById ? window.getContractorById(id) : null);
    if (!c) continue;
    for (const r of inv[id]) {
      out.push({ contractor: c, inv: r });
    }
  }
  return out.sort((a, b) => (b.inv.date || "").localeCompare(a.inv.date || ""));
}

// ---------- KPI card ---------------------------------------------------
function ChKpi({ label, value, foot, level }) {
  return (
    <div className={"vms-kpi ch-kpi" + (level === "err" ? " vms-kpi--alert" : level === "warn" ? " vms-kpi--warn" : "")}>
      <div className="vms-kpi-label">{label}</div>
      <div className="vms-kpi-value tabular">{value}</div>
      {foot && <div className="vms-kpi-foot">{foot}</div>}
    </div>
  );
}

// ---------- Contractor identity cell (avatar + name + country) --------
function ChWho({ c, onOpen }) {
  return (
    <button
      type="button"
      className="ch-who"
      onClick={() => onOpen && onOpen(c.id)}
      title={`Open ${c.name}`}
    >
      {window.WorkerAvatar
        ? <window.WorkerAvatar w={c} size={28} neutral />
        : <span className="ch-who-avatar" aria-hidden="true">{(c.name || "?").slice(0, 1)}</span>}
      <span className="ch-who-stack">
        <span className="ch-who-name">{c.name}</span>
        <span className="ch-who-sub">
          {c.flag && <span className={`fi fi-${c.flag}`} aria-hidden="true" />}
          <span>{c.countryName}</span>
          <span aria-hidden="true">·</span>
          <span>{c.entity}</span>
        </span>
      </span>
    </button>
  );
}

// ---------- Currency format --------------------------------------------
function chMoney(amt, ccy) {
  if (window.fmtContractorMoney) return window.fmtContractorMoney(amt, ccy);
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: ccy || "USD", maximumFractionDigits: 0 }).format(amt || 0);
  } catch (e) { return `${ccy || "USD"} ${amt || 0}`; }
}

// =====================================================================
// Tab: Overview
// =====================================================================
function ChOverview({ onOpen, onGoTab }) {
  const k = useMemoCH(_ch_kpis, []);
  const renewals = useMemoCH(_ch_renewalQueue, []);
  const classif = useMemoCH(_ch_classificationQueue, []);
  const docs    = useMemoCH(_ch_expiringDocs, []);
  const invs    = useMemoCH(_ch_invoiceQueue, []);
  return (
    <React.Fragment>
      <div className="vms-kpis ch-kpi-row">
        <ChKpi label="Active contractors"      value={k.total} foot={`${k.onboarding} onboarding · ${k.compliant} compliant`} />
        <ChKpi label="Renewals due ≤ 60 days"  value={k.expiringSoon} foot="MSA + SOW expiring" level={k.expiringSoon > 0 ? "warn" : null} />
        <ChKpi label="Classification at risk"  value={k.atRisk}    foot={`${k.review} to review`}            level={k.atRisk > 0 ? "err" : null} />
        <ChKpi label="Invoices pending"        value={k.pendingInv} foot={chMoney(k.pendingAmt, "USD")}      level={k.pendingInv > 0 ? "warn" : null} />
        <ChKpi label="YTD contractor spend"    value={chMoney(k.ytdSpend, "USD")} foot="Across all currencies (USD eq.)" />
      </div>

      <section className="ch-section">
        <header className="ch-section-head">
          <div>
            <h3>Top renewals due</h3>
            <p>Agreements expiring or in renewal review.</p>
          </div>
          <button type="button" className="btn btn--sm btn--secondary" onClick={() => onGoTab("renewals")}>
            View all <Icon name="ArrowRight" size={14} />
          </button>
        </header>
        <ChRenewalsTable rows={renewals.slice(0, 5)} onOpen={onOpen} compact />
      </section>

      <section className="ch-section">
        <header className="ch-section-head">
          <div>
            <h3>Classification reviews</h3>
            <p>Contractors above the 35/100 risk threshold.</p>
          </div>
          <button type="button" className="btn btn--sm btn--secondary" onClick={() => onGoTab("classification")}>
            View all <Icon name="ArrowRight" size={14} />
          </button>
        </header>
        <ChClassificationTable rows={classif.slice(0, 5)} onOpen={onOpen} compact />
      </section>

      <div className="ch-two-col">
        <section className="ch-section">
          <header className="ch-section-head">
            <div>
              <h3>Expiring documents</h3>
              <p>COI, ID, tax forms inside the 90-day window.</p>
            </div>
            <button type="button" className="btn btn--sm btn--secondary" onClick={() => onGoTab("documents")}>
              View all <Icon name="ArrowRight" size={14} />
            </button>
          </header>
          <ChDocsTable rows={docs.slice(0, 4)} onOpen={onOpen} compact />
        </section>

        <section className="ch-section">
          <header className="ch-section-head">
            <div>
              <h3>Invoice approvals</h3>
              <p>Contractor-submitted invoices awaiting AP.</p>
            </div>
            <button type="button" className="btn btn--sm btn--secondary" onClick={() => onGoTab("invoices")}>
              View all <Icon name="ArrowRight" size={14} />
            </button>
          </header>
          <ChInvoicesTable rows={invs.slice(0, 4)} onOpen={onOpen} compact />
        </section>
      </div>
    </React.Fragment>
  );
}

// =====================================================================
// Tab: Renewals
// =====================================================================
function ChRenewalsTable({ rows, onOpen, compact }) {
  if (!rows.length) {
    return <div className="ch-empty"><Icon name="Check" size={18} /><span>Nothing renewing inside the window.</span></div>;
  }
  return (
    <div className="ctr-table ch-table">
      <div className="ctr-table-head ch-row-renewal">
        <div>Contractor</div>
        <div>Agreement</div>
        <div>Status</div>
        <div>Expires</div>
        <div>Window</div>
        {!compact && <div>YTD paid</div>}
        <div></div>
      </div>
      {rows.map(({ c, days }) => {
        const win = _ch_renewalWindow(days);
        const hue = c.agreement.status === "Expired" ? "error" : c.agreement.status === "Renewal due" ? "warning" : "default";
        return (
          <div className="ctr-table-row ch-row-renewal" key={c.id}>
            <div><ChWho c={c} onOpen={onOpen} /></div>
            <div>
              <div className="ch-cell-strong">{c.agreement.type}</div>
              <div className="ch-cell-sub">Effective {_ch_fmtDateShort(c.agreement.effective)}</div>
            </div>
            <div><span className={`req-pill req-pill--${hue}`}>{c.agreement.status}</span></div>
            <div className="tabular">{_ch_fmtDateShort(c.agreement.expires)}</div>
            <div><span className={`req-pill req-pill--${win.hue}`}>{win.label}</span></div>
            {!compact && <div className="tabular">{chMoney(c.ytdPaid, c.currency)}</div>}
            <div className="ctr-cell-actions">
              <button type="button" className="btn btn--sm btn--secondary" onClick={() => showToast(`Renewal drafted for ${c.name}`, { kind: "success" })}>
                <Icon name="Refresh" size={14} />Renew
              </button>
              <button type="button" className="iconbtn iconbtn--sm" aria-label="More" onClick={(e) => openMenu(e.currentTarget, [
                { icon: "View", label: "Open contractor", onClick: () => onOpen && onOpen(c.id) },
                { icon: "DocumentAdd", label: "New SOW", onClick: () => showToast(`SOW draft started for ${c.name}`) },
                { icon: "Send", label: "Send reminder", onClick: () => showToast(`Reminder sent to ${c.name}`) },
                { divider: true },
                { icon: "Cancel", label: "Terminate engagement", danger: true, onClick: () => openConfirm({
                  title: `Terminate ${c.name}?`,
                  body: "The current SOW will be marked terminated and the contractor will be moved to alumni.",
                  primaryLabel: "Terminate",
                  onConfirm: () => showToast(`${c.name} terminated`, { kind: "success" }),
                }) },
              ])}>
                <Icon name="MoreVert" size={16} />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ChRenewals({ onOpen }) {
  const all = useMemoCH(_ch_renewalQueue, []);
  const [win, setWin] = useStateCH("all"); // all | 7 | 30 | 60 | overdue
  const rows = useMemoCH(() => {
    return all.filter(({ days, c }) => {
      if (win === "overdue") return days <= 0 || c.agreement.status === "Expired";
      if (win === "7")       return days > 0 && days <= 7;
      if (win === "30")      return days > 7 && days <= 30;
      if (win === "60")      return days > 30 && days <= 60;
      return true;
    });
  }, [all, win]);
  const counts = useMemoCH(() => ({
    all:      all.length,
    overdue:  all.filter(({ days, c }) => days <= 0 || c.agreement.status === "Expired").length,
    7:        all.filter(({ days })    => days > 0 && days <= 7).length,
    30:       all.filter(({ days })    => days > 7 && days <= 30).length,
    60:       all.filter(({ days })    => days > 30 && days <= 60).length,
  }), [all]);
  const tabs = [
    { id: "all",     label: "All",        n: counts.all },
    { id: "overdue", label: "Overdue",    n: counts.overdue },
    { id: "7",       label: "≤ 7 days",   n: counts[7] },
    { id: "30",      label: "≤ 30 days",  n: counts[30] },
    { id: "60",      label: "≤ 60 days",  n: counts[60] },
  ];
  return (
    <React.Fragment>
      <div className="ch-tabbar" role="tablist">
        {tabs.map((t) => (
          <button
            key={t.id} type="button" role="tab" aria-pressed={win === t.id}
            className={"fw-tab" + (win === t.id ? " is-active" : "")}
            onClick={() => setWin(t.id)}
          >
            {t.label}<span className="fw-tab-count">{t.n}</span>
          </button>
        ))}
      </div>
      <ChRenewalsTable rows={rows} onOpen={onOpen} />
    </React.Fragment>
  );
}

// =====================================================================
// Tab: Classification reviews
// =====================================================================
function ChClassificationTable({ rows, onOpen, compact }) {
  if (!rows.length) {
    return <div className="ch-empty"><Icon name="Check" size={18} /><span>No contractors above the risk threshold.</span></div>;
  }
  return (
    <div className="ctr-table ch-table">
      <div className="ctr-table-head ch-row-classif">
        <div>Contractor</div>
        <div>Tenure</div>
        <div>Hours / week</div>
        <div>Risk</div>
        {!compact && <div>Last reviewed</div>}
        <div></div>
      </div>
      {rows.map((c) => (
        <div className="ctr-table-row ch-row-classif" key={c.id}>
          <div><ChWho c={c} onOpen={onOpen} /></div>
          <div className="tabular">
            {c.tenureMos} mo{c.tenureMos === 1 ? "" : "s"}
            {c.tenureMos >= 18 && <span className="ch-flag-chip ch-flag-chip--warn">FTE risk</span>}
          </div>
          <div className="tabular">
            {c.weeklyHours} hr
            {c.weeklyHours >= 35 && <span className="ch-flag-chip ch-flag-chip--err">Exclusivity</span>}
          </div>
          <div>{window.ContractorRiskPill ? <window.ContractorRiskPill score={c.riskScore} /> : <span className="tabular">{c.riskScore}/100</span>}</div>
          {!compact && <div className="tabular">2026-04-12</div>}
          <div className="ctr-cell-actions">
            <button type="button" className="btn btn--sm btn--secondary" onClick={() => showToast(`Re-review scheduled for ${c.name}`)}>
              <Icon name="ShieldPerson" size={14} />Re-review
            </button>
            <button type="button" className="iconbtn iconbtn--sm" aria-label="More" onClick={(e) => openMenu(e.currentTarget, [
              { icon: "View",  label: "Open contractor", onClick: () => onOpen && onOpen(c.id) },
              { icon: "PDF",   label: "Export determination", onClick: () => showToast(`Determination PDF generated for ${c.name}`, { kind: "success" }) },
              { divider: true },
              { icon: "Cancel", label: "Convert to employee", danger: true, onClick: () => openConfirm({
                title: `Convert ${c.name} to employee?`,
                body: "This starts the conversion workflow. The contractor's engagement will be terminated and a new employee record drafted.",
                primaryLabel: "Start conversion",
                onConfirm: () => showToast(`Conversion started for ${c.name}`, { kind: "success" }),
              }) },
            ])}>
              <Icon name="MoreVert" size={16} />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
function ChClassification({ onOpen }) {
  const rows = useMemoCH(_ch_classificationQueue, []);
  return <ChClassificationTable rows={rows} onOpen={onOpen} />;
}

// =====================================================================
// Tab: Documents
// =====================================================================
function ChDocsTable({ rows, onOpen, compact }) {
  if (!rows.length) {
    return <div className="ch-empty"><Icon name="Check" size={18} /><span>No documents expiring inside the window.</span></div>;
  }
  function statusHue(s) {
    if (s === "On file" || s === "Verified") return "success";
    if (s === "Stale" || s === "Pending") return "warning";
    if (s === "Expired" || s === "Missing") return "error";
    return "default";
  }
  return (
    <div className="ctr-table ch-table">
      <div className="ctr-table-head ch-row-doc">
        <div>Contractor</div>
        <div>Document</div>
        <div>Category</div>
        <div>Status</div>
        <div>Expires</div>
        {!compact && <div>Action</div>}
      </div>
      {rows.map(({ contractor, doc, days }, i) => (
        <div className="ctr-table-row ch-row-doc" key={contractor.id + i}>
          <div><ChWho c={contractor} onOpen={onOpen} /></div>
          <div className="ctr-cell-doc"><Icon name="File" size={16} /><span>{doc.name}</span></div>
          <div>{doc.type}</div>
          <div><span className={`req-pill req-pill--${statusHue(doc.status)}`}>{doc.status}</span></div>
          <div className="tabular">{_ch_fmtDateShort(doc.expires)}{days >= 0 && days <= 90 && <span className="ch-cell-sub"> ({days}d)</span>}</div>
          {!compact && (
            <div className="ctr-cell-actions">
              <button type="button" className="btn btn--sm btn--secondary" onClick={() => showToast(`Request sent to ${contractor.name}`)}>
                <Icon name="Send" size={14} />Re-request
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
function ChDocs({ onOpen }) {
  const rows = useMemoCH(_ch_expiringDocs, []);
  return <ChDocsTable rows={rows} onOpen={onOpen} />;
}

// =====================================================================
// Tab: Invoices
// =====================================================================
function ChInvoicesTable({ rows, onOpen, compact }) {
  if (!rows.length) {
    return <div className="ch-empty"><Icon name="Check" size={18} /><span>No contractor invoices in flight.</span></div>;
  }
  function statusHue(s) {
    if (s === "Paid") return "success";
    if (s === "Submitted" || s === "Approved") return "informative";
    if (s === "Disputed") return "warning";
    return "default";
  }
  return (
    <div className="ctr-table ch-table">
      <div className="ctr-table-head ch-row-cinvoice">
        <div>Contractor</div>
        <div>Invoice</div>
        <div>Period</div>
        <div>Amount</div>
        <div>Status</div>
        {!compact && <div></div>}
      </div>
      {rows.map(({ contractor, inv }) => (
        <div className="ctr-table-row ch-row-cinvoice" key={inv.id}>
          <div><ChWho c={contractor} onOpen={onOpen} /></div>
          <div className="ctr-cell-doc"><Icon name="Wallet" size={16} /><span className="tabular">{inv.id}</span></div>
          <div className="tabular">{inv.period}</div>
          <div className="tabular">{chMoney(inv.amount, inv.currency)}</div>
          <div><span className={`req-pill req-pill--${statusHue(inv.status)}`}>{inv.status}</span></div>
          {!compact && (
            <div className="ctr-cell-actions">
              {inv.status === "Submitted" && (
                <button type="button" className="btn btn--sm btn--secondary" onClick={() => showToast(`${inv.id} approved`, { kind: "success" })}>
                  <Icon name="Check" size={14} />Approve
                </button>
              )}
              {inv.status === "Approved" && (
                <button type="button" className="btn btn--sm btn--secondary" onClick={() => showToast(`${inv.id} marked paid`, { kind: "success" })}>
                  <Icon name="Pay" size={14} />Pay
                </button>
              )}
              <button type="button" className="iconbtn iconbtn--sm" aria-label="More" onClick={(e) => openMenu(e.currentTarget, [
                { icon: "View", label: "Open invoice", onClick: () => showToast(`Opening ${inv.id}`) },
                { icon: "FileDownload", label: "Download PDF", onClick: () => showToast(`Downloading ${inv.id}.pdf`) },
                { icon: "Cancel", label: "Dispute", danger: true, onClick: () => showToast(`Dispute opened on ${inv.id}`, { kind: "warning" }) },
              ])}>
                <Icon name="MoreVert" size={16} />
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
function ChInvoices({ onOpen }) {
  const all = useMemoCH(_ch_invoiceQueue, []);
  const [status, setStatus] = useStateCH("all");
  const rows = useMemoCH(() => {
    if (status === "all") return all;
    return all.filter(({ inv }) => inv.status === status);
  }, [all, status]);
  const counts = useMemoCH(() => ({
    all:        all.length,
    Submitted:  all.filter(({ inv }) => inv.status === "Submitted").length,
    Approved:   all.filter(({ inv }) => inv.status === "Approved").length,
    Paid:       all.filter(({ inv }) => inv.status === "Paid").length,
  }), [all]);
  const tabs = [
    { id: "all",       label: "All",        n: counts.all },
    { id: "Submitted", label: "Submitted",  n: counts.Submitted },
    { id: "Approved",  label: "Approved",   n: counts.Approved },
    { id: "Paid",      label: "Paid",       n: counts.Paid },
  ];
  return (
    <React.Fragment>
      <div className="ch-tabbar" role="tablist">
        {tabs.map((t) => (
          <button
            key={t.id} type="button" role="tab" aria-pressed={status === t.id}
            className={"fw-tab" + (status === t.id ? " is-active" : "")}
            onClick={() => setStatus(t.id)}
          >
            {t.label}<span className="fw-tab-count">{t.n}</span>
          </button>
        ))}
      </div>
      <ChInvoicesTable rows={rows} onOpen={onOpen} />
    </React.Fragment>
  );
}

// =====================================================================
// Tab: Year-end · Tax Wizard
// =====================================================================
function _ch_yearendRows() {
  return _ch_contractors().map((c) => {
    const form = c.taxForm === "W-9" ? "1099-NEC" : c.taxForm === "W-8BEN-E" ? "1042-S" : c.country === "CA" ? "T4A" : "1042-S";
    const threshold = form === "1099-NEC" ? 600 : 0;
    const eligible = (c.ytdPaid || 0) >= threshold;
    const gaps = [];
    if (!c.address || c.address.length < 10) gaps.push("Address");
    if (c.taxForm !== "W-9" && c.taxForm !== "W-8BEN" && c.taxForm !== "W-8BEN-E") gaps.push("Tax form");
    if (c.status !== "Compliant") gaps.push("Onboarding");
    return { c, form, threshold, eligible, gaps };
  });
}

function ChYearend({ onOpen }) {
  const all = useMemoCH(_ch_yearendRows, []);
  const [form, setForm] = useStateCH("all"); // all | 1099-NEC | 1042-S | T4A
  const [selected, setSelected] = useStateCH(() => new Set());
  const rows = useMemoCH(() => {
    return form === "all" ? all : all.filter((r) => r.form === form);
  }, [all, form]);
  const counts = useMemoCH(() => ({
    all:        all.length,
    "1099-NEC": all.filter((r) => r.form === "1099-NEC").length,
    "1042-S":   all.filter((r) => r.form === "1042-S").length,
    "T4A":      all.filter((r) => r.form === "T4A").length,
  }), [all]);
  const eligibleCount = rows.filter((r) => r.eligible && r.gaps.length === 0).length;
  const gapsCount = rows.filter((r) => r.gaps.length > 0).length;
  const totalAmt = rows.filter((r) => r.eligible).reduce((s, r) => s + (r.c.ytdPaid || 0), 0);

  const tabs = [
    { id: "all",       label: "All",       n: counts.all },
    { id: "1099-NEC",  label: "1099-NEC",  n: counts["1099-NEC"], hint: "US contractors" },
    { id: "1042-S",    label: "1042-S",    n: counts["1042-S"],   hint: "Foreign payments" },
    { id: "T4A",       label: "T4A",       n: counts["T4A"],      hint: "Canada" },
  ];

  function toggleOne(id) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }
  function selectAll() {
    setSelected(new Set(rows.filter((r) => r.eligible && r.gaps.length === 0).map((r) => r.c.id)));
  }
  function clearAll() { setSelected(new Set()); }
  function generate() {
    if (selected.size === 0) {
      showToast("Select contractors to include in the packet first");
      return;
    }
    showToast(`${selected.size} year-end forms queued · ${form === "all" ? "mixed" : form}`, { kind: "success" });
    setSelected(new Set());
  }

  return (
    <React.Fragment>
      <div className="ch-yearend-banner">
        <div className="ch-yearend-banner-icon" aria-hidden="true"><Icon name="Calculate" size={20} /></div>
        <div className="ch-yearend-banner-body">
          <h3>Year-end tax wizard</h3>
          <p>
            Generate 1099-NEC (US), 1042-S (foreign), and T4A (Canada) packets for every active contractor.
            Run this once at year-end after final invoices clear. Gaps are flagged before generation —
            re-request missing tax forms or addresses from the contractor before queuing them.
          </p>
        </div>
        <div className="ch-yearend-stats">
          <div><div className="ch-yearend-stats-val tabular">{eligibleCount}</div><div className="ch-yearend-stats-lbl">Eligible</div></div>
          <div><div className="ch-yearend-stats-val tabular ch-yearend-stats-val--warn">{gapsCount}</div><div className="ch-yearend-stats-lbl">With gaps</div></div>
          <div><div className="ch-yearend-stats-val tabular">{chMoney(totalAmt, "USD")}</div><div className="ch-yearend-stats-lbl">Total reportable</div></div>
        </div>
      </div>

      <div className="ch-tabbar" role="tablist">
        {tabs.map((t) => (
          <button
            key={t.id} type="button" role="tab" aria-pressed={form === t.id}
            className={"fw-tab" + (form === t.id ? " is-active" : "")}
            onClick={() => setForm(t.id)}
          >
            {t.label}<span className="fw-tab-count">{t.n}</span>
          </button>
        ))}
      </div>

      {selected.size > 0 && (
        <div className="ch-yearend-bulk">
          <div className="ch-yearend-bulk-l">
            <Icon name="Check" size={14} />
            <span><b>{selected.size}</b> selected · ready to generate</span>
          </div>
          <div className="ch-yearend-bulk-r">
            <button type="button" className="btn btn--sm btn--tertiary" onClick={clearAll}>Clear</button>
            <button type="button" className="btn btn--sm btn--secondary" onClick={() => showToast(`Preview packet built for ${selected.size} contractor(s)`, { kind: "success" })}>
              <Icon name="View" size={14} />Preview packet
            </button>
            <button type="button" className="btn btn--sm btn--primary" onClick={generate}>
              <Icon name="PDF" size={14} />Generate
            </button>
          </div>
        </div>
      )}

      <div className="ctr-table ch-table">
        <div className="ctr-table-head ch-row-yearend">
          <div className="ch-row-yearend-check">
            <input type="checkbox"
              aria-label="Select all eligible"
              checked={rows.length > 0 && selected.size === rows.filter((r) => r.eligible && r.gaps.length === 0).length && selected.size > 0}
              onChange={(e) => e.target.checked ? selectAll() : clearAll()}
            />
          </div>
          <div>Contractor</div>
          <div>Form</div>
          <div>YTD paid</div>
          <div>Threshold</div>
          <div>Status</div>
          <div></div>
        </div>
        {rows.map((r) => {
          const can = r.eligible && r.gaps.length === 0;
          const isChecked = selected.has(r.c.id);
          return (
            <div className={"ctr-table-row ch-row-yearend" + (!can ? " ch-row-yearend--dim" : "")} key={r.c.id}>
              <div className="ch-row-yearend-check">
                <input type="checkbox"
                  disabled={!can}
                  checked={isChecked}
                  onChange={() => toggleOne(r.c.id)}
                  aria-label={`Include ${r.c.name}`}
                />
              </div>
              <div><ChWho c={r.c} onOpen={onOpen} /></div>
              <div>
                <span className="ch-yearend-form-pill">{r.form}</span>
                <div className="ch-cell-sub">{r.c.taxForm}</div>
              </div>
              <div className="tabular">{chMoney(r.c.ytdPaid, r.c.currency)}</div>
              <div className="tabular">{r.threshold === 0 ? "All payments" : chMoney(r.threshold, "USD")}</div>
              <div>
                {r.gaps.length === 0 && r.eligible && <span className="req-pill req-pill--success">Ready</span>}
                {r.gaps.length === 0 && !r.eligible && <span className="req-pill req-pill--default">Below threshold</span>}
                {r.gaps.length > 0 && (
                  <span className="req-pill req-pill--warning" title={"Missing: " + r.gaps.join(", ")}>
                    Missing {r.gaps.length}: {r.gaps.join(", ")}
                  </span>
                )}
              </div>
              <div className="ctr-cell-actions">
                {r.gaps.length > 0 ? (
                  <button type="button" className="btn btn--sm btn--secondary" onClick={() => showToast(`Re-request sent to ${r.c.name}`)}>
                    <Icon name="Send" size={14} />Re-request
                  </button>
                ) : (
                  <button type="button" className="btn btn--sm btn--secondary" onClick={() => showToast(`${r.form} preview generated for ${r.c.name}`, { kind: "success" })}>
                    <Icon name="View" size={14} />Preview
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </React.Fragment>
  );
}

// =====================================================================
// Page
// =====================================================================
const CH_TABS = [
  { id: "overview",       label: "Overview",          icon: "Performance" },
  { id: "renewals",       label: "Renewals",          icon: "Calendar" },
  { id: "classification", label: "Classification",    icon: "ShieldPerson" },
  { id: "documents",      label: "Expiring docs",     icon: "File" },
  { id: "invoices",       label: "Invoice approvals", icon: "Wallet" },
  { id: "yearend",        label: "Year-end · 1099 / 1042-S / T4A", icon: "Calculate" },
];

function ContractorsHubPage({ reloadKey, onReload, onOpenContractor }) {
  const [tab, setTab] = useStateCH(() => {
    try { return window.sessionStorage.getItem("flexwork.contractors.hub.tab") || "overview"; }
    catch (e) { return "overview"; }
  });
  React.useEffect(() => {
    try { window.sessionStorage.setItem("flexwork.contractors.hub.tab", tab); } catch (e) { /* */ }
  }, [tab]);
  const k = useMemoCH(_ch_kpis, [reloadKey]);

  function go(id) { setTab(id); }
  const openContractor = (id) => {
    if (onOpenContractor) onOpenContractor(id);
    else if (window.flexGoTo) window.flexGoTo({ page: "workforce", sub: "details", id });
  };

  return (
    <React.Fragment>
      <Omnibar
        icon="PersonAuthorize"
        title="Contractors"
        subtitle="IC compliance · agreements · classification · year-end"
        dayforce={{
          primitive: "Employee + workerType = Contractor",
          subtitle: "Compliance.ClassificationDetermination · Payroll.YearEndForm",
          product: "People · Compliance · Payroll · Flex Work",
          strategy: "Reuse · Extend · Add",
          note: "The Contractors Hub aggregates the org-wide IC compliance surface — renewals, classification reviews, expiring docs, invoice approvals, and year-end forms. Each row links to the underlying Employee record + its Compliance and Payroll children.",
          anchor: "people",
        }}
      >
        <button type="button" className="iconbtn" onClick={onReload} aria-label="Reload content" title="Reload">
          <Icon name="Refresh" size={18} />
        </button>
        <button
          type="button"
          className="omni-create-btn"
          onClick={() => window.openAddContractor && window.openAddContractor()}
        >
          <Icon name="PersonPlus" size={20} />
          <span>Add contractor</span>
        </button>
        <button
          type="button"
          className="iconbtn"
          aria-label="More actions"
          onClick={(e) => openMenu(e.currentTarget, [
            { icon: "FileDownload", label: "Export contractor roster (CSV)", onClick: () => showToast("Exporting contractors.csv", { kind: "success" }) },
            { icon: "PDF",          label: "Export IC compliance report",     onClick: () => showToast("Generating IC compliance report", { kind: "success" }) },
            { divider: true },
            { icon: "Settings",     label: "Contractor settings",             onClick: () => window.flexGoTo && window.flexGoTo({ page: "settings", sub: "worker-types" }) },
          ])}
        >
          <Icon name="MoreVert" size={20} />
        </button>
      </Omnibar>

      <div className="content-section ch-content" key={reloadKey}>
        <nav className="ch-tabnav" aria-label="Contractors hub tabs">
          {CH_TABS.map((t) => {
            const badge = t.id === "renewals"       ? k.expiringSoon
                       : t.id === "classification" ? k.atRisk
                       : t.id === "invoices"        ? k.pendingInv
                       : null;
            return (
              <button
                key={t.id} type="button" role="tab" aria-selected={tab === t.id}
                className={"ch-tabnav-btn" + (tab === t.id ? " is-active" : "")}
                onClick={() => go(t.id)}
              >
                <Icon name={t.icon} size={16} />
                <span>{t.label}</span>
                {badge != null && badge > 0 && (
                  <span className={"ch-tabnav-badge" + (t.id === "classification" ? " ch-tabnav-badge--err" : " ch-tabnav-badge--warn")}>{badge}</span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="ch-body">
          {tab === "overview"       && <ChOverview       onOpen={openContractor} onGoTab={go} />}
          {tab === "renewals"       && <ChRenewals       onOpen={openContractor} />}
          {tab === "classification" && <ChClassification onOpen={openContractor} />}
          {tab === "documents"      && <ChDocs           onOpen={openContractor} />}
          {tab === "invoices"       && <ChInvoices       onOpen={openContractor} />}
          {tab === "yearend"        && <ChYearend        onOpen={openContractor} />}
        </div>
      </div>
    </React.Fragment>
  );
}

Object.assign(window, {
  ContractorsHubPage,
});

// =====================================================================
// Contractor engagements table — used by Requisitions when the
// engagement-type switch is set to "Contractor". A contractor doesn't
// have a requisition in the agency sense (no distribution, no bidding);
// the engagement IS the unit of work. This table renders one row per
// active contractor engagement with rate, classification and lifecycle.
// =====================================================================
function ContractorEngagementsTable({ onOpenRow }) {
  const all = useMemoCH(_ch_contractors, []);
  const [statusTab, setStatusTab] = useStateCH("all");
  const counts = useMemoCH(() => ({
    all:          all.length,
    "Compliant":  all.filter((c) => c.status === "Compliant").length,
    "Onboarding": all.filter((c) => c.status === "Onboarding").length,
    "Expired":    all.filter((c) => c.status === "Expired").length,
  }), [all]);
  const rows = useMemoCH(() => {
    if (statusTab === "all") return all;
    return all.filter((c) => c.status === statusTab);
  }, [all, statusTab]);

  const tabs = [
    { id: "all",        label: "All",         n: counts.all },
    { id: "Compliant",  label: "Compliant",   n: counts["Compliant"] },
    { id: "Onboarding", label: "Onboarding",  n: counts["Onboarding"] },
    { id: "Expired",    label: "Expired",     n: counts["Expired"] },
  ];

  function rateLabel(c) {
    const base = chMoney(c.rateAmount, c.currency);
    const unit = c.rateType === "Hourly" ? "/ hr"
              : c.rateType === "Per-word" ? "/ word"
              : c.rateType === "Daily" ? "/ day"
              : c.rateType.startsWith("Fixed") ? "/ month"
              : c.rateType === "Project (Milestone)" ? "/ milestone"
              : "";
    return `${base} ${unit}`.trim();
  }

  return (
    <div className="req-table-card ce-table-card" role="table" aria-label="Contractor engagements">
      <div className="ch-tabbar ce-tabbar">
        {tabs.map((t) => (
          <button
            key={t.id} type="button" role="tab" aria-pressed={statusTab === t.id}
            className={"fw-tab" + (statusTab === t.id ? " is-active" : "")}
            onClick={() => setStatusTab(t.id)}
          >
            {t.label}<span className="fw-tab-count">{t.n}</span>
          </button>
        ))}
      </div>

      <div className="ce-banner" role="note">
        <span className="ce-banner-icon" aria-hidden="true">
          <Icon name="PersonAuthorize" size={16} />
        </span>
        <span>
          Contractor engagements bypass the distribution &amp; bidding flow used by Frontline requisitions.
          Each row is an active direct engagement governed by an MSA + SOW between the buyer and the contractor.
        </span>
      </div>

      <div className="ctr-table ch-table">
        <div className="ctr-table-head ce-row">
          <div>Contractor</div>
          <div>Engagement</div>
          <div>Rate</div>
          <div>Hours / wk</div>
          <div>Classification</div>
          <div>Agreement</div>
          <div></div>
        </div>
        {rows.map((c) => {
          const days = _ch_daysUntil(c.agreement && c.agreement.expires);
          const expiringSoon = days <= 60 && days > 0;
          const expired = days <= 0 || c.agreement.status === "Expired";
          return (
            <div className="ctr-table-row ce-row" key={c.id}>
              <div><ChWho c={c} onOpen={onOpenRow} /></div>
              <div>
                <div className="ch-cell-strong">{c.jobs && c.jobs[0]}</div>
                <div className="ch-cell-sub">{c.agreement.type}</div>
              </div>
              <div>
                <div className="tabular ch-cell-strong">{rateLabel(c)}</div>
                <div className="ch-cell-sub">YTD {chMoney(c.ytdPaid, c.currency)}</div>
              </div>
              <div className="tabular">
                {c.weeklyHours} hr
                {c.weeklyHours >= 35 && <span className="ch-flag-chip ch-flag-chip--err">FTE</span>}
              </div>
              <div>
                {window.ContractorRiskPill
                  ? <window.ContractorRiskPill score={c.riskScore} />
                  : <span className="req-pill">{c.classification}</span>}
              </div>
              <div>
                <div className="tabular">{_ch_fmtDateShort(c.agreement.effective)} — {_ch_fmtDateShort(c.agreement.expires)}</div>
                <div className="ch-cell-sub">
                  {expired ? <span style={{ color: "var(--evr-content-status-error-default)" }}>Expired / renewal due</span>
                  : expiringSoon ? <span style={{ color: "var(--evr-content-status-warning-default)" }}>Renews in {days}d</span>
                  : c.agreement.status}
                </div>
              </div>
              <div className="ctr-cell-actions">
                <button type="button" className="btn btn--sm btn--secondary" onClick={() => onOpenRow && onOpenRow(c.id)}>
                  <Icon name="View" size={14} />Open
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

Object.assign(window, {
  ContractorEngagementsTable,
});

// =====================================================================
// Dashboard Contractor lane — shown in the Home overview when the
// engagement-type switch is set to "Contractor". Compact view: KPIs +
// the most urgent queues. "View all" links jump to the Contractors Hub.
// =====================================================================
function DashContractor({ reloadKey, onGoTo }) {
  const k = useMemoCH(_ch_kpis, [reloadKey]);
  const renewals = useMemoCH(() => _ch_renewalQueue().slice(0, 4), [reloadKey]);
  const classif  = useMemoCH(() => _ch_classificationQueue().slice(0, 4), [reloadKey]);
  const docs     = useMemoCH(() => _ch_expiringDocs().slice(0, 4), [reloadKey]);
  const invs     = useMemoCH(() => _ch_invoiceQueue().filter(({ inv }) => inv.status === "Submitted" || inv.status === "Approved").slice(0, 4), [reloadKey]);
  const goToHub = (tab) => {
    try { window.sessionStorage.setItem("flexwork.contractors.hub.tab", tab); } catch (e) { /* */ }
    if (onGoTo) onGoTo({ page: "contractors" });
  };
  const openContractor = (id) => onGoTo && onGoTo({ page: "workforce", sub: "details", id });

  return (
    <div className="dash-contractor-lane">
      <div className="vms-kpis ch-kpi-row">
        <ChKpi label="Active contractors"      value={k.total} foot={`${k.onboarding} onboarding · ${k.compliant} compliant`} />
        <ChKpi label="Renewals due ≤ 60 days"  value={k.expiringSoon} foot="MSA + SOW expiring" level={k.expiringSoon > 0 ? "warn" : null} />
        <ChKpi label="Classification at risk"  value={k.atRisk}    foot={`${k.review} to review`}        level={k.atRisk > 0 ? "err" : null} />
        <ChKpi label="Invoices pending"        value={k.pendingInv} foot={chMoney(k.pendingAmt, "USD")}  level={k.pendingInv > 0 ? "warn" : null} />
        <ChKpi label="YTD spend"               value={chMoney(k.ytdSpend, "USD")} foot="Across all currencies" />
      </div>

      <div className="ch-two-col">
        <section className="ch-section">
          <header className="ch-section-head">
            <div><h3>Renewals due</h3><p>Agreements expiring inside 60 days.</p></div>
            <button type="button" className="btn btn--sm btn--secondary" onClick={() => goToHub("renewals")}>
              View all <Icon name="ArrowRight" size={14} />
            </button>
          </header>
          <ChRenewalsTable rows={renewals} onOpen={openContractor} compact />
        </section>
        <section className="ch-section">
          <header className="ch-section-head">
            <div><h3>Classification reviews</h3><p>Contractors above 35/100 risk.</p></div>
            <button type="button" className="btn btn--sm btn--secondary" onClick={() => goToHub("classification")}>
              View all <Icon name="ArrowRight" size={14} />
            </button>
          </header>
          <ChClassificationTable rows={classif} onOpen={openContractor} compact />
        </section>
      </div>

      <div className="ch-two-col">
        <section className="ch-section">
          <header className="ch-section-head">
            <div><h3>Expiring documents</h3><p>COI, ID, tax forms inside 90 days.</p></div>
            <button type="button" className="btn btn--sm btn--secondary" onClick={() => goToHub("documents")}>
              View all <Icon name="ArrowRight" size={14} />
            </button>
          </header>
          <ChDocsTable rows={docs} onOpen={openContractor} compact />
        </section>
        <section className="ch-section">
          <header className="ch-section-head">
            <div><h3>Invoice approvals</h3><p>Contractor-submitted invoices in AP.</p></div>
            <button type="button" className="btn btn--sm btn--secondary" onClick={() => goToHub("invoices")}>
              View all <Icon name="ArrowRight" size={14} />
            </button>
          </header>
          <ChInvoicesTable rows={invs} onOpen={openContractor} compact />
        </section>
      </div>
    </div>
  );
}

Object.assign(window, {
  DashContractor,
});

// =====================================================================
// Invoice-list integration — exposes contractor invoices in the shape
// expected by the Invoices page so they merge into the main AP list.
// Mirrors window.getSowInvoiceRows(). When the contractors flag is off
// the Invoices page never calls this, and the contractor invoices stay
// scoped to the worker detail surface.
// =====================================================================
function getContractorInvoiceRows() {
  const out = [];
  const inv = window.CONTRACTOR_INVOICES || {};
  function asMM_DD_YYYY(iso) {
    if (!iso) return "";
    const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return iso;
    return `${m[2]}.${m[3]}.${m[1]}`;
  }
  function asMoney(amt, ccy) {
    try {
      return new Intl.NumberFormat("en-US", { style: "currency", currency: ccy || "USD", maximumFractionDigits: 2 }).format(amt);
    } catch (e) { return `$${(amt || 0).toFixed(2)}`; }
  }
  for (const cid of Object.keys(inv)) {
    const c = window.getContractorById ? window.getContractorById(cid) : null;
    for (const r of inv[cid]) {
      // Map contractor invoice statuses onto AP statuses so the rows
      // line up with the main list's status tabs.
      const st = r.status === "Submitted" ? "Generated"
              : r.status === "Approved"  ? "Issued"
              : r.status === "Paid"      ? "Paid"
              : r.status === "Disputed"  ? "Overdue"
              : "Generated";
      out.push({
        id: r.id,
        req: `Engagement ${cid}`,
        // The Invoices table looks up REQ_SUPPLIERS by row.supplier. For
        // contractor rows there is no supplier — leave it null so the
        // table renders the contractor row treatment instead.
        supplier: null,
        contact: c ? c.name : "Contractor",
        status: st,
        locations: [c ? c.countryName : "—"],
        amount: asMoney(r.amount, r.currency),
        hours: r.hours ? `${r.hours}:00` : undefined,
        invDate: asMM_DD_YYYY(r.date),
        dueDate: "",
        // engagementType="Contractor" drives the source-filter chip,
        // payment-routing copy, and contractor-avatar treatment in the
        // row. The canonical Engagement Type column resolves
        // "Contractor" → "Assignment" via the ENG_TYPE_ALIAS map: an
        // IC engaged on a named, dated assignment, billed Hourly with
        // Time Tracking, and (per Supplier Types) Independent
        // contractor.
        engagementType: "Contractor",
        billingBasis: "Hourly",
        timeCapture: "Time Tracking",
        supplierTypes: ["Independent contractor"],
        contractorId: cid,
      });
    }
  }
  return out;
}

Object.assign(window, {
  getContractorInvoiceRows,
});
