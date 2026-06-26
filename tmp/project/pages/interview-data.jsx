// =====================================================================
// Flex Work — Interview workflow · shared data + helpers
// ---------------------------------------------------------------------
// Powers every surface in pages/interview-{admin,manager,agency,worker}
// and the orchestrator in pages/interview-workflow.jsx. Everything in
// this file is in-memory; a window.dispatchEvent("iv:change") fires on
// every mutation so any subscriber re-renders.
//
// The schema mirrors the task list in `Flex Work Interview Workflow
// Tasks.html` — types, scorecards, templates, decline reasons, policies
// (admin) and Interview objects (manager / agency / worker). Each
// Interview is a child of a submittal id; the candidate / requisition
// shape reuses the Pro pipeline seed in professional-work.jsx where
// possible so the demo lines up with what the rest of the product
// already renders.
// =====================================================================

// ---------- Tiny store primitive ---------------------------------------
const IV = {};

function ivGet(key, fallback) {
  if (!window.__ivStore) window.__ivStore = {};
  if (!(key in window.__ivStore)) window.__ivStore[key] = fallback;
  return window.__ivStore[key];
}
function ivSet(key, next) {
  if (!window.__ivStore) window.__ivStore = {};
  window.__ivStore[key] = next;
  window.dispatchEvent(new CustomEvent("iv:change", { detail: { key } }));
}
function ivBump() {
  window.dispatchEvent(new CustomEvent("iv:change", { detail: { key: "*" } }));
}
function ivSubscribe(cb) {
  const handler = (e) => cb(e.detail || {});
  window.addEventListener("iv:change", handler);
  return () => window.removeEventListener("iv:change", handler);
}

// ---------- Interview-type catalog --------------------------------
// Each type: id, label, defaultDuration (mins), method, location pattern,
// defaultPanelRoles (used as default panel), scorecardId, active.
const IV_TYPE_SEED = [
  { id: "ph",  label: "Phone screen",  duration: 30, method: "Phone",    location: "Recruiter to dial",        defaultPanelRoles: ["Recruiter"],                        scorecardId: "sc-phone",  active: true },
  { id: "vid", label: "Video screen",  duration: 45, method: "Video",    location: "Zoom — auto-generated",    defaultPanelRoles: ["Recruiter", "Hiring manager"],      scorecardId: "sc-video",  active: true },
  { id: "tech",label: "Technical",     duration: 60, method: "Video",    location: "Zoom — auto-generated",    defaultPanelRoles: ["Hiring manager", "Senior IC"],      scorecardId: "sc-tech",   active: true },
  { id: "pnl", label: "Panel",         duration: 60, method: "Video",    location: "Zoom — auto-generated",    defaultPanelRoles: ["Hiring manager", "Cross-functional"], scorecardId: "sc-panel", active: true },
  { id: "ons", label: "On-site",       duration: 90, method: "In person",location: "Office address",           defaultPanelRoles: ["Hiring manager", "Skip-level"],     scorecardId: "sc-panel",  active: true },
  { id: "exec",label: "Executive",     duration: 45, method: "In person",location: "Executive boardroom",      defaultPanelRoles: ["Skip-level", "VP+"],                scorecardId: "sc-exec",   active: false },
];

// ---------- Scorecard templates -----------------------------------
// Each scorecard: id, label, requiredToAdvance, competencies[].
// Competency shape: { label, kind: "rating" | "text", scale (1-5) optional }
const IV_SCORECARD_SEED = [
  {
    id: "sc-phone",
    label: "Phone screen scorecard",
    requiredToAdvance: false,
    competencies: [
      { label: "Communication", kind: "rating", scale: 5 },
      { label: "Role fit",      kind: "rating", scale: 5 },
      { label: "Notes",         kind: "text" },
    ],
  },
  {
    id: "sc-video",
    label: "Video screen scorecard",
    requiredToAdvance: true,
    competencies: [
      { label: "Communication",   kind: "rating", scale: 5 },
      { label: "Domain knowledge",kind: "rating", scale: 5 },
      { label: "Role fit",        kind: "rating", scale: 5 },
      { label: "Notes",           kind: "text" },
    ],
  },
  {
    id: "sc-tech",
    label: "Technical scorecard",
    requiredToAdvance: true,
    competencies: [
      { label: "Problem solving",   kind: "rating", scale: 5 },
      { label: "Coding / craft",    kind: "rating", scale: 5 },
      { label: "System design",     kind: "rating", scale: 5 },
      { label: "Communication",     kind: "rating", scale: 5 },
      { label: "Hire / no-hire",    kind: "rating", scale: 5 },
      { label: "Notes",             kind: "text" },
    ],
  },
  {
    id: "sc-panel",
    label: "Panel scorecard",
    requiredToAdvance: true,
    competencies: [
      { label: "Leadership",     kind: "rating", scale: 5 },
      { label: "Collaboration",  kind: "rating", scale: 5 },
      { label: "Domain expertise",kind: "rating", scale: 5 },
      { label: "Culture add",    kind: "rating", scale: 5 },
      { label: "Notes",          kind: "text" },
    ],
  },
  {
    id: "sc-exec",
    label: "Executive scorecard",
    requiredToAdvance: true,
    competencies: [
      { label: "Strategic thinking",kind: "rating", scale: 5 },
      { label: "Executive presence",kind: "rating", scale: 5 },
      { label: "Track record",      kind: "rating", scale: 5 },
      { label: "Notes",             kind: "text" },
    ],
  },
];

// ---------- Notification templates --------------------------------
const IV_TEMPLATE_SEED = [
  { id: "tpl-invite",     kind: "invite",     label: "Interview invite — candidate",       audience: "candidate", subject: "Interview scheduled · {{job_title}} at {{buyer_name}}", body: "Hi {{candidate_first}}, your {{interview_type}} interview for {{job_title}} at {{buyer_name}} is scheduled for {{slot}}. Panel: {{panel_names}}. {{method_details}}. Reply to confirm or reschedule.", tokens: 7 },
  { id: "tpl-supplier",   kind: "invite",     label: "Interview invite — supplier",        audience: "supplier",  subject: "Action required · interview invite for {{candidate_name}}",        body: "An interview has been requested for {{candidate_name}} on {{job_title}} at {{buyer_name}}. Proposed: {{slot}}. Please confirm with your candidate or propose an alternate.", tokens: 5 },
  { id: "tpl-reminder",   kind: "reminder",   label: "Day-before reminder",                audience: "candidate", subject: "Reminder · interview tomorrow at {{slot_time}}",                   body: "Quick reminder that your {{interview_type}} interview at {{buyer_name}} is tomorrow at {{slot_time}}. {{method_details}}. Reach out if anything has changed.", tokens: 4 },
  { id: "tpl-reschedule", kind: "reschedule", label: "Reschedule notification",            audience: "all",       subject: "Interview rescheduled · {{candidate_name}} / {{job_title}}",       body: "The interview for {{candidate_name}} has been rescheduled from {{old_slot}} to {{new_slot}}. Reason: {{reason}}.", tokens: 5 },
  { id: "tpl-cancel",     kind: "cancel",     label: "Cancel notification",                audience: "all",       subject: "Interview cancelled · {{candidate_name}}",                         body: "The {{interview_type}} interview for {{candidate_name}} has been cancelled. Reason: {{reason}}. {{next_step}}", tokens: 4 },
  { id: "tpl-outcome-adv",kind: "outcome",    label: "Outcome — advanced",                 audience: "candidate", subject: "Good news — moving to the next round",                              body: "Thanks for meeting with {{panel_names}} on {{date}}. We'd like to move forward to {{next_stage}}. Details to follow.", tokens: 4 },
  { id: "tpl-outcome-dec",kind: "outcome",    label: "Outcome — declined",                 audience: "candidate", subject: "Update on your application",                                       body: "Thanks for the time you spent with {{panel_names}}. We've decided not to move forward at this time. Reason: {{reason_code}}.", tokens: 3 },
];

// ---------- Decline reason taxonomy -------------------------------
const IV_DECLINE_SEED = [
  { id: "dr-fit",      label: "Not a fit",            direction: "back", active: true },
  { id: "dr-under",    label: "Underqualified",       direction: "back", active: true },
  { id: "dr-over",     label: "Overqualified",        direction: "back", active: true },
  { id: "dr-salary",   label: "Salary mismatch",      direction: "back", active: true },
  { id: "dr-withdrew", label: "Candidate withdrew",   direction: "back", active: true },
  { id: "dr-noshow",   label: "No-show",              direction: "back", active: true },
  { id: "dr-location", label: "Location",             direction: "back", active: true },
  { id: "dr-comp",     label: "Compliance / clearance",direction: "back", active: false },
  { id: "dr-other",    label: "Other (required note)",direction: "back", active: true },
];

// ---------- Calendar integration state ----------------------------
const IV_CALENDAR_SEED = {
  microsoft365: { connected: true,  tenant: "fleetwind.onmicrosoft.com", users: 412, lastSync: "2 min ago" },
  google:       { connected: false, tenant: null,                          users: 0,  lastSync: null },
  ics:          { connected: true,  tenant: "Always-on",                   users: null,lastSync: "Live" },
};

// ---------- Interview policy by supplier-type / job-family --------
const IV_POLICY_SEED = [
  { id: "p-ic",    scope: "supplier-type", value: "Independent contractor",  required: true,  active: true,  rule: "Every IC engagement requires interview" },
  { id: "p-eor",   scope: "supplier-type", value: "Employer of record",      required: true,  active: true,  rule: "Every EoR engagement requires interview" },
  { id: "p-agy",   scope: "supplier-type", value: "Agency",                  required: false, active: true,  rule: "Agency engagements skip interview by default" },
  { id: "p-pro",   scope: "job-family",    value: "Professional · Director+",required: true,  active: true,  rule: "Director, VP, and C-suite roles" },
  { id: "p-eng",   scope: "job-family",    value: "Engineering ≥ $150/hr",   required: true,  active: true,  rule: "High-rate engineering roles" },
  { id: "p-sales", scope: "job-family",    value: "Sales · Quota-carrying",  required: true,  active: false, rule: "Sales roles with revenue responsibility" },
];

// ---------- Skip-interview approval requests ----------------------
const IV_SKIP_SEED = [
  { id: "skip-001", reqId: "REQ-A1B2C3", candidate: "Helena Voss",   reason: "Re-hire — interviewed within 90 days", actor: "Amy Hennen",   approver: "T. Donin", status: "Approved", at: "Yesterday" },
  { id: "skip-002", reqId: "REQ-D4E5F6", candidate: "James Okonkwo", reason: "Urgent backfill — known to team",      actor: "M. Wijaya",     approver: "T. Donin", status: "Pending",  at: "2 hr ago" },
  { id: "skip-003", reqId: "REQ-G7H8I9", candidate: "Priya Chen",    reason: "Other",                                actor: "R. Devarajan",  approver: "T. Donin", status: "Denied",   at: "3 days ago" },
];

// ---------- Interview SLA thresholds ------------------------------
const IV_SLA_SEED = {
  timeToSchedule: { target: 48, unit: "hours", warn: 36, current: 32 },
  timeToFeedback: { target: 24, unit: "hours", warn: 18, current: 21 },
  timeToDecision: { target: 72, unit: "hours", warn: 60, current: 88 },
};

// ---------- Catalog version history -------------------------------
const IV_VERSIONS_SEED = [
  { id: "v-12", at: "Today",       actor: "T. Donin",   summary: "Added Executive type · default panel changed",       items: 2 },
  { id: "v-11", at: "May 22",      actor: "Amy Hennen", summary: "Made Technical scorecard required-to-advance",       items: 1 },
  { id: "v-10", at: "May 14",      actor: "T. Donin",   summary: "Retired the legacy Behavioral type",                  items: 1 },
  { id: "v-09", at: "Apr 30",      actor: "Amy Hennen", summary: "Added six decline reason codes",                      items: 6 },
];

// ---------- Submittals + Interview objects (M / S / W shared) ----------
// Every Interview is a child of a submittal. We seed five candidates
// across three requisitions so the demo has enough variety.
const IV_SUBMITTAL_SEED = [
  {
    id: "sub-001",
    candidate:  { id: "ca-h-voss",  name: "Helena Voss",     avatarColor: "purple", source: "Direct apply" },
    reqId:      "PRO-K1L2M3",
    reqTitle:   "Senior Product Manager · Workforce",
    buyer:      "Fleetwind Logistics",
    supplier:   "Aerotek",
    stage:      "Interview",
    round:      2,
    rounds:     3,
    score:      4.5,
    interviews: [
      { id: "iv-001a", typeId: "vid",  date: "May 12", slot: "May 12 · 10:00",     duration: 45, method: "Video",    location: "Zoom",     panel: ["Amy Hennen"],                       status: "Done",      round: 1, scorecards: [{ panelist: "Amy Hennen", score: 4.5, submitted: true,  card: {Communication: 5, "Domain knowledge": 4, "Role fit": 5, Notes: "Strong product sense; deep contingent-labor background."} }] },
      { id: "iv-001b", typeId: "tech", date: "May 18", slot: "May 18 · 14:00",     duration: 60, method: "Video",    location: "Zoom",     panel: ["T. Donin", "R. Devarajan"],         status: "Done",      round: 2, scorecards: [{ panelist: "T. Donin",    score: 4.0, submitted: true,  card: {"Problem solving": 4, "Coding / craft": 4, "System design": 4, Communication: 4, "Hire / no-hire": 4, Notes: "Solid system thinking; communication clear."} }, { panelist: "R. Devarajan", score: null, submitted: false, card: {} }] },
      { id: "iv-001c", typeId: "pnl",  date: "May 28", slot: "May 28 · 13:30",     duration: 60, method: "Video",    location: "Zoom",     panel: ["A. Hennen", "M. Wijaya", "T. Donin"],status: "Scheduled", round: 3, scorecards: [] },
    ],
  },
  {
    id: "sub-002",
    candidate:  { id: "ca-d-ortiz", name: "Daniel Ortiz",     avatarColor: "blue",   source: "Referral" },
    reqId:      "PRO-K1L2M3",
    reqTitle:   "Senior Product Manager · Workforce",
    buyer:      "Fleetwind Logistics",
    supplier:   "Aerotek",
    stage:      "Interview",
    round:      2,
    rounds:     3,
    score:      4.0,
    interviews: [
      { id: "iv-002a", typeId: "ph",  date: "May 09", slot: "May 09 · 11:00",     duration: 30, method: "Phone",    location: "—",         panel: ["Amy Hennen"],                       status: "Done",      round: 1, scorecards: [{ panelist: "Amy Hennen", score: 4.0, submitted: true, card: {Communication: 4, "Role fit": 4, Notes: "Good range; lighter on enterprise scale."} }] },
      { id: "iv-002b", typeId: "tech",date: "May 16", slot: "May 16 · 15:00",     duration: 60, method: "Video",    location: "Zoom",      panel: ["T. Donin", "M. Wijaya"],            status: "Done",      round: 2, scorecards: [{ panelist: "T. Donin", score: 4.0, submitted: true, card: {"Problem solving": 4, "Coding / craft": 3, "System design": 4, Communication: 5, "Hire / no-hire": 4, Notes: "Confident, structured."} }, { panelist: "M. Wijaya", score: 4.5, submitted: true, card: {"Problem solving": 5, "Coding / craft": 4, "System design": 4, Communication: 5, "Hire / no-hire": 5, Notes: "Excellent partner; would hire."} }] },
    ],
  },
  {
    id: "sub-003",
    candidate:  { id: "ca-m-pelle", name: "Margaux Pelletier", avatarColor: "orange", source: "Search firm" },
    reqId:      "PRO-T1U2V3",
    reqTitle:   "Sales Director · EMEA",
    buyer:      "Helios Power",
    supplier:   "Heidrick & Struggles",
    stage:      "Interview",
    round:      3,
    rounds:     3,
    score:      4.5,
    interviews: [
      { id: "iv-003a", typeId: "vid",  date: "May 06", slot: "May 06 · 09:00", duration: 45, method: "Video",    location: "Zoom",         panel: ["Amy Hennen"],                       status: "Done",      round: 1, scorecards: [{ panelist: "Amy Hennen", score: 4.5, submitted: true, card: {Communication: 5, "Domain knowledge": 5, "Role fit": 4, Notes: "Closed > €38M last year."} }] },
      { id: "iv-003b", typeId: "exec", date: "May 15", slot: "May 15 · 16:00", duration: 45, method: "In person",location: "EMEA HQ · London", panel: ["A. Hennen", "M. Wijaya"],        status: "Done",      round: 2, scorecards: [{ panelist: "A. Hennen", score: 4.5, submitted: true, card: {"Strategic thinking": 5, "Executive presence": 5, "Track record": 4, Notes: "Highly polished."} }, { panelist: "M. Wijaya", score: 4.5, submitted: true, card: {"Strategic thinking": 4, "Executive presence": 5, "Track record": 5, Notes: "Will close. Recommend hire."} }] },
      { id: "iv-003c", typeId: "exec", date: "May 24", slot: "May 24 · 11:00", duration: 45, method: "In person",location: "Boardroom · NYC", panel: ["Board"],                          status: "Awaiting confirmation", round: 3, scorecards: [] },
    ],
  },
  {
    id: "sub-004",
    candidate:  { id: "ca-j-okon",  name: "James Okonkwo",     avatarColor: "teal",  source: "Search firm" },
    reqId:      "PRO-T1U2V3",
    reqTitle:   "Sales Director · EMEA",
    buyer:      "Helios Power",
    supplier:   "Heidrick & Struggles",
    stage:      "Interview",
    round:      1,
    rounds:     3,
    score:      4.0,
    interviews: [
      { id: "iv-004a", typeId: "vid",  date: "May 09", slot: "May 09 · 13:00", duration: 45, method: "Video",    location: "Zoom",         panel: ["Amy Hennen"],                       status: "Done",      round: 1, scorecards: [{ panelist: "Amy Hennen", score: 4.0, submitted: true, card: {Communication: 4, "Domain knowledge": 4, "Role fit": 4, Notes: "Strong EMEA network."} }] },
      { id: "iv-004b", typeId: "exec", date: "May 30", slot: "May 30 · 09:30", duration: 45, method: "Video",    location: "Zoom",         panel: ["A. Hennen", "M. Wijaya"],           status: "Scheduled", round: 2, scorecards: [] },
    ],
  },
  {
    id: "sub-005",
    candidate:  { id: "ca-a-roy",   name: "Anita Roy",         avatarColor: "green", source: "Referral" },
    reqId:      "PRO-N4O5P6",
    reqTitle:   "Engineering Lead · Mobile platform",
    buyer:      "Fleetwind Logistics",
    supplier:   "Aerotek",
    stage:      "Offer",
    round:      3,
    rounds:     3,
    score:      4.5,
    interviews: [
      { id: "iv-005a", typeId: "ph",   date: "Apr 28", slot: "Apr 28 · 10:30", duration: 30, method: "Phone",    location: "—",            panel: ["Terry Donin"],                      status: "Done",      round: 1, scorecards: [{ panelist: "Terry Donin", score: 4.5, submitted: true, card: {Communication: 5, "Role fit": 4, Notes: "Tier-one mobile background."} }] },
      { id: "iv-005b", typeId: "tech", date: "May 05", slot: "May 05 · 11:00", duration: 60, method: "Video",    location: "Zoom",         panel: ["T. Donin", "R. Devarajan"],         status: "Done",      round: 2, scorecards: [{ panelist: "T. Donin", score: 4.5, submitted: true, card: {"Problem solving": 5, "Coding / craft": 5, "System design": 4, Communication: 4, "Hire / no-hire": 5, Notes: "Deep iOS / Android; led teams up to 24."} }, { panelist: "R. Devarajan", score: 4.5, submitted: true, card: {"Problem solving": 4, "Coding / craft": 5, "System design": 5, Communication: 4, "Hire / no-hire": 5, Notes: "Hire."} }] },
      { id: "iv-005c", typeId: "pnl",  date: "May 12", slot: "May 12 · 14:00", duration: 60, method: "Video",    location: "Zoom",         panel: ["T. Donin", "M. Wijaya", "A. Hennen"],status: "Done",      round: 3, scorecards: [{ panelist: "T. Donin", score: 4.5, submitted: true, card: {Leadership: 5, Collaboration: 4, "Domain expertise": 5, "Culture add": 5, Notes: "Recommend hire."} }, { panelist: "M. Wijaya", score: 4.5, submitted: true, card: {Leadership: 4, Collaboration: 5, "Domain expertise": 4, "Culture add": 5, Notes: "Strong yes."} }, { panelist: "A. Hennen", score: 4.5, submitted: true, card: {Leadership: 5, Collaboration: 5, "Domain expertise": 5, "Culture add": 4, Notes: "Hire."} }] },
    ],
  },
];

// ---------- Availability windows ----------------------------------
const IV_WINDOWS_SEED = [
  { id: "win-001", reqId: "PRO-K1L2M3", owner: "Amy Hennen", days: 10, totalSlots: 14, claimed: 5, openedAt: "May 22" },
  { id: "win-002", reqId: "PRO-T1U2V3", owner: "Amy Hennen", days: 5,  totalSlots: 8,  claimed: 6, openedAt: "May 25" },
];

// ---------- Org-tree interviewer pool -----------------------------
const IV_INTERVIEWERS = [
  { id: "u-ah",  name: "Amy Hennen",      role: "VP, Talent",          dept: "People",       avatar: "AH" },
  { id: "u-td",  name: "Terry Donin",     role: "Director, Engineering",dept: "Engineering",  avatar: "TD" },
  { id: "u-rd",  name: "R. Devarajan",    role: "Staff Engineer",      dept: "Engineering",   avatar: "RD" },
  { id: "u-mw",  name: "M. Wijaya",       role: "Director, Product",   dept: "Product",       avatar: "MW" },
  { id: "u-jk",  name: "J. Kim",          role: "Recruiter",           dept: "People",        avatar: "JK" },
  { id: "u-sb",  name: "S. Bell",         role: "Senior IC · Mobile",  dept: "Engineering",   avatar: "SB" },
  { id: "u-pn",  name: "P. Nguyen",       role: "VP, Sales EMEA",      dept: "Sales",         avatar: "PN" },
  { id: "u-cb",  name: "C. Barros",       role: "Skip-level",          dept: "Engineering",   avatar: "CB" },
  { id: "u-bd",  name: "Board",           role: "Compensation cmte",   dept: "Board",         avatar: "BD" },
];

// =====================================================================
// PUBLIC API · accessor functions used by every interview-* surface.
// =====================================================================
function ivGetTypes()        { return ivGet("types",      [...IV_TYPE_SEED]); }
function ivSetTypes(t)       { ivSet("types", t); }
function ivGetScorecards()   { return ivGet("scorecards", [...IV_SCORECARD_SEED]); }
function ivSetScorecards(s)  { ivSet("scorecards", s); }
function ivGetTemplates()    { return ivGet("templates",  [...IV_TEMPLATE_SEED]); }
function ivSetTemplates(t)   { ivSet("templates", t); }
function ivGetDeclineReasons(){ return ivGet("declines", [...IV_DECLINE_SEED]); }
function ivSetDeclineReasons(r){ ivSet("declines", r); }
function ivGetCalendar()     { return ivGet("calendar",   {...IV_CALENDAR_SEED}); }
function ivSetCalendar(c)    { ivSet("calendar", c); }
function ivGetPolicies()     { return ivGet("policies",   [...IV_POLICY_SEED]); }
function ivSetPolicies(p)    { ivSet("policies", p); }
function ivGetSkips()        { return ivGet("skips",      [...IV_SKIP_SEED]); }
function ivSetSkips(s)       { ivSet("skips", s); }
function ivGetSla()          { return ivGet("sla",        {...IV_SLA_SEED}); }
function ivSetSla(s)         { ivSet("sla", s); }
function ivGetVersions()     { return ivGet("versions",   [...IV_VERSIONS_SEED]); }
function ivGetSubmittals()   { return ivGet("submittals", IV_SUBMITTAL_SEED.map((s) => ({...s, interviews: s.interviews.map((iv) => ({...iv, scorecards: [...iv.scorecards]}))}))); }
function ivSetSubmittals(s)  { ivSet("submittals", s); }
function ivGetWindows()      { return ivGet("windows",    [...IV_WINDOWS_SEED]); }
function ivGetInterviewers() { return IV_INTERVIEWERS; }

// ---------- Helpers (used by every role surface) -----------------------
function ivTypeById(id)        { return ivGetTypes().find((t) => t.id === id); }
function ivScorecardById(id)   { return ivGetScorecards().find((s) => s.id === id); }
function ivStatusTone(status) {
  if (status === "Done")                    return "done";
  if (status === "Scheduled")               return "scheduled";
  if (status === "Awaiting confirmation")   return "pending";
  if (status === "Cancelled")               return "cancelled";
  return "draft";
}

// Aggregate per-submittal score from all done interviews' scorecards.
function ivRollUpScore(submittal) {
  const done = submittal.interviews.filter((iv) => iv.status === "Done");
  let n = 0, sum = 0;
  for (const iv of done) {
    for (const sc of iv.scorecards) {
      if (sc.submitted && typeof sc.score === "number") {
        n += 1;
        sum += sc.score;
      }
    }
  }
  return n === 0 ? null : Math.round((sum / n) * 10) / 10;
}

function ivOutstandingScorecards(submittal) {
  let n = 0;
  for (const iv of submittal.interviews) {
    if (iv.status !== "Done") continue;
    for (const sc of iv.scorecards) {
      if (!sc.submitted) n += 1;
    }
  }
  return n;
}

// Mutating helpers — used by manager scheduling / supplier accept etc.
function ivUpsertInterview(subId, iv) {
  const subs = ivGetSubmittals();
  const out = subs.map((s) => {
    if (s.id !== subId) return s;
    const i = s.interviews.findIndex((x) => x.id === iv.id);
    const next = i < 0 ? [...s.interviews, iv] : s.interviews.map((x) => x.id === iv.id ? iv : x);
    return { ...s, interviews: next };
  });
  ivSetSubmittals(out);
}
function ivAdvanceSubmittal(subId, toStage) {
  const subs = ivGetSubmittals();
  ivSetSubmittals(subs.map((s) => s.id === subId ? { ...s, stage: toStage } : s));
}

// ---------- Tiny atoms shared across role surfaces ---------------------
function IvAvatar({ name, color }) {
  const initials = (name || "?").split(/\s+/).slice(0, 2).map((s) => s[0] || "").join("").toUpperCase();
  const cls = "iv-avatar" + (color ? ` iv-avatar--${color}` : "");
  return <span className={cls} aria-hidden="true">{initials}</span>;
}

function IvPill({ tone, children }) {
  return <span className={`iv-pill iv-pill--${tone || "default"}`}>{children}</span>;
}

function IvStatusPill({ status }) {
  return <IvPill tone={ivStatusTone(status)}>{status}</IvPill>;
}

function IvRail({ label, children }) {
  return (
    <section className="iv-rail">
      <header className="iv-rail-head">{label}</header>
      <div className="iv-rail-body">{children}</div>
    </section>
  );
}

function IvCard({ id, code, title, sub, children, actions }) {
  // `code` and `id` props are accepted for back-compat with earlier
  // task-list scaffolding but are NOT rendered into the UI. Section
  // identity is communicated through the title alone.
  void code; void id;
  return (
    <article className="iv-card" data-iv-id={id}>
      <header className="iv-card-head">
        <div className="iv-card-text">
          <h4 className="iv-card-title">{title}</h4>
          {sub && <p className="iv-card-sub">{sub}</p>}
        </div>
        {actions && <div className="iv-card-actions">{actions}</div>}
      </header>
      <div className="iv-card-body">{children}</div>
    </article>
  );
}

// Export everything to window for cross-file consumption.
Object.assign(window, {
  // Stores
  ivGetTypes, ivSetTypes,
  ivGetScorecards, ivSetScorecards,
  ivGetTemplates, ivSetTemplates,
  ivGetDeclineReasons, ivSetDeclineReasons,
  ivGetCalendar, ivSetCalendar,
  ivGetPolicies, ivSetPolicies,
  ivGetSkips, ivSetSkips,
  ivGetSla, ivSetSla,
  ivGetVersions,
  ivGetSubmittals, ivSetSubmittals,
  ivGetWindows,
  ivGetInterviewers,
  // Helpers
  ivTypeById, ivScorecardById,
  ivStatusTone, ivRollUpScore, ivOutstandingScorecards,
  ivUpsertInterview, ivAdvanceSubmittal,
  ivSubscribe, ivBump,
  // Atoms
  IvAvatar, IvPill, IvStatusPill, IvRail, IvCard,
});
