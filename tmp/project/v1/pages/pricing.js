// =====================================================================
//  FLEX WORK V1 · pages/pricing  (IA version: V1)
//  ---------------------------------------------------------------------
//  Settings → Pricing: two tabs.
//    Rate Card    — rate-automation upload flow (original).
//    Statutory Rules — editable statutory rule values + effective dates,
//                      and upload-validation toggles (v0.XX).
//
//  Registers window.V1.pages.pricing = { render, wire, STATUTORY_RULES,
//  VALIDATIONS }. Loaded AFTER core.js + pages/rate-engine.js.
// =====================================================================
(function (V1) {
  "use strict";
  var ico = V1.ico, gbp = V1.gbp, esc = V1.escapeHtml, eng = V1.engine;

  // ------------------------------------------------------------------
  //  A. Initial statutory-rules data — consumed by app.js on boot.
  //     Values are the real legislative quantities for the given date.
  //     App.js deep-copies them into state so edits are isolated.
  // ------------------------------------------------------------------
  var STATUTORY_RULES = [
    {
      id: "sr-nlw",
      name: "National Living Wage",
      jurisdiction: "United Kingdom",
      type: "MinWage",
      bands: [
        { label: "Age 21+",       value: 12.82, unit: "\u00a3/hr" },
        { label: "Age 18\u201320", value: 10.25, unit: "\u00a3/hr" },
        { label: "Under 18",      value:  7.60,  unit: "\u00a3/hr" },
        { label: "Apprentice",    value:  7.60,  unit: "\u00a3/hr" },
      ],
      effectiveFrom: "2026-04-01",
      expiresOn: "",
      reference: "National Minimum Wage Regulations 2015",
      note: "Age 21+ rate is the National Living Wage. Below-21 rates are the National Minimum Wage and must not be used to undercut the NLW on eligible workers.",
    },
    {
      id: "sr-emp-ni",
      name: "Employer National Insurance",
      jurisdiction: "United Kingdom",
      type: "Tax",
      bands: [
        { label: "Rate",                      value: 15.0,  unit: "%" },
        { label: "Secondary threshold",       value: 5000,  unit: "\u00a3/yr" },
        { label: "Upper secondary (U21/U25)", value: 50270, unit: "\u00a3/yr" },
      ],
      effectiveFrom: "2025-04-06",
      expiresOn: "",
      reference: "Social Security Contributions and Benefits Act 1992",
      note: "Rate increased from 13.8% to 15.0%; secondary threshold reduced from \u00a39,100 to \u00a35,000 from 6 April 2025.",
    },
    {
      id: "sr-wtr",
      name: "WTR Holiday Pay",
      jurisdiction: "United Kingdom",
      type: "Entitlement",
      bands: [
        { label: "Statutory entitlement", value: 5.6,   unit: "weeks/yr" },
        { label: "Rolled-up rate",        value: 12.07, unit: "%" },
      ],
      effectiveFrom: "1998-10-01",
      expiresOn: "",
      reference: "Working Time Regulations 1998, reg. 13\u201316",
      note: "12.07% is derived from 5.6 weeks \u00f7 46.4 working weeks. Applies to workers on irregular hours under the rolled-up holiday pay provisions introduced in 2023.",
    },
    {
      id: "sr-pension",
      name: "Auto-Enrolment Pension",
      jurisdiction: "United Kingdom",
      type: "Contribution",
      bands: [
        { label: "Employer minimum", value: 3.0,   unit: "% of QE" },
        { label: "Total minimum",    value: 8.0,   unit: "% of QE" },
        { label: "QE lower limit",   value: 6240,  unit: "\u00a3/yr" },
        { label: "QE upper limit",   value: 50270, unit: "\u00a3/yr" },
      ],
      effectiveFrom: "2019-04-06",
      expiresOn: "",
      reference: "Pensions Act 2008; Auto-Enrolment Order 2012",
      note: "QE = qualifying earnings. Employer must contribute at least 3% on the band between the lower and upper thresholds.",
    },
    {
      id: "sr-levy",
      name: "Apprenticeship Levy",
      jurisdiction: "United Kingdom",
      type: "Tax",
      bands: [
        { label: "Rate",             value: 0.5,   unit: "% of paybill" },
        { label: "Annual allowance", value: 15000, unit: "\u00a3/yr" },
      ],
      effectiveFrom: "2017-04-06",
      expiresOn: "",
      reference: "Finance Act 2016, Part 6",
      note: "Applies to employers with annual paybill over \u00a33M. Allowance of \u00a315,000 offsets the levy.",
    },
  ];

  var VALIDATIONS = [
    {
      id: "val-minwage",
      name: "Minimum wage floor",
      ruleId: "sr-nlw",
      desc: "Base pay rate must meet or exceed the National Living Wage for the applicable age band.",
      severity: "error",
      enabled: true,
    },
    {
      id: "val-holiday",
      name: "Holiday pay rate",
      ruleId: "sr-wtr",
      desc: "Holiday accrual percentage must be at least 12.07% (WTR statutory minimum).",
      severity: "warning",
      enabled: true,
    },
    {
      id: "val-pension",
      name: "Pension contribution floor",
      ruleId: "sr-pension",
      desc: "Employer pension must be at least 3% on qualifying earnings.",
      severity: "error",
      enabled: true,
    },
    {
      id: "val-ni-rate",
      name: "Employer NI rate check",
      ruleId: "sr-emp-ni",
      desc: "Employer NI rate used in the engine must match the current statutory rate (15.0%).",
      severity: "warning",
      enabled: true,
    },
    {
      id: "val-levy",
      name: "Levy inclusion consistency",
      ruleId: "sr-levy",
      desc: "Apprenticeship levy inclusion flag must be consistent across all rate lines for the same supplier.",
      severity: "warning",
      enabled: false,
    },
  ];

  // ------------------------------------------------------------------
  //  B. Helpers
  // ------------------------------------------------------------------
  function fmtDate(iso) {
    if (!iso) return "\u2014";
    try {
      var p = iso.split("-");
      var months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
      return parseInt(p[2], 10) + "\u00a0" + months[parseInt(p[1], 10) - 1] + "\u00a0" + p[0];
    } catch (e) { return iso; }
  }

  function ruleStatus(r) {
    var today = new Date(); today.setHours(0, 0, 0, 0);
    var from = r.effectiveFrom ? new Date(r.effectiveFrom) : null;
    var to   = r.expiresOn     ? new Date(r.expiresOn)     : null;
    if (from && from > today) return "upcoming";
    if (to   && to   < today) return "expired";
    return "active";
  }

  function ruleById(id) {
    return (V1.state.statutoryRules || []).filter(function (r) { return r.id === id; })[0];
  }

  function bandSummary(bands) {
    if (!bands || !bands.length) return "\u2014";
    return bands.map(function (b) {
      return '<span class="sr-band-chip"><span class="sr-band-label">' + esc(b.label) + '</span>' +
             '<b>' + esc(String(b.value)) + '</b>\u2009' + esc(b.unit) + '</span>';
    }).join("");
  }

  // ------------------------------------------------------------------
  //  C. Tab navigation
  // ------------------------------------------------------------------
  function tabNav() {
    var tab = V1.state.pricingTab || "upload";
    function t(id, label) {
      return '<button class="pricing-tab-btn' + (tab === id ? " is-active" : "") +
        '" data-act="pricing-tab" data-tab="' + id + '">' + label + '</button>';
    }
    return '<div class="pricing-tabs">' +
      t("upload",    "Rate Card") +
      t("statutory", "Statutory Rules") +
    '</div>';
  }

  // ------------------------------------------------------------------
  //  D. Top-level render
  // ------------------------------------------------------------------
  function render() {
    var tab = V1.state.pricingTab || "upload";

    var head = V1.crumb([
      { label: "Settings",      act: "settings-root" },
      { label: "Configuration", act: "noop" },
      { label: "Pricing" },
    ]) +
    '<div class="proto-page-head"><h1>Pricing</h1>' +
    '<p>Upload an agency rate card to map every net-pay job to a rate-card role, then let the pay rate engine build charge rates from your agency on-costs and margin.</p></div>';

    return head + tabNav() + (tab === "statutory" ? renderStatutoryTab() : renderUploadTab());
  }

  // ------------------------------------------------------------------
  //  E. Rate Card tab (original upload flow)
  // ------------------------------------------------------------------
  function renderUploadTab() {
    var state = V1.state;
    var u = state.upload;
    var structured = u && u.parsed && u.parsed.detected;

    var banner = (u && u.processed)
      ? '<div class="proto-banner">' + ico("Check") +
          '<div class="bn-text"><b>Rate automation applied.</b> ' +
          (structured ? eng.buildRateCard(u.parsed, state.engine).length + " computed rates"
                      : u.rows.length + " rates") +
          " from <b>" + esc(u.name) + "</b> were queued for approval and take effect on activation.</div>" +
        "</div>"
      : "";

    var step1 =
      '<div class="proto-step is-done">' +
        '<div class="proto-step-num">' + ico("Check") + "</div>" +
        '<div class="proto-step-body">' +
          "<h3>Download the rate card template</h3>" +
          "<p>The template carries the reference tables the engine reads \u2014 areas in scope, job-type matching, contracts to include and rate-card role names.</p>" +
          '<button class="proto-btn proto-btn--secondary" data-act="download-template">' + ico("FileDownload") + "Download template (.xlsx)</button>" +
        "</div>" +
      "</div>";

    var dropOrFile;
    if (u) {
      var meta = structured
        ? (u.parsed.roleMatching.filter(function (m) { return m.role; }).length + " roles \u00b7 " + u.parsed.jobTypes.length + " job mappings")
        : (V1.fmtSize(u.size) + " \u00b7 " + u.rows.length + " rows detected");
      dropOrFile =
        '<div class="v1rc-file">' +
          '<span class="v1rc-file-ico">' + ico("Excel") + "</span>" +
          '<div class="v1rc-file-main">' +
            '<div class="v1rc-file-name">' + esc(u.name) + "</div>" +
            '<div class="v1rc-file-meta">' + meta + "</div>" +
          "</div>" +
          '<button class="v1rc-file-x" data-act="remove-file" aria-label="Remove file">' + ico("X") + "</button>" +
        "</div>";
    } else {
      dropOrFile =
        '<div class="v1rc-drop" id="dropzone" tabindex="0" role="button" aria-label="Upload rate file">' +
          '<span class="v1rc-drop-ico">' + ico("FileUpload") + "</span>" +
          '<span class="v1rc-drop-t">Drag and drop your rate file <span class="v1rc-drop-link">or browse</span></span>' +
          '<span class="v1rc-drop-sub">.xlsx, .xls or .csv</span>' +
        "</div>" +
        '<input type="file" id="fileinput" accept=".xlsx,.xls,.csv" style="display:none" />';
    }

    var step2 =
      '<div class="proto-step' + (u ? " is-done" : "") + '">' +
        '<div class="proto-step-num">' + (u ? ico("Check") : "2") + "</div>" +
        '<div class="proto-step-body">' +
          "<h3>Upload your completed rate card</h3>" +
          "<p>We validate the reference tables and preview every computed rate before anything changes.</p>" +
          dropOrFile +
        "</div>" +
      "</div>";

    var uploadCard =
      '<div class="proto-card" style="padding:var(--evr-spacing-lg)">' +
        '<div class="proto-steps">' + step1 + step2 + "</div>" +
        (u && !structured ? flatPreview(u) : "") +
      "</div>";

    if (!structured) return banner + uploadCard;
    return banner + uploadCard + summaryCard(u.parsed) + engineCard(u.parsed) + computedCard(u.parsed, u.processed);
  }

  // Flat preview for the simple (non-reference) template.
  function flatPreview(u) {
    var theadCells = u.cols.map(function (c) { return "<th>" + esc(String(c)) + "</th>"; }).join("");
    var rowsHtml = u.rows.slice(0, 8).map(function (r) {
      return "<tr>" + u.cols.map(function (c, i) {
        var val = r[i] == null ? "" : r[i];
        var isNum = typeof val === "number" || (i >= 3 && i <= 5);
        return '<td class="' + (isNum ? "num" : "") + '">' + esc(String(val)) + "</td>";
      }).join("") + "</tr>";
    }).join("");
    var more = u.rows.length > 8
      ? '<p class="muted" style="margin:10px 0 0;font:var(--evr-body2)">Showing 8 of ' + u.rows.length + " rows.</p>"
      : "";
    return '<hr class="proto-divider" /><div class="proto-section-title">Preview</div>' +
      '<div class="proto-table-wrap"><table class="proto-table"><thead><tr>' + theadCells +
      "</tr></thead><tbody>" + rowsHtml + "</tbody></table></div>" + more +
      '<div style="display:flex;gap:12px;margin-top:20px">' +
        '<button class="proto-btn proto-btn--primary" data-act="process"' + (u.processed ? " disabled" : "") + ">" +
          ico("Bolt") + (u.processed ? "Rates applied" : "Apply rate automation") +
        "</button>" +
        '<button class="proto-btn proto-btn--ghost" data-act="remove-file">Choose a different file</button>' +
      "</div>";
  }

  function sumcard(icon, value, label) {
    return '<div class="proto-sumcard">' + ico(icon, "sc-ico") +
      '<span class="sc-v">' + value + "</span><div class=\"sc-l\">" + label + "</div></div>";
  }

  function summaryCard(parsed) {
    var areasOn = parsed.areas.filter(function (a) { return a.on; });
    var typeSet = {}; parsed.jobTypes.forEach(function (j) { typeSet[j.jobType] = 1; });
    var jobTypes = Object.keys(typeSet);
    var mapped = parsed.roleMatching.filter(function (m) { return m.role; });
    var areaChips  = parsed.areas.map(function (a) {
      return '<span class="proto-chip ' + (a.on ? "is-on" : "is-off") + '">' + (a.on ? ico("Check") : "") + esc(a.name) + "</span>";
    }).join("");
    var contractChips = parsed.contracts.map(function (c) {
      return '<span class="proto-chip ' + (c.on ? "is-on" : "is-off") + '">' + (c.on ? ico("Check") : "") + esc(c.name) + "</span>";
    }).join("");
    var typeChips = jobTypes.map(function (t) {
      var n = parsed.jobTypes.filter(function (j) { return j.jobType === t; }).length;
      return '<span class="proto-chip">' + ico("Tag") + esc(t) + "\u2009\u00b7\u2009" + n + "</span>";
    }).join("");

    return '<div class="proto-card" style="padding:var(--evr-spacing-lg);margin-top:var(--evr-spacing-md)">' +
      '<div class="proto-section-title">What we read from your file</div>' +
      '<div class="proto-summary-grid">' +
        sumcard("Location", String(areasOn.length), "active <b>" + (areasOn.length === 1 ? "area" : "areas") + "</b> of " + parsed.areas.length + (areasOn.length ? " \u2014 " + areasOn.map(function (a) { return a.name; }).join(", ") : "")) +
        sumcard("Tag", String(jobTypes.length), "job types matched across " + parsed.jobTypes.length + " jobs") +
        sumcard("ClipboardPerson", String(mapped.length), "rate-card roles mapped of " + parsed.roleMatching.length) +
        sumcard("License", parsed.contracts.filter(function (c) { return c.on; }).length + '<span style="font:var(--evr-body2);color:var(--evr-content-primary-lowemp)"> / ' + parsed.contracts.length + "</span>", "contract types included") +
      "</div>" +
      '<div class="proto-set-section-label">Rate card scope \u2014 areas</div><div class="proto-chiprow">' + areaChips + "</div>" +
      '<div class="proto-set-section-label">Job types</div><div class="proto-chiprow">' + typeChips + "</div>" +
      '<div class="proto-set-section-label">Contract types included</div><div class="proto-chiprow">' + contractChips + "</div>" +
    "</div>";
  }

  function flowStage(step, icon, title, sub, out) {
    return '<div class="proto-flow-stage' + (out ? " is-out" : "") + '">' +
      '<div class="fs-ico">' + ico(icon) + "</div>" +
      '<div class="fs-step">' + step + "</div>" +
      '<div class="fs-title">' + title + "</div>" +
      '<div class="fs-sub">' + sub + "</div></div>";
  }
  function flowArrow() { return '<div class="proto-flow-arrow">' + ico("ChevronRight") + "</div>"; }

  function buildRow(label, pctText, val, charge, fillCls, kind) {
    var w = Math.max(2, Math.min(100, val / charge * 100));
    var cls = "proto-build-row" + (kind === "subtotal" ? " is-subtotal" : kind === "total" ? " is-total" : "");
    var valCls = "br-val" + (kind === "add" ? " is-add" : "");
    var sign = kind === "add" ? "+" : "";
    return '<div class="' + cls + '">' +
      '<div class="br-label">' + label + (pctText ? '<span class="br-pct">' + pctText + "</span>" : "") + "</div>" +
      '<div class="proto-build-track"><div class="proto-build-fill ' + fillCls + '" style="width:' + w.toFixed(1) + '%"></div></div>' +
      '<div class="' + valCls + '">' + sign + gbp(val) + "</div>" +
    "</div>";
  }

  function engineCard(parsed) {
    var state = V1.state;
    var engine = state.engine;
    var rows = eng.buildRateCard(parsed, engine);
    if (!rows.length) return "";
    if (state.exampleRole >= rows.length) state.exampleRole = 0;
    var ex = rows[state.exampleRole];
    var c = ex.calc;
    var onParts = c.parts.filter(function (p) { return p.on; });

    var flow =
      '<div class="proto-flow">' +
        flowStage("Input",  "Wallet",   "Net pay rate",      "From the net-pay rate table") + flowArrow() +
        flowStage("Step 1", "Tag",      "Classify job type", "Job-type &amp; role matching") + flowArrow() +
        flowStage("Step 2", "Calculate","Statutory on-costs","Holiday, NI, pension, levy")   + flowArrow() +
        flowStage("Step 3", "Scale",    "Agency margin",     engine.margin + "% build-up")   + flowArrow() +
        flowStage("Output", "MoneyBag", "Charge rate",       "What the client is billed", true) +
      "</div>";

    var roleOpts = rows.map(function (r, i) {
      return '<option value="' + i + '"' + (i === state.exampleRole ? " selected" : "") + ">" + esc(r.role) + " \u2014 " + esc(r.jobType) + "</option>";
    }).join("");

    var build = '<div class="proto-build">' +
      buildRow("Base pay rate", "net", c.base, c.charge, "is-base", "val");
    onParts.forEach(function (p) {
      build += buildRow(p.label, p.pct.toFixed(2) + "%", p.amt, c.charge, "is-oncost", "add");
    });
    build += buildRow("Pay cost", "to employ", c.payCost, c.charge, "is-base", "subtotal") +
      buildRow("Agency margin", engine.margin + "%", c.marginAmt, c.charge, "is-margin", "add") +
      buildRow("Charge rate", "billed / hr", c.charge, c.charge, "is-base", "total") +
      "</div>";

    var trace = '<div class="proto-example-side">' +
      '<div class="es-title">Why this rate</div>' +
      '<div class="proto-trace">' +
        '<div class="proto-trace-row"><div class="tr-k">Net-pay job</div><div class="tr-v">' + esc(ex.netJob) + "</div></div>" +
        '<div class="proto-trace-row"><div class="tr-k">Job type</div><div class="tr-v"><span class="tr-tag">' + esc(ex.jobType) + "</span></div></div>" +
        '<div class="proto-trace-row"><div class="tr-k">Rate-card role</div><div class="tr-v">' + esc(ex.role) + "</div></div>" +
        '<div class="proto-trace-row"><div class="tr-k">On-costs</div><div class="tr-v">' + gbp(c.oncost) + " \u00b7 " + (c.oncost / c.base * 100).toFixed(1) + "% of base</div></div>" +
        '<div class="proto-trace-row"><div class="tr-k">OT rate (' + engine.ot + "\u00d7)</div><div class=\"tr-v\">" + gbp(c.base * engine.ot) + "/hr</div></div>" +
      "</div>" +
      '<div class="proto-margin-callout"><span class="mc-l">Effective margin</span><span class="mc-v">' + c.marginPctOfCharge.toFixed(1) + "%</span></div>" +
    "</div>";

    return '<div class="proto-card" style="padding:var(--evr-spacing-lg);margin-top:var(--evr-spacing-md)">' +
      '<div class="proto-engine-head"><h2>Pay rate engine</h2><p>How a charge rate is built from a worker\u2019s base pay.</p></div>' +
      flow +
      '<div class="proto-engine-panel">' +
        '<div><div class="proto-build-head"><span class="bh-label">Worked example</span>' +
          '<span class="proto-select"><select id="roleselect" aria-label="Choose a role">' + roleOpts + "</select></span></div>" +
          build + "</div>" +
        trace +
      "</div>" +
      '<div class="proto-engine-note">' + ico("Information") +
        "<p>On-costs and margin come from this agency\u2019s engine settings. Change them in <b>Agencies \u2192 WorkWhile \u2192 Pricing Configuration Contract</b> and every rate here recalculates. " +
        '<button class="proto-linkbtn" data-act="open-agency-settings" style="margin-top:8px;padding:8px 14px;font-size:13px">' + ico("Settings") + "Open agency engine settings</button></p>" +
      "</div>" +
    "</div>";
  }

  function computedCard(parsed, processed) {
    var rows = eng.buildRateCard(parsed, V1.state.engine);
    if (!rows.length) return "";
    var body = rows.map(function (r) {
      return "<tr><td>" + esc(r.role) + "</td>" +
        "<td>" + esc(r.jobType) + "</td>" +
        '<td class="num">' + gbp(r.calc.base) + "</td>" +
        '<td class="num">' + gbp(r.calc.payCost) + "</td>" +
        '<td class="num">' + gbp(r.calc.marginAmt) + "</td>" +
        '<td class="num" style="font-weight:700;color:var(--evr-interactive-primary-default)">' + gbp(r.calc.charge) + "</td></tr>";
    }).join("");
    return '<div class="proto-card" style="padding:var(--evr-spacing-lg);margin-top:var(--evr-spacing-md)">' +
      '<div class="proto-section-title">Computed rate card \u2014 ' + rows.length + " roles</div>" +
      '<div class="proto-table-wrap"><table class="proto-table"><thead><tr>' +
        "<th>Rate-card role</th><th>Job type</th><th>Base pay</th><th>Pay cost</th><th>Margin</th><th>Charge rate</th>" +
      "</tr></thead><tbody>" + body + "</tbody></table></div>" +
      '<div class="proto-set-actions">' +
        '<button class="proto-btn proto-btn--primary" data-act="process"' + (processed ? " disabled" : "") + ">" +
          ico("Bolt") + (processed ? "Rates applied" : "Apply rate automation") +
        "</button>" +
        '<button class="proto-btn proto-btn--ghost" data-act="remove-file">Choose a different file</button>' +
      "</div>" +
    "</div>";
  }

  // ------------------------------------------------------------------
  //  F. Statutory Rules tab
  // ------------------------------------------------------------------
  function renderStatutoryTab() {
    var state = V1.state;
    var rules   = state.statutoryRules    || [];
    var editing = state.srEditing;

    return (
      '<div class="proto-card sr-main-card">' +
        '<div class="sr-card-head">' +
          '<div>' +
            '<h2 class="sr-section-h">Statutory rules</h2>' +
            '<p class="sr-section-sub">Values are read by the rate engine and checked on every rate card upload. ' +
            'Edit a rule when legislation changes \u2014 set a future effective date to schedule the change without activating it immediately.</p>' +
          '</div>' +
        '</div>' +
        rulesTable(rules, editing) +
        (editing ? rulesEditor(state.srDraft) : "") +
      '</div>' +
      '<div class="proto-card sr-val-card">' +
        validationsSection(state.pricingValidations || []) +
      '</div>'
    );
  }

  function rulesTable(rules, editing) {
    if (!rules.length) {
      return '<div class="sr-empty">' + ico("Information") + '<p>No statutory rules configured.</p></div>';
    }
    var rows = rules.map(function (r) {
      var status = ruleStatus(r);
      var isEdit = editing === r.id;
      var statusHtml =
        status === "upcoming"
          ? '<span class="sr-status sr-status--upcoming">' + ico("Calendar") + "Upcoming</span>"
          : status === "expired"
          ? '<span class="sr-status sr-status--expired">'  + ico("X")        + "Expired</span>"
          :  '<span class="sr-status sr-status--active">'  + ico("Check")    + "Active</span>";

      return '<tr class="sr-tr' + (isEdit ? " is-editing" : "") + '">' +
        "<td>" +
          '<div class="sr-rule-name">' + esc(r.name) + "</div>" +
          '<div class="sr-jur">' + esc(r.jurisdiction) + "</div>" +
        "</td>" +
        '<td><span class="sr-type-badge sr-type--' + r.type.toLowerCase() + '">' + esc(r.type) + "</span></td>" +
        '<td class="sr-td-bands">' + bandSummary(r.bands) + "</td>" +
        '<td class="sr-td-date">' + fmtDate(r.effectiveFrom) + "</td>" +
        '<td class="sr-td-date">' + (r.expiresOn ? fmtDate(r.expiresOn) : "\u2014") + "</td>" +
        "<td>" + statusHtml + "</td>" +
        '<td class="sr-td-actions">' +
          '<button class="re-act-btn' + (isEdit ? " is-active-edit" : "") + '" ' +
            'data-act="sr-edit" data-sr-id="' + esc(r.id) + '" title="' + (isEdit ? "Currently editing" : "Edit rule") + '">' +
            ico("Edit") +
          "</button>" +
        "</td>" +
      "</tr>";
    }).join("");

    return '<div class="sr-table-scroll">' +
      '<table class="sr-table">' +
        "<thead><tr>" +
          "<th>Rule</th>" +
          "<th>Type</th>" +
          "<th>Current values</th>" +
          "<th>Effective from</th>" +
          "<th>Expires</th>" +
          "<th>Status</th>" +
          "<th></th>" +
        "</tr></thead>" +
        "<tbody>" + rows + "</tbody>" +
      "</table>" +
    "</div>";
  }

  function rulesEditor(draft) {
    if (!draft) return "";

    var bandFields = (draft.bands || []).map(function (b, i) {
      return '<div class="sr-band-field">' +
        '<label class="re-label">' + esc(b.label) +
          '<span class="re-label-hint"> (' + esc(b.unit) + ")</span>" +
        "</label>" +
        '<input class="re-num-in" type="number" step="0.01" min="0" data-sr-band="' + i + '" value="' + esc(String(b.value)) + '" />' +
      "</div>";
    }).join("");

    return '<div class="sr-editor" id="sr-editor">' +
      '<div class="re-ed-head">' +
        '<div>' +
          '<h2>Edit \u2014 ' + esc(draft.name) + "</h2>" +
          '<p class="sr-ed-ref">' + ico("Information") + esc(draft.reference) + "</p>" +
        "</div>" +
        '<button class="re-ed-close" data-act="sr-cancel" aria-label="Close editor">' + ico("X") + "</button>" +
      "</div>" +
      '<div class="sr-ed-body">' +
        '<div class="sr-ed-col">' +
          '<div class="re-ed-sec-title">Values</div>' +
          '<div class="sr-band-grid">' + bandFields + "</div>" +
          (draft.note
            ? '<div class="sr-note-block">' + ico("Information") + '<p>' + esc(draft.note) + "</p></div>"
            : "") +
        "</div>" +
        '<div class="sr-ed-col">' +
          '<div class="re-ed-sec-title">Effective dates</div>' +
          '<div class="re-field">' +
            '<label class="re-label">Effective from</label>' +
            '<input class="re-num-in" type="date" id="sr-date-from" value="' + esc(draft.effectiveFrom || "") + '" />' +
            '<p class="sr-field-hint">Set a future date to schedule a change without activating it immediately.</p>' +
          "</div>" +
          '<div class="re-field">' +
            '<label class="re-label">Expires on <span class="re-label-hint">(optional)</span></label>' +
            '<input class="re-num-in" type="date" id="sr-date-to" value="' + esc(draft.expiresOn || "") + '" />' +
            '<p class="sr-field-hint">Leave blank if this rule has no planned end date.</p>' +
          "</div>" +
          '<div class="re-field">' +
            '<label class="re-label">Notes</label>' +
            '<textarea class="sr-note-in" id="sr-note" rows="3">' + esc(draft.note || "") + "</textarea>" +
          "</div>" +
        "</div>" +
      "</div>" +
      '<div class="re-ed-footer">' +
        '<button class="proto-btn proto-btn--primary" data-act="sr-save">' + ico("Save") + "Save changes</button>" +
        '<button class="proto-btn proto-btn--ghost" data-act="sr-cancel">Cancel</button>' +
      "</div>" +
    "</div>";
  }

  function validationsSection(vals) {
    var rows = vals.map(function (v) {
      var rule    = ruleById(v.ruleId);
      var ruleNm  = rule ? rule.name : v.ruleId;
      var sevCls  = "sr-sev--" + v.severity;
      var sevLbl  = v.severity === "error" ? "Blocks upload" : "Warning";
      return '<div class="val-row' + (v.enabled ? " is-on" : " is-off") + '">' +
        '<div class="val-info">' +
          '<div class="val-name">' + esc(v.name) + "</div>" +
          '<div class="val-desc">' + esc(v.desc) + "</div>" +
          '<div class="val-meta">' +
            '<span class="val-rule-ref">' + ico("Scale") + esc(ruleNm) + "</span>" +
            '<span class="sr-sev ' + sevCls + '">' + esc(sevLbl) + "</span>" +
          "</div>" +
        "</div>" +
        '<label class="re-toggle val-toggle" title="' + (v.enabled ? "Enabled \u2014 click to disable" : "Disabled \u2014 click to enable") + '">' +
          '<input class="re-toggle-in" type="checkbox"' + (v.enabled ? " checked" : "") + ' data-val-id="' + esc(v.id) + '" />' +
          '<span class="re-toggle-track"></span>' +
        "</label>" +
      "</div>";
    }).join("");

    return '<div class="sr-val-head">' +
        '<h2 class="sr-section-h">Upload validations</h2>' +
        '<p class="sr-section-sub">These checks run on every rate card upload. Errors block import; warnings surface in the confirmation step.</p>' +
      "</div>" +
      '<div class="val-list">' + rows + "</div>";
  }

  // ------------------------------------------------------------------
  //  G. Wire
  // ------------------------------------------------------------------
  function wire(app) {
    var tab = V1.state.pricingTab || "upload";
    if (tab === "statutory") {
      wireStatutory(app);
    } else {
      wireUpload(app);
    }
  }

  function wireUpload(app) {
    var dz = app.querySelector("#dropzone");
    var fi = app.querySelector("#fileinput");
    if (dz && fi) {
      dz.addEventListener("click", function () { fi.click(); });
      dz.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); fi.click(); }
      });
      ["dragenter", "dragover"].forEach(function (ev) {
        dz.addEventListener(ev, function (e) { e.preventDefault(); dz.classList.add("is-drag"); });
      });
      ["dragleave", "drop"].forEach(function (ev) {
        dz.addEventListener(ev, function (e) { e.preventDefault(); dz.classList.remove("is-drag"); });
      });
      dz.addEventListener("drop", function (e) {
        if (e.dataTransfer.files && e.dataTransfer.files[0]) V1.engine.handleFile(e.dataTransfer.files[0]);
      });
      fi.addEventListener("change", function () {
        if (fi.files && fi.files[0]) V1.engine.handleFile(fi.files[0]);
      });
    }
    var rs = app.querySelector("#roleselect");
    if (rs) rs.addEventListener("change", function () { V1.state.exampleRole = parseInt(rs.value, 10) || 0; V1.render(); });
  }

  function wireStatutory(app) {
    // Band value inputs — update srDraft in place (no re-render on each keystroke)
    app.querySelectorAll("[data-sr-band]").forEach(function (inp) {
      inp.addEventListener("input", function () {
        if (!V1.state.srDraft) return;
        var idx = parseInt(inp.getAttribute("data-sr-band"), 10);
        var val = parseFloat(inp.value);
        if (!isNaN(val) && V1.state.srDraft.bands[idx]) {
          V1.state.srDraft.bands[idx].value = val;
        }
      });
    });

    // Effective-date inputs
    var dfrom = app.querySelector("#sr-date-from");
    if (dfrom) dfrom.addEventListener("change", function () {
      if (V1.state.srDraft) V1.state.srDraft.effectiveFrom = dfrom.value || "";
    });
    var dto = app.querySelector("#sr-date-to");
    if (dto) dto.addEventListener("change", function () {
      if (V1.state.srDraft) V1.state.srDraft.expiresOn = dto.value || "";
    });

    // Notes textarea
    var note = app.querySelector("#sr-note");
    if (note) note.addEventListener("input", function () {
      if (V1.state.srDraft) V1.state.srDraft.note = note.value;
    });

    // Validation toggles — re-render so status badge + opacity update
    app.querySelectorAll(".re-toggle-in[data-val-id]").forEach(function (cb) {
      cb.addEventListener("change", function () {
        var id = cb.getAttribute("data-val-id");
        var v = (V1.state.pricingValidations || []).filter(function (x) { return x.id === id; })[0];
        if (v) {
          v.enabled = cb.checked;
          V1.render();
          V1.toast(esc(v.name) + (cb.checked ? " enabled" : " disabled"));
        }
      });
    });
  }

  // ------------------------------------------------------------------
  //  H. Export
  // ------------------------------------------------------------------
  V1.pages.pricing = {
    id: "pricing",
    render: render,
    wire: wire,
    STATUTORY_RULES: STATUTORY_RULES,
    VALIDATIONS: VALIDATIONS,
  };
})(window.V1);
