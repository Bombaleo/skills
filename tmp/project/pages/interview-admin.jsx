// =====================================================================
// Flex Work — Interview workflow · Admin surfaces
// ---------------------------------------------------------------------
// Renders inside InterviewWorkflowPage when the Admin role tab is
// active. Each numbered section corresponds to a task in
// `Flex Work Interview Workflow Tasks.html` §05.
//
// A1 · Interview-type catalog
// A2 · Scorecard templates
// A3 · Notification templates
// A4 · Decline reason taxonomy
// A5 · Calendar integration
// A6 · Interview policy (supplier-type / job-family)
// A7 · Skip-interview approvals
// A8 · SLA thresholds
// A9 · Catalog version history
// =====================================================================

function IVTypeCatalog() {
  const [types, setTypes] = React.useState(window.ivGetTypes());
  React.useEffect(() => window.ivSubscribe((d) => { if (d.key === "types" || d.key === "*") setTypes(window.ivGetTypes()); }), []);

  const toggleActive = (id) => {
    const next = types.map((t) => t.id === id ? { ...t, active: !t.active } : t);
    window.ivSetTypes(next);
  };

  return (
    <IvCard
      title="Interview type catalog"
      sub="Curated types with default duration, method, location pattern, and bound scorecard. Replaces the hard-coded strings in the Professional pipeline."
      actions={<button type="button" className="iv-btn iv-btn--primary">+ New type</button>}
    >
      <table className="iv-table">
        <thead>
          <tr>
            <th>Type</th>
            <th>Duration</th>
            <th>Method</th>
            <th>Location pattern</th>
            <th>Default panel</th>
            <th>Scorecard</th>
            <th>Active</th>
          </tr>
        </thead>
        <tbody>
          {types.map((t) => (
            <tr key={t.id}>
              <td>
                <div className="iv-table-name">{t.label}</div>
                <div className="iv-table-meta">id · {t.id}</div>
              </td>
              <td>{t.duration} min</td>
              <td>{t.method}</td>
              <td>{t.location}</td>
              <td>{t.defaultPanelRoles.join(" + ")}</td>
              <td>
                <IvPill tone="info">{(window.ivScorecardById(t.scorecardId) || {}).label || "—"}</IvPill>
              </td>
              <td>
                <span
                  className={"iv-switch" + (t.active ? " is-on" : "")}
                  role="switch"
                  aria-checked={t.active}
                  tabIndex={0}
                  onClick={() => toggleActive(t.id)}
                  onKeyDown={(e) => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); toggleActive(t.id); } }}
                >
                  <span className="iv-switch-thumb" />
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </IvCard>
  );
}

function IVScorecardTemplates() {
  const [scorecards, setScorecards] = React.useState(window.ivGetScorecards());
  const [active, setActive] = React.useState(scorecards[0].id);
  React.useEffect(() => window.ivSubscribe((d) => { if (d.key === "scorecards" || d.key === "*") setScorecards(window.ivGetScorecards()); }), []);

  const cur = scorecards.find((s) => s.id === active) || scorecards[0];
  const toggleRequired = () => {
    window.ivSetScorecards(scorecards.map((s) => s.id === cur.id ? { ...s, requiredToAdvance: !s.requiredToAdvance } : s));
  };

  return (
    <IvCard
      title="Scorecard templates"
      sub="Per-type scorecard schemas. When required-to-advance is on, the candidate cannot move to Offer until every panelist submits theirs."
    >
      <div style={{ display: "grid", gridTemplateColumns: "200px 1fr", gap: 16 }}>
        <div>
          {scorecards.map((s) => (
            <button
              key={s.id}
              type="button"
              className={"ivp-nav-btn" + (s.id === active ? " is-active" : "")}
              onClick={() => setActive(s.id)}
            >
              <span>{s.label}</span>
            </button>
          ))}
        </div>
        <div>
          <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <div>
              <div style={{ font: "var(--evr-utility2)", textTransform: "uppercase", letterSpacing: ".08em", color: "var(--evr-content-primary-lowemp)" }}>Scorecard</div>
              <h4 style={{ margin: 0, font: "var(--evr-h4)", color: "var(--evr-content-primary-highemp)" }}>{cur.label}</h4>
            </div>
            <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13 }}>
              <span>Required to advance</span>
              <span className={"iv-switch" + (cur.requiredToAdvance ? " is-on" : "")} role="switch" aria-checked={cur.requiredToAdvance} tabIndex={0} onClick={toggleRequired} onKeyDown={(e) => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); toggleRequired(); } }}>
                <span className="iv-switch-thumb" />
              </span>
            </label>
          </header>
          <table className="iv-table">
            <thead><tr><th>Competency</th><th>Kind</th><th>Scale</th></tr></thead>
            <tbody>
              {cur.competencies.map((c, i) => (
                <tr key={i}>
                  <td className="iv-table-name">{c.label}</td>
                  <td>{c.kind === "rating" ? "Rating" : "Free text"}</td>
                  <td>{c.scale ? `1–${c.scale}` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </IvCard>
  );
}

function IVNotificationTemplates() {
  const [templates, setTemplates] = React.useState(window.ivGetTemplates());
  const [active, setActive] = React.useState(templates[0].id);
  React.useEffect(() => window.ivSubscribe((d) => { if (d.key === "templates" || d.key === "*") setTemplates(window.ivGetTemplates()); }), []);
  const cur = templates.find((t) => t.id === active) || templates[0];

  return (
    <IvCard
      title="Notification templates"
      sub="The Fieldglass Letter Management surface, reshaped for our token grammar. Each template carries audience + subject + body + token slots. Audit row per send."
      actions={<button type="button" className="iv-btn">Preview</button>}
    >
      <div style={{ display: "grid", gridTemplateColumns: "240px 1fr", gap: 16 }}>
        <div>
          {templates.map((t) => (
            <button
              key={t.id}
              type="button"
              className={"ivp-nav-btn" + (t.id === active ? " is-active" : "")}
              onClick={() => setActive(t.id)}
              style={{ gridTemplateColumns: "1fr auto", marginBottom: 2 }}
            >
              <span>{t.label}</span>
              <IvPill tone={t.audience === "candidate" ? "teal" : t.audience === "supplier" ? "warn" : "info"}>{t.audience}</IvPill>
            </button>
          ))}
        </div>
        <div>
          <div className="iv-field">
            <span className="iv-field-label">Subject</span>
            <input className="iv-input" defaultValue={cur.subject} key={cur.id + "-s"} />
          </div>
          <div className="iv-field">
            <span className="iv-field-label">Body</span>
            <textarea className="iv-textarea" defaultValue={cur.body} key={cur.id + "-b"} style={{ minHeight: 140 }} />
            <span className="iv-field-hint">{cur.tokens} token slots · use <code>{"{{token_name}}"}</code></span>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" className="iv-btn iv-btn--primary">Save template</button>
            <button type="button" className="iv-btn">Send test</button>
          </div>
        </div>
      </div>
    </IvCard>
  );
}

function IVDeclineReasons() {
  const [reasons, setReasons] = React.useState(window.ivGetDeclineReasons());
  React.useEffect(() => window.ivSubscribe((d) => { if (d.key === "declines" || d.key === "*") setReasons(window.ivGetDeclineReasons()); }), []);

  const toggleActive = (id) => {
    const next = reasons.map((r) => r.id === id ? { ...r, active: !r.active } : r);
    window.ivSetDeclineReasons(next);
  };

  return (
    <IvCard
      title="Decline reason taxonomy"
      sub="Required on every backward transition. Drives the &ldquo;why we lose&rdquo; report. Free-text note becomes optional addendum, not a substitute."
      actions={<button type="button" className="iv-btn iv-btn--primary">+ Add reason</button>}
    >
      <table className="iv-table">
        <thead>
          <tr>
            <th>Label</th>
            <th>Code</th>
            <th>Direction</th>
            <th>Active</th>
          </tr>
        </thead>
        <tbody>
          {reasons.map((r) => (
            <tr key={r.id}>
              <td className="iv-table-name">{r.label}</td>
              <td><code style={{ font: "12px ui-monospace,Menlo,monospace", color: "var(--evr-content-primary-lowemp)" }}>{r.id}</code></td>
              <td><IvPill tone="default">{r.direction === "back" ? "Backward" : "Forward"}</IvPill></td>
              <td>
                <span
                  className={"iv-switch" + (r.active ? " is-on" : "")}
                  role="switch"
                  aria-checked={r.active}
                  tabIndex={0}
                  onClick={() => toggleActive(r.id)}
                  onKeyDown={(e) => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); toggleActive(r.id); } }}
                >
                  <span className="iv-switch-thumb" />
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </IvCard>
  );
}

function IVCalendarIntegration() {
  const [cal, setCal] = React.useState(window.ivGetCalendar());
  React.useEffect(() => window.ivSubscribe((d) => { if (d.key === "calendar" || d.key === "*") setCal(window.ivGetCalendar()); }), []);

  const providers = [
    { key: "microsoft365", label: "Microsoft 365", icon: "Calendar" },
    { key: "google",       label: "Google Workspace", icon: "Calendar" },
    { key: "ics",          label: ".ics fallback (always-on)", icon: "Calendar" },
  ];

  const toggleProvider = (key) => {
    const next = { ...cal, [key]: { ...cal[key], connected: !cal[key].connected } };
    window.ivSetCalendar(next);
  };

  return (
    <IvCard
      title="Calendar integration"
      sub="Tenant-level OAuth + per-user delegation. Powers conflict checks, .ics attachments, and availability windows."
    >
      {providers.map((p) => {
        const cfg = cal[p.key] || { connected: false };
        return (
          <div key={p.key} className="iv-toggle-row" style={{ gridTemplateColumns: "1fr auto auto" }}>
            <div>
              <div className="iv-toggle-row-title">{p.label}</div>
              <div className="iv-toggle-row-hint">
                {cfg.tenant ? `Tenant: ${cfg.tenant}` : "Not connected"}
                {cfg.users != null && ` · ${cfg.users.toLocaleString()} users`}
                {cfg.lastSync && ` · last sync ${cfg.lastSync}`}
              </div>
            </div>
            <IvPill tone={cfg.connected ? "ok" : "default"}>{cfg.connected ? "Connected" : "Off"}</IvPill>
            {p.key !== "ics" && (
              <button type="button" className="iv-btn" onClick={() => toggleProvider(p.key)}>
                {cfg.connected ? "Disconnect" : "Connect"}
              </button>
            )}
          </div>
        );
      })}
    </IvCard>
  );
}

function IVPolicies() {
  const [policies, setPolicies] = React.useState(window.ivGetPolicies());
  React.useEffect(() => window.ivSubscribe((d) => { if (d.key === "policies" || d.key === "*") setPolicies(window.ivGetPolicies()); }), []);

  const toggle = (id, field) => {
    const next = policies.map((p) => p.id === id ? { ...p, [field]: !p[field] } : p);
    window.ivSetPolicies(next);
  };

  return (
    <IvCard
      title="Interview policy · supplier-type and job-family"
      sub="Pre-sets the per-requisition toggle. Per-req overrides still win. Adds inheritance to the tenant-wide default that ships today."
      actions={<button type="button" className="iv-btn iv-btn--primary">+ New policy</button>}
    >
      <table className="iv-table">
        <thead>
          <tr>
            <th>Scope</th>
            <th>Value</th>
            <th>Rule</th>
            <th>Interview required</th>
            <th>Active</th>
          </tr>
        </thead>
        <tbody>
          {policies.map((p) => (
            <tr key={p.id}>
              <td><IvPill tone={p.scope === "supplier-type" ? "info" : "purple"}>{p.scope}</IvPill></td>
              <td className="iv-table-name">{p.value}</td>
              <td className="iv-table-meta" style={{ fontStyle: "italic" }}>{p.rule}</td>
              <td>
                <span className={"iv-switch" + (p.required ? " is-on" : "")} role="switch" aria-checked={p.required} tabIndex={0} onClick={() => toggle(p.id, "required")} onKeyDown={(e) => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); toggle(p.id, "required"); } }}>
                  <span className="iv-switch-thumb" />
                </span>
              </td>
              <td>
                <span className={"iv-switch" + (p.active ? " is-on" : "")} role="switch" aria-checked={p.active} tabIndex={0} onClick={() => toggle(p.id, "active")} onKeyDown={(e) => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); toggle(p.id, "active"); } }}>
                  <span className="iv-switch-thumb" />
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </IvCard>
  );
}

function IVSkipApprovals() {
  const [skips, setSkips] = React.useState(window.ivGetSkips());
  React.useEffect(() => window.ivSubscribe((d) => { if (d.key === "skips" || d.key === "*") setSkips(window.ivGetSkips()); }), []);

  const decide = (id, status) => {
    window.ivSetSkips(skips.map((s) => s.id === id ? { ...s, status, at: "Just now" } : s));
  };

  return (
    <IvCard
      title="Skip-interview approvals"
      sub="When a manager turns off the gate on a req policy expects to have one, capture reason + approver. Audit log records actor, reason, approver, timestamp."
    >
      <table className="iv-table">
        <thead>
          <tr>
            <th>Requisition</th>
            <th>Candidate</th>
            <th>Reason</th>
            <th>Actor</th>
            <th>Approver</th>
            <th>Status</th>
            <th>When</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {skips.map((s) => (
            <tr key={s.id}>
              <td><code style={{ font: "12px ui-monospace,Menlo,monospace" }}>{s.reqId}</code></td>
              <td className="iv-table-name">{s.candidate}</td>
              <td>{s.reason}</td>
              <td>{s.actor}</td>
              <td>{s.approver}</td>
              <td>
                <IvPill tone={s.status === "Approved" ? "ok" : s.status === "Denied" ? "bad" : "warn"}>{s.status}</IvPill>
              </td>
              <td className="iv-table-meta">{s.at}</td>
              <td>
                {s.status === "Pending" ? (
                  <div style={{ display: "flex", gap: 6 }}>
                    <button type="button" className="iv-btn iv-btn--primary" onClick={() => decide(s.id, "Approved")}>Approve</button>
                    <button type="button" className="iv-btn iv-btn--danger" onClick={() => decide(s.id, "Denied")}>Deny</button>
                  </div>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </IvCard>
  );
}

function IVSlaThresholds() {
  const [sla, setSla] = React.useState(window.ivGetSla());
  React.useEffect(() => window.ivSubscribe((d) => { if (d.key === "sla" || d.key === "*") setSla(window.ivGetSla()); }), []);

  const rows = [
    { key: "timeToSchedule", label: "Time to schedule", hint: "From submit to first scheduled interview" },
    { key: "timeToFeedback", label: "Time to feedback", hint: "From interview to all scorecards in" },
    { key: "timeToDecision", label: "Time to decision", hint: "From last scorecard to advance / decline" },
  ];

  const updateTarget = (key, target) => {
    const n = Number(target) || 0;
    window.ivSetSla({ ...sla, [key]: { ...sla[key], target: n } });
  };

  return (
    <IvCard
      title="Interview SLA thresholds"
      sub="Per-program targets. Drives the breach badges on submittal cards and per-buyer supplier metrics. Targets configurable per supplier-type and job-family."
    >
      <div className="iv-kpis" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
        {rows.map((r) => {
          const cfg = sla[r.key];
          const tone = cfg.current <= cfg.warn ? "up" : cfg.current <= cfg.target ? "" : "down";
          return (
            <div key={r.key} className="iv-kpi">
              <div className="iv-kpi-label">{r.label}</div>
              <div className="iv-kpi-val">{cfg.current} <small style={{ fontSize: 13, color: "var(--evr-content-primary-lowemp)" }}>{cfg.unit}</small></div>
              <div className="iv-kpi-sub" data-tone={tone}>Target {cfg.target} · warn at {cfg.warn}</div>
            </div>
          );
        })}
      </div>
      <table className="iv-table">
        <thead><tr><th>Metric</th><th>Target</th><th>Warn at</th><th>Current</th></tr></thead>
        <tbody>
          {rows.map((r) => {
            const cfg = sla[r.key];
            return (
              <tr key={r.key}>
                <td>
                  <div className="iv-table-name">{r.label}</div>
                  <div className="iv-table-meta">{r.hint}</div>
                </td>
                <td>
                  <input className="iv-input" type="number" value={cfg.target} onChange={(e) => updateTarget(r.key, e.target.value)} style={{ width: 80 }} />
                  <span style={{ marginLeft: 6, fontSize: 12, color: "var(--evr-content-primary-lowemp)" }}>{cfg.unit}</span>
                </td>
                <td>{cfg.warn} {cfg.unit}</td>
                <td><IvPill tone={cfg.current <= cfg.target ? "ok" : "bad"}>{cfg.current} {cfg.unit}</IvPill></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </IvCard>
  );
}

function IVVersionHistory() {
  const [versions] = React.useState(window.ivGetVersions());

  return (
    <IvCard
      title="Catalog version history"
      sub="When the admin renames a type or retires a scorecard, in-flight interviews keep using the version they were created with. New requisitions pick up the new one."
      actions={<button type="button" className="iv-btn">Promote draft</button>}
    >
      <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
        {versions.map((v) => (
          <li key={v.id} className="iv-toggle-row" style={{ gridTemplateColumns: "60px 1fr auto", marginBottom: 8 }}>
            <code style={{ font: "12px ui-monospace,Menlo,monospace", color: "var(--evr-content-primary-lowemp)" }}>{v.id}</code>
            <div>
              <div className="iv-toggle-row-title">{v.summary}</div>
              <div className="iv-toggle-row-hint">{v.actor} · {v.at} · {v.items} item{v.items === 1 ? "" : "s"} changed</div>
            </div>
            <button type="button" className="iv-btn iv-btn--quiet">Diff</button>
          </li>
        ))}
      </ul>
    </IvCard>
  );
}

// ---------- Section roster + page wrapper ------------------------------
const IV_ADMIN_SECTIONS = [
  { id: "type-catalog", label: "Type catalog",             Comp: IVTypeCatalog },
  { id: "scorecard-templates", label: "Scorecard templates",      Comp: IVScorecardTemplates },
  { id: "notification-templates", label: "Notification templates",   Comp: IVNotificationTemplates },
  { id: "decline-reasons", label: "Decline reasons",          Comp: IVDeclineReasons },
  { id: "calendar-integration", label: "Calendar integration",     Comp: IVCalendarIntegration },
  { id: "interview-policy", label: "Interview policy",         Comp: IVPolicies },
  { id: "skip-interview-approvals", label: "Skip-interview approvals", Comp: IVSkipApprovals },
  { id: "sla-thresholds", label: "SLA thresholds",           Comp: IVSlaThresholds },
  { id: "version-history", label: "Version history",          Comp: IVVersionHistory },
];

function InterviewAdminPage() {
  const [active, setActive] = React.useState(() => IV_ADMIN_SECTIONS[0].id);
  const sect = IV_ADMIN_SECTIONS.find((s) => s.id === active) || IV_ADMIN_SECTIONS[0];
  const Comp = sect.Comp;
  return (
    <div className="ivp-cols">
      <aside className="ivp-nav" aria-label="Admin sections">
        <div className="ivp-nav-h">Admin</div>
        {IV_ADMIN_SECTIONS.map((s) => (
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

Object.assign(window, { InterviewAdminPage });
