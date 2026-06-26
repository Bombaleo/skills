// =====================================================================
// Dayforce platform shell  (v0.81)
//   Wraps Flex Work so it reads as ONE module inside the broader
//   Dayforce HCM application. Two presentations, toggled from the
//   account menu → Demo controls → Experience:
//
//     · "standalone"  — the original Flex Work chrome (own top bar +
//                       slide-out Global nav). Nothing changes.
//     · "embedded"    — the Dayforce platform chrome: a full-width
//                       Dayforce top bar, a 1st-tier module rail down
//                       the left (Home · People · Payroll · … · Flex
//                       Work · Admin), and the existing Flex Work nav
//                       demoted to a docked 2nd-tier sidebar.
//
//   Only "Flex Work" is a live module in this prototype; every other
//   rail entry renders a lightweight platform placeholder so the IA
//   reads correctly without pretending the other modules are built.
// =====================================================================

// ---------- Shell-mode store -------------------------------------------
const SHELL_MODE_KEY = "flexwork.shellMode";
function getShellMode() {
  try {
    const v = window.localStorage.getItem(SHELL_MODE_KEY);
    return v === "standalone" || v === "embedded" ? v : "embedded";
  } catch (e) {
    return "embedded";
  }
}
function setShellMode(mode) {
  try { window.localStorage.setItem(SHELL_MODE_KEY, mode); } catch (e) {}
}

// ---------- Dayforce module catalog ------------------------------------
// The 1st-tier platform navigation. `live: true` marks the only module
// actually built in this prototype (Flex Work); the rest are present so
// the platform IA reads correctly and render a placeholder when opened.
const DAYFORCE_MODULES = [
  { id: "home",       label: "Home",       icon: "Grid",         blurb: "Your personalized Dayforce launchpad — pay, time off, tasks and announcements in one place." },
  { id: "people",     label: "People",     icon: "Employees",    blurb: "The system of record for every employee — profiles, employment, positions and org placement." },
  { id: "recruiting", label: "Recruiting", icon: "PersonSearch", blurb: "Req management, candidate pipelines and offers for permanent hiring." },
  { id: "onboarding", label: "Onboarding", icon: "PersonPlus",   blurb: "New-hire paperwork, provisioning and day-one readiness." },
  { id: "time",       label: "Time",       icon: "PersonClock",  blurb: "Time and attendance — clock punches, time-off balances and approvals." },
  { id: "wfm",        label: "Schedules",  icon: "Calendar",     blurb: "Workforce management — labor demand, schedules and coverage." },
  { id: "payroll",    label: "Payroll",    icon: "Pay",          blurb: "Continuous calculation payroll, pay runs and statements." },
  { id: "benefits",   label: "Benefits",   icon: "Leaf",         blurb: "Plan administration, open enrollment and life events." },
  { id: "talent",     label: "Talent",     icon: "Performance",  blurb: "Performance, goals, succession and compensation planning." },
  { id: "reporting",  label: "Reporting",  icon: "BarChart",     blurb: "Cross-module analytics, dashboards and scheduled reports." },
  { id: "flexwork",   label: "Flex Work",  icon: "Bolt",         live: true,
    blurb: "Contingent and flexible workforce — requisitions, suppliers, scheduling, timesheets and invoices." },
  { id: "admin",      label: "Admin",      icon: "Settings",     blurb: "Platform configuration, security roles and system tools." },
];

// ---------- Main Dayforce navigation (hamburger overlay) ---------------
// The platform's primary navigation. Per the standard Dayforce embedded-
// module pattern, this is NOT a persistent rail — it stays hidden behind
// the module's own (2nd-tier) nav and is summoned by the top-bar
// hamburger, sliding in OVER the module nav with a scrim. Selecting a
// module routes there and dismisses the overlay. Flex Work is the live
// module; the active module carries the blue accent.
function DfPrimaryRail({ activeId, onSelect, open, onClose }) {
  // Close on Escape while open.
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape") onClose && onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const pick = (id) => {
    if (onSelect) onSelect(id);
    if (onClose) onClose();
  };

  return (
    <React.Fragment>
      <div
        className={`df-mainnav-scrim${open ? " open" : ""}`}
        onClick={onClose}
        aria-hidden="true"
      />
      <nav
        id="df-mainnav"
        className={`df-mainnav${open ? " open" : ""}`}
        aria-label="Dayforce navigation"
        aria-hidden={!open}
      >
        <div className="df-mainnav-head">
          <span className="df-mainnav-title">Dayforce</span>
          <button
            type="button"
            className="iconbtn df-mainnav-close"
            onClick={onClose}
            aria-label="Close Dayforce menu"
            title="Close"
            tabIndex={open ? 0 : -1}
          >
            <Icon name="X" size={20} />
          </button>
        </div>
        <ul className="df-mainnav-list">
          {DAYFORCE_MODULES.map((m) => {
            const active = m.id === activeId;
            return (
              <li key={m.id}>
                <button
                  type="button"
                  className={`df-mainnav-item${active ? " df-mainnav-item--active" : ""}${m.live ? " df-mainnav-item--live" : ""}`}
                  aria-current={active ? "page" : undefined}
                  onClick={() => pick(m.id)}
                  title={m.label}
                  tabIndex={open ? 0 : -1}
                >
                  <span className="df-mainnav-icon" aria-hidden="true">
                    <Icon name={m.icon} size={22} />
                  </span>
                  <span className="df-mainnav-label">{m.label}</span>
                  {m.live && <span className="df-mainnav-live" aria-hidden="true" />}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>
    </React.Fragment>
  );
}

// ---------- Module placeholder -----------------------------------------
// Shown when a non-Flex-Work module is opened from the rail. Keeps the
// platform IA honest without faking a build we don't have.
function DfModulePlaceholder({ moduleId, onGoFlexWork }) {
  const mod = DAYFORCE_MODULES.find((m) => m.id === moduleId) || DAYFORCE_MODULES[0];
  return (
    <React.Fragment>
      <Omnibar icon={mod.icon} title={mod.label} subtitle="Dayforce platform module" />
      <div className="content-section">
        <section className="content-card df-modph">
          <span className="df-modph-mark" aria-hidden="true">
            <Icon name={mod.icon} size={40} />
          </span>
          <h2 className="df-modph-title">{mod.label}</h2>
          <p className="df-modph-blurb">{mod.blurb}</p>
          <div className="df-modph-note">
            <Icon name="Information" size={18} />
            <span>
              In this prototype, <strong>Flex Work</strong> is the live module. The other
              Dayforce modules are shown to illustrate where Flex Work sits in the platform.
            </span>
          </div>
          <button type="button" className="btn btn--md btn--primary df-modph-cta" onClick={onGoFlexWork}>
            <Icon name="Bolt" size={18} />
            Open Flex Work
          </button>
        </section>
      </div>
    </React.Fragment>
  );
}

// ---------- Flex Work module header (top of the 2nd-tier nav) ----------
// Sits above the Flex Work nav list, naming the module the docked nav
// belongs to and hosting the collapse toggle — the standard Dayforce
// embedded-module pattern (cf. the Profile module nav). The collapse
// control uses the panel-collapse glyph; collapsing shrinks the docked
// nav to an icon-only strip.
function DfModuleHeader({ collapsed, onToggle }) {
  return (
    <div className={`gn-modulehead${collapsed ? " gn-modulehead--collapsed" : ""}`}>
      {!collapsed && <span className="gn-modulehead-name">Flex Work</span>}
      {onToggle && (
        <button
          type="button"
          className="iconbtn gn-collapse-btn"
          onClick={onToggle}
          aria-label={collapsed ? "Expand Flex Work navigation" : "Collapse Flex Work navigation"}
          title={collapsed ? "Expand" : "Collapse"}
        >
          <Icon name="PanelRight" size={20} />
        </button>
      )}
    </div>
  );
}

Object.assign(window, {
  getShellMode, setShellMode, SHELL_MODE_KEY,
  DAYFORCE_MODULES, DfPrimaryRail, DfModulePlaceholder, DfModuleHeader,
});
