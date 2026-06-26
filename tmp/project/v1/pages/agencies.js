// =====================================================================
//  FLEX WORK V1 · pages/agencies  (IA version: V1)
//  ---------------------------------------------------------------------
//  Agencies → WorkWhile agency detail: contract-dates bar, agency hero
//  (logo, address, copyable GUID, activation date, stat trio) and the
//  expandable cards (Agency Details, Pricing Configuration Contract,
//  Cancellation Policy, Users, Comments, Logs). The Pricing card hosts
//  the agency-level pay rate engine settings (margin, OT, on-costs,
//  rounding) with a live charge-rate preview.
//
//  Registers window.V1.pages.agencies = { render, wire }.
//  Loaded AFTER core.js + pages/rate-engine.js.
// =====================================================================
(function (V1) {
  "use strict";
  var ico = V1.ico, gbp = V1.gbp, esc = V1.escapeHtml, field = V1.field, stat = V1.stat;

  // Sample base used for the live preview (HGV Driver, day shift).
  function previewBase() { return V1.engine.basePayFor("Cat C Day Driver", "HGV Driver"); }

  // ---------- Agencies: rate cards section (rc2-style) --------------------
  function rateCardsBody() {
    var synced = V1.state.upload && V1.state.upload.name
      ? esc(V1.state.upload.name) : null;

    // WorkWhile-specific rate card (seeded data)
    var card = {
      name: "WorkWhile Standard",
      engineName: "WorkWhile",
      engineVer: "v2",
      engineKicker: "United Kingdom \u00b7 Staffing template",
      liveVersion: 2,
      effectiveDate: "1 Feb 2026",
      lines: 28,
      payRange: "\u00a312.21\u2013\u00a316.50",
      billRange: "\u00a315.40\u2013\u00a321.80",
      versions: [
        { v: 2, status: "active",     dates: "1 Feb 2026 \u2013 present",          applied: "28 Jan 2026",
          payFile: "WorkWhile_pay_v2.xlsx",  billFile: "WorkWhile_bill_v2.xlsx"  },
        { v: 1, status: "superseded", dates: "11 Oct 2024 \u2013 31 Jan 2026",     applied: "9 Oct 2024",
          payFile: "WorkWhile_pay_v1.xlsx",  billFile: "WorkWhile_bill_v1.xlsx"  },
      ]
    };

    var ST = { active: "Active", scheduled: "Scheduled", superseded: "Superseded" };
    function stCls(s) { return s === "active" ? "is-active" : s === "scheduled" ? "is-scheduled" : "is-superseded"; }
    function docChip(ok, label) {
      return '<span class="v1rc-doc v1rc-doc--' + (ok ? "ok" : "miss") + '">' +
        ico(ok ? "Check" : "Alert") + label + '</span>';
    }

    var engineHead =
      '<div class="v1rc-engine-head">' +
        '<span class="v1rc-engine-ico">' + ico("DataGridView") + '</span>' +
        '<div class="v1rc-engine-id">' +
          '<div class="v1rc-engine-name">' + esc(card.engineName) +
            ' <span class="v1rc-engine-ver">' + card.engineVer + '</span></div>' +
          '<div class="v1rc-engine-kicker">' + esc(card.engineKicker) + '</div>' +
        '</div>' +
        '<div class="v1rc-engine-active">' +
          '<span class="v1rc-engine-active-l">Active rate card</span>' +
          '<span class="v1rc-engine-active-v">' + esc(card.name) + ' \u00b7 v' + card.liveVersion + '</span>' +
        '</div>' +
      '</div>';

    var cardRow =
      '<div class="v1rc-card-row">' +
        '<div class="v1rc-cr-header">' +
          '<div class="v1rc-cr-left">' +
            '<span class="v1rc-cr-name">' + esc(card.name) + '</span>' +
            '<span class="proto-ver-badge is-active">Active</span>' +
            '<span class="v1rc-cr-meta">v' + card.liveVersion +
              ' \u00b7 from ' + card.effectiveDate +
              ' \u00b7 ' + card.lines + ' lines</span>' +
          '</div>' +
          '<div class="v1rc-cr-right">' + docChip(true, "Pay") + docChip(true, "Bill") + '</div>' +
        '</div>' +
        '<div class="v1rc-cr-body">' +
          '<div class="v1rc-cr-rate">' +
            '<span class="v1rc-cr-rate-l">Pay rate range</span>' +
            '<span class="v1rc-cr-rate-v">' + card.payRange + '</span>' +
            '<span class="v1rc-cr-rate-s">/hr</span>' +
          '</div>' +
          '<div class="v1rc-cr-rate v1rc-cr-rate--bill">' +
            '<span class="v1rc-cr-rate-l">Bill rate range</span>' +
            '<span class="v1rc-cr-rate-v">' + card.billRange + '</span>' +
            '<span class="v1rc-cr-rate-s">/hr</span>' +
          '</div>' +
          (synced
            ? '<div class="v1rc-cr-meta-ext">' + ico("Sync") + 'Last sync: ' + synced + '</div>'
            : '') +
        '</div>' +
      '</div>';

    var verRows = card.versions.map(function (v) {
      return '<tr>' +
        '<td><span class="v1rc-ver-no">v' + v.v + '</span></td>' +
        '<td><span class="proto-ver-badge ' + stCls(v.status) + '">' + ST[v.status] + '</span></td>' +
        '<td>' + esc(v.dates) + '</td>' +
        '<td><span class="v1rc-ver-doc">' + ico("Excel") + esc(v.payFile) + '</span></td>' +
        '<td><span class="v1rc-ver-doc">' + ico("Excel") + esc(v.billFile) + '</span></td>' +
        '<td>' + esc(v.applied) + '</td>' +
      '</tr>';
    }).join("");

    var history =
      '<div class="v1rc-history">' +
        '<div class="v1rc-history-head">' +
          '<div>' +
            '<div class="v1rc-history-title">' + esc(card.name) + ' \u00b7 Version history</div>' +
            '<div class="v1rc-history-sub">Each version captures both the pay and bill rate documents. Newest first.</div>' +
          '</div>' +
          '<button class="proto-btn proto-btn--primary" data-act="upload-new-version" style="height:36px;padding:0 16px;font-size:13px">' +
            ico("FileUpload") + 'Upload new version' +
          '</button>' +
        '</div>' +
        '<div class="proto-table-wrap">' +
          '<table class="proto-table">' +
            '<thead><tr>' +
              '<th>Version</th><th>Status</th><th>Effective</th>' +
              '<th>Pay rate card</th><th>Bill rate card</th><th>Applied</th>' +
            '</tr></thead>' +
            '<tbody>' + verRows + '</tbody>' +
          '</table>' +
        '</div>' +
      '</div>';

    return '<div class="v1rc-section">' + engineHead + cardRow + history + '</div>';
  }

  // ---------- Agencies → WorkWhile detail ----------
  function render() {
    var state = V1.state;
    var acc = [
      { id: "details",   title: "Agency Details",                 icon: "Briefcase"  },
      { id: "pricing",   title: "Pricing Configuration Contract", icon: "Edit"       },
      { id: "ratecards", title: "Rate Cards",                     icon: "CreditCard" },
      { id: "cancel",    title: "Cancellation Policy",            icon: "Settings"   },
      { id: "users",   title: "Users", icon: "Employees" },
      { id: "comments",title: "Comments", icon: "Notes" },
      { id: "logs",    title: "Logs", icon: "Row" },
    ];
    var bodies = {
      details:
        '<div class="proto-fieldgrid">' +
          field("Legal name", "WorkWhile Inc.") +
          field("Primary contact", "Dana Whitfield") +
          field("Email", "ops@workwhile.com") +
          field("Phone", "214-555-0142") +
          field("Markets served", "Dallas, Houston, Austin, San Antonio") +
          field("Sectors", "Logistics, Manufacturing") +
        '</div>',
      pricing:   agencyEngineSettings(),
      ratecards: rateCardsBody(),
      cancel:  '<p class="muted" style="margin-top:4px">Free cancellation up to 24 hours before shift start. Within 24 hours, a 4-hour minimum applies.</p>',
      users:   '<p class="muted" style="margin-top:4px">No agency users have been invited yet.</p>',
      comments:'<p class="muted" style="margin-top:4px">No comments on this contract.</p>',
      logs:    '<p class="muted" style="margin-top:4px">Contract activated 10/11/2024. No changes since activation.</p>',
    };
    var accHtml = acc.map(function (a) {
      return '<div class="proto-acc-item' + (state.openAcc[a.id] ? " is-open" : "") + '" data-acc="' + a.id + '">' +
        '<button class="proto-acc-head" data-acctoggle="' + a.id + '">' +
          ico(a.icon, "lead") +
          '<span class="proto-acc-title">' + a.title + '</span>' +
          '<span class="proto-acc-chev proto-ico" data-icon="ChevronDown"></span>' +
        '</button>' +
        '<div class="proto-acc-body">' + (bodies[a.id] || "") + '</div>' +
      '</div>';
    }).join("");

    return V1.crumb([
      { label: "Agencies", act: "noop" },
      { label: "Active Agencies", act: "agency-list" },
      { label: "WorkWhile" },
    ]) +
    // contract dates bar
    '<div class="proto-card proto-contract-bar">' +
      '<span class="label">Contract Dates:</span>' +
      '<span class="proto-contract-tab">Current \u2013 04/28/2026</span>' +
      '<span class="spacer"></span>' +
      '<button class="proto-linkbtn" data-act="update-contract" style="margin-top:0">Update this contract</button>' +
    '</div>' +
    // hero
    '<div class="proto-card proto-hero">' +
      '<div class="proto-hero-logo proto-hero-logo--empty">' + V1.ico("Building") + '</div>' +
      '<div class="proto-hero-main">' +
        '<h2>WorkWhile</h2>' +
        '<div class="proto-hero-line">PO Box 121909, Dallas, TX</div>' +
        '<div class="proto-hero-line">GUID: <span class="mono" title="5b488f4f-391f-405a-87ca-1811a0f63ac8">5b488f4f\u2026</span>' +
          '<button class="proto-copy" data-act="copy-guid" aria-label="Copy GUID">' + ico("Copy") + '</button></div>' +
        '<div class="proto-hero-line">Activation Date: <b>10/11/2024 10:23 AM</b></div>' +
      '</div>' +
      '<div class="proto-hero-stats">' +
        stat("N/A", "Talent") + stat("N/A", "Clients") + stat("N/A", "Shift Filled") +
      '</div>' +
    '</div>' +
    '<div class="proto-acc">' + accHtml + '</div>' +
    '<button class="proto-linkbtn" data-act="deactivate">Deactivate Agency Contract</button>';
  }

  // ---------- Agency-level pay rate engine settings ----------
  function agencyEngineSettings() {
    var state = V1.state;
    var e = state.engine;
    var c = V1.engine.computeRate(previewBase(), e);
    var synced = (state.upload && state.upload.parsed) ? esc(state.upload.name) : "Not yet uploaded";

    var oncostRows = e.onCosts.map(function (o) {
      return '<div class="proto-oncost-row">' +
        '<div class="oc-name">' + esc(o.label) + '<span class="oc-sub">' + esc(o.sub) + '</span></div>' +
        '<div class="proto-numfield' + (o.on ? "" : " is-disabled") + '">' +
          '<input type="number" step="0.01" min="0" max="100" value="' + o.pct + '" data-oncost="' + o.key + '"' + (o.on ? "" : " disabled") + ' aria-label="' + esc(o.label) + ' percent" />' +
          '<span class="nf-suffix">%</span></div>' +
        '<label class="proto-switch"><input type="checkbox" data-oncost-on="' + o.key + '"' + (o.on ? " checked" : "") + ' /><span class="sw-track"></span><span class="sw-knob"></span></label>' +
      '</div>';
    }).join("");

    var roundOpts = [{ v: 0, label: "None" }, { v: 0.05, label: "Up to 5p" }, { v: 0.25, label: "Up to 25p" }];
    var roundChips = roundOpts.map(function (r) {
      var on = e.rounding === r.v;
      return '<button class="proto-chip' + (on ? " is-on" : "") + '" data-round="' + r.v + '">' + (on ? ico("Check") : "") + r.label + '</button>';
    }).join("");

    return '<p class="muted" style="margin-top:4px;max-width:64ch">These settings drive the pay rate engine for <b>WorkWhile</b>. Every rate on the uploaded card is recalculated from the worker\u2019s base pay using the on-costs and margin below.</p>' +
      '<div class="proto-fieldgrid">' +
        field("Rate model", "Automated rate card \u00b7 engine v0.79") +
        field("Last rate sync", synced) +
      '</div>' +
      '<div class="proto-set-grid">' +
        '<div class="proto-set-row"><div class="sr-top"><span class="sr-label">Agency margin</span><span class="sr-val" id="set-margin-val">' + e.margin + '%</span></div>' +
          '<input type="range" class="proto-range" id="set-margin" min="5" max="40" step="0.5" value="' + e.margin + '" />' +
          '<span class="sr-help">Applied to pay cost to reach the client charge rate.</span></div>' +
        '<div class="proto-set-row"><div class="sr-top"><span class="sr-label">Overtime multiplier</span><span class="sr-val" id="set-ot-val">' + e.ot + '\u00d7</span></div>' +
          '<input type="range" class="proto-range" id="set-ot" min="1" max="2" step="0.05" value="' + e.ot + '" />' +
          '<span class="sr-help">Multiplier on base pay for overtime hours.</span></div>' +
      '</div>' +
      '<div class="proto-set-section-label">Statutory on-costs</div>' +
      '<div class="proto-oncost-list">' + oncostRows + '</div>' +
      '<div class="proto-set-section-label">Charge rate rounding</div>' +
      '<div class="proto-chiprow">' + roundChips + '</div>' +
      '<div class="proto-set-section-label">Live preview \u2014 HGV Driver, day shift</div>' +
      '<div class="proto-set-preview">' +
        '<div class="sp-item"><span class="sp-k">Base pay</span><span class="sp-v" id="ep-base">' + gbp(c.base) + '</span></div>' +
        '<span class="sp-arrow">' + ico("ArrowRight") + '</span>' +
        '<div class="sp-item"><span class="sp-k">+ on-costs</span><span class="sp-v" id="ep-oncost">' + gbp(c.oncost) + '</span></div>' +
        '<span class="sp-arrow">' + ico("ArrowRight") + '</span>' +
        '<div class="sp-item"><span class="sp-k">Pay cost</span><span class="sp-v" id="ep-paycost">' + gbp(c.payCost) + '</span></div>' +
        '<span class="sp-arrow">' + ico("ArrowRight") + '</span>' +
        '<div class="sp-item"><span class="sp-k">Charge rate</span><span class="sp-v is-charge" id="ep-charge">' + gbp(c.charge) + '</span></div>' +
      '</div>' +
      '<div class="proto-set-actions">' +
        '<button class="proto-btn proto-btn--primary" data-act="save-engine">' + ico("Save") + 'Save engine settings</button>' +
        '<button class="proto-btn proto-btn--ghost" data-act="reset-engine">Reset to defaults</button>' +
        '<button class="proto-btn proto-btn--secondary" data-act="go-pricing" style="margin-left:auto">' + ico("Export") + 'Open rate automation</button>' +
      '</div>';
  }

  // Live-update the engine preview values without a full re-render
  // (keeps slider focus while dragging).
  function updateEnginePreview() {
    var app = V1.app;
    var c = V1.engine.computeRate(previewBase(), V1.state.engine);
    var set = function (sel, txt) { var el = app.querySelector(sel); if (el) el.textContent = txt; };
    set("#ep-base", gbp(c.base));
    set("#ep-oncost", gbp(c.oncost));
    set("#ep-paycost", gbp(c.payCost));
    set("#ep-charge", gbp(c.charge));
    set("#set-margin-val", V1.state.engine.margin + "%");
    set("#set-ot-val", V1.state.engine.ot + "\u00d7");
  }

  // ---------- Page-specific event wiring ----------
  function wire(app) {
    var state = V1.state;

    // accordion toggles (open state lives in state so live re-renders keep panels open)
    // upload-new-version is not interactive in this prototype
    app.querySelectorAll("[data-act='upload-new-version']").forEach(function (b) {
      b.addEventListener("click", function () { V1.toast("Rate card upload isn\u2019t part of this prototype."); });
    });

    app.querySelectorAll("[data-acctoggle]").forEach(function (b) {
      b.addEventListener("click", function () {
        var id = b.getAttribute("data-acctoggle");
        state.openAcc[id] = !state.openAcc[id];
        V1.render();
      });
    });

    // engine settings — sliders update live (no re-render, keeps thumb focus)
    var mr = app.querySelector("#set-margin");
    if (mr) mr.addEventListener("input", function () { state.engine.margin = parseFloat(mr.value); updateEnginePreview(); });
    var ot = app.querySelector("#set-ot");
    if (ot) ot.addEventListener("input", function () { state.engine.ot = parseFloat(ot.value); updateEnginePreview(); });

    // on-cost percentage fields (live, keep typing focus)
    app.querySelectorAll("[data-oncost]").forEach(function (inp) {
      inp.addEventListener("input", function () {
        var oc = state.engine.onCosts.filter(function (o) { return o.key === inp.getAttribute("data-oncost"); })[0];
        if (oc) { oc.pct = parseFloat(inp.value) || 0; updateEnginePreview(); }
      });
    });
    // on-cost toggles + rounding chips re-render to keep states consistent
    app.querySelectorAll("[data-oncost-on]").forEach(function (sw) {
      sw.addEventListener("change", function () {
        var oc = state.engine.onCosts.filter(function (o) { return o.key === sw.getAttribute("data-oncost-on"); })[0];
        if (oc) { oc.on = sw.checked; V1.render(); }
      });
    });
    app.querySelectorAll("[data-round]").forEach(function (ch) {
      ch.addEventListener("click", function () {
        state.engine.rounding = parseFloat(ch.getAttribute("data-round"));
        V1.render();
      });
    });
  }

  V1.pages.agencies = { id: "agencies", render: render, wire: wire };
})(window.V1);
