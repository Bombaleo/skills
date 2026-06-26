// =====================================================================
// Flex Work — EngagementScope · the universal type-aware filter primitive
// ---------------------------------------------------------------------
// Spec checklist item: "Universal scopes · no engagement-type tabs · no
// per-type pages". The one allowed primitive for slicing a surface by
// engagement type. Every list / hub / settings page that needs the
// distinction renders THIS component — never its own <Tabs> / tablist /
// type-segmented control.
//
// Contract:
//
//   const [scope, setScope] = useEngagementScope({
//     // Optional initial state. Defaults to ALL enabled types selected.
//     types: ["frontline", "professional", "contractor", "sow", "eor"],
//   });
//
//   <EngagementScope value={scope} onChange={setScope} counts={…} />
//
// `scope.types` is a Set<string>. Consumers filter their rows by
// membership (`scope.types.has(row.engagementType)`).
//
// Byte-identity rule: when only Frontline is enabled (all variant flags
// off), the chip-bar collapses to a single neutral "All engagements"
// pill so the visual surface at flags-off is identical to the no-scope
// baseline.
//
// Hard rule encoded into the design:
//   · No `<Tabs>` / `role="tablist"` engagement-type strips anywhere
//     else in `pages/`.
//   · No per-engagement-type route. The only allowed pattern is one
//     surface, one route, this primitive as its filter.
// =====================================================================

const { useState: useStateES, useMemo: useMemoES, useEffect: useEffectES } = React;

// All engagement types this primitive knows about, in canonical order.
// The order is intentional — Frontline always sits first because it is
// the always-on default, then the additive variants in the order they
// landed.
const _ES_ALL_TYPES = ["frontline", "professional", "contractor", "sow", "eor"];

const _ES_META = {
  frontline:    { id: "frontline",    label: "Frontline",    icon: "PersonClock",     flag: null,                chipClass: "rdu-chip--frontline"    },
  professional: { id: "professional", label: "Professional", icon: "Briefcase",       flag: "professionalWork",  chipClass: "rdu-chip--professional" },
  contractor:   { id: "contractor",   label: "Contractor",   icon: "PersonAuthorize", flag: "contractors",       chipClass: "rdu-chip--contractor"   },
  sow:          { id: "sow",          label: "SOW",          icon: "Notes",           flag: "sow",               chipClass: "rdu-chip--sow"          },
  eor:          { id: "eor",          label: "EOR",          icon: "Globe",           flag: "eor",               chipClass: "rdu-chip--eor"          },
};

// ---------------------------------------------------------------------
// Which types are enabled for the current tenant? Frontline is always
// on; variants are gated by their flag. We read the same getFeatureFlag
// the rest of the app reads so byte-identity at all-flags-off holds.
// ---------------------------------------------------------------------
function _esEnabledTypes() {
  const out = ["frontline"];
  const flag = (k) => window.getFeatureFlag && window.getFeatureFlag(k);
  if (flag("professionalWork")) out.push("professional");
  if (flag("contractors"))      out.push("contractor");
  if (flag("sow"))              out.push("sow");
  if (flag("eor"))              out.push("eor");
  return out;
}

// ---------------------------------------------------------------------
// useEngagementScope — the shared hook.
//
// Returns [scope, setScope, helpers]. The `scope` object carries:
//   · types        — Set<string>      (which types are currently selected)
//   · enabledTypes — Set<string>      (which types could be selected here)
//   · single       — boolean          (true when only one type is enabled
//                                      AND only that type is selected —
//                                      the byte-identity at-flags-off case)
//
// helpers:
//   · toggle(t)    — flip one type in/out of the selection
//   · selectAll()  — select every enabled type
//   · selectOnly(t)— solo a single type
//   · isAllOn      — boolean
//
// Subscribes to `featureflags:change` so flipping a variant flag mid-
// session re-derives the enabled set without a reload.
// ---------------------------------------------------------------------
function useEngagementScope(initial) {
  const [enabled, setEnabled] = useStateES(() => _esEnabledTypes());

  // Initial selection — `initial.types` or all enabled types.
  const [selected, setSelected] = useStateES(() => {
    const initSel = (initial && Array.isArray(initial.types) && initial.types.length)
      ? initial.types
      : enabled;
    return new Set(initSel.filter((t) => enabled.includes(t)));
  });

  useEffectES(() => {
    if (typeof window === "undefined" || !window.addEventListener) return;
    const handler = () => {
      const next = _esEnabledTypes();
      setEnabled(next);
      // Re-filter selection: drop types that are no longer enabled,
      // and if every type is currently selected, keep "all enabled"
      // semantics (so newly-enabled types get auto-included).
      setSelected((prev) => {
        const wasAll = enabled.every((t) => prev.has(t)) && prev.size === enabled.length;
        if (wasAll) return new Set(next);
        const out = new Set();
        for (const t of prev) if (next.includes(t)) out.add(t);
        if (out.size === 0) for (const t of next) out.add(t);
        return out;
      });
    };
    window.addEventListener("featureflags:change", handler);
    return () => window.removeEventListener("featureflags:change", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled.join("|")]);

  const scope = useMemoES(() => {
    const single = enabled.length === 1 && selected.size === 1 && selected.has(enabled[0]);
    return {
      types: selected,
      enabledTypes: new Set(enabled),
      enabledOrder: enabled,
      single,
      has: (t) => selected.has(t),
      isOnly: (t) => selected.size === 1 && selected.has(t),
      isAllOn: enabled.every((t) => selected.has(t)),
    };
  }, [selected, enabled]);

  const toggle = (t) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(t)) {
        // Don't allow deselecting the last selected type; collapse to
        // "all" instead so the surface never goes blank.
        if (next.size === 1) {
          return new Set(enabled);
        }
        next.delete(t);
      } else {
        next.add(t);
      }
      return next;
    });
  };
  const selectAll = () => setSelected(new Set(enabled));
  const selectOnly = (t) => setSelected(new Set([t]));

  return [scope, { toggle, selectAll, selectOnly, setSelected }];
}

// ---------------------------------------------------------------------
// <EngagementScope/> — the chip-bar UI.
//
// Props:
//   · value     — scope (from useEngagementScope)
//   · onChange  — { toggle, selectAll, selectOnly } (the helpers)
//   · counts    — optional { frontline: 12, professional: 4, … }
//                 rendered as muted tabular numbers inside each chip
//   · label     — leading label (default "Engagement type")
//   · compact   — strips the leading label for tight layouts
//   · single    — when true the chip-bar runs in single-select mode:
//                 clicking a chip solos to that type, no toggle, no
//                 "All" chip. Used by surfaces that genuinely show one
//                 type at a time (legacy lists during migration).
// ---------------------------------------------------------------------
function EngagementScope({ value, onChange, counts, label, compact, single }) {
  // Removed throughout the product — Frontline / Professional / SOW chip-
  // bars are no longer surfaced anywhere. Filter primitives live in the
  // per-page filter panels instead. Returning null hides every consumer's
  // chip-bar in one place so individual list pages don't have to change.
  return null;
  // eslint-disable-next-line no-unreachable
  const Icon = window.Icon || (() => null);
  const enabled = value.enabledOrder || ["frontline"];

  // Byte-identity collapse — when only Frontline is on, render the
  // single neutral "All engagements" pill. The chip-bar gets out of the
  // way so the surface looks identical to the pre-unification baseline.
  if (enabled.length === 1) {
    return (
      <div className="es-bar es-bar--collapsed" role="region" aria-label="Engagement scope">
        {compact ? null : <span className="es-bar-lbl">{label || "Engagement type"}</span>}
        <span className="es-pill es-pill--all">All engagements</span>
      </div>
    );
  }

  const allOn = value.isAllOn;

  return (
    <div className="es-bar" role="region" aria-label="Engagement scope">
      {compact ? null : <span className="es-bar-lbl">{label || "Engagement type"}</span>}

      {/* "All" chip — multi-select mode only. In single-select mode
          the user must pick one specific type; "All" doesn't apply. */}
      {single ? null : (
        <button
          type="button"
          className={"es-chip es-chip--all" + (allOn ? " is-on" : "")}
          aria-pressed={allOn}
          onClick={() => onChange.selectAll()}
        >
          <Icon name="Grid" size={14} />
          <span>All</span>
          {counts && counts.__total != null
            ? <span className="es-chip-count tabular">{counts.__total}</span>
            : null}
        </button>
      )}

      {enabled.map((t) => {
        const m = _ES_META[t];
        if (!m) return null;
        const on = single ? value.isOnly(t) : value.has(t);
        return (
          <button
            key={t}
            type="button"
            className={`es-chip ${m.chipClass}` + (on ? " is-on" : "")}
            aria-pressed={on}
            onClick={(e) => {
              if (single) {
                onChange.selectOnly(t);
              } else if (e.shiftKey || e.metaKey || e.ctrlKey) {
                // Modifier-click = solo. Power-user shortcut surfaced
                // here so dense surfaces can isolate a single type.
                onChange.selectOnly(t);
              } else {
                onChange.toggle(t);
              }
            }}
            onDoubleClick={() => onChange.selectOnly(t)}
            title={single
              ? `${m.label}`
              : `${m.label} · click to toggle, double-click to solo`}
          >
            <Icon name={m.icon} size={14} />
            <span>{m.label}</span>
            {counts && counts[t] != null
              ? <span className="es-chip-count tabular">{counts[t]}</span>
              : null}
          </button>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------
// engagementScopeMatchesRow(scope, row)
// Convenience matcher for list filters. Reads row.engagementType OR
// derives it from row.sourcingChannel via inferSourcingChannel().
// Falls back to "frontline" when nothing matches.
// ---------------------------------------------------------------------
function engagementScopeMatchesRow(scope, row) {
  if (!scope) return true;
  let t = (row && row.engagementType) || null;
  if (!t && row && row.sourcingChannel) {
    t = ({
      "Agency":         "frontline",
      "SOW":            "professional",
      "Direct":         "contractor",
      "SOW-milestone":  "sow",
      "EOR":            "eor",
    })[row.sourcingChannel] || "frontline";
  }
  if (!t) t = "frontline";
  return scope.types.has(t);
}

Object.assign(window, {
  EngagementScope,
  useEngagementScope,
  engagementScopeMatchesRow,
  ENGAGEMENT_TYPE_META: _ES_META,
});
