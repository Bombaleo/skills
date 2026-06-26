// =====================================================================
// Flex Work — Locations
//   · LocationsPage         — segmented org-tree tabs that render the
//                              Dayforce hierarchy labels (Corporate ▸
//                              Regions ▸ Districts ▸ Sites ▸ On-Site
//                              Departments) with tooltips that preserve
//                              the old Flex Work names (Entity, Division,
//                              Sector, Location, Cost center). Each
//                              segment ships a filterable list with
//                              shift / spend counts.
//   · LocationDetailsPage   — name + address hero, 2 quick-action cards,
//                              5 empty accordions (same coming-soon empty
//                              state as Requisition details).
// =====================================================================

const { useState: useStateLoc, useMemo: useMemoLoc } = React;

// ---------- Mock data ----------------------------------------------------
// Manufacturing-flavoured base data; gets re-labeled via window.localizeAll
// when a non-Manufacturing industry is active. See pages/industry.jsx.
const LOCATIONS_RAW_BASE = [
  { id: "loc-647", name: "Manufacturing Site #647",  status: "Active",     address: "1234 Industrial Way, Springfield, IL",  shifts: 142, spend: "$48,320", openReqs: 4, workers: 18, locationId: "19dab1…1e1171" },
  { id: "loc-231", name: "Sam’s Chalet #231",        status: "Active",     address: "55 Lake Drive, Aspen, CO",              shifts: 89,  spend: "$31,475", openReqs: 2, workers: 11, locationId: "84acd9…b2f04a" },
  { id: "loc-058", name: "Sam’s Chalet #058",        status: "Active",     address: "120 Mountain Rd., Vail, CO",            shifts: 76,  spend: "$28,910", openReqs: 1, workers: 9,  locationId: "62b1ce…78d3a2" },
  { id: "loc-035", name: "Warehouse #35",            status: "Active",     address: "8800 Cargo Blvd., Dallas, TX",          shifts: 124, spend: "$42,180", openReqs: 3, workers: 16, locationId: "f0a8b7…d51e09" },
  { id: "loc-014", name: "Warehouse #14",            status: "Active",     address: "2200 Lakeshore Dr., Chicago, IL",       shifts: 118, spend: "$39,720", openReqs: 2, workers: 14, locationId: "2c7fa1…a0bc44" },
  { id: "loc-dca", name: "Distribution Center Alpha",status: "Active",     address: "415 Logistics Pkwy., Atlanta, GA",      shifts: 167, spend: "$54,205", openReqs: 5, workers: 22, locationId: "8e21cd…0f9b72" },
  { id: "loc-fhd", name: "Freight Terminal Delta",   status: "Active",     address: "900 Harbor View, Long Beach, CA",       shifts: 95,  spend: "$33,540", openReqs: 2, workers: 12, locationId: "55d8a4…3e2f81" },
  { id: "loc-sfb", name: "Storage Facility Beta",    status: "Active",     address: "1450 Mockingbird Ln., Dallas, TX",      shifts: 108, spend: "$36,920", openReqs: 3, workers: 13, locationId: "0c92a4…5d1f87" },
  { id: "loc-lha", name: "Logistics Hub Alpha",      status: "Active",     address: "501 Riverfront Pkwy., Memphis, TN",     shifts: 142, spend: "$49,610", openReqs: 4, workers: 19, locationId: "47fab3…e08c25" },
  { id: "loc-sct", name: "Supply Chain Nexus",       status: "Active",     address: "1500 Trade Center, Indianapolis, IN",   shifts: 83,  spend: "$29,615", openReqs: 1, workers: 10, locationId: "a7bd1c…f54009" },
  { id: "loc-cdz", name: "Cargo Depot Zeta",         status: "Invited",    address: "44 Terminal Ave., Newark, NJ",          shifts: 0,   spend: "—",       openReqs: 0, workers: 0,  locationId: "—" },
  { id: "loc-sdt", name: "Shipping Dock Theta",      status: "Invited",    address: "201 Pier 7, Seattle, WA",               shifts: 0,   spend: "—",       openReqs: 0, workers: 0,  locationId: "—" },
  { id: "loc-ihk", name: "Inventory Warehouse Kappa",status: "Active",     address: "6200 Storage Way, Phoenix, AZ",         shifts: 52,  spend: "$18,940", openReqs: 1, workers: 7,  locationId: "1f44ce…b8d20a" },
  { id: "loc-tlh", name: "Transport Hub Kappa",      status: "Terminated", address: "3500 Old Industrial Rd., Detroit, MI",  shifts: 12,  spend: "$4,210",  openReqs: 0, workers: 0,  locationId: "9b2a5e…71fd0c" },
];
// ---------- Temp-spend tier scaling -------------------------------------
// Inflate / shrink the row list AND scale per-row roll-ups (shifts /
// spend / openReqs / workers) through TEMP_SPEND_SCALE so each tier
// reads as a believable slice of operations: $1M = a couple of small
// sites, $500M+ = hundreds of busy sites. Synthetic clones get
// "Site #N" style names so the list still scans as real locations.
(function () {
  const inflate = window.inflateList;
  let scaled = LOCATIONS_RAW_BASE.slice();
  if (inflate) {
    scaled = inflate(scaled, {
      // Keep the IDs referenced by TRIAGE / REQUISITIONS so deep links
      // from the dashboard, schedule, and approvals never miss.
      preserveIds: ["loc-647","loc-035","loc-014","loc-dca","loc-fhd","loc-sfb","loc-lha","loc-sct","loc-ihk","loc-cdz","loc-sdt"],
      minRows: 5,
      maxRows: 180,
      makeClone: (src, n) => ({
        id: `${src.id}-c${n}`,
        name: `${src.name.replace(/\s*#\d+$/, "")} #${100 + n}`,
        locationId: src.locationId === "—" ? "—" : `${(Math.random().toString(16).slice(2, 8))}…${Math.random().toString(16).slice(2, 8)}`,
      }),
    });
  }
  const sSmall = window.scaleSmall || ((n) => n);
  const sMoney = window.scaleMoneyStr || ((s) => s);
  scaled.forEach((l) => {
    if (typeof l.shifts === "number" && l.shifts > 0)
      l.shifts   = Math.max(1, sSmall(l.shifts));
    if (typeof l.openReqs === "number" && l.openReqs > 0)
      l.openReqs = Math.max(1, sSmall(l.openReqs));
    if (typeof l.workers === "number" && l.workers > 0)
      l.workers  = Math.max(1, sSmall(l.workers));
    if (typeof l.spend === "string" && l.spend && l.spend !== "—")
      l.spend = sMoney(l.spend);
  });
  // Expose the post-inflation / post-scale array so downstream code
  // (industry localization, org-tree) sees the tier-shaped list.
  window.__LOCATIONS_RAW_SCALED = scaled;
})();
const LOCATIONS_RAW = window.__LOCATIONS_RAW_SCALED || LOCATIONS_RAW_BASE;
const LOCATIONS = (window.localizeAll || ((r) => r))(LOCATIONS_RAW, ["name", "address"]);

const LOC_PAGE_SIZE = 10;

// Segmented "org-tree" tabs — Locations is the focus of this build; the
// other segments hint at the broader hierarchy. Labels render with the
// Dayforce names (Corporate ▸ Regions ▸ Districts ▸ Sites ▸ On-Site
// Departments) via dfSegLabel(); the keys themselves stay Flex Work
// shaped because they're used as object keys everywhere.
// Internal keys: Entities ▸ Divisions ▸ Sectors ▸ Locations ▸ Cost Centers
const ORG_SEGMENTS = ["Entities", "Divisions", "Sectors", "Locations", "Cost Centers"];

// ---------- Status pill (reuses req-pill family + sup-status hues) ------
const LOC_STATUS_HUES = {
  "Active":     "success",
  "Invited":    "default",
  "Terminated": "default",
};

function LocStatusPill({ status }) {
  const hue = LOC_STATUS_HUES[status] || "default";
  return <span className={`req-pill req-pill--${hue}`}>{status}</span>;
}

// ---------- Org-scope tabs ----------------------------------------------
// Everest design-system Tabs group (48h, 4px bottom indicator, bold-active
// 16px) — sits directly below the omnibar as a primary view filter, the
// same pattern as Workforce / Analytics. Labels render with the Dayforce
// hierarchy names via dfSegLabel().
function OrgScopeTabs({ value, onChange }) {
  return (
    <StatusTabs
      variant="everest"
      ariaLabel="Organization scope"
      active={value}
      onChange={onChange}
      tabs={ORG_SEGMENTS.map((seg) => ({ id: seg, label: dfSegLabel(seg, true) }))}
      showCounts={false}
    />
  );
}

// ---------- Toolbar (search + icon buttons) above the table ------------
// Search lives on the LEFT, icon actions on the right — mirrors the
// Suppliers / Workforce / Invoices list toolbars. `placeholder` is
// dynamic so the input reads naturally on each org tier.
function LocationsToolbar({ segment, query, onQuery }) {
  // Search placeholder mirrors the active tier (Dayforce names) so the
  // input reads naturally on every segment.
  const placeholder = `Search ${dfSegLabel(segment, true).toLowerCase()}`;
  // Column hints surfaced in the column-picker affordance reflect the
  // active segment so the dropdown stays accurate as the user tabs across
  // tiers of the org tree.
  const columnsBySeg = {
    Entities:      [dfSegLabel("Entities"),    "Address",                dfSegLabel("Divisions", true), dfSegLabel("Locations", true)],
    Divisions:     [dfSegLabel("Divisions"),   dfSegLabel("Entities"),   dfSegLabel("Sectors", true),    "Spend (YTD)"],
    Sectors:       [dfSegLabel("Sectors"),     dfSegLabel("Divisions"),  dfSegLabel("Locations", true),  "Spend (YTD)"],
    Locations:     [dfSegLabel("Locations"),   "Status", "Address", "Shifts", "Spend"],
    "Cost Centers": [dfSegLabel("Cost Centers"),dfSegLabel("Locations"),  "Owner", "Spend (YTD)"],
  };
  return (
    <div className="inv-toolbar">
      <div className="inv-search" role="search">
        <span className="inv-search-icon" aria-hidden="true">
          <Icon name="Search" size={16} />
        </span>
        <input
          type="search"
          className="inv-search-input"
          placeholder={placeholder}
          value={query || ""}
          onChange={(e) => onQuery && onQuery(e.target.value)}
          aria-label={placeholder}
        />
      </div>
      <div className="inv-toolbar-actions">
        <ListToolbarActions kind="locations" columns={columnsBySeg[segment] || columnsBySeg.Locations} showMore={false} />
      </div>
    </div>
  );
}

// ---------- Row ---------------------------------------------------------
function LocationRow({ row, checked, onToggle, onOpen, vc }) {
  const show = (id) => !vc || vc.showCol(id);
  const rowMenu = (e) => {
    e.stopPropagation();
    openMenu(e.currentTarget, [
      { icon: "View",      label: "View site",  onClick: () => onOpen && onOpen(row.id) },
      { icon: "Edit",      label: "Edit site" },
      { icon: "Briefcase", label: "New requisition", onClick: () => showToast(`Starting requisition at ${row.name}`) },
      { icon: "Copy",      label: "Copy site ID", onClick: () => copyToClipboard(row.locationId, "Site ID copied") },
      { divider: true },
      row.status === "Active"
        ? { icon: "Cancel", label: "Deactivate", danger: true,
            onClick: () => openConfirm({
              title: `Deactivate ${row.name}?`,
              body: "This location will no longer accept new requisitions.",
              primaryLabel: "Deactivate",
              onConfirm: () => showToast(`${row.name} deactivated`, { kind: "success" }),
            }) }
        : { icon: "AddCircle", label: "Activate", onClick: () => showToast(`${row.name} activated`, { kind: "success" }) },
    ]);
  };
  return (
    <div
      className="req-row loc-row req-row--clickable"
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
          aria-label={`Select ${row.name}`}
        />
      </div>
      {show("name") && (
        <div className="req-cell loc-cell--name" role="cell">
          <span className="loc-row-name">{row.name}</span>
        </div>
      )}
      {show("status") && (
        <div className="req-cell loc-cell--status" role="cell">
          <LocStatusPill status={row.status} />
        </div>
      )}
      {show("address") && (
        <div className="req-cell loc-cell--addr" role="cell">
          <span className="loc-row-addr">{row.address}</span>
        </div>
      )}
      {show("shifts") && (
        <div className="req-cell loc-cell--shifts" role="cell">
          <span className="tabular">{row.shifts || "—"}</span>
        </div>
      )}
      {show("spend") && (
        <div className="req-cell loc-cell--spend" role="cell">
          <span className="req-bill tabular">{row.spend}</span>
        </div>
      )}
      <div className="req-cell loc-cell--actions" role="cell">
        <button
          type="button"
          className="iconbtn"
          aria-label={`More actions for ${row.name}`}
          onClick={rowMenu}
        >
          <Icon name="MoreVert" size={18} />
        </button>
      </div>
    </div>
  );
}

// ---------- Header cell --------------------------------------------------
function LocHeaderCell({ children, className = "", align = "left", title }) {
  return (
    <div
      className={`req-cell ${className}`}
      role="columnheader"
      style={align === "right" ? { justifyContent: "flex-end" } : undefined}
    >
      <span title={title || undefined}>{children}</span>
      <span className="req-sort" aria-hidden="true" title="Sort">
        <Icon name="ArrowsUpDownSmall" size={14} />
      </span>
    </div>
  );
}

// ---------- Table --------------------------------------------------------
function LocationsTable({ rows, total, page, totalPages, onPageChange, pageSize, onPageSizeChange, onOpenRow, f }) {
  const [selected, setSelected] = useStateLoc(() => new Set());
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

  // -- Bulk actions unique to Locations --------------------------------
  // Site ops shuffle locations between supplier rules, policy packs,
  // managers, and regional groups. We surface the four highest-leverage
  // bulk moves; archive is destructive so it gets the danger slot.
  const bulkActLoc = (msg, kind = "success") => {
    if (window.showToast) window.showToast(msg, { kind });
    setSelected(new Set());
  };
  const nLoc = selected.size;
  const sumLoc = `${nLoc} ${nLoc === 1 ? dfSegLabel("Locations").toLowerCase() : dfSegLabel("Locations", true).toLowerCase()}`;
  const bulkActionsLoc = [
    { icon: "ShieldPerson", label: "Distribute",  onClick: () => bulkActLoc(`Distribution rule applied to ${sumLoc}`) },
    { icon: "Gavel",        label: "Apply policy", onClick: () => bulkActLoc(`Policy pack applied to ${sumLoc}`) },
    { icon: "PersonArrow",  label: "Reassign",    onClick: () => bulkActLoc(`Manager reassigned for ${sumLoc}`) },
    { icon: "Stack",        label: "Add to group", onClick: () => bulkActLoc(`Added ${sumLoc} to group`) },
    { icon: "FileDownload", label: "Export",      onClick: () => bulkActLoc(`Exported ${sumLoc} to CSV`) },
    { divider: true },
    { icon: "TrashCan",     label: "Archive",     onClick: () => bulkActLoc(`Archived ${sumLoc}`, "warning"), kind: "danger" },
  ];
  const bulkOverflowLoc = [
    { icon: "TimeUndo",   label: "Pause work assignments",         onClick: () => bulkActLoc(`Work assignments paused at ${sumLoc}`, "warning") },
    { icon: "Notes",      label: "Add site note",          onClick: () => bulkActLoc(`Note added to ${sumLoc}`) },
    { icon: "Refresh",    label: "Sync from master data",  onClick: () => bulkActLoc(`${sumLoc} re-synced from master data`) },
  ];

  // ---- View customizer ------------------------------------------------
  const locVcManifest = React.useMemo(() => ({
    columns: [
      { id: "name",    label: dfSegLabel("Locations"), width: "minmax(220px, 1.4fr)" },
      { id: "status",  label: "Status",  width: "minmax(110px, 0.7fr)" },
      { id: "address", label: "Address", width: "minmax(220px, 1.6fr)" },
      { id: "shifts",  label: "Shifts",  width: "80px" },
      { id: "spend",   label: "Spend",   width: "120px" },
    ],
    filters: [
      { id: "status",    label: "Status" },
      { id: "region",    label: "Region" },
      { id: "type",      label: "Type" },
      { id: "onboarded", label: "Onboarded" },
    ],
  }), []);
  const vc = useViewCustomizer("locations", locVcManifest);
  const locGridStyle = vc.gridStyle
    ? { gridTemplateColumns: `44px ${vc.gridStyle.gridTemplateColumns} 52px` }
    : undefined;
  const vcRow = { ...vc, gridStyle: locGridStyle };

  return (
    <React.Fragment>
    <div className="req-table-card loc-table-card" role="table" aria-label="Sites">
      <div className="req-filters">
        <div className="req-filters-left">
          {vc.showFilter("status")    && <FilterChip label="Status"    active={f.filters.status.length > 0}    count={f.filters.status.length}    onClick={f.openFor("status",    "Status",    ["Active", "Invited", "Terminated"])} />}
          {vc.showFilter("region")    && <FilterChip label="Region"    active={f.filters.region.length > 0}    count={f.filters.region.length}    onClick={f.openFor("region",    "Region",    ["East", "Central", "West", "South"])} />}
          {vc.showFilter("type")      && <FilterChip label="Type"      active={f.filters.type.length > 0}      count={f.filters.type.length}      onClick={f.openFor("type",      "Type",      ["Warehouse", "Distribution", "Manufacturing", "Retail"])} />}
          {vc.showFilter("onboarded") && <FilterChip label="Onboarded" active={f.filters.onboarded.length > 0} count={f.filters.onboarded.length} onClick={f.openFor("onboarded", "Onboarded", ["This year", "Last year", "Older than 1 year"])} />}
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
        <div className="req-row loc-row req-row--header" role="row" style={locGridStyle}>
          <div className="req-cell req-cell--check" role="columnheader">
            <input
              type="checkbox"
              checked={allChecked}
              onChange={toggleAll}
              aria-label="Select all rows on this page"
            />
          </div>
          {vc.showCol("name")    && <LocHeaderCell className="loc-cell--name" title={dfSegTooltip("Locations")}>{dfSegLabel("Locations")}</LocHeaderCell>}
          {vc.showCol("status")  && <LocHeaderCell className="loc-cell--status">Status</LocHeaderCell>}
          {vc.showCol("address") && <LocHeaderCell className="loc-cell--addr">Address</LocHeaderCell>}
          {vc.showCol("shifts")  && <LocHeaderCell className="loc-cell--shifts" align="right">Shifts</LocHeaderCell>}
          {vc.showCol("spend")   && <LocHeaderCell className="loc-cell--spend"  align="right">Spend</LocHeaderCell>}
          <div className="req-cell loc-cell--actions" role="columnheader" aria-label=""></div>
        </div>

        <div className="req-body" role="rowgroup">
          {rows.map((row) => (
            <LocationRow
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
      noun={dfSegLabel("Locations").toLowerCase()}
      onClear={() => setSelected(new Set())}
      actions={bulkActionsLoc}
      overflow={bulkOverflowLoc}
    />
    {vc.panel}
    </React.Fragment>
  );
}

// ---------- Org-segment table (non-Locations) ---------------------------
// Renders a list of org nodes for the active segment. Rows are pulled
// from ORG_RAW (defined in pages/org-tree.jsx) so the list view, the
// detail page, and the descendant tables all stay in lock-step. Clicking
// a row opens that node's detail page where the user can act on every
// child or a hand-picked subset.
function OrgSegmentEmpty({ segment, query = "", onOpenOrgNode }) {
  // Pull the live rows for this segment from ORG_RAW. Falling back to []
  // means a missing global (e.g. mid-reload) renders an empty table
  // rather than throwing.
  const raw = (typeof ORG_RAW !== "undefined") ? ORG_RAW : null;
  const segData = {
    "Entities":     raw ? raw.entities     : [],
    "Divisions":    raw ? raw.divisions    : [],
    "Sectors":      raw ? raw.sectors      : [],
    "Cost Centers": raw ? raw.costCenters  : [],
  }[segment] || [];

  // Helpers safe-bound to globals from org-tree.jsx.
  const kids = (id) => (typeof orgChildren === "function") ? orgChildren(id) : [];
  const descs = (id) => (typeof orgDescendantsBySegment === "function") ? orgDescendantsBySegment(id) : { Divisions:[], Sectors:[], Locations:[], "Cost Centers": [] };
  const byId = (id) => (typeof ORG_INDEX !== "undefined") ? ORG_INDEX.byId[id] : null;

  const columnsBySegment = {
    Entities: [
      { key: "name",      label: dfSegLabel("Entities"),    tooltip: dfSegTooltip("Entities"),    width: "1.8fr",
        render: (r) => <span className="loc-row-name">{r.name}</span> },
      { key: "address",   label: "Address",                                                       width: "2.4fr",
        render: (r) => <span className="loc-row-addr">{r.address}</span> },
      { key: "divisions", label: dfSegLabel("Divisions", true), tooltip: dfSegTooltip("Divisions", true), width: "0.9fr", align: "right",
        render: (r) => <span className="tabular">{kids(r.id).length}</span> },
      { key: "locations", label: dfSegLabel("Locations", true), tooltip: dfSegTooltip("Locations", true), width: "0.9fr", align: "right",
        render: (r) => <span className="tabular">{descs(r.id).Locations.length}</span> },
      { key: "rule",      label: "Supplier rule",                                                  width: "1.1fr",
        render: (r) => renderOrgDistribution(r, segment) },
    ],
    Divisions: [
      { key: "name",      label: dfSegLabel("Divisions"),   tooltip: dfSegTooltip("Divisions"),   width: "1.6fr",
        render: (r) => <span className="loc-row-name">{r.name}</span> },
      { key: "entity",    label: dfSegLabel("Entities"),    tooltip: dfSegTooltip("Entities"),    width: "1.6fr",
        render: (r) => <span className="loc-row-addr">{byId(r.parentId)?.name || "—"}</span> },
      { key: "sectors",   label: dfSegLabel("Sectors", true),   tooltip: dfSegTooltip("Sectors", true),   width: "0.8fr", align: "right",
        render: (r) => <span className="tabular">{kids(r.id).length}</span> },
      { key: "locations", label: dfSegLabel("Locations", true), tooltip: dfSegTooltip("Locations", true), width: "0.8fr", align: "right",
        render: (r) => <span className="tabular">{descs(r.id).Locations.length}</span> },
      { key: "spendYTD",  label: "Spend (YTD)",                                                    width: "1fr", align: "right",
        render: (r) => <span className="tabular">{r.spendYTD || "—"}</span> },
      { key: "rule",      label: "Supplier rule",                                                  width: "1.1fr",
        render: (r) => renderOrgDistribution(r, segment) },
    ],
    Sectors: [
      { key: "name",      label: dfSegLabel("Sectors"),     tooltip: dfSegTooltip("Sectors"),     width: "1.4fr",
        render: (r) => <span className="loc-row-name">{r.name}</span> },
      { key: "parent",    label: dfSegLabel("Divisions"),   tooltip: dfSegTooltip("Divisions"),   width: "1.4fr",
        render: (r) => <span className="loc-row-addr">{byId(r.parentId)?.name || "—"}</span> },
      { key: "owner",     label: "Owner",                                                          width: "1.2fr" },
      { key: "locations", label: dfSegLabel("Locations", true), tooltip: dfSegTooltip("Locations", true), width: "0.7fr", align: "right",
        render: (r) => <span className="tabular">{kids(r.id).length}</span> },
      { key: "spendYTD",  label: "Spend (YTD)",                                                    width: "1fr", align: "right",
        render: (r) => <span className="tabular">{r.spendYTD || "—"}</span> },
      { key: "rule",      label: "Supplier rule",                                                  width: "1.1fr",
        render: (r) => renderOrgDistribution(r, segment) },
    ],
    "Cost Centers": [
      { key: "name",     label: dfSegLabel("Cost Centers"), tooltip: dfSegTooltip("Cost Centers"), width: "1.2fr",
        render: (r) => <span className="loc-row-name">{r.name}</span> },
      { key: "location", label: dfSegLabel("Locations"),   tooltip: dfSegTooltip("Locations"),   width: "1.6fr",
        render: (r) => <span className="loc-row-addr">{byId(r.parentId)?.name || "—"}</span> },
      { key: "owner",    label: "Owner",                                                          width: "1.2fr" },
      { key: "spendYTD", label: "Spend (YTD)",                                                    width: "0.9fr", align: "right",
        render: (r) => <span className="tabular">{r.spendYTD || "—"}</span> },
      { key: "rule",     label: "Supplier rule",                                                   width: "1.1fr",
        render: (r) => renderOrgDistribution(r, segment) },
    ],
  };

  const cols = columnsBySegment[segment];
  if (!cols) return null;
  const gridTemplate = `44px ${cols.map((c) => c.width || "1fr").join(" ")} 52px`;

  // Multi-select state for bulk actions.
  const [selected, setSelected] = useStateLoc(() => new Set());
  // Reset selection if the segment or row count shifts so stale ids
  // don't linger.
  React.useEffect(() => { setSelected(new Set()); }, [segment]);

  // Filter rows by search query. Every string field is fair game so the
  // input keeps working as the data shape evolves.
  const q = (query || "").trim().toLowerCase();
  const visibleData = !q ? segData : segData.filter((row) =>
    Object.values(row).some((v) => typeof v === "string" && v.toLowerCase().includes(q))
  );

  const allChecked = visibleData.length > 0 && visibleData.every((r) => selected.has(r.id));
  const toggle = (id) => setSelected((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const toggleAll = () => setSelected((prev) => {
    const next = new Set(prev);
    if (allChecked) visibleData.forEach((r) => next.delete(r.id));
    else            visibleData.forEach((r) => next.add(r.id));
    return next;
  });
  const clear = () => setSelected(new Set());

  // Open the node's detail page. Falls back to the distribution panel
  // when no navigation handler is wired (e.g. from places that render
  // OrgSegmentEmpty in isolation).
  const openNode = (row) => {
    if (typeof onOpenOrgNode === "function") onOpenOrgNode(row.id);
    else openDistroOverridePanel({
      scopeName: row.name,
      scopeSegment: segment,
      initial: GLOBAL_DEFAULTS,
      onSave: () => {},
    });
  };

  // Bulk action runner — every action accepts the current selection set.
  // `rule` is the marquee action: it opens the distribution panel with a
  // synthesized multi-target scope so the rule is applied to every
  // selected node.
  const segLow = dfSegLabel(segment, true).toLowerCase();
  const sumLabel = `${selected.size} ${segLow}`;
  const onAction = (which) => {
    const ids = Array.from(selected);
    const targets = ids.map((id) => byId(id)).filter(Boolean);
    if (which === "rule") {
      openDistroOverridePanel({
        scopeName: sumLabel,
        scopeSegment: segment,
        initial: GLOBAL_DEFAULTS,
        bulkTargets: targets,
        onSave: () => { clear(); showToast(`Supplier rule applied to ${sumLabel}`, { kind: "success" }); },
      });
      return;
    }
    if (which === "policy")   { showToast(`Policy applied to ${sumLabel}`, { kind: "success" }); clear(); return; }
    if (which === "reassign") { showToast(`Owner reassignment started for ${sumLabel}`); return; }
    if (which === "export")   { showToast(`Exporting ${sumLabel} as CSV…`); return; }
    if (which === "deactivate") {
      openConfirm({
        title: `Deactivate ${sumLabel}?`,
        body: `These ${segLow} will stop accepting new requisitions. You can reactivate later.`,
        primaryLabel: "Deactivate",
        danger: true,
        onConfirm: () => { clear(); showToast(`${sumLabel} deactivated`, { kind: "success" }); },
      });
    }
  };

  return (
    <React.Fragment>
    <div className="req-table-card org-table-card" role="table" aria-label={dfSegLabel(segment, true)}>
      {/* MSP-only filter bar. The org segments (Corporate / Regions /
          Districts / Departments) carry no page-level filter chips of
          their own, but MSP mode injects a "Tenant" chip into every
          .req-filters-left it finds. Sites already had this bar via
          LocationsTable; rendering one here extends tenant filtering to
          every org type. Hidden for non-MSP users via CSS (gated on
          body.msp-mode-on) so the default product chrome is unchanged. */}
      <div className="req-filters org-msp-filters">
        <div className="req-filters-left"></div>
      </div>
      <div className="req-scroll">
        <div className="req-row org-row req-row--header" role="row" style={{ gridTemplateColumns: gridTemplate }}>
          <div className="req-cell req-cell--check" role="columnheader">
            <input
              type="checkbox"
              checked={allChecked}
              onChange={toggleAll}
              aria-label={`Select all ${segLow}`}
            />
          </div>
          {cols.map((c) => (
            <div
              key={c.key}
              className="req-cell"
              role="columnheader"
              style={{ justifyContent: c.align === "right" ? "flex-end" : "flex-start" }}
            >
              <span className="loc-th-label" title={c.tooltip || undefined}>{c.label}</span>
            </div>
          ))}
          <div className="req-cell" role="columnheader" aria-label=""></div>
        </div>

        <div className="req-body" role="rowgroup">
          {visibleData.length === 0 && (
            <div className="req-row" role="row" style={{ gridTemplateColumns: gridTemplate, padding: "32px 16px" }}>
              <div style={{ gridColumn: `1 / -1`, textAlign: "center", color: "var(--evr-content-primary-lowemp)" }}>
                No {segLow} match &ldquo;{query}&rdquo;
              </div>
            </div>
          )}
          {visibleData.map((row) => {
            const isChecked = selected.has(row.id);
            return (
              <div
                key={row.id}
                className={`req-row org-row req-row--clickable${isChecked ? " ot-row--selected" : ""}`}
                role="row"
                tabIndex={0}
                style={{ gridTemplateColumns: gridTemplate }}
                onClick={(e) => {
                  if (e.target.closest("input,a,button")) return;
                  openNode(row);
                }}
                onKeyDown={(e) => { if (e.key === "Enter") openNode(row); }}
              >
                <div className="req-cell req-cell--check" role="cell" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => toggle(row.id)}
                    aria-label={`Select ${row.name}`}
                  />
                </div>
                {cols.map((c) => (
                  <div
                    key={c.key}
                    className="req-cell"
                    role="cell"
                    style={{ justifyContent: c.align === "right" ? "flex-end" : "flex-start" }}
                  >
                    {c.render ? c.render(row) : <span>{row[c.key]}</span>}
                  </div>
                ))}
                <div className="req-cell" role="cell" style={{ justifyContent: "flex-end" }} onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    className="iconbtn"
                    aria-label={`Row actions for ${row.name}`}
                    title="More actions"
                    onClick={(e) => openMenu(e.currentTarget, [
                      { icon: "View",         label: `Open ${segLow.replace(/s$/, "")}`,
                        onClick: () => openNode(row) },
                      { icon: "ShieldPerson", label: "Set supplier rule",
                        onClick: () => openDistroOverridePanel({
                          scopeName: row.name,
                          scopeSegment: segment,
                          initial: GLOBAL_DEFAULTS,
                          onSave: () => showToast(`Supplier rule applied to ${row.name}`, { kind: "success" }),
                        }) },
                      { icon: "Edit",         label: `Edit ${segLow.replace(/s$/, "")}`,
                        onClick: () => showToast(`Edit ${row.name}`) },
                      { icon: "Copy",         label: "Copy ID",
                        onClick: () => copyToClipboard(row.id, "ID copied") },
                      { divider: true },
                      { icon: "TrashCan",     label: `Remove ${segLow.replace(/s$/, "")}`, danger: true,
                        onClick: () => openConfirm({
                          title: `Remove ${row.name}?`,
                          body: `This will remove ${row.name} from the organization tree.`,
                          primaryLabel: "Remove",
                          onConfirm: () => showToast(`${row.name} removed`, { kind: "success" }),
                        }) },
                    ])}
                  >
                    <Icon name="MoreVert" size={16} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>

    {/* Bulk-action bar — only shows when ≥1 row is selected. Apply
        actions to the chosen rows; for the "whole scope" affordance,
        users open the node detail page (header action). */}
    <BulkActionBar
      count={selected.size}
      noun={segment.toLowerCase().replace(/s$/, "")}
      onClear={clear}
      actions={[
        { icon: "ShieldPerson", label: "Distribute",   onClick: () => onAction("rule") },
        { icon: "Gavel",        label: "Apply policy", onClick: () => onAction("policy") },
        { icon: "PersonArrow",  label: "Reassign",     onClick: () => onAction("reassign") },
        { icon: "FileDownload", label: "Export",       onClick: () => onAction("export") },
        { divider: true },
        { icon: "Cancel",       label: "Deactivate",   onClick: () => onAction("deactivate"), kind: "danger" },
      ]}
    />
    </React.Fragment>
  );
}

// Render helper — shows the distribution rule for an org node in the org-tree
// mini-tables. Custom rules get a strategy pill; everything else gets a quiet
// "Inherited" badge.
function renderOrgDistribution(row, segment) {
  const ovr = (typeof ORG_OVERRIDE_FOR === "function") ? ORG_OVERRIDE_FOR(row.id) : null;
  if (ovr) {
    return (
      <span className="org-dx" title={ovr.summary}>
        <StrategyChip kind={ovr.strategy} />
        <span className="org-dx-custom">Custom</span>
      </span>
    );
  }
  return <span className="org-dx-inherit">Inherited</span>;
}

// ---------- List page ---------------------------------------------------
// Region / type are inferred from address state and location name since
// the underlying data doesn't carry these fields directly. Buckets the
// same way the filter chip presents them so picking a value narrows the
// list to rows the user would actually expect.
const LOC_REGION_BY_STATE = {
  // East
  CT:"East", DE:"East", FL:"East", GA:"East", MA:"East", MD:"East", ME:"East",
  NC:"East", NH:"East", NJ:"East", NY:"East", PA:"East", RI:"East", SC:"East",
  VA:"East", VT:"East", WV:"East", DC:"East",
  // Central
  IA:"Central", IL:"Central", IN:"Central", KS:"Central", KY:"Central",
  MI:"Central", MN:"Central", MO:"Central", ND:"Central", NE:"Central",
  OH:"Central", SD:"Central", TN:"Central", WI:"Central",
  // South
  AL:"South", AR:"South", LA:"South", MS:"South", OK:"South", TX:"South",
  // West
  AK:"West", AZ:"West", CA:"West", CO:"West", HI:"West", ID:"West", MT:"West",
  NM:"West", NV:"West", OR:"West", UT:"West", WA:"West", WY:"West",
};
function _locStateOf(addr) {
  const m = /,\s*([A-Z]{2})\b/.exec(String(addr || ""));
  return m ? m[1] : null;
}
function _locRegionOf(row) {
  const st = _locStateOf(row.address);
  return (st && LOC_REGION_BY_STATE[st]) || null;
}
function _locTypeOf(row) {
  const n = String(row.name || "").toLowerCase();
  if (/(warehouse|storage|inventory)/.test(n))                  return "Warehouse";
  if (/(distribution|logistics|freight|cargo|shipping|hub|terminal|depot|transport|supply chain)/.test(n)) return "Distribution";
  if (/(manufactur|plant|factory|production)/.test(n))           return "Manufacturing";
  if (/(retail|store|chalet|shop)/.test(n))                      return "Retail";
  return "Warehouse";
}
const LOC_ONBOARDED_BUCKETS = ["This year", "Last year", "Older than 1 year"];
const LOC_FILTER_MATCHERS = {
  status:    (row, vals) => vals.includes(row.status),
  region:    (row, vals) => vals.includes(_locRegionOf(row)),
  type:      (row, vals) => vals.includes(_locTypeOf(row)),
  onboarded: (row, vals) => vals.includes(bucketByHash(row.id, LOC_ONBOARDED_BUCKETS)),
};

function LocationsPage({ reloadKey, onReload, onOpenRow, onOpenOrgNode }) {
  const [page, setPage] = useStateLoc(1);
  const [pageSize, setPageSize] = useStateLoc(LOC_PAGE_SIZE);
  const [segment, setSegment] = useStateLoc("Locations");
  const [query, setQuery] = useStateLoc("");
  const f = useFilters({ status: [], region: [], type: [], onboarded: [] });

  // Reset to page 1 when search, segment, or filter chips change.
  React.useEffect(() => { setPage(1); }, [query, segment, f.filters]);

  const filtered = useMemoLoc(() => {
    let list = LOCATIONS;
    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter((l) =>
        l.name.toLowerCase().includes(q) ||
        l.address.toLowerCase().includes(q) ||
        l.status.toLowerCase().includes(q)
      );
    }
    return applyFilters(list, f.filters, LOC_FILTER_MATCHERS);
  }, [query, f.filters]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const rows = useMemoLoc(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize]);

  const handlePageSizeChange = (n) => { setPageSize(n); setPage(1); };

  const isAgency = window.flexViewAsRole === "agency";
  return (
    <React.Fragment>
      <Omnibar
        icon={isAgency ? "Building" : "OrgChartVert"}
        title={isAgency ? "Clients" : "Organization"}
        dayforce={{
          primitive: "OrgUnit",
          subtitle: "type = Site · effective-dated",
          product: "Org Setup",
          strategy: "Rebuild",
          note: "The Flex Work LOCATIONS table retires; canonical rows come from Dayforce OrgUnits with parentage, legal entity, coordinates, and effective dating. VMS-specific fields (Invited lifecycle, aliases) ride on a FlexWorkLocationProfile sidecar keyed by orgUnitId.",
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
        {!isAgency && (
          <button
            type="button"
            className="omni-create-btn"
            onClick={() => openEditEntity({
              ...newLocationSchema(),
              onSave: (vals) => showToast(`${vals.name || "Location"} created`, { kind: "success" }),
            })}
          >
            <Icon name="AddCircle" size={20} />
            <span>Create</span>
          </button>
        )}
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
        <OrgScopeTabs value={segment} onChange={setSegment} />
        <LocationsToolbar segment={segment} query={query} onQuery={setQuery} />
        {segment === "Locations" ? (
          <LocationsTable
            rows={rows}
            total={filtered.length}
            page={page}
            totalPages={totalPages}
            pageSize={pageSize}
            onPageSizeChange={handlePageSizeChange}
            onPageChange={setPage}
            onOpenRow={onOpenRow}
            f={f}
          />
        ) : (
          <OrgSegmentEmpty segment={segment} query={query} onOpenOrgNode={onOpenOrgNode} />
        )}
      </div>
    </React.Fragment>
  );
}

// ==========================================================================
// Location Details
// ==========================================================================

function LocAccordionCard({ icon, title, defaultOpen = false, count, children }) {
  // All accordion sections start collapsed by default, app-wide. The
  // `defaultOpen` prop is kept for API compatibility but intentionally
  // ignored so every detail page opens fully collapsed.
  const [open, setOpen] = useStateLoc(false);
  const id = React.useId();
  return (
    <section className="acc-card">
      <button
        type="button"
        className="acc-card-head"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="acc-card-avatar" aria-hidden="true">
          <Icon name={icon} size={20} />
        </span>
        <h2 className="acc-card-title">{title}</h2>
        {typeof count === "number" && (
          <span className="acc-card-count tabular" aria-label={`${count} items`}>{count}</span>
        )}
        <span className="acc-card-chev" data-open={open} aria-hidden="true">
          <Icon name="ChevronDown" size={20} />
        </span>
      </button>
      {open && (
        <div id={id} className="acc-card-body">
          {children}
        </div>
      )}
    </section>
  );
}

function LocComingSoon() { return null; /* legacy — every accordion now renders a real body */ }

// ---------- Real bodies for the Location Details accordions ----------

function LocDetailsBody({ loc }) {
  return (
    <InfoGrid
      rows={[
        { label: "Address",        value: loc.address },
        { label: "Type",           value: "Warehouse" },
        { label: "Region",         value: loc.address.split(",").pop().trim() },
        { label: "Operating hours",value: "Mon – Fri, 6:00 AM – 10:00 PM" },
        { label: "Site contact",   value: "Site supervisor" },
        { label: "Phone",          value: "+1 (555) 123-4567", tabular: true },
        { label: "Site ID",    value: loc.locationId, tabular: true, copyable: true },
        { label: "Onboarded",      value: "Jan 12, 2024" },
      ]}
    />
  );
}

function LocScheduleBody({ loc }) {
  const shifts = [
    { mo: "NOV", day: "04", role: "3 Production Associates", time: "6:00 AM – 3:00 PM", location: "—", status: "Scheduled",   statusHue: "default" },
    { mo: "NOV", day: "05", role: "3 Production Associates", time: "6:00 AM – 3:00 PM", location: "—", status: "Scheduled",   statusHue: "default" },
    { mo: "NOV", day: "06", role: "2 Line Managers",      time: "7:00 AM – 4:00 PM", location: "—", status: "Confirmed",   statusHue: "success" },
    { mo: "NOV", day: "07", role: "5 Pickers",            time: "8:00 AM – 4:00 PM", location: "—", status: "In progress", statusHue: "informative" },
    { mo: "NOV", day: "10", role: "4 Warehouse Clerks",   time: "8:00 AM – 4:00 PM", location: "—", status: "Pending",     statusHue: "warning" },
  ];
  return (
    <React.Fragment>
      <DgSubhead title="Upcoming shifts" action={(
        <button
          type="button"
          className="linkbtn"
          onClick={() => showToast(`Opening full schedule for ${loc.name}`)}
        >
          View full schedule
        </button>
      )} />
      <ScheduleStrip shifts={shifts} />
    </React.Fragment>
  );
}

function LocRequisitionsBody({ loc }) {
  const rows = (typeof REQUISITIONS !== "undefined" ? REQUISITIONS : []).filter((r) => r.location === loc.name).slice(0, 6);
  return (
    <MiniTable
      empty={`No requisitions at ${loc.name} yet.`}
      columns={[
        { key: "id",     label: "Requisition", width: "1.4fr", render: (r) => <span className="tabular">{r.id}</span> },
        { key: "status", label: "Status",      width: "1fr",   render: (r) => <span className={`req-pill req-pill--${({Booked:"default","In progress":"informative",Completed:"success"})[r.status]||"default"}`}>{r.status}</span> },
        { key: "jobs", label: "Job assignments",        width: "1.4fr", render: (r) => r.jobs.join(", ") },
        { key: "dates",  label: "Dates",       width: "1.6fr", render: (r) => r.dates.join(", ") },
        { key: "bill",   label: "Bill",        width: "0.8fr", align: "right", render: (r) => <span className="tabular">{r.bill}</span> },
      ]}
      rows={rows}
      onRowClick={(r) => showToast(`Opening Requisition #${r.id}`)}
    />
  );
}

function LocWorkforceBody({ loc }) {
  // Show first N workers — synthesized regional mapping (the prototype
  // doesn't track which worker is at which location).
  const rows = (typeof WORKERS !== "undefined" ? WORKERS : []).slice(0, Math.min(loc.workers || 4, 6));
  return (
    <MiniTable
      empty={`No workers active at ${loc.name}.`}
      columns={[
        { key: "name",     label: "Worker",   width: "1.6fr" },
        { key: "supplier", label: "Supplier", width: "1.4fr", render: (r) => REQ_SUPPLIERS[r.supplier]?.label || r.supplier },
        { key: "jobs", label: "Job assignments",     width: "1.6fr", render: (r) => r.jobs.join(", ") },
        { key: "shifts",   label: "Shifts",   width: "0.8fr", align: "right", render: (r) => <span className="tabular">{r.shifts}</span> },
      ]}
      rows={rows}
      onRowClick={(r) => showToast(`Opening ${r.name}`)}
    />
  );
}

function LocDistributionBody({ loc }) {
  const override = (typeof ORG_OVERRIDE_FOR === "function") ? ORG_OVERRIDE_FOR(loc.id) : null;
  const [hasOverride, setHasOverride] = useStateLoc(!!override);
  const [customValue, setCustomValue] = useStateLoc(typeof GLOBAL_DEFAULTS !== "undefined" ? GLOBAL_DEFAULTS : null);
  if (!customValue) return null;
  const effective = hasOverride ? customValue : GLOBAL_DEFAULTS;
  return (
    <div>
      <DistroSummary
        value={effective}
        isOverride={hasOverride}
        scopeLabel="Inherited from the organization default"
      />
      <div className="dx-acc-actions">
        {hasOverride ? (
          <React.Fragment>
            <button
              type="button"
              className="btn btn--md btn--tertiary"
              onClick={() => openConfirm({
                title: `Clear custom rule for ${loc.name}?`,
                body: `${loc.name} will fall back to the organization-wide default.`,
                primaryLabel: "Clear override",
                onConfirm: () => {
                  setHasOverride(false);
                  setCustomValue(GLOBAL_DEFAULTS);
                  showToast(`${loc.name} now follows the global default`, { kind: "success" });
                },
              })}
            >
              Clear override
            </button>
            <button
              type="button"
              className="btn btn--md btn--secondary"
              onClick={() => openDistroOverridePanel({
                scopeName: loc.name,
                scopeSegment: "Locations",
                initial: customValue,
                onSave: (v) => setCustomValue(v),
              })}
            >
              <Icon name="Edit" size={16} />Edit custom rule
            </button>
          </React.Fragment>
        ) : (
          <button
            type="button"
            className="btn btn--md btn--secondary"
            onClick={() => openDistroOverridePanel({
              scopeName: loc.name,
              scopeSegment: "Locations",
              initial: GLOBAL_DEFAULTS,
              onSave: (v) => { setHasOverride(true); setCustomValue(v); },
            })}
          >
            <Icon name="ShieldPerson" size={16} />Set custom rule for this location
          </button>
        )}
      </div>
    </div>
  );
}

function LocLogsBody({ loc }) {
  // Location-shaped audit trail: activation, requisitions opened against
  // this site, the latest invoice tied to it, real worker-count, and
  // status-driven last entries (Invited vs Terminated vs Active).
  const locReqs = (typeof REQUISITIONS !== "undefined" ? REQUISITIONS : []).filter((r) => r.location === loc.name).slice(0, 3);
  const locInvs = (typeof INVOICES !== "undefined" ? INVOICES : []).filter((i) => i.location === loc.name);
  const recentInv = locInvs.find((i) => i.status === "Paid") || locInvs[0];
  const firstReq = locReqs[0];
  const cityState = (loc.address || "").split(",").slice(-2).join(",").trim();

  const items = [];

  if (loc.status === "Invited") {
    items.push({ tone: "info",    icon: "Building",   actor: "Nia Thompson", action: "added", target: loc.name, note: cityState, time: "2 weeks ago" });
    items.push({ tone: "info",    icon: "Stack",      actor: "Aiden Brooks", action: `mapped ${loc.name} to ${loc.address.split(",")[1]?.trim() || "regional"} department`, time: "10 days ago" });
    items.push({ tone: "info",    icon: "PersonLines", actor: "Marcus Webb",  action: `invited 4 suppliers to cover ${loc.name}`, time: "1 week ago" });
    items.push({ tone: "warning", icon: "Alert",      actor: "System",       action: `${loc.name} is awaiting site-manager confirmation before first dispatch`, time: "3 days ago" });
    items.push({ tone: "info",    icon: "Edit",       actor: "Nia Thompson", action: `set ${loc.name} schedule template to 6:00 AM – 2:30 PM`, time: "Yesterday" });
  } else if (loc.status === "Terminated") {
    items.push({ tone: "success", icon: "Check",      actor: "Site manager", action: `closed final ${loc.shifts} shifts at ${loc.name}`, time: "3 months ago" });
    items.push({ tone: "info",    icon: "Pay",        actor: "Marcus Webb",  action: "settled outstanding invoices", target: loc.spend, time: "10 weeks ago" });
    items.push({ tone: "warning", icon: "Alert",      actor: "Nia Thompson", action: `announced ${loc.name} wind-down — operations cease in 30 days`, time: "8 weeks ago" });
    items.push({ tone: "info",    icon: "Cancel",     actor: "System",       action: `archived ${loc.name} — no active requisitions remain`, time: "1 month ago" });
  } else {
    items.push({ tone: "success", icon: "Check",      actor: "Nia Thompson", action: `activated ${loc.name}`, note: cityState, time: "Jan 12, 2024" });
    if (firstReq) items.push({ tone: "info", icon: "Briefcase", actor: "Marcus Webb", action: "opened", target: `Requisition #${firstReq.id}`, note: `${firstReq.jobs[0]} · ${firstReq.qty} worker${firstReq.qty === 1 ? "" : "s"}`, time: "This month" });
    else items.push({ tone: "info", icon: "Briefcase", actor: "Marcus Webb", action: `opened ${loc.openReqs} requisition${loc.openReqs === 1 ? "" : "s"} for ${loc.name}`, time: "This month" });
    items.push({ tone: "info",    icon: "PersonClock", actor: "Site manager", action: `confirmed ${loc.workers}-worker roster for the week`, note: `${loc.shifts} shifts scheduled`, time: "3 days ago" });
    items.push({ tone: "warning", icon: "Alert",      actor: "System",       action: `flagged a late check-in at ${loc.name}`, note: "Aug 14, 6:18 AM — 12 min delay", time: "5 days ago" });
    if (recentInv) items.push({ tone: "success", icon: "Pay", actor: "Nia Thompson", action: `approved invoice for ${loc.name}`, target: `INV-${recentInv.id}`, note: recentInv.amount, time: "Last week" });
    else items.push({ tone: "success", icon: "Pay", actor: "Nia Thompson", action: `MTD spend rolled up for ${loc.name}`, target: loc.spend, time: "Last week" });
  }
  return <ActivityLog items={items} />;
}

// ==========================================================================
// Time Capture — per-site setting
// ==========================================================================
// Cascading config:
//   (1) Default time capture method   — Clock-in/out, Time tracking,
//       Fixed, N/A. Mirrors the same triplet enforced by Engagement
//       Types (see pages/engagement-type.jsx), but here it's the
//       site-level DEFAULT new requisitions inherit unless overridden
//       on the engagement.
//   (2) Punch method                 — only relevant when the default
//       is Clock-in/out. Picks how the punch reaches Dayforce.
//   (3) Mobile-geo zone              — only relevant when method is
//       Mobile geo. The worker's phone must report a location inside
//       this fence to record a valid punch. Two shapes: a radius
//       circle (the common case), or a hand-drawn hexagon for sites
//       where the gate, dock, and break area need to fall inside the
//       fence but the parking lot or surrounding street should not.
//
// Units follow the site's country. US / UK sites default to a 0.25 mi
// radius; metric countries default to 0.4 km (a tick over the same
// real-world distance, rounded to a clean number). The detected
// country can be overridden with the inline country selector.
// ==========================================================================

// US state codes — used to detect imperial-unit sites from the address
// tail. Anything else we assume metric (the safe default — only US, UK,
// Liberia, and Myanmar still ship in miles for civilian use).
const TC_US_STATES = new Set("AL AK AZ AR CA CO CT DE FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY DC".split(" "));

// Country presets: (unit, default radius in active unit, slider range).
const TC_COUNTRIES = [
  { code: "US", name: "United States", unit: "mi", defaultRadius: 0.25, sliderMin: 0.05, sliderMax: 5,  step: 0.05 },
  { code: "GB", name: "United Kingdom",unit: "mi", defaultRadius: 0.25, sliderMin: 0.05, sliderMax: 5,  step: 0.05 },
  { code: "CA", name: "Canada",        unit: "km", defaultRadius: 0.4,  sliderMin: 0.1,  sliderMax: 8,  step: 0.1  },
  { code: "DE", name: "Germany",       unit: "km", defaultRadius: 0.4,  sliderMin: 0.1,  sliderMax: 8,  step: 0.1  },
  { code: "FR", name: "France",        unit: "km", defaultRadius: 0.4,  sliderMin: 0.1,  sliderMax: 8,  step: 0.1  },
  { code: "AU", name: "Australia",     unit: "km", defaultRadius: 0.4,  sliderMin: 0.1,  sliderMax: 8,  step: 0.1  },
  { code: "JP", name: "Japan",         unit: "km", defaultRadius: 0.4,  sliderMin: 0.1,  sliderMax: 8,  step: 0.1  },
  { code: "MX", name: "Mexico",        unit: "km", defaultRadius: 0.4,  sliderMin: 0.1,  sliderMax: 8,  step: 0.1  },
  { code: "BR", name: "Brazil",        unit: "km", defaultRadius: 0.4,  sliderMin: 0.1,  sliderMax: 8,  step: 0.1  },
  { code: "IN", name: "India",         unit: "km", defaultRadius: 0.4,  sliderMin: 0.1,  sliderMax: 8,  step: 0.1  },
];

function tcDetectCountry(address) {
  const tail = (address || "").split(",").pop().trim().toUpperCase();
  if (TC_US_STATES.has(tail)) return TC_COUNTRIES[0];
  // Two-letter non-US tail → assume that country if we know it,
  // otherwise fall through to the org default (US — the prototype
  // tenants are US-flavoured).
  const known = TC_COUNTRIES.find((c) => c.code === tail);
  if (known) return known;
  return TC_COUNTRIES[0];
}

const TC_MODES = [
  { id: "clock", label: "Clock-in/out",  icon: "PersonClock",
    desc: "Workers punch in and out at the start and end of every shift." },
  { id: "track", label: "Time tracking", icon: "Hourglass",
    desc: "Workers log hours against tasks or projects, approved after the fact." },
  { id: "fixed", label: "Fixed",         icon: "Calendar",
    desc: "No tracking. Fixed hours per period — salaried or milestone-paid work." },
  { id: "na",    label: "Not captured",  icon: "Cancel",
    desc: "Vendor-managed time. Hours arrive on the supplier invoice and are billed as-is." },
];

const TC_METHODS = [
  { id: "geo",   label: "Mobile geo",         icon: "Pin",
    short: "Phone, inside a defined zone",
    desc: "Workers punch on the Dayforce mobile app. The phone must report a location inside the zone around the site to record a valid punch." },
  { id: "qr",    label: "Mobile QR",          icon: "QrCode",
    short: "Phone, scanning a posted code",
    desc: "Workers scan a printed QR code at the site entrance. The code rotates every 15 seconds to prevent buddy punching." },
  { id: "badge", label: "Dayforce Clock — badge", icon: "CreditCard",
    short: "Wall clock, tap-to-punch",
    desc: "Workers tap a Dayforce-issued badge against a wall-mounted Dayforce Clock at the site." },
  { id: "bio",   label: "Dayforce Clock — biometric", icon: "ShieldPerson",
    short: "Wall clock, face or finger",
    desc: "Workers verify with fingerprint or face match at a wall-mounted Dayforce Clock. Eliminates buddy punching." },
];

// ---------- Stylized site map ------------------------------------------
// Deterministic per-site street grid drawn in SVG. We don't ship Mapbox
// in the prototype — but a calm, neutral pseudo-map sells the geofence
// interaction far better than an empty rectangle. Buildings, streets,
// and the address pin are all keyed off `loc.id` so the same site
// always renders the same map.

function tcSeededRng(seed) {
  // Tiny seeded RNG (Mulberry32) — deterministic per site.
  let a = 0;
  for (let i = 0; i < seed.length; i++) a = (a * 31 + seed.charCodeAt(i)) | 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function TcSiteMap({ seed, mapW, mapH }) {
  const rng = useMemoLoc(() => tcSeededRng(seed), [seed]);
  const buildings = useMemoLoc(() => {
    const out = [];
    // Vertical street offsets (4 streets)
    const vStreets = [0.18, 0.40, 0.62, 0.84].map((p) => p + (rng() - 0.5) * 0.04);
    const hStreets = [0.22, 0.50, 0.78].map((p) => p + (rng() - 0.5) * 0.04);
    // Fill each block with 1-3 rectangles
    for (let i = 0; i < vStreets.length - 1; i++) {
      for (let j = 0; j < hStreets.length - 1; j++) {
        const x0 = vStreets[i] * mapW + 8;
        const x1 = vStreets[i + 1] * mapW - 8;
        const y0 = hStreets[j] * mapH + 8;
        const y1 = hStreets[j + 1] * mapH - 8;
        const n = 1 + Math.floor(rng() * 3);
        const horiz = rng() > 0.5;
        for (let k = 0; k < n; k++) {
          const t = k / n + rng() * 0.04;
          const t2 = (k + 1) / n - rng() * 0.04;
          if (horiz) {
            out.push({ x: x0, y: y0 + (y1 - y0) * t, w: x1 - x0, h: (y1 - y0) * (t2 - t) - 2 });
          } else {
            out.push({ x: x0 + (x1 - x0) * t, y: y0, w: (x1 - x0) * (t2 - t) - 2, h: y1 - y0 });
          }
        }
      }
    }
    return { vStreets, hStreets, blocks: out };
  }, [seed, mapW, mapH]);

  return (
    <g aria-hidden="true">
      {/* Base parcel fill */}
      <rect x="0" y="0" width={mapW} height={mapH} fill="var(--evr-neutral-95)" />
      {/* Green park-ish block in one corner for visual variety */}
      <rect
        x={mapW * 0.04}
        y={mapH * 0.04}
        width={mapW * 0.12}
        height={mapH * 0.16}
        fill="#E4ECDC"
        rx="2"
      />
      {/* Building rectangles */}
      {buildings.blocks.map((b, i) => (
        <rect key={i} x={b.x} y={b.y} width={Math.max(2, b.w)} height={Math.max(2, b.h)} fill="#E6E3DC" rx="1" />
      ))}
      {/* Streets — drawn after buildings so they sit on top of the parcel fill */}
      {buildings.vStreets.map((v, i) => (
        <rect key={`v${i}`} x={v * mapW - 5} y="0" width="10" height={mapH} fill="#FFFFFF" />
      ))}
      {buildings.hStreets.map((h, i) => (
        <rect key={`h${i}`} x="0" y={h * mapH - 5} width={mapW} height="10" fill="#FFFFFF" />
      ))}
      {/* Street centerlines */}
      {buildings.vStreets.map((v, i) => (
        <line key={`vl${i}`} x1={v * mapW} y1="0" x2={v * mapW} y2={mapH} stroke="#D6D4CE" strokeDasharray="3 3" strokeWidth="0.5" />
      ))}
      {buildings.hStreets.map((h, i) => (
        <line key={`hl${i}`} x1="0" y1={h * mapH} x2={mapW} y2={h * mapH} stroke="#D6D4CE" strokeDasharray="3 3" strokeWidth="0.5" />
      ))}
    </g>
  );
}

// Format radius for the chip / slider label.
function tcFmtRadius(value, unit) {
  if (unit === "mi") {
    if (value < 0.1) return `${(value * 5280).toFixed(0)} ft`;
    return `${value.toFixed(2)} mi`;
  }
  if (value < 1) return `${(value * 1000).toFixed(0)} m`;
  return `${value.toFixed(2)} km`;
}

// Convert radius in the active unit → meters.
function tcRadiusMeters(value, unit) {
  return unit === "mi" ? value * 1609.34 : value * 1000;
}

// Compute polygon area in unit² (shoelace on offsets, which are in meters).
function tcPolygonArea(offsets, unit) {
  // offsets are {dx, dy} in meters from center.
  let a = 0;
  for (let i = 0; i < offsets.length; i++) {
    const p = offsets[i];
    const q = offsets[(i + 1) % offsets.length];
    a += p.dx * q.dy - q.dx * p.dy;
  }
  const m2 = Math.abs(a) / 2;
  if (unit === "mi") {
    const acres = m2 / 4046.86;
    if (acres < 100) return `${acres.toFixed(1)} acres`;
    return `${(m2 / 2589988).toFixed(2)} mi²`;
  }
  const ha = m2 / 10000;
  if (ha < 50) return `${ha.toFixed(1)} ha`;
  return `${(m2 / 1e6).toFixed(2)} km²`;
}

// Build a regular hexagon's vertex offsets (in meters) for a given
// radius in the active unit. Pointy-top hexagon.
function tcHexOffsets(radius, unit) {
  const r = tcRadiusMeters(radius, unit);
  const out = [];
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 3) * i - Math.PI / 2;
    out.push({ dx: r * Math.cos(a), dy: r * Math.sin(a) });
  }
  return out;
}

// ---------- Geo zone editor --------------------------------------------
// SVG-based editor. The site center sits at the middle of the map.
// Circle mode: a circle of `radius` in active unit, drawn at a
// constant 32% of the map width — the map auto-scales so the user
// always sees an appropriately-zoomed view. A scale bar in the
// bottom-left tells them what the on-screen distance maps to.
// Polygon mode: 6 draggable vertices. The user can drag them
// individually; the polygon updates live, and the area in the
// bottom-right updates with it.

function TcGeoZone({ loc, country, radius, setRadius, zoneKind, setZoneKind, polygon, setPolygon }) {
  const MAP_W = 700;
  const MAP_H = 320;
  // Scale: at the current radius, the circle should occupy ~32% of the
  // map's SHORTER side (height, here), so the geofence frames cleanly
  // regardless of aspect ratio. Using width would clip the top and
  // bottom of the circle and push the hexagon's pointy-top vertices
  // outside the viewport.
  const radiusPxTarget = Math.min(MAP_W, MAP_H) * 0.32;
  const radiusMeters = tcRadiusMeters(radius, country.unit);
  const pxPerMeter = radiusPxTarget / radiusMeters;
  const cx = MAP_W / 2;
  const cy = MAP_H / 2;

  const svgRef = React.useRef(null);
  const [dragIdx, setDragIdx] = useStateLoc(-1);

  // Translate polygon offsets (meters) → screen-space points.
  const polyPts = polygon.map((p) => ({ x: cx + p.dx * pxPerMeter, y: cy + p.dy * pxPerMeter }));
  const polyPath = polyPts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ") + "Z";

  // Scale-bar: pick a tidy distance that takes ~120px on screen.
  const scaleBar = (() => {
    const targetPx = 120;
    const targetMeters = targetPx / pxPerMeter;
    let value, label;
    if (country.unit === "mi") {
      // Pick from a ladder: 100ft, 250ft, 500ft, 0.1mi, 0.25mi, 0.5mi, 1mi, 2mi
      const ladder = [
        { m: 100 * 0.3048,  label: "100 ft" },
        { m: 250 * 0.3048,  label: "250 ft" },
        { m: 500 * 0.3048,  label: "500 ft" },
        { m: 0.1 * 1609.34, label: "0.1 mi" },
        { m: 0.25 * 1609.34, label: "¼ mi" },
        { m: 0.5 * 1609.34, label: "½ mi" },
        { m: 1.0 * 1609.34, label: "1 mi" },
        { m: 2.0 * 1609.34, label: "2 mi" },
      ];
      const closest = ladder.reduce((a, b) => Math.abs(b.m - targetMeters) < Math.abs(a.m - targetMeters) ? b : a);
      value = closest.m * pxPerMeter;
      label = closest.label;
    } else {
      const ladder = [
        { m: 50,   label: "50 m" },
        { m: 100,  label: "100 m" },
        { m: 250,  label: "250 m" },
        { m: 500,  label: "500 m" },
        { m: 1000, label: "1 km" },
        { m: 2000, label: "2 km" },
        { m: 5000, label: "5 km" },
      ];
      const closest = ladder.reduce((a, b) => Math.abs(b.m - targetMeters) < Math.abs(a.m - targetMeters) ? b : a);
      value = closest.m * pxPerMeter;
      label = closest.label;
    }
    return { width: value, label };
  })();

  // Drag handling for polygon vertices.
  const startDrag = (i) => (e) => {
    e.preventDefault();
    setDragIdx(i);
  };
  React.useEffect(() => {
    if (dragIdx < 0) return;
    function onMove(e) {
      const svg = svgRef.current;
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * MAP_W;
      const y = ((e.clientY - rect.top)  / rect.height) * MAP_H;
      const next = polygon.slice();
      next[dragIdx] = {
        dx: (x - cx) / pxPerMeter,
        dy: (y - cy) / pxPerMeter,
      };
      setPolygon(next);
    }
    function onUp() { setDragIdx(-1); }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [dragIdx, polygon, pxPerMeter, cx, cy]);

  const resetHex = () => setPolygon(tcHexOffsets(radius, country.unit));

  return (
    <div className="tc-geo">
      <div className="tc-geo-toolbar">
        <div className="recur-seg" role="tablist" aria-label="Zone shape">
          <button
            type="button"
            role="tab"
            className="recur-seg-btn"
            aria-pressed={zoneKind === "circle"}
            onClick={() => setZoneKind("circle")}
          >
            <Icon name="HeartBeat" size={14} />
            Radius
          </button>
          <button
            type="button"
            role="tab"
            className="recur-seg-btn"
            aria-pressed={zoneKind === "polygon"}
            onClick={() => { setZoneKind("polygon"); if (!polygon.length) resetHex(); }}
          >
            <Icon name="Shapes" size={14} />
            Custom hexagon
          </button>
        </div>
        {zoneKind === "polygon" && (
          <button type="button" className="btn btn--md btn--tertiary" onClick={resetHex}>
            <Icon name="Refresh" size={14} />Reset to hexagon
          </button>
        )}
      </div>

      <div className="tc-map-wrap">
        <svg
          ref={svgRef}
          className="tc-map"
          viewBox={`0 0 ${MAP_W} ${MAP_H}`}
          preserveAspectRatio="xMidYMid slice"
          role="img"
          aria-label={`Mobile-geo zone for ${loc.name}`}
        >
          <TcSiteMap seed={loc.id} mapW={MAP_W} mapH={MAP_H} />

          {/* Geofence overlay */}
          {zoneKind === "circle" ? (
            <g>
              <circle
                cx={cx} cy={cy}
                r={radiusMeters * pxPerMeter}
                fill="rgba(48,103,219,0.16)"
                stroke="var(--evr-blue-400)"
                strokeWidth="2"
                strokeDasharray="6 4"
              />
            </g>
          ) : (
            <g>
              <path
                d={polyPath}
                fill="rgba(48,103,219,0.16)"
                stroke="var(--evr-blue-400)"
                strokeWidth="2"
                strokeDasharray="6 4"
                strokeLinejoin="round"
              />
              {polyPts.map((p, i) => (
                <g key={i}>
                  <circle
                    cx={p.x} cy={p.y} r="10"
                    fill="var(--evr-blue-400)"
                    stroke="#FFFFFF"
                    strokeWidth="2"
                    className="tc-hex-handle"
                    onMouseDown={startDrag(i)}
                    style={{ cursor: dragIdx === i ? "grabbing" : "grab" }}
                  />
                </g>
              ))}
            </g>
          )}

          {/* Site pin (center) — drawn LAST so it sits above the fence */}
          <g transform={`translate(${cx} ${cy})`}>
            <circle r="14" fill="rgba(48,103,219,0.20)" />
            <circle r="7" fill="var(--evr-blue-500)" stroke="#FFFFFF" strokeWidth="2.5" />
          </g>

          {/* Scale bar */}
          <g transform={`translate(${16} ${MAP_H - 24})`}>
            <rect x="-4" y="-12" width={scaleBar.width + 60} height="20" fill="rgba(255,255,255,0.85)" rx="3" />
            <line x1="0" y1="-2" x2={scaleBar.width} y2="-2" stroke="var(--evr-content-primary-highemp)" strokeWidth="2" />
            <line x1="0" y1="-6" x2="0" y2="2" stroke="var(--evr-content-primary-highemp)" strokeWidth="2" />
            <line x1={scaleBar.width} y1="-6" x2={scaleBar.width} y2="2" stroke="var(--evr-content-primary-highemp)" strokeWidth="2" />
            <text x={scaleBar.width + 8} y="2" fontSize="11" fontFamily="var(--evr-font-text)" fill="var(--evr-content-primary-highemp)">{scaleBar.label}</text>
          </g>

          {/* Area readout (polygon only) */}
          {zoneKind === "polygon" && (
            <g transform={`translate(${MAP_W - 16} ${MAP_H - 24})`}>
              <rect x="-110" y="-14" width="110" height="22" fill="rgba(255,255,255,0.9)" rx="3" />
              <text x="-6" y="2" fontSize="11" textAnchor="end" fontFamily="var(--evr-font-text)" fill="var(--evr-content-primary-highemp)">
                Area · {tcPolygonArea(polygon, country.unit)}
              </text>
            </g>
          )}
        </svg>
      </div>

      {/* Radius slider — circle mode only */}
      {zoneKind === "circle" && (
        <div className="tc-radius-row">
          <label className="tc-radius-label">
            <span>Radius</span>
            <span className="tc-radius-value tabular">{tcFmtRadius(radius, country.unit)}</span>
          </label>
          <input
            type="range"
            className="tc-radius-slider"
            min={country.sliderMin}
            max={country.sliderMax}
            step={country.step}
            value={radius}
            onChange={(e) => setRadius(parseFloat(e.target.value))}
            aria-label="Radius"
          />
          <div className="tc-radius-ticks">
            <span>{tcFmtRadius(country.sliderMin, country.unit)}</span>
            <span>{tcFmtRadius(country.sliderMax, country.unit)}</span>
          </div>
        </div>
      )}

      {zoneKind === "polygon" && (
        <p className="tc-helper">
          <Icon name="Information" size={14} />
          Drag the six handles to shape the zone. A hexagon lets you include the gate and dock but exclude the parking lot or street &mdash; tighter than a circle, simpler than free-form polygons.
        </p>
      )}
    </div>
  );
}

// ---------- Top-level Time Capture body --------------------------------
// Two phases: a read-only Summary that shows the current selection
// (rendered at every org level — Entity, Division, Sector, Location,
// Cost Center) and an editable Editor that opens when the user clicks
// Edit. Save commits the draft back to the saved snapshot; Discard
// reverts and exits edit mode.

// Initial saved state for a given site / address.
function tcInitialSaved(address) {
  const country = tcDetectCountry(address);
  return {
    mode:     "clock",
    method:   "geo",
    country:  country,
    radius:   country.defaultRadius,
    zoneKind: "circle",
    polygon:  tcHexOffsets(country.defaultRadius, country.unit),
  };
}

// Compact summary of the current setting — read-only display surfaced
// on every org-level details page. Edit button lifts the user into the
// editor.
function TcSummary({ saved, onEdit, scope, inheritedFrom }) {
  const mode = TC_MODES.find((m) => m.id === saved.mode) || TC_MODES[0];
  const method = saved.mode === "clock"
    ? (TC_METHODS.find((m) => m.id === saved.method) || TC_METHODS[0])
    : null;
  const showZone = saved.mode === "clock" && saved.method === "geo";
  const zoneLabel = showZone
    ? (saved.zoneKind === "circle"
        ? `${tcFmtRadius(saved.radius, saved.country.unit)} radius`
        : `Custom hexagon · ${tcPolygonArea(saved.polygon, saved.country.unit)}`)
    : null;

  return (
    <div className="tc-summary">
      {inheritedFrom && (
        <div className="tc-summary-inherit">
          <Icon name="OrgChartVert" size={14} />
          <span>Inherits from <strong>{inheritedFrom}</strong>. Override below to set a different default for {scope || "this scope"}.</span>
        </div>
      )}

      <div className="tc-summary-grid">
        {/* Mode tile */}
        <div className="tc-summary-tile">
          <span className="tc-summary-eyebrow">Default time capture</span>
          <div className="tc-summary-pill">
            <span className="tc-summary-pill-icon"><Icon name={mode.icon} size={16} /></span>
            <span className="tc-summary-pill-label">{mode.label}</span>
          </div>
          <p className="tc-summary-desc">{mode.desc}</p>
        </div>

        {/* Method tile (clock only) */}
        {method && (
          <div className="tc-summary-tile">
            <span className="tc-summary-eyebrow">Punch method</span>
            <div className="tc-summary-pill">
              <span className="tc-summary-pill-icon"><Icon name={method.icon} size={16} /></span>
              <span className="tc-summary-pill-label">{method.label}</span>
            </div>
            <p className="tc-summary-desc">{method.short}</p>
          </div>
        )}

        {/* Zone tile (mobile geo only) */}
        {showZone && (
          <div className="tc-summary-tile">
            <span className="tc-summary-eyebrow">Mobile geo zone</span>
            <div className="tc-summary-pill">
              <span className="tc-summary-pill-icon"><Icon name={saved.zoneKind === "circle" ? "Location" : "Shapes"} size={16} /></span>
              <span className="tc-summary-pill-label">{zoneLabel}</span>
            </div>
            <p className="tc-summary-desc">
              {saved.country.name} &middot; {saved.country.unit === "mi" ? "imperial" : "metric"} units
            </p>
          </div>
        )}
      </div>

      {/* Inline mini-map preview when the geofence is the active config */}
      {showZone && (
        <div className="tc-summary-map">
          <TcZonePreview saved={saved} />
        </div>
      )}

      <div className="tc-summary-actions">
        <button
          type="button"
          className="btn btn--md btn--secondary"
          onClick={onEdit}
        >
          <Icon name="Edit" size={14} />Edit time capture
        </button>
      </div>
    </div>
  );
}

// Tiny non-interactive map preview rendered inside the summary. Reuses
// the same site-map renderer as the editor; the geofence is drawn but
// not draggable.
function TcZonePreview({ saved }) {
  const MAP_W = 700;
  const MAP_H = 220;
  const radiusPxTarget = Math.min(MAP_W, MAP_H) * 0.32;
  const radiusMeters = tcRadiusMeters(saved.radius, saved.country.unit);
  const pxPerMeter = radiusPxTarget / radiusMeters;
  const cx = MAP_W / 2;
  const cy = MAP_H / 2;
  const seed = saved.country.code + "-preview";

  const polyPts = (saved.polygon || []).map((p) => ({ x: cx + p.dx * pxPerMeter, y: cy + p.dy * pxPerMeter }));
  const polyPath = polyPts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ") + "Z";

  return (
    <svg
      className="tc-map tc-map--preview"
      viewBox={`0 0 ${MAP_W} ${MAP_H}`}
      preserveAspectRatio="xMidYMid slice"
      role="img"
      aria-label="Mobile-geo zone preview"
    >
      <TcSiteMap seed={seed} mapW={MAP_W} mapH={MAP_H} />
      {saved.zoneKind === "circle" ? (
        <circle
          cx={cx} cy={cy}
          r={radiusPxTarget}
          fill="rgba(48,103,219,0.16)"
          stroke="var(--evr-blue-400)"
          strokeWidth="2"
          strokeDasharray="6 4"
        />
      ) : (
        <path
          d={polyPath}
          fill="rgba(48,103,219,0.16)"
          stroke="var(--evr-blue-400)"
          strokeWidth="2"
          strokeDasharray="6 4"
          strokeLinejoin="round"
        />
      )}
      <g transform={`translate(${cx} ${cy})`}>
        <circle r="12" fill="rgba(48,103,219,0.20)" />
        <circle r="6" fill="var(--evr-blue-500)" stroke="#FFFFFF" strokeWidth="2" />
      </g>
    </svg>
  );
}

// Editor — the original form, isolated so the summary view can keep
// its rendering simple. Receives a `draft` and a setter, plus Save /
// Discard callbacks.
function TcEditor({ loc, draft, setDraft, onSave, onDiscard, dirty }) {
  const detected = useMemoLoc(() => tcDetectCountry(loc.address), [loc.address]);
  // Each field maps onto the draft snapshot.
  const setField = (k, v) => setDraft({ ...draft, [k]: v });
  const switchCountry = (next) => {
    setDraft({
      ...draft,
      country: next,
      radius: next.defaultRadius,
      polygon: tcHexOffsets(next.defaultRadius, next.unit),
    });
  };

  return (
    <div className="tc">
      {/* ---------- Section 1 · Default time capture ---------------- */}
      <div className="tc-sect">
        <div className="tc-sect-head">
          <h3 className="tc-sect-title">Default time capture</h3>
          <p className="tc-sect-sub">How time at this site flows into payroll. New requisitions inherit this unless overridden on the engagement.</p>
        </div>
        <div className="tc-cards tc-cards--4">
          {TC_MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              className="tc-card"
              aria-pressed={draft.mode === m.id}
              onClick={() => setField("mode", m.id)}
            >
              <span className="tc-card-icon"><Icon name={m.icon} size={20} /></span>
              <span className="tc-card-label">{m.label}</span>
              <span className="tc-card-desc">{m.desc}</span>
              <span className="tc-card-check" aria-hidden="true"><Icon name="Check" size={14} /></span>
            </button>
          ))}
        </div>
      </div>

      {/* ---------- Section 2 · Method (Clock-in/out only) ---------- */}
      {draft.mode === "clock" && (
        <div className="tc-sect">
          <div className="tc-sect-head">
            <h3 className="tc-sect-title">Punch method</h3>
            <p className="tc-sect-sub">How the punch reaches Dayforce. Pick the primary option for this site.</p>
          </div>
          <div className="tc-cards tc-cards--4">
            {TC_METHODS.map((m) => (
              <button
                key={m.id}
                type="button"
                className="tc-card"
                aria-pressed={draft.method === m.id}
                onClick={() => setField("method", m.id)}
              >
                <span className="tc-card-icon"><Icon name={m.icon} size={20} /></span>
                <span className="tc-card-label">{m.label}</span>
                <span className="tc-card-short">{m.short}</span>
                <span className="tc-card-desc">{m.desc}</span>
                <span className="tc-card-check" aria-hidden="true"><Icon name="Check" size={14} /></span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ---------- Section 3 · Geo zone (Mobile geo only) ---------- */}
      {draft.mode === "clock" && draft.method === "geo" && (
        <div className="tc-sect">
          <div className="tc-sect-head">
            <h3 className="tc-sect-title">Mobile geo zone</h3>
            <p className="tc-sect-sub">
              A worker's phone must report a location inside this zone to record a valid punch. Out-of-zone attempts are held for manager review.
            </p>
            <div className="tc-country">
              <span className="tc-country-label"><Icon name="Globe" size={14} />Country</span>
              <select
                className="tc-country-select"
                value={draft.country.code}
                onChange={(e) => switchCountry(TC_COUNTRIES.find((c) => c.code === e.target.value))}
                aria-label="Country"
              >
                {TC_COUNTRIES.map((c) => (
                  <option key={c.code} value={c.code}>{c.name} &middot; {c.unit === "mi" ? "miles" : "kilometres"}</option>
                ))}
              </select>
              {draft.country.code !== detected.code && (
                <button
                  type="button"
                  className="linkbtn tc-country-reset"
                  onClick={() => switchCountry(detected)}
                >
                  Reset to detected ({detected.name})
                </button>
              )}
            </div>
          </div>
          <TcGeoZone
            loc={loc}
            country={draft.country}
            radius={draft.radius}
            setRadius={(r) => setField("radius", r)}
            zoneKind={draft.zoneKind}
            setZoneKind={(k) => setField("zoneKind", k)}
            polygon={draft.polygon}
            setPolygon={(p) => setField("polygon", p)}
          />
        </div>
      )}

      {/* ---------- Save bar ----------------------------------------- */}
      <div className="tc-actions">
        <span className="tc-dirty" data-dirty={dirty}>
          {dirty ? "Unsaved changes" : "No changes"}
        </span>
        <button
          type="button"
          className="btn btn--md btn--tertiary"
          onClick={onDiscard}
        >
          Cancel
        </button>
        <button
          type="button"
          className="btn btn--md btn--primary"
          onClick={onSave}
          disabled={!dirty}
        >
          <Icon name="Save" size={14} />Save changes
        </button>
      </div>
    </div>
  );
}

function LocTimeCaptureBody({ loc, scope, inheritedFrom, initialSaved }) {
  const [saved, setSaved] = useStateLoc(() => initialSaved || tcInitialSaved(loc.address));
  const [draft, setDraft] = useStateLoc(null);
  const isEditing = draft !== null;

  // Shallow + key-by-key equality good enough — every field is a
  // primitive or a fresh array/object created on edit.
  const dirty = isEditing && (
    draft.mode     !== saved.mode ||
    draft.method   !== saved.method ||
    draft.zoneKind !== saved.zoneKind ||
    draft.radius   !== saved.radius ||
    (draft.country && draft.country.code !== saved.country.code) ||
    JSON.stringify(draft.polygon) !== JSON.stringify(saved.polygon)
  );

  const enterEdit  = () => setDraft({ ...saved });
  const cancelEdit = () => setDraft(null);
  const commitEdit = () => {
    setSaved(draft);
    setDraft(null);
    showToast(`Time capture for ${loc.name} updated`, { kind: "success" });
  };

  if (!isEditing) {
    return (
      <TcSummary
        saved={saved}
        onEdit={enterEdit}
        scope={scope}
        inheritedFrom={inheritedFrom}
      />
    );
  }

  return (
    <TcEditor
      loc={loc}
      draft={draft}
      setDraft={setDraft}
      onSave={commitEdit}
      onDiscard={cancelEdit}
      dirty={dirty}
    />
  );
}

// Quick-action metric card — 2-up grid above the accordions.
function LocQuickCard({ label, value, sublabel, trend }) {
  return (
    <div className="loc-quick-card">
      <div className="loc-quick-label">{label}</div>
      <div className="loc-quick-value tabular">{value}</div>
      <div className="loc-quick-sub">
        {trend && (
          <span className={`sup-quick-trend sup-quick-trend--${trend.dir}`}>
            <Icon name={trend.dir === "up" ? "ChevronUp" : "ChevronDown"} size={12} />
            {trend.label}
          </span>
        )}
        {sublabel && <span>{sublabel}</span>}
      </div>
    </div>
  );
}

function LocationDetailsPage({ locationId, onBack }) {
  const loc = LOCATIONS.find((x) => x.id === locationId) || LOCATIONS[0];
  const statusHue = LOC_STATUS_HUES[loc.status] || "default";
  const editEntity = useEditEntity();

  const openEdit = () => editEntity.open({
    ...locationEditSchema(loc),
    onSave: () => showToast(`${loc.name} updated`, { kind: "success" }),
  });

  return (
    <React.Fragment>
      <ReqOmnibar
        title={loc.name}
        subtitle="Sites"
        status={<span className={`req-pill req-pill--${statusHue}`}>{loc.status}</span>}
        onBack={onBack}
        actions={(
          <React.Fragment>
            <button
              type="button"
              className="iconbtn"
              aria-label="Reload"
              title="Reload"
              onClick={() => showToast("Location refreshed")}
            >
              <Icon name="Refresh" size={20} />
            </button>
            <button
              type="button"
              className="btn btn--md btn--secondary"
              onClick={openEdit}
            >
              <Icon name="Edit" size={16} />Edit
            </button>
            <button
              type="button"
              className="iconbtn"
              aria-label="More"
              onClick={(e) => openMenu(e.currentTarget, [
                { icon: "Briefcase", label: "New requisition",  onClick: () => showToast(`Starting requisition at ${loc.name}`) },
                { icon: "Copy",      label: "Copy site ID", onClick: () => copyToClipboard(loc.locationId, "Site ID copied") },
                { divider: true },
                { icon: "Cancel",    label: "Deactivate site", danger: true,
                  onClick: () => openConfirm({
                    title: `Deactivate ${loc.name}?`,
                    body: "This location will no longer accept new requisitions.",
                    primaryLabel: "Deactivate",
                    onConfirm: () => { showToast(`${loc.name} deactivated`, { kind: "success" }); onBack && onBack(); },
                  }) },
              ])}
            >
              <Icon name="MoreVert" size={20} />
            </button>
          </React.Fragment>
        )}
      />

      <div className="req-wf" style={{ maxWidth: 1200 }}>
        {/* ---- Hero card (no avatar — text-only) ---- */}
        <section className="loc-hero">
          <span className={`req-pill req-pill--${statusHue}`}>{loc.status}</span>
          <h1 className="loc-hero-name">{loc.name}</h1>
          <ul className="loc-hero-meta">
            <li>
              <Icon name="Location" size={16} />
              <span>{loc.address}</span>
            </li>
            <li>
              <span>Site ID: <span className="tabular">{loc.locationId}</span></span>
              {loc.locationId !== "—" && (
                <button
                  type="button"
                  className="sup-copy-btn"
                  aria-label="Copy site ID"
                  onClick={() => copyToClipboard(loc.locationId, "Site ID copied")}
                >
                  <Icon name="Copy" size={14} />
                </button>
              )}
            </li>
          </ul>
        </section>

        {/* ---- Quick actions (2-up grid) ---- */}
        <div className="loc-quick-grid">
          <LocQuickCard
            label="Open requisitions"
            value={loc.openReqs}
            sublabel="Across all suppliers"
            trend={loc.openReqs ? { dir: "up", label: "+1" } : null}
          />
          <LocQuickCard
            label="Active workers"
            value={loc.workers}
            sublabel="This week"
          />
        </div>

        {/* ---- Empty accordions (same pattern as Requisition details) ---- */}
        <LocAccordionCard icon="Information" title="Details">
          <LocDetailsBody loc={loc} />
        </LocAccordionCard>

        <LocAccordionCard icon="Calendar" title="Schedule" count={loc.shifts || 0}>
          <LocScheduleBody loc={loc} />
        </LocAccordionCard>

        <LocAccordionCard icon="PersonClock" title="Time capture">
          <LocTimeCaptureBody loc={loc} />
        </LocAccordionCard>

        <LocAccordionCard icon="Briefcase" title="Requisitions" count={loc.openReqs || 0}>
          <LocRequisitionsBody loc={loc} />
        </LocAccordionCard>

        <LocAccordionCard icon="Employees" title="Workforce" count={loc.workers || 0}>
          <LocWorkforceBody loc={loc} />
        </LocAccordionCard>

        <LocAccordionCard icon="PersonArrow" title="Supplier distribution" defaultOpen={typeof ORG_OVERRIDE_FOR === "function" && !!ORG_OVERRIDE_FOR(loc.id)}>
          <LocDistributionBody loc={loc} />
        </LocAccordionCard>

        {/* Rate card — base pay inherited from the tenant card down the org
            tree (Corporate → Region → District → Site), overridable per job
            at this site and below. v1.44 — sites were previously skipped. */}
        <LocAccordionCard icon="Pay" title="Rate card">
          {window.NodeRateCardBody && (
            <window.NodeRateCardBody node={(window.ORG_INDEX && window.ORG_INDEX.byId[loc.id]) || { id: loc.id, name: loc.name, segment: "Locations" }} />
          )}
        </LocAccordionCard>

        <LocAccordionCard icon="TimeUndo" title="Logs">
          <LocLogsBody loc={loc} />
        </LocAccordionCard>
      </div>
      {editEntity.panel}
    </React.Fragment>
  );
}

Object.assign(window, { LocationsPage, LocationDetailsPage, LOCATIONS, LocTimeCaptureBody, LocAccordionCard });
