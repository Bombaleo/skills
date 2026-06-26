// Page shell — recommendations + before/after compare.

const RECOMMENDATIONS = [
  {
    num: "01",
    tag: "Comprehension",
    h: "Show a live summary chip at the top",
    p: "Today the user builds a schedule blind. A persistent summary chip (\u201cMon Wed Fri · 7:00 AM – 3:30 PM · 39 shift days · 702 worker-shifts\u201d) gives instant feedback as fields change \u2014 eliminating \u201cdid I get this right?\u201d anxiety before save.",
  },
  {
    num: "02",
    tag: "Hierarchy",
    h: "Put bookings first \u2014 the schedule has no meaning without context",
    p: "The current panel asks for dates, times, then bookings at the bottom. Flip it. Showing the bookings the schedule attaches to at the top frames every downstream decision and surfaces capacity (\u201c18 workers per shift day\u201d) in real time.",
  },
  {
    num: "03",
    tag: "Vocabulary",
    h: "Replace \u201cCadence\u201d + a confusing \u201cRemove end date\u201d checkbox",
    p: "\u201cCadence: Weekly\u201d is redundant when a weekday picker is already visible. Promote it to a top-level segmented control (Weekly · Every 2 weeks · Monthly) that actually swaps the form below. Replace the \u201cRemove end date\u201d checkbox with an explicit \u201cOngoing\u201d toggle next to the End-date field.",
  },
  {
    num: "04",
    tag: "Speed",
    h: "Quick-presets for window, days, and shift hours",
    p: "Three chip rows save 90% of taps for the 90% case: weekday/weekend/all-day; 4/8/13-week or through-quarter-end windows; and standard shifts (Day 7\u20133:30, Swing 3\u201311:30, Night 11p\u20137:30a). Power users can still type custom values.",
  },
  {
    num: "05",
    tag: "Math",
    h: "Compute hours, overnight, and break inline",
    p: "Show \u201c8h net\u201d (after break) right next to the time fields. Detect overnight shifts and surface a clear callout \u2014 the current panel quietly accepts End < Start with no feedback, which causes scheduling errors at run time.",
  },
  {
    num: "06",
    tag: "Exceptions",
    h: "Rename \u201cCustom rules\u201d to \u201cExceptions\u201d and pre-load the common ones",
    p: "Today a generic \u201cType / Target / Value\u201d form throws all the work on the user. Replace with three clearly-named buckets \u2014 Skip dates, Modify a date, Variant by role \u2014 each with a one-line summary in the list. A \u201cImport US federal holidays\u201d action covers the #1 use case in one click.",
  },
  {
    num: "07",
    tag: "Confidence",
    h: "Mini-calendar preview before save",
    p: "A 3-month calendar with color-coded dots (shift, modified, skipped) lets the user verify every generated date at a glance \u2014 catching off-by-one errors, missed holidays, and double-bookings before they reach production.",
  },
  {
    num: "08",
    tag: "Reuse",
    h: "\u201cSave as preset\u201d for recurring patterns",
    p: "Schedules like \u201cMon\u2013Fri day shift, no holidays\u201d get rebuilt every requisition. A footer link to save the current configuration as a named preset lets the next requisition pick it from a single-click chip \u2014 close to the template feature, but at schedule-level granularity.",
  },
  {
    num: "09",
    tag: "Validation",
    h: "Required-field rollup + inline conflict warnings",
    p: "When required fields are empty or conflicts exist (no days selected, end-date before start, holiday already inside window), surface a single \u201cFix 2 issues\u201d row above the footer instead of relying on a generic error after Save fails.",
  },
];

function App() {
  return (
    <div className="rv-app">
      <header className="rv-topbar">
        <span className="rv-topbar-brand">
          <span className="rv-topbar-brand-dot" />
          Dayforce Flex Work
        </span>
        <span className="rv-topbar-crumb">Design review · Recurring schedule (advanced)</span>
      </header>

      <section className="rv-hero">
        <p className="rv-hero-eyebrow">Design review</p>
        <h1>Recurring schedules need a confidence check before save.</h1>
        <p>
          The current advanced flow asks the user to build a recurring pattern across nine fields and a free-form rules engine, with
          zero feedback until they hit Save. The redesign keeps the same surface area but adds context-first ordering, a live summary,
          a 3-month preview, and named exception buckets &mdash; all in Everest.
        </p>
        <div className="rv-hero-meta">
          <div className="rv-hero-stat">
            <span className="rv-hero-stat-num">9</span>
            <span className="rv-hero-stat-label">recommendations</span>
          </div>
          <div className="rv-hero-stat">
            <span className="rv-hero-stat-num">540<span style={{ fontSize: 16, fontWeight: 400, color: "var(--evr-content-primary-lowemp)" }}>&nbsp;px</span></span>
            <span className="rv-hero-stat-label">side-panel width preserved</span>
          </div>
          <div className="rv-hero-stat">
            <span className="rv-hero-stat-num">+1</span>
            <span className="rv-hero-stat-label">section added (Preview)</span>
          </div>
          <div className="rv-hero-stat">
            <span className="rv-hero-stat-num">0</span>
            <span className="rv-hero-stat-label">new tokens introduced</span>
          </div>
        </div>
      </section>

      <div className="rv-section-bar">
        <div>
          <h2>Recommendations</h2>
          <p>Nine targeted changes, ordered by visibility &mdash; the first three a user would see within the first second of opening the panel.</p>
        </div>
      </div>

      <div className="rv-recs">
        {RECOMMENDATIONS.map((r) => (
          <article key={r.num} className="rv-rec">
            <span className="rv-rec-num">Rec {r.num}</span>
            <h3>{r.h}</h3>
            <p>{r.p}</p>
            <span className="rv-rec-tag">{r.tag}</span>
          </article>
        ))}
      </div>

      <div className="rv-section-bar" style={{ marginTop: 96 }}>
        <div>
          <h2>Side by side</h2>
          <p>Both panels render at production width (540&nbsp;px) using only existing Everest tokens.</p>
        </div>
      </div>

      <div className="rv-compare">
        <div className="rv-frame">
          <header className="rv-frame-head">
            <div className="rv-frame-head-left">
              <span className="rv-frame-label rv-frame-label--now">Current</span>
              <div>
                <p className="rv-frame-title">Add schedule (recurring)</p>
                <p className="rv-frame-sub">Pages &rarr; new-requisition &rarr; Schedules &rarr; Advanced</p>
              </div>
            </div>
            <span style={{ font: "var(--evr-caption)", color: "var(--evr-content-primary-lowemp)" }}>
              <span style={{ display: "inline-grid", placeItems: "center", width: 16, height: 16, background: "var(--evr-content-status-error-default)", color: "white", borderRadius: "50%", fontSize: 9, fontWeight: 700, marginRight: 6, verticalAlign: "middle" }}>i</span>
              6 issues flagged
            </span>
          </header>
          <div className="rv-frame-body">
            <CurrentRecurringPanel />
          </div>
        </div>

        <div className="rv-frame">
          <header className="rv-frame-head">
            <div className="rv-frame-head-left">
              <span className="rv-frame-label rv-frame-label--new">Redesign</span>
              <div>
                <p className="rv-frame-title">Edit recurring schedule</p>
                <p className="rv-frame-sub">Interactive &mdash; try the segmented control, presets, and toggles.</p>
              </div>
            </div>
            <span style={{ font: "var(--evr-caption)", color: "var(--evr-content-primary-lowemp)" }}>
              <span style={{ display: "inline-grid", placeItems: "center", width: 16, height: 16, background: "var(--evr-interactive-success-default)", color: "white", borderRadius: "50%", fontSize: 9, fontWeight: 700, marginRight: 6, verticalAlign: "middle" }}>&#10003;</span>
              Live summary + preview
            </span>
          </header>
          <div className="rv-frame-body">
            <NewRecurringPanel />
          </div>
        </div>
      </div>

      <p className="rv-foot-note">
        <span className="rv-foot-note-ic"><RvIcon name="Info" size={14} /></span>
        Both panels render the same data structure on save (start, end, days, times, breaks, exceptions, booking refs); the redesign is purely a UI-layer change &mdash; safe to roll out behind a feature flag with no schema migration required.
      </p>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
