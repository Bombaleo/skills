// =====================================================================
// Flex Work — Edit entity panel
// A generic side panel that drives every "Edit" button across detail
// pages. Field metadata is passed in by the caller so each entity type
// (worker, supplier, location, requisition, booking, quote) shapes its
// own form, but the chrome and footer pattern are shared.
// =====================================================================

const { useState: useStateEe, useEffect: useEffectEe } = React;

// Field render — switches on `kind` ("text" | "select" | "tags" |
// "textarea" | "toggle" | "number" | "time").
function EditEntityField({ field, value, onChange }) {
  if (field.kind === "textarea") {
    return (
      <div className="fld-control" style={{ minHeight: 96, alignItems: "flex-start", paddingTop: 10 }}>
        <textarea
          className="fld-input"
          rows={3}
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          style={{ resize: "vertical", minHeight: 72, background: "transparent" }}
        />
      </div>
    );
  }
  if (field.kind === "inherit-method") {
    const orgDefault = field.orgDefault || "Dayforce Clock";
    const methods = field.methods || [];
    const isOverride = value !== null && value !== undefined && value !== "";
    const activeMethod = isOverride ? value : orgDefault;
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
          <Switch
            checked={isOverride}
            onChange={(v) => onChange(v ? orgDefault : null)}
            ariaLabel="Override organization default"
          />
          <span style={{ font: "var(--evr-body2)", color: "var(--evr-content-primary-default)" }}>
            {isOverride ? "Override organization default" : (
              <React.Fragment>
                Inheriting from organization
                <span style={{ color: "var(--evr-content-primary-lowemp)" }}> · {orgDefault}</span>
              </React.Fragment>
            )}
          </span>
        </div>
        <div
          className="acct-segmented"
          role="radiogroup"
          aria-label={field.label}
          style={{
            display: "inline-flex",
            alignSelf: "flex-start",
            opacity: isOverride ? 1 : 0.5,
            pointerEvents: isOverride ? "auto" : "none",
          }}
          aria-disabled={!isOverride}
        >
          {methods.map((opt) => {
            const v = typeof opt === "string" ? opt : opt.value;
            const lbl = typeof opt === "string" ? opt : opt.label;
            const ico = typeof opt === "object" ? opt.icon : null;
            const active = activeMethod === v;
            return (
              <button
                key={v}
                type="button"
                role="radio"
                aria-checked={active}
                tabIndex={isOverride ? 0 : -1}
                className={active ? "is-active" : ""}
                onClick={() => onChange(v)}
                style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
              >
                {ico && <Icon name={ico} size={16} />}
                {lbl}
              </button>
            );
          })}
        </div>
      </div>
    );
  }
  if (field.kind === "segmented" && field.options && field.options.length) {
    return (
      <div className="acct-segmented" role="radiogroup" aria-label={field.label} style={{ display: "inline-flex" }}>
        {field.options.map((opt) => {
          const v = typeof opt === "string" ? opt : opt.value;
          const lbl = typeof opt === "string" ? opt : opt.label;
          const ico = typeof opt === "object" ? opt.icon : null;
          const active = (value || "") === v;
          return (
            <button
              key={v}
              type="button"
              role="radio"
              aria-checked={active}
              className={active ? "is-active" : ""}
              onClick={() => onChange(v)}
              style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
            >
              {ico && <Icon name={ico} size={16} />}
              {lbl}
            </button>
          );
        })}
      </div>
    );
  }
  if (field.kind === "select") {
    if (field.options && field.options.length) {
      return (
        <div className="fld-control fld-control--input">
          <select
            className="fld-input"
            value={value || ""}
            onChange={(e) => onChange(e.target.value)}
            style={{ background: "transparent", border: "none", outline: "none", width: "100%", cursor: "pointer" }}
          >
            {field.placeholder && !value && <option value="">{field.placeholder}</option>}
            {field.options.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>
      );
    }
    return <SelectField value={value || field.placeholder || "Select"} />;
  }
  if (field.kind === "tags") {
    return <TagInput values={Array.isArray(value) ? value : (value ? [value] : [])} placeholder={field.placeholder} />;
  }
  if (field.kind === "toggle") {
    return (
      <div style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
        <Switch checked={!!value} onChange={onChange} ariaLabel={field.label} />
        <span style={{ font: "var(--evr-body2)", color: "var(--evr-content-primary-default)" }}>
          {value ? (field.onLabel || "On") : (field.offLabel || "Off")}
        </span>
      </div>
    );
  }
  return (
    <TextInput
      value={value || ""}
      onChange={onChange}
      placeholder={field.placeholder}
      type={field.kind === "number" ? "number" : "text"}
    />
  );
}

// sections: [{ title, fields: [{ key, label, kind, required?, placeholder?, hint?, span? }] }]
// initial: { [key]: value }
function EditEntityPanel({ open, title, subtitle, sections = [], initial = {}, primaryLabel = "Save changes", onClose, onSave }) {
  const [values, setValues] = useStateEe(initial);

  useEffectEe(() => {
    if (open) setValues(initial);
    // initial is a fresh object each open — no infinite loop because we
    // only sync when `open` flips.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const set = (key, v) => setValues((prev) => ({ ...prev, [key]: v }));

  return (
    <SidePanel
      open={open}
      title={title}
      onClose={onClose}
      footer={(
        <React.Fragment>
          <button type="button" className="btn btn--lg btn--tertiary" onClick={onClose}>Cancel</button>
          <button
            type="button"
            className="btn btn--lg btn--primary"
            onClick={() => {
              if (onSave) onSave(values);
              showToast(`${title.replace(/^Edit\s+/i, "")} saved`, { kind: "success" });
              onClose && onClose();
            }}
          >
            {primaryLabel}
          </button>
        </React.Fragment>
      )}
    >
      {subtitle && <p style={{ margin: "-4px 0 16px", font: "var(--evr-body2)", color: "var(--evr-content-primary-default)" }}>{subtitle}</p>}
      {/* v0.77 spec §07 · axis-switch dialog preview. Phase 4 wires a
          segmented control at the top of the edit panel that lets users
          flip Work Type / Billing Model / Supplier Type with a
          preserve/reset/drop preview. Banner hidden at flag-off. */}
      {window.V77InfoBanner ? (
        <window.V77InfoBanner
          icon="Information"
          title="Axis switch arrives in Phase 4."
        >
          Editing this row will gain a segmented control for Work Type / Billing Model / Supplier Type, with a preserve/reset/drop preview before commit. Per-axis audit-log entries fire on save.
        </window.V77InfoBanner>
      ) : null}
      {sections.map((section, si) => (
        <React.Fragment key={si}>
          {si > 0 && <hr className="sp-divider" />}
          <div>
            {section.title && <h3 className="sp-section-title">{section.title}</h3>}
            <div className={section.grid === 2 ? "sp-grid-2" : ""} style={section.grid !== 2 ? { display: "flex", flexDirection: "column", gap: 12 } : null}>
              {section.fields.map((f) => (
                <Field
                  key={f.key}
                  label={f.label}
                  required={f.required}
                  hint={f.hint}
                  style={f.span === 2 ? { gridColumn: "1 / -1" } : null}
                >
                  <EditEntityField field={f} value={values[f.key]} onChange={(v) => set(f.key, v)} />
                </Field>
              ))}
            </div>
          </div>
        </React.Fragment>
      ))}
    </SidePanel>
  );
}

// ---------- Hook + helpers for opening EditEntityPanel from any page ---
function useEditEntity() {
  const [config, setConfig] = useStateEe(null);
  const close = () => setConfig(null);
  const open  = (cfg) => setConfig(cfg);
  const panel = config && (
    <EditEntityPanel
      open
      title={config.title}
      subtitle={config.subtitle}
      sections={config.sections}
      initial={config.initial || {}}
      primaryLabel={config.primaryLabel}
      onClose={close}
      onSave={config.onSave}
    />
  );
  return { open, close, panel };
}

// ---------- Schema factories — one per entity type --------------------
// Keeps every page's Edit button consistent without duplicating field
// metadata across files.

function workerEditSchema(w) {
  return {
    title: `Edit ${w.name}`,
    subtitle: "Update contact details, identification, and assignment.",
    initial: {
      name: w.name,
      email: w.email,
      phone: w.phone,
      region: w.region,
      supplier: REQ_SUPPLIERS[w.supplier]?.label,
      jobs: w.jobs,
      dob: w.dob,
      securityId: w.securityId,
      externalId: w.externalId === "—" ? "" : w.externalId,
      blocked: false,
    },
    sections: [
      {
        title: "Contact",
        grid: 2,
        fields: [
          { key: "name",   label: "Full name",    required: true },
          { key: "email",  label: "Email",        required: true },
          { key: "phone",  label: "Phone number" },
          { key: "region", label: "Region", kind: "select" },
        ],
      },
      {
        title: "Assignment",
        grid: 2,
        fields: [
          { key: "supplier", label: "Supplier", kind: "select" },
          { key: "jobs",     label: "Eligible job assignments", kind: "tags", placeholder: "Add a job" },
        ],
      },
      {
        title: "Identification",
        grid: 2,
        fields: [
          { key: "dob",        label: "Date of birth" },
          { key: "securityId", label: "Security ID" },
          { key: "externalId", label: "External ID", placeholder: "Optional", span: 2 },
        ],
      },
    ],
  };
}

function supplierEditSchema(s) {
  return {
    title: `Edit ${s.name}`,
    subtitle: "Update supplier profile, billing contact, and payment terms.",
    initial: {
      name: s.name,
      address: s.address,
      site: s.site,
      phone: s.phone,
      contactName: "Jessica Adams",
      contactEmail: `accountsreceivable@${(s.name || "").toLowerCase().replace(/\s+/g, "")}.com`,
      paymentTerms: "Net 30",
      payoutMethod: "ACH transfer",
    },
    sections: [
      {
        title: "Profile",
        grid: 2,
        fields: [
          { key: "name",    label: "Supplier name", required: true },
          { key: "site",    label: "Website" },
          { key: "address", label: "Address", span: 2 },
          { key: "phone",   label: "Phone" },
        ],
      },
      {
        title: "Billing contact",
        grid: 2,
        fields: [
          { key: "contactName",  label: "Contact name" },
          { key: "contactEmail", label: "Contact email", span: 2 },
        ],
      },
      {
        title: "Payments",
        grid: 2,
        fields: [
          { key: "paymentTerms", label: "Payment terms", kind: "select" },
          { key: "payoutMethod", label: "Payout method", kind: "select" },
        ],
      },
    ],
  };
}

function locationEditSchema(loc) {
  const orgClockDefault =
    (window.__configStore && window.__configStore.defaults && window.__configStore.defaults.clockMethod) ||
    "Dayforce Clock";
  return {
    title: `Edit ${loc.name}`,
    subtitle: "Update address, type, and operating details.",
    initial: {
      name: loc.name,
      address: loc.address,
      type: "Warehouse",
      region: "East",
      hours: "Mon – Fri, 6:00 AM – 10:00 PM",
      contact: "Site supervisor",
      clockMethod: loc.clockMethod != null ? loc.clockMethod : null,
    },
    sections: [
      {
        title: "Profile",
        grid: 2,
        fields: [
          { key: "name",    label: "Site name", required: true, span: 2 },
          { key: "address", label: "Address",       span: 2 },
          { key: "type",    label: "Type",     kind: "select" },
          { key: "region",  label: "Region",   kind: "select" },
        ],
      },
      {
        title: "Operations",
        fields: [
          { key: "hours",   label: "Operating hours" },
          { key: "contact", label: "Primary contact" },
        ],
      },
      {
        title: "Time capture",
        fields: [
          {
            key: "clockMethod",
            label: "Clock in / out method",
            kind: "inherit-method",
            orgDefault: orgClockDefault,
            methods: [
              { value: "Dayforce Clock", label: "Dayforce Clock", icon: "PersonClock" },
              { value: "QR Code",        label: "QR Code",        icon: "QrCode" },
              { value: "Manual",         label: "Manual",         icon: "Edit" },
            ],
            hint: "Toggle override to pick a different method for this location only.",
          },
        ],
      },
    ],
  };
}

function requisitionEditSchema(req) {
  return {
    title: `Edit Requisition #${req.id}`,
    subtitle: "Update the headline details. Bookings and schedules edit inline below.",
    initial: {
      location: req.location,
      costCenter: req.costCenter,
      bookedBy: req.bookedBy,
      jobs: req.jobs,
      qty: String(req.qty || 3),
      time: req.time,
      breakLabel: req.breakLabel,
      notes: "",
    },
    sections: [
      {
        title: "Where",
        grid: 2,
        fields: [
          { key: "location",   label: "Site",    kind: "select" },
          { key: "costCenter", label: "Department", kind: "select" },
          { key: "bookedBy",   label: "Booked by",   kind: "select", span: 2 },
        ],
      },
      {
        title: "What",
        grid: 2,
        fields: [
          { key: "qty",  label: "Quantity per work assignment", kind: "number" },
          { key: "jobs", label: "Job assignments",                 kind: "tags" },
          { key: "time",       label: "Shift time" },
          { key: "breakLabel", label: "Break" },
        ],
      },
      {
        title: "Notes",
        fields: [
          { key: "notes", label: "Notes for suppliers", kind: "textarea", placeholder: "Internal notes, dress code, reporting instructions…" },
        ],
      },
    ],
  };
}

function bookingEditSchema(bk) {
  return {
    title: `Edit work assignment #${bk.id}`,
    subtitle: "Adjust the location, dates, and crew assigned to this work assignment.",
    initial: {
      location: bk.location,
      dates: bk.dates,
      jobs: bk.jobs,
      notes: "",
    },
    sections: [
      {
        title: "Work assignment",
        grid: 2,
        fields: [
          { key: "location", label: "Site", kind: "select", span: 2 },
          { key: "dates",    label: "Dates",                    span: 2 },
          { key: "jobs", label: "Job assignments",     kind: "tags",   span: 2 },
        ],
      },
      {
        title: "Notes",
        fields: [
          { key: "notes", label: "Notes for the supplier", kind: "textarea" },
        ],
      },
    ],
  };
}

function quoteEditSchema() {
  return {
    title: "Edit quote",
    subtitle: "Adjust the bill-rate range used to estimate this requisition.",
    initial: {
      saRate: "$22 – $28 / hr",
      pickerRate: "$18 – $24 / hr",
      lmRate: "$32 – $40 / hr",
      taxRate: "8%",
      fee: "$123",
    },
    sections: [
      {
        title: "Job rates",
        fields: [
          { key: "saRate",     label: "Production Associate" },
          { key: "pickerRate", label: "Picker" },
          { key: "lmRate",     label: "Line Manager" },
        ],
      },
      {
        title: "Charges",
        grid: 2,
        fields: [
          { key: "taxRate", label: "Tax rate" },
          { key: "fee",     label: "Platform fee" },
        ],
      },
    ],
  };
}

// ---------- New "narrow" schemas for inline edit affordances --------

function timeEditSchema(ts) {
  return {
    title: `Edit times on ${ts.id}`,
    subtitle: `${ts.date} · ${ts.role}`,
    primaryLabel: "Save times",
    initial: {
      actualStart: ts.actualStart,
      actualEnd:   ts.actualEnd === "—" ? "" : ts.actualEnd,
      breakMin:    "12",
      note:        "",
    },
    sections: [
      {
        title: "Shift times",
        grid: 2,
        fields: [
          { key: "actualStart", label: "Start time", hint: `Scheduled: ${ts.schedStart}` },
          { key: "actualEnd",   label: "End time",   hint: `Scheduled: ${ts.schedEnd}` },
          { key: "breakMin",    label: "Break (min)", kind: "number", hint: "Scheduled: 15 min" },
        ],
      },
      {
        title: "Reason",
        fields: [
          { key: "note", label: "Note for audit log", kind: "textarea", placeholder: "Why is this time being changed?" },
        ],
      },
    ],
  };
}

function shiftEditSchema(worker, bookingId) {
  return {
    title: `Edit ${worker.name}'s shift`,
    subtitle: `Work assignment #${bookingId}`,
    primaryLabel: "Save shift",
    initial: {
      role: worker.jobs[0] || "Production Associate",
      start: "6:00 AM",
      end:   "3:00 PM",
      break: "30 min",
      note:  "",
    },
    sections: [
      {
        title: "Shift",
        grid: 2,
        fields: [
          { key: "role",  label: "Role",       kind: "select" },
          { key: "break", label: "Break",      kind: "select" },
          { key: "start", label: "Start time" },
          { key: "end",   label: "End time" },
        ],
      },
      {
        title: "Note",
        fields: [
          { key: "note", label: "Note for the worker", kind: "textarea", placeholder: "Anything they should know before their shift?" },
        ],
      },
    ],
  };
}

function paymentNoteSchema(inv) {
  return {
    title: `Add payment note to INV-${inv.id}`,
    subtitle: `${inv.amount} from ${REQ_SUPPLIERS[inv.supplier]?.label || inv.supplier}`,
    primaryLabel: "Save note",
    initial: { type: "Internal", note: "" },
    sections: [
      {
        title: "Visibility",
        fields: [
          { key: "type", label: "Note visibility", kind: "select" },
        ],
      },
      {
        title: "Note",
        fields: [
          { key: "note", label: "Note", kind: "textarea", placeholder: "Add reconciliation context, dispute reason, or payment reference…" },
        ],
      },
    ],
  };
}

function distributionRulesSchema() {
  return {
    title: "Distribution rules",
    subtitle: "Set how this requisition is offered to suppliers and how positions are split.",
    primaryLabel: "Save rules",
    initial: {
      strategy: "Sequential by priority",
      allocationMode: "Percentage",
      window: "30 minutes",
      autoExpand: true,
      capPerSupplier: "10",
      excludeSuppliers: [],
    },
    sections: [
      {
        title: "Offer strategy",
        grid: 2,
        fields: [
          { key: "strategy", label: "Strategy", kind: "select", span: 2,
            options: ["Sequential by priority", "Parallel — all suppliers at once", "Split by allocation"] },
          { key: "allocationMode", label: "Allocate positions by", kind: "select",
            options: ["Percentage", "Headcount"],
            hint: "Default split mode when offering to multiple suppliers." },
          { key: "window", label: "Decision window", kind: "select",
            options: ["15 minutes", "30 minutes", "1 hour", "2 hours", "4 hours"] },
          { key: "capPerSupplier", label: "Cap per supplier", kind: "number", hint: "Max workers per supplier" },
        ],
      },
      {
        title: "Behavior",
        fields: [
          { key: "autoExpand", label: "Auto-expand to next supplier when window closes", kind: "toggle", onLabel: "Enabled", offLabel: "Disabled" },
          { key: "excludeSuppliers", label: "Exclude suppliers", kind: "tags", placeholder: "Add a supplier to exclude…" },
        ],
      },
    ],
  };
}

function newLocationSchema() {
  const orgClockDefault =
    (window.__configStore && window.__configStore.defaults && window.__configStore.defaults.clockMethod) ||
    "Dayforce Clock";
  return {
    title: "Create location",
    subtitle: "Add a new site to your organization tree.",
    primaryLabel: "Create site",
    initial: { name: "", address: "", type: "Warehouse", region: "East", hours: "", clockMethod: null },
    sections: [
      {
        title: "Profile",
        grid: 2,
        fields: [
          { key: "name",    label: "Site name", required: true, span: 2 },
          { key: "address", label: "Address",       required: true, span: 2 },
          { key: "type",    label: "Type",    kind: "select" },
          { key: "region",  label: "Region",  kind: "select" },
          { key: "hours",   label: "Operating hours", placeholder: "Mon – Fri, 9 AM – 5 PM", span: 2 },
        ],
      },
      {
        title: "Time capture",
        fields: [
          {
            key: "clockMethod",
            label: "Clock in / out method",
            kind: "inherit-method",
            orgDefault: orgClockDefault,
            methods: [
              { value: "Dayforce Clock", label: "Dayforce Clock", icon: "PersonClock" },
              { value: "QR Code",        label: "QR Code",        icon: "QrCode" },
              { value: "Manual",         label: "Manual",         icon: "Edit" },
            ],
            hint: "Toggle override to pick a different method for this location only.",
          },
        ],
      },
    ],
  };
}

function inviteSupplierSchema() {
  return {
    title: "Invite supplier",
    subtitle: "We'll email the contact a link to set up their workspace.",
    primaryLabel: "Send invite",
    initial: { name: "", contact: "", email: "", scope: ["Active requisitions"] },
    sections: [
      {
        title: "Supplier",
        fields: [
          { key: "name",    label: "Supplier name", required: true },
          { key: "contact", label: "Primary contact", required: true },
          { key: "email",   label: "Email", required: true },
        ],
      },
      {
        title: "Access",
        fields: [
          { key: "scope", label: "What they can see", kind: "tags" },
        ],
      },
    ],
  };
}

// ---------- Host — listens to the bus, renders the panel globally ----
function EditEntityHost() {
  const [config, setConfig] = useStateEe(null);
  useEffectEe(() => Interactions.on("editEntity", setConfig), []);
  if (!config) return null;
  return (
    <EditEntityPanel
      open
      title={config.title}
      subtitle={config.subtitle}
      sections={config.sections}
      initial={config.initial || {}}
      primaryLabel={config.primaryLabel}
      onSave={config.onSave}
      onClose={() => setConfig(null)}
    />
  );
}

Object.assign(window, {
  EditEntityPanel, useEditEntity, EditEntityHost,
  workerEditSchema, supplierEditSchema, locationEditSchema,
  requisitionEditSchema, bookingEditSchema, quoteEditSchema,
  timeEditSchema, shiftEditSchema, paymentNoteSchema,
  distributionRulesSchema, newLocationSchema, inviteSupplierSchema,
});
