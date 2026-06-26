// =====================================================================
// Flex Work — reusable bulk-action bar (Everest)
//
// A floating, dark-surface bar that anchors to the bottom of the
// table's scroll container whenever the user has selected ≥1 row.
// Built from Everest tokens — surface-inverse-primary, depth-06,
// radius-xs — so every list page picks up consistent look + behaviour
// without duplicating chrome.
//
//   <BulkActionBar
//     count={selected.size}
//     noun="requisition"           // singular; auto-pluralised
//     onClear={() => setSelected(new Set())}
//     actions={[
//       { icon: "FileDownload", label: "Export",      onClick: ... },
//       { icon: "PersonArrow",  label: "Reassign",    onClick: ... },
//       { divider: true },
//       { icon: "Cancel",       label: "Cancel reqs", onClick: ..., kind: "danger" },
//     ]}
//     overflow={[
//       { icon: "Print", label: "Print summary", onClick: ... },
//     ]}
//   />
//
// Each list page passes its OWN unique action set — see the wire-ups
// inside requisitions / invoices / suppliers / timesheets / etc.
// The component intentionally renders nothing when count === 0.
// =====================================================================

(function () {
  const { useEffect: useEffectBba, useRef: useRefBba } = React;

  function BbaAction({ a }) {
    const className =
      "bba-action" +
      (a.kind === "danger"  ? " bba-action--danger"  : "") +
      (a.kind === "primary" ? " bba-action--primary" : "");
    return (
      <button
        type="button"
        className={className}
        onClick={a.onClick}
        title={a.title || a.label}
        disabled={a.disabled}
      >
        {a.icon ? <Icon name={a.icon} size={16} /> : null}
        <span className="bba-action-label">{a.label}</span>
      </button>
    );
  }

  function BulkActionBar({
    count,
    noun = "item",
    nounPlural,
    contextHint,     // optional small grey line under the count, e.g. "in May 2026"
    onClear,
    actions = [],
    overflow = [],
  }) {
    const overflowBtnRef = useRefBba(null);

    // Pressing Escape clears the selection. Industry pattern + a11y nicety.
    useEffectBba(() => {
      if (!count) return;
      const onKey = (e) => {
        if (e.key === "Escape" && onClear) onClear();
      };
      window.addEventListener("keydown", onKey);
      return () => window.removeEventListener("keydown", onKey);
    }, [count, onClear]);

    if (!count) return null;

    const plural = nounPlural || (noun + "s");
    const label  = count === 1 ? noun : plural;

    const openOverflow = (e) => {
      if (!window.openMenu) return;
      window.openMenu(
        e.currentTarget,
        overflow.map((a) => ({
          icon: a.icon,
          label: a.label,
          danger: a.kind === "danger",
          onClick: a.onClick,
        })),
        { align: "end" }
      );
    };

    return (
      <div className="bba" role="region" aria-label={`Bulk actions, ${count} ${label} selected`}>
        <div className="bba-inner">
          <div className="bba-meta">
            <span className="bba-count tabular" aria-hidden="true">{count}</span>
            <div className="bba-meta-text">
              <span className="bba-meta-line">
                <strong>{count.toLocaleString()}</strong> {label} selected
              </span>
              {contextHint ? (
                <span className="bba-meta-hint">{contextHint}</span>
              ) : null}
            </div>
            {onClear ? (
              <button
                type="button"
                className="bba-clear"
                onClick={onClear}
                title="Clear selection (Esc)"
              >
                Clear
              </button>
            ) : null}
          </div>

          <span className="bba-rule" aria-hidden="true" />

          <div className="bba-actions">
            {actions.map((a, i) => {
              if (a.divider) {
                return <span key={"d" + i} className="bba-rule bba-rule--soft" aria-hidden="true" />;
              }
              return <BbaAction key={a.label + i} a={a} />;
            })}

            {overflow.length > 0 ? (
              <button
                ref={overflowBtnRef}
                type="button"
                className="bba-action bba-action--icon"
                onClick={openOverflow}
                aria-label="More bulk actions"
                title="More"
              >
                <Icon name="MoreHoriz" size={16} />
              </button>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  // ---------- Selection helper ----------------------------------------
  // Optional convenience hook so list pages don't all hand-roll the
  // same Set toggle logic. Drop-in replacement for the inline pattern
  // used in requisitions / invoices / suppliers / etc.
  function useBulkSelection(rows) {
    const [selected, setSelected] = React.useState(() => new Set());

    const allChecked = rows.length > 0 && rows.every((r) => selected.has(r.id));
    const someChecked = !allChecked && rows.some((r) => selected.has(r.id));

    const toggle = (id) =>
      setSelected((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id); else next.add(id);
        return next;
      });

    const toggleAll = () =>
      setSelected((prev) => {
        const next = new Set(prev);
        if (allChecked) rows.forEach((r) => next.delete(r.id));
        else            rows.forEach((r) => next.add(r.id));
        return next;
      });

    const clear = () => setSelected(new Set());

    return { selected, setSelected, allChecked, someChecked, toggle, toggleAll, clear };
  }

  Object.assign(window, { BulkActionBar, useBulkSelection });
})();
