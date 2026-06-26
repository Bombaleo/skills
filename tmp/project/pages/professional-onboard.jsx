// =====================================================================
// Flex Work — Professional onboarding + renewal panels
//   Two side-panel hosts:
//     · AddProfessionalPanel  — invite a new Professional worker
//       (Engagement → Compensation → Onboarding tasks → Review).
//     · RenewProfessionalPanel — renew or amend an existing engagement
//       (term, rate, cadence, notes → approval).
//   Both are mounted via Host components App renders once, driven by
//   the same Interactions event-bus pattern the contractor onboarding
//   uses. Capability covers Professional Services onboarding,
//   engagement amendment, and renewal workflows.
// =====================================================================

const { useState: useStateProb, useEffect: useEffectProb, useMemo: useMemoProb } = React;

// ---------- Catalogs --------------------------------------------------
const PRO_COUNTRIES = [
  { c: "US", name: "United States",         flag: "us" },
  { c: "CA", name: "Canada",                flag: "ca" },
  { c: "GB", name: "United Kingdom",        flag: "gb" },
  { c: "ES", name: "Spain",                 flag: "es" },
  { c: "DE", name: "Germany",               flag: "de" },
  { c: "SG", name: "Singapore",             flag: "sg" },
  { c: "JP", name: "Japan",                 flag: "jp" },
  { c: "AE", name: "United Arab Emirates",  flag: "ae" },
  { c: "BR", name: "Brazil",                flag: "br" },
  { c: "MX", name: "Mexico",                flag: "mx" },
  { c: "AU", name: "Australia",             flag: "au" },
];

const PRO_CADENCE = [
  { id: "weekly",  label: "Weekly",  unit: "week"  },
  { id: "monthly", label: "Monthly", unit: "month" },
  { id: "annual",  label: "Annual",  unit: "year"  },
];

const PRO_SUPPLIERS_FOR_PRO = [
  { id: "direct", label: "Direct (no supplier)" },
  { id: "sw",     label: "StaffWise Solutions"   },
  { id: "ap",     label: "AlphaTech Partners"    },
  { id: "wf",     label: "Workforce Global"      },
];

const PRO_ONBOARD_DEFAULTS = {
  // Variant flag \u2014 "professional" (default) | "frontline". When set
  // to "frontline", step 2 swaps cadence + rate for hourly rate +
  // classification (W\u20112), and step 3 reads its task catalog from
  // window.getOnboardingTasks("frontline") instead of the static
  // PRO_TASKS array. Same shell, same Interactions bus.
  workerType: "professional",
  name: "",
  email: "",
  country: "US",
  countryFlag: "us",
  role: "",
  hiringManager: "",
  supplier: "direct",
  cadence: "monthly",
  rateAmount: "",
  currency: "USD",
  termStart: "",
  timesheetMode: "none",
  sowTemplate: "MSA + SOW template · Permanent",
  tasks: {
    msa:      true,
    sow:      true,
    nda:      true,
    ip:       true,
    bgCheck:  true,
    benefits: false,
    laptop:   false,
    accounts: true,
  },
};

const PRO_STEPS = [
  { id: "identity",     label: "Engagement"   },
  { id: "compensation", label: "Compensation" },
  { id: "tasks",        label: "Onboarding"   },
  { id: "review",       label: "Review"       },
];

// Frontline classifications surfaced when the variant flag is on.
// Mirrors the classification picker the Contractors hub uses on its
// own Add panel \u2014 hourly + non\u2011exempt is the default for direct
// Frontline.
const FRONTLINE_CLASSIFICATIONS = [
  { id: "w2_hourly",      label: "W-2 hourly (non-exempt)",     hint: "Eligible for overtime; clock-in/out time capture." },
  { id: "w2_salaried",    label: "W-2 salaried (exempt)",       hint: "Salaried Frontline lead; manager / supervisor roles." },
  { id: "w2_tipped",      label: "W-2 tipped (non-exempt)",     hint: "Hospitality / service roles where tips supplement the rate." },
];

// Frontline invite methods \u2014 Joined Up parity. Email / SMS for known
// candidates; QR code + invite code for kiosk / in\u2011person sign\u2011up.
const FRONTLINE_INVITE_METHODS = [
  { id: "email",       label: "Email link",      hint: "Standard invite with a click\u2011through to the worker app." },
  { id: "sms",         label: "SMS link",        hint: "Texted to a phone with an app\u2011store fallback." },
  { id: "code",        label: "6\u2011digit code", hint: "Worker enters the code on first app launch." },
  { id: "qr",          label: "QR code",         hint: "Print at the site \u2014 worker scans on arrival." },
];

// ---------- Tiny shared building blocks -------------------------------
function ProFormField({ label, hint, children, span = 1 }) {
  return (
    <label className="pro-field" style={span === 2 ? { gridColumn: "span 2" } : undefined}>
      <span className="pro-field-label">{label}</span>
      {hint && <span className="pro-field-hint">{hint}</span>}
      {children}
    </label>
  );
}

function ProTextInput({ value, onChange, placeholder, type = "text" }) {
  return (
    <input
      type={type}
      className="pro-input"
      value={value == null ? "" : value}
      onChange={(e) => onChange(type === "number"
        ? (e.target.value === "" ? "" : Number(e.target.value))
        : e.target.value)}
      placeholder={placeholder}
    />
  );
}

function ProDropdown({ value, onChange, options }) {
  return (
    <select className="pro-select" value={value} onChange={(e) => onChange(e.target.value)}>
      {options.map((o) => (typeof o === "string"
        ? <option key={o} value={o}>{o}</option>
        : <option key={o.id || o.c} value={o.id || o.c}>{o.label || o.name}</option>))}
    </select>
  );
}

function ProStepper({ steps, current }) {
  return (
    <ol className="pro-step-list" aria-label="Onboarding steps">
      {steps.map((s, i) => {
        const state = i < current ? "done" : i === current ? "active" : "future";
        return (
          <li key={s.id} className={`pro-step pro-step--${state}`}>
            <span className="pro-step-num tabular">{i < current ? "✓" : i + 1}</span>
            <span className="pro-step-label">{s.label}</span>
          </li>
        );
      })}
    </ol>
  );
}

// ---------- Onboarding step bodies ------------------------------------
function ProStepEngagement({ data, set }) {
  const isFrontline = data.workerType === "frontline";
  return (
    <div className="pro-form pro-form-grid">
      {isFrontline && (
        <ProFormField label="Invite method" hint="Joined Up parity. Email / SMS for known candidates; QR for kiosk / on\u2011site sign\u2011up." span={2}>
          <div className="pro-radio-group" role="radiogroup">
            {FRONTLINE_INVITE_METHODS.map((m) => (
              <button key={m.id} type="button" role="radio"
                aria-checked={data.inviteMethod === m.id}
                className={"pro-radio" + (data.inviteMethod === m.id ? " is-on" : "")}
                onClick={() => set("inviteMethod", m.id)}>
                <span className="pro-radio-label">{m.label}</span>
                <span className="pro-radio-sub">{m.hint}</span>
              </button>
            ))}
          </div>
        </ProFormField>
      )}
      <ProFormField label="Full name">
        <ProTextInput value={data.name} onChange={(v) => set("name", v)} placeholder={isFrontline ? "Marcus Webb" : "Helena Voss"} />
      </ProFormField>
      <ProFormField label={isFrontline && (data.inviteMethod === "sms" || data.inviteMethod === "qr" || data.inviteMethod === "code") ? "Phone" : "Email"}>
        <ProTextInput value={data.email} onChange={(v) => set("email", v)} type={isFrontline && (data.inviteMethod === "sms" || data.inviteMethod === "qr" || data.inviteMethod === "code") ? "tel" : "email"} placeholder={isFrontline && (data.inviteMethod === "sms" || data.inviteMethod === "qr" || data.inviteMethod === "code") ? "+1 (555) 555-0142" : "name@example.com"} />
      </ProFormField>

      <ProFormField label="Country of work" hint="Drives tax + comp rules.">
        <div className="pro-country-input">
          <span className={`fi fi-${(data.countryFlag || "us")} pro-country-flag`} aria-hidden="true"></span>
          <ProDropdown
            value={data.country}
            onChange={(v) => {
              const opt = PRO_COUNTRIES.find((x) => x.c === v) || PRO_COUNTRIES[0];
              set("country", v);
              set("countryFlag", opt.flag);
            }}
            options={PRO_COUNTRIES}
          />
        </div>
      </ProFormField>

      <ProFormField label={isFrontline ? "Job / role" : "Role"}>
        <ProTextInput value={data.role} onChange={(v) => set("role", v)} placeholder={isFrontline ? "Production Associate" : "Senior Product Manager"} />
      </ProFormField>

      <ProFormField label={isFrontline ? "Site manager" : "Hiring manager"}>
        <ProTextInput value={data.hiringManager} onChange={(v) => set("hiringManager", v)} placeholder="Amy Hennen" />
      </ProFormField>

      {!isFrontline && (
        <ProFormField label="Source" hint="Direct hires sign the agreement with Dayforce; supplier-sourced flow through the supplier MSA.">
          <ProDropdown value={data.supplier} onChange={(v) => set("supplier", v)} options={PRO_SUPPLIERS_FOR_PRO} />
        </ProFormField>
      )}
      {isFrontline && (
        <ProFormField label="Pool" hint="Direct\u2011sourced Frontline only. Internal employees, float pool, per\u2011diem, or alumni re\u2011activation.">
          <ProDropdown value={data.pool || "Internal"} onChange={(v) => set("pool", v)} options={[
            { id: "Internal", label: "Internal" },
            { id: "Float",    label: "Float pool" },
            { id: "Per-diem", label: "Per-diem" },
            { id: "Alumni",   label: "Alumni" },
          ]} />
        </ProFormField>
      )}

      <ProFormField label={isFrontline ? "Start date" : "Term start"}>
        <ProTextInput value={data.termStart} onChange={(v) => set("termStart", v)} type="date" />
      </ProFormField>

      <ProFormField label="Engagement type" hint={isFrontline ? "Direct\u2011sourced Frontline workers are shift\u2011based by default." : "Professional engagements are permanent \u2014 no end date by default."}>
        <input className="pro-input pro-input--readonly" value={isFrontline ? "Shift \u00b7 hourly" : "Permanent \u00b7 no end date"} readOnly />
      </ProFormField>
    </div>
  );
}

function ProStepCompensation({ data, set }) {
  const isFrontline = data.workerType === "frontline";
  // Frontline mode \u2014 hourly rate + classification only. No cadence,
  // no SOW template. The fields downstream (annual value, timesheet
  // mode) collapse to a single hourly\u2011rate display.
  if (isFrontline) {
    const hourly = Number(data.rateAmount) || 0;
    return (
      <div className="pro-form pro-form-grid">
        <ProFormField label="Classification" hint="Drives time capture + overtime eligibility." span={2}>
          <div className="pro-radio-group" role="radiogroup">
            {FRONTLINE_CLASSIFICATIONS.map((c) => (
              <button key={c.id} type="button" role="radio"
                aria-checked={data.classification === c.id}
                className={"pro-radio" + (data.classification === c.id ? " is-on" : "")}
                onClick={() => set("classification", c.id)}>
                <span className="pro-radio-label">{c.label}</span>
                <span className="pro-radio-sub">{c.hint}</span>
              </button>
            ))}
          </div>
        </ProFormField>
        <ProFormField label="Hourly rate" hint={`Pay rate in ${data.currency} per hour.`}>
          <ProTextInput value={data.rateAmount} onChange={(v) => set("rateAmount", v)} type="number" placeholder="22" />
        </ProFormField>
        <ProFormField label="Currency">
          <ProDropdown value={data.currency} onChange={(v) => set("currency", v)} options={["USD","EUR","GBP","CAD","AUD","MXN"]} />
        </ProFormField>
        <ProFormField label="Est. weekly value" hint="Assumes 40h/week. Overtime not modelled at intake.">
          <input className="pro-input pro-input--readonly tabular" value={hourly ? `${data.currency} ${(hourly * 40).toLocaleString("en-US")}` : "\u2014"} readOnly />
        </ProFormField>
        <ProFormField label="Time capture" hint="Frontline direct workers clock in/out via the worker mobile app.">
          <input className="pro-input pro-input--readonly" value="Clock in / out" readOnly />
        </ProFormField>
      </div>
    );
  }
  const cadence = PRO_CADENCE.find((c) => c.id === data.cadence) || PRO_CADENCE[1];
  const annual = (() => {
    const n = Number(data.rateAmount);
    if (!n) return null;
    if (data.cadence === "weekly")  return n * 52;
    if (data.cadence === "monthly") return n * 12;
    return n;
  })();
  return (
    <div className="pro-form pro-form-grid">
      <ProFormField label="Cadence" hint="Billing frequency. Invoices generate automatically on this cadence." span={2}>
        <div className="pro-radio-group" role="radiogroup">
          {PRO_CADENCE.map((opt) => (
            <button
              key={opt.id}
              type="button"
              role="radio"
              aria-checked={data.cadence === opt.id}
              className={"pro-radio" + (data.cadence === opt.id ? " is-on" : "")}
              onClick={() => set("cadence", opt.id)}
            >
              <span className="pro-radio-label">{opt.label}</span>
              <span className="pro-radio-sub">per {opt.unit}</span>
            </button>
          ))}
        </div>
      </ProFormField>

      <ProFormField label="Rate amount" hint={`Per ${cadence.unit}, in ${data.currency}.`}>
        <ProTextInput value={data.rateAmount} onChange={(v) => set("rateAmount", v)} type="number" placeholder="18500" />
      </ProFormField>

      <ProFormField label="Currency">
        <ProDropdown value={data.currency} onChange={(v) => set("currency", v)} options={["USD","EUR","GBP","CAD","AUD","BRL","MXN","INR","SGD","JPY"]} />
      </ProFormField>

      <ProFormField label="Est. annual value">
        <input
          className="pro-input pro-input--readonly tabular"
          value={annual ? `${data.currency} ${annual.toLocaleString("en-US")}` : "—"}
          readOnly
        />
      </ProFormField>

      <ProFormField label="Timesheet mode" hint="Whether the worker logs effort hours.">
        <ProDropdown
          value={data.timesheetMode}
          onChange={(v) => set("timesheetMode", v)}
          options={[
            { id: "none",     label: "Not required (deliverable-based)" },
            { id: "required", label: "Required (effort log, no billing impact)" },
          ]}
        />
      </ProFormField>

      <ProFormField label="SOW template" span={2}>
        <ProDropdown
          value={data.sowTemplate}
          onChange={(v) => set("sowTemplate", v)}
          options={[
            "MSA + SOW template · Permanent",
            "MSA + SOW template · 12-month renewable",
            "MSA + SOW template · Fixed-fee project",
            "MSA + SOW template · T&M capped",
          ]}
        />
      </ProFormField>
    </div>
  );
}

const PRO_TASKS = [
  { id: "msa",      label: "Master Services Agreement",            help: "Counter-sign against the supplier or direct MSA on file."  },
  { id: "sow",      label: "Statement of Work",                    help: "Generate from the chosen template; auto-fills cadence + rate." },
  { id: "nda",      label: "Mutual NDA",                           help: "Standard NDA boilerplate."                                  },
  { id: "ip",       label: "IP assignment",                        help: "Required for engineering / design / strategy work."         },
  { id: "bgCheck",  label: "Background check",                     help: "Tier 1 by default — bumps to Tier 2 for finance/legal."     },
  { id: "benefits", label: "Benefits enrollment (Dayforce HCM)",   help: "Only for engagements eligible under tenant benefits policy." },
  { id: "laptop",   label: "Hardware provisioning",                help: "Order a laptop + accessories from the supplier-of-record."   },
  { id: "accounts", label: "System access (IdP, email, tooling)",  help: "Auto-provisioned via Dayforce → Okta on counter-sign."      },
];

function ProStepTasks({ data, set }) {
  const tasks = data.tasks || {};
  // Frontline mode \u2014 read the task catalog from Settings\u2192Lifecycle
  // via the per-job resolver so an admin override on this specific
  // role wins over the default Frontline template. Same for Pro.
  const isFrontline = data.workerType === "frontline";
  const category = isFrontline ? "frontline" : "professional";
  const catalog = (window.getOnboardingTasksForJob && data.role)
    ? window.getOnboardingTasksForJob(data.role, category)
    : isFrontline
      ? (window.getOnboardingTasks ? window.getOnboardingTasks("frontline") : [])
      : PRO_TASKS;
  const list = catalog.map((t) => ({ id: t.id, label: t.label, help: t.desc || t.help }));
  const toggle = (id) => {
    const next = { ...tasks, [id]: !tasks[id] };
    set("tasks", next);
  };
  return (
    <div className="pro-form">
      <p className="pro-step-intro">
        {isFrontline
          ? "Joined Up parity \u2014 select the onboarding tasks Flex Work runs on this Frontline worker. Required items gate shift\u2011readiness; the catalog comes from Settings \u2192 Configuration \u2192 Frontline lifecycle."
          : "Select the onboarding tasks Flex Work should run for this engagement. Required items are pre-selected based on the chosen role and country."}
      </p>
      <ul className="pro-task-list" role="list">
        {list.map((t) => (
          <li key={t.id} className={"pro-task" + (tasks[t.id] !== false ? " is-on" : "")}>
            <button
              type="button"
              role="switch"
              aria-checked={tasks[t.id] !== false}
              className="pro-task-toggle"
              onClick={() => toggle(t.id)}
            >
              <span className="pro-task-check">
                {tasks[t.id] !== false ? <Icon name="Check" size={14} /> : null}
              </span>
              <span className="pro-task-body">
                <span className="pro-task-label">{t.label}</span>
                <span className="pro-task-help">{t.help}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ProStepReview({ data }) {
  const cadence = PRO_CADENCE.find((c) => c.id === data.cadence) || PRO_CADENCE[1];
  const annual = (() => {
    const n = Number(data.rateAmount);
    if (!n) return null;
    if (data.cadence === "weekly")  return n * 52;
    if (data.cadence === "monthly") return n * 12;
    return n;
  })();
  const sup = PRO_SUPPLIERS_FOR_PRO.find((s) => s.id === data.supplier) || PRO_SUPPLIERS_FOR_PRO[0];
  const taskCount = Object.values(data.tasks || {}).filter(Boolean).length;
  return (
    <div className="pro-form pro-review">
      <section className="pro-review-card">
        <h5 className="pro-review-h">Engagement</h5>
        <dl className="pwd-kv-grid">
          <div className="pwd-kv"><dt>Name</dt><dd>{data.name || "—"}</dd></div>
          <div className="pwd-kv"><dt>Email</dt><dd>{data.email || "—"}</dd></div>
          <div className="pwd-kv"><dt>Role</dt><dd>{data.role || "—"}</dd></div>
          <div className="pwd-kv"><dt>Hiring manager</dt><dd>{data.hiringManager || "—"}</dd></div>
          <div className="pwd-kv"><dt>Country</dt><dd>{(PRO_COUNTRIES.find((c) => c.c === data.country) || PRO_COUNTRIES[0]).name}</dd></div>
          <div className="pwd-kv"><dt>Source</dt><dd>{sup.label}</dd></div>
          <div className="pwd-kv"><dt>Term start</dt><dd className="tabular">{data.termStart || "—"}</dd></div>
          <div className="pwd-kv"><dt>Type</dt><dd>Permanent · no end date</dd></div>
        </dl>
      </section>

      <section className="pro-review-card">
        <h5 className="pro-review-h">Compensation</h5>
        <dl className="pwd-kv-grid">
          <div className="pwd-kv"><dt>Cadence</dt><dd><span className="pw-chip pw-chip--cadence">{cadence.label}</span></dd></div>
          <div className="pwd-kv"><dt>Rate</dt><dd className="tabular">{data.currency} {Number(data.rateAmount || 0).toLocaleString("en-US")} <span className="pwd-aside">/ {cadence.unit}</span></dd></div>
          <div className="pwd-kv"><dt>Annual value</dt><dd className="tabular">{annual ? `${data.currency} ${annual.toLocaleString("en-US")}` : "—"}</dd></div>
          <div className="pwd-kv"><dt>Timesheet mode</dt><dd>{data.timesheetMode === "required" ? "Required" : "Not required"}</dd></div>
          <div className="pwd-kv"><dt>SOW template</dt><dd>{data.sowTemplate}</dd></div>
        </dl>
      </section>

      <section className="pro-review-card">
        <h5 className="pro-review-h">Onboarding tasks</h5>
        <p className="pro-review-tasks-sub">{taskCount} task{taskCount === 1 ? "" : "s"} will run on counter-sign.</p>
        <ul className="pro-task-summary">
          {PRO_TASKS.filter((t) => data.tasks && data.tasks[t.id]).map((t) => (
            <li key={t.id}><Icon name="Check" size={12} />{t.label}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}

// ---------- Add panel -------------------------------------------------
function AddProfessionalPanel({ open, onClose, defaultWorkerType }) {
  const [step, setStep] = useStateProb(0);
  const [data, setData] = useStateProb(() => ({
    ...PRO_ONBOARD_DEFAULTS,
    workerType: defaultWorkerType || PRO_ONBOARD_DEFAULTS.workerType,
    inviteMethod: "email",
    classification: "w2_hourly",
  }));
  const set = (key, val) => setData((p) => ({ ...p, [key]: val }));
  useEffectProb(() => {
    if (!open) {
      setStep(0);
      setData({
        ...PRO_ONBOARD_DEFAULTS,
        workerType: defaultWorkerType || PRO_ONBOARD_DEFAULTS.workerType,
        inviteMethod: "email",
        classification: "w2_hourly",
      });
    }
  }, [open, defaultWorkerType]);

  const isFrontline = data.workerType === "frontline";
  const last = step === PRO_STEPS.length - 1;
  const next = () => last
    ? (() => {
        showToast(`Invite sent to ${data.name || (isFrontline ? "new Frontline worker" : "new professional")}`, { kind: "success" });
        onClose();
      })()
    : setStep((s) => s + 1);
  const back = () => step === 0 ? onClose() : setStep((s) => s - 1);

  if (!open) return null;

  return (
    <SidePanel
      open={open}
      onClose={onClose}
      title={isFrontline ? "Invite Frontline worker" : "Add Professional"}
      subtitle={isFrontline ? "Direct\u2011sourced \u00b7 Joined Up parity" : "Permanent SOW engagement"}
      ariaLabel={isFrontline ? "Invite Frontline worker" : "Add professional"}
      width={720}
    >
      <div className="pro-onboard">
        {/* Worker\u2011type segmented control \u2014 visible only when the
            Frontline direct\u2011sourcing flag is on, so the existing
            Add Professional flow stays byte\u2011identical when off. */}
        {(window.useFeatureFlag && window.useFeatureFlag("frontlineDirect")) && (
          <div className="pro-radio-group" role="radiogroup" aria-label="Worker type">
            <button type="button" role="radio" aria-checked={!isFrontline}
              className={"pro-radio pro-radio--wide" + (!isFrontline ? " is-on" : "")}
              onClick={() => set("workerType", "professional")}>
              <span className="pro-radio-label">Professional</span>
              <span className="pro-radio-sub">Fieldglass + VNDLY parity \u00b7 permanent engagement</span>
            </button>
            <button type="button" role="radio" aria-checked={isFrontline}
              className={"pro-radio pro-radio--wide" + (isFrontline ? " is-on" : "")}
              onClick={() => set("workerType", "frontline")}>
              <span className="pro-radio-label">Frontline (direct)</span>
              <span className="pro-radio-sub">Joined Up parity \u00b7 invite code \u00b7 shift\u2011ready in days</span>
            </button>
          </div>
        )}
        <ProStepper steps={PRO_STEPS} current={step} />
        <div className="pro-onboard-body">
          {step === 0 && <ProStepEngagement   data={data} set={set} />}
          {step === 1 && <ProStepCompensation data={data} set={set} />}
          {step === 2 && <ProStepTasks        data={data} set={set} />}
          {step === 3 && <ProStepReview       data={data} />}
        </div>
        <footer className="pro-onboard-actions">
          <button type="button" className="btn btn--md btn--secondary" onClick={back}>
            <Icon name="ChevronLeft" size={14} />{step === 0 ? "Cancel" : "Back"}
          </button>
          <span className="pro-onboard-step-of">Step {step + 1} of {PRO_STEPS.length}</span>
          <button type="button" className="btn btn--md btn--primary" onClick={next}>
            {last ? "Send invite" : "Continue"}
            {!last && <Icon name="ChevronRight" size={14} />}
          </button>
        </footer>
      </div>
    </SidePanel>
  );
}

function AddProfessionalPanelHost() {
  const [state, setState] = useStateProb({ open: false, workerType: "professional" });
  useEffectProb(() => Interactions.on("addProfessional", (p) => setState({ open: true, workerType: (p && p.workerType) || "professional" })), []);
  return <AddProfessionalPanel open={state.open} onClose={() => setState({ open: false, workerType: "professional" })} defaultWorkerType={state.workerType} />;
}

function openAddProfessional() { Interactions.emit("addProfessional", { workerType: "professional" }); }
function openAddFrontline()    { Interactions.emit("addProfessional", { workerType: "frontline"   }); }

// ---------- Renewal panel ---------------------------------------------
function RenewProfessionalPanel({ worker, open, onClose }) {
  const initialRate = worker ? worker.rateAmount : 0;
  const [form, setForm] = useStateProb({
    decision: "renew", // "renew" | "amend" | "notNotice"
    termMonths: 12,
    newRate: initialRate,
    cadence: worker ? worker.cadence : "monthly",
    notes: "",
  });
  useEffectProb(() => {
    if (open && worker) {
      setForm({
        decision: "renew",
        termMonths: 12,
        newRate: worker.rateAmount,
        cadence: worker.cadence,
        notes: "",
      });
    }
  }, [open, worker]);
  if (!open || !worker) return null;

  const set = (key, val) => setForm((p) => ({ ...p, [key]: val }));
  const pctChange = initialRate ? Math.round(((Number(form.newRate) - initialRate) / initialRate) * 100) : 0;
  const cadenceLabel = (window.profCadenceLabel ? window.profCadenceLabel(form.cadence) : form.cadence);
  const moneyFmt = (n) => (window.profFmtMoney ? window.profFmtMoney(n, worker.currency) : `${worker.currency} ${n}`);

  const send = () => {
    if (form.decision === "notNotice") {
      showToast(`Non-renewal notice sent for ${worker.name}`, { kind: "success" });
    } else {
      showToast(`${form.decision === "renew" ? "Renewal" : "Amendment"} for ${worker.name} sent for approval`, { kind: "success" });
    }
    onClose();
  };

  return (
    <SidePanel
      open={open}
      onClose={onClose}
      title={`Renew · ${worker.name}`}
      subtitle={`${worker.sowRef} · ${cadenceLabel} cadence`}
      ariaLabel={`Renew engagement for ${worker.name}`}
      width={560}
    >
      <div className="pro-renew-panel">
        <section className="pro-renew-current">
          <h5 className="pro-renew-h">Current engagement</h5>
          <dl className="pwd-kv-grid">
            <div className="pwd-kv"><dt>Cadence</dt><dd>{cadenceLabel}</dd></div>
            <div className="pwd-kv"><dt>Rate</dt><dd className="tabular">{moneyFmt(worker.rateAmount)}</dd></div>
            <div className="pwd-kv"><dt>Term start</dt><dd className="tabular">{worker.termStart}</dd></div>
            <div className="pwd-kv"><dt>Next renewal</dt><dd className="tabular">{worker.renewalDate}</dd></div>
            <div className="pwd-kv"><dt>YTD invoiced</dt><dd className="tabular">{moneyFmt(worker.ytdInvoiced)}</dd></div>
            <div className="pwd-kv"><dt>Hiring manager</dt><dd>{worker.hiringManager}</dd></div>
          </dl>
        </section>

        <section className="pro-renew-decision">
          <h5 className="pro-renew-h">Decision</h5>
          <div className="pro-renew-options" role="radiogroup">
            <button
              type="button"
              role="radio"
              aria-checked={form.decision === "renew"}
              className={"pro-renew-opt" + (form.decision === "renew" ? " is-on" : "")}
              onClick={() => set("decision", "renew")}
            >
              <span className="pro-renew-opt-h">
                <Icon name="Refresh" size={14} />Renew at current terms
              </span>
              <span className="pro-renew-opt-sub">Auto-renew for 12 months. No approval changes required.</span>
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={form.decision === "amend"}
              className={"pro-renew-opt" + (form.decision === "amend" ? " is-on" : "")}
              onClick={() => set("decision", "amend")}
            >
              <span className="pro-renew-opt-h">
                <Icon name="DocumentAdd" size={14} />Renew with amendment
              </span>
              <span className="pro-renew-opt-sub">Adjust rate, cadence, or term. Requires hiring manager + finance approval.</span>
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={form.decision === "notNotice"}
              className={"pro-renew-opt pro-renew-opt--danger" + (form.decision === "notNotice" ? " is-on" : "")}
              onClick={() => set("decision", "notNotice")}
            >
              <span className="pro-renew-opt-h">
                <Icon name="Cancel" size={14} />Send non-renewal notice
              </span>
              <span className="pro-renew-opt-sub">30-day written notice. Engagement ends at the current term.</span>
            </button>
          </div>
        </section>

        {form.decision === "amend" && (
          <section className="pro-renew-amend">
            <h5 className="pro-renew-h">Amendment</h5>
            <div className="pro-form-grid">
              <ProFormField label="New term length (months)">
                <ProTextInput value={form.termMonths} onChange={(v) => set("termMonths", v)} type="number" placeholder="12" />
              </ProFormField>
              <ProFormField label="New cadence">
                <ProDropdown value={form.cadence} onChange={(v) => set("cadence", v)} options={PRO_CADENCE} />
              </ProFormField>
              <ProFormField label={`New rate (${worker.currency})`} hint={`vs current ${moneyFmt(initialRate)}.`}>
                <ProTextInput value={form.newRate} onChange={(v) => set("newRate", v)} type="number" />
              </ProFormField>
              <ProFormField label="Rate change">
                <input
                  className={"pro-input pro-input--readonly tabular" + (pctChange > 0 ? " pro-pct-pos" : pctChange < 0 ? " pro-pct-neg" : "")}
                  value={pctChange === 0 ? "0%" : (pctChange > 0 ? "+" : "") + pctChange + "%"}
                  readOnly
                />
              </ProFormField>
            </div>
          </section>
        )}

        <section className="pro-renew-notes">
          <h5 className="pro-renew-h">Notes for approvers</h5>
          <textarea
            className="pro-textarea"
            rows={4}
            value={form.notes}
            onChange={(e) => set("notes", e.target.value)}
            placeholder="Performance highlights, retention rationale, or change-justification."
          />
        </section>

        <footer className="pro-onboard-actions">
          <button type="button" className="btn btn--md btn--secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn btn--md btn--primary" onClick={send}>
            {form.decision === "notNotice" ? "Send notice" : form.decision === "renew" ? "Confirm renewal" : "Send for approval"}
          </button>
        </footer>
      </div>
    </SidePanel>
  );
}

function RenewProfessionalPanelHost() {
  const [state, setState] = useStateProb({ open: false, worker: null });
  useEffectProb(() => Interactions.on("renewProfessional", (p) => setState({ open: true, worker: p && p.worker })), []);
  return (
    <RenewProfessionalPanel
      open={state.open}
      worker={state.worker}
      onClose={() => setState({ open: false, worker: null })}
    />
  );
}

function openRenewProfessional(worker) {
  Interactions.emit("renewProfessional", { worker });
}

Object.assign(window, {
  AddProfessionalPanel,
  AddProfessionalPanelHost,
  openAddProfessional,
  openAddFrontline,
  RenewProfessionalPanel,
  RenewProfessionalPanelHost,
  openRenewProfessional,
});
