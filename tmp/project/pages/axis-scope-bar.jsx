// =====================================================================
// AxisScopeBar \u2014 the v0.77 canonical filter primitive.
//
// Per unified-vms-v0.77-spec.html \u00a719: one filter primitive consumed by
// every list page. Replaces every per-list EngagementScope wrapper
// (ReqEngagementScopeBar, WfEngagementScopeBar, InvScopeBar, the
// dashboard's PwEngagementSwitch) with one component that takes the
// active axes as input and renders the right chip groups.
//
// Public surface (window.*):
//   \u00b7 AxisScopeBar     \u2014 the chip-bar component
//   \u00b7 useAxisScope     \u2014 [value, helpers] hook
//   \u00b7 AXIS_VALUE_META  \u2014 chip-label + axis-color lookup, shared with
//                         AxisChipRow in req-detail-v77.jsx
//
// Flag-off contract:
//   \u00b7 If no axis-extending flag is on (window.enabledWorkerTypeCount
//     returns 1), the bar renders null and the hook returns a no-op
//     `matches` predicate (always true) so the list is never filtered.
//   \u00b7 The CSS lives under .v77-asb-* so flag-off DOM is byte-identical
//     to today.
//
// Sits alongside the existing pages/engagement-scope.jsx primitive
// through Phases 1\u20133 of the spec rollout; surfaces migrate one at a
// time per the spec \u00a723 roadmap, deleting their per-surface adapter.
// =====================================================================

const { useState: useASB, useEffect: useEASB, useMemo: useMASB, useCallback: useCASB } = React;

// ---------- Axis chip / color metadata --------------------------------
// Same axis colors as the v0.77 spec page + req-detail-v77.jsx: teal
// (Billing Model), purple (Supplier Type). Work Type was retired from
// the product; the workType axis no longer surfaces in any picker.
const AXIS_VALUE_META = {
  billingModel: {
    label: "Engagement Model",
    color: "how",    // \u2192 .v77-asb-chip--how   (teal)
    values: {
      ClockInOut: { label: "Clock-in/out", always: true },
      Timesheet:  { label: "Timesheet",    flag: "timesheets" },
      Milestone:  { label: "Milestone",    flag: "milestones" },
      FixedFee:   { label: "Fixed",        flag: "fixedFee" },
    },
    order: ["ClockInOut", "Timesheet", "Milestone", "FixedFee"],
  },
  supplierType: {
    label: "Supplier Type",
    color: "who",    // \u2192 .v77-asb-chip--who   (purple)
    values: {
      Agency:                { label: "Agency",                 always: true },
      IndependentContractor: { label: "Independent Contractor", flag: "independentContractor" },
      EOR:                   { label: "EOR",                    flag: "eor" },
      Float:                 { label: "Float",                  flag: "float" },
    },
    order: ["Agency", "IndependentContractor", "EOR", "Float"],
  },
};

// ---------- Compatibility rule (mirrors req-detail-v77.jsx WORK_x_PAY) -
// Keeps a local copy so the bar works even if req-detail-v77.jsx is
// loaded after this file. The single source of truth lives there and
// is also exported as window.V77.WORK_x_PAY \u2014 prefer that when
// available so any future edit only happens in one place.
const WORK_x_PAY_FALLBACK = {
  Shift:      ["ClockInOut", "Timesheet"],
  Assignment: ["Timesheet", "Milestone", "FixedFee"],
};
function workXPay() {
  return (window.V77 && window.V77.WORK_x_PAY) || WORK_x_PAY_FALLBACK;
}

// ---------- Which axis values are reachable on this tenant -----------
// An axis value is reachable if (a) it is the always-on value, or (b)
// its gating flag is on, or (c) for Billing Model: at least one Work
// Type the tenant has enabled is compatible with it via WORK_x_PAY.
function _axisReachableValues(axis) {
  const meta = AXIS_VALUE_META[axis];
  if (!meta) return [];
  const flagOn = (k) => !!(window.getFeatureFlag && window.getFeatureFlag(k));
  const out = [];
  for (const v of meta.order) {
    const cfg = meta.values[v];
    if (cfg.always) { out.push(v); continue; }
    if (cfg.flag && flagOn(cfg.flag)) out.push(v);
  }
  return out;
}

// ---------- AxisScopeBar component ------------------------------------
function AxisScopeBar({ scopes, value, onChange, counts, mode, className, "data-axis-bar": dataAxisBar }) {
  // Removed throughout the product — Supplier Type / Billing Model
  // chip-bars are no longer surfaced as page-level tabs. Return null so
  // every list page that mounted this primitive (requisitions, invoices,
  // workforce) renders the underlying list without the extra row.
  return null;
  // eslint-disable-next-line no-unreachable
  const enabled = useEnabledTypeCount();
  if (enabled <= 1) return null;

  const axes = Array.isArray(scopes) ? scopes.filter((a) => AXIS_VALUE_META[a]) : [];
  if (axes.length === 0) return null;

  // Per the spec: single mode is the default for one axis, multi for
  // two or more. Mode can be overridden per call.
  const effectiveMode = mode || (axes.length === 1 ? "single" : "multi");

  return (
    <div
      className={"v77-asb" + (className ? " " + className : "")}
      role="toolbar"
      aria-label="Filter by worker-type axes"
      data-axis-bar={dataAxisBar || "true"}
    >
      {axes.map((axis) => {
        const meta = AXIS_VALUE_META[axis];
        const reachable = _axisReachableValues(axis);
        if (reachable.length <= 1) return null; // axis collapsed: hide
        const selected = (value && value[axis]) || [];
        const allSelected = selected.length === 0 || selected.length === reachable.length;
        return (
          <div key={axis} className={"v77-asb-group v77-asb-group--" + meta.color}>
            <span className="v77-asb-label">{meta.label}</span>
            <div className="v77-asb-chips" role={effectiveMode === "single" ? "radiogroup" : "group"}>
              <button
                type="button"
                role={effectiveMode === "single" ? "radio" : undefined}
                aria-checked={effectiveMode === "single" ? allSelected : undefined}
                aria-pressed={effectiveMode === "multi" ? allSelected : undefined}
                className={"v77-asb-chip v77-asb-chip--all" + (allSelected ? " is-on" : "")}
                onClick={() => onChange && onChange(axis, [])}
              >
                All
              </button>
              {reachable.map((v) => {
                const cfg = meta.values[v];
                const isOn = effectiveMode === "single"
                  ? (selected.length === 1 && selected[0] === v)
                  : selected.includes(v);
                const n = counts && counts[axis] && counts[axis][v];
                return (
                  <button
                    key={v}
                    type="button"
                    role={effectiveMode === "single" ? "radio" : undefined}
                    aria-checked={effectiveMode === "single" ? isOn : undefined}
                    aria-pressed={effectiveMode === "multi" ? isOn : undefined}
                    className={"v77-asb-chip v77-asb-chip--" + meta.color + (isOn ? " is-on" : "")}
                    onClick={() => {
                      if (!onChange) return;
                      if (effectiveMode === "single") {
                        // Single \u2014 toggle to "only this value" (or back
                        // to all if you click the active one).
                        onChange(axis, isOn ? [] : [v]);
                      } else {
                        const next = isOn
                          ? selected.filter((x) => x !== v)
                          : [...selected, v];
                        onChange(axis, next);
                      }
                    }}
                  >
                    <span className="v77-asb-chip-dot" aria-hidden="true" />
                    <span className="v77-asb-chip-label">{cfg.label}</span>
                    {n != null && <span className="v77-asb-chip-count">{n}</span>}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ---------- useAxisScope hook -----------------------------------------
//
// Returns [value, helpers] where:
//   value   \u2014 { workType?: string[], billingModel?: string[], supplierType?: string[] }
//   helpers \u2014 { matches(row), setAxis(axis, vals), clear(), isAllOn() }
//
// `matches(row)` reads `row.axes` (or calls window.V77.inferAxes if
// present) and returns true when the row's axis tuple intersects every
// active selection. Empty array per axis = no filter on that axis.
//
// Re-renders on `featureflags:change` so flipping a flag mid-session
// re-derives the reachable set automatically.
function useAxisScope({ scopes, initial }) {
  const axes = useMASB(
    () => (Array.isArray(scopes) ? scopes.filter((a) => AXIS_VALUE_META[a]) : []),
    [scopes && scopes.join("|")]
  );
  const [value, setValue] = useASB(() => {
    const out = {};
    for (const a of axes) out[a] = (initial && initial[a]) || [];
    return out;
  });
  const [, force] = useASB(0);

  // Re-derive reachable set when flags flip.
  useEASB(() => {
    function onChange() { force((n) => (n || 0) + 1); }
    window.addEventListener("featureflags:change", onChange);
    return () => window.removeEventListener("featureflags:change", onChange);
  }, []);

  const setAxis = useCASB((axis, vals) => {
    setValue((prev) => ({ ...prev, [axis]: vals || [] }));
  }, []);

  const clear = useCASB(() => {
    setValue(() => {
      const out = {};
      for (const a of axes) out[a] = [];
      return out;
    });
  }, [axes]);

  const matches = useCASB((row) => {
    if (!row) return true;
    // Resolve the row's axis tuple. Prefer row.axes (the v0.77 contract
    // per spec \u00a721); fall back to V77.inferAxes for rows that haven't
    // been migrated yet.
    let rowAxes = row.axes;
    if (!rowAxes && window.V77 && window.V77.inferAxes) {
      try { rowAxes = window.V77.inferAxes(row, row.id); }
      catch (e) { rowAxes = null; }
    }
    if (!rowAxes) return true;
    for (const a of axes) {
      const sel = value[a] || [];
      if (sel.length === 0) continue;
      if (!sel.includes(rowAxes[a])) return false;
    }
    return true;
  }, [axes, value]);

  const isAllOn = useMASB(() => {
    for (const a of axes) {
      const sel = value[a] || [];
      const reach = _axisReachableValues(a);
      if (sel.length > 0 && sel.length < reach.length) return false;
    }
    return true;
  }, [axes, value]);

  return [value, { matches, setAxis, clear, isAllOn, axes, axisMeta: AXIS_VALUE_META }];
}

// ---------- Helpers shared with AxisChipRow ---------------------------
function useEnabledTypeCount() {
  const [n, setN] = useASB(() => (window.enabledWorkerTypeCount ? window.enabledWorkerTypeCount() : 1));
  useEASB(() => {
    function onChange() {
      setN(window.enabledWorkerTypeCount ? window.enabledWorkerTypeCount() : 1);
    }
    window.addEventListener("featureflags:change", onChange);
    return () => window.removeEventListener("featureflags:change", onChange);
  }, []);
  return n;
}

// =====================================================================
// Exports
// =====================================================================
Object.assign(window, {
  AxisScopeBar,
  useAxisScope,
  AXIS_VALUE_META,
  // re-export for any consumer that wants the spec's WORK_x_PAY
  // without depending on the order of script loads
  axisReachableValues: _axisReachableValues,
  workXPay,
});
