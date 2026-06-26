// =====================================================================
// Flex Work — Professional Requisition Details
//   Renders when the user opens a row in the Professional requisitions
//   table. Gated through `RequisitionDetailsPage`, which delegates here
//   for any req whose id starts with "PRO-".
//
//   Capability map (standard SOW / Statement of Work / permanent
//   recruiting flow):
//     · Hero: title · status · cost center · hiring manager · opened ·
//             days open · est. annual / term value
//     · Pipeline kanban (Sourced → Screened → Interview → Offer → Hired)
//       — every candidate is a draggable-style card; click opens a side
//       panel with the scorecard + interview history
//     · Interview schedule — upcoming + past panel sessions
//     · Contract terms — cadence, rate range, term, SOW template,
//       renewal policy, deliverables, timesheet mode
//     · SOW preview — rendered shell of the agreement
//     · Approval workflow — required approvers + status
//     · Logs — full req audit trail
//
//   No data is mutated — every action ends in a toast. The flag stays
//   OFF in production; this file is just here so the surface is ready
//   when it flips on.
// =====================================================================

const { useState: useStateProD, useMemo: useMemoProD } = React;

// ---------- Tiny helpers ---------------------------------------------
function _proSafeMoney(amt, ccy) {
  if (typeof window.profFmtMoney === "function") return window.profFmtMoney(amt, ccy);
  return `${ccy || "USD"} ${amt}`;
}

function _proCadenceLabel(c) {
  return typeof window.profCadenceLabel === "function" ? window.profCadenceLabel(c) : c;
}

// Annualize a cadence rate for the hero "Est. annual value" tile.
function _proAnnualize(cadence, amt) {
  if (typeof amt !== "number") return null;
  if (cadence === "weekly")  return amt * 52;
  if (cadence === "monthly") return amt * 12;
  if (cadence === "annual")  return amt;
  return null;
}

// 5-star score from a numeric value (0–5, half-stars allowed).
function ProScoreStars({ value, size = 14 }) {
  if (value == null) {
    return <span className="pro-score-empty">—</span>;
  }
  const stars = [];
  for (let i = 0; i < 5; i++) {
    const fill = Math.max(0, Math.min(1, value - i));
    const pct = Math.round(fill * 100);
    stars.push(
      <span key={i} className="pro-star" style={{ width: size, height: size }}>
        <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
          <defs>
            <linearGradient id={`pro-star-g-${i}-${pct}`} x1="0" x2="1" y1="0" y2="0">
              <stop offset={`${pct}%`} stopColor="var(--evr-content-decorative-orange)" />
              <stop offset={`${pct}%`} stopColor="var(--evr-neutral-90)" />
            </linearGradient>
          </defs>
          <path
            d="M12 2.5l2.92 6.06 6.7.96-4.86 4.66 1.16 6.62L12 17.85l-5.92 2.95L7.24 14.18 2.38 9.52l6.7-.96L12 2.5z"
            fill={`url(#pro-star-g-${i}-${pct})`}
            stroke="var(--evr-content-decorative-orange)"
            strokeWidth="0.6"
          />
        </svg>
      </span>
    );
  }
  return (
    <span className="pro-score" aria-label={`${value} out of 5`}>
      {stars}
      <span className="pro-score-num tabular">{value.toFixed(1)}</span>
    </span>
  );
}

// ---------- Pipeline kanban -------------------------------------------
const PIPELINE_STAGES = [
  { id: "Sourced",   label: "Sourced",   color: "blue"   },
  { id: "Screened",  label: "Screened",  color: "teal"   },
  { id: "Interview", label: "Interview", color: "purple" },
  { id: "Offer",     label: "Offer",     color: "orange" },
  { id: "Hired",     label: "Hired",     color: "green"  },
];

function ProPipelineCard({ candidate, onOpen }) {
  return (
    <button
      type="button"
      className="pro-pipe-card"
      onClick={() => onOpen(candidate)}
      aria-label={`Open ${candidate.name}`}
    >
      <div className="pro-pipe-card-head">
        <span className="pro-pipe-card-name">{candidate.name}</span>
        <ProScoreStars value={candidate.score} size={11} />
      </div>
      <div className="pro-pipe-card-meta">
        <span><Icon name="PersonLines" size={11} />{candidate.source}</span>
        <span><Icon name="TimeUndo" size={11} />{candidate.lastTouch}</span>
      </div>
      {candidate.interviews && candidate.interviews.length > 0 && (
        <div className="pro-pipe-card-footer">
          <Icon name="Calendar" size={11} />
          <span>{candidate.interviews.length} interview{candidate.interviews.length === 1 ? "" : "s"}</span>
        </div>
      )}
    </button>
  );
}

function ProPipelineKanban({ candidates, onOpenCandidate }) {
  const grouped = useMemoProD(() => {
    const m = {};
    for (const s of PIPELINE_STAGES) m[s.id] = [];
    for (const c of candidates || []) {
      const stage = m[c.stage] ? c.stage : "Sourced";
      m[stage].push(c);
    }
    return m;
  }, [candidates]);

  return (
    <div className="pro-pipe-kanban" role="region" aria-label="Candidate pipeline">
      {PIPELINE_STAGES.map((s) => (
        <div key={s.id} className={`pro-pipe-col pro-pipe-col--${s.color}`}>
          <header className="pro-pipe-col-head">
            <span className={`pro-pipe-dot pro-pipe-dot--${s.color}`} aria-hidden="true" />
            <span className="pro-pipe-col-label">{s.label}</span>
            <span className="pro-pipe-col-count tabular">{grouped[s.id].length}</span>
          </header>
          <div className="pro-pipe-col-body">
            {grouped[s.id].length === 0 ? (
              <div className="pro-pipe-empty" aria-hidden="true">—</div>
            ) : (
              grouped[s.id].map((c) => (
                <ProPipelineCard
                  key={c.id}
                  candidate={c}
                  onOpen={onOpenCandidate}
                />
              ))
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------- Candidate detail panel ------------------------------------
function ProCandidatePanel({ candidate, req, open, onClose }) {
  if (!open || !candidate) return null;

  const next = (candidate.interviews || []).find((iv) => iv.status === "Scheduled");
  const past = (candidate.interviews || []).filter((iv) => iv.status === "Done");

  return (
    <SidePanel
      open={open}
      onClose={onClose}
      ariaLabel={`Candidate ${candidate.name}`}
      title={candidate.name}
      subtitle={`${req.id} · ${candidate.stage}`}
      width={520}
    >
      <div className="pro-cand-panel">
        <section className="pro-cand-summary">
          <div className="pro-cand-score-wrap">
            <span className="pro-cand-eyebrow">Overall</span>
            <ProScoreStars value={candidate.score} size={18} />
          </div>
          <ul className="pro-cand-summary-meta">
            <li><span>Stage</span><b>{candidate.stage}</b></li>
            <li><span>Source</span><b>{candidate.source}</b></li>
            <li><span>Last activity</span><b>{candidate.lastTouch}</b></li>
          </ul>
        </section>

        {next && (
          <section className="pro-cand-next">
            <div className="pro-cand-next-head">
              <Icon name="Calendar" size={14} />
              <span>Next interview</span>
            </div>
            <div className="pro-cand-next-body">
              <div className="pro-cand-next-when tabular">{next.date}</div>
              <div className="pro-cand-next-type">{next.type}</div>
              <div className="pro-cand-next-panel">Panel: {next.panel}</div>
            </div>
            <div className="pro-cand-next-actions">
              <button
                type="button"
                className="btn btn--sm btn--secondary"
                onClick={() => showToast(`Reschedule sent for ${candidate.name}`)}
              >
                <Icon name="Refresh" size={14} />Reschedule
              </button>
              <button
                type="button"
                className="btn btn--sm btn--secondary"
                onClick={() => showToast(`Invite resent to ${candidate.name}`)}
              >
                <Icon name="Send" size={14} />Resend invite
              </button>
            </div>
          </section>
        )}

        <section className="pro-cand-history">
          <header className="pro-cand-history-head">
            <h4>Interview history</h4>
            <span className="pro-cand-history-count">{past.length} completed</span>
          </header>
          {past.length === 0 ? (
            <p className="pro-cand-history-empty">No interviews completed yet.</p>
          ) : (
            <ol className="pro-cand-history-list">
              {past.map((iv, i) => (
                <li key={i} className="pro-cand-history-item">
                  <div className="pro-cand-history-row">
                    <span className="pro-cand-history-when tabular">{iv.date}</span>
                    <span className="pro-cand-history-type">{iv.type}</span>
                    <ProScoreStars value={iv.score} size={12} />
                  </div>
                  <div className="pro-cand-history-panel">Panel: {iv.panel}</div>
                  <p className="pro-cand-history-notes">{iv.notes}</p>
                </li>
              ))}
            </ol>
          )}
        </section>

        <footer className="pro-cand-actions">
          <button
            type="button"
            className="btn btn--md btn--secondary"
            onClick={() => showToast(`Moved ${candidate.name} back a stage`)}
          >
            <Icon name="ChevronLeft" size={14} />Move back
          </button>
          {candidate.stage !== "Offer" && candidate.stage !== "Hired" && (
            <button
              type="button"
              className="btn btn--md btn--primary"
              onClick={() => showToast(`Advanced ${candidate.name}`, { kind: "success" })}
            >
              <Icon name="ChevronRight" size={14} />Advance
            </button>
          )}
          {candidate.stage === "Offer" && (
            <button
              type="button"
              className="btn btn--md btn--primary"
              onClick={() => showToast(`Offer sent to ${candidate.name}`, { kind: "success" })}
            >
              <Icon name="Send" size={14} />Send offer
            </button>
          )}
        </footer>
      </div>
    </SidePanel>
  );
}

// ---------- Interview schedule ----------------------------------------
function ProInterviewScheduleBody({ candidates }) {
  // Flatten every interview to one big chronological list, distinguishing
  // Scheduled vs Done. Real product would back this with a calendar
  // service; the layout below mirrors that shape.
  const interviews = useMemoProD(() => {
    const out = [];
    for (const c of candidates) {
      for (const iv of c.interviews || []) {
        out.push({ ...iv, candidate: c.name, candidateId: c.id });
      }
    }
    // Sort so Scheduled (upcoming) read first; Done after, most-recent first.
    return out.sort((a, b) => {
      if (a.status !== b.status) return a.status === "Scheduled" ? -1 : 1;
      return 0;
    });
  }, [candidates]);

  if (interviews.length === 0) {
    return (
      <div className="pro-interviews-empty">
        <Icon name="Calendar" size={28} />
        <p>No interviews scheduled yet. Move a candidate to <b>Interview</b> to start.</p>
      </div>
    );
  }
  return (
    <ul className="pro-interview-list">
      {interviews.map((iv, i) => (
        <li key={i} className={`pro-interview pro-interview--${iv.status === "Scheduled" ? "upcoming" : "done"}`}>
          <div className="pro-interview-when">
            <Icon name="Calendar" size={14} />
            <span className="tabular">{iv.date}</span>
          </div>
          <div className="pro-interview-main">
            <div className="pro-interview-title">
              <b>{iv.candidate}</b>
              <span className="pro-interview-type">{iv.type}</span>
            </div>
            <div className="pro-interview-panel">Panel: {iv.panel}</div>
            {iv.status === "Done" && iv.notes && iv.notes !== "—" && (
              <p className="pro-interview-notes">{iv.notes}</p>
            )}
          </div>
          <div className="pro-interview-aside">
            {iv.status === "Scheduled" ? (
              <span className="req-pill req-pill--informative">Scheduled</span>
            ) : (
              <ProScoreStars value={iv.score} size={12} />
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}

// ---------- Contract terms --------------------------------------------
function ProContractTermsBody({ req }) {
  const annual = _proAnnualize(req.cadence, (req.rateLow + req.rateHigh) / 2);
  const tsMode = req.timesheetMode === "required" ? "Required (effort tracking)" : "Not required (deliverable-based)";
  return (
    <div className="pro-contract">
      <dl className="pro-contract-grid">
        <div className="pro-contract-row">
          <dt>Engagement type</dt>
          <dd><span className="pw-chip pw-chip--perm">Permanent · no end date</span></dd>
        </div>
        <div className="pro-contract-row">
          <dt>Cadence</dt>
          <dd><span className="pw-chip pw-chip--cadence">{_proCadenceLabel(req.cadence)}</span></dd>
        </div>
        <div className="pro-contract-row">
          <dt>Rate range</dt>
          <dd className="tabular">
            {_proSafeMoney(req.rateLow, req.currency)} – {_proSafeMoney(req.rateHigh, req.currency)}
            <span className="pro-contract-aside"> per {req.cadence === "weekly" ? "week" : req.cadence === "monthly" ? "month" : "year"}</span>
          </dd>
        </div>
        <div className="pro-contract-row">
          <dt>Est. annual value</dt>
          <dd className="tabular">
            {annual ? _proSafeMoney(annual, req.currency) : "—"}
          </dd>
        </div>
        <div className="pro-contract-row">
          <dt>Number of positions</dt>
          <dd className="tabular">{req.qty}</dd>
        </div>
        <div className="pro-contract-row">
          <dt>Timesheet mode</dt>
          <dd>{tsMode}</dd>
        </div>
        <div className="pro-contract-row">
          <dt>SOW template</dt>
          <dd>{req.sow}</dd>
        </div>
        <div className="pro-contract-row">
          <dt>Renewal policy</dt>
          <dd>Auto-renew for 12 months unless either party gives 30 days' written notice</dd>
        </div>
      </dl>

      <div className="pro-contract-deliverables">
        <h5 className="pro-contract-h">Deliverables &amp; success criteria</h5>
        <ul>
          <li>Quarterly OKR delivery aligned with hiring manager.</li>
          <li>Weekly status update — written form, by EOD Friday local time.</li>
          <li>Monthly 1:1 with hiring manager covering retention and contribution.</li>
          <li>Annual performance review tied to renewal decision.</li>
        </ul>
      </div>

      <div className="pro-contract-actions">
        <button
          type="button"
          className="btn btn--sm btn--secondary"
          onClick={() => showToast("Contract terms edited")}
        >
          <Icon name="Edit" size={14} />Edit terms
        </button>
        <button
          type="button"
          className="btn btn--sm btn--secondary"
          onClick={() => showToast(`SOW exported for ${req.id}`, { kind: "success" })}
        >
          <Icon name="Export" size={14} />Export SOW (.pdf)
        </button>
      </div>
    </div>
  );
}

// ---------- SOW preview -----------------------------------------------
function ProSowPreviewBody({ req }) {
  const today = "May 19, 2026";
  const tsMode = req.timesheetMode === "required" ? "Time will be captured weekly via Flex Work." : "No time capture. Deliverable acceptance drives billing.";
  return (
    <div className="pro-sow-preview" aria-label="Statement of work preview">
      <header className="pro-sow-head">
        <div>
          <div className="pro-sow-doc">STATEMENT OF WORK</div>
          <div className="pro-sow-doc-id tabular">SOW reference · {req.id}</div>
        </div>
        <div className="pro-sow-meta">
          <div><span>Prepared</span><b className="tabular">{today}</b></div>
          <div><span>Status</span><b>{req.status === "Offer extended" ? "Draft · pending counter-sign" : "Draft"}</b></div>
        </div>
      </header>

      <section className="pro-sow-section">
        <h6>Parties</h6>
        <p>
          This Statement of Work is entered into between <b>Dayforce, Inc.</b> ("Buyer")
          and the supplier or individual identified upon execution ("Supplier"), under
          the Master Services Agreement on file with Dayforce Vendor Operations.
        </p>
      </section>

      <section className="pro-sow-section">
        <h6>Engagement</h6>
        <dl className="pro-sow-kv">
          <div><dt>Role</dt><dd>{req.jobs.join(" · ")}</dd></div>
          <div><dt>Site</dt><dd>{req.location}</dd></div>
          <div><dt>Hiring manager</dt><dd>{req.hiringManager}</dd></div>
          <div><dt>Number of positions</dt><dd className="tabular">{req.qty}</dd></div>
          <div><dt>Engagement type</dt><dd>Permanent · no end date</dd></div>
        </dl>
      </section>

      <section className="pro-sow-section">
        <h6>Fee schedule</h6>
        <dl className="pro-sow-kv">
          <div>
            <dt>Cadence</dt>
            <dd>{_proCadenceLabel(req.cadence)}</dd>
          </div>
          <div>
            <dt>Rate range</dt>
            <dd className="tabular">
              {_proSafeMoney(req.rateLow, req.currency)} – {_proSafeMoney(req.rateHigh, req.currency)}
              <span> per {req.cadence === "weekly" ? "week" : req.cadence === "monthly" ? "month" : "year"}</span>
            </dd>
          </div>
          <div>
            <dt>Currency</dt>
            <dd>{req.currency}</dd>
          </div>
          <div>
            <dt>Payment terms</dt>
            <dd>Net 30 from invoice date</dd>
          </div>
        </dl>
      </section>

      <section className="pro-sow-section">
        <h6>Time &amp; deliverables</h6>
        <p>{tsMode}</p>
        <p>
          Buyer and Supplier agree the deliverables and success criteria listed
          on the requisition record govern this engagement, and that quarterly
          OKR alignment and annual performance review will inform renewal.
        </p>
      </section>

      <section className="pro-sow-section">
        <h6>Term &amp; renewal</h6>
        <p>
          Effective on counter-signature. Automatically renews for successive
          12-month terms unless either party provides 30 days' written notice
          prior to the renewal date.
        </p>
      </section>
    </div>
  );
}

// ---------- Approval workflow -----------------------------------------
const PRO_APPROVERS = (req) => ([
  { role: "Hiring manager",       name: req.hiringManager,         status: "approved",  when: "Apr 22"  },
  { role: "Department head",      name: "Sasha Lindgren",          status: "approved",  when: "Apr 24"  },
  { role: "Finance partner",      name: "Devon Sato",              status: req.status === "Open" ? "pending" : "approved", when: req.status === "Open" ? "Awaiting" : "Apr 26" },
  { role: "Legal · MSA review",   name: "Iris Cho",                status: req.status === "Offer extended" ? "approved" : (req.status === "Open" ? "queued" : "pending"), when: req.status === "Offer extended" ? "May 02" : (req.status === "Open" ? "Queued" : "Awaiting") },
  { role: "Recruiting · sign-off", name: "Maya Chen",              status: req.status === "Offer extended" ? "approved" : "queued", when: req.status === "Offer extended" ? "May 05" : "Queued" },
]);

function ProApprovalBody({ req }) {
  const rows = PRO_APPROVERS(req);
  return (
    <ol className="pro-appr-list">
      {rows.map((r, i) => {
        const tone = r.status === "approved" ? "success" : r.status === "pending" ? "warning" : "default";
        const iconName = r.status === "approved" ? "Check" : r.status === "pending" ? "TimeAdd" : "MoreVert";
        return (
          <li key={i} className={`pro-appr-row pro-appr-row--${tone}`}>
            <span className={`pro-appr-icon pro-appr-icon--${tone}`}>
              <Icon name={iconName} size={14} />
            </span>
            <div className="pro-appr-main">
              <div className="pro-appr-role">{r.role}</div>
              <div className="pro-appr-name">{r.name}</div>
            </div>
            <div className="pro-appr-when">
              <span className={`req-pill req-pill--${tone === "default" ? "informative" : tone}`}>
                {r.status[0].toUpperCase() + r.status.slice(1)}
              </span>
              <span className="pro-appr-time tabular">{r.when}</span>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

// ---------- Logs ------------------------------------------------------
function ProReqLogsBody({ req }) {
  const items = [
    { tone: "info",    icon: "Briefcase",       actor: req.hiringManager, action: "created Professional requisition for", target: req.jobs[0], time: `${req.daysOpen + 1} days ago` },
    { tone: "info",    icon: "DocumentAdd",     actor: "Vendor Ops",      action: "attached SOW template", target: req.sow, time: `${req.daysOpen} days ago` },
    { tone: "info",    icon: "PersonLines",     actor: "Sourcing",        action: `sourced ${req.pipeline.sourced} candidates`, time: `${Math.max(1, req.daysOpen - 2)} days ago` },
    { tone: "info",    icon: "PersonClock",     actor: "Recruiter",       action: `screened ${req.pipeline.screened} candidates through`, target: "phone screen", time: `${Math.max(1, req.daysOpen - 7)} days ago` },
  ];
  if (req.pipeline.interview > 0) {
    items.push({ tone: "info", icon: "Calendar", actor: "Coordinator", action: `scheduled ${req.pipeline.interview} panel interview${req.pipeline.interview === 1 ? "" : "s"}`, time: "This week" });
  }
  if (req.status === "Offer extended") {
    items.push({ tone: "success", icon: "Send", actor: req.hiringManager, action: "extended offer to", target: "Anita Roy", time: "Yesterday" });
  }
  return (
    <ol className="det-log-list">
      {items.map((it, i) => (
        <li key={i} className={`det-log det-log--${it.tone}`}>
          <span className={`det-log-icon det-log-icon--${it.tone}`}>
            <Icon name={it.icon} size={14} />
          </span>
          <div className="det-log-body">
            <div className="det-log-line">
              <b>{it.actor}</b>
              <span> {it.action} </span>
              {it.target && <b>{it.target}</b>}
              {it.note && <span className="det-log-note">{it.note}</span>}
            </div>
            <div className="det-log-time">{it.time}</div>
          </div>
        </li>
      ))}
    </ol>
  );
}

// ---------- Status pill -----------------------------------------------
const PRO_STATUS_HUES = {
  "Open":            "informative",
  "Interviewing":    "informative",
  "Offer extended":  "warning",
  "Filled":          "success",
};

// ---------- Page -----------------------------------------------------
function ProfessionalRequisitionDetailsPage({ requisitionId, onBack }) {
  const req = (window.getProfessionalRequisitionById
    ? window.getProfessionalRequisitionById(requisitionId)
    : null) || (window.PROFESSIONAL_REQUISITIONS_RAW && window.PROFESSIONAL_REQUISITIONS_RAW[0]);

  if (!req) {
    return (
      <div className="content-section" style={{ padding: 32 }}>
        <p>Professional requisitions are gated behind a feature flag that is currently off.</p>
        <button type="button" className="btn btn--sm btn--secondary" onClick={onBack}>
          <Icon name="ChevronLeft" size={14} />Back to Requisitions
        </button>
      </div>
    );
  }

  const candidates = (window.getProfessionalCandidates ? window.getProfessionalCandidates(req.id) : []);
  const statusHue = PRO_STATUS_HUES[req.status] || "default";
  const [activeCandidate, setActiveCandidate] = useStateProD(null);

  const annual = _proAnnualize(req.cadence, (req.rateLow + req.rateHigh) / 2);

  return (
    <React.Fragment>
      <ReqOmnibar
        title={`Professional req · ${req.id}`}
        subtitle="Requisitions"
        status={<span className={`req-pill req-pill--${statusHue}`}>{req.status}</span>}
        onBack={onBack}
        actions={(
          <React.Fragment>
            <button type="button" className="iconbtn" aria-label="Reload" onClick={() => showToast("Requisition refreshed")}>
              <Icon name="Refresh" size={20} />
            </button>
            <button
              type="button"
              className="btn btn--md btn--secondary"
              onClick={() => showToast(`Requisition ${req.id} updated`, { kind: "success" })}
            >
              <Icon name="Edit" size={16} />Edit
            </button>
            <button
              type="button"
              className="iconbtn"
              aria-label="More"
              onClick={(e) => openMenu(e.currentTarget, [
                { icon: "PersonPlus", label: "Add candidate",      onClick: () => showToast("Adding candidate") },
                { icon: "Send",       label: "Resend distribution", onClick: () => showToast("Distribution resent") },
                { icon: "Copy",       label: "Duplicate requisition", onClick: () => showToast("Duplicating requisition") },
                { icon: "Export",     label: "Export SOW (.pdf)",   onClick: () => showToast(`SOW exported for ${req.id}`, { kind: "success" }) },
                { divider: true },
                { icon: "Cancel",     label: "Close requisition",   danger: true,
                  onClick: () => openConfirm({
                    title: `Close requisition ${req.id}?`,
                    body: `${req.qty} position${req.qty === 1 ? "" : "s"} will be removed from sourcing. Any candidates in progress will be notified.`,
                    primaryLabel: "Close",
                    onConfirm: () => { showToast(`${req.id} closed`, { kind: "success" }); onBack && onBack(); },
                  }) },
              ])}
            >
              <Icon name="MoreVert" size={20} />
            </button>
          </React.Fragment>
        )}
      />

      <div className="req-wf pro-req-details" style={{ maxWidth: 1200 }} data-screen-label="Pro requisition details">
        {/* ---------- Hero ---------- */}
        <div className="det-hero pro-hero">
          <div className="det-hero-info">
            <h1 className="det-hero-title">{req.jobs[0]}</h1>
            <a
              href="#"
              className="det-hero-loc"
              onClick={(e) => { e.preventDefault(); showToast(`Opening ${req.location}`); }}
            >
              <span className={`fi fi-${req.flag}`} aria-hidden="true" style={{ width: 18, height: 14, borderRadius: 2, marginRight: 6 }}></span>
              <span className="det-hero-loc-text">{req.location}</span>
            </a>
            <div className="pro-hero-chips">
              <span className="pw-chip pw-chip--perm">Permanent · no end date</span>
              <span className="pw-chip pw-chip--cadence">{_proCadenceLabel(req.cadence)} cadence</span>
              <span className="pw-chip pw-chip--rate">
                {_proSafeMoney(req.rateLow, req.currency)} – {_proSafeMoney(req.rateHigh, req.currency)} / {req.cadence === "weekly" ? "wk" : req.cadence === "monthly" ? "mo" : "yr"}
              </span>
              <span className="pw-chip pw-chip--sow">{req.sow}</span>
            </div>
            <dl className="det-meta-list">
              <div className="det-meta-row">
                <dt>Hiring manager:</dt>
                <dd><a href="#" onClick={(e) => { e.preventDefault(); showToast(`Opening profile for ${req.hiringManager}`); }}>{req.hiringManager}</a></dd>
              </div>
              <div className="det-meta-row">
                <dt title="Dayforce calls this Labor metric — formerly &lsquo;Department&rsquo; in Flex Work">Department:</dt>
                <dd>—</dd>
              </div>
              <div className="det-meta-row">
                <dt>Opened:</dt>
                <dd className="tabular">{req.opened} · {req.daysOpen} day{req.daysOpen === 1 ? "" : "s"} open</dd>
              </div>
              <div className="det-meta-row">
                <dt>Est. annual value:</dt>
                <dd className="tabular">{annual ? _proSafeMoney(annual, req.currency) : "—"} <span className="pro-contract-aside">at midpoint</span></dd>
              </div>
            </dl>
          </div>

          <div className="pro-hero-stats">
            <div className="pro-hero-stat">
              <span className="pro-hero-stat-label">Sourced</span>
              <span className="pro-hero-stat-val tabular">{req.pipeline.sourced}</span>
            </div>
            <div className="pro-hero-stat">
              <span className="pro-hero-stat-label">Interview</span>
              <span className="pro-hero-stat-val tabular">{req.pipeline.interview}</span>
            </div>
            <div className="pro-hero-stat">
              <span className="pro-hero-stat-label">Offer</span>
              <span className="pro-hero-stat-val tabular">{req.pipeline.offer}</span>
            </div>
            <div className="pro-hero-stat">
              <span className="pro-hero-stat-label">Days open</span>
              <span className="pro-hero-stat-val tabular">{req.daysOpen}</span>
            </div>
          </div>
        </div>

        {/* ---------- Pipeline ---------- */}
        <AccordionCard icon="PersonLines" title="Candidate pipeline" defaultOpen>
          <ProPipelineKanban candidates={candidates} onOpenCandidate={(c) => setActiveCandidate(c)} />
        </AccordionCard>

        {/* ---------- Interview schedule ---------- */}
        <AccordionCard icon="Calendar" title="Interview schedule" defaultOpen>
          <ProInterviewScheduleBody candidates={candidates} />
        </AccordionCard>

        {/* ---------- Contract terms ---------- */}
        <AccordionCard icon="Notes" title="Contract terms" defaultOpen>
          <ProContractTermsBody req={req} />
        </AccordionCard>

        {/* ---------- SOW preview ---------- */}
        <AccordionCard icon="File" title="SOW preview">
          <ProSowPreviewBody req={req} />
        </AccordionCard>

        {/* ---------- Approval workflow ---------- */}
        <AccordionCard icon="ShieldPerson" title="Approval workflow">
          <ProApprovalBody req={req} />
        </AccordionCard>

        {/* ---------- Logs ---------- */}
        <AccordionCard icon="TimeUndo" title="Logs">
          <ProReqLogsBody req={req} />
        </AccordionCard>

        {/* ---------- Shared audit accordion · Decision 05 ----------
            Opt-in adoption — every other variant body (Contractor,
            SOW, EOR) already renders this. The router's flag-gated
            injection covered Pro at flags-on; the body now opts in
            directly so the cross-variant timeline shows regardless
            of mount path. */}
        {window.AuditAccordion ? (
          <window.AuditAccordion scope="professional" target={req.id} />
        ) : null}
      </div>

      <ProCandidatePanel
        candidate={activeCandidate}
        req={req}
        open={!!activeCandidate}
        onClose={() => setActiveCandidate(null)}
      />
    </React.Fragment>
  );
}

// ---------- isProReqId guard the legacy details page uses ------------
function isProRequisitionId(id) {
  return typeof id === "string" && id.startsWith("PRO-");
}

// =====================================================================
// New Professional requisition form
//   Mounted inside the existing NewRequisitionPage when the engagement
//   type is "professional". Replaces the entire Setup → Bookings →
//   Schedules → Distribution stack with a single focused form because
//   permanent SOW engagements have no shifts, no schedule, and no per
//   shift booking. Driven by props so NewRequisitionPage can keep the
//   form state at the page level (template-load support, draft restore).
// =====================================================================
const PRO_CADENCE_OPTS = [
  { id: "weekly",  label: "Weekly",  per: "week"  },
  { id: "monthly", label: "Monthly", per: "month" },
  { id: "annual",  label: "Annual",  per: "year"  },
];
const PRO_SOW_TEMPLATES = [
  "MSA + SOW template · Permanent",
  "MSA + SOW template · 12-month renewable",
  "MSA + SOW template · Fixed-fee project",
  "MSA + SOW template · T&M capped",
];
const PRO_CURRENCIES = ["USD", "EUR", "GBP", "CAD", "AUD", "BRL", "MXN", "INR", "SGD", "JPY"];
const PRO_TIMESHEET_OPTS = [
  { id: "none",     label: "Not required",         help: "Pure deliverable-based engagement. Invoices follow the cadence." },
  { id: "required", label: "Required (effort log)", help: "Worker logs weekly hours. No impact on billing — for reporting only." },
];

function _proField(label, hint, children, span = 1) {
  return (
    <label className="pro-field" style={span === 2 ? { gridColumn: "span 2" } : undefined}>
      <span className="pro-field-label">{label}</span>
      {hint && <span className="pro-field-hint">{hint}</span>}
      {children}
    </label>
  );
}

function _proInput({ value, onChange, placeholder, type = "text" }) {
  return (
    <input
      type={type}
      className="pro-input"
      value={value == null ? "" : value}
      onChange={(e) => onChange(type === "number" ? (e.target.value === "" ? "" : Number(e.target.value)) : e.target.value)}
      placeholder={placeholder}
    />
  );
}

function _proSelect({ value, onChange, options }) {
  return (
    <select className="pro-select" value={value} onChange={(e) => onChange(e.target.value)}>
      {options.map((o) => (typeof o === "string"
        ? <option key={o} value={o}>{o}</option>
        : <option key={o.id} value={o.id}>{o.label}</option>))}
    </select>
  );
}

function NewProRequisitionBody({ form, setPro, onBack, onPost }) {
  const cadence = PRO_CADENCE_OPTS.find((c) => c.id === form.cadence) || PRO_CADENCE_OPTS[1];
  const annual = (() => {
    if (typeof form.rateLow !== "number" || typeof form.rateHigh !== "number") return null;
    const mid = (form.rateLow + form.rateHigh) / 2;
    if (form.cadence === "weekly")  return mid * 52;
    if (form.cadence === "monthly") return mid * 12;
    return mid;
  })();

  return (
    <React.Fragment>
      <section className="req-card pro-new-card">
        <header className="req-card-head">
          <h2 className="req-card-title">
            <Icon name="Briefcase" size={20} />
            Professional engagement
          </h2>
          <p className="req-card-sub">
            Permanent SOW engagement. No shifts, no hourly rate. Billing follows the cadence below; timesheets are optional per Statement of Work.
          </p>
        </header>

        <div className="pro-form-grid">
          {_proField("Role title",        "Surfaces as the requisition title and in the SOW.",
            _proInput({ value: form.title, onChange: (v) => setPro("title", v), placeholder: "Senior Product Manager · Workforce" }), 2)}

          {_proField("Number of positions",  "Most professional reqs are filled 1:1.",
            _proInput({ value: form.qty, onChange: (v) => setPro("qty", v), type: "number", placeholder: "1" }))}

          {_proField("Hiring manager", "Drives approval routing and renewal authority.",
            _proInput({ value: form.hiringManager, onChange: (v) => setPro("hiringManager", v), placeholder: "Amy Hennen" }))}

          {_proField("Primary work location", "Real estate, not a shift site. Used for tax + comp benchmarking.",
            _proInput({ value: form.location, onChange: (v) => setPro("location", v), placeholder: "Minneapolis, MN" }), 2)}

          {_proField("Cadence", "Billing frequency. Permanent engagements bill on cadence, not hours.",
            <div className="pro-radio-group" role="radiogroup">
              {PRO_CADENCE_OPTS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  role="radio"
                  aria-checked={form.cadence === opt.id}
                  className={"pro-radio" + (form.cadence === opt.id ? " is-on" : "")}
                  onClick={() => setPro("cadence", opt.id)}
                >
                  <span className="pro-radio-label">{opt.label}</span>
                  <span className="pro-radio-sub">per {opt.per}</span>
                </button>
              ))}
            </div>, 2)}

          {_proField("Rate range — low",  `${form.currency} per ${cadence.per}`,
            _proInput({ value: form.rateLow, onChange: (v) => setPro("rateLow", v), type: "number", placeholder: "16500" }))}

          {_proField("Rate range — high", `${form.currency} per ${cadence.per}`,
            _proInput({ value: form.rateHigh, onChange: (v) => setPro("rateHigh", v), type: "number", placeholder: "19500" }))}

          {_proField("Currency", "Engagement is billed and reported in this currency.",
            _proSelect({ value: form.currency, onChange: (v) => setPro("currency", v), options: PRO_CURRENCIES }))}

          {_proField("Est. annual value", "Auto-derived from cadence × midpoint of the range.",
            <input className="pro-input pro-input--readonly tabular" value={annual ? `${form.currency} ${annual.toLocaleString("en-US")}` : "—"} readOnly />)}

          {_proField("Timesheet mode",  "Whether the worker is asked to log hours under this engagement.",
            <div className="pro-radio-group pro-radio-group--stacked" role="radiogroup">
              {PRO_TIMESHEET_OPTS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  role="radio"
                  aria-checked={form.timesheetMode === opt.id}
                  className={"pro-radio pro-radio--wide" + (form.timesheetMode === opt.id ? " is-on" : "")}
                  onClick={() => setPro("timesheetMode", opt.id)}
                >
                  <span className="pro-radio-label">{opt.label}</span>
                  <span className="pro-radio-sub">{opt.help}</span>
                </button>
              ))}
            </div>, 2)}

          {_proField("SOW template", "Drives the agreement boilerplate sent to the supplier.",
            _proSelect({ value: form.sowTemplate, onChange: (v) => setPro("sowTemplate", v), options: PRO_SOW_TEMPLATES }), 2)}

          {_proField("Deliverables & success criteria", "Becomes the body of the SOW. One per line.",
            <textarea
              className="pro-textarea"
              rows={6}
              value={form.deliverables}
              onChange={(e) => setPro("deliverables", e.target.value)}
              placeholder="e.g. Quarterly OKR alignment with hiring manager.\nWeekly written status update.\nMonthly 1:1.\nAnnual performance review."
            />, 2)}

          {_proField("Renewal policy", "Auto-renew is the default for permanent engagements.",
            <label className="pro-toggle">
              <input
                type="checkbox"
                checked={!!form.autoRenew}
                onChange={(e) => setPro("autoRenew", e.target.checked)}
              />
              <span className="pro-toggle-thumb" />
              <span className="pro-toggle-text">
                Auto-renew for 12 months unless either party gives 30 days' notice
              </span>
            </label>, 2)}
        </div>
      </section>

      <section className="req-card pro-new-card">
        <header className="req-card-head">
          <h2 className="req-card-title">
            <Icon name="ShieldPerson" size={20} />
            Approval workflow
          </h2>
          <p className="req-card-sub">
            Routes through Hiring manager → Department head → Finance → Legal (MSA review) → Recruiting sign-off. You can override this per requisition once the draft is saved.
          </p>
        </header>
        <ol className="pro-appr-preview">
          {[
            "Hiring manager",
            "Department head",
            "Finance partner",
            "Legal · MSA review",
            "Recruiting · sign-off",
          ].map((label, i) => (
            <li key={i} className="pro-appr-preview-step">
              <span className="pro-appr-preview-num tabular">{i + 1}</span>
              <span className="pro-appr-preview-label">{label}</span>
            </li>
          ))}
        </ol>
      </section>

      <footer className="req-footer">
        <span className="req-footer-saved">
          <Icon name="Save" size={20} />
          Draft saved 5 seconds ago
        </span>
        <span className="req-footer-actions">
          <button type="button" className="btn btn--lg btn--secondary" onClick={onBack}>Discard</button>
          <button
            type="button"
            className="btn btn--lg btn--primary"
            onClick={onPost}
          >
            Post requisition
          </button>
        </span>
      </footer>
    </React.Fragment>
  );
}

Object.assign(window, {
  ProfessionalRequisitionDetailsPage,
  isProRequisitionId,
  ProScoreStars,
  ProPipelineKanban,
  ProInterviewScheduleBody,
  ProContractTermsBody,
  ProSowPreviewBody,
  ProApprovalBody,
  NewProRequisitionBody,
});
