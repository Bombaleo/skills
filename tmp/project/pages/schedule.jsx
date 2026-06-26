// =====================================================================
// Flex Work — Schedule
//   · SchedulePage          — root routing; segmented Calendar | List with
//                              a sub-toggle for By worker / By job.
//   · CalendarByWorker      — week grid; rows are workers (avatar + hrs);
//                              columns are Mon–Sun; shift cards with a
//                              coloured left bar by supplier.
//   · CalendarByJob         — week grid; rows are job titles (mostly empty).
//   · ListByDay             — searchable list of bookings (ID · Status ·
//                              Dates · Jobs · Location).
//   · BookingDetailsPage    — booking hero + schedule grid + roster /
//                              shifts list. Scope-aware: the same page
//                              renders full multi-worker × multi-day
//                              bookings, single-worker bookings (one
//                              person's week), and single-day bookings
//                              (one date, multiple workers).
//   · ShiftDetailsPage      — a single worker × single day's scheduled
//                              record: hero with date / time / supplier,
//                              schedule details, time tracking, activity.
//
// Booking and shift IDs encode scope so the routing can carry it:
//   REQ-1234              full booking          (multi-worker × multi-day)
//   REQ-1234@w-ml         worker-scoped booking (one worker, their days)
//   REQ-1234#0            date-scoped booking   (one day, multiple workers)
//   REQ-1234@w-ml#0       single shift          (one worker, one day)
// =====================================================================

const { useState: useStateSc, useMemo: useMemoSc, useRef: useRefSc, useEffect: useEffectSc } = React;

// ---------- Booking / shift ID helpers ----------------------------------
// Parse and build compound booking IDs. The full form is:
//   <reqId>[@<workerId>][#<dayKey>]
//
// `dayKey` is prefixed to distinguish what kind of day we're pointing at:
//   #W<n>  — week index 0..6 into SCH_DAYS (used by the schedule calendar)
//   #D<n>  — req-date index into the parent requisition's `dates` array
//            (used when navigating from a requisition booking row)
//   #<n>   — legacy / bare number, treated as a week index for back-compat

function parseBookingId(id) {
  if (!id) return { reqId: null, workerId: null, weekDayIdx: null, reqDateIdx: null };
  let rest = String(id);
  let workerId = null;
  let weekDayIdx = null;
  let reqDateIdx = null;
  const at = rest.indexOf("@");
  let afterAt = "";
  if (at >= 0) {
    afterAt = rest.slice(at + 1);
    rest = rest.slice(0, at);
  }
  // The hash can live either in `afterAt` (after a workerId) or in `rest`
  // (when there's no @worker). Find whichever has it.
  const splitOnHash = (s) => {
    const hash = s.indexOf("#");
    if (hash < 0) return { head: s, tail: null };
    return { head: s.slice(0, hash), tail: s.slice(hash + 1) };
  };
  if (afterAt) {
    const { head, tail } = splitOnHash(afterAt);
    workerId = head;
    if (tail != null) decodeDay(tail);
  } else {
    const { head, tail } = splitOnHash(rest);
    rest = head;
    if (tail != null) decodeDay(tail);
  }
  function decodeDay(tail) {
    const ch = tail[0];
    const num = parseInt(tail.replace(/^[WD]/, ""), 10);
    if (!Number.isFinite(num)) return;
    if (ch === "W") weekDayIdx = num;else
    if (ch === "D") reqDateIdx = num;else
    weekDayIdx = num;
  }
  return { reqId: rest, workerId, weekDayIdx, reqDateIdx };
}

function buildBookingId({ reqId, workerId, weekDayIdx, reqDateIdx, dayIdx }) {
  let out = reqId;
  if (workerId) out += `@${workerId}`;
  // Accept the older `dayIdx` argument as an alias for weekDayIdx so
  // existing callers don't need to migrate.
  const wIdx = weekDayIdx != null ? weekDayIdx : dayIdx;
  if (wIdx != null) out += `#W${wIdx}`;else
  if (reqDateIdx != null) out += `#D${reqDateIdx}`;
  return out;
}

// ---------- Mock data ----------------------------------------------------
// Today + this-week structure are derived from the shared flexToday().
// The schedule keeps a Mon–Sun rail, anchored to the week that contains
// today, so the same SCH_WORKER_SCHED keys (mon/tue/…) keep working.
const SCH_TODAY_DATE = window.flexToday ? window.flexToday() : new Date(2026, 4, 19);
const _SCH_WEEK_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const _SCH_WEEK_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
function _schWeekStart(d) {
  const x = new Date(d);
  // JS: Sun=0…Sat=6. We want Monday as week start.
  const offset = (x.getDay() + 6) % 7;
  x.setDate(x.getDate() - offset);
  x.setHours(0, 0, 0, 0);
  return x;
}
const _SCH_WEEK_START = _schWeekStart(SCH_TODAY_DATE);

const SCH_DAYS = _SCH_WEEK_KEYS.map((key, i) => {
  const d = new Date(_SCH_WEEK_START);
  d.setDate(d.getDate() + i);
  return { key, label: _SCH_WEEK_LABELS[i], date: d.getDate(), month: d.getMonth(), year: d.getFullYear() };
});

// Build a fresh SCH_DAYS-shape array for the week containing `anchor`.
// The schedule grid reads this so its column headers track wherever the
// user has stepped to with the prev/next paddle.
function schWeekDaysFor(anchor) {
  const start = _schWeekStart(anchor);
  return _SCH_WEEK_KEYS.map((key, i) => {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    return { key, label: _SCH_WEEK_LABELS[i], date: d.getDate(), month: d.getMonth(), year: d.getFullYear() };
  });
}

// Whole-week delta (in weeks) between the week containing `anchor` and
// the week containing today. 0 means the current week; negative = past
// weeks; positive = future weeks.
function schWeekOffsetFor(anchor) {
  const a = _schWeekStart(anchor);
  const t = _SCH_WEEK_START;
  return Math.round((a - t) / (7 * 24 * 60 * 60 * 1000));
}

// Project the curated SCH_WORKER_SCHED onto an arbitrary week. The
// current week returns the hand-authored data verbatim. Other weeks
// get a deterministic, week-offset-seeded transformation so the grid
// reads as a genuinely different week — shifts rotate across days,
// some are dropped, spans clamp at the week edge — without making the
// data feel random on every render.
function projectWeekSchedule(anchor) {
  const offset = schWeekOffsetFor(anchor);
  if (offset === 0) return SCH_WORKER_SCHED;
  // Stable hash so the same week always renders the same way.
  const hash = (a, b) => (a * 9301 + b * 49297 + 233280) % 233280 / 233280;
  const rotated = SCH_WORKER_SCHED.map((row, ri) => {
    const shifts = row.shifts.
    map((s, si) => {
      const oldIdx = _SCH_WEEK_KEYS.indexOf(s.day);
      // Rotate the start day by the week offset so the week silhouette
      // shifts across the calendar; clamp the span so it never spills
      // past Sunday.
      let newIdx = ((oldIdx + offset) % 7 + 7) % 7;
      const span = Math.max(1, Math.min(s.span || 1, 7 - newIdx));
      return { ...s, day: _SCH_WEEK_KEYS[newIdx], span };
    }).
    filter((_, si) => hash(ri * 11 + si, Math.abs(offset) * 7) > 0.18);
    return { ...row, shifts };
  });
  // Drop rows that ended up empty after filtering so the grid doesn't
  // render a giant gap of all-Off cells.
  return rotated.filter((r) => r.shifts.length > 0);
}

// tone: "teal" | "yellow" | "blue" — colours the left rail on the shift card.
// Each shift's role mirrors the worker's first listed job in WORKERS so
// the schedule never claims someone is doing a job they aren't certified for.
// `reqId` ties the row to its parent booking on the Requisitions list,
// so clicking the shift opens the booking for that worker.
const SCH_WORKER_SCHED = [
{
  worker: "w-ml", hrs: "40h", reqId: "J6K7L8M9N0",
  shifts: [
  { day: "mon", tone: "teal", role: "Production Associate", time: "6:00 AM–3:00 PM", span: 5 },
  { day: "sat", tone: "yellow", role: "Production Associate", time: "6:00 AM–3:00 PM", span: 1 }]

},
{
  worker: "w-jc", hrs: "18h", reqId: "Z6A7B8C9D0",
  shifts: [
  { day: "thu", tone: "blue", role: "Line Manager", time: "7:00 AM–4:00 PM", span: 2 }]

},
{
  worker: "w-cc", hrs: "18h", reqId: "J6K7L8M9N0",
  shifts: [
  { day: "tue", tone: "yellow", role: "Prep Cook", time: "6:00 AM–3:00 PM", span: 2 }]

},
{
  worker: "w-mh", hrs: "18h", reqId: "Z6A7B8C9D0",
  shifts: [
  { day: "wed", tone: "yellow", role: "Server", time: "4:00 PM–12:00 AM", span: 2 }]

},
{
  worker: "w-ks", hrs: "40h", reqId: "J6K7L8M9N0",
  shifts: [
  { day: "mon", tone: "teal", role: "Server", time: "11:00 AM–7:00 PM", span: 5 }]

},
{
  worker: "w-ja", hrs: "16h", reqId: "Z6A7B8C9D0",
  shifts: [
  { day: "thu", tone: "yellow", role: "Bartender", time: "4:00 PM–12:00 AM", span: 2 }]

},
{
  worker: "w-pr", hrs: "18h", reqId: "Y1Z2A3B4C5",
  shifts: [
  { day: "tue", tone: "yellow", role: "Production Associate", time: "6:00 AM–3:00 PM", span: 2 }]

},
{
  worker: "w-mw", hrs: "36h", reqId: "O1P2Q3R4S5",
  shifts: [
  { day: "mon", tone: "teal", role: "Factory Line Assembler", time: "7:00 AM–3:30 PM", span: 4 }]

},
{
  worker: "w-tk", hrs: "16h", reqId: "Y1Z2A3B4C5",
  shifts: [
  { day: "fri", tone: "blue", role: "Prep Cook", time: "7:00 AM–3:00 PM", span: 2 }]

},
{
  worker: "w-ss", hrs: "24h", reqId: "T6U7V8W9X0",
  shifts: [
  { day: "wed", tone: "teal", role: "Warehouse Clerk", time: "8:00 AM–4:00 PM", span: 3 }]

}];


// Every worker should have an "active" shift on TODAY's date so the
// Worker mobile preview (and the agency Schedule grid) reads as a live,
// in-progress demo regardless of which day it's loaded on. This block
// post-processes SCH_WORKER_SCHED in two passes:
//
//   1. For each existing row that doesn't already cover today, append a
//      shift on today's day-key. Time + role + reqId stay tied to the
//      worker's existing booking so the data still lines up with the
//      Requisitions list and the rest of the demo.
//
//   2. For each worker in window.WORKERS who isn't already in
//      SCH_WORKER_SCHED, insert a fresh row whose only shift is today.
//      The role/req are picked deterministically:
//        – pick a Booked req that lists this worker's supplier and a
//          job the worker is certified for, falling back to any req
//          on this supplier's distribution, falling back to the first.
//
// The result: every worker in the current industry has at least one
// SCH_WORKER_SCHED shift on today's column, which the worker-mobile
// builder marks as status="active". Re-runs on every load, so the demo
// is precise on Mon, on Tue, on a holiday — whatever today happens to
// be when someone opens the prototype.
(function ensureTodayShifts() {
  const todayIdx = (SCH_TODAY_DATE.getDay() + 6) % 7;
  const todayKey = _SCH_WEEK_KEYS[todayIdx];

  const rowCoversDay = (row, key) => row.shifts.some((s) => {
    const startIdx = _SCH_WEEK_KEYS.indexOf(s.day);
    const tgtIdx = _SCH_WEEK_KEYS.indexOf(key);
    return tgtIdx >= startIdx && tgtIdx < startIdx + (s.span || 1);
  });

  // SCH expects compact "6:00 AM–3:00 PM" while REQUISITIONS carry
  // "6:00 AM – 3:00 PM". Normalize.
  const normalizeTime = (t) => (t || "").replace(/\s*–\s*/, "–");

  const ALL_WORKERS = typeof window !== "undefined" && window.WORKERS || [];
  const ALL_REQS = typeof REQUISITIONS !== "undefined" ? REQUISITIONS : [];

  const pickReqForWorker = (worker) => {
    if (!worker) return ALL_REQS[0];
    const onSupplier = ALL_REQS.filter((r) =>
    r.status !== "Completed" &&
    r.suppliers && worker.supplier && r.suppliers.includes(worker.supplier)
    );
    const supplierAndJob = onSupplier.find((r) =>
    r.jobs && (worker.jobs || []).some((j) => r.jobs.includes(j))
    );
    if (supplierAndJob) return supplierAndJob;
    if (onSupplier[0]) return onSupplier[0];
    const anyJob = ALL_REQS.find((r) =>
    r.jobs && (worker.jobs || []).some((j) => r.jobs.includes(j))
    );
    return anyJob || ALL_REQS[0];
  };

  const pickRoleForWorker = (worker, req) => {
    const jobs = worker && worker.jobs || [];
    if (req && req.jobs && req.jobs.length) {
      const shared = req.jobs.find((j) => jobs.includes(j));
      if (shared) return shared;
      // No overlap — prefer the worker's primary job so the "active"
      // shift still reads as something they're certified for.
      if (jobs[0]) return jobs[0];
      return req.jobs[0];
    }
    return jobs[0] || "Production Associate";
  };

  // (1) Augment existing rows that don't already cover today.
  SCH_WORKER_SCHED.forEach((row) => {
    if (rowCoversDay(row, todayKey)) return;
    const worker = ALL_WORKERS.find((w) => w.id === row.worker);
    const req = ALL_REQS.find((r) => r.id === row.reqId);
    const role = pickRoleForWorker(worker, req);
    row.shifts.push({
      day: todayKey,
      tone: "yellow",
      role,
      time: normalizeTime(req && req.time) || "8:00 AM–5:00 PM",
      span: 1
    });
  });

  // (2) Add today-only rows for workers not yet on the schedule.
  const existingIds = new Set(SCH_WORKER_SCHED.map((r) => r.worker));
  ALL_WORKERS.forEach((w) => {
    if (existingIds.has(w.id)) return;
    const req = pickReqForWorker(w);
    const role = pickRoleForWorker(w, req);
    SCH_WORKER_SCHED.push({
      worker: w.id,
      hrs: "8h",
      reqId: req ? req.id : "—",
      shifts: [{
        day: todayKey,
        tone: "yellow",
        role,
        time: normalizeTime(req && req.time) || "8:00 AM–5:00 PM",
        span: 1
      }]
    });
  });
})();

const SCH_JOBS = [
"Host", "Server", "Concierge", "Bartender", "Event Coordinator",
"Front Desk Agent", "Room Attendant", "Valet", "Catering Assistant"];


// Built dynamically from REQUISITIONS so the Schedule list IDs / dates /
// locations / jobs always match what shows up in the Requisitions list.
const SCH_BOOKINGS = REQUISITIONS.map((r) => ({
  id: r.id,
  status: r.status === "Completed" ? "In progress" : r.status,
  dates: summarizeDates(r.dates),
  jobs: r.jobs,
  more: r.more || 0,
  location: r.location
}));

const SCH_PAGE_SIZE = 10;

const SCH_STATUS_HUES = {
  "Booked": "informative",
  "In progress": "default"
};

// ---------- Status pill --------------------------------------------------
function SchStatusPill({ status }) {
  const hue = SCH_STATUS_HUES[status] || "default";
  return <span className={`req-pill req-pill--${hue}`}>{status}</span>;
}

// ---------- Segmented Calendar | List -----------------------------------
function SchSegment({ value, onChange, options }) {
  return (
    <div className="sch-seg" role="tablist" aria-label="View">
      {options.map((opt) =>
      <button
        key={opt.value}
        type="button"
        role="tab"
        aria-selected={value === opt.value}
        className={`sch-seg-btn${value === opt.value ? " sch-seg-btn--active" : ""}`}
        onClick={() => onChange(opt.value)}>
        
          {opt.label}
        </button>
      )}
    </div>);

}

// ---------- Selected (✓) filter chip ------------------------------------
function SchSelectedChip({ label, count, onClick, withChevron = true }) {
  return (
    <button type="button" className="sch-chip sch-chip--selected" onClick={onClick}>
      <span className="sch-chip-check" aria-hidden="true">
        <Icon name="Check" size={12} />
      </span>
      <span>{label}</span>
      {count != null && <span className="sch-chip-count">{count}</span>}
      {withChevron &&
      <span className="sch-chip-trail" aria-hidden="true">
          <Icon name="ChevronDown" size={14} />
        </span>
      }
    </button>);

}

// ---------- Plain filter button (icon + label) --------------------------
function SchFilterBtn({ label, onClick }) {
  return (
    <button type="button" className="sch-chip" onClick={onClick}>
      <span className="sch-chip-funnel" aria-hidden="true">
        <Icon name="Adjustment" size={14} />
      </span>
      <span>{label}</span>
    </button>);

}

// ---------- Top rail: view dropdown · period stepper · Today · Filters ---
const SCH_VIEW_LABEL = { today: "Day", week: "Week", month: "Month" };
const SCH_VIEW_VALUES = ["today", "week", "month"];

function _mondayOf(d) {
  const x = new Date(d);
  // Week starts Monday — same convention as SCH_DAYS / _SCH_WEEK_START.
  const offset = (x.getDay() + 6) % 7;
  x.setDate(d.getDate() - offset);
  x.setHours(0, 0, 0, 0);
  return x;
}
function _fmtPeriod(view, anchor) {
  const opts = { month: "short", day: "numeric" };
  if (view === "today") {
    return anchor.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
  }
  if (view === "week") {
    const start = _mondayOf(anchor);
    const end = new Date(start);end.setDate(start.getDate() + 6);
    const sM = start.toLocaleDateString("en-US", { month: "short" });
    const eM = end.toLocaleDateString("en-US", { month: "short" });
    const y = end.getFullYear();
    return sM === eM ?
    `${sM} ${start.getDate()} – ${end.getDate()}, ${y}` :
    `${sM} ${start.getDate()} – ${eM} ${end.getDate()}, ${y}`;
  }
  return anchor.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

function SchViewDropdown({ value, onChange }) {
  const [open, setOpen] = useStateSc(false);
  const ref = useRefSc(null);
  useEffectSc(() => {
    if (!open) return;
    const onDoc = (e) => {if (ref.current && !ref.current.contains(e.target)) setOpen(false);};
    const onKey = (e) => {if (e.key === "Escape") setOpen(false);};
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);
  return (
    <div className="sch-viewmenu" ref={ref}>
      <button
        type="button"
        className="sch-viewmenu-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}>
        
        <Icon name="Calendar" size={14} />
        <span className="sch-viewmenu-label">{SCH_VIEW_LABEL[value]}</span>
        <span className="sch-viewmenu-chev" data-open={open}>
          <Icon name="ChevronDown" size={14} />
        </span>
      </button>
      {open &&
      <div className="sch-viewmenu-pop" role="listbox">
          {SCH_VIEW_VALUES.map((k) =>
        <button
          key={k}
          type="button"
          role="option"
          aria-selected={value === k}
          className={`sch-viewmenu-opt${value === k ? " sch-viewmenu-opt--active" : ""}`}
          onClick={() => {onChange(k);setOpen(false);}}>
          
              <span>{SCH_VIEW_LABEL[k]}</span>
              {value === k && <Icon name="Check" size={14} />}
            </button>
        )}
        </div>
      }
    </div>);

}

const SCH_GROUPBY_OPTIONS = [
{ value: "booking", label: "By work assignment", icon: "Briefcase" },
{ value: "location", label: "By site", icon: "Location" },
{ value: "worker", label: "By worker", icon: "Person" },
{ value: "status", label: "By status", icon: "ClipboardCircleCheck" },
{ value: "supplier", label: "By supplier", icon: "Building" }];


function SchRail({ mode = "calendar", onModeChange, view, onViewChange, anchor, onAnchorChange, leftChips, groupBy, onGroupByChange, locFilter, onLocFilterChange }) {
  const step = (dir) => {
    const d = new Date(anchor);
    if (view === "today") d.setDate(d.getDate() + dir);else
    if (view === "week") d.setDate(d.getDate() + dir * 7);else
    d.setMonth(d.getMonth() + dir);
    onAnchorChange(d);
    const unit = view === "today" ? "day" : view;
    showToast(dir < 0 ? `Previous ${unit}` : `Next ${unit}`);
  };

  const goToday = () => {
    onAnchorChange(new Date(SCH_TODAY_DATE));
    showToast("Jumped to today");
  };

  const isToday =
  anchor.getFullYear() === SCH_TODAY_DATE.getFullYear() &&
  anchor.getMonth() === SCH_TODAY_DATE.getMonth() &&
  anchor.getDate() === SCH_TODAY_DATE.getDate();

  const periodLabel = _fmtPeriod(view, anchor);

  const onLocations = (e) => openFilter(e.currentTarget, {
    title: "Locations",
    options: (typeof LOCATIONS !== "undefined" ? LOCATIONS : []).map((l) => ({ value: l.id, label: l.name })),
    selected: locFilter,
    onApply: (vals) => {
      onLocFilterChange && onLocFilterChange(vals);
      showToast(vals.length ? `Showing ${vals.length} location${vals.length === 1 ? "" : "s"}` : "All locations");
    }
  });

  const onFilters = (e) => openFilter(e.currentTarget, {
    title: "More filters",
    options: ["Status: Working", "Status: En route", "Status: Off", "Has shift", "Has off day"],
    onApply: (vals) => showToast(`Filters applied: ${vals.length}`)
  });

  // Customize is only meaningful in List mode — there are no
  // user-toggleable columns on the calendar grids. Drives the
  // ScheduleListView's view-customizer registered as `__activeVc`.
  const onCustomize = (e) => {
    const vc = window.__activeVc;
    if (vc && vc.openPanel) { vc.openPanel(e.currentTarget); return; }
    openMenu(e.currentTarget, [{ icon: "Settings", label: "Column settings — switch to List view" }]);
  };

  const onGroupBy = (e) => openMenu(e.currentTarget, SCH_GROUPBY_OPTIONS.map((o) => ({
    icon: groupBy === o.value ? "Check" : o.icon,
    label: o.label,
    onClick: () => {
      onGroupByChange && onGroupByChange(o.value);
      showToast(`Grouped ${o.label.toLowerCase()}`);
    }
  })));

  const groupByCurrent = SCH_GROUPBY_OPTIONS.find((o) => o.value === groupBy) || SCH_GROUPBY_OPTIONS[0];

  return (
    <div className="sch-rail">
      <div className="sch-rail-left">
        <SchSegment
          value={mode}
          onChange={(v) => {
            onModeChange && onModeChange(v);
            showToast(v === "list" ? "List view — every shift in the window" : "Calendar view");
          }}
          options={[
          { value: "calendar", label: "Calendar" },
          { value: "list", label: "List" }]} />
        

        <SchViewDropdown value={view} onChange={onViewChange} />

        <div className="sch-rail-stepper" role="group" aria-label={`Step ${view === "today" ? "day" : view}`}>
          <button
            type="button"
            className="sch-paddle sch-paddle--flush"
            aria-label={`Previous ${view === "today" ? "day" : view}`}
            onClick={() => step(-1)}>
            
            <Icon name="ChevronLeft" size={16} />
          </button>
          <span className="sch-rail-period tabular" aria-live="polite">{periodLabel}</span>
          <button
            type="button"
            className="sch-paddle sch-paddle--flush"
            aria-label={`Next ${view === "today" ? "day" : view}`}
            onClick={() => step(1)}>
            
            <Icon name="ChevronRight" size={16} />
          </button>
        </div>

        <button
          type="button"
          className="sch-rail-todaybtn"
          onClick={goToday}
          aria-pressed={isToday}
          disabled={isToday}
          title={isToday ? "Already on today" : "Jump to today"}>
          
          Today
        </button>
      </div>
      <div className="sch-rail-right">
        <button type="button" className="sch-chip" onClick={onGroupBy} title="Group by">
            <span className="sch-chip-funnel" aria-hidden="true">
              <Icon name={groupByCurrent.icon} size={14} />
            </span>
            <span>{groupByCurrent.label}</span>
            <span className="sch-chip-trail" aria-hidden="true">
              <Icon name="ChevronDown" size={14} />
            </span>
          </button>
        {locFilter.length > 0 ?
        <SchSelectedChip
          label="Sites"
          count={locFilter.length}
          onClick={onLocations} /> :


        <button type="button" className="sch-chip" onClick={onLocations}>
            <span className="sch-chip-funnel" aria-hidden="true">
              <Icon name="Location" size={14} />
            </span>
            <span>Sites</span>
            <span className="sch-chip-trail" aria-hidden="true">
              <Icon name="ChevronDown" size={14} />
            </span>
          </button>
        }
        <button
          type="button"
          className="iconbtn"
          onClick={onCustomize}
          aria-label="Customize columns"
          title={mode === "list" ? "Customize columns" : "Switch to List view to customize columns"}>
          
          <Icon name="Adjustment" size={18} />
        </button>
        <button
          type="button"
          className="iconbtn"
          onClick={onFilters}
          aria-label="More filters"
          title="More filters">
          
          <Icon name="Filter" size={18} />
        </button>
        {leftChips}
      </div>
    </div>);

}

// =====================================================================
// Calendar view — shared grid primitives
// =====================================================================

function SchGridHeader({ firstLabel = "Worker", todayIdx = null, days = SCH_DAYS }) {
  return (
    <div className="sch-grid-row sch-grid-row--head" role="row">
      <div className="sch-grid-cell sch-grid-cell--rowhead" role="columnheader">
        <span className="sch-grid-head-day">{firstLabel}</span>
      </div>
      {days.map((d, idx) => {
        const isToday = todayIdx != null && idx === todayIdx;
        return (
          <div
            key={d.key}
            className={`sch-grid-cell sch-grid-cell--head${isToday ? " sch-grid-cell--today-head" : ""}`}
            role="columnheader">
            
            <span className="sch-grid-head-day">{d.label}</span>
            <span className="sch-grid-head-num">{d.date}</span>
            {isToday && <span className="sch-grid-head-now">Now</span>}
          </div>);

      })}
    </div>);

}

function ShiftCard({ tone = "teal", role, time, onClick, state = null, worker = null, reqId = null, day = null }) {
  const stateCls = state ? ` sch-shift--state-${state}` : "";
  // Hover preview — captures the card's bounding rect so the hover card
  // can clamp itself into the viewport (same logic as the timeline).
  const [hover, setHover] = useStateSc(null);
  const handleEnter = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    setHover({
      centerX: r.left + r.width / 2,
      belowY: r.bottom + 8,
      aboveY: r.top - 8
    });
  };
  const handleLeave = () => setHover(null);
  return (
    <React.Fragment>
      <button
        type="button"
        className={`sch-shift sch-shift--${tone}${stateCls}`}
        onClick={onClick}
        onMouseEnter={handleEnter}
        onMouseLeave={handleLeave}
        onFocus={handleEnter}
        onBlur={handleLeave}>
        
        <span className={`sch-shift-bar sch-shift-bar--${tone}`} aria-hidden="true" />
        <span className="sch-shift-text">
          <span className="sch-shift-role">
            {role}
            {state === "floor" && <span className="sch-shift-livedot" aria-label="On the floor" />}
            {state === "wrapping" && <span className="sch-shift-livedot sch-shift-livedot--warn" aria-label="Wrapping" />}
            {state === "closed" && <span className="sch-shift-checkdot" aria-hidden="true"><Icon name="Check" size={10} /></span>}
          </span>
          <span className="sch-shift-time">{time}</span>
        </span>
      </button>
      {hover &&
      <CalendarShiftHover
        hover={hover}
        role={role}
        time={time}
        state={state}
        worker={worker}
        reqId={reqId}
        day={day} />

      }
    </React.Fragment>);

}

// Floating hover preview for calendar shift cards. Mirrors the timeline
// hover: measures itself on mount and clamps inside the viewport so the
// card always renders on the visible side of the screen, flipping above
// the bar when there's no room below.
function CalendarShiftHover({ hover, role, time, state, worker, reqId, day }) {
  const { centerX, belowY, aboveY } = hover;
  const sup = worker ? REQ_SUPPLIERS[worker.supplier] || null : null;
  const stateMeta = {
    floor: { label: "On the floor", tone: "active" },
    wrapping: { label: "Wrapping up", tone: "active" },
    soon: { label: "Starts soon", tone: "upcoming" },
    closed: { label: "Completed", tone: "past" },
    later: { label: "Scheduled", tone: "upcoming" }
  };
  const meta = stateMeta[state] || { label: "Scheduled", tone: "upcoming" };
  const dayLabel = (() => {
    if (!day) return null;
    const match = (typeof SCH_DAYS !== "undefined" ? SCH_DAYS : []).find((d) => d.key === day);
    return match ? `${match.label} ${match.date}` : null;
  })();

  const ref = useRefSc(null);
  const [pos, setPos] = useStateSc({ top: belowY, left: centerX, ready: false });
  React.useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const m = 12;

    let left = centerX - w / 2;
    if (left < m) left = m;
    if (left + w > vw - m) left = vw - m - w;

    let top = belowY;
    if (top + h > vh - m) {
      const flipped = aboveY - h;
      if (flipped >= m) {
        top = flipped;
      } else {
        top = Math.max(m, vh - m - h);
      }
    }
    setPos({ top, left, ready: true });
  }, [centerX, belowY, aboveY]);

  return (
    <div
      ref={ref}
      className="tc-tl-hover"
      style={{
        top: `${pos.top}px`,
        left: `${pos.left}px`,
        visibility: pos.ready ? "visible" : "hidden"
      }}
      role="tooltip">
      
      <div className="tc-tl-hover-head">
        <span className={`tc-tl-status tc-tl-status--${meta.tone}`}>{meta.label}</span>
        <span className="tc-tl-hover-time tabular">{time}</span>
      </div>
      <div className="tc-tl-hover-name">{worker ? worker.name : "Open position"}</div>
      <div className="tc-tl-hover-role">{role}</div>
      <ul className="tc-tl-hover-meta-list">
        {dayLabel &&
        <li>
            <Icon name="Calendar" size={12} />
            <span>{dayLabel}</span>
          </li>
        }
        {sup &&
        <li>
            <Icon name="Building" size={12} />
            <span>{sup.label || sup.name || worker.supplier}</span>
          </li>
        }
        {reqId &&
        <li>
            <Icon name="Briefcase" size={12} />
            <span className="tabular">{reqId}</span>
          </li>
        }
      </ul>
    </div>);

}

function OffPill() {
  return (
    <span className="sch-shift sch-shift--off">
      <span className="sch-shift-text">
        <span className="sch-shift-role sch-shift-off-label">Off</span>
      </span>
    </span>);

}

// One worker row in by-worker view. Renders day cells with shifts spanning
// multiple columns where applicable.
function SchWorkerRow({ row, onOpenBooking, onOpenShift, showOff = false, highlightDayIdx = null, todayIdx = null, showStates = false, days = SCH_DAYS }) {
  const worker = WORKERS.find((w) => w.id === row.worker) || WORKERS[0];
  // Supplier swatch on the worker chip — for Agency / EOR workers the
  // chip resolves to their supplier or EOR provider. For Contractor
  // (IC) workers there's no supplier, so we fall back to the pool's
  // own decorative palette so the swatch reads as "Contractor" rather
  // than the default StaffWise blue.
  const _supRaw = worker.supplier ? REQ_SUPPLIERS[worker.supplier] : null;
  const _poolMeta = (window.POOL_META && window.POOL_META[worker.pool]) || null;
  const sup = _supRaw || (worker.pool === "Contractor" && _poolMeta
    ? { label: "Direct", bg: _poolMeta.bg, fg: _poolMeta.fg }
    : REQ_SUPPLIERS.sw);
  // map day → shift starting that day
  const byStart = {};
  row.shifts.forEach((s) => {byStart[s.day] = s;});
  // mark which days are covered (so we don't render an empty cell on top of a span)
  const covered = new Set();
  row.shifts.forEach((s) => {
    const idx = days.findIndex((d) => d.key === s.day);
    for (let i = 1; i < (s.span || 1); i++) {
      covered.add(days[idx + i]?.key);
    }
  });

  return (
    <div className="sch-grid-row" role="row">
      <div className="sch-grid-cell sch-grid-cell--rowhead" role="rowheader">
        <button
          type="button"
          className="sch-worker sch-worker--btn"
          onClick={() => onOpenBooking && onOpenBooking(row)}
          title={`Open work assignment for ${worker.name}`}>
          
          <div className="sch-worker-avatar">
            <WorkerAvatar w={worker} size={24} />
            <span
              className="sch-worker-sup"
              style={{ background: sup.bg, color: sup.fg }}
              aria-hidden="true"
              title={sup.label} />
            
          </div>
          <div className="sch-worker-text">
            <span className="sch-worker-name">{worker.name.split(" ")[0]} {worker.name.split(" ")[1]?.[0]}.</span>
            <span className="sch-worker-hrs">
              <Icon name="Hourglass" size={12} />
              {row.hrs}
            </span>
          </div>
        </button>
      </div>
      {days.map((d, idx) => {
        const s = byStart[d.key];
        const isHighlight = highlightDayIdx != null && idx === highlightDayIdx;
        const isToday = todayIdx != null && idx === todayIdx;
        if (s) {
          const handleClick = () => {
            if (onOpenShift) {
              onOpenShift(row, idx, s);
            } else if (onOpenBooking) {
              onOpenBooking(row);
            }
          };
          // If states are enabled, ask the console helper for this
          // shift's state on the column being rendered.
          const cellState = showStates && typeof window.calendarShiftState === "function" ?
          window.calendarShiftState(s, days[idx].key) :
          null;
          return (
            <div
              key={d.key}
              className={`sch-grid-cell sch-grid-cell--span${isHighlight ? " sch-grid-cell--highlight" : ""}${isToday ? " sch-grid-cell--today" : ""}`}
              style={{ gridColumn: `span ${s.span || 1}` }}
              role="cell">
              
              <ShiftCard
                tone={s.tone}
                role={s.role}
                time={s.time}
                onClick={handleClick}
                state={cellState}
                worker={worker}
                reqId={row.reqId}
                day={d.key} />
              
            </div>);

        }
        if (covered.has(d.key)) return null;
        return (
          <div
            key={d.key}
            className={`sch-grid-cell${isHighlight ? " sch-grid-cell--highlight" : ""}${isToday ? " sch-grid-cell--today" : ""}`}
            role="cell">
            
            {showOff && <OffPill />}
          </div>);

      })}
    </div>);

}

// ---------- Group-by + location-filter helpers --------------------------
// The week-view grid groups its worker rows by the dimension selected in
// the rail's "By worker / By location / …" dropdown. Each grouping reads
// against either the row's worker, its parent requisition (location, job
// title), or the live shift state — the helpers below funnel all five
// dimensions into the same {key, label, sub, icon} shape so the renderer
// can stay dumb.

function _schLocationNamesFor(locFilter) {
  if (!locFilter || !locFilter.length) return null;
  const locs = typeof window !== "undefined" && window.LOCATIONS || [];
  const names = locFilter.
  map((id) => (locs.find((l) => l.id === id) || {}).name).
  filter(Boolean);
  return new Set(names);
}

// Filter SCH_WORKER_SCHED rows down to those whose parent requisition's
// location is in the selected set. When no locations are selected we
// pass the schedule through unchanged.
function _schFilterRowsByLocation(rows, locFilter) {
  const names = _schLocationNamesFor(locFilter);
  if (!names) return rows;
  const reqs = typeof REQUISITIONS !== "undefined" ? REQUISITIONS : [];
  return rows.filter((r) => {
    const req = reqs.find((x) => x.id === r.reqId);
    return req && names.has(req.location);
  });
}

// Bucket schedule rows by the active group-by dimension. Returns an
// ordered list of {key, icon, label, sub, rows} groups. The order is
// deliberately stable per-dimension so re-renders don't shuffle the grid.
function _schGroupRows(rows, groupBy) {
  const reqs = typeof REQUISITIONS !== "undefined" ? REQUISITIONS : [];
  const workersById = typeof WORKERS !== "undefined" ?
  Object.fromEntries(WORKERS.map((w) => [w.id, w])) : {};
  const reqsById = Object.fromEntries(reqs.map((r) => [r.id, r]));
  const suppliers = typeof REQ_SUPPLIERS !== "undefined" ? REQ_SUPPLIERS : {};

  const groups = new Map();
  const push = (key, meta, row) => {
    if (!groups.has(key)) groups.set(key, { key, ...meta, rows: [] });
    groups.get(key).rows.push(row);
  };

  // "worker" mode keeps the existing flat layout — no group headers,
  // just the worker rows. We still funnel it through this helper so
  // the renderer has one code path.
  if (groupBy === "worker") {
    return [{ key: "all", icon: null, label: null, sub: null, rows }];
  }

  rows.forEach((row) => {
    const req = reqsById[row.reqId];
    const worker = workersById[row.worker];
    if (groupBy === "booking") {
      const key = row.reqId || "—";
      const label = req && req.jobs && req.jobs[0] ? req.jobs[0] : `Work assignment ${key}`;
      const sub = `#${key}${req && req.location ? ` · ${req.location}` : ""}`;
      push(key, { icon: "Briefcase", label, sub }, row);
    } else if (groupBy === "location") {
      const name = req && req.location || "Unscoped";
      push(name, { icon: "Location", label: name, sub: null }, row);
    } else if (groupBy === "supplier") {
      const supId = worker && worker.supplier;
      const sup = supId && suppliers[supId];
      const label = sup && sup.label || (worker && worker.pool ? `${worker.pool} pool` : "Internal");
      push(supId || "internal", { icon: "Building", label, sub: null }, row);
    } else if (groupBy === "status") {
      // Use today's column state for each row's most-relevant shift so
      // status buckets read "what's happening right now". Falls back to
      // a "Scheduled" bucket for rows with no live state (other weeks).
      const todayKey = (() => {
        const idx = (SCH_TODAY_DATE.getDay() + 6) % 7;
        return _SCH_WEEK_KEYS[idx];
      })();
      let state = null;
      if (typeof window !== "undefined" && typeof window.calendarShiftState === "function") {
        for (const s of row.shifts) {
          state = window.calendarShiftState(s, todayKey);
          if (state) break;
        }
      }
      const STATE_BUCKET = {
        floor: { key: "floor", label: "On the floor", icon: "PersonClock" },
        wrapping: { key: "wrapping", label: "Wrapping up", icon: "Hourglass" },
        soon: { key: "soon", label: "Starting soon", icon: "TimeAdd" },
        later: { key: "later", label: "Scheduled later", icon: "Calendar" },
        closed: { key: "closed", label: "Completed", icon: "Check" }
      };
      const bucket = STATE_BUCKET[state] || { key: "scheduled", label: "Scheduled", icon: "Calendar" };
      push(bucket.key, { icon: bucket.icon, label: bucket.label, sub: null }, row);
    } else {
      // Unknown grouping — render flat.
      push("all", { icon: null, label: null, sub: null }, row);
    }
  });

  // Stable bucket ordering for status; alphabetical for the rest.
  const arr = Array.from(groups.values());
  if (groupBy === "status") {
    const ORDER = ["floor", "wrapping", "soon", "scheduled", "later", "closed"];
    arr.sort((a, b) => ORDER.indexOf(a.key) - ORDER.indexOf(b.key));
  } else {
    arr.sort((a, b) => (a.label || "").localeCompare(b.label || ""));
  }
  return arr;
}

const SCH_GROUPBY_FIRST_LABEL = {
  worker: "By worker",
  booking: "By work assignment",
  location: "By location",
  status: "By status",
  supplier: "By supplier"
};

function CalendarByWorker({ anchor, groupBy = "worker", locFilter, onOpenBooking, onOpenShift }) {
  const effectiveAnchor = anchor || SCH_TODAY_DATE;
  const weekOffset = useMemoSc(() => schWeekOffsetFor(effectiveAnchor), [effectiveAnchor]);
  const weekDays = useMemoSc(() => schWeekDaysFor(effectiveAnchor), [effectiveAnchor]);
  const schedule = useMemoSc(() => projectWeekSchedule(effectiveAnchor), [effectiveAnchor]);
  const filtered = useMemoSc(
    () => _schFilterRowsByLocation(schedule, locFilter),
    [schedule, locFilter]
  );
  const groups = useMemoSc(
    () => _schGroupRows(filtered, groupBy),
    [filtered, groupBy]
  );
  // "Now" / today highlight only when the displayed week IS the current
  // week — stepping forward/back hides it.
  const todayIdx = weekOffset === 0 && typeof window.todayColumnIdx === "function" ?
  window.todayColumnIdx() :
  null;
  const firstLabel = SCH_GROUPBY_FIRST_LABEL[groupBy] || "By worker";
  const hasSectionHeaders = groupBy !== "worker";
  const isEmpty = filtered.length === 0;
  // Clicking a worker's name opens their booking; clicking an individual
  // shift card deep-links to that shift's detail page.
  return (
    <div className="sch-grid-card">
      <div className="sch-grid sch-grid--with-today" role="table" aria-label={`Schedule ${firstLabel.toLowerCase()}`}>
        <SchGridHeader firstLabel={firstLabel} todayIdx={todayIdx} days={weekDays} />
        {isEmpty &&
        <div className="sch-grid-row" role="row">
            <div className="sch-grid-cell sch-grid-cell--rowhead" role="rowheader">
              <span className="sch-job-name">No matches</span>
            </div>
            {weekDays.map((d) =>
          <div key={d.key} className="sch-grid-cell" role="cell" />
          )}
          </div>
        }
        {groups.map((group) =>
        <React.Fragment key={group.key}>
            {hasSectionHeaders && group.label &&
          <div className="sch-grid-row sch-grid-row--section" role="row">
                <div className="sch-grid-cell sch-grid-section" role="rowheader" style={{ gridColumn: "1 / -1" }}>
                  {group.icon &&
              <span className="sch-grid-section-icon" aria-hidden="true">
                      <Icon name={group.icon} size={14} />
                    </span>
              }
                  <span className="sch-grid-section-label">{group.label}</span>
                  {group.sub &&
              <span className="sch-grid-section-sub">{group.sub}</span>
              }
                  <span className="sch-grid-section-count tabular" aria-label={`${group.rows.length} workers`}>
                    {group.rows.length}
                  </span>
                </div>
              </div>
          }
            {group.rows.map((r, i) =>
          <SchWorkerRow
            key={`${group.key}-${r.worker}-${i}-${weekOffset}`}
            row={r}
            todayIdx={todayIdx}
            days={weekDays}
            showStates={weekOffset === 0}
            onOpenBooking={(row) => onOpenBooking && onOpenBooking(buildBookingId({ reqId: row.reqId, workerId: row.worker }))}
            onOpenShift={(row, dayIdx) => {
              const shiftId = buildBookingId({ reqId: row.reqId, workerId: row.worker, weekDayIdx: dayIdx });
              if (onOpenShift) onOpenShift(shiftId);else
              if (onOpenBooking) onOpenBooking(shiftId);
            }} />

          )}
          </React.Fragment>
        )}
      </div>
    </div>);

}

function CalendarByJob() {
  return (
    <div className="sch-grid-card">
      <div className="sch-grid" role="table" aria-label="Schedule by job">
        <SchGridHeader firstLabel="By job" />
        {SCH_JOBS.map((j) =>
        <div key={j} className="sch-grid-row" role="row">
            <div className="sch-grid-cell sch-grid-cell--rowhead" role="rowheader">
              <span className="sch-job-name">{j}</span>
            </div>
            {SCH_DAYS.map((d) =>
          <div key={d.key} className="sch-grid-cell" role="cell" />
          )}
          </div>
        )}
      </div>
    </div>);

}

// =====================================================================
// Month view — full-month grid showing scheduled shifts per day
// =====================================================================

const SCH_MONTH_NAMES = [
"January", "February", "March", "April", "May", "June",
"July", "August", "September", "October", "November", "December"];

const SCH_DAY_HEADERS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function MonthPaddle() {
  // Default to the month that contains today.
  const _t = SCH_TODAY_DATE;
  const [m, setM] = useStateSc({ year: _t.getFullYear(), month: _t.getMonth() });
  const step = (dir) => {
    setM(({ year, month }) => {
      let next = month + dir;
      let y = year;
      if (next < 0) {next = 11;y -= 1;}
      if (next > 11) {next = 0;y += 1;}
      return { year: y, month: next };
    });
    showToast(dir < 0 ? "Showing previous month" : "Showing next month");
  };
  return (
    <React.Fragment>
      <button
        type="button"
        className="sch-paddle"
        aria-label="Previous month"
        onClick={() => step(-1)}>
        
        <Icon name="ChevronLeft" size={16} />
      </button>
      <span className="sch-month-label tabular">{SCH_MONTH_NAMES[m.month]} {m.year}</span>
      <button
        type="button"
        className="sch-paddle"
        aria-label="Next month"
        onClick={() => step(1)}>
        
        <Icon name="ChevronRight" size={16} />
      </button>
    </React.Fragment>);

}

function MonthView({ anchor, locFilter, groupBy = "worker", onOpenBooking }) {
  // Render the month that contains `anchor` — the schedule rail's prev/
  // next paddle moves the anchor, which moves the grid. Falls back to
  // today when no anchor is supplied.
  const effectiveAnchor = anchor || SCH_TODAY_DATE;
  const _today = SCH_TODAY_DATE;
  const year = effectiveAnchor.getFullYear();
  const month = effectiveAnchor.getMonth();
  // Today's date only highlights when we're looking at the month that
  // actually contains today.
  const isCurrentMonth = year === _today.getFullYear() && month === _today.getMonth();
  const todayDate = isCurrentMonth ? _today.getDate() : null;
  // The "demo week" (curated, no synthetic noise) is only meaningful for
  // the current month — it's the Mon–Sun window containing today. For
  // other months we let the synthetic generator fill the whole month.
  const _weekStart = isCurrentMonth ? _SCH_WEEK_START.getDate() : -1;
  const _weekEnd = isCurrentMonth ? _weekStart + 6 : -1;

  const firstWeekday = new Date(year, month, 1).getDay(); // Wed = 3
  const daysInMonth = new Date(year, month + 1, 0).getDate(); // 30
  const totalCells = Math.ceil((firstWeekday + daysInMonth) / 7) * 7;

  // Aggregate shifts by calendar date (expand each span). Track the
  // week-day index for each instance so the hover-popup rows can deep-link
  // straight to the shift detail page. Only the current month gets the
  // curated week — for other months we let the synthetic generator below
  // fill the whole grid so we don't double-stack rows on the same date.
  const shiftsByDate = {};
  if (isCurrentMonth) {
    SCH_WORKER_SCHED.forEach((row) => {
      row.shifts.forEach((s) => {
        const startIdx = SCH_DAYS.findIndex((d) => d.key === s.day);
        for (let i = 0; i < (s.span || 1); i++) {
          const dayIdx = startIdx + i;
          const day = SCH_DAYS[dayIdx];
          if (!day) continue;
          const date = day.date;
          if (!shiftsByDate[date]) shiftsByDate[date] = [];
          const worker = WORKERS.find((w) => w.id === row.worker);
          if (!worker) continue;
          shiftsByDate[date].push({
            worker, reqId: row.reqId, role: s.role, tone: s.tone, time: s.time,
            weekDayIdx: dayIdx, dayKey: day.key, dayLabel: day.label
          });
        }
      });
    });
  }

  // Synthesize additional bookings across the rest of April so the month
  // grid reads like a busy operating period rather than one focused week.
  // Deterministic per-date so the layout doesn't churn on re-renders, and
  // the weekDayIdx still resolves to a real day inside SCH_DAYS so the
  // hover-popup deep-links land on a sensible shift detail page.
  const TONE_CYCLE = ["teal", "yellow", "blue"];
  const ROLE_POOL = [
  "Production Associate", "Prep Cook", "Server", "Line Manager",
  "Bartender", "Warehouse Clerk", "Factory Line Assembler", "Host",
  "Picker", "Operator", "Inspector", "Line Cook"];

  const TIME_POOL = [
  "6:00 AM–2:00 PM", "7:00 AM–3:00 PM", "8:00 AM–4:00 PM",
  "9:00 AM–5:00 PM", "10:00 AM–6:00 PM", "11:00 AM–7:00 PM",
  "12:00 PM–8:00 PM", "2:00 PM–10:00 PM", "4:00 PM–12:00 AM",
  "6:00 AM–3:00 PM", "7:00 AM–3:30 PM"];

  // Reuse worker/reqId pairings already wired through SCH_WORKER_SCHED so
  // every generated booking can resolve to a real requisition.
  const WORKER_REQ_POOL = SCH_WORKER_SCHED.map((row) => ({
    worker: WORKERS.find((w) => w.id === row.worker),
    reqId: row.reqId
  })).filter((p) => p.worker);

  for (let date = 1; date <= daysInMonth; date++) {
    // The current week is the "real" demo week — keep the curated data and
    // don't pile on synthetic noise that would obscure it.
    if (date >= _weekStart && date <= _weekEnd) continue;
    const jsDate = new Date(year, month, date);
    const dow = jsDate.getDay(); // 0 = Sun … 6 = Sat
    // Lighter weekend coverage so the rhythm reads like a real operation.
    const isWeekend = dow === 0 || dow === 6;
    // Pseudo-random count seeded by date — deterministic but varied.
    const seed = (date * 9301 + 49297) % 233280;
    const base = isWeekend ? 2 : 5;
    const variance = isWeekend ? 2 : 4;
    const count = base + Math.floor(seed / 233280 * variance);
    // Map the calendar date's weekday onto SCH_DAYS (Mon=0…Sun=6) so the
    // deep-link still resolves to a real day inside the demo week.
    const weekDayIdx = dow === 0 ? 6 : dow - 1;
    const day = SCH_DAYS[weekDayIdx];
    if (!shiftsByDate[date]) shiftsByDate[date] = [];
    for (let i = 0; i < count; i++) {
      const wIdx = (date * 7 + i * 3) % WORKER_REQ_POOL.length;
      const rIdx = (date * 5 + i * 2) % ROLE_POOL.length;
      const tIdx = (date * 3 + i) % TIME_POOL.length;
      const toIdx = (date + i) % TONE_CYCLE.length;
      const pair = WORKER_REQ_POOL[wIdx];
      shiftsByDate[date].push({
        worker: pair.worker,
        reqId: pair.reqId,
        role: ROLE_POOL[rIdx],
        tone: TONE_CYCLE[toIdx],
        time: TIME_POOL[tIdx],
        weekDayIdx,
        dayKey: day ? day.key : null,
        dayLabel: day ? day.label : null
      });
    }
  }

  const cells = [];
  for (let i = 0; i < totalCells; i++) {
    const date = i - firstWeekday + 1;
    cells.push(date >= 1 && date <= daysInMonth ? date : null);
  }

  // Apply the rail's location filter to every aggregated day. Each
  // synthesized shift carries a reqId pointing back into REQUISITIONS, so
  // we resolve the location through there and drop any shift whose
  // requisition isn't at one of the selected locations.
  if (locFilter && locFilter.length) {
    const locs = typeof window !== "undefined" && window.LOCATIONS || [];
    const names = new Set(
      locFilter.map((id) => (locs.find((l) => l.id === id) || {}).name).filter(Boolean)
    );
    const reqs = typeof REQUISITIONS !== "undefined" ? REQUISITIONS : [];
    const reqLoc = (id) => {
      const r = reqs.find((x) => x.id === id);
      return r ? r.location : null;
    };
    Object.keys(shiftsByDate).forEach((d) => {
      shiftsByDate[d] = shiftsByDate[d].filter((s) => names.has(reqLoc(s.reqId)));
      if (shiftsByDate[d].length === 0) delete shiftsByDate[d];
    });
  }

  return (
    <div className="sch-month-card">
      <div className="sch-month-head" role="row">
        {SCH_DAY_HEADERS.map((d) =>
        <div key={d} className="sch-month-head-cell" role="columnheader">{d}</div>
        )}
      </div>
      <div className="sch-month-grid" role="grid">
        {cells.map((date, i) => {
          if (date == null) {
            return <div key={i} className="sch-month-cell sch-month-cell--blank" role="gridcell" aria-hidden="true" />;
          }
          const shifts = shiftsByDate[date] || [];
          const isToday = date === todayDate;
          return (
            <MonthDayCell
              key={i}
              date={date}
              year={year}
              month={month}
              shifts={shifts}
              isToday={isToday}
              groupBy={groupBy}
              onOpenBooking={onOpenBooking} />);


        })}
      </div>
    </div>);

}

// One month-view day cell. Replaces the previous "show first 3 shifts +N
// more" treatment with a single rollup chip per cell (count + tone-bar
// distribution). Hovering the cell reveals a popup listing every shift on
// that day, each row a deep-link into the shift detail page.
function MonthDayCell({ date, year, month, shifts, isToday, groupBy = "worker", onOpenBooking }) {
  const [hover, setHover] = useStateSc(null);
  const cellRef = useRefSc(null);
  const open = () => {
    const el = cellRef.current;
    if (!el || shifts.length === 0) return;
    const r = el.getBoundingClientRect();
    setHover({
      centerX: r.left + r.width / 2,
      belowY: r.bottom + 8,
      aboveY: r.top - 8
    });
  };
  const close = () => setHover(null);

  // Tone distribution — collapse identical tones into one segment, ordered
  // by frequency so the dominant supplier reads first.
  const toneCounts = shifts.reduce((acc, s) => {
    acc[s.tone] = (acc[s.tone] || 0) + 1;
    return acc;
  }, {});
  const toneSegments = Object.entries(toneCounts).
  sort((a, b) => b[1] - a[1]).
  map(([tone, count]) => ({ tone, count }));

  return (
    <div
      ref={cellRef}
      className={`sch-month-cell${isToday ? " sch-month-cell--today" : ""}${shifts.length > 0 ? " sch-month-cell--has-shifts" : ""}`}
      role="gridcell"
      onMouseEnter={open}
      onMouseLeave={close}>
      
      <div className="sch-month-cell-head">
        <span className={`sch-month-date tabular${isToday ? " sch-month-date--today" : ""}`}>{date}</span>
        {shifts.length > 0 &&
        <span className="sch-month-count tabular" aria-label={`${shifts.length} shifts`}>
            {shifts.length}
          </span>
        }
      </div>
      {shifts.length > 0 &&
      <div className="sch-month-rollup" aria-hidden="true">
          <div className="sch-month-rollup-bars">
            {toneSegments.map(({ tone, count }) =>
          <span
            key={tone}
            className={`sch-month-rollup-bar sch-month-rollup-bar--${tone}`}
            style={{ flexGrow: count }} />

          )}
          </div>
          <div className="sch-month-rollup-label">
            <span className="tabular">{shifts.length}</span>
            <span> shift{shifts.length === 1 ? "" : "s"} scheduled</span>
          </div>
        </div>
      }
      {hover &&
      <MonthDayHover
        hover={hover}
        date={date}
        year={year}
        month={month}
        shifts={shifts}
        groupBy={groupBy}
        onOpenBooking={onOpenBooking} />

      }
    </div>);

}

// Hover popup for the month-view day cell. Lists every shift on the day
// as a clickable row. Uses the same viewport-clamping logic as the rest
// of the schedule hover cards — measures itself on mount and flips above
// the cell when there's no room below.
function MonthDayHover({ hover, date, year, month, shifts, groupBy = "worker", onOpenBooking }) {
  const { centerX, belowY, aboveY } = hover;
  const ref = useRefSc(null);
  const [pos, setPos] = useStateSc({ top: belowY, left: centerX, ready: false });
  React.useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const m = 12;

    let left = centerX - w / 2;
    if (left < m) left = m;
    if (left + w > vw - m) left = vw - m - w;

    let top = belowY;
    if (top + h > vh - m) {
      const flipped = aboveY - h;
      if (flipped >= m) {
        top = flipped;
      } else {
        top = Math.max(m, vh - m - h);
      }
    }
    setPos({ top, left, ready: true });
  }, [centerX, belowY, aboveY]);

  const headerLabel = (() => {
    // Build the date in the displayed month so weekday + month match
    // wherever the user has navigated to (not stuck on today's month).
    const y = year != null ? year : SCH_TODAY_DATE.getFullYear();
    const m = month != null ? month : SCH_TODAY_DATE.getMonth();
    const d = new Date(y, m, date);
    return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  })();

  const openShift = (s) => {
    if (!onOpenBooking) return;
    onOpenBooking(buildBookingId({
      reqId: s.reqId,
      workerId: s.worker.id,
      weekDayIdx: s.weekDayIdx
    }));
  };

  return (
    <div
      ref={ref}
      className="sch-month-hover"
      style={{
        top: `${pos.top}px`,
        left: `${pos.left}px`,
        visibility: pos.ready ? "visible" : "hidden"
      }}
      role="tooltip">
      
      <div className="sch-month-hover-head">
        <span className="sch-month-hover-date">{headerLabel}</span>
        <span className="sch-month-hover-count tabular">
          {shifts.length} shift{shifts.length === 1 ? "" : "s"}
        </span>
      </div>
      <MonthHoverList shifts={shifts} groupBy={groupBy} openShift={openShift} />
    </div>);

}

// Bucket shifts in the month-cell hover popup by the rail's group-by.
// Falls back to a flat list when groupBy is "worker" (each row is
// already worker-scoped) so the popup keeps its tight one-line read
// for the common case.
function MonthHoverList({ shifts, groupBy, openShift }) {
  const groups = React.useMemo(() => {
    if (!shifts || shifts.length === 0) return [];
    if (groupBy === "worker" || !groupBy) {
      return [{ key: "__flat", label: null, rows: shifts }];
    }
    const reqs = (typeof REQUISITIONS !== "undefined" && REQUISITIONS) || [];
    const reqsById = Object.fromEntries(reqs.map((r) => [r.id, r]));
    const suppliers = (typeof REQ_SUPPLIERS !== "undefined" && REQ_SUPPLIERS) || {};
    const labelOf = (s) => {
      if (groupBy === "booking")  { const r = reqsById[s.reqId]; const job = r && r.jobs && r.jobs[0]; return job ? `${job} · #${s.reqId}` : `Work assignment #${s.reqId || "—"}`; }
      if (groupBy === "location") { const r = reqsById[s.reqId]; return (r && r.location) || "Unscoped"; }
      if (groupBy === "supplier") { const supId = s.worker && s.worker.supplier; const sup = supId && suppliers[supId]; return (sup && sup.label) || (s.worker && s.worker.pool ? `${s.worker.pool} pool` : "Internal"); }
      if (groupBy === "status")   { return ({ success: "Active", informative: "Scheduled", warning: "At risk", error: "Open", default: "Other" })[s.tone] || "Other"; }
      return s.worker ? s.worker.name : "Worker";
    };
    const map = new Map();
    shifts.forEach((s) => {
      const label = labelOf(s);
      if (!map.has(label)) map.set(label, []);
      map.get(label).push(s);
    });
    return Array.from(map.entries()).map(([label, rows]) => ({ key: label, label, rows }));
  }, [shifts, groupBy]);

  return (
    <ul className="sch-month-hover-list">
      {groups.map((g) => (
        <React.Fragment key={g.key}>
          {g.label && (
            <li className="sch-month-hover-group" role="presentation">
              <span className="sch-month-hover-group-label">{g.label}</span>
              <span className="sch-month-hover-group-count tabular">{g.rows.length}</span>
            </li>
          )}
          {g.rows.map((s, j) => (
            <li key={`${g.key}-${j}`}>
              <button
                type="button"
                className="sch-month-hover-row"
                onClick={() => openShift(s)}>
                <span className={`sch-month-hover-bar sch-month-hover-bar--${s.tone}`} aria-hidden="true" />
                <span className="sch-month-hover-row-text">
                  <span className="sch-month-hover-row-name">{s.worker.name}</span>
                  <span className="sch-month-hover-row-meta">
                    <span>{s.role}</span>
                    <span aria-hidden="true">·</span>
                    <span className="tabular">{s.time}</span>
                  </span>
                </span>
                <span className="sch-month-hover-row-chev" aria-hidden="true">
                  <Icon name="ChevronRight" size={14} />
                </span>
              </button>
            </li>
          ))}
        </React.Fragment>
      ))}
    </ul>
  );
}

// =====================================================================
// List view — Schedule list of bookings
// =====================================================================

function ScheduleList({ onOpenRow, locationIds, initialFilter }) {
  const [page, setPage] = useStateSc(1);
  const [pageSize, setPageSize] = useStateSc(SCH_PAGE_SIZE);
  const f = useFilters({ status: [], job: [], worker: [], location: [], fulfillment: [] });
  const [sortBy, setSortBy] = useStateSc("id");
  // Apply location scope (Manager view) as a hard pre-filter.
  const scopedAll = useMemoSc(() => {
    const all = SCH_BOOKINGS;
    if (!locationIds || locationIds.length === 0) return all;
    const locs = window.LOCATIONS || [];
    const names = new Set(
      locationIds.map((id) => (locs.find((l) => l.id === id) || {}).name).filter(Boolean)
    );
    return all.filter((b) => names.has(b.location));
  }, [locationIds]);

  // Apply user-driven filters & sort.
  const filtered = useMemoSc(() => {
    let out = scopedAll.slice();
    if (f.filters.status.length) out = out.filter((b) => f.filters.status.includes(b.status));
    if (f.filters.job.length) out = out.filter((b) => b.jobs.some((j) => f.filters.job.includes(j)));
    if (f.filters.location.length) out = out.filter((b) => f.filters.location.includes(b.location));
    if (f.filters.fulfillment.length && window.matchFulfillment) {
      out = out.filter((b) => window.matchFulfillment(b, f.filters.fulfillment));
    }
    if (sortBy === "location") out.sort((a, b) => a.location.localeCompare(b.location));else
    if (sortBy === "status") out.sort((a, b) => a.status.localeCompare(b.status));
    return out;
  }, [scopedAll, f.filters, sortBy]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const rows = useMemoSc(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize]);

  const [selected, setSelected] = useStateSc(() => new Set());
  const allChecked = rows.length > 0 && rows.every((r) => selected.has(r.id));
  const toggle = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);else next.add(id);
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

  // -- Bulk actions unique to Schedule list ----------------------------
  // Schedule list rows are bookings already on the calendar. Useful
  // bulk moves: send a reminder blast to assigned workers, re-broadcast
  // unfilled positions, reassign supplier, or cancel a sweep of shifts.
  const bulkActSc = (msg, kind = "success") => {
    if (window.showToast) window.showToast(msg, { kind });
    setSelected(new Set());
  };
  const nSc = selected.size;
  const sumSc = `${nSc} ${nSc === 1 ? "work assignment" : "work assignments"}`;
  const bulkActionsSc = [
  { icon: "Bell", label: "Notify workers", onClick: () => bulkActSc(`Reminder sent to workers on ${sumSc}`) },
  { icon: "Broadcast", label: "Re-broadcast", onClick: () => bulkActSc(`${sumSc} re-broadcast to suppliers`) },
  { icon: "PersonArrow", label: "Reassign supplier", onClick: () => bulkActSc(`Supplier reassignment opened for ${sumSc}`, "info") },
  { icon: "TimeAdd", label: "Extend", onClick: () => bulkActSc(`Extend dialog opened for ${sumSc}`, "info") },
  { icon: "FileDownload", label: "Export", onClick: () => bulkActSc(`Exported ${sumSc} to CSV`) },
  { divider: true },
  { icon: "Cancel", label: "Cancel shifts", onClick: () => bulkActSc(`Cancelled ${sumSc}`, "warning"), kind: "danger" }];

  const bulkOverflowSc = [
  { icon: "Print", label: "Print roster sheet", onClick: () => bulkActSc(`Printing roster for ${sumSc}`) },
  { icon: "Notes", label: "Add briefing note", onClick: () => bulkActSc(`Briefing note added to ${sumSc}`) },
  { icon: "TimeUndo", label: "Reschedule", onClick: () => bulkActSc(`Reschedule wizard opened for ${sumSc}`, "info") }];


  const openSortMenu = (e) => openMenu(e.currentTarget, [
  { icon: sortBy === "id" ? "Check" : "Hashtag", label: "Sort: ID", onClick: () => setSortBy("id") },
  { icon: sortBy === "status" ? "Check" : "Adjustment", label: "Sort: Status", onClick: () => setSortBy("status") },
  { icon: sortBy === "location" ? "Check" : "Location", label: "Sort: Site", onClick: () => setSortBy("location") }]
  );

  // ---- View customizer ------------------------------------------------
  const schVcManifest = React.useMemo(() => ({
    columns: [
      { id: "id",       label: "ID",              width: "160px" },
      { id: "status",   label: "Status",          width: "130px" },
      { id: "dates",    label: "Dates",           width: "minmax(220px, 1fr)" },
      { id: "jobs",     label: "Job assignments", width: "minmax(280px, 1.4fr)" },
      { id: "location", label: "Site",        width: "minmax(220px, 1.2fr)" },
    ],
    filters: [
      { id: "status",   label: "Status" },
      { id: "job",      label: "Job" },
      { id: "location", label: "Site" },
      { id: "worker",   label: "Worker" },
    ],
  }), []);
  const vc = useViewCustomizer("schedule-list", schVcManifest);
  const schGridStyle = vc.gridStyle
    ? { gridTemplateColumns: `44px ${vc.gridStyle.gridTemplateColumns} 32px` }
    : undefined;

  return (
    <React.Fragment>
    <div className="req-table-card sch-list-card">
      <div className="req-filters">
        <div className="req-filters-left">
          {vc.showFilter("status")   && <FilterChip label="Status" active={f.filters.status.length > 0} count={f.filters.status.length} onClick={f.openFor("status", "Status", ["Booked", "In progress", "Completed"])} />}
          {vc.showFilter("job")      && <FilterChip label="Job" active={f.filters.job.length > 0} count={f.filters.job.length} onClick={f.openFor("job", "Job", Array.from(new Set(scopedAll.flatMap((b) => b.jobs))).sort())} />}
          {vc.showFilter("location") && <FilterChip label="Site" active={f.filters.location.length > 0} count={f.filters.location.length} onClick={f.openFor("location", "Location", Array.from(new Set(scopedAll.map((b) => b.location))).sort())} />}
          <FilterChip
            label="Fulfillment"
            active={f.filters.fulfillment.length > 0}
            count={f.filters.fulfillment.length}
            onClick={f.openFor("fulfillment", "Fulfillment", window.FULFILLMENT_BUCKETS || [])}
          />
          {vc.showFilter("worker")   && <FilterChip label="Worker" active={f.filters.worker.length > 0} count={f.filters.worker.length} onClick={f.openFor("worker", "Worker", WORKERS.map((w) => w.name).sort())} />}
          <button type="button" className="sch-chip" onClick={openSortMenu}>
            <span className="sch-chip-funnel" aria-hidden="true">
              <Icon name="ArrowsUpDownSmall" size={14} />
            </span>
            <span>Sort: {sortBy[0].toUpperCase() + sortBy.slice(1)}</span>
          </button>
        </div>
        <div className="req-filters-right">
          {f.hasAny &&
            <React.Fragment>
              <span className="req-filters-sep" aria-hidden="true">|</span>
              <button type="button" className="req-clear" onClick={f.clearAll}>Clear all filters</button>
            </React.Fragment>
            }
        </div>
      </div>

      <div className="req-scroll">
        <div className="req-row sch-list-row req-row--header" role="row" style={schGridStyle}>
          <div className="req-cell req-cell--check" role="columnheader">
            <input
                type="checkbox"
                checked={allChecked}
                onChange={toggleAll}
                aria-label="Select all rows on this page" />
              
          </div>
          {vc.showCol("id") && (
            <div className="req-cell sch-list-cell--id" role="columnheader">
              <span>ID</span>
              <span className="req-sort" aria-hidden="true"><Icon name="ArrowsUpDownSmall" size={14} /></span>
            </div>
          )}
          {vc.showCol("status") && <div className="req-cell" role="columnheader"><span>Status</span></div>}
          {vc.showCol("dates") && (
            <div className="req-cell sch-list-cell--dates" role="columnheader">
              <span>Dates</span>
              <span className="req-sort" aria-hidden="true"><Icon name="ArrowsUpDownSmall" size={14} /></span>
            </div>
          )}
          {vc.showCol("jobs")     && <div className="req-cell sch-list-cell--jobs" role="columnheader"><span>Job assignments</span></div>}
          {vc.showCol("location") && <div className="req-cell sch-list-cell--loc" role="columnheader"><span>Site</span></div>}
          <div className="req-cell sch-list-cell--chev" role="columnheader" aria-label=""></div>
        </div>

        <div className="req-body" role="rowgroup">
          {rows.map((row) =>
            <div
              key={row.id}
              className="req-row sch-list-row req-row--clickable"
              role="row"
              tabIndex={0}
              style={schGridStyle}
              onClick={(e) => {
                if (e.target.closest("input,a,button")) return;
                onOpenRow && onOpenRow(row.id);
              }}
              onKeyDown={(e) => {if (e.key === "Enter") onOpenRow && onOpenRow(row.id);}}>
              
              <div className="req-cell req-cell--check" role="cell">
                <input
                  type="checkbox"
                  checked={selected.has(row.id)}
                  onChange={() => toggle(row.id)}
                  aria-label={`Select ${row.id}`} />
                
              </div>
              {vc.showCol("id") && (
                <div className="req-cell sch-list-cell--id" role="cell">
                  <span className="sch-list-id">{row.id}</span>
                </div>
              )}
              {vc.showCol("status") && (
                <div className="req-cell" role="cell">
                  <SchStatusPill status={row.status} />
                </div>
              )}
              {vc.showCol("dates") && (
                <div className="req-cell sch-list-cell--dates" role="cell">
                  <span className="sch-list-text">{row.dates}</span>
                </div>
              )}
              {vc.showCol("jobs") && (
                <div className="req-cell sch-list-cell--jobs" role="cell">
                  {row.jobs.map((j, i) =>
                  <span key={i} className="req-chip">{j}</span>
                  )}
                  {row.more > 0 && <span className="req-chip req-chip--soft">{row.more} more</span>}
                </div>
              )}
              {vc.showCol("location") && (
                <div className="req-cell sch-list-cell--loc" role="cell">
                  <span className="sch-list-text">{row.location}</span>
                </div>
              )}
              <div className="req-cell sch-list-cell--chev" role="cell">
                <Icon name="ChevronRight" size={18} />
              </div>
            </div>
            )}
        </div>
      </div>

      <Pagination
          page={page}
          totalPages={totalPages}
          total={SCH_BOOKINGS.length}
          pageSize={pageSize}
          onPageSizeChange={(n) => {setPageSize(n);setPage(1);}}
          onChange={setPage} />
        
    </div>

    <BulkActionBar
        count={selected.size}
        noun="work assignment"
        onClear={() => setSelected(new Set())}
        actions={bulkActionsSc}
        overflow={bulkOverflowSc} />
    {vc.panel}
    </React.Fragment>);

}

// =====================================================================
// Schedule root
// =====================================================================

function SchedulePage({ reloadKey, onReload, onOpenBooking, onOpenShift, initialDayKey }) {
  // Presentation mode for the schedule body —
  //   "calendar" → the visual day / week / month grids we've always shipped
  //   "list"     → an Everest data-table of every shift in the visible
  //                window, with status, clock-in / clock-out, and a
  //                per-row 3-dot menu of override actions (Add time,
  //                Mark no-show, Report worker, Message worker, …).
  // The same view (Day / Week / Month) and the same site + grouping
  // filters drive both modes — the list view is purely an alternate
  // presentation, not a separate dataset.
  const [mode, setMode] = useStateSc("calendar");
  // "today" | "week" | "month"
  // When the home calendar deep-links into a specific day, force the Today
  // view so the day banner + plan render straight away.
  const [view, setView] = useStateSc("today");
  // Grouping dimension for the week-view grid + which side of the schedule
  // gets filtered by location. Lifted from SchRail so the calendar
  // components see the same values and react to them. Default to
  // "booking" when the user is in List mode — that's the most useful
  // bucketing for an actionable today-shifts list. Calendar mode keeps
  // its "worker" default below.
  const [groupBy, setGroupBy] = useStateSc("worker");
  const [locFilter, setLocFilter] = useStateSc([]);
  // The anchor date drives WHICH window of data the calendar shows. We
  // own it here (rather than inside SchRail) so the stepper actually
  // changes what's rendered — Day view re-derives a day's plan, Week
  // view re-projects the week grid, Month view jumps the month.
  const [anchor, setAnchor] = useStateSc(() => {
    // The home calendar deep-links a day in one of two formats:
    //   · `apr-23`         — month-abbr + zero-padded day; appears for days
    //                        inside the curated DAY_FULFILLMENT window.
    //   · `2026-05-23`     — full ISO-style key; the fallback the dashboard
    //                        emits for days outside the curated window so
    //                        every cell remains clickable.
    // Either form must resolve to a real Date so the day banner + plan
    // render the day the user actually clicked.
    if (initialDayKey) {
      const monthAbbrs = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
      // Try the ISO-style key first — it carries the year explicitly.
      const isoMatch = initialDayKey.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
      if (isoMatch) {
        const [, y, m, d] = isoMatch;
        return new Date(parseInt(y, 10), parseInt(m, 10) - 1, parseInt(d, 10));
      }
      // Otherwise look for the curated key shape. Anchor the year on today.
      const moMatch = initialDayKey.match(/^([a-z]{3})-(\d{1,2})$/i);
      if (moMatch) {
        const moIdx = monthAbbrs.indexOf(moMatch[1].toLowerCase());
        const day = parseInt(moMatch[2], 10);
        if (moIdx >= 0 && Number.isFinite(day)) {
          return new Date(SCH_TODAY_DATE.getFullYear(), moIdx, day);
        }
      }
    }
    return new Date(SCH_TODAY_DATE);
  });
  React.useEffect(() => {
    if (initialDayKey) setView("today");
  }, [initialDayKey]);

  let leftChips = null;

  return (
    <React.Fragment>
      <Omnibar
        icon="Calendar"
        title="Schedule"
        dayforce={{
          primitive: "WorkAssignment",
          subtitle: "isPrimary = false · effective-dated",
          product: "Position Management",
          strategy: "Rebuild",
          note: "Each confirmed booking writes a standard Dayforce WorkAssignment (employeeId + jobAssignmentId + orgUnitId + effective dates). Cancellation end-dates the row; never deletes — preserving effective-dated history.",
          anchor: "position"
        }}>
        
        <button
          type="button"
          className="iconbtn"
          onClick={onReload}
          aria-label="Reload content"
          title="Reload">
          
          <Icon name="Refresh" size={18} />
        </button>
        <button
          type="button"
          className="iconbtn"
          aria-label="More actions"
          title="More"
          onClick={(e) => openMenu(e.currentTarget, toolbarMenuItems())}>
          
          <Icon name="MoreVert" size={20} />
        </button>
      </Omnibar>

      <div className="content-section sch-content" key={reloadKey}>
        <SchRail
          mode={mode}
          onModeChange={setMode}
          view={view}
          onViewChange={setView}
          anchor={anchor}
          onAnchorChange={setAnchor}
          groupBy={groupBy}
          onGroupByChange={setGroupBy}
          locFilter={locFilter}
          onLocFilterChange={setLocFilter}
          leftChips={leftChips} />
        

        {mode === "list" && window.ScheduleListView &&
        <window.ScheduleListView
          view={view}
          anchor={anchor}
          locFilter={locFilter}
          groupBy={groupBy}
          onOpenBooking={(id) => onOpenBooking && onOpenBooking(id)}
          onOpenShift={(id) => onOpenShift && onOpenShift(id)} />

        }

        {mode === "calendar" && view === "today" &&
        <TodayConsole
          anchor={anchor}
          locFilter={locFilter}
          groupBy={groupBy}
          onOpenBooking={(id) => onOpenBooking && onOpenBooking(id)}
          onOpenShift={(id) => onOpenShift && onOpenShift(id)}
          initialDayKey={initialDayKey} />

        }
        {mode === "calendar" && view === "week" &&
        <CalendarByWorker
          anchor={anchor}
          groupBy={groupBy}
          locFilter={locFilter}
          onOpenBooking={(id) => onOpenBooking && onOpenBooking(id)}
          onOpenShift={(id) => onOpenShift && onOpenShift(id)} />

        }
        {mode === "calendar" && view === "month" &&
        <MonthView
          anchor={anchor}
          locFilter={locFilter}
          groupBy={groupBy}
          onOpenBooking={(id) => onOpenBooking && onOpenBooking(id)} />

        }
      </div>
    </React.Fragment>);

}

// =====================================================================
// Work assignment details — scope-aware
//
// One page handles three scopes (driven by the bookingId):
//   • Full     — multi-worker × multi-day. The whole booking.
//   • Worker   — one worker, multiple days. Their week of shifts.
//   • Date     — multiple workers, one day. The roster for that date.
//
// In every scope, individual shift rows / cells are clickable and open
// the ShiftDetailsPage below.
// =====================================================================

// Deterministic per-row status / time variants. Keyed by 1-based index so
// rosters stay stable across renders regardless of which workers fill them.
const BK_ROSTER_VARIANTS = [
{ status: "Working", start: "5:58 AM", end: "—" },
{ status: "En Route", start: "—", end: "—" },
{ status: "Working", start: "6:02 AM", end: "—" },
{ status: "Working", start: "5:55 AM", end: "—" },
{ status: "En Route", start: "—", end: "—" },
{ status: "Working", start: "6:00 AM", end: "—" },
{ status: "Completed", start: "5:58 AM", end: "3:02 PM" },
{ status: "Working", start: "6:05 AM", end: "—" }];


// Build the roster for a booking by walking each role on the requisition
// and picking `qty` workers per role. Mirrors the logic used by
// BookingPositionsSection so the two sections stay 1:1 with the requisition.
//
// For "Booked" assignments, all positions are intentionally UNFILLED — the
// requisition has been broadcast to the tiered suppliers but no worker has
// been assigned yet. Each unfilled position is owned by one of the tiered
// suppliers (round-robin) so the right supplier sees "their" pending slot
// and can fill it. The `assignments` map (idx → workerId) overlays manual
// assignments that have been made in the current session.
function buildBookingRoster(req, bk, assignments) {
  if (!req) return [];
  const status = bk && bk.status || req.status;
  const isBooked = status === "Booked";
  const suppliers = req.suppliers && req.suppliers.length ? req.suppliers : ["sw"];
  const used = new Set();
  const rows = [];
  let n = 1;
  (req.jobs || []).forEach((role) => {
    const candidates = WORKERS.filter((w) => (w.jobs || []).includes(role));
    const pool = [...candidates, ...WORKERS.filter((w) => !candidates.includes(w))];
    const qty = req.qty || 1;
    for (let k = 0; k < qty; k++) {
      const supId = suppliers[(n - 1) % suppliers.length];
      const v = BK_ROSTER_VARIANTS[(n - 1) % BK_ROSTER_VARIANTS.length];
      const assignedId = assignments && assignments[n];
      let workerId = null;
      let unfilled = false;
      let status = v.status;
      let start = v.start;
      let end = v.end;
      if (isBooked) {
        if (assignedId) {
          workerId = assignedId;
          // Freshly-assigned slot — supplier confirmed but shift hasn't
          // started yet. Show as "Confirmed" with no clock-in time.
          status = "Confirmed";
          start = "—";
          end = "—";
        } else {
          unfilled = true;
          status = "Unfilled";
          start = "—";
          end = "—";
        }
      } else {
        let pick = pool.find((w) => !used.has(w.id));
        if (!pick) pick = pool[k % pool.length];
        used.add(pick.id);
        workerId = pick.id;
      }
      if (workerId) used.add(workerId);
      rows.push({
        i: n,
        worker: workerId,
        role,
        unfilled,
        supplierId: supId,
        status,
        start,
        end
      });
      n++;
    }
  });
  return rows;
}

const BK_ROSTER_HUES = {
  "Working": "default",
  "En Route": "informative",
  "Off": "default",
  "Completed": "success",
  "Confirmed": "informative",
  "Unfilled": "warning"
};

// ---------- Pending-bookings store --------------------------------------
// For "Booked" requisitions, positions are unfilled by default. When a
// supplier assigns a worker the slot fills in. We persist the
// (bookingId → { positionIdx: workerId }) map at module scope so the
// assignment survives navigating into a worker subpage and back out, even
// though the React component remounts on each scope change.
const BK_BOOKING_ASSIGNMENTS = new Map();
function getBookingAssignments(bkId) {
  if (!BK_BOOKING_ASSIGNMENTS.has(bkId)) BK_BOOKING_ASSIGNMENTS.set(bkId, {});
  return BK_BOOKING_ASSIGNMENTS.get(bkId);
}
function setBookingAssignment(bkId, idx, workerId) {
  const m = getBookingAssignments(bkId);
  if (workerId == null) delete m[idx];else m[idx] = workerId;
}

// Open a worker picker menu for an unfilled position. The menu is filtered
// to the supplier that owns this slot — that's the tenant whose dispatch
// queue this booking sits in.
function openAssignWorkerMenu(anchor, { supplierId, role, onAssign }) {
  const sup = REQ_SUPPLIERS[supplierId] || REQ_SUPPLIERS.sw;
  const all = window.WORKERS || [];
  // Tier 1 — workers from this supplier who list the role
  const tier1 = all.filter((w) => w.supplier === supplierId && (w.jobs || []).includes(role));
  // Tier 2 — other workers from this supplier
  const tier2 = all.filter((w) => w.supplier === supplierId && !tier1.includes(w));
  const picks = [...tier1, ...tier2].slice(0, 8);
  const items = [{ header: `Assign worker from ${sup.label}` }];
  if (picks.length === 0) {
    items.push({ icon: "Information", label: "No workers available", onClick: () => {} });
  } else {
    picks.forEach((w) => {
      const isQualified = (w.jobs || []).includes(role);
      items.push({
        icon: isQualified ? "PersonCheck" : "Person",
        label: w.name,
        onClick: () => onAssign && onAssign(w)
      });
    });
  }
  items.push({ divider: true });
  items.push({
    icon: "PersonPlus",
    label: "Submit new candidate…",
    onClick: () => showToast("Opening candidate submission")
  });
  openMenu(anchor, items);
}

// Stable per-day status pattern for a single worker's week of shifts.
const BK_SHIFT_DAY_STATUSES = ["Completed", "Completed", "Working", "Scheduled", "Scheduled"];
const BK_SHIFT_DAY_TIMES = [
{ start: "5:58 AM", end: "3:03 PM" },
{ start: "5:55 AM", end: "3:01 PM" },
{ start: "5:58 AM", end: "—" },
{ start: "—", end: "—" },
{ start: "—", end: "—" }];


// Resolve a booking ID into a scope object — null reqId falls back to the
// first row so the page always renders something coherent.
function resolveBookingScope(bookingId) {
  const parsed = parseBookingId(bookingId);
  const bk = SCH_BOOKINGS.find((b) => b.id === parsed.reqId) || SCH_BOOKINGS[0];
  const req = REQUISITIONS.find((r) => r.id === bk.id) || REQUISITIONS[0];
  // Pick the date label:
  //   - reqDateIdx → from the requisition's own dates list
  //   - weekDayIdx → from the visible week (Mon–Sun containing today)
  //   - neither   → first chip on the requisition
  let dayChip = null;
  if (parsed.reqDateIdx != null && req.dates[parsed.reqDateIdx]) {
    dayChip = req.dates[parsed.reqDateIdx];
  } else if (parsed.weekDayIdx != null) {
    const d = SCH_DAYS[parsed.weekDayIdx];
    if (d) {
      const mo = new Date(d.year || SCH_TODAY_DATE.getFullYear(), d.month != null ? d.month : SCH_TODAY_DATE.getMonth(), 1).
      toLocaleDateString("en-US", { month: "short" });
      dayChip = `${d.label}, ${mo} ${d.date}`;
    }
  } else if (req.dates && req.dates.length) {
    dayChip = req.dates[0];
  }
  // Find the most relevant calendar row. We prefer one that matches BOTH
  // the worker and the req, then either, then fall back to the first row.
  // This keeps mock shifts data sensible when a worker is opened against
  // any requisition, not just the one wired into SCH_WORKER_SCHED.
  const calendarRow =
  parsed.workerId && SCH_WORKER_SCHED.find((r) => r.worker === parsed.workerId && r.reqId === parsed.reqId) ||
  parsed.workerId && SCH_WORKER_SCHED.find((r) => r.worker === parsed.workerId) ||
  SCH_WORKER_SCHED.find((r) => r.reqId === parsed.reqId) ||
  SCH_WORKER_SCHED[0];
  let worker = null;
  if (parsed.workerId) {
    worker = WORKERS.find((w) => w.id === parsed.workerId) || null;
  }
  // Day index for column highlighting in the schedule grid — only valid when
  // it actually points into SCH_DAYS. reqDateIdx points into req.dates and
  // shouldn't drive grid highlighting.
  const gridHighlightIdx = parsed.weekDayIdx;
  let scope = "full";
  const hasDay = parsed.weekDayIdx != null || parsed.reqDateIdx != null;
  if (parsed.workerId && hasDay) scope = "shift";else
  if (parsed.workerId) scope = "worker";else
  if (hasDay) scope = "date";
  return { parsed, bk, req, scope, worker, calendarRow, dayChip, gridHighlightIdx };
}

// ---------- Hero ----------------------------------------------------------

function BookingHero({ ctx }) {
  const { bk, req, scope, worker, calendarRow, dayChip } = ctx;
  if (scope === "worker" && worker) {
    const sup = REQ_SUPPLIERS[worker.supplier] || REQ_SUPPLIERS.sw;
    const dayCount = (calendarRow.shifts || []).reduce((sum, s) => sum + (s.span || 1), 0);
    return (
      <section className="bk-hero bk-hero--worker">
        <div className="bk-hero-info">
          <div className="bk-hero-worker">
            <div className="bk-hero-worker-avatar">
              <WorkerAvatar w={worker} size={56} />
              <span
                className="bk-hero-worker-sup"
                style={{ background: sup.bg, color: sup.fg }}
                aria-hidden="true"
                title={sup.label} />
              
            </div>
            <div className="bk-hero-worker-text">
              <h2 className="bk-hero-title">{worker.name}</h2>
              <div className="bk-hero-sub">
                <span className="bk-hero-sub-strong">{worker.jobs[0] || "—"}</span>
                <span aria-hidden="true">·</span>
                <span>{sup.label}</span>
              </div>
            </div>
          </div>
          <dl className="bk-hero-meta">
            <div className="bk-hero-meta-row"><dt>Dates:</dt><dd className="tabular">{(() => {
                  const mo = SCH_TODAY_DATE.toLocaleDateString("en-US", { month: "short" });
                  const start = SCH_DAYS[0] ? SCH_DAYS[0].date : 1;
                  const yr = SCH_TODAY_DATE.getFullYear();
                  return `${mo} ${start} – ${mo} ${start - 1 + dayCount}, ${yr}`;
                })()}</dd></div>
            <div className="bk-hero-meta-row"><dt>Scheduled:</dt><dd className="tabular">{dayCount} shift{dayCount === 1 ? "" : "s"} · {calendarRow.hrs}</dd></div>
            <div className="bk-hero-meta-row"><dt>Site:</dt><dd>{bk.location}</dd></div>
            <div className="bk-hero-meta-row"><dt title="Dayforce calls this Labor metric — formerly &lsquo;Department&rsquo; in Flex Work">Labor metric:</dt><dd>{req.costCenter}</dd></div>
            <div className="bk-hero-meta-row"><dt>Requisition:</dt><dd><a href="#" onClick={(e) => {e.preventDefault();window.flexGoTo && window.flexGoTo({ page: "requisitions", sub: "details", id: bk.id });}}>Requisition #{bk.id}</a></dd></div>
          </dl>
        </div>
        <div className="bk-hero-map">
          <img src="assets/map.png" alt="" role="presentation" />
          <img className="bk-hero-map-pin" src="assets/pin-job-site.svg" alt="" aria-hidden="true" />
        </div>
      </section>);

  }
  // date and full scopes share the same hero, with the date row swapped.
  return (
    <section className="bk-hero">
      <div className="bk-hero-info">
        <h2 className="det-hero-title">Work assignment #{bk.id}</h2>
        <a
          href="#"
          className="det-hero-loc"
          onClick={(e) => {
            e.preventDefault();
            if (window.flexGoTo) window.flexGoTo({ page: "locations", sub: "details", id: bk.location });else
            showToast(`Opening ${bk.location}`);
          }}>
          
          <span className="det-loc-dot" aria-hidden="true">{window.locDot ? window.locDot(bk.location) : bk.location[0] || "?"}</span>
          <span className="det-hero-loc-text">{bk.location}</span>
        </a>
        <dl className="det-meta-list">
          <div className="det-meta-row">
            <dt>Date{scope === "date" ? "" : "s"}:</dt>
            <dd className="tabular">{scope === "date" ? `${dayChip}, ${SCH_TODAY_DATE.getFullYear()}` : bk.dates}</dd>
          </div>
          <div className="det-meta-row"><dt title="Dayforce calls this Labor metric — formerly &lsquo;Department&rsquo; in Flex Work">Labor metric:</dt><dd><a href="#" onClick={(e) => {e.preventDefault();showToast(`Opening ${req.costCenter}`);}}>{req.costCenter}</a></dd></div>
          <div className="det-meta-row"><dt>Booked by:</dt><dd><a href="#" onClick={(e) => {e.preventDefault();showToast(`Opening profile for ${req.bookedBy}`);}}>{req.bookedBy}</a></dd></div>
          <div className="det-meta-row"><dt>Requisition:</dt><dd><a href="#" onClick={(e) => {e.preventDefault();window.flexGoTo && window.flexGoTo({ page: "requisitions", sub: "details", id: bk.id });}}>Requisition #{bk.id}</a></dd></div>
          <div className="det-meta-row"><dt>Assignment ID:</dt><dd className="tabular">{bk.id}</dd></div>
        </dl>
      </div>
      <div className="bk-hero-map">
        <img src="assets/map.png" alt="" role="presentation" />
        <img className="bk-hero-map-pin" src="assets/pin-job-site.svg" alt="" aria-hidden="true" />
      </div>
    </section>);

}

// Accordion card matching the Workforce / Location detail style:
// soft-blue 40px circle avatar + title + chevron, optional count.
function BkAccordionCard({ icon, title, count, defaultOpen = true, children }) {
  // Collapsed by default everywhere — `defaultOpen` kept for API compat
  // but ignored so all accordion sections start closed.
  const [open, setOpen] = useStateSc(false);
  const id = React.useId();
  return (
    <section className="acc-card">
      <button
        type="button"
        className="acc-card-head"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((v) => !v)}>
        
        <span className="acc-card-avatar" aria-hidden="true">
          <Icon name={icon} size={20} />
        </span>
        <h2 className="acc-card-title">{title}</h2>
        {typeof count === "number" &&
        <span className="acc-card-count tabular" aria-label={`${count} items`}>{count}</span>
        }
        <span className="acc-card-chev" data-open={open} aria-hidden="true">
          <Icon name="ChevronDown" size={20} />
        </span>
      </button>
      {open &&
      <div id={id} className="acc-card-body">
          {children}
        </div>
      }
    </section>);

}

// Schedule mini-grid: one or many worker rows, with optional day highlight.
// All shift cells are clickable and surface up via onOpenShift.

// Booking schedule rail — paddle buttons + airline-style typeable date
// range. Keeps a local week range so the chip behaves naturally even
// though the prototype's underlying data is fixed at Apr 20 – 26.
function BkSchedRail() {
  // Default to the current week (Mon–Sun containing today).
  const _wkStart = (() => {
    const t = window.flexToday ? window.flexToday() : new Date(2026, 4, 19);
    const offset = (t.getDay() + 6) % 7;
    const x = new Date(t);
    x.setDate(x.getDate() - offset);
    x.setHours(0, 0, 0, 0);
    return x;
  })();
  const _wkEnd = (() => {const e = new Date(_wkStart);e.setDate(e.getDate() + 6);return e;})();
  const [range, setRange] = useStateSc({ start: _wkStart, end: _wkEnd });
  const stepWeek = (dir) => {
    setRange((r) => ({
      start: new Date(r.start.getTime() + dir * 7 * 24 * 3600 * 1000),
      end: new Date(r.end.getTime() + dir * 7 * 24 * 3600 * 1000)
    }));
    showToast(dir < 0 ? "Showing previous week" : "Showing next week");
  };
  return (
    <div className="bk-sched-rail">
      <div className="bk-sched-rail-left">
        <button
          type="button"
          className="sch-paddle"
          aria-label="Previous week"
          onClick={() => stepWeek(-1)}>
          
          <Icon name="ChevronLeft" size={16} />
        </button>
        <AirlineDateRange
          start={range.start}
          end={range.end}
          onChange={(s, e) => setRange({ start: s || range.start, end: e || range.end })} />
        
        <button
          type="button"
          className="sch-paddle"
          aria-label="Next week"
          onClick={() => stepWeek(1)}>
          
          <Icon name="ChevronRight" size={16} />
        </button>
      </div>
      <div className="bk-sched-rail-right">
        <SchFilterBtn
          label="Filters"
          onClick={(e) => openFilter(e.currentTarget, {
            title: "Filters",
            options: ["Working", "En route", "Off", "Has issue"],
            onApply: (vals) => showToast(`Filters applied: ${vals.length}`)
          })} />
        
      </div>
    </div>);

}

function BookingScheduleSection({ ctx, onOpenBooking, onOpenShift }) {
  const { bk, req, scope, worker, calendarRow, assignments, assignWorker } = ctx;

  // Decide which worker rows to render:
  //   • worker scope → just that one worker's calendar row
  //   • date / full  → derive the roster from the requisition (qty per
  //     role) so the schedule shows the same workers as the Roster /
  //     Positions sections. Each roster row maps to a SCH_WORKER_SCHED
  //     row when one exists, otherwise we synthesize a calendar row from
  //     SCH_WORKER_SCHED's first entry for that req as the visual stand-in.
  let rows;
  let unfilledRows = [];
  if (scope === "worker" && worker) {
    rows = [calendarRow];
  } else {
    const roster = buildBookingRoster(req, bk, assignments);
    const reqRows = SCH_WORKER_SCHED.filter((r) => r.reqId === bk.id);
    const fallback = reqRows[0] || SCH_WORKER_SCHED[0];
    rows = roster.
    filter((r) => !r.unfilled).
    map((r) => {
      const match =
      SCH_WORKER_SCHED.find((s) => s.worker === r.worker && s.reqId === bk.id) ||
      SCH_WORKER_SCHED.find((s) => s.worker === r.worker) ||
      // Synthesize a row tied to this worker so the avatar / name line up
      // with the roster even when the worker isn't pre-wired to the req.
      { worker: r.worker, hrs: fallback.hrs, reqId: bk.id, shifts: fallback.shifts };
      return match;
    });
    unfilledRows = roster.filter((r) => r.unfilled);
    if (rows.length === 0 && unfilledRows.length === 0) {
      rows = reqRows.length ? reqRows : [fallback];
    }
  }

  return (
    <BkAccordionCard icon="Calendar" title="Schedule" defaultOpen={false}>
      <BkSchedRail />


      {scope === "worker" &&
      <p className="bk-sched-hint">
          <Icon name="Information" size={14} />
          Click any day to open the shift for that date.
        </p>
      }

      <div className="sch-grid-card sch-grid-card--inset">
        <div className="sch-grid" role="table" aria-label="Work assignment schedule">
          <div className="sch-grid-row sch-grid-row--head" role="row">
            <div className="sch-grid-cell sch-grid-cell--rowhead" role="columnheader">
              <span className="sch-grid-head-day">Worker info</span>
            </div>
            {SCH_DAYS.map((d, idx) => {
              const isHi = ctx.gridHighlightIdx != null && ctx.gridHighlightIdx === idx;
              return (
                <div
                  key={d.key}
                  className={`sch-grid-cell sch-grid-cell--head${isHi ? " sch-grid-cell--highlight" : ""}`}
                  role="columnheader">
                  
                  <span className="sch-grid-head-day">{d.label}</span>
                  <span className="sch-grid-head-num">{d.date}</span>
                </div>);

            })}
          </div>
          {rows.map((row) =>
          <SchWorkerRow
            key={row.worker}
            row={row}
            highlightDayIdx={ctx.gridHighlightIdx}
            showOff
            onOpenBooking={() => onOpenBooking && onOpenBooking(buildBookingId({ reqId: bk.id, workerId: row.worker }))}
            onOpenShift={(_r, dayIdx) => onOpenShift && onOpenShift(buildBookingId({ reqId: bk.id, workerId: row.worker, weekDayIdx: dayIdx }))} />

          )}
          {unfilledRows.map((r) => {
            const sup = REQ_SUPPLIERS[r.supplierId] || REQ_SUPPLIERS.sw;
            const onAssignClick = (e) => {
              e.stopPropagation();
              openAssignWorkerPanel({
                supplierId: r.supplierId,
                role: r.role,
                engagementType: "Shift",
                bookingId: bk.id, idx: r.i, day: (r.day || bk.day),
                recurring: !!(bk.recurring || req.recurring),
                onAssign: (w) => {
                  assignWorker && assignWorker(r.i, w.id);
                  showToast(`${w.name} assigned to position #${r.i}`, { kind: "success" });
                },
                onRequest: (w) => {
                  const fromSup = REQ_SUPPLIERS[w.supplier] || sup;
                  showToast(`Request sent to ${fromSup.label} for ${w.name} · position #${r.i}`, { kind: "success" });
                }
              });
            };
            return (
              <div key={`u-${r.i}`} className="sch-grid-row sch-grid-row--unfilled" role="row">
                <div className="sch-grid-cell sch-grid-cell--rowhead sch-grid-cell--unfilled-head" role="cell">
                  <span className="bk-roster-empty-avatar" aria-hidden="true">
                    <Icon name="PersonPlus" size={16} />
                  </span>
                  <div className="sch-grid-unfilled-text">
                    <span className="sch-grid-unfilled-name">Unassigned · #{r.i}</span>
                    <span className="sch-grid-unfilled-sub">{r.role} · {sup.label}</span>
                  </div>
                  <button
                    type="button"
                    className="btn btn--sm btn--secondary bk-assign-btn sch-grid-unfilled-btn"
                    onClick={onAssignClick}>
                    
                    <Icon name={window.flexViewAsRole === "agency" ? "PersonPlus" : "Send"} size={14} />
                    {window.flexViewAsRole === "agency" ? "Assign" : "Request"}
                  </button>
                </div>
                {SCH_DAYS.map((d, idx) => {
                  const isHi = ctx.gridHighlightIdx != null && ctx.gridHighlightIdx === idx;
                  return (
                    <div
                      key={d.key}
                      className={`sch-grid-cell sch-grid-cell--unfilled${isHi ? " sch-grid-cell--highlight" : ""}`}
                      role="cell">
                      
                      <span className="sch-grid-unfilled-dash" aria-hidden="true">—</span>
                    </div>);

                })}
              </div>);

          })}
        </div>
      </div>
    </BkAccordionCard>);

}

// =====================================================================
// Roster / Shifts list
//   - "worker" scope shows the worker's shifts (one row per day)
//   - "date" + "full" scopes show the roster (workers on the booking)
// =====================================================================

function BookingShiftsList({ ctx, onOpenShift }) {
  const { bk, req, calendarRow, worker } = ctx;
  // Build one row per day the worker is scheduled — expanding shift spans
  // into individual day entries so each one is independently clickable.
  const dayEntries = [];
  (calendarRow.shifts || []).forEach((s) => {
    const startIdx = SCH_DAYS.findIndex((d) => d.key === s.day);
    for (let i = 0; i < (s.span || 1); i++) {
      const idx = startIdx + i;
      if (idx >= SCH_DAYS.length) break;
      const _d = SCH_DAYS[idx];
      const _mo = new Date(_d.year || SCH_TODAY_DATE.getFullYear(), _d.month != null ? _d.month : SCH_TODAY_DATE.getMonth(), 1).
      toLocaleDateString("en-US", { month: "short" });
      const dlabel = `${_d.label}, ${_mo} ${_d.date}`;
      dayEntries.push({
        dayIdx: idx,
        dayLabel: dlabel,
        tone: s.tone,
        role: s.role,
        time: s.time
      });
    }
  });

  return (
    <BkAccordionCard icon="PersonClock" title="Shifts" count={dayEntries.length} defaultOpen={false}>
      <div className="bk-shifts" role="table" aria-label="Shifts">
        <div className="bk-shifts-row bk-shifts-row--head" role="row">
          <div className="bk-shifts-cell bk-shifts-cell--day" role="columnheader"><span>Day</span></div>
          <div className="bk-shifts-cell bk-shifts-cell--role" role="columnheader"><span>Role</span></div>
          <div className="bk-shifts-cell bk-shifts-cell--time" role="columnheader"><span>Scheduled</span></div>
          <div className="bk-shifts-cell bk-shifts-cell--actual" role="columnheader"><span>Actual</span></div>
          <div className="bk-shifts-cell bk-shifts-cell--status" role="columnheader"><span>Status</span></div>
          <div className="bk-shifts-cell bk-shifts-cell--chev" role="columnheader" aria-label=""></div>
        </div>
        {dayEntries.map((d, idx) => {
          const status = BK_SHIFT_DAY_STATUSES[idx] || "Scheduled";
          const t = BK_SHIFT_DAY_TIMES[idx] || { start: "—", end: "—" };
          const hue = status === "Working" ? "informative" : status === "Completed" ? "success" : "default";
          return (
            <button
              type="button"
              key={d.dayIdx}
              className="bk-shifts-row bk-shifts-row--btn"
              role="row"
              onClick={() => onOpenShift && onOpenShift(buildBookingId({ reqId: bk.id, workerId: worker.id, weekDayIdx: d.dayIdx }))}>
              
              <div className="bk-shifts-cell bk-shifts-cell--day" role="cell">
                <span className={`bk-shifts-bar bk-shifts-bar--${d.tone}`} aria-hidden="true" />
                <span className="bk-shifts-daylabel">{d.dayLabel}</span>
              </div>
              <div className="bk-shifts-cell bk-shifts-cell--role" role="cell">
                <span>{d.role}</span>
              </div>
              <div className="bk-shifts-cell bk-shifts-cell--time" role="cell">
                <span className="bk-shifts-time">{d.time}</span>
              </div>
              <div className="bk-shifts-cell bk-shifts-cell--actual" role="cell">
                <span className="bk-shifts-time">
                  {t.start !== "—" || t.end !== "—" ? `${t.start} – ${t.end}` : "—"}
                </span>
              </div>
              <div className="bk-shifts-cell bk-shifts-cell--status" role="cell">
                <span className={`req-pill req-pill--${hue}`}>{status}</span>
              </div>
              <div className="bk-shifts-cell bk-shifts-cell--chev" role="cell">
                <Icon name="ChevronRight" size={18} />
              </div>
            </button>);

        })}
      </div>
    </BkAccordionCard>);

}

function BookingRosterSection({ ctx, onOpenShift }) {
  const { bk, req, calendarRow, assignments, assignWorker } = ctx;
  // Roster mirrors the requisition: one row per qty unit per role on `req`.
  // For "Booked" assignments rows are unfilled until a supplier assigns a
  // worker via the inline "Assign worker" CTA.
  const roster = useMemoSc(
    () => buildBookingRoster(req, bk, assignments),
    [req, bk, assignments]
  );
  const [selected, setSelected] = useStateSc(() => new Set());
  const isBooked = bk.status === "Booked";
  const filledCount = roster.filter((r) => !r.unfilled).length;
  const selectableRoster = roster.filter((r) => !r.unfilled);
  const allChecked = selectableRoster.length > 0 && selectableRoster.every((r) => selected.has(r.i));
  const toggle = (i) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);else next.add(i);
      return next;
    });
  };
  const toggleAll = () => {
    setSelected((prev) => {
      if (allChecked) return new Set();
      return new Set(selectableRoster.map((r) => r.i));
    });
  };

  return (
    <BkAccordionCard icon="PersonLines" title="Roster" count={roster.length} defaultOpen={false}>
      <div className="bk-search">
        <span className="bk-search-icon" aria-hidden="true">
          <Icon name="Search" size={18} />
        </span>
        <input
          type="search"
          className="bk-search-input"
          placeholder="Search workers"
          aria-label="Search workers" />
        
      </div>

      <div className="bk-roster" role="table">
        <div className="bk-roster-row bk-roster-row--head" role="row">
          <div className="bk-roster-cell bk-roster-cell--check" role="columnheader">
            <input
              type="checkbox"
              checked={allChecked}
              onChange={toggleAll}
              aria-label="Select all workers" />
            
          </div>
          <div className="bk-roster-cell bk-roster-cell--num" role="columnheader"><span>#</span></div>
          <div className="bk-roster-cell bk-roster-cell--worker" role="columnheader"><span>Worker</span></div>
          <div className="bk-roster-cell bk-roster-cell--agency" role="columnheader"><span>Supplier</span></div>
          <div className="bk-roster-cell" role="columnheader"><span>Status</span></div>
          <div className="bk-roster-cell" role="columnheader"><span>Start time</span></div>
          <div className="bk-roster-cell" role="columnheader"><span>End time</span></div>
          <div className="bk-roster-cell" role="columnheader"><span>Rating</span></div>
          <div className="bk-roster-cell bk-roster-cell--actions" role="columnheader"><span className="sr-only">Actions</span></div>
        </div>
        {roster.map((r) => {
          const hue = BK_ROSTER_HUES[r.status] || "default";
          if (r.unfilled) {
            const sup = REQ_SUPPLIERS[r.supplierId] || REQ_SUPPLIERS.sw;
            const onAssignClick = (e) => {
              e.stopPropagation();
              openAssignWorkerPanel({
                supplierId: r.supplierId,
                role: r.role,
                engagementType: "Shift",
                bookingId: bk.id, idx: r.i, day: (r.day || bk.day),
                recurring: !!(bk.recurring || req.recurring),
                onAssign: (w) => {
                  assignWorker && assignWorker(r.i, w.id);
                  showToast(`${w.name} assigned to shift #${r.i}`, { kind: "success" });
                },
                onRequest: (w) => {
                  const fromSup = REQ_SUPPLIERS[w.supplier] || sup;
                  showToast(`Request sent to ${fromSup.label} for ${w.name} · shift #${r.i}`, { kind: "success" });
                }
              });
            };
            return (
              <div
                key={r.i}
                className="bk-roster-row bk-roster-row--unfilled"
                role="row">
                
                <div className="bk-roster-cell bk-roster-cell--check" role="cell">
                  <input
                    type="checkbox"
                    disabled
                    aria-label={`Row ${r.i} (unfilled)`} />
                  
                </div>
                <div className="bk-roster-cell bk-roster-cell--num" role="cell">{r.i}</div>
                <div className="bk-roster-cell bk-roster-cell--worker" role="cell">
                  <span className="bk-roster-empty-avatar" aria-hidden="true">
                    <Icon name="PersonPlus" size={16} />
                  </span>
                  <span className="bk-roster-empty-name">Unassigned · {r.role}</span>
                </div>
                <div className="bk-roster-cell bk-roster-cell--agency" role="cell">
                  <span className="bk-roster-empty-cell">—</span>
                </div>
                <div className="bk-roster-cell" role="cell">
                  <span className={`req-pill req-pill--${hue}`}>{r.status}</span>
                </div>
                <div className="bk-roster-cell" role="cell">
                  <span className="bk-roster-time">—</span>
                </div>
                <div className="bk-roster-cell" role="cell">
                  <span className="bk-roster-time">—</span>
                </div>
                <div className="bk-roster-cell" role="cell">
                  <span className="bk-roster-time">—</span>
                </div>
                <div className="bk-roster-cell bk-roster-cell--actions" role="cell">
                  <button
                    type="button"
                    className="iconbtn bk-roster-assign-iconbtn"
                    aria-label={window.flexViewAsRole === "agency" ? "Assign worker" : "Request worker"}
                    title={window.flexViewAsRole === "agency" ? "Assign worker" : "Request worker"}
                    onClick={onAssignClick}>
                    
                    <Icon name={window.flexViewAsRole === "agency" ? "PersonPlus" : "Send"} size={18} />
                  </button>
                </div>
              </div>);

          }
          const worker = WORKERS.find((w) => w.id === r.worker) || WORKERS[0];
          const supId = worker.supplier;
          const sup = REQ_SUPPLIERS[supId] || REQ_SUPPLIERS.sw;
          // For the row's shift, preserve the parent booking's date scope
          // when present: a req-date-scoped booking opens a req-date-scoped
          // shift; otherwise we use the weekday context (defaulting to Thu,
          // Apr 23 — the demo's "today" — for the full multi-day booking).
          let shiftHref;
          if (ctx.parsed.reqDateIdx != null) {
            shiftHref = buildBookingId({ reqId: bk.id, workerId: r.worker, reqDateIdx: ctx.parsed.reqDateIdx });
          } else {
            const wIdx = ctx.parsed.weekDayIdx != null ? ctx.parsed.weekDayIdx : 3;
            shiftHref = buildBookingId({ reqId: bk.id, workerId: r.worker, weekDayIdx: wIdx });
          }
          const openShift = () => onOpenShift && onOpenShift(shiftHref);
          return (
            <div
              key={r.i}
              className="bk-roster-row bk-roster-row--clickable"
              role="row"
              tabIndex={0}
              onClick={(e) => {if (e.target.closest("input,button,a")) return;openShift();}}
              onKeyDown={(e) => {if (e.key === "Enter") openShift();}}>
              
              <div className="bk-roster-cell bk-roster-cell--check" role="cell">
                <input
                  type="checkbox"
                  checked={selected.has(r.i)}
                  onChange={() => toggle(r.i)}
                  aria-label={`Select row ${r.i}`} />
                
              </div>
              <div className="bk-roster-cell bk-roster-cell--num" role="cell">{r.i}</div>
              <div className="bk-roster-cell bk-roster-cell--worker" role="cell">
                <WorkerAvatar w={worker} size={28} />
                <span>{worker.name}</span>
              </div>
              <div className="bk-roster-cell bk-roster-cell--agency" role="cell">
                <ReqSupplierChip id={supId} size={24} />
                <span>{sup.label}</span>
              </div>
              <div className="bk-roster-cell" role="cell">
                <span className={`req-pill req-pill--${hue}`}>{r.status}</span>
              </div>
              <div className="bk-roster-cell" role="cell">
                <span className="bk-roster-time">{r.start}</span>
              </div>
              <div className="bk-roster-cell" role="cell">
                <span className="bk-roster-time">{r.end}</span>
              </div>
              <div className="bk-roster-cell" role="cell">
                <span className="bk-roster-time">—</span>
              </div>
              <div className="bk-roster-cell bk-roster-cell--actions" role="cell">
                <button
                  type="button"
                  className="iconbtn"
                  aria-label="Row actions"
                  onClick={(e) => openMenu(e.currentTarget, [
                  { icon: "View", label: "Open shift", onClick: openShift },
                  { icon: "PersonClock", label: "View timesheet", onClick: () => showToast(`Timesheet for ${worker.name}`) },
                  { icon: "Edit", label: "Edit shift", onClick: () => openEditEntity({
                      ...shiftEditSchema(worker, bk.id),
                      onSave: () => showToast(`${worker.name}'s shift updated`, { kind: "success" })
                    }) },
                  { divider: true },
                  { icon: "Cancel", label: "Remove from booking", danger: true,
                    onClick: () => openRemoveWorker(buildRemoveWorkerCtx({
                      worker,
                      bookingId: bk.id,
                      requisition: req
                    })) }]
                  )}>
                  
                  <Icon name="MoreVert" size={18} />
                </button>
              </div>
            </div>);

        })}
      </div>

    </BkAccordionCard>);

}

// ---------- Real bodies for the Booking Details accordions ----------

function BkDistributionBody({ req }) {
  const all = ["sw", "th", "ph", "ss", "gs"];
  const assigned = req ? req.suppliers : ["sw", "th", "ph"];
  const qty = req && req.qty || 3;
  // Distribute qty workers across assigned suppliers, front-loaded (the
  // top-ranked supplier gets the largest share). This makes the section's
  // numbers add up to the requisition's qty rather than a fixed total.
  const assignedCounts = assigned.map(() => 0);
  for (let i = 0; i < qty; i++) {
    assignedCounts[i % assigned.length] += 1;
  }
  // Sort so the larger shares are ranked first.
  const orderedAssigned = assigned.
  map((s, i) => ({ s, n: assignedCounts[i] })).
  sort((a, b) => b.n - a.n);
  const tail = all.filter((s) => !assigned.includes(s));
  const ranked = [
  ...orderedAssigned.map((o) => ({ supplier: o.s, workers: o.n })),
  ...tail.map((s) => ({ supplier: s, workers: 0 }))].

  slice(0, 5).
  map((row, i) => ({ rank: i + 1, ...row }));
  return (
    <DistributionList
      note="This booking inherits the requisition's distribution. Edit on the requisition to change supplier priority."
      suppliers={ranked} />);


}

function BkLogsBody({ bk, req }) {
  // Booking is requisition + a specific date window. Build the log
  // around the actual job/role being filled, the supplier on point,
  // and the qty of workers assigned — so the trail mirrors the
  // booking's own subhead, not a generic "viewed" feed.
  const firstSup = REQ_SUPPLIERS[req && req.suppliers[0] || "sw"]?.label || "Supplier";
  const primaryJob = req && req.jobs && req.jobs[0] || "Worker";
  const qty = req && req.qty || 3;
  const firstDate = req && req.dates && req.dates[0] || "—";
  const items = [
  { tone: "info", icon: "Briefcase", actor: req ? req.bookedBy : "Nia Thompson", action: `created booking for ${qty} ${primaryJob}${qty === 1 ? "" : "s"}`, note: bk.location, time: req ? req.placed : "Last week" }];

  if (bk.status === "Booked") {
    // Pre-start booking: broadcast → awaiting assignments. No clock-in
    // events yet because no worker has been dispatched.
    const supCount = req && req.suppliers && req.suppliers.length || 1;
    items.push({ tone: "info", icon: "PersonLines", actor: req ? req.bookedBy : "Buyer", action: `broadcast to ${supCount} supplier${supCount === 1 ? "" : "s"}`, note: firstSup, time: "3 days ago" });
    items.push({ tone: "info", icon: "Calendar", actor: "Scheduler", action: "locked schedule —", target: firstDate, time: "2 days ago" });
    items.push({ tone: "warning", icon: "PersonClock", actor: "System", action: `${qty} ${primaryJob}${qty === 1 ? "" : "s"} pending assignment`, note: `Awaiting submissions from ${firstSup}`, time: "Yesterday" });
  } else {
    // In progress: workers are dispatched and clocking in.
    items.push({ tone: "info", icon: "PersonLines", actor: firstSup, action: `assigned ${qty} ${primaryJob}${qty === 1 ? "" : "s"}`, note: req ? req.bill : undefined, time: "3 days ago" });
    items.push({ tone: "success", icon: "Check", actor: firstSup, action: "confirmed dispatch for", target: firstDate, time: "2 days ago" });
    items.push({ tone: "info", icon: "PersonClock", actor: "Maya Lin", action: `clocked in as ${primaryJob}`, time: "Today, 5:58 AM" });
    items.push({ tone: "warning", icon: "Alert", actor: "System", action: "flagged a late start", note: "Jamal Carter, 12 minutes", time: "Today, 6:12 AM" });
    items.push({ tone: "info", icon: "View", actor: "Site supervisor", action: `viewed booking roster for ${bk.location}`, time: "Today, 7:00 AM" });
  }
  return <ActivityLog items={items} />;
}

// ---------- Positions: role grouping for multi-day bookings ------------
// Long-term bookings are best read as a list of positions ("3 Service
// Associates for the Mar 05 – Apr 17 window"), each filled by a worker.
// Clicking a position drills into that worker's booking, whose shifts
// list opens individual shift records.

function BookingPositionsSection({ ctx, onOpenBooking }) {
  const { bk, req, assignments, assignWorker } = ctx;
  // One row per qty unit per role. For Booked assignments the row may be
  // unfilled — the supplier picks a worker via the "Assign worker" CTA.
  const positions = useMemoSc(
    () => buildBookingRoster(req, bk, assignments),
    [req, bk, assignments]
  );
  const filledCount = positions.filter((p) => !p.unfilled).length;
  const totalCount = positions.length;
  const isBooked = bk.status === "Booked";

  return (
    <BkAccordionCard icon="ClipboardPerson" title="Positions" count={positions.length} defaultOpen={false}>
      {isBooked ?
      <div className="bk-pending-banner">
          <span className="bk-pending-banner-icon" aria-hidden="true">
            <Icon name="PersonClock" size={18} />
          </span>
          <div className="bk-pending-banner-text">
            <strong>{totalCount - filledCount} position{totalCount - filledCount === 1 ? "" : "s"} pending</strong>
            <span>{filledCount} of {totalCount} filled · suppliers can assign workers below</span>
          </div>
        </div> :

      <p className="bk-sched-hint">
          <Icon name="Information" size={14} />
          Each position is filled by a worker. Open one to see their shifts.
        </p>
      }
      <div className="bk-positions" role="table" aria-label="Positions">
        <div className="bk-positions-row bk-positions-row--head" role="row">
          <div className="bk-positions-cell bk-positions-cell--num" role="columnheader"><span>#</span></div>
          <div className="bk-positions-cell bk-positions-cell--role" role="columnheader"><span>Role</span></div>
          <div className="bk-positions-cell bk-positions-cell--worker" role="columnheader"><span>Worker</span></div>
          <div className="bk-positions-cell bk-positions-cell--dates" role="columnheader"><span>Dates</span></div>
          <div className="bk-positions-cell bk-positions-cell--chev" role="columnheader" aria-label=""></div>
        </div>
        {positions.map((p) => {
          if (p.unfilled) {
            const sup = REQ_SUPPLIERS[p.supplierId] || REQ_SUPPLIERS.sw;
            const onAssignClick = (e) => {
              e.stopPropagation();
              openAssignWorkerPanel({
                supplierId: p.supplierId,
                role: p.role,
                engagementType: "Shift",
                bookingId: bk.id, idx: p.i, day: (p.day || bk.day),
                recurring: !!(bk.recurring || req.recurring),
                onAssign: (w) => {
                  assignWorker && assignWorker(p.i, w.id);
                  showToast(`${w.name} assigned to position #${p.i}`, { kind: "success" });
                },
                onRequest: (w) => {
                  const fromSup = REQ_SUPPLIERS[w.supplier] || sup;
                  showToast(`Request sent to ${fromSup.label} for ${w.name} · position #${p.i}`, { kind: "success" });
                }
              });
            };
            return (
              <div
                key={p.i}
                className="bk-positions-row bk-positions-row--unfilled"
                role="row">
                
                <div className="bk-positions-cell bk-positions-cell--num" role="cell">
                  <span className="tabular">#{p.i}</span>
                </div>
                <div className="bk-positions-cell bk-positions-cell--role" role="cell">
                  <span>{p.role}</span>
                </div>
                <div className="bk-positions-cell bk-positions-cell--worker" role="cell">
                  <span className="bk-position-empty-avatar" aria-hidden="true">
                    <Icon name="PersonPlus" size={18} />
                  </span>
                  <div className="bk-position-worker-text">
                    <span className="bk-position-worker-name bk-position-worker-name--empty">Unassigned</span>
                    <span className="bk-position-worker-sup-label">Pending · {sup.label}</span>
                  </div>
                </div>
                <div className="bk-positions-cell bk-positions-cell--dates" role="cell">
                  <span className="tabular">{bk.dates}</span>
                </div>
                <div className="bk-positions-cell bk-positions-cell--chev" role="cell">
                  <button
                    type="button"
                    className="btn btn--sm btn--secondary bk-assign-btn"
                    onClick={onAssignClick}>
                    
                    <Icon name={window.flexViewAsRole === "agency" ? "PersonPlus" : "Send"} size={14} />
                    {window.flexViewAsRole === "agency" ? "Assign worker" : "Request worker"}
                  </button>
                </div>
              </div>);

          }
          const worker = WORKERS.find((w) => w.id === p.worker) || WORKERS[0];
          const hasSup = !!worker.supplier;
          const sup = hasSup ? REQ_SUPPLIERS[worker.supplier] || REQ_SUPPLIERS.sw : null;
          const channelLabel = hasSup ? sup.label : worker.pool ? `${worker.pool} pool` : "Internal";
          const openWorker = () => onOpenBooking && onOpenBooking(buildBookingId({ reqId: bk.id, workerId: worker.id }));
          return (
            <div
              key={p.i}
              className="bk-positions-row bk-positions-row--btn"
              role="row"
              tabIndex={0}
              onClick={openWorker}
              onKeyDown={(e) => {if (e.key === "Enter") openWorker();}}>
              
              <div className="bk-positions-cell bk-positions-cell--num" role="cell">
                <span className="tabular">#{p.i}</span>
              </div>
              <div className="bk-positions-cell bk-positions-cell--role" role="cell">
                <span>{p.role}</span>
              </div>
              <div className="bk-positions-cell bk-positions-cell--worker" role="cell">
                <div className="bk-position-worker-avatar">
                  <WorkerAvatar w={worker} size={32} />
                  {hasSup &&
                  <span
                    className="bk-position-worker-sup"
                    style={{ background: sup.bg, color: sup.fg }}
                    aria-hidden="true"
                    title={sup.label} />

                  }
                </div>
                <div className="bk-position-worker-text">
                  <span className="bk-position-worker-name">{worker.name}</span>
                  <span className="bk-position-worker-sup-label">
                    {isBooked && p.status === "Confirmed" ? `${channelLabel} · Confirmed` : channelLabel}
                  </span>
                </div>
              </div>
              <div className="bk-positions-cell bk-positions-cell--dates" role="cell">
                <span className="tabular">{bk.dates}</span>
              </div>
              <div className="bk-positions-cell bk-positions-cell--chev" role="cell">
                <Icon name="ChevronRight" size={18} />
              </div>
            </div>);

        })}
      </div>
    </BkAccordionCard>);

}

function BookingDetailsPage({ bookingId, onBack, onOpenBooking, onOpenShift }) {
  const ctx = useMemoSc(() => resolveBookingScope(bookingId), [bookingId]);
  // Re-render tick so assignment changes propagate. The module-level
  // BK_BOOKING_ASSIGNMENTS store backs this — bumping the counter forces a
  // fresh read after a worker is assigned.
  const [, setAssignTick] = useStateSc(0);
  const bumpAssign = () => setAssignTick((n) => n + 1);
  const assignWorker = (idx, workerId) => {
    setBookingAssignment(ctx.bk.id, idx, workerId);
    bumpAssign();
  };
  ctx.assignments = { ...getBookingAssignments(ctx.bk.id) };
  ctx.assignWorker = assignWorker;
  const { bk, req, scope, worker, dayChip } = ctx;
  const statusHue = bk.status === "Booked" ? "default" : "informative";
  const editEntity = useEditEntity();

  const openEdit = () => editEntity.open({
    ...bookingEditSchema(bk),
    onSave: () => showToast(`Work assignment #${bk.id} updated`, { kind: "success" })
  });

  // Title and subtitle reflect the scope.
  let title, subtitle;
  if (scope === "worker" && worker) {
    title = `${worker.name}'s work assignment`;
    subtitle = `Work assignment #${bk.id} · Requisition #${bk.id}`;
  } else if (scope === "date") {
    title = `Work assignment #${bk.id}`;
    subtitle = `Requisition #${bk.id}`;
  } else {
    title = `Work assignment #${bk.id}`;
    subtitle = `Requisition #${bk.id}`;
  }

  return (
    <React.Fragment>
      <ReqOmnibar
        title={title}
        subtitle={subtitle}
        status={<span className={`req-pill req-pill--${statusHue}`}>{bk.status}</span>}
        onBack={onBack}
        actions={
        <React.Fragment>
            <button
            type="button"
            className="iconbtn"
            aria-label="Refresh"
            title="Refresh"
            onClick={() => showToast("Work assignment refreshed")}>
            
              <Icon name="Refresh" size={18} />
            </button>
            <button
            type="button"
            className="btn btn--md btn--secondary"
            onClick={openEdit}>
            
              <Icon name="Edit" size={16} />
              Edit
            </button>
            <button
            type="button"
            className="iconbtn"
            aria-label="More"
            onClick={(e) => openMenu(e.currentTarget, [
            { icon: "Briefcase", label: "Open requisition", onClick: () => window.flexGoTo && window.flexGoTo({ page: "requisitions", sub: "details", id: bk.id }) },
            { icon: "Copy", label: "Copy assignment ID", onClick: () => copyToClipboard(bookingId, "Assignment ID copied") },
            { icon: "Export", label: "Export roster", onClick: () => showToast("Exporting roster.csv", { kind: "success" }) },
            { divider: true },
            scope === "worker" && worker && { icon: "PersonArrow", label: "Remove worker from work assignment", danger: true,
              onClick: () => openRemoveWorker(buildRemoveWorkerCtx({
                worker,
                bookingId: bk.id,
                requisition: req,
                defaultScope: "upcoming"
              })) },
            scope !== "worker" && { icon: "Cancel", label: "Cancel work assignment", danger: true,
              onClick: () => openConfirm({
                title: `Cancel work assignment #${bk.id}?`,
                body: `Workers assigned to this work assignment will be released and suppliers notified.`,
                primaryLabel: "Cancel booking",
                onConfirm: () => {showToast(`Work assignment #${bk.id} cancelled`, { kind: "success" });onBack && onBack();}
              }) }].
            filter(Boolean))}>
            
              <Icon name="MoreVert" size={20} />
            </button>
          </React.Fragment>
        } />
      

      <div className="content-section bk-content">
        <BookingHero ctx={ctx} />

        {scope === "full" &&
        <BookingPositionsSection ctx={ctx} onOpenBooking={onOpenBooking} />
        }

        {scope === "worker" &&
        <BookingScheduleSection ctx={ctx} onOpenBooking={onOpenBooking} onOpenShift={onOpenShift} />
        }

        {scope === "worker" &&
        <BookingShiftsList ctx={ctx} onOpenShift={onOpenShift} />
        }

        {scope !== "worker" &&
        <BookingRosterSection ctx={ctx} onOpenShift={onOpenShift} />
        }

        <BkAccordionCard icon="PersonLines" title="Distribution" defaultOpen={false}>
          <BkDistributionBody req={req} />
        </BkAccordionCard>

        <BkAccordionCard icon="TimeUndo" title="Logs" defaultOpen={false}>
          <BkLogsBody bk={bk} req={req} />
        </BkAccordionCard>
      </div>
      {editEntity.panel}
    </React.Fragment>);

}

// =====================================================================
// Shift details — single worker × single day's scheduled record.
// =====================================================================

// Parse a shift time like "6:00 AM–3:00 PM" → ["6:00 AM", "3:00 PM"]
function splitShiftTime(t) {
  if (!t || typeof t !== "string") return ["—", "—"];
  const parts = t.split(/\s*–\s*/);
  return [parts[0] || "—", parts[1] || "—"];
}

function ShiftHero({ worker, sup, dayLabel, scheduled, status, statusHue, bk }) {
  return (
    <section className="bk-hero bk-hero--shift">
      <div className="bk-hero-info">
        <div className="sh-hero-toprow">
          <span className={`req-pill req-pill--${statusHue}`}>{status}</span>
        </div>
        <h2 className="det-hero-title">{worker.name}</h2>
        <a
          href="#"
          className="det-hero-loc"
          onClick={(e) => {
            e.preventDefault();
            if (window.flexGoTo) window.flexGoTo({ page: "locations", sub: "details", id: bk.location });else
            showToast(`Opening ${bk.location}`);
          }}>
          
          <span className="det-loc-dot" aria-hidden="true">{window.locDot ? window.locDot(bk.location) : bk.location[0] || "?"}</span>
          <span className="det-hero-loc-text">{bk.location}</span>
        </a>
        <dl className="det-meta-list">
          <div className="det-meta-row"><dt>Supplier:</dt><dd>{sup.label}</dd></div>
          <div className="det-meta-row"><dt>Date:</dt><dd className="tabular">{dayLabel}</dd></div>
          <div className="det-meta-row"><dt>Scheduled:</dt><dd className="tabular">{scheduled[0]} – {scheduled[1]}</dd></div>
          <div className="det-meta-row"><dt>Role:</dt><dd>{worker.jobs[0] || "—"}</dd></div>
          <div className="det-meta-row"><dt>Work assignment:</dt><dd><a href="#" onClick={(e) => e.preventDefault()}>Work assignment #{bk.id}</a></dd></div>
        </dl>
      </div>
    </section>);

}

function ShiftDetailsPage({ shiftId, onBack, onOpenBooking }) {
  const ctx = useMemoSc(() => resolveBookingScope(shiftId), [shiftId]);
  const { bk, req, calendarRow, parsed } = ctx;
  const worker = ctx.worker || WORKERS.find((w) => w.id === calendarRow.worker) || WORKERS[0];
  const sup = REQ_SUPPLIERS[worker.supplier] || REQ_SUPPLIERS.sw;

  // Resolve which day this shift is on. Two paths:
  //   • reqDateIdx → date label comes from req.dates (e.g. "Nov 01")
  //   • weekDayIdx → date label comes from SCH_DAYS (e.g. "Mon, Apr 20")
  let dayShort, dayWeekIdx;
  if (parsed.reqDateIdx != null && req.dates[parsed.reqDateIdx]) {
    dayShort = req.dates[parsed.reqDateIdx];
    dayWeekIdx = 0; // best effort for status pattern lookups
  } else {
    dayWeekIdx = parsed.weekDayIdx != null ? parsed.weekDayIdx : 0;
    const d = SCH_DAYS[dayWeekIdx] || SCH_DAYS[0];
    const _mo = new Date(d.year || SCH_TODAY_DATE.getFullYear(), d.month != null ? d.month : SCH_TODAY_DATE.getMonth(), 1).
    toLocaleDateString("en-US", { month: "short" });
    dayShort = `${d.label}, ${_mo} ${d.date}`;
  }
  const dayLabel = `${dayShort}, ${SCH_TODAY_DATE.getFullYear()}`;

  // Which scheduled shift covers this day? Look up by span when we have a
  // real week index; otherwise just use the worker's first scheduled shift.
  const matched = (parsed.weekDayIdx != null ?
  (calendarRow.shifts || []).find((s) => {
    const start = SCH_DAYS.findIndex((d) => d.key === s.day);
    return dayWeekIdx >= start && dayWeekIdx < start + (s.span || 1);
  }) :
  null) || calendarRow.shifts[0];
  const scheduled = splitShiftTime(matched ? matched.time : "");

  // Map the dayIdx into the same status/timing pattern used by the booking
  // shifts list so a worker's whole week tells a consistent story.
  const shiftsListIdx = (() => {
    if (parsed.weekDayIdx == null) return 0;
    let i = -1;
    (calendarRow.shifts || []).forEach((s) => {
      const start = SCH_DAYS.findIndex((d) => d.key === s.day);
      for (let k = 0; k < (s.span || 1); k++) {
        i += 1;
        if (start + k === dayWeekIdx) return;
      }
    });
    return i;
  })();
  const status = BK_SHIFT_DAY_STATUSES[shiftsListIdx] || "Scheduled";
  const actual = BK_SHIFT_DAY_TIMES[shiftsListIdx] || { start: "—", end: "—" };
  const statusHue = status === "Working" ? "informative" : status === "Completed" ? "success" : "default";

  // --- Timeline derivation (mirrors TimesheetDetailsPage) -------------
  // We reuse the timesheets module's helpers so the shift timeline
  // shares the exact same gauge / formatting vocabulary as Timesheet
  // details — see pages/timesheets.jsx.
  const tlHourMarkers = (window._tsHourMarkers || (() => ["", "", "", ""]))(scheduled[0], scheduled[1]);
  const tlSchedStartMin = window._tsParseClock ? window._tsParseClock(scheduled[0]) : null;
  const tlSchedEndMin = window._tsParseClock ? window._tsParseClock(scheduled[1]) : null;
  const tlSchedBreakMins = 15;
  const tlActualBreakMins = 12;
  const tlBaseStart = (window._tsParseClock ? window._tsParseClock(actual.start) : null) ?? tlSchedStartMin;
  let tlBreakStartMin = null;
  let tlBreakEndMin = null;
  if (tlBaseStart != null && tlSchedEndMin != null && tlSchedStartMin != null && (status === "Working" || status === "Completed")) {
    const span = tlSchedEndMin - tlSchedStartMin;
    const offset = Math.min(180, Math.floor(span / 2));
    tlBreakStartMin = tlBaseStart + offset;
    tlBreakEndMin = tlBreakStartMin + tlActualBreakMins;
  }
  const tlActualBreakStart = tlBreakStartMin != null && window._tsFmtClock ? window._tsFmtClock(tlBreakStartMin) : "—";
  const tlActualBreakEnd = tlBreakEndMin != null && window._tsFmtClock ? window._tsFmtClock(tlBreakEndMin) : "—";
  const tlEndStamp = actual.end && actual.end !== "—" ? actual.end : scheduled[1];
  const TimelineFeedItem = window.TimelineFeedItem;

  // Build an activity-style log for this single shift. The events
  // reference the worker's actual role, this booking's id, and pivot
  // on real shift status — Scheduled shifts surface the dispatch
  // brief; Working/Completed shifts surface the in/out punches and
  // (for Completed) the timesheet hand-off.
  const role = matched ? matched.role : worker.jobs && worker.jobs[0] || "Worker";
  const logItems = (() => {
    const items = [
    { tone: "info", icon: "Briefcase", actor: req.bookedBy, action: `scheduled ${worker.name} as ${role}`, note: `Work assignment #${bk.id} · ${scheduled[0]} – ${scheduled[1]}`, time: req.placed },
    { tone: "info", icon: "PersonLines", actor: sup.label, action: `dispatched ${worker.name} to ${bk.location}`, time: "3 days ago" }];

    if (status === "Working" || status === "Completed") {
      items.push({ tone: "success", icon: "PersonClock", actor: worker.name, action: `clocked in at ${bk.location}`, note: `Scheduled ${scheduled[0]} · actual ${actual.start}`, time: `${dayShort}, ${actual.start}` });
    }
    if (status === "Completed") {
      items.push({ tone: "info", icon: "PersonClock", actor: worker.name, action: `clocked out — ${role} shift complete`, note: `${actual.start} – ${actual.end} · 9h 3m`, time: `${dayShort}, ${actual.end}` });
      items.push({ tone: "success", icon: "Check", actor: req.bookedBy, action: `approved timesheet for ${worker.name}`, target: `TS-${(bk.id || "").toString().slice(-5).padStart(5, "0")}`, time: `${dayShort}, 5:42 PM` });
    } else if (status === "Working") {
      items.push({ tone: "info", icon: "View", actor: req.bookedBy, action: `monitoring ${worker.name}'s shift in real time`, time: "Just now" });
    } else {
      items.push({ tone: "info", icon: "Information", actor: sup.label, action: `confirmed ${worker.name} for ${dayShort} dispatch`, time: "Yesterday" });
    }
    return items;
  })();

  const editEntity = useEditEntity();
  const openEdit = () => editEntity.open({
    ...shiftEditSchema(worker, bk.id),
    onSave: () => showToast(`${worker.name}'s shift updated`, { kind: "success" })
  });

  return (
    <React.Fragment>
      <ReqOmnibar
        title={`${worker.name} · ${dayShort}`}
        subtitle={`Shift · Work assignment #${bk.id}`}
        status={<span className={`req-pill req-pill--${statusHue}`}>{status}</span>}
        onBack={onBack}
        actions={
        <React.Fragment>
            <button
            type="button"
            className="iconbtn"
            aria-label="Refresh"
            title="Refresh"
            onClick={() => showToast("Shift refreshed")}>
            
              <Icon name="Refresh" size={18} />
            </button>
            <button
            type="button"
            className="btn btn--md btn--secondary"
            onClick={openEdit}>
            
              <Icon name="Edit" size={16} />
              Edit shift
            </button>
            <button
            type="button"
            className="iconbtn"
            aria-label="More"
            onClick={(e) => openMenu(e.currentTarget, [
            { icon: "PersonLines", label: "Open work assignment", onClick: () => onOpenBooking && onOpenBooking(buildBookingId({ reqId: bk.id, workerId: worker.id })) },
            { icon: "PersonClock", label: "Open timesheet", onClick: () => showToast(`Opening timesheet for ${worker.name}`) },
            { icon: "Briefcase", label: "Open requisition", onClick: () => window.flexGoTo && window.flexGoTo({ page: "requisitions", sub: "details", id: bk.id }) },
            { divider: true },
            { icon: "Cancel", label: "Remove worker from shift", danger: true,
              onClick: () => openRemoveWorker(buildRemoveWorkerCtx({
                worker,
                bookingId: bk.id,
                requisition: req,
                defaultScope: "this"
              })) }]
            )}>
            
              <Icon name="MoreVert" size={20} />
            </button>
          </React.Fragment>
        } />
      

      <div className="content-section bk-content">
        <ShiftHero
          worker={worker}
          sup={sup}
          dayLabel={dayLabel}
          scheduled={scheduled}
          status={status}
          statusHue={statusHue}
          bk={bk} />
        

        <BkAccordionCard icon="PersonClock" title="Time tracking" defaultOpen={false}>
          <div className="sh-timeline">
            <div className="ts-timeline-start sh-timeline-start">
              {actual.start && actual.start !== "—" ? actual.start : scheduled[0]} – {status === "Scheduled" ? "Scheduled start" : "Start"}
            </div>
            <div className="ts-timeline-body">
              <div className="ts-timeline-hours" aria-hidden="true">
                <span className="ts-timeline-hour">{tlHourMarkers[0]}</span>
                <span style={{ flex: 1 }} />
                <span className="ts-timeline-hour">{tlHourMarkers[1]}</span>
                <span style={{ flex: 1 }} />
                <span className="ts-timeline-hour">{tlHourMarkers[2]}</span>
                <span style={{ flex: 1 }} />
                <span className="ts-timeline-hour">{tlHourMarkers[3]}</span>
              </div>

              <div className="ts-timeline-feed-wrap">
                <div className="ts-timeline-feed">
                  {TimelineFeedItem && (
                    <React.Fragment>
                      <TimelineFeedItem
                        icon="PersonClock"
                        iconTone="teal"
                        title={status === "Scheduled" ? "Shift not started" : "Started shift"}
                        schedLabel="Scheduled start:"
                        schedValue={scheduled[0]}
                        actualLabel="Actual start:"
                        actualValue={actual.start} />
                      {(status === "Working" || status === "Completed") && (
                        <TimelineFeedItem
                          icon="DrinkMug"
                          iconTone="teal"
                          title="Started break"
                          schedLabel="Scheduled break:"
                          schedValue={`${tlSchedBreakMins} mins`}
                          actualLabel="Actual start:"
                          actualValue={tlActualBreakStart} />
                      )}
                      {(status === "Working" || status === "Completed") && (
                        <TimelineFeedItem
                          icon="DrinkMug"
                          iconTone="teal"
                          title="Ended break"
                          schedLabel="Actual break:"
                          schedValue={`${tlActualBreakMins} mins`}
                          actualLabel="Actual end:"
                          actualValue={tlActualBreakEnd} />
                      )}
                      <TimelineFeedItem
                        icon="ClipboardPerson"
                        iconTone="teal"
                        title={status === "Completed" ? "Ended assignment" : status === "Working" ? "Shift in progress" : "End not yet reached"}
                        schedLabel="Scheduled end:"
                        schedValue={scheduled[1]}
                        actualLabel="Actual end:"
                        actualValue={actual.end}
                        isLast />
                    </React.Fragment>
                  )}
                </div>
              </div>
            </div>
            <div className="ts-timeline-end sh-timeline-end">
              {tlEndStamp} – {status === "Completed" ? "End" : "Scheduled end"}
            </div>
          </div>
        </BkAccordionCard>

        <BkAccordionCard icon="Information" title="Details" defaultOpen={false}>
          <InfoGrid
            rows={[
            { label: "Worker", value: worker.name },
            { label: "Role", value: matched ? matched.role : worker.jobs[0] || "—" },
            { label: "Supplier", value: sup.label },
            { label: "Site", value: bk.location },
            { label: "Department", value: req.costCenter },
            { label: "Manager", value: req.bookedBy },
            { label: "Break", value: req.breakLabel },
            { label: "Work assignment", value: `Work assignment #${bk.id}`, tabular: true }]
            } />
          
        </BkAccordionCard>

        <BkAccordionCard icon="TimeUndo" title="Logs " defaultOpen={false}>
          <ActivityLog items={logItems} />
        </BkAccordionCard>
      </div>
      {editEntity.panel}
    </React.Fragment>);

}

Object.assign(window, {
  SchedulePage,
  BookingDetailsPage,
  ShiftDetailsPage,
  SCH_BOOKINGS,
  SCH_WORKER_SCHED,
  SCH_DAYS,
  SCH_TODAY_DATE,
  parseBookingId,
  buildBookingId
});