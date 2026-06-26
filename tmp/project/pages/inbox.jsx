// =====================================================================
// Flex Work — Inbox (approvals queue)
// Single triage queue that consolidates timesheets, requisitions,
// invoices and rate-card change requests waiting on the user's sign-off.
// =====================================================================

const { useState: useStateInbox, useMemo: useMemoInbox } = React;

const INBOX_KINDS = [
  { id: "all",  label: "All",            icon: "Inbox" },
  { id: "ts",   label: "Timesheets",     icon: "PersonClock" },
  { id: "req",  label: "Requisitions",   icon: "Briefcase" },
  { id: "inv",  label: "Invoices",       icon: "Pay" },
  { id: "rate", label: "Rate changes",   icon: "TimeAdd" },
];

const PRIORITY_ORDER = { high: 0, med: 1, low: 2 };

function InboxApprovalRow({ a, checked, onToggle, onOpen, onApprove, onReject }) {
  const KIND_LABEL = { ts: "Timesheet", req: "Requisition", inv: "Invoice", rate: "Rate" };
  // v0.79 · M2 — SLA + auto-escalation on rate_change approvals. Each
  // org carries an SLA (default 72h) and a route-to-next-approver
  // behavior past expiry. Reads the policy from
  // window.flexRateChangeSlaHours; defaults to 72.
  const slaHours = (typeof window !== "undefined" && window.flexRateChangeSlaHours) || 72;
  const slaForKind = (kind) => {
    if (kind === "rate") return slaHours;
    if (kind === "ts")   return 48;
    if (kind === "inv")  return 96;
    if (kind === "req")  return 24;
    return null;
  };
  const slaState = (() => {
    if (!a.submittedAt) {
      // Synthesize a submission time from the id so the prototype reads
      // realistic without a backend feed. Deterministic by id.
      const h = Array.from(String(a.id || "x")).reduce((s, c) => (s * 31 + c.charCodeAt(0)) | 0, 0);
      const ageH = Math.abs(h) % 96; // 0–96 hours back
      a.submittedAt = new Date(Date.now() - ageH * 3600 * 1000).toISOString();
    }
    const cap = slaForKind(a.kind);
    if (!cap) return null;
    const elapsedH = (Date.now() - new Date(a.submittedAt).getTime()) / 3600000;
    const remH = cap - elapsedH;
    if (remH < 0) return { tone: "expired", label: `expired ${Math.round(-remH)}h`, escalated: true };
    if (remH < 24) return { tone: "warn",   label: `T-${Math.round(remH)}h` };
    return { tone: "ok", label: `${Math.round(remH)}h left` };
  })();
  // v0.77 spec §16 · per-item axis chip. Each kind maps to its
  // primary axis. With Work Type removed from the product, requisition
  // items don't surface an axis chip (those go via list columns); only
  // billing-model-bearing items (timesheets / invoices / rate changes)
  // get a chip. Null at flag-off via the V77MiniChip guard.
  const Mini = window.V77MiniChip;
  let axisHint = null;
  if (Mini && window.V77 && window.V77.inferAxes) {
    let axes = null;
    try { axes = window.V77.inferAxes({ id: a.id }, a.id); } catch (e) { axes = null; }
    if (axes) {
      if (a.kind === "ts")   axisHint = React.createElement(Mini, { axis: "billingModel", value: axes.billingModel, compact: true });
      if (a.kind === "inv")  axisHint = React.createElement(Mini, { axis: "billingModel", value: axes.billingModel, compact: true });
      if (a.kind === "rate") axisHint = React.createElement(Mini, { axis: "billingModel", value: axes.billingModel, compact: true });
    }
  }
  return (
    <div
      className="vms-approval"
      role="row"
      tabIndex={0}
      onClick={(e) => {
        if (e.target.closest("input,button,a")) return;
        onOpen && onOpen(a);
      }}
      onKeyDown={(e) => { if (e.key === "Enter") onOpen && onOpen(a); }}
    >
      <div className="vms-approval-body">
        <div className="vms-approval-titlerow">
          <p className="vms-approval-title">
            {a.title}
            <span className="vms-approval-amt tabular"> · {a.amount}</span>
            {axisHint ? <span className="vms-approval-axis"> {axisHint}</span> : null}
            {slaState ? (
              <span
                className={`vms-approval-sla vms-approval-sla--${slaState.tone}`}
                title={slaState.escalated
                  ? "SLA expired · escalated to next approver"
                  : `SLA · ${slaState.label}`}
              >
                <Icon name="Hourglass" size={11} />
                {slaState.label}
                {slaState.escalated ? " · escalated" : ""}
              </span>
            ) : null}
          </p>
        </div>
        <span className="vms-approval-meta">{a.meta}</span>
      </div>
      <span className="vms-approval-actions">
        <button
          type="button"
          className="vms-btn vms-btn--sm vms-btn--secondary"
          onClick={(e) => {
            e.stopPropagation();
            window.openMenu && window.openMenu(e.currentTarget, [
              { icon: "Check", label: "Approve", onClick: () => onApprove && onApprove(a) },
              { icon: "X",     label: "Reject",  danger: true, onClick: () => onReject  && onReject(a) },
            ]);
          }}
          aria-haspopup="menu"
        >
          Actions
          <Icon name="ChevronDown" size={14} />
        </button>
      </span>
    </div>
  );
}

function InboxPage({ reloadKey, onReload, onGoTo, embedded = false }) {
  const [kind, setKind] = useStateInbox("all");
  const [selected, setSelected] = useStateInbox(() => new Set());
  const [sort, setSort] = useStateInbox("priority"); // priority | amount

  const all = window.APPROVALS || [];
  const counts = useMemoInbox(() => {
    const c = { all: all.length, ts: 0, req: 0, inv: 0, rate: 0 };
    all.forEach((a) => { if (c[a.kind] != null) c[a.kind]++; });
    return c;
  }, [all]);

  const visible = useMemoInbox(() => {
    let list = kind === "all" ? [...all] : all.filter((a) => a.kind === kind);
    if (sort === "priority") {
      list.sort((a, b) => (PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]));
    } else if (sort === "amount") {
      const num = (v) => Number(String(v || "").replace(/[^0-9.\-]/g, "")) || 0;
      list.sort((a, b) => num(b.amount) - num(a.amount));
    }
    return list;
  }, [kind, all, sort]);

  const groups = useMemoInbox(() => {
    if (kind !== "all") return [{ id: kind, label: INBOX_KINDS.find((k) => k.id === kind).label, items: visible }];
    const order = ["ts", "req", "inv", "rate"];
    return order.map((k) => ({
      id: k,
      label: INBOX_KINDS.find((x) => x.id === k).label,
      items: visible.filter((a) => a.kind === k),
    })).filter((g) => g.items.length > 0);
  }, [kind, visible]);

  const toggle = (id) => setSelected((prev) => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });
  const clearSel = () => setSelected(new Set());
  const selectAll = () => setSelected(new Set(visible.map((v) => v.id)));

  const onOpen = (a) => {
    if (a.target && window.flexGoTo) window.flexGoTo(a.target);
    else showToast(`Open ${a.id}`);
  };
  const onApprove = (a) => {
    showToast(`Approved ${a.id}`, { kind: "success" });
    selected.delete(a.id);
  };
  const onReject = (a) => {
    openConfirm({
      title: `Reject ${a.id}?`,
      body: `Rejecting sends this back to the submitter with a note. ${a.title}.`,
      primaryLabel: "Reject",
      onConfirm: () => showToast(`Rejected ${a.id}`, { kind: "success" }),
    });
  };
  const bulkApprove = () => {
    if (!selected.size) return;
    showToast(`Approved ${selected.size} item${selected.size === 1 ? "" : "s"}`, { kind: "success" });
    clearSel();
  };

  return (
    <React.Fragment>
      {!embedded && (
      <Omnibar icon="Inbox" title="Inbox">
        <span className="vms-emp-lowemp" style={{ font: "var(--evr-body2)", marginRight: 8 }}>
          {counts.all} awaiting your sign-off
        </span>
        <button type="button" className="iconbtn" onClick={onReload} aria-label="Reload" title="Reload">
          <Icon name="Refresh" size={18} />
        </button>
      </Omnibar>
      )}

      <div className={"vms-page" + (embedded ? " vms-page--embedded" : "")} key={reloadKey}>
        <div className="vms-inbox-grid">
          {/* Side rail */}
          <aside className="vms-inbox-side" aria-label="Approval categories">
            {INBOX_KINDS.map((k) => (
              <button
                key={k.id}
                type="button"
                className={"vms-inbox-item" + (kind === k.id ? " is-active" : "")}
                onClick={() => { setKind(k.id); clearSel(); }}
              >
                <Icon name={k.icon} size={18} />
                <span>{k.label}</span>
                <span className={"vms-inbox-count" + (k.id === "ts" && counts.ts >= 5 ? " vms-inbox-count--err" : "")}>{counts[k.id]}</span>
              </button>
            ))}
            <button type="button" className="vms-inbox-item">
              <Icon name="Hourglass" size={18} />
              <span>SLA at risk</span>
              <span className="vms-inbox-count vms-inbox-count--err">3</span>
            </button>
            <button type="button" className="vms-inbox-item">
              <Icon name="PersonArrow" size={18} />
              <span>Delegated to me</span>
              <span className="vms-inbox-count">2</span>
            </button>
          </aside>

          {/* Main */}
          <div className="vms-inbox-main">
            {groups.map((g) => (
              <section key={g.id} className="vms-inbox-card">
                <div className="vms-inbox-card-h">
                  <h3>{g.label}</h3>
                  <span className="vms-inbox-card-h-count">{g.items.length}</span>
                </div>
                {g.items.map((a) => (
                  <InboxApprovalRow
                    key={a.id}
                    a={a}
                    checked={selected.has(a.id)}
                    onToggle={() => toggle(a.id)}
                    onOpen={onOpen}
                    onApprove={onApprove}
                    onReject={onReject}
                  />
                ))}
              </section>
            ))}
            {groups.length === 0 && (
              <div className="vms-card">
                <p className="vms-empty">You're caught up. Nothing waiting on your approval.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </React.Fragment>
  );
}

Object.assign(window, { InboxPage });
