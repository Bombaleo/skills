// =====================================================================
// Flex Work — Interview workflow · Manager surfaces
// ---------------------------------------------------------------------
// Renders inside InterviewWorkflowPage when the Manager role tab is
// active. Each numbered section corresponds to a task in
// `Flex Work Interview Workflow Tasks.html` §06.
// =====================================================================

// ---------- Schedule side panel (M1 + M2 + conflict checks) ------------------------
function IVSchedulePanel({ submittal, onClose, onSaved, mode = "schedule", existing = null }) {
  const types = window.ivGetTypes().filter((t) => t.active);
  const allInterviewers = window.ivGetInterviewers();
  const cal = window.ivGetCalendar();

  const [typeId, setTypeId]       = React.useState(existing?.typeId || types[0].id);
  const t = types.find((x) => x.id === typeId) || types[0];
  const [date,   setDate]         = React.useState(existing?.date || "May 30");
  const [time,   setTime]         = React.useState((existing?.slot || "May 30 · 10:00").split(" · ")[1] || "10:00");
  const [method, setMethod]       = React.useState(existing?.method || t.method);
  const [loc,    setLoc]          = React.useState(existing?.location || t.location);
  const [panel,  setPanel]        = React.useState(existing?.panel || t.defaultPanelRoles);
  const [search, setSearch]       = React.useState("");
  const [reason, setReason]       = React.useState("");

  // Resolve panel against actual users for conflict-check demo.
  const resolved = panel.map((p) => {
    const found = allInterviewers.find((u) => u.name === p || u.role === p);
    return { name: p, busy: found ? (found.id === "u-td" && time === "14:00") : false };
  });
  const conflicts = resolved.filter((p) => p.busy).length;

  const togglePanelist = (user) => {
    setPanel((cur) => cur.includes(user.name) ? cur.filter((n) => n !== user.name) : [...cur, user.name]);
  };

  const filteredUsers = search ? allInterviewers.filter((u) => u.name.toLowerCase().includes(search.toLowerCase()) || u.role.toLowerCase().includes(search.toLowerCase())) : allInterviewers;

  const handleSave = () => {
    const slot = `${date} · ${time}`;
    if (mode === "schedule") {
      const newIv = {
        id: "iv-" + Math.random().toString(36).slice(2, 8),
        typeId,
        date,
        slot,
        duration: t.duration,
        method,
        location: loc,
        panel,
        status: "Scheduled",
        round: (submittal.interviews.length || 0) + 1,
        scorecards: panel.map((p) => ({ panelist: p, score: null, submitted: false, card: {} })),
      };
      window.ivUpsertInterview(submittal.id, newIv);
    } else if (mode === "reschedule" && existing) {
      window.ivUpsertInterview(submittal.id, { ...existing, date, slot, method, location: loc, panel, status: "Scheduled" });
    } else if (mode === "cancel" && existing) {
      window.ivUpsertInterview(submittal.id, { ...existing, status: "Cancelled" });
    }
    onSaved && onSaved();
  };

  if (mode === "cancel") {
    return (
      <React.Fragment>
        <div className="iv-panel-backdrop" onClick={onClose} />
        <aside className="iv-panel" role="dialog" aria-label="Cancel interview">
          <div className="iv-panel-head">
            <div>
              <h3>Cancel interview · {existing.slot}</h3>
              <div className="iv-panel-sub">{existing.panel.join(", ")} · {existing.method}</div>
            </div>
            <button type="button" className="iv-btn iv-btn--quiet" onClick={onClose}>Close</button>
          </div>
          <div className="iv-panel-body">
            <div className="iv-field">
              <span className="iv-field-label">Reason</span>
              <select className="iv-select" value={reason} onChange={(e) => setReason(e.target.value)}>
                <option value="">Select a reason</option>
                {window.ivGetDeclineReasons().filter((r) => r.active).map((r) => (
                  <option key={r.id} value={r.id}>{r.label}</option>
                ))}
              </select>
              <span className="iv-field-hint">Required. Notifies candidate, supplier, and panel.</span>
            </div>
            <div className="iv-field">
              <span className="iv-field-label">Note (optional)</span>
              <textarea className="iv-textarea" placeholder="Additional context…" />
            </div>
          </div>
          <div className="iv-panel-foot">
            <button type="button" className="iv-btn" onClick={onClose}>Don&rsquo;t cancel</button>
            <button type="button" className="iv-btn iv-btn--danger" disabled={!reason} onClick={handleSave}>Cancel interview</button>
          </div>
        </aside>
      </React.Fragment>
    );
  }

  return (
    <React.Fragment>
      <div className="iv-panel-backdrop" onClick={onClose} />
      <aside className="iv-panel iv-panel--wide" role="dialog" aria-label={mode === "schedule" ? "Schedule interview" : "Reschedule interview"}>
        <div className="iv-panel-head">
          <div>
            <h3>{mode === "schedule" ? "Schedule interview" : "Reschedule interview"}</h3>
            <div className="iv-panel-sub">{submittal.candidate.name} · {submittal.reqTitle}</div>
          </div>
          <button type="button" className="iv-btn iv-btn--quiet" onClick={onClose}>Close</button>
        </div>
        <div className="iv-panel-body">
          {/* M1 — type + slot */}
          <div className="iv-field">
            <span className="iv-field-label">Interview type</span>
            <select className="iv-select" value={typeId} onChange={(e) => setTypeId(e.target.value)}>
              {types.map((t) => <option key={t.id} value={t.id}>{t.label} · {t.duration} min</option>)}
            </select>
            <span className="iv-field-hint">From the catalog. Selecting a type pre-fills method, location and the default panel.</span>
          </div>
          <div className="iv-field-row">
            <div className="iv-field">
              <span className="iv-field-label">Date</span>
              <input className="iv-input" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="iv-field">
              <span className="iv-field-label">Time</span>
              <input className="iv-input" value={time} onChange={(e) => setTime(e.target.value)} />
            </div>
          </div>
          <div className="iv-field-row">
            <div className="iv-field">
              <span className="iv-field-label">Method</span>
              <select className="iv-select" value={method} onChange={(e) => setMethod(e.target.value)}>
                <option>Phone</option>
                <option>Video</option>
                <option>In person</option>
              </select>
            </div>
            <div className="iv-field">
              <span className="iv-field-label">Location / dial-in</span>
              <input className="iv-input" value={loc} onChange={(e) => setLoc(e.target.value)} />
            </div>
          </div>

          {/* M2 — panel picker */}
          <div className="iv-field">
            <span className="iv-field-label">Panel · {panel.length} interviewer{panel.length === 1 ? "" : "s"}</span>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
              {panel.map((p, i) => (
                <span key={i} className="iv-pill iv-pill--purple" style={{ paddingRight: 4 }}>
                  {p}
                  <button type="button" className="iv-btn iv-btn--quiet" onClick={() => setPanel(panel.filter((x) => x !== p))} style={{ padding: "0 4px", minHeight: 0 }} aria-label="Remove">×</button>
                </span>
              ))}
            </div>
            <input className="iv-input" placeholder="Search across the org tree…" value={search} onChange={(e) => setSearch(e.target.value)} />
            <span className="iv-field-hint">Defaults pull from the interview-type's default roles ({t.defaultPanelRoles.join(", ")}). Add or remove freely.</span>
            {search && (
              <div style={{ marginTop: 8, maxHeight: 200, overflowY: "auto", border: "1px solid var(--evr-border-decorative-default)", borderRadius: 8 }}>
                {filteredUsers.slice(0, 8).map((u) => (
                  <button key={u.id} type="button" className="ivp-nav-btn" style={{ gridTemplateColumns: "32px 1fr auto", width: "100%", margin: 0, borderRadius: 0 }} onClick={() => togglePanelist(u)}>
                    <IvAvatar name={u.name} />
                    <div style={{ textAlign: "left" }}>
                      <div style={{ fontWeight: 600 }}>{u.name}</div>
                      <div style={{ fontSize: 11, color: "var(--evr-content-primary-lowemp)" }}>{u.role} · {u.dept}</div>
                    </div>
                    <span style={{ fontSize: 11, color: panel.includes(u.name) ? "var(--evr-green-500)" : "var(--evr-content-primary-lowemp)" }}>
                      {panel.includes(u.name) ? "On panel" : "Add"}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* conflict checks — calendar conflict check */}
          {cal.microsoft365.connected && (
            <div className="iv-field">
              <span className="iv-field-label">Calendar conflict check</span>
              <div style={{ display: "grid", gap: 6 }}>
                {resolved.map((p, i) => (
                  <div key={i} className="iv-toggle-row" style={{ gridTemplateColumns: "1fr auto", padding: "8px 12px" }}>
                    <div className="iv-toggle-row-title" style={{ fontSize: 12.5 }}>{p.name}</div>
                    <IvPill tone={p.busy ? "bad" : "ok"}>
                      <span className="iv-pill-dot" />
                      {p.busy ? "Busy" : "Free"}
                    </IvPill>
                  </div>
                ))}
              </div>
              {conflicts > 0 && <span className="iv-field-hint" style={{ color: "var(--evr-red-400)" }}>{conflicts} conflict{conflicts === 1 ? "" : "s"} at this slot. Pick a new time or accept the conflict.</span>}
            </div>
          )}
        </div>
        <div className="iv-panel-foot">
          <button type="button" className="iv-btn" onClick={onClose}>Cancel</button>
          <button type="button" className="iv-btn iv-btn--primary" onClick={handleSave}>{mode === "schedule" ? "Send invite" : "Save reschedule"}</button>
        </div>
      </aside>
    </React.Fragment>
  );
}

// ---------- Submittal list (M5 + M9 + M11) -----------------------------
function IVSubmittalList() {
  const [submittals, setSubmittals] = React.useState(window.ivGetSubmittals());
  const [openSubId, setOpenSubId] = React.useState(null);
  const [panelMode, setPanelMode] = React.useState(null);
  const [panelIv, setPanelIv] = React.useState(null);
  const [selected, setSelected] = React.useState([]);
  React.useEffect(() => window.ivSubscribe((d) => { if (d.key === "submittals" || d.key === "*") setSubmittals(window.ivGetSubmittals()); }), []);

  const sub = submittals.find((s) => s.id === openSubId);
  const sla = window.ivGetSla();

  const ttiBadge = (s) => {
    // Synthetic SLA: most-recent scheduled interview's age in fake hours.
    const score = window.ivRollUpScore(s);
    const oust = window.ivOutstandingScorecards(s);
    if (oust > 0) return { tone: "warn", label: `${oust} scorecard${oust === 1 ? "" : "s"} due` };
    if (score === null) return { tone: "info", label: "Awaiting first" };
    return { tone: "ok", label: `Score ${score}` };
  };

  const closePanel = () => { setPanelMode(null); setPanelIv(null); };

  // M3 — submit scorecard inline.
  const submitScorecard = (subId, ivId, panelist, score) => {
    const list = window.ivGetSubmittals();
    const out = list.map((s) => {
      if (s.id !== subId) return s;
      return {
        ...s,
        interviews: s.interviews.map((iv) => {
          if (iv.id !== ivId) return iv;
          return {
            ...iv,
            status: "Done",
            scorecards: iv.scorecards.map((sc) => sc.panelist === panelist ? { ...sc, submitted: true, score, card: { ...sc.card, "Hire / no-hire": score } } : sc),
          };
        }),
      };
    });
    window.ivSetSubmittals(out);
  };

  return (
    <React.Fragment>
      <IvCard
        title="Submittal · interview history"
        sub="Every scheduled and completed interview as a row. Outstanding scorecards surface as warn pills with a nudge action. Bulk actions appear when more than one row is selected."
        actions={
          selected.length > 0 ? (
            <div style={{ display: "flex", gap: 6 }}>
              <span className="iv-pill iv-pill--purple">{selected.length} selected</span>
              <button type="button" className="iv-btn">Bulk schedule</button>
              <button type="button" className="iv-btn iv-btn--danger">Bulk decline</button>
            </div>
          ) : null
        }
      >
        <div style={{ display: "grid", gap: 10 }}>
          {submittals.map((s) => {
            const score = window.ivRollUpScore(s);
            const out = window.ivOutstandingScorecards(s);
            const badge = ttiBadge(s);
            return (
              <div key={s.id} className="iv-toggle-row" style={{ gridTemplateColumns: "24px 36px 1fr auto auto auto", alignItems: "center" }}>
                <input type="checkbox" checked={selected.includes(s.id)} onChange={(e) => setSelected(e.target.checked ? [...selected, s.id] : selected.filter((x) => x !== s.id))} />
                <IvAvatar name={s.candidate.name} color={s.candidate.avatarColor} />
                <div>
                  <div className="iv-toggle-row-title">{s.candidate.name} <span style={{ fontWeight: 400, color: "var(--evr-content-primary-lowemp)" }}>· {s.candidate.source}</span></div>
                  <div className="iv-toggle-row-hint">{s.reqTitle} · {s.buyer} · Round {s.round} of {s.rounds}</div>
                </div>
                <IvPill tone="info">{s.stage}</IvPill>
                {/* M11 — SLA badge */}
                <IvPill tone={badge.tone}>{badge.label}</IvPill>
                <button type="button" className="iv-btn" onClick={() => setOpenSubId(s.id)}>Open</button>
              </div>
            );
          })}
        </div>
      </IvCard>

      {/* Detail panel — full interview history per submittal */}
      {sub && (
        <React.Fragment>
          <div className="iv-panel-backdrop" onClick={() => setOpenSubId(null)} />
          <aside className="iv-panel iv-panel--wide" role="dialog" aria-label="Interview history">
            <div className="iv-panel-head">
              <div>
                <h3>{sub.candidate.name}</h3>
                <div className="iv-panel-sub">{sub.reqTitle} · {sub.buyer} · {sub.supplier}</div>
              </div>
              <button type="button" className="iv-btn iv-btn--quiet" onClick={() => setOpenSubId(null)}>Close</button>
            </div>
            <div className="iv-panel-body">
              <div className="iv-kpis" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
                <div className="iv-kpi"><div className="iv-kpi-label">Roll-up score</div><div className="iv-kpi-val">{window.ivRollUpScore(sub) ?? "—"}</div></div>
                <div className="iv-kpi"><div className="iv-kpi-label">Round</div><div className="iv-kpi-val">{sub.round}<small style={{ fontSize: 14, color: "var(--evr-content-primary-lowemp)" }}> of {sub.rounds}</small></div></div>
                <div className="iv-kpi"><div className="iv-kpi-label">Outstanding</div><div className="iv-kpi-val">{window.ivOutstandingScorecards(sub)}</div></div>
              </div>
              {sub.interviews.map((iv) => (
                <article key={iv.id} className="iv-row" data-status={iv.status} style={{ marginBottom: 10 }}>
                  <div className="iv-row-when">
                    {iv.slot}
                    <small>Round {iv.round} · {iv.duration} min</small>
                  </div>
                  <div className="iv-row-main">
                    <div className="iv-row-title">{(window.ivTypeById(iv.typeId) || {}).label || iv.typeId}</div>
                    <div className="iv-row-panel">{iv.panel.join(", ")} · {iv.method} · {iv.location}</div>
                    {iv.scorecards.length > 0 && (
                      <div style={{ marginTop: 8, display: "grid", gap: 6 }}>
                        {iv.scorecards.map((sc, i) => (
                          <div key={i} className="iv-toggle-row" style={{ padding: "6px 10px", gridTemplateColumns: "1fr auto auto" }}>
                            <div className="iv-toggle-row-hint" style={{ marginTop: 0 }}>
                              <b style={{ color: "var(--evr-content-primary-default)" }}>{sc.panelist}</b>
                              {sc.submitted ? ` · Score ${sc.score}` : " · Awaiting"}
                            </div>
                            {sc.submitted ? <IvPill tone="ok">Submitted</IvPill> : <IvPill tone="warn">Pending</IvPill>}
                            {!sc.submitted && (
                              <div className="iv-rating" aria-label="Submit score">
                                {[2, 3, 4, 5].map((n) => (
                                  <button key={n} type="button" className="iv-rating-btn" onClick={() => submitScorecard(sub.id, iv.id, sc.panelist, n)}>{n}</button>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="iv-row-actions" style={{ flexDirection: "column", alignItems: "flex-end" }}>
                    <IvStatusPill status={iv.status} />
                    {(iv.status === "Scheduled" || iv.status === "Awaiting confirmation") && (
                      <div style={{ display: "flex", gap: 4, marginTop: 6 }}>
                        <button type="button" className="iv-btn iv-btn--quiet" onClick={() => { setPanelIv(iv); setPanelMode("reschedule"); }}>Reschedule</button>
                        <button type="button" className="iv-btn iv-btn--quiet" onClick={() => { setPanelIv(iv); setPanelMode("cancel"); }}>Cancel</button>
                      </div>
                    )}
                  </div>
                </article>
              ))}
            </div>
            <div className="iv-panel-foot">
              <button type="button" className="iv-btn" onClick={() => setOpenSubId(null)}>Close</button>
              <button type="button" className="iv-btn iv-btn--primary" onClick={() => setPanelMode("schedule")}>+ Schedule round {sub.round + 1}</button>
            </div>
          </aside>
        </React.Fragment>
      )}

      {sub && panelMode && (
        <IVSchedulePanel
          submittal={sub}
          existing={panelIv}
          mode={panelMode}
          onClose={closePanel}
          onSaved={() => { closePanel(); setOpenSubId(sub.id); }}
        />
      )}
    </React.Fragment>
  );
}

// ---------- multi-round — multi-round graph -------------------------------------
function IVMultiRound() {
  const submittals = window.ivGetSubmittals();
  return (
    <IvCard
      title="Multi-round graph"
      sub="Each submittal carries its current round and total rounds expected. Advance from final round routes to Offer. Round badges surface on submittal cards."
    >
      <table className="iv-table">
        <thead><tr><th>Candidate</th><th>Requisition</th><th>Progress</th><th>Round</th><th>Next stage</th></tr></thead>
        <tbody>
          {submittals.map((s) => {
            const pct = Math.round((s.round / s.rounds) * 100);
            return (
              <tr key={s.id}>
                <td><div className="iv-table-name">{s.candidate.name}</div></td>
                <td className="iv-table-meta">{s.reqTitle}</td>
                <td style={{ minWidth: 200 }}>
                  <div style={{ height: 6, borderRadius: 999, background: "var(--evr-surface-secondary-default)", overflow: "hidden" }}>
                    <div style={{ height: "100%", width: pct + "%", background: pct === 100 ? "var(--evr-green-500)" : "var(--evr-blue-400)" }} />
                  </div>
                  <div style={{ fontSize: 11, color: "var(--evr-content-primary-lowemp)", marginTop: 2 }}>{s.round} of {s.rounds} complete</div>
                </td>
                <td><IvPill tone={s.round === s.rounds ? "ok" : "info"}>Round {s.round}</IvPill></td>
                <td className="iv-table-meta">{s.round < s.rounds ? `Round ${s.round + 1}` : "Offer"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </IvCard>
  );
}

// ---------- M7 — side-by-side compare ----------------------------------
function IVCompare() {
  const submittals = window.ivGetSubmittals().filter((s) => s.stage === "Interview").slice(0, 3);
  const rows = ["Stage", "Round", "Roll-up score", "Source", "Supplier", "Outstanding scorecards", "Last interview"];
  const cells = submittals.map((s) => [
    s.stage,
    `Round ${s.round} of ${s.rounds}`,
    window.ivRollUpScore(s) ?? "—",
    s.candidate.source,
    s.supplier,
    window.ivOutstandingScorecards(s),
    s.interviews[s.interviews.length - 1]?.slot || "—",
  ]);

  return (
    <IvCard
      title="Side-by-side comparison"
      sub="Select 2–4 candidates in Interview stage. Scorecards stack column-wise; per-row deltas highlighted."
    >
      <div className="iv-compare" style={{ "--iv-compare-cols": submittals.length }}>
        <div className="iv-compare-h"></div>
        {submittals.map((s) => (
          <div key={s.id} className="iv-compare-h" style={{ background: "var(--evr-surface-primary-default)", borderBottom: "1px solid var(--evr-border-decorative-default)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <IvAvatar name={s.candidate.name} color={s.candidate.avatarColor} />
              <div>
                <div style={{ fontFamily: "var(--evr-font-display)", fontWeight: 600, fontSize: 14, color: "var(--evr-content-primary-highemp)", textTransform: "none" }}>{s.candidate.name}</div>
                <div style={{ fontSize: 11, textTransform: "none", letterSpacing: 0, fontWeight: 400 }}>{s.reqTitle}</div>
              </div>
            </div>
          </div>
        ))}
        {rows.map((label, ri) => (
          <React.Fragment key={ri}>
            <div className="iv-compare-h">{label}</div>
            {submittals.map((s, ci) => (
              <div key={ci} className="iv-compare-cell">{cells[ci][ri]}</div>
            ))}
          </React.Fragment>
        ))}
      </div>
    </IvCard>
  );
}

// ---------- M8 — availability windows ---------------------------------
function IVAvailabilityWindows() {
  const [picked, setPicked] = React.useState(null);
  const windows = window.ivGetWindows();

  const buildDays = (win) => {
    const labels = ["Mon", "Tue", "Wed", "Thu", "Fri"];
    return Array.from({ length: Math.min(win.days, 5) }, (_, i) => ({
      label: labels[i],
      date: `Jun ${i + 2}`,
      slots: ["09:00", "10:30", "13:00", "15:00"].map((time, j) => ({
        id: `${win.id}-${i}-${j}`,
        time,
        claimed: (i * 4 + j) < win.claimed,
      })),
    }));
  };

  return (
    <IvCard
      title="Availability windows"
      sub="Publish a 5 / 10 / 15-day window. Supplier or candidate picks. Claimed slots decrement in real time."
      actions={<button type="button" className="iv-btn iv-btn--primary">+ Open window</button>}
    >
      {windows.map((win) => (
        <div key={win.id} style={{ marginBottom: 18 }}>
          <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <div>
              <div style={{ fontFamily: "var(--evr-font-display)", fontWeight: 600 }}>{win.reqId}</div>
              <div style={{ fontSize: 12, color: "var(--evr-content-primary-lowemp)" }}>{win.owner} · opened {win.openedAt} · {win.claimed}/{win.totalSlots} slots claimed</div>
            </div>
            <IvPill tone={win.claimed === win.totalSlots ? "bad" : win.claimed > win.totalSlots / 2 ? "warn" : "ok"}>{win.totalSlots - win.claimed} remaining</IvPill>
          </header>
          <div className="iv-cal">
            {buildDays(win).map((d) => (
              <div key={d.label} className="iv-cal-day">
                <div className="iv-cal-day-label">{d.label} · {d.date}</div>
                {d.slots.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    className={"iv-cal-slot" + (s.claimed ? " is-claimed" : "") + (picked === s.id ? " is-selected" : "")}
                    onClick={() => !s.claimed && setPicked(s.id)}
                    aria-disabled={s.claimed}
                  >
                    {s.time}
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>
      ))}
    </IvCard>
  );
}

// ---------- M12 — mobile workflow preview ------------------------------
function IVMobilePreview() {
  return (
    <IvCard
      title="Mobile workflow"
      sub="Manager-mobile grows a scorecard submit + one-tap advance / decline. Lets a manager close out from anywhere — half of post-interview scorecards land that way in VNDLY's telemetry."
    >
      <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: 24, alignItems: "start" }}>
        <div style={{
          border: "10px solid #1c1c1f",
          borderRadius: 32,
          padding: 12,
          background: "var(--evr-surface-secondary-default)",
          boxShadow: "var(--evr-depth-04)",
        }}>
          <div style={{ background: "var(--evr-surface-primary-default)", borderRadius: 22, padding: 18, minHeight: 460 }}>
            <div style={{ fontSize: 11, color: "var(--evr-content-primary-lowemp)", textTransform: "uppercase", letterSpacing: ".08em" }}>Scorecard</div>
            <div style={{ fontFamily: "var(--evr-font-display)", fontWeight: 600, fontSize: 16, marginTop: 4 }}>Helena Voss</div>
            <div style={{ fontSize: 12, color: "var(--evr-content-primary-lowemp)" }}>Technical · Round 2</div>
            <hr style={{ border: 0, borderTop: "1px solid var(--evr-border-decorative-default)", margin: "12px 0" }} />
            {["Problem solving", "Coding / craft", "System design", "Hire / no-hire"].map((label, i) => (
              <div key={i} style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 600 }}>{label}</div>
                <div className="iv-rating" style={{ marginTop: 4 }}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button key={n} type="button" className={"iv-rating-btn" + (n === 4 ? " is-selected" : "")} style={{ width: 36, height: 36 }}>{n}</button>
                  ))}
                </div>
              </div>
            ))}
            <button type="button" className="iv-btn iv-btn--primary" style={{ width: "100%", marginTop: 8 }}>Submit + advance</button>
            <button type="button" className="iv-btn iv-btn--danger" style={{ width: "100%", marginTop: 6 }}>Decline</button>
          </div>
        </div>
        <div>
          <h4 style={{ font: "var(--evr-h4)", margin: "0 0 8px" }}>What ships</h4>
          <ul style={{ margin: 0, paddingLeft: 20, lineHeight: 1.7, fontSize: 14 }}>
            <li>Scorecard form with the same competencies as the desktop scorecard template.</li>
            <li>Submit-and-advance combined action — single tap moves the candidate to the next round.</li>
            <li>Decline with required reason code from the taxonomy.</li>
            <li>Surfaces in the existing <code>manager-mobile.jsx</code> bottom-sheet pattern.</li>
          </ul>
        </div>
      </div>
    </IvCard>
  );
}

// ---------- Section roster + wrapper ----------------------------------
const IV_MANAGER_SECTIONS = [
  { id: "schedule-reschedule", label: "Schedule + reschedule",  Comp: IVSubmittalList },
  { id: "multi-round",    label: "Multi-round graph",      Comp: IVMultiRound },
  { id: "side-by-side-compare", label: "Side-by-side compare",   Comp: IVCompare },
  { id: "availability-windows", label: "Availability windows",   Comp: IVAvailabilityWindows },
  { id: "mobile-workflow", label: "Mobile workflow",        Comp: IVMobilePreview },
];

function InterviewManagerPage() {
  const [active, setActive] = React.useState(() => IV_MANAGER_SECTIONS[0].id);
  const sect = IV_MANAGER_SECTIONS.find((s) => s.id === active) || IV_MANAGER_SECTIONS[0];
  const Comp = sect.Comp;
  return (
    <div className="ivp-cols">
      <aside className="ivp-nav" aria-label="Manager sections">
        <div className="ivp-nav-h">Manager</div>
        {IV_MANAGER_SECTIONS.map((s) => (
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

Object.assign(window, { InterviewManagerPage });
