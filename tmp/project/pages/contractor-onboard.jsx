// =====================================================================
// Flex Work — Add contractor (onboarding side panel)
//   Six-step wizard: Identity → Classification → Agreement → Tax →
//   Banking → Review. Event-driven via Interactions.on("addContractor").
//   Standard IC onboarding shape (identity, classification, agreement,
//   tax form, banking, review) in Everest visual style.
// =====================================================================

const { useState: useStateAC, useEffect: useEffectAC } = React;

// ---------- Catalogs ---------------------------------------------------
const CTR_COUNTRIES = [
  { c: "US", name: "United States", flag: "us", form: "W-9",    taxClass: "1099-NEC" },
  { c: "CA", name: "Canada",        flag: "ca", form: "W-8BEN", taxClass: "T4A" },
  { c: "MX", name: "Mexico",        flag: "mx", form: "W-8BEN", taxClass: "1042-S" },
  { c: "BR", name: "Brazil",        flag: "br", form: "W-8BEN", taxClass: "1042-S" },
  { c: "GB", name: "United Kingdom", flag: "gb", form: "W-8BEN", taxClass: "1042-S" },
  { c: "DE", name: "Germany",       flag: "de", form: "W-8BEN", taxClass: "1042-S" },
  { c: "FR", name: "France",        flag: "fr", form: "W-8BEN", taxClass: "1042-S" },
  { c: "SE", name: "Sweden",        flag: "se", form: "W-8BEN-E", taxClass: "1042-S" },
  { c: "IN", name: "India",         flag: "in", form: "W-8BEN", taxClass: "1042-S" },
  { c: "NG", name: "Nigeria",       flag: "ng", form: "W-8BEN", taxClass: "1042-S" },
  { c: "PH", name: "Philippines",   flag: "ph", form: "W-8BEN", taxClass: "1042-S" },
  { c: "AU", name: "Australia",     flag: "au", form: "W-8BEN", taxClass: "1042-S" },
];

const CTR_ENTITY_BY_COUNTRY = {
  US: ["Individual", "Sole proprietor", "Single-member LLC", "Multi-member LLC", "S-Corporation", "C-Corporation", "Partnership"],
  CA: ["Individual", "Sole proprietor", "Corporation"],
  GB: ["Individual", "Sole trader", "Limited company"],
  DE: ["Individual", "Freelancer (Freiberufler)", "GmbH"],
  FR: ["Individual", "Auto-entrepreneur", "SARL", "SAS"],
  SE: ["Individual", "Enskild firma", "Aktiebolag"],
  BR: ["Individual", "Sole proprietor (MEI)", "LTDA"],
  MX: ["Individual", "Persona física", "Persona moral"],
  IN: ["Individual", "Sole proprietor", "Private Limited"],
  NG: ["Individual", "Sole proprietor", "Private Limited"],
  PH: ["Individual", "Sole proprietor", "Corporation"],
  AU: ["Individual", "Sole trader", "Pty Ltd"],
  _default: ["Individual", "Sole proprietor", "Corporation"],
};

const CTR_RATE_TYPES = [
  { id: "hourly",   label: "Hourly",         unit: "hr",        help: "Bills against approved timesheets — most common." },
  { id: "monthly",  label: "Fixed monthly",  unit: "month",     help: "Recurring monthly fee, regardless of hours worked." },
  { id: "milestone", label: "Milestone / project", unit: "deliverable", help: "Lump-sum payments tied to deliverables in the SOW." },
  { id: "perword",  label: "Per-word",        unit: "word",     help: "Translation, copywriting, transcription." },
  { id: "daily",    label: "Daily",          unit: "day",       help: "Daily rate; capped by max days / month in the SOW." },
];

const CTR_PAY_METHODS = {
  US: ["ACH", "Wire", "PayPal", "Wise"],
  EU: ["SEPA", "Wire", "Wise"],
  default: ["Wire", "Wise", "PayPal"],
};

// ---------- Classification questionnaire (short form) -----------------
const CTR_CLASSIF_QUESTIONS = [
  { id: "q1", q: "Will the contractor set their own working hours?", safe: "yes" },
  { id: "q2", q: "Will the contractor use their own tools and equipment?", safe: "yes" },
  { id: "q3", q: "Is the contractor free to work for other clients during the engagement?", safe: "yes" },
  { id: "q4", q: "Will the engagement last 18 months or less?", safe: "yes" },
  { id: "q5", q: "Will the work be outside the company's usual core business?", safe: "yes" },
  { id: "q6", q: "Will the contractor invoice — rather than receive a regular salary?", safe: "yes" },
];

function scoreClassif(answers) {
  // 0 = safest, 100 = highest risk. Each "wrong" answer adds 17.
  let score = 0;
  for (const q of CTR_CLASSIF_QUESTIONS) {
    const a = answers[q.id];
    if (!a) score += 8; // unanswered
    else if (a !== q.safe) score += 17;
  }
  return Math.min(100, score);
}

// ---------- Stepper ---------------------------------------------------
function CtrStepper({ steps, current }) {
  return (
    <ol className="ctr-step-list" aria-label="Onboarding steps">
      {steps.map((s, i) => {
        const state = i < current ? "done" : i === current ? "active" : "future";
        return (
          <li key={s} className={`ctr-step ctr-step--${state}`}>
            <span className="ctr-step-bullet" aria-hidden="true">
              {state === "done" ? <Icon name="Check" size={12} /> : i + 1}
            </span>
            <span className="ctr-step-label">{s}</span>
          </li>
        );
      })}
    </ol>
  );
}

// ---------- Field building blocks --------------------------------------
function CtrField({ label, hint, children, span = 1 }) {
  return (
    <label className="ctr-field" style={span === 2 ? { gridColumn: "span 2" } : undefined}>
      <span className="ctr-field-lbl">{label}</span>
      {children}
      {hint && <span className="ctr-field-hint">{hint}</span>}
    </label>
  );
}

function CtrInput({ value, onChange, placeholder, type = "text" }) {
  return (
    <input
      className="ctr-input"
      type={type}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

function CtrSelect({ value, onChange, options }) {
  return (
    <select
      className="ctr-input ctr-select"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      {options.map((o) =>
        typeof o === "string"
          ? <option key={o} value={o}>{o}</option>
          : <option key={o.value} value={o.value}>{o.label}</option>
      )}
    </select>
  );
}

function CtrRadioGroup({ value, onChange, options }) {
  return (
    <div className="ctr-radio-group" role="radiogroup">
      {options.map((o) => (
        <label key={o.id || o} className={"ctr-radio" + (value === (o.id || o) ? " is-checked" : "")}>
          <input
            type="radio"
            name="ctr-radio"
            value={o.id || o}
            checked={value === (o.id || o)}
            onChange={() => onChange(o.id || o)}
          />
          <span className="ctr-radio-lbl">
            <span className="ctr-radio-title">{o.label || o}</span>
            {o.help && <span className="ctr-radio-help">{o.help}</span>}
          </span>
        </label>
      ))}
    </div>
  );
}

// ====================================================================
// Step bodies
// ====================================================================

function StepIdentity({ data, set }) {
  return (
    <div className="ctr-form">
      <div className="ctr-form-grid">
        <CtrField label="Full name">
          <CtrInput value={data.name} onChange={(v) => set("name", v)} placeholder="Anika Narang" />
        </CtrField>
        <CtrField label="Email">
          <CtrInput value={data.email} onChange={(v) => set("email", v)} type="email" placeholder="name@example.com" />
        </CtrField>
        <CtrField label="Country of residence">
          <div className="ctr-country-input">
            <span className={`fi fi-${(data.countryFlag || "us")} ctr-country-flag`} aria-hidden="true"></span>
            <CtrSelect
              value={data.country}
              onChange={(v) => {
                const c = CTR_COUNTRIES.find((x) => x.c === v);
                set("country", v);
                if (c) { set("countryName", c.name); set("countryFlag", c.flag); set("taxForm", c.form); set("taxClass", c.taxClass); }
              }}
              options={CTR_COUNTRIES.map((c) => ({ value: c.c, label: `${c.name} (${c.c})` }))}
            />
          </div>
        </CtrField>
        <CtrField label="Entity type" hint="Drives which tax form the contractor will be asked to fill.">
          <CtrSelect
            value={data.entity}
            onChange={(v) => set("entity", v)}
            options={CTR_ENTITY_BY_COUNTRY[data.country] || CTR_ENTITY_BY_COUNTRY._default}
          />
        </CtrField>
        <CtrField label="Legal / business name" hint="As it should appear on the agreement and tax form.">
          <CtrInput value={data.legalName} onChange={(v) => set("legalName", v)} placeholder={data.name || "Anika Narang"} />
        </CtrField>
        <CtrField label="Phone">
          <CtrInput value={data.phone} onChange={(v) => set("phone", v)} placeholder="+1 (415) 555-0142" />
        </CtrField>
        <CtrField label="Address" span={2}>
          <CtrInput value={data.address} onChange={(v) => set("address", v)} placeholder="Street, city, region, postal code" />
        </CtrField>
      </div>
    </div>
  );
}

function StepClassification({ data, set }) {
  const score = scoreClassif(data.answers || {});
  const meta = window.contractorRiskMeta(score);
  return (
    <div className="ctr-form">
      <div className="ctr-classif-banner" style={{ background: meta.bg, color: meta.fg }}>
        <Icon name={meta.hue === "error" ? "Alert" : meta.hue === "warning" ? "Information" : "CheckCircle"} size={16} />
        <div>
          <b>{meta.label}</b> · misclassification score {score}/100
          <div className="ctr-classif-banner-sub">
            Based on the IRS 20-factor + ABC test logic. Update answers below to see the score change in real time.
          </div>
        </div>
      </div>
      <ol className="ctr-quiz">
        {CTR_CLASSIF_QUESTIONS.map((q) => (
          <li key={q.id} className="ctr-quiz-row">
            <div className="ctr-quiz-q">{q.q}</div>
            <div className="ctr-quiz-a">
              <label className={"ctr-pill-option" + ((data.answers || {})[q.id] === "yes" ? " is-on" : "")}>
                <input
                  type="radio"
                  name={q.id}
                  checked={(data.answers || {})[q.id] === "yes"}
                  onChange={() => set("answers", { ...(data.answers || {}), [q.id]: "yes" })}
                />
                Yes
              </label>
              <label className={"ctr-pill-option" + ((data.answers || {})[q.id] === "no" ? " is-on" : "")}>
                <input
                  type="radio"
                  name={q.id}
                  checked={(data.answers || {})[q.id] === "no"}
                  onChange={() => set("answers", { ...(data.answers || {}), [q.id]: "no" })}
                />
                No
              </label>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

function StepAgreement({ data, set }) {
  return (
    <div className="ctr-form">
      <div className="ctr-template-row">
        <label className={"ctr-template" + (data.agrTemplate === "standard" ? " is-on" : "")}>
          <input type="radio" name="agr" checked={data.agrTemplate === "standard"} onChange={() => set("agrTemplate", "standard")} />
          <span>
            <b>Standard MSA + SOW</b>
            <span className="ctr-template-help">Flex Work's vetted template for {data.countryName || "this country"}. Includes IP assignment + NDA.</span>
          </span>
        </label>
        <label className={"ctr-template" + (data.agrTemplate === "custom" ? " is-on" : "")}>
          <input type="radio" name="agr" checked={data.agrTemplate === "custom"} onChange={() => set("agrTemplate", "custom")} />
          <span>
            <b>Upload custom MSA</b>
            <span className="ctr-template-help">Use your own legal template. SOW + IP + NDA are added on top.</span>
          </span>
        </label>
      </div>

      <div className="ctr-form-grid">
        <CtrField label="Engagement title">
          <CtrInput value={data.engagement} onChange={(v) => set("engagement", v)} placeholder="UX Research – Workforce mobile" />
        </CtrField>
        <CtrField label="Effective date">
          <CtrInput value={data.effective} onChange={(v) => set("effective", v)} type="date" />
        </CtrField>
        <CtrField label="Rate type">
          <CtrRadioGroup value={data.rateType} onChange={(v) => set("rateType", v)} options={CTR_RATE_TYPES} />
        </CtrField>
        <CtrField label="Rate amount" hint={`Per ${(CTR_RATE_TYPES.find((r) => r.id === data.rateType) || CTR_RATE_TYPES[0]).unit}, in ${data.currency || "USD"}`}>
          <CtrInput value={data.rateAmount} onChange={(v) => set("rateAmount", v)} type="number" placeholder="145" />
        </CtrField>
        <CtrField label="Currency">
          <CtrSelect value={data.currency} onChange={(v) => set("currency", v)} options={["USD", "EUR", "GBP", "CAD", "AUD", "BRL", "MXN", "INR"]} />
        </CtrField>
        <CtrField label="Max hours per week" hint="Used by the classification engine to flag full-time exclusivity.">
          <CtrInput value={data.maxHours} onChange={(v) => set("maxHours", v)} type="number" placeholder="20" />
        </CtrField>
        <CtrField label="Scope of work" span={2}>
          <textarea
            className="ctr-textarea"
            rows={3}
            value={data.scope}
            onChange={(e) => set("scope", e.target.value)}
            placeholder="Describe deliverables, milestones, and acceptance criteria. This becomes the body of the SOW."
          />
        </CtrField>
      </div>
    </div>
  );
}

function StepTax({ data, set }) {
  const c = CTR_COUNTRIES.find((x) => x.c === data.country) || CTR_COUNTRIES[0];
  return (
    <div className="ctr-form">
      <div className="ctr-info-card">
        <Icon name="Information" size={16} />
        <div>
          <b>Auto-selected: {c.form}</b>
          <p>Based on {c.name} + {data.entity || "Individual"}. The contractor will be asked to complete this form during invite — or you can upload one they've already signed.</p>
        </div>
      </div>
      <div className="ctr-form-grid">
        <CtrField label="Tax form">
          <CtrSelect value={data.taxForm} onChange={(v) => set("taxForm", v)} options={["W-9", "W-8BEN", "W-8BEN-E"]} />
        </CtrField>
        <CtrField label="Reportable on">
          <CtrSelect value={data.taxClass} onChange={(v) => set("taxClass", v)} options={["1099-NEC", "1042-S", "T4A", "None"]} />
        </CtrField>
        <CtrField label="TIN / EIN" hint="Encrypted at rest. Used only for year-end filings.">
          <CtrInput value={data.tin} onChange={(v) => set("tin", v)} placeholder="••-•••••••" />
        </CtrField>
        <CtrField label="W-9 / W-8 collection">
          <CtrRadioGroup
            value={data.taxCollection}
            onChange={(v) => set("taxCollection", v)}
            options={[
              { id: "invite", label: "Send the contractor an e-sign request", help: "They sign electronically before first invoice." },
              { id: "upload", label: "Upload a completed form now",           help: "You already have a signed copy on file." },
            ]}
          />
        </CtrField>
      </div>
    </div>
  );
}

function StepBanking({ data, set }) {
  const methods = data.country === "US" ? CTR_PAY_METHODS.US
    : ["DE", "FR", "SE", "GB"].includes(data.country) ? CTR_PAY_METHODS.EU
    : CTR_PAY_METHODS.default;
  return (
    <div className="ctr-form">
      <div className="ctr-info-card">
        <Icon name="ShieldPerson" size={16} />
        <div>
          <b>Banking is collected from the contractor</b>
          <p>You'll set the payment method here; the contractor enters their banking details securely during onboarding invite.</p>
        </div>
      </div>
      <div className="ctr-form-grid">
        <CtrField label="Payment method">
          <CtrSelect value={data.payMethod} onChange={(v) => set("payMethod", v)} options={methods} />
        </CtrField>
        <CtrField label="Payment terms">
          <CtrSelect value={data.payTerms} onChange={(v) => set("payTerms", v)} options={["Net 7", "Net 15", "Net 30", "Net 45", "Due on receipt"]} />
        </CtrField>
        <CtrField label="Invoice cadence">
          <CtrRadioGroup
            value={data.invoiceCadence}
            onChange={(v) => set("invoiceCadence", v)}
            options={[
              { id: "submit",  label: "Contractor submits invoices",       help: "Standard. Contractor uploads or types an invoice each cycle." },
              { id: "auto",    label: "Auto-generate from approved time",  help: "Flex Work creates an invoice when a timesheet is approved." },
            ]}
          />
        </CtrField>
        <CtrField label="GL account" hint="Mapped from your chart of accounts. Editable per SOW.">
          <CtrSelect value={data.glAccount} onChange={(v) => set("glAccount", v)} options={["6100 · Outside services", "6110 · Professional fees", "6120 · IT consulting", "6130 · Marketing services"]} />
        </CtrField>
      </div>
    </div>
  );
}

function StepReview({ data }) {
  const c = CTR_COUNTRIES.find((x) => x.c === data.country);
  const rate = CTR_RATE_TYPES.find((r) => r.id === data.rateType) || CTR_RATE_TYPES[0];
  const score = scoreClassif(data.answers || {});
  const meta = window.contractorRiskMeta(score);
  return (
    <div className="ctr-form ctr-review">
      <section className="ctr-review-card">
        <h4>Identity</h4>
        <dl className="ctr-kv-grid">
          <CtrKV label="Name"        value={data.name} />
          <CtrKV label="Email"       value={data.email} />
          <CtrKV label="Country"     value={c ? `${c.name} (${c.c})` : "—"} />
          <CtrKV label="Entity"      value={data.entity} />
          <CtrKV label="Legal name"  value={data.legalName || data.name} />
        </dl>
      </section>
      <section className="ctr-review-card">
        <h4>Classification</h4>
        <div className="ctr-review-risk" style={{ background: meta.bg, color: meta.fg }}>
          <Icon name={meta.hue === "error" ? "Alert" : meta.hue === "warning" ? "Information" : "CheckCircle"} size={14} />
          <span>{meta.label} · score {score}/100</span>
        </div>
      </section>
      <section className="ctr-review-card">
        <h4>Agreement</h4>
        <dl className="ctr-kv-grid">
          <CtrKV label="Template"   value={data.agrTemplate === "custom" ? "Custom MSA + Flex Work SOW/NDA/IP" : "Flex Work MSA + SOW + NDA + IP"} />
          <CtrKV label="Engagement" value={data.engagement} />
          <CtrKV label="Effective"  value={data.effective} />
          <CtrKV label="Rate"       value={`${window.fmtContractorMoney(Number(data.rateAmount) || 0, data.currency)} / ${rate.unit}`} mono />
          <CtrKV label="Max hours"  value={data.maxHours ? `${data.maxHours} hr / week` : "—"} />
        </dl>
      </section>
      <section className="ctr-review-card">
        <h4>Tax & banking</h4>
        <dl className="ctr-kv-grid">
          <CtrKV label="Tax form"   value={data.taxForm} />
          <CtrKV label="Reportable" value={data.taxClass} />
          <CtrKV label="Payment"    value={data.payMethod} />
          <CtrKV label="Terms"      value={data.payTerms} />
          <CtrKV label="Cadence"    value={data.invoiceCadence === "auto" ? "Auto from timesheets" : "Contractor submits"} />
          <CtrKV label="GL account" value={data.glAccount} />
        </dl>
      </section>
      <div className="ctr-review-note">
        <Icon name="Information" size={14} />
        <span>On <b>Invite</b>, the contractor receives an email with: the MSA + SOW + NDA + IP for e-signature, a tax-form request, a banking-detail form, and a document-upload portal for ID and COI. Status is <b>Onboarding</b> until all items are complete.</span>
      </div>
    </div>
  );
}

// ====================================================================
// Wizard
// ====================================================================
const CTR_STEPS = ["Identity", "Classification", "Agreement", "Tax", "Banking", "Review"];

function AddContractorPanel({ onClose }) {
  const [step, setStep] = useStateAC(0);
  const [data, setData] = useStateAC({
    name: "", email: "",
    country: "US", countryName: "United States", countryFlag: "us",
    entity: "Single-member LLC",
    legalName: "", phone: "", address: "",
    answers: { q1: "yes", q2: "yes", q3: "yes", q4: "yes", q5: "yes", q6: "yes" },
    agrTemplate: "standard",
    engagement: "", effective: "",
    rateType: "hourly", rateAmount: "", currency: "USD", maxHours: "20",
    scope: "",
    taxForm: "W-9", taxClass: "1099-NEC", tin: "", taxCollection: "invite",
    payMethod: "ACH", payTerms: "Net 15", invoiceCadence: "submit",
    glAccount: "6100 · Outside services",
  });
  function set(key, val) {
    setData((d) => ({ ...d, [key]: val }));
  }

  function next() { setStep((s) => Math.min(CTR_STEPS.length - 1, s + 1)); }
  function back() { setStep((s) => Math.max(0, s - 1)); }
  function invite() {
    const nm = data.name || "Contractor";
    showToast(`${nm} invited · MSA + SOW + tax form sent`, { kind: "success" });
    onClose();
  }
  function saveDraft() {
    const nm = data.name || "Contractor";
    showToast(`${nm} saved as draft — onboarding paused`, { kind: "success" });
    onClose();
  }

  const bodies = [
    <StepIdentity data={data} set={set} key="0" />,
    <StepClassification data={data} set={set} key="1" />,
    <StepAgreement data={data} set={set} key="2" />,
    <StepTax data={data} set={set} key="3" />,
    <StepBanking data={data} set={set} key="4" />,
    <StepReview data={data} key="5" />,
  ];

  return (
    <React.Fragment>
      <div className="scrim open" onClick={onClose} aria-hidden="true" />
      <aside
        className="side-panel side-panel--wide ctr-onboard open"
        role="dialog"
        aria-modal="true"
        aria-label="Add contractor"
      >
        <header className="ctr-onboard-head">
          <div>
            <span className="ctr-onboard-eyebrow">New worker · Contractor</span>
            <h2 className="ctr-onboard-title">Add a contractor</h2>
            <p className="ctr-onboard-sub">Independent contractors are sourced directly — no supplier. They sign an MSA + SOW with you and submit their own invoices.</p>
          </div>
          <button type="button" className="iconbtn" aria-label="Close" onClick={onClose}>
            <Icon name="Cancel" size={20} />
          </button>
        </header>

        <CtrStepper steps={CTR_STEPS} current={step} />

        <div className="ctr-onboard-body">
          {bodies[step]}
        </div>

        <footer className="ctr-onboard-foot">
          <div className="ctr-onboard-foot-l">
            <button type="button" className="btn btn--md btn--tertiary" onClick={saveDraft}>Save draft</button>
          </div>
          <div className="ctr-onboard-foot-r">
            {step > 0 && (
              <button type="button" className="btn btn--md btn--secondary" onClick={back}>Back</button>
            )}
            {step < CTR_STEPS.length - 1 ? (
              <button type="button" className="btn btn--md btn--primary" onClick={next}>Continue</button>
            ) : (
              <button type="button" className="btn btn--md btn--primary" onClick={invite}>
                <Icon name="Send" size={14} />Send invite
              </button>
            )}
          </div>
        </footer>
      </aside>
    </React.Fragment>
  );
}

// Host: opens when Interactions emits "addContractor".
// The host is mounted unconditionally so it can listen for events, but
// it defensively re-checks the `contractors` feature flag before
// rendering the panel — so a stray openAddContractor() call (dev
// console, lingering handler after a flag flip) can never surface
// gated UI on a tenant where contractors is off.
function AddContractorPanelHost() {
  const [open, setOpen] = useStateAC(false);
  // Subscribe to flag changes so the host re-renders when the flag is
  // flipped — if it goes off while the panel is open, the next render
  // closes it.
  const contractorsOn = (typeof window !== "undefined" && window.useFeatureFlag)
    ? window.useFeatureFlag("contractors")
    : false;
  useEffectAC(() => Interactions.on("addContractor", () => {
    // Re-check at fire time too — events may have been queued from a
    // surface that was visible just before the flag flipped.
    if (window.getFeatureFlag && !window.getFeatureFlag("contractors")) return;
    setOpen(true);
  }), []);
  useEffectAC(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);
  if (!open || !contractorsOn) return null;
  return <AddContractorPanel onClose={() => setOpen(false)} />;
}

function openAddContractor() { Interactions.emit("addContractor"); }

Object.assign(window, {
  AddContractorPanel,
  AddContractorPanelHost,
  openAddContractor,
});
