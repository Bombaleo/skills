// =====================================================================
// Flex Work — Lifecycle data layer
//   Per-org store of:
//     · A library of *lifecycle templates* (named bundles of onboarding
//       + offboarding tasks + connectors + approval thresholds), each
//       tagged with a kind (pro | frontline).
//     · A map of {jobName: templateId} per category so admins can pin a
//       specific template to a specific job in Settings -> Jobs. Jobs
//       without an explicit assignment fall back to the default template
//       for the matching kind.
//
//   This file is the data layer ONLY. The Settings UI lives in
//   pages/settings-lifecycle.jsx and the per-job picker lives inside
//   pages/jobs-settings.jsx — both consume the helpers exposed here.
//
//   Storage
//     · flexwork.lifecycleStore.{orgId} as JSON:
//         { templates: [Template], jobAssignments: { professional: {jobName: id}, frontline: {jobName: id} } }
//     · Seeded on first read for a given org. Persisted on every mutation.
//     · Mutations broadcast a `flexwork:lifecycle:change` CustomEvent so
//       open consumers (workforce tracker accordion, worker-mobile tab,
//       professional-onboard panel) re-render in place.
//
//   Public API
//     · getLifecycleTemplates(kind?)        — list, optionally filtered by kind
//     · getLifecycleTemplate(id)            — fetch one
//     · getDefaultLifecycleTemplate(kind)   — find isDefault: true for kind
//     · createLifecycleTemplate(seed)       — returns new id
//     · setLifecycleTemplate(id, patch)     — merge top-level keys
//     · cloneLifecycleTemplate(srcId, newName)
//     · deleteLifecycleTemplate(id)         — refuses to delete default
//     · setDefaultLifecycleTemplate(kind, id)
//
//     Per-job assignment:
//     · getJobLifecycleTemplateId(jobName, category)
//     · setJobLifecycleTemplateId(jobName, category, templateId | null)
//     · resolveLifecycleTemplateFor(jobName, category) — falls back
//       to default for kind when no per-job override.
//
//     Worker-aware resolvers (read the task catalog the way every
//     downstream surface needs it):
//     · getOnboardingTasksForWorker(worker)
//     · getOffboardingTasksForWorker(worker)
//
//     Backward-compat helpers (kept so consumers that pre-date the
//     refactor keep reading the default template):
//     · getOnboardingTasks(kind)
//     · getOffboardingTasks(kind)
//     · getLifecycleConnectors(kind)
//     · getLifecycleApproval(kind)
// =====================================================================

(function () {
  const { useState, useEffect } = React;
  const STORE_PREFIX = "flexwork.lifecycleStore.";
  const EVENT = "flexwork:lifecycle:change";

  // ---------- Org identity helper -------------------------------------
  function _orgId() {
    if (window.getCurrentIndustryId) return window.getCurrentIndustryId();
    return "default";
  }

  // ---------- Seed task / connector / approval shapes ----------------
  // Shape per task: { id, label, owner, required, due, connector, desc }
  const PRO_ONB = [
    { id: "msa",       label: "Master Services Agreement",  owner: "worker",   required: true,  due: 2, connector: "esign",     desc: "Counter-sign against the supplier or direct MSA on file." },
    { id: "sow",       label: "Statement of Work",          owner: "worker",   required: true,  due: 2, connector: "esign",     desc: "Generate from the chosen template; auto-fills cadence + rate." },
    { id: "nda",       label: "Mutual NDA",                 owner: "worker",   required: true,  due: 2, connector: "esign",     desc: "Standard NDA boilerplate." },
    { id: "ip",        label: "IP assignment",              owner: "worker",   required: true,  due: 2, connector: "esign",     desc: "Required for engineering / design / strategy work." },
    { id: "bgcheck",   label: "Background check",           owner: "shared",   required: true,  due: 5, connector: "bgcheck",   desc: "Tier 1 by default — bumps to Tier 2 for finance / legal." },
    { id: "i9",        label: "I-9 / Right to Work",        owner: "worker",   required: true,  due: 3, connector: "rtw",       desc: "Country-aware — US E-Verify, UK Share Code, EU eIDAS." },
    { id: "w4",        label: "Tax form",                   owner: "worker",   required: true,  due: 3, connector: "payroll",   desc: "W-4 (US) · P45 (UK) · TD1 (CA). Auto-keyed off country of work." },
    { id: "banking",   label: "Direct deposit",             owner: "worker",   required: true,  due: 3, connector: "banking",   desc: "Multi-bank split allowed (Pro)." },
    { id: "laptop",    label: "Hardware provisioning",      owner: "employer", required: false, due: 5, connector: "asset",     desc: "Order laptop + accessories from the supplier-of-record." },
    { id: "sso",       label: "System access (IdP, email)", owner: "employer", required: true,  due: 1, connector: "okta",      desc: "Auto-provisioned via Dayforce → Okta on counter-sign." },
    { id: "orient",    label: "Orientation",                owner: "shared",   required: false, due: 7, connector: null,        desc: "30-minute kickoff with hiring manager + project lead." },
  ];
  const PRO_OFF = [
    { id: "asset_return",   label: "Asset return",              owner: "worker",   required: true,  due: 5,  connector: "asset",   desc: "Laptop, monitor, badge, MFA token." },
    { id: "access_revoke",  label: "Revoke system access",      owner: "employer", required: true,  due: 1,  connector: "okta",    desc: "SSO group removal, VPN cert revoke, email forwarding." },
    { id: "knowledge",      label: "Knowledge transfer",        owner: "shared",   required: false, due: 10, connector: null,      desc: "Final write-up + handover meeting with the team." },
    { id: "exit_interview", label: "Exit interview",            owner: "worker",   required: false, due: 7,  connector: null,      desc: "Optional. HR-led 30-minute conversation." },
    { id: "final_pay",      label: "Final-pay reconciliation",  owner: "employer", required: true,  due: 14, connector: "payroll", desc: "Last invoice closed, COBRA election routed (US)." },
    { id: "dnr_review",     label: "Do-not-rehire review",      owner: "employer", required: false, due: 7,  connector: null,      desc: "Only set for cause; HR-Legal must approve." },
  ];
  const FL_ONB = [
    { id: "invite_code", label: "Invite code",                owner: "worker",   required: true,  due: 1, connector: null,        desc: "6-digit code or QR — worker enters in the mobile app." },
    { id: "id_check",    label: "ID verification",            owner: "worker",   required: true,  due: 2, connector: "rtw",       desc: "Government photo ID. Live selfie capture." },
    { id: "i9",          label: "I-9 / Right to Work",        owner: "worker",   required: true,  due: 2, connector: "rtw",       desc: "Country-aware. US E-Verify or UK Share Code." },
    { id: "w4",          label: "Tax form",                   owner: "worker",   required: true,  due: 2, connector: "payroll",   desc: "W-4 (US) · P45 (UK) · TD1 (CA)." },
    { id: "banking",     label: "Direct deposit",             owner: "worker",   required: true,  due: 2, connector: "banking",   desc: "Single bank for Frontline. Plaid validation." },
    { id: "handbook",    label: "Handbook acknowledgement",   owner: "worker",   required: true,  due: 2, connector: "esign",     desc: "Code of conduct + safety + harassment policy." },
    { id: "orient_vid",  label: "Orientation video",          owner: "worker",   required: true,  due: 2, connector: null,        desc: "5-minute role + site safety overview." },
    { id: "bgcheck",     label: "Background check",           owner: "shared",   required: false, due: 3, connector: "bgcheck",   desc: "Role-dependent — driver / cash-handling roles only." },
    { id: "shift_ready", label: "Shift-ready gate",           owner: "employer", required: true,  due: 2, connector: null,        desc: "Auto-check. Closes when all required tasks complete." },
  ];
  const FL_OFF = [
    { id: "last_shift",    label: "Last-shift handling",         owner: "employer", required: true, due: 0,  connector: null,      desc: "Block new bookings; honor through-date shifts." },
    { id: "asset_return",  label: "Asset return",                owner: "worker",   required: true, due: 3,  connector: null,      desc: "Badge, uniform, locker key, training materials." },
    { id: "deactivation",  label: "Deactivate mobile access",    owner: "employer", required: true, due: 1,  connector: null,      desc: "Worker mobile loses access on the through-date." },
    { id: "final_pay",     label: "Final-pay note",              owner: "employer", required: true, due: 7,  connector: "payroll", desc: "Routed to Dayforce native payroll." },
    { id: "dnr_flag",      label: "Do-not-rehire flag",          owner: "employer", required: false, due: 1, connector: null,      desc: "Policy-gated. Only specific reason codes may set it." },
  ];
  const PRO_CONN = [
    { id: "bgcheck",  label: "Background check",   providers: ["Checkr", "Sterling", "HireRight"], default: "Checkr" },
    { id: "rtw",      label: "Right to Work",      providers: ["E-Verify", "Sterling RTW", "Trust ID"], default: "E-Verify" },
    { id: "esign",    label: "E-Sig",              providers: ["DocuSign", "Adobe Sign"], default: "DocuSign", reuse: "sow" },
    { id: "okta",     label: "SSO provisioning",   providers: ["Okta SCIM", "Azure AD", "Google Workspace"], default: "Okta SCIM" },
    { id: "asset",    label: "Asset provisioning", providers: ["JAMF", "Manual"], default: "JAMF" },
    { id: "payroll",  label: "Payroll handoff",    providers: ["Dayforce Payroll"], default: "Dayforce Payroll", reuse: "ic" },
    { id: "banking",  label: "Banking validation", providers: ["Plaid", "Micro-deposit"], default: "Plaid" },
  ];
  const FL_CONN = [
    { id: "rtw",      label: "Right to Work",      providers: ["E-Verify", "Sterling RTW", "Trust ID"], default: "E-Verify" },
    { id: "bgcheck",  label: "Background check",   providers: ["Checkr", "Sterling"], default: "Checkr" },
    { id: "esign",    label: "Handbook e-Sig",     providers: ["DocuSign"], default: "DocuSign", reuse: "sow" },
    { id: "banking",  label: "Banking validation", providers: ["Plaid", "Micro-deposit"], default: "Plaid" },
    { id: "payroll",  label: "Payroll handoff",    providers: ["Dayforce Payroll"], default: "Dayforce Payroll" },
  ];
  const PRO_APPROVAL = {
    onboardingRiskThreshold: 35,
    onboardingCountryWatch: ["IR", "KP", "SY"],
    offboardingSeveranceThreshold: 25000,
    offboardingDnrRequiresHr: true,
    sla: { onboardingDays: 5, offboardingDays: 7 },
  };
  const FL_APPROVAL = {
    onboardingRiskThreshold: 50,
    onboardingCountryWatch: [],
    offboardingSeveranceThreshold: 10000,
    offboardingDnrRequiresHr: true,
    sla: { onboardingDays: 3, offboardingDays: 3 },
  };

  // ---------- Seed templates -------------------------------------------
  // Four seed templates ship for every org:
  //   · tpl-pro-standard      — default Pro template
  //   · tpl-pro-senior        — adds tier-2 BG check, IP assignment, hardware on
  //   · tpl-fl-standard       — default Frontline template
  //   · tpl-fl-driver         — adds BG check on by default, MVR connector hint
  // Admins can clone any of these and pin the clone per-job.
  function _seedTemplates() {
    const enableAll = (list) => list.map((t) => ({ ...t, enabled: true }));
    const onlyEnabled = (list, ids) => list.map((t) => ({ ...t, enabled: ids.indexOf(t.id) !== -1 }));
    const proConn = (override) => PRO_CONN.map((c) => ({
      ...c, enabled: c.id === "esign" || c.id === "payroll" || (override && override[c.id]),
      provider: c.default,
    }));
    const flConn = (override) => FL_CONN.map((c) => ({
      ...c, enabled: c.id === "rtw" || c.id === "payroll" || (override && override[c.id]),
      provider: c.default,
    }));
    return [
      {
        id: "tpl-pro-standard",
        kind: "pro",
        name: "Standard Professional",
        description: "Permanent Pro engagement. Counter-signs MSA + SOW, runs background check, IP + NDA, system access on day one. Default for any Pro role without an explicit override.",
        isDefault: true,
        builtIn: true,
        onboarding: enableAll(PRO_ONB).map((t) => t.id === "laptop" ? { ...t, enabled: false } : t),
        offboarding: enableAll(PRO_OFF),
        connectors: proConn(),
        approval: { ...PRO_APPROVAL },
      },
      {
        id: "tpl-pro-senior",
        kind: "pro",
        name: "Senior engineering / leadership",
        description: "Pro engagement at staff+, EM, or director level. Hardware provisioning on, BG-check tier bumped, IP + NDA mandatory.",
        isDefault: false,
        builtIn: true,
        onboarding: enableAll(PRO_ONB),
        offboarding: enableAll(PRO_OFF),
        connectors: proConn({ asset: true, okta: true }),
        approval: { ...PRO_APPROVAL, onboardingRiskThreshold: 25, sla: { onboardingDays: 7, offboardingDays: 14 } },
      },
      {
        id: "tpl-fl-standard",
        kind: "frontline",
        name: "Standard Frontline",
        description: "Direct-sourced Frontline worker — retail, hospitality, warehouse, light industrial. Joined Up parity: invite code, RTW, tax form, banking, orientation. Default for any Frontline role.",
        isDefault: true,
        builtIn: true,
        onboarding: onlyEnabled(FL_ONB, ["invite_code","id_check","i9","w4","banking","handbook","orient_vid","shift_ready"]),
        offboarding: enableAll(FL_OFF),
        connectors: flConn(),
        approval: { ...FL_APPROVAL },
      },
      {
        id: "tpl-fl-driver",
        kind: "frontline",
        name: "Driver / cash-handling",
        description: "Frontline roles where a background check + MVR / financial screen is required by policy. Drivers (Class A / CDL / HAZMAT), cash-handling cashiers, security, anyone with key-holder access.",
        isDefault: false,
        builtIn: true,
        onboarding: enableAll(FL_ONB),
        offboarding: enableAll(FL_OFF),
        connectors: flConn({ bgcheck: true }),
        approval: { ...FL_APPROVAL, onboardingRiskThreshold: 35 },
      },
    ];
  }

  function _seedStore() {
    return {
      templates: _seedTemplates(),
      jobAssignments: { professional: {}, frontline: {} },
    };
  }

  // ---------- Storage --------------------------------------------------
  function _load() {
    try {
      const raw = localStorage.getItem(STORE_PREFIX + _orgId());
      if (!raw) return _seedStore();
      const parsed = JSON.parse(raw);
      const seed = _seedStore();
      return {
        templates: Array.isArray(parsed.templates) && parsed.templates.length ? parsed.templates : seed.templates,
        jobAssignments: parsed.jobAssignments && typeof parsed.jobAssignments === "object"
          ? { professional: {}, frontline: {}, ...parsed.jobAssignments }
          : seed.jobAssignments,
      };
    } catch (e) {
      return _seedStore();
    }
  }
  function _save(store) {
    try { localStorage.setItem(STORE_PREFIX + _orgId(), JSON.stringify(store)); } catch (e) {}
    try { window.dispatchEvent(new CustomEvent(EVENT)); } catch (e) {}
  }

  // ---------- Public API · templates ----------------------------------
  function getLifecycleStore() { return _load(); }
  function getLifecycleTemplates(kind) {
    const store = _load();
    return kind ? store.templates.filter((t) => t.kind === kind) : store.templates;
  }
  function getLifecycleTemplate(id) {
    return _load().templates.find((t) => t.id === id) || null;
  }
  function getDefaultLifecycleTemplate(kind) {
    const all = getLifecycleTemplates(kind);
    return all.find((t) => t.isDefault) || all[0] || null;
  }
  function setLifecycleTemplate(id, patch) {
    const store = _load();
    const idx = store.templates.findIndex((t) => t.id === id);
    if (idx === -1) return false;
    store.templates[idx] = { ...store.templates[idx], ...patch };
    _save(store);
    return true;
  }
  function setDefaultLifecycleTemplate(kind, id) {
    const store = _load();
    store.templates = store.templates.map((t) => t.kind === kind ? { ...t, isDefault: t.id === id } : t);
    _save(store);
    return true;
  }
  function createLifecycleTemplate(seed) {
    const store = _load();
    const id = seed.id || ("tpl-" + (seed.kind || "pro") + "-" + Date.now().toString(36));
    store.templates.push({ ...seed, id, isDefault: false, builtIn: false });
    _save(store);
    return id;
  }
  function cloneLifecycleTemplate(srcId, newName) {
    const src = getLifecycleTemplate(srcId);
    if (!src) return null;
    const id = "tpl-" + src.kind + "-" + Date.now().toString(36);
    const clone = {
      ...JSON.parse(JSON.stringify(src)),
      id,
      name: newName || (src.name + " (copy)"),
      isDefault: false,
      builtIn: false,
    };
    const store = _load();
    store.templates.push(clone);
    _save(store);
    return id;
  }
  function deleteLifecycleTemplate(id) {
    const store = _load();
    const t = store.templates.find((x) => x.id === id);
    if (!t) return false;
    if (t.isDefault) return false; // default cannot be deleted
    store.templates = store.templates.filter((x) => x.id !== id);
    // Strip the deleted template from any per-job assignments.
    for (const cat of ["professional", "frontline"]) {
      for (const job of Object.keys(store.jobAssignments[cat] || {})) {
        if (store.jobAssignments[cat][job] === id) delete store.jobAssignments[cat][job];
      }
    }
    _save(store);
    return true;
  }

  // ---------- Public API · per-job assignment ------------------------
  function getJobLifecycleTemplateId(jobName, category) {
    if (!jobName || !category) return null;
    const store = _load();
    const map = store.jobAssignments[category] || {};
    return map[jobName] || null;
  }
  function setJobLifecycleTemplateId(jobName, category, templateId) {
    if (!jobName || !category) return false;
    const store = _load();
    if (!store.jobAssignments[category]) store.jobAssignments[category] = {};
    if (templateId) store.jobAssignments[category][jobName] = templateId;
    else delete store.jobAssignments[category][jobName];
    _save(store);
    return true;
  }
  // Resolve the template a given job should use. Per-job override first,
  // then the default for the matching kind, then null.
  function resolveLifecycleTemplateFor(jobName, category) {
    const kind = category === "professional" ? "pro" : "frontline";
    const id = getJobLifecycleTemplateId(jobName, category);
    if (id) {
      const t = getLifecycleTemplate(id);
      if (t) return t;
    }
    return getDefaultLifecycleTemplate(kind);
  }

  // ---------- Public API · worker-aware resolvers --------------------
  // Infer category from worker. Pro engagement (carries engagementType
  // or _professionalRow) → "professional". Anything else direct-sourced
  // → "frontline". Agency-sourced / contractor return null.
  function _workerCategory(worker) {
    if (!worker) return null;
    if (worker.pool === "Contractor") return null;
    if (worker._professionalRow || worker.pool === "Professional" || worker.engagementType) return "professional";
    if (worker.pool === "Agency" || worker.pool === "EOR") return null;
    return "frontline";
  }
  function _firstJob(worker) {
    return (worker && Array.isArray(worker.jobs) && worker.jobs[0]) || null;
  }
  function resolveLifecycleTemplateForWorker(worker) {
    const cat = _workerCategory(worker);
    if (!cat) return null;
    return resolveLifecycleTemplateFor(_firstJob(worker), cat);
  }
  function getOnboardingTasksForWorker(worker) {
    const t = resolveLifecycleTemplateForWorker(worker);
    return t ? t.onboarding.filter((x) => x.enabled) : [];
  }
  function getOffboardingTasksForWorker(worker) {
    const t = resolveLifecycleTemplateForWorker(worker);
    return t ? t.offboarding.filter((x) => x.enabled) : [];
  }

  // ---------- Backward-compat helpers --------------------------------
  // These resolve through the default template so consumers that
  // call getOnboardingTasks("pro") with no worker context (the Add
  // panel before a job is entered, for instance) still work.
  function getOnboardingTasks(kind) {
    const t = getDefaultLifecycleTemplate(kind);
    return t ? t.onboarding.filter((x) => x.enabled) : [];
  }
  function getOffboardingTasks(kind) {
    const t = getDefaultLifecycleTemplate(kind);
    return t ? t.offboarding.filter((x) => x.enabled) : [];
  }
  // Job-aware variant — when the Add panel knows the role, prefer this.
  function getOnboardingTasksForJob(jobName, category) {
    const t = resolveLifecycleTemplateFor(jobName, category);
    return t ? t.onboarding.filter((x) => x.enabled) : [];
  }
  function getOffboardingTasksForJob(jobName, category) {
    const t = resolveLifecycleTemplateFor(jobName, category);
    return t ? t.offboarding.filter((x) => x.enabled) : [];
  }
  function getLifecycleConnectors(kind) {
    const t = getDefaultLifecycleTemplate(kind);
    return t ? t.connectors : [];
  }
  function getLifecycleApproval(kind) {
    const t = getDefaultLifecycleTemplate(kind);
    return t ? t.approval : null;
  }

  // ---------- Hook -----------------------------------------------------
  function useLifecycleStore() {
    const [v, setV] = useState(() => _load());
    useEffect(() => {
      function onChange() { setV(_load()); }
      window.addEventListener(EVENT, onChange);
      return () => window.removeEventListener(EVENT, onChange);
    }, []);
    return v;
  }
  function useProLifecycleVisible() {
    return window.useFeatureFlag ? !!window.useFeatureFlag("professionalWork") : false;
  }
  function useFrontlineLifecycleVisible() {
    return window.useFeatureFlag ? !!window.useFeatureFlag("frontlineDirect") : false;
  }

  // ---------- Reseed helper for "Restore defaults" -------------------
  function restoreLifecycleDefaults() {
    _save(_seedStore());
  }

  Object.assign(window, {
    // Store
    getLifecycleStore,
    useLifecycleStore,
    restoreLifecycleDefaults,
    // Templates CRUD
    getLifecycleTemplates,
    getLifecycleTemplate,
    getDefaultLifecycleTemplate,
    setLifecycleTemplate,
    setDefaultLifecycleTemplate,
    createLifecycleTemplate,
    cloneLifecycleTemplate,
    deleteLifecycleTemplate,
    // Per-job assignment
    getJobLifecycleTemplateId,
    setJobLifecycleTemplateId,
    resolveLifecycleTemplateFor,
    resolveLifecycleTemplateForWorker,
    // Task readers
    getOnboardingTasks,
    getOffboardingTasks,
    getOnboardingTasksForJob,
    getOffboardingTasksForJob,
    getOnboardingTasksForWorker,
    getOffboardingTasksForWorker,
    getLifecycleConnectors,
    getLifecycleApproval,
    // Visibility hooks
    useProLifecycleVisible,
    useFrontlineLifecycleVisible,
  });
})();
