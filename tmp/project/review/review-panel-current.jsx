// Faithful recreation of the EXISTING "Add schedule" (recurring) side
// panel — so reviewers can see the current state side by side.
// Annotations live as red numbered markers next to elements that the
// redesign improves.

const { useState: useStateCur } = React;

function CurrentRecurringPanel() {
  const [noEnd, setNoEnd] = useStateCur(false);
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri"];

  return (
    <div className="cur-panel rv-panel">
      <header className="rv-panel-head">
        <h2>Add schedule</h2>
        <button type="button" className="rv-panel-head-x" aria-label="Close">
          <RvIcon name="X" size={20} />
        </button>
      </header>

      <div className="rv-panel-summary rv-panel-summary--current">
        <span className="rv-panel-summary-ic">
          <RvIcon name="Repeat" size={18} />
        </span>
        <span className="rv-panel-summary-text">
          <span className="rv-panel-summary-pri">No live summary</span>
          <span className="rv-panel-summary-sec">User builds the schedule blind — no preview of dates, hours, or shift count.</span>
        </span>
      </div>

      <div className="rv-panel-body" style={{ padding: 0, gap: 0 }}>
        {/* Schedule */}
        <section className="cur-section">
          <h3>Schedule</h3>

          <div className="cur-grid-2">
            <div className="cur-field">
              <span className="cur-field-label">Start date <span className="req">*</span></span>
              <div className="cur-input">May 10, 2026 <span className="cur-input-end"><RvIcon name="Calendar" size={16} /></span></div>
            </div>
            <div className="cur-field">
              <span className="cur-field-label">End date <span className="req">*</span></span>
              <div className="cur-input">August 10, 2026 <span className="cur-input-end"><RvIcon name="Calendar" size={16} /></span></div>
            </div>
          </div>

          <label className="cur-check cur-annot" style={{ marginTop: 10 }}>
            <span className="cur-annot-mark">1</span>
            <span className="cur-check-box" />
            Remove end date
          </label>

          <div className="cur-field cur-annot" style={{ marginTop: 14 }}>
            <span className="cur-annot-mark">2</span>
            <span className="cur-field-label">Select day(s) <span className="req">*</span></span>
            <div className="cur-days">
              {["M","T","W","T","F","S","S"].map((l, i) => (
                <span
                  key={i}
                  className="cur-day"
                  aria-pressed={i < 5}
                >
                  {l}
                </span>
              ))}
            </div>
          </div>

          <div className="cur-grid-2" style={{ marginTop: 14 }}>
            <div className="cur-field cur-annot">
              <span className="cur-annot-mark">3</span>
              <span className="cur-field-label">Start time <span className="req">*</span></span>
              <div className="cur-input">7:00 AM <span className="cur-input-end"><RvIcon name="ChevronDown" size={16} /></span></div>
            </div>
            <div className="cur-field">
              <span className="cur-field-label">End time <span className="req">*</span></span>
              <div className="cur-input">4:00 PM <span className="cur-input-end"><RvIcon name="ChevronDown" size={16} /></span></div>
            </div>
          </div>

          <div className="cur-field cur-annot" style={{ marginTop: 14 }}>
            <span className="cur-annot-mark">4</span>
            <span className="cur-field-label">Cadence</span>
            <div className="cur-input">Weekly <span className="cur-input-end"><RvIcon name="ChevronDown" size={16} /></span></div>
          </div>
        </section>

        {/* Custom rules */}
        <section className="cur-section">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <h3 className="cur-annot" style={{ margin: 0, position: "relative", paddingLeft: 26 }}>
              <span className="cur-annot-mark cur-annot-mark--inline">5</span>
              Custom rules
            </h3>
            <button type="button" className="rv-btn rv-btn--secondary" style={{ height: 32, padding: "0 12px" }}>
              <RvIcon name="Plus" size={14} />Add rule
            </button>
          </div>

          <div className="cur-rule">
            <div className="cur-rule-head">
              <span className="cur-rule-title">Rule 1</span>
              <span style={{ display: "inline-flex", gap: 4 }}>
                <span className="rv-iconbtn"><RvIcon name="Copy" size={16} /></span>
                <span className="rv-iconbtn rv-iconbtn--danger"><RvIcon name="Trash" size={16} /></span>
              </span>
            </div>
            <div className="cur-field">
              <span className="cur-field-label">Type <span className="req">*</span></span>
              <div className="cur-input">Custom start time <span className="cur-input-end"><RvIcon name="ChevronDown" size={16} /></span></div>
            </div>
            <div className="cur-field">
              <span className="cur-field-label">Target <span className="req">*</span></span>
              <div className="cur-input">Job <span className="cur-input-end"><RvIcon name="ChevronDown" size={16} /></span></div>
            </div>
            <div className="cur-grid-2">
              <div className="cur-field">
                <span className="cur-field-label">Job(s)</span>
                <div className="cur-tag-input">
                  <span className="cur-tag">Line Managers <RvIcon name="X" size={10} /></span>
                </div>
              </div>
              <div className="cur-field">
                <span className="cur-field-label">Start time <span className="req">*</span></span>
                <div className="cur-input">9:00 AM <span className="cur-input-end"><RvIcon name="ChevronDown" size={16} /></span></div>
              </div>
            </div>
          </div>
        </section>

        {/* Bookings */}
        <section className="cur-section cur-annot" style={{ position: "relative" }}>
          <span className="cur-annot-mark" style={{ top: 18, left: 14 }}>6</span>
          <h3 style={{ marginLeft: 24 }}>Work assignments</h3>
          <p style={{ font: "var(--evr-body2)", color: "var(--evr-content-primary-lowemp)", margin: "-6px 0 12px 24px" }}>
            Select work assignments to apply the schedule to.
          </p>
          <div style={{ marginLeft: 0 }}>
            <span className="cur-field-label" style={{ display: "block", marginBottom: 6 }}>Work assignments</span>
            <div className="cur-tag-input">
              <span className="cur-tag">5 Packers (Regular) <RvIcon name="X" size={10} /></span>
              <span className="cur-tag">10 Pickers (Regular) <RvIcon name="X" size={10} /></span>
              <span className="cur-tag">3 Line Managers (Regular) <RvIcon name="X" size={10} /></span>
            </div>
          </div>
        </section>
      </div>

      <footer className="rv-panel-foot">
        <span />
        <div className="rv-panel-foot-right">
          <button type="button" className="rv-btn rv-btn--tertiary">Cancel</button>
          <button type="button" className="rv-btn rv-btn--primary">Save schedule</button>
        </div>
      </footer>
    </div>
  );
}

window.CurrentRecurringPanel = CurrentRecurringPanel;
