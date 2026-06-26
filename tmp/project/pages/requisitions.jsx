// =====================================================================
// Requisitions page — filterable list with mock data + pagination
// =====================================================================

const { useState: useStateReq, useMemo: useMemoReq } = React;

// ---------- Mock data ----------------------------------------------------
// Single source of truth for requisition data. Detail / schedule / invoice
// pages all derive their displayed dates, locations, and totals from these
// rows so the prototype tells a consistent story across pages.
const REQUISITIONS_BASE = [
  { id: "J6K7L8M9N0", status: "Booked",      dates: ["Nov 01", "Dec 08", "Jan 14"],  jobs: ["Production Associate"],       qty: 3, time: "6:00 AM – 3:00 PM", breakLabel: "30 min break", location: "Warehouse #35",             costCenter: "Warehouse #32",   bookedBy: "Nia Thompson",   placed: "10.18.2025, 06:45 PM", suppliers: ["gs","sw","th","ph"], bill: "$478.82" },
  { id: "Z6A7B8C9D0", status: "Booked",      dates: ["Oct 25"],                       jobs: ["Line Manager"], more: 4,   qty: 2, time: "7:00 AM – 4:00 PM", breakLabel: "30 min break", location: "Storage Facility Beta",     costCenter: "Warehouse #18",   bookedBy: "Jamal Carter",   placed: "10.10.2025, 09:12 AM", suppliers: ["gs","sw","th"],       bill: "$733.27", engagementType: "Assignment", billingBasis: "Monthly", timeCapture: "Time Tracking" },
  { id: "Y1Z2A3B4C5", status: "Booked",      dates: ["Feb 13", "Mar 20"],             jobs: ["Production Associate"],       qty: 4, time: "6:00 AM – 3:00 PM", breakLabel: "30 min break", location: "Storage Facility Beta",     costCenter: "Warehouse #18",   bookedBy: "Nia Thompson",   placed: "01.30.2026, 11:05 AM", suppliers: ["gs","sw","th","ss"],  bill: "$733.27" },
  { id: "N6O7P8Q9R0", status: "Booked",      dates: ["Sep 18"],                       jobs: ["Line Manager"],            qty: 2, time: "8:00 AM – 5:00 PM", breakLabel: "45 min break", location: "Storage Facility Beta",     costCenter: "Warehouse #18",   bookedBy: "Priya Ramesh",   placed: "09.04.2025, 02:21 PM", suppliers: ["sw","th","ph"],       bill: "$733.27", engagementType: "Assignment", billingBasis: "Weekly", timeCapture: "Time Tracking" },
  { id: "P6Q7R8S9T0", status: "Booked",      dates: ["Feb 21", "Mar 28", "Apr 04"],   jobs: ["Production Associate"],       qty: 5, time: "6:00 AM – 3:00 PM", breakLabel: "30 min break", location: "Cargo Depot Zeta",          costCenter: "Warehouse #07",   bookedBy: "Nia Thompson",   placed: "02.04.2026, 04:55 PM", suppliers: ["sw","th","ph"],       bill: "$478.82" },
  { id: "O1P2Q3R4S5", status: "In progress", dates: ["Aug 11"],                       jobs: ["Factory Line Assembler"],  qty: 4, time: "7:00 AM – 3:30 PM", breakLabel: "30 min break", location: "Distribution Center Alpha", costCenter: "Plant #02",       bookedBy: "Marcus Webb",    placed: "07.28.2025, 08:09 AM", suppliers: ["sw","th","ph","ss"],  bill: "$733.27" },
  { id: "K1L2M3N4O5", status: "Booked",      dates: ["Apr 27 – 29", "May 04"],        jobs: ["Production Associate"],       qty: 3, time: "6:00 AM – 3:00 PM", breakLabel: "30 min break", location: "Inventory Warehouse Kappa", costCenter: "Warehouse #11",   bookedBy: "Priya Ramesh",   placed: "04.10.2026, 10:33 AM", suppliers: ["gs","sw","th","ph"], bill: "$478.82", engagementType: "Assignment", billingBasis: "Fixed", timeCapture: "N/A" },
  { id: "D6E7F8G9H0", status: "Booked",      dates: ["Jul 04"],                       jobs: ["Production Associate"],       qty: 6, time: "6:00 AM – 2:00 PM", breakLabel: "30 min break", location: "Inventory Warehouse Kappa", costCenter: "Warehouse #11",   bookedBy: "Nia Thompson",   placed: "06.15.2025, 01:12 PM", suppliers: ["gs","sw","th","ph"], bill: "$478.82" },
  { id: "S1T2U3V4W5", status: "Booked",      dates: ["May 12", "Jun 19", "Jul 26"],   jobs: ["Production Associate"],       qty: 3, time: "6:00 AM – 3:00 PM", breakLabel: "30 min break", location: "Inventory Warehouse Kappa", costCenter: "Warehouse #11",   bookedBy: "Jamal Carter",   placed: "04.20.2026, 09:48 AM", suppliers: ["sw","ph","wf"],       bill: "$478.82", engagementType: "Project", billingBasis: "Milestone", timeCapture: "Time Tracking" },
  { id: "T6U7V8W9X0", status: "In progress", dates: ["Jun 27"],                       jobs: ["Warehouse Clerk"],         qty: 4, time: "8:00 AM – 4:00 PM", breakLabel: "30 min break", location: "Freight Terminal Delta",    costCenter: "Dock #03",        bookedBy: "Sami Soto",      placed: "06.10.2025, 03:30 PM", suppliers: ["gs","sw","th","ph"], bill: "$733.27", engagementType: "Assignment", billingBasis: "Weekly", timeCapture: "Time Tracking" },
  { id: "I1J2K3L4M5", status: "In progress", dates: ["May 19 – 20"],                  jobs: ["Warehouse Clerk"], more: 1, qty: 4, time: "8:00 AM – 4:00 PM", breakLabel: "30 min break", location: "Freight Terminal Delta",    costCenter: "Dock #03",        bookedBy: "Sami Soto",      placed: "05.02.2026, 04:14 PM", suppliers: ["sw","th","ph","ss"],  bill: "$733.27" },
  { id: "X6Y7Z8A9B0", status: "In progress", dates: ["Apr 12"],                       jobs: ["Warehouse Clerk"],         qty: 3, time: "8:00 AM – 4:00 PM", breakLabel: "30 min break", location: "Freight Terminal Delta",    costCenter: "Dock #03",        bookedBy: "Marcus Webb",    placed: "03.29.2026, 11:21 AM", suppliers: ["sw","th","wf"],       bill: "$733.27", engagementType: "Assignment", billingBasis: "Monthly", timeCapture: "Time Tracking" },
  { id: "E1F2G3H4I5", status: "Booked",      dates: ["Mar 05 – Apr 17"],              jobs: ["Production Associate"],       qty: 6, time: "6:00 AM – 3:00 PM", breakLabel: "30 min break", location: "Logistics Hub Alpha",       costCenter: "Hub #01",         bookedBy: "Nia Thompson",   placed: "02.20.2026, 09:00 AM", suppliers: ["gs","sw","th","ph"], bill: "$478.82", engagementType: "Project", billingBasis: "Fixed", timeCapture: "Time Tracking" },
  { id: "U1V2W3X4Y5", status: "In progress", dates: ["Aug 02", "Sep 09", "Oct 16"],   jobs: ["Factory Line Assembler"],  qty: 5, time: "7:00 AM – 3:30 PM", breakLabel: "30 min break", location: "Supply Chain Nexus",        costCenter: "Plant #04",       bookedBy: "Marcus Webb",    placed: "07.20.2025, 02:47 PM", suppliers: ["sw","th","ss"],       bill: "$733.27" },
  { id: "F6G7H8I9J0", status: "Booked",      dates: ["Nov 23", "Dec 30", "Jan 06"],   jobs: ["Production Associate"],       qty: 3, time: "6:00 AM – 3:00 PM", breakLabel: "30 min break", location: "Shipping Dock Theta",       costCenter: "Dock #07",        bookedBy: "Jamal Carter",   placed: "11.10.2025, 10:18 AM", suppliers: ["gs","sw","th","ph"], bill: "$478.82", engagementType: "Statement of Work", billingBasis: "Milestone", timeCapture: "N/A" },
  { id: "A1B2C3D4E5", status: "Completed",   dates: ["Feb 22"],                       jobs: ["Factory Line Assembler"],  qty: 4, time: "7:00 AM – 3:30 PM", breakLabel: "30 min break", location: "Transport Hub Kappa",       costCenter: "Hub #05",         bookedBy: "Marcus Webb",    placed: "02.08.2026, 03:02 PM", suppliers: ["sw"],                 bill: "$733.27" },
  { id: "M5N6O7P8Q9", status: "Completed",   dates: ["Jan 15"],                       jobs: ["Production Associate"],       qty: 3, time: "6:00 AM – 3:00 PM", breakLabel: "30 min break", location: "Warehouse #14",             costCenter: "Warehouse #14",   bookedBy: "Nia Thompson",   placed: "01.02.2026, 11:46 AM", suppliers: ["sw","th"],            bill: "$478.82" },
  { id: "B5C6D7E8F9", status: "Completed",   dates: ["Dec 11"],                       jobs: ["Line Manager"],            qty: 2, time: "7:00 AM – 4:00 PM", breakLabel: "30 min break", location: "Logistics Hub Alpha",       costCenter: "Hub #01",         bookedBy: "Priya Ramesh",   placed: "11.27.2025, 04:33 PM", suppliers: ["sw","ph"],            bill: "$733.27", engagementType: "Assignment", billingBasis: "Fixed", timeCapture: "N/A" },
];
// ---------- Temp-spend tier scaling -------------------------------------
// Inflate (high tier) or shrink (low tier) the requisition list so the
// page reads as a working VMS at every $-scale. Narrative-anchor IDs
// referenced by TRIAGE / APPROVALS / dashboard activity feed are
// preserved when shrinking so deep links never break.
const REQUISITIONS_RAW = (window.inflateList || ((b) => b.slice()))(REQUISITIONS_BASE, {
  preserveIds: [
    "K1L2M3N4O5", "N6O7P8Q9R0", "T6U7V8W9X0", "P6Q7R8S9T0", "Y1Z2A3B4C5",
    "O1P2Q3R4S5", "A1B2C3D4E5",
  ],
  minRows: 6,
  maxRows: 220,
  makeClone: (src, n) => {
    const newId = window._reqClonedId ? window._reqClonedId(src.id, n) : `${src.id}~${n}`;
    return { id: newId };
  },
});
// Industry-localized (Manufacturing is identity; other packs swap location
// names, job titles, and cost-center labels).
const REQUISITIONS = (window.localizeAll || ((r) => r))(REQUISITIONS_RAW, ["jobs", "location", "costCenter"]);

// ---------- Date-chip parsing -------------------------------------------
// Convert a list-row chip like "Nov 01", "Apr 27 – 29", or "Mar 05 – Apr 17"
// into ['Mo', 'DD'] pairs (with `range: true` when two endpoints exist).
// Used by Requisition Details to render its booking-table date badges.
function parseDateChip(chip) {
  const parts = chip.split(/\s*–\s*/);
  const splitToken = (s) => {
    const t = s.trim().split(/\s+/);
    return t.length === 2 ? [t[0], t[1]] : [null, t[0]];
  };
  if (parts.length === 1) {
    const [mo, day] = splitToken(parts[0]);
    return { range: false, dates: [[mo, day]] };
  }
  const left  = splitToken(parts[0]);
  const right = splitToken(parts[1]);
  // "Apr 27 – 29" → right has no month, inherit from left
  if (!right[0]) right[0] = left[0];
  return { range: true, dates: [left, right] };
}

// Build a clean "Nov 01 – Jan 14, 2026" style range string from a row's
// dates list. Used by the Schedule list to align with the Requisitions list.
function summarizeDates(dates) {
  if (!dates || dates.length === 0) return "";
  if (dates.length === 1) return `${dates[0]}, 2026`;
  const first = parseDateChip(dates[0]).dates[0];
  const last  = parseDateChip(dates[dates.length - 1]).dates.slice(-1)[0];
  return `${first[0]} ${first[1]} – ${last[0]} ${last[1]}, 2026`;
}

Object.assign(window, { REQUISITIONS, parseDateChip, summarizeDates });

const PAGE_SIZE = 10;

// ---------- Supplier brand swatches --------------------------------------
// Defer to REQ_SUPPLIERS (req-shared.jsx) so labels / colors stay in sync
// with the rest of the platform.
function SupplierStack({ ids }) {
  return (
    <div className="sup-stack" role="group" aria-label="Suppliers">
      {ids.map((id, i) => {
        const s = REQ_SUPPLIERS[id] || REQ_SUPPLIERS.sw;
        return (
          <span
            key={id + i}
            className="sup-chip"
            style={{ zIndex: ids.length - i }}
            title={s.label}
            aria-label={s.label}
          >
            {s.short}
          </span>
        );
      })}
    </div>
  );
}

// ---------- Status pill --------------------------------------------------
const STATUS_HUES = {
  "Booked":      "default",
  "In progress": "informative",
  "Completed":   "success",
};
// Dayforce Job Requisition state mapping — surfaced as a secondary muted
// pill next to the Flex Work status, plus a tooltip. Keeps Flex Work names
// visible during the transition (per v0.3 alignment recommendation).
const STATUS_DF_STATE = {
  "Booked":      "Open",
  "In progress": "Filled",
  "Completed":   "Closed",
};
function StatusPill({ status, showDayforce = false }) {
  const hue = STATUS_HUES[status] || "default";
  const dfState = STATUS_DF_STATE[status];
  const title = dfState ? `Dayforce calls this “${dfState}” — Job Requisition state` : undefined;
  return (
    <span className="req-status-cluster">
      <span className={`req-pill req-pill--${hue}`} title={title}>{status}</span>
      {showDayforce && dfState && (
        <span className="req-pill req-pill--df-state" title={title}>{dfState}</span>
      )}
    </span>
  );
}

// ---------- Generic neutral chip (used for date + job tags) -------------
function Chip({ children, soft = false }) {
  return <span className={`req-chip${soft ? " req-chip--soft" : ""}`}>{children}</span>;
}

// ---------- Filter dropdown button ---------------------------------------
function FilterChip({ label, onClick, active = false, count = 0, title }) {
  return (
    <button
      type="button"
      className={`filter-chip${active ? " filter-chip--active" : ""}`}
      onClick={onClick}
      title={title || undefined}
    >
      <span>{label}</span>
      {count > 0 && <span className="filter-chip-count tabular">{count}</span>}
      <Icon name="ChevronDown" size={16} />
    </button>
  );
}

// ---------- Hook: stateful filter set for a list page --------------------
// Returns { filters, openFor, clearAll, hasAny } so list pages can wire
// each FilterChip to its options without re-implementing the popover.
function useFilters(defaults) {
  const [filters, setFilters] = useStateReq(defaults);
  const openFor = (key, label, options) => (e) => {
    const anchor = e.currentTarget;
    openFilter(anchor, {
      title: label,
      options,
      selected: filters[key] || [],
      onApply: (vals) => setFilters((prev) => ({ ...prev, [key]: vals })),
    });
  };
  const clearAll = () => {
    const cleared = Object.fromEntries(Object.keys(defaults).map((k) => [k, []]));
    setFilters(cleared);
    showToast("Filters cleared");
  };
  const hasAny = Object.values(filters).some((v) => v && v.length > 0);
  return { filters, setFilters, openFor, clearAll, hasAny };
}

// Apply a filter set to a list. `matchers` maps each filter key to a
// predicate `(row, selectedValues) => boolean`. Empty selections are skipped
// so an unset chip is a no-op. Keys without a matcher are also skipped.
function applyFilters(rows, filters, matchers) {
  if (!filters || !rows || rows.length === 0) return rows;
  let out = rows;
  for (const key of Object.keys(filters)) {
    const vals = filters[key];
    if (!vals || vals.length === 0) continue;
    const m = matchers && matchers[key];
    if (!m) continue;
    out = out.filter((row) => m(row, vals));
  }
  return out;
}

// Deterministic bucket for fields with no real backing data (e.g. "Onboarded"
// on suppliers / locations). Hashes the row id into one of the supplied
// bucket labels so the filter still narrows results in a stable way.
function bucketByHash(id, buckets) {
  let h = 0;
  const s = String(id || "");
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return buckets[h % buckets.length];
}

Object.assign(window, { FilterChip, useFilters, applyFilters, bucketByHash });

// ---------- Fulfillment bucket helpers ----------------------------------
// Drives the "Fulfillment" filter chip on Requisitions + Schedule. Multi-
// select buckets; a row matches if its derived fulfillment-percent lands
// in any selected bucket. Booked rows pin at 0% (broadcast, no
// assignments yet), Completed rows pin at 100%, and anything in-flight
// is bucketed from a deterministic hash of the row id so the same row
// lands in the same bucket on every reload.
const FULFILLMENT_BUCKETS = ["100%", "75-100%", "50-75%", "25-75%", "0-25%"];
function fulfillmentPctOf(row) {
  if (!row) return 0;
  if (row.status === "Completed") return 100;
  if (row.status === "Booked")    return 0;
  // Mid-flight rows: deterministic 25..95 from the row id.
  let h = 0;
  const s = String(row.id || "");
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return 25 + (h % 71);
}
function fulfillmentBucketMatches(pct, bucket) {
  switch (bucket) {
    case "100%":    return pct === 100;
    case "75-100%": return pct >= 75 && pct < 100;
    case "50-75%":  return pct >= 50 && pct < 75;
    case "25-75%":  return pct >= 25 && pct < 75;
    case "0-25%":   return pct >= 0  && pct < 25;
    default: return false;
  }
}
function matchFulfillment(row, vals) {
  if (!vals || vals.length === 0) return true;
  const pct = fulfillmentPctOf(row);
  return vals.some((b) => fulfillmentBucketMatches(pct, b));
}
Object.assign(window, { FULFILLMENT_BUCKETS, fulfillmentPctOf, fulfillmentBucketMatches, matchFulfillment });

// ---------- Pagination ---------------------------------------------------
function Pagination({ page, totalPages, onChange, total, pageSize, onPageSizeChange }) {
  const safeChange = (p) => onChange(Math.max(1, Math.min(totalPages, p)));
  const start = (page - 1) * pageSize + 1;
  const end = Math.min(total, page * pageSize);
  return (
    <div className="pagination">
      <span className="pagination-summary">
        Showing {start}–{end} of {total}
      </span>
      <div className="pagination-right">
        <div className="pagination-group">
          <span>Rows per page</span>
          <span className="pagination-select-wrap">
            <select
              className="pagination-select"
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              aria-label="Rows per page"
              style={{ paddingRight: 26 }}
            >
              {[10, 25, 50, 100].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
            <span className="pagination-chev" aria-hidden="true">
              <Icon name="ChevronDown" size={14} />
            </span>
          </span>
        </div>
        <div className="pagination-group">
          <span>Page</span>
          <span className="pagination-select-wrap">
            <select
              className="pagination-select"
              value={page}
              onChange={(e) => onChange(Number(e.target.value))}
              aria-label="Current page"
              style={{ paddingRight: 26 }}
            >
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
            <span className="pagination-chev" aria-hidden="true">
              <Icon name="ChevronDown" size={14} />
            </span>
          </span>
        </div>
        <div className="pagination-arrows">
          <button
            type="button"
            className="pagination-arrow"
            onClick={() => safeChange(page - 1)}
            disabled={page <= 1}
            aria-label="Previous page"
          >
            <Icon name="ChevronLeft" size={16} />
          </button>
          <button
            type="button"
            className="pagination-arrow"
            onClick={() => safeChange(page + 1)}
            disabled={page >= totalPages}
            aria-label="Next page"
          >
            <Icon name="ChevronRight" size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------- Row ----------------------------------------------------------
function RequisitionRow({ row, checked, onToggle, onOpen, vc }) {
  const rowMenu = (e) => {
    e.stopPropagation();
    openMenu(e.currentTarget, [
      { icon: "View",       label: "View details", onClick: () => onOpen && onOpen(row.id) },
      { icon: "Edit",       label: "Edit requisition" },
      { icon: "Copy",       label: "Duplicate" },
      { icon: "Export",     label: "Export" },
      { divider: true },
      { icon: "Cancel",     label: "Cancel requisition", danger: true,
        onClick: () => openConfirm({
          title: `Cancel requisition ${row.id}?`,
          body: `This will release ${row.dates.length} scheduled date${row.dates.length === 1 ? "" : "s"} at ${row.location}. Suppliers will be notified.`,
          primaryLabel: "Cancel requisition",
          primaryKind: "primary",
          onConfirm: () => showToast(`Requisition ${row.id} cancelled`, { kind: "success" }),
        }) },
    ]);
  };
  // Default to "everything visible" when no customizer wired.
  const show = (id) => !vc || vc.showCol(id);
  return (
    <div
      className="req-row req-row--clickable"
      role="row"
      tabIndex={0}
      style={vc && vc.gridStyle}
      onClick={(e) => {
        // Don't navigate when clicking on the checkbox or a link
        if (e.target.closest("input,a,button")) return;
        onOpen && onOpen(row.id);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") onOpen && onOpen(row.id);
      }}>
      <div className="req-cell req-cell--check" role="cell">
        <input
          type="checkbox"
          checked={checked}
          onChange={onToggle}
          aria-label={`Select ${row.id}`}
        />
      </div>
      {show("id") && (
        <div className="req-cell req-cell--id" role="cell">
          <span className="req-id">{row.id}</span>
        </div>
      )}
      {show("status") && (
        <div className="req-cell" role="cell">
          <StatusPill status={row.status} />
        </div>
      )}
      {show("dates") && (
        <div className="req-cell req-cell--dates" role="cell">
          {row.dates.map((d, i) => <Chip key={i}>{d}</Chip>)}
        </div>
      )}
      {show("jobs") && (
        <div className="req-cell req-cell--jobs" role="cell">
          {row.jobs.map((j, i) => <Chip key={i}>{j}</Chip>)}
          {row.more && <Chip>{row.more} more</Chip>}
        </div>
      )}
      {show("location") && (
        <div className="req-cell req-cell--loc" role="cell">
          <a
            href="#"
            className="req-loc"
            onClick={(e) => { e.preventDefault(); showToast(`Opening ${row.location}`); }}
          >{row.location}</a>
        </div>
      )}
      {show("suppliers") && (
        <div className="req-cell req-cell--sup" role="cell">
          <SupplierStack ids={row.suppliers} />
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
      {show("bill") && (
        <div className="req-cell req-cell--bill" role="cell">
          <span className="req-bill tabular">{row.bill}</span>
        </div>
      )}
      <div className="req-cell req-cell--chev" role="cell">
        <button
          type="button"
          className="icon-btn"
          aria-label={`Actions for ${row.id}`}
          onClick={rowMenu}
        >
          <Icon name="MoreVert" size={18} />
        </button>
      </div>
    </div>
  );
}

// ---------- Sortable header cell -----------------------------------------
function HeaderCell({ children, className = "" }) {
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
function RequisitionsTable({ rows, total, page, totalPages, onPageChange, pageSize, onPageSizeChange, onOpenRow, f, statusTab, onStatusTab, statusCounts }) {
  const [selected, setSelected] = useStateReq(() => new Set());
  const allChecked = rows.length > 0 && rows.every((r) => selected.has(r.id));

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

  // -- Bulk actions unique to Requisitions ------------------------------
  // The list mixes Booked / In progress / Completed rows. We tailor the
  // bar to what an HR ops lead actually does in bulk: duplicate to make
  // a recurring set, reassign owner when teams shuffle, pause supplier
  // distribution mid-flight, and (rarely) cancel a batch of bookings.
  const bulkAct = (msg, kind = "success") => {
    if (window.showToast) window.showToast(msg, { kind });
    setSelected(new Set());
  };
  const n = selected.size;
  const noun = "requisition";
  const summary = `${n} ${n === 1 ? noun : noun + "s"}`;
  const bulkActions = [
    { icon: "Copy",         label: "Duplicate",  onClick: () => bulkAct(`Duplicated ${summary} as drafts`) },
    { icon: "PersonArrow",  label: "Reassign",   onClick: () => bulkAct(`Reassigned ${summary} to a new owner`) },
    { icon: "ShieldPerson", label: "Distribute", onClick: () => bulkAct(`Re-ran distribution for ${summary}`) },
    { icon: "FileDownload", label: "Export",     onClick: () => bulkAct(`Exported ${summary} to CSV`) },
    { divider: true },
    { icon: "Cancel",       label: "Cancel",     onClick: () => bulkAct(`Cancelled ${summary}`, "warning"), kind: "danger" },
  ];
  const bulkOverflow = [
    { icon: "Print",     label: "Print summary",      onClick: () => bulkAct(`Sent ${summary} to printer`) },
    { icon: "TimeRedo",  label: "Reschedule",         onClick: () => bulkAct(`Opening reschedule for ${summary}`, "info") },
    { icon: "Notes",     label: "Add note", onClick: () => bulkAct(`Note added to ${summary}`) },
  ];

  // Build filter options from data so they always stay in sync.
  const dateOpts   = ["This month", "Next month", "Next 3 months", "This year"];
  const jobOpts    = Array.from(new Set(REQUISITIONS.flatMap((r) => r.jobs))).sort();
  // v0.78 native — Billing basis (one per row) + Time capture (one
  // per row) + Supplier types filter options. Returns the empty list at
  // flag-off so the chips are hidden below.
  const v77On     = window.V77Cols && window.V77Cols.isOn();
  const bbOpts    = v77On ? window.V77Cols.billingBasisOpts() : [];
  const tcOpts    = v77On ? window.V77Cols.timeCaptureOpts()  : [];
  const stOpts    = v77On ? window.V77Cols.supplierTypeOpts() : [];
  // Engagement Type — toolbar filter (only renders chip when the
  // capability is on, i.e. ≥1 engagement-type flag is on).
  const etOn      = window.EngagementType && window.EngagementType.isOn();
  const etOpts    = etOn ? window.EngagementType.enabledTypes() : [];

  // ---- View customizer ------------------------------------------------
  // Mirror the CSS grid track widths (styles.css + styles-v77-native-cols.css)
  // so toggling a column off still leaves the remaining tracks at their
  // intended widths. Feature-flag-conditional columns / filters are
  // omitted from the manifest when not currently active.
  const reqVcManifest = React.useMemo(() => {
    const columns = [
      { id: "id",            label: "ID",              width: "140px" },
      { id: "status",        label: "Status",          width: "116px" },
      { id: "dates",         label: "Dates",           width: "minmax(220px, 1.4fr)" },
      { id: "jobs",          label: "Job Assignments", width: "minmax(200px, 1.2fr)" },
      { id: "location",      label: "Site",        width: "minmax(180px, 1fr)" },
      { id: "suppliers",     label: "Suppliers",       width: "160px" },
    ];
    if (etOn && etOpts.length > 1) {
      columns.push({ id: "engagementType", label: "Engagement type", width: "140px" });
    }
    if (v77On) {
      columns.push({ id: "billingBasis",  label: "Billing basis",  width: "140px" });
      columns.push({ id: "timeCapture",   label: "Time capture",   width: "140px" });
      columns.push({ id: "supplierTypes", label: "Supplier types", width: "180px" });
    }
    columns.push({ id: "bill", label: "Est. bill", width: "100px" });
    const filters = [
      { id: "date", label: "Date" },
      { id: "jobs", label: "Job Assignments" },
    ];
    if (etOn && etOpts.length > 1) filters.push({ id: "engagementType", label: "Engagement type" });
    if (bbOpts.length > 1)        filters.push({ id: "billingBasis",  label: "Billing basis" });
    if (tcOpts.length > 1)        filters.push({ id: "timeCapture",   label: "Time capture" });
    if (stOpts.length > 1)        filters.push({ id: "supplierTypes", label: "Supplier types" });
    return { columns, filters };
  }, [v77On, etOn, etOpts.length, bbOpts.length, tcOpts.length, stOpts.length]);

  // Build a grid template that always preserves the checkbox (44px,
  // left-most) + kebab (52px, right-most) tracks, plus whatever the
  // customizer hasn't hidden in between. The customizer's `gridStyle`
  // alone returns only the user-toggleable tracks, so we splice the
  // bookend widths back in here.
  const vc = useViewCustomizer("requisitions", reqVcManifest);
  const reqGridStyle = vc.gridStyle
    ? { gridTemplateColumns: `44px ${vc.gridStyle.gridTemplateColumns} 52px` }
    : undefined;
  const vcRow = { ...vc, gridStyle: reqGridStyle };

  return (
    <React.Fragment>
    <div className="req-table-card" role="table" aria-label="Requisitions">
      {/* Filter bar */}
      <div className="req-filters">
        <div className="req-filters-left">
          {vc.showFilter("date") && (
            <FilterChip label="Date"   active={f.filters.date.length > 0}   count={f.filters.date.length}   onClick={f.openFor("date",   "Date",   dateOpts)} />
          )}
          {vc.showFilter("jobs") && (
            <FilterChip label="Job Assignments"   active={f.filters.jobs.length > 0}   count={f.filters.jobs.length}   onClick={f.openFor("jobs", "Job Assignments",   jobOpts)} />
          )}
          {vc.showFilter("engagementType") && etOn && etOpts.length > 1 && (
            <FilterChip
              label="Engagement type"
              active={f.filters.engagementType.length > 0}
              count={f.filters.engagementType.length}
              onClick={f.openFor("engagementType", "Engagement type", etOpts)}
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
          {vc.showFilter("supplierTypes") && stOpts.length > 1 && (
            <FilterChip
              label="Supplier types"
              active={f.filters.supplierTypes.length > 0}
              count={f.filters.supplierTypes.length}
              onClick={f.openFor("supplierTypes", "Supplier types", stOpts)}
            />
          )}
          <FilterChip
            label="Fulfillment"
            active={f.filters.fulfillment.length > 0}
            count={f.filters.fulfillment.length}
            onClick={f.openFor("fulfillment", "Fulfillment", FULFILLMENT_BUCKETS)}
          />
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
        <div className="req-row req-row--header" role="row" style={reqGridStyle}>
          <div className="req-cell req-cell--check" role="columnheader">
            <input
              type="checkbox"
              checked={allChecked}
              onChange={toggleAll}
              aria-label="Select all rows on this page"
            />
          </div>
          {vc.showCol("id")            && <HeaderCell className="req-cell--id">ID</HeaderCell>}
          {vc.showCol("status")        && <HeaderCell>Status</HeaderCell>}
          {vc.showCol("dates")         && <HeaderCell className="req-cell--dates">Dates</HeaderCell>}
          {vc.showCol("jobs")          && <HeaderCell className="req-cell--jobs">Job Assignments</HeaderCell>}
          {vc.showCol("location")      && <HeaderCell className="req-cell--loc">Site</HeaderCell>}
          {vc.showCol("suppliers")     && <div className="req-cell req-cell--sup" role="columnheader">Suppliers</div>}
          {vc.showCol("engagementType")&& <div className="req-cell req-cell--engtype" role="columnheader">Engagement type</div>}
          {vc.showCol("billingBasis")  && <div className="req-cell req-cell--v77em" role="columnheader">Billing basis</div>}
          {vc.showCol("timeCapture")   && <div className="req-cell req-cell--v77tc" role="columnheader">Time capture</div>}
          {vc.showCol("supplierTypes") && <div className="req-cell req-cell--v77st" role="columnheader">Supplier types</div>}
          {vc.showCol("bill")          && <HeaderCell className="req-cell--bill">Est. Bill</HeaderCell>}
          <div className="req-cell req-cell--chev" role="columnheader" aria-label=""></div>
        </div>

        {/* Body rows */}
        <div className="req-body" role="rowgroup">
          {rows.map((row) => (
            <RequisitionRow
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

      {/* Pagination */}
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
      noun="requisition"
      onClear={() => setSelected(new Set())}
      actions={bulkActions}
      overflow={bulkOverflow}
    />
    {vc.panel}
    </React.Fragment>
  );
}

// ---------- Page ---------------------------------------------------------
// Today is May 19, 2026 — used to bucket the Date filter into
// "This month" / "Next month" / etc. against the date chips on each row.
const REQ_MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
function reqDateBucketMonths(bucket, now = new Date()) {
  const m = now.getMonth();
  if (bucket === "This month")    return [REQ_MONTHS[m]];
  if (bucket === "Next month")    return [REQ_MONTHS[(m + 1) % 12]];
  if (bucket === "Next 3 months") return [1,2,3].map((k) => REQ_MONTHS[(m + k) % 12]);
  if (bucket === "This year")     return REQ_MONTHS.slice();
  return [];
}
function reqRowMatchesDateBucket(row, bucket) {
  const months = reqDateBucketMonths(bucket);
  if (months.length === 0) return false;
  return (row.dates || []).some((d) => months.some((mo) => String(d).includes(mo)));
}

const REQ_FILTER_MATCHERS = {
  date:   (row, vals) => vals.some((b) => reqRowMatchesDateBucket(row, b)),
  jobs:   (row, vals) => (row.jobs || []).some((j) => vals.includes(j)),
  fulfillment: matchFulfillment,
  // v0.78 native — Billing basis + Time capture (single value per row)
  // + Supplier types (multi per row). Predicates are tolerant: when
  // V77Cols hasn't loaded they degrade to "match everything".
  billingBasis: (row, vals) =>
    !window.V77Cols || window.V77Cols.matchBillingBasis(row, vals),
  timeCapture: (row, vals) =>
    !window.V77Cols || window.V77Cols.matchTimeCapture(row, vals),
  supplierTypes: (row, vals) =>
    !window.V77Cols || window.V77Cols.matchSupplierTypes(row, vals),
  engagementType: (row, vals) =>
    !window.EngagementType || window.EngagementType.matchType(row, vals),
};

// ---------- Professional requisitions table -----------------------------
// Gated by the `professionalWork` feature flag. Reads from
// `window.getProfessionalRequisitions()` so the data lives next to the
// rest of the Professional Work module.
//
// Columns differ from the Frontline (shift-based) table:
//   ID · Status · Engagement type · Cadence + rate · Pipeline · Hiring
//   manager · Location · Timesheet mode · Days open
const PRO_STATUS_TABS = [
  { id: "all",             label: "All",            tone: "default" },
  { id: "Open",            label: "Open",           tone: "info" },
  { id: "Interviewing",    label: "Interviewing",   tone: "default" },
  { id: "Offer extended",  label: "Offer extended", tone: "warning" },
];

function ProRequisitionRow({ row, onOpen }) {
  const cadenceLabel = window.profCadenceLabel ? window.profCadenceLabel(row.cadence) : row.cadence;
  const rateRange = window.profFmtMoney
    ? `${window.profFmtMoney(row.rateLow, row.currency)} \u2013 ${window.profFmtMoney(row.rateHigh, row.currency)}`
    : `${row.rateLow}\u2013${row.rateHigh} ${row.currency}`;
  const pipeline = row.pipeline || {};
  const total = (pipeline.sourced || 0) + (pipeline.screened || 0) + (pipeline.interview || 0) + (pipeline.offer || 0);
  const inFlight = (pipeline.interview || 0) + (pipeline.offer || 0);
  const statusHue =
    row.status === "Offer extended" ? "warning" :
    row.status === "Interviewing"   ? "info"    :
    row.status === "Open"           ? "default" : "default";
  return (
    <button
      type="button"
      className="pro-req-row"
      onClick={() => onOpen && onOpen(row.id)}
      aria-label={`Open requisition ${row.id}`}
    >
      <span className="pro-req-cell pro-req-cell--id tabular">{row.id}</span>
      <span className="pro-req-cell pro-req-cell--status">
        <span className={`req-pill req-pill--${statusHue}`}>{row.status}</span>
      </span>
      <span className="pro-req-cell pro-req-cell--title">
        <span className="pro-req-title">{row.jobs[0]}</span>
        <span className="pro-req-sub">
          <Icon name="PersonAuthorize" size={12} />
          <span>{row.hiringManager}</span>
        </span>
      </span>
      <span className="pro-req-cell pro-req-cell--contract">
        <span className="pw-chip pw-chip--cadence">{cadenceLabel}</span>
        <span className="pw-chip pw-chip--rate tabular">{rateRange}</span>
        <span className="pw-chip pw-chip--perm">Permanent</span>
      </span>
      <span className="pro-req-cell pro-req-cell--pipeline">
        <span className="pro-pipe-bar" aria-label={`${total} candidates · ${inFlight} in interview or offer`}>
          <span className="pw-pipe-seg pw-pipe-seg--sourced"   style={{ flex: pipeline.sourced || 0 }} />
          <span className="pw-pipe-seg pw-pipe-seg--screened"  style={{ flex: pipeline.screened || 0 }} />
          <span className="pw-pipe-seg pw-pipe-seg--interview" style={{ flex: pipeline.interview || 0 }} />
          <span className="pw-pipe-seg pw-pipe-seg--offer"     style={{ flex: pipeline.offer || 0.01 }} />
        </span>
        <span className="pro-pipe-counts tabular">
          {total} cand &middot; <b>{inFlight}</b> in interview/offer
        </span>
      </span>
      <span className="pro-req-cell pro-req-cell--loc">
        <span className={`fi fi-${row.flag}`} aria-hidden="true" style={{ width: 20, height: 14, borderRadius: 2 }}></span>
        <span>{row.location}</span>
      </span>
      <span className="pro-req-cell pro-req-cell--ts">
        <span className="pw-chip pw-chip--sow">
          {row.timesheetMode === "required" ? "Timesheet required" : "No timesheet"}
        </span>
      </span>
      <span className="pro-req-cell pro-req-cell--age tabular">
        <span className="pro-req-age">{row.daysOpen}<em> d open</em></span>
        <span className="pro-req-opened">Opened {row.opened}</span>
      </span>
      <span className="pro-req-cell pro-req-cell--chev" aria-hidden="true">
        <Icon name="ChevronRight" size={20} />
      </span>
    </button>
  );
}

function ProfessionalRequisitionsTable({ onOpenRow }) {
  const reqs = window.getProfessionalRequisitions ? window.getProfessionalRequisitions() : [];
  const [statusTab, setStatusTab] = useStateReq("all");
  const statusCounts = useMemoReq(() => ({
    all:              reqs.length,
    "Open":           reqs.filter((r) => r.status === "Open").length,
    "Interviewing":   reqs.filter((r) => r.status === "Interviewing").length,
    "Offer extended": reqs.filter((r) => r.status === "Offer extended").length,
  }), [reqs]);
  const filtered = statusTab === "all" ? reqs : reqs.filter((r) => r.status === statusTab);

  return (
    <div className="req-table-card pro-req-card" role="table" aria-label="Professional requisitions">
      <StatusTabs
        tabs={PRO_STATUS_TABS}
        counts={statusCounts}
        active={statusTab}
        onChange={setStatusTab}
        ariaLabel="Filter Professional requisitions by status"
      />
      <div className="pro-req-banner" role="note">
        <span className="pro-req-banner-icon" aria-hidden="true">
          <Icon name="Briefcase" size={14} />
        </span>
        <span>
          <b>Permanent engagements.</b> No end date, no schedule, no hourly rate. Filled through a
          candidate pipeline; bound to a Statement of Work; invoiced on the contract cadence.
        </span>
      </div>
      <div className="pro-req-scroll">
        <div className="pro-req-row pro-req-row--header" role="row">
          <span className="pro-req-cell pro-req-cell--id">ID</span>
          <span className="pro-req-cell pro-req-cell--status">Status</span>
          <span className="pro-req-cell pro-req-cell--title">Role &middot; Hiring manager</span>
          <span className="pro-req-cell pro-req-cell--contract">Contract</span>
          <span className="pro-req-cell pro-req-cell--pipeline">Pipeline</span>
          <span className="pro-req-cell pro-req-cell--loc">Site</span>
          <span className="pro-req-cell pro-req-cell--ts">Timesheet</span>
          <span className="pro-req-cell pro-req-cell--age">Age</span>
          <span className="pro-req-cell pro-req-cell--chev" aria-hidden="true"></span>
        </div>
        <div className="pro-req-body" role="rowgroup">
          {filtered.map((r) => (
            <ProRequisitionRow key={r.id} row={r} onOpen={onOpenRow} />
          ))}
          {filtered.length === 0 && (
            <div className="pro-req-empty">
              <Icon name="Briefcase" size={28} />
              <p>No Professional requisitions match this filter.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------
// ReqEngagementScopeBar — adapter that wraps <EngagementScope/> for the
// requisitions list. The legacy list is single-select (engagementType
// state holds exactly one of frontline / professional / contractor) so
// the bar runs the scope primitive in `single` mode. Clicking a chip
// solos to that type, no toggle, no "All" chip.
//
// The migration to a real multi-select scope (combined rows across
// stores via a unified Requisition view-model) is a follow-up — see
// scratch/type-tab-audit.md item 4 in the migration order. This
// adapter is the visual unification step that lands before that.
// ---------------------------------------------------------------------
function ReqEngagementScopeBar({ value, onChange, counts }) {
  // Engagement-scope tabs (Frontline / Professional / SOW) and the
  // companion "Shift-based agency engagements..." hint row are removed
  // throughout the product. Return null so the requisitions list head
  // doesn't render the legacy chip-bar wrapper.
  return null;
  // eslint-disable-next-line no-unreachable
  const Scope = window.EngagementScope;
  const useScope = window.useEngagementScope;
  if (!Scope || !useScope) return null;

  // Seed the scope hook with `value` so the bar reflects the page's
  // own engagementType state. We treat the chip-bar as a controlled
  // mirror: it solos `t`, then propagates to setEngagementType.
  const [scope, helpers] = useScope({ types: [value] });

  // Keep the scope hook in sync with the page state when something
  // else changes it (e.g. flag toggle reset to "frontline").
  React.useEffect(() => {
    if (!scope.isOnly(value)) helpers.selectOnly(value);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const wrappedHelpers = {
    ...helpers,
    selectOnly: (t) => {
      helpers.selectOnly(t);
      onChange(t);
    },
  };

  const hint =
    value === "frontline"    ? "Shift\u2011based agency engagements. Hourly bill rate, schedule, timesheets." :
    value === "professional" ? "Permanent SOW engagements. No schedule, no hourly rate. Invoice on cadence." :
                               "Direct (1099 / IC) engagements. No supplier; MSA + SOW signed with the contractor.";

  return (
    <div className="pw-eng-switch-row" role="region" aria-label="Engagement scope">
      <Scope value={scope} onChange={wrappedHelpers} counts={counts} single label="Engagement type" />
      <span className="pw-eng-switch-hint">{hint}</span>
    </div>
  );
}

function RequisitionsPage({ reloadKey, onReload, onCreate, onOpenRow }) {
  // Professional Work flag — when on, the page leads with an engagement
  // type segmented control. Frontline shows the original (shift-based)
  // requisitions table. Professional swaps to a permanent / SOW table
  // backed by `getProfessionalRequisitions()`.
  const professionalOn = window.useFeatureFlag ? window.useFeatureFlag("professionalWork") : false;
  // Contractors flag — when on, the engagement switch gains a Contractor
  // lane backed by the contractor roster. Contractor engagements bypass
  // the distribution + bidding flow entirely; the table renders one row
  // per active direct engagement.
  const contractorsOn  = window.useFeatureFlag ? window.useFeatureFlag("contractors")     : false;
  // Agency Pro — when active (flag + agency tenant + plan === "Pro"),
  // the agency role gains the Create Requisition button (otherwise
  // hidden for agencies, since agencies receive reqs, not create them).
  const agencyProActive = window.useAgencyProActive ? window.useAgencyProActive() : false;
  // Interview workflow — when the flag is on, an "Interview pipeline"
  // entry point appears in the omnibar that swaps the table view for
  // the manager's interview surfaces (M1–M12). When viewing as Agency,
  // the same control labels as "Interview inbox" and routes to the
  // supplier surfaces (S1–S10). Worker surfaces live in worker-mobile.
  // Admin surfaces live under Settings → Interview.
  const interviewsOn = window.useFeatureFlag ? window.useFeatureFlag("interviews") : false;
  const viewAsRole = (typeof window !== "undefined" && window.flexViewAsRole) || "manager";
  const [interviewView, setInterviewView] = useStateReq(false);
  const [engagementType, setEngagementType] = useStateReq(() => {
    try { return window.sessionStorage.getItem("flexwork.req.engagementType") || "frontline"; }
    catch (e) { return "frontline"; }
  });
  React.useEffect(() => {
    try { window.sessionStorage.setItem("flexwork.req.engagementType", engagementType); }
    catch (e) { /* no-op */ }
  }, [engagementType]);
  React.useEffect(() => {
    if (!professionalOn && engagementType === "professional") setEngagementType("frontline");
    if (!contractorsOn  && engagementType === "contractor")   setEngagementType("frontline");
  }, [professionalOn, contractorsOn, engagementType]);

  const [page, setPage] = useStateReq(1);
  const [pageSize, setPageSize] = useStateReq(PAGE_SIZE);
  const f = useFilters({ date: [], jobs: [], billingBasis: [], timeCapture: [], supplierTypes: [], engagementType: [], fulfillment: [] });
  // v0.77 native filters — toggle the body class so the table's grid
  // gains the Engagement model + Supplier types tracks. No-op when the
  // multi-axis flag set is fully off.
  if (window.V77Cols && window.V77Cols.useBodyClass) window.V77Cols.useBodyClass();
  // Engagement Type column gate — toggles body.engtype-cols-on.
  if (window.EngagementType && window.EngagementType.useBodyClass) window.EngagementType.useBodyClass();

  // v0.77 spec §19 · AxisScopeBar state. Null when the primitive
  // hasn't loaded (script-order resilience). Filter rows downstream
  // via reqAxisHelpers.matches.
  const _useAxisScope = window.useAxisScope;
  const _reqAxisPair = _useAxisScope ? _useAxisScope({ scopes: ["supplierType"] }) : null;
  const reqAxisValue = _reqAxisPair ? _reqAxisPair[0] : null;
  const reqAxisHelpers = _reqAxisPair ? _reqAxisPair[1] : null;
  // Status is selected via the tab strip above the filter row.
  // Defaults to "All" so the user sees the full list on landing.
  const [statusTab, setStatusTab] = useStateReq("all");

  // Snap to page 1 whenever filters change so users always see the new top
  // of the filtered list instead of an empty tail page.
  React.useEffect(() => { setPage(1); }, [f.filters, statusTab]);

  // Rows after applying chip filters (date / jobs) but BEFORE the status
  // tab — so per-tab counts reflect what the user would see by switching
  // tabs without losing their refined filters.
  const beforeStatus = useMemoReq(
    () => {
      const filtered = applyFilters(REQUISITIONS, f.filters, REQ_FILTER_MATCHERS);
      // v0.77 axis filter — only applies when AxisScopeBar is loaded
      // AND the user has narrowed an axis. matches(row) returns true
      // when all axis groups are empty.
      if (reqAxisHelpers) return filtered.filter((r) => reqAxisHelpers.matches(r));
      return filtered;
    },
    [f.filters, reqAxisValue && JSON.stringify(reqAxisValue)]
  );
  const statusCounts = useMemoReq(() => ({
    all:           beforeStatus.length,
    "Booked":      beforeStatus.filter((r) => r.status === "Booked").length,
    "In progress": beforeStatus.filter((r) => r.status === "In progress").length,
    "Completed":   beforeStatus.filter((r) => r.status === "Completed").length,
  }), [beforeStatus]);
  const filtered = useMemoReq(
    () => statusTab === "all" ? beforeStatus : beforeStatus.filter((r) => r.status === statusTab),
    [beforeStatus, statusTab]
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const rows = useMemoReq(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize]);

  const handlePageSizeChange = (n) => {
    setPageSize(n);
    setPage(1);
  };

  return (
    <React.Fragment>
      <Omnibar
        icon="Briefcase"
        title="Requisitions"
        dayforce={{
          primitive: "Position",
          subtitle: "Pooled · occupantLimit = qty",
          product: "Position Management",
          strategy: "Bridge",
          note: "Each requisition becomes a Pooled Position; supplier list, bill rate, markup, and contract live on a sibling ContingentEngagement keyed by positionId.",
          anchor: "position",
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
        {/* Create requisition button.
            Hidden for the Agency role by default — agencies are
            recipients of requisitions, not creators. Exception:
            when Agency Pro is active (feature flag on, agency
            tenant, plan = Pro), the agency CAN create requisitions
            for their own direct clients, so the button comes back.
            See pages/agency-pro.jsx · useAgencyProActive. */}
        {(window.flexViewAsRole !== "agency" || agencyProActive) && (
          <button type="button" className="omni-create-btn" onClick={onCreate}>
            <Icon name="AddCircle" size={20} />
            <span>Create</span>
          </button>
        )}
        {/* Interview workflow entry point — only when the `interviews`
            feature flag is on. Labels per role: managers see "Interview
            pipeline" (M1–M12 surfaces); agencies see "Interview inbox"
            (S1–S10). Toggles the content area between the requisitions
            table and the interview surfaces. */}
        {interviewsOn && (
          <button
            type="button"
            className={"omni-iv-btn" + (interviewView ? " is-on" : "")}
            onClick={() => setInterviewView(!interviewView)}
            aria-label={viewAsRole === "agency" ? "Interview inbox" : "Interview pipeline"}
            title={viewAsRole === "agency" ? "Interview inbox" : "Interview pipeline"}
          >
            <Icon name="PersonClock" size={18} />
            <span>{viewAsRole === "agency" ? "Interview inbox" : "Interview pipeline"}</span>
          </button>
        )}
        {/* Note: "Customize this view" (Adjustment icon) used to live here.
            Moved down to the right edge of the status-tabs row so it sits
            next to the table it actually configures, rather than in the
            page-level top toolbar. See REQ_STATUS_TABS_STRIP below. */}
        <button
          type="button"
          className="iconbtn"
          aria-label="More actions"
          onClick={(e) => openMenu(e.currentTarget, toolbarMenuItems())}
        >
          <Icon name="MoreVert" size={20} />
        </button>
      </Omnibar>

      <div className="content-section req-content" key={reloadKey}>
        {/* v0.86 — Agency Projects card. Above the standard requisitions
            list when (a) the engProject flag is on and (b) the active
            tenant is an agency org. Surfaces pending team-proposal
            requests + active projects assigned to the supplier. Hidden
            entirely otherwise. */}
        {window.AgencyProjectsTab && window.PSProjects && window.PSProjects.isProjectOn()
          && (window.isAgencyOrg && window.isAgencyOrg()) && (
            <div style={{ marginBottom: 18 }}>
              <window.AgencyProjectsTab />
            </div>
        )}
        {/* Interview pipeline / inbox view — when active, the standard
            requisitions table is hidden and the role-specific interview
            surfaces render in its place. Toggle lives in the omnibar. */}
        {interviewView && interviewsOn ? (
          <div className="ivp-shell" style={{ padding: "8px 0 40px" }}>
            {viewAsRole === "agency" && window.InterviewAgencyPage ? (
              <window.InterviewAgencyPage />
            ) : window.InterviewManagerPage ? (
              <window.InterviewManagerPage />
            ) : (
              <div className="iv-empty"><p className="iv-empty-body">Interview surfaces not loaded.</p></div>
            )}
          </div>
        ) : (
        <React.Fragment>
        {/* v0.77 spec §09 + §19 · AxisScopeBar adoption. Sits alongside
            the legacy EngagementScope chip-bar through Phase 3 of the
            rollout. Both are flag-gated by the same enabledTypes()>1
            guard, so flag-off DOM stays byte-identical. The bar
            filters rows in addition to the per-axis chip-row. */}
        {window.AxisScopeBar && reqAxisHelpers ? (
          <window.AxisScopeBar
            scopes={["supplierType"]}
            value={reqAxisValue}
            onChange={reqAxisHelpers.setAxis}
            mode="multi"
            className="req-v77-scope"
          />
        ) : null}
        {(professionalOn || contractorsOn) && (
          <ReqEngagementScopeBar
            value={engagementType}
            onChange={setEngagementType}
            counts={{
              frontline:    REQUISITIONS.length,
              professional: window.getProfessionalRequisitions ? window.getProfessionalRequisitions().length : 0,
              contractor:   window.getContractorWorkers ? window.getContractorWorkers().length : 0,
            }}
          />
        )}
        {contractorsOn && engagementType === "contractor" && window.ContractorEngagementsTable ? (
          <window.ContractorEngagementsTable
            onOpenRow={(id) => window.flexGoTo && window.flexGoTo({ page: "workforce", sub: "details", id })}
          />
        ) : professionalOn && engagementType === "professional" ? (
          <ProfessionalRequisitionsTable onOpenRow={onOpenRow} />
        ) : (
          <React.Fragment>
            {/* Status tabs — rendered ABOVE the table card as the primary
                view filter (not table chrome). Per the comment from the
                user, this uses the Everest design-system Tabs group
                spec (48h, 4px bottom indicator, bold-active 16px) and
                drops the per-tab count pills. The chip filters inside
                the card continue to refine within the selected tab. */}
            <REQ_STATUS_TABS_STRIP active={statusTab} onChange={setStatusTab} />
          <RequisitionsTable
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
          </React.Fragment>
        )}
        </React.Fragment>
        )}
      </div>
    </React.Fragment>
  );
}

// ---------- Status tabs strip (Frontline) -------------------------------
// Lives ABOVE the table card. Renders via shared StatusTabs in the
// `everest` variant — same Everest design-system Tabs group spec used
// elsewhere (48h, 4px bottom indicator, bold-active 16px); no count
// pills, since the chip filters inside the card already convey scope.
const REQ_STATUS_TABS_LIST = [
  { id: "all",          label: "All" },
  { id: "Booked",       label: "Booked" },
  { id: "In progress",  label: "In progress" },
  { id: "Completed",    label: "Completed" },
];
function REQ_STATUS_TABS_STRIP({ active, onChange }) {
  return (
    <div className="req-tabs-row">
      <StatusTabs
        tabs={REQ_STATUS_TABS_LIST}
        active={active}
        onChange={onChange}
        variant="everest"
        ariaLabel="Filter requisitions by status"
      />
      {/* Customize this view — moved here from the page-level Omnibar so
          the column / filter picker sits with the table it configures. */}
      <button
        type="button"
        className="iconbtn req-tabs-customize"
        aria-label="Customize this view"
        title="Customize this view"
        onClick={(e) => {
          const vc = window.__activeVc;
          if (vc && vc.openPanel) { vc.openPanel(e.currentTarget); return; }
          openMenu(e.currentTarget, [{ icon: "Settings", label: "Column settings — coming soon" }]);
        }}
      >
        <Icon name="Adjustment" size={20} />
      </button>
    </div>
  );
}

Object.assign(window, { RequisitionsPage });
