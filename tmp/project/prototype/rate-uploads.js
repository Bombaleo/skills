/* =====================================================================
   Settings · Rate Cards — Uploads queue + scalable validate (window.RU)
   ---------------------------------------------------------------------
   A scalable rate-card uploader. Uploading a file no longer blocks the
   user in a wizard: the file enters an UPLOADS QUEUE with a live
   "Uploading" status. Once uploaded, the user opens it to run the
   VALIDATE phase — a surface built to stay legible and fast with
   100K+ rate lines and 10K+ errors:
     · an error-TYPE summary (scan thousands of errors at a glance)
     · a VIRTUALIZED row list (only the visible window is in the DOM)
     · severity / type filters + free-text search
     · a downloadable CSV error report

   Self-contained, mounts into #ru-root. Reads host helpers from
   window.Proto (ico / escapeHtml / toast / fillIcons / gbp). Talks back
   to the app shell through the host object passed to RU.mount:
     host.openValidate(id) · host.closeValidate() ·
     host.continueConfigure(item) · host.applyUpload(item)
   IA version: V1.  Everest tokens only.
   ===================================================================== */
(function () {
  "use strict";
  function P() { return window.Proto || {}; }
  function ico(n, c) { return P().ico ? P().ico(n, c) : ""; }
  function esc(s) { return P().escapeHtml ? P().escapeHtml(String(s == null ? "" : s)) : String(s == null ? "" : s); }
  function toast(m) { if (P().toast) P().toast(m); }
  function gbp(v) { return P().gbp ? P().gbp(v) : ("\u00a3" + (Math.round(v * 100) / 100).toFixed(2)); }

  function fmtNum(n) { return (n == null ? 0 : n).toLocaleString("en-GB"); }
  function fmtSize(b) {
    if (b == null) return "";
    if (b < 1024) return b + " B";
    if (b < 1048576) return (b / 1024).toFixed(0) + " KB";
    return (b / 1048576).toFixed(1) + " MB";
  }

  // ---- deterministic RNG so a given file validates the same way -------
  function hashStr(s) { var h = 2166136261; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

  // ---- domain reference values (UK staffing rate card) ----------------
  var SITES = ["Birmingham", "Eurocentral", "Warrington", "Rugby", "Nuneaton", "Barnsley", "Atherstone", "Wednesbury", "Doncaster", "Lutterworth"];
  var ROLES = ["Cat C Day Driver", "Cat C Night Driver", "Cat C&E Day Driver", "Cat C&E Night Driver", "Van Driver Day", "Van Driver Night", "Warehouse Operative AM", "Warehouse Operative PM", "Day Loader", "Night Loader", "Yard Marshal", "Shunter"];
  var AGENCIES = ["DCS Recruitment", "Staffline Group", "The Recruitment Crowd", "Pertemps", "Gi Group"];
  var NMW = 12.21;

  // ---- error catalogue ------------------------------------------------
  //  sev: "error" blocks apply · "warn" is advisory. col: the offending
  //  column. w: relative weight used to distribute a file's total issues.
  var ERR_TYPES = [
    { key: "nmw",      label: "Pay rate below National Minimum Wage", sev: "error", col: "Pay rate", w: 26, fix: "Lift the rate to at least the age-banded NMW floor.",
      gen: function (r) { var v = (9 + r() * 2.8); return { value: gbp(v), message: "Pay rate " + gbp(v) + " is below the " + gbp(NMW) + " age-banded NMW floor" }; } },
    { key: "missing",  label: "Missing pay rate", sev: "error", col: "Pay rate", w: 18, fix: "Enter a pay rate for this line.",
      gen: function () { return { value: "(empty)", message: "Pay rate is blank \u2014 every priced line needs a rate" }; } },
    { key: "role",     label: "Unknown position / role not in catalogue", sev: "error", col: "Role", w: 13, fix: "Map the role to a catalogue position, or add it in Settings \u2192 Positions.",
      gen: function (r) { return { value: "ROLE-" + (1000 + Math.floor(r() * 8999)), message: "Role code is not in the position catalogue" }; } },
    { key: "site",     label: "Unmapped site / location", sev: "error", col: "Site", w: 9, fix: "Map the site to a configured location.",
      gen: function (r) { return { value: "SITE-" + (10 + Math.floor(r() * 89)), message: "Site is not mapped to a configured location" }; } },
    { key: "date",     label: "Invalid effective-date format", sev: "error", col: "Effective date", w: 8, fix: "Use the DD/MM/YYYY date format.",
      gen: function (r) { var d = Math.floor(r() * 99); return { value: d + "/13/26", message: "Effective date \u201c" + d + "/13/26\u201d is not a valid DD/MM/YYYY date" }; } },
    { key: "nan",      label: "Pay rate is not a number", sev: "error", col: "Pay rate", w: 6, fix: "Remove text / symbols so the cell is a plain number.",
      gen: function () { return { value: "\u00a3TBC", message: "Pay rate cell contains text, not a number" }; } },
    { key: "billlt",   label: "Bill rate below pay rate", sev: "error", col: "Bill rate", w: 5, fix: "Bill rate must cover the pay rate plus on-costs.",
      gen: function (r) { var p = 13 + r() * 4, b = p - (0.4 + r()); return { value: gbp(b), message: "Bill rate " + gbp(b) + " is below the pay rate " + gbp(p) }; } },
    { key: "tenure",   label: "Tenure status not recognised", sev: "error", col: "Tenure status", w: 4, fix: "Use Pre-parity or Post-parity.",
      gen: function () { return { value: "wk1", message: "Tenure status must be Pre-parity or Post-parity" }; } },
    { key: "dup",      label: "Duplicate rate line", sev: "warn", col: "\u2014", w: 5, fix: "Remove the duplicate; the last line would win.",
      gen: function () { return { value: "(repeat)", message: "Duplicate of an earlier line for the same keys" }; } },
    { key: "range",    label: "Pay rate outside expected range", sev: "warn", col: "Pay rate", w: 3, fix: "Confirm the rate \u2014 it is far from comparable lines.",
      gen: function (r) { var v = 28 + r() * 20; return { value: gbp(v), message: "Pay rate " + gbp(v) + " is well above comparable lines \u2014 confirm it is intended" }; } },
    { key: "ot",       label: "OT multiplier out of bounds", sev: "warn", col: "OT multiplier", w: 2, fix: "Use a multiplier between 1.0 and 2.0.",
      gen: function (r) { var v = (2.2 + r() * 1.4).toFixed(2); return { value: "\u00d7" + v, message: "OT multiplier \u00d7" + v + " is outside the 1.0\u20132.0 range" }; } },
    { key: "entity",   label: "Missing legal entity", sev: "warn", col: "Legal entity", w: 1, fix: "Set the legal entity for this line.",
      gen: function () { return { value: "(empty)", message: "Legal entity is blank \u2014 defaults to Evri UK Ltd" }; } },
  ];
  function typeMeta(key) { for (var i = 0; i < ERR_TYPES.length; i++) if (ERR_TYPES[i].key === key) return ERR_TYPES[i]; return ERR_TYPES[0]; }

  // Generate the full error list for an item (cached on the item). Big but
  // bounded — only error rows become objects, never the 100K+ clean rows.
  function genErrors(item) {
    if (item._errors) return item._errors;
    var rnd = mulberry32(hashStr(item.name + ":" + item.size + ":" + item.rows));
    var total = item.targetIssues;
    var totW = 0; ERR_TYPES.forEach(function (t) { totW += t.w; });
    var rows = [], uid = 0;
    ERR_TYPES.forEach(function (t, ti) {
      var n = Math.round(total * t.w / totW);
      for (var i = 0; i < n; i++) {
        var g = t.gen(rnd);
        rows.push({
          id: uid++,
          line: 2 + Math.floor(rnd() * item.rows),
          site: SITES[Math.floor(rnd() * SITES.length)],
          role: ROLES[Math.floor(rnd() * ROLES.length)],
          agency: AGENCIES[Math.floor(rnd() * AGENCIES.length)],
          type: t.key, label: t.label, sev: t.sev, col: t.col,
          value: g.value, message: g.message,
        });
      }
    });
    rows.sort(function (a, b) { return a.line - b.line; });
    item._errors = rows;
    return rows;
  }
  function summarize(item) {
    var rows = genErrors(item);
    var byType = {}, errN = 0, warnN = 0, lines = {};
    rows.forEach(function (e) {
      byType[e.type] = (byType[e.type] || 0) + 1;
      if (e.sev === "error") errN++; else warnN++;
      lines[e.line] = 1;
    });
    return { total: rows.length, errN: errN, warnN: warnN, affected: Object.keys(lines).length, byType: byType };
  }

  // ============================================================ state
  var RU = {};
  window.RU = RU;
  var S = null;

  RU.reset = function () { RU.state = null; };
  RU.pick = function () { if (RU._root) { var inp = RU._root.querySelector("[data-ru-file]"); if (inp) inp.click(); } };
  function seedQueue() {
    return [
      { id: "u-evri", name: "Evri_Q3_rate_card_2026.xlsx", size: 7340032, rows: 124560, status: "uploaded",
        uploadedAt: "12 min ago", targetIssues: 14212, _errors: null },
      { id: "u-staff", name: "Staffline_uplift_June.xlsx", size: 1887436, rows: 38210, status: "clean",
        uploadedAt: "1 hr ago", validatedAt: "1 hr ago", targetIssues: 0, _errors: [] },
      { id: "u-dcs", name: "DCS_nightshift_rates.csv", size: 412000, rows: 9804, status: "applied",
        uploadedAt: "Yesterday", validatedAt: "Yesterday", targetIssues: 0, _errors: [] },
    ];
  }
  RU._build = function () {
    RU.state = {
      uploads: seedQueue(),
      sev: "all",     // all | error | warn
      type: "all",    // error-type key or "all"
      q: "",
      _seq: 1,
    };
  };

  RU.mount = function (root, opts) {
    RU._root = root; RU._opts = opts || {};
    if (!root) return;
    try {
      if (!RU.state) RU._build();
      S = RU.state;
      RU._render();
      RU._wireOnce();
    } catch (err) {
      if (window.console && console.error) console.error("[RateUploads] mount failed:", err);
      root.innerHTML = '<div class="ru-crash">' + ico("Alert") + ' The uploads view couldn\u2019t draw.</div>';
    }
  };

  RU._render = function () {
    if (!RU._root) return;
    S = RU.state;
    var vid = RU._opts.validateId;
    var item = vid ? findUpload(vid) : null;
    try {
      RU._root.innerHTML = item ? validateScreen(item) : queueList();
      if (window.Proto) window.Proto.fillIcons(RU._root);
      if (item) attachVlist();
    } catch (err) {
      if (window.console && console.error) console.error("[RateUploads] render failed:", err);
    }
  };
  function findUpload(id) { for (var i = 0; i < S.uploads.length; i++) if (S.uploads[i].id === id) return S.uploads[i]; return null; }

  // ============================================================ queue list
  var STATUS = {
    uploading: { label: "Uploading", cls: "up", icon: "Recalculate" },
    uploaded:  { label: "Ready to validate", cls: "ready", icon: "Information" },
    validating:{ label: "Validating", cls: "val", icon: "Recalculate" },
    errors:    { label: "Errors found", cls: "err", icon: "Alert" },
    clean:     { label: "Validated", cls: "ok", icon: "Check" },
    applied:   { label: "Applied", cls: "applied", icon: "Check" },
    failed:    { label: "Upload failed", cls: "fail", icon: "Cancel" },
  };
  function statusPill(st) {
    var m = STATUS[st] || STATUS.uploaded;
    return '<span class="ru-st ru-st--' + m.cls + '">' +
      (st === "uploading" || st === "validating" ? '<span class="ru-spin"></span>' : ico(m.icon)) +
      m.label + '</span>';
  }

  function queueList() {
    var items = S.uploads.slice();
    var rows = items.length ? items.map(uploadRow).join("") : emptyState();
    return '<div class="ru-queue">' +
      '<div class="ru-queue-head">' +
        '<div class="ru-queue-titles"><h3 class="ru-queue-title">Uploads</h3>' +
          '<p class="ru-queue-sub">Drop a rate card to upload it in the background. Open an upload to validate it \u2014 nothing goes live until you apply.</p></div>' +
        '<button class="ru-btn ru-btn--primary" data-ru-pick>' + ico("FileUpload") + 'Upload rate card</button>' +
      '</div>' +
      '<div class="ru-drop" data-ru-drop tabindex="0" role="button" aria-label="Upload rate card">' +
        ico("FileUpload", "ru-drop-ico") +
        '<div class="ru-drop-t">Drag and drop a rate card, or <span class="ru-drop-link" data-ru-pick>browse</span></div>' +
        '<div class="ru-drop-sub">.xlsx, .xls or .csv \u00b7 up to 100K+ rate lines per file</div>' +
      '</div>' +
      '<div class="ru-list">' + rows + '</div>' +
      '<input type="file" data-ru-file accept=".xlsx,.xls,.csv" hidden />' +
    '</div>';
  }
  function emptyState() {
    return '<div class="ru-empty">' + ico("FileUpload") + '<div>No uploads yet. Drop a rate card above to get started.</div></div>';
  }

  function uploadRow(u) {
    var clickable = (u.status === "uploaded" || u.status === "errors" || u.status === "clean" || u.status === "applied");
    var meta = fmtSize(u.size) + " \u00b7 " + fmtNum(u.rows) + " rate lines \u00b7 " + esc(u.uploadedAt);
    var right;
    if (u.status === "uploading") {
      right = '<div class="ru-prog"><div class="ru-prog-bar" style="width:' + (u.progress || 0) + '%"></div></div>' +
        '<span class="ru-prog-pct">' + Math.round(u.progress || 0) + '%</span>';
    } else if (u.status === "errors") {
      var s = summarize(u);
      right = '<span class="ru-rowsum ru-rowsum--err">' + fmtNum(s.errN) + ' errors</span>' +
        (s.warnN ? '<span class="ru-rowsum ru-rowsum--warn">' + fmtNum(s.warnN) + ' warnings</span>' : "") +
        '<button class="ru-btn ru-btn--primary" data-ru-open="' + u.id + '">Review errors' + ico("ArrowRight") + '</button>';
    } else if (u.status === "uploaded") {
      right = '<button class="ru-btn ru-btn--primary" data-ru-open="' + u.id + '">Validate' + ico("ArrowRight") + '</button>';
    } else if (u.status === "validating") {
      right = '<span class="ru-rowsum">Validating\u2026</span>';
    } else if (u.status === "clean") {
      right = '<span class="ru-rowsum ru-rowsum--ok">' + ico("Check") + 'No issues</span>' +
        '<button class="ru-btn" data-ru-open="' + u.id + '">Open</button>';
    } else if (u.status === "applied") {
      right = '<span class="ru-rowsum ru-rowsum--ok">' + ico("Check") + 'Live</span>' +
        '<button class="ru-btn" data-ru-open="' + u.id + '">Open</button>';
    } else if (u.status === "failed") {
      right = '<span class="ru-rowsum ru-rowsum--err">' + esc(u.error || "Unreadable file") + '</span>' +
        '<button class="ru-btn" data-ru-remove="' + u.id + '">Dismiss</button>';
    }
    return '<div class="ru-row' + (clickable ? " is-clickable" : "") + '"' + (clickable ? ' data-ru-open="' + u.id + '"' : "") + '>' +
      '<span class="ru-row-ico">' + ico(/\.csv$/i.test(u.name) ? "PDF" : "Excel") + '</span>' +
      '<div class="ru-row-main"><div class="ru-row-name">' + esc(u.name) + '</div>' +
        '<div class="ru-row-meta">' + meta + '</div></div>' +
      statusPill(u.status) +
      '<div class="ru-row-right" data-ru-stop>' + right + '</div>' +
    '</div>';
  }

  // ============================================================ validate screen
  function validateScreen(item) {
    if (item.status === "validating") return validatingScreen(item);
    var s = summarize(item);
    var clean = s.total === 0;
    var blocked = s.errN > 0;

    var head =
      '<div class="ru-v-head">' +
        '<button class="ru-back" data-ru-back>' + ico("ArrowLeft") + 'Back to uploads</button>' +
        '<div class="ru-v-id">' +
          '<span class="ru-row-ico ru-row-ico--lg">' + ico(/\.csv$/i.test(item.name) ? "PDF" : "Excel") + '</span>' +
          '<div><div class="ru-v-name">' + esc(item.name) + '</div>' +
            '<div class="ru-v-meta">' + fmtNum(item.rows) + ' rate lines \u00b7 ' + fmtSize(item.size) + ' \u00b7 validated ' + esc(item.validatedAt || "just now") + '</div></div>' +
        '</div>' +
        (clean
          ? '<span class="ru-v-verdict ru-v-verdict--ok">' + ico("Check") + 'No issues found</span>'
          : '<span class="ru-v-verdict ' + (blocked ? "ru-v-verdict--err" : "ru-v-verdict--warn") + '">' +
              ico(blocked ? "Alert" : "Information") + fmtNum(s.errN + s.warnN) + ' issues across ' + fmtNum(s.affected) + ' lines</span>') +
      '</div>';

    var actions =
      '<div class="ru-v-actions">' +
        (clean
          ? '<span class="ru-v-note ru-v-note--ok">' + ico("Check") + 'This file is ready to apply.</span>'
          : blocked
            ? '<span class="ru-v-note ru-v-note--err">' + ico("Alert") + fmtNum(s.errN) + ' errors must be fixed before this card can go live.</span>'
            : '<span class="ru-v-note ru-v-note--warn">' + ico("Information") + 'Only warnings \u2014 you can apply, but review them first.</span>') +
        '<span class="ru-v-actions-sp"></span>' +
        (s.total ? '<button class="ru-btn" data-ru-csv>' + ico("FileDownload") + 'Download error report (CSV)</button>' : "") +
        '<button class="ru-btn" data-ru-reupload>' + ico("FileUpload") + 'Re-upload corrected file</button>' +
        '<button class="ru-btn" data-ru-configure>' + ico("Adjustment") + 'Continue to configuration</button>' +
        '<button class="ru-btn ru-btn--primary" data-ru-apply' + (blocked ? " disabled" : "") + '>' + ico("Bolt") + 'Apply rate card</button>' +
      '</div>';

    if (clean) {
      return '<div class="ru-validate">' + head + actions +
        '<div class="ru-clean">' + ico("Check") + '<div><div class="ru-clean-t">Every line passed validation</div>' +
          '<div class="ru-clean-s">All ' + fmtNum(item.rows) + ' rate lines parsed, mapped and priced without an error or warning.</div></div></div>' +
      '</div>';
    }

    return '<div class="ru-validate">' + head + actions + typeSummary(item, s) + errorBrowser(item, s) + '</div>';
  }

  function validatingScreen(item) {
    return '<div class="ru-validate">' +
      '<div class="ru-v-head"><button class="ru-back" data-ru-back>' + ico("ArrowLeft") + 'Back to uploads</button>' +
        '<div class="ru-v-id"><span class="ru-row-ico ru-row-ico--lg">' + ico("Excel") + '</span>' +
          '<div><div class="ru-v-name">' + esc(item.name) + '</div><div class="ru-v-meta">' + fmtNum(item.rows) + ' rate lines</div></div></div></div>' +
      '<div class="ru-validating"><span class="ru-spin ru-spin--lg"></span>' +
        '<div class="ru-validating-t">Validating ' + fmtNum(item.rows) + ' rate lines\u2026</div>' +
        '<div class="ru-validating-s">Parsing, mapping positions and sites, checking rates against the NMW floor and the engine rules.</div></div>' +
    '</div>';
  }

  // error-type summary — scan thousands of errors by category
  function typeSummary(item, s) {
    var ordered = ERR_TYPES.filter(function (t) { return s.byType[t.key]; })
      .sort(function (a, b) { return s.byType[b.key] - s.byType[a.key]; });
    var cards = ordered.map(function (t) {
      var n = s.byType[t.key];
      var pct = Math.max(1, Math.round((n / item.rows) * 1000) / 10);
      var on = S.type === t.key;
      return '<button class="ru-tcard ru-tcard--' + t.sev + (on ? " is-on" : "") + '" data-ru-type="' + t.key + '">' +
        '<span class="ru-tcard-top">' +
          '<span class="ru-tcard-sev ru-tcard-sev--' + t.sev + '">' + ico(t.sev === "error" ? "Alert" : "Information") + (t.sev === "error" ? "Error" : "Warning") + '</span>' +
          '<span class="ru-tcard-n">' + fmtNum(n) + '</span>' +
        '</span>' +
        '<span class="ru-tcard-label">' + esc(t.label) + '</span>' +
        '<span class="ru-tcard-foot"><span class="ru-tcard-col">' + esc(t.col) + '</span><span class="ru-tcard-pct">' + pct + '% of lines</span></span>' +
        '<span class="ru-tcard-fix">' + ico("Information") + esc(t.fix) + '</span>' +
      '</button>';
    }).join("");
    return '<div class="ru-tsum">' +
      '<div class="ru-tsum-head"><span class="ru-tsum-t">' + ordered.length + ' issue types</span>' +
        '<span class="ru-tsum-hint">Pick a type to filter the lines below</span></div>' +
      '<div class="ru-tcards">' + cards + '</div>' +
    '</div>';
  }

  // ---- filtered error set + virtualized row browser -------------------
  function filtered(item) {
    var rows = genErrors(item);
    var sev = S.sev, type = S.type, q = S.q.trim().toLowerCase();
    if (sev === "all" && type === "all" && !q) return rows;
    return rows.filter(function (e) {
      if (sev !== "all" && e.sev !== sev) return false;
      if (type !== "all" && e.type !== type) return false;
      if (q) {
        var hay = (e.line + " " + e.site + " " + e.role + " " + e.agency + " " + e.value + " " + e.message + " " + e.label).toLowerCase();
        if (hay.indexOf(q) < 0) return false;
      }
      return true;
    });
  }
  var ROW_H = 64, BUF = 6;

  function errorBrowser(item, s) {
    var data = filtered(item);
    var sevSeg = ["all", "error", "warn"].map(function (k) {
      var lbl = k === "all" ? "All" : k === "error" ? "Errors" : "Warnings";
      return '<button class="ru-seg-btn' + (S.sev === k ? " is-on" : "") + '" data-ru-sev="' + k + '">' + lbl + '</button>';
    }).join("");
    var typeOpts = ['<option value="all"' + (S.type === "all" ? " selected" : "") + '>All issue types</option>'].concat(
      ERR_TYPES.filter(function (t) { return s.byType[t.key]; }).map(function (t) {
        return '<option value="' + t.key + '"' + (S.type === t.key ? " selected" : "") + '>' + esc(t.label) + ' (' + fmtNum(s.byType[t.key]) + ')</option>';
      })).join("");
    var activeChip = (S.type !== "all" || S.sev !== "all" || S.q)
      ? '<button class="ru-clearf" data-ru-clearf>' + ico("Cancel") + 'Clear filters</button>' : "";

    var toolbar = '<div class="ru-browser-bar">' +
      '<div class="ru-seg" role="group" aria-label="Severity">' + sevSeg + '</div>' +
      '<select class="ru-tsel" data-ru-typesel aria-label="Issue type">' + typeOpts + '</select>' +
      '<div class="ru-search">' + ico("Search") +
        '<input class="ru-search-in" type="text" placeholder="Search line, site, role, message\u2026" value="' + esc(S.q) + '" data-ru-q aria-label="Search errors" />' +
        (S.q ? '<button class="ru-search-x" data-ru-qclear aria-label="Clear search">' + ico("Cancel") + '</button>' : "") +
      '</div>' +
      activeChip +
      '<span class="ru-browser-count">' + fmtNum(data.length) + ' of ' + fmtNum(s.total) + ' shown</span>' +
    '</div>';

    var header = '<div class="ru-vrow ru-vrow--head">' +
      '<span class="ru-c-line">Line</span>' +
      '<span class="ru-c-keys">Site \u00b7 role</span>' +
      '<span class="ru-c-col">Column</span>' +
      '<span class="ru-c-val">Value</span>' +
      '<span class="ru-c-msg">Issue</span>' +
    '</div>';

    var listInner = data.length
      ? '<div class="ru-vlist" data-ru-vlist style="height:' + Math.min(560, Math.max(180, data.length * ROW_H)) + 'px">' +
          '<div class="ru-vlist-pad" style="height:' + (data.length * ROW_H) + 'px">' +
            '<div class="ru-vlist-rows" data-ru-vrows></div>' +
          '</div>' +
        '</div>'
      : '<div class="ru-vempty">' + ico("Check") + 'No issues match these filters.</div>';

    return '<div class="ru-browser">' + toolbar + header + listInner + '</div>';
  }

  function rowHtml(e) {
    return '<div class="ru-vrow ru-vrow--' + e.sev + '" style="height:' + ROW_H + 'px">' +
      '<span class="ru-c-line"><span class="ru-sevdot ru-sevdot--' + e.sev + '"></span>' + fmtNum(e.line) + '</span>' +
      '<span class="ru-c-keys"><span class="ru-k-site">' + esc(e.site) + '</span><span class="ru-k-role">' + esc(e.role) + '</span></span>' +
      '<span class="ru-c-col">' + esc(e.col) + '</span>' +
      '<span class="ru-c-val"><code>' + esc(e.value) + '</code></span>' +
      '<span class="ru-c-msg">' + esc(e.message) + '</span>' +
    '</div>';
  }

  // Virtualization: render only the visible window of rows. Re-paint on
  // scroll by patching the rows container's transform + contents — no
  // full re-render, so 10K+ errors scroll smoothly.
  function attachVlist() {
    var vl = RU._root.querySelector("[data-ru-vlist]");
    if (!vl) return;
    var item = findUpload(RU._opts.validateId);
    if (!item) return;
    var data = filtered(item);
    var rowsEl = vl.querySelector("[data-ru-vrows]");
    function paint() {
      var top = vl.scrollTop;
      var start = Math.max(0, Math.floor(top / ROW_H) - BUF);
      var visible = Math.ceil(vl.clientHeight / ROW_H) + BUF * 2;
      var end = Math.min(data.length, start + visible);
      var html = "";
      for (var i = start; i < end; i++) html += rowHtml(data[i]);
      rowsEl.style.transform = "translateY(" + (start * ROW_H) + "px)";
      rowsEl.innerHTML = html;
      if (window.Proto) window.Proto.fillIcons(rowsEl);
    }
    vl.addEventListener("scroll", paint, { passive: true });
    paint();
  }

  // ============================================================ ops
  function pickFile() { var inp = RU._root.querySelector("[data-ru-file]"); if (inp) inp.click(); }
  function addUpload(file) {
    var name = (file && file.name) || ("rate_card_" + (S._seq) + ".xlsx");
    var size = (file && file.size) || (1048576 + Math.floor(Math.random() * 8388608));
    // Big files take longer; rows scale with size for the demo.
    var rows = Math.max(5000, Math.round(size / 58));
    var rnd = mulberry32(hashStr(name + size));
    // Most real uploads have issues; ~1 in 4 comes back clean.
    var clean = rnd() < 0.25;
    var item = {
      id: "u-" + (S._seq++), name: name, size: size, rows: rows, status: "uploading", progress: 0,
      uploadedAt: "just now", targetIssues: clean ? 0 : Math.round(rows * (0.05 + rnd() * 0.08)), _errors: clean ? [] : null,
    };
    S.uploads.unshift(item);
    RU._render();
    animateUpload(item);
  }
  function animateUpload(item) {
    var dur = 1400 + Math.min(2600, item.size / 4000); // bigger files, longer
    var start = Date.now();
    var t = setInterval(function () {
      if (!findUpload(item.id) || item.status !== "uploading") { clearInterval(t); return; }
      var p = Math.min(100, ((Date.now() - start) / dur) * 100);
      item.progress = p;
      if (p >= 100) {
        clearInterval(t);
        item.status = "uploaded"; item.uploadedAt = "just now";
        if (!RU._opts.validateId) RU._render();
        toast("\u201c" + item.name + "\u201d uploaded \u2014 open it to validate");
      } else if (!RU._opts.validateId) {
        // patch just the progress bar to avoid re-rendering the whole list
        var row = RU._root.querySelector('[data-ru-open]'); // fallback
        var bar = RU._root.querySelector('.ru-row .ru-prog-bar');
        var pct = RU._root.querySelector('.ru-row .ru-prog-pct');
        if (bar) bar.style.width = p + "%";
        if (pct) pct.textContent = Math.round(p) + "%";
      }
    }, 90);
  }
  function openValidate(id) {
    var item = findUpload(id); if (!item) return;
    if (item.status === "uploaded") {
      // run the validate pass, then reveal results
      item.status = "validating";
      S.sev = "all"; S.type = "all"; S.q = "";
      if (RU._opts.host && RU._opts.host.openValidate) RU._opts.host.openValidate(id);
      setTimeout(function () {
        if (item.status !== "validating") return;
        var s = summarize(item);
        item.status = s.total > 0 ? "errors" : "clean";
        item.validatedAt = "just now";
        RU._render();
      }, 1300);
    } else {
      S.sev = "all"; S.type = "all"; S.q = "";
      if (RU._opts.host && RU._opts.host.openValidate) RU._opts.host.openValidate(id);
    }
  }
  function downloadCsv(item) {
    try {
      var data = filtered(item);
      var head = ["Line", "Sheet", "Site", "Role", "Agency", "Severity", "Issue type", "Column", "Value", "Message"];
      var cell = function (v) { v = String(v == null ? "" : v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
      var lines = [head.join(",")];
      for (var i = 0; i < data.length; i++) {
        var e = data[i];
        lines.push([e.line, "Pay Rates", e.site, e.role, e.agency, e.sev === "error" ? "Error" : "Warning", e.label, e.col, e.value, e.message].map(cell).join(","));
      }
      var blob = new Blob([lines.join("\n") + "\n"], { type: "text/csv;charset=utf-8" });
      var a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = item.name.replace(/\.[^.]+$/, "") + "-errors.csv";
      document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(a.href);
      toast("Error report downloaded \u2014 " + fmtNum(data.length) + " rows");
    } catch (err) { toast("Couldn\u2019t generate the report"); }
  }

  // ============================================================ events
  RU._wireOnce = function () {
    var root = RU._root;
    if (!root || root.__ruWired) return;
    root.__ruWired = true;

    root.addEventListener("click", function (e) {
      var t = e.target, hit = function (a) { return t.closest("[" + a + "]"); }, el;
      if (hit("data-ru-pick")) { pickFile(); return; }
      if ((el = hit("data-ru-remove"))) { var rid = el.getAttribute("data-ru-remove"); S.uploads = S.uploads.filter(function (u) { return u.id !== rid; }); RU._render(); return; }
      if ((el = hit("data-ru-open"))) { e.preventDefault(); openValidate(el.getAttribute("data-ru-open")); return; }
      if (hit("data-ru-back")) { if (RU._opts.host && RU._opts.host.closeValidate) RU._opts.host.closeValidate(); return; }
      var item = RU._opts.validateId ? findUpload(RU._opts.validateId) : null;
      if ((el = hit("data-ru-type"))) { var k = el.getAttribute("data-ru-type"); S.type = (S.type === k ? "all" : k); RU._render(); return; }
      if ((el = hit("data-ru-sev"))) { S.sev = el.getAttribute("data-ru-sev"); RU._render(); return; }
      if (hit("data-ru-qclear")) { S.q = ""; RU._render(); return; }
      if (hit("data-ru-clearf")) { S.sev = "all"; S.type = "all"; S.q = ""; RU._render(); return; }
      if (hit("data-ru-csv")) { if (item) downloadCsv(item); return; }
      if (hit("data-ru-reupload")) { pickFile(); return; }
      if (hit("data-ru-apply")) { if (item && RU._opts.host && RU._opts.host.applyUpload) RU._opts.host.applyUpload(item); return; }
      if (hit("data-ru-configure")) { if (item && RU._opts.host && RU._opts.host.continueConfigure) RU._opts.host.continueConfigure(item); return; }
    });

    root.addEventListener("change", function (e) {
      var el = e.target;
      if (el.hasAttribute("data-ru-file")) { var f = el.files && el.files[0]; if (f) addUpload(f); el.value = ""; return; }
      if (el.hasAttribute("data-ru-typesel")) { S.type = el.value; RU._render(); return; }
    });

    var qTimer = null;
    root.addEventListener("input", function (e) {
      var el = e.target;
      if (!el.hasAttribute("data-ru-q")) return;
      var val = el.value, pos = el.selectionStart;
      S.q = val;
      if (qTimer) clearTimeout(qTimer);
      qTimer = setTimeout(function () {
        RU._render();
        var ni = RU._root.querySelector("[data-ru-q]");
        if (ni) { ni.focus(); try { ni.setSelectionRange(pos, pos); } catch (x) {} }
      }, 140);
    });

    // drag & drop onto the dropzone
    root.addEventListener("dragover", function (e) { if (e.target.closest("[data-ru-drop]")) { e.preventDefault(); e.target.closest("[data-ru-drop]").classList.add("is-over"); } });
    root.addEventListener("dragleave", function (e) { var d = e.target.closest("[data-ru-drop]"); if (d) d.classList.remove("is-over"); });
    root.addEventListener("drop", function (e) {
      var d = e.target.closest("[data-ru-drop]"); if (!d) return;
      e.preventDefault(); d.classList.remove("is-over");
      var f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      addUpload(f || null);
    });
  };

})();
