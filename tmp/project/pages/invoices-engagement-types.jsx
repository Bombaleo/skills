// =====================================================================
// Flex Work — Invoices · engagement-type variants
//
// When the org enables Assignment / Project / Statement of Work in
// Settings → Configuration, the Invoices list merges in sample invoices
// billed against those engagement types, and the paper-doc detail view
// swaps in a line-items table whose columns match how the work was
// billed:
//
//   · Shift              → Location · Date · Worker · Job · Hours · Amount
//                          (unchanged — lives in invoices.jsx)
//   · Assignment Hourly  → Worker · Role · Period · Hours · Rate · Amount
//   · Assignment Weekly  → Worker · Role · Week ending · Weeks · Rate · Amount
//   · Assignment Monthly → Worker · Role · Month · Months · Rate · Amount
//   · Assignment Fixed   → Worker · Role · Period · Description · Amount
//   · Project Fixed-fee  → Project · Phase · Description · % invoiced · Amount
//   · Project Milestone  → Project · Milestone # · Description · Acceptance · Amount
//   · Project T&M        → Project · Worker · Role · Hours · Rate · Amount
//   · SOW                → Milestone # · Deliverable · Acceptance · Amount · Retainage · Net
//
// The detail page in invoices.jsx loops these in via:
//   · findInvoiceByIdAcrossTypes(id)       — lookup across all sources
//   · buildEngagementInvoiceModel(inv)     — model dispatcher (returns
//        the same { lines, subtotal, taxes, fees, amountDue, totalHours }
//        shape used by buildInvoiceModel today — Supplier Funding +
//        Sales Tax + Reverse Charge math all keep working unchanged).
//   · <EngagementInvoiceLineItems inv model/> — paper-doc table dispatcher
//
// Public API on window:
//   ASSIGNMENT_INVOICES_RAW, PROJECT_INVOICES_RAW
//   getAssignmentInvoiceRows, getProjectInvoiceRows
//   findInvoiceByIdAcrossTypes
//   buildEngagementInvoiceModel
//   EngagementInvoiceLineItems
// =====================================================================

(function () {
  // -----------------------------------------------------------------
  // Sample data — Assignment invoices (5, one per billing basis, plus
  //   a second Hourly to make the distribution feel real).
  // Period dates are ISO; the row adapter formats to MM.DD.YYYY.
  // Amounts are the canonical numeric — adapter formats with currency.
  // -----------------------------------------------------------------
  const ASSIGNMENT_INVOICES_RAW = [
    {
      id: "ASGN0001",
      reqRef: "Req PRO-J3K4L5M6",
      supplier: "ap",
      contact: "Priya Hayes",
      status: "Issued",
      invDate: "2026-05-18",
      dueDate: "2026-06-17",
      billingBasis: "Hourly",
      // Display goes into the list-row Location chip column
      periodLabel: "May 4 – May 17, 2026",
      assignment: {
        title: "Senior Java Developer · payroll modernization",
        code: "ASGN-2026-1144",
        poRef: "PO-2026-3144",
        periodStart: "2026-05-04",
        periodEnd:   "2026-05-17",
        timesheetRef: "TS-58210",
        lines: [
          { worker: "Priya Ramesh", role: "Sr. Java Developer", subPeriod: "Wk 19 (May 4 – 10)",  units: 40,    rate: 165, amount: 6600 },
          { worker: "Priya Ramesh", role: "Sr. Java Developer", subPeriod: "Wk 20 (May 11 – 17)", units: 38.5,  rate: 165, amount: 6352.5 },
          { worker: "Marcus Webb",  role: "Sr. Backend Engineer", subPeriod: "Wk 19 (May 4 – 10)",  units: 40,    rate: 155, amount: 6200 },
          { worker: "Marcus Webb",  role: "Sr. Backend Engineer", subPeriod: "Wk 20 (May 11 – 17)", units: 42,    rate: 155, amount: 6510 },
        ],
      },
    },
    {
      id: "ASGN0002",
      reqRef: "Req PRO-N7O8P9Q0",
      supplier: "sw",
      contact: "Jessica Adams",
      status: "Generated",
      invDate: "2026-05-04",
      dueDate: "2026-06-03",
      billingBasis: "Weekly",
      periodLabel: "Apr 6 – May 3, 2026",
      assignment: {
        title: "On-site supervisor · Distribution Center Alpha",
        code: "ASGN-2026-0982",
        poRef: "PO-2026-2880",
        periodStart: "2026-04-06",
        periodEnd:   "2026-05-03",
        timesheetRef: "TS-58104",
        lines: [
          { worker: "Jamal Carter",   role: "Site supervisor", subPeriod: "Wk ending Apr 12", units: 1, unitLabel: "wk", rate: 3850, amount: 3850 },
          { worker: "Jamal Carter",   role: "Site supervisor", subPeriod: "Wk ending Apr 19", units: 1, unitLabel: "wk", rate: 3850, amount: 3850 },
          { worker: "Jamal Carter",   role: "Site supervisor", subPeriod: "Wk ending Apr 26", units: 1, unitLabel: "wk", rate: 3850, amount: 3850 },
          { worker: "Jamal Carter",   role: "Site supervisor", subPeriod: "Wk ending May 3",  units: 1, unitLabel: "wk", rate: 3850, amount: 3850 },
        ],
      },
    },
    {
      id: "ASGN0003",
      reqRef: "Req PRO-R1S2T3U4",
      supplier: "ph",
      contact: "Priya Hayes",
      status: "Issued",
      invDate: "2026-05-01",
      dueDate: "2026-05-31",
      billingBasis: "Monthly",
      periodLabel: "April 2026",
      assignment: {
        title: "Interim Director of Program Management",
        code: "ASGN-2026-0744",
        poRef: "PO-2026-2710",
        periodStart: "2026-04-01",
        periodEnd:   "2026-04-30",
        timesheetRef: "TS-58088",
        lines: [
          { worker: "Sami Soto",  role: "Interim Director · PMO", subPeriod: "April 2026 retainer", units: 1, unitLabel: "mo", rate: 22000, amount: 22000 },
        ],
      },
    },
    {
      id: "ASGN0004",
      reqRef: "Req PRO-V5W6X7Y8",
      supplier: "ph",
      contact: "Priya Hayes",
      status: "Paid",
      invDate: "2026-04-01",
      dueDate: "2026-05-01",
      billingBasis: "Fixed",
      periodLabel: "Q2 2026 retainer",
      assignment: {
        title: "Senior recruiter · Q2 retainer",
        code: "ASGN-2026-0612",
        poRef: "PO-2026-2491",
        periodStart: "2026-04-01",
        periodEnd:   "2026-06-30",
        lines: [
          { worker: "Sami Soto",  role: "Senior recruiter (retainer)", subPeriod: "Q2 2026 · April – June", units: 1, unitLabel: "fee", rate: 12000, amount: 12000 },
        ],
      },
    },
    {
      id: "ASGN0005",
      reqRef: "Req PRO-Z9A1B2C3",
      supplier: "ss",
      contact: "Sami Soto",
      status: "Overdue",
      invDate: "2026-03-31",
      dueDate: "2026-04-30",
      billingBasis: "Hourly",
      periodLabel: "Mar 2 – Mar 29, 2026",
      assignment: {
        title: "UX research sprint · scheduling console",
        code: "ASGN-2026-0488",
        poRef: "PO-2026-2240",
        periodStart: "2026-03-02",
        periodEnd:   "2026-03-29",
        timesheetRef: "TS-57902",
        lines: [
          { worker: "Kierra Stanton", role: "UX Researcher",  subPeriod: "Wk 10 (Mar 2 – 8)",   units: 32,   rate: 145, amount: 4640 },
          { worker: "Kierra Stanton", role: "UX Researcher",  subPeriod: "Wk 11 (Mar 9 – 15)",  units: 38,   rate: 145, amount: 5510 },
          { worker: "Kierra Stanton", role: "UX Researcher",  subPeriod: "Wk 12 (Mar 16 – 22)", units: 40,   rate: 145, amount: 5800 },
          { worker: "Kierra Stanton", role: "UX Researcher",  subPeriod: "Wk 13 (Mar 23 – 29)", units: 36.5, rate: 145, amount: 5292.5 },
        ],
      },
    },
  ];

  // -----------------------------------------------------------------
  // Sample data — Project invoices (5).
  // -----------------------------------------------------------------
  const PROJECT_INVOICES_RAW = [
    {
      id: "PROJ0001",
      reqRef: "Req PRJ-A1B2C3D4",
      supplier: "wf",
      contact: "Sami Soto",
      status: "Issued",
      invDate: "2026-05-12",
      dueDate: "2026-06-11",
      billingBasis: "Milestone",
      periodLabel: "Milestone 2 of 4",
      project: {
        name: "DC Alpha · WMS rollout",
        code: "PRJ-2026-018",
        poRef: "PO-2026-3018",
        budget: 412000,
        invoicedToDate: 165200,
        lines: [
          { ref: "M2", description: "Racking & dock equipment commissioning", acceptance: "2026-05-08", amount: 96100 },
          { ref: "M2 · CO-01", description: "Change order · added two dock doors (approved 2026-05-02)", acceptance: "2026-05-08", amount: 22600 },
        ],
      },
    },
    {
      id: "PROJ0002",
      reqRef: "Req PRJ-E5F6G7H8",
      supplier: "ap",
      contact: "Marcus Aragón",
      status: "Issued",
      invDate: "2026-05-15",
      dueDate: "2026-06-14",
      billingBasis: "Milestone",
      periodLabel: "Milestone 3 of 6",
      project: {
        name: "Payroll modernization · Phase 1",
        code: "PRJ-2026-022",
        poRef: "PO-2026-3088",
        budget: 1124000,
        invoicedToDate: 478500,
        lines: [
          { ref: "M3", description: "Position & job catalog cutover (110 entities)", acceptance: "2026-05-14", amount: 167400 },
        ],
      },
    },
    {
      id: "PROJ0003",
      reqRef: "Req PRJ-I9J0K1L2",
      supplier: "ap",
      contact: "Marcus Aragón",
      status: "Generated",
      invDate: "2026-05-10",
      dueDate: "2026-06-09",
      billingBasis: "Fixed",
      periodLabel: "Phase 1 of 3 · 50% draw",
      project: {
        name: "Cloud transition · platform foundation",
        code: "PRJ-2026-029",
        poRef: "PO-2026-3144",
        budget: 280000,
        invoicedToDate: 140000,
        lines: [
          { ref: "Phase 1", description: "Foundation · networking, IAM, observability", pctComplete: 100, pctInvoiced: 50, amount: 70000 },
          { ref: "Phase 1 · review", description: "Architecture review & sign-off",              pctComplete: 100, pctInvoiced: 50, amount: 10000 },
        ],
      },
    },
    {
      id: "PROJ0004",
      reqRef: "Req PRJ-M3N4O5P6",
      supplier: "gs",
      contact: "Gemma Stack",
      status: "Paid",
      invDate: "2026-04-04",
      dueDate: "2026-05-04",
      billingBasis: "Fixed",
      periodLabel: "Phase 2 of 2 · final draw",
      project: {
        name: "Frontline rollout · DC Beta",
        code: "PRJ-2026-007",
        poRef: "PO-2026-2630",
        budget: 184000,
        invoicedToDate: 184000,
        lines: [
          { ref: "Phase 2", description: "Site go-live · 220 frontline workers onboarded", pctComplete: 100, pctInvoiced: 100, amount: 92000 },
        ],
      },
    },
    {
      id: "PROJ0005",
      reqRef: "Req PRJ-Q7R8S9T0",
      supplier: "ap",
      contact: "Marcus Aragón",
      status: "Issued",
      invDate: "2026-05-09",
      dueDate: "2026-06-08",
      billingBasis: "Fixed", // T&M is captured by per-line hours+rate, surfaces as "T&M draw"
      tmDraw: true,
      periodLabel: "Burn · Apr 27 – May 8 (Wk 18–19)",
      project: {
        name: "Data engineering · reporting pipeline",
        code: "PRJ-2026-031",
        poRef: "PO-2026-3201",
        budget: 480000,
        invoicedToDate: 156800,
        lines: [
          { worker: "Priya Ramesh",  role: "Data engineer · senior", subPeriod: "Wk 18 (Apr 27 – May 3)", units: 38,   rate: 175, amount: 6650 },
          { worker: "Priya Ramesh",  role: "Data engineer · senior", subPeriod: "Wk 19 (May 4 – 10)",     units: 40,   rate: 175, amount: 7000 },
          { worker: "Marcus Webb",   role: "Platform engineer",      subPeriod: "Wk 18 (Apr 27 – May 3)", units: 32,   rate: 165, amount: 5280 },
          { worker: "Marcus Webb",   role: "Platform engineer",      subPeriod: "Wk 19 (May 4 – 10)",     units: 40,   rate: 165, amount: 6600 },
          { worker: "Sami Soto",     role: "Tech lead",              subPeriod: "Wk 18 – 19 oversight",   units: 12,   rate: 195, amount: 2340 },
        ],
      },
    },
  ];

  // -----------------------------------------------------------------
  // Money + date helpers — local copies so this module doesn't depend
  // on the parent invoices.jsx scope, matches the conventions used
  // there (curSymbol from window if present, MM.DD.YYYY format).
  // -----------------------------------------------------------------
  function _sym() {
    return (window.curSymbol && window.curSymbol()) || "$";
  }
  function _fmtMoney(n) {
    return _sym() + Number(n).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  }
  function _isoToMMDDYYYY(iso) {
    if (!iso) return "";
    // Parse ISO YYYY-MM-DD as a local-date to avoid the UTC-midnight
    // → previous-day shift in US timezones. Falls back to Date(iso)
    // for non-ISO inputs.
    let d;
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso));
    if (m) d = new Date(parseInt(m[1], 10), parseInt(m[2], 10) - 1, parseInt(m[3], 10));
    else   d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${mm}.${dd}.${d.getFullYear()}`;
  }
  function _hoursFromDecimal(n) {
    // Render decimal hours as H:MM (e.g. 38.5 → "38:30")
    const whole = Math.floor(n);
    const mins  = Math.round((n - whole) * 60);
    return `${whole}:${String(mins).padStart(2, "0")}`;
  }
  function _sumLineAmounts(lines) {
    return Math.round(lines.reduce((a, l) => a + Number(l.amount || 0), 0) * 100) / 100;
  }

  // -----------------------------------------------------------------
  // List-row adapters — project raw shape into the standard Invoice
  // list row { id, req, supplier, contact, status, locations, amount,
  // invDate, dueDate, engagementType, billingBasis, more, … }.
  // The detail page reads `engagementType` and `billingBasis` off the
  // row to pick the renderer; raw fields tag along under their own
  // namespace (`assignment` / `project`) for the renderer to consume.
  // -----------------------------------------------------------------
  function _projectListLocations(raw, locKey) {
    // The list cell shows period chips. For Assignment we render the
    // assignment code; for Project we render the project code. A "+N
    // more" chip never applies — these invoices have a single context.
    return [raw.periodLabel];
  }

  function _statusForRow(raw) {
    return raw.status;
  }

  // Canonical Engagement Type matrix (ENG_TYPE_OPTIONS):
  //   Assignment → Hourly / Weekly / Monthly / Fixed
  //                × Clock-in/out / Time Tracking / N/A
  //   Project    → Fixed / Milestone
  //                × Time Tracking / N/A
  //
  // Each adapter sets `billingBasis`, `timeCapture`, and
  // `supplierTypes` explicitly so the list columns render off the
  // invoice itself (the source of truth), not an inferred axis tuple.
  function _assignmentTimeCaptureFor(basis) {
    // Hourly + Weekly + Monthly assignments all track time on a
    // timesheet; Fixed-fee assignments don't track time.
    if (basis === "Fixed") return "N/A";
    return "Time Tracking";
  }

  function _projectTimeCaptureFor(raw) {
    // T&M draws track time (per-line hours × rate). Pure fixed-fee /
    // milestone draws are deliverable-based, no time capture.
    if (raw && raw.tmDraw) return "Time Tracking";
    return "N/A";
  }

  function getAssignmentInvoiceRows() {
    return ASSIGNMENT_INVOICES_RAW.map((raw) => {
      const subtotal = _sumLineAmounts(raw.assignment.lines);
      // Match the canonical demo math: subtotal ≈ 83% of total. We back
      // into a total that, when sliced 83/9/8, gives subtotal back.
      const total = Math.round((subtotal / 0.83) * 100) / 100;
      return {
        id: raw.id,
        req: raw.reqRef,
        supplier: raw.supplier,
        contact: raw.contact,
        status: _statusForRow(raw),
        locations: _projectListLocations(raw),
        amount: _fmtMoney(total),
        invDate: _isoToMMDDYYYY(raw.invDate),
        dueDate: _isoToMMDDYYYY(raw.dueDate),
        engagementType: "Assignment",
        billingBasis: raw.billingBasis,
        timeCapture: _assignmentTimeCaptureFor(raw.billingBasis),
        supplierTypes: ["Agency"],
        // Raw payload — read only by the detail view.
        _raw: raw,
        _engKind: "assignment",
      };
    });
  }

  function getProjectInvoiceRows() {
    return PROJECT_INVOICES_RAW.map((raw) => {
      const subtotal = _sumLineAmounts(raw.project.lines);
      const total = Math.round((subtotal / 0.83) * 100) / 100;
      return {
        id: raw.id,
        req: raw.reqRef,
        supplier: raw.supplier,
        contact: raw.contact,
        status: _statusForRow(raw),
        locations: _projectListLocations(raw),
        amount: _fmtMoney(total),
        invDate: _isoToMMDDYYYY(raw.invDate),
        dueDate: _isoToMMDDYYYY(raw.dueDate),
        engagementType: "Project",
        billingBasis: raw.billingBasis,
        timeCapture: _projectTimeCaptureFor(raw),
        supplierTypes: ["Agency"],
        _raw: raw,
        _engKind: "project",
      };
    });
  }

  // -----------------------------------------------------------------
  // SOW · the raw data lives in sow.jsx. getSowInvoiceRows already
  // adapts it for the list, but it doesn't carry the full milestone /
  // deliverable breakdown the detail-doc table needs. We re-resolve
  // that here so the detail view has rich data to render.
  // -----------------------------------------------------------------
  function _findSowMilestone(sowId, milestoneRef) {
    const ms = (window.SOW_MILESTONES || {})[sowId] || [];
    return ms.find((m) => m.id === milestoneRef) || null;
  }
  function _findSowDeliverables(sowId, milestoneRef) {
    const ds = (window.SOW_DELIVERABLES || {})[sowId] || [];
    return ds.filter((d) => d.milestoneId === milestoneRef);
  }

  // -----------------------------------------------------------------
  // Lookup — finds an invoice across all sources by id. Used by the
  // detail page so a click on a merged-in row resolves correctly.
  // Returns the standard list-row shape (with `_raw` + `_engKind` on
  // non-shift types so the renderer can find the full payload).
  // -----------------------------------------------------------------
  function findInvoiceByIdAcrossTypes(id) {
    // 1. Standard shift invoices
    if (window.INVOICES) {
      const hit = window.INVOICES.find((r) => r.id === id);
      if (hit) return { ...hit, _engKind: "shift" };
    }
    // 2. SOW (uses sow.jsx adapter, marks engagementType="SOW")
    if (window.getSowInvoiceRows) {
      const rows = window.getSowInvoiceRows();
      const hit = rows.find((r) => r.id === id);
      if (hit) return { ...hit, _engKind: "sow" };
    }
    // 3. Assignment
    const asgn = getAssignmentInvoiceRows().find((r) => r.id === id);
    if (asgn) return asgn;
    // 4. Project
    const prj  = getProjectInvoiceRows().find((r) => r.id === id);
    if (prj)  return prj;
    // 5. Contractor (if module is loaded)
    if (window.getContractorInvoiceRows) {
      const hit = window.getContractorInvoiceRows().find((r) => r.id === id);
      if (hit) return { ...hit, _engKind: "contractor" };
    }
    return null;
  }

  // -----------------------------------------------------------------
  // Model dispatcher — returns the shape the existing detail page
  // already understands ({ lines, subtotal, taxes, fees, amountDue,
  // totalHours }). Supplier-funding + sales-tax math live in the
  // detail page and work off `inv.amount` + `model.subtotal/fees` —
  // unchanged.
  //
  // For shift invoices, the existing buildInvoiceModel handles it
  // (left untouched). For other types we synthesize lines from `_raw`.
  // -----------------------------------------------------------------
  function buildEngagementInvoiceModel(inv) {
    const total = parseFloat(String(inv.amount).replace(/[^0-9.\-]/g, "")) || 0;
    // Canonical split — keeps Supplier Funding / Sales Tax cross-foot
    // math byte-identical to the Shift model.
    const subtotal = Math.round(total * 0.83 * 100) / 100;
    const taxes    = Math.round(total * 0.09 * 100) / 100;
    const fees     = Math.round((total - subtotal - taxes) * 100) / 100;
    let totalHours = "";

    if (inv._engKind === "assignment" && inv._raw) {
      // Decimal-hours roll-up when billing is hourly; "—" otherwise.
      if (inv.billingBasis === "Hourly") {
        const hrs = inv._raw.assignment.lines.reduce((a, l) => a + Number(l.units || 0), 0);
        totalHours = _hoursFromDecimal(hrs);
      }
    } else if (inv._engKind === "project" && inv._raw && inv._raw.tmDraw) {
      const hrs = inv._raw.project.lines.reduce((a, l) => a + Number(l.units || 0), 0);
      totalHours = _hoursFromDecimal(hrs);
    }

    return {
      lines: [], // legacy field — not used by the new renderers
      totalHours,
      subtotal: _fmtMoney(subtotal),
      taxes:    _fmtMoney(taxes),
      fees:     _fmtMoney(fees),
      amountDue: _fmtMoney(total),
    };
  }

  // =================================================================
  // Renderers — paper-doc line items per engagement-type variant.
  // Each variant defines its own column track + header + body rows.
  // The wrapping `inv-doc-table-v` class adopts a wider gutter and a
  // small caption row above the columns to anchor the work to a
  // PO / project / assignment / SOW reference.
  // =================================================================

  // ---------- shared ----------
  function _Caption({ left, right }) {
    return React.createElement(
      "div",
      { className: "inv-doc-caption" },
      React.createElement("div", { className: "inv-doc-caption-l" }, left),
      right ? React.createElement("div", { className: "inv-doc-caption-r" }, right) : null
    );
  }

  // ---------- Assignment ----------
  function AssignmentLines({ inv }) {
    const raw = inv._raw;
    const a = raw.assignment;
    const lines = a.lines;
    const total = _sumLineAmounts(lines);
    const isHourly = inv.billingBasis === "Hourly";
    const isFixed  = inv.billingBasis === "Fixed";

    // Column heads vary slightly by basis to stay literal:
    //   Hourly  → Hours · Rate
    //   Weekly  → Weeks · Weekly rate
    //   Monthly → Months · Monthly rate
    //   Fixed   → (no Units / Rate — single fixed fee row)
    const unitHead =
      isHourly ? "Hours" :
      inv.billingBasis === "Weekly"  ? "Weeks" :
      inv.billingBasis === "Monthly" ? "Months" :
      "Qty";
    const rateHead =
      isHourly ? "Rate" :
      inv.billingBasis === "Weekly"  ? "Weekly rate" :
      inv.billingBasis === "Monthly" ? "Monthly rate" :
      "Fee";

    return React.createElement(
      "section",
      { className: "inv-doc-table inv-doc-table--asgn", "aria-label": "Line items" },
      React.createElement(_Caption, {
        left: React.createElement(React.Fragment, null,
          React.createElement("span", { className: "inv-doc-caption-eyebrow" }, "Assignment"),
          React.createElement("span", { className: "inv-doc-caption-title" }, a.title),
          React.createElement("span", { className: "inv-doc-caption-meta tabular" },
            a.code, " · ", a.poRef
          )
        ),
        right: a.timesheetRef && !isFixed
          ? React.createElement("span", { className: "inv-doc-caption-side tabular" }, "Timesheet ", a.timesheetRef)
          : null,
      }),

      // Header row
      isFixed
        ? React.createElement("div", { className: "inv-doc-row inv-doc-row--head inv-doc-row--asgn-fixed" },
            React.createElement("span", null, "Worker"),
            React.createElement("span", null, "Role"),
            React.createElement("span", null, "Period"),
            React.createElement("span", null, "Description"),
            React.createElement("span", { className: "inv-doc-num" }, "Amount")
          )
        : React.createElement("div", { className: "inv-doc-row inv-doc-row--head inv-doc-row--asgn" },
            React.createElement("span", null, "Worker"),
            React.createElement("span", null, "Role"),
            React.createElement("span", null, isHourly ? "Period" : "Period"),
            React.createElement("span", { className: "inv-doc-num" }, unitHead),
            React.createElement("span", { className: "inv-doc-num" }, rateHead),
            React.createElement("span", { className: "inv-doc-num" }, "Amount")
          ),
      React.createElement("div", { className: "inv-doc-rule" }),

      // Body
      React.createElement("div", { className: "inv-doc-rows" },
        lines.map((l, i) =>
          isFixed
            ? React.createElement("div", { className: "inv-doc-row inv-doc-row--asgn-fixed", key: i },
                React.createElement("span", null, l.worker),
                React.createElement("span", null, l.role),
                React.createElement("span", { className: "tabular" }, l.subPeriod),
                React.createElement("span", null, "Retainer / fixed fee"),
                React.createElement("span", { className: "inv-doc-num tabular" }, _fmtMoney(l.amount))
              )
            : React.createElement("div", { className: "inv-doc-row inv-doc-row--asgn", key: i },
                React.createElement("span", null, l.worker),
                React.createElement("span", null, l.role),
                React.createElement("span", { className: "tabular" }, l.subPeriod),
                React.createElement("span", { className: "inv-doc-num tabular" },
                  isHourly ? _hoursFromDecimal(l.units) : `${l.units} ${l.unitLabel || ""}`.trim()
                ),
                React.createElement("span", { className: "inv-doc-num tabular" }, _fmtMoney(l.rate)),
                React.createElement("span", { className: "inv-doc-num tabular" }, _fmtMoney(l.amount))
              )
        )
      ),
      React.createElement("div", { className: "inv-doc-rule" }),

      // Subtotal row
      React.createElement("div", { className: "inv-doc-row inv-doc-row--asgn inv-doc-totalrow inv-doc-subtotal" },
        React.createElement("span", null),
        React.createElement("span", null),
        React.createElement("span", null),
        React.createElement("span", { className: "inv-doc-num" }, isFixed ? null : "Subtotal"),
        isFixed
          ? React.createElement("span", { className: "inv-doc-num" }, "Subtotal")
          : React.createElement("span", { className: "inv-doc-num" }),
        React.createElement("span", { className: "inv-doc-num tabular" }, _fmtMoney(total))
      )
    );
  }

  // ---------- Project ----------
  function ProjectLines({ inv }) {
    const raw = inv._raw;
    const p = raw.project;
    const lines = p.lines;
    const total = _sumLineAmounts(lines);
    const basis = inv.billingBasis;
    const isTM       = !!raw.tmDraw;
    const isMilestone = basis === "Milestone" && !isTM;
    const isFixed    = basis === "Fixed" && !isTM;

    return React.createElement(
      "section",
      { className: "inv-doc-table inv-doc-table--prj", "aria-label": "Line items" },
      React.createElement(_Caption, {
        left: React.createElement(React.Fragment, null,
          React.createElement("span", { className: "inv-doc-caption-eyebrow" },
            isTM        ? "Project · T&M draw" :
            isMilestone ? "Project · Milestone" :
                          "Project · Fixed-fee"
          ),
          React.createElement("span", { className: "inv-doc-caption-title" }, p.name),
          React.createElement("span", { className: "inv-doc-caption-meta tabular" },
            p.code, " · ", p.poRef
          )
        ),
        right: React.createElement(
          "span",
          { className: "inv-doc-caption-side" },
          "Budget ",
          React.createElement("strong", { className: "tabular" }, _fmtMoney(p.budget)),
          " · invoiced to date ",
          React.createElement("strong", { className: "tabular" }, _fmtMoney(p.invoicedToDate))
        ),
      }),

      // Header
      isMilestone
        ? React.createElement("div", { className: "inv-doc-row inv-doc-row--head inv-doc-row--prj-ms" },
            React.createElement("span", null, "Milestone"),
            React.createElement("span", null, "Description"),
            React.createElement("span", null, "Accepted"),
            React.createElement("span", { className: "inv-doc-num" }, "Amount")
          )
        : isTM
        ? React.createElement("div", { className: "inv-doc-row inv-doc-row--head inv-doc-row--prj-tm" },
            React.createElement("span", null, "Worker"),
            React.createElement("span", null, "Role"),
            React.createElement("span", null, "Period"),
            React.createElement("span", { className: "inv-doc-num" }, "Hours"),
            React.createElement("span", { className: "inv-doc-num" }, "Rate"),
            React.createElement("span", { className: "inv-doc-num" }, "Amount")
          )
        : React.createElement("div", { className: "inv-doc-row inv-doc-row--head inv-doc-row--prj-fixed" },
            React.createElement("span", null, "Phase"),
            React.createElement("span", null, "Description"),
            React.createElement("span", { className: "inv-doc-num" }, "% complete"),
            React.createElement("span", { className: "inv-doc-num" }, "% invoiced"),
            React.createElement("span", { className: "inv-doc-num" }, "Amount")
          ),
      React.createElement("div", { className: "inv-doc-rule" }),

      // Body
      React.createElement("div", { className: "inv-doc-rows" },
        lines.map((l, i) =>
          isMilestone
            ? React.createElement("div", { className: "inv-doc-row inv-doc-row--prj-ms", key: i },
                React.createElement("span", { className: "tabular" }, l.ref),
                React.createElement("span", null, l.description),
                React.createElement("span", { className: "tabular" }, _isoToMMDDYYYY(l.acceptance)),
                React.createElement("span", { className: "inv-doc-num tabular" }, _fmtMoney(l.amount))
              )
            : isTM
            ? React.createElement("div", { className: "inv-doc-row inv-doc-row--prj-tm", key: i },
                React.createElement("span", null, l.worker),
                React.createElement("span", null, l.role),
                React.createElement("span", { className: "tabular" }, l.subPeriod),
                React.createElement("span", { className: "inv-doc-num tabular" }, _hoursFromDecimal(l.units)),
                React.createElement("span", { className: "inv-doc-num tabular" }, _fmtMoney(l.rate)),
                React.createElement("span", { className: "inv-doc-num tabular" }, _fmtMoney(l.amount))
              )
            : React.createElement("div", { className: "inv-doc-row inv-doc-row--prj-fixed", key: i },
                React.createElement("span", { className: "tabular" }, l.ref),
                React.createElement("span", null, l.description),
                React.createElement("span", { className: "inv-doc-num tabular" }, `${l.pctComplete}%`),
                React.createElement("span", { className: "inv-doc-num tabular" }, `${l.pctInvoiced}%`),
                React.createElement("span", { className: "inv-doc-num tabular" }, _fmtMoney(l.amount))
              )
        )
      ),
      React.createElement("div", { className: "inv-doc-rule" }),

      // Subtotal
      isMilestone
        ? React.createElement("div", { className: "inv-doc-row inv-doc-row--prj-ms inv-doc-totalrow inv-doc-subtotal" },
            React.createElement("span", null),
            React.createElement("span", null),
            React.createElement("span", { className: "inv-doc-num" }, "Subtotal"),
            React.createElement("span", { className: "inv-doc-num tabular" }, _fmtMoney(total))
          )
        : isTM
        ? React.createElement("div", { className: "inv-doc-row inv-doc-row--prj-tm inv-doc-totalrow inv-doc-subtotal" },
            React.createElement("span", null),
            React.createElement("span", null),
            React.createElement("span", null),
            React.createElement("span", { className: "inv-doc-num" }, "Subtotal"),
            React.createElement("span", { className: "inv-doc-num" }),
            React.createElement("span", { className: "inv-doc-num tabular" }, _fmtMoney(total))
          )
        : React.createElement("div", { className: "inv-doc-row inv-doc-row--prj-fixed inv-doc-totalrow inv-doc-subtotal" },
            React.createElement("span", null),
            React.createElement("span", null),
            React.createElement("span", { className: "inv-doc-num" }),
            React.createElement("span", { className: "inv-doc-num" }, "Subtotal"),
            React.createElement("span", { className: "inv-doc-num tabular" }, _fmtMoney(total))
          )
    );
  }

  // ---------- Statement of Work ----------
  // Resolves the SOW invoice row back to its raw record so we can pull
  // milestone name + deliverables + acceptance date. Renders full
  // 6-col table (Milestone · Deliverable · Acceptance · Amount ·
  // Retainage · Net).
  function SowLines({ inv }) {
    // The SOW row carries `sowRef` + `milestoneRef` (or sow.jsx left
    // them off if the raw record didn't). We refetch the raw record
    // by id for the full payload.
    const rawId = `SINV-${inv.id}`;
    const rawList = (window.SOW_INVOICES_RAW || []);
    const raw = rawList.find((r) => r.id === rawId) || null;
    const sowRef       = inv.sowRef       || (raw && raw.sowRef);
    const milestoneRef = inv.milestoneRef || (raw && raw.milestoneRef);
    const period       = (raw && raw.period) || (inv.locations && inv.locations[0]) || "";
    const note         = (raw && raw.note)   || inv.note || null;

    const milestone = sowRef && milestoneRef ? _findSowMilestone(sowRef, milestoneRef) : null;
    const deliverables = sowRef && milestoneRef ? _findSowDeliverables(sowRef, milestoneRef) : [];

    // Pull a retainage % out of the note text — supplier-funding /
    // canonical SOW math would have its own field; demo data carries
    // it inline as "10% retainage held (16 600)".
    let retainagePct = 0;
    if (note) {
      const m = /(\d{1,2})\s*%/.exec(note);
      if (m) retainagePct = parseInt(m[1], 10);
    }

    // Gross is the raw amount on the invoice; the row.amount we have
    // here is already formatted, so use raw if present.
    const gross = raw ? raw.amount : parseFloat(String(inv.amount).replace(/[^0-9.\-]/g, "")) || 0;
    const retainageAmt = Math.round(gross * (retainagePct / 100) * 100) / 100;
    const netAmt = Math.round((gross - retainageAmt) * 100) / 100;

    // Compose the body rows. We render one line for the milestone
    // (with retainage / net), plus a sub-list of accepted deliverables
    // beneath it so the AP reviewer can see what was actually shipped.
    const msName = milestone ? milestone.name :
      (period && period.indexOf("·") > -1 ? period.split("·").slice(1).join("·").trim() : period);
    const acceptance = milestone && milestone.acceptedOn ? milestone.acceptedOn : null;
    const msShort = milestoneRef ? milestoneRef.toUpperCase() : "—";

    return React.createElement(
      "section",
      { className: "inv-doc-table inv-doc-table--sow", "aria-label": "Line items" },
      React.createElement(_Caption, {
        left: React.createElement(React.Fragment, null,
          React.createElement("span", { className: "inv-doc-caption-eyebrow" }, "Statement of Work"),
          React.createElement("span", { className: "inv-doc-caption-title" },
            sowRef || "—",
            milestone ? React.createElement("span", { className: "inv-doc-caption-sub" }, " · ", milestone.name) : null
          ),
          React.createElement("span", { className: "inv-doc-caption-meta tabular" },
            (raw && raw.sowRef) || sowRef || "—",
            milestone ? " · " + milestone.id : ""
          )
        ),
        right: React.createElement("span", { className: "inv-doc-caption-side" },
          "Currency ", React.createElement("strong", null, (raw && raw.currency) || "USD")
        ),
      }),

      React.createElement("div", { className: "inv-doc-row inv-doc-row--head inv-doc-row--sow" },
        React.createElement("span", null, "Milestone"),
        React.createElement("span", null, "Deliverable"),
        React.createElement("span", null, "Accepted"),
        React.createElement("span", { className: "inv-doc-num" }, "Amount"),
        React.createElement("span", { className: "inv-doc-num" }, "Retainage"),
        React.createElement("span", { className: "inv-doc-num" }, "Net")
      ),
      React.createElement("div", { className: "inv-doc-rule" }),

      React.createElement("div", { className: "inv-doc-rows" },
        React.createElement("div", { className: "inv-doc-row inv-doc-row--sow" },
          React.createElement("span", { className: "tabular" }, msShort),
          React.createElement("span", null,
            React.createElement("div", { className: "inv-doc-sow-name" }, msName),
            deliverables.length > 0 && React.createElement(
              "ul",
              { className: "inv-doc-sow-delivs" },
              deliverables.map((d) =>
                React.createElement("li", { key: d.id, className: "inv-doc-sow-deliv" },
                  React.createElement("span", { className: "inv-doc-sow-deliv-name" }, d.name),
                  React.createElement("span", { className: `inv-doc-sow-deliv-status inv-doc-sow-deliv-status--${(d.status || "").replace(/\s+/g, "").toLowerCase()}` }, d.status)
                )
              )
            )
          ),
          React.createElement("span", { className: "tabular" }, acceptance ? _isoToMMDDYYYY(acceptance) : "Pending"),
          React.createElement("span", { className: "inv-doc-num tabular" }, _fmtMoney(gross)),
          React.createElement("span", { className: "inv-doc-num tabular" },
            retainagePct > 0 ? `− ${_fmtMoney(retainageAmt)} (${retainagePct}%)` : "—"
          ),
          React.createElement("span", { className: "inv-doc-num tabular" }, _fmtMoney(netAmt))
        )
      ),
      React.createElement("div", { className: "inv-doc-rule" }),

      React.createElement("div", { className: "inv-doc-row inv-doc-row--sow inv-doc-totalrow inv-doc-subtotal" },
        React.createElement("span", null),
        React.createElement("span", null),
        React.createElement("span", { className: "inv-doc-num" }, "Subtotal"),
        React.createElement("span", { className: "inv-doc-num tabular" }, _fmtMoney(gross)),
        React.createElement("span", { className: "inv-doc-num tabular" },
          retainagePct > 0 ? `− ${_fmtMoney(retainageAmt)}` : ""
        ),
        React.createElement("span", { className: "inv-doc-num tabular" }, _fmtMoney(netAmt))
      ),

      note && React.createElement("p", { className: "inv-doc-sow-note" },
        window.Icon ? React.createElement(window.Icon, { name: "Information", size: 12 }) : null,
        React.createElement("span", null, note)
      )
    );
  }

  // -----------------------------------------------------------------
  // Top-level dispatcher. Returns null for Shift — the caller falls
  // back to the original inline Shift table in invoices.jsx.
  // -----------------------------------------------------------------
  function EngagementInvoiceLineItems({ inv }) {
    if (!inv) return null;
    const kind = inv._engKind ||
      (inv.engagementType === "SOW"              ? "sow" :
       inv.engagementType === "Assignment"       ? "assignment" :
       inv.engagementType === "Project"          ? "project" :
       inv.engagementType === "Statement of Work"? "sow" :
                                                   "shift");
    if (kind === "assignment") return React.createElement(AssignmentLines, { inv });
    if (kind === "project")    return React.createElement(ProjectLines,    { inv });
    if (kind === "sow")        return React.createElement(SowLines,        { inv });
    return null; // shift handled by invoices.jsx native renderer
  }

  Object.assign(window, {
    ASSIGNMENT_INVOICES_RAW,
    PROJECT_INVOICES_RAW,
    getAssignmentInvoiceRows,
    getProjectInvoiceRows,
    findInvoiceByIdAcrossTypes,
    buildEngagementInvoiceModel,
    EngagementInvoiceLineItems,
  });

  // Currency-data registration so the live country picker rewrites
  // money fields when the active org switches country.
  if (window.registerCurrencyData) {
    // Roll up an array of {amount} stubs so currency rewriter sees
    // every formatted money string.
    window.registerCurrencyData(getAssignmentInvoiceRows());
    window.registerCurrencyData(getProjectInvoiceRows());
  }
})();
