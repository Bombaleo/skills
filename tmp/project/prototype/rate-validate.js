/* =====================================================================
   Rate Card — "② Validate"  ·  view + interaction layer   v0.92
   ---------------------------------------------------------------------
   Spec §6. Consumes window.RPCore (model/engine/validation) and renders
   the Validate screen into #rv-root:
     A · How we organized your data   (classification + mapping + skipped)
     B · Resolve before continuing    (⛔ blockers · ❓ confirmations)
     C · What this upload will change  (+new ~changed −removed + per-row diff)
   Owns one delegated listener; re-renders its own subtree so inline
   fixes keep the host shell still. The Continue gate is handed back to
   the wizard via window.Proto.setWizGate.

   Severity mapping onto RPCore issues (spec §10):
     · Blocker      = any sev:"error" issue (must resolve)
     · Confirmation = warning rules {levy-inconsistent, sick-blank} (answer, defaulted)
     · Warning      = all other warnings (review, non-blocking)

   IA version: V1.  Everest tokens only.
   ===================================================================== */
(function () {
  "use strict";
  var C = window.RPCore;
  if (!C) return;
  var gbp = C.gbp, r2 = C.r2, esc = C.esc, ico = C.ico, toast = C.toast;

  var CONF_RULES = { "levy-inconsistent": 1, "sick-blank": 1 };

  function dmoney(n) { return (n > 0 ? "+" : n < 0 ? "\u2212" : "") + "\u00a3" + Math.abs(n).toFixed(2); }
  function pct(n) { return (n > 0 ? "+" : n < 0 ? "\u2212" : "") + Math.abs(n).toFixed(1) + "%"; }
  function plural(n, w) { return n + " " + w + (n === 1 ? "" : "s"); }
  function rowId(L) { return esc(L.supplier) + " \u00b7 " + esc(L.site) + " \u00b7 " + esc(L.jobType); }

  var RV = {};
  window.RV = RV;

  // ------------------------------------------------------------------ build
  RV._build = function (opts) {
    var staged = C.validate(C.buildStaged());
    RV.state = {
      _key: opts.key || "k",
      staged: staged,
      baselines: C.buildBaselines(staged),
      baselineId: (C.buildBaselines(staged)[0] || {}).id || "v3",
      confirmed: {},                       // confirmation key -> chosen value
      exp: { mapping: false, skipped: false, diff: false },
      source: opts.source || { name: "Rate_Card.xlsm", ts: "just now" },
    };
  };
  RV.reset = function () { RV.state = null; };

  RV.mount = function (root, opts) {
    opts = opts || {};
    RV._root = root;
    if (!root) return;
    if (!RV.state || RV.state._key !== (opts.key || "k")) RV._build(opts);
    else if (opts.source) RV.state.source = opts.source;
    RV._render();
    RV._wireOnce();
  };

  // ------------------------------------------------------------------ data
  function live() { return RV.state.staged.filter(function (L) { return !L.excluded; }); }
  function currentBaseline() {
    var s = RV.state, bs = s.baselines;
    return bs.filter(function (b) { return b.id === s.baselineId; })[0] || bs[0];
  }

  // Split the validated issues into blockers / confirmations / warnings.
  function classify() {
    var blockers = [], confMap = {}, warnN = 0;
    live().forEach(function (L) {
      var errs = L.issues.filter(function (i) { return i.sev === "error"; });
      if (errs.length) blockers.push({ L: L, issues: errs, rule: errs[0].rule });
      L.issues.forEach(function (i) {
        if (i.sev !== "warning") return;
        if (i.rule === "levy-inconsistent") { var k = "levy|" + L.supplier; (confMap[k] = confMap[k] || { key: k, rule: i.rule, supplier: L.supplier, lines: [] }).lines.push(L); }
        else if (i.rule === "sick-blank") { var k2 = "sick|all"; (confMap[k2] = confMap[k2] || { key: k2, rule: i.rule, lines: [] }).lines.push(L); }
        else warnN++;
      });
    });
    var confs = Object.keys(confMap).map(function (k) { return confMap[k]; });
    return { blockers: blockers, confs: confs, warnN: warnN };
  }

  function diffStats() {
    var base = currentBaseline(), liveKeys = {}, nw = 0, ch = 0, rm = 0;
    live().forEach(function (L) {
      var key = L.supplier + "|" + L.site + "|" + L.jobType; liveKeys[key] = 1;
      var d = C.diffLine(L, base);
      if (d.change === "new") nw++; else if (d.change === "changed") ch++;
    });
    Object.keys(base.map).forEach(function (k) { if (!liveKeys[k]) rm++; });
    return { nw: nw, ch: ch, rm: rm, base: base };
  }

  function gateCounts() {
    var c = classify();
    var unconf = c.confs.filter(function (x) { return !RV.state.confirmed[x.key]; }).length;
    return { blockers: c.blockers.length, unconf: unconf, warn: c.warnN, confs: c.confs.length };
  }

  RV.gate = function () {
    if (!RV.state) return { ok: true, statusHtml: ico("Check") + "Ready to continue" };
    var g = gateCounts();
    if (g.blockers) return { ok: false, statusHtml: ico("Alert") + plural(g.blockers, "blocker") + " to resolve" };
    if (g.unconf) return { ok: false, statusHtml: ico("Information") + plural(g.unconf, "confirmation") + " to answer" };
    return { ok: true, statusHtml: ico("Check") + "Data sound \u2014 ready for the rate model" };
  };

  // ------------------------------------------------------------------ render
  RV._render = function () {
    if (!RV._root) return;
    var s = RV.state, c = classify(), g = gateCounts(), rates = live().length;
    RV._root.innerHTML =
      summaryBanner(rates, g) +
      blockA() +
      blockB(c) +
      blockC();
    if (window.Proto) window.Proto.fillIcons(RV._root);
    if (window.Proto) window.Proto.setWizGate(RV.gate());
  };

  function sevPill(kind, n, label) {
    var ic = kind === "fix" ? "Alert" : kind === "confirm" ? "Help" : "Information";
    return '<span class="rv-sev rv-sev--' + kind + (n ? "" : " is-zero") + '">' + ico(ic) + '<b>' + n + '</b> ' + label + '</span>';
  }

  function summaryBanner(rates, g) {
    var s = RV.state;
    return '<div class="rv-summary">' +
      '<div class="rv-summary-read">' + ico("Check") +
        '<div><div class="rv-read-t">We read ' + plural(rates, "rate") + ' from ' + esc(s.source.name) + '</div>' +
        '<div class="rv-read-s">Recomputed with the standardized engine and diffed against the current live version \u00b7 ' + esc(s.source.ts) + '</div></div>' +
      '</div>' +
      '<div class="rv-sevs">' +
        sevPill("fix", g.blockers, "to fix") +
        sevPill("confirm", g.unconf, "to confirm") +
        sevPill("warn", g.warn, "to review") +
      '</div>' +
    '</div>';
  }

  // ---- A · organization ---------------------------------------------
  function classCounts() {
    var ls = live();
    var supJt = {}; ls.forEach(function (L) { supJt[L.supplier + "|" + L.jobType] = 1; });
    return {
      payRates: ls.length,
      agencyCfg: Object.keys(supJt).length,
      constants: 6,                                  // WTR, NI rate, NI threshold, levy, pension std, QE band
      lookups: C.REF_SITES.length + C.REF_JOBTYPES.length,
    };
  }

  var MAPPING = [
    { src: "Supplier", field: "Agency", target: "Agency config", conf: "auto" },
    { src: "Location", field: "Site", target: "Pay rate engine", conf: "auto" },
    { src: "Job Type", field: "Labor category", target: "Pay rate engine", conf: "auto" },
    { src: "Net Pay", field: "Pay rate", target: "Pay rate engine", conf: "auto" },
    { src: "Hours / wk", field: "Weekly hours", target: "Agency config", conf: "auto" },
    { src: "Pension %", field: "Pension %", target: "Agency config", conf: "auto" },
    { src: "Levy (Y/N)", field: "Levy inclusion", target: "Agency config", conf: "review" },
    { src: "Sick Pay", field: "Sick pay", target: "Agency config", conf: "review" },
    { src: "Margin", field: "Markup (\u00a3/hr)", target: "Agency config", conf: "auto" },
    { src: "Charge Rate", field: "Not imported \u2014 recomputed", target: "ignored", conf: "ignored" },
  ];
  var SKIPPED = [
    { row: 1, reason: "Header row" },
    { row: 34, reason: "Blank row \u2014 no values" },
    { row: 58, reason: "Subtotal row \u2014 not a rate line" },
    { row: 91, reason: "No supplier \u2014 can\u2019t classify" },
    { row: 120, reason: "Duplicate of row 119 \u2014 identical key and rate" },
  ];

  function blockA() {
    var s = RV.state, cc = classCounts();
    function tile(n, label, sub) {
      return '<div class="rv-cls"><div class="rv-cls-n">' + n + '</div><div class="rv-cls-l">' + label + '</div><div class="rv-cls-s">' + sub + '</div></div>';
    }
    var tiles =
      tile(cc.payRates, "Pay-rate data", "to the pay rate engine") +
      tile(cc.agencyCfg, "Agency-config data", "supplier \u00d7 position groups") +
      tile(cc.constants, "Engine constants", "statutory, shared") +
      tile(cc.lookups, "Lookups", "sites + labor categories");

    var mapBody = "";
    if (s.exp.mapping) {
      var rows = MAPPING.map(function (m, i) {
        var badge = m.conf === "auto" ? '<span class="rv-conf rv-conf--auto">' + ico("Check") + 'Auto-mapped</span>'
          : m.conf === "review" ? '<span class="rv-conf rv-conf--review">' + ico("Information") + 'Low confidence</span>'
          : '<span class="rv-conf rv-conf--ignore">Ignored</span>';
        var sel = m.conf === "ignored"
          ? '<span class="rv-map-field is-ignored">' + esc(m.field) + '</span>'
          : '<span class="rv-map-field">' + esc(m.field) + '</span>';
        return '<tr' + (m.conf === "review" ? ' class="is-review"' : "") + '>' +
          '<td class="rv-map-src">' + esc(m.src) + '</td>' +
          '<td class="rv-map-arrow">' + ico("ArrowRight") + '</td>' +
          '<td>' + sel + '</td>' +
          '<td><span class="rv-map-target">' + esc(m.target) + '</span></td>' +
          '<td class="rv-map-conf">' + badge + '</td>' +
        '</tr>';
      }).join("");
      mapBody = '<div class="rv-exp-body"><table class="rv-map-table"><thead><tr>' +
        '<th>Source column</th><th></th><th>Model field</th><th>Goes to</th><th>Confidence</th>' +
        '</tr></thead><tbody>' + rows + '</tbody></table></div>';
    }

    var skipBody = "";
    if (s.exp.skipped) {
      var sk = SKIPPED.map(function (r) {
        return '<li class="rv-skip"><span class="rv-skip-row">Row ' + r.row + '</span><span class="rv-skip-reason">' + esc(r.reason) + '</span></li>';
      }).join("");
      skipBody = '<div class="rv-exp-body"><ul class="rv-skip-list">' + sk + '</ul></div>';
    }

    return card("A", "How we organized your data",
      "Every column is mapped to a model field and every row is either classified or listed as skipped \u2014 nothing is dropped silently.",
      '<div class="rv-cls-grid">' + tiles + '</div>' +
      expander("mapping", s.exp.mapping, ico("Grid") + "Column mapping", "10 columns \u00b7 2 low confidence") + mapBody +
      expander("skipped", s.exp.skipped, ico("Filter") + "Skipped rows", SKIPPED.length + " rows, each with a reason") + skipBody
    );
  }

  // ---- B · resolve ---------------------------------------------------
  function resolutionControl(b) {
    var L = b.L, id = L.id;
    if (b.rule === "missing-margin" || b.rule === "charge-le-net") {
      return '<div class="rv-resolve">' +
        '<label class="rv-field"><span>Markup \u00a3/hr</span>' +
          '<input type="number" step="0.01" min="0" class="rv-input" data-rv-margin="' + id + '" placeholder="0.00" /></label>' +
        '<button class="proto-btn proto-btn--primary rv-apply" data-rv-apply-margin="' + id + '">Set markup</button>' +
      '</div>';
    }
    if (b.rule === "unmatched-site") {
      var opts = C.REF_SITES.map(function (x) { return '<option value="' + esc(x) + '">' + esc(x) + '</option>'; }).join("");
      return '<div class="rv-resolve">' +
        '<label class="rv-field"><span>Map to site</span>' +
          '<select class="rv-input" data-rv-mapsite="' + id + '"><option value="">Choose a site\u2026</option>' + opts + '</select></label>' +
        '<button class="proto-btn proto-btn--secondary rv-apply" data-rv-exclude="' + id + '">' + ico("X") + 'Exclude row</button>' +
      '</div>';
    }
    if (b.rule === "unmatched-jt") {
      var optj = C.REF_JOBTYPES.map(function (x) { return '<option value="' + esc(x) + '">' + esc(x) + '</option>'; }).join("");
      return '<div class="rv-resolve">' +
        '<label class="rv-field"><span>Map to labor category</span>' +
          '<select class="rv-input" data-rv-mapjt="' + id + '"><option value="">Choose a category\u2026</option>' + optj + '</select></label>' +
        '<button class="proto-btn proto-btn--secondary rv-apply" data-rv-exclude="' + id + '">' + ico("X") + 'Exclude row</button>' +
      '</div>';
    }
    if (b.rule === "duplicate") {
      return '<div class="rv-resolve">' +
        '<button class="proto-btn proto-btn--secondary rv-apply" data-rv-keep="' + id + '">' + ico("Check") + 'Keep this row</button>' +
        '<button class="proto-btn proto-btn--secondary rv-apply" data-rv-exclude="' + id + '">' + ico("X") + 'Exclude row</button>' +
      '</div>';
    }
    // net-missing or anything else → exclude / fix in source
    return '<div class="rv-resolve">' +
      '<span class="rv-resolve-note">' + ico("Information") + 'Fix the base rate in the source file, or exclude this row.</span>' +
      '<button class="proto-btn proto-btn--secondary rv-apply" data-rv-exclude="' + id + '">' + ico("X") + 'Exclude row</button>' +
    '</div>';
  }

  function blockerItem(b) {
    var L = b.L;
    var msgs = b.issues.map(function (i) { return '<li class="rp-issue-item rp-issue-item--error">' + ico("Alert") + '<span>' + i.msg + '</span></li>'; }).join("");
    return '<div class="rv-item rv-item--block">' +
      '<div class="rv-item-head"><span class="rv-dot rv-dot--err"></span>' +
        '<span class="rv-item-id">' + rowId(L) + '</span>' +
        '<span class="rv-item-count">' + plural(b.issues.length, "blocker") + '</span></div>' +
      '<ul class="rp-issue-list">' + msgs + '</ul>' +
      resolutionControl(b) +
    '</div>';
  }

  function confItem(cf) {
    var s = RV.state, done = !!s.confirmed[cf.key], chosen = s.confirmed[cf.key];
    var title, opts, impact;
    if (cf.rule === "levy-inconsistent") {
      var inc = cf.lines.filter(function (L) { return L.levyIncluded; }).length, exc = cf.lines.length - inc;
      title = "Apprenticeship levy is inconsistent for " + esc(cf.supplier);
      impact = inc + " included \u00b7 " + exc + " excluded across " + plural(cf.lines.length, "rate");
      opts = [{ v: "include", t: "Include levy on all" }, { v: "exclude", t: "Exclude levy on all" }];
    } else {
      title = "Sick pay left blank on " + plural(cf.lines.length, "rate");
      impact = "Treat blank as none, or flag it as a missing value";
      opts = [{ v: "none", t: "Treat as \u00a30.00 (none)" }, { v: "missing", t: "Flag as missing" }];
    }
    var def = opts[0].v;
    var radios = opts.map(function (o) {
      var on = done ? (chosen === o.v) : (o.v === def);
      return '<label class="rv-radio' + (done ? " is-locked" : "") + '">' +
        '<input type="radio" name="' + cf.key + '" value="' + o.v + '"' + (on ? " checked" : "") + (done ? " disabled" : "") + ' data-rv-radio="' + cf.key + '" />' +
        '<span>' + o.t + '</span></label>';
    }).join("");
    var foot = done
      ? '<div class="rv-conf-done">' + ico("Check") + 'Confirmed</div>'
      : '<button class="proto-btn proto-btn--primary rv-apply" data-rv-confirm="' + cf.key + '">Confirm</button>';
    return '<div class="rv-item rv-item--conf' + (done ? " is-done" : "") + '">' +
      '<div class="rv-item-head"><span class="rv-dot rv-dot--' + (done ? "ok" : "info") + '"></span>' +
        '<span class="rv-item-id">' + title + '</span></div>' +
      '<div class="rv-conf-impact">' + impact + '</div>' +
      '<div class="rv-radios">' + radios + '</div>' +
      foot +
    '</div>';
  }

  function blockB(c) {
    var blockHtml = c.blockers.length
      ? c.blockers.map(blockerItem).join("")
      : '<div class="rv-empty">' + ico("Check") + 'No blockers \u2014 every row resolved to a valid charge rate.</div>';
    var confHtml = c.confs.length
      ? c.confs.map(confItem).join("")
      : '<div class="rv-empty">' + ico("Check") + 'Nothing to confirm.</div>';
    var nUnconf = c.confs.filter(function (x) { return !RV.state.confirmed[x.key]; }).length;
    return card("B", "Resolve before continuing",
      "Blockers must be fixed; confirmations need an answer (a safe default is pre-selected). Warnings are reviewed later and don\u2019t block.",
      '<div class="rv-resolve-grid">' +
        '<div class="rv-col"><div class="rv-col-head rv-col-head--err">' + ico("Alert") + 'Blockers <b>' + c.blockers.length + '</b></div>' + blockHtml + '</div>' +
        '<div class="rv-col"><div class="rv-col-head rv-col-head--info">' + ico("Information") + 'Confirmations <b>' + nUnconf + '</b></div>' + confHtml + '</div>' +
      '</div>'
    );
  }

  // ---- C · change summary -------------------------------------------
  function blockC() {
    var s = RV.state, st = diffStats(), base = st.base;
    var opts = s.baselines.map(function (b) { return '<option value="' + b.id + '"' + (b.id === s.baselineId ? " selected" : "") + '>' + esc(b.label) + '</option>'; }).join("");
    function chg(kind, n, label) { return '<div class="rv-chgstat rv-chgstat--' + kind + '"><div class="rv-chgstat-n">' + (kind === "rem" ? "\u2212" : "+") + n + '</div><div class="rv-chgstat-l">' + label + '</div></div>'; }

    var diffBody = "";
    if (s.exp.diff) {
      var rows = [];
      live().forEach(function (L) {
        var d = C.diffLine(L, base);
        if (d.change === "unchanged") return;
        rows.push(diffRow(L, d));
      });
      // removed rows (in baseline, gone now)
      var liveKeys = {}; live().forEach(function (L) { liveKeys[L.supplier + "|" + L.site + "|" + L.jobType] = 1; });
      Object.keys(base.map).forEach(function (k) {
        if (liveKeys[k]) return;
        var b = base.map[k];
        rows.push('<tr><td>' + esc(b.supplier) + ' \u00b7 ' + esc(b.site) + ' \u00b7 ' + esc(b.jobType) + '</td>' +
          '<td class="rv-num">' + gbp(b.charge) + '</td><td class="rv-arrow">' + ico("ArrowRight") + '</td><td class="rv-num rv-muted">\u2014</td>' +
          '<td></td><td><span class="rp-chgchip rp-chgchip--rem">Removed</span></td></tr>');
      });
      diffBody = '<div class="rv-exp-body"><table class="rv-diff-table"><thead><tr>' +
        '<th>Rate line</th><th class="rv-num">Was</th><th></th><th class="rv-num">Now</th><th class="rv-num">\u0394</th><th>What changed</th>' +
        '</tr></thead><tbody>' + rows.join("") + '</tbody></table></div>';
    }

    return card("C", "What this upload will change",
      "Compared against the current live version. Expand to see every changed line with its old and new charge rate.",
      '<div class="rv-cmp-row"><label class="rv-cmp-label">Compare against</label>' +
        '<select class="rv-input rv-cmp-select" data-rv-baseline>' + opts + '</select></div>' +
      '<div class="rv-chg-grid">' + chg("new", st.nw, "new") + chg("chg", st.ch, "changed") + chg("rem", st.rm, "removed") + '</div>' +
      expander("diff", s.exp.diff, ico("Scale") + "Per-row diff", (st.nw + st.ch + st.rm) + " lines differ") + diffBody
    );
  }

  function diffRow(L, d) {
    var isNew = d.change === "new";
    var attr = C.diffAttribution(L, d.b).map(function (a) { return '<span class="rp-attr rv-attr--' + a.k + '">' + a.t + '</span>'; }).join("");
    var chip = isNew ? '<span class="rp-chgchip rp-chgchip--new">New</span>' : '<span class="rp-chgchip rp-chgchip--chg">Changed</span>';
    var deltaCell = "";
    if (!isNew && d.old != null && d.now != null) {
      var dd = r2(d.now - d.old), dp = d.old ? (dd / d.old * 100) : 0, up = dd > 0;
      deltaCell = '<span class="rv-delta ' + (up ? "is-up" : dd < 0 ? "is-down" : "") + '">' + (up ? "\u2191" : dd < 0 ? "\u2193" : "") + dmoney(dd) + ' <em>' + pct(dp) + '</em></span>';
    } else { deltaCell = '<span class="rv-delta is-up">' + ico("AddCircle") + 'new</span>'; }
    return '<tr>' +
      '<td>' + rowId(L) + '</td>' +
      '<td class="rv-num rv-muted">' + (d.old != null ? gbp(d.old) : "\u2014") + '</td>' +
      '<td class="rv-arrow">' + ico("ArrowRight") + '</td>' +
      '<td class="rv-num rv-bill">' + (d.now != null ? gbp(d.now) : "\u2014") + '</td>' +
      '<td class="rv-num">' + deltaCell + '</td>' +
      '<td>' + chip + ' ' + attr + '</td>' +
    '</tr>';
  }

  // ---- shared bits ---------------------------------------------------
  function card(tag, title, sub, body) {
    return '<section class="proto-card rv-card">' +
      '<div class="rv-card-head"><span class="rv-tag">' + tag + '</span>' +
        '<div><h3 class="rv-card-title">' + title + '</h3><p class="rv-card-sub">' + sub + '</p></div></div>' +
      body +
    '</section>';
  }
  function expander(key, open, label, meta) {
    return '<button class="rv-exp" data-rv-exp="' + key + '" aria-expanded="' + (open ? "true" : "false") + '">' +
      '<span class="rv-exp-chev">' + ico(open ? "ChevronDown" : "ChevronRight") + '</span>' +
      '<span class="rv-exp-label">' + label + '</span>' +
      '<span class="rv-exp-meta">' + meta + '</span>' +
    '</button>';
  }

  // ------------------------------------------------------------------ events
  RV._wireOnce = function () {
    var root = RV._root;
    if (!root || root.__rvWired) return;
    root.__rvWired = true;

    root.addEventListener("click", function (e) {
      var t = e.target.closest("[data-rv-exp],[data-rv-apply-margin],[data-rv-exclude],[data-rv-keep],[data-rv-confirm]");
      if (!t) return;
      var s = RV.state;
      if (t.hasAttribute("data-rv-exp")) { var k = t.getAttribute("data-rv-exp"); s.exp[k] = !s.exp[k]; RV._render(); return; }

      if (t.hasAttribute("data-rv-apply-margin")) {
        var id = t.getAttribute("data-rv-apply-margin");
        var inp = root.querySelector('[data-rv-margin="' + id + '"]');
        var v = inp ? parseFloat(inp.value) : NaN;
        if (isNaN(v) || v < 0) { toast("Enter a markup of \u00a30.00 or more"); return; }
        var L = byId(id); if (L) { L.margin = r2(v); C.recompute(L); revalidate(); toast("Markup set \u2014 charge rate recomputed"); }
        return;
      }
      if (t.hasAttribute("data-rv-exclude")) { var L2 = byId(t.getAttribute("data-rv-exclude")); if (L2) { L2.excluded = true; revalidate(); toast("Row excluded from this upload"); } return; }
      if (t.hasAttribute("data-rv-keep")) { var L3 = byId(t.getAttribute("data-rv-keep")); if (L3) { L3.acked = true; revalidate(); toast("Row kept"); } return; }
      if (t.hasAttribute("data-rv-confirm")) {
        var key = t.getAttribute("data-rv-confirm");
        var sel = root.querySelector('input[name="' + key + '"]:checked');
        s.confirmed[key] = sel ? sel.value : "default";
        RV._render(); toast("Confirmed");
        return;
      }
    });

    root.addEventListener("change", function (e) {
      var s = RV.state, el = e.target;
      if (el.hasAttribute("data-rv-baseline")) { s.baselineId = el.value; RV._render(); return; }
      if (el.hasAttribute("data-rv-mapsite")) { var L = byId(el.getAttribute("data-rv-mapsite")); if (L && el.value) { L.mapping.site = el.value; revalidate(); toast("Mapped to " + el.value); } return; }
      if (el.hasAttribute("data-rv-mapjt")) { var L2 = byId(el.getAttribute("data-rv-mapjt")); if (L2 && el.value) { L2.mapping.jobType = el.value; revalidate(); toast("Mapped to " + el.value); } return; }
    });
  };

  function byId(id) { return RV.state.staged.filter(function (L) { return L.id === id; })[0]; }
  function revalidate() { C.validate(RV.state.staged); RV._render(); }

})();
