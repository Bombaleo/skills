// =====================================================================
// Flex Work — Pricing Configurations · Create / Edit wizard
//   Full-viewport overlay with a 3-step flow:
//     1) Details   — name + creation method (scratch / copy existing)
//     2) Structure — pricing-group rule builder (reuses PcfgStructureViewer)
//     3) Review    — read-only summary, "Save as Pending" CTA
//   In "edit" mode the wizard skips straight to the Structure step.
// =====================================================================

const { useState: useW, useMemo: useMemoW, useEffect: useEffectW } = React;

function PcfgStepper({ step, steps = ["Details", "Structure", "Review"] }) {
  return (
    <div className="pcfg-stepper">
      {steps.map((label, i) => {
        const state = i < step ? "done" : i === step ? "current" : "todo";
        return (
          <React.Fragment key={label}>
            <div className="pcfg-step" data-state={state}>
              <span className="pcfg-step-dot">
                {state === "done" ? <Icon name="Check" size={14} /> : (i + 1)}
              </span>
              <span className="pcfg-step-label">{label}</span>
            </div>
            {i < steps.length - 1 && (
              <div className="pcfg-step-line" data-done={i < step ? "true" : "false"} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

// ----- Step 1: Details --------------------------------------------------
function PcfgStepDetails({ values, setValues, errors }) {
  return (
    <div className="pcfg-wizard-card">
      <div className="pcfg-form-card-header">
        <div className="pcfg-form-card-avatar">AM</div>
        <div className="pcfg-form-card-titlewrap">
          <h3>Configuration details</h3>
          <p>Give this configuration a clear, recognizable name. You can change it later.</p>
        </div>
      </div>
      <div className="pcfg-form-card-body">
        <div className="pcfg-field">
          <label htmlFor="pcfg-new-name" className="pcfg-field-label-on">
            Configuration name<span className="pcfg-req">*</span>
          </label>
          <input
            id="pcfg-new-name"
            className="pcfg-input"
            value={values.name}
            onChange={(e) => setValues({ ...values, name: e.target.value })}
            aria-invalid={!!errors.name}
            placeholder="e.g. Manufacturing — North Region 2026"
            maxLength={200}
          />
          {errors.name ? (
            <div className="pcfg-field-error">
              <span>{errors.name}</span>
              <span>{values.name.length}/175</span>
            </div>
          ) : (
            <div className="pcfg-field-help" style={{ textAlign: "right" }}>
              {values.name.length}/175
            </div>
          )}
        </div>

        <div className="pcfg-field">
          <span className="pcfg-field-label-on">
            Creation method<span className="pcfg-req">*</span>
          </span>
          <div className="pcfg-radio-group">
            <label className="pcfg-radio-label">
              <input
                type="radio"
                name="pcfg-method"
                value="scratch"
                checked={values.method === "scratch"}
                onChange={() => setValues({ ...values, method: "scratch" })}
              />
              Start from scratch
            </label>
            <label className="pcfg-radio-label">
              <input
                type="radio"
                name="pcfg-method"
                value="copy"
                checked={values.method === "copy"}
                onChange={() => setValues({ ...values, method: "copy" })}
              />
              Copy an existing configuration
            </label>
            {/* v0.79 · A4 — industry templates */}
            <label className="pcfg-radio-label">
              <input
                type="radio"
                name="pcfg-method"
                value="template"
                checked={values.method === "template"}
                onChange={() => setValues({ ...values, method: "template", templateId: values.templateId || (window.PCFG_INDUSTRY_TEMPLATES?.[1]?.id || "tpl-light-industrial") })}
              />
              Start from industry template
            </label>
          </div>
        </div>

        {values.method === "copy" && (
          <div className="pcfg-field">
            <label htmlFor="pcfg-copy-from" className="pcfg-field-label-on">
              Existing configuration<span className="pcfg-req">*</span>
            </label>
            <select
              id="pcfg-copy-from"
              className="pcfg-select"
              value={values.copyFrom || ""}
              onChange={(e) => setValues({ ...values, copyFrom: e.target.value })}
              aria-invalid={!!errors.copyFrom}
            >
              <option value="">Select from list</option>
              {window.getPcfgStore && window.getPcfgStore()
                .filter((c) => c.status !== "Archived")
                .map((c) => (
                  <option key={c.id} value={c.id}>{c.name} · {c.status}</option>
                ))}
            </select>
            {errors.copyFrom && (
              <div className="pcfg-field-error"><span>{errors.copyFrom}</span><span /></div>
            )}
          </div>
        )}

        {/* v0.79 · A4 — industry-template picker */}
        {values.method === "template" && window.PCFG_INDUSTRY_TEMPLATES && (
          <div className="pcfg-field">
            <span className="pcfg-field-label-on">Industry template</span>
            <div className="pcfg-template-grid">
              {window.PCFG_INDUSTRY_TEMPLATES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className={`pcfg-template ${values.templateId === t.id ? "is-active" : ""}`}
                  onClick={() => setValues({ ...values, templateId: t.id })}
                >
                  <span className="pcfg-template-h">
                    <Icon name={t.icon} size={16} />
                    <b>{t.name}</b>
                  </span>
                  <span className="pcfg-template-blurb">{t.blurb}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ----- Step 2: Structure (delegates to PcfgStructureViewer in edit mode) ----
function PcfgStepStructure({ structure, setStructure }) {
  return (
    <div className="pcfg-wizard-card pcfg-wizard-card--builder">
      <div className="pcfg-form-card-header">
        <div className="pcfg-form-card-avatar">$</div>
        <div className="pcfg-form-card-titlewrap">
          <h3>Pricing structure</h3>
          <p>Define the pricing rules that make up this configuration. Locked groups are required and can't be removed.</p>
        </div>
      </div>
      <div className="pcfg-form-card-body" style={{ padding: "16px 24px 32px" }}>
        <window.PcfgStructureViewer
          structure={structure}
          editable={true}
          onEdit={() => {}}
          onAddRule={() => {
            if (window.showToast) window.showToast("Adding a new rule (demo)", { kind: "info" });
          }}
          onAddGroup={() => {
            const id = `gx-${Date.now()}`;
            setStructure([
              ...structure.slice(0, structure.length - 2),
              { id, name: "New custom group", locked: false, rules: [] },
              ...structure.slice(structure.length - 2),
            ]);
            if (window.showToast) window.showToast("New group added", { kind: "success" });
          }}
        />
      </div>
    </div>
  );
}

// ----- Step 3: Review --------------------------------------------------
function PcfgStepReview({ values, structure }) {
  const totalRules = structure.reduce((acc, g) => acc + g.rules.length, 0);
  return (
    <div className="pcfg-wizard-card">
      <div className="pcfg-form-card-header">
        <div className="pcfg-form-card-avatar"><Icon name="Check" size={20} /></div>
        <div className="pcfg-form-card-titlewrap">
          <h3>Review and save</h3>
          <p>Saved as Pending — this configuration goes Active the first time it's assigned to an agency contract.</p>
        </div>
      </div>
      <div className="pcfg-review-summary">
        <dl style={{ margin: 0 }}>
          <div className="pcfg-review-row">
            <dt>Configuration name</dt>
            <dd>{values.name || "—"}</dd>
          </div>
          <div className="pcfg-review-row">
            <dt>Creation method</dt>
            <dd>{values.method === "copy" ? "Copy of existing configuration" : "Start from scratch"}</dd>
          </div>
          <div className="pcfg-review-row">
            <dt>Pricing groups</dt>
            <dd>{structure.length} · {totalRules} rules total</dd>
          </div>
          <div className="pcfg-review-row">
            <dt>Initial status</dt>
            <dd><window.PcfgStatusPill status="Pending" /></dd>
          </div>
        </dl>

        <h4 style={{
          margin: "8px 0 0",
          font: "var(--evr-body2)",
          fontWeight: "var(--evr-fw-bold)",
          color: "var(--evr-content-primary-highemp)",
        }}>
          Structure preview
        </h4>
        <div className="pcfg-review-rules">
          {structure.map((g, i) => (
            <div className="pcfg-review-rule" key={g.id}>
              <span className="pcfg-rule-num">{i + 1}</span>
              <span style={{ flex: 1, fontWeight: "var(--evr-fw-demibold)" }}>{g.name}</span>
              <span style={{ font: "var(--evr-caption)", color: "var(--evr-content-primary-lowemp)" }}>
                {g.rules.length} rule{g.rules.length === 1 ? "" : "s"}
              </span>
              {g.locked && <Icon name="Lock" size={14} style={{ color: "var(--evr-content-primary-lowemp)" }} />}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ----- Wizard ----------------------------------------------------------
function PricingConfigWizard({ mode, configId, onClose }) {
  const initialConfig = configId && window.getPcfgStore
    ? window.getPcfgStore().find((c) => c.id === configId)
    : null;

  const isEdit = mode === "edit";

  // Mode mapping:
  //   "new"  -> 3 steps (Details, Structure, Review)
  //   "edit" -> 1 step (Structure-only) but we still render the stepper at
  //             "Structure" so users see they're past Details.
  const [step, setStep] = useW(isEdit ? 1 : 0);
  const [values, setValues] = useW({
    name: initialConfig ? initialConfig.name : "",
    method: "scratch",
    copyFrom: "",
  });
  const [structure, setStructure] = useW(() => {
    if (initialConfig) {
      return initialConfig.structure.map((g) => ({ ...g, rules: g.rules.map((r) => ({ ...r })) }));
    }
    return window.PCFG_DEFAULT_STRUCTURE.map((g) => ({ ...g, rules: g.rules.map((r) => ({ ...r })) }));
  });
  const [errors, setErrors] = useW({});
  const [confirmCancel, setConfirmCancel] = useW(false);
  const [dirty, setDirty] = useW(false);

  // Mark dirty whenever values/structure change after mount.
  useEffectW(() => { setDirty(true); }, [values, structure]);
  // Reset dirty on mount so opening doesn't immediately mark dirty.
  useEffectW(() => { setDirty(false); }, []); // eslint-disable-line

  // When the copy-from changes, swap in that config's structure.
  useEffectW(() => {
    if (values.method === "copy" && values.copyFrom && window.getPcfgStore) {
      const src = window.getPcfgStore().find((c) => c.id === values.copyFrom);
      if (src) {
        setStructure(src.structure.map((g) => ({ ...g, rules: g.rules.map((r) => ({ ...r })) })));
      }
    }
    // v0.79 · A4 — when the template changes, seed the structure off
    // the chosen industry template.
    if (values.method === "template" && values.templateId && window.PCFG_INDUSTRY_TEMPLATES) {
      const tpl = window.PCFG_INDUSTRY_TEMPLATES.find((t) => t.id === values.templateId);
      if (tpl) {
        const seeded = tpl.seed();
        setStructure(seeded.map((g) => ({ ...g, rules: g.rules.map((r) => ({ ...r })) })));
      }
    }
  }, [values.method, values.copyFrom, values.templateId]);

  const validateStep = (s) => {
    if (isEdit) return true; // structure step has no required validation in this demo
    if (s === 0) {
      const next = {};
      const name = values.name.trim();
      if (!name) next.name = "Configuration name is required.";
      else if (name.length > 175) next.name = "Name must be 175 characters or fewer.";
      else {
        const existing = (window.getPcfgStore ? window.getPcfgStore() : [])
          .some((c) => c.name.trim().toLowerCase() === name.toLowerCase() && c.id !== (initialConfig && initialConfig.id));
        if (existing) next.name = "A configuration with this name already exists.";
      }
      if (values.method === "copy" && !values.copyFrom) next.copyFrom = "Pick a configuration to copy from.";
      setErrors(next);
      return Object.keys(next).length === 0;
    }
    return true;
  };

  const goNext = () => {
    if (!validateStep(step)) return;
    setStep((s) => Math.min(s + 1, 2));
  };
  const goBack = () => setStep((s) => Math.max(s - 1, 0));

  const saveAndClose = () => {
    if (!validateStep(step)) return;
    if (isEdit && initialConfig) {
      window.upsertPcfg({ ...initialConfig, structure });
      if (window.showToast) window.showToast("Structure saved", { kind: "success" });
      onClose(initialConfig.id);
      return;
    }
    const id = `pc-${Date.now()}`;
    window.upsertPcfg({
      id,
      name: values.name.trim(),
      status: "Pending",
      dateCreated: new Date().toLocaleString(),
      dateActivated: null,
      dateArchived: null,
      createdBy: "Alex Moreno",
      agencyCount: 0,
      agencies: [],
      structure,
    });
    if (window.showToast) window.showToast("Configuration created — Pending activation", { kind: "success" });
    onClose(id);
  };

  const handleClose = () => {
    if (dirty) setConfirmCancel(true);
    else onClose(null);
  };

  // Esc closes (with confirmation if dirty).
  useEffectW(() => {
    const onKey = (e) => { if (e.key === "Escape") handleClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dirty]);

  return (
    <div className="pcfg-wizard" role="dialog" aria-modal="true">
      <div className="pcfg-wizard-topbar">
        <div className="pcfg-wizard-title">
          {isEdit
            ? `Edit pricing structure · ${initialConfig ? initialConfig.name : ""}`
            : "New pricing configuration"}
        </div>
        <button type="button" className="pcfg-wizard-close" onClick={handleClose} aria-label="Close">
          <Icon name="X" size={18} />
        </button>
      </div>

      <div className="pcfg-wizard-body">
        {!isEdit && (
          <div className="pcfg-wizard-card pcfg-wizard-card--stepper">
            <PcfgStepper step={step} />
          </div>
        )}

        {step === 0 && !isEdit && (
          <PcfgStepDetails values={values} setValues={setValues} errors={errors} />
        )}
        {(step === 1 || isEdit) && (
          <PcfgStepStructure structure={structure} setStructure={setStructure} />
        )}
        {step === 2 && !isEdit && (
          <PcfgStepReview values={values} structure={structure} />
        )}

        <div className={`pcfg-button-bar${(step === 1 && !isEdit) || isEdit ? " pcfg-button-bar--builder" : ""}`}>
          <div className="pcfg-button-bar-left">
            <button type="button" className="pcfg-btn pcfg-btn--tertiary" onClick={handleClose}>
              Cancel
            </button>
          </div>
          <div className="pcfg-button-bar-right">
            {step > 0 && !isEdit && (
              <button type="button" className="pcfg-btn pcfg-btn--secondary" onClick={goBack}>
                Back
              </button>
            )}
            {(step < 2 && !isEdit) ? (
              <button type="button" className="pcfg-btn pcfg-btn--primary" onClick={goNext}>
                Next
              </button>
            ) : (
              <button type="button" className="pcfg-btn pcfg-btn--primary" onClick={saveAndClose}>
                {isEdit ? "Save changes" : "Save as Pending"}
              </button>
            )}
          </div>
        </div>
      </div>

      {confirmCancel && (
        <window.PcfgConfirmModal
          title={isEdit ? "Discard your changes?" : "Cancel configuration setup?"}
          body={isEdit
            ? "Any structure changes you've made will be discarded. This action cannot be undone."
            : "This will discard your progress and any changes you've made. This action cannot be undone."}
          confirmLabel={isEdit ? "Discard changes" : "Yes, cancel"}
          danger
          onConfirm={() => { setConfirmCancel(false); onClose(null); }}
          onClose={() => setConfirmCancel(false)}
        />
      )}
    </div>
  );
}

Object.assign(window, { PricingConfigWizard, PcfgStepper });
