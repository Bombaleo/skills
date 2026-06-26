// =====================================================================
//  FLEX WORK V1 · pages/rate-engine  (IA version: V1)
//  ---------------------------------------------------------------------
//  The shared data + math layer for Rate Automation: the rate-card
//  reference-file format, the parser, the pay rate engine (net pay →
//  on-costs → margin → charge), the .xlsx template builder and the file
//  upload handler. Consumed by BOTH the Agencies engine settings and the
//  Settings → Pricing surface, so it loads BEFORE those page modules.
//
//  Mirrors the v2 "data layer loads before its consumers" pattern
//  (e.g. rate-cards.jsx before rate-cards-ui.jsx). Exposes window.V1.engine.
//  Loaded AFTER core.js (uses V1.state / V1.render / V1.toast).
// =====================================================================
(function (V1) {
  "use strict";

  var engine = {};

  // ---- Lazy SheetJS loader -------------------------------------------
  //  SheetJS is only needed when the user downloads the template or
  //  uploads a file. Loading it on demand (instead of a blocking head
  //  <script>) keeps first paint instant and survives an unreachable
  //  CDN — every consumer already has a CSV fallback when XLSX is absent.
  var xlsxPromise = null;
  engine.ensureXLSX = function () {
    if (window.XLSX) return Promise.resolve(window.XLSX);
    if (xlsxPromise) return xlsxPromise;
    xlsxPromise = new Promise(function (resolve) {
      var s = document.createElement("script");
      s.src = "https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js";
      s.onload = function () { resolve(window.XLSX || null); };
      s.onerror = function () { resolve(null); };
      document.head.appendChild(s);
    });
    return xlsxPromise;
  };

  // ---- Simple (flat) rate-card template columns + sample rows -------
  engine.RATE_COLUMNS = ["Position", "Market", "Sector", "Pay Rate (USD/hr)", "Bill Rate (USD/hr)", "OT Multiplier", "Effective Date"];
  engine.RATE_SAMPLE = [
    ["Warehouse Associate", "Dallas, TX",   "Logistics",     18.50, 27.75, 1.5, "2026-06-01"],
    ["Forklift Operator",   "Dallas, TX",   "Logistics",     21.00, 31.50, 1.5, "2026-06-01"],
    ["General Labor",       "Houston, TX",  "Manufacturing", 17.00, 25.50, 1.5, "2026-06-01"],
    ["Picker / Packer",     "Austin, TX",   "Logistics",     16.75, 25.13, 1.5, "2026-06-01"],
    ["Machine Operator",    "San Antonio, TX","Manufacturing",19.25, 28.88, 1.5, "2026-06-01"],
  ];

  // ============================================================
  //  Rate-card reference-file format (the real WorkWhile upload).
  //  The uploaded workbook is a CONFIG file, not a price list — it
  //  declares which areas/contracts are in scope and how each
  //  net-pay job maps to a job type and a rate-card role. The pay
  //  rate ENGINE below turns that config + agency settings into
  //  charge rates.
  // ============================================================
  // Section markers that live in column A of the sheet.
  var RC_SECTIONS = {
    "Areas Indicated": "areas",
    "Regions Indicated": "regions",
    "Job Types Matching": "jobTypes",
    "Rate To Be Included": "contracts",
    "Rate Card Job Role Matching": "roleMatching",
  };

  // Representative base (net) pay per net-pay job, derived from job
  // type + shift modifiers in the name. Stands in for the Net Pay
  // Rate Table tab that lives in the source workbook.
  engine.basePayFor = function (name, jobType) {
    var n = (name || "").toLowerCase();
    var base;
    switch (jobType) {
      case "HGV Driver":       base = 16.20; break;
      case "Van Driver":       base = 13.10; break;
      case "Warehouse Parity": base = 12.85; break;
      case "Warehouse":        base = 11.78; break;
      default:                 base = 12.40;
    }
    if (/night/.test(n)) base += 1.45;
    else if (/twilight|\bpm\b/.test(n)) base += 0.70;
    if (/c&e|c\+e|c & e/.test(n)) base += 0.85;
    if (/\b44\b/.test(n)) base += 0.40;
    if (/assessor|trainer/.test(n)) base += 1.10;
    return Math.round(base * 100) / 100;
  };

  // Parse the multi-table reference workbook into structured scope.
  engine.parseRateCard = function (aoa) {
    var out = { detected: false, areas: [], regions: [], jobTypes: [], contracts: [], roleMatching: [] };
    var section = null;
    aoa.forEach(function (row) {
      if (!row) return;
      var a = (row[0] == null ? "" : String(row[0])).trim();
      var b = (row[1] == null ? "" : String(row[1])).trim();
      var c = (row[2] == null ? "" : String(row[2])).trim();
      if (a && RC_SECTIONS[a]) { section = RC_SECTIONS[a]; out.detected = true; return; }
      if (a && !RC_SECTIONS[a]) { section = null; return; } // a different section header — stop collecting
      if (!section || !b) return;
      // skip the in-table header row (e.g. "Area Name", "Net Pay Rate Table Job")
      if (/^(area name|region name|net pay rate table job|contract type|net pay table rate)$/i.test(b)) return;
      if (section === "areas")        out.areas.push({ name: b, on: /^y(es)?$/i.test(c) });
      else if (section === "regions") out.regions.push({ name: b, on: /^y(es)?$/i.test(c) });
      else if (section === "contracts") out.contracts.push({ name: b, on: /^y(es)?$/i.test(c) });
      else if (section === "jobTypes" && c) out.jobTypes.push({ netJob: b, jobType: c });
      else if (section === "roleMatching") out.roleMatching.push({ netJob: b, role: c });
    });
    return out;
  };

  // THE PAY RATE ENGINE — net pay → on-costs → margin → charge.
  engine.computeRate = function (base, eng) {
    var parts = eng.onCosts.map(function (o) {
      return { key: o.key, label: o.label, pct: o.pct, on: o.on, amt: o.on ? base * o.pct / 100 : 0 };
    });
    var oncost = parts.reduce(function (s, p) { return s + p.amt; }, 0);
    var payCost = base + oncost;
    var marginAmt = payCost * eng.margin / 100;
    var charge = payCost + marginAmt;
    if (eng.rounding) charge = Math.ceil(charge / eng.rounding) * eng.rounding;
    var marginPctOfCharge = charge > 0 ? (charge - payCost) / charge * 100 : 0;
    return { base: base, parts: parts, oncost: oncost, payCost: payCost, marginAmt: charge - payCost, charge: charge, marginPctOfCharge: marginPctOfCharge };
  };

  // Build a computed rate card from parsed scope + engine settings.
  engine.buildRateCard = function (parsed, eng) {
    var typeMap = {};
    parsed.jobTypes.forEach(function (j) { typeMap[j.netJob] = j.jobType; });
    var seen = {}, rows = [];
    parsed.roleMatching.forEach(function (m) {
      if (!m.role) return;                 // unmapped net-pay jobs are excluded
      if (seen[m.role]) return;            // dedupe by rate-card role name
      seen[m.role] = true;
      var jobType = typeMap[m.netJob] || "Warehouse";
      var base = engine.basePayFor(m.netJob, jobType);
      rows.push({ role: m.role, netJob: m.netJob, jobType: jobType, calc: engine.computeRate(base, eng) });
    });
    return rows;
  };

  // ============================================================
  //  Template (.xlsx) build + download
  // ============================================================
  // Build the multi-table reference template as an array-of-arrays,
  // matching the format parseRateCard() reads back in.
  function rateTemplateAoa() {
    var aoa = [["Rate card automation \u2014 reference tables"], []];
    function section(name, header, rows) {
      aoa.push([name]); aoa.push([]);
      aoa.push(["", header[0], header[1]]);
      rows.forEach(function (r) { aoa.push(["", r[0], r[1]]); });
      aoa.push([]);
    }
    section("Areas Indicated", ["Area Name", "Rate Card Being Created (Y/N)"],
      [["Warrington", "Y"], ["Nuneaton", "N"], ["Rugby", "N"], ["Barnsley", "N"]]);
    section("Regions Indicated", ["Region Name", "Rate Card Being Created (Y/N)"],
      [["North", "N"], ["Central", "N"], ["South", "N"]]);
    section("Job Types Matching", ["Net Pay Rate Table Job", "Job Type"],
      [["Cat C Day Driver", "HGV Driver"], ["Cat C Night Driver", "HGV Driver"],
       ["Cat C&E Day Driver", "HGV Driver"], ["Day Loader", "Warehouse"],
       ["Warehouse Operative AM", "Warehouse"], ["Van Drivers Day", "Van Driver"]]);
    section("Rate To Be Included", ["Contract Type", "Include (Yes/No)"],
      [["2014", "Yes"], ["Van Network", "Yes"], ["Ex-Mirage", "Yes"], ["2005 Closed", "No"]]);
    section("Rate Card Job Role Matching", ["Net Pay Table Rate", "Rate Card Role Name"],
      [["Cat C Day Driver", "Cat C Day Driver"], ["Cat C Night Driver", "Cat C Night Driver"],
       ["Cat C&E Day Driver", "C+E Days"], ["Day Loader", "Day Loader"],
       ["Warehouse Operative AM", "Warehouse Operative AM"], ["Van Drivers Day", "Van Drivers Day"]]);
    return aoa;
  }

  engine.downloadTemplate = function () {
    engine.ensureXLSX().then(function () {
    var aoa = rateTemplateAoa();
    if (window.XLSX) {
      var ws = XLSX.utils.aoa_to_sheet(aoa);
      ws["!cols"] = [{ wch: 28 }, { wch: 30 }, { wch: 30 }];
      var wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Control Panel");
      XLSX.writeFile(wb, "WorkWhile-rate-card-template.xlsx");
      V1.toast("Template downloaded");
    } else {
      var csv = aoa.map(function (r) { return r.map(function (c) { return c == null ? "" : c; }).join(","); }).join("\n");
      var blob = new Blob([csv], { type: "text/csv" });
      var a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "WorkWhile-rate-card-template.csv";
      a.click();
      URL.revokeObjectURL(a.href);
      V1.toast("Template downloaded (CSV)");
    }
    });
  };

  // ============================================================
  //  File upload — parse, set state.upload, re-render
  // ============================================================
  engine.handleFile = function (file) {
    if (!file) return;
    var state = V1.state;
    engine.ensureXLSX().then(function () {
    var reader = new FileReader();
    reader.onload = function (e) {
      var cols = engine.RATE_COLUMNS.slice(), rows = [], aoa = [];
      try {
        if (window.XLSX) {
          var data = new Uint8Array(e.target.result);
          var wb = XLSX.read(data, { type: "array" });
          var ws = wb.Sheets[wb.SheetNames[0]];
          aoa = XLSX.utils.sheet_to_json(ws, { header: 1, blankrows: false });
          if (aoa.length) { cols = aoa[0]; rows = aoa.slice(1).filter(function (r) { return r && r.length; }); }
        }
      } catch (err) { /* fall through to sample */ }

      // Is this the multi-table rate-card reference workbook?
      var parsed = engine.parseRateCard(aoa);
      if (parsed.detected && parsed.roleMatching.length) {
        state.upload = { name: file.name, size: file.size, parsed: parsed, processed: false };
        state.exampleRole = 0;
        V1.render();
        var mapped = parsed.roleMatching.filter(function (m) { return m.role; }).length;
        V1.toast("Rate card read \u2014 " + mapped + " roles, " + parsed.jobTypes.length + " job mappings");
        return;
      }

      // Otherwise fall back to a flat preview (simple template).
      if (!rows.length) { cols = engine.RATE_COLUMNS.slice(); rows = engine.RATE_SAMPLE.map(function (r) { return r.slice(); }); }
      state.upload = { name: file.name, size: file.size, cols: cols, rows: rows, processed: false };
      V1.render();
      V1.toast("File loaded \u2014 " + rows.length + " rows");
    };
    reader.readAsArrayBuffer(file);
    });
  };

  V1.engine = engine;
})(window.V1);
