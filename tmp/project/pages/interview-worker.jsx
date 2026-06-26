// =====================================================================
// Flex Work — Interview workflow · Worker (candidate) surfaces
// ---------------------------------------------------------------------
// Renders inside InterviewWorkflowPage when the Worker role tab is
// active. Mirrors `Flex Work Interview Workflow Tasks.html` §08.
//
// The worker surface is a single token-gated confirmation page rather
// than a dashboard — the candidate lands here from a magic-link email,
// no login. Sections within: invite, confirm / decline,
// details + prep + panel bios, self-serve slot pick,
// reschedule, outcome, .ics download, in-app messaging
//, post-interview survey.
// =====================================================================

function InterviewWorkerPage() {
  // Pull a single submittal whose first interview is scheduled — this is
  // the candidate the worker portal is rendering for.
  const submittals = window.ivGetSubmittals();
  // Helena Voss · she has a Scheduled round 3 panel coming up.
  const sub = submittals.find((s) => s.id === "sub-001") || submittals[0];
  const upcoming = sub.interviews.find((iv) => iv.status === "Scheduled") || sub.interviews[sub.interviews.length - 1];
  const type = window.ivTypeById(upcoming.typeId);
  const interviewers = window.ivGetInterviewers();
  const calendar = window.ivGetCalendar();

  const [status, setStatus] = React.useState(upcoming.status);
  const [declineReason, setDeclineReason] = React.useState("");
  const [showReschedule, setShowReschedule] = React.useState(false);
  const [pickedSlot, setPickedSlot] = React.useState(null);
  const [showMessages, setShowMessages] = React.useState(false);
  const [surveyScore, setSurveyScore] = React.useState(null);
  const [surveyText, setSurveyText] = React.useState("");

  const panelBios = upcoming.panel.map((name) => {
    const u = interviewers.find((x) => x.name === name);
    return u || { name, role: "Interviewer", dept: "—", avatar: name.slice(0, 2).toUpperCase() };
  });

  const candidateConfirm = () => setStatus("Confirmed");
  const candidateDecline = () => setStatus("Declined");

  // Persona strip is rendered by the orchestrator above this component.
  // This component is the worker-portal magic-link page only.
  return (
    <React.Fragment>
      <div className="ivp-worker" data-screen-label="Candidate interview portal">

        {/* W1 — invite header */}
        <header className="ivp-worker-head">
          <div>
            <div className="ivp-worker-eyebrow">Interview · {sub.buyer}</div>
            <h2 className="ivp-worker-title">Hi {sub.candidate.name.split(" ")[0]} — your {type.label.toLowerCase()} is {status === "Confirmed" ? "confirmed" : status === "Declined" ? "declined" : "scheduled"}</h2>
            <p style={{ margin: "8px 0 0", color: "var(--evr-content-primary-default)", fontSize: 14 }}>
              For <b>{sub.reqTitle}</b> · Round {upcoming.round} of {sub.rounds}
            </p>
          </div>
          <IvStatusPill status={status === "Confirmed" ? "Done" : status === "Declined" ? "Cancelled" : "Scheduled"} />
        </header>

        <div className="ivp-worker-body">

          {/* W3 — interview details */}
          <section className="ivp-worker-section">
            <h3 className="ivp-worker-section-h">Interview details</h3>
            <dl className="ivp-worker-detail">
              <dt>When</dt>           <dd><b>{upcoming.slot}</b> · {upcoming.duration} min</dd>
              <dt>Type</dt>           <dd>{type.label}</dd>
              <dt>Method</dt>         <dd>{upcoming.method}</dd>
              <dt>Location / dial-in</dt><dd>{upcoming.location}{upcoming.method === "Video" && " · link will arrive 15 min before"}</dd>
            </dl>
          </section>

          {/* W3 — panel bios */}
          <section className="ivp-worker-section">
            <h3 className="ivp-worker-section-h">Your panel</h3>
            <div style={{ display: "grid", gap: 10 }}>
              {panelBios.map((p) => (
                <div key={p.name} style={{ display: "grid", gridTemplateColumns: "44px 1fr", gap: 12, alignItems: "center" }}>
                  <IvAvatar name={p.name} color="purple" />
                  <div>
                    <div style={{ fontWeight: 600, color: "var(--evr-content-primary-highemp)" }}>{p.name}</div>
                    <div style={{ fontSize: 12.5, color: "var(--evr-content-primary-lowemp)" }}>{p.role} · {p.dept}</div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* W3 — prep notes */}
          <section className="ivp-worker-section">
            <h3 className="ivp-worker-section-h">How to prepare</h3>
            <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13.5, lineHeight: 1.65, color: "var(--evr-content-primary-default)" }}>
              <li>Bring a 2-page summary of a contingent-labor program you have led.</li>
              <li>We will discuss supplier strategy, scorecard design, and integration with the buyer's HRIS.</li>
              <li>Plan for a 10-min open Q&amp;A at the end — bring your questions.</li>
            </ul>
            <p style={{ fontSize: 12.5, color: "var(--evr-content-primary-lowemp)", marginTop: 10 }}>
              FAQ &middot; <a href="#">Privacy</a> &middot; <a href="#">Code of conduct</a>
            </p>
          </section>

          {/* W2 — confirm / decline */}
          {status === "Scheduled" && (
            <section className="ivp-worker-section">
              <h3 className="ivp-worker-section-h">Confirm or decline</h3>
              <p style={{ margin: "0 0 12px", fontSize: 13.5, color: "var(--evr-content-primary-default)" }}>
                Please confirm by end of day {upcoming.date.replace(/(\w+) (\d+)/, "$1 $2")} so the panel can plan.
              </p>
              <div style={{ display: "flex", gap: 8 }}>
                <button type="button" className="iv-btn iv-btn--primary" onClick={candidateConfirm}>Confirm attendance</button>
                <button type="button" className="iv-btn" onClick={() => setShowReschedule(true)}>Request reschedule</button>
                <button type="button" className="iv-btn iv-btn--danger" disabled={!declineReason} onClick={candidateDecline}>Decline</button>
              </div>
              <div className="iv-field" style={{ marginTop: 10 }}>
                <span className="iv-field-label">If declining, choose a reason</span>
                <select className="iv-select" value={declineReason} onChange={(e) => setDeclineReason(e.target.value)} style={{ maxWidth: 360 }}>
                  <option value="">Select…</option>
                  {window.ivGetDeclineReasons().filter((r) => r.active).map((r) => (
                    <option key={r.id} value={r.id}>{r.label}</option>
                  ))}
                </select>
              </div>
            </section>
          )}

          {status === "Confirmed" && (
            <section className="ivp-worker-section">
              <div className="iv-toggle-row" style={{ gridTemplateColumns: "1fr auto", borderColor: "var(--evr-green-200)", background: "var(--evr-surface-decorative-low-green)" }}>
                <div>
                  <div className="iv-toggle-row-title">Confirmed — added to your record</div>
                  <div className="iv-toggle-row-hint">A reminder will go out the day before. Reach out if anything changes.</div>
                </div>
                <IvPill tone="ok">Confirmed</IvPill>
              </div>
            </section>
          )}

          {/* W7 — calendar invite */}
          <section className="ivp-worker-section">
            <h3 className="ivp-worker-section-h">Add to your calendar</h3>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button type="button" className="iv-btn">Outlook · .ics</button>
              <button type="button" className="iv-btn">Google Calendar</button>
              <button type="button" className="iv-btn">Apple Calendar · .ics</button>
            </div>
            <p style={{ fontSize: 12, color: "var(--evr-content-primary-lowemp)", marginTop: 8 }}>
              <code>.ics</code> attachment is also included on the email — {calendar.ics.connected ? "always-on" : "off"}.
            </p>
          </section>

          {/* W8 — in-app messaging */}
          <section className="ivp-worker-section">
            <h3 className="ivp-worker-section-h">Messages with the recruiter</h3>
            {!showMessages ? (
              <button type="button" className="iv-btn" onClick={() => setShowMessages(true)}>Open thread</button>
            ) : (
              <div style={{ border: "1px solid var(--evr-border-decorative-default)", borderRadius: 10, padding: 12, background: "var(--evr-surface-secondary-default)" }}>
                <div style={{ display: "grid", gap: 10, marginBottom: 12 }}>
                  <div style={{ background: "var(--evr-surface-primary-default)", padding: "8px 12px", borderRadius: 10, alignSelf: "flex-start", maxWidth: "70%" }}>
                    <div style={{ fontSize: 12, fontWeight: 600 }}>J. Kim · Recruiter</div>
                    <div style={{ fontSize: 13 }}>Quick note — Terry will join from London so the Zoom link is the easiest. See you Tuesday.</div>
                  </div>
                  <div style={{ background: "var(--evr-interactive-primary-default)", color: "var(--evr-content-primary-inverse)", padding: "8px 12px", borderRadius: 10, alignSelf: "flex-end", maxWidth: "70%", marginLeft: "auto" }}>
                    <div style={{ fontSize: 13 }}>Got it — confirmed.</div>
                  </div>
                </div>
                <input className="iv-input" placeholder="Send a message…" />
              </div>
            )}
          </section>

          {/* W9 — post-interview survey (only shows if the upcoming round is in the past — for demo we show for sub-002 below if confirmed) */}
          {status === "Confirmed" && (
            <section className="ivp-worker-section">
              <h3 className="ivp-worker-section-h">After your interview · share feedback</h3>
              <div className="iv-field">
                <span className="iv-field-label">How likely are you to recommend interviewing here? (0–10)</span>
                <div className="iv-rating" style={{ flexWrap: "wrap" }}>
                  {Array.from({ length: 11 }).map((_, n) => (
                    <button key={n} type="button" className={"iv-rating-btn" + (surveyScore === n ? " is-selected" : "")} onClick={() => setSurveyScore(n)}>{n}</button>
                  ))}
                </div>
              </div>
              <div className="iv-field">
                <span className="iv-field-label">One thing we did well, or could improve</span>
                <textarea className="iv-textarea" value={surveyText} onChange={(e) => setSurveyText(e.target.value)} placeholder="Optional…" />
              </div>
              <button type="button" className="iv-btn iv-btn--primary" disabled={surveyScore == null}>Submit feedback</button>
              <p style={{ fontSize: 12, color: "var(--evr-content-primary-lowemp)", marginTop: 8 }}>
                Anonymized at the buyer level — your recruiter sees aggregate scores, not individual responses.
              </p>
            </section>
          )}

          {/* W6 — outcome notification (synthetic preview) */}
          <section className="ivp-worker-section">
            <h3 className="ivp-worker-section-h">After the interview</h3>
            <div style={{ display: "grid", gap: 8 }}>
              <div className="iv-toggle-row" style={{ gridTemplateColumns: "1fr auto" }}>
                <div>
                  <div className="iv-toggle-row-title">May 18 · Technical · Done</div>
                  <div className="iv-toggle-row-hint">Outcome notification sent · advanced to Round 3</div>
                </div>
                <IvPill tone="ok">Advanced</IvPill>
              </div>
              <div className="iv-toggle-row" style={{ gridTemplateColumns: "1fr auto" }}>
                <div>
                  <div className="iv-toggle-row-title">May 12 · Video screen · Done</div>
                  <div className="iv-toggle-row-hint">Outcome notification sent · advanced to Round 2</div>
                </div>
                <IvPill tone="ok">Advanced</IvPill>
              </div>
            </div>
          </section>
        </div>
      </div>

      {/* W4 + W5 — self-serve slot pick / reschedule panel */}
      {showReschedule && (
        <React.Fragment>
          <div className="iv-panel-backdrop" onClick={() => setShowReschedule(false)} />
          <aside className="iv-panel iv-panel--wide" role="dialog" aria-label="Reschedule">
            <div className="iv-panel-head">
              <div>
                <h3>Pick a new slot</h3>
                <div className="iv-panel-sub">Amy Hennen has opened 14 slots over the next 10 working days.</div>
              </div>
              <button type="button" className="iv-btn iv-btn--quiet" onClick={() => setShowReschedule(false)}>Close</button>
            </div>
            <div className="iv-panel-body">
              <div className="iv-cal">
                {[
                  { day: "Mon", date: "Jun 02", slots: ["09:00", "10:30", "14:00"] },
                  { day: "Tue", date: "Jun 03", slots: ["09:30", "11:00", "15:00"] },
                  { day: "Wed", date: "Jun 04", slots: ["10:00", "13:30"] },
                  { day: "Thu", date: "Jun 05", slots: ["09:00", "14:00", "16:00"] },
                  { day: "Fri", date: "Jun 06", slots: ["09:30", "11:30"] },
                ].map((d) => (
                  <div key={d.day} className="iv-cal-day">
                    <div className="iv-cal-day-label">{d.day} · {d.date}</div>
                    {d.slots.map((s) => {
                      const slotId = `${d.day}-${s}`;
                      return (
                        <button
                          key={slotId}
                          type="button"
                          className={"iv-cal-slot" + (pickedSlot === slotId ? " is-selected" : "")}
                          onClick={() => setPickedSlot(slotId)}
                        >
                          {s}
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
              <div className="iv-field" style={{ marginTop: 16 }}>
                <span className="iv-field-label">Reason for reschedule (optional)</span>
                <textarea className="iv-textarea" placeholder="Adds context for the manager…" />
              </div>
            </div>
            <div className="iv-panel-foot">
              <button type="button" className="iv-btn" onClick={() => setShowReschedule(false)}>Cancel</button>
              <button type="button" className="iv-btn iv-btn--primary" disabled={!pickedSlot} onClick={() => { setStatus("Scheduled"); setShowReschedule(false); }}>Confirm new slot</button>
            </div>
          </aside>
        </React.Fragment>
      )}
    </React.Fragment>
  );
}

Object.assign(window, { InterviewWorkerPage });
