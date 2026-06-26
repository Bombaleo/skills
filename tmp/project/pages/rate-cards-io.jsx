// =====================================================================
// Flex Work — Rate Cards import / export   v1.44
//
// Tier-agnostic export/import. Both panels take a `target` adapter
// (window.rcMakeTarget) so the SAME flow serves every surface:
//   · global  — Settings → Jobs → Rate cards (writes the version rows)
//   · node    — any org tier (writes per-node overrides over inherited)
//   · agency  — supplier contract (writes all-locations base-pay overrides)
//
//   · RcExportPanel — pick positions, which rate column(s) to emit
//     (base = pre-parity, peak = post-parity, or both), and whether to
//     include season-uplift columns. Agency targets export base pay only.
//   · RcImportPanel — drop a CSV, map rows to positions by name, resolve
//     conflicts with one of three strategies:
//       update  → apply every changed row
//       review  → choose the value per row
//       addnew  → global: add positions not on the card; node/agency:
//                 only set positions that still inherit (no override yet)
//
// Reads helpers from pages/rate-cards.jsx (window.*). Shares SidePanel /
// Field / Switch and reuses the .imp-* dropzone vocabulary.
//
// Loads AFTER pages/rate-cards.jsx + req-shared + req-side-panels and
// BEFORE pages/rate-cards-ui.jsx. Components are exposed on window.
// =====================================================================

const { useState: useRcIo, useEffect: useRcIoEffect, useMemo: useRcIoMemo, useRef: useRcIoRef } = React;

function rcioCur() { return (typeof window !== "undefined" && window.curSymbol) ? window.curSymbol() : "$"; }

// Group a list of job names into Professional / Frontline by the catalog.
function rcioGroups(orgId, jobNames) {
  const pro = new Set((window.getJobsList ? window.getJobsList(orgId, "professional") : []) || []);
  const P = [], F = [];
  (jobNames || []).forEach((j) => (pro.has(j) ? P : F).push(j));
  const out = [];
  if (P.length) out.push({ key: "Professional", dot: "pro", jobs: P });
  if (F.length) out.push({ key: "Frontline", dot: "fl", jobs: F });
  return out;
}

function rcioUpliftLabel(u) {
  if (!u || !u.value) return "None";
  return u.mode === "abs" ? `+${rcioCur()}${u.value}` : `+${u.value}%`;
}

function rcioFileSize(bytes) {
  if (bytes == null) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function rcioSlug(s) {
  return String(s || "rate-card").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "rate-card";
}

// =====================================================================
// EXPORT panel
// =====================================================================
function RcExportPanel({ open, target, onClose }) {
  const allJobs = useRcIoMemo(() => (open && target ? target.allJobs() : []), [open, target]);
  const [rates, setRates] = useRcIo("both");          // "base" | "peak" | "both"
  const [includeSeason, setIncludeSeason] = useRcIo(true);
  const [picked, setPicked] = useRcIo({});             // job -> bool
  const [query, setQuery] = useRcIo("");

  useRcIoEffect(() => {
    if (!open || !target) return;
    setRates(target.allowRates ? "both" : "base");
    setIncludeSeason(!!target.allowSeason);
    setQuery("");
    const all = {};
    allJobs.forEach((j) => { all[j] = true; });
    setPicked(all);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open || !target) return null;

  const filtered = allJobs.filter((j) => !query.trim() || j.toLowerCase().includes(query.trim().toLowerCase()));
  const groups = rcioGroups(target.orgId, filtered);
  const selectedJobs = allJobs.filter((j) => picked[j]);
  const selCount = selectedJobs.length;

  const allOn = filtered.length > 0 && filtered.every((j) => picked[j]);
  const toggleAll = () => {
    const next = { ...picked };
    filtered.forEach((j) => { next[j] = !allOn; });
    setPicked(next);
  };

  const doExport = () => {
    if (!selCount) { window.showToast && window.showToast("Select at least one job to export", { kind: "warning" }); return; }
    const csv = target.buildCsv({ jobs: selectedJobs, rates, includeSeason });
    const fname = `rate-card_${rcioSlug(target.contextLabel)}.csv`;
    window.rcDownloadCsv(fname, csv);
    window.showToast && window.showToast(`Exported ${selCount} job${selCount === 1 ? "" : "s"} to ${fname}`, { kind: "success" });
    onClose && onClose();
  };

  const rateOpts = [
    { v: "base", label: "Base pay", sub: "Pre-parity" },
    { v: "peak", label: "Peak rate", sub: "Post-parity" },
    { v: "both", label: "Both", sub: "Pre + post" },
  ];

  return (
    <SidePanel
      open={open}
      title="Export rate card"
      onClose={onClose}
      footer={(
        <React.Fragment>
          <button type="button" className="btn btn--lg btn--tertiary" onClick={onClose}>Cancel</button>
          <button type="button" className="btn btn--lg btn--primary" onClick={doExport} disabled={!selCount}>
            <Icon name="FileDownload" size={16} />Export {selCount} job{selCount === 1 ? "" : "s"}
          </button>
        </React.Fragment>
      )}
    >
      <p className="rc-io-lead">
        Download the effective rates for <b>{target.contextLabel}</b> as a CSV. Choose which positions and which rate
        columns to include. Re-import the file later to update rates in bulk.
      </p>

      {target.allowRates && (
        <Field label="Rates to export" hint="Pre-parity is the worker's base pay. Post-parity is the in-season peak rate (base + uplift).">
          <div className="rc-io-rateseg" role="group" aria-label="Rates to export">
            {rateOpts.map((o) => (
              <button key={o.v} type="button" aria-pressed={rates === o.v} onClick={() => setRates(o.v)}>
                <span className="rc-io-rateseg-lab">{o.label}</span>
                <span className="rc-io-rateseg-sub">{o.sub}</span>
              </button>
            ))}
          </div>
        </Field>
      )}

      {target.allowSeason && (
        <div className="rc-io-switchrow">
          <Switch checked={includeSeason} onChange={setIncludeSeason} ariaLabel="Include season uplift columns" />
          <div>
            <div className="rc-io-switchrow-lab">Include season uplift columns</div>
            <div className="rc-io-switchrow-sub">Adds the uplift type and value per job, so the file round-trips.</div>
          </div>
        </div>
      )}

      <hr className="rc-panel-divider" />

      <div className="rc-io-listhead">
        <span className="rc-io-listhead-title">Positions <span className="rc-io-count">{selCount} of {allJobs.length}</span></span>
        <button type="button" className="rc-linkbtn" onClick={toggleAll}>{allOn ? "Clear all" : "Select all"}</button>
      </div>

      <div className="jobs-search" style={{ width: "100%", marginBottom: 10 }}>
        <span className="jobs-search-icon" aria-hidden="true"><Icon name="Search" size={16} /></span>
        <input type="text" className="jobs-search-input" placeholder="Search positions" value={query}
          onChange={(e) => setQuery(e.target.value)} aria-label="Search positions" />
      </div>

      <div className="rc-io-joblist">
        {groups.length === 0 && <div className="rc-empty">No positions match “{query}”.</div>}
        {groups.map((g) => (
          <div className="rc-io-jobgroup" key={g.key}>
            <div className="rc-io-jobgroup-head">{g.key}</div>
            {g.jobs.map((job) => {
              const r = target.rowFor(job) || { basePay: 0 };
              return (
                <label className="rc-io-jobitem" key={job}>
                  <input type="checkbox" checked={!!picked[job]} onChange={(e) => setPicked({ ...picked, [job]: e.target.checked })} />
                  <span className={"jobs-row-dot jobs-row-dot--" + g.dot} aria-hidden="true" />
                  <span className="rc-io-jobitem-name">{job}</span>
                  <span className="rc-io-jobitem-rate">{rcioCur()}{r.basePay}{target.allowSeason ? <span className="rc-io-jobitem-up"> · {rcioUpliftLabel(r.uplift)}</span> : null}</span>
                </label>
              );
            })}
          </div>
        ))}
      </div>
    </SidePanel>
  );
}

// =====================================================================
// IMPORT panel
// =====================================================================
function RcImportPanel({ open, target, onClose }) {
  const [step, setStep] = useRcIo("drop");        // "drop" | "preview"
  const [file, setFile] = useRcIo(null);           // { name, size }
  const [parsing, setParsing] = useRcIo(false);
  const [parsed, setParsed] = useRcIo(null);       // { rows, columns, warnings }
  const [strategy, setStrategy] = useRcIo("update");
  const [drag, setDrag] = useRcIo(false);
  const [picks, setPicks] = useRcIo({});           // review: job -> "file" | "current"
  const inputRef = useRcIoRef(null);

  useRcIoEffect(() => {
    if (!open) return;
    setStep("drop"); setFile(null); setParsing(false); setParsed(null);
    setStrategy("update"); setDrag(false); setPicks({});
  }, [open]);

  const diff = useRcIoMemo(() => {
    if (!parsed || !target) return null;
    return target.diff(parsed.rows);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parsed, target]);

  // Default review picks: take the file for every applicable row.
  useRcIoEffect(() => {
    if (!diff) return;
    const next = {};
    diff.items.forEach((it) => { if (it.willApplyUpdate) next[it.job] = "file"; });
    setPicks(next);
  }, [diff]);

  if (!open || !target) return null;

  const handleFiles = (fileList) => {
    const f = fileList && fileList[0];
    if (!f) return;
    setFile({ name: f.name, size: f.size });
    setParsing(true);
    const reader = new FileReader();
    reader.onload = () => {
      const res = target.parseCsv(String(reader.result || ""));
      setTimeout(() => { setParsed(res); setParsing(false); setStep("preview"); }, 400);
    };
    reader.onerror = () => { setParsing(false); window.showToast && window.showToast("Couldn't read that file", { kind: "error" }); };
    reader.readAsText(f);
  };

  const onDrop = (e) => { e.preventDefault(); setDrag(false); handleFiles(e.dataTransfer.files); };
  const reset = () => { setStep("drop"); setFile(null); setParsed(null); setPicks({}); };

  const downloadTemplate = (e) => {
    e.preventDefault();
    window.rcDownloadCsv(`rate-card_${rcioSlug(target.contextLabel)}_template.csv`, target.templateCsv());
    window.showToast && window.showToast("Downloaded the current rates as a starting file", { kind: "success" });
  };

  const noJobCol = parsed && !parsed.columns.job;
  const allWarnings = parsed ? parsed.warnings.concat((diff && diff.warnings) || []) : [];
  const canApply = (() => {
    if (!diff || noJobCol) return false;
    if (strategy === "addnew") return diff.counts.addnew > 0;
    if (strategy === "review") return Object.keys(picks).some((j) => picks[j] === "file");
    return diff.counts.update > 0; // update
  })();

  const apply = () => {
    if (!diff) return;
    let res;
    if (strategy === "review") {
      const chosen = Object.keys(picks).filter((j) => picks[j] === "file");
      res = target.apply(parsed.rows, "review", chosen);
    } else {
      res = target.apply(parsed.rows, strategy);
    }
    const bits = [];
    if (res.updated) bits.push(`${res.updated} updated`);
    if (res.added) bits.push(`${res.added} ${target.kind === "global" ? "added" : "set"}`);
    if (res.skipped) bits.push(`${res.skipped} skipped`);
    window.showToast && window.showToast(`Import applied · ${bits.join(" · ") || "no changes"}`, { kind: "success" });
    onClose && onClose();
  };

  const applyLabel = (() => {
    if (!diff) return "Apply import";
    if (strategy === "addnew") return `Apply ${diff.counts.addnew} position${diff.counts.addnew === 1 ? "" : "s"}`;
    if (strategy === "review") {
      const n = Object.keys(picks).filter((j) => picks[j] === "file").length;
      return `Apply ${n} change${n === 1 ? "" : "s"}`;
    }
    return `Apply ${diff.counts.update} change${diff.counts.update === 1 ? "" : "s"}`;
  })();

  const STRATS = ["update", "review", "addnew"];

  return (
    <SidePanel
      open={open}
      title="Import rate card"
      onClose={onClose}
      footer={(
        <React.Fragment>
          <button type="button" className="btn btn--lg btn--tertiary" onClick={onClose}>Cancel</button>
          {step === "preview" && (
            <button type="button" className="btn btn--lg btn--primary" onClick={apply} disabled={!canApply}>
              <Icon name="Check" size={16} />{applyLabel}
            </button>
          )}
        </React.Fragment>
      )}
    >
      {step === "drop" && (
        <React.Fragment>
          <p className="rc-io-lead">
            Upload a CSV of positions and rates to update <b>{target.contextLabel}</b> in bulk. Rows are matched to
            positions by name. You choose how conflicts are resolved on the next step.
          </p>
          {target.importNote && (
            <div className="rc-io-warn rc-io-warn--info">
              <span className="rc-io-warn-icon" aria-hidden="true"><Icon name="Information" size={16} /></span>
              <span>{target.importNote}</span>
            </div>
          )}
          <div
            className={"imp-drop" + (drag ? " imp-drop--drag" : "") + (parsing ? " imp-drop--parsing" : "")}
            onDragEnter={(e) => { e.preventDefault(); setDrag(true); }}
            onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
            onDragLeave={() => setDrag(false)}
            onDrop={onDrop}
            onClick={parsing ? undefined : () => inputRef.current && inputRef.current.click()}
            role="button" tabIndex={0}
            onKeyDown={(e) => { if ((e.key === "Enter" || e.key === " ") && !parsing) inputRef.current && inputRef.current.click(); }}
          >
            <span className="imp-drop-icon" aria-hidden="true"><Icon name={parsing ? "Hourglass" : "FileUpload"} size={28} /></span>
            {parsing ? (
              <React.Fragment>
                <span className="imp-drop-title">Reading {file?.name}…</span>
                <span className="imp-drop-sub">Matching positions and rates</span>
              </React.Fragment>
            ) : (
              <React.Fragment>
                <span className="imp-drop-title">Drop a file or click to browse</span>
                <span className="imp-drop-formats">CSV · up to 5 MB</span>
              </React.Fragment>
            )}
            <input ref={inputRef} type="file" accept=".csv,text/csv" style={{ display: "none" }}
              onChange={(e) => handleFiles(e.target.files)} />
          </div>

          <a className="imp-template-link" href="#" onClick={downloadTemplate}>
            <span className="imp-template-icon" aria-hidden="true"><Icon name="File" size={24} /></span>
            <span className="imp-template-body">
              <span className="imp-template-name">Download the current rates as a template</span>
              <span className="imp-template-sub">rate-card_{rcioSlug(target.contextLabel)}_template.csv</span>
            </span>
          </a>

          <div className="rc-io-cols">
            <div className="rc-io-cols-title">Expected columns</div>
            <div className="rc-io-col"><code>Job</code><span>Position name — matched to the card.</span></div>
            <div className="rc-io-col"><code>Base pay (pre-parity)</code><span>Hourly base pay.</span></div>
            {target.allowSeason && <div className="rc-io-col"><code>Season uplift type</code><span>Percent or Amount. <span className="rc-io-opt">optional</span></span></div>}
            {target.allowSeason && <div className="rc-io-col"><code>Season uplift value</code><span>The uplift number. <span className="rc-io-opt">optional</span></span></div>}
          </div>
        </React.Fragment>
      )}

      {step === "preview" && parsed && diff && (
        <React.Fragment>
          <div className="imp-file">
            <span className="imp-file-icon" aria-hidden="true"><Icon name="File" size={20} /></span>
            <span className="imp-file-body">
              <span className="imp-file-name">{file.name}</span>
              <span className="imp-file-meta">CSV<span aria-hidden="true">·</span>{rcioFileSize(file.size)}<span aria-hidden="true">·</span>{parsed.rows.length} rows</span>
            </span>
            <button type="button" className="btn btn--sm btn--tertiary" onClick={reset}><Icon name="Cancel" size={14} />Replace</button>
          </div>

          {allWarnings.map((w, i) => (
            <div className="rc-io-warn" key={i}>
              <span className="rc-io-warn-icon" aria-hidden="true"><Icon name="Alert" size={16} /></span>
              <span>{w}</span>
            </div>
          ))}

          {!noJobCol && (
            <div className="rc-io-summary">
              <div className="rc-io-stat"><span className="rc-io-stat-num">{diff.counts.total}</span><span className="rc-io-stat-lab">in file</span></div>
              <div className="rc-io-stat rc-io-stat--diff"><span className="rc-io-stat-num">{diff.counts.diff}</span><span className="rc-io-stat-lab">changed</span></div>
              {target.kind === "global"
                ? <div className="rc-io-stat rc-io-stat--new"><span className="rc-io-stat-num">{diff.counts.new}</span><span className="rc-io-stat-lab">new</span></div>
                : <div className="rc-io-stat rc-io-stat--new"><span className="rc-io-stat-num">{diff.counts.addnew}</span><span className="rc-io-stat-lab">inherited</span></div>}
              <div className="rc-io-stat rc-io-stat--same"><span className="rc-io-stat-num">{diff.counts.same}</span><span className="rc-io-stat-lab">unchanged</span></div>
            </div>
          )}

          {!noJobCol && (
            <React.Fragment>
              <div className="rc-io-listhead"><span className="rc-io-listhead-title">When rates conflict</span></div>
              <div className="rc-io-strategies" role="radiogroup" aria-label="Conflict strategy">
                {STRATS.map((v) => {
                  const t = target.strategyText[v];
                  return (
                    <button key={v} type="button" role="radio" aria-checked={strategy === v}
                      className={"rc-io-strategy" + (strategy === v ? " is-active" : "")} onClick={() => setStrategy(v)}>
                      <span className="rc-io-strategy-radio" aria-hidden="true" />
                      <span className="rc-io-strategy-body">
                        <span className="rc-io-strategy-title">{t.title}</span>
                        <span className="rc-io-strategy-sub">{t.sub}</span>
                      </span>
                    </button>
                  );
                })}
              </div>

              <RcImportDetail diff={diff} strategy={strategy} picks={picks} setPicks={setPicks} target={target} />
            </React.Fragment>
          )}
        </React.Fragment>
      )}
    </SidePanel>
  );
}

// Per-strategy detail list under the strategy picker.
function RcImportDetail({ diff, strategy, picks, setPicks, target }) {
  const isGlobal = target.kind === "global";
  const changed = diff.items.filter((x) => x.status === "diff");
  const added = diff.items.filter((x) => x.status === "new");          // global only
  const addnewItems = diff.items.filter((x) => x.willApplyAddNew);

  if (strategy === "addnew") {
    if (!addnewItems.length) {
      return <div className="rc-io-detail-empty">{isGlobal
        ? "No new positions in this file. Every position already exists on the card."
        : "Nothing to set — every position in the file already has an override or matches the inherited rate."}</div>;
    }
    return (
      <div className="rc-io-detail">
        <div className="rc-io-detail-head">{addnewItems.length} position{addnewItems.length === 1 ? "" : "s"} will be {isGlobal ? "added" : "overridden"}</div>
        {addnewItems.map((it) => <RcDiffRow key={it.job} it={it} mode={isGlobal ? "new" : "update"} />)}
      </div>
    );
  }

  if (strategy === "update") {
    if (!changed.length && !added.length) return <div className="rc-io-detail-empty">Nothing to apply — the file matches the current rates exactly.</div>;
    return (
      <div className="rc-io-detail">
        {changed.length > 0 && <div className="rc-io-detail-head">{changed.length} rate{changed.length === 1 ? "" : "s"} will change</div>}
        {changed.map((it) => <RcDiffRow key={it.job} it={it} mode="update" />)}
        {added.length > 0 && <div className="rc-io-detail-head" style={{ marginTop: changed.length ? 10 : 0 }}>{added.length} new position{added.length === 1 ? "" : "s"} will be added</div>}
        {added.map((it) => <RcDiffRow key={it.job} it={it} mode="new" />)}
      </div>
    );
  }

  // review
  const rows = diff.items.filter((x) => x.willApplyUpdate || x.status === "new");
  if (!rows.length) return <div className="rc-io-detail-empty">No differences to review — the file matches the current rates.</div>;
  return (
    <div className="rc-io-detail">
      <div className="rc-io-detail-head">Pick a value for each {rows.length} difference{rows.length === 1 ? "" : "s"}</div>
      {rows.map((it) => (
        <RcDiffRow key={it.job} it={it} mode="review" pick={picks[it.job] || "current"}
          onPick={(v) => setPicks({ ...picks, [it.job]: v })} />
      ))}
    </div>
  );
}

function RcDiffRow({ it, mode, pick, onPick }) {
  const cur = it.current;
  const inc = it.incoming;
  const curBase = cur ? `${rcioCur()}${cur.basePay}` : "—";
  const incBase = inc.basePay != null ? `${rcioCur()}${inc.basePay}` : (cur ? `${rcioCur()}${cur.basePay}` : "—");
  const baseChanged = cur && inc.basePay != null && Number(inc.basePay) !== Number(cur.basePay);
  const upChanged = inc.uplift && (!cur || rcioUpliftLabel(inc.uplift) !== rcioUpliftLabel(cur.uplift));

  return (
    <div className={"rc-io-diffrow" + (mode === "review" ? " rc-io-diffrow--review" : "")}>
      <div className="rc-io-diff-main">
        <span className="rc-io-diff-job">{it.job}{it.fromInherited && it.status !== "new" ? <span className="rc-io-diff-inh">inherited</span> : null}</span>
        {mode === "new" ? (
          <span className="rc-io-diff-vals">
            <span className="rc-io-diff-add">{incBase}{inc.uplift ? ` · ${rcioUpliftLabel(inc.uplift)}` : ""}</span>
            <span className="rc-io-newpill">New</span>
          </span>
        ) : (
          <span className="rc-io-diff-vals">
            <span className={"rc-io-diff-from" + (mode === "review" && pick === "current" ? " is-kept" : "")}>{curBase}{cur && cur.uplift ? ` · ${rcioUpliftLabel(cur.uplift)}` : ""}</span>
            <span className="rc-io-diff-arrow" aria-hidden="true"><Icon name="ArrowRight" size={13} /></span>
            <span className={"rc-io-diff-to" + (mode === "review" && pick === "file" ? " is-kept" : "")}>
              {baseChanged || mode !== "review" ? incBase : curBase}{(upChanged && inc.uplift) ? ` · ${rcioUpliftLabel(inc.uplift)}` : (cur && cur.uplift ? ` · ${rcioUpliftLabel(cur.uplift)}` : "")}
            </span>
          </span>
        )}
      </div>
      {mode === "review" && (
        <div className="rc-io-pickseg" role="group" aria-label={`Choose value for ${it.job}`}>
          <button type="button" aria-pressed={pick === "current"} onClick={() => onPick("current")}>Keep current</button>
          <button type="button" aria-pressed={pick === "file"} onClick={() => onPick("file")}>Use file</button>
        </div>
      )}
    </div>
  );
}

Object.assign(window, {
  RcExportPanel,
  RcImportPanel,
});
