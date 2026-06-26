// Small interactive controls used by the redesigned panel.

const { useState: useStateRv, useMemo: useMemoRv } = React;

// Segmented control --------------------------------------------------
function RvSeg({ options, value, onChange }) {
  return (
    <div className="rv-seg" role="tablist">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="tab"
          aria-pressed={o.value === value}
          className="rv-seg-btn"
          onClick={() => onChange && onChange(o.value)}
        >
          {o.icon && <RvIcon name={o.icon} size={14} />}
          {o.label}
        </button>
      ))}
    </div>
  );
}

// Chip row (single OR multi select) ----------------------------------
function RvChip({ children, active, onClick }) {
  return (
    <button type="button" className="rv-chip" aria-pressed={!!active} onClick={onClick}>
      {children}
    </button>
  );
}

// Day pills ----------------------------------------------------------
const DAY_LIST = [
  { key: "Mon", letter: "M" },
  { key: "Tue", letter: "T" },
  { key: "Wed", letter: "W" },
  { key: "Thu", letter: "T" },
  { key: "Fri", letter: "F" },
  { key: "Sat", letter: "S" },
  { key: "Sun", letter: "S" },
];
function RvDays({ selected, onChange, perDayCount }) {
  return (
    <div className="rv-days">
      {DAY_LIST.map((d) => {
        const on = selected.includes(d.key);
        return (
          <button
            key={d.key}
            type="button"
            className="rv-day"
            aria-pressed={on}
            onClick={() =>
              onChange(on ? selected.filter((x) => x !== d.key) : [...selected, d.key])
            }
          >
            <span className="rv-day-letter">{d.letter}</span>
            {perDayCount && <span className="rv-day-count">{perDayCount[d.key] || 0}</span>}
          </button>
        );
      })}
    </div>
  );
}

// Toggle -------------------------------------------------------------
function RvToggle({ checked, onChange, children }) {
  return (
    <label
      className={"rv-toggle" + (checked ? " rv-toggle--on" : "")}
      onClick={(e) => { e.preventDefault(); onChange && onChange(!checked); }}
    >
      <span className="rv-toggle-track" aria-hidden="true">
        <span className="rv-toggle-thumb" />
      </span>
      <span>{children}</span>
    </label>
  );
}

// Computed pill ------------------------------------------------------
function RvComputed({ icon, children }) {
  return (
    <span className="rv-computed">
      {icon && <RvIcon name={icon} size={14} />}
      {children}
    </span>
  );
}

// Field --------------------------------------------------------------
function RvField({ label, required, hint, children, aside }) {
  return (
    <div className="rv-field">
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
        <span className="rv-field-label">
          {label}
          {required && <span className="req">*</span>}
        </span>
        {aside}
      </div>
      {children}
      {hint && <span className="rv-field-hint">{hint}</span>}
    </div>
  );
}

// Input fakery (read-only string display in input shell) -------------
function RvInput({ value, placeholder, end }) {
  return (
    <div className="rv-input-with-icon">
      <input className="rv-input" value={value || ""} placeholder={placeholder || ""} readOnly />
      {end && <span className="rv-input-with-icon-end">{end}</span>}
    </div>
  );
}

window.RvSeg = RvSeg;
window.RvChip = RvChip;
window.RvDays = RvDays;
window.RvToggle = RvToggle;
window.RvComputed = RvComputed;
window.RvField = RvField;
window.RvInput = RvInput;
