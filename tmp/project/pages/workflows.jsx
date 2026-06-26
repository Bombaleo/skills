// =====================================================================
// Flex Work — Workflows (Settings · approval workflows)
//   · WorkflowsPage       — page wrapper, owns "list" | "details" view
//   · WorkflowsList       — table + KPI strip + applies-to tabs
//   · WorkflowDetails     — name + trigger + visual approval chain +
//                            performance stats + recent activity
//   · WorkflowSidePanel   — create / edit (left-rail steps builder)
//
// Workflows are scoped by "appliesTo" — Requisition, Timesheet, Invoice,
// Rate change, Worker onboarding. Each workflow has:
//   · trigger conditions (which records this routes)
//   · sequential / parallel approval steps with SLA + escalation
//   · runtime stats (in-flight, avg time, SLA distribution)
// =====================================================================

const { useState: useWF, useMemo: useMWF, useEffect: useEWF, useCallback: useCWF } = React;

// ---------- Applies-to taxonomy ---------------------------------------
const WF_KINDS = {
  req:  { key: "req",  label: "Requisitions",       singular: "Requisition",       icon: "Notes",         desc: "Routes new requisitions for approval before they go to suppliers." },
  ts:   { key: "ts",   label: "Timesheets",         singular: "Timesheet",         icon: "PersonClock",   desc: "Routes worker timesheets — overtime, premium hours, manual edits." },
  inv:  { key: "inv",  label: "Invoices",           singular: "Invoice",           icon: "Pay",           desc: "Routes supplier invoices and credit memos for finance approval." },
  rate: { key: "rate", label: "Rate changes",       singular: "Rate change",       icon: "MoneyBag",      desc: "Routes pay-rate, bill-rate, and markup proposals from suppliers." },
  ob:   { key: "ob",   label: "Worker onboarding",  singular: "Worker onboarding", icon: "PersonPlus",    desc: "Routes new contingent workers through credentialing & I-9." },
};
const WF_KIND_ORDER = ["req", "ts", "inv", "rate", "ob"];

// ---------- Approver kinds (used inside steps) -------------------------
//   role     — Dayforce role / title (resolved at runtime)
//   dynamic  — derived from the record itself (e.g. submitter's manager)
//   user     — a specific named person
//   group    — N approvers, M required (parallel)
const WF_APPROVER_KINDS = {
  role:    { label: "Role",          icon: "ShieldPerson", avatarMod: "role" },
  dynamic: { label: "Dynamic",       icon: "OrgChartVert", avatarMod: "dyn" },
  user:    { label: "Specific user", icon: "Person",       avatarMod: "user" },
  group:   { label: "Group",         icon: "Users",        avatarMod: "grp" },
};

// ---------- Seed data --------------------------------------------------
const WF_SEED = [
  {
    id: "wf-req-std",
    name: "Standard requisition routing",
    appliesTo: "req",
    status: "Active",
    description: "Default approval chain for hourly and contract requisitions under $25,000 total estimated spend.",
    trigger: {
      object: "Requisition",
      conditions: [
        { field: "Estimated total", op: "≤", value: "$25,000" },
        { field: "Worker type",     op: "is", value: "Hourly · Contract" },
      ],
    },
    steps: [
      { id: "s1", kind: "dynamic", approver: "Direct manager",       sub: "of the requester",        slaHours: 24, onMiss: "Escalate to skip-level" },
      { id: "s2", kind: "role",    approver: "Location ops lead",    sub: "scoped to the location",  slaHours: 24, onMiss: "Auto-approve" },
    ],
    parallel: false,
    fallback: "Escalate to next approver",
    notifyChannels: ["Email", "In-app"],
    runtime: { inFlight: 8, avgHours: 14, approvedMonth: 132, rejectedMonth: 4, escalatedMonth: 3, sla: { ok: 82, late: 14, miss: 4 } },
    coverage: { triggered: 312, count: "62% of new requisitions" },
    audit: {
      lastEdited: "Apr 12, 2026 · 2:14 PM PT",
      editedBy: "Amy Chen",
      created: "Jan 03, 2026",
      createdBy: "Priya Shah",
    },
  },
  {
    id: "wf-req-large",
    name: "Large requisition — finance gate",
    appliesTo: "req",
    status: "Active",
    description: "High-spend requisitions ($25k+) get an extra finance review and a director sign-off before they release.",
    trigger: {
      object: "Requisition",
      conditions: [
        { field: "Estimated total", op: ">",  value: "$25,000" },
      ],
    },
    steps: [
      { id: "s1", kind: "dynamic", approver: "Direct manager",     sub: "of the requester",     slaHours: 24, onMiss: "Reminder" },
      { id: "s2", kind: "dynamic", approver: "Department owner",   sub: "from req department", slaHours: 24, onMiss: "Escalate to finance lead" },
      { id: "s3", kind: "group",   approver: "Finance reviewers",  sub: "any 1 of 3",           slaHours: 48, onMiss: "Escalate to next approver", required: 1, of: 3 },
      { id: "s4", kind: "user",    approver: "Maya Chen",          sub: "Director, Workforce",  slaHours: 24, onMiss: "Reminder" },
    ],
    parallel: false,
    fallback: "Escalate to next approver",
    notifyChannels: ["Email", "In-app", "Mobile push"],
    runtime: { inFlight: 3, avgHours: 36, approvedMonth: 19, rejectedMonth: 1, escalatedMonth: 2, sla: { ok: 71, late: 22, miss: 7 } },
    coverage: { triggered: 21, count: "12% of new requisitions" },
    audit: {
      lastEdited: "Apr 30, 2026 · 9:08 AM PT",
      editedBy: "Amy Chen",
      created: "Feb 18, 2026",
      createdBy: "Amy Chen",
    },
  },
  {
    id: "wf-ts-ot",
    name: "Overtime timesheet review",
    appliesTo: "ts",
    status: "Active",
    description: "Timesheets with >8h overtime in a week need site supervisor + payroll sign-off before they post.",
    trigger: {
      object: "Timesheet",
      conditions: [
        { field: "Overtime hours",  op: ">", value: "8h / week" },
        { field: "Worker class",    op: "is", value: "Hourly" },
      ],
    },
    steps: [
      { id: "s1", kind: "dynamic", approver: "Site supervisor",     sub: "of the booking",        slaHours: 24, onMiss: "Auto-approve" },
      { id: "s2", kind: "role",    approver: "Payroll approver",    sub: "regional payroll team", slaHours: 24, onMiss: "Reminder" },
    ],
    parallel: false,
    fallback: "Reminder",
    notifyChannels: ["In-app", "Email"],
    runtime: { inFlight: 14, avgHours: 9, approvedMonth: 211, rejectedMonth: 6, escalatedMonth: 1, sla: { ok: 91, late: 7, miss: 2 } },
    coverage: { triggered: 488, count: "All overtime timesheets" },
    audit: {
      lastEdited: "May 02, 2026 · 11:41 AM PT",
      editedBy: "Rosa Linares",
      created: "Nov 14, 2025",
      createdBy: "Rosa Linares",
    },
  },
  {
    id: "wf-inv-std",
    name: "Standard invoice three-way match",
    appliesTo: "inv",
    status: "Active",
    description: "Auto-approves invoices where every line matches its PO + receipt; routes any variance to AP.",
    trigger: {
      object: "Invoice",
      conditions: [
        { field: "Match status",   op: "is",   value: "Clean (3-way)" },
        { field: "Amount",         op: "≤",    value: "$50,000" },
      ],
    },
    steps: [
      { id: "s1", kind: "dynamic", approver: "AI Match agent",      sub: "auto-validates PO + receipt", slaHours: 0, onMiss: "Route to AP lead", ai: true },
    ],
    parallel: false,
    fallback: "Escalate to AP lead",
    notifyChannels: ["Email"],
    runtime: { inFlight: 22, avgHours: 0.4, approvedMonth: 786, rejectedMonth: 0, escalatedMonth: 41, sla: { ok: 96, late: 2, miss: 2 } },
    coverage: { triggered: 827, count: "~95% of supplier invoices" },
    audit: {
      lastEdited: "Mar 27, 2026 · 4:02 PM PT",
      editedBy: "Devon Park",
      created: "Aug 22, 2025",
      createdBy: "Devon Park",
    },
  },
  {
    id: "wf-inv-disputed",
    name: "Disputed invoice review",
    appliesTo: "inv",
    status: "Active",
    description: "Invoices with line-item disputes or amounts over $50k go to AP + cost-center owner for review.",
    trigger: {
      object: "Invoice",
      conditions: [
        { field: "Match status",   op: "is one of",   value: "Has disputes · Variance > 5%" },
      ],
    },
    steps: [
      { id: "s1", kind: "role",    approver: "AP analyst",          sub: "first review",           slaHours: 24, onMiss: "Escalate to AP lead" },
      { id: "s2", kind: "dynamic", approver: "Cost-center owner",   sub: "from invoice line",      slaHours: 48, onMiss: "Auto-approve" },
      { id: "s3", kind: "user",    approver: "Devon Park",          sub: "AP lead",                slaHours: 24, onMiss: "Reminder" },
    ],
    parallel: false,
    fallback: "Escalate to next approver",
    notifyChannels: ["Email", "In-app"],
    runtime: { inFlight: 5, avgHours: 28, approvedMonth: 33, rejectedMonth: 8, escalatedMonth: 4, sla: { ok: 74, late: 19, miss: 7 } },
    coverage: { triggered: 41, count: "~5% of supplier invoices" },
    audit: {
      lastEdited: "May 11, 2026 · 10:22 AM PT",
      editedBy: "Devon Park",
      created: "Aug 22, 2025",
      createdBy: "Devon Park",
    },
  },
  {
    id: "wf-rate-uplift",
    name: "Supplier rate uplift proposal",
    appliesTo: "rate",
    status: "Active",
    description: "Routes proposed rate increases from supplier portals; small uplifts auto-approve under cap.",
    trigger: {
      object: "Rate change",
      conditions: [
        { field: "Change type",  op: "is",   value: "Bill rate uplift" },
        { field: "Magnitude",    op: "≤",    value: "5%" },
      ],
    },
    steps: [
      { id: "s1", kind: "role",    approver: "Category manager",  sub: "by job family",       slaHours: 72, onMiss: "Escalate to procurement lead" },
      { id: "s2", kind: "user",    approver: "Alex Moreno",       sub: "Procurement lead",    slaHours: 72, onMiss: "Reminder" },
    ],
    parallel: false,
    fallback: "Escalate to next approver",
    notifyChannels: ["Email"],
    runtime: { inFlight: 2, avgHours: 52, approvedMonth: 11, rejectedMonth: 2, escalatedMonth: 1, sla: { ok: 84, late: 10, miss: 6 } },
    coverage: { triggered: 14, count: "All ≤5% uplift proposals" },
    audit: {
      lastEdited: "Apr 03, 2026 · 1:48 PM PT",
      editedBy: "Alex Moreno",
      created: "Sep 09, 2025",
      createdBy: "Alex Moreno",
    },
  },
  {
    id: "wf-ob-std",
    name: "Standard worker onboarding",
    appliesTo: "ob",
    status: "Active",
    description: "New contingent workers must clear credentialing, I-9, and a site induction before their first shift.",
    trigger: {
      object: "Worker onboarding",
      conditions: [
        { field: "Worker type",    op: "is",   value: "Contingent · agency-supplied" },
      ],
    },
    steps: [
      { id: "s1", kind: "dynamic", approver: "Credentialing agent", sub: "AI-assisted I-9 + cert checks", slaHours: 12, onMiss: "Escalate to HR partner", ai: true },
      { id: "s2", kind: "role",    approver: "Site supervisor",     sub: "of the assigned site",      slaHours: 24, onMiss: "Reminder" },
      { id: "s3", kind: "role",    approver: "HR partner",          sub: "of the department",            slaHours: 24, onMiss: "Auto-approve" },
    ],
    parallel: false,
    fallback: "Reminder",
    notifyChannels: ["Email", "In-app", "Mobile push"],
    runtime: { inFlight: 11, avgHours: 22, approvedMonth: 64, rejectedMonth: 3, escalatedMonth: 2, sla: { ok: 88, late: 9, miss: 3 } },
    coverage: { triggered: 71, count: "All agency-supplied workers" },
    audit: {
      lastEdited: "Apr 21, 2026 · 8:30 AM PT",
      editedBy: "Sami Soto",
      created: "Oct 02, 2025",
      createdBy: "Sami Soto",
    },
  },
  {
    id: "wf-rate-large",
    name: "Material rate change — exec review",
    appliesTo: "rate",
    status: "Draft",
    description: "Rate increases above 5% or affecting more than 25 active workers escalate to finance + workforce leadership.",
    trigger: {
      object: "Rate change",
      conditions: [
        { field: "Magnitude",        op: ">", value: "5%" },
        { field: "Affected workers", op: ">", value: "25" },
      ],
    },
    steps: [
      { id: "s1", kind: "role",    approver: "Category manager", sub: "by job family",          slaHours: 48, onMiss: "Reminder" },
      { id: "s2", kind: "user",    approver: "Alex Moreno",      sub: "Procurement lead",       slaHours: 48, onMiss: "Escalate" },
      { id: "s3", kind: "group",   approver: "Finance + ops",    sub: "any 2 of 4",             slaHours: 72, onMiss: "Reminder", required: 2, of: 4 },
      { id: "s4", kind: "user",    approver: "Maya Chen",        sub: "Director, Workforce",    slaHours: 48, onMiss: "Reminder" },
    ],
    parallel: false,
    fallback: "Escalate to next approver",
    notifyChannels: ["Email", "In-app"],
    runtime: { inFlight: 0, avgHours: 0, approvedMonth: 0, rejectedMonth: 0, escalatedMonth: 0, sla: { ok: 0, late: 0, miss: 0 } },
    coverage: { triggered: 0, count: "Not yet activated" },
    audit: {
      lastEdited: "May 14, 2026 · 3:30 PM PT",
      editedBy: "Amy Chen",
      created: "May 14, 2026",
      createdBy: "Amy Chen",
    },
  },
  {
    id: "wf-ts-legacy",
    name: "2024 timesheet review (legacy)",
    appliesTo: "ts",
    status: "Archived",
    description: "Original timesheet workflow superseded by overtime review + nightly auto-post in March.",
    trigger: { object: "Timesheet", conditions: [{ field: "Status", op: "is", value: "Submitted" }] },
    steps: [
      { id: "s1", kind: "role", approver: "Site supervisor", sub: "of the booking", slaHours: 48, onMiss: "Auto-approve" },
    ],
    parallel: false,
    fallback: "Auto-approve",
    notifyChannels: ["Email"],
    runtime: { inFlight: 0, avgHours: 0, approvedMonth: 0, rejectedMonth: 0, escalatedMonth: 0, sla: { ok: 0, late: 0, miss: 0 } },
    coverage: { triggered: 0, count: "Replaced by overtime review" },
    audit: {
      lastEdited: "Mar 04, 2026 · 11:00 AM PT",
      editedBy: "Rosa Linares",
      created: "Jan 18, 2024",
      createdBy: "Rosa Linares",
    },
  },
];

// ---------- Recent-activity feed (per workflow) -----------------------
function wfBuildActivity(wf) {
  if (wf.status !== "Active") return [];
  const a = [
    { icon: "Check",  kind: "ok",    title: <span><b>REQ-7382</b> approved by Lisa Park</span>,                meta: `Step 1 of ${wf.steps.length} · resolved in 4h`,    time: "32 min ago" },
    { icon: "Alert",  kind: "warn",  title: <span><b>REQ-7355</b> escalated — SLA missed</span>,              meta: `Step ${Math.min(2, wf.steps.length)} · routed to fallback`, time: "2 hr ago" },
    { icon: "Check",  kind: "ok",    title: <span><b>REQ-7341</b> auto-approved</span>,                       meta: "All steps cleared",                                time: "6 hr ago" },
    { icon: "Cancel", kind: "error", title: <span><b>REQ-7322</b> rejected by Devon Park</span>,              meta: "Reason: missing department",                      time: "Yesterday" },
    { icon: "Check",  kind: "ok",    title: <span><b>REQ-7311</b> approved by Maya Chen</span>,               meta: `Final step · ${wf.steps.length} of ${wf.steps.length}`, time: "Yesterday" },
  ];
  return a;
}

// ---------- Store (persists across nav) -------------------------------
function getWfStore() {
  if (!window.__wfStore) window.__wfStore = [...WF_SEED];
  return window.__wfStore;
}
function setWfStore(next) {
  window.__wfStore = next;
  window.dispatchEvent(new CustomEvent("wf:change"));
}
function upsertWf(rec) {
  const cur = getWfStore();
  const i = cur.findIndex((r) => r.id === rec.id);
  const next = i >= 0
    ? [...cur.slice(0, i), { ...cur[i], ...rec }, ...cur.slice(i + 1)]
    : [rec, ...cur];
  setWfStore(next);
}

// ---------- Tiny presentational atoms ---------------------------------
function WfStatusPill({ status }) {
  const cls = status === "Active"   ? "wf-pill wf-pill--active"
            : status === "Archived" ? "wf-pill wf-pill--archived"
                                    : "wf-pill wf-pill--draft";
  return <span className={cls}>{status}</span>;
}
function WfAppliesChip({ kind }) {
  const k = WF_KINDS[kind] || WF_KINDS.req;
  return (
    <span className={`wf-applies wf-applies--${kind}`}>
      <Icon name={k.icon} size={12} />
      {k.singular}
    </span>
  );
}
function WfApproverAvatar({ kind, label }) {
  const k = WF_APPROVER_KINDS[kind] || WF_APPROVER_KINDS.role;
  const initials = (label || "").split(/\s+/).slice(0, 2).map((s) => s[0] || "").join("").toUpperCase();
  return (
    <span className={`wf-chain-avatar wf-chain-avatar--${k.avatarMod}`} aria-hidden="true">
      {kind === "user"   ? initials :
       kind === "group"  ? <Icon name="Users" size={16} /> :
       kind === "dynamic" ? <Icon name="OrgChartVert" size={16} /> :
                            <Icon name="ShieldPerson" size={16} />}
    </span>
  );
}

// ====================================================================
// LIST VIEW
// ====================================================================
function WorkflowsList({ onOpenRow, onNew }) {
  const [rows, setRows] = useWF(() => getWfStore());
  const [query, setQuery] = useWF("");
  const [statusFilter, setStatusFilter] = useWF("All");
  const [appliesTab, setAppliesTab] = useWF("all"); // "all" | one of WF_KIND_ORDER

  useEWF(() => {
    const onChange = () => setRows([...getWfStore()]);
    window.addEventListener("wf:change", onChange);
    return () => window.removeEventListener("wf:change", onChange);
  }, []);

  const kindCounts = useMWF(() => {
    const c = { all: rows.length };
    WF_KIND_ORDER.forEach((k) => { c[k] = rows.filter((r) => r.appliesTo === k).length; });
    return c;
  }, [rows]);

  const filtered = useMWF(() => {
    const q = query.trim().toLowerCase();
    return rows
      .filter((r) => statusFilter === "All" || r.status === statusFilter)
      .filter((r) => appliesTab === "all" || r.appliesTo === appliesTab)
      .filter((r) => !q || r.name.toLowerCase().includes(q) || r.description.toLowerCase().includes(q));
  }, [rows, query, statusFilter, appliesTab]);

  // KPIs (org-wide, derived from rows)
  const kpis = useMWF(() => {
    const active = rows.filter((r) => r.status === "Active");
    const inFlight = active.reduce((s, r) => s + (r.runtime?.inFlight || 0), 0);
    const approved = active.reduce((s, r) => s + (r.runtime?.approvedMonth || 0), 0);
    const escalated = active.reduce((s, r) => s + (r.runtime?.escalatedMonth || 0), 0);
    return { active: active.length, inFlight, approved, escalated };
  }, [rows]);

  const rowMenu = (row) => (e) => {
    e.stopPropagation();
    if (!window.openMenu) return;
    window.openMenu(e.currentTarget, [
      { icon: "View", label: "Open workflow", onClick: () => onOpenRow(row.id) },
      ...(row.status !== "Archived"
        ? [{ icon: "Edit", label: "Edit", onClick: () => onOpenRow(row.id) }]
        : []),
      { icon: "Copy", label: "Duplicate", onClick: () => {
        const next = { ...row, id: `wf-${Date.now()}`, name: `${row.name} (copy)`, status: "Draft",
          audit: { ...row.audit, created: "Just now", createdBy: "You", lastEdited: "Just now", editedBy: "You" },
          runtime: { inFlight: 0, avgHours: 0, approvedMonth: 0, rejectedMonth: 0, escalatedMonth: 0, sla: { ok: 0, late: 0, miss: 0 } },
          coverage: { triggered: 0, count: "Not yet activated" },
        };
        upsertWf(next);
        if (window.showToast) window.showToast(`${row.name} duplicated as draft`, { kind: "success" });
      }},
      { divider: true },
      row.status === "Active"
        ? { icon: "TimeUndo", label: "Deactivate", onClick: () => {
            upsertWf({ ...row, status: "Draft" });
            if (window.showToast) window.showToast(`${row.name} moved to Draft`, { kind: "success" });
          }}
        : row.status === "Draft"
        ? { icon: "Bolt", label: "Activate", onClick: () => {
            upsertWf({ ...row, status: "Active" });
            if (window.showToast) window.showToast(`${row.name} activated`, { kind: "success" });
          }}
        : { icon: "AddCircle", label: "Reactivate", onClick: () => {
            upsertWf({ ...row, status: "Draft" });
            if (window.showToast) window.showToast(`${row.name} restored to Draft`, { kind: "success" });
          }},
      row.status !== "Archived" && { icon: "TrashCan", label: "Archive", danger: true,
        onClick: () => {
          upsertWf({ ...row, status: "Archived" });
          if (window.showToast) window.showToast(`${row.name} archived`, { kind: "success" });
        }},
    ].filter(Boolean));
  };

  return (
    <React.Fragment>
      {/* v0.77 spec §17 · "applies to axes" preview. Workflows can be
          scoped to specific (Work Type × Billing Model × Supplier Type)
          tuples; the picker on a requisition reads the row's axes and
          selects the matching workflow. Banner hidden at flag-off. */}
      {window.V77InfoBanner ? (
        <window.V77InfoBanner
          icon="Information"
          title="Workflows are about to become axis-scoped."
        >
          Phase 4 lets each workflow declare an &ldquo;applies to&rdquo; tuple — Work Type · Billing Model · Supplier Type. The router will pick the matching workflow per requisition based on its axes. Until then, today&rsquo;s per-object-type workflows continue to fire.
        </window.V77InfoBanner>
      ) : null}
      {/* Page header ------------------------------------------------- */}
      <div className="wf-page-header">
        <div className="wf-page-titlewrap">
          <h2 className="wf-page-title">Approval workflows</h2>
          <p className="wf-page-sub">
            Define how requisitions, timesheets, invoices, and worker onboarding move through approval.
            Each workflow has its own trigger conditions, sequence of approvers, SLA, and escalation path.
          </p>
        </div>
        <button type="button" className="wf-btn wf-btn--primary" onClick={onNew}>
          <Icon name="AddCircle" size={16} />
          New workflow
        </button>
      </div>

      {/* KPI strip --------------------------------------------------- */}
      <div className="wf-kpis">
        <div className="wf-kpi">
          <span className="wf-kpi-label">
            <span className="wf-kpi-label-icon"><Icon name="Bolt" size={14} /></span>
            Active workflows
          </span>
          <span className="wf-kpi-value">{kpis.active}</span>
          <span className="wf-kpi-foot">across {WF_KIND_ORDER.length} object types</span>
        </div>
        <div className="wf-kpi wf-kpi--warning">
          <span className="wf-kpi-label">
            <span className="wf-kpi-label-icon"><Icon name="Hourglass" size={14} /></span>
            In flight
          </span>
          <span className="wf-kpi-value">{kpis.inFlight}</span>
          <span className="wf-kpi-foot">items waiting on a decision</span>
        </div>
        <div className="wf-kpi wf-kpi--success">
          <span className="wf-kpi-label">
            <span className="wf-kpi-label-icon"><Icon name="Check" size={14} /></span>
            Approved · 30 days
          </span>
          <span className="wf-kpi-value">{kpis.approved.toLocaleString("en-US")}</span>
          <span className="wf-kpi-foot">across all active workflows</span>
        </div>
        <div className="wf-kpi wf-kpi--error">
          <span className="wf-kpi-label">
            <span className="wf-kpi-label-icon"><Icon name="Alert" size={14} /></span>
            Escalated · 30 days
          </span>
          <span className="wf-kpi-value">{kpis.escalated}</span>
          <span className="wf-kpi-foot">SLA breached or auto-routed</span>
        </div>
      </div>

      {/* Tabs + toolbar --------------------------------------------- */}
      <div className="wf-tabs" role="tablist">
        <button type="button" className="wf-tab" role="tab"
                aria-selected={appliesTab === "all"}
                onClick={() => setAppliesTab("all")}>
          All
          <span className="wf-tab-count">{kindCounts.all}</span>
        </button>
        {WF_KIND_ORDER.map((k) => (
          <button key={k} type="button" className="wf-tab" role="tab"
                  aria-selected={appliesTab === k}
                  onClick={() => setAppliesTab(k)}>
            <Icon name={WF_KINDS[k].icon} size={14} />
            {WF_KINDS[k].label}
            <span className="wf-tab-count">{kindCounts[k]}</span>
          </button>
        ))}
      </div>

      <div className="wf-toolbar">
        <div className="wf-toolbar-left">
          <div className="wf-search">
            <span className="wf-search-icon"><Icon name="Search" size={16} /></span>
            <input
              className="wf-search-input"
              placeholder="Search workflows"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <select className="wf-select" value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  aria-label="Filter by status">
            <option>All</option>
            <option>Active</option>
            <option>Draft</option>
            <option>Archived</option>
          </select>
        </div>
        <div className="wf-toolbar-right">
          <span style={{ font: "var(--evr-body2)", color: "var(--evr-content-primary-lowemp)" }}>
            {filtered.length} of {rows.length}
          </span>
        </div>
      </div>

      {/* Table ------------------------------------------------------- */}
      <div className="wf-card">
        <table className="wf-list">
          <thead>
            <tr>
              <th>Workflow</th>
              <th>Applies to</th>
              <th>Status</th>
              <th>Steps</th>
              <th>In flight</th>
              <th>Avg time</th>
              <th>Last edited</th>
              <th aria-label="Actions"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={8}>
                  <div className="wf-empty">
                    <span className="wf-empty-icon"><Icon name="Bolt" size={26} /></span>
                    <h3 className="wf-empty-title">No workflows match</h3>
                    <p className="wf-empty-body">
                      Try clearing search or filters — or design a new workflow tailored to this object type.
                    </p>
                  </div>
                </td>
              </tr>
            ) : filtered.map((row) => (
              <tr key={row.id} onClick={() => onOpenRow(row.id)} tabIndex={0}
                  onKeyDown={(e) => { if (e.key === "Enter") onOpenRow(row.id); }}>
                <td>
                  <div className={`wf-name wf-name--${row.appliesTo}`}>
                    <span className="wf-name-icon"><Icon name={WF_KINDS[row.appliesTo].icon} size={18} /></span>
                    <div className="wf-name-body">
                      <p className="wf-name-title">{row.name}</p>
                      <p className="wf-name-desc">{row.description.length > 90 ? row.description.slice(0, 88) + "…" : row.description}</p>
                    </div>
                  </div>
                </td>
                <td><WfAppliesChip kind={row.appliesTo} /></td>
                <td><WfStatusPill status={row.status} /></td>
                <td>
                  <span className="wf-steps-mini">
                    <span className="wf-steps-mini-dots">
                      {row.steps.map((s) => <span key={s.id} className="wf-steps-mini-dot" />)}
                    </span>
                    {row.steps.length}
                  </span>
                </td>
                <td>
                  <span className={`wf-in-flight${row.runtime.inFlight === 0 ? " wf-in-flight-zero" : ""}`}>
                    {row.runtime.inFlight}
                  </span>
                </td>
                <td style={{ fontVariantNumeric: "tabular-nums", color: row.runtime.avgHours === 0 ? "var(--evr-content-primary-lowemp)" : undefined }}>
                  {row.runtime.avgHours === 0 ? "—" : row.runtime.avgHours < 1 ? `${Math.round(row.runtime.avgHours * 60)}m` : `${row.runtime.avgHours}h`}
                </td>
                <td style={{ color: "var(--evr-content-primary-lowemp)" }}>
                  {row.audit.lastEdited.replace(/\s·.*$/, "")}
                  <div style={{ font: "var(--evr-caption)" }}>by {row.audit.editedBy}</div>
                </td>
                <td className="wf-cell-actions">
                  <button type="button" className="wf-icon-btn"
                          aria-label={`Actions for ${row.name}`} onClick={rowMenu(row)}>
                    <Icon name="MoreVert" size={18} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </React.Fragment>
  );
}

// ====================================================================
// DETAILS VIEW
// ====================================================================
function WorkflowDetails({ workflowId, onBack, onEdit }) {
  const [wf, setWf] = useWF(() => getWfStore().find((r) => r.id === workflowId) || null);

  useEWF(() => {
    const onChange = () => setWf(getWfStore().find((r) => r.id === workflowId) || null);
    window.addEventListener("wf:change", onChange);
    return () => window.removeEventListener("wf:change", onChange);
  }, [workflowId]);

  if (!wf) {
    return (
      <div className="wf-card" style={{ padding: 20 }}>
        <p>Workflow not found.</p>
        <button type="button" className="wf-btn wf-btn--secondary" onClick={onBack}>Back to workflows</button>
      </div>
    );
  }

  const kindMeta = WF_KINDS[wf.appliesTo];
  const isActive = wf.status === "Active";
  const isArchived = wf.status === "Archived";
  const activity = wfBuildActivity(wf);

  const slaPctOk = wf.runtime.sla.ok;
  const slaTone = slaPctOk >= 90 ? "ok" : slaPctOk >= 75 ? "warn" : "error";

  return (
    <React.Fragment>
      <div className="wf-breadcrumbs">
        <a onClick={onBack}>Settings</a>
        <Icon name="ChevronRight" size={12} />
        <a onClick={onBack}>Workflows</a>
        <Icon name="ChevronRight" size={12} />
        <span className="wf-crumb-current">{wf.name}</span>
      </div>

      {/* Summary ----------------------------------------------------- */}
      <div className="wf-card">
        <div className="wf-summary">
          <div>
            <div className="wf-summary-head">
              <WfAppliesChip kind={wf.appliesTo} />
              <WfStatusPill status={wf.status} />
              <span style={{ font: "var(--evr-caption)", color: "var(--evr-content-primary-lowemp)" }}>
                ID · {wf.id}
              </span>
            </div>
            <h1 style={{ marginTop: 10 }}>{wf.name}</h1>
            <p className="wf-summary-desc">{wf.description}</p>
          </div>
          <div className="wf-summary-meta">
            <div><strong>Last edited:</strong> {wf.audit.lastEdited}</div>
            <div><strong>By:</strong> {wf.audit.editedBy}</div>
            <div><strong>Created:</strong> {wf.audit.created} · {wf.audit.createdBy}</div>
            <div style={{ marginTop: 6 }}>
              <strong>Coverage:</strong> {wf.coverage.count}
            </div>
          </div>
        </div>
      </div>

      {/* Trigger ----------------------------------------------------- */}
      <div className="wf-section">
        <div className="wf-section-header">
          <span className="wf-section-icon"><Icon name="Adjustment" size={18} /></span>
          <div style={{ flex: 1 }}>
            <h2 className="wf-section-title">Trigger conditions</h2>
            <p className="wf-section-sub">
              When a <b>{wf.trigger.object}</b> meets every condition below, this workflow kicks in.
            </p>
          </div>
          {!isArchived && (
            <div className="wf-section-actions">
              <button type="button" className="wf-btn wf-btn--secondary wf-btn--sm"
                      onClick={() => onEdit(wf.id, "trigger")}>
                <Icon name="Edit" size={14} /> Edit trigger
              </button>
            </div>
          )}
        </div>
        <div className="wf-section-body">
          <div className="wf-conditions">
            {wf.trigger.conditions.map((c, i) => (
              <div className="wf-cond-row" key={i}>
                <span className="wf-cond-join">{i === 0 ? "IF" : "AND"}</span>
                <span className="wf-cond-text">
                  <b>{c.field}</b>
                  <span className="wf-cond-op"> {c.op} </span>
                  <b>{c.value}</b>
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Approval chain --------------------------------------------- */}
      <div className="wf-section">
        <div className="wf-section-header">
          <span className="wf-section-icon"><Icon name="OrgChartVert" size={18} /></span>
          <div style={{ flex: 1 }}>
            <h2 className="wf-section-title">Approval chain</h2>
            <p className="wf-section-sub">
              {wf.parallel
                ? `Parallel — all ${wf.steps.length} approvers can act simultaneously.`
                : `Sequential — ${wf.steps.length} step${wf.steps.length === 1 ? "" : "s"}, each must approve before the next is notified.`}
            </p>
          </div>
          {!isArchived && (
            <div className="wf-section-actions">
              <button type="button" className="wf-btn wf-btn--secondary wf-btn--sm"
                      onClick={() => onEdit(wf.id, "chain")}>
                <Icon name="Edit" size={14} /> Edit chain
              </button>
            </div>
          )}
        </div>
        <div className="wf-section-body">
          <div className="wf-chain">
            <div className="wf-chain-node wf-chain-node--start">
              <Icon name={kindMeta.icon} size={22} />
              <span className="wf-chain-kind">{kindMeta.singular}</span>
              <span style={{ font: "var(--evr-caption)", color: "var(--evr-content-primary-lowemp)" }}>
                submitted
              </span>
            </div>
            <span className="wf-chain-arrow"><Icon name="ArrowRight" size={20} /></span>

            {wf.steps.map((s, i) => {
              const kindLabel = (WF_APPROVER_KINDS[s.kind] || WF_APPROVER_KINDS.role).label;
              return (
                <React.Fragment key={s.id}>
                  <div className={`wf-chain-node${s.ai ? " wf-chain-node--ai" : ""}`}>
                    <div className="wf-chain-node-cap">
                      <span className="wf-chain-step">{i + 1}</span>
                      <span className="wf-chain-kind">
                        {s.ai ? (
                          <React.Fragment>
                            <span className="wf-chain-kind-icon"><Icon name="Bolt" size={12} /></span>
                            AI agent
                          </React.Fragment>
                        ) : kindLabel}
                      </span>
                    </div>
                    <div className="wf-chain-approver">
                      <WfApproverAvatar kind={s.kind} label={s.approver} />
                      <div className="wf-chain-approver-body">
                        <p className="wf-chain-approver-name">{s.approver}</p>
                        <p className="wf-chain-approver-sub">{s.sub}</p>
                      </div>
                    </div>
                    <div className="wf-chain-foot">
                      <div className="wf-chain-foot-cell">
                        <span className="wf-chain-foot-label">SLA</span>
                        <span className="wf-chain-foot-value">
                          <Icon name="Hourglass" size={12} />
                          {s.slaHours === 0 ? "Instant" : `${s.slaHours}h`}
                        </span>
                      </div>
                      <div className="wf-chain-foot-cell">
                        <span className="wf-chain-foot-label">If missed</span>
                        <span className="wf-chain-foot-value" style={{ fontSize: 12 }}>
                          {s.onMiss}
                        </span>
                      </div>
                    </div>
                  </div>
                  <span className="wf-chain-arrow"><Icon name="ArrowRight" size={20} /></span>
                </React.Fragment>
              );
            })}

            <div className="wf-chain-node wf-chain-node--end">
              <Icon name="Check" size={22} />
              <span className="wf-chain-kind" style={{ color: "var(--evr-content-status-success-default)" }}>Approved</span>
              <span style={{ font: "var(--evr-caption)", color: "var(--evr-content-primary-lowemp)" }}>
                {wf.appliesTo === "inv" ? "Posts to GL" :
                 wf.appliesTo === "req" ? "Released to suppliers" :
                 wf.appliesTo === "ts"  ? "Posts to payroll" :
                 wf.appliesTo === "rate" ? "Applied to contract" :
                                            "Worker activated"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Escalation + Notifications --------------------------------- */}
      <div className="wf-section">
        <div className="wf-section-header">
          <span className="wf-section-icon"><Icon name="Bell" size={18} /></span>
          <div style={{ flex: 1 }}>
            <h2 className="wf-section-title">Escalation &amp; notifications</h2>
            <p className="wf-section-sub">
              Defaults applied when an approver doesn't act within the SLA.
            </p>
          </div>
          {!isArchived && (
            <div className="wf-section-actions">
              <button type="button" className="wf-btn wf-btn--secondary wf-btn--sm"
                      onClick={() => onEdit(wf.id, "rules")}>
                <Icon name="Edit" size={14} /> Edit rules
              </button>
            </div>
          )}
        </div>
        <div className="wf-section-body">
          <div className="wf-rules-row">
            <div className="wf-rule">
              <span className="wf-rule-label"><Icon name="Hourglass" size={14} /> Default fallback</span>
              <span className="wf-rule-value"><b>{wf.fallback}</b></span>
            </div>
            <div className="wf-rule">
              <span className="wf-rule-label"><Icon name="Bell" size={14} /> Notify channels</span>
              <span className="wf-rule-value"><b>{wf.notifyChannels.join(" · ")}</b></span>
            </div>
            <div className="wf-rule">
              <span className="wf-rule-label"><Icon name="Users" size={14} /> Approval mode</span>
              <span className="wf-rule-value"><b>{wf.parallel ? "Parallel" : "Sequential"}</b></span>
            </div>
          </div>
        </div>
      </div>

      {/* Performance ------------------------------------------------ */}
      {isActive && (
        <div className="wf-section">
          <div className="wf-section-header">
            <span className="wf-section-icon"><Icon name="BarChart" size={18} /></span>
            <div style={{ flex: 1 }}>
              <h2 className="wf-section-title">Performance · last 30 days</h2>
              <p className="wf-section-sub">
                How this workflow is performing in production.
              </p>
            </div>
          </div>
          <div className="wf-section-body" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div className="wf-stat-grid">
              <div className="wf-stat wf-stat--ok">
                <span className="wf-stat-label">Approved</span>
                <span className="wf-stat-value">{wf.runtime.approvedMonth}</span>
                <span className="wf-stat-foot">{wf.coverage.triggered} triggered</span>
              </div>
              <div className="wf-stat">
                <span className="wf-stat-label">Avg cycle time</span>
                <span className="wf-stat-value">
                  {wf.runtime.avgHours < 1
                    ? `${Math.round(wf.runtime.avgHours * 60)}m`
                    : `${wf.runtime.avgHours}h`}
                </span>
                <span className="wf-stat-foot">across all steps</span>
              </div>
              <div className={`wf-stat ${wf.runtime.rejectedMonth > 5 ? "wf-stat--warn" : ""}`}>
                <span className="wf-stat-label">Rejected</span>
                <span className="wf-stat-value">{wf.runtime.rejectedMonth}</span>
                <span className="wf-stat-foot">routed back to submitter</span>
              </div>
              <div className={`wf-stat ${wf.runtime.escalatedMonth > 2 ? "wf-stat--warn" : ""}`}>
                <span className="wf-stat-label">Escalated</span>
                <span className="wf-stat-value">{wf.runtime.escalatedMonth}</span>
                <span className="wf-stat-foot">SLA breach or auto-route</span>
              </div>
            </div>

            <div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <span style={{ font: "var(--evr-utility1)", color: "var(--evr-content-primary-highemp)" }}>
                  SLA hit rate
                </span>
                <span style={{ font: "var(--evr-utility1)", color: `var(--evr-content-status-${slaTone === "ok" ? "success" : slaTone === "warn" ? "warning" : "error"}-default)` }}>
                  {slaPctOk}% on time
                </span>
              </div>
              <div className="wf-sla-bar">
                <div className="wf-sla-seg--ok"   style={{ width: `${wf.runtime.sla.ok}%` }}></div>
                <div className="wf-sla-seg--late" style={{ width: `${wf.runtime.sla.late}%` }}></div>
                <div className="wf-sla-seg--miss" style={{ width: `${wf.runtime.sla.miss}%` }}></div>
              </div>
              <div className="wf-sla-legend" style={{ marginTop: 8 }}>
                <span><span className="wf-sla-dot" style={{ background: "var(--evr-content-status-success-default)" }}></span>On time · {wf.runtime.sla.ok}%</span>
                <span><span className="wf-sla-dot" style={{ background: "var(--evr-content-status-warning-default)" }}></span>Late · {wf.runtime.sla.late}%</span>
                <span><span className="wf-sla-dot" style={{ background: "var(--evr-content-status-error-default)" }}></span>Missed · {wf.runtime.sla.miss}%</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Recent activity -------------------------------------------- */}
      {activity.length > 0 && (
        <div className="wf-section">
          <div className="wf-section-header">
            <span className="wf-section-icon"><Icon name="ClipboardCircleCheck" size={18} /></span>
            <div style={{ flex: 1 }}>
              <h2 className="wf-section-title">Recent activity</h2>
              <p className="wf-section-sub">Items that have moved through this workflow.</p>
            </div>
            <div className="wf-section-actions">
              <button type="button" className="wf-btn wf-btn--ghost wf-btn--sm">
                View audit log <Icon name="ChevronRight" size={14} />
              </button>
            </div>
          </div>
          <div className="wf-section-body">
            <div className="wf-activity">
              {activity.map((a, i) => (
                <div className="wf-activity-row" key={i}>
                  <span className={`wf-activity-icon wf-activity-icon--${a.kind}`}>
                    <Icon name={a.icon} size={16} />
                  </span>
                  <div className="wf-activity-body">
                    <p className="wf-activity-title">{a.title}</p>
                    <p className="wf-activity-meta">{a.meta}</p>
                  </div>
                  <span className="wf-activity-time">{a.time}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Footer actions --------------------------------------------- */}
      <div className="wf-details-footer">
        <div className="wf-details-footer-left">
          <button type="button" className="wf-btn wf-btn--ghost" onClick={onBack}>
            <Icon name="ArrowLeft" size={16} /> Back to workflows
          </button>
        </div>
        <div className="wf-details-footer-right">
          {wf.status === "Active" && (
            <button type="button" className="wf-btn wf-btn--secondary"
                    onClick={() => {
                      upsertWf({ ...wf, status: "Draft" });
                      if (window.showToast) window.showToast(`${wf.name} deactivated`, { kind: "success" });
                    }}>
              <Icon name="TimeUndo" size={14} /> Deactivate
            </button>
          )}
          {wf.status === "Draft" && (
            <button type="button" className="wf-btn wf-btn--secondary"
                    onClick={() => {
                      upsertWf({ ...wf, status: "Active" });
                      if (window.showToast) window.showToast(`${wf.name} activated`, { kind: "success" });
                    }}>
              <Icon name="Bolt" size={14} /> Activate
            </button>
          )}
          {!isArchived && (
            <button type="button" className="wf-btn wf-btn--primary" onClick={() => onEdit(wf.id)}>
              <Icon name="Edit" size={14} /> Edit workflow
            </button>
          )}
          {isArchived && (
            <button type="button" className="wf-btn wf-btn--secondary"
                    onClick={() => {
                      upsertWf({ ...wf, status: "Draft" });
                      if (window.showToast) window.showToast(`${wf.name} restored to Draft`, { kind: "success" });
                    }}>
              <Icon name="AddCircle" size={14} /> Restore
            </button>
          )}
        </div>
      </div>
    </React.Fragment>
  );
}

// ====================================================================
// SIDE PANEL — create / edit
// ====================================================================
function WorkflowSidePanel({ mode, workflowId, focusSection, onClose, onSaved }) {
  const original = mode === "edit"
    ? getWfStore().find((r) => r.id === workflowId)
    : null;
  const [form, setForm] = useWF(() => original ? {
    name: original.name,
    appliesTo: original.appliesTo,
    description: original.description,
    parallel: original.parallel,
    fallback: original.fallback,
    notifyEmail: original.notifyChannels.includes("Email"),
    notifyApp: original.notifyChannels.includes("In-app"),
    notifyPush: original.notifyChannels.includes("Mobile push"),
    steps: original.steps,
  } : {
    name: "",
    appliesTo: "req",
    description: "",
    parallel: false,
    fallback: "Escalate to next approver",
    notifyEmail: true,
    notifyApp: true,
    notifyPush: false,
    steps: [
      { id: "s1", kind: "dynamic", approver: "Direct manager", sub: "of the requester", slaHours: 24, onMiss: "Escalate to next approver" },
    ],
  });

  useEWF(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose && onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const set = (key) => (val) => setForm((f) => ({ ...f, [key]: val }));
  const setStep = (i, patch) =>
    setForm((f) => ({ ...f, steps: f.steps.map((s, idx) => idx === i ? { ...s, ...patch } : s) }));
  const addStep = () =>
    setForm((f) => ({
      ...f,
      steps: [...f.steps, {
        id: `s${f.steps.length + 1}`,
        kind: "role",
        approver: "Approver role",
        sub: "Scope",
        slaHours: 24,
        onMiss: "Reminder",
      }],
    }));
  const removeStep = (i) =>
    setForm((f) => ({ ...f, steps: f.steps.filter((_, idx) => idx !== i) }));
  const moveStep = (i, dir) => setForm((f) => {
    const j = i + dir;
    if (j < 0 || j >= f.steps.length) return f;
    const next = [...f.steps];
    [next[i], next[j]] = [next[j], next[i]];
    return { ...f, steps: next };
  });

  const handleSave = () => {
    if (!form.name.trim() || form.steps.length === 0) {
      if (window.showToast) window.showToast("Add a name and at least one approval step", { kind: "warning" });
      return;
    }
    const channels = [
      form.notifyEmail && "Email",
      form.notifyApp   && "In-app",
      form.notifyPush  && "Mobile push",
    ].filter(Boolean);
    const next = original ? {
      ...original,
      name: form.name.trim(),
      appliesTo: form.appliesTo,
      description: form.description.trim(),
      parallel: form.parallel,
      fallback: form.fallback,
      notifyChannels: channels.length ? channels : ["Email"],
      steps: form.steps,
      audit: { ...original.audit, lastEdited: "Just now", editedBy: "You" },
    } : {
      id: `wf-${Date.now()}`,
      name: form.name.trim(),
      appliesTo: form.appliesTo,
      status: "Draft",
      description: form.description.trim() || "—",
      trigger: { object: WF_KINDS[form.appliesTo].singular, conditions: [{ field: "Status", op: "is", value: "Submitted" }] },
      steps: form.steps,
      parallel: form.parallel,
      fallback: form.fallback,
      notifyChannels: channels.length ? channels : ["Email"],
      runtime: { inFlight: 0, avgHours: 0, approvedMonth: 0, rejectedMonth: 0, escalatedMonth: 0, sla: { ok: 0, late: 0, miss: 0 } },
      coverage: { triggered: 0, count: "Not yet activated" },
      audit: { lastEdited: "Just now", editedBy: "You", created: "Just now", createdBy: "You" },
    };
    upsertWf(next);
    if (window.showToast) window.showToast(original ? "Workflow saved" : "Workflow created as Draft", { kind: "success" });
    onSaved && onSaved(next.id);
  };

  return (
    <React.Fragment>
      <div className="wf-scrim" onClick={onClose}></div>
      <aside className="wf-panel" role="dialog" aria-labelledby="wf-panel-title">
        <header className="wf-panel-header">
          <div style={{ flex: 1 }}>
            <h2 className="wf-panel-title" id="wf-panel-title">
              {mode === "edit" ? "Edit workflow" : "New approval workflow"}
            </h2>
            <p className="wf-panel-sub">
              {mode === "edit"
                ? "Changes take effect for any new items that enter the workflow."
                : "New workflows save as Draft. Activate them when you're ready to route real items."}
            </p>
          </div>
          <button type="button" className="wf-icon-btn" aria-label="Close" onClick={onClose}>
            <Icon name="X" size={18} />
          </button>
        </header>

        <div className="wf-panel-body">
          {/* Applies to */}
          {mode !== "edit" && (
            <div className="wf-field">
              <span className="wf-field-label">Applies to</span>
              <div className="wf-field-help">Which object type kicks off this workflow.</div>
              <div className="wf-choice-grid" role="radiogroup">
                {WF_KIND_ORDER.map((k) => (
                  <button key={k} type="button" className="wf-choice"
                          role="radio" aria-checked={form.appliesTo === k}
                          onClick={() => set("appliesTo")(k)}>
                    <span className="wf-choice-head">
                      <Icon name={WF_KINDS[k].icon} size={16} />
                      {WF_KINDS[k].singular}
                    </span>
                    <span className="wf-choice-sub">{WF_KINDS[k].desc}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Name */}
          <div className="wf-field">
            <label className="wf-field-label" htmlFor="wf-name">Workflow name</label>
            <input id="wf-name" className="wf-input" value={form.name}
                   onChange={(e) => set("name")(e.target.value)}
                   placeholder="e.g. Large requisition — finance gate" />
            <span className="wf-field-help">Shows in the inbox and audit log.</span>
          </div>

          <div className="wf-field">
            <label className="wf-field-label" htmlFor="wf-desc">Description</label>
            <textarea id="wf-desc" className="wf-textarea" value={form.description}
                      onChange={(e) => set("description")(e.target.value)}
                      placeholder="A short summary of which records this workflow handles." />
          </div>

          {/* Steps */}
          <div className="wf-field">
            <span className="wf-field-label">Approval steps</span>
            <div className="wf-field-help">
              Each step waits for its approver(s) before notifying the next. Drag the handle to reorder; use the action menu to change approver type.
            </div>
            <div className="wf-step-builder">
              {form.steps.map((s, i) => (
                <React.Fragment key={s.id}>
                  <div className="wf-step-row">
                    <span className="wf-step-num">{i + 1}</span>
                    <div className="wf-step-body">
                      <div className="wf-step-row-top">
                        <input className="wf-input" value={s.approver}
                               onChange={(e) => setStep(i, { approver: e.target.value })}
                               placeholder="Approver name or role" />
                        <select className="wf-select" value={s.kind}
                                style={{ width: "100%" }}
                                onChange={(e) => setStep(i, { kind: e.target.value })}>
                          <option value="role">Role</option>
                          <option value="dynamic">Dynamic (derived)</option>
                          <option value="user">Specific user</option>
                          <option value="group">Group</option>
                        </select>
                      </div>
                      <div className="wf-step-row-bot">
                        <input className="wf-input" value={s.sub}
                               onChange={(e) => setStep(i, { sub: e.target.value })}
                               placeholder="Scope or qualifier" />
                        <select className="wf-select" value={s.slaHours}
                                style={{ width: "100%" }}
                                onChange={(e) => setStep(i, { slaHours: Number(e.target.value) })}>
                          <option value={0}>Instant</option>
                          <option value={4}>4 hours</option>
                          <option value={12}>12 hours</option>
                          <option value={24}>24 hours</option>
                          <option value={48}>48 hours</option>
                          <option value={72}>72 hours</option>
                        </select>
                      </div>
                    </div>
                    <div className="wf-step-actions">
                      <button type="button" className="wf-icon-btn" aria-label="Move up"
                              disabled={i === 0} onClick={() => moveStep(i, -1)}>
                        <Icon name="ChevronUp" size={16} />
                      </button>
                      <button type="button" className="wf-icon-btn" aria-label="Move down"
                              disabled={i === form.steps.length - 1} onClick={() => moveStep(i, 1)}>
                        <Icon name="ChevronDown" size={16} />
                      </button>
                      <button type="button" className="wf-icon-btn" aria-label="Remove step"
                              onClick={() => removeStep(i)}>
                        <Icon name="TrashCan" size={16} />
                      </button>
                    </div>
                  </div>
                  {i < form.steps.length - 1 && <div className="wf-step-connector"></div>}
                </React.Fragment>
              ))}
              <button type="button" className="wf-add-step" onClick={addStep}>
                <Icon name="AddCircle" size={16} /> Add another step
              </button>
            </div>
          </div>

          {/* Rules */}
          <div className="wf-field">
            <span className="wf-field-label">Escalation &amp; notifications</span>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div className="wf-toggle-row">
                <div className="wf-toggle-body">
                  <p className="wf-toggle-title">Parallel approval</p>
                  <p className="wf-toggle-sub">Notify every approver at once and accept the first decision.</p>
                </div>
                <button type="button" className="wf-switch" aria-checked={form.parallel}
                        role="switch"
                        onClick={() => set("parallel")(!form.parallel)}></button>
              </div>

              <div className="wf-field">
                <label className="wf-field-label" htmlFor="wf-fallback">If SLA is missed</label>
                <select id="wf-fallback" className="wf-select" value={form.fallback}
                        style={{ height: 38, padding: "0 12px" }}
                        onChange={(e) => set("fallback")(e.target.value)}>
                  <option>Escalate to next approver</option>
                  <option>Auto-approve</option>
                  <option>Reminder</option>
                  <option>Reject and notify submitter</option>
                </select>
              </div>

              <div className="wf-rules-row">
                <div className="wf-toggle-row" style={{ background: "transparent", padding: 0 }}>
                  <div className="wf-toggle-body">
                    <p className="wf-toggle-title">Email</p>
                    <p className="wf-toggle-sub">Inbox + digest</p>
                  </div>
                  <button type="button" className="wf-switch" aria-checked={form.notifyEmail}
                          role="switch" onClick={() => set("notifyEmail")(!form.notifyEmail)}></button>
                </div>
                <div className="wf-toggle-row" style={{ background: "transparent", padding: 0 }}>
                  <div className="wf-toggle-body">
                    <p className="wf-toggle-title">In-app</p>
                    <p className="wf-toggle-sub">Bell + inbox</p>
                  </div>
                  <button type="button" className="wf-switch" aria-checked={form.notifyApp}
                          role="switch" onClick={() => set("notifyApp")(!form.notifyApp)}></button>
                </div>
                <div className="wf-toggle-row" style={{ background: "transparent", padding: 0 }}>
                  <div className="wf-toggle-body">
                    <p className="wf-toggle-title">Mobile push</p>
                    <p className="wf-toggle-sub">High priority only</p>
                  </div>
                  <button type="button" className="wf-switch" aria-checked={form.notifyPush}
                          role="switch" onClick={() => set("notifyPush")(!form.notifyPush)}></button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <footer className="wf-panel-footer">
          <button type="button" className="wf-btn wf-btn--ghost" onClick={onClose}>Cancel</button>
          <div className="wf-panel-footer-right">
            <button type="button" className="wf-btn wf-btn--primary" onClick={handleSave}>
              <Icon name="Save" size={14} />
              {mode === "edit" ? "Save changes" : "Create as Draft"}
            </button>
          </div>
        </footer>
      </aside>
    </React.Fragment>
  );
}

// ====================================================================
// PAGE WRAPPER
// ====================================================================
function WorkflowsPage() {
  const [view, setView] = useWF("list");      // "list" | "details"
  const [activeId, setActiveId] = useWF(null);
  const [panel, setPanel] = useWF(null);      // { mode, id } | null

  return (
    <div className="wf-shell">
      {view === "list" && (
        <WorkflowsList
          onOpenRow={(id) => { setActiveId(id); setView("details"); }}
          onNew={() => setPanel({ mode: "create", id: null })}
        />
      )}
      {view === "details" && (
        <WorkflowDetails
          workflowId={activeId}
          onBack={() => { setActiveId(null); setView("list"); }}
          onEdit={(id) => setPanel({ mode: "edit", id })}
        />
      )}
      {panel && (
        <WorkflowSidePanel
          mode={panel.mode}
          workflowId={panel.id}
          onClose={() => setPanel(null)}
          onSaved={(id) => {
            setPanel(null);
            setActiveId(id);
            setView("details");
          }}
        />
      )}
    </div>
  );
}

Object.assign(window, { WorkflowsPage });
