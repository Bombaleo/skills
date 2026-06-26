// =====================================================================
// Flex Work — Requisitions: shared primitives used across Create / Review
// / Details. SectionCard, Field, banner, supplier chip stack, etc.
// =====================================================================

const { useState: useStateRq, useMemo: useMemoRq, useEffect: useEffectRq, useRef: useRefRq } = React;

// Brand swatches mirror the Requisitions list. SW / TH / PH / SS / GS, plus
// the second-tier suppliers from the Suppliers list so chips never fall
// back to the StaffWise palette for an unrelated brand.
const REQ_SUPPLIERS = {
  sw: { label: "StaffWise",     short: "SW", bg: "#43BEEF", fg: "#062D3D" },
  th: { label: "Talent Hub",    short: "TH", bg: "#F9B571", fg: "#76420F" },
  ph: { label: "Pro Hire",      short: "PH", bg: "#EFC056", fg: "#6E4517" },
  ss: { label: "Skill Scouts",  short: "SS", bg: "#A476EA", fg: "#311254" },
  gs: { label: "GoodShift",     short: "GS", bg: "#87DED1", fg: "#07312B" },
  wf: { label: "WorkForce Now", short: "WF", bg: "#F08A8A", fg: "#5A1414" },
  rl: { label: "RoleLink",      short: "RL", bg: "#7CC8A8", fg: "#0B3826" },
  tm: { label: "TempMatch",     short: "TM", bg: "#9EAEFA", fg: "#1B2762" },
  sh: { label: "Shifty",        short: "SH", bg: "#F4A4D8", fg: "#5A1340" },
  qs: { label: "QuickStaff",    short: "QS", bg: "#C9B891", fg: "#42301A" },
  fp: { label: "FlexPool",      short: "FP", bg: "#82C0E0", fg: "#0B3045" },
  hr: { label: "Hireling",      short: "HR", bg: "#D6D2C8", fg: "#3D362A" },
  // AlphaTech Partners — used by Professional Work and SOW data
  // modules. Registered here so the supplier chip / row rendering
  // resolves the brand correctly instead of falling back to StaffWise.
  ap: { label: "AlphaTech Partners", short: "AP", bg: "#B6D4F5", fg: "#0E2A52" },
  // EOR providers — registered so the supplier chip resolves the
  // brand on Workforce / Timesheets / Invoices when the `eor`
  // supplier-type flag is on. EOR workers list their EOR provider in
  // the `supplier` field (the buyer never sees the local payroll
  // entity, only the EOR brand that bills back the loaded rate).
  evp: { label: "Velocity EOR",   short: "VE", bg: "#B9E4C9", fg: "#1F4E33" },
  gpe: { label: "GlobalPay EOR",  short: "GP", bg: "#FFD4B0", fg: "#5C2E0A" },
  bwk: { label: "BorderlessWork", short: "BW", bg: "#E8D4FA", fg: "#3E1568" },
  // Legacy keys kept so existing UI mocks (FlexForce / RapidStaff /
  // HirePoint) don't render the wrong brand.
  ff: { label: "FlexForce",     short: "FF", bg: "#FFB3A7", fg: "#5C1E14" },
  rs: { label: "RapidStaff",    short: "RS", bg: "#9CC8FA", fg: "#0D2A57" },
  hc: { label: "HirePoint",     short: "HP", bg: "#D4D0F0", fg: "#23163E" },
};

function ReqSupplierChip({ id, size = 28 }) {
  const s = REQ_SUPPLIERS[id] || REQ_SUPPLIERS.sw;
  return (
    <span
      className="sup-chip"
      style={{ width: size, height: size, fontSize: size <= 22 ? 9 : 11 }}
      aria-label={s.label}
    >
      {s.short}
    </span>
  );
}

function ReqSupplierStack({ ids }) {
  return (
    <span className="sup-stack" role="group" aria-label="Suppliers">
      {ids.map((id, i) => (
        <ReqSupplierChip key={id + i} id={id} size={22} />
      ))}
    </span>
  );
}

// ---------- SectionCard --------------------------------------------------
// A white-rounded card with a 48px icon avatar, title, optional subtitle,
// and an optional right-aligned action. Used everywhere on Create + Details.

function SectionCard({
  icon,
  iconShape = "rounded",
  iconColor = "primary", // "primary" | "soft"
  variant = "default",   // "default" | "compact" (acc-card-style header, no collapse)
  title,
  subtitle,
  action,
  children,
}) {
  if (variant === "compact") {
    return (
      <section className="sc sc--compact">
        <header className="sc-head sc-head--compact">
          <span className="acc-card-avatar" aria-hidden="true">
            {typeof icon === "string" ? <Icon name={icon} size={20} /> : icon}
          </span>
          <h2 className="acc-card-title">{title}</h2>
          {action && <div className="sc-head-action">{action}</div>}
        </header>
        <div className="sc-body">{children}</div>
      </section>
    );
  }
  const avatarCls =
    "sc-head-avatar" +
    (iconShape === "circle" ? " sc-head-avatar--circle" : "") +
    (iconColor === "soft" ? " sc-head-avatar--soft" : "");
  return (
    <section className="sc">
      <header className="sc-head">
        <span className={avatarCls} aria-hidden="true">
          {typeof icon === "string" ? <Icon name={icon} size={24} /> : icon}
        </span>
        <div className="sc-head-text">
          <h2 className="sc-head-title">{title}</h2>
          {subtitle && <p className="sc-head-sub">{subtitle}</p>}
        </div>
        {action && <div className="sc-head-action">{action}</div>}
      </header>
      <div className="sc-body">{children}</div>
    </section>
  );
}

// ---------- Form field (label + control) -------------------------------

function Field({ label, required, children, hint, style, action }) {
  return (
    <div className="fld" style={style}>
      <div className="fld-label-row">
        <label className="fld-label">
          {label}
          {required && <span className="fld-required" aria-hidden="true">*</span>}
        </label>
        {action && <span className="fld-label-action">{action}</span>}
      </div>
      {children}
      {hint && <small style={{ color: "var(--evr-content-primary-lowemp)" }}>{hint}</small>}
    </div>
  );
}

// A pseudo-input that holds chip tags and an empty placeholder slot.
function TagInput({ values = [], placeholder, onRemove, small = false }) {
  return (
    <div className={"fld-control" + (small ? " fld-control--sm" : "")}>
      {values.length === 0 ? (
        <span style={{ color: "var(--evr-content-primary-lowemp)" }}>{placeholder}</span>
      ) : (
        values.map((v, i) => (
          <span className="tag" key={v + i}>
            {v}
            <button
              type="button"
              className="tag-x"
              aria-label={`Remove ${v}`}
              onClick={() => onRemove && onRemove(v, i)}
            >
              <Icon name="X" size={12} />
            </button>
          </span>
        ))
      )}
      <span className="fld-trail"><Icon name="ChevronDown" size={18} /></span>
    </div>
  );
}

// Interactive multiselect: chip-display + dropdown of checkable options.
// Pass `options` (string[]) and either `value`+`onChange` for controlled use,
// or just `defaultValue` for uncontrolled.
function MultiSelect({ options = [], value, defaultValue = [], placeholder, onChange, small = false, searchable }) {
  const [internal, setInternal] = useStateRq(defaultValue);
  const selected = value !== undefined ? value : internal;
  const setSelected = (next) => {
    if (value === undefined) setInternal(next);
    onChange && onChange(next);
  };
  const [open, setOpen] = useStateRq(false);
  const [query, setQuery] = useStateRq("");
  const rootRef = useRefRq(null);
  const searchRef = useRefRq(null);

  // Auto-enable search when the list is long enough to scroll noticeably.
  const showSearch = searchable != null ? !!searchable : options.length >= 8;

  useEffectRq(() => {
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

  // Reset query each time the menu closes; focus search when it opens.
  useEffectRq(() => {
    if (!open) {
      setQuery("");
    } else if (showSearch) {
      const t = setTimeout(() => { try { searchRef.current && searchRef.current.focus(); } catch (e) {} }, 60);
      return () => clearTimeout(t);
    }
  }, [open, showSearch]);

  const toggle = (opt) => {
    if (selected.includes(opt)) setSelected(selected.filter((v) => v !== opt));
    else setSelected([...selected, opt]);
  };
  const remove = (opt) => setSelected(selected.filter((v) => v !== opt));

  const q = query.trim().toLowerCase();
  const filteredOptions = q
    ? options.filter((opt) => String(opt).toLowerCase().includes(q))
    : options;

  return (
    <div className="ms-root" ref={rootRef}>
      <div
        className={"fld-control ms-trigger" + (small ? " fld-control--sm" : "") + (open ? " ms-trigger--open" : "")}
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        tabIndex={0}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setOpen((o) => !o); }
        }}
      >
        {selected.length === 0 ? (
          <span style={{ color: "var(--evr-content-primary-lowemp)" }}>{placeholder}</span>
        ) : (
          selected.map((v) => (
            <span className="tag" key={v}>
              {v}
              <button
                type="button"
                className="tag-x"
                aria-label={`Remove ${v}`}
                onClick={(e) => { e.stopPropagation(); remove(v); }}
              >
                <Icon name="X" size={12} />
              </button>
            </span>
          ))
        )}
        <span className="fld-trail">
          <Icon name="ChevronDown" size={18} style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform 150ms cubic-bezier(0.4,0,0.2,1)" }} />
        </span>
      </div>
      {open && (
        <div className="ms-menu" role="listbox" aria-multiselectable="true">
          {showSearch && (
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
                aria-label="Search options"
              />
              {query && (
                <button
                  type="button"
                  className="ms-menu-search-clear"
                  onClick={(e) => { e.stopPropagation(); setQuery(""); searchRef.current && searchRef.current.focus(); }}
                  aria-label="Clear search"
                >
                  <Icon name="X" size={14} />
                </button>
              )}
            </div>
          )}
          {filteredOptions.length === 0 ? (
            <div className="ms-menu-empty">No matches</div>
          ) : filteredOptions.map((opt) => {
            const isSelected = selected.includes(opt);
            return (
              <button
                type="button"
                key={opt}
                role="option"
                aria-selected={isSelected}
                className={"ms-menu-item" + (isSelected ? " ms-menu-item--selected" : "")}
                onClick={() => toggle(opt)}
              >
                <span className={"ms-check" + (isSelected ? " ms-check--on" : "")} aria-hidden="true">
                  {isSelected && <Icon name="Check" size={12} />}
                </span>
                <span className="ms-menu-item-label">{opt}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Plain styled text/value input
function TextInput({ value, placeholder, onChange, trail, type = "text", style, small = false }) {
  return (
    <div className={"fld-control fld-control--input" + (small ? " fld-control--sm" : "")} style={style}>
      <input
        type={type}
        className="fld-input"
        value={value || ""}
        placeholder={placeholder}
        onChange={(e) => onChange && onChange(e.target.value)}
      />
      {trail && <span className="fld-trail">{trail}</span>}
    </div>
  );
}

// Single-select dropdown built on the same shell as MultiSelect.
// Click to open; selecting an option closes the menu.
function Dropdown({ options = [], value, defaultValue = "", placeholder, onChange, small = false, searchable }) {
  const [internal, setInternal] = useStateRq(defaultValue);
  const selected = value !== undefined ? value : internal;
  // Normalize options — accept either a string array OR an array of
  // { value, label } objects. The returned shape always has a .value
  // (the persisted key) and a .label (what shows in the trigger + menu).
  const optList = options.map((o) => (
    o && typeof o === "object" && "value" in o
      ? { value: o.value, label: o.label != null ? o.label : String(o.value) }
      : { value: o, label: o }
  ));
  const selectedOpt = optList.find((o) => o.value === selected);
  const selectedLabel = selectedOpt ? selectedOpt.label : (selected || "");
  const setSelected = (next) => {
    if (value === undefined) setInternal(next);
    onChange && onChange(next);
  };
  const [open, setOpen] = useStateRq(false);
  const [query, setQuery] = useStateRq("");
  const rootRef = useRefRq(null);
  const searchRef = useRefRq(null);

  const showSearch = searchable != null ? !!searchable : options.length >= 8;

  useEffectRq(() => {
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

  useEffectRq(() => {
    if (!open) {
      setQuery("");
    } else if (showSearch) {
      const t = setTimeout(() => { try { searchRef.current && searchRef.current.focus(); } catch (e) {} }, 60);
      return () => clearTimeout(t);
    }
  }, [open, showSearch]);

  const q = query.trim().toLowerCase();
  const filteredOptions = q
    ? optList.filter((o) => String(o.label).toLowerCase().includes(q))
    : optList;

  return (
    <div className="ms-root" ref={rootRef}>
      <div
        className={"fld-control ms-trigger" + (small ? " fld-control--sm" : "") + (open ? " ms-trigger--open" : "")}
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        tabIndex={0}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setOpen((o) => !o); }
        }}
      >
        <span className="dd-value" style={{ color: selected ? "var(--evr-content-primary-highemp)" : "var(--evr-content-primary-lowemp)" }}>
          {selectedLabel || placeholder}
        </span>
        <span className="fld-trail">
          <Icon name="ChevronDown" size={18} style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform 150ms cubic-bezier(0.4,0,0.2,1)" }} />
        </span>
      </div>
      {open && (
        <div className="ms-menu" role="listbox">
          {showSearch && (
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
                aria-label="Search options"
              />
              {query && (
                <button
                  type="button"
                  className="ms-menu-search-clear"
                  onClick={(e) => { e.stopPropagation(); setQuery(""); searchRef.current && searchRef.current.focus(); }}
                  aria-label="Clear search"
                >
                  <Icon name="X" size={14} />
                </button>
              )}
            </div>
          )}
          {filteredOptions.length === 0 ? (
            <div className="ms-menu-empty">No matches</div>
          ) : filteredOptions.map((opt) => {
            const isSelected = opt.value === selected;
            return (
              <button
                type="button"
                key={String(opt.value)}
                role="option"
                aria-selected={isSelected}
                className={"ms-menu-item" + (isSelected ? " ms-menu-item--selected" : "")}
                onClick={() => { setSelected(opt.value); setOpen(false); }}
              >
                <span className="ms-menu-item-label">{opt.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Read-only selectable (chevron only)
function SelectField({ value, placeholder, trail, small = false }) {
  return (
    <div className={"fld-control" + (small ? " fld-control--sm" : "")}>
      <span style={{ color: value ? "var(--evr-content-primary-highemp)" : "var(--evr-content-primary-lowemp)" }}>
        {value || placeholder}
      </span>
      <span className="fld-trail">{trail || <Icon name="ChevronDown" size={18} />}</span>
    </div>
  );
}

// ---------- Banner (informative / warning) ------------------------------

function Banner({ kind = "informative", title, children, action, onClose, inline = false }) {
  // Only one kind ships in the figma (informative) — keep tokenized for future.
  return (
    <div className={"banner" + (inline ? " banner--inline" : "")}>
      <span className="banner-icon" aria-hidden="true">
        <Icon name="Information" size={20} />
      </span>
      <div className="banner-body">
        {title && <h3 className="banner-title">{title}</h3>}
        {children && <p className="banner-text">{children}</p>}
        {action && !inline && (
          <button type="button" className="banner-action" onClick={action.onClick}>
            {action.label}
            <Icon name="LinkNewWindow" size={14} />
          </button>
        )}
        {action && inline && (
          <button type="button" className="linkbtn" onClick={action.onClick} style={{ marginLeft: "auto" }}>
            {action.label}
          </button>
        )}
      </div>
      {onClose && (
        <button type="button" className="banner-close" onClick={onClose} aria-label="Dismiss">
          <Icon name="X" size={16} />
        </button>
      )}
    </div>
  );
}

// ---------- Toggle / Switch --------------------------------------------

function Switch({ checked, onChange, ariaLabel }) {
  return (
    <button
      type="button"
      className="switch"
      role="switch"
      aria-checked={!!checked}
      aria-label={ariaLabel}
      onClick={() => onChange && onChange(!checked)}
    />
  );
}

// ---------- Map placeholder (used in Edit location + Details hero) -----

function MapBlock({ height = 280 }) {
  return (
    <div className="map-box" style={{ height }}>
      <span className="map-pin" aria-hidden="true">
        <svg width="32" height="40" viewBox="0 0 32 40" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M16 0C7.16 0 0 7.16 0 16C0 28 16 40 16 40C16 40 32 28 32 16C32 7.16 24.84 0 16 0Z" fill="#131316"/>
          <g transform="translate(8 8)" stroke="white" strokeWidth="1.5" fill="none">
            <rect x="2" y="5" width="12" height="9" rx="1"/>
            <path d="M5 5V3.5C5 2.67 5.67 2 6.5 2H9.5C10.33 2 11 2.67 11 3.5V5"/>
          </g>
        </svg>
      </span>
    </div>
  );
}

Object.assign(window, {
  REQ_SUPPLIERS,
  ReqSupplierChip,
  ReqSupplierStack,
  SectionCard,
  Field,
  TagInput,
  MultiSelect,
  Dropdown,
  TextInput,
  SelectField,
  Banner,
  Switch,
  MapBlock,
});
