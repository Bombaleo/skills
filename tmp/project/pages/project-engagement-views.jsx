// =====================================================================
// Flex Work — Project engagement type · views & components
//
// React components that ride on top of pages/project-engagement.jsx
// primitives. Used by:
//   · settings-config.jsx     → <ProjectAdminPanel/>
//   · new-requisition.jsx     → <ProjectIntakeFields/>
//   · requisition-engagement-detail.jsx → <ProjectVariantBody/> (via registry)
//   · timesheets.jsx          → <ProjectWeeklyBurnView/>
//   · agency-pro.jsx          → <AgencyProjectsTab/>
//   · worker-mobile.jsx       → <WorkerProjectScreen/>
//
// Everything renders only when the engProject feature flag is on; the
// host pages should also flag-gate but components self-gate too.
// =====================================================================

(function () {
  const { useState, useEffect, useMemo } = React;
  const PS = window.PSProjects;
  if (!PS) {
    console.error("project-engagement-views: PSProjects not on window — load order issue.");
    return;
  }
  const {
    isProjectOn, useProjectOn,
    getProjects, getProject, saveProject, createProject,
    getConfig, saveConfig, useProject, useConfig, useProjects,
    STATES, TRANSITIONS, stateMeta,
    projectActualSpend, projectPlannedSpend, projectBurnPct, projectNtePct,
    totalRosterHours, totalPlannedHours, daysRemaining, nteCushionPct,
    fmtMoney, fmtMoneyExact, fmtPct, fmtHours, fmtDate, fmtDateShort,
    CCY_SYM,
  } = PS;

  // ---------------------------------------------------------------
  // Generic micro-components
  // ---------------------------------------------------------------
  function Pill({ tone = "neutral", children }) {
    return <span className={`prj-pill prj-pill--${tone}`}>{children}</span>;
  }
  function Btn({ tone = "secondary", size = "md", onClick, disabled, children, type = "button" }) {
    return (
      <button type={type}
        className={`prj-btn prj-btn--${tone} prj-btn--${size}`}
        disabled={disabled} onClick={onClick}>
        {children}
      </button>
    );
  }
  function Toggle({ checked, onChange, disabled, label }) {
    return (
      <button type="button" role="switch" aria-checked={!!checked}
        disabled={disabled}
        className={`prj-toggle${checked ? " is-on" : ""}`}
        onClick={() => onChange(!checked)}>
        <span className="prj-toggle-track" />
        <span className="prj-toggle-knob" />
        {label && <span className="prj-toggle-label">{label}</span>}
      </button>
    );
  }
  function Segmented({ value, onChange, options }) {
    return (
      <div className="prj-seg" role="tablist">
        {options.map((o) => {
          const v = typeof o === "string" ? o : o.value;
          const l = typeof o === "string" ? o : o.label;
          return (
            <button key={v} type="button" role="tab"
              aria-selected={v === value}
              className={`prj-seg-btn${v === value ? " is-on" : ""}`}
              onClick={() => onChange(v)}>
              {l}
            </button>
          );
        })}
      </div>
    );
  }
  function Field({ label, hint, children, span }) {
    const style = span ? { gridColumn: `span ${span}` } : null;
    return (
      <label className="prj-field" style={style}>
        <span className="prj-field-l">{label}</span>
        <span className="prj-field-c">{children}</span>
        {hint && <span className="prj-field-h">{hint}</span>}
      </label>
    );
  }
  function FieldGrid({ cols = 2, children }) {
    return (
      <div className="prj-field-grid"
        style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
        {children}
      </div>
    );
  }
  function Input({ value, onChange, placeholder, disabled, mono, type = "text" }) {
    return (
      <input
        type={type}
        className={`prj-input${mono ? " prj-input--mono" : ""}`}
        value={value ?? ""}
        placeholder={placeholder}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }
  function NumInput({ value, onChange, min, max, step = 1, suffix, disabled }) {
    return (
      <span className="prj-num">
        <input
          type="number"
          className="prj-input prj-input--num"
          value={value ?? ""}
          min={min} max={max} step={step}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
        />
        {suffix && <span className="prj-num-suffix">{suffix}</span>}
      </span>
    );
  }
  function MoneyInput({ value, currency = "USD", onChange, disabled }) {
    return (
      <span className="prj-money">
        <span className="prj-money-ccy">{CCY_SYM[currency] || "$"}</span>
        <input
          type="number"
          className="prj-input prj-input--money"
          value={value ?? ""}
          disabled={disabled}
          min={0} step={1000}
          onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
        />
      </span>
    );
  }
  function SelectInput({ value, onChange, options, disabled, placeholder }) {
    return (
      <select
        className="prj-input prj-input--select"
        value={value ?? ""}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}>
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((o) =>
          typeof o === "string"
            ? <option key={o} value={o}>{o}</option>
            : <option key={o.value} value={o.value}>{o.label}</option>
        )}
      </select>
    );
  }
  function ChipList({ items, onChange, placeholder, max }) {
    const [draft, setDraft] = useState("");
    function add() {
      const v = draft.trim(); if (!v) return;
      if (max && items.length >= max) return;
      onChange([...items, v]); setDraft("");
    }
    function remove(i) { onChange(items.filter((_, idx) => idx !== i)); }
    return (
      <div className="prj-chips">
        {items.map((it, i) => (
          <span key={i} className="prj-chips-chip">
            {it}
            <button type="button" className="prj-chips-x" onClick={() => remove(i)} aria-label="Remove">×</button>
          </span>
        ))}
        <input className="prj-chips-in" value={draft}
          placeholder={items.length === 0 ? placeholder : ""}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") { e.preventDefault(); add(); }
            else if (e.key === "Backspace" && draft === "" && items.length > 0) remove(items.length - 1);
          }}
          onBlur={() => add()} />
      </div>
    );
  }
  function StatePill({ id }) {
    const m = stateMeta(id);
    return <Pill tone={m.tone}>{m.label}</Pill>;
  }
  function Progress({ value, max = 100, nte }) {
    const pct = Math.min(110, Math.max(0, (value / max) * 100));
    let tone = "ok";
    if (pct >= 100) tone = "danger"; else if (pct >= 90) tone = "warn"; else if (pct >= 75) tone = "watch";
    return (
      <div className={`prj-prog prj-prog--${tone}`}>
        <div className="prj-prog-track">
          <div className="prj-prog-fill" style={{ width: `${Math.min(100, pct)}%` }} />
          {nte && nte < 100 && <div className="prj-prog-nte" style={{ left: `${nte}%` }} title={`NTE at ${nte}%`} />}
        </div>
      </div>
    );
  }
  function Avatar({ name, size = 28, tone }) {
    const initials = String(name || "").split(/\s+/).map((s) => s[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
    let hash = 0;
    for (let i = 0; i < String(name || "").length; i++) hash = (hash * 31 + (name || "").charCodeAt(i)) | 0;
    const hues = ["blue", "purple", "teal", "orange", "green"];
    const t = tone || hues[Math.abs(hash) % hues.length];
    return (
      <span className={`prj-avatar prj-avatar--${t}`}
        style={{ width: size, height: size, fontSize: Math.round(size * 0.4) }}>
        {initials}
      </span>
    );
  }

  // ---------------------------------------------------------------
  // Burn chart — SVG line chart
  // ---------------------------------------------------------------
  function BurnChart({ data, ccy = "USD", height = 200 }) {
    const W = 640, H = height, pad = { l: 64, r: 16, t: 18, b: 28 };
    const innerW = W - pad.l - pad.r;
    const innerH = H - pad.t - pad.b;
    if (!data || data.length < 2) {
      return <div className="prj-empty">Burn ledger empty — no weeks of actuals yet.</div>;
    }
    const maxY = Math.max(...data.map((d) => Math.max(d.planned || 0, d.actual || 0))) * 1.1 || 1;
    const xStep = innerW / Math.max(1, data.length - 1);
    const lineFor = (k) => data.map((d, i) => {
      const x = pad.l + i * xStep;
      const y = pad.t + innerH - (d[k] / maxY) * innerH;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(" ");
    const yTicks = 4;
    const ticks = [];
    for (let i = 0; i <= yTicks; i++) {
      const v = (maxY / yTicks) * i;
      const y = pad.t + innerH - (v / maxY) * innerH;
      ticks.push({ y, label: fmtMoney(v, ccy) });
    }
    return (
      <div>
        <svg viewBox={`0 0 ${W} ${H}`} className="prj-chart" preserveAspectRatio="none">
          {ticks.map((t, i) => (
            <g key={i}>
              <line x1={pad.l} x2={W - pad.r} y1={t.y} y2={t.y}
                stroke="var(--evr-border-decorative-lowemp)"
                strokeDasharray={i === 0 ? "0" : "2 4"} />
              <text x={pad.l - 8} y={t.y + 4} textAnchor="end"
                fill="var(--evr-content-primary-lowemp)" fontSize="11">{t.label}</text>
            </g>
          ))}
          <path d={lineFor("planned")} fill="none"
            stroke="var(--evr-content-primary-lowemp)" strokeWidth="1.5" strokeDasharray="4 4" />
          <path d={lineFor("actual") +
            ` L${(pad.l + (data.length - 1) * xStep).toFixed(1)},${(pad.t + innerH).toFixed(1)} L${pad.l.toFixed(1)},${(pad.t + innerH).toFixed(1)} Z`}
            fill="var(--evr-blue-100)" fillOpacity="0.5" />
          <path d={lineFor("actual")} fill="none"
            stroke="var(--evr-blue-400)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          {data.map((d, i) => {
            const x = pad.l + i * xStep;
            const y = pad.t + innerH - (d.actual / maxY) * innerH;
            return <circle key={i} cx={x} cy={y} r="3" fill="var(--evr-blue-400)" stroke="white" strokeWidth="1.5" />;
          })}
          {data.map((d, i) => {
            if (data.length > 12 && i % 2 !== 0 && i !== data.length - 1) return null;
            const x = pad.l + i * xStep;
            return <text key={i} x={x} y={H - 10} textAnchor="middle"
              fill="var(--evr-content-primary-lowemp)" fontSize="11">W{d.week}</text>;
          })}
        </svg>
        <div className="prj-chart-legend">
          <span><i className="prj-chart-swatch" /> Actual cumulative</span>
          <span><i className="prj-chart-swatch is-dashed" /> Planned cumulative</span>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------
  // Project chip — small inline label used on lists
  // ---------------------------------------------------------------
  function ProjectChip({ project }) {
    if (!project) return null;
    return (
      <span className="prj-chip">
        <span className="prj-chip-dot" />
        {project.name}
        <span className="prj-chip-id">{project.id}</span>
      </span>
    );
  }

  // ---------------------------------------------------------------
  // Modal — simple dialog wrapper
  // ---------------------------------------------------------------
  function Modal({ open, onClose, title, children, footer, size = "md" }) {
    if (!open) return null;
    return (
      <div className="prj-modal-scrim" onClick={onClose}>
        <div className={`prj-modal prj-modal--${size}`}
          onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
          <header className="prj-modal-h">
            <h3>{title}</h3>
            <button className="prj-modal-x" onClick={onClose} aria-label="Close">×</button>
          </header>
          <div className="prj-modal-b">{children}</div>
          {footer && <footer className="prj-modal-f">{footer}</footer>}
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------
  // <ProjectAdminPanel/> — Settings → Configuration card
  // ---------------------------------------------------------------
  function ProjectAdminPanel() {
    if (!useProjectOn()) return null;
    const config = useConfig();
    function update(next) { saveConfig(next); }

    return (
      <div className="prj-admin">
        <header className="prj-admin-h">
          <div>
            <div className="prj-admin-eyebrow">Engagement types · Project</div>
            <h3 className="prj-admin-title">Project settings</h3>
            <p className="prj-admin-sub">Per-org configuration for the Project engagement type. Every control below scopes to the current tenant.</p>
          </div>
          <Pill tone="info">Live</Pill>
        </header>

        {/* Numbering */}
        <Section title="Project number sequence"
          sub="Prefix, format mask, next sequence, and the optional external-ID validator.">
          <FieldGrid cols={3}>
            <Field label="Prefix">
              <Input value={config.numberPrefix} onChange={(v) => update({ ...config, numberPrefix: v })} />
            </Field>
            <Field label="Format" hint="Tokens · {prefix} {YYYY} {####}">
              <Input value={config.numberFormat} mono onChange={(v) => update({ ...config, numberFormat: v })} />
            </Field>
            <Field label="Next sequence">
              <NumInput value={config.nextSeq} min={1} onChange={(v) => update({ ...config, nextSeq: v })} />
            </Field>
            <Field label="External ID required" hint="Treasury / PMO ID at intake.">
              <Toggle checked={config.externalIdRequired} onChange={(v) => update({ ...config, externalIdRequired: v })} />
            </Field>
            <Field label="External ID validator" span={2}>
              <SelectInput value={config.externalIdValidator} disabled={!config.externalIdRequired}
                onChange={(v) => update({ ...config, externalIdValidator: v })}
                options={[
                  { value: "none", label: "No validation" },
                  { value: "treasury-cip", label: "Treasury capital project ID (CIP-YYYY-###)" },
                  { value: "free-text", label: "Free text · length ≥ 4" },
                ]} />
            </Field>
          </FieldGrid>
          <DefRow k="Preview" v={<code style={{ fontSize: 13.5 }}>{previewProjectId(config)}</code>} />
        </Section>

        {/* Budget approval matrix */}
        <Section title="Budget approval thresholds"
          sub="What gets approved by whom, by total project budget. Ordered smallest first; the final tier (no upper bound) is the global escalation.">
          <table className="prj-tbl">
            <thead>
              <tr><th style={{ width: 60 }}>Tier</th><th style={{ width: 200 }}>If budget less than</th><th>Approvers</th></tr>
            </thead>
            <tbody>
              {config.budgetApprovalTiers.map((t, i) => (
                <tr key={t.id}>
                  <td>T{i + 1}</td>
                  <td>
                    {t.lt === null
                      ? <Pill tone="neutral">Above all</Pill>
                      : <MoneyInput value={t.lt}
                          onChange={(v) => {
                            const next = config.budgetApprovalTiers.map((x, j) => j === i ? { ...x, lt: v } : x);
                            update({ ...config, budgetApprovalTiers: next });
                          }} />}
                  </td>
                  <td>
                    <ChipList items={t.approvers}
                      placeholder="Add an approver…"
                      onChange={(v) => {
                        const next = config.budgetApprovalTiers.map((x, j) => j === i ? { ...x, approvers: v } : x);
                        update({ ...config, budgetApprovalTiers: next });
                      }} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>

        {/* Change order */}
        <Section title="Change-order approval policy"
          sub="Auto-approve thresholds, justification requirements, and the closed reason-code list shown on the submit form.">
          <FieldGrid cols={3}>
            <Field label="Auto-approve up to" hint="% of current budget">
              <NumInput value={config.changeOrder.autoApprovePctMax} suffix="%" min={0} max={100}
                onChange={(v) => update({ ...config, changeOrder: { ...config.changeOrder, autoApprovePctMax: v } })} />
            </Field>
            <Field label="Manager approve up to" hint="% of current budget">
              <NumInput value={config.changeOrder.managerApprovePctMax} suffix="%" min={0} max={100}
                onChange={(v) => update({ ...config, changeOrder: { ...config.changeOrder, managerApprovePctMax: v } })} />
            </Field>
            <Field label="Require justification">
              <Toggle checked={config.changeOrder.requireJustification}
                onChange={(v) => update({ ...config, changeOrder: { ...config.changeOrder, requireJustification: v } })} />
            </Field>
          </FieldGrid>
          <hr className="prj-hr" />
          <Field label="Reason codes" hint="Closed list shown on the submit form. Order preserved.">
            <ChipList items={config.changeOrder.reasonCodes}
              onChange={(v) => update({ ...config, changeOrder: { ...config.changeOrder, reasonCodes: v } })}
              placeholder="Add a reason code…" />
          </Field>
        </Section>

        {/* Burn alerts */}
        <Section title="Burn-alert thresholds"
          sub="When to notify whom, by % of budget spent. Each row fires once per project."
          right={<Toggle checked={config.burnAlerts.enabled}
            onChange={(v) => update({ ...config, burnAlerts: { ...config.burnAlerts, enabled: v } })}
            label={config.burnAlerts.enabled ? "Enabled" : "Disabled"} />}>
          <table className="prj-tbl">
            <thead>
              <tr><th style={{ width: 60 }}>Level</th><th style={{ width: 140 }}>Trigger at</th><th style={{ width: 140 }}>Severity</th><th>Notify</th></tr>
            </thead>
            <tbody>
              {config.burnAlerts.thresholds.map((t, i) => (
                <tr key={t.id}>
                  <td>{["First", "Second", "Final"][i] || "Level"}</td>
                  <td>
                    <NumInput value={t.pct} suffix="%" min={1} max={150}
                      onChange={(v) => {
                        const next = config.burnAlerts.thresholds.map((x, j) => j === i ? { ...x, pct: v } : x);
                        update({ ...config, burnAlerts: { ...config.burnAlerts, thresholds: next } });
                      }} />
                  </td>
                  <td>
                    <SelectInput value={t.severity}
                      onChange={(v) => {
                        const next = config.burnAlerts.thresholds.map((x, j) => j === i ? { ...x, severity: v } : x);
                        update({ ...config, burnAlerts: { ...config.burnAlerts, thresholds: next } });
                      }}
                      options={[
                        { value: "info", label: "Info" },
                        { value: "warn", label: "Warning" },
                        { value: "error", label: "Critical" },
                      ]} />
                  </td>
                  <td>
                    <ChipList items={t.notify} placeholder="Add a role or person…"
                      onChange={(v) => {
                        const next = config.burnAlerts.thresholds.map((x, j) => j === i ? { ...x, notify: v } : x);
                        update({ ...config, burnAlerts: { ...config.burnAlerts, thresholds: next } });
                      }} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>

        {/* Task catalog */}
        <Section title="Project task catalog"
          sub="The closed list of chargeable task codes workers pick at time entry. Reusable across every project."
          right={<Btn size="sm" onClick={() => update({ ...config, taskCatalog: [...config.taskCatalog, { id: "task-" + Date.now(), name: "New task", billable: true }] })}>+ Add task</Btn>}>
          <table className="prj-tbl">
            <thead>
              <tr><th>Task name</th><th style={{ width: 100 }}>Billable</th><th style={{ width: 100 }}></th></tr>
            </thead>
            <tbody>
              {config.taskCatalog.map((t, i) => (
                <tr key={t.id}>
                  <td>
                    <Input value={t.name}
                      onChange={(v) => {
                        const next = config.taskCatalog.map((x, j) => j === i ? { ...x, name: v } : x);
                        update({ ...config, taskCatalog: next });
                      }} />
                  </td>
                  <td>
                    <Toggle checked={t.billable}
                      onChange={(v) => {
                        const next = config.taskCatalog.map((x, j) => j === i ? { ...x, billable: v } : x);
                        update({ ...config, taskCatalog: next });
                      }} />
                  </td>
                  <td>
                    <Btn size="sm" tone="ghost"
                      onClick={() => update({ ...config, taskCatalog: config.taskCatalog.filter((_, j) => j !== i) })}>
                      Remove
                    </Btn>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>

        {/* Closeout */}
        <Section title="Project closeout policy"
          sub="What must be true before a project can transition to Closed. Drives the checks on the Manager's closeout panel.">
          <FieldGrid cols={2}>
            <Field label="All timesheets approved">
              <Toggle checked={config.closeout.requireAllTimesheetsApproved}
                onChange={(v) => update({ ...config, closeout: { ...config.closeout, requireAllTimesheetsApproved: v } })} />
            </Field>
            <Field label="All invoices paid">
              <Toggle checked={config.closeout.requireAllInvoicesPaid}
                onChange={(v) => update({ ...config, closeout: { ...config.closeout, requireAllInvoicesPaid: v } })} />
            </Field>
            <Field label="Milestones accepted" hint="Only fires on milestone billing.">
              <Toggle checked={config.closeout.requireMilestonesAccepted}
                onChange={(v) => update({ ...config, closeout: { ...config.closeout, requireMilestonesAccepted: v } })} />
            </Field>
            <Field label="Supplier acknowledge">
              <Toggle checked={config.closeout.requireSupplierAcknowledge}
                onChange={(v) => update({ ...config, closeout: { ...config.closeout, requireSupplierAcknowledge: v } })} />
            </Field>
            <Field label="Send supplier survey on close">
              <Toggle checked={config.closeout.sendSupplierSurvey}
                onChange={(v) => update({ ...config, closeout: { ...config.closeout, sendSupplierSurvey: v } })} />
            </Field>
            <Field label="Archive after" hint="Days post-close before audit-only state.">
              <NumInput value={config.closeout.archiveAfterDays} suffix="days" min={0} max={365}
                onChange={(v) => update({ ...config, closeout: { ...config.closeout, archiveAfterDays: v } })} />
            </Field>
          </FieldGrid>
        </Section>

        {/* Supplier visibility */}
        <Section title="Supplier burn visibility"
          sub="What suppliers see on the project burn view. Hidden keeps negotiation leverage; full invites proactive flagging.">
          <Segmented
            value={config.supplierBurnVisibility}
            onChange={(v) => update({ ...config, supplierBurnVisibility: v })}
            options={[
              { value: "hidden",  label: "Hidden" },
              { value: "summary", label: "Summary — % consumed only" },
              { value: "full",    label: "Full — budget, actuals, NTE proximity" },
            ]} />
        </Section>

        {/* Role permissions */}
        <Section title="Project role permissions"
          sub="Per-role capability matrix. Layers on top of Settings → Roles.">
          <div style={{ overflowX: "auto" }}>
            <table className="prj-tbl">
              <thead>
                <tr>
                  <th>Role</th>
                  <th style={{ width: 96 }}>Create</th>
                  <th style={{ width: 96 }}>Approve</th>
                  <th style={{ width: 96 }}>Amend</th>
                  <th style={{ width: 96 }}>Close</th>
                  <th style={{ width: 96 }}>View burn</th>
                  <th style={{ width: 96 }}>Swap workers</th>
                </tr>
              </thead>
              <tbody>
                {Object.keys(config.rolePerms).map((role) => (
                  <tr key={role}>
                    <td style={{ fontWeight: 600 }}>{role}</td>
                    {["create", "approve", "amend", "close", "viewBurn", "swapWorkers"].map((k) => (
                      <td key={k}>
                        <Toggle checked={config.rolePerms[role][k]}
                          onChange={() => {
                            const next = { ...config.rolePerms, [role]: { ...config.rolePerms[role], [k]: !config.rolePerms[role][k] } };
                            update({ ...config, rolePerms: next });
                          }} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      </div>
    );
  }
  function previewProjectId(c) {
    return (c.numberFormat || "")
      .replace("{prefix}", c.numberPrefix)
      .replace("{YYYY}", String(new Date().getFullYear()))
      .replace("{####}", String(c.nextSeq).padStart(4, "0"));
  }
  function Section({ title, sub, children, right }) {
    return (
      <section className="prj-admin-sec">
        <header className="prj-admin-sec-h">
          <div>
            <h4>{title}</h4>
            {sub && <p>{sub}</p>}
          </div>
          {right && <div>{right}</div>}
        </header>
        <div className="prj-admin-sec-b">{children}</div>
      </section>
    );
  }
  function DefRow({ k, v }) {
    return (
      <div className="prj-defrow">
        <dt>{k}</dt><dd>{v}</dd>
      </div>
    );
  }

  // ---------------------------------------------------------------
  // <ProjectIntakeFields/> — appended to the New Requisition form when
  // engType === "Project". Captures budget, NTE, currency, ext ID,
  // phase shape, and creates the Project record on commit.
  // ---------------------------------------------------------------
  function ProjectIntakeFields({ form, onChange }) {
    const config = useConfig();
    const f = form || {};
    function patch(p) { onChange({ ...f, ...p }); }

    // Lazy-fill defaults
    useEffect(() => {
      if (f.__seeded) return;
      patch({
        __seeded: true,
        currency: f.currency || "USD",
        budget: f.budget || 250000,
        nteAmount: f.nteAmount || 275000,
        ntePct: f.ntePct || 10,
        externalId: f.externalId || "",
        billingBasis: f.billingBasis || "Fixed",
      });
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    function computeNte(pct, budget) { return Math.round((budget || 0) * (1 + pct / 100)); }

    const tier = (config.budgetApprovalTiers || []).find((t) => t.lt === null || (f.budget || 0) < t.lt);

    return (
      <section className="prj-intake">
        <header className="prj-intake-h">
          <Pill tone="info">Project</Pill>
          <div>
            <h4>Project budget &amp; envelope</h4>
            <p>Required only when the Engagement type is Project. These fields create the underlying <code>ProjectBudget</code> record and route the requisition through the budget approval tiers.</p>
          </div>
        </header>
        <FieldGrid cols={3}>
          <Field label="External ID" hint={config.externalIdRequired ? "Required · Treasury CIP-YYYY-### format" : "Optional"}>
            <Input value={f.externalId || ""} mono placeholder="CIP-2026-…"
              onChange={(v) => patch({ externalId: v })} />
          </Field>
          <Field label="Currency">
            <SelectInput value={f.currency || "USD"} onChange={(v) => patch({ currency: v })}
              options={["USD", "EUR", "GBP", "CAD", "AUD"]} />
          </Field>
          <Field label="Billing basis">
            <SelectInput value={f.billingBasis || "Fixed"} onChange={(v) => patch({ billingBasis: v })}
              options={["Fixed", "Milestone"]} />
          </Field>
          <Field label="Budget">
            <MoneyInput value={f.budget} currency={f.currency || "USD"}
              onChange={(v) => patch({ budget: v, nteAmount: computeNte(f.ntePct || 0, v) })} />
          </Field>
          <Field label="NTE cushion" hint="% above budget. Bills above NTE auto-reject.">
            <NumInput value={f.ntePct} min={0} max={50} suffix="%"
              onChange={(v) => patch({ ntePct: v, nteAmount: computeNte(v, f.budget) })} />
          </Field>
          <Field label="NTE amount" hint="Computed from budget × cushion">
            <MoneyInput value={f.nteAmount} currency={f.currency || "USD"}
              onChange={(v) => patch({ nteAmount: v })} />
          </Field>
        </FieldGrid>
        <hr className="prj-hr" />
        <p className="prj-intake-route">
          <span className="prj-intake-route-l">Routes to</span>
          <span className="prj-intake-route-v">{(tier && tier.approvers || []).join(" · ")}</span>
          <span className="prj-intake-route-x">{tier && tier.lt === null ? "Above all thresholds" : tier ? `Tier ≤ ${fmtMoneyExact(tier.lt, f.currency)}` : ""}</span>
        </p>
      </section>
    );
  }

  // ---------------------------------------------------------------
  // <ProjectVariantBody/> — the detail page for a PRJ-* id, wired to
  // the unified detail router as a variant body.
  // ---------------------------------------------------------------
  function ProjectVariantBody({ requisitionId, onBack, row }) {
    const project = useProject(requisitionId);
    const config = useConfig();
    const [tab, setTab] = useState("burn");

    if (!project) {
      return (
        <main className="prj-main">
          <div className="prj-empty-state">
            <h3>Project not found</h3>
            <p>The requisition id <code>{requisitionId}</code> resolves to the Project channel, but no underlying project record exists yet.</p>
            <Btn onClick={onBack}>← Back</Btn>
          </div>
        </main>
      );
    }

    function update(next) { saveProject(next); }
    function setStateTo(s) {
      const next = {
        ...project, state: s,
        audit: [...(project.audit || []), {
          at: new Date().toISOString().slice(0, 16).replace("T", " "),
          by: "You (Manager)",
          action: `State → ${stateMeta(s).label}`,
          detail: "Manual transition from project header.",
        }],
      };
      update(next);
    }

    const allowed = TRANSITIONS[project.state] || [];

    return (
      <main className="prj-main">
        <header className="prj-detail-h">
          <div>
            <div className="prj-detail-h-meta">
              <button className="prj-back" onClick={onBack}>← All projects</button>
              <StatePill id={project.state} />
              <span className="prj-detail-h-id">{project.id} · {project.externalId || "no external ID"}</span>
            </div>
            <h1 className="prj-detail-h-name">{project.name}</h1>
            <div className="prj-detail-h-row">
              <span>Owner · <b>{project.ownerName}</b></span>
              <span>Supplier · <b>{project.supplierLabel}</b></span>
              <span>Currency · <b>{project.currency}</b></span>
              <span>Billing · <b>{project.billingBasis}</b></span>
            </div>
          </div>
          <div className="prj-detail-h-actions">
            {allowed.map((s) => (
              <Btn key={s} size="sm" tone={s === "cancelled" ? "danger" : "secondary"} onClick={() => setStateTo(s)}>
                → {stateMeta(s).label}
              </Btn>
            ))}
          </div>
        </header>

        <nav className="prj-tabs">
          {[
            { id: "burn",       label: "Burn dashboard" },
            { id: "roster",     label: "Roster",     count: project.roster?.length },
            { id: "timesheets", label: "Timesheets" },
            { id: "amendments", label: "Amendments", count: project.amendments?.length || undefined },
            { id: "reports",    label: "Status reports", count: project.statusReports?.length || undefined },
            { id: "documents",  label: "Documents",  count: project.documents?.length },
            { id: "comments",   label: "Comments",   count: project.comments?.length || undefined },
            { id: "audit",      label: "Audit" },
            { id: "closeout",   label: "Closeout" },
          ].map((t) => (
            <button key={t.id} className={`prj-tab${tab === t.id ? " is-on" : ""}`} onClick={() => setTab(t.id)}>
              {t.label}{t.count !== undefined && <span className="prj-tab-c">{t.count}</span>}
            </button>
          ))}
        </nav>

        {tab === "burn"       && <BurnDashboardTab project={project} />}
        {tab === "roster"     && <RosterTab project={project} config={config} onUpdate={update} />}
        {tab === "timesheets" && <TimesheetsTab project={project} onUpdate={update} />}
        {tab === "amendments" && <AmendmentsTab project={project} config={config} onUpdate={update} />}
        {tab === "reports"    && <StatusReportTab project={project} config={config} onUpdate={update} />}
        {tab === "documents"  && <DocumentsTab project={project} onUpdate={update} />}
        {tab === "comments"   && <CommentsTab project={project} onUpdate={update} />}
        {tab === "audit"      && <AuditTab project={project} />}
        {tab === "closeout"   && <CloseoutTab project={project} config={config} onUpdate={update} />}
      </main>
    );
  }

  // ---- detail tabs ------------------------------------------------
  function BurnDashboardTab({ project }) {
    const actual = projectActualSpend(project);
    const burnP = projectBurnPct(project);
    const nteP = projectNtePct(project);
    return (
      <div>
        <div className="prj-stats">
          <Stat l="Spent"           v={fmtMoney(actual, project.currency)}
            d={`${fmtPct(burnP, 0)} of ${fmtMoney(project.budget, project.currency)} budget`} />
          <Stat l="Remaining"       v={fmtMoney(project.budget - actual, project.currency)}
            d={`${fmtPct(nteP, 0)} against NTE ${fmtMoney(project.nte, project.currency)}`} />
          <Stat l="Hours logged"    v={fmtHours(totalRosterHours(project))}
            d={`of ${fmtHours(totalPlannedHours(project))} planned`} />
          <Stat l="Days remaining"  v={daysRemaining(project)}
            d={`Ends ${fmtDate(project.endDate)}`} />
        </div>
        <Card title="Cumulative spend against plan"
          sub="Solid line is actual; dashed grey is planned.">
          <BurnChart data={project.burnLedger} ccy={project.currency} />
        </Card>
        <Card title="Phase outline"
          sub={`${project.phases.length} phases · ${fmtMoney(project.phases.reduce((a, p) => a + p.budget, 0), project.currency)} aggregated phase budget.`}>
          <div className="prj-phases">
            {project.phases.map((phase) => {
              const totalWeeks = Math.max(...project.phases.map((p) => p.endWeek));
              const startPct = ((phase.startWeek - 1) / totalWeeks) * 100;
              const widthPct = ((phase.endWeek - phase.startWeek + 1) / totalWeeks) * 100;
              return (
                <div key={phase.id} className="prj-phase">
                  <div>
                    <div className="prj-phase-name">{phase.name}</div>
                    <div className="prj-phase-sub">W{phase.startWeek}–{phase.endWeek}</div>
                  </div>
                  <div className="prj-phase-bar">
                    <div className="prj-phase-bar-fill" style={{ left: `${startPct}%`, width: `${widthPct}%` }} />
                  </div>
                  <div className="prj-phase-amt">{fmtMoney(phase.budget, project.currency)}</div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>
    );
  }

  function RosterTab({ project, config, onUpdate }) {
    const [swap, setSwap] = useState(null);
    const [reviewOpen, setReviewOpen] = useState(false);
    function reassign(workerId, taskId) {
      onUpdate({
        ...project,
        roster: project.roster.map((r) => r.workerId === workerId ? { ...r, taskId } : r),
        audit: [...(project.audit || []), {
          at: new Date().toISOString().slice(0, 16).replace("T", " "),
          by: "You (Manager)",
          action: "Task re-assignment",
          detail: `${project.roster.find((r) => r.workerId === workerId).name} → ${config.taskCatalog.find((t) => t.id === taskId).name}`,
        }],
      });
    }
    function endDate(workerId) {
      onUpdate({
        ...project,
        roster: project.roster.map((r) => r.workerId === workerId ? { ...r, endDate: new Date().toISOString().slice(0, 10) } : r),
        audit: [...(project.audit || []), {
          at: new Date().toISOString().slice(0, 16).replace("T", " "),
          by: "You (Manager)",
          action: "Worker end-dated",
          detail: project.roster.find((r) => r.workerId === workerId).name,
        }],
      });
    }
    return (
      <Card title={`${project.roster.length} workers on this project`}
        sub="One row per named worker. End-date, swap, or move between tasks."
        right={<>
          {project.teamProposal && project.teamProposal.submitted && (
            <Btn size="sm" tone="secondary" onClick={() => setReviewOpen(true)}>Review supplier proposal</Btn>
          )}
          <Btn size="sm" tone="primary">+ Add worker</Btn>
        </>}>
        <table className="prj-tbl">
          <thead>
            <tr>
              <th>Worker</th><th>Task</th><th className="prj-num">Alloc</th><th className="prj-num">Hours</th>
              <th style={{ width: 180 }}>Progress</th><th>Dates</th><th style={{ width: 200 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {project.roster.map((r) => {
              const pct = r.plannedHours ? (r.hoursToDate / r.plannedHours) * 100 : 0;
              return (
                <tr key={r.workerId}>
                  <td>
                    <div className="prj-with-avatar">
                      <Avatar name={r.name} />
                      <div>
                        <div className="prj-name">{r.name}</div>
                        <div className="prj-sub">{r.role}</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <SelectInput value={r.taskId} onChange={(v) => reassign(r.workerId, v)}
                      options={config.taskCatalog.map((t) => ({ value: t.id, label: t.name }))} />
                  </td>
                  <td className="prj-num">{r.allocPct}%</td>
                  <td className="prj-num">{r.hoursToDate} / {r.plannedHours}</td>
                  <td>
                    <Progress value={pct} max={100} />
                    <div className="prj-prog-sub">{fmtPct(pct, 0)} of plan</div>
                  </td>
                  <td>
                    <div className="prj-mono">{fmtDateShort(r.startDate)}<div className="prj-sub">→ {fmtDateShort(r.endDate)}</div></div>
                  </td>
                  <td>
                    <Btn size="sm" tone="ghost" onClick={() => setSwap(r.workerId)}>Swap</Btn>
                    <Btn size="sm" tone="ghost" onClick={() => endDate(r.workerId)}>End-date</Btn>
                  </td>
                </tr>
              );
            })}
            {project.roster.length === 0 && (
              <tr><td colSpan={7}><div className="prj-empty">No workers on this project yet. Add the first to start tracking.</div></td></tr>
            )}
          </tbody>
        </table>
        <ResourceSwapModal
          project={project} config={config}
          workerId={swap} tenantRole="manager"
          onClose={() => setSwap(null)} />
        <TeamProposalReviewModal
          project={project} open={reviewOpen} onClose={() => setReviewOpen(false)} />
      </Card>
    );
  }

  function TimesheetsTab({ project, onUpdate }) {
    const ledger = project.burnLedger || [];
    const weeks = ledger.slice(Math.max(0, ledger.length - 6)).map((c, i, arr) => {
      const prev = arr[i - 1] || (ledger[ledger.indexOf(c) - 1]);
      const weekActual = c.actual - (prev ? prev.actual : 0);
      const weekPlanned = c.planned - (prev ? prev.planned : 0);
      return {
        week: c.week,
        actual: weekActual, planned: weekPlanned,
        hours: Math.round(weekActual / 165),
        state: i === arr.length - 1 ? "pending" : "approved",
      };
    }).reverse();

    return (
      <Card title="Project timesheets (consolidated weekly)"
        sub="One consolidated weekly burn per project — approve the week and every worker's individual time clears alongside it.">
        <table className="prj-tbl">
          <thead><tr><th>Week</th><th className="prj-num">Hours</th><th className="prj-num">Burn</th><th className="prj-num">vs plan</th><th>State</th><th></th></tr></thead>
          <tbody>
            {weeks.map((w) => (
              <tr key={w.week}>
                <td><b>Week {w.week}</b></td>
                <td className="prj-num">{fmtHours(w.hours)}</td>
                <td className="prj-num">{fmtMoneyExact(w.actual, project.currency)}</td>
                <td className="prj-num" style={{ color: w.actual > w.planned ? "var(--evr-red-500)" : "var(--evr-green-600)" }}>
                  {w.actual > w.planned ? "+" : ""}{fmtMoney(w.actual - w.planned, project.currency)}
                </td>
                <td><Pill tone={w.state === "approved" ? "ok" : "watch"}>{w.state}</Pill></td>
                <td className="prj-num">
                  {w.state === "pending" && <Btn size="sm" tone="primary">Approve</Btn>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    );
  }

  function AmendmentsTab({ project, config, onUpdate }) {
    const [open, setOpen] = useState(false);
    const [form, setForm] = useState({
      reason: (config.changeOrder.reasonCodes && config.changeOrder.reasonCodes[0]) || "Scope add",
      deltaBudget: 0, deltaWeeks: 0, justification: "",
    });
    function deltaPct() { return project.budget ? ((form.deltaBudget || 0) / project.budget) * 100 : 0; }
    function route() {
      const pct = Math.abs(deltaPct());
      const co = config.changeOrder;
      if (pct <= co.autoApprovePctMax) return { tone: "ok", text: `Auto-approve · within ${co.autoApprovePctMax}% threshold` };
      if (pct <= co.managerApprovePctMax) return { tone: "watch", text: `Manager approval · ${co.autoApprovePctMax}–${co.managerApprovePctMax}%` };
      return { tone: "warn", text: `Full re-approval · above ${co.managerApprovePctMax}%` };
    }
    function submit() {
      if (mode === "realloc") {
        if (!realloc.fromPhaseId || !realloc.toPhaseId || realloc.fromPhaseId === realloc.toPhaseId) return;
        const amt = Number(realloc.amount) || 0;
        if (amt <= 0) return;
        const fromName = (phases.find((p) => p.id === realloc.fromPhaseId) || {}).name || realloc.fromPhaseId;
        const toName = (phases.find((p) => p.id === realloc.toPhaseId) || {}).name || realloc.toPhaseId;
        const next = {
          ...project,
          // Move budget across phases
          phases: phases.map((p) => {
            if (p.id === realloc.fromPhaseId) return { ...p, budget: p.budget - amt };
            if (p.id === realloc.toPhaseId)   return { ...p, budget: p.budget + amt };
            return p;
          }),
          amendments: [...(project.amendments || []), {
            id: "AMD-" + String((project.amendments || []).length + 1).padStart(3, "0"),
            state: "approved",
            reason: "Phase reallocation",
            deltaBudget: 0, deltaWeeks: 0,
            fromPhaseId: realloc.fromPhaseId, toPhaseId: realloc.toPhaseId, amount: amt,
            justification: realloc.justification || `Move ${fmtMoneyExact(amt, project.currency)} from ${fromName} to ${toName}.`,
            submittedBy: "You (Manager)", submittedAt: new Date().toISOString().slice(0, 10),
            approvedBy: ["Auto-approve (within total budget)"], approvedAt: new Date().toISOString().slice(0, 10),
          }],
          audit: _appendAudit(project, "Phase budget reallocated",
            `${fromName} → ${toName} · ${fmtMoneyExact(amt, project.currency)}`, "You (Manager)"),
        };
        onUpdate(next);
        setOpen(false);
        setRealloc({ fromPhaseId: phases[0] && phases[0].id, toPhaseId: phases[1] && phases[1].id, amount: 0, justification: "" });
        return;
      }
      if (config.changeOrder.requireJustification && !form.justification.trim()) return;
      const r = route();
      const next = {
        ...project,
        amendments: [...(project.amendments || []), {
          id: "AMD-" + String((project.amendments || []).length + 1).padStart(3, "0"),
          state: r.tone === "ok" ? "approved" : "pending",
          ...form,
          submittedBy: "You (Manager)", submittedAt: new Date().toISOString().slice(0, 10),
          approvedBy: r.tone === "ok" ? ["Auto-approve"] : [],
          approvedAt: r.tone === "ok" ? new Date().toISOString().slice(0, 10) : null,
        }],
        audit: [...(project.audit || []), {
          at: new Date().toISOString().slice(0, 16).replace("T", " "),
          by: "You (Manager)", action: "Amendment submitted",
          detail: `${form.reason} · ${form.deltaBudget >= 0 ? "+" : ""}${fmtMoneyExact(form.deltaBudget, project.currency)} · ${r.text}`,
        }],
      };
      onUpdate(next);
      setOpen(false);
      setForm({ reason: config.changeOrder.reasonCodes[0], deltaBudget: 0, deltaWeeks: 0, justification: "" });
    }
    const r = route();
    return (
      <Card title={`${(project.amendments || []).length} amendment${(project.amendments || []).length === 1 ? "" : "s"} on this project`}
        sub="Budget, date, or scope changes. Each amendment routes through the policy in Settings → Configuration → Project."
        right={<Btn size="sm" tone="primary" onClick={() => setOpen(true)}>+ Submit change order</Btn>}>
        {(project.amendments || []).length === 0
          ? <div className="prj-empty">No amendments yet. Submit one when budget or dates need to change.</div>
          : (project.amendments || []).map((a) => (
            <article key={a.id} className="prj-amendment">
              <header>
                <div>
                  <div className="prj-amendment-id">{a.id} · {a.reason}</div>
                  <div className="prj-amendment-delta">
                    {a.deltaBudget !== 0 && <span>{a.deltaBudget > 0 ? "+" : ""}{fmtMoneyExact(a.deltaBudget, project.currency)}</span>}
                    {a.deltaBudget !== 0 && a.deltaWeeks !== 0 && <span> · </span>}
                    {a.deltaWeeks !== 0 && <span>{a.deltaWeeks > 0 ? "+" : ""}{a.deltaWeeks} week{Math.abs(a.deltaWeeks) === 1 ? "" : "s"}</span>}
                    {a.deltaBudget === 0 && a.deltaWeeks === 0 && <span>Scope-only change</span>}
                  </div>
                </div>
                <Pill tone={a.state === "approved" ? "ok" : a.state === "pending" ? "watch" : "danger"}>{a.state}</Pill>
              </header>
              <p>{a.justification}</p>
              <footer>
                <span>Submitted · <b>{a.submittedBy}</b> · {fmtDate(a.submittedAt)}</span>
                <span>{a.approvedAt ? <>Approved · <b>{a.approvedBy.join(", ")}</b> · {fmtDate(a.approvedAt)}</> : "Pending approval"}</span>
              </footer>
            </article>
          ))}
        <Modal open={open} onClose={() => setOpen(false)} title="Submit change order" size="lg"
          footer={<>
            <Btn tone="secondary" onClick={() => setOpen(false)}>Cancel</Btn>
            <Btn tone="primary" onClick={submit}>Submit</Btn>
          </>}>
          <div style={{ marginBottom: 14 }}>
            <Segmented value={mode} onChange={setMode}
              options={[
                { value: "delta",   label: "Budget / schedule delta" },
                { value: "realloc", label: "Phase budget reallocation" },
              ]} />
          </div>
          {mode === "delta" ? (
            <>
              <FieldGrid cols={2}>
                <Field label="Reason" span={2}>
                  <SelectInput value={form.reason} onChange={(v) => setForm({ ...form, reason: v })}
                    options={config.changeOrder.reasonCodes} />
                </Field>
                <Field label="Budget delta" hint="Positive to add. Negative to release.">
                  <MoneyInput value={form.deltaBudget} currency={project.currency}
                    onChange={(v) => setForm({ ...form, deltaBudget: v })} />
                </Field>
                <Field label="Schedule delta" hint="Weeks. Positive extends; negative compresses.">
                  <NumInput value={form.deltaWeeks} min={-26} max={52} suffix="wks"
                    onChange={(v) => setForm({ ...form, deltaWeeks: v })} />
                </Field>
                <Field label="Justification" span={2} hint={config.changeOrder.requireJustification ? "Required by policy" : "Optional"}>
                  <textarea className="prj-input" rows={4} value={form.justification}
                    onChange={(e) => setForm({ ...form, justification: e.target.value })}
                    placeholder="What changed and why…" />
                </Field>
              </FieldGrid>
              <hr className="prj-hr" />
              <div className="prj-route">
                <Pill tone={r.tone}>{fmtPct(Math.abs(deltaPct()), 1)} of budget</Pill>
                <span>{r.text}</span>
              </div>
            </>
          ) : (
            <>
              <p style={{ marginTop: 0, fontSize: 13, color: "var(--evr-content-primary-default)" }}>
                Move under-spent budget between phases without changing total. Auto-approves because total budget is unchanged.
              </p>
              <FieldGrid cols={3}>
                <Field label="From phase">
                  <SelectInput value={realloc.fromPhaseId}
                    onChange={(v) => setRealloc({ ...realloc, fromPhaseId: v })}
                    options={phases.map((p) => ({ value: p.id, label: `${p.name} · ${fmtMoney(p.budget, project.currency)}` }))} />
                </Field>
                <Field label="To phase">
                  <SelectInput value={realloc.toPhaseId}
                    onChange={(v) => setRealloc({ ...realloc, toPhaseId: v })}
                    options={phases.map((p) => ({ value: p.id, label: `${p.name} · ${fmtMoney(p.budget, project.currency)}` }))} />
                </Field>
                <Field label="Amount">
                  <MoneyInput value={realloc.amount} currency={project.currency}
                    onChange={(v) => setRealloc({ ...realloc, amount: v })} />
                </Field>
                <Field label="Justification" span={3}>
                  <textarea className="prj-input" rows={3} value={realloc.justification}
                    placeholder="Why move budget across phases…"
                    onChange={(e) => setRealloc({ ...realloc, justification: e.target.value })} />
                </Field>
              </FieldGrid>
            </>
          )}
        </Modal>
      </Card>
    );
  }

  function DocumentsTab({ project, onUpdate }) {
    function add() {
      onUpdate({
        ...project,
        documents: [...(project.documents || []), {
          id: "d" + Date.now(),
          name: "New attachment.pdf", sizeKB: 240, kind: "Other",
          uploadedBy: "You (Manager)", uploadedAt: new Date().toISOString().slice(0, 10),
        }],
      });
    }
    return (
      <Card title={`${(project.documents || []).length} files attached`}
        sub="Anything project-scoped. Drops live alongside the audit log."
        right={<Btn size="sm" onClick={add}>+ Upload</Btn>}>
        <table className="prj-tbl">
          <thead><tr><th>File</th><th>Kind</th><th>Uploaded by</th><th>Date</th><th className="prj-num">Size</th></tr></thead>
          <tbody>
            {(project.documents || []).length === 0
              ? <tr><td colSpan={5}><div className="prj-empty">No documents yet.</div></td></tr>
              : (project.documents).map((d) => (
                <tr key={d.id}>
                  <td><b>{d.name}</b></td><td><Pill tone="neutral">{d.kind}</Pill></td>
                  <td>{d.uploadedBy}</td><td>{fmtDate(d.uploadedAt)}</td>
                  <td className="prj-num">{d.sizeKB} KB</td>
                </tr>
              ))}
          </tbody>
        </table>
      </Card>
    );
  }

  function CommentsTab({ project, onUpdate }) {
    const [draft, setDraft] = useState("");
    function post() {
      if (!draft.trim()) return;
      onUpdate({
        ...project,
        comments: [...(project.comments || []), {
          id: "c" + Date.now(), author: "You (Manager)",
          at: new Date().toISOString().slice(0, 10), body: draft.trim(),
        }],
      });
      setDraft("");
    }
    return (
      <Card title="Conversation thread"
        sub="One thread per project. Manager, supplier, internal stakeholders.">
        {(project.comments || []).length === 0
          ? <div className="prj-empty">No comments yet. Start the thread to keep decisions out of email.</div>
          : <div className="prj-comments">
              {project.comments.map((c) => (
                <div key={c.id} className="prj-comment">
                  <Avatar name={c.author} />
                  <div>
                    <div className="prj-comment-meta"><b>{c.author}</b> · {fmtDate(c.at)}</div>
                    <p>{c.body}</p>
                  </div>
                </div>
              ))}
            </div>}
        <div className="prj-comment-form">
          <textarea className="prj-input" rows={3} value={draft}
            onChange={(e) => setDraft(e.target.value)} placeholder="Add a note…" />
          <Btn tone="primary" size="sm" onClick={post}>Post comment</Btn>
        </div>
      </Card>
    );
  }

  function AuditTab({ project }) {
    return (
      <Card title="Audit trail"
        sub="Every state change, amendment, and roster action. Append-only.">
        <table className="prj-tbl">
          <thead><tr><th style={{ width: 160 }}>When</th><th style={{ width: 180 }}>Who</th><th style={{ width: 220 }}>Action</th><th>Detail</th></tr></thead>
          <tbody>
            {[...(project.audit || [])].reverse().map((a, i) => (
              <tr key={i}>
                <td className="prj-mono prj-sub">{a.at}</td>
                <td>{a.by}</td>
                <td><b>{a.action}</b></td>
                <td>{a.detail}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    );
  }

  function CloseoutTab({ project, config, onUpdate }) {
    const co = config.closeout;
    const supplierAcked = !!project.supplierClosed;
    const checks = [
      { id: "ts",  label: "All timesheets approved",  on: co.requireAllTimesheetsApproved, met: project.state === "closing" || project.state === "closed" },
      { id: "inv", label: "All invoices paid",        on: co.requireAllInvoicesPaid,       met: project.state === "closed" },
      { id: "ms",  label: "Milestones accepted",      on: co.requireMilestonesAccepted,    met: project.billingBasis !== "Milestone" || project.state === "closed" },
      { id: "ack", label: "Supplier acknowledgement", on: co.requireSupplierAcknowledge,   met: supplierAcked || project.state === "closed" },
    ].filter((c) => c.on);
    const ready = checks.every((c) => c.met);
    function close() {
      onUpdate({
        ...project, state: "closed",
        audit: _appendAudit(project, "State → Closed", "Manager closeout sign-off.", "You (Manager)"),
      });
    }
    return (
      <Card title="Two-party closeout"
        sub="Manager confirms deliverables; supplier confirms no further billing. Both required before the lifecycle flips to Closed.">
        <table className="prj-tbl">
          <thead><tr><th>Precondition</th><th style={{ width: 140 }}>State</th></tr></thead>
          <tbody>
            {checks.map((c) => (
              <tr key={c.id}><td>{c.label}</td>
                <td><Pill tone={c.met ? "ok" : "warn"}>{c.met ? "Met" : "Not met"}</Pill></td>
              </tr>
            ))}
          </tbody>
        </table>
        {supplierAcked && (
          <div className="prj-closeout-ack">
            <Pill tone="ok">Supplier acknowledged</Pill>
            <span>{project.supplierClosed.ackBy} · {fmtDate(project.supplierClosed.ackAt)}</span>
            {project.supplierClosed.note && <p>{project.supplierClosed.note}</p>}
          </div>
        )}
        <hr className="prj-hr" />
        <div className="prj-closeout-foot">
          <span>
            {project.state === "closed" ? `Closed. Archives in ${co.archiveAfterDays} days.` :
              ready ? "All preconditions met. Ready to sign off." :
                "Resolve the items above to enable sign-off."}
          </span>
          <Btn tone="primary" disabled={!ready || project.state === "closed"} onClick={close}>
            {project.state === "closed" ? "Already closed" : "Sign off & close"}
          </Btn>
        </div>
      </Card>
    );
  }

  function Card({ title, sub, right, children }) {
    return (
      <section className="prj-card">
        <header className="prj-card-h">
          <div>
            <h4>{title}</h4>
            {sub && <p>{sub}</p>}
          </div>
          {right && <div className="prj-card-right">{right}</div>}
        </header>
        <div className="prj-card-b">{children}</div>
      </section>
    );
  }
  function Stat({ l, v, d }) {
    return (
      <div className="prj-stat">
        <div className="prj-stat-l">{l}</div>
        <div className="prj-stat-v">{v}</div>
        <div className="prj-stat-d">{d}</div>
      </div>
    );
  }

  // ---------------------------------------------------------------
  // <AgencyProjectsTab/> — used by agency-pro.jsx. Shows pending team-
  // proposal requests + active projects from the supplier perspective.
  // ---------------------------------------------------------------
  function AgencyProjectsTab() {
    if (!useProjectOn()) return null;
    const projects = useProjects();
    const config = useConfig();
    // For demo: filter to projects whose supplier is the agency tenant
    // (Acme Professional == "ap" in fixtures). Real wiring would resolve
    // the agency's own supplier id.
    const mine = projects.filter((p) => p.supplier === "ap" || p.teamProposal);
    const pending = mine.filter((p) => p.teamProposal && !p.teamProposal.submitted);
    const active = mine.filter((p) => p.state === "active");

    return (
      <div className="prj-agency">
        <header className="prj-agency-h">
          <Pill tone="info">Project</Pill>
          <div>
            <h3>Projects</h3>
            <p>Project engagements assigned to your agency. Submit team proposals on open requests, manage your active roster, and submit consolidated weekly burn.</p>
          </div>
        </header>

        {pending.length > 0 && (
          <Section title={`${pending.length} open team-proposal request${pending.length === 1 ? "" : "s"}`}
            sub="Each requires you to propose a team of named workers against the budget envelope.">
            <div className="prj-agency-list">
              {pending.map((p) => <PendingProposalCard key={p.id} project={p} config={config} />)}
            </div>
          </Section>
        )}

        <Section title={`${active.length} active project${active.length === 1 ? "" : "s"}`}>
          {active.length === 0
            ? <div className="prj-empty">No active projects assigned. Open requests appear above.</div>
            : <div className="prj-agency-list">
                {active.map((p) => <ActiveAgencyProjectCard key={p.id} project={p} config={config} />)}
              </div>}
        </Section>
      </div>
    );
  }
  function PendingProposalCard({ project, config }) {
    const [open, setOpen] = useState(false);
    const [entries, setEntries] = useState({});
    const setEntry = (key, patch) => setEntries((e) => ({ ...e, [key]: { ...(e[key] || {}), ...patch } }));
    const _rows = project.teamProposal.teamShape.flatMap((r, ri) =>
      Array.from({ length: r.count }).map((_, ci) => ({ key: ri + "-" + ci, role: r.role, plannedHours: r.plannedHours, allocPct: r.allocPct })));
    const _blended = _rows.reduce((s, row) => { const e = entries[row.key] || {}; return s + (Number(e.rate) || 0) * (row.plannedHours || 0); }, 0);
    const _overBudget = _blended > project.budget;
    const _credFor = (name) => {
      if (!name || !name.trim() || !window.AssignmentEngine) return null;
      const q = name.trim().toLowerCase();
      const w = (window.WORKERS || []).find((x) => (x.name || "").toLowerCase().includes(q) || q.includes((x.name || "").toLowerCase().split(" ")[0]));
      return w ? window.AssignmentEngine.credentialSummary(w) : null;
    };
    function submit() {
      const next = {
        ...project,
        teamProposal: { ...project.teamProposal, submitted: new Date().toISOString().slice(0, 10) },
        audit: [...(project.audit || []), {
          at: new Date().toISOString().slice(0, 16).replace("T", " "),
          by: "Agency",
          action: "Team proposal submitted",
          detail: `${project.teamProposal.teamShape.reduce((a, t) => a + t.count, 0)} candidates`,
        }],
      };
      saveProject(next);
      setOpen(false);
    }
    return (
      <article className="prj-agency-card prj-agency-card--pending">
        <header>
          <div>
            <Pill tone="watch">Team proposal due</Pill>
            <h4>{project.name}</h4>
            <div className="prj-agency-card-meta">
              <span>{project.id}</span>
              <span>Due {fmtDate(project.teamProposal.due)}</span>
              <span>Budget envelope · {fmtMoneyExact(project.budget, project.currency)}</span>
            </div>
          </div>
          <Btn tone="primary" size="sm" onClick={() => setOpen(true)}>Propose team</Btn>
        </header>
        <div className="prj-agency-card-body">
          <p className="prj-agency-card-shape-l">Team shape requested</p>
          <ul className="prj-agency-card-shape">
            {project.teamProposal.teamShape.map((r, i) => (
              <li key={i}>
                <b>{r.count}× {r.role}</b>
                <span> · {r.allocPct}% allocation · {r.plannedHours} h planned</span>
              </li>
            ))}
          </ul>
        </div>
        <Modal open={open} onClose={() => setOpen(false)} title="Propose team" size="lg"
          footer={<>
            <Btn tone="secondary" onClick={() => setOpen(false)}>Cancel</Btn>
            <Btn tone="primary" onClick={submit} disabled={_overBudget}>Submit proposal</Btn>
          </>}>
          <p>Propose named workers for each requested role. The buyer reviews them side-by-side and accepts the team or specific workers.</p>
          <div className={"prj-budget-check" + (_overBudget ? " prj-budget-check--over" : "")}>
            <span>Blended cost <b>{fmtMoneyExact(_blended, project.currency)}</b> of {fmtMoneyExact(project.budget, project.currency)} envelope</span>
            <span className="prj-budget-check-state">{_overBudget ? "Over budget — trim rates or hours before submitting" : "Within envelope"}</span>
          </div>
          <div className="prj-proposal-grid">
            {_rows.map((row) => {
              const e = entries[row.key] || {};
              const cred = _credFor(e.name);
              return (
                <div key={row.key} className="prj-proposal-row">
                  <div className="prj-proposal-role">
                    <Pill tone="info">{row.role}</Pill>
                    <span>{row.allocPct}% · {row.plannedHours} h</span>
                    {cred && (
                      <span className={"prj-cred-chip prj-cred-chip--" + cred.level}>
                        <Icon name={cred.level === "fail" ? "ShieldOff" : cred.level === "warn" ? "Alert" : "ShieldPerson"} size={12} />
                        {cred.label}
                      </span>
                    )}
                  </div>
                  <FieldGrid cols={3}>
                    <Field label="Candidate"><Input placeholder="Name" value={e.name || ""} onChange={(v) => setEntry(row.key, { name: v })} /></Field>
                    <Field label="Rate"><NumInput value={e.rate ?? null} suffix={"/hr"} onChange={(v) => setEntry(row.key, { rate: v })} /></Field>
                    <Field label="Start"><Input value={e.start || project.startDate} onChange={(v) => setEntry(row.key, { start: v })} /></Field>
                  </FieldGrid>
                </div>
              );
            })}
          </div>
        </Modal>
      </article>
    );
  }
  function ActiveAgencyProjectCard({ project, config }) {
    const burnP = projectBurnPct(project);
    const visibility = config.supplierBurnVisibility;
    const [tsOpen, setTsOpen] = useState(false);
    const [amdOpen, setAmdOpen] = useState(false);
    const [swapTarget, setSwapTarget] = useState(null);
    const [closeoutOpen, setCloseoutOpen] = useState(false);
    return (
      <article className="prj-agency-card">
        <header>
          <div>
            <StatePill id={project.state} />
            <h4>{project.name}</h4>
            <div className="prj-agency-card-meta">
              <span>{project.id}</span>
              <span>Started {fmtDate(project.startDate)}</span>
              <span>{project.roster.length} workers on roster</span>
              {project.supplierClosed && <Pill tone="ok">Closeout acknowledged</Pill>}
            </div>
          </div>
        </header>
        {visibility !== "hidden" && (
          <div className="prj-agency-card-body">
            {visibility === "summary"
              ? <p className="prj-agency-card-summary">
                  <b>{fmtPct(burnP, 0)}</b> of budget consumed
                </p>
              : <>
                  <Progress value={burnP} max={100} />
                  <div className="prj-agency-card-burn">
                    <span><b>{fmtMoney(projectActualSpend(project), project.currency)}</b> spent</span>
                    <span>of {fmtMoney(project.budget, project.currency)} budget</span>
                    <span>NTE {fmtMoney(project.nte, project.currency)}</span>
                  </div>
                </>}
          </div>
        )}
        <footer className="prj-agency-card-foot">
          <Btn size="sm" onClick={() => setTsOpen(true)}>Weekly time roll-up</Btn>
          <Btn size="sm" tone="ghost" onClick={() => setAmdOpen(true)}>Submit amendment</Btn>
          <Btn size="sm" tone="ghost" disabled={!project.roster.length}
            onClick={() => project.roster[0] && setSwapTarget(project.roster[0].workerId)}>
            Resource swap
          </Btn>
          {(project.state === "closing" || project.state === "active") && !project.supplierClosed && (
            <Btn size="sm" tone="ghost" onClick={() => setCloseoutOpen(true)}>Closeout acknowledge</Btn>
          )}
        </footer>
        <AgencyConsolidatedTimesheet
          project={project} config={config} open={tsOpen} onClose={() => setTsOpen(false)} />
        <AgencyAmendmentModal
          project={project} config={config} open={amdOpen} onClose={() => setAmdOpen(false)} />
        <ResourceSwapModal
          project={project} config={config} workerId={swapTarget} tenantRole="supplier"
          onClose={() => setSwapTarget(null)} />
        <AgencyCloseoutModal
          project={project} open={closeoutOpen} onClose={() => setCloseoutOpen(false)} />
      </article>
    );
  }

  // ---------------------------------------------------------------
  // <WorkerProjectScreen/> — embedded into worker-mobile under a
  // "Projects" entry. Shows the worker's assigned projects + lets them
  // log time per task code, view hours remaining, and ack scope.
  // ---------------------------------------------------------------
  function WorkerProjectScreen({ workerName, onBack }) {
    if (!useProjectOn()) {
      return (
        <div className="wm-project-empty">
          <h3>Projects are off</h3>
          <p>This tenant has the Project engagement type disabled. Ask your admin to enable it under Settings → Configuration → Engagement types.</p>
        </div>
      );
    }
    const projects = useProjects();
    const config = useConfig();
    const [openId, setOpenId] = useState(null);
    // For demo: derive worker projects by matching name prefix against
    // any roster entry across all projects.
    const mine = projects.filter((p) => (p.roster || []).some((r) =>
      (workerName || "Maya").split(/\s+/)[0].toLowerCase() === r.name.split(/\s+/)[0].toLowerCase()
    ));
    const project = openId && projects.find((p) => p.id === openId);
    const myRoster = project && project.roster.find((r) =>
      (workerName || "Maya").split(/\s+/)[0].toLowerCase() === r.name.split(/\s+/)[0].toLowerCase()
    );

    if (project && myRoster) {
      return <WorkerProjectDetail project={project} myRoster={myRoster} config={config} onBack={() => setOpenId(null)} />;
    }
    return (
      <div className="wm-projects">
        <h3 className="wm-projects-h">My projects</h3>
        {mine.length === 0
          ? <div className="wm-projects-empty">
              <p>No project assignments yet. Project work appears here when your agency assigns you to one.</p>
            </div>
          : mine.map((p) => {
              const r = p.roster.find((x) =>
                (workerName || "Maya").split(/\s+/)[0].toLowerCase() === x.name.split(/\s+/)[0].toLowerCase()
              );
              const pct = r.plannedHours ? (r.hoursToDate / r.plannedHours) * 100 : 0;
              return (
                <button key={p.id} className="wm-project-card" onClick={() => setOpenId(p.id)}>
                  <div className="wm-project-card-h">
                    <span className="wm-project-state"><StatePill id={p.state} /></span>
                    <span className="wm-project-id">{p.id}</span>
                  </div>
                  <div className="wm-project-card-name">{p.name}</div>
                  <div className="wm-project-card-role">{r.role} · {r.allocPct}%</div>
                  <Progress value={pct} max={100} />
                  <div className="wm-project-card-h2">
                    <span>{r.hoursToDate} h logged</span>
                    <span>of {r.plannedHours} h planned</span>
                  </div>
                </button>
              );
            })}
      </div>
    );
  }
  function WorkerProjectDetail({ project, myRoster, config, onBack }) {
    const [tab, setTab] = useState("time");
    const [ack, setAck] = useState(false);
    return (
      <div className="wm-project-detail">
        <header className="wm-project-detail-h">
          <button className="wm-project-back" onClick={onBack}>←</button>
          <div>
            <div className="wm-project-id">{project.id}</div>
            <div className="wm-project-name">{project.name}</div>
            <div className="wm-project-meta">{myRoster.role} · {myRoster.allocPct}% · {project.supplierLabel}</div>
          </div>
        </header>
        <div className="wm-tabs">
          {[
            { id: "time",     label: "Log time" },
            { id: "expenses", label: "Expenses" },
            { id: "scope",    label: "Scope" },
            { id: "updates",  label: "Updates" },
            { id: "info",     label: "Info" },
          ].map((t) => (
            <button key={t.id} className={`wm-tab${tab === t.id ? " is-on" : ""}`} onClick={() => setTab(t.id)}>
              {t.label}
            </button>
          ))}
        </div>
        {tab === "time"     && <WorkerTimeEntry    project={project} myRoster={myRoster} config={config} />}
        {tab === "expenses" && <WorkerExpenseEntry project={project} myRoster={myRoster} config={config} />}
        {tab === "scope"    && <WorkerScopeAck     project={project} ack={ack} setAck={setAck} />}
        {tab === "updates"  && <WorkerUpdatesTab   project={project} myRoster={myRoster} />}
        {tab === "info"     && <WorkerProjectInfo  project={project} myRoster={myRoster} />}
      </div>
    );
  }
  function WorkerTimeEntry({ project, myRoster, config }) {
    const [hours, setHours] = useState({});
    const days = ["Mon", "Tue", "Wed", "Thu", "Fri"];
    const tasks = config.taskCatalog.filter((t) => t.billable).slice(0, 3);
    const remaining = (myRoster.plannedHours || 0) - (myRoster.hoursToDate || 0);
    function set(taskId, day, v) { setHours((cur) => ({ ...cur, [taskId + "_" + day]: v })); }
    const total = Object.values(hours).reduce((a, b) => a + (Number(b) || 0), 0);
    return (
      <div className="wm-time-entry">
        <p className="wm-remaining">
          <b>{remaining} hours remaining</b><br />
          of your {myRoster.plannedHours} h plan
        </p>
        <table className="wm-time-tbl">
          <thead>
            <tr>
              <th>Task</th>
              {days.map((d) => <th key={d}>{d}</th>)}
            </tr>
          </thead>
          <tbody>
            {tasks.map((t) => (
              <tr key={t.id}>
                <td>{t.name}</td>
                {days.map((d) => (
                  <td key={d}>
                    <input type="number" className="wm-time-cell"
                      min={0} max={12} step={0.5}
                      value={hours[t.id + "_" + d] || ""}
                      onChange={(e) => set(t.id, d, e.target.value)} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        <div className="wm-time-foot">
          <span>Total this week · <b>{total} h</b></span>
          <button className="wm-btn wm-btn--primary" onClick={() => alert("Week submitted (demo).")}>Submit week</button>
        </div>
      </div>
    );
  }
  function WorkerScopeAck({ project, ack, setAck }) {
    return (
      <div className="wm-scope">
        <h4>Project scope</h4>
        <p>{project.summary || "No summary provided."}</p>
        <h5>Phases</h5>
        <ul className="wm-phases">
          {project.phases.map((p) => (
            <li key={p.id}><b>{p.name}</b><span>weeks {p.startWeek}–{p.endWeek}</span></li>
          ))}
        </ul>
        <label className="wm-ack">
          <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} />
          <span>I acknowledge I've read the scope and any compliance docs attached to this project.</span>
        </label>
        <button className="wm-btn wm-btn--primary" disabled={!ack}>Submit acknowledgement</button>
      </div>
    );
  }
  function WorkerProjectInfo({ project, myRoster }) {
    return (
      <div className="wm-info">
        <div className="wm-info-row"><span>Manager</span><b>{project.ownerName}</b></div>
        <div className="wm-info-row"><span>Supplier lead</span><b>{project.supplierLead || "—"}</b></div>
        <div className="wm-info-row"><span>My role</span><b>{myRoster.role}</b></div>
        <div className="wm-info-row"><span>My task</span><b>{myRoster.taskId}</b></div>
        <div className="wm-info-row"><span>Allocation</span><b>{myRoster.allocPct}%</b></div>
        <div className="wm-info-row"><span>Start</span><b>{fmtDate(myRoster.startDate)}</b></div>
        <div className="wm-info-row"><span>End</span><b>{fmtDate(myRoster.endDate)}</b></div>
      </div>
    );
  }

  // ---------------------------------------------------------------
  // <ProjectListFilter/> — chip-bar pre-filter for the Requisitions
  // list when Project rows are present. Returns visible projects.
  // ---------------------------------------------------------------
  function ProjectListFilter({ value, onChange }) {
    if (!useProjectOn()) return null;
    const projects = useProjects();
    if (!projects || projects.length === 0) return null;
    return (
      <div className="prj-listfilter">
        <span className="prj-listfilter-l">Filter by project</span>
        <Segmented value={value || "all"} onChange={onChange}
          options={[
            { value: "all", label: `All · ${projects.length}` },
            { value: "active", label: `Active · ${projects.filter((p) => p.state === "active").length}` },
            { value: "pending", label: `Pending · ${projects.filter((p) => p.state === "budget-pend").length}` },
            { value: "closed", label: `Closed · ${projects.filter((p) => p.state === "closed").length}` },
          ]} />
      </div>
    );
  }

  // =================================================================
  // v0.88 — Remaining Project parity surfaces, per the Architecture Map.
  // These components extend the v0.86 build:
  //   · StatusReportTab            — Manager weekly status report
  //   · BudgetReallocationFields   — alt submission mode inside AmendmentsTab
  //   · ResourceSwapModal          — shared Manager + Agency
  //   · TeamProposalReviewModal    — shared Manager + Agency
  //   · AgencyConsolidatedTimesheet — supplier weekly time grid
  //   · AgencyAmendmentModal       — supplier-side change-order request
  //   · AgencyCloseoutModal        — supplier closeout acknowledgement
  //   · WorkerExpenseEntry         — worker-mobile expense entry tab
  //   · WorkerUpdatesTab           — worker-mobile amendment ack feed
  // =================================================================

  // ---- shared helpers ---------------------------------------------
  function _appendAudit(project, action, detail, by) {
    return [...(project.audit || []), {
      at: new Date().toISOString().slice(0, 16).replace("T", " "),
      by: by || "You",
      action, detail,
    }];
  }
  function _ragTone(rag) {
    if (rag === "green") return "ok";
    if (rag === "amber") return "watch";
    if (rag === "red")   return "danger";
    return "neutral";
  }

  // -----------------------------------------------------------------
  // <StatusReportTab/> — weekly status report cadence on the project
  // detail body. Reads project.statusReports[]; auto-drafts from the
  // burn ledger + recent comments + open amendments.
  // -----------------------------------------------------------------
  function StatusReportTab({ project, config, onUpdate }) {
    const [editing, setEditing] = useState(null); // report id or "new"
    const reports = (project.statusReports || []).slice().reverse();

    function draftNew() {
      const burnP = projectBurnPct(project);
      const rag = burnP >= 100 ? "red" : burnP >= 90 ? "amber" : "green";
      const lastComments = (project.comments || []).slice(-2).map((c) => c.body);
      const openAmd = (project.amendments || []).filter((a) => a.state === "pending");
      const sr = {
        id: "sr" + Date.now(),
        weekEnding: new Date().toISOString().slice(0, 10),
        state: "draft",
        author: "You (Manager)",
        sentAt: null,
        recipients: (config.statusReport && config.statusReport.defaultRecipients) || ["Project owner"],
        rag,
        burnNote: `Burn ${fmtPct(burnP, 0)} of budget vs plan. ${openAmd.length > 0 ? openAmd.length + " open amendment(s)." : "No open amendments."}`,
        risks: rag === "green" ? [] : ["Watch burn pace through end-of-month"],
        accomplishments: lastComments.slice(0, 2).map((c) => c.slice(0, 80)),
        nextWeek: [],
      };
      onUpdate({ ...project, statusReports: [...(project.statusReports || []), sr] });
      setEditing(sr.id);
    }
    function update(id, patch) {
      onUpdate({
        ...project,
        statusReports: (project.statusReports || []).map((r) => r.id === id ? { ...r, ...patch } : r),
      });
    }
    function send(id) {
      const sentAt = new Date().toISOString().slice(0, 10);
      onUpdate({
        ...project,
        statusReports: (project.statusReports || []).map((r) => r.id === id ? { ...r, state: "sent", sentAt } : r),
        audit: _appendAudit(project, "Status report sent", `Week ending ${(project.statusReports || []).find((r) => r.id === id).weekEnding}`, "You (Manager)"),
      });
      setEditing(null);
    }

    return (
      <Card title={`Status reports · ${(project.statusReports || []).length}`}
        sub={`Cadence · ${config.statusReport ? config.statusReport.cadence : "weekly"} · auto-drafted from burn + comments + open amendments.`}
        right={<Btn size="sm" tone="primary" onClick={draftNew}>+ Draft new report</Btn>}>
        {reports.length === 0
          ? <div className="prj-empty">No status reports yet. Draft the first to keep stakeholders aligned.</div>
          : reports.map((r) => {
            const isEditing = editing === r.id;
            return (
              <article key={r.id} className="prj-status">
                <header>
                  <div>
                    <div className="prj-status-meta">
                      <Pill tone={_ragTone(r.rag)}>{(r.rag || "—").toUpperCase()}</Pill>
                      <Pill tone={r.state === "sent" ? "ok" : "watch"}>{r.state}</Pill>
                      <span>Week ending <b>{fmtDate(r.weekEnding)}</b></span>
                    </div>
                    <h5 className="prj-status-h">Status update · {fmtDate(r.weekEnding)}</h5>
                  </div>
                  {r.state === "draft" && !isEditing && (
                    <div className="prj-status-actions">
                      <Btn size="sm" tone="ghost" onClick={() => setEditing(r.id)}>Edit</Btn>
                      <Btn size="sm" tone="primary" onClick={() => send(r.id)}>Send</Btn>
                    </div>
                  )}
                </header>
                {isEditing ? (
                  <div className="prj-status-edit">
                    <FieldGrid cols={2}>
                      <Field label="RAG">
                        <SelectInput value={r.rag} onChange={(v) => update(r.id, { rag: v })}
                          options={[{ value: "green", label: "Green" }, { value: "amber", label: "Amber" }, { value: "red", label: "Red" }]} />
                      </Field>
                      <Field label="Recipients">
                        <ChipList items={r.recipients || []} onChange={(v) => update(r.id, { recipients: v })}
                          placeholder="Add a recipient…" />
                      </Field>
                      <Field label="Burn note" span={2}>
                        <textarea className="prj-input" rows={2} value={r.burnNote}
                          onChange={(e) => update(r.id, { burnNote: e.target.value })} />
                      </Field>
                      <Field label="Accomplishments">
                        <ChipList items={r.accomplishments || []} onChange={(v) => update(r.id, { accomplishments: v })}
                          placeholder="Add one…" />
                      </Field>
                      <Field label="Risks">
                        <ChipList items={r.risks || []} onChange={(v) => update(r.id, { risks: v })}
                          placeholder="Add one…" />
                      </Field>
                      <Field label="Next week" span={2}>
                        <ChipList items={r.nextWeek || []} onChange={(v) => update(r.id, { nextWeek: v })}
                          placeholder="Add one…" />
                      </Field>
                    </FieldGrid>
                    <div className="prj-status-edit-foot">
                      <Btn size="sm" tone="secondary" onClick={() => setEditing(null)}>Done editing</Btn>
                      <Btn size="sm" tone="primary" onClick={() => send(r.id)}>Send report</Btn>
                    </div>
                  </div>
                ) : (
                  <div className="prj-status-body">
                    <p className="prj-status-burn">{r.burnNote}</p>
                    {(r.accomplishments || []).length > 0 && (
                      <div className="prj-status-block">
                        <div className="prj-status-block-l">Accomplishments</div>
                        <ul>{r.accomplishments.map((a, i) => <li key={i}>{a}</li>)}</ul>
                      </div>
                    )}
                    {(r.risks || []).length > 0 && (
                      <div className="prj-status-block">
                        <div className="prj-status-block-l">Risks</div>
                        <ul>{r.risks.map((a, i) => <li key={i}>{a}</li>)}</ul>
                      </div>
                    )}
                    {(r.nextWeek || []).length > 0 && (
                      <div className="prj-status-block">
                        <div className="prj-status-block-l">Next week</div>
                        <ul>{r.nextWeek.map((a, i) => <li key={i}>{a}</li>)}</ul>
                      </div>
                    )}
                    {r.sentAt && (
                      <div className="prj-status-foot">
                        Sent {fmtDate(r.sentAt)} to {(r.recipients || []).join(", ")}.
                      </div>
                    )}
                  </div>
                )}
              </article>
            );
          })}
      </Card>
    );
  }

  // -----------------------------------------------------------------
  // <ResourceSwapModal/> — shared between Manager (RosterTab) and
  // Agency (ActiveAgencyProjectCard). The buyer-initiated and supplier-
  // initiated copy differ via tenantRole.
  // -----------------------------------------------------------------
  function ResourceSwapModal({ project, config, workerId, tenantRole = "manager", onClose }) {
    const r = workerId && (project.roster || []).find((x) => x.workerId === workerId);
    const reasons = (config.resourceSwap && config.resourceSwap.reasonCodes) ||
      ["Voluntary departure", "Performance", "Illness / leave", "Reassigned by supplier", "End of need"];
    const [reason, setReason] = useState(reasons[0]);
    const [replacement, setReplacement] = useState("");
    const [note, setNote] = useState("");
    const requireRep = !!(config.resourceSwap && config.resourceSwap.requireReplacement);

    function submit() {
      if (requireRep && tenantRole === "supplier" && !replacement.trim()) return;
      const action = tenantRole === "supplier" ? "Supplier proposed resource swap" : "Resource swap requested";
      const detail = `${r ? r.name : "(unassigned)"} → ${replacement || "—"} · ${reason}`;
      const next = {
        ...project,
        audit: _appendAudit(project, action, detail, tenantRole === "supplier" ? "Agency" : "You (Manager)"),
      };
      saveProject(next);
      onClose();
    }

    return (
      <Modal open={!!workerId} onClose={onClose} title="Resource swap"
        footer={<>
          <Btn tone="secondary" onClick={onClose}>Cancel</Btn>
          <Btn tone="primary" onClick={submit}>
            {tenantRole === "supplier" ? "Propose swap" : "Send to supplier"}
          </Btn>
        </>}>
        <p style={{ marginTop: 0 }}>
          {tenantRole === "supplier"
            ? "Propose a like-for-like replacement for this worker, with a reason code. The buyer reviews before the roster updates."
            : "Send a resource-swap request to the supplier with a reason code. The supplier proposes a replacement; you approve before the roster updates."}
        </p>
        {r && (
          <div className="prj-swap-target">
            <Avatar name={r.name} />
            <div>
              <div className="prj-swap-target-name">{r.name}</div>
              <div className="prj-swap-target-sub">{r.role} · {r.allocPct}% · {r.hoursToDate} / {r.plannedHours} h</div>
            </div>
          </div>
        )}
        <FieldGrid cols={1}>
          <Field label="Reason">
            <SelectInput value={reason} onChange={setReason} options={reasons} />
          </Field>
          {tenantRole === "supplier" && (
            <Field label="Replacement candidate" hint={requireRep ? "Required by policy" : "Optional"}>
              <Input value={replacement} placeholder="Name" onChange={setReplacement} />
            </Field>
          )}
          <Field label={tenantRole === "supplier" ? "Note to buyer" : "Note to supplier"}>
            <textarea className="prj-input" rows={3} value={note}
              placeholder="Optional context…"
              onChange={(e) => setNote(e.target.value)} />
          </Field>
        </FieldGrid>
      </Modal>
    );
  }

  // -----------------------------------------------------------------
  // <TeamProposalReviewModal/> — Manager-side review of a supplier-
  // submitted team proposal. Reads project.teamProposal.candidates
  // (synthesised from teamShape × supplier candidates for the demo).
  // -----------------------------------------------------------------
  function TeamProposalReviewModal({ project, open, onClose }) {
    if (!open) return null;
    const proposal = project.teamProposal;
    if (!proposal || !proposal.submitted) {
      return (
        <Modal open={open} onClose={onClose} title="Team proposal review">
          <div className="prj-empty-state">
            <h3>No proposal to review yet</h3>
            <p>This project hasn't received a supplier team proposal. Open requests live in the Agency tab.</p>
          </div>
        </Modal>
      );
    }
    // Synthesize candidate rows from teamShape (demo data)
    const candidates = proposal.candidates || proposal.teamShape.flatMap((r, ri) =>
      Array.from({ length: r.count }).map((_, ci) => ({
        id: `c-${ri}-${ci}`,
        name: `Candidate ${ri + 1}.${ci + 1}`,
        role: r.role,
        allocPct: r.allocPct,
        plannedHours: r.plannedHours,
        rate: 145 + ri * 20,
        startDate: project.startDate,
        fit: ci === 0 ? "Strong" : "Good",
      }))
    );
    const [decisions, setDecisions] = useState({});
    function set(id, v) { setDecisions((cur) => ({ ...cur, [id]: v })); }
    function commit() {
      const acceptedNames = candidates.filter((c) => decisions[c.id] === "accept").map((c) => c.name);
      const next = {
        ...project,
        audit: _appendAudit(project, "Team proposal reviewed",
          `${acceptedNames.length} accepted of ${candidates.length}`, "You (Manager)"),
      };
      saveProject(next);
      onClose();
    }
    return (
      <Modal open={open} onClose={onClose} title="Review supplier team proposal" size="xl"
        footer={<>
          <Btn tone="secondary" onClick={onClose}>Cancel</Btn>
          <Btn tone="primary" onClick={commit}>Commit decisions</Btn>
        </>}>
        <p style={{ marginTop: 0 }}>
          {project.supplierLabel} proposed <b>{candidates.length}</b> candidates against the requested team shape, submitted {fmtDate(proposal.submitted)}.
          Accept, reject, or hold each individually — accepted candidates land on the project roster on commit.
        </p>
        <table className="prj-tbl">
          <thead>
            <tr>
              <th>Candidate</th><th>Role</th>
              <th className="prj-num">Alloc</th><th className="prj-num">Hours</th>
              <th className="prj-num">Rate</th>
              <th>Fit</th><th style={{ width: 220 }}>Decision</th>
            </tr>
          </thead>
          <tbody>
            {candidates.map((c) => (
              <tr key={c.id}>
                <td><div className="prj-with-avatar"><Avatar name={c.name} /><div className="prj-name">{c.name}</div></div></td>
                <td>{c.role}</td>
                <td className="prj-num">{c.allocPct}%</td>
                <td className="prj-num">{c.plannedHours}</td>
                <td className="prj-num">${c.rate}/h</td>
                <td><Pill tone={c.fit === "Strong" ? "ok" : "info"}>{c.fit}</Pill></td>
                <td>
                  <Segmented
                    value={decisions[c.id] || "hold"}
                    onChange={(v) => set(c.id, v)}
                    options={[
                      { value: "accept", label: "Accept" },
                      { value: "hold",   label: "Hold" },
                      { value: "reject", label: "Reject" },
                    ]} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Modal>
    );
  }

  // -----------------------------------------------------------------
  // <AgencyConsolidatedTimesheet/> — supplier-side weekly time grid
  // (workers × days × task codes). Fans into per-worker timesheets on
  // submit. Mounted from ActiveAgencyProjectCard's "Weekly time"
  // button.
  // -----------------------------------------------------------------
  function AgencyConsolidatedTimesheet({ project, config, open, onClose }) {
    const days = ["Mon", "Tue", "Wed", "Thu", "Fri"];
    const roster = project.roster || [];
    const [grid, setGrid] = useState({});
    function set(workerId, day, v) { setGrid((cur) => ({ ...cur, [workerId + "_" + day]: v })); }
    function total(workerId) {
      return days.reduce((a, d) => a + (Number(grid[workerId + "_" + d]) || 0), 0);
    }
    function grand() {
      return Object.values(grid).reduce((a, b) => a + (Number(b) || 0), 0);
    }
    function submit() {
      const totalHours = grand();
      const next = {
        ...project,
        audit: _appendAudit(project, "Supplier submitted consolidated weekly time",
          `${roster.length} workers · ${totalHours} h total`, "Agency"),
      };
      saveProject(next);
      onClose();
    }
    return (
      <Modal open={open} onClose={onClose} title="Consolidated weekly time" size="xl"
        footer={<>
          <Btn tone="secondary" onClick={onClose}>Cancel</Btn>
          <Btn tone="primary" onClick={submit}>Submit week ({grand()} h)</Btn>
        </>}>
        <p style={{ marginTop: 0 }}>
          One sheet, all {roster.length} workers on {project.name}. Submit once — the system fans out into per-worker timesheets and rolls up onto the project's burn ledger.
        </p>
        <table className="prj-tbl prj-ts-tbl">
          <thead>
            <tr>
              <th>Worker</th>
              {days.map((d) => <th key={d} className="prj-num">{d}</th>)}
              <th className="prj-num">Total</th>
            </tr>
          </thead>
          <tbody>
            {roster.map((r) => (
              <tr key={r.workerId}>
                <td>
                  <div className="prj-with-avatar"><Avatar name={r.name} />
                    <div>
                      <div className="prj-name">{r.name}</div>
                      <div className="prj-sub">{(config.taskCatalog.find((t) => t.id === r.taskId) || {}).name || r.taskId}</div>
                    </div>
                  </div>
                </td>
                {days.map((d) => (
                  <td key={d} className="prj-num">
                    <input type="number" className="prj-input prj-ts-cell"
                      min={0} max={12} step={0.25}
                      value={grid[r.workerId + "_" + d] || ""}
                      onChange={(e) => set(r.workerId, d, e.target.value)} />
                  </td>
                ))}
                <td className="prj-num"><b>{total(r.workerId)} h</b></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Modal>
    );
  }

  // -----------------------------------------------------------------
  // <AgencyAmendmentModal/> — supplier-side change-order request.
  // Re-uses the same amendment shape; routes through the same policy
  // tiers as buyer-initiated amendments.
  // -----------------------------------------------------------------
  function AgencyAmendmentModal({ project, config, open, onClose }) {
    const reasonCodes = (config.changeOrder && config.changeOrder.reasonCodes) || ["Scope add"];
    const [form, setForm] = useState({
      reason: reasonCodes[0] || "Scope add",
      deltaBudget: 0, deltaWeeks: 0, justification: "",
    });
    function deltaPct() { return project.budget ? ((form.deltaBudget || 0) / project.budget) * 100 : 0; }
    function route() {
      const pct = Math.abs(deltaPct());
      const co = config.changeOrder;
      if (pct <= co.autoApprovePctMax) return { tone: "ok",    text: `Auto-route to buyer · within ${co.autoApprovePctMax}% threshold` };
      if (pct <= co.managerApprovePctMax) return { tone: "watch", text: `Buyer manager review · ${co.autoApprovePctMax}–${co.managerApprovePctMax}%` };
      return { tone: "warn", text: `Buyer full re-approval · above ${co.managerApprovePctMax}%` };
    }
    function submit() {
      if (config.changeOrder.requireJustification && !form.justification.trim()) return;
      const next = {
        ...project,
        amendments: [...(project.amendments || []), {
          id: "AMD-" + String((project.amendments || []).length + 1).padStart(3, "0"),
          state: "pending",
          ...form,
          submittedBy: "Agency",
          submittedAt: new Date().toISOString().slice(0, 10),
          approvedBy: [], approvedAt: null,
        }],
        audit: _appendAudit(project, "Supplier-initiated amendment",
          `${form.reason} · ${form.deltaBudget >= 0 ? "+" : ""}${fmtMoneyExact(form.deltaBudget, project.currency)}`, "Agency"),
      };
      saveProject(next);
      onClose();
    }
    const r = route();
    return (
      <Modal open={open} onClose={onClose} title="Request change order" size="lg"
        footer={<>
          <Btn tone="secondary" onClick={onClose}>Cancel</Btn>
          <Btn tone="primary" onClick={submit}>Send to buyer</Btn>
        </>}>
        <p style={{ marginTop: 0 }}>
          Request a budget, schedule, or scope change. The buyer reviews under their change-order policy and approves, rejects, or counter-proposes.
        </p>
        <FieldGrid cols={2}>
          <Field label="Reason" span={2}>
            <SelectInput value={form.reason} onChange={(v) => setForm({ ...form, reason: v })}
              options={reasonCodes} />
          </Field>
          <Field label="Budget delta" hint="Positive to request more. Negative to release.">
            <MoneyInput value={form.deltaBudget} currency={project.currency}
              onChange={(v) => setForm({ ...form, deltaBudget: v })} />
          </Field>
          <Field label="Schedule delta" hint="Weeks. Positive extends.">
            <NumInput value={form.deltaWeeks} min={-26} max={52} suffix="wks"
              onChange={(v) => setForm({ ...form, deltaWeeks: v })} />
          </Field>
          <Field label="Justification" span={2} hint={config.changeOrder.requireJustification ? "Required by policy" : "Optional"}>
            <textarea className="prj-input" rows={4} value={form.justification}
              onChange={(e) => setForm({ ...form, justification: e.target.value })}
              placeholder="What's changing and why…" />
          </Field>
        </FieldGrid>
        <hr className="prj-hr" />
        <div className="prj-route">
          <Pill tone={r.tone}>{fmtPct(Math.abs(deltaPct()), 1)} of budget</Pill>
          <span>{r.text}</span>
        </div>
      </Modal>
    );
  }

  // -----------------------------------------------------------------
  // <AgencyCloseoutModal/> — supplier closeout acknowledgement.
  // Confirms no further billing claim. Manager confirms separately
  // in their CloseoutTab.
  // -----------------------------------------------------------------
  function AgencyCloseoutModal({ project, open, onClose }) {
    const [ack, setAck] = useState(false);
    const [note, setNote] = useState("");
    function submit() {
      const next = {
        ...project,
        supplierClosed: { ackBy: "Agency", ackAt: new Date().toISOString().slice(0, 10), note },
        audit: _appendAudit(project, "Supplier closeout acknowledge",
          note ? note.slice(0, 80) : "Confirmed no further billing.", "Agency"),
      };
      // If manager also signed off + state is closing, flip to closed.
      if (project.state === "closing") next.state = "closed";
      saveProject(next);
      onClose();
    }
    return (
      <Modal open={open} onClose={onClose} title="Closeout acknowledgement"
        footer={<>
          <Btn tone="secondary" onClick={onClose}>Cancel</Btn>
          <Btn tone="primary" disabled={!ack} onClick={submit}>Acknowledge & close</Btn>
        </>}>
        <p style={{ marginTop: 0 }}>
          Confirm no further billing claim against {project.name}. Final invoice already cleared, all expenses submitted, all workers off-boarded.
        </p>
        <FieldGrid cols={1}>
          <Field label="Note (optional)">
            <textarea className="prj-input" rows={3} value={note}
              placeholder="Any handover notes for the buyer…"
              onChange={(e) => setNote(e.target.value)} />
          </Field>
        </FieldGrid>
        <label className="prj-ack">
          <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} />
          <span>I confirm no further billing claim against this project.</span>
        </label>
      </Modal>
    );
  }

  // -----------------------------------------------------------------
  // <WorkerExpenseEntry/> — mobile expense form, phase + task tagged.
  // Stored on project.expenses[]. Rolls onto burn ledger downstream.
  // -----------------------------------------------------------------
  function WorkerExpenseEntry({ project, myRoster, config }) {
    const [form, setForm] = useState({
      category: "Travel", amount: "", description: "",
      phaseId: project.phases[0] && project.phases[0].id,
      taskId: myRoster.taskId,
    });
    const myExpenses = (project.expenses || []).filter((e) => e.workerId === myRoster.workerId
      || (e.workerName || "").split(/\s+/)[0] === (myRoster.name || "").split(/\s+/)[0]);
    function submit() {
      const amt = Number(form.amount) || 0;
      if (amt <= 0) return;
      const next = {
        ...project,
        expenses: [...(project.expenses || []), {
          id: "e" + Date.now(),
          workerId: myRoster.workerId,
          workerName: myRoster.name,
          phaseId: form.phaseId, taskId: form.taskId,
          category: form.category,
          amount: amt, currency: project.currency,
          description: form.description,
          submittedAt: new Date().toISOString().slice(0, 10),
          state: "pending",
        }],
        audit: _appendAudit(project, "Expense submitted",
          `${myRoster.name} · ${form.category} · ${fmtMoneyExact(amt, project.currency)}`, myRoster.name),
      };
      saveProject(next);
      setForm({ ...form, amount: "", description: "" });
    }
    return (
      <div className="wm-expense">
        <p className="wm-remaining">
          Tag every expense to a phase + task code. The buyer sees it on the burn ledger.
        </p>
        <div className="wm-expense-form">
          <label className="wm-expense-l">Category</label>
          <select className="wm-expense-in" value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}>
            {["Travel", "Equipment", "Meals", "Lodging", "Misc"].map((c) => <option key={c}>{c}</option>)}
          </select>
          <label className="wm-expense-l">Amount</label>
          <input type="number" className="wm-expense-in" min={0} step={1}
            value={form.amount}
            placeholder="0"
            onChange={(e) => setForm({ ...form, amount: e.target.value })} />
          <label className="wm-expense-l">Phase</label>
          <select className="wm-expense-in" value={form.phaseId}
            onChange={(e) => setForm({ ...form, phaseId: e.target.value })}>
            {(project.phases || []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <label className="wm-expense-l">Task</label>
          <select className="wm-expense-in" value={form.taskId}
            onChange={(e) => setForm({ ...form, taskId: e.target.value })}>
            {config.taskCatalog.filter((t) => t.billable).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <label className="wm-expense-l">Description</label>
          <textarea className="wm-expense-in" rows={2} value={form.description}
            placeholder="What was this for…"
            onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <button className="wm-btn wm-btn--primary" onClick={submit}>Submit expense</button>
        </div>
        <h5 className="wm-expense-h">My recent expenses</h5>
        {myExpenses.length === 0
          ? <div className="prj-empty">No expenses submitted yet.</div>
          : <ul className="wm-expense-list">
              {myExpenses.slice().reverse().map((e) => (
                <li key={e.id}>
                  <div className="wm-expense-row">
                    <b>{fmtMoneyExact(e.amount, e.currency || project.currency)}</b>
                    <Pill tone={e.state === "approved" ? "ok" : e.state === "rejected" ? "danger" : "watch"}>{e.state}</Pill>
                  </div>
                  <div className="wm-expense-sub">
                    {e.category} · {fmtDate(e.submittedAt)} · {e.description}
                  </div>
                </li>
              ))}
            </ul>}
      </div>
    );
  }

  // -----------------------------------------------------------------
  // <WorkerUpdatesTab/> — worker-side feed of amendments that touch
  // this worker (planned hours / end-date / role changes). Each item
  // needs an ack before the worker can log against the new shape.
  // -----------------------------------------------------------------
  function WorkerUpdatesTab({ project, myRoster }) {
    // Demo data: derive notional updates from amendments that exist
    // on the project. Real wiring would tag amendments to roster lines.
    const updates = (project.amendments || []).map((a) => ({
      id: a.id,
      title: a.reason,
      detail: a.justification,
      delta: (a.deltaBudget !== 0 ? `${a.deltaBudget > 0 ? "+" : ""}${fmtMoneyExact(a.deltaBudget, project.currency)}` : "") +
             (a.deltaWeeks !== 0 ? ` · ${a.deltaWeeks > 0 ? "+" : ""}${a.deltaWeeks} weeks` : ""),
      state: a.state,
      submittedAt: a.submittedAt,
    }));
    const [acks, setAcks] = useState({});
    function ack(id) { setAcks((cur) => ({ ...cur, [id]: true })); }
    return (
      <div className="wm-updates">
        <p className="wm-remaining">
          Changes the buyer approved that touch your role or planned hours. Acknowledge each before logging time against the new shape.
        </p>
        {updates.length === 0
          ? <div className="prj-empty">No updates yet.</div>
          : <ul className="wm-updates-list">
              {updates.map((u) => (
                <li key={u.id}>
                  <div className="wm-updates-h">
                    <b>{u.title}</b>
                    <Pill tone={u.state === "approved" ? "ok" : "watch"}>{u.state}</Pill>
                  </div>
                  {u.delta && <div className="wm-updates-delta">{u.delta}</div>}
                  <p className="wm-updates-detail">{u.detail}</p>
                  <div className="wm-updates-foot">
                    <span className="wm-updates-date">Submitted {fmtDate(u.submittedAt)}</span>
                    {acks[u.id]
                      ? <Pill tone="ok">Acknowledged</Pill>
                      : <button className="wm-btn wm-btn--primary" onClick={() => ack(u.id)}>Acknowledge</button>}
                  </div>
                </li>
              ))}
            </ul>}
      </div>
    );
  }

  // ---------------------------------------------------------------
  // Register Project as a variant on the unified detail router.
  // The manifest's body component is the ProjectVariantBody above; the
  // channel is "Project" and the id prefix is "PRJ-". With engProject
  // off the registry call is a no-op.
  // ---------------------------------------------------------------
  function _maybeRegister() {
    if (!isProjectOn()) return;
    if (!window.VariantRegistry || !window.VariantRegistry.register) return;
    window.VariantRegistry.register({
      id: "project",
      label: "Project",
      flag: "engProject",
      channels: ["Project"],
      idPrefix: ["PRJ-"],
      chipClass: "rdu-chip--professional",
      tenantRole: "buyer",
      agencyOrgVisibility: "vendor-side",
      chips: [{ kind: "type", text: "Project" }, { kind: "channel", text: "Project · supplier-led" }],
      meta: ["Owner", "Supplier", "Budget", "NTE", "Start", "End"],
      accordions: ["Burn dashboard", "Roster", "Timesheets", "Amendments", "Documents", "Comments", "Audit", "Closeout"],
      art: "burn",
      menu: [],
      audit: { scope: "project" },
      body: ProjectVariantBody,
      lookupRow: (id) => {
        const p = getProject(id);
        if (!p) return null;
        return {
          id: p.id, sourcingChannel: "Project",
          engagementType: "Project",
          name: p.name, supplier: p.supplier,
          ownerName: p.ownerName,
        };
      },
    });
  }
  // The VariantRegistry comes from pages/requisition-engagement-detail.jsx
  // which loads later than this file. Try immediately (no-op if not yet
  // available), and on every signal that could surface it.
  _maybeRegister();
  if (document.readyState === "complete") {
    _maybeRegister();
  } else {
    window.addEventListener("load", _maybeRegister);
  }
  // Also try a couple of late retries to win against any other deferred
  // registrations and to pick up the case where the flag flips on after
  // load.
  setTimeout(_maybeRegister, 100);
  setTimeout(_maybeRegister, 500);
  window.addEventListener("featureflags:change", _maybeRegister);

  // ---------------------------------------------------------------
  // Export components for host pages
  // ---------------------------------------------------------------
  Object.assign(window, {
    ProjectAdminPanel,
    ProjectIntakeFields,
    ProjectVariantBody,
    ProjectListFilter,
    AgencyProjectsTab,
    WorkerProjectScreen,
    ProjectChip,
  });
})();
