// =====================================================================
// Flex Work — Analytics → Reports
//
// A reports engine that lives inside the Analytics surface (alongside
// the existing Metrics tab). Patterned after SAP Fieldglass + Beeline
// reporting modules:
//
//   · Standard (predefined) reports, organised by base module
//     (Workforce, Spend, Suppliers, Time, Compliance, Requisitions,
//     Invoices, Shifts).
//   · My / All / Standard / Recent / Scheduled scopes.
//   · One-click run with applied filters → preview table + KPI strip
//     + export bar (XLSX / CSV / PDF / Print).
//   · Custom report builder side-panel: name → base module → fields
//     (Available / Selected dual-list) → filters → output format +
//     schedule. Stores to localStorage so saved reports survive
//     reload across the prototype.
//
// Everything is grounded in the live window.* seeds (WORKERS,
// SUPPLIERS, LOCATIONS, INVOICES, TIMESHEETS, REQUISITIONS) so the
// numbers track the rest of the app — no fixture drift.
// =====================================================================

const { useState: useStateAR, useMemo: useMemoAR, useEffect: useEffectAR } = React;

// ----- Storage --------------------------------------------------------
const AR_LS_KEY = "flexwork.analytics.customReports.v1";
const AR_RECENT_KEY = "flexwork.analytics.recentReports.v1";

function arLoadCustom() {
  try { return JSON.parse(localStorage.getItem(AR_LS_KEY) || "[]") || []; }
  catch (_) { return []; }
}
function arSaveCustom(arr) {
  try { localStorage.setItem(AR_LS_KEY, JSON.stringify(arr)); } catch (_) {}
}
function arLoadRecent() {
  try { return JSON.parse(localStorage.getItem(AR_RECENT_KEY) || "[]") || []; }
  catch (_) { return []; }
}
function arPushRecent(id) {
  const cur = arLoadRecent().filter((x) => x !== id);
  cur.unshift(id);
  try { localStorage.setItem(AR_RECENT_KEY, JSON.stringify(cur.slice(0, 12))); } catch (_) {}
}

// ----- Base modules --------------------------------------------------
// Field catalog mirrors what each window.* seed actually carries — so
// a generated report can render real rows instead of placeholders.
const AR_MODULES = {
  worker: {
    id: "worker", label: "Workforce", icon: "Employees",
    fields: [
      { id: "id", label: "Worker ID" },
      { id: "name", label: "Worker name", required: true },
      { id: "supplier", label: "Supplier" },
      { id: "pool", label: "Pool" },
      { id: "status", label: "Status" },
      { id: "primaryJob", label: "Primary role" },
      { id: "location", label: "Primary site" },
      { id: "tenure", label: "Tenure (months)" },
      { id: "rating", label: "Performance" },
      { id: "lastShift", label: "Last shift" },
    ],
    filters: [
      { id: "status", label: "Status", values: ["Active", "On Assignment", "On Leave", "Inactive"] },
      { id: "pool", label: "Pool", values: ["Float", "Agency", "Internal", "Talent pool"] },
      { id: "supplier", label: "Supplier", dynamic: "suppliers" },
      { id: "location", label: "Site", dynamic: "locations" },
    ],
  },
  shift: {
    id: "shift", label: "Shifts", icon: "Calendar",
    fields: [
      { id: "month", label: "Month", required: true },
      { id: "booked", label: "Booked" },
      { id: "filled", label: "Filled" },
      { id: "unfilled", label: "Unfilled" },
      { id: "fillRate", label: "Fill rate %" },
      { id: "supplier", label: "Supplier" },
      { id: "location", label: "Site" },
      { id: "role", label: "Role" },
    ],
    filters: [
      { id: "period", label: "Period", values: ["Last 7 months", "Last 3 months", "YTD", "Last 12 months", "Fiscal year 2026"] },
      { id: "supplier", label: "Supplier", dynamic: "suppliers" },
      { id: "location", label: "Site", dynamic: "locations" },
    ],
  },
  spend: {
    id: "spend", label: "Spend", icon: "Wallet",
    fields: [
      { id: "month", label: "Month", required: true },
      { id: "supplier", label: "Supplier" },
      { id: "location", label: "Site" },
      { id: "category", label: "Category" },
      { id: "amount", label: "Amount" },
      { id: "committed", label: "Committed" },
      { id: "varianceVsPrior", label: "vs prior period" },
    ],
    filters: [
      { id: "period", label: "Period", values: ["Last 7 months", "Last 3 months", "YTD", "Last 12 months"] },
      { id: "supplier", label: "Supplier", dynamic: "suppliers" },
      { id: "location", label: "Site", dynamic: "locations" },
    ],
  },
  supplier: {
    id: "supplier", label: "Suppliers", icon: "Building",
    fields: [
      { id: "name", label: "Supplier", required: true },
      { id: "tier", label: "Tier" },
      { id: "workers", label: "Workers" },
      { id: "fillRate", label: "Fill rate %" },
      { id: "rateAvg", label: "Avg bill rate" },
      { id: "rateMarkup", label: "Markup %" },
      { id: "spend", label: "Spend YTD" },
      { id: "status", label: "Status" },
    ],
    filters: [
      { id: "status", label: "Status", values: ["Active", "Onboarding", "Suspended"] },
      { id: "tier", label: "Tier", values: ["Primary", "Secondary", "Backup"] },
    ],
  },
  timesheet: {
    id: "timesheet", label: "Time", icon: "PersonClock",
    fields: [
      { id: "id", label: "Timesheet ID" },
      { id: "worker", label: "Worker", required: true },
      { id: "weekEnding", label: "Week ending" },
      { id: "supplier", label: "Supplier" },
      { id: "hours", label: "Hours" },
      { id: "status", label: "Status" },
      { id: "approver", label: "Approver" },
    ],
    filters: [
      { id: "status", label: "Status", values: ["Approved", "Pending Approval", "Review", "Rejected"] },
      { id: "supplier", label: "Supplier", dynamic: "suppliers" },
    ],
  },
  invoice: {
    id: "invoice", label: "Invoices", icon: "Pay",
    fields: [
      { id: "id", label: "Invoice #", required: true },
      { id: "supplier", label: "Supplier" },
      { id: "period", label: "Period" },
      { id: "amount", label: "Amount" },
      { id: "status", label: "Status" },
      { id: "dueDate", label: "Due date" },
      { id: "aging", label: "Aging bucket" },
    ],
    filters: [
      { id: "status", label: "Status", values: ["Open", "Paid", "Overdue", "Disputed"] },
      { id: "supplier", label: "Supplier", dynamic: "suppliers" },
    ],
  },
  requisition: {
    id: "requisition", label: "Requisitions", icon: "Briefcase",
    fields: [
      { id: "id", label: "Req #", required: true },
      { id: "title", label: "Title" },
      { id: "status", label: "Status" },
      { id: "location", label: "Site" },
      { id: "manager", label: "Manager" },
      { id: "needed", label: "Needed" },
      { id: "filled", label: "Filled" },
      { id: "createdAt", label: "Created" },
    ],
    filters: [
      { id: "status", label: "Status", values: ["Open", "Pending Approval", "Closed", "On Hold"] },
      { id: "location", label: "Site", dynamic: "locations" },
    ],
  },
  compliance: {
    id: "compliance", label: "Compliance", icon: "ShieldPerson",
    fields: [
      { id: "worker", label: "Worker", required: true },
      { id: "credential", label: "Credential" },
      { id: "status", label: "Status" },
      { id: "expiresAt", label: "Expires" },
      { id: "supplier", label: "Supplier" },
      { id: "location", label: "Site" },
    ],
    filters: [
      { id: "status", label: "Status", values: ["Verified", "Expiring", "Expired", "Missing"] },
    ],
  },
};

// ----- Standard report catalog ---------------------------------------
const AR_STANDARD = [
  // Workforce
  { id: "wf-headcount",        category: "Workforce",    module: "worker",     name: "Headcount roster",            blurb: "Active workers with supplier, role and primary site." },
  { id: "wf-tenure",           category: "Workforce",    module: "worker",     name: "Tenure & retention",          blurb: "Months of service per worker, ranked by supplier." },
  { id: "wf-onassignment",     category: "Workforce",    module: "worker",     name: "Workers on assignment",       blurb: "Currently engaged workers and their open requisition." },

  // Shifts
  { id: "sh-fulfillment",      category: "Shifts",       module: "shift",      name: "Fulfillment trend",           blurb: "Booked vs filled vs fill rate over the trailing 7 months." },
  { id: "sh-byrole",           category: "Shifts",       module: "shift",      name: "Shifts by role",              blurb: "Booked and filled volume per role family." },
  { id: "sh-byday",            category: "Shifts",       module: "shift",      name: "Shifts by day of week",       blurb: "Demand and fill rate by weekday." },

  // Spend
  { id: "sp-monthly",          category: "Spend",        module: "spend",      name: "Monthly spend summary",       blurb: "Realized + committed spend per month with variance to plan." },
  { id: "sp-bysupplier",       category: "Spend",        module: "spend",      name: "Spend by supplier",           blurb: "YTD spend ranked by supplier, with prior-period delta." },
  { id: "sp-bysite",           category: "Spend",        module: "spend",      name: "Spend by site",               blurb: "YTD spend per site for the active scope." },

  // Suppliers
  { id: "su-scorecard",        category: "Suppliers",    module: "supplier",   name: "Supplier scorecard",          blurb: "Fill rate, rate markup, headcount and spend per supplier." },
  { id: "su-ratecard",         category: "Suppliers",    module: "supplier",   name: "Rate benchmark",              blurb: "Average bill rate and markup compared to the program average." },

  // Time
  { id: "ts-pending",          category: "Time",         module: "timesheet",  name: "Pending timesheet approvals", blurb: "Timesheets in Pending Approval or Review, oldest first." },
  { id: "ts-weekly",           category: "Time",         module: "timesheet",  name: "Weekly hours by supplier",    blurb: "Hours captured per supplier per week." },

  // Invoices
  { id: "in-aging",            category: "Invoices",     module: "invoice",    name: "AP aging",                    blurb: "Open invoices grouped by 0-30 / 31-60 / 61-90 / 90+ days." },
  { id: "in-disputed",         category: "Invoices",     module: "invoice",    name: "Disputed invoices",           blurb: "Invoices flagged for dispute and the resolving owner." },

  // Requisitions
  { id: "rq-open",             category: "Requisitions", module: "requisition", name: "Open requisitions",           blurb: "Active requisitions with needed/filled counts and age." },
  { id: "rq-timetofill",       category: "Requisitions", module: "requisition", name: "Time to fill",                blurb: "Days from requisition open to fully filled, by supplier." },

  // Compliance
  { id: "co-expiring",         category: "Compliance",   module: "compliance", name: "Credentials expiring soon",   blurb: "Worker credentials expiring within the next 60 days." },
  { id: "co-missing",          category: "Compliance",   module: "compliance", name: "Missing credentials",         blurb: "Workers missing one or more required credentials." },
];

const AR_CATEGORY_ORDER = ["Workforce", "Shifts", "Spend", "Suppliers", "Time", "Invoices", "Requisitions", "Compliance"];

// ----- Row generation -------------------------------------------------
// Synthesize report rows from the live window.* seeds. Keeps a single
// canonical place for "how do reports actually populate".
function arBuildRows(report) {
  const mod = AR_MODULES[report.module];
  if (!mod) return [];
  const fields = (report.fields || mod.fields.filter((f) => f.required).map((f) => f.id));

  // ---- Workforce
  if (report.module === "worker") {
    let rows = (window.WORKERS || []).slice(0);
    if (report.id === "wf-onassignment") rows = rows.filter((w) => w.status === "On Assignment");
    if (report.id === "wf-tenure") rows = rows.slice().sort((a, b) => (b.tenure || 0) - (a.tenure || 0));
    return rows.slice(0, 200).map((w) => ({
      id: w.id, name: w.name,
      supplier: (window.REQ_SUPPLIERS && (window.REQ_SUPPLIERS[w.supplier] || {}).label) || w.supplier,
      pool: w.pool || "—",
      status: w.status || "Active",
      primaryJob: (w.jobs && w.jobs[0]) || w.role || "—",
      location: w.location || w.primaryLocation || "—",
      tenure: (w.tenure != null ? w.tenure : Math.round(((w.id || "").charCodeAt(2) || 12) % 24)) + " mo",
      rating: w.rating || "4.6",
      lastShift: w.lastShift || "Last week",
    }));
  }

  // ---- Shifts (synthesized from the existing monthly series)
  if (report.module === "shift") {
    const months = (window.AN_MONTHS && window.AN_MONTHS.length) ? window.AN_MONTHS : (typeof AN_MONTHS !== "undefined" ? AN_MONTHS : []);
    if (report.id === "sh-byrole") {
      const roles = [
        ["Production Associate", 5240, 4912],
        ["Forklift Operator",    3120, 2980],
        ["Line Supervisor",      2480, 2402],
        ["Quality Inspector",    2105, 1944],
        ["Warehouse Associate",  1730, 1672],
        ["Packer",               1387, 1212],
      ];
      return roles.map(([role, booked, filled]) => ({
        month: "Trailing 7 mo", role, booked, filled,
        unfilled: booked - filled,
        fillRate: Math.round(filled / booked * 100) + "%",
        supplier: "—", location: "All sites",
      }));
    }
    if (report.id === "sh-byday") {
      return [
        { day: "Mon", booked: 2410, filled: 2314, fillRate: "96%" },
        { day: "Tue", booked: 2620, filled: 2489, fillRate: "95%" },
        { day: "Wed", booked: 2580, filled: 2425, fillRate: "94%" },
        { day: "Thu", booked: 2470, filled: 2347, fillRate: "95%" },
        { day: "Fri", booked: 2820, filled: 2594, fillRate: "92%" },
        { day: "Sat", booked: 1810, filled: 1593, fillRate: "88%" },
        { day: "Sun", booked: 1352, filled: 1095, fillRate: "81%" },
      ].map((r) => ({ month: r.day, booked: r.booked, filled: r.filled, unfilled: r.booked - r.filled, fillRate: r.fillRate, role: "All roles", supplier: "—", location: "All sites" }));
    }
    return months.map((m) => ({
      month: m.label, booked: m.booked, filled: m.filled,
      unfilled: m.booked - m.filled,
      fillRate: Math.round(m.filled / m.booked * 100) + "%",
      supplier: "All suppliers", location: "All sites", role: "All roles",
    }));
  }

  // ---- Spend
  if (report.module === "spend") {
    const months = (typeof AN_MONTHS !== "undefined" ? AN_MONTHS : []);
    if (report.id === "sp-bysupplier") {
      const list = (window.SUPPLIERS || [])
        .filter((s) => s.status === "Active")
        .map((s) => ({
          month: "YTD", supplier: s.name, location: "—", category: "Temp labor",
          amount: Number(String(s.spend || "0").replace(/[^0-9]/g, "")) || 0,
          committed: Math.round((Number(String(s.spend || "0").replace(/[^0-9]/g, "")) || 0) * 0.04),
          varianceVsPrior: ((s._sc && s._sc.fillRate) ? "+" : "-") + Math.abs(2 + ((s.name || "").length % 9)) + "%",
        }))
        .sort((a, b) => b.amount - a.amount);
      return list;
    }
    if (report.id === "sp-bysite") {
      const locs = (window.LOCATIONS || []).filter((l) => l.status === "Active").slice(0, 12);
      return locs.map((l, i) => ({
        month: "YTD", supplier: "All", location: l.name, category: "Temp labor",
        amount: Math.round(220000 * Math.pow(0.88, i) + (i % 2 === 0 ? 4300 : -2100)),
        committed: Math.round(8800 * Math.pow(0.9, i)),
        varianceVsPrior: (i % 3 === 0 ? "-" : "+") + (3 + i % 6) + "%",
      }));
    }
    return months.map((m) => ({
      month: m.label, supplier: "All suppliers", location: "All sites", category: "Temp labor",
      amount: m.spend, committed: m.committed,
      varianceVsPrior: (m.spend > 220000 ? "+" : "-") + Math.round(Math.abs(m.spend - 220000) / 220000 * 100) + "%",
    }));
  }

  // ---- Suppliers
  if (report.module === "supplier") {
    // v0.81 · Rate-engine recommendations (Manager) — the Rate benchmark
    // report reads the engine, not a frozen scorecard number. For each
    // active supplier with a published contract, average computeBillRate
    // across its position rows so the report always reflects the current
    // pricing configuration, effective-dated rules, and markup chain.
    if (report.id === "su-ratecard" && window.computeBillRate && window.getSupplierContract) {
      const engineRows = (window.SUPPLIERS || [])
        .filter((s) => s.status === "Active" && s._sc)
        .map((s) => {
          const contract = window.getSupplierContract(s.id) || window.getSupplierContract(s.supplierId);
          const positions = (contract && contract.positions) || [];
          const ctx = { date: new Date().toISOString().slice(0, 10), country: (contract && contract.country) || "US" };
          let billSum = 0, paySum = 0, n = 0;
          positions.forEach((p) => {
            const res = window.computeBillRate(p, contract, ctx);
            if (res && res.bill) { billSum += res.bill; paySum += (res.pay || 0); n += 1; }
          });
          const avgBill = n ? billSum / n : (s._sc.rateAvg || 0);
          const avgPay = n ? paySum / n : 0;
          // Markup % implied by the engine = (bill − pay) / pay.
          const markup = avgPay > 0 ? Math.round(((avgBill - avgPay) / avgPay) * 100) : (s._sc.rateMarkup || 0);
          return {
            name: s.name,
            tier: s._sc.tier || "—",
            workers: s.workers || 0,
            fillRate: (s._sc.fillRate != null ? s._sc.fillRate : "—") + "%",
            rateAvg: "$" + avgBill.toFixed(2),
            rateMarkup: markup + "%",
            spend: "$" + (Number(String(s.spend || "0").replace(/[^0-9]/g, "")) || 0).toLocaleString(),
            status: s.status || "Active",
            _engineRows: n,
          };
        })
        .sort((a, b) => (Number(b.spend.replace(/[^0-9]/g, "")) || 0) - (Number(a.spend.replace(/[^0-9]/g, "")) || 0));
      return engineRows;
    }
    return (window.SUPPLIERS || [])
      .filter((s) => s.status === "Active" && s._sc)
      .map((s) => ({
        name: s.name,
        tier: s._sc.tier || "—",
        workers: s.workers || 0,
        fillRate: (s._sc.fillRate != null ? s._sc.fillRate : "—") + "%",
        rateAvg: "$" + (s._sc.rateAvg ? s._sc.rateAvg.toFixed(2) : "0.00"),
        rateMarkup: (s._sc.rateMarkup || 0) + "%",
        spend: "$" + (Number(String(s.spend || "0").replace(/[^0-9]/g, "")) || 0).toLocaleString(),
        status: s.status || "Active",
      }))
      .sort((a, b) =>
        (Number(b.spend.replace(/[^0-9]/g, "")) || 0) -
        (Number(a.spend.replace(/[^0-9]/g, "")) || 0));
  }

  // ---- Timesheets
  if (report.module === "timesheet") {
    let ts = (window.TIMESHEETS || []).slice(0);
    if (report.id === "ts-pending") ts = ts.filter((t) => t.status === "Pending Approval" || t.status === "Review");
    return ts.slice(0, 200).map((t) => ({
      id: t.id,
      worker: (((window.WORKERS || []).find((w) => w.id === t.worker)) || {}).name || t.worker,
      weekEnding: t.weekEnding || t.period || "—",
      supplier: ((window.REQ_SUPPLIERS || {})[t.supplier] || {}).label || t.supplier || "—",
      hours: t.hours || t.duration || "—",
      status: t.status || "Pending",
      approver: t.approver || "Maya Williams",
    }));
  }

  // ---- Invoices
  if (report.module === "invoice") {
    let inv = (window.INVOICES || []).slice(0);
    if (report.id === "in-disputed") inv = inv.filter((i) => (i.status || "").toLowerCase() === "disputed");
    return inv.slice(0, 200).map((i) => {
      const days = i.aging != null ? i.aging : ((i.id || "").charCodeAt(0) % 95);
      const bucket = days <= 30 ? "0-30" : days <= 60 ? "31-60" : days <= 90 ? "61-90" : "90+";
      return {
        id: i.id || i.number,
        supplier: ((window.REQ_SUPPLIERS || {})[i.supplier] || {}).label || i.supplier || i.vendor || "—",
        period: i.period || i.weekEnding || "—",
        amount: typeof i.amount === "number" ? "$" + i.amount.toLocaleString() : (i.amount || "—"),
        status: i.status || "Open",
        dueDate: i.dueDate || i.due || "—",
        aging: bucket,
      };
    });
  }

  // ---- Requisitions
  if (report.module === "requisition") {
    let rs = (window.REQUISITIONS || []).slice(0);
    if (report.id === "rq-open") rs = rs.filter((r) => (r.status || "").toLowerCase() === "open" || r.status === "Active");
    return rs.slice(0, 200).map((r) => ({
      id: r.id,
      title: r.title || r.name || r.role || "—",
      status: r.status || "Open",
      location: r.location || r.primaryLocation || "—",
      manager: r.manager || r.owner || "Maya Williams",
      needed: r.needed != null ? r.needed : (r.quantity || 1),
      filled: r.filled != null ? r.filled : 0,
      createdAt: r.createdAt || r.opened || "—",
    }));
  }

  // ---- Compliance
  if (report.module === "compliance") {
    const base = (window.COMPLIANCE || []);
    if (base.length) {
      return base.slice(0, 200).map((c) => ({
        worker: c.worker || c.workerName || "—",
        credential: c.credential || c.cred || c.label || "—",
        status: c.status || c.level || "Verified",
        expiresAt: c.expires || c.dueDate || "—",
        supplier: c.supplier || "—",
        location: c.location || "—",
      }));
    }
    // Fall back to synthesized rows from WORKERS so the table renders
    return (window.WORKERS || []).slice(0, 24).map((w, i) => ({
      worker: w.name,
      credential: ["I-9", "Drug screen", "OSHA-10", "Background check", "Forklift cert"][i % 5],
      status: (i % 7 === 0) ? "Expiring" : (i % 11 === 0) ? "Expired" : "Verified",
      expiresAt: "2026-" + String(6 + (i % 6)).padStart(2, "0") + "-15",
      supplier: ((window.REQ_SUPPLIERS || {})[w.supplier] || {}).label || w.supplier || "—",
      location: w.location || "—",
    }));
  }

  return [];
}

// ----- KPIs across the loaded rows -----------------------------------
function arSummary(report, rows) {
  const n = rows.length;
  if (!n) return [{ label: "Rows", value: "0" }];
  if (report.module === "spend") {
    const total = rows.reduce((s, r) => s + (Number(r.amount) || 0), 0);
    const committed = rows.reduce((s, r) => s + (Number(r.committed) || 0), 0);
    return [
      { label: "Rows", value: String(n) },
      { label: "Total spend", value: "$" + Math.round(total).toLocaleString() },
      { label: "Committed", value: "$" + Math.round(committed).toLocaleString() },
      { label: "Avg per row", value: "$" + Math.round(total / n).toLocaleString() },
    ];
  }
  if (report.module === "shift") {
    const booked = rows.reduce((s, r) => s + (Number(r.booked) || 0), 0);
    const filled = rows.reduce((s, r) => s + (Number(r.filled) || 0), 0);
    return [
      { label: "Rows", value: String(n) },
      { label: "Booked", value: booked.toLocaleString() },
      { label: "Filled", value: filled.toLocaleString() },
      { label: "Fill rate", value: Math.round(filled / Math.max(1, booked) * 100) + "%" },
    ];
  }
  if (report.module === "worker") {
    const active = rows.filter((r) => r.status === "Active" || r.status === "On Assignment").length;
    return [
      { label: "Workers", value: String(n) },
      { label: "Active", value: String(active) },
      { label: "On leave", value: String(rows.filter((r) => r.status === "On Leave").length) },
      { label: "Suppliers", value: String(new Set(rows.map((r) => r.supplier)).size) },
    ];
  }
  if (report.module === "supplier") {
    const totalWorkers = rows.reduce((s, r) => s + (Number(r.workers) || 0), 0);
    return [
      { label: "Suppliers", value: String(n) },
      { label: "Workers on assignment", value: totalWorkers.toLocaleString() },
      { label: "Avg fill rate", value: Math.round(rows.reduce((s, r) => s + (parseFloat(r.fillRate) || 0), 0) / n) + "%" },
      { label: "Tiers", value: String(new Set(rows.map((r) => r.tier)).size) },
    ];
  }
  if (report.module === "invoice") {
    const open = rows.filter((r) => r.status === "Open" || r.status === "Overdue").length;
    return [
      { label: "Invoices", value: String(n) },
      { label: "Open", value: String(open) },
      { label: "Overdue", value: String(rows.filter((r) => r.status === "Overdue").length) },
      { label: "Disputed", value: String(rows.filter((r) => r.status === "Disputed").length) },
    ];
  }
  if (report.module === "timesheet") {
    const pending = rows.filter((r) => r.status === "Pending Approval" || r.status === "Review").length;
    return [
      { label: "Timesheets", value: String(n) },
      { label: "Pending", value: String(pending) },
      { label: "Approved", value: String(rows.filter((r) => r.status === "Approved").length) },
      { label: "Suppliers", value: String(new Set(rows.map((r) => r.supplier)).size) },
    ];
  }
  if (report.module === "requisition") {
    const open = rows.filter((r) => (r.status || "").toLowerCase() === "open" || r.status === "Active").length;
    return [
      { label: "Requisitions", value: String(n) },
      { label: "Open", value: String(open) },
      { label: "Filled", value: rows.reduce((s, r) => s + (Number(r.filled) || 0), 0).toLocaleString() },
      { label: "Sites", value: String(new Set(rows.map((r) => r.location)).size) },
    ];
  }
  if (report.module === "compliance") {
    return [
      { label: "Records", value: String(n) },
      { label: "Verified", value: String(rows.filter((r) => r.status === "Verified").length) },
      { label: "Expiring", value: String(rows.filter((r) => r.status === "Expiring").length) },
      { label: "Expired", value: String(rows.filter((r) => r.status === "Expired").length) },
    ];
  }
  return [{ label: "Rows", value: String(n) }];
}

// Grid template for the reports list — mirrors the Everest list-table
// (req-row) pattern: Report · Type · Source · actions.
const AR_RT_GRID = { gridTemplateColumns: "minmax(260px, 2fr) 180px 140px 56px" };

// =====================================================================
// Library view — Everest list table (req-table-card) with quick filters
// and pagination. Filters (Type / Source / Status) are FilterChips wired
// through the shared useFilters hook, exactly like Workforce + Suppliers.
// =====================================================================
function ArLibrary({ query, setQuery, onRun, onBuild, onEdit, customs, onDelete }) {
  const FilterChip = window.FilterChip;
  const Pagination = window.Pagination;
  const flt = window.useFilters({ type: [], source: [] });
  const [page, setPage] = useStateAR(1);
  const [pageSize, setPageSize] = useStateAR(10);

  // Universe = standard + custom, decorated with the display attributes
  // the columns and quick filters key off.
  const decorated = useMemoAR(() => {
    const std = AR_STANDARD.map((r) => ({ ...r, kind: "standard" }));
    const cus = (customs || []).map((r) => ({ ...r, kind: "custom" }));
    return std.concat(cus).map((r) => {
      const mod = AR_MODULES[r.module] || {};
      return {
        ...r,
        _typeLabel: mod.label || "—",
        _source: r.kind === "custom" ? "Custom" : "Standard",
      };
    });
  }, [customs]);

  const filtered = useMemoAR(() => {
    let list = window.applyFilters(decorated, flt.filters, {
      type: (r, vals) => vals.includes(r._typeLabel),
      source: (r, vals) => vals.includes(r._source),
    });
    const q = (query || "").trim().toLowerCase();
    if (q) {
      list = list.filter((r) =>
        (r.name || "").toLowerCase().includes(q) ||
        (r.blurb || "").toLowerCase().includes(q) ||
        (r._typeLabel || "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [decorated, flt.filters, query]);

  // Snap back to page 1 whenever the result set changes.
  useEffectAR(() => { setPage(1); }, [flt.filters, query, pageSize]);

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const pageRows = useMemoAR(() => {
    const startIdx = (page - 1) * pageSize;
    return filtered.slice(startIdx, startIdx + pageSize);
  }, [filtered, page, pageSize]);

  function rowMenu(e, r) {
    e.stopPropagation();
    const items = [
      { icon: "Bolt", label: "Run report", onClick: () => onRun(r) },
      { icon: "Calendar", label: "Schedule…", onClick: () => onEdit(r, "schedule") },
      { icon: "Copy", label: "Duplicate", onClick: () => onEdit(r, "duplicate") },
    ];
    if (r.kind === "custom") {
      items.push({ icon: "Edit", label: "Edit report", onClick: () => onEdit(r, "edit") });
      items.push({ divider: true });
      items.push({ icon: "Cancel", label: "Delete report", danger: true,
        onClick: () => openConfirm({
          title: `Delete ${r.name}?`,
          body: "This custom report will be removed for you. Scheduled deliveries will stop.",
          primaryLabel: "Delete",
          onConfirm: () => onDelete(r.id),
        }) });
    } else {
      items.push({ divider: true });
      items.push({ icon: "FileDownload", label: "Export definition", onClick: () => showToast(`${r.name} definition exported (JSON)`, { kind: "success" }) });
    }
    openMenu(e.currentTarget, items);
  }

  const TYPE_OPTS = Object.values(AR_MODULES).map((m) => m.label);

  return (
    <React.Fragment>
      <div className="inv-toolbar ar-rt-toolbar">
        <div className="inv-search">
          <span className="inv-search-icon" aria-hidden="true"><Icon name="Search" size={24} /></span>
          <input
            type="search"
            className="inv-search-input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search reports"
            aria-label="Search reports"
          />
        </div>
        <div className="inv-toolbar-actions">
          <button type="button" className="vms-btn vms-btn--primary ar-rt-new" onClick={onBuild}>
            <Icon name="AddCircle" size={18} />New report
          </button>
        </div>
      </div>

      <div className="req-table-card ar-rt-card" role="table" aria-label="Reports">
        <div className="req-filters">
          <div className="req-filters-left">
            <FilterChip label="Type"   active={flt.filters.type.length > 0}   count={flt.filters.type.length}   onClick={flt.openFor("type",   "Type",   TYPE_OPTS)} />
            <FilterChip label="Source" active={flt.filters.source.length > 0} count={flt.filters.source.length} onClick={flt.openFor("source", "Source", ["Standard", "Custom"])} />
          </div>
          <div className="req-filters-right">
            {flt.hasAny && (
              <React.Fragment>
                <span className="req-filters-sep" aria-hidden="true">|</span>
                <button type="button" className="req-clear" onClick={flt.clearAll}>Clear all filters</button>
              </React.Fragment>
            )}
          </div>
        </div>

        <div className="req-scroll">
          <div className="req-row req-row--header" role="row" style={AR_RT_GRID}>
            <div className="req-cell" role="columnheader">Report</div>
            <div className="req-cell" role="columnheader">Type</div>
            <div className="req-cell" role="columnheader">Source</div>
            <div className="req-cell req-cell--chev" role="columnheader" aria-label=""></div>
          </div>

          <div className="req-body" role="rowgroup">
            {pageRows.length === 0 && (
              <div className="ar-rt-empty">
                <Icon name="Search" size={24} />
                <h3>No reports match these filters</h3>
                <p>Adjust the type or source filters, clear the search, or build a new report.</p>
                {flt.hasAny && (
                  <button type="button" className="vms-btn vms-btn--secondary vms-btn--sm" onClick={flt.clearAll}>Clear all filters</button>
                )}
              </div>
            )}
            {pageRows.map((r) => {
              const mod = AR_MODULES[r.module] || {};
              return (
                <div
                  key={r.id}
                  className="req-row req-row--clickable"
                  role="row"
                  style={AR_RT_GRID}
                  tabIndex={0}
                  onClick={() => onRun(r)}
                  onKeyDown={(e) => { if (e.key === "Enter") onRun(r); }}
                >
                  <div className="req-cell" role="cell">
                    <span className="ar-rt-title">{r.name}</span>
                  </div>
                  <div className="req-cell" role="cell">
                    <span className="req-chip">{r._typeLabel}</span>
                  </div>
                  <div className="req-cell" role="cell">
                    <span className={"req-pill " + (r._source === "Custom" ? "req-pill--informative" : "req-pill--default")}>{r._source}</span>
                  </div>
                  <div className="req-cell req-cell--chev" role="cell">
                    <button
                      type="button"
                      className="ar-card-more"
                      aria-label={`More actions for ${r.name}`}
                      onClick={(e) => { e.stopPropagation(); rowMenu(e, r); }}
                    >
                      <Icon name="MoreVert" size={16} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <Pagination
          page={page}
          totalPages={totalPages}
          total={total}
          pageSize={pageSize}
          onChange={setPage}
          onPageSizeChange={(n) => { setPageSize(n); setPage(1); }}
        />
      </div>
    </React.Fragment>
  );
}

// =====================================================================
// Runner view — preview rows with export bar
// =====================================================================
function ArRunner({ report, onBack, onSaveAs }) {
  // Resolve fields → ordered list of { id, label } the table renders.
  const mod = AR_MODULES[report.module] || { fields: [] };
  const resolvedFields = useMemoAR(() => {
    const ids = report.fields && report.fields.length ? report.fields : mod.fields.filter((f) => f.required || ["name", "id", "month", "supplier", "amount", "booked"].includes(f.id)).map((f) => f.id);
    return ids.map((id) => mod.fields.find((f) => f.id === id) || { id, label: id });
  }, [report, mod]);

  const rows = useMemoAR(() => arBuildRows(report), [report]);
  const summary = useMemoAR(() => arSummary(report, rows), [report, rows]);

  function exportTo(fmt) {
    showToast(`${report.name} exported as ${fmt.toUpperCase()}`, { kind: "success" });
  }
  function printReport() {
    showToast(`${report.name} sent to printer`, { kind: "success" });
  }
  function scheduleReport() {
    openMenu(document.activeElement, [
      { header: "Run this report on a schedule" },
      { icon: "Calendar", label: "Daily at 7:00 AM",     onClick: () => showToast(`${report.name} scheduled daily at 7:00 AM`, { kind: "success" }) },
      { icon: "Calendar", label: "Weekly, Monday",       onClick: () => showToast(`${report.name} scheduled weekly`, { kind: "success" }) },
      { icon: "Calendar", label: "Monthly, 1st",         onClick: () => showToast(`${report.name} scheduled monthly`, { kind: "success" }) },
      { divider: true },
      { icon: "Cancel", label: "Don't schedule",         onClick: () => showToast("Schedule cleared") },
    ]);
  }

  function fmtCell(field, row) {
    const v = row[field.id];
    if (v == null) return "—";
    return v;
  }
  function isNumeric(field) {
    return ["booked", "filled", "unfilled", "hours", "workers", "needed", "filled", "amount", "committed", "spend"].includes(field.id);
  }

  return (
    <React.Fragment>
      <div className="ar-run-head">
        <div className="ar-head-left">
          <button type="button" className="ar-run-back" onClick={onBack}>
            <Icon name="ChevronLeft" size={16} />All reports
          </button>
          <h2 className="ar-run-title">{report.name}</h2>
          <p className="ar-run-sub">
            {(mod.label || "—")} · {resolvedFields.length} fields · {rows.length} row{rows.length === 1 ? "" : "s"} · Run just now
          </p>
        </div>
        <div className="ar-run-actions">
          <button type="button" className="vms-btn vms-btn--secondary vms-btn--sm" onClick={scheduleReport}>
            <Icon name="Calendar" size={14} />Schedule
          </button>
          <button type="button" className="vms-btn vms-btn--secondary vms-btn--sm" onClick={() => onSaveAs(report)}>
            <Icon name="Save" size={14} />Save as…
          </button>
          <button
            type="button"
            className="vms-btn vms-btn--sm vms-btn--secondary"
            onClick={(e) => openMenu(e.currentTarget, [
              { header: "Export format" },
              { icon: "Excel",        label: "Excel (.xlsx)",   onClick: () => exportTo("xlsx") },
              { icon: "Excel",        label: "CSV (.csv)",      onClick: () => exportTo("csv") },
              { icon: "PDF",          label: "PDF",             onClick: () => exportTo("pdf") },
              { divider: true },
              { icon: "FileDownload", label: "Print preview",   onClick: printReport },
            ])}
          >
            <Icon name="FileDownload" size={14} />Export
          </button>
          <button type="button" className="vms-btn vms-btn--primary vms-btn--sm" onClick={() => showToast("Report refreshed", { kind: "success" })}>
            <Icon name="Refresh" size={14} />Refresh
          </button>
        </div>
      </div>

      <div className="ar-kpis">
        {summary.map((k) => (
          <div key={k.label} className="ar-kpi">
            <span className="ar-kpi-label">{k.label}</span>
            <span className="ar-kpi-value">{k.value}</span>
          </div>
        ))}
      </div>

      <div className="ar-applied">
        <span className="ar-applied-label">Applied filters</span>
        {report.appliedFilters && report.appliedFilters.length ? (
          report.appliedFilters.map((f, i) => (
            <span key={i} className="ar-applied-chip">{f.label}: {f.value}</span>
          ))
        ) : (
          <span className="ar-applied-chip">All scopes</span>
        )}
      </div>

      <div className="ar-table-wrap">
        <div className="ar-table-scroll">
          <table className="ar-table">
            <thead>
              <tr>
                {resolvedFields.map((f) => (
                  <th key={f.id} className={isNumeric(f) ? "num" : ""}>{f.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i}>
                  {resolvedFields.map((f) => (
                    <td key={f.id} className={isNumeric(f) ? "num" : ""}>{fmtCell(f, row)}</td>
                  ))}
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={resolvedFields.length} style={{ textAlign: "center", padding: 32, color: "var(--evr-content-primary-lowemp)" }}>
                    No rows match the active filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="ar-table-foot">
          <span>Showing {rows.length} row{rows.length === 1 ? "" : "s"} · {resolvedFields.length} columns</span>
          <span>Source: {mod.label || "—"} · Generated just now</span>
        </div>
      </div>
    </React.Fragment>
  );
}

// =====================================================================
// Builder side panel (custom report definition)
// =====================================================================
function ArBuilderPanel({ open, initial, mode, onClose, onSave }) {
  // Lazy-init working state from `initial` (when editing/duplicating).
  const seed = initial && (mode === "edit" || mode === "duplicate") ? initial : null;
  const [name, setName] = useStateAR(seed ? (mode === "duplicate" ? `${seed.name} (copy)` : seed.name) : "");
  const [desc, setDesc] = useStateAR(seed?.blurb || "");
  const [moduleId, setModuleId] = useStateAR(seed?.module || "worker");
  const [fields, setFields] = useStateAR(seed?.fields || ["name", "supplier", "status"]);
  const [filters, setFilters] = useStateAR(seed?.appliedFilters || []);
  const [format, setFormat] = useStateAR(seed?.format || "xlsx");
  const [schedule, setSchedule] = useStateAR(seed?.schedule || "off");
  const [expanded, setExpanded] = useStateAR("basics");

  // Reset on open or initial change
  useEffectAR(() => {
    if (!open) return;
    const s = initial && (mode === "edit" || mode === "duplicate") ? initial : null;
    setName(s ? (mode === "duplicate" ? `${s.name} (copy)` : s.name) : "");
    setDesc(s?.blurb || "");
    setModuleId(s?.module || "worker");
    setFields(s?.fields || ["name", "supplier", "status"]);
    setFilters(s?.appliedFilters || []);
    setFormat(s?.format || "xlsx");
    setSchedule(s?.schedule || "off");
    setExpanded("basics");
  }, [open, initial, mode]);

  // Esc closes
  useEffectAR(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape") onClose && onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // When base module changes, drop fields/filters not in the new module.
  useEffectAR(() => {
    const mod = AR_MODULES[moduleId];
    if (!mod) return;
    const validIds = new Set(mod.fields.map((f) => f.id));
    setFields((cur) => {
      const next = cur.filter((id) => validIds.has(id));
      if (next.length === 0) {
        return mod.fields.filter((f) => f.required).map((f) => f.id);
      }
      return next;
    });
    setFilters((cur) => cur.filter((f) => mod.filters.some((mf) => mf.id === f.id)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moduleId]);

  const mod = AR_MODULES[moduleId] || { fields: [], filters: [] };
  const available = mod.fields.filter((f) => !fields.includes(f.id));
  const selectedOrdered = fields.map((id) => mod.fields.find((f) => f.id === id)).filter(Boolean);

  function addField(id) { setFields((cur) => cur.includes(id) ? cur : cur.concat([id])); }
  function removeField(id) {
    const f = mod.fields.find((x) => x.id === id);
    if (f && f.required) { showToast(`${f.label} is required for this base module`); return; }
    setFields((cur) => cur.filter((x) => x !== id));
  }
  function moveField(id, dir) {
    setFields((cur) => {
      const i = cur.indexOf(id);
      if (i < 0) return cur;
      const j = i + dir;
      if (j < 0 || j >= cur.length) return cur;
      const next = cur.slice();
      next.splice(i, 1);
      next.splice(j, 0, id);
      return next;
    });
  }
  function addFilter() {
    const first = mod.filters[0];
    if (!first) { showToast("This module has no filters"); return; }
    const def = first.values ? first.values[0] : "—";
    setFilters((cur) => cur.concat([{ id: first.id, op: "is", value: def }]));
  }
  function updateFilter(i, patch) {
    setFilters((cur) => cur.map((f, idx) => idx === i ? { ...f, ...patch } : f));
  }
  function removeFilter(i) {
    setFilters((cur) => cur.filter((_, idx) => idx !== i));
  }

  // Resolve dynamic filter values (suppliers / locations) from window data.
  function valuesFor(filterDef) {
    if (filterDef.values) return filterDef.values;
    if (filterDef.dynamic === "suppliers") {
      return ["All"].concat((window.SUPPLIERS || []).filter((s) => s.status === "Active").map((s) => s.name));
    }
    if (filterDef.dynamic === "locations") {
      return ["All"].concat((window.LOCATIONS || []).filter((l) => l.status === "Active").map((l) => l.name));
    }
    return [];
  }

  // Step summaries shown next to the head when collapsed
  const moduleSummary = mod.label || "—";
  const fieldsSummary = fields.length ? `${fields.length} field${fields.length === 1 ? "" : "s"}` : "Pick at least one field";
  const filtersSummary = filters.length ? `${filters.length} filter${filters.length === 1 ? "" : "s"}` : "All rows";
  const outputSummary = `${format.toUpperCase()}${schedule !== "off" ? " · " + schedule : ""}`;

  function attemptSave(runAfter) {
    if (!name.trim()) { showToast("Name your report before saving"); setExpanded("basics"); return; }
    if (!fields.length) { showToast("Pick at least one field"); setExpanded("fields"); return; }
    const appliedFilters = filters.map((f) => {
      const def = mod.filters.find((x) => x.id === f.id) || {};
      return { id: f.id, label: def.label || f.id, value: f.value };
    });
    const def = {
      id: (seed && mode === "edit") ? seed.id : ("cu-" + Date.now().toString(36)),
      kind: "custom",
      category: "Custom",
      module: moduleId,
      name: name.trim(),
      blurb: desc.trim() || `${name.trim()} · ${moduleSummary}`,
      fields: fields.slice(),
      appliedFilters,
      format,
      schedule,
      updatedAt: new Date().toISOString(),
    };
    onSave(def, { mode, runAfter });
  }

  const title = mode === "edit" ? "Edit report" : mode === "duplicate" ? "Duplicate report" : "New report";

  return (
    <React.Fragment>
      <div className={"scrim" + (open ? " open" : "")} onClick={onClose} aria-hidden="true" />
      <aside
        className={"side-panel ar-builder" + (open ? " open" : "")}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        aria-hidden={!open}
      >
        <header className="sp-head">
          <h2>{title}</h2>
          <button type="button" className="iconbtn" onClick={onClose} aria-label="Close">
            <Icon name="X" size={20} />
          </button>
        </header>
        <div className="sp-body">
          {/* Step 1 — Basics */}
          <Step
            num={1}
            done={!!name.trim()}
            title="Basics"
            summary={name.trim() || "Untitled report"}
            open={expanded === "basics"}
            onToggle={() => setExpanded((c) => c === "basics" ? "" : "basics")}
          >
            <label className="ar-bd-label" htmlFor="ar-bd-name">Report name</label>
            <input id="ar-bd-name" className="ar-bd-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Weekly fill rate by site" />
            <label className="ar-bd-label" htmlFor="ar-bd-desc">Description <span style={{ fontWeight: "var(--evr-fw-regular)" }}>(optional)</span></label>
            <textarea id="ar-bd-desc" className="ar-bd-textarea" value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="What this report shows and who it's for." />
          </Step>

          {/* Step 2 — Report type */}
          <Step
            num={2}
            done={!!moduleId}
            title="Type"
            summary={moduleSummary}
            open={expanded === "module"}
            onToggle={() => setExpanded((c) => c === "module" ? "" : "module")}
          >
            <p style={{ margin: 0, font: "var(--evr-body2)", color: "var(--evr-content-primary-lowemp)" }}>
              The report type decides which fields are available. Pick the surface closest to what you want to count — e.g. <i>Invoices</i> for AP aging, <i>Time</i> for approvals.
            </p>
            <label className="ar-bd-label" htmlFor="ar-bd-type" style={{ marginTop: 8 }}>Report type</label>
            <select
              id="ar-bd-type"
              className="ar-bd-select"
              value={moduleId}
              onChange={(e) => setModuleId(e.target.value)}
            >
              {Object.values(AR_MODULES).map((m) => (
                <option key={m.id} value={m.id}>{m.label}</option>
              ))}
            </select>
          </Step>

          {/* Step 3 — Fields */}
          <Step
            num={3}
            done={fields.length > 0}
            title="Fields"
            summary={fieldsSummary}
            open={expanded === "fields"}
            onToggle={() => setExpanded((c) => c === "fields" ? "" : "fields")}
          >
            <p style={{ margin: 0, font: "var(--evr-body2)", color: "var(--evr-content-primary-lowemp)" }}>
              Click a field on the left to add it to the report. Drag-style reorder via the arrows on the right column.
            </p>
            <div className="ar-bd-dual">
              <div className="ar-bd-list">
                <div className="ar-bd-list-head">
                  <span>Available</span>
                  <span>{available.length}</span>
                </div>
                <div className="ar-bd-list-body">
                  {available.length === 0 && (
                    <div style={{ padding: "10px 8px", font: "var(--evr-caption)", color: "var(--evr-content-primary-lowemp)" }}>All fields added.</div>
                  )}
                  {available.map((f) => (
                    <button key={f.id} type="button" className="ar-bd-field ar-bd-field--add" onClick={() => addField(f.id)}>
                      <Icon name="AddCircle" size={14} />
                      <span>{f.label}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="ar-bd-list">
                <div className="ar-bd-list-head">
                  <span>Selected (in order)</span>
                  <span>{selectedOrdered.length}</span>
                </div>
                <div className="ar-bd-list-body">
                  {selectedOrdered.length === 0 && (
                    <div style={{ padding: "10px 8px", font: "var(--evr-caption)", color: "var(--evr-content-primary-lowemp)" }}>Pick a field from the left.</div>
                  )}
                  {selectedOrdered.map((f, i) => (
                    <div key={f.id} className="ar-bd-field" style={{ paddingRight: 4 }}>
                      <span className="ar-bd-field-ord">{i + 1}</span>
                      <span style={{ flex: 1 }}>{f.label}{f.required && <span style={{ color: "var(--evr-content-primary-lowemp)", marginLeft: 6, fontSize: 11 }}>required</span>}</span>
                      <button type="button" className="iconbtn iconbtn--sm" aria-label="Move up" disabled={i === 0} onClick={() => moveField(f.id, -1)}>
                        <Icon name="ChevronUp" size={14} />
                      </button>
                      <button type="button" className="iconbtn iconbtn--sm" aria-label="Move down" disabled={i === selectedOrdered.length - 1} onClick={() => moveField(f.id, 1)}>
                        <Icon name="ChevronDown" size={14} />
                      </button>
                      {!f.required && (
                        <button type="button" className="iconbtn iconbtn--sm" aria-label={`Remove ${f.label}`} onClick={() => removeField(f.id)}>
                          <Icon name="X" size={14} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Step>

          {/* Step 4 — Filters */}
          <Step
            num={4}
            done={true}
            title="Filters"
            summary={filtersSummary}
            open={expanded === "filters"}
            onToggle={() => setExpanded((c) => c === "filters" ? "" : "filters")}
          >
            <p style={{ margin: 0, font: "var(--evr-body2)", color: "var(--evr-content-primary-lowemp)" }}>
              Limit the report to a subset. Filters apply on the fly when the report runs — they don't change the underlying data.
            </p>
            {filters.length === 0 && (
              <div style={{ padding: 12, border: "1px dashed var(--evr-border-decorative-default)", borderRadius: 8, font: "var(--evr-body2)", color: "var(--evr-content-primary-lowemp)", textAlign: "center" }}>
                No filters — all rows from {moduleSummary.toLowerCase()} will be included.
              </div>
            )}
            {filters.map((f, i) => {
              const def = mod.filters.find((x) => x.id === f.id) || mod.filters[0];
              const vals = valuesFor(def);
              return (
                <div key={i} className="ar-bd-filter">
                  <select value={f.id} onChange={(e) => updateFilter(i, { id: e.target.value, value: (valuesFor(mod.filters.find((x) => x.id === e.target.value))[0] || "") })}>
                    {mod.filters.map((mf) => <option key={mf.id} value={mf.id}>{mf.label}</option>)}
                  </select>
                  <select value={f.op || "is"} onChange={(e) => updateFilter(i, { op: e.target.value })}>
                    <option value="is">is</option>
                    <option value="isNot">is not</option>
                    <option value="contains">contains</option>
                  </select>
                  <select value={f.value} onChange={(e) => updateFilter(i, { value: e.target.value })}>
                    {vals.map((v) => <option key={v} value={v}>{v}</option>)}
                  </select>
                  <button type="button" className="ar-bd-filter-x" aria-label="Remove filter" onClick={() => removeFilter(i)}>
                    <Icon name="X" size={14} />
                  </button>
                </div>
              );
            })}
            <button type="button" className="vms-btn vms-btn--secondary vms-btn--sm" onClick={addFilter} style={{ alignSelf: "flex-start" }}>
              <Icon name="AddCircle" size={14} />Add filter
            </button>
          </Step>

          {/* Step 5 — Output */}
          <Step
            num={5}
            done={true}
            title="Output & schedule"
            summary={outputSummary}
            open={expanded === "output"}
            onToggle={() => setExpanded((c) => c === "output" ? "" : "output")}
          >
            <label className="ar-bd-label">Default export format</label>
            <div className="ar-bd-formats">
              {[
                { id: "xlsx",  label: "Excel",       ext: "XLSX", icon: "Excel" },
                { id: "csv",   label: "CSV",         ext: "CSV",  icon: "Excel" },
                { id: "pdf",   label: "PDF",         ext: "PDF",  icon: "PDF" },
                { id: "view",  label: "View only",   ext: "Web",  icon: "View" },
              ].map((opt) => (
                <button key={opt.id} type="button" className={"ar-bd-fmt" + (format === opt.id ? " is-on" : "")} onClick={() => setFormat(opt.id)}>
                  <Icon name={opt.icon} size={14} />
                  <span>{opt.label}</span>
                  <span className="ar-bd-fmt-ext">{opt.ext}</span>
                </button>
              ))}
            </div>
            <label className="ar-bd-label" style={{ marginTop: 8 }}>Run on a schedule</label>
            <div className="ar-bd-sched">
              <select value={schedule} onChange={(e) => setSchedule(e.target.value)}>
                <option value="off">Don't schedule</option>
                <option value="Daily">Daily</option>
                <option value="Weekly">Weekly (Monday)</option>
                <option value="Bi-weekly">Bi-weekly</option>
                <option value="Monthly">Monthly (1st)</option>
              </select>
              {schedule !== "off" && (
                <span style={{ font: "var(--evr-caption)", color: "var(--evr-content-primary-lowemp)" }}>
                  Delivered to your email and the Scheduled tab as {format.toUpperCase()}.
                </span>
              )}
            </div>
          </Step>
        </div>
        <footer className="sp-foot">
          <button type="button" className="vms-btn vms-btn--secondary" onClick={onClose}>Cancel</button>
          <div style={{ flex: 1 }} />
          <button type="button" className="vms-btn vms-btn--secondary" onClick={() => attemptSave(false)}>
            <Icon name="Save" size={14} />Save
          </button>
          <button type="button" className="vms-btn vms-btn--primary" onClick={() => attemptSave(true)}>
            <Icon name="Bolt" size={14} />Save & run
          </button>
        </footer>
      </aside>
    </React.Fragment>
  );
}

function Step({ num, done, title, summary, open, onToggle, children }) {
  return (
    <div className={"ar-bd-step" + (done ? " ar-bd-step--done" : "")}>
      <button type="button" className="ar-bd-step-head" onClick={onToggle} aria-expanded={open} style={{ width: "100%", appearance: "none", background: "transparent", border: 0, cursor: "pointer", textAlign: "left" }}>
        <span className="ar-bd-step-title">
          <span className="ar-bd-step-num">{done ? <Icon name="Check" size={12} /> : num}</span>
          {title}
        </span>
        <span className="ar-bd-step-summary">{summary}</span>
        <Icon name={open ? "ChevronUp" : "ChevronDown"} size={16} />
      </button>
      {open && <div className="ar-bd-step-body">{children}</div>}
    </div>
  );
}

// =====================================================================
// Reports tab host — owns scope / runner / builder state
// =====================================================================
function AnalyticsReports() {
  const [scope, setScope] = useStateAR("all");
  const [query, setQuery] = useStateAR("");
  const [customs, setCustoms] = useStateAR(() => arLoadCustom());
  const [recents, setRecents] = useStateAR(() => arLoadRecent());
  const [starred, setStarred] = useStateAR(() => new Set(arLoadCustom().filter((r) => r.starred).map((r) => r.id)));
  const [active, setActive] = useStateAR(null); // currently-running report
  const [builder, setBuilder] = useStateAR({ open: false, initial: null, mode: "new" });

  function persistCustoms(next) {
    setCustoms(next);
    arSaveCustom(next);
  }
  function handleRun(r) {
    setActive(r);
    arPushRecent(r.id);
    setRecents(arLoadRecent());
  }
  function handleBuild() {
    setBuilder({ open: true, initial: null, mode: "new" });
  }
  function handleEdit(r, kind) {
    if (kind === "schedule") {
      openMenu(document.activeElement, [
        { header: `Schedule "${r.name}"` },
        { icon: "Calendar", label: "Daily at 7:00 AM", onClick: () => updateSchedule(r, "Daily") },
        { icon: "Calendar", label: "Weekly (Monday)",  onClick: () => updateSchedule(r, "Weekly") },
        { icon: "Calendar", label: "Bi-weekly",         onClick: () => updateSchedule(r, "Bi-weekly") },
        { icon: "Calendar", label: "Monthly (1st)",     onClick: () => updateSchedule(r, "Monthly") },
        { divider: true },
        { icon: "Cancel", label: "Clear schedule", onClick: () => updateSchedule(r, "off") },
      ]);
      return;
    }
    setBuilder({ open: true, initial: r, mode: kind });
  }
  function updateSchedule(r, when) {
    if (r.kind === "custom") {
      const next = customs.map((x) => x.id === r.id ? { ...x, schedule: when } : x);
      persistCustoms(next);
      showToast(when === "off" ? "Schedule cleared" : `${r.name} scheduled ${when.toLowerCase()}`, { kind: "success" });
    } else {
      // Materialize a custom copy with the schedule attached
      const def = { ...r, kind: "custom", id: "cu-" + Date.now().toString(36), category: "Custom", schedule: when, blurb: r.blurb };
      persistCustoms(customs.concat([def]));
      showToast(`Scheduled — saved as a custom report (${when.toLowerCase()})`, { kind: "success" });
    }
  }
  function handleDelete(id) {
    const next = customs.filter((r) => r.id !== id);
    persistCustoms(next);
    showToast("Report deleted");
  }
  function handleSave(def, { mode, runAfter }) {
    let next;
    if (mode === "edit") {
      next = customs.map((r) => r.id === def.id ? def : r);
    } else {
      // new or duplicate
      next = customs.concat([def]);
    }
    persistCustoms(next);
    setBuilder({ open: false, initial: null, mode: "new" });
    showToast(mode === "edit" ? "Report updated" : "Report saved", { kind: "success" });
    if (runAfter) {
      arPushRecent(def.id);
      setRecents(arLoadRecent());
      setActive(def);
    }
  }
  function handleSaveAs(r) {
    setBuilder({ open: true, initial: r, mode: "duplicate" });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {active ? (
        <ArRunner report={active} onBack={() => setActive(null)} onSaveAs={handleSaveAs} />
      ) : (
        <ArLibrary
          scope={scope}
          setScope={setScope}
          query={query}
          setQuery={setQuery}
          customs={customs}
          recents={recents}
          starred={starred}
          setStarred={setStarred}
          onRun={handleRun}
          onBuild={handleBuild}
          onEdit={handleEdit}
          onDelete={handleDelete}
        />
      )}
      <ArBuilderPanel
        open={builder.open}
        initial={builder.initial}
        mode={builder.mode}
        onClose={() => setBuilder({ open: false, initial: null, mode: "new" })}
        onSave={handleSave}
      />
    </div>
  );
}

Object.assign(window, { AnalyticsReports, AR_STANDARD, AR_MODULES });
