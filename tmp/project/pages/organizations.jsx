// =====================================================================
// Flex Work — Organizations (Settings · Organizations)
//   Systems Admin surface. Available ONLY inside the Dayforce platform
//   org (see pages/industry.jsx · isPlatformOrg + the orgOnly gate on
//   the Settings section). Lets a Systems Admin:
//     · See every organization Dayforce manages (platform + customer
//       tenants, plus any created here).
//     · Stand up a NEW organization — configure all its base settings
//       across a short wizard — and create it. New orgs merge into the
//       live INDUSTRIES registry so they appear in the org switcher and
//       can be switched into immediately.
//     · Manage an existing org — review base settings, suspend /
//       reactivate, or switch into it.
//
//   New-org records persist to localStorage (`flexwork.organizations`)
//   and are merged into window.INDUSTRIES / INDUSTRY_ORDER at load so
//   the rest of the app (chrome org switcher, getIndustry, settings)
//   resolves them like any seeded tenant.
// =====================================================================

const { useState: useOState, useMemo: useOMemo, useEffect: useOEffect, useRef: useORef } = React;

// ---------- Persistent store of created organizations ------------------
const ORG_STORE_KEY = "flexwork.organizations";

function org_readStore() {
  try {
    const raw = window.localStorage.getItem(ORG_STORE_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch (e) { return []; }
}
function org_writeStore(arr) {
  try { window.localStorage.setItem(ORG_STORE_KEY, JSON.stringify(arr)); } catch (e) {}
}

// Merge every created org into the live INDUSTRIES registry + ordering
// so the org switcher and getIndustry() resolve it. Idempotent — runs at
// module load and again after each create.
function org_mergeIntoIndustries() {
  if (!window.INDUSTRIES || !window.INDUSTRY_ORDER) return;
  org_readStore().forEach((rec) => {
    if (!window.INDUSTRIES[rec.id]) {
      window.INDUSTRIES[rec.id] = {
        id:       rec.id,
        name:     rec.name,
        tag:      rec.tag || rec.sector || "Organization",
        kind:     "tenant",
        logo:     rec.logo || "assets/org-manufacturing.svg",
        accent:   rec.accent || "#3067DB",
        localize: {},
        created:  true,
      };
    }
    if (!window.INDUSTRY_ORDER.includes(rec.id)) window.INDUSTRY_ORDER.push(rec.id);
  });
}
org_mergeIntoIndustries();

// ---------- Catalog data for the create wizard -------------------------
const ORG_SECTORS = [
  "Manufacturing", "Hospitality", "Retail", "Healthcare",
  "Logistics", "Energy", "Financial Services", "Technology",
  "Public Sector", "Education", "Staffing agency",
];
const ORG_TYPES = ["Corporation", "LLC", "Partnership", "Non-profit", "Public sector", "Subsidiary"];
const ORG_PLANS = [
  { id: "essentials", label: "Essentials",  seats: "Up to 250 users",   note: "Core VMS + scheduling" },
  { id: "growth",     label: "Growth",      seats: "Up to 1,500 users", note: "Adds analytics + workflows" },
  { id: "enterprise", label: "Enterprise",  seats: "Unlimited users",   note: "All modules + MSP + SSO" },
];
const ORG_ACCENTS = [
  { id: "#3067DB", name: "Dayforce blue" },
  { id: "#1F8A5B", name: "Green" },
  { id: "#7C3AED", name: "Purple" },
  { id: "#C2410C", name: "Amber" },
  { id: "#0F766E", name: "Teal" },
  { id: "#B91C1C", name: "Red" },
];
const ORG_ENGAGEMENT_TYPES = [
  { id: "shift",      label: "Shift",              caption: "Hourly frontline bookings", always: true },
  { id: "assignment", label: "Assignment",         caption: "Multi-week contingent roles" },
  { id: "project",    label: "Project",            caption: "Outcome / phase-based work" },
  { id: "sow",        label: "Statement of Work",  caption: "Milestone & T&M deliverables" },
];
const ORG_SUPPLIER_TYPES = [
  { id: "agency", label: "Staffing agencies", caption: "Markup-based supply", always: true },
  { id: "ic",     label: "Independent contractors", caption: "Direct 1099 / self-serve" },
  { id: "eor",    label: "Employer of record", caption: "Compliant local employment" },
];
const ORG_MODULES = [
  { id: "scheduling", label: "Scheduling",  always: true },
  { id: "timesheets", label: "Timesheets",  always: true },
  { id: "invoices",   label: "Invoices & pay" },
  { id: "analytics",  label: "Analytics" },
  { id: "workflows",  label: "Workflows" },
  { id: "budgets",    label: "Budgets" },
];

// ---------- Seed metadata for the orgs already in the registry ---------
// Surfaces realistic figures in the list for tenants that ship with the
// demo. Created orgs carry their own metadata on the stored record.
const ORG_SEED_META = {
  dayforce:      { status: "Platform", region: "Global",         users: 12,   sites: "—",  plan: "Platform",   created: "Aug 14, 2024" },
  manufacturing: { status: "Active",   region: "United States",  users: 184,  sites: 42,   plan: "Enterprise", created: "Aug 14, 2024" },
  hospitality:   { status: "Active",   region: "United States",  users: 96,   sites: 28,   plan: "Growth",     created: "Sep 02, 2024" },
  retail:        { status: "Active",   region: "United States",  users: 142,  sites: 63,   plan: "Enterprise", created: "Sep 18, 2024" },
  healthcare:    { status: "Active",   region: "United States",  users: 118,  sites: 31,   plan: "Enterprise", created: "Oct 07, 2024" },
  logistics:     { status: "Active",   region: "United States",  users: 77,   sites: 24,   plan: "Growth",     created: "Nov 21, 2024" },
  energy:        { status: "Active",   region: "United States",  users: 64,   sites: 18,   plan: "Enterprise", created: "Jan 09, 2026" },
  staffwise:     { status: "Active",   region: "United States",  users: 31,   sites: "—",  plan: "Growth",     created: "Feb 02, 2026" },
};

// Build the full registry the page renders from: base INDUSTRIES (with
// seed metadata) + created orgs (with their stored metadata).
function org_registry() {
  const order = window.INDUSTRY_ORDER || [];
  const inds  = window.INDUSTRIES || {};
  const created = {};
  org_readStore().forEach((r) => { created[r.id] = r; });
  return order.map((id) => {
    const ind = inds[id];
    if (!ind) return null;
    const c = created[id];
    const meta = c || ORG_SEED_META[id] || {};
    return {
      id,
      name: ind.name,
      tag: ind.tag,
      kind: ind.kind || "tenant",
      accent: ind.accent || "#3067DB",
      sector: c ? c.sector : ind.tag,
      status: meta.status || "Active",
      region: meta.region || "United States",
      currency: c ? c.currency : "USD",
      users: meta.users != null ? meta.users : 0,
      sites: meta.sites != null ? meta.sites : "—",
      plan: meta.plan || "Growth",
      created: meta.created || "—",
      adminName: c ? c.adminName : null,
      adminEmail: c ? c.adminEmail : null,
      engagementTypes: c ? c.engagementTypes : null,
      supplierTypes: c ? c.supplierTypes : null,
      modules: c ? c.modules : null,
      orgType: c ? c.orgType : "Corporation",
      legalName: c ? c.legalName : ind.name,
      isCreated: !!c,
    };
  }).filter(Boolean);
}

// Create a new org from a wizard config: slug the id, persist, merge.
function org_create(cfg) {
  const base = (cfg.name || "org").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 24) || "org";
  let id = base; let n = 2;
  while (window.INDUSTRIES && window.INDUSTRIES[id]) { id = `${base}-${n++}`; }
  const rec = {
    id,
    name: cfg.name.trim(),
    legalName: (cfg.legalName || cfg.name).trim(),
    tag: cfg.sector || "Organization",
    sector: cfg.sector || "Organization",
    orgType: cfg.orgType || "Corporation",
    taxId: cfg.taxId || "",
    hqAddress: cfg.hqAddress || "",
    region: cfg.region || "United States",
    currency: cfg.currency || "USD",
    locale: cfg.locale || "en-US",
    timezone: cfg.timezone || "America/Toronto",
    accent: cfg.accent || "#3067DB",
    logo: "assets/org-manufacturing.svg",
    engagementTypes: cfg.engagementTypes || ["shift"],
    supplierTypes: cfg.supplierTypes || ["agency"],
    modules: cfg.modules || ["scheduling", "timesheets"],
    adminName: (cfg.adminName || "").trim(),
    adminEmail: (cfg.adminEmail || "").trim(),
    plan: (ORG_PLANS.find((p) => p.id === cfg.plan) || ORG_PLANS[1]).label,
    status: "Active",
    users: 1,
    sites: 0,
    created: new Date().toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" }),
  };
  const next = [...org_readStore(), rec];
  org_writeStore(next);
  org_mergeIntoIndustries();
  return rec;
}

function org_setStatus(id, status) {
  const next = org_readStore().map((r) => (r.id === id ? { ...r, status } : r));
  org_writeStore(next);
}

// =====================================================================
// Small shared bits
// =====================================================================
function OrgMark({ org, size = 38 }) {
  const initials = (org.name || "?").split(/\s+/).map((p) => p[0] || "").join("").slice(0, 2).toUpperCase();
  return (
    <span className="org-mark" style={{ width: size, height: size, fontSize: Math.round(size * 0.36),
            background: org.accent, color: "#fff" }} aria-hidden="true">
      {org.kind === "platform" ? <Icon name="ShieldPerson" size={Math.round(size * 0.5)} /> : initials}
    </span>
  );
}

function OrgStatusPill({ status }) {
  const map = {
    Active:    { cls: "is-active",    icon: "Check" },
    Suspended: { cls: "is-suspended", icon: "Lock" },
    Platform:  { cls: "is-platform",  icon: "ShieldPerson" },
    Draft:     { cls: "is-draft",     icon: "Edit" },
  };
  const m = map[status] || map.Active;
  return (
    <span className={`org-status ${m.cls}`}>
      <Icon name={m.icon} size={12} /> {status}
    </span>
  );
}

// =====================================================================
// CREATE WIZARD
// =====================================================================
const ORG_STEPS = [
  { id: "profile", label: "Profile",     icon: "Building" },
  { id: "region",  label: "Region",      icon: "Globe" },
  { id: "brand",   label: "Branding",    icon: "Shapes" },
  { id: "program", label: "Program",     icon: "Adjustment" },
  { id: "access",  label: "Access",      icon: "ShieldPerson" },
  { id: "review",  label: "Review",      icon: "ClipboardCircleCheck" },
];

function OrgCreateWizard({ onCancel, onCreated }) {
  const [step, setStep] = useOState(0);
  const [done, setDone] = useOState(null); // created record once finished
  const [touchedName, setTouchedName] = useOState(false);

  const countries = useOMemo(() => {
    const by = window.COUNTRY_BY_CODE || {};
    const codes = window.PICKER_COUNTRIES || ["US", "CA", "GB", "DE", "AU", "JP"];
    return codes.map((c) => by[c]).filter(Boolean);
  }, []);

  const [form, setForm] = useOState({
    name: "", legalName: "", sector: "Manufacturing", orgType: "Corporation",
    taxId: "", hqAddress: "",
    countryCode: "US", region: "United States", currency: "USD",
    locale: "en-US", timezone: "America/Toronto",
    accent: "#3067DB",
    engagementTypes: ["shift"], supplierTypes: ["agency"],
    modules: ["scheduling", "timesheets", "invoices", "analytics"],
    adminName: "", adminEmail: "", plan: "growth",
  });
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const toggleIn = (key, id) => setForm((f) => {
    const has = f[key].includes(id);
    return { ...f, [key]: has ? f[key].filter((x) => x !== id) : [...f[key], id] };
  });

  const nameErr = !form.name.trim();
  const showNameErr = touchedName && nameErr;
  const emailErr = form.adminEmail.trim() && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.adminEmail.trim());

  const canAdvance = () => {
    if (ORG_STEPS[step].id === "profile") return !nameErr;
    if (ORG_STEPS[step].id === "access") return form.adminName.trim() && form.adminEmail.trim() && !emailErr;
    return true;
  };

  const next = () => setStep((s) => Math.min(s + 1, ORG_STEPS.length - 1));
  const back = () => setStep((s) => Math.max(s - 1, 0));

  const submit = () => {
    const rec = org_create(form);
    setDone(rec);
    if (window.showToast) window.showToast(`${rec.name} created`, { kind: "success" });
  };

  // ---------- Success state ----------
  if (done) {
    return (
      <div className="org-wizard">
        <div className="org-success">
          <div className="org-success-mark"><Icon name="Check" size={32} /></div>
          <h2 className="org-success-title">{done.name} is ready</h2>
          <p className="org-success-sub">
            The organization has been created and added to your tenant directory. You can switch
            into it now to finish onboarding, or return to the directory.
          </p>
          <dl className="org-success-grid">
            <div><dt>Organization ID</dt><dd>{done.id}</dd></div>
            <div><dt>Sector</dt><dd>{done.sector}</dd></div>
            <div><dt>Region</dt><dd>{done.region} · {done.currency}</dd></div>
            <div><dt>Plan</dt><dd>{done.plan}</dd></div>
            <div><dt>Primary admin</dt><dd>{done.adminName || "—"}</dd></div>
            <div><dt>Engagement types</dt><dd>{(done.engagementTypes || []).length}</dd></div>
          </dl>
          <div className="org-success-actions">
            <button type="button" className="org-btn org-btn--secondary" onClick={() => onCreated && onCreated(null)}>
              Back to organizations
            </button>
            <button type="button" className="org-btn org-btn--primary"
                    onClick={() => {
                      if (window.setCurrentIndustryId) window.setCurrentIndustryId(done.id);
                      if (window.showAppLoader) window.showAppLoader("Loading\u2026", `Switching to ${done.name}`);
                      setTimeout(() => { try { window.location.reload(); } catch (e) {} }, 250);
                    }}>
              <Icon name="ArrowRight" size={15} /> Switch to {done.name}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const cur = ORG_STEPS[step].id;

  return (
    <div className="org-wizard">
      <div className="org-wizard-head">
        <button type="button" className="org-back" onClick={onCancel}>
          <Icon name="ArrowLeft" size={16} /> Organizations
        </button>
        <div className="org-wizard-titlewrap">
          <h2 className="org-wizard-title">New organization</h2>
          <p className="org-wizard-sub">Configure the base settings for the new tenant. You can change everything later in its own settings.</p>
        </div>
      </div>

      <div className="org-wizard-body">
        {/* Step rail */}
        <ol className="org-steps" aria-label="Setup steps">
          {ORG_STEPS.map((s, i) => (
            <li key={s.id} className="org-step" data-state={i === step ? "current" : i < step ? "done" : "todo"}>
              <button type="button" className="org-step-btn" onClick={() => (i <= step ? setStep(i) : null)} disabled={i > step}>
                <span className="org-step-dot">{i < step ? <Icon name="Check" size={13} /> : i + 1}</span>
                <span className="org-step-label">{s.label}</span>
              </button>
            </li>
          ))}
        </ol>

        {/* Step content */}
        <div className="org-panel">
          {cur === "profile" && (
            <section className="org-form">
              <h3 className="org-form-title">Organization profile</h3>
              <div className="org-field">
                <label className="org-label" htmlFor="org-name">Organization name <span className="org-req">*</span></label>
                <input id="org-name" className={`org-input${showNameErr ? " is-error" : ""}`} value={form.name}
                       placeholder="e.g. Cascade Foods Group" onChange={(e) => set({ name: e.target.value })}
                       onBlur={() => setTouchedName(true)} />
                {showNameErr && <span className="org-hint org-hint--err">Enter a name for the organization.</span>}
              </div>
              <div className="org-field">
                <label className="org-label" htmlFor="org-legal">Legal entity name</label>
                <input id="org-legal" className="org-input" value={form.legalName}
                       placeholder="e.g. Cascade Foods Group, Inc." onChange={(e) => set({ legalName: e.target.value })} />
              </div>
              <div className="org-row">
                <div className="org-field">
                  <label className="org-label" htmlFor="org-sector">Sector</label>
                  <select id="org-sector" className="org-input" value={form.sector} onChange={(e) => set({ sector: e.target.value })}>
                    {ORG_SECTORS.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div className="org-field">
                  <label className="org-label" htmlFor="org-type">Organization type</label>
                  <select id="org-type" className="org-input" value={form.orgType} onChange={(e) => set({ orgType: e.target.value })}>
                    {ORG_TYPES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              <div className="org-row">
                <div className="org-field">
                  <label className="org-label" htmlFor="org-tax">Tax ID / EIN</label>
                  <input id="org-tax" className="org-input" value={form.taxId}
                         placeholder="82-4715293" onChange={(e) => set({ taxId: e.target.value })} />
                </div>
                <div className="org-field">
                  <label className="org-label" htmlFor="org-hq">Headquarters address</label>
                  <input id="org-hq" className="org-input" value={form.hqAddress}
                         placeholder="120 Main St, San Mateo, CA" onChange={(e) => set({ hqAddress: e.target.value })} />
                </div>
              </div>
            </section>
          )}

          {cur === "region" && (
            <section className="org-form">
              <h3 className="org-form-title">Region & currency</h3>
              <p className="org-form-sub">Sets the default country, currency, and locale every site and pay rate inherits.</p>
              <div className="org-field">
                <label className="org-label" htmlFor="org-country">Primary country</label>
                <select id="org-country" className="org-input" value={form.countryCode}
                        onChange={(e) => {
                          const c = (window.COUNTRY_BY_CODE || {})[e.target.value];
                          set({ countryCode: e.target.value, region: c ? c.name : "United States", currency: c ? c.currency : "USD" });
                        }}>
                  {countries.map((c) => <option key={c.code} value={c.code}>{c.name} · {c.currency}</option>)}
                </select>
              </div>
              <div className="org-row">
                <div className="org-field">
                  <label className="org-label" htmlFor="org-locale">Default locale</label>
                  <select id="org-locale" className="org-input" value={form.locale} onChange={(e) => set({ locale: e.target.value })}>
                    {["en-US", "en-CA", "en-GB", "fr-CA", "de-DE", "ja-JP", "es-MX"].map((l) => <option key={l} value={l}>{l}</option>)}
                  </select>
                </div>
                <div className="org-field">
                  <label className="org-label" htmlFor="org-tz">Default time zone</label>
                  <select id="org-tz" className="org-input" value={form.timezone} onChange={(e) => set({ timezone: e.target.value })}>
                    {["America/Toronto", "America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles", "Europe/London", "Asia/Tokyo"].map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>
              <div className="org-callout">
                <Icon name="Information" size={16} />
                <span>Currency is set to <strong>{form.currency}</strong> from the selected country. Pay and bill rates across this tenant will format in {form.currency}.</span>
              </div>
            </section>
          )}

          {cur === "brand" && (
            <section className="org-form">
              <h3 className="org-form-title">Branding</h3>
              <p className="org-form-sub">The accent color appears across the worker app, emails, and the org switcher.</p>
              <div className="org-field">
                <label className="org-label">Accent color</label>
                <div className="org-swatches">
                  {ORG_ACCENTS.map((a) => (
                    <button type="button" key={a.id}
                            className={`org-swatch${form.accent === a.id ? " is-on" : ""}`}
                            style={{ background: a.id }} title={a.name}
                            aria-pressed={form.accent === a.id}
                            onClick={() => set({ accent: a.id })}>
                      {form.accent === a.id && <Icon name="Check" size={16} />}
                    </button>
                  ))}
                </div>
              </div>
              <div className="org-field">
                <label className="org-label">Preview</label>
                <div className="org-brand-preview">
                  <OrgMark org={{ name: form.name || "New Org", accent: form.accent, kind: "tenant" }} size={44} />
                  <div>
                    <div className="org-brand-name">{form.name || "New organization"}</div>
                    <div className="org-brand-tag">{form.sector} · {form.region}</div>
                  </div>
                </div>
              </div>
            </section>
          )}

          {cur === "program" && (
            <section className="org-form">
              <h3 className="org-form-title">Program setup</h3>
              <p className="org-form-sub">Choose which engagement types, supplier types, and modules this tenant runs. Defaults match a standard frontline program.</p>

              <div className="org-field">
                <label className="org-label">Engagement types</label>
                <div className="org-checklist">
                  {ORG_ENGAGEMENT_TYPES.map((t) => {
                    const on = form.engagementTypes.includes(t.id);
                    return (
                      <button type="button" key={t.id} className={`org-check${on ? " is-on" : ""}${t.always ? " is-locked" : ""}`}
                              onClick={() => !t.always && toggleIn("engagementTypes", t.id)} aria-pressed={on}>
                        <span className="org-check-box">{on && <Icon name="Check" size={13} />}</span>
                        <span className="org-check-text">
                          <span className="org-check-label">{t.label}{t.always && <span className="org-tag-mini">Included</span>}</span>
                          <span className="org-check-cap">{t.caption}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="org-field">
                <label className="org-label">Supplier types</label>
                <div className="org-checklist">
                  {ORG_SUPPLIER_TYPES.map((t) => {
                    const on = form.supplierTypes.includes(t.id);
                    return (
                      <button type="button" key={t.id} className={`org-check${on ? " is-on" : ""}${t.always ? " is-locked" : ""}`}
                              onClick={() => !t.always && toggleIn("supplierTypes", t.id)} aria-pressed={on}>
                        <span className="org-check-box">{on && <Icon name="Check" size={13} />}</span>
                        <span className="org-check-text">
                          <span className="org-check-label">{t.label}{t.always && <span className="org-tag-mini">Included</span>}</span>
                          <span className="org-check-cap">{t.caption}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="org-field">
                <label className="org-label">Modules</label>
                <div className="org-pills">
                  {ORG_MODULES.map((m) => {
                    const on = form.modules.includes(m.id);
                    return (
                      <button type="button" key={m.id} className={`org-pill${on ? " is-on" : ""}${m.always ? " is-locked" : ""}`}
                              onClick={() => !m.always && toggleIn("modules", m.id)} aria-pressed={on}>
                        {on && <Icon name="Check" size={13} />} {m.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </section>
          )}

          {cur === "access" && (
            <section className="org-form">
              <h3 className="org-form-title">Admin & plan</h3>
              <p className="org-form-sub">Name the first administrator for this tenant. They receive an invite to finish setup.</p>
              <div className="org-row">
                <div className="org-field">
                  <label className="org-label" htmlFor="org-admin">Primary admin name <span className="org-req">*</span></label>
                  <input id="org-admin" className="org-input" value={form.adminName}
                         placeholder="e.g. Maya Chen" onChange={(e) => set({ adminName: e.target.value })} />
                </div>
                <div className="org-field">
                  <label className="org-label" htmlFor="org-email">Admin email <span className="org-req">*</span></label>
                  <input id="org-email" className={`org-input${emailErr ? " is-error" : ""}`} value={form.adminEmail}
                         placeholder="admin@company.com" onChange={(e) => set({ adminEmail: e.target.value })} />
                  {emailErr && <span className="org-hint org-hint--err">Enter a valid email address.</span>}
                </div>
              </div>
              <div className="org-field">
                <label className="org-label">Plan</label>
                <div className="org-plans">
                  {ORG_PLANS.map((p) => (
                    <button type="button" key={p.id} className={`org-plan${form.plan === p.id ? " is-on" : ""}`}
                            onClick={() => set({ plan: p.id })} aria-pressed={form.plan === p.id}>
                      <span className="org-plan-head">
                        <span className="org-plan-name">{p.label}</span>
                        <span className="org-plan-radio">{form.plan === p.id && <Icon name="Check" size={13} />}</span>
                      </span>
                      <span className="org-plan-seats">{p.seats}</span>
                      <span className="org-plan-note">{p.note}</span>
                    </button>
                  ))}
                </div>
              </div>
            </section>
          )}

          {cur === "review" && (
            <section className="org-form">
              <h3 className="org-form-title">Review & create</h3>
              <p className="org-form-sub">Confirm the base settings. Creating the organization adds it to your tenant directory and the org switcher.</p>
              <div className="org-review">
                <OrgReviewRow label="Organization" value={form.name || "—"} onEdit={() => setStep(0)} />
                <OrgReviewRow label="Legal entity" value={form.legalName || "—"} onEdit={() => setStep(0)} />
                <OrgReviewRow label="Sector · type" value={`${form.sector} · ${form.orgType}`} onEdit={() => setStep(0)} />
                <OrgReviewRow label="Region · currency" value={`${form.region} · ${form.currency}`} onEdit={() => setStep(1)} />
                <OrgReviewRow label="Locale · time zone" value={`${form.locale} · ${form.timezone}`} onEdit={() => setStep(1)} />
                <OrgReviewRow label="Engagement types"
                  value={form.engagementTypes.map((id) => (ORG_ENGAGEMENT_TYPES.find((t) => t.id === id) || {}).label).filter(Boolean).join(" · ")}
                  onEdit={() => setStep(3)} />
                <OrgReviewRow label="Supplier types"
                  value={form.supplierTypes.map((id) => (ORG_SUPPLIER_TYPES.find((t) => t.id === id) || {}).label).filter(Boolean).join(" · ")}
                  onEdit={() => setStep(3)} />
                <OrgReviewRow label="Modules" value={`${form.modules.length} enabled`} onEdit={() => setStep(3)} />
                <OrgReviewRow label="Primary admin" value={form.adminName ? `${form.adminName} · ${form.adminEmail}` : "—"} onEdit={() => setStep(4)} />
                <OrgReviewRow label="Plan" value={(ORG_PLANS.find((p) => p.id === form.plan) || {}).label} onEdit={() => setStep(4)} />
              </div>
            </section>
          )}
        </div>
      </div>

      {/* Footer nav */}
      <footer className="org-wizard-footer">
        <button type="button" className="org-btn org-btn--ghost" onClick={onCancel}>Cancel</button>
        <div className="org-wizard-footer-right">
          {step > 0 && (
            <button type="button" className="org-btn org-btn--secondary" onClick={back}>
              <Icon name="ChevronLeft" size={15} /> Back
            </button>
          )}
          {cur !== "review" ? (
            <button type="button" className="org-btn org-btn--primary" disabled={!canAdvance()} onClick={next}>
              Continue <Icon name="ChevronRight" size={15} />
            </button>
          ) : (
            <button type="button" className="org-btn org-btn--primary" onClick={submit}>
              <Icon name="AddCircle" size={16} /> Create organization
            </button>
          )}
        </div>
      </footer>
    </div>
  );
}

function OrgReviewRow({ label, value, onEdit }) {
  return (
    <div className="org-review-row">
      <span className="org-review-label">{label}</span>
      <span className="org-review-value">{value || "—"}</span>
      <button type="button" className="org-review-edit" onClick={onEdit}>Edit</button>
    </div>
  );
}

// =====================================================================
// MANAGE PANEL (existing org)
// =====================================================================
function OrgManagePanel({ org, onClose, onChanged }) {
  useOEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose && onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const isPlatform = org.kind === "platform";
  const isCurrent = (window.getCurrentIndustryId && window.getCurrentIndustryId()) === org.id;

  const switchTo = () => {
    if (isCurrent) { onClose && onClose(); return; }
    if (window.setCurrentIndustryId) window.setCurrentIndustryId(org.id);
    if (window.showAppLoader) window.showAppLoader("Loading\u2026", `Switching to ${org.name}`);
    setTimeout(() => { try { window.location.reload(); } catch (e) {} }, 250);
  };

  const toggleSuspend = () => {
    const next = org.status === "Suspended" ? "Active" : "Suspended";
    org_setStatus(org.id, next);
    if (window.showToast) window.showToast(`${org.name} ${next === "Suspended" ? "suspended" : "reactivated"}`, { kind: "success" });
    onChanged && onChanged();
    onClose && onClose();
  };

  return (
    <React.Fragment>
      <div className="org-scrim" onClick={onClose} />
      <aside className="org-panel-side" role="dialog" aria-label={`Manage ${org.name}`}>
        <header className="org-panel-side-head">
          <div className="org-panel-side-id">
            <OrgMark org={org} size={44} />
            <div>
              <div className="org-panel-side-titlerow">
                <h2 className="org-panel-side-title">{org.name}</h2>
                <OrgStatusPill status={org.status} />
              </div>
              <p className="org-panel-side-sub">{org.sector} · {org.region} · {org.currency}</p>
            </div>
          </div>
          <button type="button" className="org-icon-btn" aria-label="Close" onClick={onClose}><Icon name="X" size={18} /></button>
        </header>

        <div className="org-panel-side-body">
          <div className="org-detail-stats">
            <div className="org-detail-stat"><span className="org-detail-stat-label">Plan</span><span className="org-detail-stat-value">{org.plan}</span></div>
            <div className="org-detail-stat"><span className="org-detail-stat-label">Users</span><span className="org-detail-stat-value">{org.users}</span></div>
            <div className="org-detail-stat"><span className="org-detail-stat-label">Sites</span><span className="org-detail-stat-value">{org.sites}</span></div>
            <div className="org-detail-stat"><span className="org-detail-stat-label">Created</span><span className="org-detail-stat-value org-detail-stat-value--sm">{org.created}</span></div>
          </div>

          <section className="org-detail-section">
            <h3 className="org-detail-section-title">Base settings</h3>
            <dl className="org-detail-dl">
              <div><dt>Legal entity</dt><dd>{org.legalName}</dd></div>
              <div><dt>Organization type</dt><dd>{org.orgType}</dd></div>
              <div><dt>Organization ID</dt><dd>{org.id}</dd></div>
              <div><dt>Region · currency</dt><dd>{org.region} · {org.currency}</dd></div>
              {org.adminEmail && <div><dt>Primary admin</dt><dd>{org.adminName} · {org.adminEmail}</dd></div>}
            </dl>
          </section>

          {(org.engagementTypes || org.supplierTypes) && (
            <section className="org-detail-section">
              <h3 className="org-detail-section-title">Program</h3>
              <div className="org-detail-chips">
                {(org.engagementTypes || []).map((id) => {
                  const t = ORG_ENGAGEMENT_TYPES.find((x) => x.id === id);
                  return t ? <span key={id} className="org-detail-chip">{t.label}</span> : null;
                })}
                {(org.supplierTypes || []).map((id) => {
                  const t = ORG_SUPPLIER_TYPES.find((x) => x.id === id);
                  return t ? <span key={id} className="org-detail-chip org-detail-chip--alt">{t.label}</span> : null;
                })}
              </div>
            </section>
          )}

          {isPlatform && (
            <div className="org-callout">
              <Icon name="ShieldPerson" size={16} />
              <span>This is the Dayforce platform org — the seat from which organizations are managed. It can&rsquo;t be suspended.</span>
            </div>
          )}
        </div>

        <footer className="org-panel-side-foot">
          {!isPlatform && org.isCreated && (
            <button type="button" className={`org-btn ${org.status === "Suspended" ? "org-btn--secondary" : "org-btn--danger-ghost"}`} onClick={toggleSuspend}>
              {org.status === "Suspended" ? "Reactivate" : "Suspend"}
            </button>
          )}
          <button type="button" className="org-btn org-btn--primary" onClick={switchTo} disabled={isCurrent}>
            {isCurrent ? "Current organization" : <><Icon name="ArrowRight" size={15} /> Switch to org</>}
          </button>
        </footer>
      </aside>
    </React.Fragment>
  );
}

// =====================================================================
// LIST PAGE
// =====================================================================
function OrganizationsSettingsPage({ onGoTo }) {
  const [view, setView] = useOState("list"); // list | create
  const [rows, setRows] = useOState(() => org_registry());
  const [query, setQuery] = useOState("");
  const [manage, setManage] = useOState(null);

  const refresh = () => setRows(org_registry());

  const filtered = useOMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => r.name.toLowerCase().includes(q) || (r.sector || "").toLowerCase().includes(q) || (r.region || "").toLowerCase().includes(q));
  }, [rows, query]);

  const summary = useOMemo(() => {
    const tenants = rows.filter((r) => r.kind !== "platform");
    const active = tenants.filter((r) => r.status === "Active").length;
    const created = rows.filter((r) => r.isCreated).length;
    const users = rows.reduce((s, r) => s + (typeof r.users === "number" ? r.users : 0), 0);
    return { total: tenants.length, active, created, users };
  }, [rows]);

  if (view === "create") {
    return (
      <div className="org-shell">
        <OrgCreateWizard
          onCancel={() => setView("list")}
          onCreated={() => { refresh(); setView("list"); }}
        />
      </div>
    );
  }

  return (
    <div className="org-shell">
      <div className="org-page-head">
        <div className="org-page-titlewrap">
          <h2 className="org-page-title">Organizations</h2>
          <p className="org-page-sub">
            Every organization Dayforce manages from this platform tenant. Stand up a new
            organization with its base settings, or open one to manage it. Only the Systems
            Admin role — available here in the Dayforce org — can see this surface.
          </p>
        </div>
        <button type="button" className="org-btn org-btn--primary" onClick={() => setView("create")}>
          <Icon name="AddCircle" size={16} /> New organization
        </button>
      </div>

      <div className="org-summary">
        <div className="org-kpi">
          <span className="org-kpi-label"><Icon name="Building" size={12} /> Organizations</span>
          <span className="org-kpi-value">{summary.total}</span>
          <span className="org-kpi-foot">{summary.active} active</span>
        </div>
        <div className="org-kpi">
          <span className="org-kpi-label"><Icon name="AddCircle" size={12} /> Created here</span>
          <span className="org-kpi-value">{summary.created}</span>
          <span className="org-kpi-foot">via Systems Admin</span>
        </div>
        <div className="org-kpi">
          <span className="org-kpi-label"><Icon name="Users" size={12} /> Total users</span>
          <span className="org-kpi-value">{summary.users.toLocaleString("en-US")}</span>
          <span className="org-kpi-foot">across all tenants</span>
        </div>
        <div className="org-kpi">
          <span className="org-kpi-label"><Icon name="ShieldPerson" size={12} /> Platform org</span>
          <span className="org-kpi-value org-kpi-value--sm">Dayforce</span>
          <span className="org-kpi-foot">you are here</span>
        </div>
      </div>

      <div className="org-toolbar">
        <div className="org-search">
          <span className="org-search-icon"><Icon name="Search" size={16} /></span>
          <input className="org-search-input" placeholder="Search organizations by name, sector, or region"
                 value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <div className="org-toolbar-count">Showing {filtered.length} of {rows.length}</div>
      </div>

      <div className="org-card">
        <table className="org-table">
          <thead>
            <tr>
              <th>Organization</th>
              <th className="org-c-sector">Sector</th>
              <th className="org-c-region">Region</th>
              <th className="org-c-plan">Plan</th>
              <th className="org-c-users">Users</th>
              <th className="org-c-status">Status</th>
              <th aria-label="Actions"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id} onClick={() => setManage(r)} tabIndex={0}
                  onKeyDown={(e) => { if (e.key === "Enter") setManage(r); }}>
                <td>
                  <div className="org-row-name">
                    <OrgMark org={r} size={34} />
                    <div className="org-row-name-text">
                      <span className="org-row-name-title">
                        {r.name}
                        {r.kind === "platform" && <span className="org-tag-mini org-tag-mini--platform">Platform</span>}
                        {r.isCreated && <span className="org-tag-mini">New</span>}
                      </span>
                      <span className="org-row-name-sub">{r.id} · {r.currency}</span>
                    </div>
                  </div>
                </td>
                <td className="org-c-sector">{r.sector}</td>
                <td className="org-c-region">{r.region}</td>
                <td className="org-c-plan">{r.plan}</td>
                <td className="org-c-users">{typeof r.users === "number" ? r.users : "—"}</td>
                <td className="org-c-status"><OrgStatusPill status={r.status} /></td>
                <td className="org-c-actions">
                  <button type="button" className="org-icon-btn" aria-label={`Manage ${r.name}`}
                          onClick={(e) => { e.stopPropagation(); setManage(r); }}>
                    <Icon name="ChevronRight" size={18} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {manage && (
        <OrgManagePanel org={manage} onClose={() => setManage(null)} onChanged={refresh} />
      )}
    </div>
  );
}

Object.assign(window, {
  OrganizationsSettingsPage,
  org_registry, org_create, org_readStore, org_mergeIntoIndustries,
});
