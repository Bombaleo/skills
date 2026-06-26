// =====================================================================
// Flex Work — Settings → Lifecycle
//   Top-level Settings page for managing lifecycle templates and the
//   per-job assignments that pin templates to jobs. The data lives in
//   pages/lifecycle-config.jsx; this file is presentation + edit only.
//
//   Layout
//     · Page header (title + sub + Restore defaults action)
//     · KPI strip (templates by kind, jobs with overrides)
//     · Kind tabs (Professional / Frontline)
//     · Master / detail panel:
//         ◦ Left rail — list of templates for the active kind, with
//           name, default badge, task counts, "N jobs" chip. Plus a
//           "+ Create template" affordance under the list.
//         ◦ Right pane — selected template's editable form:
//             · Name + description
//             · Set as default toggle
//             · Four sub-tabs: Onboarding · Offboarding · Approval · Connectors
//
//   Consumers read the templates via the lifecycle-config.jsx public
//   API. This page never mutates other surfaces; it's pure CRUD over
//   the templates store.
// =====================================================================

(function () {
  const { useState, useEffect, useMemo } = React;

  // ---------- Owner / connector pills (small primitives, identical to
  // the originals that lived in lifecycle-config.jsx in v1.24 — kept
  // local to this file since this is the only consumer now) ---------
  function OwnerPill({ value }) {
    const cls = "lc-owner lc-owner--" + value;
    const label = value === "worker" ? "Worker" : value === "employer" ? "Employer" : "Shared";
    return <span className={cls}>{label}</span>;
  }
  function ConnectorPill({ value }) {
    if (!value) return <span className="lc-conn lc-conn--none">Manual</span>;
    const map = { esign: "E-Sig", bgcheck: "BG check", rtw: "RTW", payroll: "Payroll", banking: "Banking", okta: "SSO", asset: "Asset" };
    return <span className="lc-conn">{map[value] || value}</span>;
  }

  // ---------- Tab: Tasks ---------------------------------------------
  // Renders against a single template's onboarding or offboarding list.
  // Mutations call setLifecycleTemplate so the store + the broadcast
  // fire on every change.
  function TasksPane({ template, slot }) {
    const list = template[slot] || [];
    const onToggle = (id, on) => {
      const next = list.map((t) => t.id === id ? { ...t, enabled: on } : t);
      window.setLifecycleTemplate(template.id, { [slot]: next });
    };
    const onDue = (id, due) => {
      const next = list.map((t) => t.id === id ? { ...t, due: Number(due) || 0 } : t);
      window.setLifecycleTemplate(template.id, { [slot]: next });
    };
    const onReq = (id, req) => {
      const next = list.map((t) => t.id === id ? { ...t, required: req } : t);
      window.setLifecycleTemplate(template.id, { [slot]: next });
    };
    const enabled = list.filter((t) => t.enabled).length;
    const subtitle = slot === "onboarding"
      ? "Tasks Flex Work runs on a new worker. Required items gate shift-readiness for Frontline and counter-sign for Pro."
      : "Tasks Flex Work runs when an engagement ends. Required items must complete before the worker transitions to Inactive.";
    return (
      <div className="sowc-pane">
        <div className="sowc-pane-head">
          <div>
            <h4 className="sowc-pane-title">{slot === "onboarding" ? "Onboarding task library" : "Offboarding task library"}</h4>
            <p className="sowc-pane-sub">{subtitle}</p>
          </div>
          <span className="cfg-tag cfg-tag--neutral">{enabled} of {list.length} enabled</span>
        </div>
        <ul className="lc-tasks" role="list">
          {list.map((t) => (
            <li key={t.id} className={"lc-task" + (t.enabled ? "" : " lc-task--off") + (t.required ? " lc-task--req" : "")}>
              <div className="lc-task-main">
                <div className="lc-task-name">
                  {t.label}
                  {t.required && <span className="lc-req">Required</span>}
                </div>
                <p className="lc-task-desc">{t.desc}</p>
                <div className="lc-task-meta">
                  <OwnerPill value={t.owner} />
                  <ConnectorPill value={t.connector} />
                  <label className="lc-due">
                    Due
                    <input type="number" min={0} max={90} value={t.due}
                      onChange={(e) => onDue(t.id, e.target.value)}
                      className="lc-due-input tabular" />
                    days
                  </label>
                  <label className="lc-due" style={{ marginLeft: 8 }}>
                    <input type="checkbox" checked={!!t.required} onChange={(e) => onReq(t.id, e.target.checked)} />
                    Required
                  </label>
                </div>
              </div>
              <div className="lc-task-rail">
                <Switch checked={t.enabled} onChange={(v) => onToggle(t.id, v)} ariaLabel={`Enable ${t.label}`} />
              </div>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  // ---------- Tab: Connectors ----------------------------------------
  function ConnectorsPane({ template }) {
    const list = template.connectors || [];
    const onToggle = (id, on) => {
      const next = list.map((c) => c.id === id ? { ...c, enabled: on } : c);
      window.setLifecycleTemplate(template.id, { connectors: next });
    };
    const onProvider = (id, provider) => {
      const next = list.map((c) => c.id === id ? { ...c, provider } : c);
      window.setLifecycleTemplate(template.id, { connectors: next });
    };
    return (
      <div className="sowc-pane">
        <div className="sowc-pane-head">
          <div>
            <h4 className="sowc-pane-title">Lifecycle connectors</h4>
            <p className="sowc-pane-sub">Each task above is handled by exactly one connector. "Reuses" means the same connector configured for another program (SOW or IC) is shared — change once, applies everywhere.</p>
          </div>
        </div>
        <ul className="lc-conn-list" role="list">
          {list.map((c) => (
            <li key={c.id} className={"lc-conn-row" + (c.enabled ? "" : " lc-conn-row--off")}>
              <div className="lc-conn-h">
                <div className="lc-conn-icon" aria-hidden="true">
                  <Icon name={c.id === "bgcheck" ? "ShieldPerson" : c.id === "rtw" ? "PersonAuthorize" : c.id === "esign" ? "Edit" : c.id === "okta" ? "Lock" : c.id === "asset" ? "Briefcase" : c.id === "banking" ? "Wallet" : c.id === "payroll" ? "Pay" : "Settings"} size={18} />
                </div>
                <div>
                  <div className="lc-conn-name">{c.label}{c.reuse && <span className="lc-conn-reuse">Reuses {c.reuse === "sow" ? "SOW" : "IC"} program</span>}</div>
                  <div className="lc-conn-providers">
                    {c.providers.map((p) => (
                      <button key={p} type="button"
                        className={"lc-conn-prov" + (c.provider === p ? " is-on" : "")}
                        onClick={() => onProvider(c.id, p)}>
                        {c.provider === p && <Icon name="Check" size={10} />}{p}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="lc-conn-rail">
                <Switch checked={c.enabled} onChange={(v) => onToggle(c.id, v)} ariaLabel={`Enable ${c.label}`} />
              </div>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  // ---------- Tab: Approval -------------------------------------------
  function ApprovalPane({ template }) {
    const a = template.approval || {};
    const sla = a.sla || { onboardingDays: 5, offboardingDays: 7 };
    const set = (patch) => window.setLifecycleTemplate(template.id, { approval: { ...a, ...patch } });
    const setSla = (patch) => set({ sla: { ...sla, ...patch } });
    return (
      <div className="sowc-pane">
        <div className="sowc-pane-head">
          <div>
            <h4 className="sowc-pane-title">Approval routing</h4>
            <p className="sowc-pane-sub">Gate above thresholds — risk score, severance dollars. Reuses the same router primitive shipped for SOW + IC. No new model.</p>
          </div>
        </div>
        <div className="lc-grid">
          <label className="sowc-field">
            <span className="sowi-lab">BG-check risk threshold for Compliance review</span>
            <Dropdown options={["25","35","50","65"]} value={String(a.onboardingRiskThreshold || 35)} onChange={(v) => set({ onboardingRiskThreshold: Number(v) })} />
          </label>
          <label className="sowc-field">
            <span className="sowi-lab">Onboarding SLA (days)</span>
            <Dropdown options={["3","5","7","10","14"]} value={String(sla.onboardingDays)} onChange={(v) => setSla({ onboardingDays: Number(v) })} />
          </label>
          <label className="sowc-field">
            <span className="sowi-lab">Severance threshold for HR-Legal review</span>
            <Dropdown options={["10000","25000","50000","100000"]} value={String(a.offboardingSeveranceThreshold || 25000)} onChange={(v) => set({ offboardingSeveranceThreshold: Number(v) })} />
          </label>
          <label className="sowc-field">
            <span className="sowi-lab">Offboarding SLA (days)</span>
            <Dropdown options={["3","7","14","30"]} value={String(sla.offboardingDays)} onChange={(v) => setSla({ offboardingDays: Number(v) })} />
          </label>
        </div>
        <div className="lc-policy">
          <label className="lc-policy-row">
            <input type="checkbox" checked={!!a.offboardingDnrRequiresHr} onChange={(e) => set({ offboardingDnrRequiresHr: e.target.checked })} />
            <div>
              <div className="lc-policy-h">Do-not-rehire flag requires HR-Legal sign-off</div>
              <div className="lc-policy-d">When on, setting DNR on an offboarding worker routes through HR-Legal review before the worker transitions to Terminated.</div>
            </div>
          </label>
        </div>
      </div>
    );
  }

  // ---------- Kind chip -----------------------------------------------
  function KindChip({ kind }) {
    return <span className={"lct-kind lct-kind--" + kind}>{kind === "pro" ? "Professional" : "Frontline"}</span>;
  }

  // ---------- Template list rail -------------------------------------
  function TemplateRail({ store, kind, selectedId, onSelect, onCreate }) {
    const items = store.templates.filter((t) => t.kind === kind);
    const assignmentMap = store.jobAssignments[kind === "pro" ? "professional" : "frontline"] || {};
    return (
      <aside className="lct-rail">
        <ul className="lct-rail-list" role="list">
          {items.map((t) => {
            const jobsUsing = Object.values(assignmentMap).filter((id) => id === t.id).length;
            const onbN = (t.onboarding || []).filter((x) => x.enabled).length;
            const offN = (t.offboarding || []).filter((x) => x.enabled).length;
            return (
              <li key={t.id}>
                <button type="button"
                  className={"lct-rail-card" + (t.id === selectedId ? " is-on" : "")}
                  onClick={() => onSelect(t.id)}>
                  <div className="lct-rail-head">
                    <span className="lct-rail-name">{t.name}</span>
                    {t.isDefault && <span className="lct-default">Default</span>}
                  </div>
                  <div className="lct-rail-meta">
                    <span>{onbN} on-board</span>
                    <span>·</span>
                    <span>{offN} off-board</span>
                    <span>·</span>
                    <span>{jobsUsing} {jobsUsing === 1 ? "job" : "jobs"}</span>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
        <button type="button" className="lct-create" onClick={() => onCreate(kind)}>
          <Icon name="AddCircle" size={14} />
          New {kind === "pro" ? "Professional" : "Frontline"} template
        </button>
      </aside>
    );
  }

  // ---------- Template detail header ---------------------------------
  function TemplateDetailHeader({ template, jobsUsingCount }) {
    const [name, setName] = useState(template.name);
    const [desc, setDesc] = useState(template.description || "");
    useEffect(() => { setName(template.name); setDesc(template.description || ""); }, [template.id]);

    const onSetDefault = () => {
      window.setDefaultLifecycleTemplate(template.kind, template.id);
      if (window.showToast) window.showToast(`${template.name} is now the default for ${template.kind === "pro" ? "Professional" : "Frontline"}`, { kind: "success" });
    };
    const onClone = () => {
      const id = window.cloneLifecycleTemplate(template.id);
      if (window.showToast) window.showToast(`${template.name} cloned`, { kind: "success" });
      // No nav here — the parent re-reads from the store and the new
      // template appears in the rail; user can click it.
      return id;
    };
    const onDelete = () => {
      if (template.isDefault) { if (window.showToast) window.showToast("The default template cannot be deleted", { kind: "warning" }); return; }
      if (jobsUsingCount > 0 && typeof window.confirm === "function" && !window.confirm(`${jobsUsingCount} job${jobsUsingCount === 1 ? " uses" : "s use"} this template — they'll fall back to the default. Delete anyway?`)) return;
      window.deleteLifecycleTemplate(template.id);
      if (window.showToast) window.showToast(`${template.name} deleted`, { kind: "success" });
    };
    const commitName = () => {
      if (name.trim() && name.trim() !== template.name) window.setLifecycleTemplate(template.id, { name: name.trim() });
    };
    const commitDesc = () => {
      if (desc !== (template.description || "")) window.setLifecycleTemplate(template.id, { description: desc });
    };

    return (
      <header className="lct-detail-head">
        <div className="lct-detail-titlerow">
          <KindChip kind={template.kind} />
          {template.isDefault && <span className="lct-default">Default for {template.kind === "pro" ? "Pro" : "Frontline"}</span>}
          {template.builtIn && <span className="lct-builtin">Built in</span>}
        </div>
        <input className="lct-detail-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={commitName}
          onKeyDown={(e) => { if (e.key === "Enter") e.target.blur(); }}
          aria-label="Template name" />
        <textarea className="lct-detail-desc"
          rows={2}
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          onBlur={commitDesc}
          placeholder="Describe when this template should apply (role types, country, risk profile)." />
        <div className="lct-detail-actions">
          {!template.isDefault && (
            <button type="button" className="vms-btn vms-btn--sm vms-btn--secondary" onClick={onSetDefault}>
              <Icon name="Check" size={14} />Set as default
            </button>
          )}
          <button type="button" className="vms-btn vms-btn--sm vms-btn--secondary" onClick={onClone}>
            <Icon name="Copy" size={14} />Clone
          </button>
          {!template.isDefault && (
            <button type="button" className="vms-btn vms-btn--sm vms-btn--tertiary" onClick={onDelete} style={{ color: "var(--evr-content-status-error-default)" }}>
              <Icon name="Cancel" size={14} />Delete
            </button>
          )}
        </div>
      </header>
    );
  }

  // ---------- Template detail body (the four sub-tabs) ---------------
  function TemplateDetail({ template, jobsUsingCount }) {
    const [tab, setTab] = useState("onboarding");
    useEffect(() => { setTab("onboarding"); }, [template.id]);
    const onbN = (template.onboarding || []).filter((x) => x.enabled).length;
    const offN = (template.offboarding || []).filter((x) => x.enabled).length;
    const conN = (template.connectors || []).filter((x) => x.enabled).length;
    const TABS = [
      { id: "onboarding",  label: "Onboarding",  icon: "PersonPlus",      count: onbN },
      { id: "offboarding", label: "Offboarding", icon: "PersonClock",     count: offN },
      { id: "approval",    label: "Approval",    icon: "PersonAuthorize", count: (template.approval && template.approval.sla ? template.approval.sla.onboardingDays + "d" : "—") },
      { id: "connectors",  label: "Connectors",  icon: "Settings",        count: conN },
    ];
    return (
      <section className="lct-detail">
        <TemplateDetailHeader template={template} jobsUsingCount={jobsUsingCount} />
        <div className="sowc-tabs" role="tablist" style={{ borderTop: "1px solid var(--evr-border-decorative-lowemp)", paddingTop: 14, marginTop: 4 }}>
          {TABS.map((t) => (
            <button key={t.id} type="button" role="tab"
              aria-selected={tab === t.id}
              className={"sowc-tab" + (tab === t.id ? " sowc-tab--on" : "")}
              onClick={() => setTab(t.id)}>
              <Icon name={t.icon} size={14} />
              <span>{t.label}</span>
              <span className="sowc-tab-count">{t.count}</span>
            </button>
          ))}
        </div>
        <div className="sowc-body" style={{ marginTop: 12 }}>
          {tab === "onboarding"  && <TasksPane      template={template} slot="onboarding"  />}
          {tab === "offboarding" && <TasksPane      template={template} slot="offboarding" />}
          {tab === "approval"    && <ApprovalPane   template={template} />}
          {tab === "connectors"  && <ConnectorsPane template={template} />}
        </div>
      </section>
    );
  }

  // ---------- Create-template inline panel ---------------------------
  function CreateInline({ kind, onCancel, onCreated }) {
    const [name, setName] = useState("");
    const [seedFrom, setSeedFrom] = useState("");
    const templates = window.getLifecycleTemplates(kind);
    useEffect(() => {
      const def = templates.find((t) => t.isDefault);
      if (def) setSeedFrom(def.id);
    }, [kind]);
    const submit = () => {
      const trimmed = name.trim();
      if (!trimmed) return;
      // Clone from the picked source template — this guarantees the
      // new template has the full task / connector / approval shape.
      const id = window.cloneLifecycleTemplate(seedFrom, trimmed);
      if (id) {
        if (window.showToast) window.showToast(`Created "${trimmed}"`, { kind: "success" });
        onCreated(id);
      }
    };
    return (
      <div className="lct-create-inline">
        <h4 className="sowc-pane-title">Create a {kind === "pro" ? "Professional" : "Frontline"} template</h4>
        <p className="sowc-pane-sub">Pick a seed template to copy the task list, connectors, and approval thresholds from. You can edit any of them afterwards.</p>
        <div className="lct-create-fields">
          <label className="sowc-field">
            <span className="sowi-lab">Template name</span>
            <input type="text" className="fld-input" value={name} onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
              placeholder={kind === "pro" ? "e.g. Finance / Legal contractor" : "e.g. Healthcare RN per-diem"}
              autoFocus />
          </label>
          <label className="sowc-field">
            <span className="sowi-lab">Seed from</span>
            <Dropdown
              options={templates.map((t) => ({ value: t.id, label: t.name }))}
              value={seedFrom}
              onChange={setSeedFrom}
            />
          </label>
        </div>
        <div className="lct-create-actions">
          <button type="button" className="vms-btn vms-btn--secondary" onClick={onCancel}>Cancel</button>
          <button type="button" className="vms-btn vms-btn--primary" onClick={submit} disabled={!name.trim()}>
            <Icon name="AddCircle" size={14} />Create template
          </button>
        </div>
      </div>
    );
  }

  // ---------- Main page -----------------------------------------------
  function LifecycleSettingsPage() {
    const store = window.useLifecycleStore ? window.useLifecycleStore() : window.getLifecycleStore();
    const proOn = window.useProLifecycleVisible       ? window.useProLifecycleVisible()       : false;
    const flOn  = window.useFrontlineLifecycleVisible ? window.useFrontlineLifecycleVisible() : false;
    // Surface neither tab if both are off — but we should still let
    // admins view the templates as a reference. Show whichever is on,
    // default to Pro.
    const initialKind = proOn ? "pro" : flOn ? "frontline" : "pro";
    const [kind, setKind] = useState(initialKind);
    const visible = store.templates.filter((t) => t.kind === kind);
    const [selectedId, setSelectedId] = useState(() => {
      const def = visible.find((t) => t.isDefault);
      return (def || visible[0] || {}).id || null;
    });
    const [creating, setCreating] = useState(false);

    // Keep the selection valid as the store changes (delete / create).
    useEffect(() => {
      const stillThere = visible.some((t) => t.id === selectedId);
      if (!stillThere) {
        const def = visible.find((t) => t.isDefault);
        setSelectedId((def || visible[0] || {}).id || null);
      }
    }, [store]);

    const onSwitchKind = (next) => {
      setKind(next);
      setCreating(false);
      const visibleNext = store.templates.filter((t) => t.kind === next);
      const def = visibleNext.find((t) => t.isDefault);
      setSelectedId((def || visibleNext[0] || {}).id || null);
    };

    const onCreate = (k) => { setCreating(true); };
    const onCreated = (id) => { setCreating(false); setSelectedId(id); };

    const selected = visible.find((t) => t.id === selectedId);
    const assignmentMap = store.jobAssignments[kind === "pro" ? "professional" : "frontline"] || {};
    const jobsUsingCount = selected ? Object.values(assignmentMap).filter((id) => id === selected.id).length : 0;

    // KPI strip data
    const proCount = store.templates.filter((t) => t.kind === "pro").length;
    const flCount  = store.templates.filter((t) => t.kind === "frontline").length;
    const proAssigns = Object.keys(store.jobAssignments.professional || {}).length;
    const flAssigns  = Object.keys(store.jobAssignments.frontline    || {}).length;

    const onRestore = () => {
      if (typeof window.confirm === "function" && !window.confirm("Restore lifecycle defaults? Every template and per-job assignment will reset to the seed catalog.")) return;
      window.restoreLifecycleDefaults();
      if (window.showToast) window.showToast("Lifecycle templates restored to defaults", { kind: "success" });
    };

    return (
      <div className="set-content lct-page">
        <header className="set-content-header" style={{ display: "flex", flexDirection: "column", gap: 12, padding: "8px 4px 0" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
            <div>
              <h2 className="set-content-title">Lifecycle</h2>
              <p className="set-content-sub">
                Author the on-boarding and off-boarding catalogs your workers run through. Templates here are picked per job in <b>Settings &rarr; Jobs</b>; jobs without an explicit pick fall back to the default template for their kind.
              </p>
            </div>
            <button type="button" className="vms-btn vms-btn--sm vms-btn--secondary" onClick={onRestore}>
              <Icon name="Refresh" size={14} />Restore defaults
            </button>
          </div>
          <div className="lct-kpis">
            <div className="lct-kpi"><span className="lct-kpi-num tabular">{proCount}</span><span className="lct-kpi-lab">Professional templates</span></div>
            <div className="lct-kpi"><span className="lct-kpi-num tabular">{flCount}</span><span className="lct-kpi-lab">Frontline templates</span></div>
            <div className="lct-kpi"><span className="lct-kpi-num tabular">{proAssigns}</span><span className="lct-kpi-lab">Pro jobs with overrides</span></div>
            <div className="lct-kpi"><span className="lct-kpi-num tabular">{flAssigns}</span><span className="lct-kpi-lab">Frontline jobs with overrides</span></div>
          </div>
        </header>

        {/* Kind tabs */}
        <div className="lct-kind-tabs" role="tablist">
          {proOn && (
            <button type="button" role="tab"
              aria-selected={kind === "pro"}
              className={"lct-kind-tab" + (kind === "pro" ? " is-on" : "")}
              onClick={() => onSwitchKind("pro")}>
              <Icon name="PersonAuthorize" size={14} />Professional <span className="lct-kind-tab-count">{proCount}</span>
            </button>
          )}
          {flOn && (
            <button type="button" role="tab"
              aria-selected={kind === "frontline"}
              className={"lct-kind-tab" + (kind === "frontline" ? " is-on" : "")}
              onClick={() => onSwitchKind("frontline")}>
              <Icon name="PersonPlus" size={14} />Frontline <span className="lct-kind-tab-count">{flCount}</span>
            </button>
          )}
          {!proOn && !flOn && (
            <p className="lct-empty">
              Enable <code>professionalWork</code> or <code>frontlineDirect</code> in <b>Settings &rarr; Feature flags</b> to start authoring lifecycle templates.
            </p>
          )}
        </div>

        {/* Master / detail */}
        {(proOn || flOn) && (
          <div className="lct-page-body">
            <TemplateRail
              store={store}
              kind={kind}
              selectedId={selectedId}
              onSelect={(id) => { setCreating(false); setSelectedId(id); }}
              onCreate={onCreate}
            />
            {creating ? (
              <CreateInline kind={kind} onCancel={() => setCreating(false)} onCreated={onCreated} />
            ) : selected ? (
              <TemplateDetail template={selected} jobsUsingCount={jobsUsingCount} />
            ) : (
              <div className="lct-detail lct-empty">
                <p>No {kind === "pro" ? "Professional" : "Frontline"} templates yet. Click <b>New {kind === "pro" ? "Professional" : "Frontline"} template</b> on the left to seed one.</p>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // ---------- Per-job picker (mounted by jobs-settings.jsx) ---------
  // Tiny inline dropdown that admins use on every job row. When the
  // user picks a template, the assignment writes through the
  // lifecycle-config.jsx public API and the consumers re-render.
  function JobLifecyclePicker({ jobName, category }) {
    const store = window.useLifecycleStore ? window.useLifecycleStore() : window.getLifecycleStore();
    const kind = category === "professional" ? "pro" : "frontline";
    const templates = store.templates.filter((t) => t.kind === kind);
    const assigned = (store.jobAssignments[category] || {})[jobName] || "";
    const def = templates.find((t) => t.isDefault);
    const onPick = (id) => {
      window.setJobLifecycleTemplateId(jobName, category, id || null);
      if (window.showToast) {
        const t = templates.find((x) => x.id === id);
        if (id && t) window.showToast(`${jobName} → ${t.name}`, { kind: "success" });
        else        window.showToast(`${jobName} reset to default template`, { kind: "success" });
      }
    };
    const options = [
      { value: "", label: def ? `Default (${def.name})` : "Default" },
      ...templates.map((t) => ({ value: t.id, label: t.name + (t.isDefault ? " · default" : "") })),
    ];
    return (
      <div className="lct-jobpick">
        <Dropdown options={options} value={assigned} onChange={onPick} />
        {assigned && <span className="lct-jobpick-tag">Override</span>}
      </div>
    );
  }

  Object.assign(window, {
    LifecycleSettingsPage,
    JobLifecyclePicker,
  });
})();
