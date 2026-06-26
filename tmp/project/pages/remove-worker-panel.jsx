// =====================================================================
// Flex Work — Remove worker from booking
// A 3-step side panel for the full removal flow:
//   1. Scope & reason — which shifts, and why
//   2. Backfill & policy — how to fill the gap, what fee applies
//   3. Review & confirm — summary of impact and notifications
//
// Opens from:
//   · Booking roster row "Remove from booking"
//   · Worker booking detail header "Remove worker"
//   · Shift detail header "Remove worker"
//
// All chrome reuses Everest semantic tokens via styles-remove-worker.css.
// =====================================================================

const { useState: useStateRw, useEffect: useEffectRw, useMemo: useMemoRw } = React;

// ---------------------------------------------------------------------
// Reasons surfaced in the picker. Internal-facing labels — concise,
// sentence-cased, no emoji. The audit log writes the `code` so reports
// can group by reason without doing string matching on the label.
// ---------------------------------------------------------------------
const RW_REASONS = [
  { code: "no_show",         label: "No-show",                             desc: "Worker did not arrive for the shift" },
  { code: "performance",     label: "Performance or conduct",              desc: "Site-reported quality, safety, or behaviour issue" },
  { code: "worker_off",      label: "Worker unavailable",                  desc: "Worker called out or requested time off" },
  { code: "supplier",        label: "Supplier-initiated withdrawal",       desc: "Agency pulled the worker (illness, reassignment, etc.)" },
  { code: "not_needed",      label: "Role no longer needed",               desc: "Demand dropped or position consolidated" },
  { code: "replaced",        label: "Replaced by a better-fit worker",     desc: "Swapping in someone with more relevant skills or rate" },
  // Engagement / worker-scope reasons (Pro + direct Frontline)
  { code: "end_of_term",     label: "End of engagement term",              desc: "Engagement reached its scheduled end date" },
  { code: "quit_no_notice",  label: "Voluntary resignation",               desc: "Worker resigned, with or without notice" },
  { code: "end_of_assignment", label: "End of assignment",                 desc: "Frontline direct \u2014 assignment naturally concluded" },
  { code: "seasonal_close",  label: "Seasonal close",                      desc: "Frontline direct \u2014 seasonal program ending" },
  { code: "reorganization",  label: "Reorganization or role elimination",  desc: "Pro \u2014 role consolidated under a reorg" },
  { code: "for_cause",       label: "For cause",                           desc: "Misconduct or policy violation. May trigger do-not-rehire." },
  { code: "other",           label: "Other",                               desc: "Specify in the note below" },
];

// SLA tiers for the demo. A real install pulls these from the supplier's
// contract; we hard-code one realistic schedule. `hours` is "fee applies
// if notice given less than this many hours before shift start".
const RW_SLA_TIERS = [
  { hours: 8,   fee: 1.0,  label: "< 8h notice"  },
  { hours: 48,  fee: 0.5,  label: "8h – 48h"     },
  { hours: 168, fee: 0,    label: "> 48h notice" },
];

// ---------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------
function rwFmtMoney(n) {
  if (n == null || !Number.isFinite(n)) return "—";
  const sym = (typeof window !== "undefined" && window.curSymbol) ? window.curSymbol() : "$";
  const sign = n < 0 ? "−" : "";
  const abs = Math.abs(n);
  return sign + sym + abs.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function rwFmtHours(n) {
  if (n == null || !Number.isFinite(n)) return "—";
  return (Math.round(n * 10) / 10).toFixed(1) + "h";
}

// Compute fee tier for the soonest selected shift — that's the strictest
// constraint and the one the SLA actually checks against.
function rwResolveTier(selectedShifts) {
  if (!selectedShifts.length) return RW_SLA_TIERS[RW_SLA_TIERS.length - 1];
  const soonest = selectedShifts.reduce(
    (min, s) => (s.hoursUntilStart < min ? s.hoursUntilStart : min),
    Infinity
  );
  for (const tier of RW_SLA_TIERS) {
    if (soonest < tier.hours) return tier;
  }
  return RW_SLA_TIERS[RW_SLA_TIERS.length - 1];
}

// True when the panel is in engagement / worker offboarding mode
// (the new scopes added on top of the existing shift scopes). The
// step 1 UI swaps to an effective-date + reason picker, step 2
// suppresses SLA / cancellation\u2011fee math, and step 3 review uses
// off\u2011boarding copy.
function rwIsLifecycleScope(scope) {
  return scope === "engagement" || scope === "worker";
}

// =====================================================================
// Small primitives — radio choice card + step pip
// =====================================================================

function RwChoice({ checked, onChange, title, desc, meta, disabled, children }) {
  return (
    <label
      className={
        "rw-choice" +
        (checked ? " rw-choice--checked" : "") +
        (disabled ? " rw-choice--disabled" : "")
      }
    >
      <span className="rw-radio" aria-hidden="true" />
      <span className="rw-choice-body">
        <span className="rw-choice-title">{title}</span>
        {desc && <span className="rw-choice-desc">{desc}</span>}
      </span>
      {meta && <span className="rw-choice-meta">{meta}</span>}
      <input
        type="radio"
        checked={checked}
        onChange={() => onChange && !disabled && onChange()}
        disabled={disabled}
        style={{ position: "absolute", opacity: 0, pointerEvents: "none" }}
      />
      {checked && children}
    </label>
  );
}

function RwStepper({ step, steps }) {
  return (
    <div className="rw-stepper" aria-label="Removal progress">
      {steps.map((label, i) => {
        const state = i < step ? "done" : i === step ? "active" : "pending";
        return (
          <React.Fragment key={i}>
            {i > 0 && <span className="rw-step-rule" />}
            <span className={"rw-step rw-step--" + state}>
              <span className="rw-step-dot">
                {state === "done" ? <Icon name="Check" size={14} /> : i + 1}
              </span>
              <span>{label}</span>
            </span>
          </React.Fragment>
        );
      })}
    </div>
  );
}

// =====================================================================
// Context strip — worker + booking we're removing them from.
// =====================================================================

function RwContextStrip({ ctx }) {
  const sup = REQ_SUPPLIERS[ctx.worker.supplier] || REQ_SUPPLIERS.sw;
  return (
    <div className="rw-context">
      <WorkerAvatar w={ctx.worker} size={40} />
      <div className="rw-context-body">
        <div className="rw-context-name">{ctx.worker.name}</div>
        <div className="rw-context-meta">
          <ReqSupplierChip id={ctx.worker.supplier} size={16} />
          <span>{sup.label}</span>
          <span className="rw-dot" />
          <span>{ctx.role}</span>
          <span className="rw-dot" />
          <span className="tabular">Work assignment #{ctx.bookingId}</span>
          <span className="rw-dot" />
          <span>{ctx.location}</span>
        </div>
      </div>
    </div>
  );
}

// =====================================================================
// STEP 1 — Scope of removal + reason
// =====================================================================

function RwStepScope({ ctx, values, set }) {
  const totalShifts = ctx.shifts.length;
  const totalHours  = ctx.shifts.reduce((a, s) => a + s.hours, 0);

  // Today is the demo's anchor day; "upcoming" = shifts that haven't
  // started yet (hoursUntilStart > 0 means in the future).
  const upcoming   = ctx.shifts.filter((s) => s.hoursUntilStart > 0);
  const upHours    = upcoming.reduce((a, s) => a + s.hours, 0);
  const thisShift  = ctx.shifts.find((s) => s.isCurrent) || ctx.shifts[0];

  const dateRange = ctx.shifts.length > 1
    ? `${ctx.shifts[0].date} – ${ctx.shifts[ctx.shifts.length - 1].date}`
    : ctx.shifts[0].date;
  const upRange = upcoming.length > 1
    ? `${upcoming[0].date} – ${upcoming[upcoming.length - 1].date}`
    : (upcoming[0] && upcoming[0].date) || "—";

  const customIds = values.customIds || [];
  const toggleCustom = (id) => {
    const next = customIds.includes(id)
      ? customIds.filter((x) => x !== id)
      : [...customIds, id];
    set({ customIds: next });
  };

  return (
    <React.Fragment>
      <div className="rw-section">
        <h3 className="rw-section-title">What do you want to remove?</h3>

        <div className="rw-choice-stack">
          <RwChoice
            checked={values.scope === "this"}
            onChange={() => set({ scope: "this" })}
            title="This shift only"
            desc={thisShift ? `${thisShift.date} · ${thisShift.time}` : "Single shift on this work assignment"}
            meta={thisShift ? rwFmtHours(thisShift.hours) : ""}
          />

          {totalShifts > 1 && (
            <RwChoice
              checked={values.scope === "upcoming"}
              onChange={() => set({ scope: "upcoming" })}
              disabled={upcoming.length === 0}
              title="All upcoming shifts"
              desc={upcoming.length === 0
                ? "No upcoming shifts on this work assignment"
                : `${upcoming.length} shift${upcoming.length === 1 ? "" : "s"} · ${upRange}`}
              meta={upcoming.length === 0 ? "—" : rwFmtHours(upHours)}
            />
          )}

          {totalShifts > 1 && (
            <RwChoice
              checked={values.scope === "all"}
              onChange={() => set({ scope: "all" })}
              title="Every shift on this work assignment"
              desc={`${totalShifts} shifts · ${dateRange}`}
              meta={rwFmtHours(totalHours)}
            />
          )}

          {totalShifts > 1 && (
            <RwChoice
              checked={values.scope === "custom"}
              onChange={() => set({ scope: "custom" })}
              title="Pick specific shifts"
              desc="Choose individual dates to remove"
              meta={
                values.scope === "custom"
                  ? rwFmtHours(
                      ctx.shifts
                        .filter((s) => customIds.includes(s.id))
                        .reduce((a, s) => a + s.hours, 0)
                    )
                  : ""
              }
            >
              <div className="rw-custom-shifts" onClick={(e) => e.preventDefault()}>
                {ctx.shifts.map((s) => {
                  const on = customIds.includes(s.id);
                  return (
                    <label
                      key={s.id}
                      className="rw-shift-row"
                      onClick={(e) => { e.preventDefault(); toggleCustom(s.id); }}
                    >
                      <input type="checkbox" checked={on} readOnly />
                      <span className="rw-shift-row-label">{s.date}</span>
                      <span className="rw-shift-row-time">{s.time}</span>
                      <span className="rw-shift-row-hours">{rwFmtHours(s.hours)}</span>
                    </label>
                  );
                })}
              </div>
            </RwChoice>
          )}
        </div>
      </div>

      <div className="rw-section">
        <h3 className="rw-section-title">Reason for removal</h3>
        <p className="rw-section-hint">
          The reason is recorded on the audit log and shapes supplier scorecards.
        </p>

        <div className="fld-control fld-control--input">
          <select
            className="fld-input"
            value={values.reason || ""}
            onChange={(e) => set({ reason: e.target.value })}
            style={{ background: "transparent", border: "none", outline: "none", width: "100%", cursor: "pointer" }}
          >
            <option value="">Select a reason</option>
            {RW_REASONS.map((r) => (
              <option key={r.code} value={r.code}>{r.label}</option>
            ))}
          </select>
        </div>

        {values.reason && (
          <p className="rw-section-hint" style={{ marginTop: 8, marginBottom: 0 }}>
            {RW_REASONS.find((r) => r.code === values.reason)?.desc}
          </p>
        )}

        {values.reason === "other" && (
          <div className="rw-reason-other">
            <div className="fld-control fld-control--ta">
              <textarea
                className="fld-input fld-input--ta"
                rows={3}
                placeholder="Briefly describe what happened"
                value={values.reasonOther || ""}
                onChange={(e) => set({ reasonOther: e.target.value })}
              />
            </div>
          </div>
        )}
      </div>
    </React.Fragment>
  );
}

// =====================================================================
// STEP 2 — Backfill choice + cancellation policy + internal note
// =====================================================================

function RwStepBackfill({ ctx, values, set, selectedShifts }) {
  const sup = REQ_SUPPLIERS[ctx.worker.supplier] || REQ_SUPPLIERS.sw;
  const nextSup = REQ_SUPPLIERS[ctx.nextSupplierId] || REQ_SUPPLIERS.th;
  const tier = useMemoRw(() => rwResolveTier(selectedShifts), [selectedShifts]);
  const selectedHours = selectedShifts.reduce((a, s) => a + s.hours, 0);
  const grossPay = selectedHours * (ctx.rate || 32);
  const feeAmount = values.waiveFee ? 0 : grossPay * tier.fee;

  const tierTone = tier.fee >= 1 ? "error" : tier.fee > 0 ? "warn" : "";
  const resultTone = tier.fee >= 1 ? "error" : tier.fee > 0 ? "warn" : "";

  return (
    <React.Fragment>
      <div className="rw-section">
        <h3 className="rw-section-title">How should we fill the gap?</h3>
        <p className="rw-section-hint">
          The selected shifts will be unfilled the moment you confirm.
          Pick what happens next.
        </p>

        <div className="rw-choice-stack">
          <RwChoice
            checked={values.backfill === "redistribute"}
            onChange={() => set({ backfill: "redistribute" })}
            title="Auto-redistribute to next supplier"
            desc={`Send the open shift${selectedShifts.length === 1 ? "" : "s"} to ${nextSup.label} (next in priority).`}
            meta="Recommended"
          />

          <RwChoice
            checked={values.backfill === "replace"}
            onChange={() => set({ backfill: "replace" })}
            title="Pick a replacement"
            desc={`Choose someone from ${sup.label} or the broader pool.`}
          >
            <div className="rw-rep-list">
              {ctx.suggestedReplacements.map((w) => {
                const picked = values.replacementId === w.id;
                return (
                  <div
                    key={w.id}
                    className={"rw-rep-row" + (picked ? " rw-rep-row--picked" : "")}
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); set({ replacementId: w.id }); }}
                  >
                    <WorkerAvatar w={w} size={28} />
                    <div>
                      <div className="rw-rep-name">{w.name}</div>
                      <div className="rw-rep-meta">
                        <ReqSupplierChip id={w.supplier} size={14} />
                        <span>{(REQ_SUPPLIERS[w.supplier] || sup).label}</span>
                      </div>
                    </div>
                    <span className={"rw-rep-pill" + (w.availability === "partial" ? " rw-rep-pill--warn" : "")}>
                      {w.availability === "full" ? "Available" : "Partial match"}
                    </span>
                    <button
                      type="button"
                      className="rw-rep-pick"
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); set({ replacementId: w.id }); }}
                    >
                      {picked ? "Selected" : "Select"}
                    </button>
                  </div>
                );
              })}
              <button
                type="button"
                className="linkbtn"
                style={{ alignSelf: "flex-start", marginTop: 2 }}
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); showToast("Opening worker search…"); }}
              >
                <Icon name="Search" size={14} />
                Browse all workers
              </button>
            </div>
          </RwChoice>

          <RwChoice
            checked={values.backfill === "leave"}
            onChange={() => set({ backfill: "leave" })}
            title="Leave shifts open"
            desc="Position stays on the roster as unfilled. Schedulers get an alert."
          />

          <RwChoice
            checked={values.backfill === "reduce"}
            onChange={() => set({ backfill: "reduce" })}
            title="Reduce headcount"
            desc="Drop the position from the requisition. Bill rates and budget update automatically."
          />
        </div>
      </div>

      <div className="rw-section">
        <h3 className="rw-section-title">Cancellation policy</h3>

        <div className="rw-policy">
          <div className="rw-policy-head">
            <span className="rw-policy-title">
              {sup.label} · Standard SLA
            </span>
            <span style={{ font: "var(--evr-caption)", color: "var(--evr-content-primary-default)" }}>
              {selectedShifts.length} shift{selectedShifts.length === 1 ? "" : "s"} · {rwFmtHours(selectedHours)}
            </span>
          </div>

          <div className="rw-policy-tiers">
            {RW_SLA_TIERS.map((t) => {
              const active = t === tier;
              const cls =
                "rw-policy-tier" +
                (active ? " rw-policy-tier--active" : "") +
                (active && tierTone ? ` rw-policy-tier--${tierTone}` : "");
              return (
                <div key={t.label} className={cls}>
                  <div className="rw-policy-tier-label">{t.label}</div>
                  <div className="rw-policy-tier-val">{Math.round(t.fee * 100)}%</div>
                </div>
              );
            })}
          </div>

          <div className="rw-policy-result">
            <span className="rw-policy-result-label">
              Cancellation fee{values.waiveFee ? " (waived)" : ""}
            </span>
            <span className={
              "rw-policy-result-val" +
              (resultTone && !values.waiveFee ? ` rw-policy-result-val--${resultTone}` : "")
            }>
              {rwFmtMoney(feeAmount)}
            </span>
          </div>

          {tier.fee > 0 && (
            <label className="rw-policy-waive">
              <input
                type="checkbox"
                checked={!!values.waiveFee}
                onChange={(e) => set({ waiveFee: e.target.checked })}
              />
              <span>
                <div>Waive cancellation fee</div>
                <div className="rw-policy-waive-detail">
                  Requires manager approval. The waiver and your justification are
                  attached to the audit record.
                </div>
              </span>
            </label>
          )}
        </div>
      </div>

      <div className="rw-section">
        <h3 className="rw-section-title">Internal note (optional)</h3>
        <p className="rw-section-hint">
          Visible to schedulers, finance, and the audit log. Not shared with the
          supplier or worker.
        </p>
        <div className="fld-control fld-control--ta">
          <textarea
            className="fld-input fld-input--ta"
            rows={3}
            placeholder="E.g. Replacement already lined up for tomorrow's shift"
            value={values.note || ""}
            onChange={(e) => set({ note: e.target.value })}
          />
        </div>
      </div>
    </React.Fragment>
  );
}

// =====================================================================
// STEP 3 — Review & confirm
// =====================================================================

function RwStepReview({ ctx, values, set, selectedShifts }) {
  const sup = REQ_SUPPLIERS[ctx.worker.supplier] || REQ_SUPPLIERS.sw;
  const nextSup = REQ_SUPPLIERS[ctx.nextSupplierId] || REQ_SUPPLIERS.th;
  const replacement = (ctx.suggestedReplacements || []).find((w) => w.id === values.replacementId);
  const tier = rwResolveTier(selectedShifts);

  const selectedHours = selectedShifts.reduce((a, s) => a + s.hours, 0);
  const grossPay = selectedHours * (ctx.rate || 32);
  const feeAmount = values.waiveFee ? 0 : grossPay * tier.fee;
  const netImpact = -(grossPay) + feeAmount;

  const backfillLabel = (() => {
    if (values.backfill === "redistribute") return `Auto-redistribute to ${nextSup.label}`;
    if (values.backfill === "replace")      return replacement ? `Replace with ${replacement.name}` : "Replace with…";
    if (values.backfill === "leave")        return "Leave shifts open";
    if (values.backfill === "reduce")       return "Reduce headcount by 1";
    return "—";
  })();

  const reasonLabel = (() => {
    const r = RW_REASONS.find((x) => x.code === values.reason);
    if (!r) return "—";
    if (r.code === "other" && values.reasonOther) return `Other — ${values.reasonOther}`;
    return r.label;
  })();

  const lateWarn = tier.fee > 0;
  const hl = selectedShifts.length === 1
    ? `Remove ${ctx.worker.name} from ${selectedShifts[0].date}?`
    : `Remove ${ctx.worker.name} from ${selectedShifts.length} shifts?`;

  const notifications = [
    { id: "worker",   name: ctx.worker.name,             meta: "Worker · via supplier app",   chan: "Push + email" },
    { id: "supplier", name: sup.label,                   meta: `Agency contact · ${sup.label}`, chan: "Email" },
    { id: "manager",  name: ctx.requestor || "Nia Thompson", meta: "Work assignment owner",            chan: "Email + bell" },
    { id: "site",     name: ctx.location,                meta: "Site supervisor",              chan: "Bell" },
  ];

  const toggleNotify = (id) => {
    const off = values.notifyOff || [];
    set({ notifyOff: off.includes(id) ? off.filter((x) => x !== id) : [...off, id] });
  };

  return (
    <React.Fragment>
      <div className={"rw-review-card" + (lateWarn ? " rw-review-card--warn" : "")}>
        <h3 className="rw-review-headline">{hl}</h3>
        <p className="rw-review-sub">
          {lateWarn
            ? `Late notice — a ${Math.round(tier.fee * 100)}% cancellation fee applies under the ${sup.label} SLA.`
            : `Sufficient notice — no cancellation fee under the ${sup.label} SLA.`}
        </p>
      </div>

      <div className="rw-impact-grid">
        <div className="rw-impact-cell">
          <span className="rw-impact-label">Shifts removed</span>
          <span className="rw-impact-val">{selectedShifts.length}</span>
          <span className="rw-impact-sub">{rwFmtHours(selectedHours)} released</span>
        </div>
        <div className="rw-impact-cell">
          <span className="rw-impact-label">Pay reversed</span>
          <span className="rw-impact-val rw-impact-val--neg">−{rwFmtMoney(grossPay).replace("−", "")}</span>
          <span className="rw-impact-sub">@ {rwFmtMoney(ctx.rate || 32)}/h</span>
        </div>
        <div className="rw-impact-cell">
          <span className="rw-impact-label">Cancellation fee</span>
          <span className={"rw-impact-val" + (feeAmount > 0 ? " rw-impact-val--neg" : "")}>
            {feeAmount > 0 ? "+" : ""}{rwFmtMoney(feeAmount)}
          </span>
          <span className="rw-impact-sub">
            {values.waiveFee ? "Waived by manager" : `${Math.round(tier.fee * 100)}% per SLA`}
          </span>
        </div>
        <div className="rw-impact-cell">
          <span className="rw-impact-label">Net budget impact</span>
          <span className={"rw-impact-val " + (netImpact < 0 ? "rw-impact-val--pos" : "rw-impact-val--neg")}>
            {netImpact < 0 ? "−" : "+"}{rwFmtMoney(Math.abs(netImpact))}
          </span>
          <span className="rw-impact-sub">vs. originally booked</span>
        </div>
      </div>

      <div className="rw-section">
        <h3 className="rw-section-title">Removal details</h3>
        <InfoGrid
          rows={[
            { label: "Worker",      value: ctx.worker.name },
            { label: "Supplier",    value: sup.label },
            { label: "Work assignment",     value: `#${ctx.bookingId}`, tabular: true },
            { label: "Reason",      value: reasonLabel },
            { label: "Backfill",    value: backfillLabel },
            { label: "Note",        value: values.note ? values.note : "—" },
          ]}
        />

        <div className="rw-removed-shifts">
          {selectedShifts.map((s) => (
            <div key={s.id} className="rw-removed-shift">
              <Icon name="Cancel" size={16} />
              <span className="rw-removed-shift-label">{s.date}</span>
              <span className="rw-removed-shift-time">{s.time} · {rwFmtHours(s.hours)}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="rw-section">
        <h3 className="rw-section-title">Notifications</h3>
        <p className="rw-section-hint">
          Uncheck anyone who should not be looped in. The worker is always
          notified by the supplier in line with your service agreement.
        </p>
        <div className="rw-notify-list">
          {notifications.map((n) => {
            const off = (values.notifyOff || []).includes(n.id);
            return (
              <label
                key={n.id}
                className="rw-notify-row"
                onClick={(e) => { e.preventDefault(); toggleNotify(n.id); }}
              >
                <input type="checkbox" checked={!off} readOnly />
                <div>
                  <div className="rw-notify-name">{n.name}</div>
                  <div className="rw-notify-meta">{n.meta}</div>
                </div>
                <span className="rw-notify-chan">{n.chan}</span>
              </label>
            );
          })}
        </div>
      </div>

      <label className="rw-final-confirm" onClick={(e) => { e.preventDefault(); set({ acknowledged: !values.acknowledged }); }}>
        <input type="checkbox" checked={!!values.acknowledged} readOnly />
        <span className="rw-final-confirm-text">
          I confirm <b>{ctx.worker.name}</b> should be removed from
          {selectedShifts.length === 1
            ? ` the ${selectedShifts[0].date} shift`
            : ` ${selectedShifts.length} shifts on this work assignment`}
          . This action is recorded on the audit log and cannot be silently reversed.
        </span>
      </label>
    </React.Fragment>
  );
}

// =====================================================================
// STEP 1 (lifecycle mode) \u2014 Effective date + reason + last\u2011shift
// handling. Used when the panel was opened with defaultScope of
// "engagement" (Pro) or "worker" (direct\u2011sourced Frontline).
// =====================================================================
const RW_LAST_SHIFT_MODES = [
  { code: "through_date",  label: "Work through-date",     desc: "Honor every shift booked through the effective date." },
  { code: "end_of_shift",  label: "End after current shift", desc: "Finish the shift in progress; cancel everything after." },
  { code: "immediate",     label: "End immediately",        desc: "All future shifts cancelled the moment you confirm." },
];

function RwStepLifecycle({ ctx, values, set }) {
  const isEngagement = values.scope === "engagement";
  const role = (ctx.worker && ctx.worker.jobs && ctx.worker.jobs[0]) || ctx.role;
  const engagementRef = (ctx.worker && ctx.worker.engagementRef) || null;
  return (
    <React.Fragment>
      <div className="rw-section">
        <h3 className="rw-section-title">
          {isEngagement ? "End this engagement" : "End this worker's direct assignment"}
        </h3>
        <p className="rw-section-hint">
          {isEngagement
            ? `Closes the Professional engagement ${engagementRef ? `#${engagementRef} ` : ""}with ${ctx.worker.name}. Reads the offboarding task catalog from Settings \u2192 Configuration \u2192 Professional lifecycle.`
            : `Closes ${ctx.worker.name}'s direct\u2011sourced Frontline assignment as ${role}. Reads the offboarding task catalog from Settings \u2192 Configuration \u2192 Frontline lifecycle.`}
        </p>
        <div className="pro-form-grid" style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 16 }}>
          <label className="rw-field">
            <span className="rw-section-hint" style={{ display: "block", margin: 0, fontWeight: "var(--evr-fw-demibold)", color: "var(--evr-content-primary-highemp)" }}>Effective date</span>
            <div className="fld-control fld-control--input" style={{ marginTop: 4 }}>
              <input type="date" className="fld-input" value={values.effectiveDate || ""} onChange={(e) => set({ effectiveDate: e.target.value })} style={{ background: "transparent", border: "none", outline: "none", width: "100%" }} />
            </div>
          </label>
          <label className="rw-field">
            <span className="rw-section-hint" style={{ display: "block", margin: 0, fontWeight: "var(--evr-fw-demibold)", color: "var(--evr-content-primary-highemp)" }}>Last day worked</span>
            <div className="fld-control fld-control--input" style={{ marginTop: 4 }}>
              <input type="date" className="fld-input" value={values.lastDayWorked || ""} onChange={(e) => set({ lastDayWorked: e.target.value })} style={{ background: "transparent", border: "none", outline: "none", width: "100%" }} />
            </div>
          </label>
        </div>
      </div>

      <div className="rw-section">
        <h3 className="rw-section-title">Reason</h3>
        <p className="rw-section-hint">
          Recorded on the audit log; certain reasons (Performance \u00b7 For cause) gate the do\u2011not\u2011rehire flag on the next step.
        </p>
        <div className="fld-control fld-control--input">
          <select className="fld-input" value={values.reason || ""} onChange={(e) => set({ reason: e.target.value })}
            style={{ background: "transparent", border: "none", outline: "none", width: "100%", cursor: "pointer" }}>
            <option value="">Select a reason</option>
            {RW_REASONS.filter((r) => r.code !== "no_show" && r.code !== "worker_off" && r.code !== "replaced" && r.code !== "supplier").map((r) => (
              <option key={r.code} value={r.code}>{r.label}</option>
            ))}
          </select>
        </div>
        {values.reason && (
          <p className="rw-section-hint" style={{ marginTop: 8, marginBottom: 0 }}>
            {RW_REASONS.find((r) => r.code === values.reason)?.desc}
          </p>
        )}
        {values.reason === "other" && (
          <div className="rw-reason-other">
            <div className="fld-control fld-control--ta">
              <textarea className="fld-input fld-input--ta" rows={3} placeholder="Briefly describe what happened"
                value={values.reasonOther || ""} onChange={(e) => set({ reasonOther: e.target.value })} />
            </div>
          </div>
        )}
      </div>

      {!isEngagement && (
        <div className="rw-section">
          <h3 className="rw-section-title">Last\u2011shift handling</h3>
          <p className="rw-section-hint">
            Direct\u2011sourced Frontline only. How to treat shifts already booked between today and the effective date.
          </p>
          <div className="rw-choice-stack">
            {RW_LAST_SHIFT_MODES.map((m) => (
              <RwChoice key={m.code}
                checked={values.lastShiftMode === m.code}
                onChange={() => set({ lastShiftMode: m.code })}
                title={m.label}
                desc={m.desc}
              />
            ))}
          </div>
        </div>
      )}
    </React.Fragment>
  );
}

// =====================================================================
// STEP 2 (lifecycle mode) \u2014 Offboarding tasks + do\u2011not\u2011rehire +
// final\u2011pay note. Replaces the SLA / backfill flow for engagement
// or worker scope.
// =====================================================================
function RwStepLifecycleClose({ ctx, values, set }) {
  const isEngagement = values.scope === "engagement";
  const kind = isEngagement ? "pro" : "frontline";
  // Resolve through the worker-aware resolver so the panel honours a
  // per-job template override.
  const tasks = (window.getOffboardingTasksForWorker ? window.getOffboardingTasksForWorker(ctx.worker)
    : (window.getOffboardingTasks ? window.getOffboardingTasks(kind) : []));
  // Default every required task to acknowledged so the flow doesn't
  // block on a per\u2011task checkbox \u2014 the manager confirms the list as
  // a whole, the worker\u2011side checklist (worker mobile) drives the
  // actual completion.
  const ack = values.taskAck || {};
  const toggle = (id) => set({ taskAck: { ...ack, [id]: !ack[id] } });
  const dnrEligible = values.reason === "performance" || values.reason === "for_cause" || values.reason === "no_show";
  return (
    <React.Fragment>
      <div className="rw-section">
        <h3 className="rw-section-title">Offboarding tasks</h3>
        <p className="rw-section-hint">
          Pulled from Settings \u2192 Configuration \u2192 {isEngagement ? "Professional lifecycle" : "Frontline lifecycle"}. Acknowledge each task to confirm the workflow will run; uncheck to skip with audit\u2011logged justification.
        </p>
        <ul className="pro-task-list" role="list">
          {tasks.map((t) => (
            <li key={t.id} className={"pro-task" + (ack[t.id] !== false ? " is-on" : "")}>
              <button type="button" role="switch" aria-checked={ack[t.id] !== false}
                className="pro-task-toggle" onClick={() => toggle(t.id)}>
                <span className="pro-task-check">
                  {ack[t.id] !== false ? <Icon name="Check" size={14} /> : null}
                </span>
                <span className="pro-task-body">
                  <span className="pro-task-label">{t.label}{t.required && <span style={{ marginLeft: 8, color: "var(--evr-content-decorative-blue)", font: "var(--evr-utility2)", fontWeight: 700 }}>Required</span>}</span>
                  <span className="pro-task-help">{t.desc} \u00b7 Due in {t.due}d</span>
                </span>
              </button>
            </li>
          ))}
          {tasks.length === 0 && (
            <li className="rw-section-hint" style={{ padding: 12 }}>
              No offboarding tasks configured. Open Settings \u2192 Configuration \u2192 {isEngagement ? "Professional lifecycle" : "Frontline lifecycle"} to author them.
            </li>
          )}
        </ul>
      </div>

      <div className="rw-section">
        <h3 className="rw-section-title">Final\u2011pay note</h3>
        <p className="rw-section-hint">
          Routed to Dayforce native payroll. Final invoice / paycheck closes after the effective date.
        </p>
        <div className="fld-control fld-control--ta">
          <textarea className="fld-input fld-input--ta" rows={3}
            placeholder="Outstanding PTO payout, severance terms, equipment buyout note\u2026"
            value={values.finalPayNote || ""} onChange={(e) => set({ finalPayNote: e.target.value })} />
        </div>
      </div>

      <div className="rw-section">
        <h3 className="rw-section-title">Do\u2011not\u2011rehire flag</h3>
        <p className="rw-section-hint">
          {dnrEligible
            ? "Eligible for this reason. Flag is policy\u2011gated \u2014 HR\u2011Legal reviews before the worker transitions to Terminated."
            : "Disabled \u2014 only available for Performance / For cause / No\u2011show reasons. Voluntary or end\u2011of\u2011term separations cannot set this flag."}
        </p>
        <label className="rw-policy-waive" style={{ opacity: dnrEligible ? 1 : 0.55 }}>
          <input type="checkbox" checked={!!values.doNotRehire} disabled={!dnrEligible}
            onChange={(e) => set({ doNotRehire: e.target.checked })} />
          <span>
            <div>Flag this worker as do\u2011not\u2011rehire</div>
            <div className="rw-policy-waive-detail">
              The flag and your reason are attached to the worker's audit record and survive offboarding.
            </div>
          </span>
        </label>
      </div>
    </React.Fragment>
  );
}

// =====================================================================
// STEP 3 (lifecycle mode) \u2014 Review & confirm. Reuses notification list
// but skips SLA / cancellation\u2011fee math.
// =====================================================================
function RwStepLifecycleReview({ ctx, values, set }) {
  const isEngagement = values.scope === "engagement";
  const reasonLabel = (() => {
    const r = RW_REASONS.find((x) => x.code === values.reason);
    if (!r) return "\u2014";
    if (r.code === "other" && values.reasonOther) return `Other \u2014 ${values.reasonOther}`;
    return r.label;
  })();
  const ack = values.taskAck || {};
  const taskCount = (window.getOffboardingTasksForWorker ? window.getOffboardingTasksForWorker(ctx.worker)
    : (window.getOffboardingTasks ? window.getOffboardingTasks(isEngagement ? "pro" : "frontline") : []));
  const ackedCount = taskCount.filter((t) => ack[t.id] !== false).length;
  const lastShiftLabel = (RW_LAST_SHIFT_MODES.find((m) => m.code === values.lastShiftMode) || RW_LAST_SHIFT_MODES[0]).label;
  return (
    <React.Fragment>
      <div className="rw-review-card">
        <h3 className="rw-review-headline">
          {isEngagement ? `End ${ctx.worker.name}'s engagement?` : `Offboard ${ctx.worker.name}?`}
        </h3>
        <p className="rw-review-sub">
          {isEngagement
            ? `Closes the Professional engagement on the effective date. Offboarding tasks run from the configured catalog; ${ackedCount} of ${taskCount.length} acknowledged.`
            : `Closes the direct\u2011sourced Frontline assignment. ${ackedCount} of ${taskCount.length} offboarding tasks acknowledged.`}
        </p>
      </div>

      <div className="rw-section">
        <h3 className="rw-section-title">Offboarding details</h3>
        <InfoGrid rows={[
          { label: "Worker",         value: ctx.worker.name },
          { label: "Scope",          value: isEngagement ? "Professional engagement" : "Frontline direct assignment" },
          { label: "Effective date", value: values.effectiveDate || "\u2014", tabular: true },
          { label: "Last day worked", value: values.lastDayWorked || values.effectiveDate || "\u2014", tabular: true },
          ...(!isEngagement ? [{ label: "Last-shift handling", value: lastShiftLabel }] : []),
          { label: "Reason",         value: reasonLabel },
          { label: "Do-not-rehire",  value: values.doNotRehire ? "Yes \u2014 HR-Legal review required" : "No" },
          { label: "Final-pay note", value: values.finalPayNote || "\u2014" },
        ]} />
      </div>

      <label className="rw-final-confirm" onClick={(e) => { e.preventDefault(); set({ acknowledged: !values.acknowledged }); }}>
        <input type="checkbox" checked={!!values.acknowledged} readOnly />
        <span className="rw-final-confirm-text">
          I confirm <b>{ctx.worker.name}</b> should be offboarded on <b className="tabular">{values.effectiveDate || "the effective date"}</b>. This transitions the worker to <b>Offboarding</b> immediately; status flips to <b>Inactive</b>{values.doNotRehire ? " or " : ""}{values.doNotRehire ? <b>Terminated</b> : null} after the catalog completes.
        </span>
      </label>
    </React.Fragment>
  );
}

// =====================================================================
// Main panel \u2014 orchestrates the 3 steps + footer transitions
// =====================================================================

function RemoveWorkerPanel({ open, ctx, onClose, onConfirm }) {
  const initial = useMemoRw(() => {
    // Default scope depends on context:
    //   \u00b7 launched from a shift detail \u2192 "this"
    //   \u00b7 launched from a booking row with multiple shifts \u2192 "upcoming"
    //   \u00b7 single-shift booking \u2192 "this"
    //   \u00b7 launched from a worker detail with engagement scope \u2192 "engagement"
    //   \u00b7 launched from a worker detail with worker scope     \u2192 "worker"
    const upcoming = ctx.shifts.filter((s) => s.hoursUntilStart > 0);
    let scope = ctx.defaultScope;
    if (!scope) {
      scope = ctx.shifts.length === 1 ? "this" : upcoming.length > 0 ? "upcoming" : "all";
    }
    const isLifecycle = scope === "engagement" || scope === "worker";
    return {
      scope,
      customIds: [],
      reason: "",
      reasonOther: "",
      backfill: "redistribute",
      replacementId: (ctx.suggestedReplacements && ctx.suggestedReplacements[0] && ctx.suggestedReplacements[0].id) || null,
      waiveFee: false,
      note: "",
      notifyOff: [],
      acknowledged: false,
      // lifecycle\u2011mode defaults \u2014 ignored in shift\u2011scope flows
      effectiveDate: isLifecycle ? (new Date(Date.now() + 14 * 86400000)).toISOString().slice(0, 10) : "",
      lastDayWorked: "",
      lastShiftMode: "through_date",
      taskAck: {},
      doNotRehire: false,
      finalPayNote: "",
    };
  }, [ctx]);

  const [values, setValues] = useStateRw(initial);
  const [step, setStep]     = useStateRw(0);

  useEffectRw(() => {
    if (open) {
      setValues(initial);
      setStep(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const set = (patch) => setValues((v) => ({ ...v, ...patch }));

  const isLifecycle = rwIsLifecycleScope(values.scope);

  // ----- Derive the list of shifts the user has actually selected -----
  const selectedShifts = useMemoRw(() => {
    if (values.scope === "this") {
      const t = ctx.shifts.find((s) => s.isCurrent) || ctx.shifts[0];
      return t ? [t] : [];
    }
    if (values.scope === "upcoming") return ctx.shifts.filter((s) => s.hoursUntilStart > 0);
    if (values.scope === "all")      return ctx.shifts;
    if (values.scope === "custom")   return ctx.shifts.filter((s) => values.customIds.includes(s.id));
    return [];
  }, [ctx, values.scope, values.customIds]);

  // ----- Step gating ------------------------------------------------
  const step1Valid = isLifecycle
    ? (!!values.reason && !!values.effectiveDate && (values.reason !== "other" || (values.reasonOther && values.reasonOther.trim().length > 3)))
    : (selectedShifts.length > 0 &&
        !!values.reason &&
        (values.reason !== "other" || (values.reasonOther && values.reasonOther.trim().length > 3)));

  const step2Valid = isLifecycle
    ? true
    : (!!values.backfill && (values.backfill !== "replace" || !!values.replacementId));

  const step3Valid = values.acknowledged;

  const steps = isLifecycle
    ? ["Effective date & reason", "Tasks & final pay", "Review"]
    : ["Scope & reason", "Backfill & policy", "Review"];

  // ----- Submit -----------------------------------------------------
  const submit = () => {
    if (!step3Valid) return;
    if (onConfirm) onConfirm({ ...values, selectedShifts });
    onClose && onClose();
  };

  // ----- Footer per step -------------------------------------------
  const footer = (
    <div className="rw-foot-row">
      <button type="button" className="btn btn--lg btn--tertiary" onClick={onClose}>
        Cancel
      </button>
      <span className="rw-foot-spacer" />
      {step > 0 && (
        <button
          type="button"
          className="btn btn--lg btn--secondary"
          onClick={() => setStep((s) => s - 1)}
        >
          Back
        </button>
      )}
      {step < steps.length - 1 && (
        <button
          type="button"
          className="btn btn--lg btn--primary"
          disabled={step === 0 ? !step1Valid : !step2Valid}
          onClick={() => setStep((s) => s + 1)}
        >
          Continue
        </button>
      )}
      {step === steps.length - 1 && (
        <button
          type="button"
          className="btn btn--lg btn--danger"
          disabled={!step3Valid}
          onClick={submit}
        >
          <Icon name={isLifecycle ? "PersonClock" : "Cancel"} size={16} />
          {isLifecycle ? (values.scope === "engagement" ? "End engagement" : "Offboard worker") : "Confirm removal"}
        </button>
      )}
    </div>
  );

  // SidePanel doesn't accept a className, so we paint the wider width
  // via a one-off effect: tag the live `<aside>` once it mounts.
  useEffectRw(() => {
    if (!open) return;
    const ariaLabel = isLifecycle
      ? (values.scope === "engagement" ? "End Professional engagement" : "Offboard direct-sourced worker")
      : "Remove worker from work assignment";
    const aside = document.querySelector(`aside.side-panel[aria-label="${ariaLabel}"]`);
    if (aside) aside.classList.add("rw-panel");
  }, [open, isLifecycle, values.scope]);

  const panelTitle = isLifecycle
    ? (values.scope === "engagement" ? "End Professional engagement" : "Offboard direct-sourced worker")
    : "Remove worker from work assignment";

  return (
    <SidePanel
      open={open}
      title={panelTitle}
      onClose={onClose}
      footer={footer}
    >
      <RwStepper step={step} steps={steps} />
      <div style={{ height: 8 }} />
      <RwContextStrip ctx={ctx} />

      {isLifecycle ? (
        <React.Fragment>
          {step === 0 && <RwStepLifecycle       ctx={ctx} values={values} set={set} />}
          {step === 1 && <RwStepLifecycleClose  ctx={ctx} values={values} set={set} />}
          {step === 2 && <RwStepLifecycleReview ctx={ctx} values={values} set={set} />}
        </React.Fragment>
      ) : (
        <React.Fragment>
          {step === 0 && <RwStepScope    ctx={ctx} values={values} set={set} />}
          {step === 1 && <RwStepBackfill ctx={ctx} values={values} set={set} selectedShifts={selectedShifts} />}
          {step === 2 && <RwStepReview   ctx={ctx} values={values} set={set} selectedShifts={selectedShifts} />}
        </React.Fragment>
      )}
    </SidePanel>
  );
}

// =====================================================================
// Hook — open/close the panel from any page, with the same API shape
// useEditEntity uses.
// =====================================================================

function useRemoveWorker() {
  const [config, setConfig] = useStateRw(null);
  const close = () => setConfig(null);
  const open  = (cfg) => setConfig(cfg);
  const panel = config && (
    <RemoveWorkerPanel
      open
      ctx={config}
      onClose={close}
      onConfirm={(result) => {
        if (config.onConfirm) config.onConfirm(result);
        else {
          const n = result.selectedShifts.length;
          const target = n === 1 ? `the ${result.selectedShifts[0].date} shift` : `${n} shifts`;
          showToast(`${config.worker.name} removed from ${target}`, { kind: "success", action: { label: "Undo", onClick: () => showToast("Removal undone") } });
        }
        close();
      }}
    />
  );
  return { open, close, panel };
}

// =====================================================================
// Default context-builder. Pass in worker, booking, and which shift was
// the trigger — get back a fully-shaped `ctx` for the panel.
// =====================================================================

function buildRemoveWorkerCtx({ worker, bookingId, requisition, currentShiftId, defaultScope }) {
  const sup = REQ_SUPPLIERS[worker.supplier] || REQ_SUPPLIERS.sw;

  // Build a synthetic 5-day shift list for this booking. In production this
  // would come from the actual schedule store; the demo data here is shaped
  // to feel realistic for the impact math (rate × hours, SLA tier resolution).
  const dates = [
    { date: "Thu, Apr 23", time: "6:00 AM – 3:00 PM", hours: 9.0, hoursUntilStart: -3 },
    { date: "Fri, Apr 24", time: "6:00 AM – 3:00 PM", hours: 9.0, hoursUntilStart: 28 },
    { date: "Sat, Apr 25", time: "6:00 AM – 3:00 PM", hours: 9.0, hoursUntilStart: 52 },
    { date: "Sun, Apr 26", time: "6:00 AM – 3:00 PM", hours: 9.0, hoursUntilStart: 76 },
    { date: "Mon, Apr 27", time: "6:00 AM – 3:00 PM", hours: 9.0, hoursUntilStart: 100 },
  ];
  const shifts = dates.map((d, i) => ({
    id: `s-${i}`,
    ...d,
    isCurrent: currentShiftId ? (`s-${i}` === currentShiftId) : i === 0,
  }));

  // Pick a couple of suggested replacements: workers from the same supplier
  // first, then the broader pool. Filter out the worker themselves.
  const pool = (window.WORKERS || []).filter((w) => w.id !== worker.id);
  const sameSup = pool.filter((w) => w.supplier === worker.supplier).slice(0, 2);
  const others  = pool.filter((w) => w.supplier !== worker.supplier).slice(0, 2);
  const suggestedReplacements = [...sameSup, ...others].slice(0, 3).map((w, i) => ({
    ...w,
    availability: i === 0 ? "full" : i === 1 ? "full" : "partial",
  }));

  // Next supplier in the requisition's distribution (best effort).
  const supList = (requisition && requisition.suppliers) || ["sw", "th", "ph"];
  const idx = supList.indexOf(worker.supplier);
  const nextSupplierId = supList[(idx + 1) % supList.length] || "th";

  return {
    worker,
    bookingId: bookingId || (requisition && requisition.id) || "00000",
    role: (requisition && requisition.jobs && requisition.jobs[0]) || (worker.jobs && worker.jobs[0]) || "Worker",
    location: (requisition && requisition.location) || "—",
    requestor: (requisition && requisition.bookedBy) || "Nia Thompson",
    rate: (requisition && requisition.payRate) || 32,
    nextSupplierId,
    shifts,
    suggestedReplacements,
    defaultScope,
  };
}

// =====================================================================
// Global host — listens on the Interactions bus so any page can call
// `openRemoveWorker(ctx)` without wiring a hook in locally. Mirrors
// EditEntityHost's pattern.
// =====================================================================

function RemoveWorkerHost() {
  const [config, setConfig] = useStateRw(null);
  useEffectRw(() => Interactions.on("removeWorker", setConfig), []);
  if (!config) return null;
  return (
    <RemoveWorkerPanel
      open
      ctx={config}
      onClose={() => setConfig(null)}
      onConfirm={(result) => {
        if (config.onConfirm) config.onConfirm(result);
        else if (result.scope === "engagement" || result.scope === "worker") {
          const verb = result.scope === "engagement" ? "engagement ended" : "offboarded";
          showToast(`${config.worker.name} \u00b7 ${verb}`, {
            kind: "success",
            action: { label: "Undo", onClick: () => showToast("Offboarding undone") },
          });
        } else {
          const n = result.selectedShifts.length;
          const target = n === 1
            ? `the ${result.selectedShifts[0].date} shift`
            : `${n} shifts`;
          showToast(`${config.worker.name} removed from ${target}`, {
            kind: "success",
            action: { label: "Undo", onClick: () => showToast("Removal undone") },
          });
        }
        setConfig(null);
      }}
    />
  );
}

function openRemoveWorker(ctx) {
  Interactions.emit("removeWorker", ctx);
}

Object.assign(window, {
  RemoveWorkerPanel,
  RemoveWorkerHost,
  useRemoveWorker,
  buildRemoveWorkerCtx,
  openRemoveWorker,
  RW_REASONS,
  RW_SLA_TIERS,
});
