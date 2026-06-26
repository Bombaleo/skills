// =====================================================================
// Flex Work — Talent Pools
//
// Buyer-owned pools that sit ahead of agency suppliers in the
// distribution waterfall. Three tabs:
//   · Float pool   — internal cross-facility nurses (healthcare wedge)
//   · Per-diem pool — short-call, hours-capped per-diem workers
//   · Alumni       — re-hireable workers from prior shifts (retail surge)
//
// The "Direct sourcing" callout makes the offer cascade explicit:
//   Float → Per-diem → Alumni → Preferred agencies → Distribution.
// =====================================================================

const { useState: useStateTp, useMemo: useMemoTp } = React;

const _tpPaletteFor = (id) => (window.paletteFor || ((s) => ({ bg: "#A0AEC0", fg: "#1F1F23" })))(id);
const _tpInitialsFor = (n) => (window.initialsFor || ((s) => (s || "").split(/\s+/).map((w) => w[0]).slice(0,2).join("").toUpperCase()))(n);

// ---------- Mock pool data --------------------------------------------
// Healthcare float pool — internal Mercy nurses deployable across the
// 4-facility network. The unit pills drive the unit-aware match.
const FLOAT_POOL = [
  { id: "f-pa", name: "Priya Aravind, RN",  facilities: ["Mercy Medical Plaza", "Mercy Plaza South"],          units: ["medsurg"],                hours: 28, target: 36, seniority: "5 yrs", lastWorked: "Floor 4 · Apr 17", offers: 2, color: "#147A78" },
  { id: "f-jh", name: "Jordan Hsu, RN",     facilities: ["Mercy Memorial"],                                    units: ["icu", "medsurg"],         hours: 36, target: 36, seniority: "9 yrs", lastWorked: "ICU North · Apr 22", offers: 0, color: "#5C36A3" },
  { id: "f-rd", name: "Rohan Desai, RN",    facilities: ["Mercy Memorial", "Mercy Plaza South"],               units: ["ed"],                     hours: 24, target: 36, seniority: "3 yrs", lastWorked: "ED · Apr 20", offers: 1, color: "#A0541A" },
  { id: "f-mw", name: "Maya Wallace, RN",   facilities: ["Mercy Children's"],                                  units: ["peds"],                   hours: 32, target: 36, seniority: "7 yrs", lastWorked: "Peds 5 · Apr 21", offers: 0, color: "#147A78" },
  { id: "f-bf", name: "Ben Fielding, RN",   facilities: ["Mercy Memorial"],                                    units: ["icu"],                    hours: 12, target: 24, seniority: "12 yrs", lastWorked: "ICU South · Apr 14", offers: 3, color: "#5C36A3" },
  { id: "f-tg", name: "Teresa Gomez, RN",   facilities: ["Mercy Plaza South", "Mercy Memorial"],               units: ["ed", "medsurg"],          hours: 36, target: 36, seniority: "4 yrs", lastWorked: "ED · Apr 22", offers: 0, color: "#A0541A" },
  { id: "f-sk", name: "Sasha Kowalski, RN", facilities: ["Mercy Medical Plaza"],                               units: ["medsurg"],                hours: 8,  target: 24, seniority: "1 yr",  lastWorked: "Floor 4 · Apr 12", offers: 0, color: "#147A78", suspended: "Flu shot expired" },
  { id: "f-de", name: "Dana Ellsworth, LPN",facilities: ["Mercy Medical Plaza"],                               units: ["medsurg"],                hours: 20, target: 32, seniority: "2 yrs", lastWorked: "Floor 4 · Apr 19", offers: 0, color: "#147A78" },
];

// Per-diem pool — workers with capped weekly hours and ad-hoc
// availability (rendered as a 7-day strip).
const PERDIEM_POOL = [
  { id: "p-ml", name: "Maya Lin",        role: "RN, Med-Surg",  facility: "Mercy Medical Plaza", maxHrs: 24, hours: 12, avail: ["on","on","off","on","worked","off","off"], rate: "$54/hr", lastWorked: "Apr 17", offers: 2 },
  { id: "p-jc", name: "Jamal Carter",    role: "RN, ICU",       facility: "Mercy Memorial",      maxHrs: 24, hours: 24, avail: ["worked","worked","off","off","worked","off","off"], rate: "$68/hr", lastWorked: "Apr 22", offers: 0 },
  { id: "p-pr", name: "Priya Ramesh",    role: "RN, Med-Surg",  facility: "Mercy Plaza South",   maxHrs: 32, hours: 16, avail: ["on","on","on","on","off","on","on"], rate: "$56/hr", lastWorked: "Apr 19", offers: 1 },
  { id: "p-tk", name: "Terry Donin",     role: "LPN, Med-Surg", facility: "Mercy Medical Plaza", maxHrs: 24, hours: 8,  avail: ["off","on","on","worked","off","on","on"], rate: "$42/hr", lastWorked: "Apr 21", offers: 0 },
  { id: "p-ja", name: "Jakob Aminoff",   role: "RN, ED",        facility: "Mercy Memorial",      maxHrs: 32, hours: 28, avail: ["worked","worked","off","worked","worked","off","off"], rate: "$62/hr", lastWorked: "Apr 22", offers: 0 },
  { id: "p-ks", name: "Kierra Stanton",  role: "RN, ED",        facility: "Mercy Plaza South",   maxHrs: 24, hours: 0,  avail: ["off","off","on","on","on","off","off"], rate: "$58/hr", lastWorked: "Apr 09", offers: 4 },
];

// Alumni pool — re-hireable. Tenure + last-worked + supplier-of-record.
const ALUMNI_POOL = [
  { id: "a-mw", name: "Marcus Webb",       role: "Operator",        skill: "Forklift + safety",           lastSupplier: "Skill Scouts",   tenure: "11 mo",  shifts: 47, lastWorked: "Mar 14 2026",  rating: 4.8, rehire: "Preferred" },
  { id: "a-aw", name: "Ada Watts",         role: "Assembler",       skill: "Hi-line + QC sign-off",       lastSupplier: "Staffwise",      tenure: "4 mo",   shifts: 18, lastWorked: "Feb 02 2026",  rating: 4.6, rehire: "Yes" },
  { id: "a-mh", name: "Makenna Herwitz",   role: "Server (banquet)",skill: "Plated, fine-dining, TIPS",   lastSupplier: "Talent Hub",     tenure: "8 mo",   shifts: 32, lastWorked: "Dec 31 2025", rating: 4.9, rehire: "Preferred" },
  { id: "a-cc", name: "Charlie Carder",    role: "Prep Cook",       skill: "Allergen aware, knife skills",lastSupplier: "GoodShift",      tenure: "1 yr",   shifts: 41, lastWorked: "Mar 08 2026",  rating: 4.5, rehire: "Yes" },
  { id: "a-jg", name: "Jaxson Geidt",      role: "Prep Cook",       skill: "Pastry station",              lastSupplier: "GoodShift",      tenure: "5 mo",   shifts: 9,  lastWorked: "Jan 14 2026", rating: 3.4, rehire: "Conditional" },
];

const UNIT_LABEL = { medsurg: "Med-Surg", icu: "ICU", ed: "ED", peds: "Peds" };
const UNIT_CLASS = { medsurg: "",        icu: " tp-unit-pill--ic", ed: " tp-unit-pill--ed", peds: "" };

// ---------- Hours bar -------------------------------------------------
function TpHoursBar({ hours, target }) {
  const pct = Math.min(100, Math.round((hours / Math.max(1, target)) * 100));
  const cls = hours >= target ? "tp-hours-bar-fill--err" : (hours >= target * 0.85 ? "tp-hours-bar-fill--warn" : "");
  return (
    <div className="tp-hours-bar">
      <div className="tp-hours-bar-meta">
        <span>{hours} h</span>
        <span>cap {target}</span>
      </div>
      <div className="tp-hours-bar-track">
        <div className={"tp-hours-bar-fill " + cls} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

// ---------- Availability strip (per-diem) -----------------------------
const DOW = ["M","T","W","T","F","S","S"];
function TpAvail({ avail }) {
  return (
    <div className="tp-availability" aria-label="Availability this week">
      {DOW.map((d, i) => (
        <span
          key={i}
          className={"tp-avail-dot tp-avail-dot--" + (avail[i] || "off")}
          title={["Mon","Tue","Wed","Thu","Fri","Sat","Sun"][i] + " — " + (avail[i] || "off")}
        >{d}</span>
      ))}
    </div>
  );
}

// ---------- Offer button (with multi-select for parallel offers) -----
function TpOfferButton({ row, onOffer }) {
  return (
    <button
      type="button"
      className="vms-btn vms-btn--sm vms-btn--primary"
      onClick={(e) => { e.stopPropagation(); onOffer(row); }}
      disabled={!!row.suspended}
      title={row.suspended || "Send a shift offer"}
    >
      <Icon name="PersonPlus" size={14} />Offer
    </button>
  );
}

// ---------- Direct sourcing cascade callout --------------------------
function TpDirectSourcing({ activeTab }) {
  const tier = ({
    float:  "Float pool members get every Med-Surg / ICU / ED req before agencies see it.",
    perdiem:"Per-diem workers are offered next — hours-capped, short-call premium auto-applied.",
    alumni: "Alumni from last year's surge are offered before any new-hire requisition broadcast.",
  })[activeTab];
  return (
    <div className="tp-direct-sourcing">
      <div className="tp-ds-icon"><Icon name="Bolt" size={20} /></div>
      <div>
        <div className="tp-ds-title">Direct sourcing is on — shifts cascade through your pools first</div>
        <div className="tp-ds-body">{tier}</div>
        <div className="tp-ds-cascade">
          <span className="tp-ds-step"><span className="num">01</span>Float pool · 8 nurses</span>
          <span className="tp-ds-arrow"><Icon name="ChevronRight" size={14} /></span>
          <span className="tp-ds-step"><span className="num">02</span>Per-diem · 6 workers</span>
          <span className="tp-ds-arrow"><Icon name="ChevronRight" size={14} /></span>
          <span className="tp-ds-step"><span className="num">03</span>Alumni · 5 workers</span>
          <span className="tp-ds-arrow"><Icon name="ChevronRight" size={14} /></span>
          <span className="tp-ds-step"><span className="num">04</span>Tier 1 agencies</span>
          <span className="tp-ds-arrow"><Icon name="ChevronRight" size={14} /></span>
          <span className="tp-ds-step"><span className="num">05</span>All suppliers</span>
        </div>
      </div>
      <button type="button" className="vms-btn vms-btn--secondary vms-btn--sm" onClick={() => window.flexGoTo && window.flexGoTo({ page: "settings", sub: "distribution" })}>
        <Icon name="Settings" size={14} />Edit cascade
      </button>
    </div>
  );
}

// ---------- Page ------------------------------------------------------
function TalentPoolsPage({ reloadKey, onReload }) {
  const [tab, setTab] = useStateTp("float");
  const [filter, setFilter] = useStateTp("all");

  const onOffer = (row) => {
    showToast(`Shift offered to ${row.name}`, { kind: "success" });
  };

  // Filter the float pool by unit eligibility.
  const filteredFloat = useMemoTp(() => {
    if (filter === "all") return FLOAT_POOL;
    return FLOAT_POOL.filter((r) => (r.units || []).includes(filter));
  }, [filter]);

  return (
    <React.Fragment>
      <Omnibar icon="PersonSearch" title="Talent pools">
        <button type="button" className="iconbtn" onClick={onReload} aria-label="Reload" title="Reload">
          <Icon name="Refresh" size={18} />
        </button>
        <button type="button" className="vms-btn vms-btn--sm vms-btn--secondary" onClick={() => showToast("Pool export queued")}>
          <Icon name="FileDownload" size={14} />Export
        </button>
        <button type="button" className="vms-btn vms-btn--sm vms-btn--primary" onClick={() => showToast("Worker invite sent")}>
          <Icon name="PersonPlus" size={14} />Add to pool
        </button>
      </Omnibar>

      <div className="vms-page" key={reloadKey}>

        {/* KPIs */}
        <div className="vms-kpis">
          <div className="vms-kpi">
            <span className="vms-kpi-label">Float pool</span>
            <span className="vms-kpi-value tabular">{FLOAT_POOL.length}</span>
            <span className="vms-kpi-foot"><span>{FLOAT_POOL.filter((f) => f.hours < f.target).length} have hours available</span></span>
          </div>
          <div className="vms-kpi">
            <span className="vms-kpi-label">Per-diem pool</span>
            <span className="vms-kpi-value tabular">{PERDIEM_POOL.length}</span>
            <span className="vms-kpi-foot"><span>{PERDIEM_POOL.filter((p) => p.hours < p.maxHrs).length} below weekly cap</span></span>
          </div>
          <div className="vms-kpi">
            <span className="vms-kpi-label">Alumni</span>
            <span className="vms-kpi-value tabular">{ALUMNI_POOL.length}</span>
            <span className="vms-kpi-foot"><span>{ALUMNI_POOL.filter((a) => a.rehire === "Preferred").length} preferred · 0 do-not-rehire</span></span>
          </div>
          <div className="vms-kpi">
            <span className="vms-kpi-label">Direct fill rate · 30 d</span>
            <span className="vms-kpi-value tabular">68%</span>
            <span className="vms-kpi-foot"><span><span className="vms-kpi-delta vms-kpi-delta--up">+12pp</span>vs prior</span></span>
          </div>
          <div className="vms-kpi">
            <span className="vms-kpi-label">Avg time-to-offer</span>
            <span className="vms-kpi-value tabular">3:42</span>
            <span className="vms-kpi-foot"><span>minutes from open shift</span></span>
          </div>
        </div>

        <TpDirectSourcing activeTab={tab} />

        {/* Tabs */}
        <div className="fw-tabs" role="tablist">
          <button type="button" className="fw-tab" role="tab" aria-pressed={tab === "float"}   onClick={() => setTab("float")}>
            <Icon name="Users" size={16} />Float pool <span className="fw-tab-count">{FLOAT_POOL.length}</span>
          </button>
          <button type="button" className="fw-tab" role="tab" aria-pressed={tab === "perdiem"} onClick={() => setTab("perdiem")}>
            <Icon name="PersonClock" size={16} />Per-diem <span className="fw-tab-count">{PERDIEM_POOL.length}</span>
          </button>
          <button type="button" className="fw-tab" role="tab" aria-pressed={tab === "alumni"}  onClick={() => setTab("alumni")}>
            <Icon name="PersonArrow" size={16} />Alumni rehire <span className="fw-tab-count">{ALUMNI_POOL.length}</span>
          </button>
        </div>

        {tab === "float" && (
          <div className="vms-card" style={{ padding: 0 }}>
            <div className="vms-card-head" style={{ padding: "18px 20px 0" }}>
              <div>
                <h2 className="vms-card-title">Float pool · cross-facility nurses</h2>
                <p className="vms-card-sub">Internal Mercy nurses with cross-facility privileges. Offered before any agency req.</p>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                {[
                  { id: "all",     label: "All units" },
                  { id: "medsurg", label: "Med-Surg" },
                  { id: "icu",     label: "ICU" },
                  { id: "ed",      label: "ED" },
                  { id: "peds",    label: "Peds" },
                ].map((f) => (
                  <button key={f.id} type="button" className="fw-tab" aria-pressed={filter === f.id} onClick={() => setFilter(f.id)}>
                    {f.label}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table className="tp-table">
                <thead>
                  <tr>
                    <th>Nurse</th>
                    <th>Unit privileges</th>
                    <th>Facilities</th>
                    <th>Hours this week</th>
                    <th>Last worked</th>
                    <th>Seniority</th>
                    <th>Open offers</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredFloat.map((row) => {
                    const palette = _tpPaletteFor(row.id);
                    return (
                      <tr key={row.id} onClick={() => window.flexGoTo && window.flexGoTo({ page: "workforce", sub: "details", id: row.id })}>
                        <td>
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <span className="sup-avatar" style={{ background: palette.bg, color: palette.fg, width: 28, height: 28, fontSize: 10 }}>
                              {_tpInitialsFor(row.name)}
                            </span>
                            <div>
                              <div style={{ font: "var(--evr-body2-bold)" }}>{row.name}</div>
                              {row.suspended && (
                                <div style={{ font: "var(--evr-caption)", color: "var(--evr-content-status-error-default)" }}>
                                  Suspended · {row.suspended}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td>
                          <div className="tp-units">
                            {(row.units || []).map((u) => (
                              <span key={u} className={"tp-unit-pill" + (UNIT_CLASS[u] || "")}>{UNIT_LABEL[u] || u}</span>
                            ))}
                          </div>
                        </td>
                        <td>
                          <div style={{ font: "var(--evr-body2)" }}>{row.facilities[0]}</div>
                          {row.facilities.length > 1 && (
                            <div style={{ font: "var(--evr-caption)", color: "var(--evr-content-primary-lowemp)" }}>
                              +{row.facilities.length - 1} more
                            </div>
                          )}
                        </td>
                        <td><TpHoursBar hours={row.hours} target={row.target} /></td>
                        <td style={{ font: "var(--evr-caption)", color: "var(--evr-content-primary-default)" }}>{row.lastWorked}</td>
                        <td>{row.seniority}</td>
                        <td>{row.offers > 0 ? <span className="req-pill req-pill--informative">{row.offers} active</span> : <span style={{ color: "var(--evr-content-primary-lowemp)" }}>—</span>}</td>
                        <td><TpOfferButton row={row} onOffer={onOffer} /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === "perdiem" && (
          <div className="vms-card" style={{ padding: 0 }}>
            <div className="vms-card-head" style={{ padding: "18px 20px 0" }}>
              <div>
                <h2 className="vms-card-title">Per-diem pool · short-call workers</h2>
                <p className="vms-card-sub">Hours-capped per-diem workers. Short-call premium auto-applied. Cancellation policy: 4 h notice = full shift pay.</p>
              </div>
              <button type="button" className="vms-card-link" onClick={() => showToast("Cancellation policy editor")}>
                Edit cancellation policy
              </button>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table className="tp-table">
                <thead>
                  <tr>
                    <th>Worker</th>
                    <th>Role + unit</th>
                    <th>Home facility</th>
                    <th>Hours this week</th>
                    <th>Availability · Apr 20 – 26</th>
                    <th>Rate</th>
                    <th>Open offers</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {PERDIEM_POOL.map((row) => {
                    const palette = _tpPaletteFor(row.id);
                    return (
                      <tr key={row.id} onClick={() => window.flexGoTo && window.flexGoTo({ page: "workforce", sub: "details", id: row.id })}>
                        <td>
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <span className="sup-avatar" style={{ background: palette.bg, color: palette.fg, width: 28, height: 28, fontSize: 10 }}>
                              {_tpInitialsFor(row.name)}
                            </span>
                            <div style={{ font: "var(--evr-body2-bold)" }}>{row.name}</div>
                          </div>
                        </td>
                        <td>{row.role}</td>
                        <td>{row.facility}</td>
                        <td><TpHoursBar hours={row.hours} target={row.maxHrs} /></td>
                        <td><TpAvail avail={row.avail} /></td>
                        <td style={{ font: "var(--evr-body2-bold)" }}>{row.rate}</td>
                        <td>{row.offers > 0 ? <span className="req-pill req-pill--informative">{row.offers} active</span> : <span style={{ color: "var(--evr-content-primary-lowemp)" }}>—</span>}</td>
                        <td><TpOfferButton row={row} onOffer={onOffer} /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === "alumni" && (
          <div className="vms-card" style={{ padding: 0 }}>
            <div className="vms-card-head" style={{ padding: "18px 20px 0" }}>
              <div>
                <h2 className="vms-card-title">Alumni · re-hire pool</h2>
                <p className="vms-card-sub">Workers from past shifts marked re-hireable. Offered before any new-hire broadcast.</p>
              </div>
              <button type="button" className="vms-card-link" onClick={() => showToast("Re-hire policy editor")}>
                Re-hire policy
              </button>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table className="tp-table">
                <thead>
                  <tr>
                    <th>Worker</th>
                    <th>Role</th>
                    <th>Skill notes</th>
                    <th>Tenure</th>
                    <th>Shifts</th>
                    <th>Last worked</th>
                    <th>Rating</th>
                    <th>Re-hire</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {ALUMNI_POOL.map((row) => {
                    const palette = _tpPaletteFor(row.id);
                    return (
                      <tr key={row.id} onClick={() => window.flexGoTo && window.flexGoTo({ page: "workforce", sub: "details", id: row.id })}>
                        <td>
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <span className="sup-avatar" style={{ background: palette.bg, color: palette.fg, width: 28, height: 28, fontSize: 10 }}>
                              {_tpInitialsFor(row.name)}
                            </span>
                            <div>
                              <div style={{ font: "var(--evr-body2-bold)" }}>{row.name}</div>
                              <div style={{ font: "var(--evr-caption)", color: "var(--evr-content-primary-lowemp)" }}>
                                Last via {row.lastSupplier}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td>{row.role}</td>
                        <td style={{ font: "var(--evr-caption)", color: "var(--evr-content-primary-default)" }}>{row.skill}</td>
                        <td>{row.tenure}</td>
                        <td className="tabular">{row.shifts}</td>
                        <td>{row.lastWorked}</td>
                        <td className="tabular">★ {row.rating.toFixed(1)}</td>
                        <td>
                          <span className={
                            "req-pill " +
                            (row.rehire === "Preferred" ? "req-pill--success" :
                             row.rehire === "Yes" ? "req-pill--informative" : "req-pill--warning")
                          }>{row.rehire}</span>
                        </td>
                        <td><TpOfferButton row={row} onOffer={onOffer} /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* v0.97 — IC alumni sub-section. Surfaces past contractors
                (pool === "Contractor" with status === "Alumni" OR with
                an Expired agreement) as a re-engage pool. One-click
                Re-engage opens the Add Contractor wizard via the same
                interaction the rest of the surface uses. Only renders
                when the contractors feature flag is on. */}
            {(window.getFeatureFlag && window.getFeatureFlag("contractors") && window.getContractorWorkers) && (() => {
              const all = window.getContractorWorkers() || [];
              // Treat as alumni: explicit "Alumni" status OR an expired
              // active agreement OR tenure ≥ 24 mo (synthetic — surfaces
              // the longest-tenured contractors as re-engageable veterans).
              const alumni = all.filter((c) => c.status === "Alumni" || (c.agreement && c.agreement.status === "Expired") || (c.tenureMos || 0) >= 24);
              if (alumni.length === 0) return null;
              return (
                <div style={{ borderTop: "1px solid var(--evr-border-decorative-lowemp)", padding: "18px 20px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
                    <div>
                      <h2 className="vms-card-title">Contractor alumni · re-engage pool</h2>
                      <p className="vms-card-sub">Past independent contractors. One-click <i>Re-engage</i> pre-fills the Add Contractor wizard with identity, tax form, and banking — onboarding collapses to a single review step.</p>
                    </div>
                    <span className="req-pill req-pill--informative">{alumni.length} available</span>
                  </div>
                  <div style={{ overflowX: "auto" }}>
                    <table className="tp-table">
                      <thead>
                        <tr>
                          <th>Contractor</th>
                          <th>Country</th>
                          <th>Last role</th>
                          <th>Tenure</th>
                          <th>YTD paid</th>
                          <th>Last engagement</th>
                          <th>Risk</th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {alumni.map((c) => {
                          const palette = _tpPaletteFor(c.id);
                          return (
                            <tr key={c.id} onClick={() => window.flexGoTo && window.flexGoTo({ page: "workforce", sub: "details", id: c.id })}>
                              <td>
                                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                  <span className="sup-avatar" style={{ background: palette.bg, color: palette.fg, width: 28, height: 28, fontSize: 10 }}>
                                    {_tpInitialsFor(c.name)}
                                  </span>
                                  <div>
                                    <div style={{ font: "var(--evr-body2-bold)" }}>{c.name}</div>
                                    <div style={{ font: "var(--evr-caption)", color: "var(--evr-content-primary-lowemp)" }}>{c.legalName || c.entity}</div>
                                  </div>
                                </div>
                              </td>
                              <td>
                                <span className={`fi fi-${c.flag}`} style={{ width: 18, height: 14, display: "inline-block", marginRight: 6, boxShadow: "0 0 0 1px var(--evr-border-decorative-lowemp)" }} />
                                {c.countryName}
                              </td>
                              <td>{(c.jobs && c.jobs[0]) || "—"}</td>
                              <td>{c.tenureMos} mo</td>
                              <td className="tabular">{window.fmtContractorMoney ? window.fmtContractorMoney(c.ytdPaid, c.currency) : `$${c.ytdPaid}`}</td>
                              <td>{(c.agreement && c.agreement.expires) || "—"}</td>
                              <td>
                                <span className={"req-pill " + (c.riskScore >= 60 ? "req-pill--warning" : "req-pill--success")}>{c.riskScore}/100</span>
                              </td>
                              <td>
                                <button
                                  type="button"
                                  className="vms-btn vms-btn--sm vms-btn--secondary"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (window.Interactions && window.Interactions.emit) {
                                      window.Interactions.emit("addContractor", { prefillFromId: c.id });
                                    }
                                    showToast(`Re-engage drafted for ${c.name} — review and invite`, { kind: "success" });
                                  }}
                                >
                                  <Icon name="Refresh" size={12} />Re-engage
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })()}
          </div>
        )}

      </div>
    </React.Fragment>
  );
}

Object.assign(window, { TalentPoolsPage });
