// =====================================================================
// Flex Work — Settings → Jobs
//
// The Jobs tab lives in Settings and lists every job a requester sees
// in the "Job" picker on a new requisition. Source-of-truth for the
// catalog is Dayforce Core; this page shows the synced view and lets
// admins add / retire jobs.
//
// Layout
//   · Header (title + sub + Dayforce sync chip)
//   · Frontline / Professional tabs when both categories are enabled
//     for the active org. Otherwise the single enabled category
//     renders as a flat list with no tab bar.
//   · KPI strip (total + per-category counts)
//   · Toolbar — search, count, "Add job" primary
//   · Card with the active list. Each row carries a source pill
//     (Dayforce Core or Custom) and a remove action.
//
// Storage + sync live in pages/jobs-config.jsx — this file is purely
// the UI over that store, plus a small "Add job" inline panel.
// =====================================================================

const { useState: useJsState, useEffect: useJsEffect, useMemo: useJsMemo, useRef: useJsRef } = React;

// --------------------------------------------------------------------
// Local helpers — bind to the live jobs-config store.
// --------------------------------------------------------------------
function js_orgId() {
  return (window.getCurrentIndustryId && window.getCurrentIndustryId()) || "manufacturing";
}
function js_categoryConfig() {
  if (window.getJobsCategoryConfig) return window.getJobsCategoryConfig();
  return { frontline: true, professional: false };
}
function js_list(category) {
  if (window.getJobsList) return window.getJobsList(null, category);
  return [];
}
function js_setList(category, list) {
  if (window.setJobsList) return window.setJobsList(null, category, list);
  return false;
}

// "Dayforce Core" applies to every job that is part of the seed catalog
// for this org × category. Anything added by the admin via the "+ Add
// job" form lands as "Custom" until it's promoted into the upstream
// HCM. We can derive this purely from the seed list — no extra store.
const _SEED_FRONTLINE_SET = new Set([
  "Production Associate", "Production Line Associate", "Pickers",
  "Packers", "Forklift Operator", "Warehouse Associate",
  "Material Handler", "Quality Inspector", "Machine Operator",
  "Line Managers", "Sorter", "Loader / Unloader",
  // Helios localisation
  "Reactor Yard", "Power Plant", "Powerline Way", "Turbine Blvd.",
]);
const _SEED_PROFESSIONAL_SET = new Set([
  "Software Engineer", "Senior Software Engineer", "Engineering Manager",
  "Product Manager", "Project Manager", "Business Analyst",
  "Data Analyst", "Data Scientist", "UX Designer", "Product Designer",
  "DevOps Engineer", "QA Engineer", "Financial Analyst",
  "Marketing Manager", "HR Business Partner", "Operations Manager",
]);
function js_sourceFor(category, name) {
  // First try the localised version of the name (industry packs may
  // re-write "Production Associate" → "Reactor Operator" etc.). If
  // either the raw or the localised form is in the seed set, call it
  // a Dayforce Core row; otherwise Custom.
  const localised = (window.localize ? window.localize(name) : name);
  const set = category === "professional" ? _SEED_PROFESSIONAL_SET : _SEED_FRONTLINE_SET;
  if (set.has(name) || set.has(localised)) return "core";
  // Helios renames every Frontline title; treat anything inside the
  // localised seed envelope (Helios pack) as core too.
  const ind = (window.getIndustry && window.getIndustry()) || null;
  if (ind && ind.localize) {
    for (const k of Object.keys(ind.localize)) {
      if (ind.localize[k] === name) return "core";
    }
  }
  return "custom";
}

// --------------------------------------------------------------------
// Add-job inline panel — small, lives at the top of the card. Shows
// the input + a hint about case-insensitive de-duplication.
// --------------------------------------------------------------------
function JobsAddRow({ category, onAdded }) {
  const [val, setVal] = useJsState("");
  const inputRef = useJsRef(null);
  const submit = () => {
    const trimmed = val.trim();
    if (!trimmed) return;
    const list = js_list(category);
    if (list.some((x) => x.toLowerCase() === trimmed.toLowerCase())) {
      if (window.showToast) window.showToast(`"${trimmed}" already exists in this list`, { kind: "warning" });
      return;
    }
    js_setList(category, list.concat([trimmed]));
    setVal("");
    if (window.showToast) window.showToast(`Added "${trimmed}"`, { kind: "success" });
    if (inputRef.current) inputRef.current.focus();
    onAdded && onAdded(trimmed);
  };
  return (
    <div className="jobs-add">
      <span className="jobs-add-icon" aria-hidden="true">
        <Icon name="AddCircle" size={18} />
      </span>
      <input
        ref={inputRef}
        type="text"
        className="jobs-add-input"
        placeholder={"Add a " + (category === "professional" ? "professional" : "frontline") + " job title\u2026"}
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); submit(); } }}
        aria-label="New job title"
      />
      <button
        type="button"
        className="jobs-add-btn"
        onClick={submit}
        disabled={!val.trim()}
      >
        <Icon name="AddCircle" size={14} />
        Add job
      </button>
    </div>
  );
}

// --------------------------------------------------------------------
// Single job list — renders the search + the table for one category.
// --------------------------------------------------------------------
function JobsCategoryList({ category, onOpenJob }) {
  const [tick, setTick] = useJsState(0);
  const [query, setQuery] = useJsState("");
  useJsEffect(() => {
    function onChange(e) {
      if (!e || !e.detail || !e.detail.category || e.detail.category === category) {
        setTick((n) => n + 1);
      }
    }
    window.addEventListener("jobs:change", onChange);
    return () => window.removeEventListener("jobs:change", onChange);
  }, [category]);

  // tick is in the deps so the memo re-runs after every mutation.
  const list = useJsMemo(() => js_list(category), [category, tick]);
  const rows = useJsMemo(() => {
    return list.map((name) => ({
      name,
      source: js_sourceFor(category, name),
    }));
  }, [list, category]);

  const q = query.trim().toLowerCase();
  const filtered = q ? rows.filter((r) => r.name.toLowerCase().includes(q)) : rows;
  const coreCount = rows.filter((r) => r.source === "core").length;
  const customCount = rows.length - coreCount;

  function onRemove(name) {
    const next = list.filter((x) => x !== name);
    js_setList(category, next);
    if (window.showToast) window.showToast(`Removed "${name}"`, { kind: "success" });
  }

  return (
    <div className="jobs-pane">
      {/* Mini stats row */}
      <div className="jobs-stats">
        <span className="jobs-stat">
          <span className="jobs-stat-value tabular">{rows.length}</span>
          <span className="jobs-stat-label">total jobs</span>
        </span>
        <span className="jobs-stat-sep" aria-hidden="true">·</span>
        <span className="jobs-stat">
          <span className="jobs-stat-value tabular">{coreCount}</span>
          <span className="jobs-stat-label">from Dayforce Core</span>
        </span>
        {customCount > 0 && (
          <React.Fragment>
            <span className="jobs-stat-sep" aria-hidden="true">·</span>
            <span className="jobs-stat">
              <span className="jobs-stat-value tabular">{customCount}</span>
              <span className="jobs-stat-label">custom</span>
            </span>
          </React.Fragment>
        )}
      </div>

      {/* Toolbar */}
      <div className="jobs-toolbar">
        <div className="jobs-search">
          <span className="jobs-search-icon" aria-hidden="true">
            <Icon name="Search" size={16} />
          </span>
          <input
            type="text"
            className="jobs-search-input"
            placeholder="Search jobs"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search jobs"
          />
          {query && (
            <button
              type="button"
              className="jobs-search-clear"
              onClick={() => setQuery("")}
              aria-label="Clear search"
            >
              <Icon name="X" size={14} />
            </button>
          )}
        </div>
        <span className="jobs-count">
          {q ? `${filtered.length} of ${rows.length} matching` : `${rows.length} jobs`}
        </span>
      </div>

      {/* Add row */}
      <JobsAddRow category={category} />

      {/* Table */}
      <div className="jobs-card">
        {filtered.length === 0 ? (
          <div className="jobs-empty">
            {q ? (
              <React.Fragment>
                <p className="jobs-empty-title">No matches for &ldquo;{query}&rdquo;</p>
                <p className="jobs-empty-body">Try a different search term or add a new job title.</p>
              </React.Fragment>
            ) : (
              <React.Fragment>
                <p className="jobs-empty-title">No jobs configured yet</p>
                <p className="jobs-empty-body">Add the first job using the form above. Jobs you add here appear in the &ldquo;Job&rdquo; picker on every new requisition.</p>
              </React.Fragment>
            )}
          </div>
        ) : (
          <table className="jobs-table">
            <thead>
              <tr>
                <th>Job title</th>
                <th>Source</th>
                <th>Lifecycle template</th>
                <th>Used on requisitions</th>
                <th aria-label="Actions"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => {
                // Deterministic mock count so the column has signal
                // without bringing in a real reporting query. Hash the
                // name to a 0–60 range; "core" rows skew higher.
                let h = 0;
                for (let i = 0; i < row.name.length; i++) h = (h * 31 + row.name.charCodeAt(i)) >>> 0;
                const usage = (h % 60) + (row.source === "core" ? 6 : 0);
                return (
                  <tr key={row.name} className="jobs-table-row jobs-table-row--clickable"
                    onClick={(e) => {
                      // Ignore clicks inside interactive cells (picker, remove button).
                      if (e.target.closest(".lct-jobpick, .jobs-row-remove, button, select, input")) return;
                      onOpenJob && onOpenJob(row.name, category);
                    }}
                    style={{ cursor: onOpenJob ? "pointer" : "default" }}>
                    <td>
                      <div className="jobs-row-name">
                        <span className={"jobs-row-dot" + (category === "professional" ? " jobs-row-dot--pro" : " jobs-row-dot--fl")} aria-hidden="true" />
                        <button type="button" className="jobs-row-title-link"
                          onClick={(e) => { e.stopPropagation(); onOpenJob && onOpenJob(row.name, category); }}>
                          {row.name}
                        </button>
                      </div>
                    </td>
                    <td>
                      {row.source === "core" ? (
                        <span className="jobs-source-pill jobs-source-pill--core">
                          <Icon name="Link" size={11} />
                          Dayforce Core
                        </span>
                      ) : (
                        <span className="jobs-source-pill jobs-source-pill--custom">
                          <Icon name="Edit" size={11} />
                          Custom
                        </span>
                      )}
                    </td>
                    <td>
                      {window.JobLifecyclePicker
                        ? <window.JobLifecyclePicker jobName={row.name} category={category} />
                        : <span className="jobs-row-usage-zero">—</span>}
                    </td>
                    <td className="tabular jobs-row-usage">
                      {usage === 0 ? (
                        <span className="jobs-row-usage-zero">Never used</span>
                      ) : (
                        `${usage} open · ${(h % 9) + 3} this quarter`
                      )}
                    </td>
                    <td className="jobs-row-actions">
                      <button
                        type="button"
                        className="jobs-row-remove"
                        onClick={() => onRemove(row.name)}
                        aria-label={`Remove ${row.name}`}
                        title={`Remove ${row.name}`}
                      >
                        <Icon name="TrashCan" size={14} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// --------------------------------------------------------------------
// Job detail — opens when a job row is clicked. Shows the job's source,
// usage stats, and the lifecycle template assignment in editable form.
// The lifecycle template card mirrors the Templates rail in Settings →
// Lifecycle: pick from the list, see the selected template's task
// counts inline, jump to Settings → Lifecycle for full edit.
// --------------------------------------------------------------------
function JobDetailView({ name, category, onBack }) {
  const [tick, setTick] = useJsState(0);
  useJsEffect(() => {
    function onChange() { setTick((n) => n + 1); }
    window.addEventListener("flexwork:lifecycle:change", onChange);
    window.addEventListener("jobs:change", onChange);
    return () => {
      window.removeEventListener("flexwork:lifecycle:change", onChange);
      window.removeEventListener("jobs:change", onChange);
    };
  }, []);
  void tick;

  const source = js_sourceFor(category, name);
  const kind = category === "professional" ? "pro" : "frontline";
  const templates = (window.getLifecycleTemplates ? window.getLifecycleTemplates(kind) : []);
  const assignedId = (window.getJobLifecycleTemplateId ? window.getJobLifecycleTemplateId(name, category) : null);
  const resolved = (window.resolveLifecycleTemplateFor ? window.resolveLifecycleTemplateFor(name, category) : null);
  const def = templates.find((t) => t.isDefault);
  const isOverride = !!assignedId && resolved && def && resolved.id !== def.id;

  // Deterministic mock usage (same hash as the row uses) so the detail
  // shows the same numbers as the table.
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  const openReqs = (h % 60) + (source === "core" ? 6 : 0);
  const thisQuarter = (h % 9) + 3;

  const onPick = (id) => {
    if (!window.setJobLifecycleTemplateId) return;
    window.setJobLifecycleTemplateId(name, category, id || null);
    if (window.showToast) {
      const t = templates.find((x) => x.id === id);
      if (id && t) window.showToast(`${name} → ${t.name}`, { kind: "success" });
      else        window.showToast(`${name} reset to default template`, { kind: "success" });
    }
  };
  const onRemove = () => {
    if (typeof window.confirm === "function" && !window.confirm(`Remove "${name}" from the ${category} catalog? This will not affect existing requisitions.`)) return;
    const list = js_list(category);
    js_setList(category, list.filter((x) => x !== name));
    if (window.showToast) window.showToast(`Removed "${name}"`, { kind: "success" });
    onBack && onBack();
  };

  const options = [
    { value: "", label: def ? `Default (${def.name})` : "Default" },
    ...templates.map((t) => ({ value: t.id, label: t.name + (t.isDefault ? " · default" : "") })),
  ];

  const onbN = resolved ? (resolved.onboarding || []).filter((x) => x.enabled).length : 0;
  const offN = resolved ? (resolved.offboarding || []).filter((x) => x.enabled).length : 0;
  const conN = resolved ? (resolved.connectors  || []).filter((x) => x.enabled).length : 0;

  // First 6 enabled onboarding tasks — a peek at what the worker will run.
  const peek = resolved ? (resolved.onboarding || []).filter((x) => x.enabled).slice(0, 6) : [];

  return (
    <section className="jobs-detail">
      {/* Breadcrumb / back row */}
      <div className="jobs-detail-back">
        <button type="button" className="jobs-detail-back-btn" onClick={onBack}>
          <Icon name="ChevronLeft" size={14} />
          Back to Jobs
        </button>
      </div>

      {/* Hero card */}
      <header className="jobs-detail-hero">
        <div className="jobs-detail-hero-main">
          <div className="jobs-detail-hero-titlerow">
            <span className={"jobs-row-dot" + (category === "professional" ? " jobs-row-dot--pro" : " jobs-row-dot--fl")} aria-hidden="true" />
            <h2 className="jobs-detail-name">{name}</h2>
            <span className={"jobs-source-pill " + (source === "core" ? "jobs-source-pill--core" : "jobs-source-pill--custom")}>
              <Icon name={source === "core" ? "Link" : "Edit"} size={11} />
              {source === "core" ? "Dayforce Core" : "Custom"}
            </span>
            <span className={"lct-kind lct-kind--" + (kind === "pro" ? "pro" : "frontline")}>
              {kind === "pro" ? "Professional" : "Frontline"}
            </span>
          </div>
          <dl className="jobs-detail-meta">
            <div><dt>Category</dt><dd>{category === "professional" ? "Professional book of work" : "Frontline book of work"}</dd></div>
            <div><dt>Open requisitions</dt><dd className="tabular">{openReqs}</dd></div>
            <div><dt>Filled this quarter</dt><dd className="tabular">{thisQuarter}</dd></div>
          </dl>
        </div>
        <div className="jobs-detail-hero-actions">
          <button type="button" className="vms-btn vms-btn--sm vms-btn--tertiary" onClick={onRemove}
            style={{ color: "var(--evr-content-status-error-default)" }}>
            <Icon name="TrashCan" size={14} />Remove from catalog
          </button>
        </div>
      </header>

      {/* Lifecycle template card */}
      <section className="jobs-detail-card">
        <header className="jobs-detail-card-head">
          <div>
            <h3 className="jobs-detail-card-title">Lifecycle template</h3>
            <p className="jobs-detail-card-sub">
              The on-/offboarding catalog Flex Work runs when a worker on this job is onboarded or offboarded.
              {" "}
              {isOverride
                ? "This job has a per-role override — it does not follow the default template for its kind."
                : "This job follows the default template for its kind. Pick a specific template below to override."}
            </p>
          </div>
          {isOverride && <span className="lct-jobpick-tag">Override</span>}
        </header>

        <div className="jobs-detail-tpl-row">
          <label className="jobs-detail-tpl-field">
            <span className="sowi-lab">Assigned template</span>
            <Dropdown options={options} value={assignedId || ""} onChange={onPick} />
          </label>
          {resolved && (
            <button type="button" className="vms-btn vms-btn--sm vms-btn--secondary"
              onClick={() => {
                // Hand off to the chrome's settings dock — same pattern
                // every settings-side jump uses (a hash route on the
                // settings page). Falls back to a toast if the chrome
                // isn't initialised yet (rare).
                try { window.location.hash = "#/settings/lifecycle"; } catch (e) {}
                if (window.showToast) window.showToast(`Open Settings \u2192 Lifecycle to edit "${resolved.name}"`);
              }}>
              <Icon name="Edit" size={14} />Edit template
            </button>
          )}
        </div>

        {resolved ? (
          <div className="jobs-detail-tpl-resolved">
            <div className="jobs-detail-tpl-resolved-head">
              <span className={"lct-kind lct-kind--" + resolved.kind}>{resolved.kind === "pro" ? "Professional" : "Frontline"}</span>
              <span className="jobs-detail-tpl-name">{resolved.name}</span>
              {resolved.isDefault && <span className="lct-default">Default for {resolved.kind === "pro" ? "Pro" : "Frontline"}</span>}
            </div>
            {resolved.description && <p className="jobs-detail-tpl-desc">{resolved.description}</p>}
            <div className="jobs-detail-tpl-stats">
              <span className="jobs-detail-tpl-stat"><span className="tabular">{onbN}</span> onboarding tasks</span>
              <span className="jobs-detail-tpl-stat"><span className="tabular">{offN}</span> offboarding tasks</span>
              <span className="jobs-detail-tpl-stat"><span className="tabular">{conN}</span> connectors</span>
            </div>
            {peek.length > 0 && (
              <div className="jobs-detail-tpl-peek">
                <div className="jobs-detail-tpl-peek-h">First on-boarding tasks</div>
                <ul className="jobs-detail-tpl-peek-list" role="list">
                  {peek.map((t) => (
                    <li key={t.id} className="jobs-detail-tpl-peek-row">
                      <span className={"lc-owner lc-owner--" + t.owner}>
                        {t.owner === "worker" ? "Worker" : t.owner === "employer" ? "Employer" : "Shared"}
                      </span>
                      <span className="jobs-detail-tpl-peek-name">{t.label}</span>
                      {t.required && <span className="lc-req">Required</span>}
                      <span className="jobs-detail-tpl-peek-due">Due in {t.due}d</span>
                    </li>
                  ))}
                </ul>
                {(resolved.onboarding || []).filter((x) => x.enabled).length > peek.length && (
                  <p className="jobs-detail-tpl-peek-more">
                    +{(resolved.onboarding || []).filter((x) => x.enabled).length - peek.length} more onboarding task(s) &middot; full list in <b>Settings &rarr; Lifecycle</b>.
                  </p>
                )}
              </div>
            )}
          </div>
        ) : (
          <p className="jobs-detail-tpl-empty">
            No lifecycle templates configured for this kind yet. Open <b>Settings &rarr; Lifecycle</b> to author one.
          </p>
        )}
      </section>
    </section>
  );
}

// --------------------------------------------------------------------
// Page
// --------------------------------------------------------------------
function JobsSettingsPage() {
  const [tick, setTick] = useJsState(0);
  // Job detail navigation \u2014 when selectedJob is non-null we swap the
  // list for the detail view. Carries the row's name + category so the
  // detail can resolve the right lifecycle template and edit it in place.
  const [selectedJob, setSelectedJob] = useJsState(null);
  // v1.42 \u2014 top-level surface within Jobs: the job "catalog" (titles +
  // lifecycle) vs the tenant "rates" (versioned base-pay rate card). The
  // rate card cascades down the org hierarchy and onto agency contracts.
  const [mode, setMode] = useJsState("catalog");
  useJsEffect(() => {
    function onChange() { setTick((n) => n + 1); }
    window.addEventListener("featureflags:change", onChange);
    window.addEventListener("jobs:change", onChange);
    return () => {
      window.removeEventListener("featureflags:change", onChange);
      window.removeEventListener("jobs:change", onChange);
    };
  }, []);

  const cfg = js_categoryConfig(); // re-reads each render so the tab bar reacts to Configuration changes.
  void tick;

  const enabled = [];
  if (cfg.frontline)    enabled.push("frontline");
  if (cfg.professional) enabled.push("professional");

  // Default tab — first enabled category. Persist in local state so a
  // user's choice survives within the page.
  const [tab, setTab] = useJsState(() => enabled[0] || "frontline");
  useJsEffect(() => {
    // If the active tab gets disabled in Configuration, snap to the
    // first remaining enabled category.
    if (enabled.indexOf(tab) === -1 && enabled[0]) {
      setTab(enabled[0]);
    }
  }, [cfg.frontline, cfg.professional]); // eslint-disable-line

  const industry = (window.getIndustry && window.getIndustry()) || null;
  const orgName = (industry && industry.name) || "this organization";

  // Counts for the tab badges.
  const frontlineCount = js_list("frontline").length;
  const professionalCount = js_list("professional").length;

  return (
    <div className="set-content">
      <header className="set-content-header" style={{ display: "flex", flexDirection: "column", gap: 12, padding: "8px 4px 0" }}>
        <div className="jobs-header">
          <div className="jobs-header-text">
            <h2 className="set-content-title">Jobs</h2>
            <p className="set-content-sub">
              Every job a requester can pick on a new requisition for <strong>{orgName}</strong>. Synced
              from Dayforce Core{enabled.length === 2 ? <> across both <strong>Frontline</strong> and <strong>Professional</strong> books of work</> : enabled[0] === "professional" ? <> for the <strong>Professional</strong> book of work</> : <> for the <strong>Frontline</strong> book of work</>}.
            </p>
          </div>
          <span className="jobs-header-sync" title="Last synced from Dayforce Core">
            <span className="jobs-header-sync-dot" />
            <span>Synced from Dayforce Core</span>
            <span className="jobs-header-sync-sep">·</span>
            <span className="jobs-header-sync-time">2 min ago</span>
          </span>
        </div>

        {/* Surface switch: job catalog vs the tenant rate card. */}
        <div className="fw-tabs jobs-tabs" role="tablist" style={{ marginTop: 4 }}>
          <button
            type="button"
            role="tab"
            aria-pressed={mode === "catalog"}
            className="fw-tab"
            onClick={() => { setMode("catalog"); }}
          >
            <Icon name="Briefcase" size={16} />
            Job catalog
          </button>
          <button
            type="button"
            role="tab"
            aria-pressed={mode === "rates"}
            className="fw-tab"
            onClick={() => { setMode("rates"); setSelectedJob(null); }}
          >
            <Icon name="Pay" size={16} />
            Rate cards
          </button>
        </div>

        {/* Category tabs only in catalog mode, when >1 category is enabled. */}
        {mode === "catalog" && enabled.length > 1 && (
          <div className="fw-tabs jobs-tabs" role="tablist" style={{ marginTop: 4 }}>
            <button
              type="button"
              role="tab"
              aria-pressed={tab === "frontline"}
              className="fw-tab"
              onClick={() => setTab("frontline")}
            >
              <Icon name="Bag" size={16} />
              Frontline
              <span className="jobs-tab-count tabular">{frontlineCount}</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-pressed={tab === "professional"}
              className="fw-tab"
              onClick={() => setTab("professional")}
            >
              <Icon name="Briefcase" size={16} />
              Professional
              <span className="jobs-tab-count tabular">{professionalCount}</span>
            </button>
          </div>
        )}
      </header>

      {/* Rate cards surface takes over the whole body in "rates" mode. */}
      {mode === "rates" ? (
        window.RateCardsManager ? <window.RateCardsManager /> : (
          <section className="content-card"><div className="empty"><p className="empty-body">Rate cards are loading…</p></div></section>
        )
      ) :
      /* Detail view takes over when a job is selected. */
      selectedJob ? (
        <JobDetailView
          name={selectedJob.name}
          category={selectedJob.category}
          onBack={() => setSelectedJob(null)}
        />
      ) :
      /* Single-category orgs render a flat list; two-category orgs swap on tab. */
      enabled.length === 0 ? (
        <section className="content-card">
          <div className="empty">
            <h3 className="empty-title">No job categories enabled</h3>
            <p className="empty-body">
              Visit <strong>Settings &rarr; Configuration &rarr; Program &rarr; Jobs</strong> and turn on at least
              one of Frontline or Professional to start managing the catalog here.
            </p>
          </div>
        </section>
      ) : (
        <JobsCategoryList
          category={enabled.length > 1 ? tab : enabled[0]}
          onOpenJob={(name, category) => setSelectedJob({ name, category })}
        />
      )}
    </div>
  );
}

Object.assign(window, { JobsSettingsPage });
