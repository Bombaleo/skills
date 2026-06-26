// =====================================================================
// View customizer — per-table column + filter visibility, saved per user
//
// Every data-table surface mounts a small "Customize" button on the
// right side of its filter bar (right after "Clear all filters"). The
// button opens a popover with two sections — Filters and Columns —
// each rendering checkboxes the user toggles. Choices persist to
// localStorage keyed by tableId so a tenant's HR ops lead can hide the
// six columns they never use and never see them again.
//
// Public API (window.ViewCustomizer):
//   · useViewCustomizer(tableId, manifest) → {
//       showCol(id), showFilter(id), gridStyle, Button,
//       hiddenColIds, hiddenFilterIds, isDefault, reset, openPanel
//     }
//   · ViewCustomizerButton ({ vc })            — render the trigger
//
// Manifest shape:
//   {
//     columns: [{ id, label, width, locked?, defaultHidden? }, ...],
//     filters: [{ id, label, locked?, defaultHidden? }, ...],
//   }
//
// - `width` is the CSS grid track width (e.g. "140px", "minmax(220px,
//   1.4fr)"). It must match what the page's CSS sets today so the
//   "no customization" state stays pixel-identical.
// - `locked` keeps a row in the table that the user can't hide (the
//   checkbox in the leftmost column, the kebab actions on the right).
// - `defaultHidden` is for "advanced" columns that ship hidden but the
//   user can opt in to.
//
// The hook returns `gridStyle` = `{ gridTemplateColumns: "..." }` ONLY
// when at least one column is hidden. Until then the CSS-defined grid
// template still wins, so untouched pages remain byte-identical.
// =====================================================================

(function () {
  const STORAGE_KEY = (tableId) => `flexwork.viewCustomization.${tableId}`;

  function _load(tableId) {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY(tableId));
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") return null;
      return {
        hiddenCols:    Array.isArray(parsed.hiddenCols)    ? parsed.hiddenCols    : [],
        hiddenFilters: Array.isArray(parsed.hiddenFilters) ? parsed.hiddenFilters : [],
      };
    } catch (_) {
      return null;
    }
  }

  function _save(tableId, state) {
    try {
      window.localStorage.setItem(STORAGE_KEY(tableId), JSON.stringify(state));
    } catch (_) { /* no-op */ }
  }

  function _clear(tableId) {
    try { window.localStorage.removeItem(STORAGE_KEY(tableId)); } catch (_) { /* no-op */ }
  }

  // Resolve the initial hidden set: anything in the user's saved set,
  // plus any manifest entry with defaultHidden=true that the user
  // hasn't explicitly un-hidden via saved state.
  function _initialHidden(saved, manifestEntries) {
    const out = new Set();
    if (saved) {
      saved.forEach((id) => out.add(id));
      return out;
    }
    manifestEntries.forEach((e) => { if (e.defaultHidden) out.add(e.id); });
    return out;
  }

  // -----------------------------------------------------------------
  // Hook
  // -----------------------------------------------------------------
  function useViewCustomizer(tableId, manifest) {
    const columns = (manifest && manifest.columns) || [];
    const filters = (manifest && manifest.filters) || [];

    // One load on mount + on tableId/manifest signature change. Manifest
    // changes when feature flags flip a column on/off; we need to drop
    // unknown ids from the hidden set so a re-enabled column isn't
    // mysteriously hidden when the user comes back to the page.
    const colSig    = columns.map((c) => c.id).join("|");
    const filterSig = filters.map((f) => f.id).join("|");

    const [hiddenCols, setHiddenCols] = React.useState(() => {
      const saved = _load(tableId);
      return _initialHidden(saved && saved.hiddenCols, columns);
    });
    const [hiddenFilters, setHiddenFilters] = React.useState(() => {
      const saved = _load(tableId);
      return _initialHidden(saved && saved.hiddenFilters, filters);
    });

    // Drop unknown ids when the manifest changes (a flag flip removes
    // a column from the active set).
    React.useEffect(() => {
      const valid = new Set(columns.map((c) => c.id));
      const next  = new Set([...hiddenCols].filter((id) => valid.has(id)));
      if (next.size !== hiddenCols.size) setHiddenCols(next);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [colSig]);

    React.useEffect(() => {
      const valid = new Set(filters.map((f) => f.id));
      const next  = new Set([...hiddenFilters].filter((id) => valid.has(id)));
      if (next.size !== hiddenFilters.size) setHiddenFilters(next);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filterSig]);

    // Persist whenever either set changes. Skip the very first
    // synchronous render (the load already gave us the right state).
    const firstWrite = React.useRef(true);
    React.useEffect(() => {
      if (firstWrite.current) { firstWrite.current = false; return; }
      _save(tableId, {
        hiddenCols:    Array.from(hiddenCols),
        hiddenFilters: Array.from(hiddenFilters),
      });
    }, [tableId, hiddenCols, hiddenFilters]);

    // -----------------------------------------------------------------
    // Derived helpers
    // -----------------------------------------------------------------
    const showCol    = React.useCallback((id) => !hiddenCols.has(id),    [hiddenCols]);
    const showFilter = React.useCallback((id) => !hiddenFilters.has(id), [hiddenFilters]);

    // gridStyle: emit a computed `gridTemplateColumns` ONLY when at
    // least one user-toggleable column is hidden. That keeps the
    // existing CSS rule (with its feature-flag variants) authoritative
    // until the user actually customizes.
    const gridStyle = React.useMemo(() => {
      if (hiddenCols.size === 0) return undefined;
      const tracks = columns
        .filter((c) => !hiddenCols.has(c.id))
        .map((c) => c.width || "auto")
        .join(" ");
      return { gridTemplateColumns: tracks };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [hiddenCols, colSig]);

    const isDefault = React.useMemo(() => {
      // "Default" = the same set the manifest's defaultHidden ships.
      const defCols    = new Set(columns.filter((c) => c.defaultHidden).map((c) => c.id));
      const defFilters = new Set(filters.filter((f) => f.defaultHidden).map((f) => f.id));
      const same = (a, b) => a.size === b.size && [...a].every((x) => b.has(x));
      return same(hiddenCols, defCols) && same(hiddenFilters, defFilters);
    }, [hiddenCols, hiddenFilters, colSig, filterSig, columns, filters]);

    const reset = React.useCallback(() => {
      _clear(tableId);
      setHiddenCols(_initialHidden(null, columns));
      setHiddenFilters(_initialHidden(null, filters));
    }, [tableId, colSig, filterSig]); // eslint-disable-line react-hooks/exhaustive-deps

    const toggleCol = React.useCallback((id) => {
      setHiddenCols((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id); else next.add(id);
        return next;
      });
    }, []);
    const toggleFilter = React.useCallback((id) => {
      setHiddenFilters((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id); else next.add(id);
        return next;
      });
    }, []);

    // Open-panel state lives on the hook (the button is just a trigger).
    const [openAnchor, setOpenAnchor] = React.useState(null);
    const openPanel  = React.useCallback((anchor) => setOpenAnchor(anchor), []);
    const closePanel = React.useCallback(()        => setOpenAnchor(null),  []);

    // Publish this hook instance as the "active" view customizer so the
    // existing Omnibar "Adjust columns" button can drive it without each
    // page wiring a separate trigger. The Omnibar is at page-level above
    // the table — passing a prop down would mean lifting this whole hook
    // into the page component. A scoped module global is cheaper and the
    // un-mount cleanup keeps it honest.
    React.useEffect(() => {
      window.__activeVc = { tableId, openPanel };
      return () => {
        if (window.__activeVc && window.__activeVc.tableId === tableId) {
          window.__activeVc = null;
        }
      };
    }, [tableId, openPanel]);

    const panel = openAnchor
      ? React.createElement(ViewCustomizerPanel, {
          anchor: openAnchor,
          tableId,
          columns,
          filters,
          hiddenCols,
          hiddenFilters,
          onToggleCol: toggleCol,
          onToggleFilter: toggleFilter,
          onReset: reset,
          onClose: closePanel,
        })
      : null;

    // Pre-bound Button helper: pages can render `<vc.Button />` and
    // we manage the open state inside the hook.
    const Button = React.useCallback(
      (props) => React.createElement(ViewCustomizerButton, { ...props, vc: { openPanel, isDefault, hiddenCount: hiddenCols.size + hiddenFilters.size } }),
      [openPanel, isDefault, hiddenCols.size, hiddenFilters.size]
    );

    return {
      showCol,
      showFilter,
      gridStyle,
      hiddenColIds:    Array.from(hiddenCols),
      hiddenFilterIds: Array.from(hiddenFilters),
      isDefault,
      reset,
      openPanel,
      closePanel,
      panel,           // render this in JSX so the popover mounts
      Button,
    };
  }

  // -----------------------------------------------------------------
  // Button — small ghost trigger
  // -----------------------------------------------------------------
  function ViewCustomizerButton({ vc, label = "Customize", compact = false }) {
    const dirty = !vc.isDefault;
    return React.createElement(
      "button",
      {
        type: "button",
        className: `vc-trigger${dirty ? " vc-trigger--dirty" : ""}${compact ? " vc-trigger--compact" : ""}`,
        onClick: (e) => vc.openPanel(e.currentTarget),
        title: "Customize columns and filters",
        "aria-label": "Customize columns and filters",
      },
      React.createElement(Icon, { name: "Settings", size: 16 }),
      !compact && React.createElement("span", { className: "vc-trigger-label" }, label),
      dirty && React.createElement("span", {
        className: "vc-trigger-dot",
        "aria-hidden": "true",
        title: `${vc.hiddenCount} hidden`,
      })
    );
  }

  // -----------------------------------------------------------------
  // Popover
  // -----------------------------------------------------------------
  function ViewCustomizerPanel({
    anchor,
    tableId,
    columns,
    filters,
    hiddenCols,
    hiddenFilters,
    onToggleCol,
    onToggleFilter,
    onReset,
    onClose,
  }) {
    const ref = React.useRef(null);

    // Outside-click + Escape dismissal.
    React.useEffect(() => {
      const onDown = (e) => {
        if (ref.current && ref.current.contains(e.target)) return;
        if (anchor && anchor.contains && anchor.contains(e.target)) return;
        onClose();
      };
      const onKey = (e) => { if (e.key === "Escape") onClose(); };
      document.addEventListener("mousedown", onDown);
      document.addEventListener("keydown", onKey);
      return () => {
        document.removeEventListener("mousedown", onDown);
        document.removeEventListener("keydown", onKey);
      };
    }, [anchor, onClose]);

    // Anchored fixed-position panel. Aligns the right edge of the
    // panel with the right edge of the trigger so it never wraps off
    // the table card.
    const [pos, setPos] = React.useState(() => _anchoredPos(anchor));
    React.useEffect(() => { setPos(_anchoredPos(anchor)); }, [anchor]);

    const handleShowAll = () => {
      // "Show all" = empty hidden set on both sides.
      columns.forEach((c) => { if (hiddenCols.has(c.id))    onToggleCol(c.id); });
      filters.forEach((f) => { if (hiddenFilters.has(f.id)) onToggleFilter(f.id); });
    };

    const hiddenCount = hiddenCols.size + hiddenFilters.size;

    return React.createElement(
      "div",
      {
        ref,
        className: "vc-panel",
        role: "dialog",
        "aria-label": "Customize columns and filters",
        style: { top: pos.top, left: pos.left },
      },
      React.createElement(
        "div", { className: "vc-panel-head" },
        React.createElement("div", { className: "vc-panel-title" }, "Customize this view"),
        React.createElement(
          "button",
          {
            type: "button",
            className: "vc-panel-close",
            onClick: onClose,
            "aria-label": "Close",
          },
          React.createElement(Icon, { name: "Cancel", size: 14 })
        )
      ),

      React.createElement(
        "div", { className: "vc-panel-sub" },
        hiddenCount === 0
          ? "Showing all filters and columns"
          : `${hiddenCount} hidden — toggle to bring back`
      ),

      // Filters
      filters.length > 0 && React.createElement(
        "div", { className: "vc-section" },
        React.createElement("div", { className: "vc-section-head" }, "Filters"),
        React.createElement(
          "ul", { className: "vc-list", role: "list" },
          filters.map((f) =>
            React.createElement(VCRow, {
              key: f.id,
              entry: f,
              checked: !hiddenFilters.has(f.id),
              onToggle: () => onToggleFilter(f.id),
            })
          )
        )
      ),

      // Columns
      columns.length > 0 && React.createElement(
        "div", { className: "vc-section" },
        React.createElement("div", { className: "vc-section-head" }, "Columns"),
        React.createElement(
          "ul", { className: "vc-list", role: "list" },
          columns.map((c) =>
            React.createElement(VCRow, {
              key: c.id,
              entry: c,
              checked: !hiddenCols.has(c.id),
              onToggle: () => onToggleCol(c.id),
            })
          )
        )
      ),

      // Footer — reset + show all
      React.createElement(
        "div", { className: "vc-panel-foot" },
        React.createElement(
          "button",
          {
            type: "button",
            className: "vc-foot-link",
            onClick: onReset,
            title: "Reset to defaults",
          },
          "Reset to defaults"
        ),
        React.createElement(
          "button",
          {
            type: "button",
            className: "vc-foot-link",
            onClick: handleShowAll,
            disabled: hiddenCount === 0,
          },
          "Show all"
        )
      )
    );
  }

  function VCRow({ entry, checked, onToggle }) {
    const locked = !!entry.locked;
    return React.createElement(
      "li",
      { className: `vc-row${locked ? " vc-row--locked" : ""}` },
      React.createElement(
        "label",
        { className: "vc-row-label" },
        React.createElement("input", {
          type: "checkbox",
          checked: locked ? true : checked,
          disabled: locked,
          onChange: () => { if (!locked) onToggle(); },
        }),
        React.createElement("span", { className: "vc-row-text" }, entry.label),
        locked && React.createElement(
          "span", { className: "vc-row-tag" }, "Required"
        )
      )
    );
  }

  // -----------------------------------------------------------------
  // Positioning — anchor the panel to the trigger's bottom-right.
  // -----------------------------------------------------------------
  function _anchoredPos(anchor) {
    const W = 320;
    if (!anchor || !anchor.getBoundingClientRect) return { top: 80, left: 80 };
    const r = anchor.getBoundingClientRect();
    const left = Math.min(
      window.innerWidth - W - 12,
      Math.max(12, r.right - W)
    );
    const top = Math.min(window.innerHeight - 24, r.bottom + 6);
    return { top, left };
  }

  // -----------------------------------------------------------------
  // Public exports
  // -----------------------------------------------------------------
  Object.assign(window, {
    ViewCustomizer: {
      useViewCustomizer,
      ViewCustomizerButton,
    },
    useViewCustomizer,        // convenience alias
    ViewCustomizerButton,     // convenience alias
  });
})();
