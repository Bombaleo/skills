// =====================================================================
// Engagement Type — the top-level intake mode picker.
//
// Adds an explicit "Engagement Type" axis to the requisition flow and
// the main data tables. Four values:
//
//   · Shift               (always-on, today's Frontline default cell)
//   · Assignment          (flag · engAssignment)
//   · Project             (flag · engProject)
//   · Statement of Work   (flag · engStatementOfWork)
//
// Activates the moment ANY of the three flags is on; with every flag
// off the picker is hidden on intake and the Engagement Type column
// + filter are hidden on every list (DOM is byte-identical to the
// all-flags-off ship).
//
// Public API (window.EngagementType):
//   · ENG_TYPES                  — canonical array of value strings
//   · isOn()                     — boolean (any flag on)
//   · enabledTypes()             — string[] (always includes "Shift")
//   · typeOf(row, id)            — string  (derived from row / id)
//   · useBodyClass()             — toggles body.engtype-cols-on
//   · matchType(row, vals)       — predicate for applyFilters
//   · EngagementTypePicker       — card component for new-requisition
//   · EngagementTypeCell         — table cell chip
//   · EngagementTypeFilterChip   — toolbar filter chip
// =====================================================================

(function () {
  const ENG_TYPES = ["Shift", "Assignment", "Project", "Statement of Work"];

  // -----------------------------------------------------------------
  // Billing Basis \u00d7 Time Capture options per Engagement Type.
  //
  //   \u00b7 Shift               \u2192 hourly only            \u00d7 clock-in/out only
  //   \u00b7 Assignment          \u2192 hourly/weekly/monthly/fixed \u00d7 clock-in/out/time tracking/N/A
  //   \u00b7 Project             \u2192 fixed/milestone        \u00d7 time tracking/N/A
  //   \u00b7 Statement of Work   \u2192 milestone only         \u00d7 time tracking/N/A
  //
  // Defaults are the canonical pairing the picker should snap to when
  // the user lands on the type for the first time.
  // -----------------------------------------------------------------
  const ENG_TYPE_OPTIONS = {
    "Shift": {
      billingBasis: ["Hourly"],
      timeCapture:  ["Clock-in/out"],
      defaults:     { billingBasis: "Hourly", timeCapture: "Clock-in/out" },
    },
    "Assignment": {
      billingBasis: ["Hourly", "Weekly", "Monthly", "Fixed"],
      timeCapture:  ["Clock-in/out", "Time Tracking", "N/A"],
      defaults:     { billingBasis: "Hourly", timeCapture: "Time Tracking" },
    },
    "Project": {
      billingBasis: ["Fixed", "Milestone"],
      timeCapture:  ["Time Tracking", "N/A"],
      defaults:     { billingBasis: "Fixed", timeCapture: "Time Tracking" },
    },
    "Statement of Work": {
      billingBasis: ["Milestone"],
      timeCapture:  ["Time Tracking", "N/A"],
      defaults:     { billingBasis: "Milestone", timeCapture: "Time Tracking" },
    },
  };

  function optionsFor(engType) {
    return ENG_TYPE_OPTIONS[engType] || ENG_TYPE_OPTIONS["Shift"];
  }
  function defaultsFor(engType) {
    return optionsFor(engType).defaults;
  }
  // Snap a (billingBasis, timeCapture) pair to a valid value for the
  // current engType. Used when the user changes engType in the picker
  // and the previously-selected basis/capture is no longer permitted.
  function normalizePair(engType, billingBasis, timeCapture) {
    const opts = optionsFor(engType);
    const out = { ...opts.defaults };
    if (billingBasis && opts.billingBasis.includes(billingBasis)) out.billingBasis = billingBasis;
    if (timeCapture  && opts.timeCapture.includes(timeCapture))   out.timeCapture  = timeCapture;
    return out;
  }

  // -----------------------------------------------------------------
  // Flag plumbing.
  // -----------------------------------------------------------------
  function _ff(key) {
    return !!(window.getFeatureFlag && window.getFeatureFlag(key));
  }

  function isOn() {
    return _ff("engAssignment") || _ff("engProject") || _ff("engStatementOfWork");
  }

  function enabledTypes() {
    const out = ["Shift"]; // always on
    if (_ff("engAssignment"))      out.push("Assignment");
    if (_ff("engProject"))         out.push("Project");
    if (_ff("engStatementOfWork")) out.push("Statement of Work");
    return out;
  }

  // -----------------------------------------------------------------
  // Per-row derivation.
  //
  // 1. If the row carries an explicit `engagementType`, trust it.
  // 2. Otherwise derive from the v0.77 axis inference (sourcing
  //    channel → axes) so existing fixture data resolves cleanly:
  //      · channel "SOW-milestone"     → "Statement of Work"
  //      · billingModel = Milestone    → "Statement of Work"
  //      · workType = Assignment       → "Assignment"
  //      · everything else             → "Shift"
  //    (Project has no existing source — it's the new value the user
  //    creates on intake; the demo data path leaves it absent.)
  // -----------------------------------------------------------------
  // Alias map — pool / supplier-type tags that some surfaces store
  // in `row.engagementType` (e.g. invoice rows tagged "SOW",
  // "Contractor", "EOR", "Professional"). The canonical Engagement
  // Type column resolves these to one of the four matrix values so
  // the chip + filter line up with ENG_TYPE_OPTIONS.
  //
  //   · "SOW"          → Statement of Work
  //   · "Contractor"   → Assignment  (IC engaged on a named, dated
  //                                   assignment; the IC chip is on
  //                                   the Supplier Types column)
  //   · "EOR"          → Assignment  (EOR-engaged worker on a named
  //                                   assignment; EOR chip is on the
  //                                   Supplier Types column)
  //   · "Professional" → Assignment
  const ENG_TYPE_ALIAS = {
    "SOW":          "Statement of Work",
    "Contractor":   "Assignment",
    "EOR":          "Assignment",
    "Professional": "Assignment",
  };

  function typeOf(row, id) {
    if (row && row.engagementType) {
      if (ENG_TYPES.includes(row.engagementType)) return row.engagementType;
      if (ENG_TYPE_ALIAS[row.engagementType])     return ENG_TYPE_ALIAS[row.engagementType];
    }
    // Worker-row pool → engagement type mapping. Workforce fixtures
    // carry a `pool` field today; we resolve it deterministically
    // without round-tripping through V77.inferAxes (which prefers
    // requisition-id heuristics).
    if (row && row.pool) {
      const p = String(row.pool).toLowerCase();
      if (p === "contractor")                 return "Assignment";
      if (p === "professional")               return "Assignment";
      if (p === "sow" || p === "sow resources") return "Statement of Work";
      return "Shift";
    }
    const rid = id || (row && row.id) || "";
    if (window.V77 && window.V77.inferAxes) {
      try {
        const a = window.V77.inferAxes(row, rid);
        if (a.billingModel === "Milestone")    return "Statement of Work";
        if (a.workType     === "Assignment")   return "Assignment";
        return "Shift";
      } catch (_) { /* fall through */ }
    }
    // Fallback when V77 isn't loaded yet — read the id prefix.
    if (typeof rid === "string") {
      if (rid.startsWith("SOW-")) return "Statement of Work";
      if (rid.startsWith("PRO-")) return "Assignment";
      if (rid.startsWith("CON-")) return "Assignment";
    }
    return "Shift";
  }

  // -----------------------------------------------------------------
  // Filter predicate.
  // -----------------------------------------------------------------
  function matchType(row, vals) {
    if (!vals || vals.length === 0) return true;
    return vals.includes(typeOf(row, row && row.id));
  }

  // -----------------------------------------------------------------
  // Body-class hook — toggled `engtype-cols-on` lets the CSS file
  // insert the column track without each page re-implementing the
  // gate. Re-runs on flag change so toggling in Settings takes effect
  // immediately.
  // -----------------------------------------------------------------
  function useBodyClass() {
    const on = isOn();
    if (typeof React !== "undefined" && React.useEffect) {
      React.useEffect(() => {
        const cls = "engtype-cols-on";
        if (on) document.body.classList.add(cls);
        else document.body.classList.remove(cls);
        return () => document.body.classList.remove(cls);
      }, [on]);
    } else if (typeof document !== "undefined") {
      if (on) document.body.classList.add("engtype-cols-on");
      else document.body.classList.remove("engtype-cols-on");
    }
    return on;
  }

  // -----------------------------------------------------------------
  // <EngagementTypeCell> — the inline chip for a single row.
  // -----------------------------------------------------------------
  function EngagementTypeCell({ row, id }) {
    const t = typeOf(row, id);
    const slug = t.replace(/\s+/g, "-").toLowerCase();
    return React.createElement(
      "span",
      { className: `et-chip et-chip--${slug}` },
      t
    );
  }

  // -----------------------------------------------------------------
  // <EngagementTypePicker> — the card on the New Requisition flow.
  //
  // Renders only the enabled types as selectable tiles; "Shift" is
  // always selectable. Off-by-flag types are hidden entirely (vs.
  // disabled-with-tooltip) so the tenant only ever sees what they've
  // turned on.
  // -----------------------------------------------------------------
  function EngagementTypePicker({ value, onChange }) {
    const opts = enabledTypes();
    if (opts.length <= 1) return null; // only Shift → nothing to pick
    const current = opts.includes(value) ? value : "Shift";

    const DESC = {
      "Shift":              "Scheduled shift with clock in/out. One-off, multi-day, or recurring — covered by an agency worker on an hourly bill rate.",
      "Assignment":         "Named worker on a date-range assignment. Period timesheet billing — no recurring schedule, no clock punch.",
      "Project":            "Supplier-led delivery against a project budget. Weekly burn reporting, no headcount commitment.",
      "Statement of Work":  "MSA-anchored SOW. Milestones with fees, acceptance criteria, change orders.",
    };
    const ICON = {
      "Shift":              "EngagementShift",
      "Assignment":         "EngagementAssignment",
      "Project":            "EngagementProject",
      "Statement of Work":  "EngagementSow",
    };

    return React.createElement(
      "section",
      { className: "et-card", "aria-labelledby": "et-card-h" },
      React.createElement(
        "header",
        { className: "et-card-head" },
        React.createElement("h2", { id: "et-card-h", className: "et-card-title" }, "Engagement type"),
        React.createElement(
          "p",
          { className: "et-card-sub" },
          "How is the work shaped? Pick the engagement mode — it sets time capture, billing, and the fields below."
        )
      ),
      React.createElement(
        "div",
        { className: "et-tile-row", role: "radiogroup", "aria-label": "Engagement type" },
        opts.map((t) => {
          const selected = (t === current);
          return React.createElement(
            "button",
            {
              key: t,
              type: "button",
              role: "radio",
              "aria-checked": selected,
              className: "et-tile" + (selected ? " et-tile--on" : ""),
              onClick: () => onChange && onChange(t),
            },
            React.createElement(
              "span",
              { className: "et-tile-icon", "aria-hidden": "true" },
              window.Icon
                ? React.createElement(window.Icon, { name: ICON[t] || "Briefcase", size: 20 })
                : null
            ),
            React.createElement(
              "span",
              { className: "et-tile-body" },
              React.createElement("span", { className: "et-tile-title" }, t),
              React.createElement("span", { className: "et-tile-desc" }, DESC[t])
            ),
            selected && window.Icon
              ? React.createElement(window.Icon, {
                  name: "Checkmark",
                  size: 16,
                  className: "et-tile-check",
                })
              : null
          );
        })
      )
    );
  }

  // -----------------------------------------------------------------
  // <EngagementTypeFilterChip> — toolbar filter chip with popover.
  // Self-contained: clicking opens a small popover with the enabled
  // values as checkboxes; commits on Apply.
  // -----------------------------------------------------------------
  function EngagementTypeFilterChip({ value, onChange }) {
    const [open, setOpen] = React.useState(false);
    const [draft, setDraft] = React.useState(value || []);
    const rootRef = React.useRef(null);
    const opts = enabledTypes();

    React.useEffect(() => { setDraft(value || []); }, [value]);

    React.useEffect(() => {
      if (!open) return;
      function onDocClick(e) {
        if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
      }
      document.addEventListener("mousedown", onDocClick);
      return () => document.removeEventListener("mousedown", onDocClick);
    }, [open]);

    function toggleVal(v) {
      setDraft((cur) => {
        if (cur.includes(v)) return cur.filter((x) => x !== v);
        return cur.concat([v]);
      });
    }

    const activeCount = (value || []).length;
    const isOn = activeCount > 0;
    const label = isOn
      ? (activeCount === 1
          ? value[0]
          : `Engagement type · ${activeCount}`)
      : "Engagement type";

    return React.createElement(
      "div",
      { className: "et-filter", ref: rootRef },
      React.createElement(
        "button",
        {
          type: "button",
          className: "et-filter-chip" + (isOn ? " et-filter-chip--on" : ""),
          "aria-haspopup": "menu",
          "aria-expanded": open,
          onClick: () => setOpen((o) => !o),
        },
        window.Icon ? React.createElement(window.Icon, { name: "Briefcase", size: 14 }) : null,
        React.createElement("span", null, label),
        window.Icon ? React.createElement(window.Icon, { name: "ChevronDown", size: 12 }) : null
      ),
      open && React.createElement(
        "div",
        { className: "et-filter-pop", role: "menu" },
        React.createElement("div", { className: "et-filter-pop-title" }, "Engagement type"),
        opts.map((t) =>
          React.createElement(
            "label",
            { key: t, className: "et-filter-opt" },
            React.createElement("input", {
              type: "checkbox",
              checked: draft.includes(t),
              onChange: () => toggleVal(t),
            }),
            React.createElement("span", null, t)
          )
        ),
        React.createElement(
          "div",
          { className: "et-filter-pop-foot" },
          React.createElement(
            "button",
            {
              type: "button",
              className: "btn btn--secondary btn--sm",
              onClick: () => { setDraft([]); onChange && onChange([]); setOpen(false); },
            },
            "Clear"
          ),
          React.createElement(
            "button",
            {
              type: "button",
              className: "btn btn--primary btn--sm",
              onClick: () => { onChange && onChange(draft); setOpen(false); },
            },
            "Apply"
          )
        )
      )
    );
  }

  Object.assign(window, {
    EngagementType: {
      ENG_TYPES,
      ENG_TYPE_OPTIONS,
      optionsFor,
      defaultsFor,
      normalizePair,
      isOn,
      enabledTypes,
      typeOf,
      matchType,
      useBodyClass,
      EngagementTypePicker,
      EngagementTypeCell,
      EngagementTypeFilterChip,
    },
    // Convenience aliases so consumers can import flatly if they want.
    EngagementTypePicker,
    EngagementTypeCell,
    EngagementTypeFilterChip,
  });
})();
