// =====================================================================
// Flex Work — Rate Cards UI   v1.44
//
// Three surfaces, all reading the store in pages/rate-cards.jsx:
//   · RateCardsManager   — Settings → Jobs → "Rate cards" tab. Authors
//                          the tenant (global) base-pay card: versions +
//                          effective dates, the Peak season window, and
//                          per-job base pay + season uplift.
//   · NodeRateCardBody   — Org hierarchy detail (Corporate / Region /
//                          District / Site / Department). Shows the
//                          inherited card with an "Inherited / Custom"
//                          pill per job and a per-row override + reset.
//   · AgencyBasePayCard  — Agency contract detail. Inherits the org
//                          base pay; overrides per position × location.
//
// Loads AFTER pages/rate-cards.jsx + the shared primitives (req-shared
// → Field/TextInput/Dropdown/Switch, req-side-panels → SidePanel) and
// BEFORE app.jsx. Components are exposed on window so the (earlier-
// loaded) consumer pages resolve them at render time.
// =====================================================================

const { useState: useRc, useEffect: useRcEffect, useMemo: useRcMemo } = React;

function rcCur() { return (typeof window !== "undefined" && window.curSymbol) ? window.curSymbol() : "$"; }
function rcOrgId() { return (window.getCurrentIndustryId && window.getCurrentIndustryId()) || "manufacturing"; }
function rcFmtDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso + (iso.length === 10 ? "T00:00:00" : ""));
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

// Re-render hook bound to the rate-cards change event.
function useRcTick() {
  const [tick, setTick] = useRc(0);
  useRcEffect(() => {
    const on = () => setTick((n) => n + 1);
    const evt = window.RATECARDS_EVENT || "ratecards:change";
    window.addEventListener(evt, on);
    window.addEventListener("jobs:change", on);
    return () => {
      window.removeEventListener(evt, on);
      window.removeEventListener("jobs:change", on);
    };
  }, []);
  return tick;
}

// ---------- Small shared bits ----------------------------------------
function RcStatusPill({ status }) {
  const label = status === "active" ? "Active" : status === "scheduled" ? "Scheduled" : "Expired";
  return <span className={`rc-status rc-status--${status}`}>{label}</span>;
}

function RcUpliftControl({ uplift, onChange, disabled }) {
  const mode = (uplift && uplift.mode) || "pct";
  const value = uplift && uplift.value != null ? uplift.value : "";
  return (
    <div className="rc-uplift">
      <div className="rc-uplift-seg" role="group" aria-label="Season uplift type">
        <button type="button" aria-pressed={mode === "pct"} disabled={disabled}
          onClick={() => onChange({ mode: "pct", value: value === "" ? 0 : Number(value) })}>%</button>
        <button type="button" aria-pressed={mode === "abs"} disabled={disabled}
          onClick={() => onChange({ mode: "abs", value: value === "" ? 0 : Number(value) })}>{rcCur()}</button>
      </div>
      <input
        className="rc-uplift-val"
        type="number" min="0" step={mode === "pct" ? "1" : "0.5"}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange({ mode, value: e.target.value === "" ? 0 : Number(e.target.value) })}
        aria-label="Season uplift value"
      />
    </div>
  );
}

function RcPayInput({ value, onChange, readOnly }) {
  return (
    <span className={"rc-pay-input" + (readOnly ? " rc-pay-input--ro" : "")}>
      <span className="rc-cur" aria-hidden="true">{rcCur()}</span>
      <input
        type="number" min="0" step="0.25"
        value={value}
        readOnly={readOnly}
        onChange={(e) => onChange(e.target.value === "" ? 0 : Number(e.target.value))}
        aria-label="Base pay rate"
      />
    </span>
  );
}

// Export / Import toolbar shared by every tier. `target` is built by the
// caller via window.rcMakeTarget; `search` is the search field to sit on
// the left. Owns its own panel open-state.
function RcIoBar({ target, search }) {
  const [exp, setExp] = useRc(false);
  const [imp, setImp] = useRc(false);
  const ready = window.RcExportPanel && window.RcImportPanel && window.rcMakeTarget;
  return (
    <div className="rc-io-bar">
      <div className="rc-io-bar-search">{search}</div>
      <div className="rc-io-bar-actions">
        <button type="button" className="vms-btn vms-btn--sm vms-btn--secondary" onClick={() => setExp(true)}>
          <Icon name="FileDownload" size={14} />Export
        </button>
        <button type="button" className="vms-btn vms-btn--sm vms-btn--secondary" onClick={() => setImp(true)}>
          <Icon name="FileUpload" size={14} />Import
        </button>
      </div>
      {ready && <window.RcExportPanel open={exp} target={target} onClose={() => setExp(false)} />}
      {ready && <window.RcImportPanel open={imp} target={target} onClose={() => setImp(false)} />}
    </div>
  );
}

// Provenance cell — where an org node's rate comes from. Shows a
// Custom / Inherited pill plus the source name; a tooltip spells out the
// base-pay and (if different) season-uplift origins.
function RcSourceCell({ r, node }) {
  const segLabel = ((window.ORG_SEGMENT_SINGULAR && window.ORG_SEGMENT_SINGULAR[node.segment]) || "level").toLowerCase();
  if (r.ownOverride) {
    return <span className="rc-src rc-src--custom" title={`Custom rate set on this ${segLabel}`}><Icon name="Edit" size={11} />Custom</span>;
  }
  const bs = r.baseSource || { name: "Global rate card", level: "Global" };
  const fmt = (s) => (s.level && s.level !== "Global" ? `${s.name} · ${s.level}` : s.name);
  const baseName = fmt(bs);
  const us = r.upliftSource;
  const upliftDiffers = us && us.nodeId !== bs.nodeId && (us.value !== undefined || us.name);
  const tip = upliftDiffers
    ? `Base pay inherited from ${baseName}. Season uplift inherited from ${fmt(us)}.`
    : `Base pay and season uplift inherited from ${baseName}.`;
  return (
    <span className="rc-src-inherit" title={tip}>
      <span className="rc-src rc-src--inherited">Inherited</span>
      <span className="rc-src-from">from {baseName}</span>
      {upliftDiffers && <span className="rc-src-from rc-src-from--alt">uplift from {fmt(us)}</span>}
    </span>
  );
}

// Group a list of jobs into Professional / Frontline by the org catalog.
function useJobGroups(orgId, rows, query) {
  const tick = useRcTick();
  return useRcMemo(() => {
    const pro = new Set((window.getJobsList ? window.getJobsList(orgId, "professional") : []) || []);
    const q = (query || "").trim().toLowerCase();
    const jobs = Object.keys(rows || {}).filter((j) => !q || j.toLowerCase().includes(q));
    const P = [], F = [];
    jobs.forEach((j) => (pro.has(j) ? P : F).push(j));
    const groups = [];
    if (P.length) groups.push({ key: "Professional", dot: "pro", jobs: P });
    if (F.length) groups.push({ key: "Frontline", dot: "fl", jobs: F });
    return groups;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId, rows, query, tick]);
}

// =====================================================================
// CREATE-VERSION side panel
// =====================================================================
function RcCreateVersionPanel({ open, orgId, basedOnId, onClose, onCreated }) {
  const versions = open ? (window.getRateCardVersions ? window.getRateCardVersions(orgId) : []) : [];
  const [label, setLabel] = useRc("");
  const [effFrom, setEffFrom] = useRc("");
  const [base, setBase] = useRc(basedOnId || "");
  const [note, setNote] = useRc("");

  useRcEffect(() => {
    if (open) {
      const y = new Date().getFullYear() + 1;
      setLabel(`${y} rate card`);
      setEffFrom(`${y}-01-01`);
      setBase(basedOnId || (versions[0] && versions[0].id) || "");
      setNote("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const baseV = versions.find((v) => v.id === base);
  const create = () => {
    if (!effFrom) { window.showToast && window.showToast("Pick an effective date", { kind: "warning" }); return; }
    const v = window.createRateCardVersion(orgId, {
      label: label.trim() || "New rate card",
      effectiveFrom: effFrom,
      basedOnId: base || null,
      note: note.trim(),
      createdBy: (window.flexCurrentUserName && window.flexCurrentUserName()) || "You",
    });
    window.showToast && window.showToast(`Created "${v.label}" · effective ${rcFmtDate(effFrom)}`, { kind: "success" });
    onCreated && onCreated(v.id);
    onClose && onClose();
  };

  return (
    <SidePanel
      open={open}
      title="Create rate card version"
      onClose={onClose}
      footer={(
        <React.Fragment>
          <button type="button" className="btn btn--lg btn--tertiary" onClick={onClose}>Cancel</button>
          <button type="button" className="btn btn--lg btn--primary" onClick={create}>Create version</button>
        </React.Fragment>
      )}
    >
      <p className="rc-card-sub" style={{ marginBottom: 16 }}>
        A new version clones its rows from a starting card so you only edit what changed. It takes
        effect on its effective date and supersedes the prior version then.
      </p>
      <Field label="Version name">
        <TextInput value={label} onChange={setLabel} placeholder="2027 rate card" />
      </Field>
      <Field label="Effective from" hint="The version becomes active on this date.">
        <input type="date" className="rc-date-input" value={effFrom} onChange={(e) => setEffFrom(e.target.value)} aria-label="Effective from" />
      </Field>
      <Field label="Start from">
        <Dropdown
          options={versions.map((v) => ({ value: v.id, label: `${v.label} · eff ${rcFmtDate(v.effectiveFrom)}` }))}
          value={base}
          onChange={setBase}
          placeholder="Clone an existing version"
        />
      </Field>
      {baseV && (
        <div className="rc-basedon-card">
          Cloning <b>{Object.keys(baseV.rows || {}).length}</b> job rows and the peak season window from <b>{baseV.label}</b>.
        </div>
      )}
      <hr className="rc-panel-divider" />
      <Field label="Note" hint="Optional — shows in the versions list.">
        <TextInput value={note} onChange={setNote} placeholder="Annual base-pay refresh" />
      </Field>
    </SidePanel>
  );
}

// =====================================================================
// RateCardsManager — Settings → Jobs → Rate cards
// =====================================================================
function RateCardsManager() {
  const tick = useRcTick();
  const orgId = rcOrgId();
  const versions = useRcMemo(() => (window.getRateCardVersions ? window.getRateCardVersions(orgId) : []), [orgId, tick]);
  const active = useRcMemo(() => (window.getActiveRateCardVersion ? window.getActiveRateCardVersion(orgId) : null), [orgId, tick]);
  const [selId, setSelId] = useRc(null);
  const [query, setQuery] = useRc("");
  const [showVersions, setShowVersions] = useRc(false);
  const [createOpen, setCreateOpen] = useRc(false);
  const [exportOpen, setExportOpen] = useRc(false);
  const [importOpen, setImportOpen] = useRc(false);

  // Keep a valid selection; default to the active version.
  useRcEffect(() => {
    if (!versions.length) return;
    if (!selId || !versions.some((v) => v.id === selId)) {
      setSelId((active && active.id) || versions[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [versions, active]);

  const version = versions.find((v) => v.id === selId) || active || versions[0] || null;
  const status = version ? window.rcVersionStatus(version, orgId) : "active";
  const readOnly = status === "expired";
  const groups = useJobGroups(orgId, version ? version.rows : {}, query);

  if (!version) {
    return <div className="rc-empty">No rate card configured for this organization yet.</div>;
  }

  const setRow = (job, patch) => { window.setRateCardRow(orgId, version.id, job, patch); };
  const setSeason = (patch) => { window.setPeakSeason(orgId, version.id, { ...version.peakSeason, ...patch }); };
  const totalJobs = Object.keys(version.rows || {}).length;

  return (
    <div className="rc-pane">
      {/* Version bar */}
      <div className="rc-versionbar">
        <div className="rc-versionbar-main">
          <span className="rc-versionbar-icon" aria-hidden="true"><Icon name="Pay" size={22} /></span>
          <div className="rc-versionbar-text">
            <span className="rc-versionbar-title">
              {version.label}
              <RcStatusPill status={status} />
            </span>
            <span className="rc-versionbar-sub">
              Effective {rcFmtDate(version.effectiveFrom)} · {totalJobs} jobs · created by {version.createdBy}
            </span>
          </div>
        </div>
        <div className="rc-versionbar-actions">
          {versions.length > 1 && (
            <span className="rc-version-select">
              <Dropdown
                options={versions.map((v) => ({ value: v.id, label: `${v.label} · ${window.rcVersionStatus(v, orgId)}` }))}
                value={version.id}
                onChange={setSelId}
                small
              />
            </span>
          )}
          <button type="button" className="vms-btn vms-btn--sm vms-btn--secondary" onClick={() => setShowVersions((s) => !s)}>
            <Icon name="TimeUndo" size={14} />{showVersions ? "Hide versions" : `All versions (${versions.length})`}
          </button>
          <button type="button" className="vms-btn vms-btn--sm vms-btn--secondary" onClick={() => setExportOpen(true)}>
            <Icon name="FileDownload" size={14} />Export
          </button>
          <button type="button" className="vms-btn vms-btn--sm vms-btn--secondary" onClick={() => setImportOpen(true)}
            disabled={readOnly} title={readOnly ? "Select the active version to import" : undefined}>
            <Icon name="FileUpload" size={14} />Import
          </button>
          <button type="button" className="vms-btn vms-btn--sm vms-btn--primary" onClick={() => setCreateOpen(true)}>
            <Icon name="AddCircle" size={14} />Create new version
          </button>
        </div>
      </div>

      {/* Versions table */}
      {showVersions && (
        <div className="rc-table-card">
          <table className="rc-table">
            <thead>
              <tr>
                <th>Version</th>
                <th>Effective from</th>
                <th>Status</th>
                <th className="rc-num">Jobs</th>
                <th>Created by</th>
                <th aria-label="Actions"></th>
              </tr>
            </thead>
            <tbody>
              {versions.map((v) => {
                const st = window.rcVersionStatus(v, orgId);
                return (
                  <tr key={v.id} style={{ cursor: "pointer" }} onClick={() => setSelId(v.id)}>
                    <td>
                      <span className="rc-job-name">{v.label}</span>
                      {v.note ? <span className="rc-peak-sub">{v.note}</span> : null}
                    </td>
                    <td className="tabular">{rcFmtDate(v.effectiveFrom)}</td>
                    <td><RcStatusPill status={st} /></td>
                    <td className="rc-num tabular">{Object.keys(v.rows || {}).length}</td>
                    <td>{v.createdBy}</td>
                    <td className="rc-num">
                      <div className="rc-rowact">
                        <button type="button" className="rc-linkbtn" onClick={(e) => { e.stopPropagation(); setSelId(v.id); }}>
                          {v.id === version.id ? "Selected" : "View"}
                        </button>
                        {versions.length > 1 && st !== "active" && (
                          <button type="button" className="rc-linkbtn rc-linkbtn--muted"
                            onClick={(e) => {
                              e.stopPropagation();
                              window.openConfirm && window.openConfirm({
                                title: `Delete "${v.label}"?`,
                                body: "This rate card version will be removed. Active and other versions are unaffected.",
                                primaryLabel: "Delete", danger: true,
                                onConfirm: () => { window.deleteRateCardVersion(orgId, v.id); window.showToast && window.showToast("Version deleted", { kind: "success" }); },
                              });
                            }}>
                            <Icon name="TrashCan" size={13} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {readOnly && (
        <div className="rc-inherit-banner">
          <span className="rc-ib-icon" aria-hidden="true"><Icon name="TimeUndo" size={18} /></span>
          <span>You are viewing a <b>past version</b> (read-only). To change rates going forward, select the active version or create a new one with a future effective date.</span>
        </div>
      )}

      {/* Base pay table */}
      <div className="rc-card">
        <header className="rc-card-head">
          <span className="rc-card-head-icon" aria-hidden="true"><Icon name="MoneyBag" size={18} /></span>
          <div className="rc-card-head-text">
            <h3 className="rc-card-title">Base pay rates</h3>
            <p className="rc-card-sub">The worker's hourly base pay per job, before any agency markup. Set the season uplift as a percentage or a flat amount.</p>
          </div>
          <div className="jobs-search" style={{ flex: "0 0 auto", width: 280, maxWidth: "100%" }}>
            <span className="jobs-search-icon" aria-hidden="true"><Icon name="Search" size={16} /></span>
            <input type="text" className="jobs-search-input" placeholder="Search jobs" value={query}
              onChange={(e) => setQuery(e.target.value)} aria-label="Search jobs" />
          </div>
        </header>
        <div style={{ overflow: "hidden" }}>
          <table className="rc-table">
            <thead>
              <tr>
                <th>Job</th>
                <th className="rc-num">Base pay / hr</th>
                <th className="rc-num">Season uplift</th>
                <th className="rc-num">Peak rate / hr</th>
              </tr>
            </thead>
            <tbody>
              {groups.length === 0 && (
                <tr><td colSpan={4} className="rc-empty">No jobs match “{query}”.</td></tr>
              )}
              {groups.map((g) => (
                <React.Fragment key={g.key}>
                  <tr className="rc-group-row"><td colSpan={4}>{g.key}</td></tr>
                  {g.jobs.map((job) => {
                    const row = version.rows[job];
                    const peak = window.applyUplift(row.basePay, row.uplift);
                    return (
                      <tr key={job}>
                        <td>
                          <span className="rc-jobcell">
                            <span className={"jobs-row-dot jobs-row-dot--" + g.dot} aria-hidden="true" />
                            <span className="rc-job-name">{job}</span>
                          </span>
                        </td>
                        <td className="rc-num">
                          <RcPayInput value={row.basePay} readOnly={readOnly} onChange={(v) => setRow(job, { basePay: v })} />
                        </td>
                        <td className="rc-num">
                          <RcUpliftControl uplift={row.uplift} disabled={readOnly} onChange={(u) => setRow(job, { uplift: u })} />
                        </td>
                        <td className="rc-num">
                          <span className="rc-peak">{rcCur()}{peak}</span>
                          <span className="rc-peak-sub">{window.upliftLabel(row.uplift)} in season</span>
                        </td>
                      </tr>
                    );
                  })}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <RcCreateVersionPanel
        open={createOpen}
        orgId={orgId}
        basedOnId={version.id}
        onClose={() => setCreateOpen(false)}
        onCreated={(id) => setSelId(id)}
      />
      {window.RcExportPanel && window.rcMakeTarget && (
        <window.RcExportPanel open={exportOpen} target={window.rcMakeTarget({ kind: "global", orgId, version })} onClose={() => setExportOpen(false)} />
      )}
      {window.RcImportPanel && window.rcMakeTarget && (
        <window.RcImportPanel open={importOpen} target={window.rcMakeTarget({ kind: "global", orgId, version })} onClose={() => setImportOpen(false)} />
      )}
    </div>
  );
}

// =====================================================================
// NODE override editor (side panel) + NodeRateCardBody (org tree)
// =====================================================================
function RcNodeRowEditor({ open, orgId, node, job, resolved, onClose }) {
  const inheritedBase = resolved ? resolved.baseSource : null;
  const [basePay, setBasePay] = useRc(resolved ? resolved.basePay : 0);
  const [uplift, setUplift] = useRc(resolved ? resolved.uplift : { mode: "pct", value: 0 });

  useRcEffect(() => {
    if (open && resolved) { setBasePay(resolved.basePay); setUplift(resolved.uplift); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, job]);

  if (!open) return null;
  const peak = window.applyUplift(Number(basePay) || 0, uplift);
  const save = () => {
    window.setNodeOverride(orgId, node.id, job, { basePay: Number(basePay) || 0, uplift });
    window.showToast && window.showToast(`${job} overridden for ${node.name}`, { kind: "success" });
    onClose && onClose();
  };
  const reset = () => {
    window.setNodeOverride(orgId, node.id, job, null);
    window.showToast && window.showToast(`${job} reset to inherited`, { kind: "success" });
    onClose && onClose();
  };

  return (
    <SidePanel
      open={open}
      title={`Override · ${job}`}
      onClose={onClose}
      footer={(
        <React.Fragment>
          <button type="button" className="btn btn--lg btn--tertiary" onClick={onClose}>Cancel</button>
          {resolved && resolved.ownOverride && (
            <button type="button" className="btn btn--lg btn--secondary" onClick={reset}>Reset to inherited</button>
          )}
          <button type="button" className="btn btn--lg btn--primary" onClick={save}>Save override</button>
        </React.Fragment>
      )}
    >
      <div className="rc-inherit-banner" style={{ marginBottom: 16 }}>
        <span className="rc-ib-icon" aria-hidden="true"><Icon name="Information" size={18} /></span>
        <span>
          Setting a custom rate for <b>{node.name}</b> applies to this {(window.ORG_SEGMENT_SINGULAR && window.ORG_SEGMENT_SINGULAR[node.segment] || "level").toLowerCase()} and every level beneath it,
          unless they set their own override. Currently inherited from <b>{inheritedBase ? inheritedBase.name : "Global rate card"}</b>.
        </span>
      </div>
      <Field label="Base pay / hr">
        <RcPayInput value={basePay} onChange={setBasePay} />
      </Field>
      <Field label="Season uplift">
        <RcUpliftControl uplift={uplift} onChange={setUplift} />
      </Field>
      <div className="rc-preview">
        <div>
          <div className="rc-preview-label">Peak rate</div>
          <div className="rc-preview-peak">{window.upliftLabel(uplift)} in season</div>
        </div>
        <div className="rc-preview-val">{rcCur()}{peak}</div>
      </div>
    </SidePanel>
  );
}

function NodeRateCardBody({ node }) {
  const tick = useRcTick();
  const orgId = rcOrgId();
  const [query, setQuery] = useRc("");
  const [editJob, setEditJob] = useRc(null);
  const resolved = useRcMemo(
    () => (window.resolveNodeRateCard ? window.resolveNodeRateCard(orgId, node.id) : { version: null, rows: {} }),
    [orgId, node.id, tick]
  );
  const rows = resolved.rows || {};
  const groups = useJobGroups(orgId, rows, query);
  const customCount = Object.keys(rows).filter((j) => rows[j].ownOverride).length;

  if (!resolved.version) {
    return <div className="rc-empty">No global rate card to inherit from yet. Author one in Settings → Jobs → Rate cards.</div>;
  }

  return (
    <div className="rc-body">
      <div className="rc-inherit-banner">
        <span className="rc-ib-icon" aria-hidden="true"><Icon name="OrgChartVert" size={18} /></span>
        <span>
          Inherits the <b>{resolved.version.label}</b>. Override any job to set a custom base pay or season uplift
          for <b>{node.name}</b> and everything beneath it.
          {" "}
          <span className="rc-inherit-stat">{customCount > 0
            ? <><b>{customCount}</b> custom · <b>{Object.keys(rows).length - customCount}</b> inherited</>
            : <>All <b>{Object.keys(rows).length}</b> jobs inherited.</>}</span>
        </span>
      </div>

      <RcIoBar
        target={window.rcMakeTarget ? window.rcMakeTarget({ kind: "node", orgId, node }) : null}
        search={(
          <div className="jobs-search" style={{ flex: "1 1 auto", maxWidth: 360 }}>
            <span className="jobs-search-icon" aria-hidden="true"><Icon name="Search" size={16} /></span>
            <input type="text" className="jobs-search-input" placeholder="Search jobs" value={query}
              onChange={(e) => setQuery(e.target.value)} aria-label="Search jobs" />
          </div>
        )}
      />

      <div className="rc-table-card">
        <table className="rc-table">
          <thead>
            <tr>
              <th>Job</th>
              <th className="rc-num">Base pay / hr</th>
              <th className="rc-num">Season uplift</th>
              <th>Source</th>
              <th aria-label="Actions"></th>
            </tr>
          </thead>
          <tbody>
            {groups.length === 0 && <tr><td colSpan={5} className="rc-empty">No jobs match “{query}”.</td></tr>}
            {groups.map((g) => (
              <React.Fragment key={g.key}>
                <tr className="rc-group-row"><td colSpan={5}>{g.key}</td></tr>
                {g.jobs.map((job) => {
                  const r = rows[job];
                  return (
                    <tr key={job}>
                      <td>
                        <span className="rc-jobcell">
                          <span className={"jobs-row-dot jobs-row-dot--" + g.dot} aria-hidden="true" />
                          <span className="rc-job-name">{job}</span>
                        </span>
                      </td>
                      <td className="rc-num tabular rc-peak">{rcCur()}{r.basePay}</td>
                      <td className="rc-num">{window.upliftLabel(r.uplift)}</td>
                      <td>
                        <RcSourceCell r={r} node={node} />
                      </td>
                      <td className="rc-num">
                        <div className="rc-rowact">
                          {r.ownOverride ? (
                            <React.Fragment>
                              <button type="button" className="rc-linkbtn" onClick={() => setEditJob(job)}>Edit</button>
                              <button type="button" className="rc-linkbtn rc-linkbtn--muted"
                                onClick={() => { window.setNodeOverride(orgId, node.id, job, null); window.showToast && window.showToast(`${job} reset to inherited`, { kind: "success" }); }}>
                                Reset
                              </button>
                            </React.Fragment>
                          ) : (
                            <button type="button" className="rc-linkbtn" onClick={() => setEditJob(job)}>Override</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>

      <RcNodeRowEditor
        open={!!editJob}
        orgId={orgId}
        node={node}
        job={editJob}
        resolved={editJob ? rows[editJob] : null}
        onClose={() => setEditJob(null)}
      />
    </div>
  );
}

// =====================================================================
// AGENCY override editor (side panel) + AgencyBasePayCard
// =====================================================================
function RcAgencyRowEditor({ open, orgId, supplierId, job, row, onClose }) {
  const sites = useRcMemo(() => (window.getRateCardSites ? window.getRateCardSites() : []), []);
  const [scope, setScope] = useRc("all");
  const [basePay, setBasePay] = useRc(row ? row.inherited : 0);

  useRcEffect(() => {
    if (open && row) {
      const all = (row.scopes || []).find((s) => s.scope === "all");
      setScope("all");
      setBasePay(all ? all.basePay : row.inherited);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, job]);

  if (!open) return null;
  const scopeExisting = (row.scopes || []).find((s) => s.scope === scope);
  const onScopeChange = (sc) => {
    setScope(sc);
    const ex = (row.scopes || []).find((s) => s.scope === sc);
    setBasePay(ex ? ex.basePay : row.inherited);
  };
  const save = () => {
    window.setAgencyOverride(orgId, supplierId, job, scope, Number(basePay) || 0);
    window.showToast && window.showToast(`${job} base pay overridden · ${window.rcSiteName(scope)}`, { kind: "success" });
    onClose && onClose();
  };

  const scopeOptions = [{ value: "all", label: "All locations" }, ...sites.map((s) => ({ value: s.id, label: s.name }))];

  return (
    <SidePanel
      open={open}
      title={`Override base pay · ${job}`}
      onClose={onClose}
      footer={(
        <React.Fragment>
          <button type="button" className="btn btn--lg btn--tertiary" onClick={onClose}>Cancel</button>
          {scopeExisting && (
            <button type="button" className="btn btn--lg btn--secondary"
              onClick={() => { window.setAgencyOverride(orgId, supplierId, job, scope, null); window.showToast && window.showToast("Override removed", { kind: "success" }); onClose && onClose(); }}>
              Remove this scope
            </button>
          )}
          <button type="button" className="btn btn--lg btn--primary" onClick={save}>Save override</button>
        </React.Fragment>
      )}
    >
      <div className="rc-inherit-banner" style={{ marginBottom: 16 }}>
        <span className="rc-ib-icon" aria-hidden="true"><Icon name="Information" size={18} /></span>
        <span>This agency inherits a base pay of <b>{rcCur()}{row.inherited}/hr</b> for <b>{job}</b> from the buyer's rate card. Override it for all locations, or just one site.</span>
      </div>
      <Field label="Applies to">
        <Dropdown options={scopeOptions} value={scope} onChange={onScopeChange} searchable />
      </Field>
      <Field label="Base pay / hr">
        <RcPayInput value={basePay} onChange={setBasePay} />
      </Field>
      <div className="rc-preview">
        <div>
          <div className="rc-preview-label">Inherited</div>
          <div className="rc-preview-peak">{rcCur()}{row.inherited}/hr from buyer</div>
        </div>
        <div className="rc-preview-val">{rcCur()}{Number(basePay) || 0}</div>
      </div>
    </SidePanel>
  );
}

function AgencyBasePayCard({ supplierId, supplierName }) {
  const tick = useRcTick();
  const orgId = rcOrgId();
  const [query, setQuery] = useRc("");
  const [editJob, setEditJob] = useRc(null);
  const resolved = useRcMemo(
    () => (window.resolveAgencyRateCard ? window.resolveAgencyRateCard(orgId, supplierId) : { version: null, rows: {} }),
    [orgId, supplierId, tick]
  );
  const rows = resolved.rows || {};
  const groups = useJobGroups(orgId, rows, query);
  const ovrCount = Object.keys(rows).filter((j) => rows[j].hasOverride).length;

  if (!resolved.version) {
    return <div className="rc-empty">No buyer rate card to inherit from. Author one in Settings → Jobs → Rate cards.</div>;
  }

  return (
    <div className="rc-body">
      <div className="rc-inherit-banner">
        <span className="rc-ib-icon" aria-hidden="true"><Icon name="Pay" size={18} /></span>
        <span>
          Base pay inherits the buyer's <b>{resolved.version.label}</b>. Override per position, scoped to a single site or all locations.
          {" "}
          <span className="rc-inherit-stat">{ovrCount > 0 ? <><b>{ovrCount}</b> position{ovrCount === 1 ? "" : "s"} overridden.</> : "No overrides yet."}</span>
        </span>
      </div>

      <RcIoBar
        target={window.rcMakeTarget ? window.rcMakeTarget({ kind: "agency", orgId, supplierId, supplierName }) : null}
        search={(
          <div className="jobs-search" style={{ flex: "1 1 auto", maxWidth: 360 }}>
            <span className="jobs-search-icon" aria-hidden="true"><Icon name="Search" size={16} /></span>
            <input type="text" className="jobs-search-input" placeholder="Search positions" value={query}
              onChange={(e) => setQuery(e.target.value)} aria-label="Search positions" />
          </div>
        )}
      />

      <div className="rc-table-card">
        <table className="rc-table">
          <thead>
            <tr>
              <th>Position</th>
              <th className="rc-num">Inherited / hr</th>
              <th>Overrides</th>
              <th className="rc-num">Effective / hr</th>
              <th aria-label="Actions"></th>
            </tr>
          </thead>
          <tbody>
            {groups.length === 0 && <tr><td colSpan={5} className="rc-empty">No positions match “{query}”.</td></tr>}
            {groups.map((g) => (
              <React.Fragment key={g.key}>
                <tr className="rc-group-row"><td colSpan={5}>{g.key}</td></tr>
                {g.jobs.map((job) => {
                  const r = rows[job];
                  return (
                    <tr key={job}>
                      <td>
                        <span className="rc-jobcell">
                          <span className={"jobs-row-dot jobs-row-dot--" + g.dot} aria-hidden="true" />
                          <span className="rc-job-name">{job}</span>
                        </span>
                      </td>
                      <td className="rc-num tabular" style={{ color: "var(--evr-content-primary-lowemp)" }}>{rcCur()}{r.inherited}</td>
                      <td>
                        {r.scopes.length === 0 ? (
                          <span className="rc-src-inherit" title={`Base pay inherited from the buyer's ${resolved.version.label}`}>
                            <span className="rc-src rc-src--inherited">Inherited</span>
                            <span className="rc-src-from">from buyer rate card</span>
                          </span>
                        ) : (
                          <span className="rc-scope-chips">
                            {r.scopes.map((s) => (
                              <span className="rc-scope-chip" key={s.scope}>
                                <Icon name="Location" size={11} />
                                {window.rcSiteName(s.scope)}: {rcCur()}{s.basePay}
                                <button type="button" aria-label={`Remove ${window.rcSiteName(s.scope)} override`}
                                  onClick={() => { window.setAgencyOverride(orgId, supplierId, job, s.scope, null); window.showToast && window.showToast("Override removed", { kind: "success" }); }}>
                                  <Icon name="X" size={11} />
                                </button>
                              </span>
                            ))}
                          </span>
                        )}
                      </td>
                      <td className="rc-num rc-peak">
                        {r.hasOverride && r.effective !== r.inherited && <span className="rc-was">{rcCur()}{r.inherited}</span>}
                        {rcCur()}{r.effective}
                      </td>
                      <td className="rc-num">
                        <div className="rc-rowact">
                          <button type="button" className="rc-linkbtn" onClick={() => setEditJob(job)}>
                            {r.hasOverride ? "Edit" : "Override"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>

      <RcAgencyRowEditor
        open={!!editJob}
        orgId={orgId}
        supplierId={supplierId}
        job={editJob}
        row={editJob ? rows[editJob] : null}
        onClose={() => setEditJob(null)}
      />
    </div>
  );
}

Object.assign(window, {
  RateCardsManager,
  NodeRateCardBody,
  AgencyBasePayCard,
});
