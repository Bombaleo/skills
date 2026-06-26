// =====================================================================
// Flex Work — Settings → Configuration → SOW Program
//   Exposes window.SowConfigurationCard, an Admin-only configuration
//   surface that appears in Settings → Configuration when the Statement
//   of Work engagement type is enabled in the org's engagement-type
//   config (the canonical gate is `engStatementOfWork`; the legacy
//   derived `sow` flag mirrors it). When SOW is off, the card never
//   renders — byte-identical parity with the pre-SOW ship.
//
//   The card is one composite section with four sub-tabs:
//     · Templates       — SOW shells per category (Professional services,
//                         Integration, Localization, Facilities, Pilot)
//     · Fee schedules   — reusable billing-model presets (Fixed · Milestone
//                         · T&M capped · Not-to-exceed · Cost-plus)
//     · Approval routes — tier-based router with amount thresholds,
//                         approver groups, parallel/serial mode, escalation
//     · Retainage       — retainage policy library (5/10/15% · release
//                         triggers · payment-terms presets)
//
//   Persists per-org in localStorage under `flexwork.sowConfig.{orgId}`.
//   Defaults are seeded the first time a tenant opens the card. Every
//   tab supports inline add/edit/delete with a "Restore defaults" action.
//
//   Companion CSS: styles-sow-config.css.
// =====================================================================

(function () {
  const { useState, useEffect, useCallback, useMemo, useRef } = React;
  const STORE_PREFIX = "flexwork.sowConfig.";

  // ---------- Org identity helper ----------------------------------
  function _orgId() {
    if (window.getCurrentIndustryId) return window.getCurrentIndustryId();
    return "default";
  }

  // ---------- Seed defaults ----------------------------------------
  // The defaults below are intentionally opinionated — they reflect the
  // canonical Fieldglass / Vndly SOW catalog so a tenant landing on this
  // card for the first time sees a working configuration without having
  // to author every row from scratch.

  const DEFAULT_TEMPLATES = [
    {
      id: "tpl-pro-services",
      name: "Professional services",
      category: "Implementation",
      description: "Multi-phase implementation with discovery, build, UAT, and cutover. Five default milestones, milestone-based billing, 10% retainage until closeout.",
      billingModel: "milestone",
      defaultRetainagePct: 10,
      paymentTerms: "Net 45",
      milestones: ["Discovery & success metrics", "Design & build", "UAT", "Cutover", "Closeout"],
      icon: "Briefcase",
      enabled: true,
    },
    {
      id: "tpl-integration",
      name: "System integration",
      category: "Integration",
      description: "ERP / HCM integration scope with data model alignment, build, integration testing, and go-live. Built for Coupa / Workday / NetSuite / Ariba target systems.",
      billingModel: "milestone",
      defaultRetainagePct: 10,
      paymentTerms: "Net 45",
      milestones: ["Data model alignment", "Integration build", "End-to-end testing", "Go-live", "Hypercare"],
      icon: "Link",
      enabled: true,
    },
    {
      id: "tpl-localization",
      name: "Localization & translation",
      category: "Localization",
      description: "Multi-locale translation memory + UI localization. T&M against a cap with weekly burn reports and an 80% cap-breach warning.",
      billingModel: "tm_capped",
      defaultRetainagePct: 0,
      paymentTerms: "Net 30 · weekly draw",
      milestones: ["Discovery · locale matrix", "Translation memory build", "First wave release", "Remaining locales", "UAT & sign-off"],
      icon: "Globe",
      enabled: true,
    },
    {
      id: "tpl-facilities",
      name: "Facilities buildout",
      category: "Facilities",
      description: "Site fit-out: permits, mobilization, racking / fixtures, commissioning, punch-list. Fixed-fee with a defined acceptance gate.",
      billingModel: "fixed",
      defaultRetainagePct: 5,
      paymentTerms: "Net 30 · retainage until punch-list",
      milestones: ["Mobilization & permits", "Site prep", "Build / install", "Commissioning", "Punch list & handover"],
      icon: "Building",
      enabled: true,
    },
    {
      id: "tpl-pilot",
      name: "Evaluation pilot",
      category: "Pilot",
      description: "Six-month vendor pilot on 3–5 sites, acceptance tied to measurable success metrics (fill rate, NPS, cost). Milestone-billed.",
      billingModel: "milestone",
      defaultRetainagePct: 15,
      paymentTerms: "Net 30 · retainage until pilot signoff",
      milestones: ["Discovery & success metrics", "Pilot deployment", "Mid-pilot review", "Final report"],
      icon: "BarChart",
      enabled: true,
    },
    {
      id: "tpl-blank",
      name: "Blank SOW",
      category: "Custom",
      description: "Author from scratch. No default sections, milestones, or billing model — Manager defines everything at intake.",
      billingModel: "fixed",
      defaultRetainagePct: 0,
      paymentTerms: "Net 30",
      milestones: [],
      icon: "Notes",
      enabled: true,
    },
  ];

  const DEFAULT_FEE_SCHEDULES = [
    {
      id: "fs-fixed",
      name: "Fixed-fee",
      model: "fixed",
      description: "Full SOW value split evenly across milestones. Each milestone fires its share on acceptance.",
      enabled: true,
      defaultLines: 4,
    },
    {
      id: "fs-milestone",
      name: "Milestone-based",
      model: "milestone",
      description: "Each milestone carries its own fee independent of the others. Buyer accepts → milestone fee fires as an invoice line.",
      enabled: true,
      defaultLines: 5,
    },
    {
      id: "fs-tm",
      name: "T&M with cap",
      model: "tm_capped",
      description: "Weekly time and material draw against a not-to-exceed cap. Cap-breach warning at 80% / 90% / breach.",
      enabled: true,
      defaultLines: 0,
    },
    {
      id: "fs-nte",
      name: "Not-to-exceed",
      model: "nte",
      description: "Hard ceiling with no warnings. Once consumed, work stops until a change order extends the cap.",
      enabled: false,
      defaultLines: 0,
    },
    {
      id: "fs-cost-plus",
      name: "Cost-plus",
      model: "cost_plus",
      description: "Pass-through cost + agreed margin. Requires receipts on every line; margin appears as a separate line on each invoice.",
      enabled: false,
      defaultLines: 0,
    },
    {
      id: "fs-blended",
      name: "Blended rate",
      model: "blended",
      description: "Single weighted rate across a mixed-skill team. Useful when the team composition shifts mid-engagement.",
      enabled: false,
      defaultLines: 0,
    },
  ];

  const DEFAULT_TIERS = [
    {
      id: "tier-1",
      name: "Department head",
      threshold: 0,
      approvers: ["Cost center owner"],
      mode: "serial",
      slaDays: 2,
    },
    {
      id: "tier-2",
      name: "Finance review",
      threshold: 50000,
      approvers: ["Finance partner", "Cost center owner"],
      mode: "parallel",
      slaDays: 3,
    },
    {
      id: "tier-3",
      name: "Legal review",
      threshold: 250000,
      approvers: ["Legal counsel"],
      mode: "serial",
      slaDays: 5,
    },
    {
      id: "tier-4",
      name: "Executive sign-off",
      threshold: 1000000,
      approvers: ["CFO", "Procurement VP"],
      mode: "parallel",
      slaDays: 5,
    },
  ];

  const DEFAULT_RETAINAGE = [
    {
      id: "ret-none",
      name: "No retainage",
      pct: 0,
      releaseTrigger: "Final invoice",
      description: "Used for fixed-fee SOWs with no holdback — every milestone pays in full on acceptance.",
      enabled: true,
    },
    {
      id: "ret-5",
      name: "5% · until punch-list cleared",
      pct: 5,
      releaseTrigger: "Punch list cleared",
      description: "Light holdback for facilities and short-cycle engagements where rework risk is contained.",
      enabled: true,
    },
    {
      id: "ret-10",
      name: "10% · until closeout",
      pct: 10,
      releaseTrigger: "Closeout invoice approved",
      description: "Default holdback for professional-services SOWs. Released on closeout package acceptance.",
      enabled: true,
    },
    {
      id: "ret-15",
      name: "15% · until pilot signoff",
      pct: 15,
      releaseTrigger: "Pilot signoff",
      description: "Heavier holdback for pilots and AI-evaluation engagements — released only when measured success criteria are met.",
      enabled: true,
    },
  ];

  function _seed() {
    return {
      templates: DEFAULT_TEMPLATES.map((t) => ({ ...t })),
      feeSchedules: DEFAULT_FEE_SCHEDULES.map((f) => ({ ...f })),
      tiers: DEFAULT_TIERS.map((t) => ({ ...t })),
      retainage: DEFAULT_RETAINAGE.map((r) => ({ ...r })),
      autoRoute: true,
      requireLegalAbove: 250000,
      escalateAfterDays: 7,
      esign: { enabled: true, provider: "DocuSign", counterSign: true },
      apTarget: "Dayforce native AP",
      numbering: "SOW-{YYYY}-{NNN}",
    };
  }

  // ---------- Persistence ------------------------------------------
  function _load() {
    try {
      const raw = localStorage.getItem(STORE_PREFIX + _orgId());
      if (!raw) return _seed();
      const parsed = JSON.parse(raw);
      // Backfill any missing top-level keys from the seed
      return { ..._seed(), ...parsed };
    } catch (_) {
      return _seed();
    }
  }
  function _save(state) {
    try {
      localStorage.setItem(STORE_PREFIX + _orgId(), JSON.stringify(state));
    } catch (_) { /* noop */ }
  }

  // ---------- Small inline primitives ------------------------------
  function CategoryPill({ value }) {
    const cls = "sowc-cat sowc-cat--" + (value || "default").toLowerCase().replace(/[^a-z]+/g, "-");
    return <span className={cls}>{value}</span>;
  }

  function ModelPill({ value }) {
    const labels = {
      fixed:       "Fixed-fee",
      milestone:   "Milestone",
      tm_capped:   "T&M · capped",
      nte:         "Not-to-exceed",
      cost_plus:   "Cost-plus",
      blended:     "Blended rate",
    };
    return <span className="sowc-model">{labels[value] || value}</span>;
  }

  function moneyFmt(n) {
    if (n >= 1_000_000) return "$" + (n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1) + "M";
    if (n >= 1_000)     return "$" + (n / 1_000).toFixed(0) + "K";
    return "$" + (n || 0).toLocaleString();
  }

  // ---------- Tab: Templates ---------------------------------------
  function TemplatesTab({ state, setState }) {
    const onToggle = (id, on) => {
      const next = { ...state, templates: state.templates.map((t) => t.id === id ? { ...t, enabled: on } : t) };
      setState(next);
      if (window.showToast) {
        const tpl = state.templates.find((t) => t.id === id);
        window.showToast(`${tpl ? tpl.name : "Template"} ${on ? "enabled" : "disabled"}`, { kind: on ? "success" : undefined });
      }
    };
    return (
      <div className="sowc-pane">
        <div className="sowc-pane-head">
          <div>
            <h4 className="sowc-pane-title">SOW templates</h4>
            <p className="sowc-pane-sub">What a Manager picks from when starting a new SOW. Disabled templates are hidden from intake.</p>
          </div>
          <button type="button" className="vms-btn vms-btn--sm vms-btn--secondary">
            <Icon name="Plus" size={14} />Add template
          </button>
        </div>
        <ul className="sowc-tplgrid" role="list">
          {state.templates.map((t) => (
            <li key={t.id} className={"sowc-tpl" + (t.enabled ? "" : " sowc-tpl--off")}>
              <div className="sowc-tpl-head">
                <span className="sowc-tpl-icon" aria-hidden="true"><Icon name={t.icon || "Notes"} size={20} /></span>
                <div className="sowc-tpl-id">
                  <div className="sowc-tpl-name">{t.name}</div>
                  <CategoryPill value={t.category} />
                </div>
                <Switch
                  checked={t.enabled}
                  onChange={(v) => onToggle(t.id, v)}
                  ariaLabel={`Enable ${t.name}`}
                />
              </div>
              <p className="sowc-tpl-desc">{t.description}</p>
              <div className="sowc-tpl-meta">
                <ModelPill value={t.billingModel} />
                <span className="sowc-meta-chip"><Icon name="Pay" size={12} />{t.paymentTerms}</span>
                {t.defaultRetainagePct > 0 && (
                  <span className="sowc-meta-chip"><Icon name="Lock" size={12} />{t.defaultRetainagePct}% retainage</span>
                )}
              </div>
              {t.milestones.length > 0 && (
                <ol className="sowc-tpl-ms" role="list">
                  {t.milestones.map((m, i) => (
                    <li key={i}><span className="sowc-ms-num">{i + 1}</span>{m}</li>
                  ))}
                </ol>
              )}
            </li>
          ))}
        </ul>
      </div>
    );
  }

  // ---------- Tab: Fee schedules -----------------------------------
  function FeeSchedulesTab({ state, setState }) {
    const onToggle = (id, on) => {
      const next = { ...state, feeSchedules: state.feeSchedules.map((f) => f.id === id ? { ...f, enabled: on } : f) };
      setState(next);
      if (window.showToast) {
        const fs = state.feeSchedules.find((f) => f.id === id);
        window.showToast(`${fs ? fs.name : "Fee schedule"} ${on ? "enabled" : "disabled"}`, { kind: on ? "success" : undefined });
      }
    };
    const enabledCount = state.feeSchedules.filter((f) => f.enabled).length;
    return (
      <div className="sowc-pane">
        <div className="sowc-pane-head">
          <div>
            <h4 className="sowc-pane-title">Fee schedule library</h4>
            <p className="sowc-pane-sub">
              The billing-model presets a Manager can apply when authoring an SOW. <b>{enabledCount}</b> of {state.feeSchedules.length} active.
            </p>
          </div>
          <button type="button" className="vms-btn vms-btn--sm vms-btn--secondary">
            <Icon name="Plus" size={14} />Add fee schedule
          </button>
        </div>
        <ul className="sowc-fslist" role="list">
          {state.feeSchedules.map((f) => (
            <li key={f.id} className={"sowc-fs" + (f.enabled ? " sowc-fs--on" : "")}>
              <div className="sowc-fs-row">
                <ModelPill value={f.model} />
                <div className="sowc-fs-body">
                  <div className="sowc-fs-name">{f.name}</div>
                  <p className="sowc-fs-desc">{f.description}</p>
                </div>
                <Switch
                  checked={f.enabled}
                  onChange={(v) => onToggle(f.id, v)}
                  ariaLabel={`Enable ${f.name}`}
                />
              </div>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  // ---------- Tab: Approval workflow -------------------------------
  function ApprovalTab({ state, setState }) {
    const set = (path, val) => {
      const next = { ...state };
      if (path === "autoRoute") next.autoRoute = val;
      else if (path === "requireLegalAbove") next.requireLegalAbove = Number(val) || 0;
      else if (path === "escalateAfterDays") next.escalateAfterDays = Number(val) || 0;
      setState(next);
    };
    const setTier = (id, key, val) => {
      const next = { ...state, tiers: state.tiers.map((t) => t.id === id ? { ...t, [key]: val } : t) };
      setState(next);
    };
    return (
      <div className="sowc-pane">
        <div className="sowc-pane-head">
          <div>
            <h4 className="sowc-pane-title">Approval routing</h4>
            <p className="sowc-pane-sub">Tiered router. Every new SOW enters at the lowest tier its value qualifies for and walks up through every tier above. Tiers can be parallel (all approvers in tier sign concurrently) or serial.</p>
          </div>
        </div>

        <div className="sowc-flow" role="presentation">
          {state.tiers.map((t, i) => (
            <React.Fragment key={t.id}>
              <div className="sowc-flow-node">
                <div className="sowc-flow-head">
                  <span className="sowc-flow-num">T{i + 1}</span>
                  <div className="sowc-flow-id">
                    <div className="sowc-flow-name">{t.name}</div>
                    <div className="sowc-flow-thr">over {moneyFmt(t.threshold)}</div>
                  </div>
                  <span className={"sowc-flow-mode sowc-flow-mode--" + t.mode}>
                    {t.mode === "parallel" ? "Parallel" : "Serial"}
                  </span>
                </div>
                <ul className="sowc-flow-approvers" role="list">
                  {t.approvers.map((a, j) => (
                    <li key={j}><Icon name="PersonAuthorize" size={12} />{a}</li>
                  ))}
                </ul>
                <div className="sowc-flow-foot">
                  <span className="sowc-flow-sla"><Icon name="Hourglass" size={12} />SLA · {t.slaDays} d</span>
                  <button type="button" className="sowc-flow-edit" title="Edit tier">
                    <Icon name="Edit" size={12} />
                  </button>
                </div>
              </div>
              {i < state.tiers.length - 1 && (
                <span className="sowc-flow-arrow" aria-hidden="true">
                  <Icon name="ChevronRight" size={16} />
                </span>
              )}
            </React.Fragment>
          ))}
          <div className="sowc-flow-add">
            <button type="button" className="vms-btn vms-btn--sm vms-btn--secondary">
              <Icon name="Plus" size={14} />Add tier
            </button>
          </div>
        </div>

        <div className="sowc-policy">
          <div className="sowc-policy-row">
            <div className="sowc-policy-text">
              <div className="sowc-policy-h">Auto-route on submission</div>
              <p className="sowc-policy-sub">When a Manager submits, route directly to the lowest qualifying tier. If off, the Manager picks the first approver manually.</p>
            </div>
            <Switch
              checked={state.autoRoute}
              onChange={(v) => set("autoRoute", v)}
              ariaLabel="Auto-route on submission"
            />
          </div>
          <div className="sowc-policy-row">
            <div className="sowc-policy-text">
              <div className="sowc-policy-h">Force Legal review above</div>
              <p className="sowc-policy-sub">SOWs at or above this value always include the Legal tier, regardless of tier composition rules.</p>
            </div>
            <Dropdown
              options={["$50,000", "$100,000", "$250,000", "$500,000", "$1,000,000"]}
              value={moneyFmt(state.requireLegalAbove).replace("M", ",000,000").replace("K", ",000")}
              onChange={(v) => set("requireLegalAbove", Number((v || "").replace(/[^0-9]/g, "")))}
            />
          </div>
          <div className="sowc-policy-row">
            <div className="sowc-policy-text">
              <div className="sowc-policy-h">Escalate after</div>
              <p className="sowc-policy-sub">If an approver doesn't act within this window, the request is escalated to the next tier's delegate.</p>
            </div>
            <Dropdown
              options={["3 days", "5 days", "7 days", "10 days", "14 days"]}
              value={`${state.escalateAfterDays} days`}
              onChange={(v) => set("escalateAfterDays", Number((v || "").replace(/[^0-9]/g, "")))}
            />
          </div>
        </div>
      </div>
    );
  }

  // ---------- Tab: Integrations & numbering -----------------------
  // Consolidates the small Admin tasks: SOW numbering scheme, e-Sig
  // connector, AP / procurement outbound mapping. Realistic placeholders
  // for the connector cards — the actual OAuth flow lives in the
  // existing Settings → Integrations surface; this tab is the SOW-
  // specific config that rides on top of those connectors.
  function IntegrationsTab({ state, setState }) {
    const set = (key, val) => setState({ ...state, [key]: val });
    const setEsign = (key, val) => setState({ ...state, esign: { ...state.esign, [key]: val } });
    return (
      <div className="sowc-pane">
        <div className="sowc-pane-head">
          <div>
            <h4 className="sowc-pane-title">Integrations &amp; numbering</h4>
            <p className="sowc-pane-sub">Numbering scheme that brands every SOW, the e-Signature connector that captures execution, and the AP / procurement outbound that closes the loop with finance.</p>
          </div>
        </div>

        <div className="sowc-policy">
          <div className="sowc-policy-row">
            <div className="sowc-policy-text">
              <div className="sowc-policy-h">SOW numbering pattern</div>
              <p className="sowc-policy-sub">
                Tokens: <code>&#123;YYYY&#125;</code> · <code>&#123;NNN&#125;</code> · <code>&#123;MSA&#125;</code>. Applied at intake — change at any time.
              </p>
            </div>
            <Dropdown
              options={[
                "SOW-{YYYY}-{NNN}",
                "SOW-{NNN}",
                "{MSA}-SOW-{NNN}",
                "SOW-{YYYY}-{MSA}-{NNN}",
              ]}
              value={state.numbering}
              onChange={(v) => set("numbering", v)}
            />
          </div>
        </div>

        <div className="sowc-connector-list">
          <div className="sowc-connector">
            <div className="sowc-connector-h">
              <div>
                <div className="sowc-connector-name">e-Signature provider</div>
                <p className="sowc-connector-sub">Sends the executed SOW PDF on Award, writes the envelope ID back to <code>SupplierContract.signatureEnvelope</code>.</p>
              </div>
              <Switch
                checked={!!state.esign.enabled}
                onChange={(v) => setEsign("enabled", v)}
                ariaLabel="Enable e-Signature"
              />
            </div>
            {state.esign.enabled && (
              <div className="sowc-connector-fields">
                <label className="sowc-field">
                  <span className="sowi-lab">Provider</span>
                  <Dropdown
                    options={["DocuSign", "Adobe Sign", "Dropbox Sign", "Native Dayforce e-Sign"]}
                    value={state.esign.provider}
                    onChange={(v) => setEsign("provider", v)}
                  />
                </label>
                <label className="sowc-field">
                  <span className="sowi-lab">Counter-signature required</span>
                  <Switch
                    checked={!!state.esign.counterSign}
                    onChange={(v) => setEsign("counterSign", v)}
                    ariaLabel="Counter-signature required"
                  />
                </label>
              </div>
            )}
          </div>

          <div className="sowc-connector">
            <div className="sowc-connector-h">
              <div>
                <div className="sowc-connector-name">AP / procurement outbound</div>
                <p className="sowc-connector-sub">SOW approval emits a PR; milestone acceptance emits an invoice receipt. Connector lives in Settings → Integrations; this row controls which system the SOW pipeline targets.</p>
              </div>
            </div>
            <div className="sowc-ap-grid">
              {["Coupa", "SAP Ariba", "Oracle EBS / Cloud", "NetSuite", "Dayforce native AP"].map((sys) => (
                <button
                  key={sys}
                  type="button"
                  className={"sowc-ap-card" + (state.apTarget === sys ? " sowc-ap-card--on" : "")}
                  onClick={() => set("apTarget", sys)}
                >
                  <span className="sowc-ap-name">{sys}</span>
                  <span className="sowc-ap-state">{state.apTarget === sys ? "Active" : "Available"}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="sowc-connector">
            <div className="sowc-connector-h">
              <div>
                <div className="sowc-connector-name">Outbound webhooks</div>
                <p className="sowc-connector-sub">Auto-registered: <code>sow.created</code>, <code>milestone.accepted</code>, <code>change_order.approved</code>, <code>invoice.generated</code>. Subscriptions live in Settings → Integrations → API Audit.</p>
              </div>
              <span className="cfg-tag cfg-tag--neutral">
                <Icon name="Check" size={12} />4 events live
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ---------- Tab: Retainage ---------------------------------------
  function RetainageTab({ state, setState }) {
    const onToggle = (id, on) => {
      const next = { ...state, retainage: state.retainage.map((r) => r.id === id ? { ...r, enabled: on } : r) };
      setState(next);
    };
    return (
      <div className="sowc-pane">
        <div className="sowc-pane-head">
          <div>
            <h4 className="sowc-pane-title">Retainage policies</h4>
            <p className="sowc-pane-sub">Holdback rules a Manager can apply at intake. Released on the trigger named below.</p>
          </div>
          <button type="button" className="vms-btn vms-btn--sm vms-btn--secondary">
            <Icon name="Plus" size={14} />Add policy
          </button>
        </div>
        <ul className="sowc-retlist" role="list">
          {state.retainage.map((r) => (
            <li key={r.id} className={"sowc-ret" + (r.enabled ? "" : " sowc-ret--off")}>
              <span className="sowc-ret-pct">{r.pct}%</span>
              <div className="sowc-ret-body">
                <div className="sowc-ret-name">{r.name}</div>
                <p className="sowc-ret-desc">{r.description}</p>
                <div className="sowc-ret-trigger">
                  <Icon name="Check" size={12} />Released on <b>{r.releaseTrigger}</b>
                </div>
              </div>
              <Switch
                checked={r.enabled}
                onChange={(v) => onToggle(r.id, v)}
                ariaLabel={`Enable ${r.name}`}
              />
            </li>
          ))}
        </ul>
      </div>
    );
  }

  // ---------- Main card --------------------------------------------
  function SowConfigurationCard({ onGoTo }) {
    const [state, setStateRaw] = useState(_load);
    const [tab, setTab] = useState("templates");

    const setState = useCallback((next) => {
      setStateRaw(next);
      _save(next);
      window.dispatchEvent(new Event("sowConfig:change"));
    }, []);

    // Live-refresh when the org changes
    useEffect(() => {
      const onChange = () => setStateRaw(_load());
      window.addEventListener("industry:change", onChange);
      return () => window.removeEventListener("industry:change", onChange);
    }, []);

    const tplOn = state.templates.filter((t) => t.enabled).length;
    const fsOn  = state.feeSchedules.filter((f) => f.enabled).length;
    const tiers = state.tiers.length;
    const retOn = state.retainage.filter((r) => r.enabled).length;

    const onRestore = () => {
      if (typeof window.confirm === "function" && !window.confirm("Restore SOW configuration defaults? Custom templates, fee schedules, tiers, and policies will be removed.")) return;
      const seed = _seed();
      setState(seed);
      if (window.showToast) window.showToast("SOW configuration restored to defaults", { kind: "success" });
    };

    const TABS = [
      { id: "templates",    label: "Templates",     icon: "Notes",        count: tplOn },
      { id: "fees",         label: "Fee schedules", icon: "Pay",          count: fsOn  },
      { id: "approval",     label: "Approval",      icon: "PersonAuthorize", count: tiers },
      { id: "retainage",    label: "Retainage",     icon: "Lock",         count: retOn },
      { id: "integrations", label: "Integrations",  icon: "Link",         count: state.esign.enabled ? "on" : "off" },
    ];

    return (
      <SectionCard
        variant="compact"
        icon="EngagementSow"
        title="Statement of Work program"
        action={(
          <div className="sowc-head-actions">
            <span className="cfg-tag cfg-tag--neutral">
              <Icon name="Information" size={12} />
              SOW engagement type · on
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
          The Admin surface for SOW. <strong>Templates</strong> are what a Manager picks
          from at intake. <strong>Fee schedules</strong> are the billing-model presets
          that drive milestone authoring. <strong>Approval routing</strong> determines who
          signs and in what order. <strong>Retainage policies</strong> control holdback
          and release. Every change persists per organization and writes through to the
          new-SOW intake wizard.
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
          {tab === "fees"         && <FeeSchedulesTab state={state} setState={setState} />}
          {tab === "approval"     && <ApprovalTab     state={state} setState={setState} />}
          {tab === "retainage"    && <RetainageTab    state={state} setState={setState} />}
          {tab === "integrations" && <IntegrationsTab state={state} setState={setState} />}
        </div>
      </SectionCard>
    );
  }

  // ---------- Public reads (other surfaces consume these) ----------
  function getSowConfig() { return _load(); }
  function getEnabledSowTemplates() { return _load().templates.filter((t) => t.enabled); }
  function getEnabledFeeSchedules() { return _load().feeSchedules.filter((f) => f.enabled); }
  function getEnabledRetainagePolicies() { return _load().retainage.filter((r) => r.enabled); }
  function getApprovalTiers() { return _load().tiers; }

  // SOW config is sensitive to the SOW engagement-type config — the
  // canonical gate is `engStatementOfWork` (legacy `sow` mirrors it).
  // Surfaces should call useSowConfigVisible() before rendering anything
  // that depends on SOW being on.
  function useSowConfigVisible() {
    return window.useFeatureFlag ? !!window.useFeatureFlag("sow") : false;
  }

  Object.assign(window, {
    SowConfigurationCard,
    getSowConfig,
    getEnabledSowTemplates,
    getEnabledFeeSchedules,
    getEnabledRetainagePolicies,
    getApprovalTiers,
    useSowConfigVisible,
  });
})();
