// =====================================================================
// Flex Work — Compliance & credentials
// Worker-credential lifecycle: expired, expiring-soon, missing,
// blocked, and recently-renewed. Strategic VMS surface — pulls from
// COMPLIANCE seed data plus the live WORKERS roster.
// =====================================================================

const { useState: useStateCmp, useMemo: useMemoCmp } = React;

const CMP_FILTERS = [
  { id: "all",      label: "All",            level: null },
  { id: "expired",  label: "Expired",        level: "err" },
  { id: "expiring", label: "Expiring soon",  level: "warn" },
  { id: "missing",  label: "Missing",        level: "err" },
  { id: "blocked",  label: "Blocked",        level: "warn" },
  { id: "renewed",  label: "Renewed",        level: "ok" },
];

function CmpKpi({ label, value, level, foot }) {
  return (
    <div className={"vms-kpi" + (level === "err" ? " vms-kpi--alert" : "")}>
      <span className="vms-kpi-label">{label}</span>
      <span className="vms-kpi-value tabular">{value}</span>
      <span className="vms-kpi-foot"><span>{foot}</span></span>
    </div>
  );
}

function CmpRow({ c }) {
  const iconFor = (kind) => ({
    expired:  "Alert",
    missing:  "PersonUnauthorize",
    expiring: "Hourglass",
    block:    "Lock",
    renewed:  "ClipboardCircleCheck",
  })[kind] || "Alert";
  return (
    <div className="vms-comp-row">
      <span className={`vms-comp-ic vms-comp-ic--${c.level}`} aria-hidden="true">
        <Icon name={iconFor(c.kind)} size={20} />
      </span>
      <div className="vms-comp-body">
        <p className="vms-comp-title">{c.title}</p>
        <span className="vms-comp-meta">{c.meta}</span>
      </div>
      <span className="vms-emp-lowemp" style={{ font: "var(--evr-caption)", whiteSpace: "nowrap" }}>{c.id}</span>
      <button
        type="button"
        className="vms-btn vms-btn--sm vms-btn--secondary"
        onClick={() => showToast(`Action: ${c.action}`)}
      >
        {c.action}
      </button>
    </div>
  );
}

function CompliancePage({ reloadKey, onReload, embedded = false }) {
  const [filter, setFilter] = useStateCmp("all");
  const items = window.COMPLIANCE || [];

  const counts = useMemoCmp(() => {
    const c = { expired: 0, expiring: 0, missing: 0, blocked: 0, renewed: 0 };
    items.forEach((it) => {
      if (it.kind === "expired")  c.expired++;
      if (it.kind === "expiring") c.expiring++;
      if (it.kind === "missing")  c.missing++;
      if (it.kind === "block")    c.blocked++;
      if (it.kind === "renewed")  c.renewed++;
    });
    return c;
  }, [items]);

  const filtered = useMemoCmp(() => {
    if (filter === "all") return items;
    const map = { expired: "expired", expiring: "expiring", missing: "missing", blocked: "block", renewed: "renewed" };
    return items.filter((it) => it.kind === map[filter]);
  }, [filter, items]);

  // Group by supplier from the meta string (lightweight — for the audit roll-up)
  const supplierTouch = useMemoCmp(() => {
    const map = new Map();
    items.forEach((it) => {
      const m = (it.meta || "").match(/^([A-Za-z][A-Za-z0-9 ]*?)\s·/);
      if (m) {
        const k = m[1].trim();
        map.set(k, (map.get(k) || 0) + 1);
      }
    });
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [items]);

  return (
    <React.Fragment>
      {!embedded && (
      <Omnibar
        icon="ShieldPerson"
        title="Compliance"
        dayforce={{
          primitive: "Credentialing",
          subtitle: "qualification expiry rollups",
          product: "People",
          strategy: "Rebuild",
          note: "Compliance status reads from Dayforce's credentialing engine — the same rollups that govern badged employees. The bespoke Flex Work Compliant/Onboarding/Expired column collapses into qualification expiry on the Employee record.",
          anchor: "people",
        }}
      >
        <button type="button" className="iconbtn" onClick={onReload} aria-label="Reload" title="Reload">
          <Icon name="Refresh" size={18} />
        </button>
        <button type="button" className="vms-btn vms-btn--sm vms-btn--secondary">
          <Icon name="FileDownload" size={14} />Audit log
        </button>
        <button type="button" className="vms-btn vms-btn--sm vms-btn--primary" onClick={() => showToast("Audit run started")}>
          <Icon name="ClipboardPerson" size={14} />Run audit
        </button>
      </Omnibar>
      )}

      <div className={"vms-page" + (embedded ? " vms-page--embedded" : "")} key={reloadKey}>
        {/* v0.77 spec §15 · the compliance hub reorganizes by axis in
            Phase 4: Credentials (Shift) · Classification (IC) · Tax
            Forms (IC + EOR) · Local Employment (EOR). Banner explains
            what's coming. Hidden at flag-off. */}
        {window.V77InfoBanner ? (
          <window.V77InfoBanner
            icon="Information"
            title="Compliance hub reorganizes by axis."
          >
            Phase 4 splits this surface into axis-scoped tabs: Credentials for shift-bookable work, Classification for IC, Tax Forms for IC + EOR, Local Employment for EOR.
          </window.V77InfoBanner>
        ) : null}
        {/* KPI strip */}
        <div className="vms-kpis">
          <CmpKpi label="Expired credentials"   value={counts.expired} level="err"  foot="suspend new work assignments" />
          <CmpKpi label="Expiring in 30 d"      value={counts.expiring} level="warn" foot="proactive renewals" />
          <CmpKpi label="Missing documents"     value={counts.missing} level="err"  foot="cannot start shifts" />
          <CmpKpi label="Blocked workers"       value={counts.blocked} level="warn" foot="awaiting external" />
          <CmpKpi label="Renewed (7 d)"         value={counts.renewed} level="ok"   foot="auto + manual" />
        </div>

        {/* Main + supplier roll-up */}
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.6fr) minmax(0, 1fr)", gap: 24, alignItems: "start" }}>
          <div className="vms-card">
            <div className="vms-card-head">
              <div>
                <h2 className="vms-card-title">Credential queue</h2>
                <p className="vms-card-sub">Workers with credentials that need attention before their next shift</p>
              </div>
              <button type="button" className="vms-card-link" onClick={() => showToast("Bulk reminder sent")}>
                Bulk remind
              </button>
            </div>
            <div className="vms-chiprow">
              {CMP_FILTERS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  className={"req-pill req-pill--default"}
                  style={{
                    cursor: "pointer",
                    border: filter === f.id ? "1px solid var(--evr-interactive-primary-default)" : "1px solid var(--evr-border-decorative-lowemp)",
                    color: filter === f.id ? "var(--evr-interactive-primary-default)" : undefined,
                    background: filter === f.id ? "var(--evr-interactive-primary-decorative)" : undefined,
                  }}
                  onClick={() => setFilter(f.id)}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <div className="vms-comp-list">
              {filtered.length === 0 && (
                <p className="vms-empty">No items match this filter.</p>
              )}
              {filtered.map((c) => <CmpRow key={c.id} c={c} />)}
            </div>
          </div>

          <div className="vms-card">
            <div className="vms-card-head">
              <div>
                <h2 className="vms-card-title">By supplier</h2>
                <p className="vms-card-sub">Open items rolling up to each agency</p>
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              {supplierTouch.map(([nm, n]) => (
                <div key={nm} style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 12, alignItems: "center", padding: "10px 0", borderTop: "1px solid var(--evr-border-decorative-lowemp)" }}>
                  <span style={{ font: "var(--evr-body2-bold)", color: "var(--evr-content-primary-highemp)" }}>{nm}</span>
                  <span className={"vms-inbox-count" + (n >= 2 ? " vms-inbox-count--err" : "")}>{n}</span>
                </div>
              ))}
              {supplierTouch.length === 0 && <p className="vms-empty">No open items.</p>}
            </div>
            <div style={{ paddingTop: 12, borderTop: "1px solid var(--evr-border-decorative-lowemp)", font: "var(--evr-caption)", color: "var(--evr-content-primary-lowemp)" }}>
              SLA: 24 hours to confirm renewal request, 72 hours to provide updated document.
            </div>
          </div>
        </div>

      </div>
    </React.Fragment>
  );
}

Object.assign(window, { CompliancePage });
