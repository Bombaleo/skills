// =====================================================================
// v0.77 native filters + columns
//
// Adds "Engagement model" (single per row, multi-select filter) and
// "Supplier types" (multi-value per row, multi-select filter) to the
// main data-table surfaces. Activates when any axis-extending feature
// flag is on (Timesheet, Milestone, Fixed, Independent Contractor, EOR);
// off → these surfaces render byte-identical to the all-flags-off ship.
//
// Public API (window.V77Cols):
//   · isOn()                           — boolean; multi-axis enabled
//   · engagementModelOf(row, id)       — "Clock-in/out" | "Timesheet" | "Milestone" | "Fixed"
//   · supplierTypesOf(row, id)         — ["Agency"] | ["Agency","Independent contractor"] …
//   · engagementModelOpts()            — filter chip options
//   · supplierTypeOpts()               — filter chip options
//   · matchEngagementModel(row, vals)  — predicate (for applyFilters)
//   · matchSupplierTypes(row, vals)    — predicate (for applyFilters)
//   · useBodyClass()                   — React hook that toggles
//                                        body.v77-cols-on for css gating
//
// All helpers are tolerant: if V77 hasn't loaded yet they fall back to
// the canonical Frontline cell (Clock-in/out × Agency).
// =====================================================================

(function () {
  // -----------------------------------------------------------------
  // Multi-axis on/off — true when any axis-extending flag is on.
  // -----------------------------------------------------------------
  function isOn() {
    // v77IsMultiAxis() is defined on window.V77.isMultiAxis. If V77
    // hasn't loaded, fall through to the enabledWorkerTypeCount helper.
    if (window.V77 && window.V77.isMultiAxis) return !!window.V77.isMultiAxis();
    if (window.enabledWorkerTypeCount) return window.enabledWorkerTypeCount() > 1;
    return false;
  }

  // -----------------------------------------------------------------
  // Axis value labels.
  // -----------------------------------------------------------------
  const BM_LABEL = {
    ClockInOut: "Clock-in/out",
    Timesheet:  "Timesheet",
    Milestone:  "Milestone",
    FixedFee:   "Fixed",
  };
  const ST_LABEL = {
    Agency:                 "Agency",
    IndependentContractor:  "Independent contractor",
    EOR:                    "EOR",
    Float:                  "Float",
  };

  // v0.78 \u2014 Billing Basis \u00d7 Time Capture replace the single
  // Engagement Model column. Each row resolves to one of each.
  const BB_LABEL = {
    Hourly:    "Hourly",
    Weekly:    "Weekly",
    Monthly:   "Monthly",
    Fixed:     "Fixed",
    Milestone: "Milestone",
  };
  const TC_LABEL = {
    "Clock-in/out":  "Clock-in/out",
    "Time Tracking": "Time Tracking",
    "N/A":           "N/A",
  };

  // Map the legacy v0.77 billingModel axis value to the v0.78 pair.
  // Used to render Billing Basis + Time Capture for rows that don't
  // carry the explicit fields yet (older fixtures, inferred rows).
  function _legacyBmToPair(bm) {
    switch (bm) {
      case "Timesheet": return { billingBasis: "Hourly",    timeCapture: "Time Tracking" };
      case "Milestone": return { billingBasis: "Milestone", timeCapture: "Time Tracking" };
      case "FixedFee":  return { billingBasis: "Fixed",     timeCapture: "N/A" };
      case "ClockInOut":
      default:          return { billingBasis: "Hourly",    timeCapture: "Clock-in/out" };
    }
  }

  // -----------------------------------------------------------------
  // Per-row axis derivation.
  //
  // The platform already infers a primary axis tuple per row via
  // window.V77.inferAxes — we lean on that and surface the labels.
  //
  // Supplier types: the primary tuple gives ONE supplier type, but
  // some rows fan out (a requisition open to both Agency + IC, an
  // engagement that routes its hours through EOR). We mirror the
  // platform's existing axis flags + a deterministic id-hash to keep
  // demo data stable across reloads.
  // -----------------------------------------------------------------
  function _axes(row, id) {
    if (window.V77 && window.V77.inferAxes) {
      try { return window.V77.inferAxes(row, id); } catch (_) { /* fall through */ }
    }
    return { workType: "Shift", billingModel: "ClockInOut", supplierType: "Agency" };
  }

  function engagementModelOf(row, id) {
    const a = _axes(row, id || (row && row.id));
    return BM_LABEL[a.billingModel] || BM_LABEL.ClockInOut;
  }

  // ---- v0.78 \u2014 Billing Basis \u00d7 Time Capture per row -------------
  //
  // 1. If the row carries explicit `billingBasis` / `timeCapture`
  //    fields (set on intake from v0.78 onward), trust them.
  // 2. Otherwise derive from the legacy v0.77 billingModel axis via
  //    _legacyBmToPair so older fixture rows still render.
  function billingBasisOf(row, id) {
    if (row && row.billingBasis && BB_LABEL[row.billingBasis]) return row.billingBasis;
    const a = _axes(row, id || (row && row.id));
    return _legacyBmToPair(a.billingModel).billingBasis;
  }
  function timeCaptureOf(row, id) {
    if (row && row.timeCapture && TC_LABEL[row.timeCapture]) return row.timeCapture;
    const a = _axes(row, id || (row && row.id));
    return _legacyBmToPair(a.billingModel).timeCapture;
  }

  // Deterministic id hash for demo-data fan-out.
  function _hash(s) {
    let h = 0;
    s = String(s || "");
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return h;
  }

  function supplierTypesOf(row, id) {
    const rid = id || (row && row.id) || "";
    // 1. Explicit row.supplierTypes — when an upstream module sets the
    //    array directly (e.g. SOW / Assignment / Project / Contractor
    //    / EOR invoice adapters), trust it verbatim. Filter against
    //    the known labels so a typo can't slip a stray chip through.
    if (row && Array.isArray(row.supplierTypes) && row.supplierTypes.length) {
      const knownLabels = new Set(Object.values(ST_LABEL));
      const cleaned = row.supplierTypes.filter((t) => knownLabels.has(t));
      if (cleaned.length) return cleaned;
    }
    // 2. Float pool rows — if the worker carries pool="Float" (Mercy's
    //    per-diem nurses, etc.) and the Float supplier type is enabled
    //    on this tenant, surface Float as the supplier-type value.
    //    Float workers are sourced from Dayforce core (no third-party
    //    supplier in the chain), so the chip stands alone.
    const floatOn = window.getFeatureFlag && window.getFeatureFlag("float");
    if (floatOn && row && row.pool === "Float") {
      return [ST_LABEL.Float];
    }
    const a = _axes(row, rid);
    const primary = ST_LABEL[a.supplierType] || ST_LABEL.Agency;

    // Multi-type fan-out: only when the corresponding flag is on AND
    // the row hashes into the "mixed" bucket. Keeps the column honest
    // — most rows still show a single type, exactly what a sane
    // distribution looks like.
    const out = [primary];
    // v0.79 \u2014 read the canonical Supplier Type axis flag directly so
    // turning on Independent Contractor in Settings \u2192 Configuration
    // \u2192 Supplier types fans out IC chips on Suppliers / Workforce /
    // Timesheets / Invoices even when no Engagement Type beyond Shift
    // is enabled. The legacy `contractors` derivation (Assignment \u00d7
    // IC) still gates the contractor pool tab + variant body.
    const icOn  = window.getFeatureFlag && (
      window.getFeatureFlag("independentContractor") ||
      window.getFeatureFlag("contractors")
    );
    const eorOn = window.getFeatureFlag && window.getFeatureFlag("eor");
    const h = _hash(rid);
    if (icOn && primary === "Agency" && (h % 7 === 0)) out.push(ST_LABEL.IndependentContractor);
    if (eorOn && primary === "Agency" && (h % 11 === 0)) out.push(ST_LABEL.EOR);
    return out;
  }

  // -----------------------------------------------------------------
  // Filter options — gated by feature-flag reachability so a tenant
  // never sees a chip option that can't appear in their data.
  // -----------------------------------------------------------------
  function engagementModelOpts() {
    const out = [BM_LABEL.ClockInOut]; // always available
    const tsOn  = window.getFeatureFlag && window.getFeatureFlag("timesheets");
    const msOn  = window.getFeatureFlag && window.getFeatureFlag("milestones");
    const ffOn  = window.getFeatureFlag && window.getFeatureFlag("fixedFee");
    const sowOn = window.getFeatureFlag && window.getFeatureFlag("sow");
    if (tsOn) out.push(BM_LABEL.Timesheet);
    if (msOn || sowOn) out.push(BM_LABEL.Milestone);
    if (ffOn) out.push(BM_LABEL.FixedFee);
    return out;
  }

  // v0.78 \u2014 Billing Basis options resolve from the engagement-type
  // flags: each engagement type opens up specific billing bases.
  //   \u00b7 Shift  (always-on)  \u2192 Hourly
  //   \u00b7 engAssignment       \u2192 Weekly, Monthly, Fixed
  //   \u00b7 engProject          \u2192 Fixed, Milestone
  //   \u00b7 engStatementOfWork  \u2192 Milestone
  function billingBasisOpts() {
    const out = [BB_LABEL.Hourly]; // Shift baseline, always available
    const asOn  = window.getFeatureFlag && window.getFeatureFlag("engAssignment");
    const prOn  = window.getFeatureFlag && window.getFeatureFlag("engProject");
    const sowOn = window.getFeatureFlag && window.getFeatureFlag("engStatementOfWork");
    if (asOn) { out.push(BB_LABEL.Weekly); out.push(BB_LABEL.Monthly); }
    if (asOn || prOn) out.push(BB_LABEL.Fixed);
    if (prOn || sowOn) out.push(BB_LABEL.Milestone);
    return out;
  }

  // v0.78 \u2014 Time Capture options. Clock-in/out is the Shift baseline;
  // Time Tracking + N/A appear when any non-Shift engagement type is on.
  function timeCaptureOpts() {
    const out = [TC_LABEL["Clock-in/out"]];
    const anyNonShift =
      (window.getFeatureFlag && window.getFeatureFlag("engAssignment"))      ||
      (window.getFeatureFlag && window.getFeatureFlag("engProject"))         ||
      (window.getFeatureFlag && window.getFeatureFlag("engStatementOfWork"));
    if (anyNonShift) {
      out.push(TC_LABEL["Time Tracking"]);
      out.push(TC_LABEL["N/A"]);
    }
    return out;
  }

  function supplierTypeOpts() {
    const out = [ST_LABEL.Agency]; // always available
    const icOn  = window.getFeatureFlag && window.getFeatureFlag("contractors");
    const icAx  = window.getFeatureFlag && window.getFeatureFlag("independentContractor");
    const eorOn = window.getFeatureFlag && window.getFeatureFlag("eor");
    const flOn  = window.getFeatureFlag && window.getFeatureFlag("float");
    if (icOn || icAx) out.push(ST_LABEL.IndependentContractor);
    if (eorOn) out.push(ST_LABEL.EOR);
    if (flOn)  out.push(ST_LABEL.Float);
    return out;
  }

  // -----------------------------------------------------------------
  // Predicates for applyFilters — operate on the *labelled* values so
  // they line up with the popover options the user picks.
  // -----------------------------------------------------------------
  function matchEngagementModel(row, vals) {
    if (!vals || vals.length === 0) return true;
    return vals.includes(engagementModelOf(row, row && row.id));
  }
  function matchBillingBasis(row, vals) {
    if (!vals || vals.length === 0) return true;
    return vals.includes(billingBasisOf(row, row && row.id));
  }
  function matchTimeCapture(row, vals) {
    if (!vals || vals.length === 0) return true;
    return vals.includes(timeCaptureOf(row, row && row.id));
  }
  function matchSupplierTypes(row, vals) {
    if (!vals || vals.length === 0) return true;
    const types = supplierTypesOf(row, row && row.id);
    return types.some((t) => vals.includes(t));
  }

  // -----------------------------------------------------------------
  // React hook — toggles `document.body.classList.v77-cols-on` so CSS
  // can extend the per-table grid-template-columns without each page
  // re-implementing the gate. Re-evaluates on every render so flag
  // flips in Settings take effect immediately.
  // -----------------------------------------------------------------
  function useBodyClass() {
    const on = isOn();
    if (typeof React !== "undefined" && React.useEffect) {
      React.useEffect(() => {
        const cls = "v77-cols-on";
        if (on) document.body.classList.add(cls);
        else document.body.classList.remove(cls);
        return () => document.body.classList.remove(cls);
      }, [on]);
    } else if (typeof document !== "undefined") {
      // Defensive fallback for non-react callers.
      if (on) document.body.classList.add("v77-cols-on");
      else document.body.classList.remove("v77-cols-on");
    }
    return on;
  }

  Object.assign(window, {
    V77Cols: {
      isOn,
      engagementModelOf,
      supplierTypesOf,
      engagementModelOpts,
      supplierTypeOpts,
      matchEngagementModel,
      matchSupplierTypes,
      // v0.78 \u2014 Billing Basis \u00d7 Time Capture
      billingBasisOf,
      billingBasisOpts,
      matchBillingBasis,
      timeCaptureOf,
      timeCaptureOpts,
      matchTimeCapture,
      useBodyClass,
      BM_LABEL,
      ST_LABEL,
      BB_LABEL,
      TC_LABEL,
    },
  });
})();
