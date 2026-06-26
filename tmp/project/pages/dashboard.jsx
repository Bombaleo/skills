// =====================================================================
// Flex Work — Dashboard
// Mock-aligned: blue gradient hero with greeting + overlapping intro
// card; 2-column grid (Upcoming shifts + Recent activity on the left,
// Calendar + "For you today" on the right).
//
// Role-aware:
//   · Admin   → full dataset across all locations.
//   · Manager → scoped to the locations the manager has access to,
//               picked from the location selector in AppNav.
// =====================================================================

const { useState: useStateDash, useMemo: useMemoDash, useEffect: useEffectDash } = React;

// ---------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------

function _greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

// "Today" tracks the shared flexToday() — anchors the calendar, the
// hero date label, and the at-risk math to a single wall-clock.
const DEMO_TODAY = window.flexToday ? window.flexToday() : new Date(2026, 4, 19);

function _todayLabel() {
  // Render in EDT by default so the strip stays stable across timezones.
  if (window.flexTodayLabel) {
    return window.flexTodayLabel({ weekday: "long", month: "long", day: "numeric", year: "numeric" });
  }
  return DEMO_TODAY.toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric", year: "numeric"
  });
}

// Parse a TRIAGE.when into a sortable hour offset from now.
function _whenSort(t) {
  return t && typeof t.whenSort === "number" ? t.whenSort : 999;
}

// Pick a date tile (e.g. "Apr 24") from a TRIAGE row.
function _dateTile(t) {
  // when looks like "Starts in 2 h" → today, "Tomorrow · 6:00 AM" → +1d, etc.
  const base = new Date(DEMO_TODAY);
  if (/^Starts/i.test(t.when)) {/* today */} else
  if (/^Tomorrow/i.test(t.when)) {base.setDate(base.getDate() + 1);} else
  if (/^Thu/i.test(t.when)) {base.setDate(base.getDate() + 1);} // next Thu reads as +1 in demo
  else {base.setDate(base.getDate() + 2);}
  const mo = base.toLocaleDateString(undefined, { month: "short" });
  return { mo, day: base.getDate() };
}

// Build a 6-week month grid for the calendar.
function _monthGrid(year, month /* 0-indexed */) {
  const first = new Date(year, month, 1);
  const startDow = first.getDay(); // 0..6 (Sun)
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrev = new Date(year, month, 0).getDate();
  const cells = [];
  // leading days from prev month
  for (let i = startDow - 1; i >= 0; i--) {
    cells.push({ day: daysInPrev - i, out: true, key: `p-${i}` });
  }
  // this month
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ day: d, out: false, key: `c-${d}` });
  }
  // trailing — pad to a whole number of weeks (5 rows when the month fits, 6 otherwise)
  const rows = Math.ceil((startDow + daysInMonth) / 7);
  const target = rows * 7;
  while (cells.length < target) {
    cells.push({ day: cells.length - (startDow + daysInMonth) + 1, out: true, key: `n-${cells.length}` });
  }
  return cells;
}

// Days in the current month that have at least one upcoming or in-progress
// booking (used to render the activity pips in the calendar). Reads the
// shared today so the month always lines up with the rest of the app.
function _scheduledDays() {
  const set = new Set();
  const moAbbr = DEMO_TODAY.toLocaleDateString("en-US", { month: "short" });
  const reqs = window.REQUISITIONS || [];
  const re = new RegExp(moAbbr + "\\s+(\\d+)", "g");
  reqs.forEach((r) => {
    (r.dates || []).forEach((d) => {
      const m = String(d).match(re);
      if (!m) return;
      m.forEach((s) => {
        const num = parseInt(s.replace(new RegExp(moAbbr + "\\s+"), ""), 10);
        if (Number.isFinite(num)) set.add(num);
      });
    });
  });
  return set;
}

// ---------------------------------------------------------------------
// Role / location scoping
// ---------------------------------------------------------------------
// Map a TRIAGE location name to its underlying location id. The triage
// data carries free-text location names, so we match by case-insensitive
// substring against the LOCATIONS list (loaded by locations.jsx).

function _findLocId(locName) {
  const locs = window.LOCATIONS || [];
  const hit = locs.find((l) => l.name && locName && l.name.toLowerCase() === locName.toLowerCase());
  if (hit) return hit.id;
  const sub = locs.find((l) => l.name && locName && locName.toLowerCase().includes(l.name.toLowerCase()));
  return sub ? sub.id : null;
}

// Scope items[] (any object with a `.location` string) to the active
// location filter. `locationIds` = null/empty → no filtering (Admin or
// "All locations").
function _scopeByLocation(items, locationIds) {
  if (!locationIds || locationIds.length === 0) return items;
  const set = new Set(locationIds);
  return items.filter((it) => {
    const id = _findLocId(it.location);
    return id && set.has(id);
  });
}

// ---------------------------------------------------------------------
// Hero band + intro card
// ---------------------------------------------------------------------

function DashHero({ name, role, scopedLabel, onPrimary }) {
  // Real counts pulled from the same data the rest of the page reads —
  // keeps the greeting in lockstep with the Inbox / At-risk numbers.
  const approvals = window.APPROVALS || [];
  const tsAwaiting = approvals.filter((a) => a.kind === "ts").length;
  const invAwaiting = approvals.filter((a) => a.kind === "inv").length;
  const atRiskCount = (window.TRIAGE || []).filter((t) => t.confirmed < t.needed).length;
  // Decorative wave curves layered behind the greeting (matches Everest blue brand).
  return (
    <div className="dash-hero" style={{ padding: "72px 0px 24px" }}>
      <div className="dash-hero-inner">
        <h1 className="dash-hero-greeting">
          {_greeting() + ", "}{(name || "").split(" ")[0] || "Amy"}
        </h1>
      </div>
    </div>);

}

function DashIntro({ onPrimary }) {
  return (
    <div className="dash-intro">
      <div className="dash-intro-body">
        <h2 className="dash-intro-title">Dayforce Flex Work</h2>
        <p className="dash-intro-sub">Manage your contingent labor, suppliers, and spend.</p>
      </div>
      <button type="button" className="dash-btn" onClick={onPrimary}>
        <Icon name="AddCircle" size={18} />
        Create requisition
      </button>
    </div>);

}

// ---------------------------------------------------------------------
// Upcoming shifts (featured + list)
// ---------------------------------------------------------------------

function DashFeaturedShift({ shift, onOpen }) {
  if (!shift) return null;
  const pct = Math.max(0, Math.min(100, Math.round(shift.confirmed / shift.needed * 100)));
  return (
    <div className="dash-feat">
      <div className="dash-feat-map" aria-label={`Map · ${shift.location}`}>
        <span className="dash-feat-badge">
          <span className="ic-dot" aria-hidden="true" />
          {shift.when}
        </span>
        <img className="dash-feat-pin" src="assets/pin-job-site.svg" alt="" aria-hidden="true" />
      </div>
      <div className="dash-feat-body">
        <h3 className="dash-feat-title">{shift.title}</h3>
        <div className="dash-feat-meta">
          <span className="dash-feat-meta-row">
            <span className="ic"><Icon name="Location" size={16} /></span>
            <span>{shift.location}</span>
          </span>
          <span className="dash-feat-meta-row">
            <span className="ic"><Icon name="Hourglass" size={16} /></span>
            <span className="tabular">{shift.tag}</span>
          </span>
          <span className="dash-feat-meta-row">
            <span className="ic"><Icon name="PersonClock" size={16} /></span>
            <span className="tabular">{shift.confirmed} / {shift.needed} confirmed · {pct}%</span>
          </span>
        </div>
        <div className="dash-feat-actions">
          <button type="button" className="dash-btn" onClick={onOpen}>Open

          </button>
        </div>
      </div>
    </div>);

}

function DashShiftRow({ shift, onOpen }) {
  const tile = _dateTile(shift);
  return (
    <button type="button" className="dash-shift" onClick={onOpen}>
      <span className="dash-date-tile" aria-hidden="true">
        <span className="dash-date-tile-mo">{tile.mo}</span>
        <span className="dash-date-tile-day tabular">{tile.day}</span>
      </span>
      <span className="dash-shift-main">
        <span className="dash-shift-title">{shift.title}</span>
        <span className="dash-shift-sub">
          {shift.location} · <span className="tabular">{shift.tag}</span>
        </span>
      </span>
      <span className="dash-shift-chev" aria-hidden="true">
        <Icon name="ChevronRight" size={20} />
      </span>
    </button>);

}

function DashUpcomingShifts({ items, onGoTo }) {
  const [feat, ...rest] = items;
  const list = rest.slice(0, 3);
  return (
    <section className="dash-card">
      <div className="dash-card-head">
        <h2 className="dash-card-title">Upcoming assignments</h2>
        <button
          type="button"
          className="vms-btn vms-btn--sm vms-btn--secondary"
          onClick={() => onGoTo && onGoTo("schedule")}>
          
          View all
        </button>
      </div>
      <DashFeaturedShift
        shift={feat}
        onOpen={() => onGoTo && onGoTo({ page: "requisitions", sub: "details", id: feat?.reqId })} />
      
      {list.length > 0 &&
      <div className="dash-shifts">
          {list.map((s) =>
        <DashShiftRow
          key={s.id}
          shift={s}
          onOpen={() => onGoTo && onGoTo({ page: "requisitions", sub: "details", id: s.reqId })} />

        )}
        </div>
      }
    </section>);

}

// ---------------------------------------------------------------------
// Calendar — per-org traffic-light fulfillment grid.
// Each day cell is tinted by the same tier model as the schedule console
// (≥90% high · 60–89% med · <60% low). Cells without need are neutral.
// Clicking a day jumps into the Schedule console with that day selected.
// ---------------------------------------------------------------------

// Org-factor previously nudged the calendar's filled count per scope so
// each location filter rendered its own pattern. That broke the contract
// the day-click flow now relies on — the schedule day-detail page reads
// the canonical `dayFromDate()` numbers, so any nudge here would surface
// "11/14" on the calendar and "13/14" on the detail page for the same
// day. Hold the factor at zero so the two surfaces stay in lockstep.
function _orgFactor(_locationIds) {return 0;}

// Look up a day's fulfillment record. Delegates to the schedule-console's
// `dayFromDate()` so curated days *and* synthesized days share a single
// source of truth — clicking through to the day's detail view shows the
// same filled / needed numbers shown on the calendar tile.
function _fulfillmentForCell(year, month, day, factor) {
  const dayFromDate = window.dayFromDate;
  let base = null;
  if (dayFromDate) {
    base = dayFromDate(new Date(year, month, day));
  }
  if (!base) {
    // Defensive fallback — schedule-console hasn't loaded yet. Mirror the
    // weekend-biased synthesis used downstream so first paint still reads
    // coherently. (This branch effectively never runs in normal flow.)
    const dow = new Date(year, month, day).getDay();
    const isWeekend = dow === 0 || dow === 6;
    let h = (year * 31 + month) * 31 + day;
    h = (h * 9301 + 49297) % 233280 / 233280;
    const needed = isWeekend ? 7 + Math.floor(h * 5) : 12 + Math.floor(h * 7);
    const ratio = isWeekend ? 0.55 + h * 0.40 : 0.65 + h * 0.32;
    const filled = Math.max(0, Math.min(needed, Math.round(needed * ratio)));
    base = { filled, needed };
  }
  // Apply the per-org nudge — clamped so we never go negative or exceed
  // the day's `needed` headcount. Factor is 0 for Admin / All locations,
  // so the calendar matches the schedule console 1-to-1 in the default
  // (and most common) scope.
  const filled = Math.max(0, Math.min(base.needed, base.filled + factor));
  return { ...base, filled };
}

function _tier(filled, needed) {
  // Traffic-light fulfillment tiers used by the home calendar dots:
  //   none — no shifts scheduled       (neutral grey dot)
  //   low  —   0 – 50 % filled         (red)
  //   med  —  50 – 75 % filled         (yellow)
  //   high — 75 – 100 % filled         (green)
  if (!needed) return "none";
  const pct = filled / needed;
  if (pct < 0.5) return "low";
  if (pct < 0.75) return "med";
  return "high";
}

function DashCalendar({ onGoTo, locationIds, scopedLabel }) {
  // Anchor to the actual current month from the shared today.
  const [{ year, month }, setMonth] = useStateDash({
    year: DEMO_TODAY.getFullYear(),
    month: DEMO_TODAY.getMonth()
  });
  const cells = useMemoDash(() => _monthGrid(year, month), [year, month]);
  const factor = useMemoDash(() => _orgFactor(locationIds), [locationIds]);
  const monthLabel = useMemoDash(
    () => new Date(year, month, 1).toLocaleDateString(undefined, { month: "long", year: "numeric" }),
    [year, month]
  );
  const isThisMonth = year === DEMO_TODAY.getFullYear() && month === DEMO_TODAY.getMonth();
  const today = DEMO_TODAY.getDate();

  const prev = () => setMonth(({ year, month }) => {
    const m = month - 1;return m < 0 ? { year: year - 1, month: 11 } : { year, month: m };
  });
  const next = () => setMonth(({ year, month }) => {
    const m = month + 1;return m > 11 ? { year: year + 1, month: 0 } : { year, month: m };
  });

  // Build per-cell metadata once per render.
  const cellMeta = useMemoDash(() => cells.map((c) => {
    if (c.out) return { cell: c };
    // Resolve the cell's actual calendar date — leading/trailing cells
    // belong to the neighbouring month, so we render them disabled.
    const dt = new Date(year, month, c.day);
    const data = _fulfillmentForCell(dt.getFullYear(), dt.getMonth(), c.day, factor);
    if (!data) return { cell: c, tier: "none" };
    const tier = _tier(data.filled, data.needed);
    const pct = data.needed ? Math.round(data.filled / data.needed * 100) : 0;
    const open = Math.max(0, data.needed - data.filled);
    // Day key — prefer the curated key from the schedule-console
    // dataset, but synthesize one for cells outside that window so the
    // calendar deep-link into Schedule still resolves to a date.
    const dayKeyFor = window.dayKeyFor;
    const fallbackKey = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(c.day).padStart(2, "0")}`;
    const key = data.key || dayKeyFor && dayKeyFor(dt.getFullYear(), dt.getMonth(), c.day) || fallbackKey;
    return { cell: c, tier, pct, filled: data.filled, needed: data.needed, open, key };
  }), [cells, year, month, factor]);

  const goToDay = (meta) => {
    if (!onGoTo) return;
    if (meta.key) onGoTo({ page: "schedule", dayKey: meta.key });else
    onGoTo("schedule");
  };

  return (
    <section className="dash-card">
      <div className="dash-card-head">
        <h2 className="dash-card-title">Calendar</h2>
      </div>
      <div className="dash-cal">
        <div className="dash-cal-head">
          <button
            type="button"
            className="dash-cal-month"
            onClick={() => onGoTo && onGoTo("schedule")}>
            
            {monthLabel}
          </button>
          <div className="dash-cal-nav">
            <button type="button" className="dash-cal-navbtn" onClick={prev} aria-label="Previous month">
              <Icon name="ChevronLeft" size={18} />
            </button>
            <button type="button" className="dash-cal-navbtn" onClick={next} aria-label="Next month">
              <Icon name="ChevronRight" size={18} />
            </button>
          </div>
        </div>
        <div className="dash-cal-grid">
          {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) =>
          <span key={d} className="dash-cal-dow">{d}</span>
          )}
          {cellMeta.map(({ cell: c, tier, pct, filled, needed, open, key }) => {
            const isToday = !c.out && isThisMonth && c.day === today;
            const hasData = !!key;
            const past = !c.out && isThisMonth && c.day < today;
            const future = !c.out && isThisMonth && c.day > today;
            const cls = [
            "dash-cal-cell",
            c.out && "dash-cal-cell--out",
            !c.out && tier && `dash-cal-cell--${tier}`,
            !c.out && hasData && "dash-cal-cell--data",
            past && "dash-cal-cell--past",
            future && "dash-cal-cell--future",
            isToday && "dash-cal-cell--today"].
            filter(Boolean).join(" ");
            const aria = hasData ?
            `${c.day}, ${filled} of ${needed} filled, ${pct}% coverage${open > 0 ? `, ${open} open` : ""}` :
            String(c.day);
            return (
              <button
                key={c.key}
                type="button"
                className={cls}
                disabled={c.out}
                aria-label={aria}
                onClick={() => !c.out && goToDay({ key })}>
                
                <span className="dash-cal-cell-day tabular">{c.day}</span>
                {hasData &&
                <span className={`dash-cal-cell-dot dash-cal-cell-dot--${tier || "data"}`} aria-hidden="true" />
                }
                {hasData &&
                <span className="dash-cal-cell-pop" role="presentation" aria-hidden="true">
                    <span className="dash-cal-cell-pop-day">{c.day}</span>
                    <span className="dash-cal-cell-pop-stat tabular">
                      <span className={`dash-cal-cell-pop-dot dash-cal-cell-pop-dot--${tier || "data"}`} />
                      {filled} / {needed} filled · {pct}%
                    </span>
                    {open > 0 &&
                  <span className="dash-cal-cell-pop-meta tabular">{open} open</span>
                  }
                  </span>
                }
              </button>);

          })}
        </div>
      </div>
    </section>);

}

// ---------------------------------------------------------------------
// For you today (2x2 stat tiles)
// ---------------------------------------------------------------------

function DashStatTile({ icon, label, count, tone = "blue", onClick }) {
  return (
    <button type="button" className="dash-stat" onClick={onClick}>
      <span className={`dash-stat-bubble dash-stat-bubble--${tone}`}>
        <Icon name={icon} size={24} />
        {count > 0 &&
        <span className={`dash-stat-badge${count > 99 ? " dash-stat-badge--neutral" : ""}`}>
            {count > 99 ? "99+" : count}
          </span>
        }
      </span>
      <span className="dash-stat-label">{label}</span>
    </button>);

}

function DashForYouToday({ counts, onGoTo }) {
  return (
    <section className="dash-card">
      <div className="dash-card-head">
        <h2 className="dash-card-title">For you today</h2>
      </div>
      <div className="dash-stats">
        <DashStatTile
          icon="Briefcase"
          label="Shifts at risk"
          count={counts.atRisk}
          tone="red"
          onClick={() => onGoTo && onGoTo({ page: "schedule", filter: "priority" })} />
        
        <DashStatTile
          icon="PersonClock"
          label="Timesheets"
          count={counts.timesheets}
          tone="orange"
          onClick={() => onGoTo && onGoTo("timesheets")} />
        
        <DashStatTile
          icon="Inbox"
          label="Approvals"
          count={counts.approvals}
          tone="blue"
          onClick={() => onGoTo && onGoTo("inbox")} />
        
        <DashStatTile
          icon="ShieldPerson"
          label="Compliance"
          count={counts.compliance}
          tone="purple"
          onClick={() => onGoTo && onGoTo("compliance")} />
        
      </div>
    </section>);

}

// ---------------------------------------------------------------------
// Recent activity
// ---------------------------------------------------------------------

const ACTIVITY_FEED = [
{
  id: "a1", icon: "Calendar", tone: "default",
  title: "Shift auto-closed.",
  deep: { label: "1 Production Associate", target: { page: "schedule" } },
  time: "2 mins ago"
},
{
  id: "a2", icon: "PersonClock", tone: "blue",
  title: "Timesheet submitted for review.",
  deep: { label: "Terry Donin · Work assignment #765", target: { page: "timesheets", sub: "details", id: "TS-91217" } },
  time: "18 mins ago"
},
{
  id: "a3", icon: "Pay", tone: "purple",
  title: "Invoice ready for AP release.",
  deep: { label: "StaffWise · April week 3", target: { page: "invoices", sub: "details", id: "INV-D4E5F6G7" } },
  time: "42 mins ago"
},
{
  id: "a4", icon: "Alert", tone: "warn",
  title: "OSHA-10 expired for Terry Donin.",
  deep: { label: "Suspend 12 future shifts", target: { page: "compliance" } },
  time: "1 hr ago"
},
{
  id: "a5", icon: "AddCircle", tone: "default",
  title: "New requisition ordered.",
  deep: { label: "Distribution Center Alpha · 8 Factory Line Assemblers", target: { page: "requisitions", sub: "details", id: "O1P2Q3R4S5" } },
  time: "2 hrs ago"
}];


function DashRecentActivity({ onGoTo }) {
  return (
    <section className="dash-card">
      <div className="dash-card-head">
        <h2 className="dash-card-title">Recent activity</h2>
        <button
          type="button"
          className="vms-btn vms-btn--sm vms-btn--secondary"
          onClick={() => onGoTo && onGoTo("inbox")}>
          
          View all
        </button>
      </div>
      <div className="dash-act-list">
        {ACTIVITY_FEED.map((a) =>
        <div key={a.id} className="dash-act">
            <span className={`dash-act-ic${a.tone && a.tone !== "default" ? " dash-act-ic--" + a.tone : ""}`} aria-hidden="true">
              <Icon name={a.icon} size={24} />
            </span>
            <div className="dash-act-body">
              <p className="dash-act-title">{a.title}</p>
              <p className="dash-act-meta">
                <a
                href="#"
                onClick={(e) => {e.preventDefault();onGoTo && onGoTo(a.deep.target);}}>
                
                  {a.deep.label}
                </a>{" "}· {a.time}
              </p>
            </div>
          </div>
        )}
      </div>
    </section>);

}

// ---------------------------------------------------------------------
// Tab strip — sits inside the Omnibar actions slot for the hub
// ---------------------------------------------------------------------
function DashShortcuts({ onGoTo }) {
  const items = [
    { icon: "Briefcase",     label: "Create new shift",      target: { page: "requisitions", sub: "new" } },
    { icon: "TimeUndo",      label: "Review Timesheets",     target: "timesheets" },
    { icon: "PersonSearch",  label: "Invite new Agency",     target: "suppliers" },
    { icon: "PersonPlus",    label: "Add new worker",        target: "workforce" },
    { icon: "ShieldPerson",  label: "Run a compliance check", target: "compliance" },
    { icon: "MoneyBag",      label: "Review budget",         target: { page: "settings", sub: "budgets" } },
  ];
  return (
    <section className="dash-card">
      <div className="dash-card-head">
        <h2 className="dash-card-title">Shortcuts</h2>
      </div>
      <ul className="dash-shortcuts">
        {items.map((it) => (
          <li key={it.label}>
            <button
              type="button"
              className="dash-shortcut"
              onClick={() => onGoTo && onGoTo(it.target)}
            >
              <span className="dash-shortcut-ic" aria-hidden="true">
                <Icon name={it.icon} size={22} />
              </span>
              <span className="dash-shortcut-label">{it.label}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

// Standalone "Add widget" module — sits as its own card in the right
// column, separate from Shortcuts, so the action reads as a top-level
// home-customization affordance rather than a Shortcuts row.
function DashAddWidgetCard({ onAddWidget }) {
  return (
    <section className="dash-card dash-addw-card" aria-label="Add a widget to this tab">
      <div className="dash-addw-body">
        <div className="dash-addw-head">
          <span className="dash-addw-ic" aria-hidden="true">
            <Icon name="AddCircle" size={20} />
          </span>
          <div className="dash-addw-text">
            <h2 className="dash-addw-title">Add a widget</h2>
            <p className="dash-addw-sub">
              Browse the library and drop new modules into this tab.
            </p>
          </div>
        </div>
        <button type="button" className="dash-addw-btn" onClick={onAddWidget}>
          <Icon name="AddCircle" size={16} />
          Browse library
        </button>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------
// Custom widgets — rendered when the user adds them from the widget
// library. Designed to drop into the right column under Shortcuts.
// ---------------------------------------------------------------------

function WidgetTopSuppliers({ widget, onRemove, onRename }) {
  const rows = [
    { name: "StaffWise",       fill: 96, trend: "up",   delta: "+3" },
    { name: "PeopleReady",     fill: 91, trend: "up",   delta: "+1" },
    { name: "Aerotek",         fill: 88, trend: "flat", delta: "0"  },
    { name: "Adecco",          fill: 82, trend: "down", delta: "−2" },
    { name: "Kelly Services",  fill: 74, trend: "down", delta: "−4" },
  ];
  const title = (widget && widget.title) || "Top suppliers · fill rate";
  return (
    <section className="dash-card dash-widget" data-widget="top-suppliers">
      <WidgetHead
        title={title}
        eyebrow="Last 30 days"
        widget={widget}
        onRemove={onRemove}
        onRename={onRename}
      />
      <ul className="dw-sup-list" role="list">
        {rows.map((r, i) => {
          const toneClass =
            r.fill >= 90 ? "dw-sup-bar--high" :
            r.fill >= 80 ? "dw-sup-bar--med"  : "dw-sup-bar--low";
          return (
            <li key={r.name} className="dw-sup">
              <span className="dw-sup-rank tabular">{i + 1}</span>
              <div className="dw-sup-main">
                <div className="dw-sup-row">
                  <span className="dw-sup-name">{r.name}</span>
                  <span className="dw-sup-pct tabular">{r.fill}%</span>
                </div>
                <div className="dw-sup-bar" aria-hidden="true">
                  <span className={`dw-sup-bar-fill ${toneClass}`} style={{ width: `${r.fill}%` }} />
                </div>
              </div>
              <span className={`dw-sup-delta dw-sup-delta--${r.trend} tabular`}>{r.delta}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function WidgetSpendSnapshot({ widget, onRemove, onRename }) {
  const bars = [62, 78, 54, 91, 70, 84, 88];
  const days = ["M", "T", "W", "T", "F", "S", "S"];
  const max = Math.max(...bars);
  // Anchor to the $10M baseline ($184k/wk) and scale through the active
  // temp-spend tier so this same widget reads $18k at $1M and $9M at $500M+.
  const sym = (window.curSymbol && window.curSymbol()) || "$";
  const scale = (typeof window.TEMP_SPEND_SCALE === "number") ? window.TEMP_SPEND_SCALE : 1;
  const raw = 184_210 * scale;
  const formatAmount = (n) => {
    const v = Math.abs(n);
    if (v >= 1_000_000_000) return `${sym}${(v / 1_000_000_000).toFixed(2)}B`;
    if (v >= 10_000_000)    return `${sym}${(v / 1_000_000).toFixed(1)}M`;
    if (v >= 1_000_000)     return `${sym}${(v / 1_000_000).toFixed(2)}M`;
    if (v >= 10_000)        return `${sym}${Math.round(v / 1000).toLocaleString("en-US")}k`;
    return `${sym}${Math.round(v).toLocaleString("en-US")}`;
  };
  const title = (widget && widget.title) || "Spend this week";
  return (
    <section className="dash-card dash-widget" data-widget="spend-snapshot">
      <WidgetHead
        title={title}
        eyebrow="vs. last week"
        widget={widget}
        onRemove={onRemove}
        onRename={onRename}
      />
      <div className="dw-spend">
        <div className="dw-spend-headline">
          <span className="dw-spend-amount tabular">{formatAmount(raw)}</span>
          <span className="dw-spend-delta dw-spend-delta--up tabular">
            <Icon name="ChevronUp" size={14} /> 12.4%
          </span>
        </div>
        <div className="dw-spend-chart" aria-hidden="true">
          {bars.map((v, i) => (
            <span key={i} className="dw-spend-col">
              <span
                className={"dw-spend-bar" + (i === 6 ? " dw-spend-bar--today" : "")}
                style={{ height: `${(v / max) * 100}%` }}
              />
              <span className="dw-spend-day">{days[i]}</span>
            </span>
          ))}
        </div>
        <div className="dw-spend-foot">
          <span className="dw-spend-leg">
            <span className="dw-spend-swatch dw-spend-swatch--bar" /> Daily spend
          </span>
          <span className="dw-spend-leg">
            <span className="dw-spend-swatch dw-spend-swatch--today" /> Today
          </span>
        </div>
      </div>
    </section>
  );
}

function WidgetActiveAlerts({ widget, onRemove, onRename }) {
  const alerts = [
    { tone: "error",   icon: "Alert",        title: "OSHA-10 expired",         meta: "Terry Donin · suspends 12 shifts" },
    { tone: "warning", icon: "Hourglass",    title: "Shift fill below target", meta: "DC Alpha · 3 of 8 confirmed" },
    { tone: "info",    icon: "PersonClock",  title: "Timesheet awaiting you",  meta: "Maya Singh · 38.5 h" },
  ];
  const title = (widget && widget.title) || "Active alerts";
  return (
    <section className="dash-card dash-widget" data-widget="active-alerts">
      <WidgetHead
        title={title}
        eyebrow={null}
        widget={widget}
        onRemove={onRemove}
        onRename={onRename}
      />
      <ul className="dw-alerts" role="list">
        {alerts.map((a, i) => (
          <li key={i} className={`dw-alert dw-alert--${a.tone}`}>
            <span className="dw-alert-ic" aria-hidden="true">
              <Icon name={a.icon} size={18} />
            </span>
            <div className="dw-alert-body">
              <span className="dw-alert-title">{a.title}</span>
              <span className="dw-alert-meta">{a.meta}</span>
            </div>
            <span className="dw-alert-chev" aria-hidden="true">
              <Icon name="ChevronRight" size={18} />
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

// Library catalogue. Each entry has metadata for the picker card AND a
// `render` thunk so the chosen widget mounts into the dashboard.
const WIDGET_LIBRARY = [
  {
    id: "top-suppliers",
    name: "Top suppliers",
    blurb: "Leaderboard of supplier fill rate with 30-day deltas.",
    icon: "PersonSearch",
    tone: "blue",
    Preview: WidgetTopSuppliersPreview,
    Render: WidgetTopSuppliers,
  },
  {
    id: "spend-snapshot",
    name: "Spend snapshot",
    blurb: "Weekly contingent labor spend with a daily breakdown bar chart.",
    icon: "MoneyBag",
    tone: "purple",
    Preview: WidgetSpendSnapshotPreview,
    Render: WidgetSpendSnapshot,
  },
  {
    id: "active-alerts",
    name: "Active alerts",
    blurb: "Compliance, fulfillment, and timesheet alerts that need a look.",
    icon: "Alert",
    tone: "red",
    Preview: WidgetActiveAlertsPreview,
    Render: WidgetActiveAlerts,
  },
];

// Compact thumbnails for the library — pure-CSS sketches, no live data.
function WidgetTopSuppliersPreview() {
  return (
    <div className="dwp dwp--sup">
      {[88, 72, 60, 44].map((w, i) => (
        <div key={i} className="dwp-row">
          <span className="dwp-dot" />
          <span className="dwp-bar"><span style={{ width: `${w}%` }} /></span>
        </div>
      ))}
    </div>
  );
}
function WidgetSpendSnapshotPreview() {
  const bars = [50, 70, 40, 85, 60, 78, 90];
  return (
    <div className="dwp dwp--spend">
      <span className="dwp-headline" />
      <div className="dwp-bars">
        {bars.map((v, i) => (
          <span key={i} className="dwp-col" style={{ height: `${v}%` }} />
        ))}
      </div>
    </div>
  );
}
function WidgetActiveAlertsPreview() {
  return (
    <div className="dwp dwp--alerts">
      {["red", "amber", "blue"].map((t, i) => (
        <div key={i} className={`dwp-alert dwp-alert--${t}`}>
          <span className="dwp-alert-dot" />
          <span className="dwp-alert-line dwp-alert-line--a" />
          <span className="dwp-alert-line dwp-alert-line--b" />
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------
// Widget library — side panel using the standard scrim + side-panel
// chrome so it composes with the rest of the app.
// ---------------------------------------------------------------------
function DashWidgetLibrary({ open, addedIds, onAdd, onClose }) {
  useEffectDash(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <React.Fragment>
      <div className={"scrim" + (open ? " open" : "")} onClick={onClose} aria-hidden="true" />
      <aside
        className={"side-panel dash-wl-panel" + (open ? " open" : "")}
        role="dialog"
        aria-modal="true"
        aria-label="Widget library"
      >
        <header className="sp-head">
          <h2>Widget library</h2>
          <button type="button" className="iconbtn" onClick={onClose} aria-label="Close widget library">
            <Icon name="X" size={18} />
          </button>
        </header>
        <div className="sp-body dash-wl-body">
          <p className="dash-wl-sub">
            Add widgets to your current tab. You can rearrange or remove them at any time.
          </p>
          <ul className="dash-wl-grid" role="list">
            {WIDGET_LIBRARY.map((w) => {
              const added = addedIds.includes(w.id);
              const Preview = w.Preview;
              return (
                <li key={w.id} className="dash-wl-card">
                  <div className={`dash-wl-thumb dash-wl-thumb--${w.tone}`}>
                    <Preview />
                  </div>
                  <div className="dash-wl-meta">
                    <div className="dash-wl-meta-head">
                      <span className={`dash-wl-ic dash-wl-ic--${w.tone}`} aria-hidden="true">
                        <Icon name={w.icon} size={16} />
                      </span>
                      <h3 className="dash-wl-name">{w.name}</h3>
                    </div>
                    <p className="dash-wl-blurb">{w.blurb}</p>
                  </div>
                  <button
                    type="button"
                    className={"dash-wl-add" + (added ? " is-added" : "")}
                    onClick={() => !added && onAdd(w.id)}
                    disabled={added}
                  >
                    {added ? (
                      <React.Fragment>
                        <Icon name="Check" size={16} />
                        Added
                      </React.Fragment>
                    ) : (
                      <React.Fragment>
                        <Icon name="AddCircle" size={16} />
                        Add to dashboard
                      </React.Fragment>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="dash-wl-soon">
            <Icon name="Stack" size={16} />
            <span>More widgets coming soon — workforce health, payroll readiness, and AI insights.</span>
          </div>
        </div>
      </aside>
    </React.Fragment>
  );
}

// ---------------------------------------------------------------------
// Add-tab modal — centered overlay with scrim. Lets the user name a
// new custom tab and pick a small starter icon. Designed against the
// Everest dialog chrome (ix-scrim + ix-dialog) so it matches the rest
// of the app's modal pattern.
// ---------------------------------------------------------------------
const ADD_TAB_ICONS = [
  { id: "Performance",  label: "Chart"    },
  { id: "Person",       label: "Person"   },
  { id: "MoneyBag",     label: "Spend"    },
  { id: "Calendar",     label: "Calendar" },
  { id: "Stack",        label: "Stack"    },
  { id: "ShieldPerson", label: "Shield"   },
  { id: "Briefcase",    label: "Work"     },
  { id: "PersonClock",  label: "Time"     },
];

function DashAddTabModal({ open, onCreate, onClose, existingLabels = [] }) {
  const [name, setName] = useStateDash("");
  const [icon, setIcon] = useStateDash(ADD_TAB_ICONS[0].id);
  const inputRef = React.useRef(null);

  useEffectDash(() => {
    if (open) {
      setName("");
      setIcon(ADD_TAB_ICONS[0].id);
      setTimeout(() => { try { inputRef.current && inputRef.current.focus(); } catch (e) {} }, 30);
    }
  }, [open]);

  useEffectDash(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const trimmed = name.trim();
  const isDuplicate =
    trimmed && existingLabels.some((l) => l.toLowerCase() === trimmed.toLowerCase());
  const canCreate = trimmed.length > 0 && !isDuplicate;

  const submit = () => {
    if (!canCreate) return;
    onCreate({ name: trimmed, icon });
  };

  return (
    <React.Fragment>
      <div className="ix-scrim" onClick={onClose} aria-hidden="true" />
      <div
        className="ix-dialog dash-tab-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="dash-tab-modal-title"
      >
        <header className="ix-dialog-head">
          <div className="dash-tab-modal-head">
            <span className="dash-tab-modal-head-ic" aria-hidden="true">
              <Icon name="AddCircle" size={20} />
            </span>
            <div>
              <h2 id="dash-tab-modal-title">Create a new tab</h2>
              <p className="dash-tab-modal-sub">
                Name your tab, pick an icon, then add widgets to fill it out.
              </p>
            </div>
          </div>
          <button type="button" className="iconbtn" onClick={onClose} aria-label="Close">
            <Icon name="X" size={18} />
          </button>
        </header>
        <div className="ix-dialog-body dash-tab-modal-body">
          <label className="dash-field">
            <span className="dash-field-label">Tab name</span>
            <input
              ref={inputRef}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") { e.preventDefault(); submit(); }
              }}
              placeholder="e.g. Workforce, My week"
              maxLength={28}
              className={"dash-field-input" + (isDuplicate ? " is-invalid" : "")}
              aria-invalid={isDuplicate ? "true" : "false"}
            />
            {isDuplicate ? (
              <span className="dash-field-error">A tab with that name already exists.</span>
            ) : (
              <span className="dash-field-help">{trimmed.length}/28 characters</span>
            )}
          </label>
          <div className="dash-field">
            <span className="dash-field-label">Icon</span>
            <div className="dash-tab-modal-icons" role="radiogroup" aria-label="Tab icon">
              {ADD_TAB_ICONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  role="radio"
                  aria-checked={icon === opt.id}
                  className={"dash-tab-modal-icon" + (icon === opt.id ? " is-active" : "")}
                  onClick={() => setIcon(opt.id)}
                  title={opt.label}
                >
                  <Icon name={opt.id} size={18} />
                </button>
              ))}
            </div>
          </div>
          <div className="dash-tab-modal-preview" aria-hidden="true">
            <span className="dash-field-label">Preview</span>
            <div className="dash-tab-modal-preview-chip">
              <Icon name={icon} size={14} />
              <span>{trimmed || "Tab name"}</span>
            </div>
          </div>
        </div>
        <footer className="ix-dialog-foot dash-tab-modal-foot">
          <button type="button" className="dash-modal-btn dash-modal-btn--tertiary" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="dash-modal-btn dash-modal-btn--primary"
            onClick={submit}
            disabled={!canCreate}
          >
            Create tab
          </button>
        </footer>
      </div>
    </React.Fragment>
  );
}

// ---------------------------------------------------------------------
// Widget menu (3-dot) + rename modal. Each user-added widget renders
// these so the user can customize the title or remove the widget.
// ---------------------------------------------------------------------
function DashWidgetMenu({ widgetTitle, onRename, onRemove }) {
  const [open, setOpen] = useStateDash(false);
  const wrapRef = React.useRef(null);

  useEffectDash(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
    const onClick = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onClick);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onClick);
    };
  }, [open]);

  return (
    <div className="dash-widget-menu-wrap" ref={wrapRef}>
      <button
        type="button"
        className="dash-widget-menu-btn"
        onClick={() => setOpen((v) => !v)}
        aria-label={`More options for ${widgetTitle}`}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <Icon name="MoreVert" size={18} />
      </button>
      {open && (
        <div className="dash-widget-menu" role="menu">
          <button
            type="button"
            role="menuitem"
            className="dash-widget-menu-item"
            onClick={() => { setOpen(false); onRename && onRename(); }}
          >
            <Icon name="Edit" size={16} />
            <span>Customize</span>
          </button>
          <button
            type="button"
            role="menuitem"
            className="dash-widget-menu-item dash-widget-menu-item--danger"
            onClick={() => { setOpen(false); onRemove && onRemove(); }}
          >
            <Icon name="TrashCan" size={16} />
            <span>Remove from dashboard</span>
          </button>
        </div>
      )}
    </div>
  );
}

function DashWidgetRenameModal({ open, defaultTitle, currentTitle, onSave, onClose }) {
  const [name, setName] = useStateDash(currentTitle || defaultTitle || "");
  const inputRef = React.useRef(null);

  useEffectDash(() => {
    if (open) {
      setName(currentTitle || defaultTitle || "");
      setTimeout(() => { try { inputRef.current && inputRef.current.focus(); inputRef.current.select(); } catch (e) {} }, 30);
    }
  }, [open, currentTitle, defaultTitle]);

  useEffectDash(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const trimmed = name.trim();
  const canSave = trimmed.length > 0;

  return (
    <React.Fragment>
      <div className="ix-scrim" onClick={onClose} aria-hidden="true" />
      <div
        className="ix-dialog dash-tab-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="dash-w-rename-title"
      >
        <header className="ix-dialog-head">
          <div className="dash-tab-modal-head">
            <span className="dash-tab-modal-head-ic" aria-hidden="true">
              <Icon name="Edit" size={18} />
            </span>
            <div>
              <h2 id="dash-w-rename-title">Customize widget</h2>
              <p className="dash-tab-modal-sub">Give this widget a name that fits how you'll use it.</p>
            </div>
          </div>
          <button type="button" className="iconbtn" onClick={onClose} aria-label="Close">
            <Icon name="X" size={18} />
          </button>
        </header>
        <div className="ix-dialog-body dash-tab-modal-body">
          <label className="dash-field">
            <span className="dash-field-label">Widget title</span>
            <input
              ref={inputRef}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") { e.preventDefault(); if (canSave) onSave(trimmed); }
              }}
              maxLength={56}
              className="dash-field-input"
              placeholder={defaultTitle}
            />
            <span className="dash-field-help">
              Default: <em>{defaultTitle}</em>
            </span>
          </label>
        </div>
        <footer className="ix-dialog-foot dash-tab-modal-foot">
          <button
            type="button"
            className="dash-modal-btn dash-modal-btn--tertiary"
            onClick={() => onSave(null)}
            title="Reset to default title"
          >
            Reset to default
          </button>
          <div className="dash-tab-modal-foot-right">
            <button type="button" className="dash-modal-btn dash-modal-btn--tertiary" onClick={onClose}>
              Cancel
            </button>
            <button
              type="button"
              className="dash-modal-btn dash-modal-btn--primary"
              onClick={() => canSave && onSave(trimmed)}
              disabled={!canSave}
            >
              Save
            </button>
          </div>
        </footer>
      </div>
    </React.Fragment>
  );
}

// Shared widget card head — renders title + optional eyebrow + 3-dot menu.
function WidgetHead({ title, eyebrow, widget, onRemove, onRename }) {
  return (
    <div className="dash-card-head">
      <h2 className="dash-card-title">{title}</h2>
      <div className="dash-widget-head-right">
        {eyebrow ? <span className="dash-widget-eyebrow">{eyebrow}</span> : null}
        {widget ? (
          <DashWidgetMenu widgetTitle={title} onRename={onRename} onRemove={onRemove} />
        ) : null}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------
// Professional Work overview
//   Renders inside the Home overview when the `professionalWork`
//   feature flag is on AND the user has selected the "Professional"
//   engagement-type segment. Shows the same broad shape as the
//   Frontline overview (left/right two-column) but the cards swap:
//   open requisitions + candidate pipeline replace upcoming shifts,
//   active engagements + renewals replace the calendar + recent
//   activity. Read-only / sample for now — wired to the
//   getProfessional* data on window.
// ---------------------------------------------------------------------

function PwStatTile({ icon, label, count, tone = "blue", onClick, sub }) {
  return (
    <button type="button" className="dash-stat" onClick={onClick} title={label}>
      <span className={`dash-stat-bubble dash-stat-bubble--${tone}`}>
        <Icon name={icon} size={24} />
        {typeof count === "number" && count > 0 && (
          <span className={`dash-stat-badge${count > 99 ? " dash-stat-badge--neutral" : ""}`}>
            {count > 99 ? "99+" : count}
          </span>
        )}
      </span>
      <span className="dash-stat-label">{label}</span>
      {sub && <span className="pw-stat-sub">{sub}</span>}
    </button>
  );
}

function PwForYouToday({ metrics, onGoTo }) {
  return (
    <section className="dash-card">
      <div className="dash-card-head">
        <h2 className="dash-card-title">For you today</h2>
        <span className="pw-eyebrow">Professional</span>
      </div>
      <div className="dash-stats">
        <PwStatTile
          icon="Briefcase"
          label="Open requisitions"
          count={metrics.openReqs}
          tone="blue"
          onClick={() => onGoTo && onGoTo("requisitions")}
        />
        <PwStatTile
          icon="PersonClock"
          label="Interviews this week"
          count={metrics.interviewsWeek}
          tone="purple"
          onClick={() => onGoTo && onGoTo("requisitions")}
        />
        <PwStatTile
          icon="Pay"
          label="Invoices to approve"
          count={metrics.invoicesDue}
          tone="orange"
          onClick={() => onGoTo && onGoTo("invoices")}
        />
        <PwStatTile
          icon="Refresh"
          label="Renewals · 90 d"
          count={metrics.renewalsDue}
          tone="red"
          onClick={() => onGoTo && onGoTo("workforce")}
        />
      </div>
    </section>
  );
}

function PwOpenReqs({ reqs, onGoTo }) {
  const top = reqs.slice(0, 4);
  return (
    <section className="dash-card">
      <div className="dash-card-head">
        <h2 className="dash-card-title">Open Professional requisitions</h2>
        <button
          type="button"
          className="vms-btn vms-btn--sm vms-btn--secondary"
          onClick={() => onGoTo && onGoTo("requisitions")}
        >
          View all
        </button>
      </div>
      <ul className="pw-req-list" role="list">
        {top.map((r) => {
          const total =
            (r.pipeline?.sourced || 0) +
            (r.pipeline?.screened || 0) +
            (r.pipeline?.interview || 0) +
            (r.pipeline?.offer || 0);
          const interviewing = (r.pipeline?.interview || 0) + (r.pipeline?.offer || 0);
          const pct = total ? Math.round((interviewing / total) * 100) : 0;
          const cadenceLabel = window.profCadenceLabel ? window.profCadenceLabel(r.cadence) : r.cadence;
          const rate = window.profFmtMoney
            ? `${window.profFmtMoney(r.rateLow, r.currency)} – ${window.profFmtMoney(r.rateHigh, r.currency)}`
            : `${r.rateLow}–${r.rateHigh} ${r.currency}`;
          const statusHue =
            r.status === "Offer extended" ? "warning" :
            r.status === "Interviewing"   ? "info"    : "default";
          return (
            <li key={r.id} className="pw-req">
              <div className="pw-req-head">
                <span className="pw-req-id tabular">{r.id}</span>
                <span className={`req-pill req-pill--${statusHue}`}>{r.status}</span>
                <span className={`fi fi-${r.flag}`} aria-hidden="true" style={{ width: 22, height: 16, borderRadius: 2 }}></span>
              </div>
              <div className="pw-req-title">{r.jobs[0]}</div>
              <div className="pw-req-meta">
                <span><Icon name="Location" size={14} /> {r.location}</span>
                <span><Icon name="Calendar" size={14} /> Opened {r.opened} · {r.daysOpen} d</span>
                <span><Icon name="PersonAuthorize" size={14} /> {r.hiringManager}</span>
              </div>
              <div className="pw-req-contract">
                <span className="pw-chip pw-chip--cadence">{cadenceLabel}</span>
                <span className="pw-chip pw-chip--rate tabular">{rate}</span>
                <span className="pw-chip pw-chip--sow">
                  {r.timesheetMode === "required" ? "Timesheet required" : "No timesheet"}
                </span>
                <span className="pw-chip pw-chip--perm">Permanent</span>
              </div>
              <div className="pw-pipe" aria-label={`Pipeline: ${total} candidates, ${pct}% in interview or offer`}>
                <div className="pw-pipe-bar">
                  <span className="pw-pipe-seg pw-pipe-seg--sourced"   style={{ flex: r.pipeline.sourced }} />
                  <span className="pw-pipe-seg pw-pipe-seg--screened"  style={{ flex: r.pipeline.screened }} />
                  <span className="pw-pipe-seg pw-pipe-seg--interview" style={{ flex: r.pipeline.interview }} />
                  <span className="pw-pipe-seg pw-pipe-seg--offer"     style={{ flex: r.pipeline.offer || 0.01 }} />
                </div>
                <div className="pw-pipe-legend">
                  <span className="tabular">{r.pipeline.sourced}<em> sourced</em></span>
                  <span className="tabular">{r.pipeline.screened}<em> screened</em></span>
                  <span className="tabular">{r.pipeline.interview}<em> in interview</em></span>
                  <span className="tabular">{r.pipeline.offer || 0}<em> offer</em></span>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function PwEngagements({ workers, onGoTo }) {
  // Sort by nearest renewal so the most-actionable rows lead.
  const today = window.flexToday ? window.flexToday() : new Date(2026, 4, 19);
  const sorted = [...workers].sort((a, b) => {
    const da = new Date(a.renewalDate || "2099-01-01").getTime();
    const db = new Date(b.renewalDate || "2099-01-01").getTime();
    return da - db;
  }).slice(0, 5);
  function daysUntil(dateStr) {
    const d = new Date(dateStr);
    return Math.round((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  }
  return (
    <section className="dash-card">
      <div className="dash-card-head">
        <h2 className="dash-card-title">Active engagements · upcoming renewals</h2>
        <button
          type="button"
          className="vms-btn vms-btn--sm vms-btn--secondary"
          onClick={() => onGoTo && onGoTo("workforce")}
        >
          View all
        </button>
      </div>
      <ul className="pw-eng-list" role="list">
        {sorted.map((w) => {
          const days = daysUntil(w.renewalDate);
          const renewalHue = days <= 30 ? "warning" : days <= 90 ? "info" : "default";
          const cadenceLabel = window.profCadenceLabel ? window.profCadenceLabel(w.cadence) : w.cadence;
          const rate = window.profFmtMoney ? window.profFmtMoney(w.rateAmount, w.currency) : `${w.currency} ${w.rateAmount}`;
          return (
            <li key={w.id} className="pw-eng">
              <span className="pw-eng-avatar" style={{ background: "var(--evr-surface-decorative-default-blue)", color: "var(--evr-content-decorative-blue)" }}>
                {w.name.split(" ").map((p) => p[0]).slice(0, 2).join("")}
              </span>
              <div className="pw-eng-main">
                <div className="pw-eng-name">
                  {w.name}
                  <span className={`fi fi-${w.flag}`} aria-hidden="true" style={{ width: 18, height: 13, borderRadius: 2, marginLeft: 6 }}></span>
                </div>
                <div className="pw-eng-sub">
                  {w.jobs[0]} · {w.location}
                </div>
                <div className="pw-eng-contract">
                  <span className="pw-chip pw-chip--cadence">{cadenceLabel}</span>
                  <span className="pw-chip pw-chip--rate tabular">{rate} · {cadenceLabel.toLowerCase()}</span>
                  <span className="pw-chip pw-chip--sow tabular">{w.sowRef}</span>
                </div>
              </div>
              <div className="pw-eng-renew">
                <span className={`req-pill req-pill--${renewalHue}`}>
                  Renews in <b className="tabular">{days}</b> d
                </span>
                <span className="pw-eng-renew-date tabular">{w.renewalDate}</span>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function PwPipelineDigest({ reqs }) {
  const totals = reqs.reduce(
    (acc, r) => {
      acc.sourced   += r.pipeline?.sourced   || 0;
      acc.screened  += r.pipeline?.screened  || 0;
      acc.interview += r.pipeline?.interview || 0;
      acc.offer     += r.pipeline?.offer     || 0;
      return acc;
    },
    { sourced: 0, screened: 0, interview: 0, offer: 0 }
  );
  const total = totals.sourced + totals.screened + totals.interview + totals.offer;
  const rows = [
    { key: "sourced",   label: "Sourced",      tone: "blue",   count: totals.sourced },
    { key: "screened",  label: "Screened",     tone: "teal",   count: totals.screened },
    { key: "interview", label: "In interview", tone: "purple", count: totals.interview },
    { key: "offer",     label: "Offer out",    tone: "orange", count: totals.offer },
  ];
  return (
    <section className="dash-card">
      <div className="dash-card-head">
        <h2 className="dash-card-title">Candidate pipeline</h2>
        <span className="pw-eyebrow">Across {reqs.length} reqs · {total} candidates</span>
      </div>
      <ul className="pw-stage-list" role="list">
        {rows.map((r) => {
          const pct = total ? Math.round((r.count / total) * 100) : 0;
          return (
            <li key={r.key} className="pw-stage">
              <div className="pw-stage-row">
                <span className={`pw-stage-dot pw-stage-dot--${r.tone}`} aria-hidden="true" />
                <span className="pw-stage-label">{r.label}</span>
                <span className="pw-stage-count tabular">{r.count}</span>
                <span className="pw-stage-pct tabular">{pct}%</span>
              </div>
              <div className="pw-stage-bar" aria-hidden="true">
                <span className={`pw-stage-fill pw-stage-fill--${r.tone}`} style={{ width: `${pct}%` }} />
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function DashProfessional({ reloadKey, onGoTo }) {
  const reqs = window.getProfessionalRequisitions ? window.getProfessionalRequisitions() : [];
  const workers = window.getProfessionalWorkers ? window.getProfessionalWorkers() : [];
  const metrics = window.profEngagementMetrics ? window.profEngagementMetrics() : {};
  return (
    <div className="dash dash--tabbed" key={`pro-${reloadKey}`} data-screen-label="Dashboard · Professional">
      <div className="dash-grid">
        <div className="dash-col">
          <PwOpenReqs reqs={reqs} onGoTo={onGoTo} />
          <PwEngagements workers={workers} onGoTo={onGoTo} />
        </div>
        <div className="dash-col">
          <PwForYouToday metrics={metrics} onGoTo={onGoTo} />
          <PwPipelineDigest reqs={reqs} />
        </div>
      </div>
    </div>
  );
}

// Engagement-type scope bar. Renders when at least one engagement-type
// flag (Professional Work / SOW / Contractor) is on, sitting under the
// dashboard tab strip. Drives the overview body selection.
//
// v0.7 migration · this was a `<div role="tablist">` (the
// `PwEngagementSwitch` segmented control); per the universal-scopes
// rule it now wraps <EngagementScope/> in single-select mode so the
// dashboard reuses the one allowed type-axis primitive. Behaviour is
// identical (single-select between frontline / professional / sow /
// contractor), only the visual + a11y surface changes — no more
// engagement-type tablist anywhere in pages/.
function PwEngagementSwitch({ value, onChange, professionalOn, sowOn, contractorsOn }) {
  const Scope = window.EngagementScope;
  const useScope = window.useEngagementScope;
  if (!Scope || !useScope) return null;

  // Seed the scope hook with the page's current engagementType so the
  // chip-bar reflects state from session storage on first paint.
  const [scope, helpers] = useScope({ types: [value] });

  // Keep the scope hook in sync with the page state when something
  // else changes it (e.g. flag toggle reset to "frontline" by the
  // dashboard's own useEffect snap-back).
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

  // The flag inputs are kept on the props for API symmetry with the
  // legacy PwEngagementSwitch but they're already encoded in the
  // scope hook via _esEnabledTypes(). Touch them so eslint doesn't
  // complain about unused vars.
  void professionalOn; void sowOn; void contractorsOn;

  return (
    <Scope value={scope} onChange={wrappedHelpers} compact single label="Engagement type" />
  );
}

const DASH_TABS = [
{ id: "overview", label: "Overview", icon: "Performance" },
{ id: "inbox", label: "Inbox", icon: "Inbox" },
{ id: "insights", label: "Insights", icon: "BarChart" },
{ id: "compliance", label: "Compliance", icon: "ShieldPerson" }];


function DashTabs({ active, counts, onChange, showCompliance = true, extraTabs = [], onRemoveExtra, onAddTab, addTabOpen, viewAsRole }) {
  const baseTabs = showCompliance ? DASH_TABS : DASH_TABS.filter((t) => t.id !== "compliance");
  // Agency tenants get an "Action" tab (the supplier workbench) right
  // after Overview. Other roles never see it.
  const _isAgencyTab = !!(window.isAgencyOrg && window.isAgencyOrg()) && (viewAsRole || window.flexViewAsRole) === "agency";
  const tabs = _isAgencyTab
    ? baseTabs.flatMap((t) => t.id === "overview" ? [t, { id: "action", label: "Action", icon: "Inbox" }] : [t])
    : baseTabs;
  return (
    <div className="dash-tabs" role="tablist" aria-label="Dashboard sections">
      {tabs.map((t) => {
        const isActive = t.id === active;
        const count = counts[t.id];
        return (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            className={"dash-tab" + (isActive ? " is-active" : "")}
            onClick={() => onChange(t.id)}>
            
            <span className="dash-tab-label">{t.label}</span>
          </button>);

      })}
      {extraTabs.map((t) => {
        const isActive = t.id === active;
        return (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            className={"dash-tab dash-tab--extra" + (isActive ? " is-active" : "")}
            onClick={() => onChange(t.id)}
            title={`Custom tab · ${t.label}`}
          >
            {t.icon ? (
              <span className="dash-tab-icon" aria-hidden="true">
                <Icon name={t.icon} size={14} />
              </span>
            ) : null}
            <span className="dash-tab-label">{t.label}</span>
            <span
              className="dash-tab-remove"
              role="button"
              tabIndex={0}
              aria-label={`Remove ${t.label} tab`}
              onClick={(e) => { e.stopPropagation(); onRemoveExtra && onRemoveExtra(t.id); }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  e.stopPropagation();
                  onRemoveExtra && onRemoveExtra(t.id);
                }
              }}
            >
              <Icon name="X" size={12} />
            </span>
          </button>
        );
      })}
    </div>);

}

// ---------------------------------------------------------------------
// Overview tab body — original Dashboard layout extracted
// ---------------------------------------------------------------------

function DashOverview({
  reloadKey,
  onGoTo,
  viewAsRole,
  locationIds,
  scopedLabel,
  extraWidgetIds = [],
  widgetTitlesByKey = {},
  tabId = "overview",
  onOpenWidgetLib,
  onRemoveWidget,
  onRenameWidget
}) {
  const triageAll = window.TRIAGE || [];
  const triage = useMemoDash(
    () => _scopeByLocation(triageAll, viewAsRole === "manager" ? locationIds : null).
    slice().
    sort((a, b) => _whenSort(a) - _whenSort(b)),
    [triageAll, viewAsRole, locationIds]
  );

  const counts = useMemoDash(() => {
    const inScope = _scopeByLocation(triageAll, viewAsRole === "manager" ? locationIds : null);
    const atRisk = inScope.filter((x) => x.confirmed < x.needed).length || inScope.length;
    const approvals = (window.APPROVALS || []).length;
    const compliance = (window.COMPLIANCE || []).filter((c) => c.level !== "ok").length;
    const atRiskShifts = inScope.filter((x) => x.confirmed < x.needed).length;
    const tsCount = (window.TIMESHEETS || []).
    filter((t) => t.status === "Pending Approval" || t.status === "Review").
    length;
    return {
      atRisk: viewAsRole === "manager" ? Math.min(atRiskShifts, 4) : atRiskShifts,
      timesheets: viewAsRole === "manager" ? Math.min(tsCount, 4) : tsCount,
      approvals: viewAsRole === "manager" ? Math.min(approvals, 3) : approvals,
      compliance
    };
  }, [triageAll, viewAsRole, locationIds]);

  const extraWidgets = extraWidgetIds
    .map((id) => WIDGET_LIBRARY.find((w) => w.id === id))
    .filter(Boolean);

  return (
    <div className="dash dash--tabbed" key={reloadKey} data-screen-label="Dashboard">
      <div className="dash-grid">
        <div className="dash-col">
          <DashUpcomingShifts items={triage} onGoTo={onGoTo} />
          <DashRecentActivity onGoTo={onGoTo} />
        </div>
        <div className="dash-col">
          <DashCalendar onGoTo={onGoTo} locationIds={locationIds} scopedLabel={scopedLabel} />
          <DashShortcuts onGoTo={onGoTo} />
          {extraWidgets.map((w) => {
            const Render = w.Render;
            const titleOverride = widgetTitlesByKey[`${tabId}::${w.id}`];
            const widgetProp = { id: w.id, title: titleOverride };
            return (
              <Render
                key={w.id}
                widget={widgetProp}
                onRemove={() => onRemoveWidget && onRemoveWidget(tabId, w.id)}
                onRename={() => onRenameWidget && onRenameWidget(tabId, w.id)}
              />
            );
          })}
        </div>
      </div>
    </div>);

}

// ---------------------------------------------------------------------
// Custom tab body — shown when the user opens a tab they added from the
// "+" popover. Starts empty with a hero illustration that nudges them
// toward the widget library; fills in with whatever widgets they add.
// ---------------------------------------------------------------------
function DashCustomTab({ tab, reloadKey, extraWidgetIds, widgetTitlesByKey = {}, onOpenWidgetLib, onRemoveWidget, onRenameWidget }) {
  const widgets = extraWidgetIds
    .map((id) => WIDGET_LIBRARY.find((w) => w.id === id))
    .filter(Boolean);
  return (
    <div className="dash dash--tabbed" key={`${tab.id}-${reloadKey}`} data-screen-label={`Dashboard · ${tab.label}`}>
      {widgets.length === 0 ? (
        <div className="dash-custom-empty">
          <span className="dash-custom-empty-ic" aria-hidden="true">
            <Icon name={tab.icon} size={36} />
          </span>
          <h2 className="dash-custom-empty-title">{tab.label}</h2>
          <p className="dash-custom-empty-sub">
            Build out this tab with widgets from the library. You can mix data, alerts, and quick actions.
          </p>
          <button type="button" className="dash-btn" onClick={onOpenWidgetLib}>
            <Icon name="AddCircle" size={18} />
            Add a widget
          </button>
        </div>
      ) : (
        <div className="dash-custom-grid">
          {widgets.map((w) => {
            const Render = w.Render;
            const titleOverride = widgetTitlesByKey[`${tab.id}::${w.id}`];
            const widgetProp = { id: w.id, title: titleOverride };
            return (
              <Render
                key={w.id}
                widget={widgetProp}
                onRemove={() => onRemoveWidget && onRemoveWidget(tab.id, w.id)}
                onRename={() => onRenameWidget && onRenameWidget(tab.id, w.id)}
              />
            );
          })}
          <button type="button" className="dash-custom-addmore" onClick={onOpenWidgetLib}>
            <Icon name="AddCircle" size={20} />
            <span>Add widget</span>
          </button>
        </div>
      )}
    </div>
  );
}

// =====================================================================
// Dashboard widget chrome — universal 3-dot edit/remove menu.
//
// Decorates EVERY widget card across every dashboard tab and org lane
// (frontline, professional, SOW, contractor, agency, custom tabs) with
// an overflow menu offering "Rename widget" and "Remove from dashboard".
// The card components themselves stay untouched; this controller injects
// the affordance in the DOM and persists rename / remove state to
// localStorage so edits survive reloads, tab switches, and React
// re-renders. Library widgets that already ship their own React menu
// (.dash-widget-menu-wrap) are skipped so they don't double up.
//
// Keys are scoped by the card's `data-screen-label` ancestor + its
// default title, so removing "Calendar" on the frontline Overview never
// affects a same-named card on another lane.
// =====================================================================
const DashWidgetChrome = (function () {
  const LS_KEY = "flexwork.dash.widgetChrome.v1";
  let state = { removed: {}, titles: {} };
  try {
    const raw = window.localStorage.getItem(LS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      state.removed = parsed.removed || {};
      state.titles = parsed.titles || {};
    }
  } catch (e) { /* fall back to empty state */ }
  function persist() {
    try { window.localStorage.setItem(LS_KEY, JSON.stringify(state)); } catch (e) {}
  }

  // --- icon SVGs (reuse the Everest assets the app already ships) ------
  const iconCache = {};
  function fetchIcon(name) {
    if (iconCache[name] != null) return Promise.resolve(iconCache[name]);
    return fetch(`assets/icons/${name}.svg`)
      .then((r) => (r.ok ? r.text() : ""))
      .then((t) => { iconCache[name] = t; return t; })
      .catch(() => { iconCache[name] = ""; return ""; });
  }
  function paintIcon(el, name) { fetchIcon(name).then((svg) => { if (svg) el.innerHTML = svg; }); }

  function scopeFor(card) {
    const scoped = card.closest("[data-screen-label]");
    return (scoped && scoped.getAttribute("data-screen-label")) || "dash";
  }
  function titleNodeOf(card) {
    return card.querySelector(".dash-card-title, .aw-card-title");
  }
  function keyFor(scope, title) {
    return scope + "::" + title;
  }

  // --- shared rename modal (built once, reused) ------------------------
  let modal = null;
  function buildModal() {
    if (modal) return modal;
    const scrim = document.createElement("div");
    scrim.className = "ix-scrim";
    const dialog = document.createElement("div");
    dialog.className = "ix-dialog dash-tab-modal";
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "true");
    dialog.setAttribute("aria-label", "Rename widget");
    dialog.innerHTML =
      '<header class="ix-dialog-head">' +
        '<div class="dash-tab-modal-head">' +
          '<span class="dash-tab-modal-head-ic" data-wf-edit-ic aria-hidden="true"></span>' +
          '<div><h2>Rename widget</h2>' +
          '<p class="dash-tab-modal-sub">Give this widget a name that fits how you\'ll use it.</p></div>' +
        '</div>' +
        '<button type="button" class="iconbtn" data-wf-close aria-label="Close"></button>' +
      '</header>' +
      '<div class="ix-dialog-body dash-tab-modal-body">' +
        '<label class="dash-field">' +
          '<span class="dash-field-label">Widget title</span>' +
          '<input type="text" class="dash-field-input" data-wf-input maxlength="56" />' +
          '<span class="dash-field-help">Default: <em data-wf-default></em></span>' +
        '</label>' +
      '</div>' +
      '<footer class="ix-dialog-foot dash-tab-modal-foot">' +
        '<button type="button" class="dash-modal-btn dash-modal-btn--tertiary" data-wf-reset title="Reset to default title">Reset to default</button>' +
        '<div class="dash-tab-modal-foot-right">' +
          '<button type="button" class="dash-modal-btn dash-modal-btn--tertiary" data-wf-cancel>Cancel</button>' +
          '<button type="button" class="dash-modal-btn dash-modal-btn--primary" data-wf-save>Save</button>' +
        '</div>' +
      '</footer>';
    document.body.appendChild(scrim);
    document.body.appendChild(dialog);
    paintIcon(dialog.querySelector("[data-wf-edit-ic]"), "Edit");
    paintIcon(dialog.querySelector("[data-wf-close]"), "X");
    modal = {
      scrim, dialog,
      input: dialog.querySelector("[data-wf-input]"),
      defaultEm: dialog.querySelector("[data-wf-default]"),
      close: dialog.querySelector("[data-wf-close]"),
      cancel: dialog.querySelector("[data-wf-cancel]"),
      save: dialog.querySelector("[data-wf-save]"),
      reset: dialog.querySelector("[data-wf-reset]"),
      ctx: null,
    };
    const hide = () => { scrim.classList.remove("open"); dialog.classList.remove("open"); modal.ctx = null; };
    const onKey = (e) => {
      if (!dialog.classList.contains("open")) return;
      if (e.key === "Escape") hide();
      if (e.key === "Enter") { e.preventDefault(); commit(); }
    };
    const commit = () => {
      if (!modal.ctx) return;
      const { card } = modal.ctx;
      const val = (modal.input.value || "").trim();
      const def = card.dataset.wfTitle || "";
      const tn = titleNodeOf(card);
      if (!val || val === def) {
        delete state.titles[card.dataset.wfKey];
        if (tn) tn.textContent = def;
      } else {
        state.titles[card.dataset.wfKey] = val;
        if (tn) tn.textContent = val;
      }
      persist();
      hide();
      if (window.showToast) window.showToast("Widget renamed", { kind: "success" });
    };
    modal.commit = commit;
    modal.hide = hide;
    scrim.addEventListener("click", hide);
    modal.close.addEventListener("click", hide);
    modal.cancel.addEventListener("click", hide);
    modal.save.addEventListener("click", commit);
    modal.reset.addEventListener("click", () => {
      if (!modal.ctx) return;
      modal.input.value = modal.ctx.card.dataset.wfTitle || "";
      modal.input.focus();
      modal.input.select();
    });
    document.addEventListener("keydown", onKey);
    return modal;
  }
  function openRename(card) {
    const m = buildModal();
    m.ctx = { card };
    const def = card.dataset.wfTitle || "";
    const cur = state.titles[card.dataset.wfKey];
    m.defaultEm.textContent = def;
    m.input.value = cur != null ? cur : def;
    m.scrim.classList.add("open");
    m.dialog.classList.add("open");
    setTimeout(() => { try { m.input.focus(); m.input.select(); } catch (e) {} }, 30);
  }

  function removeCard(card) {
    state.removed[card.dataset.wfKey] = true;
    persist();
    card.style.display = "none";
    card.dataset.wfHidden = "1";
    if (window.showToast) window.showToast("Widget removed from dashboard", { kind: "default" });
  }

  // --- one document-level handler closes any open card menu ------------
  let menuBound = false;
  function bindMenuDismiss() {
    if (menuBound) return;
    menuBound = true;
    const closeAll = (e) => {
      document.querySelectorAll(".dash-wf-menu:not([hidden])").forEach((menu) => {
        if (e && menu.parentNode && menu.parentNode.contains(e.target)) return;
        menu.hidden = true;
        const btn = menu.parentNode && menu.parentNode.querySelector(".dash-wf-btn");
        if (btn) btn.setAttribute("aria-expanded", "false");
      });
    };
    document.addEventListener("mousedown", closeAll);
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeAll(null); });
  }

  function injectMenu(card) {
    const wrap = document.createElement("div");
    wrap.className = "dash-wf";
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "dash-wf-btn";
    btn.setAttribute("aria-haspopup", "menu");
    btn.setAttribute("aria-expanded", "false");
    btn.setAttribute("aria-label", "Widget options");
    paintIcon(btn, "MoreVert");
    const menu = document.createElement("div");
    menu.className = "dash-wf-menu";
    menu.setAttribute("role", "menu");
    menu.hidden = true;
    const editBtn = document.createElement("button");
    editBtn.type = "button";
    editBtn.className = "dash-wf-item";
    editBtn.setAttribute("role", "menuitem");
    editBtn.innerHTML = '<span class="dash-wf-item-ic" data-ic></span><span>Rename widget</span>';
    paintIcon(editBtn.querySelector("[data-ic]"), "Edit");
    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "dash-wf-item dash-wf-item--danger";
    removeBtn.setAttribute("role", "menuitem");
    removeBtn.innerHTML = '<span class="dash-wf-item-ic" data-ic></span><span>Remove from dashboard</span>';
    paintIcon(removeBtn.querySelector("[data-ic]"), "TrashCan");
    menu.appendChild(editBtn);
    menu.appendChild(removeBtn);
    wrap.appendChild(btn);
    wrap.appendChild(menu);

    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const willOpen = menu.hidden;
      // close other open menus first
      document.querySelectorAll(".dash-wf-menu:not([hidden])").forEach((m) => {
        m.hidden = true;
        const b = m.parentNode && m.parentNode.querySelector(".dash-wf-btn");
        if (b) b.setAttribute("aria-expanded", "false");
      });
      menu.hidden = !willOpen;
      btn.setAttribute("aria-expanded", willOpen ? "true" : "false");
    });
    editBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      menu.hidden = true;
      btn.setAttribute("aria-expanded", "false");
      openRename(card);
    });
    removeBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      menu.hidden = true;
      removeCard(card);
    });
    card.appendChild(wrap);
  }

  // --- per-card processing --------------------------------------------
  function processCard(card) {
    if (card.dataset.wfDone === "1") return;
    // skip the "Add a widget" promo card and any card that already has a
    // native React widget menu.
    if (card.classList.contains("dash-addw-card")) { card.dataset.wfDone = "1"; return; }
    if (card.querySelector(".dash-widget-menu-wrap")) { card.dataset.wfDone = "1"; return; }
    const tn = titleNodeOf(card);
    if (!tn) { card.dataset.wfDone = "1"; return; }
    const def = (tn.textContent || "").trim();
    if (!def) return; // title not painted yet; try again next sweep
    const scope = scopeFor(card);
    const key = keyFor(scope, def);
    card.dataset.wfDone = "1";
    card.dataset.wfKey = key;
    card.dataset.wfTitle = def;
    card.classList.add("dash-wf-card");
    if (state.removed[key]) {
      card.style.display = "none";
      card.dataset.wfHidden = "1";
      return;
    }
    if (state.titles[key] != null) tn.textContent = state.titles[key];
    injectMenu(card);
  }

  let scheduled = false;
  function sweep(root) {
    scheduled = false;
    if (!root) return;
    bindMenuDismiss();
    const scopes = root.matches && root.matches(".dash--tabbed, .aw-home")
      ? [root]
      : Array.prototype.slice.call(root.querySelectorAll(".dash--tabbed, .aw-home"));
    scopes.forEach((sc) => {
      sc.querySelectorAll(".dash-card, .aw-card").forEach(processCard);
    });
  }

  function mount(root) {
    if (!root) return function () {};
    const run = () => {
      if (scheduled) return;
      scheduled = true;
      // NB: use setTimeout, not requestAnimationFrame — rAF is starved
      // while the preview iframe is backgrounded, which would leave
      // cards undecorated on load / reload.
      window.setTimeout(() => sweep(root), 0);
    };
    // Initial decoration runs synchronously so cards are chromed even if
    // the tab is never foregrounded.
    sweep(root);
    const obs = new MutationObserver(() => run());
    obs.observe(root, { childList: true, subtree: true });
    return function cleanup() { obs.disconnect(); };
  }

  return { mount };
})();

// ---------------------------------------------------------------------
// Page root
// ---------------------------------------------------------------------

function DashboardPage({
  reloadKey,
  onReload,
  onGoTo,
  sessionName = "Amy",
  viewAsRole = "admin",
  locationIds = null,
  tab = "overview"
}) {
  // Engagement type — only meaningful when the Professional Work flag
  // is on; remembered per session so users can dwell on either lane.
  const professionalOn = window.useFeatureFlag ? window.useFeatureFlag("professionalWork") : false;
  const sowOn          = window.useFeatureFlag ? window.useFeatureFlag("sow")             : false;
  const contractorsOn  = window.useFeatureFlag ? window.useFeatureFlag("contractors")     : false;
  // Compliance tab on Home — off by default; admins flip it on via Settings → Feature flags.
  const complianceTabOn = window.useFeatureFlag ? window.useFeatureFlag("dashboardCompliance") : false;
  // If the tab was just turned off while the user was on it, fall back to Overview.
  const effectiveTab = tab === "compliance" && !complianceTabOn ? "overview" : tab;
  const [engagementType, setEngagementType] = useStateDash(() => {
    try { return window.sessionStorage.getItem("flexwork.dash.engagementType") || "frontline"; }
    catch (e) { return "frontline"; }
  });
  useEffectDash(() => {
    try { window.sessionStorage.setItem("flexwork.dash.engagementType", engagementType); }
    catch (e) { /* no-op */ }
  }, [engagementType]);
  // If a lane's flag flips off while the user is sitting on it, snap
  // back to Frontline so the user lands on a lane that matches state.
  useEffectDash(() => {
    if (!professionalOn && engagementType === "professional") setEngagementType("frontline");
    if (!sowOn          && engagementType === "sow")          setEngagementType("frontline");
    if (!contractorsOn  && engagementType === "contractor")   setEngagementType("frontline");
  }, [professionalOn, sowOn, contractorsOn, engagementType]);
  const tabCounts = useMemoDash(() => {
    // Compliance tab now hosts industry credentialing — count
    // expired + missing across the active industry's pack.
    let credAlerts = 0;
    const packs = window.CRED_PACKS;
    const id = window.getCurrentIndustryId && window.getCurrentIndustryId() || "manufacturing";
    const pack = packs && (packs[id] || packs.manufacturing) || null;
    if (pack) {
      pack.workers.forEach((w) => {
        Object.values(w.creds || {}).forEach((c) => {
          if (c.s === "err" || c.s === "missing") credAlerts++;
        });
      });
    } else {
      credAlerts = (window.COMPLIANCE || []).filter((c) => c.level !== "ok").length;
    }
    // Insights tab badge: surface count of budgets that are over or
    // approaching their cap. (Used to live on the separate Financials
    // tab, now folded into Insights.)
    let budgetAlerts = 0;
    const budgets = window.bud_store && window.bud_store() || window.__budgetsStore || [];
    budgets.forEach((r) => {
      const s = window.bud_status && window.bud_status(r);
      if (s && (s.key === "over" || s.key === "warn")) budgetAlerts++;
    });
    return {
      overview: 0,
      inbox: (window.APPROVALS || []).length,
      insights: budgetAlerts,
      compliance: credAlerts
    };
  }, [reloadKey]);

  // Library state — added widgets per active tab, custom tabs in the
  // strip, and the open/closed state of the library + add-tab popovers.
  const [extraTabs, setExtraTabs] = useStateDash([]);
  const [extraWidgetsByTab, setExtraWidgetsByTab] = useStateDash({});
  // Per-instance widget title overrides, keyed by `${tabId}::${widgetId}`.
  const [widgetTitlesByKey, setWidgetTitlesByKey] = useStateDash({});
  const [widgetLibOpen, setWidgetLibOpen] = useStateDash(false);
  const [addTabOpen, setAddTabOpen] = useStateDash(false);
  // Rename modal — { tabId, widgetId } when open.
  const [renameTarget, setRenameTarget] = useStateDash(null);

  // Universal widget chrome — adds the 3-dot edit/remove menu to every
  // card across every tab and org lane. Mounted once on the body root;
  // a MutationObserver re-decorates cards as tabs / lanes swap in.
  const managedRootRef = React.useRef(null);
  useEffectDash(() => {
    if (!managedRootRef.current || !window.DashWidgetChrome) return;
    return window.DashWidgetChrome.mount(managedRootRef.current);
  }, []);

  // Locally-routed extra tab id (overrides the prop `tab` when set).
  const [extraActiveTab, setExtraActiveTab] = useStateDash(null);
  const resolvedTab = extraActiveTab || effectiveTab;
  const resolvedIsExtra = extraTabs.some((t) => t.id === resolvedTab);

  const setTab = (id) => {
    // Custom tabs stay on this page (the dashboard handles their body)
    // rather than navigating away.
    if (extraTabs.some((t) => t.id === id)) {
      setExtraActiveTab(id);
      return;
    }
    // Agency "Action" tab — local body, handled on this page like a custom tab.
    if (id === "action") {
      setExtraActiveTab("action");
      return;
    }
    if (!onGoTo) return;
    setExtraActiveTab(null);
    onGoTo(id === "overview" ? "dashboard" : id);
  };

  // Handle the user creating a new custom tab from the popover.
  const handleCreateTab = ({ name, icon }) => {
    const trimmed = (name || "").trim();
    if (!trimmed) return;
    // Generate a stable id from the name. Collisions get a numeric suffix.
    const base = "custom-" + trimmed.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "custom";
    let id = base;
    let n = 2;
    while (extraTabs.some((t) => t.id === id)) {
      id = `${base}-${n++}`;
    }
    setExtraTabs((prev) => [...prev, { id, label: trimmed, icon: icon || "Performance", custom: true }]);
    setExtraWidgetsByTab((prev) => ({ ...prev, [id]: [] }));
    setAddTabOpen(false);
    setExtraActiveTab(id);
  };

  const handleRemoveExtra = (id) => {
    setExtraTabs((prev) => prev.filter((t) => t.id !== id));
    setExtraWidgetsByTab((prev) => {
      const n = { ...prev };
      delete n[id];
      return n;
    });
    if (extraActiveTab === id) setExtraActiveTab(null);
  };

  // Remove a widget from a tab.
  const handleRemoveWidget = (tabId, widgetId) => {
    setExtraWidgetsByTab((prev) => {
      const cur = prev[tabId] || [];
      return { ...prev, [tabId]: cur.filter((w) => w !== widgetId) };
    });
    // Also clear any custom title override.
    setWidgetTitlesByKey((prev) => {
      const n = { ...prev };
      delete n[`${tabId}::${widgetId}`];
      return n;
    });
  };

  // Open the rename modal for a widget instance.
  const handleOpenRename = (tabId, widgetId) => {
    setRenameTarget({ tabId, widgetId });
  };

  // Save / reset (null) a widget's custom title.
  const handleSaveRename = (newTitle) => {
    if (!renameTarget) return;
    const key = `${renameTarget.tabId}::${renameTarget.widgetId}`;
    setWidgetTitlesByKey((prev) => {
      const n = { ...prev };
      if (newTitle === null || newTitle === "") {
        delete n[key];
      } else {
        n[key] = newTitle;
      }
      return n;
    });
    setRenameTarget(null);
  };

  const scopedLabel = useMemoDash(() => {
    if (viewAsRole !== "manager") return "All sites";
    const locs = window.LOCATIONS || [];
    if (!locationIds || locationIds.length === 0) return "All assigned sites";
    if (locationIds.length === 1) {
      const l = locs.find((x) => x.id === locationIds[0]);
      return l ? l.name : "Selected location";
    }
    return `${locationIds.length} locations`;
  }, [viewAsRole, locationIds]);

  const handlePrimary = () => onGoTo && onGoTo({ page: "requisitions", sub: "new" });

  // Per-tab toolbar (sits in a strip aligned with the tab strip, on the right).
  let tabToolbar = null;
  if (effectiveTab === "insights") {
    // Insights now hosts both spend analytics and budget posture — give
    // admins quick access to the budgets surface plus an export action.
    tabToolbar =
    <React.Fragment>
        <button
        type="button"
        className="iconbtn"
        onClick={() => onGoTo && onGoTo({ page: "settings", sub: "budgets" })}
        aria-label="Manage budgets"
        title="Manage budgets">
          <Icon name="Adjustment" size={18} />
        </button>
        <button type="button" className="iconbtn" onClick={() => showToast("Exported CSV")} aria-label="Export" title="Export">
          <Icon name="Export" size={18} />
        </button>
      </React.Fragment>;

  } else if (effectiveTab === "compliance") {
    const packs = window.CRED_PACKS;
    const id = window.getCurrentIndustryId && window.getCurrentIndustryId() || "manufacturing";
    const pack = packs && (packs[id] || packs.manufacturing) || null;
    const auditAction = pack && pack.domain && pack.domain.auditAction || "Audit log";
    const psvAction = pack && pack.domain && pack.domain.psvAction || "Run audit";
    const packetToast = pack && pack.domain && pack.domain.packetToast || "Audit packet generated";
    const psvToast = pack && pack.domain && pack.domain.psvToast || "Audit run started";
    tabToolbar =
    <React.Fragment>
        <button type="button" className="iconbtn" onClick={() => showToast(packetToast)} aria-label={auditAction} title={auditAction}>
          <Icon name="FileDownload" size={18} />
        </button>
        <button type="button" className="iconbtn" onClick={() => showToast(psvToast)} aria-label={psvAction} title={psvAction}>
          <Icon name="ShieldPerson" size={18} />
        </button>
      </React.Fragment>;

  }

  let body = null;
  if (resolvedTab === "action" && window.AgencyHomePanel) {
    body = <AgencyHomePanel onGoTo={onGoTo} viewAsRole={viewAsRole} />;
  } else if (resolvedIsExtra) {
    const tpl = extraTabs.find((t) => t.id === resolvedTab);
    body = (
      <DashCustomTab
        tab={tpl}
        reloadKey={reloadKey}
        extraWidgetIds={extraWidgetsByTab[resolvedTab] || []}
        widgetTitlesByKey={widgetTitlesByKey}
        onOpenWidgetLib={() => setWidgetLibOpen(true)}
        onRemoveWidget={handleRemoveWidget}
        onRenameWidget={handleOpenRename}
      />
    );
  } else if (effectiveTab === "inbox") {
    body = <InboxPage reloadKey={reloadKey} onReload={onReload} onGoTo={onGoTo} embedded />;
  } else if (effectiveTab === "insights") {
    body = <InsightsPage reloadKey={reloadKey} onReload={onReload} embedded />;
  } else if (effectiveTab === "compliance") {
    body = <CredentialingPage reloadKey={reloadKey} onReload={onReload} embedded />;
  } else if (professionalOn && engagementType === "professional") {
    body = <DashProfessional reloadKey={reloadKey} onGoTo={onGoTo} />;
  } else if (sowOn && engagementType === "sow") {
    body = <DashSOW reloadKey={reloadKey} onGoTo={onGoTo} />;
  } else if (contractorsOn && engagementType === "contractor" && window.DashContractor) {
    body = <window.DashContractor reloadKey={reloadKey} onGoTo={onGoTo} />;
  } else {
    body =
    <DashOverview
      reloadKey={reloadKey}
      onGoTo={onGoTo}
      viewAsRole={viewAsRole}
      locationIds={locationIds}
      scopedLabel={scopedLabel}
      extraWidgetIds={extraWidgetsByTab["overview"] || []}
      widgetTitlesByKey={widgetTitlesByKey}
      tabId="overview"
      onOpenWidgetLib={() => setWidgetLibOpen(true)}
      onRemoveWidget={handleRemoveWidget}
      onRenameWidget={handleOpenRename} />;


  }

  return (
    <React.Fragment>
      {/* Persistent header — full-bleed hero banner, then the intro
                card aligned to the main content rail. Both stay visible
                across every section of the Home hub. */}
      <DashHero
        name={sessionName}
        role={viewAsRole}
        scopedLabel={scopedLabel}
        onPrimary={handlePrimary} />
      
      <div className="dash-tabbar-wrap">
        <div className="dash-tabbar">
          <DashTabs
            active={resolvedTab}
            counts={tabCounts}
            onChange={setTab}
            showCompliance={complianceTabOn}
            viewAsRole={viewAsRole}
            extraTabs={extraTabs}
            onRemoveExtra={handleRemoveExtra}
            onAddTab={() => setAddTabOpen(true)}
            addTabOpen={addTabOpen}
          />
          <div className="dash-tabbar-actions">
            {effectiveTab === "overview" && (professionalOn || sowOn || contractorsOn) && (
              <PwEngagementSwitch
                value={engagementType}
                onChange={setEngagementType}
                professionalOn={professionalOn}
                sowOn={sowOn}
                contractorsOn={contractorsOn}
              />
            )}
            {tabToolbar}
            <button
              type="button"
              className="iconbtn"
              onClick={(e) => openMenu(e.currentTarget, [
                { icon: "AddCircle", label: "Add new tab", onClick: () => setAddTabOpen(true) },
                { icon: "Grid", label: "Add new widget", onClick: () => setWidgetLibOpen(true) },
              ])}
              aria-label="Add to dashboard"
              aria-haspopup="menu"
              aria-expanded={addTabOpen}
              title="Add to dashboard">

              <Icon name="AddCircle" size={18} />
            </button>
            <button
              type="button"
              className="iconbtn"
              onClick={onReload}
              aria-label="Reload content"
              title="Reload content">
              
              <Icon name="Refresh" size={18} />
            </button>
          </div>
        </div>
      </div>

      <div className="dash-managed-root" ref={managedRootRef}>
        {body}
      </div>

      <DashWidgetLibrary
        open={widgetLibOpen}
        addedIds={extraWidgetsByTab[resolvedTab] || []}
        onAdd={(id) => {
          setExtraWidgetsByTab((prev) => {
            const cur = prev[resolvedTab] || [];
            if (cur.includes(id)) return prev;
            return { ...prev, [resolvedTab]: [...cur, id] };
          });
        }}
        onClose={() => setWidgetLibOpen(false)}
      />

      <DashAddTabModal
        open={addTabOpen}
        existingLabels={extraTabs.map((t) => t.label)}
        onCreate={handleCreateTab}
        onClose={() => setAddTabOpen(false)}
      />

      {renameTarget && (() => {
        const tpl = WIDGET_LIBRARY.find((w) => w.id === renameTarget.widgetId);
        if (!tpl) return null;
        const defaultTitle =
          tpl.id === "top-suppliers"   ? "Top suppliers · fill rate" :
          tpl.id === "spend-snapshot"  ? "Spend this week"           :
          tpl.id === "active-alerts"   ? "Active alerts"             :
          tpl.name;
        const currentTitle = widgetTitlesByKey[`${renameTarget.tabId}::${renameTarget.widgetId}`];
        return (
          <DashWidgetRenameModal
            open={true}
            defaultTitle={defaultTitle}
            currentTitle={currentTitle}
            onSave={handleSaveRename}
            onClose={() => setRenameTarget(null)}
          />
        );
      })()}
    </React.Fragment>);

}

// =====================================================================
// AGENCY HOME — the supplier-side workbench (Universal Parity tasks).
// Rendered at the top of Home when viewing as Agency on a staffing-
// agency tenant. Reuses existing globals only: WORKERS, REQUISITIONS,
// TIMESHEETS, REQ_SUPPLIERS, AssignmentEngine, getCredentialingForWorker,
// wfPerfFor, getAgencySupplierId. Available to every agency (Free
// included) — these cover VMS-routed work, so they are NOT Pro-gated.
//   T1 inbox · T2 response clocks · T6 broadcast · T12 expiry watchlist
//   T18 scorecard · T19 tier transparency · T20 forecast · T21 AI match
// =====================================================================
function _awHash(s) { let h = 0; const str = String(s || ""); for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0; return h >>> 0; }
function _awEng() { return (typeof window !== "undefined" && window.AssignmentEngine) || null; }
function _awAvail(w) { const e = _awEng(); try { return e && e.availabilityFor ? e.availabilityFor(w, {}) : { level: "ok", label: "Available" }; } catch (x) { return { level: "ok", label: "Available" }; } }
function _awCred(w) { const e = _awEng(); try { return e && e.credentialSummary ? e.credentialSummary(w) : { level: "ok", label: "Cleared", expiring: [], blockers: [] }; } catch (x) { return { level: "ok", label: "Cleared", expiring: [], blockers: [] }; } }
function _awRating(w) { try { return (window.wfPerfFor && window.wfPerfFor(w).rating) || (4.2 + (_awHash(w.id || w.name) % 8) / 10); } catch (x) { return 4.5; } }
function _awReqTitle(r) { return (r.jobs && r.jobs[0]) || r.title || r.role || ("Requisition #" + (r.id || "")); }
function _awReqOpen(r) {
  const s = String(r.status || "").toLowerCase();
  // Demand the agency can still act on: open/sourcing/distributing, plus
  // the demo's live states (Booked / In progress). Completed is done.
  if (/complete|closed|cancel|fill?ed\b/.test(s)) return false;
  return /open|sourc|distrib|fill|active|partial|pending|booked|progress|assign/.test(s);
}
// Mode for a requisition, via the shared job-driven engine.
function _awMode(r) { const e = _awEng(); return e && e.modeFor ? e.modeFor(r.engagementType || r.engType || "Shift") : "allocate"; }

// Relative-deadline clock (T2). Deterministic per item, ticks each minute.
function AwClock({ id, baseDueMin }) {
  const [, force] = useStateDash(0);
  useEffectDash(() => { const t = setInterval(() => force((n) => n + 1), 60000); return () => clearInterval(t); }, []);
  const due = baseDueMin != null ? baseDueMin : (30 + (_awHash(id) % 560));
  // count down from a session-anchored start
  if (!window.__awClockBase) window.__awClockBase = Date.now();
  const elapsed = Math.floor((Date.now() - window.__awClockBase) / 60000);
  const left = Math.max(0, due - elapsed);
  const h = Math.floor(left / 60), m = left % 60;
  const urgent = left <= 45 ? "1" : (left <= 180 ? "warn" : "0");
  return (
    <span className="aw-clock" data-urgent={urgent}>
      <Icon name="Hourglass" size={12} />
      {left === 0 ? "Due now" : "Due in " + (h ? h + "h " : "") + m + "m"}
    </span>
  );
}

// Broadcast composer (T6) — fan one open requisition to many bench
// workers via the existing offer loop (AssignmentEngine.createOffer).
function AwBroadcastModal({ req, bench, supplierId, preselect, onClose }) {
  const elig = bench.map((w) => {
    const a = _awAvail(w), c = _awCred(w);
    return { w, a, c, ok: a.level !== "fail" && c.level !== "fail" };
  });
  const [sel, setSel] = useStateDash(() => new Set((preselect || []).map((w) => w.id || w.name)));
  const toggle = (id) => setSel((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const send = () => {
    const e = _awEng();
    const chosen = elig.filter((x) => sel.has(x.w.id || x.w.name) && x.ok);
    chosen.forEach((x) => { if (e && e.createOffer) e.createOffer({ workerId: x.w.id || x.w.name, workerName: x.w.name, role: _awReqTitle(req), supplierId, day: "" }); });
    if (window.showToast) window.showToast(chosen.length + " offer" + (chosen.length === 1 ? "" : "s") + " sent · first qualified accept fills the shift", { kind: "success" });
    onClose();
  };
  const count = [...sel].filter((id) => { const x = elig.find((e2) => (e2.w.id || e2.w.name) === id); return x && x.ok; }).length;
  return (
    <div className="aw-modal-scrim" onClick={onClose}>
      <div className="aw-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Broadcast shift">
        <div className="aw-modal-h">
          <h3>Broadcast to bench</h3>
          <button className="aw-x" onClick={onClose} aria-label="Close"><Icon name="Cancel" size={18} /></button>
        </div>
        <div className="aw-modal-body">
          <p className="aw-hint">Fan <b>{_awReqTitle(req)}</b> to qualified, available bench workers. The first to accept fills it; the rest are released. Unavailable or non-compliant workers can't be selected.</p>
          <div className="aw-pick">
            {elig.map(({ w, a, c, ok }) => (
              <label key={w.id || w.name} className="aw-pick-row" aria-disabled={!ok}>
                <input type="checkbox" disabled={!ok} checked={sel.has(w.id || w.name)} onChange={() => ok && toggle(w.id || w.name)} />
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span className="aw-pick-name">{w.name}</span>
                  <span className="aw-pick-meta">{(w.jobs && w.jobs[0]) || w.role || "Worker"} · {ok ? a.label : (c.level === "fail" ? c.label : a.label)}</span>
                </span>
              </label>
            ))}
          </div>
        </div>
        <div className="aw-modal-foot">
          <button className="aw-btn aw-btn--ghost" onClick={onClose}>Cancel</button>
          <button className="aw-btn" disabled={!count} onClick={send}>Send {count || ""} offer{count === 1 ? "" : "s"}</button>
        </div>
      </div>
    </div>
  );
}

function AgencyHomePanel({ onGoTo, viewAsRole }) {
  const role = viewAsRole || window.flexViewAsRole;
  const isAgency = !!(window.isAgencyOrg && window.isAgencyOrg()) && role === "agency";
  const [, bump] = useStateDash(0);
  useEffectDash(() => {
    const e = _awEng(); if (!e || !e.subscribe) return;
    return e.subscribe(() => bump((n) => n + 1));
  }, []);
  const [bcast, setBcast] = useStateDash(null); // { req, preselect }
  if (!isAgency) return null;

  const sup = (window.getAgencySupplierId && window.getAgencySupplierId()) || "sw";
  const supMeta = (window.REQ_SUPPLIERS || {})[sup] || { label: "Your agency" };
  const bench = (window.WORKERS || []);
  const reqs = (window.REQUISITIONS || []);
  const timesheets = (window.TIMESHEETS || []);
  const eng = _awEng();

  // ---- scorecard (T18) — stable synthetic where live data is absent ---
  const seed = _awHash(sup);
  const score = {
    fill: 88 + (seed % 9),
    ttf: 5 + (seed % 6),
    noShow: 2 + (seed % 4),
    s2h: 28 + (seed % 18),
    attend: 95 + (seed % 4),
    resp: 90 + (seed % 8),
  };

  // ---- bench supply summary -------------------------------------------
  const benchStats = bench.reduce((acc, w) => {
    const a = _awAvail(w), c = _awCred(w);
    if (a.level !== "fail") acc.available++;
    if (c.level !== "ok") acc.credWatch.push({ w, c });
    return acc;
  }, { available: 0, credWatch: [] });

  // ---- open requisitions awaiting a response --------------------------
  const openReqsAll = reqs.filter((r) => _awReqOpen(r) && (!r.suppliers || r.suppliers.length === 0 || r.suppliers.includes(sup)));
  const openReqs = openReqsAll.slice(0, 8);

  // ---- inbox aggregation (T1) -----------------------------------------
  const inbox = [];
  openReqs.slice(0, 4).forEach((r) => {
    const mode = _awMode(r);
    inbox.push({
      id: "req-" + (r.id || _awReqTitle(r)),
      kind: mode === "allocate" ? "fill" : (mode === "submit" ? "submit" : "propose"),
      icon: mode === "allocate" ? "PersonPlus" : (mode === "submit" ? "Send" : "PersonLines"),
      title: (mode === "allocate" ? "Fill: " : mode === "submit" ? "Submit candidate: " : "Propose team: ") + _awReqTitle(r),
      sub: (r.location || r.org || supMeta.label) + " · " + (r.engagementType || (mode === "allocate" ? "Shift" : "Assignment")),
      due: 30 + (_awHash(r.id || _awReqTitle(r)) % 300),
      req: r, mode,
    });
  });
  const pendingOffers = eng && eng.pendingOffersForWorker ? eng.pendingOffersForWorker(null) : [];
  if (pendingOffers.length) {
    inbox.push({ id: "offers", kind: "offer", icon: "PersonClock", title: pendingOffers.length + " shift offer" + (pendingOffers.length === 1 ? "" : "s") + " awaiting response", sub: "Workers deciding on broadcast offers", due: 60 });
  }
  const tsExceptions = timesheets.filter((t) => /reject|disput|return|query/i.test(String(t.status || ""))).slice(0, 2);
  tsExceptions.forEach((t, i) => inbox.push({ id: "ts-" + (t.id || i), kind: "timesheet", icon: "PersonClock", title: "Timesheet returned: " + (t.worker || t.name || t.id), sub: "Fix and resubmit to release payment", due: 120 + i * 30 }));
  benchStats.credWatch.slice(0, 2).forEach((cw, i) => inbox.push({ id: "cred-" + (cw.w.id || i), kind: "credential", icon: "ShieldPerson", title: "Credential " + (cw.c.level === "fail" ? "expired" : "expiring") + ": " + cw.w.name, sub: (cw.c.blockers[0] || cw.c.expiring[0] || "Renew to keep assignable"), due: cw.c.level === "fail" ? 30 : 600 }));
  inbox.sort((a, b) => a.due - b.due);

  // ---- AI bench-match assist (T21) ------------------------------------
  const matchReq = openReqs[0];
  const matches = matchReq ? bench.map((w) => {
    const a = _awAvail(w), c = _awCred(w), rating = _awRating(w);
    const sc = (a.level === "ok" ? 40 : a.level === "warn" ? 20 : 0) + (c.level === "ok" ? 35 : c.level === "warn" ? 15 : 0) + Math.round(rating * 5);
    return { w, sc, a, c, rating, ok: a.level !== "fail" && c.level !== "fail" };
  }).filter((m) => m.ok).sort((a, b) => b.sc - a.sc).slice(0, 3) : [];

  // ---- forecast (T20) -------------------------------------------------
  const weekShifts = openReqsAll.reduce((n, r) => n + (Number(r.openings || r.count || r.needed) || 1), 0);
  const clientSet = new Set(openReqsAll.map((r) => r.location || r.org || supMeta.label));
  const recurring = openReqsAll.filter((r) => r.recurring || /weekly|recurring/i.test(String(r.cadence || ""))).length;

  // ---- tier / ranking (T19) -------------------------------------------
  const tier = 1 + (seed % 2); // Tier 1 or 2
  const rankPos = 1 + (seed % 4), rankOf = 5 + (seed % 3);

  const scoreCells = [
    { lab: "Fill rate", val: score.fill + "%", dir: "up" },
    { lab: "Time to fill", val: score.ttf, suf: "h", dir: "up" },
    { lab: "No-show", val: score.noShow + "%", dir: score.noShow <= 4 ? "up" : "down" },
    { lab: "Submit→hire", val: score.s2h + "%", dir: "up" },
    { lab: "Attendance", val: score.attend + "%", dir: "up" },
    { lab: "Responsiveness", val: score.resp + "%", dir: "up" },
  ];

  return (
    <div className="dash dash--tabbed" data-screen-label="Dashboard · Action">
    <div className="aw-home">

      {/* Scorecard (T18) + tier transparency (T19) */}
      <div className="aw-row aw-row--2">
        <div className="aw-card">
          <div className="aw-card-h">
            <h2 className="aw-card-title">Your scorecard</h2>
            <span className="aw-card-sub">Rolling 90 days · how {supMeta.label} is measured</span>
          </div>
          <div className="aw-score">
            {scoreCells.map((c) => (
              <div className="aw-score-cell" key={c.lab}>
                <span className="aw-score-val">{c.val}{c.suf ? <small> {c.suf}</small> : null}</span>
                <span className="aw-score-lab">{c.lab}</span>
                <span className="aw-score-trend" data-dir={c.dir}><Icon name={c.dir === "up" ? "ChevronUp" : "ChevronDown"} size={11} /> vs last period</span>
              </div>
            ))}
          </div>
        </div>
        <div className="aw-card">
          <div className="aw-card-h"><h2 className="aw-card-title">Supplier standing</h2></div>
          <div className="aw-rank">
            <div className="aw-rank-badge"><b>{rankPos}</b><span>of {rankOf}</span></div>
            <div className="aw-rank-body">
              You're a <b>Tier {tier}</b> supplier, ranked <b>#{rankPos}</b> of {rankOf} on this program. Tier 1 receives new requisitions first. Lift your <b>{score.fill < 92 ? "fill rate" : "submit→hire ratio"}</b> to move up.
            </div>
          </div>
        </div>
      </div>

      {/* Inbox (T1) + response clocks (T2) */}
      <div className="aw-card">
        <div className="aw-card-h">
          <h2 className="aw-card-title">Action center</h2>
          <span className="aw-card-sub">{inbox.length} item{inbox.length === 1 ? "" : "s"} need a response</span>
        </div>
        <div className="aw-inbox">
          {inbox.length === 0 && <div className="aw-empty">You're all caught up. New requests appear here.</div>}
          {inbox.map((it) => (
            <div className="aw-inbox-item" key={it.id}>
              <span className="aw-inbox-ic" data-kind={it.kind}><Icon name={it.icon} size={18} /></span>
              <div className="aw-inbox-main">
                <div className="aw-inbox-title">{it.title}</div>
                <div className="aw-inbox-sub">{it.sub}</div>
              </div>
              <div className="aw-inbox-right">
                <AwClock id={it.id} baseDueMin={it.due} />
                {it.kind === "fill" && it.req
                  ? <button className="aw-inbox-btn" onClick={() => setBcast({ req: it.req, preselect: [] })}>Broadcast</button>
                  : it.kind === "submit" || it.kind === "propose"
                    ? <button className="aw-inbox-btn" onClick={() => onGoTo && onGoTo({ page: "requisitions" })}>Respond</button>
                    : it.kind === "timesheet"
                      ? <button className="aw-inbox-btn aw-inbox-btn--ghost" onClick={() => onGoTo && onGoTo({ page: "timesheets" })}>Fix</button>
                      : it.kind === "credential"
                        ? <button className="aw-inbox-btn aw-inbox-btn--ghost" onClick={() => onGoTo && onGoTo({ page: "workforce" })}>Review</button>
                        : <button className="aw-inbox-btn aw-inbox-btn--ghost" onClick={() => onGoTo && onGoTo({ page: "schedule" })}>View</button>}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="aw-row aw-row--3">
        {/* AI bench-match assist (T21) */}
        <div className="aw-card">
          <div className="aw-card-h"><h2 className="aw-card-title">Suggested matches</h2></div>
          {matchReq ? (
            <React.Fragment>
              <span className="aw-card-sub">Best bench fit for <b>{_awReqTitle(matchReq)}</b></span>
              <div className="aw-list">
                {matches.map((m) => (
                  <div className="aw-list-row" key={m.w.id || m.w.name}>
                    <span className="aw-list-k"><b>{m.w.name}</b></span>
                    <span className="aw-list-v">{m.sc}% match · ★ {m.rating.toFixed(1)}</span>
                  </div>
                ))}
                {matches.length === 0 && <div className="aw-empty">No available bench match. Onboard or free up workers.</div>}
              </div>
              {matches.length > 0 && <button className="aw-btn aw-btn--ghost" style={{ alignSelf: "flex-start" }} onClick={() => setBcast({ req: matchReq, preselect: matches.map((m) => m.w) })}><Icon name="Send" size={14} /> Broadcast to top {matches.length}</button>}
            </React.Fragment>
          ) : <div className="aw-empty">No open requisitions right now.</div>}
        </div>

        {/* Forecast (T20) */}
        <div className="aw-card">
          <div className="aw-card-h"><h2 className="aw-card-title">Upcoming demand</h2></div>
          <div className="aw-list">
            <div className="aw-list-row"><span className="aw-list-k">Open this week</span><span className="aw-list-v"><b>{weekShifts}</b> positions</span></div>
            <div className="aw-list-row"><span className="aw-list-k">Across clients</span><span className="aw-list-v"><b>{clientSet.size}</b></span></div>
            <div className="aw-list-row"><span className="aw-list-k">Recurring patterns</span><span className="aw-list-v"><b>{recurring}</b></span></div>
            <div className="aw-list-row"><span className="aw-list-k">Bench available</span><span className="aw-list-v"><b>{benchStats.available}</b> of {bench.length}</span></div>
          </div>
        </div>

        {/* Expiring-credential watchlist (T12) */}
        <div className="aw-card">
          <div className="aw-card-h"><h2 className="aw-card-title">Compliance watch</h2></div>
          {benchStats.credWatch.length === 0 ? <div className="aw-empty">All bench credentials current.</div> : (
            <div className="aw-list">
              {benchStats.credWatch.slice(0, 5).map((cw) => (
                <div className="aw-list-row" key={cw.w.id || cw.w.name}>
                  <span className="aw-list-k"><span className="aw-dot" data-s={cw.c.level}></span><b>{cw.w.name}</b></span>
                  <span className="aw-list-v">{cw.c.label}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {bcast && <AwBroadcastModal req={bcast.req} preselect={bcast.preselect} bench={bench} supplierId={sup} onClose={() => setBcast(null)} />}
    </div>
    </div>
  );
}

Object.assign(window, { DashboardPage, AgencyHomePanel, DashWidgetChrome });