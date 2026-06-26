// =====================================================================
// Flex Work — Supplier Types Configuration (per-org)
//
// v0.79 — the supplier-type axis (Agency / Independent Contractor / EOR)
// moves out of Settings → Feature Flags and into Settings →
// Configuration → Supplier types. The configuration is per-org rather
// than per-tenant-feature-flag: every org carries its own pre-baked set
// of enabled supplier types.
//
// Default policy
//   · Every existing org (manufacturing, hospitality, retail,
//     logistics, staffwise) ships with Agency only.
//   · The Helios Power Generation tenant (energy) ships with Agency +
//     Independent Contractor + EOR active out of the box.
//   · The Mercy Health System tenant (healthcare) ships with Agency +
//     Float active out of the box — Float surfaces the buyer's own
//     internal cross-site workers (per-diem nurses, traveler-pool
//     RNs) so they can pick up open requisitions alongside agency
//     workers. Float data is synced from Dayforce core (the system of
//     record for the employee record, schedule, and accrued hours);
//     Flex Work just mirrors the profile so the worker is reachable
//     from a requisition's distribution list.
//
// Storage
//   · Per-org config lives at `flexwork.supplierTypes.{orgId}` in
//     localStorage as `{ independentContractor, eor }`. Agency is
//     always-on and not stored.
//   · The current org's values are mirrored into the legacy
//     `flexwork.featureFlags` store on each page load so the existing
//     downstream consumers (workforce, suppliers, invoices, intake,
//     v77-native-cols, axis-scope-bar, req variants, contractor
//     onboarding) keep working without change.
//
// Load order
//   This file loads AFTER pages/industry.jsx (uses getCurrentIndustryId)
//   and AFTER pages/feature-flags.jsx (calls setFeatureFlag), and
//   BEFORE pages/settings-config.jsx + every consumer that reads
//   getFeatureFlag('independentContractor') / getFeatureFlag('eor').
// =====================================================================

(function () {
  const ST_KEYS = ["independentContractor", "eor", "float"];
  const PER_ORG_PREFIX = "flexwork.supplierTypes.";
  const FF_STORAGE_KEY = "flexwork.featureFlags";
  const FF_EVENT       = "featureflags:change";

  // ------ Helpers ----------------------------------------------------
  function _orgId() {
    return (window.getCurrentIndustryId && window.getCurrentIndustryId()) || "manufacturing";
  }

  // Per-org defaults. Helios (energy) seeds IC + EOR; Mercy (healthcare)
  // seeds Float on top of Agency — every other org defaults to Agency-
  // only, so the supplier-type column collapses on lists and the pickers
  // don't show IC / EOR / Float.
  function _defaultsForOrg(orgId) {
    if (orgId === "energy") {
      return { independentContractor: true, eor: true, float: false };
    }
    if (orgId === "healthcare") {
      return { independentContractor: false, eor: false, float: true };
    }
    return { independentContractor: false, eor: false, float: false };
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

  // Returns the resolved supplier-type config for an org (or the
  // current org if omitted): merge of defaults + persisted per-org map.
  // Shape: { independentContractor, eor, float }. Agency is always
  // enabled and not stored.
  function getSupplierTypeConfig(orgId) {
    const id = orgId || _orgId();
    const defaults = _defaultsForOrg(id);
    const per = _readPerOrg(id);
    return per ? Object.assign({}, defaults, per) : defaults;
  }

  // Returns the list of enabled supplier-type labels for an org.
  // Agency is always included first; additive types appear in
  // canonical order.
  function getEnabledSupplierTypes(orgId) {
    const cfg = getSupplierTypeConfig(orgId);
    const out = ["Agency"];
    if (cfg.independentContractor) out.push("Independent Contractor");
    if (cfg.eor)                   out.push("EOR");
    if (cfg.float)                 out.push("Float");
    return out;
  }

  // Writes a single supplier-type flag for the current org and mirrors
  // the new value into the legacy feature-flag store so every
  // downstream consumer (workforce, suppliers, invoices, variants,
  // contractor onboarding, v77-native-cols, axis-scope-bar, feature-
  // flags.jsx LEGACY_FLAG_DERIVATIONS) re-resolves cleanly. Returns
  // true on success, false when the key isn't a recognised supplier-
  // type key.
  function setSupplierTypeFlag(key, val) {
    if (ST_KEYS.indexOf(key) === -1) return false;
    const id = _orgId();
    const cur = getSupplierTypeConfig(id);
    cur[key] = !!val;
    _writePerOrg(id, cur);

    // Mirror into the legacy single-tenant feature-flag store so legacy
    // derivations (`contractors` = engAssignment × independentContractor,
    // `v77Axes`) and every consumer reading getFeatureFlag('independent
    // Contractor') / ('eor') re-resolve in one tick.
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
    const cfg = getSupplierTypeConfig(id);
    const ff = _readFF();
    const flipped = [];
    for (const k of ST_KEYS) {
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
        // flag (e.g. AxisChipRow, useFeatureFlag('contractors')) still
        // re-resolve.
        window.dispatchEvent(new CustomEvent(FF_EVENT, { detail: { key: null } }));
      } catch (e) { /* no-op */ }
    }
  }

  // Run the initial sync immediately so any consumer reading
  // getFeatureFlag('independentContractor') / ('eor') gets the per-org
  // value, not a stale single-tenant bit.
  syncCurrentOrg();

  // Patch setCurrentIndustryId so an in-app org switch re-syncs the
  // supplier-type flags into the FF store before the next reload tick.
  // login.jsx triggers a full reload so the sync also re-runs on init,
  // but this keeps any non-reload flow consistent. Chains over the
  // engagement-types-config.jsx patch — both run.
  const _origSetOrg = window.setCurrentIndustryId;
  if (typeof _origSetOrg === "function") {
    window.setCurrentIndustryId = function (id) {
      _origSetOrg(id);
      syncCurrentOrg();
    };
  }

  Object.assign(window, {
    getSupplierTypeConfig,
    setSupplierTypeFlag,
    getEnabledSupplierTypes,
    SUPPLIER_TYPE_CONFIG_KEYS: ST_KEYS,
  });
})();
