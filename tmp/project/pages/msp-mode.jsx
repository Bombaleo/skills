// =====================================================================
// MSP Mode — cross-tenant scoping for the MSP "viewing as" role.
//
// Today the omnibar's MSP program switcher swaps the active industry
// pack and reloads, so the MSP user only ever sees ONE client program
// at a time. Real MSPs run several client programs from a single
// login and need a cross-program view — see "Flex Work VMS MSP Feature
// Brief.html" §05 Feature 01.
//
// When viewAsRole === "msp" this module:
//   1. Renders a sticky <MSPScopeBar/> below the AppNav. The bar shows
//      one chip per program in the MSP's portfolio (Aurora, Mercy,
//      Northwind, Midland) plus an "All programs" preset; toggling
//      narrows the in-page tenant filter live (no reload).
//   2. Stamps every data-row in every list with a deterministic
//      tenant attribute (data-msp-tenant=…) and a colored leading
//      accent + 2-letter tenant chip via CSS.
//   3. Injects a "Tenant" FilterChip into every list filter bar
//      (.req-filters-left) so users can filter by tenant on the page
//      level too, the same way they filter Status / Supplier / Date.
//
// The work that backs this is purely visual: there is no real
// multi-tenant data store under the prototype. Each row gets a
// deterministic tenant tag from a stable hash of its identifying
// text — same row → same tenant on every render — so the chrome
// reads convincingly across the product.
//
// Flag-off contract: when viewAsRole !== "msp", every effect short-
// circuits, every observer is torn down, and the DOM goes back to
// byte-identical to today.
// =====================================================================

const { useState: useMspState, useEffect: useMspEffect, useMemo: useMspMemo, useCallback: useMspCb } = React;

// ---------- Programs the MSP user runs --------------------------------
// Source of truth lives in chrome.jsx (window.MSP_PROGRAMS). We mirror
// here with a small fallback so the module can be loaded before chrome.
const MSP_PROGRAMS_FALLBACK = [
  { id: "aurora",    name: "Aurora Hotels & Resorts", industry: "hospitality", mark: "AU", color: "#A0541A" },
  { id: "mercy",     name: "Mercy Health System",     industry: "healthcare",  mark: "MH", color: "#147A78" },
  { id: "northwind", name: "Northwind Retail",        industry: "retail",      mark: "NW", color: "#5C36A3" },
  { id: "midland",   name: "Midland Logistics",       industry: "logistics",   mark: "ML", color: "#1E4FB0" },
];
function mspPrograms() {
  return (typeof window !== "undefined" && window.MSP_PROGRAMS) || MSP_PROGRAMS_FALLBACK;
}
function mspProgramById(id) {
  return mspPrograms().find((p) => p.id === id) || mspPrograms()[0];
}

// ---------- Scope state -----------------------------------------------
// `selected` = array of program ids currently in scope. Empty array
// means "all programs" (the most common state — MSPs want the panoramic
// view by default). The chrome MSP submenu and the in-page Tenant
// filter chip both read / write this same store.
const SCOPE_KEY = "flexwork.msp.scope";
function _initialScope() {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage && window.localStorage.getItem(SCOPE_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.filter((s) => typeof s === "string") : [];
  } catch (e) { return []; }
}
let _scope = _initialScope();
const _listeners = new Set();

function getMspScope() {
  // Defensive: prune ids that no longer exist in the program list.
  const valid = new Set(mspPrograms().map((p) => p.id));
  return _scope.filter((id) => valid.has(id));
}
function setMspScope(ids) {
  const valid = new Set(mspPrograms().map((p) => p.id));
  const next = Array.from(new Set((ids || []).filter((id) => valid.has(id))));
  // "All" is canonicalized to empty array — never store the full list.
  const norm = next.length === mspPrograms().length ? [] : next;
  // Skip notify when nothing actually changed.
  const before = JSON.stringify(_scope);
  const after  = JSON.stringify(norm);
  if (before === after) return;
  _scope = norm;
  try { if (window.localStorage) window.localStorage.setItem(SCOPE_KEY, JSON.stringify(_scope)); } catch (e) {}
  _listeners.forEach((fn) => { try { fn(getMspScope()); } catch (e) {} });
}
function onMspScopeChange(fn) {
  _listeners.add(fn);
  return () => _listeners.delete(fn);
}
function mspIsActive() {
  // window.flexViewAsRole is owned by app.jsx and updated in a sibling
  // useEffect — depending on effect ordering, our own effect can run
  // BEFORE that mirror is written. Also accept the body class as a
  // positive signal, since _start() sets it synchronously up-front.
  if (typeof document !== "undefined" && document.body && document.body.classList.contains("msp-mode-on")) return true;
  return typeof window !== "undefined" && window.flexViewAsRole === "msp";
}
function mspScopeMatches(tenantId) {
  const sel = getMspScope();
  if (!sel.length) return true; // all programs in scope
  return sel.includes(tenantId);
}

// ---------- Deterministic tenant tagging ------------------------------
// Mixer that distributes patterned strings (sequential reqs, short
// IDs, repeated prefixes) across N buckets evenly. FNV-1a alone tends
// to cluster on short inputs that share suffix bytes — see prototype
// data where most req IDs hash to the same 1–2 buckets out of 4. We
// fold the hash with a second multiply-rotate step to spread bits
// before taking modulo.
function _hash(str) {
  let h1 = 0xdeadbeef ^ 0, h2 = 0x41c6ce57 ^ 0;
  const s = String(str || "");
  for (let i = 0; i < s.length; i++) {
    const ch = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
  h2 = Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  return (h1 ^ h2) >>> 0;
}
function tenantForKey(key) {
  const progs = mspPrograms();
  if (!progs.length) return null;
  return progs[_hash(key) % progs.length];
}

// Best-effort stable key for a DOM row. Pulls in priority order:
//   1. `data-row-id` attribute (set by some pages explicitly)
//   2. text content of the row's inner-most identifier element — we
//      check the leaf classes (.req-id, .pro-req-cell--id-text, …)
//      BEFORE the wrapper cells, because once we've injected our
//      <span class="msp-row-pill"> into the wrapper cell, querying the
//      wrapper's textContent would include the pill mark and shift
//      the hash output on every mutation tick.
//   3. the wrapper cell's text, with our injected pill explicitly
//      filtered out
//   4. the row's `aria-label`, which most cards set to a stable string
//   5. fall back to the row's first ~120 chars of textContent
function _rowKey(node) {
  if (!node) return "";
  if (node.dataset && node.dataset.rowId) return node.dataset.rowId;
  // Leaf identifier elements — these never contain our pill because
  // we inject the pill into the cell, not into its identifier child.
  const leaf = node.querySelector(
    ".req-id, .sup-row-name, .loc-row-name, .wf-row-name"
  );
  if (leaf && leaf.textContent) {
    const t = leaf.textContent.trim();
    if (t) return t;
  }
  // Wrapper cells — filter out our injected pill before reading.
  const cell = node.querySelector(
    ".req-cell--id, .pro-req-cell--id, .wf-cell--worker, .loc-cell--name, .sup-cell-v2, .inv-cell--id, .ts-cell--worker"
  );
  if (cell) {
    const txt = Array.from(cell.childNodes)
      .filter((n) => !(n instanceof Element && n.classList && n.classList.contains("msp-row-pill")))
      .map((n) => (n.textContent || ""))
      .join("")
      .trim();
    if (txt) return txt;
  }
  const aria = node.getAttribute("aria-label");
  if (aria) return aria;
  const txt = (node.textContent || "").replace(/\s+/g, " ").trim();
  return txt.slice(0, 120);
}

// ---------- DOM injectors --------------------------------------------
// Selectors for "this is a data row that should get a tenant badge".
// We stay narrow — header rows and synthetic non-row divs are excluded
// in the predicate below.
const ROW_SELECTORS = [
  ".req-row.req-row--clickable",        // requisitions, workforce, invoices, suppliers, locations, timesheets, schedule list
  ".pro-req-row:not(.pro-req-row--header)", // professional requisitions
];
function _isDataRow(node) {
  if (!(node instanceof Element)) return false;
  if (node.classList.contains("req-row--header")) return false;
  if (node.classList.contains("pro-req-row--header")) return false;
  return ROW_SELECTORS.some((sel) => node.matches(sel));
}

// Stamp / restamp every row currently in the DOM.
function _tagAllRows(root) {
  const r = root || document;
  const sel = ROW_SELECTORS.join(", ");
  const rows = r.querySelectorAll(sel);
  rows.forEach(_tagOneRow);
}
// Find the cell inside a row that should host the tenant pill. We
// pick the row's primary-identifier cell — falling back to the first
// non-check cell — so the pill sits next to the row's most prominent
// text. Returns null when no good slot is found.
function _pillHostFor(row) {
  return (
    row.querySelector(":scope > .req-cell--id") ||
    row.querySelector(":scope > .pro-req-cell--id") ||
    row.querySelector(":scope > .req-cell.wf-cell--worker") ||
    row.querySelector(":scope > .req-cell.loc-cell--name") ||
    row.querySelector(":scope > .req-cell.sup-cell-v2") ||
    row.querySelector(":scope > .req-cell.inv-cell--id") ||
    row.querySelector(":scope > .req-cell.ts-cell--worker") ||
    // Last-resort: first cell that isn't the checkbox column.
    row.querySelector(":scope > .req-cell:not(.req-cell--check)") ||
    row.querySelector(":scope > *:not(.req-cell--check):not(.pro-req-cell--id)") ||
    null
  );
}
function _tagOneRow(node) {
  if (!_isDataRow(node)) return;
  if (!mspIsActive()) {
    if (node.dataset && node.dataset.mspTenant) {
      delete node.dataset.mspTenant;
      delete node.dataset.mspMark;
      node.style.removeProperty("--msp-tenant-color");
    }
    // Always remove any in-row pill we injected, even if data attrs
    // were already cleaned up on a prior pass.
    const lbl = node.querySelector(".msp-row-pill");
    if (lbl) lbl.remove();
    node.classList.remove("msp-row--out-of-scope");
    return;
  }
  // Tenant assignment is sticky once set: we cache it in
  // data-msp-tenant. If the row already has one, we trust it — the
  // alternative is re-hashing on every mutation, but our own injected
  // pill mutates the host cell's textContent and would shift the hash
  // input, re-rolling the tenant on every mutation tick.
  let tenantId = node.dataset.mspTenant;
  let t;
  if (tenantId) {
    t = mspProgramById(tenantId);
  } else {
    const key = _rowKey(node);
    t = tenantForKey(key);
    if (!t) return;
    node.dataset.mspTenant = t.id;
    node.dataset.mspMark = t.mark;
    node.style.setProperty("--msp-tenant-color", t.color);
  }
  // Hide rows that fall outside the current scope. We keep the DOM in
  // place (so React doesn't fight us) and just collapse them via CSS.
  if (mspScopeMatches(t.id)) {
    node.classList.remove("msp-row--out-of-scope");
  } else {
    node.classList.add("msp-row--out-of-scope");
  }
  // Pill — kept up to date even when the tenant assignment hasn't
  // moved, in case the host cell was re-rendered out from under us.
  const host = _pillHostFor(node);
  if (!host) return;
  let pill = host.querySelector(":scope > .msp-row-pill");
  if (!pill) {
    pill = document.createElement("span");
    pill.className = "msp-row-pill";
    pill.setAttribute("aria-hidden", "true");
    host.insertBefore(pill, host.firstChild);
  }
  pill.style.background = t.color;
  pill.textContent = t.mark;
  pill.title = `${t.name} \u00b7 tenant`;
}

// Tenant FilterChip injection. For each filter bar we find, prepend a
// "Tenant" chip element that mirrors the look of the existing
// .filter-chip and opens the same openFilter popover the page chips
// use. The chip element is owned by us (data-msp-tenant-chip) so we
// can update its label / count and remove it cleanly when MSP turns
// off.
function _renderTenantChipMarkup(scope) {
  const all = scope.length === 0;
  const label = all ? "Tenant" : (scope.length === 1
    ? mspProgramById(scope[0]).name
    : `Tenant`);
  const count = scope.length;
  return `<span class="msp-chip-swatches" aria-hidden="true">${
    mspPrograms().map((p) => {
      const on = all || scope.includes(p.id);
      return `<span class="msp-chip-swatch" style="background:${p.color};opacity:${on ? 1 : 0.25}"></span>`;
    }).join("")
  }</span><span>${label}</span>${count > 0 && !all ? `<span class="filter-chip-count tabular">${count}</span>` : ""}<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter" aria-hidden="true"><polyline points="6,9 12,15 18,9"/></svg>`;
}
function _refreshTenantChips() {
  document.querySelectorAll("[data-msp-tenant-chip]").forEach((el) => {
    const scope = getMspScope();
    el.classList.toggle("filter-chip--active", scope.length > 0);
    el.innerHTML = _renderTenantChipMarkup(scope);
  });
}
function _onTenantChipClick(e) {
  const anchor = e.currentTarget;
  const opts = mspPrograms().map((p) => p.name);
  const idByName = Object.fromEntries(mspPrograms().map((p) => [p.name, p.id]));
  const nameById = Object.fromEntries(mspPrograms().map((p) => [p.id, p.name]));
  const scope = getMspScope();
  const selected = scope.length === 0 ? opts.slice() : scope.map((id) => nameById[id]).filter(Boolean);
  if (window.openFilter) {
    window.openFilter(anchor, {
      title: "Tenant",
      options: opts,
      selected,
      onApply: (vals) => {
        const ids = (vals || []).map((n) => idByName[n]).filter(Boolean);
        setMspScope(ids);
      },
    });
  }
}
function _injectTenantChips() {
  if (!mspIsActive()) {
    // Remove all our chips
    document.querySelectorAll("[data-msp-tenant-chip]").forEach((el) => el.remove());
    return;
  }
  const bars = document.querySelectorAll(".req-filters-left");
  bars.forEach((bar) => {
    if (bar.querySelector(":scope > [data-msp-tenant-chip]")) return; // already there
    const btn = document.createElement("button");
    btn.type = "button";
    btn.setAttribute("data-msp-tenant-chip", "true");
    const scope = getMspScope();
    btn.className = "filter-chip msp-filter-chip" + (scope.length > 0 ? " filter-chip--active" : "");
    btn.title = "Filter by client program (tenant)";
    btn.innerHTML = _renderTenantChipMarkup(scope);
    btn.addEventListener("click", _onTenantChipClick);
    bar.insertBefore(btn, bar.firstChild);
  });
}

// ---------- Mutation observer / lifecycle -----------------------------
let _observer = null;
let _scopeOff = null;
let _running  = false;
function _start() {
  if (_running) return;
  _running = true;
  document.body && document.body.classList.add("msp-mode-on");
  _tagAllRows();
  _injectTenantChips();
  // Re-run on every relevant DOM mutation. Cheap because we early-out
  // when MSP is off and when the node has the right `data-msp-tenant`.
  _observer = new MutationObserver((muts) => {
    for (const m of muts) {
      if (m.type === "childList") {
        m.addedNodes.forEach((n) => {
          if (!(n instanceof Element)) return;
          if (_isDataRow(n)) _tagOneRow(n);
          else _tagAllRows(n);
          // Filter bars can be re-rendered (tab swap, role change) —
          // re-inject our chip if any new bars showed up.
          if (n.querySelector && n.querySelector(".req-filters-left")) _injectTenantChips();
          else if (n.classList && n.classList.contains("req-filters-left")) _injectTenantChips();
        });
      } else if (m.type === "attributes" && m.target instanceof Element) {
        // Row identity cells can be lazily filled in — re-tag when an
        // existing row's textual content shifts.
        const row = m.target.closest && m.target.closest(ROW_SELECTORS.join(", "));
        if (row && _isDataRow(row)) _tagOneRow(row);
      }
    }
  });
  _observer.observe(document.body, { childList: true, subtree: true });
  _scopeOff = onMspScopeChange(() => {
    _tagAllRows();
    _refreshTenantChips();
  });
}
function _stop() {
  if (!_running) return;
  _running = false;
  document.body && document.body.classList.remove("msp-mode-on");
  if (_observer) { _observer.disconnect(); _observer = null; }
  if (_scopeOff) { _scopeOff(); _scopeOff = null; }
  _tagAllRows(); // clears data-msp-tenant since mspIsActive() now false
  _injectTenactSafe();
}
function _injectTenactSafe() {
  try { _injectTenantChips(); } catch (e) {}
}

// ---------- React host -----------------------------------------------
// Renders the scope bar AND drives the start / stop lifecycle. App
// mounts <MSPHost/> unconditionally; the host itself decides whether
// to show anything based on window.flexViewAsRole.
function MSPHost({ viewAsRole }) {
  const isMsp = viewAsRole === "msp";
  const [scope, setScope] = useMspState(getMspScope());
  useMspEffect(() => {
    if (isMsp) _start(); else _stop();
    return () => { /* leave running across react re-renders */ };
  }, [isMsp]);
  useMspEffect(() => {
    const off = onMspScopeChange((s) => setScope(s));
    return off;
  }, []);
  if (!isMsp) return null;
  // Cockpit scope bar removed — the per-page "Tenant" filter chip
  // (injected into every list's .req-filters-left) is the single
  // tenant-scope control. We still mount this host because it owns
  // the start/stop lifecycle for the row tagger + chip injector.
  return null;
  // eslint-disable-next-line no-unreachable
  const progs = mspPrograms();
  const all = scope.length === 0;
  const isOn = (id) => all || scope.includes(id);
  const toggle = (id) => {
    if (all) {
      // From "all", clicking a chip narrows to that one tenant.
      setMspScope([id]);
      return;
    }
    const set = new Set(scope);
    if (set.has(id)) set.delete(id); else set.add(id);
    setMspScope([...set]);
  };
  const onAll = () => setMspScope([]);
  return (
    <div className="msp-scope-bar" role="region" aria-label="MSP tenant scope">
      <div className="msp-scope-bar-inner">
        <div className="msp-scope-bar-lead">
          <span className="msp-scope-bar-icon" aria-hidden="true">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="square">
              <rect x="3" y="4" width="18" height="16" rx="1"/>
              <path d="M3 9h18"/>
              <path d="M9 4v16"/>
            </svg>
          </span>
          <div className="msp-scope-bar-titles">
            <span className="msp-scope-bar-eyebrow">MSP cockpit</span>
            <span className="msp-scope-bar-title">
              {all
                ? <>Viewing all <b>{progs.length}</b> client programs</>
                : scope.length === 1
                  ? <>Viewing <b>{mspProgramById(scope[0]).name}</b></>
                  : <>Viewing <b>{scope.length} of {progs.length}</b> client programs</>}
            </span>
          </div>
        </div>
        <div className="msp-scope-bar-chips" role="group" aria-label="Tenant scope chips">
          <button
            type="button"
            className={"msp-scope-chip msp-scope-chip--all" + (all ? " msp-scope-chip--on" : "")}
            onClick={onAll}
            aria-pressed={all}
          >
            <span className="msp-scope-chip-dot msp-scope-chip-dot--all" aria-hidden="true">
              <span></span><span></span><span></span><span></span>
            </span>
            <span>All programs</span>
          </button>
          {progs.map((p) => {
            const on = !all && scope.includes(p.id);
            return (
              <button
                key={p.id}
                type="button"
                className={"msp-scope-chip" + (on ? " msp-scope-chip--on" : "")}
                style={{ "--msp-chip-color": p.color }}
                onClick={() => toggle(p.id)}
                aria-pressed={on}
                title={`${p.name} · ${p.industry}`}
              >
                <span className="msp-scope-chip-mark" aria-hidden="true">{p.mark}</span>
                <span className="msp-scope-chip-name">{p.name}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ---------- Public surface --------------------------------------------
Object.assign(window, {
  MSPHost,
  mspIsActive,
  getMspScope,
  setMspScope,
  onMspScopeChange,
  mspPrograms,
  mspProgramById,
  tenantForKey,
  mspScopeMatches,
});
