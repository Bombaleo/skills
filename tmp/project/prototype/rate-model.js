/* =====================================================================
   Rate Card — "③ Pay rate configuration"   v0.22
   ---------------------------------------------------------------------
   Implements uploads/PayRateEngine_Step_Spec.md, adapted by
   uploads/Pay_Rate_Config_Adapt_Spec.md: the step renders the full pay
   recipe (pay.pdf columns) populated with the uploaded values, viewable
   by dimension via a column-group switch (Net pay by day-type / Rate
   build). The recipe (columns) is read-only; the values are editable
   and staged until Activate.

   What this step does (the three jobs from §1):
     1. Show ALL of the client's pay rates in one table — no mandatory
        scope first (§3). Group-by (§3) + filters (§3) re-cut and slice
        the same single set.
     2. Make HOW a rate is calculated legible — base → NMW floor → pay
        rate in-table, the full level-by-level build in a side drawer
        (§4), tier-tagged Pay / Engine. Truthful blanks, never
        synthesized multiplier values.
     3. Let the user EDIT the pay DATA (§5) — base hourly, geo, day-type
        rates — never the recipe or derived/statutory values. NMW floor
        enforced live; bulk edit first-class; edits marked, resettable,
        staged and audited.

   The RECIPE is a read-only input (§2): it defines the dimensions, the
   day-type set (Standard/Friday/Saturday/Sunday/Overtime), the floor
   rule and the burden components. This view renders that shape — it
   never lets the user change it.

   Mounts into #rm-root.  IA version: V1.  Everest tokens only.
   ===================================================================== */
(function () {
  "use strict";
  var C = window.RPCore;
  if (!C) return;
  var gbp = C.gbp, r2 = C.r2, esc = C.esc, ico = C.ico, toast = C.toast, ENG = C.ENG;

  function signed(n) { return (n >= 0 ? "+" : "\u2212") + "\u00a3" + Math.abs(n).toFixed(2); }

  // ---- recipe (read-only input this view renders) -------------------
  var NMW = 12.21;                 // age-band floor — recipe: UK NMW 21+
  var PARITY_UP = 0.07;            // AWR parity uplift (indicative)
  var ENG_V = "v0.82";
  var RECIPE = {
    client: "Evri",
    dims: ["Region tier", "Site", "Job type", "Role", "Parity"],
    dayTypes: ["std", "fri", "sat", "sun", "ot"],
  };
  var DT = [
    { k: "std", label: "Standard", short: "Std" },
    { k: "fri", label: "Friday", short: "Fri" },
    { k: "sat", label: "Saturday", short: "Sat" },
    { k: "sun", label: "Sunday", short: "Sun" },
    { k: "ot", label: "Overtime", short: "OT" },
  ];

  // ---- role catalogue (national, uploaded values) -------------------
  //  prof = which day-types the recipe carries a value for, per role:
  //    full = fri+sat+sun + ot premium · noot = fri+sat+sun, no ot
  //    wknd = sat+sun only · std = Standard only
  //  wkUp = weekend uplift (£/hr) the recipe adds to Sat/Sun over Standard
  //    (Friday carries no uplift in this book). Omitted → Sat/Sun flat = Std.
  var ROLES = {
    "Warehouse Operative AM":    { jt: "Warehouse",   base: 9.85,  hrs: 37.5, prof: "full", wkUp: 0.28 },
    "Warehouse Operative PM":    { jt: "Warehouse",   base: 11.50, hrs: 37.5, prof: "full", wkUp: 0.43 },
    "Warehouse Operative Night": { jt: "Warehouse",   direct: 13.40, hrs: 37.5, prof: "wknd", wkUp: 0.39 },
    "Induction":                 { jt: "Warehouse",   direct: 12.21, hrs: 37.5, prof: "std" },
    "Picker / Packer":           { jt: "Warehouse",   base: 10.20, hrs: 37.5, prof: "noot" },
    "Goods-in Operative":        { jt: "Warehouse",   base: 12.40, hrs: 37.5, prof: "noot" },
    "Team Leader":               { jt: "Warehouse",   base: 13.50, hrs: 37.5, prof: "full", wkUp: 0.50 },
    "Cleaner":                   { jt: "Warehouse",   base: 12.30, hrs: 37.5, prof: "noot" },
    "HGV Class 1":               { jt: "HGV Driver",  direct: 16.50, hrs: 45,  prof: "wknd", wkUp: 0.60 },
    "HGV Class 2":               { jt: "HGV Driver",  direct: 15.20, hrs: 45,  prof: "wknd", wkUp: 0.55 },
    "Van Driver":                { jt: "Van Driver",  direct: 13.00, hrs: null, prof: "std" }, // hours not set → gap
    "FLT Driver":                { jt: "Warehouse",   direct: 13.80, hrs: 40,  prof: "wknd", wkUp: 0.35 },
    "7.5T Driver":               { jt: "HGV Driver",  direct: 14.10, hrs: 45,  prof: "wknd", wkUp: 0.45 },
  };
  function profAvail(p) {
    return {
      fri: p === "full" || p === "noot",
      sat: p === "full" || p === "noot" || p === "wknd",
      sun: p === "full" || p === "noot" || p === "wknd",
      ot: p === "full",
    };
  }

  // ---- which rates exist where (counts grounded in the spec) --------
  //  [role, parityCount]  parityCount 2 → Pre+Post · 1 → Pre only
  var PLAN = {
    Barnsley: [
      ["Warehouse Operative AM", 2], ["Picker / Packer", 2],
      ["Warehouse Operative Night", 2], ["Induction", 2], ["Goods-in Operative", 2],
      ["Team Leader", 2], ["Cleaner", 2], ["HGV Class 1", 2], ["HGV Class 2", 2],
      ["Van Driver", 2], ["FLT Driver", 2], ["7.5T Driver", 2],
    ],
    Nuneaton: [
      ["Warehouse Operative AM", 2], ["Warehouse Operative PM", 2], ["HGV Class 1", 2],
    ],
    Rugby: [
      ["Warehouse Operative AM", 2], ["Picker / Packer", 1],
      ["Warehouse Operative Night", 2], ["Induction", 2], ["Goods-in Operative", 2],
      ["Team Leader", 2], ["Cleaner", 2], ["HGV Class 1", 2], ["HGV Class 2", 2],
      ["Van Driver", 2], ["FLT Driver", 2], ["7.5T Driver", 2],
    ],
    Warrington: [
      ["Warehouse Operative AM", 2], ["Picker / Packer", 1],
      ["Warehouse Operative Night", 2], ["Induction", 2], ["Goods-in Operative", 2],
      ["Team Leader", 2], ["Cleaner", 2], ["HGV Class 1", 2], ["HGV Class 2", 2],
      ["FLT Driver", 2], ["7.5T Driver", 2], ["Van Driver", 1],
    ],
    Wednesbury: [
      ["Warehouse Operative AM", 2], ["HGV Class 1", 2],
    ],
  };
  var SITES = Object.keys(PLAN);
  var JOBTYPES = ["Warehouse", "HGV Driver", "Van Driver"];

  // ---- build the uploaded dataset (memoized) ------------------------
  var DATA = null;
  function buildData() {
    if (DATA) return DATA;
    var rows = [], n = 0;
    SITES.forEach(function (site) {
      PLAN[site].forEach(function (entry) {
        var role = entry[0], cat = ROLES[role], avail = profAvail(cat.prof);
        var pars = entry[1] === 2 ? ["Pre", "Post"] : ["Pre"];
        pars.forEach(function (par) {
          var bump = par === "Post" ? PARITY_UP : 0;
          var base = cat.base != null ? r2(cat.base + bump) : null;
          var direct = cat.direct != null ? r2(cat.direct + bump) : null;
          var geo = 0;
          var std = base != null ? r2(Math.max(base + geo, NMW)) : direct;
          var wk = cat.wkUp ? r2(std + cat.wkUp) : std;   // weekend (Sat/Sun) net pay
          var dt = {
            std: std,
            fri: avail.fri ? std : null,    // Friday carries no uplift in this book
            sat: avail.sat ? wk : null,
            sun: avail.sun ? wk : null,
            ot: avail.ot ? r2(std * 1.5) : null,
          };
          rows.push({
            id: "r" + (n++), site: site, role: role, jt: cat.jt, parity: par,
            tier: "National", hrs: cat.hrs, prof: cat.prof, avail: avail,
            _base: base, _geo: geo, _direct: direct, _dt: dt,
          });
        });
      });
    });
    DATA = rows;
    return rows;
  }

  // ---- effective (edited-or-uploaded) value accessors ---------------
  var S = null;
  function ed(r) { return S.edits[r.id]; }
  function effBase(r) { var e = ed(r); return (e && e.base != null) ? e.base : r._base; }
  function effGeo(r) { var e = ed(r); return (e && e.geo != null) ? e.geo : r._geo; }
  function effDirect(r) { var e = ed(r); return (e && e.direct != null) ? e.direct : r._direct; }
  function effDt(r, k) { var e = ed(r); if (e && e.dt && e.dt[k] != null) return e.dt[k]; return r._dt[k]; }
  function effHrs(r) { var e = ed(r); return (e && e.hrs != null) ? e.hrs : r.hrs; }

  function isDirect(r) { return r._base == null; }
  function basicGeo(r) { return r2(effBase(r) + effGeo(r)); }
  function payStd(r) { return isDirect(r) ? effDirect(r) : r2(Math.max(basicGeo(r), NMW)); }
  function floored(r) { return !isDirect(r) && basicGeo(r) < NMW - 0.001; }
  function floorLift(r) { return r2(NMW - basicGeo(r)); }
  function hasGap(r) { return effHrs(r) == null; }
  function hasOt(r) { return effDt(r, "ot") != null; }
  function isEdited(r) {
    var e = ed(r); if (!e) return false;
    if (e.base != null && Math.abs(e.base - r._base) >= 0.005) return true;
    if (e.geo != null && Math.abs(e.geo - r._geo) >= 0.005) return true;
    if (e.direct != null && r._direct != null && Math.abs(e.direct - r._direct) >= 0.005) return true;
    if (e.dt) { for (var k in e.dt) { if (e.dt[k] != null && (r._dt[k] == null || Math.abs(e.dt[k] - r._dt[k]) >= 0.005)) return true; } }
    if (e.hrs != null && (r.hrs == null || Math.abs(e.hrs - r.hrs) >= 0.005)) return true;
    return false;
  }
  // day-type value, returning the current standard for std (it is derived)
  function dtVal(r, k) { return k === "std" ? payStd(r) : effDt(r, k); }

  // ---- statutory burden (indicative — WTR + Employer NI only) -------
  function burden(r) {
    var pay = payStd(r), hrs = effHrs(r);
    if (hrs == null) return null;
    var wtrPct = r.parity === "Post" ? ENG.wtrPar : ENG.wtrStd;
    var wtr = r2(pay * wtrPct / 100);
    var eni = r2(((pay + wtr) * hrs - ENG.niThresh) * ENG.niPct / 100 / hrs);
    return { pay: pay, wtrPct: wtrPct, wtr: wtr, eni: eni, total: r2(pay + wtr + eni) };
  }

  // ============================================================ state
  var RM = {};
  window.RM = RM;
  RM.reset = function () { RM.state = null; };
  // The rate-card position catalogue — every pay rate role and the job type
  // it belongs to (e.g. "Warehouse Operative AM" → "Warehouse"), drawn
  // straight from the uploaded rate card. Consumed by Settings → Positions.
  RM.catalog = function () {
    var seen = {}, jobTypes = [];
    var positions = Object.keys(ROLES).map(function (name) {
      var jt = ROLES[name].jt;
      if (!seen[jt]) { seen[jt] = 1; jobTypes.push(jt); }
      return { name: name, jt: jt };
    });
    // Surface any job type the recipe knows even if no role uses it yet.
    JOBTYPES.forEach(function (jt) { if (!seen[jt]) { seen[jt] = 1; jobTypes.push(jt); } });
    return { positions: positions, jobTypes: jobTypes };
  };
  RM._build = function (opts) {
    RM.state = {
      _key: opts.key || "k",
      q: "",
      f: { tier: "all", site: "all", jt: "all", parity: "all" },
      quick: { floored: false, gaps: false, ot: false, edited: false },
      groupBy: "none",
      colGroup: "all",         // "all" | "daytype" | "build" — recipe column-group switch
      sort: { col: null, dir: 1 },   // column-header sort; null col = template order
      collapsed: {},
      sel: {},
      edits: {},
      drawer: null,
      bulk: { op: "flat", val: "" },
      canEdit: true,
    };
  };
  RM.mount = function (root, opts) {
    opts = opts || {};
    RM._root = root;
    if (!root) return;
    if (!RM.state || RM.state._key !== (opts.key || "k")) RM._build(opts);
    S = RM.state;
    S.canEdit = opts.canEdit !== false;   // read-only when canEdit:false (e.g. version detail)
    buildData();
    RM._render();
    RM._wireOnce();
  };

  // ============================================================ filtering
  function rowsFiltered() {
    var f = S.f, q = S.q.trim().toLowerCase();
    return buildData().filter(function (r) {
      if (f.tier !== "all" && r.tier !== f.tier) return false;
      if (f.site !== "all" && r.site !== f.site) return false;
      if (f.jt !== "all" && r.jt !== f.jt) return false;
      if (f.parity !== "all" && r.parity !== f.parity) return false;
      if (q && r.role.toLowerCase().indexOf(q) < 0 && r.site.toLowerCase().indexOf(q) < 0) return false;
      if (S.quick.floored && !floored(r)) return false;
      if (S.quick.gaps && !hasGap(r)) return false;
      if (S.quick.ot && !hasOt(r)) return false;
      if (S.quick.edited && !isEdited(r)) return false;
      return true;
    });
  }
  function groupKey(r) {
    if (S.groupBy === "tier") return r.tier;
    if (S.groupBy === "jt") return r.jt;
    if (S.groupBy === "role") return r.role;
    if (S.groupBy === "parity") return r.parity + "-parity";
    if (S.groupBy === "none") return "All rates";
    return r.site;
  }
  function groupOf(rows) {
    var map = {}, order = [];
    rows.forEach(function (r) { var k = groupKey(r); if (!map[k]) { map[k] = []; order.push(k); } map[k].push(r); });
    var groups = order.map(function (k) { return { key: k, rows: map[k] }; });
    // Sort is an opt-in transform applied WITHIN each group (and across the
    // single group when ungrouped). No sort = template row order.
    if (S.sort.col) groups.forEach(function (g) {
      g.rows = g.rows.slice().sort(function (a, b) { return cmpRows(a, b, S.sort.col, S.sort.dir); });
    });
    return groups;
  }

  // ============================================================ render
  RM._render = function () {
    if (!RM._root) return;
    S = RM.state;
    var rows = rowsFiltered();
    RM._root.innerHTML =
      toolbar() +
      bulkBar() +
      countLine(rows) +
      colGroupLegend() +
      (rows.length ? grid(rows) : emptyState()) +
      stagedNote() +
      drawer();
    if (window.Proto) window.Proto.fillIcons(RM._root);
  };

  function colGroupLegend() {
    var title, desc;
    if (S.colGroup === "build") {
      title = "Rate build";
      desc = "How each Standard rate is derived. Hourly rate and Hourly geo are editable; Basic + geo, NMW floor and Standard are derived.";
    } else if (S.colGroup === "daytype") {
      title = "Net pay by day-type";
      desc = "The operative pay per day-type. Standard is derived from the rate build; Friday – Overtime are editable net-pay inputs.";
    } else {
      title = "All columns · template view";
      desc = "Your uploaded template in full — every column, in template order, as one flat list. Hourly rate, Hourly geo and the day-type net pays are editable; Basic + geo, NMW floor and Standard are derived.";
    }
    return '<div class="rm-legend">' +
      '<div class="rm-legend-main">' +
        '<span class="rm-legend-title">' + title + '</span>' +
        '<span class="rm-legend-desc">' + desc + '</span>' +
      '</div>' +
      '<div class="rm-legend-keys">' +
        '<span class="rm-legend-k"><span class="rm-swatch rm-swatch--in"></span>Editable</span>' +
        '<span class="rm-legend-k"><span class="rm-swatch rm-swatch--dv"></span>Derived</span>' +
      '</div>' +
    '</div>';
  }

  function toolbar() {
    var f = S.f;
    function sel(name, val, opts) {
      return '<label class="rm-fl"><span class="rm-fl-l">' + esc(name) + '</span>' +
        '<select class="rm-select" data-rm-f="' + name.toLowerCase().replace(/\s/g, "") + '">' +
        opts.map(function (o) {
          var v = typeof o === "string" ? o : o.v, l = typeof o === "string" ? o : o.l;
          return '<option value="' + esc(v) + '"' + (v === val ? " selected" : "") + '>' + esc(l) + '</option>';
        }).join("") + '</select></label>';
    }
    // Group by is a segmented tab \u2014 None first, Site second, then the rest.
    var groupSeg = '<div class="rm-seg" role="group" aria-label="Group by">' +
      [["none", "None"], ["site", "Site"], ["tier", "Region tier"], ["jt", "Job type"], ["role", "Role"], ["parity", "Parity"]].map(function (g) {
        return '<button class="rm-seg-btn' + (g[0] === S.groupBy ? " is-on" : "") + '" data-rm-group="' + g[0] + '" aria-pressed="' + (g[0] === S.groupBy ? "true" : "false") + '">' + g[1] + '</button>';
      }).join("") +
    '</div>';

    return '<div class="rm-toolbar">' +
      '<div class="rm-tb-row rm-tb-top">' +
        '<div class="rm-search">' + ico("Search") +
          '<input class="rm-search-in" type="text" placeholder="Search roles or sites\u2026" value="' + esc(S.q) + '" data-rm-q aria-label="Search rates" />' +
          (S.q ? '<button class="rm-search-x" data-rm-qclear aria-label="Clear search">' + ico("Cancel") + '</button>' : "") +
        '</div>' +
        sel("Tier", f.tier, [{ v: "all", l: "All tiers" }, "National", "London"]) +
        sel("Site", f.site, [{ v: "all", l: "All sites" }].concat(SITES)) +
        sel("Job type", f.jt, [{ v: "all", l: "All job types" }].concat(JOBTYPES)) +
        sel("Parity", f.parity, [{ v: "all", l: "All parity" }, { v: "Pre", l: "Pre-parity" }, { v: "Post", l: "Post-parity" }]) +
      '</div>' +
      '<div class="rm-tb-row rm-tb-bottom">' +
        '<label class="rm-fl rm-fl--group"><span class="rm-fl-l">Group by</span>' + groupSeg + '</label>' +
        '<div class="rm-tb-right">' +
          (viewTransformed() ? '<button class="rm-link-btn" data-rm-resetview>' + ico("Undo") + 'Reset to template view</button>' : "") +
          (anyEdits() ? '<button class="rm-link-btn" data-rm-resetall>' + ico("Undo") + 'Reset all edits</button>' : "") +
        '</div>' +
      '</div>' +
    '</div>';
  }

  function editToggle() {
    return '<button class="rm-access" data-rm-access aria-pressed="' + (S.canEdit ? "true" : "false") + '">' +
      ico(S.canEdit ? "Unlock" : "Lock") +
      '<span>' + (S.canEdit ? "Editing pay" : "View only") + '</span>' +
    '</button>';
  }

  function anyEdits() { return buildData().some(isEdited); }

  // Is the view transformed away from the as-uploaded template mirror?
  function viewTransformed() {
    return S.groupBy !== "none" || S.colGroup !== "all" || !!S.sort.col || activeFilterLabels().length > 0;
  }
  function countLine(rows) {
    var total = buildData().length, floors = rows.filter(floored).length;
    var fb = activeFilterLabels();
    // Neutral baseline: flat, all-columns, unsorted, unfiltered \u2014 the mirror.
    if (!viewTransformed()) {
      return '<div class="rm-count"><strong>' + rows.length + '</strong> rate' + (rows.length === 1 ? "" : "s") +
        ' <span class="rm-count-sep">\u00b7</span> <span class="rm-count-tv">template view</span></div>';
    }
    var bits = ['<strong>' + rows.length + '</strong> of ' + total + ' rate' + (total === 1 ? "" : "s")];
    if (S.groupBy !== "none") {
      var gb = ({ site: "site", tier: "region tier", jt: "job type", role: "role", parity: "parity" })[S.groupBy];
      bits.push('grouped by ' + gb);
    }
    if (S.colGroup !== "all") bits.push('focus: ' + (S.colGroup === "build" ? "rate build" : "net pay by day-type"));
    if (S.sort.col) bits.push('sorted by ' + (COL_LABELS[S.sort.col] || S.sort.col) + (S.sort.dir > 0 ? " \u2191" : " \u2193"));
    if (floors) bits.push(floors + ' floored');
    if (fb.length) bits.push('filtered: ' + fb.join(", "));
    return '<div class="rm-count">' + bits.join(' <span class="rm-count-sep">\u00b7</span> ') + '</div>';
  }
  function activeFilterLabels() {
    var out = [];
    if (S.f.tier !== "all") out.push(S.f.tier);
    if (S.f.site !== "all") out.push(S.f.site);
    if (S.f.jt !== "all") out.push(S.f.jt);
    if (S.f.parity !== "all") out.push(S.f.parity + "-parity");
    if (S.quick.floored) out.push("floored");
    if (S.quick.gaps) out.push("data gaps");
    if (S.quick.ot) out.push("has overtime");
    if (S.quick.edited) out.push("my edits");
    if (S.q.trim()) out.push('\u201c' + S.q.trim() + '\u201d');
    return out;
  }

  // ---- bulk action bar (only when rows selected & editing) ----------
  function selIds() { return Object.keys(S.sel).filter(function (k) { return S.sel[k]; }); }
  function bulkBar() {
    var ids = selIds();
    if (!ids.length || !S.canEdit) return "";
    var b = S.bulk;
    var ops = [
      ["flat", "Flat uplift (\u00a3)"],
      ["pct", "Percent uplift (%)"],
      ["set", "Set to value (\u00a3)"],
      ["rel", "Multiply by factor"],
    ];
    return '<div class="rm-bulk">' +
      '<span class="rm-bulk-count">' + ids.length + ' selected</span>' +
      '<span class="rm-bulk-sep"></span>' +
      '<select class="rm-select rm-bulk-op" data-rm-bulkop>' +
        ops.map(function (o) { return '<option value="' + o[0] + '"' + (o[0] === b.op ? " selected" : "") + '>' + o[1] + '</option>'; }).join("") +
      '</select>' +
      '<input class="rm-bulk-val" type="number" step="0.01" placeholder="' + (b.op === "pct" ? "4" : b.op === "rel" ? "1.08" : "0.20") + '" value="' + esc(b.val) + '" data-rm-bulkval aria-label="Bulk value" />' +
      '<button class="rm-btn rm-btn--primary" data-rm-bulkapply>Apply to ' + ids.length + '</button>' +
      '<button class="rm-link-btn" data-rm-bulkreset>' + ico("Undo") + 'Reset selected</button>' +
      '<button class="rm-link-btn" data-rm-selclear>Clear selection</button>' +
      '<span class="rm-bulk-note">Edits stage against every selected rate \u00b7 NMW floor enforced</span>' +
    '</div>';
  }

  function stagedNote() {
    return '<div class="rm-staged">' + ico("Information") +
      'Edits are staged and fully audited \u2014 nothing reaches live rates until Activate (\u2464). Editing pay cascades to every supplier bill rate, so it is a permissioned action.' +
    '</div>';
  }

  function emptyState() {
    return '<div class="rm-empty">' +
      '<div class="rm-empty-ic">' + ico("PersonSearch") + '</div>' +
      '<div class="rm-empty-t">No rates match these filters</div>' +
      '<div class="rm-empty-s">Try widening the tier, site or job type \u2014 or clear the quick filters.</div>' +
      '<button class="rm-btn" data-rm-clearfilters>Clear filters</button>' +
    '</div>';
  }

  // ============================================================ grid
  // The recipe's columns, populated. Driven by a descriptor model so the
  // same definitions feed the header, the sort, and the cells.
  //   colGroup "all"     \u2014 the full flat template mirror, every column in
  //                        template order (pay.pdf): Site \u00b7 Tier \u00b7 Job type \u00b7
  //                        Role \u00b7 Parity \u00b7 Weekly hours \u00b7 Hourly rate \u00b7
  //                        Hourly geo \u00b7 Basic + geo \u00b7 NMW floor \u00b7 Standard \u00b7
  //                        Friday \u00b7 Saturday \u00b7 Sunday \u00b7 Overtime.
  //   colGroup "build"   \u2014 focus: the rate build only.
  //   colGroup "daytype" \u2014 focus: the day-type net pays only.
  var COL_LABELS = { site: "site", tier: "tier", jt: "job type", role: "role", parity: "parity", hrs: "weekly hours", base: "hourly rate", geo: "hourly geo", basicgeo: "basic + geo", nmw: "NMW floor", std: "standard", fri: "Friday", sat: "Saturday", sun: "Sunday", ot: "overtime" };

  function flagsHtml(r) {
    var out = "";
    if (hasGap(r)) out += '<span class="rm-tag rm-tag--gap" title="A required input is missing">' + ico("Alert") + 'Hours not set</span>';
    if (isEdited(r)) out += '<span class="rm-tag rm-tag--edit" title="Edited \u2014 staged, not yet live">' + ico("Edit") + 'Edited</span>';
    return out ? '<span class="rm-flags">' + out + '</span>' : "";
  }

  // key (dimension) columns \u2014 in template order when showing all columns;
  // the leaner Role-first order in the two focus modes. The Site key is
  // pinned to the left in the full mirror (see .rm-table--all).
  function keyCols() {
    var all = S.colGroup === "all";
    function kcls(id) { return (all && id === "site") ? " rmk rmk--site" : ""; }
    var defs = {
      site:   { id: "site",   label: "Site",         thCls: "rm-th-key" + kcls("site"), tdCls: "rm-td-key" + kcls("site"), td: function (r) { return '<span class="rm-keyval">' + esc(r.site) + '</span>'; } },
      tier:   { id: "tier",   label: "Tier",         thCls: "rm-th-key",  tdCls: "rm-td-key", td: function (r) { return '<span class="rm-keyval rm-keyval--muted">' + esc(r.tier) + '</span>'; } },
      jt:     { id: "jt",     label: "Job type",     thCls: "rm-th-key",  tdCls: "rm-td-jt",  td: function (r) { return '<span class="rm-jt">' + esc(r.jt) + '</span>'; } },
      role:   { id: "role",   label: "Role",         thCls: "rm-th-role", tdCls: "rm-td-role", td: function (r) { return '<span class="rm-role">' + esc(r.role) + '</span>' + flagsHtml(r); } },
      parity: { id: "parity", label: "Parity",       thCls: "rm-th-key",  tdCls: "rm-td-par", td: function (r) { return '<span class="rm-par rm-par--' + r.parity.toLowerCase() + '">' + r.parity + '</span>'; } },
      hrs:    { id: "hrs",    label: "Weekly hours", thCls: "rm-th-hrs",  tdCls: "rm-td-hrs", td: function (r) { return hoursCell(r); } },
    };
    var order = all ? ["site", "tier", "jt", "role", "parity", "hrs"] : ["role", "jt", "parity", "hrs"];
    return order.map(function (k) { return defs[k]; });
  }

  // value columns. base/geo/basicgeo carry inner content + a row-dependent
  // td class; nmw/std/fri\u2026ot reuse the existing full-<td> cell builders.
  function valueCols() {
    var defs = {
      base:     { id: "base",     label: "Base Pay Rate - Hourly rate - £/hr", thCls: "rm-vh rm-vh--in", tdCls: function (r) { return isDirect(r) ? "rm-vc rm-vc--na" : "rm-vc rm-vc--in"; }, td: function (r) { return isDirect(r) ? '<span class="rm-direct">\u2014 \u00b7 direct</span>' : money(r, "base", effBase(r)); } },
      geo:      { id: "geo",      label: "Uplift - Hourly geo - £/hr", thCls: "rm-vh rm-vh--in", tdCls: function (r) { return isDirect(r) ? "rm-vc rm-vc--na" : "rm-vc rm-vc--in"; }, td: function (r) { return isDirect(r) ? '<span class="rm-na">\u2014</span>' : money(r, "geo", effGeo(r)); } },
      basicgeo: { id: "basicgeo", label: "Basic + geo", thCls: "rm-vh rm-vh--dv", tdCls: function (r) { return isDirect(r) ? "rm-vc rm-vc--na" : "rm-vc rm-vc--dv"; }, td: function (r) { return isDirect(r) ? '<span class="rm-na">\u2014</span>' : '<span class="rm-derived">' + gbp(basicGeo(r)) + '</span>'; } },
      nmw:      { id: "nmw",      label: "Base Pay Rate - NMW floor - £/hr", thCls: "rm-vh rm-vh--dv", full: floorCell },
      std:      { id: "std",      label: "Base Pay Rate - Standard - £/hr", thCls: "rm-vh rm-vh--dv", full: stdCell },
      fri:      { id: "fri",      label: "Day Specific Pay - Friday - £/hr", thCls: "rm-vh rm-vh--in", full: function (r) { return dtCell(r, "fri"); } },
      sat:      { id: "sat",      label: "Day Specific Pay - Saturday - £/hr", thCls: "rm-vh rm-vh--in", full: function (r) { return dtCell(r, "sat"); } },
      sun:      { id: "sun",      label: "Day Specific Pay - Sunday - £/hr", thCls: "rm-vh rm-vh--in", full: function (r) { return dtCell(r, "sun"); } },
      ot:       { id: "ot",       label: "Daily Overtime - Overtime - £/hr", thCls: "rm-vh rm-vh--in", full: function (r) { return dtCell(r, "ot"); } },
    };
    var order = S.colGroup === "build" ? ["base", "geo", "basicgeo", "nmw", "std"]
      : S.colGroup === "daytype" ? ["std", "fri", "sat", "sun", "ot"]
        : ["base", "geo", "basicgeo", "nmw", "std", "fri", "sat", "sun", "ot"];
    return order.map(function (k) { return defs[k]; });
  }
  function allCols() { return keyCols().concat(valueCols()); }

  // a comparable value per column for header sort (nulls/blanks sort last)
  function sortValue(r, id) {
    switch (id) {
      case "site": return SITES.indexOf(r.site);
      case "tier": return r.tier;
      case "jt": return JOBTYPES.indexOf(r.jt);
      case "role": return r.role;
      case "parity": return r.parity;
      case "hrs": return effHrs(r);
      case "base": return isDirect(r) ? effDirect(r) : effBase(r);
      case "geo": return isDirect(r) ? null : effGeo(r);
      case "basicgeo": return isDirect(r) ? payStd(r) : basicGeo(r);
      case "nmw": return NMW;
      case "std": return payStd(r);
      case "fri": case "sat": case "sun": case "ot": return dtVal(r, id);
    }
    return null;
  }
  function cmpRows(a, b, id, dir) {
    var va = sortValue(a, id), vb = sortValue(b, id);
    var na = (va == null), nb = (vb == null);
    if (na && nb) return 0;
    if (na) return 1;
    if (nb) return -1;
    var c = (typeof va === "string" || typeof vb === "string") ? String(va).localeCompare(String(vb)) : (va - vb);
    return dir > 0 ? c : -c;
  }
  function sortTh(col) {
    var active = S.sort.col === col.id;
    var ind = '<span class="rm-sortind' + (active ? " is-on" : "") + '">' + (active ? (S.sort.dir > 0 ? "\u25B2" : "\u25BC") : "") + '</span>';
    return '<th class="' + col.thCls + (active ? " is-sorted" : "") + '"><button class="rm-sort" type="button" data-rm-sort="' + col.id + '">' + col.label + ind + '</button></th>';
  }
  function grid(rows) {
    var groups = groupOf(rows);
    var all = S.colGroup === "all";
    var cols = allCols();
    var head = '<thead><tr>' +
      '<th class="rm-th-chk' + (all ? " rmk rmk--chk" : "") + '">' + (S.canEdit ? selAllBox(rows) : "") + '</th>' +
      cols.map(sortTh).join("") +
      '<th class="rm-th-exp" aria-label="Open build"></th>' +
    '</tr></thead>';
    var body = groups.map(function (g) { return groupBlock(g); }).join("");
    return '<div class="rm-tablewrap"><table class="rm-table' + (all ? " rm-table--all" : "") + '">' + head + '<tbody>' + body + '</tbody></table></div>';
  }

  function selAllBox(rows) {
    var ids = rows.map(function (r) { return r.id; });
    var all = ids.length && ids.every(function (id) { return S.sel[id]; });
    return '<button class="rm-chk' + (all ? " is-on" : "") + '" data-rm-selall aria-label="Select all visible" title="Select all visible">' + (all ? ico("Check") : "") + '</button>';
  }

  function groupBlock(g) {
    // Ungrouped (template mirror) — a flat list, no group banner.
    if (S.groupBy === "none") return g.rows.map(rowTr).join("");
    var col = !!S.collapsed[g.key];
    var floors = g.rows.filter(floored).length;
    var gaps = g.rows.filter(hasGap).length;
    var edits = g.rows.filter(isEdited).length;
    var summary = [];
    if (floors) summary.push(floors + ' floored of ' + g.rows.length);
    else summary.push(g.rows.length + ' rate' + (g.rows.length === 1 ? "" : "s"));
    if (gaps) summary.push('<span class="rm-gs rm-gs--gap">' + gaps + ' data gap' + (gaps === 1 ? "" : "s") + '</span>');
    if (edits) summary.push('<span class="rm-gs rm-gs--edit">' + edits + ' edited</span>');
    var allSel = S.canEdit && g.rows.every(function (r) { return S.sel[r.id]; });
    var ghead = '<tr class="rm-grp' + (col ? " is-collapsed" : "") + '" data-rm-grp="' + esc(g.key) + '">' +
      '<td class="rm-grp-chk">' + (S.canEdit ? '<button class="rm-chk' + (allSel ? " is-on" : "") + '" data-rm-grpsel="' + esc(g.key) + '" aria-label="Select group">' + (allSel ? ico("Check") : "") + '</button>' : "") + '</td>' +
      '<td class="rm-grp-main" colspan="' + allCols().length + '">' +
        '<button class="rm-grp-toggle" data-rm-grptoggle="' + esc(g.key) + '" aria-expanded="' + (col ? "false" : "true") + '">' +
          '<span class="rm-grp-chev">' + ico(col ? "ChevronRight" : "ChevronDown") + '</span>' +
          '<span class="rm-grp-label">' + esc(g.key) + '</span>' +
          '<span class="rm-grp-summary">' + summary.join(' <span class="rm-count-sep">\u00b7</span> ') + '</span>' +
        '</button>' +
      '</td>' +
      '<td class="rm-grp-actions">' + (edits && S.canEdit ? '<button class="rm-link-btn rm-link-btn--sm" data-rm-grpreset="' + esc(g.key) + '">' + ico("Undo") + 'Reset</button>' : "") + '</td>' +
    '</tr>';
    if (col) return ghead;
    return ghead + g.rows.map(rowTr).join("");
  }

  // weekly-hours cell (pinned, editable input — empty when not set = a gap)
  function hoursCell(r) {
    var v = effHrs(r), dis = S.canEdit ? "" : " disabled", gap = v == null;
    return '<span class="rm-hrs' + (gap ? " is-gap" : "") + '">' +
      '<input class="rm-hrs-in" type="number" step="0.5" min="0" inputmode="decimal" value="' + (gap ? "" : v) + '" placeholder="\u2014" data-rm-edit="' + r.id + ':hrs"' + dis + ' aria-label="Weekly hours" />' +
      '<span class="rm-hrs-u">h/wk</span>' +
    '</span>';
  }

  // Standard net pay cell — direct roles edit it; based roles show the
  // derived (floored) value with the floor badge.
  function stdCell(r) {
    if (isDirect(r)) return '<td class="rm-vc rm-vc--in">' + money(r, "direct", effDirect(r), { strong: true }) + '</td>';
    var fl = floored(r);
    return '<td class="rm-vc rm-vc--dv"><span class="rm-pay' + (fl ? " is-floor" : "") + '">' + gbp(payStd(r)) +
      (fl ? '<span class="rm-floor-chip" title="At the NMW floor">floor</span>' : "") + '</span></td>';
  }
  // a day-type net pay cell (Friday / Saturday / Sunday / Overtime)
  function dtCell(r, k) {
    if (!r.avail[k]) return '<td class="rm-vc rm-vc--na"><span class="rm-na" title="The recipe carries no rate for this day-type">\u2014</span></td>';
    return '<td class="rm-vc rm-vc--in">' + money(r, "dt:" + k, effDt(r, k), { allowBlank: true }) + '</td>';
  }
  // NMW floor cell — the statutory floor, with the lift when it bites
  function floorCell(r) {
    var fl = floored(r);
    return '<td class="rm-vc rm-vc--dv"><span class="rm-floorbox">' +
      '<span class="rm-floorval">' + gbp(NMW) + '</span>' +
      (fl ? '<span class="rm-floorlift" title="Lifted to the NMW floor">' + ico("ArrowUpSmall") + signed(floorLift(r)) + '</span>'
          : '<span class="rm-clears" title="Clears the floor">clears</span>') +
    '</span></td>';
  }
  function dayGroupCells(r) {
    return stdCell(r) + dtCell(r, "fri") + dtCell(r, "sat") + dtCell(r, "sun") + dtCell(r, "ot");
  }
  function buildGroupCells(r) {
    if (isDirect(r)) {
      return '<td class="rm-vc rm-vc--na"><span class="rm-direct">\u2014 \u00b7 direct</span></td>' +
             '<td class="rm-vc rm-vc--na"><span class="rm-na">\u2014</span></td>' +
             '<td class="rm-vc rm-vc--na"><span class="rm-na">\u2014</span></td>' +
             floorCell(r) + stdCell(r);
    }
    return '<td class="rm-vc rm-vc--in">' + money(r, "base", effBase(r)) + '</td>' +
           '<td class="rm-vc rm-vc--in">' + money(r, "geo", effGeo(r)) + '</td>' +
           '<td class="rm-vc rm-vc--dv"><span class="rm-derived">' + gbp(basicGeo(r)) + '</span></td>' +
           floorCell(r) + stdCell(r);
  }

  function rowTr(r) {
    var sel = !!S.sel[r.id], gap = hasGap(r), open = S.drawer === r.id;
    var all = S.colGroup === "all";
    var cells = allCols().map(function (c) {
      if (c.full) return c.full(r);
      var cls = typeof c.tdCls === "function" ? c.tdCls(r) : c.tdCls;
      return '<td class="' + cls + '">' + c.td(r) + '</td>';
    }).join("");
    return '<tr class="rm-row' + (open ? " is-open" : "") + (gap ? " has-gap" : "") + (sel ? " is-sel" : "") + '" data-rm-row="' + r.id + '">' +
      '<td class="rm-td-chk' + (all ? " rmk rmk--chk" : "") + '">' + (S.canEdit ? '<button class="rm-chk' + (sel ? " is-on" : "") + '" data-rm-sel="' + r.id + '" aria-label="Select rate">' + (sel ? ico("Check") : "") + '</button>' : "") + '</td>' +
      cells +
      '<td class="rm-td-exp"><button class="rm-exp" data-rm-open="' + r.id + '" aria-label="Open build">' + ico("PanelRight") + '</button></td>' +
    '</tr>';
  }

  // editable money input (commits on change/blur). field = base|direct|geo|dt:<k>
  function money(r, field, val, opts) {
    opts = opts || {};
    var dis = S.canEdit ? "" : " disabled";
    var cls = "rm-money" + (opts.strong ? " rm-money--strong" : "");
    var blank = val == null;
    if (blank && opts.allowBlank) {
      return '<button class="rm-add-rate" data-rm-addrate="' + r.id + ':' + field + '"' + (S.canEdit ? "" : " disabled") + '>\u2014 <span>add</span></button>';
    }
    return '<span class="' + cls + '"><span class="rm-money-cur">\u00a3</span>' +
      '<input class="rm-money-in" type="number" step="0.01" min="0" value="' + (val == null ? "" : Number(val).toFixed(2)) + '" data-rm-edit="' + r.id + ':' + field + '"' + dis + ' /></span>';
  }

  // ============================================================ drawer
  function drawer() {
    if (!S.drawer) return "";
    var r = buildData().filter(function (x) { return x.id === S.drawer; })[0];
    if (!r) return "";
    var pay = payStd(r), edt = isEdited(r), b = burden(r);
    var dis = S.canEdit ? "" : " disabled";

    function chip(t) { return '<span class="rp-tchip rp-tchip--' + (t === "Pay" ? "ref" : "eng") + '">' + t + '</span>'; }
    function line(opts) {
      return '<div class="rm-bl' + (opts.cls ? " " + opts.cls : "") + '">' +
        (opts.tag ? chip(opts.tag) : '<span class="rm-bl-spacer"></span>') +
        '<span class="rm-bl-label">' + opts.label + (opts.locked ? '<span class="rm-locktag">statutory \u00b7 engine ' + ENG_V + '</span>' : "") + '</span>' +
        '<span class="rm-bl-val">' + opts.val + '</span>' +
      '</div>';
    }

    var build = "";
    if (isDirect(r)) {
      build += line({ tag: "Pay", label: "Pay rate \u00b7 entered directly", val: money(r, "direct", effDirect(r), { strong: true }) });
      build += line({ tag: null, cls: "rm-bl--note", label: "No base hourly rate \u2014 this role's pay is set directly", val: "" });
      build += line({ tag: null, cls: "rm-bl--floorok", label: "NMW floor \u00a3" + NMW.toFixed(2), locked: true, val: '<span class="rm-clears">clears</span>' });
    } else {
      build += line({ tag: "Pay", label: "Base hourly rate", val: money(r, "base", effBase(r)) });
      build += line({ tag: "Pay", label: "+ Geo allowance \u00b7 location", val: money(r, "geo", effGeo(r)) });
      build += line({ tag: null, cls: "rm-bl--derived", label: "= Basic + Geo", val: gbp(basicGeo(r)) });
      if (floored(r)) {
        build += line({ tag: "Engine", cls: "rm-bl--floor", label: "NMW floor \u00a3" + NMW.toFixed(2) + " applied", locked: true, val: '<span class="rm-lift">' + signed(floorLift(r)) + '</span>' });
      } else {
        build += line({ tag: "Engine", cls: "rm-bl--floorok", label: "NMW floor \u00a3" + NMW.toFixed(2), locked: true, val: '<span class="rm-clears">clears ' + signed(r2(basicGeo(r) - NMW)) + '</span>' });
      }
    }
    build += line({ tag: null, cls: "rm-bl--total", label: "= Pay rate \u00b7 standard", val: '<strong>' + gbp(pay) + '</strong>' });

    // day-types
    var dtRows = DT.filter(function (d) { return d.k !== "std"; }).map(function (d) {
      var avail = r.avail[d.k];
      var val = effDt(r, d.k);
      var cell = avail
        ? money(r, "dt:" + d.k, val, { allowBlank: true })
        : '<span class="rm-dt-na" title="The recipe carries no ' + d.label + ' rate for this role">\u2014</span>';
      return '<div class="rm-dt-row' + (avail ? "" : " is-na") + '"><span class="rm-dt-k">' + d.label + '</span>' + cell + '</div>';
    }).join("");
    var dtBlock = '<div class="rm-dt">' +
      '<div class="rm-dt-head">Day-types <span class="rm-dt-sub">recipe \u00b7 truthful blanks where no rate exists</span></div>' +
      '<div class="rm-dt-row rm-dt-row--std"><span class="rm-dt-k">Standard</span><span class="rm-dt-std">' + gbp(pay) + '</span></div>' +
      dtRows +
    '</div>';

    // parity note
    var other = r.parity === "Pre" ? ("Post " + signed(PARITY_UP)) : ("Pre " + signed(-PARITY_UP));
    var parNote = '<div class="rm-parnote">Parity <span class="rm-par rm-par--' + r.parity.toLowerCase() + '">' + r.parity + '</span> <span class="rm-parnote-o">' + other + ' indicative</span></div>';

    // statutory burden
    var burdenBlock;
    if (b) {
      burdenBlock = '<div class="rm-burden">' +
        '<div class="rm-burden-head">Statutory burden <span class="rm-burden-sub">indicative @ ' + effHrs(r) + 'h/wk</span></div>' +
        line({ tag: "Pay", label: "Pay rate", val: gbp(b.pay) }) +
        line({ tag: "Engine", label: "+ WTR holiday (" + b.wtrPct.toFixed(2) + "%)", locked: true, val: gbp(b.wtr) }) +
        line({ tag: "Engine", label: "+ Employer NI (15% > \u00a3" + ENG.niThresh + "/wk)", locked: true, val: gbp(b.eni) }) +
        line({ tag: null, cls: "rm-bl--total rm-bl--burdentotal", label: "= Statutory-burdened pay", val: '<strong>' + gbp(b.total) + '</strong>' }) +
        '<div class="rm-burden-foot">' + ico("Information") + 'Pension, levy and sick are supplier-specific and complete the picture in step 4 \u2014 flagged, not computed here.</div>' +
      '</div>';
    } else {
      burdenBlock = '<div class="rm-burden rm-burden--gap">' +
        '<div class="rm-burden-head">Statutory burden</div>' +
        '<div class="rm-burden-gap">' + ico("Alert") + 'Weekly hours are not set for this role, so the burden can\u2019t be computed. Set hours to complete the build.</div>' +
      '</div>';
    }

    return '<div class="rm-drawer-scrim" data-rm-close></div>' +
      '<aside class="rm-drawer" role="dialog" aria-label="Rate build">' +
        '<header class="rm-drawer-head">' +
          '<div class="rm-drawer-titles">' +
            '<div class="rm-drawer-title">' + esc(r.role) + '</div>' +
            '<div class="rm-drawer-sub">' + esc(r.site) + ' \u00b7 ' + esc(r.jt) + ' \u00b7 ' + r.parity + '-parity \u00b7 ' + (effHrs(r) == null ? "hours not set" : effHrs(r) + "h/wk") + '</div>' +
          '</div>' +
          '<button class="rm-drawer-x" data-rm-close aria-label="Close">' + ico("ContentClose") + '</button>' +
        '</header>' +
        '<div class="rm-drawer-body">' +
          '<div class="rm-drawer-recipe">' + ico("Lock") + 'The build follows ' + esc(RECIPE.client) + '\u2019s recipe \u00b7 you edit the pay data, not the recipe</div>' +
          (edt ? '<div class="rm-drawer-edited">' + ico("Edit") + 'This rate has staged edits' + (S.canEdit ? ' <button class="rm-link-btn rm-link-btn--sm" data-rm-rowreset="' + r.id + '">' + ico("Undo") + 'Reset to uploaded</button>' : "") + '</div>' : "") +
          '<div class="rm-build">' + build + '</div>' +
          dtBlock +
          parNote +
          burdenBlock +
        '</div>' +
      '</aside>';
  }

  // ============================================================ edit ops
  function ensureEdit(id) { if (!S.edits[id]) S.edits[id] = {}; return S.edits[id]; }
  function rowById(id) { return buildData().filter(function (x) { return x.id === id; })[0]; }

  function commitEdit(id, field, raw) {
    var r = rowById(id); if (!r) return;
    var v = parseFloat(raw);
    if (isNaN(v)) { RM._render(); return; }
    v = r2(v);
    var e = ensureEdit(id);
    if (field === "base") { e.base = v; }
    else if (field === "geo") { e.geo = v; }
    else if (field === "hrs") { e.hrs = v; }
    else if (field === "direct") {
      if (v < NMW) { v = NMW; toast("Held at the NMW floor \u2014 a pay rate can\u2019t go below \u00a3" + NMW.toFixed(2)); }
      e.direct = v;
    } else if (field.indexOf("dt:") === 0) {
      var k = field.slice(3);
      if (v < NMW) { v = NMW; toast("Held at the NMW floor \u2014 a pay rate can\u2019t go below \u00a3" + NMW.toFixed(2)); }
      if (!e.dt) e.dt = {};
      e.dt[k] = v;
    }
    cleanEdit(id);
    RM._render();
  }
  function addRate(id, field) {
    // seed a day-type rate from the current standard, then it's editable
    var r = rowById(id); if (!r) return;
    var e = ensureEdit(id);
    if (field.indexOf("dt:") === 0) { if (!e.dt) e.dt = {}; e.dt[field.slice(3)] = payStd(r); }
    RM._render();
  }
  // drop an edit object if it no longer differs from uploaded
  function cleanEdit(id) {
    var r = rowById(id), e = S.edits[id]; if (!r || !e) return;
    if (e.base != null && Math.abs(e.base - r._base) < 0.005) delete e.base;
    if (e.geo != null && Math.abs(e.geo - r._geo) < 0.005) delete e.geo;
    if (e.hrs != null && r.hrs != null && Math.abs(e.hrs - r.hrs) < 0.005) delete e.hrs;
    if (e.direct != null && r._direct != null && Math.abs(e.direct - r._direct) < 0.005) delete e.direct;
    if (e.dt) { for (var k in e.dt) { if (e.dt[k] != null && r._dt[k] != null && Math.abs(e.dt[k] - r._dt[k]) < 0.005) delete e.dt[k]; } if (!Object.keys(e.dt).length) delete e.dt; }
    if (!Object.keys(e).length) delete S.edits[id];
  }

  function applyBulk() {
    var ids = selIds(); if (!ids.length) return;
    var op = S.bulk.op, val = parseFloat(S.bulk.val);
    if (isNaN(val)) { toast("Enter a value to apply"); return; }
    var floorHit = 0, n = 0;
    ids.forEach(function (id) {
      var r = rowById(id); if (!r) return;
      var e = ensureEdit(id);
      // operate on the row's primary editable input: base (if any) else direct
      var isB = !isDirect(r);
      var cur = isB ? effBase(r) : effDirect(r);
      var next;
      if (op === "flat") next = cur + val;
      else if (op === "pct") next = cur * (1 + val / 100);
      else if (op === "set") next = val;
      else if (op === "rel") next = cur * val;
      next = r2(next);
      if (isB) { e.base = next; }
      else { if (next < NMW) { next = NMW; floorHit++; } e.direct = next; }
      cleanEdit(id);
      n++;
    });
    var msg = "Staged " + (op === "flat" ? signed(val) : op === "pct" ? signed(val) + "%" : op === "rel" ? "\u00d7" + val : "set \u00a3" + r2(val).toFixed(2)) + " across " + n + " rate" + (n === 1 ? "" : "s");
    if (floorHit) msg += " \u00b7 " + floorHit + " held at the NMW floor";
    toast(msg);
    RM._render();
  }
  function resetRows(ids) { ids.forEach(function (id) { delete S.edits[id]; }); }

  // ============================================================ events
  RM._wireOnce = function () {
    var root = RM._root;
    if (!root || root.__rmWired) return;
    root.__rmWired = true;

    root.addEventListener("click", function (e) {
      var t = e.target;
      var hit = function (a) { return t.closest("[" + a + "]"); };

      // toggle edit access
      if (hit("data-rm-access")) { S.canEdit = !S.canEdit; if (!S.canEdit) S.sel = {}; RM._render(); return; }

      // column-group switch (template mirror "all" / focus modes)
      var cg = hit("data-rm-colgroup"); if (cg) { S.colGroup = cg.getAttribute("data-rm-colgroup"); if (S.sort.col && allCols().map(function (c) { return c.id; }).indexOf(S.sort.col) < 0) S.sort = { col: null, dir: 1 }; RM._render(); return; }

      // group-by tab
      var gbt = hit("data-rm-group"); if (gbt) { S.groupBy = gbt.getAttribute("data-rm-group"); RM._render(); return; }

      // column-header sort (asc \u2192 desc \u2192 template order)
      var sc = hit("data-rm-sort"); if (sc) { var cid = sc.getAttribute("data-rm-sort"); if (S.sort.col !== cid) { S.sort.col = cid; S.sort.dir = 1; } else if (S.sort.dir === 1) { S.sort.dir = -1; } else { S.sort.col = null; S.sort.dir = 1; } RM._render(); return; }

      // reset to template view (flat, all columns, unsorted, unfiltered)
      if (hit("data-rm-resetview")) { S.groupBy = "none"; S.colGroup = "all"; S.sort = { col: null, dir: 1 }; S.f = { tier: "all", site: "all", jt: "all", parity: "all" }; S.quick = { floored: false, gaps: false, ot: false, edited: false }; S.q = ""; toast("Reset to template view"); RM._render(); return; }

      // search clear
      if (hit("data-rm-qclear")) { S.q = ""; RM._render(); return; }

      // quick filters
      var q = hit("data-rm-quick"); if (q) { var k = q.getAttribute("data-rm-quick"); S.quick[k] = !S.quick[k]; RM._render(); return; }

      // clear all filters (empty state)
      if (hit("data-rm-clearfilters")) { S.q = ""; S.f = { tier: "all", site: "all", jt: "all", parity: "all" }; S.quick = { floored: false, gaps: false, ot: false, edited: false }; RM._render(); return; }

      // reset all edits
      if (hit("data-rm-resetall")) { S.edits = {}; toast("Reset all staged pay edits"); RM._render(); return; }

      // group collapse
      var gt = hit("data-rm-grptoggle"); if (gt) { var gk = gt.getAttribute("data-rm-grptoggle"); S.collapsed[gk] = !S.collapsed[gk]; RM._render(); return; }
      // group reset
      var gr = hit("data-rm-grpreset"); if (gr) { var gkey = gr.getAttribute("data-rm-grpreset"); var ids = rowsFiltered().filter(function (r) { return groupKey(r) === gkey; }).map(function (r) { return r.id; }); resetRows(ids); toast("Reset edits in " + gkey); RM._render(); return; }
      // group select
      var gs = hit("data-rm-grpsel"); if (gs) { var gsk = gs.getAttribute("data-rm-grpsel"); var grows = rowsFiltered().filter(function (r) { return groupKey(r) === gsk; }); var allSel = grows.every(function (r) { return S.sel[r.id]; }); grows.forEach(function (r) { S.sel[r.id] = !allSel; }); RM._render(); return; }

      // select all visible
      if (hit("data-rm-selall")) { var vis = rowsFiltered(); var all = vis.every(function (r) { return S.sel[r.id]; }); vis.forEach(function (r) { S.sel[r.id] = !all; }); RM._render(); return; }
      // row select
      var sb = hit("data-rm-sel"); if (sb) { var sid = sb.getAttribute("data-rm-sel"); S.sel[sid] = !S.sel[sid]; RM._render(); return; }

      // open / close drawer
      var op = hit("data-rm-open"); if (op) { S.drawer = op.getAttribute("data-rm-open"); RM._render(); return; }
      if (hit("data-rm-close")) { S.drawer = null; RM._render(); return; }

      // add a day-type rate
      var ar = hit("data-rm-addrate"); if (ar) { var parts = ar.getAttribute("data-rm-addrate").split(":"); addRate(parts[0], parts[1] + (parts[2] ? ":" + parts[2] : "")); return; }

      // bulk apply / reset / clear
      if (hit("data-rm-bulkapply")) { applyBulk(); return; }
      if (hit("data-rm-bulkreset")) { resetRows(selIds()); toast("Reset selected rates to uploaded"); RM._render(); return; }
      if (hit("data-rm-selclear")) { S.sel = {}; RM._render(); return; }

      // per-row reset (drawer)
      var rr = hit("data-rm-rowreset"); if (rr) { delete S.edits[rr.getAttribute("data-rm-rowreset")]; RM._render(); return; }

      // clicking a row body (not a control) opens the drawer
      var rowEl = t.closest("[data-rm-row]");
      if (rowEl && !t.closest("input,button,select,.rm-money")) { S.drawer = rowEl.getAttribute("data-rm-row"); RM._render(); return; }
    });

    // commit edits on change (blur / enter)
    root.addEventListener("change", function (e) {
      var el = e.target;
      if (el.hasAttribute("data-rm-edit")) { var p = el.getAttribute("data-rm-edit").split(/:(.+)/); commitEdit(p[0], p[1], el.value); return; }
      if (el.hasAttribute("data-rm-f")) { mapFilter(el.getAttribute("data-rm-f"), el.value); RM._render(); return; }
      if (el.hasAttribute("data-rm-bulkop")) { S.bulk.op = el.value; RM._render(); return; }
      if (el.hasAttribute("data-rm-bulkval")) { S.bulk.val = el.value; return; }
    });
    // live-ish: search + bulk val on input (debounced re-render for search)
    var qTimer = null;
    root.addEventListener("input", function (e) {
      var el = e.target;
      if (el.hasAttribute("data-rm-q")) { S.q = el.value; clearTimeout(qTimer); qTimer = setTimeout(function () { var pos = el.selectionStart; RM._render(); var ni = RM._root.querySelector("[data-rm-q]"); if (ni) { ni.focus(); try { ni.setSelectionRange(pos, pos); } catch (x) {} } }, 220); return; }
      if (el.hasAttribute("data-rm-bulkval")) { S.bulk.val = el.value; }
    });
    // Enter in a money input commits + blurs
    root.addEventListener("keydown", function (e) {
      if (e.key === "Enter" && e.target.classList && (e.target.classList.contains("rm-money-in") || e.target.classList.contains("rm-hrs-in"))) { e.preventDefault(); e.target.blur(); }
      if (e.key === "Escape" && S.drawer) { S.drawer = null; RM._render(); }
    });
  };

  function mapFilter(name, val) {
    if (name === "tier") S.f.tier = val;
    else if (name === "site") S.f.site = val;
    else if (name === "jobtype") S.f.jt = val;
    else if (name === "parity") S.f.parity = val;
  }

})();
