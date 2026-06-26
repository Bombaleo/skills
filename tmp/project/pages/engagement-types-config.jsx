// =====================================================================
// Flex Work — Engagement Types Configuration (per-org)
//
// v0.78 — the engagement-type axis (Shift / Assignment / Project /
// Statement of Work) moves out of Settings \u2192 Feature Flags and into
// Settings \u2192 Configuration \u2192 Engagement types. The configuration is
// per-org rather than per-tenant-feature-flag: every org carries its
// own pre-baked set of enabled engagement types.
//
// Default policy
//   \u00b7 Every "existing" org (manufacturing, hospitality, retail,
//     healthcare, logistics, staffwise) ships with Shift only.
//   \u00b7 The Energy Power Plant org (Helios Power Generation) ships with
//     all four engagement types active out of the box.
//
// Storage
//   \u00b7 Per-org config lives at `flexwork.engagementTypes.{orgId}` in
//     localStorage as `{ engAssignment, engProject, engStatementOfWork }`.
//   \u00b7 The current org's values are mirrored into the legacy
//     `flexwork.featureFlags` store on each page load so the existing
//     downstream consumers (engagement-type.jsx, v77-native-cols.jsx,
//     feature-flags.jsx LEGACY_FLAG_DERIVATIONS) keep working without
//     change.
//
// Load order
//   This file loads AFTER pages/industry.jsx (uses getCurrentIndustryId)
//   and AFTER pages/feature-flags.jsx (calls setFeatureFlag), and
//   BEFORE pages/engagement-type.jsx + pages/settings-config.jsx (both
//   consumers).
// =====================================================================

(function () {
  const ENG_KEYS = ["engAssignment", "engProject", "engStatementOfWork"];
  const PER_ORG_PREFIX = "flexwork.engagementTypes.";
  const FF_STORAGE_KEY = "flexwork.featureFlags";
  const FF_EVENT       = "featureflags:change";

  // ------ Helpers ----------------------------------------------------
  function _orgId() {
    return (window.getCurrentIndustryId && window.getCurrentIndustryId()) || "manufacturing";
  }

  // Per-org defaults. Energy is the only seeded tenant with the full
  // engagement-type matrix turned on. Every other org is Shift-only \u2014
  // the requisition picker collapses to a single option so the
  // Engagement Type card is hidden on the intake flow.
  function _defaultsForOrg(orgId) {
    if (orgId === "energy") {
      return { engAssignment: true, engProject: true, engStatementOfWork: true };
    }
    return { engAssignment: false, engProject: false, engStatementOfWork: false };
  }

  function _readPerOrg(orgId) {
    try {
      const raw = window.localStorage.getItem(PER_ORG_PREFIX + orgId);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object") return parsed;
      }
    } catch (e) { /* no-op */ }
    return null;
  }

  function _writePerOrg(orgId, map) {
    try { window.localStorage.setItem(PER_ORG_PREFIX + orgId, JSON.stringify(map)); }
    catch (e) { /* no-op */ }
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

  // ------ Public API -------------------------------------------------

  // Returns the resolved engagement-type config for an org (or the
  // current org if omitted): merge of defaults + persisted per-org map.
  // Shape: { engAssignment, engProject, engStatementOfWork }.
  function getEngagementTypeConfig(orgId) {
    const id = orgId || _orgId();
    const defaults = _defaultsForOrg(id);
    const per = _readPerOrg(id);
    return per ? Object.assign({}, defaults, per) : defaults;
  }

  // Returns the list of enabled engagement-type labels for an org.
  // Shift is always included first; the additive types appear in
  // canonical order.
  function getEnabledEngagementTypes(orgId) {
    const cfg = getEngagementTypeConfig(orgId);
    const out = ["Shift"];
    if (cfg.engAssignment)      out.push("Assignment");
    if (cfg.engProject)         out.push("Project");
    if (cfg.engStatementOfWork) out.push("Statement of Work");
    return out;
  }

  // Writes a single engagement-type flag for the current org and
  // mirrors the new value into the legacy feature-flag store so every
  // downstream consumer (engagement-type.jsx, v77-native-cols.jsx,
  // feature-flags.jsx LEGACY_FLAG_DERIVATIONS) re-resolves cleanly.
  // Returns true on success, false when the key isn't a recognised
  // engagement-type key.
  function setEngagementTypeFlag(key, val) {
    if (ENG_KEYS.indexOf(key) === -1) return false;
    const id = _orgId();
    const cur = getEngagementTypeConfig(id);
    cur[key] = !!val;
    _writePerOrg(id, cur);

    // Mirror into the legacy single-tenant feature-flag store so legacy
    // derivations (timesheets / milestones / fixedFee / professionalWork
    // / sow / contractors / v77Axes) and the engagement-type picker
    // both re-read consistently.
    if (window.setFeatureFlag) {
      window.setFeatureFlag(key, !!val);
    } else {
      const ff = _readFF();
      ff[key] = !!val;
      _writeFF(ff);
      try {
        window.dispatchEvent(new CustomEvent(FF_EVENT, { detail: { key, value: !!val } }));
      } catch (e) { /* no-op */ }
    }
    return true;
  }

  // Sync the current org's per-org config back into the legacy
  // feature-flag store. Runs once at page-load so the FF storage
  // matches whatever this org has configured. Also broadcasts
  // `featureflags:change` so listeners re-render in place.
  function syncCurrentOrg() {
    const id = _orgId();
    const cfg = getEngagementTypeConfig(id);
    const ff = _readFF();
    const flipped = [];
    for (const k of ENG_KEYS) {
      if (!!ff[k] !== !!cfg[k]) {
        ff[k] = !!cfg[k];
        flipped.push([k, !!cfg[k]]);
      }
    }
    if (flipped.length) {
      _writeFF(ff);
      try {
        for (const [k, v] of flipped) {
          window.dispatchEvent(new CustomEvent(FF_EVENT, { detail: { key: k, value: v } }));
        }
        // Broadcast a generic "anything-may-have-changed" event so
        // legacy-derivation listeners that don't key off a specific
        // flag (e.g. AxisChipRow) still re-resolve.
        window.dispatchEvent(new CustomEvent(FF_EVENT, { detail: { key: null } }));
      } catch (e) { /* no-op */ }
    }
  }

  // Run the initial sync immediately so any consumer reading
  // getFeatureFlag('engAssignment') gets the per-org value, not a
  // stale single-tenant bit.
  syncCurrentOrg();

  // Patch setCurrentIndustryId so an in-app org switch re-syncs the
  // engagement-type flags into the FF store before the next reload
  // tick. login.jsx triggers a full reload so the sync also re-runs
  // on init, but this keeps any non-reload flow consistent.
  const _origSetOrg = window.setCurrentIndustryId;
  if (typeof _origSetOrg === "function") {
    window.setCurrentIndustryId = function (id) {
      _origSetOrg(id);
      syncCurrentOrg();
    };
  }

  Object.assign(window, {
    getEngagementTypeConfig,
    setEngagementTypeFlag,
    getEnabledEngagementTypes,
    ENG_TYPE_CONFIG_KEYS: ENG_KEYS,
  });
})();
