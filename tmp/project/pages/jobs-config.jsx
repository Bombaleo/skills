// =====================================================================
// Flex Work — Jobs Configuration (per-org)
//
// v0.80 — the Jobs catalog axis (Frontline / Professional) moves out of
// Settings → Feature Flags and into Settings → Configuration → Program
// → Jobs. The configuration is per-org rather than per-tenant-feature-
// flag: every org carries its own pre-baked set of enabled job
// categories and its own editable list of jobs per category.
//
// Default policy
//   · Every existing org defaults to Frontline only.
//   · Helios Power Generation (energy) ships with both Frontline and
//     Professional enabled out of the box — the only seeded tenant
//     whose contingent program spans both books of work.
//
// Storage
//   · Per-org category config lives at
//       flexwork.jobsCategories.{orgId}
//     in localStorage as `{ frontline: bool, professional: bool }`.
//   · Per-org job lists live at
//       flexwork.jobsList.{orgId}.{category}
//     where `category` is "frontline" or "professional". Lists are
//     stored as JSON-encoded string arrays of job titles. When no
//     list has been persisted, the seed defaults below are returned.
//
// Backward-compat
//   · The current org's professional-category value is mirrored into
//     the legacy `flexwork.featureFlags` store under the
//     `professionalJobTypes` key on each page load and on every toggle
//     so existing consumers (new-requisition.jsx JobPicker,
//     role-defaults.jsx, requisition-templates.jsx, reporting filters)
//     keep working without per-page edits.
//
// Load order
//   This file loads AFTER pages/industry.jsx (uses getCurrentIndustryId)
//   and AFTER pages/feature-flags.jsx (calls setFeatureFlag), and
//   BEFORE pages/new-requisition.jsx + pages/settings-config.jsx +
//   pages/settings.jsx + pages/jobs-settings.jsx (all consumers).
// =====================================================================

(function () {
  const JC_KEYS = ["frontline", "professional"];
  const CATEGORY_PREFIX = "flexwork.jobsCategories.";
  const LIST_PREFIX     = "flexwork.jobsList.";
  const FF_STORAGE_KEY  = "flexwork.featureFlags";
  const FF_EVENT        = "featureflags:change";
  const JOBS_EVENT      = "jobs:change";

  // ------ Seed catalogs ----------------------------------------------
  // The Frontline list intentionally matches the constant carried by
  // pages/new-requisition.jsx so existing surfaces render byte-identical
  // to today for tenants that haven't touched the list yet. The
  // Professional list is the same one the legacy
  // `professionalJobTypes` flag used to gate.
  const SEED_FRONTLINE = [
    "Production Associate",
    "Production Line Associate",
    "Pickers",
    "Packers",
    "Forklift Operator",
    "Warehouse Associate",
    "Material Handler",
    "Quality Inspector",
    "Machine Operator",
    "Line Managers",
    "Sorter",
    "Loader / Unloader",
  ];
  const SEED_PROFESSIONAL = [
    "Software Engineer",
    "Senior Software Engineer",
    "Engineering Manager",
    "Product Manager",
    "Project Manager",
    "Business Analyst",
    "Data Analyst",
    "Data Scientist",
    "UX Designer",
    "Product Designer",
    "DevOps Engineer",
    "QA Engineer",
    "Financial Analyst",
    "Marketing Manager",
    "HR Business Partner",
    "Operations Manager",
  ];

  // ------ Helpers ----------------------------------------------------
  function _orgId() {
    return (window.getCurrentIndustryId && window.getCurrentIndustryId()) || "manufacturing";
  }

  function _defaultsForOrg(orgId) {
    if (orgId === "energy") {
      return { frontline: true, professional: true };
    }
    return { frontline: true, professional: false };
  }

  function _seedForCategory(category) {
    if (category === "professional") return SEED_PROFESSIONAL.slice();
    return SEED_FRONTLINE.slice();
  }

  function _readPerOrgCategory(orgId) {
    try {
      const raw = window.localStorage.getItem(CATEGORY_PREFIX + orgId);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object") return parsed;
      }
    } catch (e) { /* no-op */ }
    return null;
  }

  function _writePerOrgCategory(orgId, map) {
    try { window.localStorage.setItem(CATEGORY_PREFIX + orgId, JSON.stringify(map)); }
    catch (e) { /* no-op */ }
  }

  function _readList(orgId, category) {
    try {
      const raw = window.localStorage.getItem(LIST_PREFIX + orgId + "." + category);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed.slice();
      }
    } catch (e) { /* no-op */ }
    return null;
  }

  function _writeList(orgId, category, list) {
    try {
      window.localStorage.setItem(
        LIST_PREFIX + orgId + "." + category,
        JSON.stringify(list)
      );
    } catch (e) { /* no-op */ }
  }

  function _readFF() {
    try {
      const raw = window.localStorage.getItem(FF_STORAGE_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      return (parsed && typeof parsed === "object") ? parsed : {};
    } catch (e) { return {}; }
  }

  function _writeFF(map) {
    try { window.localStorage.setItem(FF_STORAGE_KEY, JSON.stringify(map)); }
    catch (e) { /* no-op */ }
  }

  // Localize via the industry pack so seeded jobs read naturally for
  // every org (Helios → "Reactor Yard" etc.). When the pack doesn't
  // override a string, localize() returns it unchanged.
  function _maybeLocalize(arr) {
    if (typeof window === "undefined" || typeof window.localize !== "function") return arr;
    return arr.map((s) => window.localize(s));
  }

  // ------ Public API -------------------------------------------------

  // Returns the resolved category config for an org (or the current
  // org if omitted). Shape: { frontline, professional }. Both bits are
  // honest booleans; frontline is conventionally on but can be turned
  // off as long as professional is on so the picker never goes empty.
  function getJobsCategoryConfig(orgId) {
    const id = orgId || _orgId();
    const defaults = _defaultsForOrg(id);
    const per = _readPerOrgCategory(id);
    return per ? Object.assign({}, defaults, per) : defaults;
  }

  // Returns the list of enabled category labels for an org.
  function getEnabledJobCategories(orgId) {
    const cfg = getJobsCategoryConfig(orgId);
    const out = [];
    if (cfg.frontline)    out.push("Frontline");
    if (cfg.professional) out.push("Professional");
    return out;
  }

  // Writes a single category bit for the current org. Enforces the
  // "at least one category must stay enabled" invariant: when the
  // caller would land us at frontline=false × professional=false, the
  // sibling bit is force-flipped on so a picker never goes empty.
  // Mirrors professional → legacy `professionalJobTypes` FF.
  function setJobsCategoryFlag(key, val) {
    if (JC_KEYS.indexOf(key) === -1) return false;
    const id = _orgId();
    const cur = getJobsCategoryConfig(id);
    cur[key] = !!val;
    if (!cur.frontline && !cur.professional) {
      // Force the sibling on so the picker never empties out. This
      // matches how chrome.jsx hides the Settings → Jobs tab when no
      // category is on, but we never want to actually get there.
      cur[key === "frontline" ? "professional" : "frontline"] = true;
    }
    _writePerOrgCategory(id, cur);

    // Mirror professional → legacy feature-flag store so every
    // consumer reading getFeatureFlag('professionalJobTypes') /
    // useFeatureFlag('professionalJobTypes') re-resolves in one tick.
    if (window.setFeatureFlag) {
      window.setFeatureFlag("professionalJobTypes", !!cur.professional);
    } else {
      const ff = _readFF();
      ff.professionalJobTypes = !!cur.professional;
      _writeFF(ff);
      try {
        window.dispatchEvent(new CustomEvent(FF_EVENT, { detail: { key: "professionalJobTypes", value: !!cur.professional } }));
      } catch (e) { /* no-op */ }
    }

    try {
      window.dispatchEvent(new CustomEvent(JOBS_EVENT, { detail: { kind: "category", key, value: !!val } }));
    } catch (e) { /* no-op */ }

    return true;
  }

  // Returns the live job list for an org × category. Falls back to
  // the seed catalog when no override has been persisted. Always
  // returns a fresh array so callers can mutate safely.
  function getJobsList(orgId, category) {
    if (JC_KEYS.indexOf(category) === -1) return [];
    const id = orgId || _orgId();
    const stored = _readList(id, category);
    if (stored) return stored;
    return _maybeLocalize(_seedForCategory(category));
  }

  // Replace the entire list for an org × category. Used by the
  // Settings → Jobs page's add / remove / reorder flows.
  function setJobsList(orgId, category, list) {
    if (JC_KEYS.indexOf(category) === -1) return false;
    if (!Array.isArray(list)) return false;
    const id = orgId || _orgId();
    // Trim + de-duplicate to keep the picker stable.
    const seen = new Set();
    const clean = [];
    for (const v of list) {
      const s = (typeof v === "string" ? v : String(v || "")).trim();
      if (!s) continue;
      const key = s.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      clean.push(s);
    }
    _writeList(id, category, clean);
    try {
      window.dispatchEvent(new CustomEvent(JOBS_EVENT, { detail: { kind: "list", category, orgId: id } }));
    } catch (e) { /* no-op */ }
    return true;
  }

  function addJob(orgId, category, name) {
    const list = getJobsList(orgId, category);
    return setJobsList(orgId, category, list.concat([name]));
  }

  function removeJob(orgId, category, name) {
    const list = getJobsList(orgId, category);
    return setJobsList(
      orgId,
      category,
      list.filter((x) => x.toLowerCase() !== String(name || "").toLowerCase())
    );
  }

  // Compose the full picker catalog for the current org × the active
  // category config. Professional first, then Frontline — same order
  // the old constants used. Consumers (JobPicker, role-defaults, etc.)
  // can call this without knowing how the config is stored.
  function getActiveJobOptions(orgId) {
    const id = orgId || _orgId();
    const cfg = getJobsCategoryConfig(id);
    const pro = cfg.professional ? getJobsList(id, "professional") : [];
    const fl  = cfg.frontline    ? getJobsList(id, "frontline")    : [];
    return [...pro, ...fl];
  }

  // Sync the current org's professional-category bit back into the
  // legacy feature-flag store. Runs once at page-load so the FF
  // storage matches whatever this org has configured. Also broadcasts
  // `featureflags:change` so listeners re-render in place.
  function syncCurrentOrg() {
    const id = _orgId();
    const cfg = getJobsCategoryConfig(id);
    const ff = _readFF();
    if (!!ff.professionalJobTypes !== !!cfg.professional) {
      ff.professionalJobTypes = !!cfg.professional;
      _writeFF(ff);
      try {
        window.dispatchEvent(new CustomEvent(FF_EVENT, { detail: { key: "professionalJobTypes", value: !!cfg.professional } }));
        window.dispatchEvent(new CustomEvent(FF_EVENT, { detail: { key: null } }));
      } catch (e) { /* no-op */ }
    }
  }

  syncCurrentOrg();

  // Patch setCurrentIndustryId so an in-app org switch re-syncs the
  // jobs-category bit into the FF store before the next reload tick.
  // Chains over the engagement-types + supplier-types patches.
  const _origSetOrg = window.setCurrentIndustryId;
  if (typeof _origSetOrg === "function") {
    window.setCurrentIndustryId = function (id) {
      _origSetOrg(id);
      syncCurrentOrg();
    };
  }

  // ------ Row-level "is this a professional job?" check ----------------
  // Cross-cutting surfaces (Timesheets, Invoices, Workforce) need a fast
  // synchronous way to tell whether a given role string belongs to the
  // active org's Professional catalog. The check is org-scoped because
  // Helios and a tenant that hand-typed their own list may have different
  // catalogs. We compare case-insensitively and cache the catalog into a
  // module-local Set, rebuilding on jobs:change so admin edits in
  // Settings → Jobs propagate without a navigation round-trip.
  let _proSetOrg = null;
  let _proSet = null;
  function _ensureProSet() {
    const id = _orgId();
    if (id === _proSetOrg && _proSet) return _proSet;
    _proSetOrg = id;
    const list = getJobsList(id, "professional") || [];
    _proSet = new Set(list.map((s) => String(s || "").toLowerCase()));
    return _proSet;
  }
  // Invalidate the memoized set whenever Settings → Jobs publishes a
  // change. Also re-bind on industry switch.
  try {
    window.addEventListener(JOBS_EVENT, () => { _proSet = null; });
  } catch (e) { /* no-op */ }

  // Returns true when the active org has the Professional category on
  // AND the provided role title is in that org's Professional list.
  // Surfaces should additionally gate the whole behavior on
  // professionalJobsEnabled() so "Software Engineer" doesn't get the
  // pro treatment in an org that hasn't turned the category on.
  function isProfessionalJobRole(role) {
    if (!role) return false;
    if (!professionalJobsEnabled()) return false;
    const set = _ensureProSet();
    if (!set.size) return false;
    const r = String(role).toLowerCase();
    return set.has(r);
  }

  // True when the current org has Professional turned on in its jobs
  // category config. This is the org-level gate every cross-cutting
  // surface should check before injecting Professional sample rows.
  function professionalJobsEnabled() {
    const cfg = getJobsCategoryConfig();
    return !!(cfg && cfg.professional);
  }

  // React hook — re-renders consumers whenever the org's jobs config or
  // catalog changes. Used by Timesheets / Workforce row renderers so a
  // toggle in Settings → Configuration → Jobs flips the field swap
  // without a page reload.
  function useProfessionalJobsActive() {
    if (typeof React === "undefined") return professionalJobsEnabled();
    const [tick, setTick] = React.useState(0);
    React.useEffect(() => {
      const onChange = () => setTick((n) => n + 1);
      try { window.addEventListener(JOBS_EVENT, onChange); } catch (e) {}
      try { window.addEventListener(FF_EVENT, onChange); } catch (e) {}
      return () => {
        try { window.removeEventListener(JOBS_EVENT, onChange); } catch (e) {}
        try { window.removeEventListener(FF_EVENT, onChange); } catch (e) {}
      };
    }, []);
    return professionalJobsEnabled();
  }

  Object.assign(window, {
    getJobsCategoryConfig,
    setJobsCategoryFlag,
    getEnabledJobCategories,
    getJobsList,
    setJobsList,
    addJob,
    removeJob,
    getActiveJobOptions,
    isProfessionalJobRole,
    professionalJobsEnabled,
    useProfessionalJobsActive,
    JOBS_CONFIG_KEYS: JC_KEYS,
    JOBS_CHANGE_EVENT: JOBS_EVENT,
  });
})();
