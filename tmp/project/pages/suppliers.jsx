// =====================================================================
// Flex Work — Suppliers
//   · SuppliersPage         — list view (search + table + pagination)
//   · SupplierDetailsPage   — profile hero, quick-action metric cards,
//                             empty accordions (same empties as Requisition
//                             details).
// =====================================================================

const { useState: useStateSup, useMemo: useMemoSup, useEffect: useEffectSup } = React;

// ---------- Mock data ----------------------------------------------------
// 12 suppliers — most "Active", a couple "Invited", one "Terminated".
// Avatars reuse the brand swatches from req-shared (SW / TH / PH / SS / GS)
// plus a few extras for variety on the list page.

const SUPPLIERS = [
  { id: "gs", name: "GoodShift",        bg: "#87DED1", fg: "#07312B", status: "Active",     spend: "$128,450", locations: 12, workers: 47, requisitions: 8, supplierId: "19dab1…1e1171", address: "250 Greenwich St., New York, NY", site: "goodshift.com",        phone: "+1 (212) 555-0142" },
  { id: "sw", name: "StaffWise",        bg: "#43BEEF", fg: "#062D3D", status: "Active",     spend: "$94,210",  locations: 8,  workers: 32, requisitions: 5, supplierId: "84acd9…b2f04a", address: "1300 Market St., San Francisco, CA", site: "staffwise.io",         phone: "+1 (415) 555-0188" },
  { id: "th", name: "Talent Hub",       bg: "#F9B571", fg: "#76420F", status: "Active",     spend: "$67,890",  locations: 5,  workers: 21, requisitions: 4, supplierId: "62b1ce…78d3a2", address: "200 Park Ave., New York, NY",       site: "talenthub.work",       phone: "+1 (646) 555-0173" },
  { id: "ph", name: "Pro Hire",         bg: "#EFC056", fg: "#6E4517", status: "Active",     spend: "$52,375",  locations: 4,  workers: 18, requisitions: 3, supplierId: "f0a8b7…d51e09", address: "500 Boylston St., Boston, MA",      site: "prohire.com",          phone: "+1 (617) 555-0156" },
  { id: "ss", name: "Skill Scouts",     bg: "#A476EA", fg: "#311254", status: "Active",     spend: "$48,002",  locations: 3,  workers: 14, requisitions: 2, supplierId: "2c7fa1…a0bc44", address: "1234 Wynkoop St., Denver, CO",      site: "skillscouts.co",       phone: "+1 (720) 555-0119" },
  { id: "wf", name: "WorkForce Now",    bg: "#F08A8A", fg: "#5A1414", status: "Active",     spend: "$39,815",  locations: 4,  workers: 11, requisitions: 2, supplierId: "8e21cd…0f9b72", address: "77 W. Wacker Dr., Chicago, IL",     site: "workforcenow.app",     phone: "+1 (312) 555-0102" },
  { id: "rl", name: "RoleLink",         bg: "#7CC8A8", fg: "#0B3826", status: "Active",     spend: "$31,420",  locations: 3,  workers: 9,  requisitions: 1, supplierId: "55d8a4…3e2f81", address: "411 1st Ave. S., Seattle, WA",      site: "rolelink.net",         phone: "+1 (206) 555-0167" },
  { id: "tm", name: "TempMatch",        bg: "#9EAEFA", fg: "#1B2762", status: "Active",     spend: "$24,950",  locations: 2,  workers: 7,  requisitions: 1, supplierId: "a7bd1c…f54009", address: "100 Peachtree St. NE, Atlanta, GA", site: "tempmatch.work",       phone: "+1 (404) 555-0145" },
  { id: "sh", name: "Shifty",           bg: "#F4A4D8", fg: "#5A1340", status: "Invited",    spend: "—",        locations: 0,  workers: 0,  requisitions: 0, supplierId: "—",          address: "1455 Market St., San Francisco, CA", site: "shifty.com",          phone: "+1 (415) 555-0193" },
  { id: "qs", name: "QuickStaff",       bg: "#C9B891", fg: "#42301A", status: "Invited",    spend: "—",        locations: 0,  workers: 0,  requisitions: 0, supplierId: "—",          address: "888 Brannan St., San Francisco, CA",  site: "quickstaff.io",       phone: "+1 (415) 555-0124" },
  { id: "fp", name: "FlexPool",         bg: "#82C0E0", fg: "#0B3045", status: "Active",     spend: "$18,720",  locations: 2,  workers: 5,  requisitions: 1, supplierId: "1f44ce…b8d20a", address: "1 World Trade Ctr., New York, NY",  site: "flexpool.team",        phone: "+1 (212) 555-0179" },
  { id: "hr", name: "Hireling",         bg: "#D6D2C8", fg: "#3D362A", status: "Terminated", spend: "$7,415",   locations: 1,  workers: 0,  requisitions: 0, supplierId: "9b2a5e…71fd0c", address: "350 5th Ave., New York, NY",       site: "hireling.work",        phone: "+1 (212) 555-0131" },
];

// ---------- Temp-spend tier scaling -------------------------------------
// The hand-tuned roll-up numbers (spend / locations / workers /
// requisitions) are anchored to the $10M demo baseline. At other tiers
// scale each row through TEMP_SPEND_SCALE so a $1M supplier reads ~$13k
// with a handful of workers, and a $500M+ supplier reads in the millions
// with thousands of workers. The 12-supplier ROSTER itself stays fixed
// — suppliers are curated brand identities, not a length-scaled list.
(function () {
  const sN = window.scaleN || ((n) => n);
  const sSmall = window.scaleSmall || ((n) => n);
  const sMoney = window.scaleMoneyStr || ((s) => s);
  SUPPLIERS.forEach((s) => {
    if (typeof s.locations === "number" && s.locations > 0)
      s.locations    = Math.max(1, sSmall(s.locations));
    if (typeof s.workers === "number" && s.workers > 0)
      s.workers      = Math.max(1, sSmall(s.workers));
    if (typeof s.requisitions === "number" && s.requisitions > 0)
      s.requisitions = Math.max(1, sSmall(s.requisitions));
    if (typeof s.spend === "string" && s.spend && s.spend !== "—")
      s.spend = sMoney(s.spend);
  });
})();

// Register the supplier spend column for live currency switching. The
// helper rewrites the "$" in each row to the active country's symbol on
// load AND on every subsequent country change.
if (typeof window !== "undefined" && window.registerCurrencyData) {
  window.registerCurrencyData(SUPPLIERS);
}

const SUP_PAGE_SIZE = 10;

// ---------- Status pill --------------------------------------------------
const SUP_STATUS_HUES = {
  "Active":     "success",
  "Invited":    "default",
  "Terminated": "default",
};

function SupplierStatusPill({ status }) {
  const hue = SUP_STATUS_HUES[status] || "default";
  return <span className={`req-pill req-pill--${hue}`}>{status}</span>;
}

// Render the tier badge across list, scorecards, and distribution
// preview. Accepts the raw tier key from SCORECARDS.
const TIER_DISPLAY = {
  tier1:     "Tier 1",
  tier2:     "Tier 2",
  tier3:     "Tier 3",
  probation: "Probation",
  pending:   "Pending",
};
function tierLabel(tier) {
  return TIER_DISPLAY[tier] || (tier ? tier : "—");
}
function TierBadge({ tier }) {
  if (!tier) return <span className="vms-emp-lowemp">—</span>;
  return (
    <span className={`vms-tier vms-tier--${tier}`}>
      {tierLabel(tier)}
    </span>
  );
}

// ---------- Supplier avatar (large, circular) ---------------------------
// Uses the same swatch as the small chip but renders at a custom size.
// `grey={true}` opts into the neutral / default Everest avatar styling —
// used in dense list views where 12 colourful avatars in a row was noise.
function SupplierAvatar({ s, size = 32, grey = false }) {
  // Match Everest avatar scale: ~36% of the bubble diameter.
  const fontSize = Math.max(9, Math.round(size * 0.36));
  const short = (s.name || "")
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  const bg = grey ? "var(--evr-neutral-95)" : s.bg;
  const fg = grey ? "var(--evr-content-primary-highemp)" : s.fg;
  return (
    <span
      className="sup-avatar"
      style={{ background: bg, color: fg, width: size, height: size, fontSize }}
      aria-label={s.name}
    >
      {short}
    </span>
  );
}

// ---------- Toolbar (search + actions) above the table -----------------
function SuppliersToolbar({ query, onQuery }) {
  return (
    <div className="inv-toolbar">
      <div className="inv-search">
        <span className="inv-search-icon" aria-hidden="true">
          <Icon name="Search" size={24} />
        </span>
        <input
          type="search"
          className="inv-search-input"
          placeholder="Search for supplier, site, contact"
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          aria-label="Search suppliers"
        />
      </div>
      <div className="inv-toolbar-actions">
        <ListToolbarActions kind="suppliers" columns={["Supplier", "Status", "Spend", "Sites", "Workers"]} showMore={false} />
      </div>
    </div>
  );
}

// =====================================================================
// Compare rates panel — opens from the suppliers toolbar. Shows up to
// three active suppliers' rate cards side-by-side. The same position
// list runs down the rows so an admin can eyeball band differences
// during panel rationalization. Read-only.
// =====================================================================
function SupCompareRatesPanel() {
  const [open, setOpen] = useStateSup(false);
  useEffectSup(() => Interactions.on("supCompareRates", ({ open }) => setOpen(!!open)), []);
  const suppliers = useMemoSup(() => {
    const list = (typeof window !== "undefined" && window.SUPPLIERS) || [];
    return list.filter((s) => s.status === "Active").slice(0, 3);
  }, [open]);
  const contracts = useMemoSup(
    () => suppliers.map((s) => ((typeof window !== "undefined" && window.getSupplierContract) ? window.getSupplierContract(s.id) : null)),
    [suppliers]
  );
  // Positions list: intersect every contract's positions so the
  // comparison aligns row by row. Falls back to the first contract.
  const positions = useMemoSup(() => {
    if (contracts.length === 0) return [];
    return (contracts[0]?.positions || []).slice(0, 10);
  }, [contracts]);

  const billRateFor = (contract, p) => {
    if (!contract) return null;
    const row = (contract.positions || []).find((x) => x.id === p.id);
    if (!row) return null;
    // v0.79 · M4 — route through the staged reducer so the comparison
    // surfaces the same numbers the supplier-contract page renders.
    if (typeof window !== "undefined" && window.runRateStages) {
      const ctx = {
        date: new Date().toISOString().slice(0, 10),
        country: contract.country || "US",
        currency: row.currency || contract.defaultCurrency || "USD",
      };
      const r = window.runRateStages(row, contract, ctx);
      return Math.round(r.billRate);
    }
    const base = (row.payRatePref || row.payRate) || 0;
    const load = (typeof window !== "undefined" && window.rowAdditiveLoadPct) ? window.rowAdditiveLoadPct(row) : 0;
    const pos = row.positionMarkup || 0;
    const districts = contract.operatingDistricts || [];
    const dvals = districts.map((id) => contract.districtMarkups?.[id] ?? 20);
    const avgDistrict = dvals.length ? Math.round(dvals.reduce((a, b) => a + b, 0) / dvals.length) : 25;
    const effective = pos || avgDistrict;
    return Math.round(base * (1 + load / 100) * (1 + effective / 100));
  };

  // v0.79 · M4 — staged build-up per supplier per role. Returns an
  // array of { stage, label, delta } so the row can render as a stacked
  // bar (pay + premium + contribution + skill + tenure + markup + tax)
  // and procurement can see where the savings come from at a glance.
  const buildupFor = (contract, p) => {
    if (!contract) return null;
    const row = (contract.positions || []).find((x) => x.id === p.id);
    if (!row || !window.runRateStages) return null;
    return window.runRateStages(row, contract, {
      date: new Date().toISOString().slice(0, 10),
      country: contract.country || "US",
      currency: row.currency || contract.defaultCurrency || "USD",
    });
  };

  return (
    <SidePanel
      open={open}
      title="Compare rate cards"
      onClose={() => setOpen(false)}
      width={920}
      footer={(
        <button type="button" className="btn btn--lg btn--primary" onClick={() => setOpen(false)}>Done</button>
      )}
    >
      <p className="sp-hint" style={{ margin: "0 0 12px" }}>
        Side-by-side view of {suppliers.length} active suppliers. Bill rate is the loaded
        rate at the operating-district average; switch supplier panels for tier-1
        comparisons during QBR.
      </p>
      <div className="sup-compare-table" role="table">
        <div className="sup-compare-head" role="row">
          <div role="columnheader">Position</div>
          {suppliers.map((s) => (
            <div key={s.id} role="columnheader">
              <div className="sup-compare-sup">{s.name}</div>
              <div className="sup-compare-supsub">{s.workers || 0} workers · {s.contract || "MSA"}</div>
            </div>
          ))}
        </div>
        {positions.map((p) => {
          const rates = suppliers.map((s, i) => billRateFor(contracts[i], p));
          const builds = suppliers.map((s, i) => buildupFor(contracts[i], p));
          const valid = rates.filter((n) => n != null);
          const min = Math.min(...valid);
          // v0.79 · M4 — color per stage. Stacked bar shares the same
          // dictionary so admin reads the same color in popover & bar.
          const STAGE_COLOR = {
            base:         "var(--evr-blue-400)",
            premium:      "var(--evr-purple-400, #a855f7)",
            contribution: "var(--evr-yellow-500, #eab308)",
            skill:        "var(--evr-teal-500, #14b8a6)",
            tenure:       "var(--evr-orange-500, #f97316)",
            markup:       "var(--evr-green-500, #22c55e)",
            tax:          "var(--evr-red-400, #ef4444)",
          };
          const maxRate = Math.max(...valid, 1);
          return (
            <div className="sup-compare-row sup-compare-row--staged" role="row" key={p.id}>
              <div role="cell">
                <b>{p.name}</b>
                <div className="sup-compare-pos-sub">{p.classification || "W-2"} · pref ${p.payRatePref || p.payRate}/hr</div>
              </div>
              {rates.map((r, i) => {
                const b = builds[i];
                return (
                  <div role="cell" key={i} className="sup-compare-cell sup-compare-cell--staged">
                    {r == null ? (
                      <span style={{ color: "var(--evr-content-primary-lowemp)" }}>—</span>
                    ) : (
                      <div className="sup-compare-stack">
                        <div className="sup-compare-bar" title={`Bill rate $${r}/hr`} style={{ width: `${Math.round(r / maxRate * 100)}%` }}>
                          {(b ? b.breakdown : []).filter((seg) => Math.abs(seg.delta || seg.value || 0) > 0).map((seg, j) => (
                            <span
                              key={j}
                              className="sup-compare-seg"
                              title={`${seg.label} · ${seg.kind === "amount" ? `$${seg.value.toFixed(2)}` : `+$${(seg.delta || 0).toFixed(2)} (${seg.value}%)`}`}
                              style={{
                                flexGrow: Math.abs(seg.kind === "amount" ? seg.value : seg.delta),
                                background: STAGE_COLOR[seg.stage] || "var(--evr-neutral-50)",
                              }}
                            />
                          ))}
                        </div>
                        <span className={`tabular ${r === min && valid.length > 1 ? "sup-compare-low" : ""}`}>${r}/hr</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
        {/* v0.79 · M4 — legend */}
        <div className="sup-compare-legend">
          {[
            ["base", "Base pay"],
            ["premium", "Premiums"],
            ["contribution", "Contributions"],
            ["skill", "Skills"],
            ["tenure", "Tenure"],
            ["markup", "Markup"],
            ["tax", "Tax"],
          ].map(([k, label]) => (
            <span key={k} className="sup-compare-legend-item">
              <i className="sup-compare-legend-swatch" style={{
                background: ({
                  base: "var(--evr-blue-400)",
                  premium: "var(--evr-purple-400, #a855f7)",
                  contribution: "var(--evr-yellow-500, #eab308)",
                  skill: "var(--evr-teal-500, #14b8a6)",
                  tenure: "var(--evr-orange-500, #f97316)",
                  markup: "var(--evr-green-500, #22c55e)",
                  tax: "var(--evr-red-400, #ef4444)",
                })[k],
              }} />
              {label}
            </span>
          ))}
        </div>
      </div>
    </SidePanel>
  );
}

// ---------- Row ---------------------------------------------------------
function SupplierRow({ row, checked, onToggle, onOpen, vc }) {
  const rowMenu = (e) => {
    e.stopPropagation();
    openMenu(e.currentTarget, [
      { icon: "View",       label: "View profile", onClick: () => onOpen && onOpen(row.id) },
      { icon: "Edit",       label: "Edit supplier" },
      { icon: "Briefcase",  label: "New requisition", onClick: () => showToast(`Starting requisition for ${row.name}`) },
      { icon: "Pay",        label: "View invoices", onClick: () => showToast(`Showing invoices for ${row.name}`) },
      { divider: true },
      row.status === "Active"
        ? { icon: "Cancel", label: "Terminate supplier", danger: true,
            onClick: () => openConfirm({
              title: `Terminate ${row.name}?`,
              body: `New requisitions will not include ${row.name}. Existing work assignments continue until completion.`,
              primaryLabel: "Terminate",
              onConfirm: () => showToast(`${row.name} terminated`, { kind: "success" }),
            }) }
        : { icon: "AddCircle", label: "Activate supplier", onClick: () => showToast(`${row.name} activated`, { kind: "success" }) },
    ]);
  };
  const sc = row._sc || {};
  const meterKind = (n, good, ok) => n == null ? "" : (n >= good ? "ok" : n >= ok ? "warn" : "err");
  const fillKind = meterKind(sc.fillRate, 90, 75);
  // Lower is better for TTF and no-show
  const ttfKind = sc.ttf == null ? "" : (sc.ttf <= 45 ? "ok" : sc.ttf <= 90 ? "warn" : "err");
  const nsKind  = sc.noShow == null ? "" : (sc.noShow <= 3 ? "ok" : sc.noShow <= 6 ? "warn" : "err");
  const qKind   = sc.quality == null ? "" : (sc.quality >= 4.5 ? "ok" : sc.quality >= 4.0 ? "warn" : "err");
  const fmtMin = window.fmtMin || ((n) => n == null ? "—" : `${n} min`);
  const show = (id) => !vc || vc.showCol(id);
  return (
    <div
      className="req-row sup-row-v2 req-row--clickable"
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
      {show("supplier") && (
        <div className="sup-cell-v2" role="cell">
          <div className="sup-row-supplier-cell">
            <SupplierAvatar s={row} size={36} grey />
            <div className="sup-row-stack">
              <span className="sup-row-name">{row.name}</span>
            </div>
          </div>
        </div>
      )}
      {show("status") && (
        <div className="sup-cell-v2" role="cell">
          <SupplierStatusPill status={row.status} />
        </div>
      )}
      {show("tier") && (
        <div className="sup-cell-v2" role="cell">
          <TierBadge tier={sc.tier} />
        </div>
      )}
      {show("fillRate") && (
        <div className="sup-cell-v2" role="cell">
          {sc.fillRate == null ? <span className="vms-emp-lowemp">—</span> : (
            <span className="sup-fillrate-val tabular">{sc.fillRate}%</span>
          )}
        </div>
      )}
      {show("ttf") && (
        <div className="sup-cell-v2" role="cell">
          {sc.ttf == null ? <span className="vms-emp-lowemp">—</span> : (
            <span className="tabular">{fmtMin(sc.ttf)}</span>
          )}
        </div>
      )}
      {show("noShow") && (
        <div className="sup-cell-v2 sup-cell-v2--right" role="cell">
          {sc.noShow == null ? <span className="vms-emp-lowemp">—</span> : (
            <span className="tabular">{sc.noShow.toFixed(1)}%</span>
          )}
        </div>
      )}
      {show("spend") && (
        <div className="sup-cell-v2 sup-cell-v2--right" role="cell">
          <span className="req-bill tabular">{row.spend}</span>
        </div>
      )}
      {window.V77Cols && window.V77Cols.isOn() && show("supplierTypes") && (
        <div className="req-cell req-cell--v77st" role="cell">
          {window.V77Cols ? window.V77Cols.supplierTypesOf(row, row.id).map((t) => (
            <span className="v77-st" key={t}>{t}</span>
          )) : null}
        </div>
      )}
      <div className="sup-cell-v2 sup-cell-v2--right" role="cell">
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
function SupHeaderCell({ children, className = "", align = "left" }) {
  return (
    <div
      className={`sup-cell-v2${align === "right" ? " sup-cell-v2--right" : ""} ${className}`}
      role="columnheader"
    >
      <span>{children}</span>
      <span className="req-sort" aria-hidden="true" title="Sort" style={{ marginLeft: 4 }}>
        <Icon name="ArrowsUpDownSmall" size={14} />
      </span>
    </div>
  );
}

// ---------- Table --------------------------------------------------------
function SuppliersTable({ rows, total, page, totalPages, onPageChange, pageSize, onPageSizeChange, onOpenRow, f }) {
  const [selected, setSelected] = useStateSup(() => new Set());
  const allChecked = rows.length > 0 && rows.every((r) => selected.has(r.id));
  const v77On = window.V77Cols && window.V77Cols.isOn();
  const stOpts = v77On ? window.V77Cols.supplierTypeOpts() : [];

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

  // -- Bulk actions unique to Suppliers --------------------------------
  // VMS leads usually take supplier rosters in batches: re-tier
  // performers, blast a broadcast about a new req, repoint distribution
  // priority, or pause underperformers. Tier + Distribute are the
  // primary actions because they're the levers VMS uses every week.
  const bulkActSup = (msg, kind = "success") => {
    if (window.showToast) window.showToast(msg, { kind });
    setSelected(new Set());
  };
  const nSup = selected.size;
  const sumSup = `${nSup} ${nSup === 1 ? "supplier" : "suppliers"}`;
  const bulkActionsSup = [
    { icon: "Broadcast",    label: "Broadcast",   onClick: () => bulkActSup(`Broadcast sent to ${sumSup}`) },
    { icon: "ShieldPerson", label: "Re-tier",     onClick: () => bulkActSup(`Re-tier panel opened for ${sumSup}`, "info") },
    { icon: "Adjustment",   label: "Distribute",  onClick: () => bulkActSup(`Distribution rule applied to ${sumSup}`) },
    { icon: "TimeUndo",     label: "Pause",       onClick: () => bulkActSup(`Paused new work assignments for ${sumSup}`, "warning") },
    { icon: "FileDownload", label: "Export",      onClick: () => bulkActSup(`Exported ${sumSup} performance to CSV`) },
    { divider: true },
    { icon: "PersonUnauthorize", label: "Terminate", onClick: () => bulkActSup(`Termination workflow opened for ${sumSup}`, "warning"), kind: "danger" },
  ];
  const bulkOverflowSup = [
    { icon: "Notes",       label: "Request scorecard review", onClick: () => bulkActSup(`Scorecard review requested from ${sumSup}`) },
    { icon: "FileAgent",   label: "Resend contract addendum", onClick: () => bulkActSup(`Contract addendum resent to ${sumSup}`) },
    { icon: "Send",        label: "Invite to new RFP",        onClick: () => bulkActSup(`RFP invitation sent to ${sumSup}`) },
  ];

  // ---- View customizer ------------------------------------------------
  const supVcManifest = React.useMemo(() => {
    const columns = [
      { id: "supplier", label: "Supplier",     width: "minmax(160px, 1.4fr)" },
      { id: "status",   label: "Status",       width: "minmax(96px, 0.7fr)" },
      { id: "tier",     label: "Tier",         width: "minmax(96px, 0.7fr)" },
      { id: "fillRate", label: "Fill rate",    width: "minmax(96px, 0.8fr)" },
      { id: "ttf",      label: "Time to fill", width: "minmax(100px, 0.8fr)" },
      { id: "noShow",   label: "No-show",      width: "minmax(80px, 0.6fr)" },
      { id: "spend",    label: "Spend",        width: "minmax(80px, 0.7fr)" },
    ];
    if (v77On) columns.push({ id: "supplierTypes", label: "Supplier types", width: "180px" });
    const filters = [
      { id: "status",    label: "Status" },
      { id: "location",  label: "Site" },
      { id: "spend",     label: "Spend" },
      { id: "onboarded", label: "Onboarded" },
    ];
    if (stOpts.length > 1) filters.push({ id: "supplierTypes", label: "Supplier types" });
    return { columns, filters };
  }, [v77On, stOpts.length]);
  const vc = useViewCustomizer("suppliers", supVcManifest);
  const supGridStyle = vc.gridStyle
    ? { gridTemplateColumns: `44px ${vc.gridStyle.gridTemplateColumns} 44px` }
    : undefined;
  const vcRow = { ...vc, gridStyle: supGridStyle };

  return (
    <React.Fragment>
    <div className="req-table-card sup-table-card" role="table" aria-label="Suppliers">
      <div className="req-filters">
        <div className="req-filters-left">
          {vc.showFilter("status")    && <FilterChip label="Status"    active={f.filters.status.length > 0}   count={f.filters.status.length}   onClick={f.openFor("status",   "Status",    ["Active", "Invited", "Terminated"])} />}
          {vc.showFilter("location")  && <FilterChip label="Site"  active={f.filters.location.length > 0} count={f.filters.location.length} onClick={f.openFor("location", "Location",  Array.from(new Set(SUPPLIERS.map((s) => s.address.split(",").pop().trim()))).sort())} />}
          {vc.showFilter("spend")     && <FilterChip label="Spend"     active={f.filters.spend.length > 0}    count={f.filters.spend.length}    onClick={f.openFor("spend",    "Spend",     SUP_SPEND_OPTIONS())} />}
          {vc.showFilter("onboarded") && <FilterChip label="Onboarded" active={f.filters.onboarded.length > 0} count={f.filters.onboarded.length} onClick={f.openFor("onboarded", "Onboarded", ["This year", "Last year", "Older than 1 year"])} />}
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
        <div className="req-row sup-row-v2 req-row--header" role="row" style={supGridStyle}>
          <div className="req-cell req-cell--check" role="columnheader">
            <input
              type="checkbox"
              checked={allChecked}
              onChange={toggleAll}
              aria-label="Select all rows on this page"
            />
          </div>
          {vc.showCol("supplier") && <SupHeaderCell>Supplier</SupHeaderCell>}
          {vc.showCol("status")   && <SupHeaderCell>Status</SupHeaderCell>}
          {vc.showCol("tier")     && <SupHeaderCell>Tier</SupHeaderCell>}
          {vc.showCol("fillRate") && <SupHeaderCell>Fill rate</SupHeaderCell>}
          {vc.showCol("ttf")      && <SupHeaderCell>Time to fill</SupHeaderCell>}
          {vc.showCol("noShow")   && <SupHeaderCell align="right">No-show</SupHeaderCell>}
          {vc.showCol("spend")    && <SupHeaderCell align="right">Spend</SupHeaderCell>}
          {v77On && vc.showCol("supplierTypes") && <div className="req-cell req-cell--v77st" role="columnheader">Supplier types</div>}
          <div className="req-cell sup-cell--actions" role="columnheader" aria-label=""></div>
        </div>

        <div className="req-body" role="rowgroup">
          {rows.map((row) => (
            <SupplierRow
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
      noun="supplier"
      onClear={() => setSelected(new Set())}
      actions={bulkActionsSup}
      overflow={bulkOverflowSup}
    />
    {vc.panel}
    </React.Fragment>
  );
}

// ---------- List page ---------------------------------------------------
// Parse a "$128,450" / "£128,450" / "—" / "$1.2M" string into a numeric
// amount. Tolerant of any currency symbol (we strip non-numeric prefix
// characters) so the supplier table keeps bucketing correctly after a
// country switch swaps "$" → "£" / "€" / etc.
function _supSpendToNumber(s) {
  if (!s || s === "—") return 0;
  const clean = String(s).replace(/[^\d.kmKM]/g, "");
  const mult = /m$/i.test(clean) ? 1e6 : /k$/i.test(clean) ? 1e3 : 1;
  const n = parseFloat(clean.replace(/[mk]$/i, ""));
  return isNaN(n) ? 0 : n * mult;
}
// Bucket labels carry the active currency symbol so the Spend filter
// chip and the filter values stay in sync after a country switch.
function _supBucketLabels() {
  const s = (typeof window !== "undefined" && window.curSymbol) ? window.curSymbol() : "$";
  return {
    under25: `Under ${s}25k`,
    range25: `${s}25k\u2013${s}50k`,
    range50: `${s}50k\u2013${s}100k`,
    over100: `${s}100k+`,
  };
}
const SUP_SPEND_OPTIONS = () => {
  const b = _supBucketLabels();
  return [b.under25, b.range25, b.range50, b.over100];
};
function _supSpendBucket(s) {
  const n = _supSpendToNumber(s);
  const b = _supBucketLabels();
  if (n < 25000)  return b.under25;
  if (n < 50000)  return b.range25;
  if (n < 100000) return b.range50;
  return b.over100;
}
function _supCity(addr) {
  return String(addr || "").split(",").pop().trim();
}
const SUP_ONBOARDED_BUCKETS = ["This year", "Last year", "Older than 1 year"];
const SUP_FILTER_MATCHERS = {
  status:    (row, vals) => vals.includes(row.status),
  location:  (row, vals) => vals.includes(_supCity(row.address)),
  spend:     (row, vals) => vals.includes(_supSpendBucket(row.spend)),
  onboarded: (row, vals) => vals.includes(bucketByHash(row.id, SUP_ONBOARDED_BUCKETS)),
  supplierTypes: (row, vals) =>
    !window.V77Cols || window.V77Cols.matchSupplierTypes(row, vals),
};

function SuppliersPage({ reloadKey, onReload, onOpenRow, onInvite }) {
  const [page, setPage] = useStateSup(1);
  const [pageSize, setPageSize] = useStateSup(SUP_PAGE_SIZE);
  const [query, setQuery] = useStateSup("");
  const f = useFilters({ status: [], location: [], spend: [], onboarded: [], supplierTypes: [] });
  if (window.V77Cols && window.V77Cols.useBodyClass) window.V77Cols.useBodyClass();

  // Reset to page 1 when search or filters change.
  React.useEffect(() => { setPage(1); }, [query, f.filters]);

  const filtered = useMemoSup(() => {
    let list = SUPPLIERS;
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      list = list.filter((r) =>
        r.name.toLowerCase().includes(q) ||
        r.address.toLowerCase().includes(q) ||
        (r.site || "").toLowerCase().includes(q)
      );
    }
    return applyFilters(list, f.filters, SUP_FILTER_MATCHERS);
  }, [query, f.filters]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const rows = useMemoSup(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [page, pageSize, filtered]);

  const handlePageSizeChange = (n) => { setPageSize(n); setPage(1); };
  const handleQuery = (v) => { setQuery(v); setPage(1); };

  return (
    <React.Fragment>
      <Omnibar
        icon="Building"
        title="Suppliers"
        dayforce={{
          primitive: "Supplier",
          subtitle: "new · peer of PlanCarrier",
          product: "Org Setup",
          strategy: "New",
          note: "Supplier is the largest concept Flex Work introduces that Dayforce core doesn't have. Modelled on Plan Carrier, linked to one or more Legal Entities for invoice routing.",
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
          className="omni-create-btn"
          onClick={onInvite}
        >
          <Icon name="AddCircle" size={20} />
          <span>Invite</span>
        </button>
        <button
          type="button"
          className="iconbtn"
          aria-label="More actions"
          onClick={(e) => openMenu(e.currentTarget, [
            { icon: "Scale", label: "Compare rates", onClick: () => Interactions.emit("supCompareRates", { open: true }) },
            { divider: true },
            ...toolbarMenuItems(),
          ])}
        >
          <Icon name="MoreVert" size={20} />
        </button>
      </Omnibar>

      <div className="content-section inv-content" key={reloadKey}>
        <SuppliersToolbar query={query} onQuery={handleQuery} />
        <SuppliersTable
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
      </div>
      <SupCompareRatesPanel />
    </React.Fragment>
  );
}

// ==========================================================================
// Supplier Details
// ==========================================================================

// Re-use AccordionCard + DetailsComingSoon shape from req-details by
// inlining a near-identical accordion that pulls the same styles
// (acc-card, acc-card-head, acc-empty) — those classes are already in
// styles-req.css.

function SupAccordionCard({ icon, title, defaultOpen = false, count, action, children }) {
  // Collapsed by default everywhere — `defaultOpen` kept for API compat
  // but ignored so all accordion sections start closed.
  const [open, setOpen] = useStateSup(false);
  const id = React.useId();
  const toggle = () => setOpen((v) => !v);
  return (
    <section className="acc-card">
      <div
        className="acc-card-head"
        role="button"
        tabIndex={0}
        aria-expanded={open}
        aria-controls={id}
        onClick={toggle}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(); } }}
      >
        <span className="acc-card-avatar" aria-hidden="true">
          <Icon name={icon} size={20} />
        </span>
        <h2 className="acc-card-title">{title}</h2>
        {action && (
          <span className="acc-card-action" onClick={(e) => e.stopPropagation()}>
            {action}
          </span>
        )}
        <span className="acc-card-chev" data-open={open} aria-hidden="true">
          <Icon name="ChevronDown" size={20} />
        </span>
      </div>
      {open && (
        <div id={id} className="acc-card-body">
          {children}
        </div>
      )}
    </section>
  );
}

function SupComingSoon() { return null; /* legacy — every accordion now renders a real body */ }

// ---------- Real bodies for the Supplier Details accordions ---------

function SupDetailsBody({ s }) {
  return (
    <InfoGrid
      rows={[
        { label: "Billing contact", value: `c/o accounts receivable` },
        { label: "Email",           value: `accountsreceivable@${(s.name || "").toLowerCase().replace(/\s+/g, "")}.com` },
        { label: "Phone",           value: s.phone, tabular: true },
        { label: "Address",         value: s.address },
        { label: "Website",         value: s.site },
        { label: "Supplier ID",     value: s.supplierId, tabular: true, copyable: true },
        { label: "Payment terms",   value: s.status === "Active" ? "Net 30" : "—" },
        { label: "Payout method",   value: s.status === "Active" ? "ACH transfer" : "—" },
      ]}
    />
  );
}

function SupLocationsBody({ s }) {
  // Show the first N locations from the global list, weighted by the
  // supplier's `locations` count so each profile feels different.
  const sourceLocations = (typeof LOCATIONS !== "undefined" ? LOCATIONS : []).slice(0, s.locations || 0);
  return (
    <MiniTable
      empty={`${s.name} isn’t staffing any sites yet.`}
      columns={[
        { key: "name",    label: "Site", width: "1.6fr" },
        { key: "address", label: "Address",  width: "2fr" },
        { key: "shifts",  label: "Shifts",   width: "0.8fr", align: "right", render: (r) => <span className="tabular">{r.shifts || "—"}</span> },
        { key: "workers", label: "Workers",  width: "0.8fr", align: "right", render: (r) => <span className="tabular">{r.workers || "—"}</span> },
      ]}
      rows={sourceLocations}
      onRowClick={(r) => showToast(`Opening ${r.name}`)}
    />
  );
}

function SupRequisitionsBody({ s }) {
  const rows = (typeof REQUISITIONS !== "undefined" ? REQUISITIONS : []).filter((r) => r.suppliers.includes(s.id)).slice(0, 5);
  return (
    <MiniTable
      empty={`No requisitions assigned to ${s.name}.`}
      columns={[
        { key: "id",       label: "Requisition", width: "1.4fr", render: (r) => <span className="tabular">{r.id}</span> },
        { key: "status",   label: "Status",      width: "1fr",   render: (r) => <span className={`req-pill req-pill--${({Booked:"default","In progress":"informative",Completed:"success"})[r.status]||"default"}`}>{r.status}</span> },
        { key: "location", label: "Site",    width: "1.6fr" },
        { key: "dates",    label: "Dates",       width: "1.6fr", render: (r) => r.dates.join(", ") },
        { key: "bill",     label: "Bill",        width: "0.8fr", align: "right", render: (r) => <span className="tabular">{r.bill}</span> },
      ]}
      rows={rows}
      onRowClick={(r) => showToast(`Opening Requisition #${r.id}`)}
    />
  );
}

function SupSowsBody({ sows, onOpenSow }) {
  // Sort: In approval + Active lead, On hold next, Completed / Draft last.
  const ORDER = { "In approval": 0, "Active": 1, "On hold": 2, "Completed": 3, "Draft": 4, "Closed": 5 };
  const rows = [...sows].sort((a, b) => (ORDER[a.status] ?? 9) - (ORDER[b.status] ?? 9));
  const fmt = window.sowFmtMoney || ((n, c) => `${c} ${Math.round(n).toLocaleString()}`);
  const billingLabel = window.sowBillingLabel || ((m) => m);
  return (
    <MiniTable
      empty="No SOWs with this supplier yet. SOWs are scope-based engagements signed under this supplier's MSA."
      columns={[
        { key: "id",      label: "SOW",        width: "1.6fr", render: (r) => <span className="tabular">{r.id}</span> },
        { key: "name",    label: "Scope",      width: "2.6fr" },
        { key: "status",  label: "Status",     width: "1.1fr", render: (r) => {
          const m = window.sowStatusMeta ? window.sowStatusMeta(r.status) : null;
          return m
            ? <span className="sow-row-pill" style={{ color: m.fg, background: m.bg }}>{m.label}</span>
            : <span className="req-pill">{r.status}</span>;
        }},
        { key: "billing", label: "Billing",    width: "1fr",   render: (r) => billingLabel(r.billingModel) },
        { key: "term",    label: "Term",       width: "1.4fr", render: (r) => <span className="tabular">{r.startDate} – {r.endDate}</span> },
        { key: "value",   label: "Total",      width: "1fr",   align: "right", render: (r) => <span className="tabular">{fmt(r.totalValue, r.currency)}</span> },
        { key: "consumed",label: "Consumed",   width: "1fr",   align: "right", render: (r) => {
          const pct = r.totalValue ? Math.round((r.consumed / r.totalValue) * 100) : 0;
          return <span className="tabular">{fmt(r.consumed, r.currency)} <span style={{ color: "var(--evr-content-primary-lowemp)" }}>· {pct}%</span></span>;
        }},
      ]}
      rows={rows}
      onRowClick={(r) => {
        // Phase 3 of unified-req-detail.html — SOW rows route through
        // the unified detail at /requisitions/:id (canonical URL).
        // Decision 01: /sows/:id is the 308 alias; both resolve to the
        // same body. If the host page didn't pass onOpenSow (e.g.
        // embedded in a static context), fall back to a toast.
        if (onOpenSow) onOpenSow(r.id);
        else if (window.flexGoTo) window.flexGoTo({ page: "requisitions", sub: "details", id: r.id });
        else showToast(`Opening ${r.id} · ${r.name}`);
      }}
    />
  );
}

function SupInvoicesBody({ s }) {
  const rows = (typeof INVOICES !== "undefined" ? INVOICES : []).filter((i) => i.supplier === s.id).slice(0, 5);
  return (
    <MiniTable
      empty={{
        illustration: "assets/illustrations/CardMoney.svg",
        title: "No invoices yet",
        body: `Invoices from ${s.name} will appear here once they submit billing for approved timesheets.`,
      }}
      columns={[
        { key: "id",      label: "Invoice", width: "1.4fr", render: (r) => <span className="tabular">INV-{r.id}</span> },
        { key: "status",  label: "Status",  width: "1fr",   render: (r) => <span className={`req-pill req-pill--${({Generated:"default",Issued:"informative",Paid:"success",Overdue:"error"})[r.status]||"default"}`}>{r.status}</span> },
        { key: "invDate", label: "Issued",  width: "1fr",   render: (r) => <span className="tabular">{r.invDate}</span> },
        { key: "dueDate", label: "Due",     width: "1fr",   render: (r) => <span className="tabular">{r.dueDate}</span> },
        { key: "amount",  label: "Amount",  width: "1fr",   align: "right", render: (r) => <span className="tabular">{r.amount}</span> },
      ]}
      rows={rows}
      onRowClick={(r) => showToast(`Opening INV-${r.id}`)}
    />
  );
}

function SupLogsBody({ s }) {
  // Build the log from this supplier's actual relationships so it reads
  // like a real audit trail — names of locations they staff, ids of
  // requisitions and invoices that touched them, headcount of workers
  // on their roster, and whichever lifecycle event matches their status.
  const supReqs = (typeof REQUISITIONS !== "undefined" ? REQUISITIONS : []).filter((r) => r.suppliers.includes(s.id));
  const supInvs = (typeof INVOICES !== "undefined" ? INVOICES : []).filter((i) => i.supplier === s.id);
  const supLocs = (typeof LOCATIONS !== "undefined" ? LOCATIONS : []).slice(0, s.locations || 0);
  const firstReq = supReqs[0];
  const firstLoc = supLocs[0] || { name: "—" };
  const recentInv = supInvs.find((i) => i.status === "Paid") || supInvs[0];

  const isOnboarding = s.status === "Onboarding" || s.status === "Invited";
  const isTerminated = s.status === "Terminated";

  const items = [];

  if (isOnboarding) {
    items.push({ tone: "info",    icon: "PersonPlus", actor: "Nia Thompson", action: "invited", target: s.name, note: "Onboarding in progress", time: "2 weeks ago" });
    items.push({ tone: "info",    icon: "File",       actor: s.name, action: "uploaded MSA + W-9", time: "10 days ago" });
    items.push({ tone: "warning", icon: "Alert",      actor: "System", action: "pending COI on file — expires before first dispatch", time: "8 days ago" });
    items.push({ tone: "info",    icon: "PersonAuthorize", actor: "Aiden Brooks", action: "approved rate card for", target: `${s.workers || 0} job roles`, time: "5 days ago" });
    items.push({ tone: "info",    icon: "Edit",       actor: "Nia Thompson", action: `set payment terms to Net 30 for ${s.name}`, time: "Yesterday" });
  } else if (isTerminated) {
    items.push({ tone: "success", icon: "Check",      actor: s.name, action: `closed out ${s.shifts || s.workers || 0} final shifts`, time: "2 months ago" });
    items.push({ tone: "info",    icon: "Pay",        actor: "Marcus Webb", action: "paid final invoice", target: recentInv ? `INV-${recentInv.id}` : "—", time: "6 weeks ago" });
    items.push({ tone: "warning", icon: "Alert",      actor: "Nia Thompson", action: `flagged contract non-renewal — ${s.name} fill rate below threshold`, time: "1 month ago" });
    items.push({ tone: "info",    icon: "Edit",       actor: "Aiden Brooks", action: `archived ${supReqs.length} requisition record${supReqs.length === 1 ? "" : "s"}`, time: "3 weeks ago" });
    items.push({ tone: "info",    icon: "Cancel",     actor: "System", action: `terminated ${s.name} — no active work assignments remain`, time: "2 weeks ago" });
  } else {
    items.push({ tone: "success", icon: "Check",      actor: s.name, action: "completed onboarding", note: `MSA on file · payment terms Net 30`, time: "Jan 12, 2024" });
    items.push({ tone: "info",    icon: "Building",   actor: "Nia Thompson", action: "expanded coverage to", target: firstLoc.name, note: `${s.locations} site${s.locations === 1 ? "" : "s"} total`, time: "3 months ago" });
    if (firstReq) items.push({ tone: "info", icon: "Briefcase", actor: "Marcus Webb", action: "assigned", target: `Requisition #${firstReq.id}`, note: `${firstReq.jobs[0]} · ${firstReq.location}`, time: "6 weeks ago" });
    items.push({ tone: "success", icon: "PersonPlus", actor: s.name, action: `submitted ${Math.max(2, Math.round((s.workers || 4) / 4))} candidates for review`, time: "2 weeks ago" });
    items.push({ tone: "info",    icon: "PersonClock", actor: "Site supervisor", action: `confirmed ${s.workers || 0}-worker roster across ${s.locations} location${s.locations === 1 ? "" : "s"}`, time: "Last week" });
    if (recentInv) items.push({ tone: "success", icon: "Pay", actor: "Marcus Webb", action: "approved invoice", target: `INV-${recentInv.id}`, note: recentInv.amount, time: "5 days ago" });
    items.push({ tone: "info",    icon: "Edit",       actor: "Nia Thompson", action: `raised submittal cap for ${s.name} to 3 candidates per req`, time: "Yesterday" });
  }
  return <ActivityLog items={items} />;
}

// Quick-action metric card — 3-up grid above the accordions.
function SupQuickCard({ label, value, sublabel, trend }) {
  return (
    <div className="sup-quick-card">
      <div className="sup-quick-label">{label}</div>
      <div className="sup-quick-value tabular">{value}</div>
      <div className="sup-quick-sub">
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

// ---------- Supplier scorecard ------------------------------------------
// Displays the per-supplier performance scorecard on the details page.
// Operational, Delivery and Risk metric groups, each with status colors
// driven by the same thresholds the list view uses.

// Threshold → status class. Pass `inv: true` when lower is better.
function _kindFor(value, good, ok, { inv = false } = {}) {
  if (value == null) return "na";
  if (inv) {
    if (value <= good) return "ok";
    if (value <= ok)   return "warn";
    return "err";
  }
  if (value >= good) return "ok";
  if (value >= ok)   return "warn";
  return "err";
}

// Sparkline using the shared `sparkPath` helper from vms-data.
function ScoreSparkline({ values, w = 260, h = 64 }) {
  if (!values || !values.length) return null;
  const { line, area } = (window.sparkPath || (() => ({ line: "", area: "" })))(values, w, h, 4);
  // Endpoint dot for the latest value.
  const max = Math.max(...values), min = Math.min(...values);
  const range = Math.max(1, max - min);
  const lastX = w - 4;
  const lastY = h - 4 - ((values[values.length - 1] - min) / range) * (h - 8);
  return (
    <svg className="sup-sc-spark" width={w} height={h} viewBox={`0 0 ${w} ${h}`} role="img" aria-label="Fill rate trend">
      <path d={area} className="sup-sc-spark-area" />
      <path d={line} className="sup-sc-spark-line" />
      <circle cx={lastX} cy={lastY} r="3" className="sup-sc-spark-dot" />
    </svg>
  );
}

// Composite ring dial — the hero of the summary band.
function ScoreRing({ value, max = 100, size = 124, stroke = 10, kind = "" }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = value == null ? 0 : Math.max(0, Math.min(1, value / max));
  const dash = c * pct;
  return (
    <div className={`sup-sc-ring sup-sc-ring--${kind || "ok"}`} style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} className="sup-sc-ring-track" strokeWidth={stroke} fill="none" />
        <circle
          cx={size / 2} cy={size / 2} r={r}
          className="sup-sc-ring-fill" strokeWidth={stroke} fill="none"
          strokeDasharray={`${dash} ${c - dash}`}
          strokeDashoffset={c / 4}
          strokeLinecap="round"
        />
      </svg>
      <div className="sup-sc-ring-inner">
        <span className="sup-sc-ring-num tabular">{value ?? "—"}</span>
        <span className="sup-sc-ring-unit">/ {max}</span>
      </div>
    </div>
  );
}

// Single metric row — status dot · label · right-aligned tabular value · optional bar
function ScoreMetric({ label, value, kind = "", help, bar }) {
  const k = kind || "na";
  return (
    <div className={`sup-sc-metric sup-sc-metric--${k}`}>
      <div className="sup-sc-metric-row">
        <span className={`sup-sc-dot sup-sc-dot--${k}`} aria-hidden="true" />
        <span className="sup-sc-metric-label">{label}</span>
        <span className="sup-sc-metric-value tabular">{value}</span>
      </div>
      {help && <span className="sup-sc-metric-help">{help}</span>}
      {bar != null && (
        <div className="sup-sc-bar"><span className="sup-sc-bar-fill" style={{ width: `${Math.max(0, Math.min(100, bar))}%` }} /></div>
      )}
    </div>
  );
}

function SupplierScorecard({ s }) {
  const sc = s._sc || {};
  const fmtMin = window.fmtMin || ((n) => n == null ? "—" : `${n} min`);
  const noData = sc.fillRate == null;

  // Status thresholds — mirrored from the list view.
  const fillKind = _kindFor(sc.fillRate, 90, 75);
  const ttfKind  = _kindFor(sc.ttf, 45, 90, { inv: true });
  const nsKind   = _kindFor(sc.noShow, 3, 6, { inv: true });
  const qKind    = _kindFor(sc.quality, 4.5, 4.0);
  const otKind   = _kindFor(sc.onTime, 92, 85);
  const subKind  = _kindFor(sc.submittals, 4, 2.5);
  const offKind  = _kindFor(sc.offerAccept, 75, 60);
  const reKind   = _kindFor(sc.redeploy, 55, 35);
  const tnKind   = _kindFor(sc.tenure, 12, 8);
  const cmpKind  = _kindFor(sc.complianceRate, 95, 88);
  const lapKind  = _kindFor(sc.credLapses, 2, 6, { inv: true });
  const escKind  = _kindFor(sc.escalations, 5, 12, { inv: true });
  const dispKind = _kindFor(sc.disputes, 5, 10, { inv: true });

  // Composite trend = first vs last fillTrend, used as a proxy delta.
  let compositeDelta = null;
  let compositeDir = "flat";
  if (Array.isArray(sc.fillTrend) && sc.fillTrend.length >= 2) {
    const d = sc.fillTrend[sc.fillTrend.length - 1] - sc.fillTrend[0];
    if (Math.abs(d) >= 1) {
      compositeDir = d > 0 ? "up" : "down";
      compositeDelta = `${d > 0 ? "+" : ""}${d}pt`;
    }
  }

  return (
    <section className="sup-sc-card">
      <header className="sup-sc-head">
        <div className="sup-sc-head-text">
          <h2 className="sup-sc-title">Performance scorecard</h2>
          <p className="sup-sc-sub">
            Trailing 90 days · refreshed daily · benchmarks based on the active supplier panel
          </p>
        </div>
        <div className="sup-sc-head-actions">
          <button type="button" className="btn btn--md btn--secondary">
            <Icon name="FileDownload" size={16} />Export
          </button>
        </div>
      </header>

      {noData ? (
        <div className="sup-sc-empty">
          <Icon name="Hourglass" size={20} />
          <span>{s.status === "Invited" ? "No performance data yet — supplier has not completed onboarding." : "No performance data on file for this supplier."}</span>
        </div>
      ) : (
        <React.Fragment>
          <div className="sup-sc-summary">
            <div className="sup-sc-cell sup-sc-cell--score">
              <span className="sup-sc-cell-label">Composite</span>
              <div className="sup-sc-score">
                <span className="sup-sc-score-num tabular">{sc.composite ?? "—"}</span>
                <span className="sup-sc-score-unit">/ 100</span>
              </div>
              {compositeDelta && (
                <span className={`sup-sc-score-delta sup-sc-score-delta--${compositeDir}`}>
                  <Icon name={compositeDir === "up" ? "ChevronUp" : "ChevronDown"} size={12} />
                  {compositeDelta} vs 6 weeks ago
                </span>
              )}
            </div>

            <div className="sup-sc-cell sup-sc-cell--tier">
              <span className="sup-sc-cell-label">Tier</span>
              <TierBadge tier={sc.tier} />
              <span className="sup-sc-cell-sub">
                {sc.sinceTier ? `Since ${sc.sinceTier}` : "—"}
                {sc.tierTrend === "up"   && " · ▲ promoted"}
                {sc.tierTrend === "down" && " · ▼ demoted"}
              </span>
            </div>

            <div className="sup-sc-cell sup-sc-cell--rank">
              <span className="sup-sc-cell-label">Rank</span>
              <div className="sup-sc-rank">
                <span className="sup-sc-rank-num tabular">#{sc.rank || "—"}</span>
                <span className="sup-sc-rank-of">of {sc.rankOf || "—"}</span>
              </div>
              <span className="sup-sc-cell-sub">
                {sc.rank && sc.rankOf ? `Top ${Math.round((sc.rank / sc.rankOf) * 100)}%` : "—"}
              </span>
            </div>

            <div className="sup-sc-cell sup-sc-cell--trend">
              <span className="sup-sc-cell-label">Fill rate · 7 weeks</span>
              <ScoreSparkline values={sc.fillTrend} />
              <span className="sup-sc-cell-sub">
                {sc.fillTrend ? `${sc.fillTrend[0]}% → ${sc.fillTrend[sc.fillTrend.length - 1]}%` : "—"}
              </span>
            </div>
          </div>

          <div className="sup-sc-groups">
            <div className="sup-sc-group">
              <h3 className="sup-sc-group-title">Operational</h3>
              <div className="sup-sc-group-grid">
                <ScoreMetric label="Fill rate"    value={`${sc.fillRate}%`}        kind={fillKind} bar={sc.fillRate} help="of requested shifts filled" />
                <ScoreMetric label="Time to fill" value={fmtMin(sc.ttf)}            kind={ttfKind}  help="median, first candidate" />
                <ScoreMetric label="No-show"      value={`${sc.noShow.toFixed(1)}%`} kind={nsKind}  help="of confirmed shifts" />
                <ScoreMetric label="On-time"      value={`${sc.onTime}%`}           kind={otKind}   bar={sc.onTime} help="arrivals on or before start" />
                <ScoreMetric label="Quality"      value={`${sc.quality.toFixed(1)} / 5`} kind={qKind} help="post-shift manager rating" />
                <ScoreMetric label="Billed hours" value={sc.billedHours.toLocaleString()} kind="" help="YTD through Apr 2026" />
              </div>
            </div>

            <div className="sup-sc-group">
              <h3 className="sup-sc-group-title">Talent &amp; delivery</h3>
              <div className="sup-sc-group-grid">
                <ScoreMetric label="Submittals" value={`${sc.submittals.toFixed(1)} / req`} kind={subKind} help="candidates per posting" />
                <ScoreMetric label="Offer accept" value={`${sc.offerAccept}%`} kind={offKind} bar={sc.offerAccept} help="of offers accepted" />
                <ScoreMetric label="Redeploy" value={`${sc.redeploy}%`} kind={reKind} bar={sc.redeploy} help="workers returning for 2nd+ shift" />
                <ScoreMetric label="Avg tenure" value={`${sc.tenure} wk`} kind={tnKind} help="active workers with us" />
                <ScoreMetric label="Avg bill rate" value={`$${sc.rateAvg.toFixed(2)}/h`} kind="" help={`Blended markup ${sc.rateMarkup}%`} />
                <ScoreMetric label="Active workers" value={String(s.workers || 0)} kind="" help={`Across ${s.locations || 0} location${s.locations === 1 ? "" : "s"}`} />
              </div>
            </div>

            <div className="sup-sc-group">
              <h3 className="sup-sc-group-title">Risk &amp; compliance</h3>
              <div className="sup-sc-group-grid">
                <ScoreMetric label="Compliance" value={`${sc.complianceRate}%`} kind={cmpKind} bar={sc.complianceRate} help="workers with all creds current" />
                <ScoreMetric label="Cred lapses" value={String(sc.credLapses)} kind={lapKind} help="missed or expired, 90d" />
                <ScoreMetric label="Escalations" value={String(sc.escalations)} kind={escKind} help="tier escalations / re-broadcasts" />
                <ScoreMetric label="Disputes" value={String(sc.disputes)} kind={dispKind} help="timesheet + invoice, 90d" />
              </div>
            </div>
          </div>
        </React.Fragment>
      )}
    </section>
  );
}

function SupplierDetailsPage({ supplierId, onBack, onEditContract }) {
  const s = SUPPLIERS.find((x) => x.id === supplierId) || SUPPLIERS[0];
  const statusHue = SUP_STATUS_HUES[s.status] || "default";
  const editEntity = useEditEntity();
  const [contractTab, setContractTab] = useStateSup("current");
  const [contract, setContract] = useStateSup(() => getSupplierContract(s.id));
  // v0.82 — Supplier funding section is gated on the program being
  // supplier-funded. useProgramFunding re-renders the moment an admin
  // flips the model in Settings → Configuration → Program funding.
  const programFunding = window.useProgramFunding
    ? window.useProgramFunding()
    : (window.getProgramFunding ? window.getProgramFunding() : null);
  const fundingOn = !!(programFunding && programFunding.supplierFunding);
  const [fundingTick, setFundingTick] = useStateSup(0);
  // SOW flag — when on, surface this supplier's SOWs as an additive
  // accordion. Strictly additive: the existing accordions are untouched.
  const sowOn = window.useFeatureFlag ? window.useFeatureFlag("sow") : false;
  const supplierSows = useMemoSup(() => {
    if (!sowOn || !window.getSOWs) return [];
    return window.getSOWs().filter((x) => x.supplier === s.id);
  }, [sowOn, s.id]);

  const openEdit = () => editEntity.open({
    ...supplierEditSchema(s),
    onSave: () => showToast(`${s.name} updated`, { kind: "success" }),
  });

  // Stat row values — derived to feel different per supplier.
  const stats = useMemoSup(() => {
    const seed = s.id.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
    return {
      talent:  364 + (seed % 200),
      clients: 18 + (seed % 18),
      shifts:  1400 + (seed * 11) % 1200,
    };
  }, [s.id]);

  return (
    <React.Fragment>
      <ReqOmnibar
        title={s.name}
        subtitle="Suppliers"
        status={<span className={`req-pill req-pill--${statusHue}`}>{s.status}</span>}
        onBack={onBack}
        actions={(
          <React.Fragment>
            <button
              type="button"
              className="iconbtn"
              aria-label="Reload"
              title="Reload"
              onClick={() => showToast("Profile refreshed")}
            >
              <Icon name="Refresh" size={20} />
            </button>
            <button
              type="button"
              className="btn btn--md btn--secondary"
              onClick={() => onEditContract && onEditContract(s.id)}
            >
              <Icon name="Edit" size={16} />Edit
            </button>
            <button
              type="button"
              className="iconbtn"
              aria-label="More"
              onClick={(e) => openMenu(e.currentTarget, [
                { icon: "Briefcase", label: "New requisition", onClick: () => showToast(`Starting requisition for ${s.name}`) },
                { icon: "Pay",       label: "View invoices",    onClick: () => showToast(`Showing invoices for ${s.name}`) },
                { icon: "Copy",      label: "Copy supplier ID", onClick: () => copyToClipboard(s.supplierId, "Supplier ID copied") },
                { divider: true },
                s.status === "Active"
                  ? { icon: "Cancel", label: "Terminate supplier", danger: true,
                      onClick: () => openConfirm({
                        title: `Terminate ${s.name}?`,
                        body: `New requisitions will not include ${s.name}. Existing work assignments continue until completion.`,
                        primaryLabel: "Terminate",
                        onConfirm: () => { showToast(`${s.name} terminated`, { kind: "success" }); onBack && onBack(); },
                      }) }
                  : { icon: "AddCircle", label: "Activate supplier", onClick: () => showToast(`${s.name} activated`, { kind: "success" }) },
              ])}
            >
              <Icon name="MoreVert" size={20} />
            </button>
          </React.Fragment>
        )}
      />

      <div className="req-wf" style={{ maxWidth: 1200 }}>
        {/* ---- Hero card ---- */}
        <section className="sup-hero">
          <SupplierAvatar s={s} size={140} grey />
          <div className="sup-hero-info">
            <h1 className="sup-hero-name">{s.name}</h1>
            <ul className="sup-hero-meta">
              <li><span>{s.address}</span></li>
              <li>
                <span>GUID: <span className="tabular">{s.supplierId}</span></span>
                {s.supplierId !== "—" && (
                  <button
                    type="button"
                    className="sup-copy-btn"
                    aria-label="Copy GUID"
                    onClick={() => copyToClipboard(s.supplierId, "GUID copied")}
                  >
                    <Icon name="Copy" size={14} />
                  </button>
                )}
              </li>
              <li>
                <span className="sc-activation">Activation Date: <b>{contract.currentDate}</b></span>
              </li>
            </ul>
          </div>
        </section>

        {/* ---- Performance scorecard (removed for now) ---- */}

        {/* ---- Identity stats (3-up) ---- */}
        <div className="sup-quick-grid">
          <SupQuickCard
            label="Talent"
            value={stats.talent.toLocaleString()}
            sublabel="Active across all sites"
          />
          <SupQuickCard
            label="Clients"
            value={stats.clients}
            sublabel="Currently staffed"
          />
          <SupQuickCard
            label="Shifts Filled"
            value={stats.shifts.toLocaleString()}
            sublabel="YTD through Apr 2026"
          />
        </div>

        {/* ---- Agency / contract sections ---- */}
        <SupAccordionCard icon="Information" title="Details">
          <SupDetailsBody s={s} />
        </SupAccordionCard>

        <SupAccordionCard
          icon="Notes"
          title="Contract Terms"
          action={(
            <button
              type="button"
              className="btn btn--md btn--secondary"
              onClick={() => openContractTermsEditor({
                data: contract,
                onSave: (next) => setContract({ ...contract, contractTerms: { ...contract.contractTerms, ...next } }),
              })}
            >
              <Icon name="Edit" size={16} />Edit
            </button>
          )}
        >
          <ContractTermsBody data={contract} />
        </SupAccordionCard>

        {/* v0.82 — Supplier funding (per-agency negotiated MSP fee).
            Only renders when the program is supplier-funded. */}
        {fundingOn && window.SupplierFundingBody && (
          <SupAccordionCard
            icon="Wallet"
            title="Supplier funding"
            action={(programFunding && programFunding.allowOverrides) ? (
              <button
                type="button"
                className="btn btn--md btn--secondary"
                onClick={() => window.openSupplierFundingEditor({
                  supplierId: s.id,
                  onSave: () => setFundingTick((t) => t + 1),
                })}
              >
                <Icon name="Edit" size={16} />Edit
              </button>
            ) : null}
          >
            <window.SupplierFundingBody key={fundingTick} supplierId={s.id} />
          </SupAccordionCard>
        )}

        <SupAccordionCard
          icon="Stack"
          title="District Markups"
          action={(
            <button
              type="button"
              className="btn btn--md btn--secondary"
              onClick={() => openMarkupEditor({
                districts: districtsById(contract.operatingDistricts || []),
                defaults: contract.districtMarkups,
                onSave: (next) => setContract({ ...contract, districtMarkups: { ...contract.districtMarkups, ...next } }),
              })}
            >
              <Icon name="Edit" size={16} />Edit
            </button>
          )}
        >
          <DistrictMarkupsCard
            data={contract}
            onChange={setContract}
            bare
          />
        </SupAccordionCard>

        {/* v1.42 — Base pay inherited from the buyer's tenant rate card,
            overridable per position × location. Sits ahead of the
            existing markup-driven Rate Cards card; base pay flows from
            here into that card's bill-rate calc. */}
        {window.AgencyBasePayCard && (
          <SupAccordionCard icon="MoneyBag" title="Base pay rate card">
            <window.AgencyBasePayCard supplierId={s.id} supplierName={s.name} />
          </SupAccordionCard>
        )}

        <SupAccordionCard
          icon="Pay"
          title="Rate Cards"
          action={(
            <button
              type="button"
              className="btn btn--md btn--secondary"
              onClick={() => openRateCardEditor({
                positions: (contract.positions || []).slice(0, 10),
                onSave: (patch) => setContract({
                  ...contract,
                  positions: contract.positions.map((p) => patch[p.id] ? { ...p, ...patch[p.id] } : p),
                }),
              })}
            >
              <Icon name="Edit" size={16} />Edit
            </button>
          )}
        >
          <RateCardsCard
            data={contract}
            onChange={setContract}
            bare
          />
        </SupAccordionCard>

        <SupAccordionCard icon="Settings" title="Cancellation Policy">
          <CancellationPolicyBody data={contract} />
        </SupAccordionCard>

        <SupAccordionCard icon="Person" title="Users" count={(contract.users || []).length}>
          <UsersBody data={contract} />
        </SupAccordionCard>

        <SupAccordionCard icon="Location" title="Sites" count={s.locations || 0}>
          <SupLocationsBody s={s} />
        </SupAccordionCard>

        <SupAccordionCard icon="Briefcase" title="Requisitions" count={s.requisitions || 0}>
          <SupRequisitionsBody s={s} />
        </SupAccordionCard>

        {sowOn && (
          <SupAccordionCard icon="Notes" title="SOWs" count={supplierSows.length} defaultOpen={supplierSows.length > 0}>
            <SupSowsBody sows={supplierSows} />
          </SupAccordionCard>
        )}

        <SupAccordionCard icon="Pay" title="Invoices">
          <SupInvoicesBody s={s} />
        </SupAccordionCard>

        <SupAccordionCard icon="TimeUndo" title="Logs">
          <SupLogsBody s={s} />
        </SupAccordionCard>
      </div>
      {editEntity.panel}
    </React.Fragment>
  );
}

Object.assign(window, { SuppliersPage, SupplierDetailsPage, SUPPLIERS });
