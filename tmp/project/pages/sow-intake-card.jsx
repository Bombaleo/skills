// =====================================================================
// Flex Work — SOW intake card
//   Drop-in card for the New Requisition flow when engType =
//   "Statement of Work". Lets the Manager pick from the templates,
//   fee schedules, and retainage policies the Admin configured in
//   Settings → Configuration → SOW program. Surfaces nothing if the
//   SOW engagement type is off or sow-config.jsx hasn't loaded.
//
//   Reads from:
//     · window.getEnabledSowTemplates()
//     · window.getEnabledFeeSchedules()
//     · window.getEnabledRetainagePolicies()
//
//   Hosted by: pages/new-requisition.jsx (rendered between Setup +
//              Work assignments cards when engType === "Statement of Work").
// =====================================================================

(function () {
  const { useState, useMemo, useEffect } = React;

  function SowIntakeCard() {
    const templates    = useMemo(() => (window.getEnabledSowTemplates    && window.getEnabledSowTemplates())    || [], []);
    const feeSchedules = useMemo(() => (window.getEnabledFeeSchedules    && window.getEnabledFeeSchedules())    || [], []);
    const retainage    = useMemo(() => (window.getEnabledRetainagePolicies && window.getEnabledRetainagePolicies()) || [], []);

    const initialTpl = (templates.find((t) => t.id === "tpl-pro-services") || templates[0] || null);
    const [tplId, setTplId] = useState(initialTpl ? initialTpl.id : "");
    const tpl = templates.find((t) => t.id === tplId) || initialTpl;

    const [feeId, setFeeId] = useState(() => {
      if (!tpl) return feeSchedules[0] ? feeSchedules[0].id : "";
      const match = feeSchedules.find((f) => f.model === tpl.billingModel);
      return match ? match.id : (feeSchedules[0] ? feeSchedules[0].id : "");
    });
    const fee = feeSchedules.find((f) => f.id === feeId) || feeSchedules[0];

    const [retId, setRetId] = useState(() => {
      if (!tpl) return retainage[0] ? retainage[0].id : "";
      const match = retainage.find((r) => r.pct === tpl.defaultRetainagePct);
      return match ? match.id : (retainage[0] ? retainage[0].id : "");
    });
    const ret = retainage.find((r) => r.id === retId) || retainage[0];

    // Resnap dependent fields when the template changes
    useEffect(() => {
      if (!tpl) return;
      const feeMatch = feeSchedules.find((f) => f.model === tpl.billingModel);
      if (feeMatch) setFeeId(feeMatch.id);
      const retMatch = retainage.find((r) => r.pct === tpl.defaultRetainagePct);
      if (retMatch) setRetId(retMatch.id);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tplId]);

    if (templates.length === 0) {
      return (
        <section className="sc sc--compact">
          <header className="sc-head sc-head--compact">
            <span className="acc-card-avatar" aria-hidden="true">
              <Icon name="EngagementSow" size={20} />
            </span>
            <h2 className="acc-card-title">Statement of Work program</h2>
          </header>
          <div className="sc-body">
            <p className="cfg-card-blurb">
              No SOW templates are configured. Add templates in Settings → Configuration → SOW program.
            </p>
          </div>
        </section>
      );
    }

    return (
      <section className="sc sc--compact">
        <header className="sc-head sc-head--compact">
          <span className="acc-card-avatar" aria-hidden="true">
            <Icon name="EngagementSow" size={20} />
          </span>
          <h2 className="acc-card-title">Statement of Work program</h2>
          <span className="cfg-tag cfg-tag--neutral">
            <Icon name="Information" size={12} />
            {templates.length} templates · {feeSchedules.length} fee schedules
          </span>
        </header>
        <div className="sc-body">
          <p className="cfg-card-blurb">
            Pick a template to seed milestones and the billing model. Fee schedule and retainage default from the template — override here if the engagement deserves it. Everything you set persists into the SOW that ships from this requisition.
          </p>

          <div className="sowi-grid">
            {/* Template picker */}
            <div className="sowi-field">
              <label className="sowi-lab">Template</label>
              <div className="sowi-tpl-list" role="radiogroup">
                {templates.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    role="radio"
                    aria-checked={t.id === tplId}
                    className={"sowi-tpl" + (t.id === tplId ? " sowi-tpl--on" : "")}
                    onClick={() => setTplId(t.id)}
                  >
                    <span className="sowi-tpl-ic"><Icon name={t.icon || "Notes"} size={18} /></span>
                    <span className="sowi-tpl-body">
                      <span className="sowi-tpl-name">{t.name}</span>
                      <span className="sowi-tpl-cat">{t.category}</span>
                    </span>
                  </button>
                ))}
              </div>
              {tpl && (
                <p className="sowi-tpl-desc">{tpl.description}</p>
              )}
            </div>

            {/* Fee schedule + Retainage */}
            <div className="sowi-row">
              <label className="sowi-field">
                <span className="sowi-lab">Fee schedule</span>
                <select
                  className="sowd-fld-input"
                  value={feeId}
                  onChange={(e) => setFeeId(e.target.value)}
                >
                  {feeSchedules.map((f) => (
                    <option key={f.id} value={f.id}>{f.name}</option>
                  ))}
                </select>
                {fee && <small className="sowi-hint">{fee.description}</small>}
              </label>
              <label className="sowi-field">
                <span className="sowi-lab">Retainage policy</span>
                <select
                  className="sowd-fld-input"
                  value={retId}
                  onChange={(e) => setRetId(e.target.value)}
                >
                  {retainage.map((r) => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </select>
                {ret && (
                  <small className="sowi-hint">
                    {ret.pct === 0
                      ? "No holdback — full fee fires on acceptance."
                      : `${ret.pct}% withheld, released on ${ret.releaseTrigger}.`}
                  </small>
                )}
              </label>
            </div>

            {/* Preview chip strip */}
            {tpl && tpl.milestones && tpl.milestones.length > 0 && (
              <div className="sowi-field">
                <span className="sowi-lab">Default milestones <span className="sowi-hint sowi-hint--inline">— editable on the next step</span></span>
                <ol className="sowi-ms" role="list">
                  {tpl.milestones.map((m, i) => (
                    <li key={i}>
                      <span className="sowi-ms-num">{i + 1}</span>
                      <span>{m}</span>
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </div>
        </div>
      </section>
    );
  }

  Object.assign(window, { SowIntakeCard });
})();
