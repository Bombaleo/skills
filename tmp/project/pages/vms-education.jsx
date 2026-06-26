// =====================================================================
// Flex Work — VMS Education
//   When the "VMS Education" feature flag (Settings → Feature Flags →
//   Misc) is enabled, in-product education tips appear throughout Flex
//   Work explaining what each feature is, what problem it solves, why
//   it's helpful, and how it compares in the broader VMS industry.
//
//   Two public components:
//     · <VmsEduPin topic="..." />     — small "Why?" badge that opens a
//                                       rich popover with the full
//                                       four-part education. Used next
//                                       to page titles in the Omnibar.
//     · <VmsEduHover topic="..." />   — wraps a child node and shows a
//                                       small hover tooltip with the
//                                       short summary. Used on the
//                                       primary nav items.
//
//   The catalog (VMS_EDU_TOPICS) is keyed by a topic id. Lookup helpers
//   map nav-item ids and Omnibar titles onto topics so the same content
//   travels with the page regardless of where the consumer surface
//   lives.
// =====================================================================

// ---------- Catalog ---------------------------------------------------
const VMS_EDU_TOPICS = {
  dashboard: {
    title: "Home",
    summary: "Your daily action hub — every thing that needs you today in one place.",
    problem:
      "VMS programs scatter approvals, alerts and shift exceptions across email, dashboards and inboxes. Coordinators burn an hour a day just hunting for what needs them next.",
    benefit:
      "One landing page that surfaces everything that needs you today across requisitions, timesheets, invoices and credentials \u2014 with one-click sign-off.",
    industry:
      "Most contingent VMS tools ship dashboards built for procurement reporting. Flex Work\u2019s Home is built for the daily program operator \u2014 closer to a Workday \u201cTasks\u201d inbox than a procurement scorecard.",
  },
  requisitions: {
    title: "Requisitions",
    summary: "Where shift demand is created, priced and routed to suppliers.",
    problem:
      "In a frontline VMS a \u201creq\u201d is rarely a single role \u2014 it\u2019s a recurring shift pattern (e.g. 2 nurses \u00d7 Mon\u2013Fri \u00d7 7p\u20137a \u00d7 6 weeks) that has to be exploded into bookings and distributed to multiple agencies under tier rules. Doing this in spreadsheets or email is the #1 source of fill-rate loss.",
    benefit:
      "One canonical requisition object handles single shifts, recurring patterns and pooled assignments. Tier distribution and auto-extend cut time-to-fill from days to minutes.",
    industry:
      "Traditional VMSes are SOW/contract-centric \u2014 they expect long-engagement roles. Flex Work models the shift as the primitive, which mirrors how Healthcare and Hospitality programs actually buy. Closer to Shiftsmart or Andgo than Fieldglass.",
  },
  schedule: {
    title: "Schedule",
    summary: "Every booked contingent shift on the same calendar your FTEs live on.",
    problem:
      "Buyers run their own employees in Dayforce WFM, but contingent shifts live in their VMS \u2014 so a manager looking at \u201cwho\u2019s working Tuesday\u201d has to flip between two systems and reconcile by hand.",
    benefit:
      "Schedule shows contingent shifts on the same grid managers already use for FTEs, scoped by location, with drag-to-reassign and conflict warnings against the agency worker\u2019s other bookings.",
    industry:
      "Most VMSes show a list, not a schedule. Healthcare-specific tools like ShiftWise or Aya Connect come closer, but they don\u2019t sit alongside the buyer\u2019s own WFM. The Dayforce-native angle is the unlock.",
  },
  timesheets: {
    title: "Timesheets",
    summary: "Where worked hours become billable lines \u2014 captured once, approved once.",
    problem:
      "Three parties touch a contingent timesheet (worker, agency, buyer manager). In legacy VMSes each one keys the same hours into a different system and reconciliation takes the back office days.",
    benefit:
      "One timesheet is captured at the time clock, approved once by the buyer manager, and turned directly into the agency\u2019s billable line \u2014 no double-entry, no reconciliation.",
    industry:
      "Beeline and Fieldglass support timesheet capture but it\u2019s typically a manual web form. Flex Work assumes time was already punched on a frontline clock (Dayforce TCD, partner app) and ingests it.",
  },
  invoices: {
    title: "Invoices",
    summary: "Consolidated supplier billing with a line-level audit trail.",
    problem:
      "A 1,000-shift week generates hundreds of individual agency invoices. AP teams either accept summary invoices on trust or spend days reconciling line-by-line against approved timesheets.",
    benefit:
      "Invoices are auto-generated from approved timesheets using the supplier\u2019s contracted rates \u2014 line-level traceable, dispute-able, and pushed straight into the buyer\u2019s AP system.",
    industry:
      "Most VMSes generate a consolidated invoice but ask the buyer to trust the math. Flex Work\u2019s invoice is a click-down from total \u2192 line \u2192 timesheet \u2192 punch.",
  },
  suppliers: {
    title: "Suppliers",
    summary: "The staffing agencies you work with \u2014 contract, performance and tier in one record.",
    problem:
      "A program with 30 agencies has 30 different contract structures, rate cards and performance levels \u2014 and the only place to see who\u2019s actually performing is buried in monthly reports.",
    benefit:
      "One profile per agency with live fill rate, no-show rate, margin and contract terms. Tier movement and shutoffs are one click.",
    industry:
      "Comparable to Beeline\u2019s Vendor Management module but more frontline-aware \u2014 Flex Work treats agencies as operational partners, not just procurement counterparties.",
  },
  workforce: {
    title: "Workforce",
    summary: "The contingent workers active on your program, regardless of who supplies them.",
    problem:
      "Buyers often don\u2019t know who\u2019s working in their building today. Badge numbers are agency-assigned, profiles are scattered, and credentials expire silently.",
    benefit:
      "A single record per worker \u2014 across agencies \u2014 with assignments, credentials, hours and tenure visible to the buyer regardless of who is supplying them.",
    industry:
      "This is the gap legacy VMS tools left wide open. Flex Work models the worker as a first-class buyer-side object, which matches how a hospital or warehouse actually thinks about their floor.",
  },
  locations: {
    title: "Organization",
    summary: "Your sites, regions and reporting roll-up \u2014 plus the rules that hang from them.",
    problem:
      "VMS programs span dozens to thousands of physical sites. Configuring rules (\u201cthis region uses these agencies, this site allows local pickup\u201d) usually requires central admin work for every change.",
    benefit:
      "A hierarchical org tree that any setting (suppliers, tiers, rates, approval flow) can hang from \u2014 with delegation so site managers can configure their own.",
    industry:
      "Most VMSes model \u201cclient\u201d as a single entity. Flex Work was built knowing one buyer = many sites with conflicting needs.",
  },
  analytics: {
    title: "Analytics",
    summary: "Program performance, spend and supplier scorecards.",
    problem:
      "Contingent labor is 5\u201315% of operating cost but is often the least-instrumented line in finance\u2019s books. Most VMS dashboards stop at \u201cshifts filled\u201d \u2014 no benchmarking, no leakage analysis.",
    benefit:
      "Drill from program-level spend down to a single shift, with built-in benchmarks against your industry and tools to spot off-contract premium spend.",
    industry:
      "Beeline and SAP Fieldglass have strong reporting but require BI consultants to extract real value. Flex Work ships the dashboards out of the box.",
  },
  settings: {
    title: "Settings",
    summary: "Tenant-wide configuration \u2014 grouped, role-scoped, feature-flagged.",
    problem:
      "Configuring a VMS is the #1 reason programs miss go-live dates \u2014 most tools bury rules in deeply nested admin screens.",
    benefit:
      "One Settings hub with grouped configuration (Policies, Workflows, Users, Roles, Pricing) and feature flags for safe rollout of pre-release capability.",
    industry:
      "Standard for enterprise SaaS but rarely well-organized in VMS. The Settings IA here borrows from Workday and Dayforce conventions buyers already know.",
  },

  // --- Cross-cutting / page-level secondary topics ---
  inbox: {
    title: "Inbox",
    summary: "Everything routed to you for sign-off in one queue.",
    problem:
      "Approvals in legacy VMSes fan out to email \u2014 a manager handling 40 sites can\u2019t see what they\u2019re holding up.",
    benefit:
      "A single queue scoped to your role and locations, with one-click approve / dispute / re-route and full context inline.",
    industry:
      "Common in modern HR (Workday Tasks, Dayforce Notifications) but largely absent from the VMS category. Flex Work brings the convention into contingent labor.",
  },
  compliance: {
    title: "Compliance",
    summary: "Worker credentials and screenings tracked against your policy.",
    problem:
      "Credentials (licenses, screenings, certifications) sit in the agency\u2019s system, not the buyer\u2019s \u2014 so the buyer can\u2019t verify a worker is cleared before they walk on site.",
    benefit:
      "Every worker\u2019s credential file lives on the buyer side with expiry alerts and a hard-block on assignments past expiry.",
    industry:
      "Healthcare VMSes (Aya, Medely) do this well; horizontal VMSes mostly don\u2019t. Flex Work bakes it in for every industry.",
  },
  insights: {
    title: "Insights",
    summary: "Where the system tells you what changed and what to do about it.",
    problem:
      "Static dashboards don\u2019t flag the things that actually matter \u2014 a supplier whose fill rate just dropped, a site quietly going over budget, a worker whose license expires Friday.",
    benefit:
      "Insights surfaces the deltas \u2014 anomalies, trends, threshold breaches \u2014 with one-click drill-through to fix.",
    industry:
      "The category is moving this way (Beeline Insights, Fieldglass IQ) but most stop at canned reports. Flex Work\u2019s insights are action-able, not just informational.",
  },
};

// Aliases for nav-item ids whose label differs from the topic key.
const VMS_EDU_NAV_ALIASES = {
  // Manager view renames "Organization" \u2192 "Clients" for agencies, but
  // the underlying topic is the same.
  clients: "locations",
};

function getVmsEduTopic(topicId) {
  if (!topicId) return null;
  const k = VMS_EDU_NAV_ALIASES[topicId] || topicId;
  return VMS_EDU_TOPICS[k] || null;
}

// Map an Omnibar title string to a topic id. Defensive lookup so pages
// can keep using `<Omnibar title="Requisitions">` with no other changes.
const VMS_EDU_TITLE_INDEX = (() => {
  const m = {};
  for (const [id, t] of Object.entries(VMS_EDU_TOPICS)) {
    m[t.title.toLowerCase()] = id;
  }
  // Common alternates seen in the codebase.
  m["home"]            = "dashboard";
  m["your home"]       = "dashboard";
  m["clients"]         = "locations";
  m["organization"]    = "locations";
  m["locations"]       = "locations";
  m["talent pools"]    = "workforce";
  m["rosters"]         = "workforce";
  m["user roles"]      = "settings";
  m["users"]           = "settings";
  m["your profile"]    = "settings";
  m["feature flags"]   = "settings";
  return m;
})();

function topicForTitle(title) {
  if (!title) return null;
  const norm = String(title).trim().toLowerCase();
  if (VMS_EDU_TITLE_INDEX[norm]) return VMS_EDU_TITLE_INDEX[norm];
  // Fallback: try the first word ("Requisitions \u00b7 ABC" \u2192 "requisitions").
  const first = norm.split(/[\s\u00b7\u2014\-:]/)[0];
  return VMS_EDU_TITLE_INDEX[first] || null;
}

// ---------- Hooks ----------------------------------------------------
function useVmsEduEnabled() {
  return window.useFeatureFlag
    ? window.useFeatureFlag("vmsEducation", false)
    : false;
}

// ---------- Rich popover pin (Omnibar) ------------------------------
function VmsEduPin({ topic, topicId, placement = "below" }) {
  const enabled = useVmsEduEnabled();
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef(null);

  React.useEffect(() => {
    if (!open) return;
    const onDoc = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!enabled) return null;

  const resolved = topic || getVmsEduTopic(topicId);
  if (!resolved) return null;

  return (
    <span className="vmsedu-pin-wrap" ref={ref}>
      <button
        type="button"
        className={"vmsedu-pin" + (open ? " is-open" : "")}
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={`Learn about ${resolved.title}`}
        title={`Why ${resolved.title}? \u2014 VMS education`}
      >
        <span className="vmsedu-pin-glyph" aria-hidden="true">
          <Icon name="Information" size={14} />
        </span>
        <span className="vmsedu-pin-label">Why?</span>
      </button>
      {open && (
        <div
          className={"vmsedu-pop vmsedu-pop--" + placement}
          role="dialog"
          aria-label={`${resolved.title} \u2014 VMS education`}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="vmsedu-pop-head">
            <span className="vmsedu-pop-eyebrow">VMS education</span>
            <button
              type="button"
              className="vmsedu-pop-close"
              onClick={() => setOpen(false)}
              aria-label="Close"
            >×</button>
          </div>
          <h3 className="vmsedu-pop-title">{resolved.title}</h3>
          {resolved.summary && (
            <p className="vmsedu-pop-sub">{resolved.summary}</p>
          )}
          <dl className="vmsedu-pop-list">
            <div className="vmsedu-pop-row">
              <dt>
                <span className="vmsedu-pop-rowdot" data-tone="problem" aria-hidden="true" />
                Why it exists
              </dt>
              <dd>{resolved.problem}</dd>
            </div>
            <div className="vmsedu-pop-row">
              <dt>
                <span className="vmsedu-pop-rowdot" data-tone="benefit" aria-hidden="true" />
                Why it’s helpful
              </dt>
              <dd>{resolved.benefit}</dd>
            </div>
            <div className="vmsedu-pop-row">
              <dt>
                <span className="vmsedu-pop-rowdot" data-tone="industry" aria-hidden="true" />
                How it compares in VMS
              </dt>
              <dd>{resolved.industry}</dd>
            </div>
          </dl>
          <div className="vmsedu-pop-foot">
            <span className="vmsedu-pop-foot-key">
              <Icon name="Bolt" size={12} />
              Visible because <b>VMS Education</b> is on
            </span>
            <button
              type="button"
              className="vmsedu-pop-foot-link"
              onClick={() => {
                setOpen(false);
                if (window.flexGoTo) {
                  window.flexGoTo({ page: "settings", sub: "feature-flags" });
                }
              }}
            >
              Manage in Feature Flags
            </button>
          </div>
        </div>
      )}
    </span>
  );
}

// ---------- Hover tooltip (GlobalNav items) --------------------------
// Wraps a single child and shows a small hover/focus tooltip to the
// right with the topic\u2019s summary. Renders a passthrough when the flag
// is off so call-sites don\u2019t branch.
function VmsEduHover({ topic, topicId, placement = "right", children }) {
  const enabled = useVmsEduEnabled();
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef(null);
  const closeTimer = React.useRef(null);

  const onEnter = () => {
    if (closeTimer.current) { clearTimeout(closeTimer.current); closeTimer.current = null; }
    setOpen(true);
  };
  const onLeave = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setOpen(false), 80);
  };

  React.useEffect(() => () => { if (closeTimer.current) clearTimeout(closeTimer.current); }, []);

  if (!enabled) return children;

  const resolved = topic || getVmsEduTopic(topicId);
  if (!resolved) return children;

  return (
    <span
      className={"vmsedu-hover" + (open ? " is-open" : "")}
      ref={ref}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      onFocusCapture={onEnter}
      onBlurCapture={onLeave}
    >
      <span className="vmsedu-hover-badge" aria-hidden="true">
        <Icon name="Information" size={10} />
      </span>
      {children}
      {open && (
        <span className={"vmsedu-tip vmsedu-tip--" + placement} role="tooltip">
          <span className="vmsedu-tip-eyebrow">VMS education</span>
          <span className="vmsedu-tip-title">{resolved.title}</span>
          <span className="vmsedu-tip-body">{resolved.summary}</span>
          <span className="vmsedu-tip-hint">Click the section, then tap “Why?” for more.</span>
        </span>
      )}
    </span>
  );
}

Object.assign(window, {
  VMS_EDU_TOPICS,
  getVmsEduTopic,
  topicForTitle,
  useVmsEduEnabled,
  VmsEduPin,
  VmsEduHover,
});
