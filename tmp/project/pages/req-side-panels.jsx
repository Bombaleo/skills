// =====================================================================
// Flex Work — Side panels for Requisition Create flow:
//   · EditLocationPanel  — address search + booking-name toggle + file
//   · EditBookingPanel   — quantity + job + collapsible advanced sections
//   · AddScheduleShort   — single-occurrence schedule
//   · AddScheduleLong    — recurring schedule with weekday picker + rules
// All four follow the Figma side-panel shell: 540 wide, scrim, fixed footer.
// =====================================================================

const { useState: useStateSp, useEffect: useEffectSp, useRef: useRefSp, useMemo: useMemoSp } = React;

// ---------- Side panel shell -------------------------------------------

function SidePanel({ open, title, onClose, footer, children }) {
  // Esc closes the panel.
  useEffectSp(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape") onClose && onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <React.Fragment>
      <div
        className={"scrim" + (open ? " open" : "")}
        onClick={onClose}
        aria-hidden="true"
      />
      <aside
        className={"side-panel" + (open ? " open" : "")}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        aria-hidden={!open}
      >
        <header className="sp-head">
          <h2>{title}</h2>
          <button type="button" className="iconbtn" onClick={onClose} aria-label="Close">
            <Icon name="X" size={20} />
          </button>
        </header>
        <div className="sp-body">{children}</div>
        {footer && <footer className="sp-foot">{footer}</footer>}
      </aside>
    </React.Fragment>
  );
}

// ---------- Collapsible "Advanced" row ---------------------------------

function Accordion({ label, defaultOpen = false, children }) {
  const [open, setOpen] = useStateSp(defaultOpen);
  return (
    <div className="acc-stack">
      <button type="button" className="acc" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <span>{label}</span>
        <span className="acc-chev" data-open={open}><Icon name="ChevronDown" size={18} /></span>
      </button>
      {open && <div className="acc-content">{children}</div>}
    </div>
  );
}

// ---------- Edit booking ------------------------------------------------

function EditBookingPanel({ open, onClose, booking, onSave, jobOptions = [], billingModel, onBillingModelChange, workflow, onWorkflowChange, engType, billingBasis, onBillingBasisChange, timeCapture, onTimeCaptureChange }) {
  // Mirror the row state so edits in the panel can be canceled.
  const [qty, setQty]                       = useStateSp(booking?.quantity ?? 1);
  const [job, setJob]                       = useStateSp(booking?.job ?? "");
  const [level, setLevel]                   = useStateSp("");
  const [responsibilities, setResp]         = useStateSp("");
  const [instructions, setInstr]            = useStateSp("");
  const [attire, setAttire]                 = useStateSp("none");
  const [certs, setCerts]                   = useStateSp([]);
  // v0.77 advanced fields — per-assignment rate range + tenant-level
  // Time & materials + Workflow. Rate range is per-booking; Time &
  // materials / Workflow live at the requisition level and the parent
  // page provides the value + setter so every booking's Advanced panel
  // edits the same shared values.
  const [rate, setRate]                     = useStateSp({ min: "", max: "", currency: "USD", cadence: "Hourly" });
  // Local copy of billing model + workflow so Cancel reverts. Synced
  // from props on open.
  const [bmLocal, setBmLocal]               = useStateSp(billingModel || "ClockInOut");
  const [wfLocal, setWfLocal]               = useStateSp(workflow || "automatic");
  // v0.78 — Billing Basis × Time Capture, constrained per Engagement
  // Type. Defaults come from EngagementType.defaultsFor(engType); the
  // parent page owns the canonical value, this is the editable local
  // copy that commits on Save.
  const _engT = engType || "Shift";
  const _engDef = (window.EngagementType && window.EngagementType.defaultsFor)
    ? window.EngagementType.defaultsFor(_engT)
    : { billingBasis: "Hourly", timeCapture: "Clock-in/out" };
  const [bbLocal, setBbLocal]               = useStateSp(billingBasis || _engDef.billingBasis);
  const [tcLocal, setTcLocal]               = useStateSp(timeCapture  || _engDef.timeCapture);

  // Track whether each role-driven field has been touched manually so we
  // don't blow away the user's edits when they change the job.
  const [touched, setTouched] = useStateSp({});

  // Seed / reset state whenever the panel opens with a new booking.
  useEffectSp(() => {
    if (!open) return;
    const def = getRoleDefaults(booking?.job) || {};
    setQty(booking?.quantity ?? 1);
    setJob(booking?.job ?? "");
    setLevel(booking?.level ?? def.level ?? "Any level");
    setResp(booking?.responsibilities ?? def.responsibilities ?? "");
    setInstr(booking?.instructions ?? def.instructions ?? "");
    setAttire(booking?.attire ?? def.attire ?? "none");
    setCerts(booking?.certs ?? def.certs ?? []);
    setRate(booking?.rateRange || { min: "", max: "", currency: "USD", cadence: "Hourly" });
    setBmLocal(billingModel || "ClockInOut");
    setWfLocal(workflow || "automatic");
    // Re-snap Billing Basis × Time Capture to a valid pair for the
    // current engType, preferring the parent-supplied values when
    // they're still valid options.
    if (window.EngagementType && window.EngagementType.normalizePair) {
      const snap = window.EngagementType.normalizePair(_engT, billingBasis, timeCapture);
      setBbLocal(snap.billingBasis);
      setTcLocal(snap.timeCapture);
    } else {
      setBbLocal(billingBasis || _engDef.billingBasis);
      setTcLocal(timeCapture  || _engDef.timeCapture);
    }
    setTouched({});
  }, [open, booking, engType]);

  // When the user picks a different job, re-seed the role-defaulted fields
  // — but only the ones they haven't manually edited.
  const onJobChange = (next) => {
    setJob(next);
    const def = getRoleDefaults(next) || {};
    if (!touched.level)            setLevel(def.level || "Any level");
    if (!touched.responsibilities) setResp(def.responsibilities || "");
    if (!touched.instructions)     setInstr(def.instructions || "");
    if (!touched.attire)           setAttire(def.attire || "none");
    if (!touched.certs)            setCerts(def.certs || []);
  };

  const mark = (k) => setTouched((t) => ({ ...t, [k]: true }));
  const resetField = (k) => {
    const def = getRoleDefaults(job) || {};
    if (k === "level")            setLevel(def.level || "Any level");
    if (k === "responsibilities") setResp(def.responsibilities || "");
    if (k === "instructions")     setInstr(def.instructions || "");
    if (k === "attire")           setAttire(def.attire || "none");
    if (k === "certs")            setCerts(def.certs || []);
    setTouched((t) => { const n = { ...t }; delete n[k]; return n; });
  };

  // Quantity input — accept any positive integer typed by the user.
  const onQtyChange = (val) => {
    if (val === "") { setQty(""); return; }
    const n = parseInt(String(val).replace(/[^0-9]/g, ""), 10);
    if (Number.isFinite(n) && n > 0) setQty(n);
  };

  const def = getRoleDefaults(job);
  const hasJob = !!job;
  const showResetBadge = (k) => def && touched[k];

  return (
    <SidePanel
      open={open}
      title="Edit booking"
      onClose={onClose}
      footer={(
        <React.Fragment>
          <button type="button" className="btn btn--lg btn--tertiary" onClick={onClose}>Cancel</button>
          <button
            type="button"
            className="btn btn--lg btn--primary"
            onClick={() => {
              const hasRate = !!(rate && (rate.min || rate.max));
              const next = {
                quantity: typeof qty === "number" ? qty : 1,
                job, level, responsibilities, instructions, attire, certs,
                rateRange: hasRate ? rate : null,
              };
              if (onSave) onSave(next);
              if (onBillingModelChange) onBillingModelChange(bmLocal);
              if (onWorkflowChange) onWorkflowChange(wfLocal);
              if (onBillingBasisChange) onBillingBasisChange(bbLocal);
              if (onTimeCaptureChange)  onTimeCaptureChange(tcLocal);
              showToast("Work assignment saved", { kind: "success" });
            }}
          >
            Save booking
          </button>
        </React.Fragment>
      )}
    >
      <div>
        <h3 className="sp-section-title">Essentials</h3>
        <div className="sp-grid-2">
          <Field label="Quantity" required hint="Any number, 1 or more">
            <TextInput
              type="text"
              value={qty}
              onChange={onQtyChange}
              placeholder="1"
            />
          </Field>
          <Field label="Job" required>
            {window.JobPicker ? (
              <window.JobPicker
                value={job}
                onChange={onJobChange}
                placeholder="Select job"
              />
            ) : (
              <Dropdown
                options={jobOptions}
                value={job}
                onChange={onJobChange}
                placeholder="Select job"
              />
            )}
          </Field>
        </div>
      </div>

      <hr className="sp-divider" />

      <div>
        <h3 className="sp-section-title">Advanced</h3>
        <div className="acc-stack">
          <Accordion label="Level">
            <Field
              label="Experience level"
              action={showResetBadge("level") && (
                <button type="button" className="linkbtn" onClick={() => resetField("level")}>
                  Reset to default
                </button>
              )}
            >
              <Dropdown
                options={LEVEL_OPTIONS}
                value={level}
                onChange={(v) => { setLevel(v); mark("level"); }}
                placeholder="Any level"
              />
            </Field>
          </Accordion>

          <Accordion label="Responsibilities">
            <Field
              label={hasJob ? `Responsibilities (default for ${job})` : "What will workers do?"}
              action={showResetBadge("responsibilities") && (
                <button type="button" className="linkbtn" onClick={() => resetField("responsibilities")}>
                  Reset to default
                </button>
              )}
            >
              <Textarea
                rows={4}
                value={responsibilities}
                onChange={(v) => { setResp(v); mark("responsibilities"); }}
                placeholder={hasJob ? "" : "Describe the key tasks for this booking…"}
              />
            </Field>
          </Accordion>

          <Accordion label="Instructions">
            <Field
              label={hasJob ? `Instructions (saved default for ${job})` : "Notes for workers"}
              action={showResetBadge("instructions") && (
                <button type="button" className="linkbtn" onClick={() => resetField("instructions")}>
                  Reset to default
                </button>
              )}
            >
              <Textarea
                rows={3}
                value={instructions}
                onChange={(v) => { setInstr(v); mark("instructions"); }}
                placeholder={hasJob ? "" : "Add reporting instructions, check-in details, etc."}
              />
            </Field>
          </Accordion>

          <Accordion label="Attire">
            <Field
              label={hasJob ? `Attire (preset for ${job})` : "Dress code"}
              action={showResetBadge("attire") && (
                <button type="button" className="linkbtn" onClick={() => resetField("attire")}>
                  Reset to default
                </button>
              )}
            >
              <AttirePicker
                value={attire}
                onChange={(v) => { setAttire(v); mark("attire"); }}
              />
            </Field>
          </Accordion>

          <Accordion label="Certifications">
            <CertSearch
              job={job}
              value={certs}
              onChange={(next) => { setCerts(next); mark("certs"); }}
            />
          </Accordion>

          <Accordion label="Rate">
            <p className="sp-section-sub" style={{ margin: "0 0 12px", color: "var(--evr-content-primary-lowemp)", font: "var(--evr-body2)" }}>
              Optional — narrows candidate quotes for this work assignment.
            </p>
            <div className="sp-grid-2">
              <Field label="Min">
                <TextInput
                  type="number"
                  value={rate.min}
                  onChange={(v) => setRate((r) => ({ ...r, min: v }))}
                  placeholder="80"
                />
              </Field>
              <Field label="Max">
                <TextInput
                  type="number"
                  value={rate.max}
                  onChange={(v) => setRate((r) => ({ ...r, max: v }))}
                  placeholder="125"
                />
              </Field>
              <Field label="Currency">
                <Dropdown
                  options={[
                    { value: "USD", label: "USD" },
                    { value: "EUR", label: "EUR" },
                    { value: "GBP", label: "GBP" },
                    { value: "CAD", label: "CAD" },
                  ]}
                  value={rate.currency}
                  onChange={(v) => setRate((r) => ({ ...r, currency: v }))}
                />
              </Field>
              <Field label="Per">
                <Dropdown
                  options={[
                    { value: "Hourly",  label: "hour" },
                    { value: "Daily",   label: "day" },
                    { value: "Weekly",  label: "week" },
                    { value: "Monthly", label: "month" },
                    { value: "Project", label: "project" },
                  ]}
                  value={rate.cadence}
                  onChange={(v) => setRate((r) => ({ ...r, cadence: v }))}
                />
              </Field>
            </div>
          </Accordion>

          <Accordion label="Billing basis">
            {(() => {
              const opts = (window.EngagementType
                ? window.EngagementType.optionsFor(_engT)
                : { billingBasis: ["Hourly"], defaults: { billingBasis: "Hourly" } });
              const lock = opts.billingBasis.length <= 1;
              return (
                <Field
                  label="What you pay against on this engagement"
                  hint={
                    _engT === "Shift"
                      ? "Shift engagements bill hourly \u2014 locked at this engagement type."
                      : _engT === "Assignment"
                        ? "Pick how an assignment bills: hourly, weekly, monthly, or as a fixed amount."
                        : _engT === "Project"
                          ? "Projects bill against a budget on a fixed amount or per accepted milestone."
                          : "Statements of Work bill per accepted milestone."
                  }
                >
                  {lock ? (
                    <div style={{
                      font: "var(--evr-body1)",
                      color: "var(--evr-content-primary-default)",
                      background: "var(--evr-surface-primary-disabled)",
                      border: "1px solid var(--evr-borders-decorative-default)",
                      borderRadius: 8,
                      padding: "10px 12px",
                    }}>{bbLocal}</div>
                  ) : (
                    <Dropdown
                      options={opts.billingBasis.map((v) => ({ value: v, label: v }))}
                      value={bbLocal}
                      onChange={(v) => setBbLocal(v)}
                      placeholder={opts.defaults.billingBasis}
                    />
                  )}
                </Field>
              );
            })()}
          </Accordion>

          <Accordion label="Time capture">
            {(() => {
              const opts = (window.EngagementType
                ? window.EngagementType.optionsFor(_engT)
                : { timeCapture: ["Clock-in/out"], defaults: { timeCapture: "Clock-in/out" } });
              const lock = opts.timeCapture.length <= 1;
              return (
                <Field
                  label="How worked time is recorded on this engagement"
                  hint={
                    _engT === "Shift"
                      ? "Shift engagements clock in/out \u2014 locked at this engagement type."
                      : _engT === "Assignment"
                        ? "Pick clock-in/out, period time-tracking, or none."
                        : "Time tracking is optional and informational on this engagement type."
                  }
                >
                  {lock ? (
                    <div style={{
                      font: "var(--evr-body1)",
                      color: "var(--evr-content-primary-default)",
                      background: "var(--evr-surface-primary-disabled)",
                      border: "1px solid var(--evr-borders-decorative-default)",
                      borderRadius: 8,
                      padding: "10px 12px",
                    }}>{tcLocal}</div>
                  ) : (
                    <Dropdown
                      options={opts.timeCapture.map((v) => ({ value: v, label: v }))}
                      value={tcLocal}
                      onChange={(v) => setTcLocal(v)}
                      placeholder={opts.defaults.timeCapture}
                    />
                  )}
                </Field>
              );
            })()}
          </Accordion>

          <Accordion label="Workflow">
            <Field
              label="How candidates move from submission to assignment"
              hint="Automatic fills from the priority window without buyer input. Interview pauses for a candidate-selection step."
            >
              <Dropdown
                options={[
                  { value: "automatic", label: "Automatic" },
                  { value: "interview", label: "Interview" },
                ]}
                value={wfLocal}
                onChange={(v) => { setWfLocal(v); }}
                placeholder="Automatic"
              />
            </Field>
          </Accordion>

          <Accordion label="Attachments">
            <div className="uploader">
              <span className="uploader-text">Attach a job description, safety doc, or photo</span>
              <button type="button" className="uploader-action">Upload file</button>
            </div>
          </Accordion>
        </div>
      </div>
    </SidePanel>
  );
}

// ---------- Edit location ----------------------------------------------

// Google-Places-style autocomplete suggestions. Static mock list — the
// matching is just a case-insensitive prefix/substring filter so it
// behaves like the real thing for demo purposes. Each entry carries
// real lat/lng so the Leaflet map can fly to it on selection.
const PLACE_SUGGESTIONS = [
  { id: "p-01", main: "1234 Industrial Way",  sec: "Springfield, IL 62701, USA",  lat: 39.7817, lng: -89.6501 },
  { id: "p-02", main: "120 Mountain Rd",      sec: "Vail, CO 81657, USA",         lat: 39.6403, lng: -106.3742 },
  { id: "p-03", main: "55 Lake Drive",        sec: "Aspen, CO 81611, USA",        lat: 39.1911, lng: -106.8175 },
  { id: "p-04", main: "8800 Cargo Blvd",      sec: "Dallas, TX 75201, USA",       lat: 32.7767, lng: -96.7970 },
  { id: "p-05", main: "2200 Lakeshore Dr",    sec: "Chicago, IL 60601, USA",      lat: 41.8781, lng: -87.6298 },
  { id: "p-06", main: "415 Logistics Pkwy",   sec: "Atlanta, GA 30301, USA",      lat: 33.7490, lng: -84.3880 },
  { id: "p-07", main: "900 Harbor View",      sec: "Long Beach, CA 90802, USA",   lat: 33.7701, lng: -118.1937 },
  { id: "p-08", main: "1500 Trade Center",    sec: "Indianapolis, IN 46201, USA", lat: 39.7684, lng: -86.1581 },
  { id: "p-09", main: "6200 Storage Way",     sec: "Phoenix, AZ 85003, USA",      lat: 33.4484, lng: -112.0740 },
  { id: "p-10", main: "44 Terminal Ave",      sec: "Newark, NJ 07102, USA",       lat: 40.7357, lng: -74.1724 },
  { id: "p-11", main: "201 Pier 7",           sec: "Seattle, WA 98101, USA",      lat: 47.6062, lng: -122.3321 },
  { id: "p-12", main: "3311 East Old Shakopee Rd", sec: "Minneapolis, MN 55425, USA", lat: 44.8548, lng: -93.2422 },
];

// Match the typed query against either component of a suggestion, with
// the matched span highlighted in the rendered output.
function highlightMatch(text, q) {
  if (!q) return text;
  const idx = text.toLowerCase().indexOf(q.toLowerCase());
  if (idx < 0) return text;
  return (
    <React.Fragment>
      {text.slice(0, idx)}
      <strong className="loc-ac-hit">{text.slice(idx, idx + q.length)}</strong>
      {text.slice(idx + q.length)}
    </React.Fragment>
  );
}

function LocationAutocomplete({ value, onChange, onPick }) {
  const [open, setOpen] = useStateSp(false);
  const [hover, setHover] = useStateSp(0);
  const [geocoding, setGeocoding] = useStateSp(false);
  const rootRef = useRefSp(null);

  useEffectSp(() => {
    if (!open) return;
    const onDoc = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const matches = useMemoSp(() => {
    const q = (value || "").trim().toLowerCase();
    if (!q) return [];
    return PLACE_SUGGESTIONS.filter((p) =>
      p.main.toLowerCase().includes(q) || p.sec.toLowerCase().includes(q)
    ).slice(0, 6);
  }, [value]);

  // Trimmed query, used to decide whether to offer free-text geocoding.
  const trimmed = (value || "").trim();
  // Show the "Use as address" row when the user has typed at least a few
  // characters and the typed text doesn't exactly match a suggestion.
  const offerFreeText = trimmed.length >= 3 &&
    !matches.some((m) => `${m.main}, ${m.sec}`.toLowerCase() === trimmed.toLowerCase());

  // Total interactive rows = matches + (optional free-text row). Used by
  // keyboard navigation so ↓ can reach the free-text row.
  const totalRows = matches.length + (offerFreeText ? 1 : 0);

  const pick = (p) => {
    onChange && onChange(`${p.main}, ${p.sec}`);
    onPick && onPick(p);
    setOpen(false);
  };

  // Geocode any free-text address via Nominatim. Tolerant of failures —
  // if it can't resolve, we still accept the typed text and just keep
  // the existing map center.
  const acceptFreeText = async () => {
    const q = trimmed;
    if (!q) return;
    setGeocoding(true);
    let p = { id: `p-free-${Date.now()}`, main: q, sec: "Custom address" };
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`;
      const res = await fetch(url, { headers: { "Accept": "application/json" } });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data[0]) {
          const lat = parseFloat(data[0].lat);
          const lng = parseFloat(data[0].lon);
          if (Number.isFinite(lat) && Number.isFinite(lng)) {
            p.lat = lat; p.lng = lng;
            p.sec = data[0].display_name || p.sec;
          }
        }
      }
    } catch (e) { /* swallow — accept as typed */ }
    setGeocoding(false);
    onChange && onChange(p.lat ? p.sec : q);
    onPick && onPick(p);
    setOpen(false);
  };

  return (
    <div className="loc-ac" ref={rootRef}>
      <div className="fld-control fld-control--input">
        <Icon name="Search" size={18} style={{ color: "var(--evr-content-primary-lowemp)", marginRight: 8 }} />
        <input
          type="text"
          className="fld-input"
          placeholder="Search by address, city, or landmark"
          value={value || ""}
          onChange={(e) => { onChange && onChange(e.target.value); setOpen(true); setHover(0); }}
          onFocus={() => { if (matches.length > 0 || offerFreeText) setOpen(true); }}
          onKeyDown={(e) => {
            if (!open || totalRows === 0) {
              if (e.key === "Enter" && trimmed.length >= 3) { e.preventDefault(); acceptFreeText(); }
              return;
            }
            if (e.key === "ArrowDown") { e.preventDefault(); setHover((h) => Math.min(h + 1, totalRows - 1)); }
            else if (e.key === "ArrowUp") { e.preventDefault(); setHover((h) => Math.max(h - 1, 0)); }
            else if (e.key === "Enter") {
              e.preventDefault();
              if (hover < matches.length) pick(matches[hover]);
              else acceptFreeText();
            }
            else if (e.key === "Escape")   { setOpen(false); }
          }}
          aria-autocomplete="list"
          aria-controls="loc-ac-list"
          aria-expanded={open}
          spellCheck={false}
        />
        {value && (
          <button
            type="button"
            className="tag-x"
            aria-label="Clear search"
            onClick={() => { onChange && onChange(""); setOpen(false); }}
            style={{ marginLeft: 4 }}
          >
            <Icon name="X" size={12} />
          </button>
        )}
      </div>
      {open && (matches.length > 0 || offerFreeText) && (
        <div className="loc-ac-menu" id="loc-ac-list" role="listbox">
          {matches.map((p, i) => (
            <button
              key={p.id}
              type="button"
              role="option"
              aria-selected={i === hover}
              className={"loc-ac-item" + (i === hover ? " loc-ac-item--hover" : "")}
              onMouseEnter={() => setHover(i)}
              onMouseDown={(e) => { e.preventDefault(); pick(p); }}
            >
              <span className="loc-ac-pin" aria-hidden="true">
                <Icon name="Location" size={16} />
              </span>
              <span className="loc-ac-text">
                <span className="loc-ac-main">{highlightMatch(p.main, value)}</span>
                <span className="loc-ac-sec">{highlightMatch(p.sec, value)}</span>
              </span>
            </button>
          ))}
          {offerFreeText && (
            <button
              key="free-text"
              type="button"
              role="option"
              aria-selected={hover === matches.length}
              className={"loc-ac-item loc-ac-item--custom" + (hover === matches.length ? " loc-ac-item--hover" : "")}
              onMouseEnter={() => setHover(matches.length)}
              onMouseDown={(e) => { e.preventDefault(); acceptFreeText(); }}
              disabled={geocoding}
            >
              <span className="loc-ac-pin loc-ac-pin--custom" aria-hidden="true">
                <Icon name={geocoding ? "Refresh" : "AddCircle"} size={16} />
              </span>
              <span className="loc-ac-text">
                <span className="loc-ac-main">
                  Use &ldquo;<strong>{trimmed}</strong>&rdquo; as address
                </span>
                <span className="loc-ac-sec">
                  {geocoding
                    ? "Looking up coordinates\u2026"
                    : "We'll geocode it and drop the pin for you."}
                </span>
              </span>
            </button>
          )}
          <div className="loc-ac-attr" aria-hidden="true">
            <span>powered by</span>
            <span className="loc-ac-attr-brand">
              <span style={{ color: "#4285F4" }}>G</span>
              <span style={{ color: "#EA4335" }}>o</span>
              <span style={{ color: "#FBBC05" }}>o</span>
              <span style={{ color: "#4285F4" }}>g</span>
              <span style={{ color: "#34A853" }}>l</span>
              <span style={{ color: "#EA4335" }}>e</span>
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

// Real interactive map: Leaflet + OpenStreetMap tiles, with a draggable
// marker. Recenters when `center` changes (e.g. user picks an address
// from autocomplete). Falls back to a static placeholder if Leaflet
// failed to load.
function LeafletMap({ height = 280, center, onPinChange }) {
  const elRef = useRefSp(null);
  const mapRef = useRefSp(null);
  const markerRef = useRefSp(null);

  // Init once.
  useEffectSp(() => {
    if (!elRef.current) return;
    if (typeof window.L === "undefined") return; // Leaflet not loaded
    if (mapRef.current) return; // already initialized

    // Use an inline-SVG divIcon for the marker so we never depend on the
    // network for icon images (was failing under sandboxed CDN setups).
    const pinIcon = window.L.divIcon({
      html:
        '<svg width="32" height="40" viewBox="0 0 32 40" xmlns="http://www.w3.org/2000/svg">' +
          '<path d="M16 0C7.16 0 0 7.16 0 16C0 28 16 40 16 40C16 40 32 28 32 16C32 7.16 24.84 0 16 0Z" fill="#3067DB"/>' +
          '<circle cx="16" cy="16" r="6" fill="white"/>' +
        '</svg>',
      className: "lp-pin",
      iconSize: [32, 40],
      iconAnchor: [16, 40],
    });

    const map = window.L.map(elRef.current, {
      zoomControl: true,
      attributionControl: true,
    }).setView([center.lat, center.lng], 13);

    window.L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);

    const marker = window.L.marker([center.lat, center.lng], { draggable: true, icon: pinIcon }).addTo(map);
    marker.on("dragend", () => {
      const ll = marker.getLatLng();
      onPinChange && onPinChange({ lat: ll.lat, lng: ll.lng });
    });
    map.on("click", (e) => {
      marker.setLatLng(e.latlng);
      onPinChange && onPinChange({ lat: e.latlng.lat, lng: e.latlng.lng });
    });

    mapRef.current = map;
    markerRef.current = marker;

    // Leaflet measures its container at init; if the panel was hidden
    // (display:none scrim), force a recompute once visible.
    setTimeout(() => { try { map.invalidateSize(); } catch (e) {} }, 50);
    setTimeout(() => { try { map.invalidateSize(); } catch (e) {} }, 350);

    return () => {
      try { map.remove(); } catch (e) {}
      mapRef.current = null;
      markerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-center on prop change (e.g. address picked).
  useEffectSp(() => {
    if (!mapRef.current || !markerRef.current) return;
    if (!center) return;
    markerRef.current.setLatLng([center.lat, center.lng]);
    mapRef.current.flyTo([center.lat, center.lng], 14, { duration: 0.6 });
  }, [center && center.lat, center && center.lng]);

  // Fallback if Leaflet's not available.
  if (typeof window.L === "undefined") {
    return (
      <div className="map-box" style={{ height }}>
        <span className="map-pin" aria-hidden="true">
          <svg width="32" height="40" viewBox="0 0 32 40" fill="none">
            <path d="M16 0C7.16 0 0 7.16 0 16C0 28 16 40 16 40C16 40 32 28 32 16C32 7.16 24.84 0 16 0Z" fill="#131316"/>
          </svg>
        </span>
      </div>
    );
  }

  return (
    <div className="map-real-wrap" style={{ height }}>
      <div ref={elRef} className="map-real" style={{ height }} />
      <span className="map-hint map-hint--leaflet" aria-hidden="true">
        <Icon name="Information" size={14} />
        Drag the pin, or click anywhere to move it
      </span>
    </div>
  );
}

// File uploader: a drag-and-drop dropzone + a hidden file input + a list
// of staged files with type icon, size, remove button.
function FileDrop({ files, onAdd, onRemove }) {
  const inputRef = useRefSp(null);
  const [over, setOver] = useStateSp(false);

  const formatSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  };
  const iconFor = (name) => {
    const ext = (name.split(".").pop() || "").toLowerCase();
    if (["pdf"].includes(ext)) return "PDF";
    if (["xls", "xlsx", "csv"].includes(ext)) return "Excel";
    if (["doc", "docx"].includes(ext)) return "Word";
    if (["png", "jpg", "jpeg", "gif", "webp", "svg"].includes(ext)) return "File";
    return "File";
  };
  const handleFiles = (list) => {
    const next = Array.from(list).map((f) => ({
      id: `${Date.now()}-${f.name}-${Math.random().toString(36).slice(2, 8)}`,
      name: f.name,
      size: f.size,
      type: iconFor(f.name),
    }));
    onAdd && onAdd(next);
  };

  return (
    <div className="file-drop-wrap">
      <input
        ref={inputRef}
        type="file"
        multiple
        accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.png,.jpg,.jpeg,.txt"
        className="file-drop-input"
        onChange={(e) => { handleFiles(e.target.files); e.target.value = ""; }}
      />
      <button
        type="button"
        className={"file-drop" + (over ? " file-drop--over" : "")}
        onClick={() => inputRef.current && inputRef.current.click()}
        onDragOver={(e) => { e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          if (e.dataTransfer.files && e.dataTransfer.files.length) handleFiles(e.dataTransfer.files);
        }}
      >
        <span className="file-drop-icon" aria-hidden="true">
          <Icon name="FileUpload" size={28} />
        </span>
        <span className="file-drop-line file-drop-line--strong">
          Drag files here, or <span className="file-drop-link">browse</span>
        </span>
        <span className="file-drop-line">
          PDF, DOC, XLS, CSV, or images up to 10 MB
        </span>
      </button>
      {files.length > 0 && (
        <ul className="file-drop-list">
          {files.map((f) => (
            <li key={f.id} className="file-drop-item">
              <span className="file-drop-item-ic" aria-hidden="true">
                <Icon name={f.type} size={20} />
              </span>
              <span className="file-drop-item-text">
                <span className="file-drop-item-name">{f.name}</span>
                <span className="file-drop-item-meta">{formatSize(f.size)}</span>
              </span>
              <button
                type="button"
                className="iconbtn"
                aria-label={`Remove ${f.name}`}
                onClick={() => onRemove && onRemove(f.id)}
              >
                <Icon name="TrashCan" size={16} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function EditLocationPanel({ open, onClose, onSave }) {
  const [search, setSearch] = useStateSp("");
  const [picked, setPicked] = useStateSp(null); // last picked Google place
  // Real lat/lng for the Leaflet marker — defaults to Minneapolis (HQ).
  const [center, setCenter] = useStateSp({ lat: 44.8548, lng: -93.2422 });
  const [bookingName, setBookingName] = useStateSp("");
  const [files, setFiles] = useStateSp([]);

  // Reset state when the panel re-opens so each edit starts clean.
  useEffectSp(() => {
    if (open) {
      setSearch(""); setPicked(null);
      setCenter({ lat: 44.8548, lng: -93.2422 });
      setBookingName(""); setFiles([]);
    }
  }, [open]);

  return (
    <SidePanel
      open={open}
      title="Edit site"
      onClose={onClose}
      footer={(
        <React.Fragment>
          <button type="button" className="btn btn--lg btn--tertiary" onClick={onClose}>Cancel</button>
          <button
            type="button"
            className="btn btn--lg btn--primary"
            onClick={() => { if (onSave) onSave(); showToast("Location saved", { kind: "success" }); }}
          >
            Save location
          </button>
        </React.Fragment>
      )}
    >
      <div>
        <h3 className="sp-section-title">Address</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Field
            label="Search location"
            hint={picked
              ? `Pin at ${center.lat.toFixed(4)}, ${center.lng.toFixed(4)} — drag on the map to adjust.`
              : "Start typing to see suggestions. Drag the pin or click on the map to fine-tune."}
          >
            <LocationAutocomplete
              value={search}
              onChange={setSearch}
              onPick={(p) => {
                setPicked(p);
                if (Number.isFinite(p.lat) && Number.isFinite(p.lng)) {
                  setCenter({ lat: p.lat, lng: p.lng });
                  showToast(`Centered map on ${p.main}`);
                } else {
                  showToast(`Couldn't geocode "${p.main}" — drop the pin manually.`, { kind: "warning" });
                }
              }}
            />
          </Field>
          {open && (
            <LeafletMap
              height={260}
              center={center}
              onPinChange={(ll) => setCenter(ll)}
            />
          )}
        </div>
      </div>

      <hr className="sp-divider" />

      <div>
        <h3 className="sp-section-title">Work assignment details</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Field label="Work assignment name" hint="Helps your team recognize this assignment on the schedule and timesheets.">
            <TextInput
              placeholder="e.g. Loading dock A, AM shift"
              value={bookingName}
              onChange={setBookingName}
            />
          </Field>
        </div>
      </div>

      <hr className="sp-divider" />

      <div>
        <h3 className="sp-section-title">Attachments</h3>
        <FileDrop
          files={files}
          onAdd={(added) => setFiles((cur) => [...cur, ...added])}
          onRemove={(id) => setFiles((cur) => cur.filter((f) => f.id !== id))}
        />
      </div>
    </SidePanel>
  );
}

// ---------- Days-of-week picker ----------------------------------------

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function DayPicker({ selected, onChange }) {
  return (
    <div className="days-row">
      {DAYS.map((d) => {
        const on = selected.includes(d);
        return (
          <button
            key={d}
            type="button"
            className="day-pill"
            aria-pressed={on}
            onClick={() =>
              onChange(on ? selected.filter((x) => x !== d) : [...selected, d])
            }
          >
            {d}
          </button>
        );
      })}
    </div>
  );
}

// ---------- Add schedule (short-term) ----------------------------------

function AddScheduleShortPanel({ open, onClose, onSave }) {
  return (
    <SidePanel
      open={open}
      title="Add schedule"
      onClose={onClose}
      footer={(
        <React.Fragment>
          <button type="button" className="btn btn--lg btn--tertiary" onClick={onClose}>Cancel</button>
          <button
            type="button"
            className="btn btn--lg btn--primary"
            onClick={() => { if (onSave) onSave(); showToast("Schedule saved", { kind: "success" }); }}
          >
            Save schedule
          </button>
        </React.Fragment>
      )}
    >
      <div>
        <h3 className="sp-section-title">Schedule</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Field label="Start date" required>
            <DateRangePicker placeholder="Pick date(s)" />
          </Field>
          <div className="sp-grid-2">
            <Field label="Start time" required>
              <TextInput value="7:35 AM" trail={<Icon name="ChevronDown" size={18} />} />
            </Field>
            <Field label="End time" required>
              <TextInput value="4:45 PM" trail={<Icon name="ChevronDown" size={18} />} />
            </Field>
          </div>
          <Field label="Cadence">
            <SelectField value="Does not repeat" />
          </Field>
        </div>
      </div>

      <hr className="sp-divider" />

      <div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <h3 className="sp-section-title" style={{ margin: 0 }}>Custom rules</h3>
          <button
            type="button"
            className="btn btn--sm btn--secondary"
            onClick={() => showToast("Custom rule — add inline (preview)")}
          >
            <Icon name="AddCircle" size={16} />Add rule
          </button>
        </div>
        <div
          className="sc-inner sc-inner--empty"
          style={{ minHeight: 88, padding: 16 }}
        >
          <p style={{ margin: 0, color: "var(--evr-content-primary-lowemp)", font: "var(--evr-body2)" }}>
            No custom rules yet
          </p>
        </div>
      </div>

      <hr className="sp-divider" />

      <div>
        <h3 className="sp-section-title">Work assignments</h3>
        <p style={{ margin: "-4px 0 12px", font: "var(--evr-body2)", color: "var(--evr-content-primary-default)" }}>
          Select bookings to apply the schedule to.
        </p>
        <Field label="Work assignments">
          <TagInput
            values={["5 Packers (Regular)", "10 Pickers (Regular)", "3 Line Managers (Regular)"]}
          />
        </Field>
      </div>
    </SidePanel>
  );
}

// ---------- Add schedule (long-term, recurring) ------------------------
// Redesigned panel — see recurring-schedule-review.html for rationale.
// Sections (in order of display):
//   1. Live summary chip (top)
//   2. Apply to bookings  — context first
//   3. Pattern            — segmented Weekly/Biweekly/Monthly + days
//   4. Window             — start/end + Ongoing toggle + presets
//   5. Shift hours        — times + presets + break + computed duration
//   6. Exceptions         — quick-add buttons + collapsed rule chips
//   7. Preview            — 3-month mini calendar
// External contract preserved: { open, onClose, onSave } — onSave is
// called with the full assembled schedule payload when available.

const DAY_LIST_LONG = [
  { key: "Mon", letter: "M" },
  { key: "Tue", letter: "T" },
  { key: "Wed", letter: "W" },
  { key: "Thu", letter: "T" },
  { key: "Fri", letter: "F" },
  { key: "Sat", letter: "S" },
  { key: "Sun", letter: "S" },
];
const DAY_IDX_LONG  = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 };
const DAY_ORDER_LONG = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];

// "Mon, Wed, Fri" or "Weekdays" / "Weekends" / "Every day".
function recurFormatDays(days) {
  const s = DAY_ORDER_LONG.filter((d) => days.includes(d));
  if (s.length === 7) return "Every day";
  if (s.join() === "Mon,Tue,Wed,Thu,Fri") return "Weekdays";
  if (s.join() === "Sat,Sun") return "Weekends";
  if (s.length === 0) return "No days selected";
  return s.map((d) => d.slice(0, 3)).join(", ");
}

// "7:00 AM" -> minutes from midnight. null on bad input.
function recurParseTime(t) {
  const m = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec((t || "").trim());
  if (!m) return null;
  let h = parseInt(m[1], 10) % 12;
  if (m[3].toUpperCase() === "PM") h += 12;
  return h * 60 + parseInt(m[2], 10);
}

// Returns { text: "8h", net: "8h net", overnight: bool, minutes: 480 }.
function recurDuration(start, end, breakMin) {
  const a = recurParseTime(start);
  const b = recurParseTime(end);
  if (a == null || b == null) return { text: "—", overnight: false, minutes: 0 };
  let diff = b - a;
  let overnight = false;
  if (diff <= 0) { diff += 24 * 60; overnight = true; }
  const net = diff - (breakMin || 0);
  const h = Math.floor(net / 60);
  const m = net % 60;
  const text = `${h}h${m ? ` ${m}m` : ""}${breakMin ? " net" : ""}`;
  return { text, overnight, minutes: net };
}

// US federal holidays 2026 (Memorial Day, Independence Day, Labor Day,
// etc.) — used by "Import holidays" link.
const US_HOLIDAYS_2026 = [
  { label: "New Year's Day",      date: "Jan 1, 2026"  },
  { label: "MLK Jr. Day",         date: "Jan 19, 2026" },
  { label: "Presidents' Day",     date: "Feb 16, 2026" },
  { label: "Memorial Day",        date: "May 25, 2026" },
  { label: "Juneteenth",          date: "Jun 19, 2026" },
  { label: "Independence Day",    date: "Jul 3, 2026"  }, // observed
  { label: "Labor Day",           date: "Sep 7, 2026"  },
  { label: "Columbus Day",        date: "Oct 12, 2026" },
  { label: "Veterans Day",        date: "Nov 11, 2026" },
  { label: "Thanksgiving",        date: "Nov 26, 2026" },
  { label: "Christmas Day",       date: "Dec 25, 2026" },
];

// --- Small atoms (local to this panel) --------------------------------

function RecurSeg({ value, options, onChange }) {
  return (
    <div className="recur-seg" role="tablist">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="tab"
          className="recur-seg-btn"
          aria-pressed={o.value === value}
          onClick={() => onChange && onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function RecurDayPills({ selected, onChange }) {
  return (
    <div className="recur-days">
      {DAY_LIST_LONG.map((d, i) => {
        const on = selected.includes(d.key);
        return (
          <button
            key={`${d.key}-${i}`}
            type="button"
            className="recur-day"
            aria-pressed={on}
            onClick={() =>
              onChange(on ? selected.filter((x) => x !== d.key) : [...selected, d.key])
            }
            title={d.key}
          >
            {d.letter}
          </button>
        );
      })}
    </div>
  );
}

function RecurChip({ active, onClick, children }) {
  return (
    <button type="button" className="recur-chip" aria-pressed={!!active} onClick={onClick}>
      {children}
    </button>
  );
}

function RecurToggle({ checked, onChange, children }) {
  return (
    <label
      className={"recur-toggle" + (checked ? " recur-toggle--on" : "")}
      onClick={(e) => { e.preventDefault(); onChange && onChange(!checked); }}
    >
      <span className="recur-toggle-track" aria-hidden="true">
        <span className="recur-toggle-thumb" />
      </span>
      <span>{children}</span>
    </label>
  );
}

// 3-month mini-calendar. Computes shift/mod/skip cells from the user's
// pattern + exceptions. Anchored at the schedule start month.
function RecurCalendarPreview({ startDate, endDate, ongoing, days, exceptions }) {
  // Parse "May 11, 2026" -> {year, monthIdx, day}.
  const parseDate = (s) => {
    if (!s) return null;
    const m = /^([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})$/.exec((s || "").trim());
    if (!m) return null;
    const monthIdx = _MONTHS_LONG.findIndex((x) => x.toLowerCase().startsWith(m[1].toLowerCase().slice(0, 3)));
    return { year: parseInt(m[3], 10), monthIdx, day: parseInt(m[2], 10) };
  };

  const start = parseDate(startDate);
  const end   = ongoing ? null : parseDate(endDate);
  if (!start) return null;

  // Show the start month + the next two.
  const months = [0, 1, 2].map((off) => {
    const monthIdx = (start.monthIdx + off) % 12;
    const year = start.year + Math.floor((start.monthIdx + off) / 12);
    const daysIn = new Date(year, monthIdx + 1, 0).getDate();
    // Calc day-of-week of the 1st (0 = Mon … 6 = Sun)
    const firstJsDow = new Date(year, monthIdx, 1).getDay(); // 0 = Sun ... 6 = Sat
    const startDow = (firstJsDow + 6) % 7;
    return {
      name: `${_MONTHS_LONG[monthIdx].slice(0, 3)} ${year}`,
      year, monthIdx, daysIn, startDow,
    };
  });

  // Lookup tables for cell decoration.
  const dayIdxSet = new Set(days.map((d) => DAY_IDX_LONG[d]));
  // Exceptions: skip-by-date list. Modify-applied-to-day-of-week set.
  const skipDates = new Set();
  const modifyDow = new Set();
  for (const e of exceptions) {
    if (e.type === "skip" && e.date) skipDates.add(e.date);
    if (e.type === "modify" && e.dow != null) modifyDow.add(e.dow);
  }
  const DOW = ["M","T","W","T","F","S","S"];

  const cellClass = (m, day) => {
    // Range bounds.
    const thisDate = { year: m.year, monthIdx: m.monthIdx, day };
    const before = thisDate.year < start.year ||
                   (thisDate.year === start.year && thisDate.monthIdx < start.monthIdx) ||
                   (thisDate.year === start.year && thisDate.monthIdx === start.monthIdx && thisDate.day < start.day);
    let after = false;
    if (end) {
      after = thisDate.year > end.year ||
              (thisDate.year === end.year && thisDate.monthIdx > end.monthIdx) ||
              (thisDate.year === end.year && thisDate.monthIdx === end.monthIdx && thisDate.day > end.day);
    }
    if (before || after) return "recur-mini-cell recur-mini-cell--out";

    const dow = (m.startDow + (day - 1)) % 7;
    const isShift = dayIdxSet.has(dow);
    if (!isShift) return "recur-mini-cell";

    // Build a label like "May 25, 2026" matching the exception storage format.
    const label = `${_MONTHS_LONG[m.monthIdx].slice(0,3)} ${day}, ${m.year}`;
    if ([...skipDates].some((sd) => sd.startsWith(label))) return "recur-mini-cell recur-mini-cell--skip";
    if (modifyDow.has(dow)) return "recur-mini-cell recur-mini-cell--mod";
    return "recur-mini-cell recur-mini-cell--shift";
  };

  return (
    <div className="recur-cal-grid">
      {months.map((m, mi) => (
        <div key={mi} className="recur-mini-month">
          <div className="recur-mini-month-h">{m.name}</div>
          <div className="recur-mini-grid">
            {DOW.map((d, i) => <div key={`dow${i}`} className="recur-mini-dow">{d}</div>)}
            {Array.from({ length: m.startDow }).map((_, i) => (
              <div key={`pad${i}`} className="recur-mini-cell recur-mini-cell--out" />
            ))}
            {Array.from({ length: m.daysIn }).map((_, di) => (
              <div key={`d${di}`} className={cellClass(m, di + 1)}>{di + 1}</div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
// Local month list — kept as RecurCalendarPreview helper, not exported.
const _MONTHS_LONG = ["January","February","March","April","May","June","July","August","September","October","November","December"];

// --- Main panel -------------------------------------------------------

function AddScheduleLongPanel({ open, onClose, onSave, bookings }) {
  // Recurrence pattern --------------------------------------------------
  const [recurrence, setRecurrence] = useStateSp("weekly");      // "weekly" | "biweekly" | "monthly"
  const [days, setDays]             = useStateSp(["Mon","Tue","Wed","Thu","Fri"]);
  const [monthlyMode, setMonthlyMode] = useStateSp("weekday");   // "weekday" | "dom"
  const [monthlyOccurrence, setMonthlyOccurrence] = useStateSp("1st");
  const [monthlyWeekday, setMonthlyWeekday] = useStateSp("Mon");

  // Window --------------------------------------------------------------
  const [startDate, setStartDate] = useStateSp("May 11, 2026");
  const [endDate,   setEndDate]   = useStateSp("Aug 10, 2026");
  const [ongoing,   setOngoing]   = useStateSp(false);
  const [windowPreset, setWindowPreset] = useStateSp("13wk");

  // Hours ---------------------------------------------------------------
  const [startTime, setStartTime] = useStateSp("7:00 AM");
  const [endTime,   setEndTime]   = useStateSp("3:30 PM");
  const [breakMin,  setBreakMin]  = useStateSp("30");
  const [shiftPreset, setShiftPreset] = useStateSp("day");

  // Exceptions ----------------------------------------------------------
  const [exceptions, setExceptions] = useStateSp([]);
  const [excEditor,  setExcEditor]  = useStateSp(null); // { type, ... } | null

  // Bookings ------------------------------------------------------------
  // Read bookings from the live req draft when caller didn't pass them.
  const liveBookings = bookings ||
    (typeof window !== "undefined" && window.__reqDraft ? window.__reqDraft.bookings : null) ||
    [];
  const [selectedBookings, setSelectedBookings] = useStateSp([]);

  // Reset everything when panel re-opens so each edit starts clean.
  useEffectSp(() => {
    if (!open) return;
    setRecurrence("weekly");
    setDays(["Mon","Tue","Wed","Thu","Fri"]);
    setMonthlyMode("weekday");
    setMonthlyOccurrence("1st");
    setMonthlyWeekday("Mon");
    setStartDate("May 11, 2026");
    setEndDate("Aug 10, 2026");
    setOngoing(false);
    setWindowPreset("13wk");
    setStartTime("7:00 AM");
    setEndTime("3:30 PM");
    setBreakMin("30");
    setShiftPreset("day");
    setExceptions([
      // Seed one of each so the user sees what the shape looks like.
      { id: 1, type: "skip",    title: "Skip Memorial Day", date: "May 25, 2026", sub: "Mon · May 25, 2026" },
      { id: 2, type: "modify",  title: "Late start on Wednesdays", dow: 2, sub: "Start 9:00 AM (all jobs)" },
    ]);
    setExcEditor(null);
    // Pre-select all current bookings to mirror the current panel's default.
    setSelectedBookings((liveBookings || []).map((b) => b.id));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // ----- Live computed values -----------------------------------------
  const dur = recurDuration(startTime, endTime, parseInt(breakMin || "0", 10) || 0);
  const workersPerShift = (liveBookings || [])
    .filter((b) => selectedBookings.includes(b.id))
    .reduce((acc, b) => acc + (b.quantity || 0), 0);

  // Rough shift-day count over the window (mock math): weeks * days.
  const shiftCount = (() => {
    if (ongoing) return null;
    // Quick parse: count weeks between start/end. If parsing fails, fall
    // back to 13 weeks (matching the demo window).
    const s = startDate, e = endDate;
    const sM = /^([A-Za-z]+)\s+(\d{1,2}),\s+(\d{4})$/.exec(s);
    const eM = /^([A-Za-z]+)\s+(\d{1,2}),\s+(\d{4})$/.exec(e);
    if (!sM || !eM) return days.length * 13;
    const sD = new Date(`${sM[1]} ${sM[2]}, ${sM[3]}`);
    const eD = new Date(`${eM[1]} ${eM[2]}, ${eM[3]}`);
    if (!isFinite(sD) || !isFinite(eD)) return days.length * 13;
    const weeks = Math.max(0, Math.round((eD - sD) / (7 * 24 * 60 * 60 * 1000)));
    let n = weeks * days.length;
    if (recurrence === "biweekly") n = Math.ceil(n / 2);
    if (recurrence === "monthly")  n = Math.ceil(weeks / 4); // one shift per ~4 weeks
    return n - exceptions.filter((x) => x.type === "skip").length;
  })();

  // ----- Quick-preset handlers ----------------------------------------
  const applyShiftPreset = (preset) => {
    setShiftPreset(preset);
    if (preset === "day")   { setStartTime("7:00 AM");  setEndTime("3:30 PM"); }
    if (preset === "swing") { setStartTime("3:00 PM");  setEndTime("11:30 PM"); }
    if (preset === "night") { setStartTime("11:00 PM"); setEndTime("7:30 AM"); }
  };

  const applyWindowPreset = (preset) => {
    setWindowPreset(preset);
    setOngoing(false);
    if (preset === "4wk")  setEndDate("Jun 8, 2026");
    if (preset === "8wk")  setEndDate("Jul 6, 2026");
    if (preset === "13wk") setEndDate("Aug 10, 2026");
    if (preset === "3mo")  setEndDate("Aug 10, 2026");
    if (preset === "6mo")  setEndDate("Nov 10, 2026");
    if (preset === "qtr")  setEndDate("Jun 30, 2026");
  };

  // ----- Exceptions: add / remove -------------------------------------
  const addException = (kind) => {
    const nextId = exceptions.length ? Math.max(...exceptions.map((x) => x.id)) + 1 : 1;
    if (kind === "skip") {
      setExcEditor({ type: "skip", id: nextId, date: "", reason: "" });
    } else if (kind === "modify") {
      setExcEditor({ type: "modify", id: nextId, dow: 2, startTime: "9:00 AM", endTime: endTime });
    } else if (kind === "variant") {
      setExcEditor({ type: "variant", id: nextId, role: "Line Managers", startTime: "6:30 AM", endTime: endTime });
    }
  };

  const commitException = () => {
    if (!excEditor) return;
    const ex = excEditor;
    let next;
    if (ex.type === "skip") {
      if (!ex.date) { showToast("Pick a date to skip", { kind: "warning" }); return; }
      next = { id: ex.id, type: "skip", date: ex.date, title: `Skip ${ex.date}`,
               sub: ex.reason ? ex.reason : "No shifts generated" };
    } else if (ex.type === "modify") {
      const dowName = DAY_LIST_LONG[ex.dow]?.key || "Day";
      next = { id: ex.id, type: "modify", dow: ex.dow,
               title: `Custom hours on ${dowName}s`,
               sub: `${ex.startTime} – ${ex.endTime}` };
    } else if (ex.type === "variant") {
      next = { id: ex.id, type: "variant", role: ex.role,
               title: `${ex.role} arrive earlier`,
               sub: `${ex.startTime} – ${ex.endTime}` };
    }
    setExceptions((es) => {
      const without = es.filter((e) => e.id !== ex.id);
      return [...without, next];
    });
    setExcEditor(null);
    showToast("Exception added", { kind: "success" });
  };

  const importHolidays = () => {
    const next = US_HOLIDAYS_2026.map((h, i) => ({
      id: (exceptions.length ? Math.max(...exceptions.map((x) => x.id)) : 0) + i + 100,
      type: "skip",
      date: h.date,
      title: `Skip ${h.label}`,
      sub: h.date,
    }));
    // Avoid duplicate dates.
    setExceptions((es) => {
      const haveDates = new Set(es.filter((e) => e.type === "skip").map((e) => e.date));
      const fresh = next.filter((n) => !haveDates.has(n.date));
      return [...es, ...fresh];
    });
    showToast(`Imported ${US_HOLIDAYS_2026.length} holidays`, { kind: "success" });
  };

  // ----- Save (assemble payload) --------------------------------------
  const handleSave = () => {
    const payload = {
      recurrence,
      days,
      monthly: recurrence === "monthly" ? {
        mode: monthlyMode,
        occurrence: monthlyOccurrence,
        weekday: monthlyWeekday,
      } : null,
      window: { start: startDate, end: ongoing ? null : endDate, ongoing },
      hours: { start: startTime, end: endTime, breakMin: parseInt(breakMin || "0", 10) || 0,
               overnight: dur.overnight, totalMinutes: dur.minutes },
      exceptions,
      bookingIds: selectedBookings,
      summary: {
        days: recurFormatDays(days),
        shiftDayCount: shiftCount,
        workersPerShift,
      },
    };
    if (onSave) onSave(payload);
    showToast("Schedule saved", { kind: "success" });
  };

  // ----- Validation ---------------------------------------------------
  const issues = [];
  if (days.length === 0 && recurrence === "weekly") issues.push("Pick at least one day");
  if (!ongoing && recurParseTime(startTime) != null && recurParseTime(endTime) != null) {
    // overnight is OK; warn only if start === end
    if (startTime === endTime) issues.push("Start and end time are the same");
  }
  if (selectedBookings.length === 0 && (liveBookings || []).length > 0) {
    issues.push("Select at least one booking");
  }

  return (
    <SidePanel
      open={open}
      title="Edit recurring schedule"
      onClose={onClose}
      footer={(
        <React.Fragment>
          <div className="recur-foot-left">
            <button
              type="button"
              className="btn btn--lg btn--tertiary"
              onClick={() => showToast("Saved as preset \u2014 available in the next requisition", { kind: "success" })}
              title="Save this pattern as a reusable preset"
            >
              <Icon name="Save" size={16} />Save as preset
            </button>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button type="button" className="btn btn--lg btn--tertiary" onClick={onClose}>Cancel</button>
            <button
              type="button"
              className="btn btn--lg btn--primary"
              onClick={handleSave}
              disabled={issues.length > 0}
              title={issues.length ? issues.join(" \u00b7 ") : "Save schedule"}
            >
              Save schedule
            </button>
          </div>
        </React.Fragment>
      )}
    >
      {/* ----- Summary chip ------------------------------------------ */}
      <div className="recur-summary" style={{ margin: "-24px -24px 0", padding: "14px 24px 16px" }}>
        <span className="recur-summary-ic" aria-hidden="true">
          <Icon name="Refresh" size={18} />
        </span>
        <span className="recur-summary-text">
          <span className="recur-summary-pri">
            {recurFormatDays(days)} &middot; {startTime} &ndash; {endTime}
            {dur.overnight && <span className="recur-summary-tag">Overnight</span>}
          </span>
          <span className="recur-summary-sec">
            {ongoing
              ? `Ongoing from ${startDate}`
              : `${startDate} \u2192 ${endDate}`}
            {" \u00b7 "}
            {ongoing
              ? "open-ended"
              : `${Math.max(0, shiftCount || 0)} shift days \u00b7 ${workersPerShift * Math.max(0, shiftCount || 0)} worker-shifts`}
          </span>
        </span>
      </div>

      {/* ----- 1. Apply to bookings (context first) ------------------ */}
      <div>
        <div className="recur-sec-head">
          <h3 className="sp-section-title" style={{ margin: 0 }}>Apply to bookings</h3>
          <span className="recur-sec-aside">
            {selectedBookings.length} of {(liveBookings || []).length} selected
          </span>
        </div>
        {(liveBookings || []).length === 0 ? (
          <div className="recur-exc-empty">
            No bookings yet &mdash; add bookings on the requisition first, then come back to attach a schedule.
          </div>
        ) : (
          <React.Fragment>
            <ul className="recur-bk-list">
              {(liveBookings || []).map((b, i) => {
                const on = selectedBookings.includes(b.id);
                const title = b.job
                  ? `Work assignment ${i + 1} \u00b7 ${b.quantity || 1} ${b.job}`
                  : `Work assignment ${i + 1}`;
                return (
                  <li
                    key={b.id}
                    className={"recur-bk-pill" + (on ? " recur-bk-pill--on" : "")}
                    onClick={() =>
                      setSelectedBookings((cur) =>
                        on ? cur.filter((x) => x !== b.id) : [...cur, b.id]
                      )
                    }
                  >
                    <span className="recur-bk-pill-check">
                      {on && <Icon name="Check" size={12} />}
                    </span>
                    <span className="recur-bk-pill-text">
                      <span className="recur-bk-pill-pri">{title}</span>
                      <span className="recur-bk-pill-sec">
                        {b.level || "Any level"}{b.attire && b.attire !== "none" ? ` \u00b7 ${b.attire}` : ""}
                      </span>
                    </span>
                    <span className="recur-bk-pill-cap">{b.quantity || 1}/shift</span>
                  </li>
                );
              })}
            </ul>
            <div className="recur-roll">
              <Icon name="PersonPlus" size={16} />
              <span>
                <strong>{workersPerShift} worker{workersPerShift === 1 ? "" : "s"}</strong>{" "}
                per scheduled shift day
                {selectedBookings.length > 0 && (
                  <span style={{ color: "var(--evr-content-primary-lowemp)" }}>
                    {" "}&middot; covers {selectedBookings.length} booking{selectedBookings.length !== 1 ? "s" : ""}
                  </span>
                )}
              </span>
            </div>
          </React.Fragment>
        )}
      </div>

      <hr className="sp-divider" />

      {/* ----- 2. Pattern -------------------------------------------- */}
      <div>
        <div className="recur-sec-head">
          <h3 className="sp-section-title" style={{ margin: 0 }}>Pattern</h3>
          <span className="recur-sec-aside">How often the shift repeats</span>
        </div>

        <RecurSeg
          value={recurrence}
          onChange={setRecurrence}
          options={[
            { value: "weekly",    label: "Weekly" },
            { value: "biweekly",  label: "Every 2 weeks" },
            { value: "monthly",   label: "Monthly" },
          ]}
        />

        {(recurrence === "weekly" || recurrence === "biweekly") && (
          <React.Fragment>
            <Field
              label={recurrence === "biweekly" ? "Days (each on-week)" : "Days"}
              required
              action={(
                <div className="recur-day-presets">
                  <RecurChip
                    active={days.join() === "Mon,Tue,Wed,Thu,Fri"}
                    onClick={() => setDays(["Mon","Tue","Wed","Thu","Fri"])}
                  >Weekdays</RecurChip>
                  <RecurChip
                    active={days.join() === "Sat,Sun"}
                    onClick={() => setDays(["Sat","Sun"])}
                  >Weekends</RecurChip>
                  <RecurChip
                    active={days.length === 7}
                    onClick={() => setDays(DAY_ORDER_LONG)}
                  >Every day</RecurChip>
                </div>
              )}
            >
              <RecurDayPills selected={days} onChange={setDays} />
            </Field>
            {recurrence === "biweekly" && (
              <Field label="On-week starts" hint="Week 1 begins on the start date. Off-weeks generate no shifts." style={{ marginTop: 12 }}>
                <div className="cur-input" style={{
                  display: "flex", alignItems: "center", gap: 8,
                  height: 40, padding: "0 12px",
                  border: "1px solid var(--evr-border-decorative-default)",
                  borderRadius: "var(--evr-radius-3xs)",
                  background: "var(--evr-surface-primary-default)",
                  font: "var(--evr-body1)", color: "var(--evr-content-primary-highemp)",
                }}>
                  Week of {startDate}
                  <Icon name="Calendar" size={16} style={{ marginLeft: "auto", color: "var(--evr-content-primary-lowemp)" }} />
                </div>
              </Field>
            )}
          </React.Fragment>
        )}

        {recurrence === "monthly" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <RecurSeg
              value={monthlyMode}
              onChange={setMonthlyMode}
              options={[
                { value: "weekday", label: "Nth weekday" },
                { value: "dom",     label: "Day of month" },
              ]}
            />
            {monthlyMode === "weekday" ? (
              <div className="sp-grid-2" style={{ gridTemplateColumns: "1fr 1fr" }}>
                <Field label="Occurrence">
                  <Dropdown
                    options={["1st","2nd","3rd","4th","Last","1st & 3rd","2nd & 4th"]}
                    value={monthlyOccurrence}
                    onChange={setMonthlyOccurrence}
                  />
                </Field>
                <Field label="Weekday">
                  <Dropdown
                    options={DAY_ORDER_LONG}
                    value={monthlyWeekday}
                    onChange={setMonthlyWeekday}
                  />
                </Field>
              </div>
            ) : (
              <Field label="Day of month" hint="Use 'Last' to anchor to the last day of every month.">
                <Dropdown
                  options={["1st","5th","10th","15th","20th","25th","Last"]}
                  value={monthlyOccurrence}
                  onChange={setMonthlyOccurrence}
                />
              </Field>
            )}
          </div>
        )}
      </div>

      <hr className="sp-divider" />

      {/* ----- 3. Window --------------------------------------------- */}
      <div>
        <div className="recur-sec-head">
          <h3 className="sp-section-title" style={{ margin: 0 }}>Window</h3>
          <RecurToggle checked={ongoing} onChange={(v) => { setOngoing(v); if (v) setWindowPreset(""); }}>
            Ongoing
          </RecurToggle>
        </div>

        <div className="recur-grid-2">
          <Field label="Start date" required>
            <DateRangePicker
              value={startDate}
              onChange={(v) => setStartDate(v)}
              placeholder="Start date"
              allowSingle
            />
          </Field>
          <Field
            label="End date"
            required={!ongoing}
            hint={ongoing ? "Shifts keep generating until you end the schedule." : undefined}
          >
            {ongoing ? (
              <div className="recur-noend">No end date</div>
            ) : (
              <DateRangePicker
                value={endDate}
                onChange={(v) => { setEndDate(v); setWindowPreset(""); }}
                placeholder="End date"
                allowSingle
              />
            )}
          </Field>
        </div>

        {!ongoing && (
          <div className="recur-chips">
            <RecurChip active={windowPreset === "4wk"}  onClick={() => applyWindowPreset("4wk")}>4 weeks</RecurChip>
            <RecurChip active={windowPreset === "8wk"}  onClick={() => applyWindowPreset("8wk")}>8 weeks</RecurChip>
            <RecurChip active={windowPreset === "13wk"} onClick={() => applyWindowPreset("13wk")}>13 weeks</RecurChip>
            <RecurChip active={windowPreset === "3mo"}  onClick={() => applyWindowPreset("3mo")}>3 months</RecurChip>
            <RecurChip active={windowPreset === "6mo"}  onClick={() => applyWindowPreset("6mo")}>6 months</RecurChip>
            <RecurChip active={windowPreset === "qtr"}  onClick={() => applyWindowPreset("qtr")}>Through end of Q2</RecurChip>
          </div>
        )}
      </div>

      <hr className="sp-divider" />

      {/* ----- 4. Shift hours --------------------------------------- */}
      <div>
        <div className="recur-sec-head">
          <h3 className="sp-section-title" style={{ margin: 0 }}>Shift hours</h3>
          <span className="recur-computed">
            <Icon name="Hourglass" size={14} />
            <strong>{dur.text}</strong>
            <span style={{ color: "var(--evr-content-primary-lowemp)" }}>per shift</span>
          </span>
        </div>

        <div className="recur-chips" style={{ marginTop: 0, marginBottom: 12 }}>
          <RecurChip active={shiftPreset === "day"}    onClick={() => applyShiftPreset("day")}>Day &middot; 7am&ndash;3:30pm</RecurChip>
          <RecurChip active={shiftPreset === "swing"}  onClick={() => applyShiftPreset("swing")}>Swing &middot; 3pm&ndash;11:30pm</RecurChip>
          <RecurChip active={shiftPreset === "night"}  onClick={() => applyShiftPreset("night")}>Night &middot; 11pm&ndash;7:30am</RecurChip>
        </div>

        <div className="recur-grid-3">
          <Field label="Start time" required>
            <TimeInput value={startTime} onChange={(v) => { setStartTime(v); setShiftPreset(""); }} />
          </Field>
          <Field label="End time" required>
            <TimeInput value={endTime} onChange={(v) => { setEndTime(v); setShiftPreset(""); }} />
          </Field>
          <Field label="Break (min)" hint="Unpaid">
            <Dropdown
              options={["0","15","30","45","60"]}
              value={breakMin}
              onChange={setBreakMin}
            />
          </Field>
        </div>

        {dur.overnight && (
          <div className="recur-roll recur-roll--info" style={{ marginTop: 10 }}>
            <Icon name="Information" size={16} />
            <span>
              <strong>Overnight shift</strong> &mdash; end time falls on the next calendar day. Each shift counts on its start date.
            </span>
          </div>
        )}
      </div>

      <hr className="sp-divider" />

      {/* ----- 5. Exceptions ---------------------------------------- */}
      <div>
        <div className="recur-sec-head">
          <h3 className="sp-section-title" style={{ margin: 0 }}>Exceptions</h3>
          <span className="recur-sec-aside">
            {exceptions.length} active
          </span>
        </div>

        <div className="recur-exc-actions">
          <button type="button" className="recur-exc-action" onClick={() => addException("skip")}>
            <Icon name="TimeUndo" size={14} />Skip dates
          </button>
          <button type="button" className="recur-exc-action" onClick={() => addException("modify")}>
            <Icon name="TimeAdd" size={14} />Modify a date
          </button>
          <button type="button" className="recur-exc-action" onClick={() => addException("variant")}>
            <Icon name="PersonClock" size={14} />Variant by role
          </button>
        </div>

        {excEditor && (
          <div className="recur-exc-editor">
            <p className="recur-exc-editor-h">
              {excEditor.type === "skip"    ? "Skip a specific date"  :
               excEditor.type === "modify"  ? "Modify hours on a weekday" :
                                              "Custom hours for a role"}
            </p>
            {excEditor.type === "skip" && (
              <React.Fragment>
                <Field label="Date" required>
                  <DateRangePicker
                    value={excEditor.date}
                    onChange={(v) => setExcEditor({ ...excEditor, date: v })}
                    placeholder="Pick a date"
                    allowSingle
                  />
                </Field>
                <Field label="Reason (optional)">
                  <TextInput
                    value={excEditor.reason}
                    onChange={(v) => setExcEditor({ ...excEditor, reason: v })}
                    placeholder="e.g. Holiday, plant maintenance"
                  />
                </Field>
              </React.Fragment>
            )}
            {excEditor.type === "modify" && (
              <React.Fragment>
                <Field label="Weekday" required>
                  <Dropdown
                    options={DAY_ORDER_LONG}
                    value={DAY_LIST_LONG[excEditor.dow]?.key || "Mon"}
                    onChange={(v) => setExcEditor({ ...excEditor, dow: DAY_IDX_LONG[v] || 0 })}
                  />
                </Field>
                <div className="recur-grid-2">
                  <Field label="Start time" required>
                    <TimeInput
                      value={excEditor.startTime}
                      onChange={(v) => setExcEditor({ ...excEditor, startTime: v })}
                    />
                  </Field>
                  <Field label="End time" required>
                    <TimeInput
                      value={excEditor.endTime}
                      onChange={(v) => setExcEditor({ ...excEditor, endTime: v })}
                    />
                  </Field>
                </div>
              </React.Fragment>
            )}
            {excEditor.type === "variant" && (
              <React.Fragment>
                <Field label="Role" required>
                  <Dropdown
                    options={(liveBookings || []).map((b) => b.job).filter(Boolean)}
                    value={excEditor.role}
                    onChange={(v) => setExcEditor({ ...excEditor, role: v })}
                  />
                </Field>
                <div className="recur-grid-2">
                  <Field label="Start time" required>
                    <TimeInput
                      value={excEditor.startTime}
                      onChange={(v) => setExcEditor({ ...excEditor, startTime: v })}
                    />
                  </Field>
                  <Field label="End time" required>
                    <TimeInput
                      value={excEditor.endTime}
                      onChange={(v) => setExcEditor({ ...excEditor, endTime: v })}
                    />
                  </Field>
                </div>
              </React.Fragment>
            )}
            <div className="recur-exc-editor-foot">
              <button type="button" className="btn btn--sm btn--tertiary" onClick={() => setExcEditor(null)}>Cancel</button>
              <button type="button" className="btn btn--sm btn--primary" onClick={commitException}>Add exception</button>
            </div>
          </div>
        )}

        {exceptions.length === 0 && !excEditor && (
          <div className="recur-exc-empty">
            No exceptions yet &mdash; the schedule will generate every selected day in the window.
          </div>
        )}

        {exceptions.length > 0 && (
          <ul className="recur-exc-list">
            {exceptions.map((ex) => (
              <li key={ex.id} className="recur-exc-item">
                <span className={"recur-exc-item-ic recur-exc-item-ic--" + ex.type}>
                  <Icon
                    name={ex.type === "skip" ? "TimeUndo" : ex.type === "modify" ? "TimeAdd" : "PersonClock"}
                    size={14}
                  />
                </span>
                <span className="recur-exc-item-text">
                  <span className="recur-exc-item-pri">{ex.title}</span>
                  <span className="recur-exc-item-sec">{ex.sub}</span>
                </span>
                <span className="recur-exc-item-actions">
                  <button
                    type="button"
                    className="recur-iconbtn"
                    aria-label="Edit"
                    onClick={() => setExcEditor(ex)}
                  >
                    <Icon name="Edit" size={14} />
                  </button>
                  <button
                    type="button"
                    className="recur-iconbtn recur-iconbtn--danger"
                    aria-label="Delete"
                    onClick={() => setExceptions((es) => es.filter((e) => e.id !== ex.id))}
                  >
                    <Icon name="TrashCan" size={14} />
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}

        <button type="button" className="recur-link" onClick={importHolidays}>
          <Icon name="AddCircle" size={14} />Import US federal holidays for 2026 ({US_HOLIDAYS_2026.length} dates)
        </button>
      </div>

      <hr className="sp-divider" />

      {/* ----- 6. Preview ------------------------------------------- */}
      <div>
        <div className="recur-sec-head">
          <h3 className="sp-section-title" style={{ margin: 0 }}>Preview</h3>
          <span className="recur-preview-legend">
            <span><span className="recur-preview-dot recur-pl-dot--shift" />Shift</span>
            <span><span className="recur-preview-dot recur-pl-dot--mod" />Modified</span>
            <span><span className="recur-preview-dot recur-pl-dot--skip" />Skip</span>
          </span>
        </div>

        <div className="recur-preview">
          <div className="recur-preview-head">
            <span className="recur-preview-title">
              <span className="recur-preview-title-pri">
                {ongoing
                  ? `${days.length ? recurFormatDays(days) : "—"} \u00b7 ongoing`
                  : `${Math.max(0, shiftCount || 0)} shift days \u00b7 ${workersPerShift * Math.max(0, shiftCount || 0)} worker-shifts`}
              </span>
              <span className="recur-preview-title-sec">
                {ongoing
                  ? `First shift on or after ${startDate}`
                  : `${startDate} \u2192 ${endDate}`}
              </span>
            </span>
          </div>
          <RecurCalendarPreview
            startDate={startDate}
            endDate={endDate}
            ongoing={ongoing}
            days={days}
            exceptions={exceptions}
          />
        </div>

        {issues.length > 0 && (
          <div className="recur-validation" style={{ marginTop: 12 }}>
            <Icon name="Alert" size={16} />
            <span>
              <strong>Fix {issues.length} issue{issues.length !== 1 ? "s" : ""}</strong> before saving:&nbsp;
              {issues.join(" \u00b7 ")}
            </span>
          </div>
        )}
      </div>
    </SidePanel>
  );
}

Object.assign(window, {
  SidePanel,
  Accordion,
  EditBookingPanel,
  EditLocationPanel,
  AddScheduleShortPanel,
  AddScheduleLongPanel,
});
