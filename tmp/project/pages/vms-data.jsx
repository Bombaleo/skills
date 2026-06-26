// =====================================================================
// Flex Work — VMS data layer
// Augments SUPPLIERS with scorecard fields (tier, fill rate, time-to-fill,
// no-show rate, quality score, trends) and DERIVES approvals, compliance
// flags, at-risk shifts, and spend buckets from the live REQUISITIONS /
// TIMESHEETS / INVOICES / WORKERS arrays so each entry on the strategic
// surfaces (Dashboard / Inbox / Insights / Compliance) opens a detail
// page that actually matches what the row says.
// =====================================================================

(function () {
  // ---------- Supplier scorecards -------------------------------------
  // Hand-tuned scorecards layered onto the SUPPLIERS list. Deterministic
  // per supplier id so each demo session shows the same ranking. Tiers
  // run 1–3 (1 = best, 3 = under-performing) with a separate `probation`
  // state for suppliers being actively wound down.
  //
  // Fields:
  //   tier         — "tier1" | "tier2" | "tier3" | "probation" | "pending"
  //   fillRate     — % of requested shifts filled (90d)
  //   ttf          — time-to-first-fill, minutes (median, 90d)
  //   noShow       — % of confirmed shifts where worker no-showed
  //   quality      — manager rating, 0–5 (avg of post-shift surveys)
  //   onTime       — % of arrivals on or before scheduled start
  //   fillTrend    — last 7 weeks fillRate
  //   rateAvg      — blended bill rate $/h
  //   rateMarkup   — blended markup % over pay rate
  //   submittals   — # candidates submitted per posted req (90d avg)
  //   offerAccept  — % of offered candidates that accepted
  //   redeploy     — % of workers returning for a 2nd+ shift
  //   tenure       — avg active-worker tenure with us, weeks
  //   complianceRate — % of active workers with all creds current
  //   credLapses   — # cred lapses in last 90d
  //   escalations  — # tier escalations / re-broadcasts in last 90d
  //   disputes     — # timesheet/invoice disputes in last 90d
  //   billedHours  — YTD billed hours through Apr 2026
  //   sinceTier    — date current tier was last assigned ("MMM YYYY")
  //   tierTrend    — direction since last quarterly review: "up"|"flat"|"down"
  const SCORECARDS = {
    gs: { tier: "tier1",   sinceTier: "Apr 2026", tierTrend: "up",
          fillRate: 96, ttf: 28, noShow: 1.2, quality: 4.8, onTime: 97, fillTrend: [78, 82, 85, 88, 91, 93, 96],
          rateAvg: 28.50, rateMarkup: 38,
          submittals: 4.8, offerAccept: 86, redeploy: 71, tenure: 18,
          complianceRate: 99, credLapses: 0, escalations: 1, disputes: 2, billedHours: 18420 },
    sw: { tier: "tier1",   sinceTier: "Jan 2026", tierTrend: "flat",
          fillRate: 91, ttf: 42, noShow: 2.4, quality: 4.6, onTime: 94, fillTrend: [82, 85, 87, 86, 88, 90, 91],
          rateAvg: 27.10, rateMarkup: 34,
          submittals: 4.2, offerAccept: 81, redeploy: 64, tenure: 15,
          complianceRate: 98, credLapses: 1, escalations: 2, disputes: 3, billedHours: 14260 },
    th: { tier: "tier1",   sinceTier: "Jan 2026", tierTrend: "flat",
          fillRate: 88, ttf: 55, noShow: 3.1, quality: 4.4, onTime: 91, fillTrend: [80, 82, 85, 85, 87, 88, 88],
          rateAvg: 26.75, rateMarkup: 33,
          submittals: 3.9, offerAccept: 78, redeploy: 58, tenure: 13,
          complianceRate: 97, credLapses: 1, escalations: 3, disputes: 4, billedHours: 9840 },
    ph: { tier: "tier2",   sinceTier: "Oct 2025", tierTrend: "flat",
          fillRate: 82, ttf: 71, noShow: 3.8, quality: 4.2, onTime: 88, fillTrend: [76, 79, 80, 82, 81, 82, 82],
          rateAvg: 25.40, rateMarkup: 31,
          submittals: 3.4, offerAccept: 72, redeploy: 49, tenure: 11,
          complianceRate: 95, credLapses: 3, escalations: 5, disputes: 6, billedHours: 7920 },
    ss: { tier: "tier2",   sinceTier: "Oct 2025", tierTrend: "down",
          fillRate: 79, ttf: 88, noShow: 4.6, quality: 4.0, onTime: 84, fillTrend: [85, 83, 81, 80, 79, 78, 79],
          rateAvg: 25.95, rateMarkup: 32,
          submittals: 3.1, offerAccept: 69, redeploy: 44, tenure: 10,
          complianceRate: 94, credLapses: 4, escalations: 6, disputes: 5, billedHours: 6940 },
    wf: { tier: "tier2",   sinceTier: "Jul 2025", tierTrend: "flat",
          fillRate: 77, ttf: 95, noShow: 4.8, quality: 4.1, onTime: 85, fillTrend: [72, 74, 75, 76, 76, 77, 77],
          rateAvg: 26.20, rateMarkup: 33,
          submittals: 3.0, offerAccept: 67, redeploy: 41, tenure: 9,
          complianceRate: 93, credLapses: 4, escalations: 7, disputes: 7, billedHours: 5780 },
    rl: { tier: "tier3",   sinceTier: "Apr 2026", tierTrend: "down",
          fillRate: 71, ttf: 112, noShow: 6.2, quality: 3.8, onTime: 78, fillTrend: [78, 76, 73, 72, 71, 70, 71],
          rateAvg: 24.85, rateMarkup: 29,
          submittals: 2.5, offerAccept: 61, redeploy: 32, tenure: 8,
          complianceRate: 89, credLapses: 7, escalations: 11, disputes: 9, billedHours: 4360 },
    tm: { tier: "tier3",   sinceTier: "Jan 2026", tierTrend: "down",
          fillRate: 68, ttf: 134, noShow: 7.4, quality: 3.6, onTime: 75, fillTrend: [72, 71, 70, 70, 69, 68, 68],
          rateAvg: 24.40, rateMarkup: 27,
          submittals: 2.2, offerAccept: 57, redeploy: 28, tenure: 7,
          complianceRate: 86, credLapses: 9, escalations: 14, disputes: 12, billedHours: 3520 },
    fp: { tier: "probation", sinceTier: "Apr 2026", tierTrend: "down",
          fillRate: 54, ttf: 188, noShow: 11.8, quality: 3.1, onTime: 68, fillTrend: [68, 65, 62, 58, 56, 54, 54],
          rateAvg: 23.90, rateMarkup: 24,
          submittals: 1.6, offerAccept: 48, redeploy: 19, tenure: 5,
          complianceRate: 78, credLapses: 14, escalations: 22, disputes: 18, billedHours: 2240 },
    sh: { tier: "pending", sinceTier: null, tierTrend: null,
          fillRate: null, ttf: null, noShow: null, quality: null, onTime: null, fillTrend: null, rateAvg: null, rateMarkup: null,
          submittals: null, offerAccept: null, redeploy: null, tenure: null,
          complianceRate: null, credLapses: null, escalations: null, disputes: null, billedHours: null },
    qs: { tier: "pending", sinceTier: null, tierTrend: null,
          fillRate: null, ttf: null, noShow: null, quality: null, onTime: null, fillTrend: null, rateAvg: null, rateMarkup: null,
          submittals: null, offerAccept: null, redeploy: null, tenure: null,
          complianceRate: null, credLapses: null, escalations: null, disputes: null, billedHours: null },
    hr: { tier: "tier3",   sinceTier: "Feb 2026", tierTrend: "down",
          fillRate: 64, ttf: 156, noShow: 8.9, quality: 3.4, onTime: 72, fillTrend: [76, 74, 70, 68, 66, 64, 64],
          rateAvg: 23.25, rateMarkup: 22,
          submittals: 1.9, offerAccept: 52, redeploy: 22, tenure: 6,
          complianceRate: 82, credLapses: 11, escalations: 17, disputes: 14, billedHours: 1480 },
  };

  // Composite score for ranking (0–100). Weight fill heaviest, then quality,
  // then on-time, then inverse no-show.
  function _composite(s) {
    if (s.fillRate == null) return null;
    const q = (s.quality / 5) * 100;
    const ns = Math.max(0, 100 - s.noShow * 6);
    return Math.round(s.fillRate * 0.45 + q * 0.25 + s.onTime * 0.20 + ns * 0.10);
  }

  // Scale supplier billedHours (and similar count-shaped fields) so the
  // scorecard reads as a small operator at $1M and a major partner at
  // $500M+. Quality / fillRate / ttf / noShow are percentages or rate
  // metrics — they stay flat across tiers (a supplier's fill rate is the
  // same regardless of program size).
  (function _scaleScorecards() {
    const sN = window.scaleN || ((n) => n);
    Object.keys(SCORECARDS).forEach((k) => {
      const sc = SCORECARDS[k];
      if (typeof sc.billedHours === "number" && sc.billedHours > 0) {
        sc.billedHours = Math.max(50, sN(sc.billedHours, "k"));
      }
    });
  })();

  // Decorate the live SUPPLIERS array on window with the score block.
  // Also computes each scored supplier's rank (1-based) within the full
  // list so the detail-page scorecard can show "#2 of 9".
  function decorateSuppliers() {
    const list = window.SUPPLIERS || [];
    list.forEach((s) => {
      if (s._sc) return; // idempotent
      const sc = SCORECARDS[s.id] || {};
      s._sc = { ...sc, composite: _composite(sc) };
    });
    const scored = list.filter((s) => s._sc && s._sc.composite != null);
    scored.sort((a, b) => b._sc.composite - a._sc.composite);
    scored.forEach((s, i) => { s._sc.rank = i + 1; });
    scored.forEach((s) => { s._sc.rankOf = scored.length; });
  }
  decorateSuppliers();

  // ---------- Shared helpers (used by TRIAGE + APPROVALS derivations) ---

  // "8800 Cargo Blvd., Dallas, TX" → "Dallas"
  function cityFor(locName) {
    const locs = window.LOCATIONS || [];
    const l = locs.find((x) => x.name === locName);
    if (!l || !l.address) return "";
    const parts = l.address.split(",").map((s) => s.trim());
    return parts[parts.length - 2] || "";
  }

  // "8:17" → 8.283 (hours). Tolerates "9 h 09 m" / "9:09" / 9 (number).
  function durationToHours(d) {
    if (d == null || d === "—") return 0;
    if (typeof d === "number") return d;
    const s = String(d).trim();
    const hm = /^(\d+):(\d+)$/.exec(s);
    if (hm) return parseInt(hm[1], 10) + parseInt(hm[2], 10) / 60;
    const hMin = /^(\d+)\s*h\s*(\d+)/.exec(s);
    if (hMin) return parseInt(hMin[1], 10) + parseInt(hMin[2], 10) / 60;
    const n = parseFloat(s);
    return Number.isFinite(n) ? n : 0;
  }

  function fmtDurHHMM(d) {
    const h = durationToHours(d);
    if (!h) return "—";
    const hh = Math.floor(h);
    const mm = Math.round((h - hh) * 60);
    return `${hh} h ${String(mm).padStart(2, "0")} m`;
  }

  function fmtUSD(n) {
    if (!Number.isFinite(n)) return "—";
    const sym = (window && window.curSymbol) ? window.curSymbol() : "$";
    return `${sym}${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  // ---------- At-risk shifts (Triage) ----------------------------------
  // Each row is grounded in a real REQUISITIONS entry so the dashboard
  // can deep-link straight to a detail page that reads the same way.
  // The triage row's `title`, `location`, `tag` (city + scheduled time),
  // and supplier all match the linked requisition.
  function _triageRow({ id, level, when, whenSort, reqId, needed, confirmed, supplier, action }) {
    const reqs = window.REQUISITIONS || [];
    const r = reqs.find((x) => x.id === reqId);
    if (!r) return null;
    const job = (r.jobs && r.jobs[0]) || "Worker";
    const qty = needed != null ? needed : (r.qty || 1);
    const city = cityFor(r.location);
    // Default to the requisition's first assigned supplier when the
    // caller didn't override (keeps triage in sync with distribution).
    const sup = supplier && (r.suppliers || []).includes(supplier)
      ? supplier
      : (r.suppliers && r.suppliers[0]) || supplier || "sw";
    return {
      id, level, when, whenSort,
      title: `${qty} ${job}${qty === 1 ? "" : "s"}`,
      location: r.location,
      supplier: sup,
      reqId,
      needed: qty,
      confirmed: Math.min(confirmed, qty),
      tag: city ? `${city} · ${r.time}` : r.time,
      action,
    };
  }

  const TRIAGE = [
    // K1L2M3N4O5 = 3 Production Associates, Inventory Warehouse Kappa (Phoenix), 6–3
    _triageRow({ id: "TR-901", level: "crit", when: "Starts in 2 hrs",      whenSort: 2,
                 reqId: "K1L2M3N4O5", confirmed: 1, supplier: "gs", action: "Escalate to next tier" }),
    // N6O7P8Q9R0 = 2 Line Managers, Storage Facility Beta (Dallas), 8–5
    _triageRow({ id: "TR-902", level: "crit", when: "Starts in 4 hrs",      whenSort: 4,
                 reqId: "N6O7P8Q9R0", confirmed: 1, supplier: "sw", action: "Re-broadcast" }),
    // T6U7V8W9X0 = 4 Warehouse Clerks, Freight Terminal Delta (Long Beach), 8–4
    _triageRow({ id: "TR-903", level: "warn", when: "Tomorrow · 8:00 AM", whenSort: 22,
                 reqId: "T6U7V8W9X0", confirmed: 2, supplier: "th", action: "Open shift" }),
    // P6Q7R8S9T0 = 5 Production Associates, Cargo Depot Zeta (Newark), 6–3
    _triageRow({ id: "TR-904", level: "warn", when: "Tomorrow · 6:00 AM", whenSort: 26,
                 reqId: "P6Q7R8S9T0", confirmed: 3, supplier: "th", action: "Find replacement" }),
    // Y1Z2A3B4C5 = 4 Production Associates, Storage Facility Beta (Dallas), 6–3
    _triageRow({ id: "TR-905", level: "ok",   when: "Thu · 6:00 AM",      whenSort: 50,
                 reqId: "Y1Z2A3B4C5", confirmed: 4, supplier: "gs", action: "View" }),
  ].filter(Boolean);

  // ---------- Approvals inbox ------------------------------------------
  // Single queue across timesheets, requisitions, invoices, rate cards.
  // Each kind links back to its source page when clicked, and the visible
  // meta (worker / supplier / hours / amount / date) is derived from the
  // referenced row so clicking through never reveals a mismatch.

  // Per-hour blended rate the demo uses to translate a duration into an
  // amount. Realistic enough to match the prior hand-tuned figures.
  const RATE_PER_HOUR = 30;

  function _tsApproval(ts, priority) {
    const worker = (window.WORKERS || []).find((w) => w.id === ts.worker);
    const sup = (window.REQ_SUPPLIERS || {})[ts.supplier] || { label: ts.supplier };
    const hours = durationToHours(ts.duration);
    const amount = hours ? hours * RATE_PER_HOUR : 0;
    const notes = [];
    if (ts.status === "Review") notes.push("disputed");
    const metaParts = [sup.label];
    if (hours) metaParts.push(fmtDurHHMM(hours));
    metaParts.push(ts.date);
    if (notes.length) metaParts.push(notes.join(", "));
    return {
      id: ts.id,
      kind: "ts",
      priority,
      title: `${worker ? worker.name : "Worker"} · ${ts.booking}`,
      meta: metaParts.join(" · "),
      amount: hours ? fmtUSD(amount) : "—",
      target: { page: "timesheets", sub: "details", id: ts.id },
    };
  }

  function _reqApproval(req, priority, note) {
    return {
      id: `REQ-${req.id.slice(0, 4)}`,
      kind: "req",
      priority,
      title: `${req.location} · ${req.qty} ${req.jobs[0]}${req.qty === 1 ? "" : "s"}`,
      meta: [
        req.dates.length === 1 ? req.dates[0] : `${req.dates.length} dates`,
        (window.REQ_SUPPLIERS || {})[req.suppliers[0]]?.label || req.suppliers[0],
        note,
      ].filter(Boolean).join(" · "),
      amount: req.bill,
      target: { page: "requisitions", sub: "details", id: req.id },
    };
  }

  function _invApproval(inv, priority, note) {
    if (!inv) return null;
    const sup = (window.REQ_SUPPLIERS || {})[inv.supplier] || { label: inv.supplier };
    return {
      id: inv.id,
      kind: "inv",
      priority,
      title: `${sup.label} · ${inv.locations[0]}`,
      meta: [`${inv.req} · ${inv.status}`, note].filter(Boolean).join(" · "),
      amount: inv.amount,
      target: { page: "invoices", sub: "details", id: inv.id },
    };
  }

  function _rateApproval({ id, supplierId, priority, title, meta, amount }) {
    return {
      id,
      kind: "rate",
      priority,
      title,
      meta,
      amount,
      target: { page: "suppliers", sub: "details", id: supplierId },
    };
  }

  // Build the queue. Timesheets only enter "approvals" when they're in a
  // status that needs the user's sign-off (Pending Approval or Review).
  function _buildApprovals() {
    const ts = window.TIMESHEETS || [];
    const reqs = window.REQUISITIONS || [];
    const invs = window.INVOICES || [];

    const approvable = ts.filter((t) => t.status === "Pending Approval" || t.status === "Review");
    // Stable priority assignment: Review first (high), then most-recent
    // Pending Approval as med, older as low.
    const sorted = approvable
      .slice()
      .sort((a, b) => (b.date || "").localeCompare(a.date || ""));
    const tsRows = sorted.map((t) => {
      let p = "low";
      if (t.status === "Review") p = "high";
      else if (sorted.indexOf(t) < 2) p = "med";
      return _tsApproval(t, p);
    });

    // Requisitions sitting in "In progress" we'd plausibly need to sign
    // off on for a budget exception or expedited routing.
    const reqRows = [
      _reqApproval(reqs.find((r) => r.id === "O1P2Q3R4S5"), "med", "over budget by 4%"),
      _reqApproval(reqs.find((r) => r.id === "K1L2M3N4O5"), "high", "expedited"),
    ].filter(Boolean);

    // Invoices: Generated (need to issue) and Overdue (need attention).
    const invRows = [
      _invApproval(invs.find((i) => i.id === "D4E5F6G7"), "low",  "matched, 0 disputes"),
      _invApproval(invs.find((i) => i.id === "F6G7H8I9"), "high", "2 line disputes"),
    ].filter(Boolean);

    const rateRows = [
      _rateApproval({ id: "RATE-PH", supplierId: "ph", priority: "med",
        title: "Pro Hire · proposed +4.0% rate uplift",
        meta: "Effective May 1 · 18 active workers",
        amount: "+$0.95/hr" }),
      _rateApproval({ id: "RATE-WF", supplierId: "wf", priority: "low",
        title: "WorkForce Now · Q3 markup renewal",
        meta: "Markup 33% → 34% · 1 location",
        amount: "+$0.40/hr" }),
    ];

    return [...tsRows, ...reqRows, ...invRows, ...rateRows];
  }

  const APPROVALS = _buildApprovals();

  // ---------- Compliance flags -----------------------------------------
  const COMPLIANCE = [
    { id: "CMP-1", level: "err",  kind: "expired",   title: "OSHA-10 expired · Terry Donin",          meta: "Pro Hire · expired 3 days ago · 12 future shifts at risk",        action: "Suspend bookings" },
    { id: "CMP-2", level: "err",  kind: "missing",   title: "I-9 missing · 4 StaffWise workers",      meta: "Workforce filter shows affected names · scheduled in next 14 d",  action: "Notify supplier" },
    { id: "CMP-3", level: "warn", kind: "expiring",  title: "Food Handler permit expires in 7 days · Charlie Carder", meta: "GoodShift · 5 future shifts",  action: "Request renewal" },
    { id: "CMP-4", level: "warn", kind: "expiring",  title: "Forklift cert expires in 21 days · 3 workers", meta: "Pro Hire · 1 work assignment past expiry · 14 future shifts",          action: "Bulk request" },
    { id: "CMP-5", level: "warn", kind: "block",     title: "Background check on hold · Jaxson Geidt", meta: "GoodShift · vendor delay · 4 days pending",                       action: "Escalate to supplier" },
    { id: "CMP-6", level: "ok",   kind: "renewed",   title: "12 ServSafe certs renewed this week",     meta: "Bulk import from Talent Hub",                                    action: "View log" },
  ];

  // ---------- Spend buckets --------------------------------------------
  // Weekly spend for an 8-week trailing window. The week-over-week and
  // weekday tilt are surfaced in the Insights page. Both `total` and the
  // per-supplier split are scaled through the active temp-spend tier
  // (see pages/temp-spend.jsx) so this same 8-week shape reads $84.6k
  // at $10M and ~$4.2M at $500M+ without changing the chart contour.
  const _SW = (typeof window !== "undefined" && typeof window.TEMP_SPEND_SCALE === "number") ? window.TEMP_SPEND_SCALE : 1;
  const _scaleSpend = (n) => Math.max(0, Math.round((n * _SW) / 100) * 100);
  const _scaleSplit = (sup) => {
    const out = {};
    for (const k of Object.keys(sup)) out[k] = _scaleSpend(sup[k]);
    return out;
  };
  const SPEND_WEEKLY = [
    { wk: "W-7", total: _scaleSpend(71400), sup: _scaleSplit({ gs: 24800, sw: 18600, th: 13700, ph:  9200, ss:  5100 }) },
    { wk: "W-6", total: _scaleSpend(68900), sup: _scaleSplit({ gs: 23100, sw: 17900, th: 13300, ph:  9600, ss:  5000 }) },
    { wk: "W-5", total: _scaleSpend(74200), sup: _scaleSplit({ gs: 26100, sw: 19100, th: 14200, ph:  9300, ss:  5500 }) },
    { wk: "W-4", total: _scaleSpend(78400), sup: _scaleSplit({ gs: 27900, sw: 19800, th: 14900, ph:  9900, ss:  5900 }) },
    { wk: "W-3", total: _scaleSpend(76900), sup: _scaleSplit({ gs: 26700, sw: 19700, th: 14600, ph: 10300, ss:  5600 }) },
    { wk: "W-2", total: _scaleSpend(82100), sup: _scaleSplit({ gs: 29100, sw: 20300, th: 15800, ph: 10500, ss:  6400 }) },
    { wk: "W-1", total: _scaleSpend(79200), sup: _scaleSplit({ gs: 27900, sw: 19500, th: 15300, ph: 10800, ss:  5700 }) },
    { wk: "This wk", total: _scaleSpend(84600), sup: _scaleSplit({ gs: 30200, sw: 20800, th: 16100, ph: 11000, ss: 6500 }) },
  ];

  // ---------- Distribution rules preview --------------------------------
  // Used on the Dashboard's "Today's distribution" card.
  const DIST_PREVIEW = [
    { tier: "tier1", label: "Tier 1 — first 30 min",  names: ["GoodShift"], holds: "0:30:00" },
    { tier: "tier1", label: "Tier 1 — next 2 h",       names: ["StaffWise", "Talent Hub"], holds: "2:00:00" },
    { tier: "tier2", label: "Tier 2 — broadcast",      names: ["Pro Hire", "Skill Scouts", "WorkForce Now"], holds: "—" },
    { tier: "tier3", label: "Tier 3 — fallback",       names: ["RoleLink", "TempMatch"], holds: "—" },
  ];

  // ---------- Helpers used by VMS surfaces ------------------------------
  // Reads the active country's symbol at call time so the value reflects
  // the current org context (and any live country switch).
  function _curr() {
    if (typeof window === "undefined") return "$";
    return window.__activeCurrencySymbol || (window.getCurrentCountry ? window.getCurrentCountry().symbol : "$") || "$";
  }
  function fmtMoney(n, opts = {}) {
    if (n == null) return "—";
    const sym = _curr();
    const sign = n < 0 ? "-" : "";
    const abs = Math.abs(n);
    if (opts.compact && abs >= 1000) {
      const k = abs / 1000;
      return `${sign}${sym}${k >= 100 ? k.toFixed(0) : k.toFixed(1)}k`;
    }
    return `${sign}${sym}${abs.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  }
  function fmtPct(n) { return n == null ? "—" : `${n}%`; }
  function fmtMin(n) { return n == null ? "—" : (n < 60 ? `${n} min` : `${(n / 60).toFixed(1)} h`); }

  // Build a smooth-line sparkline path d= attribute from a value array.
  function sparkPath(values, w = 96, h = 28, pad = 2) {
    if (!values || !values.length) return { line: "", area: "" };
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = (max - min) || 1;
    const stepX = (w - pad * 2) / (values.length - 1 || 1);
    const points = values.map((v, i) => {
      const x = pad + i * stepX;
      const y = pad + (h - pad * 2) * (1 - (v - min) / range);
      return [x, y];
    });
    const line = points.map((p, i) => (i === 0 ? `M${p[0].toFixed(1)} ${p[1].toFixed(1)}` : `L${p[0].toFixed(1)} ${p[1].toFixed(1)}`)).join(" ");
    const area = line + ` L${points[points.length - 1][0].toFixed(1)} ${h - pad} L${points[0][0].toFixed(1)} ${h - pad} Z`;
    return { line, area };
  }

  Object.assign(window, {
    TRIAGE,
    APPROVALS,
    COMPLIANCE,
    SPEND_WEEKLY,
    DIST_PREVIEW,
    SCORECARDS,
    fmtMoney, fmtPct, fmtMin, sparkPath,
  });

  // Register the derived arrays that have currency strings baked in by
  // fmtUSD() / inline literals — so a live country switch can rewrite
  // them on the fly. SPEND_WEEKLY holds raw numbers, not strings, so it
  // doesn't need to be registered (callers format it at render time).
  if (window.registerCurrencyData) {
    window.registerCurrencyData(APPROVALS);
    window.registerCurrencyData(TRIAGE);
  }
})();
