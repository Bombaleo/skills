// =====================================================================
// Flex Work — Settings → Custom Fields
//
// v0.85 — Tenant-configurable custom fields on every first-class
// object (Requisition, Worker, Engagement, Timesheet, Invoice,
// Supplier, SOW, Project, Candidate, Location). Behind the
// `customFields` feature flag, off by default everywhere except Helios
// Power Generation.
//
// Design notes
//   · The left rail lists object types with a count of active fields
//     per type — same pattern the Workforce / Workflows pages use.
//   · The right pane shows the field catalog for the selected object
//     with filter chips for status, visibility, and field type.
//   · Each row is a "field card": label + key (mono) + type chip +
//     visibility + required indicator + last-updated + applies-to row
//     count.
//   · An inline drawer (cf-drawer) handles add + edit. Mocked behavior
//     — saving updates the local store via the customFields API and
//     fires `customfields:change`.
//
// Research context
//   The page intentionally borrows shape from the two market leaders:
//   SAP Fieldglass (Admin → Configuration → Custom Field — module +
//   entered-by + type + pick-list values + dependent fields + PII
//   flag + required-for-state) and Workday VNDLY (self-serve config
//   tied to job category / location / approval workflows). A compact
//   research strip up top makes the parity story explicit so any
//   admin landing here understands what they're looking at.
// =====================================================================

const { useState: useCF, useMemo: useCFMemo, useEffect: useCFEffect } = React;

// Convenience: re-render whenever the underlying store fires.
function useCustomFieldsList() {
  const [tick, setTick] = useCF(0);
  useCFEffect(() => {
    const evt = window.CUSTOM_FIELD_EVENT || "customfields:change";
    const h = () => setTick((t) => t + 1);
    window.addEventListener(evt, h);
    return () => window.removeEventListener(evt, h);
  }, []);
  return useCFMemo(() => (window.getCustomFields ? window.getCustomFields() : []), [tick]);
}

// ---------- Field type → chip styling ----------------------------------
function _typeMeta(typeId) {
  const t = (window.CUSTOM_FIELD_TYPES || []).find((x) => x.id === typeId);
  return t || { id: typeId, label: typeId, icon: "Edit" };
}
function _objectMeta(objectId) {
  const o = (window.CUSTOM_FIELD_OBJECTS || []).find((x) => x.id === objectId);
  return o || { id: objectId, label: objectId, icon: "File", hint: "" };
}
function _visibilityMeta(vId) {
  const v = (window.CUSTOM_FIELD_VISIBILITY || []).find((x) => x.id === vId);
  return v || { id: vId, label: vId, desc: "" };
}

// ---------- Help-center pointer (replaces the inline research strip) ---
// The Vndly + Fieldglass parity research now lives in the internal Help
// Center under Features → Custom fields. This thin link keeps the
// connection one click away from the surface that consumes the
// research, without taking page real estate from the configuration UI.
function ResearchPointer({ onGoTo }) {
  function open(e) {
    e.preventDefault();
    // Set the hash first so HelpCenterPage's mount-time parseHash() picks
    // up the target feature, then route through the host's onGoTo so the
    // app actually navigates to the Help Center surface.
    try { window.location.hash = "#features/custom-fields"; }
    catch (err) { /* no-op */ }
    if (onGoTo) {
      onGoTo({ page: "helpCenter" });
    }
  }
  return (
    <a
      className="cf-research-pointer"
      href="#features/custom-fields"
      onClick={open}
    >
      <span className="cf-research-pointer-icon" aria-hidden="true">
        <Icon name="Information" size={14} />
      </span>
      <span className="cf-research-pointer-body">
        <b>How Vndly and Fieldglass do this — and where Flex Work diverges.</b>
        <span> The full competitive brief, customer variations, and roadmap live in the internal Help Center under Features → Custom fields.</span>
      </span>
      <span className="cf-research-pointer-go" aria-hidden="true">
        <Icon name="ArrowRight" size={14} />
      </span>
    </a>
  );
}

// ---------- Object-type left rail --------------------------------------
function ObjectRail({ fields, currentId, onPick }) {
  const objects = window.CUSTOM_FIELD_OBJECTS || [];
  const counts = useCFMemo(() => {
    const out = {};
    for (const f of fields) {
      if (f.status === "inactive") continue;
      out[f.objectType] = (out[f.objectType] || 0) + 1;
    }
    return out;
  }, [fields]);

  return (
    <aside className="cf-rail" aria-label="Object type">
      <div className="cf-rail-head">
        <span className="cf-rail-eyebrow">Apply fields to</span>
      </div>
      <ul className="cf-rail-list" role="list">
        {objects.map((o) => {
          const n = counts[o.id] || 0;
          const active = o.id === currentId;
          return (
            <li key={o.id}>
              <button
                type="button"
                className={"cf-rail-item" + (active ? " cf-rail-item--active" : "")}
                onClick={() => onPick(o.id)}
                aria-current={active ? "page" : undefined}
              >
                <span className="cf-rail-item-icon" aria-hidden="true">
                  <Icon name={o.icon} size={18} />
                </span>
                <span className="cf-rail-item-label">{o.label}</span>
                <span className={"cf-rail-item-count" + (n === 0 ? " cf-rail-item-count--zero" : "")}>{n}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}

// ---------- Field-card chips -------------------------------------------
function VisibilityChip({ scope }) {
  const meta = _visibilityMeta(scope);
  const cls = {
    "internal":        "cf-vis--internal",
    "buyer":           "cf-vis--buyer",
    "buyer+supplier":  "cf-vis--bs",
    "buyer+worker":    "cf-vis--bw",
    "everyone":        "cf-vis--all",
  }[scope] || "cf-vis--buyer";
  return (
    <span className={"cf-vis " + cls} title={meta.desc}>
      <Icon name="View" size={11} />
      <span>{meta.label}</span>
    </span>
  );
}

function TypeChip({ typeId }) {
  const meta = _typeMeta(typeId);
  return (
    <span className="cf-type" title={`Field type: ${meta.label}`}>
      <Icon name={meta.icon} size={11} />
      <span>{meta.label}</span>
    </span>
  );
}

function RequiredPip({ field }) {
  if (!field.required) return null;
  const reqFor = (field.requiredFor && field.requiredFor.length)
    ? field.requiredFor.join(" + ")
    : "create";
  return (
    <span className="cf-req" title={`Required for ${reqFor}`}>
      <span className="cf-req-dot" aria-hidden="true">●</span>
      <span>Required {field.requiredFor && field.requiredFor.length ? `· ${reqFor}` : ""}</span>
    </span>
  );
}

function SyncChip({ syncTo }) {
  if (!syncTo) return null;
  const label = syncTo === "dayforce" ? "Syncs to Dayforce"
              : syncTo === "sap-erp"  ? "Syncs to SAP ERP"
              : `Syncs to ${syncTo}`;
  return (
    <span className="cf-sync" title={label}>
      <Icon name="Broadcast" size={11} />
      <span>{label}</span>
    </span>
  );
}

// ---------- Single field card ------------------------------------------
function FieldCard({ field, onEdit, onDuplicate, onArchive }) {
  const [open, setOpen] = useCF(false);
  return (
    <li className={"cf-card" + (field.status === "inactive" ? " cf-card--inactive" : "")}>
      <header className="cf-card-head">
        <div className="cf-card-headline">
          <button
            type="button"
            className="cf-card-disclosure"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-label={open ? "Collapse details" : "Expand details"}
          >
            <Icon name={open ? "ChevronDown" : "ChevronRight"} size={14} />
          </button>
          <div className="cf-card-title-wrap">
            <h4 className="cf-card-title">
              {field.label}
              {field.piiFlag && (
                <span className="cf-pii" title="Marked as PII — extra access controls apply">
                  <Icon name="Lock" size={10} />
                  <span>PII</span>
                </span>
              )}
            </h4>
            <code className="cf-card-key">{field.key}</code>
          </div>
        </div>
        <div className="cf-card-actions">
          <button type="button" className="cf-iconbtn" onClick={() => onEdit(field)} title="Edit field">
            <Icon name="Edit" size={14} />
          </button>
          <button type="button" className="cf-iconbtn" onClick={() => onDuplicate(field)} title="Duplicate field">
            <Icon name="Copy" size={14} />
          </button>
          <button type="button" className="cf-iconbtn cf-iconbtn--danger" onClick={() => onArchive(field)} title={field.status === "inactive" ? "Restore field" : "Archive field"}>
            <Icon name={field.status === "inactive" ? "Refresh" : "TrashCan"} size={14} />
          </button>
        </div>
      </header>

      <div className="cf-card-meta">
        <TypeChip typeId={field.type} />
        <VisibilityChip scope={field.visibility} />
        <RequiredPip field={field} />
        <SyncChip syncTo={field.syncTo} />
        {field.section && (
          <span className="cf-section" title="Form section">
            <Icon name="PanelRight" size={11} />
            <span>{field.section}</span>
          </span>
        )}
        {field.conditional && (
          <span className="cf-cond" title="Conditional visibility">
            <Icon name="Filter" size={11} />
            <span>when {field.conditional.field} {field.conditional.op} {Array.isArray(field.conditional.value) ? field.conditional.value.join(" / ") : String(field.conditional.value)}</span>
          </span>
        )}
        {field.status === "inactive" && (
          <span className="cf-inactive">Inactive</span>
        )}
      </div>

      {field.help && <p className="cf-card-help">{field.help}</p>}

      {open && (
        <div className="cf-card-deep">
          <dl className="cf-card-defs">
            {field.options && field.type !== "cascade" && (
              <div>
                <dt>Pick-list values</dt>
                <dd>
                  <span className="cf-opt-row">
                    {field.options.map((o, i) => (
                      <span key={i} className="cf-opt-chip">{o}</span>
                    ))}
                  </span>
                </dd>
              </div>
            )}
            {field.options && field.type === "cascade" && (
              <div>
                <dt>Cascade tree</dt>
                <dd>
                  <ul className="cf-cascade-tree">
                    {field.options.map((o, i) => (
                      <li key={i}>
                        <b>{o.label}</b>
                        {o.children && o.children.length > 0 && (
                          <span className="cf-cascade-children">
                            {o.children.map((c, j) => <span key={j}>{c}</span>)}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                </dd>
              </div>
            )}
            {field.validation && field.validation.pattern && (
              <div>
                <dt>Pattern</dt>
                <dd>
                  <code>{field.validation.patternHint || field.validation.pattern}</code>
                </dd>
              </div>
            )}
            {field.defaultValueFrom && (
              <div>
                <dt>Default from</dt>
                <dd><code>{field.defaultValueFrom}</code></dd>
              </div>
            )}
            {field.usage && field.usage.length > 0 && (
              <div>
                <dt>Used in</dt>
                <dd>
                  <span className="cf-opt-row">
                    {field.usage.map((u, i) => (
                      <span key={i} className="cf-usage-chip">{u}</span>
                    ))}
                  </span>
                </dd>
              </div>
            )}
            <div>
              <dt>Applies to</dt>
              <dd>{field.applies ? `${field.applies.toLocaleString()} ${_objectMeta(field.objectType).label.toLowerCase()} records` : "No records yet"}</dd>
            </div>
            <div>
              <dt>Last updated</dt>
              <dd>{field.updatedAt} · {field.updatedBy || "—"}</dd>
            </div>
          </dl>
        </div>
      )}
    </li>
  );
}

// ---------- Drawer (add / edit field) ----------------------------------
function FieldDrawer({ field, objectType, onClose, onSave }) {
  // `field` is null when adding; existing record when editing.
  const isEdit = !!(field && field.id);
  const [state, setState] = useCF(() => {
    if (isEdit) return Object.assign({}, field);
    return {
      objectType: objectType,
      label: "",
      key: "",
      type: "text",
      section: "Overview",
      required: false,
      requiredFor: [],
      visibility: "buyer",
      help: "",
      options: [],
      piiFlag: false,
      syncTo: null,
      status: "active",
      usage: [],
    };
  });
  const [optDraft, setOptDraft] = useCF("");
  const [usageDraft, setUsageDraft] = useCF("");

  function setField(patch) {
    setState((s) => Object.assign({}, s, patch));
  }
  function autoKey(label) {
    return label
      .replace(/[^a-zA-Z0-9 ]/g, "")
      .trim()
      .split(/\s+/)
      .map((w, i) => i === 0 ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join("");
  }

  const objectMeta = _objectMeta(state.objectType);
  const types = window.CUSTOM_FIELD_TYPES || [];
  const visibilities = window.CUSTOM_FIELD_VISIBILITY || [];
  const hasOptions = ["dropdown", "multiselect"].includes(state.type);

  function save() {
    if (!state.label.trim()) {
      if (window.showToast) window.showToast("Field label is required", { kind: "error" });
      return;
    }
    if (!state.key.trim()) {
      setField({ key: autoKey(state.label) });
    }
    onSave(Object.assign({}, state, { key: state.key || autoKey(state.label) }));
  }

  return (
    <React.Fragment>
      <div className="cf-drawer-scrim" onClick={onClose} aria-hidden="true" />
      <aside className="cf-drawer" role="dialog" aria-modal="true" aria-label={isEdit ? `Edit ${state.label}` : "Add custom field"}>
        <header className="cf-drawer-head">
          <div>
            <div className="cf-drawer-eyebrow">{objectMeta.label} · {isEdit ? "Edit field" : "Add field"}</div>
            <h3 className="cf-drawer-title">{isEdit ? state.label || "Field" : "New custom field"}</h3>
          </div>
          <button type="button" className="cf-iconbtn" onClick={onClose} aria-label="Close drawer">
            <Icon name="X" size={16} />
          </button>
        </header>

        <div className="cf-drawer-body">
          <fieldset className="cf-fset">
            <legend>Basics</legend>
            <label className="cf-input">
              <span className="cf-input-label">Display label</span>
              <input
                type="text"
                value={state.label}
                onChange={(e) => setField({
                  label: e.target.value,
                  key: !isEdit && (!state.key || state.key === autoKey(state.label)) ? autoKey(e.target.value) : state.key,
                })}
                placeholder="e.g. Outage window"
              />
            </label>
            <label className="cf-input">
              <span className="cf-input-label">API key</span>
              <input
                type="text"
                value={state.key}
                onChange={(e) => setField({ key: e.target.value.replace(/[^a-zA-Z0-9_]/g, "") })}
                placeholder="outageWindow"
              />
              <span className="cf-input-help">camelCase. Used in the API, reports, and integrations. Cannot be changed after first record exists.</span>
            </label>
            <label className="cf-input">
              <span className="cf-input-label">Helper text</span>
              <textarea
                rows={2}
                value={state.help || ""}
                onChange={(e) => setField({ help: e.target.value })}
                placeholder="What this field is for, plus any rules — one or two sentences."
              />
            </label>
          </fieldset>

          <fieldset className="cf-fset">
            <legend>Type</legend>
            <div className="cf-type-grid" role="radiogroup" aria-label="Field type">
              {types.map((t) => (
                <button
                  type="button"
                  key={t.id}
                  role="radio"
                  aria-checked={state.type === t.id}
                  className={"cf-type-opt" + (state.type === t.id ? " cf-type-opt--on" : "")}
                  onClick={() => setField({ type: t.id, options: hasOptions ? state.options : [] })}
                >
                  <Icon name={t.icon} size={14} />
                  <span>{t.label}</span>
                </button>
              ))}
            </div>

            {hasOptions && (
              <div className="cf-input">
                <span className="cf-input-label">Pick-list values</span>
                <div className="cf-opt-builder">
                  {state.options.map((o, i) => (
                    <span key={i} className="cf-opt-chip cf-opt-chip--editable">
                      <span>{o}</span>
                      <button
                        type="button"
                        aria-label={`Remove ${o}`}
                        onClick={() => setField({ options: state.options.filter((_, j) => j !== i) })}
                      >
                        <Icon name="X" size={10} />
                      </button>
                    </span>
                  ))}
                  <input
                    type="text"
                    value={optDraft}
                    onChange={(e) => setOptDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && optDraft.trim()) {
                        e.preventDefault();
                        setField({ options: [...state.options, optDraft.trim()] });
                        setOptDraft("");
                      }
                    }}
                    placeholder={state.options.length ? "Add another…" : "Type a value, then press Enter"}
                  />
                </div>
              </div>
            )}
          </fieldset>

          <fieldset className="cf-fset">
            <legend>Behavior</legend>
            <label className="cf-input">
              <span className="cf-input-label">Section</span>
              <select value={state.section || "Overview"} onChange={(e) => setField({ section: e.target.value })}>
                <option>Overview</option>
                <option>Scheduling</option>
                <option>Compensation</option>
                <option>Compliance</option>
                <option>Finance</option>
                <option>Allocation</option>
              </select>
              <span className="cf-input-help">Which detail-page accordion the field renders inside.</span>
            </label>

            <div className="cf-row-2">
              <label className="cf-toggle">
                <input
                  type="checkbox"
                  checked={!!state.required}
                  onChange={(e) => setField({ required: e.target.checked, requiredFor: e.target.checked && state.requiredFor.length === 0 ? ["create"] : state.requiredFor })}
                />
                <span>Required</span>
              </label>
              <label className="cf-toggle">
                <input
                  type="checkbox"
                  checked={!!state.piiFlag}
                  onChange={(e) => setField({ piiFlag: e.target.checked })}
                />
                <span>Personally Identifiable Information (PII)</span>
              </label>
            </div>

            {state.required && (
              <div className="cf-input">
                <span className="cf-input-label">Required for</span>
                <div className="cf-chip-pick" role="group" aria-label="Required for state">
                  {["create", "submit", "activate", "approve"].map((s) => {
                    const on = (state.requiredFor || []).includes(s);
                    return (
                      <button
                        type="button"
                        key={s}
                        className={"cf-chip-opt" + (on ? " cf-chip-opt--on" : "")}
                        onClick={() => {
                          const cur = state.requiredFor || [];
                          setField({
                            requiredFor: on ? cur.filter((x) => x !== s) : [...cur, s],
                          });
                        }}
                      >
                        {s}
                      </button>
                    );
                  })}
                </div>
                <span className="cf-input-help">Match Fieldglass's per-state requirement model — different transitions can demand different fields.</span>
              </div>
            )}
          </fieldset>

          <fieldset className="cf-fset">
            <legend>Access &amp; sync</legend>
            <label className="cf-input">
              <span className="cf-input-label">Visibility</span>
              <select value={state.visibility} onChange={(e) => setField({ visibility: e.target.value })}>
                {visibilities.map((v) => (
                  <option key={v.id} value={v.id}>{v.label}</option>
                ))}
              </select>
              <span className="cf-input-help">{_visibilityMeta(state.visibility).desc}</span>
            </label>

            <label className="cf-input">
              <span className="cf-input-label">Sync target</span>
              <select value={state.syncTo || ""} onChange={(e) => setField({ syncTo: e.target.value || null })}>
                <option value="">Flex Work only</option>
                <option value="dayforce">Dayforce Core</option>
                <option value="sap-erp">SAP ERP (A/P)</option>
              </select>
              <span className="cf-input-help">Where to write the value on save. Dayforce sync uses the standard employee / position bridge.</span>
            </label>
          </fieldset>

          <fieldset className="cf-fset">
            <legend>Used in</legend>
            <div className="cf-opt-builder">
              {(state.usage || []).map((u, i) => (
                <span key={i} className="cf-usage-chip cf-opt-chip--editable">
                  <span>{u}</span>
                  <button
                    type="button"
                    aria-label={`Remove ${u}`}
                    onClick={() => setField({ usage: state.usage.filter((_, j) => j !== i) })}
                  >
                    <Icon name="X" size={10} />
                  </button>
                </span>
              ))}
              <input
                type="text"
                value={usageDraft}
                onChange={(e) => setUsageDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && usageDraft.trim()) {
                    e.preventDefault();
                    setField({ usage: [...(state.usage || []), usageDraft.trim()] });
                    setUsageDraft("");
                  }
                }}
                placeholder="Reports · Approval routing · Worker matching · Integrations"
              />
            </div>
            <span className="cf-input-help">Tags showing what consumes this field. Surface metadata only — actual wiring lives in the consuming page.</span>
          </fieldset>
        </div>

        <footer className="cf-drawer-foot">
          <button type="button" className="cf-btn cf-btn--ghost" onClick={onClose}>Cancel</button>
          <button type="button" className="cf-btn cf-btn--primary" onClick={save}>
            {isEdit ? "Save changes" : "Add field"}
          </button>
        </footer>
      </aside>
    </React.Fragment>
  );
}

// ---------- Off-state for orgs without the flag ------------------------
function CustomFieldsOff({ onEnable }) {
  return (
    <div className="set-content">
      <header className="set-content-header">
        <h2 className="set-content-title">Custom fields</h2>
        <p className="set-content-sub">
          Tenant-configurable fields on every first-class object in the platform — Requisitions, Workers, Engagements, Timesheets, Invoices, Suppliers, SOWs, Projects, Candidates, and Locations.
        </p>
      </header>

      <section className="cf-off">
        <div className="cf-off-icon" aria-hidden="true">
          <Icon name="Shapes" size={28} />
        </div>
        <h3>The Custom fields feature is off for this tenant.</h3>
        <p>
          Turn it on to extend any object with fields specific to your program — outage windows, certifications, capital project codes, anything not in the standard schema. Helios Power Generation already runs with this on; every other tenant ships off so the surface stays clean by default.
        </p>
        <div className="cf-off-actions">
          <button type="button" className="cf-btn cf-btn--primary" onClick={onEnable}>
            Turn on for this tenant
          </button>
          <a
            className="cf-btn cf-btn--ghost"
            href="#"
            onClick={(e) => { e.preventDefault(); if (window.location) window.location.hash = ""; }}
          >
            Read the spec
          </a>
        </div>
        <ul className="cf-off-bullets">
          <li><Icon name="Check" size={12} /> Ten object types — same set Fieldglass calls "modules".</li>
          <li><Icon name="Check" size={12} /> Thirteen field types — text, currency, date, pick list, cascade, cost code, person reference.</li>
          <li><Icon name="Check" size={12} /> Required-for-state, conditional visibility, PII flag, sync target.</li>
        </ul>
      </section>
    </div>
  );
}

// ---------- Page -------------------------------------------------------
function CustomFieldsPage({ onGoTo }) {
  const flagOn = window.useFeatureFlag ? window.useFeatureFlag("customFields") : false;
  const orgName = (window.getIndustry && window.getIndustry().name) || "this tenant";
  const orgId   = (window.getCurrentIndustryId && window.getCurrentIndustryId()) || "manufacturing";

  const fields = useCustomFieldsList();

  const [object, setObject] = useCF("requisition");
  const [query, setQuery] = useCF("");
  const [showInactive, setShowInactive] = useCF(false);
  const [typeFilter, setTypeFilter] = useCF("all");
  const [scopeFilter, setScopeFilter] = useCF("all");
  const [requiredFilter, setRequiredFilter] = useCF("all");

  const [drawer, setDrawer] = useCF(null); // null | { mode, field?, objectType }

  if (!flagOn) {
    return <CustomFieldsOff onEnable={() => {
      if (window.setFeatureFlag) window.setFeatureFlag("customFields", true);
      if (window.showToast) window.showToast(`Custom fields enabled for ${orgName}`, { kind: "success" });
    }} />;
  }

  // Filter
  const filtered = useCFMemo(() => {
    return fields
      .filter((f) => f.objectType === object)
      .filter((f) => showInactive ? true : f.status !== "inactive")
      .filter((f) => {
        if (typeFilter === "all") return true;
        return f.type === typeFilter;
      })
      .filter((f) => {
        if (scopeFilter === "all") return true;
        return f.visibility === scopeFilter;
      })
      .filter((f) => {
        if (requiredFilter === "all") return true;
        if (requiredFilter === "required") return !!f.required;
        if (requiredFilter === "optional") return !f.required;
        return true;
      })
      .filter((f) => {
        if (!query.trim()) return true;
        const q = query.trim().toLowerCase();
        return (
          f.label.toLowerCase().includes(q) ||
          (f.key || "").toLowerCase().includes(q) ||
          (f.help || "").toLowerCase().includes(q)
        );
      });
  }, [fields, object, showInactive, typeFilter, scopeFilter, requiredFilter, query]);

  const objectMeta = _objectMeta(object);
  const allCount = fields.filter((f) => f.objectType === object && f.status !== "inactive").length;
  const reqCount = fields.filter((f) => f.objectType === object && f.required && f.status !== "inactive").length;
  const piiCount = fields.filter((f) => f.objectType === object && f.piiFlag && f.status !== "inactive").length;

  function handleEdit(field) {
    setDrawer({ mode: "edit", field, objectType: field.objectType });
  }
  function handleDuplicate(field) {
    const dup = Object.assign({}, field, {
      label: `${field.label} (copy)`,
      key:   `${field.key}Copy`,
    });
    delete dup.id;
    setDrawer({ mode: "add", field: dup, objectType: field.objectType });
  }
  function handleArchive(field) {
    const next = field.status === "inactive" ? "active" : "inactive";
    window.updateCustomField(field.id, { status: next });
    if (window.showToast) window.showToast(`${field.label} ${next === "inactive" ? "archived" : "restored"}`);
  }
  function handleAdd() {
    setDrawer({ mode: "add", field: null, objectType: object });
  }
  function handleDrawerSave(record) {
    if (drawer.mode === "edit" && drawer.field && drawer.field.id) {
      window.updateCustomField(drawer.field.id, record);
      if (window.showToast) window.showToast(`${record.label} saved`, { kind: "success" });
    } else {
      window.addCustomField(record);
      if (window.showToast) window.showToast(`${record.label} added to ${_objectMeta(record.objectType).label}`, { kind: "success" });
    }
    setDrawer(null);
  }

  return (
    <div className="set-content cf-set-content">
      <header className="set-content-header">
        <div className="cf-header-row">
          <div>
            <h2 className="set-content-title">Custom fields</h2>
            <p className="set-content-sub">
              Extend any object in {orgName} with fields specific to your program. Custom fields surface on detail pages, list filters, reports, and integrations.
            </p>
          </div>
          <div className="cf-header-actions">
            <button type="button" className="cf-btn cf-btn--primary" onClick={handleAdd}>
              <Icon name="AddCircle" size={14} /> Add field
            </button>
          </div>
        </div>
      </header>

      <ResearchPointer onGoTo={onGoTo} />

      <div className="cf-shell">
        <ObjectRail fields={fields} currentId={object} onPick={setObject} />

        <section className="cf-main" aria-label={`${objectMeta.label} custom fields`}>
          <div className="cf-main-head">
            <div className="cf-main-headline">
              <span className="cf-main-icon" aria-hidden="true">
                <Icon name={objectMeta.icon} size={20} />
              </span>
              <div>
                <h3 className="cf-main-title">{objectMeta.label} fields</h3>
                <p className="cf-main-hint">{objectMeta.hint}</p>
              </div>
            </div>
            <div className="cf-main-stats">
              <div><b>{allCount}</b><span>Active</span></div>
              <div><b>{reqCount}</b><span>Required</span></div>
              <div><b>{piiCount}</b><span>PII</span></div>
            </div>
          </div>

          <div className="cf-toolbar">
            <label className="cf-search">
              <Icon name="Search" size={14} />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Filter by label, key, or helper text…"
                aria-label="Filter fields"
              />
            </label>
            <select className="cf-filter" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} aria-label="Filter by type">
              <option value="all">All types</option>
              {(window.CUSTOM_FIELD_TYPES || []).map((t) => (
                <option key={t.id} value={t.id}>{t.label}</option>
              ))}
            </select>
            <select className="cf-filter" value={scopeFilter} onChange={(e) => setScopeFilter(e.target.value)} aria-label="Filter by visibility">
              <option value="all">All visibilities</option>
              {(window.CUSTOM_FIELD_VISIBILITY || []).map((v) => (
                <option key={v.id} value={v.id}>{v.label}</option>
              ))}
            </select>
            <select className="cf-filter" value={requiredFilter} onChange={(e) => setRequiredFilter(e.target.value)} aria-label="Filter by required">
              <option value="all">Required + optional</option>
              <option value="required">Required only</option>
              <option value="optional">Optional only</option>
            </select>
            <label className="cf-toggle cf-toggle--inline">
              <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />
              <span>Show archived</span>
            </label>
          </div>

          {filtered.length === 0 ? (
            <div className="cf-empty">
              <Icon name="Shapes" size={28} />
              <h4>No {objectMeta.label.toLowerCase()} custom fields {fields.filter((f) => f.objectType === object).length > 0 ? "match your filters" : "yet"}</h4>
              <p>
                {fields.filter((f) => f.objectType === object).length > 0
                  ? "Clear a filter or change the search."
                  : `Add the first ${objectMeta.label.toLowerCase()} field to capture data the standard schema doesn't cover.`}
              </p>
              <button type="button" className="cf-btn cf-btn--primary" onClick={handleAdd}>
                <Icon name="AddCircle" size={14} /> Add field
              </button>
            </div>
          ) : (
            <ul className="cf-grid" role="list">
              {filtered.map((f) => (
                <FieldCard
                  key={f.id}
                  field={f}
                  onEdit={handleEdit}
                  onDuplicate={handleDuplicate}
                  onArchive={handleArchive}
                />
              ))}
            </ul>
          )}
        </section>
      </div>

      {drawer && (
        <FieldDrawer
          field={drawer.field}
          objectType={drawer.objectType}
          onClose={() => setDrawer(null)}
          onSave={handleDrawerSave}
        />
      )}
    </div>
  );
}

Object.assign(window, { CustomFieldsPage });
