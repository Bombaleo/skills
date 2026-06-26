// Redesigned "Recurring schedule" side panel — addresses the issues
// raised in the review. Everest-styled; consumes tokens.css.

const { useState: useStateNw, useMemo: useMemoNw } = React;

// Compute # of shift days between start/end given selected weekdays.
// Approximate: weeks-between × #days-selected, capped at 365 if "ongoing".
function countShiftDays(days, ongoing) {
  if (!days.length) return 0;
  if (ongoing) return 0; // unknown
  // From May 11 → Aug 10 (mock) = ~13 weeks
  const weeks = 13;
  return weeks * days.length;
}

const DAY_ORDER = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
function formatDays(days) {
  const sorted = DAY_ORDER.filter((d) => days.includes(d));
  if (sorted.length === 7) return "Every day";
  if (sorted.join() === "Mon,Tue,Wed,Thu,Fri") return "Weekdays";
  if (sorted.join() === "Sat,Sun") return "Weekends";
  if (sorted.length === 0) return "No days yet";
  return sorted.map((d) => d.slice(0, 3)).join(", ");
}

// Parse "7:00 AM" -> minutes from midnight.
function parseTime(t) {
  const m = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec(t || "");
  if (!m) return null;
  let h = parseInt(m[1], 10) % 12;
  if (m[3].toUpperCase() === "PM") h += 12;
  return h * 60 + parseInt(m[2], 10);
}
function durationLabel(start, end, breakMin = 0) {
  const a = parseTime(start);
  const b = parseTime(end);
  if (a == null || b == null) return "—";
  let diff = b - a;
  let overnight = false;
  if (diff <= 0) { diff += 24 * 60; overnight = true; }
  const net = diff - breakMin;
  const h = Math.floor(net / 60);
  const m = net % 60;
  return { text: `${h}h${m ? ` ${m}m` : ""}${breakMin ? ` net` : ""}`, overnight };
}

// --------------------------------------------------------------------
// New panel
// --------------------------------------------------------------------
function NewRecurringPanel() {
  const [recurrence, setRecurrence] = useStateNw("weekly");
  const [days, setDays] = useStateNw(["Mon", "Wed", "Fri"]);
  const [ongoing, setOngoing] = useStateNw(false);
  const [startDate, setStartDate] = useStateNw("May 11, 2026");
  const [endDate, setEndDate] = useStateNw("Aug 10, 2026");
  const [windowPreset, setWindowPreset] = useStateNw("13wk");
  const [startTime, setStartTime] = useStateNw("7:00 AM");
  const [endTime, setEndTime] = useStateNw("3:30 PM");
  const [breakMin, setBreakMin] = useStateNw(30);
  const [shiftPreset, setShiftPreset] = useStateNw("day");
  const [exceptions, setExceptions] = useStateNw([
    { id: 1, type: "skip", title: "Skip Memorial Day", sub: "Mon · May 25, 2026" },
    { id: 2, type: "modify", title: "Late start on Wednesdays", sub: "Start 9:00 AM (all jobs)" },
    { id: 3, type: "variant", title: "Line Managers arrive earlier", sub: "Start 6:30 AM · Mon, Wed, Fri" },
  ]);
  const [selectedBookings, setSelectedBookings] = useStateNw([1, 2, 3]);

  const dur = durationLabel(startTime, endTime, breakMin);
  const shiftCount = countShiftDays(days, ongoing);

  // Bookings catalog
  const BK = [
    { id: 1, title: "Work assignment 1 · 5 Packers",         sub: "Regular shift",   cap: 5 },
    { id: 2, title: "Work assignment 2 · 10 Pickers",        sub: "Regular shift",   cap: 10 },
    { id: 3, title: "Work assignment 3 · 3 Line Managers",   sub: "Regular shift",   cap: 3 },
  ];
  const workersPerShift = BK
    .filter((b) => selectedBookings.includes(b.id))
    .reduce((acc, b) => acc + b.cap, 0);

  const setPreset = (preset) => {
    setShiftPreset(preset);
    if (preset === "day")    { setStartTime("7:00 AM");  setEndTime("3:30 PM"); }
    if (preset === "swing")  { setStartTime("3:00 PM");  setEndTime("11:30 PM"); }
    if (preset === "night")  { setStartTime("11:00 PM"); setEndTime("7:30 AM"); }
  };

  const setWindow = (preset) => {
    setWindowPreset(preset);
    setOngoing(false);
    // For demo: just update the end-date label
    if (preset === "4wk")  setEndDate("June 8, 2026");
    if (preset === "8wk")  setEndDate("July 6, 2026");
    if (preset === "13wk") setEndDate("Aug 10, 2026");
    if (preset === "qtr")  setEndDate("June 30, 2026");
  };

  // Calendar preview: 3 months (May, June, July 2026 demo) — shows
  // which dates produce shifts based on selected days.
  const months = [
    { name: "May 2026",  year: 2026, monthIdx: 4, days: 31, startDow: 4 /* Fri=4 with 0=Mon */ },
    { name: "Jun 2026",  year: 2026, monthIdx: 5, days: 30, startDow: 0 },
    { name: "Jul 2026",  year: 2026, monthIdx: 6, days: 31, startDow: 2 },
  ];
  const DOW = ["M","T","W","T","F","S","S"];
  const DAY_IDX = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 };
  // Pre-compute which calendar cells are shift / mod / skip.
  const dayIdxSet = new Set(days.map((d) => DAY_IDX[d]));

  return (
    <div className="rv-panel">
      <header className="rv-panel-head">
        <h2>Edit recurring schedule</h2>
        <button type="button" className="rv-panel-head-x" aria-label="Close">
          <RvIcon name="X" size={20} />
        </button>
      </header>

      {/* Live summary chip */}
      <div className="rv-panel-summary">
        <span className="rv-panel-summary-ic">
          <RvIcon name="Repeat" size={18} />
        </span>
        <span className="rv-panel-summary-text">
          <span className="rv-panel-summary-pri">
            {formatDays(days)} · {startTime} – {endTime}
            {dur.overnight && <span style={{
              marginLeft: 8,
              padding: "1px 6px",
              borderRadius: 4,
              fontSize: 10,
              background: "var(--evr-purple-100)",
              color: "var(--evr-purple-500)",
              letterSpacing: "0.05em",
            }}>OVERNIGHT</span>}
          </span>
          <span className="rv-panel-summary-sec">
            {ongoing ? `Ongoing from ${startDate}` : `${startDate} → ${endDate}`}
            {" · "}
            {ongoing
              ? "open-ended"
              : `${shiftCount - exceptions.filter(e => e.type === "skip").length} shift days · ${workersPerShift * (shiftCount - exceptions.filter(e => e.type === "skip").length)} worker-shifts`}
          </span>
        </span>
      </div>

      <div className="rv-panel-body">

        {/* ---------- Apply to bookings (moved to top — context first) */}
        <section className="rv-section">
          <div className="rv-section-head">
            <h3 className="rv-section-h">Apply to bookings</h3>
            <span className="rv-section-aside">{selectedBookings.length} of {BK.length} selected</span>
          </div>
          <ul className="rv-bk-list" style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {BK.map((b) => {
              const on = selectedBookings.includes(b.id);
              return (
                <li
                  key={b.id}
                  className={"rv-bk-pill" + (on ? " rv-bk-pill--on" : "")}
                  onClick={() =>
                    setSelectedBookings((cur) =>
                      on ? cur.filter((x) => x !== b.id) : [...cur, b.id]
                    )
                  }
                >
                  <span className="rv-bk-pill-check">
                    {on && <RvIcon name="Check" size={12} style={{ color: "white" }} />}
                  </span>
                  <span className="rv-bk-pill-text">
                    <span className="rv-bk-pill-pri">{b.title}</span>
                    <span className="rv-bk-pill-sec">{b.sub}</span>
                  </span>
                  <span className="rv-bk-pill-cap">{b.cap}/shift</span>
                </li>
              );
            })}
          </ul>
          <div className="rv-roll">
            <RvIcon name="People" size={16} />
            <span>
              <strong>{workersPerShift} workers</strong> per scheduled shift day
              {selectedBookings.length > 0 && (
                <span style={{ color: "var(--evr-content-primary-lowemp)" }}>
                  {" "}· covers {selectedBookings.length} booking{selectedBookings.length !== 1 ? "s" : ""}
                </span>
              )}
            </span>
          </div>
        </section>

        <hr className="rv-divider" />

        {/* ---------- Pattern ------------------------------------------ */}
        <section className="rv-section">
          <div className="rv-section-head">
            <h3 className="rv-section-h">Pattern</h3>
            <span className="rv-section-aside">How often the shift repeats</span>
          </div>

          <RvSeg
            options={[
              { value: "weekly",    label: "Weekly" },
              { value: "biweekly",  label: "Every 2 weeks" },
              { value: "monthly",   label: "Monthly" },
            ]}
            value={recurrence}
            onChange={setRecurrence}
          />

          {recurrence === "weekly" && (
            <React.Fragment>
              <RvField label="Days" required aside={
                <div className="rv-chips" style={{ margin: 0 }}>
                  <button
                    type="button"
                    className="rv-chip"
                    aria-pressed={days.join() === "Mon,Tue,Wed,Thu,Fri"}
                    onClick={() => setDays(["Mon","Tue","Wed","Thu","Fri"])}
                  >Weekdays</button>
                  <button
                    type="button"
                    className="rv-chip"
                    aria-pressed={days.join() === "Sat,Sun"}
                    onClick={() => setDays(["Sat","Sun"])}
                  >Weekends</button>
                  <button
                    type="button"
                    className="rv-chip"
                    aria-pressed={days.length === 7}
                    onClick={() => setDays(["Mon","Tue","Wed","Thu","Fri","Sat","Sun"])}
                  >Every day</button>
                </div>
              }>
                <RvDays selected={days} onChange={setDays} />
              </RvField>
            </React.Fragment>
          )}

          {recurrence === "biweekly" && (
            <React.Fragment>
              <RvField label="Days (in each on-week)" required>
                <RvDays selected={days} onChange={setDays} />
              </RvField>
              <RvField label="On-week starts" hint="Week 1 begins May 11. Off-weeks generate no shifts.">
                <RvInput value="Week of May 11, 2026" end={<RvIcon name="Calendar" size={16} />} />
              </RvField>
            </React.Fragment>
          )}

          {recurrence === "monthly" && (
            <React.Fragment>
              <RvSeg
                value="weekday"
                onChange={() => {}}
                options={[
                  { value: "weekday", label: "Nth weekday" },
                  { value: "dom",     label: "Day of month" },
                ]}
              />
              <div className="rv-grid-2">
                <RvField label="Occurrence">
                  <RvInput value="1st & 3rd" end={<RvIcon name="ChevronDown" size={16} />} />
                </RvField>
                <RvField label="Weekday">
                  <RvInput value="Monday" end={<RvIcon name="ChevronDown" size={16} />} />
                </RvField>
              </div>
            </React.Fragment>
          )}
        </section>

        <hr className="rv-divider" />

        {/* ---------- Window ------------------------------------------ */}
        <section className="rv-section">
          <div className="rv-section-head">
            <h3 className="rv-section-h">Window</h3>
            <RvToggle checked={ongoing} onChange={(v) => { setOngoing(v); if (v) setEndDate(""); }}>
              Ongoing
            </RvToggle>
          </div>

          <div className="rv-grid-2">
            <RvField label="Start date" required>
              <RvInput value={startDate} end={<RvIcon name="Calendar" size={16} />} />
            </RvField>
            <RvField
              label="End date"
              required={!ongoing}
              hint={ongoing ? "Shifts will keep generating until you end the schedule." : undefined}
            >
              {ongoing ? (
                <div className="rv-input" style={{ display: "flex", alignItems: "center", color: "var(--evr-content-primary-lowemp)", background: "var(--evr-surface-secondary-default)" }}>
                  No end date
                </div>
              ) : (
                <RvInput value={endDate} end={<RvIcon name="Calendar" size={16} />} />
              )}
            </RvField>
          </div>

          {!ongoing && (
            <div className="rv-chips">
              <button type="button" className="rv-chip" aria-pressed={windowPreset === "4wk"}  onClick={() => setWindow("4wk")}>4 weeks</button>
              <button type="button" className="rv-chip" aria-pressed={windowPreset === "8wk"}  onClick={() => setWindow("8wk")}>8 weeks</button>
              <button type="button" className="rv-chip" aria-pressed={windowPreset === "13wk"} onClick={() => setWindow("13wk")}>13 weeks</button>
              <button type="button" className="rv-chip" aria-pressed={windowPreset === "qtr"}  onClick={() => setWindow("qtr")}>Through end of Q2</button>
            </div>
          )}
        </section>

        <hr className="rv-divider" />

        {/* ---------- Hours ------------------------------------------- */}
        <section className="rv-section">
          <div className="rv-section-head">
            <h3 className="rv-section-h">Shift hours</h3>
            <RvComputed icon="Clock">
              <strong>{typeof dur === "object" ? dur.text : dur}</strong>
              <span style={{ color: "var(--evr-content-primary-lowemp)" }}>per shift</span>
            </RvComputed>
          </div>

          <div className="rv-chips">
            <button type="button" className="rv-chip" aria-pressed={shiftPreset === "day"}    onClick={() => setPreset("day")}>Day · 7am–3:30pm</button>
            <button type="button" className="rv-chip" aria-pressed={shiftPreset === "swing"}  onClick={() => setPreset("swing")}>Swing · 3pm–11:30pm</button>
            <button type="button" className="rv-chip" aria-pressed={shiftPreset === "night"}  onClick={() => setPreset("night")}>Night · 11pm–7:30am</button>
          </div>

          <div className="rv-grid-3">
            <RvField label="Start time" required>
              <RvInput value={startTime} end={<RvIcon name="ChevronDown" size={16} />} />
            </RvField>
            <RvField label="End time" required>
              <RvInput value={endTime} end={<RvIcon name="ChevronDown" size={16} />} />
            </RvField>
            <RvField label="Break (min)" hint="Unpaid">
              <RvInput value={String(breakMin)} end={<RvIcon name="ChevronDown" size={16} />} />
            </RvField>
          </div>

          {dur.overnight && (
            <div className="rv-roll" style={{ background: "var(--evr-surface-decorative-low-purple)" }}>
              <RvIcon name="Info" size={16} />
              <span>
                <strong>Overnight shift</strong> — the end time falls on the next calendar day. Schedule counts each shift on its start date.
              </span>
            </div>
          )}
        </section>

        <hr className="rv-divider" />

        {/* ---------- Exceptions -------------------------------------- */}
        <section className="rv-section">
          <div className="rv-section-head">
            <h3 className="rv-section-h">Exceptions</h3>
            <span className="rv-section-aside">{exceptions.length} active</span>
          </div>

          <div className="rv-exc-actions">
            <button type="button" className="rv-exc-action">
              <RvIcon name="Block" size={14} />Skip dates
            </button>
            <button type="button" className="rv-exc-action">
              <RvIcon name="Clock" size={14} />Modify a date
            </button>
            <button type="button" className="rv-exc-action">
              <RvIcon name="People" size={14} />Variant by role
            </button>
          </div>

          <ul className="rv-exc-list">
            {exceptions.map((ex) => (
              <li key={ex.id} className="rv-exc-item">
                <span className={"rv-exc-item-ic rv-exc-item-ic--" + ex.type}>
                  <RvIcon name={ex.type === "skip" ? "Block" : ex.type === "modify" ? "Clock" : "People"} size={14} />
                </span>
                <span className="rv-exc-item-text">
                  <span className="rv-exc-item-pri">{ex.title}</span>
                  <span className="rv-exc-item-sec">{ex.sub}</span>
                </span>
                <span className="rv-exc-item-actions">
                  <button type="button" className="rv-iconbtn" aria-label="Edit">
                    <RvIcon name="Pencil" size={14} />
                  </button>
                  <button type="button" className="rv-iconbtn rv-iconbtn--danger" aria-label="Delete" onClick={() => setExceptions((es) => es.filter((e) => e.id !== ex.id))}>
                    <RvIcon name="Trash" size={14} />
                  </button>
                </span>
              </li>
            ))}
          </ul>

          <button type="button" className="rv-holiday-link">
            <RvIcon name="Sparkles" size={14} />Import US federal holidays for 2026 (11 dates)
          </button>
        </section>

        <hr className="rv-divider" />

        {/* ---------- Preview ----------------------------------------- */}
        <section className="rv-section">
          <div className="rv-section-head">
            <h3 className="rv-section-h">Preview</h3>
            <button type="button" className="rv-btn rv-btn--link">
              <RvIcon name="Eye" size={14} />Open full calendar
            </button>
          </div>

          <div className="rv-preview">
            <div className="rv-preview-head">
              <span className="rv-preview-title">
                <span className="rv-preview-title-pri">
                  {Math.max(0, shiftCount - 1)} shift days · {workersPerShift * Math.max(0, shiftCount - 1)} worker-shifts
                </span>
                <span className="rv-preview-title-sec">First shift Mon, May 11 · Last shift Mon, Aug 10</span>
              </span>
              <span className="rv-preview-legend">
                <span><span className="rv-preview-legend-dot rv-pl-dot--shift" />Shift</span>
                <span><span className="rv-preview-legend-dot rv-pl-dot--mod" />Modified</span>
                <span><span className="rv-preview-legend-dot rv-pl-dot--skip" />Skip</span>
              </span>
            </div>

            <div className="rv-mini-cal">
              {months.map((m, mi) => (
                <div key={mi} className="rv-mini-month">
                  <div className="rv-mini-month-h">{m.name}</div>
                  <div className="rv-mini-grid">
                    {DOW.map((d, i) => <div key={"h"+i} className="rv-mini-dow">{d}</div>)}
                    {Array.from({ length: m.startDow }).map((_, i) => (
                      <div key={"empty"+i} className="rv-mini-cell rv-mini-cell--out"></div>
                    ))}
                    {Array.from({ length: m.days }).map((_, di) => {
                      const day = di + 1;
                      const dow = (m.startDow + di) % 7;
                      const isShift = dayIdxSet.has(dow);
                      // Mock: May 25 is "skip" (Memorial Day)
                      const isSkip = m.monthIdx === 4 && day === 25;
                      // Mock: Wednesdays in June are "modified"
                      const isMod = isShift && m.monthIdx === 5 && dow === 2;
                      // Schedule starts May 11; July is still in the
                      // window so don't cut its tail.
                      const beforeStart = m.monthIdx === 4 && day < 11;
                      const off = beforeStart;
                      let cls = "rv-mini-cell";
                      if (off) cls += " rv-mini-cell--out";
                      else if (isSkip) cls += " rv-mini-cell--skip";
                      else if (isMod) cls += " rv-mini-cell--mod";
                      else if (isShift) cls += " rv-mini-cell--shift";
                      return (
                        <div key={"d"+di} className={cls}>{day}</div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>

      <footer className="rv-panel-foot">
        <button type="button" className="rv-btn rv-btn--link">
          <RvIcon name="Save" size={14} />Save as preset
        </button>
        <div className="rv-panel-foot-right">
          <button type="button" className="rv-btn rv-btn--tertiary">Cancel</button>
          <button type="button" className="rv-btn rv-btn--primary">Save schedule</button>
        </div>
      </footer>
    </div>
  );
}

window.NewRecurringPanel = NewRecurringPanel;
