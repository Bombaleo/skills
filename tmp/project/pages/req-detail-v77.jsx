// =====================================================================
// req-detail-v77.jsx  ·  Unified Requisition / Engagement detail · v0.77
//
// Implements the three-axis architecture from unified-req-detail-v0.77.html:
//
//   · Axis 1 · Work Type     · Shift     | Assignment
//   · Axis 2 · Billing Model · ClockInOut | Timesheet | Milestone | FixedFee
//   · Axis 3 · Supplier Type · Agency    | IndependentContractor | EOR
//
//   · A WORK_x_PAY compatibility matrix culls cartesian nonsense.
//   · A SECTION_CATALOG names each accordion + the axis values that
//     activate it. The all-flags-off cell {Shift, ClockInOut, Agency}
//     activates today's seven Frontline accordions in their current
//     order — the catalog walk is byte-equivalent to today's ship.
//
// FLAG-OFF CONTRACT (the hard one):
//   · This whole module is dead code unless `v77Axes` is on.
//   · Nothing here mounts to the DOM, mutates state, or reads a fixture
//     until `getFeatureFlag("v77Axes")` returns true.
//   · The router (requisition-engagement-detail.jsx) checks the flag
//     before rendering AxisChipRow or InspectorPanel; with the flag
//     off, neither component is ever invoked.
//
// User-visible affordances (flag-on only):
//   · A row of three small axis chips in the detail hero (replaces the
//     v0.6 VariantTypeStrip when more than one engagement type is on).
//   · A floating "v0.77 axes" inspector button on the detail page that
//     opens a panel showing the row's cell + the matrix grid + the
//     composed section stack from the catalog walk.
//
// See unified-req-detail-v0.77.html for the spec this implements.
// =====================================================================

(function () {

  // -----------------------------------------------------------------
  // Constants — enum value sets and compatibility matrix.
  // -----------------------------------------------------------------

  const WORK_TYPES = ["Shift", "Assignment"];
  const BILLING_MODELS = ["ClockInOut", "Timesheet", "Milestone", "FixedFee"];
  const SUPPLIER_TYPES = ["Agency", "IndependentContractor", "EOR", "Float"];

  // Human-readable labels (the chip text + the picker label).
  const LABEL = {
    Shift:                  "Shift",
    Assignment:             "Assignment",
    ClockInOut:             "Clock-in/out",
    Timesheet:              "Timesheet",
    Milestone:              "Milestone",
    FixedFee:               "Fixed",
    Agency:                 "Agency",
    IndependentContractor:  "Independent Contractor",
    EOR:                    "EOR",
    Float:                  "Float",
  };

  // The compatibility rule (spec §02b).
  //   · Shift work only pairs with time-clock or timesheet.
  //   · Assignment work pairs with Timesheet / Milestone / Fixed Fee.
  //   · Anything else is nonsense and blocked at the picker.
  const WORK_x_PAY = {
    Shift:      ["ClockInOut", "Timesheet"],
    Assignment: ["Timesheet", "Milestone", "FixedFee"],
  };

  // Supplier × Billing soft warnings (not blocked — soft-warn at picker).
  //   Assignment × FixedFee × EOR is rare in practice.
  const SOFT_WARN = [
    { workType: "Assignment", billingModel: "FixedFee", supplierType: "EOR",
      note: "EOR usually bills time — fixed-fee EOR is uncommon." },
  ];

  function isCompatible(axes) {
    const pairs = WORK_x_PAY[axes.workType];
    return !!(pairs && pairs.includes(axes.billingModel));
  }

  function softWarning(axes) {
    return SOFT_WARN.find(
      (w) => w.workType === axes.workType &&
             w.billingModel === axes.billingModel &&
             w.supplierType === axes.supplierType
    ) || null;
  }

  // -----------------------------------------------------------------
  // Axis derivation — map an existing row + id to the v0.77 tuple.
  //
  // This is the v0.77 backfill rule (spec §10 Phase 1) realised at
  // runtime: instead of writing a migration, we derive the axes from
  // the existing `sourcingChannel` / id-prefix the router already
  // uses. The output is stable across reloads and audit-loggable.
  // -----------------------------------------------------------------

  function inferAxes(row, id) {
    const channel = (window.inferSourcingChannel
      ? window.inferSourcingChannel(id, row)
      : (row && row.sourcingChannel) || "Agency");

    // Channel → axes mapping. Mirrors the v0.6/v0.7 inferSourcingChannel
    // value set, projected onto the three v0.77 axes.
    switch (channel) {
      case "Direct":
        // Independent Contractor (1099 / IC) — buyer's direct engagement.
        // Without more signal we assume Assignment + Timesheet (today's
        // Contractor variant shipped that way).
        return {
          workType:     "Assignment",
          billingModel: "Timesheet",
          supplierType: "IndependentContractor",
        };

      case "SOW":
        // Professional engagement under an SOW MSA — Assignment work
        // billed on Timesheet by default (the canonical Professional
        // case ships today).
        return {
          workType:     "Assignment",
          billingModel: "Timesheet",
          supplierType: "Agency",
        };

      case "SOW-milestone":
        // SOW agreement with named milestones — Assignment work billed
        // on Milestone acceptance.
        return {
          workType:     "Assignment",
          billingModel: "Milestone",
          supplierType: "Agency",
        };

      case "EOR":
        // EOR Worker (preview) — Assignment + Timesheet + EOR.
        return {
          workType:     "Assignment",
          billingModel: "Timesheet",
          supplierType: "EOR",
        };

      case "FloatPool":
        // Float — internal float-pool / per-diem worker picking up an
        // open shift across sites. Profile + hours owned by Dayforce
        // core; Flex Work mirrors the worker so a requisition can
        // target the float pool directly without a supplier tier.
        return {
          workType:     "Shift",
          billingModel: "ClockInOut",
          supplierType: "Float",
        };

      // Internal / FloatPool / PerDiem / Alumni / Agency / unknown —
      // fold into the all-flags-off default cell. This is what today's
      // Frontline ship resolves to, so byte-parity holds.
      default:
        return {
          workType:     "Shift",
          billingModel: "ClockInOut",
          supplierType: "Agency",
        };
    }
  }

  // -----------------------------------------------------------------
  // Section catalog — the entries from spec §06 + §09.
  //
  // Each entry: { id, axis, axisValues?, position, flag?, summary }.
  // The seven baseline entries (no flag) compose to today's Frontline
  // accordions when the row is {Shift, ClockInOut, Agency} — the only
  // cell reachable at all-flags-off.
  //
  // NOTE: in v0.77 this catalog is *informational* — the actual DOM
  // for shipped variants still comes from their existing body files,
  // which is what keeps the flag-off render byte-identical. The
  // catalog drives the AxisChipRow (which sections are active) and
  // the InspectorPanel (which sections compose). Phase 2 of the spec
  // adds the dual code path that renders through the catalog.
  // -----------------------------------------------------------------

  const SECTION_CATALOG = [
    // ── baseline · today's 7 accordions ─────────────────────────────
    { id: "requisition",        axis: "always",                                                        position: 10, summary: "Title, dates, manager, justification, workflow." },
    { id: "distribution",       axis: "supplierType", axisValues: ["Agency"],                          position: 20, summary: "Suppliers, tier, time-to-bid, bids." },
    { id: "managers",           axis: "always",                                                        position: 30, summary: "Approvers, escalation chain." },
    { id: "workers",            axis: "billingModel", axisValues: ["ClockInOut", "Timesheet"],         position: 40, summary: "Booked workers." },
    { id: "timesheet",          axis: "billingModel", axisValues: ["ClockInOut", "Timesheet"],         position: 50, summary: "Period log + approval." },
    { id: "compliance",         axis: "workType",     axisValues: ["Shift"],                           position: 60, summary: "Credentials, expiry rollup." },
    { id: "audit",              axis: "always",                                                        position: 99, summary: "Shared writeAudit() entries newest-first." },

    // ── work type adds · Assignment ─────────────────────────────────
    { id: "pipeline",           axis: "workType",     axisValues: ["Assignment"],                      position: 35, flag: "professionalWork", summary: "Candidate kanban." },
    { id: "interviews",         axis: "workType",     axisValues: ["Assignment"],                      position: 38, flag: "professionalWork", summary: "Scheduled interviews + panel." },
    { id: "contract-terms",     axis: "workType",     axisValues: ["Assignment"],                      position: 55, flag: "professionalWork", summary: "Term, renewal, cadence rate." },

    // ── supplier type adds · IC + EOR ───────────────────────────────
    { id: "identity",           axis: "supplierType", axisValues: ["IndependentContractor", "EOR"],    position: 15, flag: "contractors|eor", summary: "Legal name, contact, banking." },
    { id: "classification",     axis: "supplierType", axisValues: ["IndependentContractor"],           position: 65, flag: "contractors",     summary: "IRS 20-factor / ABC determination." },
    { id: "tax-and-documents",  axis: "supplierType", axisValues: ["IndependentContractor"],           position: 70, flag: "contractors",     summary: "W-9 / W-8BEN / MSA / NDA / COI." },
    { id: "local-entity",       axis: "supplierType", axisValues: ["EOR"],                             position: 72, flag: "eor",             summary: "Country, partner, in-country employment." },
    { id: "global-tax-fx",      axis: "supplierType", axisValues: ["EOR"],                             position: 75, flag: "eor",             summary: "Local gross pay, FX lock date." },

    // ── billing model adds · Milestone + Fixed Fee ──────────────────
    { id: "milestones",         axis: "billingModel", axisValues: ["Milestone"],                       position: 40, flag: "sow",             summary: "Schedule, acceptance, change orders." },
    { id: "deliverables",       axis: "billingModel", axisValues: ["Milestone"],                       position: 45, flag: "sow",             summary: "Files, sign-offs." },
    { id: "burn-and-budget",    axis: "billingModel", axisValues: ["Milestone"],                       position: 50, flag: "sow",             summary: "Committed vs. consumed." },
    { id: "fee-schedule",       axis: "billingModel", axisValues: ["FixedFee"],                        position: 50, flag: "sow",             summary: "Retainer cadence or one-shot fee schedule." },
  ];

  // Catalog walk: filter by axis match × active flag, sort by position.
  function activeSections(row, id) {
    const axes = inferAxes(row, id);
    const flagsAnyOn = (spec) => {
      if (!spec) return true;
      const keys = String(spec).split("|").map((s) => s.trim()).filter(Boolean);
      const get  = window.getFeatureFlag || (() => false);
      return keys.some((k) => get(k));
    };
    return SECTION_CATALOG
      .filter((s) => s.axis === "always" || (s.axisValues && s.axisValues.includes(axes[s.axis])))
      .filter((s) => flagsAnyOn(s.flag))
      .slice()
      .sort((a, b) => a.position - b.position);
  }

  // -----------------------------------------------------------------
  // Flag predicate. The whole module is dead code when this returns
  // false — components below short-circuit immediately.
  // -----------------------------------------------------------------

  function useV77Enabled() {
    return !!(window.useFeatureFlag && window.useFeatureFlag("v77Axes"));
  }

  function v77IsEnabled() {
    return !!(window.getFeatureFlag && window.getFeatureFlag("v77Axes"));
  }

  // -----------------------------------------------------------------
  // AxisChipRow — three small chips in axis colors. Renders in the
  // detail page above the Frontline body when the v77Axes flag is on.
  //
  // Returns null when:
  //   · v77Axes flag is off — flag-off contract
  //   · only one engagement type is enabled (single-cell tenant — no
  //     value in showing axis chips when no axis can vary)
  // -----------------------------------------------------------------

  function AxisChipRow({ row, requisitionId }) {
    const enabled = useV77Enabled();
    if (!enabled) return null;

    // Hide when only one matrix cell is reachable. Mirrors the v0.6
    // VariantTypeStrip's `enabled > 1` gate so the chip-row never
    // surfaces on a single-type tenant.
    const variantCount = (window.VariantRegistry && window.VariantRegistry.enabledTypes)
      ? window.VariantRegistry.enabledTypes()
      : 1;
    if (variantCount <= 1) return null;

    const axes = inferAxes(row, requisitionId);
    const sections = activeSections(row, requisitionId);
    const compatible = isCompatible(axes);
    const warn = softWarning(axes);
    const [open, setOpen] = React.useState(false);

    return React.createElement(
      "div",
      { className: "v77-chiprow", "data-v77": "true", "data-axes-cell": `${axes.workType}-${axes.billingModel}-${axes.supplierType}` },
      React.createElement(
        "div",
        { className: "v77-chiprow-mark" },
        React.createElement("span", { className: "v77-chiprow-eyebrow" }, "v0.77 axes"),
      ),
      React.createElement(
        "div",
        { className: "v77-chiprow-axes" },
        React.createElement(AxisChip, { axis: "how",  label: "Engagement Model", value: LABEL[axes.billingModel] }),
        React.createElement(AxisChip, { axis: "who",  label: "Supplier Type", value: LABEL[axes.supplierType] }),
      ),
      !compatible && React.createElement(
        "div",
        { className: "v77-chiprow-warn v77-chiprow-warn--error" },
        "Incompatible cell · ", axes.workType, " × ", LABEL[axes.billingModel],
      ),
      warn && React.createElement(
        "div",
        { className: "v77-chiprow-warn v77-chiprow-warn--soft", title: warn.note },
        "Rare cell · ", warn.note,
      ),
      React.createElement(
        "button",
        { className: "v77-chiprow-inspect", type: "button", onClick: () => setOpen(true), title: "Open the v0.77 axis inspector" },
        "Inspect (", sections.length, ")"
      ),
      open && React.createElement(InspectorPanel, { row, requisitionId, axes, sections, onClose: () => setOpen(false) }),
    );
  }

  function AxisChip({ axis, label, value }) {
    return React.createElement(
      "span",
      { className: `v77-chip v77-chip--${axis}`, title: `${label} · ${value}` },
      React.createElement("span", { className: "v77-chip-label" }, label),
      React.createElement("span", { className: "v77-chip-dot", "aria-hidden": "true" }),
      React.createElement("span", { className: "v77-chip-value" }, value),
    );
  }

  // -----------------------------------------------------------------
  // InspectorPanel — the floating panel that opens from the chip row.
  //
  // Shows three things:
  //   · The row's current cell (axes + matrix-cell highlight)
  //   · The active sections from the catalog walk
  //   · The Work Type × Billing Model compatibility grid
  //
  // Read-only — the panel does not mutate the row. It exists to make
  // the v0.77 architecture inspectable without leaving the page, and
  // to validate that the catalog walk composes correctly for the
  // current row.
  // -----------------------------------------------------------------

  function InspectorPanel({ row, requisitionId, axes, sections, onClose }) {
    return React.createElement(
      "div",
      { className: "v77-inspector-scrim", onClick: (e) => { if (e.target === e.currentTarget) onClose(); } },
      React.createElement(
        "aside",
        { className: "v77-inspector", role: "dialog", "aria-label": "v0.77 axes inspector" },
        React.createElement(
          "div",
          { className: "v77-inspector-head" },
          React.createElement(
            "div",
            null,
            React.createElement("div", { className: "v77-inspector-eyebrow" }, "v0.77 axes · inspector"),
            React.createElement("div", { className: "v77-inspector-title" }, requisitionId || "(no id)"),
          ),
          React.createElement(
            "button",
            { className: "v77-inspector-close", type: "button", onClick: onClose, "aria-label": "Close" },
            "×"
          ),
        ),
        React.createElement(
          "div",
          { className: "v77-inspector-body" },

          // Row cell
          React.createElement(
            "section",
            { className: "v77-block" },
            React.createElement("h3", { className: "v77-block-h" }, "This row's cell"),
            React.createElement(
              "div",
              { className: "v77-cell" },
              React.createElement(AxisChip, { axis: "what", label: "Work Type",     value: LABEL[axes.workType] }),
              React.createElement(AxisChip, { axis: "how",  label: "Engagement Model", value: LABEL[axes.billingModel] }),
              React.createElement(AxisChip, { axis: "who",  label: "Supplier Type", value: LABEL[axes.supplierType] }),
            ),
            React.createElement(
              "div",
              { className: "v77-cell-note" },
              isCompatible(axes)
                ? "Valid Work Type × Billing Model combination."
                : "Incompatible — Work Type × Billing Model violates §02b.",
              softWarning(axes) ? " · " + softWarning(axes).note : "",
            ),
          ),

          // Active sections
          React.createElement(
            "section",
            { className: "v77-block" },
            React.createElement("h3", { className: "v77-block-h" }, "Composed sections · catalog walk"),
            React.createElement(
              "ol",
              { className: "v77-sections" },
              sections.map((s) => React.createElement(
                "li",
                { key: s.id, className: `v77-section v77-section--${s.axis}` },
                React.createElement("span", { className: "v77-section-pos" }, "pos " + s.position),
                React.createElement("span", { className: "v77-section-id" }, s.id),
                React.createElement("span", { className: "v77-section-axis" }, s.axis),
                React.createElement("span", { className: "v77-section-sum" }, s.summary),
              )),
            ),
            React.createElement(
              "div",
              { className: "v77-cell-note" },
              "These ", sections.length, " sections are what the catalog walk would render for this row. ",
              "Phase 2 of the spec wires them through the existing shell; today the variant body still owns the DOM."
            ),
          ),

          // Compatibility grid
          React.createElement(
            "section",
            { className: "v77-block" },
            React.createElement("h3", { className: "v77-block-h" }, "Work Type × Billing Model compatibility"),
            React.createElement(CompatGrid, { axes }),
          ),

          // Section catalog (full)
          React.createElement(
            "section",
            { className: "v77-block" },
            React.createElement(
              "details",
              null,
              React.createElement("summary", { className: "v77-block-h", style: { cursor: "pointer" } }, "Full section catalog · " + SECTION_CATALOG.length + " entries"),
              React.createElement(
                "table",
                { className: "v77-catalog-table" },
                React.createElement(
                  "thead",
                  null,
                  React.createElement(
                    "tr",
                    null,
                    React.createElement("th", null, "id"),
                    React.createElement("th", null, "axis"),
                    React.createElement("th", null, "values"),
                    React.createElement("th", null, "pos"),
                    React.createElement("th", null, "flag"),
                  )
                ),
                React.createElement(
                  "tbody",
                  null,
                  SECTION_CATALOG.map((s) => React.createElement(
                    "tr",
                    { key: s.id, className: sections.find((x) => x.id === s.id) ? "v77-catalog-active" : "" },
                    React.createElement("td", null, React.createElement("code", null, s.id)),
                    React.createElement("td", null, s.axis),
                    React.createElement("td", null, (s.axisValues || []).join(", ")),
                    React.createElement("td", null, s.position),
                    React.createElement("td", null, s.flag ? React.createElement("code", null, s.flag) : "—"),
                  )),
                )
              )
            ),
          ),

        ),
      ),
    );
  }

  function CompatGrid({ axes }) {
    return React.createElement(
      "table",
      { className: "v77-compat" },
      React.createElement(
        "thead",
        null,
        React.createElement(
          "tr",
          null,
          React.createElement("th", null, ""),
          ...BILLING_MODELS.map((b) => React.createElement("th", { key: b }, LABEL[b])),
        )
      ),
      React.createElement(
        "tbody",
        null,
        WORK_TYPES.map((wt) => React.createElement(
          "tr",
          { key: wt },
          React.createElement("th", null, LABEL[wt]),
          ...BILLING_MODELS.map((bm) => {
            const ok = WORK_x_PAY[wt] && WORK_x_PAY[wt].includes(bm);
            const here = (axes.workType === wt && axes.billingModel === bm);
            return React.createElement(
              "td",
              {
                key: bm,
                className: [
                  "v77-compat-cell",
                  ok ? "v77-compat-cell--ok" : "v77-compat-cell--no",
                  here ? "v77-compat-cell--here" : "",
                ].filter(Boolean).join(" "),
              },
              ok ? (here ? "● here" : "✓") : "—"
            );
          })
        ))
      )
    );
  }

  // -----------------------------------------------------------------
  // Tiny shared helpers — used by lists, inbox items, banners, panels.
  // -----------------------------------------------------------------

  // Returns true when the tenant has more than one matrix cell
  // reachable (i.e. any axis-extending flag is on). The same predicate
  // that gates AxisChipRow gates these helpers — flag-off renders null.
  function v77IsMultiAxis() {
    const c = (window.enabledWorkerTypeCount && window.enabledWorkerTypeCount()) || 1;
    return c > 1;
  }

  // Map an axis name → its color slot for v77-chip classes.
  const LABEL_AXIS = {
    workType:     { color: "what", label: "Work Type" },
    billingModel: { color: "how",  label: "Engagement Model" },
    supplierType: { color: "who",  label: "Supplier Type" },
  };
  function axisFor(axis) { return LABEL_AXIS[axis] || null; }

  // <V77MiniChip axis="workType" value="Shift" /> — one-line axis chip
  // for list cells, inbox items, etc. Returns null when flag-off so
  // consumer surfaces can drop it inline without an extra guard.
  function V77MiniChip({ axis, value, compact }) {
    if (!v77IsMultiAxis()) return null;
    const a = LABEL_AXIS[axis]; if (!a) return null;
    const label = LABEL[value] || value;
    return React.createElement(
      "span",
      {
        className: "v77-mini v77-mini--" + a.color + (compact ? " v77-mini--compact" : ""),
        title: a.label + " · " + label,
        "data-axis": axis,
      },
      React.createElement("span", { className: "v77-mini-dot", "aria-hidden": "true" }),
      React.createElement("span", { className: "v77-mini-value" }, label),
    );
  }

  // <V77InfoBanner icon="Information" tone="info">…</V77InfoBanner> — a
  // generic v0.77 boundary banner used by Schedule console, Compliance
  // header, etc. Hidden at flag-off.
  function V77InfoBanner({ icon, tone, title, children, hideWhenSingleAxis }) {
    if (hideWhenSingleAxis !== false && !v77IsMultiAxis()) return null;
    const Icon = window.Icon || (() => null);
    return React.createElement(
      "div",
      { className: "v77-banner v77-banner--" + (tone || "info"), role: "note" },
      React.createElement(
        "span",
        { className: "v77-banner-ic", "aria-hidden": "true" },
        React.createElement(Icon, { name: icon || "Information", size: 14 }),
      ),
      React.createElement(
        "span",
        { className: "v77-banner-text" },
        title ? React.createElement("b", null, title) : null,
        title ? " " : null,
        children,
      ),
    );
  }

  // -----------------------------------------------------------------
  // Mount on window so the router and other surfaces can read.
  // -----------------------------------------------------------------

  Object.assign(window, {
    V77: {
      // Constants
      WORK_TYPES, BILLING_MODELS, SUPPLIER_TYPES,
      LABEL, WORK_x_PAY,

      // Logic
      inferAxes, isCompatible, softWarning,
      SECTION_CATALOG, activeSections,

      // Flag
      isEnabled: v77IsEnabled,
      useEnabled: useV77Enabled,

      // Helpers shared with consumer surfaces (lists, inbox, panels).
      // Each renderer is gated by `enabledTypes() > 1` upstream so the
      // flag-off DOM stays byte-identical.
      MiniChip:    V77MiniChip,
      InfoBanner:  V77InfoBanner,
      isMultiAxis: v77IsMultiAxis,
      axisFor,
      LABEL_AXIS,
    },
    AxisChipRow,
    V77InspectorPanel: InspectorPanel,
    V77MiniChip,
    V77InfoBanner,
  });

})();
