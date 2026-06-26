// =====================================================================
// Flex Work — Users (Settings · Users)
// Invite, manage, and audit the internal people who sign in to Flex Work
// — admins, managers, approvers, viewers. Distinct from `Workforce`
// (which is the people who DO the shifts) and from `User settings`
// (which is the signed-in user's personal preferences).
// =====================================================================

const { useState: useStateUA, useMemo: useMemoUA } = React;

// ---------- Mock data ---------------------------------------------------
// Realistic blend for a 6,000-employee retail org running Flex Work:
//  · A handful of admins (HQ ops + IT)
//  · District and site managers (per-region scope)
//  · Finance approvers (invoice ceilings)
//  · Read-only roles (audit, payroll, legal)
//  · A couple of pending invites and one deactivated former employee

const UA_ROLE_LIB = {
  admin:    { label: "Workforce admin",  pillHue: "informative" },
  manager:  { label: "Site manager",      pillHue: "default" },
  approver: { label: "Invoice approver",  pillHue: "warning" },
  viewer:   { label: "Read-only viewer",  pillHue: "default" },
  msp:      { label: "MSP partner",       pillHue: "default" },
};

const UA_USERS = [
  {
    id: "amy.chen",
    name: "Amy Chen", initials: "AC",
    email: "amy.chen@summit.example.com",
    title: "Workforce Operations Admin",
    department: "People Operations",
    roles: ["admin", "approver"],
    scope: "All sites · all suppliers",
    status: "Active",
    lastSeen: "Today, 7:48 AM",
    invitedBy: "Lena Park",
    invitedOn: "Mar 14, 2022",
    avatarHue: "purple",
    isYou: true,
  },
  {
    id: "marcus.webb",
    name: "Marcus Webb", initials: "MW",
    email: "marcus.webb@summit.example.com",
    title: "VP People Operations",
    department: "People Operations",
    roles: ["admin"],
    scope: "All sites · all suppliers",
    status: "Active",
    lastSeen: "Today, 9:12 AM",
    invitedBy: "Lena Park",
    invitedOn: "Jan 02, 2022",
    avatarHue: "blue",
  },
  {
    id: "nia.thompson",
    name: "Nia Thompson", initials: "NT",
    email: "nia.thompson@summit.example.com",
    title: "Supplier Program Manager",
    department: "People Operations",
    roles: ["admin", "approver"],
    scope: "All sites · 8 suppliers",
    status: "Active",
    lastSeen: "Today, 6:45 AM",
    invitedBy: "Amy Chen",
    invitedOn: "Aug 19, 2023",
    avatarHue: "green",
  },
  {
    id: "priya.anand",
    name: "Priya Anand", initials: "PA",
    email: "priya.anand@summit.example.com",
    title: "District Manager · West",
    department: "Store Operations",
    roles: ["manager", "approver"],
    scope: "West region · 14 sites",
    status: "Active",
    lastSeen: "Yesterday, 5:22 PM",
    invitedBy: "Marcus Webb",
    invitedOn: "Sep 11, 2023",
    avatarHue: "orange",
  },
  {
    id: "luis.ramirez",
    name: "Luis Ramirez", initials: "LR",
    email: "luis.ramirez@summit.example.com",
    title: "District Manager · Central",
    department: "Store Operations",
    roles: ["manager", "approver"],
    scope: "Central region · 11 sites",
    status: "Active",
    lastSeen: "Today, 8:01 AM",
    invitedBy: "Marcus Webb",
    invitedOn: "Sep 11, 2023",
    avatarHue: "teal",
  },
  {
    id: "rachel.kim",
    name: "Rachel Kim", initials: "RK",
    email: "rachel.kim@summit.example.com",
    title: "District Manager · East",
    department: "Store Operations",
    roles: ["manager"],
    scope: "East region · 17 sites",
    status: "Active",
    lastSeen: "Today, 7:14 AM",
    invitedBy: "Marcus Webb",
    invitedOn: "Sep 11, 2023",
    avatarHue: "red",
  },
  {
    id: "dan.osei",
    name: "Daniel Osei", initials: "DO",
    email: "daniel.osei@summit.example.com",
    title: "Site Manager · DFW Distribution",
    department: "Store Operations",
    roles: ["manager"],
    scope: "1 site · DFW Distribution",
    status: "Active",
    lastSeen: "Today, 6:02 AM",
    invitedBy: "Luis Ramirez",
    invitedOn: "Nov 04, 2024",
    avatarHue: "yellow",
  },
  {
    id: "maya.iyer",
    name: "Maya Iyer", initials: "MI",
    email: "maya.iyer@summit.example.com",
    title: "Senior Payroll Analyst",
    department: "Finance",
    roles: ["approver"],
    scope: "Up to $50,000 · all sites",
    status: "Active",
    lastSeen: "Yesterday, 3:38 PM",
    invitedBy: "Marcus Webb",
    invitedOn: "Feb 27, 2024",
    avatarHue: "purple",
  },
  {
    id: "tariq.silva",
    name: "Tariq Silva", initials: "TS",
    email: "tariq.silva@summit.example.com",
    title: "Director of Finance",
    department: "Finance",
    roles: ["admin", "approver"],
    scope: "All sites · unlimited",
    status: "Active",
    lastSeen: "Today, 8:54 AM",
    invitedBy: "Marcus Webb",
    invitedOn: "Apr 03, 2023",
    avatarHue: "blue",
  },
  {
    id: "elena.fischer",
    name: "Elena Fischer", initials: "EF",
    email: "elena.fischer@summit.example.com",
    title: "Payroll Operations",
    department: "Finance",
    roles: ["viewer"],
    scope: "All sites · read-only",
    status: "Active",
    lastSeen: "Mar 12, 2026",
    invitedBy: "Tariq Silva",
    invitedOn: "May 18, 2024",
    avatarHue: "green",
  },
  {
    id: "jamal.foster",
    name: "Jamal Foster", initials: "JF",
    email: "jamal.foster@summit.example.com",
    title: "Compliance & Audit Lead",
    department: "Legal",
    roles: ["viewer"],
    scope: "All sites · read-only",
    status: "Active",
    lastSeen: "May 14, 2026",
    invitedBy: "Marcus Webb",
    invitedOn: "Oct 21, 2023",
    avatarHue: "orange",
  },
  {
    id: "sage.holloway",
    name: "Sage Holloway", initials: "SH",
    email: "sage.holloway@summit.example.com",
    title: "Workforce Analyst",
    department: "People Operations",
    roles: ["viewer"],
    scope: "All sites · read-only",
    status: "Invited",
    lastSeen: "—",
    invitedBy: "Amy Chen",
    invitedOn: "May 16, 2026",
    inviteExpires: "May 23, 2026",
    avatarHue: "teal",
  },
  {
    id: "ben.alvarez",
    name: "Ben Alvarez", initials: "BA",
    email: "ben.alvarez@summit.example.com",
    title: "Site Manager · Portland #14",
    department: "Store Operations",
    roles: ["manager"],
    scope: "1 site · Portland #14",
    status: "Invited",
    lastSeen: "—",
    invitedBy: "Priya Anand",
    invitedOn: "May 18, 2026",
    inviteExpires: "May 25, 2026",
    avatarHue: "yellow",
  },
  {
    id: "hannah.lee",
    name: "Hannah Lee", initials: "HL",
    email: "hannah.lee@goodshift.com",
    title: "Account Lead, GoodShift",
    department: "Supplier partner",
    roles: ["msp"],
    scope: "GoodShift · 12 sites",
    status: "Invited",
    lastSeen: "—",
    invitedBy: "Nia Thompson",
    invitedOn: "May 12, 2026",
    inviteExpires: "May 19, 2026",
    expiringSoon: true,
    avatarHue: "purple",
  },
  {
    id: "owen.park",
    name: "Owen Park", initials: "OP",
    email: "owen.park@summit.example.com",
    title: "Former Site Manager",
    department: "Store Operations",
    roles: ["manager"],
    scope: "—",
    status: "Deactivated",
    lastSeen: "Feb 04, 2026",
    invitedBy: "Rachel Kim",
    invitedOn: "Jul 19, 2024",
    deactivatedOn: "Feb 28, 2026",
    avatarHue: "red",
  },
];

const UA_PAGE_SIZE = 10;

// ---------- Status pill --------------------------------------------------
const UA_STATUS_HUES = {
  "Active":      "success",
  "Invited":     "informative",
  "Deactivated": "default",
};

function UaStatusPill({ status }) {
  const hue = UA_STATUS_HUES[status] || "default";
  return <span className={`req-pill req-pill--${hue}`}>{status}</span>;
}

// ---------- Role chip (compact) ------------------------------------------
function UaRoleChip({ roleId }) {
  const r = UA_ROLE_LIB[roleId] || { label: roleId, pillHue: "default" };
  return <span className={`ua-role-chip ua-role-chip--${r.pillHue}`}>{r.label}</span>;
}

// ---------- Avatar -------------------------------------------------------
// Uses Everest decorative surfaces / content tokens so the bubbles stay on
// brand without picking arbitrary hexes.
function UaAvatar({ u, size = 36 }) {
  const fontSize = Math.max(11, Math.round(size * 0.36));
  const hue = u.avatarHue || "blue";
  return (
    <span
      className={`ua-avatar ua-avatar--${hue}`}
      style={{ width: size, height: size, fontSize }}
      aria-label={u.name}
    >
      {u.initials || (u.name || "?").slice(0, 1)}
    </span>
  );
}

// ---------- Top stats ----------------------------------------------------
function UaStatCard({ label, value, sub, tone }) {
  return (
    <div className={`ua-stat${tone ? ` ua-stat--${tone}` : ""}`}>
      <div className="ua-stat-label">{label}</div>
      <div className="ua-stat-value tabular">{value}</div>
      {sub && <div className="ua-stat-sub">{sub}</div>}
    </div>
  );
}

// ---------- Tabs ---------------------------------------------------------
function UaTabs({ value, counts, onChange }) {
  const tabs = [
    { id: "all",         label: "All users",   count: counts.all },
    { id: "Active",      label: "Active",      count: counts.Active },
    { id: "Invited",     label: "Pending invites", count: counts.Invited },
    { id: "Deactivated", label: "Deactivated", count: counts.Deactivated },
  ];
  return (
    <div className="ua-tabs" role="tablist" aria-label="Filter users by status">
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          role="tab"
          aria-selected={value === t.id}
          className={"ua-tab" + (value === t.id ? " ua-tab--active" : "")}
          onClick={() => onChange(t.id)}
        >
          <span>{t.label}</span>
          <span className="ua-tab-count tabular">{t.count}</span>
        </button>
      ))}
    </div>
  );
}

// ---------- Row ----------------------------------------------------------
function UaRow({ row, checked, onToggle, onOpen, onAction }) {
  const rowMenu = (e) => {
    e.stopPropagation();
    const items = [
      { icon: "View",        label: "View profile",   onClick: () => onOpen && onOpen(row) },
      { icon: "Edit",        label: "Edit user",      onClick: () => onAction && onAction("edit", row) },
      { icon: "ShieldPerson", label: "Manage roles",  onClick: () => onAction && onAction("roles", row) },
      { divider: true },
    ];
    if (row.status === "Invited") {
      items.push(
        { icon: "Send",   label: "Resend invite", onClick: () => onAction && onAction("resend", row) },
        { icon: "Copy",   label: "Copy invite link", onClick: () => onAction && onAction("copyLink", row) },
        { divider: true },
        { icon: "Cancel", label: "Revoke invite", danger: true, onClick: () => onAction && onAction("revoke", row) },
      );
    } else if (row.status === "Active") {
      items.push(
        { icon: "Send",   label: "Send password reset", onClick: () => onAction && onAction("reset", row) },
        { divider: true },
        { icon: "PersonUnauthorize", label: "Deactivate user", danger: true, onClick: () => onAction && onAction("deactivate", row) },
      );
    } else {
      items.push(
        { icon: "PersonAuthorize", label: "Reactivate user", onClick: () => onAction && onAction("reactivate", row) },
      );
    }
    openMenu(e.currentTarget, items);
  };

  return (
    <div
      className="req-row ua-row req-row--clickable"
      role="row"
      tabIndex={0}
      onClick={(e) => {
        if (e.target.closest("input,a,button")) return;
        onOpen && onOpen(row);
      }}
      onKeyDown={(e) => { if (e.key === "Enter") onOpen && onOpen(row); }}
    >
      <div className="req-cell req-cell--check" role="cell">
        <input
          type="checkbox"
          checked={checked}
          onChange={onToggle}
          aria-label={`Select ${row.name}`}
          onClick={(e) => e.stopPropagation()}
        />
      </div>
      <div className="ua-cell" role="cell">
        <div className="ua-user-cell">
          <UaAvatar u={row} size={40} />
          <div className="ua-user-stack">
            <span className="ua-user-name">
              {row.name}
              {row.isYou && <span className="ua-self-tag">You</span>}
            </span>
            <span className="ua-user-email">{row.email}</span>
          </div>
        </div>
      </div>
      <div className="ua-cell" role="cell">
        <div className="ua-role-list">
          {row.roles.map((r) => <UaRoleChip key={r} roleId={r} />)}
        </div>
      </div>
      <div className="ua-cell" role="cell">
        <div className="ua-stack">
          <span className="ua-stack-title">{row.department}</span>
          <span className="ua-stack-sub">{row.scope}</span>
        </div>
      </div>
      <div className="ua-cell" role="cell">
        <UaStatusPill status={row.status} />
        {row.status === "Invited" && (
          <div className={"ua-invite-meta" + (row.expiringSoon ? " ua-invite-meta--warn" : "")}>
            <Icon name={row.expiringSoon ? "Alert" : "TimeAdd"} size={12} />
            <span>Expires {row.inviteExpires}</span>
          </div>
        )}
      </div>
      <div className="ua-cell" role="cell">
        <span className="ua-lastseen tabular">{row.lastSeen}</span>
      </div>
      <div className="ua-cell ua-cell--actions" role="cell">
        <button
          type="button"
          className="iconbtn"
          aria-label={`More actions for ${row.name}`}
          onClick={rowMenu}
        >
          <Icon name="MoreVert" size={18} />
        </button>
      </div>
    </div>
  );
}

// ---------- Table --------------------------------------------------------
function UaHeaderCell({ children, className = "" }) {
  return (
    <div className={`ua-cell ${className}`} role="columnheader">
      <span>{children}</span>
      <span className="req-sort" aria-hidden="true" title="Sort" style={{ marginLeft: 4 }}>
        <Icon name="ArrowsUpDownSmall" size={14} />
      </span>
    </div>
  );
}

function UaTable({ rows, total, page, totalPages, pageSize, onPageChange, onPageSizeChange, onOpenRow, onAction }) {
  const [selected, setSelected] = useStateUA(() => new Set());
  const allChecked = rows.length > 0 && rows.every((r) => selected.has(r.id));

  const toggle = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const toggleAll = () => {
    setSelected((prev) => {
      if (allChecked) {
        const next = new Set(prev);
        rows.forEach((r) => next.delete(r.id));
        return next;
      }
      const next = new Set(prev);
      rows.forEach((r) => next.add(r.id));
      return next;
    });
  };

  const selectedCount = selected.size;

  return (
    <React.Fragment>
    <div className="req-table-card ua-table-card" role="table" aria-label="Internal users">
      <div className="req-scroll">
        <div className="req-row ua-row req-row--header" role="row">
          <div className="req-cell req-cell--check" role="columnheader">
            <input
              type="checkbox"
              checked={allChecked}
              onChange={toggleAll}
              aria-label="Select all rows on this page"
            />
          </div>
          <UaHeaderCell>User</UaHeaderCell>
          <UaHeaderCell>Roles</UaHeaderCell>
          <UaHeaderCell>Department &amp; access scope</UaHeaderCell>
          <UaHeaderCell>Status</UaHeaderCell>
          <UaHeaderCell>Last sign-in</UaHeaderCell>
          <div className="ua-cell ua-cell--actions" role="columnheader" aria-label=""></div>
        </div>

        <div className="req-body" role="rowgroup">
          {rows.length === 0 && (
            <div className="ua-empty">
              <img src="assets/illustrations/Rocketship.svg" alt="" role="presentation" width="120" height={Math.round(120 * (202 / 224))} />
              <h3>No users match those filters</h3>
              <p>Try clearing the search or switching tabs.</p>
            </div>
          )}
          {rows.map((row) => (
            <UaRow
              key={row.id}
              row={row}
              checked={selected.has(row.id)}
              onToggle={() => toggle(row.id)}
              onOpen={onOpenRow}
              onAction={onAction}
            />
          ))}
        </div>
      </div>

      {rows.length > 0 && (
        <Pagination
          page={page}
          totalPages={totalPages}
          total={total}
          pageSize={pageSize}
          onPageSizeChange={onPageSizeChange}
          onChange={onPageChange}
        />
      )}
    </div>

    {/* Shared bulk-action bar — unique action set for Users admin:
        identity-management moves an IT lead actually does in batches. */}
    <BulkActionBar
      count={selectedCount}
      noun="user"
      onClear={() => setSelected(new Set())}
      actions={[
        { icon: "Send",         label: "Send reminder", onClick: () => { showToast(`Reminder sent to ${selectedCount} user${selectedCount === 1 ? "" : "s"}`, { kind: "success" }); setSelected(new Set()); } },
        { icon: "ShieldPerson", label: "Change role",   onClick: () => { showToast(`Role editor opened for ${selectedCount} user${selectedCount === 1 ? "" : "s"}`, { kind: "info" }); } },
        { icon: "Stack",        label: "Update scope",  onClick: () => { showToast(`Access-scope editor opened for ${selectedCount} user${selectedCount === 1 ? "" : "s"}`, { kind: "info" }); } },
        { icon: "Lock",         label: "Reset password",onClick: () => { showToast(`Password reset emailed to ${selectedCount} user${selectedCount === 1 ? "" : "s"}`, { kind: "success" }); setSelected(new Set()); } },
        { icon: "FileDownload", label: "Export",        onClick: () => { showToast(`Exported ${selectedCount} user${selectedCount === 1 ? "" : "s"} to CSV`, { kind: "success" }); setSelected(new Set()); } },
        { divider: true },
        { icon: "PersonUnauthorize", label: "Deactivate", kind: "danger",
          onClick: () => openConfirm({
            title: `Deactivate ${selectedCount} user${selectedCount === 1 ? "" : "s"}?`,
            body: "They'll lose access immediately but their history stays auditable.",
            primaryLabel: "Deactivate",
            onConfirm: () => {
              showToast(`Deactivated ${selectedCount} user${selectedCount === 1 ? "" : "s"}`, { kind: "success" });
              setSelected(new Set());
            },
          }),
        },
      ]}
      overflow={[
        { icon: "PersonArrow", label: "Reassign manager", onClick: () => { showToast(`Manager reassignment opened for ${selectedCount} user${selectedCount === 1 ? "" : "s"}`, { kind: "info" }); } },
        { icon: "Refresh",     label: "Resend invite",    onClick: () => { showToast(`Invite resent to ${selectedCount} user${selectedCount === 1 ? "" : "s"}`, { kind: "success" }); setSelected(new Set()); } },
        { icon: "Notes",       label: "Add HR note",      onClick: () => { showToast(`HR note added to ${selectedCount} user${selectedCount === 1 ? "" : "s"}`, { kind: "success" }); setSelected(new Set()); } },
      ]}
    />
    </React.Fragment>
  );
}

// ---------- Invite users panel (sections schema) ------------------------
function inviteUserSchema() {
  return {
    title: "Invite users",
    subtitle: "They'll get an email with a link to set up their Dayforce sign-in. Invites expire after 7 days.",
    primaryLabel: "Send invites",
    initial: {
      emails: "",
      role: "Site manager",
      department: "Store Operations",
      scope: "All sites",
      message: "",
      requireMfa: true,
      notifyManager: true,
    },
    sections: [
      {
        title: "Who to invite",
        fields: [
          {
            key: "emails",
            label: "Work email(s)",
            kind: "textarea",
            required: true,
            placeholder: "name@summit.example.com, second@summit.example.com",
            hint: "Separate multiple addresses with a comma, space, or new line.",
          },
        ],
      },
      {
        title: "Access",
        grid: 2,
        fields: [
          {
            key: "role",
            label: "Role",
            kind: "select",
            required: true,
            options: ["Workforce admin", "Site manager", "Invoice approver", "Read-only viewer", "MSP partner"],
          },
          {
            key: "department",
            label: "Department",
            kind: "select",
            options: ["People Operations", "Store Operations", "Finance", "Legal", "IT", "Supplier partner"],
          },
          {
            key: "scope",
            label: "Access scope",
            kind: "select",
            span: 2,
            options: [
              "All sites · all suppliers",
              "West region · 14 sites",
              "Central region · 11 sites",
              "East region · 17 sites",
              "Single site (pick after invite)",
              "Custom — set in role permissions",
            ],
            hint: "Controls which locations and supplier records this user will see.",
          },
        ],
      },
      {
        title: "Invite email",
        fields: [
          {
            key: "message",
            label: "Personal note",
            kind: "textarea",
            placeholder: "Optional — appears at the top of the invite email.",
          },
        ],
      },
      {
        title: "Security",
        fields: [
          {
            key: "requireMfa",
            label: "Require two-factor authentication",
            kind: "toggle",
            onLabel: "Required",
            offLabel: "Optional",
            hint: "Dayforce will prompt them to enroll on first sign-in.",
          },
          {
            key: "notifyManager",
            label: "Notify their reporting manager",
            kind: "toggle",
            onLabel: "Yes",
            offLabel: "No",
          },
        ],
      },
    ],
  };
}

// ---------- Page wrapper -------------------------------------------------
function UsersAdminPage({ reloadKey, onReload, onGoTo }) {
  const [tab, setTab] = useStateUA("all");
  const [page, setPage] = useStateUA(1);
  const [pageSize, setPageSize] = useStateUA(UA_PAGE_SIZE);
  const [query, setQuery] = useStateUA("");
  const [roleFilter, setRoleFilter] = useStateUA("all");
  const [localKey, setLocalKey] = useStateUA(0);
  const handleLocalReload = () => {
    setLocalKey((k) => k + 1);
    showToast("User list refreshed");
    if (onReload) onReload();
  };

  const editEntity = useEditEntity();

  const counts = useMemoUA(() => {
    const c = { all: UA_USERS.length, Active: 0, Invited: 0, Deactivated: 0 };
    UA_USERS.forEach((u) => { c[u.status] = (c[u.status] || 0) + 1; });
    return c;
  }, []);

  const filtered = useMemoUA(() => {
    const q = query.trim().toLowerCase();
    return UA_USERS.filter((u) => {
      if (tab !== "all" && u.status !== tab) return false;
      if (roleFilter !== "all" && !u.roles.includes(roleFilter)) return false;
      if (!q) return true;
      return (
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        (u.title || "").toLowerCase().includes(q) ||
        (u.department || "").toLowerCase().includes(q) ||
        (u.scope || "").toLowerCase().includes(q)
      );
    });
  }, [tab, roleFilter, query]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const rows = useMemoUA(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize]);

  const handleOpen = (u) => {
    // The prototype renders a single profile (Amy's). Surface the click as
    // navigation so the linkage is obvious; flag non-Amy clicks so it's
    // clear what's happening in demo.
    if (!u.isYou) {
      showToast(`Opening profile for ${u.name}`);
    }
    if (typeof window !== "undefined" && window.flexGoTo) window.flexGoTo("userProfile");
    else if (onGoTo) onGoTo("userProfile");
  };

  const handleAction = (kind, u) => {
    switch (kind) {
      case "edit":
        editEntity.open({
          title: `Edit ${u.name}`,
          subtitle: "Update job details and access scope.",
          primaryLabel: "Save changes",
          initial: {
            name: u.name,
            email: u.email,
            title: u.title,
            department: u.department,
            scope: u.scope,
            role: UA_ROLE_LIB[u.roles[0]]?.label,
          },
          sections: [
            {
              title: "Identity",
              grid: 2,
              fields: [
                { key: "name",  label: "Full name", required: true },
                { key: "email", label: "Email",      required: true },
                { key: "title", label: "Job title",  span: 2 },
              ],
            },
            {
              title: "Access",
              grid: 2,
              fields: [
                { key: "department", label: "Department", kind: "select",
                  options: ["People Operations", "Store Operations", "Finance", "Legal", "IT", "Supplier partner"] },
                { key: "role",  label: "Primary role", kind: "select",
                  options: Object.values(UA_ROLE_LIB).map((r) => r.label) },
                { key: "scope", label: "Access scope", span: 2 },
              ],
            },
          ],
          onSave: () => showToast(`${u.name} updated`, { kind: "success" }),
        });
        break;
      case "roles":
        showToast("User Roles — preview only");
        break;
      case "resend":
        showToast(`Invite re-sent to ${u.email}`, { kind: "success" });
        break;
      case "copyLink":
        copyToClipboard(`https://app.dayforce.com/invite/${u.id}#token=preview`, "Invite link copied");
        break;
      case "revoke":
        openConfirm({
          title: `Revoke invite for ${u.name}?`,
          body: "The link they were emailed will stop working immediately.",
          primaryLabel: "Revoke invite",
          onConfirm: () => showToast(`Invite for ${u.name} revoked`, { kind: "success" }),
        });
        break;
      case "reset":
        showToast(`Password reset sent to ${u.email}`, { kind: "success" });
        break;
      case "deactivate":
        openConfirm({
          title: `Deactivate ${u.name}?`,
          body: `${u.name} will lose access immediately. Their approval history stays auditable.`,
          primaryLabel: "Deactivate",
          onConfirm: () => showToast(`${u.name} deactivated`, { kind: "success" }),
        });
        break;
      case "reactivate":
        showToast(`${u.name} reactivated`, { kind: "success" });
        break;
      default:
        break;
    }
  };

  const openInvite = () => {
    editEntity.open({
      ...inviteUserSchema(),
      onSave: (values) => {
        const raw = (values.emails || "").split(/[\s,;]+/).filter(Boolean);
        const n = raw.length || 1;
        showToast(
          `${n} invite${n === 1 ? "" : "s"} sent · expires in 7 days`,
          { kind: "success" }
        );
      },
    });
  };

  const handlePageSizeChange = (n) => { setPageSize(n); setPage(1); };
  const handleQuery = (v) => { setQuery(v); setPage(1); };
  const handleTab = (id) => { setTab(id); setPage(1); };
  const handleRole = (id) => { setRoleFilter(id); setPage(1); };

  // Expiring invites (within 3 days) — surfaced in stat card.
  const expiringCount = UA_USERS.filter((u) => u.status === "Invited" && u.expiringSoon).length;

  return (
    <React.Fragment>
      <div className="set-content ua-content" key={`${reloadKey || 0}-${localKey}`}>
        <header className="set-content-header ua-header">
          <div>
            <h2 className="set-content-title">Users</h2>
            <p className="set-content-sub">
              Invite, audit, and manage the people who sign in to Flex Work — admins, managers, approvers, and viewers.
              Workers who pick up shifts are managed in <a href="#workforce" onClick={(e) => { e.preventDefault(); onGoTo && onGoTo("workforce"); }}>Workforce</a>.
            </p>
          </div>
          <div className="ua-header-actions">
            <button
              type="button"
              className="btn btn--md btn--secondary"
              onClick={() => showToast("User Roles — preview only")}
            >
              <Icon name="ShieldPerson" size={16} />Manage roles
            </button>
            <button
              type="button"
              className="btn btn--md btn--primary"
              onClick={openInvite}
            >
              <Icon name="PersonPlus" size={16} />Invite users
            </button>
          </div>
        </header>

        {/* Stat row */}
        <div className="ua-stat-grid">
          <UaStatCard
            label="Internal users"
            value={counts.all - counts.Deactivated}
            sub={`${counts.Active} active · ${counts.Invited} pending`}
          />
          <UaStatCard
            label="Admins"
            value={UA_USERS.filter((u) => u.roles.includes("admin") && u.status === "Active").length}
            sub="Full-access roles"
          />
          <UaStatCard
            label="Approvers"
            value={UA_USERS.filter((u) => u.roles.includes("approver") && u.status === "Active").length}
            sub="Can sign off invoices & timesheets"
          />
          <UaStatCard
            label="Pending invites"
            value={counts.Invited}
            sub={expiringCount > 0 ? `${expiringCount} expiring this week` : "All within window"}
            tone={expiringCount > 0 ? "warn" : null}
          />
        </div>

        {/* Tabs */}
        <UaTabs value={tab} counts={counts} onChange={handleTab} />

        {/* Toolbar */}
        <div className="inv-toolbar ua-toolbar">
          <div className="inv-search">
            <span className="inv-search-icon" aria-hidden="true">
              <Icon name="Search" size={24} />
            </span>
            <input
              type="search"
              className="inv-search-input"
              placeholder="Search by name, email, department, or scope"
              value={query}
              onChange={(e) => handleQuery(e.target.value)}
              aria-label="Search users"
            />
          </div>
          <div className="ua-toolbar-controls">
            <label className="ua-select-wrap">
              <span className="ua-select-label">Role</span>
              <select
                className="acct-select ua-select"
                value={roleFilter}
                onChange={(e) => handleRole(e.target.value)}
              >
                <option value="all">All roles</option>
                {Object.entries(UA_ROLE_LIB).map(([id, r]) => (
                  <option key={id} value={id}>{r.label}</option>
                ))}
              </select>
            </label>
            <button
              type="button"
              className="iconbtn"
              onClick={handleLocalReload}
              aria-label="Reload content"
              title="Reload"
            >
              <Icon name="Refresh" size={18} />
            </button>
            <button
              type="button"
              className="iconbtn"
              aria-label="Export users"
              title="Export"
              onClick={() => showToast("Export started — we'll email you the CSV")}
            >
              <Icon name="FileDownload" size={18} />
            </button>
          </div>
        </div>

        <UaTable
          rows={rows}
          total={filtered.length}
          page={page}
          totalPages={totalPages}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={handlePageSizeChange}
          onOpenRow={handleOpen}
          onAction={handleAction}
        />
      </div>
      {editEntity.panel}
    </React.Fragment>
  );
}

Object.assign(window, { UsersAdminPage, UA_USERS, UA_ROLE_LIB });
