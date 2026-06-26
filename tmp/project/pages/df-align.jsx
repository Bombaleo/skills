// =====================================================================
// Flex Work — Dayforce alignment indicator
//   · DfAlignPill    — small pill rendered next to a list-page title that
//                      surfaces the Dayforce primitive the table maps to.
//                      Click expands a popover with the mapping detail
//                      and a link to the Flex Work Data Model doc.
//
// Usage:
//   <DfAlignPill
//     primitive="OrgUnit"
//     product="Org Setup"
//     subtitle="type = Site"
//     note="Locations retire into Dayforce OrgUnits with effective dating, legal entity, and coordinates."
//     anchor="orgsetup"
//   />
//
// All props optional except primitive + product. `anchor` is the section
// id in Flex Work Data Model.html to deep-link into.
// =====================================================================

function DfAlignPill({
  primitive,
  product,
  subtitle,
  note,
  strategy,        // "Extend" | "Rebuild" | "Bridge" | "New" | "Adopt"
  anchor = "map",
}) {
  // Gated by the "Data Model Alignment" feature flag (Settings → Feature
  // Flags → Dayforce). Default off — production tenants never see the
  // developer surface. Subscribe so toggling the flag re-renders the
  // omnibar pill in place.
  const enabled = window.useFeatureFlag
    ? window.useFeatureFlag("dataModelAlignment", false)
    : false;
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef(null);

  // Dismiss on outside click / Esc.
  React.useEffect(() => {
    if (!open) return;
    function onDoc(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    function onKey(e) { if (e.key === "Escape") setOpen(false); }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Flag off — render nothing. (Hooks above still run so toggling flips
  // the pill into view without remounting consumer pages.)
  if (!enabled) return null;

  return (
    <span className="df-align" ref={ref}>
      <button
        type="button"
        className="df-align-pill"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="dialog"
        title={`Aligns to Dayforce ${primitive} · ${product}`}
      >
        Dayforce
        <span className="df-align-pill-arrow">→</span>
        <span className="df-align-pill-name">{primitive}</span>
      </button>
      {open && (
        <div className="df-align-pop" role="dialog" aria-label="Dayforce alignment">
          <div className="df-align-pop-head">
            <span className="df-align-pop-eyebrow">Data model alignment</span>
            <button
              type="button"
              className="df-align-pop-close"
              onClick={() => setOpen(false)}
              aria-label="Close"
            >×</button>
          </div>
          <dl className="df-align-pop-row">
            <dt>Dayforce</dt>
            <dd>
              <code>{primitive}</code>
              {subtitle && <span style={{ color: "var(--evr-content-primary-lowemp)", marginLeft: 6, fontSize: 12 }}>· {subtitle}</span>}
            </dd>
          </dl>
          <dl className="df-align-pop-row">
            <dt>Product</dt>
            <dd>{product}</dd>
          </dl>
          {strategy && (
            <dl className="df-align-pop-row">
              <dt>Strategy</dt>
              <dd>{strategy}</dd>
            </dl>
          )}
          {note && <p className="df-align-pop-note">{note}</p>}
          <div className="df-align-pop-links">
            <a href={`Flex Work Data Model.html#${anchor}`} target="_blank" rel="noopener noreferrer">
              See the full data model
            </a>
            <a href="data-model-alignment.html" target="_blank" rel="noopener noreferrer">
              View alignment recommendations
            </a>
          </div>
        </div>
      )}
    </span>
  );
}

Object.assign(window, { DfAlignPill });
