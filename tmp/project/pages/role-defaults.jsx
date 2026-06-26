// =====================================================================
// Flex Work — Role defaults + visual attire picker + cert search.
//
// Holds the "what does this role typically look like" data so the
// Edit booking panel can pre-fill responsibilities, instructions, attire,
// and suggested certifications when the user picks a job. Defaults are
// editable on a per-booking basis.
//
// Exports (window): ROLE_DEFAULTS, ATTIRE_TYPES, CERT_CATALOG,
//                   AttireMannequin, AttirePicker, CertSearch, Textarea.
// =====================================================================

const { useState: useStateRl, useMemo: useMemoRl, useEffect: useEffectRl, useRef: useRefRl } = React;

// ---------- Attire visual catalog --------------------------------------

const ATTIRE_TYPES = [
  { id: "safety-vest",         label: "Hi-vis vest",      note: "Vest + closed-toe shoes" },
  { id: "safety-vest-hardhat", label: "Full PPE",         note: "Hard hat, vest, steel-toe" },
  { id: "uniform",             label: "Supplier uniform", note: "Provided on site" },
  { id: "lab-coat",            label: "Lab coat",         note: "Coat + safety glasses" },
  { id: "business-casual",     label: "Business casual",  note: "Collared shirt, dress shoes" },
  { id: "all-black",           label: "All black",        note: "Black top, bottom, shoes" },
  { id: "scrubs",              label: "Scrubs",           note: "Hospital-issued scrubs" },
  { id: "none",                label: "No requirement",   note: "Worker's choice" },
];

// A stylized mannequin (head + torso + legs) re-colored per attire type.
// Sized to fit ~72×88 inside a card. Uses Everest tokens for neutrals; bright
// hi-vis colors are hard-coded (no semantic token for "Day-Glo yellow").
function AttireMannequin({ type = "none", size = 72 }) {
  const skin = "#E0B89A";          // neutral skin tone, brand-agnostic
  const hair = "var(--evr-neutral-30)";
  const shoeDark = "var(--evr-neutral-20)";
  const slate = "var(--evr-neutral-40)";

  // Per-attire palette
  const looks = {
    "safety-vest":         { top: "#1F2937", vest: "#FFD600", vestEdge: "#3067DB", pants: "#475569", shoe: shoeDark, hat: null,        hatCol: null,       coat: null, },
    "safety-vest-hardhat": { top: "#1F2937", vest: "#FF8A00", vestEdge: "#FFFFFF", pants: "#475569", shoe: shoeDark, hat: "hardhat",   hatCol: "#FFD600",  coat: null, },
    "uniform":             { top: "#3067DB", vest: null,      vestEdge: null,     pants: "#1F2937", shoe: shoeDark, hat: null,        hatCol: null,       coat: null, },
    "lab-coat":            { top: "#FFFFFF", vest: null,      vestEdge: null,     pants: slate,     shoe: shoeDark, hat: null,        hatCol: null,       coat: "lab", },
    "business-casual":     { top: "#A7C7E7", vest: null,      vestEdge: null,     pants: "#1F2937", shoe: shoeDark, hat: null,        hatCol: null,       coat: null,  tie: true },
    "all-black":           { top: "#1F1F23", vest: null,      vestEdge: null,     pants: "#1F1F23", shoe: "#0a0a0a", hat: null,       hatCol: null,       coat: null, },
    "scrubs":              { top: "#3FB6A6", vest: null,      vestEdge: null,     pants: "#3FB6A6", shoe: "#FFFFFF", hat: null,       hatCol: null,       coat: null, },
    "none":                { top: "var(--evr-neutral-90)", vest: null, vestEdge: null, pants: "var(--evr-neutral-90)", shoe: "var(--evr-neutral-70)", hat: null, hatCol: null, coat: null, ghost: true },
  };
  const L = looks[type] || looks.none;

  return (
    <svg
      width={size}
      height={Math.round(size * 1.22)}
      viewBox="0 0 72 88"
      role="img"
      aria-label={`${type} mannequin`}
    >
      {/* head */}
      <circle cx="36" cy="12" r="9" fill={L.ghost ? "var(--evr-neutral-90)" : skin} />
      {/* hair cap */}
      {!L.ghost && <path d="M27 11 a9 9 0 0 1 18 0 v-2 a9 9 0 0 0 -18 0 z" fill={hair} />}
      {/* hardhat */}
      {L.hat === "hardhat" && (
        <g>
          <ellipse cx="36" cy="7"  rx="11" ry="3.5" fill={L.hatCol} />
          <path d="M25 7 q11 -12 22 0 z" fill={L.hatCol} />
          <rect x="25" y="5.5" width="22" height="2" fill="rgba(0,0,0,0.18)" />
        </g>
      )}

      {/* neck */}
      <rect x="33" y="20" width="6" height="4" fill={skin} />

      {/* torso (shirt/top) */}
      <path
        d="M16 28 q6 -4 20 -4 t20 4 v22 q-2 4 -20 4 t-20 -4 z"
        fill={L.top}
        stroke={L.ghost ? "var(--evr-border-decorative-default)" : "none"}
        strokeDasharray={L.ghost ? "3 3" : "0"}
      />

      {/* lab coat overlay */}
      {L.coat === "lab" && (
        <g>
          <path d="M16 28 q6 -4 20 -4 t20 4 v36 h-40 z" fill="#FFFFFF" stroke="#D1D5DB" strokeWidth="0.8" />
          <line x1="36" y1="24" x2="36" y2="64" stroke="#D1D5DB" strokeWidth="0.8" />
          <circle cx="34" cy="36" r="0.9" fill="#9CA3AF" />
          <circle cx="34" cy="46" r="0.9" fill="#9CA3AF" />
          <circle cx="34" cy="56" r="0.9" fill="#9CA3AF" />
        </g>
      )}

      {/* tie */}
      {L.tie && (
        <path d="M34 24 l2 4 l2 -4 l-1 14 l-1 4 l-1 -4 z" fill="#1F2937" />
      )}

      {/* hi-vis vest */}
      {L.vest && (
        <g>
          <path d="M19 28 q4 -3 12 -3 v28 q-8 0 -12 -2 z" fill={L.vest} />
          <path d="M53 28 q-4 -3 -12 -3 v28 q8 0 12 -2 z" fill={L.vest} />
          <rect x="19" y="40" width="34" height="3" fill={L.vestEdge} />
          <rect x="19" y="33" width="34" height="1.5" fill={L.vestEdge} opacity="0.6" />
        </g>
      )}

      {/* legs (pants) */}
      <rect x="22" y="54" width="12" height="22" rx="2" fill={L.pants} />
      <rect x="38" y="54" width="12" height="22" rx="2" fill={L.pants} />

      {/* shoes */}
      <rect x="20" y="76" width="14" height="4" rx="1.5" fill={L.shoe} />
      <rect x="38" y="76" width="14" height="4" rx="1.5" fill={L.shoe} />
    </svg>
  );
}

// Visual attire picker. Cards 1fr in a grid; selected gets a 2px blue ring.
function AttirePicker({ value, onChange }) {
  return (
    <div className="attire-grid" role="radiogroup" aria-label="Attire">
      {ATTIRE_TYPES.map((a) => {
        const selected = value === a.id;
        return (
          <button
            key={a.id}
            type="button"
            role="radio"
            aria-checked={selected}
            className={"attire-card" + (selected ? " attire-card--on" : "")}
            onClick={() => onChange && onChange(a.id)}
          >
            <span className="attire-card-art">
              <AttireMannequin type={a.id} size={64} />
            </span>
            <span className="attire-card-label">{a.label}</span>
            <span className="attire-card-note">{a.note}</span>
            {selected && (
              <span className="attire-card-check" aria-hidden="true">
                <Icon name="Check" size={12} />
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ---------- Certifications catalog --------------------------------------

const CERT_CATALOG = [
  "OSHA 10",
  "OSHA 30",
  "Forklift Operator Certification",
  "Lockout/Tagout Awareness",
  "Pallet Jack Operation",
  "Machine Operation",
  "Lean Leadership",
  "Cash Handling",
  "Customer Service Basics",
  "ASQ CQI",
  "GMP Awareness",
  "First Aid / CPR",
  "Food Handler Permit",
  "ServSafe Manager",
  "TWIC Card",
  "DOT Medical Card",
  "Hazmat Awareness",
  "Bloodborne Pathogens",
  "Reach Truck Certification",
  "Stand-up Forklift Certification",
];

// ---------- Role defaults ----------------------------------------------

const LEVEL_OPTIONS = [
  "Any level",
  "Entry level",
  "Intermediate",
  "Experienced",
  "Lead / Supervisor",
];

const ROLE_DEFAULTS = {
  "Production Associate": {
    level: "Entry level",
    responsibilities:
      "Stage materials at the assigned cell, run the SOP for the shift's build plan, complete in-process quality checks, and escalate any deviation to the line lead.",
    instructions:
      "Check in at gate B and pick up your line badge from the supervisor. Steel-toe shoes and safety glasses are required — none provided on site.",
    attire: "safety-vest",
    certs: ["OSHA 10", "GMP Awareness"],
  },
  "Production Line Associate": {
    level: "Entry level",
    responsibilities:
      "Operate the assigned station on the production line, complete quality checks against the SOP, and escalate any equipment issues to the lead within 5 minutes.",
    instructions:
      "Check in at gate B. Pick up your line badge and lock-out tag from the supervisor. Steel-toe shoes are required — none provided on site.",
    attire: "safety-vest",
    certs: ["OSHA 10", "Lockout/Tagout Awareness"],
  },
  "Pickers": {
    level: "Entry level",
    responsibilities:
      "Pick items per RF scanner instructions, confirm SKU and quantity, and stage completed orders at the outbound dock.",
    instructions:
      "Check in at the supplier desk near dock 4. RF scanners will be issued at shift start.",
    attire: "safety-vest",
    certs: ["OSHA 10"],
  },
  "Packers": {
    level: "Entry level",
    responsibilities:
      "Pack outbound orders per the packing SOP, apply correct labels, and verify counts against the pick list before sealing each box.",
    instructions:
      "Report to packing line C. Cut-resistant gloves are provided.",
    attire: "uniform",
    certs: ["OSHA 10"],
  },
  "Forklift Operator": {
    level: "Experienced",
    responsibilities:
      "Operate a sit-down forklift to move pallets between dock and storage. Complete the daily pre-shift inspection and log fueling.",
    instructions:
      "Bring a copy of your forklift license. You'll be evaluated on site before driving.",
    attire: "safety-vest-hardhat",
    certs: ["Forklift Operator Certification", "OSHA 10"],
  },
  "Warehouse Associate": {
    level: "Entry level",
    responsibilities:
      "Receive incoming shipments, scan into the WMS, and stage product for putaway. Support cycle counts as assigned.",
    instructions:
      "Check in at the receiving office. Closed-toe boots required.",
    attire: "safety-vest",
    certs: ["OSHA 10"],
  },
  "Material Handler": {
    level: "Intermediate",
    responsibilities:
      "Move raw materials and WIP between staging areas and the production floor. Use hand jacks; report any damage to the lead.",
    instructions:
      "Check in with the material lead at the start of every shift.",
    attire: "safety-vest",
    certs: ["OSHA 10", "Pallet Jack Operation"],
  },
  "Quality Inspector": {
    level: "Experienced",
    responsibilities:
      "Conduct in-process and final inspections per the quality plan, record measurements in the QMS, and flag non-conformances to the QA lead.",
    instructions:
      "Pick up gauges and the day's inspection plan from the QA cage.",
    attire: "lab-coat",
    certs: ["ASQ CQI", "GMP Awareness"],
  },
  "Machine Operator": {
    level: "Intermediate",
    responsibilities:
      "Operate the assigned CNC / press machine per the work order, perform tool changes, and complete first-piece inspection.",
    instructions:
      "Sign in with the production lead at line entry. Hearing protection is mandatory and provided on site.",
    attire: "safety-vest-hardhat",
    certs: ["OSHA 10", "Machine Operation"],
  },
  "Line Managers": {
    level: "Lead / Supervisor",
    responsibilities:
      "Direct line staff for the shift, balance staffing across stations, run the start-of-shift huddle, and own shift handoff documentation.",
    instructions:
      "Pick up clipboards and radios from the supervisor office at dock A. Be 15 minutes early for handoff.",
    attire: "business-casual",
    certs: ["Lean Leadership", "OSHA 30"],
  },
  "Sorter": {
    level: "Entry level",
    responsibilities:
      "Sort inbound parcels by destination zone, scan exceptions, and place onto the correct outbound chute.",
    instructions:
      "Check in at the sort hub entrance. Hand scanners are issued at the line.",
    attire: "safety-vest",
    certs: [],
  },
  "Loader / Unloader": {
    level: "Entry level",
    responsibilities:
      "Load and unload trailers per the dock manifest. Confirm seal numbers and report any damage to the dock lead.",
    instructions:
      "Check in at the dock office. Back braces are available on request.",
    attire: "safety-vest-hardhat",
    certs: ["OSHA 10"],
  },
};

function getRoleDefaults(job) {
  if (!job) return null;
  return ROLE_DEFAULTS[job] || null;
}

// ---------- Simple multiline textarea (matches fld-control styling) ----

function Textarea({ value, placeholder, onChange, rows = 3 }) {
  return (
    <div className="fld-control fld-control--ta">
      <textarea
        className="fld-input fld-input--ta"
        rows={rows}
        value={value || ""}
        placeholder={placeholder}
        onChange={(e) => onChange && onChange(e.target.value)}
      />
    </div>
  );
}

// ---------- Certification search ----------------------------------------
// Suggested-for-role chips at the top, then a searchable list of all
// certs in the catalog. Selected items live in `value` (string[]).

function CertSearch({ job, value = [], onChange }) {
  const [q, setQ] = useStateRl("");
  const suggested = useMemoRl(() => {
    const d = getRoleDefaults(job);
    return d ? d.certs : [];
  }, [job]);

  const inSet = (c) => value.includes(c);
  const toggle = (c) => {
    if (inSet(c)) onChange && onChange(value.filter((v) => v !== c));
    else onChange && onChange([...value, c]);
  };
  const remove = (c) => onChange && onChange(value.filter((v) => v !== c));

  // Filtered results — when query is empty, show suggested + everything else
  // grouped; when query is non-empty, just show flat filtered list.
  const query = q.trim().toLowerCase();
  const filtered = useMemoRl(() => {
    if (!query) return [];
    return CERT_CATALOG.filter((c) => c.toLowerCase().includes(query));
  }, [query]);

  // Items that are NOT in suggested and NOT in value, for the "All" group
  const others = useMemoRl(
    () => CERT_CATALOG.filter((c) => !suggested.includes(c)),
    [suggested]
  );

  return (
    <div className="cert-search">
      {/* Selected chips */}
      {value.length > 0 && (
        <div className="cert-selected">
          {value.map((c) => (
            <span className="tag" key={c}>
              {c}
              <button type="button" className="tag-x" aria-label={`Remove ${c}`} onClick={() => remove(c)}>
                <Icon name="X" size={12} />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Search input */}
      <div className="fld-control fld-control--input cert-search-input">
        <Icon name="Search" size={16} />
        <input
          type="text"
          className="fld-input"
          value={q}
          placeholder={job ? `Search certifications for ${job}…` : "Search certifications…"}
          onChange={(e) => setQ(e.target.value)}
        />
        {q && (
          <button type="button" className="tag-x" aria-label="Clear search" onClick={() => setQ("")}>
            <Icon name="X" size={12} />
          </button>
        )}
      </div>

      {/* Results */}
      {query ? (
        <div className="cert-list">
          {filtered.length === 0 ? (
            <p className="cert-empty">No certifications match "{q}"</p>
          ) : (
            filtered.map((c) => (
              <CertRow key={c} cert={c} selected={inSet(c)} onToggle={() => toggle(c)} />
            ))
          )}
        </div>
      ) : (
        <React.Fragment>
          {suggested.length > 0 && (
            <div className="cert-group">
              <div className="cert-group-head">
                <span>Suggested for {job}</span>
                <button
                  type="button"
                  className="linkbtn"
                  onClick={() => onChange && onChange(Array.from(new Set([...value, ...suggested])))}
                >
                  Add all
                </button>
              </div>
              <div className="cert-list">
                {suggested.map((c) => (
                  <CertRow key={c} cert={c} selected={inSet(c)} onToggle={() => toggle(c)} suggested />
                ))}
              </div>
            </div>
          )}
          <div className="cert-group">
            <div className="cert-group-head">
              <span>{suggested.length > 0 ? "All certifications" : "Catalog"}</span>
            </div>
            <div className="cert-list cert-list--scroll">
              {others.map((c) => (
                <CertRow key={c} cert={c} selected={inSet(c)} onToggle={() => toggle(c)} />
              ))}
            </div>
          </div>
        </React.Fragment>
      )}
    </div>
  );
}

function CertRow({ cert, selected, onToggle, suggested }) {
  return (
    <button
      type="button"
      className={"cert-row" + (selected ? " cert-row--on" : "")}
      onClick={onToggle}
      aria-pressed={selected}
    >
      <span className={"ms-check" + (selected ? " ms-check--on" : "")} aria-hidden="true">
        {selected && <Icon name="Check" size={12} />}
      </span>
      <span className="cert-row-label">{cert}</span>
      {suggested && <span className="cert-row-suggested">Suggested</span>}
    </button>
  );
}

Object.assign(window, {
  ROLE_DEFAULTS,
  ATTIRE_TYPES,
  CERT_CATALOG,
  LEVEL_OPTIONS,
  getRoleDefaults,
  AttireMannequin,
  AttirePicker,
  CertSearch,
  Textarea,
});
