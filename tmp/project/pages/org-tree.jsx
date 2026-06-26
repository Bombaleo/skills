// =====================================================================
// Flex Work — Organization hierarchy
//
//   Aligned with Dayforce in v0.2: the segments now render with the
//   Dayforce names that the rest of the platform (Org Setup, Payroll,
//   Position Mgmt, Reporting) already uses. The old Flex Work names
//   are preserved on tooltips so admins doing the migration can still
//   tie back to their existing mental model.
//
//     Flex Work (was)   →   Dayforce (now)
//     ─────────────────     ─────────────────────
//     Entity            →   Corporate (top org level)
//     Division          →   Region
//     Sector            →   District
//     Location          →   Site
//     Cost center       →   On-Site Department
//
//   Internal segment keys ("Entities", "Divisions", …) are kept as-is
//   because they're used as object keys throughout; only the display
//   labels rotate. Lookup via DF_SEG_LABEL / DF_SEG_TOOLTIP below.
//
//   Each level has its own detail page (OrgNodeDetailsPage) that
//   surfaces children, lets the user act on the whole group, and lets
//   them multi-select specific children for the same actions.
//
//   The list/segmented view lives in pages/locations.jsx — that page
//   imports the data + the detail-page component from this file.
// =====================================================================

const { useState: useStateOT, useMemo: useMemoOT } = React;

// ---------- Data model --------------------------------------------------
// Every node carries: id, name, segment (Entities|Divisions|Sectors|
// Locations|Cost Centers), parentId, and stats.

const ORG_RAW = (function buildOrg() {
  const entities = [
    { id: "ent-01", name: "Dayforce Holdings, Inc.", address: "3311 East Old Shakopee Rd., Minneapolis, MN", country: "United States", status: "Active" },
    { id: "ent-02", name: "Dayforce Canada Ltd.",    address: "4110 Yonge St., Toronto, ON",                  country: "Canada",        status: "Active" },
  ];

  // Divisions sit directly under entities. Business segments live here.
  const divisions = [
    { id: "div-mfg",  parentId: "ent-01", name: "Manufacturing", owner: "Priya Ramesh",  spendYTD: "$148,920" },
    { id: "div-log",  parentId: "ent-01", name: "Logistics",     owner: "Marcus Webb",   spendYTD: "$182,440" },
    { id: "div-dist", parentId: "ent-01", name: "Distribution",  owner: "Nia Thompson",  spendYTD: "$76,180"  },
    { id: "div-hos",  parentId: "ent-02", name: "Hospitality",   owner: "Sami Soto",     spendYTD: "$31,475"  },
  ];

  // Sectors sit under divisions. Regional / operational groupings.
  const sectors = [
    { id: "sec-east",    parentId: "div-mfg",  name: "East region",    owner: "Nia Thompson", spendYTD: "$58,910" },
    { id: "sec-central", parentId: "div-mfg",  name: "Central region", owner: "Jamal Carter", spendYTD: "$41,720" },
    { id: "sec-west",    parentId: "div-log",  name: "West region",    owner: "Sami Soto",    spendYTD: "$96,420" },
    { id: "sec-south",   parentId: "div-log",  name: "South region",   owner: "Marcus Webb",  spendYTD: "$54,210" },
    { id: "sec-midw",    parentId: "div-dist", name: "Midwest",        owner: "Nia Thompson", spendYTD: "$48,180" },
    { id: "sec-canada",  parentId: "div-hos",  name: "Canada",         owner: "Sami Soto",    spendYTD: "$31,475" },
  ];

  // Map locations (from LOCATIONS in pages/locations.jsx) into sectors.
  const LOC_PARENT = {
    "loc-647": "sec-central", "loc-014": "sec-central",
    "loc-035": "sec-south",   "loc-sfb": "sec-south",
    "loc-dca": "sec-west",    "loc-fhd": "sec-west",   "loc-lha": "sec-west",
    "loc-sct": "sec-midw",    "loc-ihk": "sec-midw",
    "loc-cdz": "sec-east",    "loc-sdt": "sec-east",
    "loc-231": "sec-canada",  "loc-058": "sec-canada",
    "loc-tlh": "sec-midw",
  };
  const baseLocations = (typeof LOCATIONS !== "undefined" ? LOCATIONS : []).map((l) => ({
    ...l,
    parentId: LOC_PARENT[l.id] || "sec-east",
    segment: "Locations",
  }));

  // Cost centers sit under locations.
  const costCentersRaw = [
    { id: "cc-32",  parentLoc: "loc-035", name: "Warehouse #32", owner: "Nia Thompson",  spendYTD: "$48,320" },
    { id: "cc-18",  parentLoc: "loc-sfb", name: "Warehouse #18", owner: "Jamal Carter",  spendYTD: "$31,475" },
    { id: "cc-07",  parentLoc: "loc-cdz", name: "Warehouse #07", owner: "Nia Thompson",  spendYTD: "$28,910" },
    { id: "cc-11",  parentLoc: "loc-ihk", name: "Warehouse #11", owner: "Priya Ramesh",  spendYTD: "$42,180" },
    { id: "cc-14",  parentLoc: "loc-014", name: "Warehouse #14", owner: "Nia Thompson",  spendYTD: "$39,720" },
    { id: "cc-d03", parentLoc: "loc-fhd", name: "Dock #03",      owner: "Sami Soto",     spendYTD: "$33,540" },
    { id: "cc-d07", parentLoc: "loc-sdt", name: "Dock #07",      owner: "Jamal Carter",  spendYTD: "$21,150" },
    { id: "cc-h01", parentLoc: "loc-lha", name: "Hub #01",       owner: "Marcus Webb",   spendYTD: "$54,205" },
    { id: "cc-h05", parentLoc: "loc-tlh", name: "Hub #05",       owner: "Marcus Webb",   spendYTD: "$18,940" },
    { id: "cc-p02", parentLoc: "loc-dca", name: "Plant #02",     owner: "Marcus Webb",   spendYTD: "$36,470" },
    { id: "cc-p04", parentLoc: "loc-sct", name: "Plant #04",     owner: "Marcus Webb",   spendYTD: "$29,615" },
  ];
  const costCenters = costCentersRaw.map((c) => ({ ...c, parentId: c.parentLoc, segment: "Cost Centers" }));

  entities.forEach((e)  => (e.segment = "Entities"));
  divisions.forEach((d) => (d.segment = "Divisions"));
  sectors.forEach((s)   => (s.segment = "Sectors"));
  return { entities, divisions, sectors, locations: baseLocations, costCenters };
})();

const ORG_INDEX = (function () {
  const all = [
    ...ORG_RAW.entities,
    ...ORG_RAW.divisions,
    ...ORG_RAW.sectors,
    ...ORG_RAW.locations,
    ...ORG_RAW.costCenters,
  ];
  const byId = Object.fromEntries(all.map((n) => [n.id, n]));
  return { all, byId };
})();

// Parent → child segment.
const ORG_CHILD_SEGMENT = {
  "Entities":     "Divisions",
  "Divisions":    "Sectors",
  "Sectors":      "Locations",
  "Locations":    "Cost Centers",
  "Cost Centers": null,
};

const ORG_SEGMENT_ICONS = {
  "Entities":     "Building",
  "Divisions":    "OrgChartVert",
  "Sectors":      "Shapes",
  "Locations":    "Location",
  "Cost Centers": "MoneyBag",
};

// ---------- Dayforce / Flex Work rename map ---------------------------
// One source of truth for the migration rename. Internal segment keys
// stay the same (used as object keys all over); we only flip the
// rendered labels. Anywhere we surface a Dayforce name in the UI, we
// pair it with DF_SEG_TOOLTIP so admins can still find the level by
// its old Flex Work name.
const DF_SEG_LABEL = {
  // Dayforce display labels — singular and plural per segment key.
  // For the segmented tab we use "Departments" plural to keep the
  // segmented control on one line; the tooltip still surfaces the full
  // Dayforce term ("On-Site Department") and the old Flex Work term.
  Entities:       { singular: "Corporate",   plural: "Corporate" },
  Divisions:      { singular: "Region",      plural: "Regions"   },
  Sectors:        { singular: "District",    plural: "Districts" },
  Locations:      { singular: "Site",        plural: "Sites"     },
  "Cost Centers": { singular: "Department",  plural: "Departments" },
};

const FW_SEG_LABEL = {
  // Legacy term map — kept only so admins migrating from the old Flex
  // Work labels can still find tiers by the prior term. Names that
  // match the current Dayforce label are suppressed from the tooltip.
  Entities:       { singular: "Entity",     plural: "Entities"   },
  Divisions:      { singular: "Division",   plural: "Divisions"  },
  Sectors:        { singular: "Sector",     plural: "Sectors"    },
  Locations:      { singular: "Site",       plural: "Sites"      },
  "Cost Centers": { singular: "Department", plural: "Departments" },
};

function dfSegLabel(segKey, plural = false) {
  const r = DF_SEG_LABEL[segKey];
  if (!r) return segKey;
  return plural ? r.plural : r.singular;
}
function dfSegTooltip(segKey, plural = false) {
  const df = DF_SEG_LABEL[segKey];
  const fw = FW_SEG_LABEL[segKey];
  if (!df || !fw) return "";
  const dfL = plural ? df.plural : df.singular;
  const fwL = plural ? fw.plural : fw.singular;
  // Suppress the legacy clause when the current and legacy labels agree.
  if (dfL === fwL) return `Dayforce hierarchy level: “${dfL}”`;
  return `Dayforce calls this “${dfL}” — formerly “${fwL}” in Flex Work`;
}

const ORG_SEGMENT_SINGULAR = {
  // Public lookup — callers expect a string per segment key. We return
  // the Dayforce singular now; the old Flex Work name is still
  // recoverable via FW_SEG_LABEL when a tooltip is needed.
  "Entities":     "Corporate",
  "Divisions":    "Region",
  "Sectors":      "District",
  "Locations":    "Site",
  "Cost Centers": "Department",
};

// Direct children of a node.
function orgChildren(nodeId) {
  return ORG_INDEX.all.filter((n) => n.parentId === nodeId);
}

// All descendants flattened, bucketed by segment.
function orgDescendantsBySegment(nodeId) {
  const out = { Divisions: [], Sectors: [], Locations: [], "Cost Centers": [] };
  const queue = [nodeId];
  const seen = new Set([nodeId]);
  while (queue.length) {
    const id = queue.shift();
    for (const child of orgChildren(id)) {
      if (seen.has(child.id)) continue;
      seen.add(child.id);
      if (out[child.segment]) out[child.segment].push(child);
      queue.push(child.id);
    }
  }
  return out;
}

// Ancestor chain (root → node, inclusive).
function orgAncestors(nodeId) {
  const chain = [];
  let cur = ORG_INDEX.byId[nodeId];
  while (cur) {
    chain.unshift(cur);
    cur = cur.parentId ? ORG_INDEX.byId[cur.parentId] : null;
  }
  return chain;
}

// =====================================================================
// Sub-components — detail page only
// =====================================================================

function OrgStatTile({ label, value }) {
  return (
    <div className="ot-stat">
      <div className="ot-stat-label">{label}</div>
      <div className="ot-stat-value tabular">{value}</div>
    </div>
  );
}

// Inline pill: distribution rule (custom override vs inherited).
function OrgRulePill({ node }) {
  const ovr = (typeof ORG_OVERRIDE_FOR === "function") ? ORG_OVERRIDE_FOR(node.id) : null;
  if (ovr) {
    return (
      <span className="ot-rule-pill ot-rule-pill--custom" title={ovr.summary}>
        <Icon name="ShieldPerson" size={12} />Custom
      </span>
    );
  }
  return <span className="ot-rule-pill ot-rule-pill--inherited">Inherited</span>;
}

function LocStatusPillOT({ status }) {
  const hue = ({ Active: "success", Invited: "default", Terminated: "default" })[status] || "default";
  return <span className={`req-pill req-pill--${hue}`}>{status}</span>;
}

// ---------- Sticky bulk-action bar -----------------------------------
// Surfaces the actions that scale across rows. Mirrors the affordances
// already on the Locations page so users don't relearn what each button
// does at a new tier.
function OrgBulkBar({ count, segment, parentNode, onClear, onAction }) {
  if (!count) return null;
  const segLow = dfSegLabel(segment, true).toLowerCase();
  return (
    <div className="ot-bulk-bar" role="region" aria-label="Bulk actions">
      <div className="ot-bulk-bar-meta">
        <span className="ot-bulk-bar-count tabular">{count}</span>
        <span className="ot-bulk-bar-label" title={dfSegTooltip(segment, true)}>
          {segLow} selected in {parentNode.name}
        </span>
        <button type="button" className="linkbtn" onClick={onClear}>Clear</button>
      </div>
      <div className="ot-bulk-bar-actions">
        <button type="button" className="btn btn--md btn--tertiary" onClick={() => onAction("export")}>
          <Icon name="FileDownload" size={16} />Export
        </button>
        <button type="button" className="btn btn--md btn--tertiary" onClick={() => onAction("reassign")}>
          <Icon name="PersonArrow" size={16} />Reassign owner
        </button>
        <button type="button" className="btn btn--md btn--tertiary" onClick={() => onAction("policy")}>
          <Icon name="Gavel" size={16} />Apply policy
        </button>
        <button type="button" className="btn btn--md btn--secondary" onClick={() => onAction("rule")}>
          <Icon name="ShieldPerson" size={16} />Apply supplier rule
        </button>
        <span className="ot-bulk-bar-sep" aria-hidden="true" />
        <button type="button" className="btn btn--md btn--tertiary ot-bulk-bar-danger" onClick={() => onAction("deactivate")}>
          <Icon name="Cancel" size={16} />Deactivate
        </button>
      </div>
    </div>
  );
}

// ---------- Descendant table -----------------------------------------
// One table per segment; columns reflect the data each level carries.
// Column labels now use the Dayforce term for the segment with a
// tooltip showing the old Flex Work label (e.g. "Region" with
// title="Formerly 'Division' in Flex Work").
function OrgDescendantsTable({ segment, rows, selected, onToggle, onToggleAll, onOpenChild }) {
  const colDefs = {
    Divisions: [
      { key: "name",     label: dfSegLabel("Divisions"),  tooltip: dfSegTooltip("Divisions"),  width: "1.6fr", render: (r) => <span className="loc-row-name">{r.name}</span> },
      { key: "owner",    label: "Owner",                  width: "1.2fr" },
      { key: "children", label: dfSegLabel("Sectors", true), tooltip: dfSegTooltip("Sectors", true), width: "0.8fr", align: "right",
        render: (r) => <span className="tabular">{orgChildren(r.id).length}</span> },
      { key: "spendYTD", label: "Spend (YTD)",  width: "1fr",   align: "right",
        render: (r) => <span className="tabular">{r.spendYTD}</span> },
      { key: "rule",     label: "Supplier rule",width: "1.2fr", render: (r) => <OrgRulePill node={r} /> },
    ],
    Sectors: [
      { key: "name",     label: dfSegLabel("Sectors"),    tooltip: dfSegTooltip("Sectors"),    width: "1.4fr", render: (r) => <span className="loc-row-name">{r.name}</span> },
      { key: "parent",   label: dfSegLabel("Divisions"),  tooltip: dfSegTooltip("Divisions"),  width: "1.2fr",
        render: (r) => <span className="loc-row-addr">{ORG_INDEX.byId[r.parentId]?.name || "—"}</span> },
      { key: "owner",    label: "Owner",        width: "1.2fr" },
      { key: "children", label: dfSegLabel("Locations", true), tooltip: dfSegTooltip("Locations", true), width: "0.8fr", align: "right",
        render: (r) => <span className="tabular">{orgChildren(r.id).length}</span> },
      { key: "rule",     label: "Supplier rule",width: "1.2fr", render: (r) => <OrgRulePill node={r} /> },
    ],
    Locations: [
      { key: "name",     label: dfSegLabel("Locations"),  tooltip: dfSegTooltip("Locations"),  width: "1.4fr", render: (r) => <span className="loc-row-name">{r.name}</span> },
      { key: "status",   label: "Status",       width: "0.8fr",
        render: (r) => <LocStatusPillOT status={r.status} /> },
      { key: "address",  label: "Address",      width: "2fr",
        render: (r) => <span className="loc-row-addr">{r.address}</span> },
      { key: "shifts",   label: "Shifts",       width: "0.6fr", align: "right",
        render: (r) => <span className="tabular">{r.shifts || "—"}</span> },
      { key: "spend",    label: "Spend",        width: "0.9fr", align: "right",
        render: (r) => <span className="tabular">{r.spend}</span> },
      { key: "rule",     label: "Supplier rule",width: "1.1fr", render: (r) => <OrgRulePill node={r} /> },
    ],
    "Cost Centers": [
      { key: "name",     label: dfSegLabel("Cost Centers"), tooltip: dfSegTooltip("Cost Centers"), width: "1.2fr", render: (r) => <span className="loc-row-name">{r.name}</span> },
      { key: "parent",   label: dfSegLabel("Locations"),   tooltip: dfSegTooltip("Locations"),   width: "1.4fr",
        render: (r) => <span className="loc-row-addr">{ORG_INDEX.byId[r.parentId]?.name || "—"}</span> },
      { key: "owner",    label: "Owner",        width: "1fr" },
      { key: "spendYTD", label: "Spend (YTD)",  width: "0.9fr", align: "right",
        render: (r) => <span className="tabular">{r.spendYTD}</span> },
      { key: "rule",     label: "Supplier rule",width: "1.1fr", render: (r) => <OrgRulePill node={r} /> },
    ],
  };

  const cols = colDefs[segment] || colDefs.Locations;
  const grid = `44px ${cols.map((c) => c.width || "1fr").join(" ")} 52px`;
  const allChecked = rows.length > 0 && rows.every((r) => selected.has(r.id));

  if (rows.length === 0) {
    return <div className="ot-empty">No {dfSegLabel(segment, true).toLowerCase()} under this scope.</div>;
  }

  return (
    <div className="req-table-card ot-table-card" role="table" aria-label={dfSegLabel(segment, true)}>
      <div className="req-scroll">
        <div className="req-row ot-row req-row--header" role="row" style={{ gridTemplateColumns: grid }}>
          <div className="req-cell req-cell--check" role="columnheader">
            <input
              type="checkbox"
              checked={allChecked}
              onChange={onToggleAll}
              aria-label={`Select all ${dfSegLabel(segment, true).toLowerCase()} in view`}
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
          {rows.map((row) => {
            const isChecked = selected.has(row.id);
            return (
              <div
                key={row.id}
                className={`req-row ot-row req-row--clickable${isChecked ? " ot-row--selected" : ""}`}
                role="row"
                tabIndex={0}
                style={{ gridTemplateColumns: grid }}
                onClick={(e) => {
                  if (e.target.closest("input,a,button")) return;
                  onOpenChild(row);
                }}
                onKeyDown={(e) => { if (e.key === "Enter") onOpenChild(row); }}
              >
                <div className="req-cell req-cell--check" role="cell" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => onToggle(row.id)}
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
                    onClick={(e) => openMenu(e.currentTarget, [
                      { icon: "View",         label: `Open ${ORG_SEGMENT_SINGULAR[segment].toLowerCase()}`,
                        onClick: () => onOpenChild(row) },
                      { icon: "ShieldPerson", label: "Set supplier rule",
                        onClick: () => openDistroOverridePanel({
                          scopeName: row.name,
                          scopeSegment: segment,
                          initial: GLOBAL_DEFAULTS,
                          onSave: () => showToast(`Supplier rule applied to ${row.name}`, { kind: "success" }),
                        }) },
                      { icon: "Copy",     label: "Copy ID", onClick: () => copyToClipboard(row.id, "ID copied") },
                      { divider: true },
                      { icon: "TrashCan", label: `Remove ${ORG_SEGMENT_SINGULAR[segment].toLowerCase()}`, danger: true,
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
  );
}

// ---------- Tabbed descendant section --------------------------------
// Tabs across every level below this node — users can act at any
// downstream tier without leaving the page.
function OrgDescendantsTabs({ node, onOpenChild }) {
  const descendants = useMemoOT(() => orgDescendantsBySegment(node.id), [node.id]);
  const childSeg = ORG_CHILD_SEGMENT[node.segment];
  const tabs = ["Divisions", "Sectors", "Locations", "Cost Centers"].filter((s) => descendants[s].length > 0);
  const ordered = childSeg ? [childSeg, ...tabs.filter((t) => t !== childSeg)] : tabs;
  const [tab, setTab] = useStateOT(ordered[0] || "Locations");
  const [selectedBySeg, setSelectedBySeg] = useStateOT({});
  const [query, setQuery] = useStateOT("");

  const selected = selectedBySeg[tab] || new Set();
  const rowsAll = descendants[tab] || [];
  const q = query.trim().toLowerCase();
  const rows = !q ? rowsAll : rowsAll.filter((r) =>
    Object.values(r).some((v) => typeof v === "string" && v.toLowerCase().includes(q))
  );

  const toggle = (id) => {
    setSelectedBySeg((prev) => {
      const cur = new Set(prev[tab] || []);
      if (cur.has(id)) cur.delete(id); else cur.add(id);
      return { ...prev, [tab]: cur };
    });
  };
  const toggleAll = () => {
    setSelectedBySeg((prev) => {
      const cur = new Set(prev[tab] || []);
      const allChecked = rows.length > 0 && rows.every((r) => cur.has(r.id));
      if (allChecked) rows.forEach((r) => cur.delete(r.id));
      else rows.forEach((r) => cur.add(r.id));
      return { ...prev, [tab]: cur };
    });
  };
  const clear = () => setSelectedBySeg((prev) => ({ ...prev, [tab]: new Set() }));

  // Bulk action runner.
  const onAction = (which) => {
    const ids = Array.from(selected);
    const tabPlural = dfSegLabel(tab, true).toLowerCase();
    const summary = `${ids.length} ${tabPlural} under ${node.name}`;
    if (which === "rule") {
      openDistroOverridePanel({
        scopeName: `${ids.length} ${tabPlural}`,
        scopeSegment: tab,
        initial: GLOBAL_DEFAULTS,
        bulkTargets: ids.map((id) => ORG_INDEX.byId[id]).filter(Boolean),
        onSave: () => {
          clear();
          showToast(`Supplier rule applied to ${summary}`, { kind: "success" });
        },
      });
      return;
    }
    if (which === "policy") {
      showToast(`Policy applied to ${summary}`, { kind: "success" });
      clear();
      return;
    }
    if (which === "reassign") {
      showToast(`Owner reassignment started for ${summary}`);
      return;
    }
    if (which === "export") {
      showToast(`Exporting ${summary} as CSV…`);
      return;
    }
    if (which === "deactivate") {
      openConfirm({
        title: `Deactivate ${ids.length} ${tabPlural}?`,
        body: `These ${tabPlural} will stop accepting new requisitions. You can reactivate later.`,
        primaryLabel: "Deactivate",
        danger: true,
        onConfirm: () => {
          clear();
          showToast(`${ids.length} ${tabPlural} deactivated`, { kind: "success" });
        },
      });
    }
  };

  if (ordered.length === 0) {
    return <div className="ot-empty">Nothing under this scope yet.</div>;
  }

  return (
    <React.Fragment>
      <div className="ot-tabs-bar">
        <div className="ot-tabs" role="tablist" aria-label="Descendants">
          {ordered.map((seg) => (
            <button
              key={seg}
              type="button"
              role="tab"
              className={`ot-tab${seg === tab ? " ot-tab--active" : ""}`}
              aria-selected={seg === tab}
              onClick={() => setTab(seg)}
              title={dfSegTooltip(seg, true)}
            >
              <Icon name={ORG_SEGMENT_ICONS[seg]} size={16} />
              <span>{dfSegLabel(seg, true)}</span>
              <span className="ot-tab-count tabular">{descendants[seg].length}</span>
            </button>
          ))}
        </div>
        <div className="loc-search" role="search">
          <span className="loc-search-icon" aria-hidden="true">
            <Icon name="Search" size={16} />
          </span>
          <input
            type="search"
            className="loc-search-input"
            placeholder={`Search ${dfSegLabel(tab, true).toLowerCase()}`}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label={`Search ${dfSegLabel(tab, true).toLowerCase()}`}
          />
        </div>
      </div>

      <OrgDescendantsTable
        segment={tab}
        rows={rows}
        selected={selected}
        onToggle={toggle}
        onToggleAll={toggleAll}
        onOpenChild={onOpenChild}
      />

      <OrgBulkBar
        count={selected.size}
        segment={tab}
        parentNode={node}
        onClear={clear}
        onAction={onAction}
      />
    </React.Fragment>
  );
}

// =====================================================================
// Page: Org node details (Entity / Division / Sector / Cost center)
// =====================================================================

function OrgNodeDetailsPage({ nodeId, onBack, onOpenChild }) {
  const node = ORG_INDEX.byId[nodeId];
  if (!node) {
    return (
      <React.Fragment>
        <ReqOmnibar title="Not found" subtitle="Organization" onBack={onBack} />
        <div className="content-section">
          <div className="ot-empty">That node no longer exists.</div>
        </div>
      </React.Fragment>
    );
  }

  const ancestors    = orgAncestors(node.id);
  const directChildren = orgChildren(node.id);
  const descendants  = orgDescendantsBySegment(node.id);
  const segmentSing  = ORG_SEGMENT_SINGULAR[node.segment];
  const childSeg     = ORG_CHILD_SEGMENT[node.segment];

  // Stats per node kind. Keep these short — 3–4 tiles max so the hero
  // stays scannable.
  const stats = (() => {
    const totalLocs = descendants.Locations.length;
    const totalCCs  = descendants["Cost Centers"].length;
    if (node.segment === "Entities") {
      return [
        { label: dfSegLabel("Divisions", true),    value: descendants.Divisions.length },
        { label: dfSegLabel("Sectors", true),      value: descendants.Sectors.length },
        { label: dfSegLabel("Locations", true),    value: totalLocs },
        { label: dfSegLabel("Cost Centers", true), value: totalCCs },
      ];
    }
    if (node.segment === "Divisions") {
      return [
        { label: dfSegLabel("Sectors", true),      value: descendants.Sectors.length },
        { label: dfSegLabel("Locations", true),    value: totalLocs },
        { label: dfSegLabel("Cost Centers", true), value: totalCCs },
        { label: "Spend (YTD)", value: node.spendYTD || "—" },
      ];
    }
    if (node.segment === "Sectors") {
      return [
        { label: dfSegLabel("Locations", true),    value: totalLocs },
        { label: dfSegLabel("Cost Centers", true), value: totalCCs },
        { label: "Owner",       value: node.owner || "—" },
        { label: "Spend (YTD)", value: node.spendYTD || "—" },
      ];
    }
    // Cost center / On-Site Department — terminal node.
    return [
      { label: `Parent ${dfSegLabel("Locations").toLowerCase()}`, value: ORG_INDEX.byId[node.parentId]?.name || "—" },
      { label: "Owner",           value: node.owner || "—" },
      { label: "Spend (YTD)",     value: node.spendYTD || "—" },
    ];
  })();

  const ovr = (typeof ORG_OVERRIDE_FOR === "function") ? ORG_OVERRIDE_FOR(node.id) : null;

  // Header actions: the whole-scope action sits next to More so users
  // can apply a rule to every descendant in one click.
  return (
    <React.Fragment>
      <ReqOmnibar
        title={node.name}
        subtitle={segmentSing}
        onBack={onBack}
        actions={(
          <React.Fragment>
            <button
              type="button"
              className="iconbtn"
              aria-label="Reload"
              title="Reload"
              onClick={() => showToast(`${node.name} refreshed`)}
            >
              <Icon name="Refresh" size={20} />
            </button>
            <button
              type="button"
              className="btn btn--md btn--secondary"
              onClick={() => openDistroOverridePanel({
                scopeName: node.name,
                scopeSegment: node.segment,
                initial: GLOBAL_DEFAULTS,
                onSave: () => showToast(`Supplier rule applied to ${node.name}`, { kind: "success" }),
              })}
            >
              <Icon name="ShieldPerson" size={16} />Set rule for whole scope
            </button>
            <button
              type="button"
              className="iconbtn"
              aria-label="More"
              onClick={(e) => openMenu(e.currentTarget, [
                { icon: "Edit", label: `Edit ${segmentSing.toLowerCase()}`,
                  onClick: () => showToast(`Edit ${node.name}`) },
                { icon: "Copy", label: "Copy ID",
                  onClick: () => copyToClipboard(node.id, "ID copied") },
                { divider: true },
                childSeg && childSeg !== "Cost Centers"
                  ? { icon: "AddCircle", label: `Add ${ORG_SEGMENT_SINGULAR[childSeg].toLowerCase()}`,
                      onClick: () => showToast(`New ${ORG_SEGMENT_SINGULAR[childSeg].toLowerCase()} in ${node.name}`) }
                  : null,
                { divider: true },
                { icon: "Cancel", label: `Deactivate ${segmentSing.toLowerCase()}`, danger: true,
                  onClick: () => openConfirm({
                    title: `Deactivate ${node.name}?`,
                    body: `All ${descendants.Locations.length} ${dfSegLabel("Locations").toLowerCase()}${descendants.Locations.length === 1 ? "" : "s"} under this ${segmentSing.toLowerCase()} will stop accepting new requisitions.`,
                    primaryLabel: "Deactivate",
                    onConfirm: () => { showToast(`${node.name} deactivated`, { kind: "success" }); onBack && onBack(); },
                  }) },
              ].filter(Boolean))}
            >
              <Icon name="MoreVert" size={20} />
            </button>
          </React.Fragment>
        )}
      />

      <div className="req-wf ot-wf">
        {/* Breadcrumb. Clickable up the chain. */}
        {ancestors.length > 1 && (
          <nav className="ot-breadcrumb" aria-label="Organization breadcrumb">
            {ancestors.map((a, i) => {
              const isLast = i === ancestors.length - 1;
              if (isLast) {
                return (
                  <span key={a.id} className="ot-breadcrumb-current">
                    <Icon name={ORG_SEGMENT_ICONS[a.segment]} size={14} />
                    {a.name}
                  </span>
                );
              }
              return (
                <React.Fragment key={a.id}>
                  <button
                    type="button"
                    className="ot-breadcrumb-link"
                    onClick={() => onOpenChild && onOpenChild(a)}
                  >
                    <Icon name={ORG_SEGMENT_ICONS[a.segment]} size={14} />
                    {a.name}
                  </button>
                  <Icon name="ChevronRight" size={14} />
                </React.Fragment>
              );
            })}
          </nav>
        )}

        {/* Hero card */}
        <section className="ot-hero">
          <div className="ot-hero-row">
            <span className={`ot-hero-icon ot-hero-icon--${node.segment.toLowerCase().replace(/\s+/g, "-")}`} aria-hidden="true">
              <Icon name={ORG_SEGMENT_ICONS[node.segment]} size={28} />
            </span>
            <div className="ot-hero-text">
              <div className="ot-hero-eyebrow">{segmentSing}</div>
              <h1 className="ot-hero-name">{node.name}</h1>
              <div className="ot-hero-meta">
                {node.address && <span><Icon name="Location" size={14} />{node.address}</span>}
                {node.country && <span>{node.country}</span>}
                {node.owner   && <span><Icon name="Person" size={14} />{node.owner}</span>}
                <span className="ot-hero-id">ID: <span className="tabular">{node.id}</span></span>
              </div>
            </div>
            {ovr ? (
              <div className="ot-hero-rule ot-hero-rule--custom">
                <Icon name="ShieldPerson" size={16} />
                <div>
                  <div className="ot-hero-rule-title">Custom supplier rule</div>
                  <div className="ot-hero-rule-sub">{ovr.summary}</div>
                </div>
              </div>
            ) : (
              <div className="ot-hero-rule">
                <Icon name="ShieldPerson" size={16} />
                <div>
                  <div className="ot-hero-rule-title">Inherits global rule</div>
                  <div className="ot-hero-rule-sub">Tiered cascade · 30-min response window</div>
                </div>
              </div>
            )}
          </div>

          <div className="ot-stats">
            {stats.map((s) => (
              <OrgStatTile key={s.label} label={s.label} value={s.value} />
            ))}
          </div>
        </section>

        {/* Direct-children chip row — fastest path down one level. */}
        {directChildren.length > 0 && childSeg && (
          <section className="ot-direct">
            <div className="ot-direct-head">
              <span className="ot-direct-title" title={dfSegTooltip(childSeg, true)}>Direct {dfSegLabel(childSeg, true).toLowerCase()}</span>
              <span className="ot-direct-count tabular">{directChildren.length}</span>
            </div>
            <div className="ot-direct-chips">
              {directChildren.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className="ot-chip"
                  onClick={() => onOpenChild && onOpenChild(c)}
                >
                  <Icon name={ORG_SEGMENT_ICONS[c.segment]} size={14} />
                  <span className="ot-chip-name">{c.name}</span>
                  <span className="ot-chip-meta tabular">{orgChildren(c.id).length}</span>
                </button>
              ))}
            </div>
          </section>
        )}

        {/* Time capture — read-only summary by default, editable via
            the Edit button. Set at every level of the hierarchy; lower
            levels inherit from their parent until overridden. We
            synthesize a `loc` shape from the node so the same
            component drives the Location-detail accordion and these
            org-tree pages. */}
        {(() => {
          const parent = ancestors.length > 1 ? ancestors[ancestors.length - 2] : null;
          const inheritedFrom = parent ? `${parent.name} (${ORG_SEGMENT_SINGULAR[parent.segment]})` : null;
          const fakeLoc = {
            id: `tc-${node.id}`,
            name: node.name,
            // Pull an address off the node if there is one — drives
            // country detection (US states → imperial, else metric).
            address: node.address || (node.country ? `, ${node.country}` : ""),
          };
          return (
            <LocAccordionCard icon="PersonClock" title="Time capture" defaultOpen={true}>
              <LocTimeCaptureBody
                loc={fakeLoc}
                scope={segmentSing.toLowerCase()}
                inheritedFrom={inheritedFrom}
              />
            </LocAccordionCard>
          );
        })()}

        {/* Rate card — base pay inherited from the tenant rate card,
            with a per-job override at this org level that cascades to
            every level beneath it. v1.42. */}
        {window.NodeRateCardBody && (
          <LocAccordionCard icon="Pay" title="Rate card" defaultOpen={false}>
            <window.NodeRateCardBody node={node} />
          </LocAccordionCard>
        )}

        {/* Tabbed descendant tables with multi-select + bulk action bar.
            Cost-center nodes are terminal, so no tabs there. */}
        {node.segment !== "Cost Centers" && (
          <section className="ot-descendants">
            <div className="ot-section-head">
              <h2 className="ot-section-title">Everything under {node.name}</h2>
              <p className="ot-section-sub">
                Select rows to act on specific items, or use the header action above to apply changes to every {descendants.Locations.length} {dfSegLabel("Locations").toLowerCase()}{descendants.Locations.length === 1 ? "" : "s"} in this scope.
              </p>
            </div>
            <OrgDescendantsTabs key={node.id} node={node} onOpenChild={onOpenChild} />
          </section>
        )}
      </div>
    </React.Fragment>
  );
}

// =====================================================================
// Exports
// =====================================================================

Object.assign(window, {
  ORG_RAW,
  ORG_INDEX,
  orgChildren,
  orgAncestors,
  orgDescendantsBySegment,
  ORG_SEGMENT_ICONS,
  ORG_SEGMENT_SINGULAR,
  ORG_CHILD_SEGMENT,
  DF_SEG_LABEL,
  FW_SEG_LABEL,
  dfSegLabel,
  dfSegTooltip,
  OrgNodeDetailsPage,
});
