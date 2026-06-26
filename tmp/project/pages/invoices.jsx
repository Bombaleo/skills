// =====================================================================
// Flex Work — Invoices
//   · InvoicesPage         — searchable list w/ table (reuses req-table)
//   · InvoiceDetailsPage   — paper-style invoice detail view
// =====================================================================

const { useState: useStateInv, useMemo: useMemoInv } = React;

// ---------- Mock data ----------------------------------------------------
// Suppliers reuse REQ_SUPPLIERS from req-shared. Status values mirror the
// Figma spec: Generated · Issued · Paid · Overdue.

// Each invoice's supplier is one of the suppliers listed on the linked
// requisition, and the billing contact stays consistent per supplier
// (sw→Jessica Adams, th→Marcus Aragón, ph→Priya Hayes, ss→Sami Soto,
// gs→Gemma Stack). Line items below pull workers from that supplier's
// roster so the paper invoice cross-references the workforce correctly.
const INVOICES_BASE = [
  { id: "A1B2C3D4", req: "Req J6K7L8M9N0", supplier: "sw", contact: "Jessica Adams",  status: "Generated", locations: ["Warehouse #35"],             more: 2, hours: "150:30", amount: "$1,295.66", invDate: "11.01.2025", dueDate: "12.11.2025" },
  { id: "B2C3D4E5", req: "Req Y1Z2A3B4C5", supplier: "th", contact: "Marcus Aragón",  status: "Issued",    locations: ["Storage Facility Beta"],     amount: "$734.50",   invDate: "02.13.2026", dueDate: "03.25.2026" },
  { id: "C3D4E5F6", req: "Req E1F2G3H4I5", supplier: "ph", contact: "Priya Hayes",    status: "Issued",    locations: ["Logistics Hub Alpha"],       amount: "$2,108.00", invDate: "03.05.2026", dueDate: "04.14.2026" },
  { id: "D4E5F6G7", req: "Req K1L2M3N4O5", supplier: "sw", contact: "Jessica Adams",  status: "Generated", locations: ["Inventory Warehouse Kappa"], amount: "$945.20",   invDate: "04.27.2026", dueDate: "06.06.2026" },
  { id: "E5F6G7H8", req: "Req U1V2W3X4Y5", supplier: "ss", contact: "Sami Soto",      status: "Paid",      locations: ["Supply Chain Nexus"],        more: 3, amount: "$4,612.40", invDate: "08.02.2025", dueDate: "09.11.2025" },
  { id: "F6G7H8I9", req: "Req T6U7V8W9X0", supplier: "th", contact: "Marcus Aragón",  status: "Overdue",   locations: ["Freight Terminal Delta"],    more: 4, amount: "$3,521.18", invDate: "06.27.2025", dueDate: "08.06.2025" },
  { id: "G7H8I9J0", req: "Req O1P2Q3R4S5", supplier: "ph", contact: "Priya Hayes",    status: "Issued",    locations: ["Distribution Center Alpha"], amount: "$612.05",   invDate: "08.11.2025", dueDate: "09.20.2025" },
  { id: "H8I9J0K1", req: "Req M5N6O7P8Q9", supplier: "sw", contact: "Jessica Adams",  status: "Paid",      locations: ["Warehouse #14"],             amount: "$1,873.92", invDate: "01.15.2026", dueDate: "02.24.2026" },
  { id: "I9J0K1L2", req: "Req D6E7F8G9H0", supplier: "ph", contact: "Priya Hayes",    status: "Generated", locations: ["Inventory Warehouse Kappa"], amount: "$528.75",   invDate: "07.04.2025", dueDate: "08.13.2025" },
  { id: "J0K1L2M3", req: "Req F6G7H8I9J0", supplier: "ph", contact: "Priya Hayes",    status: "Issued",    locations: ["Shipping Dock Theta"],       more: 2, amount: "$1,029.40", invDate: "11.23.2025", dueDate: "01.02.2026" },
  { id: "K1L2M3N4", req: "Req B5C6D7E8F9", supplier: "sw", contact: "Jessica Adams",  status: "Paid",      locations: ["Logistics Hub Alpha"],       amount: "$2,415.00", invDate: "12.11.2025", dueDate: "01.20.2026" },
  { id: "L2M3N4O5", req: "Req X6Y7Z8A9B0", supplier: "th", contact: "Marcus Aragón",  status: "Overdue",   locations: ["Freight Terminal Delta"],    amount: "$847.60",   invDate: "04.12.2026", dueDate: "05.22.2026" },
];

// ---------- EOR variant -------------------------------------------------
// Loaded into the list when the `eor` supplier type is enabled. The EOR
// provider issues local employment + remits payroll tax, then bills the
// buyer back at a loaded rate. So the supplier on the invoice IS the
// EOR provider — the existing supplier-chip rendering already resolves
// the Velocity EOR / GlobalPay EOR / BorderlessWork brand.
//
// Engagement-type alignment (v0.79):
//   · EOR is a *supplier type*, not an engagement type — these rows
//     are canonically Assignment-shaped (named worker on a dated
//     engagement, billed Hourly with Time Tracking). The Engagement
//     Type column resolves "EOR" → "Assignment" via ENG_TYPE_ALIAS so
//     the chip lines up with the matrix in ENG_TYPE_OPTIONS, while the
//     legacy "EOR" tag still drives the source filter + payload route.
//     `_engKind: "shift"` keeps the existing paper-doc renderer.
const INVOICES_EOR = [
  { id: "EOR91M3K2", req: "Engagement w-iv", supplier: "evp", contact: "Marisol Pérez",   status: "Generated", locations: ["Bogotá · Colombia"], amount: "$4,820.00", hours: "168:00", invDate: "05.02.2026", dueDate: "05.16.2026", engagementType: "EOR", billingBasis: "Hourly", timeCapture: "Time Tracking", supplierTypes: ["EOR"], _engKind: "shift", workerId: "w-iv" },
  { id: "EOR90P1Q2", req: "Engagement w-lk", supplier: "gpe", contact: "Tomasz Nowak",    status: "Issued",    locations: ["Kraków · Poland"],   amount: "$3,640.00", hours: "164:00", invDate: "04.21.2026", dueDate: "05.05.2026", engagementType: "EOR", billingBasis: "Hourly", timeCapture: "Time Tracking", supplierTypes: ["EOR"], _engKind: "shift", workerId: "w-lk" },
  { id: "EOR89X2Y3", req: "Engagement w-pm", supplier: "evp", contact: "Marisol Pérez",   status: "Paid",      locations: ["Pune · India"],      amount: "$2,180.00", hours: "180:00", invDate: "03.30.2026", dueDate: "04.13.2026", engagementType: "EOR", billingBasis: "Hourly", timeCapture: "Time Tracking", supplierTypes: ["EOR"], _engKind: "shift", workerId: "w-pm" },
  { id: "EOR88Z4A5", req: "Engagement w-na", supplier: "bwk", contact: "Camila Souza",    status: "Overdue",   locations: ["São Paulo · Brazil"],amount: "$1,925.50", hours: " 88:00", invDate: "03.07.2026", dueDate: "03.21.2026", engagementType: "EOR", billingBasis: "Hourly", timeCapture: "Time Tracking", supplierTypes: ["EOR"], _engKind: "shift", workerId: "w-na" },
];
// ---------- Temp-spend tier scaling -------------------------------------
// Inflate / shrink the invoice list. Preserve the IDs referenced by
// APPROVALS / dashboard activity so deep links from "approve this
// invoice" cards always resolve.
const INVOICES = (window.inflateList || ((b) => b.slice()))(INVOICES_BASE, {
  preserveIds: ["D4E5F6G7", "F6G7H8I9", "H8I9J0K1", "G7H8I9J0"],
  minRows: 6,
  maxRows: 220,
  makeClone: (src, n) => {
    // Re-roll a fresh A-Z/0-9 invoice id and a fresh req anchor.
    const newInv = window._reqClonedId ? window._reqClonedId(src.id, n).slice(0, 8) : `${src.id}-${n}`;
    const newReq = window._reqClonedId ? window._reqClonedId(src.req + n, n + 7) : `${src.req}-${n}`;
    return { id: newInv, req: `Req ${newReq}` };
  },
});

// When the active tenant is a staffing agency, scope invoices to just
// the ones owned by this agency (matched by supplier id).
(() => {
  const sup = window.getAgencySupplierId && window.getAgencySupplierId();
  if (sup) {
    for (let i = INVOICES.length - 1; i >= 0; i--) {
      if (INVOICES[i].supplier !== sup) INVOICES.splice(i, 1);
    }
  }
})();

const INV_PAGE_SIZE = 10;

// ---------- Status pill --------------------------------------------------
const INV_STATUS_HUES = {
  "Generated": "default",
  "Issued":    "informative",
  "Paid":      "success",
  "Overdue":   "error",
};

function InvoiceStatusPill({ status }) {
  const hue = INV_STATUS_HUES[status] || "default";
  return (
    <span className={`req-pill req-pill--${hue}`}>
      {status === "Overdue" && (
        <span className="req-pill-icon" aria-hidden="true">
          <Icon name="Alert" size={12} />
        </span>
      )}
      {status}
    </span>
  );
}

// ---------- Supplier-funding banner (list page) -------------------------
// Sits between the contractor banner and the toolbar when the program
// is supplier-funded. Reads the live program config so the percentage,
// method, and effective date track the Configuration page in realtime.
// v0.79 — driven by Configuration → Program (no longer a feature flag).
function SfBanner() {
  const pf   = window.useProgramFunding
    ? window.useProgramFunding()
    : ((window.getProgramFunding && window.getProgramFunding()) || null);
  if (!pf || !pf.supplierFunding) return null;
  const covered = Object.entries(pf.coverage || {})
    .filter(([_, v]) => v)
    .map(([k]) => ({ frontline: "Frontline", professional: "Professional", sow: "SOW", contractor: "Contractor" }[k]))
    .filter(Boolean);
  return (
    <div className="pw-info-banner sf-info-banner" role="note">
      <span className="pw-info-banner-icon" aria-hidden="true">
        <Icon name="Wallet" size={14} />
      </span>
      <span className="pw-info-banner-text">
        <b>This program is supplier&#8209;funded.</b>
        <span>
          {" "}A <strong>{pf.feePct}% {pf.invoiceLabel || "program fee"}</strong> is
          {pf.method === "Markup" ? " added on top of " : " deducted from "}
          every supplier invoice across <strong>{covered.length ? covered.join(" · ") : "selected"}</strong> engagements,
          effective <strong>{pf.effectiveDate}</strong>. This is the program standard&#8202;—&#8202;each agency can negotiate
          its own rate (0&#8211;{pf.feePct}%), shown on the agency&apos;s detail page and applied to its invoices.
          Change the model or per&#8209;agency rates in{" "}
          <a href="#" onClick={(e) => { e.preventDefault(); window.flexGoTo && window.flexGoTo({ page: "settings", sub: "configuration" }); }}>Settings &rarr; Configuration &rarr; Program funding</a>.
        </span>
      </span>
    </div>
  );
}

// ---------- Toolbar — search + adjust / import / export / more ----------
function InvoicesToolbar({ query, onQuery }) {
  return (
    <div className="inv-toolbar">
      <div className="inv-search">
        <span className="inv-search-icon" aria-hidden="true">
          <Icon name="Search" size={24} />
        </span>
        <input
          type="search"
          className="inv-search-input"
          placeholder="Search for invoice, supplier, site"
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          aria-label="Search invoices"
        />
      </div>
      <div className="inv-toolbar-actions">
        <button
          type="button"
          className="iconbtn"
          aria-label="Adjust columns"
          title="Adjust columns"
          onClick={(e) => openMenu(e.currentTarget, [
            { icon: "View",    label: "Invoice",   onClick: () => showToast("Invoice column is required") },
            { icon: "View",    label: "Supplier",  onClick: () => showToast("Supplier hidden") },
            { icon: "View",    label: "Status",    onClick: () => showToast("Status hidden") },
            { icon: "View",    label: "Sites", onClick: () => showToast("Sites hidden") },
            { icon: "View",    label: "Amount",    onClick: () => showToast("Amount hidden") },
          ])}
        >
          <Icon name="Adjustment" size={20} />
        </button>
        <button
          type="button"
          className="iconbtn"
          aria-label="Import"
          title="Import"
          onClick={() => showToast("Choose a CSV to import", { action: { label: "Browse", onClick: () => showToast("File picker opened (preview)") } })}
        >
          <Icon name="Import" size={20} />
        </button>
        <button
          type="button"
          className="iconbtn"
          aria-label="Export"
          title="Export"
          onClick={(e) => openMenu(e.currentTarget, [
            { icon: "Excel",  label: "Export to CSV",  onClick: () => showToast("Exporting invoices.csv", { kind: "success" }) },
            { icon: "PDF",    label: "Export to PDF",  onClick: () => showToast("Exporting invoices.pdf", { kind: "success" }) },
            { icon: "Print",  label: "Print",          onClick: () => showToast("Sent to printer") },
          ])}
        >
          <Icon name="Export" size={20} />
        </button>
        <button
          type="button"
          className="iconbtn"
          aria-label="More actions"
          title="More"
          onClick={(e) => openMenu(e.currentTarget, toolbarMenuItems())}
        >
          <Icon name="MoreVert" size={20} />
        </button>
      </div>
    </div>
  );
}

// ---------- Row ----------------------------------------------------------
function InvoiceRow({ row, checked, onToggle, onOpen, vc }) {
  const show = (id) => !vc || vc.showCol(id);
  const rowMenu = (e) => {
    e.stopPropagation();
    openMenu(e.currentTarget, [
      { icon: "View",         label: "View invoice",     onClick: () => onOpen && onOpen(row.id) },
      { icon: "Pay",          label: "Mark as paid",     onClick: () => openConfirm({
          title: `Mark INV-${row.id} as paid?`,
          body:  `${row.amount} from ${(REQ_SUPPLIERS[row.supplier] || {}).label || row.supplier} will be marked paid and removed from your accounts payable.`,
          primaryLabel: "Mark paid",
          onConfirm: () => showToast(`INV-${row.id} marked paid`, { kind: "success" }),
        }) },
      { icon: "FileDownload", label: "Download PDF",     onClick: () => showToast(`Downloading INV-${row.id}.pdf`) },
      { icon: "Copy",         label: "Duplicate invoice" },
      { divider: true },
      { icon: "TrashCan",     label: "Delete invoice",   danger: true,
        onClick: () => openConfirm({
          title: `Delete INV-${row.id}?`,
          body:  "This action cannot be undone.",
          primaryLabel: "Delete",
          primaryKind: "primary",
          onConfirm: () => showToast(`INV-${row.id} deleted`, { kind: "success" }),
        }) },
    ]);
  };
  return (
    <div
      className="req-row inv-row req-row--clickable"
      role="row"
      tabIndex={0}
      style={vc && vc.gridStyle}
      onClick={(e) => {
        if (e.target.closest("input,a,button")) return;
        onOpen && onOpen(row.id);
      }}
      onKeyDown={(e) => { if (e.key === "Enter") onOpen && onOpen(row.id); }}
    >
      <div className="req-cell req-cell--check" role="cell">
        <input
          type="checkbox"
          checked={checked}
          onChange={onToggle}
          aria-label={`Select ${row.id}`}
        />
      </div>
      {show("invoice") && (
        <div className="req-cell inv-cell--invoice" role="cell">
          <span className="inv-invoice-id tabular">INV-{row.id}</span>
          <span className="inv-invoice-sub">
            {row.req}
          </span>
        </div>
      )}
      {show("supplier") && (
        <div className="req-cell inv-cell--supplier" role="cell">
          {row.engagementType === "Contractor" ? (
            <React.Fragment>
              <span className="inv-contractor-avatar" aria-hidden="true">
                <Icon name="PersonAuthorize" size={16} />
              </span>
              <span className="inv-supplier-name">{row.contact || "Contractor"}</span>
            </React.Fragment>
          ) : (
            <React.Fragment>
              <ReqSupplierChip id={row.supplier} size={28} />
              <span className="inv-supplier-name">{(REQ_SUPPLIERS[row.supplier] || {}).label || row.supplier}</span>
            </React.Fragment>
          )}
        </div>
      )}
      {show("status") && (
        <div className="req-cell inv-cell--status" role="cell">
          <InvoiceStatusPill status={row.status} />
        </div>
      )}
      {show("locations") && (
        <div className="req-cell inv-cell--locations" role="cell">
          {row.locations.map((l, i) => <span key={i} className="req-chip">{l}</span>)}
          {row.more && <span className="req-chip">{`${row.more} more`}</span>}
        </div>
      )}
      {show("amount") && (
        <div className="req-cell inv-cell--amount" role="cell">
          <span className="req-bill tabular">{row.amount}</span>
        </div>
      )}
      {show("engagementType") && (
        <div className="req-cell req-cell--engtype" role="cell">
          {window.EngagementType
            ? <window.EngagementType.EngagementTypeCell row={row} id={row.id} />
            : null}
        </div>
      )}
      {show("billingBasis") && (
        <div className="req-cell req-cell--v77em" role="cell">
          {window.V77Cols ? <span className="v77-bm">{window.V77Cols.billingBasisOf(row, row.id)}</span> : null}
        </div>
      )}
      {show("timeCapture") && (
        <div className="req-cell req-cell--v77tc" role="cell">
          {window.V77Cols ? <span className="v77-tc">{window.V77Cols.timeCaptureOf(row, row.id)}</span> : null}
        </div>
      )}
      {show("supplierTypes") && (
        <div className="req-cell req-cell--v77st" role="cell">
          {window.V77Cols ? window.V77Cols.supplierTypesOf(row, row.id).map((t) => (
            <span className="v77-st" key={t}>{t}</span>
          )) : null}
        </div>
      )}
      <div className="req-cell inv-cell--chev" role="cell">
        <button
          type="button"
          className="icon-btn"
          aria-label={`Actions for INV-${row.id}`}
          onClick={rowMenu}
        >
          <Icon name="MoreVert" size={18} />
        </button>
      </div>
    </div>
  );
}

// ---------- Header cell --------------------------------------------------
function InvHeaderCell({ children, className = "" }) {
  return (
    <div className={`req-cell ${className}`} role="columnheader">
      <span>{children}</span>
      <span className="req-sort" aria-hidden="true" title="Sort">
        <Icon name="ArrowsUpDownSmall" size={14} />
      </span>
    </div>
  );
}

// ---------- Table --------------------------------------------------------
function InvoicesTable({ rows, total, page, totalPages, onPageChange, pageSize, onPageSizeChange, onOpenRow, f, statusTab, onStatusTab, statusCounts }) {
  const [selected, setSelected] = useStateInv(() => new Set());
  const allChecked = rows.length > 0 && rows.every((r) => selected.has(r.id));
  // Filter chip options — scoped to this component so the JSX below
  // resolves cleanly. Both helpers return [] when their module is off.
  const v77ColsOn = window.V77Cols && window.V77Cols.isOn();
  const bbOpts = v77ColsOn ? window.V77Cols.billingBasisOpts() : [];
  const tcOpts = v77ColsOn ? window.V77Cols.timeCaptureOpts()  : [];
  const stOpts = v77ColsOn ? window.V77Cols.supplierTypeOpts() : [];
  const etOn   = window.EngagementType && window.EngagementType.isOn();
  const etOpts = etOn ? window.EngagementType.enabledTypes() : [];
  const sowOn = window.useFeatureFlag ? window.useFeatureFlag("sow") : false;
  const contractorsOn = window.useFeatureFlag ? window.useFeatureFlag("contractors") : false;
  // Source filter shows up when ANY non-frontline source is on. Options
  // include only the flags currently enabled so the chip popover never
  // lists a source the user can't actually see in their data.
  const sourceOpts = ["Frontline"];
  if (sowOn)         sourceOpts.push("SOW");
  if (contractorsOn) sourceOpts.push("Contractor");
  const showSource = sourceOpts.length > 1;

  const toggle = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const toggleAll = () => {
    setSelected((prev) => {
      if (allChecked) {
        const next = new Set(prev);
        rows.forEach((r) => next.delete(r.id));
        return next;
      }
      const next = new Set(prev);
      rows.forEach((r) => next.add(r.id));
      return next;
    });
  };

  // -- Bulk actions unique to Invoices ----------------------------------
  // AP-side jobs-to-be-done: settle a stack of issued invoices, ship to
  // ERP, raise a dispute with the supplier, or pull a packet of PDFs
  // for end-of-week reconciliation. The money-touching actions surface
  // as primary; destructive ones live behind the More menu.
  const bulkActInv = (msg, kind = "success") => {
    if (window.showToast) window.showToast(msg, { kind });
    setSelected(new Set());
  };
  const nInv = selected.size;
  const nounInv = "invoice";
  const sumInv = `${nInv} ${nInv === 1 ? nounInv : nounInv + "s"}`;
  const totalAmount = useMemoInv(() => {
    if (!nInv) return 0;
    return rows
      .filter((r) => selected.has(r.id))
      .reduce((s, r) => s + (parseFloat(String(r.amount).replace(/[^0-9.\-]/g, "")) || 0), 0);
  }, [selected, rows]);
  const fmtMoney = (v) => "$" + v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const invHint = nInv ? `${fmtMoney(totalAmount)} total` : null;

  const bulkActionsInv = [
    { icon: "Check",        label: "Mark paid",   onClick: () => bulkActInv(`Marked ${sumInv} as paid (${fmtMoney(totalAmount)})`) },
    { icon: "Send",         label: "Send to AP",  onClick: () => bulkActInv(`Sent ${sumInv} to AP for processing`) },
    { icon: "FileDownload", label: "Download PDFs", onClick: () => bulkActInv(`Bundled ${sumInv} as a ZIP — check downloads`) },
    { icon: "Adjustment",   label: "Dispute",     onClick: () => bulkActInv(`Opened dispute on ${sumInv}`, "warning") },
    { divider: true },
    { icon: "TrashCan",     label: "Void",        onClick: () => bulkActInv(`Voided ${sumInv}`, "warning"), kind: "danger" },
  ];
  const bulkOverflowInv = [
    { icon: "Print",   label: "Print remittance",    onClick: () => bulkActInv(`Printing remittance for ${sumInv}`) },
    { icon: "Notes",   label: "Attach note to AP",   onClick: () => bulkActInv(`Note attached to ${sumInv}`) },
    { icon: "TimeUndo", label: "Defer to next cycle",onClick: () => bulkActInv(`${sumInv} deferred to next pay cycle`, "info") },
  ];
  const supplierOpts = Array.from(new Set(INVOICES.map((i) => REQ_SUPPLIERS[i.supplier]?.label).filter(Boolean))).sort();
  const locationOpts = Array.from(new Set(INVOICES.flatMap((i) => i.locations))).sort();
  const dateOpts     = ["This month", "Last month", "Last quarter", "This year"];

  // ---- View customizer ------------------------------------------------
  const invVcManifest = React.useMemo(() => {
    const columns = [
      { id: "invoice",   label: "Invoice",   width: "minmax(180px, 1fr)" },
      { id: "supplier",  label: "Supplier",  width: "minmax(180px, 1.1fr)" },
      { id: "status",    label: "Status",    width: "140px" },
      { id: "locations", label: "Sites", width: "minmax(220px, 1.4fr)" },
      { id: "amount",    label: "Amount",    width: "140px" },
    ];
    if (etOn && etOpts.length > 1) columns.push({ id: "engagementType", label: "Engagement type", width: "140px" });
    if (v77ColsOn) {
      columns.push({ id: "billingBasis",  label: "Billing basis",  width: "140px" });
      columns.push({ id: "timeCapture",   label: "Time capture",   width: "140px" });
      columns.push({ id: "supplierTypes", label: "Supplier types", width: "180px" });
    }
    const filters = [
      { id: "supplier",  label: "Supplier" },
      { id: "locations", label: "Sites" },
      { id: "date",      label: "Date" },
    ];
    if (showSource)               filters.push({ id: "source",         label: "Source" });
    if (bbOpts.length > 1)        filters.push({ id: "billingBasis",   label: "Billing basis" });
    if (tcOpts.length > 1)        filters.push({ id: "timeCapture",    label: "Time capture" });
    if (etOn && etOpts.length > 1) filters.push({ id: "engagementType", label: "Engagement type" });
    if (stOpts.length > 1)        filters.push({ id: "supplierTypes",  label: "Supplier types" });
    return { columns, filters };
  }, [v77ColsOn, etOn, etOpts.length, bbOpts.length, tcOpts.length, stOpts.length, showSource]);
  const vc = useViewCustomizer("invoices", invVcManifest);
  const invGridStyle = vc.gridStyle
    ? { gridTemplateColumns: `44px ${vc.gridStyle.gridTemplateColumns} 32px` }
    : undefined;
  const vcRow = { ...vc, gridStyle: invGridStyle };

  return (
    <React.Fragment>
    <div className="req-table-card inv-table-card" role="table" aria-label="Invoices">
      {/* Filter bar */}
      <div className="req-filters">
        <div className="req-filters-left">
          {vc.showFilter("supplier")  && <FilterChip label="Supplier"  active={f.filters.supplier.length > 0}  count={f.filters.supplier.length}  onClick={f.openFor("supplier",  "Supplier",  supplierOpts)} />}
          {vc.showFilter("locations") && <FilterChip label="Sites" active={f.filters.locations.length > 0} count={f.filters.locations.length} onClick={f.openFor("locations", "Locations", locationOpts)} />}
          {vc.showFilter("date")      && <FilterChip label="Date"      active={f.filters.date.length > 0}      count={f.filters.date.length}      onClick={f.openFor("date",      "Date",      dateOpts)} />}
          {vc.showFilter("source") && showSource && (
            <FilterChip
              label="Source"
              active={!!f.filters.source && f.filters.source.length > 0}
              count={f.filters.source ? f.filters.source.length : 0}
              onClick={f.openFor("source", "Engagement source", sourceOpts)}
            />
          )}
          {vc.showFilter("billingBasis") && bbOpts.length > 1 && (
            <FilterChip
              label="Billing basis"
              active={f.filters.billingBasis.length > 0}
              count={f.filters.billingBasis.length}
              onClick={f.openFor("billingBasis", "Billing basis", bbOpts)}
            />
          )}
          {vc.showFilter("timeCapture") && tcOpts.length > 1 && (
            <FilterChip
              label="Time capture"
              active={f.filters.timeCapture.length > 0}
              count={f.filters.timeCapture.length}
              onClick={f.openFor("timeCapture", "Time capture", tcOpts)}
            />
          )}
          {vc.showFilter("engagementType") && etOn && etOpts.length > 1 && (
            <FilterChip
              label="Engagement type"
              active={f.filters.engagementType.length > 0}
              count={f.filters.engagementType.length}
              onClick={f.openFor("engagementType", "Engagement type", etOpts)}
            />
          )}
          {vc.showFilter("supplierTypes") && stOpts.length > 1 && (
            <FilterChip
              label="Supplier types"
              active={f.filters.supplierTypes.length > 0}
              count={f.filters.supplierTypes.length}
              onClick={f.openFor("supplierTypes", "Supplier types", stOpts)}
            />
          )}
        </div>
        <div className="req-filters-right">
          {f.hasAny && (
            <React.Fragment>
              <span className="req-filters-sep" aria-hidden="true">|</span>
              <button type="button" className="req-clear" onClick={f.clearAll}>Clear all filters</button>
            </React.Fragment>
          )}
        </div>
      </div>

      <div className="req-scroll">
        {/* Header row */}
        <div className="req-row inv-row req-row--header" role="row" style={invGridStyle}>
          <div className="req-cell req-cell--check" role="columnheader">
            <input
              type="checkbox"
              checked={allChecked}
              onChange={toggleAll}
              aria-label="Select all rows on this page"
            />
          </div>
          {vc.showCol("invoice")   && <InvHeaderCell className="inv-cell--invoice">Invoice</InvHeaderCell>}
          {vc.showCol("supplier")  && <InvHeaderCell className="inv-cell--supplier">Supplier</InvHeaderCell>}
          {vc.showCol("status")    && <InvHeaderCell className="inv-cell--status">Status</InvHeaderCell>}
          {vc.showCol("locations") && <div className="req-cell inv-cell--locations" role="columnheader">Sites</div>}
          {vc.showCol("amount")    && <InvHeaderCell className="inv-cell--amount">Amount</InvHeaderCell>}
          {vc.showCol("engagementType") && <div className="req-cell req-cell--engtype" role="columnheader">Engagement type</div>}
          {vc.showCol("billingBasis")   && <div className="req-cell req-cell--v77em" role="columnheader">Billing basis</div>}
          {vc.showCol("timeCapture")    && <div className="req-cell req-cell--v77tc" role="columnheader">Time capture</div>}
          {vc.showCol("supplierTypes")  && <div className="req-cell req-cell--v77st" role="columnheader">Supplier types</div>}
          <div className="req-cell inv-cell--chev" role="columnheader" aria-label=""></div>
        </div>

        {/* Body rows */}
        <div className="req-body" role="rowgroup">
          {rows.map((row) => (
            <InvoiceRow
              key={row.id}
              row={row}
              checked={selected.has(row.id)}
              onToggle={() => toggle(row.id)}
              onOpen={onOpenRow}
              vc={vcRow}
            />
          ))}
        </div>
      </div>

      <Pagination
        page={page}
        totalPages={totalPages}
        total={total}
        pageSize={pageSize}
        onPageSizeChange={onPageSizeChange}
        onChange={onPageChange}
      />
    </div>

    <BulkActionBar
      count={selected.size}
      noun="invoice"
      contextHint={invHint}
      onClear={() => setSelected(new Set())}
      actions={bulkActionsInv}
      overflow={bulkOverflowInv}
    />
    {vc.panel}
    </React.Fragment>
  );
}

// ---------- List page ---------------------------------------------------
// Parse a "MM.DD.YYYY" string into a Date (local time).
function _invParseDate(s) {
  const m = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(String(s || "").trim());
  if (!m) return null;
  return new Date(parseInt(m[3],10), parseInt(m[1],10) - 1, parseInt(m[2],10));
}
function _invDateInBucket(d, bucket, now = new Date()) {
  if (!d) return false;
  const y = now.getFullYear(), mo = now.getMonth();
  if (bucket === "This month")  return d.getFullYear() === y && d.getMonth() === mo;
  if (bucket === "Last month") {
    const last = new Date(y, mo - 1, 1);
    return d.getFullYear() === last.getFullYear() && d.getMonth() === last.getMonth();
  }
  if (bucket === "Last quarter") {
    const qStart = new Date(y, mo - 3, 1);
    const qEnd   = new Date(y, mo, 1);
    return d >= qStart && d < qEnd;
  }
  if (bucket === "This year")  return d.getFullYear() === y;
  return false;
}
const INV_FILTER_MATCHERS = {
  supplier:  (row, vals) => vals.includes(REQ_SUPPLIERS[row.supplier]?.label),
  locations: (row, vals) => (row.locations || []).some((l) => vals.includes(l)),
  // Source = engagement type. "Frontline" matches rows without an
  // engagementType (the original INVOICES); "SOW" matches the merged
  // SOW rows. Only shown in the UI when the SOW flag is on.
  source:    (row, vals) => {
    let src = "Frontline";
    if (row.engagementType === "SOW")        src = "SOW";
    else if (row.engagementType === "Contractor") src = "Contractor";
    return vals.includes(src);
  },
  date:      (row, vals) => {
    const d = _invParseDate(row.invDate);
    return vals.some((b) => _invDateInBucket(d, b));
  },
  billingBasis: (row, vals) =>
    !window.V77Cols || window.V77Cols.matchBillingBasis(row, vals),
  timeCapture: (row, vals) =>
    !window.V77Cols || window.V77Cols.matchTimeCapture(row, vals),
  supplierTypes: (row, vals) =>
    !window.V77Cols || window.V77Cols.matchSupplierTypes(row, vals),
  engagementType: (row, vals) =>
    !window.EngagementType || window.EngagementType.matchType(row, vals),
};

function InvoicesPage({ reloadKey, onReload, onOpenRow }) {
  const [page, setPage] = useStateInv(1);
  const [pageSize, setPageSize] = useStateInv(INV_PAGE_SIZE);
  const [query, setQuery] = useStateInv("");
  const f = useFilters({ supplier: [], locations: [], date: [], source: [], billingBasis: [], timeCapture: [], supplierTypes: [], engagementType: [] });
  if (window.V77Cols && window.V77Cols.useBodyClass) window.V77Cols.useBodyClass();
  if (window.EngagementType && window.EngagementType.useBodyClass) window.EngagementType.useBodyClass();
  // SOW invoices — merged in when the `sow` feature flag is on so the
  // status counts and chip filters reflect the full list. Strictly
  // additive: turning the flag off restores the original INVOICES.
  const sowOn          = window.useFeatureFlag ? window.useFeatureFlag("sow") : false;
  const contractorsOn  = window.useFeatureFlag ? window.useFeatureFlag("contractors") : false;
  // v0.79 supplier-type axis — independent contractor + EOR. Either
  // axis being on merges the matching invoices into the list. With
  // both flags off, the list stays Agency-only (byte-identical to the
  // pre-v0.79 ship).
  const icAxisOn       = window.useFeatureFlag ? window.useFeatureFlag("independentContractor") : false;
  const eorOn          = window.useFeatureFlag ? window.useFeatureFlag("eor") : false;
  // v0.78 — engagement-type variants. Each merges in 5 sample invoices
  // when the org has the matching engagement type enabled in Settings
  // → Configuration. With every flag off, the list stays Shift-only.
  const engAssignmentOn = window.useFeatureFlag ? window.useFeatureFlag("engAssignment") : false;
  const engProjectOn    = window.useFeatureFlag ? window.useFeatureFlag("engProject")    : false;
  const INVOICES_LIVE = useMemoInv(
    () => {
      let list = INVOICES;
      if (sowOn && window.getSowInvoiceRows) {
        list = [...window.getSowInvoiceRows(), ...list];
      }
      if (engAssignmentOn && window.getAssignmentInvoiceRows) {
        list = [...window.getAssignmentInvoiceRows(), ...list];
      }
      if (engProjectOn && window.getProjectInvoiceRows) {
        list = [...window.getProjectInvoiceRows(), ...list];
      }
      if (contractorsOn || icAxisOn) {
        if (window.getContractorInvoiceRows) {
          list = [...window.getContractorInvoiceRows(), ...list];
        }
      }
      if (eorOn) {
        list = [...INVOICES_EOR, ...list];
      }
      return list;
    },
    [sowOn, contractorsOn, icAxisOn, eorOn, engAssignmentOn, engProjectOn]
  );

  // EngagementScope · invoices already carry per-row engagementType
  // ("SOW", "Contractor", or undefined → Frontline). The chip-bar
  // wraps the scope primitive in multi-select mode and short-circuits
  // to the existing "source" chip-filter for byte-identity. Hidden
  // when no variant flag is on so the all-flags-off list looks
  // identical to the v0.6 baseline.
  const _invRowType = (row) =>
    row.engagementType === "SOW"        ? "sow" :
    row.engagementType === "Contractor" ? "contractor" :
    row.engagementType === "Professional" ? "professional" :
                                          "frontline";
  const useScopeInv = window.useEngagementScope;
  const [invScope, invScopeHelpers] = useScopeInv ? useScopeInv() : [null, null];

  // v0.77 spec §19 + §13 · AxisScopeBar state for [billingModel, supplierType].
  const _useAxisScope = window.useAxisScope;
  const _invAxisPair = _useAxisScope ? _useAxisScope({ scopes: ["billingModel", "supplierType"] }) : null;
  const invAxisValue = _invAxisPair ? _invAxisPair[0] : null;
  const invAxisHelpers = _invAxisPair ? _invAxisPair[1] : null;
  const invTypeCounts = useMemoInv(() => {
    const c = { frontline: 0, professional: 0, contractor: 0, sow: 0, __total: INVOICES_LIVE.length };
    INVOICES_LIVE.forEach((r) => { c[_invRowType(r)] += 1; });
    return c;
  }, [INVOICES_LIVE]);
  // Status tab — default to "Issued" if any invoices are out (those are
  // what AP is actively chasing); else "all".
  const _hasIssued = INVOICES_LIVE.some((i) => i.status === "Issued");
  const [statusTab, setStatusTab] = useStateInv(_hasIssued ? "Issued" : "all");

  // Reset to page 1 when search, chip filters, or status tab change.
  React.useEffect(() => { setPage(1); }, [query, f.filters, statusTab]);

  // Search + chip filter pass — counts are computed off this intermediate
  // list so each tab badge reflects what you'd see by switching tabs.
  const beforeStatus = useMemoInv(() => {
    let list = INVOICES_LIVE;
    if (invScope && !invScope.isAllOn) {
      list = list.filter((r) => invScope.types.has(_invRowType(r)));
    }
    // v0.77 axis filter — only narrows when the user has selected axis chips.
    if (invAxisHelpers) list = list.filter((r) => invAxisHelpers.matches(r));
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      list = list.filter((r) =>
        r.id.toLowerCase().includes(q) ||
        r.req.toLowerCase().includes(q) ||
        (REQ_SUPPLIERS[r.supplier]?.label || "").toLowerCase().includes(q) ||
        r.locations.some((l) => l.toLowerCase().includes(q))
      );
    }
    return applyFilters(list, f.filters, INV_FILTER_MATCHERS);
  }, [query, f.filters, INVOICES_LIVE, invScope && Array.from(invScope.types).sort().join("|")]);
  const statusCounts = useMemoInv(() => ({
    all:       beforeStatus.length,
    Generated: beforeStatus.filter((r) => r.status === "Generated").length,
    Issued:    beforeStatus.filter((r) => r.status === "Issued").length,
    Paid:      beforeStatus.filter((r) => r.status === "Paid").length,
    Overdue:   beforeStatus.filter((r) => r.status === "Overdue").length,
  }), [beforeStatus]);
  const filtered = useMemoInv(
    () => statusTab === "all" ? beforeStatus : beforeStatus.filter((r) => r.status === statusTab),
    [beforeStatus, statusTab]
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const rows = useMemoInv(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [page, pageSize, filtered]);

  const handlePageSizeChange = (n) => { setPageSize(n); setPage(1); };
  const handleQuery = (v) => { setQuery(v); setPage(1); };

  return (
    <React.Fragment>
      <Omnibar
        icon="Pay"
        title="Invoices"
        dayforce={{
          primitive: "SupplierInvoice",
          subtitle: "Flex Work–owned · generated from approved TimePairs",
          product: "Flex Work",
          strategy: "New",
          note: "Invoices remain Flex Work–owned (Dayforce Payroll doesn't generate AP). Every line references orgUnitId, jobAssignmentId, laborMetricCode, and employeeId — generated from approved time pairs, not a Flex Work copy of hours.",
          anchor: "orgsetup",
        }}
      >
        <button
          type="button"
          className="iconbtn"
          onClick={onReload}
          aria-label="Reload content"
          title="Reload"
        >
          <Icon name="Refresh" size={18} />
        </button>
        <button
          type="button"
          className="iconbtn"
          aria-label="Adjust columns and filters"
          title="Adjust columns and filters"
          onClick={(e) => {
            const vc = window.__activeVc;
            if (vc && vc.openPanel) { vc.openPanel(e.currentTarget); return; }
            openMenu(e.currentTarget, [{ icon: "Settings", label: "Column settings — coming soon" }]);
          }}
        >
          <Icon name="Adjustment" size={20} />
        </button>
        <button
          type="button"
          className="iconbtn"
          aria-label="More actions"
          onClick={(e) => openMenu(e.currentTarget, toolbarMenuItems())}
        >
          <Icon name="MoreVert" size={20} />
        </button>
      </Omnibar>

      <div className="content-section inv-content" key={reloadKey}>
        {/* v0.77 spec §19 + §13 · AxisScopeBar sits alongside the
            legacy EngagementScope through Phase 3. Hidden at flag-off
            so the all-flags-off DOM stays byte-identical. */}
        {window.AxisScopeBar && invAxisHelpers ? (
          <window.AxisScopeBar
            scopes={["billingModel", "supplierType"]}
            value={invAxisValue}
            onChange={invAxisHelpers.setAxis}
            mode="multi"
            className="inv-v77-scope"
          />
        ) : null}
        {/* EngagementScope chip-bar · sits at the head of the invoices
            list. Hidden when no variant flag is on so the all-flags-off
            list is byte-identical to the v0.6 baseline. */}
        {(sowOn || contractorsOn || (window.useFeatureFlag && window.useFeatureFlag("professionalWork"))) && window.EngagementScope && invScope && (
          <div className="inv-scope-row" role="region" aria-label="Engagement scope">
            <window.EngagementScope
              value={invScope}
              onChange={invScopeHelpers}
              counts={invTypeCounts}
              label="Engagement type"
            />
          </div>
        )}
        <SfBanner />
        <INV_STATUS_TABS_STRIP active={statusTab} onChange={setStatusTab} />
        <InvoicesToolbar query={query} onQuery={handleQuery} />
        <InvoicesTable
          rows={rows}
          total={filtered.length}
          page={page}
          totalPages={totalPages}
          pageSize={pageSize}
          onPageSizeChange={handlePageSizeChange}
          onPageChange={setPage}
          onOpenRow={onOpenRow}
          f={f}
          statusTab={statusTab}
          onStatusTab={setStatusTab}
          statusCounts={statusCounts}
        />
      </div>
    </React.Fragment>
  );
}

// ==========================================================================
// Invoice Details — paper-style document
// ==========================================================================

// Build per-supplier worker rosters so invoice line items reference real
// employees of the billing supplier. Each worker's job is their primary
// role from the workforce roster — same as everywhere else in the platform.
function workersForSupplier(supplierId) {
  const roster = (typeof WORKERS !== "undefined" ? WORKERS : []).filter((w) => w.supplier === supplierId);
  // Pad to 6 rows by reusing the first workers when a supplier has fewer,
  // so every invoice can carry a 6-line table without going empty.
  while (roster.length > 0 && roster.length < 6) {
    roster.push(roster[roster.length % Math.max(1, (typeof WORKERS !== "undefined" ? WORKERS : []).filter((w) => w.supplier === supplierId).length)]);
  }
  return roster.slice(0, 6);
}

// Realistic hours per role — full-shift roles bill 8:00, kitchen/host roles
// bill 6:00–7:30, line-leadership rolls 6:00. Keeps the invoice plausible
// without making each row identical.
const HOURS_BY_JOB = {
  "Production Associate":       "8:00",
  "Picker":                  "7:30",
  "Warehouse Clerk":         "8:00",
  "Factory Line Assembler":  "8:00",
  "Operator":                "8:00",
  "Assembler":               "8:00",
  "Inspector":               "7:00",
  "Line Manager":            "6:00",
  "Prep Cook":               "5:30",
  "Line Cook":               "6:30",
  "Server":                  "6:00",
  "Host":                    "5:00",
  "Bartender":               "6:30",
  "Cook":                    "6:30",
};

function fmtMoney(n) {
  const sym = (typeof window !== "undefined" && window.curSymbol) ? window.curSymbol() : "$";
  return sym + n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

// Sum a list of "H:MM" durations into a single "H:MM" string.
function sumHours(rows) {
  const totalMin = rows.reduce((acc, r) => {
    const [h, m] = r.hours.split(":").map(Number);
    return acc + h * 60 + (m || 0);
  }, 0);
  return `${Math.floor(totalMin / 60)}:${(totalMin % 60).toString().padStart(2, "0")}`;
}

// Per-invoice model: line items spread across the invoice's locations,
// totaling to inv.amount. Subtotal / taxes / fees split the amount so
// the paper invoice cross-foots cleanly with the row. Workers and jobs
// are drawn from the invoice's billing supplier.
function buildInvoiceModel(inv) {
  // Strip any currency symbol + thousand-separator commas to parse the
  // numeric total. Works whether `inv.amount` is "$1,295.66", "£1,295.66"
  // or "€1.295,66" — we tolerate both decimal conventions on the demo.
  const total = parseFloat(String(inv.amount).replace(/[^0-9.\-]/g, ""));
  const locations = inv.locations && inv.locations.length ? inv.locations : ["—"];
  const subtotal = Math.round(total * 0.83 * 100) / 100;
  const taxes    = Math.round(total * 0.09 * 100) / 100;
  const fees     = Math.round((total - subtotal - taxes) * 100) / 100;

  const lineWorkers = workersForSupplier(inv.supplier).map((w) => ({
    worker: w.name,
    job:    w.jobs[0] || "Production Associate",
    hours:  HOURS_BY_JOB[w.jobs[0]] || "8:00",
  }));

  // Distribute subtotal across line items, weighting toward later rows so
  // the values feel believable. Last row absorbs the rounding remainder.
  const weights = [0.85, 0.90, 1.00, 1.05, 1.10, 1.10];
  const wSum = weights.reduce((a, b) => a + b, 0);
  let running = 0;
  const lines = lineWorkers.map((w, i) => {
    let amt = Math.round((subtotal * weights[i] / wSum) * 100) / 100;
    if (i === lineWorkers.length - 1) {
      amt = Math.round((subtotal - running) * 100) / 100;
    }
    running += amt;
    return {
      ...w,
      location: locations[i % locations.length],
      date: inv.invDate,
      amount: fmtMoney(amt),
    };
  });
  return {
    lines,
    totalHours: sumHours(lines),
    subtotal: fmtMoney(subtotal),
    taxes: fmtMoney(taxes),
    fees: fmtMoney(fees),
    amountDue: fmtMoney(total),
  };
}

function InvoiceDetailsPage({ invoiceId = "A1B2C3D4", onBack }) {
  // Look up source row across all engagement-type sources so a click
  // from the Invoices list resolves whether the invoice was billed for
  // shift work, an assignment, a project, or a SOW milestone.
  const inv =
    (window.findInvoiceByIdAcrossTypes && window.findInvoiceByIdAcrossTypes(invoiceId)) ||
    INVOICES.find((i) => i.id === invoiceId) ||
    INVOICES[0];
  const supplier = REQ_SUPPLIERS[inv.supplier] || REQ_SUPPLIERS.sw;
  // Engagement-kind dispatch — non-Shift invoices use the typed model
  // dispatcher so we render the right column track + line semantics.
  // Shift falls through to the original buildInvoiceModel which knows
  // how to roll up workers/hours from the supplier roster.
  const engKind = inv._engKind ||
    (inv.engagementType === "SOW"               ? "sow" :
     inv.engagementType === "Statement of Work" ? "sow" :
     inv.engagementType === "Assignment"        ? "assignment" :
     inv.engagementType === "Project"           ? "project" :
                                                  "shift");
  const useEngModel = engKind !== "shift" && window.buildEngagementInvoiceModel;
  const model = useEngModel
    ? window.buildEngagementInvoiceModel(inv)
    : buildInvoiceModel(inv);

  const statusHue = INV_STATUS_HUES[inv.status] || "default";

  // ---------- Supplier Funding (program fee) ----------
  // Driven by Configuration → Program (v0.79 — no longer a feature flag).
  // Gated by the program toggle AND engagement-type coverage.
  // Skips contractor invoices unless the program explicitly opts them in.
  // useProgramFunding subscribes to flexwork:config:change so this page
  // re-renders the moment the user saves in Settings → Configuration.
  const pf = window.useProgramFunding
    ? window.useProgramFunding()
    : ((window.getProgramFunding && window.getProgramFunding()) || null);
  const engagementKey =
    inv.engagementType === "SOW"          ? "sow" :
    inv.engagementType === "Contractor"   ? "contractor" :
    inv.engagementType === "Professional" ? "professional" :
                                            "frontline";
  const pfApplies = !!(pf && pf.supplierFunding
    && pf.coverage && pf.coverage[engagementKey]);
  // v0.82 — resolve the agency's NEGOTIATED rate (and any method
  // override) from its supplier contract. Falls back to the program
  // default when the agency has no negotiated terms.
  const fundInfo = (pfApplies && window.getSupplierFunding)
    ? window.getSupplierFunding(inv.supplier) : null;
  const pfPct        = fundInfo ? fundInfo.effectivePct : (pf ? Number(pf.feePct) : 0);
  const pfMethod     = fundInfo ? fundInfo.method       : (pf ? pf.method : "Discount");
  const pfLabel      = fundInfo ? fundInfo.invoiceLabel : (pf ? (pf.invoiceLabel || "Program fee") : "Program fee");
  const pfNegotiated = !!(fundInfo && fundInfo.hasOverride);
  // Recompute totals when supplier funding applies. The bill amount the
  // supplier rendered stays unchanged — we add a Program fee line and a
  // Net to supplier subtotal (Discount), or recompute the buyer-pays
  // value (Markup). Math is intentionally simple — invoice generation
  // does the canonical version; this is a paper-doc preview.
  let pfFeeAmt = 0;
  let pfNetToSupplier = null;
  let pfBuyerPays = null;
  if (pfApplies) {
    const totalNum = parseFloat(String(inv.amount).replace(/[^0-9.\-]/g, "")) || 0;
    pfFeeAmt = Math.round(totalNum * (Number(pfPct) / 100) * 100) / 100;
    if (pfMethod === "Markup") {
      pfBuyerPays = Math.round((totalNum + pfFeeAmt) * 100) / 100;
      pfNetToSupplier = totalNum;
    } else {
      pfBuyerPays = totalNum;
      pfNetToSupplier = Math.round((totalNum - pfFeeAmt) * 100) / 100;
    }
  }

  // ---------- Sales Tax (multi-country) ----------
  // Resolves the configured per-country tax — defaults to the active
  // org country, can be overridden per-invoice via inv.country and
  // inv.taxJurisdiction. Reverse-charge invoices return rate=0 plus a
  // notice. Returns null when the flag is off / country not configured
  // / engagement excluded — in which case we fall back to the prior
  // placeholder demo math so nothing visibly breaks.
  const stTreatment = (window.resolveSalesTaxForInvoice && window.resolveSalesTaxForInvoice(inv)) || null;
  let taxesLabel    = "Taxes";
  let taxesAmount   = parseFloat(String(model.taxes).replace(/[^0-9.\-]/g, "")) || 0;
  let taxRcNote     = null;
  if (stTreatment) {
    // Tax base: by default the bill amount (pre-fee per canonical
    // staffing treatment). When Supplier Funding is also on AND the
    // tenant chose to tax net-of-fee, we take the supplier-funding
    // discount off the base first.
    const stCfg = window.getSalesTaxConfig && window.getSalesTaxConfig();
    const totalNum = parseFloat(String(inv.amount).replace(/[^0-9.\-]/g, "")) || 0;
    let base = totalNum;
    if (stCfg && stCfg.stackOnFunding === "postFee" && pfApplies && pfMethod === "Discount") {
      base = totalNum - pfFeeAmt;
    }
    taxesAmount = Math.round(base * (stTreatment.rate / 100) * 100) / 100;
    taxesLabel  = stTreatment.label + (stTreatment.jurisdiction ? " · " + stTreatment.jurisdiction : "") + (stTreatment.rate > 0 ? " (" + stTreatment.rate + "%)" : "");
    if (stTreatment.reverseCharge) {
      taxRcNote = stTreatment.reverseChargeNote;
    }
  }
  // Cross-foot the new total when sales tax is in effect.
  const stTotalNum = (function () {
    const sub = parseFloat(String(model.subtotal).replace(/[^0-9.\-]/g, "")) || 0;
    const fee = parseFloat(String(model.fees).replace(/[^0-9.\-]/g, ""))     || 0;
    return Math.round((sub + fee + taxesAmount) * 100) / 100;
  })();
  const stTotalLabel = fmtMoney(stTotalNum);
  // When BOTH flags are on, the Program-fee preview math above used
  // inv.amount as the baseline. With Sales Tax now changing the total,
  // the buyer-pays / net-to-supplier lines need to track that.
  if (stTreatment && pfApplies) {
    if (pfMethod === "Markup") {
      pfBuyerPays = Math.round((stTotalNum + pfFeeAmt) * 100) / 100;
    } else {
      pfBuyerPays = stTotalNum;
      pfNetToSupplier = Math.round((stTotalNum - pfFeeAmt) * 100) / 100;
    }
  }

  return (
    <React.Fragment>
      <ReqOmnibar
        title={`Invoice INV-${inv.id}`}
        subtitle={`Invoices · ${supplier.label}`}
        status={(
          <React.Fragment>
            <span className={`req-pill req-pill--${statusHue}`}>{inv.status}</span>
            {stTreatment && (
              <span
                className="req-pill req-pill--informative inv-tax-pill"
                title={`${stTreatment.label}${stTreatment.jurisdiction ? " · " + stTreatment.jurisdiction : ""}${stTreatment.rate ? " · " + stTreatment.rate + "%" : ""}`}
              >
                <Icon name="Globe" size={12} />
                {stTreatment.reverseCharge
                  ? `${stTreatment.regime} · reverse charge`
                  : `${stTreatment.regime} · ${stTreatment.rate}%`}
              </span>
            )}
            {pfApplies && (
              <span
                className="req-pill req-pill--informative inv-pf-pill"
                title={`${pfLabel} · ${pfPct}% ${pfMethod.toLowerCase()}${pfNegotiated ? " · negotiated rate" : ""}`}
              >
                <Icon name="Wallet" size={12} />
                Supplier funded · {pfPct}%{pfNegotiated ? " (negotiated)" : ""}
              </span>
            )}
          </React.Fragment>
        )}
        onBack={onBack}
        actions={(
          <React.Fragment>
            <button
              type="button"
              className="iconbtn"
              aria-label="Print"
              title="Print"
              onClick={() => showToast(`Sending INV-${inv.id} to printer`)}
            >
              <Icon name="Print" size={20} />
            </button>
            <button
              type="button"
              className="iconbtn"
              aria-label="Download PDF"
              title="Download"
              onClick={() => showToast(`Downloading INV-${inv.id}.pdf`, { kind: "success" })}
            >
              <Icon name="FileDownload" size={20} />
            </button>
            <button
              type="button"
              className="btn btn--md btn--primary"
              onClick={() => openConfirm({
                title: `Mark INV-${inv.id} as paid?`,
                body:  `${inv.amount} from ${supplier.label} will be moved to your paid invoices.`,
                primaryLabel: "Mark paid",
                onConfirm: () => showToast(`INV-${inv.id} marked paid`, { kind: "success" }),
              })}
            >
              Mark paid
            </button>
            <button
              type="button"
              className="iconbtn"
              aria-label="More"
              onClick={(e) => openMenu(e.currentTarget, [
                { icon: "Copy",     label: "Copy invoice number", onClick: () => copyToClipboard(`INV-${inv.id}`) },
                { icon: "Pay",      label: "Add payment note",    onClick: () => openEditEntity({
                    ...paymentNoteSchema(inv),
                    onSave: () => showToast(`Note added to INV-${inv.id}`, { kind: "success" }),
                  }) },
                { icon: "Cancel",   label: "Dispute",             onClick: () => showToast("Dispute opened") },
                { divider: true },
                { icon: "TrashCan", label: "Delete invoice",      danger: true,
                  onClick: () => openConfirm({
                    title: `Delete INV-${inv.id}?`,
                    body:  "This action cannot be undone.",
                    primaryLabel: "Delete",
                    onConfirm: () => { showToast(`INV-${inv.id} deleted`, { kind: "success" }); onBack && onBack(); },
                  }) },
              ])}
            >
              <Icon name="MoreVert" size={20} />
            </button>
          </React.Fragment>
        )}
      />

      <div className="inv-doc-wrap">
        <article className="inv-doc" aria-label={`Invoice INV-${inv.id}`}>
          {/* ---------- Header ---------- */}
          <header className="inv-doc-head">
            <div className="inv-doc-bill">
              <span className="inv-doc-eyebrow">BILL TO</span>
              <h2 className="inv-doc-party">{supplier.label}</h2>
              <div className="inv-doc-party-grid">
                <address className="inv-doc-address">
                  c/o {inv.contact}<br />
                  345 5th Avenue North, #101, New York, NY 10123<br />
                  United States
                </address>
                <address className="inv-doc-address">
                  accountsreceivable@{supplier.label.toLowerCase().replace(/\s+/g, "")}.com<br />
                  312-235-8886 ex. 2828
                </address>
              </div>
            </div>
            <div className="inv-doc-amount">
              <span className="inv-doc-eyebrow">AMOUNT DUE (USD)</span>
              <div className="inv-doc-amount-value">
                <span className="inv-doc-amount-sign">{(window.curSymbol && window.curSymbol()) || "$"}</span>
                <span className="tabular">{inv.amount.replace((window.curSymbol && window.curSymbol()) || "$", "")}</span>
              </div>
              <dl className="inv-doc-meta">
                <div>
                  <dt>Invoice Number</dt>
                  <dd className="tabular">{inv.id}</dd>
                </div>
                <div>
                  <dt>Invoice Date</dt>
                  <dd className="tabular">{inv.invDate || "09.15.2025"}</dd>
                </div>
                <div>
                  <dt>Payment Due</dt>
                  <dd className="tabular">{inv.dueDate || "10.25.2025"}</dd>
                </div>
              </dl>
            </div>
          </header>

          {/* ---------- Line items + totals ----------
              Shift invoices render the canonical 6-col table inline.
              Other engagement types (Assignment / Project / SOW) hand
              off to <EngagementInvoiceLineItems> which picks the right
              column track per billingBasis, then we render a stacked
              totals block (no Subtotal — the typed table prints its
              own) so Taxes / Fees / Amount Due / Program fee still
              cross-foot correctly. */}
          {useEngModel ? (
            <React.Fragment>
              {window.EngagementInvoiceLineItems &&
                <window.EngagementInvoiceLineItems inv={inv} />}
              <div className="inv-doc-totals-stack" aria-label="Totals">
                <div className="inv-doc-totals-stack-row">
                  <span>{taxesLabel}</span>
                  <span className="inv-doc-totals-stack-amt tabular">{fmtMoney(taxesAmount)}</span>
                </div>
                <div className="inv-doc-totals-stack-row">
                  <span>Fees</span>
                  <span className="inv-doc-totals-stack-amt tabular">{model.fees}</span>
                </div>
                <div className="inv-doc-totals-stack-row inv-doc-totals-stack-row--final">
                  <span>Amount Due</span>
                  <span className="inv-doc-totals-stack-amt tabular">
                    {stTreatment ? stTotalLabel : model.amountDue}
                  </span>
                </div>
                {taxRcNote && (
                  <div className="inv-doc-totals-stack-note">
                    <Icon name="Information" size={12} />
                    <span>{taxRcNote}</span>
                  </div>
                )}
                {pfApplies && (
                  <React.Fragment>
                    <div className="inv-doc-totals-stack-row inv-doc-totals-stack-row--pf">
                      <span>
                        {pfMethod === "Markup" ? "+ " : "− "}
                        {pfLabel}
                        <span className="inv-doc-pf-tag" title={pfNegotiated ? "Negotiated agency rate" : "Supplier-funded program"}>
                          Supplier funded · {pfPct}% {pfMethod.toLowerCase()}{pfNegotiated ? " · negotiated" : ""}
                        </span>
                      </span>
                      <span className="inv-doc-totals-stack-amt tabular">
                        {pfMethod === "Markup" ? "+ " : "− "}{fmtMoney(pfFeeAmt)}
                      </span>
                    </div>
                    <div className="inv-doc-totals-stack-row inv-doc-totals-stack-row--pf-net">
                      <span>{pfMethod === "Markup" ? "Buyer pays" : "Net to supplier"}</span>
                      <span className="inv-doc-totals-stack-amt tabular">
                        {fmtMoney(pf.method === "Markup" ? pfBuyerPays : pfNetToSupplier)}
                      </span>
                    </div>
                  </React.Fragment>
                )}
              </div>
            </React.Fragment>
          ) : (
          <section className="inv-doc-table" aria-label="Line items">
            <div className="inv-doc-row inv-doc-row--head">
              <span>Site</span>
              <span>Date</span>
              <span>Worker</span>
              <span>Job</span>
              <span className="inv-doc-num">Hours</span>
              <span className="inv-doc-num">Amount</span>
            </div>
            <div className="inv-doc-rule" role="presentation" />
            <div className="inv-doc-rows">
              {model.lines.map((row, i) => (
                <div className="inv-doc-row" key={i}>
                  <span>{row.location}</span>
                  <span className="tabular">{row.date}</span>
                  <span>{row.worker}</span>
                  <span>{row.job}</span>
                  <span className="inv-doc-num tabular">{row.hours}</span>
                  <span className="inv-doc-num tabular">{row.amount}</span>
                </div>
              ))}
            </div>
            <div className="inv-doc-rule" role="presentation" />

            {/* ---------- Totals ---------- */}
            <div className="inv-doc-totals">
              <div className="inv-doc-row inv-doc-totalrow">
                <span></span>
                <span></span>
                <span></span>
                <span>Subtotal</span>
                <span className="inv-doc-num tabular">{model.totalHours}</span>
                <span className="inv-doc-num tabular">{model.subtotal}</span>
              </div>
              <div className="inv-doc-row inv-doc-totalrow">
                <span></span>
                <span></span>
                <span></span>
                <span>{taxesLabel}</span>
                <span className="inv-doc-num"></span>
                <span className="inv-doc-num tabular">{fmtMoney(taxesAmount)}</span>
              </div>
              <div className="inv-doc-row inv-doc-totalrow">
                <span></span>
                <span></span>
                <span></span>
                <span>Fees</span>
                <span className="inv-doc-num"></span>
                <span className="inv-doc-num tabular">{model.fees}</span>
              </div>
              <div className="inv-doc-row inv-doc-totalrow inv-doc-totalrow--final">
                <span></span>
                <span></span>
                <span></span>
                <span>Amount Due</span>
                <span className="inv-doc-num"></span>
                <span className="inv-doc-num tabular">{stTreatment ? stTotalLabel : model.amountDue}</span>
              </div>
              {taxRcNote && (
                <div className="inv-doc-row inv-doc-totalrow inv-doc-rc-note">
                  <span></span>
                  <span></span>
                  <span></span>
                  <span className="inv-doc-rc-note-text">
                    <Icon name="Information" size={12} />
                    <span>{taxRcNote}</span>
                  </span>
                  <span className="inv-doc-num"></span>
                  <span className="inv-doc-num"></span>
                </div>
              )}
              {pfApplies && (
                <React.Fragment>
                  <div className="inv-doc-row inv-doc-totalrow inv-doc-totalrow--pf">
                    <span></span>
                    <span></span>
                    <span></span>
                    <span>
                      {pfMethod === "Markup" ? "+ " : "− "}
                      {pfLabel}
                      <span className="inv-doc-pf-tag" title={pfNegotiated ? "Negotiated agency rate" : "Supplier-funded program"}>
                        Supplier funded · {pfPct}% {pfMethod.toLowerCase()}{pfNegotiated ? " · negotiated" : ""}
                      </span>
                    </span>
                    <span className="inv-doc-num"></span>
                    <span className="inv-doc-num tabular">
                      {pfMethod === "Markup" ? "+ " : "− "}{fmtMoney(pfFeeAmt)}
                    </span>
                  </div>
                  <div className="inv-doc-row inv-doc-totalrow inv-doc-totalrow--pf-net">
                    <span></span>
                    <span></span>
                    <span></span>
                    <span>{pfMethod === "Markup" ? "Buyer pays" : "Net to supplier"}</span>
                    <span className="inv-doc-num"></span>
                    <span className="inv-doc-num tabular">
                      {fmtMoney(pf.method === "Markup" ? pfBuyerPays : pfNetToSupplier)}
                    </span>
                  </div>
                </React.Fragment>
              )}
            </div>
          </section>
          )}

          {/* ---------- Footer ---------- */}
          <footer className="inv-doc-foot">
            <img
              src="assets/dayforce-flexwork-logo.svg"
              alt="Dayforce Flex Work"
              className="inv-doc-logo"
            />
            <h3 className="inv-doc-party">Dayforce Flex Work</h3>
            <div className="inv-doc-party-grid">
              <address className="inv-doc-address">
                3311 East Old Shakopee Road<br />
                Minneapolis, MN 55425-1640<br />
                United States
              </address>
              <address className="inv-doc-address">
                support@dayforceflexwork.com<br />
                952-853-8100
              </address>
            </div>
          </footer>
        </article>
      </div>
    </React.Fragment>
  );
}

Object.assign(window, { InvoicesPage, InvoiceDetailsPage, INVOICES });

// ---------- Status tabs strip ------------------------------------------
// Lives ABOVE the table card, below the page omnibar. Renders via the
// shared StatusTabs in the `everest` variant — same Everest design-system
// Tabs group spec used on Requisitions and Timesheets (48h, 4px bottom
// indicator, bold-active 16px); no count pills. Defaults to "All".
const INV_STATUS_TABS_LIST = [
  { id: "all",       label: "All" },
  { id: "Generated", label: "Generated" },
  { id: "Issued",    label: "Issued" },
  { id: "Paid",      label: "Paid" },
  { id: "Overdue",   label: "Overdue" },
];
function INV_STATUS_TABS_STRIP({ active, onChange }) {
  return (
    <StatusTabs
      tabs={INV_STATUS_TABS_LIST}
      active={active}
      onChange={onChange}
      variant="everest"
      ariaLabel="Filter invoices by status"
    />
  );
}

// Register INVOICES so the live country picker rewrites the "$" in each
// row's amount (and any other money fields) when the user switches org
// country. Without this, swap from US→UK would leave amounts as "$X".
if (typeof window !== "undefined" && window.registerCurrencyData) {
  window.registerCurrencyData(INVOICES);
}
