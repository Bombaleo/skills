// =====================================================================
// Flex Work — Automatic worker invitations (Agency Pro)
//
//   Feature-flag-gated capability for staffing AGENCY tenants on the Pro
//   plan. Where Supplier Distribution controls how a BUYER offers a
//   requisition to its supplier network, this controls how an AGENCY
//   offers an accepted requisition to its OWN bench workers — i.e. the
//   strategy by which worker invitations go out.
//
//   Three strategies (per the brief):
//     • Simultaneous — every selected worker is invited at once
//                      (fastest fill, no ranking).
//     • Staggered    — invite in waves on a fixed interval; auto-stop
//                      once the positions are filled, capped at a max
//                      number of waves.
//     • Smart        — rank the bench by worker score and invite the
//                      strongest first, cascading down until filled.
//
//   Surfaces:
//     · A default config CARD in Settings → Configuration (org-wide).
//     · A per-requisition OVERRIDE bar inside the worker-invite panel
//       (inherits the default; can be overridden for one requisition).
//
//   Visibility gate (all three required):
//     · autoWorkerInvite feature flag ON
//     · active tenant is agency-kind (industry.kind === "agency")
//     · agency is on the Pro plan (isAgencyProActive)
//   With any false, every surface returns null and the product ships
//   byte-identical.
//
//   Must load AFTER feature-flags.jsx, industry.jsx, req-shared.jsx
//   (SectionCard / Switch / Banner), workforce.jsx (wfPerfFor / WfStars
//   / WORKERS / WorkerAvatar) and agency-pro.jsx (isAgencyProActive).
// =====================================================================

const { useState: useAWI, useEffect: useEffAWI, useMemo: useMemoAWI } = React;

// ---------- 1. Flag registration ------------------------------------
// Registers under the existing "Agency Pro" group so it sits beside the
// agencyPro flag on Settings → Feature Flags. Falls back to its own
// group if Agency Pro hasn't registered yet (load-order safety).
(function registerAutoInviteFlag() {
  if (!window.FEATURE_FLAG_GROUPS) return;
  const FLAG = {
    id: "autoWorkerInvite",
    label: "Automatic worker invitations",
    summary:
      "Adds a Worker invitation strategy to agency tenants: choose how an accepted requisition is offered to your bench — all at once, staggered in waves on a fixed interval (auto-stopping once filled), or smart allocation that ranks the bench by worker score and invites the strongest first. Sets an organization-wide default in Settings → Configuration and a per-requisition override on the worker-invite panel. Requires the Pro plan; renders only inside agency-kind tenants.",
    defaultOn: false,
    tips: [
      {
        label: "What turns on",
        body:
          "An \"Automatic worker invitations\" card at the top of Settings → Configuration with a three-way strategy picker and per-strategy controls. The worker-invite panel gains an \"Invitation delivery\" bar that inherits the default and can be overridden for a single requisition. The Smart strategy renders a live preview of your bench ranked by worker score, showing the order and waves invitations would go out in.",
      },
      {
        label: "Requires Pro",
        body:
          "Like the rest of Agency Pro, this needs the agency to be on the Pro plan. With the flag on but the tenant still on Free, the card shows a short upgrade note instead of the configuration. On enterprise buyer tenants the flag is a no-op.",
      },
      {
        label: "Strategies",
        body:
          "Simultaneous = first-come fill, no ranking. Staggered = invite N workers per wave on a set interval, stop automatically once the positions fill, capped at a maximum number of waves. Smart = score-ranked cascade; only workers at or above the score threshold are invited, strongest first.",
      },
    ],
  };
  const grp = window.FEATURE_FLAG_GROUPS.find((g) => g.id === "agencyPro");
  if (grp) {
    if (!grp.flags.some((f) => f.id === FLAG.id)) grp.flags.push(FLAG);
  } else {
    if (!window.FEATURE_FLAG_GROUPS.some((g) => g.id === "autoWorkerInvite")) {
      window.FEATURE_FLAG_GROUPS.push({
        id: "autoWorkerInvite",
        label: "Agency Pro",
        requiresAgency: true,
        summary: "Automatic worker invitation strategies for staffing-agency tenants.",
        flags: [FLAG],
      });
    }
  }
})();

// ---------- 2. Strategy metadata ------------------------------------
const AWI_STRATEGIES = {
  simultaneous: {
    key: "simultaneous",
    short: "All at once",
    label: "Send all at once",
    icon: "Broadcast",
    blurb: "Every selected worker is invited the moment you confirm. Fastest possible fill — first to accept takes the slot.",
  },
  staggered: {
    key: "staggered",
    short: "One by one",
    label: "Send one by one",
    icon: "PersonClock",
    blurb: "Invite in small waves on a set interval. Stops automatically once the positions are filled, so you don't over-invite.",
  },
  smart: {
    key: "smart",
    short: "Smart allocation",
    label: "Smart allocation",
    icon: "Performance",
    blurb: "Rank your bench by worker score and invite the strongest first, cascading down until every position is filled.",
  },
};
const AWI_STRATEGY_ORDER = ["simultaneous", "staggered", "smart"];
const AWI_INTERVALS = ["1 min", "5 min", "10 min", "15 min", "30 min", "1 hour"];

const AWI_DEFAULT_CONFIG = {
  strategy: "smart",
  // staggered
  waveSize: 3,
  interval: "10 min",
  autoStopOnFill: true,
  maxWaves: 5,
  // smart
  scoreThreshold: 70,
  smartBatch: 3,
  smartInterval: "15 min",
};

// ---------- 3. Config store -----------------------------------------
const AWI_KEY = "flexwork.autoWorkerInvite.config.v1";

function getAutoInviteConfig() {
  try {
    const raw = window.localStorage.getItem(AWI_KEY);
    if (!raw) return { ...AWI_DEFAULT_CONFIG };
    return { ...AWI_DEFAULT_CONFIG, ...(JSON.parse(raw) || {}) };
  } catch (e) { return { ...AWI_DEFAULT_CONFIG }; }
}
function setAutoInviteConfig(next) {
  try { window.localStorage.setItem(AWI_KEY, JSON.stringify(next)); } catch (e) {}
  try { window.dispatchEvent(new CustomEvent("flexwork:autoInvite:change", { detail: next })); } catch (e) {}
  return next;
}
function useAutoInviteConfig() {
  const [v, setV] = useAWI(() => getAutoInviteConfig());
  useEffAWI(() => {
    function onChange() { setV(getAutoInviteConfig()); }
    window.addEventListener("flexwork:autoInvite:change", onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener("flexwork:autoInvite:change", onChange);
      window.removeEventListener("storage", onChange);
    };
  }, []);
  return v;
}

// ---------- 4. Gating hooks -----------------------------------------
function useAutoInviteFlag() {
  if (window.useFeatureFlag) return window.useFeatureFlag("autoWorkerInvite");
  return !!(window.getFeatureFlag && window.getFeatureFlag("autoWorkerInvite"));
}
// Product surfaces gate on this: flag ON + agency tenant + Pro plan.
function useAutoInviteActive() {
  const flag = useAutoInviteFlag();
  const pro  = window.useAgencyProActive ? window.useAgencyProActive() : false;
  return flag && pro;
}
function isAutoInviteActive() {
  const flag = !!(window.getFeatureFlag && window.getFeatureFlag("autoWorkerInvite"));
  const pro  = window.isAgencyProActive ? window.isAgencyProActive() : false;
  return flag && pro;
}

// ---------- 5. Worker score + bench helpers -------------------------
// Composite 0–100 worker score from the same performance profile the
// Workforce tab uses. Weighted: rating 60 · on-time 22 · reliability 18.
function awiWorkerScore(w) {
  const perf = (window.wfPerfFor && window.wfPerfFor(w)) || { rating: 4.5, onTime: 90, reliability: 90 };
  const ratingPts = (perf.rating / 5) * 60;
  const onTimePts = ((perf.onTime || 0) / 100) * 22;
  const relPts    = ((perf.reliability || 0) / 100) * 18;
  return Math.max(0, Math.min(100, Math.round(ratingPts + onTimePts + relPts)));
}

// The agency's own bench, available for invitation, ranked by score.
function awiRankedBench() {
  const all = (typeof window !== "undefined" && window.WORKERS) || [];
  const sup = (window.getAgencySupplierId && window.getAgencySupplierId()) || null;
  const list = sup
    ? all.filter((w) => w.supplier === sup)
    : all.filter((w) => (w.pool || "Agency") === "Agency");
  return list
    .filter((w) => w.status !== "Expired")
    .map((w) => ({ w, score: awiWorkerScore(w) }))
    .sort((a, b) => b.score - a.score);
}

// ---------- 6. Small controls ---------------------------------------
function AwiSelect({ value, options, onChange, disabled }) {
  return (
    <span className="awi-select">
      <span>{value}</span>
      <Icon name="ChevronDown" size={14} />
      <select value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled} aria-label="Select value">
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </span>
  );
}

function AwiStrategyChip({ kind }) {
  const meta = AWI_STRATEGIES[kind] || AWI_STRATEGIES.smart;
  return (
    <span className={"awi-chip awi-chip--" + kind}>
      <Icon name={meta.icon} size={13} />
      {meta.short}
    </span>
  );
}

// ---------- 7. Strategy diagrams ------------------------------------
function AwiDiagram({ kind }) {
  if (kind === "simultaneous") {
    return (
      <span className="awi-diag-bc" aria-hidden="true">
        <span className="awi-diag-hub" />
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <span key={i} className="awi-diag-ray" style={{ transform: `rotate(${i * 60}deg) translateX(8px)` }} />
        ))}
      </span>
    );
  }
  if (kind === "staggered") {
    return (
      <span className="awi-diag-stag" aria-hidden="true">
        {[0, 1, 2].map((i) => (
          <span key={i} className="awi-diag-stag-lane">
            <span className="awi-diag-stag-dot" style={{ opacity: 1 - i * 0.28 }} />
            <span className="awi-diag-stag-bar" style={{ width: `${64 - i * 16}%`, opacity: 0.5 - i * 0.12 }} />
          </span>
        ))}
      </span>
    );
  }
  return (
    <span className="awi-diag-smart" aria-hidden="true">
      {[30, 24, 19, 14, 10].map((h, i) => (
        <span key={i} className="awi-diag-smart-bar" style={{ height: h }} />
      ))}
    </span>
  );
}

// ---------- 8. Strategy picker (3 cards) ----------------------------
function AwiStrategyCards({ value, onChange }) {
  return (
    <div className="awi-strat-grid">
      {AWI_STRATEGY_ORDER.map((k) => {
        const meta = AWI_STRATEGIES[k];
        const active = value === k;
        return (
          <button
            key={k}
            type="button"
            className={"awi-strat" + (active ? " awi-strat--active" : "")}
            aria-pressed={active}
            onClick={() => onChange(k)}
          >
            <span className="awi-strat-head">
              <span className="awi-strat-icon" aria-hidden="true"><Icon name={meta.icon} size={20} /></span>
              <span className="awi-strat-title">{meta.label}</span>
              <span className={"awi-strat-check" + (active ? " awi-strat-check--on" : "")} aria-hidden="true">
                {active && <Icon name="Check" size={13} />}
              </span>
            </span>
            <span className="awi-strat-diagram"><AwiDiagram kind={k} /></span>
            <span className="awi-strat-blurb">{meta.blurb}</span>
          </button>
        );
      })}
    </div>
  );
}

// ---------- 9. Per-strategy parameter controls ----------------------
function AwiParamRow({ label, hint, control, disabled }) {
  return (
    <div className={"awi-row" + (disabled ? " awi-row--disabled" : "")}>
      <span className="awi-row-text">
        <span className="awi-row-label">{label}</span>
        {hint && <span className="awi-row-hint">{hint}</span>}
      </span>
      <span className="awi-row-control">{control}</span>
    </div>
  );
}

function AwiNumber({ value, min, max, onChange }) {
  return (
    <input
      type="number" className="awi-num" min={min} max={max} value={value}
      onChange={(e) => {
        let n = parseInt(e.target.value, 10);
        if (isNaN(n)) n = min;
        n = Math.max(min, Math.min(max, n));
        onChange(n);
      }}
    />
  );
}

function AwiStrategyControls({ config, set }) {
  if (config.strategy === "simultaneous") {
    return (
      <Banner inline title="No timing controls">
        All selected workers are invited at the same moment. Whoever accepts first claims the slot —
        there is nothing to schedule.
      </Banner>
    );
  }
  if (config.strategy === "staggered") {
    return (
      <div className="awi-params">
        <AwiParamRow
          label="Workers per wave"
          hint="How many invitations go out in each batch."
          control={<AwiNumber value={config.waveSize} min={1} max={10} onChange={(n) => set({ waveSize: n })} />}
        />
        <AwiParamRow
          label="Interval between waves"
          hint="Wait this long for responses before sending the next wave."
          control={<AwiSelect value={config.interval} options={AWI_INTERVALS} onChange={(v) => set({ interval: v })} />}
        />
        <AwiParamRow
          label="Stop once positions are filled"
          hint="Cancel any remaining waves as soon as the requisition is fully staffed."
          control={<Switch checked={config.autoStopOnFill} onChange={(v) => set({ autoStopOnFill: v })} ariaLabel="Auto-stop on fill" />}
        />
        <AwiParamRow
          label="Maximum waves"
          hint="Hard cap on how many waves can be sent before the program pauses for review."
          control={<AwiNumber value={config.maxWaves} min={1} max={12} onChange={(n) => set({ maxWaves: n })} />}
        />
      </div>
    );
  }
  // smart
  return (
    <div className="awi-params">
      <AwiParamRow
        label="Minimum worker score"
        hint="Only workers at or above this score are invited. Lower it to widen the pool."
        control={(
          <span className="awi-row-control">
            <AwiNumber value={config.scoreThreshold} min={0} max={100} onChange={(n) => set({ scoreThreshold: n })} />
            <span className="awi-unit">/ 100</span>
          </span>
        )}
      />
      <AwiParamRow
        label="Top workers per wave"
        hint="Invite this many of the highest-scoring workers first, then cascade down."
        control={<AwiNumber value={config.smartBatch} min={1} max={10} onChange={(n) => set({ smartBatch: n })} />}
      />
      <AwiParamRow
        label="Interval between waves"
        hint="Give top workers this long to respond before opening the next tier of scores."
        control={<AwiSelect value={config.smartInterval} options={AWI_INTERVALS} onChange={(v) => set({ smartInterval: v })} />}
      />
    </div>
  );
}

// ---------- 10. Smart ranked-bench preview --------------------------
// `positions` = how many slots we're filling (drives the cut line and
// wave labels). `batch` = workers per wave. `threshold` = min score.
function AwiSmartPreview({ threshold, batch, positions = 3, max = 8 }) {
  const ranked = useMemoAWI(() => awiRankedBench(), []);
  const eligible = ranked.filter((r) => r.score >= threshold);
  const rows = eligible.slice(0, max);
  const Avatar = window.WorkerAvatar;
  const Stars = window.WfStars;
  return (
    <React.Fragment>
      <div className="awi-rank-head">
        <span className="awi-rank-head-title">Invitation order preview</span>
        <span className="awi-rank-head-meta">
          {eligible.length} of {ranked.length} bench workers eligible · top {Math.min(rows.length, max)} shown
        </span>
      </div>
      {rows.length === 0 ? (
        <Banner inline title="No workers meet the score threshold">
          Lower the minimum worker score to surface candidates from your bench.
        </Banner>
      ) : (
        <ul className="awi-rank" role="list">
          {rows.map((r, i) => {
            const wave = Math.floor(i / Math.max(1, batch)) + 1;
            const cut = i >= positions; // beyond the slots we need
            const perf = (window.wfPerfFor && window.wfPerfFor(r.w)) || { rating: 4.5 };
            return (
              <li key={r.w.id} className={"awi-rank-row" + (cut ? " awi-rank-row--cut" : "")}>
                <span className="awi-rank-order" aria-label={`Rank ${i + 1}`}>{i + 1}</span>
                {Avatar ? <Avatar w={r.w} size={32} /> : <span />}
                <span style={{ minWidth: 0 }}>
                  <span className="awi-rank-name">{r.w.name}</span>
                  <span className="awi-rank-sub">{(r.w.jobs || []).slice(0, 2).join(" · ")}</span>
                </span>
                <span className="awi-rank-wave">{cut ? "Standby" : `Wave ${wave}`}</span>
                <span className="awi-rank-score">
                  <span className="awi-rank-score-val">{r.score}<small> /100</small></span>
                  <span className="awi-rank-meter"><span style={{ width: r.score + "%" }} /></span>
                </span>
              </li>
            );
          })}
        </ul>
      )}
      <div className="awi-rank-foot">
        <Icon name="Information" size={13} />
        <span>Workers below the cut line stay on standby and are invited only if earlier waves don't fill the {positions} open position{positions === 1 ? "" : "s"}.</span>
      </div>
    </React.Fragment>
  );
}

// ---------- 11. Shared config form ----------------------------------
// `value`/`onChange` drive a controlled config. Used by the Settings
// card AND the per-requisition override bar.
function AwiConfigForm({ value, onChange, positions = 3 }) {
  const set = (patch) => onChange({ ...value, ...patch });
  return (
    <React.Fragment>
      <AwiStrategyCards value={value.strategy} onChange={(k) => set({ strategy: k })} />
      <AwiStrategyControls config={value} set={set} />
      {value.strategy === "smart" && (
        <AwiSmartPreview threshold={value.scoreThreshold} batch={value.smartBatch} positions={positions} />
      )}
    </React.Fragment>
  );
}

// ---------- 12. Settings → Configuration card -----------------------
// Caller gates on the flag + agency tenant; this guards the Pro plan
// itself so the card can show an upgrade note on Free.
function AgencyWorkerInviteCard() {
  const config = useAutoInviteConfig();
  const proActive = window.useAgencyProActive ? window.useAgencyProActive() : false;
  const meta = AWI_STRATEGIES[config.strategy] || AWI_STRATEGIES.smart;

  const onChange = (next) => {
    const stratChanged = next.strategy !== config.strategy;
    setAutoInviteConfig(next);
    if (stratChanged && window.showToast) {
      window.showToast(`Default invitation strategy: ${AWI_STRATEGIES[next.strategy].label}`, { kind: "success" });
    }
  };

  return (
    <SectionCard
      variant="compact"
      icon="Send"
      title="Automatic worker invitations"
      action={proActive ? <AwiStrategyChip kind={config.strategy} /> : (
        <span className="req-pill req-pill--default">Pro</span>
      )}
    >
      {!proActive ? (
        <div className="awi-gate">
          <span className="awi-gate-ic" aria-hidden="true"><Icon name="Performance" size={16} /></span>
          <span className="awi-gate-text">
            Automatic worker invitations are a <strong>Pro</strong> capability. Switch this tenant to the
            Pro plan in the <strong>Plan</strong> card above to configure how invitations are delivered to your bench.
          </span>
        </div>
      ) : (
        <React.Fragment>
          <p className="awi-blurb">
            When you accept a requisition, this sets how invitations go out to your bench workers. It's the
            organization-wide default — each requisition can override it on the worker-invite panel.
          </p>
          <AwiConfigForm value={config} onChange={onChange} positions={3} />
        </React.Fragment>
      )}
    </SectionCard>
  );
}

// ---------- 13. Per-requisition override bar ------------------------
// Mounted at the top of the worker-invite side panel. Inherits the org
// default; an explicit override is kept in local state for the session
// (per-requisition in the demo) and reported back via onStrategyChange
// so the host panel can relabel its invite action / reorder workers.
function AgencyInviteOverrideBar({ positions = 3, onStrategyChange }) {
  const active = useAutoInviteActive();
  const orgConfig = useAutoInviteConfig();
  const [overridden, setOverridden] = useAWI(false);
  const [local, setLocal] = useAWI(orgConfig);

  // Keep the inherited view in step with the org default until the user
  // explicitly overrides.
  useEffAWI(() => { if (!overridden) setLocal(orgConfig); }, [orgConfig, overridden]);

  const effective = overridden ? local : orgConfig;
  useEffAWI(() => { onStrategyChange && onStrategyChange(effective); }, [effective.strategy, overridden]);

  const [open, setOpen] = useAWI(false);
  if (!active) return null;
  const meta = AWI_STRATEGIES[effective.strategy] || AWI_STRATEGIES.smart;

  const startOverride = () => {
    setLocal(orgConfig);
    setOverridden(true);
    setOpen(true);
  };
  const resetToDefault = () => {
    setOverridden(false);
    setOpen(false);
    if (window.showToast) window.showToast("Reverted to agency default");
  };

  return (
    <div className="awi-ovr">
      <div className="awi-ovr-head">
        <span className="awi-ovr-ic" aria-hidden="true"><Icon name="Send" size={16} /></span>
        <span className="awi-ovr-text">
          <span className="awi-ovr-label">Invitation delivery</span>
          <span className="awi-ovr-value">
            <AwiStrategyChip kind={effective.strategy} />
            <span className="awi-ovr-source">{overridden ? "Overridden for this requisition" : "Agency default"}</span>
          </span>
        </span>
        {open ? (
          <button type="button" className="awi-ovr-toggle" onClick={() => setOpen(false)}>
            Done<Icon name="ChevronUp" size={14} />
          </button>
        ) : overridden ? (
          <button type="button" className="awi-ovr-toggle" onClick={() => setOpen(true)}>
            Edit<Icon name="ChevronDown" size={14} />
          </button>
        ) : (
          <button type="button" className="awi-ovr-toggle" onClick={startOverride}>
            Override<Icon name="ChevronDown" size={14} />
          </button>
        )}
      </div>
      {open && (
        <div className="awi-ovr-body">
          <AwiConfigForm value={local} onChange={(next) => { setLocal(next); setOverridden(true); }} positions={positions} />
          <div className="awi-ovr-reset">
            <span className="awi-ovr-note">This override applies to this requisition only.</span>
            <button type="button" className="linkbtn" onClick={resetToDefault}>Reset to agency default</button>
          </div>
        </div>
      )}
    </div>
  );
}

Object.assign(window, {
  AWI_STRATEGIES, AWI_STRATEGY_ORDER,
  getAutoInviteConfig, setAutoInviteConfig, useAutoInviteConfig,
  useAutoInviteFlag, useAutoInviteActive, isAutoInviteActive,
  awiWorkerScore, awiRankedBench,
  AwiStrategyChip, AwiConfigForm,
  AgencyWorkerInviteCard, AgencyInviteOverrideBar,
});
