/* =====================================================================
   Rate Card — "Preview & fix"  ·  view + interaction layer   v0.90
   ---------------------------------------------------------------------
   Consumes window.RPCore (model/engine/validation) and renders the
   whole screen into #rp-root. Owns its own DOM events (one delegated
   listener) and re-renders its subtree only, so inline edits keep focus
   and the host app shell never re-runs. Navigation + the Continue gate
   are handed back to the wizard via window.Proto.setWizGate.

   IA version: V1.  Everest tokens only.
   ===================================================================== */
(function () {
  "use strict";
  var C = window.RPCore;
  var gbp = C.gbp, r2 = C.r2, esc = C.esc, ico = C.ico, toast = C.toast;

  function nowStr() {
    var d = new Date();
    return "Today, " + String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
  }
  function pct(n) { return (n > 0 ? "+" : n < 0 ? "\u2212" : "") + Math.abs(n).toFixed(1) + "%"; }
  function dmoney(n) { return (n > 0 ? "+" : n < 0 ? "\u2212" : "") + "\u00a3" + Math.abs(n).toFixed(2); }

  var RP = {};
  window.RP = RP;

  // ------------------------------------------------------------------ build
  RP._build = function (opts) {
    var staged = C.validate(C.buildStaged());
    var s = {
      _key: opts.key || "k",
      staged: staged,
      baselines: C.buildBaselines(staged),
      view: "all", groupBy: "supplier", sort: "charge", search: "",
      chip: null, tier: null,
      exp: {}, grpCollapsed: {}, sel: {}, audit: [], showAudit: false,
      baselineId: "v3", diffOnly: true,
      source: opts.source || { name: "Rate_Card.xlsm", ts: nowStr() },
    };
    RP.state = s;
    // collapse clean groups by default; keep groups with errors open
    var groups = RP._groupMap();
    Object.keys(groups).forEach(function (k) {
      var anyErr = groups[k].some(function (L) { return L.status === "error"; });
      if (!anyErr) s.grpCollapsed[k] = true;
    });
  };

  RP.reset = function () { RP.state = null; };

  RP.mount = function (root, opts) {
    opts = opts || {};
    RP._root = root;
    if (!root) return;
    if (!RP.state || RP.state._key !== (opts.key || "k")) RP._build(opts);
    RP._render();
    RP._wireOnce();
  };

  // ------------------------------------------------------------------ data helpers
  function live() { return RP.state.staged.filter(function (L) { return !L.excluded; }); }
  function distinct(arr, f) { var o = {}; arr.forEach(function (x) { o[f(x)] = 1; }); return Object.keys(o); }
  function errIssues() { var n = 0; live().forEach(function (L) { n += L.errCount; }); return n; }
  function warnIssues() { var n = 0; live().forEach(function (L) { n += L.warnCount; }); return n; }
  function blockingLines() { return live().filter(function (L) { return L.hardBlock || L.ackBlock; }); }

  RP._groupKey = function (L) {
    var s = RP.state;
    return s.groupBy === "site" ? L.site : s.groupBy === "jobType" ? L.jobType : L.supplier;
  };
  RP._groupMap = function () {
    var m = {};
    live().forEach(function (L) { (m[RP._groupKey(L)] = m[RP._groupKey(L)] || []).push(L); });
    return m;
  };

  // active filter predicate (chips + tier + search)
  function passFilter(L) {
    var s = RP.state;
    if (s.tier && L.region !== s.tier) return false;
    if (s.chip === "errors" && L.status !== "error") return false;
    if (s.chip === "warnings" && L.warnCount === 0) return false;
    if (s.chip === "missing-margin" && !(L.margin == null || L.margin === "")) return false;
    if (s.chip === "outliers" && !L.issues.some(function (i) { return i.rule === "outlier"; })) return false;
    if (s.chip === "changed") {
      var d = C.diffLine(L, currentBaseline());
      if (d.change === "unchanged") return false;
    }
    if (s.search) {
      var q = s.search.toLowerCase();
      if ((L.supplier + " " + L.site + " " + L.jobType).toLowerCase().indexOf(q) < 0) return false;
    }
    return true;
  }
  function sortLines(arr) {
    var s = RP.state;
    return arr.slice().sort(function (a, b) {
      if (s.sort === "jobType") return a.jobType.localeCompare(b.jobType) || a.site.localeCompare(b.site);
      if (s.sort === "status") { var rank = { error: 0, warning: 1, ok: 2 }; return rank[a.status] - rank[b.status] || (b.charge || 0) - (a.charge || 0); }
      return (b.charge || 0) - (a.charge || 0); // charge desc
    });
  }
  function currentBaseline() {
    var s = RP.state;
    return s.baselines.filter(function (b) { return b.id === s.baselineId; })[0] || s.baselines[0];
  }

  // ------------------------------------------------------------------ top-level view
  RP._view = function () {
    return summaryBar() + toolbar() + (RP.state.showAudit ? auditPanel() : "") +
      (RP.state.view === "compare" ? compareView() : allRatesView());
  };

  RP._render = function () {
    if (!RP._root) return;
    RP._root.innerHTML = '<div class="rp">' + RP._view() + "</div>";
    if (C.P().fillIcons) C.P().fillIcons(RP._root);
    RP._syncGate();
  };

  RP._syncGate = function () {
    var g = RP.gate();
    if (C.P().setWizGate) C.P().setWizGate(g);
  };

  RP.gate = function () {
    var blk = blockingLines();
    var staged = live().length;
    var ok = blk.length === 0;
    var statusHtml = ok
      ? ico("Check") + staged + " rates staged \u00b7 ready to continue"
      : ico("Alert") + staged + " staged \u00b7 " + blk.length + " to fix";
    return { ok: ok, count: blk.length, statusHtml: statusHtml };
  };

  // ------------------------------------------------------------------ summary bar
  function summaryBar() {
    var L = live();
    var sups = distinct(L, function (x) { return x.supplier; }).length;
    var sites = distinct(L, function (x) { return x.site; }).length;
    var jts = distinct(L, function (x) { return x.jobType; }).length;
    var tiers = distinct(L, function (x) { return x.region; });
    var e = errIssues(), w = warnIssues();
    var tierBadges = tiers.map(function (t) { return '<span class="rp-tier">' + esc(t) + "</span>"; }).join("");
    var issues = "";
    if (e) issues += '<button class="rp-issue rp-issue--err" data-rp="chip" data-chip="errors">' + ico("Alert") + "<b>" + e + "</b> " + (e === 1 ? "error" : "errors") + "</button>";
    if (w) issues += '<button class="rp-issue rp-issue--warn" data-rp="chip" data-chip="warnings">' + ico("Flag") + "<b>" + w + "</b> " + (w === 1 ? "warning" : "warnings") + "</button>";
    if (!e && !w) issues += '<span class="rp-issue rp-issue--ok">' + ico("Check") + "No issues</span>";
    return '<div class="rp-summary">' +
      '<div class="rp-summary-counts">' +
        '<span class="rp-sc-big">' + L.length + "</span>" +
        '<span class="rp-sc-lbl">rates staged</span>' +
        '<span class="rp-sc-sep"></span>' +
        '<span class="rp-sc-row"><b>' + sups + "</b> suppliers</span>" +
        '<span class="rp-sc-dot">\u00b7</span><span class="rp-sc-row"><b>' + sites + "</b> sites</span>" +
        '<span class="rp-sc-dot">\u00b7</span><span class="rp-sc-row"><b>' + jts + "</b> job types</span>" +
        '<span class="rp-tier-wrap">' + tierBadges + "</span>" +
      "</div>" +
      '<div class="rp-summary-right">' +
        '<div class="rp-issues">' + issues + "</div>" +
        '<div class="rp-source">' + ico("Excel") + '<span class="rp-source-name">' + esc(RP.state.source.name) + "</span><span class=\"rp-source-ts\">parsed " + esc(RP.state.source.ts) + "</span></div>" +
      "</div>" +
    "</div>";
  }

  // ------------------------------------------------------------------ toolbar
  function seg(active, items) {
    return '<div class="rp-seg">' + items.map(function (it) {
      return '<button class="rp-seg-btn' + (active === it.v ? " is-on" : "") + '" data-rp="' + it.act + '" data-v="' + it.v + '">' + (it.ico ? ico(it.ico) : "") + esc(it.t) + "</button>";
    }).join("") + "</div>";
  }
  function toolbar() {
    var s = RP.state;
    var viewSeg = seg(s.view, [
      { v: "all", t: "All rates", act: "view", ico: "DataGridView" },
      { v: "compare", t: "Compare changes", act: "view", ico: "ArrowsUpDown" },
    ]);
    if (s.view === "compare") {
      // compare toolbar: baseline picker + show-only-changes
      var opts = s.baselines.map(function (b) { return '<option value="' + b.id + '"' + (b.id === s.baselineId ? " selected" : "") + ">" + esc(b.label) + "</option>"; }).join("");
      return '<div class="rp-toolbar">' + viewSeg +
        '<div class="rp-tb-spacer"></div>' +
        '<label class="rp-baseline">' + ico("TimeUndo") + '<span>Compare against</span><select class="rp-select" data-rp="baseline">' + opts + "</select></label>" +
        '<button class="rp-tbtn' + (s.diffOnly ? " is-on" : "") + '" data-rp="diffonly">' + ico(s.diffOnly ? "Check" : "AddCircle") + "Only changes</button>" +
      "</div>";
    }
    var grpSel = '<label class="rp-ctrl">' + ico("DataGridView") + '<span>Group</span><select class="rp-select" data-rp="group">' +
      [["supplier", "Supplier"], ["site", "Site"], ["jobType", "Job type"]].map(function (g) { return '<option value="' + g[0] + '"' + (s.groupBy === g[0] ? " selected" : "") + ">" + g[1] + "</option>"; }).join("") + "</select></label>";
    var srtSel = '<label class="rp-ctrl"><span>Sort</span><select class="rp-select" data-rp="sort">' +
      [["charge", "Charge rate"], ["jobType", "Job type"], ["status", "Status"]].map(function (g) { return '<option value="' + g[0] + '"' + (s.sort === g[0] ? " selected" : "") + ">" + g[1] + "</option>"; }).join("") + "</select></label>";
    var chips = [
      ["errors", "Errors only"], ["missing-margin", "Missing margin"], ["outliers", "Outliers"], ["changed", "Changed vs live"],
    ].map(function (c) { return '<button class="rp-chip' + (s.chip === c[0] ? " is-on" : "") + '" data-rp="chip" data-chip="' + c[0] + '">' + c[1] + "</button>"; }).join("");
    var search = '<label class="rp-search">' + ico("Search") + '<input class="rp-search-in" data-rp="search" placeholder="Search supplier, site, role" value="' + esc(s.search) + '" /></label>';
    return '<div class="rp-toolbar">' + viewSeg +
      '<div class="rp-tb-spacer"></div>' + grpSel + srtSel +
      '<button class="rp-tbtn' + (s.showAudit ? " is-on" : "") + '" data-rp="toggle-audit">' + ico("ClipboardCircleCheck") + "Audit log" + (s.audit.length ? ' <span class="rp-tbtn-badge">' + s.audit.length + "</span>" : "") + "</button>" +
      '<button class="rp-tbtn" data-rp="reset-all">' + ico("Undo") + "Reset to uploaded</button>" +
      "</div>" +
      '<div class="rp-chiprow">' + chips + search + "</div>";
  }

  // ------------------------------------------------------------------ banner
  function banner() {
    var blk = blockingLines();
    if (blk.length) {
      return '<div class="proto-banner proto-banner--error rp-banner">' + ico("Alert") +
        '<div class="bn-text"><b>' + blk.length + " rate" + (blk.length === 1 ? "" : "s") + " need attention before you can continue.</b> Fix the inputs or resolve the mappings below. Nothing goes live until you apply.</div>" +
        '<button class="proto-btn proto-btn--secondary rp-banner-btn" data-rp="chip" data-chip="errors">Review</button></div>';
    }
    var w = warnIssues();
    if (w) {
      return '<div class="proto-banner proto-banner--warning rp-banner">' + ico("Flag") +
        '<div class="bn-text"><b>' + w + " warning" + (w === 1 ? "" : "s") + " to review.</b> These don't block \u2014 confirm, acknowledge or fix the inputs. Charge rates recompute live.</div></div>";
    }
    return '<div class="proto-banner rp-banner">' + ico("Check") + '<div class="bn-text"><b>Every staged rate validates.</b> You can continue to the start date.</div></div>';
  }

  // ------------------------------------------------------------------ bulk bar
  function bulkBar() {
    var ids = Object.keys(RP.state.sel).filter(function (k) { return RP.state.sel[k]; });
    if (!ids.length) return "";
    return '<div class="rp-bulk">' +
      '<span class="rp-bulk-n">' + ids.length + " selected</span>" +
      '<button class="rp-tbtn" data-rp="bulk" data-bulk="levy-on">Set levy included</button>' +
      '<button class="rp-tbtn" data-rp="bulk" data-bulk="levy-off">Set levy excluded</button>' +
      '<button class="rp-tbtn" data-rp="bulk" data-bulk="ack-rounding">Acknowledge rounding</button>' +
      '<button class="rp-tbtn" data-rp="bulk" data-bulk="ack-sel">Acknowledge warnings</button>' +
      '<button class="rp-tbtn" data-rp="bulk" data-bulk="reset-sel">' + ico("Undo") + "Reset</button>" +
      '<button class="rp-tbtn rp-bulk-clear" data-rp="bulk" data-bulk="clear">Clear</button>' +
    "</div>";
  }

  // ------------------------------------------------------------------ ALL RATES view
  var COLS = '<col class="rp-c-sel"/><col class="rp-c-status"/><col/><col/><col class="rp-c-hrs"/><col class="rp-c-num"/><col class="rp-c-num"/><col class="rp-c-num"/><col class="rp-c-charge"/><col class="rp-c-exp"/>';

  function allRatesView() {
    var s = RP.state;
    var groups = RP._groupMap();
    var keys = Object.keys(groups).sort();
    var rows = "";
    var shown = 0;
    keys.forEach(function (k) {
      var members = sortLines(groups[k].filter(passFilter));
      if (!members.length) return;
      shown += members.length;
      var all = groups[k];
      var ge = all.filter(function (L) { return L.status === "error"; }).length;
      var gw = all.reduce(function (a, L) { return a + L.warnCount; }, 0);
      var collapsed = !!s.grpCollapsed[k];
      var badges = "";
      if (ge) badges += '<span class="rp-gb rp-gb--err">' + ge + " error" + (ge === 1 ? "" : "s") + "</span>";
      if (gw) badges += '<span class="rp-gb rp-gb--warn">' + gw + " warning" + (gw === 1 ? "" : "s") + "</span>";
      if (!ge && !gw) badges += '<span class="rp-gb rp-gb--ok">' + ico("Check") + "All clear</span>";
      var avg = r2(all.reduce(function (a, L) { return a + (L.charge || 0); }, 0) / (all.filter(function (L) { return L.charge != null; }).length || 1));
      rows += '<tr class="rp-grp" data-rp="grp" data-grp="' + esc(k) + '">' +
        '<td colspan="10"><div class="rp-grp-row">' +
          '<span class="rp-grp-chev' + (collapsed ? "" : " is-open") + '">' + ico("ChevronRight") + "</span>" +
          (s.groupBy === "site" ? ico("Location", "rp-grp-ic") : s.groupBy === "jobType" ? ico("Tag", "rp-grp-ic") : ico("Building", "rp-grp-ic")) +
          '<span class="rp-grp-name">' + esc(k) + "</span>" +
          '<span class="rp-grp-n">' + all.length + " rates</span>" +
          '<span class="rp-grp-badges">' + badges + "</span>" +
          '<span class="rp-grp-avg">avg ' + gbp(avg) + "</span>" +
        "</div></td></tr>";
      if (!collapsed) members.forEach(function (L) { rows += summaryRow(L); if (s.exp[L.id]) rows += detailRow(L); });
    });
    if (!shown) rows = '<tr><td colspan="10" class="rp-empty">' + ico("Search") + "No rates match the current filter. <button class=\"rp-link\" data-rp=\"clear-filter\">Clear filters</button></td></tr>";

    var head = '<thead><tr>' +
      '<th class="rp-th-sel"><input type="checkbox" data-rp="sel-all" aria-label="Select all" /></th>' +
      "<th>Status</th><th>" + (s.groupBy === "supplier" ? "Site" : "Supplier") + "</th><th>Job type</th>" +
      '<th class="rp-num">Hours</th><th class="rp-num">Net pay</th><th class="rp-num">On-costs</th><th class="rp-num">Margin</th>' +
      '<th class="rp-num rp-th-charge">Charge rate</th><th></th></tr></thead>';
    return banner() + bulkBar() +
      '<div class="rp-tablewrap"><table class="rp-table"><colgroup>' + COLS + "</colgroup>" + head + "<tbody>" + rows + "</tbody></table></div>";
  }

  function statusDot(L) {
    var t = L.status === "error" ? "Error" : L.status === "warning" ? "Warning" : "OK";
    var n = L.errCount + L.warnCount;
    return '<span class="rp-dot rp-dot--' + L.status + '" title="' + t + '"></span>' + (n ? '<span class="rp-dot-n">' + n + "</span>" : "");
  }
  function tierBadge(L) { return '<span class="rp-tier rp-tier--mini">' + esc(L.region) + "</span>"; }

  function summaryRow(L) {
    var s = RP.state;
    var keyCell = s.groupBy === "supplier" ? (esc(L.site) + " " + tierBadge(L)) : s.groupBy === "site" ? esc(L.supplier) : esc(L.supplier);
    var onCost = r2((L.wtr || 0) + (L.eni || 0) + (L.pen || 0) + (L.levy || 0) + (L.sick || 0));
    var edited = L.edited ? '<span class="rp-edited" title="Edited on this screen">' + ico("Edit") + "edited</span>" : "";
    var jt = esc(L.jobType) + (s.groupBy === "jobType" ? "" : "") ;
    return '<tr class="rp-row rp-row--' + L.status + (s.exp[L.id] ? " is-open" : "") + '" data-rp="expand" data-id="' + L.id + '">' +
      '<td class="rp-td-sel"><input type="checkbox" data-rp="sel" data-id="' + L.id + '"' + (s.sel[L.id] ? " checked" : "") + ' aria-label="Select row" /></td>' +
      '<td class="rp-td-status">' + statusDot(L) + "</td>" +
      "<td>" + (s.groupBy === "site" ? (esc(L.supplier)) : s.groupBy === "jobType" ? esc(L.supplier) : (esc(L.site) + " " + tierBadge(L))) + "</td>" +
      '<td class="rp-td-jt">' + jt + " " + edited + "</td>" +
      '<td class="rp-num" data-rp-cell="hrs:' + L.id + '">' + L.hrs + "</td>" +
      '<td class="rp-num">' + gbp(L.net) + "</td>" +
      '<td class="rp-num" data-rp-cell="oncost:' + L.id + '">' + gbp(onCost) + "</td>" +
      '<td class="rp-num" data-rp-cell="margin:' + L.id + '">' + (L.margin == null ? '<span class="rp-missing">\u2014</span>' : gbp(L.margin)) + "</td>" +
      '<td class="rp-num rp-td-charge" data-rp-cell="charge:' + L.id + '">' + (L.charge == null ? '<span class="rp-missing">invalid</span>' : "<b>" + gbp(L.charge) + "</b>") + "</td>" +
      '<td class="rp-td-exp"><span class="rp-exp-chev' + (s.exp[L.id] ? " is-open" : "") + '">' + ico("ChevronDown") + "</span></td>" +
    "</tr>";
  }

  // tier-tagged waterfall + inline editors
  function tierChip(t) {
    var cls = t === "Reference" ? "ref" : t === "Engine" ? "eng" : t === "Agency" ? "agy" : "mix";
    return '<span class="rp-tchip rp-tchip--' + cls + '">' + esc(t) + "</span>";
  }
  function wfLine(label, valHtml, tier, param, opts) {
    opts = opts || {};
    return '<div class="rp-wf-line' + (opts.total ? " rp-wf-total" : "") + (opts.sum ? " rp-wf-sum" : "") + (opts.warn ? " rp-wf-warn" : "") + '">' +
      '<span class="rp-wf-label">' + label + "</span>" +
      '<span class="rp-wf-val">' + valHtml + "</span>" +
      tierChip(tier) +
      '<span class="rp-wf-param">' + param + "</span>" +
    "</div>";
  }
  function numIn(id, field, val, step, suffix) {
    return '<span class="rp-inwrap"><input class="rp-num-in" type="number" step="' + step + '" data-rp="edit" data-id="' + id + '" data-field="' + field + '" value="' + (val == null ? "" : val) + '" />' + (suffix ? '<span class="rp-in-suffix">' + suffix + "</span>" : "") + "</span>";
  }

  function detailRow(L) {
    var issuesHtml = L.issues.length ? '<div class="rp-issue-list">' + L.issues.map(function (i) {
      return '<div class="rp-issue-item rp-issue-item--' + i.sev + '">' + ico(i.sev === "error" ? "Alert" : "Flag") + '<span>' + i.msg + "</span></div>";
    }).join("") + resolveActions(L) + "</div>" : "";

    var wf =
      wfLine("Net pay", gbp(L.net), "Reference", esc(L.site) + " \u00b7 " + esc(L.region) + " \u00b7 " + (C.isParity(L.jobType) ? "Post-parity" : "Standard")) +
      wfLine("+ WTR / holiday", '<span data-rp-cell="wtr:' + L.id + '">' + gbp(L.wtr) + "</span>", "Engine", (L.wtrPct || 12.07).toFixed(2) + "%") +
      wfLine("+ Employer's NI", '<span data-rp-cell="eni:' + L.id + '">' + gbp(L.eni) + "</span>", "Engine", "15% above \u00a396/wk over " + '<span data-rp-cell="hrslbl:' + L.id + '">' + L.hrs + "</span>h") +
      wfLine("+ Pension", numIn(L.id, "penPct", L.penPct.toFixed(2), "0.01", "%") + ' <span class="rp-wf-eq" data-rp-cell="pen:' + L.id + '">' + gbp(L.pen) + "</span>", "Engine \u00d7 Agency", "agency rate", { warn: L.issues.some(function (i) { return i.rule === "pension-deviation"; }) }) +
      wfLine("+ Apprenticeship levy", levyToggle(L) + ' <span class="rp-wf-eq" data-rp-cell="levy:' + L.id + '">' + gbp(L.levy) + "</span>", "Engine \u00d7 Agency", "0.5% of paybill") +
      wfLine("+ Sick pay", numIn(L.id, "sick", L.sick, "0.01", "\u00a3"), "Agency", "agency accrual") +
      wfLine("= Direct cost", '<b data-rp-cell="direct:' + L.id + '">' + gbp(L.direct) + "</b>", "Engine", "roll-up", { sum: true }) +
      wfLine("+ Margin", numIn(L.id, "margin", L.margin, "0.01", "\u00a3"), "Agency", "agency margin") +
      wfLine("= Charge rate", '<b data-rp-cell="wfcharge:' + L.id + '">' + (L.charge == null ? "\u2014" : gbp(L.charge)) + "</b>", "Engine", "direct + margin", { total: true });

    var hoursCtl = '<div class="rp-edit-row"><span class="rp-edit-lbl">Weekly hours</span>' + numIn(L.id, "hrs", L.hrs, "0.5", "h") + '<span class="rp-edit-note">net pay is read-only \u2014 correct it in the source file</span></div>';

    return '<tr class="rp-detail"><td colspan="10"><div class="rp-detail-inner">' +
      issuesHtml +
      '<div class="rp-detail-grid">' +
        '<div class="rp-wf"><div class="rp-wf-head">Rate waterfall' + (L.edited ? ' <button class="rp-link" data-rp="reset-row" data-id="' + L.id + '">' + ico("Undo") + "reset row</button>" : "") + "</div>" + wf + "</div>" +
        '<div class="rp-edit"><div class="rp-edit-head">Editable inputs</div>' + hoursCtl +
          '<p class="rp-edit-hint">Edit the agency config and mappings here. Charge rates recompute live against the standard engine formula; the live version is never touched.</p>' +
        "</div>" +
      "</div>" +
    "</div></td></tr>";
  }

  function levyToggle(L) {
    return '<button class="rp-levy' + (L.levyIncluded ? " is-on" : "") + '" data-rp="edit-levy" data-id="' + L.id + '">' + ico(L.levyIncluded ? "Check" : "X") + (L.levyIncluded ? "Included" : "Excluded") + "</button>";
  }

  function resolveActions(L) {
    var btns = "";
    if (L.issues.some(function (i) { return i.rule === "unmatched-site"; })) {
      btns += '<label class="rp-map">Map site to <select class="rp-select" data-rp="map" data-id="' + L.id + '" data-mapfield="site"><option value="">choose\u2026</option>' +
        C.REF_SITES.map(function (x) { return '<option value="' + esc(x) + '">' + esc(x) + "</option>"; }).join("") + "</select></label>";
    }
    if (L.issues.some(function (i) { return i.rule === "unmatched-jt"; })) {
      btns += '<label class="rp-map">Map job type to <select class="rp-select" data-rp="map" data-id="' + L.id + '" data-mapfield="jobType"><option value="">choose\u2026</option>' +
        C.REF_JOBTYPES.map(function (x) { return '<option value="' + esc(x) + '">' + esc(x) + "</option>"; }).join("") + "</select></label>";
    }
    if (L.ackBlock) {
      btns += '<button class="proto-btn proto-btn--secondary rp-mini" data-rp="ack" data-id="' + L.id + '">' + ico("Check") + "Acknowledge &amp; keep</button>";
      btns += '<button class="proto-btn proto-btn--ghost rp-mini" data-rp="excl" data-id="' + L.id + '">' + ico("TrashCan") + "Exclude row</button>";
    }
    return btns ? '<div class="rp-resolve">' + btns + "</div>" : "";
  }

  // ------------------------------------------------------------------ COMPARE view
  function compareView() {
    var s = RP.state;
    var base = currentBaseline();
    var rowsData = [];
    var newN = 0, chgN = 0, remN = 0, sumPct = 0, sumCount = 0, mover = null;
    // staged → new/changed/unchanged
    live().forEach(function (L) {
      var d = C.diffLine(L, base);
      if (d.change === "new") newN++;
      else if (d.change === "changed") { chgN++; var dl = r2(L.charge - d.old); var dp = d.old ? (dl / d.old * 100) : 0; sumPct += dp; sumCount++; if (!mover || Math.abs(dl) > Math.abs(mover.dl)) mover = { L: L, dl: dl }; }
      if (d.change === "unchanged" && s.diffOnly) return;
      rowsData.push({ L: L, d: d, kind: d.change });
    });
    // removed: baseline keys not present in staged
    var stagedKeys = {}; live().forEach(function (L) { stagedKeys[L.supplier + "|" + L.site + "|" + L.jobType] = 1; });
    Object.keys(base.map).forEach(function (k) {
      if (!stagedKeys[k]) { remN++; rowsData.push({ removed: base.map[k], kind: "removed" }); }
    });

    var avg = sumCount ? r2(sumPct / sumCount) : 0;
    var strip = '<div class="rp-strip">' +
      '<span class="rp-strip-seg"><b>' + chgN + "</b> changed</span>" +
      '<span class="rp-strip-seg rp-strip--new"><b>' + newN + "</b> new</span>" +
      '<span class="rp-strip-seg rp-strip--rem"><b>' + remN + "</b> removed</span>" +
      '<span class="rp-sc-dot">\u00b7</span><span class="rp-strip-seg">avg \u0394 <b class="' + (avg >= 0 ? "rp-up" : "rp-down") + '">' + pct(avg) + "</b></span>" +
      (mover ? '<span class="rp-sc-dot">\u00b7</span><span class="rp-strip-seg">largest mover <b>' + esc(mover.L.supplier) + " / " + esc(mover.L.site) + " " + esc(mover.L.jobType) + "</b> <span class=\"" + (mover.dl >= 0 ? "rp-up" : "rp-down") + "\">" + dmoney(mover.dl) + "</span></span>" : "") +
    "</div>";

    // sort: changed by |Δ| desc, then new, then removed
    rowsData.sort(function (a, b) {
      var rank = { changed: 0, new: 1, removed: 2 };
      if (rank[a.kind] !== rank[b.kind]) return rank[a.kind] - rank[b.kind];
      var da = a.d ? Math.abs((a.L.charge || 0) - (a.d.old || 0)) : 0;
      var db = b.d ? Math.abs((b.L.charge || 0) - (b.d.old || 0)) : 0;
      return db - da;
    });

    var body = rowsData.map(cmpRow).join("");
    if (!body) body = '<tr><td colspan="8" class="rp-empty">' + ico("Check") + "No differences against " + esc(base.label) + ".</td></tr>";

    var head = '<thead><tr><th>Change</th><th>Supplier \u00b7 site \u00b7 job type</th>' +
      '<th class="rp-num">Old rate</th><th class="rp-num">New rate</th><th class="rp-num">\u0394 \u00a3</th><th class="rp-num">\u0394 %</th><th>What changed</th><th></th></tr></thead>';
    return strip + '<div class="rp-tablewrap"><table class="rp-table rp-table--cmp"><colgroup><col class="rp-c-chg"/><col/><col class="rp-c-num"/><col class="rp-c-num"/><col class="rp-c-num"/><col class="rp-c-num"/><col/><col class="rp-c-exp"/></colgroup>' + head + "<tbody>" + body + "</tbody></table></div>";
  }

  function chgChip(kind) {
    var map = { changed: ["chg", "Changed"], new: ["new", "New"], removed: ["rem", "Removed"], unchanged: ["unc", "Unchanged"] };
    var m = map[kind] || map.unchanged;
    return '<span class="rp-chgchip rp-chgchip--' + m[0] + '">' + m[1] + "</span>";
  }
  function cmpRow(rd) {
    var s = RP.state;
    if (rd.kind === "removed") {
      var b = rd.removed;
      return '<tr class="rp-row rp-row--rem"><td>' + chgChip("removed") + "</td>" +
        "<td>" + esc(b.supplier) + " \u00b7 " + esc(b.site) + " \u00b7 " + esc(b.jobType) + "</td>" +
        '<td class="rp-num">' + gbp(b.charge) + '</td><td class="rp-num rp-muted">\u2014</td><td class="rp-num rp-muted">\u2014</td><td class="rp-num rp-muted">\u2014</td>' +
        '<td><span class="rp-attr rp-attr--down">Removed from upload</span></td><td></td></tr>';
    }
    var L = rd.L, d = rd.d;
    var open = s.exp["cmp-" + L.id];
    var dl = d.old != null && L.charge != null ? r2(L.charge - d.old) : null;
    var dp = (d.old && dl != null) ? (dl / d.old * 100) : null;
    var attr = (rd.kind === "new") ? [{ k: "new", t: "New mapping" }] : C.diffAttribution(L, d.b);
    var attrHtml = attr.map(function (a) { return '<span class="rp-attr rp-attr--' + a.k + '">' + esc(a.t) + "</span>"; }).join("");
    var row = '<tr class="rp-row rp-row--' + rd.kind + (open ? " is-open" : "") + '" data-rp="expand-cmp" data-id="' + L.id + '">' +
      "<td>" + chgChip(rd.kind) + "</td>" +
      "<td>" + esc(L.supplier) + " \u00b7 " + esc(L.site) + " \u00b7 " + esc(L.jobType) + " " + tierBadge(L) + "</td>" +
      '<td class="rp-num">' + (d.old == null ? '<span class="rp-muted">\u2014</span>' : gbp(d.old)) + "</td>" +
      '<td class="rp-num"><b>' + (L.charge == null ? "\u2014" : gbp(L.charge)) + "</b></td>" +
      '<td class="rp-num ' + (dl > 0 ? "rp-up" : dl < 0 ? "rp-down" : "") + '">' + (dl == null ? '<span class="rp-muted">\u2014</span>' : (dl > 0 ? ico("ArrowUpSmall") : dl < 0 ? ico("ArrowDownSmall") : "") + dmoney(dl)) + "</td>" +
      '<td class="rp-num ' + (dp > 0 ? "rp-up" : dp < 0 ? "rp-down" : "") + '">' + (dp == null ? '<span class="rp-muted">\u2014</span>' : pct(dp)) + "</td>" +
      "<td>" + attrHtml + "</td>" +
      '<td class="rp-td-exp"><span class="rp-exp-chev' + (open ? " is-open" : "") + '">' + ico("ChevronDown") + "</span></td></tr>";
    if (open) row += cmpDetail(L, d);
    return row;
  }
  function cmpDetail(L, d) {
    var b = d.b;
    function side(title, vals, moved) {
      return '<div class="rp-cmpcol"><div class="rp-cmpcol-head">' + title + "</div>" +
        ["net|Net pay", "wtr|WTR", "eni|Employer NI", "pen|Pension", "levy|Levy", "sick|Sick", "direct|Direct cost", "margin|Margin", "charge|Charge rate"].map(function (row) {
          var f = row.split("|"); var key = f[0];
          var hi = moved && moved.indexOf(key) >= 0;
          return '<div class="rp-cmprow' + (hi ? " is-moved" : "") + (key === "charge" ? " rp-cmprow--total" : key === "direct" ? " rp-cmprow--sum" : "") + '"><span>' + f[1] + "</span><span>" + (vals[key] == null ? "\u2014" : gbp(vals[key])) + "</span></div>";
        }).join("") + "</div>";
    }
    // recompute old side fully
    var oldVals = null, moved = [];
    if (b) {
      var t = { net: b.net, hrs: b.hrs, penPct: b.penPct, levyIncluded: b.levyIncluded, levy: b.levyIncluded ? 0.07 : 0, sick: b.sick, jobType: L.jobType, margin: b.margin, _levyDirty: false };
      C.recompute(t);
      oldVals = { net: b.net, wtr: t.wtr, eni: t.eni, pen: t.pen, levy: t.levy, sick: t.sick, direct: t.direct, margin: b.margin, charge: t.charge };
      ["net", "wtr", "eni", "pen", "levy", "sick", "direct", "margin", "charge"].forEach(function (k) {
        var nv = (k === "charge") ? L.charge : (k === "direct") ? L.direct : L[k];
        if (Math.abs((oldVals[k] || 0) - (nv || 0)) >= 0.005) moved.push(k);
      });
    }
    var newVals = { net: L.net, wtr: L.wtr, eni: L.eni, pen: L.pen, levy: L.levy, sick: L.sick, direct: L.direct, margin: L.margin, charge: L.charge };
    return '<tr class="rp-detail"><td colspan="8"><div class="rp-detail-inner"><div class="rp-cmpwf">' +
      (oldVals ? side("Old \u00b7 " + esc(currentBaseline().label), oldVals, moved) : '<div class="rp-cmpcol rp-cmpcol--empty">New rate \u2014 no prior version</div>') +
      '<div class="rp-cmparrow">' + ico("ArrowRight") + "</div>" +
      side("New \u00b7 staged", newVals, moved) +
    "</div></div></td></tr>";
  }

  // ------------------------------------------------------------------ audit panel
  function auditPanel() {
    var a = RP.state.audit;
    var rows = a.length ? a.slice().reverse().map(function (e) {
      return '<div class="rp-audit-row"><span class="rp-audit-time">' + esc(e.time) + "</span>" +
        '<span class="rp-audit-key">' + esc(e.key) + "</span>" +
        '<span class="rp-audit-field">' + esc(e.field) + "</span>" +
        '<span class="rp-audit-change">' + esc(e.from) + " \u2192 " + esc(e.to) + "</span>" +
        '<span class="rp-audit-who"><span class="rp-audit-av">DE</span>' + esc(e.who) + "</span></div>";
    }).join("") : '<div class="rp-audit-empty">No edits yet. Changes you make to margin, pension, hours, sick pay, levy or mappings are logged here.</div>';
    return '<div class="rp-audit"><div class="rp-audit-head">' + ico("ClipboardCircleCheck") + "Audit log <span class=\"rp-audit-n\">" + a.length + " change" + (a.length === 1 ? "" : "s") + "</span>" +
      '<button class="rp-audit-x" data-rp="toggle-audit" aria-label="Close audit">' + ico("X") + "</button></div>" +
      '<div class="rp-audit-body">' + rows + "</div></div>";
  }

  // ------------------------------------------------------------------ mutations
  function lineById(id) { return RP.state.staged.filter(function (L) { return L.id === id; })[0]; }
  function logAudit(L, field, from, to) {
    RP.state.audit.push({ time: nowStr(), key: L.supplier + " \u00b7 " + L.site + " \u00b7 " + L.jobType, field: field, from: String(from), to: String(to), who: "Dominic Esposito" });
  }
  function revalidate() { C.validate(RP.state.staged); }

  // patch the computed cells of one row without a full re-render (keeps focus)
  function patchRow(L) {
    var root = RP._root;
    function set(cell, html) { var el = root.querySelector('[data-rp-cell="' + cell + ':' + L.id + '"]'); if (el) el.innerHTML = html; }
    var onCost = r2((L.wtr || 0) + (L.eni || 0) + (L.pen || 0) + (L.levy || 0) + (L.sick || 0));
    set("hrs", L.hrs); set("hrslbl", L.hrs);
    set("oncost", gbp(onCost));
    set("margin", L.margin == null ? '<span class="rp-missing">\u2014</span>' : gbp(L.margin));
    set("charge", L.charge == null ? '<span class="rp-missing">invalid</span>' : "<b>" + gbp(L.charge) + "</b>");
    set("wtr", gbp(L.wtr)); set("eni", gbp(L.eni)); set("pen", gbp(L.pen)); set("levy", gbp(L.levy));
    set("direct", gbp(L.direct)); set("wfcharge", L.charge == null ? "\u2014" : gbp(L.charge));
  }

  function applyEdit(L, field, raw, opts) {
    opts = opts || {};
    var num = field === "levyIncluded" ? raw : (raw === "" || raw == null ? (field === "margin" ? null : 0) : parseFloat(raw));
    var from = field === "penPct" ? L.penPct.toFixed(2) + "%" : (L[field] == null ? "\u2014" : (field === "hrs" ? L[field] + "h" : gbp(L[field])));
    if (field === "hrs") { L.hrs = num || L.hrs; }
    else if (field === "penPct") { L.penPct = isNaN(num) ? L.penPct : num; }
    else if (field === "sick") { L.sick = isNaN(num) ? 0 : num; L.sickBlank = false; }
    else if (field === "margin") { L.margin = (raw === "" || raw == null || isNaN(num)) ? null : num; }
    C.recompute(L);
    L.edited = isEdited(L);
    if (opts.commit) {
      var to = field === "penPct" ? L.penPct.toFixed(2) + "%" : (L[field] == null ? "\u2014" : (field === "hrs" ? L[field] + "h" : gbp(L[field])));
      if (from !== to) logAudit(L, fieldLabel(field), from, to);
    }
    return L;
  }
  function fieldLabel(f) { return { margin: "Margin", penPct: "Pension %", hrs: "Weekly hours", sick: "Sick pay", levyIncluded: "Levy included" }[f] || f; }
  function isEdited(L) {
    var o = L.orig;
    return L.hrs !== o.hrs || Math.abs(L.penPct - o.penPct) >= 0.005 || Math.abs((L.sick || 0) - (o.sick || 0)) >= 0.005 || L.levyIncluded !== o.levyIncluded || (L.margin || 0) !== (o.margin || 0);
  }
  function resetRow(L) {
    var o = L.orig;
    L.hrs = o.hrs; L.penPct = o.penPct; L.sick = o.sick; L.levyIncluded = o.levyIncluded; L.levy = o.levy; L.margin = o.margin; L._levyDirty = false; L.edited = false;
    C.recompute(L);
  }

  // ------------------------------------------------------------------ events (one delegated listener)
  RP._wireOnce = function () {
    if (RP._wired) return; RP._wired = true;
    document.addEventListener("click", function (ev) {
      var root = RP._root; if (!root) return;
      var t = ev.target.closest("[data-rp]"); if (!t || !root.contains(t)) return;
      var act = t.getAttribute("data-rp");
      var s = RP.state; if (!s) return;
      // selection checkbox handled on change, not click; ignore here
      if (act === "sel" || act === "sel-all" || act === "edit" || act === "search" || act === "group" || act === "sort" || act === "baseline" || act === "map") return;
      var id = t.getAttribute("data-id");
      switch (act) {
        case "view": s.view = t.getAttribute("data-v"); RP._render(); break;
        case "diffonly": s.diffOnly = !s.diffOnly; RP._render(); break;
        case "chip": { var c = t.getAttribute("data-chip"); s.chip = (s.chip === c ? null : c); RP._render(); break; }
        case "clear-filter": s.chip = null; s.tier = null; s.search = ""; RP._render(); break;
        case "toggle-audit": s.showAudit = !s.showAudit; RP._render(); break;
        case "reset-all": s.staged.forEach(resetRow); s.staged.forEach(function (L) { L.excluded = false; L.acked = false; if (L.mapping) L.mapping = { site: null, jobType: null }; }); s.audit.push({ time: nowStr(), key: "All rows", field: "Reset", from: "edited", to: "uploaded", who: "Dominic Esposito" }); revalidate(); RP._render(); toast("Reset to the uploaded values"); break;
        case "grp": { var k = t.getAttribute("data-grp"); s.grpCollapsed[k] = !s.grpCollapsed[k]; RP._render(); break; }
        case "expand": if (id) { s.exp[id] = !s.exp[id]; RP._render(); } break;
        case "expand-cmp": if (id) { s.exp["cmp-" + id] = !s.exp["cmp-" + id]; RP._render(); } break;
        case "edit-levy": { var L = lineById(id); if (L) { var from = L.levyIncluded ? "Included" : "Excluded"; L.levyIncluded = !L.levyIncluded; L._levyDirty = true; C.recompute(L); L.edited = isEdited(L); logAudit(L, "Levy included", from, L.levyIncluded ? "Included" : "Excluded"); revalidate(); RP._render(); } break; }
        case "ack": { var La = lineById(id); if (La) { La.acked = true; revalidate(); RP._render(); toast("Row acknowledged"); } break; }
        case "excl": { var Le = lineById(id); if (Le) { Le.excluded = true; delete s.sel[id]; revalidate(); RP._render(); toast("Row excluded from staging"); } break; }
        case "reset-row": { var Lr = lineById(id); if (Lr) { resetRow(Lr); s.audit.push({ time: nowStr(), key: Lr.supplier + " \u00b7 " + Lr.site + " \u00b7 " + Lr.jobType, field: "Reset", from: "edited", to: "uploaded", who: "Dominic Esposito" }); revalidate(); RP._render(); } break; }
        case "bulk": bulk(t.getAttribute("data-bulk")); break;
        default: break;
      }
    });

    // change (selects, checkboxes, committing number edits)
    document.addEventListener("change", function (ev) {
      var root = RP._root; if (!root) return;
      var t = ev.target.closest("[data-rp]"); if (!t || !root.contains(t)) return;
      var act = t.getAttribute("data-rp"); var s = RP.state; if (!s) return;
      if (act === "sel") { var id = t.getAttribute("data-id"); s.sel[id] = t.checked; RP._render(); }
      else if (act === "sel-all") { var checked = t.checked; live().filter(passFilter).forEach(function (L) { s.sel[L.id] = checked; }); RP._render(); }
      else if (act === "group") { s.groupBy = t.value; s.grpCollapsed = {}; RP._render(); }
      else if (act === "sort") { s.sort = t.value; RP._render(); }
      else if (act === "baseline") { s.baselineId = t.value; RP._render(); }
      else if (act === "diffonly") { /* button */ }
      else if (act === "map") {
        var Lm = lineById(t.getAttribute("data-id")); var mf = t.getAttribute("data-mapfield");
        if (Lm && t.value) { Lm.mapping[mf] = t.value; logAudit(Lm, "Map " + mf, mf === "site" ? Lm.site : Lm.jobType, t.value); revalidate(); RP._render(); toast("Mapping resolved"); }
      }
      else if (act === "edit") {
        var Le = lineById(t.getAttribute("data-id"));
        if (Le) { applyEdit(Le, t.getAttribute("data-field"), t.value, { commit: true }); revalidate(); RP._render(); }
      }
    });

    // live input — patch numbers without re-render to keep focus
    document.addEventListener("input", function (ev) {
      var root = RP._root; if (!root) return;
      var t = ev.target.closest("[data-rp]"); if (!t || !root.contains(t)) return;
      var act = t.getAttribute("data-rp"); var s = RP.state; if (!s) return;
      if (act === "edit") {
        var Le = lineById(t.getAttribute("data-id"));
        if (Le) { applyEdit(Le, t.getAttribute("data-field"), t.value, { commit: false }); patchRow(Le); }
      } else if (act === "search") {
        s.search = t.value; RP._render();
        var inp = RP._root.querySelector(".rp-search-in"); if (inp) { inp.focus(); var v = inp.value; inp.value = ""; inp.value = v; }
      }
    });
  };

  function bulk(kind) {
    var s = RP.state;
    var ids = Object.keys(s.sel).filter(function (k) { return s.sel[k]; });
    if (kind === "clear") { s.sel = {}; RP._render(); return; }
    var n = 0;
    ids.forEach(function (id) {
      var L = lineById(id); if (!L) return;
      if (kind === "levy-on" && !L.levyIncluded) { L.levyIncluded = true; L._levyDirty = true; C.recompute(L); L.edited = isEdited(L); logAudit(L, "Levy included", "Excluded", "Included"); n++; }
      else if (kind === "levy-off" && L.levyIncluded) { L.levyIncluded = false; L._levyDirty = true; C.recompute(L); L.edited = isEdited(L); logAudit(L, "Levy included", "Included", "Excluded"); n++; }
      else if (kind === "ack-rounding") { if (L.issues.some(function (i) { return i.rule === "rounding"; })) { L._ackRounding = true; n++; } }
      else if (kind === "ack-sel") { L.acked = true; n++; }
      else if (kind === "reset-sel") { resetRow(L); n++; }
    });
    if (kind === "ack-rounding") { // drop rounding warnings on acked rows
      s.staged.forEach(function (L) { if (L._ackRounding) L.issues = L.issues.filter(function (i) { return i.rule !== "rounding"; }); });
    }
    revalidate();
    // re-apply rounding ack after revalidate
    if (kind === "ack-rounding") s.staged.forEach(function (L) { if (L._ackRounding) { L.issues = L.issues.filter(function (i) { return i.rule !== "rounding"; }); L.warnCount = L.issues.filter(function (i) { return i.sev === "warning"; }).length; L.status = L.errCount ? "error" : L.warnCount ? "warning" : "ok"; } });
    RP._render();
    toast(n + " row" + (n === 1 ? "" : "s") + " updated");
  }
})();
