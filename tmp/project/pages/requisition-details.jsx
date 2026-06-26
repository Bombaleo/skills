// =====================================================================
// Flex Work — Requisition Details
// Hero card with map + meta. Plus expandable section cards (accordions).
// All visible content is derived from the matching REQUISITIONS row so
// the detail page stays in sync with the list.
// =====================================================================

const { useState: useStateRd, useEffect: useEffectRd } = React;

function AccordionCard({ icon, title, defaultOpen = false, children }) {
  // Collapsed by default everywhere — `defaultOpen` kept for API compat
  // but ignored so all accordion sections start closed.
  const [open, setOpen] = useStateRd(false);
  const id = React.useId();
  return (
    <section className="acc-card">
      <button
        type="button"
        className="acc-card-head"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="acc-card-avatar" aria-hidden="true">
          <Icon name={icon} size={20} />
        </span>
        <h2 className="acc-card-title">{title}</h2>
        <span className="acc-card-chev" data-open={open} aria-hidden="true">
          <Icon name="ChevronDown" size={20} />
        </span>
      </button>
      {open && (
        <div id={id} className="acc-card-body">
          {children}
        </div>
      )}
    </section>
  );
}

function DetailsComingSoon() {
  return null; // legacy — every accordion now renders a real body
}

// ---------- Section bodies for the Requisition Details accordions ----

function ReqDetailsBody({ req }) {
  return (
    <React.Fragment>
      <InfoGrid
        groups={[
          [
            { label: "Description",      value: `${jobsLabel(req.jobs, req.qty || 3)} at ${req.location}.` },
            { label: "Department", value: req.costCenter },
            { label: "Manager on site",  value: req.bookedBy },
          ],
          [
            { label: "Shift time",       value: `${req.time} · ${req.breakLabel}` },
            { label: "Dress code",       value: "Standard PPE — safety boots, hi-vis vest" },
            { label: "Reporting to",     value: "Front gate, Building A" },
          ],
          [
            { label: "Requisition ID",   value: req.id, tabular: true, copyable: true },
            { label: "Est. bill",        value: req.bill, tabular: true },
          ],
        ]}
      />
      <div style={{ marginTop: 24 }}>
        <DgSubhead title="Attachments" action={(
          <button
            type="button"
            className="btn btn--sm btn--secondary"
            onClick={() => showToast("Choose a file to upload", { action: { label: "Browse", onClick: () => showToast("File picker opened (preview)") } })}
          >
            <Icon name="FileUpload" size={14} />Upload
          </button>
        )} />
        <AttachmentList files={[
          { name: "site-safety-brief.pdf", type: "pdf",  size: "1.2 MB", uploaded: "Oct 28" },
          { name: "site-map.png",          type: "file", size: "480 KB", uploaded: "Oct 28" },
        ]} />
      </div>
    </React.Fragment>
  );
}

function ReqDistributionBody({ req }) {
  // Rank the requisition's assigned suppliers; round out with one extra so
  // there are always 4 rows visible.
  const extras = ["sw", "th", "ph", "ss", "gs"].filter((s) => !req.suppliers.includes(s));
  const ranked = [...req.suppliers, ...extras].slice(0, 5).map((s, i) => ({
    rank: i + 1,
    supplier: s,
    workers: i === 0 ? (req.qty || 3) : i < req.suppliers.length ? Math.max(0, (req.qty || 3) - i) : 0,
  }));
  return (
    <DistributionList
      note={`This requisition uses an organization-wide distribution setup. ${req.suppliers.length} supplier${req.suppliers.length === 1 ? "" : "s"} are assigned in priority order.`}
      suppliers={ranked}
    />
  );
}

// ---------- Workforce distribution (Agency Pro) ----------------------
// v1.35 — for staffing-agency tenants on the Pro plan, the requisition
// detail swaps the buyer-facing "Distribution" accordion (supplier
// priority list — meaningless when the tenant IS the supplier) for a
// "Workforce distribution" accordion. It mirrors the agency-wide
// "Automatic worker invitations" config from Settings → Configuration
// (window.AwiConfigForm) and lets the user override delivery for this
// requisition only — same inherit / override / reset pattern as the
// worker-invite side panel's AgencyInviteOverrideBar.
function ReqWorkforceDistributionBody({ req }) {
  const orgConfig  = window.useAutoInviteConfig ? window.useAutoInviteConfig() : null;
  const ConfigForm = window.AwiConfigForm;
  const Chip       = window.AwiStrategyChip;
  const AWI        = window.AWI_STRATEGIES || {};

  const [overridden, setOverridden] = useStateRd(false);
  const [open, setOpen]             = useStateRd(false);
  const [local, setLocal]           = useStateRd(orgConfig || {});

  React.useEffect(() => {
    if (!overridden && orgConfig) setLocal(orgConfig);
  }, [orgConfig, overridden]);

  if (!orgConfig || !ConfigForm) {
    return (
      <div className="awi-gate">
        <span className="awi-gate-ic" aria-hidden="true"><Icon name="Send" size={16} /></span>
        <span className="awi-gate-text">
          Workforce distribution is unavailable. It requires the Agency Pro invitation config.
        </span>
      </div>
    );
  }

  const effective = overridden ? local : orgConfig;
  const meta      = AWI[effective.strategy] || AWI.smart;
  const positions = req.qty || 3;

  const startOverride = () => { setLocal(orgConfig); setOverridden(true); setOpen(true); };
  const resetToDefault = () => {
    setOverridden(false);
    setOpen(false);
    showToast("Reverted to agency default");
  };

  return (
    <React.Fragment>
      <p className="awi-blurb">
        How this requisition&rsquo;s {positions} open position{positions === 1 ? "" : "s"} reach your bench. This inherits the
        agency-wide rule from{" "}
        <a
          href="#"
          onClick={(e) => { e.preventDefault(); showToast("Opening Settings → Configuration"); }}
        >Settings → Configuration</a>{" "}
        — override it below to change delivery for this requisition only.
      </p>
      <div className="awi-ovr">
        <div className="awi-ovr-head">
          <span className="awi-ovr-ic" aria-hidden="true"><Icon name="Send" size={16} /></span>
          <span className="awi-ovr-text">
            <span className="awi-ovr-label">Invitation delivery</span>
            <span className="awi-ovr-value">
              {Chip ? <Chip kind={effective.strategy} /> : <span>{meta && meta.short}</span>}
              <span className="awi-ovr-source">
                {overridden ? "Overridden for this requisition" : "Agency default"}
              </span>
            </span>
          </span>
          {open ? (
            <button type="button" className="awi-ovr-toggle" onClick={() => setOpen(false)}>
              Done<Icon name="ChevronUp" size={14} />
            </button>
          ) : overridden ? (
            <button type="button" className="awi-ovr-toggle" onClick={() => setOpen(true)}>
              Edit<Icon name="ChevronDown" size={14} />
            </button>
          ) : (
            <button type="button" className="awi-ovr-toggle" onClick={startOverride}>
              Override<Icon name="ChevronDown" size={14} />
            </button>
          )}
        </div>
        {open && (
          <div className="awi-ovr-body">
            <ConfigForm
              value={local}
              onChange={(next) => { setLocal(next); setOverridden(true); }}
              positions={positions}
            />
            <div className="awi-ovr-reset">
              <span className="awi-ovr-note">This override applies to this requisition only.</span>
              <button type="button" className="linkbtn" onClick={resetToDefault}>Reset to agency default</button>
            </div>
          </div>
        )}
      </div>
    </React.Fragment>
  );
}

function ReqManagersBody({ req }) {
  const managers = [
    { name: req.bookedBy,    role: "Requisition owner",   email: req.bookedBy.toLowerCase().replace(/\s+/g, ".") + "@dayforce.com" },
    { name: "Aiden Brooks",  role: "Site supervisor",     email: "aiden.brooks@dayforce.com" },
  ];
  return (
    <React.Fragment>
      <ManagerList managers={managers} />
      <div style={{ marginTop: 12, display: "flex", justifyContent: "flex-start" }}>
        <button
          type="button"
          className="btn btn--sm btn--secondary"
          onClick={() => showToast("Add a manager — search for a teammate", { action: { label: "Search", onClick: () => showToast("Search opened") } })}
        >
          <Icon name="AddCircle" size={14} />Add manager
        </button>
      </div>
    </React.Fragment>
  );
}

function ReqInvoicesBody({ req }) {
  // Show any invoice whose req string matches this requisition's id.
  const rows = (typeof INVOICES !== "undefined" ? INVOICES : []).filter((i) => i.req.includes(req.id));
  return (
    <MiniTable
      empty={{
        illustration: "assets/illustrations/Search.svg",
        title: "No invoices yet",
        body: "Invoices will appear here once a supplier submits billing for approved timesheets on this requisition.",
      }}
      columns={[
        { key: "id",       label: "Invoice",  width: "1.4fr", render: (r) => `INV-${r.id}` },
        { key: "supplier", label: "Supplier", width: "1.4fr", render: (r) => REQ_SUPPLIERS[r.supplier]?.label || r.supplier },
        { key: "status",   label: "Status",   width: "1fr",   render: (r) => <span className={`req-pill req-pill--${({Generated:"default",Issued:"informative",Paid:"success",Overdue:"error"})[r.status]||"default"}`}>{r.status}</span> },
        { key: "invDate",  label: "Issued",   width: "1fr",   render: (r) => <span className="tabular">{r.invDate}</span> },
        { key: "amount",   label: "Amount",   width: "1fr",   align: "right", render: (r) => <span className="tabular">{r.amount}</span> },
      ]}
      rows={rows}
      onRowClick={(r) => {
        if (window.flexGoTo) {
          window.flexGoTo({ page: "invoices", sub: "details", id: r.id });
        } else {
          showToast(`Opening INV-${r.id}`);
        }
      }}
    />
  );
}

function ReqLogsBody({ req }) {
  // Concise system-log style — one line per event, actor + action only.
  // Extra context (supplier list, schedule meta, charge code, etc.) lives
  // in the section-specific surfaces; the Logs accordion is an audit
  // trail, not a re-statement of the requisition.
  const firstSup = REQ_SUPPLIERS[req.suppliers[0]]?.label || "Supplier";
  const items = [
    { tone: "info",    icon: "Briefcase",       actor: req.bookedBy, action: "created requisition",                                                                  time: req.placed },
    { tone: "info",    icon: "PersonLines",     actor: req.bookedBy, action: `broadcast to ${req.suppliers.length} supplier${req.suppliers.length === 1 ? "" : "s"}`, time: req.placed },
    { tone: "success", icon: "PersonPlus",      actor: firstSup,     action: `submitted ${Math.max(req.qty, 2)} candidates`,                                          time: "4 days ago" },
    { tone: "info",    icon: "Calendar",        actor: "Scheduler",  action: "locked schedule",                                                                      time: "3 days ago" },
    { tone: "success", icon: "PersonAuthorize", actor: req.bookedBy, action: `approved ${req.qty} worker${req.qty === 1 ? "" : "s"}`,                                time: "3 days ago" },
  ];
  if (req.status === "Completed") {
    items.push({ tone: "success", icon: "Check",       actor: firstSup,      action: "closed out all dates",         time: "Yesterday" });
  } else if (req.status === "In progress") {
    items.push({ tone: "info",    icon: "PersonClock", actor: firstSup,      action: "confirmed first worker",       time: "Today, 5:58 AM" });
  } else {
    items.push({ tone: "info",    icon: "View",        actor: "Aiden Brooks", action: "reviewed requisition",         time: "Yesterday, 4:14 PM" });
  }
  return <ActivityLog items={items.slice().reverse()} />;
}

// ---------- Booking section content ------------------------------------

function DateBadge({ mo, day }) {
  return (
    <span className="bk-date-badge">
      <span className="bk-date-badge-mo">{mo}</span>
      <span className="bk-date-badge-day">{day}</span>
    </span>
  );
}

function BookingDatesCell({ dates, range }) {
  return (
    <div className="bk-dates">
      {dates.map(([mo, day], i) => (
        <React.Fragment key={i}>
          {i > 0 && range && (
            <span className="bk-dates-arrow" aria-hidden="true">
              <Icon name="ArrowRight" size={18} />
            </span>
          )}
          <DateBadge mo={mo} day={day} />
        </React.Fragment>
      ))}
    </div>
  );
}

// Build a "jobs" label like "3 Production Associates" or "3 Production Associates,
// 2 Pickers" from the row's jobs array + qty.
function jobsLabel(jobs, qty) {
  return jobs
    .map((j) => `${qty} ${j}${qty === 1 ? "" : "s"}`)
    .join(", ");
}

// ---------- Work-assignment fill model (v1.41) -----------------------
// Each requisition date chip is one work assignment. Its positions are
// qty × jobs.length. Fill state is read from the SAME booking-assignment
// store the Schedule + assign-worker flow use (window.getBookingAssignments)
// so the requisition detail, the booking roster, and the assign panel
// stay 1:1. "Booked" reqs are store-driven; non-Booked reqs (In progress
// / Completed) are treated as fully staffed — mirrors buildBookingRoster.
function _waHash(s) {
  let h = 0; s = String(s || "");
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}
function _waPositions(req) {
  return (req.qty || 3) * ((req.jobs && req.jobs.length) || 1);
}
function _waBookingId(req, chip, idx) {
  if (!window.buildBookingId) return `${req.id}#${idx}`;
  const parsed = parseDateChip(chip);
  return parsed.range
    ? window.buildBookingId({ reqId: req.id })
    : window.buildBookingId({ reqId: req.id, reqDateIdx: idx });
}
// Role that position n belongs to (positions number across jobs × qty).
function _waRoleFor(req, n) {
  const jobs = req.jobs && req.jobs.length ? req.jobs : ["Worker"];
  const qty = req.qty || 3;
  return jobs[Math.floor((n - 1) / qty)] || jobs[0];
}
// A real WORKERS id for a seeded position so the Schedule can render the
// confirmed worker. Prefers the agency bench + role match, deterministic.
function _waSeedWorkerId(req, n) {
  const all = window.WORKERS || [];
  if (!all.length) return `seed-${req.id}-${n}`;
  const role = _waRoleFor(req, n);
  const agencySup = (window.getAgencySupplierId && window.getAgencySupplierId()) || null;
  let pool = all.filter((w) => (w.jobs || []).includes(role));
  if (agencySup) {
    const scoped = pool.filter((w) => w.supplier === agencySup);
    if (scoped.length) pool = scoped;
  }
  if (!pool.length) pool = all;
  return pool[_waHash(`${req.id}:${n}`) % pool.length].id;
}
// Read the live fill state for one work assignment.
function waFillState(req, chip, idx) {
  const total = _waPositions(req);
  let filled;
  if (req.status !== "Booked") {
    filled = total;
  } else {
    const m = (window.getBookingAssignments && window.getBookingAssignments(_waBookingId(req, chip, idx))) || {};
    filled = Math.min(total, Object.keys(m).length);
  }
  const key = filled >= total ? "filled" : filled > 0 ? "partial" : "unfilled";
  return { filled, total, key };
}
// First position index with no worker assigned (1-based), or null.
function waFirstOpenIdx(req, chip, idx) {
  const total = _waPositions(req);
  const m = (window.getBookingAssignments && window.getBookingAssignments(_waBookingId(req, chip, idx))) || {};
  for (let n = 1; n <= total; n++) if (m[n] == null) return n;
  return null;
}
// Seed a deterministic, idempotent fill across a requisition's bookings
// so the detail demonstrates unfilled / partially filled / filled side
// by side, consistent with whatever the Schedule will render. Only seeds
// "Booked" reqs (others are already fully staffed) and never clobbers a
// booking that already holds assignments (seeded or user-made).
function seedWorkAssignmentFill(req, chipStatusFn) {
  if (!req || req.status !== "Booked") return;
  if (!window.getBookingAssignments || !window.setBookingAssignment) return;
  const total = _waPositions(req);
  (req.dates || []).forEach((chip, idx) => {
    const bkId = _waBookingId(req, chip, idx);
    const existing = window.getBookingAssignments(bkId) || {};
    if (Object.keys(existing).length > 0) return;
    const st = chipStatusFn(chip);
    let target;
    if (st && (st.key === "past" || st.key === "active")) {
      target = total; // already worked / in progress → fully staffed
    } else {
      const bucket = _waHash(`${req.id}:${idx}`) % 3; // 0 unfilled · 1 partial · 2 filled
      target = bucket === 0 ? 0 : bucket === 2 ? total : Math.max(1, Math.round(total / 2));
    }
    for (let n = 1; n <= target; n++) {
      window.setBookingAssignment(bkId, n, _waSeedWorkerId(req, n));
    }
  });
}

const WA_FILL_META = {
  filled:   { label: "Filled",           hue: "success" },
  partial:  { label: "Partially filled", hue: "informative" },
  unfilled: { label: "Unfilled",         hue: "warning" },
};

// Slim segmented fill bar — one segment per position up to 12, then a
// single proportional bar so big reqs don't blow out the row.
function WaFillBar({ filled, total, state }) {
  if (total <= 12) {
    return (
      <span className={`bk-fill-bar bk-fill-bar--${state}`} aria-hidden="true">
        {Array.from({ length: total }).map((_, i) => (
          <span key={i} className={"bk-fill-seg" + (i < filled ? " is-on" : "")} />
        ))}
      </span>
    );
  }
  const pct = total ? Math.round((filled / total) * 100) : 0;
  return (
    <span className={`bk-fill-bar bk-fill-bar--prop bk-fill-bar--${state}`} aria-hidden="true">
      <span className="bk-fill-seg is-on" style={{ flexBasis: pct + "%" }} />
    </span>
  );
}

function BookingTable({ req }) {
  // One booking row per date chip on the requisition. First row picks up
  // the "Custom rules" badge so the section feels active.
  // Compute Past / Active / Upcoming for each row by comparing the chip's
  // date(s) against the demo's "today". For ranges, "Active" means today
  // falls inside the range inclusive.
  // v1.41 — agency admins assign their own bench to upcoming, not-yet-full
  // work assignments straight from here; buyers (and past/filled rows)
  // get the read-only "View".
  const isAgencyAdmin = !!(window.isAgencyOrg && window.isAgencyOrg()) && window.flexViewAsRole === "agency";
  const [fillTick, setFillTick] = useStateRd(0);
  const bumpFill = () => setFillTick((n) => n + 1);
  const _today = (() => {
    const t = window.flexToday ? window.flexToday() : new Date(2026, 4, 19);
    return new Date(t.getFullYear(), t.getMonth(), t.getDate());
  })();
  const _MONTHS = { Jan:0,Feb:1,Mar:2,Apr:3,May:4,Jun:5,Jul:6,Aug:7,Sep:8,Oct:9,Nov:10,Dec:11 };
  const _chipStatus = (chip) => {
    const parsed = parseDateChip(chip);
    const yr = _today.getFullYear();
    const toDate = ([mo, day]) => {
      const m = _MONTHS[mo];
      if (m == null) return null;
      return new Date(yr, m, parseInt(day, 10));
    };
    const start = toDate(parsed.dates[0]);
    const end   = parsed.range ? toDate(parsed.dates[1]) : start;
    if (!start || !end) return null;
    if (end   < _today) return { key: "past",     label: "Past",     hue: "default"     };
    if (start > _today) return { key: "upcoming", label: "Upcoming", hue: "informative" };
    return                     { key: "active",   label: "Active",   hue: "success"     };
  };
  const rows = req.dates.map((chip, i) => {
    const parsed = parseDateChip(chip);
    const timeStatus = _chipStatus(chip);
    const fill = waFillState(req, chip, i);
    return {
      key: chip,
      index: i,
      dates: parsed.dates,
      range: parsed.range,
      jobs: jobsLabel(req.jobs, req.qty || 3),
      meta: `${req.time} · ${req.breakLabel}`,
      customRules: i === 0,
      timeStatus,
      fill,
      // Agency admins assign upcoming/active assignments that still have
      // open positions; everything else (past, or fully filled) is View.
      canAssign: isAgencyAdmin && timeStatus && timeStatus.key !== "past" && fill.key !== "filled",
    };
  });

  // Section roll-up so an admin can scan how the requisition is staffed.
  const fillTally = rows.reduce((acc, r) => { acc[r.fill.key] = (acc[r.fill.key] || 0) + 1; return acc; }, {});

  // Build the booking ID for "View" and route based on whether the row is
  // a single date or a multi-day range:
  //   • Single date  → date-scoped booking (opens to a roster of workers)
  //   • Multi-day    → full booking (opens to the role / worker grouping;
  //                    drilling into a worker opens their booking, and
  //                    individual shifts open from there).
  const openBookingFor = (chip, idx) => {
    if (!window.flexGoTo || !window.buildBookingId) {
      showToast(`Opening work assignment for ${chip}`);
      return;
    }
    const parsed = parseDateChip(chip);
    const bookingId = parsed.range
      ? window.buildBookingId({ reqId: req.id })
      : window.buildBookingId({ reqId: req.id, reqDateIdx: idx });
    window.flexGoTo({ page: "schedule", sub: "booking", id: bookingId });
  };

  const rowMenu = (chip, idx) => (e) => {
    e.stopPropagation();
    openMenu(e.currentTarget, [
      { icon: "View",    label: "View work assignment",     onClick: () => openBookingFor(chip, idx) },
      { icon: "Edit",    label: "Edit work assignment",     onClick: () => openConfirm({
          title: `Edit work assignment for ${chip}?`,
          body: "Work assignment edits flow through the requisition form. Continue to open the form?",
          primaryLabel: "Open form",
          onConfirm: () => showToast(`Opening work assignment editor for ${chip}`),
        }) },
      { icon: "Copy",    label: "Duplicate to new date" },
      { divider: true },
      { icon: "Cancel",  label: "Cancel this date", danger: true,
        onClick: () => openConfirm({
          title: `Cancel work assignment for ${chip}?`,
          body: "This will release the assigned workers for this date.",
          primaryLabel: "Cancel work assignment",
          onConfirm: () => showToast(`${chip} work assignment cancelled`, { kind: "success" }),
        }) },
    ]);
  };

  // Seed a deterministic fill across this requisition's bookings the first
  // time an agency admin opens it, so the list shows real unfilled /
  // partially filled / filled rows that match what the Schedule renders.
  useEffectRd(() => {
    if (isAgencyAdmin) {
      seedWorkAssignmentFill(req, _chipStatus);
      bumpFill();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [req.id, isAgencyAdmin]);

  // Open the assign-worker flow for the next open position on a work
  // assignment. As the agency assigns, the row's fill count climbs and it
  // flips from Unfilled → Partially filled → Filled (then to "View").
  const onAssignFor = (chip, idx) => {
    const bkId = _waBookingId(req, chip, idx);
    const openIdx = waFirstOpenIdx(req, chip, idx);
    if (openIdx == null) { bumpFill(); return; }
    if (!window.openAssignWorkerPanel) {
      showToast(`Opening assign flow for ${chip}`);
      return;
    }
    const role = _waRoleFor(req, openIdx);
    const supplierId = (window.getAgencySupplierId && window.getAgencySupplierId())
      || (req.suppliers && req.suppliers[0]) || "sw";
    window.openAssignWorkerPanel({
      supplierId,
      role,
      engagementType: "Shift",
      bookingId: bkId,
      idx: openIdx,
      reqId: req.id,
      recurring: !!req.recurring,
      onAssign: (w) => {
        window.setBookingAssignment && window.setBookingAssignment(bkId, openIdx, w.id || w.name);
        bumpFill();
        showToast(`${w.name} assigned to ${chip} · position #${openIdx}`, { kind: "success" });
      },
    });
  };

  return (
    <div className="bk-table">
      {rows.length > 1 && (
        <div className="bk-fill-summary" role="status" aria-label="Work assignment staffing summary">
          {[
            { key: "unfilled", n: fillTally.unfilled || 0 },
            { key: "partial",  n: fillTally.partial  || 0 },
            { key: "filled",   n: fillTally.filled   || 0 },
          ].filter((s) => s.n > 0).map((s) => (
            <span key={s.key} className={`bk-fill-chip bk-fill-chip--${s.key}`}>
              <span className="bk-fill-chip-dot" aria-hidden="true" />
              <b className="tabular">{s.n}</b>
              {WA_FILL_META[s.key].label.toLowerCase()}
            </span>
          ))}
        </div>
      )}
      <div className="bk-table-head">
        <span>Dates</span>
        <span>Details</span>
        <span style={{ textAlign: "right" }}>Actions</span>
      </div>
      <div className="bk-table-body">
        {rows.map((r) => {
          const fillMeta = WA_FILL_META[r.fill.key];
          const open = () => openBookingFor(r.key, r.index);
          return (
          <div
            className={`bk-table-row bk-table-row--clickable bk-table-row--fill-${r.fill.key}`}
            key={r.key}
            role="button"
            tabIndex={0}
            onClick={(e) => {
              if (e.target.closest("button,a,input")) return;
              open();
            }}
            onKeyDown={(e) => { if (e.key === "Enter") open(); }}
          >
            <BookingDatesCell dates={r.dates} range={r.range} />
            <div className="bk-details">
              <div className="bk-details-title">
                <span>{r.jobs}</span>
              </div>
              <div className="bk-fill-line">
                <span className={`req-pill req-pill--${fillMeta.hue}`}>{fillMeta.label}</span>
                <WaFillBar filled={r.fill.filled} total={r.fill.total} state={r.fill.key} />
                <span className="bk-fill-count tabular">{r.fill.filled} / {r.fill.total} positions</span>
              </div>
              <div className="bk-details-meta">
                {r.timeStatus && (
                  <React.Fragment>
                    <span className={`bk-time-status bk-time-status--${r.timeStatus.key}`}>{r.timeStatus.label}</span>
                    <span aria-hidden="true">·</span>
                  </React.Fragment>
                )}
                <span>{r.meta}</span>
                {r.customRules && (
                  <React.Fragment>
                    <span aria-hidden="true">·</span>
                    <span className="bk-custom-rules">
                      <Icon name="Adjustment" size={14} />Custom rules
                    </span>
                  </React.Fragment>
                )}
              </div>
            </div>
            <div className="bk-actions">
              {r.canAssign ? (
                <button
                  type="button"
                  className="btn btn--md btn--primary"
                  onClick={() => onAssignFor(r.key, r.index)}
                >
                  <Icon name="PersonPlus" size={16} />Assign
                </button>
              ) : (
                <button
                  type="button"
                  className="btn btn--md btn--secondary"
                  onClick={open}
                >
                  View
                </button>
              )}
              <button
                type="button"
                className="icon-btn"
                aria-label="More"
                onClick={rowMenu(r.key, r.index)}
              >
                <Icon name="MoreHoriz" size={18} />
              </button>
            </div>
          </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------- Status pill (reuse req-pill family from requisitions.jsx) --
const RD_STATUS_HUES = {
  "Booked":      "default",
  "In progress": "informative",
  "Completed":   "success",
};

// Build a 2-char "dot" abbreviation for the location, e.g.
// "Warehouse #35" → "W#" · "Inventory Warehouse Kappa" → "IK".
function locDot(location) {
  const cleaned = location.replace(/[#…]/g, " ").replace(/\s+/g, " ").trim();
  const tokens = cleaned.split(/\s+/);
  if (tokens.length === 1) return tokens[0].slice(0, 2).toUpperCase();
  return (tokens[0][0] + tokens[tokens.length - 1][0]).toUpperCase();
}

function RequisitionDetailsPage({ requisitionId, onBack }) {
  // NOTE: this file used to carry a 6-line delegate that intercepted
  // Professional requisition ids (PRO-…) and rendered
  // ProfessionalRequisitionDetailsPage in place of the Frontline body
  // when the `professionalWork` flag was on. Per unified-req-detail.html
  // §05 (Phase 2 · adopt the router), that responsibility moved up one
  // level to pages/requisition-engagement-detail.jsx (the unified
  // router). This file is now the FrontlineBody — the byte-identical,
  // all-flags-off default the router falls through to when no variant
  // manifest matches the row's sourcing channel.

  // Fall back to the first row so the page always renders something during
  // direct loads / hot reloads when no id was passed in.
  const req = (REQUISITIONS.find((r) => r.id === requisitionId) || REQUISITIONS[0]);
  const statusHue = RD_STATUS_HUES[req.status] || "default";
  const editEntity = useEditEntity();

  // v1.35 — agency-pro tenants distribute work to their own bench, not to
  // a supplier network. When Agency Pro is active the buyer-facing
  // "Distribution" accordion is replaced by "Workforce distribution".
  const agencyProActive = window.useAgencyProActive ? window.useAgencyProActive() : false;

  const openEdit = () => editEntity.open({
    ...requisitionEditSchema(req),
    onSave: () => showToast(`Requisition ${req.id} updated`, { kind: "success" }),
  });

  return (
    <React.Fragment>
      <ReqOmnibar
        title={`Requisition #${req.id}`}
        subtitle="Requisitions"
        status={(
          <span className={`req-pill req-pill--${statusHue}`}>{req.status}</span>
        )}
        onBack={onBack}
        actions={(
          <React.Fragment>
            <button
              type="button"
              className="iconbtn"
              aria-label="Reload"
              onClick={() => showToast("Requisition refreshed")}
            >
              <Icon name="Refresh" size={20} />
            </button>
            <button
              type="button"
              className="btn btn--md btn--secondary"
              onClick={openEdit}
            >
              <Icon name="Edit" size={16} />Edit
            </button>
            <button
              type="button"
              className="iconbtn"
              aria-label="More"
              onClick={(e) => openMenu(e.currentTarget, [
                { icon: "Copy",   label: "Duplicate requisition", onClick: () => showToast("Duplicating requisition") },
                { icon: "Export", label: "Export summary",        onClick: () => showToast(`Exporting ${req.id}.pdf`, { kind: "success" }) },
                { icon: "Print",  label: "Print",                 onClick: () => showToast("Sent to printer") },
                { divider: true },
                { icon: "Cancel", label: "Cancel requisition",    danger: true,
                  onClick: () => openConfirm({
                    title: `Cancel requisition ${req.id}?`,
                    body: `This will release ${req.dates.length} scheduled date${req.dates.length === 1 ? "" : "s"} at ${req.location}. Suppliers will be notified.`,
                    primaryLabel: "Cancel requisition",
                    onConfirm: () => { showToast(`${req.id} cancelled`, { kind: "success" }); onBack && onBack(); },
                  }) },
              ])}
            >
              <Icon name="MoreVert" size={20} />
            </button>
          </React.Fragment>
        )}
      />

      <div className="req-wf" style={{ maxWidth: 1200 }}>
        {/* Hero */}
        <div className="det-hero">
          <div className="det-hero-info">
            <h1 className="det-hero-title">Requisition #{req.id}</h1>
            <a
              href="#"
              className="det-hero-loc"
              onClick={(e) => { e.preventDefault(); showToast(`Opening ${req.location}`); }}
            >
              <span className="det-loc-dot" aria-hidden="true">{locDot(req.location)}</span>
              <span className="det-hero-loc-text">{req.location}</span>
            </a>
            <dl className="det-meta-list">
              <div className="det-meta-row">
                <dt title="Dayforce calls this Labor metric — formerly &lsquo;Department&rsquo; in Flex Work">Department:</dt>
                <dd><a href="#" onClick={(e) => { e.preventDefault(); showToast(`Opening ${req.costCenter}`); }}>{req.costCenter}</a></dd>
              </div>
              <div className="det-meta-row">
                <dt>Booked by:</dt>
                <dd><a href="#" onClick={(e) => { e.preventDefault(); showToast(`Opening profile for ${req.bookedBy}`); }}>{req.bookedBy}</a></dd>
              </div>
              <div className="det-meta-row">
                <dt>Order placed:</dt>
                <dd className="tabular">{req.placed}</dd>
              </div>
              <div className="det-meta-row">
                <dt>Est. bill:</dt>
                <dd className="tabular">{req.bill}</dd>
              </div>
            </dl>
          </div>

          <div className="det-map" aria-hidden="true">
            {/* Same job-site marker used on the Home → Overview →
                Upcoming assignments featured shift card, for visual
                consistency between dashboard and detail surfaces. */}
            <img className="det-map-pin" src="assets/pin-job-site.svg" alt="" aria-hidden="true" />
          </div>
        </div>

        <AccordionCard icon="Information" title="Details">
          <ReqDetailsBody req={req} />
        </AccordionCard>

        <AccordionCard icon="PersonLines" title="Work assignments">
          <BookingTable req={req} />
        </AccordionCard>

        {agencyProActive ? (
          <AccordionCard icon="Send" title="Workforce distribution">
            <ReqWorkforceDistributionBody req={req} />
          </AccordionCard>
        ) : (
          <AccordionCard icon="PersonArrow" title="Distribution">
            <ReqDistributionBody req={req} />
          </AccordionCard>
        )}

        <AccordionCard icon="Briefcase" title="Managers">
          <ReqManagersBody req={req} />
        </AccordionCard>

        <AccordionCard icon="Pay" title="Invoices">
          <ReqInvoicesBody req={req} />
        </AccordionCard>

        <AccordionCard icon="TimeUndo" title="Logs">
          <ReqLogsBody req={req} />
        </AccordionCard>
      </div>
      {editEntity.panel}
    </React.Fragment>
  );
}

Object.assign(window, { RequisitionDetailsPage, locDot });
