// =====================================================================
// Flex Work — Rosters
//
// Event roster builder for hospitality programs. A roster is a single
// banquet event with multiple positions, each with a head count, skill
// requirements, primary lineup, and a standby lane. Forks from the
// existing Requisitions / Schedule shape:
//   · A roster maps 1-to-1 to a Booking
//   · Each position fans out to N shift instances on Schedule
//   · Standby workers clock in only if a primary no-shows
// =====================================================================

const { useState: useStateRs, useMemo: useMemoRs } = React;

const _rsPaletteFor = (id) => (window.paletteFor || ((s) => ({ bg: "#A0AEC0", fg: "#1F1F23" })))(id);
const _rsInitialsFor = (n) => (window.initialsFor || ((s) => (s || "").split(/\s+/).map((w) => w[0]).slice(0,2).join("").toUpperCase()))(n);

// ---------- Mock events ------------------------------------------------
// Demo today = Apr 23 2026 (Thu). Aurora Resort Way — 4 upcoming events.
const ROSTER_EVENTS = [
  {
    id: "r-001",
    name: "Patel × Khan wedding · grand ballroom",
    property: "Aurora Resort Way",
    beo:    "BEO #4187-A",
    date:   { mo: "APR", day: 25, weekday: "Saturday" },
    setup:  "3:00 PM",
    service:"6:00 PM – 11:30 PM",
    breakdown: "11:30 PM – 1:00 AM",
    guests: 240,
    style:  "Plated · 4 course",
    fill:   { confirmed: 12, total: 14 },
    captain:"Kierra Stanton",
    positions: [
      { id: "p-1", role: "Banquet Server",  count: 8, skills: ["plated", "fine-dining", "TIPS"], assigned: [
        { id: "w-pr", name: "Priya Ramesh",  status: "ok",      meta: "GoodShift · TIPS to Sep" },
        { id: "w-mh", name: "Makenna Herwitz",status: "ok",     meta: "Alumni · 32 shifts" },
        { id: "w-ja", name: "Jakob Aminoff", status: "ok",      meta: "Talent Hub · plated" },
        { id: "w-ml", name: "Maya Lin",      status: "ok",      meta: "GoodShift" },
        { id: "w-ks", name: "Kierra Stanton",status: "ok",      meta: "Captain · ProHire" },
        { id: "w-ss", name: "Sami Soto",     status: "ok",      meta: "Skill Scouts" },
        { id: "w-cc", name: "Charlie Carder",status: "pending", meta: "Pending acceptance · 8 min" },
        { id: "w-jc", name: "Jamal Carter",  status: "pending", meta: "Pending acceptance · 2 min" },
      ]},
      { id: "p-2", role: "Bartender",       count: 4, skills: ["bar", "TIPS"], assigned: [
        { id: "w-ja2",name: "Jakob Aminoff (bar)",status: "ok", meta: "Talent Hub · TIPS" },
        { id: "w-ks2",name: "Aurelio Mendez",status: "ok",      meta: "GoodShift · sommelier" },
        { id: "w-tk", name: "Terry Donin",   status: "pending", meta: "Did not show last event · backup ready" },
        { id: "open-2", open: true },
      ]},
      { id: "p-3", role: "Banquet Chef",    count: 2, skills: ["chef", "allergens"], assigned: [
        { id: "w-ja3",name: "Chef Ana Ruiz", status: "ok",      meta: "ProHire · chef-line" },
        { id: "w-cc2",name: "Charlie Carder",status: "ok",      meta: "GoodShift · prep + plating" },
      ]},
      { id: "p-4", role: "Captain",          count: 1, skills: ["captain", "TIPS"], assigned: [
        { id: "w-ks3",name: "Kierra Stanton",status: "ok",      meta: "ProHire · captain-grade" },
      ]},
    ],
    standby: [
      { id: "s-1", name: "Marcus Webb",     role: "Banquet Server", status: "standby", meta: "GoodShift · TIPS · short-call $32/h" },
      { id: "s-2", name: "Ada Watts",       role: "Bartender",      status: "standby", meta: "Staffwise · short-call $36/h" },
      { id: "s-3", name: "Jaxson Geidt",    role: "Banquet Server", status: "standby", meta: "GoodShift · short-call $28/h" },
    ],
    tipPool: {
      basis: "Hours-worked × position weight",
      weights: { server: 1.0, bartender: 1.2, captain: 1.5, chef: 1.4 },
      cap: "$420 estimated per server",
    },
    briefing: [
      { label: "Dress code", body: "Black bistro · white shirt · black bow tie. Black non-slip shoes. Hair tied back." },
      { label: "VIPs",        body: "Table 3 — bride's family · vegan + 2 nut-allergy. Table 7 — pre-paid champagne." },
      { label: "Allergens",   body: "Three guests flagged: tree nuts (severe), shellfish, gluten. EpiPen station at bar." },
      { label: "Timing",      body: "Cocktails 6 PM. First course 7:15 PM. Cake cut 9:45 PM. Last call 11:00 PM." },
    ],
  },
  {
    id: "r-002",
    name: "Aurora corporate retreat · welcome dinner",
    property: "Aurora Resort Way",
    beo:    "BEO #4191-A",
    date:   { mo: "APR", day: 24, weekday: "Friday" },
    setup:  "4:30 PM",
    service:"6:30 PM – 9:30 PM",
    breakdown: "9:30 PM – 10:30 PM",
    guests: 120,
    style:  "Buffet · stations",
    fill:   { confirmed: 9, total: 9 },
    captain:"Jakob Aminoff",
    positions: [],
    standby: [],
  },
  {
    id: "r-003",
    name: "Sutton fundraiser gala · pavilion",
    property: "Aurora Beach Club",
    beo:    "BEO #4202-A",
    date:   { mo: "APR", day: 26, weekday: "Sunday" },
    setup:  "2:00 PM",
    service:"5:00 PM – 11:00 PM",
    breakdown: "11:00 PM – 12:30 AM",
    guests: 320,
    style:  "Plated · 5 course + after-party",
    fill:   { confirmed: 14, total: 20 },
    captain:"unassigned",
    positions: [],
    standby: [],
  },
  {
    id: "r-004",
    name: "Bluestone partners breakfast",
    property: "Aurora Midtown",
    beo:    "BEO #4214-A",
    date:   { mo: "MAY", day:  4, weekday: "Monday" },
    setup:  "6:00 AM",
    service:"7:30 AM – 10:00 AM",
    breakdown: "10:00 AM – 10:45 AM",
    guests: 48,
    style:  "Buffet · breakfast service",
    fill:   { confirmed: 0, total: 5 },
    captain:"unassigned",
    positions: [],
    standby: [],
  },
];

function _rsFillLevel(f) {
  if (f.total === 0) return "err";
  const pct = f.confirmed / f.total;
  if (pct >= 1) return "ok";
  if (pct >= 0.75) return "warn";
  return "err";
}

// ---------- Event card (list) -----------------------------------------
function RsEventCard({ ev, onOpen }) {
  const level = _rsFillLevel(ev.fill);
  return (
    <article className="rs-card" onClick={() => onOpen(ev.id)} role="button" tabIndex={0}>
      <div className="rs-card-date">
        <div className="mo">{ev.date.mo}</div>
        <span className="day">{ev.date.day}</span>
      </div>
      <div>
        <div className="rs-card-title">{ev.name}</div>
        <div className="rs-card-meta">
          <b>{ev.date.weekday}</b>
          <span>·</span>
          <span>{ev.service}</span>
          <span>·</span>
          <span>{ev.guests} guests</span>
          <span>·</span>
          <span>{ev.property}</span>
        </div>
        <div className="rs-card-meta" style={{ marginTop: 4 }}>
          <span style={{ font: "var(--evr-caption)", color: "var(--evr-content-primary-lowemp)" }}>{ev.beo}</span>
          <span>·</span>
          <span style={{ font: "var(--evr-caption)" }}>{ev.style}</span>
        </div>
      </div>
      <div className="rs-fill">
        <div className="rs-fill-stat">{ev.fill.confirmed}/{ev.fill.total} <em style={{ font: "var(--evr-caption)", fontStyle: "normal", color: "var(--evr-content-primary-lowemp)" }}>filled</em></div>
        <div className="rs-fill-bar">
          <div
            className={"rs-fill-bar-fill " + (level === "warn" ? "rs-fill-bar-fill--warn" : level === "err" ? "rs-fill-bar-fill--err" : "")}
            style={{ width: `${Math.min(100, Math.round((ev.fill.confirmed / Math.max(1, ev.fill.total)) * 100))}%` }}
          />
        </div>
      </div>
    </article>
  );
}

// ---------- Position card --------------------------------------------
function RsPositionCard({ pos, onPromoteStandby }) {
  const skillClass = (s) => ({
    plated: "", "fine-dining": "", TIPS: "", bar: "rs-skill--bar", chef: "rs-skill--chef", captain: "rs-skill--captain", allergens: "",
  })[s] || "";

  const filled = pos.assigned.filter((a) => !a.open).length;
  return (
    <div className="rs-pos">
      <div className="rs-pos-head">
        <span className="rs-pos-name">{pos.role}</span>
        <span className="rs-pos-count tabular">{filled}<em>/{pos.count}</em></span>
      </div>
      <div className="rs-pos-skills">
        {(pos.skills || []).map((s) => <span key={s} className={"rs-skill " + skillClass(s)}>{s}</span>)}
      </div>
      <div className="rs-assigned">
        {pos.assigned.map((a) => {
          if (a.open) {
            return (
              <div key={a.id} className="rs-assigned-row rs-assigned-row--open">
                <span>Open slot · broadcast to suppliers</span>
              </div>
            );
          }
          const pal = _rsPaletteFor(a.id);
          return (
            <div key={a.id} className="rs-assigned-row">
              <span className="sup-avatar" style={{ background: pal.bg, color: pal.fg, width: 22, height: 22, fontSize: 9 }}>
                {_rsInitialsFor(a.name)}
              </span>
              <div>
                <b>{a.name}</b>
                <span className="meta">{a.meta}</span>
              </div>
              <span className={"rs-status-pill rs-status-pill--" + (a.status === "ok" ? "ok" : a.status === "pending" ? "pending" : "standby")}>
                {a.status === "ok" ? "Confirmed" : a.status === "pending" ? "Pending" : "Standby"}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------- Event detail view ----------------------------------------
function RsEventDetail({ ev, onBack }) {
  const [briefingOpen, setBriefingOpen] = useStateRs(false);

  const onPromoteStandby = (sb) => {
    showToast(`Promoting ${sb.name} from standby to primary — push notification sent`, { kind: "success" });
  };

  return (
    <React.Fragment>
      <Omnibar icon="Users" title={ev.name}>
        <button type="button" className="iconbtn" onClick={onBack} aria-label="Back to rosters" title="Back">
          <Icon name="ArrowLeft" size={18} />
        </button>
        <button type="button" className="vms-btn vms-btn--sm vms-btn--secondary" onClick={() => showToast("Roster rebuild — same crew as last event")}>
          <Icon name="Refresh" size={14} />Repeat
        </button>
        <button type="button" className="vms-btn vms-btn--sm vms-btn--secondary" onClick={() => setBriefingOpen(true)}>
          <Icon name="Phone" size={14} />Preview briefing
        </button>
        <button type="button" className="vms-btn vms-btn--sm vms-btn--primary" onClick={() => showToast("Roster locked — offers fanning out to assigned workers")}>
          <Icon name="Check" size={14} />Lock roster
        </button>
      </Omnibar>

      <div className="vms-page">

        {/* Hero with BEO data */}
        <article className="rs-detail-hero">
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
            <div>
              <span style={{ font: "var(--evr-caption)", fontWeight: "var(--evr-fw-bold)", textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--evr-orange-600)" }}>
                {ev.beo} · {ev.property}
              </span>
              <h2>{ev.name}</h2>
              <p style={{ font: "var(--evr-body2)", color: "var(--evr-content-primary-default)", marginTop: 8 }}>
                <b>{ev.date.weekday}</b> · {ev.service} · {ev.guests} guests · {ev.style}
              </p>
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
              <span className="rs-fill-stat" style={{ fontSize: 28 }}>{ev.fill.confirmed} / {ev.fill.total}</span>
              <span style={{ font: "var(--evr-caption)", color: "var(--evr-content-primary-lowemp)" }}>positions confirmed</span>
              <div className="rs-fill-bar" style={{ width: 180 }}>
                <div
                  className={"rs-fill-bar-fill " + (_rsFillLevel(ev.fill) === "warn" ? "rs-fill-bar-fill--warn" : "")}
                  style={{ width: `${Math.round((ev.fill.confirmed / Math.max(1, ev.fill.total)) * 100)}%` }}
                />
              </div>
            </div>
          </div>

          <div className="rs-beo">
            <div className="rs-beo-cell">
              <div className="rs-beo-label">Setup</div>
              <div className="rs-beo-value">{ev.setup}</div>
            </div>
            <div className="rs-beo-cell">
              <div className="rs-beo-label">Service</div>
              <div className="rs-beo-value">{ev.service}</div>
            </div>
            <div className="rs-beo-cell">
              <div className="rs-beo-label">Breakdown</div>
              <div className="rs-beo-value">{ev.breakdown}</div>
            </div>
            <div className="rs-beo-cell">
              <div className="rs-beo-label">Guests</div>
              <div className="rs-beo-value">{ev.guests}</div>
            </div>
            <div className="rs-beo-cell">
              <div className="rs-beo-label">Captain</div>
              <div className="rs-beo-value" style={{ textTransform: ev.captain === "unassigned" ? "uppercase" : "none", color: ev.captain === "unassigned" ? "var(--evr-content-status-warning-default)" : undefined, fontSize: 13 }}>
                {ev.captain}
              </div>
            </div>
            <div className="rs-beo-cell">
              <div className="rs-beo-label">Style</div>
              <div className="rs-beo-value" style={{ fontSize: 13 }}>{ev.style}</div>
            </div>
          </div>
        </article>

        {/* Positions */}
        <section>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 14 }}>
            <h3 style={{ margin: 0, fontFamily: "var(--evr-font-display)", fontWeight: "var(--evr-fw-demibold)", fontSize: 18, color: "var(--evr-content-primary-highemp)" }}>
              Positions
            </h3>
            <button type="button" className="vms-btn vms-btn--secondary vms-btn--sm" onClick={() => showToast("Add position dialog")}>
              <Icon name="AddCircle" size={14} />Add position
            </button>
          </div>
          <div className="rs-positions">
            {ev.positions.map((p) => <RsPositionCard key={p.id} pos={p} onPromoteStandby={onPromoteStandby} />)}
          </div>
        </section>

        {/* Standby lane */}
        {ev.standby && ev.standby.length > 0 && (
          <section className="vms-card">
            <div className="vms-card-head">
              <div>
                <h2 className="vms-card-title">Standby lane · {ev.standby.length} workers on-call</h2>
                <p className="vms-card-sub">Clocks in only if a primary no-shows. Short-call premium baked into the rate.</p>
              </div>
              <button type="button" className="vms-card-link" onClick={() => showToast("Standby pool editor")}>
                Manage standby pool
              </button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 10 }}>
              {ev.standby.map((sb) => {
                const pal = _rsPaletteFor(sb.id);
                return (
                  <div key={sb.id} className="rs-assigned-row rs-assigned-row--standby">
                    <span className="sup-avatar" style={{ background: pal.bg, color: pal.fg, width: 24, height: 24, fontSize: 9 }}>
                      {_rsInitialsFor(sb.name)}
                    </span>
                    <div>
                      <b>{sb.name}</b>
                      <span className="meta">{sb.role} · {sb.meta}</span>
                    </div>
                    <button type="button" className="vms-btn vms-btn--sm vms-btn--secondary" onClick={() => onPromoteStandby(sb)}>
                      Promote
                    </button>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Tip pool + briefing preview side-by-side */}
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", gap: 20, alignItems: "start" }}>
          <section className="vms-card">
            <div className="vms-card-head">
              <div>
                <h2 className="vms-card-title">Tip pool · {ev.tipPool ? "configured" : "—"}</h2>
                <p className="vms-card-sub">Allocated 24 h after event close; surfaced to each worker on the mobile app.</p>
              </div>
              <button type="button" className="vms-card-link" onClick={() => showToast("Tip pool editor")}>
                Edit
              </button>
            </div>
            {ev.tipPool ? (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <div>
                  <div style={{ font: "var(--evr-caption)", fontWeight: "var(--evr-fw-bold)", textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--evr-content-primary-lowemp)" }}>Basis</div>
                  <div style={{ font: "var(--evr-body2)", marginTop: 4 }}>{ev.tipPool.basis}</div>
                  <div style={{ font: "var(--evr-caption)", color: "var(--evr-content-primary-lowemp)", marginTop: 10 }}>Estimated server payout</div>
                  <div style={{ font: "var(--evr-body1-bold)", fontFamily: "var(--evr-font-display)", color: "var(--evr-content-primary-highemp)" }}>{ev.tipPool.cap}</div>
                </div>
                <div>
                  <div style={{ font: "var(--evr-caption)", fontWeight: "var(--evr-fw-bold)", textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--evr-content-primary-lowemp)" }}>Position weights</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
                    {Object.entries(ev.tipPool.weights).map(([r, w]) => (
                      <span key={r} className="rs-skill" style={{ background: "var(--evr-neutral-95)", color: "var(--evr-content-primary-highemp)" }}>
                        {r} × {w.toFixed(1)}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <p style={{ color: "var(--evr-content-primary-lowemp)" }}>No tip pool configured for this event.</p>
            )}
          </section>

          <section style={{ display: briefingOpen ? "block" : "none" }}>
            <div className="rs-phone">
              <div className="rs-phone-screen">
                <span className="rs-phone-eyebrow">Pre-shift briefing</span>
                <h4>{ev.name}</h4>
                <div style={{ font: "var(--evr-caption)", color: "var(--evr-content-primary-lowemp)" }}>
                  Arrival 5:30 PM · gather at staff entrance
                </div>
                <div style={{ marginTop: 14 }}>
                  {ev.briefing && ev.briefing.map((b, i) => (
                    <div key={i} className="rs-phone-row">
                      <span style={{ marginTop: 4 }}>
                        <Icon name={i === 0 ? "PersonClock" : i === 1 ? "PersonHeart" : i === 2 ? "Alert" : "Calendar"} size={14} />
                      </span>
                      <div>
                        <b>{b.label}</b>
                        <span className="sub">{b.body}</span>
                      </div>
                    </div>
                  ))}
                </div>
                <button type="button" className="rs-phone-cta" onClick={() => { showToast("Worker acknowledged briefing"); setBriefingOpen(false); }}>
                  I&rsquo;ve read this
                </button>
              </div>
            </div>
          </section>
        </div>

      </div>
    </React.Fragment>
  );
}

// ---------- Page ------------------------------------------------------
function RostersPage({ reloadKey, onReload }) {
  const [selectedId, setSelectedId] = useStateRs(null);
  const [filter, setFilter] = useStateRs("upcoming");

  if (selectedId) {
    const ev = ROSTER_EVENTS.find((e) => e.id === selectedId);
    if (ev) return <RsEventDetail ev={ev} onBack={() => setSelectedId(null)} />;
  }

  const visible = ROSTER_EVENTS; // future: filter

  return (
    <React.Fragment>
      <Omnibar icon="Users" title="Rosters">
        <button type="button" className="iconbtn" onClick={onReload} aria-label="Reload" title="Reload">
          <Icon name="Refresh" size={18} />
        </button>
        <button type="button" className="vms-btn vms-btn--sm vms-btn--secondary" onClick={() => showToast("BEO import — choose a file")}>
          <Icon name="FileUpload" size={14} />Import BEO
        </button>
        <button type="button" className="vms-btn vms-btn--sm vms-btn--primary" onClick={() => showToast("New roster wizard")}>
          <Icon name="AddCircle" size={14} />New roster
        </button>
      </Omnibar>

      <div className="vms-page" key={reloadKey}>

        {/* v0.77 spec §10 · roster timelines split by Work Type in
            Phase 4 so a buyer sees shift-fills + assignment allocations
            side-by-side. Banner hidden at flag-off. */}
        {window.V77InfoBanner ? (
          <window.V77InfoBanner
            icon="Information"
            title="Roster timelines will split by Work Type."
          >
            Phase 4 lets a roster show shift-fills and assignment allocations side-by-side so coverage gaps surface across both work types in one timeline.
          </window.V77InfoBanner>
        ) : null}

        {/* KPIs */}
        <div className="vms-kpis">
          <div className="vms-kpi">
            <span className="vms-kpi-label">Events this week</span>
            <span className="vms-kpi-value tabular">18</span>
            <span className="vms-kpi-foot"><span>4 properties</span></span>
          </div>
          <div className="vms-kpi vms-kpi--alert">
            <span className="vms-kpi-label">Open positions</span>
            <span className="vms-kpi-value tabular">11</span>
            <span className="vms-kpi-foot"><span>2 unconfirmed in &lt; 24 h</span></span>
          </div>
          <div className="vms-kpi">
            <span className="vms-kpi-label">Standby coverage</span>
            <span className="vms-kpi-value tabular">86%</span>
            <span className="vms-kpi-foot"><span>events with ≥ 3 standby</span></span>
          </div>
          <div className="vms-kpi">
            <span className="vms-kpi-label">Repeat-event rebuild</span>
            <span className="vms-kpi-value tabular">12</span>
            <span className="vms-kpi-foot"><span>same crew as prior · 30 d</span></span>
          </div>
          <div className="vms-kpi">
            <span className="vms-kpi-label">Avg time-to-fill</span>
            <span className="vms-kpi-value tabular">17 m</span>
            <span className="vms-kpi-foot"><span><span className="vms-kpi-delta vms-kpi-delta--good-down">−9m</span>vs prior</span></span>
          </div>
        </div>

        {/* Filters */}
        <div className="fw-tabs">
          {[
            { id: "upcoming", label: "Upcoming",     count: ROSTER_EVENTS.length },
            { id: "today",    label: "Today",         count: 0 },
            { id: "atrisk",   label: "At risk",       count: 2 },
            { id: "complete", label: "Completed · 7 d", count: 14 },
          ].map((f) => (
            <button key={f.id} type="button" className="fw-tab" aria-pressed={filter === f.id} onClick={() => setFilter(f.id)}>
              {f.label} <span className="fw-tab-count">{f.count}</span>
            </button>
          ))}
        </div>

        {/* List */}
        <div className="rs-list">
          {visible.map((ev) => (
            <RsEventCard key={ev.id} ev={ev} onOpen={setSelectedId} />
          ))}
        </div>

      </div>
    </React.Fragment>
  );
}

Object.assign(window, { RostersPage });
