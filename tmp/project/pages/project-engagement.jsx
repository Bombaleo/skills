// =====================================================================
// Flex Work — Project engagement type · primitives, storage, components
//
// One module. Owns every Project-specific data structure and React
// component the rest of the app pulls in. Nothing here renders or
// activates unless engProject is on.
//
//   Public API on window:
//     PSProjects.getAll() · get(id) · save(p) · listEnabled()
//     PSProjects.config()  · saveConfig(c)
//     PSProjects.STATES · TRANSITIONS · stateMeta(stateId)
//     PSProjects.helpers · burnPct · ntePct · daysRemaining · …
//     <ProjectAdminPanel/>          → Settings → Configuration
//     <ProjectIntakeFields/>        → New requisition (engType=Project)
//     <ProjectVariantBody/>         → Unified detail router (PRJ-)
//     <ProjectListFilter/>          → Project chip-bar on Reqs list
//     <ProjectTimesheetWeeklyView/> → Timesheets, weekly burn approval
//     <AgencyProjectsTab/>          → Agency Pro · Projects tab
//     <WorkerProjectScreen/>        → Worker mobile · Projects screen
//
// Storage:
//   flexwork.projects.{orgId}             — array of project records
//   flexwork.projectConfig.{orgId}        — per-org admin config
//   Re-seeded for Helios (energy) with four sample projects on first
//   load; other orgs start empty.
//
// Gate:
//   Everything is wrapped behind getFeatureFlag("engProject"). With the
//   flag off, no panel renders, no chip appears, no variant registers.
// =====================================================================

(function () {
  const { useState, useEffect, useMemo } = React;

  // -----------------------------------------------------------------
  // Storage keys
  // -----------------------------------------------------------------
  const PRJ_STORE_PREFIX = "flexwork.projects.v2.";
  const PRJ_CONFIG_PREFIX = "flexwork.projectConfig.v2.";

  function _orgId() {
    return (window.getCurrentIndustryId && window.getCurrentIndustryId()) || "frontline";
  }
  function _projectsKey(orgId) { return PRJ_STORE_PREFIX + (orgId || _orgId()); }
  function _configKey(orgId)   { return PRJ_CONFIG_PREFIX + (orgId || _orgId()); }

  // -----------------------------------------------------------------
  // Feature-flag gate
  // -----------------------------------------------------------------
  function isProjectOn() {
    return !!(window.getFeatureFlag && window.getFeatureFlag("engProject"));
  }
  function useProjectOn() {
    if (window.useFeatureFlag) return window.useFeatureFlag("engProject");
    const [v, setV] = useState(isProjectOn());
    useEffect(() => {
      function onChange() { setV(isProjectOn()); }
      window.addEventListener("featureflags:change", onChange);
      return () => window.removeEventListener("featureflags:change", onChange);
    }, []);
    return v;
  }

  // -----------------------------------------------------------------
  // Lifecycle state machine
  // -----------------------------------------------------------------
  const STATES = [
    { id: "draft",       label: "Draft",          tone: "neutral" },
    { id: "budget-pend", label: "Budget pending", tone: "watch"   },
    { id: "active",      label: "Active",         tone: "ok"      },
    { id: "on-hold",     label: "On hold",        tone: "warn"    },
    { id: "closing",     label: "Closing",        tone: "watch"   },
    { id: "closed",      label: "Closed",         tone: "neutral" },
    { id: "cancelled",   label: "Cancelled",      tone: "danger"  },
  ];
  const TRANSITIONS = {
    "draft":       ["budget-pend", "cancelled"],
    "budget-pend": ["active", "draft", "cancelled"],
    "active":      ["on-hold", "closing", "cancelled"],
    "on-hold":     ["active", "closing", "cancelled"],
    "closing":     ["active", "closed"],
    "closed":      [],
    "cancelled":   [],
  };
  function stateMeta(id) {
    return STATES.find((s) => s.id === id) || STATES[0];
  }

  // -----------------------------------------------------------------
  // Default per-org admin config
  // -----------------------------------------------------------------
  const DEFAULT_CONFIG = {
    numberPrefix: "PRJ",
    numberFormat: "{prefix}-{YYYY}-{####}",
    nextSeq: 27,
    externalIdRequired: true,
    externalIdValidator: "treasury-cip",

    budgetApprovalTiers: [
      { id: "t1", lt: 50000,   approvers: ["Project owner", "Department head"] },
      { id: "t2", lt: 250000,  approvers: ["Project owner", "Department head", "CFO"] },
      { id: "t3", lt: 1000000, approvers: ["Project owner", "Department head", "CFO", "CHRO"] },
      { id: "t4", lt: null,    approvers: ["Project owner", "Department head", "CFO", "CHRO", "CEO"] },
    ],

    changeOrder: {
      autoApprovePctMax: 10,
      managerApprovePctMax: 25,
      requireJustification: true,
      reasonCodes: ["Scope add", "Scope reduce", "Date extension", "Resource swap", "Rate adjustment"],
    },

    burnAlerts: {
      enabled: true,
      thresholds: [
        { id: "a1", pct: 75,  severity: "info",  notify: ["Project owner"] },
        { id: "a2", pct: 90,  severity: "warn",  notify: ["Project owner", "Department head"] },
        { id: "a3", pct: 100, severity: "error", notify: ["Project owner", "Department head", "Finance"] },
      ],
    },

    taskCatalog: [
      { id: "discovery", name: "Discovery",    billable: true },
      { id: "design",    name: "Design",       billable: true },
      { id: "build",     name: "Build",        billable: true },
      { id: "test",      name: "Test / QA",    billable: true },
      { id: "uat",       name: "UAT support",  billable: true },
      { id: "hypercare", name: "Hypercare",    billable: true },
      { id: "pm",        name: "Project mgmt", billable: true },
      { id: "training",  name: "Training",     billable: true },
      { id: "travel",    name: "Travel time",  billable: false },
    ],

    closeout: {
      requireAllTimesheetsApproved: true,
      requireAllInvoicesPaid: true,
      requireMilestonesAccepted: false,
      requireSupplierAcknowledge: true,
      sendSupplierSurvey: true,
      archiveAfterDays: 30,
    },

    supplierBurnVisibility: "summary", // hidden · summary · full

    // Resource swap policy — the reason-code list shown on the shared
    // ResourceSwapModal (Manager + Agency both pick from the same list).
    resourceSwap: {
      requireReplacement: true,
      reasonCodes: [
        "Voluntary departure",
        "Performance",
        "Illness / leave",
        "Reassigned by supplier",
        "End of need",
        "Compliance / credentialing",
      ],
    },

    // Status report cadence — default cadence for new projects.
    statusReport: {
      cadence: "weekly", // weekly | biweekly | monthly | adhoc
      autoDraft: true,
      includeBurn: true,
      includeRisks: true,
      defaultRecipients: ["Project owner", "Department head"],
    },

    rolePerms: {
      "Program owner":   { create: true,  approve: true,  amend: true,  close: true,  viewBurn: true,  swapWorkers: true  },
      "Project manager": { create: true,  approve: false, amend: true,  close: true,  viewBurn: true,  swapWorkers: true  },
      "Finance partner": { create: false, approve: true,  amend: false, close: false, viewBurn: true,  swapWorkers: false },
      "Compliance":      { create: false, approve: true,  amend: false, close: false, viewBurn: false, swapWorkers: false },
      "Site manager":    { create: false, approve: false, amend: false, close: false, viewBurn: false, swapWorkers: false },
    },
  };

  // -----------------------------------------------------------------
  // Helpers — derived metrics
  // -----------------------------------------------------------------
  function projectActualSpend(p) {
    if (!p || !p.burnLedger || !p.burnLedger.length) return 0;
    return p.burnLedger[p.burnLedger.length - 1].actual;
  }
  function projectPlannedSpend(p) {
    if (!p || !p.burnLedger || !p.burnLedger.length) return 0;
    return p.burnLedger[p.burnLedger.length - 1].planned;
  }
  function projectBurnPct(p) {
    if (!p || !p.budget) return 0;
    return (projectActualSpend(p) / p.budget) * 100;
  }
  function projectNtePct(p) {
    if (!p || !p.nte) return 0;
    return (projectActualSpend(p) / p.nte) * 100;
  }
  function totalRosterHours(p) {
    return ((p && p.roster) || []).reduce((a, r) => a + (r.hoursToDate || 0), 0);
  }
  function totalPlannedHours(p) {
    return ((p && p.roster) || []).reduce((a, r) => a + (r.plannedHours || 0), 0);
  }
  function daysRemaining(p) {
    if (!p || !p.endDate) return 0;
    const now = new Date();
    const end = new Date(p.endDate);
    return Math.max(0, Math.round((end - now) / (1000 * 60 * 60 * 24)));
  }
  function nteCushionPct(p) {
    if (!p || !p.budget || !p.nte) return 0;
    return Math.round(((p.nte - p.budget) / p.budget) * 100);
  }

  // -----------------------------------------------------------------
  // Seed data for the Helios (energy) tenant
  // -----------------------------------------------------------------
  function _burn(weeks, perWeekPlanned, drift) {
    const out = [];
    let cumPlanned = 0, cumActual = 0;
    for (let i = 1; i <= weeks; i++) {
      cumPlanned += perWeekPlanned;
      const f = 1 + (drift || 0) * Math.sin(i * 0.7) + (drift || 0) * 0.3 * Math.sin(i * 1.1);
      cumActual += perWeekPlanned * f;
      out.push({ week: i, planned: Math.round(cumPlanned), actual: Math.round(cumActual) });
    }
    return out;
  }

  const HELIOS_SEED = [
    {
      id: "PRJ-2026-018", externalId: "CIP-2026-104",
      name: "DC Alpha — WMS rollout",
      summary: "Warehouse management system rollout to the Alpha distribution centre. Discovery through hypercare. Five-stream delivery.",
      ownerName: "Maya Lin", departmentHead: "Renée Patel",
      supplier: "ap", supplierLabel: "Acme Professional", supplierLead: "Jian Ren",
      currency: "USD", budget: 850000, nte: 935000,
      startDate: "2026-01-12", endDate: "2026-09-25",
      state: "active", billingBasis: "Fixed", timeCapture: "Time Tracking",
      phases: [
        { id: "p1", name: "Discovery",   budget:  85000, startWeek: 1,  endWeek: 6  },
        { id: "p2", name: "Design",      budget: 140000, startWeek: 5,  endWeek: 14 },
        { id: "p3", name: "Build",       budget: 380000, startWeek: 12, endWeek: 28 },
        { id: "p4", name: "Test / UAT",  budget: 165000, startWeek: 24, endWeek: 34 },
        { id: "p5", name: "Hypercare",   budget:  80000, startWeek: 33, endWeek: 37 },
      ],
      roster: [
        { workerId: "p-ms", name: "Maya Soto",        role: "Senior PM",          taskId: "pm",       allocPct:  75, plannedHours: 700, hoursToDate: 412, startDate: "2026-01-12", endDate: "2026-09-25" },
        { workerId: "p-jr", name: "Jian Ren",         role: "Solution architect", taskId: "design",   allocPct:  60, plannedHours: 560, hoursToDate: 338, startDate: "2026-01-12", endDate: "2026-08-15" },
        { workerId: "p-mb", name: "Marcus Bukenya",   role: "DevOps engineer",    taskId: "build",    allocPct:  80, plannedHours: 760, hoursToDate: 520, startDate: "2026-01-26", endDate: "2026-09-10" },
        { workerId: "p-ne", name: "Nadia El-Sayed",   role: "Senior dev",         taskId: "build",    allocPct: 100, plannedHours: 940, hoursToDate: 644, startDate: "2026-02-09", endDate: "2026-09-10" },
        { workerId: "p-tk", name: "Tomás Kowalski",   role: "Senior dev",         taskId: "build",    allocPct: 100, plannedHours: 800, hoursToDate: 512, startDate: "2026-03-02", endDate: "2026-08-29" },
        { workerId: "p-pa", name: "Priya Agarwal",    role: "QA lead",            taskId: "test",     allocPct:  50, plannedHours: 380, hoursToDate: 142, startDate: "2026-04-06", endDate: "2026-09-15" },
      ],
      burnLedger: _burn(20, 36000, 0.10),
      currentWeek: 20,
      amendments: [
        { id: "AMD-001", state: "approved", reason: "Scope add",
          deltaBudget: 60000, deltaWeeks: 0,
          justification: "DC Alpha discovery surfaced a new shipping-label printing scope; added one Senior dev for six weeks during Build.",
          submittedBy: "Maya Lin", submittedAt: "2026-03-18",
          approvedBy: ["Renée Patel"], approvedAt: "2026-03-21" },
      ],
      documents: [
        { id: "d1", name: "DC Alpha SOW v2.pdf",        sizeKB: 412,  kind: "SOW",     uploadedBy: "Maya Lin",       uploadedAt: "2026-01-09" },
        { id: "d2", name: "Kickoff deck.pdf",            sizeKB: 1840, kind: "Kickoff", uploadedBy: "Jian Ren",       uploadedAt: "2026-01-14" },
        { id: "d3", name: "Risk register week 12.xlsx",  sizeKB: 76,   kind: "Status",  uploadedBy: "Maya Soto",      uploadedAt: "2026-04-04" },
        { id: "d4", name: "UAT entry criteria.pdf",      sizeKB: 188,  kind: "Plan",    uploadedBy: "Priya Agarwal",  uploadedAt: "2026-04-22" },
      ],
      comments: [
        { id: "c1", author: "Maya Soto", at: "2026-04-26",
          body: "Build phase ahead on the picker module, ~2 weeks behind on put-away. Recommend pulling Tomás onto put-away from week 19 for four weeks." },
        { id: "c2", author: "Maya Lin",  at: "2026-04-26",
          body: "Approved — please confirm Northwind has cover for the cross-allocation." },
        { id: "c3", author: "Jian Ren",  at: "2026-04-29",
          body: "Confirmed. Tomás 100% on put-away weeks 19–22. Pre-cleared with Northwind PMO." },
      ],
      // Two recent expense reports — phase + task tagged so they show
      // alongside time on the burn ledger.
      expenses: [
        { id: "e1", workerId: "p-jr", workerName: "Jian Ren", phaseId: "p2", taskId: "design",
          category: "Travel", amount: 1480, currency: "USD", description: "Discovery site visit · Alpha DC · 3 nights",
          submittedAt: "2026-02-12", state: "approved" },
        { id: "e2", workerId: "p-mb", workerName: "Marcus Bukenya", phaseId: "p3", taskId: "build",
          category: "Travel", amount: 640, currency: "USD", description: "Sprint review on-site · 1 night",
          submittedAt: "2026-04-08", state: "approved" },
        { id: "e3", workerId: "p-ne", workerName: "Nadia El-Sayed", phaseId: "p3", taskId: "build",
          category: "Equipment", amount: 215, currency: "USD", description: "Test handheld scanner for picker module",
          submittedAt: "2026-04-22", state: "pending" },
      ],
      // Status reports — auto-drafted, manager-edited, sent weekly.
      statusReports: [
        { id: "sr1", weekEnding: "2026-04-26", state: "sent",
          author: "Maya Soto", sentAt: "2026-04-27", recipients: ["Renée Patel", "Maya Lin"],
          rag: "amber",
          burnNote: "Burn 51% vs plan 49%. Pacing on Build; +2 weeks slip risk on put-away.",
          risks: ["Put-away module behind plan", "QA lead allocation thin"],
          accomplishments: ["Picker module hit feature-freeze", "UAT plan v1 signed off"],
          nextWeek: ["Cross-allocate Tomás onto put-away", "Open UAT environment"],
        },
        { id: "sr2", weekEnding: "2026-05-03", state: "draft",
          author: "Maya Soto", sentAt: null, recipients: ["Renée Patel", "Maya Lin"],
          rag: "green",
          burnNote: "Burn back in line — 53% vs plan 53%. Slip risk reduced after re-allocation.",
          risks: [],
          accomplishments: ["Put-away module integration complete", "Tomás cross-allocation effective week 1"],
          nextWeek: ["Begin UAT entry checks", "First customer demo"],
        },
      ],
      audit: [
        { at: "2026-01-09 09:12", by: "Maya Lin",      action: "Project created",     detail: "PRJ-2026-018 · budget $850K, NTE $935K." },
        { at: "2026-01-09 09:42", by: "Renée Patel",   action: "Budget approved",     detail: "Tier 2 — Department head sign-off." },
        { at: "2026-01-12 08:00", by: "system",        action: "State → Active",      detail: "Auto-transition on start date." },
        { at: "2026-03-18 14:23", by: "Maya Lin",      action: "Amendment submitted", detail: "AMD-001 · +$60K · Scope add." },
        { at: "2026-03-21 10:08", by: "Renée Patel",   action: "Amendment approved",  detail: "AMD-001 · manager threshold." },
        { at: "2026-04-15 09:00", by: "system",        action: "Burn alert · 75%",    detail: "Notified Maya Lin." },
      ],
      // Pending team-proposal request shown in supplier inbox
      teamProposal: null,
    },

    {
      id: "PRJ-2026-021", externalId: "CIP-2026-118",
      name: "Reactor Yard — sensor mesh refresh",
      summary: "Replace and re-commission the wireless sensor mesh at the Reactor Yard. Compliance-led, fixed-window outage.",
      ownerName: "Sarah Chen", departmentHead: "Renée Patel",
      supplier: "nw", supplierLabel: "Northwind Talent", supplierLead: "Tomás Kowalski",
      currency: "USD", budget: 320000, nte: 360000,
      startDate: "2026-04-06", endDate: "2026-06-26",
      state: "active", billingBasis: "Milestone", timeCapture: "Time Tracking",
      phases: [
        { id: "p1", name: "Site survey", budget:  40000, startWeek: 1, endWeek: 2 },
        { id: "p2", name: "Procurement", budget:  80000, startWeek: 1, endWeek: 4 },
        { id: "p3", name: "Install",     budget: 140000, startWeek: 4, endWeek: 10 },
        { id: "p4", name: "Commission",  budget:  60000, startWeek: 9, endWeek: 12 },
      ],
      roster: [
        { workerId: "p-tk2", name: "Tomás Kowalski",  role: "Senior dev",      taskId: "build", allocPct: 100, plannedHours: 480, hoursToDate: 188, startDate: "2026-04-06", endDate: "2026-06-26" },
        { workerId: "p-mb2", name: "Marcus Bukenya",  role: "DevOps engineer", taskId: "build", allocPct:  50, plannedHours: 240, hoursToDate:  92, startDate: "2026-04-06", endDate: "2026-06-26" },
        { workerId: "p-pa2", name: "Priya Agarwal",   role: "QA lead",         taskId: "test",  allocPct:  50, plannedHours: 240, hoursToDate:  78, startDate: "2026-04-20", endDate: "2026-06-26" },
      ],
      burnLedger: _burn(8, 27000, -0.04),
      currentWeek: 8,
      amendments: [], documents: [], comments: [], expenses: [], statusReports: [],
      audit: [
        { at: "2026-03-30 10:14", by: "Sarah Chen",  action: "Project created", detail: "PRJ-2026-021 · budget $320K, NTE $360K." },
        { at: "2026-04-02 09:30", by: "Renée Patel", action: "Budget approved", detail: "Tier 2 — Department head sign-off." },
        { at: "2026-04-06 08:00", by: "system",      action: "State → Active",  detail: "Auto-transition on start date." },
      ],
      teamProposal: null,
    },

    {
      id: "PRJ-2026-024", externalId: "CIP-2026-131",
      name: "Helios HQ — accessibility audit & remediation",
      summary: "WCAG 2.2 AA audit of the customer portal followed by a six-week remediation sprint.",
      ownerName: "Renée Patel", departmentHead: "Renée Patel",
      supplier: "bp", supplierLabel: "Bright Path Studio", supplierLead: "Jordan Cabrera",
      currency: "USD", budget: 180000, nte: 200000,
      startDate: "2026-05-18", endDate: "2026-08-14",
      state: "budget-pend", billingBasis: "Fixed", timeCapture: "Time Tracking",
      phases: [
        { id: "p1", name: "Audit",        budget: 60000,  startWeek: 1,  endWeek: 3  },
        { id: "p2", name: "Remediation",  budget: 100000, startWeek: 3,  endWeek: 11 },
        { id: "p3", name: "Verification", budget: 20000,  startWeek: 10, endWeek: 13 },
      ],
      roster: [],
      burnLedger: [{ week: 1, planned: 0, actual: 0 }],
      currentWeek: 0,
      amendments: [], documents: [], comments: [], expenses: [], statusReports: [],
      audit: [
        { at: "2026-05-14 11:20", by: "Renée Patel", action: "Project created", detail: "PRJ-2026-024 · budget $180K, NTE $200K." },
      ],
      // Open team-proposal — drives the Agency tab
      teamProposal: {
        sentAt: "2026-05-15",
        due: "2026-05-29",
        teamShape: [
          { role: "UX lead",       count: 1, allocPct: 50,  plannedHours: 260 },
          { role: "Frontend dev",  count: 2, allocPct: 100, plannedHours: 520 },
        ],
        submitted: null,
      },
    },

    {
      id: "PRJ-2026-009", externalId: "CIP-2025-098",
      name: "Substation 12 — control panel migration",
      summary: "Migrate substation 12 control panels off the legacy SCADA stack. Closed out April.",
      ownerName: "Marcus Bell", departmentHead: "Renée Patel",
      supplier: "ap", supplierLabel: "Acme Professional", supplierLead: "Maya Soto",
      currency: "USD", budget: 440000, nte: 480000,
      startDate: "2025-11-03", endDate: "2026-04-10",
      state: "closed", billingBasis: "Fixed", timeCapture: "Time Tracking",
      phases: [
        { id: "p1", name: "Design",    budget:  80000, startWeek: 1,  endWeek: 4 },
        { id: "p2", name: "Build",     budget: 220000, startWeek: 4,  endWeek: 18 },
        { id: "p3", name: "Cutover",   budget:  60000, startWeek: 17, endWeek: 22 },
        { id: "p4", name: "Stabilise", budget:  80000, startWeek: 20, endWeek: 23 },
      ],
      roster: [
        { workerId: "p-ms3", name: "Maya Soto",       role: "Senior PM",      taskId: "pm",       allocPct: 50, plannedHours: 460, hoursToDate: 458, startDate: "2025-11-03", endDate: "2026-04-10" },
        { workerId: "p-hg",  name: "Henrik Gunnarsson",role: "Data engineer", taskId: "build",    allocPct: 80, plannedHours: 740, hoursToDate: 720, startDate: "2025-11-17", endDate: "2026-04-10" },
        { workerId: "p-fs",  name: "Fatima Souza",    role: "Change manager", taskId: "training", allocPct: 30, plannedHours: 280, hoursToDate: 268, startDate: "2026-02-09", endDate: "2026-04-10" },
      ],
      burnLedger: _burn(23, 18800, 0.02),
      currentWeek: 23,
      amendments: [
        { id: "AMD-001", state: "approved", reason: "Date extension",
          deltaBudget: 0, deltaWeeks: 2,
          justification: "Cutover slipped one week due to network freeze; stabilise extended one week.",
          submittedBy: "Marcus Bell", submittedAt: "2026-03-12",
          approvedBy: ["Renée Patel"], approvedAt: "2026-03-13" },
      ],
      documents: [
        { id: "d1", name: "Substation 12 closure pack.pdf", sizeKB: 720, kind: "Closeout", uploadedBy: "Marcus Bell", uploadedAt: "2026-04-09" },
      ],
      comments: [
        { id: "c1", author: "Marcus Bell", at: "2026-04-09",
          body: "Closeout pack signed by Acme. Final invoice cleared today. Ready to archive on 9 May." },
      ],
      audit: [
        { at: "2025-11-03 08:00", by: "system",      action: "State → Active",                detail: "Auto-transition on start date." },
        { at: "2026-04-10 16:32", by: "Marcus Bell", action: "State → Closing",               detail: "Manager-initiated closeout." },
        { at: "2026-04-11 09:00", by: "Maya Soto",   action: "Supplier closeout acknowledge", detail: "Acme confirmed no further billing." },
        { at: "2026-04-11 09:01", by: "system",      action: "State → Closed",                detail: "Auto-transition on supplier ack." },
      ],
      teamProposal: null,
    },
  ];

  // -----------------------------------------------------------------
  // Storage I/O
  // -----------------------------------------------------------------
  function _read(key) {
    try { const r = localStorage.getItem(key); return r ? JSON.parse(r) : null; }
    catch (_) { return null; }
  }
  function _write(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (_) {}
  }

  function getProjects() {
    const orgId = _orgId();
    const k = _projectsKey(orgId);
    let v = _read(k);
    if (v === null) {
      v = (orgId === "energy") ? JSON.parse(JSON.stringify(HELIOS_SEED)) : [];
      _write(k, v);
    }
    return v;
  }
  function getProject(id) {
    return getProjects().find((p) => p.id === id) || null;
  }
  function saveProject(p) {
    if (!p || !p.id) return;
    const list = getProjects();
    const idx = list.findIndex((x) => x.id === p.id);
    if (idx >= 0) list[idx] = p;
    else list.unshift(p);
    _write(_projectsKey(), list);
    try { window.dispatchEvent(new Event("projects:change")); } catch (_) {}
  }
  function createProject(input) {
    const cfg = getConfig();
    const seq = cfg.nextSeq || 1;
    const yyyy = String(new Date().getFullYear());
    const id = (cfg.numberFormat || "{prefix}-{YYYY}-{####}")
      .replace("{prefix}", cfg.numberPrefix || "PRJ")
      .replace("{YYYY}", yyyy)
      .replace("{####}", String(seq).padStart(4, "0"));
    const now = new Date().toISOString().slice(0, 16).replace("T", " ");
    const p = {
      id,
      externalId: input.externalId || "",
      name: input.name,
      summary: input.summary || "",
      ownerName: input.ownerName || "Maya Lin",
      departmentHead: "Renée Patel",
      supplier: input.supplier || "ap",
      supplierLabel: input.supplierLabel || "Acme Professional",
      supplierLead: "—",
      currency: input.currency || "USD",
      budget: input.budget || 0,
      nte: input.nte || Math.round((input.budget || 0) * 1.1),
      startDate: input.startDate,
      endDate: input.endDate,
      state: "budget-pend",
      billingBasis: input.billingBasis || "Fixed",
      timeCapture: "Time Tracking",
      phases: input.phases && input.phases.length ? input.phases : [
        { id: "p1", name: "Discovery", budget: Math.round((input.budget || 0) * 0.15), startWeek: 1, endWeek: 4 },
        { id: "p2", name: "Build",     budget: Math.round((input.budget || 0) * 0.6),  startWeek: 4, endWeek: 16 },
        { id: "p3", name: "Test",      budget: Math.round((input.budget || 0) * 0.2),  startWeek: 14, endWeek: 22 },
        { id: "p4", name: "Hypercare", budget: Math.round((input.budget || 0) * 0.05), startWeek: 21, endWeek: 24 },
      ],
      roster: [],
      burnLedger: [{ week: 1, planned: 0, actual: 0 }],
      currentWeek: 0,
      amendments: [], documents: [], comments: [], expenses: [], statusReports: [],
      audit: [{ at: now, by: input.ownerName || "You", action: "Project created",
        detail: `${id} · budget ${fmtMoneyExact(input.budget || 0, input.currency || "USD")}, NTE ${fmtMoneyExact(input.nte || 0, input.currency || "USD")}.` }],
      teamProposal: null,
    };
    saveProject(p);
    saveConfig({ ...cfg, nextSeq: seq + 1 });
    return p;
  }

  function getConfig() {
    const k = _configKey();
    let v = _read(k);
    if (v === null) {
      v = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
      _write(k, v);
    } else {
      // Forward-compat: shallow-merge missing keys from defaults.
      v = { ...DEFAULT_CONFIG, ...v };
    }
    return v;
  }
  function saveConfig(c) {
    _write(_configKey(), c);
    try { window.dispatchEvent(new Event("projectconfig:change")); } catch (_) {}
  }

  // -----------------------------------------------------------------
  // Requisitions-list integration — when engProject is on, project
  // records get a thin row-projection injected into window.REQUISITIONS
  // so the existing Requisitions list shows them with the same filters,
  // pagination, and click-through navigation. Re-runs on org change,
  // flag change, and after every save.
  // -----------------------------------------------------------------
  function _projectAsReqRow(p) {
    return {
      id: p.id,
      status: p.state === "active" ? "Booked"
            : p.state === "budget-pend" ? "Approval"
            : p.state === "closed" ? "Cancelled"
            : p.state === "cancelled" ? "Cancelled"
            : "Draft",
      dates: [p.startDate || ""],
      jobs: [p.name],
      qty: (p.roster || []).length || 1,
      time: "",
      breakLabel: "",
      location: p.supplierLabel || "",
      costCenter: p.externalId || "",
      sourcingChannel: "Project",
      engagementType: "Project",
      __project: true,
    };
  }
  function _injectProjectsIntoReqs() {
    if (!isProjectOn()) return;
    if (typeof window === "undefined") return;
    const current = (window.REQUISITIONS || []);
    const baseNow = current.filter((r) => !r.__project);
    // Only stash a base snapshot once the real requisitions fixture has
    // populated. If the early-fire retry hits before requisitions.jsx
    // has run, baseNow will be empty — skip and let a later retry catch
    // it.
    if (!window.__REQUISITIONS_BASE || window.__REQUISITIONS_BASE.length === 0) {
      if (baseNow.length === 0) return; // wait for next retry
      window.__REQUISITIONS_BASE = baseNow.slice();
    }
    const projects = getProjects().map(_projectAsReqRow);
    window.REQUISITIONS = projects.concat(window.__REQUISITIONS_BASE);
  }
  function _removeProjectsFromReqs() {
    if (typeof window === "undefined") return;
    if (window.__REQUISITIONS_BASE) {
      window.REQUISITIONS = window.__REQUISITIONS_BASE.slice();
    } else if (window.REQUISITIONS) {
      window.REQUISITIONS = window.REQUISITIONS.filter((r) => !r.__project);
    }
  }
  // Defer one tick so this runs after requisitions.jsx has set up
  // window.REQUISITIONS.
  if (typeof window !== "undefined") {
    // Babel scripts evaluate async, so a plain setTimeout(0) is too
    // early — requisitions.jsx may not have assigned window.REQUISITIONS
    // yet. Wait for `load` (or fire immediately if already loaded), and
    // schedule a couple of retries to win against any later overwrites
    // (industry localization, temp-spend scaling, etc.) that touch the
    // array on first render.
    function _scheduleInject() {
      const tries = [50, 250, 750];
      tries.forEach((ms) => setTimeout(_injectProjectsIntoReqs, ms));
    }
    if (document.readyState === "complete") {
      _scheduleInject();
    } else {
      window.addEventListener("load", _scheduleInject);
    }
    window.addEventListener("projects:change", _injectProjectsIntoReqs);
    window.addEventListener("featureflags:change", () => {
      if (isProjectOn()) _injectProjectsIntoReqs();
      else _removeProjectsFromReqs();
    });
    window.addEventListener("industry:change", () => {
      // Reset the base snapshot on org change so the next inject picks
      // up the new tenant's reqs, then re-inject.
      delete window.__REQUISITIONS_BASE;
      _scheduleInject();
    });
  }

  // Live hooks (re-render on org / data change)
  function useProjects() {
    const [v, setV] = useState(getProjects);
    useEffect(() => {
      function onChange() { setV(getProjects()); }
      window.addEventListener("projects:change", onChange);
      window.addEventListener("featureflags:change", onChange);
      window.addEventListener("industry:change", onChange);
      return () => {
        window.removeEventListener("projects:change", onChange);
        window.removeEventListener("featureflags:change", onChange);
        window.removeEventListener("industry:change", onChange);
      };
    }, []);
    return v;
  }
  function useProject(id) {
    const all = useProjects();
    return useMemo(() => all.find((p) => p.id === id) || null, [all, id]);
  }
  function useConfig() {
    const [v, setV] = useState(getConfig);
    useEffect(() => {
      function onChange() { setV(getConfig()); }
      window.addEventListener("projectconfig:change", onChange);
      window.addEventListener("industry:change", onChange);
      return () => {
        window.removeEventListener("projectconfig:change", onChange);
        window.removeEventListener("industry:change", onChange);
      };
    }, []);
    return v;
  }

  // -----------------------------------------------------------------
  // Currency + number formatting (kept local; copies the style used
  // in invoices-engagement-types so output matches across surfaces).
  // -----------------------------------------------------------------
  const CCY_SYM = { USD: "$", EUR: "€", GBP: "£", CAD: "C$", AUD: "A$" };
  function fmtMoney(n, ccy) {
    ccy = ccy || "USD";
    const a = Math.abs(Number(n) || 0);
    const sign = (Number(n) || 0) < 0 ? "-" : "";
    let str;
    if (a >= 1000000) str = (a / 1000000).toFixed(2).replace(/\.00$/, "") + "M";
    else if (a >= 10000) str = Math.round(a / 1000) + "K";
    else if (a >= 1000) str = (a / 1000).toFixed(1).replace(/\.0$/, "") + "K";
    else str = a.toLocaleString("en-US", { maximumFractionDigits: 0 });
    return sign + (CCY_SYM[ccy] || "$") + str;
  }
  function fmtMoneyExact(n, ccy) {
    ccy = ccy || "USD";
    const a = Math.abs(Number(n) || 0);
    const sign = (Number(n) || 0) < 0 ? "-" : "";
    return sign + (CCY_SYM[ccy] || "$") + a.toLocaleString("en-US", { maximumFractionDigits: 0 });
  }
  function fmtPct(n, d) { return (Number(n) || 0).toFixed(d || 0) + "%"; }
  function fmtHours(n) { return (Number(n) || 0).toLocaleString("en-US", { maximumFractionDigits: 0 }) + " h"; }
  function fmtDate(iso) {
    if (!iso) return "—";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  }
  function fmtDateShort(iso) {
    if (!iso) return "—";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }

  // -----------------------------------------------------------------
  // Export — primitives (components register on window below)
  // -----------------------------------------------------------------
  Object.assign(window, {
    PSProjects: {
      // gates
      isProjectOn, useProjectOn,
      // storage
      getProjects, getProject, saveProject, createProject,
      getConfig, saveConfig,
      useProjects, useProject, useConfig,
      // model
      STATES, TRANSITIONS, stateMeta, DEFAULT_CONFIG,
      // helpers
      projectActualSpend, projectPlannedSpend, projectBurnPct, projectNtePct,
      totalRosterHours, totalPlannedHours, daysRemaining, nteCushionPct,
      // fmt
      fmtMoney, fmtMoneyExact, fmtPct, fmtHours, fmtDate, fmtDateShort,
      CCY_SYM,
    },
  });
})();
