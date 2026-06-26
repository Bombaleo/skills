// =====================================================================
// Flex Work — Rate Cards (data + resolution layer)   v1.44
//
// A rate card sets the BASE PAY rate per job — the worker's hourly pay
// before any agency markup, burden, premium, or tax layer (those live
// in the bill-rate engine, pages/supplier-contract.jsx). It is authored
// once at the tenant (org) level in Settings → Jobs, then inherited
// DOWN the Dayforce org hierarchy (Corporate → Region → District →
// Site → Department) with a per-job override at any level, and inherited
// again onto each agency contract where it can be overridden per
// position × location.
//
// Each card also carries a single named Peak season window (start–end)
// and a per-job season uplift — either an absolute amount or a
// percentage — applied to base pay during that window.
//
// Rate cards are VERSIONED: an admin creates a new version with an
// effective date; the version whose effective date is the most recent
// one on or before "today" is the active card. Future-dated versions
// are Scheduled; superseded ones are Expired.
//
// Storage (all per-org, localStorage)
//   flexwork.rateCards.{orgId}             → { versions: [Version, …] }
//   flexwork.rateCardNodeOvr.{orgId}       → { [nodeId]: { [job]: Patch } }
//   flexwork.rateCardAgencyOvr.{orgId}     → { [supplierId]: { [job]: [ScopedPatch] } }
//
// Version  = { id, label, effectiveFrom (YYYY-MM-DD), createdBy,
//              createdAt, note, peakSeason: { name, from, to },
//              rows: { [job]: Row } }
// Row      = { basePay: number, uplift: { mode: "pct"|"abs", value: number } }
// Patch    = sparse Row (basePay? / uplift?)  — sparse override at a node
// ScopedPatch = { scope: "all"|locationId, basePay: number, note? }
//
// Load order: AFTER pages/jobs-config.jsx (reads getActiveJobOptions /
// getJobsList) + pages/org-tree.jsx (reads orgAncestors / ORG_INDEX) +
// pages/locations.jsx (reads LOCATIONS), BEFORE pages/rate-cards-ui.jsx
// and every consumer (jobs-settings, org-tree detail, suppliers).
// =====================================================================

(function () {
  const CARDS_PREFIX  = "flexwork.rateCards.";
  const NODEOVR_PREFIX = "flexwork.rateCardNodeOvr.";
  const AGENCYOVR_PREFIX = "flexwork.rateCardAgencyOvr.";
  const RC_EVENT = "ratecards:change";

  // ---- helpers -------------------------------------------------------
  function _orgId() {
    return (window.getCurrentIndustryId && window.getCurrentIndustryId()) || "manufacturing";
  }
  function _today() { return new Date().toISOString().slice(0, 10); }
  function _uid(prefix) {
    return (prefix || "rc") + "-" + Date.now().toString(36) + "-" + Math.floor(Math.random() * 1e4).toString(36);
  }
  function _read(key) {
    try {
      const raw = window.localStorage.getItem(key);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : null;
    } catch (e) { return null; }
  }
  function _write(key, val) {
    try { window.localStorage.setItem(key, JSON.stringify(val)); } catch (e) { /* no-op */ }
  }
  function _emit(detail) {
    try { window.dispatchEvent(new CustomEvent(RC_EVENT, { detail: detail || {} })); } catch (e) { /* no-op */ }
  }

  // ---- seed base pay per job ----------------------------------------
  // Plausible US hourly base pay. Anything not in the map falls back to
  // a deterministic value so newly-added / localized jobs still seed.
  const SEED_BASE = {
    // Frontline
    "Production Associate": 22, "Production Line Associate": 21,
    "Pickers": 18, "Picker": 18, "Packers": 18, "Forklift Operator": 23,
    "Warehouse Associate": 19, "Material Handler": 19, "Quality Inspector": 24,
    "Machine Operator": 22, "Line Managers": 34, "Line Manager": 34,
    "Sorter": 17, "Loader / Unloader": 18, "Operator": 22, "Inspector": 24,
    "Assembler": 20, "Warehouse Clerk": 19,
    // Helios localisation
    "Reactor Yard": 31, "Power Plant": 29, "Powerline Way": 27, "Turbine Blvd.": 28,
    // Professional (contractor hourly)
    "Software Engineer": 65, "Senior Software Engineer": 85, "Engineering Manager": 95,
    "Product Manager": 80, "Project Manager": 70, "Business Analyst": 60,
    "Data Analyst": 58, "Data Scientist": 78, "UX Designer": 62, "Product Designer": 64,
    "DevOps Engineer": 75, "QA Engineer": 55, "Financial Analyst": 60,
    "Marketing Manager": 65, "HR Business Partner": 58, "Operations Manager": 70,
  };
  function _seedBaseFor(job) {
    if (SEED_BASE[job] != null) return SEED_BASE[job];
    let h = 0;
    for (let i = 0; i < job.length; i++) h = (h * 31 + job.charCodeAt(i)) >>> 0;
    return 16 + (h % 18); // 16–33
  }
  // Deterministic seed uplift: most jobs +12% peak, supervisory roles
  // a flat absolute bump, a few none.
  function _seedUpliftFor(job, i) {
    const sup = /manager|inspector|supervisor|captain/i.test(job);
    if (sup) return { mode: "abs", value: 3 };
    if (i % 5 === 0) return { mode: "pct", value: 8 };
    return { mode: "pct", value: 12 };
  }

  // Active jobs for an org (Professional first, then Frontline) — same
  // catalog the requisition picker uses.
  function _jobsForOrg(orgId) {
    if (window.getActiveJobOptions) return window.getActiveJobOptions(orgId);
    if (window.getJobsList) return window.getJobsList(orgId, "frontline");
    return Object.keys(SEED_BASE).slice(0, 12);
  }

  function _seedRows(orgId) {
    const jobs = _jobsForOrg(orgId);
    const rows = {};
    jobs.forEach((job, i) => {
      rows[job] = { basePay: _seedBaseFor(job), uplift: _seedUpliftFor(job, i) };
    });
    return rows;
  }

  // Default store for an org: one active version, effective at the start
  // of the current year, plus one historical (expired) version so the
  // versions table shows a realistic timeline out of the box.
  function _defaultStore(orgId) {
    const y = new Date().getFullYear();
    const rows = _seedRows(orgId);
    // Last year's card: 4% lower base pay, same structure.
    const prevRows = {};
    Object.keys(rows).forEach((j) => {
      prevRows[j] = {
        basePay: Math.round(rows[j].basePay * 0.96 * 100) / 100,
        uplift: { ...rows[j].uplift },
      };
    });
    return {
      versions: [
        {
          id: _uid("rcv"),
          label: `${y} rate card`,
          effectiveFrom: `${y}-01-01`,
          createdBy: "Maya Chen",
          createdAt: `${y - 1}-12-04`,
          note: "Annual base-pay refresh",
          peakSeason: { name: "Peak season", from: `${y}-11-15`, to: `${y + 1}-01-05` },
          rows,
        },
        {
          id: _uid("rcv"),
          label: `${y - 1} rate card`,
          effectiveFrom: `${y - 1}-01-01`,
          createdBy: "Alex Moreno",
          createdAt: `${y - 2}-12-10`,
          note: "Initial load from rate_cards_v5.xlsx",
          peakSeason: { name: "Peak season", from: `${y - 1}-11-15`, to: `${y}-01-05` },
          rows: prevRows,
        },
      ],
    };
  }

  function getStore(orgId) {
    const id = orgId || _orgId();
    const stored = _read(CARDS_PREFIX + id);
    if (stored && Array.isArray(stored.versions) && stored.versions.length) return stored;
    const def = _defaultStore(id);
    _write(CARDS_PREFIX + id, def);
    return def;
  }
  function _saveStore(orgId, store) {
    _write(CARDS_PREFIX + (orgId || _orgId()), store);
  }

  // Versions sorted newest-effective first.
  function getRateCardVersions(orgId) {
    const store = getStore(orgId);
    return store.versions.slice().sort((a, b) => (b.effectiveFrom || "").localeCompare(a.effectiveFrom || ""));
  }

  // Status of a version relative to the set + a reference date.
  //   active    → most recent effectiveFrom on/before asOf
  //   scheduled → effectiveFrom in the future
  //   expired   → superseded by a newer active card
  function rcVersionStatus(version, orgId, asOf) {
    const ref = asOf || _today();
    const versions = getRateCardVersions(orgId);
    if ((version.effectiveFrom || "") > ref) return "scheduled";
    // Active = the latest version with effectiveFrom <= ref.
    const active = versions.find((v) => (v.effectiveFrom || "") <= ref);
    if (active && active.id === version.id) return "active";
    return "expired";
  }

  function getActiveRateCardVersion(orgId, asOf) {
    const ref = asOf || _today();
    const versions = getRateCardVersions(orgId);
    return versions.find((v) => (v.effectiveFrom || "") <= ref) || versions[versions.length - 1] || null;
  }

  function getVersionById(orgId, versionId) {
    return getStore(orgId).versions.find((v) => v.id === versionId) || null;
  }

  // Create a new version, cloning rows + season from a base version
  // (defaults to the current active one). Returns the new version.
  function createRateCardVersion(orgId, opts) {
    opts = opts || {};
    const id = orgId || _orgId();
    const store = getStore(id);
    const base = (opts.basedOnId && getVersionById(id, opts.basedOnId))
      || getActiveRateCardVersion(id)
      || { rows: _seedRows(id), peakSeason: { name: "Peak season", from: "", to: "" } };
    const version = {
      id: _uid("rcv"),
      label: opts.label || "New rate card",
      effectiveFrom: opts.effectiveFrom || _today(),
      createdBy: opts.createdBy || "You",
      createdAt: _today(),
      note: opts.note || "",
      peakSeason: { ...(base.peakSeason || { name: "Peak season", from: "", to: "" }) },
      rows: JSON.parse(JSON.stringify(base.rows || {})),
    };
    store.versions.push(version);
    _saveStore(id, store);
    _emit({ kind: "version-create", orgId: id, versionId: version.id });
    return version;
  }

  function updateVersionMeta(orgId, versionId, patch) {
    const id = orgId || _orgId();
    const store = getStore(id);
    const v = store.versions.find((x) => x.id === versionId);
    if (!v) return false;
    Object.assign(v, patch || {});
    _saveStore(id, store);
    _emit({ kind: "version-meta", orgId: id, versionId });
    return true;
  }

  function setPeakSeason(orgId, versionId, season) {
    return updateVersionMeta(orgId, versionId, { peakSeason: { ...season } });
  }

  // Set/merge a single job row on a version. patch may carry basePay
  // and/or uplift.
  function setRateCardRow(orgId, versionId, job, patch) {
    const id = orgId || _orgId();
    const store = getStore(id);
    const v = store.versions.find((x) => x.id === versionId);
    if (!v) return false;
    const cur = v.rows[job] || { basePay: _seedBaseFor(job), uplift: { mode: "pct", value: 0 } };
    v.rows[job] = {
      basePay: patch.basePay != null ? patch.basePay : cur.basePay,
      uplift: patch.uplift ? { ...patch.uplift } : cur.uplift,
    };
    _saveStore(id, store);
    _emit({ kind: "row", orgId: id, versionId, job });
    return true;
  }

  function deleteRateCardVersion(orgId, versionId) {
    const id = orgId || _orgId();
    const store = getStore(id);
    if (store.versions.length <= 1) return false;
    store.versions = store.versions.filter((v) => v.id !== versionId);
    _saveStore(id, store);
    _emit({ kind: "version-delete", orgId: id });
    return true;
  }

  // Compute the peak (in-season) rate from a base + uplift.
  function applyUplift(basePay, uplift) {
    if (!uplift || uplift.value == null) return basePay;
    if (uplift.mode === "abs") return Math.round((basePay + uplift.value) * 100) / 100;
    return Math.round(basePay * (1 + uplift.value / 100) * 100) / 100;
  }
  function upliftLabel(uplift) {
    if (!uplift || !uplift.value) return "None";
    return uplift.mode === "abs"
      ? `+${(window.curSymbol ? window.curSymbol() : "$")}${uplift.value}`
      : `+${uplift.value}%`;
  }

  // ===================================================================
  // ORG-NODE OVERRIDES
  // ===================================================================
  function getNodeOverridesMap(orgId) {
    return _read(NODEOVR_PREFIX + (orgId || _orgId())) || {};
  }
  function getNodeOverrides(orgId, nodeId) {
    return getNodeOverridesMap(orgId)[nodeId] || {};
  }
  // patch === null clears the whole job override at that node.
  function setNodeOverride(orgId, nodeId, job, patch) {
    const id = orgId || _orgId();
    const map = getNodeOverridesMap(id);
    const node = map[nodeId] || {};
    if (patch === null) {
      delete node[job];
    } else {
      const cur = node[job] || {};
      const next = { ...cur };
      if (patch.basePay !== undefined) next.basePay = patch.basePay;
      if (patch.uplift !== undefined) next.uplift = patch.uplift ? { ...patch.uplift } : undefined;
      node[job] = next;
    }
    if (Object.keys(node).length === 0) delete map[nodeId];
    else map[nodeId] = node;
    _write(NODEOVR_PREFIX + id, map);
    _emit({ kind: "node-override", orgId: id, nodeId, job });
    return true;
  }
  function clearNodeOverrides(orgId, nodeId) {
    const id = orgId || _orgId();
    const map = getNodeOverridesMap(id);
    delete map[nodeId];
    _write(NODEOVR_PREFIX + id, map);
    _emit({ kind: "node-override-clear", orgId: id, nodeId });
  }

  // Resolve the effective rate card AT an org node, walking root→node
  // and layering each ancestor's override over the global version.
  // Returns rows keyed by job: {
  //   basePay, uplift, peakRate,
  //   baseSource:  { level, name, nodeId } | { level:"Global" },
  //   upliftSource:{ … },
  //   ownOverride: bool      // the queried node itself overrides this job
  // }
  function resolveNodeRateCard(orgId, nodeId, versionId) {
    const id = orgId || _orgId();
    const version = (versionId && getVersionById(id, versionId)) || getActiveRateCardVersion(id);
    const baseRows = (version && version.rows) || {};
    const ovrMap = getNodeOverridesMap(id);
    const ancestors = (window.orgAncestors ? window.orgAncestors(nodeId) : []) || [];
    const segLabel = (seg) => (window.ORG_SEGMENT_SINGULAR && window.ORG_SEGMENT_SINGULAR[seg]) || seg;

    const out = {};
    Object.keys(baseRows).forEach((job) => {
      let basePay = baseRows[job].basePay;
      let uplift = baseRows[job].uplift;
      let baseSource = { level: "Global", name: "Global rate card", nodeId: null };
      let upliftSource = { level: "Global", name: "Global rate card", nodeId: null };
      ancestors.forEach((anc) => {
        const ov = (ovrMap[anc.id] || {})[job];
        if (!ov) return;
        if (ov.basePay != null) {
          basePay = ov.basePay;
          baseSource = { level: segLabel(anc.segment), name: anc.name, nodeId: anc.id };
        }
        if (ov.uplift !== undefined && ov.uplift) {
          uplift = ov.uplift;
          upliftSource = { level: segLabel(anc.segment), name: anc.name, nodeId: anc.id };
        }
      });
      const ownOv = (ovrMap[nodeId] || {})[job];
      out[job] = {
        basePay, uplift,
        peakRate: applyUplift(basePay, uplift),
        baseSource, upliftSource,
        ownOverride: !!ownOv,
      };
    });
    return { version, rows: out };
  }

  // ===================================================================
  // AGENCY (supplier-contract) OVERRIDES — per job × location scope.
  // ===================================================================
  function getAgencyOverridesMap(orgId) {
    return _read(AGENCYOVR_PREFIX + (orgId || _orgId())) || {};
  }
  function getAgencyOverrides(orgId, supplierId) {
    return getAgencyOverridesMap(orgId)[supplierId] || {};
  }
  // Add or update a scoped override for a job. scope is "all" or a
  // location id. Passing basePay === null removes that scoped row.
  function setAgencyOverride(orgId, supplierId, job, scope, basePay, note) {
    const id = orgId || _orgId();
    const map = getAgencyOverridesMap(id);
    const sup = map[supplierId] || {};
    const list = (sup[job] || []).slice();
    const idx = list.findIndex((x) => x.scope === scope);
    if (basePay === null) {
      if (idx >= 0) list.splice(idx, 1);
    } else if (idx >= 0) {
      list[idx] = { scope, basePay, note: note || list[idx].note || "" };
    } else {
      list.push({ scope, basePay, note: note || "" });
    }
    if (list.length === 0) delete sup[job];
    else sup[job] = list;
    if (Object.keys(sup).length === 0) delete map[supplierId];
    else map[supplierId] = sup;
    _write(AGENCYOVR_PREFIX + id, map);
    _emit({ kind: "agency-override", orgId: id, supplierId, job, scope });
    return true;
  }

  // Resolve the agency's effective base pay per job. The "inherited"
  // value is the org-level (global) base; an agency override (scoped to
  // a location, or "all") wins. Returns rows keyed by job:
  //   { inherited, uplift, scopes: [{scope, basePay, note}], effective }
  // where `effective` is the all-locations override if present else
  // the inherited value.
  function resolveAgencyRateCard(orgId, supplierId, versionId) {
    const id = orgId || _orgId();
    const version = (versionId && getVersionById(id, versionId)) || getActiveRateCardVersion(id);
    const baseRows = (version && version.rows) || {};
    const overrides = getAgencyOverrides(id, supplierId);
    const out = {};
    Object.keys(baseRows).forEach((job) => {
      const inherited = baseRows[job].basePay;
      const scopes = (overrides[job] || []).slice().sort((a, b) =>
        (a.scope === "all" ? -1 : 1) - (b.scope === "all" ? -1 : 1));
      const allScope = scopes.find((s) => s.scope === "all");
      out[job] = {
        inherited,
        uplift: baseRows[job].uplift,
        scopes,
        effective: allScope ? allScope.basePay : inherited,
        hasOverride: scopes.length > 0,
      };
    });
    return { version, rows: out };
  }

  // Sites for the active org (for the location-scope picker). Falls back
  // to a small built-in list when LOCATIONS isn't on window.
  function getRateCardSites() {
    const locs = (typeof window !== "undefined" && window.LOCATIONS) || [];
    return locs.map((l) => ({ id: l.id, name: l.name }));
  }

  function siteName(locId) {
    if (locId === "all") return "All locations";
    const s = getRateCardSites().find((x) => x.id === locId);
    return s ? s.name : locId;
  }

  // ===================================================================
  // IMPORT / EXPORT (v1.43)
  // CSV is the interchange format. Pre-parity = base pay; post-parity =
  // peak rate (base + season uplift). Export lets the admin pick which
  // jobs and which rate column(s) to emit; import maps rows back by job
  // name and resolves conflicts with a chosen strategy.
  // ===================================================================
  function _csvEscape(v) {
    const s = String(v == null ? "" : v);
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }
  function _jobCategory(orgId, job) {
    const pro = (window.getJobsList ? window.getJobsList(orgId, "professional") : []) || [];
    return pro.indexOf(job) >= 0 ? "Professional" : "Frontline";
  }

  // Build a CSV string from a version's rows.
  //   opts = { jobs:[names]|null(all), rates:"base"|"peak"|"both",
  //            includeSeason:bool }
  function rcBuildCsv(orgId, versionId, opts) {
    opts = opts || {};
    const id = orgId || _orgId();
    const version = (versionId && getVersionById(id, versionId)) || getActiveRateCardVersion(id);
    if (!version) return "";
    const rates = opts.rates || "both";
    const includeSeason = opts.includeSeason !== false;
    const allJobs = Object.keys(version.rows || {});
    const jobs = (opts.jobs && opts.jobs.length) ? allJobs.filter((j) => opts.jobs.indexOf(j) >= 0) : allJobs;

    const cols = ["Job", "Category"];
    if (rates === "base" || rates === "both") cols.push("Base pay (pre-parity)");
    if (includeSeason) cols.push("Season uplift type", "Season uplift value");
    if (rates === "peak" || rates === "both") cols.push("Peak rate (post-parity)");

    const lines = [cols.join(",")];
    jobs.forEach((job) => {
      const r = version.rows[job];
      if (!r) return;
      const cells = [job, _jobCategory(id, job)];
      if (rates === "base" || rates === "both") cells.push(r.basePay);
      if (includeSeason) {
        const has = r.uplift && r.uplift.value;
        cells.push(has ? (r.uplift.mode === "abs" ? "Amount" : "Percent") : "None");
        cells.push(has ? r.uplift.value : 0);
      }
      if (rates === "peak" || rates === "both") cells.push(applyUplift(r.basePay, r.uplift));
      lines.push(cells.map(_csvEscape).join(","));
    });
    return lines.join("\r\n");
  }

  // Minimal RFC-4180-ish CSV reader (handles quotes + escaped quotes).
  function _parseCsvText(text) {
    const rows = [];
    let row = [], cell = "", i = 0, inQ = false;
    const s = String(text || "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
    while (i < s.length) {
      const c = s[i];
      if (inQ) {
        if (c === '"') {
          if (s[i + 1] === '"') { cell += '"'; i += 2; continue; }
          inQ = false; i++; continue;
        }
        cell += c; i++; continue;
      }
      if (c === '"') { inQ = true; i++; continue; }
      if (c === ",") { row.push(cell); cell = ""; i++; continue; }
      if (c === "\n") { row.push(cell); rows.push(row); row = []; cell = ""; i++; continue; }
      cell += c; i++;
    }
    if (cell.length || row.length) { row.push(cell); rows.push(row); }
    return rows.filter((r) => r.some((x) => String(x).trim() !== ""));
  }
  function _hdrIndex(headers, test) {
    for (let i = 0; i < headers.length; i++) if (test(String(headers[i]).trim().toLowerCase())) return i;
    return -1;
  }
  function _parseUpliftMode(s) {
    const t = String(s || "").trim().toLowerCase();
    if (!t || t === "none" || t === "0") return null;
    if (t.includes("amount") || t.includes("abs") || t.includes("flat") || t === "$" || t.indexOf("amt") === 0) return "abs";
    return "pct";
  }
  function _num(v) {
    const n = parseFloat(String(v == null ? "" : v).replace(/[^0-9.\-]/g, ""));
    return Number.isNaN(n) ? null : n;
  }

  // Parse a CSV into normalized rows + detected columns + warnings.
  //   row = { job, basePay?, uplift? }
  function rcParseCsv(text) {
    const grid = _parseCsvText(text);
    if (!grid.length) return { rows: [], columns: {}, warnings: ["The file is empty."] };
    const headers = grid[0];
    const idxJob  = _hdrIndex(headers, (h) => /^(job|position|title|role)/.test(h));
    const idxBase = _hdrIndex(headers, (h) => (h.indexOf("base") >= 0 || h.indexOf("pre-parity") >= 0 || h.indexOf("pre parity") >= 0) && h.indexOf("peak") < 0);
    const idxPeak = _hdrIndex(headers, (h) => h.indexOf("peak") >= 0 || h.indexOf("post-parity") >= 0 || h.indexOf("post parity") >= 0);
    const idxUpT  = _hdrIndex(headers, (h) => h.indexOf("uplift") >= 0 && (h.indexOf("type") >= 0 || h.indexOf("mode") >= 0));
    const idxUpV  = _hdrIndex(headers, (h) => h.indexOf("uplift") >= 0 && (h.indexOf("value") >= 0 || h.indexOf("amount") >= 0 || h.indexOf("amt") >= 0));

    const warnings = [];
    if (idxJob < 0) warnings.push("No Job column found, so rows can't be matched to positions.");
    if (idxBase < 0 && idxPeak >= 0) warnings.push("This file carries peak (post-parity) rates only. Base pay can't be derived from a peak rate, so pay values won't import — re-export with pre-parity rates to update pay.");
    else if (idxBase < 0) warnings.push("No base pay column found, so only the season uplift (where present) will import.");

    const rows = [];
    for (let r = 1; r < grid.length; r++) {
      const cells = grid[r];
      const job = idxJob >= 0 ? String(cells[idxJob] || "").trim() : "";
      if (!job) continue;
      const out = { job };
      if (idxBase >= 0) { const n = _num(cells[idxBase]); if (n != null) out.basePay = n; }
      if (idxUpT >= 0) {
        const mode = _parseUpliftMode(cells[idxUpT]);
        const v = idxUpV >= 0 ? _num(cells[idxUpV]) : null;
        out.uplift = mode === null ? { mode: "pct", value: 0 } : { mode, value: v == null ? 0 : v };
      } else if (idxUpV >= 0) {
        const v = _num(cells[idxUpV]);
        if (v != null) out.uplift = { mode: "pct", value: v };
      }
      rows.push(out);
    }
    return {
      rows,
      columns: { job: idxJob >= 0, basePay: idxBase >= 0, peak: idxPeak >= 0, uplift: (idxUpT >= 0 || idxUpV >= 0) },
      warnings,
    };
  }

  function _upliftEq(a, b) {
    const av = a && a.value ? a.value : 0, bv = b && b.value ? b.value : 0;
    if (av === 0 && bv === 0) return true;
    return (a && a.mode ? a.mode : "pct") === (b && b.mode ? b.mode : "pct") && Number(av) === Number(bv);
  }

  // Compare parsed rows to a version. Returns { version, items, counts }.
  //   item = { job, status:"new"|"diff"|"same", current, incoming,
  //            writeBase, writeUplift }
  function rcDiffImport(orgId, versionId, parsedRows) {
    const id = orgId || _orgId();
    const version = (versionId && getVersionById(id, versionId)) || getActiveRateCardVersion(id);
    const cur = (version && version.rows) || {};
    const items = (parsedRows || []).map((p) => {
      const c = cur[p.job];
      let status;
      if (!c) status = "new";
      else {
        const baseDiff = p.basePay != null && Number(p.basePay) !== Number(c.basePay);
        const upDiff = p.uplift && !_upliftEq(p.uplift, c.uplift);
        status = (baseDiff || upDiff) ? "diff" : "same";
      }
      return {
        job: p.job,
        status,
        current: c ? { basePay: c.basePay, uplift: c.uplift } : null,
        incoming: { basePay: p.basePay != null ? p.basePay : null, uplift: p.uplift || null },
        writeBase: p.basePay != null ? p.basePay : null,
        writeUplift: p.uplift || null,
      };
    });
    // Uniform "will apply" flags so the UI doesn't branch on kind:
    //   update strategy applies new + diff; addnew applies new only.
    items.forEach((it) => {
      it.fromInherited = it.status === "new";
      it.willApplyUpdate = it.status !== "same";
      it.willApplyAddNew = it.status === "new";
    });
    const counts = {
      total: items.length,
      new: items.filter((x) => x.status === "new").length,
      diff: items.filter((x) => x.status === "diff").length,
      same: items.filter((x) => x.status === "same").length,
      update: items.filter((x) => x.willApplyUpdate).length,
      addnew: items.filter((x) => x.willApplyAddNew).length,
      unknown: 0,
    };
    return { version, items, counts, warnings: [] };
  }

  // Apply an import.
  //   strategy = "update" | "review" | "addnew"
  //   selectedJobs = (review only) array/Set of job names to apply.
  // Returns { added, updated, skipped }.
  function rcApplyImport(orgId, versionId, parsedRows, strategy, selectedJobs) {
    const id = orgId || _orgId();
    const diff = rcDiffImport(id, versionId, parsedRows);
    const sel = selectedJobs ? new Set(selectedJobs) : null;
    let added = 0, updated = 0, skipped = 0;
    const writeRow = (it) => {
      const patch = {};
      if (it.writeBase != null) patch.basePay = it.writeBase;
      if (it.writeUplift) patch.uplift = it.writeUplift;
      // A brand-new job needs a base pay to exist on the card.
      if (it.status === "new" && patch.basePay == null) { skipped++; return; }
      if (Object.keys(patch).length === 0) { skipped++; return; }
      setRateCardRow(id, versionId, it.job, patch);
      if (it.status === "new") added++; else updated++;
    };
    diff.items.forEach((it) => {
      if (strategy === "addnew") { it.status === "new" ? writeRow(it) : skipped++; }
      else if (strategy === "review") { (sel && sel.has(it.job)) ? writeRow(it) : skipped++; }
      else { it.status === "same" ? skipped++ : writeRow(it); } // update
    });
    _emit({ kind: "import", orgId: id, versionId, added, updated, skipped });
    return { added, updated, skipped };
  }

  // Trigger a client-side CSV download.
  function rcDownloadCsv(filename, text) {
    try {
      const blob = new Blob([text], { type: "text/csv;charset=utf-8" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = filename || "rate-card.csv";
      document.body.appendChild(a);
      a.click();
      setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    } catch (e) { /* no-op */ }
  }

  // ===================================================================
  // GENERIC CSV BUILD + NODE / AGENCY IMPORT (v1.44)
  // The same export/import flow runs at every tier: the global card,
  // any org node (overrides over the inherited card) and an agency
  // contract (per-position base-pay overrides). A generic row-CSV
  // builder + per-tier diff/apply keep the UI tier-agnostic.
  // ===================================================================

  // Build a CSV from a {job:{basePay,uplift}} map. extraCol is an
  // optional { header, value(job)->string } appended after the rates.
  function _rowsBuildCsv(orgId, rowMap, jobsOrder, opts, extraCol) {
    opts = opts || {};
    const rates = opts.rates || "both";
    const includeSeason = opts.includeSeason !== false;
    const jobs = (opts.jobs && opts.jobs.length) ? jobsOrder.filter((j) => opts.jobs.indexOf(j) >= 0) : jobsOrder;
    const cols = ["Job", "Category"];
    if (rates === "base" || rates === "both") cols.push("Base pay (pre-parity)");
    if (includeSeason) cols.push("Season uplift type", "Season uplift value");
    if (rates === "peak" || rates === "both") cols.push("Peak rate (post-parity)");
    if (extraCol) cols.push(extraCol.header);
    const lines = [cols.join(",")];
    jobs.forEach((job) => {
      const r = rowMap[job];
      if (!r) return;
      const cells = [job, _jobCategory(orgId, job)];
      if (rates === "base" || rates === "both") cells.push(r.basePay);
      if (includeSeason) {
        const has = r.uplift && r.uplift.value;
        cells.push(has ? (r.uplift.mode === "abs" ? "Amount" : "Percent") : "None");
        cells.push(has ? r.uplift.value : 0);
      }
      if (rates === "peak" || rates === "both") cells.push(applyUplift(r.basePay, r.uplift || null));
      if (extraCol) cells.push(extraCol.value(job));
      lines.push(cells.map(_csvEscape).join(","));
    });
    return lines.join("\r\n");
  }

  // ---- NODE (org level) ---------------------------------------------
  function rcBuildNodeCsv(orgId, nodeId, opts, versionId) {
    const resolved = resolveNodeRateCard(orgId, nodeId, versionId);
    const rows = resolved.rows || {};
    const map = {};
    Object.keys(rows).forEach((j) => { map[j] = { basePay: rows[j].basePay, uplift: rows[j].uplift }; });
    return _rowsBuildCsv(orgId, map, Object.keys(map), opts, {
      header: "Source",
      value: (j) => rows[j].ownOverride
        ? "Custom (this level)"
        : "Inherited from " + ((rows[j].baseSource && rows[j].baseSource.name) || "Global rate card"),
    });
  }

  // Compare a parsed file to a node's *effective* (resolved) rates.
  // Unknown jobs (not in the catalog) are dropped with a warning.
  function rcDiffNodeImport(orgId, nodeId, parsedRows, versionId) {
    const resolved = resolveNodeRateCard(orgId, nodeId, versionId);
    const rows = resolved.rows || {};
    const items = []; let unknown = 0;
    (parsedRows || []).forEach((p) => {
      const cur = rows[p.job];
      if (!cur) { unknown++; return; }
      const baseDiff = p.basePay != null && Number(p.basePay) !== Number(cur.basePay);
      const upDiff = p.uplift && !_upliftEq(p.uplift, cur.uplift);
      const status = (baseDiff || upDiff) ? "diff" : "same";
      const fromInherited = !cur.ownOverride;
      items.push({
        job: p.job, status,
        current: { basePay: cur.basePay, uplift: cur.uplift },
        incoming: { basePay: p.basePay != null ? p.basePay : null, uplift: p.uplift || null },
        currentSource: cur.ownOverride ? "Custom" : ((cur.baseSource && cur.baseSource.name) || "Global rate card"),
        fromInherited,
        writeBase: p.basePay != null ? p.basePay : null,
        writeUplift: p.uplift || null,
        willApplyUpdate: status === "diff",
        willApplyAddNew: status === "diff" && fromInherited,
      });
    });
    const counts = {
      total: items.length + unknown, unknown, new: 0,
      diff: items.filter((x) => x.status === "diff").length,
      same: items.filter((x) => x.status === "same").length,
      update: items.filter((x) => x.willApplyUpdate).length,
      addnew: items.filter((x) => x.willApplyAddNew).length,
    };
    const warnings = [];
    if (unknown > 0) warnings.push(`${unknown} row${unknown === 1 ? "" : "s"} skipped — the position isn't in this organization's job catalog.`);
    return { items, counts, warnings };
  }

  function rcApplyNodeImport(orgId, nodeId, parsedRows, strategy, selectedJobs, versionId) {
    const diff = rcDiffNodeImport(orgId, nodeId, parsedRows, versionId);
    const sel = selectedJobs ? new Set(selectedJobs) : null;
    let added = 0, updated = 0, skipped = 0;
    const write = (it) => {
      const patch = {};
      if (it.writeBase != null) patch.basePay = it.writeBase;
      if (it.writeUplift) patch.uplift = it.writeUplift;
      if (Object.keys(patch).length === 0) { skipped++; return; }
      setNodeOverride(orgId, nodeId, it.job, patch);
      if (it.fromInherited) added++; else updated++;
    };
    diff.items.forEach((it) => {
      if (strategy === "addnew") { it.willApplyAddNew ? write(it) : skipped++; }
      else if (strategy === "review") { (sel && sel.has(it.job)) ? write(it) : skipped++; }
      else { it.willApplyUpdate ? write(it) : skipped++; }
    });
    _emit({ kind: "node-import", orgId: orgId || _orgId(), nodeId, added, updated, skipped });
    return { added, updated, skipped };
  }

  // ---- AGENCY (supplier contract) -----------------------------------
  // Import sets the all-locations base-pay override per position; uplift
  // is inherited and read-only here. Per-site overrides stay manual.
  function rcBuildAgencyCsv(orgId, supplierId, opts, versionId) {
    const resolved = resolveAgencyRateCard(orgId, supplierId, versionId);
    const rows = resolved.rows || {};
    const map = {};
    Object.keys(rows).forEach((j) => { map[j] = { basePay: rows[j].effective, uplift: rows[j].uplift }; });
    const o = Object.assign({}, opts, { rates: "base", includeSeason: false });
    return _rowsBuildCsv(orgId, map, Object.keys(map), o, {
      header: "Site overrides",
      value: (j) => {
        const sc = (rows[j].scopes || []).filter((s) => s.scope !== "all");
        return sc.length ? sc.map((s) => siteName(s.scope) + ": " + s.basePay).join("; ") : "";
      },
    });
  }

  function rcDiffAgencyImport(orgId, supplierId, parsedRows, versionId) {
    const resolved = resolveAgencyRateCard(orgId, supplierId, versionId);
    const rows = resolved.rows || {};
    const items = []; let unknown = 0;
    (parsedRows || []).forEach((p) => {
      const cur = rows[p.job];
      if (!cur) { unknown++; return; }
      const baseDiff = p.basePay != null && Number(p.basePay) !== Number(cur.effective);
      const status = baseDiff ? "diff" : "same";
      const allOv = (cur.scopes || []).find((s) => s.scope === "all");
      const fromInherited = !allOv;
      items.push({
        job: p.job, status,
        current: { basePay: cur.effective, uplift: cur.uplift },
        incoming: { basePay: p.basePay != null ? p.basePay : null, uplift: null },
        currentSource: allOv ? "Agency override" : "Inherited from buyer",
        fromInherited,
        writeBase: p.basePay != null ? p.basePay : null,
        writeUplift: null,
        willApplyUpdate: status === "diff",
        willApplyAddNew: status === "diff" && fromInherited,
      });
    });
    const counts = {
      total: items.length + unknown, unknown, new: 0,
      diff: items.filter((x) => x.status === "diff").length,
      same: items.filter((x) => x.status === "same").length,
      update: items.filter((x) => x.willApplyUpdate).length,
      addnew: items.filter((x) => x.willApplyAddNew).length,
    };
    const warnings = [];
    if (unknown > 0) warnings.push(`${unknown} row${unknown === 1 ? "" : "s"} skipped — the position isn't on the buyer's rate card.`);
    return { items, counts, warnings };
  }

  function rcApplyAgencyImport(orgId, supplierId, parsedRows, strategy, selectedJobs, versionId) {
    const diff = rcDiffAgencyImport(orgId, supplierId, parsedRows, versionId);
    const sel = selectedJobs ? new Set(selectedJobs) : null;
    let added = 0, updated = 0, skipped = 0;
    const write = (it) => {
      if (it.writeBase == null) { skipped++; return; }
      setAgencyOverride(orgId, supplierId, it.job, "all", it.writeBase);
      if (it.fromInherited) added++; else updated++;
    };
    diff.items.forEach((it) => {
      if (strategy === "addnew") { it.willApplyAddNew ? write(it) : skipped++; }
      else if (strategy === "review") { (sel && sel.has(it.job)) ? write(it) : skipped++; }
      else { it.willApplyUpdate ? write(it) : skipped++; }
    });
    _emit({ kind: "agency-import", orgId: orgId || _orgId(), supplierId, added, updated, skipped });
    return { added, updated, skipped };
  }

  // ---- TARGET FACTORY -----------------------------------------------
  // One object the import/export panels consume so they never branch on
  // tier. Provides display labels, a job list, CSV build, diff + apply,
  // and per-strategy copy.
  function _segLabel(seg) {
    return (window.ORG_SEGMENT_SINGULAR && window.ORG_SEGMENT_SINGULAR[seg]) || "level";
  }
  function rcMakeTarget(spec) {
    spec = spec || {};
    const orgId = spec.orgId || _orgId();

    if (spec.kind === "node") {
      const node = spec.node;
      const level = _segLabel(node.segment);
      const resolved = () => resolveNodeRateCard(orgId, node.id, spec.versionId);
      return {
        kind: "node", orgId, node,
        title: node.name,
        contextLabel: `${level} · ${node.name}`,
        noun: `${node.name} (${level})`,
        allowRates: true, allowSeason: true,
        allJobs: () => Object.keys(resolved().rows || {}),
        rowFor: (job) => { const r = resolved().rows[job]; return r ? { basePay: r.basePay, uplift: r.uplift } : null; },
        buildCsv: (opts) => rcBuildNodeCsv(orgId, node.id, opts, spec.versionId),
        templateCsv: () => rcBuildNodeCsv(orgId, node.id, { rates: "base", includeSeason: true }, spec.versionId),
        parseCsv: (t) => rcParseCsv(t),
        diff: (rows) => rcDiffNodeImport(orgId, node.id, rows, spec.versionId),
        apply: (rows, strat, sel) => rcApplyNodeImport(orgId, node.id, rows, strat, sel, spec.versionId),
        strategyText: {
          update: { title: "Update from file", sub: `Apply every changed rate as a custom override on ${node.name}. Positions not in the file keep what they inherit.` },
          review: { title: "Review differences", sub: "See each position whose rate differs and choose, row by row, the inherited value or the file's." },
          addnew: { title: "Only positions without an override", sub: `Override only positions that ${node.name} still inherits. Existing custom overrides are untouched.` },
        },
        applyVerb: "override",
      };
    }

    if (spec.kind === "agency") {
      const supplierId = spec.supplierId;
      const name = spec.supplierName || "this agency";
      const resolved = () => resolveAgencyRateCard(orgId, supplierId, spec.versionId);
      return {
        kind: "agency", orgId, supplierId,
        title: name,
        contextLabel: name,
        noun: name,
        allowRates: false, allowSeason: false,
        allJobs: () => Object.keys(resolved().rows || {}),
        rowFor: (job) => { const r = resolved().rows[job]; return r ? { basePay: r.effective, uplift: r.uplift } : null; },
        buildCsv: (opts) => rcBuildAgencyCsv(orgId, supplierId, opts, spec.versionId),
        templateCsv: () => rcBuildAgencyCsv(orgId, supplierId, { rates: "base" }, spec.versionId),
        parseCsv: (t) => rcParseCsv(t),
        diff: (rows) => rcDiffAgencyImport(orgId, supplierId, rows, spec.versionId),
        apply: (rows, strat, sel) => rcApplyAgencyImport(orgId, supplierId, rows, strat, sel, spec.versionId),
        strategyText: {
          update: { title: "Update from file", sub: "Set the all-locations base pay for every changed position. Positions not in the file are left as inherited." },
          review: { title: "Review differences", sub: "See each position whose base pay differs and choose, row by row, the inherited value or the file's." },
          addnew: { title: "Only positions without an override", sub: "Override only positions that still inherit the buyer's base pay. Existing overrides are untouched." },
        },
        applyVerb: "override",
        importNote: "Importing sets the all-locations base pay. Per-site overrides stay in the table above.",
      };
    }

    // global (default)
    const version = spec.version || getActiveRateCardVersion(orgId);
    return {
      kind: "global", orgId, version,
      title: version ? version.label : "Rate card",
      contextLabel: version ? version.label : "Rate card",
      noun: "the global rate card",
      effectiveFrom: version ? version.effectiveFrom : "",
      allowRates: true, allowSeason: true,
      allJobs: () => Object.keys((version && version.rows) || {}),
      rowFor: (job) => { const r = version && version.rows[job]; return r ? { basePay: r.basePay, uplift: r.uplift } : null; },
      buildCsv: (opts) => rcBuildCsv(orgId, version.id, opts),
      templateCsv: () => rcBuildCsv(orgId, version.id, { rates: "base", includeSeason: true }),
      parseCsv: (t) => rcParseCsv(t),
      diff: (rows) => rcDiffImport(orgId, version.id, rows),
      apply: (rows, strat, sel) => rcApplyImport(orgId, version.id, rows, strat, sel),
      strategyText: {
        update: { title: "Update from file", sub: "Overwrite matching positions with the file's rates. New positions are added; positions not in the file are left untouched." },
        review: { title: "Review differences", sub: "See every position whose rate differs and choose, row by row, whether to keep the current value or take the file's." },
        addnew: { title: "Add new positions only", sub: "Only add positions that aren't on this card yet. Existing rates are never changed." },
      },
      applyVerb: "change",
    };
  }

  Object.assign(window, {
    getRateCardVersions,
    getActiveRateCardVersion,
    getVersionById,
    rcVersionStatus,
    createRateCardVersion,
    updateVersionMeta,
    setPeakSeason,
    setRateCardRow,
    deleteRateCardVersion,
    applyUplift,
    upliftLabel,
    // org-node overrides
    getNodeOverrides,
    setNodeOverride,
    clearNodeOverrides,
    resolveNodeRateCard,
    // agency overrides
    getAgencyOverrides,
    setAgencyOverride,
    resolveAgencyRateCard,
    getRateCardSites,
    rcSiteName: siteName,
    // import / export (v1.43)
    rcBuildCsv,
    rcParseCsv,
    rcDiffImport,
    rcApplyImport,
    rcDownloadCsv,
    // tiered import / export (v1.44)
    rcBuildNodeCsv,
    rcDiffNodeImport,
    rcApplyNodeImport,
    rcBuildAgencyCsv,
    rcDiffAgencyImport,
    rcApplyAgencyImport,
    rcMakeTarget,
    RATECARDS_EVENT: RC_EVENT,
  });
})();
