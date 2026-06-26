// =====================================================================
// Flex Work — Rate Grid   (Settings → Pricing → Rate Cards)   v1.48
//
// A flat, condition-resolved rate table. Replaces nested rate-card
// levels (Position → Location → Contract) with ONE table grouped by
// position, where every row is a finished rate line.
//
//   · Positions come from the Locations & Positions catalog (read-only
//     origin; never invented here).
//   · Each position has a BASE rate (the rate when no condition is set)
//     edited in its group header. Missing base = error.
//   · Override lines carry only the conditions that differ; everything
//     else falls back to base. Conditions are COLUMNS; each cell is a
//     fixed value or the wildcard [ALL].
//   · A booking resolves by a CUSTOM LOOKUP ORDER (the field order the
//     user sets); the all-[ALL] base is the guaranteed fallback.
//
// Self-contained: data + resolution + conflict logic + the page UI.
// The modals (Add condition / Bulk add / Coverage check / CSV) live in
// pages/rate-grid-modals.jsx and read this module's window.RG namespace.
//
// Loads AFTER req-shared.jsx (Field / Dropdown), req-side-panels.jsx
// (SidePanel), BEFORE rate-grid-modals.jsx + app.jsx.
// =====================================================================

const { useState: useRg, useEffect: useRgEffect, useMemo: useRgMemo, useRef: useRgRef } = React;

// ---------- Constants -------------------------------------------------
const RG_ALL = "[ALL]";
const RG_CUR = "£";
const RG_MAX_COMBOS = 96;

// Position catalog — read-only origin (Locations & Positions). job_code
// is the stable key used throughout the store.
const RG_POSITIONS = [
  { code: "DIS217", name: "Operative Days" },
  { code: "DIS218", name: "Operative Nights" },
  { code: "DIS219", name: "PRO" },
  { code: "DIS211", name: "Cat C Day Driver" },
  { code: "DIS648", name: "Van Network Driver" },
];

// Condition (dimension) catalog. `active` here is just the default; the
// live active set is stored per-org. Order of the active list is the
// column order and is user-reorderable.
//
// v1.49 — dropped Worker band (age) and Skill / cert; added Legal entity
// (corporate-tier org nodes, from the org hierarchy in pages/org-tree.jsx).
const RG_CONDITIONS = {
  parity:   { key: "parity",   label: "Parity",        values: ["Pre-Parity", "Post-Parity"] },
  location: { key: "location", label: "Location",      values: ["Birmingham", "Eurocentral"] },
  agency:   { key: "agency",   label: "Agency",        values: ["DCS Recruitment", "Staffline Group", "The Recruitment Crowd"] },
  entity:   { key: "entity",   label: "Legal entity",  values: ["Dayforce Holdings, Inc.", "Dayforce Canada Ltd."] },
};
const RG_DEFAULT_ACTIVE = ["parity", "location", "agency"];

// Lookup — how a booking finds its rate among the lines that match it.
// A single strategy: the custom lookup order. The field highest in the
// `lookup` order wins; a line that sets a higher-order field beats any
// combination of lower-order ones. The order is user-editable and is
// kept in lockstep with the table column order.

let __rgUid = 1;
function rgUid() { return "rl" + (__rgUid++) + "_" + Math.random().toString(36).slice(2, 6); }

// ---------- Seed ------------------------------------------------------
// uplift shape: { type: "pct" | "abs", val: number | null }. null val =
// no season uplift on that line.
function rgUplift(type, val) { return { type: type || "pct", val: val == null ? null : Number(val) }; }

function rgSeed() {
  return {
    active: RG_DEFAULT_ACTIVE.slice(),
    // custom lookup order — the field order that resolves a booking's rate
    lookup: RG_DEFAULT_ACTIVE.slice(),
    // base rate per position (null = missing → error state)
    bases: {
      DIS217: 14.31,
      DIS218: 14.65,
      DIS219: 14.44,
      DIS211: null,
      DIS648: null,
    },
    // per-position season uplift applied on top of the base rate
    baseUp: {
      DIS217: rgUplift("pct", 5),
      DIS218: rgUplift("abs", 1.25),
      DIS219: rgUplift("pct", null),
      DIS211: rgUplift("pct", null),
      DIS648: rgUplift("pct", null),
    },
    // override lines: cond carries ONLY the conditions that differ. `up`
    // is the per-line season uplift (defaults to no uplift).
    overrides: [
      // Operative Days — Post-Parity & Birmingham can tie in rank when
      // they sit at the same lookup order; reordering the custom lookup
      // resolves which one wins.
      { id: rgUid(), pos: "DIS217", cond: { parity: "Post-Parity" }, rate: 14.33, up: rgUplift("pct", 6) },
      { id: rgUid(), pos: "DIS217", cond: { location: "Birmingham" }, rate: 14.31, up: rgUplift("pct", null) },
      { id: rgUid(), pos: "DIS217", cond: { location: "Birmingham", agency: "Staffline Group" }, rate: 15.10, up: rgUplift("abs", 2.00) },
      // Operative Nights
      { id: rgUid(), pos: "DIS218", cond: { parity: "Post-Parity" }, rate: 15.45, up: rgUplift("pct", null) },
    ],
  };
}

// ---------- Persistence ----------------------------------------------
function rgOrgId() { return (window.getCurrentIndustryId && window.getCurrentIndustryId()) || "manufacturing"; }
function rgStoreKey() { return "flexwork.rateGrid." + rgOrgId(); }

function rgLoad() {
  try {
    const raw = localStorage.getItem(rgStoreKey());
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.active) && parsed.bases && Array.isArray(parsed.overrides)) {
        // Drop any retired conditions (band / skill) the column may still
        // carry from an older session.
        parsed.active = parsed.active.filter((k) => RG_CONDITIONS[k]);
        // re-id any override missing an id (defensive) + backfill uplift,
        // and strip retired conditions off each line.
        parsed.overrides.forEach((o) => {
          if (!o.id) o.id = rgUid();
          if (o.cond) Object.keys(o.cond).forEach((k) => { if (!RG_CONDITIONS[k]) delete o.cond[k]; });
          if (!o.up) o.up = rgUplift("pct", null);
        });
        // Backfill lookup config.
        if (!Array.isArray(parsed.lookup)) parsed.lookup = parsed.active.slice();
        // Drop a retired lookupMode flag from older sessions.
        delete parsed.lookupMode;
        parsed.lookup = parsed.lookup.filter((k) => parsed.active.includes(k));
        parsed.active.forEach((k) => { if (!parsed.lookup.includes(k)) parsed.lookup.push(k); });
        // Backfill base uplifts (added v1.49).
        parsed.baseUp = parsed.baseUp || {};
        RG_POSITIONS.forEach((p) => { if (!parsed.baseUp[p.code]) parsed.baseUp[p.code] = rgUplift("pct", null); });
        return parsed;
      }
    }
  } catch (e) { /* fall through to seed */ }
  return rgSeed();
}
function rgSave(state) {
  try { localStorage.setItem(rgStoreKey(), JSON.stringify(state)); } catch (e) {}
}

// ---------- Resolution logic -----------------------------------------
// Build the full line list for a position: synthesized base (all [ALL],
// specificity 0) + overrides. Base only exists if a base rate is set.
function rgLinesForPos(state, code) {
  const lines = state.overrides
    .filter((o) => o.pos === code)
    .map((o) => ({ id: o.id, kind: "override", cond: o.cond || {}, rate: o.rate, up: o.up || null }));
  const base = state.bases[code];
  if (base != null && base !== "") {
    const bu = (state.baseUp && state.baseUp[code]) || null;
    lines.push({ id: "base_" + code, kind: "base", cond: {}, rate: Number(base), up: bu });
  }
  return lines;
}

// specificity = number of ACTIVE conditions set to a specific value.
function rgSpecificity(active, cond) {
  return active.reduce((n, k) => n + (cond[k] != null && cond[k] !== RG_ALL ? 1 : 0), 0);
}

// The effective priority order: the stored lookup order, filtered to the
// active set, with any active field not yet ranked appended at the end.
function rgLookupOrder(state) {
  const active = state.active;
  const order = (state.lookup || []).filter((k) => active.includes(k));
  active.forEach((k) => { if (!order.includes(k)) order.push(k); });
  return order;
}

// Ranking score for a line per the custom lookup order. Higher wins.
// Sum of 2^(N-1-i) for each specified field at lookup index i, so a
// higher-order specified field always outranks any set of lower-order
// ones.
function rgRankScore(state, cond) {
  const order = rgLookupOrder(state);
  const N = order.length;
  let score = 0;
  order.forEach((k, i) => {
    if (cond[k] != null && cond[k] !== RG_ALL) score += Math.pow(2, N - 1 - i);
  });
  return score;
}

// Does a line match a booking (one value per active condition)?
function rgLineMatches(active, lineCond, booking) {
  for (const k of active) {
    const lv = lineCond[k];
    if (lv == null || lv === RG_ALL) continue;     // wildcard matches anything
    if (lv !== booking[k]) return false;
  }
  return true;
}

// Apply a season uplift to a rate → effective (peak) rate.
function rgApplyUplift(rate, up) {
  if (rate == null || rate === "") return null;
  if (!up || up.val == null || up.val === "") return Number(rate);
  return up.type === "abs" ? Number(rate) + Number(up.val) : Number(rate) * (1 + Number(up.val) / 100);
}

// Resolve a booking → { rate, up, eff, source, lineId }.
function rgResolve(state, code, booking) {
  const lines = rgLinesForPos(state, code);
  const sorted = lines
    .map((l, i) => ({ l, i, score: rgRankScore(state, l.cond) }))
    .sort((a, b) => (b.score - a.score) || (a.i - b.i)); // ties keep order
  for (const { l } of sorted) {
    if (rgLineMatches(state.active, l.cond, booking)) {
      return { rate: l.rate, up: l.up || null, eff: rgApplyUplift(l.rate, l.up), source: l.kind, lineId: l.id };
    }
  }
  return { rate: null, up: null, eff: null, source: "none", lineId: null };
}

// ---------- Conflict detection ---------------------------------------
// Returns a map lineId -> Set("duplicate"|"ambiguous") and counts.
function rgConflicts(state) {
  const flags = {};      // lineId -> { duplicate, ambiguous }
  const active = state.active;
  const mark = (id, type) => {
    if (!id) return;
    (flags[id] = flags[id] || {})[type] = true;
  };
  // signature over active keys (value or ALL)
  const sig = (cond) => active.map((k) => (cond[k] != null && cond[k] !== RG_ALL ? cond[k] : RG_ALL)).join("¦");

  let dupPairs = 0, ambPairs = 0;
  RG_POSITIONS.forEach((p) => {
    const lines = rgLinesForPos(state, p.code).filter((l) => l.kind === "override");
    for (let a = 0; a < lines.length; a++) {
      for (let b = a + 1; b < lines.length; b++) {
        const la = lines[a], lb = lines[b];
        // Duplicate: identical signatures
        if (sig(la.cond) === sig(lb.cond)) {
          mark(la.id, "duplicate"); mark(lb.id, "duplicate");
          dupPairs++;
          continue; // a duplicate is not separately counted as ambiguous
        }
        // Ambiguous: same rank score under the custom lookup order, and no
        // active condition where both are set to DIFFERENT specific values
        // (so both could match some booking and only row order decides the
        // winner). Reordering the custom lookup gives the fields distinct
        // weights, so it resolves most ambiguities.
        const sa = rgRankScore(state, la.cond), sb = rgRankScore(state, lb.cond);
        if (sa === sb) {
          let contradict = false;
          for (const k of active) {
            const va = la.cond[k], vb = lb.cond[k];
            if (va != null && va !== RG_ALL && vb != null && vb !== RG_ALL && va !== vb) {
              contradict = true; break;
            }
          }
          if (!contradict) {
            mark(la.id, "ambiguous"); mark(lb.id, "ambiguous");
            ambPairs++;
          }
        }
      }
    }
  });
  return { flags, dupPairs, ambPairs };
}

// Positions missing a base rate (error).
function rgMissingBase(state) {
  return RG_POSITIONS.filter((p) => state.bases[p.code] == null || state.bases[p.code] === "");
}

function rgFmtRate(v) {
  if (v == null || v === "") return "—";
  return RG_CUR + Number(v).toFixed(2);
}

// Format a season uplift for compact display: "+5%", "+£1.25", or "—".
function rgFmtUplift(up) {
  if (!up || up.val == null || up.val === "") return "—";
  return up.type === "abs" ? "+" + RG_CUR + Number(up.val).toFixed(2) : "+" + Number(up.val) + "%";
}

// Expose the data layer for the modals file.
window.RG = {
  ALL: RG_ALL, CUR: RG_CUR, MAX_COMBOS: RG_MAX_COMBOS,
  POSITIONS: RG_POSITIONS, CONDITIONS: RG_CONDITIONS,
  uid: rgUid, seed: rgSeed, uplift: rgUplift,
  linesForPos: rgLinesForPos, specificity: rgSpecificity,
  lookupOrder: rgLookupOrder, rankScore: rgRankScore,
  resolve: rgResolve, conflicts: rgConflicts, missingBase: rgMissingBase,
  fmtRate: rgFmtRate, fmtUplift: rgFmtUplift, applyUplift: rgApplyUplift,
};

// =====================================================================
//  Small UI atoms
// =====================================================================

// Inline rate input with a currency prefix.
function RgRateInput({ value, onChange, error, ariaLabel }) {
  return (
    <span className={"rg-rate-input" + (error ? " rg-rate-input--error" : "")}>
      <span className="rg-cur" aria-hidden="true">{RG_CUR}</span>
      <input
        type="number" min="0" step="0.01" inputMode="decimal"
        value={value == null ? "" : value}
        placeholder="0.00"
        onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
        aria-label={ariaLabel || "Rate"}
      />
    </span>
  );
}

// Season-uplift input: a %/amount segmented toggle + a number field.
// up shape: { type: "pct"|"abs", val: number|null }.
function RgUplift({ up, onChange, ariaLabel }) {
  const type = (up && up.type) || "pct";
  const val = up && up.val != null ? up.val : "";
  const setType = (t) => onChange({ type: t, val: up ? up.val : null });
  const setVal = (v) => onChange({ type, val: v });
  return (
    <span className={"rg-uplift" + (val === "" ? " rg-uplift--empty" : "")}>
      <span className="rg-uplift-toggle" role="group" aria-label="Uplift type">
        <button
          type="button"
          className={"rg-uplift-seg" + (type === "pct" ? " is-on" : "")}
          aria-pressed={type === "pct"}
          title="Percentage uplift"
          onClick={() => setType("pct")}
        >%</button>
        <button
          type="button"
          className={"rg-uplift-seg" + (type === "abs" ? " is-on" : "")}
          aria-pressed={type === "abs"}
          title="Fixed-amount uplift"
          onClick={() => setType("abs")}
        >{RG_CUR}</button>
      </span>
      <input
        type="number" min="0" step={type === "pct" ? "0.5" : "0.01"} inputMode="decimal"
        value={val}
        placeholder={type === "pct" ? "0" : "0.00"}
        onChange={(e) => setVal(e.target.value === "" ? null : Number(e.target.value))}
        aria-label={ariaLabel || "Season uplift"}
      />
    </span>
  );
}

// A condition cell dropdown: fixed values + [ALL].
function RgCondCell({ condKey, value, onChange }) {
  const def = RG_CONDITIONS[condKey];
  const opts = [{ value: RG_ALL, label: RG_ALL }].concat(
    def.values.map((v) => ({ value: v, label: v }))
  );
  const isAll = value == null || value === RG_ALL;
  return (
    <div className={"rg-cell" + (isAll ? " rg-cell--all" : "")}>
      <Dropdown
        options={opts}
        value={isAll ? RG_ALL : value}
        small
        onChange={(v) => onChange(v === RG_ALL ? null : v)}
      />
    </div>
  );
}

// Conflict marker chip.
function RgConflictMark({ flag }) {
  if (!flag) return null;
  const dup = flag.duplicate, amb = flag.ambiguous;
  const label = dup ? "Duplicate" : "Ambiguous";
  const title = dup
    ? "Duplicate line — another line has identical conditions."
    : "Ambiguous — another line of equal specificity could also match. Add a more specific line to resolve.";
  return (
    <span className={"rg-mark rg-mark--" + (dup ? "dup" : "amb")} title={title}>
      <Icon name="Alert" size={13} />{label}
    </span>
  );
}

// Inline custom-lookup panel — the lookup-order editor, shown directly
// under the toolbar and toggled by the Custom lookup button. Chips are
// the active condition fields; dragging them reorders both the lookup
// order AND the table columns (the two are kept in sync).
function RgLookupPanel({ order, conditions, onReorder, onClose }) {
  const [dragIdx, setDragIdx] = useRg(null);
  const [overIdx, setOverIdx] = useRg(null);
  return (
    <section className="rg-lkp" aria-label="Rate custom lookup">
      <div className="rg-lkp-head">
        <span className="rg-lkp-bolt" aria-hidden="true"><Icon name="Bolt" size={15} /></span>
        <h3 className="rg-lkp-title">Rate custom lookup</h3>
        <span className="rg-lkp-sub">
          lookup order for rate resolution
        </span>
        <div className="rg-lkp-head-right">
          <button type="button" className="rg-lkp-close" aria-label="Hide custom lookup" title="Hide" onClick={onClose}>
            <Icon name="ChevronUp" size={18} />
          </button>
        </div>
      </div>

      {order.length === 0 ? (
        <p className="rg-lkp-empty">No condition columns yet. Add a condition to set a lookup order.</p>
      ) : (
        <ol className="rg-lkp-chips">
          {order.map((k, i) => (
            <li key={k} className="rg-lkp-chipwrap">
              <button
                type="button"
                className={"rg-lkp-chip" + (dragIdx === i ? " is-dragging" : "") + (overIdx === i ? " is-over" : "")}
                draggable
                onDragStart={(e) => { setDragIdx(i); e.dataTransfer.effectAllowed = "move"; }}
                onDragOver={(e) => { e.preventDefault(); if (overIdx !== i) setOverIdx(i); }}
                onDragEnd={() => { setDragIdx(null); setOverIdx(null); }}
                onDrop={(e) => { e.preventDefault(); onReorder(dragIdx, i); setDragIdx(null); setOverIdx(null); }}
                title="Drag to reorder"
              >
                <span className="rg-lkp-num is-priority">{i + 1}</span>
                <span className="rg-lkp-label">{conditions[k].label}</span>
              </button>
              {i < order.length - 1 && (
                <span className="rg-lkp-arrow" aria-hidden="true"><Icon name="ArrowRight" size={15} /></span>
              )}
            </li>
          ))}
        </ol>
      )}

      <p className="rg-lkp-hint">
        Drag chips to reorder · the leftmost field has the highest lookup weight · reordering here also reorders the table columns
      </p>
    </section>
  );
}

// =====================================================================
//  Main page
// =====================================================================
function RateGridPage() {
  const [state, setState] = useRg(rgLoad);
  const [collapsed, setCollapsed] = useRg({});            // code -> bool
  const [filters, setFilters] = useRg({});                // condKey -> value | ALL
  const [savedAt, setSavedAt] = useRg(null);
  const [dirty, setDirty] = useRg(false);
  // modal switches
  const [showAddCond, setShowAddCond] = useRg(false);
  const [showBulk, setShowBulk] = useRg(false);
  const [showCoverage, setShowCoverage] = useRg(false);
  const [showLookup, setShowLookup] = useRg(false);
  const [showExport, setShowExport] = useRg(false);
  const [showImport, setShowImport] = useRg(false);
  // drag-reorder of condition columns
  const [dragKey, setDragKey] = useRg(null);
  const [dragOver, setDragOver] = useRg(null);

  // Re-seed when the org changes.
  useRgEffect(() => {
    const on = () => { setState(rgLoad()); setDirty(false); setSavedAt(null); };
    window.addEventListener("industry:change", on);
    return () => window.removeEventListener("industry:change", on);
  }, []);

  const mutate = (fn) => {
    setState((prev) => {
      const next = fn(JSON.parse(JSON.stringify(prev)));
      return next;
    });
    setDirty(true);
    setSavedAt(null);
  };

  const conflicts = useRgMemo(() => rgConflicts(state), [state]);
  const missing = useRgMemo(() => rgMissingBase(state), [state]);
  const active = state.active;

  const totalLines = state.overrides.length + RG_POSITIONS.filter((p) => state.bases[p.code] != null && state.bases[p.code] !== "").length;

  // ---- mutations ----
  const setBase = (code, v) => mutate((s) => { s.bases[code] = v; return s; });
  const setBaseUplift = (code, up) => mutate((s) => { s.baseUp = s.baseUp || {}; s.baseUp[code] = up; return s; });
  const setRate = (id, v) => mutate((s) => { const o = s.overrides.find((x) => x.id === id); if (o) o.rate = v; return s; });
  const setUplift = (id, up) => mutate((s) => { const o = s.overrides.find((x) => x.id === id); if (o) o.up = up; return s; });
  const setCell = (id, key, v) => mutate((s) => {
    const o = s.overrides.find((x) => x.id === id);
    if (o) { if (v == null) delete o.cond[key]; else o.cond[key] = v; }
    return s;
  });
  const addOverride = (code) => mutate((s) => {
    s.overrides.push({ id: rgUid(), pos: code, cond: {}, rate: null, up: rgUplift("pct", null) });
    return s;
  });
  const dupOverride = (id) => mutate((s) => {
    const idx = s.overrides.findIndex((x) => x.id === id);
    if (idx >= 0) {
      const src = s.overrides[idx];
      s.overrides.splice(idx + 1, 0, { id: rgUid(), pos: src.pos, cond: { ...src.cond }, rate: src.rate });
    }
    return s;
  });
  const delOverride = (id) => mutate((s) => { s.overrides = s.overrides.filter((x) => x.id !== id); return s; });

  const addCondition = (key) => mutate((s) => {
    if (!s.active.includes(key)) s.active.push(key);
    if (!s.lookup) s.lookup = [];
    if (!s.lookup.includes(key)) s.lookup.push(key);   // new field = lowest priority
    return s;
  });
  const removeCondition = (key) => mutate((s) => {
    s.active = s.active.filter((k) => k !== key);
    s.lookup = (s.lookup || []).filter((k) => k !== key);
    s.overrides.forEach((o) => { delete o.cond[key]; });
    return s;
  });
  const reorderCondition = (fromKey, toKey) => mutate((s) => {
    const arr = s.active.slice();
    const fi = arr.indexOf(fromKey), ti = arr.indexOf(toKey);
    if (fi < 0 || ti < 0 || fi === ti) return s;
    arr.splice(fi, 1);
    arr.splice(ti, 0, fromKey);
    s.active = arr;
    return s;
  });

  // Custom lookup — set the field order. Called from RgLookupModal.
  const applyLookup = ({ lookup }) => mutate((s) => {
    if (Array.isArray(lookup)) {
      const order = lookup.filter((k) => s.active.includes(k));
      s.active.forEach((k) => { if (!order.includes(k)) order.push(k); });
      s.lookup = order;
    }
    return s;
  });

  // Inline lookup panel — reorder a field. Keeps the priority order and the
  // active column order in lockstep (the panel chips ARE the columns).
  const reorderLookupField = (from, to) => mutate((s) => {
    const arr = s.active.slice();
    if (from == null || to == null || from === to || from < 0 || to < 0 || from >= arr.length || to >= arr.length) return s;
    const [x] = arr.splice(from, 1);
    arr.splice(to, 0, x);
    s.active = arr;
    s.lookup = arr.slice();
    return s;
  });

  const resetAll = () => {
    if (!window.confirm("Reset the rate grid to seed data? This discards all unsaved and saved changes for this org.")) return;
    const seeded = rgSeed();
    setState(seeded);
    rgSave(seeded);
    setDirty(false);
    setSavedAt(null);
  };

  const save = () => { rgSave(state); setDirty(false); setSavedAt(new Date()); };

  // ---- filtering ----
  const passesFilter = (cond) => {
    return active.every((k) => {
      const f = filters[k];
      if (!f || f === "__any") return true;
      const cv = cond[k] != null && cond[k] !== RG_ALL ? cond[k] : RG_ALL;
      return cv === f;
    });
  };
  const anyFilter = active.some((k) => filters[k] && filters[k] !== "__any");

  // sort overrides for a position: highest rank first, ties keep insertion order
  const sortedOverrides = (code) => {
    return state.overrides
      .map((o, i) => ({ o, i }))
      .filter((x) => x.o.pos === code)
      .sort((a, b) => (rgRankScore(state, b.o.cond) - rgRankScore(state, a.o.cond)) || (a.i - b.i))
      .map((x) => x.o);
  };

  const colCount = active.length + 3; // conditions + rate + uplift + actions

  // Pin the position group headers to the visible width of the scroll area
  // so their controls stay reachable while the grid columns scroll. We track
  // the wrap's client width in a CSS var the sticky group header reads.
  // (ResizeObserver is unavailable in this runtime, so we sync on mount +
  // window resize, which covers viewport/device responsiveness.)
  const tableWrapRef = useRgRef(null);
  useRgEffect(() => {
    const sync = () => {
      const el = tableWrapRef.current;
      if (el) el.style.setProperty("--rg-vw", el.clientWidth + "px");
    };
    sync();
    const raf = requestAnimationFrame(sync);
    const t = setTimeout(sync, 300);
    window.addEventListener("resize", sync);
    return () => {
      window.removeEventListener("resize", sync);
      cancelAnimationFrame(raf);
      clearTimeout(t);
    };
  }, []);

  return (
    <div className="set-content rg-root">
      <header className="set-content-header">
        <h2 className="set-content-title">Rate Cards</h2>
        <p className="set-content-sub">
          One flat table per position. Set a base rate for each position, then add override lines for the
          condition combinations that pay differently. Each line can carry a season uplift. Bookings resolve
          by the custom lookup order you set.
        </p>
      </header>

      {/* ---- Toolbar ---- */}
      <div className="rg-toolbar">
        <div className="rg-toolbar-count">
          <strong>{totalLines}</strong> rate {totalLines === 1 ? "line" : "lines"}
          <span className="rg-toolbar-dot" aria-hidden="true">·</span>
          <strong>{RG_POSITIONS.length}</strong> positions
          <span className="rg-toolbar-dot" aria-hidden="true">·</span>
          <button type="button" className={"rg-lookup-chip" + (showLookup ? " is-open" : "")} onClick={() => setShowLookup((v) => !v)} title="Change how bookings find their rate">
            <Icon name="Bolt" size={13} />
            Rate custom lookup
          </button>
        </div>
        <div className="rg-toolbar-actions">
          <button type="button" className="vms-btn vms-btn--sm vms-btn--secondary" onClick={() => setShowAddCond(true)}>
            <Icon name="AddCircle" size={14} />Add condition
          </button>
          <button type="button" className="vms-btn vms-btn--sm vms-btn--secondary" onClick={() => setShowBulk(true)}>
            <Icon name="Grid" size={14} />Bulk add
          </button>
          <button type="button" className="vms-btn vms-btn--sm vms-btn--secondary" onClick={() => setShowCoverage(true)}>
            <Icon name="ClipboardCircleCheck" size={14} />Coverage check
          </button>
          <button type="button" className={"vms-btn vms-btn--sm vms-btn--secondary" + (showLookup ? " is-active" : "")} aria-pressed={showLookup} onClick={() => setShowLookup((v) => !v)}>
            <Icon name="Bolt" size={14} />Custom lookup
          </button>
          <span className="rg-toolbar-sep" aria-hidden="true" />
          <button type="button" className="vms-btn vms-btn--sm vms-btn--secondary" onClick={() => setShowExport(true)}>
            <Icon name="Export" size={14} />Export CSV
          </button>
          <button type="button" className="vms-btn vms-btn--sm vms-btn--secondary" onClick={() => setShowImport(true)}>
            <Icon name="Import" size={14} />Import CSV
          </button>
          <button type="button" className="vms-btn vms-btn--sm vms-btn--secondary" onClick={resetAll}>
            <Icon name="Refresh" size={14} />Reset
          </button>
        </div>
      </div>

      {/* ---- Custom lookup panel (toggled by the Custom lookup button) ---- */}
      {showLookup && (
        <RgLookupPanel
          order={rgLookupOrder(state)}
          conditions={RG_CONDITIONS}
          onReorder={reorderLookupField}
          onClose={() => setShowLookup(false)}
        />
      )}

      {/* ---- Base-rate status banner ---- */}
      {missing.length > 0 ? (
        <div className="rg-banner rg-banner--error" role="alert">
          <Icon name="Alert" size={18} />
          <div className="rg-banner-body">
            <strong>{missing.length} {missing.length === 1 ? "position is" : "positions are"} missing a base rate.</strong>
            <span> Every position needs a base rate (the rate when no condition is set). Add one in the position header: {missing.map((p) => p.name).join(", ")}.</span>
          </div>
        </div>
      ) : (
        <div className="rg-banner rg-banner--success" role="status">
          <Icon name="Check" size={18} />
          <div className="rg-banner-body">
            <strong>Every position has a base rate.</strong>
            <span> Bookings always resolve to at least the base.</span>
          </div>
        </div>
      )}

      {/* ---- Conflict banner ---- */}
      {(conflicts.dupPairs > 0 || conflicts.ambPairs > 0) && (
        <div className="rg-banner rg-banner--warning" role="status">
          <Icon name="Alert" size={18} />
          <div className="rg-banner-body">
            <strong>
              {conflicts.dupPairs > 0 && `${conflicts.dupPairs} duplicate ${conflicts.dupPairs === 1 ? "pair" : "pairs"}`}
              {conflicts.dupPairs > 0 && conflicts.ambPairs > 0 && " · "}
              {conflicts.ambPairs > 0 && `${conflicts.ambPairs} ambiguous ${conflicts.ambPairs === 1 ? "pair" : "pairs"}`}
            </strong>
            <span> These don't block saving, but order alone decides the winner. Make one line more specific to resolve an ambiguity, or delete a duplicate.</span>
          </div>
        </div>
      )}

      {/* ---- Table ---- */}
      <div className="rg-tablewrap" ref={tableWrapRef}>
        <table className="rg-table" style={{ "--rg-cols": active.length }}>
          <thead>
            <tr className="rg-head-row">
              {active.map((k) => (
                <th
                  key={k}
                  className={"rg-th rg-th--cond" + (dragKey === k ? " rg-th--dragging" : "") + (dragOver === k ? " rg-th--dragover" : "")}
                  draggable
                  onDragStart={(e) => { setDragKey(k); e.dataTransfer.effectAllowed = "move"; }}
                  onDragOver={(e) => { e.preventDefault(); if (dragOver !== k) setDragOver(k); }}
                  onDragEnd={() => { setDragKey(null); setDragOver(null); }}
                  onDrop={(e) => { e.preventDefault(); if (dragKey && dragKey !== k) reorderCondition(dragKey, k); setDragKey(null); setDragOver(null); }}
                >
                  <span className="rg-th-inner">
                    <Icon name="MoreVert" size={14} className="rg-th-grip" />
                    <span className="rg-th-label">{RG_CONDITIONS[k].label}</span>
                    <button
                      type="button"
                      className="rg-th-remove"
                      aria-label={`Remove ${RG_CONDITIONS[k].label} condition`}
                      title="Remove condition"
                      onClick={() => removeCondition(k)}
                    >
                      <Icon name="X" size={13} />
                    </button>
                  </span>
                </th>
              ))}
              <th className="rg-th rg-th--rate">Rate</th>
              <th className="rg-th rg-th--uplift">Season uplift</th>
              <th className="rg-th rg-th--actions" aria-label="Row actions" />
            </tr>
            {/* filter row */}
            <tr className="rg-filter-row">
              {active.map((k) => {
                const opts = [{ value: "__any", label: "All values" }, { value: RG_ALL, label: RG_ALL }]
                  .concat(RG_CONDITIONS[k].values.map((v) => ({ value: v, label: v })));
                return (
                  <th key={k} className="rg-th rg-th--filter">
                    <Dropdown
                      options={opts}
                      value={filters[k] || "__any"}
                      small
                      onChange={(v) => setFilters((f) => ({ ...f, [k]: v }))}
                    />
                  </th>
                );
              })}
              <th className="rg-th rg-th--filter rg-th--rate">
                {anyFilter && (
                  <button type="button" className="rg-clearfilter" onClick={() => setFilters({})}>Clear</button>
                )}
              </th>
              <th className="rg-th rg-th--filter rg-th--uplift" />
              <th className="rg-th rg-th--filter rg-th--actions" />
            </tr>
          </thead>

          {RG_POSITIONS.map((p) => {
            const isCollapsed = !!collapsed[p.code];
            const baseMissing = state.bases[p.code] == null || state.bases[p.code] === "";
            const overrides = sortedOverrides(p.code);
            const visibleOverrides = overrides.filter((o) => passesFilter(o.cond));
            const hiddenByFilter = overrides.length - visibleOverrides.length;
            return (
              <tbody key={p.code} className="rg-group">
                {/* group header */}
                <tr className={"rg-group-head" + (baseMissing ? " rg-group-head--error" : "")}>
                  <td className="rg-group-cell" colSpan={active.length + 3}>
                    <div className="rg-group-inner">
                      <button
                        type="button"
                        className="rg-collapse"
                        aria-expanded={!isCollapsed}
                        aria-label={isCollapsed ? "Expand" : "Collapse"}
                        onClick={() => setCollapsed((c) => ({ ...c, [p.code]: !c[p.code] }))}
                      >
                        <Icon name="ChevronDown" size={18} style={{ transform: isCollapsed ? "rotate(-90deg)" : "none", transition: "transform 150ms cubic-bezier(0.4,0,0.2,1)" }} />
                      </button>
                      <div className="rg-group-title">
                        <span className="rg-group-name">{p.name}</span>
                        <span className="rg-group-code">{p.code}</span>
                      </div>
                      <span className="rg-group-count">{overrides.length} {overrides.length === 1 ? "override" : "overrides"}</span>

                      <div className="rg-group-right">
                        <div className="rg-base">
                          <label className="rg-base-label" htmlFor={"base-" + p.code}>Base rate</label>
                          <span className={"rg-rate-input rg-rate-input--base" + (baseMissing ? " rg-rate-input--error" : "")}>
                            <span className="rg-cur" aria-hidden="true">{RG_CUR}</span>
                            <input
                              id={"base-" + p.code}
                              type="number" min="0" step="0.01" inputMode="decimal"
                              value={state.bases[p.code] == null ? "" : state.bases[p.code]}
                              placeholder="0.00"
                              onChange={(e) => setBase(p.code, e.target.value === "" ? null : Number(e.target.value))}
                              aria-label={"Base rate for " + p.name}
                            />
                          </span>
                          {baseMissing && <span className="rg-base-error"><Icon name="Alert" size={13} />Missing</span>}
                        </div>
                        <div className="rg-base rg-base--uplift">
                          <label className="rg-base-label" htmlFor={"baseup-" + p.code}>Season uplift</label>
                          <RgUplift
                            up={(state.baseUp && state.baseUp[p.code]) || null}
                            onChange={(up) => setBaseUplift(p.code, up)}
                            ariaLabel={"Season uplift for " + p.name + " base rate"}
                          />
                          {!baseMissing && (state.baseUp && state.baseUp[p.code] && state.baseUp[p.code].val != null) && (
                            <span className="rg-peak" title="Base rate with season uplift applied">
                              = {rgFmtRate(rgApplyUplift(state.bases[p.code], state.baseUp[p.code]))}
                            </span>
                          )}
                        </div>
                        <button type="button" className="vms-btn vms-btn--sm vms-btn--secondary" onClick={() => addOverride(p.code)}>
                          <Icon name="AddCircle" size={14} />Add override
                        </button>
                      </div>
                    </div>
                  </td>
                </tr>

                {/* override rows */}
                {!isCollapsed && visibleOverrides.map((o) => {
                  const flag = conflicts.flags[o.id];
                  const spec = rgSpecificity(active, o.cond);
                  return (
                    <tr key={o.id} className={"rg-row" + (flag ? " rg-row--flagged" : "")}>
                      {active.map((k) => (
                        <td key={k} className="rg-td rg-td--cond">
                          <RgCondCell condKey={k} value={o.cond[k]} onChange={(v) => setCell(o.id, k, v)} />
                        </td>
                      ))}
                      <td className="rg-td rg-td--rate">
                        <div className="rg-rate-stack">
                          <RgRateInput value={o.rate} onChange={(v) => setRate(o.id, v)} error={o.rate == null} ariaLabel={"Rate for " + p.name + " override"} />
                          <RgConflictMark flag={flag} />
                        </div>
                      </td>
                      <td className="rg-td rg-td--uplift">
                        <div className="rg-uplift-stack">
                          <RgUplift up={o.up} onChange={(up) => setUplift(o.id, up)} ariaLabel={"Season uplift for " + p.name + " override"} />
                          {o.rate != null && o.up && o.up.val != null && (
                            <span className="rg-peak" title="Rate with season uplift applied">= {rgFmtRate(rgApplyUplift(o.rate, o.up))}</span>
                          )}
                        </div>
                      </td>
                      <td className="rg-td rg-td--actions">
                        <div className="rg-row-actions">
                          <button type="button" className="rg-iconbtn" title="Duplicate line" aria-label="Duplicate line" onClick={() => dupOverride(o.id)}>
                            <Icon name="Copy" size={16} />
                          </button>
                          <button type="button" className="rg-iconbtn rg-iconbtn--danger" title="Delete line" aria-label="Delete line" onClick={() => delOverride(o.id)}>
                            <Icon name="TrashCan" size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {/* empty / filtered-empty states for the group */}
                {!isCollapsed && visibleOverrides.length === 0 && (
                  <tr className="rg-row rg-row--empty">
                    <td className="rg-td rg-empty-cell" colSpan={active.length + 3}>
                      {overrides.length === 0
                        ? "No overrides. This position always resolves to its base rate."
                        : `${hiddenByFilter} override ${hiddenByFilter === 1 ? "line" : "lines"} hidden by the filter.`}
                    </td>
                  </tr>
                )}
                {!isCollapsed && visibleOverrides.length > 0 && hiddenByFilter > 0 && (
                  <tr className="rg-row rg-row--note">
                    <td className="rg-td rg-empty-cell" colSpan={active.length + 3}>
                      {hiddenByFilter} more {hiddenByFilter === 1 ? "line" : "lines"} hidden by the filter.
                    </td>
                  </tr>
                )}
              </tbody>
            );
          })}
        </table>
      </div>

      {/* ---- Footer ---- */}
      <div className="rg-footer">
        <div className="rg-footer-status" aria-live="polite">
          {savedAt && !dirty && (
            <span className="rg-saved"><Icon name="Check" size={15} />Saved {savedAt.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}</span>
          )}
          {dirty && <span className="rg-unsaved">Unsaved changes</span>}
        </div>
        <button type="button" className="vms-btn vms-btn--primary" disabled={!dirty} onClick={save}>
          Save changes
        </button>
      </div>

      {/* ---- Modals (defined in rate-grid-modals.jsx) ---- */}
      {window.RgAddConditionModal && (
        <window.RgAddConditionModal open={showAddCond} active={active} onAdd={addCondition} onClose={() => setShowAddCond(false)} />
      )}
      {window.RgBulkAddModal && (
        <window.RgBulkAddModal open={showBulk} active={active} onCreate={(rows) => { mutate((s) => { rows.forEach((r) => s.overrides.push(r)); return s; }); }} onClose={() => setShowBulk(false)} />
      )}
      {window.RgCoverageModal && (
        <window.RgCoverageModal open={showCoverage} state={state} onClose={() => setShowCoverage(false)} />
      )}
      {window.RgExportModal && (
        <window.RgExportModal open={showExport} state={state} onClose={() => setShowExport(false)} />
      )}
      {window.RgImportModal && (
        <window.RgImportModal open={showImport} state={state} onImport={(next) => { setState(next); setDirty(true); setSavedAt(null); }} onClose={() => setShowImport(false)} />
      )}
    </div>
  );
}

Object.assign(window, { RateGridPage });
