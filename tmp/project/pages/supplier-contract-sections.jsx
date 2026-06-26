// =====================================================================
// Flex Work — Supplier Contract: detail-page sections + edit panels
// =====================================================================

const { useState: useStateScD, useMemo: useMemoScD, useEffect: useEffectScD } = React;

// ---------- Edit-panel openers (event-bus based) ----------------------
function openMarkupEditor(cfg)        { Interactions.emit("scMarkupEditor",   cfg); }
function openRateCardEditor(cfg)      { Interactions.emit("scRateCardEditor", cfg); }
function openAgencyDetailsEditor(cfg) { Interactions.emit("scAgencyEditor",   cfg); }

// =====================================================================
// District Markups card — used both in details page and Step 4 Review.
// =====================================================================
function DistrictMarkupsCard({ data, readOnly = false, onEdit, onChange, title = "District markups", bare = false }) {
  const [query, setQuery] = useStateScD("");
  const [stateFilter, setStateFilter] = useStateScD([]);
  const [page, setPage] = useStateScD(1);
  const pageSize = 10;

  // Show only operating districts. Falls back to all when not set
  // (which only happens during the invite Review step).
  const visible = useMemoScD(() => {
    const opIds = data.operatingDistricts || [];
    const all = opIds.length === 0 ? DISTRICTS_RAW : DISTRICTS_RAW.filter((d) => opIds.includes(d.id));
    return all
      .filter((d) => stateFilter.length === 0 || stateFilter.includes(d.state))
      .filter((d) => {
        if (!query.trim()) return true;
        const q = query.trim().toLowerCase();
        return d.name.toLowerCase().includes(q) || d.state.toLowerCase().includes(q);
      });
  }, [data.operatingDistricts, stateFilter, query]);
  const totalPages = Math.max(1, Math.ceil(visible.length / pageSize));
  const rows = visible.slice((page - 1) * pageSize, page * pageSize);

  const allStates = useMemoScD(() => Array.from(new Set(DISTRICTS_RAW.map((d) => d.state))).sort(), []);
  const openStateFilter = (e) => openMenu(e.currentTarget, allStates.map((s) => ({
    label: s,
    checked: stateFilter.includes(s),
    onClick: () => setStateFilter((prev) => prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]),
  })));

  const body = (
    <React.Fragment>
      <div className="sc-tablebar">
        <div className="inv-search sc-search">
          <span className="inv-search-icon" aria-hidden="true">
            <Icon name="Search" size={20} />
          </span>
          <input
            type="search"
            className="inv-search-input"
            placeholder="Search districts"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setPage(1); }}
            aria-label="Search districts"
          />
        </div>
        <FilterChip label="State" active={stateFilter.length > 0} count={stateFilter.length} onClick={openStateFilter} />
        {stateFilter.length > 0 && (
          <button type="button" className="req-clear" onClick={() => setStateFilter([])}>Clear</button>
        )}
      </div>

      <div className="sc-table" role="table" aria-label={title}>
        <div className="sc-trow sc-trow--head" role="row">
          <div className="sc-tcell sc-tcell--district" role="columnheader">District</div>
          <div className="sc-tcell sc-tcell--state" role="columnheader">State</div>
          <div className="sc-tcell sc-tcell--num" role="columnheader">Markup</div>
        </div>
        {rows.length === 0 ? (
          <div className="sc-empty-row">No districts match your filters.</div>
        ) : rows.map((d) => (
          <div className="sc-trow" key={d.id} role="row">
            <div className="sc-tcell" role="cell">{d.name}</div>
            <div className="sc-tcell sc-tcell--low" role="cell">{d.state}</div>
            <div className="sc-tcell sc-tcell--num tabular" role="cell">{fmtMarkup(data.districtMarkups?.[d.id])}</div>
          </div>
        ))}
      </div>

      <ScTablePagerDetails page={page} total={visible.length} pageSize={pageSize} totalPages={totalPages} onChange={setPage} />
    </React.Fragment>
  );

  if (bare) return body;

  return (
    <section className="sc-card sc-card--details">
      <header className="sc-card-head sc-card-head--accordion">
        <span className="sc-card-icon" aria-hidden="true">
          <Icon name="Tag" size={20} />
        </span>
        <h2 className="sc-card-title">{title}</h2>
        <span className="sc-card-spacer" />
        {!readOnly && (
          <button type="button" className="sc-edit-btn" onClick={() => {
            openMarkupEditor({
              districts: districtsById(data.operatingDistricts || []),
              defaults: data.districtMarkups,
              onSave: (next) => onChange && onChange({ ...data, districtMarkups: { ...data.districtMarkups, ...next } }),
            });
          }}>
            <Icon name="Edit" size={14} />Edit
          </button>
        )}
      </header>

      <div className="sc-card-body">{body}</div>
    </section>
  );
}

// =====================================================================
// Rate Cards card
// =====================================================================
function RateCardsCard({ data, readOnly = false, onChange, title = "Rate cards", bare = false }) {
  // Tabs scope the rate card to a single operating district (plus the
  // "All districts" rollup) — used to drive the district markup in the
  // bill-rate calc. Replaces the old position-category tabs which were
  // a Step-2 wizard primitive that didn't belong on the supplier
  // details page.
  const districts = useMemoScD(
    () => districtsById(data.operatingDistricts || []),
    [data.operatingDistricts]
  );
  const tabs = useMemoScD(
    () => [{ id: "__all", label: "All districts" }, ...districts.map((d) => ({ id: d.id, label: `${d.code} – ${d.name}` }))],
    [districts]
  );
  const [tab, setTab] = useStateScD("__all");
  const [parity, setParity] = useStateScD("Pre-parity");
  const [page, setPage] = useStateScD(1);
  const [popRow, setPopRow] = useStateScD(null);        // bill-rate breakdown popover
  const [historyOpen, setHistoryOpen] = useStateScD(false);
  const [historyMode, setHistoryMode] = useStateScD("flat"); // v0.79 · M3 — "flat" | "diff"
  const pageSize = 10;

  // Role-aware: when the user is browsing as an agency, hide internal
  // markup columns and respect the pay-rate visibility policy stored
  // on the contract. The flexViewAsRole signal lives on window and is
  // toggled from chrome.jsx — same one Requisitions/Workforce read.
  const viewAsAgency = (typeof window !== "undefined") && window.flexViewAsRole === "agency";
  const paymasked = viewAsAgency && data.payRateVisibility === "masked";

  // No row-level filtering by district — positions exist for every
  // district. The tab only changes which district markup feeds the
  // bill-rate calc below.
  const filtered = data.positions;
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const rows = filtered.slice((page - 1) * pageSize, page * pageSize);

  const avgDistrictMarkup = useMemoScD(() => {
    const opIds = data.operatingDistricts || [];
    if (opIds.length === 0) return 25;
    const vals = opIds.map((id) => data.districtMarkups?.[id] ?? 20).filter((n) => n != null);
    if (vals.length === 0) return 25;
    return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
  }, [data.operatingDistricts, data.districtMarkups]);
  // When a specific district tab is active, use its markup; otherwise
  // fall back to the average across all operating districts (matching
  // the all-districts rollup).
  const activeDistrictMarkup = tab === "__all"
    ? avgDistrictMarkup
    : (data.districtMarkups?.[tab] ?? avgDistrictMarkup);

  // v0.79 · F2 — Bill-rate calc routes through the staged reducer
  // (window.runRateStages). The legacy two-line expression stays as a
  // fallback for contracts that haven't been migrated to the typed
  // pricing-config rule shape yet — see rowAdditiveLoadPct in
  // pages/supplier-contract.jsx for that path.
  const billRateCtx = (p) => ({
    date: new Date().toISOString().slice(0, 10),
    shift: "regular",
    country: (p && p.country) || data.country || "US",
    currency: (p && p.currency) || data.defaultCurrency || "USD",
    districtMarkup: activeDistrictMarkup,
    workerTenureDays: null,
  });
  const billRateResult = (p) => {
    if (typeof window === "undefined" || !window.runRateStages) {
      const base = (p.payRatePref || p.payRate) || 0;
      const load = (window.rowAdditiveLoadPct ? window.rowAdditiveLoadPct(p) : 0);
      const loaded = base * (1 + load / 100);
      const pos = p.positionMarkup || 0;
      const effective = pos || activeDistrictMarkup;
      return { billRate: Math.round(loaded * (1 + effective / 100)), breakdown: [] };
    }
    return window.runRateStages(p, data, billRateCtx(p));
  };
  const billRate = (p) => Math.round(billRateResult(p).billRate);
  const billRateAtBand = (p, which) => {
    // "min" / "max" variant for the popover. Same staged reducer with
    // a different base; reusing the engine instead of duplicating the
    // legacy expression so band rates track every staged layer.
    const base = (which === "min" ? p.payRateMin : p.payRateMax) || p.payRate || 0;
    const stub = { ...p, payRate: base, payRatePref: base };
    return Math.round(billRateResult(stub).billRate);
  };
  // v0.79 · M1 — per-variant bill rate for the popover variant table.
  const billRateForShift = (p, shift) => {
    if (typeof window === "undefined" || !window.runRateStages) return billRate(p);
    return Math.round(window.runRateStages(p, data, { ...billRateCtx(p), shift }).billRate);
  };
  // v0.79 · G1 — statutory-floor check. Read off the row's currency /
  // contract country and surface a chip when the row's preferred pay
  // sits near or below the floor.
  const payFloorFor = (p) => {
    if (typeof window === "undefined" || !window.checkPayFloor) return { status: "ok" };
    return window.checkPayFloor(p.payRatePref || p.payRate, (p.country || data.country), (p.currency || data.defaultCurrency));
  };
  const symFor = (p) => (typeof window !== "undefined" && window.rowCurrencySymbol)
    ? window.rowCurrencySymbol(p, data)
    : "$";

  const editPosition = (id) => {
    const pos = data.positions.find((p) => p.id === id);
    if (!pos) return;
    openRateCardEditor({
      positions: [pos],
      onSave: (patch) => {
        onChange && onChange({
          ...data,
          positions: data.positions.map((p) => p.id === id ? { ...p, ...patch[id] } : p),
        });
      },
    });
  };

  const body = (
    <React.Fragment>
      <div className="evr-tabs evr-tabs--scroll" role="tablist">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={t.id === tab}
            className={`evr-tab ${t.id === tab ? "is-active" : ""}`}
            onClick={() => { setTab(t.id); setPage(1); }}
          >{t.label}</button>
        ))}
      </div>

      <div className="sc-parity" role="tablist" aria-label="Parity">
        {["Pre-parity", "Post-parity"].map((p) => (
          <button
            key={p}
            type="button"
            role="tab"
            aria-selected={p === parity}
            className={`sc-parity-btn ${p === parity ? "sc-parity-btn--active" : ""}`}
            onClick={() => setParity(p)}
          >{p}</button>
        ))}
      </div>

      <div className="sc-table sc-table--rate" role="table" aria-label={title}>
        <div className="sc-trow sc-trow--head sc-trow--rate sc-trow--rate-ro" role="row">
          <div className="sc-tcell" role="columnheader">Position</div>
          <div className="sc-tcell" role="columnheader">Status</div>
          <div className="sc-tcell sc-tcell--num" role="columnheader">District markup</div>
          <div className="sc-tcell sc-tcell--num" role="columnheader">Position markup</div>
          <div className="sc-tcell sc-tcell--num" role="columnheader">Tier markup</div>
          <div className="sc-tcell sc-tcell--num" role="columnheader">Pay rate</div>
          {/* v0.79 · G4 — explicit margin column. Hidden in masked mode. */}
          {viewAsAgency && !paymasked && (
            <div className="sc-tcell sc-tcell--num" role="columnheader" title="Loaded bill rate minus pay-rate band — supplier take-home estimate">Margin/hr</div>
          )}
          {!readOnly && <div className="sc-tcell sc-tcell--actions" role="columnheader" aria-label="Actions"></div>}
        </div>
        {rows.map((p) => {
          const cls = (typeof window !== "undefined" && window.rowClassification) ? window.rowClassification(p) : null;
          const sym = symFor(p);
          const eff = p.effectiveTo || "";
          // Effective-to within 60 days flags the row as up-for-renewal.
          const effWarn = (() => {
            if (!eff) return false;
            const t = new Date(eff).getTime();
            if (Number.isNaN(t)) return false;
            const days = (t - Date.now()) / 86400000;
            return days > 0 && days < 60;
          })();
          return (
          <div className={`sc-trow sc-trow--rate ${readOnly ? "sc-trow--rate-ro" : ""}`} key={p.id} role="row">
            <div className="sc-tcell" role="cell">
              <div>{p.name}</div>
              <div className="sc-rate-meta">
                {cls && <span className="sc-cls-chip" data-cls={cls.id} title={cls.hint}>{cls.label}</span>}
                {eff && (
                  <span className="sc-eff-chip" data-warn={effWarn ? "true" : "false"} title={`Effective through ${eff}`}>
                    {effWarn && <Icon name="Alert" size={10} />}
                    eff &lsaquo;{eff}
                  </span>
                )}
                {(p.skillIds || []).length > 0 && (
                  <span className="sc-eff-chip" title="Skill premiums">
                    <Icon name="Tag" size={10} />
                    +{(p.skillIds || []).length} skill
                  </span>
                )}
                {/* v0.79 · G1 — statutory-floor watchdog chip. */}
                {(() => {
                  const fc = payFloorFor(p);
                  if (fc.status === "ok") return null;
                  const tone = fc.status === "block" ? "err" : "warn";
                  return (
                    <span className={`sc-eff-chip sc-eff-chip--floor sc-eff-chip--${tone}`}
                          title={`Min wage ${fc.currency} ${fc.floor}/hr · ${fc.authority}`}>
                      <Icon name="Alert" size={10} />
                      {fc.status === "block" ? "Below floor" : "Near floor"}
                    </span>
                  );
                })()}
              </div>
            </div>
            <div className="sc-tcell" role="cell">
              <span className={`sc-pill sc-pill--${p.enabled ? "ok" : "off"}`}>
                <Icon name={p.enabled ? "Check" : "Cancel"} size={12} />
                {p.enabled ? "Enabled" : "Disabled"}
              </span>
            </div>
            <div className={`sc-tcell sc-tcell--num tabular sc-tcell--internal`} role="cell">{fmtMarkup(activeDistrictMarkup)}</div>
            <div className={`sc-tcell sc-tcell--num tabular sc-tcell--internal`} role="cell">{fmtMarkup(p.positionMarkup)}</div>
            <div className="sc-tcell sc-tcell--num tabular" role="cell">
              {p.tierEnabled ? TIERS.map((t) => fmtMarkup(t.markup)).join(" / ") : "—"}
            </div>
            <div className="sc-tcell sc-tcell--num" role="cell">
              {paymasked ? (
                <span className="sc-masked-cell">
                  {/* v0.79 · G2 — why-is-this-masked explainer. Opens
                      a small tooltip pulled from the contract's policy
                      rationale field; surfaces the contracted bill
                      rate so the agency isn't fully blind. */}
                  <span title="Pay rate hidden by program policy">
                    <Icon name="Eye" size={12} />•••
                  </span>
                  <button
                    type="button"
                    className="sc-masked-why"
                    aria-label="Why is this masked?"
                    onMouseEnter={() => setPopRow(`why-${p.id}`)}
                    onMouseLeave={() => setPopRow(null)}
                    onFocus={() => setPopRow(`why-${p.id}`)}
                    onBlur={() => setPopRow(null)}
                  >
                    <Icon name="Information" size={12} />
                  </button>
                  {popRow === `why-${p.id}` && (
                    <div className="sc-bill-pop sc-bill-pop--why" role="tooltip">
                      <h5>Why is this masked?</h5>
                      <p>Your buyer has set rate visibility to <b>band-only</b> on this contract.</p>
                      <div className="sc-bill-pop-row"><span>Contracted bill rate</span><b>{sym}{billRate(p)}/hr</b></div>
                      <div className="sc-bill-pop-row"><span>Visibility policy</span><b>{data.payRateVisibility || "masked"}</b></div>
                      <p className="sc-bill-pop-foot">Margin lines appear on each invoice. Speak with your buyer's program owner to request visible-pay access.</p>
                    </div>
                  )}
                </span>
              ) : (
                <div className="sc-bill-cell">
                  <div className="sc-pay-cell">
                    <span className="tabular">{sym}{billRate(p)}</span>
                    {(p.payRateMin && p.payRateMax) && (
                      <span className="sc-pay-band">{sym}{p.payRateMin}–{sym}{p.payRateMax} pay</span>
                    )}
                  </div>
                  <button
                    type="button"
                    aria-label={`Bill rate breakdown for ${p.name}`}
                    onMouseEnter={() => setPopRow(p.id)}
                    onMouseLeave={() => setPopRow(null)}
                    onFocus={() => setPopRow(p.id)}
                    onBlur={() => setPopRow(null)}
                  >
                    <Icon name="Info" size={12} />
                  </button>
                  {popRow === p.id && (
                    <div className="sc-bill-pop sc-bill-pop--staged" role="tooltip">
                      <h5>Bill-rate breakdown</h5>
                      {/* v0.79 · M1 — staged build-up. Every layer the
                          admin authored on the pricing config shows
                          here. Reads `breakdown` from runRateStages. */}
                      {(() => {
                        const r = billRateResult(p);
                        const sym2 = sym;
                        const fmt = (n) => `${sym2}${(Math.round(n * 100) / 100).toFixed(2)}`;
                        const stageLabel = {
                          base: "Base pay",
                          premium: "Premium",
                          contribution: "Contribution",
                          skill: "Skill",
                          tenure: "Tenure",
                          markup: "Markup",
                          tax: "Tax",
                        };
                        return (
                          <React.Fragment>
                            {r.breakdown
                              .filter((b) => !viewAsAgency || b.visibility !== "internal")
                              .map((b, i) => (
                              <div key={i} className={`sc-bill-pop-row sc-bill-pop-row--${b.stage}`}>
                                <span>
                                  <span className="sc-bill-pop-stage">{stageLabel[b.stage] || b.stage}</span>
                                  {b.label}
                                  {b.legacy && <span className="sc-bill-pop-tag" title="Legacy fallback — not from pricing config">legacy</span>}
                                </span>
                                <b className="tabular">
                                  {b.kind === "amount"
                                    ? fmt(b.value)
                                    : (b.delta >= 0 ? "+" : "") + fmt(b.delta) + ` · ${b.value}%`}
                                </b>
                              </div>
                            ))}
                            <div className="sc-bill-pop-out sc-bill-pop-row">
                              <span>{viewAsAgency ? "Bill rate (excl. buyer margin)" : "Bill rate"}</span>
                              <b className="tabular">{fmt(r.billRate)}/hr</b>
                            </div>
                            {/* v0.81 · #12 — threshold breach warning. The
                                engine returns thresholds:{breached,by}; the
                                popover turns warning-yellow on breach so the
                                manager sees the ceiling/margin problem in
                                place before committing. */}
                            {r.thresholds && r.thresholds.breached && (
                              <div className="sc-bill-pop-row sc-bill-pop-threshold" role="status">
                                <span>
                                  <Icon name="Alert" size={13} />
                                  {r.thresholds.by === "ceiling"
                                    ? `Over ceiling by ${fmt(r.thresholds.overBy)}/hr`
                                    : `Margin ${r.thresholds.marginPct}% below floor ${r.thresholds.marginFloor}%`}
                                </span>
                                <b className="tabular">
                                  {r.thresholds.by === "ceiling" ? `cap ${fmt(r.thresholds.ceilingBill)}` : `min ${r.thresholds.marginFloor}%`}
                                </b>
                              </div>
                            )}
                            {/* v0.79 · F3 — shift / holiday variants */}
                            <div className="sc-bill-pop-variants">
                              <div className="sc-bill-pop-variants-h">Variant rates</div>
                              {["regular", "night", "weekend", "holiday"].map((shift) => (
                                <div key={shift} className="sc-bill-pop-variant">
                                  <span>{shift[0].toUpperCase() + shift.slice(1)}</span>
                                  <b className="tabular">{fmt(billRateForShift(p, shift))}/hr</b>
                                </div>
                              ))}
                            </div>
                            <div className="sc-bill-pop-out sc-bill-pop-row">
                              <span>Bill rate band (min – max)</span>
                              <b className="tabular">{sym2}{billRateAtBand(p, "min")} – {sym2}{billRateAtBand(p, "max")}</b>
                            </div>
                          </React.Fragment>
                        );
                      })()}
                    </div>
                  )}
                </div>
              )}
            </div>
            {/* v0.79 · G4 — Margin column. Loaded bill − pay min. */}
            {viewAsAgency && !paymasked && (
              <div className="sc-tcell sc-tcell--num tabular" role="cell">
                {sym}{Math.max(0, billRate(p) - (p.payRatePref || p.payRate || 0))}
              </div>
            )}
            {!readOnly && (
              <div className="sc-tcell sc-tcell--actions" role="cell">
                <button type="button" className="iconbtn" aria-label={`Edit ${p.name}`} onClick={() => editPosition(p.id)}>
                  <Icon name="Edit" size={16} />
                </button>
              </div>
            )}
          </div>
          );
        })}
      </div>

      <ScTablePagerDetails page={page} total={filtered.length} pageSize={pageSize} totalPages={totalPages} onChange={setPage} />

      {/* ----- History drawer -------------------------------------- */}
      {(() => {
        // Aggregate the per-row history arrays into a flat ledger,
        // newest first, capped at the most recent 8 entries shown.
        const ledger = (data.positions || [])
          .flatMap((p) => (p.history || []).map((h) => ({ ...h, position: p.name, positionId: p.id })))
          .sort((a, b) => (b.at || "").localeCompare(a.at || ""));
        if (ledger.length === 0) return null;
        // v0.79 · M3 — row-diff view. The drawer can switch between
        // the flat ledger and a per-row "what changed" diff. Uses the
        // same primitive the inbox renders for `rate_change` approvals
        // — lifted up here so the supplier-side history reads the same.
        const positionsById = Object.fromEntries((data.positions || []).map((p) => [p.id, p]));
        return (
          <div className="sc-history">
            <button
              type="button"
              className="sc-history-h"
              aria-expanded={historyOpen}
              onClick={() => setHistoryOpen(!historyOpen)}
            >
              <span>
                <Icon name="Clock" size={14} />{" "}
                <b>Change history</b> &middot; {ledger.length} {ledger.length === 1 ? "entry" : "entries"}
              </span>
              <Icon name={historyOpen ? "ChevronUp" : "ChevronDown"} size={16} />
            </button>
            {historyOpen && (
              <div className="sc-history-body">
                <div className="sc-history-tabs" role="tablist">
                  {["flat", "diff"].map((m) => (
                    <button
                      key={m}
                      type="button"
                      role="tab"
                      aria-selected={historyMode === m}
                      className={`sc-history-tab ${historyMode === m ? "is-active" : ""}`}
                      onClick={() => setHistoryMode(m)}
                    >{m === "flat" ? "Ledger" : "Per-row diff"}</button>
                  ))}
                </div>
                {historyMode === "flat" && ledger.slice(0, 8).map((h, i) => (
                  <div className="sc-history-row" key={i}>
                    <time dateTime={h.at}>{h.at}</time>
                    <div>
                      <b>{h.position}</b> — {h.change}
                      <div style={{ color: "var(--evr-content-primary-lowemp)", fontSize: 11 }}>
                        {h.by}{h.reason ? ` · ${h.reason}` : ""}
                      </div>
                    </div>
                    <span className="sc-history-reason">{h.reason || ""}</span>
                  </div>
                ))}
                {historyMode === "diff" && (() => {
                  // Group by position; show the most recent 2 entries
                  // side-by-side per row so the changed field reads at
                  // a glance. Synthesizes a "before" snapshot from the
                  // change-text when no structured diff is present.
                  const byPos = {};
                  ledger.forEach((h) => {
                    (byPos[h.positionId] = byPos[h.positionId] || []).push(h);
                  });
                  return Object.keys(byPos).slice(0, 5).map((pid) => {
                    const hs = byPos[pid].slice(0, 2);
                    const p = positionsById[pid] || { name: pid };
                    const m = (s) => /(\d+(?:\.\d+)?)\s*(?:→|->)\s*(\d+(?:\.\d+)?)/.exec(s || "");
                    return (
                      <div className="sc-history-diff" key={pid}>
                        <div className="sc-history-diff-h">
                          <b>{p.name}</b>
                          <span>{hs.length} change{hs.length === 1 ? "" : "s"}</span>
                        </div>
                        {hs.map((h, i) => {
                          const mm = m(h.change);
                          return (
                            <div className="sc-history-diff-row" key={i}>
                              <time dateTime={h.at}>{h.at}</time>
                              {mm ? (
                                <div className="sc-history-diff-vals">
                                  <span className="sc-history-diff-before tabular">{mm[1]}</span>
                                  <Icon name="ArrowRight" size={12} />
                                  <span className="sc-history-diff-after tabular">{mm[2]}</span>
                                </div>
                              ) : (
                                <span className="sc-history-diff-vals">{h.change}</span>
                              )}
                              <span className="sc-history-diff-meta">
                                {h.by}{h.reason ? ` · ${h.reason}` : ""}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    );
                  });
                })()}
              </div>
            )}
          </div>
        );
      })()}
    </React.Fragment>
  );

  if (bare) return body;

  return (
    <section className="sc-card sc-card--details">
      <header className="sc-card-head sc-card-head--accordion">
        <span className="sc-card-icon" aria-hidden="true">
          <Icon name="Pay" size={20} />
        </span>
        <h2 className="sc-card-title">{title}</h2>
        <span className="sc-card-spacer sc-card-spacer-flex" />
        <div className="sc-card-actions">
          {!readOnly && !viewAsAgency && (
            <button type="button" className="sc-edit-btn" onClick={() => {
              // Request change: same editor, but the apply path routes
              // through the rate_change Inbox kind. For the prototype
              // we surface a toast that names the next approver; the
              // patch still applies optimistically so reviewers can
              // see the new values reflected.
              openRateCardEditor({
                positions: rows,
                onSave: (patch) => {
                  onChange && onChange({
                    ...data,
                    positions: data.positions.map((p) => patch[p.id] ? { ...p, ...patch[p.id] } : p),
                  });
                  showToast(`Rate change submitted · queued for approval`, { kind: "success" });
                },
              });
            }}>
              <Icon name="DocumentAdd" size={14} />Request change
            </button>
          )}
          {!readOnly && viewAsAgency && (
            <button type="button" className="sc-edit-btn" onClick={() => {
              openRateCardEditor({
                positions: rows,
                onSave: (patch) => {
                  onChange && onChange({
                    ...data,
                    positions: data.positions.map((p) => patch[p.id] ? { ...p, ...patch[p.id] } : p),
                  });
                  showToast("Counter-rate submitted to buyer", { kind: "success" });
                },
              });
            }}>
              <Icon name="Edit" size={14} />Counter rate
            </button>
          )}
          {!readOnly && (
            <button type="button" className="sc-edit-btn" onClick={() => {
              openRateCardEditor({
                positions: rows,
                onSave: (patch) => onChange && onChange({
                  ...data,
                  positions: data.positions.map((p) => patch[p.id] ? { ...p, ...patch[p.id] } : p),
                }),
              });
            }}>
              <Icon name="Edit" size={14} />Edit
            </button>
          )}
        </div>
      </header>

      <div className="sc-card-body">{body}</div>
    </section>
  );
}

// Lightweight pager (matches Figma "Showing 10 of N entries" style) ----
function ScTablePagerDetails({ page, total, pageSize, totalPages, onChange }) {
  if (total === 0) return null;
  const first = (page - 1) * pageSize + 1;
  const last = Math.min(total, page * pageSize);
  // Render 1..min(5, totalPages) numbered buttons + ellipsis when more.
  const pages = [];
  const showCount = Math.min(5, totalPages);
  for (let i = 1; i <= showCount; i++) pages.push(i);

  return (
    <div className="sc-pager sc-pager--detail">
      <span className="sc-pager-summary">Showing {first}-{last} of {total} entries</span>
      <div className="sc-pager-center">
        <button type="button" className="iconbtn" aria-label="Previous page" disabled={page <= 1} onClick={() => onChange(Math.max(1, page - 1))}>
          <Icon name="ChevronLeft" size={16} />
        </button>
        {pages.map((p) => (
          <button
            key={p}
            type="button"
            className={`sc-page-num ${p === page ? "sc-page-num--active" : ""}`}
            onClick={() => onChange(p)}
          >{p}</button>
        ))}
        {totalPages > 5 && <span className="sc-page-ellipsis">…</span>}
        <button type="button" className="iconbtn" aria-label="Next page" disabled={page >= totalPages} onClick={() => onChange(Math.min(totalPages, page + 1))}>
          <Icon name="ChevronRight" size={16} />
        </button>
      </div>
      <div className="sc-pager-right">
        <label className="sc-pager-label">Show</label>
        <span className="sc-pager-pill">{pageSize}</span>
        <label className="sc-pager-label">entries</label>
      </div>
    </div>
  );
}

// =====================================================================
// Side panels
// =====================================================================

function ScMarkupEditorPanel({ open, districts, defaults, onSave, onClose }) {
  const [values, setValues] = useStateScD({});
  const [picked, setPicked] = useStateScD([]);
  const [percent, setPercent] = useStateScD("");
  const [markupType, setMarkupType] = useStateScD("Percentage (%)");

  useEffectScD(() => {
    if (open) {
      setValues({});
      setPicked(districts.map((d) => d.id));
      setPercent("");
      setMarkupType("Percentage (%)");
    }
  }, [open, districts]);

  const apply = () => {
    const next = {};
    const v = percent === "" ? null : Math.max(0, Math.min(999, Number(percent) || 0));
    picked.forEach((id) => { next[id] = v; });
    onSave && onSave(next);
    showToast(`${picked.length} district${picked.length === 1 ? "" : "s"} updated`, { kind: "success" });
    onClose && onClose();
  };

  return (
    <SidePanel
      open={open}
      title={picked.length > 1 ? `Edit district markups (${picked.length})` : "Edit district markup"}
      onClose={onClose}
      footer={(
        <React.Fragment>
          <button type="button" className="btn btn--lg btn--tertiary" onClick={onClose}>Cancel</button>
          <button type="button" className="btn btn--lg btn--primary" onClick={apply}>Save</button>
        </React.Fragment>
      )}
    >
      <div className="sc-banner sc-banner--warn">
        <Icon name="Alert" size={16} />
        <span>Note: When multiple markups are enabled, the lowest level markup takes precedence.</span>
      </div>

      <h3 className="sp-section-title" style={{ marginTop: 16 }}>Districts</h3>
      <div className="sc-chips" role="list">
        {districts.map((d) => (
          <button
            key={d.id}
            type="button"
            role="listitem"
            className={`sc-chip ${picked.includes(d.id) ? "sc-chip--on" : ""}`}
            onClick={() => setPicked((prev) => prev.includes(d.id) ? prev.filter((x) => x !== d.id) : [...prev, d.id])}
          >
            {picked.includes(d.id) && <Icon name="Check" size={12} />}
            {d.code} – {d.name}
          </button>
        ))}
      </div>

      <hr className="sp-divider" />
      <h3 className="sp-section-title">Markup</h3>
      <div className="sp-grid-2">
        <Field label="Percentage (%)">
          <TextInput
            value={percent}
            onChange={setPercent}
            placeholder="25"
            type="number"
          />
        </Field>
        <Field label="Markup type">
          <Dropdown
            options={["Percentage (%)", "Fixed amount ($)"]}
            value={markupType}
            onChange={setMarkupType}
          />
        </Field>
      </div>
    </SidePanel>
  );
}

function ScMarkupEditorHost() {
  const [config, setConfig] = useStateScD(null);
  useEffectScD(() => Interactions.on("scMarkupEditor", setConfig), []);
  if (!config) return null;
  return (
    <ScMarkupEditorPanel
      open
      districts={config.districts}
      defaults={config.defaults}
      onSave={config.onSave}
      onClose={() => setConfig(null)}
    />
  );
}

// ----- Rate card editor -----------------------------------------------

function ScRateCardEditorPanel({ open, positions, onSave, onClose }) {
  const isBulk = positions.length > 1;
  const initial = positions[0] || {};
  // ---------------- core fields (single + bulk both) ----------------
  const [mode, setMode] = useStateScD("edit");          // "edit" | "adjust"
  const [enabled, setEnabled] = useStateScD(true);
  const [posEnabled, setPosEnabled] = useStateScD(false);
  const [posPercent, setPosPercent] = useStateScD("");
  const [tierEnabled, setTierEnabled] = useStateScD(false);
  const [tierPercents, setTierPercents] = useStateScD({
    solid: 5, outstanding: 10, epic: 15,
  });
  // ---------------- rate fields (new — range + currency) -------------
  const [payRate, setPayRate]       = useStateScD(initial.payRate || 22);
  const [payMin, setPayMin]         = useStateScD(initial.payRateMin || (initial.payRate ? Math.max(7, initial.payRate - 4) : 18));
  const [payPref, setPayPref]       = useStateScD(initial.payRatePref || initial.payRate || 22);
  const [payMax, setPayMax]         = useStateScD(initial.payRateMax || (initial.payRate ? initial.payRate + 4 : 26));
  const [currency, setCurrency]     = useStateScD(initial.currency || "USD");
  const [classification, setClassification] = useStateScD(initial.classification || "W2");
  // ---------------- shift differential -------------------------------
  const [diffNight, setDiffNight]     = useStateScD(initial.shiftDiffNight ?? null);
  const [diffWeekend, setDiffWeekend] = useStateScD(initial.shiftDiffWeekend ?? null);
  // ---------------- effective dates ----------------------------------
  const [effectiveFrom, setEffectiveFrom] = useStateScD(initial.effectiveFrom || "2026-01-01");
  const [effectiveTo, setEffectiveTo]     = useStateScD(initial.effectiveTo   || "2026-12-31");
  // ---------------- skill premiums (chips on/off) --------------------
  const [skillIds, setSkillIds] = useStateScD(initial.skillIds || []);
  // ---------------- mass-adjust mode ---------------------------------
  const [adjustField, setAdjustField] = useStateScD("payRate"); // payRate | positionMarkup
  const [adjustPct, setAdjustPct]     = useStateScD("");
  const [adjustRound, setAdjustRound] = useStateScD("none");    // none | nearest25 | nearest50 | up
  // ---------------- v0.79 · M6 · solve-for-pay -----------------------
  // Bi-directional live preview. "forward" = given pay, compute bill.
  // "reverse" = given bill target, solve for pay (newton-style 1-step
  // approximation using the engine's current loaded factor).
  const [calcDir, setCalcDir]       = useStateScD("forward");
  const [targetBill, setTargetBill] = useStateScD("");
  // ---------------- change-tracking ----------------------------------
  const [reason, setReason] = useStateScD("");

  useEffectScD(() => {
    if (open && positions.length > 0) {
      setMode("edit");
      setEnabled(!!initial.enabled);
      setPosEnabled(initial.positionMarkup != null);
      setPosPercent(initial.positionMarkup != null ? String(initial.positionMarkup) : "");
      setTierEnabled(!!initial.tierEnabled);
      setPayRate(initial.payRate || 22);
      setPayMin(initial.payRateMin || (initial.payRate ? Math.max(7, initial.payRate - 4) : 18));
      setPayPref(initial.payRatePref || initial.payRate || 22);
      setPayMax(initial.payRateMax || (initial.payRate ? initial.payRate + 4 : 26));
      setCurrency(initial.currency || "USD");
      setClassification(initial.classification || "W2");
      setDiffNight(initial.shiftDiffNight ?? null);
      setDiffWeekend(initial.shiftDiffWeekend ?? null);
      setEffectiveFrom(initial.effectiveFrom || "2026-01-01");
      setEffectiveTo(initial.effectiveTo || "2026-12-31");
      setSkillIds(initial.skillIds || []);
      setAdjustField("payRate");
      setAdjustPct("");
      setAdjustRound("none");
      setReason("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const roundTo = (n, mode) => {
    if (mode === "nearest25") return Math.round(n * 4) / 4;
    if (mode === "nearest50") return Math.round(n * 2) / 2;
    if (mode === "up")        return Math.ceil(n);
    return Math.round(n * 100) / 100;
  };

  const apply = () => {
    const patch = {};
    if (mode === "adjust") {
      // Mass-adjust mode: apply a % delta to the chosen field across
      // every selected row. Field can be payRate (preferred + min +
      // max all scaled in lockstep) or positionMarkup (added).
      const pct = Number(adjustPct);
      if (!Number.isFinite(pct) || pct === 0) {
        showToast("Enter a non-zero percentage", { kind: "default" });
        return;
      }
      positions.forEach((p) => {
        if (adjustField === "payRate") {
          const k = 1 + pct / 100;
          const newPref = roundTo((p.payRatePref || p.payRate || 0) * k, adjustRound);
          const newMin  = roundTo((p.payRateMin  || p.payRate || 0) * k, adjustRound);
          const newMax  = roundTo((p.payRateMax  || p.payRate || 0) * k, adjustRound);
          patch[p.id] = {
            payRate:     newPref,
            payRatePref: newPref,
            payRateMin:  newMin,
            payRateMax:  newMax,
            history: _appendHistory(p, `Pay band ×${k.toFixed(3)} → ${newMin}–${newMax}`, reason),
          };
        } else {
          const cur = p.positionMarkup || 0;
          const next = Math.max(0, Math.round(cur + pct));
          patch[p.id] = {
            positionMarkup: next,
            history: _appendHistory(p, `Position markup ${cur}% → ${next}%`, reason),
          };
        }
      });
    } else {
      // Edit mode: full per-row patch with every field in the panel.
      const posValue = posEnabled && posPercent !== "" ? Number(posPercent) || 0 : (posEnabled ? 0 : null);
      positions.forEach((p) => {
        const beforePref = p.payRatePref || p.payRate;
        const summary = (Number(payPref) !== beforePref)
          ? `Pay rate ${beforePref} → ${payPref} ${currency}`
          : "Rate-card row updated";
        patch[p.id] = {
          enabled,
          positionMarkup: posValue,
          tierEnabled,
          payRate:     Number(payPref) || p.payRate,
          payRatePref: Number(payPref) || p.payRate,
          payRateMin:  Number(payMin)  || p.payRateMin,
          payRateMax:  Number(payMax)  || p.payRateMax,
          currency,
          classification,
          shiftDiffNight:   diffNight   === "" ? null : diffNight,
          shiftDiffWeekend: diffWeekend === "" ? null : diffWeekend,
          effectiveFrom,
          effectiveTo,
          skillIds,
          history: _appendHistory(p, summary, reason),
        };
      });
    }
    onSave && onSave(patch);
    showToast(`${positions.length} rate card${positions.length === 1 ? "" : "s"} updated`, { kind: "success" });
    onClose && onClose();
  };

  // ---------------- live preview of the bill rate -------------------
  // Single-row only — bulk shows aggregate count instead.
  const previewBill = (() => {
    if (isBulk) return null;
    const base = Number(payPref) || initial.payRate || 0;
    const cls = CLASSIFICATIONS.find((c) => c.id === classification) || CLASSIFICATIONS[0];
    const skillPct = SKILL_PREMIUMS.filter((s) => skillIds.includes(s.id)).reduce((a, s) => a + s.pct, 0);
    const pos  = posEnabled && posPercent !== "" ? Number(posPercent) || 0 : 0;
    const loaded = base * (1 + (cls.burdenPct + skillPct) / 100);
    return Math.round(loaded * (1 + pos / 100));
  })();
  // v0.79 · M6 — reverse pass. Given a target bill rate, back into the
  // pay rate that produces it under the current staged factor. Sets
  // payPref so the rest of the panel mirrors the solve.
  const solveForPay = () => {
    const target = Number(targetBill);
    if (!target || isBulk) return;
    const cls = CLASSIFICATIONS.find((c) => c.id === classification) || CLASSIFICATIONS[0];
    const skillPct = SKILL_PREMIUMS.filter((s) => skillIds.includes(s.id)).reduce((a, s) => a + s.pct, 0);
    const pos = posEnabled && posPercent !== "" ? Number(posPercent) || 0 : 0;
    const factor = (1 + (cls.burdenPct + skillPct) / 100) * (1 + pos / 100);
    if (!factor) return;
    const pay = Math.round((target / factor) * 100) / 100;
    setPayPref(String(pay));
    setPayRate(String(pay));
    showToast(`Pay rate solved at ${symbol}${pay}/hr for ${symbol}${target} target`, { kind: "success" });
  };

  const symbol = (() => {
    const map = { USD: "$", EUR: "€", GBP: "£", CAD: "C$", AUD: "A$", MXN: "Mex$" };
    return map[currency] || "$";
  })();

  return (
    <SidePanel
      open={open}
      title={isBulk ? `Edit rate cards (${positions.length})` : `Edit rate card`}
      onClose={onClose}
      footer={(
        <React.Fragment>
          <button type="button" className="btn btn--lg btn--tertiary" onClick={onClose}>Cancel</button>
          <button type="button" className="btn btn--lg btn--primary" onClick={apply}>
            {mode === "adjust" ? "Apply adjustment" : "Save"}
          </button>
        </React.Fragment>
      )}
    >
      {/* ---------- mode toggle (bulk only) -------------------------- */}
      {isBulk && (
        <div className="sc-parity" role="tablist" aria-label="Edit mode" style={{ marginBottom: 16 }}>
          <button
            type="button"
            role="tab"
            aria-selected={mode === "edit"}
            className={`sc-parity-btn ${mode === "edit" ? "sc-parity-btn--active" : ""}`}
            onClick={() => setMode("edit")}
          >Edit values</button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === "adjust"}
            className={`sc-parity-btn ${mode === "adjust" ? "sc-parity-btn--active" : ""}`}
            onClick={() => setMode("adjust")}
          >Apply % adjustment</button>
        </div>
      )}

      <h3 className="sp-section-title">Positions</h3>
      <Field label={isBulk ? `Selected (${positions.length})` : "Position"}>
        <div className="sc-chips sc-chips--read">
          {positions.slice(0, 8).map((p) => (
            <span className="sc-chip sc-chip--read" key={p.id}>{p.name}</span>
          ))}
          {positions.length > 8 && (
            <span className="sc-chip sc-chip--read sc-chip--more">+{positions.length - 8} more</span>
          )}
        </div>
      </Field>

      {/* v0.79 · G3 — counter-rate market data prefill.
          Only shown when the viewer is an agency (the "counter rate"
          surface) and a single row is being edited. Pulls the program
          panel average from the analytics aggregate (su-ratecard) and
          a placeholder BLS-style market median; one-click applies the
          chosen value to payPref. */}
      {!isBulk && (typeof window !== "undefined" && window.flexViewAsRole === "agency") && (() => {
        const cur = Number(payPref) || 0;
        const panelAvg = Math.round(cur * 1.04 * 100) / 100;      // synth: program panel avg
        const marketMed = Math.round(cur * 1.08 * 100) / 100;     // synth: BLS-style median
        return (
          <div className="sc-market">
            <div className="sc-market-h">
              <Icon name="Information" size={14} />
              <b>Market data</b>
              <span className="sc-market-sub">Counter the buyer's rate with what the market is paying.</span>
            </div>
            <div className="sc-market-row">
              <button
                type="button"
                className="sc-market-chip"
                onClick={() => { setPayPref(String(panelAvg)); setPayRate(String(panelAvg)); }}
                title="Average across this buyer's other suppliers for the same role + location"
              >
                <span>Program panel average</span>
                <b className="tabular">{symbol}{panelAvg}/hr</b>
              </button>
              <button
                type="button"
                className="sc-market-chip"
                onClick={() => { setPayPref(String(marketMed)); setPayRate(String(marketMed)); }}
                title="External market median (BLS OEWS · role + locale)"
              >
                <span>Market median (BLS OEWS)</span>
                <b className="tabular">{symbol}{marketMed}/hr</b>
              </button>
            </div>
          </div>
        );
      })()}

      {/* =========== MASS-ADJUST MODE ================================= */}
      {mode === "adjust" ? (
        <React.Fragment>
          <hr className="sp-divider" />
          <h3 className="sp-section-title">Adjustment</h3>
          <div className="sp-grid-2">
            <Field label="Field">
              <Dropdown
                options={["Pay rate (band scales)", "Position markup (additive)"]}
                value={adjustField === "payRate" ? "Pay rate (band scales)" : "Position markup (additive)"}
                onChange={(v) => setAdjustField(v.startsWith("Pay") ? "payRate" : "positionMarkup")}
              />
            </Field>
            <Field label="Percentage">
              <TextInput value={adjustPct} onChange={setAdjustPct} placeholder="+5 or -2" type="number" />
            </Field>
          </div>
          {adjustField === "payRate" && (
            <Field label="Round to">
              <Dropdown
                options={["No rounding", "Nearest $0.25", "Nearest $0.50", "Round up to whole"]}
                value={{
                  none: "No rounding", nearest25: "Nearest $0.25",
                  nearest50: "Nearest $0.50", up: "Round up to whole",
                }[adjustRound]}
                onChange={(v) => setAdjustRound({
                  "No rounding": "none", "Nearest $0.25": "nearest25",
                  "Nearest $0.50": "nearest50", "Round up to whole": "up",
                }[v])}
              />
            </Field>
          )}
          <Field label="Reason (audit trail)">
            <TextInput value={reason} onChange={setReason} placeholder="CPI adjustment · Q1 2026" />
          </Field>
        </React.Fragment>
      ) : (
        <React.Fragment>
          <Field label="Status">
            <div className="sc-toggle-row">
              <Switch checked={enabled} onChange={setEnabled} ariaLabel="Status" />
              <span className={`sc-pill sc-pill--${enabled ? "ok" : "off"}`}>
                <Icon name={enabled ? "Check" : "Cancel"} size={12} />
                {enabled ? "Enabled" : "Disabled"}
              </span>
            </div>
          </Field>

          <hr className="sp-divider" />
          <h3 className="sp-section-title">Classification &amp; currency</h3>
          <div className="sp-grid-2">
            <Field label="Worker classification">
              <Dropdown
                options={CLASSIFICATIONS.map((c) => `${c.label} — ${c.hint}`)}
                value={(() => {
                  const c = CLASSIFICATIONS.find((x) => x.id === classification);
                  return c ? `${c.label} — ${c.hint}` : "";
                })()}
                onChange={(v) => {
                  const c = CLASSIFICATIONS.find((x) => v.startsWith(x.label));
                  if (c) setClassification(c.id);
                }}
              />
            </Field>
            <Field label="Currency">
              <Dropdown
                options={["USD", "EUR", "GBP", "CAD", "AUD", "MXN"]}
                value={currency}
                onChange={setCurrency}
              />
            </Field>
          </div>

          <hr className="sp-divider" />
          <h3 className="sp-section-title">Pay-rate band</h3>
          <div className="sp-grid-3">
            <Field label={`Min (${symbol})`}>
              <TextInput value={String(payMin)} onChange={setPayMin} type="number" />
            </Field>
            <Field label={`Preferred (${symbol})`}>
              <TextInput value={String(payPref)} onChange={(v) => { setPayPref(v); setPayRate(v); }} type="number" />
            </Field>
            <Field label={`Max (${symbol})`}>
              <TextInput value={String(payMax)} onChange={setPayMax} type="number" />
            </Field>
          </div>
          <p className="sp-hint">Submissions above max trigger the rate-exception flow on the requisition's assign-worker panel.</p>

          <hr className="sp-divider" />
          <h3 className="sp-section-title">Effective dates</h3>
          <div className="sp-grid-2">
            <Field label="Effective from">
              <TextInput value={effectiveFrom} onChange={setEffectiveFrom} type="date" />
            </Field>
            <Field label="Effective to">
              <TextInput value={effectiveTo} onChange={setEffectiveTo} type="date" />
            </Field>
          </div>

          <hr className="sp-divider" />
          <div className="sc-toggle-row sc-toggle-row--head">
            <Switch checked={posEnabled} onChange={setPosEnabled} ariaLabel="Enable position-level markup" />
            <h3 className="sp-section-title" style={{ margin: 0 }}>Enable position-level markup</h3>
          </div>
          {posEnabled && (
            <div className="sp-grid-2">
              <Field label="Percentage (%)">
                <TextInput value={posPercent} onChange={setPosPercent} placeholder="10" type="number" />
              </Field>
              <Field label="Markup type">
                <SelectField value="Percentage (%)" />
              </Field>
            </div>
          )}

          <hr className="sp-divider" />
          <div className="sc-toggle-row sc-toggle-row--head">
            <Switch checked={tierEnabled} onChange={setTierEnabled} ariaLabel="Enable tier-level markup" />
            <h3 className="sp-section-title" style={{ margin: 0 }}>Enable tier-level markup</h3>
          </div>
          {tierEnabled && (
            <div className="sc-tier-grid">
              {TIERS.map((t) => (
                <div className="sc-tier-row" key={t.id}>
                  <span className="sc-tier-label">{t.label}</span>
                  <div className="sc-tier-input">
                    <TextInput
                      value={String(tierPercents[t.id])}
                      onChange={(v) => setTierPercents({ ...tierPercents, [t.id]: Number(v) || 0 })}
                      placeholder="0"
                      type="number"
                    />
                    <span className="sc-num-suffix">%</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          <hr className="sp-divider" />
          <h3 className="sp-section-title">Shift differentials</h3>
          <div className="sp-grid-2">
            <Field label="Night premium (%)">
              <TextInput
                value={diffNight == null ? "" : String(diffNight)}
                onChange={(v) => setDiffNight(v === "" ? null : Number(v))}
                placeholder="15"
                type="number"
              />
            </Field>
            <Field label="Weekend premium (%)">
              <TextInput
                value={diffWeekend == null ? "" : String(diffWeekend)}
                onChange={(v) => setDiffWeekend(v === "" ? null : Number(v))}
                placeholder="10"
                type="number"
              />
            </Field>
          </div>

          <hr className="sp-divider" />
          <h3 className="sp-section-title">Skill premiums</h3>
          <div className="sc-chips" role="group" aria-label="Skill premiums">
            {SKILL_PREMIUMS.map((s) => {
              const on = skillIds.includes(s.id);
              return (
                <button
                  key={s.id}
                  type="button"
                  className={`sc-chip sc-chip--toggle ${on ? "sc-chip--on" : ""}`}
                  aria-pressed={on}
                  onClick={() => setSkillIds(on ? skillIds.filter((x) => x !== s.id) : [...skillIds, s.id])}
                >
                  <Icon name={on ? "Check" : "Plus"} size={12} />
                  {s.label} <span className="sc-chip-pct">+{s.pct}%</span>
                </button>
              );
            })}
          </div>

          <hr className="sp-divider" />
          <Field label="Reason (audit trail)">
            <TextInput value={reason} onChange={setReason} placeholder="Annual review · CPI adjustment · etc." />
          </Field>

          {/* live preview ------------------------------------------- */}
          {previewBill != null && (
            <div className="sc-rate-preview">
              <div className="sc-rate-preview-h">
                Live preview
                {/* v0.79 · M6 — solve-for-pay toggle. Forward = pay→bill;
                    reverse = target-bill→pay. Mirrors FG "Bill Rate
                    Based" and Vendly "Solve for pay" modes. */}
                <span className="sc-rate-dir" role="tablist" aria-label="Calc direction">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={calcDir === "forward"}
                    className={`sc-rate-dir-btn ${calcDir === "forward" ? "is-active" : ""}`}
                    onClick={() => setCalcDir("forward")}
                  >Pay → Bill</button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={calcDir === "reverse"}
                    className={`sc-rate-dir-btn ${calcDir === "reverse" ? "is-active" : ""}`}
                    onClick={() => setCalcDir("reverse")}
                  >Bill → Pay</button>
                </span>
              </div>
              {calcDir === "reverse" && (
                <div className="sc-rate-solve">
                  <Field label={`Target bill rate (${symbol})`}>
                    <TextInput value={targetBill} onChange={setTargetBill} placeholder="48" type="number" />
                  </Field>
                  <button
                    type="button"
                    className="btn btn--sm btn--secondary"
                    onClick={solveForPay}
                  >
                    <Icon name="Calculate" size={14} /> Solve for pay
                  </button>
                </div>
              )}
              <div className="sc-rate-preview-body">
                <div><span>Pay (preferred)</span><b>{symbol}{Number(payPref) || 0}/hr</b></div>
                <div><span>+ Burden ({CLASSIFICATIONS.find((c) => c.id === classification)?.burdenPct || 0}%)</span></div>
                {skillIds.length > 0 && (
                  <div><span>+ Skill premiums (+{SKILL_PREMIUMS.filter((s) => skillIds.includes(s.id)).reduce((a, s) => a + s.pct, 0)}%)</span></div>
                )}
                {posEnabled && posPercent !== "" && (
                  <div><span>× Position markup ({posPercent}%)</span></div>
                )}
                <div className="sc-rate-preview-out"><span>Loaded bill rate</span><b>{symbol}{previewBill}/hr</b></div>
              </div>
            </div>
          )}
        </React.Fragment>
      )}
    </SidePanel>
  );
}

// Append a history entry to a position row. Returns the new array,
// capped at 12 entries (oldest dropped). Reason is optional.
function _appendHistory(p, change, reason) {
  const prev = Array.isArray(p && p.history) ? p.history : [];
  const at = new Date().toISOString().slice(0, 10);
  const entry = { at, by: "You", change, reason: reason || "" };
  return [entry, ...prev].slice(0, 12);
}

function ScRateCardEditorHost() {
  const [config, setConfig] = useStateScD(null);
  useEffectScD(() => Interactions.on("scRateCardEditor", setConfig), []);
  if (!config) return null;
  return (
    <ScRateCardEditorPanel
      open
      positions={config.positions}
      onSave={config.onSave}
      onClose={() => setConfig(null)}
    />
  );
}

// ----- Agency details editor (sidebar; used from accordion Edit btn) ---
function ScAgencyEditorPanel({ open, data, onSave, onClose }) {
  const [values, setValues] = useStateScD(data || {});
  useEffectScD(() => { if (open) setValues(data || {}); }, [open, data]);
  const set = (k, v) => setValues((prev) => ({ ...prev, [k]: v }));
  return (
    <SidePanel
      open={open}
      title="Edit agency details"
      onClose={onClose}
      footer={(
        <React.Fragment>
          <button type="button" className="btn btn--lg btn--tertiary" onClick={onClose}>Cancel</button>
          <button type="button" className="btn btn--lg btn--primary" onClick={() => {
            onSave && onSave(values);
            showToast("Agency details saved", { kind: "success" });
            onClose && onClose();
          }}>Save</button>
        </React.Fragment>
      )}
    >
      <h3 className="sp-section-title">Essentials</h3>
      <Field label="Name" required>
        <TextInput value={values.name || ""} onChange={(v) => set("name", v)} />
      </Field>
      <div className="sp-grid-2">
        <Field label="Address" required>
          <TextInput value={values.address || ""} onChange={(v) => set("address", v)} />
        </Field>
        <Field label="Zip code" required>
          <TextInput value={values.zip || ""} onChange={(v) => set("zip", v)} />
        </Field>
      </div>
      <Field label="Legal entity">
        <Dropdown
          options={LEGAL_ENTITIES}
          value={values.legalEntity}
          onChange={(v) => set("legalEntity", v)}
          placeholder="Select"
        />
      </Field>
      <Field label="Pricing configuration">
        <SelectField value={values.pricingConfig || "Select"} />
      </Field>

      <hr className="sp-divider" />
      <h3 className="sp-section-title">Contact information</h3>
      <div className="sp-grid-2">
        <Field label="First name">
          <TextInput value={values.contactFirst || ""} onChange={(v) => set("contactFirst", v)} />
        </Field>
        <Field label="Last name">
          <TextInput value={values.contactLast || ""} onChange={(v) => set("contactLast", v)} />
        </Field>
      </div>
      <Field label="Email address">
        <TextInput value={values.contactEmail || ""} onChange={(v) => set("contactEmail", v)} />
      </Field>
    </SidePanel>
  );
}

function ScAgencyEditorHost() {
  const [config, setConfig] = useStateScD(null);
  useEffectScD(() => Interactions.on("scAgencyEditor", setConfig), []);
  if (!config) return null;
  return (
    <ScAgencyEditorPanel
      open
      data={config.data}
      onSave={config.onSave}
      onClose={() => setConfig(null)}
    />
  );
}

// =====================================================================
// Cancellation policy + Users accordion bodies (Figma)
// =====================================================================
function CancellationPolicyBody({ data }) {
  const cp = data.cancellationPolicy || { window24h: 100, window48h: 50, window72h: 25 };
  return (
    <div className="sc-cp">
      <div className="sc-cp-row">
        <span className="sc-cp-label">Within 24 hours of shift start</span>
        <span className="sc-cp-val tabular">{cp.window24h}% billed</span>
      </div>
      <div className="sc-cp-row">
        <span className="sc-cp-label">24 – 48 hours before shift start</span>
        <span className="sc-cp-val tabular">{cp.window48h}% billed</span>
      </div>
      <div className="sc-cp-row">
        <span className="sc-cp-label">48 – 72 hours before shift start</span>
        <span className="sc-cp-val tabular">{cp.window72h}% billed</span>
      </div>
      <p className="sc-cp-note">No charge applies for shifts cancelled more than 72 hours in advance.</p>
    </div>
  );
}

function UsersBody({ data }) {
  return (
    <MiniTable
      empty="No users invited yet."
      columns={[
        { key: "name",   label: "Name",   width: "1.4fr" },
        { key: "role",   label: "Role",   width: "1fr" },
        { key: "email",  label: "Email",  width: "2fr" },
        { key: "status", label: "Status", width: "1fr",
          render: (r) => <span className={`req-pill req-pill--${r.status === "Active" ? "success" : "default"}`}>{r.status}</span> },
      ]}
      rows={data.users || []}
    />
  );
}

// =====================================================================
// Contract Terms — paper contract link + configurations
// =====================================================================
function ContractTermsBody({ data }) {
  const t  = data.contractTerms  || {};
  const pc = data.paperContract || {};
  const fmtHrs = (n) => n == null ? "—" : `${n} hr${n === 1 ? "" : "s"}`;
  const fmtX   = (n) => n == null ? "—" : `${n.toFixed(2).replace(/\.00$/, "").replace(/(\.\d)0$/, "$1")}×`;
  const fmtUsd = (n) => n == null ? "—" : `$${n.toLocaleString()}`;

  // Four hairline-separated groups, rendered through the same InfoGrid
  // primitive the Details accordion uses. The label/value layout matches
  // the rest of the supplier-details page; groups give us the row
  // dividers between Conversion / Overtime / Timesheets / Invoicing.
  const groups = [
    {
      title: "Conversion to permanent",
      rows: [
        { label: "Conversion hours",         value: t.conversionHours != null ? `${t.conversionHours.toLocaleString()} hours` : "—",                                                          tabular: true },
        { label: "Early conversion fee",     value: t.conversionFeePct != null ? `${t.conversionFeePct}% of first-year salary` : "—",                                                          tabular: true },
        { label: "Tenure limit",             value: t.tenureLimitWeeks != null ? `${t.tenureLimitWeeks} weeks` : "—",                                                                          tabular: true },
      ],
    },
    {
      title: "Overtime & premium pay",
      rows: [
        { label: "Overtime threshold",       value: `${fmtHrs(t.otDailyAfterHrs)}/day or ${fmtHrs(t.otWeeklyAfterHrs)}/week`, tabular: true },
        { label: "Overtime multiplier",      value: `${fmtX(t.otMultiplier)} bill rate`,                                       tabular: true },
        { label: "Double-time after",        value: `${fmtHrs(t.dtAfterHrs)}/day · ${fmtX(t.dtMultiplier)}`,                   tabular: true },
        { label: "Holiday premium",          value: `${fmtX(t.holidayMultiplier)} bill rate${t.holidaysObserved != null ? ` · ${t.holidaysObserved} observed holidays` : ""}`, tabular: true },
      ],
    },
    {
      title: "Timesheets",
      rows: [
        { label: "Submission cutoff",        value: t.timesheetCutoff || "—" },
        { label: "Grace period before late", value: fmtHrs(t.timesheetGraceHrs), tabular: true },
        { label: "Late timesheet fee",       value: t.lateTimesheetFee != null ? `${fmtUsd(t.lateTimesheetFee)} per timesheet` : "—", tabular: true },
        { label: "Auto-approval",            value: t.autoApproveAfterDays != null ? `After ${t.autoApproveAfterDays} business days` : "—", tabular: true },
      ],
    },
    {
      title: "Invoicing",
      rows: [
        { label: "Invoice cadence",          value: t.invoiceCadence || "—" },
        { label: "Payment terms",            value: t.paymentTerms   || "—" },
        { label: "Dispute window",           value: t.disputeWindowDays != null ? `${t.disputeWindowDays} days from receipt` : "—", tabular: true },
        { label: "Minimum billable shift",   value: fmtHrs(t.minShiftHrs), tabular: true },
      ],
    },
    {
      title: "Contract",
      // Paper-contract attachment — rendered as a `content` group inside
      // the same InfoGrid so it inherits the hairline separator and
      // padding the rest of the terms use.
      content: (
        <ul className="dg-attachments sc-ct-doc">
          <li className="dg-attachment">
            <span className="dg-attachment-icon" aria-hidden="true">
              <Icon name="PDF" size={24} />
            </span>
            <div className="dg-attachment-text">
              <span className="dg-attachment-name">{pc.name || "Master_services_agreement.pdf"}</span>
              <span className="dg-attachment-meta">
                Effective {pc.effective || "—"} – {pc.expires || "—"}
              </span>
            </div>
            <button
              type="button"
              className="iconbtn"
              aria-label="View contract"
              title="View contract"
              onClick={() => (window.showToast || (() => {}))(`Opening ${pc.name || "contract"}`)}
            >
              <Icon name="LinkNewWindow" size={18} />
            </button>
            <button
              type="button"
              className="iconbtn"
              aria-label="Download contract"
              title="Download"
              onClick={() => (window.showToast || (() => {}))(`Downloading ${pc.name || "contract"}`)}
            >
              <Icon name="FileDownload" size={18} />
            </button>
          </li>
        </ul>
      ),
    },
  ];

  return (
    <div className="sc-ct">
      <InfoGrid groups={groups} />
    </div>
  );
}

// =====================================================================
// v0.82 — Supplier funding (per-agency negotiated MSP program fee)
// Renders on the agency detail page only when the program is
// supplier-funded. Reads the resolved terms from getSupplierFunding so
// the displayed rate, method and preview match exactly what the
// agency's invoices apply.
// =====================================================================
function SupplierFundingBody({ supplierId }) {
  const f = (window.getSupplierFunding && window.getSupplierFunding(supplierId)) || null;
  const sym = (window.curSymbol && window.curSymbol()) || "$";
  if (!f) {
    return (
      <div className="sc-banner sc-banner--info" style={{ margin: 0 }}>
        <Icon name="Information" size={16} />
        <span>
          This program is buyer&#8209;funded. Turn on Supplier Funding in{" "}
          <a href="#" onClick={(e) => { e.preventDefault(); window.flexGoTo && window.flexGoTo({ page: "settings", sub: "configuration" }); }}>
            Settings &rarr; Configuration &rarr; Program funding
          </a>{" "}
          to negotiate per&#8209;agency rates.
        </span>
      </div>
    );
  }
  const fmtPct = (n) => `${(Math.round(n * 100) / 100).toString()}%`;
  const delta = Math.round((f.standardPct - f.effectivePct) * 100) / 100;
  // $1,000 illustrative preview, mirrors the invoice math.
  const previewBill = 1000;
  const fee = Math.round(previewBill * (f.effectivePct / 100) * 100) / 100;
  const fmtMoney = window.fmtMoney || ((n) => `${sym}${Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
  const coveredLabels = Object.entries(f.coverage || {})
    .filter(([, v]) => v)
    .map(([k]) => ({ frontline: "Frontline", professional: "Professional", sow: "SOW", contractor: "Contractor" }[k]))
    .filter(Boolean);

  return (
    <div className="sc-fund">
      <div className="sc-fund-hero">
        <div className="sc-fund-rate">
          <span className="sc-fund-rate-num tabular">{fmtPct(f.effectivePct)}</span>
          <span className="sc-fund-rate-lbl">Negotiated rate</span>
        </div>
        <div className="sc-fund-compare">
          <div className="sc-fund-compare-row">
            <span>Program standard</span>
            <span className="tabular">{fmtPct(f.standardPct)}</span>
          </div>
          <div className="sc-fund-compare-row">
            <span>This agency</span>
            <span className="tabular">{fmtPct(f.effectivePct)}</span>
          </div>
          <div className={"sc-fund-pill " + (f.effectivePct === 0 ? "sc-fund-pill--waived" : f.hasOverride ? "sc-fund-pill--reduced" : "sc-fund-pill--standard")}>
            {f.effectivePct === 0
              ? "Fee waived"
              : f.hasOverride
                ? `${fmtPct(delta)} below standard`
                : "At program standard"}
          </div>
        </div>
      </div>

      <InfoGrid
        groups={[{
          rows: [
            { label: "Calculation method", value: `${f.method}${f.method === "Markup" ? " — added on top of the bill" : f.method === "Discount" ? " — deducted from the bill" : ""}` },
            { label: "Applies to",         value: coveredLabels.length ? coveredLabels.join(" · ") : "—" },
            { label: "Effective date",     value: f.effectiveDate || "—" },
            { label: "Per-agency override", value: f.allowOverrides ? "Allowed" : "Locked to program default" },
          ],
        }]}
      />

      <div className="sc-fund-preview" aria-label="Fee preview on a 1,000 invoice">
        <span className="sc-fund-preview-head">On a {fmtMoney(previewBill)} invoice</span>
        <div className="sc-fund-preview-rows">
          <div className="sc-fund-preview-row">
            <span>Bill amount</span>
            <span className="tabular">{fmtMoney(previewBill)}</span>
          </div>
          <div className="sc-fund-preview-row sc-fund-preview-row--fee">
            <span>{f.method === "Markup" ? "+ " : "− "}{f.invoiceLabel} ({fmtPct(f.effectivePct)})</span>
            <span className="tabular">{f.method === "Markup" ? "+ " : "− "}{fmtMoney(fee)}</span>
          </div>
          <div className="sc-fund-preview-row sc-fund-preview-row--net">
            <span>{f.method === "Markup" ? "Buyer pays" : "Net to agency"}</span>
            <span className="tabular">{fmtMoney(f.method === "Markup" ? previewBill + fee : previewBill - fee)}</span>
          </div>
        </div>
      </div>

      {f.note && (
        <p className="sc-fund-note">
          <Icon name="Information" size={12} />
          <span>{f.note}</span>
        </p>
      )}
    </div>
  );
}

// ----- Supplier funding editor (side panel) ----------------------------
function ScFundingEditorPanel({ open, supplierId, onSave, onClose }) {
  const program = (window.getProgramFunding && window.getProgramFunding()) || {};
  const standardPct = Number(program.feePct) || 0;
  const contract = (window.getSupplierContract && window.getSupplierContract(supplierId)) || {};
  const initial = (contract.funding) || {};
  const [v, setV] = useStateScD(initial);
  useEffectScD(() => { if (open) setV((window.getSupplierContract && window.getSupplierContract(supplierId).funding) || {}); /* eslint-disable-next-line */ }, [open, supplierId]);
  const set = (k, val) => setV((prev) => ({ ...prev, [k]: val }));

  const methodOptions = ["Inherit from program", "Markup", "Discount"];
  const methodValue = (!v.method || v.method === "Inherit") ? "Inherit from program" : v.method;

  const rawPct = (v.negotiatedPct == null || v.negotiatedPct === "") ? "" : v.negotiatedPct;
  const clampedPreview = rawPct === "" ? standardPct : Math.max(0, Math.min(standardPct, Number(rawPct)));

  return (
    <SidePanel
      open={open}
      title="Edit supplier funding"
      onClose={onClose}
      footer={(
        <React.Fragment>
          <button type="button" className="btn btn--lg btn--tertiary" onClick={onClose}>Cancel</button>
          <button type="button" className="btn btn--lg btn--primary" onClick={() => {
            const next = {
              negotiatedPct: rawPct === "" ? null : Math.max(0, Math.min(standardPct, Number(rawPct))),
              method: methodValue === "Inherit from program" ? "Inherit" : methodValue,
              effectiveDate: v.effectiveDate || program.effectiveDate,
            };
            window.setSupplierFunding && window.setSupplierFunding(supplierId, next);
            onSave && onSave(next);
            showToast("Supplier funding saved", { kind: "success" });
            onClose && onClose();
          }}>Save</button>
        </React.Fragment>
      )}
    >
      <div className="sc-banner sc-banner--info">
        <Icon name="Information" size={16} />
        <span>Changes apply to invoices issued after the effective date. In&#8209;flight invoices keep their existing rate.</span>
      </div>

      <Field
        label="Negotiated program fee"
        hint={`0 – ${standardPct}% (program standard). Enter 0 to fully waive the fee for this agency.`}
      >
        <TextInput
          value={v.negotiatedPct ?? ""}
          onChange={(val) => set("negotiatedPct", val === "" ? "" : Number(val))}
          type="number"
          placeholder={String(standardPct)}
          trail={<span className="sc-trail">%</span>}
        />
      </Field>
      <p className="sc-fund-edit-resolved">
        Effective rate applied: <b className="tabular">{clampedPreview}%</b>
        {rawPct !== "" && Number(rawPct) > standardPct && (
          <span className="sc-fund-edit-warn"> · capped at the {standardPct}% program standard</span>
        )}
      </p>

      <Field label="Calculation method" hint="Inherit follows the program-wide method; override only when this agency's agreement differs.">
        <Dropdown
          options={methodOptions}
          value={methodValue}
          onChange={(val) => set("method", val === "Inherit from program" ? "Inherit" : val)}
          placeholder="Select"
        />
      </Field>

      <Field label="Effective date">
        <TextInput
          value={v.effectiveDate ?? ""}
          onChange={(val) => set("effectiveDate", val)}
          placeholder={program.effectiveDate || "Jul 1, 2026"}
        />
      </Field>
    </SidePanel>
  );
}

function ScFundingEditorHost() {
  const [config, setConfig] = useStateScD(null);
  useEffectScD(() => Interactions.on("scFundingEditor", setConfig), []);
  if (!config) return null;
  return (
    <ScFundingEditorPanel
      open
      supplierId={config.supplierId}
      onSave={config.onSave}
      onClose={() => setConfig(null)}
    />
  );
}

function openSupplierFundingEditor(cfg) { Interactions.emit("scFundingEditor", cfg); }

// ----- Contract terms editor (side panel) ------------------------------
function ScContractTermsEditorPanel({ open, data, onSave, onClose }) {
  const initial = (data && data.contractTerms) || {};
  const [v, setV] = useStateScD(initial);
  useEffectScD(() => { if (open) setV(initial); /* eslint-disable-next-line */ }, [open]);
  const set    = (k, val) => setV((prev) => ({ ...prev, [k]: val }));
  const setNum = (k, val) => set(k, val === "" || val == null ? null : Number(val));

  return (
    <SidePanel
      open={open}
      title="Edit contract terms"
      onClose={onClose}
      footer={(
        <React.Fragment>
          <button type="button" className="btn btn--lg btn--tertiary" onClick={onClose}>Cancel</button>
          <button type="button" className="btn btn--lg btn--primary" onClick={() => {
            onSave && onSave(v);
            showToast("Contract terms saved", { kind: "success" });
            onClose && onClose();
          }}>Save</button>
        </React.Fragment>
      )}
    >
      <div className="sc-banner sc-banner--info">
        <Icon name="Information" size={16} />
        <span>Changes apply to new requisitions. Shifts already in flight continue on their existing terms.</span>
      </div>

      <h3 className="sp-section-title" style={{ marginTop: 16 }}>Conversion to permanent</h3>
      <Field label="Conversion hours" hint="Hours billed before client may convert worker fee-free.">
        <TextInput
          value={v.conversionHours ?? ""}
          onChange={(val) => setNum("conversionHours", val)}
          type="number"
          placeholder="1040"
          trail={<span className="sc-trail">hours</span>}
        />
      </Field>
      <Field label="Early conversion fee" hint="If converted before the threshold above.">
        <TextInput
          value={v.conversionFeePct ?? ""}
          onChange={(val) => setNum("conversionFeePct", val)}
          type="number"
          placeholder="25"
          trail={<span className="sc-trail">% of first-year salary</span>}
        />
      </Field>
      <Field label="Tenure limit" hint="Maximum contiguous weeks on assignment.">
        <TextInput
          value={v.tenureLimitWeeks ?? ""}
          onChange={(val) => setNum("tenureLimitWeeks", val)}
          type="number"
          placeholder="78"
          trail={<span className="sc-trail">weeks</span>}
        />
      </Field>

      <hr className="sp-divider" />
      <h3 className="sp-section-title">Overtime & premium pay</h3>
      <div className="sc-ct-row2">
        <Field label="Overtime — daily after">
          <TextInput
            value={v.otDailyAfterHrs ?? ""}
            onChange={(val) => setNum("otDailyAfterHrs", val)}
            type="number"
            placeholder="8"
            trail={<span className="sc-trail">hrs</span>}
          />
        </Field>
        <Field label="Overtime — weekly after">
          <TextInput
            value={v.otWeeklyAfterHrs ?? ""}
            onChange={(val) => setNum("otWeeklyAfterHrs", val)}
            type="number"
            placeholder="40"
            trail={<span className="sc-trail">hrs</span>}
          />
        </Field>
      </div>
      <Field label="Overtime multiplier">
        <TextInput
          value={v.otMultiplier ?? ""}
          onChange={(val) => setNum("otMultiplier", val)}
          type="number"
          placeholder="1.5"
          trail={<span className="sc-trail">× bill rate</span>}
        />
      </Field>
      <div className="sc-ct-row2">
        <Field label="Double-time after">
          <TextInput
            value={v.dtAfterHrs ?? ""}
            onChange={(val) => setNum("dtAfterHrs", val)}
            type="number"
            placeholder="12"
            trail={<span className="sc-trail">hrs/day</span>}
          />
        </Field>
        <Field label="Double-time multiplier">
          <TextInput
            value={v.dtMultiplier ?? ""}
            onChange={(val) => setNum("dtMultiplier", val)}
            type="number"
            placeholder="2.0"
            trail={<span className="sc-trail">× bill rate</span>}
          />
        </Field>
      </div>
      <div className="sc-ct-row2">
        <Field label="Holiday multiplier">
          <TextInput
            value={v.holidayMultiplier ?? ""}
            onChange={(val) => setNum("holidayMultiplier", val)}
            type="number"
            placeholder="1.5"
            trail={<span className="sc-trail">× bill rate</span>}
          />
        </Field>
        <Field label="Holidays observed">
          <TextInput
            value={v.holidaysObserved ?? ""}
            onChange={(val) => setNum("holidaysObserved", val)}
            type="number"
            placeholder="11"
            trail={<span className="sc-trail">/ year</span>}
          />
        </Field>
      </div>

      <hr className="sp-divider" />
      <h3 className="sp-section-title">Timesheets</h3>
      <Field label="Submission cutoff" hint="For the prior workweek.">
        <Dropdown
          options={[
            "Mon 10:00 AM PT",
            "Mon 12:00 PM PT",
            "Mon 5:00 PM PT",
            "Sun 11:59 PM PT",
            "Tue 9:00 AM PT",
          ]}
          value={v.timesheetCutoff || ""}
          onChange={(val) => set("timesheetCutoff", val)}
          placeholder="Select"
        />
      </Field>
      <div className="sc-ct-row2">
        <Field label="Grace period before late">
          <TextInput
            value={v.timesheetGraceHrs ?? ""}
            onChange={(val) => setNum("timesheetGraceHrs", val)}
            type="number"
            placeholder="24"
            trail={<span className="sc-trail">hrs</span>}
          />
        </Field>
        <Field label="Late timesheet fee" hint="Charged to supplier.">
          <TextInput
            value={v.lateTimesheetFee ?? ""}
            onChange={(val) => setNum("lateTimesheetFee", val)}
            type="number"
            placeholder="25"
            trail={<span className="sc-trail">$ / timesheet</span>}
          />
        </Field>
      </div>
      <Field label="Auto-approval window" hint="Approved automatically if manager doesn't action.">
        <TextInput
          value={v.autoApproveAfterDays ?? ""}
          onChange={(val) => setNum("autoApproveAfterDays", val)}
          type="number"
          placeholder="3"
          trail={<span className="sc-trail">business days</span>}
        />
      </Field>

      <hr className="sp-divider" />
      <h3 className="sp-section-title">Invoicing</h3>
      <div className="sc-ct-row2">
        <Field label="Invoice cadence">
          <Dropdown
            options={[
              "Weekly · approved hours",
              "Bi-weekly · approved hours",
              "Monthly · approved hours",
              "On shift completion",
            ]}
            value={v.invoiceCadence || ""}
            onChange={(val) => set("invoiceCadence", val)}
            placeholder="Select"
          />
        </Field>
        <Field label="Payment terms">
          <Dropdown
            options={["Net 15", "Net 30", "Net 45", "Net 60", "Net 90"]}
            value={v.paymentTerms || ""}
            onChange={(val) => set("paymentTerms", val)}
            placeholder="Select"
          />
        </Field>
      </div>
      <div className="sc-ct-row2">
        <Field label="Dispute window">
          <TextInput
            value={v.disputeWindowDays ?? ""}
            onChange={(val) => setNum("disputeWindowDays", val)}
            type="number"
            placeholder="10"
            trail={<span className="sc-trail">days from receipt</span>}
          />
        </Field>
        <Field label="Minimum billable shift">
          <TextInput
            value={v.minShiftHrs ?? ""}
            onChange={(val) => setNum("minShiftHrs", val)}
            type="number"
            placeholder="4"
            trail={<span className="sc-trail">hrs</span>}
          />
        </Field>
      </div>
    </SidePanel>
  );
}

function ScContractTermsEditorHost() {
  const [config, setConfig] = useStateScD(null);
  useEffectScD(() => Interactions.on("scContractTermsEditor", setConfig), []);
  if (!config) return null;
  return (
    <ScContractTermsEditorPanel
      open
      data={config.data}
      onSave={config.onSave}
      onClose={() => setConfig(null)}
    />
  );
}

function openContractTermsEditor(cfg) { Interactions.emit("scContractTermsEditor", cfg); }

Object.assign(window, {
  DistrictMarkupsCard, RateCardsCard,
  CancellationPolicyBody, UsersBody,
  ContractTermsBody,
  SupplierFundingBody, ScFundingEditorHost, openSupplierFundingEditor,
  ScMarkupEditorHost, ScRateCardEditorHost, ScAgencyEditorHost, ScContractTermsEditorHost,
  openMarkupEditor, openRateCardEditor, openAgencyDetailsEditor, openContractTermsEditor,
});
