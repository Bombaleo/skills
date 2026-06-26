// =====================================================================
// Flex Work — Schedule · Operator console + Open shifts
//
// Two new top-level sub-views for the Schedule page:
//
//   • TodayConsole  — operational "what's happening" view. Pulse hero
//                     with a today timeline + KPIs, then streams for
//                     workers currently on the floor, what's coming up
//                     next, exceptions that need a human, and coverage
//                     health by location.
//
//   • OpenShiftsView — coverage gaps grouped by urgency horizon. Each
//                      gap is a single-card surface listing role / dates
//                      / location with quick fill actions inline.
//
// Both deliberately AVOID past/active/future terminology. Time is
// communicated through state verbs (On the floor · Standing by · En
// route · Wrapping · Closed · Open · Flagged) and a single NOW playhead.
//
// The prototype's "now" is Thursday Apr 23, 2026 @ 10:30 AM.
// =====================================================================

const { useState: useStateScC, useMemo: useMemoScC, useEffect: useEffectScC, useRef: useRefScC } = React;

// ---------- Now anchor ---------------------------------------------------
// Derived from the shared flexToday() so the operator console's
// "Now" indicator, the calendar's today column, and the period label
// in the schedule rail all agree.
const _SCH_NOW_DATE = window.flexToday ? window.flexToday() : new Date(2026, 4, 19);
const _SCH_NOW_DAY_KEYS  = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
const SCH_NOW = {
  dayKey: _SCH_NOW_DAY_KEYS[_SCH_NOW_DATE.getDay()],
  date:   _SCH_NOW_DATE.getDate(),
  hour:   10,
  minute: 30,
};
const SCH_NOW_LABEL = _SCH_NOW_DATE.toLocaleDateString("en-US", {
  weekday: "long", month: "long", day: "numeric",
}) + " · 10:30 AM";
const SCH_NOW_MIN   = SCH_NOW.hour * 60 + SCH_NOW.minute;

// ---------- Time helpers --------------------------------------------------

// "6:00 AM–3:00 PM" → { startMin: 360, endMin: 900 }. Overnight shifts
// have endMin > 24*60 so simple comparisons still work.
function parseShiftTime(t) {
  if (!t || typeof t !== "string") return { startMin: 0, endMin: 0 };
  const parts = t.split(/\s*[–-]\s*/);
  const parseAt = (s) => {
    const m = /(\d+):(\d+)\s*(AM|PM)/i.exec((s || "").trim());
    if (!m) return 0;
    let h = parseInt(m[1], 10);
    const min = parseInt(m[2], 10);
    const ap = m[3].toUpperCase();
    if (ap === "PM" && h !== 12) h += 12;
    if (ap === "AM" && h === 12) h = 0;
    return h * 60 + min;
  };
  let startMin = parseAt(parts[0]);
  let endMin   = parseAt(parts[1] || parts[0]);
  if (endMin <= startMin) endMin += 24 * 60;
  return { startMin, endMin };
}

function formatMinutes(min) {
  let m = ((min % (24 * 60)) + 24 * 60) % (24 * 60);
  const h24 = Math.floor(m / 60);
  const mm = m % 60;
  const ap = h24 >= 12 ? "PM" : "AM";
  let h = h24 % 12; if (h === 0) h = 12;
  return `${h}:${String(mm).padStart(2, "0")} ${ap}`;
}

// Compact human duration. 95 → "1h 35m", 35 → "35 min", -10 → "10 min ago"
function humanDelta(min) {
  const abs = Math.abs(min);
  let s;
  if (abs < 60)         s = `${abs} min`;
  else if (abs < 60*10) s = `${Math.floor(abs / 60)}h ${abs % 60}m`;
  else                  s = `${Math.floor(abs / 60)}h`;
  return min < 0 ? `${s} ago` : s;
}

// ---------- Operator snapshot data (Thu Apr 23, 10:30 AM) ----------------
// Hand-curated to tell a coherent story. Worker IDs reference WORKERS;
// reqId / location track REQUISITIONS so links into Booking detail work.

const TODAY_SHIFTS = [
  // On the floor
  { id: "s-1", worker: "w-ml", role: "Production Associate",      time: "6:00 AM–3:00 PM",  clockIn: "5:58 AM", clockOut: null, reqId: "J6K7L8M9N0", location: "Carrollton Distribution Center", note: null,                       channel: "floor"  },
  { id: "s-2", worker: "w-jc", role: "Line Manager",           time: "7:00 AM–4:00 PM",  clockIn: "7:02 AM", clockOut: null, reqId: "Z6A7B8C9D0", location: "Stockton Logistics Hub",          note: null,                       channel: "floor"  },
  { id: "s-3", worker: "w-mw", role: "Factory Line Assembler", time: "7:00 AM–3:30 PM",  clockIn: "6:54 AM", clockOut: null, reqId: "O1P2Q3R4S5", location: "Distribution Site 2",             note: "On meal break · 5m",       channel: "floor", state: "break" },
  { id: "s-4", worker: "w-pr", role: "Production Associate",      time: "9:00 AM–5:00 PM",  clockIn: "8:51 AM", clockOut: null, reqId: "Y1Z2A3B4C5", location: "Stockton Logistics Hub",          note: null,                       channel: "floor"  },
  // Flagged — late arrival
  { id: "s-5", worker: "w-ss", role: "Warehouse Clerk",        time: "8:00 AM–4:00 PM",  clockIn: null,      clockOut: null, reqId: "T6U7V8W9X0", location: "Fremont Cross-dock",              note: "No clock-in · 2h 30m late", channel: "flag",  flag: "late"   },
  // Standing by / en route
  { id: "s-6", worker: "w-ks", role: "Server",                 time: "11:00 AM–7:00 PM", clockIn: null,      clockOut: null, reqId: "J6K7L8M9N0", location: "Carrollton Distribution Center", note: "En route · ETA 10:42 AM",  channel: "soon",  confirmed: true  },
  { id: "s-7", worker: "w-cc", role: "Prep Cook",              time: "12:00 PM–8:00 PM", clockIn: null,      clockOut: null, reqId: "J6K7L8M9N0", location: "Carrollton Distribution Center", note: "Confirmed yesterday",      channel: "soon",  confirmed: true  },
  { id: "s-8", worker: null,   role: "Production Associate",      time: "12:00 PM–8:00 PM", clockIn: null,      clockOut: null, reqId: "J6K7L8M9N0", location: "Carrollton Distribution Center", note: "Open · 1 of 1 unfilled",   channel: "open"   },
  // Later starts
  { id: "s-9",  worker: "w-mh", role: "Server",                time: "4:00 PM–12:00 AM", clockIn: null,      clockOut: null, reqId: "Z6A7B8C9D0", location: "Stockton Logistics Hub",          note: "Awaiting confirmation",    channel: "soon",  confirmed: false },
  { id: "s-10", worker: "w-ja", role: "Bartender",             time: "4:00 PM–12:00 AM", clockIn: null,      clockOut: null, reqId: "Z6A7B8C9D0", location: "Stockton Logistics Hub",          note: "Confirmed",                channel: "soon",  confirmed: true  },
  { id: "s-11", worker: null,   role: "Server",                time: "4:00 PM–12:00 AM", clockIn: null,      clockOut: null, reqId: "Z6A7B8C9D0", location: "Stockton Logistics Hub",          note: "Open · supplier searching",channel: "open"   },
];

// Open positions across the wider horizon (used by Open view + by some
// console counters). Each entry: { reqId, role, location, dateLabel,
// dayOffset, time, openOf, totalSlots }.
const OPEN_SHIFTS = [
  // Today
  { id: "o-1", reqId: "J6K7L8M9N0", role: "Production Associate",      location: "Carrollton Distribution Center", dateLabel: "Today · Thu Apr 23", dayOffset: 0, time: "12:00 PM–8:00 PM", openOf: 1, totalSlots: 1, postedAgo: "2h ago",  suppliers: ["sw","th","gs"] },
  { id: "o-2", reqId: "Z6A7B8C9D0", role: "Server",                 location: "Stockton Logistics Hub",          dateLabel: "Today · Thu Apr 23", dayOffset: 0, time: "4:00 PM–12:00 AM", openOf: 1, totalSlots: 2, postedAgo: "30m ago", suppliers: ["sw"] },
  // Tomorrow
  { id: "o-3", reqId: "Y1Z2A3B4C5", role: "Production Associate",      location: "Stockton Logistics Hub",          dateLabel: "Tomorrow · Fri Apr 24", dayOffset: 1, time: "6:00 AM–3:00 PM",  openOf: 2, totalSlots: 4, postedAgo: "yesterday",  suppliers: ["sw","th","ph"] },
  { id: "o-4", reqId: "K1L2M3N4O5", role: "Production Associate",      location: "Inland Empire Hub",               dateLabel: "Tomorrow · Fri Apr 24", dayOffset: 1, time: "6:00 AM–3:00 PM",  openOf: 1, totalSlots: 3, postedAgo: "yesterday",  suppliers: ["th"] },
  // Rest of week
  { id: "o-5", reqId: "O1P2Q3R4S5", role: "Factory Line Assembler", location: "Distribution Site 2",             dateLabel: "Sat Apr 25", dayOffset: 2,        time: "7:00 AM–3:30 PM",  openOf: 2, totalSlots: 4, postedAgo: "3d ago",  suppliers: ["ss"] },
  { id: "o-6", reqId: "T6U7V8W9X0", role: "Warehouse Clerk",        location: "Fremont Cross-dock",              dateLabel: "Sun Apr 26", dayOffset: 3,        time: "8:00 AM–4:00 PM",  openOf: 3, totalSlots: 4, postedAgo: "5d ago",  suppliers: ["sw","ss"] },
  // Beyond
  { id: "o-7", reqId: "E1F2G3H4I5", role: "Production Associate",      location: "Lakeside Fulfillment",            dateLabel: "Mon Apr 27", dayOffset: 4,        time: "6:00 AM–3:00 PM",  openOf: 2, totalSlots: 6, postedAgo: "1w ago",  suppliers: ["sw","th","ph"] },
  { id: "o-8", reqId: "P6Q7R8S9T0", role: "Production Associate",      location: "Carrollton Distribution Center", dateLabel: "Tue Apr 28", dayOffset: 5,        time: "6:00 AM–3:00 PM",  openOf: 4, totalSlots: 5, postedAgo: "1w ago",  suppliers: ["sw","th"] },
];

// Coverage by location (today snapshot).
const COVERAGE_BY_LOC = [
  { name: "Carrollton Distribution Center", filled: 4, needed: 5 },
  { name: "Stockton Logistics Hub",         filled: 5, needed: 7 },
  { name: "Distribution Site 2",            filled: 4, needed: 4 },
  { name: "Fremont Cross-dock",             filled: 0, needed: 3 },
];

// ---------- State token (pill + bar colour) ------------------------------
// State is a single small vocab that drives every operator surface.
// Hue choices stick to Everest semantic tokens.

const STATE_META = {
  floor:    { label: "On the floor",  hue: "success",     dot: "var(--evr-green-400)"  },
  break:    { label: "On break",      hue: "warning",     dot: "var(--evr-yellow-400)" },
  wrapping: { label: "Wrapping",      hue: "informative", dot: "var(--evr-blue-400)"   },
  soon:     { label: "Standing by",   hue: "informative", dot: "var(--evr-blue-300)"   },
  enroute:  { label: "En route",      hue: "informative", dot: "var(--evr-blue-400)"   },
  open:     { label: "Open",          hue: "error",       dot: "var(--evr-red-400)"    },
  flagged:  { label: "Flagged",       hue: "error",       dot: "var(--evr-red-400)"    },
  closed:   { label: "Closed",        hue: "default",     dot: "var(--evr-neutral-50)" },
  later:    { label: "Scheduled",     hue: "default",     dot: "var(--evr-neutral-60)" },
};

function StatePill({ state, children }) {
  const meta = STATE_META[state] || STATE_META.later;
  return (
    <span className={`tc-pill tc-pill--${meta.hue}`}>
      <span className="tc-pill-dot" style={{ background: meta.dot }} aria-hidden="true" />
      <span>{children || meta.label}</span>
    </span>
  );
}

// Resolve the operator state of a row (a TODAY_SHIFTS entry).
// `day` is the DAY_FULFILLMENT-shaped object the timeline is rendering;
// when it represents a past or future day, every filled shift collapses
// to the matching summary state (closed / later) regardless of clock
// data. Only the actual "today" runs the live SCH_NOW comparison.
function rowState(s, day) {
  if (s.channel === "open")     return "open";
  if (s.channel === "flag")     return "flagged";
  if (day && day.isPast)        return "closed";
  if (day && !day.isToday)      return "later";
  if (s.state === "break")      return "break";
  const { startMin, endMin } = parseShiftTime(s.time);
  if (s.clockIn) {
    if (endMin - SCH_NOW_MIN <= 60) return "wrapping";
    return "floor";
  }
  if (s.note && /en route/i.test(s.note)) return "enroute";
  return "soon";
}

// ---------- Pulse hero: KPIs + today's timeline -------------------------

function PulseHeroKpi({ icon, label, value, hue = "default", onClick, active }) {
  return (
    <button
      type="button"
      className={`tc-kpi tc-kpi--${hue}${active ? " tc-kpi--active" : ""}`}
      onClick={onClick}
    >
      <span className="tc-kpi-icon" aria-hidden="true">
        <Icon name={icon} size={18} />
      </span>
      <span className="tc-kpi-text">
        <span className="tc-kpi-value tabular">{value}</span>
        <span className="tc-kpi-label">{label}</span>
      </span>
    </button>
  );
}

// Today's coverage timeline — shifts grouped by location, each shift
// drawn as a labelled bar against a 6 AM → midnight hour axis. A single
// NOW playhead spans every row.
const TL_LEGEND = [
  { state: "floor",   label: "On the floor" },
  { state: "break",   label: "On break"     },
  { state: "wrapping",label: "Wrapping"     },
  { state: "enroute", label: "En route"     },
  { state: "soon",    label: "Standing by"  },
  { state: "open",    label: "Open"         },
  { state: "flagged", label: "Flagged"      },
];

function packLanes(items) {
  const sorted = [...items].sort((a, b) =>
    parseShiftTime(a.time).startMin - parseShiftTime(b.time).startMin
  );
  const lanes = [];
  sorted.forEach((s) => {
    const { startMin } = parseShiftTime(s.time);
    let placed = false;
    for (let i = 0; i < lanes.length; i++) {
      const lastEnd = parseShiftTime(lanes[i][lanes[i].length - 1].time).endMin;
      if (lastEnd <= startMin) { lanes[i].push(s); placed = true; break; }
    }
    if (!placed) lanes.push([s]);
  });
  return lanes;
}

// Group dimension config for the operator timeline's left column. Each
// entry describes how to bucket shifts and how to label the column head.
const TC_GROUPBY = {
  booking: {
    head: "Work assignment",
    keyOf: (s) => s.reqId || "—",
    labelOf: (s) => {
      const reqs = (typeof REQUISITIONS !== "undefined" && REQUISITIONS) || [];
      const req = reqs.find((r) => r.id === s.reqId);
      const job = req && req.jobs && req.jobs[0];
      return job ? `${job} · #${s.reqId}` : `Work assignment #${s.reqId || "—"}`;
    },
  },
  location: {
    head: "Location",
    keyOf: (s) => s.location || "Unscoped",
    labelOf: (s) => s.location || "Unscoped",
  },
  worker: {
    head: "Worker",
    keyOf: (s) => s.worker || `open-${s.role}`,
    labelOf: (s) => {
      if (!s.worker) return `Open · ${s.role}`;
      const w = (typeof WORKERS !== "undefined" && WORKERS.find((x) => x.id === s.worker)) || null;
      return w ? w.name : s.worker;
    },
  },
  supplier: {
    head: "Supplier",
    keyOf: (s) => {
      if (!s.worker) return "open";
      const w = (typeof WORKERS !== "undefined" && WORKERS.find((x) => x.id === s.worker)) || null;
      return (w && w.supplier) || "internal";
    },
    labelOf: (s) => {
      if (!s.worker) return "Unfilled (open)";
      const w = (typeof WORKERS !== "undefined" && WORKERS.find((x) => x.id === s.worker)) || null;
      const supId = w && w.supplier;
      const sup = supId && (typeof REQ_SUPPLIERS !== "undefined") && REQ_SUPPLIERS[supId];
      return (sup && sup.label) || (w && w.pool ? `${w.pool} pool` : "Internal");
    },
  },
  status: {
    head: "Status",
    keyOf: (s) => rowState(s),
    labelOf: (s) => {
      const meta = STATE_META[rowState(s)] || STATE_META.later;
      return meta.label;
    },
  },
};

function TodayTimeline({ shifts, day, groupBy = "booking", onOpenBooking, onOpenShift }) {
  const grouper = TC_GROUPBY[groupBy] || TC_GROUPBY.booking;
  const START_HOUR = 0;
  const END_HOUR   = 24;
  const TOTAL_MIN  = (END_HOUR - START_HOUR) * 60;
  // `day` is optional — when omitted, the timeline behaves as the
  // original "today" surface (curated SCH_NOW playhead + live state
  // logic). When present, past / future days collapse to a static
  // schedule view without the NOW indicator.
  const isToday = !day || !!day.isToday;

  // Hover preview state — captures the bar's bounding rect so the hover
  // card can pick whichever side of the screen has room to render fully.
  const [hover, setHover] = useStateScC(null);
  // Sync paired loc/track row heights so the two columns stay aligned
  // even when one side (longer name wrap on the left, more lanes on
  // the right) is naturally taller than the other. Both sides use
  // min-height in CSS; this picks the max of the two per row.
  const tlRef = useRefScC(null);
  const showHover = (s, e) => {
    const r = e.currentTarget.getBoundingClientRect();
    setHover({
      shift: s,
      centerX: r.left + r.width / 2,
      belowY: r.bottom + 8,
      aboveY: r.top - 8,
    });
  };
  const hideHover = () => setHover(null);

  // Group by the selected dimension, preserving first-seen order.
  const groupMap = new Map();
  const groupLabels = new Map();
  shifts.forEach((s) => {
    const key = grouper.keyOf(s);
    if (!groupMap.has(key)) {
      groupMap.set(key, []);
      groupLabels.set(key, grouper.labelOf(s));
    }
    groupMap.get(key).push(s);
  });
  const locations = Array.from(groupMap.entries()).map(([key, items]) => {
    let status;
    if (!isToday) {
      status = day.isPast ? "past" : "upcoming";
    } else {
      let hasActive = false, hasPast = false, hasUpcoming = false;
      items.forEach((s) => {
        const { startMin, endMin } = parseShiftTime(s.time);
        if (startMin <= SCH_NOW_MIN && SCH_NOW_MIN < endMin) hasActive = true;
        else if (endMin <= SCH_NOW_MIN)                       hasPast = true;
        else                                                  hasUpcoming = true;
      });
      status = hasActive ? "active" : hasUpcoming ? "upcoming" : "past";
    }
    return { name: groupLabels.get(key), key, items, lanes: packLanes(items), status };
  });

  const ticks = [];
  for (let h = START_HOUR; h <= END_HOUR; h++) ticks.push(h);

  const nowFrac = (SCH_NOW_MIN - START_HOUR * 60) / TOTAL_MIN;

  const tickLabel = (h) =>
    h === 0 || h === 24 ? "12 AM" :
    h === 12             ? "12 PM" :
    h > 12               ? `${h - 12} PM` : `${h} AM`;

  // After render, equalize paired loc/track row heights. Clear any
  // previous inline override first so we re-measure each side's
  // natural height, then apply the per-row max to both.
  React.useLayoutEffect(() => {
    const root = tlRef.current;
    if (!root) return;
    const sync = () => {
      const locs   = root.querySelectorAll(".tc-tl-left > .tc-tl-loc");
      const tracks = root.querySelectorAll(".tc-tl-right > .tc-tl-track");
      const n = Math.min(locs.length, tracks.length);
      for (let i = 0; i < n; i++) {
        locs[i].style.minHeight = "";
        tracks[i].style.minHeight = "";
      }
      for (let i = 0; i < n; i++) {
        const h = Math.max(locs[i].offsetHeight, tracks[i].offsetHeight);
        locs[i].style.minHeight   = h + "px";
        tracks[i].style.minHeight = h + "px";
      }
    };
    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(root);
    return () => ro.disconnect();
  }, [shifts, day]);

  return (
    <div ref={tlRef} className="tc-tl" style={{ "--tc-tl-now": nowFrac }}>
      {/* LEFT: fixed booking column */}
      <div className="tc-tl-left">
        <div className="tc-tl-left-head">{grouper.head}</div>
        {locations.map((loc) => (
          <div key={loc.key} className="tc-tl-loc" style={{ "--tc-tl-lanes": loc.lanes.length }}>
            <span className="tc-tl-loc-name">{loc.name}</span>
            <span className={`tc-tl-status tc-tl-status--${loc.status}`}>
              {loc.status === "active" ? "Active" : loc.status === "upcoming" ? "Upcoming" : "Past"}
            </span>
          </div>
        ))}
      </div>

      {/* RIGHT: scrollable timeline */}
      <div className="tc-tl-right">
        <div className="tc-tl-axis" aria-hidden="true">
          {ticks.map((h) => (
            <span
              key={h}
              className={`tc-tl-axis-tick${h % 2 === 0 ? " tc-tl-axis-tick--major" : ""}`}
              style={{ left: `${((h - START_HOUR) * 60 / TOTAL_MIN) * 100}%` }}
            >
              {h % 2 === 0 && <span className="tc-tl-axis-tick-label">{tickLabel(h)}</span>}
            </span>
          ))}
          <span
            className="tc-tl-now-pill tabular"
            style={{ left: `calc(100% * var(--tc-tl-now))`, display: isToday ? null : "none" }}
            aria-label={`Now ${formatMinutes(SCH_NOW_MIN)}`}
          >
            {formatMinutes(SCH_NOW_MIN)}
          </span>
        </div>

        {locations.map((loc) => (
          <div key={loc.key} className="tc-tl-track" style={{ "--tc-tl-lanes": loc.lanes.length }} role="presentation">
              {ticks.map((h) => (
                <span
                  key={h}
                  className={`tc-tl-gridline${h % 2 === 0 ? " tc-tl-gridline--major" : ""}`}
                  style={{ left: `${((h - START_HOUR) * 60 / TOTAL_MIN) * 100}%` }}
                />
              ))}

              <span className="tc-tl-now-line" aria-hidden="true" style={isToday ? null : { display: "none" }} />

              {loc.lanes.map((lane, li) => (
                <div key={li} className="tc-tl-lane">
                  {lane.map((s) => {
                    const { startMin, endMin } = parseShiftTime(s.time);
                    const clamped0 = Math.max(START_HOUR * 60, startMin);
                    const clamped1 = Math.min(END_HOUR * 60, endMin);
                    const left  = ((clamped0 - START_HOUR * 60) / TOTAL_MIN) * 100;
                    const width = ((clamped1 - clamped0)      / TOTAL_MIN) * 100;
                    const st = rowState(s, day);
                    const worker = s.worker ? (WORKERS.find((w) => w.id === s.worker) || null) : null;
                    const name = worker ? worker.name : "Open position";
                    const meta = STATE_META[st] || STATE_META.later;
                    return (
                      <button
                        key={s.id}
                        type="button"
                        className={`tc-tl-bar tc-tl-bar--${st}`}
                        style={{ left: `${left}%`, width: `${width}%` }}
                        onClick={() => {
                          // Timeline bars represent today's individual shifts.
                          // Filled shifts deep-link straight to the shift
                          // detail page; open positions fall back to the
                          // parent booking (no worker → no shift scope).
                          if (s.worker) {
                            const shiftId = buildBookingId({
                              reqId: s.reqId,
                              workerId: s.worker,
                              weekDayIdx: 3,
                            });
                            if (onOpenShift) onOpenShift(shiftId);
                            else if (onOpenBooking) onOpenBooking(shiftId);
                          } else if (onOpenBooking) {
                            onOpenBooking(s.reqId);
                          }
                        }}
                        onMouseEnter={(e) => showHover(s, e)}
                        onFocus={(e) => showHover(s, e)}
                        onMouseLeave={hideHover}
                        onBlur={hideHover}
                        aria-label={`${name}, ${s.role}, ${s.time}, ${meta.label}`}
                      >
                        <span className="tc-tl-bar-strip" aria-hidden="true" />
                        <span className="tc-tl-bar-text">
                          <span className="tc-tl-bar-name">{name}</span>
                          <span className="tc-tl-bar-role">{s.role}</span>
                        </span>
                        <span className="tc-tl-bar-time tabular">{s.time}</span>
                      </button>
                    );
                  })}
                </div>
              ))}
          </div>
        ))}
      </div>

      {hover && <TimelineHoverCard hover={hover} day={day} />}
    </div>
  );
}

// ---------- Timeline hover card ----------------------------------------

function TimelineHoverCard({ hover, day }) {
  const { shift: s, centerX, belowY, aboveY } = hover;
  const st = rowState(s, day);
  const worker = s.worker ? (WORKERS.find((w) => w.id === s.worker) || null) : null;
  const sup    = worker ? (REQ_SUPPLIERS && REQ_SUPPLIERS[worker.supplier]) || null : null;
  const name   = worker ? worker.name : "Open position";
  const meta   = STATE_META[st] || STATE_META.later;

  // Map state → tag tone for the status pill.
  const tone =
    st === "floor" || st === "wrapping" ? "active"   :
    st === "soon"  || st === "enroute"  ? "upcoming" :
    st === "open"  || st === "flagged"  ? "open"     :
    st === "break"                       ? "active"   :
    st === "later"                       ? "upcoming" :
    "past";

  // Measure the card after first render so we can clamp it inside the
  // viewport — keeps the card on the visible side of the screen and
  // flips above the bar when there's no room below.
  const ref = React.useRef(null);
  const [pos, setPos] = React.useState({ top: belowY, left: centerX, ready: false });
  React.useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const m = 12; // viewport margin

    // Horizontal: prefer centered under the bar, then clamp into viewport.
    let left = centerX - w / 2;
    if (left < m) left = m;
    if (left + w > vw - m) left = vw - m - w;

    // Vertical: prefer below the bar; flip above if it would overflow.
    let top = belowY;
    if (top + h > vh - m) {
      const flipped = aboveY - h;
      if (flipped >= m) {
        top = flipped;
      } else {
        // Neither side fits cleanly — keep it on-screen.
        top = Math.max(m, vh - m - h);
      }
    }
    setPos({ top, left, ready: true });
  }, [centerX, belowY, aboveY, s.id]);

  return (
    <div
      ref={ref}
      className="tc-tl-hover"
      style={{
        top: `${pos.top}px`,
        left: `${pos.left}px`,
        visibility: pos.ready ? "visible" : "hidden",
      }}
      role="tooltip"
    >
      <div className="tc-tl-hover-head">
        <span className={`tc-tl-status tc-tl-status--${tone}`}>{meta.label}</span>
        <span className="tc-tl-hover-time tabular">{s.time}</span>
      </div>
      <div className="tc-tl-hover-name">{name}</div>
      <div className="tc-tl-hover-role">{s.role}</div>
      <ul className="tc-tl-hover-meta-list">
        <li>
          <Icon name="Location" size={12} />
          <span>{s.location}</span>
        </li>
        {worker && sup && (
          <li>
            <Icon name="Building" size={12} />
            <span>{sup.label || sup.name || worker.supplier}</span>
          </li>
        )}
        {s.clockIn && (
          <li>
            <Icon name="Check" size={12} />
            <span>Clocked in {s.clockIn}</span>
          </li>
        )}
        {s.reqId && (
          <li>
            <Icon name="Briefcase" size={12} />
            <span className="tabular">{s.reqId}</span>
          </li>
        )}
      </ul>
      {s.note && <div className="tc-tl-hover-note">{s.note}</div>}
    </div>
  );
}

function PulseHero({ onOpenBooking, onOpenShift }) {
  return (
    <section className="tc-hero">
      <TodayTimeline shifts={TODAY_SHIFTS} onOpenBooking={onOpenBooking} onOpenShift={onOpenShift} />
    </section>
  );
}

// ---------- Shared row primitive ----------------------------------------

function ShiftRow({ s, onOpenBooking, onOpenShift, dense = false }) {
  const worker = s.worker ? (WORKERS.find((w) => w.id === s.worker) || null) : null;
  const sup = worker ? (REQ_SUPPLIERS[worker.supplier] || null) : null;
  const st = rowState(s);
  const stMeta = STATE_META[st];
  const { startMin, endMin } = parseShiftTime(s.time);
  // Secondary metric — context that changes with state
  let metric;
  if (st === "floor" || st === "break")  metric = { label: "On floor",  value: humanDelta(SCH_NOW_MIN - startMin) };
  else if (st === "wrapping")            metric = { label: "Ends in",   value: humanDelta(endMin - SCH_NOW_MIN) };
  else if (st === "soon" || st === "enroute") metric = { label: "Starts in", value: humanDelta(startMin - SCH_NOW_MIN) };
  else if (st === "open")                metric = { label: "Starts in", value: humanDelta(startMin - SCH_NOW_MIN) };
  else if (st === "flagged")             metric = { label: "Was due",   value: humanDelta(SCH_NOW_MIN - startMin) };
  else                                   metric = { label: "Starts",    value: formatMinutes(startMin) };

  // Click target — open the booking row for that worker
  const onClick = () => {
    if (!onOpenBooking) return;
    if (s.worker) {
      onOpenBooking(buildBookingId({ reqId: s.reqId, workerId: s.worker, weekDayIdx: 3 }));
    } else {
      onOpenBooking(s.reqId);
    }
  };

  return (
    <div
      className={`tc-row tc-row--${st}${dense ? " tc-row--dense" : ""}`}
      role="row"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === "Enter") onClick(); }}
    >
      <span className={`tc-row-bar tc-row-bar--${stMeta.hue}`} aria-hidden="true" />

      <div className="tc-row-who">
        {worker ? (
          <div className="tc-row-avatar">
            <WorkerAvatar w={worker} size={32} />
            {sup && (
              <span
                className="tc-row-avatar-sup"
                style={{ background: sup.bg, color: sup.fg }}
                aria-hidden="true"
                title={sup.label}
              />
            )}
          </div>
        ) : (
          <div className="tc-row-avatar tc-row-avatar--open" aria-hidden="true">
            <Icon name="PersonPlus" size={16} />
          </div>
        )}
        <div className="tc-row-who-text">
          <span className="tc-row-name">{worker ? worker.name : "Open position"}</span>
          <span className="tc-row-sub">
            <span className="tc-row-role">{s.role}</span>
            {sup && <React.Fragment><span aria-hidden="true">·</span><span>{sup.label}</span></React.Fragment>}
            {!worker && <React.Fragment><span aria-hidden="true">·</span><span>Distributing</span></React.Fragment>}
          </span>
        </div>
      </div>

      <div className="tc-row-when">
        <span className="tc-row-when-time tabular">{s.time}</span>
        <span className="tc-row-when-loc">
          <Icon name="Location" size={12} />
          <span>{s.location}</span>
        </span>
      </div>

      <div className="tc-row-metric">
        <span className="tc-row-metric-label">{metric.label}</span>
        <span className="tc-row-metric-value tabular">{metric.value}</span>
      </div>

      <div className="tc-row-state">
        <StatePill state={st}>
          {st === "break" ? "On break" :
           st === "enroute" ? "En route" :
           st === "flagged" ? "Late arrival" :
           stMeta.label}
        </StatePill>
        {s.note && <span className="tc-row-note">{s.note}</span>}
      </div>

      <div className="tc-row-actions">
        {st === "flagged" && (
          <button
            type="button"
            className="btn btn--sm btn--secondary"
            onClick={(e) => { e.stopPropagation(); showToast(`Calling ${worker ? worker.name : "worker"}…`); }}
          >
            <Icon name="Phone" size={14} />
            Reach
          </button>
        )}
        {st === "open" && (
          <button
            type="button"
            className="btn btn--sm btn--primary"
            onClick={(e) => { e.stopPropagation(); showToast("Posted to all suppliers", { kind: "success" }); }}
          >
            <Icon name="Send" size={14} />
            Boost
          </button>
        )}
        {st !== "flagged" && st !== "open" && (
          <button
            type="button"
            className="iconbtn"
            aria-label="Row actions"
            onClick={(e) => {
              e.stopPropagation();
              openMenu(e.currentTarget, [
                { icon: "View",        label: "Open shift",     onClick },
                { icon: "PersonClock", label: "View timesheet", onClick: () => showToast("Opening timesheet") },
                { icon: "Send",     label: "Notify worker",  onClick: () => showToast("Notification sent") },
              ]);
            }}
          >
            <Icon name="MoreVert" size={18} />
          </button>
        )}
        <span className="tc-row-chev" aria-hidden="true"><Icon name="ChevronRight" size={18} /></span>
      </div>
    </div>
  );
}

// ---------- Streams (collapsible sections) ------------------------------

function StreamSection({ id, icon, title, count, hint, accent = "default", defaultOpen = true, children }) {
  const [open, setOpen] = useStateScC(defaultOpen);
  return (
    <section className={`tc-stream tc-stream--${accent}`} id={id}>
      <button
        type="button"
        className="tc-stream-head"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span className={`tc-stream-icon tc-stream-icon--${accent}`} aria-hidden="true">
          <Icon name={icon} size={18} />
        </span>
        <div className="tc-stream-title">
          <h3>{title}</h3>
          {hint && <span className="tc-stream-hint">{hint}</span>}
        </div>
        {typeof count === "number" && <span className="tc-stream-count tabular">{count}</span>}
        <span className="tc-stream-chev" data-open={open} aria-hidden="true">
          <Icon name="ChevronDown" size={18} />
        </span>
      </button>
      {open && <div className="tc-stream-body">{children}</div>}
    </section>
  );
}

// Empty-state row inside a stream.
function StreamEmpty({ icon = "Check", children }) {
  return (
    <div className="tc-empty">
      <span className="tc-empty-icon" aria-hidden="true">
        <Icon name={icon} size={18} />
      </span>
      <span>{children}</span>
    </div>
  );
}

// ---------- Needs attention (exception list) ----------------------------
// More structured than a normal row — each item gets a one-line summary,
// a primary action, and a "details" disclosure.

const ATTENTION_ITEMS = [
  {
    id: "att-1",
    icon: "Alert",
    hue: "error",
    title: "Sami Soto hasn't clocked in",
    body: "Warehouse Clerk · 8:00 AM start · Fremont Cross-dock · 2h 30m past scheduled start",
    primary: { label: "Call worker",        icon: "Phone",   onClick: () => showToast("Calling Sami Soto…") },
    secondary: { label: "Notify supplier",  icon: "Send", onClick: () => showToast("Notified Skill Scouts", { kind: "success" }) },
  },
  {
    id: "att-2",
    icon: "ClipboardPerson",
    hue: "error",
    title: "Open shift starts in 1h 30m",
    body: "Production Associate · 12:00 PM · Carrollton Distribution Center · Posted to 3 suppliers",
    primary: { label: "Boost reach",        icon: "Send",  onClick: () => showToast("Posted to all suppliers + pools", { kind: "success" }) },
    secondary: { label: "Pull from pool",   icon: "PersonPlus", onClick: () => showToast("Pool draft started") },
  },
  {
    id: "att-3",
    icon: "Hourglass",
    hue: "warning",
    title: "Makenna Herwitz hasn't confirmed",
    body: "Server · 4:00 PM start · Stockton Logistics Hub · Reminder sent 1h ago",
    primary: { label: "Send reminder",      icon: "Send",   onClick: () => showToast("Reminder sent") },
    secondary: { label: "Find backup",      icon: "PersonPlus",onClick: () => showToast("Searching backups") },
  },
];

function AttentionList({ onOpenShift }) {
  if (ATTENTION_ITEMS.length === 0) {
    return <StreamEmpty>Nothing needs your attention right now.</StreamEmpty>;
  }
  return (
    <div className="tc-att" role="list">
      {ATTENTION_ITEMS.map((it) => (
        <div key={it.id} className={`tc-att-row tc-att-row--${it.hue}`} role="listitem">
          <span className={`tc-att-icon tc-att-icon--${it.hue}`} aria-hidden="true">
            <Icon name={it.icon} size={18} />
          </span>
          <div className="tc-att-text">
            <span className="tc-att-title">{it.title}</span>
            <span className="tc-att-body">{it.body}</span>
          </div>
          <div className="tc-att-actions">
            <button type="button" className="btn btn--sm btn--secondary" onClick={it.secondary.onClick}>
              <Icon name={it.secondary.icon} size={14} />
              {it.secondary.label}
            </button>
            <button type="button" className="btn btn--sm btn--primary" onClick={it.primary.onClick}>
              <Icon name={it.primary.icon} size={14} />
              {it.primary.label}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------- Coverage by location (sidebar tile) -------------------------

function CoverageTile() {
  const total = COVERAGE_BY_LOC.reduce((a, b) => a + b.needed, 0);
  const filled = COVERAGE_BY_LOC.reduce((a, b) => a + b.filled, 0);
  const pct = total ? Math.round((filled / total) * 100) : 0;
  return (
    <section className="tc-cov">
      <header className="tc-cov-head">
        <h3>Coverage today</h3>
        <span className="tc-cov-pct tabular">{pct}%</span>
      </header>
      <p className="tc-cov-sub">
        <span className="tabular">{filled}</span>
        <span> of </span>
        <span className="tabular">{total}</span>
        <span> shifts filled across {COVERAGE_BY_LOC.length} sites.</span>
      </p>
      <ul className="tc-cov-list">
        {COVERAGE_BY_LOC.map((l) => {
          const lpct = Math.round((l.filled / l.needed) * 100);
          const tone = l.filled === l.needed ? "full" : l.filled === 0 ? "empty" : "partial";
          return (
            <li key={l.name} className="tc-cov-item">
              <div className="tc-cov-item-top">
                <span className="tc-cov-item-name">{l.name}</span>
                <span className="tc-cov-item-frac tabular">
                  <span>{l.filled}</span>
                  <span className="tc-cov-item-slash"> / </span>
                  <span>{l.needed}</span>
                </span>
              </div>
              <div className={`tc-cov-bar tc-cov-bar--${tone}`} aria-hidden="true">
                <span className="tc-cov-bar-fill" style={{ width: `${Math.max(2, lpct)}%` }} />
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

// ---------- Quick pivots (sidebar) --------------------------------------

function QuickPivots({ onJumpSection }) {
  const items = [
    { icon: "PersonClock",     label: "Show on-floor only",      onClick: () => onJumpSection("floor") },
    { icon: "Hourglass",       label: "Show standing by only",   onClick: () => onJumpSection("soon") },
    { icon: "Alert",           label: "Show flagged only",       onClick: () => onJumpSection("attention") },
    { icon: "ClipboardPerson", label: "Show open shifts",        onClick: () => onJumpSection("open") },
  ];
  return (
    <section className="tc-pivots">
      <header className="tc-pivots-head">
        <h3>Jump to</h3>
      </header>
      <ul className="tc-pivots-list">
        {items.map((it) => (
          <li key={it.label}>
            <button type="button" className="tc-pivot-btn" onClick={it.onClick}>
              <Icon name={it.icon} size={16} />
              <span>{it.label}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

// =====================================================================
// 14-day fulfillment outlook — traffic-light calendar
// =====================================================================
// Anchored on the demo's "now" (Thu Apr 23 2026): four days back, today,
// and nine days forward. Past days show actual fulfillment; today and
// future days show projected fill against required slots.
//
// Tier thresholds (mirror the Coverage tile + Everest semantic hues):
//   high  ≥ 90 %  → green
//   med   60 – 89% → yellow
//   low   < 60 %  → red

const TODAY_KEY = "apr-23";

// Full-month fulfillment dataset covering Apr 1 2026 — May 7 2026. The
// 14-day strip below slices a window around the selected day, but the
// home-page calendar reads any date through `window.DAY_FULFILLMENT`.
const DAY_FULFILLMENT = [
  // Mostly green (≥75 % filled) with a handful of yellow (50–75 %) and
  // red (<50 %) so the home calendar tells a healthy fulfillment story
  // while still flagging a few rough days that need attention.
  // ---- April (pre-strip) ----
  { key: "apr-01", date:  1, monthShort: "Apr", dayLabel: "Wed", filled: 11, needed: 12, isPast: true,  isToday: false },
  { key: "apr-02", date:  2, monthShort: "Apr", dayLabel: "Thu", filled: 12, needed: 13, isPast: true,  isToday: false },
  { key: "apr-03", date:  3, monthShort: "Apr", dayLabel: "Fri", filled: 12, needed: 14, isPast: true,  isToday: false },
  { key: "apr-04", date:  4, monthShort: "Apr", dayLabel: "Sat", filled:  9, needed: 10, isPast: true,  isToday: false, weekend: true },
  { key: "apr-05", date:  5, monthShort: "Apr", dayLabel: "Sun", filled:  7, needed:  8, isPast: true,  isToday: false, weekend: true },
  { key: "apr-06", date:  6, monthShort: "Apr", dayLabel: "Mon", filled: 13, needed: 14, isPast: true,  isToday: false },
  { key: "apr-07", date:  7, monthShort: "Apr", dayLabel: "Tue", filled: 11, needed: 13, isPast: true,  isToday: false },
  { key: "apr-08", date:  8, monthShort: "Apr", dayLabel: "Wed", filled: 12, needed: 14, isPast: true,  isToday: false },
  { key: "apr-09", date:  9, monthShort: "Apr", dayLabel: "Thu", filled: 14, needed: 15, isPast: true,  isToday: false },
  { key: "apr-10", date: 10, monthShort: "Apr", dayLabel: "Fri", filled:  8, needed: 14, isPast: true,  isToday: false }, // yellow
  { key: "apr-11", date: 11, monthShort: "Apr", dayLabel: "Sat", filled:  9, needed: 11, isPast: true,  isToday: false, weekend: true },
  { key: "apr-12", date: 12, monthShort: "Apr", dayLabel: "Sun", filled:  8, needed:  9, isPast: true,  isToday: false, weekend: true },
  { key: "apr-13", date: 13, monthShort: "Apr", dayLabel: "Mon", filled: 12, needed: 13, isPast: true,  isToday: false },
  { key: "apr-14", date: 14, monthShort: "Apr", dayLabel: "Tue", filled: 12, needed: 14, isPast: true,  isToday: false },
  { key: "apr-15", date: 15, monthShort: "Apr", dayLabel: "Wed", filled: 13, needed: 14, isPast: true,  isToday: false },
  { key: "apr-16", date: 16, monthShort: "Apr", dayLabel: "Thu", filled:  5, needed: 15, isPast: true,  isToday: false }, // red
  { key: "apr-17", date: 17, monthShort: "Apr", dayLabel: "Fri", filled: 12, needed: 14, isPast: true,  isToday: false },
  { key: "apr-18", date: 18, monthShort: "Apr", dayLabel: "Sat", filled:  8, needed: 10, isPast: true,  isToday: false, weekend: true },
  // ---- 14-day strip window (Apr 19 → May 2) ----
  { key: "apr-19", date: 19, monthShort: "Apr", dayLabel: "Sun", filled:  7, needed:  8, isPast: true,  isToday: false, weekend: true },
  { key: "apr-20", date: 20, monthShort: "Apr", dayLabel: "Mon", filled: 11, needed: 12, isPast: true,  isToday: false },
  { key: "apr-21", date: 21, monthShort: "Apr", dayLabel: "Tue", filled: 11, needed: 13, isPast: true,  isToday: false },
  { key: "apr-22", date: 22, monthShort: "Apr", dayLabel: "Wed", filled: 13, needed: 14, isPast: true,  isToday: false },
  { key: "apr-23", date: 23, monthShort: "Apr", dayLabel: "Thu", filled: 14, needed: 17, isPast: false, isToday: true  },
  { key: "apr-24", date: 24, monthShort: "Apr", dayLabel: "Fri", filled: 13, needed: 16, isPast: false, isToday: false },
  { key: "apr-25", date: 25, monthShort: "Apr", dayLabel: "Sat", filled: 10, needed: 12, isPast: false, isToday: false, weekend: true },
  { key: "apr-26", date: 26, monthShort: "Apr", dayLabel: "Sun", filled:  7, needed:  8, isPast: false, isToday: false, weekend: true },
  { key: "apr-27", date: 27, monthShort: "Apr", dayLabel: "Mon", filled:  4, needed: 14, isPast: false, isToday: false }, // red
  { key: "apr-28", date: 28, monthShort: "Apr", dayLabel: "Tue", filled: 11, needed: 13, isPast: false, isToday: false },
  { key: "apr-29", date: 29, monthShort: "Apr", dayLabel: "Wed", filled: 12, needed: 14, isPast: false, isToday: false },
  { key: "apr-30", date: 30, monthShort: "Apr", dayLabel: "Thu", filled: 13, needed: 15, isPast: false, isToday: false },
  { key: "may-01", date:  1, monthShort: "May", dayLabel: "Fri", filled: 12, needed: 14, isPast: false, isToday: false },
  { key: "may-02", date:  2, monthShort: "May", dayLabel: "Sat", filled:  7, needed: 11, isPast: false, isToday: false, weekend: true }, // yellow
  // ---- May (post-strip) ----
  { key: "may-03", date:  3, monthShort: "May", dayLabel: "Sun", filled:  7, needed:  8, isPast: false, isToday: false, weekend: true },
  { key: "may-04", date:  4, monthShort: "May", dayLabel: "Mon", filled: 11, needed: 13, isPast: false, isToday: false },
  { key: "may-05", date:  5, monthShort: "May", dayLabel: "Tue", filled: 12, needed: 14, isPast: false, isToday: false },
  { key: "may-06", date:  6, monthShort: "May", dayLabel: "Wed", filled: 12, needed: 14, isPast: false, isToday: false },
  { key: "may-07", date:  7, monthShort: "May", dayLabel: "Thu", filled: 13, needed: 15, isPast: false, isToday: false },
];

// Index → fast lookups for cross-page consumers (home calendar).
const DAY_FULFILLMENT_BY_KEY = DAY_FULFILLMENT.reduce((acc, d) => {
  acc[d.key] = d;
  return acc;
}, {});

// Convert a JS Date (or {year, month, day}) into a DAY_FULFILLMENT key.
// Months are 0-indexed. Returns null if not in dataset.
function dayKeyFor(year, month, day) {
  const mo = ["jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"][month];
  if (!mo) return null;
  const dd = String(day).padStart(2, "0");
  const key = `${mo}-${dd}`;
  return DAY_FULFILLMENT_BY_KEY[key] ? key : null;
}

// Return a DAY_FULFILLMENT-shaped object for any JS Date. If the date
// has a curated entry, returns it as-is; otherwise synthesizes one
// deterministically from the date so day-view navigation can render a
// plan for arbitrary days without us having to enumerate every date.
function dayFromDate(date) {
  const moAbbrs   = ["jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"];
  const moShorts  = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const dayLabels = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
  const y = date.getFullYear();
  const m = date.getMonth();
  const d = date.getDate();
  const mo = moAbbrs[m];
  const key = `${mo}-${String(d).padStart(2, "0")}`;

  // Compute past / today / future against the *actual* today rather than
  // the hand-curated flags baked into DAY_FULFILLMENT (those were
  // authored when "today" was apr-23 — anything cached there would
  // mislabel apr-24 as "upcoming" once today moves into May).
  const today = _SCH_NOW_DATE;
  const tIso  = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const dIso  = new Date(y, m, d).getTime();
  const isToday = dIso === tIso;
  const isPast  = dIso < tIso;

  if (DAY_FULFILLMENT_BY_KEY[key]) {
    return { ...DAY_FULFILLMENT_BY_KEY[key], isPast, isToday };
  }

  // Deterministic filled/needed seeded by date so the same day always
  // shows the same numbers. Weekends staff lighter. The curve below skews
  // most days into the green band (≥75 %), with the occasional yellow
  // (50–75 %) or red (<50 %) day so the calendar tells a healthy story
  // while still surfacing a few rough spots.
  const dow = new Date(y, m, d).getDay();
  const isWeekend = dow === 0 || dow === 6;
  const seed = (y * 10000 + (m + 1) * 100 + d) % 233280;
  const needed = isWeekend ? 7 + Math.floor((seed / 233280) * 5)
                            : 12 + Math.floor((seed / 233280) * 7);
  const r = (seed % 1000) / 1000;             // 0–1 deterministic
  let covPct;
  if (r < 0.05) covPct = 0.30 + r * 3.0;      // red    (30–45 %)
  else if (r < 0.20) covPct = 0.55 + (r - 0.05) * 1.2;  // yellow (55–73 %)
  else covPct = 0.80 + (r - 0.20) * 0.25;     // green  (80–100 %)
  const filled = Math.min(needed, Math.max(0, Math.round(needed * covPct)));

  return {
    key,
    date: d,
    monthShort: moShorts[m],
    dayLabel: dayLabels[dow],
    filled,
    needed,
    isPast,
    isToday,
    weekend: isWeekend,
    synthetic: true,
  };
}

function fulfillmentTier(filled, needed) {
  if (!needed) return "none";
  const pct = filled / needed;
  if (pct >= 0.90) return "high";
  if (pct >= 0.60) return "med";
  return "low";
}

function TIER_LABEL(t) {
  if (t === "high") return "High fulfillment";
  if (t === "med")  return "Medium fulfillment";
  if (t === "low")  return "Low fulfillment";
  return "—";
}

// ---------- Fulfillment calendar (header + 14-day strip) ----------------

// Pick 14 consecutive days from DAY_FULFILLMENT centered on the selected key.
function _visibleStrip(selectedKey) {
  const idx = DAY_FULFILLMENT.findIndex((d) => d.key === selectedKey);
  const todayIdx = DAY_FULFILLMENT.findIndex((d) => d.isToday);
  const anchor = idx >= 0 ? idx : (todayIdx >= 0 ? todayIdx : 0);
  // Aim for ~4 days of history before the anchor (matches the original
  // "today − 4 / today + 9" framing) — clamp at dataset bounds.
  let start = anchor - 4;
  const max = DAY_FULFILLMENT.length - 14;
  if (start < 0) start = 0;
  if (start > max) start = Math.max(0, max);
  return DAY_FULFILLMENT.slice(start, start + 14);
}

// ---------- Day context banner (visible when not viewing today) ----------

function DayContextBanner({ day, onBack }) {
  const tier = fulfillmentTier(day.filled, day.needed);
  const open = Math.max(0, day.needed - day.filled);
  const pct  = Math.round((day.filled / day.needed) * 100);
  return (
    <section className={`tc-daybanner tc-daybanner--${tier}`}>
      <span className={`tc-daybanner-light tc-daybanner-light--${tier}`} aria-hidden="true">
        <span className="tc-daybanner-light-dot" />
      </span>
      <div className="tc-daybanner-text">
        <h3 className="tc-daybanner-title">
          <span>{day.dayLabel}, {day.monthShort} {day.date}, 2026</span>
          <span className={`tc-daybanner-tag tc-daybanner-tag--${day.isPast ? "past" : "future"}`}>
            {day.isPast ? "Past day" : "Upcoming"}
          </span>
        </h3>
        <p className="tc-daybanner-sub">
          <span className="tabular">{day.filled}</span>
          <span> of </span>
          <span className="tabular">{day.needed}</span>
          <span> positions filled · </span>
          <span className="tabular">{pct}%</span>
          <span> coverage · </span>
          <span className={`tc-daybanner-open tc-daybanner-open--${tier}`}>
            <span className="tabular">{open}</span>
            <span> open</span>
          </span>
        </p>
      </div>
      <button type="button" className="tc-daybanner-back" onClick={onBack}>
        <Icon name="ArrowLeft" size={14} />
        <span>Back to today</span>
      </button>
    </section>
  );
}

// =====================================================================
// Program admin metrics — what a temp staffing program admin watches
// Day-detail plan — shown when a non-today day is selected from the
// fulfillment calendar. Reuses TODAY_SHIFTS as a template and re-derives
// per-row status based on the day's filled / needed numbers.
// =====================================================================

function synthesizeDayShifts(day) {
  const tmpl = TODAY_SHIFTS;
  const rows = [];
  for (let i = 0; i < day.needed; i++) {
    const base = tmpl[i % tmpl.length];
    const filled = i < day.filled;
    rows.push({
      ...base,
      id: `${day.key}-${i}`,
      clockIn: null,
      clockOut: null,
      state: null,
      // Open = unfilled slot; otherwise scheduled (future) or closed (past).
      channel: filled ? (day.isPast ? "closed" : "scheduled") : "open",
      worker: filled ? base.worker : null,
      note: filled
        ? (day.isPast ? "Completed shift" : (i % 3 === 0 ? "Awaiting confirmation" : "Confirmed"))
        : (day.isPast ? "Closed unfilled" : "Posted to suppliers"),
    });
  }
  return rows;
}

function dayShiftStateMeta(s, day) {
  if (s.channel === "open")      return { state: "open",    label: day.isPast ? "Went unfilled" : "Open", hue: "error" };
  if (day.isPast)                return { state: "closed",  label: "Completed",    hue: "success" };
  if (/awaiting/i.test(s.note || "")) return { state: "later", label: "Pending confirm", hue: "warning" };
  return                                 { state: "later",   label: "Scheduled",    hue: "informative" };
}

function DayPlanRow({ s, day, onOpenBooking }) {
  const meta   = dayShiftStateMeta(s, day);
  const worker = s.worker ? (WORKERS.find((w) => w.id === s.worker) || null) : null;
  const sup    = worker ? (REQ_SUPPLIERS[worker.supplier] || null) : null;
  const { startMin } = parseShiftTime(s.time);

  const onClick = () => {
    if (!onOpenBooking) return;
    if (s.worker) onOpenBooking(buildBookingId({ reqId: s.reqId, workerId: s.worker, weekDayIdx: 3 }));
    else          onOpenBooking(s.reqId);
  };

  return (
    <div
      className={`tc-row tc-row--${meta.state}`}
      role="row"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === "Enter") onClick(); }}
    >
      <span className={`tc-row-bar tc-row-bar--${meta.hue}`} aria-hidden="true" />

      <div className="tc-row-who">
        {worker ? (
          <div className="tc-row-avatar">
            <WorkerAvatar w={worker} size={32} />
            {sup && (
              <span
                className="tc-row-avatar-sup"
                style={{ background: sup.bg, color: sup.fg }}
                aria-hidden="true"
                title={sup.label}
              />
            )}
          </div>
        ) : (
          <div className="tc-row-avatar tc-row-avatar--open" aria-hidden="true">
            <Icon name="PersonPlus" size={16} />
          </div>
        )}
        <div className="tc-row-who-text">
          <span className="tc-row-name">{worker ? worker.name : "Open position"}</span>
          <span className="tc-row-sub">
            <span className="tc-row-role">{s.role}</span>
            {sup && <React.Fragment><span aria-hidden="true">·</span><span>{sup.label}</span></React.Fragment>}
            {!worker && <React.Fragment><span aria-hidden="true">·</span><span>Distributing</span></React.Fragment>}
          </span>
        </div>
      </div>

      <div className="tc-row-when">
        <span className="tc-row-when-time tabular">{s.time}</span>
        <span className="tc-row-when-loc">
          <Icon name="Location" size={12} />
          <span>{s.location}</span>
        </span>
      </div>

      <div className="tc-row-metric">
        <span className="tc-row-metric-label">Starts</span>
        <span className="tc-row-metric-value tabular">{formatMinutes(startMin)}</span>
      </div>

      <div className="tc-row-state">
        <span className={`tc-pill tc-pill--${meta.hue}`}>
          <span
            className="tc-pill-dot"
            style={{
              background: meta.hue === "success"     ? "var(--evr-green-400)"
                       : meta.hue === "informative" ? "var(--evr-blue-400)"
                       : meta.hue === "warning"     ? "var(--evr-yellow-400)"
                       : meta.hue === "error"       ? "var(--evr-red-400)"
                                                    : "var(--evr-neutral-60)"
            }}
            aria-hidden="true"
          />
          <span>{meta.label}</span>
        </span>
        {s.note && <span className="tc-row-note">{s.note}</span>}
      </div>

      <div className="tc-row-actions">
        {meta.state === "open" && !day.isPast && (
          <button
            type="button"
            className="btn btn--sm btn--primary"
            onClick={(e) => { e.stopPropagation(); showToast("Posted to all suppliers", { kind: "success" }); }}
          >
            <Icon name="Send" size={14} />
            Boost
          </button>
        )}
        <span className="tc-row-chev" aria-hidden="true"><Icon name="ChevronRight" size={18} /></span>
      </div>
    </div>
  );
}

function DayPlanSection({ day, onOpenBooking }) {
  const all = synthesizeDayShifts(day);
  const filled = all.filter((s) => s.channel !== "open");
  const open   = all.filter((s) => s.channel === "open");
  const sortByStart = (a, b) => parseShiftTime(a.time).startMin - parseShiftTime(b.time).startMin;
  filled.sort(sortByStart);
  open.sort(sortByStart);

  return (
    <React.Fragment>
      <StreamSection
        id="stream-day-filled"
        icon="Calendar"
        title={`Schedule · ${day.dayLabel} ${day.monthShort} ${day.date}`}
        count={filled.length}
        hint={day.isPast ? "Completed and closed shifts" : "Scheduled assignments"}
        accent={day.isPast ? "success" : "info"}
        defaultOpen
      >
        {filled.length === 0 ? (
          <StreamEmpty icon="Calendar">No staffed shifts on this day yet.</StreamEmpty>
        ) : (
          <div className="tc-rows">
            {filled.map((s) => (
              <DayPlanRow key={s.id} s={s} day={day} onOpenBooking={onOpenBooking} />
            ))}
          </div>
        )}
      </StreamSection>

      <StreamSection
        id="stream-day-open"
        icon="Alert"
        title={day.isPast ? "Went unfilled" : "Open positions"}
        count={open.length}
        hint={day.isPast ? "Slots that closed without coverage" : "Posted, awaiting acceptance"}
        accent={open.length === 0 ? "success" : "error"}
        defaultOpen
      >
        {open.length === 0 ? (
          <StreamEmpty icon="Check">Every slot was covered.</StreamEmpty>
        ) : (
          <div className="tc-rows">
            {open.map((s) => (
              <DayPlanRow key={s.id} s={s} day={day} onOpenBooking={onOpenBooking} />
            ))}
          </div>
        )}
      </StreamSection>
    </React.Fragment>
  );
}

// =====================================================================
// TodayConsole
// =====================================================================

function TodayConsole({ anchor, locFilter, groupBy = "booking", onOpenBooking, onOpenShift, initialDayKey }) {
  // Resolve the day-of-interest from (in priority order):
  //   1. `anchor` — a JS Date supplied by the SchedulePage rail's stepper.
  //   2. `initialDayKey` — a deep link from the home calendar (e.g. "apr-23").
  //   3. TODAY_KEY — the curated "today" in the dataset.
  // Using dayFromDate() lets us synthesize a plan for dates that aren't in
  // the curated DAY_FULFILLMENT range, so day-view navigation works for
  // any date the user steps to.
  const selectedDay = React.useMemo(() => {
    if (anchor) return dayFromDate(anchor);
    if (initialDayKey && DAY_FULFILLMENT_BY_KEY[initialDayKey]) {
      return DAY_FULFILLMENT_BY_KEY[initialDayKey];
    }
    return DAY_FULFILLMENT.find((d) => d.key === TODAY_KEY)
        || DAY_FULFILLMENT.find((d) => d.isToday)
        || DAY_FULFILLMENT[0];
  }, [anchor, initialDayKey]);
  const isTodaySelected = !!selectedDay.isToday;
  const goToday = () => {
    if (typeof window.flexGoTo === "function") {
      window.flexGoTo({ page: "schedule" });
    }
  };

  // Pick the shift dataset: curated TODAY_SHIFTS for today, synthesized
  // (filled vs open by tier) for any other day. Both feed the same
  // TodayTimeline so every day reads with the same visual + interactions.
  const allDayShifts = isTodaySelected ? TODAY_SHIFTS : synthesizeDayShifts(selectedDay);
  // Apply the rail's location filter — each shift carries a `location`
  // name string that we match against the selected location ids → names.
  const dayShifts = React.useMemo(() => {
    if (!locFilter || !locFilter.length) return allDayShifts;
    const locs = (typeof window !== "undefined" && window.LOCATIONS) || [];
    const names = new Set(
      locFilter.map((id) => (locs.find((l) => l.id === id) || {}).name).filter(Boolean)
    );
    return allDayShifts.filter((s) => names.has(s.location));
  }, [allDayShifts, locFilter]);

  return (
    <React.Fragment>
      {/* When the user deep-links into a non-today day from the home
          calendar (or steps off "today" with the rail paddle), surface a
          context banner that re-states the day's fulfillment numbers.
          It uses the exact same filled / needed values shown on the
          dashboard tile they clicked, anchoring the two surfaces. */}
      {!isTodaySelected && (
        <DayContextBanner day={selectedDay} onBack={goToday} />
      )}
      <TodayTimeline
        shifts={dayShifts}
        day={selectedDay}
        groupBy={groupBy}
        onOpenBooking={onOpenBooking}
        onOpenShift={onOpenShift}
      />
    </React.Fragment>
  );
}

// =====================================================================
// OpenShiftsView — coverage gaps grouped by urgency horizon
// =====================================================================

// Group label without using past/active/future. Driven by dayOffset.
function urgencyBucket(dayOffset) {
  if (dayOffset === 0) return "now";
  if (dayOffset === 1) return "soon";
  if (dayOffset <= 3)  return "thisweek";
  return "beyond";
}

const URGENCY_META = {
  now:      { label: "Starting today",       icon: "Alert",           hue: "error",       desc: "Last-minute. Worth boosting reach now." },
  soon:     { label: "Tomorrow",             icon: "Hourglass",       hue: "warning",     desc: "One sleep away. Suppliers can still confirm." },
  thisweek: { label: "Rest of the week",     icon: "Calendar",        hue: "informative", desc: "Within five days. Plenty of time to fill." },
  beyond:   { label: "Looking further out",  icon: "Globe",         hue: "default",     desc: "Plan ahead. Open multiple lanes." },
};

function OpenGapRow({ o, onOpenBooking }) {
  const pctOpen = (o.openOf / o.totalSlots) * 100;
  const sups = o.suppliers.map((id) => REQ_SUPPLIERS[id]).filter(Boolean);
  return (
    <div
      className="og-row"
      role="row"
      tabIndex={0}
      onClick={() => onOpenBooking && onOpenBooking(o.reqId)}
      onKeyDown={(e) => { if (e.key === "Enter") onOpenBooking && onOpenBooking(o.reqId); }}
    >
      <div className="og-row-date">
        <span className="og-row-date-day">{o.dateLabel.split(" · ")[0]}</span>
        <span className="og-row-date-full tabular">{o.dateLabel.split(" · ")[1] || ""}</span>
      </div>

      <div className="og-row-role">
        <span className="og-row-role-name">{o.role}</span>
        <span className="og-row-role-loc">
          <Icon name="Location" size={12} />
          <span>{o.location}</span>
        </span>
      </div>

      <div className="og-row-time">
        <span className="tabular">{o.time}</span>
      </div>

      <div className="og-row-fill">
        <div className="og-row-fill-bar" aria-hidden="true">
          <span
            className="og-row-fill-fill"
            style={{ width: `${100 - pctOpen}%` }}
          />
        </div>
        <span className="og-row-fill-text tabular">
          <span className="og-row-fill-open">{o.openOf}</span>
          <span> of </span>
          <span>{o.totalSlots}</span>
          <span> open</span>
        </span>
      </div>

      <div className="og-row-sups">
        {sups.slice(0, 3).map((s, i) => (
          <span
            key={i}
            className="og-row-sup"
            style={{ background: s.bg, color: s.fg }}
            title={s.label}
          >
            {s.short}
          </span>
        ))}
        {sups.length > 3 && <span className="og-row-sup og-row-sup--more">+{sups.length - 3}</span>}
      </div>

      <div className="og-row-actions">
        <button
          type="button"
          className="btn btn--sm btn--secondary"
          onClick={(e) => { e.stopPropagation(); showToast("Reposted to all suppliers", { kind: "success" }); }}
        >
          <Icon name="Send" size={14} />
          Boost
        </button>
        <button
          type="button"
          className="iconbtn"
          aria-label="Row actions"
          onClick={(e) => {
            e.stopPropagation();
            openMenu(e.currentTarget, [
              { icon: "View",        label: "Open requisition", onClick: () => window.flexGoTo && window.flexGoTo({ page: "requisitions", sub: "details", id: o.reqId }) },
              { icon: "PersonPlus",  label: "Pull from pool",   onClick: () => showToast("Pool draft started") },
              { icon: "Send",     label: "Post to all",      onClick: () => showToast("Posted to all suppliers + pools", { kind: "success" }) },
              { divider: true },
              { icon: "Edit",        label: "Edit shift",       onClick: () => showToast("Opening editor") },
            ]);
          }}
        >
          <Icon name="MoreVert" size={18} />
        </button>
      </div>
    </div>
  );
}

function OpenShiftsView({ onOpenBooking }) {
  // Bucket
  const buckets = { now: [], soon: [], thisweek: [], beyond: [] };
  OPEN_SHIFTS.forEach((o) => { buckets[urgencyBucket(o.dayOffset)].push(o); });
  const totalOpen = OPEN_SHIFTS.reduce((a, o) => a + o.openOf, 0);

  return (
    <div className="og-root">
      <section className="og-hero">
        <div className="og-hero-anchor">
          <h2 className="og-hero-title">
            <span className="tabular">{totalOpen}</span> open positions
          </h2>
          <p className="og-hero-sub">
            Across {new Set(OPEN_SHIFTS.map((o) => o.location)).size} sites · the closest one starts in 1h 30m.
          </p>
        </div>
        <div className="og-hero-kpis">
          {Object.entries(URGENCY_META).map(([key, meta]) => {
            const count = (buckets[key] || []).reduce((a, o) => a + o.openOf, 0);
            return (
              <div key={key} className={`og-hero-kpi og-hero-kpi--${meta.hue}`}>
                <span className="og-hero-kpi-icon" aria-hidden="true">
                  <Icon name={meta.icon} size={16} />
                </span>
                <span className="og-hero-kpi-value tabular">{count}</span>
                <span className="og-hero-kpi-label">{meta.label}</span>
              </div>
            );
          })}
        </div>
      </section>

      {["now", "soon", "thisweek", "beyond"].map((key) => {
        const meta = URGENCY_META[key];
        const list = buckets[key];
        if (!list || list.length === 0) return null;
        return (
          <section key={key} className={`og-group og-group--${meta.hue}`}>
            <header className="og-group-head">
              <span className={`og-group-icon og-group-icon--${meta.hue}`} aria-hidden="true">
                <Icon name={meta.icon} size={18} />
              </span>
              <div className="og-group-text">
                <h3>{meta.label}</h3>
                <p>{meta.desc}</p>
              </div>
              <span className="og-group-count tabular">
                {list.reduce((a, o) => a + o.openOf, 0)}
              </span>
            </header>
            <div className="og-list" role="table">
              <div className="og-row og-row--head" role="row">
                <div className="og-row-date">    <span>Date</span></div>
                <div className="og-row-role">    <span>Role</span></div>
                <div className="og-row-time">    <span>Time</span></div>
                <div className="og-row-fill">    <span>Filled</span></div>
                <div className="og-row-sups">    <span>Suppliers</span></div>
                <div className="og-row-actions"> <span></span></div>
              </div>
              {list.map((o) => <OpenGapRow key={o.id} o={o} onOpenBooking={onOpenBooking} />)}
            </div>
          </section>
        );
      })}
    </div>
  );
}

// =====================================================================
// Calendar augmentation — derive shift state for the existing grid
// =====================================================================
// Helper used by the existing CalendarByWorker to tag each shift with a
// state (closed / floor / wrapping / soon / later) so the card styling
// can vary. Same parseShiftTime contract as above.

function calendarShiftState(shift, dayKey) {
  const days = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
  const todayIdx = days.indexOf(SCH_NOW.dayKey);
  const shiftStartIdx = days.indexOf(shift.day);
  const span = shift.span || 1;
  const lastIdx = shiftStartIdx + span - 1;
  if (lastIdx < todayIdx)        return "closed";
  if (shiftStartIdx > todayIdx)  return "later";
  // The shift spans today. Compare clock.
  const { startMin, endMin } = parseShiftTime(shift.time);
  // If shift starts on an earlier day in the span, treat today's slice as already in progress.
  const isMidSpan = shiftStartIdx < todayIdx;
  if (isMidSpan) {
    return "floor"; // ongoing across days — simplification for the grid
  }
  if (SCH_NOW_MIN >= endMin)   return "closed";
  if (SCH_NOW_MIN >= startMin) return endMin - SCH_NOW_MIN <= 60 ? "wrapping" : "floor";
  return startMin - SCH_NOW_MIN <= 90 ? "soon" : "later";
}

// Today column index in SCH_DAYS for grid highlight
function todayColumnIdx() {
  return ["mon","tue","wed","thu","fri","sat","sun"].indexOf(SCH_NOW.dayKey);
}

Object.assign(window, {
  TodayConsole,
  OpenShiftsView,
  // Exposed so the new Schedule List view (pages/schedule-list-view.jsx)
  // can reuse the same curated dataset as TodayConsole — that's what
  // keeps "Calendar" and "List View" telling the same story on Today.
  TODAY_SHIFTS,
  synthesizeDayShifts,
  rowState,
  STATE_META,
  StatePill,
  SCH_NOW,
  SCH_NOW_LABEL,
  SCH_NOW_MIN,
  calendarShiftState,
  todayColumnIdx,
  parseShiftTime,
  formatMinutes,
  // Surface the fulfillment dataset + helpers so the home calendar can
  // colour each cell against the same source of truth and navigate to
  // a day's detail view.
  DAY_FULFILLMENT,
  DAY_FULFILLMENT_BY_KEY,
  TODAY_KEY,
  dayKeyFor,
  dayFromDate,
  fulfillmentTier,
  TIER_LABEL,
});
