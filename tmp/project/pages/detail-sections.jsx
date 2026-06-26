// =====================================================================
// Flex Work — Detail-page section primitives
// Replaces the "coming soon" empty states inside accordion bodies with
// realistic content modules. Every visual uses Everest semantic tokens.
//
//   · InfoGrid       — 2-column label/value list (Details accordions)
//   · ActivityLog    — vertical timeline (Logs accordions)
//   · MiniTable      — compact data table (sub-lists inside cards)
//   · DistributionList — priority of suppliers (banner + rows)
//   · ScheduleStrip  — next 5 shifts in a vertical list
//   · ManagerList    — avatar + name + role rows
//   · AttachmentList — file rows with download icon
// =====================================================================

const { useState: useStateDs } = React;

// ---------- InfoGrid ----------------------------------------------------
// Either:
//   rows={[...]}                       — one group
//   groups={[[...], [...], [...]]}     — multiple groups, divided by hairlines
// Each group may be either a bare rows array, or a `{ title, rows }`
// object — when `title` is set, a small subhead renders at the top of
// the group (used by Contract Terms to label Conversion / Overtime /
// Timesheets / Invoicing). A group may also pass `content` instead of
// `rows` to render arbitrary React content inside the group container
// (used to host the paper-contract attachment alongside row groups).
function InfoGrid({ rows, groups }) {
  const groupList = groups || [rows || []];
  return (
    <dl className="dg-info">
      {groupList.map((group, gi) => {
        const isArr     = Array.isArray(group);
        const groupRows = isArr ? group : (group.rows || null);
        const title     = isArr ? null  : group.title;
        const content   = isArr ? null  : group.content;
        return (
          <div className="dg-info-group" key={gi}>
            {title && <h4 className="dg-info-group-title">{title}</h4>}
            {content
              ? content
              : (groupRows || []).map((r, i) => (
                <div className="dg-info-row" key={i}>
                  <dt className="dg-info-label">{r.label}</dt>
                  <dd className="dg-info-value">
                    {r.copyable ? (
                      <span className="dg-info-copyable">
                        <span className={r.tabular ? "tabular" : ""}>{r.value || "—"}</span>
                        {r.value && r.value !== "—" && (
                          <button
                            type="button"
                            className="sup-copy-btn"
                            aria-label={`Copy ${r.label}`}
                            onClick={() => copyToClipboard(r.value, `${r.label} copied`)}
                          >
                            <Icon name="Copy" size={14} />
                          </button>
                        )}
                      </span>
                    ) : r.tabular ? (
                      <span className="tabular">{r.value || "—"}</span>
                    ) : (
                      r.value || <span className="dg-info-empty">—</span>
                    )}
                  </dd>
                </div>
              ))}
          </div>
        );
      })}
    </dl>
  );
}

// ---------- ActivityLog -------------------------------------------------
// items: [{ icon, tone, actor, action, target, time, note?,
//           role?, actionLabel?, details? }]
//   · role        — optional actor role, shown in the details panel
//   · actionLabel — optional explicit action category; otherwise derived
//                   from the leading verb of `action`
//   · details     — optional [{ label, value }] appended to the panel
//
// Adds (system-wide, every Logs surface): filter by user, filter by
// action, and a per-row disclosure that reveals a structured detail
// panel. Backward-compatible — call sites that pass only the original
// fields keep working unchanged.
function dgLogActionLabel(it) {
  if (it.actionLabel) return it.actionLabel;
  const first = String(it.action || "").trim().split(/\s+/)[0] || "";
  const cleaned = first.replace(/[^A-Za-z-]/g, "");
  if (!cleaned) return "Other";
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}
function dgLogDetailRows(it, actionLabel) {
  const rows = [];
  if (it.time)   rows.push({ label: "When",   value: it.time });
  if (it.actor)  rows.push({ label: "User",   value: it.role ? `${it.actor} · ${it.role}` : it.actor });
  rows.push({ label: "Action", value: actionLabel });
  if (it.target) rows.push({ label: "Target", value: it.target });
  if (it.note)   rows.push({ label: "Note",   value: it.note });
  if (Array.isArray(it.details)) it.details.forEach((d) => d && rows.push(d));
  return rows;
}

function DgLogSelect({ label, value, options, onChange }) {
  return (
    <span className="dg-log-select">
      <span className="dg-log-select-label">{label}</span>
      <span className="dg-log-select-value">
        {(options.find((o) => o.value === value) || options[0]).label}
        <Icon name="ChevronDown" size={14} />
      </span>
      <select value={value} onChange={(e) => onChange(e.target.value)} aria-label={`Filter by ${label.toLowerCase()}`}>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </span>
  );
}

function ActivityLog({ items }) {
  const [userF, setUserF]     = useStateDs("all");
  const [actionF, setActionF] = useStateDs("all");
  const [expanded, setExpanded] = useStateDs(() => new Set());

  const enriched = items.map((it, i) => ({ it, i, actionLabel: dgLogActionLabel(it) }));
  const users   = Array.from(new Set(items.map((it) => it.actor).filter(Boolean)));
  const actions = Array.from(new Set(enriched.map((e) => e.actionLabel))).sort();
  const showFilters = users.length > 1 || actions.length > 1;

  const visible = enriched.filter((e) =>
    (userF === "all"   || e.it.actor === userF) &&
    (actionF === "all" || e.actionLabel === actionF)
  );

  const toggle = (i) => setExpanded((prev) => {
    const next = new Set(prev);
    if (next.has(i)) next.delete(i); else next.add(i);
    return next;
  });

  return (
    <div className="dg-log-wrap">
      {showFilters && (
        <div className="dg-log-toolbar">
          <div className="dg-log-filters">
            <DgLogSelect
              label="User"
              value={userF}
              onChange={setUserF}
              options={[{ value: "all", label: "All users" }, ...users.map((u) => ({ value: u, label: u }))]}
            />
            <DgLogSelect
              label="Action"
              value={actionF}
              onChange={setActionF}
              options={[{ value: "all", label: "All actions" }, ...actions.map((a) => ({ value: a, label: a }))]}
            />
            {(userF !== "all" || actionF !== "all") && (
              <button
                type="button"
                className="dg-log-clear"
                onClick={() => { setUserF("all"); setActionF("all"); }}
              >
                Clear
              </button>
            )}
          </div>
          <span className="dg-log-count tabular">{visible.length} of {items.length}</span>
        </div>
      )}
      <ul className="dg-log">
        {visible.length === 0 ? (
          <li className="dg-log-empty">No events match these filters.</li>
        ) : visible.map(({ it, i, actionLabel }) => {
          const isOpen = expanded.has(i);
          const detailRows = dgLogDetailRows(it, actionLabel);
          return (
            <li className={`dg-log-item${isOpen ? " dg-log-item--open" : ""}`} key={i}>
              <span className={`dg-log-icon dg-log-icon--${it.tone || "neutral"}`} aria-hidden="true">
                <Icon name={it.icon || "Information"} size={16} />
              </span>
              <div className="dg-log-text">
                <p className="dg-log-line">
                  <strong>{it.actor}</strong>
                  <span> {it.action}</span>
                  {it.target && (
                    <React.Fragment>
                      <span> </span>
                      <a
                        href="#"
                        className="dg-log-link"
                        onClick={(e) => { e.preventDefault(); showToast(`Opening ${it.target}`); }}
                      >
                        {it.target}
                      </a>
                    </React.Fragment>
                  )}
                  {it.note && <span className="dg-log-note"> — {it.note}</span>}
                </p>
                <span className="dg-log-time">{it.time}</span>
                {isOpen && (
                  <dl className="dg-log-details">
                    {detailRows.map((d, k) => (
                      <div className="dg-log-detail" key={k}>
                        <dt>{d.label}</dt>
                        <dd>{d.value}</dd>
                      </div>
                    ))}
                  </dl>
                )}
              </div>
              <button
                type="button"
                className="dg-log-disclose"
                aria-expanded={isOpen}
                aria-label={isOpen ? "Hide details" : "Show details"}
                onClick={() => toggle(i)}
              >
                <Icon name="ChevronDown" size={16} />
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ---------- MiniTable --------------------------------------------------
// columns: [{ key, label, align?, render? }]
// rows: array of objects keyed by column.key
// onRowClick: optional row navigation
function MiniTable({ columns, rows, onRowClick, empty = "Nothing to show" }) {
  if (!rows || rows.length === 0) {
    // Rich empty state — accept an object { illustration, title, body }
    // for surfaces that want the full verified-illustration treatment
    // instead of the one-line inline dashed row.
    if (empty && typeof empty === "object" && !React.isValidElement(empty)) {
      const { illustration, title, body, illustrationWidth = 160 } = empty;
      return (
        <div className="dg-empty dg-empty--rich">
          {illustration && (
            <img
              src={illustration}
              alt=""
              role="presentation"
              width={illustrationWidth}
              height={Math.round(illustrationWidth * (202 / 224))}
            />
          )}
          {title && <h4 className="dg-empty-title">{title}</h4>}
          {body && <p className="dg-empty-body">{body}</p>}
        </div>
      );
    }
    return <div className="dg-empty">{empty}</div>;
  }
  return (
    <div className="dg-table">
      <div
        className="dg-table-head"
        style={{ gridTemplateColumns: columns.map((c) => c.width || "1fr").join(" ") }}
      >
        {columns.map((c) => (
          <span
            key={c.key}
            className="dg-table-th"
            style={c.align === "right" ? { textAlign: "right" } : null}
          >
            {c.label}
          </span>
        ))}
      </div>
      {rows.map((r, i) => (
        <div
          className={`dg-table-row${onRowClick ? " dg-table-row--clickable" : ""}`}
          key={r.id || i}
          style={{ gridTemplateColumns: columns.map((c) => c.width || "1fr").join(" ") }}
          tabIndex={onRowClick ? 0 : undefined}
          onClick={onRowClick ? () => onRowClick(r) : undefined}
          onKeyDown={onRowClick ? (e) => { if (e.key === "Enter") onRowClick(r); } : undefined}
        >
          {columns.map((c) => (
            <span
              key={c.key}
              className="dg-table-td"
              style={c.align === "right" ? { textAlign: "right" } : null}
            >
              {c.render ? c.render(r) : r[c.key]}
            </span>
          ))}
        </div>
      ))}
    </div>
  );
}

// ---------- DistributionList -------------------------------------------
// suppliers: [{ rank, supplier, workers, status }]
// Reuses the New Requisition flow's <PriorityRow> + .prio-list so the
// detail view stays visually and behaviourally in sync with setup.
function DistributionList({ suppliers, note }) {
  const PR = window.PriorityRow;
  return (
    <div className="dg-dist">
      {note && (
        <div className="dg-dist-note">
          <span className="dg-dist-note-icon" aria-hidden="true">
            <Icon name="Information" size={18} />
          </span>
          <span>{note}</span>
        </div>
      )}
      <div className="prio-list">
        {suppliers.map((s) => (
          PR ? (
            <PR
              key={s.rank}
              rank={s.rank}
              supplierId={s.supplier}
              workers={s.workers}
              onOpenAgency={(id) => {
                const meta = REQ_SUPPLIERS[id];
                showToast(`Opening ${meta?.label || id} workers`);
              }}
            />
          ) : null
        ))}
      </div>
    </div>
  );
}

// ---------- ScheduleStrip ----------------------------------------------
// shifts: [{ date, time, role, location?, status }]
function ScheduleStrip({ shifts, emptyLabel }) {
  if (!shifts || shifts.length === 0) {
    return <div className="dg-empty">{emptyLabel || "No upcoming shifts"}</div>;
  }
  return (
    <ul className="dg-shifts">
      {shifts.map((s, i) => (
        <li className="dg-shift" key={i}>
          <span className="dg-shift-date">
            <span className="dg-shift-mo">{s.mo}</span>
            <span className="dg-shift-day">{s.day}</span>
          </span>
          <div className="dg-shift-text">
            <span className="dg-shift-role">{s.role}</span>
            <span className="dg-shift-meta">
              <span className="tabular">{s.time}</span>
              {s.location && <span> · {s.location}</span>}
            </span>
          </div>
          <span className={`req-pill req-pill--${s.statusHue || "default"}`}>{s.status || "Scheduled"}</span>
        </li>
      ))}
    </ul>
  );
}

// ---------- ManagerList -------------------------------------------------
// managers: [{ name, role, email, supplier? }]
function ManagerList({ managers }) {
  return (
    <ul className="dg-managers">
      {managers.map((m, i) => {
        const initials = m.name.split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
        return (
          <li className="dg-manager" key={i}>
            <span className="dg-manager-avatar" aria-hidden="true">{initials}</span>
            <div className="dg-manager-text">
              <span className="dg-manager-name">{m.name}</span>
              <span className="dg-manager-role">{m.role}</span>
            </div>
            <button
              type="button"
              className="btn btn--sm btn--tertiary dg-manager-view"
              onClick={() => showToast(`Opening ${m.name}'s profile`)}
            >
              View profile
            </button>
            <button
              type="button"
              className="iconbtn"
              aria-label={`Actions for ${m.name}`}
              onClick={(e) => openMenu(e.currentTarget, [
                { icon: "MailOpen", label: "Send message",  onClick: () => showToast(`Message to ${m.name} — drafted`) },
                { icon: "Copy",     label: "Copy email",    onClick: () => copyToClipboard(m.email, "Email copied") },
                { divider: true },
                { icon: "Cancel",   label: "Remove from requisition", danger: true,
                  onClick: () => showToast(`${m.name} removed`, { kind: "success" }) },
              ])}
            >
              <Icon name="MoreVert" size={18} />
            </button>
          </li>
        );
      })}
    </ul>
  );
}

// ---------- AttachmentList ----------------------------------------------
function AttachmentList({ files }) {
  if (!files || files.length === 0) {
    return (
      <div className="dg-empty dg-empty--action">
        <span>No attachments yet</span>
        <button
          type="button"
          className="btn btn--sm btn--secondary"
          onClick={() => showToast("Choose a file to upload", {
            action: { label: "Browse", onClick: () => showToast("File picker opened (preview)") },
          })}
        >
          <Icon name="FileUpload" size={14} />Upload file
        </button>
      </div>
    );
  }
  return (
    <ul className="dg-attachments">
      {files.map((f, i) => (
        <li className="dg-attachment-item" key={i}>
          <button
            type="button"
            className="dg-attachment dg-attachment--link"
            aria-label={`Open ${f.name} in a new tab`}
            onClick={() => showToast(`Opening ${f.name}`)}
          >
            <span className="dg-attachment-icon" aria-hidden="true">
              <Icon name={f.type === "pdf" ? "PDF" : f.type === "xlsx" ? "Excel" : "File"} size={20} />
            </span>
            <div className="dg-attachment-text">
              <span className="dg-attachment-name">{f.name}</span>
              <span className="dg-attachment-meta">{f.size} · uploaded {f.uploaded}</span>
            </div>
            <span className="dg-attachment-action" aria-hidden="true">
              <Icon name="LinkNewWindow" size={18} />
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

// ---------- Section header used between subsections of one accordion ---
function DgSubhead({ title, action }) {
  return (
    <div className="dg-subhead">
      <h3 className="dg-subhead-title">{title}</h3>
      {action}
    </div>
  );
}

Object.assign(window, {
  InfoGrid, ActivityLog, MiniTable, DistributionList,
  ScheduleStrip, ManagerList, AttachmentList, DgSubhead,
});
