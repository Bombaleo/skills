// =====================================================================
// Flex Work — Timesheets
//   · TimesheetsPage         — searchable list (timesheet · status ·
//                              worker · supplier · date · start · end
//                              · duration).
//   · TimesheetDetailsPage   — left summary card (pending approval ·
//                              worker · job · hours · break) + right
//                              timeline (calendar gutter + activity
//                              feed for shift, breaks, end).
// =====================================================================

const { useState: useStateTs, useMemo: useMemoTs } = React;

// ---------- Mock data ----------------------------------------------------
// Worker ids reference WORKERS (workforce.jsx) so chips render the same.
// Status values mirror the Figma spec: Open · Closed · Review · Pending
// Approval.

const TIMESHEETS_BASE = [
  { id: "TS-91247", booking: "Work assignment #786", worker: "w-ml", supplier: "gs", status: "Pending Approval", date: "04.22.2026", actualStart: "5:58 AM",  schedStart: "6:00 AM",  actualEnd: "3:07 PM", schedEnd: "3:00 PM", duration: "9:09",  schedDuration: "9:00", role: "Production Associate" },
  { id: "TS-91239", booking: "Work assignment #780", worker: "w-jc", supplier: "sw", status: "Closed",           date: "04.21.2026", actualStart: "7:02 AM",  schedStart: "7:00 AM",  actualEnd: "4:11 PM", schedEnd: "4:00 PM", duration: "9:09",  schedDuration: "9:00", role: "Line Manager" },
  { id: "TS-91228", booking: "Work assignment #772", worker: "w-pr", supplier: "th", status: "Review",           date: "04.21.2026", actualStart: "9:18 AM",  schedStart: "9:00 AM",  actualEnd: "5:55 PM", schedEnd: "5:00 PM", duration: "8:37",  schedDuration: "8:00", role: "Production Associate" },
  { id: "TS-91217", booking: "Work assignment #765", worker: "w-tk", supplier: "ph", status: "Closed",           date: "04.20.2026", actualStart: "5:45 AM",  schedStart: "6:00 AM",  actualEnd: "2:02 PM", schedEnd: "2:00 PM", duration: "8:17",  schedDuration: "8:00", role: "Prep Cook" },
  { id: "TS-91205", booking: "Work assignment #759", worker: "w-ss", supplier: "ss", status: "Closed",           date: "04.20.2026", actualStart: "8:30 AM",  schedStart: "8:30 AM",  actualEnd: "4:30 PM", schedEnd: "4:30 PM", duration: "8:00",  schedDuration: "8:00", role: "Warehouse Clerk" },
  { id: "TS-91192", booking: "Work assignment #748", worker: "w-cc", supplier: "gs", status: "Review",           date: "04.17.2026", actualStart: "6:14 AM",  schedStart: "6:00 AM",  actualEnd: "12:48 PM", schedEnd: "2:00 PM", duration: "6:34", schedDuration: "8:00", role: "Prep Cook" },
  { id: "TS-91181", booking: "Work assignment #741", worker: "w-mh", supplier: "sw", status: "Open",             date: "04.23.2026", actualStart: "5:01 PM",  schedStart: "5:00 PM",  actualEnd: "—",       schedEnd: "11:00 PM",duration: "—",     schedDuration: "6:00", role: "Server" },
  { id: "TS-91175", booking: "Work assignment #738", worker: "w-ja", supplier: "th", status: "Open",             date: "04.23.2026", actualStart: "4:02 PM",  schedStart: "4:00 PM",  actualEnd: "—",       schedEnd: "12:00 AM",duration: "—",     schedDuration: "8:00", role: "Bartender" },
  { id: "TS-91163", booking: "Work assignment #729", worker: "w-ks", supplier: "ph", status: "Closed",           date: "04.16.2026", actualStart: "11:00 AM", schedStart: "11:00 AM", actualEnd: "7:24 PM", schedEnd: "7:00 PM", duration: "8:24",  schedDuration: "8:00", role: "Server" },
  { id: "TS-91152", booking: "Work assignment #720", worker: "w-jg", supplier: "gs", status: "Open",             date: "04.23.2026", actualStart: "—",        schedStart: "10:00 AM", actualEnd: "—",       schedEnd: "6:00 PM", duration: "—",     schedDuration: "8:00", role: "Prep Cook" },
  { id: "TS-91141", booking: "Work assignment #714", worker: "w-mw", supplier: "ss", status: "Closed",           date: "04.15.2026", actualStart: "6:00 AM",  schedStart: "6:00 AM",  actualEnd: "4:32 PM", schedEnd: "4:00 PM", duration: "10:32", schedDuration: "10:00", role: "Factory Line Assembler" },
  { id: "TS-91134", booking: "Work assignment #708", worker: "w-aw", supplier: "sw", status: "Pending Approval", date: "04.15.2026", actualStart: "8:15 AM",  schedStart: "8:00 AM",  actualEnd: "4:42 PM", schedEnd: "4:00 PM", duration: "8:27",  schedDuration: "8:00", role: "Operator" },
];

// ---------- Professional engagement-type examples -----------------------
// Only injected into the list when the active org has the Professional
// jobs category enabled (Settings → Configuration → Jobs). Each row
// carries an `engagementType` of Assignment / Project / Statement of
// Work, plus the engagement-specific fields (period boundaries, billing
// reference, cadence, billable-vs-non-billable hour split). The row
// renderer below — and the detail page — swap field content based on
// engagementType while keeping the same cells, columns, and overall
// shape as a shift timesheet, so a tenant with Frontline + Professional
// turned on sees one mixed list with one layout.
//
// Pro rows still carry the legacy `actualStart`/`schedStart`/etc.
// fields so the search-by-clock + date-bucket filters keep working;
// the row & detail render layers prefer the engagement fields when
// engagementType !== "Shift".
const TIMESHEETS_PROFESSIONAL = [
  {
    id: "TS-92041", booking: "Assignment ASGN-2026-1144", worker: "w-pro-pr", supplier: "th", status: "Pending Approval",
    date: "05.10.2026",
    actualStart: "May 04",  schedStart: "May 04",
    actualEnd:   "May 10",  schedEnd:   "May 10",
    duration:    "40:00",   schedDuration: "40:00",
    role: "Senior Software Engineer",
    engagementType: "Assignment",
    engagementRef: "ASGN-2026-1144",
    engagementName: "Payroll modernization",
    periodLabel:  "Wk ending May 10",
    periodStart:  "May 04",
    periodEnd:    "May 10",
    billableHours: "38:30",
    nonBillableHours: "1:30",
    billingBasis: "Weekly",
    timeCapture: "Time Tracking",
    cadence: "Weekly",
  },
  {
    id: "TS-92038", booking: "Assignment ASGN-2024-0612", worker: "w-pro-rd", supplier: "ap", status: "Review",
    date: "04.30.2026",
    actualStart: "Apr 01",  schedStart: "Apr 01",
    actualEnd:   "Apr 30",  schedEnd:   "Apr 30",
    duration:    "168:00",  schedDuration: "160:00",
    role: "Engineering Manager",
    engagementType: "Assignment",
    engagementRef: "ASGN-2024-0612",
    engagementName: "Platform reliability program",
    periodLabel:  "April 2026",
    periodStart:  "Apr 01",
    periodEnd:    "Apr 30",
    billableHours: "162:00",
    nonBillableHours: "6:00",
    billingBasis: "Monthly",
    timeCapture: "Time Tracking",
    cadence: "Monthly",
  },
  {
    id: "TS-92027", booking: "Assignment ASGN-2026-0744", worker: "w-pro-eh", supplier: "sw", status: "Closed",
    date: "03.31.2026",
    actualStart: "Mar 01", schedStart: "Mar 01",
    actualEnd:   "Mar 31", schedEnd:   "Mar 31",
    duration:    "172:00", schedDuration: "168:00",
    role: "Senior Product Manager",
    engagementType: "Assignment",
    engagementRef: "ASGN-2026-0744",
    engagementName: "Interim PMO leadership",
    periodLabel:  "March 2026",
    periodStart:  "Mar 01",
    periodEnd:    "Mar 31",
    billableHours: "168:00",
    nonBillableHours: "4:00",
    billingBasis: "Monthly",
    timeCapture: "Time Tracking",
    cadence: "Monthly",
  },
  {
    id: "TS-92019", booking: "Assignment ASGN-2026-1182", worker: "w-pro-lc", supplier: "sw", status: "Pending Approval",
    date: "05.10.2026",
    actualStart: "May 04",  schedStart: "May 04",
    actualEnd:   "May 10",  schedEnd:   "May 10",
    duration:    "36:00",   schedDuration: "40:00",
    role: "UX Designer",
    engagementType: "Assignment",
    engagementRef: "ASGN-2026-1182",
    engagementName: "WMS UX research sprints",
    periodLabel:  "Wk ending May 10",
    periodStart:  "May 04",
    periodEnd:    "May 10",
    billableHours: "32:00",
    nonBillableHours: "4:00",
    billingBasis: "Hourly",
    timeCapture: "Time Tracking",
    cadence: "Hourly",
  },
  {
    id: "TS-92011", booking: "Project PRJ-2026-018 · M2", worker: "w-pro-mb", supplier: "ap", status: "Closed",
    date: "05.08.2026",
    actualStart: "Apr 01",  schedStart: "Apr 01",
    actualEnd:   "May 08",  schedEnd:   "May 08",
    duration:    "—",       schedDuration: "—",
    role: "DevOps Engineer",
    engagementType: "Project",
    engagementRef: "PRJ-2026-018",
    engagementName: "DC Alpha · WMS rollout",
    periodLabel:  "Milestone 2 · M2",
    periodStart:  "Apr 01",
    periodEnd:    "May 08",
    billableHours: "—",
    nonBillableHours: "—",
    milestone: "M2 · Racking commissioning",
    acceptanceDate: "May 08",
    billingBasis: "Milestone",
    timeCapture: "N/A",
    cadence: "Milestone",
  },
  {
    id: "TS-92007", booking: "SOW SOW-PRO-2025-014", worker: "w-pro-mw", supplier: "wf", status: "Review",
    date: "05.01.2026",
    actualStart: "Apr 01",  schedStart: "Apr 01",
    actualEnd:   "Apr 30",  schedEnd:   "Apr 30",
    duration:    "—",       schedDuration: "—",
    role: "Data Scientist",
    engagementType: "Statement of Work",
    engagementRef: "SOW-PRO-2025-014",
    engagementName: "Workforce analytics platform",
    periodLabel:  "Milestone 3 · April",
    periodStart:  "Apr 01",
    periodEnd:    "Apr 30",
    billableHours: "—",
    nonBillableHours: "—",
    milestone: "M3 · Cohort model live",
    acceptanceDate: "Apr 28",
    billingBasis: "Milestone",
    timeCapture: "N/A",
    cadence: "Milestone",
  },
  {
    id: "TS-92002", booking: "SOW SOW-PRO-2026-009", worker: "w-pro-nh", supplier: "sw", status: "Pending Approval",
    date: "05.12.2026",
    actualStart: "Apr 27",  schedStart: "Apr 27",
    actualEnd:   "May 11",  schedEnd:   "May 11",
    duration:    "84:00",   schedDuration: "80:00",
    role: "Marketing Manager",
    engagementType: "Statement of Work",
    engagementRef: "SOW-PRO-2026-009",
    engagementName: "Brand refresh · Q2 launch",
    periodLabel:  "Milestone 2 · launch",
    periodStart:  "Apr 27",
    periodEnd:    "May 11",
    billableHours: "80:00",
    nonBillableHours: "4:00",
    milestone: "M2 · Public launch",
    acceptanceDate: "May 11",
    billingBasis: "Milestone",
    timeCapture: "Time Tracking",
    cadence: "Milestone",
  },

  // ---- Open / in-progress engagement timesheets ----------------------
  // The status tabs land on "Open" first, so each engagement type needs
  // at least one live, mid-period row or the default view reads as
  // Shift-only. Open Assignment = current period accruing (no period
  // end on record yet); Open Project / SOW = a milestone still being
  // worked, no acceptance date.
  {
    id: "TS-92054", booking: "Assignment ASGN-2026-1209", worker: "w-pro-rd-c39", supplier: "ap", status: "Open",
    date: "05.18.2026",
    actualStart: "May 11",  schedStart: "May 11",
    actualEnd:   "—",       schedEnd:   "May 17",
    duration:    "—",       schedDuration: "40:00",
    role: "Solutions Architect",
    engagementType: "Assignment",
    engagementRef: "ASGN-2026-1209",
    engagementName: "Tax engine migration",
    periodLabel:  "Wk ending May 17",
    periodStart:  "May 11",
    periodEnd:    "May 17",
    billableHours: "24:30",
    nonBillableHours: "0:30",
    billingBasis: "Weekly",
    timeCapture: "Time Tracking",
    cadence: "Weekly",
  },
  {
    id: "TS-92049", booking: "Assignment ASGN-2026-1255", worker: "w-pro-pr-c40", supplier: "ph", status: "Open",
    date: "05.18.2026",
    actualStart: "May 01",  schedStart: "May 01",
    actualEnd:   "—",       schedEnd:   "May 31",
    duration:    "—",       schedDuration: "160:00",
    role: "Business Analyst",
    engagementType: "Assignment",
    engagementRef: "ASGN-2026-1255",
    engagementName: "Benefits open-enrollment readiness",
    periodLabel:  "May 2026",
    periodStart:  "May 01",
    periodEnd:    "May 31",
    billableHours: "96:00",
    nonBillableHours: "3:00",
    billingBasis: "Monthly",
    timeCapture: "Time Tracking",
    cadence: "Monthly",
  },
  {
    id: "TS-92016", booking: "Project PRJ-2026-022 · M3", worker: "w-pro-mb-c42", supplier: "ap", status: "Open",
    date: "05.18.2026",
    actualStart: "Apr 15",  schedStart: "Apr 15",
    actualEnd:   "—",       schedEnd:   "Jun 05",
    duration:    "—",       schedDuration: "—",
    role: "DevOps Engineer",
    engagementType: "Project",
    engagementRef: "PRJ-2026-022",
    engagementName: "DC Beta · network cutover",
    periodLabel:  "Milestone 3 · M3",
    periodStart:  "Apr 15",
    periodEnd:    "Jun 05",
    billableHours: "—",
    nonBillableHours: "—",
    milestone: "M3 · Core switch migration",
    acceptanceDate: "—",
    billingBasis: "Milestone",
    timeCapture: "N/A",
    cadence: "Milestone",
  },
  {
    id: "TS-92004", booking: "SOW SOW-PRO-2026-021", worker: "w-pro-nh-c44", supplier: "wf", status: "Open",
    date: "05.18.2026",
    actualStart: "May 04",  schedStart: "May 04",
    actualEnd:   "—",       schedEnd:   "Jun 12",
    duration:    "—",       schedDuration: "—",
    role: "Data Engineer",
    engagementType: "Statement of Work",
    engagementRef: "SOW-PRO-2026-021",
    engagementName: "Data lake consolidation",
    periodLabel:  "Milestone 1 · ingest",
    periodStart:  "May 04",
    periodEnd:    "Jun 12",
    billableHours: "—",
    nonBillableHours: "—",
    milestone: "M1 · Source onboarding",
    acceptanceDate: "—",
    billingBasis: "Milestone",
    timeCapture: "N/A",
    cadence: "Milestone",
  },

  // ---- More variety per type across the remaining statuses -----------
  {
    id: "TS-92046", booking: "Assignment ASGN-2026-1198", worker: "w-pro-eh-c38", supplier: "sw", status: "Review",
    date: "05.10.2026",
    actualStart: "May 04",  schedStart: "May 04",
    actualEnd:   "May 10",  schedEnd:   "May 10",
    duration:    "44:00",   schedDuration: "40:00",
    role: "QA Lead",
    engagementType: "Assignment",
    engagementRef: "ASGN-2026-1198",
    engagementName: "Time & attendance QA hardening",
    periodLabel:  "Wk ending May 10",
    periodStart:  "May 04",
    periodEnd:    "May 10",
    billableHours: "42:00",
    nonBillableHours: "2:00",
    billingBasis: "Weekly",
    timeCapture: "Time Tracking",
    cadence: "Weekly",
  },
  {
    id: "TS-92033", booking: "Assignment ASGN-2025-0918", worker: "w-pro-lc-c41", supplier: "th", status: "Closed",
    date: "04.30.2026",
    actualStart: "Apr 01",  schedStart: "Apr 01",
    actualEnd:   "Apr 30",  schedEnd:   "Apr 30",
    duration:    "150:00",  schedDuration: "160:00",
    role: "Technical Writer",
    engagementType: "Assignment",
    engagementRef: "ASGN-2025-0918",
    engagementName: "API documentation refresh",
    periodLabel:  "April 2026",
    periodStart:  "Apr 01",
    periodEnd:    "Apr 30",
    billableHours: "148:00",
    nonBillableHours: "2:00",
    billingBasis: "Monthly",
    timeCapture: "Time Tracking",
    cadence: "Monthly",
  },
  {
    id: "TS-92024", booking: "Assignment ASGN-2026-1071", worker: "w-pro-mw-c43", supplier: "ap", status: "Pending Approval",
    date: "05.10.2026",
    actualStart: "May 04",  schedStart: "May 04",
    actualEnd:   "May 10",  schedEnd:   "May 10",
    duration:    "40:00",   schedDuration: "40:00",
    role: "Cloud Engineer",
    engagementType: "Assignment",
    engagementRef: "ASGN-2026-1071",
    engagementName: "Cloud cost-governance buildout",
    periodLabel:  "Wk ending May 10",
    periodStart:  "May 04",
    periodEnd:    "May 10",
    billableHours: "39:00",
    nonBillableHours: "1:00",
    billingBasis: "Weekly",
    timeCapture: "Time Tracking",
    cadence: "Weekly",
  },
  {
    id: "TS-92013", booking: "Project PRJ-2026-018 · M1", worker: "w-pro-mb-c86", supplier: "ap", status: "Pending Approval",
    date: "03.20.2026",
    actualStart: "Feb 03",  schedStart: "Feb 03",
    actualEnd:   "Mar 20",  schedEnd:   "Mar 20",
    duration:    "—",       schedDuration: "—",
    role: "DevOps Engineer",
    engagementType: "Project",
    engagementRef: "PRJ-2026-018",
    engagementName: "DC Alpha · WMS rollout",
    periodLabel:  "Milestone 1 · M1",
    periodStart:  "Feb 03",
    periodEnd:    "Mar 20",
    billableHours: "—",
    nonBillableHours: "—",
    milestone: "M1 · Site survey & design",
    acceptanceDate: "Mar 20",
    billingBasis: "Milestone",
    timeCapture: "N/A",
    cadence: "Milestone",
  },
  {
    id: "TS-92009", booking: "Project PRJ-2025-204 · M4", worker: "w-pro-rd-c83", supplier: "wf", status: "Review",
    date: "05.06.2026",
    actualStart: "Apr 06",  schedStart: "Apr 06",
    actualEnd:   "May 06",  schedEnd:   "May 06",
    duration:    "—",       schedDuration: "—",
    role: "Data Scientist",
    engagementType: "Project",
    engagementRef: "PRJ-2025-204",
    engagementName: "Demand-forecasting model",
    periodLabel:  "Milestone 4 · M4",
    periodStart:  "Apr 06",
    periodEnd:    "May 06",
    billableHours: "—",
    nonBillableHours: "—",
    milestone: "M4 · Model validation",
    acceptanceDate: "May 06",
    billingBasis: "Milestone",
    timeCapture: "N/A",
    cadence: "Milestone",
  },
  {
    id: "TS-92005", booking: "SOW SOW-PRO-2025-031", worker: "w-pro-pr-c84", supplier: "th", status: "Closed",
    date: "04.18.2026",
    actualStart: "Mar 16",  schedStart: "Mar 16",
    actualEnd:   "Apr 17",  schedEnd:   "Apr 17",
    duration:    "—",       schedDuration: "—",
    role: "Senior Product Manager",
    engagementType: "Statement of Work",
    engagementRef: "SOW-PRO-2025-031",
    engagementName: "Scheduling rewrite · discovery",
    periodLabel:  "Milestone 1 · discovery",
    periodStart:  "Mar 16",
    periodEnd:    "Apr 17",
    billableHours: "—",
    nonBillableHours: "—",
    milestone: "M1 · Current-state assessment",
    acceptanceDate: "Apr 17",
    billingBasis: "Milestone",
    timeCapture: "N/A",
    cadence: "Milestone",
  },
  {
    id: "TS-92003", booking: "SOW SOW-PRO-2026-014", worker: "w-pro-lc-c85", supplier: "sw", status: "Review",
    date: "05.09.2026",
    actualStart: "Apr 13",  schedStart: "Apr 13",
    actualEnd:   "May 08",  schedEnd:   "May 08",
    duration:    "120:00",  schedDuration: "120:00",
    role: "UX Designer",
    engagementType: "Statement of Work",
    engagementRef: "SOW-PRO-2026-014",
    engagementName: "Manager mobile · design system",
    periodLabel:  "Milestone 2 · build",
    periodStart:  "Apr 13",
    periodEnd:    "May 08",
    billableHours: "118:00",
    nonBillableHours: "2:00",
    milestone: "M2 · Component library",
    acceptanceDate: "May 08",
    billingBasis: "Milestone",
    timeCapture: "Time Tracking",
    cadence: "Milestone",
  },
];
// Inject the pro rows into the base list when the active org has the
// Professional jobs category enabled. The org-level toggle lives in
// jobs-config.jsx; when off the rows are dropped at module load so the
// list reads exactly like today's frontline-only ship. Re-resolves on
// reload (matches every other per-org data store).
(function _injectProRows() {
  const proOn = (typeof window !== "undefined"
    && typeof window.professionalJobsEnabled === "function"
    && window.professionalJobsEnabled());
  if (!proOn) return;
  // Insert near the top so a fresh demo lands on a Pending Approval
  // assignment timesheet rather than scrolling past 12 shifts first.
  TIMESHEETS_BASE.splice(1, 0, ...TIMESHEETS_PROFESSIONAL);
})();

// ---------- Supplier-type variants --------------------------------------
// Only merged into TIMESHEETS_BASE when the matching supplier type is
// enabled for the org (Settings → Configuration → Supplier types). The
// design is identical to the Agency timesheet rows above — the only
// difference is what surfaces in the "Supplier" cell (the row's
// `engagementSource` drives the contextual render below).
//
// • Independent contractor (IC): no supplier intermediary. The
//   `worker` field points at a contractor record (CONTRACTOR_WORKERS_RAW)
//   so the worker chip + initials still render; the "Supplier" cell
//   shows the contractor's LLC name and country flag instead of a
//   supplier chip. The `booking` references the contractor's active
//   agreement.
// • EOR: the EOR provider issues the local employment and bills back
//   the loaded rate, so the row's `supplier` field IS the EOR provider
//   key (REQ_SUPPLIERS.evp / gpe / bwk). The default supplier chip +
//   label render path already resolves the brand correctly.
const TIMESHEETS_IC = [
  { id: "TS-91258", booking: "MSA · Talent for Hire SOW-42",  worker: "c-an", supplier: null, engagementSource: "ic", status: "Pending Approval", date: "04.22.2026", actualStart: "9:04 AM",  schedStart: "9:00 AM",  actualEnd: "5:48 PM",  schedEnd: "5:30 PM", duration: "8:44",  schedDuration: "8:30", role: "UX Researcher" },
  { id: "TS-91253", booking: "MSA · Field Engineering",        worker: "c-rb", supplier: null, engagementSource: "ic", status: "Review",           date: "04.21.2026", actualStart: "8:12 AM",  schedStart: "8:00 AM",  actualEnd: "6:31 PM",  schedEnd: "5:00 PM", duration: "10:19", schedDuration: "9:00", role: "Field Engineer" },
  { id: "TS-91245", booking: "MSA · Mechanical Design",        worker: "c-mk", supplier: null, engagementSource: "ic", status: "Closed",           date: "04.20.2026", actualStart: "10:00 AM", schedStart: "10:00 AM", actualEnd: "6:02 PM",  schedEnd: "6:00 PM", duration: "8:02",  schedDuration: "8:00", role: "Mechanical Designer" },
  { id: "TS-91232", booking: "MSA · Geotech Survey",           worker: "c-th", supplier: null, engagementSource: "ic", status: "Closed",           date: "04.18.2026", actualStart: "7:30 AM",  schedStart: "7:30 AM",  actualEnd: "3:34 PM",  schedEnd: "3:30 PM", duration: "8:04",  schedDuration: "8:00", role: "Geotechnical Engineer" },
];
const TIMESHEETS_EOR = [
  { id: "TS-91261", booking: "Assignment #812 · BO-MED",        worker: "w-iv", supplier: "evp", engagementSource: "eor", status: "Pending Approval", date: "04.22.2026", actualStart: "8:06 AM", schedStart: "8:00 AM", actualEnd: "5:14 PM", schedEnd: "5:00 PM", duration: "9:08", schedDuration: "9:00", role: "Production Associate" },
  { id: "TS-91255", booking: "Assignment #805 · Krakow Hub",    worker: "w-lk", supplier: "gpe", engagementSource: "eor", status: "Review",           date: "04.21.2026", actualStart: "7:48 AM", schedStart: "8:00 AM", actualEnd: "4:32 PM", schedEnd: "4:30 PM", duration: "8:44", schedDuration: "8:30", role: "Line Manager" },
  { id: "TS-91240", booking: "Assignment #798 · Sao Paulo DC",  worker: "w-na", supplier: "bwk", engagementSource: "eor", status: "Closed",           date: "04.20.2026", actualStart: "9:01 AM", schedStart: "9:00 AM", actualEnd: "5:08 PM", schedEnd: "5:00 PM", duration: "8:07", schedDuration: "8:00", role: "Warehouse Clerk" },
  { id: "TS-91226", booking: "Assignment #786 · Pune Plant",    worker: "w-pm", supplier: "evp", engagementSource: "eor", status: "Closed",           date: "04.18.2026", actualStart: "8:30 AM", schedStart: "8:30 AM", actualEnd: "5:42 PM", schedEnd: "5:30 PM", duration: "9:12", schedDuration: "9:00", role: "Operator" },
];
// ---------- Temp-spend tier scaling -------------------------------------
// Inflate / shrink the timesheet list with synthetic clones at high
// tiers and narrative-preserving filtering at low tiers. Preserves the
// IDs referenced by the dashboard activity feed + APPROVALS.

// Pro workers available for clone rotation so a cloned engagement row
// gets its own avatar + name instead of repeating the seed worker.
const _TS_PRO_WORKER_IDS = (typeof WORKERS !== "undefined" ? WORKERS : [])
  .filter((w) => /^w-pro-/.test(w.id))
  .map((w) => w.id);

// Bump the trailing numeric run of a reference string deterministically
// ("ASGN-2026-1144" → "ASGN-2026-1170") so a clone reads as a distinct
// engagement, keeping the prefix + width.
function _tsBumpRef(ref, n) {
  return String(ref).replace(/(\d+)(?!.*\d)/, (m) => {
    const width = m.length;
    const v = (parseInt(m, 10) + n * 13 + 7) % Math.pow(10, width);
    return String(v).padStart(width, "0");
  });
}
// Nudge an "H:MM" duration by a deterministic ± quarter-hour delta,
// clamped at zero. "—" / non-numeric values pass through untouched.
function _tsNudgeHours(hm, n) {
  const m = /^(\d+):(\d{2})$/.exec(String(hm || ""));
  if (!m) return hm;
  let mins = parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
  const delta = ((n * 37) % 13) - 6; // -6 .. +6 quarter-hours
  mins = Math.max(0, mins + delta * 15);
  return `${Math.floor(mins / 60)}:${String(mins % 60).padStart(2, "0")}`;
}
// Clone an Assignment / Project / SOW row into a distinct timesheet:
// fresh reference number, a rotated worker, nudged captured hours, and
// an advanced milestone ordinal — so a filtered engagement-type view
// shows believable variety instead of N copies of one seed row.
function _tsCloneProRow(src, n, id) {
  const out = { id };
  if (_TS_PRO_WORKER_IDS.length) {
    out.worker = _TS_PRO_WORKER_IDS[(n * 3 + 1) % _TS_PRO_WORKER_IDS.length];
  }
  if (src.engagementRef) {
    const ref = _tsBumpRef(src.engagementRef, n);
    out.engagementRef = ref;
    out.booking = String(src.booking).replace(src.engagementRef, ref);
  }
  if (src.billableHours && src.billableHours !== "—") out.billableHours = _tsNudgeHours(src.billableHours, n);
  if (src.nonBillableHours && src.nonBillableHours !== "—") out.nonBillableHours = _tsNudgeHours(src.nonBillableHours, n);
  if (src.milestone) {
    const mm = /M(\d+)/.exec(src.milestone);
    if (mm) {
      const next = ((parseInt(mm[1], 10) - 1 + n) % 5) + 1;
      out.milestone = src.milestone.replace(/M\d+/, `M${next}`);
      if (src.periodLabel) {
        out.periodLabel = src.periodLabel
          .replace(/Milestone \d+/i, `Milestone ${next}`)
          .replace(/(^|[·\s])M\d+/, (mt) => mt.replace(/M\d+/, `M${next}`));
      }
    }
  }
  return out;
}
const TIMESHEETS = (window.inflateList || ((b) => b.slice()))(TIMESHEETS_BASE, {
  preserveIds: ["TS-91247", "TS-91239", "TS-91228", "TS-91217", "TS-91192", "TS-91134"],
  minRows: 6,
  maxRows: 220,
  makeClone: (src, n) => {
    // "TS-91247" → keep the TS-9 prefix, vary the last 4 digits per clone
    const seed = (parseInt(src.id.replace(/\D/g, ""), 10) || 91000) + n * 7 + 12;
    const id = `TS-${(seed % 99999).toString().padStart(5, "0")}`;
    // Professional engagement rows carry their own field set — vary it
    // so clones don't read as duplicate Assignment / Project / SOW rows.
    if (src.engagementType && src.engagementType !== "Shift") {
      return _tsCloneProRow(src, n, id);
    }
    // Shift rows: vary the work-assignment number only (today's behavior).
    const aNum = (parseInt(String(src.booking).replace(/\D/g, ""), 10) || 700) + n * 3 + 17;
    return { id, booking: `Work assignment #${aNum % 9999}` };
  },
});

// When the active tenant is a staffing agency, scope timesheets to just
// the ones owned by this agency (matched by supplier id).
(() => {
  const sup = window.getAgencySupplierId && window.getAgencySupplierId();
  if (sup) {
    for (let i = TIMESHEETS.length - 1; i >= 0; i--) {
      if (TIMESHEETS[i].supplier !== sup) TIMESHEETS.splice(i, 1);
    }
  }
})();

// Append the supplier-type variants (IC + EOR) after inflation so the
// clone loop above doesn't accidentally fan them out into 200 fakes.
// Both arrays are inert by themselves — the TimesheetsPage filters at
// render time on `engagementSource` so a flag flip removes them in
// place. They sit after the staffing-agency scrub so enterprise tenants
// (where window.getAgencySupplierId returns null) see the full mixed
// list and staffing-agency tenants never see them.
if (!(window.getAgencySupplierId && window.getAgencySupplierId())) {
  TIMESHEETS.push(...TIMESHEETS_IC, ...TIMESHEETS_EOR);
}

const TS_PAGE_SIZE = 10;

// ---------- Status pill --------------------------------------------------
const TS_STATUS_HUES = {
  "Open":              "informative",
  "Closed":            "default",
  "Review":            "error",
  "Pending Approval":  "warning",
};

function TimesheetStatusPill({ status }) {
  const hue = TS_STATUS_HUES[status] || "default";
  return (
    <span className={`req-pill req-pill--${hue}`}>
      {status === "Review" && (
        <span className="req-pill-icon" aria-hidden="true">
          <Icon name="Alert" size={12} />
        </span>
      )}
      {status}
    </span>
  );
}

// ---------- Toolbar -----------------------------------------------------
function TimesheetsToolbar({ query, onQuery }) {
  return (
    <div className="inv-toolbar">
      <div className="inv-search">
        <span className="inv-search-icon" aria-hidden="true">
          <Icon name="Search" size={24} />
        </span>
        <input
          type="search"
          className="inv-search-input"
          placeholder="Search for timesheet, worker, supplier"
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          aria-label="Search timesheets"
        />
      </div>
      <div className="inv-toolbar-actions">
        <ListToolbarActions kind="timesheets" columns={["Timesheet", "Status", "Worker", "Supplier", "Date", "Start", "End", "Duration"]} showMore={false} />
      </div>
    </div>
  );
}

// ---------- Header cell -------------------------------------------------
function TsHeaderCell({ children, className = "" }) {
  return (
    <div className={`req-cell ${className}`} role="columnheader">
      <span>{children}</span>
      <span className="req-sort" aria-hidden="true" title="Sort">
        <Icon name="ArrowsUpDownSmall" size={14} />
      </span>
    </div>
  );
}

// Returns true for a row whose engagementType is non-Shift AND the
// active org has Professional jobs configured. Pro rows render the
// same cells/columns but with engagement-period fields instead of
// clock-in/out fields. See TIMESHEETS_PROFESSIONAL above for the
// row shape and pages/jobs-config.jsx for the org-level gate.
function _tsIsProEngagement(row) {
  if (!row || !row.engagementType || row.engagementType === "Shift") return false;
  return !!(window.professionalJobsEnabled && window.professionalJobsEnabled());
}

// ---------- Row ---------------------------------------------------------
function TimesheetRow({ row, checked, onToggle, onOpen, vc }) {
  const show = (id) => !vc || vc.showCol(id);
  const sup = REQ_SUPPLIERS[row.supplier] || REQ_SUPPLIERS.sw;
  const worker = WORKERS.find((w) => w.id === row.worker) || WORKERS[0];
  const pro = _tsIsProEngagement(row);
  const rowMenu = (e) => {
    e.stopPropagation();
    openMenu(e.currentTarget, [
      { icon: "View",      label: "View timesheet", onClick: () => onOpen && onOpen(row.id) },
      (row.status === "Pending Approval" || row.status === "Review") && {
        icon: "Check", label: "Approve",
        onClick: () => openConfirm({
          title: `Approve ${row.id}?`,
          body: pro
            ? (row.milestone
                ? `${worker.name} submitted ${row.milestone} for ${row.engagementRef}. Once approved, the milestone fee will be invoiced.`
                : `${worker.name} logged ${row.billableHours} billable hours against ${row.engagementRef} for ${row.periodLabel}. Once approved, the period will be billed.`)
            : `${worker.name} worked ${row.duration} on ${row.date}. Once approved, the hours will be billed.`,
          primaryLabel: "Approve",
          onConfirm: () => showToast(`${row.id} approved`, { kind: "success" }),
        }),
      },
      (row.status === "Pending Approval" || row.status === "Review") && {
        icon: "TimeUndo", label: "Request changes",
        onClick: () => showToast(`Change request sent to ${sup.label}`),
      },
      { icon: "Export",    label: "Export",         onClick: () => showToast(`Exporting ${row.id}.csv`) },
      { divider: true },
      { icon: "Cancel",    label: "Mark disputed",  danger: true,
        onClick: () => showToast(`${row.id} marked disputed`) },
    ].filter(Boolean));
  };
  return (
    <div
      className="req-row ts-row req-row--clickable"
      role="row"
      tabIndex={0}
      style={vc && vc.gridStyle}
      onClick={(e) => {
        if (e.target.closest("input,a,button")) return;
        onOpen && onOpen(row.id);
      }}
      onKeyDown={(e) => { if (e.key === "Enter") onOpen && onOpen(row.id); }}
    >
      <div className="req-cell req-cell--check" role="cell">
        <input
          type="checkbox"
          checked={checked}
          onChange={onToggle}
          aria-label={`Select ${row.id}`}
        />
      </div>
      {show("id") && (
        <div className="req-cell ts-cell--id" role="cell">
          <span className="ts-id-primary">{row.id}</span>
          <span className="ts-id-sub">
            {pro
              ? `${row.engagementType} · ${row.engagementRef}`
              : row.booking}
          </span>
        </div>
      )}
      {show("status") && (
        <div className="req-cell" role="cell">
          <TimesheetStatusPill status={row.status} />
        </div>
      )}
      {show("worker") && (
        <div className="req-cell ts-cell--worker" role="cell">
          <WorkerAvatar w={worker} size={32} neutral />
          <span className="ts-worker-name">{worker.name}</span>
        </div>
      )}
      {show("supplier") && (
        <div className="req-cell ts-cell--supplier" role="cell">
          {row.engagementSource === "ic" ? (
            <React.Fragment>
              {/* IC timesheet — no supplier intermediary. Mirror the
                  Workforce "Direct · Country" treatment so the cell is
                  visually parallel to the Agency / EOR variants
                  without inventing a new layout. */}
              {worker.flag && (
                <span
                  className={`fi fi-${worker.flag}`}
                  aria-hidden="true"
                  style={{ display: "inline-block", width: 22, height: 16, borderRadius: 2 }}
                ></span>
              )}
              <span className="ts-supplier-name">
                Direct{worker.countryName ? ` · ${worker.countryName}` : ""}
              </span>
            </React.Fragment>
          ) : (
            <React.Fragment>
              <ReqSupplierChip id={row.supplier} size={28} />
              <span className="ts-supplier-name">{sup.label}</span>
            </React.Fragment>
          )}
        </div>
      )}
      {show("date") && (
        <div className="req-cell ts-cell--date" role="cell">
          <span className="ts-time-primary">{row.date}</span>
        </div>
      )}
      {show("period") && (
        <div className="req-cell ts-cell--period" role="cell">
          <span className="ts-time-primary">{pro ? row.periodLabel : "—"}</span>
          {pro && row.milestone && (
            <span className="ts-time-sub">{row.milestone}</span>
          )}
        </div>
      )}
      {show("engagementName") && (
        <div className="req-cell ts-cell--engagement" role="cell">
          <span className="ts-eng-name">{pro ? row.engagementName : "—"}</span>
          {pro && row.engagementRef && (
            <span className="ts-eng-ref">{row.engagementRef}</span>
          )}
        </div>
      )}
      {show("start") && (
        <div className="req-cell ts-cell--time" role="cell">
          <span className="ts-time-primary">{pro ? row.periodStart : row.actualStart}</span>
          <span className="ts-time-sub">
            {pro ? row.cadence : `Sched. ${row.schedStart}`}
          </span>
        </div>
      )}
      {show("end") && (
        <div className="req-cell ts-cell--time" role="cell">
          <span className="ts-time-primary">{pro ? row.periodEnd : row.actualEnd}</span>
          <span className="ts-time-sub">
            {pro
              ? (row.milestone ? `Acceptance ${row.acceptanceDate || "—"}` : `Period end`)
              : `Sched. ${row.schedEnd}`}
          </span>
        </div>
      )}
      {show("duration") && (
        <div className="req-cell ts-cell--dur" role="cell">
          <span className="ts-time-primary">{pro ? row.billableHours : row.duration}</span>
          <span className="ts-time-sub">
            {pro
              ? (row.billableHours === "—" ? "milestone" : "billable")
              : `Sched. ${row.schedDuration}`}
          </span>
        </div>
      )}
      {show("engagementType") && (
        <div className="req-cell req-cell--engtype" role="cell">
          {window.EngagementType
            ? <window.EngagementType.EngagementTypeCell row={row} id={row.id} />
            : null}
        </div>
      )}
      {show("billingBasis") && (
        <div className="req-cell req-cell--v77em" role="cell">
          {window.V77Cols ? <span className="v77-bm">{window.V77Cols.billingBasisOf(row, row.id)}</span> : null}
        </div>
      )}
      {show("timeCapture") && (
        <div className="req-cell req-cell--v77tc" role="cell">
          {window.V77Cols ? <span className="v77-tc">{window.V77Cols.timeCaptureOf(row, row.id)}</span> : null}
        </div>
      )}
      {show("supplierTypes") && (
        <div className="req-cell req-cell--v77st" role="cell">
          {window.V77Cols ? window.V77Cols.supplierTypesOf(row, row.id).map((t) => (
            <span className="v77-st" key={t}>{t}</span>
          )) : null}
        </div>
      )}
      <div className="req-cell ts-cell--chev" role="cell">
        <button
          type="button"
          className="icon-btn"
          aria-label={`Actions for ${row.id}`}
          onClick={rowMenu}
        >
          <Icon name="MoreVert" size={18} />
        </button>
      </div>
    </div>
  );
}

// ---------- Table -------------------------------------------------------
function TimesheetsTable({ rows, total, page, totalPages, onPageChange, pageSize, onPageSizeChange, onOpenRow, f }) {
  const [selected, setSelected] = useStateTs(() => new Set());
  const allChecked = rows.length > 0 && rows.every((r) => selected.has(r.id));
  // Filter chip options — local so the JSX resolves regardless of
  // module-load order. Each helper returns [] when its module is off.
  const v77On = window.V77Cols && window.V77Cols.isOn();
  const bbOpts = v77On ? window.V77Cols.billingBasisOpts() : [];
  const tcOpts = v77On ? window.V77Cols.timeCaptureOpts()  : [];
  const stOpts = v77On ? window.V77Cols.supplierTypeOpts() : [];
  const etOn   = window.EngagementType && window.EngagementType.isOn();
  const etOpts = etOn ? window.EngagementType.enabledTypes() : [];

  const toggle = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const toggleAll = () => {
    setSelected((prev) => {
      if (allChecked) {
        const next = new Set(prev);
        rows.forEach((r) => next.delete(r.id));
        return next;
      }
      const next = new Set(prev);
      rows.forEach((r) => next.add(r.id));
      return next;
    });
  };

  // -- Bulk actions unique to Timesheets -------------------------------
  // Approver flow: scan a stack of submitted timesheets, approve the
  // clean ones, push edge cases back to the supplier, flag anything
  // that doesn't smell right. Approve is primary because it's the most
  // common bulk action by an order of magnitude.
  const bulkActTs = (msg, kind = "success") => {
    if (window.showToast) window.showToast(msg, { kind });
    setSelected(new Set());
  };
  const nTs = selected.size;
  const sumTs = `${nTs} ${nTs === 1 ? "timesheet" : "timesheets"}`;
  // Pull total hours for the context hint — duration is "H:MM".
  const totalHours = useMemoTs(() => {
    if (!nTs) return 0;
    return rows
      .filter((r) => selected.has(r.id))
      .reduce((s, r) => {
        const m = /^(\d+):(\d+)$/.exec(String(r.duration || "0:00"));
        return s + (m ? parseInt(m[1], 10) + parseInt(m[2], 10) / 60 : 0);
      }, 0);
  }, [selected, rows]);
  const tsHint = nTs ? `${totalHours.toFixed(1)} hrs total` : null;
  const bulkActionsTs = [
    { icon: "Check",        label: "Approve",        onClick: () => bulkActTs(`Approved ${sumTs} (${totalHours.toFixed(1)} hrs)`), kind: "primary" },
    { icon: "TimeUndo",     label: "Send back",      onClick: () => bulkActTs(`Sent ${sumTs} back to supplier for review`, "info") },
    { icon: "Adjustment",   label: "Adjust hours",   onClick: () => bulkActTs(`Adjustment panel opened for ${sumTs}`, "info") },
    { icon: "Alert",        label: "Flag",           onClick: () => bulkActTs(`Flagged ${sumTs} for audit`, "warning") },
    { icon: "FileDownload", label: "Export",         onClick: () => bulkActTs(`Exported ${sumTs} to CSV`) },
    { divider: true },
    { icon: "X",            label: "Reject",         onClick: () => bulkActTs(`Rejected ${sumTs}`, "warning"), kind: "danger" },
  ];
  const bulkOverflowTs = [
    { icon: "Pay",      label: "Lock for payroll",   onClick: () => bulkActTs(`Locked ${sumTs} for payroll`) },
    { icon: "Print",    label: "Print batch",        onClick: () => bulkActTs(`Printing batch for ${sumTs}`) },
    { icon: "Notes",    label: "Attach approval note", onClick: () => bulkActTs(`Approval note attached to ${sumTs}`) },
  ];

  // ---- View customizer ------------------------------------------------
  const tsVcManifest = React.useMemo(() => {
    const columns = [
      { id: "id",       label: "Timesheet", width: "minmax(140px, 1fr)" },
      { id: "status",   label: "Status",    width: "140px" },
      { id: "worker",   label: "Worker",    width: "minmax(180px, 1.4fr)" },
      { id: "supplier", label: "Supplier",  width: "minmax(160px, 1.2fr)" },
      { id: "date",     label: "Date",      width: "120px" },
      { id: "period",   label: "Period",    width: "150px" },
      { id: "engagementName", label: "Engagement", width: "minmax(160px, 1.2fr)" },
      { id: "start",    label: "Start",     width: "140px" },
      { id: "end",      label: "End",       width: "140px" },
      { id: "duration", label: "Duration",  width: "80px" },
    ];
    if (etOn && etOpts.length > 1) columns.push({ id: "engagementType", label: "Engagement type", width: "140px" });
    if (v77On) {
      columns.push({ id: "billingBasis",  label: "Billing basis",  width: "140px" });
      columns.push({ id: "timeCapture",   label: "Time capture",   width: "140px" });
      columns.push({ id: "supplierTypes", label: "Supplier types", width: "180px" });
    }
    const filters = [
      { id: "supplier", label: "Supplier" },
      { id: "worker",   label: "Worker" },
      { id: "date",     label: "Date" },
      { id: "duration", label: "Duration" },
    ];
    if (bbOpts.length > 1)        filters.push({ id: "billingBasis",   label: "Billing basis" });
    if (tcOpts.length > 1)        filters.push({ id: "timeCapture",    label: "Time capture" });
    if (etOn && etOpts.length > 1) filters.push({ id: "engagementType", label: "Engagement type" });
    if (stOpts.length > 1)        filters.push({ id: "supplierTypes",  label: "Supplier types" });
    return { columns, filters };
  }, [v77On, etOn, etOpts.length, bbOpts.length, tcOpts.length, stOpts.length]);
  const vc = useViewCustomizer("timesheets", tsVcManifest);
  const tsGridStyle = vc.gridStyle
    ? { gridTemplateColumns: `44px ${vc.gridStyle.gridTemplateColumns} 44px` }
    : undefined;
  const vcRow = { ...vc, gridStyle: tsGridStyle };

  return (
    <React.Fragment>
    <div className="req-table-card ts-table-card" role="table" aria-label="Timesheets">
      <div className="req-filters">
        <div className="req-filters-left">
          {vc.showFilter("supplier") && <FilterChip label="Supplier" active={f.filters.supplier.length > 0} count={f.filters.supplier.length} onClick={f.openFor("supplier", "Supplier", Object.values(REQ_SUPPLIERS).map((s) => s.label).sort())} />}
          {vc.showFilter("worker")   && <FilterChip label="Worker"   active={f.filters.worker.length > 0}   count={f.filters.worker.length}   onClick={f.openFor("worker",   "Worker",   WORKERS.map((w) => w.name).sort())} />}
          {vc.showFilter("date")     && <FilterChip label="Date"     active={f.filters.date.length > 0}     count={f.filters.date.length}     onClick={f.openFor("date",     "Date",     ["Today", "Yesterday", "This week", "Last week", "This month"])} />}
          {vc.showFilter("duration") && <FilterChip label="Duration" active={f.filters.duration.length > 0} count={f.filters.duration.length} onClick={f.openFor("duration", "Duration", ["Under 4h", "4–8h", "8–10h", "10h+"])} />}
          {vc.showFilter("billingBasis") && bbOpts.length > 1 && (
            <FilterChip
              label="Billing basis"
              active={f.filters.billingBasis.length > 0}
              count={f.filters.billingBasis.length}
              onClick={f.openFor("billingBasis", "Billing basis", bbOpts)}
            />
          )}
          {vc.showFilter("timeCapture") && tcOpts.length > 1 && (
            <FilterChip
              label="Time capture"
              active={f.filters.timeCapture.length > 0}
              count={f.filters.timeCapture.length}
              onClick={f.openFor("timeCapture", "Time capture", tcOpts)}
            />
          )}
          {vc.showFilter("engagementType") && etOn && etOpts.length > 1 && (
            <FilterChip
              label="Engagement type"
              active={f.filters.engagementType.length > 0}
              count={f.filters.engagementType.length}
              onClick={f.openFor("engagementType", "Engagement type", etOpts)}
            />
          )}
          {vc.showFilter("supplierTypes") && stOpts.length > 1 && (
            <FilterChip
              label="Supplier types"
              active={f.filters.supplierTypes.length > 0}
              count={f.filters.supplierTypes.length}
              onClick={f.openFor("supplierTypes", "Supplier types", stOpts)}
            />
          )}
        </div>
        <div className="req-filters-right">
          {f.hasAny && (
            <React.Fragment>
              <span className="req-filters-sep" aria-hidden="true">|</span>
              <button type="button" className="req-clear" onClick={f.clearAll}>Clear all filters</button>
            </React.Fragment>
          )}
        </div>
      </div>

      <div className="req-scroll">
        <div className="req-row ts-row req-row--header" role="row" style={tsGridStyle}>
          <div className="req-cell req-cell--check" role="columnheader">
            <input
              type="checkbox"
              checked={allChecked}
              onChange={toggleAll}
              aria-label="Select all rows on this page"
            />
          </div>
          {vc.showCol("id")       && <TsHeaderCell className="ts-cell--id">Timesheet</TsHeaderCell>}
          {vc.showCol("status")   && <TsHeaderCell>Status</TsHeaderCell>}
          {vc.showCol("worker")   && <TsHeaderCell className="ts-cell--worker">Worker</TsHeaderCell>}
          {vc.showCol("supplier") && <TsHeaderCell className="ts-cell--supplier">Supplier</TsHeaderCell>}
          {vc.showCol("date")     && <TsHeaderCell className="ts-cell--date">Date</TsHeaderCell>}
          {vc.showCol("period")   && <TsHeaderCell className="ts-cell--period">Period</TsHeaderCell>}
          {vc.showCol("engagementName") && <TsHeaderCell className="ts-cell--engagement">Engagement</TsHeaderCell>}
          {vc.showCol("start")    && <TsHeaderCell className="ts-cell--time">Start</TsHeaderCell>}
          {vc.showCol("end")      && <TsHeaderCell className="ts-cell--time">End</TsHeaderCell>}
          {vc.showCol("duration") && <TsHeaderCell className="ts-cell--dur">Duration</TsHeaderCell>}
          {vc.showCol("engagementType") && <div className="req-cell req-cell--engtype" role="columnheader">Engagement type</div>}
          {vc.showCol("billingBasis")   && <div className="req-cell req-cell--v77em" role="columnheader">Billing basis</div>}
          {vc.showCol("timeCapture")    && <div className="req-cell req-cell--v77tc" role="columnheader">Time capture</div>}
          {vc.showCol("supplierTypes")  && <div className="req-cell req-cell--v77st" role="columnheader">Supplier types</div>}
          <div className="req-cell ts-cell--chev" role="columnheader" aria-label=""></div>
        </div>

        <div className="req-body" role="rowgroup">
          {rows.map((row) => (
            <TimesheetRow
              key={row.id}
              row={row}
              checked={selected.has(row.id)}
              onToggle={() => toggle(row.id)}
              onOpen={onOpenRow}
              vc={vcRow}
            />
          ))}
        </div>
      </div>

      <Pagination
        page={page}
        totalPages={totalPages}
        total={total}
        pageSize={pageSize}
        onPageSizeChange={onPageSizeChange}
        onChange={onPageChange}
      />
    </div>

    <BulkActionBar
      count={selected.size}
      noun="timesheet"
      contextHint={tsHint}
      onClear={() => setSelected(new Set())}
      actions={bulkActionsTs}
      overflow={bulkOverflowTs}
    />
    {vc.panel}
    </React.Fragment>
  );
}

// ---------- List page ---------------------------------------------------
// Parse "MM.DD.YYYY" → Date. Parse "H:MM" → minutes.
function _tsParseDate(s) {
  const m = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(String(s || "").trim());
  if (!m) return null;
  return new Date(parseInt(m[3],10), parseInt(m[1],10) - 1, parseInt(m[2],10));
}
function _tsDurationMins(s) {
  if (!s || s === "—") return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(s).trim());
  if (!m) return null;
  return parseInt(m[1],10) * 60 + parseInt(m[2],10);
}
function _tsDateInBucket(d, bucket, now = new Date()) {
  if (!d) return false;
  const dayMs = 86400000;
  const sameDay = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  if (bucket === "Today")     return sameDay(d, now);
  if (bucket === "Yesterday") return sameDay(d, new Date(now.getTime() - dayMs));
  if (bucket === "This week" || bucket === "Last week") {
    // Week starts Monday. Compute Monday 00:00 of `now`'s week.
    const day = (now.getDay() + 6) % 7;
    const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - day);
    const start = bucket === "This week" ? monday : new Date(monday.getTime() - 7 * dayMs);
    const end   = new Date(start.getTime() + 7 * dayMs);
    return d >= start && d < end;
  }
  if (bucket === "This month") return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  return false;
}
function _tsDurationInBucket(mins, bucket) {
  if (mins == null) return false;
  if (bucket === "Under 4h") return mins < 4 * 60;
  if (bucket === "4–8h")    return mins >= 4 * 60 && mins < 8 * 60;
  if (bucket === "8–10h")   return mins >= 8 * 60 && mins < 10 * 60;
  if (bucket === "10h+")     return mins >= 10 * 60;
  return false;
}
const TS_FILTER_MATCHERS = {
  supplier: (row, vals) => vals.includes(REQ_SUPPLIERS[row.supplier]?.label),
  worker:   (row, vals) => {
    const w = WORKERS.find((x) => x.id === row.worker);
    return !!w && vals.includes(w.name);
  },
  date:     (row, vals) => {
    const d = _tsParseDate(row.date);
    return vals.some((b) => _tsDateInBucket(d, b));
  },
  duration: (row, vals) => {
    const mins = _tsDurationMins(row.duration);
    return vals.some((b) => _tsDurationInBucket(mins, b));
  },
  billingBasis: (row, vals) =>
    !window.V77Cols || window.V77Cols.matchBillingBasis(row, vals),
  timeCapture: (row, vals) =>
    !window.V77Cols || window.V77Cols.matchTimeCapture(row, vals),
  supplierTypes: (row, vals) =>
    !window.V77Cols || window.V77Cols.matchSupplierTypes(row, vals),
  engagementType: (row, vals) =>
    !window.EngagementType || window.EngagementType.matchType(row, vals),
};

function TimesheetsPage({ reloadKey, onReload, onOpenRow }) {
  const [page, setPage] = useStateTs(1);
  const [pageSize, setPageSize] = useStateTs(TS_PAGE_SIZE);
  const [query, setQuery] = useStateTs("");
  const f = useFilters({ supplier: [], worker: [], date: [], duration: [], billingBasis: [], timeCapture: [], supplierTypes: [], engagementType: [] });
  if (window.V77Cols && window.V77Cols.useBodyClass) window.V77Cols.useBodyClass();
  if (window.EngagementType && window.EngagementType.useBodyClass) window.EngagementType.useBodyClass();
  // Status tab — defaults to "Open" per the Everest tab-strip spec.
  // The "All" tab is dropped; users land on Open work in progress.
  const [statusTab, setStatusTab] = useStateTs("Open");

  // Supplier-type gates — IC and EOR rows are merged into TIMESHEETS at
  // module load (see TIMESHEETS_IC / TIMESHEETS_EOR above). When the
  // org has the corresponding supplier type off (Settings →
  // Configuration → Supplier types), filter them back out so the list
  // shows Agency-only timesheets, matching the rest of the product.
  const tsIcOn  = window.useFeatureFlag
    ? (window.useFeatureFlag("contractors") || window.useFeatureFlag("independentContractor"))
    : false;
  const tsEorOn = window.useFeatureFlag ? window.useFeatureFlag("eor") : false;

  // Reset to page 1 when search or filter chips change.
  React.useEffect(() => { setPage(1); }, [query, f.filters, statusTab]);

  // Two-stage filter: search + chip filters first (status-agnostic), then
  // the status tab on top. Per-tab counts read off the intermediate set so
  // the badge tells you what each tab would show against your current
  // search and chip refinements.
  const beforeStatus = useMemoTs(() => {
    let list = TIMESHEETS;
    if (!tsIcOn)  list = list.filter((r) => r.engagementSource !== "ic");
    if (!tsEorOn) list = list.filter((r) => r.engagementSource !== "eor");
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      list = list.filter((r) => {
        const worker = WORKERS.find((w) => w.id === r.worker);
        return (
          r.id.toLowerCase().includes(q) ||
          r.booking.toLowerCase().includes(q) ||
          (worker && worker.name.toLowerCase().includes(q)) ||
          (REQ_SUPPLIERS[r.supplier]?.label || "").toLowerCase().includes(q)
        );
      });
    }
    return applyFilters(list, f.filters, TS_FILTER_MATCHERS);
  }, [query, f.filters, tsIcOn, tsEorOn]);
  const filtered = useMemoTs(
    () => beforeStatus.filter((r) => r.status === statusTab),
    [beforeStatus, statusTab]
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const rows = useMemoTs(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [page, pageSize, filtered]);

  const handlePageSizeChange = (n) => { setPageSize(n); setPage(1); };
  const handleQuery = (v) => { setQuery(v); setPage(1); };

  return (
    <React.Fragment>
      <Omnibar
        icon="PersonClock"
        title="Timesheets"
        dayforce={{
          primitive: "TimePair + BillingLine",
          subtitle: "+ PayCode",
          product: "Time & Attendance",
          strategy: "Extend + New",
          note: "Clock pairs persist as Dayforce TimePairs against the worker's Work Assignment, honoring org-unit rounding and Pay Codes. Bill-side dollars (rate, markup, bill amount) live in a Flex Work–owned BillingLine sibling.",
          anchor: "time",
        }}
      >
        <button
          type="button"
          className="iconbtn"
          onClick={onReload}
          aria-label="Reload content"
          title="Reload"
        >
          <Icon name="Refresh" size={18} />
        </button>
        <button
          type="button"
          className="iconbtn"
          aria-label="More actions"
          onClick={(e) => openMenu(e.currentTarget, toolbarMenuItems())}
        >
          <Icon name="MoreVert" size={20} />
        </button>
      </Omnibar>

      <div className="content-section ts-content" key={reloadKey}>
        {/* Status tabs — rendered ABOVE the table card as the primary
            view filter (not table chrome). Uses the Everest design-
            system Tabs group spec (48h, 4px bottom indicator,
            bold-active 16px) and drops the per-tab count pills, "All"
            included. The chip filters inside the card continue to
            refine within the selected tab. */}
        <TS_STATUS_TABS_STRIP active={statusTab} onChange={setStatusTab} />
        <TimesheetsToolbar query={query} onQuery={handleQuery} />
        <TimesheetsTable
          rows={rows}
          total={filtered.length}
          page={page}
          totalPages={totalPages}
          pageSize={pageSize}
          onPageSizeChange={handlePageSizeChange}
          onPageChange={setPage}
          onOpenRow={onOpenRow}
          f={f}
        />
      </div>
    </React.Fragment>
  );
}

// =====================================================================
// Timesheet Details
// =====================================================================

// ---------- Time parsing / formatting helpers ----------
// "6:00 AM" / "12:30 PM" / "—" → minutes since midnight (null on "—")
function _tsParseClock(s) {
  if (!s || s === "—") return null;
  const m = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec(String(s).trim());
  if (!m) return null;
  let h = parseInt(m[1], 10) % 12;
  if (/pm/i.test(m[3])) h += 12;
  return h * 60 + parseInt(m[2], 10);
}
// 390 → "6:30 AM"
function _tsFmtClock(mins) {
  if (mins == null) return "—";
  const total = ((mins % 1440) + 1440) % 1440;
  let h = Math.floor(total / 60);
  const m = total % 60;
  const ap = h >= 12 ? "PM" : "AM";
  h = h % 12; if (h === 0) h = 12;
  return `${h}:${String(m).padStart(2, "0")} ${ap}`;
}
// Build 4 evenly-spaced labels across the scheduled window.
function _tsHourMarkers(schedStart, schedEnd) {
  const s = _tsParseClock(schedStart);
  let e = _tsParseClock(schedEnd);
  if (s == null || e == null) return ["6 AM", "9 AM", "12 PM", "3 PM"];
  if (e <= s) e += 24 * 60; // overnight
  const round = (mins) => {
    // Snap to the nearest hour for legibility.
    const snapped = Math.round(mins / 60) * 60;
    return _tsFmtClock(snapped).replace(/:00\s/, " ");
  };
  return [
    round(s),
    round(s + (e - s) / 3),
    round(s + 2 * (e - s) / 3),
    round(e),
  ];
}
// Parse a "1:30" / "0:15" / "15" / "30 min" duration into minutes.
function _tsParseBreakMins(label) {
  if (!label) return 15;
  const s = String(label).trim();
  const c = /^(\d+):(\d+)$/.exec(s);
  if (c) return parseInt(c[1], 10) * 60 + parseInt(c[2], 10);
  const m = /(\d+)\s*min/i.exec(s);
  if (m) return parseInt(m[1], 10);
  const n = parseInt(s, 10);
  return Number.isFinite(n) ? n : 15;
}

// One activity-feed item — icon (in tinted circle) + bold title + scheduled
// hint + actual reading on a connector row.
function TimelineFeedItem({ icon, iconTone = "teal", title, schedLabel, schedValue, actualLabel, actualValue, isLast }) {
  return (
    <div className="ts-feed-item">
      <span className={`ts-feed-icon ts-feed-icon--${iconTone}`} aria-hidden="true">
        <Icon name={icon} size={18} />
      </span>
      <div className="ts-feed-text">
        <span className="ts-feed-title">{title}</span>
        {schedLabel && (
          <span className="ts-feed-sched">
            {schedLabel} {schedValue}
          </span>
        )}
      </div>
      {actualLabel && (
        <React.Fragment>
          <span className={`ts-feed-rail ${isLast ? "ts-feed-rail--16" : "ts-feed-rail--32"}`} aria-hidden="true" />
          <div className="ts-feed-subrow">
            <span className="ts-feed-subrow-icon" aria-hidden="true">
              <Icon name="Hourglass" size={14} />
            </span>
            <span className="ts-feed-actual">
              {actualLabel} <b>{actualValue}</b>
            </span>
          </div>
        </React.Fragment>
      )}
    </div>
  );
}

function TimesheetDetailsPage({ timesheetId, onBack }) {
  const ts = TIMESHEETS.find((t) => t.id === timesheetId) || TIMESHEETS[0];
  const worker = WORKERS.find((w) => w.id === ts.worker) || WORKERS[0];
  const sup = REQ_SUPPLIERS[ts.supplier] || REQ_SUPPLIERS.sw;
  const statusHue = TS_STATUS_HUES[ts.status] || "default";
  const pro = _tsIsProEngagement(ts);
  const milestoneRow = pro && !!ts.milestone;

  // Derive the timeline from this row's actual schedule so morning,
  // evening and overnight shifts all render with the right hour gauge.
  const hourMarkers = _tsHourMarkers(ts.schedStart, ts.schedEnd);
  const schedStartMin = _tsParseClock(ts.schedStart);
  const schedEndMin   = _tsParseClock(ts.schedEnd);
  // Scheduled break = 15 minutes by demo convention; placed at ~3 h into
  // the shift, or the midpoint for shorter ones.
  const schedBreakMins = 15;
  const actualBreakMins = 12;
  // The break time only makes sense once the worker has clocked in.
  const baseStart = _tsParseClock(ts.actualStart) ?? schedStartMin;
  let breakStartMin = null;
  let breakEndMin = null;
  if (baseStart != null && schedStartMin != null && schedEndMin != null) {
    let span = schedEndMin - schedStartMin;
    if (span <= 0) span += 24 * 60;
    const offset = Math.min(180, Math.floor(span / 2));
    breakStartMin = baseStart + offset;
    breakEndMin = breakStartMin + actualBreakMins;
  }
  const actualBreakStart = breakStartMin != null ? _tsFmtClock(breakStartMin) : "—";
  const actualBreakEnd   = breakEndMin   != null ? _tsFmtClock(breakEndMin)   : "—";
  // Footer label — prefer the actual end when there is one, else the
  // scheduled end. Avoids "5:00 PM – End" on a timesheet that's still open.
  const endStamp = ts.actualEnd && ts.actualEnd !== "—" ? ts.actualEnd : ts.schedEnd;

  // Approve + Request changes are merged into one split-action menu in
  // the omnibar. Approve is the high-frequency action, so it leads the
  // menu; Request changes is the edge case. Items factored out so the
  // identical menu can fire from both hover and click without
  // re-allocating closures inline.
  const actionMenuItems = [
    { icon: "Check",    label: "Approve timesheet",
      onClick: () => openConfirm({
        title: `Approve timesheet ${ts.id}?`,
        body: pro
          ? (milestoneRow
              ? `${worker.name} submitted ${ts.milestone || "this milestone"} for ${ts.engagementRef}. Once approved, the milestone fee will be invoiced.`
              : `${worker.name} logged ${ts.billableHours} billable hours against ${ts.engagementRef} for ${ts.periodLabel}. Once approved, the period will be billed at the agreed rate.`)
          : `${worker.name} worked ${ts.duration} on ${ts.date}. Once approved, the hours will be billed at the agreed rate.`,
        primaryLabel: "Approve",
        onConfirm: () => { showToast(`${ts.id} approved`, { kind: "success" }); onBack && onBack(); },
      }) },
    { icon: "TimeUndo", label: "Request changes",
      onClick: () => openConfirm({
        title: `Request changes on ${ts.id}?`,
        body: `${worker.name}'s entry will be sent back to ${sup.label} for revision. They'll be notified to update the times.`,
        primaryLabel: "Request changes",
        onConfirm: () => showToast(`Change request sent to ${sup.label}`, { kind: "success" }),
      }) },
  ];

  return (
    <React.Fragment>
      <ReqOmnibar
        title={ts.id}
        subtitle={pro ? `Timesheets · ${worker.name} · ${ts.periodLabel}` : `Timesheets · ${worker.name} · ${ts.date}`}
        status={<TimesheetStatusPill status={ts.status} />}
        onBack={onBack}
        actions={(
          <React.Fragment>
            <button
              type="button"
              className="iconbtn"
              aria-label="Export"
              title="Export"
              onClick={() => showToast(`Exporting ${ts.id}.csv`, { kind: "success" })}
            >
              <Icon name="Export" size={20} />
            </button>
            <button
              type="button"
              className="btn btn--md btn--primary ts-action-split"
              aria-haspopup="menu"
              aria-label="Timesheet actions"
              onMouseEnter={(e) => openMenu(e.currentTarget, actionMenuItems)}
              onClick={(e) => openMenu(e.currentTarget, actionMenuItems)}
            >
              Action
              <Icon name="ChevronDown" size={14} />
            </button>
            <button
              type="button"
              className="iconbtn"
              aria-label="More"
              onClick={(e) => openMenu(e.currentTarget, [
                { icon: "Copy",     label: "Copy timesheet ID", onClick: () => copyToClipboard(ts.id, "Timesheet ID copied") },
                { icon: "Print",    label: "Print",             onClick: () => showToast("Sent to printer") },
                { divider: true },
                { icon: "Cancel",   label: "Mark disputed",     danger: true,
                  onClick: () => showToast(`${ts.id} marked disputed`, { kind: "error" }) },
              ])}
            >
              <Icon name="MoreVert" size={20} />
            </button>
          </React.Fragment>
        )}
      />

      <div className="content-section">
        <div className="ts-detail-grid">
          {/* ---------- Left: Summary card ---------- */}
          <aside className="ts-summary" aria-label="Shift summary">
            <span className="ts-summary-status">
              <TimesheetStatusPill status={ts.status} />
            </span>

            <div className="ts-summary-worker">
              <div className="ts-summary-worker-avatar">
                <WorkerAvatar w={worker} size={48} />
                <span
                  className="ts-summary-worker-sup"
                  style={{ background: sup.bg, color: sup.fg }}
                  aria-label={sup.label}
                  title={sup.label}
                >
                  {sup.short}
                </span>
              </div>
              <div className="ts-summary-worker-text">
                <span className="ts-summary-worker-name">{worker.name}</span>
                <span className="ts-summary-worker-meta">
                  <span>Intermediate</span>
                  <span className="ts-dot" aria-hidden="true" />
                  <span>{sup.label}</span>
                </span>
              </div>
            </div>

            <div className="ts-summary-job">
              <span className="ts-summary-job-title">{ts.role}</span>
              <button
                type="button"
                className="ts-summary-job-booking"
                onClick={() => openConfirm({
                  title: `Open ${ts.booking}?`,
                  body: `You'll leave this timesheet and navigate to ${ts.booking}. Any unsaved edits to ${ts.id} will be discarded.`,
                  primaryLabel: "Open work assignment",
                  onConfirm: () => showToast(`Opening ${ts.booking}`),
                })}
              >
                {pro ? `${ts.engagementType} · ${ts.engagementRef}` : ts.booking}
              </button>
              {pro && ts.engagementName && (
                <span className="ts-summary-job-ref">{ts.engagementName}</span>
              )}
            </div>

            <div className="ts-summary-stats">
              <div className="ts-summary-stat">
                <span className="ts-summary-stat-label">
                  {pro ? "Period on record" : "Hours on record"}
                </span>
                <span className="ts-summary-stat-value">
                  {pro
                    ? `${ts.periodStart} – ${ts.periodEnd}`
                    : `${ts.actualStart} – ${ts.actualEnd}`}
                </span>
                <span className="ts-summary-stat-sub">
                  {pro
                    ? (milestoneRow
                        ? `Acceptance ${ts.acceptanceDate || "—"}`
                        : `${ts.cadence || "—"} cadence`)
                    : `Scheduled for ${ts.schedStart} – ${ts.schedEnd}`}
                </span>
              </div>
              <div className="ts-summary-stat">
                <span className="ts-summary-stat-label">
                  {pro ? (milestoneRow ? "Milestone" : "Billable hours") : "Break on record"}
                </span>
                <span className="ts-summary-stat-value">
                  {pro
                    ? (milestoneRow ? (ts.milestone || "—") : (ts.billableHours || "—"))
                    : "12 mins"}
                </span>
                <span className="ts-summary-stat-sub">
                  {pro
                    ? (milestoneRow
                        ? `${ts.billingBasis || "—"}`
                        : `${ts.nonBillableHours || "—"} non‑billable`)
                    : "Scheduled for 15 mins"}
                </span>
              </div>
            </div>
          </aside>

          {/* ---------- Right: Timeline card ---------- */}
          <section className="ts-timeline-card" aria-label="Shift timeline">
            <header className="ts-timeline-head">
              <div className="ts-timeline-head-title">
                <span className="ts-timeline-head-icon" aria-hidden="true">
                  <Icon name="Notes" size={20} />
                </span>
                <span className="ts-timeline-head-text">Timeline</span>
              </div>
              <div className="ts-timeline-head-row">
                <span className="ts-timeline-head-stamp">
                  {pro
                    ? `${ts.periodStart} – ${milestoneRow ? "Engagement opens" : "Period opens"}`
                    : `${ts.actualStart} – Start`}
                </span>
                <button
                  type="button"
                  className="ts-edit-time"
                  onClick={() => openEditEntity({
                    ...timeEditSchema(ts),
                    onSave: () => showToast(`${ts.id} times updated`, { kind: "success" }),
                  })}
                >
                  {pro ? "Edit period" : "Edit time"}
                  <Icon name="ChevronDown" size={14} />
                </button>
              </div>
            </header>

            <div className="ts-timeline-body">
              <div className="ts-timeline-hours" aria-hidden="true">
                {pro ? (
                  <React.Fragment>
                    <span className="ts-timeline-hour">{ts.periodStart}</span>
                    <span style={{ flex: 1 }} />
                    <span className="ts-timeline-hour">{ts.cadence || "—"}</span>
                    <span style={{ flex: 1 }} />
                    <span className="ts-timeline-hour">{ts.engagementRef}</span>
                    <span style={{ flex: 1 }} />
                    <span className="ts-timeline-hour">{ts.periodEnd}</span>
                  </React.Fragment>
                ) : (
                  <React.Fragment>
                    <span className="ts-timeline-hour">{hourMarkers[0]}</span>
                    <span style={{ flex: 1 }} />
                    <span className="ts-timeline-hour">{hourMarkers[1]}</span>
                    <span style={{ flex: 1 }} />
                    <span className="ts-timeline-hour">{hourMarkers[2]}</span>
                    <span style={{ flex: 1 }} />
                    <span className="ts-timeline-hour">{hourMarkers[3]}</span>
                  </React.Fragment>
                )}
              </div>

              <div className="ts-timeline-feed-wrap">
                <div className="ts-timeline-feed">
                  {pro ? (
                    milestoneRow ? (
                      <React.Fragment>
                        <TimelineFeedItem
                          icon="Briefcase"
                          iconTone="teal"
                          title="Engagement opened"
                          schedLabel="Period start:"
                          schedValue={ts.periodStart}
                          actualLabel="Reference:"
                          actualValue={ts.engagementRef}
                        />
                        <TimelineFeedItem
                          icon="Notes"
                          iconTone="teal"
                          title="Milestone delivered"
                          schedLabel="Deliverable:"
                          schedValue={ts.milestone || "—"}
                          actualLabel="Delivered:"
                          actualValue={ts.acceptanceDate || "—"}
                        />
                        <TimelineFeedItem
                          icon="Check"
                          iconTone="teal"
                          title="Submitted for acceptance"
                          schedLabel="Acceptance window:"
                          schedValue={`${ts.periodStart} – ${ts.periodEnd}`}
                          actualLabel="Submitted:"
                          actualValue={ts.acceptanceDate || "—"}
                        />
                        <TimelineFeedItem
                          icon="ClipboardPerson"
                          iconTone="teal"
                          title={ts.status === "Closed" ? "Milestone accepted" : "Awaiting acceptance"}
                          schedLabel="Billing basis:"
                          schedValue={ts.billingBasis || "Milestone"}
                          actualLabel="Status:"
                          actualValue={ts.status}
                          isLast
                        />
                      </React.Fragment>
                    ) : (
                      <React.Fragment>
                        <TimelineFeedItem
                          icon="Briefcase"
                          iconTone="teal"
                          title="Period opened"
                          schedLabel="Period start:"
                          schedValue={ts.periodStart}
                          actualLabel="Reference:"
                          actualValue={ts.engagementRef}
                        />
                        <TimelineFeedItem
                          icon="PersonClock"
                          iconTone="teal"
                          title="Billable hours captured"
                          schedLabel="Scheduled:"
                          schedValue={ts.schedDuration}
                          actualLabel="Billable:"
                          actualValue={ts.billableHours}
                        />
                        <TimelineFeedItem
                          icon="TimeUndo"
                          iconTone="teal"
                          title="Non‑billable logged"
                          schedLabel="Category:"
                          schedValue="Internal / training"
                          actualLabel="Non‑billable:"
                          actualValue={ts.nonBillableHours || "—"}
                        />
                        <TimelineFeedItem
                          icon="ClipboardPerson"
                          iconTone="teal"
                          title="Period closed"
                          schedLabel="Period end:"
                          schedValue={ts.periodEnd}
                          actualLabel="Submitted:"
                          actualValue={ts.periodEnd}
                          isLast
                        />
                      </React.Fragment>
                    )
                  ) : (
                  <React.Fragment>
                  <TimelineFeedItem
                    icon="PersonClock"
                    iconTone="teal"
                    title="Started shift"
                    schedLabel="Scheduled start:"
                    schedValue={ts.schedStart}
                    actualLabel="Actual start:"
                    actualValue={ts.actualStart}
                  />
                  <TimelineFeedItem
                    icon="DrinkMug"
                    iconTone="teal"
                    title="Started break"
                    schedLabel="Scheduled break:"
                    schedValue={`${schedBreakMins} mins`}
                    actualLabel="Actual start:"
                    actualValue={actualBreakStart}
                  />
                  <TimelineFeedItem
                    icon="DrinkMug"
                    iconTone="teal"
                    title="Ended break"
                    schedLabel="Actual break:"
                    schedValue={`${actualBreakMins} mins`}
                    actualLabel="Actual end:"
                    actualValue={actualBreakEnd}
                  />
                  <TimelineFeedItem
                    icon="ClipboardPerson"
                    iconTone="teal"
                    title="Ended assignment"
                    schedLabel="Scheduled end:"
                    schedValue={ts.schedEnd}
                    actualLabel="Actual end:"
                    actualValue={ts.actualEnd}
                    isLast
                  />
                  </React.Fragment>
                  )}
                </div>
              </div>
            </div>

            <footer className="ts-timeline-end">
              {pro ? `${ts.periodEnd} – ${milestoneRow ? "Engagement end" : "Period end"}` : `${endStamp} – End`}
            </footer>
          </section>
        </div>
      </div>
    </React.Fragment>
  );
}

Object.assign(window, { TimesheetsPage, TimesheetDetailsPage, TIMESHEETS, TimelineFeedItem, _tsHourMarkers, _tsParseClock, _tsFmtClock });

// ---------- Status tabs strip ------------------------------------------
// Lives ABOVE the table card. Renders via shared StatusTabs in the
// `everest` variant — same Everest design-system Tabs group spec used
// on Requisitions (48h, 4px bottom indicator, bold-active 16px); no
// count pills, no "All" tab. Defaults to "Open".
const TS_STATUS_TABS_LIST = [
  { id: "Open",             label: "Open" },
  { id: "Pending Approval", label: "Pending approval" },
  { id: "Review",           label: "Review" },
  { id: "Closed",           label: "Closed" },
];
function TS_STATUS_TABS_STRIP({ active, onChange }) {
  return (
    <StatusTabs
      tabs={TS_STATUS_TABS_LIST}
      active={active}
      onChange={onChange}
      variant="everest"
      ariaLabel="Filter timesheets by status"
    />
  );
}
