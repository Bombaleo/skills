// =====================================================================
// Flex Work — Assign worker side panel (type-aware)
//
// The shared spine for placing a worker, now branching off the
// engagement-type matrix via window.AssignmentEngine:
//
//   · Shift              → allocate  (instant placement, with an
//                           availability guard + credential pre-check,
//                           plus bulk allocation and a buyer→worker
//                           offer loop)
//   · Assignment         → submit    (candidate submission → work
//                           order → supplier acceptance → onboarding
//                           gate → activate, all in the Pipeline)
//   · Project / SOW      → propose   (add a named resource to the
//                           engagement team; onboards against contract)
//
// Behaviour still diverges by role:
//   · viewAsRole === "agency" → supplier-side action (Assign / Submit
//                                / Add)
//   · everyone else           → buyer-side request, and buyer-side
//                                work-order review in the Pipeline
//
// Backward-compatible: schedule.jsx keeps calling openAssignWorkerPanel
// with { supplierId, role, onAssign, onRequest } and the Shift path is
// unchanged for the agency view. New cfg keys are all optional:
//   · engagementType   — defaults to "Shift"
//   · bulkCount        — opens bulk allocation mode
//   · bookingId / idx / day / reqId / projectId / sowId — context
//   · onBulkAssign(workers[])
// =====================================================================

const { useState: useStateAwp, useEffect: useEffectAwp, useMemo: useMemoAwp } = React;
const AE = () => window.AssignmentEngine;

// Public opener — schedule.jsx + satellites call this.
function openAssignWorkerPanel(cfg) {
  Interactions.emit("assignWorker", cfg);
}

// ----- Compliance / availability chips ---------------------------------
function AwpChip({ level, label, icon }) {
  return (
    <span className={"awp-chip awp-chip--" + (level || "ok")}>
      <Icon name={icon} size={12} />
      {label}
    </span>
  );
}

// ----- Performance + past-history detail (shown when reviewing a worker) --
// Surfaces the same numbers as the Workforce performance tab, scoped to
// the act of picking a worker for a requisition: rating + review count,
// reliability headline chips, an all-time KPI grid, a 6-month activity
// trend, and the sites the worker has been booked at before.
function AwpPerfDetail({ perf }) {
  const Stars = window.WfStars;
  const lastShift = perf.lastShiftDays === 0 ? "Today"
    : perf.lastShiftDays === 1 ? "1 day ago"
    : perf.lastShiftDays + " days ago";
  const tone = (v, good, ok) => (v >= good ? "ok" : v >= ok ? "warn" : "fail");
  const heads = [
    { k: "On-time starts", v: perf.onTime + "%", icon: "PersonClock", tone: tone(perf.onTime, 90, 75) },
    { k: "Reliability", v: perf.reliability + "%", icon: "ClipboardCircleCheck", tone: tone(perf.reliability, 90, 75) },
    { k: "Site rebook rate", v: perf.rebookRate + "%", icon: "Performance", tone: tone(perf.rebookRate, 60, 40) },
    { k: "Last shift", v: lastShift, icon: "Calendar", tone: perf.lastShiftDays > 30 ? "warn" : "ok" },
  ];
  const kpis = [
    { k: "Worked shifts", v: perf.worked },
    { k: "Cancelled", v: perf.cancelled, tone: perf.cancelled > 2 ? "warn" : null },
    { k: "No-shows", v: perf.noShows, tone: perf.noShows > 0 ? "fail" : null },
    { k: "Late starts", v: perf.lateStarts, tone: perf.lateStarts > 2 ? "warn" : null },
    { k: "Hours worked", v: perf.totalHours.toLocaleString() },
    { k: "Avg shift", v: perf.avgShiftHrs.toFixed(1) + " hrs" },
  ];
  const trendMax = Math.max(1, ...perf.trend.map((t) => t.worked + t.cancelled));
  return (
    <div className="awp-perf">
      <div className="awp-perf-top">
        <div className="awp-perf-rating">
          <div className="awp-perf-rating-num">
            <span className="tabular">{perf.rating.toFixed(1)}</span>
            <span className="awp-perf-rating-denom">/ 5.0</span>
          </div>
          {Stars ? <Stars value={perf.rating} size={15} /> : null}
          <span className="awp-perf-rating-sub">{perf.reviews} shift review{perf.reviews === 1 ? "" : "s"}</span>
        </div>
        <div className="awp-perf-heads">
          {heads.map((h) => (
            <div key={h.k} className={"awp-perf-head awp-perf-head--" + h.tone}>
              <Icon name={h.icon} size={14} />
              <div className="awp-perf-head-text">
                <span className="awp-perf-head-val tabular">{h.v}</span>
                <span className="awp-perf-head-k">{h.k}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="awp-perf-cols">
        <div className="awp-perf-kpis">
          {kpis.map((t) => (
            <div key={t.k} className={"awp-perf-kpi" + (t.tone ? " awp-perf-kpi--" + t.tone : "")}>
              <span className="awp-perf-kpi-val tabular">{t.v}</span>
              <span className="awp-perf-kpi-k">{t.k}</span>
            </div>
          ))}
        </div>
        <div className="awp-perf-trend">
          <div className="awp-perf-sub-h">6-month activity</div>
          <div className="awp-perf-bars">
            {perf.trend.map((t) => (
              <div key={t.mo} className="awp-perf-bar-col" title={`${t.mo}: ${t.worked} worked · ${t.cancelled} cancelled`}>
                <div className="awp-perf-bar-stack">
                  <div className="awp-perf-bar awp-perf-bar--cancelled" style={{ height: (t.cancelled / trendMax * 100) + "%" }} />
                  <div className="awp-perf-bar awp-perf-bar--worked" style={{ height: (t.worked / trendMax * 100) + "%" }} />
                </div>
                <span className="awp-perf-bar-mo">{t.mo}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="awp-perf-history">
        <div className="awp-perf-sub-h">
          <Icon name="Location" size={13} /> Past history · most-booked sites
        </div>
        <ul className="awp-perf-sites">
          {perf.sites.map((s, i) => (
            <li key={i} className="awp-perf-site">
              <span className="awp-perf-site-name">{s.name}</span>
              <span className="awp-perf-site-shifts tabular">{s.shifts} shift{s.shifts === 1 ? "" : "s"}</span>
              <span className="awp-perf-site-rating">
                {Stars ? <Stars value={s.rating} size={12} /> : null}
                <span className="tabular">{s.rating.toFixed(1)}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

// ----- Workers table row -----------------------------------------------
function AwpWorkerRow({
  worker, supplierMeta, perf, role, isQualified, showAgency = true,
  cred, avail, compatible, blocked, mode,
  bulk, checked, onToggle, onPick, primaryLabel,
  expanded, onToggleDetail,
}) {
  const Stars = window.WfStars;
  const credIcon = cred.level === "fail" ? "ShieldOff" : cred.level === "warn" ? "Alert" : "ShieldPerson";
  const availIcon = avail.conflict ? "Alert" : "Checkmark";
  const canExpand = !bulk;
  return (
    <div className={"awp-row" + (blocked ? " awp-row--blocked" : "") + (expanded ? " awp-row--expanded" : "")} role="row">
      <div className="awp-cell awp-cell--worker" role="cell">
        {bulk && (
          <input
            type="checkbox"
            className="awp-check"
            checked={!!checked}
            disabled={blocked}
            onChange={() => onToggle(worker)}
            aria-label={"Select " + worker.name}
          />
        )}
        <WorkerAvatar w={worker} size={36} />
        <div className="awp-worker-text">
          <span className="awp-worker-name">{worker.name}</span>
          <span className="awp-worker-sub">
            {(worker.jobs || []).slice(0, 2).join(" · ") || "—"}
            {!compatible && <span className="awp-worker-incompat"> · {AE().workerSupplierType(worker)}</span>}
          </span>
        </div>
        {canExpand && (
          <button
            type="button"
            className={"awp-disclosure" + (expanded ? " awp-disclosure--open" : "")}
            aria-expanded={!!expanded}
            aria-label={expanded ? "Hide performance and history" : "View performance and history"}
            onClick={() => onToggleDetail(worker)}
          >
            <Icon name="Performance" size={13} />
            <span>{expanded ? "Hide" : "Performance"}</span>
            <Icon name="ChevronDown" size={14} />
          </button>
        )}
      </div>
      {showAgency && (
        <div className="awp-cell awp-cell--agency" role="cell">
          <ReqSupplierChip id={worker.supplier} size={22} />
          <span className="awp-agency-name">{supplierMeta?.label || worker.supplier}</span>
        </div>
      )}
      <div className="awp-cell awp-cell--checks" role="cell">
        <AwpChip level={cred.level} label={cred.label} icon={credIcon} />
        {mode === "allocate" && <AwpChip level={avail.level} label={avail.label} icon={availIcon} />}
      </div>
      <div className="awp-cell awp-cell--rating" role="cell">
        {Stars ? <Stars value={perf.rating} size={14} /> : null}
        <span className="awp-rating-val tabular">{perf.rating.toFixed(1)}</span>
      </div>
      {!bulk && (
        <div className="awp-cell awp-cell--action" role="cell">
          <button
            type="button"
            className="btn btn--sm btn--secondary awp-pick-btn"
            disabled={blocked}
            title={blocked ? "Blocked by a credential or availability conflict" : undefined}
            onClick={() => onPick(worker)}
          >
            <Icon name={role === "agency" ? (mode === "allocate" ? "PersonCheck" : "Send") : "Send"} size={14} />
            {primaryLabel}
          </button>
        </div>
      )}
      {expanded && canExpand && (
        <div className="awp-detail-cell" role="cell">
          <AwpPerfDetail perf={perf} />
        </div>
      )}
    </div>
  );
}

// ----- Pipeline (work order + onboarding lifecycle) --------------------
function AwpStepper({ status }) {
  const steps = AE().lifecycle();
  const cur = AE().statusIndex(status);
  const rejected = status === "rejected";
  return (
    <ol className={"awp-steps" + (rejected ? " awp-steps--rejected" : "")}>
      {steps.map((s, i) => (
        <li key={s.id} className={"awp-step" + (i <= cur && !rejected ? " awp-step--done" : "") + (i === cur && !rejected ? " awp-step--cur" : "")}>
          <span className="awp-step-dot" />
          <span className="awp-step-label">{s.label}</span>
        </li>
      ))}
    </ol>
  );
}

function AwpPipelineCard({ rec, isAgency, onChange }) {
  const [obOpen, setObOpen] = useStateAwp(rec.status === "onboarding");
  const eng = AE();
  const act = (fn) => { fn(); onChange(); };
  const reqDone = eng.onboardingComplete(rec);

  let actions = null;
  if (rec.status === "submitted") {
    actions = isAgency
      ? <span className="awp-pl-wait">Awaiting buyer review</span>
      : <>
          <button type="button" className="btn btn--sm btn--primary" onClick={() => act(() => eng.setStatus(rec.id, "wo_pending", "Manager", "Work order issued"))}>Issue work order</button>
          <button type="button" className="btn btn--sm btn--tertiary awp-pl-reject" onClick={() => act(() => eng.reject(rec.id, "Not selected", "Manager"))}>Reject</button>
        </>;
  } else if (rec.status === "wo_pending") {
    actions = isAgency
      ? <button type="button" className="btn btn--sm btn--primary" onClick={() => act(() => eng.setStatus(rec.id, "wo_accepted", "Agency", "Work order accepted"))}>Accept work order</button>
      : <span className="awp-pl-wait">Sent to supplier for acceptance</span>;
  } else if (rec.status === "wo_accepted") {
    actions = <button type="button" className="btn btn--sm btn--secondary" onClick={() => act(() => { eng.setStatus(rec.id, "onboarding", isAgency ? "Agency" : "Manager", "Onboarding started"); setObOpen(true); })}>Start onboarding</button>;
  } else if (rec.status === "onboarding") {
    actions = isAgency
      ? <span className="awp-pl-wait">{reqDone ? "Ready to activate" : "Onboarding in progress"}</span>
      : <button type="button" className="btn btn--sm btn--primary" disabled={!reqDone} title={reqDone ? undefined : "All required items must clear first"} onClick={() => act(() => eng.setStatus(rec.id, "active", "Manager", "Activated"))}>Activate</button>;
  } else if (rec.status === "active") {
    actions = <span className="awp-pl-active"><Icon name="Checkmark" size={13} /> Active on engagement</span>;
  } else if (rec.status === "rejected") {
    actions = <span className="awp-pl-rejected"><Icon name="X" size={13} /> {rec.rejectReason || "Rejected"}</span>;
  }

  return (
    <article className={"awp-pl-card awp-pl-card--" + rec.status}>
      <header className="awp-pl-head">
        <div className="awp-pl-who">
          <span className="awp-pl-name">{rec.workerName}</span>
          <span className="awp-pl-meta">{rec.role}{rec.proposedRate ? " · $" + rec.proposedRate + "/hr" : ""}</span>
        </div>
        <div className="awp-pl-actions">{actions}</div>
      </header>
      {rec.status !== "rejected" && <AwpStepper status={rec.status} />}
      {(rec.status === "onboarding" || obOpen) && rec.status !== "rejected" && rec.status !== "active" && (
        <div className="awp-pl-ob">
          <div className="awp-pl-ob-h">
            <span>Onboarding activity items</span>
            <span className="awp-pl-ob-count">{(rec.onboarding || []).filter((t) => t.done).length}/{(rec.onboarding || []).length} done</span>
          </div>
          <ul className="awp-pl-ob-list">
            {(rec.onboarding || []).map((t) => (
              <li key={t.id}>
                <label>
                  <input type="checkbox" checked={!!t.done} onChange={() => act(() => eng.toggleOnboarding(rec.id, t.id, isAgency ? "Agency" : "Manager"))} />
                  <span>{t.label}</span>
                  {t.required && <span className="awp-pl-req">Required</span>}
                </label>
              </li>
            ))}
          </ul>
        </div>
      )}
    </article>
  );
}

// ----- Panel body -----------------------------------------------------
function AssignWorkerPanel({ cfg, open, onClose }) {
  const role = (typeof window !== "undefined" && window.flexViewAsRole) || "admin";
  const isAgency = role === "agency";
  const eng = AE();
  const engType = cfg.engagementType || "Shift";
  const mode = eng ? eng.modeFor(engType) : "allocate";
  const labels = eng ? eng.labelsFor(engType, role) : { title: "Assign worker", primary: "Assign", hint: "" };
  const sup = (window.REQ_SUPPLIERS || {})[cfg.supplierId] || { label: cfg.supplierId };
  const allWorkers = (typeof window !== "undefined" && window.WORKERS) || [];
  const perfFn = window.wfPerfFor || ((w) => ({ rating: 4.5 }));
  const bulk = !!cfg.bulkCount && mode === "allocate";
  // T4 — multi-candidate shortlist: in submit mode the From-workforce tab
  // becomes a ranked multi-select (selection order = rank). Reuses the
  // same checkbox machinery as bulk allocation.
  const shortlist = mode === "submit";
  const selectable = bulk || shortlist;

  const [query, setQuery] = useStateAwp("");
  const [compatOnly, setCompatOnly] = useStateAwp(true);
  const [selected, setSelected] = useStateAwp([]); // bulk
  const [expandedId, setExpandedId] = useStateAwp(null); // worker perf detail
  const toggleDetail = (w) => {
    const id = w.id || w.name;
    setExpandedId((cur) => (cur === id ? null : id));
  };
  const [tab, setTab] = useStateAwp("existing");    // submit: existing | new
  const [newCand, setNewCand] = useStateAwp({ name: "", rate: "" });
  const [, setTick] = useStateAwp(0);
  const bump = () => setTick((n) => n + 1);

  // Re-render the Pipeline when engine records change.
  useEffectAwp(() => eng ? eng.subscribe(bump) : undefined, []);

  // ---- Rate-exception capture (parity with FG "Rate Exception") -----
  const contract = (typeof window !== "undefined" && window.getSupplierContract)
    ? window.getSupplierContract(cfg.supplierId)
    : null;
  const ratePos = useMemoAwp(() => {
    if (!contract) return null;
    const lc = (cfg.role || "").toLowerCase();
    return (contract.positions || []).find((p) => (p.name || "").toLowerCase().includes(lc)) || null;
  }, [contract, cfg.role]);
  const band = ratePos ? {
    min: ratePos.payRateMin || ratePos.payRate,
    pref: ratePos.payRatePref || ratePos.payRate,
    max: ratePos.payRateMax || (ratePos.payRate + 4),
    currency: ratePos.currency || "USD",
  } : null;
  const [proposedRate, setProposedRate] = useStateAwp(band ? String(band.pref) : "");
  const [excReason, setExcReason] = useStateAwp("");
  const proposed = Number(proposedRate);
  const overBand = band && Number.isFinite(proposed) && proposed > band.max;
  const exceptionBlocked = overBand && !excReason;
  const sym = (() => {
    const map = { USD: "$", EUR: "€", GBP: "£", CAD: "C$", AUD: "A$", MXN: "Mex$" };
    return band ? (map[band.currency] || "$") : "$";
  })();

  // ---- candidate list (enriched, sorted, filtered) -----------------
  const enriched = useMemoAwp(() => {
    const supIds = Object.keys(window.REQ_SUPPLIERS || {});
    const hash = (s) => {
      let h = 0;
      for (let i = 0; i < (s || "").length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
      return Math.abs(h);
    };
    return allWorkers.map((w) => {
      const h = hash(w.id || w.name || "");
      const supplier = w.supplier || (supIds.length ? supIds[h % supIds.length] : w.supplier);
      const shifts = (w.shifts && w.shifts > 0) ? w.shifts : (12 + (h % 84));
      return { ...w, supplier, shifts };
    });
  }, [allWorkers]);

  const decorated = useMemoAwp(() => {
    if (!eng) return [];
    const score = (w) => ((w.jobs || []).includes(cfg.role) ? 0 : 1);
    return enriched
      .map((w) => {
        const compatible = eng.isCompatible(w, cfg);
        const cred = eng.credentialSummary(w);
        const avail = eng.availabilityFor(w, cfg);
        // T10 — a fail-level credential blocks the worker in EVERY mode
        // (you can't submit or propose a non-compliant candidate either),
        // not just allocate. Availability only gates instant placement.
        const blocked = cred.level === "fail" || (mode === "allocate" && avail.level === "fail");
        return { w, compatible, cred, avail, blocked };
      })
      .sort((a, b) => score(a.w) - score(b.w) || (b.w.shifts || 0) - (a.w.shifts || 0));
  }, [enriched, cfg.role, mode]);

  const visible = useMemoAwp(() => {
    let list = decorated;
    if (compatOnly) list = list.filter((d) => d.compatible);
    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter((d) => {
        const hay = `${d.w.name} ${(d.w.jobs || []).join(" ")} ${d.w.region || ""}`.toLowerCase();
        return hay.includes(q);
      });
    }
    return list;
  }, [decorated, compatOnly, query]);

  const incompatHidden = compatOnly ? decorated.filter((d) => !d.compatible).length : 0;
  const pipeline = eng ? eng.recordsForReq(cfg) : [];

  // ---- commit helpers ----------------------------------------------
  function makeRec(worker, extra) {
    return eng.createRecord({
      engagementType: engType,
      role: cfg.role,
      supplierId: cfg.supplierId,
      supplierLabel: sup.label,
      workerId: worker.id || worker.name,
      workerName: worker.name,
      idx: cfg.idx,
      reqId: cfg.reqId, bookingId: cfg.bookingId, projectId: cfg.projectId, sowId: cfg.sowId,
      billRate: extra && extra.billRate,
      proposedRate: Number(proposedRate) || (extra && extra.proposedRate) || null,
      exception: overBand ? { reason: excReason, over: proposed - band.max } : null,
      by: isAgency ? "Agency" : role,
    });
  }

  const pick = (worker) => {
    if (exceptionBlocked) {
      showToast("Enter a reason code before continuing above the rate band", { kind: "default" });
      return;
    }
    if (overBand) showToast(`Rate exception logged · ${excReason}`, { kind: "success" });

    if (mode === "allocate") {
      makeRec(worker);
      if (isAgency) {
        cfg.onAssign && cfg.onAssign({ ...worker, proposedRate: Number(proposedRate) || null });
      } else {
        if (eng) eng.createOffer({ workerId: worker.id || worker.name, workerName: worker.name, role: cfg.role, supplierId: cfg.supplierId, bookingId: cfg.bookingId, idx: cfg.idx, day: cfg.day });
        cfg.onRequest && cfg.onRequest({ ...worker, proposedRate: Number(proposedRate) || null });
        showToast(`Offer sent to ${worker.name}`, { kind: "success" });
      }
      onClose();
      return;
    }
    // submit (Assignment) / propose (Project · SOW): create a record
    // that walks the lifecycle. Stay open so the Pipeline shows it.
    makeRec(worker);
    if (mode === "propose" && cfg.onAssign) cfg.onAssign({ ...worker, proposedRate: Number(proposedRate) || null });
    showToast(`${worker.name} ${mode === "submit" ? "submitted as candidate" : "added to the team"}`, { kind: "success" });
  };

  const submitNew = () => {
    if (!newCand.name.trim()) { showToast("Enter a candidate name", { kind: "default" }); return; }
    makeRec({ id: "new-" + Date.now(), name: newCand.name.trim() }, { proposedRate: Number(newCand.rate) || null });
    setNewCand({ name: "", rate: "" });
    showToast(`${newCand.name.trim()} submitted as a new candidate`, { kind: "success" });
  };

  const toggleSel = (worker) => {
    setSelected((cur) => {
      const id = worker.id || worker.name;
      if (cur.includes(id)) return cur.filter((x) => x !== id);
      if (cur.length >= cfg.bulkCount) { showToast(`You can fill ${cfg.bulkCount} slot${cfg.bulkCount === 1 ? "" : "s"}`, { kind: "default" }); return cur; }
      return cur.concat([id]);
    });
  };
  const commitShortlist = () => {
    const chosen = visible.filter((d) => selected.includes(d.w.id || d.w.name)).map((d) => d.w);
    if (!chosen.length) { showToast("Select at least one candidate", { kind: "default" }); return; }
    chosen.forEach((w, i) => makeRec(w, { rank: i + 1, proposedRate: Number(proposedRate) || null }));
    showToast(`${chosen.length} candidate${chosen.length === 1 ? "" : "s"} submitted as a ranked shortlist`, { kind: "success" });
    setSelected([]);
  };
  const commitBulk = () => {
    const chosen = visible.filter((d) => selected.includes(d.w.id || d.w.name)).map((d) => d.w);
    if (!chosen.length) { showToast("Select at least one worker", { kind: "default" }); return; }
    chosen.forEach((w) => makeRec(w));
    cfg.onBulkAssign ? cfg.onBulkAssign(chosen) : showToast(`${chosen.length} worker${chosen.length === 1 ? "" : "s"} allocated across ${cfg.bulkCount} open slot${cfg.bulkCount === 1 ? "" : "s"}`, { kind: "success" });
    onClose();
  };

  const showRecurring = mode === "allocate" && cfg.recurring;

  return (
    <React.Fragment>
      <div className={"scrim" + (open ? " open" : "")} onClick={onClose} aria-hidden="true" />
      <aside
        className={"side-panel side-panel--wide awp-panel" + (open ? " open" : "")}
        role="dialog"
        aria-modal="true"
        aria-label={labels.title}
      >
        <header className="sp-head">
          <h2>{labels.title}{cfg.role ? <span className="awp-head-role"> · {cfg.role}</span> : null}</h2>
          <button type="button" className="iconbtn" onClick={onClose} aria-label="Close">
            <Icon name="X" size={20} />
          </button>
        </header>

        <div className="sp-body">
          {/* Engagement-type strip — what mechanic is in play */}
          <div className="awp-mode">
            <span className={"awp-mode-pill awp-mode-pill--" + mode}>{engType}</span>
            <span className="awp-mode-text">
              {mode === "allocate" && "Instant allocation · availability + credentials checked at pick."}
              {mode === "submit" && "Candidate submission · work order, then onboarding before active."}
              {mode === "propose" && "Resource added to the engagement team · onboards against the contract."}
            </span>
            {bulk && <span className="awp-mode-bulk">Bulk · {selected.length}/{cfg.bulkCount}</span>}
            {shortlist && selected.length > 0 && <span className="awp-mode-bulk">Shortlist · {selected.length} ranked</span>}
          </div>

          {/* Pipeline — work order + onboarding lifecycle (submit/propose,
              or any time records exist for this context) */}
          {(mode !== "allocate" || pipeline.length > 0) && pipeline.length > 0 && (
            <section className="awp-pipeline">
              <div className="awp-pipeline-h">
                <Icon name="ClipboardPerson" size={15} />
                <span>Pipeline · {pipeline.length} candidate{pipeline.length === 1 ? "" : "s"}</span>
              </div>
              {pipeline.map((rec) => (
                <AwpPipelineCard key={rec.id} rec={rec} isAgency={isAgency} onChange={bump} />
              ))}
            </section>
          )}

          {/* Rate-exception capture */}
          {band && (
            <div className={`awp-rate-band ${overBand ? "awp-rate-band--over" : ""}`}>
              <div className="awp-rate-band-h">
                <Icon name="Pay" size={14} />
                <span>Pay-rate band for <b>{cfg.role}</b> &middot; {sym}{band.min}&ndash;{sym}{band.max}/hr (preferred {sym}{band.pref})</span>
              </div>
              <div className="awp-rate-band-row">
                <label className="awp-rate-label">
                  <span>Proposed rate ({sym}/hr)</span>
                  <input type="number" className="awp-rate-input" value={proposedRate} onChange={(e) => setProposedRate(e.target.value)} />
                </label>
                {overBand && (
                  <label className="awp-rate-label">
                    <span>Reason for exception</span>
                    <select className="awp-rate-select" value={excReason} onChange={(e) => setExcReason(e.target.value)}>
                      <option value="">Select reason</option>
                      <option value="critical-skill">Critical / scarce skill</option>
                      <option value="market-shift">Local market shift</option>
                      <option value="rush">Rush / short-notice premium</option>
                      <option value="retention">Retention of incumbent</option>
                      <option value="cert">Certification or license uplift</option>
                    </select>
                  </label>
                )}
              </div>
              {overBand && (
                <p className="awp-rate-warn">
                  <Icon name="Alert" size={12} />
                  Proposed rate is {sym}{(proposed - band.max).toFixed(2)} above the band max. Submission routes to the program owner for sign-off.
                  {(() => {
                    if (!ratePos || !contract) return null;
                    const stub = { ...ratePos, payRatePref: proposed, payRate: proposed };
                    const stubMax = { ...ratePos, payRatePref: band.max, payRate: band.max };
                    const ctx = { date: new Date().toISOString().slice(0, 10), country: contract.country || "US", currency: band.currency };
                    const proposedBill = window.runRateStages ? Math.round(window.runRateStages(stub, contract, ctx).billRate) : null;
                    const bandMaxBill = window.runRateStages ? Math.round(window.runRateStages(stubMax, contract, ctx).billRate) : null;
                    if (proposedBill == null) return null;
                    return <span className="awp-rate-loaded"> → bill rate <b className="tabular">{sym}{proposedBill}/hr</b> (vs {sym}{bandMaxBill} at band max)</span>;
                  })()}
                </p>
              )}
            </div>
          )}

          {/* Submit mode: existing-vs-new tabs */}
          {mode === "submit" && (
            <div className="awp-tabs" role="tablist">
              <button type="button" role="tab" aria-selected={tab === "existing"} className={"awp-tab" + (tab === "existing" ? " awp-tab--on" : "")} onClick={() => setTab("existing")}>From workforce</button>
              <button type="button" role="tab" aria-selected={tab === "new"} className={"awp-tab" + (tab === "new" ? " awp-tab--on" : "")} onClick={() => setTab("new")}>New candidate</button>
            </div>
          )}

          {mode === "submit" && tab === "new" ? (
            <div className="awp-newcand">
              <p className="awp-newcand-hint">Submit a candidate not yet in your workforce. They'll enter the pipeline at <b>Candidate submitted</b>.</p>
              <div className="awp-newcand-grid">
                <label className="awp-rate-label">
                  <span>Candidate name</span>
                  <input className="awp-rate-input" value={newCand.name} onChange={(e) => setNewCand({ ...newCand, name: e.target.value })} placeholder="Full name" />
                </label>
                <label className="awp-rate-label">
                  <span>Proposed rate ({sym}/hr)</span>
                  <input type="number" className="awp-rate-input" value={newCand.rate} onChange={(e) => setNewCand({ ...newCand, rate: e.target.value })} placeholder={band ? String(band.pref) : ""} />
                </label>
              </div>
              <button type="button" className="btn btn--md btn--primary awp-newcand-btn" onClick={submitNew}>
                <Icon name="Send" size={14} /> {labels.primary}
              </button>
            </div>
          ) : (
            <>
              {/* Filters: compat toggle + recurring + search */}
              <div className="awp-controls">
                <label className="awp-compat-toggle">
                  <input type="checkbox" checked={compatOnly} onChange={(e) => setCompatOnly(e.target.checked)} />
                  <span>Only {AE().rowSupplierType(cfg)}-type workers{incompatHidden ? ` (${incompatHidden} hidden)` : ""}</span>
                </label>
                {showRecurring && (
                  <label className="awp-compat-toggle">
                    <input type="checkbox" checked={!!cfg.applySeries} onChange={(e) => { cfg.applySeries = e.target.checked; bump(); }} />
                    <span>Apply across the recurring series</span>
                  </label>
                )}
              </div>
              <div className="bk-search aw-search">
                <span className="bk-search-icon" aria-hidden="true"><Icon name="Search" size={18} /></span>
                <input type="search" className="bk-search-input" placeholder="Search by name, role, or region" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search workers" />
              </div>

              <div className={"awp-table awp-table--checks" + (isAgency ? " awp-table--agency" : "") + (selectable ? " awp-table--bulk" : "")} role="table" aria-label="Available workers">
                <div className="awp-row awp-row--head" role="row">
                  <div className="awp-cell awp-cell--worker" role="columnheader">Worker</div>
                  {!isAgency && <div className="awp-cell awp-cell--agency" role="columnheader">Supplier</div>}
                  <div className="awp-cell awp-cell--checks" role="columnheader">Compliance{mode === "allocate" ? " · availability" : ""}</div>
                  <div className="awp-cell awp-cell--rating" role="columnheader">Rating</div>
                  {!selectable && <div className="awp-cell awp-cell--action" role="columnheader" aria-label="" />}
                </div>
                {visible.length === 0 ? (
                  <div className="awp-empty">
                    <Icon name="Search" size={24} />
                    <p>No workers match.</p>
                  </div>
                ) : visible.map((d) => {
                  const supMeta = (window.REQ_SUPPLIERS || {})[d.w.supplier];
                  return (
                    <AwpWorkerRow
                      key={d.w.id}
                      worker={d.w}
                      supplierMeta={supMeta}
                      perf={perfFn(d.w)}
                      role={role}
                      isQualified={(d.w.jobs || []).includes(cfg.role)}
                      showAgency={!isAgency}
                      cred={d.cred}
                      avail={d.avail}
                      compatible={d.compatible}
                      blocked={d.blocked}
                      mode={mode}
                      bulk={selectable}
                      checked={selected.includes(d.w.id || d.w.name)}
                      onToggle={toggleSel}
                      onPick={pick}
                      primaryLabel={labels.primary}
                      expanded={expandedId === (d.w.id || d.w.name)}
                      onToggleDetail={toggleDetail}
                    />
                  );
                })}
              </div>
            </>
          )}
        </div>

        <footer className="sp-foot awp-foot">
          <span className="awp-foot-hint">
            <Icon name="Information" size={14} />
            {labels.hint}
          </span>
          {bulk
            ? <button type="button" className="btn btn--md btn--primary" disabled={!selected.length} onClick={commitBulk}>Allocate {selected.length || ""} worker{selected.length === 1 ? "" : "s"}</button>
            : (shortlist && tab === "existing")
            ? <button type="button" className="btn btn--md btn--primary" disabled={!selected.length} onClick={commitShortlist}>Submit {selected.length || ""} candidate{selected.length === 1 ? "" : "s"}{selected.length > 1 ? " (ranked)" : ""}</button>
            : <button type="button" className="btn btn--md btn--tertiary" onClick={onClose}>{mode === "allocate" ? "Cancel" : "Done"}</button>}
        </footer>
      </aside>
    </React.Fragment>
  );
}

// ----- Host bound to the Interactions bus ------------------------------
function AssignWorkerHost() {
  const [cfg, setCfg] = useStateAwp(null);
  const [open, setOpen] = useStateAwp(false);
  useEffectAwp(() => Interactions.on("assignWorker", (data) => {
    setCfg(data);
    requestAnimationFrame(() => setOpen(true));
  }), []);
  useEffectAwp(() => {
    if (!cfg) return;
    const onKey = (e) => { if (e.key === "Escape") handleClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [cfg]);
  function handleClose() {
    setOpen(false);
    setTimeout(() => setCfg(null), 240);
  }
  if (!cfg) return null;
  return <AssignWorkerPanel cfg={cfg} open={open} onClose={handleClose} />;
}

Object.assign(window, {
  openAssignWorkerPanel,
  AssignWorkerPanel,
  AssignWorkerHost,
});
