// =====================================================================
// Flex Work — Settings · Talent pool rules
// Configures the direct-sourcing cascade: which buyer-owned pools see a
// requisition before agency suppliers, in what order, how long each pool
// gets to respond, and whether the cascade auto-expands when a window
// closes. Pool data + colour story comes from workforce.jsx via window.
// =====================================================================

const { useState: useStateTpr, useMemo: useMemoTpr } = React;

function TalentPoolRulesPage() {
  const POOL_META  = window.POOL_META  || {};
  const POOL_ORDER = window.POOL_ORDER || [];
  const WORKERS    = window.WORKERS    || [];

  // Initial cascade — every buyer-owned pool ON, in the order workforce.jsx
  // defined, each with a default response window. "Agency suppliers" is
  // the final stop (always on, can't reorder above buyer pools).
  const DEFAULT_RULES = useMemoTpr(() => POOL_ORDER
    .filter((p) => p !== "Agency")
    .map((p, i) => ({
      pool: p,
      enabled: true,
      window: i === 0 ? "15 min" : i === 1 ? "30 min" : "1 h",
    })), [POOL_ORDER]);

  const [directSourcing, setDirectSourcing] = useStateTpr(true);
  const [autoExpand, setAutoExpand]         = useStateTpr(true);
  const [rules, setRules]                   = useStateTpr(DEFAULT_RULES);

  const move = (idx, dir) => {
    setRules((rs) => {
      const next = rs.slice();
      const j = idx + dir;
      if (j < 0 || j >= next.length) return rs;
      [next[idx], next[j]] = [next[j], next[idx]];
      return next;
    });
  };
  const update = (idx, patch) => {
    setRules((rs) => rs.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  };

  // Pool counts for the right-rail summary so admins see the population
  // they're routing requisitions through.
  const counts = useMemoTpr(() => {
    const c = {};
    POOL_ORDER.forEach((p) => { c[p] = WORKERS.filter((w) => w.pool === p).length; });
    return c;
  }, [WORKERS, POOL_ORDER]);

  return (
    <div className="set-content">
      <header className="set-content-header">
        <h2 className="set-content-title">Talent pool rules</h2>
        <p className="set-content-sub">
          Configure how requisitions cascade through your buyer-owned pools before reaching agency suppliers.
        </p>
      </header>

      {/* Direct sourcing master toggle */}
      <section className="content-card" style={{ padding: 20, marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h3 style={{ margin: 0, font: "var(--evr-h4)", color: "var(--evr-content-primary-highemp)" }}>
              Direct sourcing
            </h3>
            <p style={{ margin: "4px 0 0", font: "var(--evr-body2)", color: "var(--evr-content-primary-lowemp)" }}>
              {directSourcing
                ? "On — requisitions are offered to your pools first, then to agency suppliers."
                : "Off — every requisition broadcasts to agency suppliers immediately."}
            </p>
          </div>
          <label style={{ display: "inline-flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={directSourcing}
              onChange={(e) => setDirectSourcing(e.target.checked)}
              style={{ width: 18, height: 18 }}
            />
            <span style={{ font: "var(--evr-body2)", color: "var(--evr-content-primary-default)" }}>
              {directSourcing ? "Enabled" : "Disabled"}
            </span>
          </label>
        </div>
      </section>

      {/* Cascade order */}
      <section
        className="content-card"
        style={{ padding: 20, marginBottom: 16, opacity: directSourcing ? 1 : 0.55, transition: "opacity 150ms" }}
      >
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 16 }}>
          <div>
            <h3 style={{ margin: 0, font: "var(--evr-h4)", color: "var(--evr-content-primary-highemp)" }}>
              Cascade order
            </h3>
            <p style={{ margin: "4px 0 0", font: "var(--evr-body2)", color: "var(--evr-content-primary-lowemp)" }}>
              Each pool gets its response window. When the window closes, the cascade moves on.
            </p>
          </div>
          <span style={{ font: "var(--evr-body2)", color: "var(--evr-content-primary-lowemp)" }}>
            {rules.filter((r) => r.enabled).length} of {rules.length} pools active
          </span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {rules.map((r, idx) => {
            const meta = POOL_META[r.pool] || {};
            return (
              <div
                key={r.pool}
                style={{
                  display: "grid",
                  gridTemplateColumns: "44px 1fr 140px 160px 88px",
                  alignItems: "center",
                  gap: 16,
                  padding: "12px 16px",
                  background: "var(--evr-surface-primary-default)",
                  border: "1px solid var(--evr-border-decorative-lowemp)",
                  borderRadius: "var(--evr-radius-2xs)",
                  opacity: r.enabled ? 1 : 0.55,
                }}
              >
                <span
                  style={{
                    width: 28, height: 28, borderRadius: "var(--evr-radius-circle)",
                    background: "var(--evr-neutral-95)",
                    color: "var(--evr-content-primary-highemp)",
                    display: "inline-flex", alignItems: "center", justifyContent: "center",
                    font: "var(--evr-button-sm)", fontWeight: "var(--evr-fw-demibold)",
                  }}
                  aria-hidden="true"
                >
                  {idx + 1}
                </span>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                  <span
                    className="sup-chip"
                    style={{
                      width: 32, height: 32, fontSize: 11,
                      background: meta.bg, color: meta.fg,
                    }}
                    aria-hidden="true"
                  >
                    {meta.icon && <Icon name={meta.icon} size={18} />}
                  </span>
                  <span style={{ minWidth: 0 }}>
                    <span
                      style={{
                        display: "block",
                        font: "var(--evr-body1-bold)",
                        color: "var(--evr-content-primary-highemp)",
                      }}
                    >{meta.label || r.pool}</span>
                    <span style={{ font: "var(--evr-caption)", color: "var(--evr-content-primary-lowemp)" }}>
                      {counts[r.pool] || 0} workers
                    </span>
                  </span>
                </span>
                <label style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                  <input
                    type="checkbox"
                    checked={r.enabled}
                    onChange={(e) => update(idx, { enabled: e.target.checked })}
                    style={{ width: 16, height: 16 }}
                    disabled={!directSourcing}
                  />
                  <span style={{ font: "var(--evr-body2)", color: "var(--evr-content-primary-default)" }}>
                    {r.enabled ? "Active" : "Skipped"}
                  </span>
                </label>
                <select
                  className="fld-input"
                  value={r.window}
                  onChange={(e) => update(idx, { window: e.target.value })}
                  disabled={!r.enabled || !directSourcing}
                  aria-label={`${meta.label || r.pool} response window`}
                  style={{
                    background: "var(--evr-surface-primary-default)",
                    border: "1px solid var(--evr-border-decorative-default)",
                    borderRadius: "var(--evr-radius-3xs)",
                    padding: "6px 10px",
                    font: "var(--evr-body2)",
                    cursor: "pointer",
                  }}
                >
                  <option>5 min</option>
                  <option>15 min</option>
                  <option>30 min</option>
                  <option>1 h</option>
                  <option>2 h</option>
                  <option>4 h</option>
                </select>
                <span style={{ display: "inline-flex", justifyContent: "flex-end", gap: 4 }}>
                  <button
                    type="button"
                    className="iconbtn"
                    onClick={() => move(idx, -1)}
                    disabled={idx === 0 || !directSourcing}
                    aria-label={`Move ${r.pool} up`}
                  >
                    <Icon name="ChevronUp" size={16} />
                  </button>
                  <button
                    type="button"
                    className="iconbtn"
                    onClick={() => move(idx, 1)}
                    disabled={idx === rules.length - 1 || !directSourcing}
                    aria-label={`Move ${r.pool} down`}
                  >
                    <Icon name="ChevronDown" size={16} />
                  </button>
                </span>
              </div>
            );
          })}

          {/* Terminal stop: agency suppliers */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "44px 1fr 140px 160px 88px",
              alignItems: "center",
              gap: 16,
              padding: "12px 16px",
              background: "var(--evr-surface-secondary-default)",
              border: "1px dashed var(--evr-border-decorative-default)",
              borderRadius: "var(--evr-radius-2xs)",
            }}
          >
            <span
              style={{
                width: 28, height: 28, borderRadius: "var(--evr-radius-circle)",
                background: "var(--evr-neutral-95)",
                color: "var(--evr-content-primary-lowemp)",
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                font: "var(--evr-button-sm)", fontWeight: "var(--evr-fw-demibold)",
              }}
              aria-hidden="true"
            >
              {rules.length + 1}
            </span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
              <span
                className="sup-chip"
                style={{
                  width: 32, height: 32, fontSize: 11,
                  background: POOL_META.Agency?.bg,
                  color: POOL_META.Agency?.fg,
                }}
                aria-hidden="true"
              >
                <Icon name="Building" size={18} />
              </span>
              <span>
                <span style={{ display: "block", font: "var(--evr-body1-bold)", color: "var(--evr-content-primary-highemp)" }}>
                  Agency suppliers
                </span>
                <span style={{ font: "var(--evr-caption)", color: "var(--evr-content-primary-lowemp)" }}>
                  Final fallback · uses supplier distribution rules
                </span>
              </span>
            </span>
            <span style={{ font: "var(--evr-body2)", color: "var(--evr-content-primary-lowemp)" }}>Always on</span>
            <span style={{ font: "var(--evr-body2)", color: "var(--evr-content-primary-lowemp)" }}>Per supplier</span>
            <span></span>
          </div>
        </div>

        {/* Auto-expand */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 16,
            marginTop: 16,
            padding: "12px 16px",
            background: "var(--evr-surface-secondary-default)",
            borderRadius: "var(--evr-radius-2xs)",
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: "block", font: "var(--evr-body1-bold)", color: "var(--evr-content-primary-highemp)" }}>
              Auto-expand to next pool when window closes
            </span>
            <span style={{ font: "var(--evr-body2)", color: "var(--evr-content-primary-lowemp)" }}>
              If off, requisitions stop at the first pool that doesn't fill and require a manager to escalate.
            </span>
          </div>
          <label style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            <input
              type="checkbox"
              checked={autoExpand}
              onChange={(e) => setAutoExpand(e.target.checked)}
              disabled={!directSourcing}
              style={{ width: 16, height: 16 }}
            />
            <span style={{ font: "var(--evr-body2)", color: "var(--evr-content-primary-default)" }}>
              {autoExpand ? "Enabled" : "Disabled"}
            </span>
          </label>
        </div>
      </section>

      <footer
        style={{
          display: "flex",
          justifyContent: "flex-end",
          gap: 12,
          paddingTop: 12,
        }}
      >
        <button
          type="button"
          className="btn btn--md btn--secondary"
          onClick={() => {
            setRules(DEFAULT_RULES);
            setDirectSourcing(true);
            setAutoExpand(true);
            showToast("Reset to default cascade");
          }}
        >
          Reset to defaults
        </button>
        <button
          type="button"
          className="btn btn--md btn--primary"
          onClick={() => showToast("Pool rules saved", { kind: "success" })}
        >
          Save changes
        </button>
      </footer>
    </div>
  );
}

Object.assign(window, { TalentPoolRulesPage });
