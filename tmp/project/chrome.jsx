// =====================================================================
// Flex Work — App chrome (shared on every page)
//   · AppNav   — docked top bar (logo + bell + avatar + menu toggle)
//   · GlobalNav — slide-out left dock with the primary navigation items
//   · Omnibar   — page-header pill (icon + title + slot for actions)
// All three follow the Everest spec from preview/*.html.
// =====================================================================

// ---------- Nav config ---------------------------------------------------
// Inbox, Insights and Compliance are no longer top-level navigation —
// they live as tabs inside the Dashboard "Home" hub.
// ---------- Today (shared "now" for the prototype) ----------------------
// Single source of truth for what the platform thinks "today" is. We
// anchor the demo to a fixed wall-clock so the seeded calendar, schedule
// and requisitions all read consistently across reloads — but if the
// browser's clock is past that anchor we let it roll forward, so the UI
// keeps pace with real time when somebody comes back to the prototype a
// week later.
const FLEX_DEMO_TODAY = new Date(2026, 4, 19); // Tue May 19, 2026 (EDT)
function flexToday() {
  const real = new Date();
  return real > FLEX_DEMO_TODAY ? real : new Date(FLEX_DEMO_TODAY);
}
// Format `today` against an explicit timezone (defaults to EDT) so the
// dashboard label stays stable even when the browser is in another zone.
function flexTodayLabel(opts = {}) {
  const {
    timeZone = "America/New_York",
    weekday  = "long",
    month    = "long",
    day      = "numeric",
    year     = "numeric",
  } = opts;
  try {
    return flexToday().toLocaleDateString("en-US", { timeZone, weekday, month, day, year });
  } catch (e) {
    return flexToday().toLocaleDateString("en-US", { weekday, month, day, year });
  }
}
Object.assign(window, { FLEX_DEMO_TODAY, flexToday, flexTodayLabel });

const NAV_ITEMS = [
  { id: "dashboard",     label: "Home",          icon: "Performance" },
  { id: "analytics",     label: "Analytics",     icon: "HeartBeat" },
  { id: "requisitions",  label: "Requisitions",  icon: "Briefcase" },
  { id: "schedule",      label: "Schedule",      icon: "Calendar" },
  { id: "timesheets",    label: "Timesheets",    icon: "PersonClock" },
  { id: "invoices",      label: "Invoices",      icon: "Pay" },
  { id: "suppliers",     label: "Suppliers",     icon: "Building" },
  { id: "workforce",     label: "Workforce",     icon: "Employees" },
  { id: "locations",     label: "Organization",  icon: "OrgChartVert" },
  { id: "settings",      label: "Settings",      icon: "Settings" },
];

// Per the universal-scopes rule (no per-engagement-type pages, no per-
// engagement-type nav items), the side-nav IA is type-blind. The
// previous build added a standalone "Contractors" entry when the
// contractors flag was on; that has been removed. Contractor records
// surface inside Workforce (as a pool + as an "Engagements" section on
// the worker profile) and inside Requisitions (via EngagementScope).
// SOW agreements live under Suppliers → Contracts and surface in
// Requisitions through the SOW variant body — never as a top-level
// nav entry.
function navItemsForRole(role) {
  const items = NAV_ITEMS;
  if (role === "agency") {
    return items
      .filter((i) => i.id !== "suppliers")
      .map((i) => i.id === "locations"
        ? { ...i, label: "Clients", icon: "Building" }
        : i);
  }
  return items;
}

// ---------- Manager: location dropdown (sidebar) -------------------------
// Compact select-style control that scopes all module data to one of the
// manager's sites. Lives at the top of GlobalNav above the primary nav.
// Single-select; "All my locations" is the empty-selection state.
function GnLocationDropdown({ managerLocs, selectedLocIds, onChange, tabIndex }) {
  const [open, setOpen] = React.useState(false);
  const rootRef = React.useRef(null);
  const ids = selectedLocIds || [];
  const allSel = ids.length === 0 || ids.length === managerLocs.length;
  const currentLabel = (() => {
    if (allSel) return "All my locations";
    if (ids.length === 1) {
      const l = managerLocs.find((x) => x.id === ids[0]);
      return l ? l.name : "1 location";
    }
    return `${ids.length} locations`;
  })();

  // Close on outside click / Escape.
  React.useEffect(() => {
    if (!open) return;
    const onDoc = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const pick = (id) => {
    onChange && onChange(id === null ? [] : [id]);
    setOpen(false);
  };

  return (
    <div className={`gn-locdd${open ? " gn-locdd--open" : ""}`} ref={rootRef}>
      <div className="gn-locdd-label">My locations</div>
      <button
        type="button"
        className="gn-locdd-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        tabIndex={tabIndex}
      >
        <span className="gn-locdd-icon" aria-hidden="true">
          <Icon name="Location" size={18} />
        </span>
        <span className="gn-locdd-current" title={currentLabel}>{currentLabel}</span>
        <span className="gn-locdd-chev" aria-hidden="true">
          <Icon name="ChevronDown" size={16} />
        </span>
      </button>
      {open && (
        <ul className="gn-locdd-list" role="listbox" aria-label="Filter by site">
          <li>
            <button
              type="button"
              role="option"
              aria-selected={allSel}
              className={`gn-locdd-opt${allSel ? " gn-locdd-opt--active" : ""}`}
              onClick={() => pick(null)}
            >
              <span className="gn-locdd-opt-name">All my locations</span>
              <span className="gn-locdd-opt-check" aria-hidden="true">
                {allSel ? <Icon name="Check" size={16} /> : null}
              </span>
            </button>
          </li>
          <li className="gn-locdd-divider" aria-hidden="true" />
          {managerLocs.map((l) => {
            const sel = !allSel && ids.length === 1 && ids[0] === l.id;
            return (
              <li key={l.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={sel}
                  className={`gn-locdd-opt${sel ? " gn-locdd-opt--active" : ""}`}
                  onClick={() => pick(l.id)}
                >
                  <span className="gn-locdd-opt-name" title={l.name}>{l.name}</span>
                  <span className="gn-locdd-opt-check" aria-hidden="true">
                    {sel ? <Icon name="Check" size={16} /> : null}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// ---------- Global Navigation panel --------------------------------------
// `subsection` switches the panel into a section-scoped mode:
//   { label, items: [{ id, label, icon }], currentId, onSelect, onBack }
// When set, the org card + primary nav are replaced by a header
// (section label + collapse-back button) and the section's items.
//
// `viewAsRole` + `selectedLocIds` + `onChangeSelectedLocs` light up the
// manager "My locations" picker that sits between the org card and the
// primary nav. Empty selectedLocIds === "All my locations".
function GlobalNav({
  open, current, onSelect, subsection,
  viewAsRole = "admin",
  selectedLocIds = [],
  onChangeSelectedLocs,
  embedded = false,
  collapsed = false,
  onToggleCollapse,
}) {
  // Subscribe to feature-flag changes so navItemsForRole's flag-gated
  // entries (e.g. Contractors) appear / disappear in place when an admin
  // toggles the flag without requiring a reload. The hook return value
  // is unused — the subscription is the side effect that re-renders us.
  if (typeof window !== "undefined" && window.useFeatureFlag) {
    window.useFeatureFlag("contractors");
    // Agency Pro · re-render the dock when the agencyPro flag toggles
    // so Plans / HCM Sync / Employees / Direct clients appear or
    // disappear from the agency settings list in step with the flag.
    window.useFeatureFlag("agencyPro");
    // v0.85 · re-render the dock when the customFields flag toggles
    // so the Custom Fields settings tab appears/disappears in step
    // with the flag (the dock items are filtered in app.jsx by the
    // section's `flag` property reading getFeatureFlag).
    window.useFeatureFlag("customFields");
  }

  // ---- Subsection mode (e.g. Settings tabs) ----
  if (subsection) {
    return (
      <aside
        id="global-nav"
        className={`gn-panel gn-panel--sub${open ? " open" : ""}`}
        aria-label={`${subsection.label} navigation`}
        aria-hidden={!open}
      >
        <div className="gn-sub-header">
          <span className="gn-sub-label">{subsection.label}</span>
          {embedded && onToggleCollapse && (
            <button
              type="button"
              className="iconbtn gn-collapse-btn"
              onClick={onToggleCollapse}
              aria-label={collapsed ? "Expand navigation" : "Collapse navigation"}
              title={collapsed ? "Expand" : "Collapse"}
              tabIndex={open ? 0 : -1}
            >
              <Icon name={collapsed ? "ChevronRight" : "ChevronLeft"} size={18} />
            </button>
          )}
          <button
            type="button"
            className="iconbtn gn-sub-back"
            onClick={subsection.onBack}
            aria-label="Back to main navigation"
            title="Back to main navigation"
            tabIndex={open ? 0 : -1}
          >
            <Icon name="PanelRight" size={20} />
          </button>
        </div>
        <nav className="gn-list" aria-label={subsection.label}>
          {(subsection.items || []).map((item) => {
            const active = item.id === subsection.currentId;
            return (
              <button
                key={item.id}
                type="button"
                className={`gn-item${active ? " gn-item--active" : ""}`}
                onClick={() => subsection.onSelect(item.id)}
                aria-current={active ? "page" : undefined}
                title={embedded ? item.label : undefined}
                tabIndex={open ? 0 : -1}
              >
                <span className="gn-item-icon" aria-hidden="true">
                  <Icon name={item.icon} size={24} />
                </span>
                <span className="gn-item-label">{item.label}</span>
              </button>
            );
          })}
        </nav>
      </aside>
    );
  }

  // ---- Default (main) mode ----
  // Manager location dropdown sits above the primary nav and filters all
  // module data to one site (or all of the manager's sites). The same
  // selection is mirrored in the account menu's Location row.
  const showLocDropdown = viewAsRole === "manager";
  const managerLocs = ((window.LOCATIONS || [])
    .filter((l) => l.status === "Active")
    .slice(0, 4));
  return (
    <aside
      id="global-nav"
      className={`gn-panel${open ? " open" : ""}`}
      aria-label="Global navigation"
      aria-hidden={!open}
    >
      {embedded && typeof window !== "undefined" && window.DfModuleHeader && (
        <window.DfModuleHeader collapsed={collapsed} onToggle={onToggleCollapse} />
      )}
      <nav className="gn-list" aria-label="Primary">
        {navItemsForRole(viewAsRole).map((item) => {
          const Edu = typeof window !== "undefined" ? window.VmsEduHover : null;
          const btn = (
            <button
              key={item.id}
              type="button"
              className={`gn-item${item.id === current ? " gn-item--active" : ""}`}
              onClick={() => onSelect(item.id)}
              aria-current={item.id === current ? "page" : undefined}
              title={embedded ? item.label : undefined}
              tabIndex={open ? 0 : -1}
            >
              <span className="gn-item-icon" aria-hidden="true">
                <Icon name={item.icon} size={24} />
              </span>
              <span className="gn-item-label">{item.label}</span>
            </button>
          );
          return Edu
            ? <Edu key={item.id} topicId={item.id} placement="right">{btn}</Edu>
            : btn;
        })}
      </nav>
    </aside>
  );
}

// ---------- Role helpers (avatar + account menu) -------------------------
const ROLE_LABELS = {
  admin:   "Admin",
  manager: "Manager",
  msp:     "MSP",
  worker:  "Worker",
  agency:  "Agency",
};

// MSP partner programs — a single MSP login can run multiple buyer programs from
// one tenant. Selecting one rebrands the chrome and scopes data to that program.
const MSP_PROGRAMS = [
  { id: "aurora",    name: "Aurora Hotels & Resorts", industry: "hospitality", mark: "AU", color: "#A0541A" },
  { id: "mercy",     name: "Mercy Health System",     industry: "healthcare",  mark: "MH", color: "#147A78" },
  { id: "northwind", name: "Northwind Retail",        industry: "retail",      mark: "NW", color: "#5C36A3" },
  { id: "midland",   name: "Midland Logistics",       industry: "logistics",   mark: "ML", color: "#1E4FB0" },
];

// ---------- App bar -------------------------------------------------------
function AppNav({
  navOpen, onToggleNav, onGoTo, onSignOut,
  sessionRole = "admin", sessionName = "Amy Chen",
  viewAsRole = "admin", onChangeViewAs,
  selectedLocIds = [], onChangeSelectedLocs,
  // Embedded mode renders the Dayforce platform top bar: Dayforce
  // wordmark, a platform search pill, and a Help utility — the Flex
  // Work nav lives in a docked 2nd-tier sidebar, so the hamburger is
  // dropped. `onBrandClick` lets the platform logo route to Dayforce
  // Home rather than the Flex Work dashboard.
  embedded = false, onBrandClick,
  // Collapse control for the embedded 1st-tier Dayforce rail.
  onToggleRail, railCollapsed = false,
  // DEMO-ONLY presentation toggle (Standalone vs Embedded-in-Dayforce).
  // Surfaced under the account menu's "Demo controls" group. This is a
  // prototype affordance for stakeholder reviews — it is NOT a product
  // setting and must never gate shippable behaviour.
  shellMode = "embedded", onChangeShellMode,
}) {
  const go = (target) => () => (onGoTo ? onGoTo(target) : null);
  const initials = (sessionName || "").split(/\s+/).map((p) => p[0] || "").join("").slice(0, 2).toUpperCase() || "AC";
  const roleLabel = ROLE_LABELS[sessionRole] || "Admin";
  const viewAsLabel = ROLE_LABELS[viewAsRole] || "Admin";

  // Active organization context — surfaces in the account menu (Organization
  // and Country rows). Country opens the full CountryPicker popover, which is
  // rendered alongside this component so it survives the account menu close.
  const industry = (window.getIndustry && window.getIndustry()) || null;
  const country  = (window.getCurrentCountry && window.getCurrentCountry()) || null;
  const avatarRef = React.useRef(null);
  const [countryPickerOpen, setCountryPickerOpen] = React.useState(false);

  // Live unread count for the notification bell. Subscribes to the
  // Interactions event bus so the badge ticks down as the user reads /
  // dismisses items inside the side panel.
  const [bellCount, setBellCount] = React.useState(
    () => (window.unreadNotifCount ? window.unreadNotifCount() : 0)
  );
  React.useEffect(() => {
    const recalc = () => setBellCount(window.unreadNotifCount ? window.unreadNotifCount() : 0);
    recalc();
    if (!window.Interactions) return;
    const off = window.Interactions.on("notifsChanged", recalc);
    return off;
  }, []);
  const onPickCountry = (code) => {
    setCountryPickerOpen(false);
    const c = window.COUNTRY_BY_CODE && window.COUNTRY_BY_CODE[code];
    if (window.applyCountryInstant) {
      window.applyCountryInstant(code);
    } else if (industry && window.setCountryForIndustry) {
      window.setCountryForIndustry(industry.id, code);
    }
    showToast(`Switched to ${c ? c.name : code} \u00b7 ${c ? c.currency : ""}`.trim(), { kind: "success" });
    // The account menu lives in InteractionsHost state — it doesn't reactively
    // re-render when AppNav re-renders. Re-emit it so the Country row label
    // and the submenu's checkmarks reflect the new selection immediately.
    if (avatarRef.current) {
      openAccountMenu(avatarRef.current);
    }
  };

  // Locations the manager has access to (deterministic subset of LOCATIONS).
  const managerLocs = ((window.LOCATIONS || [])
    .filter((l) => l.status === "Active")
    .slice(0, 4));
  const allLocIds = managerLocs.map((l) => l.id);
  const selectedSet = new Set(selectedLocIds && selectedLocIds.length ? selectedLocIds : allLocIds);
  const selectedCount = selectedSet.size;
  const locLabel = (() => {
    if (selectedCount === 0 || selectedCount === managerLocs.length) return "All my locations";
    if (selectedCount === 1) {
      const id = [...selectedSet][0];
      const l = managerLocs.find((x) => x.id === id);
      return l ? l.name : "1 location";
    }
    return `${selectedCount} locations`;
  })();

  // Role submenu items — surfaced as a cascading hover submenu on the
  // "Role · …" row in the account menu (see ActionMenu's `children` prop).
  const orgIsAgency = window.isAgencyOrg && window.isAgencyOrg();
  const roleSubmenuItems = [
    { header: "Viewing as" },
    // Enterprise orgs see admin/manager/msp; agency orgs ONLY see Agency.
    ...(orgIsAgency
      ? [{ icon: viewAsRole === "agency"  ? "Check" : "Briefcase",    label: "Agency",     onClick: () => onChangeViewAs && onChangeViewAs("agency") }]
      : [
          { icon: viewAsRole === "admin"   ? "Check" : "ShieldPerson", label: "Admin",       onClick: () => onChangeViewAs && onChangeViewAs("admin") },
          // Manager — has a sub-picker for Web vs Mobile. The web option
          // does the standard role swap; mobile opens the docked iPhone
          // preview alongside whatever the desktop chrome is showing.
          { icon: viewAsRole === "manager" ? "Check" : "PersonLines",  label: "Manager",
            children: [
              { header: "Surface" },
              { icon: viewAsRole === "manager" ? "Check" : "Building", label: "Web",
                onClick: () => onChangeViewAs && onChangeViewAs("manager") },
              { icon: (typeof window !== "undefined" && window.flexManagerPanelOpen) ? "Check" : "Phone", label: "Mobile",
                onClick: () => onChangeViewAs && onChangeViewAs("manager-mobile") },
            ] },
          { icon: viewAsRole === "msp"     ? "Check" : "Building",     label: "MSP",        onClick: () => onChangeViewAs && onChangeViewAs("msp") },
        ]),
    { divider: true },
    { icon: (typeof window !== "undefined" && window.flexWorkerPanelOpen) ? "Check" : "PersonClock",  label: "Worker", onClick: () => onChangeViewAs && onChangeViewAs("worker") },
  ];

  // Organization submenu — cascading hover list of all industries the signed-in
  // user can switch into. Mirrors the Role row's behavior.
  const allIndustries = (window.INDUSTRY_ORDER || []).map((id) => window.INDUSTRIES && window.INDUSTRIES[id]).filter(Boolean);
  const orgSubmenuItems = [
    { header: "Switch organization" },
    ...allIndustries.map((o) => ({
      icon: industry && o.id === industry.id ? "Check" : "Building",
      label: o.name,
      onClick: () => {
        if (industry && o.id === industry.id) return;
        if (window.setCurrentIndustryId) window.setCurrentIndustryId(o.id);
        if (window.showAppLoader) window.showAppLoader("Loading\u2026", `Switching to ${o.name}`);
        setTimeout(() => { try { window.location.reload(); } catch (err) {} }, 250);
      },
    })),
  ];

  // Temp Spend submenu — picks a tier ($1M … $500M+) which scales the
  // ENTIRE prototype's data (shifts/year, spend, workers, locations,
  // suppliers, countries). Changing the tier requires a full reload
  // because the scale is applied at module-eval time across vms-data /
  // analytics / insights / budgets / etc.
  const tempSpend = (window.getTempSpend && window.getTempSpend()) || null;
  const allTiers  = window.TEMP_SPEND_TIERS || [];
  const _tierLabel = (t) => {
    // Compact single-line summary that fits the 220px submenu width.
    //   "$50M   ·   90k shifts/yr   ·   62 sites"
    const k = (n) => n >= 1_000_000 ? (n / 1_000_000).toFixed(n >= 1e7 ? 0 : 1) + "M"
                  : n >= 1_000     ? Math.round(n / 1_000) + "k"
                  : String(n);
    return `${t.label}  \u00b7  ${k(t.shiftsYear)} shifts/yr  \u00b7  ${t.locations.toLocaleString("en-US")} site${t.locations === 1 ? "" : "s"}`;
  };
  const tsSubmenuItems = tempSpend ? [
    { header: "Simulate org by temp spend" },
    ...allTiers.map((t) => ({
      icon: t.id === tempSpend.id ? "Check" : "Pay",
      label: _tierLabel(t),
      onClick: () => {
        if (t.id === tempSpend.id) return;
        if (window.setCurrentTempSpendId) window.setCurrentTempSpendId(t.id);
        if (window.showAppLoader) window.showAppLoader("Loading\u2026", `Switching to ${t.label} temp spend`);
        setTimeout(() => { try { window.location.reload(); } catch (err) {} }, 250);
      },
    })),
  ] : [];

  // Country submenu — built per-call so a re-emit (triggered by
  // applyCountryInstant from the picker) reflects the new active code in
  // the checkmark column. Currently used only if the Country row ever
  // wires up `children`; the row itself opens the full picker via onClick.
  const buildCountrySubmenuItems = (activeCountry) => {
    if (!activeCountry) return [];
    const byCode = window.COUNTRY_BY_CODE || {};
    const opts = (window.PICKER_COUNTRIES || ["US","CA","GB","DE","AU","JP"])
      .map((c) => byCode[c])
      .filter(Boolean)
      .sort((a, b) => a.name.localeCompare(b.name));
    return [
      { header: "Switch country" },
      ...opts.map((c) => ({
        icon: c.code === activeCountry.code ? "Check" : "Globe",
        label: `${c.name} \u00b7 ${c.currency}`,
        onClick: () => onPickCountry(c.code),
      })),
      { divider: true },
      { icon: "Search", label: "Open country picker\u2026", keepOpen: true, onClick: () => setCountryPickerOpen(true) },
    ];
  };

  // Location submenu (manager only) — radio-style picker for which sites
  // bound the dashboard's data. Mirrors the existing GlobalNav loc list.
  const locSubmenuItems = (() => {
    if (viewAsRole !== "manager") return [];
    const allActive = selectedCount === 0 || selectedCount === managerLocs.length;
    return [
      { header: "Filter by location" },
      {
        icon: allActive ? "Check" : "OrgChartHoriz",
        label: "All my sites",
        onClick: () => onChangeSelectedLocs && onChangeSelectedLocs([]),
      },
      { divider: true },
      ...managerLocs.map((l) => {
        const isOnly = selectedSet.size === 1 && selectedSet.has(l.id);
        return {
          icon: isOnly ? "Check" : "Location",
          label: l.name,
          onClick: () => onChangeSelectedLocs && onChangeSelectedLocs(isOnly ? [] : [l.id]),
        };
      }),
    ];
  })();

  const openAccountMenu = (anchor) => {
    // DEMO-ONLY shell presentation toggle. Lets a reviewer flip between
    // the standalone Flex Work chrome and the embedded Dayforce-platform
    // shell. Prototype scaffolding only — not a setting we intend to ship.
    const shellSubmenuItems = [
      { header: "Demo presentation — not a product setting" },
      { icon: shellMode === "standalone" ? "Check" : "Shapes",
        label: "Standalone (Flex Work only)",
        onClick: () => onChangeShellMode && onChangeShellMode("standalone") },
      { icon: shellMode === "embedded" ? "Check" : "Grid",
        label: "Embedded in Dayforce",
        onClick: () => onChangeShellMode && onChangeShellMode("embedded") },
    ];
    // Read country fresh at call time — re-emits after applyCountryInstant
    // need the new label and the InteractionsHost menu state isn't
    // reactively tied to AppNav's render.
    const liveCountry = (window.getCurrentCountry && window.getCurrentCountry()) || country;
    openMenu(anchor, [
      { header: "Signed in as" },
      ...(viewAsRole === "msp" ? [{
        icon: "Building",
        label: `Program · ${activeProgramLabel}`,
        children: mspSubmenuItems,
      }] : []),
      ...(industry ? [{
        icon: "Building",
        label: industry.name,
        children: orgSubmenuItems,
      }] : []),
      { icon: viewAsRole === "admin" ? "ShieldPerson" : (viewAsRole === "msp" ? "Building" : (viewAsRole === "agency" ? "Briefcase" : (viewAsRole === "worker" ? "PersonClock" : "PersonLines"))),
        label: viewAsLabel,
        children: roleSubmenuItems },
      ...(viewAsRole === "manager" ? [{
        icon: "Location",
        label: `Location · ${locLabel}`,
        children: locSubmenuItems,
      }] : []),
      ...(liveCountry ? [{
        icon: "Globe",
        label: liveCountry.name,
        children: buildCountrySubmenuItems(liveCountry),
      }] : []),
      { divider: true },
      { header: "Demo controls" },
      {
        icon: "Stack",
        label: `Experience \u00b7 ${shellMode === "embedded" ? "Embedded" : "Standalone"}`,
        children: shellSubmenuItems,
        submenuWidth: 300,
      },
      ...(tempSpend ? [
        {
          icon: "Pay",
          label: `${tempSpend.label} (${tempSpend.segment})`,
          children: tsSubmenuItems,
          submenuWidth: 300,
        },
      ] : []),
      { divider: true },
      { icon: "PersonLines", label: "Your profile",    onClick: go("userProfile") },
      { icon: "Settings",    label: "Account settings",        onClick: go("userSettings") },
      { icon: "Help",        label: "Help & support",
        children: [
          { header: "Help center" },
          { icon: "ShieldPerson", label: "Internal", onClick: go("helpCenter") },
          { icon: "Users",        label: "Customer", onClick: () => showToast("Opening customer help portal") },
          { divider: true },
          { header: "Developers" },
          { icon: "Code",         label: "API reference",
            onClick: () => window.open("Feature Audits/Flex Work API Reference.html", "_blank") },
          { icon: "File",         label: "Changelog",
            onClick: () => window.open("Flex Work v2 Changelog.html", "_blank") },
        ] },
      { divider: true },
      { icon: "PersonArrow", label: "Sign out", danger: true,
        onClick: () => openConfirm({
          title: "Sign out of Flex Work?",
          body: "You\u2019ll need to sign in again to view bookings and approvals.",
          primaryLabel: "Sign out",
          onConfirm: () => onSignOut && onSignOut(),
        }) },
    ], { ignoreOutsideSelector: ".cp-pop" });
  };

  // MSP tenant scope — the MSP submenu doesn't reload the app any more.
  // It writes into window.getMspScope / setMspScope (see pages/msp-mode.jsx)
  // which drives the per-row tenant tagging + the in-page Tenant filter
  // chip. Empty scope == "All programs"; otherwise the submenu's checkmarks
  // reflect the multi-selected set.
  const mspScope = (typeof window !== "undefined" && window.getMspScope) ? window.getMspScope() : [];
  const mspAll   = mspScope.length === 0;
  const activeProgramLabel = mspAll
    ? "All programs"
    : (mspScope.length === 1
        ? (MSP_PROGRAMS.find((p) => p.id === mspScope[0]) || MSP_PROGRAMS[0]).name
        : `${mspScope.length} of ${MSP_PROGRAMS.length} programs`);
  // Used by the legacy "active program" badge in the account menu header.
  const activeProgram = MSP_PROGRAMS.find((p) => p.id === mspScope[0]) || MSP_PROGRAMS[0];
  const toggleMspProgram = (id) => {
    if (!window.setMspScope) return;
    if (mspAll) {
      // Coming from "all", a single click narrows to that one tenant.
      window.setMspScope([id]);
      return;
    }
    const set = new Set(mspScope);
    if (set.has(id)) set.delete(id); else set.add(id);
    window.setMspScope([...set]);
  };
  const mspSubmenuItems = (viewAsRole === "msp") ? [
    { header: "Tenant scope" },
    { icon: mspAll ? "Check" : "OrgChartHoriz",
      label: "All programs",
      keepOpen: true,
      onClick: () => { if (window.setMspScope) window.setMspScope([]); } },
    { divider: true },
    ...MSP_PROGRAMS.map((p) => {
      const on = mspAll || mspScope.includes(p.id);
      return {
        icon: on ? "Check" : "Building",
        label: p.name,
        keepOpen: true,
        onClick: () => toggleMspProgram(p.id),
      };
    }),
    { divider: true },
    { icon: "Performance", label: "All programs roll-up", onClick: () => showToast("Coming in v1.4 — cross-program dashboard") },
  ] : [];

  const openLocMenu = (e) => {
    const toggleLoc = (id) => {
      const next = new Set(selectedSet);
      if (next.has(id)) next.delete(id); else next.add(id);
      // If empty, treat as "all".
      const arr = next.size === 0 || next.size === managerLocs.length ? [] : [...next];
      onChangeSelectedLocs && onChangeSelectedLocs(arr);
    };
    const opts = [
      { header: "Location" },
      { icon: selectedCount === 0 || selectedCount === managerLocs.length ? "Check" : "Location",
        label: "All my sites",
        onClick: () => onChangeSelectedLocs && onChangeSelectedLocs([]) },
      { divider: true },
      ...managerLocs.map((l) => ({
        icon: selectedSet.has(l.id) ? "Check" : "Location",
        label: l.name,
        onClick: () => toggleLoc(l.id),
      })),
    ];
    openMenu(e.currentTarget, opts);
  };

  return (
    <header className="app-nav" role="banner">
      <div className="app-nav-left">
        <button
          type="button"
          className="iconbtn"
          onClick={onToggleNav}
          aria-label={
            embedded
              ? (navOpen ? "Close Dayforce menu" : "Open Dayforce menu")
              : (navOpen ? "Close global navigation" : "Open global navigation")
          }
          aria-expanded={navOpen}
          aria-controls={embedded ? "df-mainnav" : "global-nav"}
        >
          <Icon name="Menu" size={22} />
        </button>
        <a
          href="#"
          className="app-nav-brand"
          aria-label={embedded ? "Dayforce · Home" : "Dayforce Flex Work · Dashboard"}
          onClick={(e) => {
            e.preventDefault();
            if (embedded) { onBrandClick ? onBrandClick() : (onGoTo && onGoTo("dashboard")); return; }
            onGoTo ? onGoTo("dashboard") : showToast("Welcome to Flex Work");
          }}
        >
          <img
            src={embedded ? "assets/dayforce-logo.svg" : "assets/dayforce-flexwork-logo.svg"}
            alt={embedded ? "Dayforce" : "Dayforce Flex Work"}
          />
        </a>
        {embedded && (
          <button
            type="button"
            className="df-topsearch"
            aria-label="Search Dayforce"
            onClick={() => showToast("Global search spans every Dayforce module")}
          >
            <span className="df-topsearch-icon" aria-hidden="true"><Icon name="Search" size={18} /></span>
            <span className="df-topsearch-text">Search Dayforce</span>
            <span className="df-topsearch-kbd" aria-hidden="true">/</span>
          </button>
        )}
      </div>

      <div className="app-nav-right">
        {embedded && (
          <React.Fragment>
            <button
              type="button"
              className="iconbtn"
              aria-label="Help & support"
              title="Help & support"
              onClick={() => onGoTo && onGoTo("helpCenter")}
            >
              <Icon name="Help" size={20} />
            </button>
            <span className="df-topbar-sep" aria-hidden="true" />
          </React.Fragment>
        )}
        <span className="app-nav-bell">
          <button
            type="button"
            className="iconbtn"
            aria-label={bellCount > 0 ? `Notifications, ${bellCount} unread` : "Notifications, none unread"}
            title={bellCount > 0 ? `${bellCount} unread notification${bellCount === 1 ? "" : "s"}` : "Notifications"}
            onClick={(e) => openNotifications(e.currentTarget)}
          >
            <Icon name="Bell" size={20} />
          </button>
          {bellCount > 0 && (
            <span className="app-nav-bell-dot" aria-hidden="true" />
          )}
        </span>
        <button
          type="button"
          ref={avatarRef}
          className="avatar avatar--btn"
          aria-label={`Your account, ${sessionName} (${roleLabel}). Viewing as ${viewAsLabel}.`}
          title={`${sessionName} · ${roleLabel}`}
          onClick={(e) => openAccountMenu(e.currentTarget)}
        >
          {initials}
        </button>
      </div>
      {window.CountryPicker && country && (
        <window.CountryPicker
          open={countryPickerOpen}
          anchorRef={avatarRef}
          currentCode={country.code}
          onClose={() => setCountryPickerOpen(false)}
          onSelect={onPickCountry}
        />
      )}
    </header>
  );
}

// ---------- Omnibar (page-header pill) -----------------------------------
// Children render into the right-aligned actions slot.
// `dayforce` (optional) — { primitive, product, subtitle?, note?, strategy?, anchor? }
// renders a small Dayforce-alignment pill inline with the title via
// the DfAlignPill component (pages/df-align.jsx).
function Omnibar({ icon, title, subtitle, dayforce, eduTopic, children }) {
  const Pill = typeof window !== "undefined" ? window.DfAlignPill : null;
  const Edu  = typeof window !== "undefined" ? window.VmsEduPin  : null;
  const topicFor = typeof window !== "undefined" ? window.topicForTitle : null;
  // Derive the education topic from the title when the consumer didn’t
  // pass one explicitly, so every page picks up the right tip with no
  // call-site changes.
  const topicId = eduTopic || (topicFor ? topicFor(title) : null);
  return (
    <div className="omnibar" role="region" aria-label={`${title} header`}>
      <span className="omnibar-icon" aria-hidden="true">
        <Icon name={icon} size={24} />
      </span>
      <div className="omnibar-titlewrap">
        <div className="omnibar-titlerow">
          <h1 className="omnibar-title">{title}</h1>
          {dayforce && Pill && <Pill {...dayforce} />}
          {topicId && Edu && <Edu topicId={topicId} />}
        </div>
        {subtitle && <p className="omnibar-sub">{subtitle}</p>}
      </div>
      {children && <div className="omnibar-actions">{children}</div>}
    </div>
  );
}

Object.assign(window, { NAV_ITEMS, navItemsForRole, GlobalNav, AppNav, Omnibar, ROLE_LABELS, MSP_PROGRAMS });


// ---------- Status tabs (shared list-page tab strip) --------------------
// Lives at the top of a list-style table card, above the filter bar.
// Drives a single primary filter ("All" plus one entry per status). A
// page hides its own Status filter chip when these tabs are visible.
//
// Props:
//   tabs      — [{ id, label, tone? }]  // tone is "default"|"success"|"warning"|"error"|"info"
//   counts    — { [id]: number }        // optional; renders the badge
//   active    — current tab id
//   onChange  — (id) => void
function StatusTabs({ tabs, counts = {}, active, onChange, ariaLabel = "Filter by status", variant = "table", showCounts = true }) {
  // `variant="everest"` renders the Everest design-system Tabs group
  // (48h, 4px bottom indicator, bold-active 16px) for tab strips that
  // live ABOVE a table card as a primary view filter. Counts are
  // suppressed in this variant per the Everest spec.
  const isEverest = variant === "everest";
  const wrapCls = isEverest ? "evr-tabs" : "list-tabs";
  const tabCls  = isEverest ? "evr-tab"  : "list-tab";
  const renderCount = showCounts && !isEverest;
  return (
    <div className={wrapCls} role="tablist" aria-label={ariaLabel}>
      {tabs.map((t) => {
        const isActive = t.id === active;
        const n = counts[t.id];
        const toneCls = t.tone && t.tone !== "default" ? ` list-tab-count--${t.tone}` : "";
        return (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            className={tabCls + (isActive ? " is-active" : "")}
            onClick={() => onChange && onChange(t.id)}
          >
            <span>{t.label}</span>
            {renderCount && Number.isFinite(n) && (
              <span className={"list-tab-count" + toneCls}>
                {n > 999 ? "999+" : n}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
Object.assign(window, { StatusTabs });
