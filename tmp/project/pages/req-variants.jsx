// =====================================================================
// Flex Work — Unified detail · variant bodies (Contractor + SOW + EOR)
// ---------------------------------------------------------------------
// These are the variant bodies that plug into the unified router
// (pages/requisition-engagement-detail.jsx). After the Phase 1
// DetailShell extraction, each body owns ONLY its accordion content;
// the omnibar + hero + chip-row + menu come from <DetailShell/> which
// reads the manifest the router already carries.
//
//   Before (v0.6): every body hand-rolled its own omnibar, hero card,
//                  chip row, menu — manifest fields existed but were
//                  documentation only.
//   After  (v1.0): every body returns a <DetailShell manifest={…} …>
//                  with the variant's content as children. The shell
//                  composes the chrome from the manifest.
//
// FRONTLINE NOTE: the legacy RequisitionDetailsPage does NOT migrate to
// DetailShell — its byte-identity contract at all-flags-off requires
// the DOM to match the pre-unification baseline exactly. Migrating
// Frontline is a separate task that needs a snapshot test in the
// production codebase; see unified-req-detail-checklist.html.
// =====================================================================

const { useState: useStateRV, useMemo: useMemoRV } = React;

// ---------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------

function _rvToast(msg, opts) {
  if (window.showToast) window.showToast(msg, opts);
}
function _rvCurSymbol() {
  return (typeof window.curSymbol === "function") ? window.curSymbol() : "$";
}

// ---------------------------------------------------------------------
// Manifest lookup helper — variant bodies pull their own manifest off
// the registry so DetailShell can be passed a consistent reference.
// (The router passes the manifest as a prop too; the helper here keeps
// the bodies useful when mounted from elsewhere — e.g. tests, Storybook.)
// ---------------------------------------------------------------------
function _rvManifest(id) {
  if (window.VariantRegistry && window.VariantRegistry.list) {
    return window.VariantRegistry.list().find((m) => m.id === id) || null;
  }
  return null;
}

// ---------------------------------------------------------------------
// CONTRACTOR engagement body
// ---------------------------------------------------------------------

function ContractorEngagementBody({ requisitionId, onBack, manifest: manifestProp }) {
  const flagOn = window.getFeatureFlag && window.getFeatureFlag("contractors");
  if (!flagOn) {
    if (window.RequisitionDetailsPage) {
      return <window.RequisitionDetailsPage requisitionId={requisitionId} onBack={onBack} />;
    }
    return null;
  }

  const manifest = manifestProp || _rvManifest("contractor");
  const Shell    = window.DetailShell;
  const RiskPill = window.ContractorRiskPill;
  const Sections = window.ContractorDetailSections;

  const w = useMemoRV(() => {
    if (!requisitionId || !window.getContractorById) return null;
    return window.getContractorById(requisitionId) || null;
  }, [requisitionId]);

  if (!Shell) return null;

  // Not-found path renders the shell with an empty body so chrome stays
  // consistent across not-found states.
  if (!w) {
    return (
      <Shell
        manifest={manifest}
        row={{ id: requisitionId }}
        onBack={onBack}
        title="Engagement not found"
        screenLabel="Contractor engagement · not found"
      >
        <p style={{ color: "var(--evr-content-primary-lowemp)", margin: 24 }}>
          No contractor engagement matches <code>{requisitionId}</code>.
        </p>
      </Shell>
    );
  }

  const cur     = _rvCurSymbol();
  const labor   = w.costCenter || "CC-MKT-BRAND";
  const rate    = (w.rate != null) ? `${cur}${w.rate}/hr${w.capHours ? ` · capped ${w.capHours}h/mo` : ""}` : "—";
  const term    = w.term || (w.start && w.end ? `${w.start} – ${w.end}` : "—");
  const taxForm = w.taxForm || (w.country === "US" ? "W-9" : "W-8BEN");

  const meta = [
    { label: "Owner",          value: w.owner || "—" },
    { label: "Labor metric",   value: <code>{labor}</code> },
    { label: "Rate",           value: rate },
    { label: "Term",           value: term },
    { label: "Classification", value: (
      <React.Fragment>
        {w.classification || "—"}
        {RiskPill && w.riskScore != null
          ? <span style={{ marginLeft: 8 }}><RiskPill score={w.riskScore} /></span>
          : null}
      </React.Fragment>
    )},
    { label: "Tax form",       value: taxForm },
  ];

  const art = (
    <React.Fragment>
      <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: 0 }}>
        {w.riskScore != null ? `${100 - w.riskScore}` : "—"}
      </div>
      <small style={{ fontSize: 10, letterSpacing: 0 }}>classification score</small>
    </React.Fragment>
  );

  return (
    <Shell
      manifest={manifest}
      row={w}
      onBack={onBack}
      title={`Engagement · ${w.name || requisitionId}`}
      status={<span className="req-pill req-pill--success">Active</span>}
      screenLabel="Contractor engagement"
      hero={{
        title: w.name || "Contractor engagement",
        statusKey: "active",
        statusLabel: "Active",
        meta,
        art,
      }}
    >
      {Sections ? <Sections w={w} /> : (
        <p style={{ color: "var(--evr-content-primary-lowemp)" }}>
          Contractor detail sections not loaded.
        </p>
      )}
    </Shell>
  );
}

// ---------------------------------------------------------------------
// SOW engagement body
// ---------------------------------------------------------------------

function SowEngagementBody({ requisitionId, onBack, manifest: manifestProp }) {
  const flagOn = window.getFeatureFlag && window.getFeatureFlag("sow");
  if (!flagOn) {
    if (window.RequisitionDetailsPage) {
      return <window.RequisitionDetailsPage requisitionId={requisitionId} onBack={onBack} />;
    }
    return null;
  }

  const manifest = manifestProp || _rvManifest("sow");
  const Shell    = window.DetailShell;
  const AccList  = window.DetailAccordionList;

  const sow = useMemoRV(() => {
    if (!requisitionId || !window.getSOWById) return null;
    return window.getSOWById(requisitionId) || null;
  }, [requisitionId]);

  if (!Shell) return null;

  if (!sow) {
    return (
      <Shell
        manifest={manifest}
        row={{ id: requisitionId }}
        onBack={onBack}
        title="SOW not found"
        screenLabel="SOW agreement · not found"
      >
        <p style={{ color: "var(--evr-content-primary-lowemp)", margin: 24 }}>
          No SOW agreement matches <code>{requisitionId}</code>.
        </p>
      </Shell>
    );
  }

  const fmt          = window.sowFmtMoney    || ((n, c) => `${c || _rvCurSymbol()} ${Math.round(n).toLocaleString()}`);
  const statusMeta   = (window.sowStatusMeta && window.sowStatusMeta(sow.status)) || null;
  const milestones   = (window.getSOWMilestones && window.getSOWMilestones(sow.id)) || [];
  const deliverables = (window.getSOWDeliverables && window.getSOWDeliverables(sow.id)) || [];
  const resources    = (window.getSowResourceWorkers && window.getSowResourceWorkers().filter((w) => w.sowId === sow.id)) || [];
  const billed       = (sow.consumed != null) ? sow.consumed : (sow.billed || 0);
  const committed    = sow.committed || sow.totalValue || 0;
  const burnPct      = committed > 0 ? Math.round((billed / committed) * 100) : 0;
  const currency     = sow.currency || "USD";
  const msComplete   = milestones.filter((m) => m.status === "Accepted" || m.status === "Paid").length;
  const dlAccepted   = deliverables.filter((d) => d.status === "Accepted" || d.status === "Signed off").length;
  const changeOrders = sow.changeOrders || 0;

  const meta = [
    { label: "Supplier",       value: (sow.supplier && sow.supplier.label) || "—" },
    { label: "Total value",    value: fmt(committed, currency) },
    { label: "Billed to date", value: fmt(billed, currency) },
    { label: "Term",           value: sow.startDate && sow.endDate ? `${sow.startDate} – ${sow.endDate}` : "—" },
    { label: "Owner",          value: sow.owner || "—" },
    { label: "Engagement model",  value: (window.sowBillingLabel && window.sowBillingLabel(sow.billingModel)) || sow.billingModel || "—" },
  ];

  const art = (
    <React.Fragment>
      <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: 0 }}>{burnPct}%</div>
      <small style={{ fontSize: 10, letterSpacing: 0 }}>burn</small>
    </React.Fragment>
  );

  const kpis = [
    { lbl: "Milestones",    val: `${msComplete} / ${milestones.length || 0}`,   foot: "complete" },
    { lbl: "Deliverables",  val: `${dlAccepted} / ${deliverables.length || 0}`, foot: "accepted" },
    { lbl: "Resources",     val: `${resources.length}`,                          foot: "on SOW"  },
    { lbl: "Change orders", val: `${changeOrders}`,                              foot: "approved" },
  ];

  return (
    <Shell
      manifest={manifest}
      row={sow}
      onBack={onBack}
      title={`SOW · ${sow.id}`}
      status={statusMeta ? (
        <span className="req-pill" style={{ color: statusMeta.fg, background: statusMeta.bg }}>
          {statusMeta.label}
        </span>
      ) : null}
      screenLabel="SOW agreement"
      hero={{
        title: sow.name || `SOW ${sow.id}`,
        statusKey: "burning",
        statusLabel: statusMeta ? statusMeta.label : sow.status,
        statusStyle: statusMeta ? { background: statusMeta.bg, color: statusMeta.fg } : null,
        meta,
        art,
      }}
      kpis={kpis}
    >
      {window.SowDetailSections ? (
        <window.SowDetailSections sow={sow} />
      ) : (
        <React.Fragment>
          {AccList ? <AccList items={[
            { title: "Agreement",      sub: "MSA · SOW · terms · attachments" },
            { title: "Burn & budget",  sub: `${fmt(billed, currency)} billed of ${fmt(committed, currency)} · ${burnPct}%` },
            { title: "Resources",      sub: `${resources.length} supplier-assigned` },
            { title: "Milestones",     sub: `${msComplete} of ${milestones.length || 0} complete` },
            { title: "Deliverables",   sub: `${dlAccepted} of ${deliverables.length || 0} accepted` },
            { title: "Change orders",  sub: `${changeOrders} approved` },
            { title: "Invoices",       sub: "One per milestone" },
            { title: "Audit",          sub: "Every status, every change", shared: true },
          ]} /> : null}

          <div
            style={{
              margin: "16px 0 0",
              padding: "12px 16px",
              background: "var(--evr-surface-secondary-default)",
              border: "1px solid var(--evr-border-decorative-lowemp)",
              borderRadius: "var(--evr-radius-2xs)",
              color: "var(--evr-content-primary-lowemp)",
              fontSize: 13,
            }}
          >
            The authoritative SOW surface is the Suppliers → Contract page; the unified detail
            renders the agreement summary above and links out for deep-edit flows.
          </div>
        </React.Fragment>
      )}
    </Shell>
  );
}

// ---------------------------------------------------------------------
// EOR engagement body — preview / plug-in pattern proof
// ---------------------------------------------------------------------

function EorEngagementBody({ requisitionId, onBack, manifest: manifestProp }) {
  const flagOn = window.getFeatureFlag && window.getFeatureFlag("eor");
  if (!flagOn) {
    if (window.RequisitionDetailsPage) {
      return <window.RequisitionDetailsPage requisitionId={requisitionId} onBack={onBack} />;
    }
    return null;
  }

  const manifest = manifestProp || _rvManifest("eor");
  const Shell    = window.DetailShell;
  const AccList  = window.DetailAccordionList;

  const row = useMemoRV(() => ({
    id:           requisitionId || "EOR-PREVIEW",
    name:         "Sofia López · senior platform engineer · Mexico",
    eorPartner:   "Velocity Global",
    country:      "Mexico",
    localEntity:  "VG MX S. de R.L. de C.V.",
    billCurrency: "USD",
    payCurrency:  "MXN",
    fxLockDate:   "2026-06-15",
    localGross:   "MXN 78,400 / month",
    billRate:     "$8,400 USD / month",
    startDate:    "Jul 1, 2026",
    endDate:      "Jun 30, 2027",
    owner:        "Robin Chen",
  }), [requisitionId]);

  if (!Shell) return null;

  const meta = [
    { label: "EOR partner",    value: row.eorPartner },
    { label: "Local entity",   value: row.localEntity },
    { label: "Country",        value: row.country },
    { label: "Bill currency",  value: `${row.billCurrency} · billed to buyer` },
    { label: "Pay currency",   value: `${row.payCurrency} · ${row.localGross}` },
    { label: "FX lock",        value: row.fxLockDate },
    { label: "Term",           value: `${row.startDate} – ${row.endDate}` },
    { label: "Owner",          value: row.owner },
  ];

  const art = (
    <React.Fragment>
      <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: 0 }}>{row.billRate}</div>
      <small style={{ fontSize: 10, letterSpacing: 0 }}>bill rate</small>
    </React.Fragment>
  );

  // EOR's chip row has an extra "Preview" chip — splice it into the
  // manifest's declared chips so DetailShell renders all three.
  const previewManifest = manifest ? {
    ...manifest,
    chips: [
      ...(manifest.chips || []),
      { kind: "preview", text: "Preview" },
    ],
  } : manifest;

  return (
    <Shell
      manifest={previewManifest}
      row={row}
      onBack={onBack}
      title={`EOR · ${row.id}`}
      status={<span className="req-pill req-pill--success">Active</span>}
      screenLabel="EOR engagement"
      hero={{
        title: row.name,
        statusKey: "active",
        statusLabel: "Active",
        meta,
        art,
      }}
    >
      {AccList ? <AccList items={[
        { title: "Engagement",                                          sub: "role · description · local terms" },
        { title: "Local entity",                                        sub: `${row.eorPartner} · ${row.localEntity}` },
        { title: "In-country employment",                               sub: "local benefits · statutory leave · termination terms" },
        { title: "Global tax & SI",                                     sub: "employer SI · local income tax · double-tax treaty" },
        { title: `Currency & FX (lock ${row.fxLockDate})`,              sub: `bill ${row.billCurrency} · pay ${row.payCurrency}` },
        { title: "Repatriation",                                        sub: "end-of-engagement obligations" },
        { title: "Audit",                                               sub: "every status, every change", shared: true },
      ]} /> : null}

      <div
        style={{
          margin: "16px 0 0",
          padding: "12px 16px",
          background: "var(--evr-surface-decorative-default-yellow)",
          border: "1px solid var(--evr-content-decorative-yellow)",
          borderRadius: "var(--evr-radius-2xs)",
          color: "var(--evr-content-status-warning-highemp)",
          fontSize: 13,
        }}
      >
        <b>Preview variant.</b> The EOR body is registered behind the <code>eor</code> flag to prove the plug-in
        contract — one manifest, one register call, zero edits to Frontline / Professional / Contractor / SOW. Production
        EOR (local entity, in-country employment, global tax & SI, FX lock) lands after Phase 5 of the spec.
      </div>
    </Shell>
  );
}

// ---------------------------------------------------------------------
// Expose to window so the router can pick them up at registration time.
// ---------------------------------------------------------------------

Object.assign(window, {
  ContractorEngagementBody,
  SowEngagementBody,
  EorEngagementBody,
});
