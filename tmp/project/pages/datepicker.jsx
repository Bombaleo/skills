// =====================================================================
// Flex Work — DateRangePicker
// Inline calendar popover for picking a single day or a date range.
// Exported on window so any page (Schedules in particular) can use it.
// =====================================================================

const { useState: useStateDp, useEffect: useEffectDp, useRef: useRefDp, useMemo: useMemoDp } = React;

const DP_MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const DP_MONTHS_LONG = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const DP_WEEKDAYS = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];

// ---------- Helpers ----------------------------------------------------

function dpStartOfDay(d)  { const x = new Date(d); x.setHours(0,0,0,0); return x; }
function dpAddDays(d, n)  { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
function dpAddMonths(d,n) { const x = new Date(d); x.setMonth(x.getMonth() + n); return x; }
function dpSameDay(a, b)  {
  if (!a || !b) return false;
  return a.getFullYear() === b.getFullYear()
      && a.getMonth() === b.getMonth()
      && a.getDate() === b.getDate();
}
function dpBetween(d, a, b) {
  if (!a || !b) return false;
  const t = dpStartOfDay(d).getTime();
  const lo = Math.min(a.getTime(), b.getTime());
  const hi = Math.max(a.getTime(), b.getTime());
  return t >= lo && t <= hi;
}

// Format a {start, end} range as a user-facing string.
function formatRange(range) {
  if (!range || !range.start) return "";
  const { start, end } = range;
  if (!end || dpSameDay(start, end)) {
    return `${DP_MONTHS[start.getMonth()]} ${start.getDate()}, ${start.getFullYear()}`;
  }
  const a = start, b = end;
  const sameYear = a.getFullYear() === b.getFullYear();
  const sameMonth = sameYear && a.getMonth() === b.getMonth();
  if (sameMonth) {
    return `${DP_MONTHS[a.getMonth()]} ${a.getDate()} – ${b.getDate()}, ${a.getFullYear()}`;
  }
  if (sameYear) {
    return `${DP_MONTHS[a.getMonth()]} ${a.getDate()} – ${DP_MONTHS[b.getMonth()]} ${b.getDate()}, ${a.getFullYear()}`;
  }
  return `${DP_MONTHS[a.getMonth()]} ${a.getDate()}, ${a.getFullYear()} – ${DP_MONTHS[b.getMonth()]} ${b.getDate()}, ${b.getFullYear()}`;
}

// Try to parse the same format back into a range — so a value set from the
// outside as a string ("May 10 – May 13, 2026") still renders.
function parseRange(str) {
  if (!str || typeof str !== "string") return null;
  // Very forgiving parser: just split on en/em dash or hyphen.
  const dash = str.includes("–") ? "–" : (str.includes("—") ? "—" : "-");
  const parts = str.split(dash).map((s) => s.trim());
  const now = new Date();
  const year = now.getFullYear();
  const parsePart = (p, fallbackYear) => {
    // Accept "May 10", "May 10, 2026", "5/10/2026"
    if (!p) return null;
    const m = p.match(/^([A-Za-z]+)\s+(\d{1,2})(?:,?\s+(\d{4}))?$/);
    if (m) {
      const mi = DP_MONTHS_LONG.findIndex((x) => x.toLowerCase().startsWith(m[1].toLowerCase()));
      if (mi < 0) return null;
      return new Date(parseInt(m[3] || fallbackYear, 10), mi, parseInt(m[2], 10));
    }
    const s = p.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (s) return new Date(parseInt(s[3],10), parseInt(s[1],10) - 1, parseInt(s[2],10));
    return null;
  };
  if (parts.length === 1) {
    const d = parsePart(parts[0], year);
    return d ? { start: d, end: d } : null;
  }
  // For range, second part likely has the year; use it as the fallback for first.
  const second = parsePart(parts[1], year);
  const firstYear = second ? second.getFullYear() : year;
  const first = parsePart(parts[0], firstYear);
  if (first && second) return { start: first, end: second };
  return null;
}

// ---------- Quick presets ----------------------------------------------

function dpPresets() {
  const today = dpStartOfDay(new Date());
  const dow = (today.getDay() + 6) % 7; // Monday = 0
  return [
    { label: "Today",     range: { start: today, end: today } },
    { label: "Tomorrow",  range: { start: dpAddDays(today, 1), end: dpAddDays(today, 1) } },
    { label: "This week", range: { start: dpAddDays(today, -dow), end: dpAddDays(today, 6 - dow) } },
    { label: "Next week", range: { start: dpAddDays(today, 7 - dow), end: dpAddDays(today, 13 - dow) } },
    { label: "This month",range: { start: new Date(today.getFullYear(), today.getMonth(), 1), end: new Date(today.getFullYear(), today.getMonth() + 1, 0) } },
  ];
}

// ---------- Calendar grid ----------------------------------------------

function CalendarGrid({ viewMonth, range, hover, onPick, onHover }) {
  // Build a 6-week grid starting on Monday for the visible month.
  const y = viewMonth.getFullYear();
  const m = viewMonth.getMonth();
  const first = new Date(y, m, 1);
  const startOffset = (first.getDay() + 6) % 7; // Mon = 0
  const gridStart = dpAddDays(first, -startOffset);

  const cells = [];
  for (let i = 0; i < 42; i++) cells.push(dpAddDays(gridStart, i));

  // What range should we paint? Final range, or preview using hover.
  const paint = (() => {
    if (range && range.start && range.end) return { a: range.start, b: range.end };
    if (range && range.start && hover) return { a: range.start, b: hover };
    return null;
  })();

  const today = dpStartOfDay(new Date());

  return (
    <div className="dp-cal">
      <div className="dp-wkhead">
        {DP_WEEKDAYS.map((d) => <span key={d}>{d}</span>)}
      </div>
      <div className="dp-grid">
        {cells.map((d, i) => {
          const outside = d.getMonth() !== m;
          const isStart = paint && dpSameDay(d, paint.a < paint.b ? paint.a : paint.b);
          const isEnd   = paint && dpSameDay(d, paint.a < paint.b ? paint.b : paint.a);
          const inRange = paint && dpBetween(d, paint.a, paint.b);
          const isToday = dpSameDay(d, today);
          const cls =
            "dp-cell" +
            (outside ? " dp-cell--out" : "") +
            (inRange ? " dp-cell--in" : "") +
            (isStart ? " dp-cell--start" : "") +
            (isEnd   ? " dp-cell--end"   : "") +
            (isToday ? " dp-cell--today" : "");
          return (
            <button
              key={i}
              type="button"
              className={cls}
              onClick={() => onPick(d)}
              onMouseEnter={() => onHover(d)}
            >
              <span className="dp-cell-n">{d.getDate()}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ---------- DateRangePicker --------------------------------------------

function DateRangePicker({ value, onChange, placeholder = "Pick a date", allowSingle = true, small = false }) {
  // Accept either a {start,end} value or a string we can parse.
  const incoming = typeof value === "object" && value && value.start
    ? value
    : (typeof value === "string" ? parseRange(value) : null);

  const [open, setOpen] = useStateDp(false);
  const [range, setRange] = useStateDp(incoming || null);
  const [hover, setHover] = useStateDp(null);
  const [viewMonth, setViewMonth] = useStateDp(() => {
    const seed = incoming && incoming.start ? incoming.start : new Date();
    return new Date(seed.getFullYear(), seed.getMonth(), 1);
  });
  const rootRef = useRefDp(null);

  // Resync when an outside value changes.
  useEffectDp(() => {
    setRange(incoming || null);
    if (incoming && incoming.start) {
      setViewMonth(new Date(incoming.start.getFullYear(), incoming.start.getMonth(), 1));
    }
  }, [value]);

  // Click outside / Escape close
  useEffectDp(() => {
    if (!open) return;
    const onDoc = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const pick = (d) => {
    // First click: start a new selection. Second click: complete the range.
    if (!range || !range.start || (range.start && range.end)) {
      setRange({ start: d, end: null });
    } else {
      // Have a start, want an end.
      const a = range.start;
      const next = a.getTime() <= d.getTime() ? { start: a, end: d } : { start: d, end: a };
      setRange(next);
    }
  };

  const apply = () => {
    if (range && range.start) {
      const final = range.end ? range : (allowSingle ? { start: range.start, end: range.start } : null);
      if (final) {
        const formatted = formatRange(final);
        if (onChange) onChange(formatted, final);
      }
    }
    setOpen(false);
  };
  const clear = () => {
    setRange(null);
    if (onChange) onChange("", null);
  };

  const display = (range && range.start)
    ? formatRange(range.end ? range : { start: range.start, end: range.start })
    : (typeof value === "string" ? value : "");

  return (
    <div className="dp-root" ref={rootRef}>
      <div
        className={"fld-control fld-control--input dp-trigger" + (small ? " fld-control--sm" : "") + (open ? " dp-trigger--open" : "")}
        role="combobox"
        aria-haspopup="dialog"
        aria-expanded={open}
        tabIndex={0}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setOpen((o) => !o); }
        }}
      >
        <span
          className="dp-trigger-value"
          style={{ color: display ? "var(--evr-content-primary-highemp)" : "var(--evr-content-primary-lowemp)" }}
        >
          {display || placeholder}
        </span>
        <span className="fld-trail"><Icon name="Calendar" size={18} /></span>
      </div>

      {open && (
        <div className="dp-pop" role="dialog" aria-label="Choose date range">
          {/* Presets */}
          <div className="dp-presets">
            {dpPresets().map((p) => (
              <button
                key={p.label}
                type="button"
                className="dp-preset"
                onClick={() => {
                  setRange(p.range);
                  setViewMonth(new Date(p.range.start.getFullYear(), p.range.start.getMonth(), 1));
                }}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Month nav */}
          <div className="dp-navrow">
            <button
              type="button"
              className="dp-navbtn"
              aria-label="Previous month"
              onClick={() => setViewMonth((m) => dpAddMonths(m, -1))}
            >
              <Icon name="ChevronLeft" size={18} />
            </button>
            <div className="dp-month">
              {DP_MONTHS_LONG[viewMonth.getMonth()]} {viewMonth.getFullYear()}
            </div>
            <button
              type="button"
              className="dp-navbtn"
              aria-label="Next month"
              onClick={() => setViewMonth((m) => dpAddMonths(m, 1))}
            >
              <Icon name="ChevronRight" size={18} />
            </button>
          </div>

          <CalendarGrid
            viewMonth={viewMonth}
            range={range}
            hover={hover}
            onPick={pick}
            onHover={setHover}
          />

          <div className="dp-footer">
            <button
              type="button"
              className="dp-link"
              onClick={clear}
              disabled={!range}
            >
              Clear
            </button>
            <span className="dp-summary">
              {range && range.start
                ? formatRange(range.end ? range : { start: range.start, end: range.start })
                : <span style={{ color: "var(--evr-content-primary-lowemp)" }}>Pick a start date</span>}
            </span>
            <button
              type="button"
              className="btn btn--sm btn--primary"
              onClick={apply}
              disabled={!range || !range.start}
            >
              Apply
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

Object.assign(window, {
  DateRangePicker,
  formatRange,
  parseRange,
});
