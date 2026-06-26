// =====================================================================
// Flex Work — Unified detail · DetailShell (Phase 1)
// ---------------------------------------------------------------------
// Spec checklist item: "Phase 1 · Build <DetailShell> · consume manifest
// chips · meta · accordions · art · menu". Closes the loop on the
// architectural unification — the variant manifest entries the router
// already carries (pages/requisition-engagement-detail.jsx) become the
// source of truth for the omnibar + hero card + accordion grid. Variant
// bodies pass in `row` data and an `accordions` slot for content;
// chrome rendering is centralized here.
//
// Contract:
//
//   <DetailShell
//     manifest={manifest}           // from VariantRegistry
//     row={row}                     // resolved by useRequisitionRow
//     onBack={onBack}
//     title="..."                   // page title (overrides manifest)
//     status={<ReactNode/>}         // pill / status node
//     hero={{
//       title:     "Engagement title",
//       statusKey: "active" | "open" | "pipeline" | "burning",
//       statusLabel: "Active",
//       meta:      [{ label: "Owner", value: <…/> }, …],
//       art:       <ReactNode/>     // right-side art block
//     }}
//     kpis={[                       // optional KPI strip
//       { lbl: "Milestones", val: "5 / 8", foot: "complete" }, …
//     ]}
//     menuExtra={[...]}             // additional shared menu items
//     screenLabel="Contractor engagement"
//   >
//     <AccordionContents/>          // the variant-specific content
//   </DetailShell>
//
// The shell reads `manifest.chips`, `manifest.meta` (for fallback when
// hero.meta isn't passed), `manifest.menu`, and `manifest.audit.scope`
// to compose the omnibar, hero chip row, and the AuditAccordion at the
// foot of the page. Variant bodies no longer hand-roll those parts.
//
// FRONTLINE NOTE: this shell is opt-in. The legacy RequisitionDetailsPage
// (FrontlineBody) does NOT consume DetailShell today because the
// byte-identity contract at all-flags-off requires its DOM to match the
// pre-unification baseline exactly. Migrating Frontline to DetailShell
// is a follow-up that needs a side-by-side snapshot test in the
// production codebase; for now the shell ships used by Contractor /
// SOW / EOR (and any future variants).
// =====================================================================

function DetailShell({
  manifest,
  row,
  onBack,
  title,
  subtitle,
  status,
  hero,
  kpis,
  menuExtra,
  screenLabel,
  children,
}) {
  const Omnibar = window.ReqOmnibar;
  const Audit   = window.AuditAccordion;
  const Icon    = window.Icon || (() => null);

  // ---------------------------------------------------------------------
  // Toast / audit helper — mutators write to the shared audit log with
  // the manifest's declared scope, so Compliance sees a single timeline.
  // ---------------------------------------------------------------------
  const writeAuditEntry = (action, kind, extra) => {
    if (window.showToast) window.showToast(action, kind ? { kind } : null);
    if (window.writeAudit && manifest && manifest.audit && manifest.audit.scope && row) {
      window.writeAudit({
        scope:  manifest.audit.scope,
        target: row.id,
        action,
        source: "ui",
        ...extra,
      });
    }
  };

  // ---------------------------------------------------------------------
  // Build the more-menu from manifest.menu (grouped, per Decision 04).
  // Shared items (Duplicate, Export, End) sit above the divider; the
  // manifest-declared items sit below a header label.
  // ---------------------------------------------------------------------
  const variantLabel = (manifest && manifest.label) || "Engagement";
  const buildMenu = () => {
    const out = [];
    out.push({ icon: "Copy",   label: `Duplicate ${variantLabel.toLowerCase()}`,
      onClick: () => writeAuditEntry(`Duplicated ${variantLabel.toLowerCase()}`) });
    out.push({ icon: "Export", label: "Export packet",
      onClick: () => writeAuditEntry(`Exported ${variantLabel.toLowerCase()} packet`, "success") });
    if (Array.isArray(menuExtra) && menuExtra.length) {
      out.push({ divider: true });
      out.push({ header: `Shared actions` });
      for (const item of menuExtra) out.push(item);
    }
    if (manifest && Array.isArray(manifest.menu) && manifest.menu.length) {
      out.push({ divider: true });
      out.push({ header: `${variantLabel} actions` });
      for (const item of manifest.menu) {
        out.push({
          icon: item.icon,
          label: item.label,
          onClick: () => writeAuditEntry(item.label),
        });
      }
    }
    out.push({ divider: true });
    out.push({ icon: "Cancel", label: `End ${variantLabel.toLowerCase()}`, danger: true,
      onClick: () => writeAuditEntry(`Ended ${variantLabel.toLowerCase()}`, "success") });
    return out;
  };

  const onMenu = (e) => {
    if (window.openMenu) window.openMenu(e.currentTarget, buildMenu());
  };

  // ---------------------------------------------------------------------
  // Chip row — manifest.chips drives this. The first chip carries the
  // variant's color (chipClass); the rest fall back to the channel-style
  // neutral chip.
  // ---------------------------------------------------------------------
  const chips = (manifest && Array.isArray(manifest.chips)) ? manifest.chips : [];
  const chipClass = (manifest && manifest.chipClass) || "rdu-chip--frontline";

  // ---------------------------------------------------------------------
  // Hero status pill — map the heroStatusKey to a className the unified
  // stylesheet already ships.
  // ---------------------------------------------------------------------
  const statusKey   = (hero && hero.statusKey)   || "active";
  const statusLabel = (hero && hero.statusLabel) || "Active";

  return (
    <React.Fragment>
      {Omnibar ? (
        <Omnibar
          title={title}
          subtitle={subtitle || `Requisitions · ${variantLabel}`}
          status={status}
          onBack={onBack}
          actions={(
            <React.Fragment>
              <button
                type="button"
                className="iconbtn"
                aria-label="Reload"
                onClick={() => window.showToast && window.showToast(`${variantLabel} refreshed`)}
              >
                <Icon name="Refresh" size={20} />
              </button>
              <button
                type="button"
                className="btn btn--md btn--secondary"
                onClick={() => window.showToast && window.showToast(`Edit panel — variant schema (${variantLabel.toLowerCase()})`)}
              >
                <Icon name="Edit" size={16} />Edit
              </button>
              <button type="button" className="iconbtn" aria-label="More" onClick={onMenu}>
                <Icon name="MoreVert" size={20} />
              </button>
            </React.Fragment>
          )}
        />
      ) : null}

      <div className="req-wf rdu-shell" style={{ maxWidth: 1200 }} data-screen-label={screenLabel || `${variantLabel} engagement`}>

        {hero ? (
          <div className="rdu-hero" style={{ margin: "16px 0" }}>
            <div>
              {chips.length > 0 ? (
                <div className="rdu-chip-row">
                  {chips.map((c, i) => (
                    <span
                      key={i}
                      className={`rdu-chip ${i === 0 ? chipClass : "rdu-chip--channel"}${c.kind === "preview" ? " rdu-chip--future" : ""}`}
                    >
                      {c.text}
                    </span>
                  ))}
                </div>
              ) : null}

              <h1 className="rdu-hero-title">{hero.title || title}</h1>
              <span className={`rdu-hero-status rdu-hero-status--${statusKey}`} style={hero.statusStyle || null}>
                {statusLabel}
              </span>

              {Array.isArray(hero.meta) && hero.meta.length > 0 ? (
                <dl className="rdu-hero-meta">
                  {hero.meta.map((m, i) => (
                    <React.Fragment key={i}>
                      <dt>{m.label}</dt>
                      <dd>{m.value}</dd>
                    </React.Fragment>
                  ))}
                </dl>
              ) : null}
            </div>

            {hero.art ? (
              <div className="rdu-hero-art" style={{ flexDirection: "column" }}>
                {hero.art}
              </div>
            ) : null}
          </div>
        ) : null}

        {Array.isArray(kpis) && kpis.length > 0 ? (
          <div className="rdu-kpi" style={{ margin: "0 0 16px" }}>
            {kpis.map((k, i) => (
              <div key={i} className="rdu-kpi-cell">
                <span className="rdu-kpi-lbl">{k.lbl}</span>
                <span className="rdu-kpi-val">{k.val}</span>
                {k.foot ? <span className="rdu-kpi-foot">{k.foot}</span> : null}
              </div>
            ))}
          </div>
        ) : null}

        {children}

        {/* Shared audit accordion · Decision 05 · every variant emits
            into AUDIT_ENTRIES with the manifest's declared scope so
            Compliance gets a cross-variant timeline. Auto-rendered by
            the shell when the manifest declares an audit scope. */}
        {Audit && manifest && manifest.audit && manifest.audit.scope && row ? (
          <Audit scope={manifest.audit.scope} target={row.id} />
        ) : null}
      </div>
    </React.Fragment>
  );
}

// ---------------------------------------------------------------------
// AccordionList — small composable for the manifest.accordions array.
// Variant bodies can use it directly, or hand-roll their accordion
// stack when they need richer content per row.
// ---------------------------------------------------------------------

function DetailAccordionList({ items }) {
  if (!Array.isArray(items) || items.length === 0) return null;
  return (
    <div className="rdu-acc">
      {items.map((it, i) => (
        <div className="rdu-acc-item" key={i}>
          <span className="rdu-acc-item-ic">{i + 1}</span>
          <span className="rdu-acc-item-title">
            {it.title}{it.sub ? <span className="rdu-acc-item-sub"> · {it.sub}</span> : null}
          </span>
          <span className={`rdu-acc-item-tag ${it.shared ? "rdu-acc-item-tag--shared" : "rdu-acc-item-tag--unique"}`}>
            {it.shared ? "Shared" : "Variant"}
          </span>
        </div>
      ))}
    </div>
  );
}

Object.assign(window, { DetailShell, DetailAccordionList });
