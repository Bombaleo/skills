// =====================================================================
// Flex Work — Agency Pro
//
//   Feature-flag-gated demo capability for staffing AGENCY tenants
//   (StaffWise). The previous build shipped four Settings sections
//   (Plans, HCM Sync, Employees, Direct clients) — those have been
//   retired in favor of a single Plan CARD that lives inside
//   Settings → Configuration. The card surfaces a Free ⇄ Pro toggle
//   that demo operators can flip live to walk a customer through the
//   plan tiers without ever leaving Configuration.
//
//   Visibility rules
//     · The agencyPro feature flag must be ON
//     · The active tenant must be an agency-kind org
//       (industry.kind === "agency")
//     · The user must be viewing as Agency
//
//   With any of the three conditions false, every surface here
//   short-circuits and the existing product ships byte-identical.
//
//   This file exposes:
//     · agencyPro feature-flag registration
//     · useAgencyProFlag() / useIsAgencyTenant() hooks
//     · getAgencyPlan() / setAgencyPlan() / useAgencyPlan() — plan
//       state helpers (Free | Pro), persisted to localStorage
//     · AgencyPlanCard — the Configuration card (the only surface
//       this build mounts in the product chrome)
//     · AgencyProTweaks — floating Tweaks panel that toggles the
//       master feature flag (and surfaces the live plan state)
// =====================================================================

const { useState: useStateAP, useEffect: useEffectAP } = React;

// ---------- 1. Flag registration ------------------------------------
(function registerAgencyProFlag() {
  if (!window.FEATURE_FLAG_GROUPS) return;
  const exists = window.FEATURE_FLAG_GROUPS.some((g) => g.id === "agencyPro");
  if (exists) return;
  window.FEATURE_FLAG_GROUPS.push({
    id: "agencyPro",
    label: "Agency Pro",
    // Only surfaced in Settings → Feature Flags on agency-kind tenants.
    // On enterprise buyer orgs the entire group is filtered out of the
    // rendered list (it was always a no-op there) so the flag can't be
    // toggled where it does nothing. See FeatureFlagsPage's group filter.
    requiresAgency: true,
    summary:
      "Demo entry point for the Pro-tier subscription on staffing AGENCY tenants. With the flag on, a Plan card appears in Settings → Configuration that lets operators toggle the tenant between Free and Pro live, walking customers through the two tiers without leaving the page.",
    flags: [
      {
        id: "agencyPro",
        label: "Agency Pro",
        summary:
          "Adds a Plan card to Settings → Configuration on agency tenants. The card exposes a Free ⇄ Pro toggle used for in-product demos. Defaults OFF; renders only inside agency-kind orgs (no effect on enterprise buyer tenants).",
        defaultOn: false,
        tips: [
          {
            label: "What turns on",
            body:
              "A single Plan card at the top of Settings → Configuration. The card shows the current plan, the Free vs Pro feature list, and a toggle to switch between them. Nothing else changes in the chrome — the main pages (Home, Workforce, Clients, Requisitions) ship identical to Free.",
          },
          {
            label: "Tenant scope",
            body:
              "Renders only when the active tenant's industry pack reads kind === \"agency\" (today: StaffWise). On enterprise buyer tenants (Manufacturing, Hospitality, Retail, Healthcare, Logistics) the flag is a no-op — the card never mounts.",
          },
          {
            label: "Plan toggle behaviour",
            body:
              "Flipping the toggle persists immediately to localStorage (no Save Changes step) and broadcasts flexwork:plan:change so any consumer can react. In production, Pro is a contracted annual add-on negotiated with the Dayforce account team — the in-product toggle exists for demo flow only.",
          },
          {
            label: "Replaces the v1 Settings tabs",
            body:
              "The previous build added four full Settings sections (Plans, HCM Sync, Employees, Direct clients). Those have been removed — the Plan card in Configuration is the only surface this build mounts. Saved tenant state from the old tabs is dormant; no migration required.",
          },
        ],
      },
    ],
  });
})();

// ---------- 2. Hooks ------------------------------------------------
function useAgencyProFlag() {
  if (window.useFeatureFlag) return window.useFeatureFlag("agencyPro");
  return !!(window.getFeatureFlag && window.getFeatureFlag("agencyPro"));
}
function useIsAgencyTenant() {
  const [v, setV] = useStateAP(() => !!(window.isAgencyOrg && window.isAgencyOrg()));
  useEffectAP(() => {
    function recheck() { setV(!!(window.isAgencyOrg && window.isAgencyOrg())); }
    window.addEventListener("focus", recheck);
    return () => window.removeEventListener("focus", recheck);
  }, []);
  return v;
}

// ---------- 3. Plan state -------------------------------------------
// "Free" | "Pro". Persisted to localStorage so the demo state survives
// reload. Independent of the agencyPro feature flag: the flag controls
// VISIBILITY of the Plan card, the plan value controls what the card
// SHOWS once visible.
const APRO_PLAN_KEY = "flexwork.agencyPro.plan";

function getAgencyPlan() {
  try {
    const v = window.localStorage.getItem(APRO_PLAN_KEY);
    return v === "Pro" ? "Pro" : "Free";
  } catch (e) { return "Free"; }
}
function setAgencyPlan(plan) {
  const next = plan === "Pro" ? "Pro" : "Free";
  try { window.localStorage.setItem(APRO_PLAN_KEY, next); } catch (e) {}
  try {
    window.dispatchEvent(new CustomEvent("flexwork:plan:change", {
      detail: { plan: next },
    }));
  } catch (e) {}
  return next;
}
function useAgencyPlan() {
  const [v, setV] = useStateAP(() => getAgencyPlan());
  useEffectAP(() => {
    function onChange() { setV(getAgencyPlan()); }
    window.addEventListener("flexwork:plan:change", onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener("flexwork:plan:change", onChange);
      window.removeEventListener("storage", onChange);
    };
  }, []);
  return v;
}

// Composite gate: the agency tenant is on the Pro plan AND the
// agencyPro feature flag is on AND the tenant kind is agency. Most
// Pro-only product surfaces (e.g. the Create Requisition button on
// the agency role) should gate on THIS, not on the bare flag — the
// flag merely enables the demo, the plan picks the tier.
function isAgencyProActive() {
  const flagOn  = !!(window.getFeatureFlag && window.getFeatureFlag("agencyPro"));
  const tenant  = !!(window.isAgencyOrg && window.isAgencyOrg());
  return flagOn && tenant && getAgencyPlan() === "Pro";
}
function useAgencyProActive() {
  const flagOn  = useAgencyProFlag();
  const tenant  = useIsAgencyTenant();
  const plan    = useAgencyPlan();
  return flagOn && tenant && plan === "Pro";
}

Object.assign(window, {
  useAgencyProFlag, useIsAgencyTenant,
  getAgencyPlan, setAgencyPlan, useAgencyPlan,
  isAgencyProActive, useAgencyProActive,
});

// ---------- 4. AgencyPlanCard ---------------------------------------
// Renders inside Settings → Configuration. The caller is responsible
// for gating on the agencyPro flag + agency-tenant check; this
// component renders unconditionally when invoked.
function AgencyPlanCard() {
  const plan = useAgencyPlan();
  const isPro = plan === "Pro";

  const features = [
    { id: "vms",      label: "Manage VMS clients and assigned workers",         free: true,  pro: true },
    { id: "ts",       label: "Approve VMS timesheets and invoices",              free: true,  pro: true },
    { id: "sched",    label: "View VMS schedules and shifts",                    free: true,  pro: true },
    { id: "hcm",      label: "Dayforce HCM and payroll sync for your workforce", free: false, pro: true },
    { id: "emp",      label: "Manage your own employees (W-2 and 1099)",         free: false, pro: true },
    { id: "direct",   label: "Add and manage your own direct clients",           free: false, pro: true },
    { id: "support",  label: "Priority support and dedicated success manager",   free: false, pro: true },
  ];

  const onToggle = (next) => {
    setAgencyPlan(next);
    if (window.showToast) {
      window.showToast(
        next === "Pro"
          ? "Plan switched to Pro — full Agency capabilities active"
          : "Plan switched to Free — VMS-only access",
        { kind: next === "Pro" ? "success" : undefined }
      );
    }
  };

  return (
    <SectionCard
      variant="compact"
      icon="ShieldCheck"
      title="Plan"
      action={(
        <span className={"req-pill " + (isPro ? "req-pill--success" : "req-pill--default")}>
          {isPro ? "Pro" : "Free"}
        </span>
      )}
    >
      <p className="cfg-card-blurb">
        Your agency subscription tier. <strong>Free</strong> covers VMS-routed work — the clients you're already
        connected with through a VMS. <strong>Pro</strong> adds Dayforce HCM and payroll sync, your own employees,
        and direct (non-VMS) clients. Plan changes are contracted annually with your Dayforce rep; the toggle below
        is for demo and preview.
      </p>

      <div className="apro-plan-toggle" role="radiogroup" aria-label="Plan">
        <button
          type="button"
          role="radio"
          aria-checked={!isPro}
          className={"apro-plan-toggle-opt" + (!isPro ? " apro-plan-toggle-opt--active" : "")}
          onClick={() => !isPro || onToggle("Free")}
        >
          <span className="apro-plan-toggle-name">Free</span>
          <span className="apro-plan-toggle-price">VMS connection</span>
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={isPro}
          className={"apro-plan-toggle-opt" + (isPro ? " apro-plan-toggle-opt--active" : "")}
          onClick={() => isPro || onToggle("Pro")}
        >
          <span className="apro-plan-toggle-name">Pro</span>
          <span className="apro-plan-toggle-price">Annual contract</span>
        </button>
      </div>

      <ul className="apro-plan-feats apro-plan-feats--inline" role="list">
        {features.map((f) => {
          const on = isPro ? f.pro : f.free;
          return (
            <li key={f.id} className={"apro-plan-feat" + (on ? "" : " apro-plan-feat--off")}>
              <span className={"apro-plan-feat-ic apro-plan-feat-ic--" + (on ? "yes" : "no")} aria-hidden="true">
                <Icon name={on ? "Check" : "Cancel"} size={12} />
              </span>
              <span>{f.label}</span>
            </li>
          );
        })}
      </ul>
    </SectionCard>
  );
}

Object.assign(window, { AgencyPlanCard });

// ---------- 4b. AgencyHcmSyncCard (PRO feature: Dayforce HCM sync) ---
// The one genuinely Pro-tier surface from the parity work: an agency on
// the Pro plan can sync its OWN employees + pay data from Dayforce HCM.
// Mounted in Settings → Configuration only when isAgencyProActive().
// Gated by the caller; renders unconditionally when invoked.
const APRO_HCM_KEY = "flexwork.agencyPro.hcmConnected";
function AgencyHcmSyncCard() {
  const [connected, setConnected] = useStateAP(() => {
    try { return window.localStorage.getItem(APRO_HCM_KEY) === "1"; } catch (e) { return false; }
  });
  const benchCount = (() => { try { return ((window.WORKERS || []).filter((w) => (w.pool || "Agency") === "Agency")).length; } catch (e) { return 0; } })();
  const setConn = (v) => {
    setConnected(v);
    try { window.localStorage.setItem(APRO_HCM_KEY, v ? "1" : "0"); } catch (e) {}
    if (window.showToast) window.showToast(v ? "Connected to Dayforce HCM — bench sync enabled" : "Dayforce HCM sync disconnected", { kind: v ? "success" : undefined });
  };
  return (
    <SectionCard
      variant="compact"
      icon="OrgChartVert"
      title="Dayforce HCM bench sync"
      action={(
        <span className={"req-pill " + (connected ? "req-pill--success" : "req-pill--default")}>
          {connected ? "Connected" : "Not connected"}
        </span>
      )}
    >
      <p className="cfg-card-blurb">
        <strong>Pro</strong> agencies sync their own W-2 and 1099 employees and pay data directly from Dayforce HCM,
        so the bench, timesheets and pay stay in step with payroll without re-keying. This is the Dayforce-native
        advantage no standalone VMS can match.
      </p>
      <div className="apro-plan-toggle" role="group" aria-label="Dayforce HCM sync">
        <button type="button" className={"apro-plan-toggle-opt" + (!connected ? " apro-plan-toggle-opt--active" : "")} onClick={() => connected && setConn(false)}>
          <span className="apro-plan-toggle-name">Off</span>
          <span className="apro-plan-toggle-price">Manual bench</span>
        </button>
        <button type="button" className={"apro-plan-toggle-opt" + (connected ? " apro-plan-toggle-opt--active" : "")} onClick={() => !connected && setConn(true)}>
          <span className="apro-plan-toggle-name">Connected</span>
          <span className="apro-plan-toggle-price">HCM synced</span>
        </button>
      </div>
      {connected && (
        <ul className="apro-plan-feats apro-plan-feats--inline" role="list" style={{ marginTop: 4 }}>
          <li className="apro-plan-feat"><span className="apro-plan-feat-ic apro-plan-feat-ic--yes" aria-hidden="true"><Icon name="Check" size={12} /></span><span>{benchCount} bench worker{benchCount === 1 ? "" : "s"} synced from Dayforce HCM</span></li>
          <li className="apro-plan-feat"><span className="apro-plan-feat-ic apro-plan-feat-ic--yes" aria-hidden="true"><Icon name="Check" size={12} /></span><span>Pay rates and tax forms kept current with payroll</span></li>
          <li className="apro-plan-feat"><span className="apro-plan-feat-ic apro-plan-feat-ic--yes" aria-hidden="true"><Icon name="Check" size={12} /></span><span>Last sync: today, 7:42 AM</span></li>
        </ul>
      )}
    </SectionCard>
  );
}

Object.assign(window, { AgencyHcmSyncCard });

// ---------- 5. AgencyProTweaks (floating panel) ---------------------
// Single-toggle Tweaks panel for the agencyPro flag. Reuses the
// `.ff-switch` styling so it matches the toggle on Settings →
// Feature Flags. Default-visible on agency tenants only; otherwise
// hidden until the toolbar Tweaks button summons it.
function AgencyProTweaks() {
  const _defOpen = !!(window.isAgencyOrg && window.isAgencyOrg());
  const [visible, setVisible] = useStateAP(_defOpen);
  const flagOn   = useAgencyProFlag();
  const isTenant = useIsAgencyTenant();
  const plan     = useAgencyPlan();
  // Automatic worker invitations sub-flag — surfaced as a second row so
  // reviewers can flip it without leaving the panel.
  const autoInviteOn = window.useFeatureFlag ? window.useFeatureFlag("autoWorkerInvite") : false;

  useEffectAP(() => {
    function onMsg(ev) {
      if (!ev || !ev.data) return;
      if (ev.data.type === "__activate_edit_mode") setVisible(true);
      else if (ev.data.type === "__deactivate_edit_mode") setVisible(false);
    }
    window.addEventListener("message", onMsg);
    try { window.parent.postMessage({ type: "__edit_mode_available" }, "*"); } catch (e) {}
    return () => window.removeEventListener("message", onMsg);
  }, []);

  const onClose = () => {
    setVisible(false);
    try { window.parent.postMessage({ type: "__edit_mode_dismissed" }, "*"); } catch (e) {}
  };

  if (!visible) return null;

  const toggle = (val) => {
    if (window.setFeatureFlag) window.setFeatureFlag("agencyPro", val);
    if (window.showToast) {
      window.showToast("Agency Pro " + (val ? "enabled" : "disabled"), { kind: val ? "success" : undefined });
    }
  };

  return (
    <div className="apro-tweaks" role="dialog" aria-label="Tweaks">
      <header className="apro-tweaks-head">
        <div>
          <h3 className="apro-tweaks-title">Tweaks</h3>
          <p className="apro-tweaks-sub">Agency Pro feature flag</p>
        </div>
        <button type="button" className="apro-tweaks-close" onClick={onClose} aria-label="Close tweaks">
          <Icon name="Cancel" size={18} />
        </button>
      </header>
      <div className="apro-tweaks-body">
        <div className="apro-tweaks-row">
          <div>
            <div className="apro-tweaks-row-lbl">Agency Pro</div>
            <div className="apro-tweaks-row-sub">
              {isTenant
                ? "Shows the Plan card in Settings → Configuration."
                : "No-op: not on an agency tenant."}
            </div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={flagOn}
            className={"ff-switch" + (flagOn ? " is-on" : "")}
            onClick={() => toggle(!flagOn)}
            disabled={!isTenant}
          >
            <span className="ff-switch-track">
              <span className="ff-switch-thumb" />
            </span>
          </button>
        </div>
        <div className="apro-tweaks-meta">
          Plan:{" "}
          <strong
            style={{
              color: flagOn && plan === "Pro"
                ? "var(--evr-content-status-success-default)"
                : "var(--evr-content-primary-default)",
            }}
          >
            {flagOn ? plan : "Free"}
          </strong>
        </div>
        <div className="apro-tweaks-row" style={{ paddingTop: "var(--evr-spacing-xs)", borderTop: "1px solid var(--evr-border-decorative-lowemp)" }}>
          <div>
            <div className="apro-tweaks-row-lbl">Automatic worker invitations</div>
            <div className="apro-tweaks-row-sub">
              {isTenant
                ? (plan === "Pro"
                    ? "Adds the invitation-strategy card + per-req override."
                    : "Needs the Pro plan to take effect.")
                : "No-op: not on an agency tenant."}
            </div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={autoInviteOn}
            className={"ff-switch" + (autoInviteOn ? " is-on" : "")}
            onClick={() => {
              const val = !autoInviteOn;
              if (window.setFeatureFlag) window.setFeatureFlag("autoWorkerInvite", val);
              if (window.showToast) window.showToast("Automatic worker invitations " + (val ? "enabled" : "disabled"), { kind: val ? "success" : undefined });
            }}
            disabled={!isTenant}
          >
            <span className="ff-switch-track">
              <span className="ff-switch-thumb" />
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------- 6. First-load default to StaffWise ----------------------
// The Agency Pro prototype is the focused build in this project. On
// the FIRST load after a particular build ships (no marker for that
// build version), force the active org to StaffWise so the user lands
// on the agency tenant immediately. Subsequent loads honour whatever
// org the user explicitly switched to.
(function aproFirstLoadDefault() {
  try {
    const MARK = "flexwork.agencyPro.onboarded.v3";
    if (window.localStorage.getItem(MARK)) return;
    window.localStorage.setItem("flexwork.industry", "staffwise");
    window.localStorage.setItem(MARK, "1");
    // Clear older markers so a future build can bump again without
    // colliding with previous ones.
    window.localStorage.removeItem("flexwork.agencyPro.onboarded");
    window.localStorage.removeItem("flexwork.agencyPro.onboarded.v2");
  } catch (e) { /* no-op */ }
})();

Object.assign(window, { AgencyProTweaks });
