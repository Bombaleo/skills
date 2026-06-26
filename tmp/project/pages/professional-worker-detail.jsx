// =====================================================================
// Flex Work — Professional Worker Detail Sections
//   Renders the Pro-specific accordions inside WorkerDetailsPage when
//   the worker's pool is "Professional". Replaces the Frontline
//   "Compliance & credentialing / Performance / Schedule / Blocked
//   locations" stack with the shape Professional Services /
//   permanent-engagement tools use:
//     · Engagement & contract  — cadence, rate, term, renewal, SOW ref
//     · Interview history       — original candidate scorecard
//     · Renewals                — timeline + action
//     · Expenses                — T&E reports against the SOW
//     · Invoices                — every invoice billed against this person
//     · Documents               — MSA, SOW, NDA, IP, ID
//   The Frontline Schedule / Performance / Blocked-locations accordions
//   would not make sense here — there are no shifts.
// =====================================================================

const { useState: useStatePwd, useMemo: useMemoPwd } = React;

// ---------- Tiny helpers ---------------------------------------------
function _pwdMoney(amt, ccy) {
  if (typeof window.profFmtMoney === "function") return window.profFmtMoney(amt, ccy);
  if (typeof amt !== "number") return "—";
  return `${ccy || "USD"} ${amt.toLocaleString("en-US")}`;
}
function _pwdCadenceLabel(c) {
  return typeof window.profCadenceLabel === "function" ? window.profCadenceLabel(c) : c;
}
function _pwdDaysUntil(dateStr) {
  if (!dateStr) return null;
  try {
    const today = window.flexToday ? window.flexToday() : new Date(2026, 4, 19);
    const d = new Date(dateStr);
    if (isNaN(d)) return null;
    const ms = d.getTime() - today.getTime();
    return Math.round(ms / 86400000);
  } catch (e) { return null; }
}
function _pwdFmtDate(dateStr) {
  if (!dateStr || dateStr === "Permanent") return dateStr || "—";
  try {
    const d = new Date(dateStr);
    if (isNaN(d)) return dateStr;
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  } catch (e) { return dateStr; }
}

// Annualize a cadence rate so we can show "Annual contract value" cleanly.
function _pwdAnnualize(cadence, amt) {
  if (typeof amt !== "number") return null;
  if (cadence === "weekly")  return amt * 52;
  if (cadence === "monthly") return amt * 12;
  if (cadence === "annual")  return amt;
  return null;
}

// =====================================================================
// 1. Engagement & contract
// =====================================================================
function ProEngagementBody({ w }) {
  const annual = _pwdAnnualize(w.cadence, w.rateAmount);
  const renewalIn = _pwdDaysUntil(w.renewalDate);
  const tsMode = w.timesheetMode === "required" ? "Required (effort tracking)" : "Not required (deliverable-based)";
  return (
    <div className="pwd-eng">
      <div className="pwd-eng-grid">
        <section className="pwd-eng-card">
          <h5 className="pwd-eng-h">Contract</h5>
          <dl className="pwd-kv-grid">
            <div className="pwd-kv">
              <dt>Engagement type</dt>
              <dd><span className="pw-chip pw-chip--perm">Permanent · no end date</span></dd>
            </div>
            <div className="pwd-kv">
              <dt>Cadence</dt>
              <dd><span className="pw-chip pw-chip--cadence">{_pwdCadenceLabel(w.cadence)}</span></dd>
            </div>
            <div className="pwd-kv">
              <dt>Rate</dt>
              <dd className="tabular">{_pwdMoney(w.rateAmount, w.currency)} <span className="pwd-aside">/ {w.cadence === "weekly" ? "wk" : w.cadence === "monthly" ? "mo" : "yr"}</span></dd>
            </div>
            <div className="pwd-kv">
              <dt>Currency</dt>
              <dd>{w.currency}</dd>
            </div>
            <div className="pwd-kv">
              <dt>Annual contract value</dt>
              <dd className="tabular">{_pwdMoney(annual, w.currency)}</dd>
            </div>
            <div className="pwd-kv">
              <dt>Timesheet mode</dt>
              <dd>{tsMode}</dd>
            </div>
            <div className="pwd-kv">
              <dt>SOW reference</dt>
              <dd className="tabular">{w.sowRef}</dd>
            </div>
            <div className="pwd-kv">
              <dt>Hiring manager</dt>
              <dd>{w.hiringManager}</dd>
            </div>
          </dl>
        </section>

        <section className="pwd-eng-card">
          <h5 className="pwd-eng-h">Term &amp; renewal</h5>
          <dl className="pwd-kv-grid">
            <div className="pwd-kv">
              <dt>Term start</dt>
              <dd className="tabular">{_pwdFmtDate(w.termStart)}</dd>
            </div>
            <div className="pwd-kv">
              <dt>Term end</dt>
              <dd>{w.termEnd}</dd>
            </div>
            <div className="pwd-kv">
              <dt>Next renewal</dt>
              <dd className="tabular">{_pwdFmtDate(w.renewalDate)}</dd>
            </div>
            <div className="pwd-kv">
              <dt>Renewal in</dt>
              <dd>
                {renewalIn == null ? "—" : (
                  <span className={`req-pill req-pill--${renewalIn <= 30 ? "warning" : renewalIn <= 90 ? "informative" : "default"}`}>
                    {renewalIn} day{renewalIn === 1 ? "" : "s"}
                  </span>
                )}
              </dd>
            </div>
            <div className="pwd-kv">
              <dt>Policy</dt>
              <dd>Auto-renew 12 months · 30-day notice</dd>
            </div>
            <div className="pwd-kv">
              <dt>YTD invoiced</dt>
              <dd className="tabular">{_pwdMoney(w.ytdInvoiced, w.currency)}</dd>
            </div>
          </dl>

          <footer className="pwd-eng-actions">
            <button
              type="button"
              className="btn btn--sm btn--primary"
              onClick={() => {
                if (typeof window.openRenewProfessional === "function") {
                  window.openRenewProfessional(w);
                } else {
                  showToast(`Renewal panel opened for ${w.name}`);
                }
              }}
            >
              <Icon name="Refresh" size={14} />Renew engagement
            </button>
            <button
              type="button"
              className="btn btn--sm btn--secondary"
              onClick={() => showToast(`SOW exported for ${w.name}`, { kind: "success" })}
            >
              <Icon name="Export" size={14} />Export SOW
            </button>
            <button
              type="button"
              className="btn btn--sm btn--secondary"
              onClick={() => showToast(`Amendment draft created`)}
            >
              <Icon name="DocumentAdd" size={14} />New amendment
            </button>
          </footer>
        </section>
      </div>
    </div>
  );
}

// =====================================================================
// 2. Interview history
// =====================================================================
// Synth a realistic original-hire scorecard from the worker's metadata.
function _pwdInterviews(w) {
  const seed = w.id;
  function rng() {
    let h = 5381;
    for (let i = 0; i < seed.length; i++) h = ((h << 5) + h) ^ seed.charCodeAt(i);
    return Math.abs(h);
  }
  const r = rng();
  const scores = [
    Number((3.8 + ((r % 12) / 10)).toFixed(1)),
    Number((4.0 + (((r >> 4) % 8) / 10)).toFixed(1)),
    Number((4.2 + (((r >> 8) % 7) / 10)).toFixed(1)),
  ].map((v) => Math.min(5, v));
  const decisionScore = Number((scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1));
  const startBase = w.termStart ? new Date(w.termStart) : new Date(2025, 6, 1);
  const mk = (offsetDays, label) => {
    const d = new Date(startBase); d.setDate(d.getDate() - offsetDays);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };
  return {
    panels: [
      { date: mk(35), type: "Phone screen",  panel: "Recruiting · Maya Chen",                          score: scores[0], notes: "Strong communication; broad enterprise exposure; aligned on cadence and compensation expectations." },
      { date: mk(20), type: "Technical panel", panel: `Hiring manager: ${w.hiringManager}, + 2`,        score: scores[1], notes: "Deep functional craft; thoughtful trade-offs in scenario discussion; cleared every technical question." },
      { date: mk(8),  type: "Executive panel", panel: "Leadership: Amy Hennen, Terry Donin",           score: scores[2], notes: "Polished; high signal on judgment; clear cultural fit; would hire again without reservation." },
    ],
    decisionScore,
  };
}

function ProInterviewHistoryBody({ w }) {
  const data = useMemoPwd(() => _pwdInterviews(w), [w.id]);
  return (
    <div className="pwd-int">
      <header className="pwd-int-summary">
        <div>
          <span className="pwd-int-eyebrow">Original hire scorecard</span>
          <h5 className="pwd-int-name">{w.name}</h5>
          <p className="pwd-int-sub">Hired {_pwdFmtDate(w.termStart)} into {w.jobs[0]}.</p>
        </div>
        <div className="pwd-int-score">
          <span className="pwd-int-score-label">Decision score</span>
          {window.ProScoreStars
            ? <window.ProScoreStars value={data.decisionScore} size={18} />
            : <span className="tabular">{data.decisionScore}/5</span>}
        </div>
      </header>
      <ol className="pwd-int-list">
        {data.panels.map((p, i) => (
          <li key={i} className="pwd-int-item">
            <div className="pwd-int-row">
              <span className="pwd-int-when tabular">{p.date}</span>
              <span className="pwd-int-type">{p.type}</span>
              {window.ProScoreStars
                ? <window.ProScoreStars value={p.score} size={12} />
                : <span className="tabular">{p.score}/5</span>}
            </div>
            <div className="pwd-int-panel">Panel: {p.panel}</div>
            <p className="pwd-int-notes">{p.notes}</p>
          </li>
        ))}
      </ol>
      <footer className="pwd-int-actions">
        <button type="button" className="btn btn--sm btn--secondary" onClick={() => showToast("Scorecard exported", { kind: "success" })}>
          <Icon name="Export" size={14} />Export scorecard
        </button>
        <button type="button" className="btn btn--sm btn--secondary" onClick={() => showToast("Pipeline opened")}>
          <Icon name="PersonLines" size={14} />View original pipeline
        </button>
      </footer>
    </div>
  );
}

// =====================================================================
// 3. Renewals
// =====================================================================
function ProRenewalsBody({ w }) {
  const renewalDays = _pwdDaysUntil(w.renewalDate);
  // Synthetic prior-renewal trail; in production this comes from the
  // ContingentEngagement renewal history.
  const trail = [
    { type: "Hired",   date: w.termStart, note: "Initial offer accepted at cadence " + _pwdCadenceLabel(w.cadence).toLowerCase() + ".", tone: "success" },
    { type: "Renewal", date: "2025-09-15", note: "First annual renewal approved by hiring manager and finance.", tone: "info" },
  ];
  if (renewalDays != null && renewalDays <= 90) {
    trail.push({ type: "Upcoming", date: w.renewalDate, note: "Auto-renewal will fire 30 days before this date unless either party gives notice.", tone: "warning" });
  } else {
    trail.push({ type: "Upcoming", date: w.renewalDate, note: "Auto-renew window opens 30 days before this date.", tone: "default" });
  }
  return (
    <div className="pwd-renew">
      <div className="pwd-renew-callout" role="note">
        <Icon name="Refresh" size={14} />
        <div className="pwd-renew-callout-text">
          <b>Next renewal: {_pwdFmtDate(w.renewalDate)}</b>
          <span>
            {renewalDays == null
              ? " "
              : renewalDays <= 0
              ? " — overdue, renew or close out the engagement to stay compliant."
              : renewalDays <= 30
              ? ` — only ${renewalDays} day${renewalDays === 1 ? "" : "s"} away. Confirm renewal or send notice now.`
              : renewalDays <= 90
              ? ` — ${renewalDays} days away. Review performance, then approve or amend.`
              : ` — ${renewalDays} days away. No action needed yet.`}
          </span>
        </div>
        <button
          type="button"
          className="btn btn--sm btn--primary"
          onClick={() => {
            if (typeof window.openRenewProfessional === "function") {
              window.openRenewProfessional(w);
            } else {
              showToast(`Renewal panel opened for ${w.name}`);
            }
          }}
        >
          <Icon name="Refresh" size={14} />Renew now
        </button>
      </div>

      <ol className="pwd-renew-trail">
        {trail.map((t, i) => (
          <li key={i} className={`pwd-renew-step pwd-renew-step--${t.tone}`}>
            <span className={`pwd-renew-dot pwd-renew-dot--${t.tone}`} aria-hidden="true" />
            <div className="pwd-renew-step-body">
              <div className="pwd-renew-step-head">
                <b>{t.type}</b>
                <span className="pwd-renew-step-when tabular">{_pwdFmtDate(t.date)}</span>
              </div>
              <p>{t.note}</p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

// =====================================================================
// 4. Expenses (T&E)
// =====================================================================
// Sample expense reports keyed by worker. In production these tie to
// ContingentEngagement and route through the same AP workflow as
// invoices. Layout matches a standard T&E report.
function _pwdExpenseSeed(w) {
  // 0–3 reports based on worker ID, deterministic.
  const h = (w.id || "").split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const n = h % 4;
  const months = ["April", "May"];
  const reports = [];
  const cats = ["Travel", "Lodging", "Meals", "Conference", "Software"];
  for (let i = 0; i < n; i++) {
    const seedR = (h + i * 13) % 1000;
    const amount = 240 + (seedR % 1900);
    reports.push({
      id: `EXP-${(h + i).toString(36).toUpperCase().slice(-5)}`,
      period: months[i % months.length] + ", week " + ((seedR % 4) + 1),
      submitted: `2026-${i === 0 ? "05" : "04"}-${((seedR % 25) + 1).toString().padStart(2, "0")}`,
      amount,
      currency: w.currency,
      status: i === 0 ? "Submitted" : i === 1 ? "Approved" : "Paid",
      lines: 2 + (seedR % 4),
      topCategory: cats[seedR % cats.length],
    });
  }
  return reports;
}

function ProExpensesBody({ w }) {
  const reports = useMemoPwd(() => _pwdExpenseSeed(w), [w.id]);
  if (reports.length === 0) {
    return (
      <div className="pwd-exp-empty">
        <Icon name="Wallet" size={28} />
        <p>No expense reports submitted yet.</p>
        <p className="pwd-exp-empty-sub">Expense reports are optional under {w.sowRef}. Submitted reports route through the same AP workflow as invoices.</p>
      </div>
    );
  }
  const statusHue = (s) => s === "Paid" ? "success" : s === "Approved" ? "informative" : "warning";
  return (
    <div className="pwd-exp">
      <header className="pwd-exp-head">
        <div>
          <h5 className="pwd-exp-h">{reports.length} expense report{reports.length === 1 ? "" : "s"}</h5>
          <p className="pwd-exp-sub">All reports are billed against <b className="tabular">{w.sowRef}</b>. Approval routes to {w.hiringManager}.</p>
        </div>
        <button
          type="button"
          className="btn btn--sm btn--secondary"
          onClick={() => showToast(`${reports.length} report${reports.length === 1 ? "" : "s"} exported`, { kind: "success" })}
        >
          <Icon name="Export" size={14} />Export all
        </button>
      </header>
      <div className="pwd-exp-table" role="table">
        <div className="pwd-exp-row pwd-exp-row--head" role="row">
          <span>Report</span>
          <span>Period</span>
          <span>Lines</span>
          <span>Top category</span>
          <span>Submitted</span>
          <span style={{ textAlign: "right" }}>Amount</span>
          <span>Status</span>
        </div>
        {reports.map((r) => (
          <div className="pwd-exp-row" role="row" key={r.id}>
            <span className="tabular pwd-exp-id">
              <Icon name="Wallet" size={14} />{r.id}
            </span>
            <span>{r.period}</span>
            <span className="tabular">{r.lines}</span>
            <span>{r.topCategory}</span>
            <span className="tabular">{_pwdFmtDate(r.submitted)}</span>
            <span className="tabular" style={{ textAlign: "right" }}>{_pwdMoney(r.amount, r.currency)}</span>
            <span><span className={`req-pill req-pill--${statusHue(r.status)}`}>{r.status}</span></span>
          </div>
        ))}
      </div>
    </div>
  );
}

// =====================================================================
// 5. Invoices billed against this worker
// =====================================================================
function ProWorkerInvoicesBody({ w }) {
  const all = window.getProfessionalInvoices ? window.getProfessionalInvoices() : [];
  const rows = all.filter((i) => i.worker === w.name);
  if (rows.length === 0) {
    return (
      <div className="pwd-inv-empty">
        <Icon name="Pay" size={28} />
        <p>No invoices yet.</p>
        <p className="pwd-exp-empty-sub">Invoices will generate automatically on the {_pwdCadenceLabel(w.cadence).toLowerCase()} cadence, starting from the next billing date.</p>
      </div>
    );
  }
  const statusHue = (s) => s === "Paid" ? "success" : s === "Approved" ? "informative" : "warning";
  return (
    <div className="pwd-inv">
      <div className="pwd-inv-table" role="table">
        <div className="pwd-inv-row pwd-inv-row--head" role="row">
          <span>Invoice</span>
          <span>Period</span>
          <span>SOW reference</span>
          <span>Date</span>
          <span style={{ textAlign: "right" }}>Amount</span>
          <span>Status</span>
        </div>
        {rows.map((r) => (
          <div className="pwd-inv-row" role="row" key={r.id}>
            <span className="tabular pwd-inv-id">
              <Icon name="Pay" size={14} />{r.id}
            </span>
            <span>{r.period}</span>
            <span className="tabular">{r.sowRef}</span>
            <span className="tabular">{_pwdFmtDate(r.date)}</span>
            <span className="tabular" style={{ textAlign: "right" }}>{_pwdMoney(r.amount, r.currency)}</span>
            <span><span className={`req-pill req-pill--${statusHue(r.status)}`}>{r.status}</span></span>
          </div>
        ))}
      </div>
    </div>
  );
}

// =====================================================================
// 6. Documents
// =====================================================================
function ProDocumentsBody({ w }) {
  const docs = [
    { id: "MSA-2024-014",  type: "Master Services Agreement", status: "Counter-signed", effective: "2024-08-01",   expires: "—" },
    { id: w.sowRef,        type: "Statement of Work",         status: "Counter-signed", effective: w.termStart,    expires: w.termEnd === "Permanent" ? "—" : w.termEnd },
    { id: "NDA-" + w.id.toUpperCase(),  type: "NDA",          status: "Counter-signed", effective: w.termStart,    expires: "—" },
    { id: "IP-" + w.id.toUpperCase(),   type: "IP assignment", status: "Counter-signed", effective: w.termStart,   expires: "—" },
    { id: "ID-" + w.id.toUpperCase(),   type: "Government ID",  status: "On file",       effective: w.termStart,   expires: "—" },
  ];
  return (
    <div className="pwd-docs">
      <div className="pwd-docs-table" role="table">
        <div className="pwd-docs-row pwd-docs-row--head" role="row">
          <span>Document</span>
          <span>Type</span>
          <span>Status</span>
          <span>Effective</span>
          <span>Expires</span>
          <span></span>
        </div>
        {docs.map((d) => (
          <div className="pwd-docs-row" role="row" key={d.id}>
            <span className="tabular pwd-docs-id">
              <Icon name="File" size={14} />{d.id}
            </span>
            <span>{d.type}</span>
            <span><span className="req-pill req-pill--success">{d.status}</span></span>
            <span className="tabular">{_pwdFmtDate(d.effective)}</span>
            <span className="tabular">{d.expires === "—" ? d.expires : _pwdFmtDate(d.expires)}</span>
            <span className="pwd-docs-actions">
              <button type="button" className="iconbtn iconbtn--sm" aria-label="Download" onClick={() => showToast(`Downloading ${d.id}.pdf`)}>
                <Icon name="FileDownload" size={14} />
              </button>
              <button type="button" className="iconbtn iconbtn--sm" aria-label="More"
                onClick={(e) => openMenu(e.currentTarget, [
                  { icon: "View",    label: "View document",    onClick: () => showToast(`Opening ${d.id}`) },
                  { icon: "Send",    label: "Resend for signature", onClick: () => showToast(`Resent ${d.id}`) },
                  { icon: "Refresh", label: "Generate amendment", onClick: () => showToast("Amendment drafted") },
                ])}
              >
                <Icon name="MoreVert" size={14} />
              </button>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// =====================================================================
// Top-level: ProfessionalDetailSections — drop in inside WorkerDetailsPage
// =====================================================================
function ProfessionalDetailSections({ w }) {
  if (!w || w.pool !== "Professional") return null;
  if (!window.WfAccordionCard) return null;
  const A = window.WfAccordionCard;
  return (
    <React.Fragment>
      <A icon="Briefcase" title="Engagement & contract" subtitle="Cadence, rate, term, renewal, SOW reference" defaultOpen>
        <ProEngagementBody w={w} />
      </A>
      <A icon="PersonLines" title="Interview history" subtitle="Original hire scorecard and panel notes" defaultOpen>
        <ProInterviewHistoryBody w={w} />
      </A>
      <A icon="Refresh" title="Renewals" subtitle="Renewal timeline and upcoming actions">
        <ProRenewalsBody w={w} />
      </A>
      <A icon="Pay" title="Invoices" subtitle="Invoices generated on this engagement">
        <ProWorkerInvoicesBody w={w} />
      </A>
      <A icon="Wallet" title="Expenses" subtitle="T&E reports billed against this SOW">
        <ProExpensesBody w={w} />
      </A>
      <A icon="File" title="Documents" subtitle="MSA, SOW, NDA, IP assignment, ID">
        <ProDocumentsBody w={w} />
      </A>
    </React.Fragment>
  );
}

Object.assign(window, {
  ProfessionalDetailSections,
  ProEngagementBody,
  ProInterviewHistoryBody,
  ProRenewalsBody,
  ProExpensesBody,
  ProWorkerInvoicesBody,
  ProDocumentsBody,
});
