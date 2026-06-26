/* =====================================================================
   Rate Card — "④ Agency rate cards" : the output + simulation   v0.95
   ---------------------------------------------------------------------
   Spec §8. Two sub-tabs over the STAGED set (no live writes here):
     8.1 Rate cards by supplier — read-only bill-rate cards, bill rate as
         the row anchor, expand → tier-tagged waterfall
         (pay → +WTR → +NI → +pension → +levy → +sick → +markup = bill).
     8.2 Simulator — "what would we actually bill?" two columns
         (inputs → outputs), booking total, summary tiles, presets, pin.
   §8.3 UK-law guardrails fire inline in the simulator: NMW-by-age,
   Employer-NIC relief under-21, pension auto-enrolment 3% minimum, AWR
   parity at 12 weeks, apprenticeship levy, SSP, VAT, 48-hour working time.

   Statutory figures are 2025/26 — source centrally and re-verify each
   April (HMRC/DWP). Mounts into #ra-root.  IA version: V1.  Everest only.
   ===================================================================== */
(function () {
  "use strict";
  var C = window.RPCore;
  if (!C) return;
  var gbp = C.gbp, r2 = C.r2, esc = C.esc, ico = C.ico, toast = C.toast, ENG = C.ENG;

  // ---- statutory reference (2025/26) --------------------------------
  var NMW = { adult: 12.21, age18_20: 10.00, age16_17: 7.55, apprentice: 7.55 };
  var NIC_RELIEF_CEILING = 50270;      // under-21 / apprentice <25: 0% employer NI up to this annual
  var PENSION_MIN = 3.0;               // employer auto-enrolment minimum %
  var PARITY_WEEKS = 12;               // AWR parity threshold
  var WORKING_TIME_CAP = 48;           // average weekly hours
  var VAT_DEFAULT = 20;

  function nmwFloor(age, apprentice) {
    if (apprentice && age < 19) return NMW.apprentice;
    if (age >= 21) return NMW.adult;
    if (age >= 18) return NMW.age18_20;
    return NMW.age16_17;
  }
  function pensionEligible(age) { return age >= 22 && age < 66; }   // 22 → SPA(66), >£10k assumed

  var RA = {};
  window.RA = RA;

  // ---- staged set, grouped -----------------------------------------
  function staged() { return C.validate(C.buildStaged()).filter(function (L) { return !L.excluded; }); }

  RA.reset = function () { RA.state = null; };
  RA.ensure = function (opts) {
    opts = opts || {};
    if (RA.state && RA.state._key === (opts.key || "k")) return;
    var ls = staged();
    var first = ls.filter(function (L) { return L.charge != null; })[0] || ls[0];
    RA.state = {
      _key: opts.key || "k",
      tab: "cards",
      groupBy: opts.supplier ? "site" : "supplier",
      supplier: opts.supplier || null,   // when set, scope cards to this one agency
      chip: null,
      exp: {},                       // expanded card rows
      sim: defaultScenario(ls, first),
      pinned: [],
    };
  };
  RA.mount = function (root, opts) {
    opts = opts || {};
    RA._root = root;
    if (!root) return;
    RA.ensure(opts);
    // Single-view mode (the wizard now mounts cards and simulator as their
    // own steps): force the view and drop the subtab strip. opts.view is
    // "cards" or "sim".
    if (opts.view) { RA.state.locked = opts.view; RA.state.tab = opts.view; }
    else RA.state.locked = null;
    // Agency-scoped mounts pass a supplier — re-apply on every mount so the
    // scope survives the host app's full re-renders.
    if ("supplier" in opts) RA.state.supplier = opts.supplier || null;
    RA._render();
    RA._wireOnce();
  };

  // ---- 8.1 + waterfall math ----------------------------------------
  // Bill-rate waterfall for a STAGED line (no age/parity overrides).
  function cardWaterfall(L) {
    var wtrPct = C.isParity(L.jobType) ? ENG.wtrPar : ENG.wtrStd;
    var wtr = r2(L.net * wtrPct / 100);
    var eni = r2(((L.net + wtr) * L.hrs - ENG.niThresh) * ENG.niPct / 100 / L.hrs);
    var pen = r2(L.net * L.penPct / 100);
    var levy = L.levyIncluded ? (L.levy || r2((L.net + wtr + eni) * ENG.levyPct / 100)) : 0;
    var sick = L.sick || 0;
    var burdened = r2(L.net + wtr + eni + pen + levy + sick);
    var markup = (L.margin == null || L.margin === "") ? null : r2(L.margin);
    var bill = markup == null ? null : r2(burdened + markup);
    return { pay: L.net, wtrPct: wtrPct, wtr: wtr, eni: eni, pen: pen, levy: levy, sick: sick,
      burden: r2(burdened - L.net), burdened: burdened, markup: markup, bill: bill,
      marginPct: bill ? r2(markup / bill * 100) : null, mult: bill ? r2(bill / L.net) : null };
  }

  function groupKey(L) {
    var s = RA.state;
    return s.groupBy === "site" ? L.site : s.groupBy === "jobType" ? L.jobType : L.supplier;
  }
  function chipMatch(L) {
    var s = RA.state; if (!s.chip) return true;
    if (s.chip === "errors") return L.status === "error";
    if (s.chip === "missing") return (L.margin == null || L.margin === "");
    if (s.chip === "outliers") return !!L._outlier;
    if (s.chip === "changed") return L._changed;
    return true;
  }

  // tag outliers (markup ≥ £0.14 over per-jobType median) + changed-vs-live
  function annotate(ls) {
    var byJt = {};
    ls.forEach(function (L) { if (L.margin != null) (byJt[L.jobType] = byJt[L.jobType] || []).push(L.margin); });
    var med = {}; Object.keys(byJt).forEach(function (jt) { var a = byJt[jt].sort(function (x, y) { return x - y; }); med[jt] = a[Math.floor(a.length / 2)]; });
    var base = C.buildBaselines(ls)[0];
    ls.forEach(function (L) {
      L._outlier = L.margin != null && med[L.jobType] != null && (L.margin - med[L.jobType]) >= 0.14;
      var d = C.diffLine(L, base); L._changed = d.change === "new" || d.change === "changed";
    });
    return ls;
  }

  RA._render = function () {
    if (!RA._root) return;
    var s = RA.state;
    var view = s.locked || s.tab;
    RA._root.innerHTML = (s.locked ? "" : subtabs()) + (view === "cards" ? cardsView() : simulatorView());
    if (window.Proto) { window.Proto.fillIcons(RA._root); window.Proto.setWizGate({ ok: true, statusHtml: ico("Check") + "Reviewed \u2014 no live data written yet" }); }
    if (view === "sim") RA._syncSimInputs();
  };

  function subtabs() {
    var s = RA.state;
    return '<div class="rm-subtabs">' +
      '<button class="rm-subtab' + (s.tab === "cards" ? " is-on" : "") + '" data-ra-tab="cards">' + ico("Wallet") + 'Rate cards' +
        '<span class="rm-subtab-num">8.1</span></button>' +
      '<button class="rm-subtab' + (s.tab === "sim" ? " is-on" : "") + '" data-ra-tab="sim">' + ico("Calculate") + 'Simulator' +
        '<span class="rm-subtab-num">8.2</span></button>' +
    '</div>';
  }

  // ---- 8.1 cards view -----------------------------------------------
  function cardsView() {
    var s = RA.state, ls = annotate(staged());
    if (s.supplier) ls = ls.filter(function (L) { return L.supplier === s.supplier; });
    var counts = { errors: 0, missing: 0, outliers: 0, changed: 0 };
    ls.forEach(function (L) { if (L.status === "error") counts.errors++; if (L.margin == null || L.margin === "") counts.missing++; if (L._outlier) counts.outliers++; if (L._changed) counts.changed++; });

    var groups = {};
    ls.filter(chipMatch).forEach(function (L) { (groups[groupKey(L)] = groups[groupKey(L)] || []).push(L); });
    var names = Object.keys(groups).sort();

    var chips = [
      ["errors", "Errors", counts.errors], ["missing", "Missing markup", counts.missing],
      ["outliers", "Outliers", counts.outliers], ["changed", "Changed vs live", counts.changed],
    ].map(function (c) {
      return '<button class="ra-chip' + (s.chip === c[0] ? " is-on" : "") + (c[2] ? "" : " is-zero") + '" data-ra-chip="' + c[0] + '">' + c[1] + '<b>' + c[2] + '</b></button>';
    }).join("");

    var bar = '<div class="ra-cards-bar">' +
      '<div class="rm-ctl"><span class="rm-ctl-l">Group by</span>' +
        '<div class="rm-seg">' +
          (s.supplier ? [["site", "Market"], ["jobType", "Labor category"]] : [["supplier", "Supplier"], ["site", "Site"], ["jobType", "Labor category"]]).map(function (g) {
            return '<button class="rm-seg-btn' + (s.groupBy === g[0] ? " is-on" : "") + '" data-ra-group="' + g[0] + '">' + g[1] + '</button>';
          }).join("") +
        '</div></div>' +
      '<div class="ra-chiprow">' + chips + '</div>' +
    '</div>';

    var cards = names.map(function (name) { return supplierCard(name, groups[name]); }).join("");
    if (!names.length) cards = '<div class="rv-empty">' + ico("Search") + (s.supplier ? 'No rate-card lines for this agency in the current rate card.' : 'No rate cards match this filter.') + '</div>';

    var note = s.supplier
      ? 'Bill rates for ' + esc(s.supplier) + ', read straight from the current rate card \u2014 the same staged set as the upload flow, scoped to this agency. Bill rate is the anchor; expand any row for the tier-tagged waterfall. Read-only here.'
      : 'Staged bill rates from the configured markup and engine burden. Read-only here \u2014 edit markup or cost inputs back in Rate model \u00b7 Agency rate configuration. Nothing goes live until Activate.';
    return '<div class="ra-cards">' + bar +
      '<div class="ra-note">' + ico("Information") + note + '</div>' +
      cards + '</div>';
  }

  function supplierCard(name, lines) {
    var s = RA.state;
    var errs = lines.filter(function (L) { return L.status === "error"; }).length;
    var warns = lines.filter(function (L) { return L.status === "warning"; }).length;
    var statusDot = errs ? '<span class="ra-dot ra-dot--err"></span>' : warns ? '<span class="ra-dot ra-dot--warn"></span>' : '<span class="ra-dot ra-dot--ok"></span>';
    var issueTag = errs ? '<span class="ra-card-issues ra-card-issues--err">' + ico("Alert") + errs + ' to fix</span>'
      : warns ? '<span class="ra-card-issues ra-card-issues--warn">' + ico("Information") + warns + ' to review</span>'
      : '<span class="ra-card-issues ra-card-issues--ok">' + ico("Check") + 'All valid</span>';

    var rows = lines.map(function (L) { return cardRow(L); }).join("");
    return '<section class="proto-card ra-card">' +
      '<div class="ra-card-head">' + statusDot +
        '<h3 class="ra-card-title">' + esc(name) + '</h3>' +
        '<span class="ra-card-meta">' + lines.length + ' rate ' + (lines.length === 1 ? 'card' : 'cards') + '</span>' +
        issueTag +
      '</div>' +
      '<div class="rm-tablewrap"><table class="ra-table"><thead><tr>' +
        '<th class="ra-th-mk">' + (s.groupBy === "site" ? "Supplier" : "Market") + '</th>' +
        '<th>Labor category</th><th class="ra-th-n">Pay</th><th class="ra-th-n">Burden</th>' +
        '<th class="ra-th-n">Markup</th><th class="ra-th-n ra-th-bill">Bill rate</th><th class="ra-th-n">Margin %</th>' +
        '<th aria-label="Status"></th><th aria-label="Expand"></th>' +
      '</tr></thead><tbody>' + rows + '</tbody></table></div>' +
    '</section>';
  }

  function cardRow(L) {
    var s = RA.state, wf = cardWaterfall(L);
    var ek = L.id, open = !!s.exp[ek];
    var mk1 = s.groupBy === "site" ? L.supplier : L.site;
    var bill = wf.bill == null
      ? '<span class="ra-bill ra-bill--miss">\u2014</span>'
      : '<span class="ra-bill">' + gbp(wf.bill) + '</span>';
    var dot = L.status === "error" ? '<span class="ra-dot ra-dot--err" title="' + esc((L.issues[0] || {}).msg || "Error") + '"></span>'
      : L.status === "warning" ? '<span class="ra-dot ra-dot--warn" title="' + esc((L.issues[0] || {}).msg || "Warning") + '"></span>'
      : '<span class="ra-dot ra-dot--ok"></span>';
    var tags = "";
    if (L._outlier) tags += '<span class="ra-rtag ra-rtag--warn">outlier</span>';
    if (L._changed) tags += '<span class="ra-rtag ra-rtag--chg">changed</span>';

    var row = '<tr class="ra-row' + (open ? " is-open" : "") + (L.status === "error" ? " is-err" : "") + '" data-ra-exp="' + esc(ek) + '" tabindex="0" role="button" aria-expanded="' + (open ? "true" : "false") + '">' +
      '<td class="ra-mk">' + esc(mk1) + '</td>' +
      '<td class="ra-cat">' + esc(L.jobType) + tags + '</td>' +
      '<td class="ra-n">' + gbp(wf.pay) + '</td>' +
      '<td class="ra-n ra-muted">' + gbp(wf.burden) + '</td>' +
      '<td class="ra-n">' + (wf.markup == null ? '<span class="ra-miss">missing</span>' : gbp(wf.markup)) + '</td>' +
      '<td class="ra-n">' + bill + '</td>' +
      '<td class="ra-n ra-muted">' + (wf.marginPct == null ? "\u2014" : wf.marginPct.toFixed(1) + "%") + '</td>' +
      '<td class="ra-dotcell">' + dot + '</td>' +
      '<td class="ra-chev">' + ico(open ? "ChevronUp" : "ChevronDown") + '</td>' +
    '</tr>';
    return row + (open ? '<tr class="ra-wf-row"><td colspan="9">' + waterfallBlock(L, wf) + '</td></tr>' : "");
  }

  // tier-tagged waterfall block (shared shape with the simulator output)
  function waterfallBlock(L, wf) {
    function line(tier, label, val, note, strong) {
      var chip = '<span class="rp-tchip rp-tchip--' + tier + '">' + (tier === "ref" ? "Pay" : tier === "agy" ? "Markup" : "Engine") + '</span>';
      return '<div class="ra-wf-line' + (strong ? " is-total" : "") + (note ? " has-note" : "") + '">' +
        chip + '<span class="ra-wf-label">' + label + (note ? '<span class="ra-wf-note">' + note + '</span>' : "") + '</span>' +
        '<span class="ra-wf-val">' + (val == null ? "\u2014" : gbp(val)) + '</span></div>';
    }
    var lines =
      line("ref", "Pay rate", wf.pay) +
      line("eng", "+ WTR holiday (" + wf.wtrPct.toFixed(2) + "%)", wf.wtr) +
      line("eng", "+ Employer NI (15% > \u00a3" + ENG.niThresh + "/wk)", wf.eni) +
      line("eng", "+ Pension (" + L.penPct.toFixed(2) + "%)", wf.pen, L.penPct < PENSION_MIN ? "below 3% minimum" : "") +
      line("eng", "+ Apprenticeship levy", wf.levy) +
      line("eng", "+ Sick pay", wf.sick) +
      '<div class="ra-wf-line is-sub"><span class="rp-tchip rp-tchip--eng">Engine</span><span class="ra-wf-label">= Fully-burdened pay</span><span class="ra-wf-val">' + gbp(wf.burdened) + '</span></div>' +
      line("agy", "+ Markup", wf.markup) +
      '<div class="ra-wf-line is-bill"><span class="rp-tchip rp-tchip--agy">Bill</span><span class="ra-wf-label">= Bill rate</span><span class="ra-wf-val ra-wf-bill">' + (wf.bill == null ? "\u2014" : gbp(wf.bill)) + '</span></div>';
    return '<div class="ra-wf">' +
      '<div class="ra-wf-head">' + esc(L.supplier) + ' \u00b7 ' + esc(L.site) + ' \u00b7 ' + esc(L.jobType) + ' \u00b7 ' + L.hrs + 'h/wk' +
        (wf.mult ? '<span class="ra-wf-mult">bill is ' + wf.mult.toFixed(2) + '\u00d7 pay</span>' : "") + '</div>' +
      lines +
    '</div>';
  }

  // ============================ 8.2 SIMULATOR ============================
  function defaultScenario(ls, L) {
    L = L || ls[0] || {};
    return {
      jobType: L.jobType || "Warehouse", supplier: L.supplier || "Staffline", site: L.site || "Warrington",
      entity: "FlexCo Staffing Ltd",
      age: 27, tenureWeeks: 4, hoursThisWeek: 40,
      vat: VAT_DEFAULT, otThreshold: 40, otMult: 1.5,
      shiftHours: 8, days: 5,
      apprentice: false,
      preset: null,
    };
  }

  // Resolve the staged card backing a scenario (supplier+site+position),
  // switching to parity once tenure ≥ 12 weeks for warehouse work.
  function resolveCard(sc, ls) {
    var pos = sc.jobType;
    var parityDue = sc.tenureWeeks >= PARITY_WEEKS;
    if (parityDue && pos === "Warehouse") pos = "Warehouse Parity";
    var match = ls.filter(function (L) { return L.supplier === sc.supplier && L.site === sc.site && L.jobType === pos; })[0];
    if (!match) match = ls.filter(function (L) { return L.supplier === sc.supplier && L.jobType === pos; })[0];
    if (!match) match = ls.filter(function (L) { return L.jobType === pos; })[0] || ls[0];
    return { card: match, resolvedPos: pos, parityDue: parityDue, parityApplied: parityDue && C.isParity(pos) };
  }

  // Full scenario simulation with §8.3 guardrails.
  function simulate(sc) {
    var ls = staged(), res = resolveCard(sc, ls), L = res.card, guards = [];
    var pay = L.net, hrs = sc.hoursThisWeek || L.hrs;
    var parity = res.parityApplied || C.isParity(L.jobType);
    var wtrPct = parity ? ENG.wtrPar : ENG.wtrStd;

    // NMW by age
    var floor = nmwFloor(sc.age, sc.apprentice);
    if (pay < floor - 0.001) guards.push({ sev: "err", t: "Below NMW for age", d: "Pay \u00a3" + pay.toFixed(2) + " is under the \u00a3" + floor.toFixed(2) + " floor for this age band." });

    // parity reflection
    if (res.parityDue && !parity) guards.push({ sev: "warn", t: "AWR parity not reflected", d: "Worker has \u2265 12 weeks tenure but the resolved rate is not the parity rate." });
    else if (res.parityApplied) guards.push({ sev: "info", t: "AWR parity applied", d: "\u2265 12 weeks tenure \u2014 using post-parity pay and parity WTR (" + ENG.wtrPar + "%)." });

    var wtr = r2(pay * wtrPct / 100);

    // Employer NI — under-21 / apprentice <25 relief (0% up to £50,270/yr)
    var nicRelief = sc.age < 21 || (sc.apprentice && sc.age < 25);
    var annualised = (pay + wtr) * hrs * 52;
    var eni;
    if (nicRelief && annualised <= NIC_RELIEF_CEILING) { eni = 0; guards.push({ sev: "info", t: "Employer-NIC relief applied", d: (sc.apprentice ? "Apprentice under 25" : "Worker under 21") + " \u2014 0% employer NI up to \u00a350,270/yr." }); }
    else eni = r2(((pay + wtr) * hrs - ENG.niThresh) * ENG.niPct / 100 / hrs);

    // Pension auto-enrolment
    var eligible = pensionEligible(sc.age);
    var pen;
    if (!eligible) { pen = 0; guards.push({ sev: "info", t: "Pension suppressed", d: "Worker outside auto-enrolment (age " + sc.age + ") \u2014 no employer pension due." }); }
    else { pen = r2(pay * L.penPct / 100); if (L.penPct < PENSION_MIN) guards.push({ sev: "warn", t: "Pension below 3% minimum", d: "Supplier pension " + L.penPct.toFixed(2) + "% is under the 3% auto-enrolment minimum \u2014 likely non-compliant." }); }

    // Levy / SSP
    var levy = L.levyIncluded ? (L.levy || r2((pay + wtr + eni) * ENG.levyPct / 100)) : 0;
    var sick = L.sick || 0;
    if (!sick) guards.push({ sev: "warn", t: "SSP not costed", d: "Statutory sick pay is a real cost; \u00a30 here understates the fully-burdened rate." });

    // Working time
    if (hrs > WORKING_TIME_CAP) guards.push({ sev: "warn", t: "Exceeds 48-hour week", d: hrs + "h this week is above the 48-hour working-time average \u2014 opt-out required." });

    var burdened = r2(pay + wtr + eni + pen + levy + sick);
    var markup = (L.margin == null || L.margin === "") ? null : r2(L.margin);
    if (markup == null) guards.push({ sev: "err", t: "Missing markup", d: "This supplier/position has no markup configured \u2014 can\u2019t produce a bill rate." });
    var bill = markup == null ? null : r2(burdened + markup);

    // Booking total
    var otThresh = sc.otThreshold || 40, otMult = sc.otMult || 1.5;
    var stdHours = Math.min(hrs, otThresh), otHours = Math.max(0, hrs - otThresh);
    var billStd = bill == null ? null : r2(bill * stdHours);
    var billOt = bill == null ? null : r2(bill * otMult * otHours);
    var exVat = bill == null ? null : r2(billStd + billOt);
    var vatAmt = exVat == null ? null : r2(exVat * sc.vat / 100);
    var incVat = exVat == null ? null : r2(exVat + vatAmt);
    var billIncVat = bill == null ? null : r2(bill * (1 + sc.vat / 100));

    return {
      card: L, pay: pay, parity: parity, wtrPct: wtrPct, wtr: wtr, eni: eni, nicRelief: nicRelief,
      pen: pen, eligible: eligible, levy: levy, sick: sick, burdened: burdened, markup: markup, bill: bill,
      marginPct: bill ? r2(markup / bill * 100) : null, mult: bill ? r2(bill / pay) : null,
      floor: floor, stdHours: stdHours, otHours: otHours, billStd: billStd, billOt: billOt,
      exVat: exVat, vatAmt: vatAmt, incVat: incVat, billIncVat: billIncVat,
      guards: guards, resolvedPos: res.resolvedPos,
    };
  }

  function simulatorView() {
    var s = RA.state;
    return '<div class="ra-sim">' +
      simPresets() +
      '<div class="ra-sim-grid">' +
        '<div class="ra-sim-col ra-sim-inputs">' + simInputs(s.sim) + '</div>' +
        '<div class="ra-sim-col ra-sim-outputs">' + simOutputs(s.sim) + '</div>' +
      '</div>' +
      (s.pinned.length ? pinnedView() : "") +
    '</div>';
  }

  function simPresets() {
    var ls = staged();
    var presets = [
      { id: "highest", label: "Highest markup" },
      { id: "parity", label: "Parity (12+ wks)" },
      { id: "under21", label: "Under-21 worker" },
    ];
    var btns = presets.map(function (p) {
      return '<button class="ra-preset' + (RA.state.sim.preset === p.id ? " is-on" : "") + '" data-ra-preset="' + p.id + '">' + ico("Bolt") + p.label + '</button>';
    }).join("");
    return '<div class="ra-presets"><span class="ra-presets-l">Presets</span>' + btns +
      '<button class="ra-preset ra-preset--pin" data-ra-pin>' + ico("Pin") + 'Pin this scenario</button></div>';
  }

  function field(label, control, hint) {
    return '<label class="ra-field"><span class="ra-field-l">' + label + '</span>' + control + (hint ? '<span class="ra-field-h">' + hint + '</span>' : "") + '</label>';
  }
  function selOf(attr, val, opts) {
    return '<select class="ra-in" data-ra-sim="' + attr + '">' + opts.map(function (o) {
      var v = typeof o === "string" ? o : o.v, t = typeof o === "string" ? o : o.t;
      return '<option value="' + esc(v) + '"' + (String(v) === String(val) ? " selected" : "") + '>' + esc(t) + '</option>';
    }).join("") + '</select>';
  }
  function numIn(attr, val, step, min) {
    return '<input type="number" class="ra-in" data-ra-sim="' + attr + '" value="' + val + '" step="' + (step || 1) + '"' + (min != null ? ' min="' + min + '"' : "") + ' />';
  }

  function simInputs(sc) {
    var ls = staged();
    var suppliers = []; ls.forEach(function (L) { if (suppliers.indexOf(L.supplier) < 0) suppliers.push(L.supplier); }); suppliers.sort();
    var positions = ["Warehouse", "Warehouse Parity", "HGV Driver", "Van Driver"];
    var sites = C.REF_SITES.slice();
    var parityDue = sc.tenureWeeks >= PARITY_WEEKS;

    var pricing = '<div class="ra-fieldset"><div class="ra-fieldset-h">' + ico("Wallet") + 'Pricing config</div>' +
      '<div class="ra-fieldgrid">' +
        field("Position", selOf("jobType", sc.jobType, positions)) +
        field("Supplier", selOf("supplier", sc.supplier, suppliers)) +
        field("Legal entity", selOf("entity", sc.entity, ["FlexCo Staffing Ltd", "FlexCo North Ltd", "FlexCo Logistics Ltd"])) +
        field("Location", selOf("site", sc.site, sites)) +
      '</div></div>';

    var worker = '<div class="ra-fieldset"><div class="ra-fieldset-h">' + ico("Person") + 'Worker</div>' +
      '<div class="ra-fieldgrid">' +
        field("Age", numIn("age", sc.age, 1, 16)) +
        field("Tenure (weeks)", numIn("tenureWeeks", sc.tenureWeeks, 1, 0), parityDue ? "Parity applies (\u2265 12 wks)" : "Pre-parity") +
        field("Hours this week", numIn("hoursThisWeek", sc.hoursThisWeek, 0.5, 0)) +
        field("Apprentice", '<button class="rc-levy' + (sc.apprentice ? " is-on" : "") + '" data-ra-appr role="switch" aria-checked="' + (sc.apprentice ? "true" : "false") + '">' + (sc.apprentice ? "Yes" : "No") + '</button>') +
      '</div></div>';

    var assume = '<div class="ra-fieldset"><div class="ra-fieldset-h">' + ico("Adjustment") + 'Assumptions</div>' +
      '<div class="ra-locked">' + ico("Information") + 'Statutory inputs are locked by the engine: WTR ' + ENG.wtrStd + '% / ' + ENG.wtrPar + '% parity \u00b7 employer NI ' + ENG.niPct + '% \u00b7 levy ' + ENG.levyPct + '% \u00b7 NMW & NIC relief by age.</div>' +
      '<div class="ra-fieldgrid">' +
        field("VAT %", numIn("vat", sc.vat, 1, 0)) +
        field("OT threshold (h/wk)", numIn("otThreshold", sc.otThreshold, 1, 0)) +
        field("OT multiplier", numIn("otMult", sc.otMult, 0.1, 1)) +
      '</div></div>';

    return pricing + worker + assume;
  }

  function simOutputs(sc) {
    var r = simulate(sc);
    // guardrails banner
    var errs = r.guards.filter(function (g) { return g.sev === "err"; });
    var warns = r.guards.filter(function (g) { return g.sev === "warn"; });
    var infos = r.guards.filter(function (g) { return g.sev === "info"; });
    var guardHtml = r.guards.length ? '<div class="ra-guards">' + r.guards.map(function (g) {
      var ic = g.sev === "err" ? "Alert" : g.sev === "warn" ? "Information" : "Check";
      return '<div class="ra-guard ra-guard--' + g.sev + '">' + ico(ic) + '<div><b>' + esc(g.t) + '</b><span>' + esc(g.d) + '</span></div></div>';
    }).join("") + '</div>' : "";

    // waterfall
    function wl(tier, label, val, note, cls) {
      var chip = '<span class="rp-tchip rp-tchip--' + tier + '">' + (tier === "ref" ? "Pay" : tier === "agy" ? "Markup" : "Engine") + '</span>';
      return '<div class="ra-wf-line' + (cls ? " " + cls : "") + (note ? " has-note" : "") + '">' + chip +
        '<span class="ra-wf-label">' + label + (note ? '<span class="ra-wf-note">' + note + '</span>' : "") + '</span>' +
        '<span class="ra-wf-val">' + (val == null ? "\u2014" : gbp(val)) + '</span></div>';
    }
    var wf = '<div class="ra-wf ra-wf--sim">' +
      '<div class="ra-wf-head">' + esc(r.card.supplier) + ' \u00b7 ' + esc(r.resolvedPos) + ' \u00b7 ' + esc(sc.site) + '</div>' +
      wl("ref", "Pay rate", r.pay, r.pay < r.floor ? "below \u00a3" + r.floor.toFixed(2) + " floor" : "") +
      wl("eng", "+ WTR holiday (" + r.wtrPct.toFixed(2) + "%)", r.wtr, r.parity ? "parity" : "") +
      wl("eng", "+ Employer NI", r.eni, r.nicRelief ? "relief \u2014 under-age" : "") +
      wl("eng", "+ Pension", r.pen, !r.eligible ? "not eligible" : (r.card.penPct < PENSION_MIN ? "< 3%" : "")) +
      wl("eng", "+ Levy", r.levy) +
      wl("eng", "+ Sick", r.sick) +
      wl("eng", "= Fully-burdened pay", r.burdened, "", "is-sub") +
      wl("agy", "+ Markup", r.markup) +
      wl("agy", "= Bill rate", r.bill, "", "is-bill") +
    '</div>';

    // booking
    var booking = '<div class="ra-booking"><div class="ra-booking-h">' + ico("Calendar") + 'This booking</div>' +
      '<div class="ra-booking-rows">' +
        bkRow("Standard hours", r.stdHours + " \u00d7 " + (r.bill == null ? "\u2014" : gbp(r.bill)), r.billStd) +
        (r.otHours ? bkRow("Overtime", r.otHours + " \u00d7 " + (r.bill == null ? "\u2014" : gbp(r.bill)) + " \u00d7 " + sc.otMult, r.billOt) : "") +
        bkRow("Subtotal (ex VAT)", "", r.exVat, "is-sub") +
        bkRow("VAT (" + sc.vat + "%)", "", r.vatAmt) +
        bkRow("Total incl VAT", "", r.incVat, "is-total") +
      '</div></div>';

    // summary tiles
    var tiles = '<div class="ra-tiles">' +
      tile(r.billIncVat == null ? "\u2014" : gbp(r.billIncVat), "Bill /hr incl VAT") +
      tile(r.marginPct == null ? "\u2014" : r.marginPct.toFixed(1) + "%", "Margin") +
      tile(r.mult == null ? "\u2014" : r.mult.toFixed(2) + "\u00d7", "Bill vs pay") +
    '</div>';

    var headline = '<div class="ra-sim-headline">' +
      '<div class="ra-sim-bill"><span class="ra-sim-bill-l">Bill rate</span><span class="ra-sim-bill-v">' + (r.bill == null ? "\u2014" : gbp(r.bill)) + '</span><span class="ra-sim-bill-u">/hr ex VAT</span></div>' +
      (errs.length ? '<span class="ra-sim-flag ra-sim-flag--err">' + ico("Alert") + errs.length + ' issue' + (errs.length === 1 ? "" : "s") + '</span>'
        : warns.length ? '<span class="ra-sim-flag ra-sim-flag--warn">' + ico("Information") + warns.length + ' warning' + (warns.length === 1 ? "" : "s") + '</span>'
        : '<span class="ra-sim-flag ra-sim-flag--ok">' + ico("Check") + 'Compliant</span>') +
    '</div>';

    return headline + guardHtml + wf + booking + tiles;
  }
  function bkRow(label, calc, val, cls) {
    return '<div class="ra-bk-row' + (cls ? " " + cls : "") + '"><span class="ra-bk-l">' + label + (calc ? ' <em>' + calc + '</em>' : "") + '</span><span class="ra-bk-v">' + (val == null ? "\u2014" : gbp(val)) + '</span></div>';
  }
  function tile(big, label) { return '<div class="ra-tile"><div class="ra-tile-n">' + big + '</div><div class="ra-tile-l">' + label + '</div></div>'; }

  // pinned scenarios
  function pinnedView() {
    var rows = RA.state.pinned.map(function (p, i) {
      var r = simulate(p.sc);
      return '<tr><td>' + esc(p.label) + '</td><td>' + esc(r.card.supplier) + ' \u00b7 ' + esc(r.resolvedPos) + '</td>' +
        '<td class="ra-n">age ' + p.sc.age + '</td><td class="ra-n">' + p.sc.hoursThisWeek + 'h</td>' +
        '<td class="ra-n"><b>' + (r.bill == null ? "\u2014" : gbp(r.bill)) + '</b></td>' +
        '<td class="ra-n">' + (r.marginPct == null ? "\u2014" : r.marginPct.toFixed(1) + "%") + '</td>' +
        '<td>' + (r.guards.some(function (g) { return g.sev === "err"; }) ? '<span class="ra-dot ra-dot--err"></span>' : r.guards.some(function (g) { return g.sev === "warn"; }) ? '<span class="ra-dot ra-dot--warn"></span>' : '<span class="ra-dot ra-dot--ok"></span>') + '</td>' +
        '<td><button class="ra-unpin" data-ra-unpin="' + i + '" aria-label="Remove">' + ico("X") + '</button></td></tr>';
    }).join("");
    return '<div class="ra-pinned"><div class="ra-pinned-h">' + ico("Pin") + 'Pinned scenarios</div>' +
      '<div class="rm-tablewrap"><table class="ra-pin-table"><thead><tr>' +
        '<th>Scenario</th><th>Resolves to</th><th class="ra-n">Worker</th><th class="ra-n">Hours</th><th class="ra-n">Bill /hr</th><th class="ra-n">Margin</th><th></th><th></th>' +
      '</tr></thead><tbody>' + rows + '</tbody></table></div></div>';
  }

  // keep number inputs from re-rendering on every keystroke
  RA._syncSimInputs = function () {};

  function applyPreset(id) {
    var ls = staged(), sc = RA.state.sim;
    sc.preset = id;
    if (id === "highest") {
      var best = null; ls.forEach(function (L) { if (L.margin != null && (!best || L.margin > best.margin)) best = L; });
      if (best) { sc.jobType = best.jobType; sc.supplier = best.supplier; sc.site = best.site; sc.tenureWeeks = 4; sc.age = 27; sc.apprentice = false; }
    } else if (id === "parity") {
      sc.jobType = "Warehouse"; sc.tenureWeeks = 14; sc.age = 30; sc.apprentice = false;
    } else if (id === "under21") {
      sc.age = 19; sc.tenureWeeks = 4; sc.apprentice = false; sc.jobType = "Warehouse";
    }
  }

  // ------------------------------------------------------------------ events
  RA._wireOnce = function () {
    var root = RA._root;
    if (!root || root.__raWired) return;
    root.__raWired = true;

    root.addEventListener("click", function (e) {
      var s = RA.state;
      var tb = e.target.closest("[data-ra-tab]"); if (tb) { s.tab = tb.getAttribute("data-ra-tab"); RA._render(); return; }
      var gb = e.target.closest("[data-ra-group]"); if (gb) { s.groupBy = gb.getAttribute("data-ra-group"); RA._render(); return; }
      var ch = e.target.closest("[data-ra-chip]"); if (ch) { var c = ch.getAttribute("data-ra-chip"); s.chip = s.chip === c ? null : c; RA._render(); return; }
      var ex = e.target.closest("[data-ra-exp]"); if (ex) { var k = ex.getAttribute("data-ra-exp"); s.exp[k] = !s.exp[k]; RA._render(); return; }
      var pr = e.target.closest("[data-ra-preset]"); if (pr) { applyPreset(pr.getAttribute("data-ra-preset")); RA._render(); return; }
      if (e.target.closest("[data-ra-appr]")) { s.sim.apprentice = !s.sim.apprentice; s.sim.preset = null; RA._render(); return; }
      if (e.target.closest("[data-ra-pin]")) {
        var r = simulate(s.sim);
        s.pinned.push({ label: r.card.supplier + " \u00b7 " + r.resolvedPos + " \u00b7 age " + s.sim.age, sc: JSON.parse(JSON.stringify(s.sim)) });
        RA._render(); toast("Scenario pinned"); return;
      }
      var up = e.target.closest("[data-ra-unpin]"); if (up) { s.pinned.splice(+up.getAttribute("data-ra-unpin"), 1); RA._render(); return; }
    });

    root.addEventListener("keydown", function (e) {
      if (e.key !== "Enter" && e.key !== " ") return;
      var ex = e.target.closest("[data-ra-exp]");
      if (ex) { e.preventDefault(); var k = ex.getAttribute("data-ra-exp"); RA.state.exp[k] = !RA.state.exp[k]; RA._render(); }
    });

    // live recompute on input without losing focus: update state, then
    // re-render only the outputs column.
    root.addEventListener("input", function (e) {
      var el = e.target; if (!el.hasAttribute("data-ra-sim")) return;
      var attr = el.getAttribute("data-ra-sim"), s = RA.state.sim;
      if (["jobType", "supplier", "site", "entity"].indexOf(attr) >= 0) s[attr] = el.value;
      else { var n = parseFloat(el.value); s[attr] = isNaN(n) ? 0 : n; }
      s.preset = null;
      var out = root.querySelector(".ra-sim-outputs");
      if (out) { out.innerHTML = simOutputs(s); if (window.Proto) window.Proto.fillIcons(out); }
    });

    root.addEventListener("change", function (e) {
      var el = e.target; if (!el.hasAttribute("data-ra-sim")) return;
      // selects re-render fully so dependent hints update
      if (el.tagName === "SELECT") RA._render();
    });
  };

})();
