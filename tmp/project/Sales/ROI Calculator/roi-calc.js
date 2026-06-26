/* =====================================================================
   Dayforce Flex Work — ROI Calculator logic (Sales track, vanilla JS)
   Model: gross savings (hard $ off invoice + soft $ admin time)
          minus platform cost (1.5% of temp spend, fixed) = net ROI.
   Every saving driver is sourced; sources render inline and in the
   Sources section. Scenario persists to localStorage + a shareable URL.
   ===================================================================== */
(function () {
  "use strict";

  // ---- sources (industry bodies only — SIA & ASA; no competitor VMS) ----
  // access: "public"  → the original article is free to read; link straight to it.
  // access: "members" → the original sits behind an SIA/ASA membership wall, so the
  //                     cited finding is reproduced on the in-project, publicly
  //                     readable Sources notes page (source-notes.html) and links
  //                     onward to the members-only original.
  var NOTES_PAGE = "source-notes.html";
  var SOURCES = {
    "sia-cost-savings": {
      name: "Staffing Industry Analysts — “Creative cost savings without relying on your suppliers”",
      claim: "SIA reports a VMS/MSP delivers operational savings through automation, consolidated invoicing and analytics that flag cost outliers and set reasonable bill rates by role and region — one program refocused two billing specialists after moving to a single consolidated invoice.",
      access: "public",
      url: "https://www.staffingindustry.com/editorial/cws-30-contingent-workforce-strategies/creative-cost-savings-without-relying-on-your-suppliers-"
    },
    "sia-vms-select": {
      name: "Staffing Industry Analysts — “How to select the best VMS for your organization”",
      claim: "SIA notes a VMS replaces ad-hoc, off-contract hiring (“calling your buddy with a staffing agency”) with an official, governed process that manages the contingent workforce transparently and accurately.",
      access: "public",
      url: "https://www.staffingindustry.com/editorial/cws-30-contingent-workforce-strategies/sponsored-how-to-select-the-best-vms-for-your-organization"
    },
    "sia-fraud": {
      name: "Staffing Industry Analysts — “Candidate fraud top of mind for contingent workforce programs”",
      claim: "In SIA’s Workforce Solutions Buyer Survey, 54% of companies reported identity-related fraud in their contingent program — verified worker identity and approved time capture close that gap.",
      access: "public",
      url: "https://www.staffingindustry.com/editorial/cws-30-contingent-workforce-strategies/benchmarks-candidate-fraud-top-of-mind-for-contingent-workforce-programs"
    },
    "sia-vms-strategy": {
      name: "Staffing Industry Analysts — “How to evolve your VMS strategy” (VMS Global Landscape & Differentiators)",
      claim: "Per SIA, fee as a percentage of spend remains the dominant VMS pricing model (about 65% of programs), and VMS adoption among 1,000-plus-employee firms has risen to roughly 79%.",
      access: "public",
      url: "https://www.staffingindustry.com/editorial/cws-30-contingent-workforce-strategies/how-evolve-your-vms-strategy"
    },
    "asa-markup": {
      name: "American Staffing Association — “What goes into your bill rate?”",
      claim: "ASA explains a staffing bill rate is the worker’s pay plus a markup covering taxes, insurance, overhead and agency margin; converting long-tenured temporaries to permanent removes that recurring markup.",
      access: "members",
      url: "https://americanstaffing.net/posts/2020/02/12/when-clients-ask-what-goes-into-your-bill-rate"
    },
    "sia-share": {
      name: "Staffing Industry Analysts — Workforce Solutions Buyer Survey (contingent share of workforce)",
      claim: "SIA buyers report contingent workers make up a median 20% and an average 22% of their total workforce.",
      access: "members",
      url: "https://www.staffingindustry.com/research/research-reports/americas/workforce-solutions-buyer-survey-2025-americas-results"
    },
    "sia-industry-mix": {
      name: "Staffing Industry Analysts — “Benchmarks: Workforce mix by industry”",
      claim: "SIA benchmarks the contingent share of the workforce by industry, defining contingent workers as agency temps, independent contractors and SOW consultants (excluding part-time regular staff).",
      access: "public",
      url: "http://cwstrategies.staffingindustry.com/benchmarks-workforce-mix-by-industry/"
    }
  };
  // Where a source link should point: public → original; members → in-project note.
  function sourceHref(key) {
    var s = SOURCES[key];
    if (!s) return "#";
    return s.access === "members" ? (NOTES_PAGE + "#" + key) : s.url;
  }

  // ---- hard-dollar drivers (% of temp spend) ----------------------
  var HARD = [
    { id: "agencies",   on: true, pct: 2.0, max: 5,
      title: "Rationalize the agency panel",
      desc: "Consolidate overlapping suppliers and route demand to the best-performing, best-priced agencies.",
      src: "sia-cost-savings" },
    { id: "rates",      on: true, pct: 3.0, max: 6,
      title: "Enforce negotiated contract rates",
      desc: "Hold every requisition to the agreed rate card and stop hiring managers from paying off-contract.",
      src: "sia-cost-savings" },
    { id: "timetheft",  on: true, pct: 2.0, max: 5,
      title: "Verify worker identity and approved time",
      desc: "Verified identity and approval workflows recover hours billed but never worked and close the gap on engagement fraud.",
      src: "sia-fraud" },
    { id: "temptoperm", on: true, pct: 2.0, max: 4,
      title: "Convert long-tenured temps to permanent",
      desc: "Surface chronic contractors and convert them, removing the recurring agency markup.",
      src: "asa-markup" },
    { id: "maverick",   on: true, pct: 1.5, max: 4,
      title: "Eliminate maverick, off-contract spend",
      desc: "Bring rogue and unmanaged hiring back under program governance and approved channels.",
      src: "sia-vms-select" },
    { id: "invoice",    on: true, pct: 1.0, max: 3,
      title: "Recover invoice and billing errors",
      desc: "Auto-match approved time to invoices to catch overbilling, double-billing and rate drift.",
      src: "sia-cost-savings" },
    { id: "overtime",   on: true, pct: 0.8, max: 3,
      title: "Curb overtime and assignment-length leakage",
      desc: "Flag overstaffing and assignments running past their planned end date before they bill.",
      src: "sia-cost-savings" }
  ];

  // ---- soft-dollar drivers (admin hours / week recovered) ---------
  var SOFT = [
    { id: "sourcing",   on: true, hrs: 6,  red: 70, title: "Sourcing and vetting agencies",
      desc: "Finding, comparing and onboarding staffing suppliers." },
    { id: "reqs",       on: true, hrs: 8,  red: 65, title: "Distributing requisitions and job orders",
      desc: "Emailing reqs to agencies and chasing candidate submittals." },
    { id: "timesheets", on: true, hrs: 10, red: 80, title: "Collecting and approving timesheets",
      desc: "Gathering hours from agencies and routing approvals." },
    { id: "invoices",   on: true, hrs: 9,  red: 75, title: "Consolidating and reconciling invoices",
      desc: "Matching dozens of agency invoices against worked time." },
    { id: "compliance", on: true, hrs: 5,  red: 60, title: "Compliance, onboarding and audit prep",
      desc: "Tracking credentials, tenure limits and audit-ready records." },
    { id: "reporting",  on: true, hrs: 6,  red: 85, title: "Spend reporting and spreadsheet work",
      desc: "Hand-building spend and headcount reports from disparate data." }
  ];
  var SOFT_SRC = "sia-cost-savings"; // indirect/soft savings anchor

  // ---- industry benchmarks (illustrative planning assumptions) ----
  // ratio   = typical contingent share of total workforce (SIA workforce-mix-by-industry)
  // perWorker = illustrative average fully-loaded annual cost of one contingent
  //             worker, expressed in USD; converted to the selected currency by FX.
  // `frame` = a one-line, industry-specific context note shown in the config bar.
  var INDUSTRIES = [
    { id: "manufacturing", label: "Manufacturing", ratio: 0.22, perWorker: 54080,
      frame: "Manufacturers lean on agency labor to flex production lines and cover shift gaps." },
    { id: "healthcare",    label: "Healthcare",    ratio: 0.15, perWorker: 99840,
      frame: "Healthcare runs high-cost travel and per-diem clinicians where rate control matters most." },
    { id: "hospitality",   label: "Hospitality",   ratio: 0.20, perWorker: 33280,
      frame: "Hospitality staffs to seasonal and event-driven peaks with large temporary pools." },
    { id: "retail",        label: "Retail",        ratio: 0.18, perWorker: 41600,
      frame: "Retail scales headcount sharply for peak trading periods across many stores." },
    { id: "logistics",     label: "Logistics",     ratio: 0.28, perWorker: 49920,
      frame: "Logistics and warehousing carry the highest contingent share, surging for volume peaks." }
  ];

  // ---- countries → one currency each (illustrative FX vs USD) -----
  // Each country maps to exactly one currency. fx converts USD-base
  // benchmarks and the modeled figures into the selected currency.
  var COUNTRIES = [
    { id: "us", label: "United States",  code: "USD", symbol: "$", locale: "en-US", fx: 1.00 },
    { id: "ca", label: "Canada",         code: "CAD", symbol: "$", locale: "en-CA", fx: 1.37 },
    { id: "uk", label: "United Kingdom", code: "GBP", symbol: "\u00a3", locale: "en-GB", fx: 0.79 },
    { id: "ie", label: "Ireland",        code: "EUR", symbol: "\u20ac", locale: "en-IE", fx: 0.92 },
    { id: "de", label: "Germany",        code: "EUR", symbol: "\u20ac", locale: "de-DE", fx: 0.92 },
    { id: "au", label: "Australia",      code: "AUD", symbol: "$", locale: "en-AU", fx: 1.52 },
    { id: "nz", label: "New Zealand",    code: "NZD", symbol: "$", locale: "en-NZ", fx: 1.65 }
  ];

  var PLATFORM_RATE = 0.015; // fixed, not editable
  var PEOPLE_PER_SPEND_USD = 2000000; // spend-based heuristic: ~1 admin per $2M (USD) of contingent spend

  // ---- state ------------------------------------------------------
  // v2: country/currency added + industry taxonomy changed, so prior
  // saved scenarios are retired — the calculator opens on US · Manufacturing.
  var STORE_KEY = "flexwork-sales-roi-calculator-scenario-v2";
  var state = {
    country: "us",
    spend: 10000000,
    blended: 52,
    hard: {}, soft: {},
    industry: "manufacturing", headcount: 5000,
    peopleMode: "spend", locations: 5, peoplePerLoc: 1,
    fundingMode: "buyer", supplierPct: 50,
    client: "Acme Corp (test client)", preparedBy: "",
    sentAt: null,
    sentLink: ""
  };
  HARD.forEach(function (d) { state.hard[d.id] = { on: d.on, pct: d.pct }; });
  SOFT.forEach(function (d) { state.soft[d.id] = { on: d.on, hrs: d.hrs, red: d.red }; });

  // ---- helpers ----------------------------------------------------
  var $ = function (s, r) { return (r || document).querySelector(s); };

  // ---- currency (driven by the selected country) ------------------
  function country() {
    var id = state.country;
    for (var i = 0; i < COUNTRIES.length; i++) if (COUNTRIES[i].id === id) return COUNTRIES[i];
    return COUNTRIES[0];
  }
  function fx() { return country().fx || 1; }
  // a USD-base benchmark amount expressed in the selected currency
  function local(usd) { return (usd || 0) * fx(); }
  function peopleSpendThreshold() { return PEOPLE_PER_SPEND_USD * fx(); }

  function money(n, dec) {
    if (!isFinite(n)) n = 0;
    var c = country();
    try {
      return new Intl.NumberFormat(c.locale, {
        style: "currency", currency: c.code,
        minimumFractionDigits: dec || 0, maximumFractionDigits: dec || 0
      }).format(Number(n));
    } catch (e) {
      return c.symbol + Number(n).toLocaleString("en-US", { maximumFractionDigits: dec || 0, minimumFractionDigits: dec || 0 });
    }
  }
  // compact form keeps the marketing display tidy and consistent across
  // currencies (symbol-prefixed M / K), regardless of locale conventions.
  function moneyCompact(n) {
    if (!isFinite(n)) n = 0;
    var c = country(), a = Math.abs(n);
    if (a >= 1e6) return c.symbol + (n / 1e6).toFixed(a >= 1e7 ? 1 : 2).replace(/\.0+$/, "") + "M";
    if (a >= 1e3) return c.symbol + Math.round(n / 1e3) + "K";
    return money(n);
  }
  // local-formatted plain integer (no currency symbol) for editable inputs
  function groupNum(n) {
    try { return Number(n || 0).toLocaleString(country().locale); }
    catch (e) { return Number(n || 0).toLocaleString("en-US"); }
  }
  // refresh the static currency-symbol chrome on the money inputs
  function updateCurrencyChrome() {
    var sym = country().symbol;
    document.querySelectorAll(".roi-money-sym").forEach(function (el) { el.textContent = sym; });
  }
  var ICON_LINK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="square"><path d="M10 14a5 5 0 0 0 7 0l2-2a5 5 0 0 0-7-7l-1 1"/><path d="M14 10a5 5 0 0 0-7 0l-2 2a5 5 0 0 0 7 7l1-1"/></svg>';
  var ICON_INFO = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="square"><circle cx="12" cy="12" r="9"/><path d="M12 11v5"/><path d="M12 7.6v.4"/></svg>';

  // ---- in-product proof (real screenshots of Flex Work) -----------
  // Each saving maps to the surface that earns it. `shot` is a real
  // capture of index.html (the V2 app); `how` explains the mechanism;
  // `src` reuses the SOURCES citation (soft drivers fall back to the
  // shared soft-savings anchor).
  var PROOF = {
    // hard
    agencies:  { shot: "suppliers.png",   src: "sia-cost-savings",
      how: "Every staffing supplier sits in one ranked Suppliers list — tier, fill rate and time-to-fill side by side. You route demand to the top performers and retire the long tail of overlapping, underused agencies." },
    rates:     { shot: "rate-cards.png",  src: "sia-cost-savings",
      how: "Negotiated rates live in a governed rate card for each position, with override lines for the conditions that pay differently. Every requisition resolves its bill rate from the card, so a manager can't quietly pay off-contract." },
    timetheft: { shot: "timesheets.png",  src: "sia-fraud",
      how: "Workers are tied to a verified identity, and every timesheet routes through approval before it can be invoiced. Hours billed but never worked are caught in Review, not after payment." },
    temptoperm:{ shot: "workforce.png",   src: "asa-markup",
      how: "The Workforce list keeps each contingent worker's tenure and assignment history in view, so chronic long-tenured temps — cheaper to convert than to keep renewing at agency markup — surface on their own." },
    maverick:  { shot: "reqs.png",        src: "sia-vms-select",
      how: "All contingent demand flows through one requisition intake with approval routing. Rogue, off-platform hiring has nowhere to land, so spend stays inside the program and on negotiated terms." },
    invoice:   { shot: "invoices.png",    src: "sia-cost-savings",
      how: "Approved time auto-matches to each agency invoice. Rate drift, double-billing and overbilling are flagged on the Invoices list before anything is marked paid." },
    overtime:  { shot: "schedule.png",    src: "sia-cost-savings",
      how: "The schedule shows coverage and every assignment's end date at a glance, flagging overstaffing and assignments running past their planned end before those hours ever bill." },
    // soft
    sourcing:  { shot: "suppliers.png",   src: "sia-cost-savings",
      how: "Supplier discovery, scorecards and onboarding live on one Suppliers surface instead of email threads and spreadsheets — so the hours spent vetting agencies collapse." },
    reqs:      { shot: "reqs.png",        src: "sia-cost-savings",
      how: "Requisitions broadcast to the right suppliers automatically and submittals return into a single pipeline, replacing the manual emailing and chasing of job orders." },
    timesheets:{ shot: "timesheets.png",  src: "sia-cost-savings",
      how: "Hours collect and route for approval automatically across every supplier — no one has to chase agencies for time or re-key it." },
    invoices:  { shot: "invoices.png",    src: "sia-cost-savings",
      how: "Dozens of agency invoices consolidate and reconcile against worked time in one place, so the manual matching work all but disappears." },
    compliance:{ shot: "workforce.png",   src: "sia-cost-savings",
      how: "Credentials, tenure limits and audit-ready records track themselves on each worker record, cutting the manual prep that audits and onboarding used to demand." },
    reporting: { shot: "analytics.png",   src: "sia-cost-savings",
      how: "Spend, headcount and supplier-performance reporting is live in Analytics — the hand-built spreadsheets that ate hours each week are no longer needed." }
  };
  function infoBtn(id) {
    if (!PROOF[id]) return "";
    return '<button class="roi-info" type="button" data-proof="' + id +
      '" aria-label="See how this works in Dayforce Flex Work">' + ICON_INFO +
      '<span>How it works</span></button>';
  }

  // ---- persistence ------------------------------------------------
  function saveLocal() { try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) {} }
  function loadLocal() {
    try { var s = JSON.parse(localStorage.getItem(STORE_KEY)); if (s) mergeState(s); } catch (e) {}
  }
  function mergeState(s) {
    ["country", "spend", "blended", "industry", "headcount", "peopleMode", "locations", "peoplePerLoc", "fundingMode", "supplierPct", "client", "preparedBy", "sentAt", "sentLink"].forEach(function (k) {
      if (s[k] !== undefined && s[k] !== null) state[k] = s[k];
    });
    if (s.hard) HARD.forEach(function (d) { if (s.hard[d.id]) state.hard[d.id] = s.hard[d.id]; });
    if (s.soft) SOFT.forEach(function (d) { if (s.soft[d.id]) state.soft[d.id] = s.soft[d.id]; });
  }
  function encodeShare() {
    try { return btoa(encodeURIComponent(JSON.stringify(state))); } catch (e) { return ""; }
  }
  function buildShareUrl() {
    return location.origin + location.pathname + "#s=" + encodeShare();
  }
  function copyToClipboard(text, onDone) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(onDone, function () { prompt("Copy this link:", text); });
    } else { prompt("Copy this link:", text); }
  }
  function loadFromHash() {
    if (!location.hash || location.hash.length < 4) return false;
    try {
      var raw = decodeURIComponent(atob(location.hash.replace(/^#s=/, "")));
      mergeState(JSON.parse(raw));
      return true;
    } catch (e) { return false; }
  }

  // ---- compute ----------------------------------------------------
  function peopleCount() {
    if (state.peopleMode === "footprint") {
      return Math.max(1, Math.round((state.locations || 0) * (state.peoplePerLoc || 0)));
    }
    return Math.max(1, Math.round((state.spend || 0) / peopleSpendThreshold()));
  }
  // supplier-funded fraction of the platform fee (0..1)
  function fundingShare() {
    if (state.fundingMode === "buyer") return 0;
    if (state.fundingMode === "supplier") return 1;
    return Math.min(1, Math.max(0, (state.supplierPct || 0) / 100));
  }
  function compute() {
    var T = state.spend || 0;
    var hardPct = 0, hard$ = 0;
    HARD.forEach(function (d) {
      var st = state.hard[d.id];
      if (st.on) { hardPct += st.pct; hard$ += T * st.pct / 100; }
    });
    var soft$ = 0;
    var ppl = peopleCount();
    SOFT.forEach(function (d) {
      var st = state.soft[d.id];
      if (st.on) soft$ += st.hrs * 52 * state.blended * (st.red / 100) * ppl;
    });
    var platform = T * PLATFORM_RATE;          // full program fee
    var share = fundingShare();                // supplier-funded fraction
    var supplierCost = platform * share;
    var buyerCost = platform - supplierCost;   // what the company actually pays
    var gross = hard$ + soft$;
    var net = gross - buyerCost;
    return {
      T: T, hardPct: hardPct, hard: hard$, soft: soft$, gross: gross, people: ppl,
      platform: platform, supplierCost: supplierCost, buyerCost: buyerCost, supplierShare: share,
      net: net,
      multiple: buyerCost > 0 ? gross / buyerCost : null,
      savingsPct: T > 0 ? gross / T * 100 : 0,
      paybackMonths: (gross > 0 && buyerCost > 0) ? buyerCost / gross * 12 : 0,
      daily: net / 365
    };
  }

  // ---- build driver rows ------------------------------------------
  // Inline citations link to the cited finding in a new tab: public sources
  // open the published article directly; members-only sources open the
  // in-project Sources notes page, which reproduces the finding for everyone
  // and links onward to the original.
  function sourceLink(srcKey) {
    var s = SOURCES[srcKey];
    if (!s) return "";
    var label = s.name.split(" — ")[0];
    return '<a class="roi-source" href="' + sourceHref(srcKey) + '" target="_blank" rel="noopener" title="' +
      s.claim.replace(/"/g, "&quot;") + '">' + ICON_LINK + 'Source: <b>' + label + '</b></a>';
  }

  function buildHard() {
    var wrap = $("#hardList");
    wrap.innerHTML = "";
    HARD.forEach(function (d) {
      var st = state.hard[d.id];
      var row = document.createElement("div");
      row.className = "roi-driver" + (st.on ? "" : " is-off");
      row.dataset.id = d.id;
      row.innerHTML =
        '<label class="roi-switch"><input type="checkbox" data-hard-on ' + (st.on ? "checked" : "") +
          ' aria-label="Include ' + d.title + '"><span class="track"></span><span class="thumb"></span></label>' +
        '<div class="roi-driver-main">' +
          '<p class="roi-driver-title">' + d.title + '</p>' +
          '<p class="roi-driver-desc">' + d.desc + '</p>' +
          '<div class="roi-driver-foot">' + sourceLink(d.src) + infoBtn(d.id) + '</div>' +
        '</div>' +
        '<div class="roi-slider-wrap">' +
          '<div class="roi-slider-row">' +
            '<span class="lab">Savings</span>' +
            '<input type="range" class="roi-range" data-hard-pct min="0" max="' + d.max + '" step="0.1" value="' + st.pct + '">' +
            '<span class="roi-range-val" data-hard-pctval>' + st.pct.toFixed(1) + '%</span>' +
          '</div>' +
        '</div>' +
        '<div class="roi-driver-amt" data-hard-amt>$0<span class="sub">per year</span></div>';
      wrap.appendChild(row);

      row.querySelector("[data-hard-on]").addEventListener("change", function (e) {
        st.on = e.target.checked; row.classList.toggle("is-off", !st.on); render();
      });
      var rng = row.querySelector("[data-hard-pct]");
      rng.addEventListener("input", function (e) {
        st.pct = parseFloat(e.target.value);
        row.querySelector("[data-hard-pctval]").textContent = st.pct.toFixed(1) + "%";
        render();
      });
    });
  }

  function buildSoft() {
    var wrap = $("#softList");
    wrap.innerHTML = "";
    SOFT.forEach(function (d) {
      var st = state.soft[d.id];
      var row = document.createElement("div");
      row.className = "roi-driver" + (st.on ? "" : " is-off");
      row.dataset.id = d.id;
      row.innerHTML =
        '<label class="roi-switch"><input type="checkbox" data-soft-on ' + (st.on ? "checked" : "") +
          ' aria-label="Include ' + d.title + '"><span class="track"></span><span class="thumb"></span></label>' +
        '<div class="roi-driver-main">' +
          '<p class="roi-driver-title">' + d.title + '</p>' +
          '<p class="roi-driver-desc">' + d.desc + '</p>' +
          '<div class="roi-driver-foot">' + infoBtn(d.id) + '</div>' +
        '</div>' +
        '<div class="roi-slider-wrap">' +
          '<div class="roi-slider-row">' +
            '<span class="lab">Hrs/wk</span>' +
            '<input type="range" class="roi-range" data-soft-hrs min="0" max="40" step="1" value="' + st.hrs + '">' +
            '<span class="roi-range-val" data-soft-hrsval>' + st.hrs + '</span>' +
          '</div>' +
        '</div>' +
        '<div class="roi-slider-wrap">' +
          '<div class="roi-slider-row">' +
            '<span class="lab">Reduced</span>' +
            '<input type="range" class="roi-range" data-soft-red min="0" max="100" step="5" value="' + st.red + '">' +
            '<span class="roi-range-val" data-soft-redval>' + st.red + '%</span>' +
          '</div>' +
        '</div>' +
        '<div class="roi-driver-amt" data-soft-amt>$0<span class="sub">per year</span></div>';
      wrap.appendChild(row);

      row.querySelector("[data-soft-on]").addEventListener("change", function (e) {
        st.on = e.target.checked; row.classList.toggle("is-off", !st.on); render();
      });
      row.querySelector("[data-soft-hrs]").addEventListener("input", function (e) {
        st.hrs = parseInt(e.target.value, 10);
        row.querySelector("[data-soft-hrsval]").textContent = st.hrs; render();
      });
      row.querySelector("[data-soft-red]").addEventListener("input", function (e) {
        st.red = parseInt(e.target.value, 10);
        row.querySelector("[data-soft-redval]").textContent = st.red + "%"; render();
      });
    });
  }

  // ---- render -----------------------------------------------------
  function render() {
    var r = compute();
    var T = r.T;

    // hero
    $("#heroNet").textContent = moneyCompact(r.net);
    $("#heroMultiple").textContent = r.multiple == null ? "—" : r.multiple.toFixed(1) + "×";
    $("#heroPct").textContent = r.savingsPct.toFixed(1) + "%";
    $("#heroSpendNote").textContent = "Based on " + moneyCompact(T) + " in annual contingent labor spend";

    // hard rows
    $("#hardList").querySelectorAll(".roi-driver").forEach(function (row) {
      var d = row.dataset.id, st = state.hard[d];
      row.querySelector("[data-hard-amt]").innerHTML =
        money(st.on ? T * st.pct / 100 : 0) + '<span class="sub">per year</span>';
    });
    $("#hardTotal").textContent = money(r.hard);

    // soft rows
    $("#softList").querySelectorAll(".roi-driver").forEach(function (row) {
      var d = row.dataset.id, st = state.soft[d];
      row.querySelector("[data-soft-amt]").innerHTML =
        money(st.on ? st.hrs * 52 * state.blended * (st.red / 100) * r.people : 0) + '<span class="sub">per year</span>';
    });
    $("#softTotal").textContent = money(r.soft);
    renderPeople();

    // platform (shows the BUYER's cost — what nets against savings)
    $("#platformAmt").textContent = money(r.buyerCost);
    renderFunding(r);

    // results
    var effPct = r.T > 0 ? r.buyerCost / r.T * 100 : 0;
    var netSub, platSub;
    if (state.fundingMode === "supplier") {
      netSub = "platform fully supplier-funded";
      platSub = "supplier-funded · $0 to you";
    } else if (state.fundingMode === "mixed") {
      netSub = "after your share of the fee";
      platSub = effPct.toFixed(2).replace(/\.?0+$/, "") + "% of spend · your share";
    } else {
      netSub = "after the 1.5% platform fee";
      platSub = "1.5% of spend";
    }
    $("#resGross").textContent = money(r.gross);
    $("#resGrossSub").textContent = r.savingsPct.toFixed(1) + "% of spend";
    $("#resPlatform").textContent = money(r.buyerCost);
    $("#resPlatformSub").textContent = platSub;
    $("#resNet").textContent = money(r.net);
    $("#resNetSub").textContent = netSub;
    $("#resMultiple").textContent = r.multiple == null ? "—" : r.multiple.toFixed(1) + "×";
    $("#resPayback").textContent = r.buyerCost <= 0
      ? "None"
      : (r.paybackMonths < 1 ? "< 1 mo" : r.paybackMonths.toFixed(1) + " mo");

    // breakdown bar (platform segment = the buyer's cost)
    var denom = r.gross + r.buyerCost || 1;
    setSeg("#barHard", r.hard / denom, "Hard");
    setSeg("#barSoft", r.soft / denom, "Soft");
    setSeg("#barPlatform", r.buyerCost / denom, "Platform");
    $("#legHard").textContent = money(r.hard);
    $("#legSoft").textContent = money(r.soft);
    $("#legPlatform").textContent = money(r.buyerCost);

    // value at stake
    $("#stakeNet").textContent = money(r.net);
    $("#stakeDaily").textContent = money(Math.max(0, r.daily));

    // accrual + summary refresh
    renderSent();
    saveLocal();
  }
  function setSeg(sel, frac, label) {
    var el = $(sel);
    var pct = Math.max(0, frac) * 100;
    el.style.flexBasis = pct + "%";
    el.style.display = pct < 0.5 ? "none" : "flex";
    el.textContent = pct > 8 ? label : "";
  }

  // ---- sent / accrual ---------------------------------------------
  var accrualTimer = null;
  function renderSent() {
    var box = $("#sentBox");
    var sendCard = $("#sendCard");
    var grid = $("#shareGrid");
    if (!state.sentAt) {
      box.hidden = true;
      if (sendCard) sendCard.hidden = false;
      if (grid) grid.classList.remove("is-sent");
      if (accrualTimer) clearInterval(accrualTimer);
      return;
    }
    box.hidden = false;
    // a link has been sent — retire the send UI so it isn't offered again
    if (sendCard) sendCard.hidden = true;
    if (grid) grid.classList.add("is-sent");
    var r = compute();
    var sent = new Date(state.sentAt);
    var dateStr = sent.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
    var who = state.client ? ("<b>" + escapeHtml(state.client) + "</b>") : "the client";
    $("#sentLine").innerHTML = "Prepared for " + who + " &middot; saved <b>" + dateStr + "</b>. " +
      "The shareable link is ready below. Since then, here's the cost of waiting — the net return left on the table by not moving yet:";
    var linkRow = $("#sentLinkRow");
    if (linkRow) {
      var link = state.sentLink || buildShareUrl();
      $("#sentLinkInput").value = link;
    }
    var perDay = Math.max(0, r.net / 365);
    function tick() {
      var elapsedDays = (Date.now() - state.sentAt) / 86400000;
      var accrued = perDay * elapsedDays;
      $("#accruedVal").textContent = money(accrued);
      $("#accruedSub").textContent = "≈ " + money(perDay) + " per day · " + Math.floor(elapsedDays) + " days since sent";
    }
    tick();
    if (accrualTimer) clearInterval(accrualTimer);
    accrualTimer = setInterval(tick, 1000 * 30);
  }
  function escapeHtml(s) { return String(s).replace(/[&<>"]/g, function (c) { return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]; }); }

  // ---- estimate tab ----------------------------------------------
  function renderEstimate() {
    var ind = INDUSTRIES.filter(function (i) { return i.id === state.industry; })[0] || INDUSTRIES[0];
    var hc = state.headcount || 0;
    var workers = Math.round(hc * ind.ratio);
    var perWorker = local(ind.perWorker);
    var est = Math.round(workers * perWorker);
    var chip = $("#estIndustryChip"); if (chip) chip.textContent = ind.label;
    $("#estMath").innerHTML =
      "Estimate: <b>" + hc.toLocaleString() + "</b> employees × <b>" + Math.round(ind.ratio * 100) +
      "%</b> typical contingent share in <b>" + ind.label + "</b> ≈ <b>" + workers.toLocaleString() +
      "</b> contingent workers × " + money(perWorker) + " average annual cost.";
    $("#estResult").textContent = money(est) + " estimated annual spend";
    $("#applyEstimate").dataset.value = est;
  }

  // ---- client-context bar (country + industry) --------------------
  function renderContext() {
    var c = country();
    var ind = INDUSTRIES.filter(function (i) { return i.id === state.industry; })[0] || INDUSTRIES[0];
    var note = $("#contextNote");
    if (note) {
      note.innerHTML = "Figures in <b>" + c.label + " " + c.code + " (" + c.symbol + ")</b>. " + ind.frame;
    }
    var cs = $("#ctxCountry"); if (cs && cs.value !== state.country) cs.value = state.country;
    var is = $("#ctxIndustry"); if (is && is.value !== state.industry) is.value = state.industry;
  }

  // switching country converts the modeled money figures by FX so the
  // magnitudes stay sensible in the newly selected currency.
  function applyCountry(newId) {
    var target = COUNTRIES.filter(function (c) { return c.id === newId; })[0];
    if (!target) return;
    var ratio = target.fx / fx();
    state.spend = Math.round((state.spend || 0) * ratio);
    state.blended = Math.max(1, Math.round((state.blended || 0) * ratio));
    state.country = newId;
    updateCurrencyChrome();
    renderSpend();
    var br = $("#blendedRate"); if (br) br.value = groupNum(state.blended);
    renderEstimate();
    renderContext();
    render();
    saveLocal();
  }

  // ---- spend display ----------------------------------------------
  function renderSpend() {
    $("#spendDisplay").textContent = money(state.spend);
    $("#spendKnownInput").value = state.spend ? groupNum(state.spend) : "";
  }

  // ---- people / team-size control ---------------------------------
  function renderPeople() {
    var ppl = peopleCount();
    var c = $("#peopleCount"); if (c) c.textContent = ppl.toLocaleString();
    document.querySelectorAll("[data-people-mode]").forEach(function (b) {
      b.classList.toggle("is-active", b.dataset.peopleMode === state.peopleMode);
    });
    var foot = $("#peopleFootprint");
    var math = $("#peopleMath");
    if (state.peopleMode === "footprint") {
      if (foot) foot.hidden = false;
      if (math) math.textContent = (state.locations || 0).toLocaleString() + " locations \u00d7 " +
        (state.peoplePerLoc || 0) + " " + ((state.peoplePerLoc === 1) ? "person" : "people") + " each";
    } else {
      if (foot) foot.hidden = true;
      if (math) math.textContent = "\u2248 1 person per " + moneyCompact(peopleSpendThreshold()) + " of contingent spend";
    }
  }

  // ---- funding model control --------------------------------------
  function renderFunding(r) {
    document.querySelectorAll("[data-funding]").forEach(function (b) {
      b.classList.toggle("is-active", b.dataset.funding === state.fundingMode);
    });
    var mix = $("#fundingMix"); if (mix) mix.hidden = state.fundingMode !== "mixed";
    var sv = $("#supplierShareVal"); if (sv) sv.textContent = Math.round(r.supplierShare * 100) + "%";
    var desc = $("#fundingDesc");
    if (desc) {
      if (state.fundingMode === "supplier") desc.textContent = "Suppliers fund the full platform fee, so it costs your business nothing — every dollar of savings drops to the bottom line.";
      else if (state.fundingMode === "mixed") desc.textContent = "Suppliers subsidize part of the fee. Set the share they fund below; your business covers the rest.";
      else desc.textContent = "Your business funds the platform fee in full — the standard model.";
    }
    var lbl = $("#platformAmtLabel");
    if (lbl) lbl.textContent = r.buyerCost > 0 ? "your platform cost · per year" : "your platform cost · fully supplier-funded";
    var stats = $("#fundingStats");
    if (stats) {
      var rows =
        '<div class="fs-row"><span>Full program fee</span><b>' + money(r.platform) + '</b><span class="fs-sub">1.5% of spend</span></div>' +
        '<div class="fs-row"><span>Suppliers fund</span><b>' + money(r.supplierCost) + '</b><span class="fs-sub">' + Math.round(r.supplierShare * 100) + '% of the fee</span></div>';
      if (state.fundingMode !== "buyer") {
        var fmtPct = function (n) { return (Math.round(n * 100) / 100) + "%"; };
        var feeFull = PLATFORM_RATE * 100;          // 1.5% — fully subsidizes the fee
        var feeNow = feeFull * r.supplierShare;     // current fee on supplier billings
        rows += '<div class="fs-row fs-row--div"><span>Supplier fee to fully subsidize</span><b>' + fmtPct(feeFull) + '</b><span class="fs-sub">of each supplier&rsquo;s billings</span></div>';
        if (state.fundingMode === "mixed") {
          rows += '<div class="fs-row"><span>Their fee at this split</span><b>' + fmtPct(feeNow) + '</b><span class="fs-sub">of billings</span></div>';
        }
      }
      stats.innerHTML = rows;
    }
  }

  // ---- summary overlay --------------------------------------------
  function openSummary() {
    var r = compute();
    var ind = INDUSTRIES.filter(function (i) { return i.id === state.industry; })[0];
    $("#sumClient").textContent = state.client ? state.client : "Prospective client";
    $("#sumMeta").textContent =
      (state.preparedBy ? "Prepared by " + state.preparedBy + " · " : "") +
      (ind ? ind.label + " · " : "") + country().label + " (" + country().code + ") · " +
      new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
    $("#sumNet").textContent = money(r.net);
    $("#sumSpend").textContent = money(r.T);
    $("#sumHard").textContent = money(r.hard);
    $("#sumSoft").textContent = money(r.soft);
    $("#sumGross").textContent = money(r.gross);
    $("#sumPlatform").textContent = money(r.buyerCost);
    $("#sumPlatformLabel").textContent = state.fundingMode === "supplier"
      ? "Platform investment (supplier-funded)"
      : state.fundingMode === "mixed"
        ? "Platform investment (subsidized)"
        : "Platform investment (1.5%)";
    $("#sumNetRow").textContent = money(r.net);
    $("#sumMultiple").textContent = (r.multiple == null ? "No platform cost" : r.multiple.toFixed(1) + "× return");
    $("#sumPct").textContent = r.savingsPct.toFixed(1) + "% of contingent spend";

    // hard breakdown lines
    var lines = "";
    HARD.forEach(function (d) {
      var st = state.hard[d.id];
      if (!st.on) return;
      lines += '<div class="roi-summary-row"><span class="k">' + d.title +
        ' <span style="color:var(--evr-content-primary-lowemp)">(' + st.pct.toFixed(1) + '%)</span></span>' +
        '<span class="val">' + money(r.T * st.pct / 100) + '</span></div>';
    });
    $("#sumHardLines").innerHTML = lines;

    var soft = "";
    SOFT.forEach(function (d) {
      var st = state.soft[d.id];
      if (!st.on) return;
      soft += '<div class="roi-summary-row"><span class="k">' + d.title + '</span>' +
        '<span class="val">' + money(st.hrs * 52 * state.blended * (st.red / 100) * r.people) + '</span></div>';
    });
    soft = '<div class="roi-summary-row"><span class="k" style="color:var(--evr-content-primary-lowemp)">Across ' +
      r.people + (r.people === 1 ? " person" : " people") + ' doing this work</span><span class="val"></span></div>' + soft;
    $("#sumSoftLines").innerHTML = soft;

    // stake line in summary
    if (state.sentAt) {
      var perDay = Math.max(0, r.net / 365);
      var days = Math.floor((Date.now() - state.sentAt) / 86400000);
      $("#sumStake").innerHTML = "Saved " + new Date(state.sentAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) +
        ". Every day the decision waits leaves about <b>" + money(perDay) + "</b> in net value on the table — roughly <b>" +
        money(perDay * days) + "</b> across the " + days + " days since.";
    } else {
      var pd = Math.max(0, r.net / 365);
      $("#sumStake").innerHTML = "At this net return, every day without Dayforce Flex Work leaves about <b>" +
        money(pd) + "</b> on the table — roughly <b>" + money(pd * 30) + "</b> a month.";
    }
    $("#summaryOverlay").classList.add("is-open");
    document.body.style.overflow = "hidden";
  }
  function closeSummary() { $("#summaryOverlay").classList.remove("is-open"); document.body.style.overflow = ""; }

  // ---- proof overlay (how the saving is earned in-product) --------
  var DRIVER_TITLE = {};
  HARD.forEach(function (d) { DRIVER_TITLE[d.id] = d.title; });
  SOFT.forEach(function (d) { DRIVER_TITLE[d.id] = d.title; });

  function openProof(id) {
    var p = PROOF[id];
    if (!p) return;
    $("#proofTitle").textContent = DRIVER_TITLE[id] || "How this saving is earned";
    $("#proofDesc").textContent = p.how;
    var img = $("#proofImg");
    img.src = "product-shots/" + p.shot;
    img.alt = (DRIVER_TITLE[id] || "Dayforce Flex Work") + " — Dayforce Flex Work screen";
    $("#proofCap").textContent = "Live screen from Dayforce Flex Work";
    var srcEl = $("#proofSource");
    var s = SOURCES[p.src];
    if (s) {
      srcEl.hidden = false;
      srcEl.href = sourceHref(p.src);
      srcEl.innerHTML = ICON_LINK + "Where the savings come from — <b>" + s.name.split(" — ")[0] + "</b>";
    } else {
      srcEl.hidden = true;
    }
    var ov = $("#proofOverlay");
    ov.hidden = false;
    // force reflow so the open transition plays
    ov.offsetHeight;
    ov.classList.add("is-open");
    document.body.style.overflow = "hidden";
  }
  function closeProof() {
    var ov = $("#proofOverlay");
    ov.classList.remove("is-open");
    document.body.style.overflow = "";
    setTimeout(function () { ov.hidden = true; }, 200);
  }

  // ---- toast ------------------------------------------------------
  var toastTimer = null;
  function toast(msg) {
    var t = $("#roiToast"); t.textContent = msg; t.classList.add("is-show");
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove("is-show"); }, 2600);
  }

  // ---- wiring -----------------------------------------------------
  function wire() {
    // spend tabs
    document.querySelectorAll("[data-spend-tab]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var tab = btn.dataset.spendTab;
        document.querySelectorAll("[data-spend-tab]").forEach(function (b) { b.classList.toggle("is-active", b === btn); });
        $("#panelKnown").classList.toggle("is-active", tab === "known");
        $("#panelEstimate").classList.toggle("is-active", tab === "estimate");
      });
    });

    // known spend input
    var si = $("#spendKnownInput");
    si.addEventListener("input", function (e) {
      var v = parseInt((e.target.value || "").replace(/[^0-9]/g, ""), 10) || 0;
      state.spend = v;
      $("#spendDisplay").textContent = money(v);
      render();
    });
    si.addEventListener("blur", function () { renderSpend(); });

    // client-context bar — country (sets currency) + industry
    var ctxC = $("#ctxCountry");
    COUNTRIES.forEach(function (c) {
      var o = document.createElement("option"); o.value = c.id;
      o.textContent = c.label + " \u00b7 " + c.code; ctxC.appendChild(o);
    });
    ctxC.value = state.country;
    ctxC.addEventListener("change", function (e) { applyCountry(e.target.value); });

    var ctxI = $("#ctxIndustry");
    INDUSTRIES.forEach(function (i) {
      var o = document.createElement("option"); o.value = i.id; o.textContent = i.label; ctxI.appendChild(o);
    });
    ctxI.value = state.industry;
    ctxI.addEventListener("change", function (e) {
      state.industry = e.target.value; renderEstimate(); renderContext(); saveLocal();
    });

    // estimate headcount
    var hcIn = $("#estHeadcount");
    hcIn.value = state.headcount;
    hcIn.addEventListener("input", function (e) {
      state.headcount = parseInt((e.target.value || "").replace(/[^0-9]/g, ""), 10) || 0; renderEstimate(); saveLocal();
    });
    $("#applyEstimate").addEventListener("click", function () {
      var v = parseInt(this.dataset.value, 10) || 0;
      state.spend = v; renderSpend(); render();
      document.querySelector('[data-spend-tab="known"]').click();
      toast("Applied estimated spend of " + money(v));
    });

    // blended rate
    var br = $("#blendedRate");
    br.value = groupNum(state.blended);
    br.addEventListener("input", function (e) {
      state.blended = parseInt((e.target.value || "").replace(/[^0-9]/g, ""), 10) || 0; render();
    });
    br.addEventListener("blur", function () { br.value = groupNum(state.blended); });

    // team-size (people doing the work) controls
    document.querySelectorAll("[data-people-mode]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        state.peopleMode = btn.dataset.peopleMode;
        render(); saveLocal();
      });
    });
    var lc = $("#locCount"); lc.value = state.locations;
    lc.addEventListener("input", function (e) {
      state.locations = parseInt((e.target.value || "").replace(/[^0-9]/g, ""), 10) || 0; render();
    });
    lc.addEventListener("blur", function () { lc.value = state.locations; saveLocal(); });
    var ppl = $("#peoplePerLoc"); ppl.value = state.peoplePerLoc;
    ppl.addEventListener("input", function (e) {
      state.peoplePerLoc = parseInt((e.target.value || "").replace(/[^0-9]/g, ""), 10) || 0; render();
    });
    ppl.addEventListener("blur", function () { ppl.value = state.peoplePerLoc; saveLocal(); });

    // funding model controls (Step 4)
    document.querySelectorAll("[data-funding]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        state.fundingMode = btn.dataset.funding;
        render(); saveLocal();
      });
    });
    var ss = $("#supplierShare"); ss.value = state.supplierPct;
    ss.addEventListener("input", function (e) {
      state.supplierPct = parseInt(e.target.value, 10) || 0;
      $("#supplierShareVal").textContent = state.supplierPct + "%";
      render();
    });

    // share fields
    var cn = $("#clientName"); cn.value = state.client;
    cn.addEventListener("input", function (e) { state.client = e.target.value; saveLocal(); renderSent(); });
    var pb = $("#preparedBy"); pb.value = state.preparedBy;
    pb.addEventListener("input", function (e) { state.preparedBy = e.target.value; saveLocal(); });

    // save & send — records the timestamp and prepares a shareable link
    $("#sendBtn").addEventListener("click", function () {
      state.sentAt = Date.now();
      state.sentLink = buildShareUrl();
      render();
      copyToClipboard(state.sentLink, function () {});
      toast("Saved · link copied, ready to send to " + (state.client || "client"));
    });
    $("#resetSent").addEventListener("click", function () { state.sentAt = null; state.sentLink = ""; render(); toast("Saved send cleared"); });

    // copy the prepared link again from the sent box
    document.addEventListener("click", function (e) {
      var b = e.target.closest && e.target.closest("#copySentLink");
      if (!b) return;
      copyToClipboard(state.sentLink || buildShareUrl(), function () {});
      toast("Link copied to clipboard");
    });

    // copy link
    $("#copyLinkBtn").addEventListener("click", function () {
      copyToClipboard(buildShareUrl(), function () { toast("Shareable link copied to clipboard"); });
    });

    // summary + print
    $("#summaryBtn").addEventListener("click", openSummary);
    $("#summaryBtnHero").addEventListener("click", openSummary);
    $("#summaryClose").addEventListener("click", closeSummary);
    $("#summaryOverlay").addEventListener("click", function (e) { if (e.target === this) closeSummary(); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") closeSummary(); });
    $("#printBtn").addEventListener("click", function () { window.print(); });
    $("#sumPrint").addEventListener("click", function () { window.print(); });

    // sent-box actions (shown after a link has been sent)
    $("#sentViewSummary").addEventListener("click", openSummary);
    $("#sentPrint").addEventListener("click", function () { window.print(); });

    // proof overlay — "How it works" on every saving driver
    document.addEventListener("click", function (e) {
      var btn = e.target.closest && e.target.closest("[data-proof]");
      if (btn) { openProof(btn.getAttribute("data-proof")); return; }
      if (e.target.closest && e.target.closest("[data-proof-close]")) { closeProof(); }
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && !$("#proofOverlay").hidden) closeProof();
    });
  }

  // ---- sources section --------------------------------------------
  function buildSources() {
    var ul = $("#sourcesList");
    Object.keys(SOURCES).forEach(function (k) {
      var s = SOURCES[k];
      var li = document.createElement("li");
      li.id = "src-" + k;
      var links, badge;
      if (s.access === "members") {
        badge = '<span class="src-access src-access--members">Members only · finding reproduced in project</span>';
        links =
          '<a class="src-link" href="' + NOTES_PAGE + '#' + k + '" target="_blank" rel="noopener">Read the cited finding</a>' +
          '<a class="src-link src-link--ext" href="' + s.url + '" target="_blank" rel="noopener">Original (SIA/ASA members) ↗</a>';
      } else {
        badge = '<span class="src-access src-access--public">Publicly available</span>';
        links = '<a class="src-link src-link--ext" href="' + s.url + '" target="_blank" rel="noopener">' + s.url + ' ↗</a>';
      }
      li.innerHTML = '<div class="src-name">' + s.name + '</div>' +
        '<div class="src-claim">' + s.claim + '</div>' +
        badge +
        '<div class="src-links">' + links + '</div>';
      ul.appendChild(li);
    });
  }

  // ---- boot -------------------------------------------------------
  function init() {
    if (!loadFromHash()) loadLocal();
    buildHard(); buildSoft(); buildSources(); wire();
    updateCurrencyChrome();
    renderSpend(); renderEstimate(); renderContext(); render();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
