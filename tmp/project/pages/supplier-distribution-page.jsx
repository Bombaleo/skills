// =====================================================================
// Flex Work — Supplier Distribution (main page + summary + override panel)
//
// Continuation of supplier-distribution.jsx — splits the file so neither
// half exceeds the soft limit. The sub-components (StrategyCard, TierRow,
// IndividualRow, DxRow, DayPills, etc.) live in supplier-distribution.jsx
// and are picked up from the global scope.
// =====================================================================

// ---------- Strategy summary header chip -------------------------------
function StrategyChip({ kind }) {
  const meta = STRATEGY_META[kind];
  return (
    <span className={`dx-strategy-chip dx-strategy-chip--${kind}`}>
      <Icon name={meta.icon} size={14} />
      {meta.short}
    </span>
  );
}

// =====================================================================
// SupplierDistributionForm — the editable form. Used inside the global
// settings page AND inside the per-scope override side panel.
// =====================================================================
function SupplierDistributionForm({ value, onChange, scope = "Global default" }) {
  const v = value;
  const set = (patch) => onChange({ ...v, ...patch });

  // ---- Tier mutators (just data; rendering is in TierRow) -------------
  const renameTier = (id, name) => set({ tiers: v.tiers.map((t) => t.id === id ? { ...t, name } : t) });
  const tierWindow = (id, window) => set({ tiers: v.tiers.map((t) => t.id === id ? { ...t, window } : t) });
  const tierEscalate = (id, escalate) => set({ tiers: v.tiers.map((t) => t.id === id ? { ...t, escalate } : t) });
  const tierAddSup = (id, sid) => set({ tiers: v.tiers.map((t) => t.id === id ? { ...t, suppliers: [...t.suppliers, sid] } : t) });
  const tierRemoveSup = (id, sid) => set({ tiers: v.tiers.map((t) => t.id === id ? { ...t, suppliers: t.suppliers.filter((s) => s !== sid) } : t) });
  const removeTier = (id) => set({ tiers: v.tiers.filter((t) => t.id !== id) });
  const moveTier = (id, dir) => {
    const i = v.tiers.findIndex((t) => t.id === id);
    if (i < 0) return;
    const j = i + dir;
    if (j < 0 || j >= v.tiers.length) return;
    const next = v.tiers.slice();
    [next[i], next[j]] = [next[j], next[i]];
    set({ tiers: next });
  };
  const addTier = () => {
    const next = v.tiers.length + 1;
    set({ tiers: [...v.tiers, { id: `t${Date.now()}`, name: `Tier ${next} · New`, suppliers: [], window: "1 hour", escalate: true, hold: false }] });
  };

  // ---- Individual mutators -------------------------------------------
  const setIndRow = (next) => set({ individual: v.individual.map((r) => r.supplier === next.supplier ? next : r) });

  const isCustom = scope !== "Global default";

  // Distribution targets · which supplier types this org distributes
  // to, in cascade order, with per-type active state + wait time.
  // Mirrors window.getEnabledSupplierTypeKeys() so the picker shows
  // only the types the org has enabled in Settings → Configuration →
  // Supplier types. When only Agency is enabled we suppress the
  // section entirely — there's nothing to pick.
  const enabledTypeKeys = (window.getEnabledSupplierTypeKeys && window.getEnabledSupplierTypeKeys()) || ["Agency"];
  const showTargets     = enabledTypeKeys.length > 1;
  const stMeta          = window.SUPPLIER_TYPE_META || {};
  const waitOptions     = window.WAIT_OPTIONS || ["Immediate", "15 min", "30 min", "1 hour", "2 hours", "4 hours"];
  const defaultWaits    = window.DEFAULT_WAITS || ["Immediate", "30 min", "1 hour", "2 hours"];
  const normST          = window.normalizeSupplierTypes || ((x) => x || []);

  // Merge any newly-enabled supplier types into the stored cascade so
  // the picker always reflects the current org config. New entries are
  // appended in canonical order with sensible default waits derived
  // from their cascade position — admins can re-order or change.
  const storedSupplierTypes = Array.isArray(v.supplierTypes) ? v.supplierTypes : [];
  const storedKeys          = new Set(
    storedSupplierTypes.map((e) => (typeof e === "string" ? e : (e && e.key))).filter(Boolean)
  );
  const missingEnabled = enabledTypeKeys.filter((k) => !storedKeys.has(k));
  const mergedInput = [
    ...storedSupplierTypes,
    ...missingEnabled.map((key, i) => ({
      key,
      active: true,
      wait: defaultWaits[storedSupplierTypes.length + i] || "1 hour",
    })),
  ];
  const supplierTypes = normST(
    mergedInput.length ? mergedInput : enabledTypeKeys,
    enabledTypeKeys
  );
  // Re-normalize on save so the canonical "first active = Immediate"
  // invariant always holds when downstream consumers read this.
  const writeST = (next) => set({ supplierTypes: normST(next, enabledTypeKeys) });
  const inactiveTypes   = enabledTypeKeys.filter((k) => !supplierTypes.some((e) => e.key === k));
  const moveType = (key, dir) => {
    const i = supplierTypes.findIndex((e) => e.key === key);
    if (i < 0) return;
    const j = i + dir;
    if (j < 0 || j >= supplierTypes.length) return;
    const next = supplierTypes.slice();
    [next[i], next[j]] = [next[j], next[i]];
    writeST(next);
  };
  const removeType = (key) => writeST(supplierTypes.filter((e) => e.key !== key));
  const addType    = (key) => writeST([...supplierTypes, { key, active: true, wait: "1 hour" }]);
  const patchType  = (key, patch) => writeST(supplierTypes.map((e) => e.key === key ? { ...e, ...patch } : e));

  return (
    <React.Fragment>
      {/* ====== DISTRIBUTION ACCESS (Supplier-type cascade + waits) ======
          Renders only when the org has more than just Agency enabled.
          v0.82 — merged the Talent-pools cascade settings into this
          single card. For each type: Active toggle (parks a type
          without losing config), Wait time (delay before this type is
          invited; first active row is always "Immediate"), and
          reorder controls. The create-req page inherits this list as
          its default and can override per-req. */}
      {showTargets && (
        <SectionCard
          variant="compact"
          icon="PersonArrow"
          title="Distribution access"
          subtitle="Which supplier types receive requisitions, in cascade order, and how long each waits before gaining access"
        >
          <Banner inline title={`${supplierTypes.filter((e) => e.active).length} of ${enabledTypeKeys.length} supplier type${enabledTypeKeys.length === 1 ? "" : "s"} active`}>
            New requisitions invite these supplier types in the order shown. Each row's <strong>Wait time</strong> is
            the delay before that type gains access from the moment the requisition is published — the first
            active row is always <em>Immediate</em>. Inactive rows are skipped. Buyers can override per requisition.
          </Banner>
          <div className="dx-st-table">
            <div className="dx-st-row dx-st-row--head" role="row">
              <span className="dx-st-rank"></span>
              <span className="dx-st-icon-h"></span>
              <span className="dx-st-text-h">Supplier type</span>
              <span className="dx-st-status-h">Status</span>
              <span className="dx-st-wait-h">Wait time</span>
              <span className="dx-st-actions-h"></span>
            </div>
            {supplierTypes.map((entry, i) => {
              const key = entry.key;
              const meta = stMeta[key] || { label: key, icon: "Building", blurb: "" };
              const removable = supplierTypes.length > 1;
              const firstActive = supplierTypes.findIndex((e) => e.active) === i;
              const waitDisabled = !entry.active || firstActive;
              return (
                <div key={key} className={"dx-st-row" + (entry.active ? "" : " dx-st-row--off")} role="row">
                  <span className="dx-st-rank tabular" aria-hidden="true">{i + 1}</span>
                  <span className={"dx-st-icon dx-st-icon--" + key.toLowerCase()}>
                    <Icon name={meta.icon} size={18} />
                  </span>
                  <span className="dx-st-text">
                    <span className="dx-st-label">
                      {meta.label}
                      {firstActive && entry.active && supplierTypes.length > 1 && (
                        <span className="dx-st-first">First access</span>
                      )}
                    </span>
                    <span className="dx-st-blurb">{meta.blurb}</span>
                  </span>
                  <span className="dx-st-status">
                    <label className="dx-st-toggle">
                      <Switch
                        checked={entry.active}
                        onChange={(v2) => patchType(key, { active: v2 })}
                        ariaLabel={`${meta.label} active`}
                      />
                      <span className="dx-st-status-label">{entry.active ? "Active" : "Inactive"}</span>
                    </label>
                  </span>
                  <span className="dx-st-wait">
                    <DxSelectInline
                      value={firstActive && entry.active ? "Immediate" : entry.wait}
                      options={waitOptions}
                      onChange={(v2) => patchType(key, { wait: v2 })}
                      width={132}
                      disabled={waitDisabled}
                    />
                    {waitDisabled && (
                      <span
                        className="dx-st-wait-hint"
                        title={firstActive ? "The first active type is always Immediate" : "Inactive types are skipped"}
                        aria-label={firstActive ? "Locked to Immediate" : "Wait time has no effect while inactive"}
                      >
                        <Icon name="Information" size={14} />
                      </span>
                    )}
                  </span>
                  <span className="dx-st-actions">
                    <button
                      type="button"
                      className="iconbtn"
                      aria-label={`Move ${meta.label} up`}
                      disabled={i === 0}
                      onClick={() => moveType(key, -1)}
                    >
                      <Icon name="ChevronUp" size={16} />
                    </button>
                    <button
                      type="button"
                      className="iconbtn"
                      aria-label={`Move ${meta.label} down`}
                      disabled={i === supplierTypes.length - 1}
                      onClick={() => moveType(key, 1)}
                    >
                      <Icon name="ChevronDown" size={16} />
                    </button>
                    <button
                      type="button"
                      className="iconbtn"
                      aria-label={`Remove ${meta.label} from distribution`}
                      title={removable ? "Remove from distribution" : "At least one type required"}
                      disabled={!removable}
                      onClick={() => removeType(key)}
                    >
                      <Icon name="X" size={16} />
                    </button>
                  </span>
                </div>
              );
            })}
          </div>
          {inactiveTypes.length > 0 && (
            <div className="dx-st-add">
              <span className="dx-st-add-label">Add a supplier type</span>
              <div className="dx-st-add-chips">
                {inactiveTypes.map((key) => {
                  const meta = stMeta[key] || { label: key, icon: "Building" };
                  return (
                    <button
                      key={key}
                      type="button"
                      className="dx-st-add-chip"
                      onClick={() => addType(key)}
                    >
                      <Icon name="AddCircle" size={14} />
                      <Icon name={meta.icon} size={14} />
                      {meta.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </SectionCard>
      )}
      {/* ====== STRATEGY ====== */}
      <SectionCard
        variant="compact"
        icon="PersonArrow"
        title="Distribution strategy"
        action={isCustom && (
          <button type="button" className="linkbtn" onClick={() => set(GLOBAL_DEFAULTS)}>
            Reset to global default
          </button>
        )}
      >
        <p className="dx-section-blurb">
          Pick how requisitions are offered to your supplier network. Tiering is the safest default for
          most enterprise programs; Individual is best for direct-engagement partnerships; Broadcast maximizes
          fill speed but reduces program control.
        </p>
        <div className="dx-strategy-grid">
          {(["tiering", "individual", "broadcast"]).map((k) => (
            <StrategyCard
              key={k}
              kind={k}
              active={v.strategy === k}
              onClick={() => set({ strategy: k })}
            />
          ))}
        </div>
      </SectionCard>

      {/* ====== TIERING CONFIGURATION ====== */}
      {v.strategy === "tiering" && (
        <SectionCard
          variant="compact"
          icon="Stack"
          title="Tier configuration"
          action={(
            <button type="button" className="btn btn--sm btn--secondary" onClick={addTier}>
              <Icon name="AddCircle" size={14} />Add tier
            </button>
          )}
        >
          <Banner inline title="Cascade order" action={null}>
            Suppliers in Tier 1 see new requisitions first. When the window elapses
            without a fill, the next tier is invited automatically.
          </Banner>
          <div className="dx-tiers">
            {v.tiers.map((t, i) => (
              <TierRow
                key={t.id}
                tier={t}
                index={i}
                total={v.tiers.length}
                onRename={renameTier}
                onWindow={tierWindow}
                onEscalate={tierEscalate}
                onRemove={removeTier}
                onAddSupplier={tierAddSup}
                onRemoveSupplier={tierRemoveSup}
                onMove={moveTier}
              />
            ))}
          </div>
        </SectionCard>
      )}

      {/* ====== INDIVIDUAL CONFIGURATION ====== */}
      {v.strategy === "individual" && (
        <SectionCard
          variant="compact"
          icon="Users"
          title="Per-supplier rules"
        >
          <Banner inline title="Independent access">
            Each supplier sees the requisition at the same moment but with its own
            response window and caps. Disable a supplier to remove them from rotation.
          </Banner>
          <div className="dx-ind-table">
            <div className="dx-ind-row dx-ind-row--head">
              <span className="dx-ind-cell dx-ind-cell--name">Supplier</span>
              <span className="dx-ind-cell">Access</span>
              <span className="dx-ind-cell">Response window</span>
              <span className="dx-ind-cell dx-ind-cell--num">Submittals</span>
              <span className="dx-ind-cell dx-ind-cell--num">Worker cap</span>
              <span className="dx-ind-cell dx-ind-cell--actions" />
            </div>
            {v.individual.map((row) => (
              <IndividualRow key={row.supplier} row={row} onChange={setIndRow} />
            ))}
          </div>
        </SectionCard>
      )}

      {/* ====== BROADCAST CONFIGURATION ====== */}
      {v.strategy === "broadcast" && (
        <SectionCard
          variant="compact"
          icon="Broadcast"
          title="Broadcast rules"
        >
          <Banner inline title="First-fill-wins">
            Every active supplier sees the requisition simultaneously. The first
            qualified submittal accepted by the hiring manager wins the job.
          </Banner>
          <DxRow
            label="Response window"
            hint="How long the requisition stays open to all suppliers."
            control={<DxSelectInline value={v.responseWindow} options={RESPONSE_WINDOWS} onChange={(x) => set({ responseWindow: x })} />}
          />
          <DxRow
            label="Lock on first qualified submittal"
            hint="Close the requisition the moment a qualified candidate is submitted."
            control={<Switch checked={v.lockOnFirstSubmit} onChange={(x) => set({ lockOnFirstSubmit: x })} ariaLabel="Lock on first submit" />}
            last
          />
        </SectionCard>
      )}

      {/* ====== SUBMISSION RULES ====== */}
      <SectionCard variant="compact" icon="Notes" title="Submission rules">
        <DxRow
          label="Submittal cap per supplier"
          hint="Maximum candidates a single supplier can submit per requisition."
          control={(
            <span className="dx-num-control">
              <input
                type="number"
                min="1"
                max="20"
                className="dx-num dx-num--lg"
                value={v.submittalCap}
                onChange={(e) => set({ submittalCap: +e.target.value })}
              />
              <span className="dx-num-unit">candidates</span>
            </span>
          )}
        />
        <DxRow
          label="Default response window"
          hint="Falls back when a tier or supplier does not specify its own."
          control={<DxSelectInline value={v.responseWindow} options={RESPONSE_WINDOWS} onChange={(x) => set({ responseWindow: x })} />}
        />
        <DxRow
          label="Distribution method"
          hint="How worker demand is split across suppliers when a new requisition is opened."
          control={(
            <div className="dx-method-seg" role="radiogroup" aria-label="Distribution method">
              {[
                { id: "percent",  glyph: "%",  label: "Percentage", sub: "Fixed share each" },
                { id: "count",    glyph: "#",  label: "Count",      sub: "Worker count each" },
                { id: "variable", glyph: "~",  label: "Variable",   sub: "Auto-adjusts" },
              ].map((m) => (
                <button
                  key={m.id}
                  type="button"
                  role="radio"
                  aria-checked={v.distributionMethod === m.id}
                  className={"dx-method-opt" + (v.distributionMethod === m.id ? " dx-method-opt--on" : "")}
                  onClick={() => set({ distributionMethod: m.id })}
                >
                  <span className="dx-method-glyph tabular" aria-hidden="true">{m.glyph}</span>
                  <span className="dx-method-text">
                    <span className="dx-method-label">{m.label}</span>
                    <span className="dx-method-sub">{m.sub}</span>
                  </span>
                </button>
              ))}
            </div>
          )}
        />
        <DxRow
          label="Lock on first qualified submittal"
          hint="Stops accepting new submittals the moment one is qualified by a manager."
          control={<Switch checked={v.lockOnFirstSubmit} onChange={(x) => set({ lockOnFirstSubmit: x })} ariaLabel="Lock on first submit" />}
        />
        <DxRow
          label="Auto-fill with highest-rated worker"
          hint="Skip manager review when a worker has a 95+ score and a perfect skill match."
          control={<Switch checked={v.autoFill} onChange={(x) => set({ autoFill: x })} ariaLabel="Auto-fill" />}
        />
        <DxRow
          label="Block recently terminated workers"
          control={(
            <span className="dx-stack-control">
              <Switch checked={v.blockRehires} onChange={(x) => set({ blockRehires: x })} ariaLabel="Block rehires" />
              {v.blockRehires && (
                <DxSelectInline value={v.rehireWindow} options={REHIRE_WINDOWS} onChange={(x) => set({ rehireWindow: x })} width={108} />
              )}
            </span>
          )}
          hint="Prevent suppliers from re-submitting workers who were ended for cause."
          last
        />
      </SectionCard>

      {/* ====== RELEASE SCHEDULE ====== */}
      <SectionCard variant="compact" icon="Calendar" title="Release schedule">
        <DxRow
          label="Restrict to business hours"
          hint="Hold requisitions outside the window below and release at the next available slot."
          control={<Switch checked={v.businessHoursOnly} onChange={(x) => set({ businessHoursOnly: x })} ariaLabel="Restrict to business hours" />}
        />
        {v.businessHoursOnly && (
          <React.Fragment>
            <DxRow
              label="Active window"
              control={(
                <span className="dx-time-range">
                  <DxSelectInline value={v.releaseStart} options={["5:00 AM","6:00 AM","7:00 AM","8:00 AM","9:00 AM"]} onChange={(x) => set({ releaseStart: x })} width={96} />
                  <span className="dx-time-dash">–</span>
                  <DxSelectInline value={v.releaseEnd}   options={["5:00 PM","6:00 PM","7:00 PM","8:00 PM","10:00 PM","11:00 PM"]} onChange={(x) => set({ releaseEnd: x })} width={96} />
                </span>
              )}
            />
            <DxRow
              label="Active days"
              control={<DayPills value={v.releaseDays} onChange={(x) => set({ releaseDays: x })} />}
              last
            />
          </React.Fragment>
        )}
      </SectionCard>

      {/* ====== PERFORMANCE & PRIORITY ====== */}
      <SectionCard variant="compact" icon="Performance" title="Performance &amp; priority">
        <DxRow
          label="Performance-weighted promotion"
          hint="Automatically move suppliers between tiers based on rolling 30-day fill rate and quality score."
          control={<Switch checked={v.performanceWeighted} onChange={(x) => set({ performanceWeighted: x })} ariaLabel="Performance weighted" />}
        />
        {v.performanceWeighted && (
          <DxRow
            label="Promotion threshold"
            hint="Suppliers averaging above this score get a single-tier promotion at the start of each cycle."
            control={(
              <span className="dx-num-control">
                <input
                  type="number"
                  min="50"
                  max="100"
                  className="dx-num dx-num--lg"
                  value={v.performanceThreshold}
                  onChange={(e) => set({ performanceThreshold: +e.target.value })}
                />
                <span className="dx-num-unit">/ 100</span>
              </span>
            )}
          />
        )}
        <DxRow
          label="Right of first refusal"
          hint="Hold the requisition for a single primary supplier before opening it to the wider tier."
          control={<Switch checked={v.rofrEnabled} onChange={(x) => set({ rofrEnabled: x })} ariaLabel="ROFR" />}
        />
        {v.rofrEnabled && (
          <DxRow
            label="ROFR supplier &amp; window"
            control={(
              <span className="dx-stack-control">
                <DxSelectInline
                  value={REQ_SUPPLIERS[v.rofrSupplier]?.label || v.rofrSupplier}
                  options={DX_SUPPLIER_ORDER.map((s) => REQ_SUPPLIERS[s].label)}
                  onChange={(label) => {
                    const found = Object.entries(REQ_SUPPLIERS).find(([_, m]) => m.label === label);
                    if (found) set({ rofrSupplier: found[0] });
                  }}
                  width={156}
                />
                <DxSelectInline value={v.rofrWindow} options={RESPONSE_WINDOWS} onChange={(x) => set({ rofrWindow: x })} width={108} />
              </span>
            )}
            last
          />
        )}
      </SectionCard>

      {/* ====== EXCLUSIONS ====== */}
      <SectionCard variant="compact" icon="Lock" title="Exclusions">
        <DxRow
          label="Excluded job categories"
          hint="Requisitions for these jobs are kept off the distribution flow and routed manually."
          control={(
            <ChipTags
              value={v.excludedJobs}
              onChange={(x) => set({ excludedJobs: x })}
              options={JOB_CATEGORIES}
              placeholder="No categories excluded — all jobs use this strategy"
            />
          )}
        />
        <DxRow
          label="Excluded suppliers"
          hint="These suppliers never see new requisitions even if they sit in a tier."
          control={(
            <ChipTags
              value={v.excludedSuppliers}
              onChange={(x) => set({ excludedSuppliers: x })}
              options={DX_SUPPLIER_ORDER.map((s) => REQ_SUPPLIERS[s].label)}
              placeholder="No suppliers excluded"
            />
          )}
          last
        />
      </SectionCard>

      {/* ====== NOTIFICATIONS ====== */}
      <SectionCard variant="compact" icon="Bell" title="Notifications">
        <DxRow
          label="Channels"
          hint="How suppliers are notified when a new requisition reaches their tier."
          control={<ChannelGroup value={v.channels} onChange={(x) => set({ channels: x })} />}
        />
        <DxRow
          label="Reminder cadence"
          hint="How often unaccepted requisitions ping the assigned suppliers until they respond."
          control={<DxSelectInline value={v.reminderCadence} options={REMINDER_CADENCE} onChange={(x) => set({ reminderCadence: x })} width={156} />}
          last
        />
      </SectionCard>
    </React.Fragment>
  );
}

// =====================================================================
// DistroSummary — read-only at-a-glance summary used inside org-tree
// detail accordions (e.g. Location detail "Supplier distribution" card).
// =====================================================================
function DistroSummary({ value, isOverride, scopeLabel = "Inherited from organization default" }) {
  const v = value;
  const lines = [
    {
      label: "Strategy",
      value: (
        <span className="dx-sum-strategy">
          <StrategyChip kind={v.strategy} />
          <span className="dx-sum-strategy-text">{STRATEGY_META[v.strategy].label}</span>
        </span>
      ),
    },
    v.strategy === "tiering" && {
      label: "Tiers",
      value: (
        <div className="dx-sum-tiers">
          {v.tiers.map((t, i) => (
            <span key={t.id} className="dx-sum-tier">
              <span className="dx-sum-tier-badge">{i + 1}</span>
              <span className="dx-sum-tier-name">{t.name}</span>
              <span className="dx-sum-tier-stack">
                {t.suppliers.map((sid) => <ReqSupplierChip key={sid} id={sid} size={18} />)}
              </span>
              <span className="dx-sum-tier-window">
                <Icon name="Hourglass" size={12} />{t.window}
              </span>
            </span>
          ))}
        </div>
      ),
    },
    v.strategy === "individual" && {
      label: "Active suppliers",
      value: (
        <div className="dx-sum-inds">
          {v.individual.filter((r) => r.enabled).map((r) => (
            <span key={r.supplier} className="dx-sum-ind">
              <ReqSupplierChip id={r.supplier} size={18} />
              <span>{REQ_SUPPLIERS[r.supplier]?.label}</span>
              <span className="dx-sum-ind-meta">{r.responseWindow} · {r.submittalCap} subs</span>
              {r.primary && <span className="dx-sum-ind-primary">Primary</span>}
            </span>
          ))}
        </div>
      ),
    },
    {
      label: "Submittal cap",
      value: <span className="tabular">{v.submittalCap} candidates / supplier</span>,
    },
    {
      label: "Right of first refusal",
      value: v.rofrEnabled
        ? <span>{REQ_SUPPLIERS[v.rofrSupplier]?.label} · {v.rofrWindow}</span>
        : <span className="dx-sum-off">Disabled</span>,
    },
    {
      label: "Release schedule",
      value: v.businessHoursOnly
        ? <span><span className="tabular">{v.releaseStart} – {v.releaseEnd}</span> · {v.releaseDays.length === 5 ? "Weekdays" : v.releaseDays.join(", ")}</span>
        : <span>All hours, every day</span>,
    },
    {
      label: "Notifications",
      value: <span>{v.channels.join(" · ")} <span className="dx-sum-off">· {v.reminderCadence}</span></span>,
    },
  ].filter(Boolean);

  return (
    <div className="dx-summary">
      <div className={"dx-summary-scope dx-summary-scope--" + (isOverride ? "override" : "inherited")}>
        <span className="dx-summary-scope-icon" aria-hidden="true">
          <Icon name={isOverride ? "ShieldPerson" : "OrgChartVert"} size={16} />
        </span>
        <span className="dx-summary-scope-text">
          <strong>{isOverride ? "Custom rule for this scope" : scopeLabel}</strong>
          <span>{isOverride ? "Edits here only affect this node and anything below it." : "Changes to the organization default will flow into this scope."}</span>
        </span>
      </div>
      <dl className="dx-summary-list">
        {lines.map((l, i) => (
          <div className="dx-summary-row" key={i}>
            <dt className="dx-summary-label">{l.label}</dt>
            <dd className="dx-summary-value">{l.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

// =====================================================================
// openDistroOverridePanel — opens a side panel with the full form, scoped
// to a particular org node. Reuses the existing scrim + side-panel chrome.
// =====================================================================
function openDistroOverridePanel({ scopeName, scopeSegment, initial, onSave }) {
  Interactions.emit("distroPanel", { scopeName, scopeSegment, initial, onSave });
}

function DistroOverridePanelHost() {
  const [open, setOpen] = useStateDx(null);
  useEffectDx(() => Interactions.on("distroPanel", (cfg) => setOpen(cfg)), []);
  const [value, setValue] = useStateDx(null);
  useEffectDx(() => { if (open) setValue(open.initial || GLOBAL_DEFAULTS); }, [open]);
  if (!open || !value) return null;
  const close = () => setOpen(null);
  return (
    <React.Fragment>
      <div className="scrim open" onClick={close} aria-hidden="true" />
      <aside className="side-panel dx-panel open" role="dialog" aria-modal="true" aria-label={`Custom supplier distribution for ${open.scopeName}`}>
        <header className="sp-head">
          <div className="dx-panel-head-text">
            <span className="dx-panel-head-eyebrow" title={typeof dfSegTooltip === "function" ? dfSegTooltip(open.scopeSegment) : undefined}>
              {typeof dfSegLabel === "function" ? dfSegLabel(open.scopeSegment) : open.scopeSegment} · Custom rule
            </span>
            <h2>{open.scopeName}</h2>
          </div>
          <button type="button" className="iconbtn" onClick={close} aria-label="Close">
            <Icon name="X" size={20} />
          </button>
        </header>
        <div className="sp-body dx-panel-body">
          <SupplierDistributionForm value={value} onChange={setValue} scope={open.scopeName} />
        </div>
        <footer className="dx-panel-foot">
          <button type="button" className="btn btn--md btn--tertiary" onClick={close}>Cancel</button>
          <button
            type="button"
            className="btn btn--md btn--primary"
            onClick={() => {
              if (open.onSave) open.onSave(value);
              showToast(`Custom rule saved for ${open.scopeName}`, { kind: "success" });
              close();
            }}
          >
            Save custom rule
          </button>
        </footer>
      </aside>
    </React.Fragment>
  );
}

// =====================================================================
// SupplierDistributionPage — the global settings screen
// =====================================================================
function SupplierDistributionPage({ reloadKey, onReload, onOpenOrg }) {
  const [value, setValue] = useStateDx(GLOBAL_DEFAULTS);
  const [dirty, setDirty] = useStateDx(false);
  const update = (v) => { setValue(v); setDirty(true); };

  const save = () => {
    // Mirror the form value into the shared GLOBAL_DEFAULTS object so
    // the create-requisition picker (and any other consumer reading the
    // ordered supplierTypes list) picks up the new default on the next
    // render — without forcing a reload.
    Object.assign(GLOBAL_DEFAULTS, value);
    setDirty(false);
    showToast("Distribution rules saved · Effective immediately for new requisitions", { kind: "success" });
  };
  const discard = () => {
    setValue(GLOBAL_DEFAULTS);
    setDirty(false);
    showToast("Changes discarded");
  };

  return (
    <div className="set-content dx-page" key={reloadKey}>
      {/* ---- Page header / scope hero ---- */}
      <section className="dx-hero">
        <div className="dx-hero-main">
          <span className="dx-hero-eyebrow">
            <Icon name="Globe" size={14} />Global default
          </span>
          <h2 className="dx-hero-title">Supplier distribution</h2>
          <p className="dx-hero-sub">
            Control how new requisitions reach your supplier network. Settings here apply organization-wide
            unless a child node — district, region, site, or department — has its own override.
          </p>
        </div>
        <div className="dx-hero-side">
          <div className="dx-hero-stat">
            <span className="dx-hero-stat-value tabular">{OVERRIDES.length}</span>
            <span className="dx-hero-stat-label">Active overrides</span>
          </div>
          <div className="dx-hero-stat">
            <span className="dx-hero-stat-value">
              <StrategyChip kind={value.strategy} />
            </span>
            <span className="dx-hero-stat-label">Current strategy</span>
          </div>
        </div>
      </section>

      {/* ---- Form ---- */}
      <div className="dx-form">
        <SupplierDistributionForm value={value} onChange={update} scope="Global default" />
      </div>

      {/* ---- Overrides table ---- */}
      <SectionCard
        variant="compact"
        icon="OrgChartVert"
        title="Overrides at lower org levels"
        action={(
          <button
            type="button"
            className="linkbtn"
            onClick={() => onOpenOrg && onOpenOrg()}
          >
            Open organization tree
            <Icon name="LinkNewWindow" size={14} />
          </button>
        )}
      >
        <p className="dx-section-blurb">
          These scopes have their own custom rule. Edits to the global default flow through any scope
          that does <em>not</em> override; explicitly-set scopes stay frozen until cleared.
        </p>
        <div className="dx-ovr-table">
          <div className="dx-ovr-row dx-ovr-row--head">
            <span className="dx-ovr-cell dx-ovr-cell--scope">Scope</span>
            <span className="dx-ovr-cell dx-ovr-cell--strategy">Strategy</span>
            <span className="dx-ovr-cell dx-ovr-cell--summary">Summary</span>
            <span className="dx-ovr-cell dx-ovr-cell--meta">Last edited</span>
            <span className="dx-ovr-cell dx-ovr-cell--actions" />
          </div>
          {OVERRIDES.map((o) => (
            <div className="dx-ovr-row" key={o.id} tabIndex={0}>
              <span className="dx-ovr-cell dx-ovr-cell--scope">
                <span className={"dx-ovr-seg dx-ovr-seg--" + o.segment.toLowerCase().replace(/\s+/g, "")}>{o.segment.replace(/s$/, "")}</span>
                <span className="dx-ovr-name">{o.name}</span>
              </span>
              <span className="dx-ovr-cell dx-ovr-cell--strategy">
                <StrategyChip kind={o.strategy} />
              </span>
              <span className="dx-ovr-cell dx-ovr-cell--summary">{o.summary}</span>
              <span className="dx-ovr-cell dx-ovr-cell--meta">
                <span>{o.editedBy}</span>
                <span className="dx-ovr-when">{o.editedAt}</span>
              </span>
              <span className="dx-ovr-cell dx-ovr-cell--actions">
                <button
                  type="button"
                  className="iconbtn"
                  aria-label={`More actions for ${o.name}`}
                  onClick={(e) => openMenu(e.currentTarget, [
                    { icon: "View", label: "Open scope",
                      onClick: () => {
                        if (window.flexGoTo && o.segment === "Locations") window.flexGoTo({ page: "locations", sub: "details", id: o.id });
                        else showToast(`Opening ${o.segment} → ${o.name}`);
                      } },
                    { icon: "Edit", label: "Edit override",
                      onClick: () => openDistroOverridePanel({
                        scopeName: o.name,
                        scopeSegment: o.segment,
                        initial: GLOBAL_DEFAULTS,
                        onSave: () => {},
                      }) },
                    { divider: true },
                    { icon: "TrashCan", label: "Clear override", danger: true,
                      onClick: () => openConfirm({
                        title: `Clear override for ${o.name}?`,
                        body: `${o.name} will fall back to the organization-wide default.`,
                        primaryLabel: "Clear override",
                        onConfirm: () => showToast(`${o.name} now follows the global default`, { kind: "success" }),
                      }) },
                  ])}
                >
                  <Icon name="MoreVert" size={16} />
                </button>
              </span>
            </div>
          ))}
        </div>
      </SectionCard>

      {/* ---- Activity log ---- */}
      <SectionCard variant="compact" icon="TimeUndo" title="Recent changes">
        <ActivityLog
          items={(() => {
            // Compose the log from actual overrides so it mirrors the
            // table above — each scope's most recent edit shows up
            // here in reverse chronology, with a couple of system
            // events mixed in to round out the distribution story.
            const strat = (value && value.strategy) || "tiering";
            const stratLabel = ({ tiering: "Tiered cascade", individual: "Individual selection", broadcast: "Broadcast" })[strat];
            const ovEvents = OVERRIDES.slice(0, 3).map((o) => ({
              tone: "info",
              icon: o.strategy === "broadcast" ? "PersonClock" : (o.strategy === "individual" ? "Stack" : "Edit"),
              actor: o.editedBy,
              action: `set ${o.segment.replace(/s$/, "").toLowerCase()} override on`,
              target: o.name,
              note: o.summary,
              time: o.editedAt,
            }));
            return [
              { tone: "info",    icon: "Edit",   actor: "Marcus Webb",  action: "changed the global default to", target: stratLabel, time: "Today, 9:42 AM" },
              ...ovEvents,
              { tone: "warning", icon: "Alert",  actor: "System",       action: "auto-demoted Pro Hire to Tier 2", note: "Fill rate 58% over trailing 30 days", time: "1 week ago" },
              { tone: "success", icon: "Check",  actor: "Aiden Brooks", action: "approved distribution policy publish", time: "2 weeks ago" },
            ];
          })()}
        />
      </SectionCard>

      {/* ---- Sticky save bar ---- */}
      <footer className={"dx-save-bar" + (dirty ? " dx-save-bar--dirty" : "")}>
        <span className="dx-save-bar-text">
          {dirty
            ? <React.Fragment><Icon name="Alert" size={16} />Unsaved changes</React.Fragment>
            : <React.Fragment><Icon name="Check" size={16} />All changes saved</React.Fragment>}
        </span>
        <div className="dx-save-bar-actions">
          <button type="button" className="btn btn--md btn--tertiary" onClick={discard} disabled={!dirty}>Discard</button>
          <button type="button" className="btn btn--md btn--primary" onClick={save} disabled={!dirty}>Save changes</button>
        </div>
      </footer>
    </div>
  );
}

Object.assign(window, {
  SupplierDistributionPage,
  SupplierDistributionForm,
  DistroSummary,
  StrategyChip,
  openDistroOverridePanel,
  DistroOverridePanelHost,
});
