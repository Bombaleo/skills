// =====================================================================
// Flex Work — Requisition templates
//   · Tenant-wide store of named requisition presets. A template carries
//     enough state to prefill the New Order flow: setup locations + cost
//     centers, bookings (job × qty × locations), and schedules
//     (dates / times / which bookings apply).
//
//   · Used in two surfaces:
//       1. New Requisition page — TemplatePicker at the top of the form
//          lets the user pick a template; applying one mass-prefills the
//          draft. A "Save as template" button in the header header
//          captures whatever the user has entered into a new template.
//       2. Settings → Requisition templates — the management surface
//          where admins build / edit / archive the templates everyone
//          else picks from.
// =====================================================================

const { useState: useTplState, useEffect: useTplEffect, useMemo: useTplMemo } = React;

// ---------- Store ------------------------------------------------------
// Templates live on window.__reqTemplates so they survive nav between the
// New Requisition page and the Settings tab. Seeded once on first read.

const _TPL_SEED = [
  {
    id: "tpl_weekly_production",
    name: "Weekly production line crew",
    description: "Recurring Mon – Fri production line booking across the manufacturing sites. The shape we run every week — drop in dates and order.",
    icon: "Briefcase",
    tags: ["Recurring", "Multi-site"],
    locations: ["Manufacturing A", "Manufacturing B"],
    costCenters: ["Site 01", "Site 02"],
    bookings: [
      { id: 1, quantity: 8, job: "Production Line Associate", locations: ["Manufacturing A", "Manufacturing B"] },
      { id: 2, quantity: 4, job: "Packers",                   locations: ["Manufacturing A"] },
    ],
    schedules: [
      { id: 1, dates: "May 18 – May 22", start: "6:00 AM", end: "3:00 PM", bookings: ["Work assignment 1", "Work assignment 2"] },
    ],
    createdBy: "Amy Chen",
    createdAt: "Mar 14, 2026",
    lastUsedAt: "2 days ago",
    timesUsed: 26,
    builtIn: true,
  },
  {
    id: "tpl_warehouse_surge",
    name: "Warehouse surge — pickers",
    description: "Single-day high-volume picker order. Use this when an inbound trailer needs the floor blitzed in one shift.",
    icon: "Stack",
    tags: ["Single day", "Surge"],
    locations: ["Distribution Center 1", "Distribution Center 2"],
    costCenters: ["Site 05"],
    bookings: [
      { id: 1, quantity: 12, job: "Pickers", locations: ["Distribution Center 1", "Distribution Center 2"] },
      { id: 2, quantity: 4,  job: "Loader / Unloader", locations: ["Distribution Center 1"] },
    ],
    schedules: [
      { id: 1, dates: "May 22", start: "8:00 AM", end: "5:00 PM", bookings: ["Work assignment 1", "Work assignment 2"] },
    ],
    createdBy: "Marcus Lee",
    createdAt: "Feb 02, 2026",
    lastUsedAt: "5 days ago",
    timesUsed: 14,
    builtIn: true,
  },
  {
    id: "tpl_overnight_forklift",
    name: "Overnight forklift coverage",
    description: "Weekend overnight forklift operators for inbound staging. Two-day pattern with the same crew across both nights.",
    icon: "Hourglass",
    tags: ["Overnight", "Weekend"],
    locations: ["Manufacturing C", "Manufacturing D"],
    costCenters: ["Site 03", "Site 04"],
    bookings: [
      { id: 1, quantity: 4, job: "Forklift Operator", locations: ["Manufacturing C", "Manufacturing D"] },
    ],
    schedules: [
      { id: 1, dates: "May 23 – May 24", start: "11:00 PM", end: "7:00 AM", bookings: ["Work assignment 1"] },
    ],
    createdBy: "Amy Chen",
    createdAt: "Apr 09, 2026",
    lastUsedAt: "Yesterday",
    timesUsed: 9,
    builtIn: false,
  },
  {
    id: "tpl_quality_sweep",
    name: "Quality inspection sweep",
    description: "Small-team quality inspection across all manufacturing sites. Half-day rotation, runs the second week of every month.",
    icon: "ClipboardPerson",
    tags: ["Half-day", "Compliance"],
    locations: ["Manufacturing A", "Manufacturing B", "Manufacturing C"],
    costCenters: ["Site 01"],
    bookings: [
      { id: 1, quantity: 2, job: "Quality Inspector", locations: ["Manufacturing A", "Manufacturing B", "Manufacturing C"] },
    ],
    schedules: [
      { id: 1, dates: "May 12", start: "9:00 AM", end: "1:00 PM", bookings: ["Work assignment 1"] },
    ],
    createdBy: "Priya Patel",
    createdAt: "Jan 27, 2026",
    lastUsedAt: "12 days ago",
    timesUsed: 7,
    builtIn: false,
  },
  {
    id: "tpl_loader_swing",
    name: "Loader / unloader swing shift",
    description: "Mid-afternoon to evening loaders for the back dock. Used most weeks when truck volume picks up.",
    icon: "TimeAdd",
    tags: ["Swing", "Recurring"],
    locations: ["Distribution Center 1"],
    costCenters: ["Site 05"],
    bookings: [
      { id: 1, quantity: 6, job: "Loader / Unloader", locations: ["Distribution Center 1"] },
    ],
    schedules: [
      { id: 1, dates: "May 19 – May 23", start: "2:00 PM", end: "10:00 PM", bookings: ["Work assignment 1"] },
    ],
    createdBy: "Marcus Lee",
    createdAt: "Mar 30, 2026",
    lastUsedAt: "Never",
    timesUsed: 0,
    builtIn: false,
  },
];

function tpl_ensureStore() {
  if (!window.__reqTemplates) {
    // Deep clone the seed so edits in the UI don't mutate the seed list.
    window.__reqTemplates = JSON.parse(JSON.stringify(_TPL_SEED));
  }
  return window.__reqTemplates;
}

function getReqTemplates() {
  return tpl_ensureStore();
}

function getReqTemplate(id) {
  return tpl_ensureStore().find((t) => t.id === id) || null;
}

function saveReqTemplate(template) {
  const store = tpl_ensureStore();
  const idx = store.findIndex((t) => t.id === template.id);
  if (idx >= 0) store[idx] = template;
  else store.unshift(template);
  // Bump a counter so React-state-using subscribers know to rerender.
  window.__reqTemplatesV = (window.__reqTemplatesV || 0) + 1;
  window.dispatchEvent(new CustomEvent("flexReqTemplatesChanged"));
  return template;
}

function deleteReqTemplate(id) {
  const store = tpl_ensureStore();
  const idx = store.findIndex((t) => t.id === id);
  if (idx >= 0) store.splice(idx, 1);
  window.__reqTemplatesV = (window.__reqTemplatesV || 0) + 1;
  window.dispatchEvent(new CustomEvent("flexReqTemplatesChanged"));
}

function duplicateReqTemplate(id) {
  const t = getReqTemplate(id);
  if (!t) return null;
  const copy = JSON.parse(JSON.stringify(t));
  copy.id = "tpl_" + Math.random().toString(36).slice(2, 10);
  copy.name = t.name + " (copy)";
  copy.builtIn = false;
  copy.lastUsedAt = "Never";
  copy.timesUsed = 0;
  copy.createdBy = "You";
  copy.createdAt = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  saveReqTemplate(copy);
  return copy;
}

// ---------- Hook: subscribe a component to the store -------------------
function useReqTemplates() {
  const [, force] = useTplState(0);
  useTplEffect(() => {
    const fn = () => force((n) => n + 1);
    window.addEventListener("flexReqTemplatesChanged", fn);
    return () => window.removeEventListener("flexReqTemplatesChanged", fn);
  }, []);
  return tpl_ensureStore();
}

// ---------- Apply a template to a draft --------------------------------
// Returns a deep clone of the template's bookings + schedules + setup data
// with fresh autoincrement ids so the draft can mutate freely.
function templateAsDraft(t) {
  if (!t) return null;
  const bookings = (t.bookings || []).map((b, i) => ({
    ...JSON.parse(JSON.stringify(b)),
    id: i + 1,
  }));
  const schedules = (t.schedules || []).map((s, i) => ({
    ...JSON.parse(JSON.stringify(s)),
    id: i + 1,
  }));
  return {
    locations: [...(t.locations || [])],
    costCenters: [...(t.costCenters || [])],
    bookings,
    schedules,
  };
}

// ---------- TemplatePicker (used on New Requisition top) ---------------
//
// Compact "Start from template" surface. When no template is applied,
// renders a Browse button + a Dropdown for the most recent few. When a
// template is applied, renders a chip describing it with Clear.

function TemplatePicker({
  appliedId, onApply, onClear,
  // Optional: when the New Order page also wires up import, these props
  // control the matching "Imported" surface so template + import share a
  // single combined picker. Both can be omitted — the picker falls back
  // to a template-only bar.
  importSource, onImport, onClearImport,
}) {
  const templates = useReqTemplates();
  const applied = templates.find((t) => t.id === appliedId) || null;
  const [browseOpen, setBrowseOpen] = useTplState(false);
  const [importOpen, setImportOpen] = useTplState(false);

  // ----- Applied: template -----
  if (applied) {
    return (
      <React.Fragment>
        <div className="tpl-applied">
          <span className="tpl-applied-icon" aria-hidden="true">
            <Icon name={applied.icon || "Notes"} size={18} />
          </span>
          <span className="tpl-applied-body">
            <span className="tpl-applied-label">Template applied</span>
            <span className="tpl-applied-name">{applied.name}</span>
          </span>
          <span className="tpl-applied-actions">
            <button type="button" className="btn btn--md btn--secondary" onClick={() => setBrowseOpen(true)}>
              Change
            </button>
            <button type="button" className="iconbtn" aria-label="Clear template" onClick={onClear}>
              <Icon name="Cancel" size={20} />
            </button>
          </span>
        </div>
        <BrowseTemplatesPanel
          open={browseOpen}
          onClose={() => setBrowseOpen(false)}
          onApply={(t) => { onApply && onApply(t); setBrowseOpen(false); }}
          appliedId={applied.id}
        />
      </React.Fragment>
    );
  }

  // ----- Applied: imported from file -----
  if (importSource && window.ImportAppliedChip) {
    return (
      <React.Fragment>
        <window.ImportAppliedChip
          source={importSource}
          onChange={() => setImportOpen(true)}
          onClear={onClearImport}
        />
        {window.ImportRequisitionPanel && (
          <window.ImportRequisitionPanel
            open={importOpen}
            onClose={() => setImportOpen(false)}
            onApply={(p) => { onImport && onImport(p); setImportOpen(false); }}
          />
        )}
      </React.Fragment>
    );
  }

  // ----- No starting point yet: 2-up cards -----
  return (
    <React.Fragment>
      <div className="tpl-start">
        {/* Card 1 — Start from a template */}
        <div className="tpl-start-card">
          <span className="acc-card-avatar tpl-start-icon" aria-hidden="true">
            <Icon name="Copy" size={20} />
          </span>
          <span className="tpl-start-title">Start from a template</span>
          <span className="tpl-start-actions">
            <button
              type="button"
              className="btn btn--md btn--secondary"
              onClick={() => setBrowseOpen(true)}
            >
              Choose
            </button>
          </span>
        </div>

        {/* Card 2 — Import from file. Hidden if the host page didn't wire
            up the import handler. */}
        {onImport && (
          <div className="tpl-start-card">
            <span className="acc-card-avatar tpl-start-icon" aria-hidden="true">
              <Icon name="FileUpload" size={20} />
            </span>
            <span className="tpl-start-title">Import from file</span>
            <span className="tpl-start-actions">
              <button
                type="button"
                className="btn btn--md btn--secondary"
                onClick={() => setImportOpen(true)}
              >
                Import
              </button>
            </span>
          </div>
        )}
      </div>

      <BrowseTemplatesPanel
        open={browseOpen}
        onClose={() => setBrowseOpen(false)}
        onApply={(t) => { onApply && onApply(t); setBrowseOpen(false); }}
      />
      {window.ImportRequisitionPanel && (
        <window.ImportRequisitionPanel
          open={importOpen}
          onClose={() => setImportOpen(false)}
          onApply={(p) => { onImport && onImport(p); setImportOpen(false); }}
        />
      )}
    </React.Fragment>
  );
}

// Compact dropdown shown in the picker — lists the templates by name with
// usage hint, choosing one applies immediately.
function TemplateQuickDropdown({ templates, onApply }) {
  const [open, setOpen] = useTplState(false);
  const rootRef = React.useRef(null);

  useTplEffect(() => {
    if (!open) return;
    const onDoc = (e) => { if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  // Sort by lastUsedAt heuristics — "Never" sinks to bottom, then by
  // timesUsed descending. Keeps the most relevant near the top.
  const sorted = useTplMemo(() => {
    return [...templates].sort((a, b) => {
      const aNever = a.lastUsedAt === "Never";
      const bNever = b.lastUsedAt === "Never";
      if (aNever !== bNever) return aNever ? 1 : -1;
      return (b.timesUsed || 0) - (a.timesUsed || 0);
    }).slice(0, 6);
  }, [templates]);

  return (
    <div className="tpl-quick" ref={rootRef}>
      <button
        type="button"
        className="btn btn--md btn--primary"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <Icon name="Copy" size={16} />Choose template
        <Icon
          name="ChevronDown"
          size={16}
          style={{
            transition: "transform 150ms cubic-bezier(0.4,0,0.2,1)",
            transform: open ? "rotate(180deg)" : "none",
          }}
        />
      </button>
      {open && (
        <div className="tpl-quick-menu" role="listbox">
          {sorted.map((t) => (
            <button
              key={t.id}
              type="button"
              role="option"
              className="tpl-quick-item"
              onClick={() => { onApply && onApply(t); setOpen(false); }}
            >
              <span className="tpl-quick-item-icon" aria-hidden="true">
                <Icon name={t.icon || "Notes"} size={16} />
              </span>
              <span className="tpl-quick-item-stack">
                <span className="tpl-quick-item-name">{t.name}</span>
                <span className="tpl-quick-item-sub">
                  {t.bookings.length} booking{t.bookings.length === 1 ? "" : "s"} ·
                  {" "}{t.schedules.length} schedule{t.schedules.length === 1 ? "" : "s"} ·
                  {" "}Last used {t.lastUsedAt}
                </span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------- BrowseTemplatesPanel ---------------------------------------
// Side panel for picking from the full template list with search + tags.

function BrowseTemplatesPanel({ open, onClose, onApply, appliedId }) {
  const templates = useReqTemplates();
  const [query, setQuery] = useTplState("");

  const filtered = useTplMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return templates;
    return templates.filter((t) =>
      t.name.toLowerCase().includes(q) ||
      (t.description || "").toLowerCase().includes(q) ||
      (t.tags || []).some((tag) => tag.toLowerCase().includes(q))
    );
  }, [templates, query]);

  return (
    <SidePanel
      open={open}
      title="Browse templates"
      onClose={onClose}
    >
      <p style={{ margin: 0, font: "var(--evr-body2)", color: "var(--evr-content-primary-default)" }}>
        Pick a starting shape for this requisition. Everything is editable once applied.
      </p>

      <div className="tpl-search">
        <Icon name="Search" size={16} />
        <input
          type="text"
          className="tpl-search-input"
          placeholder="Search templates"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {query && (
          <button type="button" className="icon-btn" aria-label="Clear search" onClick={() => setQuery("")}>
            <Icon name="Cancel" size={14} />
          </button>
        )}
      </div>

      <div className="tpl-browse-list">
        {filtered.length === 0 && (
          <div style={{ padding: 24, textAlign: "center", color: "var(--evr-content-primary-lowemp)", font: "var(--evr-body2)" }}>
            No templates match &ldquo;{query}&rdquo;.
          </div>
        )}
        {filtered.map((t) => (
          <button
            key={t.id}
            type="button"
            className={"tpl-browse-card" + (appliedId === t.id ? " tpl-browse-card--applied" : "")}
            onClick={() => onApply && onApply(t)}
          >
            <span className="tpl-browse-icon" aria-hidden="true">
              <Icon name={t.icon || "Notes"} size={20} />
            </span>
            <span className="tpl-browse-body">
              <span className="tpl-browse-head">
                <span className="tpl-browse-name">{t.name}</span>
              </span>
              <span className="tpl-browse-desc">{t.description}</span>
            </span>
          </button>
        ))}
      </div>
    </SidePanel>
  );
}

// ---------- TemplateEditorPanel ---------------------------------------
// Create / Edit a template. Uses the same primitives as the New Order
// flow (MultiSelect, Dropdown, TextInput, DateRangePicker, TimeInput).

const TPL_ICON_OPTIONS = ["Briefcase", "Stack", "Hourglass", "ClipboardPerson", "TimeAdd", "Calendar", "Pin", "Bolt", "Adjustment", "Notes"];

function TemplateEditorPanel({ open, template, onClose, onSave }) {
  // Source-of-truth for the panel; reset on every open so cancel works.
  const [name, setName]               = useTplState("");
  const [description, setDescription] = useTplState("");
  const [icon, setIcon]               = useTplState("Notes");
  const [tagsText, setTagsText]       = useTplState("");
  const [locations, setLocations]     = useTplState([]);
  const [costCenters, setCostCenters] = useTplState([]);
  const [bookings, setBookings]       = useTplState([]);
  const [schedules, setSchedules]     = useTplState([]);

  useTplEffect(() => {
    if (!open) return;
    setName(template?.name || "");
    setDescription(template?.description || "");
    setIcon(template?.icon || "Notes");
    setTagsText((template?.tags || []).join(", "));
    setLocations([...(template?.locations || [])]);
    setCostCenters([...(template?.costCenters || [])]);
    setBookings(template?.bookings ? JSON.parse(JSON.stringify(template.bookings)) : []);
    setSchedules(template?.schedules ? JSON.parse(JSON.stringify(template.schedules)) : []);
  }, [open, template]);

  // Keep booking locations pruned to the template's setup locations.
  useTplEffect(() => {
    setBookings((bs) => bs.map((b) => ({
      ...b,
      locations: (b.locations || []).filter((l) => locations.includes(l)),
    })));
  }, [locations]);

  // Bookings used in schedule chips track booking count — prune dangling refs.
  useTplEffect(() => {
    const labels = bookings.map((_, i) => `Work assignment ${i + 1}`);
    setSchedules((ss) => ss.map((s) => ({
      ...s,
      bookings: (s.bookings || []).filter((ref) => labels.includes(ref)),
    })));
  }, [bookings.length]);

  const bookingOptions = useTplMemo(() => bookings.map((_, i) => `Work assignment ${i + 1}`), [bookings]);

  const addBooking = () => setBookings((bs) => [
    ...bs,
    {
      id: bs.length ? Math.max(...bs.map((b) => b.id)) + 1 : 1,
      quantity: 1,
      job: "",
      locations: [...locations],
    },
  ]);
  const updateBooking = (id, patch) => setBookings((bs) => bs.map((b) => b.id === id ? { ...b, ...patch } : b));
  const removeBooking = (id) => {
    const idx = bookings.findIndex((b) => b.id === id);
    if (idx < 0) return;
    setBookings((bs) => bs.filter((b) => b.id !== id));
    // Re-number schedule refs above the removed booking.
    setSchedules((ss) => ss.map((s) => ({
      ...s,
      bookings: (s.bookings || []).map((ref) => {
        const m = /Booking\s+(\d+)/i.exec(String(ref));
        if (!m) return ref;
        const n = +m[1];
        if (n === idx + 1) return null;
        if (n > idx + 1) return `Work assignment ${n - 1}`;
        return ref;
      }).filter(Boolean),
    })));
  };

  const addSchedule = () => setSchedules((ss) => [
    ...ss,
    { id: ss.length ? Math.max(...ss.map((s) => s.id)) + 1 : 1, dates: "", start: "", end: "", bookings: [] },
  ]);
  const updateSchedule = (id, patch) => setSchedules((ss) => ss.map((s) => s.id === id ? { ...s, ...patch } : s));
  const removeSchedule = (id) => setSchedules((ss) => ss.filter((s) => s.id !== id));

  const handleSave = () => {
    if (!name.trim()) {
      showToast("Give your template a name", { kind: "warning" });
      return;
    }
    const tags = tagsText
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const tpl = {
      id: template?.id || ("tpl_" + Math.random().toString(36).slice(2, 10)),
      name: name.trim(),
      description: description.trim(),
      icon,
      tags,
      locations,
      costCenters,
      bookings,
      schedules,
      builtIn: false,
      createdBy: template?.createdBy || "You",
      createdAt: template?.createdAt || new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
      lastUsedAt: template?.lastUsedAt || "Never",
      timesUsed: template?.timesUsed || 0,
    };
    saveReqTemplate(tpl);
    showToast(template ? "Template saved" : "Template created", { kind: "success" });
    onSave && onSave(tpl);
  };

  return (
    <SidePanel
      open={open}
      title={template ? "Edit template" : "New template"}
      onClose={onClose}
      footer={(
        <React.Fragment>
          <button type="button" className="btn btn--lg btn--tertiary" onClick={onClose}>Cancel</button>
          <button type="button" className="btn btn--lg btn--primary" onClick={handleSave}>
            {template ? "Save template" : "Create template"}
          </button>
        </React.Fragment>
      )}
    >
      {/* Identity ------------------------------------------------------ */}
      <div>
        <h3 className="sp-section-title">Identity</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <Field label="Template name" required>
            <TextInput value={name} onChange={setName} placeholder="e.g. Weekly production line crew" />
          </Field>
          <Field label="Description" hint="What this template is for and when to reach for it.">
            <TextInput value={description} onChange={setDescription} placeholder="Short summary of when to use this template" />
          </Field>
          <Field label="Icon" hint="Glyph shown in the picker. Choose one that hints at the work.">
            <div className="tpl-icon-grid" role="radiogroup" aria-label="Template icon">
              {TPL_ICON_OPTIONS.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  role="radio"
                  aria-checked={icon === opt}
                  className={"tpl-icon-swatch" + (icon === opt ? " tpl-icon-swatch--active" : "")}
                  onClick={() => setIcon(opt)}
                  title={opt}
                >
                  <Icon name={opt} size={18} />
                </button>
              ))}
            </div>
          </Field>
          <Field label="Tags" hint="Comma-separated. Used for filtering in the picker.">
            <TextInput value={tagsText} onChange={setTagsText} placeholder="e.g. Recurring, Multi-site" />
          </Field>
        </div>
      </div>

      <hr className="sp-divider" />

      {/* Setup --------------------------------------------------------- */}
      <div>
        <h3 className="sp-section-title">Setup</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <Field label="Sites" hint="Work assignments can only use sites included here.">
            <MultiSelect
              options={LOCATION_OPTIONS}
              value={locations}
              onChange={setLocations}
              placeholder="Select one or multiple"
            />
          </Field>
          <Field label="Departments">
            <MultiSelect
              options={COST_CENTER_OPTIONS}
              value={costCenters}
              onChange={setCostCenters}
              placeholder="Select one or multiple"
            />
          </Field>
        </div>
      </div>

      <hr className="sp-divider" />

      {/* Bookings ----------------------------------------------------- */}
      <div>
        <h3 className="sp-section-title">Work assignments</h3>
        <div className="bk-list">
          {bookings.length === 0 ? (
            <div className="bk-list-empty">
              <p className="sc-empty-body" style={{ margin: 0 }}>No bookings yet.</p>
              <button type="button" className="btn btn--sm btn--secondary" onClick={addBooking}>
                <Icon name="AddCircle" size={16} />Add booking
              </button>
            </div>
          ) : (
            <React.Fragment>
              {bookings.map((b, i) => (
                <div className="bk-row" key={b.id}>
                  <div className="bk-row-head">
                    <span className="bk-row-title">Work assignment {i + 1}</span>
                    <button
                      type="button"
                      className="icon-btn"
                      aria-label={`Remove booking ${i + 1}`}
                      title="Remove"
                      onClick={() => removeBooking(b.id)}
                    >
                      <Icon name="TrashCan" size={16} />
                    </button>
                  </div>
                  <div className="bk-row-grid">
                    <Field label="Quantity" required>
                      <TextInput
                        value={String(b.quantity ?? "")}
                        onChange={(v) => {
                          const n = parseInt(String(v).replace(/[^0-9]/g, ""), 10);
                          updateBooking(b.id, { quantity: Number.isFinite(n) && n > 0 ? n : "" });
                        }}
                        small
                      />
                    </Field>
                    <Field label="Job" required>
                      <Dropdown
                        options={(window.getJobOptions && window.getJobOptions()) || JOB_OPTIONS}
                        value={b.job}
                        onChange={(v) => updateBooking(b.id, { job: v })}
                        placeholder="Select a job"
                        small
                      />
                    </Field>
                    <Field
                      label="Sites"
                      hint={locations.length === 0 ? "Add Setup sites first." : undefined}
                    >
                      <MultiSelect
                        options={locations}
                        value={b.locations || []}
                        onChange={(v) => updateBooking(b.id, { locations: v })}
                        placeholder={locations.length === 0 ? "No Setup locations" : "Select locations"}
                        small
                      />
                    </Field>
                  </div>
                </div>
              ))}
              <button type="button" className="bk-list-add" onClick={addBooking}>
                <Icon name="AddCircle" size={20} />
                <span className="bk-list-add-label">Add booking</span>
              </button>
            </React.Fragment>
          )}
        </div>
      </div>

      <hr className="sp-divider" />

      {/* Schedules ---------------------------------------------------- */}
      <div>
        <h3 className="sp-section-title">Schedules</h3>
        <div className="bk-list">
          {schedules.length === 0 ? (
            <div className="bk-list-empty">
              <p className="sc-empty-body" style={{ margin: 0 }}>No schedules yet.</p>
              <button type="button" className="btn btn--sm btn--secondary" onClick={addSchedule}>
                <Icon name="AddCircle" size={16} />Add schedule
              </button>
            </div>
          ) : (
            <React.Fragment>
              {schedules.map((s, i) => (
                <div className="bk-row" key={s.id}>
                  <div className="bk-row-head">
                    <span className="bk-row-title">Schedule {i + 1}</span>
                    <button
                      type="button"
                      className="icon-btn"
                      aria-label={`Remove schedule ${i + 1}`}
                      title="Remove"
                      onClick={() => removeSchedule(s.id)}
                    >
                      <Icon name="TrashCan" size={16} />
                    </button>
                  </div>
                  <div className="sch-row-grid">
                    <Field label="Date(s)" required hint="Used as a placeholder shape; pick actual dates on the requisition.">
                      <TextInput
                        value={s.dates}
                        onChange={(v) => updateSchedule(s.id, { dates: v })}
                        placeholder="e.g. May 18 – May 22"
                      />
                    </Field>
                    <Field label="Start" required>
                      <Dropdown
                        options={TIME_OPTIONS}
                        value={s.start}
                        onChange={(v) => updateSchedule(s.id, { start: v })}
                        placeholder="Start"
                        small
                      />
                    </Field>
                    <Field label="End" required>
                      <Dropdown
                        options={TIME_OPTIONS}
                        value={s.end}
                        onChange={(v) => updateSchedule(s.id, { end: v })}
                        placeholder="End"
                        small
                      />
                    </Field>
                    <Field label="Work assignments">
                      <MultiSelect
                        options={bookingOptions}
                        value={s.bookings || []}
                        onChange={(v) => updateSchedule(s.id, { bookings: v })}
                        placeholder="Select bookings"
                        small
                      />
                    </Field>
                  </div>
                </div>
              ))}
              <button type="button" className="bk-list-add" onClick={addSchedule}>
                <Icon name="AddCircle" size={20} />
                <span className="bk-list-add-label">Add schedule</span>
              </button>
            </React.Fragment>
          )}
        </div>
      </div>
    </SidePanel>
  );
}

// ---------- "Save as template" — tiny capture dialog --------------------
function SaveAsTemplatePanel({ open, draft, onClose, onSaved }) {
  const [name, setName]               = useTplState("");
  const [description, setDescription] = useTplState("");
  const [icon, setIcon]               = useTplState("Notes");
  const [tagsText, setTagsText]       = useTplState("");

  useTplEffect(() => {
    if (!open) return;
    setName("");
    setDescription("");
    setIcon("Notes");
    setTagsText("");
  }, [open]);

  if (!draft) return null;

  const handleSave = () => {
    if (!name.trim()) {
      showToast("Give your template a name", { kind: "warning" });
      return;
    }
    const tpl = {
      id: "tpl_" + Math.random().toString(36).slice(2, 10),
      name: name.trim(),
      description: description.trim(),
      icon,
      tags: tagsText.split(",").map((s) => s.trim()).filter(Boolean),
      locations: [...(draft.locations || [])],
      costCenters: [...(draft.costCenters || [])],
      bookings: JSON.parse(JSON.stringify(draft.bookings || [])),
      schedules: JSON.parse(JSON.stringify(draft.schedules || [])),
      builtIn: false,
      createdBy: "You",
      createdAt: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
      lastUsedAt: "Just now",
      timesUsed: 0,
    };
    saveReqTemplate(tpl);
    showToast("Saved as template", { kind: "success" });
    onSaved && onSaved(tpl);
  };

  const stats = {
    locations: (draft.locations || []).length,
    costCenters: (draft.costCenters || []).length,
    bookings: (draft.bookings || []).length,
    schedules: (draft.schedules || []).length,
  };

  return (
    <SidePanel
      open={open}
      title="Save as template"
      onClose={onClose}
      footer={(
        <React.Fragment>
          <button type="button" className="btn btn--lg btn--tertiary" onClick={onClose}>Cancel</button>
          <button type="button" className="btn btn--lg btn--primary" onClick={handleSave}>
            Save template
          </button>
        </React.Fragment>
      )}
    >
      <p style={{ margin: "-4px 0 16px", font: "var(--evr-body2)", color: "var(--evr-content-primary-default)" }}>
        Capture the current setup, bookings, and schedules as a reusable template anyone in your tenant can pick from.
      </p>

      <div className="tpl-saveas-stats">
        <span className="tpl-saveas-stat"><Icon name="Pin" size={14} />{stats.locations} site{stats.locations === 1 ? "" : "s"}</span>
        <span className="tpl-saveas-stat"><Icon name="Stack" size={14} />{stats.costCenters} department{stats.costCenters === 1 ? "" : "s"}</span>
        <span className="tpl-saveas-stat"><Icon name="Briefcase" size={14} />{stats.bookings} booking{stats.bookings === 1 ? "" : "s"}</span>
        <span className="tpl-saveas-stat"><Icon name="Calendar" size={14} />{stats.schedules} schedule{stats.schedules === 1 ? "" : "s"}</span>
      </div>

      <div style={{ marginTop: 18, display: "flex", flexDirection: "column", gap: 14 }}>
        <Field label="Template name" required>
          <TextInput value={name} onChange={setName} placeholder="e.g. Weekly production line crew" />
        </Field>
        <Field label="Description" hint="A short note about when to reach for this template.">
          <TextInput value={description} onChange={setDescription} placeholder="Short summary" />
        </Field>
        <Field label="Icon">
          <div className="tpl-icon-grid" role="radiogroup" aria-label="Template icon">
            {TPL_ICON_OPTIONS.map((opt) => (
              <button
                key={opt}
                type="button"
                role="radio"
                aria-checked={icon === opt}
                className={"tpl-icon-swatch" + (icon === opt ? " tpl-icon-swatch--active" : "")}
                onClick={() => setIcon(opt)}
                title={opt}
              >
                <Icon name={opt} size={18} />
              </button>
            ))}
          </div>
        </Field>
        <Field label="Tags" hint="Comma-separated.">
          <TextInput value={tagsText} onChange={setTagsText} placeholder="e.g. Recurring, Multi-site" />
        </Field>
      </div>
    </SidePanel>
  );
}

// =====================================================================
// Settings → Requisition templates
// =====================================================================
function RequisitionTemplatesPage() {
  const templates = useReqTemplates();
  const [query, setQuery] = useTplState("");
  const [editorOpen, setEditorOpen] = useTplState(false);
  const [editTarget, setEditTarget] = useTplState(null);

  const filtered = useTplMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return templates;
    return templates.filter((t) =>
      t.name.toLowerCase().includes(q) ||
      (t.description || "").toLowerCase().includes(q) ||
      (t.tags || []).some((tag) => tag.toLowerCase().includes(q))
    );
  }, [templates, query]);

  const openNew = () => { setEditTarget(null); setEditorOpen(true); };
  const openEdit = (t) => { setEditTarget(t); setEditorOpen(true); };

  const handleDuplicate = (t) => {
    const copy = duplicateReqTemplate(t.id);
    if (copy) showToast(`Duplicated "${t.name}"`, { kind: "success" });
  };

  const handleDelete = (t) => {
    openConfirm({
      title: `Delete "${t.name}"?`,
      body: "Anyone using this template in the picker will stop seeing it. This can't be undone.",
      primaryLabel: "Delete",
      onConfirm: () => {
        deleteReqTemplate(t.id);
        showToast("Template deleted");
      },
    });
  };

  return (
    <div className="set-content">
      <header className="set-content-header" style={{ display: "flex", flexDirection: "column", gap: 12, padding: "8px 4px 0" }}>
        <h2 className="set-content-title">Templates</h2>
        <p className="set-content-sub">
          Reusable shapes for new orders — sites, departments, bookings, and schedules. Templates show up at the top of the New Order flow so anyone in your tenant can prefill a requisition in one click.
        </p>
      </header>

      {/* v0.77 spec §08 · templates will declare an axis tuple in
          Phase 4. The list will group by Work Type (Shift templates ·
          Assignment templates), and picking a template seeds the
          intake with matching axes. Banner hidden at flag-off. */}
      {window.V77InfoBanner ? (
        <window.V77InfoBanner
          icon="Information"
          title="Templates gain axis tuples in Phase 4."
        >
          Each template will carry a Work Type · Billing Model · Supplier Type tuple. The list will group by Work Type, and picking a template will seed the intake with matching axes (locked except Supplier Type).
        </window.V77InfoBanner>
      ) : null}

      <section className="tpl-page-card">
        <div className="tpl-toolbar">
          <div className="tpl-toolbar-search">
            <Icon name="Search" size={16} />
            <input
              type="text"
              className="tpl-search-input"
              placeholder="Search templates"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div className="tpl-toolbar-meta">
            <span className="tpl-toolbar-count">
              {templates.length} template{templates.length === 1 ? "" : "s"}
            </span>
            <button
              type="button"
              className="btn btn--md btn--primary"
              onClick={openNew}
            >
              <Icon name="AddCircle" size={16} />New template
            </button>
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="tpl-empty">
            <Icon name="Copy" size={28} />
            <h3 className="tpl-empty-title">{query ? "No matches" : "No templates yet"}</h3>
            <p className="tpl-empty-body">
              {query
                ? `Nothing matches "${query}". Try a different search.`
                : "Create your first template to prefill the New Order flow for your team."}
            </p>
            {!query && (
              <button type="button" className="btn btn--md btn--primary" onClick={openNew}>
                <Icon name="AddCircle" size={16} />New template
              </button>
            )}
          </div>
        ) : (
          <ul className="tpl-grid">
            {filtered.map((t) => (
              <li key={t.id} className="tpl-card">
                <div className="tpl-card-head">
                  <span className="tpl-card-icon" aria-hidden="true">
                    <Icon name={t.icon || "Notes"} size={20} />
                  </span>
                  <div className="tpl-card-headtext">
                    <h3 className="tpl-card-name">{t.name}</h3>
                    <span className="tpl-card-by">
                      By {t.createdBy} · {t.createdAt}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="icon-btn"
                    aria-label={`Open menu for ${t.name}`}
                    title="More"
                    onClick={(e) => openMenu(e.currentTarget, [
                      { icon: "Edit",     label: "Edit",       onClick: () => openEdit(t) },
                      { icon: "Copy",     label: "Duplicate",  onClick: () => handleDuplicate(t) },
                      !t.builtIn && { divider: true },
                      !t.builtIn && { icon: "TrashCan", label: "Delete", onClick: () => handleDelete(t), danger: true },
                    ].filter(Boolean))}
                  >
                    <Icon name="MoreVert" size={16} />
                  </button>
                </div>

                <p className="tpl-card-desc">{t.description}</p>

                {t.tags && t.tags.length > 0 && (
                  <div className="tpl-card-tags">
                    {t.tags.map((tag) => (
                      <span className="tpl-card-tag" key={tag}>{tag}</span>
                    ))}
                    {t.builtIn && <span className="tpl-card-tag tpl-card-tag--builtin">Built-in</span>}
                  </div>
                )}

                <dl className="tpl-card-stats">
                  <div>
                    <dt><Icon name="Pin" size={14} />Sites</dt>
                    <dd className="tabular">{t.locations.length}</dd>
                  </div>
                  <div>
                    <dt><Icon name="Briefcase" size={14} />Work assignments</dt>
                    <dd className="tabular">{t.bookings.length}</dd>
                  </div>
                  <div>
                    <dt><Icon name="Calendar" size={14} />Schedules</dt>
                    <dd className="tabular">{t.schedules.length}</dd>
                  </div>
                </dl>

                <div className="tpl-card-foot">
                  <span className="tpl-card-usage">
                    <Icon name="TimeUndo" size={14} />
                    Last used {t.lastUsedAt}
                    {t.timesUsed > 0 && <span className="tpl-card-usage-sub"> · {t.timesUsed}×</span>}
                  </span>
                  <button type="button" className="btn btn--sm btn--tertiary" onClick={() => openEdit(t)}>
                    <Icon name="Edit" size={14} />Edit
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <TemplateEditorPanel
        open={editorOpen}
        template={editTarget}
        onClose={() => setEditorOpen(false)}
        onSave={() => setEditorOpen(false)}
      />
    </div>
  );
}

Object.assign(window, {
  // Store API
  getReqTemplates, getReqTemplate, saveReqTemplate, deleteReqTemplate,
  duplicateReqTemplate, useReqTemplates, templateAsDraft,
  // Components
  TemplatePicker, BrowseTemplatesPanel, TemplateEditorPanel,
  SaveAsTemplatePanel, RequisitionTemplatesPage,
});
