// =====================================================================
// Flex Work — New Requisition (Create + Review)
// Tweaks let you flip Create between Default (empty) and Multi-day-multi-
// location (filled), and open each side panel.
// =====================================================================

const { useState: useStateNr, useMemo: useMemoNr, useEffect: useEffectNr, useRef: useRefNr } = React;

// TimeInput — typeable combobox for clock times. Free-types any value
// (so off-grid times like "7:35 AM" still flow through) AND shows a
// filtered popover of canonical 15-minute suggestions, styled to match
// the rest of the form. Replaces the previous native <datalist>, which
// browsers render inconsistently — Chrome on macOS in particular
// rendered the suggestion list at near-viewport width.
function TimeInput({ value, onChange, placeholder = "e.g. 6:00 AM", small = true }) {
  const [open, setOpen] = useStateNr(false);
  const rootRef = useRefNr(null);

  useEffectNr(() => {
    if (!open) return;
    const onDoc = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {if (e.key === "Escape") setOpen(false);};
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Filter suggestions by what's typed. Empty input shows the full list.
  const filtered = useMemoNr(() => {
    const q = (value || "").trim().toLowerCase();
    if (!q) return TIME_OPTIONS;
    return TIME_OPTIONS.filter((t) => t.toLowerCase().includes(q));
  }, [value]);

  return (
    <div className="ms-root" ref={rootRef}>
      <div
        className={"fld-control fld-control--input" + (small ? " fld-control--sm" : "") + (open ? " ms-trigger--open" : "")}>
        
        <input
          type="text"
          className="fld-input"
          value={value || ""}
          placeholder={placeholder}
          onChange={(e) => {onChange && onChange(e.target.value);if (!open) setOpen(true);}}
          onFocus={() => setOpen(true)}
          aria-autocomplete="list"
          aria-expanded={open} />
        
        <span
          className="fld-trail"
          onMouseDown={(e) => {e.preventDefault();setOpen((o) => !o);}}
          style={{ cursor: "pointer" }}>
          
          <Icon
            name="ChevronDown"
            size={18}
            style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform 150ms cubic-bezier(0.4,0,0.2,1)" }} />
          
        </span>
      </div>
      {open && filtered.length > 0 &&
      <div className="ms-menu" role="listbox">
          {filtered.map((opt) =>
        <button
          type="button"
          key={opt}
          role="option"
          aria-selected={opt === value}
          className={"ms-menu-item" + (opt === value ? " ms-menu-item--selected" : "")}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {onChange && onChange(opt);setOpen(false);}}>
          
              <span className="ms-menu-item-label">{opt}</span>
            </button>
        )}
        </div>
      }
    </div>);

}

// ---------- Booking row (filled state) ---------------------------------

function BookingRow({ index, qty, job, locations, options, jobOptions, onEdit, onRemove, onJobChange, onQtyChange, onLocationsChange, onClearLocations, unitLabel = "Sites", unitPlural = "sites", unitFieldLabel = "Sites", unitVisible = true }) {
  // Quantity accepts any positive integer typed by the user — no upper limit.
  const handleQty = (val) => {
    if (val === "") {onQtyChange && onQtyChange("");return;}
    const n = parseInt(String(val).replace(/[^0-9]/g, ""), 10);
    if (Number.isFinite(n) && n > 0) onQtyChange && onQtyChange(n);
  };
  const noLocationOptions = !options || options.length === 0;
  return (
    <div className="bk-row">
      <div className="bk-row-head">
        <span className="bk-row-title">Work assignment {index}</span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
          <button type="button" className="bk-row-advanced" onClick={onEdit}>
            <Icon name="Settings" size={14} />
            <span className="bk-row-advanced-label">Advanced</span>
          </button>
          {onRemove &&
          <button
            type="button"
            className="icon-btn"
            aria-label={`Remove work assignment ${index}`}
            title="Remove work assignment"
            onClick={onRemove}>
            
              <Icon name="TrashCan" size={16} />
            </button>
          }
        </span>
      </div>
      <div className="bk-row-grid" style={unitVisible ? undefined : { gridTemplateColumns: "110px minmax(220px, 1fr)" }}>
        <Field label="Quantity" required>
          <TextInput value={String(qty ?? "")} onChange={handleQty} small placeholder="1" />
        </Field>
        <Field label="Job" required>
          <JobPicker
            value={job}
            onChange={onJobChange}
            placeholder="Select a job"
            small />
          
        </Field>
        {unitVisible &&
        <Field
          label={unitFieldLabel}
          required
          hint={noLocationOptions ? `Pick at least one ${unitLabel.toLowerCase()} in Setup above to choose from here.` : undefined}
          action={!noLocationOptions &&
          <button type="button" className="fld-clear-all" onClick={onClearLocations}>
              Clear all
            </button>
          }>
          
          <MultiSelect
            options={options || []}
            value={locations}
            onChange={onLocationsChange}
            placeholder={noLocationOptions ? `Add Setup ${unitPlural} first` : `Select ${unitPlural}`}
            small />
          
        </Field>
        }
      </div>

      {/* Rate range moved into the Advanced side-panel (Time & materials,
            Rate range, Workflow live together in one Advanced surface). */}
    </div>);

}

// ---------- Schedule row (filled state) --------------------------------

function ScheduleRow({ index, dates, start, end, bookings, customized, options, timeOptions, onEdit, onRemove, onDatesChange, onStartChange, onEndChange, onBookingsChange, onClearBookings }) {
  return (
    <div className="bk-row">
      <div className="bk-row-head">
        <span className="bk-row-title">Schedule {index}</span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
          <button type="button" className="bk-row-advanced" onClick={onEdit}>
            <Icon name="Settings" size={14} />
            <span className="bk-row-advanced-label">Advanced</span>
          </button>
          {onRemove &&
          <button
            type="button"
            className="icon-btn"
            aria-label={`Remove schedule ${index}`}
            title="Remove schedule"
            onClick={onRemove}>
            
              <Icon name="TrashCan" size={16} />
            </button>
          }
        </span>
      </div>
      <div className="sch-row-grid">
        <Field label="Date(s)" required>
          <DateRangePicker
            value={dates}
            onChange={(formatted) => onDatesChange && onDatesChange(formatted)}
            placeholder="Pick date(s)"
            small />
          
        </Field>
        <Field label="Start time">
          <TimeInput value={start} onChange={onStartChange} placeholder="Optional" />
        </Field>
        <Field label="End time">
          <TimeInput value={end} onChange={onEndChange} placeholder="Optional" />
        </Field>
        <Field
          label="Work assignments"
          required
          action={
          <button type="button" className="fld-clear-all" onClick={onClearBookings}>
              Clear all
            </button>
          }>
          
          <MultiSelect
            options={options}
            value={bookings}
            onChange={onBookingsChange}
            placeholder="Select work assignments"
            small />
          
        </Field>
      </div>
      {customized &&
      <Banner inline title="Customization applied" action={{ label: "View" }}>
          Limited to 2 locations
        </Banner>
      }
    </div>);

}

// ---------- Priority row in Distribution -------------------------------

function PriorityRow({ rank, supplierId, workers, onOpenAgency }) {
  const supplier = REQ_SUPPLIERS[supplierId];
  return (
    <div className="prio-row">
      <span className={"prio-badge" + (workers === 0 ? " prio-badge--off" : "")}>{rank}</span>
      <span className="prio-supplier">
        <ReqSupplierChip id={supplierId} size={28} />
        {supplier.label}
      </span>
      {workers > 0 ?
      <button
        type="button"
        className="prio-meta"
        onClick={() => onOpenAgency && onOpenAgency(supplierId)}
        aria-label={`Edit ${workers} selected workers from ${supplier.label}`}>
        
          <ReqSupplierStack
          ids={
          workers === 1 ?
          [supplierId] :
          workers === 2 ?
          [supplierId, supplierId] :
          [supplierId, supplierId, supplierId]
          } />
        
          {workers} worker{workers === 1 ? "" : "s"} selected
          <Icon name="ChevronRight" size={16} />
        </button> :

      <button
        type="button"
        className="prio-meta prio-meta--empty"
        onClick={() => onOpenAgency && onOpenAgency(supplierId)}>
        
          <Icon name="AddCircle" size={16} />
          Select workers
        </button>
      }
    </div>);

}

// ---------- New requisition: omnibar back header ----------------------

function ReqOmnibar({ title, subtitle, status, onBack, actions }) {
  return (
    <div className="omnibar omnibar--back" role="region" aria-label={`${title} header`}>
      <button type="button" className="omnibar-back" onClick={onBack} aria-label="Back">
        <Icon name="ArrowLeft" size={24} />
      </button>
      <div className="omnibar-textstack">
        <div className="omnibar-titlerow">
          <h1 className="omnibar-title">{title}</h1>
          {status}
        </div>
        {subtitle && <p className="omnibar-sub">{subtitle}</p>}
      </div>
      {actions && <div className="omnibar-actions">{actions}</div>}
    </div>);

}

// ---------- Page: Create requisition -----------------------------------

const _locNr = (s) => window.localize ? window.localize(s) : s;
const _locNrArr = (a) => a.map(_locNr);

const DEFAULT_LOCATIONS = _locNrArr(["Manufacturing A", "Manufacturing B", "Manufacturing C", "Manufacturing D", "Manufacturing E"]);
const DEFAULT_BOOKINGS = [
{ id: 1, quantity: 3, job: _locNr("Production Line Associate"), locations: DEFAULT_LOCATIONS },
{ id: 2, quantity: 5, job: _locNr("Pickers"), locations: _locNrArr(["Manufacturing A", "Manufacturing B"]) }];

const DEFAULT_SCHEDULES = [
{ id: 1, dates: "May 10 – May 13", start: "6:00 AM", end: "3:00 PM", bookings: ["Work assignment 1", "Work assignment 2"] },
{ id: 2, dates: "May 17 – May 23", start: "7:35 AM", end: "4:45 PM", bookings: ["Work assignment 1", "Work assignment 2"], customized: true }];


const FRONTLINE_JOB_OPTIONS = _locNrArr([
"Production Associate",
"Production Line Associate",
"Pickers",
"Packers",
"Forklift Operator",
"Warehouse Associate",
"Material Handler",
"Quality Inspector",
"Machine Operator",
"Line Managers",
"Sorter",
"Loader / Unloader"]
);

// Professional catalog — added to job pickers when the `professionalJobTypes`
// feature flag is on. Layered on top of the Frontline list; the order in
// the picker is Professional first, then Frontline.
const PROFESSIONAL_JOB_OPTIONS = _locNrArr([
"Software Engineer",
"Senior Software Engineer",
"Engineering Manager",
"Product Manager",
"Project Manager",
"Business Analyst",
"Data Analyst",
"Data Scientist",
"UX Designer",
"Product Designer",
"DevOps Engineer",
"QA Engineer",
"Financial Analyst",
"Marketing Manager",
"HR Business Partner",
"Operations Manager"]
);

// Compose the active job catalog from the current org's Jobs
// configuration (per-org categories + per-category lists, both stored
// in pages/jobs-config.jsx). When jobs-config.jsx isn't loaded (very
// old bundle) we fall back to the legacy single-flag behavior so the
// surface never goes blank.
function getJobOptions() {
  if (typeof window !== "undefined" && typeof window.getActiveJobOptions === "function") {
    return window.getActiveJobOptions();
  }
  const proOn = (typeof window !== "undefined" && window.getFeatureFlag)
    ? window.getFeatureFlag("professionalJobTypes")
    : false;
  return proOn
    ? [...PROFESSIONAL_JOB_OPTIONS, ...FRONTLINE_JOB_OPTIONS]
    : FRONTLINE_JOB_OPTIONS;
}
// Returns the live list for one category. Reads from jobs-config.jsx
// when available; falls back to the seed arrays so old bundles render.
function getJobOptionsForCategory(category) {
  if (typeof window !== "undefined" && typeof window.getJobsList === "function") {
    return window.getJobsList(null, category);
  }
  return category === "professional" ? PROFESSIONAL_JOB_OPTIONS : FRONTLINE_JOB_OPTIONS;
}
if (typeof window !== "undefined") {
  window.getJobOptions = getJobOptions;
  window.FRONTLINE_JOB_OPTIONS = FRONTLINE_JOB_OPTIONS;
  window.PROFESSIONAL_JOB_OPTIONS = PROFESSIONAL_JOB_OPTIONS;
}// Backwards-compat — older surfaces reference bare `JOB_OPTIONS`. Kept
// as the Frontline-only catalog; surfaces that should grow with the
// professionalJobTypes flag should call getJobOptions() at render time.
const JOB_OPTIONS = FRONTLINE_JOB_OPTIONS;

// ---------------------------------------------------------------------
// JobPicker — Dropdown variant with a Frontline / Professional family
// filter row at the top of the menu. The filter row only renders when
// the `professionalJobTypes` feature flag is on; flag-off it behaves
// byte-identically to the plain Dropdown over the Frontline catalog.
// ---------------------------------------------------------------------
function JobPicker({ value, onChange, placeholder = "Select a job", small = false }) {
  const proOn = window.useFeatureFlag ? window.useFeatureFlag("professionalJobTypes") : false;
  const [open, setOpen] = useStateNr(false);
  const [query, setQuery] = useStateNr("");
  const [family, setFamily] = useStateNr("all"); // "all" | "frontline" | "professional"
  // Subscribe to jobs:change so the picker re-renders when an admin
  // edits the catalog in Settings \u2192 Jobs without leaving the page.
  const [jobsTick, setJobsTick] = useStateNr(0);
  const rootRef = useRefNr(null);
  const searchRef = useRefNr(null);

  useEffectNr(() => {
    function onJobs() { setJobsTick((n) => n + 1); }
    window.addEventListener("jobs:change", onJobs);
    return () => window.removeEventListener("jobs:change", onJobs);
  }, []);

  useEffectNr(() => {
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

  useEffectNr(() => {
    if (!open) { setQuery(""); setFamily("all"); }
    else {
      const t = setTimeout(() => { try { searchRef.current && searchRef.current.focus(); } catch (e) {} }, 60);
      return () => clearTimeout(t);
    }
  }, [open]);

  // Compose the catalog based on the family filter. Reads from the
  // live jobs-config store so admin edits in Settings \u2192 Jobs land
  // here without a navigation round-trip.
  const frontlineLive    = useMemoNr(() => getJobOptionsForCategory("frontline"),    [jobsTick]);
  const professionalLive = useMemoNr(() => getJobOptionsForCategory("professional"), [jobsTick]);
  const list = useMemoNr(() => {
    if (!proOn) return frontlineLive;
    if (family === "frontline")    return frontlineLive;
    if (family === "professional") return professionalLive;
    return [...professionalLive, ...frontlineLive];
  }, [proOn, family, frontlineLive, professionalLive]);

  const q = query.trim().toLowerCase();
  const filtered = q ? list.filter((j) => j.toLowerCase().includes(q)) : list;
  const familyOf = (j) => (professionalLive.includes(j) ? "professional" : "frontline");

  return (
    <div className="ms-root" ref={rootRef}>
      <div
        className={"fld-control ms-trigger" + (small ? " fld-control--sm" : "") + (open ? " ms-trigger--open" : "")}
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        tabIndex={0}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setOpen((o) => !o); } }}>
        <span className="dd-value" style={{ color: value ? "var(--evr-content-primary-highemp)" : "var(--evr-content-primary-lowemp)" }}>
          {value || placeholder}
        </span>
        <span className="fld-trail">
          <Icon name="ChevronDown" size={18} style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform 150ms cubic-bezier(0.4,0,0.2,1)" }} />
        </span>
      </div>
      {open &&
        <div className="ms-menu" role="listbox">
          {proOn &&
            <div className="jp-tabs" role="tablist" aria-label="Filter by family">
              {[
                { id: "all", label: "All" },
                { id: "frontline", label: "Frontline" },
                { id: "professional", label: "Professional" },
              ].map((t) =>
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={family === t.id}
                  className={"jp-tab" + (family === t.id ? " jp-tab--on" : "")}
                  onClick={(e) => { e.stopPropagation(); setFamily(t.id); }}>
                  {t.label}
                </button>
              )}
            </div>
          }
          <div className="ms-menu-search" onClick={(e) => e.stopPropagation()}>
            <span className="ms-menu-search-icon" aria-hidden="true">
              <Icon name="Search" size={16} />
            </span>
            <input
              ref={searchRef}
              type="text"
              className="ms-menu-search-input"
              placeholder="Search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search jobs" />
            {query &&
              <button
                type="button"
                className="ms-menu-search-clear"
                onClick={(e) => { e.stopPropagation(); setQuery(""); searchRef.current && searchRef.current.focus(); }}
                aria-label="Clear search">
                <Icon name="X" size={14} />
              </button>
            }
          </div>
          {filtered.length === 0 ?
            <div className="ms-menu-empty">No matches</div> :
            filtered.map((opt) => {
              const isSelected = opt === value;
              const fam = familyOf(opt);
              return (
                <button
                  type="button"
                  key={opt}
                  role="option"
                  aria-selected={isSelected}
                  className={"ms-menu-item" + (isSelected ? " ms-menu-item--selected" : "")}
                  onClick={() => { onChange && onChange(opt); setOpen(false); }}>
                  <span className="ms-menu-item-label">{opt}</span>
                  {proOn && family === "all" &&
                    <span className={"jp-fam-chip jp-fam-chip--" + fam}>{fam === "professional" ? "Professional" : "Frontline"}</span>
                  }
                </button>
              );
            })
          }
        </div>
      }
    </div>);
}
if (typeof window !== "undefined") {
  window.JobPicker = JobPicker;
}

// 24-hour clock in 15-minute increments, displayed as "H:MM AM/PM".
const TIME_OPTIONS = (() => {
  const out = [];
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += 15) {
      const period = h < 12 ? "AM" : "PM";
      const hr12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
      out.push(`${hr12}:${m.toString().padStart(2, "0")} ${period}`);
    }
  }
  return out;
})();

const LOCATION_OPTIONS = _locNrArr([
"Manufacturing A",
"Manufacturing B",
"Manufacturing C",
"Manufacturing D",
"Manufacturing E",
"Manufacturing F",
"Distribution Center 1",
"Distribution Center 2"]
);

// Org hierarchy options used when the Professional job-types feature
// flag is on and the user chooses to fill the requisition at a
// non-site level. Static demo data.
const REGION_OPTIONS = _locNrArr([
"Americas",
"EMEA",
"APAC",
"North America",
"South America"]
);
const DISTRICT_OPTIONS = _locNrArr([
"Northeast",
"Mid-Atlantic",
"Southeast",
"Midwest",
"Central",
"Northwest",
"Southwest",
"Pacific"]
);

// Org-level labels used by the Setup card and Work Assignment Sites
// field when professional job types are on.
const ORG_LEVEL_META = {
  corporate: { value: "corporate", label: "Corporate",   icon: "Building",  unit: "Organization", helper: "Filled centrally for the whole company." },
  regions:   { value: "regions",   label: "Regions",     icon: "Earth",     unit: "Region",       helper: "Filled at the region level." },
  districts: { value: "districts", label: "Districts",   icon: "Stack",     unit: "District",     helper: "Filled within one or more districts." },
  sites:     { value: "sites",     label: "Sites",       icon: "Pin",       unit: "Site",         helper: "Filled at a specific site." },
};
const ORG_LEVEL_ORDER = ["corporate", "regions", "districts", "sites"];
function orgLevelOptionsFor(level) {
  if (level === "regions")   return REGION_OPTIONS;
  if (level === "districts") return DISTRICT_OPTIONS;
  if (level === "sites")     return LOCATION_OPTIONS;
  return [];
}

const COST_CENTER_OPTIONS = [
"Site 01", "Site 02", "Site 03", "Site 04",
"Site 05", "Site 06", "Site 07", "Site 08",
"Site 09", "Site 10"];


// ---------- Rate defaults + quote math --------------------------------
// Default supplier bill-rate range ($/hr) per job. Used when the user
// hasn't overridden a rate via the "Edit Quote" panel on the review page.
const DEFAULT_RATES = {
  "Production Associate": { low: 22, high: 28 },
  "Production Line Associate": { low: 20, high: 26 },
  "Pickers": { low: 18, high: 24 },
  "Packers": { low: 18, high: 24 },
  "Forklift Operator": { low: 22, high: 30 },
  "Warehouse Associate": { low: 19, high: 25 },
  "Material Handler": { low: 19, high: 24 },
  "Quality Inspector": { low: 24, high: 32 },
  "Machine Operator": { low: 24, high: 32 },
  "Line Managers": { low: 32, high: 40 },
  "Sorter": { low: 17, high: 22 },
  "Loader / Unloader": { low: 18, high: 24 }
};
const FALLBACK_RATE = { low: 20, high: 28 };

// Module-level draft so NewRequisitionPage state survives the hop to
// ReviewRequisitionPage (the two are sibling routes; React state doesn't
// cross them on its own).
const __reqDraft = {
  locations: [],
  costCenters: [],
  bookings: [],
  schedules: [],
  rateOverrides: {}, // { [jobName]: { low, high } }
  // Work Type axis · added by the `assignments` feature flag. "Shift" is
  // the always-on default (the form below renders today's intake byte-
  // identically). "Assignment" swaps the Schedules card for an open-ended
  // Engagement period card and tags the draft for the v0.77 axis chip.
  workType: "Shift",
  assignmentPeriod: { start: "", end: "", ongoing: false }
};

function rateFor(job, overrides) {
  if (overrides && overrides[job]) return overrides[job];
  return DEFAULT_RATES[job] || FALLBACK_RATE;
}

// "6:00 AM" -> 360 (minutes from midnight). null on bad input.
function parseTimeMin(s) {
  if (!s) return null;
  const m = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec(String(s).trim());
  if (!m) return null;
  let h = parseInt(m[1], 10) % 12;
  if (m[3].toUpperCase() === "PM") h += 12;
  return h * 60 + parseInt(m[2], 10);
}

// Decimal hours between two clock times; wraps past midnight.
function hoursBetween(start, end) {
  const a = parseTimeMin(start),b = parseTimeMin(end);
  if (a == null || b == null) return 0;
  let diff = b - a;
  if (diff <= 0) diff += 24 * 60;
  return diff / 60;
}

const _MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
function _monthIndex(name) {
  const n = String(name || "").toLowerCase();
  return _MONTHS.findIndex((x) => x.toLowerCase().startsWith(n));
}

// Expand a date string (as produced by formatRange) into an array of
// Date objects, one per day in the range. Handles all formatRange outputs:
//   "May 10, 2026"
//   "May 10 – 13, 2026"
//   "May 10 – Jun 5, 2026"
//   "May 10, 2026 – Jan 5, 2027"
// Falls back to "May 10 – May 13" by assuming the current year.
function expandDays(dateStr) {
  if (!dateStr || typeof dateStr !== "string") return [];
  const dash = dateStr.includes("–") ? "–" : dateStr.includes("—") ? "—" : "-";
  const parts = dateStr.split(dash).map((s) => s.trim());
  const yearMatch = dateStr.match(/\b(20\d{2})\b/);
  const fallbackYear = yearMatch ? +yearMatch[1] : new Date().getFullYear();
  function parsePart(s, prevMonth, prevYear) {
    if (!s) return null;
    let m = s.match(/^([A-Za-z]+)\s+(\d{1,2})(?:,\s*(\d{4}))?$/);
    if (m) {
      const mi = _monthIndex(m[1]);
      if (mi < 0) return null;
      return { d: new Date(m[3] ? +m[3] : prevYear, mi, +m[2]), month: mi };
    }
    m = s.match(/^(\d{1,2})(?:,\s*(\d{4}))?$/);
    if (m) {
      if (prevMonth == null) return null;
      return { d: new Date(m[2] ? +m[2] : prevYear, prevMonth, +m[1]), month: prevMonth };
    }
    m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (m) return { d: new Date(+m[3], +m[1] - 1, +m[2]), month: +m[1] - 1 };
    return null;
  }
  if (parts.length === 1) {
    const p = parsePart(parts[0], null, fallbackYear);
    return p && !isNaN(p.d) ? [p.d] : [];
  }
  const first = parsePart(parts[0], null, fallbackYear);
  if (!first || isNaN(first.d)) return [];
  const second = parsePart(parts[1], first.month, first.d.getFullYear());
  if (!second || isNaN(second.d)) return [];
  const out = [];
  for (let d = new Date(first.d); d <= second.d; d.setDate(d.getDate() + 1)) {
    out.push(new Date(d));
  }
  return out;
}

function fmtMD(d) {
  return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
}
function fmtUSD(n) {
  const sym = typeof window !== "undefined" && window.curSymbol ? window.curSymbol() : "$";
  return sym + (Number(n) || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}
// Format an hourly bill-rate range with the active currency symbol.
function fmtRate(low, high) {
  const sym = typeof window !== "undefined" && window.curSymbol ? window.curSymbol() : "$";
  return `${sym}${low}\u2013${sym}${high} / hr`;
}
// Parse "$22 – $28 / hr" or "22-28" -> { low: 22, high: 28 }. Returns
// null if the value can't be read as a numeric range.
function parseRateInput(s) {
  if (!s) return null;
  const nums = String(s).match(/\d+(?:\.\d+)?/g);
  if (!nums || nums.length < 1) return null;
  const low = parseFloat(nums[0]);
  const high = nums.length >= 2 ? parseFloat(nums[1]) : low;
  if (!isFinite(low) || !isFinite(high)) return null;
  return { low: Math.min(low, high), high: Math.max(low, high) };
}

// Walk the schedules × bookings × locations cross-product and produce one
// row per (day, booking-referenced-by-this-schedule, location). Each row
// carries qty, hours, effective rate, and bill range. Quantity on a booking
// is treated as "workers per location" — a booking for 3 Production Line
// Associates at 5 sites is 3×5 = 15 worker-shifts a day, and the grand
// total is the sum of all per-location bills. The per-location aggregates
// power the per-location "receipt" tabs in the quote UI; the grand total
// is the exact sum of those receipts, so the math always reconciles.
function buildBreakdown(bookings, schedules, overrides) {
  const rows = [];
  let totalLow = 0,totalHigh = 0;
  for (const s of schedules || []) {
    const days = expandDays(s.dates);
    if (!days.length) continue;
    const hrs = hoursBetween(s.start, s.end);
    if (!hrs) continue;
    const refs = s.bookings || [];
    for (const ref of refs) {
      const m = /(?:Work assignment|Booking)\s+(\d+)/i.exec(String(ref));
      if (!m) continue;
      const idx = +m[1] - 1;
      const bk = bookings && bookings[idx];
      if (!bk) continue;
      const qty = parseInt(bk.quantity, 10);
      if (!qty || !bk.job) continue;
      const r = rateFor(bk.job, overrides);
      // A booking with no locations attached still needs to appear in the
      // breakdown so the user can spot the gap — bucket it under "—".
      const locs = bk.locations && bk.locations.length ? bk.locations : ["—"];
      for (const loc of locs) {
        for (const d of days) {
          const low = qty * hrs * r.low;
          const high = qty * hrs * r.high;
          rows.push({
            location: loc,
            date: fmtMD(d),
            job: bk.job,
            qty,
            schedule: `${s.start} – ${s.end}`,
            duration: `${hrs % 1 === 0 ? hrs : hrs.toFixed(2)}h`,
            rate: fmtRate(r.low, r.high),
            billLow: low,
            billHigh: high,
            billMid: (low + high) / 2
          });
          totalLow += low;
          totalHigh += high;
        }
      }
    }
  }
  // Per-location aggregates — preserve first-seen order so tabs line up
  // with the order locations were added on the Setup page.
  const byLocation = {};
  const locations = [];
  for (const row of rows) {
    if (!byLocation[row.location]) {
      byLocation[row.location] = { rows: [], totalLow: 0, totalHigh: 0, totalMid: 0 };
      locations.push(row.location);
    }
    const b = byLocation[row.location];
    b.rows.push(row);
    b.totalLow += row.billLow;
    b.totalHigh += row.billHigh;
    b.totalMid += row.billMid;
  }
  return {
    rows,
    totalLow,
    totalHigh,
    totalMid: (totalLow + totalHigh) / 2,
    byLocation,
    locations
  };
}

const PRIORITY_DEFAULT = [
{ rank: 1, supplier: "sw", workers: 3 },
{ rank: 2, supplier: "ss", workers: 1 },
{ rank: 3, supplier: "th", workers: 2 },
{ rank: 4, supplier: "gs", workers: 0 },
{ rank: 5, supplier: "ph", workers: 0 }];


// ---------------------------------------------------------------------
// NewReqEngagementScopeBar — adapter wrapping <EngagementScope/> for the
// New requisition wizard. Same pattern as ReqEngagementScopeBar (in
// pages/requisitions.jsx) and PwEngagementSwitch (in pages/dashboard.jsx)
// — single-select chip-bar, mirrors the page's engagementType state,
// solos to the clicked type. Replaces the legacy `pw-eng-switch`
// `role="tablist"` so the new-req surface obeys the universal-scopes
// rule (no engagement-type tabs anywhere in pages/).
//
// Feature-flag contract — when no variant flag is on, this entire bar
// is omitted by the page (the `professionalOn && …` gate above the
// render). When exactly one type is enabled, <EngagementScope/> itself
// collapses to a neutral "All engagements" pill. The wizard form below
// renders today's Frontline intake byte-identically in either case.
// ---------------------------------------------------------------------
function NewReqEngagementScopeBar({ value, onChange }) {
  const Scope = window.EngagementScope;
  const useScope = window.useEngagementScope;
  if (!Scope || !useScope) return null;

  const [scope, helpers] = useScope({ types: [value] });

  React.useEffect(() => {
    if (!scope.isOnly(value)) helpers.selectOnly(value);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const wrappedHelpers = {
    ...helpers,
    selectOnly: (t) => {
      helpers.selectOnly(t);
      onChange(t);
    }
  };

  const hint =
  value === "frontline" ? "Shift\u2011based agency engagement. Hourly bill rate, schedule, timesheets." :
  value === "professional" ? "Permanent SOW engagement. No schedule, no hourly rate. Invoice on cadence." :
  value === "contractor" ? "Direct (1099 / IC) engagement. No supplier; MSA + SOW signed with the contractor." :
  "Engagement.";

  return (
    <div className="pw-eng-switch-row pw-eng-switch-row--new" role="region" aria-label="Engagement scope">
      <Scope value={scope} onChange={wrappedHelpers} single label="Engagement type" />
      <span className="pw-eng-switch-hint">{hint}</span>
    </div>);

}

// ---------------------------------------------------------------------
// NewReqSupplierTypesPicker — v0.82 distribution access picker. Each
// entry in the ordered list is { key, active, wait } — the wait field
// is the time-to-access delay merged in from the old Talent-pools
// cascade settings.
//
// • Inherits its initial order + wait values from
//   window.GLOBAL_DEFAULTS.supplierTypes (set in Settings → Supplier
//   distribution → Distribution access).
// • Only renders enabled supplier types — hidden entirely when the org
//   has just Agency on, matching the spec ("If the org only has one
//   supplier type enabled, then it doesn't show.").
// • Each active type renders below the picker as its own configurable
//   sub-section, in cascade order. Inactive types are skipped.
// ---------------------------------------------------------------------
function NewReqSupplierTypesPicker({ value, onChange, contractorsOn, eorOn, floatOn }) {
  const stMeta = window.SUPPLIER_TYPE_META || {};
  const waitOptions = window.WAIT_OPTIONS || ["Immediate", "15 min", "30 min", "1 hour", "2 hours", "4 hours"];
  const normST = window.normalizeSupplierTypes || ((x) => x || []);
  const enabledTypes = useMemoNr(() => {
    const out = ["Agency"];
    if (contractorsOn) out.push("IndependentContractor");
    if (eorOn)         out.push("EOR");
    if (floatOn)       out.push("Float");
    return out;
  }, [contractorsOn, eorOn, floatOn]);

  // Hidden when the org has only Agency enabled.
  if (enabledTypes.length <= 1) return null;

  const writeST = (next) => onChange(normST(next, enabledTypes));
  const inactive = enabledTypes.filter((k) => !value.some((e) => e.key === k));
  const orgDefault = normST(
    (window.GLOBAL_DEFAULTS && Array.isArray(window.GLOBAL_DEFAULTS.supplierTypes) && window.GLOBAL_DEFAULTS.supplierTypes.length)
      ? window.GLOBAL_DEFAULTS.supplierTypes
      : enabledTypes,
    enabledTypes
  );
  const isSame = (a, b) =>
    a.length === b.length && a.every((e, i) =>
      e.key === b[i].key && !!e.active === !!b[i].active && (e.wait || "") === (b[i].wait || "")
    );
  const overridden = !isSame(value, orgDefault);

  const moveType = (key, dir) => {
    const i = value.findIndex((e) => e.key === key);
    if (i < 0) return;
    const j = i + dir;
    if (j < 0 || j >= value.length) return;
    const next = value.slice();
    [next[i], next[j]] = [next[j], next[i]];
    writeST(next);
  };
  const removeType = (key) => writeST(value.filter((e) => e.key !== key));
  const addType    = (key) => writeST([...value, { key, active: true, wait: "1 hour" }]);
  const patchType  = (key, patch) => writeST(value.map((e) => e.key === key ? { ...e, ...patch } : e));
  const resetToDefault = () => writeST(orgDefault.slice());

  return (
    <div className="nr-sts-row" role="region" aria-label="Distribution access">
      <div className="nr-sts-head">
        <div className="nr-sts-head-text">
          <span className="nr-sts-title">Distribution access</span>
          <span className="nr-sts-sub">
            Supplier types invited to this requisition, in cascade order. Each row's wait time delays its
            access from the moment the requisition is published.
            {overridden && <span className="nr-sts-overridden" title="Different from the org-wide default"> · Overridden</span>}
          </span>
        </div>
        {overridden && (
          <button type="button" className="linkbtn" onClick={resetToDefault}>
            Reset to default
          </button>
        )}
      </div>

      <div className="nr-sts-table">
        <div className="nr-sts-trow nr-sts-trow--head" role="row">
          <span className="nr-sts-trank"></span>
          <span className="nr-sts-tname">Type</span>
          <span className="nr-sts-tstatus">Status</span>
          <span className="nr-sts-twait">Wait time</span>
          <span className="nr-sts-tactions"></span>
        </div>
        {value.map((entry, i) => {
          const key = entry.key;
          const meta = stMeta[key] || { label: key, icon: "Building" };
          const removable = value.length > 1;
          const firstActive = value.findIndex((e) => e.active) === i;
          return (
            <div key={key} className={`nr-sts-trow nr-sts-trow--${key.toLowerCase()}` + (entry.active ? "" : " nr-sts-trow--off")} role="row">
              <span className="nr-sts-trank tabular" aria-hidden="true">{i + 1}</span>
              <span className="nr-sts-tname">
                <span className="nr-sts-tname-icon"><Icon name={meta.icon} size={16} /></span>
                <span className="nr-sts-tname-label">{meta.label}</span>
                {firstActive && entry.active && (
                  <span className="nr-sts-first">First access</span>
                )}
              </span>
              <span className="nr-sts-tstatus">
                <Switch
                  checked={entry.active}
                  onChange={(v2) => patchType(key, { active: v2 })}
                  ariaLabel={`${meta.label} active`}
                />
                <span className="nr-sts-status-label">{entry.active ? "Active" : "Inactive"}</span>
              </span>
              <span className="nr-sts-twait">
                <select
                  className="nr-sts-wait-sel"
                  value={firstActive && entry.active ? "Immediate" : entry.wait}
                  onChange={(e) => patchType(key, { wait: e.target.value })}
                  disabled={!entry.active || firstActive}
                  aria-label={`${meta.label} wait time`}
                >
                  {waitOptions.map((w) => <option key={w} value={w}>{w}</option>)}
                </select>
              </span>
              <span className="nr-sts-tactions">
                <button
                  type="button"
                  className="iconbtn iconbtn--sm"
                  aria-label={`Move ${meta.label} earlier`}
                  disabled={i === 0}
                  onClick={() => moveType(key, -1)}
                >
                  <Icon name="ChevronUp" size={14} />
                </button>
                <button
                  type="button"
                  className="iconbtn iconbtn--sm"
                  aria-label={`Move ${meta.label} later`}
                  disabled={i === value.length - 1}
                  onClick={() => moveType(key, 1)}
                >
                  <Icon name="ChevronDown" size={14} />
                </button>
                <button
                  type="button"
                  className="iconbtn iconbtn--sm"
                  aria-label={`Remove ${meta.label}`}
                  title={removable ? "Remove from this requisition" : "At least one type required"}
                  disabled={!removable}
                  onClick={() => removeType(key)}
                >
                  <Icon name="X" size={14} />
                </button>
              </span>
            </div>
          );
        })}
      </div>

      {inactive.length > 0 && (
        <div className="nr-sts-addrow">
          <span className="nr-sts-add-label">Add a supplier type</span>
          <div className="nr-sts-add-chips">
            {inactive.map((key) => {
              const meta = stMeta[key] || { label: key, icon: "Building" };
              return (
                <button
                  key={key}
                  type="button"
                  className="nr-sts-add-chip"
                  onClick={() => addType(key)}>
                  <Icon name="AddCircle" size={14} />
                  <Icon name={meta.icon} size={14} />
                  {meta.label}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>);

}

// ---------------------------------------------------------------------
// NewReqTimeMaterialsCard — "Time & Materials" picker + contextual fields.
// All four T&M options always render (Clock In/Out, Timesheet, Milestone,
// Fixed). No filtering by work type — work type was removed from the
// intake. Each model reveals its contextual field set below the chooser.
// ---------------------------------------------------------------------
function NewReqTimeMaterialsCard({ value, onChange }) {
  const rows = [
  { key: "ClockInOut", label: "Clock-in/out", hint: "Punch in/out at the location. Hours are clocked, then approved, then billed." },
  { key: "Timesheet", label: "Timesheet", hint: "Worker submits hours per period. Approval triggers billing." },
  { key: "Milestone", label: "Milestone", hint: "Buyer accepts deliverables. Each acceptance fires an invoice." },
  { key: "FixedFee", label: "Fixed", hint: "Flat retainer fee, billed on a cadence. No time tracking." }];


  return (
    <SectionCard
      variant="compact"
      icon="Pay"
      title="Engagement model"
      subtitle="How time is captured and how it's billed">
      
      <div className="nr-bm-grid" role="radiogroup" aria-label="Engagement model">
        {rows.map((r) =>
        <button
          key={r.key}
          type="button"
          role="radio"
          aria-checked={value === r.key}
          className={`nr-bm-card ${value === r.key ? "is-on" : ""}`}
          onClick={() => onChange(r.key)}>
          
            <span className="nr-bm-card-h">
              <span className="nr-bm-card-dot" aria-hidden="true" />
              <span className="nr-bm-card-title">{r.label}</span>
            </span>
            <span className="nr-bm-card-hint">{r.hint}</span>
          </button>
        )}
      </div>

      {/* Contextual fields per Time & Materials option. */}
      <NewReqBillingModelFields
        value={value} />
      
    </SectionCard>);

}

// ---------------------------------------------------------------------
// NewReqBillingModelFields — model-specific field set rendered below
// the chooser. Kept lightweight: each block surfaces the 2-3 fields a
// buyer needs to set on intake; the rest live on the supplier contract.
// ---------------------------------------------------------------------
function NewReqBillingModelFields({ value, workType, assignmentPeriod }) {
  if (value === "ClockInOut") {
    return (
      <div className="nr-bm-fields nr-bm-fields--clock">
        <Field label="Grace window" hint="Minutes a worker can be late before the shift fires an alert.">
          <Dropdown
            value="5"
            onChange={() => {}}
            options={[
            { value: "0", label: "0 min · strict" },
            { value: "5", label: "5 min · default" },
            { value: "10", label: "10 min" },
            { value: "15", label: "15 min" }]
            } />
          
        </Field>
        <Field label="Round to" hint="Rounding applied to clock-in / clock-out.">
          <Dropdown
            value="quarter"
            onChange={() => {}}
            options={[
            { value: "exact", label: "Exact minutes" },
            { value: "quarter", label: "Nearest 15 min" },
            { value: "tenth", label: "Nearest 6 min (tenth of hour)" }]
            } />
          
        </Field>
      </div>);

  }
  if (value === "Timesheet") {
    return (
      <div className="nr-bm-fields nr-bm-fields--ts">
        <Field label="Submission cadence" hint="How often the worker submits hours.">
          <Dropdown
            value="weekly"
            onChange={() => {}}
            options={[
            { value: "daily", label: "Daily" },
            { value: "weekly", label: "Weekly · Mon–Sun" },
            { value: "biweek", label: "Bi-weekly" },
            { value: "monthly", label: "Monthly" }]
            } />
          
        </Field>
        <Field label="Approver" hint="Defaults to the requisition manager. Can be re-routed per worker.">
          <Dropdown
            value="manager"
            onChange={() => {}}
            options={[
            { value: "manager", label: "Requisition manager" },
            { value: "site", label: "Site lead" },
            { value: "client", label: "Client contact" }]
            } />
          
        </Field>
      </div>);

  }
  if (value === "Milestone") {
    return (
      <div className="nr-bm-fields nr-bm-fields--ms">
        <Field label="Milestone schedule" hint="High-level milestone outline. Detailed schedule lives on the contract." style={{ gridColumn: "1 / -1" }}>
          <textarea
            className="pro-input"
            rows={3}
            placeholder={"Discovery · 2025-08-15\nPilot complete · 2025-10-01\nFinal acceptance · 2025-12-15"} />
          
        </Field>
        <Field label="Retainage" hint="% withheld until final acceptance.">
          <TextInput type="number" value="10" onChange={() => {}} placeholder="10" />
        </Field>
        <Field label="Acceptance window" hint="Days the buyer has to accept each milestone.">
          <Dropdown
            value="10"
            onChange={() => {}}
            options={[
            { value: "5", label: "5 days" },
            { value: "10", label: "10 days" },
            { value: "15", label: "15 days" },
            { value: "30", label: "30 days" }]
            } />
          
        </Field>
      </div>);

  }
  if (value === "FixedFee") {
    return (
      <div className="nr-bm-fields nr-bm-fields--ff">
        <Field label="Fee amount" required>
          <TextInput type="number" value="" onChange={() => {}} placeholder="15000" />
        </Field>
        <Field label="Billing cadence" hint="When the fee fires.">
          <Dropdown
            value="monthly"
            onChange={() => {}}
            options={[
            { value: "once", label: "One-shot at start" },
            { value: "monthly", label: "Monthly" },
            { value: "quarterly", label: "Quarterly" },
            { value: "delivery", label: "On delivery" }]
            } />
          
        </Field>
        <Field label="Includes" hint="Brief scope summary. Detailed terms live on the contract." style={{ gridColumn: "1 / -1" }}>
          <textarea className="pro-input" rows={2} placeholder="Retainer covers: monthly strategy review, quarterly OKR sync, ad-hoc Slack support." />
        </Field>
      </div>);

  }
  return null;
}

// ---------------------------------------------------------------------
// NewReqContractorDistributionBody — independent-contractor candidate
// picker rendered inside the Distribution card when the `contractors`
// feature flag is on. Adds search / filter / sort / "View all" so
// buyers can scan a deep contractor roster, narrow it down, and pick
// the ones they want to send this requisition to.
// ---------------------------------------------------------------------
function NewReqContractorDistributionBody() {
  const all = useMemoNr(
    () => (window.getContractorWorkers && window.getContractorWorkers()) || [],
    []
  );
  const [query, setQuery] = useStateNr("");
  // Filter by status (classification risk). Defaults to "all".
  const [filter, setFilter] = useStateNr("all");
  // Sort key — "name" | "status" | "recent"
  const [sort, setSort] = useStateNr("name");
  // Set of selected contractor ids. Pre-seed with the top 5 so the UI
  // matches today's "we picked some defaults for you" behavior.
  const [selected, setSelected] = useStateNr(() => new Set(all.slice(0, 5).map((w) => w.id)));
  // Open / close the "View all" expand state. Collapsed by default
  // (shows top 5 matches); when open, shows the full filtered list.
  const [expanded, setExpanded] = useStateNr(false);

  const toggle = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const filtered = useMemoNr(() => {
    let rows = all.slice();
    if (filter === "clear") rows = rows.filter((w) => !(w.riskScore && w.riskScore.level === "high"));
    if (filter === "rescreen") rows = rows.filter((w) => (w.riskScore && w.riskScore.level === "high"));
    if (filter === "selected") rows = rows.filter((w) => selected.has(w.id));
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      rows = rows.filter((w) =>
        (w.name || "").toLowerCase().includes(q) ||
        (w.classification || "").toLowerCase().includes(q) ||
        (w.jobs || []).some((j) => String(j).toLowerCase().includes(q))
      );
    }
    if (sort === "name") rows.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    if (sort === "status") rows.sort((a, b) => {
      const aRisk = a.riskScore && a.riskScore.level === "high" ? 1 : 0;
      const bRisk = b.riskScore && b.riskScore.level === "high" ? 1 : 0;
      return aRisk - bRisk;
    });
    // "recent" keeps the data's natural order (most recently added first
    // in the demo data).
    return rows;
  }, [all, query, filter, sort, selected]);

  const visible = expanded ? filtered : filtered.slice(0, 5);

  return (
    <React.Fragment>
      <Banner
        title="Direct contractor distribution"
        onClose={() => {}}
        action={{
          label: "Open contractor hub",
          onClick: () => {
            if (window.flexGoTo) window.flexGoTo({ page: "contractors" });else
            showToast("Opening contractor hub");
          }
        }}>
        
        Independent contractors are engaged directly by the buyer (1099 / IC). Select contractors below
        or invite from the broader pool. There's no agency priority &mdash; each contractor receives the
        requisition individually.
      </Banner>

      {/* v0.97 — IC-flavored intake reminders. Reads the COI policy
          library + approval thresholds straight off the IC program card
          in Settings → Configuration so the catalog Admin curates shows
          up on the Manager intake without extra wiring. Falls back
          quietly when the IC program card hasn't seeded yet. */}
      {(window.getEnabledCoveragePolicies || window.getContractorIntegrations) && (
        <div className="nr-ic-intake-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 8 }}>
          {window.getEnabledCoveragePolicies && (
            <div className="vms-card" style={{ padding: 12 }}>
              <div className="prio-section-head" style={{ marginBottom: 6 }}>
                <span><Icon name="ShieldPerson" size={14} /> Required coverage</span>
              </div>
              <p style={{ margin: "4px 0 8px", font: "var(--evr-body2)", color: "var(--evr-content-primary-default)" }}>
                Each invited contractor will be asked to upload these per the IC program coverage policy library.
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {(window.getEnabledCoveragePolicies() || []).slice(0, 6).map((c) => (
                  <span key={c.id} className="req-pill req-pill--informative" title={`${c.name} · ${c.minimum}`}>{c.abbrev}</span>
                ))}
              </div>
            </div>
          )}
          {window.getContractorIntegrations && (() => {
            const cfg = window.getContractorIntegrations();
            const reviewers = [];
            if (cfg.riskThreshold)  reviewers.push(`IC Compliance · risk ≥ ${cfg.riskThreshold}`);
            if (cfg.spendThreshold) reviewers.push(`Finance · spend ≥ $${(cfg.spendThreshold / 1000).toFixed(0)}k`);
            return (
              <div className="vms-card" style={{ padding: 12 }}>
                <div className="prio-section-head" style={{ marginBottom: 6 }}>
                  <span><Icon name="PersonAuthorize" size={14} /> Approval routing</span>
                </div>
                <p style={{ margin: "4px 0 8px", font: "var(--evr-body2)", color: "var(--evr-content-primary-default)" }}>
                  New contractor invites from this requisition route through:
                </p>
                <ul style={{ margin: 0, paddingLeft: 18, font: "var(--evr-body2)", color: "var(--evr-content-primary-highemp)" }}>
                  <li>Hiring manager (you) · auto-approve</li>
                  {reviewers.map((r) => <li key={r}>{r}</li>)}
                </ul>
              </div>
            );
          })()}
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 8 }}>
        <div className="prio-section-head">
          <span>Candidate contractors <span style={{ color: "var(--evr-content-primary-lowemp)", font: "var(--evr-body2)" }}>·&nbsp;{selected.size} selected of {all.length}</span></span>
          <span className="prio-section-actions">
            <button
              type="button"
              className="linkbtn"
              onClick={() => setExpanded((v) => !v)}>
              {expanded ? "Show top 5" : `View all (${filtered.length})`}
            </button>
          </span>
        </div>

        <div className="nr-ic-toolbar">
          <div className="nr-ic-search">
            <span className="nr-ic-search-icon" aria-hidden="true">
              <Icon name="Search" size={16} />
            </span>
            <input
              type="text"
              className="nr-ic-search-input"
              placeholder="Search by name, job, or classification"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search contractors" />
            {query &&
              <button
                type="button"
                className="nr-ic-search-clear"
                onClick={() => setQuery("")}
                aria-label="Clear search">
                <Icon name="X" size={14} />
              </button>
            }
          </div>
          <div className="nr-ic-filters">
            <Dropdown
              small
              value={filter}
              onChange={setFilter}
              options={[
                { value: "all",      label: "All contractors" },
                { value: "clear",    label: "Clear classification" },
                { value: "rescreen", label: "Re-screen needed" },
                { value: "selected", label: "Selected only" },
              ]} />
            <Dropdown
              small
              value={sort}
              onChange={setSort}
              options={[
                { value: "name",   label: "Sort · Name (A–Z)" },
                { value: "status", label: "Sort · Status" },
                { value: "recent", label: "Sort · Recently added" },
              ]} />
          </div>
        </div>

        <div className="nr-ic-list">
          {visible.length === 0 ?
          <div className="nr-ic-empty">
            No contractors match this search.{" "}
            <a href="#" onClick={(e) => { e.preventDefault(); setQuery(""); setFilter("all"); }}>Clear filters</a>
          </div> :
          visible.map((w) => {
            const isHigh = w.riskScore && w.riskScore.level === "high";
            return (
              <label key={w.id} className="nr-ic-row">
                <input type="checkbox" checked={selected.has(w.id)} onChange={() => toggle(w.id)} />
                <span className="nr-ic-row-main">
                  <span className="nr-ic-row-name">{w.name}</span>
                  <span className="nr-ic-row-meta">{w.classification || "1099 / IC"} &middot; {(w.jobs && w.jobs[0]) || "\u2014"}</span>
                </span>
                <span className={"nr-ic-row-tag" + (isHigh ? " nr-ic-row-tag--warn" : "")}>{isHigh ? "Re-screen" : "Clear"}</span>
              </label>
            );
          })}
        </div>

        {!expanded && filtered.length > 5 &&
          <button
            type="button"
            className="nr-ic-list-more"
            onClick={() => setExpanded(true)}>
            <Icon name="ChevronDown" size={14} />
            Show {filtered.length - 5} more
          </button>
        }
      </div>
    </React.Fragment>);

}

// ---------------------------------------------------------------------
// NewReqEorDistributionBody — supplier-type-contextual body for
// Distribution when the user has picked EOR.
// ---------------------------------------------------------------------
function NewReqEorDistributionBody() {
  const partners = [
  { id: "rgs", name: "Remote Global Services", countries: ["GB", "DE", "IN", "BR"], fee: "9.5% of gross", lead: "5 business days" },
  { id: "epl", name: "Edge People Lab", countries: ["AU", "JP", "SG", "MX"], fee: "10% of gross", lead: "7 business days" },
  { id: "vcc", name: "Velocity Cross-border", countries: ["GB", "ES", "AE", "CA"], fee: "11% of gross", lead: "10 business days" }];

  return (
    <React.Fragment>
      <Banner
        title="In-country Employer-of-Record"
        onClose={() => {}}
        action={{
          label: "Manage EOR partners",
          onClick: () => {
            if (window.flexGoTo) window.flexGoTo({ page: "settings", sub: "feature-flags" });else
            showToast("Opening EOR partner registry");
          }
        }}>
        
        Cross-border engagements go through an Employer-of-Record. Pick the country and partner that
        will be the legal employer of record while the buyer directs the work.
      </Banner>

      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 8 }}>
        <div className="prio-section-head">
          <span>Available EOR partners</span>
          <span className="prio-section-actions">
            <button
              type="button"
              className="linkbtn"
              onClick={() => showToast("Opening EOR partner registry")}>
              
              View all
            </button>
          </span>
        </div>
        <div className="nr-eor-list">
          {partners.map((p) =>
          <label key={p.id} className="nr-eor-row">
              <input type="radio" name="eorPartner" defaultChecked={p.id === "rgs"} />
              <span className="nr-eor-row-main">
                <span className="nr-eor-row-name">{p.name}</span>
                <span className="nr-eor-row-meta">{p.countries.join(" \u00b7 ")}</span>
              </span>
              <span className="nr-eor-row-stats">
                <span className="nr-eor-row-stat">{p.fee}</span>
                <span className="nr-eor-row-stat-sub">{p.lead} lead</span>
              </span>
            </label>
          )}
        </div>
      </div>
    </React.Fragment>);

}

// ---------------------------------------------------------------------
// NewReqFloatDistributionBody — buyer-owned float-pool worker picker.
// Float workers are directly employed by the organization (per-diem
// nurses, banquet flex staff, etc.) but aren't tied to a single
// location, so they can be invited to open requisitions like agency
// workers — just without going through a supplier tier.
//
// Reads from window.WORKERS filtered to `pool === "Float"`. Pre-seeds
// the first 5 as selected so the body never lands empty.
// ---------------------------------------------------------------------
function NewReqFloatDistributionBody() {
  const pool = useMemoNr(() => {
    const all = window.WORKERS || [];
    return all.filter((w) => w.pool === "Float");
  }, []);
  const [query, setQuery] = useStateNr("");
  const [filter, setFilter] = useStateNr("all"); // all | available | selected
  const [selected, setSelected] = useStateNr(() => new Set(pool.slice(0, 5).map((w) => w.id)));
  const [expanded, setExpanded] = useStateNr(false);

  const toggle = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const filtered = useMemoNr(() => {
    let rows = pool.slice();
    if (filter === "available") rows = rows.filter((w) => w.status !== "Expired");
    if (filter === "selected")  rows = rows.filter((w) => selected.has(w.id));
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      rows = rows.filter((w) =>
        (w.name || "").toLowerCase().includes(q) ||
        (w.jobs || []).some((j) => String(j).toLowerCase().includes(q))
      );
    }
    return rows;
  }, [pool, query, filter, selected]);

  const visible = expanded ? filtered : filtered.slice(0, 5);

  return (
    <React.Fragment>
      <Banner
        title="Float pool"
        onClose={() => {}}
        action={{
          label: "Open Workforce",
          onClick: () => {
            if (window.flexGoTo) window.flexGoTo({ page: "workforce" });
            else showToast("Opening Workforce");
          }
        }}>
        Internal cross-site workers (per-diem, banquet flex, traveler nurses) directly employed by your
        organization. Profiles and accrued hours sync from Dayforce core; Flex Work invites them to this
        requisition alongside agency workers — without a supplier tier.
      </Banner>

      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 8 }}>
        <div className="prio-section-head">
          <span>Candidate float workers <span style={{ color: "var(--evr-content-primary-lowemp)", font: "var(--evr-body2)" }}>&nbsp;·&nbsp;{selected.size} selected of {pool.length}</span></span>
          <span className="prio-section-actions">
            <button
              type="button"
              className="linkbtn"
              onClick={() => setExpanded((v) => !v)}>
              {expanded ? "Show top 5" : `View all (${filtered.length})`}
            </button>
          </span>
        </div>

        <div className="nr-ic-toolbar">
          <div className="nr-ic-search">
            <span className="nr-ic-search-icon" aria-hidden="true">
              <Icon name="Search" size={16} />
            </span>
            <input
              type="text"
              className="nr-ic-search-input"
              placeholder="Search by name or job"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search float workers" />
            {query &&
              <button
                type="button"
                className="nr-ic-search-clear"
                onClick={() => setQuery("")}
                aria-label="Clear search">
                <Icon name="X" size={14} />
              </button>
            }
          </div>
          <div className="nr-ic-filters">
            <Dropdown
              small
              value={filter}
              onChange={setFilter}
              options={[
                { value: "all",       label: "All float workers" },
                { value: "available", label: "Available only" },
                { value: "selected",  label: "Selected only" },
              ]} />
          </div>
        </div>

        <div className="nr-ic-list">
          {visible.length === 0 ?
            <div className="nr-ic-empty">
              No float workers match this search.{" "}
              <a href="#" onClick={(e) => { e.preventDefault(); setQuery(""); setFilter("all"); }}>Clear filters</a>
            </div> :
            visible.map((w) => {
              const expired = w.status === "Expired";
              return (
                <label key={w.id} className="nr-ic-row">
                  <input type="checkbox" checked={selected.has(w.id)} onChange={() => toggle(w.id)} disabled={expired} />
                  <span className="nr-ic-row-main">
                    <span className="nr-ic-row-name">{w.name}</span>
                    <span className="nr-ic-row-meta">Float · {(w.jobs && w.jobs[0]) || "\u2014"} · {w.shifts || 0} shifts</span>
                  </span>
                  <span className={"nr-ic-row-tag" + (expired ? " nr-ic-row-tag--warn" : "")}>{expired ? "Re-screen" : "Active"}</span>
                </label>
              );
            })}
        </div>

        {!expanded && filtered.length > 5 &&
          <button
            type="button"
            className="nr-ic-list-more"
            onClick={() => setExpanded(true)}>
            <Icon name="ChevronDown" size={14} />
            Show {filtered.length - 5} more
          </button>
        }
      </div>
    </React.Fragment>);

}
//   · A tenant-wide "Require interview before offer" switch.
//   · Per-role overrides when more than one job is ordered (so a Chef
//     can require an interview while a Server skips it).
// Per-role rows are sourced from the bookings array passed in; they
// match what the requisition has ordered, not a static role catalog.
// ---------------------------------------------------------------------
function NewReqInterviewSection({ required, onRequiredChange, byRole, onByRoleChange, bookings }) {
  // Build a unique list of role names from the bookings array.
  const roles = [];
  const seen = new Set();
  for (const b of bookings || []) {
    if (b && b.job && !seen.has(b.job)) {seen.add(b.job);roles.push(b.job);}
  }
  const patchRole = (job, val) => {
    const next = { ...(byRole || {}) };
    if (val) next[job] = true;else delete next[job];
    onByRoleChange && onByRoleChange(next);
  };
  return (
    <section className="nr-iv-section">
      <header className="nr-iv-head">
        <span className="nr-iv-eyebrow">Interview</span>
        <h4 className="nr-iv-title">Require interview before offer</h4>
        <p className="nr-iv-sub">When required, candidates move from Submitted &rarr; Interview &rarr; Offer. When off, offers fire as soon as a worker is matched.</p>
      </header>

      <label className="nr-iv-row nr-iv-row--main">
        <span className="nr-iv-row-text">
          <span className="nr-iv-row-title">All roles on this requisition</span>
          <span className="nr-iv-row-hint">Toggle individual roles below to override.</span>
        </span>
        <span className={"nr-iv-switch" + (required ? " is-on" : "")} role="switch" aria-checked={!!required} tabIndex={0}
        onClick={() => onRequiredChange && onRequiredChange(!required)}
        onKeyDown={(e) => {if (e.key === " " || e.key === "Enter") {e.preventDefault();onRequiredChange && onRequiredChange(!required);}}}>
          
          <span className="nr-iv-switch-thumb" />
        </span>
      </label>

      {roles.length > 1 &&
      <div className="nr-iv-roles">
          <div className="nr-iv-roles-head">Per-role override</div>
          {roles.map((job) => {
          const on = !!(byRole && byRole[job]) || required && !(byRole && byRole.hasOwnProperty(job) && byRole[job] === false);
          const explicit = byRole && byRole.hasOwnProperty(job);
          const effective = explicit ? !!byRole[job] : !!required;
          return (
            <label key={job} className="nr-iv-row nr-iv-row--role">
                <span className="nr-iv-row-text">
                  <span className="nr-iv-row-title">{job}</span>
                  <span className="nr-iv-row-hint">{explicit ? "Override" : required ? "Inherits: required" : "Inherits: not required"}</span>
                </span>
                <span className={"nr-iv-switch" + (effective ? " is-on" : "")} role="switch" aria-checked={effective} tabIndex={0}
              onClick={() => patchRole(job, !effective)}
              onKeyDown={(e) => {if (e.key === " " || e.key === "Enter") {e.preventDefault();patchRole(job, !effective);}}}>
                
                  <span className="nr-iv-switch-thumb" />
                </span>
              </label>);

        })}
        </div>
      }
    </section>);

}

function NewRequisitionPage({ onBack, onReview, initialFilled = false }) {
  // The Professional Work feature flag adds a Professional lane (permanent
  // SOW engagement — no shifts, no hourly rate, no booking/schedule) to
  // the universal engagement-type filter. When the flag is off, the
  // filter collapses to a neutral "All engagements" pill and the form
  // renders today's Frontline intake byte-identically.
  //
  // v1.0 unification · this used to be a `role="tablist"` segmented
  // control labelled "Engagement type". Per the universal-scopes rule
  // (no engagement-type tabs anywhere in pages/) it is now an
  // <EngagementScope/> chip-bar in single-select mode — same primitive
  // the Dashboard, Requisitions, Workforce, and Invoices hubs use. The
  // body still adapts per-type so only relevant fields render; the
  // chrome around it (omnibar, footer, save state) is identical across
  // every engagement type.
  const professionalOn = window.useFeatureFlag ? window.useFeatureFlag("professionalWork") : false;
  // Supplier-type flags · gate which supplier-type choices appear in the
  // Distribution card. With all flags off, every requisition defaults to
  // Agency and the picker hides entirely.
  const contractorsOn = window.useFeatureFlag ? window.useFeatureFlag("independentContractor") : false;
  const eorOn = window.useFeatureFlag ? window.useFeatureFlag("eor") : false;
  const floatOn = window.useFeatureFlag ? window.useFeatureFlag("float") : false;
  // Time & Materials flags · which T&M rows appear. ClockInOut is always
  // available; Timesheet / Milestone / FixedFee gate on their own flags.
  const timesheetsOn = window.useFeatureFlag ? window.useFeatureFlag("timesheets") : false;
  const milestonesOn = window.useFeatureFlag ? window.useFeatureFlag("milestones") : false;
  const fixedFeeOn = window.useFeatureFlag ? window.useFeatureFlag("fixedFee") : false;
  // Interviews flag · adds an Interview-required setting to the
  // Distribution edit panel. Independent of the worker-type axes.
  const interviewsOn = window.useFeatureFlag ? window.useFeatureFlag("interviews") : false;
  // Professional job-types flag · adds the Professional catalog to every
  // job picker on the page. Re-reads the catalog whenever the flag flips
  // or admin edits land in Settings \u2192 Jobs.
  const professionalJobTypesOn = window.useFeatureFlag ? window.useFeatureFlag("professionalJobTypes") : false;
  const [jobsTick, setJobsTick] = useStateNr(0);
  useEffectNr(() => {
    function onJobs() { setJobsTick((n) => n + 1); }
    window.addEventListener("jobs:change", onJobs);
    return () => window.removeEventListener("jobs:change", onJobs);
  }, []);
  const jobOptionsLive = useMemoNr(
    () => getJobOptions(),
    [professionalJobTypesOn, jobsTick]
  );
  // v0.77 master gate · any axis-extending flag on → show the new
  // intake cards (Time & Materials, Supplier Type, per-row rate range).
  // All flags off → form renders today's byte-identical Frontline path.
  const v77On = timesheetsOn || milestonesOn || fixedFeeOn || contractorsOn || eorOn || floatOn;
  const [engagementType, setEngagementType] = useStateNr("frontline");

  // v0.77 spec §08 · three-axis intake state. Work Type is no longer
  // user-selected (the picker was removed) — every requisition uses a
  // schedule. Billing Model becomes Time & Materials with all four
  // options always visible; Supplier Type drives the Distribution panel.
  // Defaults pin the form to the canonical (Shift × ClockInOut × Agency)
  // cell so flag-off draft behavior is byte-identical to today.
  const [billingModel, setBillingModel] = useStateNr(__reqDraft.billingModel || "ClockInOut");
  // v0.82 — Distribution can target multiple supplier types in cascade
  // order, each with its own active state + wait-to-access. The array
  // seeds from the org-wide default (set in Settings → Supplier
  // distribution → Distribution access); buyers can re-order, toggle,
  // or change wait times per-requisition. `supplierType` (singular)
  // is kept as a derived back-compat value — the key of the first
  // active entry — so downstream consumers that still read the
  // singular cell (placeOrder draft, list rendering, axis-scope-bar)
  // keep working.
  const _supplierTypesDefault = useMemoNr(() => {
    const normST = window.normalizeSupplierTypes || ((x) => x || []);
    const enabled = (window.getEnabledSupplierTypeKeys && window.getEnabledSupplierTypeKeys()) || ["Agency"];
    const fromSettings = (window.GLOBAL_DEFAULTS && Array.isArray(window.GLOBAL_DEFAULTS.supplierTypes) && window.GLOBAL_DEFAULTS.supplierTypes.length)
      ? window.GLOBAL_DEFAULTS.supplierTypes
      : enabled;
    return normST(fromSettings, enabled);
  }, [contractorsOn, eorOn, floatOn]);
  const [supplierTypes, setSupplierTypes] = useStateNr(
    Array.isArray(__reqDraft.supplierTypes) && __reqDraft.supplierTypes.length
      ? (window.normalizeSupplierTypes ? window.normalizeSupplierTypes(__reqDraft.supplierTypes) : __reqDraft.supplierTypes)
      : _supplierTypesDefault
  );
  // Derived: first active entry's key (back-compat with the singular
  // `supplierType` field used by placeOrder and a few list consumers).
  const supplierType = (supplierTypes.find((e) => e && e.active) || supplierTypes[0] || { key: "Agency" }).key;
  // Active-only keys, in cascade order — drives sub-section rendering
  // and the persisted requisition row.
  const activeSupplierTypes = useMemoNr(
    () => supplierTypes.filter((e) => e && e.active).map((e) => e.key),
    [supplierTypes]
  );
  const setSupplierType = (key) => setSupplierTypes([{ key, active: true, wait: "Immediate" }]); // legacy single-select alias
  // Workflow · how candidates are matched and offered. "automatic" =
  // fills from the priority window without buyer input. "interview" =
  // pauses at the Interview stage for a candidate selection step.
  // Surfaces inside the Work Assignment Advanced panel.
  const [workflow, setWorkflow] = useStateNr(__reqDraft.workflow || "automatic");
  // v0.77 spec §08 · Interview-required state. Default tenant-wide
  // setting + a per-role override map keyed by booking id. When the
  // `interviews` flag is on, the Distribution edit panel surfaces both.
  const [interviewRequired, setInterviewRequired] = useStateNr(!!__reqDraft.interviewRequired);
  const [interviewByRole, setInterviewByRole] = useStateNr(__reqDraft.interviewByRole || {});
  useEffectNr(() => {
    if (!professionalOn && engagementType === "professional") setEngagementType("frontline");
  }, [professionalOn, engagementType]);

  // Flag-off contract: when a supplier-type flag drops, trim the picker
  // so old drafts don't dangle on an unreachable cell.
  useEffectNr(() => {
    const enabled = (window.getEnabledSupplierTypeKeys && window.getEnabledSupplierTypeKeys()) || ["Agency"];
    const filtered = supplierTypes.filter((e) => enabled.includes(e.key));
    if (filtered.length !== supplierTypes.length) {
      const next = window.normalizeSupplierTypes
        ? window.normalizeSupplierTypes(filtered, enabled)
        : filtered;
      setSupplierTypes(next.length ? next : [{ key: "Agency", active: true, wait: "Immediate" }]);
    }
  }, [contractorsOn, eorOn, floatOn]);

  // Pro form state — only meaningful when engagementType === "professional".
  const [proForm, setProForm] = useStateNr({
    title: initialFilled ? "Senior Product Manager · Workforce" : "",
    qty: 1,
    location: initialFilled ? "Minneapolis, MN" : "",
    hiringManager: initialFilled ? "Amy Hennen" : "",
    cadence: "monthly",
    rateLow: initialFilled ? 16500 : "",
    rateHigh: initialFilled ? 19500 : "",
    currency: "USD",
    timesheetMode: "none",
    sowTemplate: "MSA + SOW template · Permanent",
    deliverables: initialFilled ?
    "Quarterly OKR alignment with hiring manager.\nWeekly written status update.\nMonthly 1:1 covering retention and contribution.\nAnnual performance review tied to renewal." :
    "",
    autoRenew: true
  });
  const setPro = (key, val) => setProForm((p) => ({ ...p, [key]: val }));

  // ----- Tweakable "Filled vs empty" state for the page demo ---------
  const [filled, setFilled] = useStateNr(initialFilled);

  // ----- Setup state (locations + cost centers) -----------------------
  // Setup locations are the source of truth — booking location options are
  // derived from this selection so the user can't pick a booking location
  // they haven't approved at the setup level.
  const [setupLocations, setSetupLocations] = useStateNr(
    initialFilled ? DEFAULT_LOCATIONS : []
  );
  // Org-fill level — used when the professionalJobTypes flag is on so
  // the user can pick whether the requisition fills at Corporate, by
  // Region, by District, or at a specific Site. Defaults to "sites" so
  // the Setup card looks byte-identical to today's surface at flag-off.
  const [orgLevel, setOrgLevel] = useStateNr(__reqDraft.orgLevel || "sites");
  // Selections at non-site levels (regions / districts). The site-level
  // selection is `setupLocations` above; departments stay below it.
  const [setupRegions, setSetupRegions] = useStateNr(__reqDraft.regions || []);
  const [setupDistricts, setSetupDistricts] = useStateNr(__reqDraft.districts || []);
  // Top-level intake mode — Shift / Assignment / Project / Statement of
  // Work. Behind feature flags; with every flag off the picker doesn't
  // render and engType stays at "Shift" (today's default). Declared up
  // here (ahead of orgLevel-derived calcs) so downstream code can read
  // it without hitting a TDZ.
  const [engType, setEngType] = useStateNr("Shift");
  // v0.86 — Project-specific intake (budget, NTE, currency, external ID,
  // billing basis). Only ever used when engType === "Project" and the
  // engProject flag is on; ignored otherwise. Persisted into the
  // underlying project record on Review commit.
  const [projectIntake, setProjectIntake] = useStateNr({});
  // The unit set used by Work Assignment rows for their primary location
  // picker. Derives from orgLevel + the current selections at that
  // level. At Corporate, work assignments have no per-row org picker.
  // When the professionalJobTypes flag is off AND the engagement type
  // is Shift, the picker is hidden and orgLevel acts as "sites" so the
  // Setup card looks byte-identical to today's surface. Project and
  // Statement of Work always honour the picker because they default to
  // a corporate fill (one budget, no per-site picker on each work
  // assignment).
  const _engOpensOrgPicker = engType === "Project" || engType === "Statement of Work";
  const effectiveOrgLevel = (professionalJobTypesOn || _engOpensOrgPicker) ? orgLevel : "sites";
  const orgLevelUnits = useMemoNr(() => {
    if (effectiveOrgLevel === "regions")   return setupRegions;
    if (effectiveOrgLevel === "districts") return setupDistricts;
    if (effectiveOrgLevel === "sites")     return setupLocations;
    return ["All organization"];
  }, [effectiveOrgLevel, setupRegions, setupDistricts, setupLocations]);
  const orgLevelMeta = ORG_LEVEL_META[effectiveOrgLevel] || ORG_LEVEL_META.sites;
  const [setupCostCenters, setSetupCostCenters] = useStateNr(
    initialFilled ?
    ["Site 01", "Site 02", "Site 03", "Site 04", "Site 05", "Site 06", "Site 07", "Site 08"] :
    []
  );

  // ----- Booking rows state ------------------------------------------
  const [bookings, setBookings] = useStateNr(
    initialFilled ? DEFAULT_BOOKINGS : []
  );

  // When Setup locations change, prune any booking locations that are no
  // longer in the approved list. Keeps everything consistent without
  // surprising the user with stale selections.
  useEffectNr(() => {
    setBookings((bs) => bs.map((b) => ({
      ...b,
      locations: (b.locations || []).filter((l) => setupLocations.includes(l))
    })));
  }, [setupLocations]);
  const nextBookingId = useMemoNr(
    () => bookings.length ? Math.max(...bookings.map((b) => b.id)) + 1 : 1,
    [bookings]
  );
  const addBooking = () => setBookings((bs) => [
  ...bs,
  {
    id: bs.length ? Math.max(...bs.map((b) => b.id)) + 1 : 1,
    quantity: 1,
    job: "",
    // Default a new booking to all approved Setup locations — saves a click
    // when there's only one site, and is easy to trim down when there's more.
    locations: [...setupLocations]
  }]
  );
  const updateBooking = (id, patch) => setBookings((bs) => bs.map((b) => b.id === id ? { ...b, ...patch } : b));
  // Removing a booking also re-indexes the "Booking N" references that
  // every schedule holds: refs to the dropped booking are deleted, refs
  // above it slide down by one. Without this the schedule chips would
  // still read "Booking 3" after row 3 was removed.
  const removeBooking = (id) => {
    const idx = bookings.findIndex((b) => b.id === id);
    if (idx < 0) return;
    setBookings((bs) => bs.filter((b) => b.id !== id));
    setSchedules((ss) => ss.map((s) => ({
      ...s,
      bookings: (s.bookings || []).map((ref) => {
        const m = /(?:Work assignment|Booking)\s+(\d+)/i.exec(String(ref));
        if (!m) return ref;
        const n = +m[1];
        if (n === idx + 1) return null;
        if (n > idx + 1) return `Work assignment ${n - 1}`;
        return ref;
      }).filter(Boolean)
    })));
  };

  // ----- Schedule rows state -----------------------------------------
  const [schedules, setSchedules] = useStateNr(
    initialFilled ? DEFAULT_SCHEDULES : []
  );
  const addSchedule = () => setSchedules((ss) => [
  ...ss,
  { id: ss.length ? Math.max(...ss.map((s) => s.id)) + 1 : 1, dates: "", start: "", end: "", bookings: [] }]
  );
  const updateSchedule = (id, patch) => setSchedules((ss) => ss.map((s) => s.id === id ? { ...s, ...patch } : s));
  const removeSchedule = (id) => setSchedules((ss) => ss.filter((s) => s.id !== id));

  // Options shown in the Schedule's Bookings multiselect are derived
  // from whatever bookings currently exist on the page.
  const scheduleBookingOptions = useMemoNr(
    () => bookings.map((_, i) => `Work assignment ${i + 1}`),
    [bookings]
  );

  // v0.78 — Billing Basis × Time Capture, constrained per Engagement
  // Type. The pair is initialised from defaultsFor(engType) and re-snapped
  // whenever engType changes (via the picker). The Work Assignment
  // Advanced panel reads/writes this shared state for every booking.
  const _engInitDef = (window.EngagementType && window.EngagementType.defaultsFor)
    ? window.EngagementType.defaultsFor(engType)
    : { billingBasis: "Hourly", timeCapture: "Clock-in/out" };
  const [billingBasis, setBillingBasis] = useStateNr(__reqDraft.billingBasis || _engInitDef.billingBasis);
  const [timeCapture,  setTimeCapture]  = useStateNr(__reqDraft.timeCapture  || _engInitDef.timeCapture);
  // When engType changes (via the EngagementTypePicker), snap Billing
  // Basis × Time Capture to a valid pair for the new type. Preserve the
  // current selection when it's still in-bounds for the new type.
  useEffectNr(() => {
    if (!window.EngagementType || !window.EngagementType.normalizePair) return;
    const snap = window.EngagementType.normalizePair(engType, billingBasis, timeCapture);
    if (snap.billingBasis !== billingBasis) setBillingBasis(snap.billingBasis);
    if (snap.timeCapture  !== timeCapture)  setTimeCapture(snap.timeCapture);
  }, [engType]);

  // v0.78 \u2014 default the Setup "Fill at" level by engagement type.
  // Shift / Assignment default to Sites (the canonical headcount-by-site
  // pattern); Project / Statement of Work default to Corporate (one
  // budget, no per-site picker on each work assignment). The user can
  // still change the level afterward via the Setup card's pills.
  useEffectNr(() => {
    const next = (engType === "Project" || engType === "Statement of Work")
      ? "corporate"
      : "sites";
    if (next !== orgLevel) setOrgLevel(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engType]);

  // Mirror Create-page state into the module-level draft so the Review
  // page (a sibling route) can read what the user entered and compute
  // a real quote from it.
  useEffectNr(() => {
    __reqDraft.locations = setupLocations;
    __reqDraft.costCenters = setupCostCenters;
    __reqDraft.orgLevel = orgLevel;
    __reqDraft.regions = setupRegions;
    __reqDraft.districts = setupDistricts;
    __reqDraft.bookings = bookings;
    __reqDraft.schedules = schedules;
    // v0.77 three-axis tuple — persisted to the draft so placeOrder can
    // tag the new row with its axis cell. Defaults are byte-identical
    // to today (Shift × ClockInOut × Agency). Per-row rate-range overrides
    // live inside the bookings array itself.
    __reqDraft.billingModel = billingModel;
    __reqDraft.supplierType = supplierType;
    __reqDraft.supplierTypes = supplierTypes;
    __reqDraft.workflow = workflow;
    __reqDraft.interviewRequired = interviewRequired;
    __reqDraft.interviewByRole = interviewByRole;
    __reqDraft.engType = engType;
    __reqDraft.billingBasis = billingBasis;
    __reqDraft.timeCapture = timeCapture;
  }, [setupLocations, setupCostCenters, orgLevel, setupRegions, setupDistricts, bookings, schedules, billingModel, supplierType, supplierTypes, workflow, interviewRequired, interviewByRole, engType, billingBasis, timeCapture]);

  // ----- Side-panel state --------------------------------------------
  const [editLocOpen, setEditLocOpen] = useStateNr(false);
  const [editBkOpen, setEditBkOpen] = useStateNr(false);
  const [editBkData, setEditBkData] = useStateNr(null);
  const [schedShortOpen, setSchedShortOpen] = useStateNr(false);
  const [schedLongOpen, setSchedLongOpen] = useStateNr(false);
  const [activeSchedId, setActiveSchedId] = useStateNr(null);

  // Distribution panels — "View all" opens the preferred-workers picker
  // across every supplier; "Advanced" opens the priority window's Advanced
  // tab. A PriorityRow worker chip opens the per-supplier agency picker.
  const [priorityRows, setPriorityRows] = useStateNr(
    PRIORITY_DEFAULT.map((p) => ({ ...p, window: window.GLOBAL_DEFAULTS && window.GLOBAL_DEFAULTS.responseWindow || "30 min" }))
  );
  const [priorityPanelOpen, setPriorityPanelOpen] = useStateNr(false);
  // Initial tab for the priority panel — "priority" (default) or "advanced".
  const [priorityPanelTab, setPriorityPanelTab] = useStateNr("priority");
  const [allWorkersOpen, setAllWorkersOpen] = useStateNr(false);
  const [agencyPanelOpen, setAgencyPanelOpen] = useStateNr(false);
  const [agencyPanelFor, setAgencyPanelFor] = useStateNr(null);
  const [agencySelections, setAgencySelections] = useStateNr({}); // supplier -> [workerId]
  const openAgencyPanel = (supplierId) => {setAgencyPanelFor(supplierId);setAgencyPanelOpen(true);};
  const openPriorityPanel = (tab = "priority") => {setPriorityPanelTab(tab);setPriorityPanelOpen(true);};

  // Inherit distribution settings (method + default response window).
  const distributionSettings = window.GLOBAL_DEFAULTS || {};
  const distributionMethod = distributionSettings.distributionMethod || "count";
  const defaultResponseWindow = distributionSettings.responseWindow || "30 min";
  const advancedMode = window.papModeFromMethod ? window.papModeFromMethod(distributionMethod) : "manual";

  const openEditBooking = (b) => {setEditBkData(b);setEditBkOpen(true);};

  // ----- Template state -----------------------------------------------
  // Applied template id (null = no template). Applying a template mass-
  // prefills locations, cost centers, bookings, and schedules from the
  // chosen template. We track the applied id so the picker can show
  // "Template X applied" and a Change/Clear affordance.
  const [appliedTemplateId, setAppliedTemplateId] = useStateNr(null);
  const [saveAsTplOpen, setSaveAsTplOpen] = useStateNr(false);

  // ----- Engagement Type (explicit) ------------------------------------
  // The engType / billingBasis / timeCapture state + snap effect live
  // earlier in the component (above the draft-persisting useEffect) so
  // that effect's dependency array can read them without hitting a TDZ.

  // ----- Import state ------------------------------------------------
  // When the user imports a requisition from a CSV/XLSX file, we keep
  // the source summary (filename + row count + parsed shape) so the
  // picker can render an "Imported from file" chip with Replace/Clear.
  // Template and import are mutually exclusive starting points.
  const [importSource, setImportSource] = useStateNr(null);

  const applyTemplate = (tpl) => {
    if (!tpl) return;
    const draft = window.templateAsDraft ? window.templateAsDraft(tpl) : null;
    if (!draft) return;
    setSetupLocations(draft.locations);
    setSetupCostCenters(draft.costCenters);
    setBookings(draft.bookings);
    setSchedules(draft.schedules);
    setAppliedTemplateId(tpl.id);
    setImportSource(null);
    showToast(`Template "${tpl.name}" applied`, { kind: "success" });
  };
  const clearTemplate = () => {
    setAppliedTemplateId(null);
    showToast("Template cleared");
  };

  const applyImport = (payload) => {
    if (!payload) return;
    setSetupLocations(payload.locations || []);
    setSetupCostCenters(payload.costCenters || []);
    setBookings(payload.bookings || []);
    setSchedules(payload.schedules || []);
    setAppliedTemplateId(null);
    setImportSource(payload);
    showToast(`Imported ${payload.rowCount} rows from ${payload.fileName}`, { kind: "success" });
  };
  const clearImport = () => {
    setImportSource(null);
    showToast("Import cleared");
  };

  // ----- Header actions ----------------------------------------------
  const headerActions =
  <React.Fragment>
      <button
      type="button"
      className="btn btn--md btn--primary"
      onClick={() => onReview && onReview()}>
      
        Review
      </button>
      <button
      type="button"
      className="iconbtn"
      aria-label="More order actions"
      title="More actions"
      onClick={(e) => openMenu(e.currentTarget, [
      { icon: "Copy", label: "Save as template",
        onClick: () => setSaveAsTplOpen(true) }]
      )}>
      
        <Icon name="MoreVert" size={20} />
      </button>
    </React.Fragment>;


  // ----- Card 1 :: Setup ---------------------------------------------
  const setupCard =
  <SectionCard variant="compact" icon="Pin"
  iconColor="primary"
  title="Setup"
  subtitle="Where this requisition will run">
    
      <div className="sc-form">
        {professionalJobTypesOn &&
        <Field
          label="Fill at"
          required
          hint={orgLevelMeta.helper}>
            <div className="org-level-row" role="radiogroup" aria-label="Organization level">
              {ORG_LEVEL_ORDER.map((id) => {
                const meta = ORG_LEVEL_META[id];
                const on = orgLevel === id;
                return (
                  <button
                    key={id}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    className={"org-level-pill" + (on ? " org-level-pill--on" : "")}
                    onClick={() => setOrgLevel(id)}>
                    <Icon name={meta.icon} size={14} />
                    {meta.label}
                  </button>
                );
              })}
            </div>
          </Field>
        }
        {orgLevel === "regions" && professionalJobTypesOn &&
        <Field label="Region(s)" required hint="Work assignments can only use regions you select here.">
            <MultiSelect
              options={REGION_OPTIONS}
              value={setupRegions}
              onChange={setSetupRegions}
              placeholder="Select one or multiple" />
          </Field>
        }
        {orgLevel === "districts" && professionalJobTypesOn &&
        <Field label="District(s)" required hint="Work assignments can only use districts you select here.">
            <MultiSelect
              options={DISTRICT_OPTIONS}
              value={setupDistricts}
              onChange={setSetupDistricts}
              placeholder="Select one or multiple" />
          </Field>
        }
        {effectiveOrgLevel === "sites" &&
        <Field
        label="Site(s)"
        required
        hint="Work assignments can only use sites you select here.">
        
          <MultiSelect
          options={LOCATION_OPTIONS}
          value={setupLocations}
          onChange={setSetupLocations}
          placeholder="Select one or multiple" />
        
        </Field>
        }
        {effectiveOrgLevel === "sites" &&
        <Field label="Department(s)" required hint="Will split into On-Site Department + Labor Metric Code when Dayforce alignment ships.">
          <MultiSelect
          options={COST_CENTER_OPTIONS}
          value={setupCostCenters}
          onChange={setSetupCostCenters}
          placeholder="Select one or multiple" />
        
        </Field>
        }
        {orgLevel === "corporate" && professionalJobTypesOn &&
        <div className="org-level-corp-note" role="note">
            <Icon name="Information" size={16} />
            <span>This requisition will be filled at the organization level. Work assignments won't carry a specific region, district, or site.</span>
          </div>
        }
        <div className="sc-form-actions">
          <button type="button" className="btn btn--sm btn--tertiary" onClick={() => setEditLocOpen(true)}>
            <Icon name="Settings" size={14} />Advanced
          </button>
        </div>
      </div>
    </SectionCard>;


  // ----- Card 2 :: Bookings ------------------------------------------
  const bookingsCard =
  <SectionCard variant="compact" icon="Briefcase" title="Work assignments" subtitle="Define the roles and headcount you need">
      <div className="bk-list">
        {bookings.length === 0 ?
      <div className="bk-list-empty">
            <h3 className="sc-empty-title">No work assignments yet</h3>
            <p className="sc-empty-body">Add work assignments to define jobs you need for this requisition.</p>
            <button type="button" className="btn btn--sm btn--secondary" onClick={addBooking}>
              <Icon name="AddCircle" size={16} />Add work assignment
            </button>
          </div> :

      <React.Fragment>
            {bookings.map((b, i) =>
        <BookingRow
          key={b.id}
          index={i + 1}
          qty={b.quantity}
          job={b.job}
          locations={b.locations}
          options={orgLevelUnits}
          unitLabel={orgLevelMeta.unit}
          unitPlural={(orgLevelMeta.unit || "Site").toLowerCase() + "s"}
          unitFieldLabel={orgLevelMeta.unit === "Site" ? "Sites" : (orgLevelMeta.unit + "s")}
          unitVisible={effectiveOrgLevel !== "corporate"}
          jobOptions={jobOptionsLive}
          onEdit={() => openEditBooking(b)}
          onRemove={() => removeBooking(b.id)}
          onQtyChange={(n) => updateBooking(b.id, { quantity: n })}
          onJobChange={(j) => {
            // When the job changes, pull the role defaults into the
            // booking so a quick scan of the row matches what's saved.
            const def = window.getRoleDefaults && window.getRoleDefaults(j) || {};
            updateBooking(b.id, {
              job: j,
              level: b.level || def.level,
              responsibilities: b.responsibilities || def.responsibilities,
              instructions: b.instructions || def.instructions,
              attire: b.attire || def.attire,
              certs: b.certs && b.certs.length ? b.certs : def.certs || []
            });
          }}
          onLocationsChange={(next) => updateBooking(b.id, { locations: next })}
          onClearLocations={() => updateBooking(b.id, { locations: [] })} />

        )}
            <button type="button" className="bk-list-add" onClick={addBooking}>
              <Icon name="AddCircle" size={20} />
              <span className="bk-list-add-label">Add work assignment</span>
            </button>
          </React.Fragment>
      }
      </div>
    </SectionCard>;


  // ----- Card 3 :: Schedules -----------------------------------------
  const schedulesCard =
  <SectionCard variant="compact" icon="Calendar" title="Schedules" subtitle="When the work happens">
      <div className="bk-list">
        {schedules.length === 0 ?
      <div className="bk-list-empty">
            <h3 className="sc-empty-title">No schedules yet</h3>
            <p className="sc-empty-body">Create schedules for your work assignments.</p>
            <button type="button" className="btn btn--sm btn--secondary" onClick={addSchedule}>
              <Icon name="AddCircle" size={16} />Add schedule
            </button>
          </div> :

      <React.Fragment>
            {schedules.map((s, i) =>
        <ScheduleRow
          key={s.id}
          index={i + 1}
          dates={s.dates}
          start={s.start}
          end={s.end}
          bookings={s.bookings}
          customized={s.customized}
          options={scheduleBookingOptions}
          timeOptions={TIME_OPTIONS}
          onEdit={() => {setActiveSchedId(s.id);setSchedLongOpen(true);}}
          onRemove={() => removeSchedule(s.id)}
          onDatesChange={(v) => updateSchedule(s.id, { dates: v })}
          onStartChange={(v) => updateSchedule(s.id, { start: v })}
          onEndChange={(v) => updateSchedule(s.id, { end: v })}
          onBookingsChange={(next) => updateSchedule(s.id, { bookings: next })}
          onClearBookings={() => updateSchedule(s.id, { bookings: [] })} />

        )}
            <button type="button" className="bk-list-add" onClick={addSchedule}>
              <Icon name="AddCircle" size={20} />
              <span className="bk-list-add-label">Add schedule</span>
            </button>
          </React.Fragment>
      }
      </div>
    </SectionCard>;


  // ----- Card · Distribution ----------------------------------------
  const distributionCard =
  <SectionCard variant="compact" icon="PersonLines"
  title="Distribution"
  subtitle="Order your suppliers and worker priority"
  action={
  <button
    type="button"
    className="btn btn--md btn--secondary"
    onClick={() => openEditEntity({
      ...distributionRulesSchema(),
      onSave: () => showToast("Distribution rules saved", { kind: "success" })
    })}>
    
          <Icon name="Edit" size={16} />Edit
        </button>
  }>
    
      {/* Distribution access · v0.81 multi-select + reorder picker.
        Hidden when the org has only Agency enabled. Inherits its
        default order from window.GLOBAL_DEFAULTS.supplierTypes; buyers
        can re-order or drop entries per-requisition. Below the picker
        we render one sub-section per picked type, in cascade order. */}
      <NewReqSupplierTypesPicker
        value={supplierTypes}
        onChange={setSupplierTypes}
        contractorsOn={contractorsOn}
        eorOn={eorOn}
        floatOn={floatOn} />

      {/* Stacked per-type sub-sections. Each ACTIVE supplier type
        gets its own configurable body, in cascade order. Inactive
        types are skipped here (they remain in the picker above so
        the user can flip them back on without losing their config).
        When only one active type, the sub-section header collapses
        to a plain divider so the form is byte-identical to today. */}
      {supplierTypes
        .map((entry, originalIdx) => ({ entry, originalIdx }))
        .filter(({ entry }) => entry && entry.active)
        .map(({ entry, originalIdx }, activeIdx, activeArr) => {
        const stKey = entry.key;
        const meta = (window.SUPPLIER_TYPE_META && window.SUPPLIER_TYPE_META[stKey]) || { label: stKey, icon: "Building" };
        const showHeader = activeArr.length > 1;
        const cascadeLabel =
          activeIdx === 0 ? "First access" :
          activeIdx === 1 ? "Then" :
          activeIdx === 2 ? "Then" : "Finally";
        const waitChip = entry.wait && entry.wait !== "Immediate" ? entry.wait : null;
        return (
          <section key={stKey} className={"nr-st-sub nr-st-sub--" + stKey.toLowerCase()}>
            {showHeader && (
              <header className="nr-st-sub-head">
                <span className="nr-st-sub-rank tabular" aria-hidden="true">{originalIdx + 1}</span>
                <span className="nr-st-sub-icon"><Icon name={meta.icon} size={16} /></span>
                <span className="nr-st-sub-text">
                  <span className="nr-st-sub-cascade">{cascadeLabel}</span>
                  <span className="nr-st-sub-title">{meta.label}</span>
                </span>
                {waitChip && (
                  <span className="nr-st-sub-wait" title={`Invited ${waitChip} after publish`}>
                    <Icon name="Hourglass" size={12} />
                    Waits {waitChip}
                  </span>
                )}
                {activeIdx < activeArr.length - 1 && (
                  <span className="nr-st-sub-arrow" aria-hidden="true">
                    <Icon name="ChevronDown" size={14} />
                    Cascades when unfilled
                  </span>
                )}
              </header>
            )}

            {stKey === "Agency" &&
              <React.Fragment>
                <Banner
                  title="Distribution configuration"
                  onClose={() => {}}
                  action={{
                    label: "Open settings",
                    onClick: () => {
                      if (window.flexGoTo) window.flexGoTo({ page: "settings", sub: "supplier-distribution" });
                      else showToast("Opening supplier distribution settings");
                    }
                  }}>
                  This requisition uses an organization-wide distribution setup. You can change the priority
                  from this booking or modify the global settings.
                </Banner>

                <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 8 }}>
                  <div className="prio-section-head">
                    <span>Priority</span>
                    <span className="prio-section-actions">
                      <button
                        type="button"
                        className="linkbtn"
                        onClick={() => setAllWorkersOpen(true)}>
                        View all
                      </button>
                      <span className="prio-section-sep" aria-hidden="true">·</span>
                      <button
                        type="button"
                        className="linkbtn"
                        onClick={() => openPriorityPanel("advanced")}>
                        <Icon name="Settings" size={14} />
                        Advanced
                      </button>
                    </span>
                  </div>
                  <div className="prio-list">
                    {priorityRows.map((p) =>
                      <PriorityRow
                        key={p.rank}
                        rank={p.rank}
                        supplierId={p.supplier}
                        workers={p.workers}
                        onOpenAgency={openAgencyPanel} />
                    )}
                  </div>
                </div>
              </React.Fragment>
            }

            {stKey === "IndependentContractor" && <NewReqContractorDistributionBody />}
            {stKey === "EOR"                    && <NewReqEorDistributionBody />}
            {stKey === "Float"                  && <NewReqFloatDistributionBody />}
          </section>
        );
      })}

      {/* Interview-required section removed — workflow choice
        (Automatic / Interview) now lives in the Work Assignment
        Advanced panel. */}
    </SectionCard>;


  // ----- Card · Time & Materials (Billing) ------------------------
  // Last card in the form. Always shows all four T&M options; contextual
  // fields swap below based on the chosen model. Per-row rate ranges
  // live inside each Work Assignment booking, not on this card.
  const timeMaterialsCard =
  <NewReqTimeMaterialsCard
    value={billingModel}
    onChange={setBillingModel} />;



  return (
    <React.Fragment>
      <ReqOmnibar
        title="New order"
        subtitle="Requisitions"
        onBack={onBack}
        actions={headerActions} />
      

      <div className="req-wf">
        {/* Template or Import — first card, sets the starting point. */}
        {window.TemplatePicker &&
        <window.TemplatePicker
          appliedId={appliedTemplateId}
          onApply={applyTemplate}
          onClear={clearTemplate}
          importSource={importSource}
          onImport={applyImport}
          onClearImport={clearImport} />

        }

        {/* Engagement Type — first card after Template/Import. Hidden when
            every engagement-type flag is off (only Shift is enabled →
            nothing to pick). */}
        {window.EngagementTypePicker &&
        <window.EngagementTypePicker
          value={engType}
          onChange={setEngType} />

        }

        {/* v0.86 — Project-specific budget / NTE / currency intake. Only
            renders when engType === "Project" and the engProject flag is
            on. With the flag off, window.ProjectIntakeFields is undefined
            and the block is a no-op. The fields write to the local
            projectIntake state; on Review commit the underlying project
            record is created (see pages/project-engagement.jsx). */}
        {engType === "Project" && window.ProjectIntakeFields && window.PSProjects && window.PSProjects.isProjectOn() &&
          <window.ProjectIntakeFields form={projectIntake} onChange={setProjectIntake} />
        }

        {/* Setup → Work Assignment → Schedule (every requisition uses a
              schedule now; Work Type was removed). Per-row rate-range
              overrides live inside the Work Assignment booking rows. */}
        {setupCard}
        {/* v0.88 — SOW-specific intake card. Visible only when the
              Manager picks Statement of Work as the Engagement Type.
              Reads templates / fee schedules / retainage from
              sow-config.jsx; nothing rendered when SOW is off. */}
        {engType === "Statement of Work" && window.SowIntakeCard && (
          <window.SowIntakeCard />
        )}
        {bookingsCard}
        {schedulesCard}

        {/* v0.77 spec §08 · Time & Materials card sits BELOW Schedule.
              All four options always rendered; contextual fields swap per
              pick. Gated by `v77On` so flag-off form is byte-identical. */}
        {/* Time & Materials moved into the Work Assignment Advanced panel
              alongside Rate range and Workflow. */}

        {/* Distribution (with inline Supplier Type picker when any
              non-Agency supplier-type flag is on). When the user changes
              Supplier Type the Distribution body re-renders with
              contextual data — agency priority list for Agency, IC roster
              for Independent Contractor, EOR partners for EOR. The
              Edit side panel surfaces the Interview-required toggle when
              the interviews flag is on. */}
        {distributionCard}

        <footer className="req-footer">
          <span className="req-footer-saved">
            <Icon name="Save" size={20} />
            Draft saved 5 seconds ago
          </span>
          <span className="req-footer-actions">
            <button type="button" className="btn btn--lg btn--secondary" onClick={onBack}>Discard</button>
            <button
              type="button"
              className="btn btn--lg btn--primary"
              onClick={() => onReview && onReview()}>
              
              Review
            </button>
          </span>
        </footer>
      </div>

      {/* Side panels */}
      <EditLocationPanel
        open={editLocOpen}
        onClose={() => setEditLocOpen(false)}
        onSave={() => setEditLocOpen(false)} />
      
      <EditBookingPanel
        open={editBkOpen}
        booking={editBkData}
        jobOptions={jobOptionsLive}
        billingModel={billingModel}
        onBillingModelChange={setBillingModel}
        workflow={workflow}
        onWorkflowChange={setWorkflow}
        engType={engType}
        billingBasis={billingBasis}
        onBillingBasisChange={setBillingBasis}
        timeCapture={timeCapture}
        onTimeCaptureChange={setTimeCapture}
        onClose={() => setEditBkOpen(false)}
        onSave={(patch) => {
          if (editBkData) updateBooking(editBkData.id, patch);
          setEditBkOpen(false);
        }} />
      
      <AddScheduleShortPanel
        open={schedShortOpen}
        onClose={() => setSchedShortOpen(false)}
        onSave={() => setSchedShortOpen(false)} />
      
      <AddScheduleLongPanel
        open={schedLongOpen}
        onClose={() => setSchedLongOpen(false)}
        bookings={bookings}
        onSave={(payload) => {
          if (activeSchedId != null) {
            // Mirror the payload into the schedule row for downstream
            // surfaces (preview, review page) while preserving the
            // existing { dates, start, end, bookings } contract.
            const patch = { customized: true };
            if (payload) {
              if (payload.window) {
                patch.dates = payload.window.ongoing ?
                `From ${payload.window.start}` :
                `${payload.window.start} – ${payload.window.end}`;
              }
              if (payload.hours) {
                patch.start = payload.hours.start;
                patch.end = payload.hours.end;
              }
              if (Array.isArray(payload.bookingIds) && bookings.length) {
                patch.bookings = payload.bookingIds.
                map((bid) => {
                  const idx = bookings.findIndex((b) => b.id === bid);
                  return idx >= 0 ? `Work assignment ${idx + 1}` : null;
                }).
                filter(Boolean);
              }
              patch.recurringPayload = payload;
            }
            updateSchedule(activeSchedId, patch);
          }
          setSchedLongOpen(false);
        }} />
      

      {/* Distribution panels */}
      <PriorityAllPanel
        open={priorityPanelOpen}
        onClose={() => setPriorityPanelOpen(false)}
        value={priorityRows}
        onSave={(rows) => setPriorityRows(rows)}
        initialTab={priorityPanelTab}
        defaultMode={advancedMode}
        defaultWindow={defaultResponseWindow} />
      
      <AllPreferredWorkersPanel
        open={allWorkersOpen}
        onClose={() => setAllWorkersOpen(false)}
        suppliers={priorityRows.map((r) => r.supplier)}
        jobs={bookings.map((b) => b.job).filter(Boolean)}
        initialSelections={agencySelections}
        onSave={(map) => {
          setAgencySelections(map);
          // Reflect the count in the priority list so the chips update too.
          setPriorityRows((rs) => rs.map((r) => {
            const sel = map[r.supplier];
            if (sel && sel.length > 0) return { ...r, workers: sel.length };
            return r;
          }));
        }} />
      
      <AgencyWorkersPanel
        open={agencyPanelOpen}
        onClose={() => setAgencyPanelOpen(false)}
        supplierId={agencyPanelFor || "sw"}
        jobs={bookings.map((b) => b.job).filter(Boolean)}
        initialSelected={agencySelections[agencyPanelFor] || []}
        onSave={(ids) => {
          setAgencySelections((prev) => ({ ...prev, [agencyPanelFor]: ids }));
          setPriorityRows((rs) => rs.map((r) =>
          r.supplier === agencyPanelFor ? { ...r, workers: ids.length } : r
          ));
        }} />
      
      {window.SaveAsTemplatePanel &&
      <window.SaveAsTemplatePanel
        open={saveAsTplOpen}
        draft={{
          locations: setupLocations,
          costCenters: setupCostCenters,
          bookings,
          schedules
        }}
        onClose={() => setSaveAsTplOpen(false)}
        onSaved={() => setSaveAsTplOpen(false)} />

      }
    </React.Fragment>);

}

// ---------- Review page -----------------------------------------------

function ReviewRequisitionPage({ onBack, onOrder }) {
  const [breakdownOpen, setBreakdownOpen] = useStateNr(true);
  // Active "receipt" tab in the breakdown — "all" or a specific location
  // name. Reset to "all" automatically if the active location stops
  // appearing in the breakdown (e.g. user removed its booking).
  const [breakdownLoc, setBreakdownLoc] = useStateNr("all");

  // Pull the user-entered draft (locations, cost centers, bookings,
  // schedules) and rate overrides into local state so this page can edit
  // everything in place via context-aware side panels — no need to hop
  // back to the create step.
  const [reqLocations, setReqLocations] = useStateNr(__reqDraft.locations || []);
  const [reqCostCenters, setReqCostCenters] = useStateNr(__reqDraft.costCenters || []);
  const [reqBookings, setReqBookings] = useStateNr(__reqDraft.bookings || []);
  const [reqSchedules, setReqSchedules] = useStateNr(__reqDraft.schedules || []);
  const [rateOverrides, setRateOverrides] = useStateNr(__reqDraft.rateOverrides || {});
  // v0.77 axis state · mirrors the create page so the same Advanced
  // panel can edit Time & materials and Workflow from Review.
  const [reqBillingModel, setReqBillingModel] = useStateNr(__reqDraft.billingModel || "ClockInOut");
  const [reqWorkflow, setReqWorkflow] = useStateNr(__reqDraft.workflow || "automatic");
  // v0.78 — engagement type + billing basis × time capture for the
  // Review page's booking edit panel. Initialised from the same draft
  // values the Create page wrote.
  const [reqEngType,      setReqEngType]      = useStateNr(__reqDraft.engType      || "Shift");
  const _reqInitDef = (window.EngagementType && window.EngagementType.defaultsFor)
    ? window.EngagementType.defaultsFor(reqEngType)
    : { billingBasis: "Hourly", timeCapture: "Clock-in/out" };
  const [reqBillingBasis, setReqBillingBasis] = useStateNr(__reqDraft.billingBasis || _reqInitDef.billingBasis);
  const [reqTimeCapture,  setReqTimeCapture]  = useStateNr(__reqDraft.timeCapture  || _reqInitDef.timeCapture);
  // Live job catalog \u2014 reads from the jobs-config store so admin
  // edits in Settings \u2192 Jobs land here without a navigation
  // round-trip. Re-resolves on flag flips + on jobs:change.
  const professionalJobTypesOnRev = window.useFeatureFlag ? window.useFeatureFlag("professionalJobTypes") : false;
  const [jobsTickRev, setJobsTickRev] = useStateNr(0);
  useEffectNr(() => {
    function onJobs() { setJobsTickRev((n) => n + 1); }
    window.addEventListener("jobs:change", onJobs);
    return () => window.removeEventListener("jobs:change", onJobs);
  }, []);
  const jobOptionsLiveRev = useMemoNr(
    () => getJobOptions(),
    [professionalJobTypesOnRev, jobsTickRev]
  );

  // Mirror review-page edits back into the module-level draft so the
  // create page (a sibling route) and the order placer see them.
  useEffectNr(() => {
    __reqDraft.locations = reqLocations;
    __reqDraft.costCenters = reqCostCenters;
    __reqDraft.bookings = reqBookings;
    __reqDraft.schedules = reqSchedules;
    __reqDraft.billingModel = reqBillingModel;
    __reqDraft.workflow = reqWorkflow;
    __reqDraft.engType = reqEngType;
    __reqDraft.billingBasis = reqBillingBasis;
    __reqDraft.timeCapture = reqTimeCapture;
  }, [reqLocations, reqCostCenters, reqBookings, reqSchedules, reqBillingModel, reqWorkflow, reqEngType, reqBillingBasis, reqTimeCapture]);

  // Update / remove helpers used by the in-page edit sidebars.
  const updateBooking = (id, patch) =>
  setReqBookings((arr) => arr.map((b) => b.id === id ? { ...b, ...patch } : b));
  const updateSchedule = (id, patch) =>
  setReqSchedules((arr) => arr.map((s) => s.id === id ? { ...s, ...patch } : s));
  const removeSchedule = (id) =>
  setReqSchedules((arr) => arr.filter((s) => s.id !== id));

  // Side-panel state for the in-place edit affordances. Only one panel
  // is ever open at a time — opening one closes whatever else is open.
  const [editSetupOpen, setEditSetupOpen] = useStateNr(false);
  const [editStaffingOpen, setEditStaffingOpen] = useStateNr(false);
  const [editSchedTarget, setEditSchedTarget] = useStateNr(null);
  const [editBkTarget, setEditBkTarget] = useStateNr(null);

  const openEditSetup = () => {setEditStaffingOpen(false);setEditSchedTarget(null);setEditBkTarget(null);setEditSetupOpen(true);};
  const openEditStaffing = () => {setEditSetupOpen(false);setEditSchedTarget(null);setEditBkTarget(null);setEditStaffingOpen(true);};
  const openEditSchedule = (s) => {setEditStaffingOpen(false);setEditSetupOpen(false);setEditBkTarget(null);setEditSchedTarget(s);};
  const openEditBookingP = (b) => {setEditStaffingOpen(false);setEditSetupOpen(false);setEditSchedTarget(null);setEditBkTarget(b);};

  // Schedules grouped for the Staffing card — carries scheduleId +
  // bookingId references so each row's "Edit" can open the right
  // sub-panel.
  const reviewSchedules = useMemoNr(() => {
    return (reqSchedules || []).map((s) => {
      const refs = s.bookings || [];
      const linked = refs.map((ref) => {
        const m = /(?:Work assignment|Booking)\s+(\d+)/i.exec(String(ref));
        if (!m) return null;
        const idx = +m[1] - 1;
        const bk = reqBookings[idx];
        if (!bk) return null;
        return {
          bookingId: bk.id,
          booking: bk,
          num: parseInt(bk.quantity, 10) || 0,
          label: bk.job
        };
      }).filter(Boolean);
      const timeLabel = s.start && s.end ? `${s.start} – ${s.end}` : "Time not set";
      return {
        scheduleId: s.id,
        schedule: s,
        when: s.dates || "Dates not set",
        time: timeLabel,
        customRules: !!s.customized,
        bookings: linked
      };
    });
  }, [reqSchedules, reqBookings]);

  // Quote breakdown + totals — sum is the exact same set of numbers shown
  // in the per-row table, so the headline always matches the breakdown.
  const breakdown = useMemoNr(
    () => buildBreakdown(reqBookings, reqSchedules, rateOverrides),
    [reqBookings, reqSchedules, rateOverrides]
  );

  // Snap the receipt tab back to "all" if the location it pointed at is
  // no longer present (rate edit, booking change, etc.). Without this the
  // breakdown table can render empty after an unrelated change.
  useEffectNr(() => {
    if (breakdownLoc !== "all" && !breakdown.byLocation[breakdownLoc]) {
      setBreakdownLoc("all");
    }
  }, [breakdown, breakdownLoc]);

  // Rows + totals for whatever tab is active. "all" pulls the full set;
  // a location tab pulls just that receipt.
  const activeReceipt = breakdownLoc === "all" ?
  { rows: breakdown.rows, totalLow: breakdown.totalLow, totalHigh: breakdown.totalHigh, totalMid: breakdown.totalMid } :
  breakdown.byLocation[breakdownLoc] || { rows: [], totalLow: 0, totalHigh: 0, totalMid: 0 };

  // Jobs appearing in this requisition, in order of first use. Used to
  // build a dynamic "Edit quote" schema with one field per real job.
  const jobsInUse = useMemoNr(() => {
    const seen = new Set();
    const out = [];
    for (const b of reqBookings) {
      if (b && b.job && !seen.has(b.job)) {
        seen.add(b.job);
        out.push(b.job);
      }
    }
    return out;
  }, [reqBookings]);

  const openEditQuote = () => {
    const initial = {};
    const fields = jobsInUse.map((job) => {
      const r = rateFor(job, rateOverrides);
      const key = "rate_" + job;
      initial[key] = fmtRate(r.low, r.high).replace("\u2013", " \u2013 ");
      return { key, label: job };
    });
    if (fields.length === 0) {
      showToast("Add work assignments first to set rates", { kind: "warning" });
      return;
    }
    openEditEntity({
      title: "Edit quote",
      subtitle: "Adjust the bill-rate range used to estimate this requisition.",
      initial,
      sections: [{ title: "Job rates", fields }],
      onSave: (values) => {
        const next = { ...rateOverrides };
        for (const job of jobsInUse) {
          const parsed = parseRateInput(values["rate_" + job]);
          if (parsed) next[job] = parsed;
        }
        setRateOverrides(next);
        __reqDraft.rateOverrides = next;
        showToast("Quote saved", { kind: "success" });
      }
    });
  };

  // Distribution panels — same wiring as on the create page so review
  // stays consistent with the configured priority.
  const [priorityRows, setPriorityRows] = useStateNr(
    PRIORITY_DEFAULT.map((p) => ({ ...p, window: window.GLOBAL_DEFAULTS && window.GLOBAL_DEFAULTS.responseWindow || "30 min" }))
  );
  const [priorityPanelOpen, setPriorityPanelOpen] = useStateNr(false);
  const [priorityPanelTab, setPriorityPanelTab] = useStateNr("priority");
  const [allWorkersOpen, setAllWorkersOpen] = useStateNr(false);
  const [agencyPanelOpen, setAgencyPanelOpen] = useStateNr(false);
  const [agencyPanelFor, setAgencyPanelFor] = useStateNr(null);
  const [agencySelections, setAgencySelections] = useStateNr({});
  const openAgencyPanel = (supplierId) => {setAgencyPanelFor(supplierId);setAgencyPanelOpen(true);};
  const openPriorityPanel = (tab = "priority") => {setPriorityPanelTab(tab);setPriorityPanelOpen(true);};

  // Inherit distribution settings (method + default response window).
  const distributionSettings = window.GLOBAL_DEFAULTS || {};
  const distributionMethod = distributionSettings.distributionMethod || "count";
  const defaultResponseWindow = distributionSettings.responseWindow || "30 min";
  const advancedMode = window.papModeFromMethod ? window.papModeFromMethod(distributionMethod) : "manual";

  // Build a new requisition row from the draft + computed quote and
  // push it onto the shared REQUISITIONS list so the list and details
  // pages see it on next render. Returns the new id, or null if nothing
  // was entered (no bookings or no schedules — guard so we don't add
  // an empty placeholder).
  const placeOrder = () => {
    if (!reqBookings.length) {
      showToast("Add at least one work assignment before ordering", { kind: "warning" });
      return null;
    }
    if (!reqSchedules.length) {
      showToast("Add at least one schedule before ordering", { kind: "warning" });
      return null;
    }
    // Random 10-char alphanumeric id, formatted like existing seed rows.
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let id = "";
    for (let i = 0; i < 10; i++) id += chars[Math.floor(Math.random() * chars.length)];

    // Compress each schedule's date range to the "Apr 27 – 29" style
    // used by REQUISITIONS rows (strip ", 2026" year suffix).
    const dates = reqSchedules.
    map((s) => (s.dates || "").replace(/,\s*\d{4}/, "").trim()).
    filter(Boolean);

    const uniqueJobs = [];
    const seenJob = new Set();
    let qtyTotal = 0;
    for (const b of reqBookings) {
      if (b.job && !seenJob.has(b.job)) {seenJob.add(b.job);uniqueJobs.push(b.job);}
      qtyTotal += parseInt(b.quantity, 10) || 0;
    }

    const first = reqSchedules[0];
    const time = first && first.start && first.end ? `${first.start} – ${first.end}` : "TBD";
    const suppliers = priorityRows.filter((p) => p.workers > 0).map((p) => p.supplier);
    const now = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    const placed = `${pad(now.getMonth() + 1)}.${pad(now.getDate())}.${now.getFullYear()}, ${pad((now.getHours() + 11) % 12 + 1)}:${pad(now.getMinutes())} ${now.getHours() >= 12 ? "PM" : "AM"}`;

    const row = {
      id,
      status: "Booked",
      dates: dates.length ? dates : ["TBD"],
      jobs: uniqueJobs.length ? uniqueJobs : ["Production Associate"],
      qty: qtyTotal || reqBookings.length,
      time,
      breakLabel: "30 min break",
      location: reqLocations && reqLocations[0] || "TBD",
      costCenter: reqCostCenters && reqCostCenters[0] || "TBD",
      bookedBy: "You",
      placed,
      suppliers: suppliers.length ? suppliers : ["sw"],
      bill: fmtUSD(breakdown.totalMid),
      // v0.77 axis tag — picked up by axis-scope-bar list filters and the
      // requisition detail page's section composer. Work Type is no longer
      // user-selected; defaults to "Shift" since every requisition uses a
      // schedule. Rate ranges live per-booking inside the bookings array.
      workType: "Shift",
      billingModel: __reqDraft.billingModel || "ClockInOut",
      supplierType: __reqDraft.supplierType || "Agency",
      supplierTypes: Array.isArray(__reqDraft.supplierTypes) && __reqDraft.supplierTypes.length
        ? __reqDraft.supplierTypes
        : [__reqDraft.supplierType || "Agency"],
      // v0.78 — engagement type + billing basis × time capture pair set
      // on the requisition. Engagement-type column / filter chip on
      // the list reads engagementType; billingBasis / timeCapture are
      // surfaced on the detail page Engagement Model accordion.
      engagementType: __reqDraft.engType    || "Shift",
      billingBasis:   __reqDraft.billingBasis || "Hourly",
      timeCapture:    __reqDraft.timeCapture  || "Clock-in/out",
      interviewRequired: !!__reqDraft.interviewRequired,
      interviewByRole: __reqDraft.interviewByRole || {}
    };

    if (Array.isArray(window.REQUISITIONS)) {
      // Insert at the top so the new requisition is visible on page 1.
      window.REQUISITIONS.unshift(row);
    }
    // Reset the draft so the next Create flow starts fresh.
    __reqDraft.locations = [];
    __reqDraft.costCenters = [];
    __reqDraft.bookings = [];
    __reqDraft.schedules = [];
    __reqDraft.rateOverrides = {};
    __reqDraft.billingModel = "ClockInOut";
    __reqDraft.supplierType = "Agency";
    __reqDraft.supplierTypes = [{ key: "Agency", active: true, wait: "Immediate" }];
    __reqDraft.interviewRequired = false;
    __reqDraft.interviewByRole = {};
    __reqDraft.engType      = "Shift";
    __reqDraft.billingBasis = "Hourly";
    __reqDraft.timeCapture  = "Clock-in/out";
    return id;
  };

  const handleOrder = () => {
    const newId = placeOrder();
    if (newId) {
      showToast("Requisition placed", { kind: "success" });
      if (onOrder) onOrder(newId);
    }
  };

  return (
    <React.Fragment>
      <ReqOmnibar
        title="New order"
        subtitle="Requisitions"
        onBack={onBack}
        actions={
        <button
          type="button"
          className="btn btn--md btn--primary"
          onClick={handleOrder}>
          
            Order
          </button>
        } />
      

      <div className="req-wf">
        {/* Setup */}
        <SectionCard variant="compact" icon="Pin"
        title="Setup"
        subtitle="Where this requisition will run"
        action={
        <button
          type="button"
          className="btn btn--md btn--secondary"
          onClick={openEditSetup}>
          
              <Icon name="Edit" size={16} />Edit
            </button>
        }>
          
          <div className="sc-inner" style={{ padding: 20 }}>
            <div className="summary-row" style={{ marginBottom: 16 }}>
              <span className="summary-row-label">Site(s)</span>
              <div className="summary-chips">
                {reqLocations.length === 0 ?
                <span className="summary-chip" style={{ color: "var(--evr-content-primary-lowemp)" }}>None selected</span> :
                reqLocations.map((l) =>
                <span className="summary-chip" key={l}>{l}</span>
                )}
              </div>
            </div>
            <hr className="summary-divider" />
            <div className="summary-row" style={{ marginTop: 16 }}>
              <span className="summary-row-label" title="Dayforce calls this On-Site Department">Departments</span>
              <div className="summary-chips">
                {reqCostCenters.length === 0 ?
                <span className="summary-chip" style={{ color: "var(--evr-content-primary-lowemp)" }}>None selected</span> :
                reqCostCenters.map((l) =>
                <span className="summary-chip" key={l}>{l}</span>
                )}
              </div>
            </div>
          </div>
        </SectionCard>

        {/* Staffing — schedules + their bookings */}
        <SectionCard variant="compact" icon="PersonLines"
        title="Staffing"
        subtitle="When the work happens and what's booked"
        action={
        <button
          type="button"
          className="btn btn--md btn--secondary"
          onClick={openEditStaffing}>
          
              <Icon name="Edit" size={16} />Edit
            </button>
        }>
          
          <div className="rev-staff">
            {reviewSchedules.length === 0 &&
            <div style={{ padding: 20, color: "var(--evr-content-primary-lowemp)", font: "var(--evr-body2)" }}>
                No schedules added yet. Go back to add work assignments and schedules.
              </div>
            }
            {reviewSchedules.map((s, i) =>
            <div className="rev-staff-row" key={i}>
                <div className="rev-staff-when">
                  <div className="rev-staff-when-head">
                    <div className="rev-staff-when-stack">
                      <span className="rev-staff-when-date">{s.when}</span>
                      <span className="rev-staff-when-time">{s.time}</span>
                    </div>
                    <div className="rev-staff-when-actions">
                      <button type="button" className="icon-btn" aria-label="View schedule" title="View" onClick={() => showToast(`Preview schedule: ${s.when}`)}>
                        <Icon name="View" size={16} />
                      </button>
                      <button type="button" className="icon-btn" aria-label="Edit schedule" title="Edit" onClick={() => openEditSchedule(s.schedule)}>
                        <Icon name="Edit" size={16} />
                      </button>
                    </div>
                  </div>
                  {s.customRules &&
                <span className="rev-staff-custom">
                      <Icon name="Adjustment" size={14} />Custom rules
                    </span>
                }
                </div>
                <div className="rev-staff-jobs">
                  {s.bookings.map((b, j) =>
                <div className="rev-staff-job" key={j}>
                      <span className="rev-staff-job-num">{b.num}</span>
                      <span className="rev-staff-job-label">{b.label}</span>
                      <span className="rev-staff-job-actions">
                        <button
                      type="button"
                      className="icon-btn"
                      aria-label="View booking"
                      title="View"
                      onClick={() => showToast(`Preview: ${b.num} ${b.label}`)}>
                      
                          <Icon name="View" size={16} />
                        </button>
                        <button
                      type="button"
                      className="icon-btn"
                      aria-label="Edit booking"
                      title="Edit"
                      onClick={() => openEditBookingP(b.booking)}>
                      
                          <Icon name="Edit" size={16} />
                        </button>
                      </span>
                    </div>
                )}
                </div>
              </div>
            )}
          </div>
        </SectionCard>

        {/* Distribution / Priority */}
        <SectionCard variant="compact" icon="PersonLines"
        title="Distribution"
        subtitle="Suppliers ranked by priority"
        action={
        <button
          type="button"
          className="btn btn--md btn--secondary"
          onClick={() => setPriorityPanelOpen(true)}>
          
              <Icon name="Edit" size={16} />Edit
            </button>
        }>
          
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div className="prio-section-head">
              <span>Priority</span>
              <span className="prio-section-actions">
                <button
                  type="button"
                  className="linkbtn"
                  onClick={() => setAllWorkersOpen(true)}>
                  
                  View all
                </button>
                <span className="prio-section-sep" aria-hidden="true">·</span>
                <button
                  type="button"
                  className="linkbtn"
                  onClick={() => openPriorityPanel("advanced")}>
                  
                  <Icon name="Settings" size={14} />
                  Advanced
                </button>
              </span>
            </div>
            <div className="prio-list">
              {priorityRows.map((p) =>
              <PriorityRow
                key={p.rank}
                rank={p.rank}
                supplierId={p.supplier}
                workers={p.workers}
                onOpenAgency={openAgencyPanel} />

              )}
            </div>
          </div>
        </SectionCard>

        {/* Quote */}
        <SectionCard variant="compact" icon="Pay"
        title="Quote"
        subtitle="Estimated bill for the work above"
        action={
        <button
          type="button"
          className="btn btn--md btn--secondary"
          onClick={openEditQuote}>
          
              <Icon name="Edit" size={16} />Edit
            </button>
        }>
          
          <div className="quote-banner">
            <span className="quote-banner-label">
              Est. Quote
              {breakdown.locations.length > 1 &&
              <span className="quote-banner-sub tabular">
                  across {breakdown.locations.length} locations
                </span>
              }
            </span>
            <span className="quote-banner-value tabular">{fmtUSD(breakdown.totalMid)}</span>
            <span className="quote-banner-range">
              <Icon name="Information" size={14} />
              <strong className="tabular">{fmtUSD(breakdown.totalLow)} – {fmtUSD(breakdown.totalHigh)}</strong>
              <span style={{ color: "var(--evr-content-primary-lowemp)" }}>
                Estimated range based on supplier bill rates for selected jobs.
              </span>
            </span>
          </div>

          <div style={{ marginTop: 8 }}>
            <button
              type="button"
              className="brk-toggle"
              onClick={() => setBreakdownOpen((o) => !o)}
              aria-expanded={breakdownOpen}>
              
              <Icon
                name="ChevronDown"
                size={18}
                style={{
                  transform: breakdownOpen ? "rotate(0deg)" : "rotate(-90deg)",
                  transition: "transform 150ms cubic-bezier(0.4,0,0.2,1)"
                }} />
              
              <span>Breakdown</span>
            </button>
            {breakdownOpen && breakdown.locations.length > 1 &&
            <div className="fw-tabs brk-loc-tabs" role="tablist" aria-label="Receipt by site" style={{ marginTop: 12 }}>
                <button
                type="button"
                role="tab"
                aria-pressed={breakdownLoc === "all"}
                className="fw-tab"
                onClick={() => setBreakdownLoc("all")}>
                
                  <Icon name="Pin" size={16} />All sites
                  <span className="fw-tab-count tabular">{fmtUSD(breakdown.totalMid)}</span>
                </button>
                {breakdown.locations.map((loc) => {
                const b = breakdown.byLocation[loc];
                return (
                  <button
                    key={loc}
                    type="button"
                    role="tab"
                    aria-pressed={breakdownLoc === loc}
                    className="fw-tab"
                    onClick={() => setBreakdownLoc(loc)}>
                    
                      {loc}
                      <span className="fw-tab-count tabular">{fmtUSD(b.totalMid)}</span>
                    </button>);

              })}
              </div>
            }
            {breakdownOpen &&
            <div className={"brk-tbl" + (breakdownLoc === "all" && breakdown.locations.length > 1 ? " brk-tbl--with-loc" : "")} style={{ marginTop: 8 }}>
                <div className="brk-tbl-head">
                  {breakdownLoc === "all" && breakdown.locations.length > 1 && <span>Site</span>}
                  <span>Date</span>
                  <span>Job</span>
                  <span>Qty</span>
                  <span>Schedule</span>
                  <span>Duration</span>
                  <span>Rate range</span>
                  <span style={{ textAlign: "right" }}>Est. Bill</span>
                </div>
                {activeReceipt.rows.length === 0 &&
              <div className="brk-tbl-row" style={{ color: "var(--evr-content-primary-lowemp)" }}>
                    <span style={{ gridColumn: "1 / -1", padding: "12px 0" }}>
                      No billable lines yet — add work assignments and schedules to see the breakdown.
                    </span>
                  </div>
              }
                {activeReceipt.rows.map((row, i) =>
              <div className="brk-tbl-row" key={i}>
                    {breakdownLoc === "all" && breakdown.locations.length > 1 && <span>{row.location}</span>}
                    <span className="tabular">{row.date}</span>
                    <span>{row.job}</span>
                    <span className="tabular">{row.qty}</span>
                    <span>{row.schedule}</span>
                    <span>{row.duration}</span>
                    <span>{row.rate}</span>
                    <span className="brk-tbl-bill tabular">{fmtUSD(row.billMid)}</span>
                  </div>
              )}
                {activeReceipt.rows.length > 0 &&
              <div className="brk-tbl-row brk-tbl-foot">
                    <span style={{ gridColumn: "1 / -2" }}>
                      {breakdownLoc === "all" ?
                  `Total · ${breakdown.locations.length} ${breakdown.locations.length === 1 ? "site" : "sites"}` :
                  `Receipt · ${breakdownLoc}`}
                      <span className="brk-tbl-foot-range tabular">
                        {fmtUSD(activeReceipt.totalLow)} – {fmtUSD(activeReceipt.totalHigh)}
                      </span>
                    </span>
                    <span className="brk-tbl-bill tabular">{fmtUSD(activeReceipt.totalMid)}</span>
                  </div>
              }
              </div>
            }
          </div>
        </SectionCard>

        <footer className="req-footer">
          <span className="req-footer-saved">
            <Icon name="Save" size={20} />
            Draft saved 5 seconds ago
          </span>
          <span className="req-footer-actions">
            <button type="button" className="btn btn--lg btn--secondary" onClick={onBack}>Back</button>
            <button
              type="button"
              className="btn btn--lg btn--primary"
              onClick={handleOrder}>
              
              Order
            </button>
          </span>
        </footer>
      </div>

      {/* Distribution panels (Review) */}
      <PriorityAllPanel
        open={priorityPanelOpen}
        onClose={() => setPriorityPanelOpen(false)}
        value={priorityRows}
        onSave={(rows) => setPriorityRows(rows)}
        initialTab={priorityPanelTab}
        defaultMode={advancedMode}
        defaultWindow={defaultResponseWindow} />
      
      <AllPreferredWorkersPanel
        open={allWorkersOpen}
        onClose={() => setAllWorkersOpen(false)}
        suppliers={priorityRows.map((r) => r.supplier)}
        jobs={[]}
        initialSelections={agencySelections}
        onSave={(map) => {
          setAgencySelections(map);
          setPriorityRows((rs) => rs.map((r) => {
            const sel = map[r.supplier];
            if (sel && sel.length > 0) return { ...r, workers: sel.length };
            return r;
          }));
        }} />
      
      <AgencyWorkersPanel
        open={agencyPanelOpen}
        onClose={() => setAgencyPanelOpen(false)}
        supplierId={agencyPanelFor || "sw"}
        jobs={[]}
        initialSelected={agencySelections[agencyPanelFor] || []}
        onSave={(ids) => {
          setAgencySelections((prev) => ({ ...prev, [agencyPanelFor]: ids }));
          setPriorityRows((rs) => rs.map((r) =>
          r.supplier === agencyPanelFor ? { ...r, workers: ids.length } : r
          ));
        }} />
      

      {/* In-place edit sidebars — one per card on the confirmation. */}
      <EditSetupPanel
        open={editSetupOpen}
        locations={reqLocations}
        costCenters={reqCostCenters}
        onClose={() => setEditSetupOpen(false)}
        onSave={({ locations, costCenters }) => {
          setReqLocations(locations);
          setReqCostCenters(costCenters);
          // Trim each booking's locations to the new approved set so we
          // don't end up with bookings pointing at sites the user just
          // removed from Setup.
          setReqBookings((bs) => bs.map((b) => ({
            ...b,
            locations: (b.locations || []).filter((l) => locations.includes(l))
          })));
          setEditSetupOpen(false);
          showToast("Setup saved", { kind: "success" });
        }} />
      

      <EditStaffingOverviewPanel
        open={editStaffingOpen}
        schedules={reviewSchedules}
        onClose={() => setEditStaffingOpen(false)}
        onEditSchedule={openEditSchedule}
        onEditBooking={openEditBookingP}
        onRemoveSchedule={(id) => {
          removeSchedule(id);
          showToast("Schedule removed");
        }} />
      

      <EditSchedulePanel
        open={!!editSchedTarget}
        schedule={editSchedTarget}
        bookingOptions={(reqBookings || []).map((b, i) => `Work assignment ${i + 1}`)}
        onClose={() => setEditSchedTarget(null)}
        onSave={(patch) => {
          if (editSchedTarget) updateSchedule(editSchedTarget.id, patch);
          setEditSchedTarget(null);
          showToast("Schedule saved", { kind: "success" });
        }}
        onDelete={() => {
          if (editSchedTarget) removeSchedule(editSchedTarget.id);
          setEditSchedTarget(null);
          showToast("Schedule removed");
        }} />
      

      <EditBookingPanel
        open={!!editBkTarget}
        booking={editBkTarget}
        jobOptions={jobOptionsLiveRev}
        billingModel={reqBillingModel}
        onBillingModelChange={setReqBillingModel}
        workflow={reqWorkflow}
        onWorkflowChange={setReqWorkflow}
        engType={reqEngType}
        billingBasis={reqBillingBasis}
        onBillingBasisChange={setReqBillingBasis}
        timeCapture={reqTimeCapture}
        onTimeCaptureChange={setReqTimeCapture}
        onClose={() => setEditBkTarget(null)}
        onSave={(patch) => {
          if (editBkTarget) updateBooking(editBkTarget.id, patch);
          setEditBkTarget(null);
        }} />
      
    </React.Fragment>);

}

// =====================================================================
// Confirmation-page edit sidebars
// =====================================================================
// One sidebar per card on the New Order confirmation screen — each one
// scoped to the data its card owns. Saves write back into the local
// ReviewRequisitionPage state, which mirrors into __reqDraft so the
// next render of the confirmation (and the Order button's placeOrder)
// see the new values.

function EditSetupPanel({ open, locations, costCenters, onClose, onSave }) {
  const [locs, setLocs] = useStateNr(locations || []);
  const [ccs, setCCs] = useStateNr(costCenters || []);
  // Re-seed when the panel opens so a Cancel-then-reopen shows the
  // current committed values, not stale draft state.
  useEffectNr(() => {
    if (open) {setLocs(locations || []);setCCs(costCenters || []);}
  }, [open]);

  return (
    <SidePanel
      open={open}
      title="Edit setup"
      onClose={onClose}
      footer={
      <React.Fragment>
          <button type="button" className="btn btn--lg btn--tertiary" onClick={onClose}>Cancel</button>
          <button
          type="button"
          className="btn btn--lg btn--primary"
          onClick={() => onSave && onSave({ locations: locs, costCenters: ccs })}>
          
            Save setup
          </button>
        </React.Fragment>
      }>
      
      <p style={{ margin: "-4px 0 16px", font: "var(--evr-body2)", color: "var(--evr-content-primary-default)" }}>
        Where this requisition will run. Bookings can only use locations you select here.
      </p>
      <div>
        <h3 className="sp-section-title">Sites</h3>
        <Field label="Site(s)" required>
          <MultiSelect
            options={LOCATION_OPTIONS}
            value={locs}
            onChange={setLocs}
            placeholder="Select one or multiple" />
          
        </Field>
      </div>

      <hr className="sp-divider" />

      <div>
        <h3 className="sp-section-title">Departments</h3>
        <Field label="Department(s)" required>
          <MultiSelect
            options={COST_CENTER_OPTIONS}
            value={ccs}
            onChange={setCCs}
            placeholder="Select one or multiple" />
          
        </Field>
      </div>
    </SidePanel>);

}

// Overview panel — lists every schedule + its bookings with edit / delete
// affordances. Per-row Edit drills into the focused per-schedule or
// per-booking panel; this overview is the "all the details about
// staffing in one place" sibling the user expects from the Staffing
// card's Edit action.
function EditStaffingOverviewPanel({ open, schedules, onClose, onEditSchedule, onEditBooking, onRemoveSchedule }) {
  return (
    <SidePanel
      open={open}
      title="Edit staffing"
      onClose={onClose}
      footer={
      <button type="button" className="btn btn--lg btn--primary" onClick={onClose}>
          Done
        </button>
      }>
      
      <p style={{ margin: "-4px 0 16px", font: "var(--evr-body2)", color: "var(--evr-content-primary-default)" }}>
        Edit the schedule and bookings on this requisition. Changes save automatically.
      </p>

      {schedules.length === 0 &&
      <div
        className="sc-inner sc-inner--empty"
        style={{ minHeight: 88, padding: 16, textAlign: "center" }}>
        
          <p style={{ margin: 0, color: "var(--evr-content-primary-lowemp)", font: "var(--evr-body2)" }}>
            No schedules added yet. Go back to the create step to add work assignments and schedules.
          </p>
        </div>
      }

      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {schedules.map((s) =>
        <div className="rev-staff-row" key={s.scheduleId} style={{ border: "1px solid var(--evr-border-decorative-lowemp)", borderRadius: "var(--evr-radius-2xs)" }}>
            <div className="rev-staff-when">
              <div className="rev-staff-when-head">
                <div className="rev-staff-when-stack">
                  <span className="rev-staff-when-date">{s.when}</span>
                  <span className="rev-staff-when-time">{s.time}</span>
                </div>
                <div className="rev-staff-when-actions">
                  <button
                  type="button"
                  className="icon-btn"
                  aria-label="Edit schedule"
                  title="Edit schedule"
                  onClick={() => onEditSchedule && onEditSchedule(s.schedule)}>
                  
                    <Icon name="Edit" size={16} />
                  </button>
                  <button
                  type="button"
                  className="icon-btn icon-btn--danger"
                  aria-label="Remove schedule"
                  title="Remove"
                  onClick={() => openConfirm({
                    title: "Remove schedule?",
                    body: `This will remove "${s.when}" and unlink its bookings from this requisition.`,
                    primaryLabel: "Remove",
                    onConfirm: () => onRemoveSchedule && onRemoveSchedule(s.scheduleId)
                  })}>
                  
                    <Icon name="TrashCan" size={16} />
                  </button>
                </div>
              </div>
              {s.customRules &&
            <span className="rev-staff-custom">
                  <Icon name="Adjustment" size={14} />Custom rules
                </span>
            }
            </div>
            <div className="rev-staff-jobs">
              {s.bookings.length === 0 &&
            <div style={{ padding: "10px 12px", font: "var(--evr-body2)", color: "var(--evr-content-primary-lowemp)" }}>
                  No bookings linked to this schedule.
                </div>
            }
              {s.bookings.map((b, j) =>
            <div className="rev-staff-job" key={j}>
                  <span className="rev-staff-job-num">{b.num}</span>
                  <span className="rev-staff-job-label">{b.label}</span>
                  <span className="rev-staff-job-actions">
                    <button
                  type="button"
                  className="icon-btn"
                  aria-label="Edit booking"
                  title="Edit booking"
                  onClick={() => onEditBooking && onEditBooking(b.booking)}>
                  
                      <Icon name="Edit" size={16} />
                    </button>
                  </span>
                </div>
            )}
            </div>
          </div>
        )}
      </div>
    </SidePanel>);

}

// Per-schedule edit panel. Lightweight: change dates (free text),
// start / end times via dropdown, and flag whether custom rules apply.
// Delete button in the footer mirrors the inline trash on the overview.
function EditSchedulePanel({ open, schedule, bookingOptions = [], onClose, onSave, onDelete }) {
  const [dates, setDates] = useStateNr(schedule?.dates || "");
  const [start, setStart] = useStateNr(schedule?.start || "");
  const [end, setEnd] = useStateNr(schedule?.end || "");
  const [customized, setCustomized] = useStateNr(!!schedule?.customized);
  const [bookings, setBookings] = useStateNr(schedule?.bookings || []);

  useEffectNr(() => {
    if (!open) return;
    setDates(schedule?.dates || "");
    setStart(schedule?.start || "");
    setEnd(schedule?.end || "");
    setCustomized(!!schedule?.customized);
    setBookings(schedule?.bookings || []);
  }, [open, schedule]);

  return (
    <SidePanel
      open={open}
      title="Edit schedule"
      onClose={onClose}
      footer={
      <React.Fragment>
          <button
          type="button"
          className="btn btn--lg btn--tertiary icon-btn--danger"
          onClick={() => openConfirm({
            title: "Remove schedule?",
            body: "This schedule will be removed from the requisition.",
            primaryLabel: "Remove",
            onConfirm: () => onDelete && onDelete()
          })}
          style={{ marginRight: "auto", color: "var(--evr-interactive-error-default)" }}>
          
            <Icon name="TrashCan" size={16} />Remove
          </button>
          <button type="button" className="btn btn--lg btn--tertiary" onClick={onClose}>Cancel</button>
          <button
          type="button"
          className="btn btn--lg btn--primary"
          onClick={() => onSave && onSave({ dates, start, end, customized, bookings })}>
          
            Save schedule
          </button>
        </React.Fragment>
      }>
      
      <div>
        <h3 className="sp-section-title">When</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <Field label="Date(s)" required hint="e.g. May 12, 2026 or Apr 27 – Apr 29, 2026">
            <TextInput
              value={dates}
              onChange={setDates}
              placeholder="Pick a date or a range" />
            
          </Field>
          <div className="sp-grid-2">
            <Field label="Start time">
              <Dropdown
                options={TIME_OPTIONS}
                value={start}
                onChange={setStart}
                placeholder="Optional" />
              
            </Field>
            <Field label="End time">
              <Dropdown
                options={TIME_OPTIONS}
                value={end}
                onChange={setEnd}
                placeholder="Optional" />
              
            </Field>
          </div>
        </div>
      </div>

      <hr className="sp-divider" />

      <div>
        <h3 className="sp-section-title">Work assignments on this schedule</h3>
        <Field
          label="Applies to"
          hint="Workers will be requested for each booking, on the dates and times above.">
          
          <MultiSelect
            options={bookingOptions}
            value={bookings}
            onChange={setBookings}
            placeholder="Select work assignments" />
          
        </Field>
      </div>

      <hr className="sp-divider" />

      <div>
        <h3 className="sp-section-title">Rules</h3>
        <Field
          label="Custom rules"
          hint="Schedules with custom rules apply per-job overrides like staggered starts or split breaks.">
          
          <label style={{ display: "inline-flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
            <Switch checked={customized} onChange={setCustomized} ariaLabel="Custom rules" />
            <span style={{ font: "var(--evr-body2)", color: "var(--evr-content-primary-default)" }}>
              {customized ? "Custom rules applied" : "Standard rules"}
            </span>
          </label>
        </Field>
      </div>
    </SidePanel>);

}

Object.assign(window, {
  NewRequisitionPage, ReviewRequisitionPage,
  EditSetupPanel, EditStaffingOverviewPanel, EditSchedulePanel,
  PriorityRow
});