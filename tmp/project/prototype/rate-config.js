/* =====================================================================
   Rate Card — "\u2463 Agency Rate Configuration" (wizard step 4)   v0.96
   ---------------------------------------------------------------------
   Implements uploads/Agency_Rate_Config_Adapt_Spec.md: the step now
   renders the FULL agency recipe (bill.pdf columns) populated with the
   uploaded values for EVERY supplier \u00d7 site \u00d7 job-type line \u2014 a flat,
   per-line table you read, edit in place, and re-cut by dimension. The
   parallel of the pay step (rate-model.js): one table, editable input
   cells, a column-group switch (Inputs & bill / Burden build), group-by
   and filters. The recipe (statutory + derived columns) is read-only;
   the five agency variables are editable and staged until Activate.

   Recipe columns (bill.pdf, the Agency Rate Config sheet):
     Supplier \u00b7 Site \u00b7 Job type \u00b7 Weekly hours \u00b7 Nominal net pay \u00b7
     WTR \u00b7 Employer NI \u00b7 Pension % \u00b7 Pension \u00a3 \u00b7 Levy incl \u00b7 Levy \u00a3 \u00b7
     Sick pay \u00b7 Direct cost \u00b7 Markup \u00b7 Bill pre-VAT \u00b7 VAT \u00b7 Bill incl VAT

   Treatment (mirrors the template):
     \u00b7 EDITABLE inputs (blue) \u2014 Weekly hours, Pension %, Sick pay,
       Levy incl, Markup.
     \u00b7 READ-ONLY (green) \u2014 Nominal net pay (linked from \u2462 Pay Rate
       Configuration).
     \u00b7 DERIVED / locked \u2014 WTR, Employer NI, Pension \u00a3, Levy \u00a3, Direct
       cost, Bill pre-VAT, VAT, Bill incl VAT. Recompute live on edit.

   SCOPED EDITING (the one difference from the pay step): an agency input
   has a natural scope. Markup, pension % and weekly hours are per
   supplier \u00d7 position group; sick and levy are per supplier. Editing a
   cell PROPAGATES to its scope (and the scope is named on edit). A line
   that genuinely differs carries a per-line OVERRIDE that breaks
   propagation for that line and is flagged.

   PARITY is a flag, not a job type: "Warehouse Parity" folds into a
   parity flag on the Warehouse rows. The five inputs are parity-agnostic
   and shared across Pre / Post within a position group; only the bill
   differs (WTR 12.07% \u2192 14.04%). No duplicate parity input rows.

   Mounts into #rc-root. IA version: V1.  Everest tokens only.
   ===================================================================== */
(function () {
  "use strict";
  var C = window.RPCore;
  if (!C) return;
  var gbp = C.gbp, r2 = C.r2, esc = C.esc, ico = C.ico, toast = C.toast;
  var ENG = C.ENG;
  var VAT = 20;                              // standard-rate VAT on the bill

  // job type \u2192 position group (the scope for markup / pension / hours)
  var POS_OF = { "HGV Driver": "Transport", "Van Driver": "Driver", "Warehouse": "Warehouse", "Warehouse Parity": "Warehouse" };
  var POS_ORDER = ["Transport", "Driver", "Warehouse"];
  var JT_ORDER = ["Warehouse", "HGV Driver", "Van Driver"];
  var SITE_ORDER = ["Barnsley", "NRC", "Nuneaton", "Rugby", "Warrington", "Wednesbury"];
  // Sites the \u2462 Pay Rate Configuration carries a pay source for. A line at
  // any other site (NRC) has no matched net pay \u2014 a pay-source gap.
  var PAY_SITES = ["Barnsley", "Nuneaton", "Rugby", "Warrington", "Wednesbury"];

  var GROUP_FIELDS = ["markup", "penPct", "hours"];   // scope: supplier \u00d7 position group
  var SUP_FIELDS = ["sick", "levy"];                   // scope: supplier
  var TOL = { markup: 0.005, penPct: 0.16, hours: 0.25, sick: 0.005 };
  var STD_HOURS = [35, 37.5, 40, 48];

  var RC = {};
  window.RC = RC;

  // Agency-scoped relabel: "Site" reads as "Location" on the agency rate-card
  // view; stays "Site" everywhere else.
  function scoped() { return !!(RC.state && RC.state.scopeSupplier); }
  function siteLabel() { return scoped() ? "Location" : "Site"; }

  /* ------------------------------------------------------------------ data */
  function clone(o) { var c = {}; for (var k in o) c[k] = o[k]; return c; }
  function isSup(field) { return SUP_FIELDS.indexOf(field) >= 0; }
  function scopeKey(L, field) { return isSup(field) ? L.supplier : L.supplier + "\u2502" + L.pos; }
  function inScope(a, b, field) { return isSup(field) ? a.supplier === b.supplier : (a.supplier === b.supplier && a.pos === b.pos); }
  function siblings(L, field) { return RC.state.lines.filter(function (x) { return inScope(x, L, field); }); }

  // One row per uploaded line (supplier \u00d7 site \u00d7 job type) \u2014 all 117.
  function buildLines() {
    var src = window.PDF_RATES || [];
    var lines = src.map(function (r, i) {
      var jtRaw = r.jt;
      var penPct = r.net > 0 ? r2(r.pen / r.net * 100) : 0;
      var L = {
        id: "A" + i,
        supplier: r.s, site: r.loc, jtRaw: jtRaw,
        jt: jtRaw === "Warehouse Parity" ? "Warehouse" : jtRaw,
        pos: POS_OF[jtRaw] || "Warehouse",
        parity: jtRaw === "Warehouse Parity" ? "Post" : jtRaw === "Warehouse" ? "Pre" : null,
        net: r.net,
        payGap: PAY_SITES.indexOf(r.loc) < 0,
        v: { markup: r.margin, penPct: penPct, hours: r.hrs, sick: r.sick || 0, levy: r.levy > 0 },
        pin: { markup: false, penPct: false, hours: false, sick: false, levy: false },
      };
      return L;
    });
    detectScopes(lines);
    lines.forEach(function (L) { L.orig = clone(L.v); L.origPin = clone(L.pin); });
    return lines;
  }

  // Establish the scope-canonical value for each field and snap shared
  // lines to it; flag genuinely-different lines as loaded overrides.
  function detectScopes(lines) {
    ["markup", "penPct", "hours", "sick", "levy"].forEach(function (field) {
      var groups = {};
      lines.forEach(function (L) { var k = scopeKey(L, field); (groups[k] = groups[k] || []).push(L); });
      Object.keys(groups).forEach(function (k) {
        var arr = groups[k];
        var canon = field === "levy" ? modalBool(arr) : canonValue(arr, field);
        arr.forEach(function (L) {
          var diff = field === "levy" ? (L.v[field] !== canon) : (Math.abs(L.v[field] - canon) > TOL[field]);
          if (diff) L.pin[field] = true;        // genuine override \u2014 keep its own value
          else L.v[field] = canon;              // shared \u2014 snap to the scope canonical
        });
      });
    });
  }
  function canonValue(arr, field) {
    var round = field === "penPct" ? function (v) { return Math.round(v / 0.25) * 0.25; }
      : field === "hours" ? function (v) { return Math.round(v * 2) / 2; }
        : function (v) { return Math.round(v * 100) / 100; };
    var c = {}, best = null, bestN = -1;
    arr.forEach(function (L) { var key = String(round(L.v[field])); c[key] = (c[key] || 0) + 1; if (c[key] > bestN) { bestN = c[key]; best = L.v[field]; } });
    return best == null ? 0 : best;
  }
  function modalBool(arr) { var t = 0, f = 0; arr.forEach(function (L) { L.v.levy ? t++ : f++; }); return t > f; }

  /* ------------------------------------------------------------------ engine */
  // The standardized burden + bill build (bill.pdf columns), recomputed
  // live from the editable inputs. Net pay is read-only (from \u2462).
  function calc(L) {
    var net = L.net, hrs = Number(L.v.hours) || 37.5;
    var penPct = Number(L.v.penPct) || 0;
    var sick = Number(L.v.sick) || 0;
    var levyOn = !!L.v.levy;
    var wtrPct = L.parity === "Post" ? ENG.wtrPar : ENG.wtrStd;
    var wtr = r2(net * wtrPct / 100);
    var eni = r2(((net + wtr) * hrs - ENG.niThresh) * ENG.niPct / 100 / hrs);
    var pen = r2(net * penPct / 100);
    var levy = levyOn ? r2((net + wtr + eni) * ENG.levyPct / 100) : 0;
    var direct = r2(net + wtr + eni + pen + levy + sick);
    var mk = (L.v.markup == null || L.v.markup === "") ? null : Number(L.v.markup);
    var billPre = mk == null ? null : r2(direct + mk);
    var vat = billPre == null ? null : r2(billPre * VAT / 100);
    var billInc = billPre == null ? null : r2(billPre + vat);
    var marginPct = (billInc && mk != null) ? r2(mk / billInc * 100) : null;
    return { net: net, hrs: hrs, wtrPct: wtrPct, wtr: wtr, eni: eni, pen: pen, penPct: penPct,
      levy: levy, levyOn: levyOn, sick: sick, direct: direct, markup: mk, billPre: billPre, vat: vat, billInc: billInc, marginPct: marginPct };
  }

  function isEdited(L) {
    var o = L.orig;
    return L.v.markup !== o.markup || L.v.penPct !== o.penPct || L.v.hours !== o.hours ||
      L.v.sick !== o.sick || L.v.levy !== o.levy ||
      L.pin.markup !== L.origPin.markup || L.pin.penPct !== L.origPin.penPct || L.pin.hours !== L.origPin.hours ||
      L.pin.sick !== L.origPin.sick || L.pin.levy !== L.origPin.levy;
  }
  function isOverridden(L) { return GROUP_FIELDS.concat(SUP_FIELDS).some(function (f) { return L.pin[f]; }); }
  function rowIssues(L) {
    var out = [];
    if (L.v.markup == null || L.v.markup === "") out.push({ sev: "err", t: "Missing markup" });
    if (L.payGap) out.push({ sev: "warn", t: "No Pay Rate Configuration source for " + L.site } );
    if (L.v.penPct > 0 && L.v.penPct < 3) out.push({ sev: "warn", t: "Pension below 3% auto-enrolment minimum" });
    if (STD_HOURS.indexOf(Number(L.v.hours)) < 0) out.push({ sev: "warn", t: "Unusual weekly hours" });
    return out;
  }
  function rowSeverity(L) {
    var iss = rowIssues(L);
    if (iss.some(function (x) { return x.sev === "err"; })) return "err";
    if (iss.some(function (x) { return x.sev === "warn"; })) return "warn";
    return "ok";
  }

  /* ------------------------------------------------------------------ state */
  RC.reset = function () { RC.state = null; };
  RC.ensure = function (opts) {
    opts = opts || {};
    if (RC.state && RC.state._key === (opts.key || "k")) return;
    RC.state = {
      _key: opts.key || "k", lines: buildLines(),
      scopeSupplier: opts.supplier || null,   // when set: scope to one agency (hide supplier col, "Location" labels)
      groupBy: "none", colGroup: "all", search: "",
      sort: { col: null, dir: 1 },
      f: { site: "all", jt: "all", pos: "all", parity: "all" },
      quick: { edits: false, overrides: false, levyoff: false, pen3: false, paygap: false },
      collapsed: {}, drawer: null,
    };
  };
  RC.mount = function (root, opts) {
    opts = opts || {};
    RC._root = root;
    if (!root) return;
    RC.ensure(opts);
    RC.state.readOnly = !!opts.readOnly;   // read-only view (e.g. version detail) — no inputs
    RC.state.scopeSupplier = opts.supplier || null;   // re-apply scope on every mount
    RC._render();
    RC._wireOnce();
  };

  /* ------------------------------------------------------------------ gate */
  RC.gate = function () {
    if (!RC.state) return { ok: true, statusHtml: ico("Check") + "Ready to continue" };
    var missing = RC.state.lines.filter(function (L) { return L.v.markup == null || L.v.markup === ""; });
    if (missing.length) {
      var lbl = missing.length === 1
        ? esc(missing[0].supplier) + " \u00b7 " + esc(missing[0].site) + " \u00b7 " + esc(missing[0].jt) + " needs a markup"
        : missing.length + " lines missing a markup";
      return { ok: false, statusHtml: ico("Alert") + lbl };
    }
    return { ok: true, statusHtml: ico("Check") + "Every line priced \u2014 ready" };
  };
  RC.gateState = function (opts) { RC.ensure(opts || {}); return RC.gate(); };

  /* ------------------------------------------------------------------ filtering */
  function dimsPresent(field) {
    var seen = {}; RC.state.lines.forEach(function (L) { seen[L[field]] = 1; });
    return Object.keys(seen);
  }
  function passFilter(L) {
    var s = RC.state, f = s.f;
    if (s.scopeSupplier && L.supplier !== s.scopeSupplier) return false;
    if (f.site !== "all" && L.site !== f.site) return false;
    if (f.jt !== "all" && L.jt !== f.jt) return false;
    if (f.pos !== "all" && L.pos !== f.pos) return false;
    if (f.parity !== "all") {
      if (f.parity === "na" && L.parity != null) return false;
      if (f.parity !== "na" && L.parity !== f.parity) return false;
    }
    if (s.search) {
      var q = s.search.toLowerCase();
      if ((L.supplier + " " + L.site + " " + L.jt).toLowerCase().indexOf(q) < 0) return false;
    }
    if (s.quick.edits && !isEdited(L)) return false;
    if (s.quick.overrides && !isOverridden(L)) return false;
    if (s.quick.levyoff && L.v.levy) return false;
    if (s.quick.pen3 && !(L.v.penPct > 0 && L.v.penPct < 3)) return false;
    if (s.quick.paygap && !L.payGap) return false;
    return true;
  }
  function activeFilterLabels() {
    var s = RC.state, f = s.f, out = [];
    if (f.site !== "all") out.push(f.site);
    if (f.jt !== "all") out.push(f.jt);
    if (f.pos !== "all") out.push(f.pos);
    if (f.parity !== "all") out.push(f.parity === "na" ? "no parity" : f.parity + "-parity");
    if (s.quick.edits) out.push("my edits");
    if (s.quick.overrides) out.push("overrides");
    if (s.quick.levyoff) out.push("levy off");
    if (s.quick.pen3) out.push("pension <3%");
    if (s.quick.paygap) out.push("pay-source gap");
    if (s.search) out.push('"' + s.search + '"');
    return out;
  }
  // Is the view transformed away from the as-uploaded template mirror?
  function viewTransformedRC() {
    var s = RC.state;
    return s.groupBy !== "none" || s.colGroup !== "all" || !!s.sort.col || activeFilterLabels().length > 0;
  }

  /* ------------------------------------------------------------------ shell */
  RC._render = function () {
    if (!RC._root) return;
    var s = RC.state;
    var visible = s.lines.filter(passFilter);
    RC._root.innerHTML =
      '<div class="rc2">' +
        toolbar() +
        legend() +
        banners() +
        meta(visible) +
        (visible.length ? table(visible) : empty()) +
        (s.readOnly ? "" : stagedNote()) +
        drawer() +
      '</div>';
    if (window.Proto) { window.Proto.fillIcons(RC._root); window.Proto.setWizGate(RC.gate()); }
  };

  function seg(active, opts, attr) {
    return '<div class="rc2-seg">' + opts.map(function (o) {
      return '<button class="rc2-seg-btn' + (active === o[0] ? " is-on" : "") + '" ' + attr + '="' + o[0] + '">' + o[1] + '</button>';
    }).join("") + '</div>';
  }
  function toolbar() {
    var s = RC.state;
    function selOpts(field, allLabel, order) {
      var present = dimsPresent(field);
      var vals = (order || present).filter(function (v) { return present.indexOf(v) >= 0; });
      return '<option value="all">' + allLabel + '</option>' + vals.map(function (v) {
        return '<option value="' + esc(v) + '"' + (s.f[field] === v ? " selected" : "") + '>' + esc(v) + '</option>';
      }).join("");
    }
    var parityOpts = '<option value="all">' + (scoped() ? "All tenure" : "All parity") + '</option>' +
      (scoped() ? [["Pre", "Pre-Parity"], ["Post", "Post-Parity"], ["na", "No parity"]] : [["Pre", "Pre-parity"], ["Post", "Post-parity"], ["na", "No parity"]]).map(function (p) {
        return '<option value="' + p[0] + '"' + (s.f.parity === p[0] ? " selected" : "") + '>' + p[1] + '</option>';
      }).join("");

    // Group by is a segmented tab \u2014 None first, Site second, then the rest.
    var groupSeg = seg(s.groupBy,
      (scoped()
        ? [["none", "None"], ["site", "Location"], ["jt", "Job type"], ["pos", "Position group"], ["parity", "Tenure"]]
        : [["none", "None"], ["site", "Site"], ["supplier", "Supplier"], ["jt", "Job type"], ["pos", "Position group"], ["parity", "Parity"]]),
      "data-rc-group");

    return '<div class="rc2-top">' +
      '<div class="rc2-tbrow">' +
        '<label class="rc2-search">' + ico("Search") + '<input class="rc2-search-in" data-rc-search placeholder="Search supplier, site or job type\u2026" value="' + esc(s.search) + '" /></label>' +
        '<label class="rc2-ctrl"><span>' + siteLabel() + '</span><select class="rc2-select" data-rc-f="site">' + selOpts("site", "All " + siteLabel().toLowerCase() + "s", SITE_ORDER) + '</select></label>' +
        '<label class="rc2-ctrl"><span>Job type</span><select class="rc2-select" data-rc-f="jt">' + selOpts("jt", "All job types", JT_ORDER) + '</select></label>' +
        '<label class="rc2-ctrl"><span>Position</span><select class="rc2-select" data-rc-f="pos">' + selOpts("pos", "All positions", POS_ORDER) + '</select></label>' +
        '<label class="rc2-ctrl"><span>' + (scoped() ? "Tenure" : "Parity") + '</span><select class="rc2-select" data-rc-f="parity">' + parityOpts + '</select></label>' +
      '</div>' +
      '<div class="rc2-chiprow">' +
        '<label class="rc2-ctrl rc2-ctrl--group"><span>Group by</span>' + groupSeg + '</label>' +
        '<div class="rc2-tb-spacer"></div>' +
        (s.readOnly ? '' : '<button class="rc2-tbtn" data-rc-resetall>' + ico("TimeUndo") + 'Reset all to uploaded</button>') +
      '</div>' +
    '</div>';
  }

  function legend() {
    if (scoped()) {
      var sdesc = "This agency\u2019s rate-card lines in full \u2014 every recipe column from the current rate card, as a flat, read-only list by location and job type. Net pay comes from the pay rate configuration; WTR, NI, pension, levy, direct cost, VAT and the bill are derived.";
      return '<div class="rm-legend">' +
        '<div class="rm-legend-main"><span class="rm-legend-desc">' + sdesc + '</span></div>' +
        '<div class="rm-legend-keys">' +
          '<span class="rm-legend-k"><span class="rc2-swatch rc2-swatch--in"></span>Agency input</span>' +
          '<span class="rm-legend-k"><span class="rc2-swatch rc2-swatch--pay"></span>From pay</span>' +
          '<span class="rm-legend-k"><span class="rc2-swatch rc2-swatch--dv"></span>Derived</span>' +
        '</div>' +
      '</div>';
    }
    // Always the full template mirror \u2014 every column, in template order.
    var desc = "Your uploaded agency template in full \u2014 every column, in template order, as one flat list across all suppliers. Weekly hours, pension %, sick, levy and markup are editable; net pay is read from \u2462 Pay Rate Configuration; WTR, NI, pension \u00a3, levy \u00a3, direct cost, VAT and the bill are derived.";
    return '<div class="rm-legend">' +
      '<div class="rm-legend-main"><span class="rm-legend-desc">' + desc + '</span></div>' +
      '<div class="rm-legend-keys">' +
        '<span class="rm-legend-k"><span class="rc2-swatch rc2-swatch--in"></span>Editable</span>' +
        '<span class="rm-legend-k"><span class="rc2-swatch rc2-swatch--pay"></span>From \u2462 pay</span>' +
        '<span class="rm-legend-k"><span class="rc2-swatch rc2-swatch--dv"></span>Derived</span>' +
      '</div>' +
    '</div>';
  }

  // All warnings in ONE card, each on its own row separated by a divider.
  function banners() {
    var s = RC.state, rows = [];
    var base = scoped() ? s.lines.filter(function (L) { return L.supplier === s.scopeSupplier; }) : s.lines;
    var missing = base.filter(function (L) { return L.v.markup == null || L.v.markup === ""; }).length;
    var gap = base.filter(function (L) { return L.payGap; }).length;
    var pen = base.filter(function (L) { return L.v.penPct > 0 && L.v.penPct < 3; }).length;
    if (missing) rows.push({ sev: "err", html: '<b>' + missing + ' line' + (missing === 1 ? "" : "s") + '</b> ' + (missing === 1 ? "is" : "are") + ' missing a markup \u2014 the bill is invalid until priced. This blocks <i>Continue to rate cards</i>.' });
    if (gap) rows.push({ sev: "warn", html: '<b>' + gap + ' line' + (gap === 1 ? "" : "s") + '</b> at <b>NRC</b> have no matched rate in \u2462 Pay Rate Configuration \u2014 net pay is shown at the assumed NMW floor, flagged as a pay-source gap.' });
    if (pen) rows.push({ sev: "warn", html: '<b>' + pen + ' line' + (pen === 1 ? "" : "s") + '</b> price pension below the 3% auto-enrolment minimum \u2014 likely non-compliant. Raise the pension % to re-run the burden.' });
    if (!rows.length) return "";
    var hasErr = rows.some(function (r) { return r.sev === "err"; });
    return '<div class="rc2-warncard rc2-warncard--' + (hasErr ? "err" : "warn") + '">' +
      '<div class="rc2-warncard-head">' + ico("Alert") + '<b>' + rows.length + (rows.length === 1 ? " warning to review" : " warnings to review") + '</b></div>' +
      rows.map(function (r) {
        return '<div class="rc2-warnrow rc2-warnrow--' + r.sev + '">' + ico(r.sev === "err" ? "Alert" : "Information") + '<span>' + r.html + '</span></div>';
      }).join("") +
    '</div>';
  }

  function meta(visible) {
    var s = RC.state;
    var nSup = {}; visible.forEach(function (L) { nSup[L.supplier] = 1; });
    var nS = Object.keys(nSup).length;
    var fl = activeFilterLabels();
    if (!viewTransformedRC()) {
      return '<div class="rc2-meta"><b>' + visible.length + '</b> line' + (visible.length === 1 ? "" : "s") +
        ' \u00b7 <span class="rc2-meta-tv">template view</span></div>';
    }
    var total = scoped() ? s.lines.filter(function (L) { return L.supplier === s.scopeSupplier; }).length : s.lines.length;
    var bits = ['<b>' + visible.length + '</b> of ' + total + ' line' + (visible.length === 1 ? "" : "s")];
    if (!scoped()) bits.push(nS + ' supplier' + (nS === 1 ? "" : "s"));
    if (s.groupBy !== "none") {
      var gb = ({ supplier: "supplier", jt: "job type", site: "site", pos: "position group", parity: "parity" })[s.groupBy];
      bits.push('grouped by ' + gb);
    }
    if (s.colGroup !== "all") bits.push('focus: ' + (s.colGroup === "burden" ? "burden build" : "inputs & bill"));
    if (s.sort.col) bits.push('sorted by ' + (COL_LABELS_RC[s.sort.col] || s.sort.col) + (s.sort.dir > 0 ? " \u2191" : " \u2193"));
    if (fl.length) bits.push('filtered: ' + esc(fl.join(", ")));
    return '<div class="rc2-meta">' + bits.join(' \u00b7 ') + '</div>';
  }

  function stagedNote() {
    return '<p class="rc2-note">' + ico("Information") + 'Editing an input propagates to its scope \u2014 markup, pension % and hours to the supplier\u2019s position group; sick and levy to the whole supplier. Unlink a cell to override one line. Net pay and statutory rates are read-only. Edits stage until Activate; nothing is live until then.</p>';
  }

  function empty() {
    return '<div class="rc2-empty">' + ico("Search") + '<div><b>No lines match.</b> Adjust or clear the filters to see suppliers again.</div>' +
      '<button class="proto-btn proto-btn--secondary" data-rc-clearfilters>Clear filters</button></div>';
  }

  /* ------------------------------------------------------------------ columns */
  // Descriptor-driven column model: one definition per column feeds the
  // header, the cell and the sort. "all" = the full template mirror in
  // template order (bill.pdf); "inputs" / "burden" are optional focus cuts.
  var COL_LABELS_RC = {
    supplier: "supplier", site: "site", jt: "job type", hours: "weekly hours",
    net: "net pay", wtr: "WTR", eni: "employer NI", penPct: "pension %",
    pen: "pension \u00a3", levy: "levy incl", levyAmt: "levy \u00a3", sick: "sick pay",
    direct: "direct cost", markup: "markup", billPre: "bill pre-VAT", vat: "VAT", billInc: "bill incl VAT"
  };
  var KEY_PIN = { supplier: "sup", site: "site", jt: "jt" };
  function keyPin(id, all) { return all ? " rck rck--" + KEY_PIN[id] : ""; }
  function vtd(kind, inner) { return '<td class="rc2-vc rc2-vc--' + kind + '">' + inner + '</td>'; }

  // every column, keyed by id. cell(L, b, all) returns a full <td>.
  function colDefs() {
    return {
      supplier: { key: true, label: "Supplier", sort: function (L) { return L.supplier; },
        cell: function (L, b, all) { return '<td class="rc2-key rc2-key--sup' + keyPin("supplier", all) + '">' + esc(L.supplier) + rowFlags(L) + '</td>'; } },
      site: { key: true, label: siteLabel(), sort: function (L) { return SITE_ORDER.indexOf(L.site); },
        cell: function (L, b, all) { return '<td class="rc2-key' + keyPin("site", all) + '">' + esc(L.site) + '</td>'; } },
      jt: { key: true, label: "Job type", sort: function (L) { return JT_ORDER.indexOf(L.jt); },
        cell: function (L, b, all) { return '<td class="rc2-key' + keyPin("jt", all) + '"><span class="rc2-jt">' + esc(L.jt) + '</span>' + parityChip(L) + '</td>'; } },
      tenure: { kind: "tenure", label: "Tenure", sort: function (L) { return L.parity === "Post" ? 2 : L.parity === "Pre" ? 1 : 0; },
        cell: function (L) { return vtd("tenure", L.parity == null ? '<span class="rc2-none">\u2014</span>' : '<span class="rc2-par rc2-par--' + (L.parity === "Post" ? "post" : "pre") + '">' + L.parity + '-Parity</span>'); } },
      hours: { kind: "in", label: "Weekly hours", sort: function (L) { return Number(L.v.hours) || 0; },
        cell: function (L) { return vtd("in", editCell(L, "hours", { label: "Weekly hours" }) + '<span class="rc2-unit">h/wk</span>'); } },
      net: { kind: "pay", label: "Net pay", sort: function (L) { return L.net; },
        cell: function (L) { return vtd("pay", netCell(L)); } },
      wtr: { kind: "dv", label: "WTR \u00a3", sort: function (L, b) { return b.wtr; },
        cell: function (L, b) { return vtd("dv", dv(b.wtr) + '<span class="rc2-dvsub">' + b.wtrPct.toFixed(2) + '%' + (L.parity === "Post" ? " parity" : "") + '</span>'); } },
      eni: { kind: "dv", label: "Employer NI \u00a3", sort: function (L, b) { return b.eni; },
        cell: function (L, b) { return vtd("dv", dv(b.eni)); } },
      penPct: { kind: "in", label: "Pension %", sort: function (L) { return Number(L.v.penPct) || 0; },
        cell: function (L) { return vtd("in", editCell(L, "penPct", { label: "Pension percent" }) + '<span class="rc2-unit">%</span>'); } },
      pen: { kind: "dv", label: "Pension \u00a3", sort: function (L, b) { return b.pen; },
        cell: function (L, b) { return vtd("dv", dv(b.pen)); } },
      levy: { kind: "in", label: "Levy incl", sort: function (L) { return L.v.levy ? 1 : 0; },
        cell: function (L) { return vtd("in", editCell(L, "levy", { label: "Levy included" })); } },
      levyAmt: { kind: "dv", label: "Levy \u00a3", sort: function (L, b) { return b.levyOn ? b.levy : null; },
        cell: function (L, b) { return vtd("dv", b.levyOn ? dv(b.levy) : '<span class="rc2-none">off</span>'); } },
      sick: { kind: "in", label: "Sick pay \u00a3", sort: function (L) { return Number(L.v.sick) || 0; },
        cell: function (L) { return vtd("in", editCell(L, "sick", { label: "Sick pay" })); } },
      direct: { kind: "dv", label: "Direct cost \u00a3", sort: function (L, b) { return b.direct; },
        cell: function (L, b) { return vtd("dv", dv(b.direct)); } },
      markup: { kind: "in", label: "Markup \u00a3", sort: function (L, b) { return b.markup; },
        cell: function (L) { return vtd("in", editCell(L, "markup", { label: "Markup" })); } },
      billPre: { kind: "dv", label: "Bill pre-VAT \u00a3", sort: function (L, b) { return b.billPre; },
        cell: function (L, b) { return vtd("dv", dv(b.billPre)); } },
      vat: { kind: "dv", label: "VAT \u00a3", sort: function (L, b) { return b.vat; },
        cell: function (L, b) { return vtd("dv", dv(b.vat)); } },
      billInc: { kind: "anchor", label: "Bill incl VAT \u00a3", sort: function (L, b) { return b.billInc; },
        cell: function (L, b) { return anchorCell(b); } }
    };
  }
  // bill.pdf template order for "all"; the two focus cuts are lean subsets.
  var COL_ORDER = {
    all: ["supplier", "site", "jt", "hours", "net", "wtr", "eni", "penPct", "pen", "levy", "levyAmt", "sick", "direct", "markup", "billPre", "vat", "billInc"],
    inputs: ["supplier", "site", "jt", "hours", "net", "penPct", "sick", "levy", "markup", "billInc"],
    burden: ["supplier", "site", "jt", "net", "wtr", "eni", "pen", "levyAmt", "sick", "direct", "markup", "billPre", "vat", "billInc"]
  };
  function colsRC() {
    var defs = colDefs();
    var order = (COL_ORDER[RC.state.colGroup] || COL_ORDER.all);
    if (scoped()) {
      order = order.filter(function (id) { return id !== "supplier"; });   // one agency — supplier is redundant
      var ji = order.indexOf("jt");                                        // promote parity to its own Tenure column
      if (ji >= 0 && order.indexOf("tenure") < 0) order = order.slice(0, ji + 1).concat(["tenure"], order.slice(ji + 1));
    }
    return order.map(function (id) { var d = defs[id]; d.id = id; return d; });
  }
  function colCount() { return colsRC().length + 2; }

  function cmpRC(a, b, col, dir) {
    var d = colDefs()[col]; if (!d) return 0;
    var va = d.sort(a, calc(a)), vb = d.sort(b, calc(b));
    var na = (va == null), nb = (vb == null);
    if (na && nb) return 0;
    if (na) return 1;
    if (nb) return -1;
    var c = (typeof va === "string" || typeof vb === "string") ? String(va).localeCompare(String(vb)) : (va - vb);
    return dir > 0 ? c : -c;
  }

  function thRC(col, all) {
    var s = RC.state, active = s.sort.col === col.id;
    var base = col.key ? ("rc2-th-key" + keyPin(col.id, all)) : ("rc2-vh rc2-vh--" + col.kind);
    var ind = '<span class="rc2-sortind' + (active ? " is-on" : "") + '">' + (active ? (s.sort.dir > 0 ? "\u25B2" : "\u25BC") : "") + '</span>';
    return '<th class="' + base + (active ? " is-sorted" : "") + '"><button class="rc2-sort" type="button" data-rc-sort="' + col.id + '">' + col.label + ind + '</button></th>';
  }

  /* ------------------------------------------------------------------ table */
  function table(visible) {
    var all = RC.state.colGroup === "all";
    var cols = colsRC();
    var head = '<thead><tr>' + cols.map(function (c) { return thRC(c, all); }).join("") +
      '<th class="rc2-th-st" aria-label="Status"></th><th class="rc2-th-exp" aria-label="Build"></th></tr></thead>';
    return '<div class="rc2-tablewrap"><table class="rc2-table' + (all ? " rc2-table--all" : "") + (scoped() ? " rc2-table--nosup" : "") + '">' + head + '<tbody>' + groupedBody(visible) + '</tbody></table></div>';
  }

  function groupKey(L) {
    if (RC.state.groupBy === "jt") return L.jt;
    if (RC.state.groupBy === "site") return L.site;
    if (RC.state.groupBy === "pos") return L.pos;
    if (RC.state.groupBy === "parity") return L.parity == null ? "No parity" : L.parity + "-parity";
    return L.supplier;
  }
  function groupOrder(keys) {
    var gb = RC.state.groupBy;
    var ref = gb === "jt" ? JT_ORDER : gb === "site" ? SITE_ORDER : gb === "pos" ? POS_ORDER : gb === "parity" ? ["Pre-parity", "Post-parity", "No parity"] : null;
    if (!ref) return keys.sort();
    return keys.sort(function (a, b) { var ia = ref.indexOf(a), ib = ref.indexOf(b); return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib); });
  }
  function rowSort(a, b) {
    return (a.supplier.localeCompare(b.supplier)) ||
      (SITE_ORDER.indexOf(a.site) - SITE_ORDER.indexOf(b.site)) ||
      (JT_ORDER.indexOf(a.jt) - JT_ORDER.indexOf(b.jt)) ||
      ((a.parity === "Post" ? 1 : 0) - (b.parity === "Post" ? 1 : 0));
  }
  function groupedBody(visible) {
    var s = RC.state;
    // Template mirror: flat list, no group banner. Keep uploaded (PDF) row
    // order unless a column sort is active.
    if (s.groupBy === "none") {
      var flat = visible.slice();
      if (s.sort.col) flat.sort(function (a, b) { return cmpRC(a, b, s.sort.col, s.sort.dir); });
      return flat.map(dataRow).join("");
    }
    var map = {}, order = [];
    visible.forEach(function (L) { var k = groupKey(L); if (!map[k]) { map[k] = []; order.push(k); } map[k].push(L); });
    return groupOrder(order).map(function (k) {
      var rows = map[k].slice();
      // Sort within each group when a column sort is active; else the
      // stable supplier / site / job-type order.
      if (s.sort.col) rows.sort(function (a, b) { return cmpRC(a, b, s.sort.col, s.sort.dir); });
      else rows.sort(rowSort);
      var collapsed = !!RC.state.collapsed[k];
      return groupHeader(k, rows, collapsed) + (collapsed ? "" : rows.map(dataRow).join(""));
    }).join("");
  }

  function groupHeader(key, rows, collapsed) {
    var flags = [];
    var miss = rows.filter(function (L) { return L.v.markup == null; }).length;
    if (miss) flags.push('<span class="rc2-gf rc2-gf--err">' + ico("Alert") + miss + ' missing markup</span>');
    var gap = rows.filter(function (L) { return L.payGap; }).length;
    if (gap) flags.push('<span class="rc2-gf rc2-gf--warn">' + gap + ' pay-source gap</span>');
    var ov = rows.filter(isOverridden).length;
    if (ov) flags.push('<span class="rc2-gf">' + ico("Pin") + ov + ' override' + (ov === 1 ? "" : "s") + '</span>');
    var ed = rows.filter(isEdited).length;
    if (ed) flags.push('<span class="rc2-gf rc2-gf--edit">' + ico("Edit") + ed + ' edited</span>');
    var nSup = {}; rows.forEach(function (L) { nSup[L.supplier] = 1; });
    var icon = RC.state.groupBy === "supplier" ? "Building" : RC.state.groupBy === "site" ? "Location" : "Tag";
    var count = (RC.state.groupBy === "supplier" || scoped())
      ? rows.length + ' line' + (rows.length === 1 ? "" : "s")
      : rows.length + ' line' + (rows.length === 1 ? "" : "s") + ' \u00b7 ' + Object.keys(nSup).length + ' supplier' + (Object.keys(nSup).length === 1 ? "" : "s");
    return '<tr class="rc2-grp"><td colspan="' + colCount() + '"><div class="rc2-grp-row">' +
      '<button class="rc2-grp-toggle' + (collapsed ? "" : " is-open") + '" data-rc-toggle="' + esc(key) + '">' + ico("ChevronRight") + '</button>' +
      ico(icon, "rc2-grp-ic") +
      '<span class="rc2-grp-name">' + esc(key) + '</span>' +
      '<span class="rc2-grp-count">' + count + '</span>' +
      '<span class="rc2-gflags">' + flags.join("") + '</span>' +
    '</div></td></tr>';
  }

  function parityChip(L) {
    if (scoped()) return "";   // scoped agency view shows parity in its own Tenure column
    if (L.parity == null) return "";
    var cls = L.parity === "Post" ? "post" : "pre";
    return '<span class="rc2-par rc2-par--' + cls + '">' + L.parity + '</span>';
  }
  function rowFlags(L) {
    var out = "";
    if (L.payGap) out += '<span class="rc2-tag rc2-tag--gap" title="No matched rate in Pay Rate Configuration">' + ico("Alert") + 'Pay-source gap</span>';
    if (isOverridden(L)) out += '<span class="rc2-tag rc2-tag--ov" title="One or more inputs overridden for this line">' + ico("Pin") + 'Override</span>';
    if (isEdited(L)) out += '<span class="rc2-tag rc2-tag--edit" title="Edited \u2014 staged, not live">' + ico("Edit") + 'Edited</span>';
    return out ? '<div class="rc2-rowflags">' + out + '</div>' : "";
  }

  // editable cell with the inline scope / override (unlink) control
  function editCell(L, field, opts) {
    opts = opts || {};
    if (RC.state.readOnly) {
      var roVal;
      if (field === "levy") roVal = L.v.levy ? "Yes" : '<span class="rc2-none">No</span>';
      else if (field === "markup") {
        var rmiss = L.v.markup == null || L.v.markup === "";
        roVal = rmiss ? '<span class="rc2-none">\u2014</span>' : gbp(L.v.markup);
      }
      else if (field === "sick") roVal = gbp(L.v.sick);
      else roVal = esc(String(L.v[field]));   // hours, penPct — unit appended by the column
      return '<span class="rc2-roval">' + roVal + '</span>';
    }
    var pinned = L.pin[field];
    var input;
    if (field === "levy") {
      input = '<button class="rc2-levy' + (L.v.levy ? " is-on" : "") + '" data-rc-levy data-rc-id="' + L.id + '" role="switch" aria-checked="' + (L.v.levy ? "true" : "false") + '">' + (L.v.levy ? "Yes" : "No") + '</button>';
    } else if (field === "markup") {
      var miss = L.v.markup == null || L.v.markup === "";
      input = '<span class="rc2-money"><span class="rc2-cur">\u00a3</span><input type="number" step="0.01" min="0" class="rc2-in rc2-in--money' + (miss ? " is-err" : "") + '" data-rc-edit="markup" data-rc-id="' + L.id + '" value="' + (miss ? "" : L.v.markup) + '" placeholder="0.00" aria-label="Markup" /></span>';
    } else {
      var step = field === "penPct" ? "0.1" : field === "hours" ? "0.5" : "0.01";
      input = '<input type="number" step="' + step + '" min="0" class="rc2-in rc2-in--sm" data-rc-edit="' + field + '" data-rc-id="' + L.id + '" value="' + L.v[field] + '" aria-label="' + esc(opts.label || field) + '" />';
    }
    var scopeName = isSup(field) ? L.supplier : (L.supplier + " \u00b7 " + L.pos);
    var title = pinned ? "Overridden for this line \u2014 click to re-link to " + scopeName : "Shared across " + scopeName + " \u2014 click to override this line only";
    var pin = '<button class="rc2-pin' + (pinned ? " is-on" : "") + '" data-rc-pin="' + field + '" data-rc-id="' + L.id + '" title="' + esc(title) + '" aria-label="' + esc(title) + '">' + ico(pinned ? "Pin" : "Link") + '</button>';
    return '<div class="rc2-edit">' + input + pin + '</div>';
  }

  function netCell(L) {
    return '<span class="rc2-net' + (L.payGap ? " is-gap" : "") + '">' + gbp(L.net) + (L.payGap ? '<span class="rc2-net-gap" title="No Pay Rate Configuration source \u2014 assumed NMW floor">NMW \u00b7 gap</span>' : '<span class="rc2-net-src">from \u2462</span>') + '</span>';
  }
  function dv(v) { return v == null ? '<span class="rc2-none">\u2014</span>' : '<span class="rc2-dvv">' + gbp(v) + '</span>'; }
  function anchorCell(b) {
    if (b.billInc == null) return '<td class="rc2-anchor" data-empty>' + '<span class="rc2-none">\u2014 needs markup</span></td>';
    return '<td class="rc2-anchor"><span class="rc2-anchor-v">' + gbp(b.billInc) + '</span>' +
      '<span class="rc2-anchor-sub">' + (RC.state.colGroup === "burden" ? "incl " + gbp(b.vat) + " VAT" : "pre-VAT " + gbp(b.billPre)) + '</span></td>';
  }

  function statusCell(L) {
    var sev = rowSeverity(L);
    if (sev === "err") return '<span class="rc2-stat rc2-stat--err" title="Missing markup">' + ico("Alert") + '</span>';
    if (sev === "warn") return '<span class="rc2-stat rc2-stat--warn" title="' + esc(rowIssues(L).map(function (x) { return x.t; }).join(" \u00b7 ")) + '">' + ico("Information") + '</span>';
    return '<span class="rc2-stat rc2-stat--ok" title="Valid">' + ico("Check") + '</span>';
  }
  function dataRow(L) {
    var b = calc(L), sev = rowSeverity(L), all = RC.state.colGroup === "all";
    var cells = colsRC().map(function (c) { return c.cell(L, b, all); }).join("");
    return '<tr class="rc2-row rc2-row--' + sev + '" data-rc-row="' + L.id + '">' +
      cells +
      '<td class="rc2-statcell">' + statusCell(L) + '</td>' +
      '<td class="rc2-expcell"><button class="rc2-exp' + (RC.state.drawer === L.id ? " is-on" : "") + '" data-rc-expand="' + L.id + '" aria-label="Show burden build">' + ico("Calculate") + '</button></td>' +
    '</tr>';
  }

  /* ------------------------------------------------------------------ drawer */
  function drawer() {
    var id = RC.state.drawer;
    if (!id) return "";
    var L = lineById(id); if (!L) return "";
    var b = calc(L);
    function wf(label, tier, amount, opts) {
      opts = opts || {};
      var cls = tier === "Pay" ? "pay" : tier === "Agency" ? "agency" : "engine";
      var amt = amount == null ? "\u2014" : (opts.plus ? "+ " : "") + gbp(amount);
      return '<div class="rc2-wf-line' + (opts.sum ? " is-sum" : "") + (opts.total ? " is-total" : "") + '">' +
        '<span class="rc2-wf-label">' + label + '</span>' +
        '<span class="rc2-wf-tier rc2-wf-tier--' + cls + '">' + esc(tier) + (opts.note ? " \u00b7 " + esc(opts.note) : "") + '</span>' +
        '<span class="rc2-wf-amt">' + amt + '</span>' +
      '</div>';
    }
    var lines =
      wf("Nominal net pay", "Pay", b.net, { note: L.payGap ? "NMW \u00b7 pay-source gap" : "from \u2462" }) +
      wf("WTR " + b.wtrPct.toFixed(2) + "%" + (L.parity === "Post" ? " (parity)" : ""), "Engine", b.wtr, { plus: true, note: "statutory" }) +
      wf("Employer NI " + ENG.niPct + "% &gt; \u00a3" + ENG.niThresh + "/wk", "Engine", b.eni, { plus: true, note: "statutory" }) +
      wf("Pension \u00d7 " + b.penPct + "%", "Agency", b.pen, { plus: true }) +
      wf("Apprenticeship levy " + ENG.levyPct + "%", "Engine", b.levy, { plus: true, note: b.levyOn ? "included" : "off" }) +
      wf("Sick pay", "Agency", b.sick, { plus: true }) +
      wf("Direct cost", "Engine", b.direct, { sum: true }) +
      wf("Markup", "Agency", b.markup, { plus: true }) +
      wf("Bill rate (pre-VAT)", "Engine", b.billPre, { sum: true }) +
      wf("VAT " + VAT + "%", "Engine", b.vat, { plus: true }) +
      wf("Bill incl VAT", "Agency", b.billInc, { total: true });
    var marginPill = b.marginPct == null ? '<span class="rc2-dr-margin rc2-dr-margin--na">no markup</span>'
      : '<span class="rc2-dr-margin">margin ' + b.marginPct.toFixed(1) + '%</span>';
    return '<div class="rc2-scrim" data-rc-drawer-close></div>' +
      '<aside class="rc2-drawer" role="dialog" aria-label="Burden build">' +
        '<div class="rc2-dr-head"><div>' +
          '<div class="rc2-dr-eyebrow">Burden build</div>' +
          '<div class="rc2-dr-title">' + esc(L.supplier) + '</div>' +
          '<div class="rc2-dr-sub">' + esc(L.site) + ' \u00b7 ' + esc(L.jt) + (L.parity ? ' \u00b7 ' + L.parity + '-parity' : "") + ' \u00b7 ' + b.hrs + 'h/wk</div>' +
        '</div><button class="rc2-dr-x" data-rc-drawer-close aria-label="Close">' + ico("Cancel") + '</button></div>' +
        '<div class="rc2-dr-anchor"><span class="rc2-dr-anchor-l">Bill incl VAT</span><span class="rc2-dr-anchor-v">' + (b.billInc == null ? "\u2014" : gbp(b.billInc)) + '</span>' + marginPill + '</div>' +
        '<div class="rc2-wf">' + lines + '</div>' +
        '<div class="rc2-dr-legend">' +
          '<span class="rc2-wf-tier rc2-wf-tier--pay">Pay</span> from \u2462 \u00b7 ' +
          '<span class="rc2-wf-tier rc2-wf-tier--engine">Engine</span> statutory / pack \u00b7 ' +
          '<span class="rc2-wf-tier rc2-wf-tier--agency">Agency</span> supplier-owned (editable)' +
        '</div>' +
        '<p class="rc2-dr-note">' + ico("Information") + 'Each line names the input that produced it. Edit the Agency-tagged inputs in the row \u2014 the burden re-runs and this bill moves live.</p>' +
      '</aside>';
  }

  /* ------------------------------------------------------------------ edits */
  function lineById(id) { for (var i = 0; i < RC.state.lines.length; i++) if (RC.state.lines[i].id === id) return RC.state.lines[i]; return null; }
  function num(field, raw) {
    if (field === "markup") { var m = parseFloat(raw); return (raw === "" || isNaN(m)) ? null : r2(m); }
    var n = parseFloat(raw); return isNaN(n) ? 0 : n;
  }
  // write a value, propagating to scope unless this line is pinned
  function setField(L, field, value) {
    if (L.pin[field]) { L.v[field] = value; return { scope: "this line only", n: 1, line: true }; }
    var sibs = siblings(L, field).filter(function (x) { return !x.pin[field]; });
    sibs.forEach(function (x) { x.v[field] = value; });
    var scopeName = isSup(field) ? L.supplier : (L.supplier + " \u00b7 " + L.pos);
    return { scope: scopeName, n: sibs.length, line: false };
  }
  function fieldLabel(field) { return ({ markup: "Markup", penPct: "Pension", hours: "Hours", sick: "Sick pay", levy: "Levy" })[field]; }
  function fieldValueText(field, value) {
    if (field === "markup") return value == null ? "\u2014" : gbp(value);
    if (field === "penPct") return value + "%";
    if (field === "hours") return value + "h/wk";
    if (field === "sick") return gbp(value);
    if (field === "levy") return value ? "included" : "off";
    return value;
  }
  function applyEdit(L, field, value) {
    var res = setField(L, field, value);
    var msg = fieldLabel(field) + " " + fieldValueText(field, value) + " \u2192 " +
      (res.line ? "this line only (override)" : res.scope + " \u00b7 " + res.n + " line" + (res.n === 1 ? "" : "s"));
    toast(msg);
  }
  function togglePin(L, field) {
    L.pin[field] = !L.pin[field];
    if (!L.pin[field]) {
      var sib = siblings(L, field).filter(function (x) { return x !== L && !x.pin[field]; })[0];
      if (sib) L.v[field] = sib.v[field];
      toast(fieldLabel(field) + " re-linked to " + (isSup(field) ? L.supplier : L.supplier + " \u00b7 " + L.pos));
    } else {
      toast(fieldLabel(field) + " unlinked \u2014 edits to this line no longer propagate");
    }
  }
  function resetAll() { RC.state.lines.forEach(function (L) { L.v = clone(L.orig); L.pin = clone(L.origPin); }); RC._render(); toast("Reset every line to uploaded values"); }

  /* ------------------------------------------------------------------ events */
  RC._wireOnce = function () {
    if (RC._wired) return;
    RC._wired = true;

    document.addEventListener("click", function (ev) {
      var root = RC._root; if (!root) return;
      var t = ev.target.closest("[data-rc-toggle],[data-rc-expand],[data-rc-levy],[data-rc-pin],[data-rc-chip],[data-rc-clearfilters],[data-rc-resetall],[data-rc-group],[data-rc-sort],[data-rc-drawer-close]");
      if (!t || !root.contains(t)) return;
      var s = RC.state; if (!s) return;

      if (t.hasAttribute("data-rc-group")) {
        s.groupBy = t.getAttribute("data-rc-group"); s.collapsed = {};
        RC._render(); return;
      }
      if (t.hasAttribute("data-rc-sort")) {
        var cid = t.getAttribute("data-rc-sort");
        if (s.sort.col !== cid) { s.sort.col = cid; s.sort.dir = 1; }
        else if (s.sort.dir === 1) { s.sort.dir = -1; }
        else { s.sort = { col: null, dir: 1 }; }
        RC._render(); return;
      }
      if (t.hasAttribute("data-rc-resetview")) {
        s.groupBy = "none"; s.sort = { col: null, dir: 1 };
        s.f = { site: "all", jt: "all", pos: "all", parity: "all" };
        s.quick = { edits: false, overrides: false, levyoff: false, pen3: false, paygap: false };
        s.search = ""; s.collapsed = {};
        toast("Reset to template view"); RC._render(); return;
      }
      if (t.hasAttribute("data-rc-chip")) {
        var k = t.getAttribute("data-rc-chip");
        if (k === "missing") { s.search = ""; }            // banner "Show" for missing markup
        else { s.quick[k] = !s.quick[k]; }
        RC._render(); return;
      }
      if (t.hasAttribute("data-rc-clearfilters")) {
        s.f = { site: "all", jt: "all", pos: "all", parity: "all" };
        s.quick = { edits: false, overrides: false, levyoff: false, pen3: false, paygap: false };
        s.search = ""; RC._render(); return;
      }
      if (t.hasAttribute("data-rc-toggle")) { var key = t.getAttribute("data-rc-toggle"); s.collapsed[key] = !s.collapsed[key]; RC._render(); return; }
      if (t.hasAttribute("data-rc-expand")) { var id = t.getAttribute("data-rc-expand"); s.drawer = (s.drawer === id ? null : id); RC._render(); return; }
      if (t.hasAttribute("data-rc-drawer-close")) { s.drawer = null; RC._render(); return; }
      if (t.hasAttribute("data-rc-levy")) { var lr = lineById(t.getAttribute("data-rc-id")); if (lr) { applyEdit(lr, "levy", !lr.v.levy); RC._render(); } return; }
      if (t.hasAttribute("data-rc-pin")) { var pr = lineById(t.getAttribute("data-rc-id")); if (pr) { togglePin(pr, t.getAttribute("data-rc-pin")); RC._render(); } return; }
      if (t.hasAttribute("data-rc-resetall")) { resetAll(); return; }
    });

    document.addEventListener("change", function (ev) {
      var root = RC._root; if (!root) return;
      var t = ev.target.closest("[data-rc-f],[data-rc-edit]");
      if (!t || !root.contains(t)) return;
      var s = RC.state; if (!s) return;
      if (t.hasAttribute("data-rc-f")) { s.f[t.getAttribute("data-rc-f")] = t.value; RC._render(); return; }
      if (t.hasAttribute("data-rc-edit")) {
        var field = t.getAttribute("data-rc-edit"), L = lineById(t.getAttribute("data-rc-id")); if (!L) return;
        applyEdit(L, field, num(field, t.value)); RC._render(); return;
      }
    });

    // search is live + focus-preserving
    var qTimer = null;
    document.addEventListener("input", function (ev) {
      var root = RC._root; if (!root) return;
      var t = ev.target.closest("[data-rc-search]");
      if (!t || !root.contains(t)) return;
      RC.state.search = t.value;
      clearTimeout(qTimer);
      qTimer = setTimeout(function () {
        var pos = t.selectionStart; RC._render();
        var ni = RC._root.querySelector("[data-rc-search]");
        if (ni) { ni.focus(); try { ni.setSelectionRange(pos, pos); } catch (x) {} }
      }, 200);
    });

    document.addEventListener("keydown", function (ev) {
      if (ev.key === "Enter" && ev.target.classList && ev.target.classList.contains("rc2-in")) { ev.preventDefault(); ev.target.blur(); }
      if (ev.key === "Escape" && RC.state && RC.state.drawer) { RC.state.drawer = null; RC._render(); }
    });
  };

})();
