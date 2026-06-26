// =====================================================================
// Flex Work — Schedule List View
//
// An alternate presentation of the Schedule page. While "Calendar" mode
// renders Day / Week / Month *grids*, "List" mode renders the same
// underlying shifts as an Everest data-table — one row per shift, with
// status, scheduled time, clock-in / clock-out, and a per-row 3-dot
// menu of override actions (Add time, Mark no-show, Report worker,
// Message worker, Edit shift, …).
//
// The list view inherits every filter on the rail:
//   · view      — Day / Week / Month determines how many days are
//                 included
//   · anchor    — the JS Date the rail's stepper has parked on
//   · locFilter — site-id array; rows whose location isn't in the set
//                 are hidden
//   · groupBy   — work assignment / site / worker / status / supplier;
//                 inserts section headers above the rows
//
// Data:
//   · For "today" we use the curated TODAY_SHIFTS dataset (the same
//     one the Calendar's Today timeline reads) so the two modes tell
//     the same operational story.
//   · For any other day we project the curated set onto the day with
//     synthesizeDayShifts() — filled / open / closed by day position.
//   · Week and Month flatten across every day in their window.
// =====================================================================

const { useState: useStateLv, useMemo: useMemoLv } = React;

const SCHEDULE_LIST_PAGE_SIZE = 25;

// ---------- Day-list helpers --------------------------------------------

// Build the list of DAY_FULFILLMENT-shaped days the visible window covers.
// "today" → 1 day. "week" → 7 days (Mon → Sun). "month" → every day in
// the anchor's month. Always resolves via dayFromDate so today's
// curated row + filled/needed numbers stay consistent.
function _slDaysFor(view, anchor) {
  const fromDate = window.dayFromDate;
  if (!fromDate) return [];
  const base = anchor || window.SCH_TODAY_DATE || new Date();
  if (view === "today") return [fromDate(base)];
  if (view === "week") {
    const start = new Date(base);
    const offset = (start.getDay() + 6) % 7; // Mon=0…Sun=6
    start.setDate(start.getDate() - offset);
    start.setHours(0, 0, 0, 0);
    const out = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      out.push(fromDate(d));
    }
    return out;
  }
  // month
  const y = base.getFullYear();
  const m = base.getMonth();
  const last = new Date(y, m + 1, 0).getDate();
  const out = [];
  for (let i = 1; i <= last; i++) out.push(fromDate(new Date(y, m, i)));
  return out;
}

// Pick the right shift dataset for a day. Today → the curated
// TODAY_SHIFTS (with live clock-in / state). Any other day →
// synthesizeDayShifts so we get filled / open / closed by horizon.
function _slShiftsFor(day) {
  const todayShifts = window.TODAY_SHIFTS || [];
  const synth = window.synthesizeDayShifts;
  if (day.isToday) return todayShifts;
  return synth ? synth(day) : [];
}

// Normalise a (shift, day) pair into a flat row the table renders. The
// dayKey prefix on the id keeps rows unique across a week or month.
function _slBuildRow(shift, day) {
  const rs = window.rowState ? window.rowState(shift, day) : null;
  const status = rs || (shift.channel === "open" ? "open" :
    shift.channel === "flag" ? "flagged" :
    day.isPast ? "closed" : "later");
  const time = shift.time || "";
  const [start, end] = time.split(/\s*[\u2013-]\s*/);
  const parsed = window.parseShiftTime ? window.parseShiftTime(time) : { startMin: 0, endMin: 0 };
  return {
    id: `${day.key}-${shift.id}`,
    day,
    dayKey: day.key,
    dayLabel: `${day.dayLabel || ""} ${day.monthShort || ""} ${day.date || ""}`.trim(),
    dayShort: `${day.monthShort || ""} ${day.date || ""}`.trim(),
    isToday: !!day.isToday,
    isPast: !!day.isPast,
    workerId: shift.worker,
    role: shift.role,
    time,
    schedStart: start || "—",
    schedEnd: end || "—",
    clockIn: shift.clockIn,
    clockOut: shift.clockOut,
    status,
    reqId: shift.reqId,
    location: shift.location,
    channel: shift.channel,
    note: shift.note,
    confirmed: shift.confirmed,
    flag: shift.flag,
    startMin: parsed.startMin,
    endMin: parsed.endMin,
    shift, // original for menu callbacks
  };
}

// ---------- State + status labels ---------------------------------------

// Map state → Everest req-pill hue so the list-view status cell stays
// visually parallel to other Everest tables (Requisitions, Timesheets).
const SL_STATUS_HUE = {
  floor: "success",
  break: "warning",
  wrapping: "informative",
  enroute: "informative",
  soon: "informative",
  open: "error",
  flagged: "error",
  closed: "default",
  later: "default",
};

const SL_STATUS_LABEL = {
  floor: "On the floor",
  break: "On break",
  wrapping: "Wrapping",
  enroute: "En route",
  soon: "Standing by",
  open: "Open",
  flagged: "Flagged",
  closed: "Completed",
  later: "Scheduled",
};

// ---------- Grouping / filtering ----------------------------------------

// Drop rows whose location isn't in the rail's site filter. Empty
// filter = pass-through (everything is shown).
function _slApplyLocFilter(rows, locFilter) {
  if (!locFilter || !locFilter.length) return rows;
  const locs = (typeof window !== "undefined" && window.LOCATIONS) || [];
  const names = new Set(
    locFilter.map((id) => (locs.find((l) => l.id === id) || {}).name).filter(Boolean)
  );
  return rows.filter((r) => names.has(r.location));
}

// Group rows by the rail's dimension. Returns an ordered list of
// {key, label, sub, icon, rows}. Order is stable per-dimension so the
// table doesn't re-shuffle on render.
function _slGroupRows(rows, groupBy) {
  const reqs = (typeof window !== "undefined" && window.REQUISITIONS) || [];
  const workersById = typeof window !== "undefined" && window.WORKERS ?
    Object.fromEntries(window.WORKERS.map((w) => [w.id, w])) : {};
  const reqsById = Object.fromEntries(reqs.map((r) => [r.id, r]));
  const suppliers = (typeof window !== "undefined" && window.REQ_SUPPLIERS) || {};

  // "worker" mode renders a single flat group — no section headers.
  if (groupBy === "worker" || !groupBy) {
    return [{ key: "all", icon: null, label: null, sub: null, rows }];
  }

  const groups = new Map();
  const push = (key, meta, row) => {
    if (!groups.has(key)) groups.set(key, { key, ...meta, rows: [] });
    groups.get(key).rows.push(row);
  };

  rows.forEach((row) => {
    const req = reqsById[row.reqId];
    const worker = workersById[row.workerId];
    if (groupBy === "booking") {
      const key = row.reqId || "—";
      const role = req && req.jobs && req.jobs[0];
      const label = role ? `${role}` : `Work assignment #${key}`;
      const sub = `#${key}${row.location ? ` · ${row.location}` : ""}`;
      push(key, { icon: "Briefcase", label, sub }, row);
    } else if (groupBy === "location") {
      const name = row.location || "Unscoped";
      push(name, { icon: "Location", label: name, sub: null }, row);
    } else if (groupBy === "supplier") {
      const supId = worker && worker.supplier;
      const sup = supId && suppliers[supId];
      const label = sup && sup.label || (worker && worker.pool ?
        `${worker.pool} pool` : row.channel === "open" ? "Open positions" : "Internal");
      push(supId || (row.channel === "open" ? "open" : "internal"),
        { icon: "Building", label, sub: null }, row);
    } else if (groupBy === "status") {
      const key = row.status || "later";
      const label = SL_STATUS_LABEL[key] || "Scheduled";
      const icon = key === "floor" ? "PersonClock" :
        key === "break" ? "DrinkMug" :
        key === "wrapping" ? "Hourglass" :
        key === "enroute" ? "Location" :
        key === "soon" ? "TimeAdd" :
        key === "open" ? "PersonPlus" :
        key === "flagged" ? "Alert" :
        key === "closed" ? "Check" : "Calendar";
      push(key, { icon, label, sub: null }, row);
    } else {
      push("all", { icon: null, label: null, sub: null }, row);
    }
  });

  const arr = Array.from(groups.values());
  if (groupBy === "status") {
    const ORDER = ["floor", "break", "wrapping", "enroute", "soon", "later", "open", "flagged", "closed"];
    arr.sort((a, b) => ORDER.indexOf(a.key) - ORDER.indexOf(b.key));
  } else {
    arr.sort((a, b) => (a.label || "").localeCompare(b.label || ""));
  }
  return arr;
}

// ---------- Cells -------------------------------------------------------

function SlStatusPill({ status, channel }) {
  const hue = SL_STATUS_HUE[status] || "default";
  const label = SL_STATUS_LABEL[status] || (channel === "open" ? "Open" : "Scheduled");
  return (
    <span className={`tc-pill tc-pill--${hue} sl-pill`}>
      <span className={`sl-pill-dot sl-pill-dot--${hue}`} aria-hidden="true" />
      <span>{label}</span>
    </span>
  );
}

function SlWorkerCell({ row }) {
  const WORKERS = window.WORKERS || [];
  const REQ_SUPPLIERS = window.REQ_SUPPLIERS || {};
  const WorkerAvatar = window.WorkerAvatar;
  if (!row.workerId) {
    return (
      <div className="sl-worker sl-worker--open">
        <span className="sl-worker-empty-avatar" aria-hidden="true">
          <Icon name="PersonPlus" size={16} />
        </span>
        <div className="sl-worker-text">
          <span className="sl-worker-name sl-worker-name--open">Unassigned</span>
          <span className="sl-worker-sub">{row.role}</span>
        </div>
      </div>
    );
  }
  const worker = WORKERS.find((w) => w.id === row.workerId) || WORKERS[0];
  if (!worker) {
    return (
      <div className="sl-worker">
        <span className="sl-worker-name">—</span>
      </div>
    );
  }
  const sup = REQ_SUPPLIERS[worker.supplier];
  return (
    <div className="sl-worker">
      <div className="sl-worker-avatar">
        {WorkerAvatar ? <WorkerAvatar w={worker} size={32} /> : null}
        {sup &&
          <span
            className="sl-worker-sup"
            style={{ background: sup.bg, color: sup.fg }}
            aria-hidden="true"
            title={sup.label} />
        }
      </div>
      <div className="sl-worker-text">
        <span className="sl-worker-name">{worker.name}</span>
        <span className="sl-worker-sub">
          {sup ? sup.label : (worker.pool ? `${worker.pool} pool` : "—")}
        </span>
      </div>
    </div>
  );
}

function SlClockCell({ stamp, sched, status, isPast }) {
  // Show actual clock stamp if we have it; otherwise show a contextual
  // hint that explains why it's blank (No clock-in / Pending / —).
  if (stamp) {
    return (
      <div className="sl-clock">
        <span className="sl-clock-stamp tabular">{stamp}</span>
        <span className="sl-clock-sub">Sched. {sched}</span>
      </div>
    );
  }
  let hint;
  if (status === "flagged") hint = "No clock-in";
  else if (status === "closed") hint = "Closed unfilled";
  else if (status === "open") hint = "Unassigned";
  else if (status === "later") hint = isPast ? "Not recorded" : "Pending";
  else hint = "—";
  return (
    <div className="sl-clock sl-clock--empty">
      <span className="sl-clock-empty tabular">—</span>
      <span className="sl-clock-sub">{hint} · sched. {sched}</span>
    </div>
  );
}

// ---------- 3-dot menu --------------------------------------------------
//
// The whole point of the list view: actionable overrides on every
// shift, exposed via a per-row menu. Menu items branch on the row's
// current status — e.g. you only see "Mark no-show" on rows that
// haven't clocked in, "End shift" on rows that are on the floor.
// Every action surfaces a toast so the user has feedback on the
// override; in a real build these would hit the timesheet API.

function _slBuildRowMenuItems(row, ctx) {
  const { onOpenShift, onOpenBooking, openMenu, showToast, openConfirm, copyToClipboard } = ctx;
  const buildBookingId = window.buildBookingId;
  const WORKERS = window.WORKERS || [];
  const worker = row.workerId ? WORKERS.find((w) => w.id === row.workerId) : null;
  const workerName = worker ? worker.name : "the position";
  const dayShort = row.dayShort;

  const items = [];

  // Always: navigate
  if (row.workerId && buildBookingId) {
    items.push({
      icon: "View",
      label: "Open shift",
      onClick: () => {
        const shiftHref = buildBookingId({
          reqId: row.reqId,
          workerId: row.workerId,
          weekDayIdx: 3, // best-effort; the shift page will resolve
        });
        onOpenShift && onOpenShift(shiftHref);
      },
    });
  }
  if (buildBookingId) {
    items.push({
      icon: "Briefcase",
      label: "Open work assignment",
      onClick: () => onOpenBooking && onOpenBooking(row.reqId),
    });
  }

  items.push({ divider: true });

  // Time overrides — what a scheduler reaches for during the shift.
  // Branch on whether the worker has clocked in yet so we don't
  // surface nonsensical actions.
  if (row.workerId && (row.status === "floor" || row.status === "wrapping" || row.status === "break")) {
    items.push({
      icon: "TimeAdd",
      label: "Add time",
      onClick: () => showToast && showToast(`Time adjustment panel opened for ${workerName} · ${dayShort}`),
    });
    items.push({
      icon: "TimeUndo",
      label: "Edit clock-in",
      onClick: () => showToast && showToast(`Editing clock-in for ${workerName}`),
    });
    if (row.status !== "break") {
      items.push({
        icon: "DrinkMug",
        label: "Start break",
        onClick: () => showToast && showToast(`${workerName} marked on break`, { kind: "success" }),
      });
    } else {
      items.push({
        icon: "PersonClock",
        label: "End break",
        onClick: () => showToast && showToast(`${workerName} ended break — back on the floor`, { kind: "success" }),
      });
    }
    items.push({
      icon: "ClipboardPerson",
      label: "End shift now",
      onClick: () => openConfirm && openConfirm({
        title: `End shift for ${workerName}?`,
        body: `This clocks ${workerName} out at the current time and locks the timesheet for review. You can still edit the entry from Timesheets.`,
        primaryLabel: "End shift",
        onConfirm: () => showToast && showToast(`${workerName}'s shift ended`, { kind: "success" }),
      }),
    });
  }

  // Pre-clock-in branches — Add time still applies (back-dated), no-show
  // / late arrival surface here.
  if (row.workerId && (row.status === "soon" || row.status === "enroute" || row.status === "flagged" || row.status === "later")) {
    items.push({
      icon: "TimeAdd",
      label: "Add time",
      onClick: () => showToast && showToast(`Back-dated time entry opened for ${workerName} · ${dayShort}`),
    });
    items.push({
      icon: "PersonClock",
      label: "Clock in now",
      onClick: () => showToast && showToast(`${workerName} clocked in manually`, { kind: "success" }),
    });
    items.push({
      icon: "Alert",
      label: "Mark no-show",
      onClick: () => openConfirm && openConfirm({
        title: `Mark ${workerName} as a no-show?`,
        body: `This flags the shift, notifies ${row.location ? row.location : "the site"} and the assigning supplier, and opens the slot for refill. Their reliability score will be affected.`,
        primaryLabel: "Mark no-show",
        onConfirm: () => showToast && showToast(`${workerName} marked no-show — supplier and site notified`, { kind: "warning" }),
      }),
    });
  }

  if (row.channel === "open" || !row.workerId) {
    items.push({
      icon: "PersonPlus",
      label: "Assign worker…",
      onClick: () => showToast && showToast(`Opening worker picker for ${row.role} · ${dayShort}`),
    });
    items.push({
      icon: "Send",
      label: "Boost reach",
      onClick: () => showToast && showToast(`Boosted ${row.role} · ${dayShort} to all tiered suppliers`, { kind: "success" }),
    });
  }

  // Communication + reporting — universal actions you want on every row
  // (post-clock-in or not) but only when there's an actual person on it.
  if (row.workerId) {
    items.push({ divider: true });
    items.push({
      icon: "Notes",
      label: `Message ${worker ? worker.name.split(" ")[0] : "worker"}`,
      onClick: () => showToast && showToast(`Opening message thread with ${workerName}`),
    });
    items.push({
      icon: "Person",
      label: `Message ${ (window.REQ_SUPPLIERS && worker && window.REQ_SUPPLIERS[worker.supplier]) ? window.REQ_SUPPLIERS[worker.supplier].label : "supplier" }`,
      onClick: () => showToast && showToast(`Opening thread with supplier`),
    });
    items.push({
      icon: "Alert",
      label: "Report worker…",
      onClick: () => openConfirm && openConfirm({
        title: `Report ${workerName}?`,
        body: `Filing a report sends a flag to the supplier and to the program admin. Use it for safety, conduct, or quality issues. The shift remains in place; this does not remove the worker.`,
        primaryLabel: "File report",
        onConfirm: () => showToast && showToast(`Report filed for ${workerName}`, { kind: "warning" }),
      }),
    });
  }

  // Operational follow-ups — useful regardless of status.
  items.push({ divider: true });
  items.push({
    icon: "Copy",
    label: "Copy shift link",
    onClick: () => copyToClipboard && copyToClipboard(`${row.reqId}@${row.workerId || "open"}#${row.dayKey}`, "Shift link copied"),
  });
  if (row.workerId) {
    items.push({
      icon: "Edit",
      label: "Edit shift…",
      onClick: () => showToast && showToast(`Editing shift for ${workerName}`),
    });
    items.push({
      icon: "Cancel",
      label: "Remove from shift",
      danger: true,
      onClick: () => openConfirm && openConfirm({
        title: `Remove ${workerName} from this shift?`,
        body: `${workerName} will be unassigned from ${dayShort}. The slot reopens to the supplier tier; existing time entries are preserved on the timesheet.`,
        primaryLabel: "Remove from shift",
        onConfirm: () => showToast && showToast(`${workerName} removed from ${dayShort}`, { kind: "success" }),
      }),
    });
  }

  return items;
}

// ---------- Row ---------------------------------------------------------

function SlRow({ row, showDate, vc, rowStyle, checked, onToggle, onOpenShift, onOpenBooking }) {
  const buildBookingId = window.buildBookingId;
  const onRowOpen = () => {
    if (row.workerId && buildBookingId) {
      onOpenShift && onOpenShift(buildBookingId({
        reqId: row.reqId,
        workerId: row.workerId,
        weekDayIdx: 3,
      }));
    } else {
      onOpenBooking && onOpenBooking(row.reqId);
    }
  };
  const onMenu = (e) => {
    e.stopPropagation();
    const items = _slBuildRowMenuItems(row, {
      onOpenShift,
      onOpenBooking,
      openMenu: window.openMenu,
      showToast: window.showToast,
      openConfirm: window.openConfirm,
      copyToClipboard: window.copyToClipboard,
    });
    window.openMenu && window.openMenu(e.currentTarget, items);
  };
  // Fallback when no view-customizer is wired (defensive — the parent
  // always supplies one in practice).
  const show = (id) => (vc && vc.showCol ? vc.showCol(id) : true);
  return (
    <div
      className={`req-row sl-row req-row--clickable${row.isToday ? " sl-row--today" : ""}`}
      role="row"
      tabIndex={0}
      style={rowStyle}
      onClick={(e) => {
        if (e.target.closest("input,a,button")) return;
        onRowOpen();
      }}
      onKeyDown={(e) => { if (e.key === "Enter") onRowOpen(); }}
    >
      <div className="req-cell req-cell--check" role="cell">
        <input
          type="checkbox"
          checked={checked}
          onChange={onToggle}
          aria-label={`Select shift ${row.id}`}
        />
      </div>
      {show("status") && (
        <div className="req-cell sl-cell--status" role="cell">
          <SlStatusPill status={row.status} channel={row.channel} />
        </div>
      )}
      {show("worker") && (
        <div className="req-cell sl-cell--worker" role="cell">
          <SlWorkerCell row={row} />
        </div>
      )}
      {show("role") && (
        <div className="req-cell sl-cell--role" role="cell">
          <span className="sl-role">{row.role}</span>
          {row.note && (
            <span className="sl-role-note" title={row.note}>{row.note}</span>
          )}
        </div>
      )}
      {show("site") && (
        <div className="req-cell sl-cell--site" role="cell">
          <span className="sl-site">{row.location || "—"}</span>
        </div>
      )}
      {showDate && show("date") && (
        <div className="req-cell sl-cell--date" role="cell">
          <span className="sl-date-primary tabular">{row.dayShort}</span>
          <span className="sl-date-sub">{row.day && row.day.dayLabel}</span>
        </div>
      )}
      {show("sched") && (
        <div className="req-cell sl-cell--sched" role="cell">
          <span className="sl-time-primary tabular">{row.schedStart}</span>
          <span className="sl-time-sub">to {row.schedEnd}</span>
        </div>
      )}
      {show("clockIn") && (
        <div className="req-cell sl-cell--clock" role="cell">
          <SlClockCell
            stamp={row.clockIn}
            sched={row.schedStart}
            status={row.status}
            isPast={row.isPast}
          />
        </div>
      )}
      {show("clockOut") && (
        <div className="req-cell sl-cell--clock" role="cell">
          <SlClockCell
            stamp={row.clockOut}
            sched={row.schedEnd}
            status={row.status}
            isPast={row.isPast}
          />
        </div>
      )}
      <div className="req-cell sl-cell--chev" role="cell">
        <button
          type="button"
          className="iconbtn"
          aria-label={`Actions for ${row.id}`}
          onClick={onMenu}
        >
          <Icon name="MoreVert" size={18} />
        </button>
      </div>
    </div>
  );
}

// ---------- KPI strip ---------------------------------------------------
//
// A compact ribbon above the table that sums up the visible rows by
// status. Lets a scheduler scan "what's happening right now" without
// reading every row. Clicking a KPI doesn't filter (yet) — it's a
// visual summary, not a filter chip; the user already has the rail's
// filters for that. Keeps the surface read-first, action-second.

function SlSummary({ rows, view }) {
  const counts = useMemoLv(() => {
    const c = { floor: 0, break: 0, wrapping: 0, soon: 0, enroute: 0, open: 0, flagged: 0, closed: 0, later: 0 };
    rows.forEach((r) => { c[r.status] = (c[r.status] || 0) + 1; });
    return c;
  }, [rows]);
  const total = rows.length;
  const active = counts.floor + counts.wrapping + counts.break;
  const incoming = counts.soon + counts.enroute;
  const issues = counts.open + counts.flagged;
  const scope = view === "today" ? "today" : view === "week" ? "this week" : "this month";
  return (
    <div className="sl-summary" role="group" aria-label="Shift summary">
      <div className="sl-summary-total">
        <span className="sl-summary-total-num tabular">{total}</span>
        <span className="sl-summary-total-label">
          shift{total === 1 ? "" : "s"} · {scope}
        </span>
      </div>
      <div className="sl-summary-kpis">
        <span className="sl-kpi sl-kpi--success">
          <span className="sl-kpi-dot sl-kpi-dot--success" aria-hidden="true" />
          <span className="sl-kpi-num tabular">{active}</span>
          <span className="sl-kpi-label">On the floor</span>
        </span>
        <span className="sl-kpi sl-kpi--informative">
          <span className="sl-kpi-dot sl-kpi-dot--informative" aria-hidden="true" />
          <span className="sl-kpi-num tabular">{incoming}</span>
          <span className="sl-kpi-label">Incoming</span>
        </span>
        <span className="sl-kpi sl-kpi--error">
          <span className="sl-kpi-dot sl-kpi-dot--error" aria-hidden="true" />
          <span className="sl-kpi-num tabular">{issues}</span>
          <span className="sl-kpi-label">Open / flagged</span>
        </span>
        <span className="sl-kpi sl-kpi--default">
          <span className="sl-kpi-dot sl-kpi-dot--default" aria-hidden="true" />
          <span className="sl-kpi-num tabular">{counts.closed + counts.later}</span>
          <span className="sl-kpi-label">Scheduled / done</span>
        </span>
      </div>
    </div>
  );
}

// ---------- Root --------------------------------------------------------

function ScheduleListView({ view, anchor, locFilter, groupBy, onOpenShift, onOpenBooking }) {
  // 1. Resolve every day in the visible window.
  // 2. Pick the right shift dataset for each day.
  // 3. Flatten to one row per shift, with per-row date context.
  // 4. Apply site filter, sort, group.
  const rows = useMemoLv(() => {
    const days = _slDaysFor(view, anchor);
    const out = [];
    days.forEach((day) => {
      _slShiftsFor(day).forEach((s) => out.push(_slBuildRow(s, day)));
    });
    // Sort by date asc, then by scheduled start asc — so the day's
    // earliest shifts read top-down across the table.
    out.sort((a, b) => {
      if (a.dayKey !== b.dayKey) {
        const ad = a.day && a.day.key, bd = b.day && b.day.key;
        return (ad || "").localeCompare(bd || "");
      }
      return (a.startMin || 0) - (b.startMin || 0);
    });
    return out;
  }, [view, anchor]);

  const filtered = useMemoLv(() => _slApplyLocFilter(rows, locFilter), [rows, locFilter]);
  const groups = useMemoLv(() => _slGroupRows(filtered, groupBy), [filtered, groupBy]);

  const [selected, setSelected] = useStateLv(() => new Set());
  // Reset selection whenever the filtered set changes so stale ids don't
  // linger as ghost selections after a filter / view switch.
  React.useEffect(() => { setSelected(new Set()); }, [view, anchor, locFilter, groupBy]);

  const toggle = (id) => setSelected((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const allChecked = filtered.length > 0 && filtered.every((r) => selected.has(r.id));
  const toggleAll = () => {
    if (allChecked) setSelected(new Set());
    else setSelected(new Set(filtered.map((r) => r.id)));
  };

  const showDate = view !== "today";
  const hasSectionHeaders = groupBy && groupBy !== "worker";

  // ---- View customizer ------------------------------------------------
  // Per-table column visibility, persisted to localStorage. The Date
  // column is conditional on `showDate` (only Week/Month show it), so
  // we drop it from the manifest entirely on Today. The hook auto-drops
  // unknown ids from the user's hidden set when the manifest shrinks.
  const slVcManifest = React.useMemo(() => {
    const columns = [
      { id: "status",   label: "Status",    width: "144px" },
      { id: "worker",   label: "Worker",    width: "minmax(220px, 1.4fr)" },
      { id: "role",     label: "Role",      width: "minmax(180px, 1.1fr)" },
      { id: "site",     label: "Site",      width: "minmax(180px, 1.1fr)" },
    ];
    if (showDate) {
      columns.push({ id: "date", label: "Date", width: "110px" });
    }
    columns.push(
      { id: "sched",    label: "Scheduled", width: "140px" },
      { id: "clockIn",  label: "Clock-in",  width: "150px" },
      { id: "clockOut", label: "Clock-out", width: "150px" },
    );
    return {
      columns,
      filters: [], // The rail owns site / group / status filters — nothing to toggle here.
    };
  }, [showDate]);
  const vc = window.useViewCustomizer
    ? window.useViewCustomizer("schedule-list", slVcManifest)
    : { showCol: () => true, gridStyle: undefined, panel: null };
  // Bookend the user-toggleable tracks with the fixed checkbox (44px)
  // and per-row actions (52px) widths.
  const slGridStyle = vc.gridStyle
    ? { gridTemplateColumns: `44px ${vc.gridStyle.gridTemplateColumns} 52px` }
    : undefined;

  return (
    <React.Fragment>
      <SlSummary rows={filtered} view={view} />

      <div className="req-table-card sl-table-card" role="table" aria-label="Schedule list">
        <div className="req-scroll sl-scroll">
          <div
            className={`req-row sl-row sl-row--head req-row--header${showDate ? " sl-row--with-date" : ""}`}
            role="row"
            style={slGridStyle}>
            <div className="req-cell req-cell--check" role="columnheader">
              <input
                type="checkbox"
                checked={allChecked}
                onChange={toggleAll}
                aria-label="Select all shifts"
              />
            </div>
            {vc.showCol("status")   && <div className="req-cell sl-cell--status" role="columnheader"><span>Status</span></div>}
            {vc.showCol("worker")   && <div className="req-cell sl-cell--worker" role="columnheader"><span>Worker</span></div>}
            {vc.showCol("role")     && <div className="req-cell sl-cell--role" role="columnheader"><span>Role</span></div>}
            {vc.showCol("site")     && <div className="req-cell sl-cell--site" role="columnheader"><span>Site</span></div>}
            {showDate && vc.showCol("date") && <div className="req-cell sl-cell--date" role="columnheader"><span>Date</span></div>}
            {vc.showCol("sched")    && <div className="req-cell sl-cell--sched" role="columnheader"><span>Scheduled</span></div>}
            {vc.showCol("clockIn")  && <div className="req-cell sl-cell--clock" role="columnheader"><span>Clock-in</span></div>}
            {vc.showCol("clockOut") && <div className="req-cell sl-cell--clock" role="columnheader"><span>Clock-out</span></div>}
            <div className="req-cell sl-cell--chev" role="columnheader" aria-label=""></div>
          </div>

          <div className="req-body sl-body" role="rowgroup">
            {filtered.length === 0 && (
              <div className="sl-empty" role="row">
                <div className="sl-empty-icon" aria-hidden="true">
                  <Icon name="Calendar" size={28} />
                </div>
                <div className="sl-empty-text">
                  <h3>No shifts in this window</h3>
                  <p>Try widening the date range or clearing the site filter.</p>
                </div>
              </div>
            )}
            {groups.map((group) => (
              <React.Fragment key={group.key}>
                {hasSectionHeaders && group.label && (
                  <div className="sl-section" role="row">
                    <div className="sl-section-cell" role="rowheader">
                      {group.icon && (
                        <span className="sl-section-icon" aria-hidden="true">
                          <Icon name={group.icon} size={14} />
                        </span>
                      )}
                      <span className="sl-section-label">{group.label}</span>
                      {group.sub && <span className="sl-section-sub">{group.sub}</span>}
                      <span className="sl-section-count tabular">
                        {group.rows.length} shift{group.rows.length === 1 ? "" : "s"}
                      </span>
                    </div>
                  </div>
                )}
                {group.rows.map((row) => (
                  <SlRow
                    key={row.id}
                    row={row}
                    showDate={showDate}
                    vc={vc}
                    rowStyle={slGridStyle}
                    checked={selected.has(row.id)}
                    onToggle={() => toggle(row.id)}
                    onOpenShift={onOpenShift}
                    onOpenBooking={onOpenBooking}
                  />
                ))}
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>

      {/* The canonical Everest BulkActionBar (pages/bulk-actions.jsx)
          anchors to the bottom of the viewport when count > 0. It's
          mounted as a sibling of the table card so it floats above
          the page chrome — same placement scheduler picks it up on
          Requisitions / Timesheets / Workforce. */}
      {window.BulkActionBar && (
        <window.BulkActionBar
          count={selected.size}
          noun="shift"
          contextHint={_slSummariseSelection(filtered.filter((r) => selected.has(r.id)))}
          onClear={() => setSelected(new Set())}
          actions={_slBulkActions(
            filtered.filter((r) => selected.has(r.id)),
            () => setSelected(new Set())
          )}
          overflow={_slBulkOverflow(
            filtered.filter((r) => selected.has(r.id)),
            () => setSelected(new Set())
          )}
        />
      )}
      {vc.panel}
    </React.Fragment>
  );
}

// ---------- Bulk-selection helpers --------------------------------------
//
// What the BulkActionBar surfaces depends on what's IN the selection.
// A scheduler will reach for "Mark no-show" only when the selected
// rows haven't clocked in; "End shift now" only when they're on the
// floor. We don't hide the actions — we LABEL them with their
// eligible count so the user knows the override will fan out to the
// subset that actually qualifies. Then the toast restates the result.

function _slSummariseSelection(rows) {
  // Compact line under the count: which states are represented in
  // the selection. Keeps the bar from feeling like a black box.
  if (!rows || !rows.length) return null;
  const c = {};
  rows.forEach((r) => { c[r.status] = (c[r.status] || 0) + 1; });
  const labels = [];
  const order = ["floor", "break", "wrapping", "enroute", "soon", "later", "flagged", "open", "closed"];
  order.forEach((k) => {
    if (c[k]) labels.push(`${c[k]} ${SL_STATUS_LABEL[k].toLowerCase()}`);
  });
  // Cap to first 3 buckets so the line doesn't run off the bar.
  return labels.slice(0, 3).join(" \u00b7 ") + (labels.length > 3 ? " \u2026" : "");
}

// Eligibility predicates for each action. Keeping them in one place
// makes the action wire-up below readable + means the toast can
// re-use the same predicate for its "X of Y" math.
const SL_ELIGIBILITY = {
  // Active on the floor / on break / wrapping — anything that has
  // already clocked in but isn't closed.
  active: (r) => r.status === "floor" || r.status === "break" || r.status === "wrapping",
  // Pre-clock-in shifts — still waiting on the worker to start.
  preStart: (r) => r.status === "soon" || r.status === "enroute" || r.status === "later" || r.status === "flagged",
  // Unassigned slots that need a body.
  open: (r) => r.channel === "open" || !r.workerId,
  // Rows that have a worker we can talk to.
  hasWorker: (r) => !!r.workerId,
  // Rows whose timesheet is ready to lock in (clocked out + not open).
  closed: (r) => r.status === "closed" && !!r.workerId,
};

function _slCountEligible(rows, predKey) {
  const pred = SL_ELIGIBILITY[predKey];
  if (!pred) return 0;
  let n = 0;
  rows.forEach((r) => { if (pred(r)) n++; });
  return n;
}

// Build a single bulk action descriptor for the BulkActionBar. `predKey`
// gates eligibility; the toast message reports how many of the selection
// the action actually applied to so the override never feels like a
// silent fan-out.
function _slMakeAction({ icon, label, predKey, kind, danger, divider, requireConfirm, confirmTitle, confirmBody, primaryLabel, run, openPanel }) {
  if (divider) return { divider: true };
  return {
    icon,
    label,
    kind: danger ? "danger" : kind,
    onClick: undefined, // assigned by the caller
    predKey,
    requireConfirm,
    confirmTitle,
    confirmBody,
    primaryLabel,
    run,
    openPanel,
  };
}

function _slBindAction(a, rows, onClear) {
  if (a.divider) return a;
  const showToast = window.showToast;
  const openConfirm = window.openConfirm;
  const eligible = a.predKey ? rows.filter((r) => SL_ELIGIBILITY[a.predKey](r)) : rows;
  const skipped = rows.length - eligible.length;
  const ranLabel = `${eligible.length} shift${eligible.length === 1 ? "" : "s"}`;
  const fire = () => {
    if (eligible.length === 0) {
      if (showToast) showToast(`No selected shifts are eligible for \u201c${a.label}\u201d`, { kind: "warning" });
      return;
    }
    // Actions that open a side panel (e.g. bulk allocation) hand off to
    // the type-aware assign panel rather than firing a toast.
    if (a.openPanel && window.openAssignWorkerPanel) {
      const first = eligible[0] || {};
      window.openAssignWorkerPanel({
        supplierId: first.supplierId || (window.REQ_SUPPLIERS && Object.keys(window.REQ_SUPPLIERS)[0]),
        role: first.role || "Worker",
        engagementType: "Shift",
        bulkCount: eligible.length,
        onBulkAssign: (workers) => {
          if (showToast) showToast(`${workers.length} worker${workers.length === 1 ? "" : "s"} allocated across ${eligible.length} open slot${eligible.length === 1 ? "" : "s"}`, { kind: "success" });
          onClear && onClear();
        },
      });
      return;
    }
    const msg = a.run ? a.run(eligible, skipped) : `${a.label} \u00b7 ${ranLabel}`;
    if (showToast) showToast(msg, { kind: a.danger ? "warning" : (a.kind === "primary" ? "success" : "success") });
    onClear && onClear();
  };
  return {
    icon: a.icon,
    label: skipped && eligible.length
      ? `${a.label} \u00b7 ${eligible.length}`
      : a.label,
    kind: a.kind,
    onClick: (a.requireConfirm && openConfirm)
      ? () => openConfirm({
          title: typeof a.confirmTitle === "function" ? a.confirmTitle(eligible, skipped) : a.confirmTitle,
          body:  typeof a.confirmBody  === "function" ? a.confirmBody(eligible, skipped)  : a.confirmBody,
          primaryLabel: a.primaryLabel || a.label,
          danger: !!a.danger,
          onConfirm: fire,
        })
      : fire,
  };
}

function _slBulkActions(rows, onClear) {
  const items = [
    _slMakeAction({
      icon: "TimeAdd", label: "Add time", kind: "primary",
      predKey: "hasWorker",
      run: (eligible) => `Time adjustment opened for ${eligible.length} shift${eligible.length === 1 ? "" : "s"}`,
    }),
    _slMakeAction({
      icon: "Notes", label: "Message",
      predKey: "hasWorker",
      run: (eligible) => `Composing message to ${eligible.length} worker${eligible.length === 1 ? "" : "s"}`,
    }),
    _slMakeAction({
      icon: "Alert", label: "Mark no-show",
      predKey: "preStart",
      requireConfirm: true,
      confirmTitle: (e) => `Mark ${e.length} shift${e.length === 1 ? "" : "s"} as no-show?`,
      confirmBody: (e, s) => `Each shift will be flagged, suppliers will be notified, and the slot will reopen for refill.${s ? ` ${s} shift${s === 1 ? "" : "s"} already on the floor or completed will be skipped.` : ""}`,
      primaryLabel: "Mark no-show",
      run: (e, s) => `${e.length} shift${e.length === 1 ? "" : "s"} marked no-show${s ? ` \u00b7 ${s} skipped` : ""}`,
    }),
    _slMakeAction({
      icon: "Send", label: "Boost reach",
      predKey: "open",
      run: (e) => `Boosted ${e.length} open slot${e.length === 1 ? "" : "s"} to all tiered suppliers`,
    }),
    _slMakeAction({ divider: true }),
    _slMakeAction({
      icon: "Cancel", label: "Remove from shift", danger: true,
      predKey: "hasWorker",
      requireConfirm: true,
      confirmTitle: (e) => `Remove ${e.length} worker${e.length === 1 ? "" : "s"} from their shift?`,
      confirmBody: "The slots reopen for refill and the workers are notified. Existing time entries are preserved on the timesheet.",
      primaryLabel: "Remove",
      run: (e) => `${e.length} worker${e.length === 1 ? "" : "s"} removed from shift`,
    }),
  ];
  return items.map((a) => _slBindAction(a, rows, onClear));
}

function _slBulkOverflow(rows, onClear) {
  const items = [
    _slMakeAction({
      icon: "PersonClock", label: "Clock in now",
      predKey: "preStart",
      run: (e) => `${e.length} worker${e.length === 1 ? "" : "s"} clocked in manually`,
    }),
    _slMakeAction({
      icon: "ClipboardPerson", label: "End shift now",
      predKey: "active",
      requireConfirm: true,
      confirmTitle: (e) => `End ${e.length} active shift${e.length === 1 ? "" : "s"} now?`,
      confirmBody: "This clocks out each worker at the current time and locks the timesheets for review.",
      primaryLabel: "End shifts",
      run: (e) => `${e.length} shift${e.length === 1 ? "" : "s"} ended`,
    }),
    _slMakeAction({
      icon: "DrinkMug", label: "Start break",
      predKey: "active",
      run: (e) => `${e.length} worker${e.length === 1 ? "" : "s"} marked on break`,
    }),
    _slMakeAction({
      icon: "PersonPlus", label: "Assign workers…",
      predKey: "open",
      openPanel: true,
    }),
    _slMakeAction({
      icon: "Check", label: "Approve hours",
      predKey: "closed",
      run: (e) => `${e.length} timesheet${e.length === 1 ? "" : "s"} approved \u2014\u2009ready for invoicing`,
    }),
    _slMakeAction({
      icon: "Person", label: "Message supplier",
      predKey: "hasWorker",
      run: (e) => `Opening supplier threads for ${e.length} shift${e.length === 1 ? "" : "s"}`,
    }),
    _slMakeAction({
      icon: "Alert", label: "Report worker",
      predKey: "hasWorker",
      requireConfirm: true,
      confirmTitle: (e) => `Report ${e.length} worker${e.length === 1 ? "" : "s"}?`,
      confirmBody: "Each report sends a flag to the assigning supplier and to the program admin. Use it for safety, conduct, or quality issues. The shifts remain in place; this does not remove the workers.",
      primaryLabel: "File reports",
      run: (e) => `${e.length} report${e.length === 1 ? "" : "s"} filed`,
    }),
    _slMakeAction({
      icon: "FileDownload", label: "Export CSV",
      run: (e) => `Exported ${e.length} shift${e.length === 1 ? "" : "s"} to schedule.csv`,
    }),
  ];
  return items.map((a) => _slBindAction(a, rows, onClear));
}

Object.assign(window, {
  ScheduleListView,
});
