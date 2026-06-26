// =====================================================================
// Flex Work — Worker mobile app
//
// Lives inside an iPhone frame, hosted full-screen when viewAsRole is
// switched to "worker". Mirrors the Figma worker-app designs (Home /
// Shifts (Invites/Upcoming/Active/Past) / More) and wires the end-to-
// end click-through: accept invite → confirm → clock in → working →
// break → end shift → summary → Past.
//
// Self-contained — does not depend on the desktop app's data model
// (the worker uses different mental nouns: "shift" not "booking").
// =====================================================================

const { useState: _wmState, useEffect: _wmEffect, useRef: _wmRef, useMemo: _wmMemo } = React;

// ---------- Seeded shift data ------------------------------------------
// IDs match the Figma sample data (Produce Stocker / Warehouse Associate
// / Food Runner / Bartender / Forklift) so the prototype reads naturally
// across screens. Statuses align with the requisition you fulfilled in
// the desktop app: "Cyber Monday — Produce Stocker" is the canonical
// example shift the manager created in the end-to-end flow.

const WM_SEED_SHIFTS = [
  // ---- Invites (a brand-new offer + a backup invite) ----
  {
    id: "s-prod-1", status: "invited", role: "Produce Stocker", org: "EcoGlobal",
    program: "Cyber Monday", address: "200 Greenwich St, New York, NY",
    location: "Oakmont", dateLabel: "Today · Wed, Jul 16",
    dateShort: { m: "Jul", d: "16" }, day: "Wednesday, July 16",
    start: "9:00 AM", end: "5:00 PM", hours: 8, rate: 18, pay: 324.75,
    multiDay: false, breakMin: 30, paidBreak: true,
    perks: ["$40.00 bonus for working 4 shifts", "$50.00 travel stipend"],
    distance: "12 min · 4.3 mi", contact: "Amy Greene (Manager)",
    instructions: "Enter through the staff entrance and ask for your manager Amy. She'll clock you in and give you an orientation.",
    role_desc: "Receive, stock and rotate produce on the sales floor. Maintain freshness, signage and faced-out displays. Light lifting up to 40 lb.",
    what_to_wear: "Non-slip shoes with a closed toe are required. Short sleeves are recommended as it can get quite warm in the warehouse.",
  },
  {
    id: "s-warehouse-1", status: "invited", role: "Warehouse Associate",
    org: "Oakmont", program: "Backup", address: "Oakmont Distribution Center, Newark, NJ",
    location: "Oakmont", dateLabel: "Thu, Jul 17",
    dateShort: { m: "Jul", d: "17" }, day: "Thursday, July 17",
    start: "6:00 AM", end: "3:00 PM", hours: 8.5, rate: 14, pay: 247.38,
    multiDay: false, breakMin: 30, paidBreak: false, backup: true,
    perks: ["Free coffee + breakfast on shift"],
    distance: "32 min · 18.2 mi", contact: "Marcus Webb (Lead)",
    instructions: "Park in lot C. Bring photo ID. Steel-toe boots required.",
    role_desc: "Pick, pack and ship inbound and outbound orders using RF scanners.",
    what_to_wear: "Steel-toe boots, hi-viz vest provided on site.",
  },
  // ---- Upcoming (confirmed, scheduled for the future) ----
  {
    id: "s-bartender-1", status: "upcoming", role: "Bartender",
    org: "Aurora Hotel · Sky Lounge", program: "Rooftop weekend",
    address: "300 W 23rd St, New York, NY",
    location: "Sky Lounge", dateLabel: "Fri, Jul 18",
    dateShort: { m: "Jul", d: "18" }, day: "Friday, July 18",
    start: "5:00 PM", end: "11:00 PM", hours: 6, rate: 22, pay: 134.78,
    multiDay: false, breakMin: 30, paidBreak: true,
    perks: ["Staff meal provided"],
    distance: "20 min · 5.1 mi", contact: "Jordan Lee (Floor Manager)",
    instructions: "Service entrance on 23rd. Take freight elevator to 14R.",
    role_desc: "Craft cocktails and serve guests. NY food-handler card required.",
    what_to_wear: "All-black uniform: button-up shirt, slacks, non-slip shoes.",
  },
  // ---- Past ----
  {
    id: "s-food-1", status: "completed", role: "Food Runner",
    org: "Silverpine Hospitality", program: "Catering",
    address: "55 Hudson Yards, New York, NY",
    location: "Hudson Yards", dateLabel: "Mon, Jul 14",
    dateShort: { m: "Jul", d: "14" }, day: "Monday, July 14",
    start: "8:00 AM", end: "4:00 PM", hours: 8, rate: 17, pay: 134.00,
    breakMin: 30, paidBreak: false, clockedIn: "7:58 AM", clockedOut: "4:03 PM",
    perks: [], rating: 5, paid: true, paidAmount: "$120.65",
  },
  {
    id: "s-forklift-1", status: "completed", role: "Forklift Operator",
    org: "Atlas Logistics", program: "Cyber Monday",
    address: "4500 Liberty Ave, Newark, NJ",
    location: "DC-7", dateLabel: "Sun, Jul 13",
    dateShort: { m: "Jul", d: "13" }, day: "Sunday, July 13",
    start: "6:00 AM", end: "2:00 PM", hours: 8, rate: 21, pay: 168.00,
    breakMin: 30, paidBreak: false, clockedIn: "5:55 AM", clockedOut: "2:02 PM",
    perks: [], rating: 4, paid: true, paidAmount: "$151.20",
  },
];

// =====================================================================
// Inline SVG icons that aren't in the Everest set (Mail, Coffee, Pause,
// Play, Star, Lightning, Map-pin) so the worker app can stay close to
// the Figma design without depending on external assets.
// =====================================================================
function WmIcon({ name, size = 24, style = {} }) {
  const common = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", style };
  switch (name) {
    case "mail":
      return (<svg {...common}><path d="M4 6.5A1.5 1.5 0 0 1 5.5 5h13A1.5 1.5 0 0 1 20 6.5v11A1.5 1.5 0 0 1 18.5 19h-13A1.5 1.5 0 0 1 4 17.5v-11Z" stroke="currentColor" strokeWidth="1.7"/><path d="m5 7 7 6 7-6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/></svg>);
    case "cal-check":
      return (<svg {...common}><rect x="3.5" y="5.5" width="17" height="15" rx="2.5" stroke="currentColor" strokeWidth="1.7"/><path d="M8 3v4M16 3v4M3.5 10h17" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/><path d="m9 15.5 2 2 4-4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/></svg>);
    case "lightning":
      return (<svg {...common}><path d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z" fill="currentColor"/></svg>);
    case "time-back":
      return (<svg {...common}><path d="M12 6V3L7 7.5 12 12V9a5.5 5.5 0 1 1-5.5 5.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/><path d="M12 9v3.5l3 2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/></svg>);
    case "home":
      return (<svg {...common}><path d="M3.5 11.5 12 4l8.5 7.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/><path d="M5.5 10.5V19a1 1 0 0 0 1 1H10v-5a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v5h3.5a1 1 0 0 0 1-1v-8.5" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round"/></svg>);
    case "briefcase":
      return (<svg {...common}><rect x="3.5" y="7.5" width="17" height="12" rx="2" stroke="currentColor" strokeWidth="1.7"/><path d="M9 7.5V6a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v1.5M3.5 12.5h17" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/></svg>);
    case "grid":
      return (<svg {...common}><rect x="4" y="4" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.7"/><rect x="13" y="4" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.7"/><rect x="4" y="13" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.7"/><rect x="13" y="13" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.7"/></svg>);
    case "play":
      return (<svg {...common}><path d="M8 5v14l11-7L8 5Z" fill="currentColor"/></svg>);
    case "pause":
      return (<svg {...common}><rect x="6" y="5" width="4" height="14" rx="1" fill="currentColor"/><rect x="14" y="5" width="4" height="14" rx="1" fill="currentColor"/></svg>);
    case "stop":
      return (<svg {...common}><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.7"/><rect x="9" y="9" width="6" height="6" rx="1" fill="currentColor"/></svg>);
    case "coffee":
      return (<svg {...common}><path d="M4 9h12v6a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4V9Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round"/><path d="M16 11h2.5A2.5 2.5 0 0 1 21 13.5v0A2.5 2.5 0 0 1 18.5 16H16" stroke="currentColor" strokeWidth="1.7"/><path d="M7 6c0-1 1-1 1-2M11 6c0-1 1-1 1-2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/></svg>);
    case "star":
      return (<svg {...common}><path d="m12 3 2.65 5.95 6.35.55-4.75 4.45 1.4 6.55L12 17.8 6.35 20.5l1.4-6.55L3 9.5l6.35-.55L12 3Z" fill="currentColor"/></svg>);
    case "star-outline":
      return (<svg {...common}><path d="m12 3 2.65 5.95 6.35.55-4.75 4.45 1.4 6.55L12 17.8 6.35 20.5l1.4-6.55L3 9.5l6.35-.55L12 3Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/></svg>);
    case "more":
      return (<svg {...common}><circle cx="5.5"  cy="12" r="1.6" fill="currentColor"/><circle cx="12"   cy="12" r="1.6" fill="currentColor"/><circle cx="18.5" cy="12" r="1.6" fill="currentColor"/></svg>);
    case "chevron-l":
      return (<svg {...common}><path d="m14 5-7 7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>);
    case "chevron-r":
      return (<svg {...common}><path d="m10 5 7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>);
    case "phone":
      return (<svg {...common}><path d="M5 3h3l2 5-2.5 1.5a11 11 0 0 0 5 5L14 12l5 2v3a2 2 0 0 1-2 2A14 14 0 0 1 3 5a2 2 0 0 1 2-2Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round"/></svg>);
    case "chat":
      return (<svg {...common}><path d="M4 5.5A1.5 1.5 0 0 1 5.5 4h11A1.5 1.5 0 0 1 18 5.5v8A1.5 1.5 0 0 1 16.5 15H10l-4 4v-4H5.5A1.5 1.5 0 0 1 4 13.5v-8Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round"/></svg>);
    case "qr":
      return (<svg {...common}><rect x="3" y="3" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.7"/><rect x="14" y="3" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.7"/><rect x="3" y="14" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.7"/><rect x="14" y="14" width="3" height="3" fill="currentColor"/><rect x="18" y="14" width="3" height="3" fill="currentColor"/><rect x="14" y="18" width="3" height="3" fill="currentColor"/></svg>);
    case "calendar-plus":
      return (<svg {...common}><rect x="3.5" y="5.5" width="17" height="15" rx="2.5" stroke="currentColor" strokeWidth="1.7"/><path d="M8 3v4M16 3v4M3.5 10h17M12 13v5M9.5 15.5h5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/></svg>);
    case "x-circle":
      return (<svg {...common}><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.7"/><path d="m9 9 6 6m0-6-6 6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/></svg>);
    case "x":
      return (<svg {...common}><path d="m6 6 12 12M6 18 18 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>);
    case "help":
      return (<svg {...common}><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.7"/><path d="M9.5 9a2.5 2.5 0 0 1 5 0c0 1.5-2 1.7-2.5 3v.5M12 16.5v.1" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/></svg>);
    case "sparkle":
      return (<svg {...common}><path d="M12 3v6m0 6v6M3 12h6m6 0h6m-12-7 4 4M15 15l4 4M5 19l4-4m6-6 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>);
    case "pin":
      return (<svg {...common}><path d="M12 21s7-6.5 7-12a7 7 0 1 0-14 0c0 5.5 7 12 7 12Z" fill="currentColor"/><circle cx="12" cy="9" r="2.5" fill="#fff"/></svg>);
    case "edit":
      return (<svg {...common}><path d="M4 20h4l9.5-9.5-4-4L4 16v4Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round"/><path d="m13 6 4 4" stroke="currentColor" strokeWidth="1.7"/></svg>);
    case "cal-add":
      return (<svg {...common}><rect x="3.5" y="5.5" width="17" height="15" rx="2.5" stroke="currentColor" strokeWidth="1.7"/><path d="M8 3v4M16 3v4M3.5 10h17M12 13v5M9.5 15.5h5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/></svg>);
    case "footprints":
      return (<svg {...common} viewBox="0 0 16 16"><path d="M4.5 2.5c.8 0 1.4.8 1.3 2-.1 1-.6 1.6-1.4 1.6S3 5.4 3.1 4.4c.1-1.2.7-1.9 1.4-1.9Zm0 5.3c.6 0 1 .4.9 1l-.2 1.4c-.1.5-.4.8-.9.8s-.8-.3-.9-.8L3.2 8.9c-.1-.7.4-1.1.9-1.1ZM11 6c.7 0 1.3.8 1.2 1.9-.1 1-.6 1.6-1.4 1.6s-1.3-.7-1.2-1.7c.1-1.2.7-1.8 1.4-1.8Zm0 5.3c.6 0 1 .4.9 1l-.2 1.4c-.1.5-.4.8-.9.8s-.8-.3-.9-.8l-.2-1.4c0-.6.4-1 .9-1Z" fill="currentColor"/></svg>);
    case "badge":
      return (<svg {...common}><rect x="4.5" y="6" width="15" height="13" rx="2" stroke="currentColor" strokeWidth="1.7"/><path d="M9 4.5h6a1 1 0 0 1 1 1V7H8V5.5a1 1 0 0 1 1-1Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round"/><circle cx="12" cy="11.5" r="2" stroke="currentColor" strokeWidth="1.7"/><path d="M9 16.5c.6-1.2 1.8-2 3-2s2.4.8 3 2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/></svg>);
    case "face-scan":
      return (<svg {...common}><path d="M4 8V6a2 2 0 0 1 2-2h2M20 8V6a2 2 0 0 0-2-2h-2M4 16v2a2 2 0 0 0 2 2h2M20 16v2a2 2 0 0 1-2 2h-2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/><circle cx="9.5" cy="11" r="0.7" fill="currentColor"/><circle cx="14.5" cy="11" r="0.7" fill="currentColor"/><path d="M9.5 14.5c.7.7 1.6 1 2.5 1s1.8-.3 2.5-1" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>);
    case "handshake":
      return (<svg {...common}><path d="M3 13v-2l4-5 3 1 2-1 2 1 3-1 4 5v2l-4 4-3-1-2 1-2-1-3 1-4-4Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/><path d="M9 11l3 2 3-2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>);
    case "check-circle":
      return (<svg {...common}><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.7"/><path d="m8 12 2.5 2.5L16 9" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/></svg>);
    default:
      return null;
  }
}

// =====================================================================
// Tiny shared sub-components
// =====================================================================

function WmHeader({ title, rightAvatar = true, onBack, onHelp, dark = false }) {
  return (
    <div className="wm-header" style={dark ? { color: "#fff" } : null}>
      {onBack ? (
        <button className="wm-iconbtn wm-iconbtn--bare" onClick={onBack} aria-label="Back">
          <WmIcon name="chevron-l" size={26} />
        </button>
      ) : (
        <h1>{title}</h1>
      )}
      <div className="wm-header-r">
        {onHelp && (
          <button className="wm-iconbtn" onClick={onHelp} aria-label="Get help">
            <WmIcon name="help" size={20} />
          </button>
        )}
        {rightAvatar && <span className="wm-avatar">MJ</span>}
      </div>
    </div>
  );
}

function WmTabBar({ tab, onChange, invitesBadge, activeBadge, onboarding }) {
  // Lifecycle tab \u2014 surfaces an Onboarding / Offboarding entry as
  // the first item when the active worker is in a transitional
  // lifecycle state AND their lifecycle is buyer-owned (Pro engagement
  // or direct-sourced Frontline). Agency-sourced Frontline workers
  // never see this tab (their onboarding belongs to the agency).
  const items = [
    ...(onboarding ? [{ id: "onboarding", label: onboarding.label, icon: "mail", badge: onboarding.badge }] : []),
    { id: "home",   label: "Home",   icon: "home" },
    { id: "shifts", label: "Shifts", icon: "briefcase", badge: invitesBadge || activeBadge },
    { id: "more",   label: "More",   icon: "grid" },
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
          <WmIcon name={it.icon} size={24} />
          <span className="wm-tabbar-item-label">{it.label}</span>
        </button>
      ))}
    </div>
  );
}

function WmSubTabs({ tab, onChange, badges = {} }) {
  const items = [
    { id: "invites",  label: "Invites",  icon: "mail" },
    { id: "upcoming", label: "Upcoming", icon: "cal-check" },
    { id: "active",   label: "Active",   icon: "lightning" },
    { id: "past",     label: "Past",     icon: "time-back" },
  ];
  return (
    <div className="wm-subtabs" role="tablist">
      {items.map((it) => (
        <button
          key={it.id}
          type="button"
          role="tab"
          aria-selected={tab === it.id}
          className={`wm-subtab${tab === it.id ? " wm-subtab--active" : ""}`}
          onClick={() => onChange(it.id)}
        >
          <span className="wm-subtab-icon"><WmIcon name={it.icon} size={20} /></span>
          <span className="wm-subtab-label">{it.label}</span>
          {badges[it.id] ? <span className="wm-subtab-badge">{badges[it.id]}</span> : null}
        </button>
      ))}
    </div>
  );
}

// Pretty money formatter — keeps decimals.
function _wm$(n) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

// =====================================================================
// ONBOARDING / OFFBOARDING SCREEN \u2014 the buyer-owned lifecycle tab.
// Reads its task catalog from the Lifecycle program card in
// Settings\u2192Configuration so a single admin edit updates every
// surface (this tab, the OnboardingTracker accordion on workforce.jsx,
// and the professional-onboard panel) together.
//
// Visible when activeWorker.status \u2208 {Onboarding, Offboarding} and
// the worker has a buyer-owned lifecycle (direct-sourced Frontline or
// Professional). Agency-sourced workers never see this tab; the screen
// returns null defensively so the tab bar guard is the source of truth.
// =====================================================================
function _wmLifecycleKind(worker) {
  if (!worker) return null;
  if (worker.pool === "Contractor") return null;
  if (worker._professionalRow || worker.pool === "Professional" || worker.engagementType) return "pro";
  if (worker.pool === "Agency" || worker.pool === "EOR") return null;
  return "frontline";
}
function _wmLifecycleSlot(worker) {
  if (!worker) return null;
  if (worker.status === "Onboarding") return "onboarding";
  if (worker.status === "Offboarding" || worker.status === "Inactive" || worker.status === "Terminated") return "offboarding";
  return null;
}
function _wmLifecycleProgress(worker, list) {
  // Same hash-based projection the workforce.jsx tracker uses, kept
  // in-file so worker-mobile doesn't need to import from there.
  const isOnb = worker.status === "Onboarding";
  const isOff = worker.status === "Offboarding";
  return list.map((t, i) => {
    let state = "pending";
    if (worker.status === "Compliant" || worker.status === "Inactive" || worker.status === "Terminated") state = "done";
    else if (isOnb) {
      const seed = (worker.id + t.id).split("").reduce((a, c) => a + c.charCodeAt(0), 0);
      state = seed % 5 === 0 ? "blocked" : seed % 3 === 0 ? "progress" : i < Math.round(list.length * 0.6) ? "done" : "pending";
    } else if (isOff) {
      state = i < Math.round(list.length * 0.3) ? "done" : i < Math.round(list.length * 0.5) ? "progress" : "pending";
    }
    return { ...t, state };
  });
}
function WmOnboardingScreen({ worker, onHelp, onTabChange }) {
  const kind = _wmLifecycleKind(worker);
  const slot = _wmLifecycleSlot(worker);
  if (!kind || !slot) return null;
  const catalog = slot === "offboarding"
    ? (window.getOffboardingTasksForWorker ? window.getOffboardingTasksForWorker(worker) : (window.getOffboardingTasks ? window.getOffboardingTasks(kind) : []))
    : (window.getOnboardingTasksForWorker  ? window.getOnboardingTasksForWorker(worker)  : (window.getOnboardingTasks  ? window.getOnboardingTasks(kind)  : []));
  // Worker-side filter \u2014 the worker only sees tasks they own. Employer
  // tasks (asset provisioning, SSO setup) are invisible here; the
  // manager sees them on the OnboardingTracker accordion.
  const mine = catalog.filter((t) => t.owner === "worker" || t.owner === "shared");
  const rows = _wmLifecycleProgress(worker, mine);
  const done = rows.filter((r) => r.state === "done").length;
  const pct  = rows.length ? Math.round((done / rows.length) * 100) : 0;
  const isOff = slot === "offboarding";
  const onTap = (r) => {
    if (r.state === "done") {
      setTimeout(() => onTabChange && onTabChange("home"), 0);
      if (window.showToast) window.showToast(`${r.label} \u00b7 complete`, { kind: "success" });
      return;
    }
    if (window.showToast) window.showToast(`Opening ${r.label}\u2026`);
  };
  return (
    <React.Fragment>
      <WmHeader title={isOff ? "Offboarding" : "Onboarding"} onHelp={onHelp} />
      <div className="wm-scroll">
        <div className="wmlc">
          <section className={"wmlc-hero" + (isOff ? " wmlc-hero--off" : "")}>
            <span className="wmlc-hero-eyebrow">
              {kind === "pro" ? "Professional engagement" : "Joined Up direct sourcing"}
            </span>
            <h2 className="wmlc-hero-h">
              {isOff
                ? `Let's wrap up, ${(worker.name || "").split(" ")[0]}.`
                : (pct === 100
                  ? `You're all set, ${(worker.name || "").split(" ")[0]}.`
                  : `Welcome aboard, ${(worker.name || "").split(" ")[0]}.`)}
            </h2>
            <p className="wmlc-hero-sub">
              {isOff
                ? "A few last steps before your final paycheck closes. The app will sign you out once everything is acknowledged."
                : (pct === 100
                  ? "All onboarding tasks complete. You can pick up shifts from the Home tab."
                  : "Knock out these tasks to start picking up shifts. Tap any item to open it.")}
            </p>
            <div className="wmlc-hero-progress">
              <div className="wmlc-hero-progress-fill" style={{ width: pct + "%" }} />
            </div>
            <div className="wmlc-hero-meta">
              <span>{done} of {rows.length} complete</span>
              <span>{pct}%</span>
            </div>
          </section>

          <div className="wmlc-group-title">{isOff ? "What you need to do" : "Your tasks"}</div>
          <ul className="wmlc-tasks" role="list">
            {rows.map((r) => (
              <li key={r.id}>
                <button type="button" className={"wmlc-task wmlc-task--" + r.state} onClick={() => onTap(r)}>
                  <span className="wmlc-task-icon">
                    {r.state === "done"     ? <WmIcon name="cal-check" size={18} />
                    : r.state === "blocked" ? <WmIcon name="mail" size={18} />
                    : r.state === "progress" ? <WmIcon name="lightning" size={18} />
                    : <WmIcon name="chevron-r" size={18} />}
                  </span>
                  <span className="wmlc-task-body">
                    <span className="wmlc-task-name">{r.label}</span>
                    <span className="wmlc-task-desc">{r.desc} \u00b7 Due in {r.due}d</span>
                  </span>
                  <span className="wmlc-task-cta">
                    {r.state === "done"     ? "Done"
                    : r.state === "blocked" ? "Action needed"
                    : r.state === "progress" ? "In review"
                    : "Start"}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </React.Fragment>
  );
}

function WmShiftCard({ shift, onOpen }) {
  const subTag = shift.multiDay ? "Multi-day · 4 shifts" : (shift.backup ? "Backup" : null);
  return (
    <button type="button" className="wm-card" onClick={onOpen}>
      <div className="wm-card-title">{shift.role}</div>
      <div className="wm-card-time">{shift.start} – {shift.end}</div>
      <div className="wm-card-org">{shift.org}</div>
      {subTag && (
        <div className="wm-card-pill-row">
          <span className="wm-pill">{subTag}</span>
        </div>
      )}
      <div className="wm-card-pay">
        <div className="wm-card-pay-big">{_wm$(shift.pay)}</div>
        <div className="wm-card-pay-sub">{_wm$(shift.rate)}/hr · Before taxes and deductions</div>
      </div>
    </button>
  );
}

// =====================================================================
// HOME
// =====================================================================
function WmHomeScreen({ shifts, onOpenShift, onTabChange, julyTotal, onHelp, activeWorker }) {
  const invites  = shifts.filter((s) => s.status === "invited");
  const upcoming = shifts.filter((s) => s.status === "upcoming" || s.status === "active");
  return (
    <React.Fragment>
      <WmHeader title="Home" onHelp={onHelp} />
      <div className="wm-scroll">
        {/* Inbound shift offers — buyer-initiated requests routed through
            the assignment engine. The worker accepts or declines; JoinedUp
            offer/confirm loop that cuts no-shows. */}
        {(() => {
          if (!window.AssignmentEngine) return null;
          const wid = (activeWorker && activeWorker.id) || "";
          const offers = window.AssignmentEngine.pendingOffersForWorker(wid);
          // Demo fallback: if no offer targets this exact worker id, show
          // any pending offers so the loop is always demonstrable.
          const list = offers.length ? offers : window.AssignmentEngine.pendingOffersForWorker(null);
          if (!list.length) return null;
          const respond = (id, ok) => {
            window.AssignmentEngine.respondOffer(id, ok);
            onTabChange && onTabChange("home");
          };
          return (
            <div className="wm-offers">
              <div className="wm-section-title" style={{ paddingLeft: 0 }}>Shift offers</div>
              {list.slice(0, 3).map((o) => (
                <div key={o.id} className="wm-offer-card">
                  <div className="wm-offer-main">
                    <div className="wm-offer-role">{o.role || "Shift"}</div>
                    <div className="wm-offer-sub">{o.day ? o.day + " · " : ""}{(window.REQ_SUPPLIERS || {})[o.supplierId]?.label || "Agency request"}</div>
                  </div>
                  <div className="wm-offer-actions">
                    <button type="button" className="wm-btn wm-btn--ghost" onClick={() => respond(o.id, false)}>Decline</button>
                    <button type="button" className="wm-btn wm-btn--primary" onClick={() => respond(o.id, true)}>Accept</button>
                  </div>
                </div>
              ))}
            </div>
          );
        })()}
        {/* v0.88 — SOW assignment card. Visible only when the worker
              has an active SOW assignment AND the SOW engagement type
              is on. Opens a full-screen assignment detail overlay. */}
        {window.SowWorkerMobile && <window.SowWorkerMobile />}
        {/* v0.88 — Project assignment card. Visible only when the worker
              has an active Project assignment AND the Project engagement
              type is on. Taps through to the More → Projects panel. */}
        {(() => {
          if (!(window.PSProjects && window.PSProjects.isProjectOn())) return null;
          const projects = window.PSProjects.getProjects() || [];
          const firstName = ((activeWorker && activeWorker.name) || "").split(/\s+/)[0].toLowerCase();
          const mine = projects.filter((p) => (p.roster || []).some((r) =>
            r.name && r.name.split(/\s+/)[0].toLowerCase() === firstName));
          if (mine.length === 0) return null;
          return (
            <button type="button" className="wm-proj-banner" onClick={() => onTabChange("more")}>
              <div className="wm-proj-banner-h">
                <span className="wm-proj-banner-pill">{mine.length} project assignment{mine.length === 1 ? "" : "s"}</span>
                <span className="wm-proj-banner-arrow">→</span>
              </div>
              <div className="wm-proj-banner-name">{mine[0].name}</div>
              <div className="wm-proj-banner-sub">
                {(mine[0].roster.find((r) => r.name.split(/\s+/)[0].toLowerCase() === firstName) || {}).role}
                {mine.length > 1 ? ` + ${mine.length - 1} more` : ""}
              </div>
            </button>
          );
        })()}
        <div className="wm-section-title">July earnings</div>
        <div className="wm-earnings" role="button" tabIndex={0} onClick={() => onTabChange("more")}>
          <div className="wm-earnings-amount">{_wm$(julyTotal)}</div>
          <div className="wm-earnings-sub">Before taxes and deductions</div>
        </div>

        <div className="wm-section-title">Shift invites</div>
        {invites.length === 0 ? (
          <div className="wm-empty">
            <div className="wm-empty-icon"><WmIcon name="mail" size={22} /></div>
            <h3>No shift invites…yet!</h3>
            <p>Add skills and adjust your preferences to get matched with more shifts.</p>
            <button type="button" className="wm-btn wm-btn--ghost" onClick={() => onTabChange("more")}>Add skills</button>
          </div>
        ) : (
          invites.slice(0, 2).map((s) => <WmShiftCard key={s.id} shift={s} onOpen={() => onOpenShift(s.id, "invites")} />)
        )}

        <div className="wm-section-title">Upcoming shifts</div>
        {upcoming.length === 0 ? (
          <div className="wm-empty">
            <div className="wm-empty-icon"><WmIcon name="cal-check" size={22} /></div>
            <h3>Nothing on the books</h3>
            <p>Accept a shift invite and it'll show up here.</p>
          </div>
        ) : (
          upcoming.slice(0, 3).map((s) => <WmShiftCard key={s.id} shift={s} onOpen={() => onOpenShift(s.id, "upcoming")} />)
        )}
        {upcoming.length > 1 && (
          <div style={{ padding: "0 20px 24px" }}>
            <button type="button" className="wm-show-more" onClick={() => { onTabChange("shifts"); }}>
              View all
            </button>
          </div>
        )}
      </div>
    </React.Fragment>
  );
}

// =====================================================================
// SHIFTS — lists by tab
// =====================================================================
function WmShiftsList({ subTab, shifts, onOpenShift, onSubTab, onHelp }) {
  // Group shifts by day for that visual rhythm
  const list = (() => {
    if (subTab === "invites")  return shifts.filter((s) => s.status === "invited");
    if (subTab === "upcoming") return shifts.filter((s) => s.status === "upcoming");
    if (subTab === "active")   return shifts.filter((s) => s.status === "active");
    return shifts.filter((s) => s.status === "completed");
  })();
  const byDay = list.reduce((acc, s) => {
    (acc[s.dateLabel] = acc[s.dateLabel] || []).push(s);
    return acc;
  }, {});
  const days = Object.keys(byDay);
  const counts = {
    invites:  shifts.filter((s) => s.status === "invited").length,
    upcoming: shifts.filter((s) => s.status === "upcoming").length,
    active:   shifts.filter((s) => s.status === "active").length,
    past:     shifts.filter((s) => s.status === "completed").length,
  };
  return (
    <React.Fragment>
      <WmHeader title="Shifts" onHelp={onHelp} />
      <WmSubTabs tab={subTab} onChange={onSubTab} badges={{ invites: counts.invites || undefined, active: counts.active || undefined }} />
      <div className="wm-scroll">
        {days.length === 0 ? (
          <div className="wm-empty" style={{ marginTop: 80 }}>
            <div className="wm-empty-icon"><WmIcon name={subTab === "invites" ? "mail" : subTab === "past" ? "time-back" : "cal-check"} size={22} /></div>
            <h3>
              {subTab === "invites" && "No shift invites…yet!"}
              {subTab === "upcoming" && "Nothing scheduled"}
              {subTab === "active" && "No active shifts"}
              {subTab === "past" && "No shifts worked…yet!"}
            </h3>
            <p>
              {subTab === "invites"  && "Boost your chances of landing shifts by updating your preferences in the More tab."}
              {subTab === "upcoming" && "Accept a shift invite and it'll show up here."}
              {subTab === "active"   && "Confirm an upcoming shift to start your day."}
              {subTab === "past"     && "Boost your chances of landing shifts by updating your preferences in the More tab."}
            </p>
          </div>
        ) : (
          days.map((d) => (
            <React.Fragment key={d}>
              <div className="wm-day-title">{d.replace("Today · ", "")}</div>
              {byDay[d].map((s) => <WmShiftCard key={s.id} shift={s} onOpen={() => onOpenShift(s.id, subTab)} />)}
            </React.Fragment>
          ))
        )}
      </div>
    </React.Fragment>
  );
}

// =====================================================================
// SHIFT DETAIL — invited / upcoming / past variants
// =====================================================================
function WmShiftDetail({ shift, onBack, onAccept, onDeclineOpen, onIAmOnMyWayOpen, onOptOutOpen, onAddToCalendar, onCancelShiftOpen }) {
  const isInvite   = shift.status === "invited";
  const isUpcoming = shift.status === "upcoming";
  const isActive   = shift.status === "active";
  const isPast     = shift.status === "completed";
  const [moreOpen, setMoreOpen] = _wmState(false);
  const stats = isInvite
    ? [
        { v: _wm$(shift.rate),  l: "hourly rate" },
        { v: _wm$(shift.pay),   l: "Estimated pay" },
      ]
    : [
        { v: _wm$(shift.rate),  l: "Hourly rate" },
        { v: _wm$(shift.pay),   l: "Estimated pay" },
        { v: shift.hours.toFixed(2), l: "Hours" },
      ];
  return (
    <React.Fragment>
      <div className="wm-header">
        <button className="wm-iconbtn wm-iconbtn--bare" onClick={onBack} aria-label="Back">
          <WmIcon name="chevron-l" size={26} />
        </button>
        <div className="wm-header-r">
          {isPast && (
            <button className="wm-iconbtn" aria-label="Get help" title="Get help">
              <WmIcon name="help" size={20} />
            </button>
          )}
          <div className="wm-detail-more-anchor">
            <button
              className="wm-iconbtn"
              aria-label="More options"
              onClick={() => setMoreOpen((v) => !v)}
            >
              <WmIcon name="more" size={20} />
            </button>
            {moreOpen && (
              <WmDetailMoreMenu
                canCancel={isUpcoming || isActive}
                onClose={() => setMoreOpen(false)}
                onAddToCalendar={onAddToCalendar}
                onCancelShift={onCancelShiftOpen}
              />
            )}
          </div>
        </div>
      </div>
      <div className="wm-scroll">
        <h2 className="wm-detail-title">{shift.role}</h2>
        <div className="wm-detail-org">{shift.org}</div>
        {shift.program && <div className="wm-detail-org">{shift.program}</div>}
        <div className="wm-detail-addr">{shift.address}</div>

        {isPast && (
          <div className="wm-banner">
            <div className="wm-banner-title">Shift complete · Paid {shift.paidAmount}</div>
            Direct deposit landed Jul 15. Tap "View pay stub" in the menu to see the breakdown.
          </div>
        )}

        <div className={`wm-detail-stats${stats.length === 3 ? " wm-detail-stats--three" : ""}`}>
          {stats.map((s, i) => (
            <div key={i} className="wm-detail-stat">
              <div className="wm-detail-stat-value">{s.v}</div>
              <div className="wm-detail-stat-label">{s.l}</div>
            </div>
          ))}
        </div>

        <div className="wm-info">
          <div className="wm-info-icon"><WmIcon name="cal-check" size={22} /></div>
          <div className="wm-info-body">
            <div className="wm-info-title">{shift.day}</div>
            {shift.start} – {shift.end}
          </div>
        </div>

        <div className="wm-info">
          <div className="wm-info-icon"><WmIcon name="coffee" size={22} /></div>
          <div className="wm-info-body">
            <div className="wm-info-title">You'll get a {shift.breakMin}-minute break</div>
            {shift.paidBreak ? "This is a paid break — you'll be compensated for this time." : "Unpaid break, but you'll have your full half-hour."}
          </div>
        </div>

        {isInvite && shift.perks && shift.perks.length > 0 && (
          <div className="wm-info">
            <div className="wm-info-icon"><WmIcon name="sparkle" size={22} /></div>
            <div className="wm-info-body">
              <div className="wm-info-title">Perks you'll earn</div>
              {shift.perks.join(" · ")}
            </div>
          </div>
        )}

        <div className="wm-section-divider" />
        <div className="wm-section-title">About the role</div>
        <div style={{ padding: "0 20px 16px", font: "var(--evr-body2)", color: "var(--evr-content-primary-default)" }}>
          {shift.role_desc || "Responsible for fulfilling the logistics behind receiving, processing and storing inventory according to purchase orders and store policy. Maintain accurate count, escalate damages."}
        </div>

        {shift.what_to_wear && (
          <React.Fragment>
            <div className="wm-section-title">What to wear</div>
            <div style={{ padding: "0 20px 16px", font: "var(--evr-body2)", color: "var(--evr-content-primary-default)" }}>
              {shift.what_to_wear}
            </div>
          </React.Fragment>
        )}

        <div className="wm-section-title">Where you'll work</div>
        <div style={{ padding: "0 20px", font: "var(--evr-body2)", color: "var(--evr-content-primary-default)" }}>
          {shift.address}
        </div>
        <div className="wm-map">
          <div className="wm-map-pin"><WmIcon name="pin" size={22} style={{ color: "var(--evr-blue-400)" }} /></div>
          <div className="wm-map-cta">Get directions</div>
        </div>
        <div style={{ padding: "8px 20px 0", font: "var(--evr-caption)", color: "var(--evr-content-primary-lowemp)" }}>
          {shift.distance}
        </div>

        {!isPast && (
          <React.Fragment>
            <div className="wm-section-divider" />
            <div className="wm-section-title">Point of contact</div>
            <div style={{ padding: "0 20px 12px", font: "var(--evr-body2)" }}>{shift.contact}</div>
            <div className="wm-link-row" role="button">
              <span className="wm-link-row-label"><WmIcon name="phone" size={18} style={{ marginRight: 10, verticalAlign: "-3px" }} />Call your contact</span>
              <WmIcon name="chevron-r" size={18} />
            </div>
          </React.Fragment>
        )}

        {shift.instructions && (
          <React.Fragment>
            <div className="wm-section-title">Instructions</div>
            <div style={{ padding: "0 20px 24px", font: "var(--evr-body2)", color: "var(--evr-content-primary-default)" }}>
              {shift.instructions}
            </div>
          </React.Fragment>
        )}

        {isUpcoming && (
          <div style={{ padding: "8px 20px 16px" }}>
            <button type="button" className="wm-btn wm-btn--ghost" style={{ width: "100%" }} onClick={onOptOutOpen}>
              <WmIcon name="x-circle" size={18} />Opt out of this shift
            </button>
          </div>
        )}
        {isInvite && (
          <div style={{ padding: "8px 20px 16px" }}>
            <button type="button" className="wm-btn wm-btn--ghost" style={{ width: "100%", color: "var(--evr-interactive-error-default)", borderColor: "var(--evr-border-status-error)" }} onClick={onDeclineOpen}>
              <WmIcon name="x-circle" size={18} />Decline
            </button>
          </div>
        )}
      </div>

      {isInvite && (
        <div className="wm-action-bar">
          <button type="button" className="wm-btn wm-btn--ghost" onClick={onDeclineOpen}>Decline</button>
          <button type="button" className="wm-btn" onClick={onAccept}>Accept</button>
        </div>
      )}
      {isUpcoming && (
        <div className="wm-cta-card-dock">
          <div className="wm-cta-card">
            <div className="wm-cta-card-title">Are you on your way?</div>
            <div className="wm-cta-card-text">
              Please let the team know you're on your way so they can prepare for your arrival.
            </div>
            <div className="wm-cta-card-actions">
              <span className="wm-cta-card-tag">Shift starts soon</span>
              <button
                type="button"
                className="wm-btn wm-cta-card-btn"
                onClick={onIAmOnMyWayOpen}
              >
                I'm on my way
              </button>
            </div>
          </div>
        </div>
      )}
    </React.Fragment>
  );
}

// =====================================================================
// ACTIVE SHIFT — clockin / working / break
// =====================================================================
function WmActiveScreen({ shift, activeState, elapsed, breakSec, enrouteSec, travelMode, onBack, onSubTab, onClockInOpen, onStartBreak, onEndBreak, onEndShift, onHelp }) {
  const phase = activeState; // "clockin" (en route) | "working" | "break"
  const ringClass = phase === "working" ? "wm-ring--working"
                  : phase === "break"   ? "wm-ring--break"
                  : "wm-ring--enroute";
  const label = phase === "working" ? "Working"
              : phase === "break"   ? "Break"
              : "En Route";
  const etaByMode = { walk: 17, bike: 6, car: 4, transit: 12 };
  const eta = etaByMode[travelMode] || 17;
  const fmt = (sec) => {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    return [h, m, s].map((n) => String(n).padStart(2, "0")).join(":");
  };

  return (
    <React.Fragment>
      <WmHeader title="Shifts" onHelp={onHelp} />
      <WmSubTabs tab="active" onChange={onSubTab || (() => {})} />
      <div className="wm-scroll">
        {phase === "clockin" ? (
          <React.Fragment>
            <button type="button" className="wm-active-summary">
              <div className="wm-active-summary-logo" aria-hidden="true">
                {(shift.org || "").trim().slice(0, 2).toUpperCase() || "SW"}
              </div>
              <div className="wm-active-summary-body">
                <div className="wm-active-summary-title">{shift.role}</div>
                <div className="wm-active-summary-sub">
                  {shift.start} – {shift.end} · {shift.breakMin} min break
                </div>
              </div>
              <WmIcon name="chevron-r" size={18} />
            </button>
            <div style={{ padding: "0 20px" }}>
              <WmRouteMap etaMin={eta} elapsedSec={enrouteSec || 0} mode={travelMode || "walk"} />
            </div>
            <div className="wm-active-actionrow">
              <button type="button" className="wm-actionrow-bubble" aria-label="Team chat">
                <WmIcon name="chat" size={20} />
              </button>
              <button type="button" className="wm-btn wm-actionrow-primary" onClick={onClockInOpen}>
                Clock in
              </button>
              <button type="button" className="wm-actionrow-bubble" aria-label="More">
                <WmIcon name="more" size={20} />
              </button>
            </div>
          </React.Fragment>
        ) : (
          <React.Fragment>
        <div className="wm-day-title">{shift.day}</div>
        <div className="wm-active-card">
          <div className={`wm-ring ${ringClass}`}>
            <div className="wm-ring-inner">
              <div className="wm-ring-label">{label}</div>
              <div className="wm-ring-time"><span className="wm-ring-dot" />{phase === "break" ? fmt(breakSec || 0) : fmt(elapsed)}</div>
            </div>
          </div>
          <div className="wm-active-where">
            <div className="wm-active-card-title">{shift.role}</div>
            <div className="wm-active-card-org">{shift.location || shift.org}</div>
          </div>
          {phase === "working" && (
            <React.Fragment>
              <button type="button" className="wm-btn wm-btn--block wm-btn--puck" onClick={onStartBreak}>
                <span className="wm-btn-puck-icon"><WmIcon name="coffee" size={20} /></span>
                Start Break
              </button>
              <div className="wm-active-hint">You have a {shift.breakMin} min break available</div>
            </React.Fragment>
          )}
          {phase === "break" && (
            <React.Fragment>
              <button type="button" className="wm-btn wm-btn--block wm-btn--puck" onClick={onEndBreak}>
                <span className="wm-btn-puck-icon"><WmIcon name="pause" size={20} /></span>
                End Break
              </button>
              <div className="wm-active-hint">End break when ready</div>
            </React.Fragment>
          )}
        </div>

        <div className="wm-row">
          <button type="button" className="wm-chip"><WmIcon name="chat" size={18} />Team Chat</button>
          {phase === "working" && (
            <button type="button" className="wm-chip wm-chip--sq" onClick={onEndShift} aria-label="End shift">
              <WmIcon name="stop" size={20} />
            </button>
          )}
          {phase !== "working" && (
            <button type="button" className="wm-chip wm-chip--sq" aria-label="More">
              <WmIcon name="more" size={20} />
            </button>
          )}
        </div>

          </React.Fragment>
        )}
      </div>
    </React.Fragment>
  );
}

// =====================================================================
// CLOCK-IN METHOD SHEET — picker shown when the worker taps "Clock in"
// on the en-route active screen. Each site can be configured with one
// or more verification methods; this prototype offers all four:
//   • Geo-location       — confirm via device GPS at the site
//   • QR Code            — scan the site's QR with the camera
//   • DF Clock Badge     — share a numeric badge at a physical clock
//   • DF Clock Biometrics— scan face / fingerprint at a physical clock
// =====================================================================
const WM_CLOCK_METHODS = [
  { id: "geo",        label: "Geo-location",      icon: "pin",          blurb: "Confirm you're on-site" },
  { id: "qr",         label: "QR Code",           icon: "qr",           blurb: "Scan the site's clock-in code" },
  { id: "badge",      label: "DF Clock Badge",    icon: "badge",        blurb: "Use your badge number at the clock" },
  { id: "biometrics", label: "DF Clock Biometrics", icon: "face-scan",  blurb: "Face or fingerprint at the clock" },
];
function WmClockMethodSheet({ onClose, onPick }) {
  return (
    <div className="wm-sheet-backdrop wm-sheet-backdrop--bottom" onClick={onClose}>
      <div className="wm-sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Choose a clock-in method">
        <div className="wm-sheet-grabber" aria-hidden="true" />
        <h3>Clock in</h3>
        <p>Pick how you'll check in for your shift.</p>
        <div className="wm-method-list">
          {WM_CLOCK_METHODS.map((m) => (
            <button
              key={m.id}
              type="button"
              className="wm-method-row"
              onClick={() => onPick(m)}
            >
              <span className="wm-method-row-icon">
                <WmIcon name={m.icon} size={20} />
              </span>
              <span className="wm-method-row-body">
                <span className="wm-method-row-label">{m.label}</span>
                <span className="wm-method-row-sub">{m.blurb}</span>
              </span>
              <WmIcon name="chevron-r" size={16} />
            </button>
          ))}
        </div>
        <div className="wm-sheet-actions">
          <button type="button" className="wm-btn wm-btn--ghost wm-btn--block" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

// =====================================================================
// DF CLOCK BADGE — badge-number sheet.
// Surfaces the worker's badge ID prominently so they can quote it at
// the site's time clock. The number is derived deterministically from
// the worker's id so it stays consistent across the demo.
// =====================================================================
function _wmBadgeNumberFor(workerId) {
  // Hash the worker id into an 8-digit numeric badge.
  let h = 0;
  for (let i = 0; i < (workerId || "").length; i++) h = (h * 31 + workerId.charCodeAt(i)) >>> 0;
  // Clamp to 8 digits, padded.
  const n = (h % 90000000) + 10000000;
  return String(n);
}
function WmBadgeSheet({ worker, onClose, onContinue }) {
  const badge = _wmBadgeNumberFor(worker && worker.id);
  return (
    <div className="wm-sheet-backdrop wm-sheet-backdrop--bottom" onClick={onClose}>
      <div className="wm-sheet wm-sheet--lg" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Your badge number">
        <div className="wm-sheet-grabber" aria-hidden="true" />
        <button
          type="button"
          className="wm-iconbtn wm-sheet-close"
          aria-label="Close"
          onClick={onClose}
        >
          <WmIcon name="x" size={16} />
        </button>
        <h3>Your badge number</h3>
        <p>
          Your badge number helps companies verify your identity and allows
          for quick set up to use their time clock.
        </p>
        <div className="wm-badge-display">
          <div className="wm-badge-number">{badge}</div>
        </div>
        <div className="wm-sheet-actions">
          <button type="button" className="wm-btn wm-btn--block" onClick={onContinue}>How to get started</button>
        </div>
      </div>
    </div>
  );
}

// =====================================================================
// DF CLOCK ONBOARDING — full-screen "Use this location's time clock"
// instructions with three steps. Variants:
//   • badge       — Arrive · Share badge · Scan face
//   • biometrics  — Scan face · Wait · Have a great shift
// Closing returns to the en-route screen; tapping "Got it" simulates
// the clock-in handshake completing and moves the shift to Working.
// =====================================================================
const WM_ONBOARD_STEPS = {
  badge: [
    { icon: "handshake", title: "Arrive and meet point of contact", body: "They will help you get set up to use their time clock with face verification." },
    { icon: "badge",     title: "Share your badge number",          body: "Your badge number is {{BADGE}}. This is used to verify you at the time clock." },
    { icon: "face-scan", title: "Scan your face at the time clock", body: "Use the time clock to scan your face to start or end shifts and breaks." },
  ],
  biometrics: [
    { icon: "face-scan", title: "Scan your face at the time clock", body: "Use the time clock to scan your face and you'll be matched with your photo on file." },
    { icon: "check-circle", title: "Wait for confirmation",         body: "When you see the confirmation message, you're all set." },
    { icon: "sparkle",   title: "Have a great shift",               body: "Don't forget to repeat this process for paid breaks and at the end of your shift." },
  ],
};
function WmClockOnboard({ kind, worker, onClose, onComplete }) {
  const steps = WM_ONBOARD_STEPS[kind] || WM_ONBOARD_STEPS.badge;
  const badge = _wmBadgeNumberFor(worker && worker.id);
  return (
    <div className="wm-onboard">
      <button
        type="button"
        className="wm-iconbtn wm-onboard-close"
        aria-label="Close"
        onClick={onClose}
      >
        <WmIcon name="x" size={18} />
      </button>
      <div className="wm-onboard-illu" aria-hidden="true">
        <svg viewBox="0 0 200 160" width="200" height="160">
          {/* Background bubble */}
          <circle cx="100" cy="80" r="74" fill="#D9E6F4" />
          {/* Time clock device */}
          <rect x="40" y="56" width="46" height="60" rx="6" fill="#FFFFFF" stroke="#1F1F23" strokeWidth="2" />
          <rect x="46" y="62" width="34" height="22" rx="2" fill="#1F1F23" />
          <circle cx="63" cy="100" r="5" fill="#3067DB" />
          {/* Person */}
          <circle cx="130" cy="74" r="14" fill="#F5C7A8" />
          <path d="M 116 88 Q 130 84 144 88 L 144 138 Q 130 142 116 138 Z" fill="#3067DB" />
          <rect x="118" y="88" width="6" height="34" rx="3" fill="#F5C7A8" />
          {/* Hand pointing */}
          <rect x="100" y="98" width="22" height="6" rx="3" fill="#F5C7A8" />
          {/* Schedule paper */}
          <rect x="76" y="120" width="40" height="24" rx="3" fill="#FFFFFF" stroke="#1F1F23" strokeWidth="1.5" />
          <line x1="80" y1="128" x2="112" y2="128" stroke="#1F1F23" strokeWidth="1" />
          <line x1="80" y1="134" x2="100" y2="134" stroke="#1F1F23" strokeWidth="1" />
        </svg>
      </div>
      <h2 className="wm-onboard-title">Use this location's time clock for your shift</h2>
      <h3 className="wm-onboard-sub">How to get started</h3>
      <div className="wm-onboard-steps">
        {steps.map((s, i) => (
          <div className="wm-onboard-step" key={i}>
            <div className="wm-onboard-step-icon"><WmIcon name={s.icon} size={20} /></div>
            <div className="wm-onboard-step-body">
              <div className="wm-onboard-step-title">{s.title}</div>
              <div className="wm-onboard-step-text">{s.body.replace("{{BADGE}}", badge)}</div>
            </div>
          </div>
        ))}
      </div>
      <div className="wm-onboard-actions">
        <button type="button" className="wm-btn wm-btn--block" onClick={onComplete}>
          {kind === "badge" ? "I've shared my badge" : "I've scanned in"}
        </button>
      </div>
    </div>
  );
}

// =====================================================================
// QR CLOCK-IN OVERLAY
// =====================================================================
function WmQrOverlay({ onClose, onComplete }) {
  const [counter, setCounter] = _wmState(8 * 60); // 7:52 → just count down

  _wmEffect(() => {
    const t = setInterval(() => setCounter((n) => Math.max(0, n - 7)), 700);
    return () => clearInterval(t);
  }, []);

  // Synthetic QR-ish pattern — purely decorative
  const dots = _wmMemo(() => {
    const out = [];
    const grid = 21;
    for (let y = 0; y < grid; y++) for (let x = 0; x < grid; x++) {
      // Finder patterns (corners)
      const inFinder =
        (x < 7 && y < 7) || (x >= grid - 7 && y < 7) || (x < 7 && y >= grid - 7);
      const finderFill =
        (x === 0 || x === 6 || y === 0 || y === 6) ||
        (x >= 2 && x <= 4 && y >= 2 && y <= 4);
      const fill = inFinder ? finderFill : ((x * 7 + y * 13 + (x ^ y)) % 3 === 0);
      if (fill) out.push({ x, y });
    }
    return out;
  }, []);

  const min = Math.floor(counter / 60);
  const sec = counter % 60;

  return (
    <div className="wm-qr-overlay">
      <div className="wm-header" style={{ color: "#fff" }}>
        <button className="wm-iconbtn" onClick={onClose} aria-label="Close">
          <WmIcon name="x" size={20} />
        </button>
        <h1 style={{ color: "#fff", fontSize: 22, flex: 1, textAlign: "center", marginRight: 40 }}>Start Shift</h1>
      </div>
      <div className="wm-qr-card">
        <svg viewBox="0 0 21 21" width="260" height="260" shapeRendering="crispEdges">
          {dots.map((d, i) => <rect key={i} x={d.x} y={d.y} width="1" height="1" fill="#000" />)}
        </svg>
      </div>
      <div className="wm-qr-banner">
        <WmIcon name="lightning" size={20} />
        Shift begins in {String(min).padStart(2, "0")}:{String(sec).padStart(2, "0")}
      </div>
      <div className="wm-qr-help">
        Show code to any manager from the site so they can clock you in.
      </div>
      <div className="wm-action-bar" style={{ background: "transparent", borderTop: "none" }}>
        <button type="button" className="wm-btn wm-btn--block" onClick={onComplete}>
          I'm clocked in
        </button>
      </div>
    </div>
  );
}

// =====================================================================
// SHIFT-END SUMMARY — "Great work!"
// =====================================================================
function WmSummaryScreen({ shift, elapsedSec, breakSec, onDone }) {
  const [rating, setRating] = _wmState(0);
  const earned = shift.rate * (elapsedSec / 3600);
  const fmtTime = (sec) => {
    const t = new Date(Date.now() - (24*3600 - sec)*1000);
    const h = t.getHours();
    const m = t.getMinutes();
    const ap = h >= 12 ? "PM" : "AM";
    const h12 = ((h + 11) % 12) + 1;
    return `${h12}:${String(m).padStart(2, "0")} ${ap}`;
  };
  return (
    <React.Fragment>
      <div className="wm-header">
        <span />
        <button className="wm-iconbtn" aria-label="More"><WmIcon name="more" size={20} /></button>
      </div>
      <div className="wm-scroll">
        <h2 className="wm-summary-title">Great work!</h2>
        <div className="wm-summary-card">
          <div className="wm-summary-card-label">Estimated Earnings</div>
          <div className="wm-summary-card-amount">{_wm$(earned || shift.pay)} <small>before taxes</small></div>
        </div>

        <div className="wm-section-title" style={{ display: "flex", justifyContent: "space-between", paddingBottom: 8 }}>
          <span>Clock</span>
          <button className="wm-show-more">Edit</button>
        </div>
        <div className="wm-summary-rows">
          <div className="wm-summary-row"><span>Clocked In</span><span className="v">{shift.start}</span></div>
          <div className="wm-summary-row"><span>Clocked Out</span><span className="v">{shift.end}</span></div>
          <div className="wm-summary-row"><span>Break</span><span className="v">{Math.round(breakSec/60) || shift.breakMin} mins</span></div>
        </div>

        <div className="wm-section-title">Feedback</div>
        <div style={{ margin: "0 20px 20px", border: "1px solid var(--evr-border-decorative-lowemp)", borderRadius: 16, padding: 16 }}>
          <div style={{ font: "var(--evr-body2)", color: "var(--evr-content-primary-default)", marginBottom: 12 }}>How was your shift?</div>
          <div className="wm-stars">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                className={n <= rating ? "is-on" : ""}
                aria-label={`${n} stars`}
                onClick={() => setRating(n)}
              >
                <WmIcon name={n <= rating ? "star" : "star-outline"} size={32} />
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="wm-action-bar">
        <button type="button" className="wm-btn wm-btn--block" onClick={onDone}>Done</button>
      </div>
    </React.Fragment>
  );
}

// =====================================================================
// MORE — sub-panel helpers + contextual data derivations
// Each panel reads from the active worker + shift derivations so the
// data shown lines up with whoever the previewer is impersonating.
// =====================================================================

function WmPanelHeader({ title, onBack, action }) {
  return (
    <div className="wm-panel-header">
      <button className="wm-iconbtn wm-iconbtn--bare" onClick={onBack} aria-label="Back">
        <WmIcon name="chevron-l" size={26} />
      </button>
      <h1>{title}</h1>
      <div className="wm-panel-header-r">{action || <span className="wm-panel-header-spacer" aria-hidden="true" />}</div>
    </div>
  );
}

// Stable hash so each worker gets deterministic seeded values across
// renders (rates, dates, etc.) without persisting state.
function _wmHash(str) {
  let h = 0;
  const s = String(str || "");
  for (let i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0;
  return h;
}

function _wmSupLabel(w) {
  const sup = (window.REQ_SUPPLIERS || {})[w && w.supplier];
  return sup ? sup.label : ((w && w.pool) || "Direct");
}

function _wmFirstName(w) {
  return ((w && w.name) || "").split(/\s+/)[0] || "there";
}

// =====================================================================
// AVAILABILITY
// =====================================================================
const WM_AVAIL_DAYS = [
  { k: "Mon", full: "Monday" },
  { k: "Tue", full: "Tuesday" },
  { k: "Wed", full: "Wednesday" },
  { k: "Thu", full: "Thursday" },
  { k: "Fri", full: "Friday" },
  { k: "Sat", full: "Saturday" },
  { k: "Sun", full: "Sunday" },
];
const WM_AVAIL_SLOTS = ["Morning", "Afternoon", "Evening", "Overnight"];
function _wmInitialAvailability(worker) {
  const h = _wmHash(worker && worker.id);
  return WM_AVAIL_DAYS.map((d, i) => {
    const bits = (h >> (i * 2)) & 0xf;
    return {
      day: d.k, full: d.full,
      slots: WM_AVAIL_SLOTS.map((s, j) => ({
        id: s,
        // Bias: at least one weekday morning slot always on, weekends quieter
        enabled: Boolean(bits & (1 << j)) || (j === 0 && i < 5),
      })),
    };
  });
}
function WmAvailabilityPanel({ worker, onBack }) {
  const [grid, setGrid] = _wmState(() => _wmInitialAvailability(worker));
  const [maxHours, setMaxHours] = _wmState(40);
  const onCount = grid.reduce((n, d) => n + d.slots.filter((s) => s.enabled).length, 0);
  const toggle = (di, si) =>
    setGrid((g) => g.map((d, i) => (i !== di ? d : { ...d, slots: d.slots.map((s, j) => (j !== si ? s : { ...s, enabled: !s.enabled })) })));
  return (
    <React.Fragment>
      <WmPanelHeader title="Availability" onBack={onBack} />
      <div className="wm-scroll">
        <div className="wm-info">
          <div className="wm-info-icon"><WmIcon name="cal-check" size={22} /></div>
          <div className="wm-info-body">
            <div className="wm-info-title">{onCount} windows open / week</div>
            Tap a window to toggle it. Suppliers won't send shift invites outside the times you mark open.
          </div>
        </div>
        <div className="wm-section-divider" />
        <div className="wm-section-title">Weekly schedule</div>
        <div className="wm-avail">
          {grid.map((d, di) => (
            <div className="wm-avail-day" key={d.day}>
              <div className="wm-avail-day-name">
                <span className="wm-avail-day-short">{d.day}</span>
                <span className="wm-avail-day-full">{d.full}</span>
              </div>
              <div className="wm-avail-slots">
                {d.slots.map((s, si) => (
                  <button
                    key={s.id}
                    type="button"
                    className={`wm-avail-slot${s.enabled ? " is-on" : ""}`}
                    onClick={() => toggle(di, si)}
                    aria-pressed={s.enabled}
                  >
                    {s.id}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="wm-section-divider" />
        <div className="wm-section-title">Weekly cap</div>
        <div className="wm-row-stack">
          <div className="wm-stepper">
            <div className="wm-stepper-body">
              <div className="wm-stepper-label">Maximum hours per week</div>
              <div className="wm-stepper-sub">We'll cap invite totals at this number.</div>
            </div>
            <div className="wm-stepper-controls">
              <button type="button" aria-label="Decrease" onClick={() => setMaxHours((n) => Math.max(0, n - 4))}>−</button>
              <span className="wm-stepper-value">{maxHours} hr</span>
              <button type="button" aria-label="Increase" onClick={() => setMaxHours((n) => Math.min(80, n + 4))}>+</button>
            </div>
          </div>
        </div>
        <div className="wm-section-divider" />
        <div className="wm-section-title">Time off</div>
        <div className="wm-link-row" role="button">
          <span className="wm-link-row-label"><WmIcon name="cal-add" size={18} style={{ marginRight: 10, verticalAlign: "-3px" }} />Request time off</span>
          <WmIcon name="chevron-r" size={18} />
        </div>
        <div className="wm-link-row" role="button">
          <span className="wm-link-row-label"><WmIcon name="time-back" size={18} style={{ marginRight: 10, verticalAlign: "-3px" }} />Past time-off requests</span>
          <WmIcon name="chevron-r" size={18} />
        </div>
        <div style={{ height: 24 }} />
      </div>
    </React.Fragment>
  );
}

// =====================================================================
// SKILLS
// =====================================================================
// Adjacency: skills suggested when the worker holds the listed primary role.
const WM_SKILL_SUGGESTIONS = {
  "Production Associate": ["Forklift", "Hand-scanner", "Inventory count"],
  "Picker":               ["RF scanner", "Pallet jack", "Order pick"],
  "Warehouse Clerk":      ["Receiving", "Cycle counting"],
  "Bartender":            ["Wine service", "Espresso", "POS — Toast"],
  "Server":               ["Tray carry", "Banquet service", "POS — Toast"],
  "Host":                 ["Reservation systems", "Phone etiquette"],
  "Prep Cook":            ["Knife skills", "Mise en place"],
  "Line Cook":            ["Grill", "Sauté", "Plating"],
  "Cook":                 ["Grill", "Fryer", "Sauté"],
  "Line Manager":         ["People management", "Lean / Six Sigma"],
  "Factory Line Assembler": ["Torque wrench", "Pneumatic tools"],
  "Operator":             ["CNC operation", "Quality check"],
  "Inspector":            ["Measurement tools", "Audit reporting"],
  "Registered Nurse":     ["IV insertion", "Wound care", "EHR — Epic"],
  "LPN":                  ["IV insertion", "Phlebotomy"],
  "Surgical Tech":        ["Sterile field", "Instrument prep"],
  "Respiratory Therapist": ["Ventilator care", "Arterial draws"],
  "Assembler":            ["Hand tools", "Quality check"],
};
function _wmSkillsFor(worker) {
  const roles = (worker && worker.jobs) || [];
  const h = _wmHash(worker && worker.id);
  const primary = roles.map((r, i) => ({
    name: r,
    level: ["Beginner", "Intermediate", "Advanced", "Expert"][((h >> (i * 3)) & 0x3) || 2],
    endorsed: 2 + ((h >> (i * 5)) & 0x7),
    primary: true,
  }));
  const adjacent = [];
  roles.forEach((r) => (WM_SKILL_SUGGESTIONS[r] || []).forEach((s, i) => {
    if (adjacent.find((x) => x.name === s)) return;
    adjacent.push({
      name: s,
      level: ["Beginner", "Intermediate", "Advanced"][((h >> (i * 2)) & 0x3) % 3],
      endorsed: ((h >> (i * 4)) & 0x3),
      primary: false,
    });
  }));
  return { primary, adjacent };
}
function WmSkillsPanel({ worker, onBack }) {
  const { primary, adjacent } = _wmMemo(() => _wmSkillsFor(worker), [worker && worker.id]);
  return (
    <React.Fragment>
      <WmPanelHeader title="Skills" onBack={onBack} />
      <div className="wm-scroll">
        <div className="wm-info">
          <div className="wm-info-icon"><WmIcon name="sparkle" size={22} /></div>
          <div className="wm-info-body">
            <div className="wm-info-title">{primary.length} verified · {adjacent.length} suggested</div>
            Verified skills come from past shifts and your supplier. The more you add, the more invites you'll see.
          </div>
        </div>

        <div className="wm-section-divider" />
        <div className="wm-section-title">Verified</div>
        <div className="wm-skill-list">
          {primary.map((s) => (
            <div className="wm-skill" key={s.name}>
              <div className="wm-skill-body">
                <div className="wm-skill-name">{s.name}</div>
                <div className="wm-skill-meta">{s.level} · {s.endorsed} endorsements</div>
              </div>
              <span className="wm-pill wm-pill--ok">Verified</span>
            </div>
          ))}
        </div>

        <div className="wm-section-divider" />
        <div className="wm-section-title">Suggested for you</div>
        {adjacent.length === 0 ? (
          <div style={{ padding: "0 20px 16px", font: "var(--evr-body2)", color: "var(--evr-content-primary-default)" }}>
            No suggestions right now. Keep working shifts and we'll surface adjacent skills here.
          </div>
        ) : (
          <div className="wm-skill-list">
            {adjacent.map((s) => (
              <div className="wm-skill" key={s.name}>
                <div className="wm-skill-body">
                  <div className="wm-skill-name">{s.name}</div>
                  <div className="wm-skill-meta">{s.level || "Self-reported"}{s.endorsed ? ` · ${s.endorsed} endorsements` : ""}</div>
                </div>
                <button type="button" className="wm-skill-add">Add</button>
              </div>
            ))}
          </div>
        )}

        <div style={{ padding: "16px 20px 28px" }}>
          <button type="button" className="wm-btn wm-btn--ghost wm-btn--block">
            <WmIcon name="edit" size={18} />Add a custom skill
          </button>
        </div>
      </div>
    </React.Fragment>
  );
}

// =====================================================================
// CERTIFICATIONS
// =====================================================================
const WM_CERT_BY_ROLE = {
  "Bartender":               [{ name: "TIPS — Alcohol Service",        issuer: "Health Communications Inc.", term: 3 }, { name: "Food Handler",                  issuer: "ServSafe", term: 3 }],
  "Server":                  [{ name: "Food Handler",                   issuer: "ServSafe",                    term: 3 }, { name: "Allergen Awareness",            issuer: "ServSafe", term: 5 }],
  "Host":                    [{ name: "Food Handler",                   issuer: "ServSafe",                    term: 3 }],
  "Prep Cook":               [{ name: "Food Handler",                   issuer: "ServSafe",                    term: 3 }, { name: "Allergen Awareness",            issuer: "ServSafe", term: 5 }],
  "Line Cook":               [{ name: "Food Handler",                   issuer: "ServSafe",                    term: 3 }, { name: "Allergen Awareness",            issuer: "ServSafe", term: 5 }],
  "Cook":                    [{ name: "Food Handler",                   issuer: "ServSafe",                    term: 3 }],
  "Production Associate":    [{ name: "OSHA 10 — General Industry",     issuer: "OSHA",                        term: 5 }, { name: "Forklift Operator",             issuer: "OSHA",     term: 3 }],
  "Picker":                  [{ name: "OSHA 10 — General Industry",     issuer: "OSHA",                        term: 5 }, { name: "Pallet Jack Certification",     issuer: "Workplace Safety", term: 3 }],
  "Warehouse Clerk":         [{ name: "OSHA 10 — General Industry",     issuer: "OSHA",                        term: 5 }, { name: "Forklift Operator",             issuer: "OSHA",     term: 3 }],
  "Factory Line Assembler":  [{ name: "OSHA 10 — General Industry",     issuer: "OSHA",                        term: 5 }, { name: "Lockout / Tagout",              issuer: "OSHA",     term: 3 }],
  "Operator":                [{ name: "OSHA 10 — General Industry",     issuer: "OSHA",                        term: 5 }, { name: "Lockout / Tagout",              issuer: "OSHA",     term: 3 }],
  "Inspector":               [{ name: "ISO 9001 Familiarity",           issuer: "ASQ",                         term: 5 }],
  "Line Manager":            [{ name: "OSHA 30 — General Industry",     issuer: "OSHA",                        term: 5 }, { name: "First Aid + CPR",               issuer: "Red Cross", term: 2 }],
  "Registered Nurse":        [{ name: "RN License — State",             issuer: "Board of Nursing",            term: 2 }, { name: "BLS — Basic Life Support",      issuer: "AHA",      term: 2 }, { name: "ACLS",                  issuer: "AHA",      term: 2 }],
  "LPN":                     [{ name: "LPN License — State",            issuer: "Board of Nursing",            term: 2 }, { name: "BLS — Basic Life Support",      issuer: "AHA",      term: 2 }],
  "Surgical Tech":           [{ name: "CST Certification",              issuer: "NBSTSA",                      term: 4 }, { name: "BLS — Basic Life Support",      issuer: "AHA",      term: 2 }],
  "Respiratory Therapist":   [{ name: "RRT — Respiratory Therapist",    issuer: "NBRC",                        term: 5 }, { name: "ACLS",                          issuer: "AHA",      term: 2 }],
  "Assembler":               [{ name: "OSHA 10 — General Industry",     issuer: "OSHA",                        term: 5 }],
  "Med-Surg":                [{ name: "BLS — Basic Life Support",       issuer: "AHA",                         term: 2 }],
};
function _wmCertsFor(worker) {
  const roles = (worker && worker.jobs) || [];
  const seen = new Map();
  roles.forEach((r) => (WM_CERT_BY_ROLE[r] || []).forEach((c) => { if (!seen.has(c.name)) seen.set(c.name, c); }));
  if (seen.size === 0) seen.set("Workplace Safety Briefing", { name: "Workplace Safety Briefing", issuer: "Dayforce", term: 2 });
  const today = window.flexToday ? window.flexToday() : new Date();
  const h = _wmHash(worker && worker.id);
  const out = [];
  let i = 0;
  for (const c of seen.values()) {
    const monthsAgo = 4 + ((h >> (i * 3)) & 0x1f);
    const issued = new Date(today); issued.setMonth(issued.getMonth() - monthsAgo);
    const expires = new Date(issued); expires.setFullYear(expires.getFullYear() + c.term);
    const daysToExp = Math.round((expires - today) / 86400000);
    let status = "Active";
    if (daysToExp < 0) status = "Expired";
    else if (daysToExp < 60) status = "Expiring soon";
    if (worker && worker.status === "Onboarding" && i === 0) status = "Pending review";
    if (worker && worker.status === "Expired" && i === 0) { status = "Expired"; }
    out.push({ ...c, issued, expires, daysToExp, status });
    i++;
  }
  return out;
}
function _wmFmtDate(d) {
  if (!d) return "—";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
function WmCertsPanel({ worker, onBack }) {
  const certs = _wmMemo(() => _wmCertsFor(worker), [worker && worker.id]);
  const compliant = certs.every((c) => c.status === "Active");
  return (
    <React.Fragment>
      <WmPanelHeader title="Certifications" onBack={onBack} />
      <div className="wm-scroll">
        <div className={`wm-banner${compliant ? "" : " wm-banner--warn"}`}>
          <div className="wm-banner-title">
            {compliant ? "You're compliant" : "Action needed"}
          </div>
          {compliant
            ? `All ${certs.length} of your required certifications are active and on file.`
            : `One or more certifications need attention. Tap a card below to renew or upload a new copy.`}
        </div>
        <div className="wm-section-title">On file</div>
        <div className="wm-cert-list">
          {certs.map((c, i) => {
            const cls = c.status === "Active" ? "ok"
                      : c.status === "Expiring soon" ? "warn"
                      : c.status === "Pending review" ? "info" : "err";
            return (
              <button key={i} type="button" className="wm-cert">
                <div className="wm-cert-head">
                  <div className="wm-cert-name">{c.name}</div>
                  <span className={`wm-pill wm-pill--${cls}`}>{c.status}</span>
                </div>
                <div className="wm-cert-issuer">{c.issuer}</div>
                <div className="wm-cert-meta">
                  <span><span className="lbl">Issued</span> {_wmFmtDate(c.issued)}</span>
                  <span><span className="lbl">Expires</span> {_wmFmtDate(c.expires)}</span>
                </div>
              </button>
            );
          })}
        </div>
        <div style={{ padding: "16px 20px 28px" }}>
          <button type="button" className="wm-btn wm-btn--ghost wm-btn--block">
            <WmIcon name="edit" size={18} />Upload new certification
          </button>
        </div>
      </div>
    </React.Fragment>
  );
}

// =====================================================================
// BENEFITS
// =====================================================================
function WmBenefitsPanel({ worker, onBack }) {
  const supLabel = _wmSupLabel(worker);
  const isAgency = Boolean(worker && worker.supplier);
  // Eligibility is hours-based; 30+ avg / week unlocks medical.
  const shifts = worker && worker.shifts ? worker.shifts : 12;
  const eligible = shifts >= 25;
  const benefits = isAgency
    ? [
        { name: "Medical — Aetna PPO",       enrolled: eligible, contribution: "$48.20",  cadence: "/ paycheck", desc: "Comprehensive medical, dental & vision." },
        { name: "401(k) Retirement",          enrolled: eligible, contribution: "4% match", cadence: "of gross",   desc: "Through Empower. Vests over 3 years." },
        { name: "Sick & safe time",           enrolled: true,     contribution: "0.033 hr", cadence: "/ hr worked", desc: "Accrue while you work; carry up to 40 hours." },
        { name: "Earned Wage Access",         enrolled: true,     contribution: "Free",      cadence: "",            desc: "Cash out earned pay before payday via Dayforce Wallet." },
      ]
    : [
        { name: "Medical — Aetna PPO",       enrolled: true,     contribution: "$0",        cadence: "/ paycheck", desc: "Fully covered for full-time team members." },
        { name: "401(k) Retirement",          enrolled: true,     contribution: "6% match",  cadence: "of gross",   desc: "Through Fidelity. Immediate vesting." },
        { name: "Paid Time Off",              enrolled: true,     contribution: "120 hr",    cadence: "/ year",     desc: "Vacation, personal, and bereavement." },
        { name: "Earned Wage Access",         enrolled: true,     contribution: "Free",      cadence: "",            desc: "Cash out earned pay before payday via Dayforce Wallet." },
      ];
  const enrolled = benefits.filter((b) => b.enrolled).length;
  return (
    <React.Fragment>
      <WmPanelHeader title="Benefits" onBack={onBack} />
      <div className="wm-scroll">
        <div className="wm-banner">
          <div className="wm-banner-title">{enrolled} of {benefits.length} active</div>
          Benefits administered by <b>{supLabel}</b>. Need help? Contact your supplier's benefits desk.
        </div>

        {!eligible && isAgency && (
          <div className="wm-banner wm-banner--warn">
            <div className="wm-banner-title">Medical & retirement: not yet eligible</div>
            You unlock these after averaging 30 hours / week across a 90-day window. You're at {shifts} shifts so far.
          </div>
        )}

        <div className="wm-section-title">Your plan</div>
        <div className="wm-benefit-list">
          {benefits.map((b) => (
            <div className="wm-benefit" key={b.name}>
              <div className="wm-benefit-head">
                <div className="wm-benefit-name">{b.name}</div>
                <span className={`wm-pill wm-pill--${b.enrolled ? "ok" : "warn"}`}>
                  {b.enrolled ? "Enrolled" : "Eligible at 30 hr/wk"}
                </span>
              </div>
              <div className="wm-benefit-desc">{b.desc}</div>
              <div className="wm-benefit-amt">
                <span className="amt">{b.contribution}</span>
                {b.cadence ? <span className="cad">{b.cadence}</span> : null}
              </div>
            </div>
          ))}
        </div>

        <div className="wm-section-title">Resources</div>
        <div className="wm-link-row" role="button">
          <span className="wm-link-row-label"><WmIcon name="help" size={18} style={{ marginRight: 10, verticalAlign: "-3px" }} />Plan documents (PDF)</span>
          <WmIcon name="chevron-r" size={18} />
        </div>
        <div className="wm-link-row" role="button">
          <span className="wm-link-row-label"><WmIcon name="phone" size={18} style={{ marginRight: 10, verticalAlign: "-3px" }} />Talk to a benefits advisor</span>
          <WmIcon name="chevron-r" size={18} />
        </div>
        <div style={{ height: 24 }} />
      </div>
    </React.Fragment>
  );
}

// =====================================================================
// PAY STUBS
// =====================================================================
function _wmGroupPayPeriods(shifts) {
  // Group completed shifts into bi-weekly periods. Period boundary =
  // Sunday-to-Saturday two-week run, anchored to today.
  const done = shifts.filter((s) => s.status === "completed" && s._sortDate);
  if (done.length === 0) return [];
  const today = window.flexToday ? window.flexToday() : new Date();
  const groups = new Map();
  done.forEach((s) => {
    const d = new Date(s._sortDate);
    const ms = (today - d) / 86400000;
    const periodIdx = Math.floor(ms / 14);
    if (!groups.has(periodIdx)) groups.set(periodIdx, []);
    groups.get(periodIdx).push(s);
  });
  return Array.from(groups.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([idx, list], i) => {
      const dates = list.map((s) => new Date(s._sortDate)).sort((a, b) => a - b);
      const start = dates[0];
      const end = dates[dates.length - 1];
      const gross = list.reduce((n, s) => n + s.pay, 0);
      // Synth deductions
      const fed = gross * 0.12;
      const fica = gross * 0.0765;
      const state = gross * 0.04;
      const net = gross - fed - fica - state;
      return {
        id: `pp-${idx}`,
        start, end,
        shifts: list,
        gross,
        deductions: { fed, fica, state },
        net,
        status: i === 0 && idx === 0 ? "Pending" : "Direct deposit",
      };
    })
    .reverse();
}
function WmPaystubsPanel({ worker, shifts, onBack }) {
  const periods = _wmMemo(() => _wmGroupPayPeriods(shifts), [shifts]);
  const ytdGross = periods.reduce((n, p) => n + p.gross, 0);
  const ytdNet = periods.reduce((n, p) => n + p.net, 0);
  const [openIdx, setOpenIdx] = _wmState(0);
  return (
    <React.Fragment>
      <WmPanelHeader title="Pay stubs" onBack={onBack} />
      <div className="wm-scroll">
        <div className="wm-paystub-hero">
          <div className="wm-paystub-hero-label">Year to date · net</div>
          <div className="wm-paystub-hero-amt">{_wm$(ytdNet || 0)}</div>
          <div className="wm-paystub-hero-sub">Gross {_wm$(ytdGross || 0)} · {periods.length} pay period{periods.length === 1 ? "" : "s"}</div>
        </div>

        {periods.length === 0 ? (
          <div className="wm-empty" style={{ marginTop: 0 }}>
            <div className="wm-empty-icon"><WmIcon name="qr" size={22} /></div>
            <h3>No pay stubs yet</h3>
            <p>When you complete a shift, your pay stub shows up here on the next pay date.</p>
          </div>
        ) : (
          <React.Fragment>
            <div className="wm-section-title">Pay periods</div>
            <div className="wm-paystub-list">
              {periods.map((p, i) => {
                const open = openIdx === i;
                return (
                  <div className={`wm-paystub${open ? " is-open" : ""}`} key={p.id}>
                    <button type="button" className="wm-paystub-head" onClick={() => setOpenIdx(open ? -1 : i)}>
                      <div className="wm-paystub-range">
                        <div className="wm-paystub-dates">{_wmFmtDate(p.start)} – {_wmFmtDate(p.end)}</div>
                        <div className="wm-paystub-status">{p.shifts.length} shift{p.shifts.length === 1 ? "" : "s"} · {p.status}</div>
                      </div>
                      <div className="wm-paystub-amt">
                        <div className="net">{_wm$(p.net)}</div>
                        <div className="gross">Gross {_wm$(p.gross)}</div>
                      </div>
                    </button>
                    {open && (
                      <div className="wm-paystub-body">
                        <div className="wm-paystub-section-title">Earnings</div>
                        {p.shifts.map((s) => (
                          <div className="wm-paystub-row" key={s.id}>
                            <span className="k">{s.role}</span>
                            <span className="d">{s.dateLabel.replace(/^.*·\s*/, "")} · {s.hours.toFixed(2)} hr</span>
                            <span className="v">{_wm$(s.pay)}</span>
                          </div>
                        ))}
                        <div className="wm-paystub-row wm-paystub-row--total">
                          <span className="k">Gross pay</span>
                          <span className="v">{_wm$(p.gross)}</span>
                        </div>
                        <div className="wm-paystub-section-title">Deductions</div>
                        <div className="wm-paystub-row"><span className="k">Federal tax</span><span className="v">−{_wm$(p.deductions.fed)}</span></div>
                        <div className="wm-paystub-row"><span className="k">FICA (Social Security + Medicare)</span><span className="v">−{_wm$(p.deductions.fica)}</span></div>
                        <div className="wm-paystub-row"><span className="k">State tax</span><span className="v">−{_wm$(p.deductions.state)}</span></div>
                        <div className="wm-paystub-row wm-paystub-row--total">
                          <span className="k">Net pay</span>
                          <span className="v">{_wm$(p.net)}</span>
                        </div>
                        <button type="button" className="wm-btn wm-btn--ghost wm-btn--block" style={{ marginTop: 12 }}>
                          Download PDF
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </React.Fragment>
        )}
        <div style={{ height: 24 }} />
      </div>
    </React.Fragment>
  );
}

// =====================================================================
// SETTINGS
// =====================================================================
function WmSettingsPanel({ worker, onBack }) {
  const supLabel = _wmSupLabel(worker);
  const [notif, setNotif] = _wmState({
    invites: true,
    reminders: true,
    paid: true,
    marketing: false,
  });
  const [dist, setDist] = _wmState(25);
  const toggle = (k) => setNotif((n) => ({ ...n, [k]: !n[k] }));
  const initials = ((worker && worker.name) || "??").split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  return (
    <React.Fragment>
      <WmPanelHeader title="Settings" onBack={onBack} />
      <div className="wm-scroll">
        <div className="wm-profile">
          <div className="wm-profile-av" aria-hidden="true">{initials}</div>
          <div className="wm-profile-body">
            <div className="wm-profile-name">{(worker && worker.name) || "Worker"}</div>
            <div className="wm-profile-sub">{supLabel} · ID {(worker && worker.workerId) || "—"}</div>
          </div>
          <button type="button" className="wm-iconbtn" aria-label="Edit profile"><WmIcon name="edit" size={18} /></button>
        </div>

        <div className="wm-section-title">Account</div>
        <div className="wm-link-row" role="button">
          <span className="wm-link-row-label">Personal info</span>
          <WmIcon name="chevron-r" size={18} />
        </div>
        <div className="wm-link-row" role="button">
          <span className="wm-link-row-label">Direct deposit</span>
          <WmIcon name="chevron-r" size={18} />
        </div>
        <div className="wm-link-row" role="button">
          <span className="wm-link-row-label">Tax forms (W-2, 1099)</span>
          <WmIcon name="chevron-r" size={18} />
        </div>

        <div className="wm-section-title">Preferences</div>
        <div className="wm-row-stack">
          {[
            { k: "invites",   label: "New shift invites",       sub: "Push + SMS when a matching shift comes in." },
            { k: "reminders", label: "Shift reminders",         sub: "We'll ping you 1 hour before each shift." },
            { k: "paid",      label: "Pay statement landed",    sub: "Notify when direct deposit clears." },
            { k: "marketing", label: "Tips & training",         sub: "Occasional emails — never about a specific shift." },
          ].map((it) => (
            <div className="wm-toggle-row" key={it.k}>
              <div className="wm-toggle-body">
                <div className="wm-toggle-label">{it.label}</div>
                <div className="wm-toggle-sub">{it.sub}</div>
              </div>
              <button
                type="button"
                className={`wm-toggle${notif[it.k] ? " is-on" : ""}`}
                aria-pressed={notif[it.k]}
                onClick={() => toggle(it.k)}
              >
                <span className="wm-toggle-knob" />
              </button>
            </div>
          ))}
        </div>

        <div className="wm-section-title">Travel radius</div>
        <div className="wm-row-stack">
          <div className="wm-stepper">
            <div className="wm-stepper-body">
              <div className="wm-stepper-label">Maximum distance</div>
              <div className="wm-stepper-sub">Don't show me shifts farther than this.</div>
            </div>
            <div className="wm-stepper-controls">
              <button type="button" aria-label="Decrease" onClick={() => setDist((n) => Math.max(5, n - 5))}>−</button>
              <span className="wm-stepper-value">{dist} mi</span>
              <button type="button" aria-label="Increase" onClick={() => setDist((n) => Math.min(60, n + 5))}>+</button>
            </div>
          </div>
        </div>

        <div className="wm-section-title">App</div>
        <div className="wm-link-row" role="button">
          <span className="wm-link-row-label">Language · English (US)</span>
          <WmIcon name="chevron-r" size={18} />
        </div>
        <div className="wm-link-row" role="button">
          <span className="wm-link-row-label">Privacy policy</span>
          <WmIcon name="chevron-r" size={18} />
        </div>
        <div className="wm-link-row" role="button">
          <span className="wm-link-row-label" style={{ color: "var(--evr-interactive-error-default)" }}>Sign out</span>
          <WmIcon name="chevron-r" size={18} />
        </div>
        <div style={{ padding: "20px", font: "var(--evr-caption)", color: "var(--evr-content-primary-lowemp)", textAlign: "center" }}>
          Dayforce Flex Work · v2.4.0 · Build 1426
        </div>
      </div>
    </React.Fragment>
  );
}

// =====================================================================
// REFER A FRIEND
// =====================================================================
function _wmReferralCode(worker) {
  // First name + 4 digits derived from id hash → "MAYA-4291"
  const first = ((worker && worker.name) || "FRIEND").split(/\s+/)[0].toUpperCase().slice(0, 4);
  const h = _wmHash(worker && worker.id);
  return `${first}-${String(h % 10000).padStart(4, "0")}`;
}
function WmReferPanel({ worker, onBack }) {
  const code = _wmMemo(() => _wmReferralCode(worker), [worker && worker.id]);
  const h = _wmHash(worker && worker.id);
  const stats = {
    sent:    2 + (h & 0x3),
    joined:  1 + ((h >> 2) & 0x1),
    paid:    1 + ((h >> 4) & 0x1),
    earned:  50 * (1 + ((h >> 4) & 0x1)),
  };
  const [copied, setCopied] = _wmState(false);
  const onCopy = () => {
    if (navigator.clipboard) navigator.clipboard.writeText(code).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };
  return (
    <React.Fragment>
      <WmPanelHeader title="Refer a friend" onBack={onBack} />
      <div className="wm-scroll">
        <div className="wm-refer-hero">
          <div className="wm-refer-amount">$50</div>
          <div className="wm-refer-title">For every friend who works 3 shifts</div>
          <div className="wm-refer-text">
            Hey {_wmFirstName(worker)} — share your code below. We'll deposit $50 once they complete their first 3 shifts. No cap.
          </div>
        </div>

        <div className="wm-section-title">Your code</div>
        <div className="wm-refer-code-card">
          <div className="wm-refer-code">{code}</div>
          <button type="button" className="wm-btn wm-btn--ghost" onClick={onCopy}>{copied ? "Copied" : "Copy"}</button>
        </div>
        <div style={{ padding: "12px 20px 0" }}>
          <button type="button" className="wm-btn wm-btn--block">
            <WmIcon name="chat" size={18} />Share invite
          </button>
        </div>

        <div className="wm-section-divider" />
        <div className="wm-section-title">Your referrals</div>
        <div className="wm-refer-stats">
          <div className="wm-refer-stat">
            <div className="v">{stats.sent}</div>
            <div className="l">Invites sent</div>
          </div>
          <div className="wm-refer-stat">
            <div className="v">{stats.joined}</div>
            <div className="l">Joined</div>
          </div>
          <div className="wm-refer-stat">
            <div className="v">{stats.paid}</div>
            <div className="l">Paid out</div>
          </div>
          <div className="wm-refer-stat wm-refer-stat--accent">
            <div className="v">{_wm$(stats.earned)}</div>
            <div className="l">Total earned</div>
          </div>
        </div>

        <div className="wm-section-title">How it works</div>
        <div className="wm-info">
          <div className="wm-info-icon"><WmIcon name="chat" size={22} /></div>
          <div className="wm-info-body">
            <div className="wm-info-title">1. Share your code</div>
            Send it to anyone looking for flexible work.
          </div>
        </div>
        <div className="wm-info">
          <div className="wm-info-icon"><WmIcon name="briefcase" size={22} /></div>
          <div className="wm-info-body">
            <div className="wm-info-title">2. They sign up and work</div>
            Once they complete 3 shifts you both earn $50.
          </div>
        </div>
        <div className="wm-info">
          <div className="wm-info-icon"><WmIcon name="qr" size={22} /></div>
          <div className="wm-info-body">
            <div className="wm-info-title">3. Get paid</div>
            We add the bonus to your next pay statement.
          </div>
        </div>
        <div style={{ height: 24 }} />
      </div>
    </React.Fragment>
  );
}

// =====================================================================
// HELP CENTRE
// =====================================================================
function WmHelpPanel({ worker, shifts, onBack }) {
  const upcoming = shifts.find((s) => s.status === "upcoming" || s.status === "active");
  const supLabel = _wmSupLabel(worker);
  const sections = [
    {
      title: "Frequent questions",
      items: [
        { q: "How do clock-in and clock-out work?",     a: "Use the time clock at the site (badge or face scan), or scan a QR / share your location via the app." },
        { q: "When will I get paid?",                    a: "Pay runs every other Friday. Direct deposit lands 24–48 hours later." },
        { q: "What if I can't make my shift?",           a: `Open the shift detail and tap “Opt out” for upcoming shifts more than 24h out, or call ${supLabel} for last-minute changes.` },
        { q: "How do I update my availability?",         a: "Tap Availability in the More tab. Changes take effect immediately for future invites." },
        { q: "Why didn't I get matched with a shift?",   a: "Common reasons: outside availability window, certification expired, or distance over your travel cap. Check Skills + Settings." },
      ],
    },
  ];
  const [open, setOpen] = _wmState(0);
  return (
    <React.Fragment>
      <WmPanelHeader title="Help centre" onBack={onBack} />
      <div className="wm-scroll">
        {upcoming && (
          <div className="wm-help-context">
            <div className="wm-help-context-label">Need help with a specific shift?</div>
            <div className="wm-help-context-title">{upcoming.role} · {upcoming.dateLabel}</div>
            <div className="wm-help-context-sub">{upcoming.location}</div>
            <button type="button" className="wm-btn wm-btn--ghost">Open shift</button>
          </div>
        )}

        {sections.map((sec) => (
          <React.Fragment key={sec.title}>
            <div className="wm-section-title">{sec.title}</div>
            <div className="wm-faq">
              {sec.items.map((it, i) => (
                <div className={`wm-faq-row${open === i ? " is-open" : ""}`} key={i}>
                  <button type="button" className="wm-faq-q" onClick={() => setOpen(open === i ? -1 : i)} aria-expanded={open === i}>
                    <span>{it.q}</span>
                    <WmIcon name={open === i ? "x" : "chevron-r"} size={16} />
                  </button>
                  {open === i && <div className="wm-faq-a">{it.a}</div>}
                </div>
              ))}
            </div>
          </React.Fragment>
        ))}

        <div className="wm-section-title">Still stuck?</div>
        <div className="wm-link-row" role="button">
          <span className="wm-link-row-label"><WmIcon name="chat" size={18} style={{ marginRight: 10, verticalAlign: "-3px" }} />Chat with Dayforce support</span>
          <WmIcon name="chevron-r" size={18} />
        </div>
        <div className="wm-link-row" role="button">
          <span className="wm-link-row-label"><WmIcon name="phone" size={18} style={{ marginRight: 10, verticalAlign: "-3px" }} />Call {supLabel} dispatch</span>
          <WmIcon name="chevron-r" size={18} />
        </div>
        <div className="wm-link-row" role="button">
          <span className="wm-link-row-label"><WmIcon name="mail" size={18} style={{ marginRight: 10, verticalAlign: "-3px" }} />Email support</span>
          <WmIcon name="chevron-r" size={18} />
        </div>
        <div style={{ height: 24 }} />
      </div>
    </React.Fragment>
  );
}

// =====================================================================
// FEEDBACK
// =====================================================================
const WM_FB_TOPICS = [
  { id: "app",      label: "App bug / glitch" },
  { id: "shift",    label: "A specific shift" },
  { id: "agency",   label: "My supplier / agency" },
  { id: "pay",      label: "Pay or benefits" },
  { id: "feature",  label: "Feature request" },
  { id: "other",    label: "Something else" },
];
function WmFeedbackPanel({ worker, onBack, onSubmit }) {
  const [topic, setTopic] = _wmState(null);
  const [text, setText]   = _wmState("");
  const [sent, setSent]   = _wmState(false);
  const canSend = topic && text.trim().length >= 4 && !sent;
  const submit = () => {
    if (!canSend) return;
    setSent(true);
    if (onSubmit) onSubmit({ topic, text });
  };
  return (
    <React.Fragment>
      <WmPanelHeader title="Feedback" onBack={onBack} />
      <div className="wm-scroll">
        {sent ? (
          <div className="wm-empty" style={{ marginTop: 28 }}>
            <div className="wm-empty-icon" style={{ background: "var(--evr-surface-decorative-default-green)", color: "var(--evr-content-decorative-green)" }}>
              <WmIcon name="check-circle" size={26} />
            </div>
            <h3>Thanks, {_wmFirstName(worker)}</h3>
            <p>We read every note. If we need more from you, the product team will reach out via email.</p>
            <button type="button" className="wm-btn" onClick={onBack}>Back to More</button>
          </div>
        ) : (
          <React.Fragment>
            <div style={{ padding: "8px 20px 12px", font: "var(--evr-body2)", color: "var(--evr-content-primary-default)" }}>
              Tell us what's working, what isn't, or what you wish we'd build. It goes straight to the Dayforce product team.
            </div>
            <div className="wm-section-title">What's this about?</div>
            <div className="wm-fb-topics">
              {WM_FB_TOPICS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className={`wm-fb-topic${topic === t.id ? " is-on" : ""}`}
                  onClick={() => setTopic(t.id)}
                  aria-pressed={topic === t.id}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div className="wm-section-title">Your message</div>
            <div className="wm-fb-textarea-wrap">
              <textarea
                className="wm-fb-textarea"
                rows={6}
                value={text}
                placeholder="What's on your mind?"
                onChange={(e) => setText(e.target.value)}
              />
              <div className="wm-fb-textarea-count">{text.length} / 600</div>
            </div>
            <div style={{ padding: "0 20px 12px", font: "var(--evr-caption)", color: "var(--evr-content-primary-lowemp)" }}>
              Sent as <b>{(worker && worker.name) || "Worker"}</b>. We'll attach your worker ID + app version so support can find you quickly.
            </div>
          </React.Fragment>
        )}
      </div>
      {!sent && (
        <div className="wm-action-bar">
          <button type="button" className="wm-btn wm-btn--ghost" onClick={onBack}>Cancel</button>
          <button type="button" className="wm-btn" disabled={!canSend} style={!canSend ? { opacity: 0.5, pointerEvents: "none" } : null} onClick={submit}>
            Send feedback
          </button>
        </div>
      )}
    </React.Fragment>
  );
}

// =====================================================================
// MORE — top-level grid tile screen
// =====================================================================
function WmMoreScreen({ worker, shifts, onHelp, onOpen, onExitWorker }) {
  const interviewsOn = !!(window.getFeatureFlag && window.getFeatureFlag("interviews"));
  const engProjectOn = !!(window.getFeatureFlag && window.getFeatureFlag("engProject"));
  const tiles = [
    // Interviews tile — only when the `interviews` feature flag is on.
    // Opens a panel that renders the W1–W9 candidate portal surfaces.
    ...(interviewsOn ? [{ id: "interviews", label: "Interviews", icon: "cal-check" }] : []),
    // Projects tile — only when the `engProject` engagement-type flag
    // is on. Opens the worker-side project surface (landing, task-coded
    // time entry, scope acknowledgement).
    ...(engProjectOn  ? [{ id: "projects",   label: "Projects",   icon: "sparkle"   }] : []),
    { id: "availability", label: "Availability",   icon: "cal-check" },
    { id: "skills",       label: "Skills",         icon: "sparkle" },
    { id: "certs",        label: "Certifications", icon: "star" },
    { id: "benefits",     label: "Benefits",       icon: "coffee" },
    { id: "paystubs",     label: "Pay stubs",      icon: "qr" },
    { id: "settings",     label: "Settings",       icon: "grid" },
    { id: "refer",        label: "Refer a friend", icon: "lightning" },
    { id: "help",         label: "Help centre",    icon: "help" },
    { id: "feedback",     label: "Feedback",       icon: "chat" },
  ];
  const status = (worker && worker.status) || "Compliant";
  const shiftCount = (worker && worker.shifts) != null ? worker.shifts : 47;
  const rating = (4.2 + ((_wmHash(worker && worker.id) % 80) / 100)).toFixed(1);
  const compliant = status === "Compliant";
  return (
    <React.Fragment>
      <WmHeader title="More" onHelp={onHelp} />
      <div className="wm-scroll">
        <div className={`wm-banner${compliant ? "" : " wm-banner--warn"}`}>
          <div className="wm-banner-title">Welcome back, {_wmFirstName(worker)}!</div>
          {compliant
            ? <React.Fragment>You're <b>compliant</b> with all required certifications. {shiftCount} shifts worked · {rating} ★ avg rating.</React.Fragment>
            : status === "Onboarding"
              ? <React.Fragment>You're still <b>onboarding</b>. Finish your certifications below to start getting shift invites.</React.Fragment>
              : <React.Fragment>A certification has <b>expired</b>. Renew it from Certifications to get back to taking shifts.</React.Fragment>}
        </div>
        <div className="wm-grid">
          {tiles.map((t) => (
            <button key={t.id} type="button" className="wm-tile" onClick={() => onOpen && onOpen(t.id)}>
              <WmIcon name={t.icon} size={22} />
              <span className="wm-tile-label">{t.label}</span>
            </button>
          ))}
        </div>
        <div style={{ padding: "0 20px 28px" }}>
          <button type="button" className="wm-btn wm-btn--ghost wm-btn--block" onClick={onExitWorker}>
            Exit worker view
          </button>
        </div>
      </div>
    </React.Fragment>
  );
}

// =====================================================================
// DECLINE / OPT-OUT BOTTOM SHEET
// =====================================================================
function WmReasonSheet({ kind, onClose, onSubmit }) {
  const reasons = kind === "decline"
    ? [
        { id: "schedule",  label: "Schedule conflict" },
        { id: "distance",  label: "Too far away" },
        { id: "pay",       label: "Pay doesn't work for me" },
        { id: "skill",     label: "Not a match for my skills" },
        { id: "other",     label: "Other" },
      ]
    : [
        { id: "sick",      label: "I'm sick" },
        { id: "family",    label: "Family emergency" },
        { id: "schedule",  label: "Schedule changed" },
        { id: "other",     label: "Other" },
      ];
  const [picked, setPicked] = _wmState(null);
  return (
    <div className="wm-sheet-backdrop" onClick={onClose}>
      <div className="wm-sheet" onClick={(e) => e.stopPropagation()}>
        <h3>{kind === "decline" ? "Decline this invite?" : "Opt out of this shift?"}</h3>
        <p>
          {kind === "decline"
            ? "The supplier will be notified and may offer this shift to someone else. No penalty."
            : "Heads up: opting out within 24 hours of the shift may count against your reliability score."}
        </p>
        <div className="wm-sheet-reasons">
          {reasons.map((r) => (
            <button
              key={r.id}
              type="button"
              className={`wm-sheet-reason${picked === r.id ? " is-on" : ""}`}
              onClick={() => setPicked(r.id)}
            >
              <span>{r.label}</span>
            </button>
          ))}
        </div>
        <div className="wm-sheet-actions">
          <button type="button" className="wm-btn wm-btn--ghost" onClick={onClose}>Cancel</button>
          <button
            type="button"
            className={kind === "decline" ? "wm-btn wm-btn--danger" : "wm-btn wm-btn--danger"}
            disabled={!picked}
            onClick={() => onSubmit(picked)}
            style={!picked ? { opacity: 0.5, pointerEvents: "none" } : null}
          >
            {kind === "decline" ? "Decline" : "Opt out"}
          </button>
        </div>
      </div>
    </div>
  );
}

// =====================================================================
// TRAVEL-MODE BOTTOM SHEET — "How will you be travelling?"
// Pops after the worker taps "I'm on my way" on the shift detail screen.
// Picking a mode flips the shift to status="active" and starts the
// en-route phase on the Active screen.
// =====================================================================
const WM_TRAVEL_OPTIONS = [
  { id: "walk",    label: "Walk",          icon: "PersonWalking",   speed: 4.5 },
  { id: "bike",    label: "Bike",          icon: "Bike",            speed: 14  },
  { id: "car",     label: "Car",           icon: "Car",             speed: 30  },
  { id: "transit", label: "Public transit",icon: "Train",           speed: 12  },
];
function WmTravelSheet({ onClose, onPick }) {
  return (
    <div className="wm-sheet-backdrop wm-sheet-backdrop--center" onClick={onClose}>
      <div className="wm-choice-sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="How will you be travelling?">
        <div className="wm-choice-sheet-title">How will you be travelling?</div>
        {WM_TRAVEL_OPTIONS.map((opt) => (
          <button
            key={opt.id}
            type="button"
            className="wm-choice-sheet-row"
            onClick={() => onPick(opt)}
          >
            {opt.label}
          </button>
        ))}
        <button
          type="button"
          className="wm-choice-sheet-row wm-choice-sheet-row--cancel"
          onClick={onClose}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// =====================================================================
// CANCEL-SHIFT BOTTOM SHEET — opens from the shift detail "..." menu.
// Workers can't self-cancel a confirmed shift; they have to call the
// agency. The sheet routes them to a tappable phone number.
// =====================================================================
function WmCancelShiftSheet({ agencyName, agencyPhone, onClose, onCall }) {
  const label = `Call ${agencyName}`;
  return (
    <div className="wm-sheet-backdrop wm-sheet-backdrop--center" onClick={onClose}>
      <div className="wm-choice-sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Cancel shift">
        <div className="wm-choice-sheet-title">To cancel your shift, please call {agencyName}</div>
        <button
          type="button"
          className="wm-choice-sheet-row wm-choice-sheet-row--primary"
          onClick={() => onCall && onCall(agencyPhone)}
        >
          {label}
        </button>
        <button
          type="button"
          className="wm-choice-sheet-row wm-choice-sheet-row--cancel"
          onClick={onClose}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// =====================================================================
// "..." MORE-MENU on the shift detail header.
// Add to calendar (always) + Cancel shift (only on upcoming + active).
// Lives as a small floating popover anchored to the header button.
// =====================================================================
function WmDetailMoreMenu({ canCancel, onClose, onAddToCalendar, onCancelShift }) {
  _wmEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <React.Fragment>
      <div className="wm-popover-backdrop" onClick={onClose} />
      <div className="wm-popover wm-detail-more" role="menu">
        <button
          type="button"
          className="wm-popover-row"
          onClick={() => { onClose(); onAddToCalendar && onAddToCalendar(); }}
        >
          <span className="wm-popover-icon"><WmIcon name="cal-add" size={18} /></span>
          <span>Add to calendar</span>
        </button>
        {canCancel && (
          <button
            type="button"
            className="wm-popover-row wm-popover-row--danger"
            onClick={() => { onClose(); onCancelShift && onCancelShift(); }}
          >
            <span className="wm-popover-icon"><WmIcon name="x-circle" size={18} /></span>
            <span>Cancel shift</span>
          </button>
        )}
      </div>
    </React.Fragment>
  );
}

// =====================================================================
// EN-ROUTE MAP — stylised street card with a walking route, ETA chip,
// and a bottom "En Route MM:SS" timer pill. Rendered as inline SVG so it
// works offline + scales to any container size.
// =====================================================================
function WmRouteMap({ etaMin, elapsedSec, mode = "walk" }) {
  const fmt = (sec) => {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    return [h, m, s].map((n) => String(n).padStart(2, "0")).join(":");
  };
  const modeIcon = mode === "bike"    ? "Bike"
                 : mode === "car"     ? "Car"
                 : mode === "transit" ? "Train"
                 : "PersonWalking";
  // Friendly label so the chip + timer match the picked travel mode.
  // (The icon glyph at the destination pin uses a sparkle, matching
  // the Figma — see the SVG below.)
  void modeIcon;
  return (
    <div className="wm-route-map" aria-hidden="true">
      <svg className="wm-route-map-svg" viewBox="0 0 360 240" preserveAspectRatio="xMidYMid slice">
        {/* Base map tint */}
        <rect width="360" height="240" fill="#EEF0EC" />
        {/* Faint blocks */}
        <g fill="#FFFFFF">
          <rect x="8"   y="8"   width="84" height="44" rx="3" />
          <rect x="100" y="8"   width="120" height="38" rx="3" />
          <rect x="228" y="8"   width="124" height="60" rx="3" />
          <rect x="8"   y="60"  width="68"  height="56" rx="3" />
          <rect x="86"  y="54"  width="130" height="68" rx="3" />
          <rect x="228" y="78"  width="60"  height="60" rx="3" />
          <rect x="296" y="78"  width="56"  height="60" rx="3" />
          <rect x="8"   y="124" width="80"  height="62" rx="3" />
          <rect x="98"  y="130" width="120" height="60" rx="3" />
          <rect x="228" y="146" width="124" height="48" rx="3" />
          <rect x="8"   y="196" width="160" height="36" rx="3" />
          <rect x="178" y="202" width="174" height="30" rx="3" />
        </g>
        {/* Pale green park */}
        <rect x="260" y="146" width="44" height="38" rx="6" fill="#D9E6CF" />
        {/* Streets */}
        <g stroke="#FFFFFF" strokeWidth="6" strokeLinecap="round">
          <line x1="0"   y1="56"  x2="360" y2="56" />
          <line x1="0"   y1="124" x2="360" y2="124" />
          <line x1="0"   y1="196" x2="360" y2="196" />
          <line x1="92"  y1="0"   x2="92"  y2="240" />
          <line x1="224" y1="0"   x2="224" y2="240" />
        </g>
        <g stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" opacity="0.7">
          <line x1="0"   y1="92"  x2="360" y2="92" />
          <line x1="0"   y1="160" x2="360" y2="160" />
          <line x1="48"  y1="0"   x2="48"  y2="240" />
          <line x1="160" y1="0"   x2="160" y2="240" />
          <line x1="300" y1="0"   x2="300" y2="240" />
        </g>
        {/* Walking route — dotted black path that turns once */}
        <path
          d="M 92 196 L 92 124 L 224 124 L 224 70"
          fill="none"
          stroke="#1F1F23"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray="0.1 8"
        />
        {/* Origin dot */}
        <circle cx="92" cy="196" r="9" fill="#FFFFFF" stroke="#1F1F23" strokeWidth="3" />
        {/* Destination pin */}
        <g transform="translate(224 70)">
          <circle r="14" fill="#C4202F" />
          <path d="M 0 14 L -6 22 L 6 22 Z" fill="#C4202F" />
          <path d="M -3 -4 L 3 0 L -3 4 Z" fill="#FFFFFF" />
        </g>
      </svg>
      {/* Walking-time chip near the pin */}
      <div className="wm-route-eta">
        <WmIcon name="footprints" size={12} />
        <span>{etaMin} mins</span>
      </div>
      {/* En Route pill at the bottom of the map */}
      <div className="wm-route-pill">
        <span>En Route</span>
        <span className="wm-route-pill-dot" />
        <span className="wm-route-pill-time">{fmt(elapsedSec)}</span>
      </div>
    </div>
  );
}

// =====================================================================
// MAIN — the whole worker mobile app
// =====================================================================
// ---------- Worker pool for the dock "Switch worker" picker ------------
// The picker lists workers that belong to the *current organization*.
// When the active tenant is a staffing agency (e.g. StaffWise), window.WORKERS
// is already pre-scoped to that agency's roster in workforce.jsx. Otherwise
// the buyer-org sees its full mixed roster (Agency + Internal + Float +
// Per-diem + Alumni). Every entry is 1:1 with the rest of the demo — same
// id, name, supplier, jobs, status — so the chip + caption read coherently
// with timesheets / schedule / requisitions elsewhere.
function _wmGetWorkerPool() {
  const all = (typeof window !== "undefined" && window.WORKERS) || [];
  // De-dupe by name in case industry variants share a row (e.g. Priya
  // Aravind has per-industry job copies but is the same person).
  const seen = new Set();
  return all.filter((w) => {
    if (seen.has(w.name)) return false;
    seen.add(w.name);
    return true;
  });
}
function _wmInitialsFor(name) {
  return (window.initialsFor || ((s) => (s || "").split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase()))(name);
}
function _wmPaletteFor(id) {
  return (window.paletteFor || ((s) => ({ bg: "#f5b8a4", fg: "#5A1414" })))(id);
}
function _wmDefaultWorker(pool) {
  if (!pool || pool.length === 0) return { id: "w-ml", name: "Maya Lin", supplier: "sw", pool: "Agency", jobs: [] };
  // Prefer Maya Lin if she's in the org's pool; else fall back to the
  // first worker so the demo always has someone to show.
  return pool.find((w) => w.name === "Maya Lin") || pool[0];
}

// ---------- Shift derivation from canonical demo data ------------------
// The worker mobile app shows a per-worker list of shifts that MUST stay
// 1:1 with the rest of the prototype — same booking IDs, same dates,
// same role / location / times — so toggling the picker from the agency
// chrome lands on the same world the agency just left.
//
// We derive each worker's shift list from three sources already wired
// through window:
//   • window.SCH_WORKER_SCHED  — the canonical per-worker weekly plan
//                                 used by the desktop Schedule page.
//                                 (drives upcoming + active shifts)
//   • window.TIMESHEETS        — closed / open / pending timesheets
//                                 used by the desktop Timesheets page.
//                                 (drives past / completed shifts)
//   • window.REQUISITIONS      — booking metadata (location, time,
//                                 break length, booker, supplier list).
//                                 (lifts location / address / contact)
// A synthetic invite is added when an open req on this supplier still
// has unfilled capacity for one of this worker's certified jobs — so
// the Invites tab isn't empty.
function _wmParseClockTime(t) {
  const m = /(\d+):(\d+)\s*(AM|PM)/i.exec(t || "");
  if (!m) return null;
  let h = parseInt(m[1], 10) % 12;
  if (m[3].toUpperCase() === "PM") h += 12;
  return h * 60 + parseInt(m[2], 10);
}
function _wmHoursBetween(start, end) {
  const s = _wmParseClockTime(start);
  const e = _wmParseClockTime(end);
  if (s == null || e == null) return 0;
  let d = e - s;
  if (d <= 0) d += 24 * 60;
  return d / 60;
}
function _wmParseTimeRange(time) {
  const parts = String(time || "").split(/\s*[–-]\s*/);
  return { start: parts[0] || "", end: parts[1] || "" };
}
function _wmParseBreakLabel(label) {
  const m = /(\d+)/.exec(label || "");
  return m ? parseInt(m[1], 10) : 30;
}
function _wmRateFor(role) {
  const r = String(role || "").toLowerCase();
  if (/manager|lead|supervisor/.test(r)) return 28;
  if (/bartender|sommelier|mixologist/.test(r)) return 24;
  if (/inspector|operator|electrician|maintenance|forklift/.test(r)) return 22;
  if (/cook|prep/.test(r)) return 19;
  if (/assembler|factory|driver|dispatch/.test(r)) return 21;
  if (/nurse|rn|icu|med-surg/.test(r)) return 54;
  if (/server|host|banquet|sales|cashier|stocker|associate|picker|clerk/.test(r)) return 18;
  return 18;
}
function _wmLocationFor(name) {
  return (window.LOCATIONS || []).find((l) => l.name === name) || null;
}
function _wmParseTsDate(d) {
  const m = /(\d+)\.(\d+)\.(\d+)/.exec(d || "");
  if (!m) return null;
  return new Date(parseInt(m[3], 10), parseInt(m[1], 10) - 1, parseInt(m[2], 10));
}
function _wmFmtDateLabel(date, today) {
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
function _wmFmtDay(date) {
  return date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
}
function _wmFmtDateShort(date) {
  return {
    m: date.toLocaleDateString("en-US", { month: "short" }),
    d: String(date.getDate()),
  };
}
function _wmBuildShiftsForWorker(workerId) {
  const worker = (window.WORKERS || []).find((w) => w.id === workerId);
  if (!worker) return [];
  const reqs       = window.REQUISITIONS || [];
  const ts         = window.TIMESHEETS || [];
  const schedRows  = window.SCH_WORKER_SCHED || [];
  const days       = window.SCH_DAYS || [];
  const today      = window.flexToday ? window.flexToday() : new Date();
  const reqSup     = window.REQ_SUPPLIERS || {};
  const sup        = reqSup[worker.supplier];
  const supLabel   = sup ? sup.label : (worker.pool || "Direct");

  const out = [];

  // -------- Upcoming: SCH_WORKER_SCHED expanded into per-day rows --------
  const myRow = schedRows.find((r) => r.worker === workerId);
  if (myRow) {
    const req = reqs.find((r) => r.id === myRow.reqId);
    myRow.shifts.forEach((s, si) => {
      const startIdx = days.findIndex((d) => d.key === s.day);
      if (startIdx < 0) return;
      for (let j = 0; j < (s.span || 1); j++) {
        const day = days[startIdx + j];
        if (!day) continue;
        const date = new Date(day.year, day.month, day.date);
        const { start, end } = _wmParseTimeRange(s.time);
        const hours = _wmHoursBetween(start, end);
        const rate  = _wmRateFor(s.role);
        const loc   = req ? _wmLocationFor(req.location) : null;
        const isToday = date.toDateString() === today.toDateString();
        out.push({
          id: `${myRow.reqId}-${day.key}-${si}-${j}`,
          status: isToday ? "active" : "upcoming",
          role: s.role,
          org: req ? `${req.location}` : supLabel,
          program: req ? `Work assignment ${req.id}` : (sup ? sup.label : "Direct"),
          address: loc ? loc.address : (req ? req.location : ""),
          location: req ? req.location : "",
          dateLabel: _wmFmtDateLabel(date, today),
          dateShort: _wmFmtDateShort(date),
          day: _wmFmtDay(date),
          start, end,
          hours, rate,
          pay: parseFloat((hours * rate).toFixed(2)),
          multiDay: (s.span || 1) > 1 && j === 0,
          breakMin: _wmParseBreakLabel(req && req.breakLabel),
          paidBreak: false,
          perks: [],
          distance: "12 min · 4.3 mi",
          contact: req ? `${req.bookedBy} (Manager)` : `${supLabel} dispatch`,
          instructions: "Check in at the front desk and ask for your site supervisor. Bring photo ID.",
          role_desc: `Perform ${s.role} duties for the booked shift. Follow site safety guidance and report to the on-site supervisor at the time listed below.`,
          what_to_wear: "Closed-toe non-slip shoes. Layers recommended.",
          reqId: myRow.reqId,
          bookingId: req ? req.id : null,
          _sortDate: date.getTime(),
        });
      }
    });
  }

  // -------- Past / completed: derived from TIMESHEETS for this worker ---
  ts.filter((t) => t.worker === workerId).forEach((t) => {
    const date  = _wmParseTsDate(t.date);
    const start = t.actualStart && t.actualStart !== "—" ? t.actualStart : t.schedStart;
    const end   = t.actualEnd   && t.actualEnd   !== "—" ? t.actualEnd   : t.schedEnd;
    const hours = _wmHoursBetween(start, end);
    const rate  = _wmRateFor(t.role);
    // Resolve a representative location for this booking. Timesheets
    // only carry "Assignment #786", so we walk back through the active
    // requisitions list to find the open req for this worker's role.
    const matchReq = reqs.find((r) => r.jobs && r.jobs.includes(t.role)) || null;
    const loc = matchReq ? _wmLocationFor(matchReq.location) : null;
    let status = "completed";
    if (t.status === "Open") status = "upcoming";
    out.push({
      id: t.id,
      status,
      role: t.role,
      org: matchReq ? matchReq.location : supLabel,
      program: t.booking,
      address: loc ? loc.address : (matchReq ? matchReq.location : "—"),
      location: matchReq ? matchReq.location : t.booking,
      dateLabel: date ? _wmFmtDateLabel(date, today) : t.date,
      dateShort: date ? _wmFmtDateShort(date) : { m: "", d: "" },
      day: date ? _wmFmtDay(date) : t.date,
      start, end,
      hours, rate,
      pay: parseFloat((hours * rate).toFixed(2)),
      multiDay: false,
      breakMin: 30,
      paidBreak: false,
      perks: [],
      distance: "—",
      contact: `${supLabel} dispatch`,
      instructions: status === "completed"
        ? "Shift complete — timesheet submitted to your manager."
        : "Check in at the front desk and ask for your site supervisor.",
      role_desc: `Worked as ${t.role}.`,
      what_to_wear: "—",
      clockedIn: t.actualStart !== "—" ? t.actualStart : null,
      clockedOut: t.actualEnd   !== "—" ? t.actualEnd   : null,
      paid: t.status === "Closed",
      tsId: t.id,
      tsStatus: t.status,
      _sortDate: date ? date.getTime() : 0,
    });
  });

  // -------- Invited: one synthetic invite from a matching open req ------
  // Picks a Booked requisition this agency is on the distribution for,
  // with a role the worker is certified for, distinct from the worker's
  // scheduled booking. Keeps the Invites tab populated and consistent
  // with the Requisitions list the agency sees.
  if (worker.supplier) {
    const invite = reqs.find((r) =>
      r.status === "Booked" &&
      r.suppliers && r.suppliers.includes(worker.supplier) &&
      !(myRow && r.id === myRow.reqId) &&
      r.jobs && (worker.jobs || []).some((j) => r.jobs.includes(j))
    );
    if (invite) {
      const sharedJob = (worker.jobs || []).find((j) => invite.jobs.includes(j)) || invite.jobs[0];
      const { start, end } = _wmParseTimeRange(invite.time);
      const hours = _wmHoursBetween(start, end);
      const rate  = _wmRateFor(sharedJob);
      const loc   = _wmLocationFor(invite.location);
      const date  = new Date(today); date.setDate(date.getDate() + 3);
      out.unshift({
        id: `inv-${invite.id}`,
        status: "invited",
        role: sharedJob,
        org: invite.location,
        program: `Work assignment ${invite.id}`,
        address: loc ? loc.address : invite.location,
        location: invite.location,
        dateLabel: _wmFmtDateLabel(date, today),
        dateShort: _wmFmtDateShort(date),
        day: _wmFmtDay(date),
        start, end,
        hours, rate,
        pay: parseFloat((hours * rate).toFixed(2)),
        multiDay: false,
        breakMin: _wmParseBreakLabel(invite.breakLabel),
        paidBreak: false,
        perks: ["$40.00 bonus for working 4 shifts", "$50.00 travel stipend"],
        distance: "12 min · 4.3 mi",
        contact: `${invite.bookedBy} (Manager)`,
        instructions: "Enter through the staff entrance and ask for your manager. They'll clock you in and give you a brief orientation.",
        role_desc: `Step in as a ${sharedJob} for ${invite.location}. Standard duties for the role apply — follow site safety guidance and report to your on-site supervisor.`,
        what_to_wear: "Closed-toe non-slip shoes. Layers recommended.",
        reqId: invite.id,
        bookingId: invite.id,
        _sortDate: date.getTime(),
      });
    }
  }

  // Stable ordering: invited first (already unshifted), then active (today),
  // then upcoming by date ascending, then completed by date descending.
  const invites  = out.filter((s) => s.status === "invited");
  const active   = out.filter((s) => s.status === "active").sort((a, b) => a._sortDate - b._sortDate);
  const upcoming = out.filter((s) => s.status === "upcoming").sort((a, b) => a._sortDate - b._sortDate);
  const past     = out.filter((s) => s.status === "completed").sort((a, b) => b._sortDate - a._sortDate);
  return [...invites, ...active, ...upcoming, ...past];
}

function WorkerMobileApp({ onExit }) {
  // Workers the picker is allowed to show, plus the currently-impersonated
  // worker. The chip in the dock head opens a search popover keyed on this.
  const workerPool = _wmMemo(() => _wmGetWorkerPool(), []);
  const [activeWorker, setActiveWorker] = _wmState(() => _wmDefaultWorker(workerPool));
  const [pickerOpen, setPickerOpen] = _wmState(false);
  const [pickerQuery, setPickerQuery] = _wmState("");
  const pickerRef = _wmRef(null);
  const pickerSearchRef = _wmRef(null);
  _wmEffect(() => {
    if (!pickerOpen) return undefined;
    // Focus the search field and wire outside-click + Esc to close.
    const t = setTimeout(() => pickerSearchRef.current && pickerSearchRef.current.focus(), 30);
    const onDoc = (e) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target)) {
        setPickerOpen(false);
      }
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
  const filteredWorkers = _wmMemo(() => {
    const q = pickerQuery.trim().toLowerCase();
    if (!q) return workerPool;
    return workerPool.filter((w) => {
      if (w.name.toLowerCase().includes(q)) return true;
      if ((w.jobs || []).some((j) => j.toLowerCase().includes(q))) return true;
      if (w.workerId && String(w.workerId).toLowerCase().includes(q)) return true;
      if (w.email && w.email.toLowerCase().includes(q)) return true;
      return false;
    });
  }, [pickerQuery, workerPool]);
  const activePalette = _wmPaletteFor(activeWorker.id);
  const onPickWorker = (w) => {
    setActiveWorker(w);
    setPickerOpen(false);
    setPickerQuery("");
    setToast({ app: "Dayforce Flex Work", title: "Switched worker", msg: `Previewing as ${w.name}` });
  };

  const [tab, setTab]           = _wmState("home");
  const [shiftsTab, setSubTab]  = _wmState("invites");
  const [shifts, setShifts]     = _wmState(() => _wmBuildShiftsForWorker(activeWorker.id));

  // Re-derive shift list whenever the picked worker changes so the
  // mobile app stays in sync with the agency-side schedule, timesheets,
  // and requisitions for that worker.
  _wmEffect(() => {
    setShifts(_wmBuildShiftsForWorker(activeWorker.id));
    // Reset navigation stack + tab when switching workers so the
    // viewer doesn't land on a stale shift detail screen.
    setStack([]);
    setTab("home");
    setSubTab("invites");
    setPhase("clockin");
    setElapsed(0);
    setBreakSec(0);
    setEnrouteSec(0);
    setTravelMode("walk");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeWorker.id]);

  // Screen stack — push "shiftDetail" / "active" / "summary" on top.
  // null means "showing the tabs (home/shifts/more)".
  const [stack, setStack]   = _wmState([]); // [{kind, shiftId}]
  const top = stack[stack.length - 1] || null;
  const push = (s) => setStack((st) => [...st, s]);
  const pop  = () => setStack((st) => st.slice(0, -1));
  const replaceTop = (s) => setStack((st) => [...st.slice(0, -1), s]);

  // Active-shift timer + break timer
  const [phase, setPhase]       = _wmState("clockin"); // "clockin" (en route) | "working" | "break"
  const [elapsed, setElapsed]   = _wmState(0);
  const [breakSec, setBreakSec] = _wmState(0);
  const [enrouteSec, setEnrouteSec] = _wmState(0);
  const [travelMode, setTravelMode] = _wmState("walk");
  _wmEffect(() => {
    if (phase === "working") {
      const t = setInterval(() => setElapsed((s) => s + 1), 1000);
      return () => clearInterval(t);
    }
    if (phase === "break") {
      const t = setInterval(() => setBreakSec((s) => s + 1), 1000);
      return () => clearInterval(t);
    }
    if (phase === "clockin") {
      // En-route ticks while the worker has confirmed they're on their way
      // but hasn't scanned the QR yet.
      const t = setInterval(() => setEnrouteSec((s) => s + 1), 1000);
      return () => clearInterval(t);
    }
  }, [phase]);

  // Notif tray + sheets
  const [notifOpen, setNotifOpen] = _wmState(false);
  const [qrOpen, setQrOpen]       = _wmState(false);
  const [clockMethodOpen, setClockMethodOpen] = _wmState(false);
  const [badgeSheetOpen, setBadgeSheetOpen]   = _wmState(false);
  const [clockOnboard, setClockOnboard]       = _wmState(null); // null | "badge" | "biometrics"
  const [sheet, setSheet]         = _wmState(null); // {kind, shiftId}
  const [travelSheet, setTravelSheet] = _wmState(null); // {shiftId}
  const [cancelSheet, setCancelSheet] = _wmState(null); // {shiftId}
  const [toast, setToast]         = _wmState(null);
  _wmEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4200);
    return () => clearTimeout(t);
  }, [toast]);

  // Welcome toast on first mount — primes the user that they just got
  // assigned to a fresh requisition the manager created in the desktop app.
  // Derived from the first invite so the message stays consistent with
  // whichever worker the picker is currently on.
  _wmEffect(() => {
    const firstInvite = (shifts || []).find((s) => s.status === "invited");
    if (!firstInvite) return;
    setToast({
      app: "Dayforce Flex Work",
      title: "New shift invite",
      msg: `${firstInvite.role} · ${firstInvite.dateLabel} · $${firstInvite.pay.toFixed(2)}`,
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeWorker.id]);

  const findShift = (id) => shifts.find((s) => s.id === id);
  const updateShift = (id, patch) =>
    setShifts((arr) => arr.map((s) => (s.id === id ? { ...s, ...patch } : s)));

  // ---------- Navigation helpers ----------
  const onOpenShift = (id, fromSub) => {
    setSubTab(fromSub === "active" ? "active" : (fromSub || shiftsTab));
    push({ kind: "shiftDetail", shiftId: id });
  };

  const onAccept = (id) => {
    updateShift(id, { status: "upcoming" });
    pop();
    setTab("shifts");
    setSubTab("upcoming");
    setToast({ app: "Dayforce Flex Work", title: "Shift accepted", msg: "Added to your upcoming shifts." });
  };
  const onConfirm = (id, mode) => {
    updateShift(id, { status: "active" });
    if (mode) setTravelMode(mode);
    setPhase("clockin");
    setElapsed(0); setBreakSec(0); setEnrouteSec(0);
    replaceTop({ kind: "active", shiftId: id });
    setTab("shifts"); setSubTab("active");
  };
  const onIAmOnMyWayOpen = (id) => setTravelSheet({ shiftId: id });
  const onPickTravelMode = (mode) => {
    const id = travelSheet && travelSheet.shiftId;
    setTravelSheet(null);
    if (!id) return;
    onConfirm(id, mode.id);
    setToast({
      app: "Dayforce Flex Work",
      title: `On your way · ${mode.label}`,
      msg: "We've let the team know you're heading in.",
    });
  };
  const onAddToCalendar = (id) => {
    const s = findShift(id);
    setToast({
      app: "Dayforce Flex Work",
      title: "Added to calendar",
      msg: s ? `${s.role} · ${s.dateLabel}` : "Saved to your device calendar.",
    });
  };
  const onCancelShiftOpen = (id) => setCancelSheet({ shiftId: id });
  const openMorePanel = (panel) => push({ kind: "morePanel", panel });
  const onCancelCall = () => {
    const id = cancelSheet && cancelSheet.shiftId;
    setCancelSheet(null);
    const supLabel = (window.REQ_SUPPLIERS || {})[activeWorker.supplier]?.label || "your agency";
    setToast({
      app: "Dayforce Flex Work",
      title: `Calling ${supLabel}…`,
      msg: id ? `Re: shift ${id}` : "We'll connect you to your dispatcher.",
    });
  };

  // Clock-in method picker — opens when the worker taps "Clock in" on
  // the en-route active screen. Routes to the right verification flow:
  //   • Geo-location / QR Code  → the existing QR scan overlay (simulates
  //                                a successful clock-in)
  //   • DF Clock Badge          → reveal badge number → site onboarding
  //                                → mark working on completion
  //   • DF Clock Biometrics     → site onboarding → mark working on completion
  const onPickClockMethod = (m) => {
    setClockMethodOpen(false);
    if (m.id === "geo" || m.id === "qr") {
      setQrOpen(true);
      return;
    }
    if (m.id === "badge") {
      setBadgeSheetOpen(true);
      return;
    }
    if (m.id === "biometrics") {
      setClockOnboard("biometrics");
    }
  };
  const onBadgeContinue = () => {
    setBadgeSheetOpen(false);
    setClockOnboard("badge");
  };
  const onClockOnboardComplete = () => {
    const id = (top && top.shiftId) || (shifts.find((s) => s.status === "active") || {}).id;
    setClockOnboard(null);
    if (!id) return;
    setPhase("working");
    setToast({
      app: "Dayforce Flex Work",
      title: "You're clocked in",
      msg: "Have a great shift!",
    });
  };
  const onClockIn = (id) => {
    setQrOpen(false);
    setPhase("working");
    setToast({ app: "Dayforce Flex Work", title: "You're clocked in", msg: "Have a great shift!" });
  };
  const onEndShift = (id) => {
    const s = findShift(id);
    // Pre-fill clock times for summary so the screen reads "8:57 AM / 5:02 PM"
    updateShift(id, { clockedIn: s.start, clockedOut: s.end });
    replaceTop({ kind: "summary", shiftId: id });
  };
  const onSummaryDone = (id) => {
    updateShift(id, { status: "completed", paid: false });
    setStack([]);
    setTab("shifts");
    setSubTab("past");
    setToast({ app: "Dayforce Flex Work", title: "Timesheet submitted", msg: "Your manager will review your hours." });
  };
  const onDecline = (id, reason) => {
    setSheet(null);
    setShifts((arr) => arr.filter((s) => s.id !== id));
    pop();
    setToast({ app: "Dayforce Flex Work", title: "Invite declined", msg: "We'll keep matching you with similar shifts." });
  };
  const onOptOut = (id, reason) => {
    setSheet(null);
    setShifts((arr) => arr.filter((s) => s.id !== id));
    pop();
    setToast({ app: "Dayforce Flex Work", title: "Opted out", msg: "The supplier has been notified." });
  };

  // Totals
  const julyTotal = shifts.filter((s) => s.status === "completed").reduce((sum, s) => sum + s.pay, 0);
  const invitesCount = shifts.filter((s) => s.status === "invited").length;
  const activeCount  = shifts.filter((s) => s.status === "active").length;

  // ---------- What screen are we showing? ----------
  let body;
  if (top && top.kind === "shiftDetail") {
    const s = findShift(top.shiftId);
    body = (
      <WmShiftDetail
        shift={s}
        onBack={() => pop()}
        onAccept={() => onAccept(s.id)}
        onDeclineOpen={() => setSheet({ kind: "decline", shiftId: s.id })}
        onIAmOnMyWayOpen={() => onIAmOnMyWayOpen(s.id)}
        onOptOutOpen={() => setSheet({ kind: "optout", shiftId: s.id })}
        onAddToCalendar={() => onAddToCalendar(s.id)}
        onCancelShiftOpen={() => onCancelShiftOpen(s.id)}
      />
    );
  } else if (top && top.kind === "active") {
    const s = findShift(top.shiftId);
    body = (
      <WmActiveScreen
        shift={s}
        activeState={phase}
        elapsed={phase === "break" ? breakSec : elapsed}
        breakSec={breakSec}
        enrouteSec={enrouteSec}
        travelMode={travelMode}
        onBack={() => { pop(); }}
        onClockInOpen={() => setClockMethodOpen(true)}
        onStartBreak={() => { setBreakSec(0); setPhase("break"); }}
        onEndBreak={() => setPhase("working")}
        onEndShift={() => onEndShift(s.id)}
        onHelp={() => setNotifOpen(true)}
      />
    );
  } else if (top && top.kind === "summary") {
    const s = findShift(top.shiftId);
    body = (
      <WmSummaryScreen
        shift={s}
        elapsedSec={elapsed}
        breakSec={breakSec}
        onDone={() => onSummaryDone(s.id)}
      />
    );
  } else if (tab === "onboarding") {
    body = (
      <WmOnboardingScreen
        worker={activeWorker}
        onHelp={() => setNotifOpen(true)}
        onTabChange={(t) => { setTab(t); setStack([]); }}
      />
    );
  } else if (tab === "home") {
    body = (
      <WmHomeScreen
        shifts={shifts}
        julyTotal={julyTotal || 3249.64}
        onOpenShift={onOpenShift}
        onTabChange={(t) => setTab(t)}
        onHelp={() => setNotifOpen(true)}
        activeWorker={activeWorker}
      />
    );
  } else if (tab === "shifts" && shiftsTab === "active" && shifts.find((s) => s.status === "active")) {
    // Active subtab with a live shift — render the active panel inline
    // so the user lands directly on the en-route / working / break UI
    // without an extra tap through a card.
    const activeShift = shifts.find((s) => s.status === "active");
    body = (
      <WmActiveScreen
        shift={activeShift}
        activeState={phase}
        elapsed={phase === "break" ? breakSec : elapsed}
        breakSec={breakSec}
        enrouteSec={enrouteSec}
        travelMode={travelMode}
        onSubTab={setSubTab}
        onClockInOpen={() => setClockMethodOpen(true)}
        onStartBreak={() => { setBreakSec(0); setPhase("break"); }}
        onEndBreak={() => setPhase("working")}
        onEndShift={() => onEndShift(activeShift.id)}
        onHelp={() => setNotifOpen(true)}
      />
    );
  } else if (tab === "shifts") {
    body = (
      <WmShiftsList
        subTab={shiftsTab}
        shifts={shifts}
        onSubTab={setSubTab}
        onOpenShift={onOpenShift}
        onHelp={() => setNotifOpen(true)}
      />
    );
  } else if (top && top.kind === "morePanel") {
    const common = { worker: activeWorker, shifts, onBack: () => pop() };
    switch (top.panel) {
      case "availability": body = <WmAvailabilityPanel {...common} />; break;
      case "skills":       body = <WmSkillsPanel       {...common} />; break;
      case "certs":        body = <WmCertsPanel        {...common} />; break;
      case "benefits":     body = <WmBenefitsPanel     {...common} />; break;
      case "paystubs":     body = <WmPaystubsPanel     {...common} />; break;
      case "settings":     body = <WmSettingsPanel     {...common} />; break;
      case "refer":        body = <WmReferPanel        {...common} />; break;
      case "help":         body = <WmHelpPanel         {...common} />; break;
      case "feedback":
        body = (
          <WmFeedbackPanel
            {...common}
            onSubmit={() => setToast({ app: "Dayforce Flex Work", title: "Feedback sent", msg: "Thanks — the product team will read it." })}
          />
        );
        break;
      case "interviews":
        body = (
          <React.Fragment>
            <WmPanelHeader title="Interviews" onBack={() => pop()} />
            <div className="wm-scroll" style={{ background: "var(--evr-surface-secondary-default)" }}>
              {window.InterviewWorkerPage
                ? <div style={{ padding: 12 }}><window.InterviewWorkerPage /></div>
                : <div style={{ padding: 20, textAlign: "center" }}>Interview portal not loaded.</div>}
            </div>
          </React.Fragment>
        );
        break;
      case "projects":
        body = (
          <React.Fragment>
            <WmPanelHeader title="Projects" onBack={() => pop()} />
            <div className="wm-scroll" style={{ background: "var(--evr-surface-secondary-default)" }}>
              {window.WorkerProjectScreen
                ? <div style={{ padding: 12 }}><window.WorkerProjectScreen workerName={activeWorker && activeWorker.name} onBack={() => pop()} /></div>
                : <div style={{ padding: 20, textAlign: "center" }}>Projects surface not loaded.</div>}
            </div>
          </React.Fragment>
        );
        break;
      default: body = <WmMoreScreen worker={activeWorker} shifts={shifts} onHelp={() => setNotifOpen(true)} onOpen={openMorePanel} onExitWorker={onExit} />;
    }
  } else {
    body = (
      <WmMoreScreen
        worker={activeWorker}
        shifts={shifts}
        onHelp={() => setNotifOpen(true)}
        onOpen={openMorePanel}
        onExitWorker={onExit}
      />
    );
  }

  const showTabBar = !top;

  // v0.97 — IC branch. When the active worker has pool === "Contractor"
  // we render the contractor self-serve portal (window.WmContractorView,
  // ships in pages/worker-mobile-ic.jsx) inside the same iOS device
  // frame. The dock header (picker + close) stays so a designer can
  // hop between shift workers and contractors live; the standard
  // bottom tab bar is skipped because WmContractorView ships its own
  // four-tab nav (Engagements / Invoices / Documents / Profile).
  const isContractor = !!(activeWorker && activeWorker.pool === "Contractor" && window.WmContractorView);

  return (
    <div className="wm-stage" role="complementary" aria-label="Worker mobile preview">
      <div className="wm-dock-head">
        <div className="wm-dock-picker" ref={pickerRef}>
          <button
            type="button"
            className="wm-dock-chip"
            title="Switch worker"
            aria-haspopup="listbox"
            aria-expanded={pickerOpen}
            onClick={() => setPickerOpen((v) => !v)}
          >
            <span
              className="wm-dock-chip-avatar"
              style={{ background: activePalette.bg, color: activePalette.fg }}
            >
              {_wmInitialsFor(activeWorker.name)}
            </span>
            <span>{activeWorker.name}</span>
            <WmIcon name="chevron-r" size={14} style={{ transform: pickerOpen ? "rotate(-90deg)" : "rotate(90deg)", transition: "transform 150ms" }} />
          </button>
          {pickerOpen && (
            <div className="wm-dock-picker-pop" role="dialog" aria-label="Switch worker">
              <div className="wm-dock-picker-head">
                <span className="wm-dock-picker-search-icon" aria-hidden="true">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.7" />
                    <path d="m16.2 16.2 3.6 3.6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
                  </svg>
                </span>
                <input
                  ref={pickerSearchRef}
                  className="wm-dock-picker-input"
                  type="text"
                  value={pickerQuery}
                  placeholder="Search workers"
                  onChange={(e) => setPickerQuery(e.target.value)}
                  aria-label="Search workers"
                />
                {pickerQuery && (
                  <button
                    type="button"
                    className="wm-dock-picker-clear"
                    onClick={() => { setPickerQuery(""); pickerSearchRef.current && pickerSearchRef.current.focus(); }}
                    aria-label="Clear search"
                  >
                    <WmIcon name="x" size={14} />
                  </button>
                )}
              </div>
              <div className="wm-dock-picker-meta">
                {filteredWorkers.length} of {workerPool.length} {workerPool.length === 1 ? "worker" : "workers"}
              </div>
              <div className="wm-dock-picker-list" role="listbox">
                {filteredWorkers.length === 0 ? (
                  <div className="wm-dock-picker-empty">No workers match "{pickerQuery}"</div>
                ) : (
                  filteredWorkers.map((w) => {
                    const pal = _wmPaletteFor(w.id);
                    const sup = (window.REQ_SUPPLIERS || {})[w.supplier];
                    const supLabel = sup ? sup.label : (w.pool || "Worker");
                    const isActive = w.id === activeWorker.id;
                    return (
                      <button
                        key={w.id}
                        type="button"
                        className={`wm-dock-picker-row${isActive ? " wm-dock-picker-row--active" : ""}`}
                        role="option"
                        aria-selected={isActive}
                        onClick={() => onPickWorker(w)}
                      >
                        <span className="wm-dock-picker-avatar" style={{ background: pal.bg, color: pal.fg }}>
                          {_wmInitialsFor(w.name)}
                        </span>
                        <span className="wm-dock-picker-body">
                          <span className="wm-dock-picker-name">{w.name}</span>
                          <span className="wm-dock-picker-sub">
                            {supLabel}
                            {w.jobs && w.jobs[0] ? ` · ${w.jobs[0]}` : ""}
                          </span>
                        </span>
                        {isActive && (
                          <span className="wm-dock-picker-check" aria-hidden="true">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                              <path d="m5 12 4.5 4.5L19 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
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
        <button type="button" className="wm-dock-close" aria-label="Close worker preview" onClick={onExit}>
          <WmIcon name="x" size={16} />
        </button>
      </div>
      <div className="wm-frame-wrap">
        <IOSDevice width={372} height={770}>
          <div className="wm-app">
            {toast && (
              <div className="wm-toast" role="status">
                <div className="wm-toast-icon"><WmIcon name="briefcase" size={20} /></div>
                <div className="wm-toast-body">
                  <div className="wm-toast-app">{toast.app}</div>
                  <div className="wm-toast-title">{toast.title}</div>
                  <div className="wm-toast-msg">{toast.msg}</div>
                </div>
                <button className="wm-iconbtn wm-iconbtn--bare" onClick={() => setToast(null)} aria-label="Dismiss"><WmIcon name="x" size={16} /></button>
              </div>
            )}
            {notifOpen && (
              <div className="wm-notif-tray">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                  <h3 style={{ font: "var(--evr-h4)", fontFamily: "var(--evr-font-display)" }}>Notifications</h3>
                  <button className="wm-iconbtn" onClick={() => setNotifOpen(false)} aria-label="Close"><WmIcon name="x" size={16} /></button>
                </div>
                {(() => {
                  // Derive a per-worker notification feed from the same
                  // shift list the rest of the app reads from, so what's
                  // surfaced here lines up with their actual schedule.
                  const inv = shifts.find((s) => s.status === "invited");
                  const upc = shifts.find((s) => s.status === "upcoming");
                  const past = shifts.find((s) => s.status === "completed");
                  const items = [];
                  if (inv) items.push({ icon: "briefcase", title: "New shift invite", text: `${inv.role} · ${inv.dateLabel} · $${inv.pay.toFixed(2)} · ${inv.location}`, time: "Just now" });
                  if (upc) items.push({ icon: "lightning", title: "Shift starts soon", text: `Be at ${upc.location} by ${upc.start}. Bring photo ID.`, time: "20 min" });
                  if (upc) items.push({ icon: "cal-check", title: `${upc.role} shift confirmed`, text: `${upc.day} at ${upc.location}`, time: "Yesterday" });
                  if (past) items.push({ icon: "qr", title: "Pay statement available", text: `Direct deposit landed for the ${past.dateLabel.replace(/^.*·\s*/, "")} shift.`, time: "Mon" });
                  if (items.length === 0) {
                    items.push({ icon: "briefcase", title: "Welcome to Dayforce Flex Work", text: "You'll see new shift invites here as they come in.", time: "Just now" });
                  }
                  return items;
                })().map((n, i) => (
                  <div key={i} className="wm-notif">
                    <div className="wm-notif-icon"><WmIcon name={n.icon} size={18} /></div>
                    <div className="wm-notif-body">
                      <div className="wm-notif-title">{n.title}</div>
                      <div className="wm-notif-text">{n.text}</div>
                      <div className="wm-notif-time">{n.time}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {!isContractor && body}
            {isContractor && (
              <window.WmContractorView
                contractor={activeWorker}
                onToast={(t) => setToast({ app: "Dayforce Flex Work", title: t.title, msg: t.msg })}
                onExit={onExit}
              />
            )}
            {qrOpen && (
              <WmQrOverlay onClose={() => setQrOpen(false)} onComplete={() => onClockIn(top.shiftId)} />
            )}
            {sheet && (
              <WmReasonSheet
                kind={sheet.kind}
                onClose={() => setSheet(null)}
                onSubmit={(reason) => sheet.kind === "decline" ? onDecline(sheet.shiftId, reason) : onOptOut(sheet.shiftId, reason)}
              />
            )}
            {travelSheet && (
              <WmTravelSheet
                onClose={() => setTravelSheet(null)}
                onPick={onPickTravelMode}
              />
            )}
            {cancelSheet && (
              <WmCancelShiftSheet
                agencyName={(window.REQ_SUPPLIERS || {})[activeWorker.supplier]?.label || "your agency"}
                agencyPhone="+1 (415) 555-0100"
                onClose={() => setCancelSheet(null)}
                onCall={onCancelCall}
              />
            )}
            {clockMethodOpen && (
              <WmClockMethodSheet
                onClose={() => setClockMethodOpen(false)}
                onPick={onPickClockMethod}
              />
            )}
            {badgeSheetOpen && (
              <WmBadgeSheet
                worker={activeWorker}
                onClose={() => setBadgeSheetOpen(false)}
                onContinue={onBadgeContinue}
              />
            )}
            {clockOnboard && (
              <WmClockOnboard
                kind={clockOnboard}
                worker={activeWorker}
                onClose={() => setClockOnboard(null)}
                onComplete={onClockOnboardComplete}
              />
            )}
            {showTabBar && !isContractor && (
              <WmTabBar
                tab={tab}
                onChange={(t) => { setTab(t); setStack([]); }}
                invitesBadge={invitesCount || undefined}
                activeBadge={activeCount || undefined}
                onboarding={(() => {
                  // Lifecycle tab visibility \u2014 only when the active
                  // worker is in a transitional lifecycle state AND
                  // their lifecycle is buyer-owned (Pro or direct
                  // Frontline). Agency-sourced workers never see it.
                  const kind = _wmLifecycleKind(activeWorker);
                  const slot = _wmLifecycleSlot(activeWorker);
                  if (!kind || !slot) return null;
                  // Gate Frontline behind the new feature flag so the
                  // existing demo (which doesn't have frontlineDirect
                  // on) stays byte-identical to today.
                  if (kind === "frontline" && window.useFeatureFlag && !window.useFeatureFlag("frontlineDirect")) return null;
                  // Resolve through the worker-aware resolver so a
                  // per-job template override applies here too.
                  const catalog = slot === "offboarding"
                    ? (window.getOffboardingTasksForWorker ? window.getOffboardingTasksForWorker(activeWorker) : (window.getOffboardingTasks ? window.getOffboardingTasks(kind) : []))
                    : (window.getOnboardingTasksForWorker  ? window.getOnboardingTasksForWorker(activeWorker)  : (window.getOnboardingTasks  ? window.getOnboardingTasks(kind)  : []));
                  const mine = catalog.filter((t) => t.owner === "worker" || t.owner === "shared");
                  if (!mine.length) return null;
                  const open = mine.length - Math.round(mine.length * (activeWorker.status === "Compliant" ? 1 : activeWorker.status === "Onboarding" ? 0.6 : 0.3));
                  return { label: slot === "offboarding" ? "Off-board" : "On-board", badge: open > 0 ? open : undefined };
                })()}
              />
            )}
          </div>
        </IOSDevice>
      </div>
      <div className="wm-dock-caption">
        {(() => {
          const inv = shifts.find((s) => s.status === "invited");
          const upc = shifts.find((s) => s.status === "upcoming");
          const ref = inv || upc;
          if (ref) {
            return (
              <React.Fragment>
                Live preview · <b>{activeWorker.name}</b> {inv ? "invited to" : "scheduled for"} <b>{ref.program || ref.location}</b>
              </React.Fragment>
            );
          }
          return (
            <React.Fragment>
              Live preview · <b>{activeWorker.name}</b> · synced with the Flex Work VMS
            </React.Fragment>
          );
        })()}
      </div>
    </div>
  );
}

Object.assign(window, { WorkerMobileApp });
