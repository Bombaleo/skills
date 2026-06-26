// =====================================================================
// Flex Work — Manager mobile app
//
// Lives inside an iPhone frame, hosted as a side-docked preview when
// the user opens "Manager (mobile)" from the Viewing-as menu. Mirrors
// the desktop manager experience on a phone:
//   • Home    — today's standup: at-risk, approvals, open reqs
//   • Shifts  — Today / Upcoming / Open / Past sub-tabs
//   • Approvals — timesheets pending sign-off, swipe-to-approve
//   • More    — manager profile + my locations + sign out
//
// Reuses the worker-mobile shell (wm-stage / wm-app / wm-card / etc.)
// so the visual chrome reads as the same product family — only the
// payload changes. Pulls live data from window.REQUISITIONS /
// window.TIMESHEETS / window.TRIAGE / window.APPROVALS so the numbers
// the manager sees on their phone match the desktop in the background.
// =====================================================================

const { useState: _mmState, useEffect: _mmEffect, useRef: _mmRef, useMemo: _mmMemo } = React;

// ---------- Manager pool -----------------------------------------------
// The picker lists managers from window.MANAGERS when available, with
// a sensible fallback so the demo works even on a bare data set.
function _mmGetManagerPool() {
  const all = (typeof window !== "undefined" && window.MANAGERS) || [];
  if (all.length) return all;
  // Synthesize a pool from REQUISITIONS bookedBy + LOCATIONS manager names
  // so the picker has someone to choose from even before tenant data
  // is loaded.
  const reqs = (typeof window !== "undefined" && window.REQUISITIONS) || [];
  const locs = (typeof window !== "undefined" && window.LOCATIONS) || [];
  const names = new Set();
  reqs.forEach((r) => r.bookedBy && names.add(r.bookedBy));
  locs.forEach((l) => l.manager && names.add(l.manager));
  const out = [];
  ["Amy Chen", "Marcus Webb", "Jordan Lee", "Priya Aravind", ...names].forEach((n) => {
    if (!out.find((x) => x.name === n)) {
      out.push({
        id: "m-" + n.split(/\s+/).map((p) => p[0].toLowerCase()).join(""),
        name: n,
        title: "Operations Manager",
        sites: locs.filter((l) => l.manager === n).map((l) => l.name).slice(0, 5),
      });
    }
  });
  return out;
}
function _mmInitialsFor(name) {
  return (window.initialsFor || ((s) => (s || "").split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase()))(name);
}
function _mmPaletteFor(id) {
  return (window.paletteFor || ((s) => ({ bg: "#c4d9f0", fg: "#0d2745" })))(id);
}
function _mmDefaultManager(pool) {
  if (!pool || pool.length === 0) return { id: "m-ac", name: "Amy Chen", title: "Operations Manager", sites: [] };
  return pool.find((m) => m.name === "Amy Chen") || pool[0];
}

function _mm$(n) { return Number(n).toLocaleString("en-US", { style: "currency", currency: "USD" }); }

// =====================================================================
// Inline SVG icons — same family as worker-mobile so the visuals match.
// =====================================================================
function MmIcon({ name, size = 24, style = {} }) {
  const common = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", style };
  switch (name) {
    case "home":
      return (<svg {...common}><path d="M3.5 11.5 12 4l8.5 7.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/><path d="M5.5 10.5V19a1 1 0 0 0 1 1H10v-5a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v5h3.5a1 1 0 0 0 1-1v-8.5" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round"/></svg>);
    case "briefcase":
      return (<svg {...common}><rect x="3.5" y="7.5" width="17" height="12" rx="2" stroke="currentColor" strokeWidth="1.7"/><path d="M9 7.5V6a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v1.5M3.5 12.5h17" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/></svg>);
    case "clipboard-check":
      return (<svg {...common}><rect x="6" y="4.5" width="12" height="16" rx="2" stroke="currentColor" strokeWidth="1.7"/><rect x="9" y="3" width="6" height="3" rx="1" stroke="currentColor" strokeWidth="1.7"/><path d="m9 12 2.5 2.5L16 10" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/></svg>);
    case "grid":
      return (<svg {...common}><rect x="4" y="4" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.7"/><rect x="13" y="4" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.7"/><rect x="4" y="13" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.7"/><rect x="13" y="13" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.7"/></svg>);
    case "lightning":
      return (<svg {...common}><path d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z" fill="currentColor"/></svg>);
    case "alert":
      return (<svg {...common}><path d="M12 3 2 20h20L12 3Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round"/><path d="M12 10v4M12 17v.1" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/></svg>);
    case "cal":
      return (<svg {...common}><rect x="3.5" y="5.5" width="17" height="15" rx="2.5" stroke="currentColor" strokeWidth="1.7"/><path d="M8 3v4M16 3v4M3.5 10h17" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/></svg>);
    case "time-back":
      return (<svg {...common}><path d="M12 6V3L7 7.5 12 12V9a5.5 5.5 0 1 1-5.5 5.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/><path d="M12 9v3.5l3 2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/></svg>);
    case "users":
      return (<svg {...common}><circle cx="9" cy="9" r="3.5" stroke="currentColor" strokeWidth="1.7"/><path d="M3 19.5c0-3 2.7-5 6-5s6 2 6 5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/><circle cx="17" cy="10" r="2.5" stroke="currentColor" strokeWidth="1.7"/><path d="M14.5 19.5c0-2.4 1.7-4.5 4.5-4.5s2 0 2 0" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/></svg>);
    case "plus":
      return (<svg {...common}><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>);
    case "check":
      return (<svg {...common}><path d="m5 12 4.5 4.5L19 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>);
    case "x":
      return (<svg {...common}><path d="m6 6 12 12M6 18 18 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>);
    case "x-circle":
      return (<svg {...common}><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.7"/><path d="m9 9 6 6m0-6-6 6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/></svg>);
    case "chevron-l":
      return (<svg {...common}><path d="m14 5-7 7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>);
    case "chevron-r":
      return (<svg {...common}><path d="m10 5 7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>);
    case "more":
      return (<svg {...common}><circle cx="5.5"  cy="12" r="1.6" fill="currentColor"/><circle cx="12"   cy="12" r="1.6" fill="currentColor"/><circle cx="18.5" cy="12" r="1.6" fill="currentColor"/></svg>);
    case "help":
      return (<svg {...common}><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.7"/><path d="M9.5 9a2.5 2.5 0 0 1 5 0c0 1.5-2 1.7-2.5 3v.5M12 16.5v.1" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/></svg>);
    case "pin":
      return (<svg {...common}><path d="M12 21s7-6.5 7-12a7 7 0 1 0-14 0c0 5.5 7 12 7 12Z" fill="currentColor"/><circle cx="12" cy="9" r="2.5" fill="#fff"/></svg>);
    case "phone":
      return (<svg {...common}><path d="M5 3h3l2 5-2.5 1.5a11 11 0 0 0 5 5L14 12l5 2v3a2 2 0 0 1-2 2A14 14 0 0 1 3 5a2 2 0 0 1 2-2Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round"/></svg>);
    case "chat":
      return (<svg {...common}><path d="M4 5.5A1.5 1.5 0 0 1 5.5 4h11A1.5 1.5 0 0 1 18 5.5v8A1.5 1.5 0 0 1 16.5 15H10l-4 4v-4H5.5A1.5 1.5 0 0 1 4 13.5v-8Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round"/></svg>);
    case "search":
      return (<svg {...common}><circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.7"/><path d="m16.2 16.2 3.6 3.6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/></svg>);
    case "filter":
      return (<svg {...common}><path d="M4 5h16l-6 8v6l-4-2v-4L4 5Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round"/></svg>);
    case "settings":
      return (<svg {...common}><circle cx="12" cy="12" r="2.6" stroke="currentColor" strokeWidth="1.7"/><path d="M19.4 12.9a7.4 7.4 0 0 0 0-1.8l2-1.5-2-3.4-2.3.9a7.5 7.5 0 0 0-1.6-.9L15 4h-4l-.5 2.2a7.5 7.5 0 0 0-1.6.9l-2.3-.9-2 3.4 2 1.5a7.4 7.4 0 0 0 0 1.8l-2 1.5 2 3.4 2.3-.9a7.5 7.5 0 0 0 1.6.9L11 20h4l.5-2.2a7.5 7.5 0 0 0 1.6-.9l2.3.9 2-3.4-2-1.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/></svg>);
    case "logout":
      return (<svg {...common}><path d="M14 4h-7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h7" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/><path d="m17 8 4 4-4 4M11 12h10" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/></svg>);
    case "report":
      return (<svg {...common}><path d="M4 4h12l4 4v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round"/><path d="M15 4v5h5M8 13v4M12 11v6M16 15v2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/></svg>);
    case "dollar":
      return (<svg {...common}><path d="M12 4v16M16.5 8c0-1.5-2-3-4.5-3s-4.5 1.5-4.5 3 2 2.6 4.5 3c2.6.4 4.5 1.6 4.5 3s-2 3-4.5 3-4.5-1.5-4.5-3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/></svg>);
    case "send":
      return (<svg {...common}><path d="m4 20 17-8L4 4l3 8-3 8Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round"/><path d="M7 12h14" stroke="currentColor" strokeWidth="1.7"/></svg>);
    default:
      return null;
  }
}

// =====================================================================
// Shared sub-components — reuse wm- shell classes for chrome
// =====================================================================
function MmHeader({ title, subtitle, onHelp, onBack, action }) {
  return (
    <div className="wm-header">
      {onBack ? (
        <button className="wm-iconbtn wm-iconbtn--bare" onClick={onBack} aria-label="Back">
          <MmIcon name="chevron-l" size={26} />
        </button>
      ) : (
        <div>
          <h1>{title}</h1>
          {subtitle && <div className="mm-header-sub">{subtitle}</div>}
        </div>
      )}
      <div className="wm-header-r">
        {action || null}
        {onHelp && (
          <button className="wm-iconbtn" onClick={onHelp} aria-label="Notifications">
            <MmIcon name="alert" size={20} />
          </button>
        )}
      </div>
    </div>
  );
}

function MmTabBar({ tab, onChange, approvalsBadge, atRiskBadge }) {
  const items = [
    { id: "home",      label: "Home",      icon: "home",            badge: atRiskBadge },
    { id: "shifts",    label: "Shifts",    icon: "briefcase" },
    { id: "approvals", label: "Approvals", icon: "clipboard-check", badge: approvalsBadge },
    { id: "more",      label: "More",      icon: "grid" },
  ];
  return (
    <div className="wm-tabbar" role="tablist">
      {items.map((it) => (
        <button
          key={it.id}
          type="button"
          role="tab"
          aria-selected={tab === it.id}
          className={`wm-tabbar-item${tab === it.id ? " wm-tabbar-item--active" : ""}`}
          onClick={() => onChange(it.id)}
        >
          {it.badge ? <span className="wm-tabbar-badge">{it.badge}</span> : null}
          <MmIcon name={it.icon} size={22} />
          <span className="wm-tabbar-item-label">{it.label}</span>
        </button>
      ))}
    </div>
  );
}

function MmSubTabs({ tab, onChange, badges = {} }) {
  const items = [
    { id: "today",    label: "Today",    icon: "lightning" },
    { id: "upcoming", label: "Upcoming", icon: "cal" },
    { id: "open",     label: "Open",     icon: "briefcase" },
    { id: "past",     label: "Past",     icon: "time-back" },
  ];
  return (
    <div className="wm-subtabs mm-subtabs" role="tablist">
      {items.map((it) => (
        <button
          key={it.id}
          type="button"
          role="tab"
          aria-selected={tab === it.id}
          className={`wm-subtab${tab === it.id ? " wm-subtab--active" : ""}`}
          onClick={() => onChange(it.id)}
        >
          <span className="wm-subtab-icon"><MmIcon name={it.icon} size={20} /></span>
          <span className="wm-subtab-label">{it.label}</span>
          {badges[it.id] ? <span className="wm-subtab-badge">{badges[it.id]}</span> : null}
        </button>
      ))}
    </div>
  );
}

// ---------- Data derivations ------------------------------------------
// Today is whatever window.flexToday() returns when available (the demo
// shifts this around to keep dates feeling current), with a fallback to
// the real clock so the file is usable in isolation.
function _mmToday() {
  return (window.flexToday && window.flexToday()) || new Date();
}
function _mmParseTsDate(d) {
  const m = /(\d+)\.(\d+)\.(\d+)/.exec(d || "");
  if (!m) return null;
  return new Date(parseInt(m[3], 10), parseInt(m[1], 10) - 1, parseInt(m[2], 10));
}
function _mmFmtDayLabel(date, today) {
  if (!date) return "—";
  const d0 = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const d1 = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diff = Math.round((d1 - d0) / 86400000);
  const wkdy = date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  if (diff === 0) return `Today · ${wkdy}`;
  if (diff === 1) return `Tomorrow · ${wkdy}`;
  if (diff === -1) return `Yesterday · ${wkdy}`;
  return wkdy;
}
function _mmWorkerName(workerId) {
  const w = (window.WORKERS || []).find((x) => x.id === workerId);
  return w ? w.name : workerId;
}
function _mmSupLabel(supId) {
  const s = (window.REQ_SUPPLIERS || {})[supId];
  return s ? s.label : (supId || "");
}
function _mmRateFor(role) {
  const r = String(role || "").toLowerCase();
  if (/manager|lead|supervisor/.test(r)) return 28;
  if (/operator|electrician|maintenance|forklift|inspector/.test(r)) return 22;
  if (/assembler|factory|driver/.test(r)) return 21;
  if (/nurse|rn/.test(r)) return 54;
  return 18;
}
function _mmHoursBetween(start, end) {
  const parse = (t) => {
    const m = /(\d+):(\d+)\s*(AM|PM)/i.exec(t || "");
    if (!m) return null;
    let h = parseInt(m[1], 10) % 12;
    if (m[3].toUpperCase() === "PM") h += 12;
    return h * 60 + parseInt(m[2], 10);
  };
  const s = parse(start), e = parse(end);
  if (s == null || e == null) return 0;
  let d = e - s; if (d <= 0) d += 24 * 60;
  return d / 60;
}

// ---------- Per-manager today/upcoming/open/past shift derivations ----
function _mmBuildShifts() {
  const reqs = window.REQUISITIONS || [];
  const ts   = window.TIMESHEETS  || [];
  const today = _mmToday();

  // OPEN — Booked + In progress requisitions become "open" shifts to fill
  // (the manager mobile groups them visually as positions still being
  // filled). We score them via TRIAGE level when present.
  const triage = window.TRIAGE || [];
  const triageById = Object.fromEntries(triage.map((t) => [t.reqId, t]));
  const open = reqs
    .filter((r) => r.status === "Booked" || r.status === "In progress")
    .slice(0, 14)
    .map((r) => {
      const tr = triageById[r.id];
      const confirmed = tr ? tr.confirmed : Math.max(0, (r.qty || 1) - 1);
      const filled = (r.status === "In progress");
      const dateStr = (r.dates && r.dates[0]) || "—";
      return {
        kind: "open",
        id: r.id,
        title: r.jobs[0] || "Position",
        org: r.location,
        qty: r.qty,
        confirmed,
        filled,
        time: r.time,
        date: dateStr,
        risk: tr ? tr.level : (filled ? "ok" : "warn"),
        amount: r.bill,
        suppliers: (r.suppliers || []).map(_mmSupLabel).slice(0, 2),
      };
    });

  // TODAY — timesheets in "Open" status today plus active TRIAGE
  // Active timesheets (clocked in, no end). Plus a couple "wrapped"
  // ones so the today list reads as a real ops feed.
  const todayTs = ts.filter((t) => {
    const d = _mmParseTsDate(t.date);
    return d && d.toDateString() === today.toDateString();
  });
  const todayShifts = todayTs.map((t) => {
    const phase = t.actualEnd && t.actualEnd !== "—"
      ? "wrapped"
      : (t.actualStart && t.actualStart !== "—" ? "working" : "pending");
    return {
      kind: "today",
      id: t.id,
      title: t.role,
      worker: _mmWorkerName(t.worker),
      workerId: t.worker,
      supplier: _mmSupLabel(t.supplier),
      booking: t.booking,
      schedStart: t.schedStart,
      schedEnd:   t.schedEnd,
      actualStart: t.actualStart,
      actualEnd:   t.actualEnd,
      phase,
      // late flag — actual is more than 10 min past sched.
      late: (() => {
        if (!t.actualStart || t.actualStart === "—") return false;
        const a = _mmHoursBetween(t.schedStart, t.actualStart);
        return a > 10/60;
      })(),
    };
  });

  // UPCOMING — for variety, peek 7 days ahead of today and pull any
  // requisitions whose first date strs match.
  const upcoming = reqs
    .filter((r) => r.status === "Booked")
    .slice(0, 8)
    .map((r, i) => {
      const offset = i + 1;
      const d = new Date(today); d.setDate(d.getDate() + offset);
      return {
        kind: "upcoming",
        id: r.id,
        title: r.jobs[0] || "Position",
        org: r.location,
        qty: r.qty,
        date: d,
        dateLabel: _mmFmtDayLabel(d, today),
        time: r.time,
        suppliers: (r.suppliers || []).map(_mmSupLabel).slice(0, 2),
      };
    });

  // PAST — closed timesheets, sorted desc
  const past = ts
    .filter((t) => t.status === "Closed" && t.actualEnd && t.actualEnd !== "—")
    .map((t) => {
      const d = _mmParseTsDate(t.date);
      const hrs = _mmHoursBetween(t.actualStart, t.actualEnd);
      return {
        kind: "past",
        id: t.id,
        title: t.role,
        worker: _mmWorkerName(t.worker),
        workerId: t.worker,
        supplier: _mmSupLabel(t.supplier),
        booking: t.booking,
        date: d,
        dateLabel: d ? _mmFmtDayLabel(d, today) : t.date,
        actualStart: t.actualStart,
        actualEnd: t.actualEnd,
        hours: hrs,
        amount: hrs * _mmRateFor(t.role),
      };
    })
    .sort((a, b) => (b.date ? b.date.getTime() : 0) - (a.date ? a.date.getTime() : 0))
    .slice(0, 12);

  return { open, todayShifts, upcoming, past };
}

// ---------- Approval list ---------------------------------------------
function _mmBuildApprovals() {
  // Pull TIMESHEETS in Pending Approval / Review — the same set the
  // desktop Approvals page reads — and shape each into a phone row.
  const ts = window.TIMESHEETS || [];
  return ts
    .filter((t) => t.status === "Pending Approval" || t.status === "Review")
    .map((t) => {
      const hrs = _mmHoursBetween(t.actualStart === "—" ? t.schedStart : t.actualStart,
                                  t.actualEnd   === "—" ? t.schedEnd   : t.actualEnd);
      return {
        id: t.id,
        worker: _mmWorkerName(t.worker),
        workerId: t.worker,
        supplier: _mmSupLabel(t.supplier),
        role: t.role,
        booking: t.booking,
        date: _mmParseTsDate(t.date),
        rawDate: t.date,
        schedStart: t.schedStart, schedEnd: t.schedEnd,
        actualStart: t.actualStart, actualEnd: t.actualEnd,
        hours: hrs,
        amount: hrs * _mmRateFor(t.role),
        status: t.status,
        flag: t.status === "Review" ? "Disputed" :
              (t.actualEnd === "—" ? "Missing clock-out" :
              (Math.abs(_mmHoursBetween(t.schedEnd, t.actualEnd)) > 10/60 ? "OT" : null)),
      };
    });
}

// =====================================================================
// HOME — the manager's standup screen
// =====================================================================
function MmHomeScreen({ manager, shifts, approvals, atRiskCount, onTabChange, onOpenShift, onOpenApproval, onPostShift, onHelp, today }) {
  const greet = (() => {
    const h = today.getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  })();
  const firstName = (manager.name || "").split(" ")[0];
  const openCount = shifts.open.length;
  const todayCount = shifts.todayShifts.length;
  const pal = _mmPaletteFor(manager.id);

  return (
    <React.Fragment>
      <MmHeader
        title="Home"
        onHelp={onHelp}
        action={
          <span
            className="mm-avatar-pill"
            style={{ background: pal.bg, color: pal.fg }}
            aria-label={manager.name}
            title={manager.name}
          >
            {_mmInitialsFor(manager.name)}
          </span>
        }
      />
      <div className="wm-scroll">
        <div className="mm-greet">
          <div className="mm-greet-headline">{greet}, {firstName}</div>
          <div className="mm-greet-sub">
            {manager.sites && manager.sites.length
              ? `${manager.sites.length} ${manager.sites.length === 1 ? "site" : "sites"} · ${today.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}`
              : today.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
          </div>
        </div>

        {/* Metric tiles */}
        <div className="mm-stat-row">
          <button type="button" className="mm-stat mm-stat--risk" onClick={() => onTabChange("home")}>
            <div className="mm-stat-value">{atRiskCount}</div>
            <div className="mm-stat-label">At risk</div>
            <div className="mm-stat-icon"><MmIcon name="alert" size={18} /></div>
          </button>
          <button type="button" className="mm-stat" onClick={() => onTabChange("approvals")}>
            <div className="mm-stat-value">{approvals.length}</div>
            <div className="mm-stat-label">Approvals</div>
            <div className="mm-stat-icon"><MmIcon name="clipboard-check" size={18} /></div>
          </button>
          <button type="button" className="mm-stat" onClick={() => { onTabChange("shifts"); }}>
            <div className="mm-stat-value">{openCount}</div>
            <div className="mm-stat-label">Open</div>
            <div className="mm-stat-icon"><MmIcon name="briefcase" size={18} /></div>
          </button>
        </div>

        {/* Quick post */}
        <button type="button" className="mm-post-card" onClick={onPostShift}>
          <div className="mm-post-card-icon"><MmIcon name="plus" size={22} /></div>
          <div className="mm-post-card-body">
            <div className="mm-post-card-title">Post a shift</div>
            <div className="mm-post-card-sub">Create a new requisition for your team</div>
          </div>
          <MmIcon name="chevron-r" size={18} />
        </button>

        {/* Today's shifts */}
        <div className="wm-section-title mm-section-title">
          <span>Today's shifts</span>
          {todayCount > 0 && (
            <button className="wm-show-more" onClick={() => onTabChange("shifts")}>View all</button>
          )}
        </div>
        {todayCount === 0 ? (
          <div className="wm-empty">
            <div className="wm-empty-icon"><MmIcon name="lightning" size={22} /></div>
            <h3>Quiet day</h3>
            <p>No workers are scheduled at your sites today.</p>
          </div>
        ) : (
          shifts.todayShifts.slice(0, 3).map((s) => (
            <MmTodayCard key={s.id} shift={s} onOpen={() => onOpenShift(s, "today")} />
          ))
        )}

        {/* Pending approvals */}
        {approvals.length > 0 && (
          <React.Fragment>
            <div className="wm-section-title mm-section-title">
              <span>Pending approvals</span>
              <button className="wm-show-more" onClick={() => onTabChange("approvals")}>View all</button>
            </div>
            {approvals.slice(0, 3).map((a) => (
              <MmApprovalCard key={a.id} approval={a} compact onOpen={() => onOpenApproval(a.id)} />
            ))}
          </React.Fragment>
        )}

        <div style={{ height: 24 }} />
      </div>
    </React.Fragment>
  );
}

// =====================================================================
// Cards — variants per shift kind
// =====================================================================
function MmTodayCard({ shift, onOpen }) {
  const phaseLabel = shift.phase === "working" ? "Clocked in"
                   : shift.phase === "wrapped" ? "Wrapped"
                   : "Awaiting clock-in";
  const phaseClass = shift.phase === "working" ? "mm-pill--ok"
                   : shift.phase === "wrapped" ? "mm-pill--neutral"
                   : "mm-pill--warn";
  return (
    <button type="button" className="wm-card mm-card-today" onClick={onOpen}>
      <div className="mm-card-row">
        <div className="mm-card-name">{shift.worker}</div>
        <span className={`mm-pill ${phaseClass}`}>{phaseLabel}</span>
      </div>
      <div className="wm-card-title">{shift.title}</div>
      <div className="wm-card-org">{shift.supplier} · {shift.booking}</div>
      <div className="mm-clock-row">
        <span className="mm-clock-block">
          <small>In</small>
          <strong>{shift.actualStart === "—" ? shift.schedStart : shift.actualStart}</strong>
        </span>
        <span className="mm-clock-divider" aria-hidden="true">→</span>
        <span className="mm-clock-block">
          <small>Out</small>
          <strong>{shift.actualEnd === "—" ? shift.schedEnd : shift.actualEnd}</strong>
        </span>
        {shift.late && <span className="mm-pill mm-pill--warn mm-pill--inline">Late</span>}
      </div>
    </button>
  );
}
function MmUpcomingCard({ shift, onOpen }) {
  return (
    <button type="button" className="wm-card" onClick={onOpen}>
      <div className="wm-card-title">{shift.title}</div>
      <div className="wm-card-time">{shift.time}</div>
      <div className="wm-card-org">{shift.org}</div>
      <div className="mm-meta-row">
        <span>{shift.qty} {shift.qty === 1 ? "worker" : "workers"}</span>
        {shift.suppliers && shift.suppliers.length > 0 && <span>· {shift.suppliers.join(", ")}</span>}
      </div>
    </button>
  );
}
function MmOpenCard({ shift, onOpen }) {
  const filledPct = Math.round((shift.confirmed / Math.max(1, shift.qty)) * 100);
  const riskClass = shift.risk === "crit" ? "mm-fill--crit"
                  : shift.risk === "warn" ? "mm-fill--warn"
                  : "mm-fill--ok";
  return (
    <button type="button" className="wm-card mm-card-open" onClick={onOpen}>
      <div className="mm-card-row">
        <div className="wm-card-title">{shift.title}</div>
        {shift.risk === "crit" && <span className="mm-pill mm-pill--crit">Critical</span>}
        {shift.risk === "warn" && <span className="mm-pill mm-pill--warn">At risk</span>}
      </div>
      <div className="wm-card-time">{shift.time}</div>
      <div className="wm-card-org">{shift.org}</div>
      <div className="mm-fill-row">
        <div className="mm-fill-text">
          <strong>{shift.confirmed}</strong> of {shift.qty} confirmed
        </div>
        <div className="mm-fill-bar">
          <div className={`mm-fill-progress ${riskClass}`} style={{ width: filledPct + "%" }} />
        </div>
      </div>
      <div className="mm-meta-row">
        <span>{shift.date}</span>
        {shift.suppliers && shift.suppliers.length > 0 && <span>· {shift.suppliers.join(", ")}</span>}
      </div>
    </button>
  );
}
function MmPastCard({ shift, onOpen }) {
  return (
    <button type="button" className="wm-card" onClick={onOpen}>
      <div className="mm-card-row">
        <div className="mm-card-name">{shift.worker}</div>
        <div className="mm-card-amount">{_mm$(shift.amount)}</div>
      </div>
      <div className="wm-card-title">{shift.title}</div>
      <div className="wm-card-org">{shift.supplier} · {shift.booking}</div>
      <div className="mm-meta-row">
        <span>{shift.actualStart} – {shift.actualEnd}</span>
        <span>· {shift.hours.toFixed(2)} hrs</span>
      </div>
    </button>
  );
}

function MmApprovalCard({ approval: a, onOpen, compact }) {
  return (
    <button type="button" className={`wm-card mm-card-approval${compact ? " mm-card-approval--compact" : ""}`} onClick={onOpen}>
      <div className="mm-card-row">
        <div className="mm-card-name">{a.worker}</div>
        <div className="mm-card-amount">{_mm$(a.amount)}</div>
      </div>
      <div className="wm-card-title">{a.role}</div>
      <div className="wm-card-org">{a.supplier} · {a.booking}</div>
      <div className="mm-meta-row">
        <span>{a.rawDate}</span>
        <span>· {a.hours.toFixed(2)} hrs</span>
        {a.flag && <span className={`mm-pill mm-pill--inline mm-pill--${a.status === "Review" ? "crit" : "warn"}`}>{a.flag}</span>}
      </div>
    </button>
  );
}

// =====================================================================
// SHIFTS — list with sub-tabs (today / upcoming / open / past)
// =====================================================================
function MmShiftsScreen({ subTab, shifts, onSubTab, onOpenShift, onHelp, onPostShift }) {
  const list = subTab === "today"    ? shifts.todayShifts
             : subTab === "upcoming" ? shifts.upcoming
             : subTab === "open"     ? shifts.open
             :                          shifts.past;
  const badges = {
    today:    shifts.todayShifts.length || undefined,
    open:     shifts.open.filter((s) => s.risk !== "ok").length || undefined,
  };
  // Group upcoming by day label for visual rhythm.
  const grouped = subTab === "upcoming" ? list.reduce((acc, s) => {
    (acc[s.dateLabel] = acc[s.dateLabel] || []).push(s);
    return acc;
  }, {}) : null;
  return (
    <React.Fragment>
      <MmHeader
        title="Shifts"
        onHelp={onHelp}
        action={
          subTab === "open" ? (
            <button type="button" className="wm-iconbtn" onClick={onPostShift} aria-label="Post a shift">
              <MmIcon name="plus" size={20} />
            </button>
          ) : null
        }
      />
      <MmSubTabs tab={subTab} onChange={onSubTab} badges={badges} />
      <div className="wm-scroll">
        {list.length === 0 ? (
          <div className="wm-empty" style={{ marginTop: 60 }}>
            <div className="wm-empty-icon"><MmIcon name={subTab === "today" ? "lightning" : subTab === "open" ? "briefcase" : subTab === "past" ? "time-back" : "cal"} size={22} /></div>
            <h3>
              {subTab === "today"    && "Quiet day"}
              {subTab === "upcoming" && "Nothing scheduled"}
              {subTab === "open"     && "All shifts filled"}
              {subTab === "past"     && "No past shifts"}
            </h3>
            <p>
              {subTab === "today"    && "No workers are scheduled at your sites today."}
              {subTab === "upcoming" && "Post a new shift to start booking your team."}
              {subTab === "open"     && "Every requisition you posted is fully confirmed."}
              {subTab === "past"     && "Wrapped shifts will appear here once they're approved."}
            </p>
            {subTab === "open" && (
              <button type="button" className="wm-btn" onClick={onPostShift}>Post a shift</button>
            )}
          </div>
        ) : (
          subTab === "upcoming" ? (
            Object.keys(grouped).map((day) => (
              <React.Fragment key={day}>
                <div className="wm-day-title">{day.replace("Today · ", "")}</div>
                {grouped[day].map((s) => <MmUpcomingCard key={s.id} shift={s} onOpen={() => onOpenShift(s, "upcoming")} />)}
              </React.Fragment>
            ))
          ) : (
            list.map((s) => (
              subTab === "today"  ? <MmTodayCard    key={s.id} shift={s} onOpen={() => onOpenShift(s, "today")} />
            : subTab === "open"   ? <MmOpenCard     key={s.id} shift={s} onOpen={() => onOpenShift(s, "open")} />
            :                       <MmPastCard     key={s.id} shift={s} onOpen={() => onOpenShift(s, "past")} />
            ))
          )
        )}
        <div style={{ height: 32 }} />
      </div>
    </React.Fragment>
  );
}

// =====================================================================
// APPROVALS — list + detail
// =====================================================================
function MmApprovalsScreen({ approvals, onOpenApproval, onApproveAll, onHelp }) {
  return (
    <React.Fragment>
      <MmHeader
        title="Approvals"
        onHelp={onHelp}
        action={
          approvals.length > 1 ? (
            <button type="button" className="mm-text-action" onClick={onApproveAll}>Approve all</button>
          ) : null
        }
      />
      <div className="wm-scroll">
        {approvals.length === 0 ? (
          <div className="wm-empty" style={{ marginTop: 80 }}>
            <div className="wm-empty-icon"><MmIcon name="clipboard-check" size={22} /></div>
            <h3>Inbox zero</h3>
            <p>All timesheets are caught up. New submissions will appear here.</p>
          </div>
        ) : (
          <React.Fragment>
            <div className="mm-approvals-summary">
              <div className="mm-approvals-summary-block">
                <div className="mm-approvals-summary-value">{approvals.length}</div>
                <div className="mm-approvals-summary-label">Pending</div>
              </div>
              <div className="mm-approvals-summary-block">
                <div className="mm-approvals-summary-value">
                  {_mm$(approvals.reduce((sum, a) => sum + a.amount, 0))}
                </div>
                <div className="mm-approvals-summary-label">Total</div>
              </div>
              <div className="mm-approvals-summary-block">
                <div className="mm-approvals-summary-value">
                  {approvals.filter((a) => a.flag).length}
                </div>
                <div className="mm-approvals-summary-label">Flagged</div>
              </div>
            </div>
            {approvals.map((a) => (
              <MmApprovalCard key={a.id} approval={a} onOpen={() => onOpenApproval(a.id)} />
            ))}
          </React.Fragment>
        )}
        <div style={{ height: 32 }} />
      </div>
    </React.Fragment>
  );
}

function MmApprovalDetail({ approval: a, onBack, onApprove, onSendBack }) {
  const variance = _mmHoursBetween(a.schedEnd, a.actualEnd === "—" ? a.schedEnd : a.actualEnd);
  return (
    <React.Fragment>
      <div className="wm-header">
        <button className="wm-iconbtn wm-iconbtn--bare" onClick={onBack} aria-label="Back">
          <MmIcon name="chevron-l" size={26} />
        </button>
        <div className="wm-header-r">
          <button className="wm-iconbtn" aria-label="More"><MmIcon name="more" size={20} /></button>
        </div>
      </div>
      <div className="wm-scroll">
        <h2 className="wm-detail-title">{a.worker}</h2>
        <div className="wm-detail-org">{a.role} · {a.supplier}</div>
        <div className="wm-detail-addr">{a.booking}</div>

        {a.flag && (
          <div className={`wm-banner${a.status === "Review" ? " mm-banner--alert" : ""}`}>
            <div className="wm-banner-title">{a.flag}</div>
            {a.status === "Review"
              ? "The worker disputed the recorded hours. Review their note before approving."
              : "Their actual hours differ from the schedule. Verify before approving."}
          </div>
        )}

        <div className="wm-detail-stats wm-detail-stats--three">
          <div className="wm-detail-stat">
            <div className="wm-detail-stat-value">{a.hours.toFixed(2)}</div>
            <div className="wm-detail-stat-label">Hours worked</div>
          </div>
          <div className="wm-detail-stat">
            <div className="wm-detail-stat-value">{_mm$(_mmRateFor(a.role))}</div>
            <div className="wm-detail-stat-label">Bill rate</div>
          </div>
          <div className="wm-detail-stat">
            <div className="wm-detail-stat-value">{_mm$(a.amount)}</div>
            <div className="wm-detail-stat-label">Total</div>
          </div>
        </div>

        <div className="wm-info">
          <div className="wm-info-icon"><MmIcon name="cal" size={22} /></div>
          <div className="wm-info-body">
            <div className="wm-info-title">{a.rawDate}</div>
            Scheduled {a.schedStart} – {a.schedEnd}
          </div>
        </div>

        <div className="wm-info">
          <div className="wm-info-icon"><MmIcon name="lightning" size={22} /></div>
          <div className="wm-info-body">
            <div className="wm-info-title">Clock entries</div>
            In {a.actualStart} · Out {a.actualEnd}
            {variance > 10/60 && (
              <div className="mm-variance">+{variance.toFixed(1)} hr vs schedule</div>
            )}
          </div>
        </div>

        <div className="wm-section-title">Audit trail</div>
        <div className="mm-audit">
          <div className="mm-audit-row">
            <span className="mm-audit-dot" />
            <div>
              <div className="mm-audit-title">Worker submitted</div>
              <div className="mm-audit-sub">{a.rawDate} · {a.actualEnd === "—" ? "pending clock-out" : a.actualEnd}</div>
            </div>
          </div>
          <div className="mm-audit-row">
            <span className="mm-audit-dot mm-audit-dot--current" />
            <div>
              <div className="mm-audit-title">Awaiting your approval</div>
              <div className="mm-audit-sub">Standard review window: 48 hrs</div>
            </div>
          </div>
        </div>

        <div style={{ height: 110 }} />
      </div>
      <div className="wm-action-bar">
        <button type="button" className="wm-btn wm-btn--ghost" onClick={onSendBack}>Send back</button>
        <button type="button" className="wm-btn" onClick={onApprove}>Approve</button>
      </div>
    </React.Fragment>
  );
}

// =====================================================================
// SHIFT DETAIL — variant per kind (today / upcoming / open / past)
// =====================================================================
function MmShiftDetail({ shift, onBack, onMessage, onCallSupplier, onMarkFilled }) {
  return (
    <React.Fragment>
      <div className="wm-header">
        <button className="wm-iconbtn wm-iconbtn--bare" onClick={onBack} aria-label="Back">
          <MmIcon name="chevron-l" size={26} />
        </button>
        <div className="wm-header-r">
          <button className="wm-iconbtn" aria-label="More"><MmIcon name="more" size={20} /></button>
        </div>
      </div>
      <div className="wm-scroll">
        {shift.kind === "today" && (
          <React.Fragment>
            <h2 className="wm-detail-title">{shift.worker}</h2>
            <div className="wm-detail-org">{shift.title}</div>
            <div className="wm-detail-addr">{shift.supplier} · {shift.booking}</div>
            <div className="wm-detail-stats">
              <div className="wm-detail-stat">
                <div className="wm-detail-stat-value">{shift.actualStart === "—" ? shift.schedStart : shift.actualStart}</div>
                <div className="wm-detail-stat-label">Clock in</div>
              </div>
              <div className="wm-detail-stat">
                <div className="wm-detail-stat-value">{shift.actualEnd === "—" ? shift.schedEnd : shift.actualEnd}</div>
                <div className="wm-detail-stat-label">{shift.phase === "wrapped" ? "Clock out" : "Sched. out"}</div>
              </div>
            </div>
            <div className="wm-info">
              <div className="wm-info-icon"><MmIcon name="lightning" size={22} /></div>
              <div className="wm-info-body">
                <div className="wm-info-title">
                  {shift.phase === "working" ? "Currently on site"
                  : shift.phase === "wrapped" ? "Shift wrapped"
                  : "Awaiting clock-in"}
                </div>
                {shift.late ? "Worker arrived after their scheduled start time." : "On schedule."}
              </div>
            </div>
          </React.Fragment>
        )}
        {shift.kind === "upcoming" && (
          <React.Fragment>
            <h2 className="wm-detail-title">{shift.title}</h2>
            <div className="wm-detail-org">{shift.org}</div>
            <div className="wm-detail-addr">{shift.time}</div>
            <div className="wm-detail-stats">
              <div className="wm-detail-stat">
                <div className="wm-detail-stat-value">{shift.qty}</div>
                <div className="wm-detail-stat-label">Workers</div>
              </div>
              <div className="wm-detail-stat">
                <div className="wm-detail-stat-value">{shift.dateLabel.replace("Today · ", "").replace("Tomorrow · ", "")}</div>
                <div className="wm-detail-stat-label">Date</div>
              </div>
            </div>
            <div className="wm-info">
              <div className="wm-info-icon"><MmIcon name="users" size={22} /></div>
              <div className="wm-info-body">
                <div className="wm-info-title">Distribution</div>
                {shift.suppliers && shift.suppliers.length > 0 ? shift.suppliers.join(", ") : "Open marketplace"}
              </div>
            </div>
          </React.Fragment>
        )}
        {shift.kind === "open" && (
          <React.Fragment>
            <h2 className="wm-detail-title">{shift.title}</h2>
            <div className="wm-detail-org">{shift.org}</div>
            <div className="wm-detail-addr">{shift.time} · {shift.date}</div>
            <div className="wm-detail-stats wm-detail-stats--three">
              <div className="wm-detail-stat">
                <div className="wm-detail-stat-value">{shift.qty}</div>
                <div className="wm-detail-stat-label">Needed</div>
              </div>
              <div className="wm-detail-stat">
                <div className="wm-detail-stat-value">{shift.confirmed}</div>
                <div className="wm-detail-stat-label">Confirmed</div>
              </div>
              <div className="wm-detail-stat">
                <div className="wm-detail-stat-value">{Math.max(0, shift.qty - shift.confirmed)}</div>
                <div className="wm-detail-stat-label">Open</div>
              </div>
            </div>
            <div className="wm-info">
              <div className="wm-info-icon"><MmIcon name="users" size={22} /></div>
              <div className="wm-info-body">
                <div className="wm-info-title">Distribution</div>
                {shift.suppliers && shift.suppliers.length > 0 ? shift.suppliers.join(", ") : "Open marketplace"}
              </div>
            </div>
            {shift.amount && (
              <div className="wm-info">
                <div className="wm-info-icon"><MmIcon name="dollar" size={22} /></div>
                <div className="wm-info-body">
                  <div className="wm-info-title">Estimated bill</div>
                  {shift.amount}
                </div>
              </div>
            )}
          </React.Fragment>
        )}
        {shift.kind === "past" && (
          <React.Fragment>
            <h2 className="wm-detail-title">{shift.worker}</h2>
            <div className="wm-detail-org">{shift.title}</div>
            <div className="wm-detail-addr">{shift.supplier} · {shift.booking}</div>
            <div className="wm-banner">
              <div className="wm-banner-title">Shift closed</div>
              Timesheet approved and invoiced.
            </div>
            <div className="wm-detail-stats wm-detail-stats--three">
              <div className="wm-detail-stat">
                <div className="wm-detail-stat-value">{shift.hours.toFixed(2)}</div>
                <div className="wm-detail-stat-label">Hours</div>
              </div>
              <div className="wm-detail-stat">
                <div className="wm-detail-stat-value">{shift.actualStart}</div>
                <div className="wm-detail-stat-label">Clock in</div>
              </div>
              <div className="wm-detail-stat">
                <div className="wm-detail-stat-value">{shift.actualEnd}</div>
                <div className="wm-detail-stat-label">Clock out</div>
              </div>
            </div>
            <div className="wm-info">
              <div className="wm-info-icon"><MmIcon name="dollar" size={22} /></div>
              <div className="wm-info-body">
                <div className="wm-info-title">{_mm$(shift.amount)}</div>
                Billed at {_mm$(_mmRateFor(shift.title))}/hr
              </div>
            </div>
          </React.Fragment>
        )}

        <div style={{ height: 110 }} />
      </div>
      <div className="wm-action-bar">
        {shift.kind === "today" && (
          <React.Fragment>
            <button type="button" className="wm-btn wm-btn--ghost" onClick={onCallSupplier}>
              <MmIcon name="phone" size={16} /> Supplier
            </button>
            <button type="button" className="wm-btn" onClick={onMessage}>
              <MmIcon name="chat" size={16} /> Message worker
            </button>
          </React.Fragment>
        )}
        {shift.kind === "open" && (
          <React.Fragment>
            <button type="button" className="wm-btn wm-btn--ghost" onClick={onCallSupplier}>
              <MmIcon name="send" size={16} /> Re-broadcast
            </button>
            <button type="button" className="wm-btn" onClick={onMarkFilled}>Mark filled</button>
          </React.Fragment>
        )}
        {shift.kind === "upcoming" && (
          <button type="button" className="wm-btn wm-btn--block" onClick={onCallSupplier}>
            <MmIcon name="send" size={16} /> Notify team
          </button>
        )}
        {shift.kind === "past" && (
          <button type="button" className="wm-btn wm-btn--ghost wm-btn--block" onClick={onCallSupplier}>
            View invoice
          </button>
        )}
      </div>
    </React.Fragment>
  );
}

// =====================================================================
// MORE — profile + nav rows
// =====================================================================
function MmMoreScreen({ manager, onSignOut, onHelp, onOpenPanel }) {
  const pal = _mmPaletteFor(manager.id);
  const rows = [
    { id: "locations", icon: "pin",    label: "My locations",   sub: `${(manager.sites || []).length} sites` },
    { id: "team",      icon: "users",  label: "My team" },
    { id: "reports",   icon: "report", label: "Reports" },
    { id: "settings",  icon: "settings", label: "Settings" },
    { id: "help",      icon: "help",   label: "Help & support" },
  ];
  return (
    <React.Fragment>
      <MmHeader title="More" onHelp={onHelp} />
      <div className="wm-scroll">
        <div className="mm-profile-card">
          <span className="mm-profile-avatar" style={{ background: pal.bg, color: pal.fg }}>
            {_mmInitialsFor(manager.name)}
          </span>
          <div className="mm-profile-body">
            <div className="mm-profile-name">{manager.name}</div>
            <div className="mm-profile-title">{manager.title || "Operations Manager"}</div>
          </div>
        </div>

        {manager.sites && manager.sites.length > 0 && (
          <React.Fragment>
            <div className="wm-section-title">My locations</div>
            <div className="mm-sites">
              {manager.sites.map((s) => (
                <div key={s} className="mm-site-row">
                  <span className="mm-site-icon"><MmIcon name="pin" size={16} /></span>
                  {s}
                </div>
              ))}
            </div>
          </React.Fragment>
        )}

        <div className="wm-section-title">Tools</div>
        <div className="mm-rows">
          {rows.map((r) => (
            <button key={r.id} type="button" className="mm-row" onClick={() => onOpenPanel && onOpenPanel(r.id)}>
              <span className="mm-row-icon"><MmIcon name={r.icon} size={18} /></span>
              <span className="mm-row-body">
                <span className="mm-row-label">{r.label}</span>
                {r.sub && <span className="mm-row-sub">{r.sub}</span>}
              </span>
              <MmIcon name="chevron-r" size={16} />
            </button>
          ))}
        </div>

        <div style={{ padding: "12px 20px 24px" }}>
          <button type="button" className="wm-btn wm-btn--ghost mm-signout" onClick={onSignOut}>
            <MmIcon name="logout" size={16} /> Sign out of preview
          </button>
        </div>
      </div>
    </React.Fragment>
  );
}

// =====================================================================
// MAIN APP
// =====================================================================
function ManagerMobileApp({ onExit }) {
  const managerPool = _mmMemo(() => _mmGetManagerPool(), []);
  const [activeManager, setActiveManager] = _mmState(() => _mmDefaultManager(managerPool));
  const [pickerOpen, setPickerOpen] = _mmState(false);
  const [pickerQuery, setPickerQuery] = _mmState("");
  const pickerRef = _mmRef(null);
  const pickerSearchRef = _mmRef(null);
  _mmEffect(() => {
    if (!pickerOpen) return undefined;
    const t = setTimeout(() => pickerSearchRef.current && pickerSearchRef.current.focus(), 30);
    const onDoc = (e) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target)) setPickerOpen(false);
    };
    const onKey = (e) => { if (e.key === "Escape") setPickerOpen(false); };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(t);
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [pickerOpen]);
  const filteredManagers = _mmMemo(() => {
    const q = pickerQuery.trim().toLowerCase();
    if (!q) return managerPool;
    return managerPool.filter((m) => {
      if (m.name.toLowerCase().includes(q)) return true;
      if ((m.sites || []).some((s) => s.toLowerCase().includes(q))) return true;
      return false;
    });
  }, [pickerQuery, managerPool]);
  const activePalette = _mmPaletteFor(activeManager.id);

  // Today + data derivations recompute when the page first loads. The
  // demo dataset is static within a session so this doesn't need to be
  // reactive.
  const today = _mmToday();
  const [shifts, setShifts] = _mmState(() => _mmBuildShifts());
  const [approvals, setApprovals] = _mmState(() => _mmBuildApprovals());

  const [tab, setTab] = _mmState("home");
  const [shiftsTab, setShiftsTab] = _mmState("today");
  const [stack, setStack] = _mmState([]); // [{kind: "shift"|"approval", id}]
  const top = stack[stack.length - 1] || null;
  const push = (s) => setStack((st) => [...st, s]);
  const pop  = () => setStack((st) => st.slice(0, -1));

  const [notifOpen, setNotifOpen] = _mmState(false);
  const [toast, setToast] = _mmState(null);
  _mmEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4200);
    return () => clearTimeout(t);
  }, [toast]);

  // Welcome toast — primes the demo with a "what needs you" callout
  // sourced from the live approvals / triage lists.
  _mmEffect(() => {
    if (approvals.length > 0) {
      const a = approvals[0];
      setToast({ app: "Flex Work · Manager", title: "Awaiting your approval", msg: `${a.worker} · ${a.role} · ${_mm$(a.amount)}` });
    } else if (shifts.open.find((s) => s.risk === "crit")) {
      const o = shifts.open.find((s) => s.risk === "crit");
      setToast({ app: "Flex Work · Manager", title: "Shift at risk", msg: `${o.title} · ${o.org} · ${o.confirmed}/${o.qty} confirmed` });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeManager.id]);

  const atRiskCount = shifts.open.filter((s) => s.risk !== "ok").length;

  const onOpenShift = (s, fromSub) => {
    setShiftsTab(fromSub === "today" ? "today" : fromSub === "open" ? "open" : fromSub === "past" ? "past" : fromSub === "upcoming" ? "upcoming" : shiftsTab);
    push({ kind: "shift", shift: s });
  };
  const onOpenApproval = (id) => push({ kind: "approval", id });

  const onApprove = (id) => {
    setApprovals((arr) => arr.filter((a) => a.id !== id));
    pop();
    setToast({ app: "Flex Work · Manager", title: "Timesheet approved", msg: "Hours sent to invoicing." });
  };
  const onSendBack = (id) => {
    setApprovals((arr) => arr.filter((a) => a.id !== id));
    pop();
    setToast({ app: "Flex Work · Manager", title: "Sent back to worker", msg: "They've been notified to update their hours." });
  };
  const onApproveAll = () => {
    const n = approvals.length;
    setApprovals([]);
    setToast({ app: "Flex Work · Manager", title: `Approved ${n} timesheets`, msg: "All hours forwarded to invoicing." });
  };
  const onMarkFilled = (shift) => {
    setShifts((st) => ({
      ...st,
      open: st.open.map((o) => o.id === shift.id ? { ...o, confirmed: o.qty, risk: "ok", filled: true } : o),
    }));
    pop();
    setToast({ app: "Flex Work · Manager", title: "Shift marked filled", msg: `${shift.title} · ${shift.org}` });
  };
  const onPostShift = () => {
    setToast({ app: "Flex Work · Manager", title: "Post a shift", msg: "Open the desktop Requisitions page to create a new shift." });
  };
  const onCallSupplier = () => {
    setToast({ app: "Flex Work · Manager", title: "Connecting…", msg: "Calling your supplier dispatch." });
  };
  const onMessage = () => {
    setToast({ app: "Flex Work · Manager", title: "Message sent", msg: "Worker will see your note on their phone." });
  };
  const onPickManager = (m) => {
    setActiveManager(m);
    setPickerOpen(false);
    setPickerQuery("");
    setStack([]);
    setTab("home");
    setToast({ app: "Flex Work · Manager", title: "Switched manager", msg: `Previewing as ${m.name}` });
  };

  // ---------- Choose body ----------
  let body;
  if (top && top.kind === "approval") {
    const a = approvals.find((x) => x.id === top.id);
    if (a) body = <MmApprovalDetail approval={a} onBack={pop} onApprove={() => onApprove(a.id)} onSendBack={() => onSendBack(a.id)} />;
    else { pop(); body = null; }
  } else if (top && top.kind === "shift") {
    body = <MmShiftDetail
      shift={top.shift}
      onBack={pop}
      onMessage={onMessage}
      onCallSupplier={onCallSupplier}
      onMarkFilled={() => onMarkFilled(top.shift)}
    />;
  } else if (tab === "home") {
    body = <MmHomeScreen
      manager={activeManager}
      shifts={shifts}
      approvals={approvals}
      atRiskCount={atRiskCount}
      today={today}
      onTabChange={(t) => setTab(t)}
      onOpenShift={(s, sub) => onOpenShift(s, sub)}
      onOpenApproval={onOpenApproval}
      onPostShift={onPostShift}
      onHelp={() => setNotifOpen(true)}
    />;
  } else if (tab === "shifts") {
    body = <MmShiftsScreen
      subTab={shiftsTab}
      shifts={shifts}
      onSubTab={setShiftsTab}
      onOpenShift={onOpenShift}
      onPostShift={onPostShift}
      onHelp={() => setNotifOpen(true)}
    />;
  } else if (tab === "approvals") {
    body = <MmApprovalsScreen
      approvals={approvals}
      onOpenApproval={onOpenApproval}
      onApproveAll={onApproveAll}
      onHelp={() => setNotifOpen(true)}
    />;
  } else {
    body = <MmMoreScreen
      manager={activeManager}
      onSignOut={onExit}
      onHelp={() => setNotifOpen(true)}
      onOpenPanel={(id) => setToast({ app: "Flex Work · Manager", title: id.charAt(0).toUpperCase() + id.slice(1), msg: "Coming soon — open the desktop app to manage this." })}
    />;
  }

  const showTabBar = !top;

  return (
    <div className="wm-stage mm-stage" role="complementary" aria-label="Manager mobile preview">
      <div className="wm-dock-head">
        <div className="wm-dock-picker" ref={pickerRef}>
          <button
            type="button"
            className="wm-dock-chip"
            title="Switch manager"
            aria-haspopup="listbox"
            aria-expanded={pickerOpen}
            onClick={() => setPickerOpen((v) => !v)}
          >
            <span
              className="wm-dock-chip-avatar"
              style={{ background: activePalette.bg, color: activePalette.fg }}
            >
              {_mmInitialsFor(activeManager.name)}
            </span>
            <span>{activeManager.name}</span>
            <MmIcon name="chevron-r" size={14} style={{ transform: pickerOpen ? "rotate(-90deg)" : "rotate(90deg)", transition: "transform 150ms" }} />
          </button>
          {pickerOpen && (
            <div className="wm-dock-picker-pop" role="dialog" aria-label="Switch manager">
              <div className="wm-dock-picker-head">
                <span className="wm-dock-picker-search-icon" aria-hidden="true">
                  <MmIcon name="search" size={16} />
                </span>
                <input
                  ref={pickerSearchRef}
                  className="wm-dock-picker-input"
                  type="text"
                  value={pickerQuery}
                  placeholder="Search managers"
                  onChange={(e) => setPickerQuery(e.target.value)}
                  aria-label="Search managers"
                />
                {pickerQuery && (
                  <button
                    type="button"
                    className="wm-dock-picker-clear"
                    onClick={() => { setPickerQuery(""); pickerSearchRef.current && pickerSearchRef.current.focus(); }}
                    aria-label="Clear search"
                  >
                    <MmIcon name="x" size={14} />
                  </button>
                )}
              </div>
              <div className="wm-dock-picker-meta">
                {filteredManagers.length} of {managerPool.length} {managerPool.length === 1 ? "manager" : "managers"}
              </div>
              <div className="wm-dock-picker-list" role="listbox">
                {filteredManagers.length === 0 ? (
                  <div className="wm-dock-picker-empty">No managers match "{pickerQuery}"</div>
                ) : (
                  filteredManagers.map((m) => {
                    const pal = _mmPaletteFor(m.id);
                    const isActive = m.id === activeManager.id;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        className={`wm-dock-picker-row${isActive ? " wm-dock-picker-row--active" : ""}`}
                        role="option"
                        aria-selected={isActive}
                        onClick={() => onPickManager(m)}
                      >
                        <span className="wm-dock-picker-avatar" style={{ background: pal.bg, color: pal.fg }}>
                          {_mmInitialsFor(m.name)}
                        </span>
                        <span className="wm-dock-picker-body">
                          <span className="wm-dock-picker-name">{m.name}</span>
                          <span className="wm-dock-picker-sub">
                            {m.title || "Operations Manager"}
                            {(m.sites && m.sites[0]) ? ` · ${m.sites[0]}` : ""}
                          </span>
                        </span>
                        {isActive && (
                          <span className="wm-dock-picker-check" aria-hidden="true">
                            <MmIcon name="check" size={14} />
                          </span>
                        )}
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>
        <button type="button" className="wm-dock-close" aria-label="Close manager preview" onClick={onExit}>
          <MmIcon name="x" size={16} />
        </button>
      </div>
      <div className="wm-frame-wrap">
        <IOSDevice width={372} height={770}>
          <div className="wm-app mm-app">
            {toast && (
              <div className="wm-toast" role="status">
                <div className="wm-toast-icon"><MmIcon name="clipboard-check" size={20} /></div>
                <div className="wm-toast-body">
                  <div className="wm-toast-app">{toast.app}</div>
                  <div className="wm-toast-title">{toast.title}</div>
                  <div className="wm-toast-msg">{toast.msg}</div>
                </div>
                <button className="wm-iconbtn wm-iconbtn--bare" onClick={() => setToast(null)} aria-label="Dismiss"><MmIcon name="x" size={16} /></button>
              </div>
            )}
            {notifOpen && (
              <div className="wm-notif-tray">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                  <h3 style={{ font: "var(--evr-h4)", fontFamily: "var(--evr-font-display)" }}>Notifications</h3>
                  <button className="wm-iconbtn" onClick={() => setNotifOpen(false)} aria-label="Close"><MmIcon name="x" size={16} /></button>
                </div>
                {(() => {
                  const items = [];
                  const crit = shifts.open.find((s) => s.risk === "crit");
                  const warn = shifts.open.find((s) => s.risk === "warn");
                  const review = approvals.find((a) => a.status === "Review");
                  const oldest = approvals[approvals.length - 1];
                  const today1 = shifts.todayShifts.find((s) => s.late);
                  if (crit) items.push({ icon: "alert", title: "Critical · shift at risk", text: `${crit.title} · ${crit.org} · ${crit.confirmed}/${crit.qty} confirmed`, time: "20 min" });
                  if (today1) items.push({ icon: "lightning", title: "Worker arrived late", text: `${today1.worker} clocked in at ${today1.actualStart} (sched ${today1.schedStart})`, time: "1 hr" });
                  if (review) items.push({ icon: "clipboard-check", title: "Timesheet disputed", text: `${review.worker} flagged hours on ${review.role}.`, time: "2 hr" });
                  if (warn && !crit) items.push({ icon: "alert", title: "Shift trending at risk", text: `${warn.title} · ${warn.org} · only ${warn.confirmed}/${warn.qty} confirmed.`, time: "3 hr" });
                  if (oldest) items.push({ icon: "clipboard-check", title: "Approval reminder", text: `${oldest.worker}'s timesheet has been waiting since ${oldest.rawDate}.`, time: "Yesterday" });
                  if (items.length === 0) items.push({ icon: "clipboard-check", title: "All caught up", text: "Nothing urgent at your sites right now.", time: "Just now" });
                  return items;
                })().map((n, i) => (
                  <div key={i} className="wm-notif">
                    <div className="wm-notif-icon"><MmIcon name={n.icon} size={18} /></div>
                    <div className="wm-notif-body">
                      <div className="wm-notif-title">{n.title}</div>
                      <div className="wm-notif-text">{n.text}</div>
                      <div className="wm-notif-time">{n.time}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {body}
            {showTabBar && (
              <MmTabBar
                tab={tab}
                onChange={(t) => { setTab(t); setStack([]); }}
                approvalsBadge={approvals.length || undefined}
                atRiskBadge={atRiskCount || undefined}
              />
            )}
          </div>
        </IOSDevice>
      </div>
      <div className="wm-dock-caption">
        Live preview · <b>{activeManager.name}</b> · {approvals.length} {approvals.length === 1 ? "approval" : "approvals"} · {atRiskCount} at risk
      </div>
    </div>
  );
}

Object.assign(window, { ManagerMobileApp });
