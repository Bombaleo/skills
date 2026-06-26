// =====================================================================
// Flex Work — Interview workflow · Agency (supplier) surfaces (S1–per-buyer SLA)
// ---------------------------------------------------------------------
// Renders inside InterviewWorkflowPage when the Agency role tab is
// active. Mirrors `Flex Work Interview Workflow Tasks.html` §07.
// =====================================================================

// ---------- S2/S3/S4 — invite inbox + actions --------------------------
function IVInviteInbox() {
  const [submittals, setSubmittals] = React.useState(window.ivGetSubmittals());
  const [openId, setOpenId] = React.useState(null);
  const [proposeIv, setProposeIv] = React.useState(null);
  const [propTime, setPropTime] = React.useState("");
  const [propReason, setPropReason] = React.useState("");
  React.useEffect(() => window.ivSubscribe((d) => { if (d.key === "submittals" || d.key === "*") setSubmittals(window.ivGetSubmittals()); }), []);

  // Flatten invites: every interview row whose status needs supplier action.
  const invites = [];
  for (const s of submittals) {
    for (const iv of s.interviews) {
      if (iv.status === "Scheduled" || iv.status === "Awaiting confirmation") {
        invites.push({ submittal: s, iv });
      }
    }
  }

  const setStatus = (subId, ivId, status) => {
    const list = window.ivGetSubmittals();
    window.ivSetSubmittals(list.map((s) => s.id !== subId ? s : {
      ...s,
      interviews: s.interviews.map((iv) => iv.id !== ivId ? iv : { ...iv, status }),
    }));
  };

  return (
    <IvCard
      title="Interview invites · supplier inbox"
      sub="Every interview the buyer schedules surfaces here. Accept, decline, or propose alternate. Forward the consolidated details to the candidate in one tap."
    >
      {invites.length === 0 ? (
        <div className="iv-empty">
          <h4 className="iv-empty-title">All caught up</h4>
          <p className="iv-empty-body">No outstanding invites across your submittals.</p>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {invites.map(({ submittal, iv }) => (
            <article key={iv.id} className="iv-row" data-status={iv.status}>
              <div className="iv-row-when">
                {iv.slot}
                <small>{iv.duration} min · Round {iv.round}</small>
              </div>
              <div className="iv-row-main">
                <div className="iv-row-title">{submittal.candidate.name} · {submittal.reqTitle}</div>
                <div className="iv-row-panel">{(window.ivTypeById(iv.typeId) || {}).label} · {iv.method} · {iv.location} · Panel: {iv.panel.join(", ")}</div>
                <div className="iv-row-meta">
                  <IvPill tone="default">{submittal.buyer}</IvPill>
                  <IvStatusPill status={iv.status} />
                </div>
              </div>
              <div className="iv-row-actions" style={{ flexDirection: "column", alignItems: "flex-end" }}>
                <div style={{ display: "flex", gap: 6 }}>
                  <button type="button" className="iv-btn iv-btn--primary" onClick={() => setStatus(submittal.id, iv.id, "Done")}>Accept</button>
                  <button type="button" className="iv-btn" onClick={() => { setProposeIv({ submittal, iv }); setPropTime(""); setPropReason(""); }}>Propose alternate</button>
                  <button type="button" className="iv-btn iv-btn--danger" onClick={() => setStatus(submittal.id, iv.id, "Cancelled")}>Decline</button>
                </div>
                <button type="button" className="iv-btn iv-btn--quiet" style={{ marginTop: 4 }} onClick={() => setOpenId(iv.id)}>Forward to candidate</button>
              </div>
            </article>
          ))}
        </div>
      )}

      {/* S4 — forward to candidate */}
      {openId && (() => {
        const found = invites.find((x) => x.iv.id === openId);
        if (!found) return null;
        const { submittal, iv } = found;
        return (
          <React.Fragment>
            <div className="iv-panel-backdrop" onClick={() => setOpenId(null)} />
            <aside className="iv-panel" role="dialog" aria-label="Forward to candidate">
              <div className="iv-panel-head">
                <div>
                  <h3>Forward to {submittal.candidate.name}</h3>
                  <div className="iv-panel-sub">Uses template &ldquo;Interview invite — candidate&rdquo;</div>
                </div>
                <button type="button" className="iv-btn iv-btn--quiet" onClick={() => setOpenId(null)}>Close</button>
              </div>
              <div className="iv-panel-body">
                <div className="iv-field">
                  <span className="iv-field-label">Subject (pre-filled)</span>
                  <input className="iv-input" defaultValue={`Interview scheduled · ${submittal.reqTitle}`} />
                </div>
                <div className="iv-field">
                  <span className="iv-field-label">Message</span>
                  <textarea className="iv-textarea" style={{ minHeight: 160 }} defaultValue={`Hi ${submittal.candidate.name.split(" ")[0]}, your ${(window.ivTypeById(iv.typeId) || {}).label} interview for ${submittal.reqTitle} at ${submittal.buyer} is scheduled for ${iv.slot}. Panel: ${iv.panel.join(", ")}. ${iv.method === "Video" ? "Zoom link to follow." : iv.location}. Reply to confirm or reschedule.`} />
                </div>
                <div className="iv-toggle-row" style={{ gridTemplateColumns: "1fr auto" }}>
                  <div>
                    <div className="iv-toggle-row-title">Track delivery</div>
                    <div className="iv-toggle-row-hint">Flag if candidate has not opened within 24 hours</div>
                  </div>
                  <span className="iv-switch is-on" role="switch" aria-checked="true" tabIndex={0}><span className="iv-switch-thumb" /></span>
                </div>
              </div>
              <div className="iv-panel-foot">
                <button type="button" className="iv-btn" onClick={() => setOpenId(null)}>Cancel</button>
                <button type="button" className="iv-btn iv-btn--primary" onClick={() => setOpenId(null)}>Send</button>
              </div>
            </aside>
          </React.Fragment>
        );
      })()}

      {/* Propose alternate */}
      {proposeIv && (
        <React.Fragment>
          <div className="iv-panel-backdrop" onClick={() => setProposeIv(null)} />
          <aside className="iv-panel" role="dialog" aria-label="Propose alternate">
            <div className="iv-panel-head">
              <div>
                <h3>Propose alternate slot</h3>
                <div className="iv-panel-sub">{proposeIv.submittal.candidate.name} · {(window.ivTypeById(proposeIv.iv.typeId) || {}).label}</div>
              </div>
              <button type="button" className="iv-btn iv-btn--quiet" onClick={() => setProposeIv(null)}>Close</button>
            </div>
            <div className="iv-panel-body">
              <div className="iv-field">
                <span className="iv-field-label">Original</span>
                <div style={{ padding: 10, borderRadius: 8, background: "var(--evr-surface-secondary-default)", fontSize: 13 }}>{proposeIv.iv.slot} · {proposeIv.iv.method}</div>
              </div>
              <div className="iv-field">
                <span className="iv-field-label">Suggested slot</span>
                <input className="iv-input" value={propTime} onChange={(e) => setPropTime(e.target.value)} placeholder="e.g. May 31 · 13:30" />
              </div>
              <div className="iv-field">
                <span className="iv-field-label">Reason</span>
                <textarea className="iv-textarea" value={propReason} onChange={(e) => setPropReason(e.target.value)} placeholder="Candidate has a conflict at the proposed time…" />
              </div>
            </div>
            <div className="iv-panel-foot">
              <button type="button" className="iv-btn" onClick={() => setProposeIv(null)}>Cancel</button>
              <button type="button" className="iv-btn iv-btn--primary" disabled={!propTime} onClick={() => { setStatus(proposeIv.submittal.id, proposeIv.iv.id, "Awaiting confirmation"); setProposeIv(null); }}>Send to buyer</button>
            </div>
          </aside>
        </React.Fragment>
      )}
    </IvCard>
  );
}

// ---------- S1 — surface required pill ---------------------------------
function IVSupplierReqCards() {
  // Synthetic list of buyer reqs the supplier is distributed against,
  // each with an interview-required flag derived from A6 policies.
  const reqs = [
    { id: "PRO-K1L2M3", title: "Senior Product Manager · Workforce", buyer: "Fleetwind Logistics", required: true,  reason: "Tenant default + Director+ policy" },
    { id: "PRO-T1U2V3", title: "Sales Director · EMEA",              buyer: "Helios Power",        required: true,  reason: "Director+ policy" },
    { id: "REQ-A1B2C3", title: "Forklift operator · 2nd shift",      buyer: "Fleetwind Logistics", required: false, reason: "Agency engagements skip by default" },
    { id: "REQ-D4E5F6", title: "Welder · pipeline maintenance",      buyer: "Helios Power",        required: false, reason: "Skip-interview approved · re-hire" },
  ];

  return (
    <IvCard
      title="Interview-required on every requisition"
      sub="Today the toggle lives only on the buyer side. Surface it clearly on the supplier req card and the submittal form, with the policy that pre-set it as a tooltip."
    >
      <div style={{ display: "grid", gap: 10 }}>
        {reqs.map((r) => (
          <div key={r.id} className="iv-toggle-row" style={{ gridTemplateColumns: "1fr auto auto" }}>
            <div>
              <div className="iv-toggle-row-title">{r.title}</div>
              <div className="iv-toggle-row-hint">{r.buyer} · <code style={{ font: "12px ui-monospace,Menlo,monospace" }}>{r.id}</code></div>
            </div>
            <IvPill tone={r.required ? "purple" : "default"} title={r.reason}>
              {r.required ? "Interview required" : "No interview"}
            </IvPill>
            <button type="button" className="iv-btn">Submit candidate</button>
          </div>
        ))}
      </div>
    </IvCard>
  );
}

// ---------- S5 — cross-buyer pipeline view ----------------------------
function IVSupplierPipeline() {
  const submittals = window.ivGetSubmittals();
  return (
    <IvCard
      title="Cross-buyer interview pipeline"
      sub="Every submittal in Interview stage across every buyer the supplier serves. Sort by buyer / requisition / age. The screen the supplier opens first thing every morning."
    >
      <table className="iv-table">
        <thead>
          <tr>
            <th>Candidate</th>
            <th>Buyer</th>
            <th>Requisition</th>
            <th>Round</th>
            <th>Status</th>
            <th>Last interview</th>
            <th>Score</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {submittals.map((s) => {
            const last = s.interviews[s.interviews.length - 1];
            return (
              <tr key={s.id}>
                <td>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <IvAvatar name={s.candidate.name} color={s.candidate.avatarColor} />
                    <div className="iv-table-name">{s.candidate.name}</div>
                  </div>
                </td>
                <td>{s.buyer}</td>
                <td className="iv-table-meta">{s.reqTitle}</td>
                <td><IvPill tone="info">R{s.round} of {s.rounds}</IvPill></td>
                <td><IvStatusPill status={last.status} /></td>
                <td className="iv-table-meta">{last.slot}</td>
                <td>{window.ivRollUpScore(s) ?? "—"}</td>
                <td><button type="button" className="iv-btn iv-btn--quiet">Open</button></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </IvCard>
  );
}

// ---------- S6 + S7 — reschedule request + withdraw -------------------
function IVRescheduleAndWithdraw() {
  const submittals = window.ivGetSubmittals();
  const [mode, setMode] = React.useState(null);

  const candidates = submittals.flatMap((s) => s.interviews.filter((iv) => iv.status === "Scheduled").map((iv) => ({ s, iv })));

  return (
    <IvCard
      title="Reschedule request + withdraw candidate"
      sub="Post-confirmation, request a reschedule with reason (routes to buyer for approval) — or withdraw the candidate entirely from the submittal."
    >
      <table className="iv-table">
        <thead><tr><th>Candidate</th><th>Interview</th><th>Buyer</th><th></th></tr></thead>
        <tbody>
          {candidates.slice(0, 4).map(({ s, iv }, i) => (
            <tr key={i}>
              <td>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <IvAvatar name={s.candidate.name} color={s.candidate.avatarColor} />
                  <div>
                    <div className="iv-table-name">{s.candidate.name}</div>
                    <div className="iv-table-meta">{s.reqTitle}</div>
                  </div>
                </div>
              </td>
              <td className="iv-table-meta">{iv.slot} · {(window.ivTypeById(iv.typeId) || {}).label}</td>
              <td>{s.buyer}</td>
              <td>
                <div style={{ display: "flex", gap: 6 }}>
                  <button type="button" className="iv-btn" onClick={() => setMode({ kind: "reschedule", s, iv })}>Request reschedule</button>
                  <button type="button" className="iv-btn iv-btn--danger" onClick={() => setMode({ kind: "withdraw", s, iv })}>Withdraw</button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {mode && (
        <React.Fragment>
          <div className="iv-panel-backdrop" onClick={() => setMode(null)} />
          <aside className="iv-panel" role="dialog">
            <div className="iv-panel-head">
              <div>
                <h3>{mode.kind === "reschedule" ? "Request reschedule" : "Withdraw candidate"}</h3>
                <div className="iv-panel-sub">{mode.s.candidate.name} · {mode.s.reqTitle}</div>
              </div>
              <button type="button" className="iv-btn iv-btn--quiet" onClick={() => setMode(null)}>Close</button>
            </div>
            <div className="iv-panel-body">
              <div className="iv-field">
                <span className="iv-field-label">Reason</span>
                <select className="iv-select">
                  <option>Select a reason</option>
                  {window.ivGetDeclineReasons().filter((r) => r.active).map((r) => (
                    <option key={r.id}>{r.label}</option>
                  ))}
                </select>
              </div>
              <div className="iv-field">
                <span className="iv-field-label">Note</span>
                <textarea className="iv-textarea" placeholder="Additional context for the buyer…" />
              </div>
              {mode.kind === "reschedule" && (
                <div className="iv-field">
                  <span className="iv-field-label">Proposed slot</span>
                  <input className="iv-input" placeholder="e.g. Jun 02 · 14:00" />
                  <span className="iv-field-hint">Routes to the buyer manager for approval.</span>
                </div>
              )}
            </div>
            <div className="iv-panel-foot">
              <button type="button" className="iv-btn" onClick={() => setMode(null)}>Cancel</button>
              <button type="button" className={"iv-btn iv-btn--" + (mode.kind === "reschedule" ? "primary" : "danger")} onClick={() => setMode(null)}>
                {mode.kind === "reschedule" ? "Send to buyer" : "Withdraw candidate"}
              </button>
            </div>
          </aside>
        </React.Fragment>
      )}
    </IvCard>
  );
}

// ---------- S8 — bulk status check ------------------------------------
function IVBulkStatus() {
  const submittals = window.ivGetSubmittals();
  const [picked, setPicked] = React.useState([]);

  const summary = picked.map((id) => submittals.find((s) => s.id === id)).filter(Boolean);

  return (
    <IvCard
      title="Bulk status check"
      sub="Select N submittals and pull a one-shot summary for end-of-week client status calls."
    >
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div>
          {submittals.map((s) => (
            <label key={s.id} className="iv-toggle-row" style={{ gridTemplateColumns: "24px 32px 1fr", marginBottom: 6, cursor: "pointer" }}>
              <input type="checkbox" checked={picked.includes(s.id)} onChange={(e) => setPicked(e.target.checked ? [...picked, s.id] : picked.filter((x) => x !== s.id))} />
              <IvAvatar name={s.candidate.name} color={s.candidate.avatarColor} />
              <div>
                <div className="iv-toggle-row-title">{s.candidate.name}</div>
                <div className="iv-toggle-row-hint">{s.reqTitle} · R{s.round} of {s.rounds}</div>
              </div>
            </label>
          ))}
        </div>
        <div>
          <h4 style={{ font: "var(--evr-h4)", margin: "0 0 8px" }}>Summary · {summary.length} selected</h4>
          {summary.length === 0 ? (
            <div className="iv-empty"><p className="iv-empty-body">Pick one or more candidates to compose the status snapshot.</p></div>
          ) : (
            <ul style={{ listStyle: "none", padding: 0, margin: 0, fontSize: 13.5, lineHeight: 1.6 }}>
              {summary.map((s) => (
                <li key={s.id} style={{ padding: "8px 0", borderTop: "1px dashed var(--evr-border-decorative-lowemp)" }}>
                  <b>{s.candidate.name}</b> · {s.buyer} · R{s.round}/{s.rounds} · {s.stage} · last touch {s.interviews[s.interviews.length - 1].slot}
                </li>
              ))}
            </ul>
          )}
          {summary.length > 0 && (
            <button type="button" className="iv-btn iv-btn--primary" style={{ marginTop: 12 }}>Copy summary</button>
          )}
        </div>
      </div>
    </IvCard>
  );
}

// ---------- S9 — funnel analytics -------------------------------------
function IVSupplierFunnel() {
  const stages = [
    { label: "Submitted",  count: 78, pct: 100 },
    { label: "Screened",   count: 41, pct: 53 },
    { label: "Interview",  count: 19, pct: 24 },
    { label: "Offer",      count: 7,  pct: 9 },
    { label: "Hired",      count: 5,  pct: 6 },
  ];
  return (
    <IvCard
      title="Funnel · last 90 days"
      sub="The supplier's own submit → interview → offer → hire funnel. Helps argue for tier promotion."
    >
      <div className="iv-kpis">
        <div className="iv-kpi"><div className="iv-kpi-label">Submitted</div><div className="iv-kpi-val">78</div><div className="iv-kpi-sub">across 3 buyers</div></div>
        <div className="iv-kpi"><div className="iv-kpi-label">Submit → interview</div><div className="iv-kpi-val">24%</div><div className="iv-kpi-sub" data-tone="up">+4 pts vs prior 90</div></div>
        <div className="iv-kpi"><div className="iv-kpi-label">Interview → offer</div><div className="iv-kpi-val">37%</div><div className="iv-kpi-sub" data-tone="up">+8 pts</div></div>
        <div className="iv-kpi"><div className="iv-kpi-label">Time to fill</div><div className="iv-kpi-val">11.2 d</div><div className="iv-kpi-sub" data-tone="up">Target 12.0 d</div></div>
      </div>
      <div style={{ display: "grid", gap: 8 }}>
        {stages.map((s) => (
          <div key={s.label} style={{ display: "grid", gridTemplateColumns: "140px 1fr 60px", gap: 12, alignItems: "center" }}>
            <div style={{ fontWeight: 600 }}>{s.label}</div>
            <div style={{ height: 18, background: "var(--evr-surface-secondary-default)", borderRadius: 999, overflow: "hidden" }}>
              <div style={{ height: "100%", width: s.pct + "%", background: "var(--evr-blue-400)" }} />
            </div>
            <div style={{ textAlign: "right", fontWeight: 600, fontFeatureSettings: "'tnum'" }}>{s.count}</div>
          </div>
        ))}
      </div>
    </IvCard>
  );
}

// ---------- per-buyer SLA — per-buyer SLA performance ---------------------------
function IVPerBuyerSla() {
  const rows = [
    { buyer: "Fleetwind Logistics", tts: 28, ttf: 19, ttd: 64, tier: "Tier 1" },
    { buyer: "Helios Power",        tts: 41, ttf: 25, ttd: 92, tier: "Tier 2" },
    { buyer: "Mercy Health System", tts: 18, ttf: 14, ttd: 36, tier: "Tier 1" },
  ];
  const sla = window.ivGetSla();
  const cell = (v, t) => {
    if (v == null) return "—";
    const tone = v <= t.warn ? "ok" : v <= t.target ? "info" : "bad";
    return <IvPill tone={tone}>{v} {t.unit}</IvPill>;
  };
  return (
    <IvCard
      title="Per-buyer interview SLA performance"
      sub="The supplier-holds-buyer-accountable surface. Shows the buyer's average time-to-schedule, time-to-feedback, time-to-decision against their target."
    >
      <table className="iv-table">
        <thead>
          <tr>
            <th>Buyer</th>
            <th>Time to schedule</th>
            <th>Time to feedback</th>
            <th>Time to decision</th>
            <th>Tier</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.buyer}>
              <td className="iv-table-name">{r.buyer}</td>
              <td>{cell(r.tts, sla.timeToSchedule)}</td>
              <td>{cell(r.ttf, sla.timeToFeedback)}</td>
              <td>{cell(r.ttd, sla.timeToDecision)}</td>
              <td><IvPill tone={r.tier === "Tier 1" ? "ok" : "warn"}>{r.tier}</IvPill></td>
            </tr>
          ))}
        </tbody>
      </table>
    </IvCard>
  );
}

// ---------- Section roster + wrapper ----------------------------------
const IV_AGENCY_SECTIONS = [
  { id: "required-pill-on-req-cards", label: "Required-pill on req cards", Comp: IVSupplierReqCards },
  { id: "invite-inbox-actions", label: "Invite inbox + actions",     Comp: IVInviteInbox },
  { id: "cross-buyer-pipeline", label: "Cross-buyer pipeline",       Comp: IVSupplierPipeline },
  { id: "reschedule-withdraw", label: "Reschedule + withdraw",      Comp: IVRescheduleAndWithdraw },
  { id: "bulk-status-check", label: "Bulk status check",          Comp: IVBulkStatus },
  { id: "funnel-analytics", label: "Funnel analytics",           Comp: IVSupplierFunnel },
  { id: "per-buyer SLA",    label: "Per-buyer SLA",              Comp: IVPerBuyerSla },
];

function InterviewAgencyPage() {
  const [active, setActive] = React.useState(() => IV_AGENCY_SECTIONS[0].id);
  const sect = IV_AGENCY_SECTIONS.find((s) => s.id === active) || IV_AGENCY_SECTIONS[0];
  const Comp = sect.Comp;
  return (
    <div className="ivp-cols">
      <aside className="ivp-nav" aria-label="Agency sections">
        <div className="ivp-nav-h">Agency</div>
        {IV_AGENCY_SECTIONS.map((s) => (
          <button
            key={s.id}
            type="button"
            className={"ivp-nav-btn" + (s.id === active ? " is-active" : "")}
            onClick={() => setActive(s.id)}
          >
            <span>{s.label}</span>
          </button>
        ))}
      </aside>
      <div>
        <Comp />
      </div>
    </div>
  );
}

Object.assign(window, { InterviewAgencyPage });
