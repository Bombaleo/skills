// =====================================================================
// Flex Work — Worker mobile · SOW assignment surface
//   Drop-in component that injects an "On SOW" card into the worker
//   mobile Home screen and exposes an interactive assignment detail
//   modal when tapped. Visible only when the worker has at least one
//   active SOW assignment AND the SOW engagement type is on.
//
//   Reuses:
//     · window.getSOWResources()   — supplier-managed worker roster
//     · window.getSOWById          — SOW agreement lookup
//     · window.getSOWMilestones    — current milestone context
//     · window.sowFmtMoney
//     · window.flexViewAsRole      — only renders for worker view
//     · window.showToast
//     · window.writeAudit
//
//   Embedded in pages/worker-mobile.jsx (WmHomeScreen) when the
//   engStatementOfWork engagement type is on. Worker views the SOW
//   they're staffed to, logs T&M hours (if billing model is tm_capped),
//   submits expenses (link to existing expense flow), uploads
//   deliverable artifacts, runs through the per-SOW compliance
//   checklist, and flags blockers up to the Agency PM.
//
//   Worker is identified by name match against window.getSOWResources()
//   — the sample data layer carries fixed names; in production the
//   worker's session id resolves to a SOW resource record.
//
//   Companion CSS: styles-sow-worker.css.
// =====================================================================

(function () {
  const { useState, useMemo } = React;

  function isSowOn() {
    if (window.getFeatureFlag) return !!window.getFeatureFlag("sow");
    return false;
  }

  // The current worker — in production this is the session. For the
  // prototype we accept it as a prop OR look up by impersonation.
  function _currentWorker() {
    if (window.flexWorkerImpersonated) return window.flexWorkerImpersonated;
    return null;
  }

  function findMyAssignments(workerName) {
    if (!isSowOn()) return [];
    const resources = (window.getSOWResources && window.getSOWResources()) || [];
    if (!workerName) {
      // For demo: return the first resource so the worker always sees
      // an assignment when SOW is on.
      return resources.length > 0 ? [resources[0]] : [];
    }
    return resources.filter((r) => (r.name || "").toLowerCase() === workerName.toLowerCase());
  }

  function fmtMoney(amount, currency) {
    if (window.sowFmtMoney) return window.sowFmtMoney(amount, currency);
    return `${currency || "USD"} ${Math.round(amount || 0).toLocaleString()}`;
  }

  // ---------- The home-screen banner card -------------------------
  function SowAssignmentCard({ onOpen }) {
    const assignments = useMemo(() => findMyAssignments(), []);
    if (!assignments.length) return null;
    const a = assignments[0];
    const sow = (window.getSOWById && window.getSOWById(a.sowId)) || null;
    if (!sow) return null;
    return (
      <button
        type="button"
        className="wm-sow-card"
        onClick={() => onOpen && onOpen(a, sow)}
      >
        <div className="wm-sow-card-head">
          <span className="wm-sow-card-eyebrow">On SOW · {a.allocation}</span>
          <span className="wm-sow-card-arrow">›</span>
        </div>
        <div className="wm-sow-card-title">{sow.name}</div>
        <div className="wm-sow-card-meta">
          <span>{a.role}</span>
          <span>·</span>
          <span>{sow.supplierLabel}</span>
        </div>
        <div className="wm-sow-card-foot">
          <span className="wm-sow-card-chip">{sow.id}</span>
          <span className="wm-sow-card-chip">since {a.since}</span>
        </div>
      </button>
    );
  }

  // ---------- The assignment detail screen (full-screen overlay) ---
  function SowAssignmentDetail({ assignment, sow, onClose }) {
    const [view, setView] = useState("overview"); // overview | time | expense | compliance | flag
    const ms = (window.getSOWMilestones && window.getSOWMilestones(sow.id)) || [];
    const currentMs = ms.find((m) => m.status === "In progress" || m.status === "Submitted") || ms[0];

    const isTM = sow.billingModel === "tm_capped";

    return (
      <div className="wm-sow-detail">
        <header className="wm-sow-detail-head">
          <button type="button" className="wm-sow-back" onClick={onClose} aria-label="Back">‹ Back</button>
          <span className="wm-sow-detail-eyebrow">SOW assignment</span>
          <span style={{ width: 60 }}></span>
        </header>

        <div className="wm-sow-detail-body">
          {view === "overview" && (
            <SowOverview
              assignment={assignment}
              sow={sow}
              currentMs={currentMs}
              isTM={isTM}
              onGo={setView}
            />
          )}
          {view === "time" && (
            <SowTimeEntry sow={sow} assignment={assignment} onBack={() => setView("overview")} />
          )}
          {view === "expense" && (
            <SowExpense sow={sow} onBack={() => setView("overview")} />
          )}
          {view === "compliance" && (
            <SowCompliance sow={sow} onBack={() => setView("overview")} />
          )}
          {view === "flag" && (
            <SowFlag sow={sow} onBack={() => setView("overview")} />
          )}
        </div>
      </div>
    );
  }

  // ---------- Overview ---------------------------------------------
  function SowOverview({ assignment, sow, currentMs, isTM, onGo }) {
    return (
      <React.Fragment>
        <div className="wm-sow-hero">
          <span className="wm-sow-hero-eyebrow">{sow.id} · {sow.supplierLabel}</span>
          <h2 className="wm-sow-hero-title">{sow.name}</h2>
          <p className="wm-sow-hero-sub">{assignment.role} · {assignment.allocation} since {assignment.since}</p>
        </div>

        {currentMs && (
          <div className="wm-sow-section">
            <div className="wm-sow-section-h">Current milestone</div>
            <div className="wm-sow-milestone">
              <div className="wm-sow-milestone-name">{currentMs.name}</div>
              <div className="wm-sow-milestone-meta">
                <span>Due {currentMs.due}</span>
                <span className="wm-sow-milestone-status">{currentMs.status}</span>
              </div>
            </div>
          </div>
        )}

        <div className="wm-sow-section">
          <div className="wm-sow-section-h">Quick actions</div>
          <div className="wm-sow-actions">
            {isTM && (
              <button type="button" className="wm-sow-action" onClick={() => onGo("time")}>
                <span className="wm-sow-action-ic">⏱</span>
                <span className="wm-sow-action-lab">Log T&amp;M hours</span>
              </button>
            )}
            <button type="button" className="wm-sow-action" onClick={() => onGo("expense")}>
              <span className="wm-sow-action-ic">💳</span>
              <span className="wm-sow-action-lab">Submit expense</span>
            </button>
            <button type="button" className="wm-sow-action" onClick={() => onGo("compliance")}>
              <span className="wm-sow-action-ic">✓</span>
              <span className="wm-sow-action-lab">Compliance</span>
            </button>
            <button type="button" className="wm-sow-action wm-sow-action--alert" onClick={() => onGo("flag")}>
              <span className="wm-sow-action-ic">⚑</span>
              <span className="wm-sow-action-lab">Flag a blocker</span>
            </button>
          </div>
        </div>

        <div className="wm-sow-section">
          <div className="wm-sow-section-h">Contacts</div>
          <div className="wm-sow-contacts">
            <div className="wm-sow-contact">
              <div className="wm-sow-contact-role">Buyer owner</div>
              <div className="wm-sow-contact-name">{sow.owner || "—"}</div>
            </div>
            <div className="wm-sow-contact">
              <div className="wm-sow-contact-role">Agency PM</div>
              <div className="wm-sow-contact-name">{sow.supplierLabel} delivery team</div>
            </div>
          </div>
        </div>

        <div className="wm-sow-section">
          <div className="wm-sow-section-h">Pay this period</div>
          <div className="wm-sow-pay">
            <div className="wm-sow-pay-label">Submitted hours + expenses this week</div>
            <div className="wm-sow-pay-amount">{fmtMoney(0, sow.currency)}</div>
            <div className="wm-sow-pay-note">
              Logged time and expenses appear here once the Agency PM has approved the submission.
            </div>
          </div>
        </div>
      </React.Fragment>
    );
  }

  // ---------- T&M time entry ---------------------------------------
  function SowTimeEntry({ sow, assignment, onBack }) {
    const today = new Date();
    const wkStart = new Date(today);
    wkStart.setDate(today.getDate() - today.getDay() + 1);
    const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d, i) => {
      const date = new Date(wkStart);
      date.setDate(wkStart.getDate() + i);
      return { id: d, label: d, date: `${date.getMonth() + 1}/${date.getDate()}`, hours: i < 5 ? 8 : 0 };
    });
    const [grid, setGrid] = useState(days);
    const total = grid.reduce((sum, d) => sum + (Number(d.hours) || 0), 0);

    function setHours(id, v) {
      const clean = Math.max(0, Math.min(24, Number(v) || 0));
      setGrid((arr) => arr.map((d) => d.id === id ? { ...d, hours: clean } : d));
    }

    function submit() {
      if (window.showToast) window.showToast(`Submitted ${total}h for week of ${grid[0].date}`, { kind: "success" });
      if (window.writeAudit) {
        window.writeAudit({
          scope: "sow", target: sow.id,
          action: `Worker submitted ${total}h on T&M for week of ${grid[0].date}`,
          source: "worker-mobile",
        });
      }
      onBack();
    }

    return (
      <React.Fragment>
        <button type="button" className="wm-sow-sub-back" onClick={onBack}>‹ Assignment</button>
        <h3 className="wm-sow-h2">Log T&amp;M hours</h3>
        <p className="wm-sow-blurb">
          Logged against <b>{sow.id}</b>. Submission goes to your Agency PM; once approved it lands on the next milestone invoice.
        </p>
        <div className="wm-sow-week">
          {grid.map((d) => (
            <div key={d.id} className="wm-sow-day">
              <label className="wm-sow-day-lab">
                <span>{d.label}</span>
                <span className="wm-sow-day-date">{d.date}</span>
              </label>
              <input
                type="number"
                step="0.25"
                min="0"
                max="24"
                value={d.hours}
                onChange={(e) => setHours(d.id, e.target.value)}
                className="wm-sow-day-input"
                inputMode="decimal"
              />
            </div>
          ))}
        </div>
        <div className="wm-sow-week-foot">
          <span>Week total</span>
          <span className="wm-sow-week-total tabular">{total}h</span>
        </div>
        <button type="button" className="wm-sow-submit" onClick={submit}>
          Submit for approval
        </button>
      </React.Fragment>
    );
  }

  // ---------- Expense submission -----------------------------------
  function SowExpense({ sow, onBack }) {
    const [category, setCategory] = useState("Travel");
    const [amount, setAmount] = useState("");
    const [note, setNote] = useState("");
    const CATEGORIES = ["Travel", "Lodging", "Meals", "Mileage", "Materials", "Other"];
    function submit() {
      if (!amount || Number(amount) <= 0) return;
      if (window.showToast) window.showToast(`Expense submitted — ${category} · ${fmtMoney(Number(amount), sow.currency)}`, { kind: "success" });
      if (window.writeAudit) {
        window.writeAudit({
          scope: "sow", target: sow.id,
          action: `Worker submitted ${category} expense for ${fmtMoney(Number(amount), sow.currency)}`,
          source: "worker-mobile",
        });
      }
      onBack();
    }
    return (
      <React.Fragment>
        <button type="button" className="wm-sow-sub-back" onClick={onBack}>‹ Assignment</button>
        <h3 className="wm-sow-h2">Submit expense</h3>
        <p className="wm-sow-blurb">
          Charged against <b>{sow.id}</b>. The Agency PM approves before it rolls into the next invoice.
        </p>

        <label className="wm-sow-fld">
          <span className="wm-sow-fld-lab">Category</span>
          <div className="wm-sow-chip-row">
            {CATEGORIES.map((c) => (
              <button
                key={c}
                type="button"
                className={"wm-sow-chip" + (c === category ? " wm-sow-chip--on" : "")}
                onClick={() => setCategory(c)}
              >
                {c}
              </button>
            ))}
          </div>
        </label>

        <label className="wm-sow-fld">
          <span className="wm-sow-fld-lab">Amount ({sow.currency})</span>
          <input
            type="number"
            step="0.01"
            min="0"
            className="wm-sow-day-input wm-sow-day-input--big tabular"
            inputMode="decimal"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </label>

        <label className="wm-sow-fld">
          <span className="wm-sow-fld-lab">Note</span>
          <textarea
            className="wm-sow-textarea"
            rows={3}
            placeholder="Optional. What this was for."
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </label>

        <div className="wm-sow-fld">
          <span className="wm-sow-fld-lab">Receipt</span>
          <button type="button" className="wm-sow-upload">
            📷 Photo receipt — tap to capture
          </button>
        </div>

        <button type="button" className="wm-sow-submit" onClick={submit}>
          Submit for approval
        </button>
      </React.Fragment>
    );
  }

  // ---------- Compliance checklist ---------------------------------
  function SowCompliance({ sow, onBack }) {
    const initial = [
      { id: "c1", name: "Mutual NDA",                  done: true },
      { id: "c2", name: "Client security training",    done: true },
      { id: "c3", name: "IP assignment acknowledgment", done: false },
      { id: "c4", name: "Site safety briefing",        done: false },
      { id: "c5", name: "Data-handling addendum",      done: false },
    ];
    const [items, setItems] = useState(initial);
    const remaining = items.filter((i) => !i.done).length;

    function toggle(id) {
      const item = items.find((x) => x.id === id);
      const next = !(item && item.done);
      setItems((arr) => arr.map((i) => i.id === id ? { ...i, done: next } : i));
      if (next && window.showToast) {
        window.showToast(`Acknowledged — ${item.name}`, { kind: "success" });
      }
      if (next && window.writeAudit) {
        window.writeAudit({
          scope: "sow", target: sow.id,
          action: `Worker acknowledged "${item.name}"`,
          source: "worker-mobile",
        });
      }
    }

    return (
      <React.Fragment>
        <button type="button" className="wm-sow-sub-back" onClick={onBack}>‹ Assignment</button>
        <h3 className="wm-sow-h2">Compliance</h3>
        <p className="wm-sow-blurb">
          {remaining === 0
            ? "All clear. Cleared to start."
            : `${remaining} item${remaining > 1 ? "s" : ""} left before you're cleared to start work for this client.`}
        </p>
        <ul className="wm-sow-checklist" role="list">
          {items.map((it) => (
            <li key={it.id}>
              <button
                type="button"
                className={"wm-sow-check-row" + (it.done ? " wm-sow-check-row--on" : "")}
                onClick={() => toggle(it.id)}
              >
                <span className="wm-sow-check-box" aria-hidden="true">
                  {it.done ? "✓" : ""}
                </span>
                <span className="wm-sow-check-lab">{it.name}</span>
              </button>
            </li>
          ))}
        </ul>
      </React.Fragment>
    );
  }

  // ---------- Blocker flag -----------------------------------------
  function SowFlag({ sow, onBack }) {
    const [kind, setKind] = useState("Blocked by client");
    const [note, setNote] = useState("");
    const KINDS = ["Blocked by client", "Scope ambiguity", "Resource constraint", "Compliance gap", "Other"];
    function submit() {
      if (window.showToast) window.showToast(`Flagged — ${kind}`, { kind: "success" });
      if (window.writeAudit) {
        window.writeAudit({
          scope: "sow", target: sow.id,
          action: `Worker flagged a blocker — ${kind}: ${note.slice(0, 80)}`,
          source: "worker-mobile",
        });
      }
      onBack();
    }
    return (
      <React.Fragment>
        <button type="button" className="wm-sow-sub-back" onClick={onBack}>‹ Assignment</button>
        <h3 className="wm-sow-h2">Flag a blocker</h3>
        <p className="wm-sow-blurb">
          Routes to your Agency PM. Aggregated into the weekly status report the agency posts to the buyer.
        </p>
        <label className="wm-sow-fld">
          <span className="wm-sow-fld-lab">Type</span>
          <div className="wm-sow-chip-row">
            {KINDS.map((k) => (
              <button
                key={k}
                type="button"
                className={"wm-sow-chip" + (k === kind ? " wm-sow-chip--on" : "")}
                onClick={() => setKind(k)}
              >
                {k}
              </button>
            ))}
          </div>
        </label>
        <label className="wm-sow-fld">
          <span className="wm-sow-fld-lab">Detail</span>
          <textarea
            className="wm-sow-textarea"
            rows={4}
            placeholder="What's blocking you? Be specific so the PM can route it correctly."
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </label>
        <button type="button" className="wm-sow-submit" onClick={submit}>
          Flag to PM
        </button>
      </React.Fragment>
    );
  }

  // ---------- Coordinator that wires the card + detail -------------
  function SowWorkerMobile() {
    const [open, setOpen] = useState(null); // { assignment, sow } | null
    if (!isSowOn()) return null;
    return (
      <React.Fragment>
        <SowAssignmentCard onOpen={(a, sow) => setOpen({ assignment: a, sow })} />
        {open && (
          <SowAssignmentDetail
            assignment={open.assignment}
            sow={open.sow}
            onClose={() => setOpen(null)}
          />
        )}
      </React.Fragment>
    );
  }

  Object.assign(window, { SowWorkerMobile });
})();
