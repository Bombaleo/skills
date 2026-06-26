// =====================================================================
// Flex Work — Settings → System
//   Tenant-level system settings. Six sections, single source of truth
//   for the developer / admin surface of Flex Work:
//     · System health     — uptime, version, environment, support
//     · API access        — personal access tokens + service tokens
//     · Webhooks          — outbound event endpoints + delivery health
//     · Identity & sec    — IdP, MFA, session, IP allowlist
//     · Data & retention  — residency region + per-object retention
//     · Audit log         — searchable admin event feed
//
//   Persists locally to window.__systemStore. Right-rail "On this page"
//   scroll-spy follows the same pattern as ConfigurationPage.
// =====================================================================

const { useState: useSyS, useMemo: useSyM, useEffect: useSyE, useRef: useSyR, useCallback: useSyC } = React;

// ---------- Defaults ------------------------------------------------
function sys_defaults() {
  const ind = (window.getIndustry && window.getIndustry()) || { id: "manufacturing", name: "Atlas Manufacturing Co." };
  const slug = ind.name.toLowerCase().replace(/[^a-z]+/g, "").slice(0, 18) || "org";
  const orgShort = ind.name.split(/\s+/)[0]; // "Atlas" / "Aurora" / "Northwind" / "Mercy" / "Continental"
  const orgHost = slug + ".example";
  // Industry-tinted descriptors for tokens / hooks. Keeps the System
  // page reading like the active tenant rather than always like Atlas.
  const partner = ({
    manufacturing: { bi: "warehouse sync",   thirdParty: "Iron Source — supplier portal" },
    hospitality:   { bi: "property sync",    thirdParty: "Property Mgmt — Opera bridge" },
    retail:        { bi: "stores sync",      thirdParty: "Banner POS — Flagship v6" },
    healthcare:    { bi: "facilities sync",  thirdParty: "Epic — staffing bridge" },
    logistics:     { bi: "terminals sync",   thirdParty: "Fleet ELD — Geotab bridge" },
  })[ind.id] || { bi: "warehouse sync", thirdParty: "Iron Source — supplier portal" };
  return {
    health: {
      status: "operational",          // operational | degraded
      version: "v2026.5.2",
      released: "May 12, 2026",
      environment: "Production · NA",
      region: "us-west-2 (Oregon)",
      uptime30d: 99.987,
      tenantId: "DF-NA-22517",
      supportEmail: "flex-work-support@dayforce.com",
      supportPlan: "Premium · 24/7",
      onCall: "Sami Soto",
    },
    api: {
      keys: [
        { id: "k1", name: "Payroll export · production",       prefix: "df_live_8h2k…RT9", scopes: ["timesheets:read", "invoices:read", "workers:read"], owner: "Devon Park",   role: "Service",  lastUsed: "12 min ago",  created: "Mar 04, 2025", status: "active" },
        { id: "k2", name: `${orgShort} BI · ${partner.bi}`,    prefix: "df_live_2n9p…Qw0", scopes: ["requisitions:read", "timesheets:read", "locations:read", "suppliers:read"], owner: "Priya Shah",  role: "Service",  lastUsed: "1 hr ago",   created: "Nov 22, 2024", status: "active" },
        { id: "k3", name: partner.thirdParty,                   prefix: "df_live_4ab7…Lp2", scopes: ["requisitions:read", "requisitions:write", "workers:read"], owner: "Alex Moreno",  role: "Partner",  lastUsed: "8 hr ago",   created: "Feb 18, 2025", status: "active" },
        { id: "k4", name: "Amy Chen · sandbox CLI",            prefix: "df_test_kk6q…Vp4", scopes: ["*:read"], owner: "Amy Chen",    role: "Personal", lastUsed: "Yesterday",  created: "Apr 02, 2026", status: "active" },
        { id: "k5", name: "Legacy HRIS webhook (deprecated)", prefix: "df_live_zx1f…Gn8", scopes: ["timesheets:read"], owner: "System",     role: "Service",  lastUsed: "23 days ago", created: "Aug 11, 2024", status: "paused" },
        { id: "k6", name: "Outdated mobile build",             prefix: "df_live_99hb…Yu1", scopes: ["workers:read"], owner: "System",     role: "Service",  lastUsed: "Never",      created: "Jan 04, 2024", status: "revoked" },
      ],
    },
    hooks: [
      { id: "h1", url: `https://hooks.${orgHost}/dayforce/requisitions`, events: ["requisition.created", "requisition.approved", "requisition.cancelled"], deliveries: 4128, lastDelivery: "32 sec ago",  status: "active",  spark: "✓✓✓✓✓✓✓✓✓✓✓✓✓✓" },
      { id: "h2", url: "https://ap.acme-finance.com/webhooks/dayforce",  events: ["invoice.approved", "invoice.paid"],                                    deliveries: 1142, lastDelivery: "4 min ago",   status: "active",  spark: "✓✓✓✓✓✓✗✓✓✓✓✓✓✓" },
      { id: "h3", url: `https://compliance.${slug}.internal/v1/timesheets`, events: ["timesheet.posted"],                                                deliveries: 9872, lastDelivery: "Just now",    status: "active",  spark: "✓✓✓✓✓✓✓✓~✓✓✓✓✓" },
      { id: "h4", url: `https://staging.${orgHost}/dayforce/replay`,    events: ["worker.activated"],                                                    deliveries: 42,   lastDelivery: "2 days ago",  status: "paused",  spark: "—————————————" },
      { id: "h5", url: "https://legacy.iron-source.com/df-events",           events: ["rate.changed"],                                                        deliveries: 86,   lastDelivery: "Failing · 1 hr", status: "failed", spark: "✗✗✓✓✗✗✗✗✗✗✗✗✗✗" },
    ],
    identity: {
      provider: "Okta",
      providerHost: `${slug}.okta.com`,
      managedIn: "Dayforce HCM",
      scim: true,
      mfaRequired: true,
      mfaMethod: "TOTP + WebAuthn",
      sessionTimeout: 8,            // hours
      idleTimeout: 30,              // minutes
      passwordPolicy: "Managed by Okta",
      ipAllowlist: ["10.0.0.0/8", "172.16.0.0/12", "203.0.113.42/32"],
      ipAllowlistEnabled: false,
    },
    data: {
      region: "United States",
      regionCode: "us-west-2",
      backupRegion: "us-east-1 (Virginia)",
      facilities: [
        { label: "Primary",   value: "Oregon, USA" },
        { label: "Replica",   value: "Virginia, USA" },
        { label: "Backups",   value: "Encrypted · 35-day window" },
      ],
      retention: {
        requisitions: 7,     // years
        timesheets: 7,
        invoices: 10,
        workers: 7,
        auditLog: 7,
        attachments: 3,
      },
      gdpr: true,
      ccpa: true,
    },
  };
}
const SYS_RETAIN_MAX = 10;

function sys_ensureStore() {
  if (!window.__systemStore) window.__systemStore = sys_defaults();
  return window.__systemStore;
}

// ---------- Small atoms --------------------------------------------
function SysFact({ icon, label, value, mono }) {
  return (
    <div className="sys-fact">
      <span className="sys-fact-label"><Icon name={icon} size={12} /> {label}</span>
      <span className={"sys-fact-value" + (mono ? " sys-fact-value--mono" : "")}>{value}</span>
    </div>
  );
}

function SysStatus({ kind, label }) {
  return <span className={`sys-status sys-status--${kind}`}>{label}</span>;
}

function SysScope({ s }) {
  const isWrite = /:write|:\*|^\*:/.test(s);
  return <span className={"sys-scope" + (isWrite ? " sys-scope--write" : "")}>{s}</span>;
}

function SysSparkbar({ pattern }) {
  // pattern uses "✓" / "✗" / "~" / "—" markers.
  return (
    <span className="sys-sparkbar" aria-hidden="true">
      {[...pattern].map((c, i) => {
        const h = c === "—" ? 4 : c === "~" ? 8 : c === "✗" ? 14 : 6 + ((i * 3) % 11);
        const cls = c === "✗" ? "sys-sparkbar-bar--fail"
                  : c === "~" ? "sys-sparkbar-bar--slow"
                  : "";
        return <span key={i} className={"sys-sparkbar-bar " + cls} style={{ height: h }} />;
      })}
    </span>
  );
}

// "On this page" rail items
const SYS_RAIL = [
  { id: "health",    label: "System health",   icon: "Bolt" },
  { id: "api",       label: "API access",      icon: "Code" },
  { id: "hooks",     label: "Webhooks",        icon: "Broadcast" },
  { id: "identity",  label: "Identity & security", icon: "ShieldPerson" },
  { id: "data",      label: "Data & retention", icon: "Stack" },
  { id: "audit",     label: "Audit log",       icon: "Gavel" },
];

// ---------- Audit log seed -----------------------------------------
function sysAuditSeed() {
  const ind = (window.getIndustry && window.getIndustry()) || { id: "manufacturing", name: "Atlas Manufacturing Co." };
  const slug = ind.name.toLowerCase().replace(/[^a-z]+/g, "").slice(0, 18) || "org";
  const host = `${slug}.example`;
  return [
    { id: "a1", kind: "info", icon: "Code",          title: <>Generated API key <b>“Payroll export · production”</b></>,             actor: "Devon Park",  category: "API",      time: "12 min ago",  ip: "10.4.21.5" },
    { id: "a2", kind: "ok",   icon: "ShieldPerson",  title: <>Enabled MFA for <b>finance@{host}</b></>,                                actor: "Sami Soto",   category: "Security", time: "1 hr ago",    ip: "10.4.18.2" },
    { id: "a3", kind: "warn", icon: "Alert",         title: <>Webhook <b>legacy.iron-source.com</b> entered failing state</>,        actor: "System",      category: "Webhooks", time: "1 hr ago",    ip: "—" },
    { id: "a4", kind: "info", icon: "Settings",      title: <>Updated session timeout from <b>4h → 8h</b></>,                        actor: "Amy Chen",    category: "Security", time: "3 hr ago",    ip: "10.4.21.1" },
    { id: "a5", kind: "ok",   icon: "Person",        title: <>Granted <b>System admin</b> role to Rosa Linares</>,                   actor: "Amy Chen",    category: "Roles",    time: "Yesterday",   ip: "10.4.21.1" },
    { id: "a6", kind: "info", icon: "Stack",         title: <>Updated retention · invoices from <b>7y → 10y</b></>,                  actor: "Devon Park",  category: "Data",     time: "Yesterday",   ip: "10.4.21.5" },
    { id: "a7", kind: "err",  icon: "Cancel",        title: <>Revoked API key <b>“Outdated mobile build”</b> (no usage in 365d)</>,  actor: "System",      category: "API",      time: "2 days ago",  ip: "—" },
    { id: "a8", kind: "ai",   icon: "Bolt",          title: <>AI auto-tagged 142 audit events as <b>“routine maintenance”</b></>,    actor: "Compliance AI", category: "AI",     time: "2 days ago",  ip: "—" },
    { id: "a9", kind: "info", icon: "LinkNewWindow", title: <>SCIM provisioning ran — <b>17 users</b> created, <b>3</b> deactivated</>, actor: "Okta SCIM", category: "Identity", time: "3 days ago",  ip: "Okta" },
    { id: "a10", kind: "info", icon: "Broadcast",    title: <>Created webhook to <b>hooks.{host}</b></>,                              actor: "Priya Shah",  category: "Webhooks", time: "4 days ago",  ip: "10.4.22.7" },
  ];
}

// =====================================================================
// PAGE
// =====================================================================
function SystemPage({ onGoTo }) {
  const store = sys_ensureStore();
  const [data, setData] = useSyS(() => JSON.parse(JSON.stringify(store)));
  const originalRef = useSyR(JSON.parse(JSON.stringify(store)));
  const [activeId, setActiveId] = useSyS("health");
  const stackRef = useSyR(null);

  // Audit log search + filter
  const [auditQ, setAuditQ] = useSyS("");
  const [auditCat, setAuditCat] = useSyS("All categories");
  const [newKey, setNewKey] = useSyS(null);   // displayed once after "Generate"

  // Scroll-spy (same shape as Configuration)
  useSyE(() => {
    const root = stackRef.current;
    if (!root) return;
    const sections = Array.from(root.querySelectorAll("[data-sys-section]"));
    const observer = new IntersectionObserver((entries) => {
      const visible = entries.filter((e) => e.isIntersecting);
      if (visible.length) {
        visible.sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        setActiveId(visible[0].target.getAttribute("data-sys-section"));
      }
    }, { rootMargin: "-30% 0px -55% 0px", threshold: [0, 0.5, 1] });
    sections.forEach((s) => observer.observe(s));
    return () => observer.disconnect();
  }, []);

  const dirty = useSyM(
    () => JSON.stringify(data) !== JSON.stringify(originalRef.current),
    [data]
  );

  const set = (path, value) => {
    setData((prev) => {
      const next = JSON.parse(JSON.stringify(prev));
      const keys = path.split(".");
      let o = next;
      for (let i = 0; i < keys.length - 1; i++) o = o[keys[i]];
      o[keys[keys.length - 1]] = value;
      return next;
    });
  };

  const onSave = () => {
    window.__systemStore = JSON.parse(JSON.stringify(data));
    originalRef.current = JSON.parse(JSON.stringify(data));
    setData(JSON.parse(JSON.stringify(data)));
    showToast("System settings saved", { kind: "success" });
  };
  const onDiscard = () => {
    setData(JSON.parse(JSON.stringify(originalRef.current)));
    showToast("Changes discarded");
  };

  const jumpTo = (id) => {
    const el = stackRef.current && stackRef.current.querySelector(`[data-sys-section="${id}"]`);
    if (el) {
      const offset = 88;
      const top = el.getBoundingClientRect().top + window.scrollY - offset;
      window.scrollTo({ top, behavior: "smooth" });
      setActiveId(id);
    }
  };

  // Cached so we don't rebuild the JSX-fragment-laden seed every render.
  const auditSeed = useSyM(() => sysAuditSeed(), []);

  // Filtered audit log
  const auditRows = useSyM(() => {
    const q = auditQ.trim().toLowerCase();
    return auditSeed.filter((r) => {
      if (auditCat !== "All categories" && r.category !== auditCat) return false;
      if (!q) return true;
      const t = (typeof r.title === "string" ? r.title : JSON.stringify(r.title.props || r.title)).toLowerCase();
      return t.includes(q) || r.actor.toLowerCase().includes(q);
    });
  }, [auditQ, auditCat, auditSeed]);

  const initials = (name) =>
    (name || "").split(/\s+/).slice(0, 2).map((s) => s[0] || "").join("").toUpperCase();

  // Action handlers (preview-only)
  const generateKey = () => {
    const token = "df_live_" + Math.random().toString(36).slice(2, 6) + Math.random().toString(36).slice(2, 6) +
                  "…" + Math.random().toString(36).slice(2, 5).toUpperCase();
    setNewKey(token);
    showToast("New API key created — copy it now", { kind: "success" });
  };
  const removeIp = (ip) => set("identity.ipAllowlist", data.identity.ipAllowlist.filter((x) => x !== ip));
  const keyMenu = (k) => (e) => {
    e.stopPropagation();
    if (!window.openMenu) return;
    window.openMenu(e.currentTarget, [
      { icon: "Copy", label: "Copy prefix", onClick: () => showToast("Copied to clipboard") },
      { icon: "Edit", label: "Rename", onClick: () => showToast("Rename — preview only") },
      { icon: "Adjustment", label: "Edit scopes", onClick: () => showToast("Scope editor — preview only") },
      { divider: true },
      k.status === "active"
        ? { icon: "TimeUndo", label: "Pause", onClick: () => showToast(`${k.name} paused`) }
        : { icon: "Bolt", label: "Reactivate", onClick: () => showToast(`${k.name} reactivated`) },
      { icon: "TrashCan", label: "Revoke", danger: true, onClick: () => showToast(`${k.name} revoked`, { kind: "warning" }) },
    ]);
  };
  const hookMenu = (h) => (e) => {
    e.stopPropagation();
    if (!window.openMenu) return;
    window.openMenu(e.currentTarget, [
      { icon: "Send",       label: "Send test event",  onClick: () => showToast("Test event queued") },
      { icon: "ClipboardCircleCheck", label: "View delivery log", onClick: () => showToast("Opens delivery log") },
      { icon: "Edit",       label: "Edit endpoint",    onClick: () => showToast("Edit — preview only") },
      { divider: true },
      h.status === "active"
        ? { icon: "TimeUndo", label: "Pause", onClick: () => showToast(`${h.url} paused`) }
        : { icon: "Bolt", label: "Resume", onClick: () => showToast(`${h.url} resumed`) },
      { icon: "TrashCan",   label: "Delete", danger: true, onClick: () => showToast(`${h.url} deleted`, { kind: "warning" }) },
    ]);
  };

  return (
    <div className="set-content">
      <header className="set-content-header" style={{ display: "flex", flexDirection: "column", gap: 8, padding: "8px 4px 0" }}>
        <h2 className="set-content-title">System</h2>
        <p className="set-content-sub">
          Tenant-level system settings — API access, single sign-on, data residency, retention,
          and the audit trail behind every admin action. Most controls here require the
          <strong> System admin</strong> role.
        </p>
      </header>

      <div className="cfg-layout">
        <div className="cfg-stack" ref={stackRef}>

          {/* =================== HEALTH =================== */}
          <div data-sys-section="health">
            <div className={"sys-health" + (data.health.status === "degraded" ? " sys-health--warn" : "")}>
              <div className="sys-health-left">
                <span className="sys-health-orb">
                  <Icon name={data.health.status === "degraded" ? "Alert" : "Check"} size={28} />
                </span>
                <div className="sys-health-text">
                  <p className="sys-health-eyebrow">
                    {data.health.status === "degraded" ? "Degraded performance" : "All systems operational"}
                  </p>
                  <h3 className="sys-health-title">Flex Work {data.health.version}</h3>
                  <p className="sys-health-sub">
                    Released {data.health.released} · running on {data.health.environment} ·
                    on-call engineer <strong>{data.health.onCall}</strong> · paged via PagerDuty.
                  </p>
                </div>
              </div>
              <div className="sys-health-right">
                <div className="sys-health-metric">
                  <span className="sys-health-metric-label">Uptime · 30d</span>
                  <span className="sys-health-metric-value">{data.health.uptime30d.toFixed(3)}%</span>
                </div>
                <div className="sys-health-metric">
                  <span className="sys-health-metric-label">Region</span>
                  <span className="sys-health-metric-value" style={{ fontSize: 16 }}>{data.health.region.split(" ")[0]}</span>
                </div>
                <div className="sys-health-metric">
                  <span className="sys-health-metric-label">Status</span>
                  <span className="sys-health-metric-value">
                    <SysStatus kind="active" label="Live" />
                  </span>
                </div>
              </div>
            </div>

            <div style={{ marginTop: 16 }}>
              <SectionCard
                variant="compact"
                icon="Building"
                title="Tenant details"
                action={(
                  <button type="button" className="linkbtn" onClick={() => showToast("Opens Dayforce HCM admin")}>
                    Open in Dayforce HCM <Icon name="LinkNewWindow" size={12} />
                  </button>
                )}
              >
                <div className="sys-facts">
                  <SysFact icon="Code"          label="Tenant ID"      value={data.health.tenantId}    mono />
                  <SysFact icon="Globe"         label="Data region"    value={data.health.region} />
                  <SysFact icon="Stack"         label="Environment"    value={data.health.environment} />
                  <SysFact icon="ShieldPerson"  label="Support plan"   value={data.health.supportPlan} />
                </div>
              </SectionCard>
            </div>
          </div>

          {/* =================== API ACCESS =================== */}
          <div data-sys-section="api">
            <SectionCard
              variant="compact"
              icon="Code"
              title="API access"
              action={(
                <button type="button" className="vms-btn vms-btn--secondary" onClick={generateKey}>
                  <Icon name="AddCircle" size={14} /> Generate API key
                </button>
              )}
            >
              <p className="cfg-card-blurb">
                Service tokens and personal access tokens used by partner integrations, BI sync
                jobs, and the supplier portal. We only show the prefix — the full token is
                surfaced exactly once at generation time.
              </p>

              {newKey && (
                <div className="sys-new-key" role="status" aria-live="polite">
                  <span className="sys-new-key-icon"><Icon name="Lock" size={18} /></span>
                  <div>
                    <p className="sys-new-key-title">Your new API key — copy it now, it won't be shown again.</p>
                    <span className="sys-new-key-token">{newKey}</span>
                  </div>
                  <button
                    type="button"
                    className="vms-btn vms-btn--tertiary"
                    onClick={() => { try { navigator.clipboard && navigator.clipboard.writeText(newKey); } catch (e) {} showToast("Copied", { kind: "success" }); setNewKey(null); }}
                  >
                    <Icon name="Copy" size={14} /> Copy &amp; dismiss
                  </button>
                </div>
              )}

              <div className="sys-table-wrap">
                <table className="sys-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Prefix</th>
                      <th>Scopes</th>
                      <th>Owner</th>
                      <th>Last used</th>
                      <th>Status</th>
                      <th aria-label="Actions"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.api.keys.map((k) => (
                      <tr key={k.id}>
                        <td>
                          <div className="sys-table-name">{k.name}</div>
                          <div className="sys-table-sub">{k.role} token · created {k.created}</div>
                        </td>
                        <td><span className="sys-mono">{k.prefix}</span></td>
                        <td>
                          <span className="sys-scopes">
                            {k.scopes.slice(0, 3).map((s) => <SysScope key={s} s={s} />)}
                            {k.scopes.length > 3 && <span className="sys-scope">+{k.scopes.length - 3}</span>}
                          </span>
                        </td>
                        <td>{k.owner}</td>
                        <td style={{ color: k.lastUsed === "Never" ? "var(--evr-content-primary-lowemp)" : undefined }}>
                          {k.lastUsed}
                        </td>
                        <td>
                          <SysStatus
                            kind={k.status}
                            label={k.status[0].toUpperCase() + k.status.slice(1)}
                          />
                        </td>
                        <td style={{ width: 40, textAlign: "right" }}>
                          <button type="button" className="sys-icon-btn"
                                  aria-label={`Actions for ${k.name}`} onClick={keyMenu(k)}>
                            <Icon name="MoreVert" size={18} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div style={{ marginTop: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ font: "var(--evr-caption)", color: "var(--evr-content-primary-lowemp)" }}>
                  <Icon name="Information" size={12} /> &nbsp;
                  Tokens older than 365 days with no usage are auto-revoked nightly.
                </span>
                <button type="button" className="linkbtn" onClick={() => showToast("Opens API reference")}>
                  API reference <Icon name="LinkNewWindow" size={12} />
                </button>
              </div>
            </SectionCard>
          </div>

          {/* =================== WEBHOOKS =================== */}
          <div data-sys-section="hooks">
            <SectionCard
              variant="compact"
              icon="Broadcast"
              title="Webhooks"
              action={(
                <button type="button" className="vms-btn vms-btn--secondary" onClick={() => showToast("New endpoint — preview only")}>
                  <Icon name="AddCircle" size={14} /> Add endpoint
                </button>
              )}
            >
              <p className="cfg-card-blurb">
                Outbound HTTPS endpoints that receive event payloads. Payloads are signed
                with HMAC-SHA256 using your webhook signing secret and retried with
                exponential backoff for up to 24 hours.
              </p>

              <div className="sys-hooks">
                {data.hooks.map((h) => (
                  <div className="sys-hook-row" key={h.id}>
                    <span className="sys-hook-icon"><Icon name="Broadcast" size={18} /></span>
                    <div className="sys-hook-body">
                      <div className="sys-hook-url">{h.url}</div>
                      <div className="sys-hook-meta">
                        <span>{h.events.join(", ")}</span>
                        <span className="sys-hook-meta-sep">·</span>
                        <span>{h.deliveries.toLocaleString("en-US")} deliveries</span>
                        <span className="sys-hook-meta-sep">·</span>
                        <span style={{ color: h.status === "failed" ? "var(--evr-content-status-error-default)" : undefined }}>
                          Last: {h.lastDelivery}
                        </span>
                      </div>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
                      <SysSparkbar pattern={h.spark} />
                      <SysStatus kind={h.status} label={h.status === "failed" ? "Failing" : h.status[0].toUpperCase() + h.status.slice(1)} />
                    </div>
                    <button type="button" className="sys-icon-btn"
                            aria-label={`Actions for ${h.url}`} onClick={hookMenu(h)}>
                      <Icon name="MoreVert" size={18} />
                    </button>
                  </div>
                ))}
              </div>
            </SectionCard>
          </div>

          {/* =================== IDENTITY & SECURITY =================== */}
          <div data-sys-section="identity">
            <SectionCard
              variant="compact"
              icon="ShieldPerson"
              title="Identity &amp; security"
              action={(
                <span className="cfg-conn">
                  <span className="cfg-conn-dot" />
                  SSO active
                </span>
              )}
            >
              <p className="cfg-card-blurb">
                Authentication is brokered by Dayforce HCM. Identity provider, SCIM
                provisioning, and the password policy are managed centrally in HCM.
                Flex Work owns the session, MFA, and IP allowlist policies.
              </p>

              <div className="sys-idp">
                <span className="sys-idp-mark">O</span>
                <div>
                  <p className="sys-idp-name">{data.identity.provider}</p>
                  <p className="sys-idp-sub">
                    {data.identity.providerHost} · SCIM provisioning {data.identity.scim ? "enabled" : "disabled"} · managed in {data.identity.managedIn}
                  </p>
                </div>
                <div className="sys-idp-actions">
                  <button type="button" className="vms-btn vms-btn--tertiary"
                          onClick={() => showToast("Test SSO — preview only")}>
                    Test SSO
                  </button>
                  <button type="button" className="vms-btn vms-btn--secondary"
                          onClick={() => showToast("Opens Dayforce HCM admin")}>
                    Manage <Icon name="LinkNewWindow" size={12} />
                  </button>
                </div>
              </div>

              <div style={{ marginTop: 16 }}>
                <div className="sys-policy-row">
                  <span className="sys-policy-icon"><Icon name="Lock" size={18} /></span>
                  <div>
                    <p className="sys-policy-title">Require multi-factor auth</p>
                    <p className="sys-policy-sub">
                      Enforced at sign-in for all admin and manager roles ·
                      methods: <strong>{data.identity.mfaMethod}</strong>
                    </p>
                  </div>
                  <Switch
                    checked={data.identity.mfaRequired}
                    onChange={(v) => set("identity.mfaRequired", v)}
                    ariaLabel="Require multi-factor auth"
                  />
                </div>

                <div className="sys-policy-row">
                  <span className="sys-policy-icon"><Icon name="Hourglass" size={18} /></span>
                  <div>
                    <p className="sys-policy-title">Session lifetime</p>
                    <p className="sys-policy-sub">
                      Force sign-out after an active session reaches this length.
                    </p>
                  </div>
                  <Dropdown
                    options={["2", "4", "8", "12", "24"]}
                    value={String(data.identity.sessionTimeout)}
                    onChange={(v) => set("identity.sessionTimeout", Number(v))}
                    small
                  />
                </div>

                <div className="sys-policy-row">
                  <span className="sys-policy-icon"><Icon name="TimeUndo" size={18} /></span>
                  <div>
                    <p className="sys-policy-title">Idle timeout</p>
                    <p className="sys-policy-sub">
                      Sign users out after this many minutes of inactivity.
                    </p>
                  </div>
                  <Dropdown
                    options={["15", "30", "45", "60", "90", "120"]}
                    value={String(data.identity.idleTimeout)}
                    onChange={(v) => set("identity.idleTimeout", Number(v))}
                    small
                  />
                </div>

                <div className="sys-policy-row">
                  <span className="sys-policy-icon"><Icon name="Globe" size={18} /></span>
                  <div style={{ minWidth: 0 }}>
                    <p className="sys-policy-title">IP allowlist</p>
                    <p className="sys-policy-sub">
                      When enabled, sign-in is blocked from IPs outside these CIDR ranges.
                    </p>
                    <div className="sys-iplist">
                      {data.identity.ipAllowlist.map((ip) => (
                        <span className="sys-ip" key={ip}>
                          {ip}
                          <button type="button" className="sys-ip-remove" aria-label={`Remove ${ip}`}
                                  onClick={() => removeIp(ip)}>
                            <Icon name="X" size={12} />
                          </button>
                        </span>
                      ))}
                      <button type="button" className="sys-ip-add"
                              onClick={() => showToast("Add CIDR — preview only")}>
                        <Icon name="AddCircle" size={12} /> Add CIDR
                      </button>
                    </div>
                  </div>
                  <Switch
                    checked={data.identity.ipAllowlistEnabled}
                    onChange={(v) => set("identity.ipAllowlistEnabled", v)}
                    ariaLabel="Enable IP allowlist"
                  />
                </div>
              </div>
            </SectionCard>
          </div>

          {/* =================== DATA RESIDENCY & RETENTION =================== */}
          <div data-sys-section="data">
            <SectionCard
              variant="compact"
              icon="Stack"
              title="Data residency &amp; retention"
            >
              <p className="cfg-card-blurb">
                Where your data is stored and how long it's kept before automatic deletion.
                Residency is set at tenant provisioning and cannot be changed here — contact
                Dayforce Support to migrate regions.
              </p>

              <div className="sys-residency">
                <div className="sys-region-card">
                  <div className="sys-region-cap">
                    <span className="sys-region-flag"><Icon name="Globe" size={20} /></span>
                    <div>
                      <p className="sys-region-name">{data.data.region}</p>
                      <p className="sys-region-sub">
                        <span style={{ fontFamily: "var(--evr-font-mono)" }}>{data.data.regionCode}</span>
                        &nbsp;· compliant with <strong>SOC 2 · ISO 27001 · HIPAA</strong>
                      </p>
                    </div>
                  </div>
                  <div className="sys-region-list">
                    {data.data.facilities.map((f) => (
                      <div className="sys-region-list-row" key={f.label}>
                        <span>{f.label}</span>
                        <strong>{f.value}</strong>
                      </div>
                    ))}
                  </div>
                  <div style={{ display: "flex", gap: 12, marginTop: 4 }}>
                    <span className="cfg-tag cfg-tag--neutral" style={{ background: "var(--evr-surface-decorative-low-green)", color: "var(--evr-content-status-success-default)" }}>
                      <Icon name="Check" size={12} /> GDPR
                    </span>
                    <span className="cfg-tag cfg-tag--neutral" style={{ background: "var(--evr-surface-decorative-low-green)", color: "var(--evr-content-status-success-default)" }}>
                      <Icon name="Check" size={12} /> CCPA
                    </span>
                  </div>
                </div>

                <div>
                  <p className="cfg-field-label" style={{ marginBottom: 12 }}>Retention policies</p>
                  <div className="sys-retain">
                    {[
                      ["requisitions", "Requisitions",  "Open + closed requisitions"],
                      ["timesheets",   "Timesheets",    "Approved timesheets + edits"],
                      ["invoices",     "Invoices",      "Approved + voided invoices"],
                      ["workers",      "Worker records","Post-deactivation"],
                      ["auditLog",     "Audit log",     "This page + admin events"],
                      ["attachments",  "Attachments",   "Uploaded files & receipts"],
                    ].map(([key, label, sub]) => {
                      const v = data.data.retention[key];
                      const pct = Math.min(100, (v / SYS_RETAIN_MAX) * 100);
                      return (
                        <div className="sys-retain-row" key={key}>
                          <div>
                            <span className="sys-retain-label">{label}</span>
                            <span className="sys-retain-label-sub">{sub}</span>
                          </div>
                          <div
                            className="sys-retain-track"
                            role="slider"
                            aria-valuemin={1}
                            aria-valuemax={SYS_RETAIN_MAX}
                            aria-valuenow={v}
                            aria-label={`${label} retention`}
                            tabIndex={0}
                            onKeyDown={(e) => {
                              if (e.key === "ArrowRight" && v < SYS_RETAIN_MAX) set(`data.retention.${key}`, v + 1);
                              if (e.key === "ArrowLeft"  && v > 1) set(`data.retention.${key}`, v - 1);
                            }}
                            onClick={(e) => {
                              const rect = e.currentTarget.getBoundingClientRect();
                              const x = (e.clientX - rect.left) / rect.width;
                              set(`data.retention.${key}`, Math.max(1, Math.min(SYS_RETAIN_MAX, Math.round(x * SYS_RETAIN_MAX))));
                            }}
                            style={{ cursor: "pointer" }}
                          >
                            <span className="sys-retain-fill" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="sys-retain-input">
                            <input
                              type="number"
                              min={1}
                              max={SYS_RETAIN_MAX}
                              value={v}
                              onChange={(e) => {
                                const n = Math.max(1, Math.min(SYS_RETAIN_MAX, Number(e.target.value) || 1));
                                set(`data.retention.${key}`, n);
                              }}
                            />
                            <span>{v === 1 ? "yr" : "yrs"}</span>
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid var(--evr-border-decorative-lowemp)" }}>
                <div className="cfg-link-row">
                  <div>
                    <p className="cfg-link-title">Data subject requests</p>
                    <p className="cfg-link-sub">Export or erase data on behalf of a worker, supplier contact, or employee.</p>
                  </div>
                  <button type="button" className="cfg-link-go"
                          onClick={() => showToast("Opens DSR workflow")}>
                    Open DSR tool <Icon name="ChevronRight" size={14} />
                  </button>
                </div>
                <div className="cfg-link-row" style={{ borderBottom: 0 }}>
                  <div>
                    <p className="cfg-link-title">Tenant export</p>
                    <p className="cfg-link-sub">Generate a full encrypted export of this tenant — ~6 hours, delivered via secure link.</p>
                  </div>
                  <button type="button" className="cfg-link-go"
                          onClick={() => showToast("Tenant export queued")}>
                    Request export <Icon name="ChevronRight" size={14} />
                  </button>
                </div>
              </div>
            </SectionCard>
          </div>

          {/* =================== AUDIT LOG =================== */}
          <div data-sys-section="audit">
            <SectionCard
              variant="compact"
              icon="Gavel"
              title="Audit log"
              action={(
                <button type="button" className="vms-btn vms-btn--secondary"
                        onClick={() => showToast("Export — preview only")}>
                  <Icon name="Export" size={14} /> Export CSV
                </button>
              )}
            >
              <p className="cfg-card-blurb">
                Every privileged action — API key changes, role assignments, security policy
                updates, data exports — is logged here. Records are immutable and retained for
                <strong> {data.data.retention.auditLog} years</strong>.
              </p>

              <div className="sys-audit-toolbar">
                <div className="sys-audit-search">
                  <span className="sys-audit-search-icon"><Icon name="Search" size={16} /></span>
                  <input
                    placeholder="Search by actor or action…"
                    value={auditQ}
                    onChange={(e) => setAuditQ(e.target.value)}
                  />
                </div>
                <select className="sys-audit-select"
                        value={auditCat}
                        onChange={(e) => setAuditCat(e.target.value)}
                        aria-label="Filter by category">
                  <option>All categories</option>
                  <option>API</option>
                  <option>Webhooks</option>
                  <option>Identity</option>
                  <option>Security</option>
                  <option>Roles</option>
                  <option>Data</option>
                  <option>AI</option>
                </select>
                <button type="button" className="vms-btn vms-btn--tertiary"
                        onClick={() => { setAuditQ(""); setAuditCat("All categories"); }}>
                  Reset
                </button>
                <span style={{ marginLeft: "auto", font: "var(--evr-caption)", color: "var(--evr-content-primary-lowemp)" }}>
                  Showing {auditRows.length} of {auditSeed.length}
                </span>
              </div>

              <div className="sys-audit">
                {auditRows.length === 0 ? (
                  <div style={{ padding: 32, textAlign: "center", color: "var(--evr-content-primary-lowemp)" }}>
                    No events match. Try clearing filters.
                  </div>
                ) : auditRows.map((r) => (
                  <div className="sys-audit-row" key={r.id}>
                    <span className={`sys-audit-icon sys-audit-icon--${r.kind}`}>
                      <Icon name={r.icon} size={14} />
                    </span>
                    <div className="sys-audit-body">
                      <p className="sys-audit-title">{r.title}</p>
                      <p className="sys-audit-meta">{r.category} · {r.ip}</p>
                    </div>
                    <div className="sys-audit-actor">
                      <span className="sys-audit-actor-avatar">{initials(r.actor)}</span>
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.actor}</span>
                    </div>
                    <span className="sys-audit-time">{r.time}</span>
                  </div>
                ))}

                <div className="sys-audit-footer">
                  <button type="button" className="linkbtn"
                          onClick={() => showToast("Opens full audit log")}>
                    View full audit log · 4,218 events <Icon name="ChevronRight" size={12} />
                  </button>
                </div>
              </div>
            </SectionCard>
          </div>

          {/* Sticky save bar */}
          {dirty && (
            <div className="cfg-savebar" role="status" aria-live="polite">
              <Icon name="Edit" size={16} />
              <span className="cfg-savebar-text">
                You have <strong>unsaved changes</strong>. Some changes (session timeout, IP
                allowlist, retention) take effect immediately on save.
              </span>
              <button type="button" className="vms-btn vms-btn--tertiary" onClick={onDiscard}>
                Discard
              </button>
              <button type="button" className="vms-btn vms-btn--primary" onClick={onSave}>
                <Icon name="Check" size={14} /> Save changes
              </button>
            </div>
          )}
        </div>

        {/* Right rail */}
        <aside className="cfg-rail" aria-label="On this page">
          <div className="cfg-rail-title">On this page</div>
          {SYS_RAIL.map((it) => (
            <a
              key={it.id}
              href={`#${it.id}`}
              className={"cfg-rail-link" + (activeId === it.id ? " cfg-rail-link--active" : "")}
              onClick={(e) => { e.preventDefault(); jumpTo(it.id); }}
            >
              <Icon name={it.icon} size={14} />
              {it.label}
            </a>
          ))}
        </aside>
      </div>
    </div>
  );
}

Object.assign(window, { SystemPage });
