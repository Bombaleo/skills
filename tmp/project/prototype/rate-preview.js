/* =====================================================================
   Rate Card — "Preview & fix" screen  (Step 3 of 4)   v0.90
   ---------------------------------------------------------------------
   Implements uploads/Preview_and_Fix_Spec.md against the canonical
   client dataset (window.PDF_RATES — supplier × site × job type, each
   with the full net → on-costs → margin → charge waterfall).

   Self-contained: the host (Rate Automation.html) exposes a small set
   of helpers on window.Proto and mounts this screen into #rp-root on
   the wizard's step 3. Everything below — staged model, recompute
   engine, §7 validation, All-rates + Compare views, inline editing,
   bulk actions and the audit log — lives here so the 4760-line app
   shell stays untouched.

   IA version: V1.  Everest tokens only.
   ===================================================================== */
(function () {
  "use strict";

  // ---- host bridge ---------------------------------------------------
  function P() { return window.Proto || {}; }
  function ico(n, c) { return P().ico ? P().ico(n, c) : ""; }
  function esc(s) { return P().escapeHtml ? P().escapeHtml(s) : String(s); }
  function toast(m) { if (P().toast) P().toast(m); }
  function gbp(n) { return "\u00a3" + Number(n).toFixed(2); }
  function r2(n) { return Math.round(n * 100) / 100; }
  function signed(n) { return (n > 0 ? "+" : n < 0 ? "\u2212" : "") + gbp(Math.abs(n)).replace("\u00a3", "\u00a3"); }

  // ---- engine constants (the workbook's standardized formulas) -------
  var ENG = {
    wtrStd: 12.07, wtrPar: 14.04,   // WTR / holiday — parity uses the higher rate
    niPct: 15, niThresh: 96,        // employer's NI: 15% above £96/wk
    levyPct: 0.5,                   // apprenticeship levy 0.5% of paybill
    penStd: 1.50,                   // engine-standard pension contribution
  };

  // Reference scope (Control Panel · Location + Job Types). A line whose
  // site or job type is not here is "unmatched" and needs a mapping.
  var REF_SITES = ["Barnsley", "NRC", "Nuneaton", "Rugby", "Warrington", "Wednesbury"];
  var REF_JOBTYPES = ["HGV Driver", "Van Driver", "Warehouse", "Warehouse Parity"];

  function isParity(jt) { return jt === "Warehouse Parity"; }

  // Recompute a line's waterfall from its (editable) inputs. This is the
  // standardized engine — deliberately NOT the workbook's per-row
  // formulas — so edits flow straight through to the charge rate.
  function recompute(L) {
    if (L.net == null || L.net <= 0) { L.wtr = L.eni = L.pen = L.levy = L.direct = 0; L.charge = null; return L; }
    var wtrPct = isParity(L.jobType) ? ENG.wtrPar : ENG.wtrStd;
    L.wtrPct = wtrPct;
    L.wtr = r2(L.net * wtrPct / 100);
    L.eni = r2(((L.net + L.wtr) * L.hrs - ENG.niThresh) * ENG.niPct / 100 / L.hrs);
    L.pen = r2(L.net * L.penPct / 100);
    // levy: keep the source figure when included & untouched, else recompute
    if (!L.levyIncluded) L.levy = 0;
    else if (L._levyDirty || L.levy == null) L.levy = r2((L.net + L.wtr + L.eni) * ENG.levyPct / 100);
    L.sick = L.sick || 0;
    L.direct = r2(L.net + L.wtr + L.eni + L.pen + L.levy + L.sick);
    L.charge = (L.margin == null || L.margin === "") ? null : r2(L.direct + L.margin);
    return L;
  }

  // The engine-standard pension at 1.5% — used to explain a deviation.
  function penAtStd(L) { return r2(L.net * ENG.penStd / 100); }

  // ---- build the staged set from PDF_RATES + injected real issues ----
  function buildStaged() {
    var src = window.PDF_RATES || [];
    var lines = src.map(function (r, i) {
      var penPct = r.net > 0 ? r2(r.pen / r.net * 100) : 0;
      var L = {
        id: "L" + i, supplier: r.s, site: r.loc, jobType: r.jt, region: "National",
        hrs: r.hrs, net: r.net,
        penPct: penPct, sick: r.sick || 0, levyIncluded: r.levy > 0, levy: r.levy || 0,
        margin: r.margin, srcCharge: r.charge,
        edited: false, acked: false, excluded: false, mapping: { site: null, jobType: null },
        sickBlank: false, injected: false,
      };
      L.orig = { hrs: L.hrs, penPct: L.penPct, sick: L.sick, levyIncluded: L.levyIncluded, levy: L.levy, margin: L.margin };
      recompute(L);
      return L;
    });

    // Inject the three real-world errors the spec calls out so the "fix"
    // surface has something genuine to resolve.
    var n = lines.length;
    function inj(o) { o.id = "X" + (n++); o.region = "National"; o.injected = true; o.edited = false; o.acked = false; o.excluded = false; o.mapping = { site: null, jobType: null }; recompute(o); lines.push(o); return o; }

    // 1 — missing margin (charge invalid → Valid Bid = No)
    inj({ supplier: "Staffline", site: "Wednesbury", jobType: "HGV Driver", hrs: 40, net: 12.21, penPct: 1.64, sick: 0, levyIncluded: true, levy: 0.07, margin: null, srcCharge: null,
          orig: { hrs: 40, penPct: 1.64, sick: 0, levyIncluded: true, levy: 0.07, margin: null } });
    // 2 — duplicate key (TRC Group · Warrington · Warehouse already exists)
    inj({ supplier: "TRC Group", site: "Warrington", jobType: "Warehouse", hrs: 35, net: 12.21, penPct: 1.23, sick: 0, levyIncluded: true, levy: 0.07, margin: 0.62, srcCharge: 16.17,
          orig: { hrs: 35, penPct: 1.23, sick: 0, levyIncluded: true, levy: 0.07, margin: 0.62 } });
    // 3 — unmatched location (Doncaster is not in the reference site list)
    inj({ supplier: "TRC Group", site: "Doncaster", jobType: "Warehouse", hrs: 35, net: 12.21, penPct: 1.31, sick: 0, levyIncluded: true, levy: 0.07, margin: 0.60, srcCharge: 16.15,
          orig: { hrs: 35, penPct: 1.31, sick: 0, levyIncluded: true, levy: 0.07, margin: 0.60 } });

    return lines;
  }

  // ---- §7 validation -------------------------------------------------
  // Cluster rules (pension / margin-outlier) are anchored to ONE
  // representative row per supplier(/job type) so the issues list reads
  // as a focused worklist rather than dozens of duplicates.
  function validate(lines) {
    lines.forEach(function (L) { L.issues = []; });

    function add(L, sev, rule, msg, block) {
      L.issues.push({ sev: sev, rule: rule, msg: msg, block: block || null });
    }

    // duplicate keys
    var seen = {};
    lines.forEach(function (L) {
      if (L.excluded) return;
      var k = L.supplier + "|" + L.site + "|" + L.jobType;
      (seen[k] = seen[k] || []).push(L);
    });
    Object.keys(seen).forEach(function (k) {
      var g = seen[k];
      if (g.length > 1) g.forEach(function (L, idx) {
        // flag every occurrence after the first — the original stays clean
        if (idx > 0 && !L.acked) add(L, "error", "duplicate", "Duplicate key \u2014 " + esc(L.supplier) + " \u00b7 " + esc(L.site) + " \u00b7 " + esc(L.jobType) + " already exists in this upload. Keep one or exclude this row.", "ack");
      });
    });

    lines.forEach(function (L) {
      if (L.excluded) return;
      // unmatched location / job type (resolvable by mapping or acknowledge)
      if (REF_SITES.indexOf(L.site) < 0 && !(L.mapping && L.mapping.site))
        add(L, "error", "unmatched-site", "Unmatched location \u2014 \u201c" + esc(L.site) + "\u201d isn't in the reference. Map it to a known site.", "ack");
      if (REF_JOBTYPES.indexOf(L.jobType) < 0 && !(L.mapping && L.mapping.jobType))
        add(L, "error", "unmatched-jt", "Unmatched job type \u2014 \u201c" + esc(L.jobType) + "\u201d doesn't map to an award role. Map it.", "ack");
      // hard errors — economically invalid, must be fixed
      if (L.net == null || L.net <= 0)
        add(L, "error", "net-missing", "Net pay missing \u2014 no base rate resolved for this row.", "hard");
      if (L.margin == null || L.margin === "")
        add(L, "error", "missing-margin", "Missing margin \u2014 the charge rate is invalid until a margin is set.", "hard");
      else if (L.charge != null && L.charge <= L.net)
        add(L, "error", "charge-le-net", "Charge rate is at or below net pay \u2014 on-costs or margin are missing.", "hard");
    });

    // warnings — hours / levy consistency within a supplier
    var bySup = {};
    lines.forEach(function (L) { if (!L.excluded) (bySup[L.supplier] = bySup[L.supplier] || []).push(L); });
    Object.keys(bySup).forEach(function (sup) {
      var rows = bySup[sup];
      // levy mix
      var inc = rows.filter(function (r) { return r.levyIncluded; }).length;
      var exc = rows.length - inc;
      if (inc > 0 && exc > 0) {
        var minorityInc = inc <= exc; // flag the minority side
        rows.forEach(function (L) {
          if (L.levyIncluded === minorityInc)
            add(L, "warning", "levy-inconsistent", "Apprenticeship levy is " + (L.levyIncluded ? "included" : "excluded") + " here but " + (L.levyIncluded ? "excluded" : "included") + " on this supplier's other rates. Confirm which is right.");
        });
      }
      // hours mix within the same job type
      var byJt = {};
      rows.forEach(function (L) { (byJt[L.jobType] = byJt[L.jobType] || []).push(L); });
      Object.keys(byJt).forEach(function (jt) {
        var hrset = {};
        byJt[jt].forEach(function (L) { hrset[L.hrs] = (hrset[L.hrs] || 0) + 1; });
        var distinct = Object.keys(hrset);
        if (distinct.length > 1) {
          // modal hours = the most common; flag the rest
          var modal = distinct.sort(function (a, b) { return hrset[b] - hrset[a]; })[0];
          byJt[jt].forEach(function (L) {
            if (String(L.hrs) !== modal)
              add(L, "warning", "hours-mismatch", "Hours mismatch \u2014 " + L.hrs + "h here vs " + modal + "h on this supplier's other " + esc(jt) + " rates.");
          });
        }
      });
    });

    // warnings — pension deviation, anchored once per supplier
    var penFlag = {};
    lines.forEach(function (L) {
      if (L.excluded || L.margin == null) return;
      var dev = Math.abs(L.penPct - ENG.penStd);
      if (dev >= 0.55 && !penFlag[L.supplier]) {
        penFlag[L.supplier] = true;
        var src = r2(L.net * L.penPct / 100), std = penAtStd(L);
        add(L, "warning", "pension-deviation", "Pension rate " + L.penPct.toFixed(2) + "% deviates from the 1.5% standard. Recomputed " + gbp(std) + "/hr vs source " + gbp(src) + "/hr (the source formula dropped the \u00a3967 cap).");
      }
    });

    // warnings — margin outlier within a job type, anchored once
    var byJtAll = {};
    lines.forEach(function (L) { if (!L.excluded && L.margin != null) (byJtAll[L.jobType] = byJtAll[L.jobType] || []).push(L); });
    var outFlag = {};
    Object.keys(byJtAll).forEach(function (jt) {
      var ms = byJtAll[jt].map(function (L) { return L.margin; }).sort(function (a, b) { return a - b; });
      var med = ms[Math.floor(ms.length / 2)];
      byJtAll[jt].forEach(function (L) {
        var key = L.supplier + "|" + jt;
        if (L.margin - med >= 0.14 && !outFlag[key]) {
          outFlag[key] = true;
          add(L, "warning", "outlier", "Margin outlier \u2014 " + gbp(L.margin) + " for " + esc(jt) + " sits above the peer median of " + gbp(med) + ".");
        }
      });
    });

    // warnings — rounding drift between source and the engine recompute
    lines.forEach(function (L) {
      if (L.excluded || L.charge == null || L.srcCharge == null) return;
      var d = Math.abs(L.charge - L.srcCharge);
      if (d >= 0.02 && d <= 0.05)
        add(L, "warning", "rounding", "Rounding drift \u2014 engine " + gbp(L.charge) + " vs source " + gbp(L.srcCharge) + " (\u00b1" + gbp(d) + ").");
    });

    // warnings — blank-vs-zero sick pay (curated: a couple of ambiguous rows)
    lines.forEach(function (L) {
      if (L.sickBlank && !L.excluded) add(L, "warning", "sick-blank", "Sick pay left blank \u2014 confirm \u201cnone\u201d (\u00a30.00) rather than a missing value.");
    });
    var sb = lines.filter(function (L) { return L.supplier === "Mo Group" && L.sick === 0 && !L.excluded; });
    sb.slice(0, 2).forEach(function (L) { if (!L.issues.some(function (i) { return i.rule === "sick-blank"; })) add(L, "warning", "sick-blank", "Sick pay left blank \u2014 confirm \u201cnone\u201d (\u00a30.00) rather than a missing value."); });

    lines.forEach(function (L) {
      L.errCount = L.issues.filter(function (i) { return i.sev === "error"; }).length;
      L.warnCount = L.issues.filter(function (i) { return i.sev === "warning"; }).length;
      L.status = L.errCount ? "error" : L.warnCount ? "warning" : "ok";
      L.hardBlock = L.issues.some(function (i) { return i.block === "hard"; });
      L.ackBlock = L.issues.some(function (i) { return i.block === "ack"; });
    });
    return lines;
  }

  // ---- compare baselines (synthetic prior live versions) -------------
  // Each baseline is the staged set rewound by a deterministic set of
  // input changes, so the diff shows New / Changed / Removed with real
  // input-level attribution. The user picks the baseline from a dropdown.
  function buildBaselines(staged) {
    function rewind(label, id, eff, mutate, extras, removeKeys) {
      var map = {};
      staged.forEach(function (L) {
        if (L.injected) return;                 // injected lines are New vs any prior version
        var key = L.supplier + "|" + L.site + "|" + L.jobType;
        var b = { supplier: L.supplier, site: L.site, jobType: L.jobType, hrs: L.hrs, net: L.net, penPct: L.penPct, levyIncluded: L.levyIncluded, sick: L.sick, margin: L.margin };
        mutate(b, L);
        var t = { net: b.net, hrs: b.hrs, penPct: b.penPct, levyIncluded: b.levyIncluded, sick: b.sick, margin: b.margin, jobType: b.jobType };
        recompute(t);
        b.charge = t.charge;
        map[key] = b;
      });
      (extras || []).forEach(function (e) {       // baseline-only rows → show as Removed now
        recompute(e); map[e.supplier + "|" + e.site + "|" + e.jobType] = e;
      });
      (removeKeys || []).forEach(function (k) { delete map[k]; });
      return { id: id, label: label, eff: eff, map: map };
    }

    var v3 = rewind("Version 3 \u00b7 live \u00b7 from 1 Apr 2026", "v3", "2026-04-01", function (b, L) {
      // Winner rolled its margin up by £0.31 since v3 → big movers now
      if (b.supplier === "Winner") b.margin = r2(b.margin - 0.31);
      // TRC Group HGV margin came up £0.15
      if (b.supplier === "TRC Group" && b.jobType === "HGV Driver") b.margin = r2(b.margin - 0.15);
      // a couple of warehouse pensions were higher before (rate dropped)
      if (b.supplier === "Challenge TRG" && b.jobType === "Warehouse") b.penPct = r2(b.penPct + 0.35);
    }, [
      // a line that existed in v3 but is gone now → Removed
      { supplier: "Blue Arrow", site: "Rugby", jobType: "HGV Driver", hrs: 40, net: 12.21, penPct: 1.31, levyIncluded: true, levy: 0.07, sick: 0, margin: 0.95 },
    ]);

    var v2 = rewind("Version 2 \u00b7 superseded \u00b7 from 1 Jan 2026", "v2", "2026-01-01", function (b, L) {
      if (b.supplier === "Winner") b.margin = r2(b.margin - 0.45);
      if (b.jobType === "HGV Driver") b.margin = r2(b.margin - 0.20);
      if (b.jobType === "Warehouse" || b.jobType === "Warehouse Parity") b.margin = r2(Math.max(0.2, b.margin - 0.08));
      b.net = 12.21; // NMW was the same; on-costs differ via margin only
    }, [
      { supplier: "Blue Arrow", site: "Rugby", jobType: "HGV Driver", hrs: 40, net: 12.21, penPct: 1.31, levyIncluded: true, levy: 0.07, sick: 0, margin: 0.90 },
      { supplier: "Blue Arrow", site: "Warrington", jobType: "Warehouse", hrs: 35, net: 12.21, penPct: 1.23, levyIncluded: true, levy: 0.07, sick: 0, margin: 0.40 },
    ]);

    return [v3, v2];
  }

  function diffLine(L, base) {
    var key = L.supplier + "|" + L.site + "|" + L.jobType;
    var b = base.map[key];
    if (!b) return { change: "new", old: null, now: L.charge };
    return { change: (L.charge != null && Math.abs(L.charge - b.charge) >= 0.005) ? "changed" : "unchanged", old: b.charge, now: L.charge, b: b };
  }
  function diffAttribution(L, b) {
    var chips = [];
    if (!b) { chips.push({ k: "new", t: "New mapping" }); return chips; }
    if (Math.abs((L.margin || 0) - (b.margin || 0)) >= 0.005) chips.push({ k: (L.margin > b.margin ? "up" : "down"), t: "Margin " + (L.margin > b.margin ? "\u2191" : "\u2193") });
    if (Math.abs(L.net - b.net) >= 0.005) chips.push({ k: (L.net > b.net ? "up" : "down"), t: "Net pay " + (L.net > b.net ? "\u2191" : "\u2193") });
    if (L.hrs !== b.hrs) chips.push({ k: "neutral", t: "Hours" });
    if (Math.abs(L.penPct - b.penPct) >= 0.005 || L.levyIncluded !== b.levyIncluded) chips.push({ k: "neutral", t: "On-cost param" });
    if (!chips.length) chips.push({ k: "neutral", t: "Rounding" });
    return chips;
  }

  // expose internals the view layer (rate-preview-view.js) consumes
  window.RPCore = {
    ENG: ENG, REF_SITES: REF_SITES, REF_JOBTYPES: REF_JOBTYPES,
    isParity: isParity, recompute: recompute, penAtStd: penAtStd,
    buildStaged: buildStaged, validate: validate,
    buildBaselines: buildBaselines, diffLine: diffLine, diffAttribution: diffAttribution,
    gbp: gbp, r2: r2, esc: esc, ico: ico, toast: toast, P: P,
  };
})();
