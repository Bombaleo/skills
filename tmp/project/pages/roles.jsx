// =====================================================================
// Flex Work — Roles & Permissions settings
//   · RolesPage          — title row, summary KPIs, search/filter, table
//                          of roles with assigned-user avatar stacks.
//   · RoleSidePanel      — view / edit / create. Edit & create share the
//                          same form (name, description, scope, full
//                          permissions matrix, user assignment); view
//                          adds a quick-stats hero + read-only matrix +
//                          assigned-user list.
//
// Persists in window.__rolesStore so navigation away & back keeps edits.
// Hooks into window.openMenu / window.showToast / window.openConfirm.
// =====================================================================

const { useState: useR, useMemo: useMR, useEffect: useER, useCallback: useCR, useRef: useRR } = React;

// ---------- Permission catalog ----------------------------------------
// Grouped by module. Each leaf permission has an id + label + caption.
// Ordering = display order. This catalog drives both the matrix and the
// "X permissions granted" rollup.
const ROLE_PERM_GROUPS = [
  {
    id: "requisitions", label: "Requisitions", icon: "ClipboardCircleCheck",
    perms: [
      { id: "req.view",    label: "View requisitions",         caption: "See open and historical reqs." },
      { id: "req.create",  label: "Create requisitions",       caption: "Submit new reqs for approval." },
      { id: "req.approve", label: "Approve requisitions",      caption: "Sign off and release to suppliers." },
      { id: "req.close",   label: "Close & cancel",            caption: "End a req or cancel an order." },
    ],
  },
  {
    id: "workforce", label: "Workforce", icon: "Employees",
    perms: [
      { id: "wf.view",     label: "View worker roster",        caption: "Read worker profiles and history." },
      { id: "wf.onboard",  label: "Onboard / add workers",     caption: "Bring new workers into the system." },
      { id: "wf.edit",     label: "Edit worker details",       caption: "Change assignments, status, contact." },
      { id: "wf.offboard", label: "Offboard / deactivate",     caption: "End an assignment or terminate access." },
    ],
  },
  {
    id: "schedule", label: "Schedule", icon: "Calendar",
    perms: [
      { id: "sch.view",    label: "View schedule",             caption: "Read bookings and shift calendar." },
      { id: "sch.create",  label: "Create bookings",           caption: "Place new bookings and shifts." },
      { id: "sch.edit",    label: "Edit bookings",             caption: "Reassign, reschedule, swap shifts." },
      { id: "sch.cancel",  label: "Cancel shifts",             caption: "Cancel placed or in-progress shifts." },
    ],
  },
  {
    id: "timesheets", label: "Timesheets", icon: "Hourglass",
    perms: [
      { id: "ts.view",     label: "View timesheets",           caption: "Read worked-time and breaks." },
      { id: "ts.edit",     label: "Edit time entries",         caption: "Correct punches and totals." },
      { id: "ts.approve",  label: "Approve timesheets",        caption: "Release timesheets to payroll." },
      { id: "ts.reject",   label: "Reject / dispute",          caption: "Send back with a reason for fix." },
    ],
  },
  {
    id: "invoices", label: "Invoices & Pay", icon: "CreditCard",
    perms: [
      { id: "inv.view",    label: "View invoices",             caption: "Read supplier invoices and lines." },
      { id: "inv.approve", label: "Approve for payment",       caption: "Release approved invoices to AP." },
      { id: "inv.dispute", label: "Dispute lines",             caption: "Flag and hold an invoice line." },
      { id: "inv.pay",     label: "Mark paid / remit",         caption: "Record a payment against an invoice." },
    ],
  },
  {
    id: "suppliers", label: "Suppliers", icon: "Building",
    perms: [
      { id: "sup.view",       label: "View suppliers",         caption: "Read supplier list and contracts." },
      { id: "sup.invite",     label: "Invite suppliers",       caption: "Send a new-supplier onboarding." },
      { id: "sup.contract",   label: "Edit contracts",         caption: "Adjust rates, markups, terms." },
      { id: "sup.deactivate", label: "Deactivate suppliers",   caption: "Pause or terminate a supplier." },
    ],
  },
  {
    id: "locations", label: "Sites", icon: "Location",
    perms: [
      { id: "loc.view",       label: "View sites",         caption: "Read site list and details." },
      { id: "loc.add",        label: "Add sites",          caption: "Stand up a new site or property." },
      { id: "loc.edit",       label: "Edit sites",         caption: "Change address, ops, distribution." },
      { id: "loc.deactivate", label: "Deactivate sites",   caption: "Retire a site from operations." },
    ],
  },
  {
    id: "budgets", label: "Budgets", icon: "MoneyBag",
    perms: [
      { id: "bud.view",     label: "View budgets",             caption: "Read allocations and utilization." },
      { id: "bud.create",   label: "Create budgets",           caption: "Stand up a new budget envelope." },
      { id: "bud.approve",  label: "Approve over-budget",      caption: "Release a commit past the cap." },
      { id: "bud.thresh",   label: "Adjust thresholds",        caption: "Change warn / cap percentages." },
    ],
  },
  {
    id: "reports", label: "Reports & Insights", icon: "Performance",
    perms: [
      { id: "rep.view",    label: "View dashboards",           caption: "Read prebuilt insights and KPIs." },
      { id: "rep.build",   label: "Build custom reports",      caption: "Save and share saved views." },
      { id: "rep.export",  label: "Export raw data",           caption: "Download CSVs with PII." },
    ],
  },
  {
    id: "settings", label: "System & Admin", icon: "Settings",
    perms: [
      { id: "sys.roles",     label: "Manage user roles",           caption: "Create and edit User Roles." },
      { id: "sys.users",     label: "Manage users",                caption: "Invite, deactivate, assign roles." },
      { id: "sys.pricing",   label: "Configure pricing",           caption: "Edit rate cards and markups." },
      { id: "sys.workflows", label: "Configure workflows",         caption: "Edit approval and routing rules." },
      { id: "sys.audit",     label: "View audit log",              caption: "See who did what, when." },
    ],
  },
  // Organizations — platform-tier capabilities. These permissions only
  // mean anything inside the Dayforce platform org; the Systems Admin
  // role that bundles them is itself gated to that org (orgOnly).
  {
    id: "organizations", label: "Organizations", icon: "OrgChartVert",
    perms: [
      { id: "org.view",     label: "View organizations",       caption: "See every tenant Dayforce manages." },
      { id: "org.create",   label: "Create organizations",     caption: "Stand up a new tenant and its base settings." },
      { id: "org.manage",   label: "Manage organizations",     caption: "Switch, edit, suspend, or reactivate a tenant." },
      { id: "org.settings", label: "Configure base settings",  caption: "Region, branding, program, plan, and admin." },
    ],
  },
];

const ROLE_ALL_PERM_IDS = ROLE_PERM_GROUPS.flatMap((g) => g.perms.map((p) => p.id));
const ROLE_TOTAL_PERMS  = ROLE_ALL_PERM_IDS.length;

// ---------- Helpers ----------------------------------------------------
function rolePermCount(role) {
  const p = role.permissions || {};
  return ROLE_ALL_PERM_IDS.reduce((s, id) => s + (p[id] ? 1 : 0), 0);
}
function rolePermsFromIds(ids) {
  const obj = {};
  ids.forEach((id) => { obj[id] = true; });
  return obj;
}
function roleInitials(name) {
  const parts = (name || "").trim().split(/\s+/);
  return ((parts[0] || "")[0] + (parts[1] || "")[0] || (parts[0] || "")[0] || "?").toUpperCase();
}
const ROLE_AVATAR_TONES = [
  "blue", "purple", "teal", "green", "orange", "yellow", "red",
];
function roleUserTone(id) {
  let h = 0;
  const s = String(id || "");
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return ROLE_AVATAR_TONES[Math.abs(h) % ROLE_AVATAR_TONES.length];
}

// ---------- Seed data: users -------------------------------------------
// A shared pool of system users that can be assigned to roles. The
// mid-cast ops/managers titles are picked per-industry so a healthcare
// demo shows "Nurse Manager" instead of "Site Manager — Warehouse #35".
function _roleUsersForIndustry() {
  const id = (window.getCurrentIndustryId && window.getCurrentIndustryId()) || "manufacturing";
  const variant = ({
    manufacturing: {
      niaTitle: "Regional Manager — East",       niaLoc: "Atlanta DC · Atlanta, GA",
      jamalTitle: "Site Manager",                jamalLoc: "Warehouse #35 · Dallas, TX",
      priyaTitle: "Plant Operations Lead",       priyaLoc: "Atlas Plant #02 · Phoenix, AZ",
      samiTitle:  "VP — Light Industrial",       samiLoc:  "HQ · Toronto, ON",
      ritaTitle:  "Site Manager",                ritaLoc:  "Warehouse #14 · Chicago, IL",
      benTitle:   "Hiring Manager",              benLoc:   "DC Alpha · Atlanta, GA",
      kenjiTitle: "Regional Manager — West",     kenjiLoc: "Phoenix DC · Phoenix, AZ",
    },
    hospitality: {
      niaTitle: "Regional Manager — East",       niaLoc: "Aurora Lodge · Charleston, SC",
      jamalTitle: "Property Manager",            jamalLoc: "Beach Club Annex · Miami, FL",
      priyaTitle: "Banquet Operations Lead",     priyaLoc: "Aurora Resort Way · Honolulu, HI",
      samiTitle:  "VP — Guest Services",         samiLoc:  "HQ · Toronto, ON",
      ritaTitle:  "Property Manager",            ritaLoc:  "Aurora Lodge · Aspen, CO",
      benTitle:   "Talent Manager",              benLoc:   "Aurora Resort Way · Honolulu, HI",
      kenjiTitle: "Regional Manager — West",     kenjiLoc: "Resort Way · Honolulu, HI",
    },
    retail: {
      niaTitle: "District Manager — East",       niaLoc: "Northwind Flagship NYC · New York, NY",
      jamalTitle: "Store Manager",               jamalLoc: "Northwind Express SF · San Francisco, CA",
      priyaTitle: "Visual Merchandising Lead",   priyaLoc: "Northwind Flagship CHI · Chicago, IL",
      samiTitle:  "VP — Retail Ops",             samiLoc:  "HQ · Toronto, ON",
      ritaTitle:  "Store Manager",               ritaLoc:  "Northwind Flagship SEA · Seattle, WA",
      benTitle:   "Talent Acquisition Lead",     benLoc:   "Northwind Flagship NYC · New York, NY",
      kenjiTitle: "District Manager — West",     kenjiLoc: "Northwind Outlet PHX · Phoenix, AZ",
    },
    healthcare: {
      niaTitle: "Regional Nursing Director",     niaLoc: "Mercy Memorial · Oakland, CA",
      jamalTitle: "Nurse Manager",               jamalLoc: "Mercy Medical Plaza · San Mateo, CA",
      priyaTitle: "Charge Nurse",                priyaLoc: "Mercy Children's · Berkeley, CA",
      samiTitle:  "VP — Clinical Operations",    samiLoc:  "HQ · Toronto, ON",
      ritaTitle:  "Nurse Manager",               ritaLoc:  "Mercy Plaza South · San Jose, CA",
      benTitle:   "Talent Acquisition — Nursing",benLoc:   "Mercy Memorial · Oakland, CA",
      kenjiTitle: "Regional Nursing Director",   kenjiLoc: "Mercy Plaza South · San Jose, CA",
    },
    logistics: {
      niaTitle: "Regional Operations — East",    niaLoc: "Midland Terminal DEN · Denver, CO",
      jamalTitle: "Terminal Manager",            jamalLoc: "Midland Terminal SLC · Salt Lake City, UT",
      priyaTitle: "Dispatch Lead",               priyaLoc: "Midland Terminal PHX · Phoenix, AZ",
      samiTitle:  "VP — Fleet Operations",       samiLoc:  "HQ · Toronto, ON",
      ritaTitle:  "Terminal Manager",            ritaLoc:  "Midland Terminal DEN · Denver, CO",
      benTitle:   "Driver Recruiting Lead",      benLoc:   "Midland Terminal SLC · Salt Lake City, UT",
      kenjiTitle: "Regional Operations — West",  kenjiLoc: "Midland Terminal PHX · Phoenix, AZ",
    },
  })[id] || {};
  return [
    { id: "u-admin",  name: "Admin",             title: "Systems Administrator",       location: "Dayforce · Platform",        lastActive: "Just now" },
    { id: "u-amy",    name: "Amy Chen",          title: "Workforce Operations Admin",  location: "HQ · Toronto, ON",          lastActive: "Just now" },
    { id: "u-nia",    name: "Nia Thompson",      title: variant.niaTitle,              location: variant.niaLoc,              lastActive: "12 min ago" },
    { id: "u-jamal",  name: "Jamal Carter",      title: variant.jamalTitle,            location: variant.jamalLoc,            lastActive: "1 h ago" },
    { id: "u-priya",  name: "Priya Ramesh",      title: variant.priyaTitle,            location: variant.priyaLoc,            lastActive: "Yesterday" },
    { id: "u-sami",   name: "Sami Soto",         title: variant.samiTitle,             location: variant.samiLoc,             lastActive: "3 h ago" },
    { id: "u-devon",  name: "Devon Park",        title: "Payroll Manager",             location: "HQ · Toronto, ON",          lastActive: "30 min ago" },
    { id: "u-maya",   name: "Maya Chen",         title: "Finance Approver",            location: "HQ · Toronto, ON",          lastActive: "2 h ago" },
    { id: "u-alex",   name: "Alex Moreno",       title: "Innovation Lead",             location: "Remote · Brooklyn, NY",     lastActive: "Yesterday" },
    { id: "u-rita",   name: "Rita Okafor",       title: variant.ritaTitle,             location: variant.ritaLoc,             lastActive: "5 h ago" },
    { id: "u-ben",    name: "Ben Liu",           title: variant.benTitle,              location: variant.benLoc,              lastActive: "Today" },
    { id: "u-tara",   name: "Tara Nguyen",       title: "Compliance Officer",          location: "HQ · Toronto, ON",          lastActive: "4 h ago" },
    { id: "u-rob",    name: "Rob Schmidt",       title: "MSP Partner — Allegis",       location: "External · Chicago, IL",    lastActive: "1 day ago" },
    { id: "u-leah",   name: "Leah Park",         title: "MSP Partner — KellyOCG",      location: "External · Troy, MI",       lastActive: "2 days ago" },
    { id: "u-omar",   name: "Omar Haddad",       title: "Internal Audit",              location: "HQ · Toronto, ON",          lastActive: "1 day ago" },
    { id: "u-grace",  name: "Grace Holloway",    title: "AP Specialist",               location: "HQ · Toronto, ON",          lastActive: "20 min ago" },
    { id: "u-kenji",  name: "Kenji Tanaka",      title: variant.kenjiTitle,            location: variant.kenjiLoc,            lastActive: "Today" },
  ];
}
const ROLE_USERS = _roleUsersForIndustry();

// ---------- Seed data: roles -------------------------------------------
function role_seed() {
  const all = ROLE_ALL_PERM_IDS;
  const adminScope = { type: "all", locations: [], departments: [] };
  const eastScope  = { type: "specific",
    locations: ["DC Alpha · Atlanta, GA", "Warehouse #35 · Dallas, TX", "Warehouse #14 · Chicago, IL", "Hub-NJ · Edison, NJ"],
    departments: [] };

  // Bundles of permission ids
  const PERMS = {
    admin: all,

    // Systems Admin — platform-tier. Full operational control PLUS the
    // Organizations group (view / create / manage / configure). This
    // bundle only matters inside the Dayforce platform org, where the
    // role is available (see orgOnly on the role record below).
    systemsAdmin: all,

    wfm: [ // Workforce Ops Manager
      "req.view","req.create","req.approve","req.close",
      "wf.view","wf.onboard","wf.edit","wf.offboard",
      "sch.view","sch.create","sch.edit","sch.cancel",
      "ts.view","ts.edit","ts.approve","ts.reject",
      "inv.view","sup.view","loc.view","bud.view","rep.view","rep.build",
    ],

    hiring: [ // Hiring Manager — site-scoped
      "req.view","req.create","req.approve",
      "wf.view","wf.onboard",
      "sch.view","sch.create","sch.edit",
      "ts.view","ts.approve",
      "loc.view","rep.view",
    ],

    finance: [ // Finance Approver
      "req.view","ts.view",
      "inv.view","inv.approve","inv.dispute","inv.pay",
      "bud.view","bud.create","bud.approve","bud.thresh",
      "loc.view","rep.view","rep.build","rep.export",
    ],

    msp: [ // MSP Partner
      "req.view","req.close",
      "sch.view","ts.view","ts.approve",
      "sup.view","sup.invite","sup.contract",
      "rep.view",
    ],

    auditor: [ // Read-only across the board
      "req.view","wf.view","sch.view","ts.view","inv.view","sup.view","loc.view","bud.view","rep.view","sys.audit",
    ],

    compliance: [
      "wf.view","ts.view","sup.view","loc.view","rep.view","rep.build","rep.export","sys.audit",
    ],

    // v0.97 — IC Compliance Officer. Sits between the buyer Manager and
    // Workforce Ops on the IC engagement type. Owns classification
    // determinations, COI verification, tax-form refreshes, and the
    // approval gate above the configured risk threshold on the IC
    // program card. Read-everywhere; write only where the IC lifecycle
    // touches.
    icCompliance: [
      "req.view",
      "wf.view","wf.onboard","wf.edit",
      "ts.view",
      "inv.view","inv.approve","inv.dispute",
      "sup.view",
      "rep.view","rep.build","rep.export",
      "sys.audit",
    ],

    regional: [ // Regional Manager East — like WFM, scoped
      "req.view","req.create","req.approve","req.close",
      "wf.view","wf.edit",
      "sch.view","sch.create","sch.edit","sch.cancel",
      "ts.view","ts.edit","ts.approve","ts.reject",
      "inv.view","sup.view","loc.view","bud.view","rep.view",
    ],
  };

  return [
    {
      id: "r-systems-admin",
      name: "Systems Admin",
      description: "Platform administrator for the Dayforce org. Creates new organizations, configures their base settings, and manages every existing tenant. Available only inside the Dayforce platform org.",
      type: "system", color: "blue",
      orgOnly: "dayforce",
      permissions: rolePermsFromIds(PERMS.systemsAdmin),
      scope: adminScope,
      userIds: ["u-admin"],
      createdAt: "Aug 14, 2024",
      createdBy: "System",
      updatedAt: "May 28, 2026",
      updatedBy: "System",
    },
    {
      id: "r-admin",
      name: "Administrator",
      description: "Full control over every module, including Roles & Users. Reserved for platform owners.",
      type: "system", color: "purple",
      permissions: rolePermsFromIds(PERMS.admin),
      scope: adminScope,
      userIds: ["u-amy"],
      createdAt: "Aug 14, 2024",
      createdBy: "System",
      updatedAt: "May 12, 2026",
      updatedBy: "Amy Chen",
    },
    {
      id: "r-wfm",
      name: "Workforce Operations Manager",
      description: "Day-to-day operator. Manages requisitions, workers, schedules, timesheets. Can read finance but not approve.",
      type: "system", color: "blue",
      permissions: rolePermsFromIds(PERMS.wfm),
      scope: adminScope,
      userIds: ["u-amy", "u-sami", "u-rita", "u-jamal", "u-priya", "u-devon"],
      createdAt: "Aug 14, 2024",
      createdBy: "System",
      updatedAt: "Apr 28, 2026",
      updatedBy: "Amy Chen",
    },
    {
      id: "r-hm",
      name: "Hiring Manager",
      description: "Front-line manager who creates and approves requisitions for their own site. Read-only outside their location.",
      type: "system", color: "teal",
      permissions: rolePermsFromIds(PERMS.hiring),
      scope: { type: "specific", locations: ["assigned-location"], departments: [] },
      userIds: ["u-jamal", "u-rita", "u-priya", "u-ben", "u-kenji"],
      createdAt: "Aug 14, 2024",
      createdBy: "System",
      updatedAt: "May 02, 2026",
      updatedBy: "Sami Soto",
    },
    {
      id: "r-finance",
      name: "Finance Approver",
      description: "Releases invoices for payment and owns budget caps. Read-only on requisitions and timesheets.",
      type: "system", color: "green",
      permissions: rolePermsFromIds(PERMS.finance),
      scope: adminScope,
      userIds: ["u-maya", "u-devon", "u-grace"],
      createdAt: "Aug 14, 2024",
      createdBy: "System",
      updatedAt: "Mar 04, 2026",
      updatedBy: "Maya Chen",
    },
    {
      id: "r-msp",
      name: "MSP Partner",
      description: "External managed-service partner. Sees only requisitions and shifts routed to them, plus their own supplier roster.",
      type: "system", color: "orange",
      permissions: rolePermsFromIds(PERMS.msp),
      scope: { type: "specific", locations: ["assigned-portfolio"], departments: [] },
      userIds: ["u-rob", "u-leah"],
      createdAt: "Aug 14, 2024",
      createdBy: "System",
      updatedAt: "Feb 18, 2026",
      updatedBy: "Amy Chen",
    },
    {
      id: "r-auditor",
      name: "Auditor (read-only)",
      description: "Read-only across every module plus the audit log. Cannot create, edit, or approve anything.",
      type: "system", color: "yellow",
      permissions: rolePermsFromIds(PERMS.auditor),
      scope: adminScope,
      userIds: ["u-omar"],
      createdAt: "Aug 14, 2024",
      createdBy: "System",
      updatedAt: "Aug 14, 2024",
      updatedBy: "System",
    },
    {
      id: "r-regional-east",
      name: "Regional Manager — East",
      description: "Workforce Ops scoped to East-region locations. Approves reqs and timesheets, sees budgets read-only.",
      type: "custom", color: "blue",
      permissions: rolePermsFromIds(PERMS.regional),
      scope: eastScope,
      userIds: ["u-nia"],
      createdAt: "Nov 03, 2025",
      createdBy: "Amy Chen",
      updatedAt: "May 09, 2026",
      updatedBy: "Amy Chen",
    },
    {
      id: "r-compliance",
      name: "Compliance Officer",
      description: "Credentialing reviews, supplier compliance, and audit-log read. Can build and export compliance reports.",
      type: "custom", color: "red",
      permissions: rolePermsFromIds(PERMS.compliance),
      scope: adminScope,
      userIds: ["u-tara"],
      createdAt: "Jan 22, 2026",
      createdBy: "Amy Chen",
      updatedAt: "Apr 15, 2026",
      updatedBy: "Tara Nguyen",
    },
    {
      id: "r-ic-compliance",
      name: "IC Compliance Officer",
      description: "Independent-contractor compliance reviewer. Owns the classification determination, the COI / coverage gate, and the approval step on new contractor invites above the configured risk threshold. Reads finance and audit; cannot edit roles.",
      type: "custom", color: "purple",
      permissions: rolePermsFromIds(PERMS.icCompliance),
      scope: adminScope,
      userIds: ["u-tara"],
      createdAt: "May 27, 2026",
      createdBy: "Amy Chen",
      updatedAt: "May 27, 2026",
      updatedBy: "Amy Chen",
    },
  ];
}

// ---------- Persistent store ------------------------------------------
function role_store() {
  if (!window.__rolesStore) window.__rolesStore = role_seed();
  return window.__rolesStore;
}
function role_setStore(next) {
  window.__rolesStore = next;
  window.dispatchEvent(new CustomEvent("roles:change"));
}
function role_upsert(rec) {
  const cur = role_store();
  const i = cur.findIndex((r) => r.id === rec.id);
  const next = i >= 0
    ? [...cur.slice(0, i), { ...cur[i], ...rec }, ...cur.slice(i + 1)]
    : [{ ...rec, id: rec.id || `r-${Date.now()}` }, ...cur];
  role_setStore(next);
}
function role_remove(id) { role_setStore(role_store().filter((r) => r.id !== id)); }

// =====================================================================
// Sub-components
// =====================================================================

// ---- Avatar (initial + tone) — sized + tonal background --------------
function RoleAvatar({ user, size = 28, title }) {
  const tone = roleUserTone(user.id);
  const fz = Math.max(10, Math.round(size * 0.36));
  return (
    <span
      className="rl-avatar"
      data-tone={tone}
      style={{ width: size, height: size, fontSize: fz }}
      title={title || `${user.name} · ${user.title}`}
      aria-label={user.name}
    >
      {roleInitials(user.name)}
    </span>
  );
}

// ---- Role-color chip / type pill --------------------------------------
function RoleTypeBadge({ type }) {
  if (type === "system") {
    return (
      <span className="rl-type-pill rl-type-pill--system" title="Built-in role (you can edit assignments but not delete)">
        <Icon name="Lock" size={12} /> System
      </span>
    );
  }
  return (
    <span className="rl-type-pill rl-type-pill--custom" title="Custom role">
      <Icon name="Edit" size={12} /> Custom
    </span>
  );
}

// ---- Avatar stack ----------------------------------------------------
function RoleAvatarStack({ userIds, max = 4, size = 28 }) {
  const users = userIds
    .map((id) => ROLE_USERS.find((u) => u.id === id))
    .filter(Boolean);
  const shown = users.slice(0, max);
  const extra = users.length - shown.length;
  return (
    <div className="rl-avatar-stack" style={{ "--avatar-size": `${size}px` }}>
      {shown.map((u) => (
        <RoleAvatar key={u.id} user={u} size={size} />
      ))}
      {extra > 0 && (
        <span className="rl-avatar rl-avatar--more" style={{ width: size, height: size, fontSize: Math.round(size * 0.34) }}>
          +{extra}
        </span>
      )}
      {users.length === 0 && (
        <span className="rl-avatar-empty">No users</span>
      )}
    </div>
  );
}

// ---- Permission-progress bar (used in card / row / hero) -------------
function RolePermBar({ count, total = ROLE_TOTAL_PERMS }) {
  const pct = Math.round((count / total) * 100);
  let state = "low";
  if (pct >= 80) state = "high";
  else if (pct >= 40) state = "mid";
  return (
    <div className="rl-permbar" data-state={state}>
      <div className="rl-permbar-track">
        <div className="rl-permbar-fill" style={{ width: `${pct}%` }} />
      </div>
      <span className="rl-permbar-label">{count} of {total}</span>
    </div>
  );
}

// ---- Role color dot -------------------------------------------------
function RoleColorDot({ tone }) {
  return <span className="rl-color-dot" data-tone={tone || "blue"} />;
}

// =====================================================================
// LIST PAGE
// =====================================================================
function RolesPage() {
  const [rows, setRows]           = useR(() => role_store());
  const [query, setQuery]         = useR("");
  const [typeFilter, setType]     = useR("all"); // all | system | custom
  const [sortBy, setSortBy]       = useR({ key: "name", dir: "asc" });
  const [panel, setPanel]         = useR(null);  // null | { mode, id? }

  useER(() => {
    const onChange = () => setRows([...role_store()]);
    window.addEventListener("roles:change", onChange);
    return () => window.removeEventListener("roles:change", onChange);
  }, []);

  const filtered = useMR(() => {
    const q = query.trim().toLowerCase();
    // orgOnly roles (e.g. Systems Admin) surface only inside their org.
    const curOrg = (window.getCurrentIndustryId && window.getCurrentIndustryId()) || "";
    return rows
      .filter((r) => !r.orgOnly || r.orgOnly === curOrg)
      .filter((r) => typeFilter === "all" || r.type === typeFilter)
      .filter((r) => !q
        || r.name.toLowerCase().includes(q)
        || r.description.toLowerCase().includes(q))
      .slice()
      .sort((a, b) => {
        let av = a[sortBy.key]; let bv = b[sortBy.key];
        if (sortBy.key === "perms") { av = rolePermCount(a); bv = rolePermCount(b); }
        if (sortBy.key === "users") { av = a.userIds.length; bv = b.userIds.length; }
        const cmp = (typeof av === "number" && typeof bv === "number")
          ? av - bv
          : String(av || "").localeCompare(String(bv || ""));
        return sortBy.dir === "asc" ? cmp : -cmp;
      });
  }, [rows, query, typeFilter, sortBy]);

  const summary = useMR(() => {
    const curOrg = (window.getCurrentIndustryId && window.getCurrentIndustryId()) || "";
    const visible = rows.filter((r) => !r.orgOnly || r.orgOnly === curOrg);
    const systemCount = visible.filter((r) => r.type === "system").length;
    const customCount = visible.filter((r) => r.type === "custom").length;
    const totalAssignments = visible.reduce((s, r) => s + r.userIds.length, 0);
    const assignedUserIds = new Set();
    visible.forEach((r) => r.userIds.forEach((id) => assignedUserIds.add(id)));
    const unassigned = ROLE_USERS.length - assignedUserIds.size;
    return { systemCount, customCount, totalAssignments, assignedCount: assignedUserIds.size, unassigned };
  }, [rows]);

  const toggleSort = (key) => setSortBy((cur) =>
    cur.key === key ? { key, dir: cur.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" });

  const rowMenu = (row) => (e) => {
    e.stopPropagation();
    if (!window.openMenu) return;
    const items = [
      { icon: "View", label: "View details",  onClick: () => setPanel({ mode: "view", id: row.id }) },
      { icon: "Edit", label: row.type === "system" ? "Edit users & permissions" : "Edit role",
                                              onClick: () => setPanel({ mode: "edit", id: row.id }) },
      { icon: "Copy", label: "Duplicate",     onClick: () => {
        const cp = { ...row, id: `r-${Date.now()}`, name: `${row.name} (copy)`, type: "custom",
                     createdAt: "May 19, 2026", createdBy: "Amy Chen",
                     updatedAt: "May 19, 2026", updatedBy: "Amy Chen", userIds: [] };
        role_upsert(cp);
        if (window.showToast) window.showToast(`${row.name} duplicated — open the copy to edit`, { kind: "success" });
      }},
      { icon: "FileDownload", label: "Export permissions",
        onClick: () => window.showToast && window.showToast(`Permissions matrix for ${row.name} exported`, { kind: "success" }) },
    ];
    if (row.type !== "system") {
      items.push({ divider: true });
      items.push({ icon: "TrashCan", label: "Delete role", danger: true, onClick: () => {
        if (!window.openConfirm) { role_remove(row.id); return; }
        window.openConfirm({
          title: `Delete ${row.name}?`,
          body: `This will remove the role for ${row.userIds.length} assigned user${row.userIds.length === 1 ? "" : "s"}. They'll need to be reassigned to keep their access. This can't be undone.`,
          confirmLabel: "Delete", danger: true,
          onConfirm: () => {
            role_remove(row.id);
            if (window.showToast) window.showToast(`${row.name} deleted`, { kind: "success" });
          },
        });
      }});
    }
    window.openMenu(e.currentTarget, items);
  };

  return (
    <div className="rl-shell">
      {/* v0.77 spec §17 · axis-scoped permissions preview. Roles will
          gain axis facets (Approve Assignment × Milestone × Agency,
          Re-classify IC, Sign EOR local-employment template, …). Banner
          hidden at flag-off so today's catalog renders unchanged. */}
      {window.V77InfoBanner ? (
        <window.V77InfoBanner
          icon="Information"
          title="Roles are about to gain axis-scoped permissions."
        >
          Phase 4 adds axis facets to every permission so a role can be granted &ldquo;Approve Assignment × Milestone × Agency&rdquo; or &ldquo;Re-classify IC&rdquo; without expanding the broader permission. Today&rsquo;s catalog renders unchanged below.
        </window.V77InfoBanner>
      ) : null}
      {/* --- Page header --------------------------------------------- */}
      <div className="rl-page-header">
        <div className="rl-page-titlewrap">
          <h2 className="rl-page-title">User Roles</h2>
          <p className="rl-page-sub">
            Control who can see and act on what across Flex Work. Bundle Role Features into
            User Roles, scope them by site, and assign them to users. System roles ship
            with the platform &mdash; duplicate one to create your own.
          </p>
        </div>
        <div className="rl-page-header-actions">
          <button type="button" className="rl-btn rl-btn--secondary"
                  onClick={() => window.showToast && window.showToast("Role assignments exported — check your downloads", { kind: "success" })}>
            <Icon name="FileDownload" size={14} /> Export
          </button>
          <button type="button" className="rl-btn rl-btn--primary"
                  onClick={() => setPanel({ mode: "create" })}>
            <Icon name="AddCircle" size={16} /> New role
          </button>
        </div>
      </div>

      {/* --- KPI summary ------------------------------------------- */}
      <div className="rl-summary">
        <div className="rl-kpi">
          <span className="rl-kpi-label"><Icon name="ShieldPerson" size={12} /> Total roles</span>
          <span className="rl-kpi-value">{summary.systemCount + summary.customCount}</span>
          <span className="rl-kpi-foot">
            <span>{summary.systemCount} system</span><span>·</span>
            <span>{summary.customCount} custom</span>
          </span>
        </div>
        <div className="rl-kpi">
          <span className="rl-kpi-label"><Icon name="Users" size={12} /> Users assigned</span>
          <span className="rl-kpi-value">{summary.assignedCount}<span className="rl-kpi-of"> / {ROLE_USERS.length}</span></span>
          <span className="rl-kpi-foot">
            <span>{summary.totalAssignments} role assignment{summary.totalAssignments === 1 ? "" : "s"}</span>
            {summary.unassigned > 0 && (<><span>·</span><span className="warn">{summary.unassigned} unassigned</span></>)}
          </span>
        </div>
        <div className="rl-kpi">
          <span className="rl-kpi-label"><Icon name="ClipboardCircleCheck" size={12} /> Permissions in system</span>
          <span className="rl-kpi-value">{ROLE_TOTAL_PERMS}</span>
          <span className="rl-kpi-foot">
            <span>{ROLE_PERM_GROUPS.length} modules</span>
          </span>
        </div>
        <div className="rl-kpi">
          <span className="rl-kpi-label"><Icon name="Hourglass" size={12} /> Last changed</span>
          <span className="rl-kpi-value rl-kpi-value--sm">May 12, 2026</span>
          <span className="rl-kpi-foot">
            <span>Amy Chen edited Administrator</span>
          </span>
        </div>
      </div>

      {/* --- Toolbar / filters -------------------------------------- */}
      <div className="rl-toolbar">
        <div className="rl-toolbar-left">
          <div className="rl-search">
            <span className="rl-search-icon"><Icon name="Search" size={16} /></span>
            <input
              className="rl-search-input"
              placeholder="Search roles by name or description"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div className="rl-seg rl-seg--filter">
            {[
              { id: "all",    label: "All",    count: summary.systemCount + summary.customCount },
              { id: "system", label: "System", count: summary.systemCount },
              { id: "custom", label: "Custom", count: summary.customCount },
            ].map((t) => (
              <button key={t.id} type="button"
                      className="rl-seg-tab"
                      aria-pressed={typeFilter === t.id}
                      onClick={() => setType(t.id)}>
                {t.label}<span className="rl-seg-count">{t.count}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="rl-toolbar-count">
          Showing {filtered.length} of {summary.systemCount + summary.customCount}
        </div>
      </div>

      {/* --- Table -------------------------------------------------- */}
      <div className="rl-card">
        <table className="rl-table">
          <thead>
            <tr>
              <th onClick={() => toggleSort("name")} style={{ cursor: "pointer" }}>Role</th>
              <th className="rl-cell-type">Type</th>
              <th className="rl-cell-perms" onClick={() => toggleSort("perms")} style={{ cursor: "pointer" }}>Permissions</th>
              <th className="rl-cell-scope">Scope</th>
              <th className="rl-cell-users" onClick={() => toggleSort("users")} style={{ cursor: "pointer" }}>Users</th>
              <th className="rl-cell-updated">Last edited</th>
              <th aria-label="Actions"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={7}>
                <div className="rl-empty">
                  <Icon name="ShieldPerson" size={36} />
                  <h3 className="rl-empty-title">No roles match</h3>
                  <p className="rl-empty-body">
                    Try clearing your filters, or create a new role to bundle the right permissions for a job function.
                  </p>
                  <div style={{ marginTop: 12 }}>
                    <button type="button" className="rl-btn rl-btn--primary"
                            onClick={() => setPanel({ mode: "create" })}>
                      <Icon name="AddCircle" size={16} /> New role
                    </button>
                  </div>
                </div>
              </td></tr>
            ) : filtered.map((row) => {
              const pCount = rolePermCount(row);
              const scopeLabel = row.scope?.type === "all"
                ? "All sites"
                : (row.scope?.locations || []).length > 0
                  ? `${row.scope.locations.length} site${row.scope.locations.length === 1 ? "" : "s"}`
                  : "Site-scoped";
              return (
                <tr key={row.id}
                    onClick={() => setPanel({ mode: "view", id: row.id })}
                    tabIndex={0}
                    onKeyDown={(e) => { if (e.key === "Enter") setPanel({ mode: "view", id: row.id }); }}>
                  <td>
                    <div className="rl-row-name">
                      <RoleColorDot tone={row.color} />
                      <div className="rl-row-name-text">
                        <span className="rl-row-name-title">
                          {row.name}
                          {row.orgOnly && (
                            <span className="rl-orgonly-badge" title="Available only in the Dayforce platform org">
                              <Icon name="ShieldPerson" size={11} /> Dayforce only
                            </span>
                          )}
                        </span>
                        <span className="rl-row-name-sub">{row.description}</span>
                      </div>
                    </div>
                  </td>
                  <td className="rl-cell-type"><RoleTypeBadge type={row.type} /></td>
                  <td className="rl-cell-perms">
                    <RolePermBar count={pCount} />
                  </td>
                  <td className="rl-cell-scope">
                    <span className="rl-scope-pill" data-kind={row.scope?.type}>
                      <Icon name={row.scope?.type === "all" ? "Globe" : "Location"} size={12} />
                      {scopeLabel}
                    </span>
                  </td>
                  <td className="rl-cell-users">
                    <RoleAvatarStack userIds={row.userIds} max={4} size={26} />
                  </td>
                  <td className="rl-cell-updated">
                    <div className="rl-updated">
                      <span>{row.updatedAt}</span>
                      <span className="rl-updated-by">by {row.updatedBy}</span>
                    </div>
                  </td>
                  <td className="rl-cell-actions">
                    <button type="button" className="rl-icon-btn"
                            aria-label={`Actions for ${row.name}`}
                            onClick={rowMenu(row)}>
                      <Icon name="MoreVert" size={18} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* --- Side panel --------------------------------------------- */}
      {panel && (
        <RoleSidePanel
          mode={panel.mode}
          recordId={panel.id}
          onClose={() => setPanel(null)}
          onEdit={(id) => setPanel({ mode: "edit", id })}
        />
      )}
    </div>
  );
}

// =====================================================================
// SIDE PANEL — view / edit / create
// =====================================================================
function RoleSidePanel({ mode, recordId, onClose, onEdit }) {
  useER(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose && onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (mode === "view") {
    return <RoleDetailPanel recordId={recordId} onClose={onClose} onEdit={onEdit} />;
  }
  return <RoleEditPanel mode={mode} recordId={recordId} onClose={onClose} />;
}

// ---------- VIEW / DETAIL --------------------------------------------
function RoleDetailPanel({ recordId, onClose, onEdit }) {
  const [row, setRow] = useR(() => role_store().find((r) => r.id === recordId) || null);
  const [tab, setTab] = useR("permissions"); // permissions | users | activity

  useER(() => {
    const onChange = () => setRow(role_store().find((r) => r.id === recordId) || null);
    window.addEventListener("roles:change", onChange);
    return () => window.removeEventListener("roles:change", onChange);
  }, [recordId]);

  if (!row) return null;
  const pCount = rolePermCount(row);
  const users = row.userIds.map((id) => ROLE_USERS.find((u) => u.id === id)).filter(Boolean);

  const removeUser = (uid) => {
    const nextIds = row.userIds.filter((x) => x !== uid);
    role_upsert({ ...row, userIds: nextIds, updatedAt: "May 19, 2026", updatedBy: "Amy Chen" });
    if (window.showToast) window.showToast(`Removed from ${row.name}`, { kind: "success" });
  };

  return (
    <React.Fragment>
      <div className="rl-scrim" onClick={onClose} />
      <aside className="rl-panel rl-panel--wide" role="dialog" aria-labelledby="rl-panel-title">
        <header className="rl-panel-header">
          <div className="rl-panel-header-left">
            <div className="rl-panel-icon" data-tone={row.color}>
              <Icon name="ShieldPerson" size={20} />
            </div>
            <div className="rl-panel-titlewrap">
              <div className="rl-panel-titlerow">
                <h2 className="rl-panel-title" id="rl-panel-title">{row.name}</h2>
                <RoleTypeBadge type={row.type} />
              </div>
              <p className="rl-panel-sub">{row.description}</p>
            </div>
          </div>
          <button type="button" className="rl-icon-btn" aria-label="Close" onClick={onClose}>
            <Icon name="X" size={18} />
          </button>
        </header>

        {/* Quick stats row */}
        <div className="rl-detail-stats">
          <div className="rl-detail-stat">
            <span className="rl-detail-stat-label">Permissions</span>
            <span className="rl-detail-stat-value">{pCount}<span className="rl-detail-stat-of"> / {ROLE_TOTAL_PERMS}</span></span>
            <RolePermBar count={pCount} />
          </div>
          <div className="rl-detail-stat">
            <span className="rl-detail-stat-label">Assigned users</span>
            <span className="rl-detail-stat-value">{users.length}</span>
            <RoleAvatarStack userIds={row.userIds} max={6} size={26} />
          </div>
          <div className="rl-detail-stat">
            <span className="rl-detail-stat-label">Scope</span>
            <span className="rl-detail-stat-value rl-detail-stat-value--text">
              <Icon name={row.scope?.type === "all" ? "Globe" : "Location"} size={14} />
              {row.scope?.type === "all" ? "All sites" : `${row.scope?.locations?.length || 0} site${row.scope?.locations?.length === 1 ? "" : "s"}`}
            </span>
            {row.scope?.type === "specific" && row.scope?.locations?.length > 0 && (
              <span className="rl-detail-stat-meta">
                {row.scope.locations.slice(0, 2).join(" · ")}
                {row.scope.locations.length > 2 && ` +${row.scope.locations.length - 2}`}
              </span>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="rl-tabs" role="tablist">
          {[
            { id: "permissions", label: `Permissions (${pCount})` },
            { id: "users",       label: `Assigned users (${users.length})` },
            { id: "activity",    label: "Activity" },
          ].map((t) => (
            <button key={t.id} type="button" role="tab"
                    className="rl-tab"
                    aria-selected={tab === t.id}
                    onClick={() => setTab(t.id)}>
              {t.label}
            </button>
          ))}
        </div>

        <div className="rl-panel-body">
          {tab === "permissions" && (
            <div className="rl-perm-readonly">
              {ROLE_PERM_GROUPS.map((g) => {
                const onIds = g.perms.filter((p) => row.permissions?.[p.id]);
                const granted = onIds.length;
                const all = granted === g.perms.length;
                return (
                  <section key={g.id} className="rl-perm-group" data-state={granted === 0 ? "none" : all ? "all" : "some"}>
                    <header className="rl-perm-group-head">
                      <div className="rl-perm-group-title">
                        <span className="rl-perm-group-icon"><Icon name={g.icon} size={16} /></span>
                        <span>{g.label}</span>
                      </div>
                      <span className="rl-perm-group-count">
                        {granted === 0 ? "No access" : all ? "Full access" : `${granted} of ${g.perms.length}`}
                      </span>
                    </header>
                    <ul className="rl-perm-list">
                      {g.perms.map((p) => {
                        const has = !!row.permissions?.[p.id];
                        return (
                          <li key={p.id} className="rl-perm-li" data-on={has}>
                            <span className="rl-perm-li-mark">
                              <Icon name={has ? "Check" : "X"} size={14} />
                            </span>
                            <span className="rl-perm-li-text">
                              <span className="rl-perm-li-label">{p.label}</span>
                              <span className="rl-perm-li-caption">{p.caption}</span>
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                );
              })}
            </div>
          )}

          {tab === "users" && (
            <div className="rl-userlist">
              {users.length === 0 ? (
                <div className="rl-userlist-empty">
                  <Icon name="Users" size={28} />
                  <h4>No users in this role yet</h4>
                  <p>Edit the role to assign users — anyone with this role will inherit every permission below.</p>
                  <button type="button" className="rl-btn rl-btn--primary"
                          onClick={() => onEdit(row.id)}>
                    <Icon name="PersonPlus" size={14} /> Assign users
                  </button>
                </div>
              ) : users.map((u) => (
                <div className="rl-user-row" key={u.id}>
                  <RoleAvatar user={u} size={36} />
                  <div className="rl-user-row-text">
                    <div className="rl-user-row-name">{u.name}</div>
                    <div className="rl-user-row-meta">{u.title} · {u.location}</div>
                  </div>
                  <div className="rl-user-row-last">{u.lastActive}</div>
                  <button type="button" className="rl-icon-btn"
                          aria-label={`Remove ${u.name} from ${row.name}`}
                          onClick={() => removeUser(u.id)}>
                    <Icon name="X" size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {tab === "activity" && (
            <div className="rl-activity">
              {[
                { d: row.updatedAt, who: row.updatedBy, action: "Updated permissions",   detail: row.type === "system" ? "Re-baselined to system defaults" : "Granted Approve timesheets to this role" },
                { d: "Apr 24, 2026", who: "Amy Chen",       action: "Assigned 2 users",     detail: `${ROLE_USERS[2].name}, ${ROLE_USERS[3].name}` },
                { d: "Apr 18, 2026", who: "Amy Chen",       action: "Updated scope",        detail: row.scope?.type === "all" ? "Expanded to all sites" : `${row.scope?.locations?.length || 0} locations selected` },
                { d: row.createdAt, who: row.createdBy,    action: "Role created",         detail: row.type === "system" ? "Shipped with the platform" : "Cloned from Workforce Operations Manager" },
              ].map((e, i) => (
                <div className="rl-activity-row" key={i}>
                  <div className="rl-activity-dot" />
                  <div>
                    <div className="rl-activity-name">{e.action}</div>
                    <div className="rl-activity-meta">{e.d} · {e.who}{e.detail ? ` · ${e.detail}` : ""}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <footer className="rl-panel-footer">
          <div className="rl-panel-footer-left">
            <button type="button" className="rl-btn rl-btn--ghost" onClick={onClose}>Close</button>
          </div>
          <div className="rl-panel-footer-right">
            <button type="button" className="rl-btn rl-btn--secondary"
                    onClick={() => window.showToast && window.showToast(`Permissions matrix for ${row.name} exported`, { kind: "success" })}>
              <Icon name="FileDownload" size={14} /> Export
            </button>
            <button type="button" className="rl-btn rl-btn--primary"
                    onClick={() => onEdit(row.id)}>
              <Icon name="Edit" size={14} /> {row.type === "system" ? "Edit users & permissions" : "Edit role"}
            </button>
          </div>
        </footer>
      </aside>
    </React.Fragment>
  );
}

// ---------- EDIT / CREATE --------------------------------------------
const ROLE_LOCATION_POOL = [
  "DC Alpha · Atlanta, GA",
  "Warehouse #35 · Dallas, TX",
  "Warehouse #14 · Chicago, IL",
  "Hub-NJ · Edison, NJ",
  "Sam's Chalet · Aspen, CO",
  "Sam's Chalet · Vail, CO",
  "Phoenix DC · Phoenix, AZ",
  "Pacific Hub · Oakland, CA",
];

function RoleEditPanel({ mode, recordId, onClose }) {
  const existing = mode === "edit" ? role_store().find((r) => r.id === recordId) : null;

  const [name, setName]         = useR(existing?.name || "");
  const [desc, setDesc]         = useR(existing?.description || "");
  const [color, setColor]       = useR(existing?.color || "blue");
  const [perms, setPerms]       = useR(() => ({ ...(existing?.permissions || {}) }));
  const [scopeType, setScopeType] = useR(existing?.scope?.type || "all");
  const [scopeLocs, setScopeLocs] = useR(existing?.scope?.locations || []);
  const [userIds, setUserIds]   = useR(existing?.userIds || []);
  const [cloneFrom, setCloneFrom] = useR("");
  const [touched, setTouched]   = useR(false);
  const [userSearch, setUserSearch] = useR("");

  const trimmed = name.trim();
  const nameErr = touched && !trimmed;
  const canSave = !!trimmed;

  // System roles: permissions + scope are locked; only assignments editable.
  const isSystem = existing?.type === "system";

  const togglePerm = (id) => {
    if (isSystem) return;
    setPerms((cur) => ({ ...cur, [id]: !cur[id] }));
  };
  const setGroup = (gid, value) => {
    if (isSystem) return;
    const g = ROLE_PERM_GROUPS.find((x) => x.id === gid);
    setPerms((cur) => {
      const next = { ...cur };
      g.perms.forEach((p) => { next[p.id] = value; });
      return next;
    });
  };
  const groupGranted = (gid) => {
    const g = ROLE_PERM_GROUPS.find((x) => x.id === gid);
    return g.perms.reduce((s, p) => s + (perms[p.id] ? 1 : 0), 0);
  };

  const applyClone = (rid) => {
    setCloneFrom(rid);
    if (!rid) return;
    const src = role_store().find((r) => r.id === rid);
    if (!src) return;
    setPerms({ ...src.permissions });
    setScopeType(src.scope?.type || "all");
    setScopeLocs(src.scope?.locations || []);
    if (window.showToast) window.showToast(`Copied permissions from ${src.name}`, { kind: "success" });
  };

  const toggleUser = (uid) => {
    setUserIds((cur) => cur.includes(uid) ? cur.filter((x) => x !== uid) : [...cur, uid]);
  };
  const toggleLoc = (loc) => {
    setScopeLocs((cur) => cur.includes(loc) ? cur.filter((x) => x !== loc) : [...cur, loc]);
  };

  const handleSave = () => {
    setTouched(true);
    if (!trimmed) return;
    const next = {
      ...(existing || {
        id: undefined,
        type: "custom",
        createdAt: "May 19, 2026",
        createdBy: "Amy Chen",
      }),
      name: trimmed,
      description: desc.trim(),
      color,
      permissions: perms,
      scope: { type: scopeType, locations: scopeType === "specific" ? scopeLocs : [], departments: [] },
      userIds,
      updatedAt: "May 19, 2026",
      updatedBy: "Amy Chen",
    };
    role_upsert(next);
    if (window.showToast) {
      window.showToast(mode === "edit" ? `${trimmed} updated` : `${trimmed} created`, { kind: "success" });
    }
    onClose();
  };

  const handleDelete = () => {
    if (!existing || isSystem) return;
    const doDelete = () => { role_remove(existing.id); onClose();
      if (window.showToast) window.showToast(`${existing.name} deleted`, { kind: "success" }); };
    if (window.openConfirm) {
      window.openConfirm({
        title: `Delete ${existing.name}?`,
        body: `This will remove the role for ${existing.userIds.length} assigned user${existing.userIds.length === 1 ? "" : "s"}. They'll need to be reassigned to keep their access.`,
        confirmLabel: "Delete", danger: true,
        onConfirm: doDelete,
      });
    } else { doDelete(); }
  };

  const pCount = ROLE_ALL_PERM_IDS.reduce((s, id) => s + (perms[id] ? 1 : 0), 0);

  // User search
  const filteredUsers = useMR(() => {
    const q = userSearch.trim().toLowerCase();
    if (!q) return ROLE_USERS;
    return ROLE_USERS.filter((u) =>
      u.name.toLowerCase().includes(q) ||
      u.title.toLowerCase().includes(q) ||
      u.location.toLowerCase().includes(q));
  }, [userSearch]);

  return (
    <React.Fragment>
      <div className="rl-scrim" onClick={onClose} />
      <aside className="rl-panel rl-panel--wide" role="dialog" aria-labelledby="rl-panel-title">
        <header className="rl-panel-header">
          <div className="rl-panel-header-left">
            <div className="rl-panel-icon" data-tone={color}>
              <Icon name="ShieldPerson" size={20} />
            </div>
            <div className="rl-panel-titlewrap">
              <h2 className="rl-panel-title" id="rl-panel-title">
                {mode === "edit" ? (isSystem ? `Edit ${name || existing.name}` : `Edit ${name || existing.name}`) : "New role"}
              </h2>
              <p className="rl-panel-sub">
                {isSystem
                  ? "System role — permissions and scope are managed by Dayforce. You can adjust which users are assigned."
                  : "Bundle the permissions a job function needs, scope where they apply, and assign users."}
              </p>
            </div>
          </div>
          <button type="button" className="rl-icon-btn" aria-label="Close" onClick={onClose}>
            <Icon name="X" size={18} />
          </button>
        </header>

        <div className="rl-panel-body">
          {/* --- Identity ---------------------------------------- */}
          <section className="rl-edit-section">
            <h4 className="rl-edit-section-h">Role details</h4>
            <div className="rl-field">
              <label className="rl-field-label" htmlFor="rl-name">
                Name<span className="req">*</span>
              </label>
              <input id="rl-name" className="rl-input"
                     value={name} onChange={(e) => setName(e.target.value)}
                     onBlur={() => setTouched(true)}
                     placeholder="e.g. Regional Manager — South"
                     disabled={isSystem}
                     aria-invalid={nameErr || undefined} />
              {nameErr && <div className="rl-field-help rl-field-help--err">Give this role a name.</div>}
            </div>
            <div className="rl-field">
              <label className="rl-field-label" htmlFor="rl-desc">Description</label>
              <textarea id="rl-desc" className="rl-textarea"
                        value={desc} onChange={(e) => setDesc(e.target.value)}
                        rows={2}
                        disabled={isSystem}
                        placeholder="One-line summary of what this role can do." />
            </div>
            {!isSystem && (
              <div className="rl-field">
                <label className="rl-field-label">Color</label>
                <div className="rl-color-grid">
                  {ROLE_AVATAR_TONES.map((t) => (
                    <button key={t} type="button"
                            className="rl-color-swatch"
                            data-tone={t}
                            aria-pressed={color === t}
                            aria-label={t}
                            onClick={() => setColor(t)} />
                  ))}
                </div>
              </div>
            )}
          </section>

          {/* --- Clone-from (create only, when no existing perms) - */}
          {mode === "create" && (
            <section className="rl-edit-section">
              <h4 className="rl-edit-section-h">Start from a template</h4>
              <p className="rl-edit-section-sub">
                Copy permissions from an existing role to get a head start, then adjust below.
              </p>
              <div className="rl-field">
                <select className="rl-select"
                        value={cloneFrom}
                        onChange={(e) => applyClone(e.target.value)}>
                  <option value="">Start from scratch (no permissions)</option>
                  {role_store().map((r) => (
                    <option key={r.id} value={r.id}>{r.name} ({rolePermCount(r)} perms)</option>
                  ))}
                </select>
              </div>
            </section>
          )}

          {/* --- Scope ----------------------------------------- */}
          <section className="rl-edit-section">
            <h4 className="rl-edit-section-h">Where this role applies</h4>
            <div className="rl-radiorow">
              <label className="rl-radio">
                <input type="radio" name="rl-scope" value="all"
                       checked={scopeType === "all"}
                       disabled={isSystem}
                       onChange={() => setScopeType("all")} />
                <div className="rl-radio-text">
                  <span className="rl-radio-title"><Icon name="Globe" size={14} /> All sites</span>
                  <span className="rl-radio-sub">Permissions apply org-wide, no site filter.</span>
                </div>
              </label>
              <label className="rl-radio">
                <input type="radio" name="rl-scope" value="specific"
                       checked={scopeType === "specific"}
                       disabled={isSystem}
                       onChange={() => setScopeType("specific")} />
                <div className="rl-radio-text">
                  <span className="rl-radio-title"><Icon name="Location" size={14} /> Specific locations</span>
                  <span className="rl-radio-sub">Restrict to a chosen list of sites or properties.</span>
                </div>
              </label>
            </div>
            {scopeType === "specific" && (
              <div className="rl-picklist">
                {ROLE_LOCATION_POOL.map((loc) => (
                  <label className="rl-picklist-row" key={loc}>
                    <input type="checkbox"
                           checked={scopeLocs.includes(loc)}
                           disabled={isSystem}
                           onChange={() => toggleLoc(loc)} />
                    <span className="rl-picklist-row-name">
                      <Icon name="Location" size={14} /> {loc}
                    </span>
                  </label>
                ))}
              </div>
            )}
          </section>

          {/* --- Permissions matrix ----------------------------- */}
          <section className="rl-edit-section">
            <div className="rl-edit-section-hrow">
              <h4 className="rl-edit-section-h">Permissions</h4>
              <span className="rl-edit-section-meta">{pCount} of {ROLE_TOTAL_PERMS} granted</span>
            </div>
            {!isSystem && (
              <div className="rl-bulk-actions">
                <button type="button" className="rl-link"
                        onClick={() => {
                          const next = {};
                          ROLE_ALL_PERM_IDS.forEach((id) => { next[id] = true; });
                          setPerms(next);
                        }}>
                  <Icon name="Check" size={12} /> Grant all
                </button>
                <button type="button" className="rl-link"
                        onClick={() => setPerms({})}>
                  <Icon name="X" size={12} /> Clear all
                </button>
              </div>
            )}

            <div className="rl-permgrid">
              {ROLE_PERM_GROUPS.map((g) => {
                const granted = groupGranted(g.id);
                const total = g.perms.length;
                const state = granted === 0 ? "none" : granted === total ? "all" : "some";
                return (
                  <div key={g.id} className="rl-permgrid-group" data-state={state}>
                    <header className="rl-permgrid-head">
                      <div className="rl-permgrid-title">
                        <span className="rl-permgrid-icon"><Icon name={g.icon} size={16} /></span>
                        <span>{g.label}</span>
                      </div>
                      <div className="rl-permgrid-head-right">
                        <span className="rl-permgrid-count">{granted}/{total}</span>
                        {!isSystem && (
                          <button type="button"
                                  className="rl-permgrid-toggle"
                                  aria-pressed={state === "all"}
                                  data-state={state}
                                  onClick={() => setGroup(g.id, state !== "all")}
                                  title={state === "all" ? "Revoke all in group" : "Grant all in group"}>
                            <span className="rl-permgrid-toggle-knob" />
                          </button>
                        )}
                      </div>
                    </header>
                    <ul className="rl-permgrid-list">
                      {g.perms.map((p) => {
                        const on = !!perms[p.id];
                        return (
                          <li key={p.id} className="rl-permgrid-li">
                            <label className="rl-checkrow">
                              <input type="checkbox"
                                     checked={on}
                                     disabled={isSystem}
                                     onChange={() => togglePerm(p.id)} />
                              <span className="rl-checkrow-text">
                                <span className="rl-checkrow-label">{p.label}</span>
                                <span className="rl-checkrow-caption">{p.caption}</span>
                              </span>
                            </label>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                );
              })}
            </div>
          </section>

          {/* --- Assign users ----------------------------------- */}
          <section className="rl-edit-section">
            <div className="rl-edit-section-hrow">
              <h4 className="rl-edit-section-h">Assigned users</h4>
              <span className="rl-edit-section-meta">{userIds.length} selected</span>
            </div>

            <div className="rl-userpick-search">
              <span className="rl-search-icon"><Icon name="Search" size={14} /></span>
              <input className="rl-input rl-input--search"
                     value={userSearch}
                     onChange={(e) => setUserSearch(e.target.value)}
                     placeholder="Find a user by name, title, or site" />
            </div>

            {userIds.length > 0 && (
              <div className="rl-chiprow">
                {userIds.map((uid) => {
                  const u = ROLE_USERS.find((x) => x.id === uid);
                  if (!u) return null;
                  return (
                    <span key={uid} className="rl-chip">
                      <RoleAvatar user={u} size={18} />
                      {u.name}
                      <button type="button"
                              className="rl-chip-x"
                              aria-label={`Remove ${u.name}`}
                              onClick={() => toggleUser(uid)}>
                        <Icon name="X" size={12} />
                      </button>
                    </span>
                  );
                })}
              </div>
            )}

            <div className="rl-userpick">
              {filteredUsers.map((u) => {
                const on = userIds.includes(u.id);
                return (
                  <label key={u.id} className="rl-userpick-row" data-on={on}>
                    <input type="checkbox"
                           checked={on}
                           onChange={() => toggleUser(u.id)} />
                    <RoleAvatar user={u} size={32} />
                    <div className="rl-userpick-text">
                      <div className="rl-userpick-name">{u.name}</div>
                      <div className="rl-userpick-meta">{u.title} · {u.location}</div>
                    </div>
                  </label>
                );
              })}
              {filteredUsers.length === 0 && (
                <div className="rl-userpick-empty">No users match “{userSearch}”.</div>
              )}
            </div>
          </section>
        </div>

        <footer className="rl-panel-footer">
          <div className="rl-panel-footer-left">
            {mode === "edit" && !isSystem && (
              <button type="button" className="rl-btn rl-btn--ghost"
                      style={{ color: "var(--evr-interactive-error-default)" }}
                      onClick={handleDelete}>
                <Icon name="TrashCan" size={14} /> Delete role
              </button>
            )}
          </div>
          <div className="rl-panel-footer-right">
            <button type="button" className="rl-btn rl-btn--secondary" onClick={onClose}>Cancel</button>
            <button type="button" className="rl-btn rl-btn--primary"
                    onClick={handleSave} disabled={!canSave && touched}>
              <Icon name="Check" size={14} />
              {mode === "edit" ? "Save changes" : "Create role"}
            </button>
          </div>
        </footer>
      </aside>
    </React.Fragment>
  );
}

Object.assign(window, {
  RolesPage,
  role_store, role_upsert, role_remove,
  ROLE_USERS, ROLE_PERM_GROUPS, ROLE_TOTAL_PERMS,
});
