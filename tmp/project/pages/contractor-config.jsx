// =====================================================================
// Flex Work — Settings → Configuration → IC Program
//   Exposes window.ContractorConfigurationCard, an Admin-only configuration
//   surface that appears in Settings → Configuration when the contractors
//   feature flag is on. Mirrors the SowConfigurationCard pattern in
//   structure, persistence, and visual idiom — reuses the same .sowc-*
//   CSS classes (no new stylesheet).
//
//   The card is one composite section with five sub-tabs:
//     · Templates       — country MSA + SOW + NDA + IP shells per market
//     · Payments        — per-country payment-method matrix (ACH · SEPA …)
//     · Coverage        — required insurance / COI policies per work
//                         category (GL · E&O · Cyber · Auto · Workers Comp)
//     · Approval        — IC Compliance Officer threshold + tiered router
//     · Integrations    — background-check connector · 1099 e-file
//                         connector · e-Sig (shared with SOW)
//
//   Persists per-org in localStorage under `flexwork.contractorConfig.{orgId}`.
//   Defaults are seeded the first time a tenant opens the card. Every
//   tab supports inline add/edit/delete with a "Restore defaults" action.
//
//   Companion CSS: styles-sow-config.css (re-uses .sowc-*).
// =====================================================================

(function () {
  const { useState, useEffect, useCallback } = React;
  const STORE_PREFIX = "flexwork.contractorConfig.";

  // ---------- Org identity helper ----------------------------------
  function _orgId() {
    if (window.getCurrentIndustryId) return window.getCurrentIndustryId();
    return "default";
  }

  // ---------- Seed defaults ----------------------------------------
  // The country-template seed mirrors the CTR_COUNTRIES list in
  // contractor-onboard.jsx so the Manager picker and the Admin catalog
  // stay coupled. New countries added here surface as picker options
  // in the wizard; turning a country off hides the template (the
  // wizard falls back to the global Standard MSA + SOW).
  const DEFAULT_TEMPLATES = [
    { id: "tpl-us", country: "US", countryName: "United States", flag: "us", form: "W-9",      msa: "Flex Work · US Master Services Agreement v3",  ndaIp: true, enabled: true },
    { id: "tpl-ca", country: "CA", countryName: "Canada",        flag: "ca", form: "W-8BEN",   msa: "Flex Work · CA Master Services Agreement v2",  ndaIp: true, enabled: true },
    { id: "tpl-gb", country: "GB", countryName: "United Kingdom",flag: "gb", form: "W-8BEN",   msa: "Flex Work · UK Master Services Agreement v2",  ndaIp: true, enabled: true },
    { id: "tpl-de", country: "DE", countryName: "Germany",       flag: "de", form: "W-8BEN",   msa: "Flex Work · DE Rahmenvertrag v2",              ndaIp: true, enabled: true },
    { id: "tpl-fr", country: "FR", countryName: "France",        flag: "fr", form: "W-8BEN",   msa: "Flex Work · FR Contrat-cadre v2",              ndaIp: true, enabled: true },
    { id: "tpl-se", country: "SE", countryName: "Sweden",        flag: "se", form: "W-8BEN-E", msa: "Flex Work · SE Ramavtal v1",                   ndaIp: true, enabled: true },
    { id: "tpl-br", country: "BR", countryName: "Brazil",        flag: "br", form: "W-8BEN",   msa: "Flex Work · BR Contrato Mestre v2",            ndaIp: true, enabled: true },
    { id: "tpl-mx", country: "MX", countryName: "Mexico",        flag: "mx", form: "W-8BEN",   msa: "Flex Work · MX Contrato Marco v1",             ndaIp: true, enabled: true },
    { id: "tpl-in", country: "IN", countryName: "India",         flag: "in", form: "W-8BEN",   msa: "Flex Work · IN Master Services Agreement v2",  ndaIp: true, enabled: true },
    { id: "tpl-au", country: "AU", countryName: "Australia",     flag: "au", form: "W-8BEN",   msa: "Flex Work · AU Master Services Agreement v1",  ndaIp: true, enabled: true },
    { id: "tpl-ng", country: "NG", countryName: "Nigeria",       flag: "ng", form: "W-8BEN",   msa: "Flex Work · NG Master Services Agreement v1",  ndaIp: true, enabled: true },
    { id: "tpl-ph", country: "PH", countryName: "Philippines",   flag: "ph", form: "W-8BEN",   msa: "Flex Work · PH Master Services Agreement v1",  ndaIp: true, enabled: true },
  ];

  // Per-country payment-method matrix. Each entry maps a country to
  // the locally appropriate methods. The Banking step in
  // contractor-onboard.jsx reads from here; turning a method off
  // removes it from the picker for that country.
  const DEFAULT_PAYMENTS = [
    { id: "pm-us", country: "US", countryName: "United States", flag: "us", methods: { ACH: true, Wire: true, PayPal: true, Wise: true, Payoneer: false, "USDC (stablecoin)": false } },
    { id: "pm-ca", country: "CA", countryName: "Canada",        flag: "ca", methods: { Interac: true, Wire: true, Wise: true, PayPal: true, Payoneer: false } },
    { id: "pm-gb", country: "GB", countryName: "United Kingdom",flag: "gb", methods: { BACS: true, Wise: true, Wire: true, Payoneer: true, PayPal: true } },
    { id: "pm-de", country: "DE", countryName: "Germany",       flag: "de", methods: { SEPA: true, Wise: true, Wire: true, PayPal: true } },
    { id: "pm-fr", country: "FR", countryName: "France",        flag: "fr", methods: { SEPA: true, Wise: true, Wire: true, PayPal: true } },
    { id: "pm-se", country: "SE", countryName: "Sweden",        flag: "se", methods: { SEPA: true, Wise: true, Wire: true } },
    { id: "pm-br", country: "BR", countryName: "Brazil",        flag: "br", methods: { PIX: true, Wise: true, Wire: true, Payoneer: true } },
    { id: "pm-mx", country: "MX", countryName: "Mexico",        flag: "mx", methods: { SPEI: true, Wise: true, Wire: true, Payoneer: true } },
    { id: "pm-in", country: "IN", countryName: "India",         flag: "in", methods: { IMPS: true, Wise: true, Wire: true, Payoneer: true, PayPal: true } },
    { id: "pm-au", country: "AU", countryName: "Australia",     flag: "au", methods: { BECS: true, Wise: true, Wire: true, PayPal: true } },
    { id: "pm-ng", country: "NG", countryName: "Nigeria",       flag: "ng", methods: { Wise: true, Payoneer: true, Wire: true, "USDC (stablecoin)": true } },
    { id: "pm-ph", country: "PH", countryName: "Philippines",   flag: "ph", methods: { GCash: true, Wise: true, Payoneer: true, Wire: true } },
  ];

  // Coverage / COI policy library. Each policy declares required
  // minima per work category. Manager intake selects which apply;
  // the contractor's Documents step pre-populates the request packet
  // and the hub's Documents tab flags gaps.
  const DEFAULT_COVERAGE = [
    { id: "cov-gl",   name: "General Liability",   abbrev: "GL",   minimum: "USD 1,000,000 per occurrence",            categories: ["On-site work", "Facilities", "Field services"],      enabled: true },
    { id: "cov-eo",   name: "Errors & Omissions",  abbrev: "E&O",  minimum: "USD 2,000,000 aggregate",                 categories: ["Professional services", "Engineering", "Design"],    enabled: true },
    { id: "cov-cyb",  name: "Cyber liability",     abbrev: "Cyber",minimum: "USD 1,000,000 per claim",                 categories: ["Data access", "Security", "Engineering"],            enabled: true },
    { id: "cov-auto", name: "Hired & Non-Owned Auto", abbrev: "HNOA", minimum: "USD 1,000,000 combined single limit",  categories: ["Field services", "Delivery", "Facilities"],          enabled: false },
    { id: "cov-wc",   name: "Workers Comp waiver",  abbrev: "WC",   minimum: "Sole-proprietor waiver on file",         categories: ["All US engagements above $100k/yr"],                 enabled: true },
  ];

  // Approval tiers — mirrors the SOW Approval pattern. IC-specific
  // thresholds drive who has to sign off on a new contractor invite,
  // a renewal, or a tax-form refresh after a quiet period.
  const DEFAULT_TIERS = [
    { id: "tier-mgr",   role: "Hiring manager",                  threshold: 0,       sla: 0, autoApprove: true,  enabled: true },
    { id: "tier-ic",    role: "IC Compliance Officer",           threshold: 0,       sla: 2, autoApprove: false, enabled: true,  trigger: "Any new contractor or risk ≥ 35" },
    { id: "tier-finance",role: "Finance review",                 threshold: 50000,   sla: 3, autoApprove: false, enabled: true,  trigger: "Total annual spend ≥ threshold" },
    { id: "tier-legal", role: "Legal review",                    threshold: 100000,  sla: 5, autoApprove: false, enabled: false, trigger: "Total annual spend ≥ threshold" },
  ];

  const DEFAULT_INTEGRATIONS = {
    esign:           { enabled: true,  provider: "DocuSign",       note: "Reused from the SOW Integrations card. Toggle here to opt the IC flow in or out." },
    backgroundCheck: { enabled: false, provider: "Checkr",         packageName: "Pro Criminal + MVR" },
    coiVerify:       { enabled: false, provider: "TrustLayer",     mode: "Automated · re-verifies on file change" },
    yearEnd1099:     { enabled: false, provider: "Track1099",      includeForeign: true, sendCopyToContractor: true },
    massPayment:     { enabled: false, provider: "Wise Business",  defaultCurrency: "USD" },
    riskThreshold:   35,
    spendThreshold:  50000,
    bankingQuietDays:5,
  };

  function _seed() {
    return {
      templates:    JSON.parse(JSON.stringify(DEFAULT_TEMPLATES)),
      payments:     JSON.parse(JSON.stringify(DEFAULT_PAYMENTS)),
      coverage:     JSON.parse(JSON.stringify(DEFAULT_COVERAGE)),
      tiers:        JSON.parse(JSON.stringify(DEFAULT_TIERS)),
      integrations: JSON.parse(JSON.stringify(DEFAULT_INTEGRATIONS)),
      v: 1,
    };
  }

  function _load() {
    try {
      const raw = localStorage.getItem(STORE_PREFIX + _orgId());
      if (!raw) return _seed();
      const parsed = JSON.parse(raw);
      // Forward-compatible: ensure every key exists so a partial older
      // store still renders.
      const seed = _seed();
      return {
        templates:    Array.isArray(parsed.templates)    ? parsed.templates    : seed.templates,
        payments:     Array.isArray(parsed.payments)     ? parsed.payments     : seed.payments,
        coverage:     Array.isArray(parsed.coverage)     ? parsed.coverage     : seed.coverage,
        tiers:        Array.isArray(parsed.tiers)        ? parsed.tiers        : seed.tiers,
        integrations: typeof parsed.integrations === "object" && parsed.integrations ? { ...seed.integrations, ...parsed.integrations } : seed.integrations,
        v: 1,
      };
    } catch (e) { return _seed(); }
  }
  function _save(state) {
    try { localStorage.setItem(STORE_PREFIX + _orgId(), JSON.stringify(state)); } catch (e) {}
  }

  // ---------- Tab: Templates ---------------------------------------
  function TemplatesTab({ state, setState }) {
    const onToggle = (id, on) => {
      const next = { ...state, templates: state.templates.map((t) => t.id === id ? { ...t, enabled: on } : t) };
      setState(next);
      if (window.showToast) {
        const tpl = state.templates.find((t) => t.id === id);
        window.showToast(`${tpl ? tpl.countryName : "Template"} ${on ? "enabled" : "disabled"}`, { kind: on ? "success" : undefined });
      }
    };
    const enabledCount = state.templates.filter((t) => t.enabled).length;
    return (
      <div className="sowc-pane">
        <div className="sowc-pane-head">
          <div>
            <h4 className="sowc-pane-title">Country contract templates</h4>
            <p className="sowc-pane-sub">Per-country MSA + SOW + NDA + IP assignment shells, vetted by local counsel. The Add Contractor wizard's template radio reads from the enabled set; turning a country off falls back to the global Standard MSA + SOW.</p>
          </div>
          <span className="cfg-tag cfg-tag--neutral">{enabledCount} of {state.templates.length} enabled</span>
        </div>
        <ul className="sowc-tpl-list">
          {state.templates.map((t) => (
            <li key={t.id} className={"sowc-tpl" + (t.enabled ? "" : " sowc-tpl--off")}>
              <div className="sowc-tpl-icon" aria-hidden="true">
                <span className={`fi fi-${t.flag}`} style={{ width: 24, height: 18, display: "inline-block", boxShadow: "0 0 0 1px var(--evr-border-decorative-lowemp)" }} />
              </div>
              <div className="sowc-tpl-body">
                <div className="sowc-tpl-name">{t.countryName} <span className="sowc-tpl-cat">({t.country} · {t.form})</span></div>
                <div className="sowc-tpl-desc">{t.msa}{t.ndaIp ? " · NDA + IP assignment bundled" : ""}</div>
              </div>
              <div className="sowc-tpl-rail">
                <Switch checked={t.enabled} onChange={(v) => onToggle(t.id, v)} ariaLabel={`Enable ${t.countryName} template`} />
              </div>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  // ---------- Tab: Payments ----------------------------------------
  function PaymentsTab({ state, setState }) {
    const onToggleMethod = (rowId, method, on) => {
      const next = { ...state, payments: state.payments.map((p) => p.id === rowId ? { ...p, methods: { ...p.methods, [method]: on } } : p) };
      setState(next);
    };
    return (
      <div className="sowc-pane">
        <div className="sowc-pane-head">
          <div>
            <h4 className="sowc-pane-title">Per-country payment methods</h4>
            <p className="sowc-pane-sub">Drives the Banking step in the Add Contractor wizard. Each country exposes only its enabled methods; the contractor enters local banking details accordingly.</p>
          </div>
        </div>
        <div className="ctr-table" style={{ overflow: "hidden" }}>
          <div className="ctr-table-head" style={{ gridTemplateColumns: "200px 1fr" }}>
            <div>Country</div>
            <div>Methods</div>
          </div>
          {state.payments.map((p) => {
            const ks = Object.keys(p.methods);
            return (
              <div key={p.id} className="ctr-table-row" style={{ gridTemplateColumns: "200px 1fr", alignItems: "center" }}>
                <div className="ctr-cell-doc">
                  <span className={`fi fi-${p.flag}`} style={{ width: 22, height: 16, display: "inline-block", boxShadow: "0 0 0 1px var(--evr-border-decorative-lowemp)" }} />
                  <span>{p.countryName}</span>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {ks.map((m) => (
                    <button
                      key={m}
                      type="button"
                      className="req-pill"
                      style={{
                        cursor: "pointer",
                        background: p.methods[m] ? "var(--evr-surface-decorative-default-green)" : "var(--evr-surface-secondary-default)",
                        color:      p.methods[m] ? "var(--evr-content-status-success-default)" : "var(--evr-content-primary-lowemp)",
                        border: 0,
                        fontFamily: "inherit",
                      }}
                      onClick={() => onToggleMethod(p.id, m, !p.methods[m])}
                      aria-pressed={!!p.methods[m]}
                      title={`${p.methods[m] ? "Disable" : "Enable"} ${m} for ${p.countryName}`}
                    >
                      {p.methods[m] ? <Icon name="Check" size={10} /> : null}
                      {m}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ---------- Tab: Coverage ----------------------------------------
  function CoverageTab({ state, setState }) {
    const onToggle = (id, on) => {
      const next = { ...state, coverage: state.coverage.map((c) => c.id === id ? { ...c, enabled: on } : c) };
      setState(next);
    };
    return (
      <div className="sowc-pane">
        <div className="sowc-pane-head">
          <div>
            <h4 className="sowc-pane-title">Insurance &amp; COI policy library</h4>
            <p className="sowc-pane-sub">Required coverage per work category. Manager intake selects which apply at requisition time; the contractor sees the matching upload requests in their Documents portal; the hub's Documents tab flags missing or under-coverage policies.</p>
          </div>
          <span className="cfg-tag cfg-tag--neutral">{state.coverage.filter((c) => c.enabled).length} of {state.coverage.length} enabled</span>
        </div>
        <ul className="sowc-tpl-list">
          {state.coverage.map((c) => (
            <li key={c.id} className={"sowc-tpl" + (c.enabled ? "" : " sowc-tpl--off")}>
              <div className="sowc-tpl-icon" aria-hidden="true"><Icon name="ShieldPerson" size={20} /></div>
              <div className="sowc-tpl-body">
                <div className="sowc-tpl-name">{c.name} <span className="sowc-tpl-cat">({c.abbrev})</span></div>
                <div className="sowc-tpl-desc">{c.minimum} · applies to {c.categories.join(" · ")}</div>
              </div>
              <div className="sowc-tpl-rail">
                <Switch checked={c.enabled} onChange={(v) => onToggle(c.id, v)} ariaLabel={`Enable ${c.name}`} />
              </div>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  // ---------- Tab: Approval ----------------------------------------
  function ApprovalTab({ state, setState }) {
    const setInt = (k, v) => setState({ ...state, integrations: { ...state.integrations, [k]: v } });
    const onToggleTier = (id, on) => {
      const next = { ...state, tiers: state.tiers.map((t) => t.id === id ? { ...t, enabled: on } : t) };
      setState(next);
    };
    return (
      <div className="sowc-pane">
        <div className="sowc-pane-head">
          <div>
            <h4 className="sowc-pane-title">Approval routing</h4>
            <p className="sowc-pane-sub">Who has to approve a new contractor invite or a material change to an existing engagement. Reuses the same tiered router primitive shipped for SOW.</p>
          </div>
        </div>

        <div className="sowc-grid" style={{ marginBottom: 16, display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 12 }}>
          <label className="sowc-field">
            <span className="sowi-lab">Risk threshold for Compliance review</span>
            <Dropdown
              options={["25", "35", "50", "65"]}
              value={String(state.integrations.riskThreshold || 35)}
              onChange={(v) => setInt("riskThreshold", Number(v))}
            />
          </label>
          <label className="sowc-field">
            <span className="sowi-lab">Spend threshold for Finance review</span>
            <Dropdown
              options={["25000", "50000", "100000", "250000"]}
              value={String(state.integrations.spendThreshold || 50000)}
              onChange={(v) => setInt("spendThreshold", Number(v))}
            />
          </label>
          <label className="sowc-field">
            <span className="sowi-lab">Banking-edit quiet days before run</span>
            <Dropdown
              options={["3", "5", "7", "10"]}
              value={String(state.integrations.bankingQuietDays || 5)}
              onChange={(v) => setInt("bankingQuietDays", Number(v))}
            />
          </label>
        </div>

        <ul className="sowc-tpl-list">
          {state.tiers.map((t) => (
            <li key={t.id} className={"sowc-tpl" + (t.enabled ? "" : " sowc-tpl--off")}>
              <div className="sowc-tpl-icon" aria-hidden="true"><Icon name="PersonAuthorize" size={20} /></div>
              <div className="sowc-tpl-body">
                <div className="sowc-tpl-name">
                  {t.role}
                  {t.autoApprove
                    ? <span className="sowc-tpl-cat"> · auto-approve</span>
                    : <span className="sowc-tpl-cat"> · {t.sla}-day SLA</span>}
                </div>
                <div className="sowc-tpl-desc">
                  {t.trigger
                    ? t.trigger.replace("threshold", t.threshold ? "$" + t.threshold.toLocaleString() : "the threshold")
                    : "Always required"}
                </div>
              </div>
              <div className="sowc-tpl-rail">
                <Switch checked={t.enabled} onChange={(v) => onToggleTier(t.id, v)} ariaLabel={`Enable ${t.role}`} />
              </div>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  // ---------- Tab: Integrations ------------------------------------
  function IntegrationsTab({ state, setState }) {
    const setInt = (k, v) => setState({ ...state, integrations: { ...state.integrations, [k]: v } });
    const setConn = (key, field, val) => setState({ ...state, integrations: { ...state.integrations, [key]: { ...state.integrations[key], [field]: val } } });
    const i = state.integrations;
    return (
      <div className="sowc-pane">
        <div className="sowc-pane-head">
          <div>
            <h4 className="sowc-pane-title">Integrations</h4>
            <p className="sowc-pane-sub">Connectors that turn a Flex Work contractor into a fully compliant counterparty. Each provider's OAuth flow lives in Settings → Integrations; this card is the IC-specific routing on top.</p>
          </div>
        </div>

        <div className="sowc-connector-list">

          {/* e-Sig */}
          <div className="sowc-connector">
            <div className="sowc-connector-h">
              <div>
                <div className="sowc-connector-name">e-Signature provider <span className="cfg-tag cfg-tag--neutral" style={{ marginLeft: 8 }}>Shared with SOW</span></div>
                <p className="sowc-connector-sub">Sends the executed MSA + SOW + NDA + IP packet for signature on Invite; writes the envelope ID back to the contractor agreement. Reused from the SOW connector — toggle here to opt IC in or out independently.</p>
              </div>
              <Switch checked={!!i.esign.enabled} onChange={(v) => setConn("esign", "enabled", v)} ariaLabel="Enable e-Sig for IC" />
            </div>
            {i.esign.enabled && (
              <div className="sowc-connector-fields">
                <label className="sowc-field">
                  <span className="sowi-lab">Provider</span>
                  <Dropdown
                    options={["DocuSign", "Adobe Sign", "Dropbox Sign", "Native Dayforce e-Sign"]}
                    value={i.esign.provider}
                    onChange={(v) => setConn("esign", "provider", v)}
                  />
                </label>
              </div>
            )}
          </div>

          {/* Background check */}
          <div className="sowc-connector">
            <div className="sowc-connector-h">
              <div>
                <div className="sowc-connector-name">Background check</div>
                <p className="sowc-connector-sub">Launches a per-package check from the wizard's Identity step. Webhook back-channel updates the contractor's compliance status on the Documents accordion. The check report is filed under <code>CONTRACTOR_DOCS[id]</code> with category Identity.</p>
              </div>
              <Switch checked={!!i.backgroundCheck.enabled} onChange={(v) => setConn("backgroundCheck", "enabled", v)} ariaLabel="Enable background check" />
            </div>
            {i.backgroundCheck.enabled && (
              <div className="sowc-connector-fields">
                <label className="sowc-field">
                  <span className="sowi-lab">Provider</span>
                  <Dropdown
                    options={["Checkr", "HireRight", "Sterling", "Accurate"]}
                    value={i.backgroundCheck.provider}
                    onChange={(v) => setConn("backgroundCheck", "provider", v)}
                  />
                </label>
                <label className="sowc-field">
                  <span className="sowi-lab">Default package</span>
                  <Dropdown
                    options={["Basic Criminal", "Pro Criminal + MVR", "Federal Pro", "Sub-contractor Lite"]}
                    value={i.backgroundCheck.packageName}
                    onChange={(v) => setConn("backgroundCheck", "packageName", v)}
                  />
                </label>
              </div>
            )}
          </div>

          {/* COI verify */}
          <div className="sowc-connector">
            <div className="sowc-connector-h">
              <div>
                <div className="sowc-connector-name">COI verification</div>
                <p className="sowc-connector-sub">Automatically parses uploaded certificates of insurance and verifies coverage against the Coverage policy library. Flags expired or under-coverage on the contractor Documents accordion and the hub's Documents tab.</p>
              </div>
              <Switch checked={!!i.coiVerify.enabled} onChange={(v) => setConn("coiVerify", "enabled", v)} ariaLabel="Enable COI verification" />
            </div>
            {i.coiVerify.enabled && (
              <div className="sowc-connector-fields">
                <label className="sowc-field">
                  <span className="sowi-lab">Provider</span>
                  <Dropdown
                    options={["TrustLayer", "myCOI", "Evident", "Manual review only"]}
                    value={i.coiVerify.provider}
                    onChange={(v) => setConn("coiVerify", "provider", v)}
                  />
                </label>
              </div>
            )}
          </div>

          {/* 1099 e-file */}
          <div className="sowc-connector">
            <div className="sowc-connector-h">
              <div>
                <div className="sowc-connector-name">1099 / 1042-S e-file</div>
                <p className="sowc-connector-sub">The Year-end Tax Wizard in the IC Compliance Hub already generates the per-contractor packet; this connector submits the batch directly to the IRS, writes the confirmation back to the contractor record, and surfaces the audit trail on each contractor's Year-end accordion.</p>
              </div>
              <Switch checked={!!i.yearEnd1099.enabled} onChange={(v) => setConn("yearEnd1099", "enabled", v)} ariaLabel="Enable year-end e-file" />
            </div>
            {i.yearEnd1099.enabled && (
              <div className="sowc-connector-fields">
                <label className="sowc-field">
                  <span className="sowi-lab">Provider</span>
                  <Dropdown
                    options={["Track1099", "Tax1099", "Avalara 1099", "Native Dayforce Tax"]}
                    value={i.yearEnd1099.provider}
                    onChange={(v) => setConn("yearEnd1099", "provider", v)}
                  />
                </label>
                <label className="sowc-field">
                  <span className="sowi-lab">Send copy to contractor</span>
                  <Switch checked={!!i.yearEnd1099.sendCopyToContractor} onChange={(v) => setConn("yearEnd1099", "sendCopyToContractor", v)} ariaLabel="Send copy to contractor" />
                </label>
                <label className="sowc-field">
                  <span className="sowi-lab">Include foreign (1042-S)</span>
                  <Switch checked={!!i.yearEnd1099.includeForeign} onChange={(v) => setConn("yearEnd1099", "includeForeign", v)} ariaLabel="Include foreign payments" />
                </label>
              </div>
            )}
          </div>

          {/* Mass payment */}
          <div className="sowc-connector">
            <div className="sowc-connector-h">
              <div>
                <div className="sowc-connector-name">Mass payment / batch payouts</div>
                <p className="sowc-connector-sub">Batches approved contractor invoices into a single payment run per currency. Disbursement happens through the connected provider; the contractor's Earnings card shows the payout reference.</p>
              </div>
              <Switch checked={!!i.massPayment.enabled} onChange={(v) => setConn("massPayment", "enabled", v)} ariaLabel="Enable mass payments" />
            </div>
            {i.massPayment.enabled && (
              <div className="sowc-connector-fields">
                <label className="sowc-field">
                  <span className="sowi-lab">Provider</span>
                  <Dropdown
                    options={["Wise Business", "Payoneer Mass Pay", "Nium", "Bill.com", "Dayforce native AP"]}
                    value={i.massPayment.provider}
                    onChange={(v) => setConn("massPayment", "provider", v)}
                  />
                </label>
              </div>
            )}
          </div>

          {/* Webhooks (read-only) */}
          <div className="sowc-connector">
            <div className="sowc-connector-h">
              <div>
                <div className="sowc-connector-name">Outbound webhooks</div>
                <p className="sowc-connector-sub">Auto-registered: <code>contractor.created</code>, <code>contractor.invited</code>, <code>contractor.classification_changed</code>, <code>contractor.agreement_signed</code>, <code>contractor.agreement_expiring</code>, <code>contractor.invoice_submitted</code>, <code>contractor.invoice_paid</code>, <code>contractor.year_end_filed</code>, <code>contractor.converted_to_employee</code>. Subscribers register in Settings → API → Webhooks.</p>
              </div>
              <span className="cfg-tag cfg-tag--neutral"><Icon name="Check" size={10} />Always on</span>
            </div>
          </div>

        </div>
      </div>
    );
  }

  // ---------- Main card --------------------------------------------
  function ContractorConfigurationCard({ onGoTo }) {
    const [state, setStateRaw] = useState(_load);
    const [tab, setTab] = useState("templates");
    const setState = useCallback((next) => {
      setStateRaw(next);
      _save(next);
      window.dispatchEvent(new Event("contractorConfig:change"));
    }, []);
    useEffect(() => {
      const onChange = () => setStateRaw(_load());
      window.addEventListener("industry:change", onChange);
      return () => window.removeEventListener("industry:change", onChange);
    }, []);

    const tplOn  = state.templates.filter((t) => t.enabled).length;
    const pmCt   = state.payments.length;
    const covOn  = state.coverage.filter((c) => c.enabled).length;
    const tiers  = state.tiers.filter((t) => t.enabled).length;
    const intOn  = Object.entries(state.integrations).filter(([k, v]) => v && typeof v === "object" && v.enabled).length;

    const onRestore = () => {
      if (typeof window.confirm === "function" && !window.confirm("Restore IC program configuration defaults? Custom templates, payment methods, coverage policies, approval tiers, and integration settings will be removed.")) return;
      const seed = _seed();
      setState(seed);
      if (window.showToast) window.showToast("IC program configuration restored to defaults", { kind: "success" });
    };

    const TABS = [
      { id: "templates",    label: "Templates",    icon: "File",            count: tplOn },
      { id: "payments",     label: "Payments",     icon: "Pay",             count: pmCt },
      { id: "coverage",     label: "Coverage",     icon: "ShieldPerson",    count: covOn },
      { id: "approval",     label: "Approval",     icon: "PersonAuthorize", count: tiers },
      { id: "integrations", label: "Integrations", icon: "Link",            count: intOn },
    ];

    return (
      <SectionCard
        variant="compact"
        icon="PersonAuthorize"
        title="Independent contractor program"
        action={(
          <div className="sowc-head-actions">
            <span className="cfg-tag cfg-tag--neutral">
              <Icon name="Information" size={12} />
              IC engagement type · on
            </span>
            <button
              type="button"
              className="vms-btn vms-btn--sm vms-btn--tertiary"
              onClick={onRestore}
              title="Restore defaults"
            >
              <Icon name="Refresh" size={12} />Restore defaults
            </button>
          </div>
        )}
      >
        <p className="cfg-card-blurb">
          The Admin surface for direct-engaged 1099 / IC contractors. <strong>Templates</strong> are
          the country-localized MSA + SOW + NDA + IP shells a contractor signs at onboarding.
          <strong> Payments</strong> drives the Banking step picker. <strong>Coverage</strong> defines
          the insurance / COI policies an IC has to carry. <strong>Approval</strong> routes new contractors
          to the right reviewers. <strong>Integrations</strong> wires up background check, COI verification,
          1099 e-file, and mass payment. Every change persists per organization.
        </p>

        <div className="sowc-tabs" role="tablist">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              className={"sowc-tab" + (tab === t.id ? " sowc-tab--on" : "")}
              onClick={() => setTab(t.id)}
            >
              <Icon name={t.icon} size={14} />
              <span>{t.label}</span>
              <span className="sowc-tab-count">{t.count}</span>
            </button>
          ))}
        </div>

        <div className="sowc-body">
          {tab === "templates"    && <TemplatesTab    state={state} setState={setState} />}
          {tab === "payments"     && <PaymentsTab     state={state} setState={setState} />}
          {tab === "coverage"     && <CoverageTab     state={state} setState={setState} />}
          {tab === "approval"     && <ApprovalTab     state={state} setState={setState} />}
          {tab === "integrations" && <IntegrationsTab state={state} setState={setState} />}
        </div>
      </SectionCard>
    );
  }

  // ---------- Public reads (other surfaces consume these) ----------
  function getContractorConfig() { return _load(); }
  function getEnabledContractorTemplates() { return _load().templates.filter((t) => t.enabled); }
  function getEnabledPaymentMethodsForCountry(country) {
    const row = _load().payments.find((p) => p.country === country);
    if (!row) return ["Wire", "Wise"];
    return Object.entries(row.methods).filter(([_, v]) => v).map(([k]) => k);
  }
  function getEnabledCoveragePolicies() { return _load().coverage.filter((c) => c.enabled); }
  function getContractorApprovalTiers() { return _load().tiers.filter((t) => t.enabled); }
  function getContractorIntegrations() { return _load().integrations; }
  function useContractorConfigVisible() {
    return window.useFeatureFlag ? !!window.useFeatureFlag("contractors") : false;
  }

  Object.assign(window, {
    ContractorConfigurationCard,
    getContractorConfig,
    getEnabledContractorTemplates,
    getEnabledPaymentMethodsForCountry,
    getEnabledCoveragePolicies,
    getContractorApprovalTiers,
    getContractorIntegrations,
    useContractorConfigVisible,
  });
})();
