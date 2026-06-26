// =====================================================================
// Flex Work — Settings
//   · SettingsPage   — renders the content pane for the currently-selected
//                       Settings tab. The tabs themselves now live in the
//                       Global Navigation dock (see chrome.jsx · GlobalNav
//                       subsection mode), so this page no longer ships its
//                       own side nav.
// =====================================================================

// ---------- Settings tabs (consumed by chrome.jsx via window) -----------
const SETTINGS_SECTIONS = [
  // Organizations — platform-tier surface. Gated to the Dayforce org via
  // `orgOnly`; the chrome settings dock (app.jsx) filters it out
  // everywhere else. Only the Systems Admin role reaches it.
  { id: "organizations", label: "Organizations",         icon: "OrgChartVert", orgOnly: "dayforce" },
  { id: "policies",      label: "Policies",              icon: "Notes" },
  { id: "distribution",  label: "Distribution",          icon: "PersonArrow" },
  { id: "jobs",          label: "Jobs",                  icon: "Briefcase" },
  { id: "lifecycle",     label: "Lifecycle",             icon: "PersonPlus" },
  { id: "templates",     label: "Templates",             icon: "Copy" },
  { id: "configuration", label: "Configuration",         icon: "Adjustment" },
  // v0.86 — Master data lifted out of Configuration as a top-level
  // settings entry. Holds the bulk-upload chronology + new-upload flow.
  { id: "master-data",   label: "Master data",           icon: "Stack" },
  { id: "system",        label: "System",                icon: "Code" },
  { id: "pricing",       label: "Pricing",               icon: "Pay" },
  // v1.48 — Rate Cards (Rate Grid). One flat, condition-resolved rate
  // table per position. Sits directly under Pricing. The page lives in
  // pages/rate-grid.jsx (window.RateGridPage); modals in
  // pages/rate-grid-modals.jsx.
  { id: "rate-grid",     label: "Rate Cards",            icon: "Grid" },
  { id: "workflows",     label: "Workflows",             icon: "Bolt" },
  { id: "budgets",       label: "Budgets",               icon: "MoneyBag" },
  { id: "roles",         label: "User Roles",            icon: "ShieldPerson" },
  { id: "users",         label: "Users",                 icon: "Users" },
  { id: "feature-flags", label: "Feature Flags",         icon: "Bolt" },
  // v0.85 — Custom Fields is gated by the `customFields` feature flag.
  // The entry is always present in SETTINGS_SECTIONS; the chrome's
  // settings dock + the Configuration switch below filter it out when
  // the flag is off. Default off everywhere; Helios Power Generation
  // ships with the flag on (see pages/custom-fields-config.jsx).
  { id: "custom-fields", label: "Custom Fields",         icon: "Shapes", flag: "customFields" },
  // v0.86 — Interview workflow lives inside Settings → Configuration
  // as a "Candidate workflow" tab (gated by `interviews`). No longer a
  // top-level Settings dock entry. See pages/settings-config.jsx.
  // Agency Pro — the v1 build added four full Settings sections
  // (Plans, HCM Sync, Employees, Direct clients). Those have been
  // retired in favor of a single Plan card inside Settings →
  // Configuration. See pages/agency-pro.jsx (AgencyPlanCard) for the
  // replacement surface. No agency-only IDs live in this list.
];

// ---------- Empty-state copy keyed by section ---------------------------
const SETTINGS_EMPTY = {
  organizations: {
    title: "Organizations",
    body: "Stand up and manage the organizations Dayforce runs from this platform tenant. Available only to the Systems Admin role inside the Dayforce org.",
  },
  policies: {
    title: "Policies",
    body: "Define the rules workers and managers must follow — break minimums, overtime thresholds, geo-fencing, and approval chains.",
  },
  "master-data": {
    title: "Master data",
    body: "Chronology of bulk uploads — who imported what, when, and the validate → stage → commit lifecycle for each upload.",
  },
  configuration: {
    title: "Configuration",
    body: "Tune how Flex Work behaves for your organization — defaults, field visibility, integrations, and notification channels.",
  },
  system: {
    title: "System",
    body: "Manage tenant-level settings, API access, single sign-on, and audit logging.",
  },
  pricing: {
    title: "Pricing",
    body: "Set bill rates, pay rates, markups, and supplier-specific pricing exceptions.",
  },
  workflows: {
    title: "Workflows",
    body: "Design the approval, escalation, and automation flows that move requisitions, timesheets, and invoices through your org.",
  },
  budgets: {
    title: "Budgets",
    body: "Allocate spend by site, department, or program and track utilization in real time.",
  },
  roles: {
    title: "User Roles",
    body: "Control who can see and act on what — create User Roles, assign Role Features, and audit access.",
  },
  "feature-flags": {
    title: "Feature Flags",
    body: "Pre-release capabilities you can turn on tenant-wide. Flags default to off; toggling one takes effect immediately for every user in this tenant.",
  },
  "custom-fields": {
    title: "Custom Fields",
    body: "Extend any object in the platform with fields specific to your program — outage windows, certifications, capital project codes. Same shape Fieldglass calls \"Custom Field\" and Vndly calls \"self-serve fields\".",
  },
  users: {
    title: "Users",
    body: "Invite, deactivate, and manage the people who log in to Flex Work — including their default role and home location.",
  },
  jobs: {
    title: "Jobs",
    body: "Every job a requester can pick on a new requisition. Synced from Dayforce Core, with Frontline and Professional books of work where both are enabled.",
  },
};

// ---------- Distribution wrapper ----------------------------------------
// Single-pane distribution settings. v0.82 merged Talent pools into
// "Distribution access" inside Supplier distribution, so the old
// suppliers/pools tabbed shell is gone — the page now renders the
// Supplier distribution form directly.
function DistributionSettingsPage({ onGoTo }) {
  return (
    <SupplierDistributionPage
      onOpenOrg={() => onGoTo && onGoTo({ page: "locations" })}
    />
  );
}

// ---------- Section content (placeholder empty state per section) -------
function SettingsSectionContent({ current, onGoTo }) {
  if (current === "templates" && window.RequisitionTemplatesPage) {
    return <window.RequisitionTemplatesPage />;
  }
  if (current === "distribution" || current === "supplier-distribution" || current === "talent-pools") {
    return <DistributionSettingsPage onGoTo={onGoTo} />;
  }
  if (current === "pricing" && window.PricingConfigPage) {
    return <window.PricingConfigPage />;
  }
  if (current === "rate-grid" && window.RateGridPage) {
    return <window.RateGridPage />;
  }
  if (current === "budgets" && window.BudgetsPage) {
    return <window.BudgetsPage />;
  }
  if (current === "organizations" && window.OrganizationsSettingsPage) {
    return <window.OrganizationsSettingsPage onGoTo={onGoTo} />;
  }
  if (current === "roles" && window.RolesPage) {
    return <window.RolesPage />;
  }
  if (current === "policies" && window.PoliciesSettingsPage) {
    return <window.PoliciesSettingsPage />;
  }
  if (current === "master-data" && window.MasterDataTab) {
    return (
      <div className="set-content">
        <header className="set-content-header">
          <h2 className="set-content-title">Master data</h2>
          <p className="set-content-sub">
            Bulk-upload chronology and progressive new-upload flow. Master data is what every other tenant-wide configuration depends on — locations, jobs, cost codes, suppliers, workers.
          </p>
        </header>
        <window.MasterDataTab />
      </div>
    );
  }
  if (current === "configuration" && window.ConfigurationPage) {
    return <window.ConfigurationPage onGoTo={onGoTo} />;
  }
  if (current === "workflows" && window.WorkflowsPage) {
    return <window.WorkflowsPage />;
  }
  if (current === "system" && window.SystemPage) {
    return <window.SystemPage onGoTo={onGoTo} />;
  }
  if (current === "users" && window.UsersAdminPage) {
    return <window.UsersAdminPage onGoTo={onGoTo} />;
  }
  if (current === "feature-flags" && window.FeatureFlagsPage) {
    return <window.FeatureFlagsPage />;
  }
  if (current === "custom-fields" && window.CustomFieldsPage) {
    return <window.CustomFieldsPage onGoTo={onGoTo} />;
  }
  // Agency Pro — the v1 build dispatched four agency-only Settings
  // sections here. Those have been removed; the replacement surface
  // (Plan card) lives inside ConfigurationPage in settings-config.jsx,
  // gated on the agencyPro feature flag + agency-tenant check.
  if (current === "jobs" && window.JobsSettingsPage) {
    return <window.JobsSettingsPage />;
  }
  // v1.26 \u2014 Lifecycle templates live as a top-level Settings entry
  // rather than two cards on Configuration. Renders the master\u2011detail
  // template editor for Pro + Frontline.
  if (current === "lifecycle" && window.LifecycleSettingsPage) {
    return <window.LifecycleSettingsPage />;
  }
  const meta = SETTINGS_EMPTY[current] || SETTINGS_EMPTY.policies;
  return (
    <div className="set-content">
      <header className="set-content-header">
        <h2 className="set-content-title">{meta.title}</h2>
        <p className="set-content-sub">{meta.body}</p>
      </header>

      <section className="content-card">
        <div className="empty">
          <img
            src="assets/illustrations/Rocketship.svg"
            alt=""
            role="presentation"
            width="180"
            height={Math.round(180 * (202 / 224))}
          />
          <h3 className="empty-title">{meta.title} is launching soon</h3>
          <p className="empty-body">
            We&rsquo;re still building this area. Check back soon, or reach out to your Dayforce admin if you need access now.
          </p>
        </div>
      </section>
    </div>
  );
}

// ---------- Page wrapper -------------------------------------------------
function SettingsPage({ reloadKey, onReload, onGoTo, currentTab }) {
  const current = currentTab || "policies";
  const sectionMeta = SETTINGS_SECTIONS.find((s) => s.id === current);
  const emptyMeta = SETTINGS_EMPTY[current];
  const omniTitle = sectionMeta
    ? sectionMeta.label
    : (emptyMeta ? emptyMeta.title : "Settings");

  // Pricing detail pages publish a back-style header context via the
  // `pcfg:omni` event; subscribe so the omnibar reflects it on that view.
  const [pcfgOmni, setPcfgOmniState] = React.useState(
    () => (typeof window !== "undefined" && window.__pcfgOmni) || { mode: "list" }
  );
  React.useEffect(() => {
    const on = () => setPcfgOmniState(window.__pcfgOmni || { mode: "list" });
    window.addEventListener("pcfg:omni", on);
    return () => window.removeEventListener("pcfg:omni", on);
  }, []);
  const pcfgDetails = current === "pricing" && pcfgOmni && pcfgOmni.mode === "details";

  return (
    <React.Fragment>
      {pcfgDetails ? (
        <div className="omnibar omnibar--back" role="region" aria-label={`${pcfgOmni.name} header`}>
          <button
            type="button"
            className="omnibar-back"
            aria-label="Back to pricing configurations"
            onClick={() => pcfgOmni.onBack && pcfgOmni.onBack()}
          >
            <Icon name="ArrowLeft" size={24} />
          </button>
          <div className="omnibar-textstack">
            <div className="omnibar-titlerow">
              <h1 className="omnibar-title">{pcfgOmni.name}</h1>
            </div>
            <p className="omnibar-sub">Pricing configuration</p>
          </div>
          <div className="omnibar-actions">
            <button
              type="button"
              className="pcfg-btn pcfg-btn--secondary"
              style={{ height: 32 }}
              disabled={!pcfgOmni.canEdit}
              title={pcfgOmni.canEdit ? "Edit configuration" : "Can't edit — assigned to agency contracts"}
              onClick={() => pcfgOmni.onEdit && pcfgOmni.onEdit()}
            >
              <Icon name="Edit" size={14} /> Edit
            </button>
          </div>
        </div>
      ) : (
      <Omnibar
        icon="Settings"
        title={omniTitle}
        dayforce={{
          primitive: "Various",
          subtitle: "policies · workflows · labor metrics · user roles",
          product: "Org Setup",
          strategy: "Rebuild / Adopt",
          note: "Settings collapses across Dayforce: Roles → User Role + Role Features; Policies → Position rules + Employment Indicators; Departments → Labor Metric Codes (Reference Code + Ledger Code); Workflows → Workflows with Position Management + Notification Workflows.",
          anchor: "ownership",
        }}
      >
        {current === "pricing" && (
          <button
            type="button"
            className="pcfg-btn pcfg-btn--primary"
            onClick={() => window.dispatchEvent(new CustomEvent("pcfg:new-config"))}
          >
            <Icon name="AddCircle" size={16} />
            New configuration
          </button>
        )}
        <button
          type="button"
          className="iconbtn"
          onClick={onReload}
          aria-label="Reload content"
          title="Reload"
        >
          <Icon name="Refresh" size={18} />
        </button>
      </Omnibar>
      )}

      <div className="set-shell set-shell--no-subnav" key={reloadKey}>
        <SettingsSectionContent current={current} onGoTo={onGoTo} />
      </div>
    </React.Fragment>
  );
}

Object.assign(window, { SettingsPage, SETTINGS_SECTIONS });
