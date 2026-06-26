// =====================================================================
// Flex Work — SOW · interactive detail sections
//   Drop-in body for the unified detail's SOW variant. Replaces the
//   static "Agreement · Milestones · Deliverables" placeholder list
//   inside <SowEngagementBody> with real interactive accordions backed
//   by the existing sample data layer (pages/sow.jsx). Reuses the
//   existing accordion + table + activity primitives — no new shells,
//   no new schemas.
//
//   Reused primitives:
//     · window.WfAccordionCard         — accordion shell (defaultOpen)
//     · window.MiniTable               — table with columns + rows
//     · window.InfoGrid                — 2-column label/value list
//     · window.showToast               — toast confirmations
//     · window.flexViewAsRole          — role-conditional actions
//     · window.getSOWMilestones        — sample data
//     · window.getSOWDeliverables      — sample data
//     · window.getSOWChangeOrders      — sample data
//     · window.getSOWResources         — sample data
//     · window.sowFmtMoney             — currency formatter
//     · window.sowStatusMeta           — status pill metadata
//     · window.sowMilestoneStatusMeta  — milestone status metadata
//
//   Role conditions (window.flexViewAsRole):
//     · admin / manager → Accept / Reject milestone, Accept deliverable,
//                         author Change Order
//     · agency          → Submit milestone, Upload deliverable, request
//                         Change Order
//     · worker          → read-only (worker mobile is the right surface
//                         for the consultant; this surface is desktop)
//
//   Companion CSS: styles-sow-detail.css.
// =====================================================================

(function () {
  const { useState, useMemo } = React;

  // ---------- helpers ----------------------------------------------
  function role() {
    return (typeof window !== "undefined" && window.flexViewAsRole) || "admin";
  }
  function canAcceptAsBuyer() {
    const r = role();
    return r === "admin" || r === "manager";
  }
  function canSubmitAsSupplier() {
    return role() === "agency";
  }
  function fmtMoney(amount, currency) {
    if (window.sowFmtMoney) return window.sowFmtMoney(amount, currency);
    return `${currency || "USD"} ${Math.round(amount || 0).toLocaleString()}`;
  }
  function fmtDate(d) {
    if (!d) return "—";
    return d;
  }
  function statusPill(status, meta) {
    const fg = (meta && meta.fg) || "var(--evr-content-primary-default)";
    const bg = (meta && meta.bg) || "var(--evr-surface-secondary-default)";
    const label = (meta && meta.label) || status;
    return (
      <span className="sowd-pill" style={{ color: fg, background: bg }}>
        {label}
      </span>
    );
  }

  // ---------- audit + toast wrapper --------------------------------
  function audit(sow, action, kind, extra) {
    if (window.showToast) window.showToast(action, kind ? { kind } : null);
    if (window.writeAudit && sow) {
      window.writeAudit({
        scope: "sow",
        target: sow.id,
        action,
        source: "ui",
        ...(extra || {}),
      });
    }
  }

  // ---------- Agreement accordion ----------------------------------
  function AgreementAccordion({ sow }) {
    const Card = window.WfAccordionCard;
    const Info = window.InfoGrid;
    if (!Card || !sow) return null;
    const rows = [
      { label: "Supplier",       value: sow.supplierLabel || (sow.supplier && sow.supplier.label) || "—" },
      { label: "MSA",            value: <code>{sow.msaRef || "—"}</code> },
      { label: "Country",        value: `${sow.countryName || sow.country || "—"}` },
      { label: "Term",           value: `${fmtDate(sow.startDate)} – ${fmtDate(sow.endDate)}` },
      { label: "Total value",    value: <span className="tabular">{fmtMoney(sow.totalValue, sow.currency)}</span> },
      { label: "Billing model",  value: (window.sowBillingLabel && window.sowBillingLabel(sow.billingModel)) || sow.billingModel || "—" },
      { label: "Payment terms",  value: sow.paymentTerms || "—" },
      { label: "Retainage",      value: sow.retainagePct ? `${sow.retainagePct}%` : "None" },
      { label: "Owner",          value: sow.owner || "—" },
      { label: "Cost center",    value: sow.costCenter || "—" },
      { label: "Category",       value: sow.category || "—" },
      { label: "Risk score",     value: sow.riskScore || "—" },
    ];
    return (
      <Card icon="Notes" title="Agreement" subtitle="MSA · terms · payment · attachments" defaultOpen>
        {Info ? <Info rows={rows} /> : (
          <ul className="sowd-info-fallback">
            {rows.map((r, i) => (
              <li key={i}><b>{r.label}</b>{r.value}</li>
            ))}
          </ul>
        )}
        {sow.summary && (
          <p className="sowd-summary">{sow.summary}</p>
        )}
      </Card>
    );
  }

  // ---------- Milestones accordion ---------------------------------
  function MilestonesAccordion({ sow }) {
    const Card = window.WfAccordionCard;
    const Mini = window.MiniTable;
    const initialMs = useMemo(() => (window.getSOWMilestones && window.getSOWMilestones(sow.id)) || [], [sow.id]);
    const [milestones, setMilestones] = useState(initialMs);
    if (!Card || !sow) return null;

    const buyer = canAcceptAsBuyer();
    const supplier = canSubmitAsSupplier();

    function transition(id, next, actionLabel, kind) {
      setMilestones((arr) => arr.map((m) => (
        m.id === id
          ? { ...m, status: next, acceptedOn: next === "Accepted" ? new Date().toISOString().slice(0, 10) : m.acceptedOn }
          : m
      )));
      const m = milestones.find((x) => x.id === id);
      audit(sow, `${actionLabel} — ${m ? m.name : id}`, kind);
    }

    const completedCount = milestones.filter((m) => m.status === "Accepted" || m.status === "Paid").length;
    const totalValue = milestones.reduce((sum, m) => sum + (m.value || 0), 0);
    const earnedValue = milestones
      .filter((m) => m.status === "Accepted" || m.status === "Paid")
      .reduce((sum, m) => sum + (m.value || 0), 0);

    const subtitle = `${completedCount} / ${milestones.length} accepted · ${fmtMoney(earnedValue, sow.currency)} of ${fmtMoney(totalValue, sow.currency)}`;

    const columns = [
      { key: "name", label: "Milestone", width: "minmax(0, 2fr)" },
      { key: "due",  label: "Due",       width: "120px" },
      { key: "value", label: "Fee", width: "140px", align: "right",
        render: (r) => <span className="tabular">{fmtMoney(r.value, sow.currency)}</span> },
      { key: "status", label: "Status",  width: "150px",
        render: (r) => statusPill(r.status, window.sowMilestoneStatusMeta && window.sowMilestoneStatusMeta(r.status)) },
      { key: "actions", label: "", width: "230px", align: "right",
        render: (r) => {
          // Supplier: Submit on Planned / In progress, Revise on Rejected
          if (supplier) {
            if (r.status === "Planned" || r.status === "In progress") {
              return (
                <button type="button" className="sowd-btn sowd-btn--primary"
                  onClick={() => transition(r.id, "Submitted", "Submitted milestone", "success")}>
                  Submit
                </button>
              );
            }
            if (r.status === "Rejected") {
              return (
                <button type="button" className="sowd-btn sowd-btn--primary"
                  onClick={() => transition(r.id, "Submitted", "Resubmitted milestone", "success")}>
                  Resubmit
                </button>
              );
            }
            return <span className="sowd-muted">Awaiting buyer</span>;
          }
          // Buyer: Accept / Reject on Submitted
          if (buyer && r.status === "Submitted") {
            return (
              <span className="sowd-actions">
                <button type="button" className="sowd-btn sowd-btn--ghost"
                  onClick={() => transition(r.id, "Rejected", "Rejected milestone", undefined)}>
                  Reject
                </button>
                <button type="button" className="sowd-btn sowd-btn--primary"
                  onClick={() => transition(r.id, "Accepted", "Accepted milestone", "success")}>
                  Accept
                </button>
              </span>
            );
          }
          return null;
        }},
    ];

    return (
      <Card icon="Calendar" title="Milestones" subtitle={subtitle} defaultOpen>
        <Mini
          columns={columns}
          rows={milestones}
          empty="No milestones authored yet."
        />
        {/* Acceptance criteria boilerplate — visible to buyer + supplier */}
        <div className="sowd-criteria">
          <h5 className="sowd-criteria-h">Acceptance criteria</h5>
          <ul className="sowd-criteria-list" role="list">
            <li>Supplier marks the milestone Submitted with evidence attached.</li>
            <li>Buyer reviews against the SOW's stated acceptance criteria and either Accepts or Rejects with rework notes.</li>
            <li>Acceptance fires a BillingEvent; rejection returns the milestone to In progress with the notes attached.</li>
            <li>{sow.retainagePct > 0 ? `${sow.retainagePct}% retainage is withheld from each accepted milestone; released on ${sow.paymentTerms || "closeout"}.` : "No retainage withheld — full fee fires on acceptance."}</li>
          </ul>
        </div>
      </Card>
    );
  }

  // ---------- Deliverables accordion -------------------------------
  function DeliverablesAccordion({ sow }) {
    const Card = window.WfAccordionCard;
    const Mini = window.MiniTable;
    const initial = useMemo(() => (window.getSOWDeliverables && window.getSOWDeliverables(sow.id)) || [], [sow.id]);
    const [deliverables, setDeliverables] = useState(initial);
    if (!Card || !sow) return null;

    const buyer = canAcceptAsBuyer();
    const supplier = canSubmitAsSupplier();

    function transition(id, next, actionLabel, kind) {
      setDeliverables((arr) => arr.map((d) => (d.id === id ? { ...d, status: next } : d)));
      const d = deliverables.find((x) => x.id === id);
      audit(sow, `${actionLabel} — ${d ? d.name : id}`, kind);
    }

    const accepted = deliverables.filter((d) => d.status === "Accepted" || d.status === "Signed off").length;

    const STATUS_META = {
      "Not started": { bg: "var(--evr-surface-secondary-default)", fg: "var(--evr-content-primary-lowemp)" },
      "In progress": { bg: "var(--evr-surface-decorative-default-yellow, #FBF3D9)", fg: "var(--evr-content-decorative-yellow, #6B5A2E)" },
      "In review":   { bg: "var(--evr-surface-decorative-default-blue)", fg: "var(--evr-interactive-primary-default)" },
      "Accepted":    { bg: "var(--evr-surface-decorative-default-green, #DCEFE3)", fg: "var(--evr-content-status-success-default)" },
      "Signed off":  { bg: "var(--evr-surface-decorative-default-green, #DCEFE3)", fg: "var(--evr-content-status-success-default)" },
      "Rejected":    { bg: "var(--evr-surface-decorative-default-red, #FBE1E1)", fg: "var(--evr-content-status-error-default)" },
    };

    const columns = [
      { key: "name", label: "Deliverable", width: "minmax(0, 2fr)" },
      { key: "milestone", label: "Milestone", width: "1fr",
        render: (r) => <span className="sowd-muted tabular">{r.milestoneId}</span> },
      { key: "status", label: "Status", width: "150px",
        render: (r) => statusPill(r.status, STATUS_META[r.status]) },
      { key: "actions", label: "", width: "220px", align: "right",
        render: (r) => {
          if (supplier) {
            if (r.status === "Not started" || r.status === "In progress") {
              return (
                <button type="button" className="sowd-btn sowd-btn--secondary"
                  onClick={() => transition(r.id, "In review", "Uploaded deliverable", "success")}>
                  Upload artifact
                </button>
              );
            }
            if (r.status === "Rejected") {
              return (
                <button type="button" className="sowd-btn sowd-btn--secondary"
                  onClick={() => transition(r.id, "In review", "Re-uploaded deliverable", "success")}>
                  Re-upload
                </button>
              );
            }
            return <span className="sowd-muted">With buyer</span>;
          }
          if (buyer && r.status === "In review") {
            return (
              <span className="sowd-actions">
                <button type="button" className="sowd-btn sowd-btn--ghost"
                  onClick={() => transition(r.id, "Rejected", "Rejected deliverable", undefined)}>
                  Reject
                </button>
                <button type="button" className="sowd-btn sowd-btn--primary"
                  onClick={() => transition(r.id, "Accepted", "Accepted deliverable", "success")}>
                  Accept
                </button>
              </span>
            );
          }
          return null;
        }},
    ];

    return (
      <Card icon="Notes" title="Deliverables" subtitle={`${accepted} / ${deliverables.length} accepted`}>
        <Mini
          columns={columns}
          rows={deliverables}
          empty="No deliverables registered yet."
        />
      </Card>
    );
  }

  // ---------- Change orders accordion ------------------------------
  function ChangeOrdersAccordion({ sow }) {
    const Card = window.WfAccordionCard;
    const Mini = window.MiniTable;
    const initial = useMemo(() => (window.getSOWChangeOrders && window.getSOWChangeOrders(sow.id)) || [], [sow.id]);
    const [changeOrders, setChangeOrders] = useState(initial);
    const [composeOpen, setComposeOpen] = useState(false);
    if (!Card || !sow) return null;

    const buyer = canAcceptAsBuyer();
    const supplier = canSubmitAsSupplier();

    function addCO(payload) {
      const id = `co-${sow.id.slice(-3)}-${changeOrders.length + 1}`;
      const co = {
        id,
        title: payload.title,
        status: "In approval",
        amount: payload.amount || 0,
        currency: sow.currency,
        date: new Date().toISOString().slice(0, 10),
        author: supplier ? "Agency" : "Buyer",
      };
      setChangeOrders((arr) => [...arr, co]);
      setComposeOpen(false);
      audit(sow, `Authored change order — ${payload.title}`, "success");
    }

    function approve(id) {
      setChangeOrders((arr) => arr.map((c) => (c.id === id ? { ...c, status: "Approved" } : c)));
      const c = changeOrders.find((x) => x.id === id);
      audit(sow, `Approved change order — ${c ? c.title : id}`, "success");
    }

    const STATUS_META = {
      "Approved":     { bg: "var(--evr-surface-decorative-default-green, #DCEFE3)", fg: "var(--evr-content-status-success-default)" },
      "In approval":  { bg: "var(--evr-surface-decorative-default-blue)",  fg: "var(--evr-interactive-primary-default)" },
      "Rejected":     { bg: "var(--evr-surface-decorative-default-red, #FBE1E1)", fg: "var(--evr-content-status-error-default)" },
      "Draft":        { bg: "var(--evr-surface-secondary-default)", fg: "var(--evr-content-primary-lowemp)" },
    };

    const columns = [
      { key: "title", label: "Change order", width: "minmax(0, 2fr)" },
      { key: "amount", label: "Impact", width: "140px", align: "right",
        render: (r) => <span className="tabular">{fmtMoney(r.amount, r.currency || sow.currency)}</span> },
      { key: "date", label: "Date", width: "120px",
        render: (r) => <span className="sowd-muted tabular">{r.date}</span> },
      { key: "status", label: "Status", width: "150px",
        render: (r) => statusPill(r.status, STATUS_META[r.status]) },
      { key: "actions", label: "", width: "120px", align: "right",
        render: (r) => {
          if (buyer && r.status === "In approval") {
            return (
              <button type="button" className="sowd-btn sowd-btn--primary"
                onClick={() => approve(r.id)}>
                Approve
              </button>
            );
          }
          return null;
        }},
    ];

    return (
      <Card
        icon="Refresh"
        title="Change orders"
        subtitle={`${changeOrders.filter((c) => c.status === "Approved").length} approved · ${changeOrders.filter((c) => c.status === "In approval").length} in approval`}
        action={
          <button
            type="button"
            className="sowd-btn sowd-btn--secondary"
            onClick={(e) => { e.stopPropagation(); setComposeOpen(true); }}
          >
            + Author change order
          </button>
        }
      >
        <Mini
          columns={columns}
          rows={changeOrders}
          empty="No change orders authored yet."
        />
        {composeOpen && (
          <ChangeOrderComposer
            sow={sow}
            onCancel={() => setComposeOpen(false)}
            onSubmit={addCO}
          />
        )}
      </Card>
    );
  }

  function ChangeOrderComposer({ sow, onCancel, onSubmit }) {
    const [title, setTitle] = useState("");
    const [amount, setAmount] = useState("");
    const [scope, setScope] = useState("Scope expansion");
    const [narrative, setNarrative] = useState("");
    const SCOPES = ["Scope expansion", "Scope reduction", "Timeline change", "Resource swap", "Fee adjustment"];
    return (
      <form
        className="sowd-co-compose"
        onSubmit={(e) => {
          e.preventDefault();
          if (!title.trim()) return;
          onSubmit({ title: title.trim(), amount: Number(amount) || 0, scope, narrative });
        }}
      >
        <h5 className="sowd-co-h">Author change order</h5>
        <div className="sowd-co-grid">
          <label className="sowd-fld">
            <span className="sowd-fld-lab">Title</span>
            <input
              type="text"
              className="sowd-fld-input"
              placeholder="e.g. Add benefits enrollment scope"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </label>
          <label className="sowd-fld">
            <span className="sowd-fld-lab">Change type</span>
            <select
              className="sowd-fld-input"
              value={scope}
              onChange={(e) => setScope(e.target.value)}
            >
              {SCOPES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
          <label className="sowd-fld">
            <span className="sowd-fld-lab">Fee impact ({sow.currency})</span>
            <input
              type="number"
              className="sowd-fld-input tabular"
              placeholder="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </label>
        </div>
        <label className="sowd-fld sowd-fld--full">
          <span className="sowd-fld-lab">Justification</span>
          <textarea
            className="sowd-fld-input"
            rows={3}
            placeholder="What changed and why. The other side sees this in the approval queue."
            value={narrative}
            onChange={(e) => setNarrative(e.target.value)}
          />
        </label>
        <div className="sowd-co-actions">
          <button type="button" className="sowd-btn sowd-btn--ghost" onClick={onCancel}>Cancel</button>
          <button type="submit" className="sowd-btn sowd-btn--primary">Submit for approval</button>
        </div>
      </form>
    );
  }

  // ---------- Resources accordion ----------------------------------
  function ResourcesAccordion({ sow }) {
    const Card = window.WfAccordionCard;
    const Mini = window.MiniTable;
    const resources = useMemo(() => {
      const all = (window.getSOWResources && window.getSOWResources()) || [];
      return all.filter((r) => r.sowId === sow.id);
    }, [sow.id]);
    if (!Card || !sow) return null;
    const columns = [
      { key: "name", label: "Name", width: "minmax(0, 2fr)" },
      { key: "role", label: "Role", width: "minmax(0, 2fr)" },
      { key: "allocation", label: "Allocation", width: "120px",
        render: (r) => <span className="tabular">{r.allocation}</span> },
      { key: "since", label: "Since", width: "120px",
        render: (r) => <span className="sowd-muted tabular">{r.since}</span> },
    ];
    return (
      <Card icon="PersonLines" title="Resources" subtitle={`${resources.length} supplier-assigned`}>
        {(() => {
          const isAgency = window.flexViewAsRole === "agency";
          const supplierId = sow.supplierId || (resources[0] && resources[0].supplierId) || (window.REQ_SUPPLIERS && Object.keys(window.REQ_SUPPLIERS)[0]);
          const role = (resources[0] && resources[0].role) || sow.primaryRole || "Consultant";
          return (
            <div className="sowd-res-actions">
              <button type="button" className="btn btn--sm btn--secondary"
                onClick={() => window.openAssignWorkerPanel && window.openAssignWorkerPanel({
                  supplierId, role,
                  engagementType: "Statement of Work",
                  sowId: sow.id,
                  supplierType: "Agency",
                })}>
                <Icon name="PersonPlus" size={14} />
                {isAgency ? "Add resource" : "Request resource"}
              </button>
              <span className="sowd-res-hint">Resources onboard against the contract before they go active.</span>
            </div>
          );
        })()}
        <Mini
          columns={columns}
          rows={resources}
          empty={canSubmitAsSupplier()
            ? "No team proposed yet. Click 'Propose team' to staff this SOW."
            : "The supplier has not proposed a team yet."}
        />
      </Card>
    );
  }

  // ---------- Activity accordion -----------------------------------
  function ActivityAccordion({ sow }) {
    const Card = window.WfAccordionCard;
    const [comments, setComments] = useState([
      { actor: "Buyer", action: "Reviewed milestone 'Position & job catalog cutover' and requested clarification on pay-grade mapping.", time: "2 days ago" },
      { actor: "Supplier", action: "Submitted milestone 'Position & job catalog cutover' for acceptance with revised cutover plan attached.", time: "3 days ago" },
      { actor: "System", action: "BillingEvent fired for accepted milestone 'Org hierarchy migration' — invoice INV-2026-0418 generated.", time: "1 week ago" },
    ]);
    const [draft, setDraft] = useState("");
    if (!Card || !sow) return null;
    function post() {
      if (!draft.trim()) return;
      const r = role();
      const actor = r === "agency" ? "Supplier" : (r === "manager" ? "Manager" : "Admin");
      setComments((arr) => [{ actor, action: draft.trim(), time: "just now" }, ...arr]);
      setDraft("");
      audit(sow, "Posted to discussion thread", "success");
    }
    return (
      <Card icon="Notes" title="Discussion" subtitle={`${comments.length} entries`}>
        <div className="sowd-thread">
          <div className="sowd-thread-compose">
            <textarea
              className="sowd-fld-input"
              rows={2}
              placeholder="Leave a note for the other side..."
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
            />
            <button type="button" className="sowd-btn sowd-btn--primary" onClick={post}>
              Post
            </button>
          </div>
          <ul className="sowd-thread-list" role="list">
            {comments.map((c, i) => (
              <li key={i} className="sowd-thread-item">
                <span className={"sowd-thread-actor sowd-thread-actor--" + c.actor.toLowerCase()}>{c.actor}</span>
                <p className="sowd-thread-action">{c.action}</p>
                <span className="sowd-thread-time">{c.time}</span>
              </li>
            ))}
          </ul>
        </div>
      </Card>
    );
  }

  // ---------- Closeout accordion (Manager only, when nearing end) --
  function CloseoutAccordion({ sow }) {
    const Card = window.WfAccordionCard;
    if (!Card || !sow) return null;
    // Only render on Active+ SOWs that have made progress
    if (sow.status === "Draft" || sow.status === "In approval") return null;
    const pct = sow.totalValue ? Math.round((sow.consumed / sow.totalValue) * 100) : 0;
    const closeoutReady = pct >= 100 || sow.status === "Completed";
    return (
      <Card icon="Check" title="Closeout" subtitle={closeoutReady ? "Ready to generate the closeout package" : `${pct}% consumed — not yet closeable`}>
        <div className="sowd-closeout">
          <p className="sowd-closeout-blurb">
            Generate a single audit-ready package: final invoice, retainage release request, all accepted deliverables, the full change-order chain, the financials summary, and the original signed SOW.
          </p>
          <ul className="sowd-closeout-checklist" role="list">
            <li><span className="sowd-check" data-on={pct === 100}></span>All milestones accepted</li>
            <li><span className="sowd-check" data-on={sow.consumed === sow.totalValue}></span>Full fee schedule consumed</li>
            <li><span className="sowd-check" data-on={true}></span>All deliverables signed off</li>
            <li><span className="sowd-check" data-on={true}></span>No open change orders</li>
          </ul>
          {canAcceptAsBuyer() && (
            <button
              type="button"
              className="sowd-btn sowd-btn--primary"
              disabled={!closeoutReady}
              onClick={() => audit(sow, "Generated closeout package", "success")}
            >
              Generate closeout package
            </button>
          )}
        </div>
      </Card>
    );
  }

  // ---------- Proposals accordion (RFx + evaluation + agency composer)
  //
  // Manager sees: list of returned proposals with side-by-side scoring,
  //               an "Award" action for the leader.
  // Agency sees:  composer when no proposal has been submitted yet; a
  //               read-only summary of their submitted proposal otherwise.
  //
  // Surfaces on SOWs that are still in In approval / Draft (i.e. not yet
  // awarded). Once Active / Completed / Closed, the accordion is hidden.
  function ProposalsAccordion({ sow }) {
    const Card = window.WfAccordionCard;
    const Mini = window.MiniTable;
    if (!Card || !sow) return null;
    if (!(sow.status === "In approval" || sow.status === "Draft")) return null;

    const buyer = canAcceptAsBuyer();
    const supplier = canSubmitAsSupplier();
    // Seed sample proposals — three suppliers responded
    const initial = useMemo(() => ([
      {
        id: "pr-1", supplier: sow.supplierLabel || "AlphaTech Partners",
        fee: sow.totalValue, currency: sow.currency,
        timeline: "On schedule", team: 4, score: 87, status: "Submitted",
        approach: "Phased rollout with pilot tenants in weeks 4-6, full cutover at week 28. Senior architect carries the data model; rollout team scales 2 → 4 in week 12.",
      },
      {
        id: "pr-2", supplier: "WorkForce Now",
        fee: Math.round(sow.totalValue * 0.92), currency: sow.currency,
        timeline: "+2 weeks", team: 5, score: 79, status: "Submitted",
        approach: "Cost-led proposal. Larger team, longer timeline, lower fee per resource. Discounts on T&M draws over 1,000 hours.",
      },
      {
        id: "pr-3", supplier: "StaffWise",
        fee: Math.round(sow.totalValue * 1.08), currency: sow.currency,
        timeline: "-2 weeks", team: 3, score: 91, status: "Submitted",
        approach: "Compressed timeline, senior team only. References from three Dayforce migrations in 2025. Premium fee reflects the senior mix.",
      },
    ]), [sow.id]);

    const [proposals, setProposals] = useState(initial);
    const [composeOpen, setComposeOpen] = useState(false);
    const [draftProposal, setDraftProposal] = useState({ fee: sow.totalValue, timeline: "On schedule", team: 3, approach: "" });

    function award(id) {
      const winner = proposals.find((p) => p.id === id);
      setProposals((arr) => arr.map((p) => ({ ...p, status: p.id === id ? "Awarded" : "Declined" })));
      audit(sow, `Awarded SOW to ${winner ? winner.supplier : id}`, "success");
    }

    function submitProposal() {
      const id = `pr-${proposals.length + 1}`;
      const newP = {
        id,
        supplier: "Your agency",
        fee: Number(draftProposal.fee) || 0,
        currency: sow.currency,
        timeline: draftProposal.timeline,
        team: Number(draftProposal.team) || 0,
        score: null,
        status: "Submitted",
        approach: draftProposal.approach,
      };
      setProposals((arr) => [...arr, newP]);
      setComposeOpen(false);
      audit(sow, "Submitted proposal for SOW", "success");
    }

    const STATUS_META = {
      "Submitted": { bg: "var(--evr-surface-decorative-default-blue)", fg: "var(--evr-interactive-primary-default)" },
      "Awarded":   { bg: "var(--evr-surface-decorative-default-green, #DCEFE3)", fg: "var(--evr-content-status-success-default)" },
      "Declined":  { bg: "var(--evr-surface-secondary-default)", fg: "var(--evr-content-primary-lowemp)" },
    };

    const columns = [
      { key: "supplier", label: "Supplier", width: "minmax(0, 1.5fr)" },
      { key: "fee", label: "Fee", width: "140px", align: "right",
        render: (r) => <span className="tabular">{fmtMoney(r.fee, r.currency)}</span> },
      { key: "timeline", label: "Timeline", width: "120px",
        render: (r) => <span className="sowd-muted">{r.timeline}</span> },
      { key: "team", label: "Team", width: "80px",
        render: (r) => <span className="tabular">{r.team}</span> },
      { key: "score", label: "Score", width: "100px",
        render: (r) => r.score != null ? (
          <span className="sowd-score" data-tier={r.score >= 85 ? "high" : r.score >= 75 ? "mid" : "low"}>
            {r.score}
          </span>
        ) : <span className="sowd-muted">—</span> },
      { key: "status", label: "Status", width: "120px",
        render: (r) => statusPill(r.status, STATUS_META[r.status]) },
      { key: "actions", label: "", width: "120px", align: "right",
        render: (r) => {
          if (buyer && r.status === "Submitted" && !proposals.some((p) => p.status === "Awarded")) {
            return (
              <button type="button" className="sowd-btn sowd-btn--primary"
                onClick={() => award(r.id)}>
                Award
              </button>
            );
          }
          return null;
        }},
    ];

    const subtitle = `${proposals.filter((p) => p.status === "Submitted").length} submitted${proposals.some((p) => p.status === "Awarded") ? " · 1 awarded" : ""}`;

    return (
      <Card
        icon="PersonLines"
        title="Proposals"
        subtitle={subtitle}
        defaultOpen
        action={supplier && !proposals.some((p) => p.supplier === "Your agency") ? (
          <button type="button" className="sowd-btn sowd-btn--secondary"
            onClick={(e) => { e.stopPropagation(); setComposeOpen(true); }}>
            + Submit proposal
          </button>
        ) : null}
      >
        <Mini
          columns={columns}
          rows={proposals}
          empty="No proposals returned yet — RFx still open."
        />
        {composeOpen && (
          <form
            className="sowd-co-compose"
            onSubmit={(e) => { e.preventDefault(); submitProposal(); }}
          >
            <h5 className="sowd-co-h">Submit proposal</h5>
            <div className="sowd-co-grid">
              <label className="sowd-fld">
                <span className="sowd-fld-lab">Proposed fee ({sow.currency})</span>
                <input type="number" className="sowd-fld-input tabular"
                  value={draftProposal.fee}
                  onChange={(e) => setDraftProposal((d) => ({ ...d, fee: e.target.value }))} />
              </label>
              <label className="sowd-fld">
                <span className="sowd-fld-lab">Timeline</span>
                <select className="sowd-fld-input"
                  value={draftProposal.timeline}
                  onChange={(e) => setDraftProposal((d) => ({ ...d, timeline: e.target.value }))}>
                  <option>On schedule</option>
                  <option>-2 weeks</option>
                  <option>-4 weeks</option>
                  <option>+2 weeks</option>
                  <option>+4 weeks</option>
                </select>
              </label>
              <label className="sowd-fld">
                <span className="sowd-fld-lab">Team size</span>
                <input type="number" className="sowd-fld-input tabular"
                  value={draftProposal.team}
                  onChange={(e) => setDraftProposal((d) => ({ ...d, team: e.target.value }))} />
              </label>
            </div>
            <label className="sowd-fld sowd-fld--full">
              <span className="sowd-fld-lab">Approach &amp; references</span>
              <textarea className="sowd-fld-input" rows={3}
                placeholder="Describe the approach, named team, and references. The buyer sees this in the evaluation pack."
                value={draftProposal.approach}
                onChange={(e) => setDraftProposal((d) => ({ ...d, approach: e.target.value }))} />
            </label>
            <div className="sowd-co-actions">
              <button type="button" className="sowd-btn sowd-btn--ghost" onClick={() => setComposeOpen(false)}>Cancel</button>
              <button type="submit" className="sowd-btn sowd-btn--primary">Submit proposal</button>
            </div>
          </form>
        )}
        {buyer && proposals.length > 0 && (
          <ul className="sowd-prop-narratives" role="list">
            {proposals.map((p) => (
              <li key={p.id} className="sowd-prop-narr">
                <div className="sowd-prop-narr-h">
                  <b>{p.supplier}</b>
                  {p.score != null && <span className="sowd-prop-narr-score" data-tier={p.score >= 85 ? "high" : p.score >= 75 ? "mid" : "low"}>Score · {p.score}</span>}
                </div>
                <p>{p.approach}</p>
              </li>
            ))}
          </ul>
        )}
      </Card>
    );
  }

  // ---------- Invoices accordion (milestone-tied invoice queue) -----
  function InvoicesAccordion({ sow }) {
    const Card = window.WfAccordionCard;
    const Mini = window.MiniTable;
    if (!Card || !sow) return null;
    // Pull SOW-tagged invoices from the existing invoices store, if available.
    const initial = useMemo(() => {
      // Read accepted milestones; each generates an invoice row.
      const ms = (window.getSOWMilestones && window.getSOWMilestones(sow.id)) || [];
      const retainagePct = sow.retainagePct || 0;
      return ms
        .filter((m) => m.status === "Paid" || m.status === "Accepted" || m.status === "Submitted")
        .map((m, i) => {
          const status = m.status === "Paid" ? "Paid"
            : m.status === "Accepted" ? "Pending approval"
            : "Pending acceptance";
          const retainage = Math.round((m.value || 0) * (retainagePct / 100));
          const net = (m.value || 0) - retainage;
          return {
            id: `INV-${sow.id.slice(-3)}-${String(i + 1).padStart(2, "0")}`,
            milestone: m.name,
            gross: m.value || 0,
            retainage,
            net,
            currency: sow.currency,
            status,
            date: m.acceptedOn || "—",
          };
        });
    }, [sow.id]);

    const [invoices, setInvoices] = useState(initial);
    const buyer = canAcceptAsBuyer();

    function approve(id) {
      setInvoices((arr) => arr.map((inv) => inv.id === id ? { ...inv, status: "Approved" } : inv));
      const inv = invoices.find((x) => x.id === id);
      audit(sow, `Approved invoice ${inv ? inv.id : id}`, "success");
    }
    function dispute(id) {
      setInvoices((arr) => arr.map((inv) => inv.id === id ? { ...inv, status: "Disputed" } : inv));
      const inv = invoices.find((x) => x.id === id);
      audit(sow, `Disputed invoice ${inv ? inv.id : id}`, undefined);
    }

    const STATUS_META = {
      "Paid":               { bg: "var(--evr-surface-decorative-default-green, #DCEFE3)", fg: "var(--evr-content-status-success-default)" },
      "Approved":           { bg: "var(--evr-surface-decorative-default-blue)",  fg: "var(--evr-interactive-primary-default)" },
      "Pending approval":   { bg: "var(--evr-surface-decorative-default-yellow, #FBF3D9)", fg: "var(--evr-content-decorative-yellow, #6B5A2E)" },
      "Pending acceptance": { bg: "var(--evr-surface-secondary-default)", fg: "var(--evr-content-primary-lowemp)" },
      "Disputed":           { bg: "var(--evr-surface-decorative-default-red, #FBE1E1)", fg: "var(--evr-content-status-error-default)" },
    };

    const columns = [
      { key: "id", label: "Invoice", width: "140px",
        render: (r) => <code>{r.id}</code> },
      { key: "milestone", label: "Milestone", width: "minmax(0, 2fr)" },
      { key: "gross", label: "Gross", width: "130px", align: "right",
        render: (r) => <span className="tabular">{fmtMoney(r.gross, r.currency)}</span> },
      { key: "retainage", label: "Retainage held", width: "150px", align: "right",
        render: (r) => r.retainage > 0
          ? <span className="tabular sowd-retainage">−{fmtMoney(r.retainage, r.currency)}</span>
          : <span className="sowd-muted">None</span> },
      { key: "net", label: "Net payable", width: "140px", align: "right",
        render: (r) => <span className="tabular"><b>{fmtMoney(r.net, r.currency)}</b></span> },
      { key: "status", label: "Status", width: "150px",
        render: (r) => statusPill(r.status, STATUS_META[r.status]) },
      { key: "actions", label: "", width: "180px", align: "right",
        render: (r) => {
          if (buyer && r.status === "Pending approval") {
            return (
              <span className="sowd-actions">
                <button type="button" className="sowd-btn sowd-btn--ghost"
                  onClick={() => dispute(r.id)}>Dispute</button>
                <button type="button" className="sowd-btn sowd-btn--primary"
                  onClick={() => approve(r.id)}>Approve</button>
              </span>
            );
          }
          return null;
        }},
    ];

    const pending = invoices.filter((i) => i.status === "Pending approval").length;
    const total = invoices.length;
    const subtitle = pending > 0
      ? `${pending} pending approval · ${total} total`
      : `${total} invoices · all current`;

    return (
      <Card icon="Pay" title="Invoices" subtitle={subtitle}>
        <Mini
          columns={columns}
          rows={invoices}
          empty="No invoices generated yet — invoices land here on milestone acceptance."
        />
        {sow.retainagePct > 0 && (
          <p className="sowd-retainage-note">
            <b>Retainage policy:</b> {sow.retainagePct}% of each accepted milestone is withheld and released on {sow.paymentTerms.split("·").slice(1).join("·").trim() || "closeout"}.
          </p>
        )}
      </Card>
    );
  }

  // ---------- Top-level wrapper ------------------------------------
  function SowDetailSections({ sow }) {
    if (!sow) return null;
    return (
      <React.Fragment>
        <AgreementAccordion sow={sow} />
        <ProposalsAccordion sow={sow} />
        <MilestonesAccordion sow={sow} />
        <DeliverablesAccordion sow={sow} />
        <ChangeOrdersAccordion sow={sow} />
        <InvoicesAccordion sow={sow} />
        <ResourcesAccordion sow={sow} />
        <ActivityAccordion sow={sow} />
        <CloseoutAccordion sow={sow} />
      </React.Fragment>
    );
  }

  Object.assign(window, { SowDetailSections });
})();
